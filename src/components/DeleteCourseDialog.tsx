import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeleteCourseDialogProps {
  courseId: string;
  courseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const DeleteCourseDialog = ({ courseId, courseTitle, open, onOpenChange, onSuccess }: DeleteCourseDialogProps) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Course deleted successfully"
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Course</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{courseTitle}"? This will permanently delete the course and all associated assignments, materials, and enrollments. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete Course
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};