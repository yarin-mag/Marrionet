import { API_URL } from "../lib/constants";

export interface PersonalTask {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  created_at?: string;
  updated_at?: string;
}

class PersonalTasksService {
  private baseUrl = `${API_URL}/api/personal-tasks`;

  async list(start?: Date, end?: Date): Promise<PersonalTask[]> {
    const url = new URL(this.baseUrl);
    if (start) url.searchParams.set("start", start.toISOString());
    if (end) url.searchParams.set("end", end.toISOString());
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch personal tasks: ${res.statusText}`);
    return res.json();
  }

  async create(data: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
  }): Promise<PersonalTask> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create task: ${res.statusText}`);
    return res.json();
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      start_time?: string;
      end_time?: string;
    }
  ): Promise<PersonalTask> {
    const res = await fetch(`${this.baseUrl}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update task: ${res.statusText}`);
    return res.json();
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete task: ${res.statusText}`);
  }
}

export const personalTasksService = new PersonalTasksService();
