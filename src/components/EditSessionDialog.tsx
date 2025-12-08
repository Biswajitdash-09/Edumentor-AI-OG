import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  geofence_radius: number;
  expires_at: string;
}

interface EditSessionDialogProps {
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditSessionDialog = ({ session, open, onOpenChange, onSuccess }: EditSessionDialogProps) => {
  const [editedSession, setEditedSession] = useState({
    session_date: session.session_date,
    session_time: session.session_time,
    geofence_radius: session.geofence_radius
  });
  const { toast } = useToast();

  const handleUpdate = async () => {
    const { error } = await supabase
      .from("attendance_sessions")
      .update({
        session_date: editedSession.session_date,
        session_time: editedSession.session_time,
        geofence_radius: editedSession.geofence_radius
      })
      .eq("id", session.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Session updated successfully"
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Attendance Session</DialogTitle>
          <DialogDescription>Update session details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={editedSession.session_date}
                onChange={(e) => setEditedSession({ ...editedSession, session_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={editedSession.session_time}
                onChange={(e) => setEditedSession({ ...editedSession, session_time: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="radius">Geofence Radius (m)</Label>
            <Input
              id="radius"
              type="number"
              value={editedSession.geofence_radius}
              onChange={(e) => setEditedSession({ ...editedSession, geofence_radius: parseInt(e.target.value) })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpdate}>Update Session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};