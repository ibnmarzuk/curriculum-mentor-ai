import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const REPO = "01-edu/public";
const BRANCH = "master";

async function loadReadme(path: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("github_cache")
    .select("content")
    .eq("cache_key", `readme:${path}`)
    .maybeSingle();
  if (data?.content) return data.content;
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/subjects/${path}/README.md`;
  const res = await fetch(url, { headers: { "User-Agent": "lovable-mentor" } });
  return res.ok ? await res.text() : "";
}

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

// ----------------- Get or generate the assessment -----------------

export const getOrCreateAssessment = createServerFn({ method: "POST" })
  .inputValidator((d: { subjectPath: string }) =>
    z.object({ subjectPath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: existing } = await supabaseAdmin
      .from("assessments")
      .select("*")
      .eq("subject_path", data.subjectPath)
      .maybeSingle();
    if (existing) return { assessment: existing };

    const brief = (await loadReadme(data.subjectPath)).slice(0, 6000);
    if (!brief) throw new Error("No project brief available to generate an assessment.");

    const { data: teaches } = await supabaseAdmin
      .from("subject_skills")
      .select("skill_slug")
      .eq("subject_path", data.subjectPath)
      .eq("role", "teaches");
    const teachesSlugs = (teaches ?? []).map((t) => t.skill_slug);

    const json = await callAI({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You design short technical assessments (10–20 min) for programming students. " +
            "Pick the most appropriate language for the project (javascript/typescript/python/go/rust/c/sh/sql). " +
            "Return: a precise task, a starter snippet, a rubric of 3–5 binary checks, a `getting_started` block (3–5 numbered steps for how to start), and a complete reference `solution`.",
        },
        {
          role: "user",
          content: `Project brief (subjects/${data.subjectPath}):\n\n${brief}\n\nDesign one focused coding assessment that lets a student demonstrate understanding of the core idea.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "create_assessment",
            description: "Return a coding assessment for this project.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                language: { type: "string", enum: ["javascript", "typescript", "python", "go", "rust", "c", "sh", "sql"] },
                prompt: { type: "string", description: "Markdown task description with explicit acceptance criteria." },
                starter_code: { type: "string", description: "Starter code snippet the student edits." },
                getting_started: { type: "string", description: "Markdown — numbered steps (3-5) for how to start." },
                solution: { type: "string", description: "Complete, idiomatic reference solution code (no commentary)." },
                rubric: {
                  type: "array",
                  description: "3-5 binary, machine-checkable criteria.",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      description: { type: "string" },
                      weight: { type: "number" },
                    },
                    required: ["id", "description", "weight"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "language", "prompt", "starter_code", "getting_started", "solution", "rubric"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "create_assessment" } },
    });

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no assessment.");
    const parsed = JSON.parse(args) as {
      title: string;
      language: string;
      prompt: string;
      starter_code: string;
      getting_started: string;
      solution: string;
      rubric: Array<{ id: string; description: string; weight: number }>;
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("assessments")
      .insert({
        subject_path: data.subjectPath,
        kind: "code",
        title: parsed.title,
        language: parsed.language,
        prompt: parsed.prompt,
        starter_code: parsed.starter_code,
        getting_started: parsed.getting_started,
        solution: parsed.solution,
        rubric: parsed.rubric,
        teaches_skills: teachesSlugs,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { assessment: inserted };
  });

// ----------------- Grade an attempt -----------------

export const gradeAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assessmentId: string; code: string }) =>
    z
      .object({
        assessmentId: z.string().uuid(),
        code: z.string().min(1).max(50000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: assessment, error: aErr } = await supabaseAdmin
      .from("assessments")
      .select("*")
      .eq("id", data.assessmentId)
      .single();
    if (aErr || !assessment) throw new Error("Assessment not found.");

    const rubric = (assessment.rubric as Array<{ id: string; description: string; weight: number }>) ?? [];

    const json = await callAI({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an automated grader. Given a task, rubric, reference solution, and student code, return a strict pass/fail per criterion, an overall 0–100 score, short actionable feedback, a list of 2–4 specific concrete improvements the student should make next, and a brief comparison between their approach and the reference solution. Be conservative: only pass a criterion if the code clearly satisfies it.",
        },
        {
          role: "user",
          content:
            `Task:\n${assessment.prompt}\n\n` +
            `Language: ${assessment.language}\n\n` +
            `Rubric:\n${rubric.map((r) => `- ${r.id} (w=${r.weight}): ${r.description}`).join("\n")}\n\n` +
            (assessment.solution ? `Reference solution:\n\`\`\`${assessment.language}\n${assessment.solution}\n\`\`\`\n\n` : "") +
            `Student code:\n\`\`\`${assessment.language}\n${data.code}\n\`\`\``,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "grade",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "0–100" },
                criteria: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      passed: { type: "boolean" },
                      note: { type: "string" },
                    },
                    required: ["id", "passed", "note"],
                    additionalProperties: false,
                  },
                },
                feedback: { type: "string", description: "Markdown summary, 3–6 sentences." },
                improvements: {
                  type: "array",
                  description: "2–4 specific things to improve, each a short imperative sentence.",
                  items: { type: "string" },
                },
                comparison: { type: "string", description: "Short markdown comparing student approach vs reference." },
              },
              required: ["score", "criteria", "feedback", "improvements", "comparison"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "grade" } },
    });

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Grader returned no result.");
    const parsed = JSON.parse(args) as {
      score: number;
      criteria: Array<{ id: string; passed: boolean; note: string }>;
      feedback: string;
      improvements: string[];
      comparison: string;
    };
    const score = Math.max(0, Math.min(100, parsed.score));
    const passed = score >= 70;

    await supabase.from("assessment_results").insert({
      user_id: userId,
      assessment_id: assessment.id,
      subject_path: assessment.subject_path,
      score,
      passed,
      feedback: parsed.feedback,
      criteria: parsed.criteria,
      code: data.code,
    });

    // If passed, bump mastery on the teaches skills (cap at 1).
    if (passed && Array.isArray(assessment.teaches_skills) && assessment.teaches_skills.length > 0) {
      const { data: existing } = await supabase
        .from("user_skill_mastery")
        .select("skill_slug, mastery")
        .eq("user_id", userId)
        .in("skill_slug", assessment.teaches_skills);
      const map = new Map((existing ?? []).map((m) => [m.skill_slug, m.mastery]));
      const bump = score >= 90 ? 0.9 : 0.75;
      const rows = assessment.teaches_skills.map((slug: string) => ({
        user_id: userId,
        skill_slug: slug,
        mastery: Math.max(map.get(slug) ?? 0, bump),
        evidence: { source: "assessment", assessment_id: assessment.id, score },
        updated_at: new Date().toISOString(),
      }));
      await supabase
        .from("user_skill_mastery")
        .upsert(rows, { onConflict: "user_id,skill_slug" });
    }

    return { score, passed, feedback: parsed.feedback, criteria: parsed.criteria };
  });

