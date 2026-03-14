import type { TokenAlert } from "./types";

export abstract class TokenAlertStorage {
  abstract getAlerts(agentId: string): TokenAlert[];
  abstract addAlert(agentId: string, threshold: number): TokenAlert;
  abstract updateAlert(id: string, threshold: number): TokenAlert;
  abstract removeAlert(id: string): void;
  abstract markFired(id: string): void;
}
