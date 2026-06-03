# Curriculum Intelligence System — Architecture & Roadmap

You asked for a full curriculum engine: skill extraction per project, learning roadmaps, readiness scoring, personalised recommendations, skill tree, and a mentor that acts as a coach. This is a large body of work — per your earlier "write the full architecture doc first" preference, here's the plan before any code.

## 1. Core idea

Two new primitives layered on top of the existing `subject_meta` catalog:

- **Skills** — atomic, reusable units ("javascript-basics", "jwt", "react-hooks", "rest-apis", "postgres-fundamentals"). One canonical taxonomy, ~80–150 skills total. Each skill has a track, level, and prerequisites.
- **Tracks** — the 7 roadmaps (Frontend, Backend, Full Stack, AI, DevOps, Mobile, Web3) × 3 levels (Beginner, Intermediate, Advanced). Tracks are ordered groups of skills.

Every subject gets mapped to: `required_skills[]` + `teaches_skills[]` + `prerequisites[]`. Readiness for a subject = `|user_mastered ∩ required_skills| / |required_skills|`.

## 2. Database additions

```text
skills                — id, slug, name, track, level, description, prerequisites[]
tracks                — id, slug, name, description, level, skill_slugs[] (ordered)
subject_skills        — subject_path, skill_slug, role ('requires'|'teaches'), weight
user_skill_mastery    — user_id, skill_slug, mastery (0..1), evidence jsonb, updated_at
user_track_enrollment — user_id, track_slug, started_at, current_skill_slug
readiness_cache       — user_id, subject_path, score, missing[], computed_at
```

All RLS-scoped to `auth.uid()` for the user_ tables; `skills` / `tracks` / `subject_skills` are public-read.

## 3. AI extraction pipeline

Extends the existing `classifySubject` server fn. New tool-calling step extracts:

```json
{
  "required_skills": ["javascript-basics", "react-hooks"],
  "teaches_skills": ["jwt", "auth-flows"],
  "estimated_minutes": 240,
  "difficulty": "intermediate"
}
```

Skills are validated against the canonical taxonomy (model is given the list of valid slugs in the prompt). Unknown skills are logged for taxonomy review, not silently created.

Runs lazily on first view + batch backfill via existing `indexAllSubjects` flow.

## 4. Readiness engine

Pure server fn `computeReadiness(userId, subjectPath)`:

1. Load `subject_skills` where role='requires'
2. Load `user_skill_mastery` for those slugs
3. score = Σ(mastery × weight) / Σ(weight)
4. missing = skills with mastery < 0.7
5. Cache in `readiness_cache` (TTL 1h or invalidated on mastery change)

## 5. Mastery updates

Mastery is updated by:
- Completing a project step (+0.1 to skills the project teaches)
- Mentor interaction tagged with skill (+0.05)
- Assessment pass (set to max(current, 0.8))
- Self-attestation toggle in Skill Tree (set to 1.0)

## 6. UI surfaces

- `/dashboard` — Continue Learning card (current track, next skill, resume project), Mentor recommendations, recent topics
- `/tracks` — Grid of 7 roadmaps; click → track detail with ordered skill list
- `/tracks/$slug` — Skill tree visualisation (collapsible levels, mastery bars, lock icons)
- `/subjects/$` — New top panel: "Readiness: 78%", checklist of required skills with ✓/○, "Learn these first" CTA list
- Mentor — extended system prompt with user's mastery snapshot + current track context

## 7. Slice roadmap (build order)

**Slice A — Taxonomy & extraction** (foundational)
- Seed `skills` + `tracks` tables with canonical taxonomy (hand-curated JSON, ~120 skills, 21 tracks)
- Extend `classifySubject` to extract required/teaches skills
- Backfill button on `/profile` (admin only initially)

**Slice B — Readiness on subject page**
- `subject_skills` populated → `computeReadiness` server fn
- Readiness panel on `/subjects/$` (score, ✓/○ checklist, "learn first" links)

**Slice C — Tracks & skill tree**
- `/tracks` index + `/tracks/$slug` page
- Skill tree component with mastery bars and prerequisite locking
- Track enrollment

**Slice D — Continue Learning + recommendations**
- Dashboard "Continue Learning" card
- `recommendNext(userId)` — considers active track, last activity, weak skills, readiness
- Weak-area suggestions widget

**Slice E — Mentor as coach**
- Inject user mastery + active track into mentor system prompt
- Mentor can call tools: `recommend_skill`, `recommend_project`, `explain_prerequisite`
- "Generate study plan" action

## 8. What I'd defer

- Full RAG over README content (separate Slice 2 from prior plan — still on the roadmap)
- Assessment engine (Slice 3 from prior plan) — readiness initially driven by progress + self-attestation; assessments plug in later as a mastery signal
- Gamification/badges — Slice 4

## 9. Open questions before I start Slice A

1. **Taxonomy authorship** — Should I hand-curate the ~120 canonical skills upfront (you review), or let the AI propose them from the indexed corpus and you approve?
2. **Track scope** — All 7 tracks at once, or start with Frontend + Backend + Full Stack and add the rest later?
3. **Self-attestation** — Allow students to mark a skill "I know this" to skip ahead, or require evidence (project completion / assessment)?

Once you answer those (or say "just pick sensible defaults"), I'll ship Slice A: taxonomy seed + extraction pipeline + a `/tracks` placeholder showing the seeded roadmaps. Subsequent slices follow in order.
