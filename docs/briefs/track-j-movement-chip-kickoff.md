# Track J — Movement chip (viewer week-over-week rank movement)

**Sized:** M
**Branch:** `redesign/leaderboard-movement-chip` (off main)
**Type:** Client-only UI. Reads the now-live `previousRank` from the aggregate (P5-prep). New `ui/MovementChip` primitive consumed by the viewer's representation across four surfaces. **No backend, no deploy** (frontend; Vercel auto-deploys on merge). **Human-merge + dispatcher pre-review.**

## Outcome

The viewer's week-over-week rank movement renders as a chip — **▲N** (climbed N spots), **▼N** (dropped N), **–** (even) — on their own row/card across the leaderboard surfaces, derived from `previousRank` vs `rank`. WEEK-only.

## Decisions baked in (do not re-litigate)

- **Direction (get this right — it's easy to invert):** `delta = previousRank − rank`. A rank *improves* by getting numerically smaller, so `previousRank 5 → rank 2` is a climb of **▲3** (`delta = +3`). Positive delta → ▲ (climbed); negative → ▼ (dropped); zero → – (even); `previousRank == null` → **no chip**.
- **Viewer-only.** The chip shows on the VIEWER's representation only — never on other agents' rows. (Per Claude Design: "The You row additionally carries a movement chip.")
- **WEEK-only.** `previousRank` is null on MTD/QTD/YTD, so the chip appears only on the WEEK period (and on `WhereYouRankPanel` when its active period maps to week). Null → no chip is the same code path.
- **Shared primitive** `ui/MovementChip` (like `MedalCoin`) — Nexus tokens, no raw hex.

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-movement-chip-kickoff.md`; branch `redesign/leaderboard-movement-chip`; commit as commit 1.
3. Failure/drift → STOP.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read `/mnt/skills/public/frontend-design/SKILL.md` (if absent in env, use the repo's Nexus conventions, as on P6).
2. Source-verify the mockup's movement-chip treatment — the ▲/▼/– glyphs, color tokens, and placement on each of: the AroundMeCluster **You** row, the PodiumCard ("under the unit code" per the around-me spec), the isViewer TailRow, and the `WhereYouRankPanel` You row.
3. Confirm entries carry `previousRank` + `rank`; confirm how `isViewer` is determined in each surface (`uid === entry.agentId`, as established P4/P7).
4. Map the chip colors to Nexus tokens — up/positive, down/negative, even/neutral (no raw hex).
5. Drift/conflict → STOP and surface.

## Phase 2 — build

- **`ui/MovementChip`** — props `(previousRank, rank)`; returns ▲N / ▼N / – / null per the direction rule above. Themed Nexus tokens.
- Wire it into the four viewer-representations: AroundMeCluster You row, isViewer TailRow, isViewer PodiumCard, `WhereYouRankPanel` You row. Pass `previousRank` + `rank` from the entry.
- Nexus tokens only; no raw hex; no backend/aggregate change.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** `ui/MovementChip` + the four surface edits + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no unrelated `src/`.
- **3c lint / test / build** green (verbatim).
- **3d axe baseline-delta** both themes; NO-NEW serious/critical (Rule 9 carve-out only; gold/contrast nodes FU-tracked).
- **3e UNIT tests (the derivation — PRIMARY for ▲/▼):** `previousRank 5, rank 2 → ▲3` (climbed); `previousRank 2, rank 5 → ▼3` (dropped); `previousRank 4, rank 4 → –` (even); `previousRank null → no chip`. Exhaustive on direction + null.
- **3f COMPONENT tests:** the chip renders the correct glyph on the **viewer's** row in EACH of the four surfaces given mock `previousRank`/`rank`; renders NOTHING on non-viewer rows; renders nothing when `previousRank` is null. These carry the ▲/▼ verification — the test data has no real movement.
- **3g LIVE smoke (both themes):** test agent (rank 2, `previousRank 2` → **even** in the static test data) on the WEEK view → assert `MovementChip` renders on their PodiumCard (rank 2 = #2 podium, viewer is visible) showing the even/– state, and on `WhereYouRankPanel`; assert it does NOT render on other agents' rows; 0 console errors. Preview; prod in Phase 6.

  Note: the test data has no week-over-week movement (prior week == this week ranking, all $0), so the live chip shows "–/even." The ▲/▼ states are component-tested (3f). To see real ▲/▼ live you'd need a prior week with different rankings seeded — optional, not required.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`).
- Resolve the movement-chip deferred FU (banked across P4/P7/P5-prep).

## Phase 5 — PR + STOP for pre-review

Open PR; paste gate results. STOP. I pre-review the **direction** (▲ = climbed = `previousRank > rank` — the invertible bit), the viewer-only + WEEK-only scoping, and the component coverage of ▲/▼ (since live only shows even).

## Phase 6 — post-merge (no deploy)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke (the even-case chip on PodiumCard + WhereYouRankPanel, both themes) verbatim. Frontend-only — Vercel auto-deploys on merge; no `firebase deploy`.

## Acceptance criteria

- `ui/MovementChip` renders the viewer's WEEK movement (▲N/▼N/–) from `previousRank` vs `rank` across all four surfaces; viewer-only; WEEK-only (null → no chip); direction correct (climb = numerically-smaller rank); component-tested for ▲/▼/even/none; live-smoked for the test agent's even case; no backend; gates green.

## Out of scope

Movement on non-viewer rows (enhancement). Per-period (non-week) movement (needs the deferred non-week `previousRank`). Banner re-home. P5a unit-scope.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
