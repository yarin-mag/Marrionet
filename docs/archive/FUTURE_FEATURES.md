🎯 Three-Tier Collection Strategy                                                                                                                                                                          
                                                  
  ---                                                                                                                                                                                                        
  ✅ TIER 1: Already Have It (Calculate from existing data)                                                                                                                                                  

  These metrics require zero new collection - just query/calculate from events we already track!

  1. Tool Usage Analytics 🔧

  Already have: Events with type: "tool.called", type: "tool.result", duration_ms

  -- Tool breakdown
  SELECT
    payload->>'tool_name' as tool,
    COUNT(*) as calls,
    AVG(duration_ms) as avg_duration,
    SUM(CASE WHEN payload->>'success' = 'true' THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
  FROM events
  WHERE agent_id = 'agent_123'
    AND type LIKE 'tool.%'
  GROUP BY tool;

  UI: Pie chart of tool distribution, success rates

  ---
  2. Cost Tracking 💰

  Already have: session_tokens, total_tokens from marionette_report_tokens

  // Server-side calculation
  const MODEL_PRICES = {
    "claude-opus-4": { input: 15.00, output: 75.00 },  // per 1M tokens
    "claude-sonnet-4": { input: 3.00, output: 15.00 },
    "claude-haiku-4": { input: 0.25, output: 1.25 }
  };

  function calculateCost(agent: AgentSnapshot) {
    const model = detectModel(agent); // from agent_name or metadata
    const inputCost = (agent.total_tokens * 0.6) * MODEL_PRICES[model].input / 1_000_000;
    const outputCost = (agent.total_tokens * 0.4) * MODEL_PRICES[model].output / 1_000_000;
    return inputCost + outputCost;
  }

  UI: Cost per agent card, total cost in analytics

  ---
  3. Session Duration & Time Tracking ⏱️

  Already have: session_start, last_activity, total_duration_ms

  // Active time
  const activeTime = agent.total_duration_ms;

  // Session length
  const sessionLength = Date.now() - new Date(agent.session_start).getTime();

  // Idle time
  const idleTime = sessionLength - activeTime;

  // Efficiency
  const efficiency = activeTime / sessionLength;

  UI: Time chart showing active vs idle

  ---
  4. Task Categories 📊

  Already have: agent_name (task names from marionette_set_task)

  // Server-side inference
  function categorizeTask(taskName: string): string {
    if (/bug|fix|issue|error|crash/i.test(taskName)) return "bug_fix";
    if (/feature|add|implement|new/i.test(taskName)) return "feature";
    if (/refactor|cleanup|optimize/i.test(taskName)) return "refactor";
    if (/test|spec|coverage/i.test(taskName)) return "testing";
    if (/doc|readme|comment/i.test(taskName)) return "documentation";
    return "other";
  }

  UI: Task breakdown pie chart in analytics

  ---
  5. Error Rate & Frequency 🚨

  Already have: session_errors, total_errors counters

  // Error rate
  const errorRate = agent.session_errors / agent.session_runs;

  // Errors per hour
  const sessionHours = (Date.now() - new Date(agent.session_start).getTime()) / 3600000;
  const errorsPerHour = agent.session_errors / sessionHours;

  // Trend (compare to previous sessions)
  const errorTrend = currentErrors < previousErrors ? "improving" : "worsening";

  UI: Error rate badge, trend indicator

  ---
  6. Agent Activity Timeline 📈

  Already have: All events with timestamps

  -- Activity timeline
  SELECT
    DATE_TRUNC('hour', ts) as hour,
    COUNT(*) as events,
    SUM(tokens->>'total_tokens')::int as tokens
  FROM events
  WHERE agent_id = 'agent_123'
  GROUP BY hour
  ORDER BY hour;

  UI: Timeline chart showing activity spikes

  ---
  7. Runs & Task Completion ✅

  Already have: session_runs, total_tasks, session_start

  // Runs per hour
  const runsPerHour = agent.session_runs / sessionHours;

  // Tasks per run
  const tasksPerRun = agent.total_tasks / agent.total_runs;

  // Productivity score
  const productivityScore = agent.total_tasks / (sessionHours * agent.session_errors + 1);

  UI: Productivity metrics card

  ---
  8. Token Efficiency 🧠

  Already have: session_tokens, total_tokens, session_runs

  // Tokens per run
  const tokensPerRun = agent.session_tokens / agent.session_runs;

  // Tokens per task
  const tokensPerTask = agent.session_tokens / agent.total_tasks;

  // Cost efficiency (tasks per dollar)
  const costEfficiency = agent.total_tasks / calculateCost(agent);

  UI: Efficiency comparison across agents

  ---
  9. Agent Comparison & Leaderboards 🏆

  Already have: All agent snapshots

  // Top performers
  const topByProductivity = agents.sort((a, b) =>
    (b.total_tasks / b.total_duration_ms) - (a.total_tasks / a.total_duration_ms)
  );

  const topByEfficiency = agents.sort((a, b) =>
    (a.session_tokens / a.session_runs) - (b.session_tokens / b.session_runs)
  );

  const lowestErrors = agents.sort((a, b) =>
    (a.session_errors / a.session_runs) - (b.session_errors / b.session_runs)
  );

  UI: Leaderboard view in analytics

  ---
  10. Collaboration Detection 👥

  Already have: All agents' cwd, terminal

  // Server-side analysis
  const agentsByFolder = agents.reduce((acc, agent) => {
    const folder = agent.cwd?.split('/').pop() || 'unknown';
    acc[folder] = (acc[folder] || []).concat(agent);
    return acc;
  }, {});

  // Alert if multiple agents in same folder
  Object.entries(agentsByFolder).forEach(([folder, agentsInFolder]) => {
    if (agentsInFolder.length > 1) {
      console.warn(`⚠️  ${agentsInFolder.length} agents working in ${folder}`);
    }
  });

  UI: Alert badge on folder when multiple agents present

  ---
  🎣 TIER 2: Add Hooks (Automatic collection, no Claude burden)

  These need new hooks but run automatically without Claude involvement.

  11. Git Context 🔀

  Hook: Run on working-hook (once when agent starts)

  # ~/.claude/settings.json
  {
    "hooks": {
      "working-hook": "bash -c 'GIT_BRANCH=$(git branch --show-current 2>/dev/null); GIT_REPO=$(basename $(git remote get-url origin 2>/dev/null) .git 2>/dev/null); curl -s -X POST
  http://localhost:8787/api/git-context -H \"Content-Type: application/json\" -d
  \"{\\\"terminal\\\":\\\"$TERM\\\",\\\"cwd\\\":\\\"$PWD\\\",\\\"branch\\\":\\\"$GIT_BRANCH\\\",\\\"repo\\\":\\\"$GIT_REPO\\\"}\" 2>/dev/null &'"
    }
  }

  What it captures: Branch name, repo name
  When: Once on start, updates don't matter much

  ---
  12. Code Changes Tracking 📝

  Hook: Run on assistant-response-hook (after each Claude response)

  {
    "assistant-response-hook": "bash -c 'git diff --shortstat 2>/dev/null | grep -oE \"[0-9]+ files? changed|[0-9]+ insertions?|[0-9]+ deletions?\" | xargs | (read CHANGES && [ -n \"$CHANGES\" ] && curl -s
   -X POST http://localhost:8787/api/code-stats -d \"{\\\"terminal\\\":\\\"$TERM\\\",\\\"stats\\\":\\\"$CHANGES\\\"}\" 2>/dev/null &) || true'"
  }

  What it captures: Files changed, lines added/removed
  When: After each response (if git repo present)

  ---
  13. Environment Info 🖥️

  Hook: Run on working-hook (once on start)

  {
    "working-hook": "bash -c 'curl -s -X POST http://localhost:8787/api/environment -d \"{\\\"terminal\\\":\\\"$TERM\\\",\\\"os\\\":\\\"$(uname -s)\\\",\\\"node\\\":\\\"$(node -v
  2>/dev/null)\\\",\\\"shell\\\":\\\"$SHELL\\\"}\" 2>/dev/null &'"
  }

  What it captures: OS, Node version, shell type
  When: Once on start

  ---
  14. Git Commit Detection 📦

  Hook: Run on tool-call-hook when git commands execute

  {
    "tool-call-hook": "bash -c '[ \"$TOOL_NAME\" = \"Bash\" ] && echo \"$TOOL_INPUT\" | grep -q \"git commit\" && curl -s -X POST http://localhost:8787/api/git-commit -d
  \"{\\\"terminal\\\":\\\"$TERM\\\",\\\"commit_msg\\\":\\\"$(git log -1 --pretty=%B 2>/dev/null)\\\"}\" 2>/dev/null &'"
  }

  What it captures: When commits happen, commit messages
  When: After git commit commands

  ---
  15. Test Execution Detection 🧪

  Hook: Run on tool-call-hook when test commands execute

  {
    "tool-call-hook": "bash -c 'echo \"$TOOL_INPUT\" | grep -qE \"(npm test|pytest|jest|go test)\" && RESULT=$? && curl -s -X POST http://localhost:8787/api/test-run -d
  \"{\\\"terminal\\\":\\\"$TERM\\\",\\\"passed\\\":$RESULT}\" 2>/dev/null &'"
  }

  What it captures: Test runs, pass/fail status
  When: After test commands

  ---