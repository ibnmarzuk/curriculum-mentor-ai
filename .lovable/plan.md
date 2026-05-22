## Goal

Build a curriculum-aware AI mentor that teaches students from the **01-edu/public** repository (specifically the `subjects/` tree). The mentor browses real project READMEs, chats grounded in their content, and reviews user code against the actual requirements — never inventing specs.

## Stack

- TanStack Start + Tailwind (existing template)
- Lovable AI Gateway (Gemini) for chat + code review — no API key needed
- Lovable Cloud for caching fetched markdown (avoids hammering GitHub on every load)
- GitHub public REST API (no token needed for the public repo)
- `react-markdown` + `react-syntax-highlighter` for rendering
- Design direction: **Editorial dark** — navy/indigo palette `#0a0a1a / #141432 / #1e1e5a / #4f46e5`, serif display headings + clean mono/sans body

## Pages & layout

```
┌──────────────┬─────────────────────────────┐
│  Subjects    │   Content area              │
│  (sidebar)   │   - Project README          │
│              │   - Chat mentor             │
│   search     │   - Code review panel       │
│   tree       │                             │
└──────────────┴─────────────────────────────┘
```

Routes (TanStack file-based):
- `/` — landing: brief intro + featured tracks (go, js, devops, etc.), CTA into curriculum
- `/subjects` — sidebar browser; lists folders/files from `subjects/` via GitHub API
- `/subjects/$.tsx` — splat route showing a single subject's README with three tabs:
  1. **Brief** — rendered markdown of the project
  2. **Mentor chat** — AI grounded in this specific subject
  3. **Code review** — paste code, get feedback against this subject's requirements

## Data flow

1. **Subject tree**: server fn `listSubjects(path)` calls `https://api.github.com/repos/01-edu/public/contents/subjects/{path}`, caches result in Cloud table `github_cache` (key, content, fetched_at) with 24h TTL.
2. **Subject content**: server fn `getSubject(path)` fetches the raw README via `https://raw.githubusercontent.com/01-edu/public/master/subjects/{path}/README.md`, caches same way.
3. **Mentor chat**: server fn `mentorChat({ subjectPath, messages })` →
   - Loads cached subject markdown
   - Builds system prompt: "You are a senior engineering mentor. Teach using ONLY the following project brief. Give hints, not solutions. If asked about something not in the brief, say so."
   - Injects subject markdown as context
   - Calls Lovable AI Gateway (`google/gemini-2.5-flash`) with full message history
4. **Code review**: server fn `reviewCode({ subjectPath, code, language })` → similar prompt, returns structured feedback (missing features, bugs, improvements) rendered as markdown.

## Cloud schema

```sql
github_cache (
  cache_key text primary key,   -- e.g. "tree:go/quad" or "readme:go/quad"
  content   text not null,
  fetched_at timestamptz default now()
)
```
Public read RLS (cache is non-sensitive). No auth in v1.

## Design execution (Editorial dark)

- Background `#0a0a1a`, surface `#141432`, border `#1e1e5a`, accent `#4f46e5`
- Headings: **Instrument Serif** (italic for emphasis on the landing)
- Body/UI: **Inter**
- Mono (code, file tree): **JetBrains Mono**
- Generous whitespace, thin 1px indigo borders, subtle indigo glow on focused/active elements
- Sidebar = monospace file tree with chevrons; selected row gets the indigo accent bar
- Chat bubbles: user = subtle indigo tint, mentor = transparent with serif-italic "Mentor" label
- Tokens defined in `src/styles.css` as oklch values — no raw hex in components

## Implementation steps

1. Enable Lovable Cloud, create `github_cache` table + RLS
2. Add deps: `react-markdown`, `remark-gfm`, `react-syntax-highlighter`
3. Add Inter / Instrument Serif / JetBrains Mono via `<link>` in `__root.tsx`; update `styles.css` tokens
4. Server fns: `github.functions.ts` (listSubjects, getSubject), `mentor.functions.ts` (mentorChat, reviewCode)
5. Routes: rewrite `/`, add `/subjects.tsx` (layout w/ sidebar + Outlet), add `/subjects/$.tsx`
6. Components: `SubjectTree`, `MarkdownView`, `MentorChat`, `CodeReview`
7. SEO heads per route; landing H1 "Learn by building real projects"

## Out of scope (v1)

- Auth & progress tracking (asked for, deferred — easy to add later with Cloud)
- Exercise auto-grading / running code
- Branches other than `master`
