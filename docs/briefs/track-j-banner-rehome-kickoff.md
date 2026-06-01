# Track J — Banner re-home (WeeklyChampionsBanner onto the leaderboard surface)

**Sized:** S–M
**Branch:** `redesign/leaderboard-banner-rehome` (off main)
**Type:** Client-only UI. Mounts the **existing** `WeeklyChampionsBanner` on `ProductionLeaderboardSurface`, reading the now-live `weeklyChampions/{weekStarting}` doc (P5-prep). **No backend, no deploy.** **Human-merge + dispatcher pre-review.**

## Outcome

`WeeklyChampionsBanner` is re-homed at the top of `ProductionLeaderboardSurface` (above the period chips), reading the live `tenants/{tid}/weeklyChampions/{prevSunday}` doc. It shows last-week's tenant-wide champions, or its existing honest "No data yet" state when there's no prior-week production.

## Decisions baked in (do not re-litigate)

- **Reuse the existing `WeeklyChampionsBanner` component unchanged** — it takes `{ champions, loading }`, and the doc shape matches field-for-field (verified at P5-prep pre-review: `{ weekStarting, topAPI|null, topApps|null, topActivity|null, computedAt }`, each top-X = `{ agentId, agentName, value }`). No banner-component edits.
- **Read `weeklyChampions/{prevSunday}`** where `prevSunday` = the most-recently-completed week — the SAME key the CF writes (`priorWeekStarting`). The doc-key match is the make-or-break detail (a mismatch = a permanently-empty banner). Source-verify the client computes the identical key.
- **Always render the banner** (its existing empty state handles honest-empty). Placement: top of the surface, above the period chips — it's period-independent (champions are last-week, not tied to the chip). This also gives the live smoke a real wiring check (the banner mounts + fetches + renders even when empty).
- The honest "No data yet" state is now **truthful** (genuinely no prior-week production), not the rules-denied artifact P6 removed — so showing it is correct.

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-banner-rehome-kickoff.md`; branch `redesign/leaderboard-banner-rehome`; commit as commit 1.
3. Failure/drift → STOP.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read the frontend SKILL (or repo Nexus conventions if absent).
2. Confirm `WeeklyChampionsBanner`'s props (`{ champions, loading }`) and that the P5-prep doc shape matches what it destructures.
3. **Confirm the client computes `prevSunday` identical to the CF's `priorWeekStarting`** — both should be "the Sunday of the week before the current WAR week." Verify against the CF (P5-prep) and the retired banner's `getLastNSundays(2)[1]`. This is the pre-review focal point; a key mismatch silently empties the banner.
4. Confirm placement (top of surface, above period chips) against the mockup; confirm agent read access (P5-prep rules allow it).
5. Drift → STOP.

## Phase 2 — build

- Fetch `weeklyChampions/{prevSunday}` (a small hook or inline read in `ProductionLeaderboardSurface`) → `{ champions, loading }`.
- Render `<WeeklyChampionsBanner champions={doc} loading={loading} />` at the top of the surface, above the period chips. Reuse the component as-is.
- No backend, no banner-component change, no raw hex (the banner already uses Nexus tokens).

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** the surface edit + the fetch hook + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no banner-component change, no unrelated `src/`.
- **3c lint / test / build** green (verbatim).
- **3d axe baseline-delta** both themes; NO-NEW serious/critical (gold/contrast nodes FU-tracked).
- **3e COMPONENT test:** the surface mounts the banner; populated mock doc → three champion cards (name + value per category); all-null doc → the banner's "No data yet" state; loading → skeleton.
- **3f LIVE smoke (both themes):** test agent → `ProductionLeaderboardSurface` → the banner mounts at the top and reads `weeklyChampions/{prevSunday}` (honest-empty in test data → "No data yet" cards render); 0 console errors. Proves the fetch + mount + render wiring live; the populated case is component-tested. Preview; prod in Phase 6.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`).
- Resolve the banner-re-home FU. Note: the P5 manager-nav-swap sequencing constraint is now fully satisfied (the banner data path is live, so the manager points board can retire whenever P5 ships without regressing manager-visible champions).

## Phase 5 — PR + STOP for pre-review

Open PR; paste gate results. STOP. I pre-review the **doc-key match** (client `prevSunday` == CF `priorWeekStarting`), the placement, and that the component is reused unchanged.

## Phase 6 — post-merge (no deploy)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke (banner mounts + renders the empty state, both themes) verbatim. Frontend-only; Vercel auto-deploys on merge.

## Acceptance criteria

- Banner mounted at the top of `ProductionLeaderboardSurface` reading `weeklyChampions/{prevSunday}`; shows champions (real data) or the honest empty state; existing component reused unchanged; component-tested for populated + empty; live-smoked (mounts + renders); no backend; gates green.

## Out of scope

Movement chip. P5a unit-scope. The manager nav swap (P5). Any banner-component redesign.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
