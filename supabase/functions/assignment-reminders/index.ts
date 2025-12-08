import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log("Running assignment reminder check...");

    // Find assignments due in the next 24 hours
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: assignments, error: assignmentsError } = await supabase
      .from("assignments")
      .select(`
        id, title, due_date, max_points,
        courses(id, code, title)
      `)
      .gte("due_date", now.toISOString())
      .lte("due_date", tomorrow.toISOString())
      .eq("status", "active");

    if (assignmentsError) {
      console.error("Error fetching assignments:", assignmentsError);
      throw assignmentsError;
    }

    if (!assignments || assignments.length === 0) {
      console.log("No assignments due in the next 24 hours");
      return new Response(
        JSON.stringify({ message: "No assignments due soon", reminders_sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${assignments.length} assignments due soon`);

    let totalRemindersSent = 0;
    const baseUrl = supabaseUrl.replace(".supabase.co", ".lovable.app");

    for (const assignment of assignments) {
      const course = (assignment.courses as unknown) as { id: string; code: string; title: string } | null;
      if (!course) continue;

      // Get enrolled students who haven't submitted
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          profiles:student_id(email, full_name)
        `)
        .eq("course_id", course.id)
        .eq("status", "active");

      if (!enrollments || enrollments.length === 0) continue;

      // Get students who have already submitted
      const { data: submissions } = await supabase
        .from("submissions")
        .select("student_id")
        .eq("assignment_id", assignment.id);

      const submittedStudentIds = new Set(submissions?.map(s => s.student_id) || []);

      // Filter to students who haven't submitted
      const studentsToRemind = enrollments.filter(
        e => !submittedStudentIds.has(e.student_id)
      );

      console.log(`Assignment "${assignment.title}": ${studentsToRemind.length} students to remind`);

      const dueDate = new Date(assignment.due_date);
      const hoursRemaining = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));

      for (const enrollment of studentsToRemind) {
        const profile = enrollment.profiles as { email?: string; full_name?: string } | null;
        if (!profile?.email) continue;

        const emailTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">⏰ Assignment Due Soon!</h1>
            </div>
            <div style="padding: 30px; background: #f9fafb;">
              <h2 style="color: #1f2937; margin-top: 0;">Hi ${profile.full_name},</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                This is a friendly reminder that your assignment is due soon:
              </p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <h3 style="color: #1f2937; margin-top: 0;">${assignment.title}</h3>
                <p style="color: #4b5563; margin: 0;">
                  <strong>Course:</strong> ${course.code} - ${course.title}<br>
                  <strong>Due:</strong> ${dueDate.toLocaleString()}<br>
                  <strong>Time remaining:</strong> ~${hoursRemaining} hours<br>
                  <strong>Max points:</strong> ${assignment.max_points}
                </p>
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${baseUrl}/assignments/${assignment.id}" 
                   style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Submit Assignment
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

        const success = await sendEmail(
          profile.email,
          `⏰ Reminder: "${assignment.title}" due in ${hoursRemaining} hours`,
          emailTemplate
        );

        if (success) {
          totalRemindersSent++;
          
          // Create in-app notification
          await supabase.from("notifications").insert({
            user_id: enrollment.student_id,
            title: "Assignment Due Soon",
            message: `"${assignment.title}" is due in ${hoursRemaining} hours`,
            type: "reminder",
            link: `/assignments/${assignment.id}`
          });
        }
      }
    }

    console.log(`Total reminders sent: ${totalRemindersSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        assignments_checked: assignments.length,
        reminders_sent: totalRemindersSent 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in assignment-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
