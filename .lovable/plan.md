# Learning Platform — Architecture & Roadmap

## 1. Scope decisions (locked in)

- **Stack stays**: TanStack Start + Tailwind + shadcn + Lovable Cloud (Supabase) + Lovable AI Gateway. No Next.js rewrite, no LangChain, no OpenAI key (Gemini/GPT-5 via the gateway cover every use case).
- **Curriculum source**: `01-edu/public/subjects` (already mirrored + cached).
- **Auth**: email/password (already shipped). Password reset added in Slice 4.
- **Sidebar becomes app nav**: Dashboard / Browse / Mentor / Assessments / Profile. The curriculum file tree moves to `/browse`.

## 2. Information architecture

```text
/                    Landing (marketing)
/login               Auth
/dashboard           Streak, active projects, recommended next, recent activity
/browse              File tree + smart search + filters (lang, difficulty, framework)
/subjects/$path     Subject page — tabs: Brief, Mentor, Review, Assessment, Progress
/mentor              Global mentor (cross-curriculum RAG)
/assessments        History + retry past assessments
/profile             Account, password, badges, streak history
```

App shell: persistent left sidebar (collapsible icon mode), header with breadcrumb + auth button.

## 3. Database schema (additions to what exists)

Already live: `profiles`, `github_cache`, `subject_progress`, `code_attempts`.

New tables:

```text
subject_meta         subject_path PK, title, language, framework, difficulty,
                     tags[], estimated_minutes, description
                     -- populated by an AI-classification job over the README

embeddings           id, subject_path, chunk_idx, content, embedding vector(1536),
                     token_count   -- pgvector, HNSW cosine index

mentor_threads       id, user_id, scope ('global' | subject_path), title, updated_at
mentor_messages      id, thread_id, role, content, retrieved_chunks jsonb, created_at

assessments          id, subject_path, kind ('mcq'|'code'|'predict'|'debug'),
                     question jsonb, answer jsonb, difficulty
                     -- AI-generated, cached per subject

assessment_attempts  id, user_id, assessment_id, response jsonb, score numeric,
                     feedback text, created_at

user_activity        id, user_id, event ('view'|'complete_step'|'attempt'|
                     'pass_assessment'|'chat'), subject_path, metadata jsonb,
                     created_at   -- powers streak + analytics

bookmarks            user_id, subject_path, created_at  (PK composite)
badges               id, slug, name, description, icon
user_badges          user_id, badge_id, earned_at
```

RLS on every per-user table: `auth.uid() = user_id`. `subject_meta`,
`embeddings`, `assessments`, `badges` are public-read (curriculum is shared).

## 4. RAG mentor architecture

```text
README markdown
  ├─ chunked (~500 tokens, 80 overlap) by an embedding-job server fn
  ├─ embedded via google/gemini-embedding-001 (1536 dims, Matryoshka)
  └─ stored in `embeddings` table (pgvector)

Mentor query flow:
  1. user message + recent thread history (last 6 turns)
  2. embed query
  3. pgvector top-k=6 (filtered by subject_path when scope=subject, else global)
  4. compose system prompt:
       - persona ("senior mentor, hints not solutions")
       - retrieved chunks (with subject_path citations)
       - student progress snapshot (completed steps, weak areas, last attempts)
  5. stream from gateway (Gemini 2.5 Flash by default)
  6. persist message + retrieved_chunks for transparency
```

Embedding job runs lazily: when a subject is first opened, enqueue if no
embeddings exist. One-off backfill server fn to embed the top ~100 subjects.

## 5. Smart search & browse

`/browse` layout:
```text
┌─ Search bar (debounced)             [ filters: lang | framework | difficulty ]
├─ Recommended for you (3 cards)
├─ Search results OR file tree (when query empty)
└─ Related projects (when one is selected)
```

Search ranking:
- **Postgres full-text** on `subject_meta.title + description + tags` for instant
  keyword matches (no AI cost).
- **Semantic fallback**: when FTS returns <5 results, also run a vector search
  over `embeddings` and merge by score.

Filters are URL search params (TanStack zod adapter) so links are shareable.

## 6. Assessment engine

Monaco editor replaces the textarea on the Review tab and powers
`/subjects/$path` → **Assessment** tab.

Question generation:
- `generateAssessment(subjectPath, kind)` server fn calls the gateway with
  **tool-calling** (structured JSON output) — no fragile JSON-in-markdown
  parsing.
