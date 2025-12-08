import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, BookOpen, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface GradeEntry {
  assignment_id: string;
  assignment_title: string;
  course_title: string;
  course_code: string;
  grade: number;
  max_points: number;
  graded_at: string;
  feedback: string | null;
}

interface CourseGrades {
  course_id: string;
  course_title: string;
  course_code: string;
  grades: GradeEntry[];
  average: number;
}

const Grades = () => {
  const { user } = useAuth();
  const [courseGrades, setCourseGrades] = useState<CourseGrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallGPA, setOverallGPA] = useState<number>(0);

  useEffect(() => {
    if (user) {
      fetchGrades();
    }
  }, [user]);

  const fetchGrades = async () => {
    const { data: submissions, error } = await supabase
      .from("submissions")
      .select(`
        grade,
        graded_at,
        feedback,
        assignments!inner(
          id,
          title,
          max_points,
          courses!inner(
            id,
            title,
            code
          )
        )
      `)
      .eq("student_id", user?.id)
      .not("grade", "is", null)
      .order("graded_at", { ascending: false });

    if (error) {
      console.error("Error fetching grades:", error);
      setLoading(false);
      return;
    }

    // Group grades by course
    const courseMap = new Map<string, CourseGrades>();
    
    submissions?.forEach((sub: any) => {
      const courseId = sub.assignments.courses.id;
      const entry: GradeEntry = {
        assignment_id: sub.assignments.id,
        assignment_title: sub.assignments.title,
        course_title: sub.assignments.courses.title,
        course_code: sub.assignments.courses.code,
        grade: sub.grade,
        max_points: sub.assignments.max_points,
        graded_at: sub.graded_at,
        feedback: sub.feedback,
      };

      if (!courseMap.has(courseId)) {
        courseMap.set(courseId, {
          course_id: courseId,
          course_title: sub.assignments.courses.title,
          course_code: sub.assignments.courses.code,
          grades: [],
          average: 0,
        });
      }
      courseMap.get(courseId)!.grades.push(entry);
    });

    // Calculate averages
    const coursesWithAvg = Array.from(courseMap.values()).map((course) => {
      const totalPercent = course.grades.reduce(
        (sum, g) => sum + (g.grade / g.max_points) * 100,
        0
      );
      course.average = course.grades.length > 0 ? totalPercent / course.grades.length : 0;
      return course;
    });

    setCourseGrades(coursesWithAvg);

    // Calculate overall GPA (4.0 scale)
    if (coursesWithAvg.length > 0) {
      const avgPercent =
        coursesWithAvg.reduce((sum, c) => sum + c.average, 0) / coursesWithAvg.length;
      // Convert percentage to 4.0 scale
      const gpa = (avgPercent / 100) * 4.0;
      setOverallGPA(Math.round(gpa * 100) / 100);
    }

    setLoading(false);
  };

  const getGradeColor = (percent: number) => {
    if (percent >= 90) return "text-green-600";
    if (percent >= 80) return "text-blue-600";
    if (percent >= 70) return "text-yellow-600";
    if (percent >= 60) return "text-orange-600";
    return "text-red-600";
  };

  const getLetterGrade = (percent: number) => {
    if (percent >= 93) return "A";
    if (percent >= 90) return "A-";
    if (percent >= 87) return "B+";
    if (percent >= 83) return "B";
    if (percent >= 80) return "B-";
    if (percent >= 77) return "C+";
    if (percent >= 73) return "C";
    if (percent >= 70) return "C-";
    if (percent >= 67) return "D+";
    if (percent >= 63) return "D";
    if (percent >= 60) return "D-";
    return "F";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading grades...</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalAssignments = courseGrades.reduce((sum, c) => sum + c.grades.length, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Grade Report</h1>
          <p className="text-muted-foreground">View your academic performance across all courses</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall GPA</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallGPA.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Out of 4.0</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courseGrades.length}</div>
              <p className="text-xs text-muted-foreground">With graded work</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Graded Assignments</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssignments}</div>
              <p className="text-xs text-muted-foreground">Total completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Course Grades */}
        {courseGrades.length === 0 ? (
          <Card className="p-12 text-center">
            <Award className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No graded assignments yet</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {courseGrades.map((course) => (
              <Card key={course.course_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{course.course_title}</CardTitle>
                      <CardDescription>{course.course_code}</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getGradeColor(course.average)}`}>
                        {getLetterGrade(course.average)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {course.average.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <Progress value={course.average} className="mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {course.grades.map((grade) => {
                      const percent = (grade.grade / grade.max_points) * 100;
                      return (
                        <div
                          key={grade.assignment_id}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <div>
                            <p className="font-medium">{grade.assignment_title}</p>
                            <p className="text-xs text-muted-foreground">
                              Graded: {format(new Date(grade.graded_at), "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={getGradeColor(percent)}>
                              {grade.grade}/{grade.max_points}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {percent.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Grades;
