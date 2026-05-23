import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, MessageSquare, Code2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Learn2Earn Mentor — AI tutor grounded in real projects" },
      { name: "description", content: "An AI mentor that teaches the 01-edu curriculum using actual project briefs — hints, not solutions, and code review against real requirements." },
      { property: "og:title", content: "Learn2Earn Mentor" },
      { property: "og:description", content: "Curriculum-aware AI mentor for the 01-edu public repository." },
    ],
  }),
  component: Landing,
});

const TRACKS = [
  { name: "Go", path: "go", desc: "Systems, syntax, and the standard library." },
  { name: "JavaScript", path: "javascript", desc: "From DOM to async to interview-grade fundamentals." },
  { name: "Rust", path: "rust", desc: "Ownership, borrowing, and zero-cost abstractions." },
  { name: "DevOps", path: "devops", desc: "Linux, networking, containers, CI." },
  { name: "AI", path: "ai", desc: "Hands-on machine learning project briefs." },
  { name: "Piscine Go", path: "piscine-go", desc: "The full Go bootcamp." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="serif italic text-xl">Learn2Earn <span className="text-primary">Mentor</span></Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/browse" className="text-muted-foreground hover:text-foreground">Curriculum</Link>
            <a href="https://github.com/01-edu/public" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Repo</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary/80 mb-6">01-edu · Learn2Earn · grounded in the repository</p>
        <h1 className="serif text-6xl md:text-7xl leading-[1.05] max-w-4xl">
          A mentor that <em className="text-primary">teaches you</em> — not one that writes your code for you.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          Browse real project briefs from the <span className="font-mono text-sm">01-edu/public</span> repository.
          Chat with an AI mentor grounded in each project's actual requirements. Submit your code and get reviewed against the real spec.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/browse" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-6 py-3 text-sm font-medium hover:bg-primary/90">
            Open the curriculum <ArrowRight size={16} />
          </Link>
          <a href="#how" className="inline-flex items-center gap-2 border border-border rounded-md px-6 py-3 text-sm font-medium hover:bg-surface-2/60">
            How it works
          </a>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-px bg-border">
          {[
            { icon: BookOpen, title: "Read the brief", text: "Every project's README is fetched directly from the repository — never paraphrased, never invented." },
            { icon: MessageSquare, title: "Chat with your mentor", text: "Ask questions. The mentor cites the brief, breaks down steps, and gives hints — never the whole answer." },
            { icon: Code2, title: "Review your code", text: "Paste what you wrote. Get feedback on missing features, bugs, and your next move — measured against the real spec." },
          ].map((s, i) => (
            <div key={i} className="bg-background p-8">
              <s.icon size={20} className="text-primary mb-4" />
              <h3 className="serif text-2xl mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tracks */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <h2 className="serif text-4xl">Featured tracks</h2>
          <Link to="/browse" className="text-sm text-primary hover:underline">browse all →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {TRACKS.map((t) => (
            <Link
              key={t.path}
              to="/subjects/$"
              params={{ _splat: t.path }}
              className="bg-background p-6 hover:bg-surface-2/40 transition-colors group"
            >
              <div className="font-mono text-xs text-muted-foreground mb-2">subjects/{t.path}</div>
              <div className="serif text-2xl mb-2 group-hover:text-primary transition-colors">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-muted-foreground font-mono flex flex-wrap justify-between gap-4">
          <span>Content © 01-edu, fetched from the public repository.</span>
          <span>Mentor powered by Lovable AI.</span>
        </div>
      </footer>
    </div>
  );
}
