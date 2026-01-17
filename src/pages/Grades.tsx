import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award, BookOpen, TrendingUp, RefreshCw, FileQuestion, Save, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useToast } from "@/hooks/use-toast";
import { LoadingStats, LoadingCard } from "@/components/ui/loading-card";
import { EmptyState } from "@/components/ui/empty-state";

interface GradeEntry {
  assignment_id: string;
  assignment_title: string;
  course_title: string;
  course_code: string;
  grade: number;
  max_points: number;
  graded_at: string;
  feedback: string | null;
  semester: number;
}

interface SemesterGrades {
  semester: number;
  courses: {
    course_id: string;
    course_title: string;
    course_code: string;
    grades: GradeEntry[];
    average: number;
  }[];
  cgpa: number | null;
  manualCgpa: number | null;
}

interface ManualCgpa {
  semester: number;
  cgpa: number;
}

const Grades = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [semesterGrades, setSemesterGrades] = useState<SemesterGrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallCGPA, setOverallCGPA] = useState<number>(0);
  const [hasNewGrades, setHasNewGrades] = useState(false);
  const [editingSemester, setEditingSemester] = useState<number | null>(null);
  const [cgpaInput, setCgpaInput] = useState<string>("");
  const [savingCgpa, setSavingCgpa] = useState(false);
  const [manualCgpaRecords, setManualCgpaRecords] = useState<ManualCgpa[]>([]);

  const fetchManualCgpa = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("student_cgpa")
      .select("semester, cgpa")
      .eq("student_id", user.id);
    
    if (!error && data) {
      setManualCgpaRecords(data.map(d => ({ semester: d.semester, cgpa: Number(d.cgpa) })));
    }
  }, [user]);

  const fetchGrades = useCallback(async () => {
    if (!user) return;
    
    setHasNewGrades(false);
    
    // Fetch grades
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
            code,
            semester,
            year
          )
        )
      `)
      .eq("student_id", user.id)
      .not("grade", "is", null)
      .order("graded_at", { ascending: false });

    if (error) {
      console.error("Error fetching grades:", error);
      setLoading(false);
      return;
    }

    // Extract semester from course data or use default mapping
    const getSemesterNumber = (semester: string, year: number): number => {
      const semLower = semester.toLowerCase();
      const baseYear = 2024; // Assume starting year
      const yearDiff = year - baseYear;
      
      if (semLower.includes("fall") || semLower.includes("odd")) {
        return Math.min(8, Math.max(1, yearDiff * 2 + 1));
      } else if (semLower.includes("spring") || semLower.includes("even")) {
        return Math.min(8, Math.max(1, yearDiff * 2 + 2));
      }
      
      // Try to extract number from semester string
      const match = semester.match(/\d+/);
      if (match) {
        return Math.min(8, Math.max(1, parseInt(match[0])));
      }
      
      return 1;
    };

    // Group grades by semester then by course
    const semesterMap = new Map<number, Map<string, any>>();
    
    submissions?.forEach((sub: any) => {
      const courseId = sub.assignments.courses.id;
      const semesterNum = getSemesterNumber(sub.assignments.courses.semester, sub.assignments.courses.year);
      
      const entry: GradeEntry = {
        assignment_id: sub.assignments.id,
        assignment_title: sub.assignments.title,
        course_title: sub.assignments.courses.title,
        course_code: sub.assignments.courses.code,
        grade: sub.grade,
        max_points: sub.assignments.max_points,
        graded_at: sub.graded_at,
        feedback: sub.feedback,
        semester: semesterNum,
      };

      if (!semesterMap.has(semesterNum)) {
        semesterMap.set(semesterNum, new Map());
      }
      
      const courseMap = semesterMap.get(semesterNum)!;
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

    // Convert to array and calculate averages
    const semestersWithGrades: SemesterGrades[] = [];
    
    for (let sem = 1; sem <= 8; sem++) {
      const courseMap = semesterMap.get(sem);
      const manualRecord = manualCgpaRecords.find(r => r.semester === sem);
      
      if (courseMap && courseMap.size > 0) {
        const courses = Array.from(courseMap.values()).map((course) => {
          const totalPercent = course.grades.reduce(
            (sum: number, g: GradeEntry) => sum + (g.grade / g.max_points) * 100,
            0
          );
          course.average = course.grades.length > 0 ? totalPercent / course.grades.length : 0;
          return course;
        });

        // Calculate semester CGPA (10-point scale)
        const avgPercent = courses.reduce((sum, c) => sum + c.average, 0) / courses.length;
        const calculatedCgpa = (avgPercent / 100) * 10;

        semestersWithGrades.push({
          semester: sem,
          courses,
          cgpa: Math.round(calculatedCgpa * 100) / 100,
          manualCgpa: manualRecord?.cgpa || null,
        });
      } else if (manualRecord) {
        // Semester with only manual CGPA
        semestersWithGrades.push({
          semester: sem,
          courses: [],
          cgpa: null,
          manualCgpa: manualRecord.cgpa,
        });
      }
    }

    setSemesterGrades(semestersWithGrades);

    // Calculate overall CGPA (10-point scale)
    const allCgpas = semestersWithGrades
      .map(s => s.manualCgpa || s.cgpa)
      .filter((c): c is number => c !== null);
    
    if (allCgpas.length > 0) {
      const avgCgpa = allCgpas.reduce((a, b) => a + b, 0) / allCgpas.length;
      setOverallCGPA(Math.round(avgCgpa * 100) / 100);
    }

    setLoading(false);
  }, [user, manualCgpaRecords]);

  // Subscribe to real-time grade updates
  useRealtimeSubscription(
    [
      {
        table: "submissions",
        event: "UPDATE",
        filter: `student_id=eq.${user?.id}`,
        onData: (payload) => {
          if (payload.new?.grade !== null && payload.old?.grade === null) {
            setHasNewGrades(true);
            toast({
              title: "New Grade Available",
              description: "Your submission has been graded! Click refresh to see the update.",
            });
          }
        },
      },
    ],
    !!user
  );

  useEffect(() => {
    if (user) {
      fetchManualCgpa();
    }
  }, [user, fetchManualCgpa]);

  useEffect(() => {
    if (user && manualCgpaRecords !== undefined) {
      fetchGrades();
    }
  }, [user, fetchGrades, manualCgpaRecords]);

  const handleSaveCgpa = async (semester: number) => {
    if (!user) return;
    
    const cgpaValue = parseFloat(cgpaInput);
    if (isNaN(cgpaValue) || cgpaValue < 0 || cgpaValue > 10) {
      toast({
        title: "Invalid CGPA",
        description: "Please enter a value between 0 and 10",
        variant: "destructive",
      });
      return;
    }

    setSavingCgpa(true);
    
    const { error } = await supabase
      .from("student_cgpa")
      .upsert({
        student_id: user.id,
        semester,
        cgpa: cgpaValue,
      }, {
        onConflict: "student_id,semester"
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save CGPA",
        variant: "destructive",
      });
    } else {
      toast({
        title: "CGPA Saved",
        description: `Semester ${semester} CGPA updated to ${cgpaValue.toFixed(2)}`,
      });
      setEditingSemester(null);
      setCgpaInput("");
      await fetchManualCgpa();
      await fetchGrades();
    }
    
    setSavingCgpa(false);
  };

  const getGradeColor = (cgpa: number) => {
    if (cgpa >= 9) return "text-green-600";
    if (cgpa >= 8) return "text-blue-600";
    if (cgpa >= 7) return "text-yellow-600";
    if (cgpa >= 6) return "text-orange-600";
    return "text-red-600";
  };

  const getGradeLetter = (cgpa: number) => {
    if (cgpa >= 9) return "O"; // Outstanding
    if (cgpa >= 8) return "A+";
    if (cgpa >= 7) return "A";
    if (cgpa >= 6) return "B+";
    if (cgpa >= 5) return "B";
    if (cgpa >= 4) return "C";
    return "F";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Grade Report</h1>
            <p className="text-muted-foreground">View your academic performance across all semesters</p>
          </div>
          <LoadingStats count={3} />
          <div className="space-y-6">
            <LoadingCard lines={5} />
            <LoadingCard lines={5} />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalAssignments = semesterGrades.reduce(
    (sum, s) => sum + s.courses.reduce((cSum, c) => cSum + c.grades.length, 0),
    0
  );
  const totalCourses = semesterGrades.reduce((sum, s) => sum + s.courses.length, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Grade Report</h1>
            <p className="text-muted-foreground">View your academic performance (10-point CGPA scale)</p>
          </div>
          {hasNewGrades && (
            <Button onClick={fetchGrades} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh Grades
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall CGPA</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getGradeColor(overallCGPA)}`}>
                {overallCGPA.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Out of 10.0</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCourses}</div>
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

        {/* Manual CGPA Entry Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enter Semester CGPA</CardTitle>
            <CardDescription>
              Manually record your CGPA for each semester (1-8)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                const semData = semesterGrades.find(s => s.semester === sem);
                const displayCgpa = semData?.manualCgpa || semData?.cgpa;
                const isEditing = editingSemester === sem;
                
                return (
                  <div key={sem} className="text-center">
                    <Label className="text-xs text-muted-foreground">Sem {sem}</Label>
                    {isEditing ? (
                      <div className="flex gap-1 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          value={cgpaInput}
                          onChange={(e) => setCgpaInput(e.target.value)}
                          className="h-8 text-center text-sm"
                          placeholder="0.00"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleSaveCgpa(sem)}
                          disabled={savingCgpa}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="mt-1 h-8 flex items-center justify-center gap-1 cursor-pointer hover:bg-muted rounded transition-colors"
                        onClick={() => {
                          setEditingSemester(sem);
                          setCgpaInput(displayCgpa?.toString() || "");
                        }}
                      >
                        {displayCgpa !== undefined && displayCgpa !== null ? (
                          <span className={`font-semibold ${getGradeColor(displayCgpa)}`}>
                            {displayCgpa.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">--</span>
                        )}
                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Semester-wise Grades */}
        {semesterGrades.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileQuestion className="w-8 h-8" />}
              title="No graded assignments yet"
              description="Your grades will appear here once your instructors have graded your submissions. You can also manually enter your CGPA for each semester above."
              action={
                <Button variant="outline" onClick={() => window.location.href = '/courses'}>
                  View Courses
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-6">
            {semesterGrades.map((semData) => (
              <Card key={semData.semester}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Semester {semData.semester}</CardTitle>
                      <CardDescription>
                        {semData.courses.length} course{semData.courses.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getGradeColor(semData.manualCgpa || semData.cgpa || 0)}`}>
                        {getGradeLetter(semData.manualCgpa || semData.cgpa || 0)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        CGPA: {(semData.manualCgpa || semData.cgpa || 0).toFixed(2)}/10
                        {semData.manualCgpa && <Badge variant="outline" className="ml-2 text-xs">Manual</Badge>}
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={((semData.manualCgpa || semData.cgpa || 0) / 10) * 100} 
                    className="mt-2" 
                  />
                </CardHeader>
                {semData.courses.length > 0 && (
                  <CardContent>
                    <div className="space-y-4">
                      {semData.courses.map((course) => (
                        <div key={course.course_id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{course.course_title}</h4>
                              <p className="text-sm text-muted-foreground">{course.course_code}</p>
                            </div>
                            <Badge className={getGradeColor((course.average / 100) * 10)}>
                              {((course.average / 100) * 10).toFixed(1)}/10
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {course.grades.map((grade) => {
                              const percent = (grade.grade / grade.max_points) * 100;
                              const cgpaEquiv = (percent / 100) * 10;
                              return (
                                <div
                                  key={grade.assignment_id}
                                  className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{grade.assignment_title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(grade.graded_at), "MMM d, yyyy")}
                                    </p>
                                    {grade.feedback && (
                                      <p className="text-xs text-muted-foreground mt-1 italic truncate">
                                        "{grade.feedback}"
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right ml-4 flex-shrink-0">
                                    <Badge variant="outline" className={getGradeColor(cgpaEquiv)}>
                                      {grade.grade}/{grade.max_points}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {cgpaEquiv.toFixed(1)}/10
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Grades;