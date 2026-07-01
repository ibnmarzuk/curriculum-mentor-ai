import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Check, Lock, Trophy } from "lucide-react";
import { listCheckpoints, checkpointLeaderboard } from "@/lib/checkpoint.functions";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/checkpoints")({
  head: () => ({ meta: [{ title: "Checkpoint Questions — Learn2Earn Mentor" }] }),
  component: CheckpointsPage,
});

function CheckpointsPage() {
  const listFn = useServerFn(listCheckpoints);
  const lbFn = useServerFn(checkpointLeaderboard);
  const q = useQuery({ queryKey: ["checkpoints"], queryFn: () => listFn() });
  const lb = useQuery({ queryKey: ["checkpoint-lb"], queryFn: () => lbFn() });

  if (q.isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin mr-2" /> loading checkpoints…
      </div>
    );
  }

  const byLevel = new Map<number, typeof q.data.checkpoints>();
  for (const c of q.data?.checkpoints ?? []) {
    const arr = byLevel.get(c.level) ?? [];
    arr.push(c);
    byLevel.set(c.level, arr);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  // level unlock: level N unlocked if level N-1 fully complete (or N===1)
  const unlocked = new Set<number>();
  for (const lvl of levels) {
    if (lvl === 1) { unlocked.add(1); continue; }
    const prev = byLevel.get(lvl - 1) ?? [];
    if (prev.length && prev.every((c) => c.completed)) unlocked.add(lvl);
  }

  const totalCompleted = (q.data?.checkpoints ?? []).filter((c) => c.completed).length;
  const totalCount = q.data?.checkpoints.length ?? 0;

  return (
    <div className="h-full overflow-y-auto px-8 py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6 gap-6 flex-wrap">
        <div>
          <h1 className="serif text-3xl mb-2">Checkpoint Questions</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Practice focused coding challenges before you take the full assessment. Complete every visible and hidden test in a checkpoint to earn a green check.
          </p>
        </div>
        <div className="min-w-[220px]">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Progress</div>
          <div className="serif text-2xl">{totalCompleted}/{totalCount}</div>
          <Progress value={totalCount ? (totalCompleted / totalCount) * 100 : 0} className="mt-2" />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={levels.map((l) => `L${l}`)} className="border border-border rounded-md bg-surface/30">
        {levels.map((lvl) => {
          const items = byLevel.get(lvl) ?? [];
          const isUnlocked = unlocked.has(lvl);
          const done = items.filter((c) => c.completed).length;
          return (
            <AccordionItem key={lvl} value={`L${lvl}`} className="px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 w-full">
                  {isUnlocked ? (
                    done === items.length ? <Check size={16} className="text-primary" /> : <span className="w-4 h-4 rounded-full border border-border" />
                  ) : (
                    <Lock size={14} className="text-muted-foreground" />
                  )}
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Level {lvl}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{done}/{items.length}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="divide-y divide-border">
                  {items.map((c) => (
                    <li key={c.id}>
                      {isUnlocked ? (
                        <Link
                          to="/checkpoints/$slug"
                          params={{ slug: c.slug }}
                          className="flex items-center gap-3 py-2.5 hover:text-primary"
                        >
                          {c.completed ? (
                            <Check size={14} className="text-primary shrink-0" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                          )}
                          <span className="text-sm">{c.title}</span>
                          <span className="ml-auto text-[10px] font-mono uppercase text-muted-foreground">{c.difficulty}</span>
                          {c.bestScore != null && (
                            <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                              {c.bestGrade} · {c.bestScore}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 py-2.5 opacity-50">
                          <Lock size={12} className="shrink-0" />
                          <span className="text-sm">{c.title}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-primary" />
          <h2 className="serif text-xl">Leaderboard</h2>
        </div>
        {lb.isLoading ? (
          <div className="text-sm text-muted-foreground">loading…</div>
        ) : (lb.data?.leaderboard ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed checkpoints yet — be the first.</p>
        ) : (
          <ol className="space-y-1">
            {lb.data!.leaderboard.map((r) => (
              <li key={r.user_id} className="flex items-center gap-3 text-sm border border-border rounded-md px-3 py-2 bg-surface/40">
                <span className="font-mono text-xs text-muted-foreground w-6">#{r.rank}</span>
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-xs font-mono text-muted-foreground">{r.completed} solved</span>
                <span className="serif">{Math.round(r.totalScore)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
