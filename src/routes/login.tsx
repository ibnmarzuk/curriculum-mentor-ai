import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Learn2Earn Mentor" },
      { name: "description", content: "Sign in to track your progress through 01-edu projects." },
    ],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/subjects` },
        });
        if (error) throw error;
        setInfo("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/subjects" });
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-6 py-3">
        <Link to="/" className="serif italic text-lg">
          Learn2Earn <span className="text-primary">Mentor</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="serif text-3xl mb-1">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin"
              ? "Sign in to save your progress and code attempts."
              : "Track every project you tackle, with grounded AI guidance."}
          </p>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            {error && <div className="text-sm text-destructive">{error}</div>}
            {info && <div className="text-sm text-primary">{info}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
            className="mt-4 text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "No account? Sign up →" : "Already have an account? Sign in →"}
          </button>
        </div>
      </main>
    </div>
  );
}
