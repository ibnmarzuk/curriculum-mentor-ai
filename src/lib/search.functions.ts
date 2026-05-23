import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SubjectResult = {
  subject_path: string;
  title: string;
  language: string | null;
  framework: string | null;
  difficulty: string | null;
  tags: string[];
  description: string | null;
  estimated_minutes: number | null;
};

export const searchSubjects = createServerFn({ method: "GET" })
  .inputValidator((d: { q?: string; language?: string; difficulty?: string; limit?: number }) =>
    z.object({
      q: z.string().max(200).optional(),
      language: z.string().max(40).optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ results: SubjectResult[]; total: number }> => {
    const limit = data.limit ?? 50;
    let query = supabaseAdmin
      .from("subject_meta")
      .select(
        "subject_path, title, language, framework, difficulty, tags, description, estimated_minutes",
        { count: "exact" },
      );

    if (data.q && data.q.trim()) {
      const term = data.q.trim();
      // Trigram fuzzy match across title, path, description, plus tag membership
      const like = `%${term.toLowerCase()}%`;
      query = query.or(
        `title.ilike.${like},subject_path.ilike.${like},description.ilike.${like}`,
      );
    }
    if (data.language) query = query.eq("language", data.language);
    if (data.difficulty) query = query.eq("difficulty", data.difficulty);

    const { data: rows, count, error } = await query
      .order("title", { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    return { results: (rows ?? []) as SubjectResult[], total: count ?? 0 };
  });

export const listLanguages = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("subject_meta")
    .select("language")
    .not("language", "is", null);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const lang = row.language as string;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
});
