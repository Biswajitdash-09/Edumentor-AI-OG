import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  semester: string;
  year: number;
}

interface EditCourseDialogProps {
  course: Course;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditCourseDialog = ({ course, open, onOpenChange, onSuccess }: EditCourseDialogProps) => {
  const [editedCourse, setEditedCourse] = useState(course);
  const { toast } = useToast();

  const handleUpdate = async () => {
    if (!editedCourse.code || !editedCourse.title) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("courses")
      .update({
        code: editedCourse.code,
        title: editedCourse.title,
        description: editedCourse.description,
        semester: editedCourse.semester,
        year: editedCourse.year
      })
      .eq("id", course.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Course updated successfully"
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>Update course details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="code">Course Code *</Label>
            <Input
              id="code"
              value={editedCourse.code}
              onChange={(e) => setEditedCourse({ ...editedCourse, code: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="title">Course Title *</Label>
            <Input
              id="title"
              value={editedCourse.title}
              onChange={(e) => setEditedCourse({ ...editedCourse, title: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={editedCourse.description}
              onChange={(e) => setEditedCourse({ ...editedCourse, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="semester">Semester</Label>
              <Input
                id="semester"
                value={editedCourse.semester}
                onChange={(e) => setEditedCourse({ ...editedCourse, semester: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={editedCourse.year}
                onChange={(e) => setEditedCourse({ ...editedCourse, year: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpdate}>Update Course</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};