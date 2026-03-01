import { BaseRepository } from "./base.repository.js";

export interface PersonalTaskRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export class PersonalTaskRepository extends BaseRepository {
  async findAll(start?: Date, end?: Date): Promise<PersonalTaskRow[]> {
    if (start && end) {
      return this.query<PersonalTaskRow>(
        "SELECT * FROM personal_tasks WHERE start_time < $1 AND end_time > $2 ORDER BY start_time ASC",
        [end.toISOString(), start.toISOString()]
      );
    }
    return this.query<PersonalTaskRow>(
      "SELECT * FROM personal_tasks ORDER BY start_time ASC"
    );
  }

  async findById(id: string): Promise<PersonalTaskRow | null> {
    return (
      (await this.queryOne<PersonalTaskRow>(
        "SELECT * FROM personal_tasks WHERE id = $1",
        [id]
      )) ?? null
    );
  }

  async create(task: {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
  }): Promise<PersonalTaskRow> {
    await this.query(
      `INSERT INTO personal_tasks (id, title, description, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5)`,
      [task.id, task.title, task.description ?? null, task.start_time, task.end_time]
    );
    // Return the row directly — all field values are known, so no second DB round-trip needed.
    const now = new Date().toISOString();
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      start_time: task.start_time,
      end_time: task.end_time,
      created_at: now,
      updated_at: now,
    };
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
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.start_time !== undefined) { fields.push(`start_time = $${idx++}`); values.push(updates.start_time); }
    if (updates.end_time !== undefined) { fields.push(`end_time = $${idx++}`); values.push(updates.end_time); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await this.query(
      `UPDATE personal_tasks SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.query(
      "DELETE FROM personal_tasks WHERE id = $1 RETURNING id",
      [id]
    );
    return result.length > 0;
  }
}
