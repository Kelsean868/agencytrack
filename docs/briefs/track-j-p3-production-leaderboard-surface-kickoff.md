# Track J — P3: Production Leaderboard surface (podium + tail + period chips)

**Sized:** M–L
**Branch:** `redesign/production-leaderboard-surface` (off main)
**Type:** New agent-facing UI surface. **Human-merge + dispatcher pre-review.** First consumer of the P1 keystone — reads `leaderboards/{viewerBranchId}`.
**Route:** behind a TEMPORARY route only. NO primary-nav swap, NO points-board retirement (that's P6).

## Outcome

The Production Leaderboard: a top-3 podium `[#2, #1, #3]` (#1 elevated, gold/silver/bronze `MedalCoin` + ring + glow, Champion/Runner-up/Third labels), a tail (ranks 4–8 desktop / 4–7 mobile) with %-of-leader bars, and WK/MTD/QTD/YTD period chips (default YTD). Responsive: desktop 3-up podium + 5-row tail; mobile #1 hero + #2/#3 side-by-side + 4-row tail. It reads the precomputed `leaderboards/{branchId}` doc for the viewer's branch (resolved from `userProfile.branchId`) — all four periods are in the doc, so chip-switching re-renders without a refetch.

## Decisions baked in (from Claude Design's settled answers + the P1b doc shape)

- **Podium:** top 3 in visual order `[#2, #1, #3]`; raw period API (TTD) on cards, no bar; medal color by rank.
- **Tail:** rank, avatar + name + unit code, apps, **%-of-leader** bar (`periodApi / leaderApi`), period API.
- **Period chips:** WK/MTD/QTD/YTD, single-select, default YTD; switch re-renders from the doc's matching period array.
- **Card figures:** period API + apps + unit code. **No persistency, no career-level.**
- **`ui/MedalCoin`:** new reusable primitive, parameterized (size + theme), referencing the existing `--color-medal-*` CSS vars (so gradients can't drift from the kiosk). Bank "converge kiosk onto `ui/MedalCoin`" as an FU.
- **Data read:** `leaderboards/{userProfile.branchId}` via a small read hook/service; rules already enforce branch scope (P1b). Handle loading / error / **empty** (empty or all-zero period → an honest "no production logged yet" state, since zero-API agents are ranked — a slow WK can show $0 entries).
- **Temp route** (e.g. `/leaderboard-v2` or a flag) — agent-facing, not the nav slot. No nav/points-board change.

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`; `git checkout main && git pull --ff-only origin main`; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-p3-production-leaderboard-surface-kickoff.md`; `git checkout -b redesign/production-leaderboard-surface`; commit as commit 1.
3. **Design source:** `design_handoff_v2_app/mockups/app-leaderboard.jsx` is the P3 design source for layout (podium, tail, period chips, responsive). No fold-in. Where the mockup conflicts with this brief's "Decisions baked in" (fields shown, default period = YTD, tail-bar = %-of-leader, ranking basis = period API not points), **THIS BRIEF GOVERNS** — surface any conflict you find as a finding before building, do not silently follow the mockup. *(Edited from the original fold-in instruction per dispatcher disposition 2026-05-31: the HTML addendum + README §7.1 update referenced by the original step 3 are not required for P3 — their net-new content (around-me, role-scope) is P4/P5, and every settled P3 mechanic is already in this brief's "Decisions baked in" section.)*
4. Any failure/drift → **STOP and wait for dispatcher.**

## Phase 1 — source-verify (Rule 11 + Rule 17) — read the frontend SKILL first

1. **Read `/mnt/skills/public/frontend-design/SKILL.md`** before any component code.
2. Read `app-leaderboard.jsx` (core mockup) + §7.1 + the Spec Addendum for exact podium/tail/chip/responsive specs + `MedalCoin` sizes/structure.
3. Confirm `userProfile.branchId` is available client-side (it's on the user doc; confirm the auth/profile context exposes it).
4. Confirm the `leaderboards/{branchId}` doc shape from P1b matches the surface's needs (`week/mtd/qtd/ytd` arrays; entry `{ agentId, name, unitName, periodApi, apps, rank, rankWithinUnit }`; `skippedNoBranch`, `computedAt`).
5. Confirm `--color-medal-1/2/3-*` CSS vars exist (for `MedalCoin`).
6. Any drift → **STOP and wait for dispatcher.**

## Phase 2 — build

- **2a `ui/MedalCoin`** — parameterized primitive (size, rank/medal) using `--color-medal-*` vars. No raw hex.
- **2b read hook/service** — reads `leaderboards/{userProfile.branchId}`; returns the four period arrays + metadata; loading/error/empty.
- **2c surface** — podium + tail + period chips + responsive (desktop/mobile breakpoints); empty/slow-period state. Nexus tokens only; eyebrow-label convention where applicable. Temp route wired; no nav change, no consumer-file edits beyond adding the route.

## Phase 3 — gates

- **3a hex-grep:** empty on all new files (MedalCoin uses CSS vars, not raw hex — confirm).
- **3b scope (FINAL diff, terminal check):** new `ui/MedalCoin` + surface component(s) + read hook + temp-route wiring + brief + design fold-in + CONTEXT + FOLLOW_UPS (+ smoke script). No unrelated `src/` edits.
- **3c lint / test / build:** green; report verbatim.
- **3d axe baseline-delta:** both themes; NO-NEW serious/critical vs main; break out serious/critical.
- **3e both-themes smoke (render):** as the **test agent**, navigate to the temp route → assert the podium (top 3), the tail, and the period chips render from the real `leaderboards/tatil_south` aggregate; switch a chip and assert the field re-ranks; 0 console errors; light + dark. (Read-only display — the rules-read path is already proven by P1b; this confirms the surface renders the live aggregate as the agent.) Preview + prod.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`): "Track J P3 — Production Leaderboard surface (podium + tail + WK/MTD/QTD/YTD chips, responsive) reading the P1 `leaderboards/{branchId}` aggregate; new `ui/MedalCoin` primitive. Behind a temp route — no nav swap (P6)."
- Bank FU: converge the kiosk medal onto `ui/MedalCoin`.
- Note: temp route → primary-nav swap + points-board retirement is P6.

## Phase 5 — commit, push, open PR — STOP for pre-review

Commit (in-scope files only); push; open PR vs main; paste gate results (lint/test/build, axe delta, both-themes smoke). **STOP and wait for dispatcher.** I pre-review the render-from-aggregate correctness, the responsive layout, and the empty/slow-period state before you merge.

## Phase 6 — post-merge

Sync, fill, push direct to main, **Rule 15 verbatim**; prod smoke (render, both themes, as the agent) — paste verbatim.

## Acceptance criteria

- Surface renders podium + tail + period chips from `leaderboards/{viewerBranchId}` for an agent; chip-switch re-ranks from the doc's arrays (no refetch); responsive desktop/mobile; loading/error/empty handled honestly.
- `ui/MedalCoin` reusable, CSS-var-backed; no raw hex.
- Temp route only — no nav change, no points-board retirement.
- Gates green; final-diff scope clean; design addendum folded into `design_handoff_v2_app/` additively (no parallel folder).

## Out of scope

- Around-me pinned row (P4). Role-based scope toggle (P5). Nav swap + points-board retirement (P6). AgentProductionView around-me/rank-pill fix (P7). Kiosk `MedalCoin` convergence (FU).

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
