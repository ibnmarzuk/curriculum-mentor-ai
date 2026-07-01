import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type TestCase = { call: string; expected: unknown };

async function callAI(body: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI gateway error (${res.status})`);
  return res.json();
}

function toGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 75) return "C+";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

// ---------- List checkpoints (with user progress) ----------
export const listCheckpoints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: checkpoints } = await supabaseAdmin
      .from("checkpoints")
      .select("id, slug, level, title, difficulty, language, sort_order")
      .order("level", { ascending: true })
      .order("sort_order", { ascending: true });
    const { data: subs } = await supabase
      .from("checkpoint_submissions")
      .select("checkpoint_id, score, grade, passed, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const best = new Map<string, { score: number; grade: string | null; passed: boolean }>();
    for (const s of subs ?? []) {
      const prev = best.get(s.checkpoint_id);
      if (!prev || s.score > prev.score) {
        best.set(s.checkpoint_id, { score: Number(s.score), grade: s.grade, passed: s.passed });
      }
    }
    return {
      checkpoints: (checkpoints ?? []).map((c) => ({
        ...c,
        bestScore: best.get(c.id)?.score ?? null,
        bestGrade: best.get(c.id)?.grade ?? null,
        completed: best.get(c.id)?.passed ?? false,
      })),
    };
  });

// ---------- Get one checkpoint ----------
export const getCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cp } = await supabaseAdmin
      .from("checkpoints")
      .select("id, slug, level, title, difficulty, language, description, function_signature, examples, hints, starter_code, visible_tests, sort_order")
      .eq("slug", data.slug)
      .single();
    if (!cp) throw new Error("Checkpoint not found");
    const { data: submissions } = await supabase
      .from("checkpoint_submissions")
      .select("id, attempt_number, score, grade, passed, passed_visible, total_visible, passed_hidden, total_hidden, feedback, duration_ms, created_at, source_code")
      .eq("user_id", userId)
      .eq("checkpoint_id", cp.id)
      .order("attempt_number", { ascending: false });
    return { checkpoint: cp, submissions: submissions ?? [] };
  });

// ---------- Submit a checkpoint attempt ----------
export const submitCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; code: string; durationMs?: number }) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        code: z.string().min(1).max(20000),
        durationMs: z.number().int().min(0).max(3_600_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cp } = await supabaseAdmin
      .from("checkpoints")
      .select("id, level, title, language, description, visible_tests, hidden_tests, solution")
      .eq("slug", data.slug)
      .single();
    if (!cp) throw new Error("Checkpoint not found");

    const visible = (cp.visible_tests as TestCase[]) ?? [];
    const hidden = (cp.hidden_tests as TestCase[]) ?? [];

    // Ask AI to simulate running the tests against student code.
    const json = await callAI({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an automated test runner. Given student code and a list of test calls, simulate calling each expression and report whether it produced the exact expected value. Be strict — deep-equality on arrays/objects, exact string match. Never invent output.",
        },
        {
          role: "user",
          content:
            `Language: ${cp.language}\n\nTask:\n${cp.description}\n\nStudent code:\n\`\`\`${cp.language}\n${data.code}\n\`\`\`\n\nVisible tests:\n${JSON.stringify(visible)}\n\nHidden tests:\n${JSON.stringify(hidden)}\n`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report",
            parameters: {
              type: "object",
              properties: {
                visible_results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      call: { type: "string" },
                      passed: { type: "boolean" },
                      actual: { type: "string", description: "JSON-stringified actual output" },
                      note: { type: "string" },
                    },
                    required: ["call", "passed", "actual", "note"],
                    additionalProperties: false,
                  },
                },
                hidden_results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      call: { type: "string" },
                      passed: { type: "boolean" },
                    },
                    required: ["call", "passed"],
                    additionalProperties: false,
                  },
                },
                feedback: { type: "string", description: "Short markdown, 2-4 sentences." },
              },
              required: ["visible_results", "hidden_results", "feedback"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report" } },
    });

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Grader returned no result.");
    const parsed = JSON.parse(args) as {
      visible_results: Array<{ call: string; passed: boolean; actual: string; note: string }>;
      hidden_results: Array<{ call: string; passed: boolean }>;
      feedback: string;
    };

    const passedVisible = parsed.visible_results.filter((r) => r.passed).length;
    const passedHidden = parsed.hidden_results.filter((r) => r.passed).length;
    const totalVisible = visible.length;
    const totalHidden = hidden.length;
    const totalAll = totalVisible + totalHidden;
    const passedAll = passedVisible + passedHidden;
    const score = totalAll ? Math.round((passedAll / totalAll) * 100) : 0;
    const passed = passedVisible === totalVisible && passedHidden === totalHidden && totalAll > 0;
    const grade = toGrade(score);

    const { data: prior } = await supabase
      .from("checkpoint_submissions")
      .select("attempt_number")
      .eq("user_id", userId)
      .eq("checkpoint_id", cp.id)
      .order("attempt_number", { ascending: false })
      .limit(1);
    const attemptNumber = ((prior?.[0]?.attempt_number as number) ?? 0) + 1;

    await supabase.from("checkpoint_submissions").insert({
      user_id: userId,
      checkpoint_id: cp.id,
      level: cp.level,
      attempt_number: attemptNumber,
      source_code: data.code,
      language: cp.language,
      passed_visible: passedVisible,
      passed_hidden: passedHidden,
      total_visible: totalVisible,
      total_hidden: totalHidden,
      score,
      grade,
      passed,
      feedback: parsed.feedback,
      duration_ms: data.durationMs ?? null,
    });

    return {
      score,
      grade,
      passed,
      attemptNumber,
      passedVisible,
      totalVisible,
      passedHidden,
      totalHidden,
      visibleResults: parsed.visible_results,
      feedback: parsed.feedback,
    };
  });

// ---------- Leaderboard ----------
export const checkpointLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("checkpoint_submissions")
      .select("user_id, score, passed, checkpoint_id")
      .eq("passed", true);
    const perUser = new Map<string, { completed: Set<string>; total: number }>();
    for (const row of data ?? []) {
      const u = perUser.get(row.user_id) ?? { completed: new Set(), total: 0 };
      u.completed.add(row.checkpoint_id);
      u.total += Number(row.score);
      perUser.set(row.user_id, u);
    }
    const rows = [...perUser.entries()]
      .map(([user_id, v]) => ({ user_id, completed: v.completed.size, totalScore: v.total }))
      .sort((a, b) => b.completed - a.completed || b.totalScore - a.totalScore)
      .slice(0, 20);
    const ids = rows.map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; display_name: string | null }> };
    const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
    return {
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        user_id: r.user_id,
        name: nameMap.get(r.user_id) ?? "Anonymous",
        completed: r.completed,
        totalScore: r.totalScore,
      })),
    };
  });
