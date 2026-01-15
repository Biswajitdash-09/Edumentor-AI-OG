import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const DataManagementCard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleExportData = async () => {
    if (!user) return;
    
    setExporting(true);
    try {
      // Gather all user data
      const [
        profileResult,
        enrollmentsResult,
        submissionsResult,
        attendanceResult,
        notificationsResult,
        chatMessagesResult,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("enrollments").select("*, courses(title, code)").eq("student_id", user.id),
        supabase.from("submissions").select("*, assignments(title, course_id)").eq("student_id", user.id),
        supabase.from("attendance_records").select("*, attendance_sessions(session_date, course_id)").eq("student_id", user.id),
        supabase.from("notifications").select("*").eq("user_id", user.id),
        supabase.from("chat_messages").select("*").eq("user_id", user.id),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: profileResult.data,
        enrollments: enrollmentsResult.data || [],
        submissions: submissionsResult.data || [],
        attendanceRecords: attendanceResult.data || [],
        notifications: notificationsResult.data || [],
        chatHistory: chatMessagesResult.data || [],
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edumentor-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Your data has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || confirmEmail !== user.email) {
      toast({
        title: "Verification Failed",
        description: "Please enter your email correctly to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      // Delete all user data in correct order (respecting foreign keys)
      await Promise.all([
        supabase.from("chat_messages").delete().eq("user_id", user.id),
        supabase.from("notifications").delete().eq("user_id", user.id),
        supabase.from("notification_preferences").delete().eq("user_id", user.id),
        supabase.from("user_consents").delete().eq("user_id", user.id),
      ]);

      // Delete attendance records
      await supabase.from("attendance_records").delete().eq("student_id", user.id);

      // Delete submissions
      await supabase.from("submissions").delete().eq("student_id", user.id);

      // Delete enrollments
      await supabase.from("enrollments").delete().eq("student_id", user.id);

      // Delete profile and role
      await Promise.all([
        supabase.from("profiles").delete().eq("user_id", user.id),
        supabase.from("user_roles").delete().eq("user_id", user.id),
      ]);

      // Sign out
      await signOut();

      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });

      navigate("/");
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Deletion Failed",
        description: "Failed to delete your account. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setConfirmEmail("");
    }
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Data Management
        </CardTitle>
        <CardDescription>Export your data or delete your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div>
            <p className="font-medium">Export Your Data</p>
            <p className="text-sm text-muted-foreground">
              Download all your data in JSON format (GDPR compliant)
            </p>
          </div>
          <Button variant="outline" onClick={handleExportData} disabled={exporting}>
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="ml-2">{exporting ? "Exporting..." : "Export"}</span>
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20">
          <div>
            <p className="font-medium text-destructive">Delete Account</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all data
            </p>
          </div>
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Delete Account Permanently?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    This action cannot be undone. This will permanently delete your account
                    and remove all associated data including:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                    <li>Your profile information</li>
                    <li>All course enrollments</li>
                    <li>Assignment submissions and grades</li>
                    <li>Attendance records</li>
                    <li>Chat history with AI Mentor</li>
                    <li>Notification preferences</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="confirmEmail">
                  Type <span className="font-mono text-destructive">{user?.email}</span> to confirm:
                </Label>
                <Input
                  id="confirmEmail"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-2"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmEmail("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting || confirmEmail !== user?.email}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Forever
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
