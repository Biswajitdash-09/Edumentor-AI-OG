import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle, Calendar, Award, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import DocumentPreview from "@/components/DocumentPreview";
import { format } from "date-fns";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_points: number;
  file_path?: string | null;
  file_name?: string | null;
  courses: {
    title: string;
    code: string;
  };
}

interface Submission {
  id: string;
  content: string;
  file_path: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
}

const AssignmentSubmission = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    if (user && id) {
      fetchUserRole();
    }
  }, [user, id]);

  useEffect(() => {
    if (user && id && userRole) {
      fetchAssignment();
      if (userRole === "student") {
        fetchSubmission();
      }
    }
  }, [user, id, userRole]);

  const fetchUserRole = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user?.id)
      .single();
    
    if (data) setUserRole(data.role);
  };

  const fetchAssignment = async () => {
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, courses(title, code)")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Assignment fetch error:", error);
        toast({
          title: "Error",
          description: "Failed to load assignment. Please check if you have access.",
          variant: "destructive"
        });
        navigate("/courses");
      } else {
        setAssignment(data);
      }
    } catch (err) {
      console.error("Assignment fetch exception:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmission = async () => {
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", id)
      .eq("student_id", user?.id)
      .maybeSingle();

    if (data) {
      setSubmission(data);
      setContent(data.content || "");
    }
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleSubmit = async () => {
    if (!content && !file) {
      toast({
        title: "Error",
        description: "Please provide a text submission or upload a file",
        variant: "destructive"
      });
      return;
    }

    if (file && file.size > MAX_FILE_SIZE) {
      toast({
        title: "Error",
        description: "File size must be less than 10MB",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    let filePath = null;
    if (file) {
      const path = `${user?.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("assignment-submissions")
        .upload(path, file);

      if (uploadError) {
        toast({
          title: "Error",
          description: "Failed to upload file",
          variant: "destructive"
        });
        setSubmitting(false);
        return;
      }
      filePath = path;
    }

    const submissionData = {
      assignment_id: id,
      student_id: user?.id,
      content: content || null,
      file_path: filePath
    };

    try {
      const { error } = submission
        ? await supabase
            .from("submissions")
            .update({ content: content || null, file_path: filePath || submission.file_path })
            .eq("id", submission.id)
        : await supabase
            .from("submissions")
            .insert([submissionData]);

      if (error) {
        console.error("Submission error:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to submit assignment. Make sure you're enrolled in this course.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: submission ? "Submission updated successfully" : "Assignment submitted successfully"
        });
        fetchSubmission();
      }
    } catch (err: any) {
      console.error("Submission exception:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading assignment...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) return null;

  const isPastDue = new Date(assignment.due_date) < new Date();
  const isGraded = submission?.grade !== null;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{assignment.title}</CardTitle>
                <CardDescription className="mt-1">
                  {assignment.courses.code} - {assignment.courses.title}
                </CardDescription>
              </div>
              {isGraded && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Graded</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{assignment.description}</p>
            </div>
            {assignment.file_name && assignment.file_path && (
              <div>
                <h3 className="font-semibold mb-2">Assignment Document</h3>
                <DocumentPreview
                  filePath={assignment.file_path}
                  fileName={assignment.file_name}
                  bucketName="course-materials"
                />
              </div>
            )}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  Due: {format(new Date(assignment.due_date), "MMM d, yyyy h:mm a")}
                  {isPastDue && <span className="text-red-600 ml-2">(Past due)</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-muted-foreground" />
                <span>Max Points: {assignment.max_points}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {isGraded && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle>Grade & Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Grade</p>
                <p className="text-2xl font-bold text-green-600">
                  {submission.grade} / {assignment.max_points}
                </p>
              </div>
              {submission.feedback && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Feedback</p>
                  <p className="whitespace-pre-wrap">{submission.feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {submission ? "Your Submission" : "Submit Assignment"}
            </CardTitle>
            {submission && (
              <CardDescription>
                Submitted on {format(new Date(submission.submitted_at), "MMM d, yyyy h:mm a")}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!isGraded && (
              <>
                <div>
                  <Label htmlFor="content">Text Submission</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter your submission text here..."
                    rows={8}
                    disabled={isPastDue}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">Upload Your Assignment (PDF or Word Document)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Supported formats: PDF, DOC, DOCX
                    </p>
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      disabled={isPastDue}
                      className="cursor-pointer"
                    />
                  </div>
                  {file && (
                    <p className="text-sm text-primary flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Selected: {file.name}
                    </p>
                  )}
                  {submission?.file_path && !file && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Previously uploaded: {submission.file_path.split("/").pop()}
                    </p>
                  )}
                </div>
                {!isPastDue && (
                  <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                    <Upload className="w-4 h-4 mr-2" />
                    {submitting ? "Submitting..." : submission ? "Update Submission" : "Submit Assignment"}
                  </Button>
                )}
                {isPastDue && (
                  <p className="text-red-600 text-sm">
                    This assignment is past due. Submissions are no longer accepted.
                  </p>
                )}
              </>
            )}
            {isGraded && (
              <div className="space-y-2">
                {content && (
                  <div>
                    <p className="text-sm font-medium mb-2">Text Submission:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded">
                      {content}
                    </p>
                  </div>
                )}
                {submission.file_path && (
                  <p className="text-sm">
                    File: {submission.file_path.split("/").pop()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AssignmentSubmission;