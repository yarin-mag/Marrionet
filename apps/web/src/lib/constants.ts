export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";
export const WS_URL = API_URL.replace("http", "ws");

export const QUERY_KEYS = {
  agents: ["agents"] as const,
  agentDetail: (id: string) => ["agents", id] as const,
  status: ["status"] as const,
  events: (agentId?: string) => ["events", agentId] as const,
};

export const STALE_TIME = {
  agents: 5 * 1000, // 5 seconds
  status: 10 * 1000, // 10 seconds
  events: 30 * 1000, // 30 seconds
};

export const CACHE_TIME = {
  default: 10 * 60 * 1000, // 10 minutes
  long: 60 * 60 * 1000, // 1 hour
};
