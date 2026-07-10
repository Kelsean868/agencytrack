# Tenant-Config Audit — 2026-07-10

**Type:** Read-only recon. No code changes.
**Scope:** Every tenant-customizable (or should-be-customizable) constant in the app, across `src/` and `functions/`.
**Method:** Full literal grep across both trees (no CBM/graphify reliance for `functions/` — that tree has no reliable structural index per CLAUDE.md). Findings gathered by a dedicated sweep agent, cross-checked against file:line citations below.

**Caveats up front:**
- The taxonomy in §3 was supplied mid-session (not in the original task text); it is used verbatim.
- A few sub-areas hit search-tool result caps (kiosk grep, streak grep, nudge grep) — see "Known gaps" at the end of each relevant section. Where a cap was hit, the live implementation directories were read in full regardless, so the conclusions are believed complete even where the raw grep list is truncated.
- This is inventory, not a design proposal. No recommendation is made here about which gaps are worth closing before pilot vs. post-pilot — that's a follow-up brief decision.

---

## 1. Existing tenant config reads

### 1.1 `tenants/{tenantId}/config/settings` — feature flags
| Field | Consumer | file:line | Purpose |
|---|---|---|---|
| `featureFlags` (map) | `getFeatureFlags()` | `src/services/featureFlagsService.js:42-56` | Fetch raw flags map; fails closed to `{}` on any error or absent doc |
| `featureFlags.<key>` | `isFlagOn(flags, key)` | `src/services/featureFlagsService.js:59-61` | Strict `=== true` gate |
| — | `useFeatureFlag` hook | `src/hooks/useFeatureFlag.js:14` | React hook wrapper |
| — | ops scripts | `scripts/staging/seed-fixtures.mjs:682-685`, `scripts/verification/vh/flag-toggle.cjs:66-67` | Merge `featureFlags` onto this doc directly |

Known flag keys in active use (`FEATURE_FLAG_KEYS`, `featureFlagsService.js:29-33`): `persistencyV2`, `policyLedgerCampaignLens`, `awardsProvenance`.

### 1.2 `tenants/{tenantId}/config/companyMinimums` — heaviest-used surface
| Field | Default | file:line | Purpose |
|---|---|---|---|
| `annualAPI` | 200000 | `src/services/goalsService.js:56-73` | Company floor, annual API |
| `annualApps` | 42 | same | Company floor, annual apps |
| `persistency` | 90 | same | Company persistency floor (0-100 scale) |
| `weeklyActivityFloors.*` | `DEFAULT_WEEKLY_ACTIVITY_FLOORS` | `goalsService.js:64-67` | Per-metric weekly floors, shallow-merged over defaults |
| `tenureApiFloors.*` (band0_lt12 … band_gt60) | `DEFAULT_TENURE_API_FLOORS` (`src/utils/tenureFloors.js:16-24`) | `goalsService.js:68-71` | Tenure-banded annual API floor table, shallow-merged |
| `workingDaysPerWeek` | — | `goalsService.js:120-126` | Validated to 5 or 6 |
| write path | — | `setCompanyMinimums(tenantId, data, updatedBy)`, `goalsService.js:88-130` | Tenant-admin write surface (Company Config panel, B5) |

Read-site fan-out (post-fetch consumers): `AgentDashboard.jsx:122,347-370,870` · `useMyProduction.js:22,111` · `useBranchOverview.js:188` · `ManagerDashboard.jsx:445,670,704` (note: `?? 90` and `?? 4800` fallback literals duplicate the service defaults at the call site) · `utils/managerExceptions.js:12,55` · `TeamPlannerPanel.jsx:92` · `planReviewService.js:99` · `MasterSheet.jsx:269` (comment notes it is **not** fetched there — a design gap flagged in-code) · `BulkImportGoalsModal.jsx:27,198` · `goalsImportService.js:207,234,402`.

