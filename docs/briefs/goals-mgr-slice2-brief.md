# Manager Goals — Slice 2: the manager surface (drawer + roster + tier form + commit floor)

## Context
The main UI slice of the manager Goals build, applying CD's `Manager_Goals_-_Goal_Setting_Build.html`
on top of Slice 1's model (PR #616 — `targetLocked`/`locked` fields, agent-level floor in
`setGoals`, `gamePlanCommitted`). The recon confirmed the role-aware shell, per-agent roster,
per-agent editing, manager R/W rules, provenance, and CommissionPlayground all EXIST — so this
is mostly **restyle + wire the new recommend-vs-lock grammar**, plus one required enforcement
completion. **Build-and-hold — human-merge** (CD aesthetic gate + new enforcement on the commit
path). Slice 3 (Playground/award-reach embed) follows after this merges.

## REQUIRED enforcement completion (closes the Slice 1 Gemini HIGH)
- **Add the agent-level cascade-floor check to `commitPlanService.commitPlan`.** Slice 1 enforces
  it in `setGoals`, but the agent commits through the *loop* (`commitPlan`), which currently does
  not check the locked target — so locks don't bind the real path. Inside the commit transaction,
  read the agent's goals doc; if `targetLocked` is true, require the committed `personalAnnualAPI`
  (and apps/persistency) ≥ the locked `target*`, throwing the same floor error as `setGoals`. This
  must ship in this slice or the lock feature is cosmetic.

## Decisions locked (surface ANY deviation)
- Apply CD's manager sheet faithfully; Nexus warm tokens (CSS vars only, no hex), Lucide, ≥44px,
  both themes, mobile bottom-sheet for the drawer.
- The **recommend-vs-lock toggle** writes Slice 1's flags: tier form → `locked` on the tier write;
  agent target drawer → `targetLocked` on the agent goals doc.
- **Recommend** = gold "a suggestion, not their commitment" banner, advisory. **Lock** = floor
  language, binding.
- Tier-level locks are **stored + displayed as a roll-up gap** ("your units sum to X against your
  locked branch Y") — NOT write-time roll-up enforced (per Slice 1 scope).

## Phase 1 — recon (report inline, then PROCEED)
1. `GoalsPanel.jsx` structure — the role branches (UM/BM/SM tabs), `AgentGoalsTab`/`AgentGoalRow`
   (the existing roster + per-agent inputs + Save), the tier tabs (`UnitGoalsTab` etc.), and the
   self-tab Playground embed — so the restyle maps onto real components.
2. The `setGoals` manager-target path + `setUnitGoals`/etc. signatures (Slice 1 added `targetLocked`
   / `meta.locked`) — confirm the drawer/form write through them.
3. `commitPlanService.commitPlan` transaction shape — confirm where to add the floor read/check.
4. `gamePlanCommitted` on the goals doc (Slice 1) — for the roster committed badge.
5. Tenure floors source (`tenureFloors.js`) — for the per-row floor banding.

## Phase 2 — build
- **RecommendLockDrawer (net-new)** — slider + numeric entry (≥44px) + floor mark + recommend/lock
  toggle + the gold suggestion banner + cascade context. Reusable for both agent targets and tier
  goals. Mobile = bottom sheet.
- **AgentGoalsTab restyle** — exception-first ordering (unset → below-floor → above), each row
  banded against the agent's tenure floor, status chip (Not-set / Below / Above), expandable
  (annual → monthly → weekly), the **committed-in-Game-Plan badge** from `gamePlanCommitted`, and
  the set-target action opening the drawer (writing `targetLocked`).
- **TierGoalForm restyle** (Unit/Branch/SM) — recommend/lock toggle (writes `locked`), provenance
  ("last set by", from `setBy`/`setByName`), Save & cascade, and the **roll-up gap readout** for a
  locked tier.
- **SelfGoalCard** — the producing manager's own commitment, restyled, kept out of team totals.
- **commitPlan floor check** — per the REQUIRED section above.

## Phase 3 — tests
- Drawer renders/toggles; recommend vs lock writes the right flag.
- Roster ordering (exception-first), floor banding, status chips, committed badge.
- Tier form writes `locked` + shows provenance + roll-up gap.
- `commitPlan` rejects a below-locked-floor commit and allows at/above (the new enforcement).
- Keep the suite green.

## Phase 4 — docs + commit/PR
- CONTEXT.md per Rule 16(b): feature UI + commit-path enforcement — advances Current main HEAD.
- Branch `feat/goals-mgr-slice2-surface`; `feat(goals): manager recommend-vs-lock surface`.
- Push; PR; **Rule 21** Gemini; **Rule 20** SHA.

## Smoke
**Production-facing, write-read-verify.** Manager = tenant admin, agent = test agent: open the
manager Goals view → set a **locked** target on an agent via the drawer → confirm the roster shows
it + the committed badge state → as the agent, attempt to commit **below** the locked floor via the
loop → **rejected** → at/above → **persists**. Roster ordering + tier form + both themes + mobile
drawer. Confirm no "Coming soon" anywhere.

## Merge posture
**Build-and-hold — human-merge.** This is the largest UI surface of the build and it changes the
commit path; do NOT auto-merge. Open the PR, run the smoke, hold for Kyron's eyeball (the drawer,
the roster, the recommend/lock grammar, both themes) + review of the commit-floor enforcement.
