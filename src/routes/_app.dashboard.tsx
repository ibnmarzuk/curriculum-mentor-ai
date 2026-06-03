import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, MessageSquare, GraduationCap, Map } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Learn2Earn Mentor" },
      { name: "description", content: "Your learning progress at a glance." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="serif text-4xl mb-2">Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Streaks, active projects, and recommended next steps are coming in the next slice. For now, jump in:
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { to: "/browse", icon: Compass, title: "Browse projects", desc: "Search every project in the curriculum." },
            { to: "/mentor", icon: MessageSquare, title: "Talk to the mentor", desc: "Ask anything — grounded in real briefs." },
            { to: "/assessments", icon: GraduationCap, title: "Assessments", desc: "Test what you know (coming soon)." },
          ].map((c) => (
            <Link key={c.to} to={c.to} className="border border-border rounded-lg p-5 bg-surface/40 hover:bg-surface-2/60 hover:border-primary/40 transition-colors block">
              <c.icon size={18} className="text-primary mb-3" />
              <div className="serif text-xl mb-1">{c.title}</div>
              <div className="text-sm text-muted-foreground">{c.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
