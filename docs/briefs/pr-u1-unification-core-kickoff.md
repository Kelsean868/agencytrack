# Kickoff Brief — PR-U1 · Game Plan Unification Core (Direction 1.5) · REV 2

**Authored:** 2026-06-24 · dispatcher · **supersedes REV 1** (REV 1 mis-specified the `yearPlan` shape — see §0).
**Baseline:** origin/main `aa4a12d` (#741) — Phase 0 re-verifies the exact HEAD.
**run_model:** `claude-opus-4-8`.
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — agent-facing, money math, schema/taxonomy, commit loop. **+ operator-run migration script** (§5) if Phase-0 counts are non-zero.
**Parent PRD:** `docs/design/gameplan-unification-prd.md` (§2 shape patched alongside this brief — see §0).

---

## 0. Why REV 2 (the correction)

REV 1 + PRD §2 described `yearPlan` as `lines:[{line, api}]` (array, `api`). **Wrong.** CC's Phase 0 (verified against `aa4a12d`) confirmed the live store is a **keyed object** over `['life','ah','property','motor']`, field **`targetAPI`** (plus `pct`/`derivedApps`/`derivedCommission`/`enabled`). The allocator is **3-line, commission-canonical** `{life, ah, general}` (`general` subsumes property+motor and drills into free-form products). Writing a `general` key into the 4-key store would be **silently dropped** by every reader -> General API vanishes from the committed total, the monthly anchor, and Personal Commitment. That is a money undercount. Direction 1.5 fixes the taxonomy.

---

## 1. Locked decisions (Direction 1.5 — build to these)

1. **Canonical store stays `yearPlan/{year}`, `targetAPI`-canonical.** Commit/monthly logic unchanged (they read the total + `avgPolicyAPI`).
2. **Line taxonomy moves to the allocator's product-blessed 3-line model** `{life, ah, general}`. This is a **bounded reader change - NOT additive**. REV 1's "additive / zero-reader-change / no rules change" framing is void.
3. **Shared `LINE_KEYS = ['life','ah','general']`** - one exported constant; every reader adopts it (no per-file key list).
4. **Adapter** `allocationToYearPlan(allocation)` maps allocator commission -> `yearPlan.lines[k].targetAPI = commission / rate` per line, **general included**; sets `enabled` per the allocator's visible lines and `status:'draft'` on create. Products carried under `life`/`general` entries (`{name, api, rate}`, <=4).
5. `.allocation` write is **cut**. Per-product apps divisor stays blended. A&H stays its own line. (Unchanged from REV 1.)

---

## 2. Phase 0 - falsification + source-verify (Rule 17/23; STOP on any mismatch)

Re-confirm against live HEAD; STOP if any is false:

1. **Rules (verified REV 1):** `yearPlan` `update` owner-uid only, **no `hasOnly`**; `create` requires `status=='draft'`. Changing key *semantics* (4->3) needs no rules change (owner-only, no field allowlist). Re-confirm.
2. **Writer:** `saveYearPlan`/`createYearPlan` (`yearPlanService.js`) set `status:'draft'` on create. Confirm the keyed-object derivation pipeline (`seedFromTargets`/`enrichLines`/`applyGating`) so the adapter feeds it the right shape.
3. **Readers to migrate to `LINE_KEYS`:** `yearPlanService.js`, hub `yearPlanTotalAPI` (`GamePlanV2/index.jsx`), `ReviewCommitModal` `LINE_META`, and any `MonthlyPlanModal` line-drill. Enumerate every site that iterates `['life','ah','property','motor']` - `git grep` for `property`/`motor` line keys; the list must be exhaustive before editing.
4. **Commit/anchor (verified REV 1):** `commitPlan` only flips `status:'committed'`; `ReviewCommitModal`/monthly read the total + `avgPolicyAPI`. Adapter must keep `Sum targetAPI` (3 keys) === the allocator total so the gate-5 invariant `Sum targets === anchorAPI/1000` holds.
5. **NEW downstream gate - collapse safety:** `git grep` for any consumer that reads `property` or `motor` **separately, outside the Game Plan loop** (reports, exports, dashboards, leaderboard). If one exists -> **STOP and surface** before collapsing keys.
6. **NEW migration gate - get the counts (resolves the prod-state the dispatcher cannot verify):** produce, against the target environment,
   - `A` = count of `yearPlan/{year}` docs carrying a `property` or `motor` key (old 4-key data),
   - `B` = count of `moneyNeeds/{year}` docs carrying `.allocation` (merged-surface writes), and
   - the current prod value of `VITE_MONEY_NEEDS_MERGED_ENABLED`.
   CC cannot read prod agent data - **the operator pastes A, B, and the flag value** at this gate. **If A==0 and B==0 -> clean cut, migration arm is dead code (do not build/run).** If either >0 -> the migration arm (§5) is required. STOP for the counts before building the migration.

## 3. Build (expected sites; Phase 0 confirms exact paths)

1. **`LINE_KEYS`** shared constant + the reader migration (§2.3) to it. `property`+`motor` UI/labels retire into `general`.
2. **Adapter** `allocationToYearPlan()` in `src/lib/moneyNeedsAllocation.js` - pure, unit-tested. Round-trip: allocator total === `Sum targetAPI` over the 3 keys, **general non-zero case included**.
3. **Writer repoint** - `MoneyNeedsAllocator.jsx` (`saveAllocation` call) -> the `yearPlan` writer via the adapter. `.allocation` write removed.
4. **Retire** `YearPlanModal.jsx` + its test; remove hub mount + `onOpenYearPlan` wiring.
5. **Rail collapse 4->3** - `index.jsx`/`StepRail.jsx`/`PlanCascade.jsx`: Money Needs + Year Plan -> one **"Money Needs"** step -> Monthly -> Commit; `yearPlanFilled` derives from the merged write.
6. **Own smoke** `smoke-yearplan-unified.mjs`: write allocation (incl. a **general** allocation) via the merged surface -> assert `yearPlan` persisted with `targetAPI` over the 3 keys + general's API present in the total -> reload -> assert -> Send -> Playground key + `game-plan` tab -> rail shows 3 steps.
7. **Tests** updated for 3-key (`CommitHubWiring`, `ReviewCommitModal`, hub total).

## 4. Award-safety note (do not skip)

Old `property`/`motor` were award-neutral; `general` is award-neutral. Folding property+motor->general is **award-correct** (only Life drives tiers) and **total-preserving** (`targetAPI` sums). The migration loses only the property/motor *distinction*, deliberately collapsed in Direction 1.5. Assert this in the migration comments + a test.

## 5. Migration arm (build ONLY if §2.6 counts are non-zero) - operator-run

`functions/scripts/migrate-yearplan-3line.cjs`, **idempotent** (re-running skips already-3-key docs):
- **Arm A (A>0):** each 4-key `yearPlan` doc -> `general.targetAPI = property.targetAPI + motor.targetAPI`; carry `life`/`ah`; drop `property`/`motor`; preserve `status`. Award-neutral, total-preserving.
- **Arm B (B>0, flag was ON):** each `moneyNeeds.allocation` doc with no corresponding 3-key `yearPlan` -> run the adapter to seed `yearPlan` (flag-ON agents' stranded allocations land in the loop). Skip if a committed `yearPlan` exists (don't clobber).
- Dry-run default; `--apply` to write; per-doc log. **Operator runs it with admin creds** post-merge, pre-cutover (human/deploy-class).

## 6. Phases 4-6 - docs / PR / hold

- **Phase 4:** `CONTEXT.md` locked decisions (yearPlan 3-line canonical; `.allocation` retired; rail 4->3; migration run state). `FOLLOW_UPS.md`: resolve unification FU; note U2 (rules maturation incl. a `general`-key value-constraint + dead-code) as dependent follow-on.
- **Phase 5:** single branch off fresh main; **Rule 15** verbatim paste-back; **Rule 20** name HEAD SHA; PR references the CONTEXT diff.
- **Phase 6:** **Rule 21** poll 15 min; **Rule 22** >=1 named gap (seed: flag-ON live drive-through is the operator's real acceptance test). Then **STOP and wait for dispatcher**.

---

## Known risks (flag, don't absorb)

- If §2.5 finds an out-of-loop `property`/`motor` reader -> STOP; the collapse is not safe without addressing it.
- If §2.6 shows flag ON + B>0, Arm B reconciles **real agent allocations that never reached the loop during flag-ON** - surface the B count before applying; it may indicate a live undercount predating this PR.
