import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogIn, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (email) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-muted-foreground hidden sm:inline">{email}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Sign out"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    );
  }
  return (
    <Link
      to="/login"
      className="inline-flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/30 text-foreground rounded-md px-3 py-1.5 hover:bg-primary/20"
    >
      <LogIn size={13} /> Sign in
    </Link>
  );
}
