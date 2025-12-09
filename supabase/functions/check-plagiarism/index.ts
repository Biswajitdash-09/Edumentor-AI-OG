import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Submission {
  id: string;
  content: string;
  student_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetSubmission, otherSubmissions } = await req.json();

    if (!targetSubmission || !otherSubmissions || otherSubmissions.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarity_score: 0, 
          similar_submissions: [],
          analysis: "Not enough data for comparison" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Prepare comparison prompt
    const otherContents = otherSubmissions.map((s: Submission, idx: number) => 
      `Submission ${idx + 1} (${s.student_name}):\n${s.content?.substring(0, 1000) || "No content"}`
    ).join("\n\n---\n\n");

    const prompt = `You are an academic integrity expert. Analyze the following submission for potential plagiarism by comparing it with other submissions from the same assignment.

TARGET SUBMISSION (${targetSubmission.student_name}):
${targetSubmission.content?.substring(0, 1500) || "No content"}

OTHER SUBMISSIONS TO COMPARE:
${otherContents}

Analyze the target submission and provide:
1. A similarity score from 0-100 (where 0 is completely original and 100 is exact copy)
2. List any specific submissions it's similar to with individual similarity percentages
3. A brief analysis explaining your findings

Respond in JSON format:
{
  "similarity_score": <number 0-100>,
  "similar_submissions": [
    {"student_name": "<name>", "similarity": <number 0-100>, "reason": "<brief reason>"}
  ],
  "analysis": "<2-3 sentence explanation>"
}

Be thorough but fair - common phrases, technical terms, and standard formatting should not count as plagiarism.`;

    console.log("Calling Lovable AI for plagiarism analysis");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an academic integrity analysis AI. Respond only with valid JSON."
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    console.log("AI response received:", aiResponse.substring(0, 200));

    // Parse JSON from AI response
    let result;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      result = {
        similarity_score: 0,
        similar_submissions: [],
        analysis: "Unable to analyze submission content"
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Plagiarism check error:", errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        similarity_score: 0,
        similar_submissions: [],
        analysis: "Error during analysis"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});