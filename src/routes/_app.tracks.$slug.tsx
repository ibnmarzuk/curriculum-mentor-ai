import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Check, Circle, Lock, ArrowLeft } from "lucide-react";
import { getTrack, getMyMastery, setSkillMastery } from "@/lib/curriculum.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/tracks/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Learning Track` },
      { name: "description", content: `Skill roadmap for the ${params.slug} track.` },
    ],
  }),
  component: TrackDetailPage,
});

function TrackDetailPage() {
  const { slug } = Route.useParams();
  const getTrackFn = useServerFn(getTrack);
  const getMasteryFn = useServerFn(getMyMastery);
  const setMasteryFn = useServerFn(setSkillMastery);
  const qc = useQueryClient();

  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const trackQ = useQuery({
    queryKey: ["track", slug],
    queryFn: () => getTrackFn({ data: { slug } }),
  });

  const masteryQ = useQuery({
    queryKey: ["my-mastery"],
    queryFn: () => getMasteryFn(),
    enabled: authed === true,
  });

  const mutate = useMutation({
    mutationFn: (vars: { skillSlug: string; mastery: number }) =>
      setMasteryFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-mastery"] }),
  });

  const masteryMap = new Map(
    (masteryQ.data?.mastery ?? []).map((m) => [m.skill_slug, m.mastery]),
  );

  if (trackQ.isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!trackQ.data?.track) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Track not found.</p>
        <Link to="/tracks" className="text-primary text-sm">
          ← Back to tracks
        </Link>
      </div>
    );
  }

  const track = trackQ.data.track;
  const skills = trackQ.data.skills;
  const skillSet = new Set(skills.map((s) => s.slug));

  // A skill is "unlocked" if all its prerequisites (that exist in this track)
  // have mastery >= 0.7
  function isUnlocked(prereqs: string[]) {
    return prereqs
      .filter((p) => skillSet.has(p))
      .every((p) => (masteryMap.get(p) ?? 0) >= 0.7);
  }

  const totalMastery = skills.reduce(
    (acc, s) => acc + (masteryMap.get(s.slug) ?? 0),
    0,
  );
  const trackProgress = skills.length > 0 ? totalMastery / skills.length : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          to="/tracks"
          className="text-xs font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={12} /> All tracks
        </Link>
        <h1 className="serif text-4xl mb-2">{track.name}</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{track.description}</p>

        {authed && (
          <div className="mb-8 border border-border rounded-lg p-4 bg-surface/40">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-2">
              <span>Track progress</span>
              <span>{Math.round(trackProgress * 100)}%</span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round(trackProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        <ol className="space-y-2">
          {skills.map((s, i) => {
            const m = masteryMap.get(s.slug) ?? 0;
            const mastered = m >= 0.7;
            const unlocked = isUnlocked(s.prerequisites);
            const inProgress = m > 0 && !mastered;

            return (
              <li
                key={s.slug}
                className={`border rounded-lg p-4 transition-colors ${
                  mastered
                    ? "border-primary/40 bg-primary/5"
                    : unlocked
                      ? "border-border bg-surface/30"
                      : "border-border/40 bg-surface/10 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xs font-mono text-muted-foreground w-6 pt-1">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {mastered ? (
                      <Check size={18} className="text-primary" />
                    ) : !unlocked ? (
                      <Lock size={16} className="text-muted-foreground" />
                    ) : (
                      <Circle size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        {s.level}
                      </span>
                      {inProgress && (
                        <span className="text-[10px] font-mono text-primary">
                          {Math.round(m * 100)}%
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                    )}
                    {s.prerequisites.length > 0 && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-1">
                        requires: {s.prerequisites.join(", ")}
                      </p>
                    )}
                  </div>
                  {authed && unlocked && (
                    <div className="flex gap-1 shrink-0">
                      {!mastered && (
                        <button
                          onClick={() =>
                            mutate.mutate({ skillSlug: s.slug, mastery: 1 })
                          }
                          disabled={mutate.isPending}
                          className="text-[10px] font-mono border border-border hover:border-primary rounded px-2 py-1 transition-colors"
                        >
                          I know this
                        </button>
                      )}
                      {mastered && (
                        <button
                          onClick={() =>
                            mutate.mutate({ skillSlug: s.slug, mastery: 0 })
                          }
                          disabled={mutate.isPending}
                          className="text-[10px] font-mono text-muted-foreground hover:text-destructive rounded px-2 py-1"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {!authed && (
          <p className="mt-6 text-xs text-muted-foreground">
            <Link to="/login" className="text-primary underline">
              Sign in
            </Link>{" "}
            to track your progress through this roadmap.
          </p>
        )}
      </div>
    </div>
  );
}
