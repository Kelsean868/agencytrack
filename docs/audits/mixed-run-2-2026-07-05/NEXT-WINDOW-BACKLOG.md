# NEXT-WINDOW-BACKLOG (mixed-run #2, 2026-07-05)

> **What this is:** The refreshed next-window backlog produced by Lane 3 recon of the mixed-run #2 orchestrator program. It supersedes `docs/audits/mixed-run-2026-07-05/NEXT-WINDOW-BACKLOG.md`. Every source anchor below was RE-VERIFIED by grep/read against current `main` (Rule 17) — line numbers the prior backlog carried that had drifted are corrected inline and flagged in the Self-critique.
>
> **Triage lanes:** `frontend-auto` (channel-eligible: frontend-only, Vercel auto-deploys on merge, no rules/functions/deploy) · `functions-held` (human-merge + explicit `firebase deploy`, Rule 19) · `needs-decision` (carries a product/architecture/money judgment call, or straddles a lane boundary — dispatcher rules per item).

**Executive summary — the single highest-value next-window item:** **EFF-002 Phase 2 paired with a Rollup `manualChunks` vendor-grouping config** (Section 1). It is the last large bundle win before the backlog turns almost entirely to owner-owned functions/rules work, it is frontend-only with a committed adversarial smoke already walking every manager tab (`scripts/verification/smoke-eff002-code-splitting.mjs`), and its one blocker is a single dispatcher decision: approve the `manualChunks` shape. Phase 1 (dashboard lazy-split, PR #804) already cut the entry chunk −65.6%; Phase 2 was built and proven to slim the ~96 kB-gzip `ManagerDashboard` base chunk to ~14.68 kB but was reverted because naive per-panel `lazy()` fans shared `lucide-react` (146 importers) + `firebase` into 36–50 tiny chunks. `manualChunks` pinning `lucide-react` / `recharts` / `firebase` into a few named vendor chunks is the missing build-config decision that makes Phase 2 land cleanly. **Runner-up (functions lane):** the **Node.js 20 runtime decommission (hard deadline 2026-10-30)** — see the MUST-INCLUDE box in Section 4; it has a deploy-blocking wall and cannot be a last-minute change.

---

## What THIS window (mixed-run #2) is consuming — HELD, not open

These four are being resolved in the current window. Their expected post-window state is **HELD PR awaiting human-merge + `firebase deploy`** (three of four touch `functions/`) — **not "open."** Do not re-list them as next-window work; a backlog reader should treat them as in-flight.

| # | Item | Anchor (re-verified) | Post-window state |
|---|---|---|---|
| L1-1 | MDRT threshold 500k→688,800 + 5-year tenure floor marker | `functions/index.js` `onSubmissionWrite` (badge write). Closes FOLLOW_UPS "threshold 500k-vs-688,800" FU (`docs/FOLLOW_UPS.md:232`). | HELD PR → human-merge + `firebase deploy --only functions` |
| L1-2 | YTD year-attribution: `new Date().getFullYear()` → `weekStarting`-year | `functions/index.js` YTD scan (~`:1487–1495`; Gemini HIGH money-math). Closes the year-attribution FU (`docs/FOLLOW_UPS.md:226` §). | HELD PR → human-merge + `firebase deploy --only functions` |
| L1-3 | EFF-006 event-driven leaderboard cron | `functions/leaderboard/leaderboardAggregate.js:439` (`.schedule('0 * * * *')`) + `loadInputs:56`. | HELD PR → human-merge + `firebase deploy --only functions` |
| L1-4 | EFF-002 Phase 2 manager-tab lazy-split + Rollup `manualChunks` (frontend) | `vite.config.js` (no `build` key today) + `ManagerDashboard.jsx` render switch. | HELD PR → human-merge (frontend; Vercel auto-deploys) |

> **Dependency note:** L1-4 IS Section 1 below. If the current window ships L1-4, Section 1 closes and EFF-013 (Section 2) becomes the headline next item. Section 1 is retained here because L1-4 is described in the current brief as ambitious/at-risk of parking; if it parks, this is the ready-to-brief spec.

---

## Section 1 — EFF-002 Phase 2: a concrete Rollup `manualChunks` strategy (PLAN ONLY)

**Ready to brief.** A `build.rollupOptions.output.manualChunks` config grouping `lucide-react`, `recharts`+D3, `firebase`, and `@react-pdf` into named vendor chunks, paired with lazy-splitting the ~16 heavy `ManagerDashboard` tab panels at their existing `activeTab ===` conditional mounts.

### Current build config (RE-VERIFIED)
`vite.config.js` has **no `build` key** — no `rollupOptions`, no `manualChunks`. Rollup does 100% automatic chunking today. Phase 2 introduces the first `build.rollupOptions.output.manualChunks` block (the "new build-config pattern" Rule 1 requires be surfaced to the dispatcher).

Heavy-dependency reality (RE-VERIFIED via import-graph grep in the prior recon; substrings unverified — see falsification):
- `lucide-react` — imported by **146 files** (the tiny-chunk culprit).
- `recharts` — imported by exactly **3 files**: `KPICard.jsx`, `PersistencyTab.jsx`, `CommissionPlayground/components/CashFlowChart.jsx`.
- `firebase` — Rollup shuffled it into an "always-loaded sibling" (~142 kB gzip) during the reverted experiment.
- `@react-pdf/renderer` — already isolated (EFF-011, PR #802). Do NOT touch.

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
`vendor-icons` is the load-bearing fix; `vendor-charts` keeps recharts+D3 cohesive; `vendor-firebase` stops the always-loaded-sibling pathology; `vendor-pdf` keeps EFF-011's split cohesive. App code returns `undefined` → flows into per-tab lazy chunks. Function form is required (substring matching on d3/firebase submodules).

### Manager tab panels worth lazy-splitting (~16)
MasterSheet, TeamPerfRosterPage, CompliancePanel, PersistencyTab (recharts), SettlementPanel, FinancingTab, CampaignPanel, UserManagementPanel, ManagerAwardsPanel, ProductionReportTab, GoalsPanel, KioskModeTab, AgentOfMonthTab, PolicyReconciliationPanel, ManagerWarTab/TeamWarsTab/MonthlyRecruitingTab (trio), CommissionPlayground (recharts). Render switch ~`ManagerDashboard.jsx:450–631`.
**Stay EAGER:** ManagerOverviewTab (default), Shell, full-screen early-returns (WizardForm/MeetingMode/DailyCaptureV2), KPICard (recharts sparkline — only EFF-013 removes it).

| ID | Finding | Re-verified anchor | Lane | Effort | Fix shape |
|---|---|---|---|---|---|
| EFF-002 P2 | Per-manager-tab lazy-split + Rollup `manualChunks` vendor grouping | `vite.config.js` (no `build` key); `ManagerDashboard.jsx:450–631` render switch | frontend-auto (with 1 dispatcher decision) | M | Add `build.rollupOptions.output.manualChunks` (above) + `lazy()` the ~16 tab panels at existing conditional mounts; re-run committed smoke both themes. |

### Falsification (Rule 23)
Overturned if the tiny-chunk count is a non-issue on Vercel's HTTP/2 edge (then Phase 2 ships as a plain per-panel split, no `manualChunks`). Companion: **EFF-013** (inline-SVG KPICard sparkline) removes recharts from both dashboards' critical path — the natural agent-path follow-on once Phase 1 moved recharts out of the entry chunk.

---

## Section 2 — Remaining efficiency findings NOT consumed this window

EFF-004 shipped (PR #805, deploy pending); EFF-001/005/007/009/011/018 shipped (PR #802); EFF-002 P1 shipped (PR #804); EFF-006 is L1-3 (this window). The rest carry forward:

| ID | Finding | Re-verified anchor | Lane | Effort | Fix shape |
|---|---|---|---|---|---|
| EFF-003 | AgentDashboard fires 1 tenant-window submissions scan per active campaign on mount | `AgentDashboard.jsx:354–356` (`Promise.all(camps.map(getCampaignSubmissions))`); `campaignService.js:141–145` (`getCampaignSubmissions`, no `limit`) | needs-decision | M | Frontend arm: dedupe to one min-start/max-end window query, filter per-campaign client-side. Durable arm: CF `campaignProgress/{id}` aggregate (new collection → functions). |
| EFF-008 | CompliancePanel per-agent `getWeeklyPlan` fan-out re-fires on week/lens change | `CompliancePanel.jsx:200` (plan fan-out, dep `:204`); nudge fan-out `:230` (dep `:234`) | needs-decision | M | Frontend arm: short-lived `(week, rosterKey)` client cache. Durable arm: collection-group `where('weekStarting','==',week)` + composite index (collectionGroup rules gotcha applies). |
| EFF-010 | Leaderboard reads entire `users` collection just to build a photoURL map | `Leaderboard.jsx:95` (`getDocs(collection(db,'tenants/${tid}/users'))`) → keeps only `photoURL` `:102` | frontend-auto | M | Client arm: share one `getTenantUsers` via context cache (also resolves COST-003 co-mount re-reads). Fuller arm denormalizes `photoURL` onto `leaderboards/{branchId}` doc = functions. |
| EFF-012 | MasterSheet renders unvirtualized N-row × 26-col table | `MasterSheet.jsx:374` (`rows.map`) → `:380` (`COLS.map`) | frontend-auto | M | Virtualize (`@tanstack/react-virtual`, dep-add → flag) OR paginate beyond ~100 rows (pagination arm needs no dep, channel-eligible). |
| EFF-013 | Recharts on agent first-paint via `KPICard` sparkline | `KPICard.jsx` (recharts import; renders on agent dashboard default view) | frontend-auto | M | Replace KPICard sparkline with hand-rolled inline-SVG polyline (~15 lines) → removes recharts from first paint entirely. Pairs with EFF-002 P2 / `manualChunks`. Change-risk Med (shared visual primitive; verify parity both themes). |
| EFF-014 | TeamPerfRoster renders full row set twice (desktop table + mobile cards) | `TeamPerfRoster.jsx:359` (`rows.map`) → `:363` (`COLS.map`); `:394` (`rows.map`→`MobileCard`) | frontend-auto | M | Same template as EFF-012; render only the active-viewport layout (viewport hook, not CSS-hide-both). Pair EFF-012 + EFF-014. |
| EFF-016 | Unbounded whole-collection reads, no `limit`/pagination | `managerService.js:59` `getAllYTDSubmissions` (whole-tenant YTD); `campaignService.js:15` `getCampaigns` | frontend-auto | M | Add `limit`/pagination on client queries; combine with EFF-010 shared cache to stop re-reading the same YTD set across co-mounted hooks. Low urgency at pilot scale; grows linearly. |
| EFF-017 | `notifyCampaignParticipants` sends 1 notification write per recipient | `campaignService.js:112` + `:130` (`Promise.all(map → createNotification)`) | frontend-auto | S | `writeBatch` (≤500 ops) on the existing notifications write path. Cleanest quick win in this section. |
| EFF-015 | No global region / memory / minInstances (all fns default us-central1 / 256MB, cold starts) | `functions/index.js` — no `setGlobalOptions`; only one `.runWith` at `:701` (bulk import). PARKED this window pending Firestore-region confirm + money-path migration plan. | functions-held / needs-decision | M | `setGlobalOptions({region, memory})` (or per-fn `.runWith`); `minInstances:1` on the 2–3 latency-sensitive money callables only. **Confirm Firestore region FIRST**; do NOT change region on a live money path without a migration plan. |

**Notes:** EFF-003/008 straddle the lane boundary (frontend arm channel-eligible; server arm needs a new collection/index → functions). EFF-012/014 virtualization arm adds `@tanstack/react-virtual` (dep-add → flag); the pagination fallback is channel-eligible. EFF-015 is functions-held AND needs-decision (region change on live deploys).

---

## Section 3 — Open UX / A11y backlog

Cross-checked against the prior backlog's Section 3 and the two 07-04 UX audits. The `#794–#799` autonomous-run program RESOLVED the bulk (BUG-101/102/103, UX-001, UX-101 for agents, A11Y-001 central h1, A11Y-103 skip-link; A11Y-002/003 falsified). What remains OPEN:

| ID | Finding | Re-verified anchor | Lane | Effort | Fix shape |
|---|---|---|---|---|---|
| A11Y-101 | Wizard modal `aria-modal="true"` with NO focus management (no initial focus, no Tab trap, no Escape, no return) | `WizardForm.jsx:526–527` (`role="dialog" aria-modal="true"`) | frontend-auto | M | Shared `useModalFocus` hook: initial focus + Tab trap + Escape→onClose + focus-return, mirroring `MeetingMode.jsx:198` (the one overlay that does this correctly). |
| A11Y-102 | Daily Capture takeover — same dialog-convention gaps | `DailyCaptureV2.jsx:689–690` (`role="dialog" aria-modal="true"`) | frontend-auto | M (share the A11Y-101 hook) | Same shared hook — one PR closes both. |
| A11Y-005 | Sub-44px controls vs Nexus 44px rule (mobile number inputs ~34px; "Start Meeting" 40px) | mobile Commission inputs 184×34; BM "Start Meeting" 144×40 (measured, not source-anchored) | frontend-auto | S | Bump input `min-height` + "Start Meeting" to 44px; leave inline text links (2.5.8-exempt) as-is. |
| UX-102 | Daily Capture save has no legible success moment (spinner → silent auto-close ~600ms) | `DailyCaptureV2.jsx:643–672` | frontend-auto | S | Post-save beat (~1.2s check + "+pts today · rolls into WK N") or a toast that survives the close. Timing/copy change, not a redesign. |
| UX-103 | Zero-activity report submits with full "You shipped — TTD 0" celebration | `Celebration.jsx` (zero-points variant exists; needs zero-API variant) | frontend-auto | XS | Add a zero-API copy variant of the "You shipped" block (mirror the existing "Logged — keep building" zero-points variant). |
| UX-101 (mgr) | Manager/Admin topbar static "Welcome back, {name}" (agent half RESOLVED #798) | `ManagerDashboard.jsx:438` | needs-decision | S | Derive per-screen title — but entails a greeting/wayfinding product decision, so dispatcher-gated. |
| ARCH-002 | Inline styles at source level (e.g. `rgba` in `HistoryTab.jsx`) | `HistoryTab.jsx` (rgba inline style, per prior audit) | frontend-auto | S | Move to Tailwind + CSS-var tokens per Nexus "no inline styles" rule. Low. |
| INFO-001 | Audit screenshots contain test-tenant PII | `docs/audits/ux/screenshots/`, `docs/audits/webapp-ux/screenshots/` | n/a (repo hygiene) | S | Gitignore the screenshot dirs or redact users-list captures before any external share. |

> **A11Y-101/102 are NOT yet banked in `docs/FOLLOW_UPS.md`** (grep confirms no entry) — they exist only in the 07-04 webapp-ux follow-up audit + the prior backlog. This backlog is their carry-forward record until banked. **Cleanest frontend-auto item in the whole backlog:** one shared `useModalFocus` hook closes A11Y-101 + A11Y-102 in a single channel-eligible PR.

---

## Section 4 — Security / privacy / platform backlog (owner-owned)

SEC-012 shipped + deployed (PR #801, `3d7c391e`). The entire pre-existing security + privacy backlog is **still OPEN** — no root-cause remediation has landed since the 07-04 base audit (confirmed by the 07-05 delta audit's re-verification: all 8/9 top findings CONFIRMED-STILL-OPEN, only line/count anchors drifted). Top-3 HIGH anchors re-verified by direct grep this pass.

> ### ⚠️ MUST-INCLUDE — Node.js 20 Functions runtime decommission (HARD DEADLINE 2026-10-30)
> **The gen-1 Cloud Functions run on Node 20, which was deprecated 2026-04-30 and is DECOMMISSIONED 2026-10-30 — after that date `firebase deploy --only functions` is BLOCKED for any Node-20-pinned function.** Migration to Node 22 (or the then-current Firebase LTS) is a **separate ticket**; CLAUDE.md currently locks the v1 runtime for the active track. **RE-VERIFIED runtime pins:** `functions/package.json:9–11` → `"engines": { "node": "20" }`; `firebase.json` has **no explicit `runtime` key** (runtime is derived from `engines.node`). Already banked twice: `docs/FOLLOW_UPS.md:755` (HIGH, target: complete before end of Sept 2026 as buffer) and `docs/FOLLOW_UPS.md:2536` (MEDIUM-with-hard-deadline duplicate). **Triage: functions-held.**
> **One-line fix shape:** bump `functions/package.json` `engines.node` to the current Firebase-supported LTS (+ add explicit `"runtime"` to `firebase.json` if desired), scope it TOGETHER with the SDK jump below, run the full functions suite in the emulator, do a non-prod deploy test, then `firebase deploy --only functions`.

| ID | Finding | Re-verified anchor | Sev | Lane | Effort | Fix shape |
|---|---|---|---|---|---|---|
| **Node-20 EOL** | Node 20 runtime decommissioned 2026-10-30 (deploy-blocking) | `functions/package.json:9–11` (`node: "20"`); `firebase.json` (no `runtime` key) | High (hard deadline) | functions-held | L | Bump `engines.node` to current LTS + scope with SDK jump; emulator suite + non-prod deploy test → deploy. |
| **SDK 4.9→≥5.1** | `firebase-functions` 4.9.0 → ≥5.1.0 is a BREAKING migration (region decl, runtime-options shape, callable/trigger signatures) | `functions/package.json:19` (`"firebase-functions": "^4.9.0"`); `firebase-admin: "^12.0.0"` at `:18` | High (breaking, background risk) | needs-decision (couple with Node-20) | L | Read the 5.x migration guide; `functions.region()` → `setGlobalOptions`; capture pre-upgrade versions in PR body for rollback. Scope as ONE piece of work with Node-20. |
| SEC-001 | `setUserClaims` writes arbitrary client-supplied claims (tenant_admin can mint `platform_admin` / cross-tenant uid) | `functions/index.js:457` (guard is only `['platform_admin','tenant_admin'].includes(role)`); claims set verbatim ~`:466–470` | High (priv-esc) | functions-held | M | Add a CREATION_MATRIX gate + `tenantId === context.auth.token.tenantId` clamp + block `role==='platform_admin'`. Deploy `--only functions`. |
| SEC-002 | Agent-of-Month CFs not branch-scoped for BM (validates *agent* branch, never *caller* owns it) | `functions/agentOfMonth/setAgentOfMonth.js:70` (`agentData.branchId !== branchId` — agent check only, no `caller.branchId` compare); `getCandidates.js:35` (branchId from `data`) | High (cross-branch) | functions-held | M | Add `caller.branchId === branchId` (or `ownedBranchIds` membership) check before the write. Deploy `--only functions`. |
| SEC-003 | Kiosk `createKioskToken`/`revokeKioskToken` not branch-scoped (1-yr TTL) | `functions/kiosk/createToken.js:28` (`branchId = data.branchId ?? token.branchId ?? 'default'`, no BM-branch equality); `TOKEN_TTL_MS` = 1yr `:12`; `revokeToken.js` tenant-match only | High (cross-branch + long-lived) | functions-held | M | Clamp `branchId` to caller's owned branch on mint; scope revoke by branch. Deploy `--only functions`. |
| SEC-004 / COST-001 | App Check not enforced (no `initializeAppCheck` client; no server enforcement) | `src/firebase.js` (no `initializeAppCheck`); no `context.app`/`consumeAppCheckToken` in functions | High (abuse + billable) | needs-decision (mixed: client init + Console/backend enforce) | M | Register App Check in Console; add `initializeAppCheck` to `src/firebase.js` (frontend); toggle enforcement on Firestore/Functions (Console/deploy). |
| SEC-005 | Dep CVEs: functions 4 high / 10 mod / 1 low; root 2 high / 1 mod (`@grpc/grpc-js`, `protobufjs`, `fast-xml-builder`, `form-data`) | `functions/package.json` (admin `^12`, functions `^4.9`); root deps. Fresh `npm audit --omit=dev` 2026-07-05. | High (supply chain / DoS) | functions-held | M | Apply `firebase-admin` v12→v13 + `firebase-functions` v4→v6 bumps (pulls patched transitives) — couples with the SDK-migration ticket. Suite + deploy. |
| SEC-006 | `storage.rules` absent from repo & `firebase.json` | not tracked (`git ls-files`); `firebase.json:1–23` (no `storage` block) | Medium | functions-held | S | Author `storage.rules` + add `firebase.json` `storage` block; deploy `--only storage`. Confirm deployed content in Console. |
| SEC-007 | No CSP / security headers | `vercel.json` (rewrites only, no `headers` key); `index.html` no CSP meta | Medium | frontend-auto (Report-Only first) | S | Add `headers` to `vercel.json` (CSP-Report-Only first, then enforce). Ships with the Vercel build — no `firebase deploy`. |
| SEC-008 | `validateKioskToken` public, CORS `*`, no rate limit | `functions/kiosk/validateToken.js` | Medium | functions-held | M | Tighten CORS; add rate limit / App Check. Deploy `--only functions`. |
| SEC-009 | CI omits rules test & dep scan | `.github/workflows/ci.yml` (lint-and-build + functions-tests only; `tests/rules/**` never run) | Medium | human-merge (infra) | M | Add a Firestore-emulator `emulators:exec` rules job + `npm audit`/Dependabot gate. |
| SEC-010 | WAR/notify build paths from body `tenantId` (not currently reachable) | `functions/` (per delta audit; low reachability) | Low | functions-held | S | Source `tenantId` from `context.auth.token`, not body. Deploy `--only functions`. |
| SEC-011 | Leaderboard callable leaks `err.message`; unvalidated tenantId segment | `functions/leaderboard/leaderboardAggregate.js:490` (`recomputeLeaderboardOnDemand`) | Medium | functions-held | S | Sanitize error surface; validate `tenantId` segment. Deploy `--only functions`. |
| ARCH-001 | Hardcoded `TENANT_ID='tatillife_south'` in scheduled crons | `functions/index.js:50` (`const TENANT_ID = 'tatillife_south'`); mirrored in `leaderboardAggregate.js:34` | Medium | functions-held | M | Parameterize per-tenant scheduled recompute (post-pilot multi-tenant). Deploy `--only functions`. |
| PRIV-002 | No right-to-erasure / cascade delete (`deactivateUser` is soft-delete only) | no `eraseUser`/`hardDelete`/`purgeUser` export (`git grep`) | High* | functions-held | L | New erasure CF + rules + cascade across user subcollections. Deploy required. |
| PRIV-003 | No DSAR export | `exportService.js` (no data-subject export path) | High* | needs-decision | M | Add a DSAR export path in `exportService.js` (frontend), likely + a scoped read rule. |
| PRIV-004 | No retention / TTL | `functions/config` (none) | High* | functions-held | M | TTL policy / retention CF. Deploy required. |
| PRIV-005 | No read-access audit trail | `functions/` (none) | High* | functions-held | M | Emit access-log on sensitive reads. Deploy required. |
| PRIV-006 | No consent capture for 3rd-party (prospect/policyholder) PII | prospectInfo/policies create paths (no consent field) | High* | needs-decision (mixed: client field + rules allowlist) | M | Add consent field to create UI + service + a rules allowlist entry. |
| PRIV-001/007/009/010/011 | RoPA, data residency, PA access log, breach alerting, Clarity DPA | mixed / ops / Console (mostly no code artifact) | Medium* | needs-decision | — | Ops/Console; several have no code artifact. |

\* Privacy severities assume single-tenant pilot; they rise at multi-tenant. **RESOLVED (do not re-list):** SEC-012 (#801, `3d7c391e`, deployed); BUG-101 (#794); BUG-102 (#796, functions `weekOfYear` half is a banked FU); BUG-103 (#797); UX-001 (#799); UX-101-agent + A11Y-001 + A11Y-103 (#798); A11Y-002 + A11Y-003 (falsified — `'1'`-key + 44px label wrapper).

---

## Self-critique (recon gaps, Rule 22)

- **Anchors that DRIFTED from the prior backlog (corrected this pass):**
  - **ARCH-001**: prior backlog said `functions/index.js:49` with value `'tatil_south'`; **actual is `:50`** with value **`'tatillife_south'`** (also mirrored at `leaderboardAggregate.js:34`). Both the line AND the tenant-id string in the prior backlog were wrong.
  - **A11Y-101**: prior backlog said `WizardForm.jsx:527`; the `role="dialog"` line is **`:526`** (`aria-modal` is `:527`). One-line drift.
  - **A11Y-102**: prior backlog said `DailyCaptureV2.jsx:690`; the `role="dialog"` line is **`:689`** (`aria-modal` is `:690`). One-line drift.
  - **EFF-015**: prior backlog didn't carry a `.runWith` anchor; confirmed the sole `.runWith` is at `functions/index.js:701` (prior audit said `:700` — one-line drift).
  - EFF-003/008/010/012/014/016/017, SEC-001/002/003/005/006/007, EFF-006 cron, kiosk TTL, `setUserClaims`, campaign fan-out — all re-verified and matched the prior backlog within ≤1 line.
- **SEC-002 setAgentOfMonth deep-verify only.** I re-read `setAgentOfMonth.js` to confirm the caller-branch gap (`:70` checks the agent, never the caller); `getCandidates.js:35` was carried from the delta audit's re-location, not re-opened this pass.
- **`manualChunks` substring matcher unverified against `node_modules`.** The `d3-*` / `victory-vendor` / `@firebase/` substrings are reasoned from recharts 3.x + firebase 12.x package shape; confirm against actual `node_modules` before locking the matcher (a Phase-1 gate for the L1-4/EFF-002-P2 brief).
- **Bundle numbers are from the #804 run-log, not a fresh build** this pass; the Phase-2 topology (14.68 kB base) is measured-then-reverted, and the `manualChunks` clean-topology outcome is reasoned, not re-measured.
- **A11Y-005 / mobile-input measurements are from the 07-04 harness**, not re-measured — they're pixel measurements, not source anchors, so a source line can't be cited.
- **SEC deployed-state unverified (read-only limit):** SEC-006 storage rules, EFF-015/PRIV-007 Firestore region, and SEC-004 App Check Console enforcement are asserted from repo state, not observed in Console. **What would overturn the Node-20 finding:** the runtime being already bumped in a branch not yet on `main` — checked `functions/package.json` on current `main`, still `node: "20"`, so it holds.
- **PRIV surfaces remain coarse** — several (RoPA, residency, DPA) are Console/ops items with no code artifact to anchor.
