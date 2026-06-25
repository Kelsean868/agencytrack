# Kickoff Brief — PR-U2 · yearPlan Rules Maturation + Dead-Code + `.allocation` Cleanup

**Authored:** 2026-06-24 · dispatcher
**Baseline:** origin/main `606356e` (post-U1) — Phase 0 re-verifies the exact HEAD.
**run_model:** `claude-opus-4-8` (security rules — high blast radius).
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — security rules + agent-facing dead-code. **+ two operator post-merge actions:** `firebase deploy --only firestore:rules`, and run the `.allocation` delete script (read → dry-run → `--apply`).
**Parent PRD:** `docs/design/gameplan-unification-prd.md` (PR-U2 is the dependent follow-on in §5).

---

## Why

U1 shipped the 3-key `yearPlan` taxonomy + additive `rate`/`products[]` with **no rules change** and left two threads open by design: (1) `yearPlan` rules don't yet constrain the new fields; (2) the `.allocation` writer was cut but its reader/hydration path and 2 residual prod docs remain. U2 closes both.

---

## Locked decisions (build to these)

1. **Rules — Option 2 (additive field constraints; keys stay permissive).** Constrain the *shape/range* of `rate` and `products[]`. **Do NOT** add a `lines` key allowlist — the `{life,ah,general}` taxonomy is enforced in the data layer (shared `LINE_KEYS`); duplicating it in rules violates the single-boundary principle. *(Migration already cleared all 4-key docs, so policing key names buys nothing.)*
2. **Rules constraints are coarse by necessity.** Firestore rules can't iterate list elements. So: per-known-line `rate is number && >=0 && <=1` (conditional on the line being present), and `products is list && size() <= 4`. **Deep per-product field validation stays in the data-layer sanitizer** (`saveYearPlan` `sanitizeProducts`, shipped in U1). Don't attempt per-element rules.
3. **`.allocation` residue is deleted at the FIELD level**, not the doc. The `moneyNeeds/{year}` worksheet is real agent data; only the `.allocation` sub-object is residue. Delete via `FieldValue.delete()`.
4. The migration is **done** (applied 2026-06-24, A=0 verified). U2 does not re-run it.

---

## Phase 0 — falsification + source-verify (Rule 17/23; STOP on mismatch)

1. Confirm HEAD `606356e`; clean tree.
2. **Rules:** read the current `yearPlan` `create`/`update` arms. Confirm there is still no `hasOnly`/key-allowlist (so adding field constraints is purely additive). Identify whether create + update should share a `validYearPlanLines()` helper.
3. **Dead `.allocation` reader:** `git grep` for every `.allocation` read/hydration site (expected: `MoneyNeedsPanel.jsx` hydration; any `moneyNeedsService` allocation read). Enumerate exhaustively — the cut is only safe if no live writer remains (confirm `saveAllocation` is already unreferenced post-U1).
4. **Orphan check:** `git grep` importers of `src/lib/yearPlanAllocation.js` (CC flagged in U1 Phase 0 that retiring `YearPlanModal` likely orphans it). Remove only if **zero** importers; else note for a later FU.
5. **U0 smoke:** if PR-U0 has merged and shipped `smoke-mn-allocator-flagon.mjs` (the `.allocation`-asserting harness), it's superseded — remove it. If U0 hasn't merged, skip (nothing to remove).
6. State the evidence that would overturn "the `.allocation` reader is dead" (e.g., a surviving code path that still writes it) before removing.

## Phase 1–3 — build (expected sites; Phase 0 confirms)

1. **Rules** (`firestore.rules`) — add the Option-2 constraints (§decision 2) to the `yearPlan` write arms, factored into a shared validator. No key allowlist.
2. **Dead-code** — remove the `.allocation` writer remnant (`saveAllocation` + the `moneyNeeds` allocation write in the service), the `.allocation` reader/hydration path, and the orphaned `yearPlanAllocation.js` (if §0.4 confirms zero importers). The allocator already seeds from worksheet targets on reload — removing the dead reader is **behavior-neutral** (nothing has written `.allocation` since U1).
3. **`.allocation` delete script** — `functions/scripts/delete-stranded-allocation.cjs`: idempotent, **dry-run default**, `--apply` gated, per-doc log, explicit `<projectId>` arg (mirror the migration/probe pattern — never run blind). Deletes the `.allocation` **field** from each `moneyNeeds/{year}` doc that has it, **only where the agent has a `yearPlan` doc** (re-verify per-doc; both known residue docs already qualify). Jest test for the pure "should-delete" predicate in `functions/__tests__/`.
4. **Migration hardening (LOW, CC discretion)** — add to `migrate-yearplan-3line.cjs` a dry-run guard: any **committed** doc folding to a **zero** total emits `⚠ REVIEW` instead of a silent `(preserved)`, so a future re-run surfaces the empty-committed case without a hand-dump. 3-line change; skip if it risks the existing 12 Jest tests.

Self-verify: full root vitest + functions Jest green; lint 0; build clean. **Rules unit tests** (emulator, Java JDK 21) for the new `rate`/`products` constraints — valid writes pass, out-of-range `rate` and `size()>4` `products` rejected, and a write omitting the new fields still passes (additive, not required).

## Phase 4–6 — docs / PR / hold

- **Phase 4:** `CONTEXT.md` — correct the migration state to **"applied 2026-06-24, A=0 verified; `.allocation` residue deleted in U2"**; bank the two known false-positives (probe `§2.6 VERDICT` is `.allocation`-presence-based → cries "Arm B" until residue deleted; empty committed doc `LOJDZrAN…` is a test artifact). `FOLLOW_UPS.md`: resolve the U2 FU; note GLM never reviewed #744 (429 throughout) as a coverage gap.
- **Phase 5:** branch off `606356e`; **Rule 15** verbatim paste-back; **Rule 20** name HEAD SHA.
- **Phase 6:** **Rule 21** poll 15 min (GLM has been 429 — note if still unavailable); **Rule 22** ≥1 named gap. Then **STOP and wait for dispatcher**.

---

## Operator post-merge actions (after squash-merge)

1. `firebase deploy --only firestore:rules` (Rule 19 — manual).
2. `node functions/scripts/delete-stranded-allocation.cjs agencytrack-2a610` (dry-run) → confirm 2 fields would delete → `--apply` → re-run `probe-yearplan-prod-state.cjs agencytrack-2a610`, expect **B=0** (and the `§2.6 VERDICT` line finally reads CLEAN CUT).
3. `/post-merge <pr#>`.

---

## Known risks (flag, don't absorb)

- Rules deploy is **immediate and global** on `firebase deploy --only firestore:rules` — there's no preview. The emulator rules-unit-tests (Phase 3) are the pre-deploy gate; if any new constraint could reject a *legitimate* existing write shape, STOP and surface before merge.
- The `rate` range assumes a 0..1 decimal convention — confirm against the data-layer sanitizer in Phase 0; if rate is stored as a percentage (0..100) anywhere, the bound is wrong.
- GLM coverage: if GLM is still 429 at Phase 6, U2 ships on Gemini-only review like U1 — acceptable but noted.
