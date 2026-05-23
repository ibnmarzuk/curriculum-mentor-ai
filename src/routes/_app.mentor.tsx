import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/mentor")({
  head: () => ({
    meta: [
      { title: "Mentor — Learn2Earn Mentor" },
      { name: "description", content: "Global mentor chat across the whole curriculum." },
    ],
  }),
  component: MentorPage,
});

function MentorPage() {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="serif text-3xl mb-2">Global mentor</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Cross-curriculum mentor chat (RAG over every project) ships in Slice 2. For now, open any project and use its <em>Mentor chat</em> tab — the mentor there is grounded in that specific brief.
        </p>
        <Link to="/browse" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90">
          Browse projects
        </Link>
      </div>
    </div>
  );
}