- Cache 5 questions per (subject, kind) in `assessments` so re-takes are
  instant and cheap.

Grading:
- MCQ / predict-output → exact match.
- Code challenge → AI rubric grading (criteria + score 0–100 + feedback)
  via another tool-call.
- Result writes to `assessment_attempts` + `user_activity` (powers streak).

## 7. Progress & recommendation logic

`recommendNext(userId)` server fn:
```text
1. Active subject = last `user_activity` with event='view' in 7 days
2. If active subject has unchecked steps → suggest "Continue X (3/7 steps)"
3. Else if active subject has no passing assessment → "Take assessment for X"
4. Else find sibling subject in same track at same/next difficulty
5. Fall back to top recommended-for-level subject
```

Streak: count distinct `date_trunc('day', created_at)` from `user_activity`
in the last 30 days; current streak = consecutive days ending today.

Badges (seeded): `first-project`, `7-day-streak`, `10-attempts`,
`first-assessment`, `polyglot` (3+ languages), `framework-master`.
Awarded by a trigger on `user_activity` insert.

## 8. Dashboard layout

```text
┌─ Greeting + streak flame (🔥 5 days)
├─ Recommended next task (big CTA card)
├─ Active projects (last 3, with progress bars)
├─ Stats grid: lessons completed | assessments passed | hours this week
├─ Recent activity feed (last 10 events)
└─ Badges earned (horizontal scroll)
```

## 9. Folder structure (additions)

```text
src/
  routes/
    dashboard.tsx
    browse.tsx              (replaces /subjects index)
    mentor.tsx              (global mentor)
    assessments.tsx
    profile.tsx
    reset-password.tsx
    subjects.$.tsx          (add Assessment tab)
  components/
    AppSidebar.tsx          (new app shell)
    SearchBar.tsx
    SubjectCard.tsx
    RecommendedNext.tsx
    StreakFlame.tsx
    BadgeGrid.tsx
    MonacoEditor.tsx        (lazy)
    AssessmentRunner.tsx
    MentorChat.tsx          (refactor for thread persistence + streaming)
  lib/
    embeddings.functions.ts (embed chunk, search, backfill)
    search.functions.ts     (FTS + semantic merge)
    assessment.functions.ts (generate, grade, list)
    recommend.functions.ts
    activity.functions.ts   (log + streak + badges)
    subject-meta.functions.ts (AI classify)
```

## 10. Slice-by-slice build plan

```text
Slice 1  Sidebar nav restructure + /browse + smart search           (1 build)
         - AppSidebar with Dashboard/Browse/Mentor/Assessments/Profile
         - /browse: existing tree + search bar + lang/difficulty filters
         - subject_meta table + AI classifier job (lazy, on first view)
         - Postgres FTS index on title/description/tags

Slice 2  True RAG mentor                                            (1-2 builds)
         - pgvector + embeddings table
         - chunk + embed job (lazy + manual backfill button)
         - mentor_threads / mentor_messages with persistence
         - streaming responses via SSE through server route
         - /mentor global page + improved per-subject mentor tab
         - fix the "clickable / dropdown" UX issues you mentioned

Slice 3  Assessments + Monaco                                       (2 builds)
         - Monaco editor (lazy chunk, ~1MB) in Review + Assessment tabs
         - generate/grade server fns with tool-calling
         - Assessment tab on subject page + /assessments history page

Slice 4  Dashboard, streaks, badges, password reset                 (1-2 builds)
         - /dashboard with all widgets
         - user_activity logging hooks across the app
         - streak + badges triggers
         - /reset-password + forgot-password flow
         - Profile page
```

## 11. Deployment

No change — already on Cloudflare Workers via TanStack Start. Lovable handles
preview + production deploys. Long-running jobs (embedding backfill) run as
server fns triggered on demand, not cron, to stay within Worker limits.

## 12. What I am explicitly NOT building (yet)

Spaced repetition, focus mode, weekly goals, force-graph skill maps,
AI-generated study plans, learning analytics charts, social features. All
deferrable until real users hit the platform and ask for them.

## 13. Open question I'll resolve in Slice 2

You said the mentor has "clickable / dropdown" issues. I'll capture a session
replay first thing in Slice 2 to see exactly what's broken — could be the
suggested-prompt buttons not wiring to send, or the chat input not focusing
on subject change. No code changes until I see the actual repro.
