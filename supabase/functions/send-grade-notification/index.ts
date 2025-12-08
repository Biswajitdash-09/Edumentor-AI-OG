import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GradeNotificationRequest {
  studentId: string;
  assignmentId: string;
  grade: number;
  maxPoints: number;
  feedback: string | null;
  facultyName: string;
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { studentId, assignmentId, grade, maxPoints, feedback, facultyName }: GradeNotificationRequest = await req.json();

    console.log("Sending grade notification:", { studentId, assignmentId, grade });

    // Get student profile
    const { data: studentProfile, error: studentError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", studentId)
      .single();

    if (studentError || !studentProfile?.email) {
      console.error("Error fetching student profile:", studentError);
      return new Response(
        JSON.stringify({ error: "Student not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get assignment details
    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .select("title, course_id")
      .eq("id", assignmentId)
      .single();

    if (assignmentError || !assignment) {
      console.error("Error fetching assignment:", assignmentError);
      return new Response(
        JSON.stringify({ error: "Assignment not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get course details
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("code, title")
      .eq("id", assignment.course_id)
      .single();

    if (courseError || !course) {
      console.error("Error fetching course:", courseError);
      return new Response(
        JSON.stringify({ error: "Course not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const percentage = ((grade / maxPoints) * 100).toFixed(1);
    const baseUrl = supabaseUrl.replace(".supabase.co", ".lovable.app");

    const emailSubject = `📝 Grade Released - ${assignment.title}`;

    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e91e8c 0%, #f472b6 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">📝 Grade Released</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #1f2937; margin-top: 0;">Hi ${studentProfile.full_name},</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Your submission for <strong>${assignment.title}</strong> in <strong>${course.code} - ${course.title}</strong> has been graded.
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">Your Grade</p>
            <p style="font-size: 36px; font-weight: bold; color: #e91e8c; margin: 0;">
              ${grade}/${maxPoints}
            </p>
            <p style="color: #4b5563; margin: 10px 0 0 0;">${percentage}%</p>
          </div>
          ${feedback ? `
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Instructor Feedback:</p>
            <p style="color: #4b5563; line-height: 1.6; margin: 0; white-space: pre-wrap;">${feedback}</p>
          </div>
          ` : ''}
          <p style="color: #6b7280; font-size: 14px;">
            Graded by: ${facultyName}
          </p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${baseUrl}/grades" 
               style="background: #e91e8c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View All Grades
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

    const success = await sendEmail(studentProfile.email, emailSubject, emailTemplate);

    if (success) {
      console.log("Grade notification sent to:", studentProfile.email);

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: studentId,
        title: "Grade Released",
        message: `Your grade for ${assignment.title} is ${grade}/${maxPoints} (${percentage}%)`,
        type: "grade",
        link: "/grades"
      });
    }

    return new Response(
      JSON.stringify({ success, email: studentProfile.email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in send-grade-notification function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
