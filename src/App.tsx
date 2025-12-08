import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Courses from "./pages/Courses";
import CourseDetails from "./pages/CourseDetails";
import AssignmentSubmission from "./pages/AssignmentSubmission";
import AIMentor from "./pages/AIMentor";
import Attendance from "./pages/Attendance";
import AttendanceAnalytics from "./pages/AttendanceAnalytics";
import GradeSubmissions from "./pages/GradeSubmissions";
import StudentProgress from "./pages/StudentProgress";
import Announcements from "./pages/Announcements";
import Schedule from "./pages/Schedule";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import Grades from "./pages/Grades";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard/student" element={<StudentDashboard />} />
          <Route path="/dashboard/faculty" element={<FacultyDashboard />} />
          <Route path="/dashboard/admin" element={<AdminDashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetails />} />
          <Route path="/courses/:courseId/students/:studentId" element={<StudentProgress />} />
          <Route path="/assignments/:id" element={<AssignmentSubmission />} />
          <Route path="/assignments/:id/grade" element={<GradeSubmissions />} />
          <Route path="/ai-mentor" element={<AIMentor />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/attendance/:id" element={<AttendanceAnalytics />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/grades" element={<Grades />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
