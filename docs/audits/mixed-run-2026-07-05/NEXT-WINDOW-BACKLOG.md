# NEXT-WINDOW-BACKLOG (2026-07-05)

**Executive summary — the single highest-value next-window item:** **EFF-002 Phase 2 paired with a Rollup `manualChunks` vendor-grouping config** (Section 1). Phase 1 (dashboard lazy-split) already shipped in PR #804 and cut the entry chunk 65.6%, but the manager still downloads a ~96 kB gzip `ManagerDashboard` chunk containing all ~30 tab panels. Phase 2 was built and proven to slim that base chunk to ~14.68 kB gzip, but was reverted because naive per-panel `lazy()` fans shared `lucide-react` icons (146 importers) and `firebase` into 36–50 tiny chunks. A `manualChunks` config that pins `lucide-react`, `recharts`, and the `firebase` SDK into a few stable named vendor chunks is the missing build-config decision that makes Phase 2 land cleanly. It is frontend-only, has a committed adversarial smoke already walking every manager tab, and is the last big bundle win before the remaining backlog turns to owner-owned functions/rules work. It needs one dispatcher decision (approve the `manualChunks` shape) and is otherwise ready to brief.

---

## Section 1 — EFF-002 Phase 2: a concrete Rollup `manualChunks` strategy

**Ready to brief:** A concrete `build.rollupOptions.output.manualChunks` config that groups `lucide-react`, `recharts`, and `firebase` into three stable named vendor chunks, paired with lazy-splitting the ~16 heavy `ManagerDashboard` tab panels at their existing `activeTab ===` conditional mounts. This is a PLAN ONLY.

### Current build config (verified)
`vite.config.js` has **no `build` key at all** — no `rollupOptions`, no `manualChunks`. Rollup is doing 100% automatic chunking today. Phase 2 must introduce a `build.rollupOptions.output.manualChunks` block (the "new build-config pattern" Methodology Rule 1 required be surfaced).

