import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle, XCircle, Clock, Check, X, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { exportToCSV, formatDateForCSV } from "@/lib/csvExport";

interface AttendanceSession {
  id: string;
  session_date: string;
  session_time: string;
  course_id: string;
  courses: {
    code: string;
    title: string;
  };
}

interface AttendanceRecord {
  id: string;
  checked_in_at: string;
  status: string;
  reason: string | null;
  profiles: {
    full_name: string;
    email: string;
  };
}

const AttendanceAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (user && id) {
      fetchSessionDetails();
      fetchAttendanceRecords();
    }
  }, [user, id]);

  const fetchSessionDetails = async () => {
    const { data: sessionData, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("*, courses(code, title)")
      .eq("id", id)
      .single();

    if (sessionError) {
      toast({
        title: "Error",
        description: "Failed to load session details",
        variant: "destructive"
      });
      navigate("/attendance");
      return;
    }

    setSession(sessionData);

    // Get enrolled students count
    const { count } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("course_id", sessionData.course_id)
      .eq("status", "active");

    setEnrolledCount(count || 0);
    setLoading(false);
  };

  const fetchAttendanceRecords = async () => {
    const { data } = await supabase
      .from("attendance_records")
      .select("*, profiles!student_id(full_name, email)")
      .eq("session_id", id)
      .order("checked_in_at", { ascending: false });

    setRecords(data || []);
  };

  const handleExportAttendance = () => {
    if (records.length === 0) {
      toast({
        title: "No Data",
        description: "No attendance records to export.",
        variant: "destructive",
      });
      return;
    }

    const exportData = records.map(record => ({
      student_name: record.profiles.full_name,
      email: record.profiles.email,
      status: record.status,
      reason: record.reason || "",
      check_in_time: format(new Date(record.checked_in_at), "yyyy-MM-dd HH:mm:ss"),
    }));

    exportToCSV(exportData, `attendance_${session?.courses.code}_${session?.session_date}`, [
      { key: "student_name", header: "Student Name" },
      { key: "email", header: "Email" },
      { key: "status", header: "Status" },
      { key: "reason", header: "Reason" },
      { key: "check_in_time", header: "Check-in Time" },
    ]);

    toast({
      title: "Exported",
      description: "Attendance records exported successfully.",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <Check className="h-4 w-4 text-green-500" />;
      case "absent":
        return <X className="h-4 w-4 text-destructive" />;
      case "late":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "excused":
        return <UserCheck className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "present":
        return "default";
      case "absent":
        return "destructive";
      case "late":
        return "secondary";
      case "excused":
        return "outline";
      default:
        return "default";
    }
  };

  if (loading || !session) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const presentCount = records.filter(r => r.status === "present" || r.status === "late").length;
  const absentCount = records.filter(r => r.status === "absent").length;
  const lateCount = records.filter(r => r.status === "late").length;
  const excusedCount = records.filter(r => r.status === "excused").length;
  const notRecordedCount = enrolledCount - records.length;
  const attendanceRate = enrolledCount > 0 ? ((presentCount / enrolledCount) * 100).toFixed(1) : 0;

  const chartData = [
    { name: "Present", value: presentCount - lateCount, color: "hsl(var(--chart-1))" },
    { name: "Late", value: lateCount, color: "hsl(var(--chart-3))" },
    { name: "Excused", value: excusedCount, color: "hsl(var(--chart-4))" },
    { name: "Absent", value: absentCount, color: "hsl(var(--chart-2))" },
    { name: "Not Recorded", value: notRecordedCount, color: "hsl(var(--chart-5))" },
  ].filter(d => d.value > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/attendance")}>
            ← Back to Attendance
          </Button>
          <Button variant="outline" onClick={handleExportAttendance}>
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{session.courses.code} - {session.courses.title}</CardTitle>
            <CardDescription>
              {format(new Date(`${session.session_date}T${session.session_time}`), "MMMM d, yyyy h:mm a")}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrolled</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrolledCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{absentCount + notRecordedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rate</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendanceRate}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Distribution</CardTitle>
            <CardDescription>Visual breakdown of attendance by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>Individual student attendance for this session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{record.profiles.full_name}</p>
                    <p className="text-sm text-muted-foreground">{record.profiles.email}</p>
                    {record.reason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reason: {record.reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(record.status)}
                      <Badge variant={getStatusBadgeVariant(record.status)}>
                        {record.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(record.checked_in_at), "h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
              {records.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No attendance records yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AttendanceAnalytics;