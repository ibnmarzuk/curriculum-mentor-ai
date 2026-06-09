import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, GraduationCap, Check, X, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfileTimeline, type TimelineEvent } from "@/lib/profile.functions";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Learn2Earn Mentor" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const fn = useServerFn(getProfileTimeline);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setAuthed(!!data.user);
    });
  }, []);

  const q = useQuery({
    queryKey: ["profile-timeline"],
    queryFn: () => fn(),
    enabled: authed === true,
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="serif text-4xl mb-6">Profile</h1>

        <div className="border border-border rounded-lg p-5 bg-surface/40 mb-8">
          <div className="text-xs font-mono text-muted-foreground mb-1">Signed in as</div>
          <div className="text-foreground">{email ?? "—"}</div>
        </div>

        {authed === false && (
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline">Sign in</Link> to see your learning timeline.
          </p>
        )}

        {authed && q.data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <Stat label="Subjects opened" value={q.data.stats.subjectsTouched} />
              <Stat label="Mentor messages" value={q.data.stats.mentorMessages} />
              <Stat label="Assessments taken" value={q.data.stats.assessmentsTaken} />
              <Stat label="Assessments passed" value={q.data.stats.assessmentsPassed} />
            </div>

            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
              Learning timeline
            </h2>

            {q.data.events.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing yet — open a project and chat with the mentor to start tracking your progress.
              </p>
            )}

            <ol className="relative border-l border-border ml-2 space-y-4">
              {q.data.events.map((e, i) => (
                <TimelineRow key={i} event={e} />
              ))}
            </ol>
          </>
        )}

        {authed && q.isLoading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> loading your timeline…
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-md p-3 bg-surface/30">
      <div className="serif text-2xl">{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const when = new Date(event.created_at).toLocaleString();
  return (
    <li className="ml-4">
      <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-surface border border-primary/60" />
      <div className="border border-border rounded-md p-3 bg-surface/30">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 text-xs font-mono">
            {event.kind === "mentor" && <MessageSquare size={12} className="text-primary" />}
            {event.kind === "assessment" && (event.passed ? <Check size={12} className="text-primary" /> : <X size={12} className="text-destructive" />)}
            {event.kind === "progress" && <CheckCircle2 size={12} className="text-primary" />}
            <span className="text-muted-foreground">
              {event.kind === "mentor" && (event.role === "user" ? "You asked the mentor" : "Mentor replied")}
              {event.kind === "assessment" && (
                <>Assessment <span className={event.passed ? "text-primary" : "text-destructive"}>{Math.round(event.score)}</span></>
              )}
              {event.kind === "progress" && `Progress saved (${event.completed_steps.length} step${event.completed_steps.length === 1 ? "" : "s"})`}
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{when}</span>
        </div>
        <Link
          to="/subjects/$"
          params={{ _splat: event.subject_path }}
          className="text-xs font-mono text-foreground hover:text-primary truncate block"
        >
          {event.subject_path}
        </Link>
        {event.kind === "mentor" && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{event.content}</p>
        )}
        {event.kind === "assessment" && event.feedback && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.feedback}</p>
        )}
      </div>
    </li>
  );
}

// silence unused import in some bundlers
void GraduationCap;
