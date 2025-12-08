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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  start_date: string;
  end_date: string | null;
  course_id: string;
}

interface EditScheduleDialogProps {
  schedule: Schedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function EditScheduleDialog({
  schedule,
  open,
  onOpenChange,
  onSuccess,
}: EditScheduleDialogProps) {
  const [formData, setFormData] = useState({
    day_of_week: "1",
    start_time: "09:00",
    end_time: "10:00",
    room: "",
    start_date: "",
    end_date: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (schedule) {
      setFormData({
        day_of_week: schedule.day_of_week.toString(),
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        room: schedule.room || "",
        start_date: schedule.start_date,
        end_date: schedule.end_date || "",
      });
    }
  }, [schedule]);

  const handleSave = async () => {
    if (!schedule) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("schedules")
        .update({
          day_of_week: parseInt(formData.day_of_week),
          start_time: formData.start_time,
          end_time: formData.end_time,
          room: formData.room || null,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
        })
        .eq("id", schedule.id);

      if (error) throw error;

      toast({
        title: "Schedule Updated",
        description: "The schedule has been updated successfully.",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Schedule</DialogTitle>
          <DialogDescription>
            Update the schedule details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="day">Day of Week</Label>
            <Select
              value={formData.day_of_week}
              onValueChange={(value) =>
                setFormData({ ...formData, day_of_week: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="room">Room</Label>
            <Input
              id="room"
              value={formData.room}
              onChange={(e) =>
                setFormData({ ...formData, room: e.target.value })
              }
              placeholder="e.g., Room 101"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="end_date">End Date (Optional)</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
              />
            </div>
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