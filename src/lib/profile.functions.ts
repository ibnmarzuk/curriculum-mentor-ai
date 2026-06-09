import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TimelineEvent =
  | { kind: "mentor"; created_at: string; subject_path: string; role: "user" | "assistant"; content: string }
  | { kind: "assessment"; created_at: string; subject_path: string; score: number; passed: boolean; feedback: string | null }
  | { kind: "progress"; created_at: string; subject_path: string; completed_steps: string[] };

export const getProfileTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();

    const [mentor, results, progress] = await Promise.all([
      supabase
        .from("mentor_messages")
        .select("created_at, subject_path, role, content")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("assessment_results")
        .select("created_at, subject_path, score, passed, feedback")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("subject_progress")
        .select("updated_at, subject_path, completed_steps")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

    const events: TimelineEvent[] = [];
    for (const m of mentor.data ?? []) {
      events.push({
        kind: "mentor",
        created_at: m.created_at as string,
        subject_path: m.subject_path as string,
        role: m.role as "user" | "assistant",
        content: m.content as string,
      });
    }
    for (const r of results.data ?? []) {
      events.push({
        kind: "assessment",
        created_at: r.created_at as string,
        subject_path: r.subject_path as string,
        score: Number(r.score ?? 0),
        passed: !!r.passed,
        feedback: (r.feedback as string | null) ?? null,
      });
    }
    for (const p of progress.data ?? []) {
      const steps = (p.completed_steps as string[] | null) ?? [];
      if (steps.length === 0) continue;
      events.push({
        kind: "progress",
        created_at: p.updated_at as string,
        subject_path: p.subject_path as string,
        completed_steps: steps,
      });
    }

    events.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    const stats = {
      mentorMessages: (mentor.data ?? []).length,
      assessmentsTaken: (results.data ?? []).length,
      assessmentsPassed: (results.data ?? []).filter((r) => r.passed).length,
      subjectsTouched: new Set([
        ...(mentor.data ?? []).map((m) => m.subject_path),
        ...(results.data ?? []).map((r) => r.subject_path),
        ...(progress.data ?? []).map((p) => p.subject_path),
      ]).size,
    };

    return { events: events.slice(0, 200), stats };
  });
