import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REPO = "01-edu/public";
const BRANCH = "master";

const LANGUAGE_MAP: Record<string, string> = {
  go: "Go",
  "piscine-go": "Go",
  rust: "Rust",
  "rust-piscine": "Rust",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  python: "Python",
  py: "Python",
  java: "Java",
  csharp: "C#",
  "c-sharp": "C#",
  php: "PHP",
  c: "C",
  cpp: "C++",
  ai: "AI",
  devops: "DevOps",
  bash: "Bash",
  sh: "Bash",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  react: "React",
  vue: "Vue",
  angular: "Angular",
  node: "Node.js",
  nodejs: "Node.js",
  docker: "Docker",
  kubernetes: "Kubernetes",
  git: "Git",
  web: "Web",
  dom: "Web",
  doom: "JavaScript",
};

function deriveTitle(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveLanguage(path: string): string | null {
  const first = path.split("/")[0]?.toLowerCase();
  if (!first) return null;
  return LANGUAGE_MAP[first] ?? null;
}

/** Walks the entire repo via the GitHub Git Trees API and upserts one
 * subject_meta row for every directory containing a README.md. */
export const indexAllSubjects = createServerFn({ method: "POST" }).handler(async () => {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "lovable-mentor" },
  });
  if (!res.ok) {
    throw new Error(`GitHub tree fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    tree: Array<{ path: string; type: "blob" | "tree" }>;
    truncated: boolean;
  };

  const subjectPaths = new Set<string>();
  for (const entry of json.tree) {
    if (entry.type !== "blob") continue;
    // subjects/<...>/README.md
    const m = entry.path.match(/^subjects\/(.+)\/README\.md$/i);
    if (m) subjectPaths.add(m[1]);
  }

  const rows = Array.from(subjectPaths).map((p) => ({
    subject_path: p,
    title: deriveTitle(p),
    language: deriveLanguage(p),
    tags: [] as string[],
  }));

  // Upsert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabaseAdmin
      .from("subject_meta")
      .upsert(chunk, { onConflict: "subject_path", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
  }

  return { indexed: rows.length, truncated: json.truncated };
});

/** Returns whether the catalog has been populated yet. */
export const getCatalogStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("subject_meta")
    .select("subject_path", { count: "exact", head: true });
  return { count: count ?? 0 };
});

// --- Lazy AI classifier ---------------------------------------------------

const MODEL = "google/gemini-2.5-flash-lite";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

export const classifySubject = createServerFn({ method: "POST" })
  .inputValidator((d: { subjectPath: string }) =>
    z.object({ subjectPath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    // Skip if already classified recently
    const { data: existing } = await supabaseAdmin
      .from("subject_meta")
      .select("ai_classified_at")
      .eq("subject_path", data.subjectPath)
      .maybeSingle();
    if (existing?.ai_classified_at) return { skipped: true };

    const brief = (await loadReadme(data.subjectPath)).slice(0, 6000);
    if (!brief) return { skipped: true };

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
              "You classify programming project briefs from the 01-edu curriculum. Be precise and concise.",
          },
          {
            role: "user",
            content: `Classify this project (path: subjects/${data.subjectPath}):\n\n${brief}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify",
              description: "Return structured metadata about the project.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Human-readable project title (max 60 chars)" },
                  description: { type: "string", description: "One-sentence summary (max 200 chars)" },
                  language: { type: "string", description: "Primary programming language" },
                  framework: { type: "string", description: "Framework/library if any, else empty" },
                  difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-6 topic tags (lowercase, no spaces e.g. 'auth', 'cli', 'graph')",
                  },
                  estimated_minutes: { type: "integer", description: "Realistic completion time" },
                },
                required: ["title", "description", "language", "difficulty", "tags", "estimated_minutes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error(`Classify failed (${res.status})`);

    const json = (await res.json()) as {
      choices: Array<{ message: { tool_calls?: Array<{ function: { arguments: string } }> } }>;
    };
    const args = json.choices[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { skipped: true };
    let parsed: {
      title: string;
      description: string;
      language: string;
      framework?: string;
      difficulty: string;
      tags: string[];
      estimated_minutes: number;
    };
    try {
      parsed = JSON.parse(args);
    } catch {
      return { skipped: true };
    }

    const { error } = await supabaseAdmin
      .from("subject_meta")
      .upsert(
        {
          subject_path: data.subjectPath,
          title: parsed.title || deriveTitle(data.subjectPath),
          description: parsed.description,
          language: parsed.language || deriveLanguage(data.subjectPath),
          framework: parsed.framework || null,
          difficulty: parsed.difficulty,
          tags: parsed.tags ?? [],
          estimated_minutes: parsed.estimated_minutes,
          ai_classified_at: new Date().toISOString(),
        },
        { onConflict: "subject_path" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
