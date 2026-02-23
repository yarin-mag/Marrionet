# Analytics Feature Documentation

## 📊 Overview

Added comprehensive analytics view to track agent performance, model usage, and activity patterns. The analytics dashboard provides insights into how your agents are performing across different models.

---

## ✨ Features Added

### 1. **Analytics View Tab** ✅
New 4th tab in the view selector:
- Grid | Table | Kanban | **Analytics** 📊

### 2. **Overall Statistics** ✅
Six key metrics at the top:
- **Total Agents**: Current agent count
- **Total Runs**: Cumulative runs across all agents
- **Total Tasks**: Cumulative tasks completed
- **Total Tokens**: Sum of all tokens used (formatted: K/M)
- **Total Duration**: Cumulative runtime
- **Total Errors**: Sum of all errors

### 3. **Status Distribution Chart** ✅
Horizontal bar chart showing:
- 🟢 Working agents
- ⚪ Idle agents
- 🔴 Error/crashed/blocked agents
- Percentage-based bar width
- Real-time updates

### 4. **Activity Timeline** ✅
Agents grouped by last activity:
- **Last Hour**: Active in last 60 minutes
- **Today**: Active in last 24 hours
- **This Week**: Active in last 7 days
- **Older**: Inactive for over a week

### 5. **Agents by Model Chart** ✅
Bar chart showing agent distribution:
- Claude Opus 4.6
- Claude Sonnet 4.5
- Claude Sonnet 3.5
- Claude Haiku 4.5
- Unknown Model
- Shows count and percentage
- Gradient bar coloring

### 6. **Model Performance Table** ✅
Comprehensive metrics per model:
- **Agents**: Number of agents using this model
- **Total Runs**: Cumulative runs
- **Total Tasks**: Tasks completed
- **Total Tokens**: Tokens consumed
- **Avg Tokens/Run**: Average efficiency
- **Total Duration**: Runtime
- **Errors**: Total errors
- **Error Rate**: Percentage of runs with errors

### 7. **Token Usage by Model Chart** ✅
Bar chart showing token consumption:
- Relative comparison between models
- Identifies token-heavy models
- Formatted numbers (K/M notation)

### 8. **Duration by Model Chart** ✅
Bar chart showing runtime:
- Compare which models run longer
- Formatted durations (s/m/h)

---

## 🎨 Visual Design

