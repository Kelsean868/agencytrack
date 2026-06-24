# PRD — Game Plan Loop · Step-2 / yearPlan Unification (Direction 1)

**Authored:** 2026-06-24 · dispatcher
**Track:** Track J (V2 Redesign) → Game Plan loop · supervised loop-restructure
**Baseline:** origin/main post-#739 (`b1f2d41`) + AllocationSummaryCard follow-on (`7d4d7ee`) — Phase 0 of each brief re-verifies.
**Merge class:** **Human-merge (Rule 19)** on every PR — schema, commit loop, security rules, money math, agent-facing. **No green-channel.**
**Falsifier (Rule 23):** the Direction-1 lock is overturned only if real `moneyNeeds/{year}.allocation` prod data exists (flag was OFF in prod, so none is expected) or you decide the per-product keyed shape should be the system-wide source of truth beyond the loop.

---

## 1. Decision lock

`yearPlan/{year}` **stays the canonical loop store.** The merged Money Needs + Allocator surface (#739) is repointed to *write into* `yearPlan` via a shape adapter; `YearPlanModal` is retired as the editor; the decoupled `moneyNeeds/{year}.allocation` field is retired. This is the `LOOP_SPEC §2` end-state ("Money Needs + Allocator … writes `yearPlan.lines[].targetAPI`"). The `.allocation` decoupling was always the temporary anti-collision measure for the flag-gated period.

**Direction 1.5 (the merge mechanic).** `yearPlan` keeps `targetAPI` as its canonical per-line field, but its line key set moves from the 4-line `['life','ah','property','motor']` to the allocator's shared 3-line `['life','ah','general']`. This is a **bounded reader change** — every `yearPlan` reader (hub `yearPlanTotalAPI`, `ReviewCommitModal`, the monthly anchor) repoints to the shared `LINE_KEYS` — **not** a purely additive schema add. The original "additive `rate`/`products[]`, readers untouched" framing was wrong: the allocator is 3-line commission-canonical, so its `general` line has no home in a 4-line reader and would be silently dropped from the committed total (see PR-U1 Phase 0).

Rejected: Direction 2 (make `.allocation` canonical, repoint all loop readers, bolt a `draft→committed` status onto a shape with none, migrate yearPlan data). Heavier blast radius and less spec-aligned.

---

## 2. Current state (source-verified)

**Two writers, different shapes:**

| Store | Writer | Shape | Status lifecycle |
|---|---|---|---|
| `moneyNeeds/{year}.allocation` | `saveAllocation()` | keyed object: `{ licenseClass, lines: { life:{api,rate,drilled,products:[{name,api,rate}]}, ah:{api,rate}, general:{…} } }` | none |
| `yearPlan/{year}` | `commitPlan` / `YearPlanModal` / `StepRail` | keyed object over `LINE_KEYS=['life','ah','property','motor']` (→ `['life','ah','general']` post-U1); per-line `targetAPI` + `pct`/`derivedApps`/`derivedCommission`/`enabled`; + `licenseProfile` + `status` | `draft → committed` |

**Loop readers that depend on `yearPlan` today (repointed to the shared 3-line `LINE_KEYS` in U1 — Direction 1.5):**
`StepRail` (`yearPlanFilled`), `PlanCascade` (`yearPlanTotalAPI`, `yearPlanFilled`), `ReviewCommitModal` / `PlanReview` / `CommitConfirm` (`yearPlan`, `yearPlanTotalAPI`, `avgPolicyAPI`), the `monthlyPlan` anchor (`anchorAPI` = snapshot of yearPlan total; invariant `Σtargets === anchorAPI/1000`), and `commitPlan()`.

**Prod flag state:** `VITE_MONEY_NEEDS_MERGED_ENABLED` **OFF in prod** (confirmed). Flag-ON live drive-through (gap #1) **never run** — commission-entry was RTL-only because the smoke agent had no PAYE figure.

---

## 3. Target architecture

1. **Adapter** `allocationToYearPlan(allocation)` — maps the 3-line commission-canonical allocation object → `yearPlan` keyed object over the shared `LINE_KEYS=['life','ah','general']`, per-line `targetAPI` (= derived `lineAPI`), carrying `rate` and `products[]`. One direction; lives next to `moneyNeedsAllocation.js`.
2. **Writer repoint** — the merged surface's persistence calls the `yearPlan` writer (`createYearPlan`/update) instead of `saveAllocation`. `.allocation` write is cut.
3. **Reader repoint (Direction 1.5 — bounded, NOT additive)** — `yearPlan` adopts the shared 3-line `LINE_KEYS=['life','ah','general']`; every reader moves off the 4-line `['life','ah','property','motor']` list onto the shared one. `targetAPI` stays the canonical per-line field; lines gain `rate` and `products: [{name, api, rate}]` (≤4, Life + General). Readers that consume `targetAPI`/total are repointed — they are **not** untouched.
4. **Editor retirement** — `YearPlanModal` is removed from the hub; the merged Money Needs + Allocator surface *is* the allocator.
5. **Rail collapse 4→3** — `StepRail` / `PlanCascade` collapse Money Needs (1) + Year Plan (2) into one **Money Needs + Allocator** step → Monthly → Review & Commit (this 4→3 is rail *steps*, not line keys). `yearPlanFilled` now derives from the merged allocator having written `yearPlan`.

**Migration: now an open Phase-0 gate (Direction 1.5).** The original "additive, no migration" claim no longer holds — moving `yearPlan` to the 3-line `['life','ah','general']` key set means any existing 4-line `yearPlan` doc (`property`/`motor` lines) would have those lines dropped by the repointed readers, changing its committed total. PR-U1 Phase 0 must confirm zero real 4-line `yearPlan` prod data (same flag-gated reasoning as `.allocation`), or a `property`+`motor` → `general` fold is required. `.allocation` is throwaway (flag OFF in prod); confirm zero real `.allocation` prod data before treating as throwaway.

---

## 4. Step zero — human prerequisite (not automatable)

The unification only makes sense once the merged surface is the live default. This is the documented blocker on the banked FU ("Blocked on the merged surface shipping default-ON"). The flag flip + eyeball is yours; the harness below de-risks it.

1. Merge **PR-U0** (harness).
2. Set `VITE_MONEY_NEEDS_MERGED_ENABLED=true` on a **Vercel preview** env → redeploy (build-time flag).
3. Run the U0 flag-ON smoke against the seeded smoke tenant → drive Send → Game Plan → assert persistence.
4. Eyeball light + dark. Flip **prod** default-ON → redeploy → verify.
5. Only then merge **PR-U1**.

---

## 5. PR plan + model per run

> "Automated run" = CC builds to PR-open and **holds**. All merges human (Rule 19 hard floor). Run 1 is the long unattended build; Run 2 is the rules-sensitive tail dispatched after U1 is on main.

### Run 1 — overnight, two file-disjoint branches off main, build-to-PR-open

**PR-U0 · Verification harness** — `run_model: claude-sonnet-4-6`
- Seed the smoke tenant with a money-needs / PAYE figure so the allocator's Send path is exercisable.
- Author flag-ON write-read-verify smoke (`smoke-mn-allocator-flagon.mjs`): write allocation → reload → assert persisted → drive Send → Game Plan.
- Why Sonnet: mechanical seed + test, no judgment-dense math.
- Merge class: human-merge (touches smoke seed), low-risk.

**PR-U1 · Core unification** — `run_model: claude-opus-4-8`
- `allocationToYearPlan()` adapter + writer repoint (merged surface → `yearPlan`, cut `.allocation` write).
- `yearPlan` schema add: per-line `rate`, `products[]` (additive).
- Retire `YearPlanModal`; collapse `StepRail` / `PlanCascade` 4→3; re-derive `yearPlanFilled`.
- Carries its **own** new smoke (`smoke-yearplan-unified.mjs`) asserting `yearPlan` persistence — file-disjoint from U0 so the run stays parallel.
- Why Opus: money-adjacent shape mapping + schema change + agent-facing loop restructure, run unattended — judgment-dense, a wrong call mid-window is costly (same rationale as the merged-allocator run).
- Merge class: human-merge. *No CF/rules deploy in this PR if Phase-0 confirms yearPlan rules accept additive fields.*

*U0 and U1 are file-disjoint (smoke/seed vs component/service/lib). CC builds both in one run with `/clear` at the boundary; both hold for merge.*

### Run 2 — supervised fast-follow, dispatched AFTER U1 merges

**PR-U2 · Rules maturation + dead-code cleanup** — `run_model: claude-opus-4-8`
- Fold in the banked yearPlan rules constraints (field=path cross-checks; `licenseProfile`/`status` value sets) — we're touching `yearPlan` rules anyway, and U1's new `products[]`/`rate` fields want constraining.
- Remove dead `saveAllocation` / `.allocation` reader paths + the superseded U0 smoke.
- Why Opus: security rules are high-blast-radius; Opus for the rules reasoning.
- Merge class: human-merge **+ manual `firebase deploy --only firestore:rules`** after merge.
- Why a separate supervised run (not stacked in Run 1): rules want U1 on main first, and the rules deploy is a manual human step regardless — stacking it unattended buys nothing and adds merge-order risk.

---

## 6. Human-gate sequence (morning of Run 1 → Run 2)

1. `/post-merge` U0 → merge U0.
2. Default-ON **preview** → run U0 smoke → eyeball L/D → default-ON **prod** + verify (Step zero).
3. Merge U1 → eyeball 3-step rail flag-on, L/D → `/post-merge` U1.
4. Dispatch Run 2 (U2) → merge → `firebase deploy --only firestore:rules` → `/post-merge` U2.

---

## 7. Phase-0 verify gates (each brief grep-confirms — Rule 17, never assert from memory)

1. Exact `yearPlan` Firestore rule shape — does create/update use a `hasOnly` field allowlist that would **reject** additive `rate`/`products[]`? Gates whether U1 needs a rules touch or U2 fully covers it.
2. Exact `StepRail` / `PlanCascade` props + where `yearPlanFilled` / `yearPlanTotalAPI` are computed in the hub container — to repoint cleanly.
3. Whether `commitPlan` / `ReviewCommitModal` read only `api`/total (safe) or any field the adapter must preserve verbatim.
4. `monthlyPlan.anchorAPI` snapshot path — confirm it reads yearPlan total in a way the adapter preserves (invariant `Σtargets === anchorAPI/1000` must still hold).
5. Confirm **zero real `.allocation` prod data** — the "no migration" claim's falsifier.

---

## 8. Open decisions — baked defaults (bulk-approve; flagged ones need your eyes)

1. **`products[]` on `yearPlan` is additive, ≤4, Life + General only.** Default: yes.
2. **`.allocation` write is cut in U1 (not dual-written).** Default: yes — no prod data, flag was OFF. *(If gate 7.5 finds real data, switch to a one-pass migration in U1.)*
3. **⚑ Rail collapse copy** — the merged step's label in the rail/cascade: "Money Needs" (keep) vs "Plan & Allocate" vs "Money Needs + Allocator". **Needs your call** — it's the one agent-facing string the restructure renames. Default if you don't pick: keep **"Money Needs"** (least surprise; the allocator reads as its second half).
4. **Per-product apps divisor stays blended** (`AVG_POLICY_API = 12000`) — per-product avg-policy remains the banked LOW FU, not resolved here. Default: yes.
5. **A&H stays its own line (`ahSide` unresolved)** — not forced in this track. Default: yes.

---

## 9. Known gaps (Rule 22)

1. The flag-ON **live drive-through has never run**; U0's harness de-risks it, but the first real-data pass (Step zero) is the true acceptance test — a green smoke is necessary, not sufficient.
2. **Schema/rules coupling window:** U1 ships `products[]`/`rate` before U2 constrains them in rules → a brief window of unconstrained product fields on an owner-only path (low risk; closed by U2). If that window is unacceptable, fold the minimal `products[]` value-constraint into U1 and leave the broader maturation in U2.
3. **Per-product avg-policy divisor** still blended — unchanged here (banked LOW).
