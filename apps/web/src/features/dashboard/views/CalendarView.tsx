import { useState, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { calendarService, type AgentSession } from "../../../services/calendar.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { formatTime, formatTokens, cn } from "../../../lib/utils";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

// Israeli timezone
const ISRAELI_TIMEZONE = "Asia/Jerusalem";

// Setup localizer for react-big-calendar
const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Calendar event type
interface CalendarEvent extends Event {
  session: AgentSession;
}

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

interface CalendarViewProps {
  onSessionClick?: (session: AgentSession) => void;
}

export function CalendarView({ onSessionClick }: CalendarViewProps) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("week");

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
    staleTime: 30000, // 30 seconds
  });

  // Transform sessions to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return sessions.map((session) => ({
      title: session.agentName,
      start: session.startTime,
      end: session.endTime,
      resource: session,
      session,
    }));
  }, [sessions]);

  // Custom event style
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors = getAgentColor(event.session.agentId);
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
    const session = event.session;
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

  // Handle event selection
  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      onSessionClick?.(event.session);
    },
    [onSessionClick]
  );

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
                Israeli Time (Asia/Jerusalem) • {sessions.length} sessions found
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              🇮🇱 GMT+2/+3
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Legend */}
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
          <div className="h-[700px]">
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
    </div>
  );
}
