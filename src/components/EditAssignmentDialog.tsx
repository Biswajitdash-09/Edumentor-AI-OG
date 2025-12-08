import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileUpload } from "@/components/FileUpload";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_points: number;
  file_path?: string | null;
  file_name?: string | null;
  course_id: string;
}

interface EditAssignmentDialogProps {
  assignment: Assignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditAssignmentDialog = ({ assignment, open, onOpenChange, onSuccess }: EditAssignmentDialogProps) => {
  const [editedAssignment, setEditedAssignment] = useState({
    ...assignment,
    due_date: assignment.due_date.slice(0, 16) // Format for datetime-local input
  });
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog opens with new assignment
  useEffect(() => {
    if (open) {
      setEditedAssignment({
        ...assignment,
        due_date: assignment.due_date.slice(0, 16)
      });
      setNewFile(null);
      setRemoveExistingFile(false);
      setUploadProgress(0);
    }
  }, [open, assignment]);

  const handleUpdate = async () => {
    if (!editedAssignment.title || !editedAssignment.due_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    let filePath = editedAssignment.file_path;
    let fileName = editedAssignment.file_name;

    // Handle file removal
    if (removeExistingFile && editedAssignment.file_path) {
      // Delete old file from storage
      await supabase.storage
        .from("course-materials")
        .remove([editedAssignment.file_path]);
      filePath = null;
      fileName = null;
    }

    // Handle new file upload
    if (newFile) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      if (!allowedTypes.includes(newFile.type)) {
        toast({
          title: "Error",
          description: "Only PDF and Word documents are allowed",
          variant: "destructive"
        });
        setUploading(false);
        return;
      }

      // Delete old file if exists
      if (editedAssignment.file_path) {
        await supabase.storage
          .from("course-materials")
          .remove([editedAssignment.file_path]);
      }

      // Simulate upload progress
      setUploadProgress(10);
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90));
      }, 200);

      // Upload new file
      const path = `${assignment.course_id}/assignments/${Date.now()}-${newFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("course-materials")
        .upload(path, newFile);

      clearInterval(progressInterval);

      if (uploadError) {
        setUploadProgress(0);
        toast({
          title: "Error",
          description: "Failed to upload file",
          variant: "destructive"
        });
        setUploading(false);
        return;
      }

      setUploadProgress(100);
      filePath = path;
      fileName = newFile.name;
    }

    const { error } = await supabase
      .from("assignments")
      .update({
        title: editedAssignment.title,
        description: editedAssignment.description,
        due_date: editedAssignment.due_date,
        max_points: editedAssignment.max_points,
        file_path: filePath,
        file_name: fileName
      })
      .eq("id", assignment.id);

    setUploading(false);
    setUploadProgress(0);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Assignment updated successfully"
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  const hasExistingFile = editedAssignment.file_name && !removeExistingFile && !newFile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
          <DialogDescription>Update assignment details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={editedAssignment.title}
              onChange={(e) => setEditedAssignment({ ...editedAssignment, title: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={editedAssignment.description}
              onChange={(e) => setEditedAssignment({ ...editedAssignment, description: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit-due_date">Due Date *</Label>
            <Input
              id="edit-due_date"
              type="datetime-local"
              value={editedAssignment.due_date}
              onChange={(e) => setEditedAssignment({ ...editedAssignment, due_date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit-max_points">Maximum Points</Label>
            <Input
              id="edit-max_points"
              type="number"
              value={editedAssignment.max_points}
              onChange={(e) => setEditedAssignment({ ...editedAssignment, max_points: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <Label>Attachment (PDF/Word)</Label>
            <FileUpload
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onFileSelect={(file) => {
                setNewFile(file);
                if (file) setRemoveExistingFile(false);
              }}
              selectedFile={newFile}
              existingFileName={hasExistingFile ? editedAssignment.file_name : undefined}
              onRemoveExisting={() => setRemoveExistingFile(true)}
              label={hasExistingFile ? "Upload a new file to replace" : "Upload assignment document"}
              description="PDF, DOC, DOCX"
              maxSizeMB={10}
              uploadProgress={uploadProgress}
              isUploading={uploading}
            />
            {removeExistingFile && !newFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Current file will be removed on save.
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setRemoveExistingFile(false)}
                  className="h-auto p-0 ml-2"
                >
                  Undo
                </Button>
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpdate} disabled={uploading}>
            {uploading ? "Updating..." : "Update Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};