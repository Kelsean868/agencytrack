# Review & Commit — Apps-Floor Foundation (Game Plan Step 4, Slice 2 of 4)

## Context
Kyron confirmed both company floors are binding on a personal commitment, the apps floor
is checked at the **agent's own average policy size**, and the apps floor is a **flat 42**
(no tenure scaling, unlike the API floor). The shipped Year Plan derives apps at a flat
**12K** (`goalDecomposition` default) — so committing against the agent's real average
would mismatch what the Year Plan shows. This slice makes the apps basis the agent's own
average **consistently across the loop** and adds the apps floor to the commit. Headless
logic + retrofits of the (gated) Year Plan and Monthly apps derivations — **no new UI**
(the panel + the below-floor states are Slice 3).

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**Apps basis (the agent's average).** Apps derive as `annualAPI ÷ avgPolicySize`, where
`avgPolicySize` is the agent's **`goals/{agentId}.playgroundAvgPolicySize`** (the saved
Commission Playground assumption — the agent's own average annual API per policy). This
replaces the flat 12K everywhere apps are derived in the loop.

**Shared helper — single source.** New pure `src/lib/deriveApps.js` exporting
`deriveAnnualApps(annualAPI, avgPolicySize)` = `annualAPI / avgPolicySize` (guard
divide-by-zero / non-positive → return 0 or throw, Phase-1 picks). A sensible default
(`= 12000`) keeps current behaviour when no average is supplied. Every apps derivation in
the loop routes through this — no second `÷ 12000` left anywhere.

**The two floors (distinct).**
- **API floor** — tenure-scaled, per-agent via `resolveAnnualAPIFloor` (unchanged from
  #593).
- **Apps floor** — **flat 42** (`companyMinimums.annualApps`, default 42; NO tenure
  band), checked against the agent's-average apps (`deriveAnnualApps(annualAPI,
  avgPolicySize) ≥ 42`).
- Both binding: a commit must clear **both**. The commit throws **distinct** typed errors
  (`BelowApiFloorError` vs `BelowAppsFloorError`) so the panel (Slice 3) can say *which*
  floor failed and point the agent to the right fix (raise API vs plan smaller/more
  policies).

**Missing average.** The apps floor is meaningless without `avgPolicySize`. If it's unset
at commit, do NOT silently fall back to 12K for the floor check (that would demand 504K
API for 42 apps and reject reasonable plans). Throw a distinct `AvgPolicyMissingError`;
the panel will turn it into a "set your average policy size in Money Needs first" state.
**Phase 1: confirm whether `playgroundAvgPolicySize` is reliably set by the time an agent
reaches commit** (is the Playground part of the required Step-1 flow, or optional?) —
report it, and if it's reliably set, the missing-average path is a guard, not a common case.

**Retrofit — Year Plan + Monthly use the helper + the agent's average.**
- `yearPlanAllocation.js` `derivedApps` (currently `targetAPI ÷ 12000`) → `deriveAnnualApps(
  targetAPI, avgPolicySize)`, with `avgPolicySize` threaded in from the Year Plan modal
  (resolved from `goals.playgroundAvgPolicySize`). Per-line apps = per-line API ÷ the
  agent's average; total apps = total API ÷ the average.
- `monthlyPlanMath.js` apps derivation (`monthlyPace.toFinishApps`, currently the 12K
  `avgPolicyAPI`) → the same helper + the agent's average, threaded from the Monthly modal.
- These are gated, shipped surfaces — the change is **inert** (flag off), but it makes the
  loop's displayed apps match the floor the commit enforces.

### Deferred OUT of this slice
- `ReviewCommitModal` + the below-API-floor / below-apps-floor / missing-average UI states
  + re-commit + manager visibility + Step 4 open wiring → **Slice 3**.
- StepRail Step 4 status + Commit rung + 100% → **Slice 4**.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
**Only stop if a finding contradicts a locked decision.**
1. **`playgroundAvgPolicySize`** — confirm the field/path (`goals/{agentId}`), and whether
   it's reliably set by commit time (Playground required vs optional in the Step-1 flow).
   Report — it decides how prominent the missing-average path is.
2. **`yearPlanAllocation.js`** — the exact `derivedApps` site(s) + signatures, to thread
   `avgPolicySize` through (the module is pure — the modal resolves + passes the average).
3. **`monthlyPlanMath.js`** — the apps-derivation site(s) using the 12K `avgPolicyAPI`, to
   route through the helper + the agent's average.
4. **The Year Plan + Monthly modals** — where they resolve agent/goals data, to source
   `avgPolicySize` and pass it into the (now-parameterised) math.
5. **`companyMinimums.annualApps`** (`getCompanyMinimums`, default 42) — the apps floor
   value, flat, no tenure band.
6. **`commitPlanService.js` (#593)** — the current API-floor structure, to add the apps
   floor + the two distinct errors beside it.

## Phase 2 — the shared helper (`src/lib/deriveApps.js`, new)
- `deriveAnnualApps(annualAPI, avgPolicySize = 12000)`; guard non-positive divisor; pure;
  fully unit-tested.

## Phase 3 — retrofit Year Plan + Monthly
- Parameterise `yearPlanAllocation.js` derivedApps + `monthlyPlanMath.js` apps on
  `avgPolicySize`, routed through `deriveAnnualApps`; thread the agent's average from each
  modal (resolved from `goals.playgroundAvgPolicySize`, default when unset). Update the
  affected unit tests to pass an average (and keep a default-behaviour case).

## Phase 4 — extend the commit (`commitPlanService.js`)
- Resolve `avgPolicySize` (from `goals`); compute apps via `deriveAnnualApps`; enforce the
  flat-42 apps floor beside the tenure API floor. Throw `BelowApiFloorError`,
  `BelowAppsFloorError`, `AvgPolicyMissingError` — distinct, typed, carrying the relevant
  numbers (floor, actual, average) so the panel can render the right message.

### Tests
- `deriveApps.test.js`: math; default when no average; divide-by-zero/negative guard.
- Year Plan + Monthly math tests: apps now use the passed average; a default-average case
  preserves prior numbers.
- `commitPlanService.test.js` (extend): below-API → `BelowApiFloorError`; API-ok but
  below-apps (agent's average) → `BelowAppsFloorError`; unset average → `AvgPolicyMissingError`;
  both floors cleared → commits; the dual check is atomic (a throw leaves nothing written).
- Emulator rules: unchanged (floors are a service concern, not a rules concern).

## Phase 5 — docs + commit/PR
- PR-table row; cross-reference the Step 4 commit-logic brief + CD's annotation.
- Record: apps now derive from the agent's average loop-wide; the flat-42 apps floor; the
  three typed commit errors; the missing-average guard.
- Bank for Slice 3: the panel's below-API / below-apps / missing-average states; re-commit;
  manager visibility. For un-gate prep: nothing new here (the retrofit is part of this slice,
  not banked).
- CONTEXT.md: service + lib + gated retrofits — judge Current main HEAD per Rule 16(b)
  (ships service/lib code → treat like a foundation, advance).
- Branch `feat/commit-apps-floor`; `feat(commit): step 4 slice 2 — agent-average apps basis + flat-42 apps floor`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
Headless logic + gated retrofits — no UI triggers a commit until Slice 3, and the Year
Plan/Monthly changes are flag-off-inert. Verification is the unit tests. The live
dual-floor write-read smoke rides **Slice 3** (the panel that triggers commit).

## Merge posture
Service + lib + gated, behind-flag retrofits, no new visual design → **auto-merge eligible**
under the standard gate. **No deploy** (no rules change — floors are service-enforced).
