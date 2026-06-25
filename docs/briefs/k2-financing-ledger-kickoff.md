# K2 — `financing` monthly ledger + statement entry + basisBadge + 6× ceiling — kickoff brief

**Authored:** post-#748 · dispatcher.
**Baseline:** origin/main `750b30a` (K1 fill commit; K1 squash `6fadf70`) — **Phase 0 re-verifies the exact HEAD.**
**run_model:** `claude-opus-4-8` (new collection + security rules + money-adjacent running balance — high blast radius, judgment-dense).
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — new collection + security rules + money-adjacent. **+ operator pre-merge:** `firebase deploy --only firestore:rules` (additive carve-out, same as K1 — doubles as the Phase 6 deploy).

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — Track K · monthly financing ledger (new collection + rules + service + statement-entry screen + ledger view + shared basis primitive) |
| **Shape** | `/tenants/{tid}/financing/{agentId}_{YYYY_MM}` + firestore.rules block + emulator rules tests + `financingService.js` ledger methods + `MonthlyStatementEntry` + ledger list view + `basisBadge` primitive + running-balance-vs-6×-ceiling indicator + skipped-month flag + docs |
| **Size** | M–L |
| **Branch** | `feat/k2-financing-ledger` |
| **Sources** | `docs/track-k-financing-new-agent-design.md` §6/§8 · `docs/design/track-k-locked-decisions.md` (B.10/B.11) · `design_handoff_track_k/Track K Monthly Statement Entry - Build.html` + `README.md` · **the deployed K1 `financingTerms` block + `financingService.js` + `financing` manager tab** (Phase 1 reads these live) |
| **Risky classification** | **YES** — new collection + rules → Phase 1 ends in a hard-stop for dispatcher lock before any build |
| **Smoke walk** | **Required.** Emulator `assertFails`/`assertSucceeds` pre-merge; preview write-read-verify pre-merge (after the additive deploy); both themes. No waiver. |
| **Strike count** | 0/2 |

---

## Context

K1 shipped and is production-verified: `financingTerms`, the forward-only status machine, the `financing` manager tab, `FinancingStatusBadge`, and the deployed rules block. K2 adds the **monthly ledger** — the agent's monthly statement is captured manually, the running balance becomes visible and authoritative, and the running balance is shown against the 6× ceiling. This is the "agents stop guessing what they owe" value (design-spec §0, K2 row). It carries **two K1-deferred items**: the `basisBadge` primitive (deferred to K2) and the **6× ceiling-basis correction** (`currentMonthlyFinancing`, not agreed — banked FU at K1). No proration, no bonus math, no reconciliation here.

---

## Architectural decisions (locked at brief authoring)

1. **Schema** — `/tenants/{tid}/financing/{agentId}_{YYYY_MM}` (composite doc ID; one doc per agent-month). Store **`agentId` as a field** (== the agentId segment of the doc ID) for query symmetry + agent-own read keying, **mirroring `settlements` and the K1 `financingTerms` decision**. Statement-entry fields:
   - `runningBalance` (number) — **stored from the agent's monthly statement as entered; authoritative; never recomputed from flows.** May be **negative** (= surplus owed to agent; positive = debit owed by agent). Sign convention: positive = debit.
   - `financingPaid`, `netCommission`, `bonusOffset` (number, parseFloat) — captured from the statement. `bonusOffset` is the **manually-entered** value the statement shows in a bonus month; the *projection/derivation* of the 50%-of-net offset is **K4**, not here.
   - `month` (string `YYYY_MM`), `notes` (string), audit: `enteredBy`, `enteredByName`, `enteredAt`, `updatedAt`, `source`.
   - **Proration fields (`validatingAPI`, `actualAPI`, `suggestedFinancing`, `managerFinancing`, `adjustmentPct`) and `basisSource` are NOT written by K2** — they are K5 / render-derived (see Decision 5). All numerics `parseFloat()`-enforced at the service write path. Currency TTD.
