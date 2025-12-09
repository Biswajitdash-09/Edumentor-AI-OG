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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Users,
  BookOpen,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Brain,
  Loader2,
  Sparkles
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
import {
  exportStudentReportPDF,
  exportStudentReportExcel,
  exportAttendancePDF,
  exportAttendanceExcel,
} from "@/lib/reportExport";

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
  // AI prediction fields
  riskScore?: number;
  primaryRiskFactors?: string[];
  recommendations?: string[];
  predictedOutcome?: string;
}

interface AIPrediction {
  predictions: Array<{
    studentId: string;
    riskLevel: "high" | "medium" | "low";
    riskScore: number;
    primaryRiskFactors: string[];
    recommendations: string[];
    predictedOutcome: string;
  }>;
  classSummary?: {
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    topConcerns: string[];
    suggestedClassActions: string[];
  };
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
  const [aiPredictions, setAiPredictions] = useState<AIPrediction | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AtRiskStudent | null>(null);
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

  // Run AI-powered at-risk prediction
  const runAIPrediction = async () => {
    if (atRiskStudents.length === 0) {
      toast({
        title: "No Students to Analyze",
        description: "There are no at-risk students to analyze.",
      });
      return;
    }

    setLoadingAI(true);
    try {
      const studentsData = atRiskStudents.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        attendanceRate: s.attendanceRate,
        avgGrade: s.avgGrade,
        submissionRate: 75, // Default, can be enhanced
        recentTrend: s.avgGrade < 60 ? "declining" : "stable",
        missedClasses: Math.round((100 - s.attendanceRate) / 10),
        lateSubmissions: s.avgGrade < 70 ? 3 : 1,
      }));

      const courseName = selectedCourse === "all" 
        ? "All Courses" 
        : courses.find(c => c.id === selectedCourse)?.title || "Course";

      const { data, error } = await supabase.functions.invoke("predict-at-risk", {
        body: { students: studentsData, courseContext: courseName },
      });

      if (error) throw error;

      setAiPredictions(data);

      // Merge AI predictions with at-risk students
      if (data?.predictions) {
        const updatedStudents = atRiskStudents.map(student => {
          const prediction = data.predictions.find((p: any) => p.studentId === student.id);
          if (prediction) {
            return {
              ...student,
              riskLevel: prediction.riskLevel,
              riskScore: prediction.riskScore,
              primaryRiskFactors: prediction.primaryRiskFactors,
              recommendations: prediction.recommendations,
              predictedOutcome: prediction.predictedOutcome,
            };
          }
          return student;
        });
        setAtRiskStudents(updatedStudents);
      }

      toast({
        title: "AI Analysis Complete",
        description: "Predictions have been generated for at-risk students.",
      });
    } catch (error: any) {
      console.error("AI Prediction error:", error);
      toast({
        title: "AI Analysis Failed",
        description: error.message || "Could not generate predictions.",
        variant: "destructive",
      });
    } finally {
      setLoadingAI(false);
    }
  };

  // Export handlers
  const handleExportPDF = () => {
    const courseName = selectedCourse === "all" 
      ? "All Courses" 
      : courses.find(c => c.id === selectedCourse)?.title || "Course";
    
    const students = atRiskStudents.map(s => ({
      name: s.name,
      email: s.email,
      attendanceRate: s.attendanceRate,
      avgGrade: s.avgGrade,
      riskLevel: s.riskLevel,
    }));
    
    exportStudentReportPDF(students, courseName, { start: startDate, end: endDate });
    toast({ title: "PDF Downloaded", description: "Report has been saved." });
  };

  const handleExportExcel = () => {
    const courseName = selectedCourse === "all" 
      ? "All Courses" 
      : courses.find(c => c.id === selectedCourse)?.title || "Course";
    
    const students = atRiskStudents.map(s => ({
      name: s.name,
      email: s.email,
      attendanceRate: s.attendanceRate,
      avgGrade: s.avgGrade,
      riskLevel: s.riskLevel,
    }));
    
    exportStudentReportExcel(students, courseName, { start: startDate, end: endDate });
    toast({ title: "Excel Downloaded", description: "Report has been saved." });
  };

  if (authLoading || !user) {
    return null;
  }

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <DashboardLayout role="faculty">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Comprehensive insights into student performance and attendance
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={runAIPrediction}
              disabled={loadingAI || atRiskStudents.length === 0}
              className="gap-2"
            >
              {loadingAI ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI Prediction
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        {/* AI Summary Card */}
        {aiPredictions?.classSummary && (
          <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI-Powered Class Insights
              </CardTitle>
              <CardDescription>Predictive analysis based on student performance patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Risk Distribution</h4>
                  <div className="flex gap-4">
                    <Badge variant="destructive" className="px-3 py-1">
                      {aiPredictions.classSummary.highRiskCount} High Risk
                    </Badge>
                    <Badge variant="secondary" className="px-3 py-1">
                      {aiPredictions.classSummary.mediumRiskCount} Medium Risk
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1">
                      {aiPredictions.classSummary.lowRiskCount} Low Risk
                    </Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Top Concerns</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {aiPredictions.classSummary.topConcerns.map((concern, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 mt-1 text-destructive shrink-0" />
                        {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {aiPredictions.classSummary.suggestedClassActions.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold mb-2">Suggested Actions</h4>
                  <div className="grid md:grid-cols-2 gap-2">
                    {aiPredictions.classSummary.suggestedClassActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 bg-background rounded">
                        <Sparkles className="w-3 h-3 mt-1 text-primary shrink-0" />
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* At-Risk Students */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              At-Risk Students
              {aiPredictions && (
                <Badge variant="outline" className="ml-2 font-normal">
                  <Brain className="w-3 h-3 mr-1" />
                  AI Enhanced
                </Badge>
              )}
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
                    className={`p-4 border rounded-lg transition-all cursor-pointer hover:border-primary/50 ${
                      selectedStudent?.id === student.id ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                  >
                    <div className="flex items-center justify-between">
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
                        {student.riskScore !== undefined && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Risk Score</p>
                            <p className={`font-semibold ${student.riskScore > 70 ? "text-destructive" : student.riskScore > 40 ? "text-yellow-600" : ""}`}>
                              {student.riskScore}
                            </p>
                          </div>
                        )}
                        <Badge variant={student.riskLevel === "high" ? "destructive" : "secondary"}>
                          {student.riskLevel} risk
                        </Badge>
                      </div>
                    </div>
                    
                    {/* AI Prediction Details */}
                    {selectedStudent?.id === student.id && student.primaryRiskFactors && (
                      <div className="mt-4 pt-4 border-t space-y-3 animate-in slide-in-from-top-2">
                        <div>
                          <h5 className="text-sm font-semibold mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-destructive" />
                            Risk Factors
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {student.primaryRiskFactors.map((factor, i) => (
                              <Badge key={i} variant="outline" className="text-destructive border-destructive/50">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {student.recommendations && (
                          <div>
                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-primary" />
                              Recommended Actions
                            </h5>
                            <ul className="text-sm space-y-1">
                              {student.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary">•</span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {student.predictedOutcome && (
                          <div className="p-3 bg-muted rounded-lg">
                            <h5 className="text-sm font-semibold mb-1">Predicted Outcome</h5>
                            <p className="text-sm text-muted-foreground">{student.predictedOutcome}</p>
                          </div>
                        )}
                      </div>
                    )}
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