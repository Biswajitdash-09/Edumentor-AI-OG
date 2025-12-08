import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Query keys for cache management
export const queryKeys = {
  enrollments: (userId?: string) => ["enrollments", userId],
  courses: () => ["courses"],
  courseDetails: (courseId: string) => ["course", courseId],
  assignments: (courseId?: string) => ["assignments", courseId],
  submissions: (assignmentId?: string) => ["submissions", assignmentId],
  attendanceSessions: (courseId?: string) => ["attendanceSessions", courseId],
  attendanceRecords: (sessionId?: string) => ["attendanceRecords", sessionId],
  dashboardStats: (role: string, userId?: string) => ["dashboardStats", role, userId],
  courseMaterials: (courseId: string) => ["courseMaterials", courseId],
};

// Custom hook for enrollments
export function useEnrollments(userId?: string) {
  return useQuery({
    queryKey: queryKeys.enrollments(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, courses(*)")
        .eq("student_id", userId)
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// Custom hook for courses
export function useCourses() {
  return useQuery({
    queryKey: queryKeys.courses(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, profiles(full_name)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

// Custom hook for course details
export function useCourseDetails(courseId: string) {
  return useQuery({
    queryKey: queryKeys.courseDetails(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, profiles(full_name)")
        .eq("id", courseId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });
}

// Custom hook for assignments
export function useAssignments(courseId?: string) {
  return useQuery({
    queryKey: queryKeys.assignments(courseId),
    queryFn: async () => {
      let query = supabase.from("assignments").select("*");
      
      if (courseId) {
        query = query.eq("course_id", courseId);
      }
      
      const { data, error } = await query.order("due_date", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
}

// Custom hook for enrollment mutation
export function useEnrollMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, studentId }: { courseId: string; studentId: string }) => {
      const { data, error } = await supabase
        .from("enrollments")
        .insert({ course_id: courseId, student_id: studentId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments(variables.studentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats("student", variables.studentId) });
      toast({
        title: "Success",
        description: "Successfully enrolled in course",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to enroll in course",
        variant: "destructive",
      });
    },
  });
}

// Custom hook for attendance check-in mutation
export function useAttendanceCheckIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      session_id: string;
      student_id: string;
      location_lat?: number;
      location_lng?: number;
    }) => {
      const { data: result, error } = await supabase
        .from("attendance_records")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendanceRecords(variables.session_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats("student") });
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark attendance",
        variant: "destructive",
      });
    },
  });
}

// Custom hook for submission mutation
export function useSubmissionMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      assignment_id: string;
      student_id: string;
      content?: string;
      file_path?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("submissions")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions(variables.assignment_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats("student") });
      toast({
        title: "Success",
        description: "Assignment submitted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit assignment",
        variant: "destructive",
      });
    },
  });
}

// Custom hook for grading mutation
export function useGradingMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      submissionId: string;
      grade: number;
      feedback?: string;
      gradedBy: string;
    }) => {
      const { data: result, error } = await supabase
        .from("submissions")
        .update({
          grade: data.grade,
          feedback: data.feedback,
          graded_by: data.gradedBy,
          graded_at: new Date().toISOString(),
        })
        .eq("id", data.submissionId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats("faculty") });
      toast({
        title: "Success",
        description: "Submission graded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to grade submission",
        variant: "destructive",
      });
    },
  });
}
