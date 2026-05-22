import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, FolderClosed, Loader2 } from "lucide-react";
import { listSubjects, type TreeEntry } from "@/lib/github.functions";
import { useServerFn } from "@tanstack/react-start";

function TreeNode({ entry, depth, currentPath }: { entry: TreeEntry; depth: number; currentPath?: string }) {
  const [open, setOpen] = useState(false);
  const fetchList = useServerFn(listSubjects);
  const { data, isLoading } = useQuery({
    queryKey: ["tree", entry.path],
    queryFn: () => fetchList({ data: { path: entry.path } }),
    enabled: entry.type === "dir" && open,
    staleTime: 5 * 60 * 1000,
  });

  const isActive = currentPath === entry.path;
  const pad = { paddingLeft: `${depth * 0.75 + 0.5}rem` };

  if (entry.type === "file") {
    // Only README.md files are interesting as standalone targets — skip others
    if (entry.name !== "README.md") return null;
    return null;
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 py-1 text-sm font-mono cursor-pointer hover:bg-surface-2/60 transition-colors ${isActive ? "bg-primary/15 border-l-2 border-primary" : "border-l-2 border-transparent"}`}
        style={pad}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center text-muted-foreground hover:text-foreground"
          aria-label={open ? "collapse" : "expand"}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <FolderClosed size={14} className="text-primary/70 shrink-0" />
        <a
          href={`/subjects/${entry.path}`}
          className="truncate hover:text-primary"
        >
          {entry.name}
        </a>
      </div>
      {open && (
        <div>
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1" style={{ paddingLeft: `${(depth + 1) * 0.75 + 0.5}rem` }}>
              <Loader2 size={12} className="animate-spin" /> loading…
            </div>
          )}
          {data?.map((child) => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} currentPath={currentPath} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SubjectTree({ currentPath }: { currentPath?: string }) {
  const fetchList = useServerFn(listSubjects);
  const { data, isLoading } = useQuery({
    queryKey: ["tree", ""],
    queryFn: () => fetchList({ data: { path: "" } }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="py-2">
      <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
        subjects/
      </div>
      {isLoading && (
        <div className="px-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> loading tracks…
        </div>
      )}
      {data?.map((entry) => (
        <TreeNode key={entry.path} entry={entry} depth={0} currentPath={currentPath} />
      ))}
    </div>
  );
}