### 1.3 `managerActivityStandardOverrides` — per-manager override doc
Path: `tenants/{tenantId}/managerActivityStandardOverrides/{managerId}`.
| Consumer | file:line |
|---|---|
| get/set/delete | `src/services/managerStandardOverrideService.js:32,43,57` |
| escalation computation (CF) | `functions/war/onWarSubmitNotifyUpline.js:48` |
| escalation param doc (CF) | `functions/war/escalationLogic.js:32` |
| rules | `firestore.rules:1505-1512` (top-level collection match) |

**Open item found in the sweep, not resolved:** `docs/AgencyTrack_TrackI_Remaining_PrepNotes.md:126` flags an unresolved question about whether the sibling *org-default* doc (`config/managerActivityStandards`, no `Overrides` suffix — the doc this override falls back to) needs new keys for monthly fields. Its full read-site list was not enumerated in this pass (out of the literal search terms given) — flag as a narrow follow-up grep if §5 (Activity Standards) work is scoped.

### 1.4 Kiosk config — **no Firestore doc; static JS module only**
- `src/lib/kiosk/kioskConfig.js:1-18` — `PANEL_DURATIONS` (per-panel seconds; 15 panels, 15–45s each, ~410s total base cycle)
- `kioskConfig.js:41-55` — `PANEL_ORDER` (fixed array; dynamic panels spliced in code)
- `kioskConfig.js:57` — `POLL_INTERVAL_MS = 5 * 60 * 1000`
- `kioskConfig.js:61-63` — `VALIDATE_TOKEN_URL` (env-var driven, not Firestore)
- Consumers: `src/lib/kiosk/kioskRotation.js`, `src/components/kiosk/KioskShell.jsx`, `src/components/kiosk/KioskModeTab.jsx:9` (read-only display of the panel config)

A separate Firestore-backed `kioskTokens/{...}` doc exists (`docs/fable-vh-run-progress.md:48`, `tests/rules/kioskBranchScope.rules.test.mjs`) but that's auth/branch-scope, not rotation timing.

### 1.5 Awards ruleset — the one gamification-adjacent surface that already has full override plumbing (bonus finding)
`tenants/{tenantId}/config/awardsRuleset_{year}`:
- Default: `src/config/awardsRuleset/2026.js` (`DEFAULT_RULESET_2026`, full tier catalog: advisorMonth, quarterlyAward, persistencyAward, rookieAward, newBsAward, centurionAward, agentOfYearAward, mdrtAward, clubAward ×5 tiers, managerMonthlyBonus, recruitingAwards, activityAwards, managerProductionAward, managerPersistencyAward, unitOfYearAward, agencyOfYearAward)
- Service: `src/services/awardsRulesetService.js:6-8` (get), `:47-56` (`getMergedAwardsRuleset` — deep-merge over defaults), `:92-104` (set)
- Admin UI: `src/components/admin/AwardsRulesetPanel.jsx`
- Consumers: `src/utils/awardsEngine.js:50,337`, `AgentDashboard.jsx`, `ManagerAwardsPanel.jsx`, `MoneyNeedsAllocator.jsx`, `AwardsReachPanel.jsx`, `useMyProduction.js`

This is the reference pattern any new config surface below should copy — proof it's cheap to replicate since it exists once already.

---

## 2. Hardcoded tenant-shaped constants

### 2.1 Gamification points/scoring
| Constant | Value | Defined | Consumed | CF? |
|---|---|---|---|---|
| `POINTS_WEIGHTS` (19 activity keys) | dials=1, prospectingLettersSent=1, referralsObtained=3, otherNewNames=1, seminarsConducted=10, tradeshowsAttended=5, f2fAttempts=2, appointmentsSet=3, ffiConducted=5, ciConducted=10, applicationsSold=25, apiPerThousand=1, serviceCalls=1, policiesDelivered=3, premiumCollectionMeetings=3, annualReviews=5, orphanReviews=5, orphansAdopted=8, reinstatementsSubmitted=10, reinstatedApiPerThousand=1, policyChanges=1 | `src/lib/gamificationConfig.js:8-34` (ESM) **and** `functions/lib/gamificationConfig.js:10-36` (CJS twin, hand-synced) | `src/lib/computePoints.js:44-67`, `functions/lib/computePoints.js:42-65` | **Yes — dual-copy, no drift guard beyond a CI cross-check test** |
| `LEVEL_THRESHOLDS` | Rookie@0, Associate@500, Pro@1500, Elite@3500, Legend@7000 | `gamificationConfig.js:36-43` (both) | `resolveLevel()` in both | Yes — commented "provisional, tune against pilot data" |
| `BADGE_DEFINITIONS` metadata | 10 badges, labels/descriptions/triggers | `gamificationConfig.js:45-58` (both) | badge display | Yes (badge keys drive CF logic below) |

