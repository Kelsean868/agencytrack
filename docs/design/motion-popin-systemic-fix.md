# Systemic fix — "content pops in after the animation" (mount-fetch panels)

**Status:** proposal (investigation complete; awaiting go on implementation)
**Date:** 2026-07-06
**Evidence:** `motion-verifier.mjs` sweeps vs `portal.agencytrack.app` (see `scripts/verification/SMOKES.md`)
**Related:** [motion-jank-verifier.md](motion-jank-verifier.md) (the measurement tool)

## The problem, measured

The app feels janky because content **pops in after the `screen-enter` entrance animation completes** (`--dur-3` = 320ms fade, keyed on `activeTab` at the dashboard level).

**Coverage — full reload-isolation sweep of every accessible role (prod, 2026-07-06):**

| role | tabs | FAIL/ERROR |
|---|---|---|
| agent | 13 | ~7 |
| branch_manager | 26 | 11 |
| unit_manager | 10 | 6 |
| sales_manager | 18 | 10 |
| tenant_admin | 6 | 2 |
| platform_admin | — | no creds (uncovered) |

Roughly **half of all data-backed tabs across every role** mount content after the fade. Crucially, the worst offenders are **shared panels reused across roles** — `production-report` (agent + BM + SM), `compliance` (BM + SM), `goals`, `game-plan`, `policy-ledger`, `team-perf` — so a shared fix hits every role at once. Representative offenders:

| Surface | late repaint | loading state today | what mounts after the fade |
|---|---|---|---|
| agent / Game Plan | ~36% | **spinner** (`Loader2`) | `game-plan-anchor`, `-rail`, `-cascade`, `suggested-week-card` |
| agent / Policy Ledger | ~43% | — | `ledger-empty` / rows |
| agent / Production Report | ~48% | — | scorecards + `where-you-rank-panel` |
| agent / Commission | ~36% | — | `commission-anchor-strip` |
| agent / Leaderboard, Persistency, Financing | 4–30% | mixed | panel content |
| tenant_admin / All Users | ~5% | **3-row skeleton** | 14 user-list rows in one batch |
| tenant_admin / Branches | ~4% | — | branch-list rows |
| clean: dashboard, history, goals, awards, career, money-needs | 0% | sync render | — |

## Root cause

Panels fetch data on mount (`loading=true` → `getX()` → `setLoading(false)`) and render real content only after resolve. The dashboard's `screen-enter` fade plays over whatever the loading state is; the real content mounts **after** the fade. The pop-in magnitude is proportional to **how little the loading state resembles the final content**:

- **Spinner** (Game Plan) → total repaint + full layout materialization = worst.
- **Too-small skeleton** (All Users: 3 rows → 14) → layout jump = medium.
- **Structure-matching / sync** (clean tabs) → negligible.

The loading states are **inconsistent** panel-to-panel — there is no shared skeleton primitive (grep shows ad-hoc `animate-pulse` in ~30 files, plus spinners, plus none). That inconsistency IS the systemic defect.

You cannot guarantee async data lands within 320ms, so the fix is not about timing — it's about making the loading→data transition **not read as a pop**.

## Proposal (systemic, shared)

**Principle:** the entrance animation should reveal something structurally close to the final layout, so when data lands the change is small and in-place.

**S1 — Shared skeleton kit (highest impact, lowest risk).**
One `<Skeleton>` primitive + a few presets — `<PanelSkeleton variant="list|cards|report|hero" rows={n} />` — that reserve the real content's footprint (stable height, realistic row/card count). Each mount-fetch panel's loading branch adopts it. Replaces spinners (Game Plan) and right-sizes small skeletons (All Users). Kills the **layout jump** — the most jarring part of the pop. Per-panel adoption, but from one shared, tunable building block. Reduced-motion-safe (skeletons shimmer only under `no-preference`, or stay static).

**S2 — Gentle content reveal (polish, pairs with S1).**
When `loading` flips false, wrap the content in a short crossfade (opacity + 2px rise, ~`--dur-2`, `--ease-out`, gated on `prefers-reduced-motion`) so the swap eases instead of snapping.

**S3 — Readiness-coupled entrance (deeper, only if S1+S2 fall short).**
A shared `<TabContent>` wrapper that defers the `screen-enter` reveal until the active tab signals content-ready (or a ~400ms max timeout), so the fade reveals real content when fetches are fast. More invasive — needs a readiness signal per panel — and risks a sluggish feel on slow fetches. Not recommended as the first move.

## Recommended path

1. **Build the S1 skeleton kit** (one small shared module).
2. **Prove it on Game Plan first** — the worst offender and a spinner→skeleton swap (biggest visible win). Measure before/after with `motion-verifier.mjs --role agent --target agent-tab-game-plan`.
3. **Roll to the list/report panels** (All Users, Production Report, Policy Ledger, Commission, Branches), each measured.
4. **Add S2** as a polish layer once S1 lands.
5. S3 only if the swap still reads as a pop after S1+S2.

Each step is a small, independently-reviewable `src/` PR (human-merge; product/design judgment on skeleton shapes + reveal feel), verified before/after by the tool — the payoff of having built it.

## Non-goals
- Not trying to make data always load within 320ms (impossible).
- Not a global animation-gating rewrite (S3) unless S1+S2 prove insufficient.
- The verifier PR (#824) is separate and already complete.

## Open questions for the dispatcher
- Build the shared kit + Game Plan POC now, or land the tool (#824) first?
- Skeleton shimmer vs static under reduced-motion (design call).
- Row-count heuristic for list skeletons (fixed N, last-known count, or viewport-fill).
