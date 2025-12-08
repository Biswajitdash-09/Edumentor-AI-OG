import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays } from "date-fns";

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  course_id: string;
  courses: {
    code: string;
    title: string;
  };
}

interface WeeklyCalendarProps {
  schedules: Schedule[];
  onScheduleClick?: (schedule: Schedule) => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

export function WeeklyCalendar({ schedules, onScheduleClick }: WeeklyCalendarProps) {
  const weekStart = startOfWeek(new Date());

  const schedulesByDay = useMemo(() => {
    const result: Record<number, Schedule[]> = {};
    for (let i = 0; i < 7; i++) {
      result[i] = schedules.filter((s) => s.day_of_week === i);
    }
    return result;
  }, [schedules]);

  const getSchedulePosition = (schedule: Schedule) => {
    const [startHour, startMin] = schedule.start_time.split(":").map(Number);
    const [endHour, endMin] = schedule.end_time.split(":").map(Number);
    
    const top = ((startHour - 7) * 60 + startMin) * (60 / 60); // 60px per hour
    const height = ((endHour - startHour) * 60 + (endMin - startMin)) * (60 / 60);
    
    return { top, height };
  };

  const formatTime = (time: string) => {
    const [hour, min] = time.split(":");
    const h = parseInt(hour);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${min} ${period}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header row with days */}
            <div className="grid grid-cols-8 border-b">
              <div className="p-2 text-sm font-medium text-muted-foreground">Time</div>
              {DAYS.map((day, index) => (
                <div key={day} className="p-2 text-center border-l">
                  <p className="font-medium">{day}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(addDays(weekStart, index), "MMM d")}
                  </p>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="relative grid grid-cols-8" style={{ height: `${HOURS.length * 60}px` }}>
              {/* Time labels */}
              <div className="relative">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full text-xs text-muted-foreground pr-2 text-right"
                    style={{ top: `${(hour - 7) * 60}px` }}
                  >
                    {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {DAYS.map((_, dayIndex) => (
                <div key={dayIndex} className="relative border-l">
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute w-full border-t border-dashed border-muted"
                      style={{ top: `${(hour - 7) * 60}px` }}
                    />
                  ))}

                  {/* Schedules */}
                  {schedulesByDay[dayIndex]?.map((schedule) => {
                    const { top, height } = getSchedulePosition(schedule);
                    return (
                      <div
                        key={schedule.id}
                        className="absolute left-1 right-1 bg-primary/20 border-l-4 border-primary rounded p-1 cursor-pointer hover:bg-primary/30 transition-colors overflow-hidden"
                        style={{ top: `${top}px`, height: `${Math.max(height, 30)}px` }}
                        onClick={() => onScheduleClick?.(schedule)}
                      >
                        <p className="text-xs font-medium truncate">{schedule.courses.code}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                        </p>
                        {schedule.room && height > 50 && (
                          <p className="text-xs text-muted-foreground truncate">{schedule.room}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {schedules.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No class schedules defined yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
