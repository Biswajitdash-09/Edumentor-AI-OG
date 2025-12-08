import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Users,
  BookOpen,
  Calendar
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Course {
  id: string;
  code: string;
  title: string;
}

interface AttendanceTrend {
  date: string;
  attendance: number;
}

interface GradeDistribution {
  range: string;
  count: number;
}

interface AtRiskStudent {
  id: string;
  name: string;
  email: string;
  attendanceRate: number;
  avgGrade: number;
  riskLevel: "high" | "medium" | "low";
}

interface CourseMetric {
  courseId: string;
  courseName: string;
  avgAttendance: number;
  avgGrade: number;
  submissionRate: number;
}

const Analytics = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const [attendanceTrends, setAttendanceTrends] = useState<AttendanceTrend[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<GradeDistribution[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [courseMetrics, setCourseMetrics] = useState<CourseMetric[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalStudents: 0,
    avgAttendance: 0,
    avgGrade: 0,
    atRiskCount: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCourses();
    }
  }, [user]);

  useEffect(() => {
    if (user && courses.length > 0) {
      fetchAnalyticsData();
    }
  }, [user, courses, selectedCourse, startDate, endDate]);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from("courses")
      .select("id, code, title")
      .eq("faculty_id", user!.id)
      .eq("status", "active");

    setCourses(data || []);
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const courseIds = selectedCourse === "all" 
        ? courses.map(c => c.id) 
        : [selectedCourse];

      // Fetch attendance trends
      const { data: sessions } = await supabase
        .from("attendance_sessions")
        .select("id, session_date, course_id")
        .in("course_id", courseIds)
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date");

      const sessionIds = sessions?.map(s => s.id) || [];

      // Get attendance records
      const { data: records } = await supabase
        .from("attendance_records")
        .select("session_id, status")
        .in("session_id", sessionIds);

      // Calculate attendance trends by date
      const trendMap: Record<string, { present: number; total: number }> = {};
      sessions?.forEach(session => {
        const sessionRecords = records?.filter(r => r.session_id === session.id) || [];
        const presentCount = sessionRecords.filter(r => r.status === "present" || r.status === "late").length;
        
        if (!trendMap[session.session_date]) {
          trendMap[session.session_date] = { present: 0, total: 0 };
        }
        trendMap[session.session_date].present += presentCount;
        trendMap[session.session_date].total += sessionRecords.length || 1;
      });

      const trends = Object.entries(trendMap).map(([date, data]) => ({
        date: format(new Date(date), "MMM d"),
        attendance: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      }));
      setAttendanceTrends(trends);

      // Fetch grade distribution
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, max_points")
        .in("course_id", courseIds);

      const assignmentIds = assignments?.map(a => a.id) || [];

      const { data: submissions } = await supabase
        .from("submissions")
        .select("grade, assignment_id")
        .in("assignment_id", assignmentIds)
        .not("grade", "is", null);

      // Calculate grade distribution
      const gradeRanges = [
        { range: "A (90-100)", min: 90, max: 100, count: 0 },
        { range: "B (80-89)", min: 80, max: 89, count: 0 },
        { range: "C (70-79)", min: 70, max: 79, count: 0 },
        { range: "D (60-69)", min: 60, max: 69, count: 0 },
        { range: "F (0-59)", min: 0, max: 59, count: 0 },
      ];

      submissions?.forEach(sub => {
        const assignment = assignments?.find(a => a.id === sub.assignment_id);
        if (assignment && sub.grade !== null) {
          const percentage = (sub.grade / assignment.max_points) * 100;
          const range = gradeRanges.find(r => percentage >= r.min && percentage <= r.max);
          if (range) range.count++;
        }
      });

      setGradeDistribution(gradeRanges.map(r => ({ range: r.range, count: r.count })));

      // Fetch at-risk students
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          course_id,
          profiles!student_id(full_name, email)
        `)
        .in("course_id", courseIds)
        .eq("status", "active");

      const studentMap: Record<string, { 
        name: string; 
        email: string; 
        attendanceRecords: number;
        presentRecords: number;
        grades: number[];
      }> = {};

      enrollments?.forEach((e: any) => {
        if (!studentMap[e.student_id]) {
          studentMap[e.student_id] = {
            name: e.profiles?.full_name || "Unknown",
            email: e.profiles?.email || "",
            attendanceRecords: 0,
            presentRecords: 0,
            grades: [],
          };
        }
      });

      // Get attendance for each student
      const { data: studentRecords } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .in("session_id", sessionIds);

      studentRecords?.forEach(r => {
        if (studentMap[r.student_id]) {
          studentMap[r.student_id].attendanceRecords++;
          if (r.status === "present" || r.status === "late") {
            studentMap[r.student_id].presentRecords++;
          }
        }
      });

      // Get grades for each student
      const { data: studentSubmissions } = await supabase
        .from("submissions")
        .select("student_id, grade, assignment_id")
        .in("assignment_id", assignmentIds)
        .not("grade", "is", null);

      studentSubmissions?.forEach(s => {
        const assignment = assignments?.find(a => a.id === s.assignment_id);
        if (studentMap[s.student_id] && assignment && s.grade !== null) {
          const percentage = (s.grade / assignment.max_points) * 100;
          studentMap[s.student_id].grades.push(percentage);
        }
      });

      // Calculate at-risk students
      const atRisk: AtRiskStudent[] = [];
      Object.entries(studentMap).forEach(([id, data]) => {
        const attendanceRate = data.attendanceRecords > 0 
          ? Math.round((data.presentRecords / data.attendanceRecords) * 100) 
          : 100;
        const avgGrade = data.grades.length > 0 
          ? Math.round(data.grades.reduce((a, b) => a + b, 0) / data.grades.length)
          : 100;

        let riskLevel: "high" | "medium" | "low" = "low";
        if (attendanceRate < 60 || avgGrade < 60) {
          riskLevel = "high";
        } else if (attendanceRate < 75 || avgGrade < 70) {
          riskLevel = "medium";
        }

        if (riskLevel !== "low") {
          atRisk.push({
            id,
            name: data.name,
            email: data.email,
            attendanceRate,
            avgGrade,
            riskLevel,
          });
        }
      });

      atRisk.sort((a, b) => {
        if (a.riskLevel === "high" && b.riskLevel !== "high") return -1;
        if (a.riskLevel !== "high" && b.riskLevel === "high") return 1;
        return a.attendanceRate - b.attendanceRate;
      });

      setAtRiskStudents(atRisk.slice(0, 10));

      // Calculate course metrics
      const metrics: CourseMetric[] = [];
      for (const course of courses) {
        if (selectedCourse !== "all" && course.id !== selectedCourse) continue;

        const courseSessions = sessions?.filter(s => s.course_id === course.id) || [];
        const courseSessionIds = courseSessions.map(s => s.id);
        const courseRecords = records?.filter(r => courseSessionIds.includes(r.session_id)) || [];
        
        const courseAssignments = assignments?.filter(a => 
          courseIds.includes(course.id)
        ) || [];
        const courseAssignmentIds = courseAssignments.map(a => a.id);
        const courseSubmissions = submissions?.filter(s => 
          courseAssignmentIds.includes(s.assignment_id)
        ) || [];

        const avgAttendance = courseRecords.length > 0
          ? Math.round((courseRecords.filter(r => r.status === "present" || r.status === "late").length / courseRecords.length) * 100)
          : 0;

        const courseGrades = courseSubmissions.map(s => {
          const assignment = courseAssignments.find(a => a.id === s.assignment_id);
          return assignment && s.grade !== null ? (s.grade / assignment.max_points) * 100 : 0;
        }).filter(g => g > 0);

        const avgGrade = courseGrades.length > 0
          ? Math.round(courseGrades.reduce((a, b) => a + b, 0) / courseGrades.length)
          : 0;

        const courseEnrollments = enrollments?.filter(e => e.course_id === course.id) || [];
        const submissionRate = courseEnrollments.length > 0 && courseAssignments.length > 0
          ? Math.round((courseSubmissions.length / (courseEnrollments.length * courseAssignments.length)) * 100)
          : 0;

        metrics.push({
          courseId: course.id,
          courseName: `${course.code} - ${course.title}`,
          avgAttendance,
          avgGrade,
          submissionRate,
        });
      }

      setCourseMetrics(metrics);

      // Calculate overall stats
      const totalStudents = Object.keys(studentMap).length;
      const allAttendanceRates = Object.values(studentMap).map(s => 
        s.attendanceRecords > 0 ? (s.presentRecords / s.attendanceRecords) * 100 : 100
      );
      const avgAttendance = allAttendanceRates.length > 0
        ? Math.round(allAttendanceRates.reduce((a, b) => a + b, 0) / allAttendanceRates.length)
        : 0;

      const allGrades = Object.values(studentMap).flatMap(s => s.grades);
      const avgGrade = allGrades.length > 0
        ? Math.round(allGrades.reduce((a, b) => a + b, 0) / allGrades.length)
        : 0;

      setOverallStats({
        totalStudents,
        avgAttendance,
        avgGrade,
        atRiskCount: atRisk.length,
      });

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

  if (authLoading || !user) {
    return null;
  }

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <DashboardLayout role="faculty">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Comprehensive insights into student performance and attendance
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} - {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setStartDate(format(subDays(new Date(), 30), "yyyy-MM-dd"));
                setEndDate(format(new Date(), "yyyy-MM-dd"));
              }}
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStartDate(format(subDays(new Date(), 7), "yyyy-MM-dd"));
                setEndDate(format(new Date(), "yyyy-MM-dd"));
              }}
            >
              Last 7 Days
            </Button>
          </div>
        </Card>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            {loading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-3xl font-bold mt-2">{overallStats.totalStudents}</p>
                </div>
                <Users className="w-12 h-12 text-primary" />
              </div>
            )}
          </Card>
          <Card className="p-6">
            {loading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Attendance</p>
                  <p className="text-3xl font-bold mt-2">{overallStats.avgAttendance}%</p>
                </div>
                <Calendar className="w-12 h-12 text-primary" />
              </div>
            )}
          </Card>
          <Card className="p-6">
            {loading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Grade</p>
                  <p className="text-3xl font-bold mt-2">{overallStats.avgGrade}%</p>
                </div>
                <TrendingUp className="w-12 h-12 text-primary" />
              </div>
            )}
          </Card>
          <Card className="p-6">
            {loading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">At-Risk Students</p>
                  <p className="text-3xl font-bold mt-2 text-destructive">{overallStats.atRiskCount}</p>
                </div>
                <AlertTriangle className="w-12 h-12 text-destructive" />
              </div>
            )}
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Attendance Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Attendance Trends
              </CardTitle>
              <CardDescription>Daily attendance rate over time</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px]" />
              ) : attendanceTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={attendanceTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="attendance"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Attendance Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No attendance data for selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Grade Distribution
              </CardTitle>
              <CardDescription>Distribution of grades across assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px]" />
              ) : gradeDistribution.some(g => g.count > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={gradeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Students" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No graded submissions yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* At-Risk Students */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              At-Risk Students
            </CardTitle>
            <CardDescription>
              Students with attendance below 75% or average grade below 70%
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : atRiskStudents.length > 0 ? (
              <div className="space-y-3">
                {atRiskStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-muted-foreground">{student.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Attendance</p>
                        <p className={`font-semibold ${student.attendanceRate < 75 ? "text-destructive" : ""}`}>
                          {student.attendanceRate}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Avg Grade</p>
                        <p className={`font-semibold ${student.avgGrade < 70 ? "text-destructive" : ""}`}>
                          {student.avgGrade}%
                        </p>
                      </div>
                      <Badge variant={student.riskLevel === "high" ? "destructive" : "secondary"}>
                        {student.riskLevel} risk
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No at-risk students identified
              </div>
            )}
          </CardContent>
        </Card>

        {/* Course Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Course Performance Metrics
            </CardTitle>
            <CardDescription>Overview of performance across courses</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : courseMetrics.length > 0 ? (
              <div className="space-y-4">
                {courseMetrics.map((metric) => (
                  <div
                    key={metric.courseId}
                    className="p-4 border rounded-lg"
                  >
                    <h3 className="font-semibold mb-3">{metric.courseName}</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Attendance</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${metric.avgAttendance}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{metric.avgAttendance}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Grade</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${metric.avgGrade}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{metric.avgGrade}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Submission Rate</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${metric.submissionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{metric.submissionRate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No course data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;