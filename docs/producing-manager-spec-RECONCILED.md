# Spec (RECONCILED, canonical) — Producing-Manager Personal Production via the agent WAR

Supersedes both the original spec and CC's `#620` spec. `#620` proposed wiring up the WAR
`personalApi` pipeline (Options A–D) — that direction is REJECTED by the source-chat decisions;
this doc is canonical. Status: PLANNED, build-and-hold every phase.

## The feature
Managers file the full agent weekly wizard for their own personal selling, in addition to their
manager WAR. A unit manager is an agent who also manages — they carry personal production +
KPIs alongside management/recruiting KPIs.

## Locked decisions (source chat ff7aa21b)
1. **One source of truth.** Personal production flows through the **agent wizard (submissions)**.
   The WAR's `personalApi`/`personalApps` are **retired**.
2. UMs file mandatorily; BM and up optionally.
3. UMs appear on the **agent leaderboard by default**.
4. BM+ can hide themselves and individuals, **branch-bounded**.

## Leaderboard-visibility model
- `hiddenFromLeaderboard` boolean on the user doc; default false for agents + UMs.
- `leaderboardAggregate` filters on the flag, **NOT role**.
- Settable on self only by role ≥ branch_manager; on others only within the setter's branch.
- Reverses two banked FUs (the non-agent-UID filter + the WizardForm path) — they re-key off
  visibility, not role.

## Current state — from CC's recon (the part my original spec lacked)
- **Track I already SHIPPED `personalApi`/`personalApps` into a live `ManagerWarTab.jsx` +
  `managerWarService.js`, gated behind `isProducingManager`.** So "retiring" the WAR capture is
  NOT a schema cleanup — it means removing those fields from a live tab + service.
- Two gaps CC found: no UI to set `isProducingManager`; the WAR `personalApi` has no downstream
  pipeline. (CC's Options A–D for that pipeline are MOOT — the answer is the agent wizard.)
- "All Tatil managers produce" (per Kyron) — so the BM+ optional path (Phase 4) is **actually
  exercised in the pilot**, not a deferrable edge.

## Reconciliation resolutions
- **Retire the WAR personal-production capture** — remove `personalApi`/`personalApps` from
  `ManagerWarTab` (UI) + `managerWarService` (write) + the schema. Bigger than the original spec
  implied.
- **`isProducingManager` — recommend RETIRE.** The new model doesn't need it: UMs file by role
  (mandatory), BM+ filing IS the opt-in, leaderboard visibility is `hiddenFromLeaderboard`. The
  flag's only known job was gating the now-retired WAR fields. **[OPEN DECISION — see below.]**
  Phase recon must confirm it has no other uses before removal.

## Conflict register (resolution status)
1. Source-of-truth — RESOLVED (agent wizard canonical; WAR capture retired).
2. Leaderboard pollution — RESOLVED via the visibility model.
3. `unitId` on the wizard — UM RESOLVED (unit = own UID); **BM+ OPEN** (see decisions).
4. Roll-up double-count — a UM's personal production rolls into the unit total exactly once.
5. Mandatory enforcement — a missing UM personal WAR trips the compliance/miss-flag like an
   agent's.

## Phased plan (all build-and-hold; risky-PR Phase-1 hard-stop on each)
- **Phase 1 — leaderboard-visibility model (foundation):** the flag, `leaderboardAggregate`
  re-scope, branch-bounded set rules, hide-toggle UI. CF + rules → no deploy.
- **Phase 2 — agent-wizard routing + WAR retirement:** let UMs (mandatory) and BM+ (optional)
  file the agent wizard for their own book (UM unit = own UID; roll-up once); retire the WAR
  `personalApi`/`personalApps` from `ManagerWarTab` + `managerWarService`; retire/repurpose
  `isProducingManager` per the decision.
- **Phase 3 — UM mandatory-enforcement gate:** missing UM personal WAR = a compliance miss.
- **Phase 4 — BM+ optional path:** gated on the BM `unitId` roll-up decision. **Pilot-relevant**
  (Tatil BM+ produce), so decide it before pilot even though it builds last.

## OPEN DECISIONS for Kyron
1. **`isProducingManager`: retire (recommended) or repurpose** as the explicit BM+ opt-in flag?
   Retire is cleaner; repurpose keeps an explicit "this manager produces" toggle.
2. **BM+ `unitId` roll-up:** where an optional BM's personal production lands (no unit) —
   branch sentinel / own UID / excluded from unit roll-up. Pilot-relevant.

## Supersession + next
- Close `#620`; land this as canonical. Phase 1 build recon re-verifies the current-state
  specifics (the exact WAR field sites, `isProducingManager` usage, `leaderboardAggregate`
  filter) before any code. Build-and-hold throughout; CF + rules deploys are Kyron's.
