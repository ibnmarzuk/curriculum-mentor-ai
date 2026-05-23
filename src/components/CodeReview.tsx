import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { reviewCode } from "@/lib/mentor.functions";
import { saveAttempt } from "@/lib/progress.functions";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownView } from "./MarkdownView";

const LANGS = ["auto", "go", "javascript", "typescript", "python", "rust", "java", "c", "sh", "sql", "html", "css"];

export function CodeReview({ subjectPath }: { subjectPath: string }) {
  const fn = useServerFn(reviewCode);
  const save = useServerFn(saveAttempt);
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function run() {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const lang = language === "auto" ? undefined : language;
      const { reply } = await fn({ data: { subjectPath, code, language: lang } });
      setResult(reply);
      // Auto-save attempt if signed in
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        try {
          await save({ data: { subjectPath, code, language: lang, feedback: reply } });
          setSaved(true);
          qc.invalidateQueries({ queryKey: ["progress", subjectPath] });
        } catch (e) {
          console.error("Failed to save attempt", e);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Review failed");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="grid lg:grid-cols-2 gap-6 h-full">
      <div className="flex flex-col gap-3 min-h-0">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-xs font-mono"
          >
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button
            onClick={run}
            disabled={loading || !code.trim()}
            className="ml-auto inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Review against brief
          </button>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your code here — it'll be checked against this project's actual requirements."
          className="flex-1 min-h-[400px] resize-none bg-[oklch(0.10_0.03_270)] border border-border rounded-md p-3 text-xs font-mono focus:outline-none focus:border-primary"
        />
      </div>
      <div className="min-h-0 overflow-y-auto border border-border rounded-md p-6 bg-surface/40">
        {!result && !loading && !error && (
          <p className="text-sm text-muted-foreground">Feedback will appear here — missing features, bugs, suggestions, and your next step.</p>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> reviewing…
          </div>
        )}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {result && (
          <>
            {saved && <div className="text-xs text-primary mb-2">✓ Saved to your progress</div>}
            <MarkdownView>{result}</MarkdownView>
          </>
        )}
      </div>
    </div>
  );
}
