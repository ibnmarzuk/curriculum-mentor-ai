import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Trash2 } from "lucide-react";
import { mentorChat, getMentorHistory, clearMentorHistory } from "@/lib/mentor.functions";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownView } from "./MarkdownView";

type Rubric = {
  questions: Array<{ id: string; text: string; skills: string[] }>;
  feedback: Array<{ id: string; verdict: string; skillsTested: string[]; skillsMissed: string[] }>;
};
type Msg = { role: "user" | "assistant"; content: string; metadata?: { rubric?: Rubric } | null };

export function MentorChat({ subjectPath }: { subjectPath: string }) {
  const fn = useServerFn(mentorChat);
  const histFn = useServerFn(getMentorHistory);
  const clearFn = useServerFn(clearMentorHistory);
  const qc = useQueryClient();

  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const history = useQuery({
    queryKey: ["mentor-history", subjectPath],
    queryFn: () => histFn({ data: { subjectPath } }),
    enabled: !!authed,
    staleTime: 30_000,
  });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate from saved history when subject or auth changes.
  useEffect(() => {
    if (history.data?.messages) {
      setMessages(
        history.data.messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          metadata: m.metadata ?? null,
        })),
      );
    } else if (authed === false) {
      setMessages([]);
    }
    setError(null);
  }, [subjectPath, authed, history.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = (await fn({ data: { subjectPath, messages: next.map((m) => ({ role: m.role, content: m.content })) } })) as {
        reply: string;
        rubric?: Rubric;
      };
      setMessages([...next, { role: "assistant", content: res.reply, metadata: { rubric: res.rubric } }]);
      qc.invalidateQueries({ queryKey: ["mentor-history", subjectPath] });
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function clearChat() {
    if (!confirm("Clear this conversation? This cannot be undone.")) return;
    await clearFn({ data: { subjectPath } });
    setMessages([]);
    qc.invalidateQueries({ queryKey: ["mentor-history", subjectPath] });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-2 border-b border-border shrink-0">
        <div className="text-xs text-muted-foreground">
          {authed ? "Chat history is saved to your profile." : "Sign in to save your conversation."}
        </div>
        {authed && messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs font-mono text-muted-foreground hover:text-destructive flex items-center gap-1"
          >
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && !history.isLoading && (
          <div className="text-muted-foreground text-sm max-w-xl">
            <p className="serif italic text-2xl text-foreground mb-3">Hi — I'm your mentor.</p>
            <p>I'll start by explaining the concept this project is teaching, then ask you a couple of questions to make sure it landed. Send any message to begin.</p>
            <div className="mt-6 grid gap-2">
              {[
                "Explain this project to me.",
                "What concept am I about to learn?",
                "Quiz me before I start coding.",
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
          <div key={i}>
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
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> thinking…
          </div>
        )}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={authed ? "Ask the mentor…" : "Sign in to chat with the mentor"}
            rows={2}
            disabled={!authed}
            className="flex-1 resize-none bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || !authed}
            className="self-end bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
