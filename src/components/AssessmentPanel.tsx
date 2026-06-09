import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import Editor from "@monaco-editor/react";
import { Loader2, Sparkles, Play, Check, X } from "lucide-react";
import { getOrCreateAssessment, gradeAssessment } from "@/lib/assessment.functions";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownView } from "./MarkdownView";

export function AssessmentPanel({ subjectPath }: { subjectPath: string }) {
  const getFn = useServerFn(getOrCreateAssessment);
  const gradeFn = useServerFn(gradeAssessment);
  const qc = useQueryClient();

  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const aq = useQuery({
    queryKey: ["assessment", subjectPath],
    queryFn: () => getFn({ data: { subjectPath } }),
    staleTime: 60 * 60 * 1000,
  });

  const [code, setCode] = useState<string>("");
  useEffect(() => {
    if (aq.data?.assessment?.starter_code) setCode(aq.data.assessment.starter_code);
  }, [aq.data?.assessment?.id]);

  const grade = useMutation({
    mutationFn: () =>
      gradeFn({ data: { assessmentId: aq.data!.assessment.id, code } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["readiness", subjectPath] });
      qc.invalidateQueries({ queryKey: ["recommendation", subjectPath] });
      qc.invalidateQueries({ queryKey: ["my-assessment-results"] });
    },
  });

  if (aq.isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin mr-2" /> generating assessment…
      </div>
    );
  }
  if (aq.error) {
    return <div className="p-6 text-sm text-destructive">{(aq.error as Error).message}</div>;
  }
  const assessment = aq.data?.assessment;
  if (!assessment) return null;

  const rubric = (assessment.rubric as Array<{ id: string; description: string; weight: number }>) ?? [];
  const result = grade.data;
  const criteriaMap = new Map(
    (result?.criteria ?? []).map((c) => [c.id, c]),
  );

  return (
    <div className="h-full grid lg:grid-cols-2 gap-0 min-h-0">
      <div className="overflow-y-auto p-6 border-r border-border">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
          Assessment · {assessment.language}
        </div>
        <h2 className="serif text-2xl mb-3">{assessment.title}</h2>
        <MarkdownView>{assessment.prompt}</MarkdownView>

        {assessment.getting_started && (
          <div className="mt-6 border border-border rounded-md p-4 bg-surface/40">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">How to start</div>
            <MarkdownView>{assessment.getting_started}</MarkdownView>
          </div>
        )}

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Rubric</div>
          <ul className="space-y-1.5">
            {rubric.map((r) => {
              const c = criteriaMap.get(r.id);
              return (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  {c ? (
                    c.passed ? <Check size={14} className="text-primary mt-0.5 shrink-0" /> : <X size={14} className="text-destructive mt-0.5 shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-border mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div>{r.description}</div>
                    {c?.note && <div className="text-xs text-muted-foreground mt-0.5">{c.note}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="border border-border rounded-md p-4 bg-surface/40">
              <div className="flex items-center gap-3 mb-2">
                <div className={`serif text-3xl ${result.passed ? "text-primary" : "text-destructive"}`}>{Math.round(result.score)}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {result.passed ? "Passed · mastery updated" : "Not yet — keep iterating"}
                </div>
              </div>
              <MarkdownView>{result.feedback}</MarkdownView>
            </div>

            {result.improvements?.length > 0 && (
              <div className="border border-border rounded-md p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Where to improve</div>
                <ul className="space-y-1.5 text-sm list-disc pl-5">
                  {result.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                </ul>
              </div>
            )}

            {result.comparison && (
              <div className="border border-border rounded-md p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your approach vs reference</div>
                <MarkdownView>{result.comparison}</MarkdownView>
              </div>
            )}

            {result.solution && (
              <details className="border border-border rounded-md p-4">
                <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">Reference solution</summary>
                <pre className="mt-3 text-xs bg-surface-2/60 p-3 rounded overflow-x-auto"><code>{result.solution}</code></pre>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <div className="text-xs font-mono text-muted-foreground">{assessment.language}</div>
          <button
            onClick={() => grade.mutate()}
            disabled={grade.isPending || !code.trim() || authed === false}
            className="ml-auto inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            {grade.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Submit for grading
          </button>
        </div>
        {authed === false && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
            Sign in to save your results and update readiness.
          </div>
        )}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            theme="vs-dark"
            language={assessment.language}
            value={code}
            onChange={(v) => setCode(v ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              tabSize: 2,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
        {grade.error && (
          <div className="p-3 text-xs text-destructive border-t border-border">
            {(grade.error as Error).message}
          </div>
        )}
      </div>
    </div>
  );
}
