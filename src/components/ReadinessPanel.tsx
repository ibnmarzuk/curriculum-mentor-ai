import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Check, Circle, Loader2, Sparkles } from "lucide-react";
import { computeReadiness, extractSubjectSkills } from "@/lib/curriculum.functions";
import { supabase } from "@/integrations/supabase/client";

export function ReadinessPanel({ subjectPath }: { subjectPath: string }) {
  const computeFn = useServerFn(computeReadiness);
  const extractFn = useServerFn(extractSubjectSkills);

  const [authed, setAuthed] = useState<boolean | null>(null);
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

  const extract = useMutation({
    mutationFn: () => extractFn({ data: { subjectPath } }),
    onSuccess: () => readiness.refetch(),
  });

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface/30 mb-6 text-sm text-muted-foreground">
        <Link to="/login" className="text-primary underline">
          Sign in
        </Link>{" "}
        to see your readiness score and required skills for this project.
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
            {extract.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            Map skills with AI
          </button>
        </div>
        {extract.isError && (
          <p className="text-xs text-destructive mt-2">
            {(extract.error as Error).message}
          </p>
        )}
      </div>
    );
  }

  const pct = Math.round(data.score * 100);
  const masteredSet = new Set(data.mastered);

  return (
    <div className="border border-border rounded-lg p-5 bg-surface/30 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="serif text-sm text-muted-foreground">Readiness</div>
          <div className="serif text-3xl">
            {pct}
            <span className="text-base text-muted-foreground">%</span>
          </div>
        </div>
        <div className="text-right text-xs font-mono text-muted-foreground">
          {data.mastered.length}/{data.required.length} skills
        </div>
      </div>

      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {data.required.map((s) => {
          const got = masteredSet.has(s.slug);
          return (
            <div key={s.slug} className="flex items-center gap-2 text-sm">
              {got ? (
                <Check size={14} className="text-primary shrink-0" />
              ) : (
                <Circle size={14} className="text-muted-foreground shrink-0" />
              )}
              <span className={got ? "" : "text-muted-foreground"}>{s.name}</span>
              <Link
                to="/tracks/$slug"
                params={{ slug: s.track }}
                className="text-[10px] font-mono text-muted-foreground hover:text-primary uppercase ml-auto"
              >
                {s.track}/{s.level}
              </Link>
            </div>
          );
        })}
      </div>

      {data.missing.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Recommendation: master the missing skills above before starting, or use the
          mentor tab for guided help.
        </p>
      )}
    </div>
  );
}
