import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import PlagiarismChecker from "@/components/PlagiarismChecker";
import { BulkGradingDialog } from "@/components/BulkGradingDialog";
import { FileText, Download, Award, Users } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Submission {
  id: string;
  student_id: string;
  content: string;
  file_path: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface Assignment {
  id: string;
  title: string;
  max_points: number;
  courses: {
    title: string;
    code: string;
  };
}

const GradeSubmissions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingSubmission, setGradingSubmission] = useState<string | null>(null);
  const [gradeData, setGradeData] = useState({ grade: 0, feedback: "" });
  const [bulkGradingOpen, setBulkGradingOpen] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchAssignment();
      fetchSubmissions();
    }
  }, [user, id]);

  const fetchAssignment = async () => {
    const { data, error } = await supabase
      .from("assignments")
      .select("*, courses(title, code)")
      .eq("id", id)
      .single();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to load assignment",
        variant: "destructive"
      });
      navigate("/courses");
    } else {
      setAssignment(data);
    }
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from("submissions")
      .select("id, student_id, content, file_path, submitted_at, grade, feedback, profiles!submissions_student_id_fkey(full_name, email)")
      .eq("assignment_id", id)
      .order("submitted_at", { ascending: false });

    setSubmissions(data || []);
    setLoading(false);
  };

  const handleGrade = async (submissionId: string, studentId: string) => {
    if (gradeData.grade < 0 || gradeData.grade > (assignment?.max_points || 100)) {
      toast({
        title: "Error",
        description: `Grade must be between 0 and ${assignment?.max_points}`,
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("submissions")
      .update({
        grade: gradeData.grade,
        feedback: gradeData.feedback,
        graded_by: user?.id,
        graded_at: new Date().toISOString()
      })
      .eq("id", submissionId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Submission graded successfully"
      });

      // Send email notification to student
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user?.id)
          .single();

        await supabase.functions.invoke("send-grade-notification", {
          body: {
            studentId,
            assignmentId: id,
            grade: gradeData.grade,
            maxPoints: assignment?.max_points || 100,
            feedback: gradeData.feedback || null,
            facultyName: profile?.full_name || "Instructor"
          }
        });
      } catch (emailError) {
        console.error("Failed to send grade notification:", emailError);
        toast({
          title: "Note",
          description: "Grade saved but email notification failed",
        });
      }

      setGradingSubmission(null);
      setGradeData({ grade: 0, feedback: "" });
      fetchSubmissions();
    }
  };

  const downloadFile = async (filePath: string, studentName: string) => {
    const { data, error } = await supabase.storage
      .from("assignment-submissions")
      .download(filePath);

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive"
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${studentName}_submission`;
    a.click();
  };

  const ungradedSubmissions = submissions.filter(s => s.grade === null);
  const gradedSubmissions = submissions.filter(s => s.grade !== null);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading submissions...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{assignment.title}</CardTitle>
            <CardDescription>
              {assignment.courses.code} - {assignment.courses.title} • Max Points: {assignment.max_points}
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="ungraded">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="ungraded">
                Ungraded ({ungradedSubmissions.length})
              </TabsTrigger>
              <TabsTrigger value="graded">
                Graded ({gradedSubmissions.length})
              </TabsTrigger>
              <TabsTrigger value="plagiarism">
                Plagiarism Check
              </TabsTrigger>
            </TabsList>
            {ungradedSubmissions.length > 1 && (
              <Button onClick={() => setBulkGradingOpen(true)} variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Bulk Grade ({ungradedSubmissions.length})
              </Button>
            )}
          </div>

          <BulkGradingDialog
            open={bulkGradingOpen}
            onOpenChange={setBulkGradingOpen}
            submissions={ungradedSubmissions}
            maxPoints={assignment.max_points}
            assignmentId={id || ""}
            onSuccess={fetchSubmissions}
          />

          <TabsContent value="ungraded" className="space-y-4">
            {ungradedSubmissions.map((submission) => (
              <Card key={submission.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{submission.profiles.full_name}</CardTitle>
                      <CardDescription>{submission.profiles.email}</CardDescription>
                      <p className="text-sm text-muted-foreground mt-2">
                        Submitted: {format(new Date(submission.submitted_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {submission.content && (
                    <div>
                      <Label>Submission Text</Label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded">{submission.content}</p>
                    </div>
                  )}
                  {submission.file_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(submission.file_path!, submission.profiles.full_name)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Attachment
                    </Button>
                  )}

                  {gradingSubmission === submission.id ? (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <Label htmlFor="grade">Grade (max {assignment.max_points})</Label>
                        <Input
                          id="grade"
                          type="number"
                          min="0"
                          max={assignment.max_points}
                          value={gradeData.grade}
                          onChange={(e) => setGradeData({ ...gradeData, grade: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="feedback">Feedback</Label>
                        <Textarea
                          id="feedback"
                          value={gradeData.feedback}
                          onChange={(e) => setGradeData({ ...gradeData, feedback: e.target.value })}
                          placeholder="Provide feedback..."
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleGrade(submission.id, submission.student_id)}>Submit Grade</Button>
                        <Button variant="outline" onClick={() => setGradingSubmission(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => {
                      setGradingSubmission(submission.id);
                      setGradeData({ grade: 0, feedback: "" });
                    }}>
                      <Award className="w-4 h-4 mr-2" />
                      Grade Submission
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {ungradedSubmissions.length === 0 && (
              <Card className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">All submissions have been graded</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="graded" className="space-y-4">
            {gradedSubmissions.map((submission) => (
              <Card key={submission.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{submission.profiles.full_name}</CardTitle>
                      <CardDescription>{submission.profiles.email}</CardDescription>
                      <p className="text-sm text-muted-foreground mt-2">
                        Submitted: {format(new Date(submission.submitted_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {submission.grade}/{assignment.max_points}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {((submission.grade! / assignment.max_points) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {submission.content && (
                    <div>
                      <Label>Submission Text</Label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded">{submission.content}</p>
                    </div>
                  )}
                  {submission.file_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(submission.file_path!, submission.profiles.full_name)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Attachment
                    </Button>
                  )}
                  {submission.feedback && (
                    <div>
                      <Label>Feedback</Label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded">{submission.feedback}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {gradedSubmissions.length === 0 && (
              <Card className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No graded submissions yet</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="plagiarism" className="space-y-4">
            <PlagiarismChecker
              assignmentId={id || ""}
              submissions={submissions.map(s => ({
                id: s.id,
                content: s.content,
                student_name: s.profiles.full_name
              }))}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default GradeSubmissions;
