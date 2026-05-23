import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/assessments")({
  head: () => ({ meta: [{ title: "Assessments — Learn2Earn Mentor" }] }),
  component: () => (
    <div className="h-full flex items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="serif text-3xl mb-2">Assessments</h1>
        <p className="text-sm text-muted-foreground">Coding challenges and quizzes (Slice 3) — coming soon.</p>
      </div>
    </div>
  ),
});
