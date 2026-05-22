import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2 } from "lucide-react";
import { mentorChat } from "@/lib/mentor.functions";
import { MarkdownView } from "./MarkdownView";

type Msg = { role: "user" | "assistant"; content: string };

export function MentorChat({ subjectPath }: { subjectPath: string }) {
  const fn = useServerFn(mentorChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [subjectPath]);

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
      const { reply } = await fn({ data: { subjectPath, messages: next } });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-muted-foreground text-sm max-w-xl">
            <p className="serif italic text-2xl text-foreground mb-3">Hi — I'm your mentor.</p>
            <p>Ask me anything about this project. I'll teach you using only the brief — no invented requirements, no full solutions, just hints that help you think.</p>
            <div className="mt-6 grid gap-2">
              {[
                "Walk me through the requirements step by step.",
                "What should I tackle first?",
                "I'm stuck — give me a hint without spoiling it.",
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
            placeholder="Ask the mentor…"
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
