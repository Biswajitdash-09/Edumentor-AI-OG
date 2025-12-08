import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface EmailPreferences {
  email_assignments: boolean;
  email_grades: boolean;
  email_announcements: boolean;
  email_attendance: boolean;
  email_digest: boolean;
}

export function EmailPreferencesDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    email_assignments: true,
    email_grades: true,
    email_announcements: true,
    email_attendance: true,
    email_digest: false,
  });

  useEffect(() => {
    if (open && user) {
      fetchPreferences();
    }
  }, [open, user]);

  const fetchPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          email_assignments: data.email_assignments,
          email_grades: data.email_grades,
          email_announcements: data.email_announcements,
          email_attendance: data.email_attendance,
          email_digest: data.email_digest,
        });
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...preferences,
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;

      toast({
        title: "Preferences Saved",
        description: "Your email notification preferences have been updated.",
      });
      setOpen(false);
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof EmailPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const preferencesConfig = [
    {
      key: "email_assignments" as const,
      label: "Assignment Notifications",
      description: "Get notified when new assignments are posted or due soon",
    },
    {
      key: "email_grades" as const,
      label: "Grade Notifications",
      description: "Get notified when assignments are graded",
    },
    {
      key: "email_announcements" as const,
      label: "Announcement Notifications",
      description: "Get notified about new course announcements",
    },
    {
      key: "email_attendance" as const,
      label: "Attendance Notifications",
      description: "Get notified about attendance sessions and records",
    },
    {
      key: "email_digest" as const,
      label: "Daily Digest",
      description: "Receive a daily summary instead of individual notifications",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Email Preferences
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Email Notification Preferences</DialogTitle>
          <DialogDescription>
            Choose which email notifications you'd like to receive.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {loading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : (
            preferencesConfig.map((pref) => (
              <div key={pref.key} className="flex items-center justify-between space-x-4">
                <div className="flex-1">
                  <Label htmlFor={pref.key} className="font-medium">
                    {pref.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {pref.description}
                  </p>
                </div>
                <Switch
                  id={pref.key}
                  checked={preferences[pref.key]}
                  onCheckedChange={() => handleToggle(pref.key)}
                />
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
