import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignmentNotificationRequest {
  assignmentId: string;
  courseId: string;
  assignmentTitle: string;
  dueDate: string;
  courseTitle: string;
  courseCode: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "EduMentor <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return await res.json();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assignmentId, courseId, assignmentTitle, dueDate, courseTitle, courseCode }: AssignmentNotificationRequest = await req.json();

    console.log("Sending assignment notification for:", assignmentTitle);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all enrolled students for this course
    const { data: enrollments, error: enrollmentError } = await supabase
      .from("enrollments")
      .select(`
        student_id,
        profiles!enrollments_student_id_fkey(email, full_name)
      `)
      .eq("course_id", courseId)
      .eq("status", "active");

    if (enrollmentError) {
      console.error("Error fetching enrollments:", enrollmentError);
      throw new Error("Failed to fetch enrolled students");
    }

    console.log(`Found ${enrollments?.length || 0} enrolled students`);

    if (!enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No enrolled students to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format due date
    const formattedDueDate = new Date(dueDate).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    // Send emails to all enrolled students
    let emailsSent = 0;
    for (const enrollment of enrollments) {
      const profile = enrollment.profiles as any;
      if (!profile?.email) continue;

      try {
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">📚 New Assignment Posted</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Hello ${profile.full_name || 'Student'},
              </p>
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                A new assignment has been posted in your course <strong>${courseCode} - ${courseTitle}</strong>.
              </p>
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h2 style="color: #111827; margin: 0 0 10px; font-size: 18px;">${assignmentTitle}</h2>
                <p style="color: #6b7280; margin: 0; font-size: 14px;">
                  <strong>Due Date:</strong> ${formattedDueDate}
                </p>
              </div>
              <p style="color: #374151; font-size: 16px; margin: 20px 0;">
                Log in to EduMentor to view the assignment details and submit your work.
              </p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Best regards,<br>
                The EduMentor Team
              </p>
            </div>
          </div>
        `;

        await sendEmail(
          profile.email,
          `New Assignment: ${assignmentTitle} - ${courseCode}`,
          html
        );
        emailsSent++;
        console.log(`Email sent to ${profile.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
      }
    }

    // Create notifications in the database for each student
    const notifications = enrollments
      .filter((e: any) => e.profiles?.email)
      .map((enrollment: any) => ({
        user_id: enrollment.student_id,
        title: "New Assignment",
        message: `New assignment "${assignmentTitle}" posted in ${courseCode}. Due: ${formattedDueDate}`,
        type: "assignment",
        link: `/assignments/${assignmentId}`,
      }));

    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("Error creating notifications:", notifError);
      }
    }

    return new Response(
      JSON.stringify({ message: `Notifications sent to ${emailsSent} students` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-assignment-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
