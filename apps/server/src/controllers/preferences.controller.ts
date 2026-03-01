import type { Request, Response } from "express";
import { PreferencesRepository } from "../repositories/preferences.repository.js";

const ALLOWED_PREFERENCE_KEYS = new Set([
  "mcpSetTaskEnabled",
  "mcpJiraEnabled",
  "calendarClickToAdd",
]);

export class PreferencesController {
  private repo = new PreferencesRepository();

  async getPreferences(_req: Request, res: Response) {
    const prefs = await this.repo.getAll();
    res.json(prefs);
  }

  async setPreferences(req: Request, res: Response) {
    const body = req.body as Record<string, unknown>;
    const unknownKeys = Object.keys(body).filter((k) => !ALLOWED_PREFERENCE_KEYS.has(k));
    if (unknownKeys.length > 0) {
      res.status(400).json({ error: `Unknown preference keys: ${unknownKeys.join(", ")}` });
      return;
    }
    for (const [key, value] of Object.entries(body)) {
      await this.repo.set(key, JSON.stringify(value));
    }
    const prefs = await this.repo.getAll();
    res.json(prefs);
  }
}
