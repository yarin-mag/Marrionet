import type { CalendarEvent } from "./calendar-colors";

export function CalendarEventComponent({ event }: { event: CalendarEvent }) {
  if (event.type === "personal") {
    return (
      <div className="px-1 py-0.5 text-xs overflow-hidden">
        <div className="font-semibold truncate">📝 {event.personalTask!.title}</div>
        {event.personalTask!.description && (
          <div className="truncate opacity-80">{event.personalTask!.description}</div>
        )}
      </div>
    );
  }
  const session = event.session!;
  const duration = Math.round(
    (session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60
  );
  return (
    <div className="px-1 py-0.5 text-xs overflow-hidden">
      <div className="font-semibold truncate">{session.agentName}</div>
      <div className="truncate opacity-90">{session.task}</div>
      <div className="text-[10px] opacity-75">{duration}m</div>
    </div>
  );
}
