import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Users, FileCheck, BarChart3, Calendar, PlusCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { QuickSearch } from "@/components/QuickSearch";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";

interface DashboardStats {
  activeCourses: number;
  totalStudents: number;
  pendingEvaluations: number;
  avgAttendance: number;
}

interface TodayClass {
  course: string;
  time: string;
  students: number;
  room: string;
  courseId: string;
}

interface PendingTask {
  task: string;
  count: string;
  priority: "high" | "medium";
}

interface ScheduleClass {
  course: string;
  time: string;
  endTime: string;
  students: number;
  room: string;
  courseId: string;
}

const FacultyDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [stats, setStats] = useState<DashboardStats>({
    activeCourses: 0,
    totalStudents: 0,
    pendingEvaluations: 0,
    avgAttendance: 0,
  });
  const [todaysClasses, setTodaysClasses] = useState<ScheduleClass[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [atRiskCount, setAtRiskCount] = useState(0);

  // Fetch data when user is available
  useEffect(() => {
    if (user) {
      fetchUserName();
      fetchDashboardData();
    }
  }, [user]);

  const fetchUserName = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user!.id)
      .single();
    
    if (data) setUserName(data.full_name);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch active courses count
      const { count: coursesCount } = await supabase
        .from("courses")
        .select("*", { count: "exact", head: true })
        .eq("faculty_id", user!.id);

      // Fetch courses to get their IDs
      const { data: courses } = await supabase
        .from("courses")
        .select("id")
        .eq("faculty_id", user!.id);

      const courseIds = courses?.map((c) => c.id) || [];

      // Fetch total students (distinct enrollments)
      let totalStudents = 0;
      if (courseIds.length > 0) {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("student_id")
          .in("course_id", courseIds)
          .eq("status", "active");

        const uniqueStudents = new Set(enrollments?.map((e) => e.student_id) || []);
        totalStudents = uniqueStudents.size;
      }

      // Fetch pending evaluations (ungraded submissions)
      let pendingEvaluationsCount = 0;
      if (courseIds.length > 0) {
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id")
          .in("course_id", courseIds);

        const assignmentIds = assignments?.map((a) => a.id) || [];

        if (assignmentIds.length > 0) {
          const { count } = await supabase
            .from("submissions")
            .select("*", { count: "exact", head: true })
            .in("assignment_id", assignmentIds)
            .is("grade", null);

          pendingEvaluationsCount = count || 0;
        }
      }

      // Fetch average attendance
      let avgAttendance = 0;
      let sessionIds: string[] = [];
      if (courseIds.length > 0) {
        const { data: sessions } = await supabase
          .from("attendance_sessions")
          .select("id")
          .in("course_id", courseIds);

        sessionIds = sessions?.map((s) => s.id) || [];

        if (sessionIds.length > 0) {
          const { data: records } = await supabase
            .from("attendance_records")
            .select("status")
            .in("session_id", sessionIds);

          if (records && records.length > 0) {
            avgAttendance = Math.round(
              (records.filter((r) => r.status === "present").length / records.length) * 100
            );
          }
        }
      }

      // Fetch today's classes from schedules
      const todayDayOfWeek = new Date().getDay();
      const today = new Date().toISOString().split("T")[0];
      
      if (courseIds.length > 0) {
        const { data: schedules } = await supabase
          .from("schedules")
          .select(`
            id,
            start_time,
            end_time,
            room,
            course_id,
            courses(code, title)
          `)
          .in("course_id", courseIds)
          .eq("day_of_week", todayDayOfWeek)
          .eq("is_active", true)
          .lte("start_date", today)
          .or(`end_date.is.null,end_date.gte.${today}`);

        const classesData = await Promise.all(
          (schedules || []).map(async (schedule: any) => {
            const { count } = await supabase
              .from("enrollments")
              .select("*", { count: "exact", head: true })
              .eq("course_id", schedule.course_id)
              .eq("status", "active");

            return {
              course: `${schedule.courses.code} - ${schedule.courses.title}`,
              time: schedule.start_time,
              endTime: schedule.end_time,
              students: count || 0,
              room: schedule.room || "TBA",
              courseId: schedule.course_id,
            };
          })
        );

        // Sort by time
        classesData.sort((a, b) => a.time.localeCompare(b.time));
        setTodaysClasses(classesData);
      }

      // Calculate at-risk students count
      let atRisk = 0;
      if (sessionIds.length > 0) {
        const { data: studentRecords } = await supabase
          .from("attendance_records")
          .select("student_id, status")
          .in("session_id", sessionIds);

        const studentAttendance: Record<string, { total: number; present: number }> = {};
        studentRecords?.forEach(r => {
          if (!studentAttendance[r.student_id]) {
            studentAttendance[r.student_id] = { total: 0, present: 0 };
          }
          studentAttendance[r.student_id].total++;
          if (r.status === "present" || r.status === "late") {
            studentAttendance[r.student_id].present++;
          }
        });

        Object.values(studentAttendance).forEach(({ total, present }) => {
          if (total > 0 && (present / total) < 0.75) {
            atRisk++;
          }
        });
      }
      setAtRiskCount(atRisk);

      // Build pending tasks
      const tasks: PendingTask[] = [];
      if (pendingEvaluationsCount > 0) {
        tasks.push({
          task: "Grade pending submissions",
          count: `${pendingEvaluationsCount} submissions`,
          priority: "high",
        });
      }

      if (courseIds.length > 0) {
        const { data: materialsCount } = await supabase
          .from("course_materials")
          .select("course_id")
          .in("course_id", courseIds);

        const coursesWithoutMaterials = courseIds.filter(
          (id) => !materialsCount?.some((m) => m.course_id === id)
        );

        if (coursesWithoutMaterials.length > 0) {
          tasks.push({
            task: "Upload course materials",
            count: `${coursesWithoutMaterials.length} courses`,
            priority: "medium",
          });
        }
      }

      setPendingTasks(tasks);

      setStats({
        activeCourses: coursesCount || 0,
        totalStudents,
        pendingEvaluations: pendingEvaluationsCount,
        avgAttendance,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while fetching auth
  if (authLoading) {
    return null; // ProtectedRoute handles the loading spinner
  }

  const quickStats = [
    { label: "Active Courses", value: stats.activeCourses.toString(), icon: BookOpen, color: "text-primary" },
    { label: "Total Students", value: stats.totalStudents.toString(), icon: Users, color: "text-primary" },
    { label: "At-Risk Students", value: atRiskCount.toString(), icon: AlertTriangle, color: atRiskCount > 0 ? "text-destructive" : "text-primary" },
    { label: "Avg. Attendance", value: `${stats.avgAttendance}%`, icon: BarChart3, color: "text-primary" },
  ];

  const formatTime = (time: string) => {
    const [hour, min] = time.split(":");
    const h = parseInt(hour);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${min} ${period}`;
  };

  return (
    <DashboardLayout role="faculty">
      <SEOHead 
        title="Faculty Dashboard" 
        description="Manage your courses, track student progress, and view attendance analytics."
      />
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}!</h1>
            <p className="text-muted-foreground">Manage your courses and track student progress.</p>
          </div>
          <QuickSearch />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="p-6">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold mt-2">{stat.value}</p>
                    </div>
                    <Icon className={`w-12 h-12 ${stat.color}`} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Button className="h-24 flex-col gap-2" onClick={() => navigate("/courses")}>
            <PlusCircle className="w-6 h-6" />
            Create Assignment
          </Button>
          <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => navigate("/schedule")}>
            <Calendar className="w-6 h-6" />
            Manage Schedule
          </Button>
          <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => navigate("/courses")}>
            <FileCheck className="w-6 h-6" />
            Upload Materials
          </Button>
          <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => navigate("/analytics")}>
            <TrendingUp className="w-6 h-6" />
            View Analytics
          </Button>
          <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => navigate("/attendance")}>
            <BarChart3 className="w-6 h-6" />
            Attendance
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Today's Classes */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Today's Classes
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/attendance")}>View Schedule</Button>
            </div>
            <div className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : todaysClasses.length > 0 ? (
                todaysClasses.map((cls, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold">{cls.course}</h3>
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                      <span>{formatTime(cls.time)} - {formatTime(cls.endTime)} • {cls.room}</span>
                      <span>{cls.students} students</span>
                    </div>
                    <Button size="sm" className="mt-3 w-full" onClick={() => navigate("/attendance")}>Mark Attendance</Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No classes scheduled for today</p>
              )}
            </div>
          </Card>

          {/* Pending Tasks */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" />
                Pending Tasks
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/courses")}>View All</Button>
            </div>
            <div className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : pendingTasks.length > 0 ? (
                pendingTasks.map((task, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{task.task}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{task.count}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        task.priority === 'high' 
                          ? 'bg-destructive/10 text-destructive' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No pending tasks</p>
              )}
            </div>
          </Card>
        </div>

        {/* AI Assistant */}
        <Card className="p-8 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">AI-Powered Grading Assistant</h2>
              <p className="text-muted-foreground">Let AI help you evaluate assignments faster with intelligent suggestions</p>
            </div>
            <Button size="lg" onClick={() => navigate("/ai-mentor")}>Try AI Grading</Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FacultyDashboard;