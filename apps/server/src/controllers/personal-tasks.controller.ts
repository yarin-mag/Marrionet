import type { Request, Response } from "express";
import { PersonalTaskService } from "../services/personal-task.service.js";

export class PersonalTasksController {
  private service = new PersonalTaskService();

  async list(req: Request, res: Response) {
    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;
    const tasks = await this.service.list(start, end);
    res.json(tasks);
  }

  async create(req: Request, res: Response) {
    const { title, description, start_time, end_time } = req.body;
    const task = await this.service.create({ title, description, start_time, end_time });
    res.status(201).json(task);
  }

  async getOne(req: Request, res: Response) {
    const task = await this.service.getById(req.params.id);
    if (!task) return res.status(404).json({ error: "Not found" });
    res.json(task);
  }

  async update(req: Request, res: Response) {
    const { title, description, start_time, end_time } = req.body;
    const task = await this.service.update(req.params.id, { title, description, start_time, end_time });
    if (!task) return res.status(404).json({ error: "Not found" });
    res.json(task);
  }

  async remove(req: Request, res: Response) {
    const deleted = await this.service.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  }
}
