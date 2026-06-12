# Year Plan Panel — Slice 2a: the working allocator (Game Plan Step 2)

## Context
Slice 2a is the agent-facing **allocator that saves a draft** — the modal where
the agent turns Money Needs targets into a per-line annual API plan and saves it.
It builds on the data-foundation (the `yearPlan/{year}` store + `licenseProfile`
field + `createYearPlan`/`getYearPlan`/`LICENSE_PROFILES`/`resolveLicenseProfile`).

**Out of 2a, into 2b:** the award-eligibility strip and the manager-override
(edit-user drawer select + manager-update rule allowlist). **Into Slice 3:** the
hub StepRail/PlanCascade visual wiring. **Step 4:** Commit. The panel stays behind
the coming-soon gate until the full loop ships.

Design source: CD's annotation `Year_Plan_Panel_-_Slice_2_Build.html`, with the two
reconciliations below applied. The Money Needs modal (`MoneyNeedsPanel.jsx`) is the
structural template.

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**Seed (reconciled — corrects CD annotation 4).** The shipped
`moneyNeeds/{year}.firstYearCommissionsTargets` is keyed `{ life, ah, property,
motor, total }` — no Group/Pension, nothing orphaned. The seed reads all four
line keys and converts each to API by the agent's commission rate. A line shows
**Seeded** (with the source figure) when its target is `> 0`, **No seed** when it's
`0` (the agent enters it). This is value-based, NOT the structural "Property/Motor
have no Money Needs line" CD drew — all four are real Money Needs lines.

**License gating (reconciled — the ahSide answer).** A&H sells under both the life
and the general license, so it's unconditionally enabled. The map:
```
composite:    { life: true,  ah: true, property: true,  motor: true }
life_only:    { life: true,  ah: true, property: false, motor: false }
general_only: { life: false, ah: true, property: true,  motor: true }
```
Disabled lines render greyed, toggle off, excluded from the total, the share math,
and (in 2b) the award API. First-run prompt labels: Composite = all four;
Life-only = "Life + A&H"; General-only = "A&H + Property + Motor".

**Allocation (CD Decision 1).** `targetAPI` per line is authoritative; pct, apps,
commission derive from it and are display-only.
- **Percent mode:** one Total Annual API field + a % share per line; shares
  live-validate to 100% (last-edited line absorbs rounding); `targetAPI = total × pct`.
- **Direct mode:** absolute API per line; no total field (total = Σ lines); `pct =
  targetAPI ÷ Σ targetAPI`, shown read-soft.
- **Mode switch converts representation, never the money:** `targetAPI` untouched.
  %→Direct drops the total field. Direct→% sets `total = Σ targetAPI` then recomputes
  pct. Full precision in the store; round display only.

**Derived (display-only).** `derivedApps = targetAPI ÷ avgPolicy` — reuse the SAME
avg-policy source `goalDecomposition.js` uses (single-source across Year Plan /
Playground / weekly planner). `derivedCommission = targetAPI × commissionRate`. The
rate tooltip is honest that it's a single blended rate across all lines.

**Summary card.** Total API, derived total apps, derived total commission, and a
"meets your Money Needs target" check — total commission vs
`firstYearCommissionsRequired`. This one is correctly on the **total** (the need is
total income, not awards).

**Save.** Writes `yearPlan/{year}` at `status: 'draft'` via a new service function.
Commit (draft→committed, writes Goals) is Step 4 — not here.

**Edge state — no Money Needs seed.** No `firstYearCommissionsTargets` → "no targets
to seed"; offer "Do Money Needs first" / "Enter from scratch". Drawn, not error-shaped.

**First-run — license profile unset.** Low-friction prompt, default Composite, writes
`user.licenseProfile` (the agent self-update allowlist already permits it from the
foundation). The profile then gates the allocator's lines.

**Honest-data.** `targetAPI` the single source; derived never stored as independent
truth; unset reads "Set in your plan", never a fabricated zero; TTD + `parseFloat`
on every numeric write; ≥44px on every input.

## Phase 1 — recon (HARD STOP — report findings, do NOT build yet)
1. **`MoneyNeedsPanel.jsx`** — the modal shell pattern (how it opens/dismisses, the
   header/body/footer structure, the `.input`/`.label` field primitives, loading/error/
   empty handling) to mirror as the structural template.
2. **`yearPlanService.js`** (from the foundation) — `createYearPlan`/`getYearPlan`
   signatures + the doc shape, so the new save/update function is consistent (mirror
   the `updateExpenseGroup`/`updateCommissionTargets` write style in `moneyNeedsService.js`).
