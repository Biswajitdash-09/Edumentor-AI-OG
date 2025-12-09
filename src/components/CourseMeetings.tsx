import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Video, Plus, ExternalLink, Calendar, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  meeting_url: string;
  meeting_type: string;
  scheduled_at: string | null;
  duration_minutes: number;
  description: string | null;
  is_recurring: boolean;
}

interface CourseMeetingsProps {
  courseId: string;
}

export default function CourseMeetings({ courseId }: CourseMeetingsProps) {
  const { user } = useAuth();
  const { isFaculty } = useRole();
  const { toast } = useToast();
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    meeting_url: "",
    meeting_type: "zoom",
    scheduled_at: "",
    duration_minutes: 60,
    description: "",
    is_recurring: false
  });

  useEffect(() => {
    fetchMeetings();
  }, [courseId]);

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from("course_meetings")
        .select("*")
        .eq("course_id", courseId)
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.meeting_url.trim()) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from("course_meetings")
        .insert({
          course_id: courseId,
          created_by: user?.id,
          title: formData.title,
          meeting_url: formData.meeting_url,
          meeting_type: formData.meeting_type,
          scheduled_at: formData.scheduled_at || null,
          duration_minutes: formData.duration_minutes,
          description: formData.description || null,
          is_recurring: formData.is_recurring
        });

      if (error) throw error;

      toast({ title: "Success", description: "Meeting link added" });
      setFormData({
        title: "",
        meeting_url: "",
        meeting_type: "zoom",
        scheduled_at: "",
        duration_minutes: 60,
        description: "",
        is_recurring: false
      });
      setDialogOpen(false);
      fetchMeetings();
    } catch (error) {
      console.error("Error adding meeting:", error);
      toast({ title: "Error", description: "Failed to add meeting", variant: "destructive" });
    }
  };

  const handleDelete = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from("course_meetings")
        .delete()
        .eq("id", meetingId);

      if (error) throw error;

      toast({ title: "Success", description: "Meeting deleted" });
      fetchMeetings();
    } catch (error) {
      console.error("Error deleting meeting:", error);
      toast({ title: "Error", description: "Failed to delete meeting", variant: "destructive" });
    }
  };

  const getMeetingTypeColor = (type: string) => {
    switch (type) {
      case "zoom": return "bg-blue-500";
      case "meet": return "bg-green-500";
      case "teams": return "bg-purple-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Meetings
          </CardTitle>
          <CardDescription>Join virtual class sessions</CardDescription>
        </div>
        {isFaculty && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Meeting
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Meeting Link</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Meeting Title *</Label>
                  <Input
                    placeholder="e.g., Weekly Lecture"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meeting URL *</Label>
                  <Input
                    placeholder="https://zoom.us/j/..."
                    value={formData.meeting_url}
                    onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select
                      value={formData.meeting_type}
                      onValueChange={(v) => setFormData({ ...formData, meeting_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zoom">Zoom</SelectItem>
                        <SelectItem value="meet">Google Meet</SelectItem>
                        <SelectItem value="teams">Microsoft Teams</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Scheduled Time (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="Meeting details..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="recurring">Recurring meeting</Label>
                </div>
                <Button type="submit" className="w-full">Add Meeting</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-4">Loading...</p>
        ) : meetings.length > 0 ? (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${getMeetingTypeColor(meeting.meeting_type)}`} />
                  <div>
                    <p className="font-medium">{meeting.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {meeting.meeting_type.toUpperCase()}
                      </Badge>
                      {meeting.is_recurring && <Badge variant="secondary" className="text-xs">Recurring</Badge>}
                      {meeting.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(meeting.scheduled_at), "MMM d, h:mm a")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {meeting.duration_minutes} min
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" asChild>
                    <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Join
                    </a>
                  </Button>
                  {isFaculty && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(meeting.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No meeting links available</p>
        )}
      </CardContent>
    </Card>
  );
}