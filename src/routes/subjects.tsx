import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { SubjectTree } from "@/components/SubjectTree";
import { AuthButton } from "@/components/AuthButton";

export const Route = createFileRoute("/subjects")({
  head: () => ({
    meta: [
      { title: "Curriculum — Learn2Earn Mentor" },
      { name: "description", content: "Browse every 01-edu project. Pick one and start learning with an AI mentor grounded in the real brief." },
    ],
  }),
  component: SubjectsLayout,
});

function SubjectsLayout() {
  const params = useParams({ strict: false }) as { _splat?: string };
  const currentPath = params._splat;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <Link to="/" className="serif italic text-lg">Learn2Earn <span className="text-primary">Mentor</span></Link>
          <div className="font-mono text-xs text-muted-foreground truncate">
            {currentPath ? `subjects/${currentPath}` : "select a project"}
          </div>
        </div>
      </header>
      <div className="flex-1 flex min-h-0">
        <aside className="w-72 border-r border-border overflow-y-auto shrink-0">
          <SubjectTree currentPath={currentPath} />
        </aside>
        <main className="flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
