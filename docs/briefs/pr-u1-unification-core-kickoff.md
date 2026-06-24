# Kickoff Brief — PR-U1 · Game Plan Unification Core (Direction 1)

**Authored:** 2026-06-24 · dispatcher
**Baseline:** origin/main post-#739 (`b1f2d41` + `7d4d7ee`) — Phase 0 re-verifies the exact HEAD.
**run_model:** `claude-opus-4-8` (money-adjacent shape mapping + additive schema + agent-facing loop restructure, unattended — judgment-dense).
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — agent-facing, money math, schema, commit loop.
**Run:** Run 1, paired with PR-U0 on a separate file-disjoint branch off main. `/clear` at the boundary. **Merges only AFTER the operator's Step-zero default-ON verification** (see PR-U0 operator note).
**Parent PRD:** `docs/design/gameplan-unification-prd.md`.

---

## Why

Unify the two API-allocation writers. `yearPlan/{year}` stays canonical; the merged Money Needs + Allocator surface is repointed to write into `yearPlan` via a shape adapter; the legacy `YearPlanModal` (Step 2) is retired; the hub rail collapses 4→3. This is `LOOP_SPEC §2`. The `.allocation` decoupling was the temporary anti-collision measure.

---

## Locked decisions (build to these — do not reinterpret)

1. Canonical store = `yearPlan/{year}`. Merged surface writes it via `allocationToYearPlan(allocation)`.
2. `.allocation` write is **cut** (not dual-written) — no prod data, flag was OFF. *(If Phase 0 finds real `.allocation` prod data, STOP and wait for dispatcher — switches to a one-pass migration.)*
3. `yearPlan` line entries gain **additive** optional `rate` (decimal) + `products: [{name, api, rate}]` (≤4, Life + General).
4. Rail merged-step label = **"Money Needs"** (keep — least surprise; allocator reads as its second half).
5. Per-product apps divisor stays **blended** (`AVG_POLICY_API = 12000`). A&H stays its own line (`ahSide` unresolved). Neither is touched here.

---

## Phase 0 — falsification + source-verify (Rule 17/23; STOP on any mismatch)

Verified at authoring from the fresh repomix; **re-confirm each against live HEAD**, and STOP if any is false:

1. **Rules:** `match /users/{uid}/yearPlan/{year}` — `update` is owner-uid only with **no `hasOnly`** (additive `rate`/`products[]` need no rules change); `create` requires `request.resource.data.status == 'draft'` → the writer **must** set `status: 'draft'` on first write. Confirm both clauses verbatim.
2. **Writer:** confirm the `yearPlanService.js` export to call (`saveYearPlan` / `createYearPlan`) and whether it already sets `status: 'draft'` on create — if not, the adapter/caller sets it.
3. **Hub container:** `GamePlanV2/index.jsx` (`GamePlanScreen`) computes `yearPlanFilled` / `yearPlanTotalAPI` via `getYearPlan` and threads them to StepRail / PlanCascade / ReviewCommitModal / MonthlyPlanModal. Confirm the exact derivation before repointing.
4. **Commit read:** `commitPlan` / `ReviewCommitModal` consume the yearPlan **total** + `avgPolicyAPI` only (not `rate`/`products[]`). Confirm — the adapter must preserve `lines[].api` such that the sum is unchanged.
5. **Anchor:** `MonthlyPlanModal` `yearPlanAPI` === `yearPlanTotalAPI`. Confirm the adapter keeps the line-API sum equal to the allocator total (preserves `Σtargets === anchorAPI/1000`).
6. State the evidence that would overturn "no migration / no rules change" before banking it.

## Phases 1–3 — build (expected sites; Phase 0 confirms exact paths)

1. **Adapter** — `allocationToYearPlan(allocation)` in `src/lib/moneyNeedsAllocation.js`: keyed object → `yearPlan` array form, carrying `rate` + `products[]`, `status: 'draft'`. Pure; unit-tested (round-trip: allocator total === Σ yearPlan line api).
2. **Writer repoint** — `MoneyNeedsAllocator.jsx` persistence calls the `yearPlan` writer instead of `saveAllocation`. Remove the `.allocation` write.
3. **Schema** — additive `rate` / `products[]` on yearPlan line entries (no rules change per gate 1).
4. **Retire** `src/components/agent/YearPlanModal.jsx` + `__tests__/YearPlanModal.test.jsx`; remove its hub mount + any `onOpenYearPlan` wiring that pointed at it.
5. **Rail collapse 4→3** — `GamePlanV2/index.jsx`, `StepRail.jsx`, `PlanCascade.jsx`: Money Needs + Year Plan become one **"Money Needs"** step → Monthly → Review & Commit. Re-derive `yearPlanFilled` from the merged allocator having written `yearPlan`.
6. **Own smoke** — `smoke-yearplan-unified.mjs` (file-disjoint from U0): write allocation through the merged surface → assert `yearPlan` persisted (`lines[].api` + `rate` + `products`) → reload → assert → Send → assert Playground key + `game-plan` tab → assert rail shows **3** steps and `yearPlanFilled` true.

Self-verify: full test run green; lint 0; build clean; no new hex; smoke flag-ON both themes; axe 0 new serious/critical on the collapsed rail.

## Phase 4 — docs (placeholders until merge)

- `CONTEXT.md`: Recently-shipped row placeholder; **locked decision** entries (yearPlan canonical; `.allocation` retired; rail 4→3). `FOLLOW_UPS.md`: resolve the Step-2/yearPlan-unification FU placeholder; carry the per-product avg-policy LOW; note U2 (rules maturation + dead-code) as the dependent follow-on.

## Phase 5 — commit / push / PR

- Single branch off fresh main. **Rule 15** verbatim paste-back. **Rule 20** name the feature HEAD SHA. PR description references the CONTEXT.md locked-decision diff.

## Phase 6 — hold

- **Rule 21** poll 15 min, disposition all. **Rule 22** enumerate ≥1 known gap (seed: the flag-ON live drive-through is the operator's real acceptance test; green smoke is necessary, not sufficient). Then **STOP and wait for dispatcher**.

---

## Known risks (flag, don't absorb)

- **No rules/CF/index deploy** expected (additive fields, owner-only update rule). If Phase 0 finds a `hasOnly` on the yearPlan update arm, **STOP** — rules move to PR-U2 and U1 must not ship fields the rules would reject.
- Schema/rules coupling window: `products[]`/`rate` ship unconstrained until PR-U2 matures yearPlan rules (owner-only path, low risk). If unacceptable, fold a minimal `products[]` value-constraint into U1 — flag to dispatcher first.