Heavy-dependency reality (verified):
- `lucide-react ^1.12.0` — imported by **146 files** (the tiny-chunk culprit).
- `recharts ^3.8.1` — imported by exactly **3 files**: `KPICard.jsx:1`, `PersistencyTab.jsx`, `CommissionPlayground/components/CashFlowChart.jsx`.
- `firebase ^12.12.1` — Rollup shuffled it into an "always-loaded sibling" (~142 kB gzip) during the reverted experiment.
- `@react-pdf/renderer ^4.5.1` — already isolated (EFF-011, #802). Do NOT touch.

### Proposed `manualChunks` config (design only)
```js
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (!id.includes('node_modules')) return
        if (id.includes('lucide-react'))  return 'vendor-icons'
        if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts'
        if (id.includes('/firebase/') || id.includes('@firebase/')) return 'vendor-firebase'
        if (id.includes('@react-pdf') || id.includes('/yoga-layout') || id.includes('/fontkit')) return 'vendor-pdf'
        return 'vendor'
      },
    },
  },
  chunkSizeWarningLimit: 700,
},
```
Rationale: `vendor-icons` is the load-bearing fix (146 lucide importers fragment under per-panel lazy). `vendor-charts` keeps recharts+D3 cohesive & shared. `vendor-firebase` stops the always-loaded-sibling pathology. `vendor-pdf` keeps EFF-011's split cohesive. App code returns nothing → flows into per-tab lazy chunks. Function form required (substring matching on d3/firebase submodules).

### Manager tab panels worth lazy-splitting (~16)
MasterSheet, TeamPerfRosterPage, CompliancePanel, PersistencyTab (recharts), SettlementPanel, FinancingTab, CampaignPanel, UserManagementPanel, ManagerAwardsPanel, ProductionReportTab, GoalsPanel, KioskModeTab, AgentOfMonthTab, PolicyReconciliationPanel, ManagerWarTab/TeamWarsTab/MonthlyRecruitingTab (trio), CommissionPlayground (recharts). Render switch ~ManagerDashboard.jsx:450–631.
**Stay EAGER:** ManagerOverviewTab (default), Shell, full-screen early-returns (WizardForm/MeetingMode/DailyCaptureV2), KPICard (recharts sparkline — only EFF-013 removes it).

### Falsification
Ships as-is (no pairing) if tiny-chunk count is a non-issue on Vercel HTTP/2 edge. Pairing validated if manualChunks+split yields clean topology with the manager-base reduction preserved. Companion: EFF-013 (inline-SVG KPICard sparkline) removes recharts from both dashboards' critical path.

---

## Section 2 — Triage the remaining efficiency findings

| ID | Finding | Current anchor | Lane | Effort | Fix shape |
|---|---|---|---|---|---|
| EFF-003 | AgentDashboard 1 tenant scan per active campaign on mount | `AgentDashboard.jsx:354–356`; `campaignService.js:141` (no limit) | needs-decision | M | Frontend: dedupe to one min/max window query. Durable: CF `campaignProgress/{id}` aggregate (new collection). |
| EFF-008 | CompliancePanel per-agent getWeeklyPlan fan-out re-fires on week/lens change | `CompliancePanel.jsx:199–200` (dep selectedWeek); nudge `:230` | needs-decision | M | Frontend: `(week,rosterKey)` cache. Durable: collection-group + composite index. |
| EFF-010 | Leaderboard reads entire users collection for photoURL map | `Leaderboard.jsx:95` → keeps only photoURL `:102` | frontend-auto-mergeable | M | Client: share one getTenantUsers via context cache. (Fuller arm denormalizes photoURL onto leaderboards doc = functions.) |
| EFF-012 | MasterSheet unvirtualized N×26 table | `MasterSheet.jsx:374`→`:380` | frontend-auto-mergeable | M | Virtualize (`@tanstack/react-virtual`) or paginate. Dep-add flag; pagination arm needs no dep. |
| EFF-014 | TeamPerfRoster full rows twice (table+cards) | `TeamPerfRoster.jsx:359`→`:363`, `:394` | frontend-auto-mergeable | M | Same as EFF-012; render only active-viewport layout. Pair them. |
| EFF-016 | Unbounded whole-collection reads, no limit | `managerService.js:59` getAllYTDSubmissions; `campaignService.js:15` getCampaigns | frontend-auto-mergeable | M | Add limit/pagination on client queries; combine with EFF-010 cache. |
| EFF-017 | notifyCampaignParticipants 1 write per recipient | `campaignService.js:112–118`, `:130–138` | frontend-auto-mergeable | S | `writeBatch` (≤500 ops) on existing notifications write path. Cleanest quick win. |
| EFF-006 | Leaderboard cron full-tenant hourly regardless of activity | `leaderboardAggregate.js:439` schedule, `loadInputs:56` | functions-held | M | Business-hours cadence or dirty-flag gate; proper = event-driven debounce. Human-merge + deploy. |

Notes: EFF-012/014 virtualization arm adds `@tanstack/react-virtual` (flag dep-add; pagination fallback is channel-eligible). EFF-003/008 straddle lane boundary (frontend arm auto-mergeable; server arm needs decision).

---

## Section 3 — Still-open UX audit + security-delta items

SEC-012 shipped (#801). Entire pre-existing security backlog still OPEN (SEC-001..011, all PRIV — none remediated since 07-04; `vercel.json` still no headers, `src/firebase.js` still no App Check). A11Y-101/102 (wizard + Daily-Capture modal focus mgmt) remain OPEN (only `aria-modal="true"`, no Escape/trap/focus). `docs/audits/landing/` = screenshots only.

| Item | Severity | Surface | Merge lane | Status |
|---|---|---|---|---|
| SEC-012 kiosk branch-scope | High | functions/rules | human-merge+deploy | RESOLVED #801 `3d7c391e` |
| SEC-001 setUserClaims arbitrary claims escalation | High | functions index.js:456–472 | human-merge+deploy | OPEN |
| SEC-002 AoM CFs not branch-scoped for BM | High | functions agentOfMonth/* | human-merge+deploy | OPEN |
| SEC-003 kiosk create/revoke token CF not branch-scoped (1yr TTL) | High | functions kiosk/createToken.js:28 | human-merge+deploy | OPEN |
| SEC-004/COST-001 App Check not enforced | High | mixed (src/firebase.js + Console) | human-merge+deploy | OPEN (no initializeAppCheck) |
| SEC-005 Dep CVEs (admin v12→13, functions v4→6) | High | functions+root deps | human-merge+deploy | OPEN |
| SEC-006 storage.rules absent | Medium | rules/config | human-merge+deploy | OPEN |
| SEC-007 No CSP/security headers | Medium | frontend vercel.json | frontend-auto-mergeable (Report-Only first) | OPEN |
| SEC-008 validateKioskToken public, CORS *, no rate limit | Medium | functions kiosk/validateToken.js | human-merge+deploy | OPEN |
| SEC-009 CI omits rules test & dep scan | Medium | CI config | human-merge (infra) | OPEN |
| SEC-010 WAR/notify build paths from body tenantId (not reachable) | Low | functions | human-merge+deploy | OPEN |
| SEC-011 Leaderboard callable leaks err.message; unvalidated tenantId segment | Medium | functions leaderboardAggregate.js:490 | human-merge+deploy | OPEN |
| PRIV-002 No right-to-erasure/cascade delete | High | functions+rules | human-merge+deploy | OPEN |
| PRIV-003 No DSAR export | High | frontend exportService.js | needs-decision | OPEN |
| PRIV-004 No retention/TTL | High* | functions/config | human-merge+deploy | OPEN |
| PRIV-005 No read-access audit trail | High* | functions | human-merge+deploy | OPEN |
| PRIV-006 No consent capture for 3rd-party PII | High | mixed | needs-decision | OPEN |
| PRIV-001/007/009/010/011 RoPA, residency, PA access log, breach alerting, Clarity DPA | Medium* | mixed/ops/Console | needs-decision | OPEN |
| ARCH-001 Hardcoded TENANT_ID='tatillife_south' in crons | Medium | functions index.js:49 | human-merge+deploy | OPEN |
| ARCH-002 Inline styles; rgba HistoryTab.jsx:328 | Low | frontend | frontend-auto-mergeable | OPEN |
| BUG-101 wizard typable before draft | High | frontend | — | RESOLVED #794 |
| BUG-102 week number disagree | Medium | frontend | — | RESOLVED #796 (functions weekOfYear FU) |
| BUG-103 day strip wraps 7th pill | Low | frontend | — | RESOLVED #797 |
| UX-001 bare empty state MasterSheet | Low | frontend | — | RESOLVED #799 |
| UX-101 topbar static "Dashboard" | Low | frontend | — | RESOLVED agents #798 (manager/admin FU) |
| A11Y-001 no h1 on 33/36 screens | Medium | frontend | — | RESOLVED central #798 (h1→h2 sweep FU) |
| A11Y-103 skip-to-content absent | Low | frontend | — | RESOLVED #798 |
| A11Y-002 login ignores dark pref | Low | frontend | — | RESOLVED (falsified — '1' key) |
| A11Y-003 share control sub-24px | Medium | frontend | — | RESOLVED (falsified — 44px label wrapper) |
| A11Y-101 wizard modal no focus mgmt | Medium | frontend WizardForm.jsx:527 | frontend-auto-mergeable (M, shared useModalFocus) | OPEN |
| A11Y-102 Daily Capture takeover same gaps | Medium | frontend DailyCaptureV2.jsx:690 | frontend-auto-mergeable (share hook) | OPEN |
| A11Y-005 sub-44px controls (mobile ~34px, Start Meeting 40px) | Low | frontend | frontend-auto-mergeable | OPEN |
| UX-102 Daily Capture save no success moment | Low | frontend | frontend-auto-mergeable | OPEN |
| UX-103 zero-report full celebration | Info | frontend Celebration.jsx | frontend-auto-mergeable | OPEN |
| INFO-001 audit screenshots contain test PII | Info | repo hygiene | n/a | OPEN |

\* Privacy severities assume single-tenant pilot; rise at multi-tenant.

**Highest-value next frontend item:** A11Y-101/102 modal-focus — one shared `useModalFocus` hook (initial focus + Tab trap + Escape + return, mirroring `MeetingMode.jsx:198`) closes both in one auto-mergeable PR.

### Self-critique (recon gaps)
- Bundle numbers from #804 run-log, not a fresh build; manualChunks topology is reasoned, not measured.
- `d3-*`/`victory-vendor` substrings inferred from recharts 3.x shape — confirm against node_modules before locking matcher.
- EFF-003/008 lane calls are judgment (each has an auto-mergeable frontend arm).
- PRIV surfaces coarse; several are Console/ops with no code artifact.
- SEC-012 DEPLOYED state relied on delta audit + merged #801, not re-run emulator.
