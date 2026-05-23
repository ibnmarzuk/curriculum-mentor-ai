import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function loadSubjectMarkdown(path: string): Promise<string> {
  const key = `readme:${path}`;
  const { data } = await supabaseAdmin
    .from("github_cache")
    .select("content, fetched_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (data && Date.now() - new Date(data.fetched_at).getTime() < CACHE_TTL_MS) {
    return data.content;
  }
  const url = `https://raw.githubusercontent.com/01-edu/public/master/subjects/${path}/README.md`;
  const res = await fetch(url, { headers: { "User-Agent": "lovable-mentor" } });
  const md = res.ok ? await res.text() : "";
  await supabaseAdmin
    .from("github_cache")
    .upsert({ cache_key: key, content: md, fetched_at: new Date().toISOString() });
  return md;
}

const pathSchema = z.string().min(1).max(500);

export const getProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string }) => z.object({ subjectPath: pathSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [progressRes, attemptsRes] = await Promise.all([
      supabase
        .from("subject_progress")
        .select("completed_steps, next_tasks, updated_at")
        .eq("user_id", userId)
        .eq("subject_path", data.subjectPath)
        .maybeSingle(),
      supabase
        .from("code_attempts")
        .select("id, language, code, feedback, created_at")
        .eq("user_id", userId)
        .eq("subject_path", data.subjectPath)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return {
      progress: progressRes.data ?? { completed_steps: [], next_tasks: [], updated_at: null },
      attempts: attemptsRes.data ?? [],
    };
  });

export const toggleStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string; step: string; done: boolean }) =>
    z.object({
      subjectPath: pathSchema,
      step: z.string().min(1).max(500),
      done: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("subject_progress")
      .select("completed_steps, next_tasks")
      .eq("user_id", userId)
      .eq("subject_path", data.subjectPath)
      .maybeSingle();
    const current: string[] = row?.completed_steps ?? [];
    const next = data.done
      ? Array.from(new Set([...current, data.step]))
      : current.filter((s) => s !== data.step);
    const { error } = await supabase
      .from("subject_progress")
      .upsert(
        {
          user_id: userId,
          subject_path: data.subjectPath,
          completed_steps: next,
          next_tasks: row?.next_tasks ?? [],
        },
        { onConflict: "user_id,subject_path" },
      );
    if (error) throw new Error(error.message);
    return { completed_steps: next };
  });

export const saveAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string; code: string; language?: string; feedback?: string }) =>
    z.object({
      subjectPath: pathSchema,
      code: z.string().min(1).max(20000),
      language: z.string().max(40).optional(),
      feedback: z.string().max(20000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error, data: row } = await supabase
      .from("code_attempts")
      .insert({
        user_id: userId,
        subject_path: data.subjectPath,
        code: data.code,
        language: data.language ?? null,
        feedback: data.feedback ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("code_attempts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function callGateway(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return json.choices[0]?.message?.content ?? "";
}

export const suggestNextTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string }) => z.object({ subjectPath: pathSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const brief = await loadSubjectMarkdown(data.subjectPath);
    const { data: row } = await supabase
      .from("subject_progress")
      .select("completed_steps")
      .eq("user_id", userId)
      .eq("subject_path", data.subjectPath)
      .maybeSingle();
    const { data: attempts } = await supabase
      .from("code_attempts")
      .select("feedback, created_at")
      .eq("user_id", userId)
      .eq("subject_path", data.subjectPath)
      .order("created_at", { ascending: false })
      .limit(3);

    const done = row?.completed_steps ?? [];
    const recentFeedback = (attempts ?? [])
      .map((a, i) => `Attempt ${i + 1} feedback:\n${a.feedback ?? "(no feedback saved)"}`)
      .join("\n\n");

    const system = `You are a curriculum mentor. Based ONLY on the project brief below, propose the 3-5 next concrete tasks the student should tackle.

PROJECT BRIEF (subjects/${data.subjectPath}):
---
${brief || "(README not available — be honest if you can't suggest specifics.)"}
---

Already completed by the student:
${done.length ? done.map((s) => `- ${s}`).join("\n") : "(nothing yet)"}

Recent mentor feedback on their attempts:
${recentFeedback || "(no attempts yet)"}

Output ONLY a JSON array of short task strings (max 80 chars each), no markdown, no prose. Example: ["Parse CLI args", "Handle empty input", "Add tests for edge cases"]`;

    const reply = await callGateway([{ role: "system", content: system }]);
    let tasks: string[] = [];
    try {
      const match = reply.match(/\[[\s\S]*\]/);
      if (match) tasks = JSON.parse(match[0]);
    } catch {
      tasks = [];
    }
    tasks = tasks.filter((t) => typeof t === "string" && t.trim()).slice(0, 6);

    const { error } = await supabase
      .from("subject_progress")
      .upsert(
        {
          user_id: userId,
          subject_path: data.subjectPath,
          completed_steps: done,
          next_tasks: tasks,
        },
        { onConflict: "user_id,subject_path" },
      );
    if (error) throw new Error(error.message);
    return { next_tasks: tasks };
  });

// Extracts a flat list of step candidates from a README's checklist + headings.
export const getSubjectSteps = createServerFn({ method: "POST" })
  .inputValidator((d: { subjectPath: string }) => z.object({ subjectPath: pathSchema }).parse(d))
  .handler(async ({ data }) => {
    const md = await loadSubjectMarkdown(data.subjectPath);
    const steps: string[] = [];
    const seen = new Set<string>();
    const lines = md.split("\n");
    for (const raw of lines) {
      const line = raw.trim();
      // bullet items
      const m = line.match(/^[-*+]\s+(.+)/);
      if (m) {
        const txt = m[1].replace(/^\[.\]\s*/, "").replace(/`/g, "").trim();
        if (txt.length > 4 && txt.length < 160 && !seen.has(txt)) {
          seen.add(txt);
          steps.push(txt);
        }
      }
      // h2 / h3 sections as macro steps
      const h = line.match(/^#{2,3}\s+(.+)/);
      if (h) {
        const txt = h[1].trim();
        if (txt.length > 2 && txt.length < 80 && !seen.has(txt)) {
          seen.add(txt);
          steps.push(txt);
        }
      }
      if (steps.length >= 25) break;
    }
    return { steps };
  });