2. **Running balance authoritative.** The app stores the statement's stated balance and self-corrects each month; it does **not** reconstruct it from `financingPaid − netCommission − bonusOffset`. A skipped month is a flag, not an interpolation (Decision 7).
3. **Rules — single-boundary (U2 precedent; mirror the deployed K1 block).** Coarse checks only: statement numerics are `number` (≥ 0 except `runningBalance`, which may be negative), required fields present, `month` matches `YYYY_MM`. Role/tenant scope identical to K1 `financingTerms`: write `branch_manager`/`sales_manager`/`tenant_admin` same-tenant + `platform_admin`; read agent-own (`resource.data.agentId == request.auth.uid`) + manager scope (mirror settlements). **No key-allowlist / no `hasOnly`** — so the K4/K5 fields slot in later without a rules change. `serverTimestamp()` top-level only; `Timestamp.now()` for any in-array value (PR #373 / df161fe).
4. **Service** — extend `src/services/financingService.js` (do not create a second module): `getFinancingMonth(tenantId, agentId, month)`, `setFinancingMonth(tenantId, agentId, month, statement, actor)`, `listFinancingMonths(tenantId, agentId, range?)`. Explicit `tenantId` first param (SEC-9b); reuse the K1 `financingTerms` read for `effectiveDate` + `currentMonthlyFinancing`; parseFloat + `serverTimestamp()` audit; writer UID from `auth.currentUser`.
5. **`basisBadge` primitive (deferred from K1).** Build the 3-state component from `basisSource` (`submitted-final` / `submitted-provisional` / `settled-confirmed`), extending the awards-engine Confirmed/Estimated tone pattern (README §3). In K2 the badge is **derived at render** from the month-number relative to `effectiveDate`: months 1–3 → `submitted-final`; month 4+ → `settled-confirmed` (historical/closed statement months are confirmed records). **`submitted-provisional` is reserved for K5's live current-month projection — K2 does not produce it and does not write `basisSource` to the doc.** *(Phase 1 confirms render-derive vs store; render-derive preferred to avoid a stale stored basis if `effectiveDate` is later corrected.)*
6. **6× ceiling — corrected basis.** `ceiling = 6 × currentMonthlyFinancing` (contract **2.4 / 6.3** — NOT `agreedMonthlyFinancing`; this corrects design-spec §6 and the mockup). Show running balance vs ceiling with a left-of-zero surplus band and a debit-side breach indicator (breach when `runningBalance > ceiling`). This is the **K2 portion of the deferred DerivedTermsPanel**; the 24-mo/12-mo/waiver **clocks remain K6**.
7. **Skipped-month flag.** On entry/display, detect a gap in the agent's month sequence (a missing prior month between `effectiveDate`'s first month and the latest entry). Flag it as drawn in the mockup; **do not interpolate** a value. The flag is informational in K2; it becomes a reconciliation *blocker* at K6 (Addendum B.10).
8. **Mount** — extend the **existing K1 `financing` manager tab** (the ledger surface attaches there, mirroring how settlements/persistency coexist in one area). CC recommends the exact placement (sub-view vs section within the financing tab) at the Phase 1 stop.
9. **Surfaces** — `MonthlyStatementEntry` (manual per-agent per-month form) + a per-agent ledger **list/history view** with the running-balance-vs-ceiling indicator and basis badges. Nexus tokens only, both themes, 44px, no gradients, internal agent dropdown via `getTenantUsers` (SettlementPanel/K1 mirror).

## Out of scope

- Validation-schedule **proration** (`validatingAPI`/`actualAPI`/`suggestedFinancing`/`managerFinancing`/`adjustmentPct`) → **K5**
- `bonusOffset` **computation/projection** (tax → net → 50%) → **K4** (K2 stores the manual statement value only)
- **Reconciliation** event + the 24-mo/12-mo/waiver **clocks** → **K6**
- Termination-risk monitor (consecutive-miss, the >10% *flag*) → **K7** · bonus engine → **K3** · agent dashboard + policy-ledger drill-down → **K8**
- Any change to the deployed K1 `financingTerms` rules/schema, or to yearPlan/Game Plan rules

## Phase 0 — gate

Standard. Fresh branch `feat/k2-financing-ledger` off synced `origin/main`. Confirm exact HEAD `750b30a`; clean tree. STOP on divergence.

## Phase 1 — sanity checks (Rule 17 source-verify; K1-aware; ends in a hard-stop)

