import { Link } from "@tanstack/react-router";
import type { SubjectResult } from "@/lib/search.functions";

export function SubjectCard({ subject }: { subject: SubjectResult }) {
  return (
    <Link
      to="/subjects/$"
      params={{ _splat: subject.subject_path }}
      className="group block border border-border rounded-lg p-4 bg-surface/40 hover:bg-surface-2/60 hover:border-primary/40 transition-colors"
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2 truncate">
        subjects/{subject.subject_path}
      </div>
      <h3 className="serif text-xl text-foreground group-hover:text-primary transition-colors leading-tight mb-1.5">
        {subject.title}
      </h3>
      {subject.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{subject.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5 items-center">
        {subject.language && (
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border border-primary/30 text-primary/90 rounded">
            {subject.language}
          </span>
        )}
        {subject.difficulty && (
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border border-border text-muted-foreground rounded">
            {subject.difficulty}
          </span>
        )}
        {subject.estimated_minutes && (
          <span className="text-[10px] font-mono text-muted-foreground">
            ~{subject.estimated_minutes} min
          </span>
        )}
      </div>
    </Link>
  );
}
