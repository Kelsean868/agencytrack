# Producing-Manager Phase 2 — agent-wizard routing + WAR retirement

Recon-gated, build-and-hold, NO deploy (CF deploys are Kyron's). Phase 1 (leaderboard
visibility — `appearOnLeaderboard` opt-in, role-gated) is LIVE (#631, squash 7950130, deployed).

## What Phase 2 does
Lets managers file the **agent wizard** for their own personal production (one source of truth),
and retires the old manager-WAR personal capture. Plus the #631 gamification-gate prerequisite.
RISKY — touches the wizard, CFs, schema, and roll-up.

## Locked decisions (reconciled spec + recon-review calls)
- Personal production flows through the agent wizard (submissions). One source of truth.
- UMs file mandatorily (Phase 3 enforces); BMs optionally. SM/TA never produce-file.
- UM `unitId` = own UID (existing model — a unit IS the UM's UID). BM `unitId` = a **branch-direct
  sentinel** — rolls into the branch total above units, counted once.
- Retire WAR `personalApi`/`personalApps` (from `ManagerWarTab` + `managerWarService` + schema).
- Retire `isProducingManager` — audit usages first; retire only if its sole role was gating the
  WAR personal fields.
- The gamification board (`onSubmissionWrite` → `leaderboard/{uid}`) must get the same
  `isParticipant` gate **before** managers file (the #631 prerequisite).

## Slice structure (confirm at recon) — strict dependency order
- **Slice 2.0 — gamification gate (CF). Ships + deploys FIRST.** Gate `onSubmissionWrite`'s
  `leaderboard/{uid}` write with `isParticipant` (agent/UM always; BM `appearOnLeaderboard===true`;
  SM/TA/PA never). Inert today (no managers file yet) but must be live before routing, or the
  board leaks. Build-and-hold; this is the one slice that deploys ahead of the others.
- **Slice 2.1 — agent-wizard routing.** Let a UM (`unitId`=own UID) and a BM (branch sentinel)
  open + file the agent wizard for personal production. The BM-sentinel/branch-direct roll-up may
  sub-split (2.1a UM, 2.1b BM) if the recon shows it's complex. Build-and-hold.
- **Slice 2.2 — WAR retirement + isProducingManager.** Remove `personalApi`/`personalApps` from
  `ManagerWarTab` + `managerWarService` + schema; audit + retire `isProducingManager`. After 2.1 —
  don't retire the old capture until the wizard replaces it. Build-and-hold.

## Phase 1 — RECON (HARD-STOP; report, then STOP for dispatcher)
1. **Wizard entry + unitId.** How an agent opens + submits the wizard; how `unitId` is resolved
   and required on the submission; the cleanest manager entry point. Confirm a UM's own-UID-as-
   `unitId` flows. What a BM branch sentinel needs (a reserved value? how the roll-up reads it?).
2. **Roll-up.** How unit + branch totals aggregate from submissions. Confirm a UM personal
   submission (`unitId`=own UID) rolls into the unit total exactly once. Map how a BM branch
   sentinel rolls into the branch directly (above units) without double-count. Flag any risk.
3. **WAR personal fields.** Confirm `ManagerWarTab.jsx` + `managerWarService.js` carry
   `personalApi`/`personalApps` gated by `isProducingManager`; map every read/write/display site.
4. **isProducingManager usages.** grep ALL usages; confirm its only role is gating the WAR personal
   fields; report any other use (blocks clean retirement).
5. **Gamification write.** Confirm `onSubmissionWrite` writes `leaderboard/{uid}` with no role
   filter. Can the CF (CJS) reuse the Phase-1 `isParticipant`, or does it need its own parity-
   tested copy? Map the insertion point.
6. **Mandatory gating (Phase 3 preview, recon ONLY — do NOT build).** How "who must file" / the
   compliance-miss flag is computed, so Phase 3's enforcement is scoped.
**Then STOP.** Paste the recon — I confirm the slice cut + the sentinel approach before any build.

## Build (after recon sign-off) — 2.0 → 2.1 → 2.2, each its own PR
Each slice: Phase 4 docs-with-placeholders (CONTEXT.md per Rule 16, FOLLOW_UPS.md) + Phase 5
commit/push/PR. Rule 21 Gemini, Rule 20 HEAD SHA.

## Smoke (per slice)
- 2.0: post-deploy — a manager (SM/TA, or non-opted-in BM) submission does NOT land on
  `leaderboard/{uid}`; an agent/UM does.
- 2.1: write-read-verify — a UM and a BM personal submission roll into the correct total exactly
  once (unit for the UM, branch-direct for the BM).
- 2.2: confirm the WAR personal fields are gone and `isProducingManager` is removed with no dead
  references.

## Merge posture
Build-and-hold — human-merge every slice. CF deploys are Kyron's. **Slice 2.0 deploys FIRST,
before 2.1's routing goes live**, so there's no window where managers can file onto an ungated
gamification board.
