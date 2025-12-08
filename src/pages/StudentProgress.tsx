import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Calendar, Award, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface StudentData {
  full_name: string;
  email: string;
}

interface Submission {
  id: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  assignments: {
    title: string;
    max_points: number;
  };
}

interface AttendanceRecord {
  id: string;
  checked_in_at: string;
  status: string;
  attendance_sessions: {
    session_date: string;
    session_time: string;
  };
}

const StudentProgress = () => {
  const { courseId, studentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [student, setStudent] = useState<StudentData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseId && studentId) {
      fetchStudentData();
      fetchSubmissions();
      fetchAttendance();
      fetchNote();
    }
  }, [courseId, studentId]);

  const fetchStudentData = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", studentId)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load student data",
        variant: "destructive"
      });
    } else {
      setStudent(data);
    }
    setLoading(false);
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from("submissions")
      .select(`
        id,
        submitted_at,
        grade,
        feedback,
        assignments!inner(title, max_points, course_id)
      `)
      .eq("student_id", studentId)
      .eq("assignments.course_id", courseId)
      .order("submitted_at", { ascending: false });

    setSubmissions(data || []);
  };

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from("attendance_records")
      .select(`
        id,
        checked_in_at,
        status,
        attendance_sessions!inner(session_date, session_time, course_id)
      `)
      .eq("student_id", studentId)
      .eq("attendance_sessions.course_id", courseId)
      .order("checked_in_at", { ascending: false });

    setAttendanceRecords(data || []);
  };

  const fetchNote = async () => {
    const { data } = await supabase
      .from("student_notes")
      .select("note")
      .eq("course_id", courseId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (data) {
      setNote(data.note);
    }
  };

  const handleSaveNote = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("student_notes")
      .upsert({
        faculty_id: user?.id,
        student_id: studentId,
        course_id: courseId,
        note: note
      }, {
        onConflict: "faculty_id,student_id,course_id"
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Note saved successfully"
      });
    }
  };

  if (loading || !student) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const avgGrade = submissions.length > 0
    ? submissions.filter(s => s.grade !== null).reduce((acc, s) => acc + (s.grade || 0), 0) / submissions.filter(s => s.grade !== null).length
    : 0;

  const attendanceRate = attendanceRecords.length > 0 ? 100 : 0; // Simplified - would need total sessions

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate(`/courses/${courseId}`)}>
            ← Back to Course
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <User className="w-6 h-6" />
              {student.full_name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {student.email}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Average Grade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgGrade.toFixed(1)}%</div>
              <p className="text-sm text-muted-foreground">
                {submissions.filter(s => s.grade !== null).length} graded assignments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{attendanceRecords.length}</div>
              <p className="text-sm text-muted-foreground">sessions attended</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Faculty Notes</CardTitle>
            <CardDescription>Private notes about this student</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="note">Notes</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add notes about this student's progress..."
                rows={4}
              />
            </div>
            <Button onClick={handleSaveNote}>Save Note</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submissions History</CardTitle>
            <CardDescription>All assignment submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {submissions.map((submission) => (
                <div key={submission.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{submission.assignments.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Submitted {format(new Date(submission.submitted_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    {submission.grade !== null ? (
                      <div className="text-lg font-bold">
                        {submission.grade}/{submission.assignments.max_points}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Not graded</div>
                    )}
                  </div>
                </div>
              ))}
              {submissions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No submissions yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>Class attendance records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {attendanceRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {format(new Date(`${record.attendance_sessions.session_date}T${record.attendance_sessions.session_time}`), "MMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(record.checked_in_at), "h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.status === "present" ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="capitalize">{record.status}</span>
                  </div>
                </div>
              ))}
              {attendanceRecords.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
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

export default StudentProgress;