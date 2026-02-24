import { PersonalTaskRepository, type PersonalTaskRow } from "../repositories/personal-task.repository.js";
import { randomUUID } from "crypto";

export class PersonalTaskService {
  private repository = new PersonalTaskRepository();

  async list(start?: Date, end?: Date): Promise<PersonalTaskRow[]> {
    return this.repository.findAll(start, end);
  }

  async getById(id: string): Promise<PersonalTaskRow | null> {
    return this.repository.findById(id);
  }

  async create(data: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
  }): Promise<PersonalTaskRow> {
    if (!data.title?.trim()) throw new Error("title is required");
    if (!data.start_time) throw new Error("start_time is required");
    if (!data.end_time) throw new Error("end_time is required");

    return this.repository.create({
      id: randomUUID(),
      title: data.title.trim(),
      description: data.description,
      start_time: data.start_time,
      end_time: data.end_time,
    });
  }

  async update(
    id: string,
    updates: {
      title?: string;
      description?: string | null;
      start_time?: string;
      end_time?: string;
    }
  ): Promise<PersonalTaskRow | null> {
    const existing = await this.repository.findById(id);
    if (!existing) return null;
    return this.repository.update(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }
}
