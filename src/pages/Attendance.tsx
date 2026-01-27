import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, MapPin, Calendar, CheckCircle, Plus, Edit, Trash2, Users, Camera } from "lucide-react";
import QRCodeScanner from "@/components/QRCodeScanner";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QRCode from "react-qr-code";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { EditSessionDialog } from "@/components/EditSessionDialog";
import { DeleteSessionDialog } from "@/components/DeleteSessionDialog";
import { ManualAttendanceDialog } from "@/components/ManualAttendanceDialog";

interface Course {
  id: string;
  code: string;
  title: string;
}

interface AttendanceSession {
  id: string;
  qr_code: string;
  session_date: string;
  session_time: string;
  expires_at: string;
  geofence_radius: number;
  course_id: string;
  courses: {
    code: string;
    title: string;
  };
}

const Attendance = () => {
  const [userRole, setUserRole] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [editSession, setEditSession] = useState<AttendanceSession | null>(null);
  const [deleteSession, setDeleteSession] = useState<{ id: string; title: string } | null>(null);
  const [manualAttendanceSession, setManualAttendanceSession] = useState<{ id: string; title: string; courseId: string } | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [newSession, setNewSession] = useState({
    course_id: "",
    session_date: format(new Date(), "yyyy-MM-dd"),
    session_time: format(new Date(), "HH:mm"),
    duration: 15,
    geofence_radius: 50
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchUserRole();
    }
  }, [user]);

  // Fetch courses and sessions after role is determined
  useEffect(() => {
    if (user && userRole) {
      fetchCourses();
      fetchSessions();
    }
  }, [user, userRole]);

  const fetchUserRole = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user?.id)
      .single();
    
    if (data) setUserRole(data.role);
  };

  const fetchCourses = async () => {
    if (userRole === "faculty") {
      const { data } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("faculty_id", user?.id);
      
      setCourses(data || []);
    } else if (userRole === "student") {
      // Get enrolled course IDs first
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user?.id)
        .eq("status", "active");
      
      if (enrollments && enrollments.length > 0) {
        const courseIds = enrollments.map(e => e.course_id);
        const { data } = await supabase
          .from("courses")
          .select("id, code, title")
          .in("id", courseIds);
        
        setCourses(data || []);
      }
    }
  };

  const fetchSessions = async () => {
    let query = supabase
      .from("attendance_sessions")
      .select("*, courses(code, title)");

    if (userRole === "faculty") {
      query = query.eq("faculty_id", user?.id);
    } else if (userRole === "student") {
      query = query
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
    }

    const { data } = await query;
    setSessions(data || []);
  };

  const handleCreateSession = async () => {
    if (!newSession.course_id) {
      toast({
        title: "Error",
        description: "Please select a course",
        variant: "destructive"
      });
      return;
    }

    // Get current location
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported",
        variant: "destructive"
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const qrCode = `EDU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + newSession.duration);

      // Get faculty name for email
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user?.id)
        .single();

      // Get course name for notification
      const selectedCourse = courses.find(c => c.id === newSession.course_id);

      const { error } = await supabase.from("attendance_sessions").insert({
        course_id: newSession.course_id,
        faculty_id: user?.id,
        session_date: newSession.session_date,
        session_time: newSession.session_time,
        qr_code: qrCode,
        location_lat: position.coords.latitude,
        location_lng: position.coords.longitude,
        geofence_radius: newSession.geofence_radius,
        expires_at: expiresAt.toISOString()
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        // Send email notifications to enrolled students
        try {
          await supabase.functions.invoke("send-notification-email", {
            body: {
              type: "attendance_session",
              courseId: newSession.course_id,
              title: `${selectedCourse?.code || "Course"} Attendance`,
              message: `Please mark your attendance before ${format(expiresAt, "h:mm a")}. QR Code: ${qrCode}`,
              facultyName: profile?.full_name || "Faculty",
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notifications:", emailError);
          toast({
            title: "Note",
            description: "Session created but email notifications failed",
          });
        }

        toast({
          title: "Success",
          description: "Attendance session created and students notified"
        });
        setIsCreateDialogOpen(false);
        fetchSessions();
      }
    }, (error) => {
      toast({
        title: "Location Error",
        description: "Please enable location access",
        variant: "destructive"
      });
    });
  };

  const handleCheckIn = async () => {
    if (!scanCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter the QR code",
        variant: "destructive"
      });
      return;
    }

    // Get current location
    navigator.geolocation.getCurrentPosition(async (position) => {
      // Find the session
      const { data: session } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("qr_code", scanCode.trim())
        .single();

      if (!session) {
        toast({
          title: "Error",
          description: "Invalid QR code",
          variant: "destructive"
        });
        return;
      }

      // Check if session is still valid
      if (new Date(session.expires_at) < new Date()) {
        toast({
          title: "Error",
          description: "This attendance session has expired",
          variant: "destructive"
        });
        return;
      }

      // Calculate distance
      const { data: distanceData } = await supabase.rpc("calculate_distance", {
        lat1: session.location_lat,
        lng1: session.location_lng,
        lat2: position.coords.latitude,
        lng2: position.coords.longitude
      });

      if (distanceData > session.geofence_radius) {
        toast({
          title: "Error",
          description: "You are too far from the class location",
          variant: "destructive"
        });
        return;
      }

      // Record attendance
      const { error } = await supabase.from("attendance_records").insert({
        session_id: session.id,
        student_id: user?.id,
        location_lat: position.coords.latitude,
        location_lng: position.coords.longitude,
        status: "present"
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already Checked In",
            description: "You have already marked attendance for this session",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Attendance marked successfully"
        });
        setIsScanDialogOpen(false);
        setScanCode("");
      }
    }, (error) => {
      toast({
        title: "Location Error",
        description: "Please enable location access to mark attendance",
        variant: "destructive"
      });
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Attendance</h1>
            <p className="text-muted-foreground">
              {userRole === "faculty" ? "Manage attendance sessions" : "Mark your attendance"}
            </p>
          </div>
          {userRole === "faculty" && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Attendance Session</DialogTitle>
                  <DialogDescription>
                    Generate a QR code for students to mark attendance
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="course">Course *</Label>
                    <Select
                      value={newSession.course_id}
                      onValueChange={(value) => setNewSession({ ...newSession, course_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.code} - {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newSession.session_date}
                        onChange={(e) => setNewSession({ ...newSession, session_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={newSession.session_time}
                        onChange={(e) => setNewSession({ ...newSession, session_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={newSession.duration}
                        onChange={(e) => setNewSession({ ...newSession, duration: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="radius">Geofence Radius (m)</Label>
                      <Input
                        id="radius"
                        type="number"
                        value={newSession.geofence_radius}
                        onChange={(e) => setNewSession({ ...newSession, geofence_radius: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateSession}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {userRole === "student" && (
            <Dialog open={isScanDialogOpen} onOpenChange={setIsScanDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <QrCode className="w-4 h-4 mr-2" />
                  Check In
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Mark Attendance</DialogTitle>
                  <DialogDescription>
                    Scan the QR code or enter the code manually
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="scan" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="scan">
                      <Camera className="w-4 h-4 mr-2" />
                      Scan QR
                    </TabsTrigger>
                    <TabsTrigger value="manual">
                      <QrCode className="w-4 h-4 mr-2" />
                      Enter Code
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="scan" className="mt-4">
                    <QRCodeScanner 
                      onScan={(code) => {
                        setScanCode(code);
                        handleCheckIn();
                      }}
                      onError={(error) => {
                        toast({
                          title: "Scanner Error",
                          description: error,
                          variant: "destructive"
                        });
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="manual" className="mt-4 space-y-4">
                    <div>
                      <Label htmlFor="code">QR Code</Label>
                      <Input
                        id="code"
                        value={scanCode}
                        onChange={(e) => setScanCode(e.target.value)}
                        placeholder="Enter code..."
                      />
                    </div>
                    <Button onClick={handleCheckIn} className="w-full">
                      Check In
                    </Button>
                  </TabsContent>
                </Tabs>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsScanDialogOpen(false)}>Cancel</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-6">
          {userRole === "faculty" ? (
            sessions.map((session) => (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{session.courses.code} - {session.courses.title}</CardTitle>
                      <CardDescription>
                        {format(new Date(`${session.session_date}T${session.session_time}`), "MMM d, yyyy h:mm a")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditSession(session)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteSession({ id: session.id, title: `${session.courses.code} - ${session.courses.title}` })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setManualAttendanceSession({ 
                          id: session.id, 
                          title: `${session.courses.code} - ${session.courses.title}`,
                          courseId: session.course_id
                        })}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Manual Mark
                      </Button>
                      <Button variant="outline" onClick={() => navigate(`/attendance/${session.id}`)}>
                        View Analytics
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-8">
                    <div className="bg-white p-4 rounded-lg">
                      <QRCode value={session.qr_code} size={150} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>Geofencing enabled</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>
                          Expires {format(new Date(session.expires_at), "h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">Code: {session.qr_code}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <Card key={session.id}>
                  <CardHeader>
                    <CardTitle>{session.courses.code} - {session.courses.title}</CardTitle>
                    <CardDescription>
                      {format(new Date(`${session.session_date}T${session.session_time}`), "MMM d, yyyy h:mm a")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>
                            Expires {format(new Date(session.expires_at), "h:mm a")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>Location verification required</span>
                        </div>
                      </div>
                      <Button onClick={() => {
                        setScanCode(session.qr_code);
                        setIsScanDialogOpen(true);
                      }}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Check In
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {editSession && (
            <EditSessionDialog
              session={editSession}
              open={!!editSession}
              onOpenChange={(open) => !open && setEditSession(null)}
              onSuccess={fetchSessions}
            />
          )}

          {deleteSession && (
            <DeleteSessionDialog
              sessionId={deleteSession.id}
              sessionTitle={deleteSession.title}
              open={!!deleteSession}
              onOpenChange={(open) => !open && setDeleteSession(null)}
              onSuccess={fetchSessions}
            />
          )}

          {manualAttendanceSession && (
            <ManualAttendanceDialog
              sessionId={manualAttendanceSession.id}
              sessionTitle={manualAttendanceSession.title}
              courseId={manualAttendanceSession.courseId}
              open={!!manualAttendanceSession}
              onOpenChange={(open) => !open && setManualAttendanceSession(null)}
              onSuccess={fetchSessions}
            />
          )}

          {sessions.length === 0 && (
            <Card className="p-12 text-center">
              <QrCode className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No active sessions</h3>
              <p className="text-muted-foreground">
                {userRole === "faculty"
                  ? "Create a session to start taking attendance"
                  : "No attendance sessions available at this time"}
              </p>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;