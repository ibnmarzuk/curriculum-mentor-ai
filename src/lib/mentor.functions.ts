import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Continuity tuning
const RECENT_WINDOW = 20; // last N messages kept verbatim
const SUMMARIZE_THRESHOLD = 30; // when total > this, summarize older
const SUMMARY_KEEP = 10; // when summarizing, leave the most recent N as-is

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

type MemoryContext = {
  summary: string | null;
  allowedSkills: Array<{ slug: string; name: string; role: string }>;
  mastery: Array<{ skill: string; mastery: number }>;
  recentAssessments: Array<{ score: number; passed: boolean; feedback: string | null; created_at: string }>;
};

async function loadMemory(
  supabase: ReturnType<typeof supabaseAdmin.schema> extends never ? any : any,
  userId: string,
  subjectPath: string,
): Promise<MemoryContext> {
  const [summaryRes, subjSkillsRes, masteryRes, assessRes] = await Promise.all([
    supabase
      .from("mentor_summaries")
      .select("summary")
      .eq("user_id", userId)
      .eq("subject_path", subjectPath)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("subject_skills")
      .select("skill_slug, role, skills:skill_slug(name)")
      .eq("subject_path", subjectPath),
    supabase
      .from("user_skill_mastery")
      .select("skill_slug, mastery")
      .eq("user_id", userId),
    supabase
      .from("assessment_results")
      .select("score, passed, feedback, created_at")
      .eq("user_id", userId)
      .eq("subject_path", subjectPath)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const allowedSkills = (subjSkillsRes.data ?? []).map((r: any) => ({
    slug: r.skill_slug,
    name: r.skills?.name ?? r.skill_slug,
    role: r.role,
  }));
  const subjectSkillSet = new Set(allowedSkills.map((s) => s.slug));
  const mastery = (masteryRes.data ?? [])
    .filter((m: any) => subjectSkillSet.has(m.skill_slug))
    .map((m: any) => ({ skill: m.skill_slug, mastery: Number(m.mastery) }));

  return {
    summary: summaryRes.data?.summary ?? null,
    allowedSkills,
    mastery,
    recentAssessments: assessRes.data ?? [],
  };
}

function buildSystemPrompt(subjectPath: string, brief: string, mem: MemoryContext): string {
  const skillList = mem.allowedSkills.length
    ? mem.allowedSkills
        .map((s) => `- ${s.slug} (${s.name}) [${s.role}]`)
        .join("\n")
    : "(no skills mapped for this subject)";

  const masteryList = mem.mastery.length
    ? mem.mastery.map((m) => `- ${m.skill}: ${(m.mastery * 100).toFixed(0)}%`).join("\n")
    : "(no recorded mastery yet)";

  const assessLines = mem.recentAssessments.length
    ? mem.recentAssessments
        .map(
          (a) =>
            `- ${new Date(a.created_at).toISOString().slice(0, 10)} — score ${a.score} (${a.passed ? "passed" : "failed"})${
              a.feedback ? `: ${a.feedback.slice(0, 200)}` : ""
            }`,
        )
        .join("\n")
    : "(no assessment attempts yet)";

  return `You are a senior software engineering mentor for the 01-edu / Learn2Earn curriculum, in an ongoing conversation with this student.
Project: subjects/${subjectPath}

PROJECT BRIEF (verbatim — your only source of truth for requirements):
---
${brief || "(README not available — be honest about it.)"}
---

LONG-TERM MEMORY (summary of earlier conversation in this project):
${mem.summary ? mem.summary : "(no prior summary — this is an early session)"}

CURRICULUM SKILLS for this project (THIS IS THE AUTHORITATIVE SKILL LIST — you MUST NOT invent skills, use ONLY these slugs):
${skillList}

STUDENT'S CURRENT MASTERY (for skills in this subject):
${masteryList}

RECENT ASSESSMENT ATTEMPTS:
${assessLines}

CONTINUITY RULES:
- This is a CONTINUOUS mentoring conversation. Never act as if the chat just started unless the student explicitly says so.
- Reference the long-term memory, mastery, and recent assessment results above when relevant.
- Adapt difficulty to mastery: focus on weak skills (mastery < 50%), don't re-teach mastered ones.

TEACHING METHOD — follow strictly:
1. On the FIRST exchange (or when the student opens a new topic): briefly explain the CORE CONCEPT (2–4 short paragraphs, with an analogy), then ask 2–3 numbered check-for-understanding questions: **Q1**, **Q2**, **Q3**.
2. EVERY concept question MUST be tagged with the skills it tests, on the line directly after the question, in this exact format:
   **Skills tested:** slug1, slug2
   Use ONLY slugs from the CURRICULUM SKILLS list above. Never invent slugs.
3. AFTER the student answers, your VERY NEXT reply MUST begin with "## Per-question feedback". For each question output:
   ### Q{n} — {Correct ✓ | Partially correct ~ | Incorrect ✗}
   **Skills tested:** slug1, slug2
   **Skills missed:** slug1   (only the slugs from "Skills tested" the student did NOT demonstrate; omit the line if none)
   - **What you got right:** …
   - **What you missed:** …
   - **How to improve:** one concrete actionable sentence.
   If the student skipped a question, mark it Incorrect ✗ and put all its skills in "Skills missed".
   Close with a "## Verdict" paragraph: are they ready to move on, or which concept to revisit?
4. Only AFTER conceptual grasp may you discuss approach via HINTS. Never give full solutions.
5. If asked about something not in the brief, say so plainly — do NOT invent requirements.
6. Be warm, direct, concise. Markdown. Short code blocks only.`;
}

async function maybeSummarize(
  supabase: any,
  userId: string,
  subjectPath: string,
) {
  const { count } = await supabase
    .from("mentor_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("subject_path", subjectPath);
  if (!count || count < SUMMARIZE_THRESHOLD) return;

  // Fetch all but the latest SUMMARY_KEEP messages
  const { data: rows } = await supabase
    .from("mentor_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .eq("subject_path", subjectPath)
    .order("created_at", { ascending: true })
    .limit(count - SUMMARY_KEEP);
  if (!rows || rows.length < 5) return;

  const { data: existing } = await supabase
    .from("mentor_summaries")
    .select("summary, covers_until")
    .eq("user_id", userId)
    .eq("subject_path", subjectPath)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const transcript = rows
    .map((r: any) => `${r.role.toUpperCase()}: ${r.content}`)
    .join("\n\n")
    .slice(0, 15000);

  const sys = `You compress mentoring conversations into a compact running memory. Output 6-12 bullet points covering: concepts already explained, questions the student got right/wrong, recurring mistakes, hints already given, current task state. No fluff.`;
  const user = `${existing?.summary ? `EXISTING SUMMARY:\n${existing.summary}\n\nNEW TRANSCRIPT TO MERGE:\n` : "TRANSCRIPT:\n"}${transcript}`;

  try {
    const summary = await callGateway([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    const coversUntil = rows[rows.length - 1].created_at;
    await supabase.from("mentor_summaries").insert({
      user_id: userId,
      subject_path: subjectPath,
      summary,
      covers_until: coversUntil,
      message_count: rows.length,
    });
  } catch (e) {
    console.error("Summarization failed", e);
  }
}

function parseRubric(content: string, allowedSlugs: Set<string>) {
  // Extract Q blocks and feedback blocks with skill tags.
  const questions: Array<{ id: string; text: string; skills: string[] }> = [];
  const feedback: Array<{ id: string; verdict: string; skillsTested: string[]; skillsMissed: string[] }> = [];

  // Questions: **Q1** ... \n **Skills tested:** a, b
  const qRegex = /\*\*Q(\d+)\*\*[^\n]*\n([^\n]*)\n?\s*\*\*Skills tested:\*\*\s*([^\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = qRegex.exec(content))) {
    const skills = m[3]
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => allowedSlugs.has(s));
    questions.push({ id: `Q${m[1]}`, text: m[2].trim(), skills });
  }

  // Feedback: ### Q1 — Verdict ... Skills tested: ... Skills missed: ...
  const fRegex = /###\s*Q(\d+)\s*—\s*([^\n]+)\n([\s\S]*?)(?=###\s*Q\d+|##\s|$)/g;
  while ((m = fRegex.exec(content))) {
    const block = m[3];
    const tested = (block.match(/\*\*Skills tested:\*\*\s*([^\n]+)/i)?.[1] ?? "")
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => allowedSlugs.has(s));
    const missed = (block.match(/\*\*Skills missed:\*\*\s*([^\n]+)/i)?.[1] ?? "")
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => allowedSlugs.has(s));
    feedback.push({ id: `Q${m[1]}`, verdict: m[2].trim(), skillsTested: tested, skillsMissed: missed });
  }

  return { questions, feedback };
}

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
    const [brief, mem] = await Promise.all([
      loadSubjectMarkdown(data.subjectPath),
      loadMemory(supabase, userId, data.subjectPath),
    ]);

    const system = buildSystemPrompt(data.subjectPath, brief, mem);

    // Use only the last RECENT_WINDOW client messages to keep tokens bounded — long-term memory lives in the summary.
    const trimmed = data.messages.slice(-RECENT_WINDOW);

    const reply = await callGateway([
      { role: "system", content: system },
      ...trimmed,
    ]);

    const allowedSet = new Set(mem.allowedSkills.map((s) => s.slug));
    const rubric = parseRubric(reply, allowedSet);

    // Persist exchange
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const rows: Array<{
      user_id: string;
      subject_path: string;
      role: "user" | "assistant";
      content: string;
      metadata: Record<string, unknown>;
    }> = [];
    if (lastUser) {
      rows.push({
        user_id: userId,
        subject_path: data.subjectPath,
        role: "user",
        content: lastUser.content,
        metadata: {},
      });
    }
    rows.push({
      user_id: userId,
      subject_path: data.subjectPath,
      role: "assistant",
      content: reply,
      metadata: { rubric },
    });
    await supabase.from("mentor_messages").insert(rows);

    // Fire-and-forget summarization
    maybeSummarize(supabase, userId, data.subjectPath).catch((e) => console.error(e));

    return { reply, rubric };
  });

export const getMentorHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string }) =>
    z.object({ subjectPath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [msgs, summary] = await Promise.all([
      supabase
        .from("mentor_messages")
        .select("role, content, created_at, metadata")
        .eq("user_id", userId)
        .eq("subject_path", data.subjectPath)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("mentor_summaries")
        .select("summary, covers_until, message_count, created_at")
        .eq("user_id", userId)
        .eq("subject_path", data.subjectPath)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (msgs.error) throw new Error(msgs.error.message);
    return { messages: msgs.data ?? [], summary: summary.data ?? null };
  });

export const clearMentorHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string }) =>
    z.object({ subjectPath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await Promise.all([
      supabase.from("mentor_messages").delete().eq("user_id", userId).eq("subject_path", data.subjectPath),
      supabase.from("mentor_summaries").delete().eq("user_id", userId).eq("subject_path", data.subjectPath),
    ]);
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
