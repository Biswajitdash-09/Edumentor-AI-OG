import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import { NetworkStatus } from "@/components/NetworkStatus";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const FacultyDashboard = lazy(() => import("./pages/FacultyDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetails = lazy(() => import("./pages/CourseDetails"));
const AssignmentSubmission = lazy(() => import("./pages/AssignmentSubmission"));
const AIMentor = lazy(() => import("./pages/AIMentor"));
const Attendance = lazy(() => import("./pages/Attendance"));
const AttendanceAnalytics = lazy(() => import("./pages/AttendanceAnalytics"));
const GradeSubmissions = lazy(() => import("./pages/GradeSubmissions"));
const StudentProgress = lazy(() => import("./pages/StudentProgress"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Profile = lazy(() => import("./pages/Profile"));
const Grades = lazy(() => import("./pages/Grades"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Install = lazy(() => import("./pages/Install"));
const StudentAnalytics = lazy(() => import("./pages/StudentAnalytics"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center p-8">
    <div className="w-full max-w-md space-y-4">
      <Skeleton className="h-8 w-48 mx-auto" />
      <Skeleton className="h-4 w-64 mx-auto" />
      <div className="space-y-3 pt-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <Toaster />
        <Sonner />
        <NetworkStatus />
        <PWAUpdatePrompt />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/install" element={<Install />} />

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

              {/* Protected routes - Parent */}
              <Route path="/dashboard/parent" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <ParentDashboard />
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
              <Route path="/my-analytics" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentAnalytics />
                </ProtectedRoute>
              } />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
