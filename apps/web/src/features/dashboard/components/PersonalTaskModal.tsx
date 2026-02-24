import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useCreatePersonalTask, useUpdatePersonalTask, useDeletePersonalTask } from "../hooks/usePersonalTasks";
import type { PersonalTask } from "../../../services/personal-tasks.service";

// Personal task brand color — must stay in sync with CalendarView's PERSONAL_TASK_COLOR
const TASK_COLOR_BG = "#84cc16";
const TASK_COLOR_TEXT = "#1a2e05";

// Format a Date to "yyyy-MM-ddTHH:mm" for <input type="datetime-local">
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Parse "yyyy-MM-ddTHH:mm" input back to ISO string
function inputToISO(value: string): string {
  return new Date(value).toISOString();
}

interface PersonalTaskModalProps {
  open: boolean;
  onClose: () => void;
  initialStart?: Date;
  initialEnd?: Date;
  task?: PersonalTask;
}

export function PersonalTaskModal({
  open,
  onClose,
  initialStart,
  initialEnd,
  task,
}: PersonalTaskModalProps) {
  const isEditing = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");

  const createTask = useCreatePersonalTask();
  const updateTask = useUpdatePersonalTask();
  const deleteTask = useDeletePersonalTask();

  // Sync form state when modal opens
  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStartValue(toLocalInput(new Date(task.start_time)));
      setEndValue(toLocalInput(new Date(task.end_time)));
    } else {
      setTitle("");
      setDescription("");
      setStartValue(initialStart ? toLocalInput(initialStart) : "");
      setEndValue(initialEnd ? toLocalInput(initialEnd) : "");
    }
  }, [open, task, initialStart, initialEnd]);

  const isPending = createTask.isPending || updateTask.isPending || deleteTask.isPending;

  async function handleSave() {
    if (!title.trim() || !startValue || !endValue) return;
    if (isEditing) {
      await updateTask.mutateAsync({
        id: task!.id,
        title: title.trim(),
        description: description || null,
        start_time: inputToISO(startValue),
        end_time: inputToISO(endValue),
      });
    } else {
      await createTask.mutateAsync({
        title: title.trim(),
        description: description || undefined,
        start_time: inputToISO(startValue),
        end_time: inputToISO(endValue),
      });
    }
    onClose();
  }

  async function handleDelete() {
    if (!task) return;
    await deleteTask.mutateAsync(task.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: TASK_COLOR_BG }}
            />
            {isEditing ? "Edit Personal Task" : "New Personal Task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need to do?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Notes (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 resize-none"
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start *</label>
              <input
                type="datetime-local"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End *</label>
              <input
                type="datetime-local"
                value={endValue}
                onChange={(e) => setEndValue(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {isEditing ? (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-sm text-rose-500 hover:text-rose-600 disabled:opacity-50 transition-colors"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !title.trim() || !startValue || !endValue}
                className="px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: TASK_COLOR_BG,
                  color: TASK_COLOR_TEXT,
                }}
              >
                {isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
