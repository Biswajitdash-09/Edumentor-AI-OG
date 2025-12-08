import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Clock, UserCheck } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  email: string;
  status: string | null;
  record_id: string | null;
  reason: string | null;
}

interface ManualAttendanceDialogProps {
  sessionId: string;
  sessionTitle: string;
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ManualAttendanceDialog({
  sessionId,
  sessionTitle,
  courseId,
  open,
  onOpenChange,
  onSuccess,
}: ManualAttendanceDialogProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, { status: string; reason: string }>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchStudentsWithAttendance();
    }
  }, [open, sessionId, courseId]);

  const fetchStudentsWithAttendance = async () => {
    setLoading(true);
    try {
      // Get enrolled students
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          profiles!student_id(full_name, email)
        `)
        .eq("course_id", courseId)
        .eq("status", "active");

      if (enrollError) throw enrollError;

      // Get existing attendance records
      const { data: records, error: recordsError } = await supabase
        .from("attendance_records")
        .select("id, student_id, status, reason")
        .eq("session_id", sessionId);

      if (recordsError) throw recordsError;

      // Map students with their attendance status
      const studentList: Student[] = (enrollments || []).map((enrollment: any) => {
        const record = records?.find((r) => r.student_id === enrollment.student_id);
        return {
          id: enrollment.student_id,
          full_name: enrollment.profiles?.full_name || "Unknown",
          email: enrollment.profiles?.email || "",
          status: record?.status || null,
          record_id: record?.id || null,
          reason: record?.reason || null,
        };
      });

      setStudents(studentList);
      
      // Initialize changes with current status
      const initialChanges: Record<string, { status: string; reason: string }> = {};
      studentList.forEach((s) => {
        initialChanges[s.id] = {
          status: s.status || "absent",
          reason: s.reason || "",
        };
      });
      setChanges(initialChanges);
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

  const handleStatusChange = (studentId: string, status: string) => {
    setChanges((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const handleReasonChange = (studentId: string, reason: string) => {
    setChanges((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], reason },
    }));
  };

  const markAllPresent = () => {
    const newChanges: Record<string, { status: string; reason: string }> = {};
    students.forEach((s) => {
      newChanges[s.id] = { status: "present", reason: changes[s.id]?.reason || "" };
    });
    setChanges(newChanges);
  };

  const markAllAbsent = () => {
    const newChanges: Record<string, { status: string; reason: string }> = {};
    students.forEach((s) => {
      newChanges[s.id] = { status: "absent", reason: changes[s.id]?.reason || "" };
    });
    setChanges(newChanges);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const student of students) {
        const change = changes[student.id];
        if (!change) continue;

        if (student.record_id) {
          // Update existing record
          if (change.status !== student.status || change.reason !== student.reason) {
            // Create edit record for audit trail
            await supabase.from("attendance_edits").insert({
              attendance_record_id: student.record_id,
              edited_by: user.id,
              old_status: student.status,
              new_status: change.status,
              reason: change.reason || null,
            });

            // Update the record
            await supabase
              .from("attendance_records")
              .update({
                status: change.status,
                reason: change.reason || null,
                edited_by: user.id,
                edited_at: new Date().toISOString(),
              })
              .eq("id", student.record_id);
          }
        } else {
          // Create new record for students who didn't check in
          await supabase.from("attendance_records").insert({
            session_id: sessionId,
            student_id: student.id,
            status: change.status,
            reason: change.reason || null,
            edited_by: user.id,
            edited_at: new Date().toISOString(),
          });
        }
      }

      toast({
        title: "Attendance Updated",
        description: "All attendance records have been saved.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manual Attendance - {sessionTitle}</DialogTitle>
          <DialogDescription>
            Mark attendance for students who didn't check in or edit existing records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={markAllPresent}>
            <Check className="h-4 w-4 mr-1" />
            Mark All Present
          </Button>
          <Button variant="outline" size="sm" onClick={markAllAbsent}>
            <X className="h-4 w-4 mr-1" />
            Mark All Absent
          </Button>
        </div>

        <div className="overflow-auto max-h-[400px]">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No students enrolled in this course.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{student.full_name}</p>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {student.status ? (
                          <>
                            {getStatusIcon(student.status)}
                            <span className="text-sm capitalize">{student.status}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not recorded</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={changes[student.id]?.status || "absent"}
                        onValueChange={(value) => handleStatusChange(student.id, value)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="excused">Excused</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Optional reason..."
                        value={changes[student.id]?.reason || ""}
                        onChange={(e) => handleReasonChange(student.id, e.target.value)}
                        className="w-[150px]"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Attendance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
