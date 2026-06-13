# Review & Commit — Commit-Logic Slice (Game Plan Step 4, Slice 1 of 3)

## Context
Step 4 is the only step that writes real data: it commits the agent's plan into the
Goals Personal Commitment and flips both plans from draft to committed. This slice is the
**headless commit logic** — the single atomic, floor-enforced transaction — with no UI.
It's isolated because it's the most consequential write in the whole app (it sets the
agent's real annual target), so it earns a focused, fully-tested slice before the panel
(Slice 2) wraps it and the hub wiring (Slice 3) lights the capstone.

Design source: CD's `Review & Commit Panel — Step 4 Build`, **with the two reconciliations
below applied** (the field pin + the company-floor enforcement CD couldn't have seen).

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**THE PIN (reconciled).** The Personal Commitment field is **`personalAnnualAPI`** on the
doc at **`tenants/{tenantId}/goals/{agentId}`** (agentId = the agent's uid). NOT
`personalCommitment` (the annotation's placeholder). This is the field CareerPortal,
the bulk-import, and `getGoalHierarchy` all use.

**FLOOR-ENFORCED (the reconciliation that adds a branch).** Personal goals are
floor-gated: the annual-API floor is resolved **per-agent** from `contractStartDate` via
`utils/tenureFloors.js` (flat 200K fallback when the date is missing/invalid), exactly as
`setGoals` does it. **A plan whose committed annual API is below the agent's floor cannot
commit** — the commit must resolve the floor, compare, and **reject below-floor commits**
with a typed error the panel can catch and turn into a "raise your target in Year Plan"
state. **Reuse the floor resolution** (`tenureFloors` + `getCompanyMinimums`) — do NOT
re-implement the band logic.

**THE WRITE.** Commit writes **`personalAnnualAPI`** = the plan's committed annual API
total (sum of enabled-line `yearPlan` targetAPI), **and `personalAnnualApps`** = the
plan's derived annual apps (the plan already derives this; the Goals commitment holds both
and `setGoals` floor-checks both, so writing API-only would leave apps stale — lean:
write both). `merge: true` semantics so manager-set target fields and other goal fields on
the same doc are preserved. *(Mild divergence from the annotation's "API only" lean — flag
in the report; trivial to drop apps if Kyron prefers.)*

**ATOMIC — one transaction.** A Firestore transaction, all-or-nothing:
1. Resolve + enforce the floor (reusing `tenureFloors`/`getCompanyMinimums`). Below floor
   ⇒ throw a typed `BelowFloorError` (carry the floor + the plan total) — nothing writes.
2. Write `goals/{agentId}` `personalAnnualAPI` (+ `personalAnnualApps`), `merge: true`.
3. Flip `yearPlan/{year}.status` and `monthlyPlan/{year}.status` to `'committed'`.
4. Set `committedAt` (Trinidad-time server timestamp) on the plan(s).
All four land together or none do — the loop is never half-committed. Expose as
`commitPlan(tenantId, uid, year, { annualAPI, annualApps })` (or resolve those inside from
the loaded plans — Phase 1 picks the cleaner signature).

**RULES (verify + pre-authorized).** The agent self-write of `goals/{agentId}`
`personalAnnualAPI` is **already permitted** (CareerPortal uses it) — no goals-rules
change. For the **status flip**: the foundation create-rules constrained
`status == 'draft'`; confirm whether the yearPlan/monthlyPlan **update** rules allow the
owner to set `status == 'committed'`. If they constrain update to draft, you are
**pre-authorized** to add the owner `draft → committed` transition to both arms,
**committed-not-deployed** (rides the un-gate, like every other gated-loop rules change).
Report exactly what you found and changed.

**RE-COMMIT — not this slice.** Whether a committed plan can be re-opened
(`recommitPolicy: 'open' | 'locked'`) is a UI/status gate enforced in the **panel**
(Slice 2). The commit transaction itself is identical either way — it writes/overwrites
`personalAnnualAPI` + a fresh `committedAt`. Build the write; don't gate re-commit here.

### Deferred OUT of this slice
- `ReviewCommitModal` + `PlanReview` + `CommitConsequence` + `CommitConfirm` +
  `CommittedDone` + the states (committing / incomplete-loop / **below-floor** / failed)
  → **Slice 2** (gated panel).
- StepRail Step 4 status + the PlanCascade Commit rung + completeness → 100% (the un-gate
  trigger) → **Slice 3** (gated wiring).
- `recommitPolicy` open/locked UI gating → Slice 2.
- Manager acknowledgement/approval, commitment history/audit, branch roll-up → deferred
  surfaces per the annotation.

## Phase 1 — recon (report findings inline, then PROCEED; rules change pre-authorized)
**Only stop if a finding contradicts a locked decision** (e.g. `personalAnnualAPI` isn't
the field, or the floor can't be resolved without re-implementing tenureFloors).
1. **`goalsService.js`** — `setGoals` floor enforcement (the `tenureFloors` +
   `getCompanyMinimums` chain) to reuse; confirm the `goals/{agentId}` path + the
   `personalAnnualAPI`/`personalAnnualApps` fields + `merge: true` semantics.
2. **`utils/tenureFloors.js`** — the per-agent floor resolution + the flat-200K fallback,
   to reuse in the transaction.
3. **yearPlan + monthlyPlan UPDATE rules** — does the owner-update arm allow
   `status: 'committed'`, or is it constrained to draft? (Pre-authorized to add the
   transition, committed-not-deployed, if constrained.)
4. **Firestore transaction feasibility** — confirm a single `runTransaction` can read the
   floor inputs + write `goals` + both plan docs (same database, ≤ the transaction doc
   limit). If a CF would be cleaner, report before choosing — but the client transaction
   is the default (no new CF + deploy).
5. **The plan reads** — how the committed annual API + derived apps are resolved from the
   loaded `yearPlan` (+ the apps derivation), so the commit's inputs are single-sourced.

## Phase 2 — the commit transaction (`src/services/commitPlanService.js`, new)
- `commitPlan(...)` per the atomic spec above. Reuse the floor resolution; throw
  `BelowFloorError` (typed/named so the panel can branch on it). `merge: true` on the
  goals write. Trinidad-time `committedAt`.

## Phase 3 — rules (`firestore.rules`, only if Phase 1 found the flip is blocked)
- Add the owner `draft → committed` status transition to the yearPlan + monthlyPlan update
  arms. **Committed-not-deployed** (rides the un-gate). Emulator-tested.

### Tests
- **Unit** (`commitPlanService.test.js`): writes `personalAnnualAPI` (+ apps) with `merge`;
  flips both statuses to committed; sets `committedAt`; throws `BelowFloorError` when the
  total is below the resolved floor (test both a tenure-band floor and the flat fallback);
  the transaction is all-or-nothing (a mocked write failure leaves nothing committed).
- **Emulator rules** (extend the yearPlan/monthlyPlan harnesses): owner CAN flip
  `status` draft → committed; non-owner CANNOT; the goals `personalAnnualAPI` self-write is
  allowed for the owner. (Floor enforcement is a service concern, not a rules concern —
  don't assert it at the rules layer.)

## Phase 4 — docs (with placeholders)
- PR-table row; cross-reference CD's annotation + the Year Plan / Monthly briefs.
- Record the two reconciliations (field = `personalAnnualAPI`; floor enforcement added).
- Bank: panel + below-floor state → Slice 2; hub wiring + 100% un-gate trigger → Slice 3;
  the three lean product calls (re-commit, write-fields, manager visibility) confirmed at
  Slice 2; the live commit write-read smoke rides Slice 2 (first UI that triggers commit).
- CONTEXT.md: backend + rules (committed-not-deployed) — judge the Current main HEAD
  advance per Rule 16(b) (the foundation pattern advanced; the gated panels didn't — this
  ships service code, so treat like the foundations and advance).

## Phase 5 — commit / push / PR
- Branch `feat/commit-plan-logic`.
- `feat(commit): step 4 slice 1 — atomic floor-enforced commit transaction`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
Headless — no UI triggers a commit until Slice 2. Verification is the unit + emulator
tests. The rules change (if any) is **committed-not-deployed** — it rides the un-gate, NOT
this merge (unlike the Slice-1 monthlyPlan owner arm, this is a change to the *committed
status transition* that only the gated panel exercises). The live commit write-read smoke
(open Step 4 → commit → assert `goals.personalAnnualAPI` set + both statuses committed →
reload) rides **Slice 2**.

## Merge posture
Headless service + tests + committed-not-deployed rules = **inert on merge**, no UI, no
aesthetic judgment. Auto-merge eligible under the standard gate. **No deploy at merge** —
the status-transition rules ride the un-gate.
