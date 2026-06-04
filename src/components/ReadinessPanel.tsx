import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Sparkles, ArrowRight, Lock } from "lucide-react";
import { computeReadiness, extractSubjectSkills } from "@/lib/curriculum.functions";
import { getRecommendation } from "@/lib/assessment.functions";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownView } from "./MarkdownView";

export function ReadinessPanel({ subjectPath }: { subjectPath: string }) {
  const computeFn = useServerFn(computeReadiness);
  const extractFn = useServerFn(extractSubjectSkills);
  const recFn = useServerFn(getRecommendation);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const readiness = useQuery({
    queryKey: ["readiness", subjectPath],
    queryFn: () => computeFn({ data: { subjectPath } }),
    enabled: authed === true,
  });

  const recommendation = useQuery({
    queryKey: ["recommendation", subjectPath],
    queryFn: () => recFn({ data: { subjectPath } }),
    enabled: authed === true && !!readiness.data && !readiness.data.unmapped,
  });

  const extract = useMutation({
    mutationFn: () => extractFn({ data: { subjectPath } }),
    onSuccess: () => readiness.refetch(),
  });

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface/30 mb-6 text-sm text-muted-foreground">
        <Link to="/login" className="text-primary underline">Sign in</Link>{" "}
        to see your readiness score, learning order, and recommended next lesson.
      </div>
    );
  }

  if (readiness.isLoading) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface/30 mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Computing readiness…
      </div>
    );
  }

  const data = readiness.data;
  if (!data) return null;

  if (data.unmapped) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface/30 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            This project hasn't been mapped to skills yet.
          </div>
          <button
            onClick={() => extract.mutate()}
            disabled={extract.isPending}
            className="text-xs font-mono border border-border hover:border-primary rounded px-3 py-1.5 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {extract.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Map skills with AI
          </button>
        </div>
        {extract.isError && (
          <p className="text-xs text-destructive mt-2">{(extract.error as Error).message}</p>
        )}
      </div>
    );
  }

  const pct = Math.round(data.score * 100);
  const masteredSet = new Set(data.mastered);
  const rec = recommendation.data && !recommendation.data.unmapped ? recommendation.data : null;

  return (
    <div className="border border-border rounded-lg p-5 bg-surface/30 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="serif text-sm text-muted-foreground">Readiness</div>
          <div className="serif text-3xl">
            {pct}<span className="text-base text-muted-foreground">%</span>
          </div>
        </div>
        <div className="text-right text-xs font-mono text-muted-foreground">
          {data.mastered.length}/{data.required.length} required skills
        </div>
      </div>

      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Required skills overview */}
      <div className="space-y-1.5 mb-5">
        {data.required.map((s) => {
          const got = masteredSet.has(s.slug);
          return (
            <div key={s.slug} className="flex items-center gap-2 text-sm">
              {got ? <Check size={14} className="text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />}
              <span className={got ? "" : "text-muted-foreground"}>{s.name}</span>
              <Link to="/tracks/$slug" params={{ slug: s.track }} className="text-[10px] font-mono text-muted-foreground hover:text-primary uppercase ml-auto">
                {s.track}/{s.level}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Recommendation block */}
      {recommendation.isLoading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Planning your next step…
        </div>
      )}

      {rec && rec.next && (
        <div className="border-t border-border pt-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Recommended next lesson
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-primary" />
            <Link to="/tracks/$slug" params={{ slug: rec.next.track }} className="serif text-lg hover:text-primary">
              {rec.next.name}
            </Link>
            <span className="text-[10px] font-mono text-muted-foreground uppercase ml-auto">
              {rec.next.track}/{rec.next.level}
            </span>
          </div>
          <button
            onClick={() => setShowWhy((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            {showWhy ? "Hide reasoning" : "Why this lesson?"}
          </button>

          {showWhy && (
            <div className="mt-3 space-y-3">
              <div className="text-sm bg-surface/50 border border-border rounded-md p-3">
                <MarkdownView>{rec.reasoning}</MarkdownView>
              </div>

              {rec.missingOrdered.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                    Learning order ({rec.missingOrdered.length} missing)
                  </div>
                  <ol className="space-y-1.5">
                    {rec.missingOrdered.map((m, i) => (
                      <li key={m.slug} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-[10px] text-muted-foreground w-5 text-right">{i + 1}.</span>
                        {i === 0 ? <ArrowRight size={12} className="text-primary" /> : <Lock size={11} className="text-muted-foreground" />}
                        <Link to="/tracks/$slug" params={{ slug: m.track }} className="hover:text-primary">
                          {m.name}
                        </Link>
                        {m.direct && (
                          <span className="text-[9px] font-mono uppercase text-primary border border-primary/30 rounded px-1">required</span>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground uppercase ml-auto">
                          {m.level}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {rec.recentFeedback?.[0]?.excerpt && (
                <div className="text-xs text-muted-foreground border-l-2 border-border pl-3">
                  <div className="uppercase font-mono text-[10px] mb-1">Recent mentor feedback considered</div>
                  <div className="italic line-clamp-3">{rec.recentFeedback[0].excerpt}…</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {rec && !rec.next && (
        <div className="border-t border-border pt-4 text-sm text-muted-foreground flex items-center gap-2">
          <Check size={14} className="text-primary" />
          All prerequisites mastered — you're ready to build.
        </div>
      )}
    </div>
  );
}
