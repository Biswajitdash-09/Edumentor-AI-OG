import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeleteSessionDialogProps {
  sessionId: string;
  sessionTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const DeleteSessionDialog = ({ sessionId, sessionTitle, open, onOpenChange, onSuccess }: DeleteSessionDialogProps) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    const { error } = await supabase
      .from("attendance_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Session deleted successfully"
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Attendance Session</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the session for "{sessionTitle}"? This will permanently delete all attendance records for this session. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};