### Charts
- **Progress Bars**: Clean, rounded, gradient-filled
- **Color Coding**:
  - Green (#10b981): Working, Duration
  - Gray (#6b7280): Idle
  - Red (#ef4444): Errors
  - Blue (accent): General metrics
  - Orange (#f59e0b): Tokens
- **Smooth Animations**: 0.3s transitions on value changes
- **Responsive**: Adapts to screen size

### Layout
- Grid-based statistics cards
- Full-width charts
- Scrollable table for detailed metrics
- Consistent spacing and typography

---

## 🔍 Model Detection

Currently, model detection uses heuristics:

```typescript
function extractModel(agent: AgentSnapshot): string {
  // 1. Check metadata.model (preferred)
  if (agent.metadata?.model) return agent.metadata.model;

  // 2. Parse from agent_name or terminal
  const text = (agent.agent_name || agent.terminal || "").toLowerCase();

  if (text.includes("opus")) return "Claude Opus 4.6";
  if (text.includes("sonnet-4-5")) return "Claude Sonnet 4.5";
  if (text.includes("sonnet")) return "Claude Sonnet 3.5";
  if (text.includes("haiku")) return "Claude Haiku 4.5";

  return "Unknown Model";
}
```

### ⚠️ Backend Enhancement Needed

**Recommended**: Update MCP server to explicitly track model:

```typescript
// In AgentSnapshot type
export type AgentSnapshot = {
  // ... existing fields
  model?: string;  // Add this field
  model_id?: string;  // e.g., "claude-sonnet-4-5-20250929"
  // ... rest of fields
}
```

**Benefits:**
- Accurate model tracking
- No string parsing needed
- Support for custom models
- Better analytics reliability

---

## 📈 Metrics Explained

### Per-Agent Metrics
Currently tracked in `AgentSnapshot`:
- ✅ `total_runs` - Total number of runs
- ✅ `total_tasks` - Total tasks completed
- ✅ `total_errors` - Total errors encountered
- ✅ `total_tokens` - Total tokens used
- ✅ `total_duration_ms` - Total runtime in milliseconds
- ✅ `last_activity` - Last activity timestamp

### Calculated Metrics
- **Error Rate**: `(total_errors / total_runs) * 100`
- **Avg Tokens/Run**: `total_tokens / total_runs`
- **Activity Category**: Based on `last_activity` timestamp

### Aggregated Metrics
- Sum across all agents
- Sum per model
- Sum per status
- Sum per time category

---

## 🚀 Usage

### Accessing Analytics
1. Open the dashboard
2. Click the **Analytics** tab (📊)
3. View real-time statistics and charts

### Interpreting Charts

**Agents by Model**
- Shows which models are most used
- Helps balance workload
- Identifies popular models

**Model Performance Table**
- Compare efficiency between models
- Identify high-error models
- Optimize token usage

**Token Usage Chart**
- Monitor cost (tokens = cost)
- Find token-heavy models
- Optimize prompts

**Duration Chart**
- See which models are slowest
- Identify bottlenecks
- Plan capacity

**Activity Timeline**
- Track agent engagement
- Identify inactive agents
- Clean up stale agents

---

## 🔄 Real-Time Updates

Analytics automatically update when:
- New agents connect
- Agent status changes
- Metrics are updated via MCP
- WebSocket broadcasts received

Updates happen via:
1. `useAgents` hook polls every 5s
2. WebSocket pushes instant updates
3. React re-renders analytics view

---

## 💡 Use Cases

### For Individual Developers
- Track personal agent usage
- Monitor token consumption
- Identify error patterns
- Optimize workflows

### For Team Leads
- Compare team members' usage
- Identify high-error projects
- Balance workloads
- Track costs (via tokens)

### For Organizations
- Monitor fleet-wide metrics
- Optimize model selection
- Capacity planning
- Cost analysis

---

## 🎯 Future Enhancements

### Short-term (Easy)
- [ ] Export analytics to CSV
- [ ] Date range filters (last 7d, 30d, all time)
- [ ] Sort model performance table by any column
- [ ] Toggle between absolute/relative charts

### Medium-term
- [ ] Time-series line charts (activity over time)
- [ ] Agent comparison (compare 2+ agents)
- [ ] Custom metric thresholds with alerts
- [ ] Agent efficiency score

### Long-term (Requires Backend)
- [ ] Historical data storage (database)
- [ ] Cost estimation per model
- [ ] Predictive analytics (ML)
- [ ] Custom dashboard builder
- [ ] API for external integrations

---

## 🛠️ Technical Implementation

### Component Structure
```
AnalyticsView.tsx
├─ Overall Stats (6 cards)
├─ Status Distribution (bar chart)
├─ Activity Timeline (4 categories)
├─ Agents by Model (bar chart)
├─ Model Performance Table
├─ Token Usage Chart
└─ Duration Chart
```

### Data Flow
```
agents[] (from useAgents hook)
  ↓
useMemo: compute analytics
  ↓
{
  byModel: Record<model, agents[]>
  byStatus: { working, idle, error }
  byTimeCategory: { "Last Hour", "Today", ... }
  modelStats: { model, count, totalRuns, ... }[]
  totalRuns, totalErrors, totalTokens, ...
}
  ↓
Render charts and tables
```

### Performance
- **Memoized**: `useMemo` prevents recalculation
- **Efficient**: Single pass through agents array
- **Lightweight**: No external chart libraries
- **Smooth**: CSS animations, no JS reflow

---

## 📊 Example Analytics Output

### Sample Data
```
Overall Stats:
- Total Agents: 12
- Total Runs: 347
- Total Tasks: 89
- Total Tokens: 2.4M
- Total Duration: 4.2h
- Total Errors: 23

Agents by Model:
- Claude Sonnet 4.5: 7 agents (58%)
- Claude Opus 4.6: 3 agents (25%)
- Claude Haiku 4.5: 2 agents (17%)

Model Performance:
┌──────────────────┬────────┬───────┬────────┬──────────┐
│ Model            │ Agents │ Runs  │ Tokens │ Error %  │
├──────────────────┼────────┼───────┼────────┼──────────┤
│ Sonnet 4.5       │ 7      │ 189   │ 1.2M   │ 5.8%     │
│ Opus 4.6         │ 3      │ 98    │ 890K   │ 8.2%     │
│ Haiku 4.5        │ 2      │ 60    │ 310K   │ 3.3%     │
└──────────────────┴────────┴───────┴────────┴──────────┘

Activity Timeline:
- Last Hour: 5 agents
- Today: 8 agents
- This Week: 11 agents
- Older: 1 agent
```

---

## ✅ Testing Checklist

- [ ] Open Analytics tab
- [ ] Check all 6 overall stats display correctly
- [ ] Verify status distribution chart shows percentages
- [ ] Check activity timeline categories
- [ ] Verify agents by model chart
- [ ] Check model performance table calculations
- [ ] Verify token usage chart
- [ ] Check duration chart
- [ ] Test with 0 agents (empty state)
- [ ] Test with 1 agent
- [ ] Test with multiple models
- [ ] Verify real-time updates

---

## 🎉 Summary

The Analytics view provides comprehensive insights into agent performance:
- ✅ Visual charts for quick insights
- ✅ Detailed tables for deep analysis
- ✅ Real-time updates
- ✅ Per-model breakdowns
- ✅ Activity tracking
- ✅ Error monitoring
- ✅ Token usage tracking
- ✅ Duration analysis

Perfect for monitoring multi-agent workflows and optimizing performance! 📊🚀
