import { BaseRepository } from "./base.repository.js";

const DEFAULTS: Record<string, unknown> = {
  mcpSetTaskEnabled: true,
  mcpJiraEnabled: true,
  discordWebhookUrl: null,
};

export class PreferencesRepository extends BaseRepository {
  async get(key: string): Promise<string | null> {
    const row = await this.queryOne<{ value: string }>(
      "SELECT value FROM user_preferences WHERE key = $1",
      [key]
    );
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.query(
      `INSERT INTO user_preferences (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.query<{ key: string; value: string }>(
      "SELECT key, value FROM user_preferences"
    );

    const result: Record<string, unknown> = { ...DEFAULTS };
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }
}