// ----------------- My results -----------------

export const listMyAssessmentResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("assessment_results")
      .select("id, subject_path, score, passed, feedback, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { results: data ?? [] };
  });

// ----------------- Recommendation / learning order -----------------

export const getRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subjectPath: string }) =>
    z.object({ subjectPath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: required } = await supabase
      .from("subject_skills")
      .select("skill_slug, weight")
      .eq("subject_path", data.subjectPath)
      .eq("role", "requires");

    if (!required || required.length === 0) {
      return { unmapped: true as const };
    }

    const requiredSlugs = required.map((r) => r.skill_slug);

    const { data: mastery } = await supabase
      .from("user_skill_mastery")
      .select("skill_slug, mastery")
      .eq("user_id", userId);
    const masteryMap = new Map((mastery ?? []).map((m) => [m.skill_slug, m.mastery]));
    const isMastered = (slug: string) => (masteryMap.get(slug) ?? 0) >= 0.7;

    // Walk transitive prerequisites
    const visited = new Set<string>();
    const queue = [...requiredSlugs];
    while (queue.length) {
      const s = queue.shift()!;
      if (visited.has(s)) continue;
      visited.add(s);
    }
    const { data: allSkills } = await supabaseAdmin
      .from("skills")
      .select("slug, name, track, level, prerequisites");
    const skillMap = new Map((allSkills ?? []).map((s) => [s.slug, s]));

    // Expand prereqs transitively
    const expanded = new Set<string>(requiredSlugs);
    const stack = [...requiredSlugs];
    while (stack.length) {
      const s = stack.pop()!;
      const sk = skillMap.get(s);
      if (!sk) continue;
      for (const p of sk.prerequisites ?? []) {
        if (!expanded.has(p)) {
          expanded.add(p);
          stack.push(p);
        }
      }
    }

    // Topo sort missing skills (only unmastered) by prerequisite order
    const missing = [...expanded].filter((s) => !isMastered(s));
    const order: string[] = [];
    const placed = new Set<string>();
    let safety = missing.length * 2 + 5;
    while (order.length < missing.length && safety-- > 0) {
      for (const s of missing) {
        if (placed.has(s)) continue;
        const prereqs = skillMap.get(s)?.prerequisites ?? [];
        const ready = prereqs.every((p: string) => isMastered(p) || placed.has(p));
        if (ready) {
          order.push(s);
          placed.add(s);
        }
      }
    }
    // Fallback: append any leftovers
    for (const s of missing) if (!placed.has(s)) order.push(s);

    // Recent mentor / code feedback to color the reasoning
    const { data: attempts } = await supabase
      .from("code_attempts")
      .select("subject_path, feedback, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    const next = order[0] ?? null;
    const nextSkill = next ? skillMap.get(next) ?? null : null;

    let reasoning: string;
    if (!nextSkill) {
      reasoning =
        "You have every prerequisite for this project mastered. Start building — use the Mentor tab if you get stuck.";
    } else {
      const reqDirect = requiredSlugs.includes(nextSkill.slug);
      const blocking = order.slice(1, 4).map((s) => skillMap.get(s)?.name).filter(Boolean);
      const recent = (attempts ?? []).find((a) => a.feedback && a.feedback.length > 40);
      reasoning =
        `**${nextSkill.name}** comes next because ` +
        (reqDirect
          ? `it is a direct requirement of this project and you have not demonstrated mastery yet.`
          : `it unlocks ${blocking.join(", ") || "the remaining required skills"} via the prerequisite chain.`) +
        (recent
          ? ` Your most recent mentor feedback on \`${recent.subject_path}\` also suggested gaps in this area.`
          : "");
    }

    return {
      unmapped: false as const,
      required: requiredSlugs,
      missingOrdered: order.map((slug) => {
        const sk = skillMap.get(slug);
        return {
          slug,
          name: sk?.name ?? slug,
          track: sk?.track ?? "foundations",
          level: sk?.level ?? "beginner",
          direct: requiredSlugs.includes(slug),
          prerequisites: (sk?.prerequisites ?? []) as string[],
        };
      }),
      next: nextSkill
        ? { slug: nextSkill.slug, name: nextSkill.name, track: nextSkill.track, level: nextSkill.level }
        : null,
      reasoning,
      recentFeedback: (attempts ?? []).slice(0, 1).map((a) => ({
        subject_path: a.subject_path,
        excerpt: (a.feedback ?? "").slice(0, 240),
      })),
    };
  });
