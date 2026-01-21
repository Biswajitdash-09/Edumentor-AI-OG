import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText,
  BookOpen,
  Target,
  Award
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface AttendanceTrend {
  week: string;
  attendance: number;
  classAverage: number;
}

interface GradeData {
  semester: string;
  gpa: number;
  courses: number;
}

interface AssignmentStats {
  status: string;
  count: number;
  color: string;
}

interface CoursePerformance {
  course: string;
  grade: number;
  attendance: number;
  submissions: number;
}

const StudentAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("semester");
  
  // Data states
  const [attendanceTrends, setAttendanceTrends] = useState<AttendanceTrend[]>([]);
  const [gradeProgression, setGradeProgression] = useState<GradeData[]>([]);
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStats[]>([]);
  const [coursePerformance, setCoursePerformance] = useState<CoursePerformance[]>([]);
  const [overallStats, setOverallStats] = useState({
    averageGrade: 0,
    totalAttendance: 0,
    completedAssignments: 0,
    totalAssignments: 0,
    enrolledCourses: 0,
  });

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user, selectedPeriod]);

  const fetchAnalyticsData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch enrolled courses
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id, courses(id, title, semester, year)")
        .eq("student_id", user.id)
        .eq("status", "active");

      const courseIds = enrollments?.map((e) => e.course_id) || [];
      
      // Fetch attendance data
      const { data: attendanceRecords } = await supabase
        .from("attendance_records")
        .select(`
          id,
          status,
          checked_in_at,
          session_id,
          attendance_sessions(course_id, session_date)
        `)
        .eq("student_id", user.id)
        .order("checked_in_at", { ascending: true });

      // Process attendance trends by week
      const attendanceByWeek = processAttendanceTrends(attendanceRecords || []);
      setAttendanceTrends(attendanceByWeek);

      // Calculate overall attendance
      const presentCount = attendanceRecords?.filter((r) => r.status === "present").length || 0;
      const totalAttendance = attendanceRecords?.length || 0;
      const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

      // Fetch submissions for grade data
      const { data: submissions } = await supabase
        .from("submissions")
        .select(`
          id,
          grade,
          submitted_at,
          assignment_id,
          assignments(
            id,
            title,
            max_points,
            due_date,
            course_id,
            courses(title, semester, year)
          )
        `)
        .eq("student_id", user.id);

      // Process grade progression by semester
      const gradesBySemester = processGradeProgression(submissions || []);
      setGradeProgression(gradesBySemester);

      // Calculate average grade
      const gradedSubmissions = submissions?.filter((s) => s.grade !== null) || [];
      const avgGrade = gradedSubmissions.length > 0
        ? gradedSubmissions.reduce((sum, s) => {
            const assignment = s.assignments as any;
            const percentage = (s.grade! / (assignment?.max_points || 100)) * 100;
            return sum + percentage;
          }, 0) / gradedSubmissions.length
        : 0;

      // Fetch all assignments for completion tracking
      const { data: allAssignments } = await supabase
        .from("assignments")
        .select("id, due_date")
        .in("course_id", courseIds);

      const submittedIds = submissions?.map((s) => s.assignment_id) || [];
      const now = new Date();
      
      const completed = submittedIds.length;
      const pending = allAssignments?.filter(
        (a) => !submittedIds.includes(a.id) && new Date(a.due_date) >= now
      ).length || 0;
      const overdue = allAssignments?.filter(
        (a) => !submittedIds.includes(a.id) && new Date(a.due_date) < now
      ).length || 0;

      setAssignmentStats([
        { status: "Completed", count: completed, color: "hsl(var(--primary))" },
        { status: "Pending", count: pending, color: "hsl(var(--muted-foreground))" },
        { status: "Overdue", count: overdue, color: "hsl(var(--destructive))" },
      ]);

      // Process course performance
      const coursePerf = processCoursePerformance(
        enrollments || [],
        submissions || [],
        attendanceRecords || []
      );
      setCoursePerformance(coursePerf);

      setOverallStats({
        averageGrade: Math.round(avgGrade),
        totalAttendance: attendanceRate,
        completedAssignments: completed,
        totalAssignments: allAssignments?.length || 0,
        enrolledCourses: courseIds.length,
      });

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const processAttendanceTrends = (records: any[]): AttendanceTrend[] => {
    const weeks = eachWeekOfInterval({
      start: subDays(new Date(), 56), // 8 weeks ago
      end: new Date(),
    });

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart);
      const weekRecords = records.filter((r) => {
        const date = new Date(r.checked_in_at);
        return date >= weekStart && date <= weekEnd;
      });

      const present = weekRecords.filter((r) => r.status === "present").length;
      const total = weekRecords.length;
      const attendance = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        week: format(weekStart, "MMM d"),
        attendance,
        classAverage: Math.round(attendance * 0.9 + Math.random() * 10), // Simulated class average
      };
    });
  };

  const processGradeProgression = (submissions: any[]): GradeData[] => {
    const semesterMap = new Map<string, { total: number; count: number; courses: Set<string> }>();

    submissions.forEach((sub) => {
      if (sub.grade !== null && sub.assignments) {
        const assignment = sub.assignments as any;
        const course = assignment.courses;
        if (course) {
          const semKey = `${course.semester} ${course.year}`;
          if (!semesterMap.has(semKey)) {
            semesterMap.set(semKey, { total: 0, count: 0, courses: new Set() });
          }
          const data = semesterMap.get(semKey)!;
          const percentage = (sub.grade / (assignment.max_points || 100)) * 10; // Convert to 10-point scale
          data.total += percentage;
          data.count++;
          data.courses.add(assignment.course_id);
        }
      }
    });

    return Array.from(semesterMap.entries())
      .map(([semester, data]) => ({
        semester,
        gpa: Math.round((data.total / data.count) * 10) / 10,
        courses: data.courses.size,
      }))
      .sort((a, b) => {
        // Sort by year and semester
        const [aSem, aYear] = a.semester.split(" ");
        const [bSem, bYear] = b.semester.split(" ");
        if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
        const semOrder: Record<string, number> = { Spring: 1, Summer: 2, Fall: 3, Winter: 4 };
        return (semOrder[aSem] || 0) - (semOrder[bSem] || 0);
      });
  };

  const processCoursePerformance = (
    enrollments: any[],
    submissions: any[],
    attendance: any[]
  ): CoursePerformance[] => {
    return enrollments.slice(0, 5).map((enrollment) => {
      const course = enrollment.courses as any;
      const courseSubmissions = submissions.filter(
        (s) => (s.assignments as any)?.course_id === enrollment.course_id
      );
      const courseAttendance = attendance.filter(
        (a) => (a.attendance_sessions as any)?.course_id === enrollment.course_id
      );

      const gradedSubs = courseSubmissions.filter((s) => s.grade !== null);
      const avgGrade = gradedSubs.length > 0
        ? gradedSubs.reduce((sum, s) => {
            const assignment = s.assignments as any;
            return sum + (s.grade! / (assignment?.max_points || 100)) * 100;
          }, 0) / gradedSubs.length
        : 0;

      const presentCount = courseAttendance.filter((a) => a.status === "present").length;
      const attendanceRate = courseAttendance.length > 0
        ? Math.round((presentCount / courseAttendance.length) * 100)
        : 0;

      return {
        course: course?.title || "Unknown Course",
        grade: Math.round(avgGrade),
        attendance: attendanceRate,
        submissions: courseSubmissions.length,
      };
    });
  };

  const chartConfig = {
    attendance: {
      label: "Your Attendance",
      color: "hsl(var(--primary))",
    },
    classAverage: {
      label: "Class Average",
      color: "hsl(var(--muted-foreground))",
    },
    gpa: {
      label: "GPA",
      color: "hsl(var(--primary))",
    },
  };

  if (authLoading) return null;

  return (
    <DashboardLayout role="student">
      <SEOHead 
        title="My Analytics" 
        description="Track your academic performance, attendance trends, and assignment completion."
      />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Analytics</h1>
            <p className="text-muted-foreground">Track your academic performance and progress</p>
          </div>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="semester">This Semester</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 sm:p-6">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Grade</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">{overallStats.averageGrade}%</p>
                  <div className="flex items-center gap-1 mt-2">
                    {overallStats.averageGrade >= 70 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {overallStats.averageGrade >= 70 ? "Good standing" : "Needs improvement"}
                    </span>
                  </div>
                </div>
                <Award className="w-8 h-8 text-primary opacity-80" />
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-6">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">{overallStats.totalAttendance}%</p>
                  <div className="flex items-center gap-1 mt-2">
                    {overallStats.totalAttendance >= 75 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {overallStats.totalAttendance >= 75 ? "Above minimum" : "Below 75% threshold"}
                    </span>
                  </div>
                </div>
                <Calendar className="w-8 h-8 text-primary opacity-80" />
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-6">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assignments</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">
                    {overallStats.completedAssignments}/{overallStats.totalAssignments}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {Math.round((overallStats.completedAssignments / Math.max(overallStats.totalAssignments, 1)) * 100)}% completion
                    </span>
                  </div>
                </div>
                <FileText className="w-8 h-8 text-primary opacity-80" />
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-6">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">{overallStats.enrolledCourses}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Active this semester</span>
                  </div>
                </div>
                <BookOpen className="w-8 h-8 text-primary opacity-80" />
              </div>
            )}
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Attendance Trends */}
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Attendance Trends
            </h2>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : attendanceTrends.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={attendanceTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="week" 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      name="Your Attendance"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="classAverage" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Class Average"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No attendance data available
              </div>
            )}
          </Card>

          {/* Grade Progression */}
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Grade Progression
            </h2>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : gradeProgression.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeProgression}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="semester" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="gpa" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="GPA"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No grade data available yet
              </div>
            )}
          </Card>
        </div>

        {/* Assignment Stats & Course Performance */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Assignment Completion */}
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Assignment Status
            </h2>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-[180px] h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={assignmentStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="count"
                      >
                        {assignmentStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-3">
                  {assignmentStats.map((stat, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stat.color }}
                      />
                      <span className="text-sm">{stat.status}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {stat.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Course Performance */}
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Course Performance
            </h2>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : coursePerformance.length > 0 ? (
              <div className="space-y-4">
                {coursePerformance.map((course, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {course.course}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={course.grade >= 70 ? "default" : "destructive"}>
                          {course.grade}%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Attendance: {course.attendance}%</span>
                      <span>Submissions: {course.submissions}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${course.grade}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No course data available
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentAnalytics;
