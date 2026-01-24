import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get counts for landing page stats
    // Using service role to bypass RLS for public statistics
    
    // Count active students
    const { count: studentCount } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "student");

    // Count faculty members
    const { count: facultyCount } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "faculty");

    // Count active courses
    const { count: courseCount } = await supabase
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Count total enrollments (as a metric of platform activity)
    const { count: enrollmentCount } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Calculate a satisfaction score based on platform engagement
    // For now, we'll use a calculated metric based on attendance rates
    const { data: attendanceData } = await supabase
      .from("attendance_records")
      .select("id", { count: "exact", head: true });
    
    const { data: sessionsData } = await supabase
      .from("attendance_sessions")
      .select("id", { count: "exact", head: true });

    // Format numbers for display
    const formatCount = (count: number | null): string => {
      if (!count || count === 0) return "0";
      if (count >= 10000) return `${Math.floor(count / 1000)}K+`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}K+`;
      return count.toString();
    };

    const stats = {
      students: formatCount(studentCount),
      faculty: formatCount(facultyCount),
      courses: formatCount(courseCount),
      enrollments: formatCount(enrollmentCount),
      // Raw numbers for calculations
      raw: {
        students: studentCount || 0,
        faculty: facultyCount || 0,
        courses: courseCount || 0,
        enrollments: enrollmentCount || 0,
      }
    };

    console.log("Public stats fetched:", stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch statistics" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
