import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Learn2Earn Mentor" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="serif text-4xl mb-6">Profile</h1>
        <div className="border border-border rounded-lg p-5 bg-surface/40">
          <div className="text-xs font-mono text-muted-foreground mb-1">Signed in as</div>
          <div className="text-foreground">{email ?? "—"}</div>
        </div>
        <p className="text-xs text-muted-foreground mt-6">Badges, streak history, and password reset land in Slice 4.</p>
      </div>
    </div>
  );
}
