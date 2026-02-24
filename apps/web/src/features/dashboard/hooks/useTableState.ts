import { useState, useMemo } from "react";
import type { AgentSnapshot, AgentStatus } from "@marionette/shared";
import { extractFolder } from "../../../lib/utils";
import { useDebounce } from "../../../hooks/useDebounce";

export type SortKey = "name" | "status" | "runs" | "tokens" | "errors" | "last_activity";
export type SortDir = "asc" | "desc";
export type GroupBy = "none" | "status" | "location";

const SEARCH_DEBOUNCE_MS = 250;

function matchesSearch(agent: AgentSnapshot, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = (
    (agent.metadata?.custom_name as string | undefined) ||
    agent.agent_name ||
    ""
  ).toLowerCase();
  const location = extractFolder(agent.cwd || "").toLowerCase();
  const id = agent.agent_id.toLowerCase();
  return name.includes(q) || location.includes(q) || id.includes(q);
}

function sortAgents(agents: AgentSnapshot[], key: SortKey, dir: SortDir): AgentSnapshot[] {
  return [...agents].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":
        cmp = (a.agent_name ?? "").localeCompare(b.agent_name ?? "");
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "runs":
        cmp = a.session_runs - b.session_runs;
        break;
      case "tokens":
        cmp = a.session_tokens - b.session_tokens;
        break;
      case "errors":
        cmp = a.session_errors - b.session_errors;
        break;
      case "last_activity":
        cmp = new Date(a.last_activity).getTime() - new Date(b.last_activity).getTime();
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function groupAgents(
  agents: AgentSnapshot[],
  groupBy: GroupBy
): Array<{ label: string; status?: AgentStatus; agents: AgentSnapshot[] }> {
  if (groupBy === "none") return [{ label: "", agents }];

  const groups = new Map<string, AgentSnapshot[]>();
  for (const agent of agents) {
    const key =
      groupBy === "status"
        ? agent.status
        : extractFolder(agent.cwd || "") || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(agent);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, list]) => ({
      label,
      status: groupBy === "status" ? (label as AgentStatus) : undefined,
      agents: list,
    }));
}

export function useTableState(agents: AgentSnapshot[]) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("last_activity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const processed = useMemo(() => {
    const filtered = agents.filter((a) => matchesSearch(a, debouncedSearch));
    const sorted = sortAgents(filtered, sortKey, sortDir);
    return groupAgents(sorted, groupBy);
  }, [agents, debouncedSearch, sortKey, sortDir, groupBy]);

  return {
    search,
    setSearch,
    sortKey,
    sortDir,
    toggleSort,
    groupBy,
    setGroupBy,
    groups: processed,
    totalVisible: processed.reduce((n, g) => n + g.agents.length, 0),
  };
}
