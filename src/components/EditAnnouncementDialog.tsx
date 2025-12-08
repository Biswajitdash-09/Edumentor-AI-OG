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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Announcement {
  id: string;
  title: string;
  content: string;
  course_id: string | null;
  is_pinned: boolean;
}

interface Course {
  id: string;
  code: string;
  title: string;
}

interface EditAnnouncementDialogProps {
  announcement: Announcement | null;
  courses: Course[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAnnouncementDialog({
  announcement,
  courses,
  open,
  onOpenChange,
  onSuccess,
}: EditAnnouncementDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    course_id: "all",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (announcement) {
      setFormData({
        title: announcement.title,
        content: announcement.content,
        course_id: announcement.course_id || "all",
      });
    }
  }, [announcement]);

  const handleSave = async () => {
    if (!announcement) return;

    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("announcements")
        .update({
          title: formData.title,
          content: formData.content,
          course_id: formData.course_id === "all" ? null : formData.course_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", announcement.id);

      if (error) throw error;

      toast({
        title: "Announcement Updated",
        description: "The announcement has been updated successfully.",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Announcement</DialogTitle>
          <DialogDescription>
            Update the announcement details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter announcement title"
            />
          </div>

          <div>
            <Label htmlFor="course">Course</Label>
            <Select
              value={formData.course_id}
              onValueChange={(value) =>
                setFormData({ ...formData, course_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="Enter announcement content..."
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}