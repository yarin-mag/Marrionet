import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { calendarService } from "../../../services/calendar.service";
import { useDemoMode } from "../../../hooks/useDemoMode";
import { DEMO_CALENDAR_SESSIONS } from "../../../lib/demo-data";
import { usePersonalTasks } from "../hooks/usePersonalTasks";
import type { CalendarEvent } from "./calendar-colors";

interface DateRange {
  start: Date;
  end: Date;
}

export function useCalendarData(dateRange: DateRange) {
  const isDemoMode = useDemoMode();

  const demoSessions = useMemo(
    () =>
      isDemoMode
        ? DEMO_CALENDAR_SESSIONS.filter(
            (s) => s.startTime <= dateRange.end && s.endTime >= dateRange.start
          )
        : [],
    [isDemoMode, dateRange]
  );

  const { data: realSessions = [], isLoading } = useQuery({
    queryKey: ["calendar-sessions", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => calendarService.getAgentSessions(dateRange.start, dateRange.end),
    enabled: !isDemoMode,
    staleTime: 30000,
  });

  const sessions = isDemoMode ? demoSessions : realSessions;
  const { data: personalTasks = [] } = usePersonalTasks(dateRange.start, dateRange.end);

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

  return { sessions, personalTasks, events, isLoading };
}
