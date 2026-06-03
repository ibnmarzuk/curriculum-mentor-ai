import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REPO = "01-edu/public";
const BRANCH = "master";
const MODEL = "google/gemini-2.5-flash-lite";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ---------------- Public reads ----------------

export const listTracks = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("tracks")
    .select("*")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return { tracks: data ?? [] };
});

export const getTrack = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: track, error } = await supabaseAdmin
      .from("tracks")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!track) return { track: null, skills: [] };

    const { data: skills } = await supabaseAdmin
      .from("skills")
      .select("*")
      .in("slug", track.skill_slugs);

    // Preserve the track's ordering
    const order = new Map(track.skill_slugs.map((s: string, i: number) => [s, i]));
    const ordered = (skills ?? []).slice().sort(
      (a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0),
    );
    return { track, skills: ordered };
  });

// ---------------- User mastery ----------------

export const getMyMastery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_skill_mastery")
      .select("skill_slug, mastery, updated_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { mastery: data ?? [] };
  });

export const setSkillMastery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { skillSlug: string; mastery: number }) =>
    z
      .object({
        skillSlug: z.string().min(1).max(100),
        mastery: z.number().min(0).max(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_skill_mastery").upsert(
      {
        user_id: userId,
        skill_slug: data.skillSlug,
        mastery: data.mastery,
        evidence: { source: "self-attestation" },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,skill_slug" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Readiness ----------------

export const computeReadiness = createServerFn({ method: "POST" })
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
      return { score: 0, required: [], mastered: [], missing: [], unmapped: true };
    }

    const slugs = required.map((r) => r.skill_slug);
    const { data: mastery } = await supabase
      .from("user_skill_mastery")
      .select("skill_slug, mastery")
      .eq("user_id", userId)
      .in("skill_slug", slugs);

    const masteryMap = new Map((mastery ?? []).map((m) => [m.skill_slug, m.mastery]));
    let num = 0;
    let den = 0;
    const mastered: string[] = [];
    const missing: string[] = [];
    for (const r of required) {
      const m = masteryMap.get(r.skill_slug) ?? 0;
      num += m * r.weight;
      den += r.weight;
      if (m >= 0.7) mastered.push(r.skill_slug);
      else missing.push(r.skill_slug);
    }
    const score = den > 0 ? num / den : 0;

    // Cache (fire & forget — ignore errors)
    await supabase.from("readiness_cache").upsert(
      {
        user_id: userId,
        subject_path: data.subjectPath,
        score,
        missing,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,subject_path" },
    );

    // Look up skill names for the UI
    const { data: skillRows } = await supabase
      .from("skills")
      .select("slug, name, track, level")
      .in("slug", slugs);

    return {
      score,
      required: skillRows ?? [],
      mastered,
      missing,
      unmapped: false,
    };
  });

// ---------------- AI skill extraction ----------------

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

export const extractSubjectSkills = createServerFn({ method: "POST" })
  .inputValidator((d: { subjectPath: string }) =>
    z.object({ subjectPath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    // Skip if we already have mappings
    const { count } = await supabaseAdmin
      .from("subject_skills")
      .select("skill_slug", { count: "exact", head: true })
      .eq("subject_path", data.subjectPath);
    if ((count ?? 0) > 0) return { skipped: true, reason: "already-mapped" };

    const brief = (await loadReadme(data.subjectPath)).slice(0, 6000);
    if (!brief) return { skipped: true, reason: "no-readme" };

    // Load canonical skill slugs for the model
    const { data: allSkills } = await supabaseAdmin
      .from("skills")
      .select("slug, name, track, level, description");
    if (!allSkills || allSkills.length === 0) {
      return { skipped: true, reason: "no-taxonomy" };
    }
    const slugList = allSkills
      .map((s) => `${s.slug} (${s.name}, ${s.track}/${s.level})`)
      .join("\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You map programming project briefs to a canonical skill taxonomy. " +
              "Only pick skill slugs from the provided list — never invent new ones. " +
              "`requires` are prerequisite skills the student MUST know before starting. " +
              "`teaches` are skills the project will help them practice or learn.",
          },
          {
            role: "user",
            content: `Canonical skill list:\n${slugList}\n\nProject brief (subjects/${data.subjectPath}):\n\n${brief}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "map_skills",
              description: "Return required and taught skills.",
              parameters: {
                type: "object",
                properties: {
                  requires: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-6 prerequisite skill slugs from the canonical list",
                  },
                  teaches: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-4 skill slugs the project teaches",
                  },
                },
                required: ["requires", "teaches"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "map_skills" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error(`Skill extraction failed (${res.status})`);

    const json = (await res.json()) as {
      choices: Array<{ message: { tool_calls?: Array<{ function: { arguments: string } }> } }>;
    };
    const args = json.choices[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { skipped: true, reason: "no-tool-call" };
    let parsed: { requires: string[]; teaches: string[] };
    try {
      parsed = JSON.parse(args);
    } catch {
      return { skipped: true, reason: "parse-error" };
    }

    const valid = new Set(allSkills.map((s) => s.slug));
    const rows: Array<{
      subject_path: string;
      skill_slug: string;
      role: "requires" | "teaches";
      weight: number;
    }> = [];
    for (const slug of parsed.requires ?? []) {
      if (valid.has(slug)) rows.push({ subject_path: data.subjectPath, skill_slug: slug, role: "requires", weight: 1 });
    }
    for (const slug of parsed.teaches ?? []) {
      if (valid.has(slug)) rows.push({ subject_path: data.subjectPath, skill_slug: slug, role: "teaches", weight: 1 });
    }
    if (rows.length === 0) return { skipped: true, reason: "no-valid-skills" };

    const { error } = await supabaseAdmin
      .from("subject_skills")
      .upsert(rows, { onConflict: "subject_path,skill_slug,role" });
    if (error) throw new Error(error.message);
    return { ok: true, mapped: rows.length };
  });
