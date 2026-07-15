# Company Config v2 — Consolidation Recon (Slice 1)

**Type:** Read-only reconnaissance. No code changes, no builds, no deploys.
**Validity-SHA:** `942ab2522c43811f706cbf2ab1881ed84dfe81bf` — this recon describes the repository at exactly this HEAD. `origin/main` and `origin/staging` are both at this SHA at authoring time (Runs 3+4 promoted via PR #853, merge `0d5662ef`). Every finding below is grep/read-verified against this checkout (Rule 17); where a claim could not be verified it is marked **unverified** rather than inferred.
**Prior art:** `docs/audits/tenant-config-audit-2026-07-10.md` (its own §4.3 correction pass ran at `32821c42…`, 53 commits behind this HEAD). It was used as a starting map and **revalidated**, not trusted — see Part A.
**Method:** Four parallel literal-grep sweeps (revalidation, Runs-3+4 new constants, six-surface deep read, awards-pattern deep read), each returning `file:line` citations, cross-checked by direct reads of `awardsRulesetService.js` + its test, `firestore.rules` config arms, `useFeatureFlag.js`, and `viewDefaults.js`.

---

## Executive summary

- **The prior audit is substantially still accurate.** Of ~33 revalidated items, all but four are CONFIRMED at the cited `file:line`. The four deltas: `useFeatureFlag` hook moved to `:31`; `POINTS_WEIGHTS` is now **21 keys, not 19**; `celebrations.js` moved `src/utils/ → src/lib/` (values unchanged); minor line-range corrections. No CHANGED-VALUE on any business constant.
- **Runs 3+4 added ~30 new hardcoded constants** — the 8-stage funnel model, funnel filters, planner recurrence enums/caps, a third streak-milestone array (`FILING_WEEKLY_STREAK_MILESTONES=[5,10,25,52]`), and the RANK-BY view default. **None are read by any Cloud Function** — the CF (`functions/index.js`) imports none of these modules and computes its own thresholds independently.
- **One rules fact reframes the whole track:** the `/config/{docId}` write arm (`firestore.rules:630-637`) is a **wildcard** granting `tenant_admin`/`platform_admin` write to *any* config doc, with **zero field validation**, and **no existing rule reads any `/config/` value**. So (a) slice-1 grouped docs need **no new rules arm**, and (b) a config change is **not** a rules-behavior change today.
- **The awards-ruleset override pattern is genuinely good and well-tested** (deep-merge-to-code-default + validated monolithic write, ~30 tests). But it has **three gaps against the locked design**: whole-object storage (fights "empty-by-default"), no effective-dating, no per-field audit trail. Adopt its *accessor/absence contract* as canonical; **do not** adopt its *storage model* verbatim.
- **Slice 1 is achievable as a near-zero-migration nav/IA consolidation.** The three tenant-config panels already co-mount in one `config` tab; the work is structuring them + folding in a feature-flags admin surface, not moving data.

---

# PART A — Revalidate + refresh vs current HEAD

## A1. Diff table vs the prior audit (`file:line` reconfirmed at `942ab252`)

Status legend: **CONFIRMED** (same location + value) · **MOVED** (line/file drifted, value intact) · **CHANGED-VALUE** · **GONE**.

| # | Item | Status | Current `file:line` | Value observed | Note |
|---|------|--------|---------------------|----------------|------|
| 1 | `getFeatureFlags()` fail-closed to `{}` | CONFIRMED | `src/services/featureFlagsService.js:42-56` | `{}` on `!tenantId` / `!snap.exists()` / non-object / `catch` | |
| 2 | `isFlagOn` strict `=== true` | CONFIRMED | `featureFlagsService.js:59-61` | `flags?.[key] === true` | |
| 3 | `useFeatureFlag` hook | **MOVED** | `src/hooks/useFeatureFlag.js:31` | `export function useFeatureFlag(key)` | Audit cited `:14`; that line is now the import. Hook def at `:31` |
| 4 | `FEATURE_FLAG_KEYS` | CONFIRMED | `featureFlagsService.js:29-33` | `persistencyV2`, `policyLedgerCampaignLens`, `awardsProvenance` | Exactly 3 |
| 5 | companyMinimums defaults | CONFIRMED | `src/services/goalsService.js:55-73` (defaults 60-62) | `annualAPI ?? 200000`, `annualApps ?? 42`, `persistency ?? 90` | |
| 6 | `weeklyActivityFloors` shallow-merge | CONFIRMED | `goalsService.js:64-67` | `{...DEFAULT_WEEKLY_ACTIVITY_FLOORS, ...(stored…)}` | |
| 7 | `tenureApiFloors` shallow-merge | CONFIRMED | `goalsService.js:68-71` | `{...DEFAULT_TENURE_API_FLOORS, ...(stored…)}` | |
| 8 | `workingDaysPerWeek` ∈ {5,6} | CONFIRMED | `goalsService.js:120-126` | throws "Working days per week must be 5 or 6" | |
| 9 | `setCompanyMinimums(tenantId,data,updatedBy)` | CONFIRMED | `goalsService.js:88-130` | writer signature intact | See B3 gap: writer only persists `annualAPI`/`weeklyActivityFloors`/`workingDaysPerWeek` |
| 10 | `DEFAULT_TENURE_API_FLOORS` | CONFIRMED | `src/utils/tenureFloors.js:16-24`; fallbacks `:26-27` | 150000/200000/250000/300000/400000/500000; `FLAT_ANNUAL_API_FALLBACK=200000`, `FLAT_WEEKLY_API_FALLBACK=4800` | Fallbacks at `:26-27`, not inside the 16-24 block |
| 11 | override get/set/delete | CONFIRMED | `src/services/managerStandardOverrideService.js:32/43/57` | doc-ref lines (decls at 31/42/56) | |
| 12 | override read in CF | CONFIRMED | `functions/war/onWarSubmitNotifyUpline.js:48` | Admin-SDK `.doc(…managerActivityStandardOverrides/${managerId}).get()` | |
| 13 | escalation merge in CF | CONFIRMED | `functions/war/escalationLogic.js:37` (`resolveStandards`) | audit cited `:32` (a JSDoc line); merge at `:37-48` | |
| 14 | tenant standards get/set + schema | CONFIRMED | `src/services/managerActivityStandardsService.js:29-33/52-55`; schema `:10-21` | NUMERIC (6 keys) + BOOLEAN (`unitMeetingHeld`,`dashboardReviewDone`) | |
| 15 | `getResolvedStandards`/`…ForMany` | CONFIRMED | `managerStandardOverrideService.js:65-72` / `88-107` | `override ?? orgDefault[role]` | |
| 16 | ActivityStandards Panel + Modal | CONFIRMED | `src/components/admin/ActivityStandardsPanel.jsx`; `ActivityStandardsModal.jsx:130` | Modal calls `setManagerActivityStandards(…, currentUid)` | |
| 17 | Kiosk static config | CONFIRMED | `src/lib/kiosk/kioskConfig.js:1-18/41-55/57/61-63` | `POLL_INTERVAL_MS = 5*60*1000`; env-driven `VALIDATE_TOKEN_URL` | |
| 18 | `POINTS_WEIGHTS` key count | **CHANGED-VALUE** | `src/lib/gamificationConfig.js:8-34` **and** `functions/lib/gamificationConfig.js:10-36` | **21 keys** (both copies identical); `applicationsSold=25`, `ciConducted=10`, `referralsObtained=3` | Audit said 19; location + spot values intact, only the count was stale |
| 19 | `LEVEL_THRESHOLDS` | CONFIRMED | `gamificationConfig.js:36-43` (src) / `:38-45` (CF) | Rookie@0/Associate@500/Pro@1500/Elite@3500/Legend@7000 | Both copies match |
| 20 | weekly-submission streak badges | CONFIRMED | `functions/index.js:1485-1487` | `≥4→streak_4`, `≥8→streak_8`, `≥13→streak_13` | Inline in CF, not in shared config |
| 21 | `computePoints` | CONFIRMED | `src/lib/computePoints.js:44-67`; `functions/lib/computePoints.js:42-65` | identical weighted-sum both copies | |
| 22 | `MDRT_THRESHOLDS_2026` | CONFIRMED | `src/config/mdrtThresholds/2026.js:4-8` | mdrt=688800, cot=2066400, tot=4132800 | Display/projection figures |
| 23 | `badgeThresholds` (CF) | CONFIRMED | `functions/lib/badgeThresholds.js:17/23/29/30` | `MDRT_QUALIFIED_API=688800`, `MDRT_PACE_API=344400`, `TENURE_FLOOR_API=500000`, `TENURE_FLOOR_YEARS=5` | CF-only, **no src twin** |
| 24 | `mdrtAward.apiThreshold` | CONFIRMED | `src/config/awardsRuleset/2026.js:80-84` (value `:81`) | `500000` (`apiInContention:250000`) | Tenant-configurable |
| 25 | MDRT/tenure badge writes | CONFIRMED | `functions/index.js:1523-1547` | mdrt_qualified/mdrt_pace/tenure_floor_met | |
| 26 | `DEFAULT_FINANCING_RULESET_2026` | CONFIRMED | `src/config/financingRuleset/2026.js:13-86` (audit said `:13-40`) | quarterlyGrossMin=37500, persistencyY1=0.95, persistencyY2=0.90, consistencyRate=0.15, productionRateY1=0.15, productionRateY2=0.20 | Object larger than audit's range; values intact |
| 27 | NO financing override plumbing | CONFIRMED | (grep) | `getMergedFinancingRuleset`=0, `financingRuleset_`=0; `config/financingRuleset`=6 (all default-import lines) | Still greenfield |
| 28 | CBTT compliance window | CONFIRMED | `src/utils/cbttCompliance.js:22/34` | 12mo (24 if extension); `atRisk: daysRemaining <= 90` | |
| 29 | clawback clock | CONFIRMED | `src/utils/clawbackClock.js:22-23` | `CLAWBACK_DAYS=30`, `AT_RISK_DAYS=7` | |
| 30 | persistency 0.80/80% hardcodes | CONFIRMED | `src/components/manager/PersistencyTab.jsx:170`; `PersAtRiskBook.jsx:12,25,41` | `< 0.80` at-risk floor | Path is `components/manager/` (audit gave bare filename) |
| 31 | pace thresholds | CONFIRMED | `src/utils/managerExceptions.js:31-32`; `src/utils/planVariance.js:54` | `FLOOR_PACE_DANGER=0.5`, `FLOOR_PACE_WARN=0.85`; `PACE_ON_TRACK_FRACTION=0.9` | |
| 32 | celebration milestones | **MOVED** (values intact) | `src/lib/celebrations.js:27/31` (was `src/utils/`) | `DAILY_STREAK_MILESTONES=[5,10,20]`; `GOALS_WEEKLY_STREAK_MILESTONES=[4,8,12]` | File moved `utils→lib`; the anticipated "5/10/25/52" is a **separate new** constant, see A2 |
| 33 | nudge crons + aggregators | CONFIRMED | `functions/index.js:1201/1239/1277`; `leaderboardAggregate.js:439`; `sundayDailyToWeekly.js:149` | `'0 22 * * 0'`, `'0 11 * * 1'`, `'1 13 * * 1'`, `'0 * * * *'`, `'0 3 * * 1'` | |

**Deviations that matter downstream:** #18 (`POINTS_WEIGHTS` is 21 keys — any config-promotion brief must enumerate all 21, not 19) and #32 (`celebrations.js` path moved). Everything else is location/line precision with values intact. **No business constant changed value** between the prior audit and this HEAD.

## A2. NEW constants introduced by Runs 3+4 (prior audit could not know these)

Same table shape as the old audit's §2. **Read-by-CF is `no` for every row** — verified: `functions/index.js` is the only non-`node_modules` CF source and it imports none of these modules (it recomputes its own streak/badge metrics inline from raw Firestore fields).

| Constant | Value | `file:line` | Proposed config path | Read by CF |
|---|---|---|---|---|
| `FUNNEL_GROUPS` (8-stage model) | ids p/ca/cm/qa/ffi/ci/res/ref; labels 01–08 | `src/utils/funnelModel.js:23-63` | config/funnel | no |
| `FUNNEL_COLLAPSED_W` | `{p:112,ca:118,cm:118,qa:138,ffi:104,ci:100,res:126,ref:126}` | `funnelModel.js:66` | config/display | no |
| `FUNNEL_TOGGLABLE_IDS` | all groups except `qa` | `funnelModel.js:69` | config/funnel | no |
| `FUNNEL_LEAD_W` | `[34,174,104]` | `funnelModel.js:77` | config/display | no |
| Prospecting Total composition | `letters+seminars+canvass+refCalls` | `funnelModel.js:92` | config/funnel | no |
| **FLAGGED-A** telAtt composition | `f.followUpCalls + f.seminarTradeshowCalls` | `funnelModel.js:99` | config/funnel | no |
| **FLAGGED-B** referrals decomposition | `refTot=computeTotalNewNames(f)`; `refs=f.referralsObtained`; `newNames=refTot-refs` | `funnelModel.js:132-134` | config/funnel | no |
| `FUNNEL_REPORT_OPTS` (report filter enum) | `[['submitted','Submitted'],['draft','Draft']]` | `src/utils/funnelFilters.js:26-29` | config/funnel | no |
| `DEFAULT_FUNNEL_FILTERS` | `{unit:'all',reports:[],noLog:false}` | `funnelFilters.js:32` | config/funnel | no |
| branch-direct sentinel/label | `'__branch_direct__'` → `'Branch direct'` | `funnelFilters.js:39` | config/funnel | no |
| `DAILY_STREAK_MILESTONES` | `[5,10,20]` | `src/lib/celebrations.js:27` | config/recognition | no |
| `GOALS_WEEKLY_STREAK_MILESTONES` | `[4,8,12]` | `celebrations.js:31` | config/recognition | no |
| `FILING_WEEKLY_STREAK_MILESTONES` (**new**) | `[5,10,25,52]` | `celebrations.js:37` | config/recognition | no |
| celebration localStorage namespace | `'agencytrack:celebrations'` | `src/lib/celebrationPrefs.js:13` | (device-local, not tenant config) | no |
| `REPEAT_RULES` (recurrence cadence enum) | `['none','daily','weekly','custom']` | `src/components/planner/recurrence.helpers.js:20` | config/planner | no |
| `DOW_KEYS` / `DOW_PICKER_ORDER` | Sun-first / Mon-first weekday arrays | `recurrence.helpers.js:23,25` | config/planner | no |
| `MAX_SERIES_INSTANCES` (52-instance cap) | `52` | `recurrence.helpers.js:30` | config/planner | no |
| `REPEAT_CHIPS` | none/daily/weekly/custom | `src/components/planner/AppointmentSheet.jsx:13-18` | config/planner | no |
| ENDS-mode enum ("Never" disabled) | `[['date','On date'],['count','After # times']]` | `AppointmentSheet.jsx:405` | config/planner | no |
| default `endType` / `endCount` | `'count'` / `12` | `AppointmentSheet.jsx:67-68` | config/planner | no |
| duration options (min) | `[15,30,45,60,90,120]` | `AppointmentSheet.jsx:330` | config/planner | no |
| `clampDuration` bounds | min `1`, max `720`, default `30` | `src/services/plannerService.js:77-81` | config/planner | no |
| `APPOINTMENT_TYPES`/`TYPE_KEYS` | 7 keys (PC/SC/AI/FFI/CI/SALE/FREE) | `plannerService.js:45-54` | config/planner | no |
| `APPOINTMENT_STATUSES`/`STATUS_KEYS` | scheduled/confirmed/kept/done/postponed/cancelled | `plannerService.js:57-65` | config/planner | no |
| `FREE_BLOCK_LABELS` | Training/Company seminar/Tradeshow/Prospecting time/Personal | `plannerService.js:68-70` | config/planner | no |
| note/prospectId/freeBlockLabel maxlens | `2000` / `200` / `120` | `plannerService.js:114,116,118` | config/planner | no |
| `MASTER_SHEET_PRESETS` (RANK-BY enum) | `['api','newNames']` | `src/config/viewDefaults.js:22` | **per-user pref, NOT tenant config** (see B6) | no |
| `DEFAULT_MASTER_SHEET_PRESET` (RANK-BY default) | `'api'` | `viewDefaults.js:24` | per-user pref | no |
| `PERIOD_OPTIONS`/`DEFAULT_PERIOD` | week/month/quarter/year; default `'year'` | `viewDefaults.js:31-40` | per-user pref | no |

### FLAGGED-A — Contact-Attempts "Tel" composition (`funnelModel.js:99`)
```
const telAtt = f.followUpCalls + f.seminarTradeshowCalls;
```
Stage ② "Tel" (attempts to reach a *known* person) is the sum of exactly two `extractFields` values — `followUpCalls` + `seminarTradeshowCalls` — deliberately placed in Contact-Attempts rather than stage ① Prospecting (in-code operator note, `funnelModel.js:95-98`). `caTot = telAtt + f2fAtt` (`:101`). **Duplication risk:** the same two raw fields are independently summed into the CF's `dials` badge metric (`functions/index.js:1470,1472`); the CF does **not** import `telAtt` — the composition is duplicated, not shared. A reclassification changes `:99` in src but silently diverges from the CF unless both are edited.

### FLAGGED-B — Referrals decomposition (`funnelModel.js:132-134`)
```
const refTot   = computeTotalNewNames(f);   // canonical import total
const refs     = f.referralsObtained;
const newNames = refTot - refs;
```
Stage ⑧ group total is pinned to the canonical `computeTotalNewNames(f)`, which **already includes** `referralsObtained`. A naive `Referrals + New-Names` sum would double-count, so the group is **decomposed** rather than re-summed: `Referrals = referralsObtained`, `New Names = refTot − referralsObtained`, keeping `refs + newNames === refTot` exactly. Any config-promotion of the referral taxonomy must preserve this decomposition invariant, not re-derive an independent sum.

**MasterSheet H3 collapse (commit `6808121e`) — no dedicated constant.** The "Persons Reached" single-column collapse is driven by the generic `expanded` Set (`MasterSheet.jsx:112`, default empty = all collapsed) + `funnelView` rendering only `kpi:true` columns at `FUNNEL_COLLAPSED_W` widths (`funnelModel.js:66,153-164`). There is no `contactsMade`/`personsReached` flag — it is data-driven by `cmTot` being the sole `kpi` column in group `cm`.

---

# PART B — Deep read: the existing config surfaces (what slice 1 consolidates)

Shared rules fact: **one wildcard arm** `config/{docId}` at `firestore.rules:630-637` governs surfaces 1(defaults), 2, 3, and 4 — read `isSignedIn() && getTenantId()==tenantId`; write `getRole() in ['platform_admin','tenant_admin'] && (platform_admin || getTenantId()==tenantId)`. **No field validation in the rule.**

### B1. Activity Standards (two docs, two rules regimes)

**Tenant defaults — `tenants/{tid}/config/managerActivityStandards`**
- **(a) Shape (from writer):** `setManagerActivityStandards` at `managerActivityStandardsService.js:52-55` writes `setDoc(ref,{...data,updatedBy,updatedAt:serverTimestamp()},{merge:true})`. Root = role sub-maps `{unit_manager,branch_manager,sales_manager}` (`STANDARDS_ROLE_KEYS:21`); each = NUMERIC (`jfwCount,oneOnOnesConducted,namesSourced,interviewsConducted,recruitsInFirstWeeks,trainingSessions` `:10-17`) + BOOLEAN (`unitMeetingHeld,dashboardReviewDone` `:19`).
- **(b) Read path:** `getManagerActivityStandards` (`:29-33`) → **per-mount** in `ActivityStandardsPanel.jsx:63` (effect `:71`). No shared cache.
- **(c) Absence:** fail-open to `{}` (`:32`); per-role `?? {}` (`:40`) → "no standards set", never "0 of 0".
- **(d) Write authority:** `config/{docId}` arm `firestore.rules:630-637` — tenant_admin/platform_admin only.
- **(e) Provenance:** `updatedBy` + `updatedAt` (`:54`); modal passes `currentUid` (`ActivityStandardsModal.jsx:130`).
- **(f) Nav/IA:** Tenant-Admin dashboard `config` tab (`TenantAdminDashboard.jsx:379`), tenant-admin only.
- **(g) CF read:** **YES** — `functions/war/onWarSubmitNotifyUpline.js:47` (Admin SDK), merged in `escalationLogic.js:37-48`.

**Per-manager overrides — `tenants/{tid}/managerActivityStandardOverrides/{managerId}`** (top-level collection, *outside* `/config/`)
- **(a) Shape:** `setManagerActivityStandardOverride` (`managerStandardOverrideService.js:42-51`) — partial activity map + `tenantId,managerId,updatedBy,updatedAt`; plain `setDoc` (omitted field clears the override); delete reverts to default (`:56-59`).
- **(b) Read path:** `getResolvedStandards` = `override ?? orgDefault[role]` (`:65-72`); bulk `getResolvedStandardsForMany` (`:88-107`). Consumers **per-mount**: `TeamWarsTab.jsx:72,110`, `ManagerWarTab.jsx:208`.
- **(c) Absence:** `{}` (`:34`) → falls through to org-default per key.
- **(d) Write authority:** **dedicated arm** `firestore.rules:1519-1575` — `uplineInScope()` (`:1544-1549`): strictly higher rank than subject, plus rank≥3 or same-branch branch_manager; subject role/branch read via `get()` (forgery prevention); `allow list: if false`.
- **(e) Provenance:** `updatedBy`+`updatedAt` (`:48-49`); UI passes `currentUid` (`ManagerOverrideModal.jsx:127`).
- **(f) Nav/IA:** manager **WAR flow** (not tenant-admin nav); upline managers author.
- **(g) CF read:** **YES** — `onWarSubmitNotifyUpline.js:48`.

> **Consolidation nuance:** only the tenant *default* belongs in Company Config; the per-manager overrides are manager-authored, live in a different collection with a bespoke forgery-prevention rules arm, and stay in the WAR flow. Group 5 is largely **already built** (the prior audit §4.3 corrected this) — consolidation re-homes the *default* editor, not the override machinery.

### B2. Feature Flags — `tenants/{tid}/config/settings`, field `featureFlags`
- **(a) Shape:** map `featureFlags.<key>` on `config/settings` (`featureFlagsService.js:45,49`).
- **(b) Read path:** `getFeatureFlags` → `useFeatureFlag` (`useFeatureFlag.js:31-48`). **Load-ONCE per tenant** via module-level `flagsCache = new Map()` (`:17`) memoizing the promise (`:19-24`); read at mount, **not** live-subscribed. `FEATURE_FLAG_KEYS` = `persistencyV2,policyLedgerCampaignLens,awardsProvenance` (`:29-33`).
- **(c) Absence:** **fail-closed OFF** — `{}` on every error/absent path (`:43,47,50,51-55`); `isFlagOn` requires `=== true`; hook defaults `false`.
- **(d) Write authority:** `config/{docId}` arm `630-637`. **No client writer exists.**
- **(e) Provenance:** none.
- **(f) Nav/IA:** **NONE — no admin UI.** Flags are written only by ops scripts: `scripts/staging/seed-fixtures.mjs:715` and `scripts/verification/vh/flag-toggle.cjs:66` (`ALLOWED_FLAGS` allowlist at `:26`). Operator flips in the Firebase console.
- **(g) CF read:** No CF reads `featureFlags`.

### B3. Company Minimums — `tenants/{tid}/config/companyMinimums`
- **(a) Shape (from writer):** `setCompanyMinimums(tenantId,data,updatedBy)` (`goalsService.js:88-130`) writes `setDoc(ref,payload,{merge:true})` (`:129`). Payload = `annualAPI` (required, `0<x≤10,000,000`), `updatedBy`, `updatedAt` (`:97`), optional validated `weeklyActivityFloors`, optional `workingDaysPerWeek∈{5,6}`. **Gap:** the writer does **not** persist `annualApps`, `persistency`, or `tenureApiFloors` — those exist only as read-time defaults (`:60-71`). They are effectively **read-only constants today**, not tenant-settable through this service.
- **(b) Read path:** `getCompanyMinimums` (`:55-73`), **per-mount / per-call, no shared cache.** 14 read sites — `useMyProduction.js:42`, `useBranchOverview.js:54`, `commitPlanService.js:83`, `planReviewService.js:113`, `goalsImportService.js:209`, `CompanyConfigPanel.jsx:53`, `GoalsPanel.jsx:852`, `CareerPortal.jsx:629`, `DailyCaptureV2.jsx:660`, `TeamPlannerPanel.jsx:122`, `AgentDashboard.jsx:247`, plus internal `goalsService.js:174,325`.
- **(c) Absence:** code-default merge (`annualAPI??200000`, `annualApps??42`, `persistency??90`; shallow-merge floors `:64-71`). Several callers add their own `.catch(()=>null|FALLBACK_MINIMUMS)`.
- **(d) Write authority:** `config/{docId}` arm `630-637`.
- **(e) Provenance:** `updatedBy`+`updatedAt` (`:97`); `usingDefaultMinimums()` keys off their absence.
- **(f) Nav/IA:** `CompanyConfigPanel` (B5), Tenant-Admin `config` tab (`TenantAdminDashboard.jsx:378`).
- **(g) CF read:** **No** — client-side only.

### B4. Awards Ruleset — `tenants/{tid}/config/awardsRuleset_{year}`
(Full pattern in Part C.) Path per-year; **whole-object** `setDoc` (no merge) at `awardsRulesetService.js:104-105`, validated-complete; dual accessors (raw `getAwardsRuleset` for the editor `:5-9`; `getMergedAwardsRuleset` deep-merged for consumers `:54-57`). Absence → `DEFAULT_RULESET_2026` (`:8`). Provenance `updatedBy`+`updatedAt` (`:107-108`). Rules arm `630-637`. **No CF read.** Nav: `AwardsRulesetPanel`, Tenant-Admin `config` tab (`TenantAdminDashboard.jsx:380`). Consumers (5, all per-mount): `AwardsRulesetPanel.jsx:404`, `MoneyNeedsAllocator.jsx`, `ManagerAwardsPanel.jsx`, `AgentDashboard.jsx`, `useMyProduction.js`.

### B5. Kiosk config — static JS, **no Firestore doc**
- **(a) Persistence:** NONE. `src/lib/kiosk/kioskConfig.js` is static exports — `PANEL_DURATIONS(:1-18)`, `PANEL_ORDER(:41-55)`, `POLL_INTERVAL_MS(:57)`, `VALIDATE_TOKEN_URL(:61-63, import.meta.env with a hardcoded CF-URL fallback)`. No `getDoc/setDoc/db`.
- **(b) Read path:** ES-module import; `KioskModeTab.jsx:9` reads it, rendered read-only `:222-240`.
- **(c/e) Absence/provenance:** N/A (compile-time constants).
- **(d) Write authority:** N/A for the config. The **separate** auth doc `kioskTokens/{tokenId}` has arm `firestore.rules:880-882` (`canManage` — all manager tiers). Branch-scope test present (`tests/rules/kioskBranchScope.rules.test.mjs`).
- **(f) Nav/IA:** `KioskModeTab` on the **Manager** dashboard `kiosk` tab (`ManagerDashboard.jsx:647`) — manager-tier, **not** tenant-admin.
- **(g) CF read:** the config JS is client-only; `kioskTokens` is read by the `validateKioskToken` CF (Admin SDK, per rules comment `:878-879`).

### B6. Settings user-prefs incl. RANK BY — `tenants/{tid}/users/{uid}/prefs/app`
- **(a) Shape (from writer):** `setAppSetting(tenantId,uid,key,value)` (`userPrefsService.js:129-137`) → `setDoc(ref,{settings:{[key]:value},updatedAt},{merge:true})`. **RANK BY is `settings.masterSheetPreset`** — same-key repurpose of the old column-preset (`viewDefaults.js:17-22`); values `['api','newNames']`, default `'api'`. **There is no `rankBy` field** — the persisted key is `masterSheetPreset`.
- **(b) Read path:** `getUserPrefs` → `useAppSettings` (`useAppSettings.js:54-90`), localStorage-mirror-first paint then per-mount Firestore reconcile. RANK BY read only at mount (`MasterSheet.jsx:110-111,116`; session changes ephemeral, never written back).
- **(c) Absence:** validated code default `'api'` via `isValidMasterSheetPreset` (`viewDefaults.js:25-27`); legacy strings fail closed.
- **(d) Write authority:** **PER-USER, owner-only** — `users/{uid}/prefs/{prefId}` arm `firestore.rules:1884-1886` (`request.auth.uid==uid`).
- **(e) Provenance:** `updatedAt` only (uid is the path).
- **(f) Nav/IA:** `SettingsScreen` "My Preferences"; RANK-BY row gated `!isAgent && !isAdmin` (`SettingsScreen.jsx:99,148-161`) — producing/non-producing managers only.
- **(g) CF read:** No.

> **Scoping verdict:** RANK BY / defaultPeriod are **per-user preferences, not tenant business policy.** They live under an owner-only rules arm on a different data axis and must **not** be absorbed into the tenant Company Config surface. They stay in `SettingsScreen`. Listed here only because the task named the surface.

---

# PART C — The awards override pattern, in detail + verdict

### Mechanics (all `src/services/awardsRulesetService.js`, read in full)

1. **Doc shape / storage model.** Path `tenants/{tid}/config/awardsRuleset_{year}` (year param, default 2026). **Storage is WHOLE-OBJECT, not diff.** `setAwardsRuleset` (`:95-110`) uses plain `setDoc` **with no merge option** (`:105`, comment `:92-94` "monolithic replacement") and **rejects partial writes** — every top-level group of `DEFAULT_RULESET_2026` must be present (`REQUIRED_GROUPS` guard `:96-100`). So a tenant that edits one threshold materializes the **entire** ruleset into their doc.

2. **Merge / precedence.** `deepMergeRuleset(loaded,fallback)` (`:23-42`) is a **recursive deep merge**: loaded wins per-key, fallback backfills absent keys, nested objects recurse (`:36-40`), **arrays are taken wholesale from `loaded`** (not element-merged) (`:37-40`), and a key explicitly `null/undefined` in the doc reverts to the default (`:32-35`, the Gemini #709 fix). Applied only by `getMergedAwardsRuleset` (`:54-57`).

3. **Accessor API.** Three exports: `getAwardsRuleset` (raw, for the admin editor's faithful round-trip — "Option A"), `getMergedAwardsRuleset` (deep-merged, for render/compute consumers), `setAwardsRuleset` (validated monolithic write). A consumer reads a single threshold as `(await getMergedAwardsRuleset(tid)).mdrtAward.apiThreshold`.

4. **Absence handling.** Missing doc → `getAwardsRuleset` returns `DEFAULT_RULESET_2026` (`:8`); merged path → `deepMerge(DEFAULT,DEFAULT)=DEFAULT`. Partial doc → gaps backfilled. **Fail-to-code-default**, never crash, never fail-closed-empty.

5. **Provenance / dating.** `updatedBy` + `updatedAt:serverTimestamp()` (`:107-108`) — last-writer only. **No per-field audit.** **No effective-dating** (no `validFrom/asOf/effectiveDate`). The only temporal dimension is the **`_{year}` doc suffix** — coarse annual versioning; within a year, edits overwrite with no history. Only `2026.js` exists in `src/config/awardsRuleset/` today.

6. **Test coverage** (`src/services/__tests__/awardsRulesetService.test.js`, ~30 cases). Asserts: absence→DEFAULT; raw accessor stays partial (contract-lock `:79-90`); deep-merge backfill + recurse (`:111-126`); **arrays wholesale** (`:128-132`); null/undefined→default (`:134-140`); monolithic no-merge write (`:183-187`); completeness guard fires and blocks `setDoc` (`:205-209,241-245`); numeric validation scalar + nested + array-element + empty-array (`:211-298`); provenance in payload (`:189-194`). **Genuinely well-tested** for what it does — the merge/absence/validation contract is locked by tests. Effective-dating and audit-trail are untested because they don't exist.

### VERDICT — good enough to replicate 12×?

**Adopt the *contract*, not the *storage model*.** The two hardest, most bug-prone things a config layer must get right — (a) graceful absence/partial-doc handling that falls through to the code default without crashing render, and (b) a real write-time validation guard — this pattern nails both, with test coverage to prove it. That accessor/absence contract (`getMerged*` = deepMerge-to-default; raw accessor for the editor; validated `set*`) **is** the right canonical shape and is cheap to stamp out (~110 lines/surface). Replicate that.

But three properties make it **insufficient as-is** for the *locked* design:

- **Whole-object storage fights "empty-by-default."** The locked design says new tenants start with **empty** config docs, inheriting code defaults by absence. This pattern does the opposite: the first edit writes the **entire** validated ruleset. You then cannot tell what the tenant actually changed vs inherited, "reset one field to default" has no clean primitive (the field is a materialized copy), and schema additions in later releases only reach the tenant through `deepMerge` backfill of *absent* keys — a materialized doc is bloated and opaque. **Recommend diff-only storage** (persist just the overridden keys; the accessor already deep-merges onto the code default, so a diff doc is sufficient and "empty by default" falls out for free).
- **No effective-dating.** The locked design requires award thresholds (and points scale, company minimums) to be **effective-dated** so history evaluates against the value in force at the time. This pattern has only the coarse `_{year}` boundary and, within a year, retroactively rewrites the whole year on edit. Effective-dating must be an **envelope around** the value, not a field bolted onto this shape — see D2.
- **No audit trail.** `updatedBy/updatedAt` is last-writer-wins with no history. The locked design's "correct a past value" action requires an audit-log entry. The pattern would need the (banked) audit-log collection wired to its `set*`.

- **Minor footguns:** arrays are whole-replaced (a default gaining a tier will *not* reach a tenant who stored the old array — a real drift trap for `clubAward.tiers`); untyped (runtime `validateNumericFields` only); per-consumer fetch with no shared cache (5 consumers = 5 round-trips, unlike `useFeatureFlag`'s load-once) — the ConfigProvider fixes this last one for free; audit fields (`updatedBy`/`updatedAt`) are written into the **same namespace** as ruleset data (`:105-108`) and survive into the merged object — a typed v2 must separate metadata from payload; concurrency is **last-write-wins** (the panel's `aborted`/`failed-precondition` handling at `AwardsRulesetPanel.jsx:582` is cosmetic — the write path raises no such precondition).
- **Security note (ties to D4):** write-side validation (`validateNumericFields` + completeness guard) is **client-only** — verified no CF revalidates, and the `config/{docId}` rules arm (`630-637`) enforces **no shape/field validation**. A hand-crafted client write bypasses the completeness/numeric guards entirely; only `deepMergeRuleset`'s crash-prevention saves render. Replicating the pattern 12× to money-adjacent surfaces (targets, minimums) without rules-layer shape validation widens this. Slice 1 inherits it (no worse), but slices 2/3 promoting money constants should add rules validation per-doc.

**Bottom line:** canonical **read contract** = yes, replicate. Canonical **storage/provenance model** = no, redesign to diff-only + effective-dating envelope + audit-log hook **before** stamping it 12×, or slices 2/3 inherit a shape that cannot honor the locked retroactivity rules.

---

# PART D — Architecture implications for the locked design

### D1. Consumers that would move to `useConfig`, and how invasive

For a **pure IA consolidation (slice 1)**, the mechanically-required read-consumer changes are **≈ zero** — the existing services keep working; only the **admin panels** re-home in the nav. A full migration of read consumers to `ConfigProvider`/`useConfig` is *optional* and, if done, touches these existing call sites:

| Surface | Consumer call-sites | Count |
|---|---|---|
| `companyMinimums` | 11 components/hooks/services + 2 internal (`goalsService`) | **14** |
| `awardsRuleset` (merged) | `AgentDashboard`, `ManagerAwardsPanel`, `MoneyNeedsAllocator`, `AwardsReachPanel`(via `useMyProduction`), `AwardsRulesetPanel` | **5** |
| `featureFlags` | `PersistencyTab`, `CampaignLensPanel`, `AgentAwardsPanel` (via `useFeatureFlag`) | **3** |
| activity standards (tenant default + resolved) | `ActivityStandardsPanel`, `TeamWarsTab`, `ManagerWarTab` | **3** |

≈ **25 call-sites** if fully migrated. Invasiveness is *low per site* (swap a `getX(tenantId)` for `useConfig('path', DEFAULT)`) but *broad*, and every migration is a behavior-equivalence risk on a money/goal surface. **Recommendation:** slice 1 introduces `ConfigProvider` + `useConfig` and migrates **only new reads**; leave the 25 existing consumers on their current services until a constant they read is actually promoted (slices 2/3). Consolidation is a nav/IA change, not a 25-file refactor.

### D2. Effective-dating — which consumers evaluate PAST periods, and is there prior art?

Consumers that resolve a value **as-of a historical moment** (and would need effective-dated config):

- **Award qualification / reach:** `awardsEngine.js` consumers (`AgentDashboard`, `ManagerAwardsPanel`, `MoneyNeedsAllocator`, `AwardsReachPanel`). Awards are per-year via `awardsRuleset_{year}` — coarse annual effective boundary exists, but **within a year** an edit retroactively re-derives the whole year.
- **Points aggregation:** the submission-write CF computes points at write time and **stores** them on `leaderboard/{uid}`; historical points are frozen-by-materialization. **But** `recomputeLeaderboardScheduled`/`recomputeLeaderboardOnDemand` re-derive from `POINTS_WEIGHTS` — a weights change would silently rewrite history on the next recompute (the prior audit's §4.1 warning).
- **Pace / minimums checks:** `managerExceptions.js` (`FLOOR_PACE_*`), `planVariance.js` (`PACE_ON_TRACK_FRACTION`), `useMyProduction`/`useBranchOverview` (pro-rata `companyMinimums`). These evaluate **now vs current floor**; no historical snapshot is stored, so raising a floor changes the displayed pace for prior weeks retroactively.

**Prior art: none for config values.** Verified — the only `effectiveDate` usage in the repo is **per-agent financing contract dates** (`FinancingTermsSetup`, `UnitFinancingRoster.financingMonthIndex`, `FinancingReconciliationPanel.reconMonthIndex`), which resolve *contract months* relative to a per-agent anchor, not a config value as-of a date. The nearest structural analogues are (a) the `_{year}` doc-suffix convention (coarse annual as-of) and (b) frozen-at-write-time leaderboard materialization (implicit as-of). **Effective-dated config resolution is net-new** and must be designed, not reused. The financing month-index helpers are a reference *shape* for date-anchored resolution but do not generalize to config.

### D3. Constants in `functions/` (CJS) needing runtime config reads

| CF constant | Where | Twin / drift guard |
|---|---|---|
| `POINTS_WEIGHTS`, `LEVEL_THRESHOLDS`, `BADGE_DEFINITIONS` | `functions/lib/gamificationConfig.js` | **Dual-copy** with `src/lib/gamificationConfig.js`; guarded by `src/lib/__tests__/gamificationConfig.cross-check.test.js` (one of a family: `computePoints`, `financingMissPredicates`, `rankingLogic`, `productionReport` also cross-checked) |
| `MDRT_QUALIFIED_API=688800`, `MDRT_PACE_API=344400`, `TENURE_FLOOR_API=500000`, `TENURE_FLOOR_YEARS=5` | `functions/lib/badgeThresholds.js` | **CF-only — no src twin, no cross-check test.** `src/config/mdrtThresholds/2026.js` holds a *different* 688800 (display/projection), unsynced |
| weekly-submission streak badges (`≥4/8/13`) | inline `functions/index.js:1485-1487` | none |

**Runtime read cost.** These live in `onSubmissionWrite` (a Firestore-triggered CF that already runs with Admin SDK). Making them config-driven means a `getDoc` on the tenant config doc *per invocation* (cacheable within a warm instance) instead of a compiled constant — plumbing cost, not a blocker. Cross-check tests would be replaced by a "config-or-default" fallback contract.

**The MDRT collision is three-way** — verified: `688800` (industry qualification, `src/config/mdrtThresholds/2026.js` display) · `688800`+`344400` (CF badge writes, `badgeThresholds.js`) · `500000` (tenant "MDRT Award" recognition tier, `awardsRuleset.mdrtAward.apiThreshold`, already configurable). **Moving these to config does NOT resolve the collision** — it can worsen it if a config panel surfaces all three under "MDRT." Resolution is a **naming** fix (disambiguate "MDRT industry qualification" vs "MDRT Award tier" in keys + UI labels) that should land **before** any of them becomes configurable. Note the industry MDRT figure (688800) is a T&T-premium-method external standard — arguably closer to the CBTT regulatory window (locked/display-only) than to tenant business policy; if promoted at all, it is per-tenant only because tenants might use different qualification bodies, which is a product question (see Open Questions). **What breaks if moved:** the ESM/CJS cross-check safety net must be replaced by a runtime fallback; historical badge qualification could shift on recompute unless the value is effective-dated (D2).

### D4. Rules — write arms needed, and do existing rules read config?

- **Write arms needed for slice-1 grouped docs: NONE.** The `config/{docId}` wildcard (`firestore.rules:630-637`) already grants `tenant_admin`/`platform_admin` write to **any** doc under `config/`, including new `config/targets`, `config/recognition`, etc. The locked design's "new rules arms" are only required if you want **per-document field validation** (the current arm is a blanket allow with no shape checks) — that is a hardening choice, not a prerequisite for consolidation.
- **Do existing rules read config values? NO** — verified: every `get()` in `firestore.rules` targets `/users/…` (role/branch/unit) or `/policies/…`; **no rule reads any `/config/` doc.** Therefore **a config value change is not a rules-behavior change today** — config edits cannot alter auth outcomes. This is a green light for making values tenant-editable without an emulator-rules regression surface (the exception is anything a *future* rule might read, which none do yet).
- **Two surfaces sit outside `/config/`:** per-manager activity overrides (`managerActivityStandardOverrides`, arm `1519-1575`) and user prefs (`users/{uid}/prefs`, arm `1884-1886`). Consolidating the *nav* does not move these; if the design ever wants everything physically under `config/`, that is a data migration + new rules (out of slice-1 scope, and not recommended — the override arm's forgery-prevention is deliberately bespoke).

### D5. Migration required for slice 1?

**None, if slice 1 is a nav/IA re-home over the existing docs.** All four tenant-config docs already live under `config/` (`companyMinimums`, `settings`, `managerActivityStandards`, `awardsRuleset_2026`) and are already governed by one rules arm. Consolidating the admin surface = restructuring `TenantAdminDashboard`'s `config` tab (which **already** stacks `CompanyConfigPanel + ActivityStandardsPanel + AwardsRulesetPanel`, `:376-382`) + adding a feature-flags admin panel over the existing `config/settings.featureFlags` field. **Zero data migration.**

A migration is only incurred if slice 1 **physically regroups** docs into new paths (`companyMinimums → config/targets`, etc.) — which would be a copy-and-cutover with dual-read fallback. **Recommendation: do not regroup paths in slice 1.** Keep existing doc paths; unify only the IA and adopt the accessor contract. Physical regrouping, if ever wanted, is its own migration slice with human-merge discipline (money-adjacent).

---

# PART E — Slice-1 scope proposal (consolidation only)

**Principle:** unify the IA + adopt the awards-ruleset *accessor contract* as canonical. **Promote zero new constants.** No effective-dating, no audit-log build, no CF-read plumbing, no path migration.

### Absorbed into the unified Company Config surface (all tenant_admin, all under `config/`, one rules arm)
1. **Targets & Minimums** — `config/companyMinimums` (existing `CompanyConfigPanel`). *Note the writer gap (B3): `annualApps`/`persistency`/`tenureApiFloors` are read-only defaults today; surfacing them as editable is a constant-promotion → slice 2, not slice 1.*
2. **Activity Standards (tenant defaults)** — `config/managerActivityStandards` (existing `ActivityStandardsPanel`). Per-manager overrides stay in the WAR flow.
3. **Recognition & Awards** — `config/awardsRuleset_{year}` (existing `AwardsRulesetPanel`) — the reference pattern.
4. **Feature Flags** — a **new** thin admin panel over the existing `config/settings.featureFlags` field, restricted to the `flag-toggle.cjs` `ALLOWED_FLAGS` allowlist. This is the one net-new UI in slice 1 (no new *constant* — the flags and their read path already exist).

### Stays where it is (with reason)
- **Per-manager activity overrides** — manager-authored, different collection + bespoke forgery-prevention rules arm (`1519-1575`); belongs in the WAR flow, not tenant config.
- **RANK BY / defaultPeriod (user prefs)** — per-user, owner-only rules arm (`1884-1886`), not tenant business policy. Stays in `SettingsScreen`. **Explicitly excluded.**
- **Kiosk config** — static JS, manager-tier surface, no Firestore. Promoting it to a config doc is a constant-promotion (slice 2+), not consolidation.
- **Financing ruleset** — no override plumbing, drives payout money math, Tatil-contract-specific. Stays code; any promotion is a later slice + human-merge.
- **Points scale / MDRT / streak badges (CF constants)** — dual-copy/CF-read surfaces; promotion needs runtime-read plumbing + effective-dating + the MDRT rename. Slice 2/3, human-merge.

### New IA sections
`Company Config` → **Targets & Minimums** · **Activity Standards** · **Recognition & Awards** · **Feature Flags**. (Same four docs, structured sub-nav instead of a vertical stack.)

### Code that moves vs merely re-homed
- **Moves:** none of the read services or the 25 consumers. Optionally introduce `ConfigProvider` (app-mount hydration, load-once cache mirroring `useFeatureFlag`) + `useConfig(path, default)` (fail-to-code-default contract) as the **forward** read primitive — used by the new Feature Flags panel and any future promotion, **not** a retrofit of existing consumers.
- **Re-homed (nav only):** the three existing admin panels gain structure; a `FeatureFlagsPanel` is added.

### Honest risks
- **Feature-flags UI = new power.** Tenant_admin gaining a flag toggle can flip surfaces that gate unfinished/risky code. **Mitigation:** hard allowlist (reuse `ALLOWED_FLAGS`), and treat the flags panel landing as **human-merge** (new write path to a live-behavior field).
- **"Canonical pattern" ambiguity.** If slice 1 declares the awards pattern canonical without resolving whole-object-vs-diff storage, slices 2/3 inherit a storage model that can't honor "empty-by-default"/effective-dating. **Mitigation:** slice 1 adopts the *accessor contract* explicitly and defers the *storage-model* ruling to a locked decision before the first promotion (Open Questions).
- **Consolidation ≠ promotion drift.** Reviewers/operators may read "unified Company Config" as "everything is now editable." Copy must make clear slice 1 changes *where* the existing four editors live, not *what* is editable.

### What I would NOT do in slice 1 (and why)
- **No constant promotion** — that is explicitly slices 2/3; mixing it in makes the consolidation un-reviewable and money-risky.
- **No effective-dating / audit-log build** — net-new (D2); only ensure the chosen storage shape can accommodate the banked audit-log schema without later migration.
- **No physical doc regrouping / migration** — unnecessary (D5) and money-adjacent.
- **No CF-read plumbing, no MDRT move** — needs the rename + runtime-read + effective-dating first.
- **No rules changes** — the wildcard arm already suffices; adding per-doc validation is optional hardening, not consolidation.
- **No retrofit of the 25 existing consumers to `useConfig`** — broad behavior-equivalence risk with zero user-visible benefit in a nav consolidation.

---

# OPEN QUESTIONS (operator ruling needed before a build brief)

1. **Storage model:** diff-only (honors locked "empty-by-default") vs whole-object (awards pattern as-is) — must be ruled before the pattern is declared canonical.
2. **ConfigProvider timing:** introduce `ConfigProvider`/`useConfig` in slice 1 (forward-only, for the flags panel), or defer entirely until the first constant is promoted and keep slice 1 nav-only?
3. **Feature Flags UI:** expose a tenant_admin flag toggle in Company Config, and if so, confirm the hard allowlist (reuse `flag-toggle.cjs` `ALLOWED_FLAGS`)? (This is the only net-new write path in slice 1 → human-merge.)
4. **MDRT naming:** rename the three "MDRT" figures (industry-qualification 688800 / CF-pace 344400 / tenant-award 500000) to disambiguate **before** any becomes configurable — approve the rename as a precursor?
5. **Industry MDRT classification:** is the 688800 industry-qualification figure tenant business policy at all, or locked/display-only like the CBTT window?
6. **Effective-dating home:** for slice 2/3 dated constants, is the standard a separate as-of envelope, or an extension of the `_{year}` doc-suffix convention?
7. **Activity-standards IA:** keep tenant-default in Company Config while per-manager overrides stay in the WAR flow — acceptable split, or should overrides also surface (read-only) in Company Config?
8. **companyMinimums writer gap:** `annualApps`/`persistency`/`tenureApiFloors` are read-only defaults (not settable via `setCompanyMinimums`) — intentional, or a gap to close (as a slice-2 promotion, not slice 1)?

---

*End of recon. All `file:line` citations verified against `942ab2522c43811f706cbf2ab1881ed84dfe81bf`. Judgment is confined to Part C's verdict and Parts D/E's recommendations; the inventory (Parts A/B) is grep-verified fact.*
