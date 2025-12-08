import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeleteAssignmentDialogProps {
  assignmentId: string;
  assignmentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const DeleteAssignmentDialog = ({ assignmentId, assignmentTitle, open, onOpenChange, onSuccess }: DeleteAssignmentDialogProps) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Assignment deleted successfully"
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{assignmentTitle}"? This will permanently delete the assignment and all student submissions. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete Assignment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};