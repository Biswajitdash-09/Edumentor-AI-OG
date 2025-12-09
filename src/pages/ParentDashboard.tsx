import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, GraduationCap, Calendar, MessageSquare, Bell, BookOpen, BarChart3, Send, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface LinkedStudent {
  id: string;
  student_id: string;
  relationship: string;
  verified: boolean;
  student: {
    full_name: string;
    email: string;
    department: string | null;
    year: number | null;
  };
}

interface StudentGrade {
  assignment_title: string;
  course_title: string;
  grade: number | null;
  max_points: number;
  submitted_at: string;
}

interface Message {
  id: string;
  subject: string;
  content: string;
  sender_type: string;
  is_read: boolean;
  created_at: string;
  faculty_name?: string;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [studentEmail, setStudentEmail] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [facultyList, setFacultyList] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchLinkedStudents();
      fetchMessages();
    }
  }, [user]);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentData(selectedStudent);
    }
  }, [selectedStudent]);

  const fetchLinkedStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("parent_students")
        .select(`
          id,
          student_id,
          relationship,
          verified
        `)
        .eq("parent_id", user?.id);

      if (error) throw error;

      // Fetch student profiles separately
      if (data && data.length > 0) {
        const studentIds = data.map(ps => ps.student_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, department, year")
          .in("user_id", studentIds);

        const studentsWithProfiles = data.map(ps => ({
          ...ps,
          student: profiles?.find(p => p.user_id === ps.student_id) || {
            full_name: "Unknown",
            email: "",
            department: null,
            year: null
          }
        }));

        setLinkedStudents(studentsWithProfiles as LinkedStudent[]);
        if (studentsWithProfiles.length > 0 && !selectedStudent) {
          setSelectedStudent(studentsWithProfiles[0].student_id);
        }
      }
    } catch (error) {
      console.error("Error fetching linked students:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentData = async (studentId: string) => {
    try {
      // Fetch grades
      const { data: submissions } = await supabase
        .from("submissions")
        .select(`
          grade,
          submitted_at,
          assignments:assignment_id (
            title,
            max_points,
            courses:course_id (title)
          )
        `)
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false })
        .limit(10);

      if (submissions) {
        const grades = submissions.map((s: any) => ({
          assignment_title: s.assignments?.title || "Unknown",
          course_title: s.assignments?.courses?.title || "Unknown",
          grade: s.grade,
          max_points: s.assignments?.max_points || 100,
          submitted_at: s.submitted_at
        }));
        setStudentGrades(grades);
      }

      // Fetch announcements for enrolled courses
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", studentId)
        .eq("status", "active");

      if (enrollments && enrollments.length > 0) {
        const courseIds = enrollments.map(e => e.course_id);
        
        const { data: announcementsData } = await supabase
          .from("announcements")
          .select(`
            id,
            title,
            content,
            created_at,
            courses:course_id (title)
          `)
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
          .limit(5);

        setAnnouncements(announcementsData || []);

        // Fetch faculty for these courses
        const { data: courses } = await supabase
          .from("courses")
          .select(`
            id,
            title,
            faculty_id,
            profiles:faculty_id (full_name, email)
          `)
          .in("id", courseIds);

        if (courses) {
          const faculty = courses.map((c: any) => ({
            id: c.faculty_id,
            name: c.profiles?.full_name || "Unknown",
            course: c.title
          }));
          setFacultyList(faculty);
        }
      }
    } catch (error) {
      console.error("Error fetching student data:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("parent_messages")
        .select("*")
        .eq("parent_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleLinkStudent = async () => {
    if (!studentEmail.trim()) {
      toast({ title: "Error", description: "Please enter student email", variant: "destructive" });
      return;
    }

    try {
      // Find student by email
      const { data: studentProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", studentEmail.trim())
        .maybeSingle();

      if (!studentProfile) {
        toast({ title: "Error", description: "Student not found with this email", variant: "destructive" });
        return;
      }

      // Check if student has student role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", studentProfile.user_id)
        .maybeSingle();

      if (roleData?.role !== "student") {
        toast({ title: "Error", description: "This user is not a student", variant: "destructive" });
        return;
      }

      // Create link request
      const { error } = await supabase
        .from("parent_students")
        .insert({
          parent_id: user?.id,
          student_id: studentProfile.user_id,
          verified: false
        });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Error", description: "Student already linked", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: "Success", description: "Link request sent. Awaiting admin verification." });
      setStudentEmail("");
      setLinkDialogOpen(false);
      fetchLinkedStudents();
    } catch (error) {
      console.error("Error linking student:", error);
      toast({ title: "Error", description: "Failed to link student", variant: "destructive" });
    }
  };

  const handleSendMessage = async () => {
    if (!messageSubject.trim() || !messageContent.trim() || !selectedFaculty || !selectedStudent) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from("parent_messages")
        .insert({
          parent_id: user?.id,
          faculty_id: selectedFaculty,
          student_id: selectedStudent,
          subject: messageSubject,
          content: messageContent,
          sender_type: "parent"
        });

      if (error) throw error;

      toast({ title: "Success", description: "Message sent successfully" });
      setMessageSubject("");
      setMessageContent("");
      setSelectedFaculty("");
      setMessageDialogOpen(false);
      fetchMessages();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    }
  };

  const currentStudent = linkedStudents.find(s => s.student_id === selectedStudent);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Parent Portal</h1>
            <p className="text-muted-foreground">Monitor your child's academic progress</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Link Student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link a Student</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Student Email</Label>
                    <Input
                      placeholder="Enter student's email address"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A link request will be sent for admin verification.
                  </p>
                  <Button onClick={handleLinkStudent} className="w-full">
                    Send Link Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message Faculty
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Message to Faculty</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Select Faculty</Label>
                    <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose faculty member" />
                      </SelectTrigger>
                      <SelectContent>
                        {facultyList.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name} - {f.course}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      placeholder="Message subject"
                      value={messageSubject}
                      onChange={(e) => setMessageSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      placeholder="Write your message..."
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleSendMessage} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Student Selector */}
        {linkedStudents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Linked Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {linkedStudents.map((ls) => (
                  <Button
                    key={ls.id}
                    variant={selectedStudent === ls.student_id ? "default" : "outline"}
                    onClick={() => setSelectedStudent(ls.student_id)}
                    className="flex items-center gap-2"
                  >
                    <GraduationCap className="h-4 w-4" />
                    {ls.student.full_name}
                    {!ls.verified && (
                      <Badge variant="secondary" className="ml-1">Pending</Badge>
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {linkedStudents.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Students Linked</h3>
              <p className="text-muted-foreground mb-4">
                Link your child's account to view their academic progress.
              </p>
              <Button onClick={() => setLinkDialogOpen(true)}>
                Link a Student
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStudent && currentStudent.verified && (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Student</CardTitle>
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{currentStudent.student.full_name}</div>
                    <p className="text-xs text-muted-foreground">
                      {currentStudent.student.department || "No department"} • Year {currentStudent.student.year || "N/A"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Recent Grades</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{studentGrades.filter(g => g.grade !== null).length}</div>
                    <p className="text-xs text-muted-foreground">Graded submissions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Announcements</CardTitle>
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{announcements.length}</div>
                    <p className="text-xs text-muted-foreground">Recent updates</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Messages</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{messages.filter(m => !m.is_read).length}</div>
                    <p className="text-xs text-muted-foreground">Unread messages</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="grades" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Grades</CardTitle>
                  <CardDescription>Your child's latest graded assignments</CardDescription>
                </CardHeader>
                <CardContent>
                  {studentGrades.length > 0 ? (
                    <div className="space-y-4">
                      {studentGrades.map((grade, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{grade.assignment_title}</p>
                            <p className="text-sm text-muted-foreground">{grade.course_title}</p>
                            <p className="text-xs text-muted-foreground">
                              Submitted: {format(new Date(grade.submitted_at), "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="text-right">
                            {grade.grade !== null ? (
                              <Badge variant={grade.grade >= grade.max_points * 0.7 ? "default" : "destructive"}>
                                {grade.grade} / {grade.max_points}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No grades available yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="announcements" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Course Announcements</CardTitle>
                  <CardDescription>Latest updates from your child's courses</CardDescription>
                </CardHeader>
                <CardContent>
                  {announcements.length > 0 ? (
                    <div className="space-y-4">
                      {announcements.map((announcement: any) => (
                        <div key={announcement.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium">{announcement.title}</h4>
                            <Badge variant="outline">{announcement.courses?.title}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{announcement.content}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(announcement.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No announcements available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Messages</CardTitle>
                  <CardDescription>Communication with faculty members</CardDescription>
                </CardHeader>
                <CardContent>
                  {messages.length > 0 ? (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div key={message.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium">{message.subject}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant={message.sender_type === "parent" ? "default" : "secondary"}>
                                {message.sender_type === "parent" ? "Sent" : "Received"}
                              </Badge>
                              {!message.is_read && message.sender_type === "faculty" && (
                                <Badge variant="destructive">New</Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{message.content}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(message.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No messages yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {currentStudent && !currentStudent.verified && (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Verification Pending</h3>
              <p className="text-muted-foreground">
                Your link to {currentStudent.student.full_name} is awaiting admin verification.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}