import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import Editor from "@monaco-editor/react";
import { ChevronLeft, Loader2, Play, Check, X } from "lucide-react";
import { getCheckpoint, submitCheckpoint } from "@/lib/checkpoint.functions";
import { MarkdownView } from "@/components/MarkdownView";

export const Route = createFileRoute("/_app/checkpoints/$slug")({
  head: () => ({ meta: [{ title: "Checkpoint — Learn2Earn Mentor" }] }),
  component: CheckpointDetail,
});

function CheckpointDetail() {
  const { slug } = useParams({ from: "/_app/checkpoints/$slug" });
  const getFn = useServerFn(getCheckpoint);
  const submitFn = useServerFn(submitCheckpoint);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["checkpoint", slug],
    queryFn: () => getFn({ data: { slug } }),
  });

  const [code, setCode] = useState<string>("");
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  useEffect(() => {
    if (q.data?.checkpoint?.starter_code) {
      setCode(q.data.checkpoint.starter_code);
      setStartedAt(Date.now());
    }
  }, [q.data?.checkpoint?.id]);

  const submit = useMutation({
    mutationFn: () =>
      submitFn({ data: { slug, code, durationMs: Date.now() - startedAt } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkpoint", slug] });
      qc.invalidateQueries({ queryKey: ["checkpoints"] });
      qc.invalidateQueries({ queryKey: ["checkpoint-lb"] });
    },
  });

  if (q.isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin mr-2" /> loading…
      </div>
    );
  }
  if (q.error || !q.data) {
    return <div className="p-6 text-sm text-destructive">{(q.error as Error)?.message ?? "Not found"}</div>;
  }

  const cp = q.data.checkpoint;
  const visible = (cp.visible_tests as Array<{ call: string; expected: unknown }>) ?? [];
  const hints = (cp.hints as string[]) ?? [];
  const submissions = q.data.submissions;
  const bestScore = submissions.reduce((m, s) => Math.max(m, Number(s.score)), 0);
  const result = submit.data;

  return (
    <div className="h-full grid lg:grid-cols-2 gap-0 min-h-0">
      <div className="overflow-y-auto p-6 border-r border-border">
        <Link to="/checkpoints" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft size={12} /> All checkpoints
        </Link>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
          Level {cp.level} · {cp.difficulty} · {cp.language}
        </div>
        <h1 className="serif text-2xl mb-3">{cp.title}</h1>
        <MarkdownView>{cp.description}</MarkdownView>

        {cp.function_signature && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Signature</div>
            <pre className="text-xs bg-surface-2/60 p-3 rounded overflow-x-auto"><code>{cp.function_signature}</code></pre>
          </div>
        )}

        {cp.examples && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Examples</div>
            <pre className="text-xs bg-surface-2/60 p-3 rounded whitespace-pre-wrap"><code>{cp.examples}</code></pre>
          </div>
        )}

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Visible tests</div>
          <ul className="space-y-1 text-xs font-mono">
            {visible.map((t, i) => {
              const r = result?.visibleResults?.[i];
              return (
                <li key={i} className="flex items-start gap-2">
                  {r ? (r.passed ? <Check size={12} className="text-primary mt-0.5" /> : <X size={12} className="text-destructive mt-0.5" />)
                     : <span className="w-3 h-3 rounded-full border border-border mt-0.5" />}
                  <span>{t.call} <span className="text-muted-foreground">→ {JSON.stringify(t.expected)}</span></span>
                </li>
              );
            })}
          </ul>
        </div>

        {hints.length > 0 && (
          <details className="mt-4 border border-border rounded-md p-3">
            <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">Hints ({hints.length})</summary>
            <ul className="mt-2 space-y-1 text-sm list-disc pl-5">
              {hints.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </details>
        )}

        {result && (
          <div className="mt-6 border border-border rounded-md p-4 bg-surface/40">
            <div className="flex items-center gap-3 mb-2">
              <div className={`serif text-3xl ${result.passed ? "text-primary" : "text-destructive"}`}>{result.grade}</div>
              <div>
                <div className="text-sm">{result.score}% — attempt #{result.attemptNumber}</div>
                <div className="text-xs text-muted-foreground">
                  Visible {result.passedVisible}/{result.totalVisible} · Hidden {result.passedHidden}/{result.totalHidden}
                </div>
              </div>
            </div>
            <MarkdownView>{result.feedback}</MarkdownView>
          </div>
        )}

        {submissions.length > 0 && (
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Attempt history · best {bestScore}
            </div>
            <ol className="space-y-1">
              {submissions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 text-xs border border-border rounded-md px-3 py-1.5">
                  <span className="font-mono text-muted-foreground">#{s.attempt_number}</span>
                  {s.passed ? <Check size={12} className="text-primary" /> : <X size={12} className="text-destructive" />}
                  <span>{s.grade}</span>
                  <span className="text-muted-foreground">
                    V {s.passed_visible}/{s.total_visible} · H {s.passed_hidden}/{s.total_hidden}
                  </span>
                  <span className="ml-auto text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <div className="text-xs font-mono text-muted-foreground">{cp.language}</div>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !code.trim()}
            className="ml-auto inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            {submit.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Submit
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            theme="vs-dark"
            language={cp.language}
            value={code}
            onChange={(v) => setCode(v ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, scrollBeyondLastLine: false }}
          />
        </div>
        {submit.error && (
          <div className="p-3 text-xs text-destructive border-t border-border">{(submit.error as Error).message}</div>
        )}
      </div>
    </div>
  );
}
