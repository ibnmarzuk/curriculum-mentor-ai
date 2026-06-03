import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowRight } from "lucide-react";
import { listTracks } from "@/lib/curriculum.functions";

export const Route = createFileRoute("/_app/tracks")({
  head: () => ({
    meta: [
      { title: "Learning Tracks — Learn2Earn Mentor" },
      {
        name: "description",
        content: "Roadmaps for frontend, backend, full-stack, AI, DevOps, mobile, and Web3.",
      },
    ],
  }),
  component: TracksPage,
});

function TracksPage() {
  const fn = useServerFn(listTracks);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tracks"],
    queryFn: () => fn(),
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="serif text-4xl mb-2">Learning Tracks</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-2xl">
          Pick a roadmap. Each track is an ordered list of skills you can master through projects,
          mentor chats, and self-attestation.
        </p>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading tracks…
          </div>
        )}
        {error && <div className="text-sm text-destructive">{(error as Error).message}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          {data?.tracks.map((t) => (
            <Link
              key={t.slug}
              to="/tracks/$slug"
              params={{ slug: t.slug }}
              className="block border border-border rounded-lg p-5 bg-surface/40 hover:bg-surface-2/60 hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="serif text-2xl mb-1">{t.name}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2">{t.description}</div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1"
                />
              </div>
              <div className="mt-4 text-xs font-mono text-muted-foreground">
                {t.skill_slugs.length} skills
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
