import { useState, useMemo, useCallback, useRef } from "react";
import { Calendar, dateFnsLocalizer, Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { calendarService, type AgentSession } from "../../../services/calendar.service";
import { usePersonalTasks } from "../hooks/usePersonalTasks";
import { PersonalTaskModal } from "../components/PersonalTaskModal";
import type { PersonalTask } from "../../../services/personal-tasks.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { formatTokens } from "../../../lib/utils";
import { useUserPreferences } from "../../../hooks/use-user-preferences";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

// Setup localizer for react-big-calendar
const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Calendar event type — either an agent session or a personal task
interface CalendarEvent extends Event {
  type: "agent" | "personal";
  session?: AgentSession;
  personalTask?: PersonalTask;
}

// Personal task color — lime green, visually distinct from all agent colors
const PERSONAL_TASK_COLOR = {
  bg: "#84cc16",
  text: "#1a2e05",
  border: "#65a30d",
};

// Agent color mapping (consistent colors per agent)
const AGENT_COLORS = [
  { bg: "#3b82f6", text: "#ffffff", border: "#2563eb" }, // blue
  { bg: "#10b981", text: "#ffffff", border: "#059669" }, // green
  { bg: "#a855f7", text: "#ffffff", border: "#9333ea" }, // purple
  { bg: "#f97316", text: "#ffffff", border: "#ea580c" }, // orange
  { bg: "#ec4899", text: "#ffffff", border: "#db2777" }, // pink
  { bg: "#06b6d4", text: "#ffffff", border: "#0891b2" }, // cyan
  { bg: "#f59e0b", text: "#ffffff", border: "#d97706" }, // amber
  { bg: "#6366f1", text: "#ffffff", border: "#4f46e5" }, // indigo
];

function getAgentColor(agentId: string): (typeof AGENT_COLORS)[0] {
  const hash = agentId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AGENT_COLORS[hash % AGENT_COLORS.length];
}

interface TaskModalState {
  open: boolean;
  initialStart?: Date;
  initialEnd?: Date;
  task?: PersonalTask;
}

interface CalendarViewProps {
  onSessionClick?: (session: AgentSession) => void;
}

export function CalendarView({ onSessionClick }: CalendarViewProps) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("week");
  const [taskModal, setTaskModal] = useState<TaskModalState>({ open: false });
  const modalJustClosed = useRef(false);
  const { preferences } = useUserPreferences();

  // Calculate date range based on current view
  const dateRange = useMemo(() => {
    const start = new Date(date);
    const end = new Date(date);

    if (view === "month") {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (view === "week") {
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      end.setDate(end.getDate() + (6 - dayOfWeek));
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [date, view]);

  // Fetch agent sessions
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["calendar-sessions", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => calendarService.getAgentSessions(dateRange.start, dateRange.end),
    staleTime: 30000,
  });

  // Fetch personal tasks for the current date range
  const { data: personalTasks = [] } = usePersonalTasks(dateRange.start, dateRange.end);

  // Merge agent sessions and personal tasks into calendar events
  const events: CalendarEvent[] = useMemo(() => [
    ...sessions.map((session) => ({
      type: "agent" as const,
      title: session.agentName,
      start: session.startTime,
      end: session.endTime,
      resource: session,
      session,
    })),
    ...personalTasks.map((task) => ({
      type: "personal" as const,
      title: task.title,
      start: new Date(task.start_time),
      end: new Date(task.end_time),
      personalTask: task,
    })),
  ], [sessions, personalTasks]);

  // Custom event style — lime dashed for personal tasks, hashed color for agent sessions
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    if (event.type === "personal") {
      return {
        style: {
          backgroundColor: PERSONAL_TASK_COLOR.bg,
          color: PERSONAL_TASK_COLOR.text,
          border: `2px dashed ${PERSONAL_TASK_COLOR.border}`,
          borderRadius: "6px",
        },
      };
    }
    const colors = getAgentColor(event.session!.agentId);
    return {
      style: {
        backgroundColor: colors.bg,
        color: colors.text,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: "6px",
      },
    };
  }, []);

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
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
  };

  // Handle event clicks — open session detail or personal task edit modal
  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      if (event.type === "personal") {
        setTaskModal({ open: true, task: event.personalTask });
      } else {
        onSessionClick?.(event.session!);
      }
    },
    [onSessionClick]
  );

  const handleModalClose = useCallback(() => {
    setTaskModal({ open: false });
  }, []);

  // If any Radix dialog overlay is present when a pointerdown hits the calendar,
  // it means a modal is about to close via outside-click — suppress the slot selection.
  const handleCalendarPointerDown = useCallback(() => {
    if (document.querySelector("[data-radix-dialog-overlay]")) {
      modalJustClosed.current = true;
      setTimeout(() => { modalJustClosed.current = false; }, 300);
    }
  }, []);

  // Handle empty slot click — open create modal pre-filled with clicked time
  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    if (modalJustClosed.current) return;
    setTaskModal({ open: true, initialStart: start, initialEnd: end });
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">Loading calendar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agent Work Calendar</CardTitle>
              <CardDescription>
                Israeli Time (Asia/Jerusalem) • {sessions.length} sessions
                {personalTasks.length > 0 && ` • ${personalTasks.length} personal task${personalTasks.length !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {preferences.calendarClickToAdd && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block w-3 h-3 rounded-sm border-2 border-dashed"
                    style={{ backgroundColor: PERSONAL_TASK_COLOR.bg, borderColor: PERSONAL_TASK_COLOR.border }}
                  />
                  Click empty slot to add task
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                🇮🇱 GMT+2/+3
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Agent Legend */}
      {sessions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="text-sm font-medium">Agents:</div>
              {Array.from(new Set(sessions.map((s) => s.agentId)))
                .slice(0, 8)
                .map((agentId) => {
                  const session = sessions.find((s) => s.agentId === agentId)!;
                  const colors = getAgentColor(agentId);
                  return (
                    <div key={agentId} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: colors.bg }}
                      />
                      <span className="text-sm">{session.agentName}</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card>
        <CardContent className="pt-6">
          <div className="h-[700px]" onPointerDownCapture={handleCalendarPointerDown}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%" }}
              view={view}
              onView={setView as any}
              date={date}
              onNavigate={setDate}
              eventPropGetter={eventStyleGetter}
              components={{
                event: EventComponent,
              }}
              onSelectEvent={handleSelectEvent}
              selectable={preferences.calendarClickToAdd}
              onSelectSlot={preferences.calendarClickToAdd ? handleSelectSlot : undefined}
              views={["month", "week", "day"]}
              step={30}
              showMultiDayTimes
              defaultView="week"
            />
          </div>
        </CardContent>
      </Card>

      {/* Session Summary */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Session Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <CardDescription>Total Sessions</CardDescription>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
              <div>
                <CardDescription>Total Hours</CardDescription>
                <p className="text-2xl font-bold">
                  {Math.round(
                    sessions.reduce(
                      (acc, s) =>
                        acc + (s.endTime.getTime() - s.startTime.getTime()) / 1000 / 60 / 60,
                      0
                    ) * 10
                  ) / 10}
                  h
                </p>
              </div>
              <div>
                <CardDescription>Total Runs</CardDescription>
                <p className="text-2xl font-bold">
                  {sessions.reduce((acc, s) => acc + s.runs, 0)}
                </p>
              </div>
              <div>
                <CardDescription>Total Tokens</CardDescription>
                <p className="text-2xl font-bold">
                  {formatTokens(sessions.reduce((acc, s) => acc + s.tokens, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Task Modal */}
      <PersonalTaskModal
        open={taskModal.open}
        onClose={handleModalClose}
        initialStart={taskModal.initialStart}
        initialEnd={taskModal.initialEnd}
        task={taskModal.task}
      />
    </div>
  );
}
