import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BookOpen, Building2, TrendingUp, UserPlus, Settings, GraduationCap, ClipboardList, BarChart3, RefreshCw, History, Search, UserCog, Edit, UserX, UserCheck, Activity } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SEOHead } from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import AuditLogViewer from "@/components/AuditLogViewer";
import { UserEditDialog } from "@/components/UserEditDialog";
import { PaginationControls } from "@/components/PaginationControls";
import { ParentVerificationTab } from "@/components/ParentVerificationTab";
import { BulkUserImport } from "@/components/BulkUserImport";
import { UserExport } from "@/components/UserExport";
import SystemHealthCard from "@/components/SystemHealthCard";

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
  department?: string;
  phone?: string;
  is_active?: boolean;
}

const USERS_PER_PAGE = 10;

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
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [roleChangeDialog, setRoleChangeDialog] = useState<{ user: UserInfo; newRole: string } | null>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [editUser, setEditUser] = useState<UserInfo | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserInfo | null>(null);

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

      // Fetch all users with their roles - with pagination info
      const { data: rolesData, count: rolesCount } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at", { count: "exact" })
        .order("created_at", { ascending: false });

      setTotalUsers(rolesCount || 0);

      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map((r) => r.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, id, department, phone")
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
            department: profile?.department || "",
            phone: profile?.phone || "",
            is_active: true,
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
      case "parent":
        return "outline";
      default:
        return "outline";
    }
  };

  const handleRoleChange = (user: UserInfo, newRole: string) => {
    if (newRole === user.role) return;
    setRoleChangeDialog({ user, newRole });
  };

  // Filter users based on search and role filter
  const filteredUsers = users.filter((userInfo) => {
    const matchesSearch = !userSearchTerm || 
      userInfo.full_name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      userInfo.email.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || userInfo.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Paginate filtered users
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [userSearchTerm, roleFilter]);

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

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="parents">Parents</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
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
              {/* Recent Users */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Recent Users
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("users")}>
                    View All
                  </Button>
                </div>
                <div className="overflow-auto max-h-[300px]">
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : users.slice(0, 5).length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.slice(0, 5).map((userInfo) => (
                          <TableRow key={userInfo.id}>
                            <TableCell className="font-medium">{userInfo.full_name}</TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(userInfo.role)}>
                                {userInfo.role}
                              </Badge>
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
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-primary" />
                  User Role Management
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <BulkUserImport onSuccess={fetchDashboardData} />
                  <UserExport />
                  <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                    <SelectItem value="parent">Parents</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <div className="overflow-auto max-h-[600px]">
                  {loading ? (
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : paginatedUsers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Change Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((userInfo) => (
                          <TableRow key={userInfo.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{userInfo.full_name}</p>
                                <p className="text-xs text-muted-foreground md:hidden">{userInfo.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{userInfo.email}</TableCell>
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
                                <SelectTrigger className="w-28 sm:w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="student">Student</SelectItem>
                                  <SelectItem value="faculty">Faculty</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="parent">Parent</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditUser(userInfo)}
                                  title="Edit user"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeactivateUser(userInfo)}
                                  title="Deactivate user"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No users found matching your criteria</p>
                    </div>
                  )}
                </div>
              </div>

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredUsers.length}
                itemsPerPage={USERS_PER_PAGE}
              />
            </Card>
          </TabsContent>

          {/* Parent Verification Tab */}
          <TabsContent value="parents">
            <ParentVerificationTab />
          </TabsContent>

          {/* System Health Tab */}
          <TabsContent value="health">
            <SystemHealthCard />
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <AuditLogViewer />
          </TabsContent>
        </Tabs>

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

        {/* User Edit Dialog */}
        <UserEditDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
          onSuccess={fetchDashboardData}
        />

        {/* Deactivate User Confirmation */}
        <AlertDialog open={!!deactivateUser} onOpenChange={() => setDeactivateUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to deactivate {deactivateUser?.full_name}'s account? 
                They will no longer be able to access the system. This action can be reversed by an administrator.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deactivateUser) return;
                  try {
                    // Delete the user's role (effectively deactivating them)
                    const { error } = await supabase
                      .from("user_roles")
                      .delete()
                      .eq("user_id", deactivateUser.user_id);

                    if (error) throw error;

                    toast({
                      title: "User Deactivated",
                      description: `${deactivateUser.full_name}'s account has been deactivated.`,
                    });

                    fetchDashboardData();
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to deactivate user",
                      variant: "destructive",
                    });
                  } finally {
                    setDeactivateUser(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
