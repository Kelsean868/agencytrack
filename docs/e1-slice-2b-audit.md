# E1 Slice 2B — API Usage Audit

**Date:** 2026-05-09  
**Branch:** `feat/e1-slice-2b-surface-adaptation`  
**Purpose:** Document every place API/apps are read, computed, or displayed before Phase 4 changes.

---

## STOP-condition checks

| Check | Status |
|---|---|
| > 25 distinct call sites | ✅ No — 23 total (under limit) |
| Surface using `apiSold` for commissionable semantics outside CommissionPlayground | ✅ No — CommissionPlayground reads no raw doc fields; ManagerDashboard reads none |
| Direct `.apiSold` reads bypassing `extractFields.js` | ⚠️ Yes — 17 call sites in 4 files (migration required in Phase 4) |

No hard stops triggered. Phase 4 proceeds.

---

## Key: metric targets

| Term | Definition |
|---|---|
| `totalProductionCredit` | NB.api + PPP.apiIncrease + LMPS.apiCredit — what the whiteboard shows, what awards measure |
| `apiSold` (extractFields) | NB.api only (V2: reads `newBusiness.api`) — NOT suitable for production totals in V2 world |
| `applicationsSold` (extractFields) | NB.apps only (V2: reads `newBusiness.apps`) — suits display and most award counts |
| Centurion apps | `newBusiness.apps + min(pppIncreases.apps, 20)` — per award rules, PPP apps count, capped at 20 |

---

## Call-site table

| File:line | Type | Current behavior | Fix / Target | Risk |
|---|---|---|---|---|
| `awardsEngine.js:78` | compute | `sub.apiSold` — monthly estimated API sum | `extractTotalProductionCredit(sub)` | HIGH (award eligibility) |
| `awardsEngine.js:79` | compute | `sub.applicationsSold` — monthly estimated apps sum | `extractFields(sub).applicationsSold` | HIGH (award eligibility) |
| `awardsEngine.js:98` | compute | `sub.apiSold` — quarterly estimated API sum | `extractTotalProductionCredit(sub)` | HIGH (award eligibility) |
| `awardsEngine.js:99` | compute | `sub.applicationsSold` — quarterly estimated apps sum | `extractFields(sub).applicationsSold` | HIGH (award eligibility) |
| `awardsEngine.js:119` | compute | `s.apiSold` — annual supplement API | `extractTotalProductionCredit(s)` | HIGH (award eligibility) |
| `awardsEngine.js:120` | compute | `s.applicationsSold` — annual supplement apps | `extractFields(s).applicationsSold` | HIGH (award eligibility) |
| `awardsEngine.js:564` | compute | `getApps = p(s.applicationsSold)\|\|p(s.appsSold)` — Centurion app count | `p(s.newBusiness?.apps ?? extractFields(s).applicationsSold) + Math.min(p(s.pppIncreases?.apps), 20)` — Phase 7 | HIGH (Centurion award) |
| `awardsEngine.js:567` | compute | `getAPI = p(s.apiSold)\|\|p(s.api)\|\|p(s.annualPremium)` — Centurion API | `extractTotalProductionCredit(s)` | HIGH (Centurion award) |
| `AgentDashboard.jsx:164` | aggregate | `f.apiSold` via `extractFields(s)` — YTD API ring | `extractTotalProductionCredit(s)` | HIGH (user-visible KPI) |
| `AgentDashboard.jsx:165` | aggregate | `f.applicationsSold` via `extractFields(s)` — YTD apps | No change needed — NB apps correct for YTD apps count | LOW |
| `AgentDashboard.jsx:42` | display | `SPARKLINE_METRICS field:'apiSold'` — API sparkline reads `f.apiSold` from kpiData | Add `totalProductionCredit` to kpiData; change field to `'totalProductionCredit'` | MEDIUM (sparkline) |
| `AgentDashboard.jsx:615` | display | `s.apiSold` raw read — submission list item subtitle | `extractTotalProductionCredit(s)` | LOW (list display only) |
| `AgentDashboard.jsx:616` | display | `s.applicationsSold` raw read — submission list item | `extractFields(s).applicationsSold` | LOW (list display only) |
| `MotivationalCarousel.jsx:59` | aggregate | `sub.applicationsSold` — monthly apps for "Apps to Sales Floor" message | `extractFields(sub).applicationsSold` | MEDIUM (motivational message) |
| `MotivationalCarousel.jsx:116` | aggregate | `sub.apiSold` — YTD API for MDRT/club progress | `extractTotalProductionCredit(sub)` | HIGH (club eligibility message) |
| `MotivationalCarousel.jsx:160` | display | `latestSub?.apiSold` — latest week API in message | `extractTotalProductionCredit(latestSub)` | MEDIUM (motivational message) |
| `weeklyChampions.js:35` | aggregate | `f.apiSold` via `extractFields(s)` — top API champion | `extractTotalProductionCredit(s)` | MEDIUM (champion display) |
| `weeklyChampions.js:36` | aggregate | `f.applicationsSold` via `extractFields(s)` — top apps champion | No change needed | LOW |
| `exportService.js:87` | aggregate | `f.apiSold` via `extractFields(s)` — CSV YTD API | `extractTotalProductionCredit(s)` | MEDIUM (CSV export) |
| `exportService.js:88` | aggregate | `f.applicationsSold` via `extractFields(s)` — CSV YTD apps | No change needed | LOW |
| `AgentReportDocument.jsx:397` | aggregate | `s.apiSold` raw read — YTD API sum (PDF) | `extractTotalProductionCredit(s)` | MEDIUM (PDF) |
| `AgentReportDocument.jsx:398` | aggregate | `s.applicationsSold` raw read — YTD apps sum (PDF) | `extractFields(s).applicationsSold` | MEDIUM (PDF) |
| `AgentReportDocument.jsx:435` | aggregate | `s.apiSold` raw read — month-by-month API (PDF) | `extractTotalProductionCredit(s)` | MEDIUM (PDF) |
| `AgentReportDocument.jsx:436` | aggregate | `s.applicationsSold` raw read — month-by-month apps (PDF) | `extractFields(s).applicationsSold` | MEDIUM (PDF) |

