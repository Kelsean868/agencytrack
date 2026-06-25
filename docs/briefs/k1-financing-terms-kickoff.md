# K1 — `financingTerms` collection + status state machine + manager setup — kickoff brief · REV 2

**Authored:** resume re-verification · dispatcher · **supersedes REV 1.**
**Why REV 2:** main moved since REV 1 — the Game Plan loop unification (U1 #741 + U2) shipped. U1 introduced the 3-key `{life, ah, general}` yearPlan taxonomy + additive `rate`/`products[]` with no rules change; U2 added *coarse* field-constraint rules (`rate` range, `products` size; **keys stay permissive — no key-allowlist**) and deleted `.allocation` residue. K1 adds a **new, namespace-isolated** `financingTerms` rules block — no structural collision expected — but the "existing X" anchors are re-verified live in Phase 1 per Rule 17, and K1 now explicitly adopts the **single-boundary rules convention U2 locked**.
**Baseline:** origin/main past the U2 merge — **Phase 0 re-verifies the exact HEAD.**
**run_model:** `claude-opus-4-8` (new collection + security rules + money-adjacent financing — high blast radius, judgment-dense).
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — new collection + security rules + money-adjacent. **+ operator post-merge:** `firebase deploy --only firestore:rules`.

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — Track K foundation (new Firestore collection + rules + service + 1 manager screen + shared badge primitive) |
| **Shape** | `/tenants/{tid}/financingTerms/{agentId}` + firestore.rules block + emulator rules tests + `financingService.js` + `FinancingTermsSetup` (port of mockup #3) + `FinancingStatusBadge` primitive + docs |
| **Size** | M |
| **Branch** | `feat/k1-financing-terms` |
| **Sources** | `docs/track-k-financing-new-agent-design.md` §0/§2/§5/§6 · `docs/design/track-k-locked-decisions.md` (A/B locks) · `design_handoff_track_k/Track K Financing Terms Setup - Build.html` + `README.md` |
| **Risky classification** | **YES** — new collection + rules → Phase 1 ends in a hard-stop for dispatcher lock before any build |
| **Smoke walk** | **Required.** Emulator `assertFails`/`assertSucceeds` pre-merge; preview write-read-verify pre-merge; production write-read-verify + both themes post-merge (Phase 6, after rules deploy). No waiver. |
| **Strike count** | 0/2 |

---

## Context

Track K makes the new-agent financing-and-bonus structure (TATIL *New Salesperson's Bonus and Financing Agreement*, rev. 2017 — figures confirmed current for 2026) visible and forward-looking; product outcomes are in design-spec §0. K1 is the foundation: the per-agent financing terms doc, the manager-set financing **status state machine** that gates every later financing module (K2–K8), the manager setup surface, and the status badge primitive the rest of the track reuses. No ledger, no bonus math, no proration here. The only open decision (A.4, Staff policies) gates K3, not K1.

---

## Architectural decisions (locked at brief authoring)

1. **Schema** — `/tenants/{tid}/financingTerms/{agentId}` (doc ID = agent UID; one current-terms doc per agent):
   - `agreedMonthlyFinancing` (number) — full/ceiling draw
   - `currentMonthlyFinancing` (number) — standing amount in effect
   - `validatingAPI` (number) — proration denominator (consumed by K5; stored here)
   - `effectiveDate` — agreement clock anchor (24-mo term, 12-mo service, waiver). **Type mirrors the repo's `contractDate` pattern** — Phase 1 reports it; if date-only Timestamp writes are involved, `parseDateOnlyTT()` from `src/utils/dateInputs.js` applies (split-brain rule).
   - `financingStatus` (enum) — `not_on_financing | on_financing | reconciling | post_financing_repayment | cleared`; default `not_on_financing`
   - `statusHistory` (array, bounded ≤ ~10) — `{ from, to, at, by, byName, note? }` appended every transition
   - audit: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`
   - All numerics `parseFloat()`-enforced at the service write path. Currency TTD.
2. **State machine — forward-only** (Addendum B.9). Legal transitions, enforced **in the service**: `not_on_financing→on_financing`; `on_financing→reconciling`; `reconciling→post_financing_repayment`; `reconciling→cleared`; `post_financing_repayment→cleared`. Admin corrective/backward transition is **out of scope** — banked as a FU in Phase 4.
3. **Service layer** — new `src/services/financingService.js`; explicit `tenantId` parameter on every method (SEC-9b); no component writes Firestore directly. Methods: `getFinancingTerms(tenantId, agentId)`, `setFinancingTerms(tenantId, agentId, terms, actor)`, `transitionFinancingStatus(tenantId, agentId, toStatus, actor, note?)`. **Match the current per-agent service signature convention** quoted in Phase 1 §7.
4. **Rules — single-boundary, per the U2 precedent.** financingTerms rules do **coarse checks only**: field presence + type (`agreedMonthlyFinancing`/`currentMonthlyFinancing`/`validatingAPI` are numbers ≥ 0), `financingStatus` ∈ the 5-value enum, and the **role/tenant scope**. **Business logic does NOT go in rules** — the cross-field rule (`currentMonthlyFinancing ≤ agreedMonthlyFinancing`) and transition legality live in `financingService` + UI (Addendum B.12 / B.9). This mirrors U2's decision to keep the yearPlan taxonomy in the data layer rather than the rules. Role tier — write: `branch_manager`, `sales_manager`, `tenant_admin` (same tenant); read: agent reads own doc only + the manager read scope, **mirroring the settlements/persistency precedent quoted live in Phase 1 §5**. Cross-tenant denied.
5. **UI** — `FinancingTermsSetup` recreated from mockup #3 in repo conventions: Nexus tokens only (no new hexes), both themes via tokens, 44px targets, no gradients. Terms form + 5-state machine control + status badge. **Mount point proposed by CC at the Phase 1 stop** (report the manager → agent-detail routing pattern and recommend), not chosen unilaterally.
6. **`FinancingStatusBadge`** — shared primitive rendering all 5 states per the mockup; exported for K2+ reuse. (`basisBadge` is **K2**, not here.)
7. **No seed/config docs in this PR.** Ruleset values ($ figures) enter at K3; K1 stores only per-agent terms.

## Out of scope

- `financing/{agentId}_{YYYY_MM}` ledger (K2) · bonus engine / credit filter (K3) · take-home calc (K4) · proration + basis resolution (K5) · reconciliation (K6) · termination-risk monitor (K7) · agent dashboard + drill-down (K8)
- Admin corrective/backward status transition (FU)
- Any awards-engine change; any Cloud Function; any notification
- Any yearPlan / Game Plan rules or schema (U1/U2 territory — do not touch)
- Agent-facing surface of any kind (agent read access exists in rules only)

## Phase 0 — gate

Standard. Fresh branch `feat/k1-financing-terms` off synced `origin/main`. Confirm the exact HEAD; clean tree. STOP on divergence.

## Phase 1 — sanity checks (Rule 17 source-verify; U1/U2-aware; ends in a hard-stop)

1. `git ls-files design_handoff_track_k/` → expect README + 6 HTML sheets. Empty → **STOP and wait for dispatcher** (handoff docs PR not landed).
2. `git ls-files docs/track-k-financing-new-agent-design.md docs/design/track-k-locked-decisions.md` → both tracked. If not → **STOP and wait for dispatcher**.
3. **Greenfield + collision grep.** `git grep -rn "financingTerms" -- src functions firestore.rules` → expect **0 hits**. Then confirm no helper-name K1 introduces already exists: `git grep -n "function valid" firestore.rules` and `git grep -rn "financingStatus\|FinancingStatusBadge\|financingService" -- src` → expect 0. Any hit → **STOP and wait for dispatcher**.
4. **`effectiveDate` type.** `git grep -n "contractDate" -- src` → report storage type (string vs Timestamp) and the write-site util in use. Fixes `effectiveDate`'s type per Decision 1.
5. **Rules mirror — U1/U2-aware.** The U1/U2 unification rewrote the **yearPlan** rules arms (U1: 3-key taxonomy, no rules change; U2: coarse `rate`/`products[]` constraints + possibly a shared `validYearPlanLines()` helper; keys permissive). Quote the **current** firestore.rules block for an existing per-agent manager-written collection (settlements or persistency) **and** the shared role/tenant helper functions it calls (report their current names). Confirm the settlements/persistency precedent + those helpers are **unchanged by U1/U2**. If the mirror target itself shifted (helpers renamed/refactored, match structure changed) → **STOP and wait for dispatcher** — Decision 4's anchor moved.
6. **Rules convention — adopt U2 single-boundary.** Quote the current `yearPlan` create/update arm as the reference shape, and confirm the U2 pattern (coarse type/range/role in rules; taxonomy/deep validation in the data layer). Confirm financingTerms will follow it: type + presence + role + status-enum-membership only; `current ≤ agreed` and transition legality in the service. If the live yearPlan arm contradicts this characterization → report it before building.
7. **Service pattern.** Quote an existing per-agent service (settlements or persistency service) for the current method-signature convention — explicit `tenantId` param, return shape, write path — that `financingService` must match.
8. **Mount point.** Locate the manager → agent-detail surface and routing pattern; recommend the `FinancingTermsSetup` mount point (file:line evidence).
9. **Rules-test harness.** Confirm `@firebase/rules-unit-testing` in devDependencies + an existing rules test to mirror; name the file.
10. **Mockup parity.** Open `design_handoff_track_k/Track K Financing Terms Setup - Build.html`; confirm the surface inventory matches Decisions 1/2/5/6 (fields, 5 badges, machine control); list any element drawn but not covered here.

**Report findings 1–10 with file:line + quotes, plus the recommended mount point, then STOP and wait for dispatcher.** No build until the dispatcher locks the mount point, confirms the rules-mirror pattern (against whatever §5 reports as current post-U1/U2), and confirms the `effectiveDate` type.

## Phase 2 — build (after dispatcher lock)

1. Rules block + emulator tests. Minimum set: agent write own → fail; agent read own → succeed; agent read another agent → fail; BM same-tenant write → succeed; cross-tenant manager write → fail; UM write → fail (read per mirrored scope); bad `financingStatus` value → fail; non-number financing field → fail.
2. `financingService.js` per Decisions 1–4, including illegal-transition rejection, `current ≤ agreed` enforcement, and `statusHistory` append.
3. `FinancingStatusBadge` primitive (5 states).
4. `FinancingTermsSetup` screen per mockup at the locked mount point.

## Phase 3 — verification

- Lint 0 · build green · full suite green (env-unset note) including the new emulator rules tests.
- Hex-grep on all new/changed files → empty (tokens only).
- axe: **no new serious/critical vs main baseline** on the new screen, both themes.
- **Preview smoke (pre-merge, `setupBypassSession`)** — write-read-verify: as tenant admin, create terms for the test agent (agreed 8000, current 8000, validatingAPI 30000, effectiveDate today), reload, assert persisted + badge `not_on_financing`; transition → `on_financing`, reload, assert status + `statusHistory` entry; attempt `current > agreed` → blocked; attempt illegal transition (`on_financing→cleared`) → rejected. Both-themes screenshot pass.

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD` PR/SHA), top table → Track K active / K1 shipped, Where-we-left-off prose. (Mind the size cap.)
- `docs/FOLLOW_UPS.md` — bank: (a) admin corrective/backward status transition (deferred, B.9); (b) **A.4 Staff-policy confirm gates K3** (carry until resolved); (c) `basisBadge` primitive lands K2.

## Phase 5 — commit / push / PR

Conventional commits on `feat/k1-financing-terms`. Lint + build + suite green. Push; PR via `gh`: title `feat(k1): financingTerms collection + status state machine + manager setup (Track K)`; description = outcome + smoke evidence + rules-test summary + the Phase 1 mirror-verification result. **Rule 15** verbatim paste-back. **Rule 20** — name the feature-branch HEAD SHA. Do NOT merge. Surface the PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (post-merge)

Dispatcher merges (squash, UI). Operator deploys rules: `firebase deploy --only firestore:rules` (CLI health check first). Then CC: **production smoke** = the Phase 3 write-read-verify cycle against production, both themes, plus cleanup of smoke artifacts from the test tenant. **Rule 21** poll 15 min for Gemini/GLM review; **Rule 22** name ≥1 gap. Then `/post-merge <pr#>` fill.

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Any Phase 1 check failing its expected result → **STOP and wait for dispatcher**
- The §5 rules-mirror target found changed by U1/U2 → **STOP and wait for dispatcher**
- Any architectural decision not pre-listed in Decisions Locked (Rule 1) → **STOP and wait for dispatcher**
- Phase 2 scope expansion beyond the enumerated builds, any file outside the K1 surface, or any touch to yearPlan/Game Plan rules → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite/axe/hex-grep failure after one fix attempt → **STOP and wait for dispatcher**
- Smoke write-read-verify failure → **STOP IMMEDIATELY**
