import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/subjects/")({
  component: SubjectsIndex,
});

function SubjectsIndex() {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <BookOpen size={28} className="mx-auto text-primary mb-4" />
        <h2 className="serif text-3xl mb-3">Pick a project to begin</h2>
        <p className="text-sm text-muted-foreground">
          Expand a folder in the sidebar, then click a project to load its brief, talk to the mentor, and submit code for review.
        </p>
      </div>
    </div>
  );
}
