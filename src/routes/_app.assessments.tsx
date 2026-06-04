import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { listMyAssessmentResults } from "@/lib/assessment.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/assessments")({
  head: () => ({ meta: [{ title: "Assessments — Learn2Earn Mentor" }] }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const fn = useServerFn(listMyAssessmentResults);
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const q = useQuery({
    queryKey: ["my-assessment-results"],
    queryFn: () => fn(),
    enabled: authed === true,
  });

  if (authed === false) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="serif text-3xl mb-2">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline">Sign in</Link> to take Monaco-based coding assessments and track your scores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8 max-w-4xl">
      <h1 className="serif text-3xl mb-2">Assessments</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Open any project and switch to the <span className="font-mono">Assessment</span> tab to take a short auto-graded coding challenge. Passing scores feed back into your skill mastery and readiness.
      </p>

      <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Your recent attempts</h2>
      {q.isLoading && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> loading…
        </div>
      )}
      {q.data && q.data.results.length === 0 && (
        <p className="text-sm text-muted-foreground">No attempts yet. Open a project to get started.</p>
      )}
      <ul className="space-y-2">
        {(q.data?.results ?? []).map((r) => (
          <li key={r.id} className="border border-border rounded-md p-4 bg-surface/30 flex items-start gap-3">
            <div className="mt-0.5">
              {r.passed ? <Check size={16} className="text-primary" /> : <X size={16} className="text-destructive" />}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                to="/subjects/$"
                params={{ _splat: r.subject_path }}
                className="font-mono text-sm hover:text-primary truncate block"
              >
                {r.subject_path}
              </Link>
              {r.feedback && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.feedback}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className={`serif text-xl ${r.passed ? "text-primary" : "text-destructive"}`}>{Math.round(r.score)}</div>
              <div className="text-[10px] font-mono text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