**Total call sites: 24**

---

## Already V2-compatible — no changes needed

These consume `extractFields(s).apiSold` or `extractFields(s).applicationsSold` correctly, and their semantics are either:
- correct for V2 (NB-only is intentional), or
- out of Phase 4 scope

| File | Fields accessed | Notes |
|---|---|---|
| `MasterSheet.jsx:135,137` | `f.apiSold`, `f.applicationsSold` via extractFields | Uses `totalProductionCredit` route handled by Phase 4 via new extractor |
| `aggregateAPI.js:57` | `extractFields(s).apiSold` | Used for goal-gap calculations — should switch to `extractTotalProductionCredit`; tracked separately if aggregateAPI.js feeds any dashboard ring |
| `campaignEngine.js:46` | `extractFields(s)` fields | Campaign tracks NB-only by design — leave as-is unless campaign spec changes |
| `buildActivityEvents.js:78,137` | `extractFields(s)` | Activity feed — NB-only is correct context |
| `SubmissionViewer.jsx:69` | `extractFields(s)` | Submission detail view — V2-compatible via extractFields |
| `MeetingMode.jsx:131` | `extractFields(sub)` | Manager view of agent submission detail — V2-compatible |
| `TenantAdminDashboard.jsx:109` | `extractFields(s).apiSold` | Admin aggregate — should switch to `extractTotalProductionCredit`; minor |
| `MotivationalCarousel.jsx:177` | `extractFields(s).totalNewNames` | Names pipeline card — no production API involved |
| `CommissionPlayground` (all) | No raw doc reads | Commissionable semantics only — leave untouched per planning decision |
| `ManagerDashboard.jsx` | No direct reads | Delegates to sub-components |

---

## MasterSheet note

`MasterSheet.jsx:25-27` defines column config with `key: 'applicationsSold'` and `key: 'apiSold'`. These keys are read from the `extractFields(sub)` output at line 135/137. No raw doc reads. The `apiSold` column will show NB.api only for V2 docs. **Phase 4 should rename/add a `totalProductionCredit` column** or replace the `apiSold` column definition to switch to the new extractor. Exact approach determined in Phase 4.

---

## aggregateAPI.js note

`aggregateAPI.js:57` sums `extractFields(s).apiSold` — used by the goals gap-analysis pipeline. Should switch to `extractTotalProductionCredit(s)` to correctly reflect total production against goals. **Include in Phase 4.**

---

## Phase 4 action list (derived from this audit)

**High priority (award eligibility + user-visible KPI):**
1. `awardsEngine.js` — import `extractFields` + `extractTotalProductionCredit`; replace 8 raw reads; Centurion apps cap in Phase 7
2. `AgentDashboard.jsx:164` — YTD API acc: switch to `extractTotalProductionCredit`
3. `AgentDashboard.jsx:42,180` — kpiData + SPARKLINE_METRICS: include `totalProductionCredit`
4. `MotivationalCarousel.jsx:116` — YTD API for club progress

**Medium priority (manager views, PDF, carousel):**
5. `MotivationalCarousel.jsx:59,160` — replace raw reads
6. `weeklyChampions.js:35` — top API champion
7. `exportService.js:87` — CSV YTD API
8. `AgentReportDocument.jsx:397,398,435,436` — PDF raw reads (Phase 6 will redesign entirely)
9. `aggregateAPI.js:57` — goal gap-analysis API sum
10. `MasterSheet.jsx` — API column definition

**Low priority (display labels):**
11. `AgentDashboard.jsx:615-616` — submission list subtitle
