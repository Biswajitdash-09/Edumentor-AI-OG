import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Calendar, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCourses, useEnrollMutation, useEnrollments } from "@/hooks/useQueryHelpers";
import { Skeleton } from "@/components/ui/skeleton";
import { EditCourseDialog } from "@/components/EditCourseDialog";
import { DeleteCourseDialog } from "@/components/DeleteCourseDialog";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  semester: string;
  year: number;
  faculty_id: string;
  profiles: {
    full_name: string;
  };
  enrollments?: { count: number }[];
}

const Courses = () => {
  const [userRole, setUserRole] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<{ id: string; title: string } | null>(null);
  const [newCourse, setNewCourse] = useState({
    code: "",
    title: "",
    description: "",
    semester: "Fall",
    year: new Date().getFullYear()
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // React Query hooks
  const { data: courses = [], isLoading: coursesLoading, refetch: refetchCourses } = useCourses();
  const { data: enrollments = [] } = useEnrollments(user?.id);
  const enrollMutation = useEnrollMutation();

  const enrolledCourseIds = enrollments.map(e => e.course_id);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    }
  }, [user]);

  // Re-render when courses or role change to ensure UI updates
  useEffect(() => {
    // This ensures the Create Course button shows after role is fetched
  }, [userRole]);

  const fetchUserRole = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user?.id)
      .single();
    
    if (data) setUserRole(data.role);
  };

  const handleCreateCourse = async () => {
    if (!newCourse.code || !newCourse.title) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("courses")
      .insert([{
        ...newCourse,
        faculty_id: user?.id
      }]);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Course created successfully"
      });
      setIsCreateDialogOpen(false);
      setNewCourse({
        code: "",
        title: "",
        description: "",
        semester: "Fall",
        year: new Date().getFullYear()
      });
      refetchCourses();
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user?.id) return;
    enrollMutation.mutate({ courseId, studentId: user.id });
  };

  if (coursesLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Courses</h1>
            <p className="text-muted-foreground">Browse and manage courses</p>
          </div>
          {userRole === "faculty" && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Course
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Course</DialogTitle>
                  <DialogDescription>Add a new course to the system</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="code">Course Code *</Label>
                    <Input
                      id="code"
                      value={newCourse.code}
                      onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                      placeholder="e.g., CS101"
                    />
                  </div>
                  <div>
                    <Label htmlFor="title">Course Title *</Label>
                    <Input
                      id="title"
                      value={newCourse.title}
                      onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                      placeholder="e.g., Introduction to Computer Science"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newCourse.description}
                      onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                      placeholder="Course description..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="semester">Semester</Label>
                      <Input
                        id="semester"
                        value={newCourse.semester}
                        onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        value={newCourse.year}
                        onChange={(e) => setNewCourse({ ...newCourse, year: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateCourse}>Create Course</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <BookOpen className="w-8 h-8 text-primary" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded">
                      {course.code}
                    </span>
                    {userRole === "faculty" && course.faculty_id === user?.id && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditCourse(course);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteCourse({ id: course.id, title: course.title });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <CardTitle className="mt-4">{course.title}</CardTitle>
                <CardDescription>{course.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Instructor: {course.profiles?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{course.semester} {course.year}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button 
                    onClick={() => navigate(`/courses/${course.id}`)}
                    className="flex-1"
                  >
                    View Details
                  </Button>
                  {userRole === "student" && (
                    enrolledCourseIds.includes(course.id) ? (
                      <Button 
                        variant="outline"
                        disabled
                      >
                        Enrolled
                      </Button>
                    ) : (
                      <Button 
                        variant="outline"
                        onClick={() => handleEnroll(course.id)}
                      >
                        Enroll
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {editCourse && (
          <EditCourseDialog
            course={editCourse}
            open={!!editCourse}
            onOpenChange={(open) => !open && setEditCourse(null)}
            onSuccess={refetchCourses}
          />
        )}

        {deleteCourse && (
          <DeleteCourseDialog
            courseId={deleteCourse.id}
            courseTitle={deleteCourse.title}
            open={!!deleteCourse}
            onOpenChange={(open) => !open && setDeleteCourse(null)}
            onSuccess={refetchCourses}
          />
        )}

        {courses.length === 0 && (
          <Card className="p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
            <p className="text-muted-foreground">
              {userRole === "faculty" 
                ? "Create your first course to get started" 
                : "No courses are available at this time"}
            </p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Courses;