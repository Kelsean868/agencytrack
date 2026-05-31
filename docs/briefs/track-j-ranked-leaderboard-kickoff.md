# Track J redesign — RankedLeaderboard v2 token swap (green-channel)

**Sized:** XS
**Branch:** `redesign/ranked-leaderboard` (off main)
**Type:** Track J v2 visual port — colors only.
**Channel:** **Green-channel auto-merge** — *conditional* on the Phase 1 token-existence gate. If the rank colors require a NEW token (config/`:root` change), the run downgrades to human-merge → **STOP and wait for dispatcher.**

## Outcome

Replace the three non-Nexus Tailwind built-in color strings in `src/components/productionReport/RankedLeaderboard.jsx` (rank-1/2/3 `medalClass`, lines ~33–35) with existing Nexus tokens. No data, props, structure, or layout change. RankedLeaderboard is now load-bearing for two surfaces (Production Report rows + the future production-leaderboard podium's data) — this PR touches **colors only**.

Current (non-Nexus):
- rank 1: `bg-yellow-400/20 text-yellow-600 dark:text-yellow-400`
- rank 2: `bg-zinc-300/20 text-zinc-500 dark:text-zinc-400`
- rank 3: `bg-amber-600/20 text-amber-700 dark:text-amber-500`

## Authoring basis + verification posture

Authored from this session's Leaderboard routing probe (live HEAD). The in-chat repomix is pre-refactor — do NOT use as a source. Live HEAD + `tailwind.config.js` + `src/index.css` are authoritative for token existence.

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim.
4. Move the brief from Downloads into `docs/briefs/track-j-ranked-leaderboard-kickoff.md` (Move-Item); `git checkout -b redesign/ranked-leaderboard`; commit the brief as commit 1.
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — token-existence gate (Rule 17) — HARD STOP

1. Read `tailwind.config.js` + `src/index.css`. Enumerate the available rank/medal/status tokens (e.g. the `medal-N` system already consumed by `WeeklyChampionsBanner.jsx`; status tints `bg-gold-tint`/`bg-warning-tint`; `bg-surface-muted`, `text-ink-muted`, `text-gold`, `text-warning`).
2. Choose the mapping that (a) renders a faithful rank-1/2/3 medal look in BOTH themes and (b) uses ONLY tokens that already exist. Preference order: the existing `medal-N` token system (consistency with `WeeklyChampionsBanner`) → status tints (`gold`/`warning`) → `surface-muted`/`ink-muted` for the neutral rank-2.
3. **If no existing-token mapping produces a correct rank-1/2/3 treatment without defining a new token or editing `tailwind.config.js` / `:root` → STOP and wait for dispatcher.** (This downgrades the unit to human-merge token-addition work; it is NOT green-channel.)
4. Record the chosen mapping in the PR body.

## Phase 2 — execute (3-line swap)

1. Replace the three `medalClass` return strings with the chosen tokens. Nothing else in the file changes.
2. No edit to `tailwind.config.js`, `src/index.css`, the component's data/props/structure, or any consumer.

## Phase 3 — green-channel gates

- **3a hex-grep:** `grep -nE "#[0-9a-fA-F]{3,6}" src/components/productionReport/RankedLeaderboard.jsx` → empty.
- **3b scope (FINAL diff):** `git diff --stat main..HEAD` — RankedLeaderboard.jsx + brief + CONTEXT row + (optional) verification scripts under `scripts/`|`verification/` only. No other `src/` file; **no `tailwind.config.js`/`index.css`.** (Flag-1: scope gate runs on the final diff.)
- **3c lint / test / build:** all green; report counts verbatim.
- **3d axe baseline-delta:** build branch + main worktree; serve both; axe both themes; report branch N + main N per theme; assert NO-NEW **serious/critical** vs main baseline (delta, not absolute 0); break out serious/critical explicitly (Flag-2).
- **3e both-themes smoke:** light + dark; the rank-1/2/3 rows render with the new tokens (assert computed background/text reflect the chosen tokens, not the old `yellow-/zinc-/amber-` builtins); 0 console errors. Write-read-verify waived (read-only display).
- **3f no feature/nav/token-definition/role/route change** — confirmed by 3b (colors-only, config untouched).

## Phase 4 — docs fill (same commit as Phase 2)

- CONTEXT.md recently-shipped row (top, `#{TBD}`/`{TBD}`): "Track J — RankedLeaderboard v2 token swap (green-channel). Rank-1/2/3 medalClass off non-Nexus `yellow-/zinc-/amber-` builtins onto existing {chosen} tokens. Colors only; no data/props/structure change. Pre-claims the file for the Production Report port + the new production-leaderboard surface."
- Drop oldest row if >5. Top-table fields are Phase 6 (Rule 16).

## Phase 5 — auto-merge (green-channel)

Per the green-channel rubric: if ALL Phase 3 gates pass, open the PR and auto-merge. Body must paste the Phase 1 chosen mapping + all Phase 3 results verbatim (lint/test/build, axe delta with serious/critical breakout, smoke). If ANY gate fails or the Phase 1 token gate STOPs → do NOT auto-merge → **STOP and wait for dispatcher.**

## Phase 6 — post-merge + AUTO-REVERT

Sync main, capture squash SHA, fill `#{TBD}`/`{TBD}` in CONTEXT.md, commit, push direct to main, then **Rule 15 verification** — paste verbatim `git log origin/main --oneline -1` AND `git rev-parse HEAD && git rev-parse origin/main`; confirm local HEAD == origin/main with fill commit on top and work-PR squash directly below; report "pushed and verified"; mismatch → **STOP and wait for dispatcher.** Then prod smoke (both themes) via `setupBypassSession`. On prod-smoke fail → **AUTO-REVERT** and **STOP and wait for dispatcher.**

## Acceptance criteria

- The three `medalClass` strings use existing Nexus tokens; both themes render a faithful rank-1/2/3 look.
- Zero raw hex; zero `yellow-/zinc-/amber-` builtins remaining in the file.
- `tailwind.config.js` + `src/index.css` untouched; no new token defined.
- Data/props/structure/consumers unchanged.
- Final-diff scope per 3b; lint 0 / tests green / build clean; axe NO-NEW serious/critical; both-themes smoke pass; prod smoke pass.

## Out of scope

- Any `RankedLeaderboard` data/props/structure change (reserved for the production-leaderboard data-extraction work — the shared period-scoped ranking query).
- The new production-leaderboard podium surface (separate feature spec).
- Production Report container assembly.
- Defining a new token (would be human-merge; Phase 1 STOPs).

## Rule references

Rule 9 (Phase 0 gate), Rule 10 (brief commit), Rule 12 (exact halt language), Rule 15 (origin verify), Rule 16 (post-merge fill scope), Rule 17 (token-existence source-verify).
