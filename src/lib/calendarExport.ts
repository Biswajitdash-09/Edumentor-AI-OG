import { format, addDays, startOfWeek, parseISO, isWithinInterval } from "date-fns";

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  start_date: string;
  end_date: string | null;
  courses: {
    code: string;
    title: string;
  };
}

const DAYS_OF_WEEK = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function formatICalDate(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss");
}

function escapeText(text: string): string {
  return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
}

function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@edumentor`;
}

export function generateICalendar(schedules: Schedule[], weeksAhead: number = 16): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EduMentor AI//Class Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:EduMentor Class Schedule",
    "X-WR-TIMEZONE:UTC"
  ];

  const today = new Date();
  const calendarEnd = addDays(today, weeksAhead * 7);

  for (const schedule of schedules) {
    const scheduleStart = parseISO(schedule.start_date);
    const scheduleEnd = schedule.end_date 
      ? parseISO(schedule.end_date) 
      : calendarEnd;

    // Find first occurrence of this day of week
    let firstOccurrence = startOfWeek(scheduleStart);
    while (firstOccurrence.getDay() !== schedule.day_of_week) {
      firstOccurrence = addDays(firstOccurrence, 1);
    }
    if (firstOccurrence < scheduleStart) {
      firstOccurrence = addDays(firstOccurrence, 7);
    }

    // Parse times
    const [startHour, startMin] = schedule.start_time.split(":").map(Number);
    const [endHour, endMin] = schedule.end_time.split(":").map(Number);

    // Create DTSTART with time
    const eventStart = new Date(firstOccurrence);
    eventStart.setHours(startHour, startMin, 0, 0);

    const eventEnd = new Date(firstOccurrence);
    eventEnd.setHours(endHour, endMin, 0, 0);

    // Calculate UNTIL date
    const untilDate = scheduleEnd < calendarEnd ? scheduleEnd : calendarEnd;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${generateUID()}`);
    lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
    lines.push(`DTSTART:${formatICalDate(eventStart)}`);
    lines.push(`DTEND:${formatICalDate(eventEnd)}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${DAYS_OF_WEEK[schedule.day_of_week]};UNTIL=${format(untilDate, "yyyyMMdd'T'235959'Z'")}`);
    lines.push(`SUMMARY:${escapeText(schedule.courses.code)} - ${escapeText(schedule.courses.title)}`);
    
    if (schedule.room) {
      lines.push(`LOCATION:${escapeText(schedule.room)}`);
    }
    
    lines.push(`DESCRIPTION:Course: ${escapeText(schedule.courses.code)} - ${escapeText(schedule.courses.title)}${schedule.room ? `\\nRoom: ${escapeText(schedule.room)}` : ''}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

export function downloadCalendar(schedules: Schedule[], filename: string = "class-schedule"): void {
  const icalContent = generateICalendar(schedules);
  const blob = new Blob([icalContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
