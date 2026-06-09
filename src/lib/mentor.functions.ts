import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function callGateway(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Lovable Cloud settings.");
  if (!res.ok) {
    const text = await res.text();
    console.error("Gateway error", res.status, text);
    throw new Error(`AI request failed (${res.status})`);
  }
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return json.choices[0]?.message?.content ?? "";
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

export const mentorChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string; messages: Array<{ role: "user" | "assistant"; content: string }> }) =>
    z.object({
      subjectPath: z.string().min(1).max(500),
      messages: z.array(messageSchema).min(1).max(40),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const brief = await loadSubjectMarkdown(data.subjectPath);
    const system = `You are a senior software engineering mentor for the 01-edu / Learn2Earn curriculum.
You are teaching a student working on the project at: subjects/${data.subjectPath}

PROJECT BRIEF (verbatim from the repository — this is your ONLY source of truth for requirements):
---
${brief || "(README not available — be honest about it.)"}
---

YOUR TEACHING METHOD — follow this strictly:
1. On the FIRST message of a conversation, do NOT jump into solutions. Instead:
   a) Briefly explain the CORE CONCEPT this project is teaching (2–4 short paragraphs, use analogies).
   b) Outline the key sub-skills the student will exercise.
   c) Then ASK 2–3 short check-for-understanding QUESTIONS before moving on. Wait for the student's answer.
2. After the student answers, gently correct any misconceptions and CONFIRM understanding before discussing the implementation.
3. Only after the student demonstrates conceptual grasp may you discuss approach, structure, and hints.
4. Always give HINTS and guiding questions, never full solutions. Lead the student to discover the answer.
5. If they ask about something not in the brief, say so plainly — do NOT invent requirements.
6. Be warm, direct, and concise. Use markdown. Code blocks for short examples only.`;

    const reply = await callGateway([
      { role: "system", content: system },
      ...data.messages,
    ]);

    // Persist the latest user message + assistant reply for this user/subject.
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const rows: Array<{ user_id: string; subject_path: string; role: "user" | "assistant"; content: string }> = [];
    if (lastUser) rows.push({ user_id: userId, subject_path: data.subjectPath, role: "user", content: lastUser.content });
    rows.push({ user_id: userId, subject_path: data.subjectPath, role: "assistant", content: reply });
    await supabase.from("mentor_messages").insert(rows);

    return { reply };
  });

export const getMentorHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string }) =>
    z.object({ subjectPath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("mentor_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .eq("subject_path", data.subjectPath)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

export const clearMentorHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string }) =>
    z.object({ subjectPath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("mentor_messages")
      .delete()
      .eq("user_id", userId)
      .eq("subject_path", data.subjectPath);
    return { ok: true };
  });

export const reviewCode = createServerFn({ method: "POST" })
  .inputValidator((d: { subjectPath: string; code: string; language?: string }) =>
    z.object({
      subjectPath: z.string().min(1).max(500),
      code: z.string().min(1).max(20000),
      language: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const brief = await loadSubjectMarkdown(data.subjectPath);
    const system = `You are a senior code reviewer for the 01-edu curriculum.
Review the student's submission against the project brief below. Be honest, specific, and constructive.

PROJECT BRIEF (subjects/${data.subjectPath}):
---
${brief || "(README not available.)"}
---

Output as markdown with these sections (omit any that are empty):
### ✓ Meets the brief
### ✗ Missing or incorrect
### 🐛 Bugs / edge cases
### 💡 Suggestions
### 🎯 Next step

Reference the brief explicitly when calling out missing features.`;

    const user = `Language: ${data.language ?? "auto-detect"}\n\n\`\`\`${data.language ?? ""}\n${data.code}\n\`\`\``;
    const reply = await callGateway([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    return { reply };
  });
