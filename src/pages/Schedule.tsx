import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateScheduleDialog } from "@/components/CreateScheduleDialog";
import { EditScheduleDialog } from "@/components/EditScheduleDialog";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import CalendarSync from "@/components/CalendarSync";
import { Plus, Calendar, Trash2, Clock, MapPin, Edit, Zap } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, isWithinInterval, parseISO } from "date-fns";

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  course_id: string;
  courses: {
    code: string;
    title: string;
  };
}

interface Course {
  id: string;
  code: string;
  title: string;
  semester: string;
  year: number;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Schedule = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<{semester: string; year: number}[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [generatingSessions, setGeneratingSessions] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    }
  }, [user]);

  useEffect(() => {
    if (userRole) {
      fetchCourses();
      fetchSchedules();
    }
  }, [userRole]);

  const fetchUserRole = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .single();
    
    if (data) {
      setUserRole(data.role);
    }
  };

  const fetchCourses = async () => {
    let coursesData: Course[] = [];
    
    if (userRole === "faculty" || userRole === "admin") {
      const { data } = await supabase
        .from("courses")
        .select("id, code, title, semester, year")
        .eq(userRole === "faculty" ? "faculty_id" : "status", userRole === "faculty" ? user!.id : "active")
        .eq("status", "active");
      coursesData = data || [];
    } else {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user!.id)
        .eq("status", "active");
      
      if (enrollments && enrollments.length > 0) {
        const courseIds = enrollments.map(e => e.course_id);
        const { data } = await supabase
          .from("courses")
          .select("id, code, title, semester, year")
          .in("id", courseIds);
        coursesData = data || [];
      }
    }
    
    setCourses(coursesData);
    
    // Extract unique semesters
    const uniqueSemesters = coursesData.reduce((acc, course) => {
      const key = `${course.semester}-${course.year}`;
      if (!acc.find(s => `${s.semester}-${s.year}` === key)) {
        acc.push({ semester: course.semester, year: course.year });
      }
      return acc;
    }, [] as {semester: string; year: number}[]);
    
    setSemesters(uniqueSemesters.sort((a, b) => b.year - a.year || a.semester.localeCompare(b.semester)));
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("schedules")
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          room,
          start_date,
          end_date,
          is_active,
          course_id,
          courses(code, title)
        `)
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      setSchedules(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Schedule has been removed.",
      });

      fetchSchedules();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleCreateClick = () => {
    if (courses.length === 0) {
      toast({
        title: "No Courses",
        description: "You need to create a course first before adding schedules.",
        variant: "destructive",
      });
      return;
    }
    setCreateDialogOpen(true);
  };

  const handleGenerateSessions = async () => {
    if (filteredSchedules.length === 0) {
      toast({
        title: "No Schedules",
        description: "Create schedules first before generating attendance sessions.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingSessions(true);
    try {
      const today = new Date();
      const nextWeekStart = startOfWeek(addDays(today, 7));
      let sessionsCreated = 0;

      for (const schedule of filteredSchedules) {
        // Find the next occurrence of this day of week
        let targetDate = nextWeekStart;
        while (targetDate.getDay() !== schedule.day_of_week) {
          targetDate = addDays(targetDate, 1);
        }

        // Check if within schedule date range
        const scheduleStart = parseISO(schedule.start_date);
        const scheduleEnd = schedule.end_date ? parseISO(schedule.end_date) : addDays(today, 365);
        
        if (!isWithinInterval(targetDate, { start: scheduleStart, end: scheduleEnd })) {
          continue;
        }

        // Check if session already exists
        const dateStr = format(targetDate, "yyyy-MM-dd");
        const { data: existing } = await supabase
          .from("attendance_sessions")
          .select("id")
          .eq("course_id", schedule.course_id)
          .eq("session_date", dateStr)
          .eq("session_time", schedule.start_time);

        if (existing && existing.length > 0) continue;

        // Create attendance session
        const qrCode = `EDU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(`${dateStr}T${schedule.end_time}`);

        const { error } = await supabase.from("attendance_sessions").insert({
          course_id: schedule.course_id,
          faculty_id: user!.id,
          session_date: dateStr,
          session_time: schedule.start_time,
          qr_code: qrCode,
          expires_at: expiresAt.toISOString(),
          geofence_radius: 100,
        });

        if (!error) sessionsCreated++;
      }

      toast({
        title: "Sessions Generated",
        description: `Created ${sessionsCreated} attendance session(s) for next week.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingSessions(false);
    }
  };

  // Filter by semester first, then by course
  const semesterFilteredCourseIds = selectedSemester === "all"
    ? courses.map(c => c.id)
    : courses.filter(c => `${c.semester}-${c.year}` === selectedSemester).map(c => c.id);

  const filteredSchedules = schedules
    .filter(s => semesterFilteredCourseIds.includes(s.course_id))
    .filter(s => selectedCourse === "all" || s.course_id === selectedCourse);

  const isAdmin = userRole === "admin";

  const formatTime = (time: string) => {
    const [hour, min] = time.split(":");
    const h = parseInt(hour);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${min} ${period}`;
  };

  if (authLoading || !user) {
    return null;
  }

  const isFaculty = userRole === "faculty";
  const canEditSchedule = isAdmin || isFaculty; // Admin and faculty can edit schedules

  return (
    <DashboardLayout role={isFaculty ? "faculty" : "student"}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Class Schedule</h1>
            <p className="text-muted-foreground">
              {isFaculty ? "Manage your course schedules" : "View your class schedule"}
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {semesters.map((sem) => (
                  <SelectItem key={`${sem.semester}-${sem.year}`} value={`${sem.semester}-${sem.year}`}>
                    {sem.semester} {sem.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses
                  .filter(c => selectedSemester === "all" || `${c.semester}-${c.year}` === selectedSemester)
                  .map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {(isFaculty || canEditSchedule) && (
              <>
                <Button variant="outline" onClick={handleGenerateSessions} disabled={generatingSessions}>
                  <Zap className="h-4 w-4 mr-2" />
                  {generatingSessions ? "Generating..." : "Generate Sessions"}
                </Button>
                {canEditSchedule && (
                  <Button onClick={handleCreateClick}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <>
            <WeeklyCalendar schedules={filteredSchedules} />

            {canEditSchedule && filteredSchedules.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Schedule Details</CardTitle>
                  <CardDescription>Manage recurring class schedules</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSchedules.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{schedule.courses.code}</p>
                              <p className="text-sm text-muted-foreground">{schedule.courses.title}</p>
                            </div>
                          </TableCell>
                          <TableCell>{DAYS_OF_WEEK[schedule.day_of_week]}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {schedule.room ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {schedule.room}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {schedule.start_date} - {schedule.end_date || "Ongoing"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditSchedule(schedule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(schedule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {filteredSchedules.length === 0 && (
              <Card className="p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Schedules</h3>
                <p className="text-muted-foreground mb-4">
                  {canEditSchedule
                    ? "Add your first class schedule to get started."
                    : "No class schedules are available yet."}
                </p>
                {canEditSchedule && (
                  <Button onClick={handleCreateClick}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                )}
              </Card>
            )}

            {/* Calendar Sync Component */}
            <CalendarSync schedules={filteredSchedules} />
          </>
        )}
      </div>

      {createDialogOpen && (
        <CreateScheduleDialog
          courses={courses}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={fetchSchedules}
        />
      )}

      <EditScheduleDialog
        schedule={editSchedule}
        open={!!editSchedule}
        onOpenChange={(open) => !open && setEditSchedule(null)}
        onSuccess={fetchSchedules}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this recurring schedule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Schedule;