1. `git ls-files docs/track-k-financing-new-agent-design.md docs/design/track-k-locked-decisions.md "design_handoff_track_k/Track K Monthly Statement Entry - Build.html"` → all tracked. Missing → **STOP and wait for dispatcher**.
2. **Greenfield grep.** `git grep -rn "financing/" -- firestore.rules src` and `git grep -rn "getFinancingMonth\|setFinancingMonth\|basisBadge\|MonthlyStatementEntry" -- src` → expect 0 (note: `financingTerms` exists from K1 and is **not** a collision — confirm the monthly `financing/{...}` path and these symbols are new). Any hit → **STOP**.
3. **K1 rules mirror (live).** Read the **deployed** `financingTerms` match block + the shared role/tenant helpers (`canAccessOwn`, `canManage`, role set). Confirm K2's new `financing` block mirrors them. Confirm K1 didn't key-allowlist (so K2 follows the same permissive-keys posture).
4. **K1 service (live).** Read `financingService.js` — confirm the method-signature convention, and how it reads `financingTerms` (to pull `effectiveDate` + `currentMonthlyFinancing` for the basis derivation and the ceiling). Report the exact accessor.
5. **K1 field types (live).** Confirm `effectiveDate` is the bare `YYYY-MM-DD` string K1 stored, and `currentMonthlyFinancing` is a number on `financingTerms`. These drive Decisions 5 + 6.
6. **Mount (live).** Read the K1 `financing` tab — `navConfig.js` entry + the `ManagerDashboard` render arm — and recommend where the ledger surface attaches (file:line).
7. **Read-pattern mirror.** Quote the `settlements` rules block (composite-ID doc with stored `agentId` field) — K2's read keys on `resource.data.agentId`, same shape.
8. **Rules-test harness.** Mirror `tests/rules/financingTerms.rules.test.mjs` (K1's). New file `tests/rules/financing.rules.test.mjs`.
9. **Mockup parity.** Open `Track K Monthly Statement Entry - Build.html`; confirm the surface inventory matches Decisions 1/2/5/6/7/9 (statement fields, running-balance-vs-ceiling, basis badge, skipped-month flag); list anything drawn but not covered.
10. **basisSource resolution.** Recommend render-derive vs store for `basisSource` in K2 (Decision 5), with the mockup's treatment as evidence.

**Report 1–10 with file:line + quotes, plus the recommended mount + basisSource resolution, then STOP and wait for dispatcher.** No build until the dispatcher locks the mount, the basisSource approach, and confirms the K1 mirror is intact.

## Phase 2 — build (after dispatcher lock)

1. Rules block + emulator tests. Matrix: agent write own → fail; agent read own → succeed; agent read other → fail; BM same-tenant write → succeed; cross-tenant write → fail; UM write → fail; non-number statement field → fail; bad `month` format → fail; **negative `runningBalance` accepted** (surplus is valid).
2. `financingService.js` ledger methods (Decision 4) incl. the skipped-month gap detection helper.
3. `basisBadge` primitive (3 states).
4. `MonthlyStatementEntry` + ledger list view + running-balance-vs-6×-ceiling indicator (Decision 6) + skipped-month flag (Decision 7), at the locked mount.

## Phase 3 — verification

- Lint 0 · build green · full suite green (+ new emulator rules tests).
- Hex-grep on new/changed source → empty (tokens only).
- axe: no new serious/critical vs main baseline, both themes.
- **Preview write-read-verify (pre-merge, after the additive deploy):** enter a statement month for the test agent (financingPaid, netCommission, runningBalance = a positive debit), reload, assert persisted + the ceiling indicator computes off `6 × currentMonthlyFinancing`; enter a **negative** runningBalance month → asserts the surplus band; create a **gap** (skip a month) → the skipped-month flag fires; basis badge shows `submitted-final` for an M1–3 month and `settled-confirmed` for an M4+ month. Both-themes screenshot pass.

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD` PR/SHA), top table → K2 shipped, Where-we-left-off. (Size cap.)
- `docs/FOLLOW_UPS.md` — **resolve** the `basisBadge`-lands-K2 FU and the **K2 portion** of the DerivedTermsPanel/ceiling FU (ceiling now built on `currentMonthlyFinancing`); **carry** the DerivedTermsPanel **clocks** to K6, the SettlementPanel guard-parity FU, and A.4 Staff (gates K3).

## Phase 5 — commit / push / PR

Conventional commits on `feat/k2-financing-ledger`. Lint + build + suite green. Push; PR via `gh`: title `feat(k2): financing monthly ledger + statement entry + basis badge + 6× ceiling (Track K)`; description = outcome + smoke evidence + rules-test summary + the Phase 1 mirror result. **Rule 15** verbatim paste-back. **Rule 20** — name the feature-branch HEAD SHA. Do NOT merge. Surface the PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (post-merge)

Same as K1: operator deploys the additive rules **pre-merge** (`firebase deploy --only firestore:rules`, project `agencytrack-2a610`, CLI health check first) → CC re-runs the full preview write-read-verify (the production write-read-verify, since preview talks to prod through the live rules) → Admin-SDK cleans the smoke agent's `financing` docs from `tatillife_smoke` → re-stop at Phase 5 with the updated PR-ready report. **Rule 21** poll 15 min; **Rule 22** name ≥1 gap. After human-merge: `/post-merge <pr#>` (Sonnet) — **no rules re-deploy** (merged main == deployed rules).

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Any Phase 1 check failing its expected result, or the K1 mirror found changed → **STOP and wait for dispatcher**
- Any architectural decision not pre-listed in Decisions Locked (Rule 1) → **STOP and wait for dispatcher**
- Phase 2 scope expansion beyond the enumerated builds, any proration/bonus/reconciliation field written, or any touch to the deployed K1/yearPlan rules → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite/axe/hex/emulator failure after one fix attempt → **STOP and wait for dispatcher**
- Smoke write-read-verify failure → **STOP IMMEDIATELY**
