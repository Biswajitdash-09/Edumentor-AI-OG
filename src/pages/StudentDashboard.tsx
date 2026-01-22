import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, FileText, MessageSquare, TrendingUp, Clock, Bell } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

interface DashboardStats {
  enrolledCourses: number;
  assignmentsDue: number;
  attendanceRate: number;
  upcomingClasses: number;
}

interface UpcomingClass {
  course: string;
  time: string;
  room: string;
  courseId: string;
}

interface UpcomingAssignment {
  id: string;
  title: string;
  dueDate: Date;
  courseName: string;
  courseId: string;
  urgency: "urgent" | "upcoming" | "future";
}

const StudentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [stats, setStats] = useState<DashboardStats>({
    enrolledCourses: 0,
    assignmentsDue: 0,
    attendanceRate: 0,
    upcomingClasses: 0,
  });
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<UpcomingAssignment[]>([]);
  const [newActivityCount, setNewActivityCount] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setNewActivityCount(0);

      // Fetch enrolled courses count
      const { count: enrolledCount } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("student_id", user.id)
        .eq("status", "active");

      // Fetch assignments due (no submission yet)
      const { data: enrolledCourses } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id)
        .eq("status", "active");

      const courseIds = enrolledCourses?.map((e) => e.course_id) || [];

      let assignmentsDueCount = 0;
      if (courseIds.length > 0) {
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id")
          .in("course_id", courseIds)
          .gte("due_date", new Date().toISOString());

        const assignmentIds = assignments?.map((a) => a.id) || [];

        if (assignmentIds.length > 0) {
          const { data: submissions } = await supabase
            .from("submissions")
            .select("assignment_id")
            .eq("student_id", user.id)
            .in("assignment_id", assignmentIds);

          const submittedIds = submissions?.map((s) => s.assignment_id) || [];
          assignmentsDueCount = assignmentIds.filter((id) => !submittedIds.includes(id)).length;
        }
      }

      // Fetch attendance rate
      const { data: attendanceRecords } = await supabase
        .from("attendance_records")
        .select("status")
        .eq("student_id", user.id);

      const attendanceRate =
        attendanceRecords && attendanceRecords.length > 0
          ? Math.round(
              (attendanceRecords.filter((r) => r.status === "present").length /
                attendanceRecords.length) *
                100
            )
          : 0;

      // Fetch today's sessions
      const today = new Date().toISOString().split("T")[0];
      const { data: todaySessions } = await supabase
        .from("attendance_sessions")
        .select("id, session_time, course_id, courses(title)")
        .in("course_id", courseIds)
        .eq("session_date", today)
        .gte("expires_at", new Date().toISOString());

      const upcomingClassesData =
        todaySessions?.map((session: any) => ({
          course: session.courses.title,
          time: session.session_time,
          room: "TBA",
          courseId: session.course_id,
          })) || [];

      // Fetch recent assignments as announcements
      const { data: recentAssignments } = await supabase
        .from("assignments")
        .select("title, created_at, courses(title)")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false })
        .limit(3);

      const announcementsData =
        recentAssignments?.map((assignment: any) => ({
          title: `New Assignment: ${assignment.title}`,
          time: new Date(assignment.created_at).toLocaleDateString(),
          course: assignment.courses?.title,
        })) || [];

      // Fetch upcoming assignments with color coding
      const { data: upcomingAssignmentsData } = await supabase
        .from("assignments")
        .select("id, title, due_date, course_id, courses(title)")
        .in("course_id", courseIds)
        .gte("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(5);

      const now = new Date();
      const assignmentsWithUrgency: UpcomingAssignment[] = (upcomingAssignmentsData || []).map((a: any) => {
        const dueDate = new Date(a.due_date);
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        let urgency: "urgent" | "upcoming" | "future" = "future";
        if (hoursUntilDue <= 24) {
          urgency = "urgent";
        } else if (hoursUntilDue <= 72) {
          urgency = "upcoming";
        }

        return {
          id: a.id,
          title: a.title,
          dueDate,
          courseName: a.courses?.title || "Unknown",
          courseId: a.course_id,
          urgency,
        };
      });

      setStats({
        enrolledCourses: enrolledCount || 0,
        assignmentsDue: assignmentsDueCount,
        attendanceRate,
        upcomingClasses: upcomingClassesData.length,
      });
      setUpcomingClasses(upcomingClassesData);
      setRecentAnnouncements(announcementsData);
      setUpcomingAssignments(assignmentsWithUrgency);
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
  }, [user]);

  // Subscribe to real-time updates for assignments and attendance sessions
  useRealtimeSubscription(
    [
      {
        table: "assignments",
        event: "INSERT",
        onData: () => {
          setNewActivityCount((prev) => prev + 1);
          toast({
            title: "New Assignment Posted",
            description: "A new assignment has been added to one of your courses.",
          });
        },
      },
      {
        table: "attendance_sessions",
        event: "INSERT",
        onData: () => {
          setNewActivityCount((prev) => prev + 1);
          toast({
            title: "Attendance Session Active",
            description: "An attendance session is now open!",
          });
        },
      },
    ],
    !!user
  );

  // Fetch data when user is available
  useEffect(() => {
    if (user) {
      fetchUserName();
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  const fetchUserName = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();
    
    if (data) setUserName(data.full_name);
  };

  // Show loading state while fetching initial data
  if (authLoading) {
    return null;
  }

  const quickStats = [
    { label: "Courses Enrolled", value: stats.enrolledCourses.toString(), icon: BookOpen, color: "text-primary" },
    { label: "Assignments Due", value: stats.assignmentsDue.toString(), icon: FileText, color: "text-destructive" },
    { label: "Attendance", value: `${stats.attendanceRate}%`, icon: TrendingUp, color: "text-primary" },
    { label: "Upcoming Classes", value: stats.upcomingClasses.toString(), icon: Clock, color: "text-accent-foreground" },
  ];

  return (
    <DashboardLayout role="student">
      <SEOHead 
        title="Student Dashboard" 
        description="View your enrolled courses, assignments, attendance, and upcoming classes."
      />
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome Back{userName ? `, ${userName.split(' ')[0]}` : ''}!</h1>
            <p className="text-muted-foreground">Here's what's happening with your courses today.</p>
          </div>
          {newActivityCount > 0 && (
            <Button onClick={fetchDashboardData} variant="outline" className="gap-2">
              <Bell className="h-4 w-4" />
              {newActivityCount} New Update{newActivityCount > 1 ? 's' : ''}
            </Button>
          )}
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

        {/* Upcoming Assignments with Color Coding */}
        {upcomingAssignments.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Upcoming Assignments
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/courses")}>View All</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className={`p-4 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                    assignment.urgency === "urgent"
                      ? "bg-destructive/10 border-l-destructive"
                      : assignment.urgency === "upcoming"
                      ? "bg-yellow-500/10 border-l-yellow-500"
                      : "bg-primary/10 border-l-primary"
                  }`}
                  onClick={() => navigate(`/courses/${assignment.courseId}`)}
                >
                  <h3 className="font-medium text-sm truncate">{assignment.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{assignment.courseName}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className={`w-3 h-3 ${
                      assignment.urgency === "urgent"
                        ? "text-destructive"
                        : assignment.urgency === "upcoming"
                        ? "text-yellow-600"
                        : "text-primary"
                    }`} />
                    <span className={`text-xs font-medium ${
                      assignment.urgency === "urgent"
                        ? "text-destructive"
                        : assignment.urgency === "upcoming"
                        ? "text-yellow-600"
                        : "text-primary"
                    }`}>
                      {assignment.urgency === "urgent"
                        ? "Due in < 24h"
                        : assignment.urgency === "upcoming"
                        ? "Due in 1-3 days"
                        : new Date(assignment.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Classes */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Today's Schedule
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/attendance")}>View All</Button>
            </div>
            <div className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : upcomingClasses.length > 0 ? (
                upcomingClasses.map((cls, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold">{cls.course}</h3>
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                      <span>{cls.time}</span>
                      <span>{cls.room}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No classes scheduled for today</p>
              )}
            </div>
          </Card>

          {/* Recent Announcements */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Announcements
              </h2>
            </div>
            <div className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : recentAnnouncements.length > 0 ? (
                recentAnnouncements.map((announcement, index) => (
                  <div key={index} className="pb-4 border-b border-border last:border-0">
                    <h3 className="font-medium">{announcement.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{announcement.time}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent announcements</p>
              )}
            </div>
          </Card>
        </div>

        {/* AI Mentor Quick Access */}
        <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:justify-between text-center lg:text-left">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-2">Need Help with Your Studies?</h2>
              <p className="text-sm md:text-base text-muted-foreground">Ask our AI Mentor anything - from concepts to exam preparation</p>
            </div>
            <Button size="lg" onClick={() => navigate("/ai-mentor")} className="w-full lg:w-auto">
              <MessageSquare className="w-5 h-5 mr-2" />
              Chat with AI Mentor
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
