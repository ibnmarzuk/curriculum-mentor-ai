import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { getSubject } from "@/lib/github.functions";
import { MarkdownView } from "@/components/MarkdownView";
import { MentorChat } from "@/components/MentorChat";
import { CodeReview } from "@/components/CodeReview";
import { ProgressPanel } from "@/components/ProgressPanel";

const subjectQuery = (path: string) =>
  queryOptions({
    queryKey: ["subject", path],
    queryFn: () => getSubject({ data: { path } }),
    staleTime: 60 * 60 * 1000,
  });

export const Route = createFileRoute("/subjects/$")({
  loader: ({ params, context }) => {
    const path = (params._splat ?? "").replace(/^\/+|\/+$/g, "");
    if (!path) throw notFound();
    return context.queryClient.ensureQueryData(subjectQuery(path));
  },
  head: ({ params }) => {
    const path = (params._splat ?? "").replace(/^\/+|\/+$/g, "");
    const title = path.split("/").pop() ?? "Subject";
    return {
      meta: [
        { title: `${title} — Learn2Earn Mentor` },
        { name: "description", content: `Project brief, AI mentor, and code review for subjects/${path}.` },
        { property: "og:title", content: `${title} — Learn2Earn Mentor` },
        { property: "og:description", content: `subjects/${path}` },
      ],
    };
  },
  component: SubjectPage,
  pendingComponent: () => (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <Loader2 className="animate-spin mr-2" size={16} /> loading brief…
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 className="serif text-2xl mb-2">Couldn't load this project</h2>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <button onClick={() => { router.invalidate(); reset(); }} className="text-sm bg-primary text-primary-foreground rounded-md px-4 py-2">Try again</button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No project selected.</div>
  ),
});

type Tab = "brief" | "mentor" | "review" | "progress";

function SubjectPage() {
  const params = Route.useParams();
  const path = (params._splat ?? "").replace(/^\/+|\/+$/g, "");
  const { data } = useSuspenseQuery(subjectQuery(path));
  const [tab, setTab] = useState<Tab>("brief");

  const tabs: { id: Tab; label: string }[] = [
    { id: "brief", label: "Brief" },
    { id: "mentor", label: "Mentor chat" },
    { id: "review", label: "Code review" },
    { id: "progress", label: "Progress" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="border-b border-border px-6 flex items-center gap-1 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "brief" && (
          <div className="h-full overflow-y-auto px-8 py-8 max-w-4xl">
            {data.markdown ? (
              <MarkdownView>{data.markdown}</MarkdownView>
            ) : (
              <p className="text-sm text-muted-foreground">
                No README found for <span className="font-mono">subjects/{path}</span>. Try a child folder in the sidebar.
              </p>
            )}
          </div>
        )}
        {tab === "mentor" && <MentorChat subjectPath={path} />}
        {tab === "review" && (
          <div className="h-full p-6">
            <CodeReview subjectPath={path} />
          </div>
        )}
        {tab === "progress" && <ProgressPanel subjectPath={path} />}
      </div>
    </div>
  );
}
