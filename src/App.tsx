import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />

            {/* Protected routes - Student */}
            <Route path="/dashboard/student" element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            } />

            {/* Protected routes - Faculty */}
            <Route path="/dashboard/faculty" element={
              <ProtectedRoute allowedRoles={["faculty"]}>
                <FacultyDashboard />
              </ProtectedRoute>
            } />

            {/* Protected routes - Admin */}
            <Route path="/dashboard/admin" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Protected routes - All authenticated users */}
            <Route path="/courses" element={
              <ProtectedRoute>
                <Courses />
              </ProtectedRoute>
            } />
            <Route path="/courses/:id" element={
              <ProtectedRoute>
                <CourseDetails />
              </ProtectedRoute>
            } />
            <Route path="/courses/:courseId/students/:studentId" element={
              <ProtectedRoute allowedRoles={["faculty", "admin"]}>
                <StudentProgress />
              </ProtectedRoute>
            } />
            <Route path="/assignments/:id" element={
              <ProtectedRoute>
                <AssignmentSubmission />
              </ProtectedRoute>
            } />
            <Route path="/assignments/:id/grade" element={
              <ProtectedRoute allowedRoles={["faculty", "admin"]}>
                <GradeSubmissions />
              </ProtectedRoute>
            } />
            <Route path="/ai-mentor" element={
              <ProtectedRoute>
                <AIMentor />
              </ProtectedRoute>
            } />
            <Route path="/attendance" element={
              <ProtectedRoute>
                <Attendance />
              </ProtectedRoute>
            } />
            <Route path="/attendance/:id" element={
              <ProtectedRoute>
                <AttendanceAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/announcements" element={
              <ProtectedRoute>
                <Announcements />
              </ProtectedRoute>
            } />
            <Route path="/schedule" element={
              <ProtectedRoute>
                <Schedule />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute allowedRoles={["faculty", "admin"]}>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/grades" element={
              <ProtectedRoute>
                <Grades />
              </ProtectedRoute>
            } />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
