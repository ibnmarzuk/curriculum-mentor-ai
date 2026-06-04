import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Loader2, Sparkles, BookOpen } from "lucide-react";
import { ragMentor, getRagStatus, embedMissingSubjects } from "@/lib/rag.functions";
import { MarkdownView } from "@/components/MarkdownView";

export const Route = createFileRoute("/_app/mentor")({
  head: () => ({
    meta: [
      { title: "Mentor — Learn2Earn Mentor" },
      { name: "description", content: "Ask the AI mentor anything — answers are grounded in the indexed curriculum via RAG." },
    ],
  }),
  component: MentorPage,
});

type Msg = { role: "user" | "assistant"; content: string; sources?: Array<{ subject_path: string; similarity: number }> };

function MentorPage() {
  const chat = useServerFn(ragMentor);
  const backfill = useServerFn(embedMissingSubjects);
  const statusFn = useServerFn(getRagStatus);

  const status = useQuery({ queryKey: ["rag-status"], queryFn: () => statusFn() });

  const embed = useMutation({
    mutationFn: () => backfill({ data: { limit: 10 } }),
    onSuccess: () => status.refetch(),
  });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const { reply, sources } = await chat({ data: { messages: next.map((m) => ({ role: m.role, content: m.content })) } });
      setMessages([...next, { role: "assistant", content: reply, sources }]);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const empty = messages.length === 0;
  const embedded = status.data?.embeddedSubjects ?? 0;
  const total = status.data?.totalSubjects ?? 0;
  const pct = total > 0 ? Math.round((embedded / total) * 100) : 0;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="border-b border-border px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={14} className="text-primary" />
          <span className="serif">Global mentor</span>
          <span className="text-xs text-muted-foreground font-mono">RAG over {embedded}/{total} projects ({pct}%)</span>
        </div>
        <button
          onClick={() => embed.mutate()}
          disabled={embed.isPending}
          className="ml-auto text-xs font-mono border border-border hover:border-primary rounded px-3 py-1.5 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {embed.isPending ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
          {embed.isPending ? "Embedding…" : "Embed next 10"}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {empty && (
          <div className="max-w-2xl mx-auto text-sm text-muted-foreground">
            <p className="serif italic text-2xl text-foreground mb-3">Ask me anything about the curriculum.</p>
            <p className="mb-4">
              I search across every indexed project brief to ground my answers. If a project hasn't been embedded yet,
              click <em>Embed next 10</em> above.
            </p>
            {embedded === 0 && (
              <p className="mb-4 text-amber-500/80">
                ⚠️ No projects are embedded yet. Click <em>Embed next 10</em> to start, or{" "}
                <Link to="/browse" className="text-primary underline">browse</Link> the catalog.
              </p>
            )}
            <div className="grid gap-2">
              {[
                "Which projects teach JWT authentication?",
                "I want to learn React hooks — what should I build?",
                "Compare the linked-list projects across languages.",
                "What's the easiest Go project to start with?",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left text-xs font-mono border border-border rounded px-3 py-2 hover:border-primary hover:bg-surface-2/60 transition-colors"
                >
                  → {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="max-w-3xl mx-auto">
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div className="bg-primary/15 border border-primary/30 rounded-lg px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : (
              <div>
                <div className="serif italic text-primary/80 text-sm mb-1">Mentor</div>
                <MarkdownView>{m.content}</MarkdownView>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1.5">Sources</div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.sources.map((s, idx) => (
                        <Link
                          key={`${s.subject_path}-${idx}`}
                          to="/subjects/$"
                          params={{ _splat: s.subject_path }}
                          className="text-[11px] font-mono border border-border rounded px-2 py-0.5 hover:border-primary text-muted-foreground hover:text-foreground"
                        >
                          [{idx + 1}] {s.subject_path}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> retrieving & thinking…
          </div>
        )}
        {error && <div className="max-w-3xl mx-auto text-sm text-destructive">{error}</div>}
      </div>

      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask across the curriculum…"
            rows={2}
            className="flex-1 resize-none bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="self-end bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
