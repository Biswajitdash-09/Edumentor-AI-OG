import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StudentData {
  id: string;
  name: string;
  email: string;
  attendanceRate: number;
  avgGrade: number;
  submissionRate: number;
  recentTrend: "improving" | "declining" | "stable";
  missedClasses: number;
  lateSubmissions: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { students, courseContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ predictions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare student data summary for AI analysis
    const studentSummary = students.map((s: StudentData) => ({
      id: s.id,
      name: s.name,
      metrics: {
        attendance: `${s.attendanceRate}%`,
        grade: `${s.avgGrade}%`,
        submissions: `${s.submissionRate}%`,
        trend: s.recentTrend,
        missedClasses: s.missedClasses,
        lateSubmissions: s.lateSubmissions,
      },
    }));

    const systemPrompt = `You are an educational analytics AI that predicts student risk levels based on academic data. Analyze the provided student metrics and return a JSON response with risk predictions.

For each student, determine:
1. riskLevel: "high", "medium", or "low"
2. riskScore: 0-100 (100 = highest risk)
3. primaryRiskFactors: array of 1-3 main concerns
4. recommendations: array of 2-3 actionable intervention strategies
5. predictedOutcome: brief prediction if no intervention

Risk Assessment Criteria:
- HIGH RISK: Attendance <60% OR Grade <60% OR Submission Rate <50% OR declining trend with multiple issues
- MEDIUM RISK: Attendance 60-75% OR Grade 60-70% OR late submissions >3 OR declining trend
- LOW RISK: All metrics above thresholds with stable/improving trend

Always respond with valid JSON in this exact format:
{
  "predictions": [
    {
      "studentId": "string",
      "riskLevel": "high|medium|low",
      "riskScore": number,
      "primaryRiskFactors": ["factor1", "factor2"],
      "recommendations": ["action1", "action2"],
      "predictedOutcome": "string"
    }
  ],
  "classSummary": {
    "highRiskCount": number,
    "mediumRiskCount": number,
    "lowRiskCount": number,
    "topConcerns": ["concern1", "concern2"],
    "suggestedClassActions": ["action1", "action2"]
  }
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze the following student data for ${courseContext || "the course"} and provide risk predictions:\n\n${JSON.stringify(studentSummary, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "predict_student_risk",
              description: "Analyze student data and predict academic risk levels",
              parameters: {
                type: "object",
                properties: {
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        studentId: { type: "string" },
                        riskLevel: { type: "string", enum: ["high", "medium", "low"] },
                        riskScore: { type: "number" },
                        primaryRiskFactors: { type: "array", items: { type: "string" } },
                        recommendations: { type: "array", items: { type: "string" } },
                        predictedOutcome: { type: "string" },
                      },
                      required: ["studentId", "riskLevel", "riskScore", "primaryRiskFactors", "recommendations", "predictedOutcome"],
                    },
                  },
                  classSummary: {
                    type: "object",
                    properties: {
                      highRiskCount: { type: "number" },
                      mediumRiskCount: { type: "number" },
                      lowRiskCount: { type: "number" },
                      topConcerns: { type: "array", items: { type: "string" } },
                      suggestedClassActions: { type: "array", items: { type: "string" } },
                    },
                    required: ["highRiskCount", "mediumRiskCount", "lowRiskCount", "topConcerns", "suggestedClassActions"],
                  },
                },
                required: ["predictions", "classSummary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "predict_student_risk" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI Response:", JSON.stringify(data, null, 2));

    // Extract the function call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      const predictions = JSON.parse(toolCall.function.arguments);
      return new Response(
        JSON.stringify(predictions),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: try to parse content directly
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return new Response(
          JSON.stringify(parsed),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        console.error("Failed to parse AI response content");
      }
    }

    return new Response(
      JSON.stringify({ error: "Failed to parse AI response" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Prediction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});