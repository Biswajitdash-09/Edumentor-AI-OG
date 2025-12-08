import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Shield, Calendar, Save, Loader2, Lock, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EmailPreferencesDialog } from "@/components/EmailPreferencesDialog";
import { SEOHead } from "@/components/SEOHead";

const ChangePasswordCard = () => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Password updated successfully"
      });
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
        </div>
        <Button onClick={handleChangePassword} disabled={changingPassword}>
          {changingPassword ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Update Password
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    created_at: ""
  });
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUserRole();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, created_at")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          email: data.email || user?.email || "",
          created_at: data.created_at
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRole = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user?.id)
      .single();
    
    if (data) setUserRole(data.role);
  };

  const handleUpdateProfile = async () => {
    if (!profile.full_name.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: profile.full_name.trim() })
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "faculty":
        return "default";
      case "student":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEOHead 
        title="Profile Settings" 
        description="Manage your EduMentor AI account settings, profile information, and notification preferences."
      />
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account information</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <Button onClick={handleUpdateProfile} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Account Details
            </CardTitle>
            <CardDescription>Your account information and role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Account Role</p>
                <p className="text-xs text-muted-foreground">Your access level in the system</p>
              </div>
              <Badge variant={getRoleBadgeVariant(userRole)}>
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </Badge>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Member Since</p>
                <p className="text-xs text-muted-foreground">When you joined EduMentor AI</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {profile.created_at ? format(new Date(profile.created_at), "MMM d, yyyy") : "N/A"}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">User ID</p>
                <p className="text-xs text-muted-foreground">Your unique identifier</p>
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {user?.id?.slice(0, 8)}...
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Manage your email notification settings</CardDescription>
          </CardHeader>
          <CardContent>
            <EmailPreferencesDialog />
          </CardContent>
        </Card>

        <ChangePasswordCard />
      </div>
    </DashboardLayout>
  );
};

export default Profile;