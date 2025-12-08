import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
  role: string;
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
    const { email, fullName, role }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const baseUrl = supabaseUrl.replace(".supabase.co", ".lovable.app");

    const roleFeatures: Record<string, string[]> = {
      student: [
        "📚 Enroll in courses and access materials",
        "📝 Submit assignments and track grades",
        "📋 Mark attendance using QR codes",
        "🤖 Get help from AI Mentor",
        "💬 Participate in course discussions"
      ],
      faculty: [
        "📖 Create and manage courses",
        "📝 Create assignments and grade submissions",
        "📋 Generate attendance sessions with QR codes",
        "📢 Post announcements to students",
        "📊 View analytics and student progress"
      ],
      admin: [
        "👥 Manage all users and roles",
        "📊 View system-wide analytics",
        "🏫 Oversee all courses and activities",
        "📢 Post institution-wide announcements",
        "⚙️ Configure system settings"
      ]
    };

    const features = roleFeatures[role] || roleFeatures.student;

    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e91e8c 0%, #f472b6 100%); padding: 40px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎓 Welcome to EduMentor AI!</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #1f2937; margin-top: 0;">Hi ${fullName}! 👋</h2>
          <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
            Welcome to <strong>EduMentor AI</strong> - your intelligent academic companion! 
            Your account has been created as a <strong style="color: #e91e8c;">${role}</strong>.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">🚀 What you can do:</h3>
            <ul style="color: #4b5563; line-height: 2; padding-left: 20px;">
              ${features.map(f => `<li>${f}</li>`).join('')}
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${baseUrl}/dashboard/${role}" 
               style="background: #e91e8c; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Go to Dashboard
            </a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              Need help getting started? Check out our guides or contact support.
            </p>
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
      email,
      "🎓 Welcome to EduMentor AI!",
      emailTemplate
    );

    console.log("Welcome email sent:", success);

    return new Response(
      JSON.stringify({ success }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
