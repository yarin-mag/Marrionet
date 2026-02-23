import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AgentSnapshot, MarionetteEvent, AgentStatus } from "@marionette/shared";

interface MarionetteDB extends DBSchema {
  agents: {
    key: string;
    value: AgentSnapshot;
    indexes: { "by-status": AgentStatus; "by-timestamp": number };
  };
  events: {
    key: number;
    value: MarionetteEvent & { id?: number };
    indexes: { "by-agent": string; "by-timestamp": string };
  };
  preferences: {
    key: string;
    value: any;
  };
}

class DatabaseService {
  private db: IDBPDatabase<MarionetteDB> | null = null;
  private readonly DB_NAME = "marionette";
  private readonly DB_VERSION = 1;

  /**
   * Initialize database
   */
  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<MarionetteDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Agents store
        if (!db.objectStoreNames.contains("agents")) {
          const agentStore = db.createObjectStore("agents", {
            keyPath: "agent_id",
          });
          agentStore.createIndex("by-status", "status");
          agentStore.createIndex("by-timestamp", "last_activity");
        }

        // Events store
        if (!db.objectStoreNames.contains("events")) {
          const eventStore = db.createObjectStore("events", {
            keyPath: "id",
            autoIncrement: true,
          });
          eventStore.createIndex("by-agent", "agent_id");
          eventStore.createIndex("by-timestamp", "ts");
        }

        // Preferences store
        if (!db.objectStoreNames.contains("preferences")) {
          db.createObjectStore("preferences");
        }
      },
    });
  }

  /**
   * Save agent to cache
   */
  async saveAgent(agent: AgentSnapshot): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put("agents", agent);
  }

  /**
   * Save multiple agents
   */
  async saveAgents(agents: AgentSnapshot[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction("agents", "readwrite");
    await Promise.all(agents.map((agent) => tx.store.put(agent)));
    await tx.done;
  }

  /**
   * Get all agents from cache
   */
  async getAgents(): Promise<AgentSnapshot[]> {
    if (!this.db) await this.init();
    return this.db!.getAll("agents");
  }

  /**
   * Get agents by status
   */
  async getAgentsByStatus(status: AgentStatus): Promise<AgentSnapshot[]> {
    if (!this.db) await this.init();
    return this.db!.getAllFromIndex("agents", "by-status", status);
  }

  /**
   * Get single agent
   */
  async getAgent(agentId: string): Promise<AgentSnapshot | undefined> {
    if (!this.db) await this.init();
    return this.db!.get("agents", agentId);
  }

  /**
   * Clear all agents
   */
  async clearAgents(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear("agents");
  }

  /**
   * Save event
   */
  async saveEvent(event: MarionetteEvent): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.add("events", event);
  }

  /**
   * Get events for agent
   */
  async getEventsByAgent(agentId: string, limit = 100): Promise<MarionetteEvent[]> {
    if (!this.db) await this.init();
    const events = await this.db!.getAllFromIndex("events", "by-agent", agentId);
    return events.slice(0, limit);
  }

  /**
   * Clear old events (older than N days)
   */
  async clearOldEvents(daysToKeep = 7): Promise<void> {
    if (!this.db) await this.init();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoff = cutoffDate.toISOString();

    const tx = this.db!.transaction("events", "readwrite");
    const index = tx.store.index("by-timestamp");

    for await (const cursor of index.iterate()) {
      if (cursor.value.ts < cutoff) {
        await cursor.delete();
      }
    }

    await tx.done;
  }

  /**
   * Save preference
   */
  async setPreference(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put("preferences", value, key);
  }

  /**
   * Get preference
   */
  async getPreference<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (!this.db) await this.init();
    const value = await this.db!.get("preferences", key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    await Promise.all([
      this.db!.clear("agents"),
      this.db!.clear("events"),
      this.db!.clear("preferences"),
    ]);
  }
}

export const dbService = new DatabaseService();
