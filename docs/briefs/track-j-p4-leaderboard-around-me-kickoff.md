# Track J — P4: Around-me pinned row (+ highlight-in-place)

**Sized:** M–L
**Branch:** `redesign/leaderboard-around-me` (off main)
**Type:** Client-only UI addition to the live `ProductionLeaderboardSurface`. Reads the **existing** `leaderboards/{branchId}` aggregate — **no backend change, no new data field.** **Human-merge + dispatcher pre-review.**

## Outcome

When the viewing agent's rank is below the visible set, a sticky "around-me" cluster keeps their position in view. When the viewer IS in the visible set (podium or tail), no cluster — their existing row is highlighted in place.

## Dispatcher decisions (baked in — do not re-litigate)

1. **Movement chip deferred.** The ▲/▼ chip needs `previousRank`, which the aggregate does not carry; adding it is a keystone Cloud Function change (prior-period ranking), banked as its own phase. P4 ships the cluster **without** the movement chip (per the spec's "ship without rather than fake"). **Gap-to-next DOES ship** — derivable from the neighbor row, no new field.
2. **Test approach.** The test branch has 6 agents (max rank 6), so the below-set cluster (rank > 8 / > 7) **cannot trigger with live data.** Therefore: **unit-test** the cluster logic against mock rankings (below), and **live-smoke only the visible case** (test agent = rank 1 YTD → podium YOU pill, no cluster). The below-set path is unit-verified, not live-smoked. Seeding the branch past 8 agents to demo it live is optional and out of scope.

## Decisions baked in (Claude Design around-me spec — canonical)

**Trigger** — show the cluster when, and only when, the viewer's rank is below the visible set for the current period:
- Desktop: viewer rank > 8 (podium 1–3 + tail 4–8).
- Mobile: viewer rank > 7 (hero 1 + #2/#3 + tail 4–7).
- Unranked viewer (no production this period, not in the field): show the cluster in its empty state.
- Recompute the trigger on every period-chip change — a viewer can be visible at YTD but fall off at WK.

**Contents** — viewer + 1 neighbor each side (3 rows): rank N−1 (chase) · You (N) · rank N+1 (defend).
- Viewer is last → 2 rows (N−1 · You).
- Viewer is unranked → 1 row only (the "You" empty-state row), no neighbors.

**Fields** — identical to a tail row for that breakpoint; do NOT invent a new layout.
- Desktop: the exact tail grid — rank · avatar+name+unit · apps · %-of-leader bar · period API. Bar uses the **same `maxApi` as the tail** (branch leader's API) so it reads continuously.
- Mobile: the mobile tail row shape — rank · avatar · name+unit · period API (no apps, no bar).
- The **You** row carries the gap-to-next ("7 behind #13") on mobile where the bar is absent. (No movement chip — deferred.)

**Visual + placement:**
- **Desktop:** sticky footer pinned to the bottom of the existing tail card (ranks 4–8 scroll inside; the cluster stays). Separate it from the scrolling rows with a top hairline rule and a centered "+N agents" gap divider (mono, muted ink) so the rank jump (8 → 13) reads honestly.
- **Mobile:** a single compact sticky bar fixed directly above the bottom nav — YOU avatar, "You · {firstname}", rank "14 of 28", period API, gap-to-next. Tap expands upward into the full 3-row cluster (sheet-style); tap again or scroll collapses. **Mobile never shows 3 always-on rows.**
- **Distinction (both breakpoints):** primary-tint background + ~1.5px inset primary ring; rank number in teal; avatar swaps initials for a solid-teal "YOU" coin. **Use the codebase's Nexus tokens** (primary tint / ring / teal) — NOT raw hex, NOT the mockup's raw token names; map in Phase 1.

**When the viewer IS visible (podium or tail):** hide the cluster; highlight the existing row in place.
- Tail (rank 4–8 / 4–7): apply the `.me` highlight (tint + inset ring + teal rank + YOU coin) to their real tail row. No footer.
- Podium (rank 1–3): do NOT recolor the gold/silver/bronze card. Add a small teal "YOU" pill at the card's top-left and a ~1.5px teal inset ring on that card only.

**Edge cases:**
- Unranked viewer: "You" row shows rank —, name, unit, API TTD 0, no bar, helper copy "Log production to join the board." Pinned like any below-set viewer.
- Ties: render whatever rank±1 rows the precomputed ranking gives (rank order is already stable upstream).

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-p4-leaderboard-around-me-kickoff.md`; branch `redesign/leaderboard-around-me`; commit as commit 1.
3. **Optional design reference:** if a Claude Design around-me visual addendum has been saved into `design_handoff_v2_app/` before dispatch, fold it in additively (diff README first; no parallel folder; no mockup overwrite) and use it as a layout reference. **If absent, proceed from this brief's baked-in decisions — NOT a blocker.**
4. Failure/drift → STOP and wait for dispatcher.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read `/mnt/skills/public/frontend-design/SKILL.md`.
2. Read `ProductionLeaderboardSurface.jsx` + `useLeaderboard.js` + the entry shape; confirm how the viewer's own entry is identified (logged-in `uid === entry.agentId`).
3. Map the highlight tokens (primary tint / inset ring / teal) to the **actual Nexus tokens** in use; confirm a teal "YOU" coin can be built from existing tokens (no raw hex).
4. Source-verify the **bottom-nav structure** so the mobile sticky bar positions correctly above it.
5. Drift/conflict with the baked-in decisions → STOP and surface.

## Phase 2 — build

- Around-me cluster component (3-row / 2-row / 1-row by boundary; gap-to-next; unranked empty state).
- Desktop sticky footer (hairline + "+N agents" divider) on the tail card; mobile sticky bar with tap-to-expand sheet.
- Highlight-in-place: tail `.me` row; podium YOU pill + ring.
- Trigger logic (rank > 8 / > 7; recompute on period change; visible → highlight-in-place instead).
- Integrate into the surface; Nexus tokens only; no raw hex; no backend/aggregate change; no `previousRank`.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** the cluster component + surface integration + unit tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No unrelated `src/` edits, no `functions/` edits.
- **3c lint / test / build** green (report verbatim).
- **3d axe baseline-delta** both themes; NO-NEW serious/critical (Rule 9 carve-out for `text-*-faint`→`muted` only; gold nodes already FU-tracked).
- **3e UNIT TESTS (cluster logic):** mock rankings — trigger threshold (rank 8 visible / 9 triggers; mobile 7/8), 3-row vs 2-row (last) vs 1-row (unranked) boundaries, gap-to-next math, visible→highlight-in-place selection. These are the primary verification (live data can't reach below-set).
- **3f live render smoke (visible case):** test agent (rank 1 YTD) → assert podium YOU pill + ring, NO pinned cluster; both themes; both viewports (desktop footer absent because visible; mobile bar absent because visible); 0 console errors. Preview; prod in Phase 6.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`).
- Bank FU: **`previousRank` + movement chip** — keystone CF computes prior-period rankings; then the chip renders on the You row + tail.
- Note: role-scope toggle = P5.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gate results. STOP. I pre-review: the trigger/boundary logic (last / unranked especially), the highlight-in-place correctness for the test agent's actual rank, and the mobile tap-expand + "+N agents" divider honesty.

## Phase 6 — post-merge

Sync, fill, push direct to main, Rule 15 verbatim; prod render smoke (visible case, both themes/viewports) verbatim.

## Acceptance criteria

- Cluster triggers correctly for below-set viewers (unit-tested all boundaries); highlight-in-place for visible viewers (live-smoked for the test agent's podium case); unranked empty state; gap-to-next present; desktop sticky footer + mobile tap-expand bar; both themes/viewports.
- No backend change, no `previousRank`, no movement chip; reads the existing aggregate only.
- Nexus tokens, no raw hex; final-diff scope clean; gates green.

## Out of scope

`previousRank` + movement chip (separate CF phase). Role-scope toggle (P5). AgentProductionView fix (P7). Nav swap + points retirement (P6).

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
