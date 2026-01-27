import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Upload, FileSpreadsheet, Award, CheckCircle, XCircle, Download } from "lucide-react";

interface Submission {
  id: string;
  student_id: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface BulkGradingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: Submission[];
  maxPoints: number;
  assignmentId: string;
  onSuccess: () => void;
}

interface GradePreset {
  label: string;
  percentage: number;
  color: string;
}

const GRADE_PRESETS: GradePreset[] = [
  { label: "A", percentage: 90, color: "bg-green-500" },
  { label: "B", percentage: 80, color: "bg-blue-500" },
  { label: "C", percentage: 70, color: "bg-yellow-500" },
  { label: "D", percentage: 60, color: "bg-orange-500" },
  { label: "F", percentage: 40, color: "bg-red-500" },
];

export function BulkGradingDialog({
  open,
  onOpenChange,
  submissions,
  maxPoints,
  assignmentId,
  onSuccess,
}: BulkGradingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const [bulkGrade, setBulkGrade] = useState<number>(0);
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [csvResults, setCsvResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const toggleSubmission = (id: string) => {
    const newSelected = new Set(selectedSubmissions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSubmissions(newSelected);
  };

  const selectAll = () => {
    if (selectedSubmissions.size === submissions.length) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(submissions.map((s) => s.id)));
    }
  };

  const applyPreset = (preset: GradePreset) => {
    const grade = Math.round((preset.percentage / 100) * maxPoints);
    setBulkGrade(grade);
  };

  const handleBulkGrade = async () => {
    if (selectedSubmissions.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one submission to grade",
        variant: "destructive",
      });
      return;
    }

    if (bulkGrade < 0 || bulkGrade > maxPoints) {
      toast({
        title: "Invalid Grade",
        description: `Grade must be between 0 and ${maxPoints}`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const selectedIds = Array.from(selectedSubmissions);

      const { error } = await supabase
        .from("submissions")
        .update({
          grade: bulkGrade,
          feedback: bulkFeedback || null,
          graded_by: user?.id,
          graded_at: new Date().toISOString(),
        })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Bulk Grading Complete",
        description: `Successfully graded ${selectedIds.length} submission(s)`,
      });

      // Send notifications for each graded submission
      for (const sub of submissions.filter((s) => selectedSubmissions.has(s.id))) {
        try {
          await supabase.functions.invoke("send-grade-notification", {
            body: {
              studentId: sub.student_id,
              assignmentId,
              grade: bulkGrade,
              maxPoints,
              feedback: bulkFeedback || null,
              facultyName: "Instructor",
            },
          });
        } catch (e) {
          console.error("Failed to send notification:", e);
          toast({
            title: "Warning",
            description: "Grade saved but notification email failed to send",
            variant: "destructive"
          });
        }
      }

      onSuccess();
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to grade submissions",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const parseCSV = (text: string): Array<{ email: string; grade: number; feedback?: string }> => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const results: Array<{ email: string; grade: number; feedback?: string }> = [];

    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes("email") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cells = lines[i].split(",").map((cell) => cell.trim().replace(/"/g, ""));
      
      if (cells.length >= 2) {
        const email = cells[0]?.toLowerCase();
        const grade = parseFloat(cells[1]);
        const feedback = cells[2] || undefined;

        if (email && !isNaN(grade)) {
          results.push({ email, grade, feedback });
        }
      }
    }

    return results;
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setCsvResults(null);

    try {
      const text = await file.text();
      const grades = parseCSV(text);

      if (grades.length === 0) {
        toast({
          title: "No Data Found",
          description: "No valid grade entries found in the CSV file",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const entry of grades) {
        const submission = submissions.find(
          (s) => s.profiles.email.toLowerCase() === entry.email
        );

        if (!submission) {
          results.failed++;
          results.errors.push(`${entry.email}: Student not found in submissions`);
          continue;
        }

        if (entry.grade < 0 || entry.grade > maxPoints) {
          results.failed++;
          results.errors.push(`${entry.email}: Grade ${entry.grade} out of range (0-${maxPoints})`);
          continue;
        }

        const { error } = await supabase
          .from("submissions")
          .update({
            grade: entry.grade,
            feedback: entry.feedback || null,
            graded_by: user?.id,
            graded_at: new Date().toISOString(),
          })
          .eq("id", submission.id);

        if (error) {
          results.failed++;
          results.errors.push(`${entry.email}: ${error.message}`);
        } else {
          results.success++;
        }
      }

      setCsvResults(results);

      if (results.success > 0) {
        toast({
          title: "CSV Import Complete",
          description: `Successfully graded ${results.success} submission(s)`,
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process CSV file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const header = "email,grade,feedback";
    const rows = submissions.map((s) => `${s.profiles.email},,`);
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grading_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setSelectedSubmissions(new Set());
    setBulkGrade(0);
    setBulkFeedback("");
    setCsvResults(null);
    setMode("manual");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Bulk Grading
          </DialogTitle>
          <DialogDescription>
            Grade multiple submissions at once using quick presets or CSV import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("manual")}
          >
            Manual Selection
          </Button>
          <Button
            variant={mode === "csv" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("csv")}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            CSV Import
          </Button>
        </div>

        {mode === "manual" ? (
          <div className="space-y-4">
            {/* Selection List */}
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between p-3 border-b bg-muted/50">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSubmissions.size === submissions.length && submissions.length > 0}
                    onCheckedChange={selectAll}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </div>
                <Badge variant="secondary">
                  {selectedSubmissions.size} of {submissions.length} selected
                </Badge>
              </div>
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleSubmission(sub.id)}
                >
                  <Checkbox checked={selectedSubmissions.has(sub.id)} />
                  <div>
                    <p className="text-sm font-medium">{sub.profiles.full_name}</p>
                    <p className="text-xs text-muted-foreground">{sub.profiles.email}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Grade Presets */}
            <div>
              <Label className="text-sm mb-2 block">Quick Grade Presets</Label>
              <div className="flex gap-2">
                {GRADE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="flex-1"
                  >
                    <span className={`w-3 h-3 rounded-full ${preset.color} mr-2`} />
                    {preset.label} ({Math.round((preset.percentage / 100) * maxPoints)})
                  </Button>
                ))}
              </div>
            </div>

            {/* Grade Input */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bulk-grade">Grade (max {maxPoints})</Label>
                <Input
                  id="bulk-grade"
                  type="number"
                  min="0"
                  max={maxPoints}
                  value={bulkGrade}
                  onChange={(e) => setBulkGrade(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end">
                <div className="text-2xl font-bold text-primary">
                  {((bulkGrade / maxPoints) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div>
              <Label htmlFor="bulk-feedback">Feedback (optional)</Label>
              <Textarea
                id="bulk-feedback"
                value={bulkFeedback}
                onChange={(e) => setBulkFeedback(e.target.value)}
                placeholder="Add feedback for all selected submissions..."
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* CSV Format Info */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV Format
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Columns: email, grade, feedback (optional)</li>
                <li>First row can be header (will be skipped)</li>
                <li>Grade must be between 0 and {maxPoints}</li>
              </ul>
            </div>

            {/* Upload Area */}
            <div>
              <Label htmlFor="csv-grade-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {isProcessing ? "Processing..." : "Click to upload CSV"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                </div>
              </Label>
              <Input
                ref={fileInputRef}
                id="csv-grade-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCSVUpload}
                disabled={isProcessing}
              />
            </div>

            {/* CSV Results */}
            {csvResults && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-primary/10 rounded">
                    <p className="text-2xl font-bold text-primary">{csvResults.success}</p>
                    <p className="text-xs text-muted-foreground">Success</p>
                  </div>
                  <div className="p-2 bg-destructive/10 rounded">
                    <p className="text-2xl font-bold text-destructive">{csvResults.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>

                {csvResults.errors.length > 0 && (
                  <div className="max-h-32 overflow-auto text-xs space-y-1">
                    {csvResults.errors.map((error, i) => (
                      <div key={i} className="flex items-start gap-1 text-destructive">
                        <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === "manual" && (
            <Button onClick={handleBulkGrade} disabled={isProcessing || selectedSubmissions.size === 0}>
              {isProcessing ? "Grading..." : `Grade ${selectedSubmissions.size} Submission(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
