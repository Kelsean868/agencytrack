# Goals v3.2 — Awards reach (agent goal portfolio)

**Sized:** S–M
**Branch:** `feat/goals-v3.2-awards-reach` (off freshly-fetched main)
**Type:** Agent-facing frontend feature — display-only computed reach + localStorage-persisted pinned aspirations. Reuses `awardsRuleset_2026`. **NO rules / CF / migration / money.**
**Channel:** **TIER-B AUTO-MERGE.** Design is locked (decisions ledger, 2026-06-15). Gates: full lint/test/build + a **value-asserting** smoke (the gap numbers, not just "it renders") + Gemini disposed (HARD gate — per #640, Gemini catches what the smoke misses) + axe NO-NEW + both-themes + scope-lock + no rules/CF/money → prod-smoke + AUTO-REVERT on fail. First true Tier-B feature build, so CC produces a **thorough post-merge report** for dispatcher check-in: both-theme screenshots, the asserted gap values, the Gemini disposition, and the Phase 1.5 manager-goal-access finding.

## What it is

Below the existing GapAnalysisPanel / derived-income surface on the agent Goals tab, add an **Awards reach** section:
1. **Auto-surface the nearest reachable award** + the gap to it, computed from `awardsRuleset_2026` + the user's YTD production. Show the next 1–2 reachable tiers too. Definition: the nearest *unearned* award by smallest gap (Phase 1 refines per the ruleset's structure).
2. **Pinned aspirational awards:** the user pins **1–3** stretch awards from `awardsRuleset_2026` and sees the gap to each. Pins persist via **localStorage** (per-device; same approach the app uses for dark mode). **Agent-private** — managers don't see aspirations in this run.

## Role-agnostic principle (manager-cockpit direction)

Build the component to operate on **the viewing user's own production + own goal data**, NOT "agent-only" data. **No `role === 'agent'` hardcoding inside the component** — gate access at the *surface* (which dashboard renders it), not in the component. A producing manager must get the identical portfolio when the Tier-2 cockpit surfaces it, with zero rework.

## Phase 1 — source-verify · **report-and-PROCEED** (this is Tier-B; STOP only if a premise below breaks)

STOP conditions: the ruleset requires stored data to compute reach · pinning can't work without Firestore (cross-device requirement surfaces) · any rules/CF/money implication appears. Otherwise report and continue.

1. `awardsRuleset_2026` — its shape: how awards + thresholds/criteria are defined, which metric(s) drive qualification (API? apps? persistency? composite?), and how to compute "reachable" + the gap. Quote the structure.
2. The user's YTD production source feeding the gap calc — **reuse the same source** GapAnalysisPanel / the derived-income panel already use; do not refetch.
3. Mount point — below the derived-income panel on the agent Goals tab (where DerivedIncomePanel mounts).
4. localStorage pattern in the app (the dark-mode precedent) — reuse it for pin persistence; confirm key naming + no hydration/SSR issue.
5. **Manager goal-access recon (per dispatcher):** can a producing manager today (a) **set** their own personal commitment (Game Plan loop / `setGoals` for own uid) and (b) **view** their own portfolio (GapAnalysisPanel / derived-income)? Report whether the manager dashboard surfaces the agent goal experience for the manager's own production, or if it's agent-dashboard-only. **RECON ONLY** — do NOT build manager-surfacing here (that's Tier-2 cockpit). Just report the state so we know if there's a functional gap worth a small enablement slice.
6. Tests touching the Goals tab / GapAnalysisPanel surface.

## Phase 2 — build

1. `AwardsReachPanel` — role-agnostic, operates on the viewer's own YTD + `awardsRuleset_2026`:
   - Compute nearest reachable award(s) + gap; render the next 1–2 tiers.
   - Pinned aspirations (1–3, localStorage-persisted) + gap to each; pin/unpin control.
   - Both themes, mobile, ≥44px targets, Nexus tokens (no hex), Lucide icons.
   - States: loading · no-production · no-pins.
2. Mount below the derived-income panel on the agent Goals tab.

## Phase 3 — tests

- **Compute-correctness (value assertions):** given a known YTD + ruleset fixture, the nearest-reachable award + gap match expected **values**.
- **Pinning:** pin/unpin writes localStorage; pins restore on reload; cap enforced at 3.
- **States:** no-production, no-pins, loading.
- **Role-agnostic:** the component renders correctly given a manager's own-data shape (no agent-only assumption).
- Full suite green; lint 0; build clean; hex-grep clean.

## Phase 4 — docs (placeholders)

- `CONTEXT.md` ledger; ROADMAP Goals v3 — mark v3.2 done.
- `FOLLOW_UPS.md`: bank the Phase 1.5 manager-goal-access finding (tie to the Tier-2 cockpit); bank Firestore-persisted pins as a future cross-device upgrade.

## Phase 5 — PR + smoke + Tier-B auto-merge

1. Open PR. **Gemini poll + disposition (HARD gate).**
2. **Smoke (pre-merge preview, both themes):** assert the ACTUAL nearest-reachable award + gap **values** for a seeded user (not presence) · pin → reload → pins persist · no manager-visible aspiration · axe NO-NEW.
3. **Tier-B AUTO-MERGE** on all-green → prod-smoke + AUTO-REVERT on fail.
4. **Thorough post-merge report** for check-in: both-theme screenshots, asserted gap values, Gemini disposition, the Phase 1.5 finding.

## Risk notes

- localStorage pins = per-device (acceptable v1). If cross-device is required, **STOP** — that's a Firestore field → rules → BUILD-AND-HOLD, not Tier-B.
- The value-asserting smoke is the Tier-B gate: gap numbers checked, not just rendered.
- Component role-agnostic so the Tier-2 manager cockpit inherits it for free.
