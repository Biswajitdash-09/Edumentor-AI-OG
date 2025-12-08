import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, BookOpen, Building2, TrendingUp, UserPlus, Settings, GraduationCap, ClipboardList, BarChart3, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SEOHead } from "@/components/SEOHead";

interface SystemStats {
  totalStudents: number;
  facultyMembers: number;
  activeCourses: number;
  totalEnrollments: number;
}

interface RecentActivity {
  action: string;
  user: string;
  time: string;
}

interface UserInfo {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats>({
    totalStudents: 0,
    facultyMembers: 0,
    activeCourses: 0,
    totalEnrollments: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [roleChangeDialog, setRoleChangeDialog] = useState<{ user: UserInfo; newRole: string } | null>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Fetch data when user is available
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch total students
      const { count: studentsCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student");

      // Fetch faculty members
      const { count: facultyCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "faculty");

      // Fetch active courses
      const { count: coursesCount } = await supabase
        .from("courses")
        .select("*", { count: "exact", head: true });

      // Fetch total enrollments
      const { count: enrollmentsCount } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Fetch all users with their roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map((r) => r.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, id")
          .in("user_id", userIds);

        const usersWithRoles = rolesData.map((roleInfo) => {
          const profile = profilesData?.find((p) => p.user_id === roleInfo.user_id);
          return {
            id: profile?.id || roleInfo.user_id,
            user_id: roleInfo.user_id,
            full_name: profile?.full_name || "Unknown",
            email: profile?.email || "N/A",
            role: roleInfo.role,
            created_at: roleInfo.created_at,
          };
        });

        setUsers(usersWithRoles);
      }

      // Fetch recent profiles (as activities)
      const { data: recentProfiles } = await supabase
        .from("profiles")
        .select("full_name, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(5);

      const activities = await Promise.all(
        (recentProfiles || []).map(async (profile) => {
          const { data: role } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.user_id)
            .single();

          const now = new Date();
          const created = new Date(profile.created_at);
          const diffHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
          
          let timeStr = "";
          if (diffHours < 1) timeStr = "Just now";
          else if (diffHours < 24) timeStr = `${diffHours} hours ago`;
          else timeStr = `${Math.floor(diffHours / 24)} days ago`;

          return {
            action: `New ${role?.role || "user"} registered`,
            user: profile.full_name,
            time: timeStr,
          };
        })
      );

      setRecentActivities(activities);

      setStats({
        totalStudents: studentsCount || 0,
        facultyMembers: facultyCount || 0,
        activeCourses: coursesCount || 0,
        totalEnrollments: enrollmentsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while fetching auth
  if (authLoading) {
    return null; // ProtectedRoute handles the loading spinner
  }

  const systemStats = [
    { label: "Total Students", value: stats.totalStudents.toString(), icon: GraduationCap, color: "text-primary" },
    { label: "Faculty Members", value: stats.facultyMembers.toString(), icon: Users, color: "text-primary" },
    { label: "Active Courses", value: stats.activeCourses.toString(), icon: BookOpen, color: "text-primary" },
    { label: "Total Enrollments", value: stats.totalEnrollments.toString(), icon: ClipboardList, color: "text-primary" },
  ];

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

  const handleRoleChange = (user: UserInfo, newRole: string) => {
    if (newRole === user.role) return;
    setRoleChangeDialog({ user, newRole });
  };

  const confirmRoleChange = async () => {
    if (!roleChangeDialog) return;

    setIsChangingRole(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: roleChangeDialog.newRole as any })
        .eq("user_id", roleChangeDialog.user.user_id);

      if (error) throw error;

      toast({
        title: "Role Updated",
        description: `${roleChangeDialog.user.full_name}'s role changed to ${roleChangeDialog.newRole}`,
      });

      // Refresh users list
      fetchDashboardData();
    } catch (error) {
      console.error("Error changing role:", error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setIsChangingRole(false);
      setRoleChangeDialog(null);
    }
  };

  return (
    <DashboardLayout role="admin">
      <SEOHead 
        title="Admin Dashboard" 
        description="Manage users, courses, and oversee your institution's operations."
      />
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Oversee and manage your institution's operations.</p>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {systemStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="p-6">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold mt-2">{stat.value}</p>
                    </div>
                    <Icon className={`w-12 h-12 ${stat.color}`} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button className="h-24 flex-col gap-2" onClick={() => navigate("/courses")}>
            <BookOpen className="w-6 h-6" />
            Manage Courses
          </Button>
          <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => navigate("/attendance")}>
            <ClipboardList className="w-6 h-6" />
            Attendance
          </Button>
          <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => navigate("/analytics")}>
            <BarChart3 className="w-6 h-6" />
            Analytics
          </Button>
          <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => navigate("/announcements")}>
            <Building2 className="w-6 h-6" />
            Announcements
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* User Management */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                User Management
              </h2>
            </div>
            <div className="overflow-auto max-h-[400px]">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userInfo) => (
                      <TableRow key={userInfo.id}>
                        <TableCell className="font-medium">{userInfo.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{userInfo.email}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(userInfo.role)}>
                            {userInfo.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={userInfo.role}
                            onValueChange={(value) => handleRoleChange(userInfo, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="faculty">Faculty</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              )}
            </div>
          </Card>

          {/* Recent Activities */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Recent Activities
              </h2>
            </div>
            <div className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <div key={index} className="pb-4 border-b border-border last:border-0">
                    <h3 className="font-medium">{activity.action}</h3>
                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                      <span>{activity.user}</span>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activities</p>
              )}
            </div>
          </Card>
        </div>

        {/* System Health */}
        <Card className="p-8 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">System Overview</h2>
              <p className="text-muted-foreground">View detailed analytics and reports for your institution.</p>
            </div>
            <Button size="lg" onClick={() => navigate("/analytics")}>
              <BarChart3 className="w-5 h-5 mr-2" />
              View Analytics
            </Button>
          </div>
        </Card>

        {/* Role Change Confirmation Dialog */}
        <Dialog open={!!roleChangeDialog} onOpenChange={() => setRoleChangeDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Role Change</DialogTitle>
              <DialogDescription>
                Are you sure you want to change {roleChangeDialog?.user.full_name}'s role from{" "}
                <Badge variant={getRoleBadgeVariant(roleChangeDialog?.user.role || "")} className="mx-1">
                  {roleChangeDialog?.user.role}
                </Badge>{" "}
                to{" "}
                <Badge variant={getRoleBadgeVariant(roleChangeDialog?.newRole || "")} className="mx-1">
                  {roleChangeDialog?.newRole}
                </Badge>
                ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleChangeDialog(null)}>
                Cancel
              </Button>
              <Button onClick={confirmRoleChange} disabled={isChangingRole}>
                {isChangingRole ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
