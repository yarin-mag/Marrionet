import { TokenAlertStorage } from "./TokenAlertStorage";
import type { TokenAlert } from "./types";

const STORAGE_KEY = "marionette_token_alerts";

export class LocalStorageTokenAlertStorage extends TokenAlertStorage {
  private read(): Record<string, TokenAlert[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, TokenAlert[]>) : {};
    } catch {
      return {};
    }
  }

  private write(data: Record<string, TokenAlert[]>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  getAlerts(agentId: string): TokenAlert[] {
    return this.read()[agentId] ?? [];
  }

  addAlert(agentId: string, threshold: number): TokenAlert {
    const data = this.read();
    const alert: TokenAlert = {
      id: crypto.randomUUID(),
      agentId,
      threshold,
      fired: false,
      createdAt: new Date().toISOString(),
    };
    data[agentId] = [...(data[agentId] ?? []), alert];
    this.write(data);
    return alert;
  }

  updateAlert(id: string, threshold: number): TokenAlert {
    const data = this.read();
    let updated: TokenAlert | undefined;
    for (const agentId of Object.keys(data)) {
      const idx = data[agentId].findIndex((a) => a.id === id);
      if (idx !== -1) {
        data[agentId][idx] = { ...data[agentId][idx], threshold };
        updated = data[agentId][idx];
        break;
      }
    }
    if (!updated) throw new Error(`TokenAlert ${id} not found`);
    this.write(data);
    return updated;
  }

  removeAlert(id: string): void {
    const data = this.read();
    for (const agentId of Object.keys(data)) {
      const before = data[agentId].length;
      data[agentId] = data[agentId].filter((a) => a.id !== id);
      if (data[agentId].length < before) break;
    }
    this.write(data);
  }

  markFired(id: string): void {
    const data = this.read();
    for (const agentId of Object.keys(data)) {
      const alert = data[agentId].find((a) => a.id === id);
      if (alert) {
        alert.fired = true;
        break;
      }
    }
    this.write(data);
  }
}
