import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, Sparkles, Filter, X } from "lucide-react";
import { searchSubjects, listLanguages } from "@/lib/search.functions";
import { indexAllSubjects, getCatalogStatus } from "@/lib/subject-meta.functions";
import { SubjectCard } from "@/components/SubjectCard";

export const Route = createFileRoute("/_app/browse")({
  head: () => ({
    meta: [
      { title: "Browse projects — Learn2Earn Mentor" },
      { name: "description", content: "Search every 01-edu project. Filter by language and difficulty. Find your next thing to build." },
    ],
  }),
  component: BrowsePage,
});

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

function BrowsePage() {
  const status = useServerFn(getCatalogStatus);
  const index = useServerFn(indexAllSubjects);
  const search = useServerFn(searchSubjects);
  const langs = useServerFn(listLanguages);

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [language, setLanguage] = useState<string | undefined>();
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number] | undefined>();
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const statusQ = useQuery({
    queryKey: ["catalog-status"],
    queryFn: () => status(),
    refetchOnWindowFocus: false,
  });

  // Auto-trigger indexing once if catalog is empty
  useEffect(() => {
    if (statusQ.data?.count === 0 && !indexing && !indexError) {
      setIndexing(true);
      index()
        .then(() => statusQ.refetch())
        .catch((e) => setIndexError(e?.message ?? "Indexing failed"))
        .finally(() => setIndexing(false));
    }
  }, [statusQ.data?.count, indexing, indexError, index, statusQ]);

  const ready = (statusQ.data?.count ?? 0) > 0;

  const langsQ = useQuery({
    queryKey: ["languages"],
    queryFn: () => langs(),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  });

  const resultsQ = useQuery({
    queryKey: ["search", debounced, language, difficulty],
    queryFn: () =>
      search({ data: { q: debounced || undefined, language, difficulty, limit: 60 } }),
    enabled: ready,
  });

  const hasFilters = useMemo(
    () => Boolean(debounced || language || difficulty),
    [debounced, language, difficulty],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="serif text-4xl mb-2">Browse the curriculum</h1>
          <p className="text-sm text-muted-foreground">
            {statusQ.data?.count ? `${statusQ.data.count} projects` : "—"} from the
            <span className="font-mono text-foreground"> 01-edu/public</span> repository. Search to find your next build.
          </p>
        </div>

        {/* Search + filters */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects, e.g. authentication, graph, web scraper…"
              className="w-full bg-surface border border-border rounded-md pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-muted-foreground" />
            <select
              value={language ?? ""}
              onChange={(e) => setLanguage(e.target.value || undefined)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs font-mono"
            >
              <option value="">All languages</option>
              {langsQ.data?.map((l) => (
                <option key={l.language} value={l.language}>
                  {l.language} ({l.count})
                </option>
              ))}
            </select>
            <select
              value={difficulty ?? ""}
              onChange={(e) =>
                setDifficulty((e.target.value || undefined) as typeof difficulty)
              }
              className="bg-surface border border-border rounded px-2 py-1 text-xs font-mono"
            >
              <option value="">All levels</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={() => {
                  setQ("");
                  setLanguage(undefined);
                  setDifficulty(undefined);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
            <div className="ml-auto text-xs text-muted-foreground font-mono">
              {resultsQ.data ? `${resultsQ.data.total} matches` : ""}
            </div>
          </div>
        </div>

        {/* Indexing / loading / empty states */}
        {indexing && (
          <div className="border border-border bg-surface/40 rounded-md p-6 mb-4 flex items-center gap-3 text-sm">
            <Sparkles size={16} className="text-primary animate-pulse" />
            <span>Indexing the curriculum for the first time… this only happens once.</span>
          </div>
        )}
        {indexError && (
          <div className="border border-destructive/40 bg-destructive/10 rounded-md p-4 mb-4 text-sm text-destructive">
            {indexError}
          </div>
        )}

        {resultsQ.isLoading && ready && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 size={14} className="animate-spin" /> searching…
          </div>
        )}

        {resultsQ.data && resultsQ.data.results.length === 0 && !resultsQ.isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No projects match those filters.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resultsQ.data?.results.map((s) => (
            <SubjectCard key={s.subject_path} subject={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
