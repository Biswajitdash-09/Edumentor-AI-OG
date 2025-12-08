import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, formatDateForCSV } from "@/lib/csvExport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, Loader2 } from "lucide-react";

interface ExportDataDialogProps {
  courseId: string;
  courseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportType = "attendance" | "grades" | "students";

export function ExportDataDialog({
  courseId,
  courseName,
  open,
  onOpenChange,
}: ExportDataDialogProps) {
  const [exportType, setExportType] = useState<ExportType>("attendance");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      switch (exportType) {
        case "attendance":
          await exportAttendance();
          break;
        case "grades":
          await exportGrades();
          break;
        case "students":
          await exportStudents();
          break;
      }

      toast({
        title: "Export Complete",
        description: "Your data has been downloaded.",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportAttendance = async () => {
    // Get all sessions for the course
    let query = supabase
      .from("attendance_sessions")
      .select(`
        id,
        session_date,
        session_time,
        attendance_records(
          status,
          student_id,
          checked_in_at
        )
      `)
      .eq("course_id", courseId)
      .order("session_date", { ascending: false });

    if (startDate) {
      query = query.gte("session_date", startDate);
    }
    if (endDate) {
      query = query.lte("session_date", endDate);
    }

    const { data: sessions, error: sessionsError } = await query;
    if (sessionsError) throw sessionsError;

    // Get enrolled students
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("enrollments")
      .select(`
        student_id,
        profiles!student_id(full_name, email)
      `)
      .eq("course_id", courseId)
      .eq("status", "active");

    if (enrollmentsError) throw enrollmentsError;

    // Build export data
    const exportData: Record<string, any>[] = [];
    
    for (const enrollment of enrollments || []) {
      const studentRow: Record<string, any> = {
        student_name: (enrollment as any).profiles?.full_name || "Unknown",
        student_email: (enrollment as any).profiles?.email || "",
      };

      let totalSessions = 0;
      let presentCount = 0;

      for (const session of sessions || []) {
        const record = (session.attendance_records as any[])?.find(
          (r) => r.student_id === enrollment.student_id
        );
        const dateKey = formatDateForCSV(session.session_date);
        studentRow[dateKey] = record?.status || "absent";
        totalSessions++;
        if (record?.status === "present" || record?.status === "late") {
          presentCount++;
        }
      }

      studentRow["total_sessions"] = totalSessions;
      studentRow["present_count"] = presentCount;
      studentRow["attendance_rate"] = totalSessions > 0 
        ? `${Math.round((presentCount / totalSessions) * 100)}%` 
        : "N/A";

      exportData.push(studentRow);
    }

    const filename = `${courseName.replace(/\s+/g, "_")}_attendance_${formatDateForCSV(new Date())}`;
    exportToCSV(exportData, filename);
  };

  const exportGrades = async () => {
    // Get all assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from("assignments")
      .select("id, title, max_points")
      .eq("course_id", courseId)
      .order("due_date");

    if (assignmentsError) throw assignmentsError;

    // Get enrolled students
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("enrollments")
      .select(`
        student_id,
        profiles!student_id(full_name, email)
      `)
      .eq("course_id", courseId)
      .eq("status", "active");

    if (enrollmentsError) throw enrollmentsError;

    // Get all submissions
    const assignmentIds = (assignments || []).map((a) => a.id);
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select("assignment_id, student_id, grade")
      .in("assignment_id", assignmentIds);

    if (submissionsError) throw submissionsError;

    // Build export data
    const exportData: Record<string, any>[] = [];

    for (const enrollment of enrollments || []) {
      const studentRow: Record<string, any> = {
        student_name: (enrollment as any).profiles?.full_name || "Unknown",
        student_email: (enrollment as any).profiles?.email || "",
      };

      let totalPoints = 0;
      let earnedPoints = 0;

      for (const assignment of assignments || []) {
        const submission = submissions?.find(
          (s) => s.student_id === enrollment.student_id && s.assignment_id === assignment.id
        );
        studentRow[assignment.title] = submission?.grade ?? "Not submitted";
        if (submission?.grade !== null && submission?.grade !== undefined) {
          earnedPoints += Number(submission.grade);
          totalPoints += assignment.max_points;
        }
      }

      studentRow["total_earned"] = earnedPoints;
      studentRow["total_possible"] = totalPoints;
      studentRow["percentage"] = totalPoints > 0 
        ? `${Math.round((earnedPoints / totalPoints) * 100)}%` 
        : "N/A";

      exportData.push(studentRow);
    }

    const filename = `${courseName.replace(/\s+/g, "_")}_grades_${formatDateForCSV(new Date())}`;
    exportToCSV(exportData, filename);
  };

  const exportStudents = async () => {
    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select(`
        student_id,
        enrolled_at,
        status,
        profiles!student_id(full_name, email)
      `)
      .eq("course_id", courseId);

    if (error) throw error;

    const exportData = (enrollments || []).map((e: any) => ({
      student_name: e.profiles?.full_name || "Unknown",
      student_email: e.profiles?.email || "",
      enrolled_at: formatDateForCSV(e.enrolled_at),
      status: e.status,
    }));

    const filename = `${courseName.replace(/\s+/g, "_")}_students_${formatDateForCSV(new Date())}`;
    exportToCSV(exportData, filename, [
      { key: "student_name", header: "Student Name" },
      { key: "student_email", header: "Email" },
      { key: "enrolled_at", header: "Enrolled Date" },
      { key: "status", header: "Status" },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Export {courseName} data to CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Export Type</Label>
            <Select value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance">Attendance Records</SelectItem>
                <SelectItem value="grades">Grade Book</SelectItem>
                <SelectItem value="students">Student List</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {exportType === "attendance" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date (Optional)</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
