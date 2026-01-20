import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateAnnouncementDialog } from "@/components/CreateAnnouncementDialog";
import { EditAnnouncementDialog } from "@/components/EditAnnouncementDialog";
import { PaginationControls } from "@/components/PaginationControls";
import { Plus, Megaphone, Pin, MoreVertical, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ANNOUNCEMENTS_PER_PAGE = 10;

interface EditAnnouncement {
  id: string;
  title: string;
  content: string;
  course_id: string | null;
  is_pinned: boolean;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  published_at: string;
  course_id: string | null;
  courses: { code: string; title: string } | null;
}

interface Course {
  id: string;
  code: string;
  title: string;
}

const Announcements = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<EditAnnouncement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination
  const totalPages = Math.ceil(announcements.length / ANNOUNCEMENTS_PER_PAGE);
  const paginatedAnnouncements = announcements.slice(
    (currentPage - 1) * ANNOUNCEMENTS_PER_PAGE,
    currentPage * ANNOUNCEMENTS_PER_PAGE
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUserRole();
      fetchAnnouncements();
      fetchCourses();
    }
  }, [user]);

  const fetchUserRole = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .single();
    
    if (data) {
      setUserRole(data.role);
    }
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select(`
          id,
          title,
          content,
          is_pinned,
          published_at,
          course_id,
          courses(code, title)
        `)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    const { data } = await supabase
      .from("courses")
      .select("id, code, title")
      .eq("faculty_id", user!.id)
      .eq("status", "active");

    if (data) {
      setCourses(data);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Announcement has been deleted.",
      });

      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    try {
      const { error } = await supabase
        .from("announcements")
        .update({ is_pinned: !currentPinned })
        .eq("id", id);

      if (error) throw error;
      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (authLoading || !user) {
    return null;
  }

  const isFaculty = userRole === "faculty";

  return (
    <DashboardLayout role={isFaculty ? "faculty" : "student"}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-muted-foreground">
              {isFaculty ? "Manage your course announcements" : "View course announcements"}
            </p>
          </div>
          {isFaculty && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <Card className="p-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Announcements</h3>
            <p className="text-muted-foreground mb-4">
              {isFaculty
                ? "Create your first announcement to keep students informed."
                : "No announcements have been posted yet."}
            </p>
            {isFaculty && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Announcement
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {paginatedAnnouncements.map((announcement) => (
              <Card key={announcement.id} className={announcement.is_pinned ? "border-primary" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {announcement.is_pinned && (
                        <Pin className="h-4 w-4 text-primary" />
                      )}
                      <CardTitle className="text-lg">{announcement.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {announcement.courses && (
                        <Badge variant="outline">
                          {announcement.courses.code}
                        </Badge>
                      )}
                      {isFaculty && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border shadow-lg">
                            <DropdownMenuItem
                              onClick={() => setEditAnnouncement({
                                id: announcement.id,
                                title: announcement.title,
                                content: announcement.content,
                                course_id: announcement.course_id,
                                is_pinned: announcement.is_pinned,
                              })}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => togglePin(announcement.id, announcement.is_pinned)}
                            >
                              <Pin className="h-4 w-4 mr-2" />
                              {announcement.is_pinned ? "Unpin" : "Pin"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(announcement.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                  <p className="text-sm text-muted-foreground mt-4">
                    Published {format(new Date(announcement.published_at), "PPp")}
                  </p>
                </CardContent>
              </Card>
            ))}

            {announcements.length > ANNOUNCEMENTS_PER_PAGE && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={announcements.length}
                itemsPerPage={ANNOUNCEMENTS_PER_PAGE}
              />
            )}
          </div>
        )}
      </div>

      <CreateAnnouncementDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchAnnouncements}
        courses={courses}
      />

      <EditAnnouncementDialog
        announcement={editAnnouncement}
        courses={courses}
        open={!!editAnnouncement}
        onOpenChange={(open) => !open && setEditAnnouncement(null)}
        onSuccess={fetchAnnouncements}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The announcement will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Announcements;