### 2.2 Streak / milestone thresholds
| Constant | Value | file:line | CF? |
|---|---|---|---|
| Weekly-submission streak badges | streak_4 ≥4, streak_8 ≥8, streak_13 ≥13 (consecutive weeks) | Inline in CF, **not** in gamificationConfig — `functions/index.js:1485-1487`; labels only in `functions/lib/gamificationConfig.js:49-51` | **Yes** — server-authoritative, redeploy required |
| `DAILY_STREAK_MILESTONES` | `[5, 10, 20]` consecutive logged days | `src/lib/celebrations.js:27` | No — frontend celebration toast only |
| `GOALS_WEEKLY_STREAK_MILESTONES` | `[4, 8, 12]` consecutive weeks clearing weekly API target | `src/lib/celebrations.js:31` | No |

### 2.3 MDRT — two distinct hardcoded figures, naming collision risk
1. **Real industry MDRT (T&T premium method) — not tenant-configurable, manually duplicated across src/functions:**
   - `MDRT_THRESHOLDS_2026.mdrt = 688_800`, `.cot = 2_066_400`, `.tot = 4_132_800` — `src/config/mdrtThresholds/2026.js:4-8`
   - `MDRT_QUALIFIED_API: 688_800` — `functions/lib/badgeThresholds.js:17` **(CF)**
   - **`MDRT_PACE_API: 344_400`** — `functions/lib/badgeThresholds.js:23` **(CF)** — the exact figure the task asked about
   - `TENURE_FLOOR_API: 500_000`, `TENURE_FLOOR_YEARS: 5` — `functions/lib/badgeThresholds.js:29-30` **(CF)**
   - File's own comment (`badgeThresholds.js:7-12`) flags this as a known duplication risk: `functions/` can't import from `src/`, so an annual MDRT bump requires hand-editing both files with **no CI drift-guard** (unlike `gamificationConfig`'s cross-check test).
   - Consumed: `functions/index.js:1523-1541` (badge writes), `AwardProjectionStrip` component/test.
2. **Tenant's own "MDRT Award" recognition tier — IS tenant-configurable** via `config/awardsRuleset_{year}` (`mdrtAward.apiThreshold: 500000`, `src/config/awardsRuleset/2026.js:80-84`). Different, lower number than #1, same "MDRT" name. **Naming-collision risk**, not a config gap — flagging for clarity, not remediation.

### 2.4 Award/recognition thresholds
Everything in `DEFAULT_RULESET_2026` (§1.5) is already tenant-configurable via the awards ruleset override. **Not a gap** — listed here only because the task named it explicitly.

### 2.5 Financing ruleset — claims to be configurable, isn't
`src/config/financingRuleset/2026.js:13-40` (`DEFAULT_FINANCING_RULESET_2026`): `quarterlyGrossMin: 37500`, `persistencyY1: 0.95`, `persistencyY2: 0.90`, `consistencyRate: 0.15`, `productionRateY1: 0.15`, `productionRateY2: 0.20`, `creditMap` (nb_ordinary 1.0, inc_ppp 0.10, lumpsum 0.10, platinum_edge 0, etc.).

File header comment claims these are "seeded here as configurable ruleset values — the engine never hardcodes them" — **but no Firestore override doc, service, or admin panel exists.** Grep for `financingRuleset_`, `getMergedFinancingRuleset`, `config/financingRuleset` returned **zero hits**. Every consumer (`financingProjectedBonus.js:21`, `financingBonusEngine.js:16`, `financingTakeHome.js:15`, `financingReconciliation.js:30`) imports the default directly. May be intentionally Tatil-contract-specific (derives from "New Salesperson's Bonus and Financing Agreement"), but as written it is **not actually tenant-configurable** despite its own comment's claim.

### 2.6 Tenure bands
`DEFAULT_TENURE_API_FLOORS` (`src/utils/tenureFloors.js:16-24`): band0_lt12=150000, band12_to_24=200000, band25_to_36=250000, band37_to_48=300000, band49_to_60=400000, band_gt60=500000; `FLAT_ANNUAL_API_FALLBACK=200000`, `FLAT_WEEKLY_API_FALLBACK=4800`. **Already tenant-configurable** per §1.2 (`companyMinimums.tenureApiFloors`), seeded via `scripts/seed/seed-tenure-api-floors.mjs`. Listed for completeness only — the taxonomy's ask for "editable bands, not just values" is the real gap here (see §3.3).

### 2.7 CBTT license-conversion compliance window (regulatory, likely not tenant policy)
`src/utils/cbttCompliance.js:22` — provisional-license deadline = 12 months (24 if `cbttExtensionGranted`); `:34` — `atRisk: daysRemaining <= 90`. Hardcoded, no config surface. Flagged for completeness; likely a Central Bank of T&T regulatory requirement rather than tenant business policy — probably belongs in "locked/display-only," not the configurable set.

### 2.8 Clawback window + delivery at-risk bands
`src/utils/clawbackClock.js:22-23` — `CLAWBACK_DAYS = 30`, `AT_RISK_DAYS = 7`. Hardcoded, frontend-only display derivation (never persisted, per the file's own header comment), no config surface. Matches the task's "30-day clawback" and "delivery at-risk day bands" ask directly. Note: the taxonomy's §10 cites 26d/40d delivery bands — those figures were **not found** in this codebase pass under `clawbackClock.js` or elsewhere searched; either they live in a file this sweep didn't hit, or they're aspirational/from a different doc. Flag as unverified — do not treat the 26d/40d figures as confirmed-hardcoded until grep-confirmed.

### 2.9 Persistency warning threshold — second, different hardcoded floor
`src/components/manager/PersistencyTab.jsx:170`, `src/components/manager/PersAtRiskBook.jsx:12,25,41` hardcode **0.80 / 80%** as the "at-risk book" floor — distinct from and lower than `companyMinimums.persistency` (default 90, tenant-configurable per §1.2). **Drift risk:** a tenant raising their configurable persistency floor above 80 would still see the at-risk book use a stale, unrelated 80% cutoff. The taxonomy's §3 "pace-warning threshold % (currently 20%)" was not independently located under this exact figure in this pass — the 80%/90% pair above is the persistency-specific warning threshold actually found; reconcile against whichever specific 20% figure the taxonomy author had in mind (possibly a different metric's pace warning) before scoping remediation.

### 2.10 Nudge/reminder schedules (CF-side cron, no config surface)
All hardcoded UTC cron strings in `functions/index.js`, `.timeZone('UTC')`-chained per the CLAUDE.md DST-safety pattern:
- `sendSundayNudge`: `'0 22 * * 0'` (Sun 22:00 UTC = 6 PM Trinidad) — `functions/index.js:1200-1201`
- `sendMondayNudge`: `'0 11 * * 1'` (Mon 11:00 UTC = 7 AM Trinidad) — `functions/index.js:1238-1239`
- `flagMissedDeadlines`: `'1 13 * * 1'` (Mon 13:01 UTC = 9:01 AM Trinidad) — `functions/index.js:1276-1277`
- `leaderboardAggregate` hourly recompute: `'0 * * * *'` — `functions/leaderboard/leaderboardAggregate.js:439`
- `sundayDailyToWeekly`: `'0 3 * * 1'` (Mon 03:00 UTC = Sun 23:00 Trinidad) — `functions/aggregators/sundayDailyToWeekly.js:149`

All CF-side, redeploy required to change. The submission deadline itself (Monday 9:00 AM Trinidad) is also hardcoded in notification copy text (`functions/index.js:1213-1214,1251-1252`), not derived from a config value — a tenant with a different deadline day/time would need code changes to both the cron schedule and the notification copy.

### 2.11 Grace period
No implemented grace-period logic found anywhere in `src/` or `functions/`. Only hit: a design-question annotation in a mockup, `docs/design/compliance-v2-s1.html:366` — "On-time deadline definition... Grace period? Drives every on-time/late split + streak." This is an open product question, not a shipped constant — a true gap (nothing to make configurable yet; the feature itself doesn't exist).

### 2.12 Career levels
No construct distinct from the gamification `LEVEL_THRESHOLDS` (§2.1) was found. `src/utils/careerLevelHelpers.js` contains only `compute2YearAverageAPI()` (a trailing-average calc, not level thresholds). Files with "career level" in the name (`CareerPortal.jsx`, `BulkImportUsersModal.jsx`, `userImportService.js`, `exportService.js`, `agentReportPdfModel.js`) all appear to consume the same gamification level table, not a separate one. **The taxonomy's §2 "career level names + thresholds (currently hardcoded 1-10)" was not found in this form** — the actual hardcoded level table is the 5-level Rookie→Legend scale in §2.1, not a 1-10 numeric scale. Flag as a possible naming mismatch between the taxonomy author's mental model and current code — reconcile before scoping remediation (may be a planned-but-unbuilt feature, or the taxonomy may be describing a different, not-yet-found table).

---

## 3. Gap map against the 12-group taxonomy

| # | Group | What exists | What's hardcoded (gap) | What doesn't exist at all |
|---|---|---|---|---|
| 1 | Identity & Branding | Nothing found — no tenant name/logo/accent-color config surface located in this pass | — | Company name, logo (light/dark), accent color, PDF header/footer branding, locale block (currency/date-format/week-start/timezone) — **no Firestore doc or admin UI found for any of these**. Locale values (TTD currency, Sunday week-start, UTC-4) are structural assumptions baked into `formatters.js`/`validators.js`/cron, not read from config anywhere. |
| 2 | Organization Structure | Branch/unit management UI exists (Track C); role display labels exist in code | Career level names/thresholds — **found as the 5-level Rookie→Legend gamification scale (§2.1), not the "1-10" scale the taxonomy describes** — reconcile which is meant | Agent number format — no config surface found |
| 3 | Targets & Minimums | `companyMinimums` (§1.2) — annualAPI, annualApps, persistency, weeklyActivityFloors, tenureApiFloors are all tenant-writable *values* | Tenure bands are configurable in **value** but not in **band boundaries** (the 6 band cutoffs 12/24/36/48/60mo are fixed in `tenureFloors.js`, only the $ value per band is overridable) · MDRT/COT/TOT thresholds (§2.3) are fully hardcoded, dual-copied src+CF, no override · pace-warning % — **the specific 20% figure named in the taxonomy was not located in this pass**; nearest match found was the unrelated 80%/90% persistency-warning pair (§2.9) | — |
| 4 | Reporting Cadence & Compliance | None found | Submission deadline (Mon 9AM Trinidad) hardcoded in cron + copy text (§2.10) · Sunday/Monday nudge times hardcoded, no on/off toggle · missed-deadline flagging logic hardcoded | Grace period (§2.11 — feature doesn't exist yet) · WAR requirement by role — not found as a config surface (Track I built the WAR feature itself; per-role requirement toggle not located) · WAR review workflow on/off — not found · Daily Capture default mode + manager-override policy — not located in this pass (may exist under a name not searched; flag as follow-up grep target) |
| 5 | Activity Standards | `managerActivityStandardOverrides` (§1.3) — full per-manager override plumbing exists | — | Tenant-level *default* activity floors doc (`config/managerActivityStandards`, the org-default the override falls back to) — read-site list not enumerated in this pass (§1.3 open item); existence of the doc itself is implied by the override's fallback semantics but not directly confirmed here |
| 6 | Recognition & Gamification | Awards ruleset (§1.5) has full override plumbing | Points scale per activity (§2.1, `POINTS_WEIGHTS`) — fully hardcoded, dual-copied, no override · streak milestone thresholds (§2.2) — fully hardcoded (badge streaks doubly so, since they're not even in the shared config module) · leaderboard visibility scope — not confirmed configurable in this pass | Badges on/off toggle — not found · celebration intensity — not found as a tunable, only fixed milestone arrays |
| 7 | Awards & Clubs | Fully covered by awards ruleset override (§1.5, §2.4) — award catalog thresholds/names/tiers are tenant-writable | — | Active/inactive toggle per award — the ruleset stores threshold values; whether an "enabled: false" flag is respected per-award was not confirmed in this pass (worth a targeted grep on `awardsRuleset` schema if this granularity matters) |
| 8 | Financing | Ruleset module exists with a "configurable" comment (§2.5) | Full `DEFAULT_FINANCING_RULESET_2026` (at-risk criteria, adjustment %, waiver/term parameters) is **100% hardcoded despite its own comment claiming otherwise** — zero override plumbing found | Escalation routing config — not found as tenant-configurable |
| 9 | Kiosk | Static config module (§1.4) — no persistence layer | Panel durations, panel order, poll interval — all hardcoded in `kioskConfig.js` | Per-slide enable/disable — not found · theatrical mode — not found · celebration splicing config — not found (splicing logic exists in code per the sweep, but no on/off or timing config for it) |
| 10 | Policy & Delivery | Clawback clock exists as a display-only derivation (§2.8) | Clawback window (30d), at-risk band (7d) hardcoded, frontend-only, never persisted | The taxonomy's 26d/40d delivery-overdue bands were **not found anywhere in this pass** — either mislocated by this sweep or not yet implemented; do not treat as confirmed until re-verified · CRO role enabled per tenant — not found as a config toggle |
| 11 | Feature Flags | `config/settings.featureFlags` (§1.1) — real, working, fail-closed pattern already in production use for 3 flags | — | Formalized admin panel for flag management — 2 ops scripts merge flags directly via script, not a UI; no `FeatureFlagsPanel.jsx`-equivalent found |
| 12 | Data & Privacy | Test-account flagging exists (`isTestAccount`, documented in CLAUDE.md, `scripts/maintenance/flag-test-accounts.mjs`) — this is the closest match found | — | Retention notes / policy — not found as a config surface · export permissions by role — not confirmed as tenant-configurable (role-gating likely exists in fixed code, not as a tenant toggle) |

**Explicitly out of scope per the taxonomy's own carve-out** (not audited for configurability, listed for completeness): payout-release logic, rules-enforced validation shapes, tenantId/auth mechanics, date storage format (`YYYY-MM-DD` internal storage stays fixed regardless of any display-format config in group 1).

---

## 4. Risk notes

### 4.1 Constants whose runtime-configurability would touch rules or CF behavior (needs emulator tests / careful contract)
- **`POINTS_WEIGHTS` / `LEVEL_THRESHOLDS` (§2.1).** Currently dual-copied ESM (`src/lib/gamificationConfig.js`) + CJS (`functions/lib/gamificationConfig.js`), synced only by a CI cross-check test, not a shared source. Making these tenant-configurable means the CF copy must read from Firestore at invocation time (not at deploy time) — this is a genuine runtime-config plumbing cost, not just moving a constant into a doc. Any point-value change also silently reshapes historical leaderboard math if not versioned per submission-week; needs a "what point scale applied when" contract before this is safe to expose to tenant admins.
- **MDRT thresholds (§2.3).** Same dual-copy problem as above, but higher stakes: `MDRT_PACE_API` (344,400) and `MDRT_QUALIFIED_API` (688,800) drive CF badge-writing logic (`functions/index.js:1523-1541`). These also have a **naming collision** with the tenant-configurable `awardsRuleset.mdrtAward.apiThreshold` (500,000) — two different numbers both called "MDRT" in different subsystems. Any config UI exposing "MDRT" must disambiguate which one it's editing, or tenant admins will edit the wrong threshold expecting it to change badge-qualification math.
- **Streak badges (§2.2, `functions/index.js:1485-1487`).** Server-authoritative, inline in CF, not even in the shared config module — lowest-effort item to move into config-driven CF logic (no dual-copy problem to solve first, unlike points/MDRT) but still requires a runtime Firestore read inside the CF instead of a compiled constant.
- **Financing ruleset (§2.5).** Zero existing override plumbing despite the code's own comment claiming configurability. If tenant-configurability is wanted here, it's greenfield work, not a wire-up of existing partial plumbing — budget accordingly. Also: this ruleset directly drives bonus/payout money math (`financingBonusEngine.js`, `financingTakeHome.js`) — per the taxonomy's own carve-out, "payout-release logic... stays code." Recommend treating financing *ruleset inputs* (thresholds, rates) as a candidate for configurability while keeping the *release/reconciliation logic* itself fixed — the same split already applied to companyMinimums (values configurable, floor-application logic fixed).
- **Nudge cron schedules (§2.10).** Any config-driven schedule change requires either (a) rewriting Cloud Scheduler triggers at deploy time from a config source (deploy-time, not runtime, plumbing — different cost profile than a runtime Firestore read), or (b) keeping the cron fixed and gating the *notification send* behind a runtime config check (cheaper, but the cron still fires on a fixed schedule even for tenants who've disabled/changed the nudge). Recommend the latter if this is prioritized — matches the existing `featureFlags` fail-closed pattern.

### 4.2 Constants that should likely stay code (not flagged as gaps needing remediation)
- **CBTT compliance window (§2.7)** — appears to be a Trinidad regulatory requirement (Central Bank of T&T license conversion), not tenant business policy. Making this "configurable" risks a tenant accidentally misconfiguring a regulatory deadline.
- **Date storage format** — per the taxonomy's own carve-out, internal `YYYY-MM-DD` storage stays fixed; only *display* format is a group-1 candidate.
- **Clawback/at-risk day-count derivation logic (§2.8)** — the *values* (30d, 7d) are reasonable configurability candidates; the derivation logic itself (never-persisted, frontend-only display calc) is low-risk to leave as code, since it's not authoritative data.

### 4.3 Unresolved / needs re-verification before acting on this audit
These items surfaced discrepancies between the taxonomy's description and what this grep pass actually found. Do not treat them as confirmed gaps or confirmed non-issues until re-checked — flagging per the falsification-before-banking discipline:
1. **§3.3 "pace-warning threshold % (currently 20%)"** — not located; nearest match was an unrelated 80%/90% persistency pair (§2.9).
2. **§3.10 "delivery at-risk/overdue day bands (26d/40d)"** — not located anywhere in `src/` or `functions/` in this pass; only the clawback clock's 30d/7d pair (§2.8) was found under adjacent logic.
3. **§3.2 "career level names + thresholds (currently hardcoded 1-10)"** — not located as a 1-10 scale; the actual hardcoded scale found is the 5-level Rookie→Legend gamification table (§2.1). Possible the taxonomy is describing a different, unbuilt, or differently-named feature.
4. **§3.5 tenant-level default activity-standards doc** (`config/managerActivityStandards`, non-override) — existence inferred from the override doc's fallback semantics but its own read-sites were not directly enumerated (out of the literal search terms given to the sweep).
5. **Kiosk grep (§1.4)** hit the tool's 250-result cap, dominated by historical `docs/design-system/screens-v2/` mockup files. The live implementation directories (`src/lib/kiosk/`, `src/components/kiosk/`) were read in full and are believed to be the complete authoritative surface, but a narrower `src/`-only grep would close this gap with certainty if precision matters before scoping remediation work.

**Recommended next step (not part of this task, noted for the record):** before drafting any remediation brief off this audit, re-run targeted greps for items 1-3 above against the taxonomy author's original source (if the 20%/26d/40d/1-10 figures came from a different doc, mockup, or conversation not visible to this sweep) to reconcile which figures are real-and-missed vs. aspirational-and-unbuilt.
