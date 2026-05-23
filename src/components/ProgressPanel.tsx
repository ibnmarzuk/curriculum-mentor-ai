import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getProgress,
  toggleStep,
  suggestNextTasks,
  deleteAttempt,
  getSubjectSteps,
} from "@/lib/progress.functions";
import { MarkdownView } from "./MarkdownView";

export function ProgressPanel({ subjectPath }: { subjectPath: string }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (userId === undefined) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={16} />
      </div>
    );
  }
  if (userId === null) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 className="serif text-2xl mb-2">Sign in to track your progress</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Check off requirements as you finish them, keep a history of code attempts, and get the mentor's suggested next steps — grounded in this project's brief.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Sign in to continue
          </Link>
        </div>
      </div>
    );
  }
  return <Authed subjectPath={subjectPath} />;
}

function Authed({ subjectPath }: { subjectPath: string }) {
  const qc = useQueryClient();
  const fetchProgress = useServerFn(getProgress);
  const fetchSteps = useServerFn(getSubjectSteps);
  const toggle = useServerFn(toggleStep);
  const suggest = useServerFn(suggestNextTasks);
  const del = useServerFn(deleteAttempt);

  const progressQ = useQuery({
    queryKey: ["progress", subjectPath],
    queryFn: () => fetchProgress({ data: { subjectPath } }),
  });
  const stepsQ = useQuery({
    queryKey: ["subject-steps", subjectPath],
    queryFn: () => fetchSteps({ data: { subjectPath } }),
    staleTime: 60 * 60 * 1000,
  });

  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = new Set(progressQ.data?.progress.completed_steps ?? []);
  const nextTasks = progressQ.data?.progress.next_tasks ?? [];
  const attempts = progressQ.data?.attempts ?? [];
  const candidateSteps = stepsQ.data?.steps ?? [];

  // Merge: show all candidate steps, plus any completed step that isn't in the brief anymore
  const allSteps = Array.from(new Set([...candidateSteps, ...Array.from(completed)]));

  async function onToggle(step: string, done: boolean) {
    setError(null);
    // optimistic
    qc.setQueryData(["progress", subjectPath], (old: any) => {
      if (!old) return old;
      const cur: string[] = old.progress.completed_steps ?? [];
      const nextList = done ? Array.from(new Set([...cur, step])) : cur.filter((s) => s !== step);
      return { ...old, progress: { ...old.progress, completed_steps: nextList } };
    });
    try {
      await toggle({ data: { subjectPath, step, done } });
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
      progressQ.refetch();
    }
  }

  async function onSuggest() {
    setError(null);
    setSuggesting(true);
    try {
      await suggest({ data: { subjectPath } });
      await progressQ.refetch();
    } catch (e: any) {
      setError(e?.message ?? "Failed to suggest tasks");
    } finally {
      setSuggesting(false);
    }
  }

  async function onDeleteAttempt(id: string) {
    try {
      await del({ data: { id } });
      progressQ.refetch();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
    }
  }

  if (progressQ.isLoading || stepsQ.isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={16} /> loading progress…
      </div>
    );
  }

  const completedCount = allSteps.filter((s) => completed.has(s)).length;
  const pct = allSteps.length ? Math.round((completedCount / allSteps.length) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-3xl space-y-8">
        {error && <div className="text-sm text-destructive">{error}</div>}

        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="serif text-2xl">Checklist</h2>
              <p className="text-xs text-muted-foreground">Extracted from the brief. Tick items as you finish them.</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-muted-foreground">{completedCount} / {allSteps.length}</div>
              <div className="w-32 h-1.5 bg-surface-2 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
          {allSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checklist items found in the brief.</p>
          ) : (
            <ul className="space-y-1">
              {allSteps.map((step) => {
                const done = completed.has(step);
                return (
                  <li key={step}>
                    <button
                      onClick={() => onToggle(step, !done)}
                      className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface-2/50 group"
                    >
                      {done ? (
                        <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                      ) : (
                        <Circle size={16} className="text-muted-foreground shrink-0 mt-0.5 group-hover:text-foreground" />
                      )}
                      <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{step}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="serif text-2xl">Next suggested tasks</h2>
              <p className="text-xs text-muted-foreground">Generated by the mentor from the brief, what you've done, and your recent attempts.</p>
            </div>
            <button
              onClick={onSuggest}
              disabled={suggesting}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {nextTasks.length ? "Regenerate" : "Suggest tasks"}
            </button>
          </div>
          {nextTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions yet. Click <em>Suggest tasks</em> to get started.</p>
          ) : (
            <ol className="space-y-1.5">
              {nextTasks.map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-sm border border-border rounded-md px-3 py-2 bg-surface/40">
                  <span className="serif italic text-primary text-xs mt-0.5">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h2 className="serif text-2xl mb-1">Saved attempts</h2>
          <p className="text-xs text-muted-foreground mb-3">Every review you run is saved here, with the mentor's feedback.</p>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attempts yet — head to the <em>Code review</em> tab and submit one.</p>
          ) : (
            <ul className="space-y-3">
              {attempts.map((a) => (
                <AttemptItem key={a.id} attempt={a} onDelete={() => onDeleteAttempt(a.id)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function AttemptItem({
  attempt,
  onDelete,
}: {
  attempt: { id: string; language: string | null; code: string; feedback: string | null; created_at: string };
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border border-border rounded-md bg-surface/40">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="text-left flex-1 min-w-0">
          <div className="text-xs font-mono text-muted-foreground">
            {new Date(attempt.created_at).toLocaleString()} · {attempt.language ?? "auto"}
          </div>
          <div className="text-sm truncate text-foreground">{attempt.code.split("\n")[0].slice(0, 100)}</div>
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
      {open && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          <pre className="text-xs font-mono bg-[oklch(0.10_0.03_270)] border border-border rounded p-3 overflow-x-auto max-h-64">
            {attempt.code}
          </pre>
          {attempt.feedback && (
            <div>
              <div className="serif italic text-primary/80 text-xs mb-1">Mentor feedback</div>
              <MarkdownView>{attempt.feedback}</MarkdownView>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
