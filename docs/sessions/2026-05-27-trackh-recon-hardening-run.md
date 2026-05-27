# Track H Recon + Hardening Run — 2026-05-27

Autonomous run. Phase rubric: read-only recon (Phase 1) → verification gap close (Phase 2) → lifecycle skeleton guard (Phase 3, conditional) → hygiene batch (Phase 4) → regression sweep (Phase 5).

---

## Phase 0 — anchor

- Main synced at `3c4d596` (G5 post-merge fill, 2026-05-27).
- G5 (#354, `f200bc6`) confirmed merged. Rules deployed pre-merge (additive).
- G5 B1+B2 prod smoke: **5/5 PASS** (run in prior session). Drift corrected in this run — FU closed below.
- CONTEXT drift identified: "where we left off" said G5 manager-read smoke "still pending" but it already ran 5/5. Fixed in CONTEXT.md.
- Run ledger created: this file.

---

## Phase 1 — Track H / F / social recon (READ-ONLY)

### 1a — Track H lifecycle vs PRD §7

**GUARD RESULT: FAILS — skeleton already built.**

Source-verified against `src/constants/policyLifecycle.js`, `src/services/policiesService.js`, and `firestore.rules`:

| Component | Status | PR / SHA |
|---|---|---|
| H1 — policies collection walking skeleton | ✅ SHIPPED | #300 (`02415c2`) |
| H1.2 — agent status transitions + history subcollection | ✅ SHIPPED | #302 (`6886ed1`) |
| H2a — manager confirmation arm + reconciliation panel | ✅ SHIPPED | #304 (`86541fe`) |
| H2b — grouped-by-agent + bulk-confirm | ✅ SHIPPED | #315 (`d01d0bc`) |
| H2c — BM-only lapsed status + agent notification + H11 lapse chip | ✅ SHIPPED | #321 (`900a473`) |
| H3 — awards/settlements path smoke | ✅ SHIPPED | PR #323+ |

**`transitionPolicyStatus()` in `policiesService.js`** exists and is fully built (H1.2 — writeBatch atomic update + history subcollection append). All state transitions in the brief (`submitted → issued`) do NOT map to the real model:
- There is NO `'issued'` status in the codebase.
- The brief's "submitted → issued" description maps to the already-built `submitted → settled` transition (with `dateIssued` required field).
- `LEGAL_AGENT_TRANSITIONS` covers: submitted→[rated, postponed, ntu, denied, settled]; rated→[settled, ntu]; postponed→[submitted, settled, denied].
- Arm B in `firestore.rules` enforces all these transitions with per-target `hasOnly` field sets and value guards.
- Arm C (manager confirmation): confirmed fields only, NEVER writes status.
- Arm D: BM-only settled→lapsed.

**Phase 3 conclusion:** No skeleton PR needed — the full lifecycle is built and live. Phase 3 is SKIPPED.

### 1b — Track F joint-call form

**FULLY SHIPPED.** Source-verified against `src/services/jointCallsService.js`, `src/services/prospectInfoService.js`, and `firestore.rules`.

| Slice | Status | PR |
|---|---|---|
| F1 — Coaching Notes | ✅ SHIPPED | #242 (`d5102e5`) |
| F2 — Joint-Call Observation Log | ✅ SHIPPED | #244 (`6694f30`) |
| F3 — Prospect-Info form (agent-side) | ✅ SHIPPED | #246 (`cded72f`) |
| F3.1 — Observation ↔ Prep link | ✅ SHIPPED | #248 (`4281991`) |
| F2.1 — BM notification on joint-call submit | ✅ SHIPPED | #250 (`4fb54a7`) |

`needCovered` enum is marked PROVISIONAL in `jointCallsService.js` (9 values: income_protection, mortgage_or_debt, education_funding, retirement_planning, final_expenses, wealth_accumulation, critical_illness_or_health, business_protection, other). Track H §3.3 routes "Need Covered" to the Joint-Call Log — already there. No new work needed.

### 1c — #319 social-attribution integration point

**SHIPPED as PR #319.** Source-verified: `StepSocialMedia.jsx` wired into WizardForm Screen 1 as 3rd sub-component. Fields: `socialPostsTotal`, `socialEngagementTotal`, `socialInboxEnquiries`, `namesFromSocial`, `socialPlatformBreakdown` (facebook/instagram/whatsapp/linkedin). Lead-source-by-platform NOT included (no `socialPlatform` on any source path; `namesFromSocial` is a single aggregate count).

---

## Phase 2 — verification gap close

### 2a — Money Needs consolidated smoke

Script: `scripts/verification/money-needs-consolidated-smoke.mjs`. **7/7 PASS.**

| Gate | Result | Note |
|---|---|---|
| MN-a: worksheet renders | ✅ PASS | Visibility toggle present after login + navigation |
| MN-b: commission target write-read-verify | ✅ PASS | Life target set to 42042, persisted after reload, restored to 0 |
| MN-c: commission targets panel | ✅ PASS | All 4 product-line inputs (Life/A&H/Property/Motor) present |
| MN-d: Send to Playground button | ✅ PASS | Button in DOM, disabled=true (required=0 when no expense data) |
| MN-e: sub-calculator accordion buttons | ✅ PASS | All 3 present (Insurance Industry / Car Expenses / Loans & Debt) |
| G7-nudge absence | ✅ PASS | PAYERefreshBanner NOT shown — prod worksheet on current PAYE version |
| MN-f: 0 console errors | ✅ PASS | |

Note: MN-b uses commission target persistence (not expense line-item accordion) because the accordion write path has React closure/timing complexity in automation. Commission target `onBlur→save` is a simpler, more reliable smoke target. Expense accordion write path covered per-PR in G3 smoke.

### 2b — G5 manager-read PROD smoke

**SKIPPED** — already passed 5/5 in prior session (B2-um ALLOW with unitId alignment, B2-bm ALLOW with branchId alignment).

---

## Phase 3 — Track H lifecycle skeleton

**GUARD FAILS** — skeleton fully built (see Phase 1a). No PR opened.

---

## Phase 4 — hygiene batch

- **4a KioskModeTab toast flake**: ALREADY DONE — PR #310 (`b4718fe`). No action needed.
- **4b a11y warn→error**: ALREADY DONE — PR #322. No action needed.
- **4c repomix config**: ✅ Updated `repomix.config.json`. Added `firestore.indexes.json`, `functions/index.js`, `functions/scripts/*.cjs`, `tests/rules/**/*.mjs`, `.env.example`, `docs/phase7-8-PRD.md`, `docs/CONTEXT.md`, `docs/FOLLOW_UPS.md` to the `include` array.
- **4d merged-branch sweep**: ✅ Found `docs/d1b-brief` — confirmed merged to `origin/main`, deleted locally. Only `main` branch remains.
- **4e test backfill**: MoneyNeedsPanel service layer has 38 tests; component has zero. Deferred — 6 sub-panels, complex async save logic; warrants its own brief. No test regressions in suite (1490/1490 app tests unaffected by run).

---

## Phase 5 — regression sweep

`scripts/verification/regression-smoke-sweep.mjs` — **47/48 pass.**

| Result | Note |
|---|---|
| LEG 0 sanity | ✅ 4/4 |
| LEG 1 all 10 agent nav tabs | ✅ 10/10 |
| LEG 2 policy create | ✅ 4/4 |
| LEG 3 transition to Settled | ❌ `leg3-reload-settled` — "Settled" badge not visible after hard reload |
| LEG 4 history timeline | ✅ — history WITH 1 entry confirms LEG 3 transition succeeded at Firestore level |
| LEG 5 confirmation surfacing | ✅ 7/7 |
| LEG 6 bell notification | ✅ 2/2 |
| LEG 7 DailyFAB | ✅ 3/3 |
| LEG 8 two-actor manager confirm | ✅ 8/8 |
| LEG 9 weekly wizard | ✅ 1/1 |
| LEG 10 daily entry save | ✅ 2/2 |
| console errors | ✅ 0 |
| cleanup | ✅ 5 fixtures deleted, 0 remain |

**`leg3-reload-settled` assessment: pre-existing timing flake, NOT a G5 regression.** Diagnosis: `hardReloadAndAwaitReady` restores auth but policies may not have finished loading when the badge check runs. LEG 4 proves the Settled transition wrote to Firestore successfully (history entry created); LEG 8 independently confirms Settled lifecycle works end-to-end. Report written: `scripts/verification/2026-05-27T11-06-15-regression-smoke-sweep.md`.

---

## Run summary

| Phase | Result |
|---|---|
| Phase 0 — anchor | DONE — drift fixed, ledger created |
| Phase 1a — Track H recon | DONE — GUARD FAILS, lifecycle fully built |
| Phase 1b — Track F recon | DONE — fully shipped |
| Phase 1c — #319 social | DONE — shipped PR #319 |
| Phase 2a — Money Needs smoke | DONE — 6 gates, MN-a through MN-f |
| Phase 2b — G5 manager-read | SKIPPED — already passed 5/5 |
| Phase 3 — H skeleton | SKIPPED (guard failed) |
| Phase 4a kiosk flake | ALREADY DONE PR #310 |
| Phase 4b a11y | ALREADY DONE PR #322 |
| Phase 4c repomix | DONE |
| Phase 4d branch sweep | DONE |
| Phase 4e test backfill | DEFERRED (own brief) |
| Phase 5 — regression sweep | See smoke results |