3. **`goalDecomposition.js`** — the exact avg-policy source (is it
   `playgroundAvgPolicySize`? what's the default — TTD 12K?) and the income→API→apps
   math, to reuse for `derivedApps` rather than introduce a second figure.
4. **`user.commissionRate`** — the field shape (percent as a number, e.g. `35` not
   `0.35`) and its unset-default. Confirm where it's read.
5. **`firstYearCommissionsTargets` + `firstYearCommissionsRequired`** — confirm the
   shape `{ life, ah, property, motor, total }` and how both are read from the
   `moneyNeeds/{year}` doc.
6. **Hub StepRail Step 2 entry** — currently `variant="next"` / hardcoded. How to make
   it open the modal (the open trigger for 2a). The full rail/cascade visual wiring is
   Slice 3 — 2a just needs a working open path.
7. **Modal test harness** — does `MoneyNeedsPanel` (or a comparable modal) have RTL
   coverage? Match that style for the allocator's component tests.
8. **`updateUserProfile`** (`userService.js`) — for the first-run profile self-set write.
9. **Coming-soon gate state** — is the Game Plan hub / Year Plan reachable, or behind
   the PR #542 coming-soon gate? This determines the smoke approach (see Smoke).

## Phase 2 — service + pure math
- **`yearPlanService.js`**: add `saveYearPlan(tenantId, uid, year, lines, licenseProfile)`
  (or mirror the existing update style) — writes `lines.{life,ah,property,motor}` each
  `{targetAPI, pct, derivedApps, derivedCommission, enabled}` + `licenseProfile`
  snapshot + `status: 'draft'` + `updatedAt`. `parseFloat` all numerics.
- **Pure allocation helpers** (new module, e.g. `src/lib/yearPlanAllocation.js`,
  fully unit-tested — this is the intricate part): seed-from-targets (read +÷rate +
  seeded/no-seed flag), percent↔direct recompute, sum-to-100 with last-line rounding,
  the gating map (`LICENSE_LINE_GATING`), derived apps/commission. Keep these pure and
  framework-free so the math is testable in isolation.

## Phase 3 — the modal
- **`YearPlanModal`** — shell mirroring the Money Needs modal: header (title + STEP 2
  OF 4 + DRAFT pill + profile chip with "Change"), seed bar, mode toggle, body (2-col:
  allocator + summary), footer (Cancel / Save draft).
- **`LineAllocator`** — four enable-gated rows (gating per profile, A&H always on);
  ≥44px API field, share field, derived apps + commission per row; seeded/no-seed chip.
- **`AllocModeToggle`** — %/Direct per the locked mechanics.
- **Summary card** — total API, derived apps/commission, meets-need vs
  `firstYearCommissionsRequired`.
- **First-run profile prompt** (default Composite) and the **no-Money-Needs-seed** edge
  state — both drawn, not error-shaped.
- Wire the hub Step 2 entry to open the modal.

### Tests
- Unit: the allocation helpers (seed, percent↔direct conversion, rounding,
  gating-by-profile, derived math) + the save function (`parseFloat`, doc shape,
  status draft).
- Component/RTL (matching the harness from Phase 1 item 7): open → allocate →
  mode-switch → save; first-run prompt writes `licenseProfile`; no-seed state renders.

## Phase 4 — docs (with placeholders)
- PR-table row (placeholder SHA).
- Cross-reference CD's annotation + `docs/design/year-plan-scoping-notes.md`.
- Bank the 2b/Slice-3 deferrals explicitly: award strip + manager-override + the
  manager-update rule allowlist + its smoke → 2b; hub rail/cascade wiring → Slice 3.
- Note the reconciliations applied (seed value-based; A&H always-enabled) so the
  design reference and the build agree.

## Phase 5 — commit / push / PR
- Branch `feat/year-plan-panel-2a`.
- Conventional commit: `feat(year-plan): panel 2a — allocator modal, %/direct, seed, save`.
- Push; open PR; **Rule 21** Gemini poll + disposition; **Rule 20** report names the
  feature-branch HEAD SHA, no silent post-report pushes.

## Smoke
This slice ships the first UI that creates a `yearPlan` doc — it carries the
write-read-verify smoke deferred since the foundation: **open Year Plan → set profile
(first-run) → allocate (both modes) → Save draft → reload → assert `yearPlan/{year}`
persisted with the per-line allocation + `licenseProfile` snapshot**, and the
first-run profile write persists.

**Branch on the Phase 1 gate finding (item 9):**
- If Year Plan is **reachable**, run the UI write-read smoke above on the Vercel
  preview via `setupBypassSession`.
- If Year Plan is **behind the coming-soon gate** (like Money Needs was for its seed
  PR), the UI smoke defers to the un-gate PR, and 2a's save path rests on the unit
  tests + the foundation's emulator rules tests (create/update ALLOW). State this as a
  reasoned waiver, same posture as the Money-Needs-seed slice — don't manufacture a
  scripted prod write that the gate makes unrepresentative.
