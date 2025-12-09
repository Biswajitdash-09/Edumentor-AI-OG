import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, CheckCircle, Loader2, FileText } from "lucide-react";

interface PlagiarismReport {
  id: string;
  submission_id: string;
  similarity_score: number;
  similar_submissions: any[];
  ai_analysis: string | null;
  status: string;
}

interface Submission {
  id: string;
  content: string | null;
  student_name: string;
}

interface PlagiarismCheckerProps {
  assignmentId: string;
  submissions: Submission[];
}

export default function PlagiarismChecker({ assignmentId, submissions }: PlagiarismCheckerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reports, setReports] = useState<PlagiarismReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<PlagiarismReport | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const runPlagiarismCheck = async () => {
    if (submissions.length < 2) {
      toast({ 
        title: "Not enough submissions", 
        description: "At least 2 submissions are required for comparison",
        variant: "destructive" 
      });
      return;
    }

    setChecking(true);
    setProgress(0);
    const newReports: PlagiarismReport[] = [];

    try {
      const submissionsWithContent = submissions.filter(s => s.content && s.content.trim().length > 50);
      
      if (submissionsWithContent.length < 2) {
        toast({ 
          title: "Not enough text content", 
          description: "Submissions need sufficient text content for comparison",
          variant: "destructive" 
        });
        setChecking(false);
        return;
      }

      const totalComparisons = submissionsWithContent.length;
      
      for (let i = 0; i < submissionsWithContent.length; i++) {
        const submission = submissionsWithContent[i];
        const otherSubmissions = submissionsWithContent.filter((_, idx) => idx !== i);
        
        // Call AI to analyze similarity
        const { data: response, error } = await supabase.functions.invoke("check-plagiarism", {
          body: {
            targetSubmission: {
              id: submission.id,
              content: submission.content,
              student_name: submission.student_name
            },
            otherSubmissions: otherSubmissions.map(s => ({
              id: s.id,
              content: s.content,
              student_name: s.student_name
            }))
          }
        });

        if (error) {
          console.error("Plagiarism check error:", error);
          continue;
        }

        // Store report in database
        const { data: report, error: insertError } = await supabase
          .from("plagiarism_reports")
          .upsert({
            submission_id: submission.id,
            similarity_score: response.similarity_score || 0,
            similar_submissions: response.similar_submissions || [],
            ai_analysis: response.analysis || null,
            status: "completed",
            checked_by: user?.id
          }, { onConflict: "submission_id" })
          .select()
          .single();

        if (!insertError && report) {
          newReports.push({
            ...report,
            similar_submissions: Array.isArray(report.similar_submissions) ? report.similar_submissions : []
          });
        }

        setProgress(Math.round(((i + 1) / totalComparisons) * 100));
      }

      setReports(newReports);
      toast({ 
        title: "Plagiarism check complete", 
        description: `Analyzed ${newReports.length} submissions` 
      });
    } catch (error) {
      console.error("Plagiarism check failed:", error);
      toast({ 
        title: "Error", 
        description: "Failed to complete plagiarism check",
        variant: "destructive" 
      });
    } finally {
      setChecking(false);
    }
  };

  const getSeverityColor = (score: number) => {
    if (score >= 70) return "destructive";
    if (score >= 40) return "secondary";
    return "default";
  };

  const getSeverityIcon = (score: number) => {
    if (score >= 70) return <AlertTriangle className="h-4 w-4" />;
    if (score >= 40) return <Shield className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          AI Plagiarism Detection
        </CardTitle>
        <CardDescription>
          Compare submissions for similarity using AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!checking && reports.length === 0 && (
          <div className="text-center py-6">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Run AI-powered plagiarism detection on {submissions.length} submissions
            </p>
            <Button onClick={runPlagiarismCheck} disabled={submissions.length < 2}>
              <Shield className="h-4 w-4 mr-2" />
              Start Plagiarism Check
            </Button>
          </div>
        )}

        {checking && (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Analyzing submissions with AI...</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{progress}% complete</p>
          </div>
        )}

        {reports.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Analysis Results</h4>
              <Button variant="outline" size="sm" onClick={runPlagiarismCheck}>
                Re-run Check
              </Button>
            </div>
            
            <div className="space-y-2">
              {reports.map((report) => {
                const submission = submissions.find(s => s.id === report.submission_id);
                return (
                  <div 
                    key={report.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedReport(report);
                      setDetailsOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {getSeverityIcon(report.similarity_score)}
                      <div>
                        <p className="font-medium">{submission?.student_name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.similar_submissions?.length || 0} similar submissions found
                        </p>
                      </div>
                    </div>
                    <Badge variant={getSeverityColor(report.similarity_score)}>
                      {Math.round(report.similarity_score)}% Similar
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">
                  {reports.filter(r => r.similarity_score < 40).length}
                </p>
                <p className="text-sm text-muted-foreground">Original</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">
                  {reports.filter(r => r.similarity_score >= 40 && r.similarity_score < 70).length}
                </p>
                <p className="text-sm text-muted-foreground">Needs Review</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">
                  {reports.filter(r => r.similarity_score >= 70).length}
                </p>
                <p className="text-sm text-muted-foreground">High Similarity</p>
              </div>
            </div>
          </div>
        )}

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Plagiarism Analysis Details</DialogTitle>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium">
                    {submissions.find(s => s.id === selectedReport.submission_id)?.student_name}
                  </span>
                  <Badge variant={getSeverityColor(selectedReport.similarity_score)} className="text-lg px-3 py-1">
                    {Math.round(selectedReport.similarity_score)}% Similarity
                  </Badge>
                </div>
                
                {selectedReport.ai_analysis && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h5 className="font-medium mb-2">AI Analysis</h5>
                    <p className="text-sm whitespace-pre-wrap">{selectedReport.ai_analysis}</p>
                  </div>
                )}

                {selectedReport.similar_submissions && selectedReport.similar_submissions.length > 0 && (
                  <div>
                    <h5 className="font-medium mb-2">Similar Submissions</h5>
                    <div className="space-y-2">
                      {selectedReport.similar_submissions.map((sim: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                          <span>{sim.student_name}</span>
                          <Badge variant="outline">{Math.round(sim.similarity)}% match</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}