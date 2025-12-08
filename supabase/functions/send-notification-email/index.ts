import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  type: "attendance_session" | "announcement";
  courseId: string;
  title: string;
  message: string;
  facultyName: string;
}

async function verifyFacultyAuth(req: Request, courseId: string): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("No authorization header");
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.error("Auth verification failed:", error);
    return null;
  }

  // Verify user is faculty for this course
  const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: course, error: courseError } = await supabaseService
    .from("courses")
    .select("faculty_id")
    .eq("id", courseId)
    .single();

  if (courseError || !course || course.faculty_id !== user.id) {
    console.error("User is not faculty for this course");
    return null;
  }

  return { userId: user.id };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "EduMentor AI <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, courseId, title, message, facultyName }: NotificationEmailRequest = await req.json();

    // Verify caller is faculty for this course
    const auth = await verifyFacultyAuth(req, courseId);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - must be faculty for this course" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Sending notification email:", { type, courseId, title, byUser: auth.userId });

    // Get enrolled students for the course
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("enrollments")
      .select(`
        student_id,
        profiles!enrollments_student_id_fkey(email, full_name)
      `)
      .eq("course_id", courseId)
      .eq("status", "active");

    if (enrollmentsError) {
      console.error("Error fetching enrollments:", enrollmentsError);
      throw enrollmentsError;
    }

    if (!enrollments || enrollments.length === 0) {
      console.log("No enrolled students found for course:", courseId);
      return new Response(
        JSON.stringify({ message: "No enrolled students to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get course details
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("code, title")
      .eq("id", courseId)
      .single();

    if (courseError) {
      console.error("Error fetching course:", courseError);
      throw courseError;
    }

    const emailSubject = type === "attendance_session"
      ? `📋 Attendance Session Started - ${course.code}`
      : `📢 New Announcement - ${course.code}`;

    const baseUrl = supabaseUrl.replace(".supabase.co", ".lovable.app");

    const emailTemplate = type === "attendance_session"
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #e91e8c 0%, #f472b6 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">📋 Attendance Session</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              A new attendance session has been created for <strong>${course.code} - ${course.title}</strong>.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #4b5563; margin: 0;">${message}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Posted by: ${facultyName}
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${baseUrl}/attendance" 
                 style="background: #e91e8c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Mark Attendance
              </a>
            </div>
          </div>
          <div style="padding: 20px; text-align: center; background: #1f2937;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              EduMentor AI - Your Academic Companion
            </p>
          </div>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #e91e8c 0%, #f472b6 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">📢 New Announcement</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
              <strong>${course.code} - ${course.title}</strong>
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #4b5563; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Posted by: ${facultyName}
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${baseUrl}/announcements" 
                 style="background: #e91e8c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View All Announcements
              </a>
            </div>
          </div>
          <div style="padding: 20px; text-align: center; background: #1f2937;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              EduMentor AI - Your Academic Companion
            </p>
          </div>
        </div>
      `;

    // Send emails to all enrolled students
    let successCount = 0;
    for (const enrollment of enrollments) {
      const profile = enrollment.profiles as { email?: string; full_name?: string } | null;
      const studentEmail = profile?.email;

      if (!studentEmail) {
        console.log("No email found for student:", enrollment.student_id);
        continue;
      }

      const success = await sendEmail(studentEmail, emailSubject, emailTemplate);
      if (success) {
        successCount++;
        console.log("Email sent to:", studentEmail);
      }
    }

    console.log(`Successfully sent ${successCount}/${enrollments.length} notification emails`);

    // Create in-app notifications for all enrolled students
    const notificationInserts = enrollments.map((enrollment) => ({
      user_id: enrollment.student_id,
      title: type === "attendance_session" ? "Attendance Session Started" : "New Announcement",
      message: `${course.code}: ${title}`,
      type: type === "attendance_session" ? "attendance" : "announcement",
      link: type === "attendance_session" ? "/attendance" : "/announcements"
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notificationInserts);

    if (notifError) {
      console.error("Error creating notifications:", notifError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: successCount,
        totalStudents: enrollments.length 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);