# AgencyTrack — Claude Code Project Memory

## What This App Is
Insurance sales activity tracking SaaS for Tatil Life, Trinidad & Tobago.
Agents submit weekly reports. Managers review them. Built to scale to multiple companies.
Firebase project: agencytrack-2a610 | Hosted: agencytrack.vercel.app | Repo: github.com/Kelsean868/agencytrack

## Commands
- `npm run dev` — Start dev server at localhost:5173
- `npm run build` — Production build to dist/
- `npm run repomix` — Generate Claude context snapshot (run before every session)
- `firebase deploy --only functions` — Deploy Cloud Functions
- `firebase deploy --only firestore:rules` — Deploy Firestore rules
- `firebase serve` — Run Firebase emulator locally
- `git push` — Triggers auto-deploy to Vercel

## Tech Stack
- React 19 + Vite (not Create React App)
- Firebase Firestore (not Realtime DB) — project: agencytrack-2a610
- Firebase Auth: email + password (NOT email link — passwordless was abandoned, too unreliable for field agents)
- Firebase Storage: profile photos at avatars/{tenantId}/{uid}.jpg
- Firebase Cloud Functions (Node 20)
- Tailwind CSS + CSS custom properties
- @react-pdf/renderer: PDF generation (html2canvas was REMOVED)
- vite-plugin-pwa: PWA + offline support
- Recharts for charts
- Lucide React for icons
- jsPDF: kept only for branch CSV export
- Hosted on Vercel

## Build Phase History
| Phase | Scope | Status |
|-------|-------|--------|
| P1 | Firebase + Auth setup | ✅ COMPLETE |
| P2 | Login + Auth flow + Agent Dashboard | ✅ COMPLETE |
| P3 | 9-step Weekly Wizard with auto-save | ✅ COMPLETE |
| P4 | Manager Views + Meeting Mode + Persistency | ✅ COMPLETE |
| P5 | Notifications + Career Portal + Gamification | ✅ COMPLETE |
| P6A | Goals System Tier 1 + Commission Playground | ✅ COMPLETE |
| P6B | History + Awards + Settlement + Carousel | ✅ COMPLETE |
| P6C | Carousel polish + activity rounding | ✅ COMPLETE |
| P7A | Dashboard KPI+sparklines, dark mode audit, wizard 9→5 | ✅ COMPLETE |
| P7B | PDF report, ProfileScreen+photo, Branch CSV | ✅ COMPLETE |
| P7C | PDF polish, photos in Leaderboard+MeetingMode, SVG login, PWA | ✅ COMPLETE |
| P8 | Campaign module, recognition badges, Goals Tier 2, multi-tenancy | 🔜 NEXT |

## Key Technical Decisions
- Auth: email + password. Passwordless email link was abandoned — unreliable for field agents with intermittent connectivity.
- Wizard: Step1–Step9 files are NEVER modified. WizardForm.jsx groups them into 5 screens. Revert to 9 steps = one git revert on WizardForm.jsx only.
- PDF: @react-pdf/renderer ONLY. html2canvas removed — had unfixable text alignment issues in production.
- AgentReportDocument.jsx: HARDCODED HEX colours only. No CSS variables — react-pdf cannot resolve them.
- extractFields.js: ONLY way to read submission fields. Never access raw Firestore fields directly.
- Profile photos: Firebase Storage at avatars/{tenantId}/{uid}.jpg. photoURL in Firestore user doc. Shown in ProfileScreen, Leaderboard, MeetingMode. NOT yet on agent dashboard or wizard.
- PWA: vite-plugin-pwa + Workbox. Firestore offline persistence via enableIndexedDbPersistence(db) in firebase.js.
- Goals system (5 layers, full hierarchy):
  1. **Personal Commitment** — agent sets own target (≥ company floor) — `goals/{goalId}` ✅ built
  2. **Unit Target** — unit manager sets target for their unit — `unitGoals/{unitId}_{year}` ✅ built
  3. **Branch Target** — branch manager sets target for branch — `branchGoals/{year}` ✅ built
  4. **Company Floor** — super admin sets minimum floor — `config/companyMinimums` ✅ built
  5. **Sales Manager Target** — cross-branch layer (planned Phase 9, not yet built)
  Gap analysis fetched via `getGoalHierarchy(tenantId, unitId, year, agentId)` in goalsService.js. Displayed in AgentDashboard Goals section and CareerPortal via `GapAnalysisPanel.jsx`.

## Architecture
```
src/
  context/        ← AuthContext, NotificationContext
  hooks/          ← useAuth, useSubmissions, useAgentMetrics
  services/       ← authService, submissionService,
                     exportService, goalsService,
                     managerService, notificationService,
                     persistencyService, settlementService,
                     unlockService, userService
  utils/          ← awardsEngine, dateHelpers, extractFields,
                     formatters, validators
  components/
    auth/         ← LoginScreen (SVG pattern background)
    awards/       ← AgentAwardsPanel, ManagerAwardsPanel
    dashboard/    ← AgentDashboard, ManagerDashboard,
                     KPICard, MotivationalCarousel
    gamification/ ← Leaderboard (AgentAvatar), BadgeGrid
    goals/        ← CommissionPlayground
    manager/      ← MasterSheet, CompliancePanel, GoalsPanel,
                     MeetingMode (AgentAvatar), PersistencyPanel,
                     SettlementPanel
    profile/      ← ProfileScreen, CareerPortal,
                     AgentReportDocument (react-pdf, hex only)
    submissions/  ← SubmissionViewer
    ui/           ← NotificationBell, NotificationDrawer,
                     ReportRangeModal, SyncIndicator
    wizard/       ← WizardForm (5 screens), CardStack,
                     CurrencyField, NumericField,
                     steps/ (Step1–Step9, NEVER MODIFY)
```

## Domain Rules (NEVER BREAK THESE)
- Currency is always TTD — use `formatCurrency()` from formatters.js
- API = Annual Premium Income (primary production metric, always numeric)
- All numeric fields: `parseFloat()` enforced before saving to Firestore
- Week Starting date: must always be a Sunday — use `validateSundayDate()` from validators.js
- FFI = Fact Finding Interview | CI = Closing Interview
- No self-registration — managers create all accounts
- Never store numeric values as strings in Firestore

## Roles & Permissions

Full organisational hierarchy (lowest → highest):
**Agent → Unit Manager → Branch Manager → Sales Manager → Super Admin**

```
super_admin (Kyron)  — all access + sensitive system config
sales_manager        — cross-branch visibility, company-wide campaigns,
                       manages Branch Managers (planned Phase 9, not yet built)
branch_manager       — full branch, create accounts across all units
unit_manager         — own unit only, create accounts for own agents
agent                — own data only
```
Role is stored in Firebase custom claims AND in Firestore `/tenants/{id}/users/{uid}.role`

> **Note:** `sales_manager` role is defined here for planning purposes.
> It is NOT yet implemented in code. Do not add `sales_manager` checks
> to any component until Phase 9 begins.

## Firestore Structure
```
/tenants/{tenantId}/
  config/settings              ← companyMinimums, tenant config
  users/{userId}               ← profile, role, photoURL, phone, bio
  submissions/{id}             ← weekly report (read via extractFields.js)
  persistency/{agentId_YYYY_MM} ← manager-entered persistency %
  goals/{goalId}               ← personal commitment + manager targets
  unitGoals/{unitId}_{year}    ← unit manager targets (P8C)
  branchGoals/{year}           ← branch manager targets (P8C)
  leaderboard/{userId}
  notifications/{id}
  settlements/{id}             ← confirmed production data (agentId_year_periodKey)
  campaigns/{campaignId}       ← branch/unit/agent campaigns (P8B)
```

New names pipeline fields on submission docs: `referralsObtained`, `namesFromColdCanvass`, `namesFromOther`, `oldNamesPool` — used in carousel and pipeline tracking

### Submission Document Shape (actual flat schema — current wizard)
All fields are stored at the document root (NOT nested under step1, step2, etc.).
Key fields by step:
```
agentId, userId, agentName, weekStarting, status, submittedAt, updatedAt

Step 1:  prospectingLettersSent, seminarsConducted, tradeshowsConducted, f2fAttempts, f2fContacts…
Step 2:  referralCalls, followUpCalls, coldCalls, seminarTradeshowCalls, serviceCalls
Step 3:  qualifiedApproaches, appointmentsSet, ffisScheduled, ffiConducted, solutionPresentations
Step 4:  newCIBooked, oldCIBooked, ciConducted, applicationsSold, livesSold, apiSold, estimatedCommissions
Step 5:  referralsSought, referralsObtained, namesFromColdCanvass, namesFromOther, oldNamesPool…
Step 6:  policiesReceived, policiesDelivered, hasServiceWork, serviceContacts…
Step 7:  officeHours, fieldHours
Step 8:  ratingPlanning, ratingTimeManagement, ratingSalesPerformance, ratingProspecting, ratingOverall, notes
Step 9:  targetDials, targetTelContacts, targetF2FAttempts, targetFFI, targetCI, targetAppsSold, targetAPI, goalNotes
```

**Schema variants (use extractFields() to normalise):**
- Nested schema: detected by `d.step1 !== undefined` (aspirational future format)
- Current flat schema: detected by `d.referralCalls !== undefined`
- Legacy flat schema: detected by `d.dials !== undefined`

`extractFields(doc)` lives in `src/utils/extractFields.js` — the single source of truth for reading submission KPI fields in all manager views. Never re-implement locally.

### Persistency Document Shape
```
{
  agentId, agentName, tenantId,
  year, month,           // month = 1–12
  persistency,           // parseFloat, 0–100
  enteredBy,             // uid of manager
  enteredAt             // Firestore Timestamp
}
```

## Design System — Nexus
```css
--color-primary: #01696f    (teal)
--color-primary-dark: #014e52
--color-bg: #f7f6f2         (warm beige)
--color-surface: #ffffff
--color-surface-raised: #f9f8f5
--color-text: #28251d
--color-text-muted: #6b6560
--color-success: #2d7a4f
--color-warning: #b45309
--color-danger: #c0392b
--color-border: #e5e2db
```
Fonts: Satoshi (body) + Cabinet Grotesk (display) from Fontshare
NO gradient buttons. NO inline styles. ALL styling via Tailwind + CSS variables.
Minimum 44px touch targets (mobile agents in field).
Dark mode toggle in header (CSS class swap on `<html>`).

## Current Build Phase
**Pilot Prep — Pre-launch testing and configuration**

## Build Phase Status
| Phase | Scope | Status |
|-------|-------|--------|
| P1 | Firebase + Auth setup | ✅ COMPLETE |
| P2 | Login + Auth flow + Agent Dashboard | ✅ COMPLETE |
| P3 | 9-step Weekly Wizard with auto-save | ✅ COMPLETE |
| P4 | Manager Views + Meeting Mode + Persistency | ✅ COMPLETE |
| P5 | Notifications + Career Portal + Gamification | ✅ COMPLETE |
| P6B | History Viewer + Awards Tracker + Settlement Confirmation + Motivational Carousel | ✅ COMPLETE |
| P6C | Carousel new names card, activity rounding, emoji sweep | ✅ COMPLETE |
| P7A | Wizard consolidation 9→5 steps + PDF report | ✅ COMPLETE |
| P7B | Visual dashboard overhaul (KPI grid, sparklines, delta arrows) | ✅ COMPLETE |
| P7C | Dark mode audit + profile photo in leaderboard + MeetingMode | ✅ COMPLETE |
| P8A | Weekly Recognition Badges | 🔄 IN PROGRESS |
| P8B | Campaign Module | 🔄 IN PROGRESS |
| P8C | Goals Tier 2 — gap analysis (unitGoals + branchGoals) | 🔄 IN PROGRESS |
| P8D | Multi-tenancy rollout | ⏳ Deferred (Phase 10) |
| P8E | Agent Management + Campaign Notifications + Welcome Screen | ✅ COMPLETE |
| Pilot Prep | End-to-end testing, account setup, mobile audit, notifications | 🔄 IN PROGRESS |
| P9  | Sales Manager role (post-pilot) | ⏳ Planned |
| P10 | Multi-tenancy full rollout | ⏳ Deferred |

## Phase 4 — Component Checklist
- ✅ Step9Goals.jsx — Next Week Goals wizard step
- ✅ WizardForm.jsx — updated to 9 steps, includes step9 in submission payload
- ✅ ManagerDashboard.jsx — tab bar: Overview | Master Sheet | Compliance | Persistency
- ✅ MasterSheet.jsx — all agents × selected week, conditional formatting, CSV export
- ✅ CompliancePanel.jsx — Submitted / Pending / Missing columns for selected week
- ✅ PersistencyPanel.jsx — manager enters % per agent per month
- ✅ MeetingMode.jsx — fullscreen projector view, agent-by-agent, keyboard nav
- ✅ dateHelpers.js — `getLastNSundays(n)` utility added

### Phase 4 Key Decisions
- `selectedWeek` state is LIFTED to ManagerDashboard — shared by MasterSheet and CompliancePanel via props so both always show the same week
- MeetingMode renders as a fixed overlay (z-50) triggered by "Start Meeting" button in ManagerDashboard header
- Outlier flag in MeetingMode: any field > 3× unit average for that week. Visible ONLY in 1-on-1 mode — never in Group mode or on agent's own view
- Persistency Firestore path: `/tenants/{tenantId}/persistency/{agentId}_{YYYY_MM}`

### Phase 4 — COMPLETE. What was built and verified:
- **Step9Goals.jsx** — Next Week Goals wizard step (targetDials, telContacts, F2F, FFI, CI, Apps, API, goalNotes)
- **ManagerDashboard.jsx** — tab bar: Overview | Master Sheet | Compliance | Persistency. Start Meeting button triggers MeetingMode overlay. `selectedWeek` state lifted here, shared by MasterSheet + CompliancePanel.
- **MasterSheet.jsx** — 23-column scrollable table, sticky Agent/Status columns, conditional API colour, dual schema support via `extractFields()`
- **CompliancePanel.jsx** — Submitted / Draft / Missing columns, graceful empty state when users collection is empty
- **PersistencyPanel.jsx** — manager enters % per agent per month, batch save
- **MeetingMode.jsx** — fullscreen overlay, Group mode + 1-on-1 mode toggle. Group: 9-stat grid per agent. 1-on-1: adds 8 coaching ratio cards + self-evaluation bars. Keyboard nav (←/→/Esc). Outlier flag in 1-on-1 only.
- **extractFields.js** — single source of truth for reading all submission field variants (flat current, flat legacy, nested future)
- **computeRatios() + RATIO_THRESHOLDS + RATIO_LABELS** — coaching ratio engine
- **Firestore rules** — UID bypass for super_admin, manager cross-agent reads, agent blocked from updating submitted docs
- **Custom claims** — set via Admin SDK script, role: super_admin, tenantId: tatillife_south
- **Seed scripts** — seed-super-admin-user.cjs, seed-agent-names.cjs

### Phase 4 — Deferred to Phase 5.5 (post Phase 5)
- Branch Overview slide in Group Meeting Mode (all agents, grouped by unit, unit subtotals, branch total, click agent to jump to their slide)
- Drill-down cards in 1-on-1 Mode (tap stat card → slide-up drawer showing field breakdown without disrupting navigation flow)

## Phase 6 — Component Checklist
- ✅ SubmissionViewer.jsx — read-only slide-in drawer, wired to AgentDashboard History tab, MasterSheet, CompliancePanel
- ✅ awardsEngine.js — pure functions: computeAgentAwards, computeManagerAwards, computeRatioTrends
- ✅ AgentAwardsPanel.jsx — Monthly/Quarterly/Annual/Club tabs + ratio trends, added as Awards tab in AgentDashboard
- ✅ ManagerAwardsPanel.jsx — monthly bonus card + annual awards grid, added as Awards tab in ManagerDashboard
- ✅ settlementService.js — getSettlements, getSettlementsForUnit, confirmSettlement, deleteSettlement (batches >30 agents)
- ✅ SettlementPanel.jsx — single + bulk entry, history table with delete confirm, canConfirmSettlements flag enforced
- ✅ MotivationalCarousel.jsx — 9 agent cards + 4 manager cards, auto-advance 6s, pause on hover
- ✅ firestore.rules — settlements collection added with branch_manager + canConfirmSettlements write/delete guards

### Phase 6 Key Decisions
- ManagerDashboard tab order: Overview | Awards | Master Sheet | Compliance | Persistency | Goals | Settlements | Leaderboard
- AgentDashboard tab order: Dashboard | Career | Awards | Leaderboard | History
- awardsEngine.js is a pure module (zero Firebase imports, zero side effects) — safe to test in isolation
- Data source logic: confirmed settlements take precedence; missing periods supplemented from wizard submissions with "Estimated" badge
- MasterSheet rows are clickable (full row `onClick`) — original submission doc stored as `row._submission`
- CompliancePanel: Eye icon button added to SubmittedAgentRow alongside existing Unlock button
- SettlementPanel access guard: `role === 'branch_manager' || role === 'super_admin' || userProfile.canConfirmSettlements === true`
- Settlements Firestore path: `/tenants/{tenantId}/settlements/{agentId}_{year}_{periodKey}`

## utils/extractFields.js — Key Reference
Single source of truth for reading submission data. Import in any manager component that reads submission KPI fields:
```js
import { extractFields, computeRatios, RATIO_THRESHOLDS, RATIO_LABELS } from '../../utils/extractFields';
```
Schema detection order:
1. `d.step1 !== undefined` → nested schema (future)
2. `d.referralCalls !== undefined` → flat schema (current)
3. `d.dials !== undefined` → legacy flat schema (old)

## Wizard — 9 Steps
| Step | Name | Key Fields |
|------|------|------------|
| 1 | Prospecting | Dials, door knocks, referrals asked |
| 2 | Telephone | Tel contacts, tel appointments set |
| 3 | Approaches + FFI | F2F attempts, FFI conducted (new/old) |
| 4 | Closing + Sales | CI conducted, apps sold, API (new/old) |
| 5 | New Names + Pipeline | Referrals, cold canvass, existing prospects |
| 6 | Policy Deliveries + Service | Deliveries, service work (conditional expand) |
| 7 | Time Management | Office hours, field hours |
| 8 | Self-Evaluation | 1–10 ratings, notes |
| 9 | Next Week Goals | Target dials, contacts, FFI, CI, apps, API |

## Conventions
- Functional components only — no class components
- `const` or `let` — never `var`
- `useMemo` and `useCallback` for expensive calculations
- Every component handles: loading, error, and empty states
- CSS via Tailwind classes + CSS variables — no inline styles
- All Firestore writes go through service files, not directly from components
- Commit messages: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `chore:`
- AgentReportDocument.jsx is the ONLY file allowed to use inline styles (required by react-pdf renderer)

## PWA Icons
- /public/icon-192.png — shield + bars, deep teal #014e52
- /public/icon-512.png — same, larger
- /public/favicon.svg — simplified 3-bar for browser tabs
- /public/icons.svg — full design SVG source

## Test Accounts
- Email: kelsean@gmail.com
- Password: AgentTest123!
- UID: J0j4uBqzTPcfm1IlGCPyDzo27RP2
- Role: agent
- TenantId: tatillife_south
- Super Admin UID: 4GeeZbhZBwdtGOLoJoggf4MQo142

## Environment Variables (Vite format)
All Firebase env vars use `VITE_` prefix.
Never hardcode Firebase config — always use import.meta.env.VITE_*
Never commit .env.local

`VITE_TENANT_ID=tatillife_south` — canonical tenant ID. All Firestore paths and custom claims use this value.

## Sensitive Files — Never Commit
- `functions/service-account-key.json` — Firebase Admin SDK key
- `functions/set-super-admin.cjs` — one-time Admin SDK script (sets super_admin claims)
- `functions/seed-super-admin-user.cjs` — one-time seed script (creates super_admin user doc)
- `functions/seed-agent-names.cjs` — one-time seed script (back-fills agentName onto existing submissions)

All four are confirmed in `.gitignore`.

## What NOT to Build (Out of Scope)
- CRM features (leads, contacts, client portfolio)
- Task manager / agenda / calling sessions
- Clock in / clock out
- Campaign tracking (Phase 2 / future)
- Power BI direct integration (future)
- Self-registration (managers create all accounts — no exceptions)
- Any new PDF library — @react-pdf/renderer is final

## Date Format Convention
- **Storage / Firestore / document IDs:** always `YYYY-MM-DD` (ISO). Never change this.
- **Display (UI labels, tables, PDF, dropdowns):** always `DD-MM-YYYY` or friendly format ("Sun, 27 Apr 2026") depending on context.
- Single source of truth for formatting: `src/utils/formatters.js`
  - `formatDateDisplay(isoString)` → `"27-04-2026"`
  - `formatDateFriendly(isoString)` → `"Sun, 27 Apr 2026"`
- **NEVER** display a raw `YYYY-MM-DD` string to the user anywhere in the app.
- Week Starting dropdown: shows last 6 Sundays in friendly format, stores selected value as `YYYY-MM-DD`.

## Phase 8 Plan

### P8A — Weekly Recognition Badges
- Compute Top API / Top Apps / Top Activity from previous week's submitted submissions
- Champions displayed in a banner at the top of Leaderboard.jsx
- Visible to all agents in the unit (not just managers)
- Computed on the fly from existing submissions — no new Firestore collection
- New util: `src/utils/weeklyChampions.js`
- Touches: `Leaderboard.jsx` (add champions banner), `weeklyChampions.js` (new)

## P8B Key Decisions
- Unit Manager can create campaigns scoped to their own unit only
- Branch Manager + Super Admin can create campaigns scoped to: branch-wide, specific unit(s), or specific agent(s)
- Campaign scope stored as: `{ type: 'branch'|'unit'|'agent', unitIds: [], agentIds: [] }`
- Unit Manager campaigns always have `scope.type = 'unit'` and `scope.unitIds = [their unitId]`
- Agent card shows: name, prize, days remaining, per-metric progress bars, mini-rank
- Mini-rank computed client-side from all participant submissions in campaign period
- Progress = sum of metric field from `extractFields()` across all submissions in the campaign date range (`weekStarting >= startDate AND weekStarting <= endDate`)
- Active campaign = today's date is between startDate and endDate (inclusive)
- Firestore path: `/tenants/{tenantId}/campaigns/{campaignId}`

### P8B — Campaign Module
- Branch Manager creates campaigns: name, description, prize, start date, end date
- Each campaign has 1+ metric targets (e.g. API ≥ $50,000 AND Apps ≥ 15)
- Supported metrics: apiSold, applicationsSold, ffiConducted, ciConducted
- Agent dashboard shows a CampaignCard during active campaign periods
- Progress computed from submissions within the campaign date range
- Firestore: `/tenants/{tenantId}/campaigns/{campaignId}`
- Campaign doc shape: `{ id, tenantId, createdBy, createdAt, name, description, prize, startDate, endDate, targets: [{ metric, threshold }], status }`
- New files: `src/components/campaigns/CampaignPanel.jsx`, `src/components/campaigns/CampaignCard.jsx`, `src/services/campaignService.js`
- Touches: ManagerDashboard.jsx (Campaigns tab), AgentDashboard.jsx (CampaignCard when active)

## P8C Key Decisions
- `unitGoals` path: `/tenants/{tenantId}/unitGoals/{unitId}_{year}`
- `branchGoals` path: `/tenants/{tenantId}/branchGoals/{year}`
- Required metrics at both levels: `api`, `apps`
- Optional metrics at both levels: `ffiConducted`, `ciConducted`, `dials`
- Unit Manager can set/update their own unit's goals only
- Branch Manager + Super Admin can set/update any unit's goals AND branch goals
- Gap analysis hierarchy (lowest to highest floor): Personal Commitment → Unit Target → Branch Target → Company Floor
- Company floor comes from existing `/tenants/{tenantId}/config/companyMinimums`
- Gap analysis visible in: Goals section on AgentDashboard dashboard tab, and CareerPortal
- Manager sets unit/branch goals from GoalsPanel.jsx (sub-tabs: Agent Goals | Unit Goals | Branch Goals)

### P8C — Goals Tier 2: Gap Analysis
- Add `unitGoals` and `branchGoals` Firestore collections
- Firestore: `/tenants/{tenantId}/unitGoals/{unitId_year}`, `/tenants/{tenantId}/branchGoals/{year}`
- Gap analysis hierarchy: personal commitment → unit target → branch target → company floor
- Touches: `goalsService.js`, `GoalsPanel.jsx`, `CareerPortal.jsx`

## P8E Key Decisions
- Agent creation uses a callable Cloud Function `createAgentAccount` (client cannot call admin.auth().createUser() directly)
- Unit Manager can create agents in their own unit only; Branch Manager + Super Admin can create agents in any unit
- Contract start date stored as YYYY-MM-DD string on the user profile doc
- New agent receives a password reset email automatically on account creation (Firebase Admin SDK: admin.auth().generatePasswordResetLink())
- Welcome screen shown on first login only — tracked via `hasSeenWelcome` boolean on the Firestore user profile doc
- Welcome screen: 4 slides covering the app's main features
- Campaign notifications: triggered client-side in campaignService.js when a campaign is created with status 'active'

### P8D — Multi-tenancy (DEFERRED → Phase 10)
- White-label theming, tenant config screen, onboarding flow
- Not building until second tenant is confirmed

## Phase 9 Plan — Sales Manager Role

### Overview
`sales_manager` sits between `branch_manager` and `super_admin` in the org hierarchy.
They oversee multiple branches within a single tenant and manage Branch Managers.
**Do NOT add any `sales_manager` code until Phase 9 begins.**

### Scope
- Cross-branch dashboards: see all branches, all units, all agents in a tenant
- Company-wide campaigns: create campaigns visible to all branches
- Goals Tier 3: set Sales Manager targets above branch targets (6th layer)
- Create / manage Branch Manager accounts
- Read-only access to all branch submissions, leaderboards, and reports

### Impact on Existing Features
| Feature | Change needed |
|---------|--------------|
| ManagerDashboard | `sales_manager` sees ALL branches, not filtered by own branch |
| GoalsPanel | Add Sales Manager layer to BranchGoalsTab (set SM target above branch) |
| GapAnalysisPanel | Add 5th bar layer (sales_manager target) |
| gapAnalysis.js | Add `salesManagerTarget` layer to `LAYER_CONFIG` and `computeGapAnalysis` |
| goalsService.js | Add `getSalesManagerGoals`, `setSalesManagerGoals` |
| Firestore path | `/tenants/{tenantId}/salesManagerGoals/{year}` |
| Firestore rules | Add `sales_manager` write access to `salesManagerGoals`, read access to all sub-collections |
| CampaignPanel | `sales_manager` can create branch-wide + cross-branch campaigns |
| Leaderboard | Company-wide view for `sales_manager` |
| userService / authService | `createSalesManager()` (super_admin only) |

### New Files
- `src/components/manager/SalesManagerDashboard.jsx` — cross-branch overview
- (or extend ManagerDashboard with a role-based branch selector)

### Modified Files
- `src/services/goalsService.js` — add getSalesManagerGoals, setSalesManagerGoals
- `src/utils/gapAnalysis.js` — add salesManagerTarget layer
- `src/components/goals/GapAnalysisPanel.jsx` — add 5th bar
- `src/components/manager/GoalsPanel.jsx` — BranchGoalsTab gets SM target row
- `firestore.rules` — salesManagerGoals collection + cross-branch read rules
- `CLAUDE.md` — update goals system docs, role table, Firestore structure

## Phase 10 Plan — Multi-Tenancy Full Rollout

### Overview
Enable the platform to serve multiple insurance companies under isolated tenants.
Deferred until second pilot tenant is confirmed and onboarding flow is scoped.

### Scope
- Tenant onboarding flow (Super Admin creates new tenant)
- White-label theming per tenant (logo, primary colour, company name)
- Tenant config screen: edit companyMinimums, currency display, feature flags
- Tenant isolation audit: verify all Firestore reads/writes are correctly scoped to `tenantId`
- Billing / subscription hooks (if required)
- Separate Vercel deployment per tenant OR subdomain routing

### Prerequisites before starting Phase 10
- At least one confirmed second pilot tenant
- Decision on deployment model (shared app + subdomain vs. per-tenant deploy)
- Data migration plan for existing tatillife_south data

## Pilot Prep Checklist

### Account Setup
- [ ] Create Branch Manager account via Firebase Console
- [ ] Create Unit Manager account via Firebase Console
  (set role=unit_manager, tenantId=tatillife_south, unitId)
- [ ] Log in as Unit Manager → create first real agent via Team tab
- [ ] Verify agent receives password reset email
- [ ] Verify agent's WelcomeScreen appears on first login

### Configuration
- [ ] Set company minimums via Super Admin config
  (< 2 years: $250K API / 40 apps, 2–5 years: $350K / 40 apps, 6+: $500K / 40 apps)
- [ ] Set branch goals for current year via GoalsPanel → Branch Goals
- [ ] Set unit goals for pilot unit via GoalsPanel → Unit Goals
- [ ] Verify GapAnalysisPanel shows all layers for agent

### End-to-End Wizard Test
- [ ] Log in as test agent (kelsean@gmail.com)
- [ ] Submit a full wizard — all 5 grouped screens
- [ ] Verify submission appears in MasterSheet
- [ ] Verify submission appears in CompliancePanel as submitted
- [ ] Verify KPI dashboard updates after submission
- [ ] Verify WeeklyChampionsBanner updates in Leaderboard

### Notifications
- [ ] Verify Sunday 6 PM nudge fires (check Firebase Functions logs)
- [ ] Verify Monday 7 AM nudge fires
- [ ] Verify Monday 9:01 AM deadline flag fires + notifies manager
- [ ] Create an active campaign → verify participants receive notification
- [ ] Check NotificationDrawer shows all notifications correctly

### Manager Flows
- [ ] Unit Manager: Meeting Mode — group + 1-on-1
- [ ] Unit Manager: Persistency entry for an agent
- [ ] Branch Manager: Settlement confirmation
- [ ] Branch Manager: Campaign creation (branch-wide)
- [ ] Verify MasterSheet CSV export works

### Mobile Audit
- [ ] Test on Android phone — wizard submission
- [ ] Test on iOS phone — wizard submission
- [ ] Verify all touch targets ≥ 44px
- [ ] Verify no horizontal scroll on mobile dashboard
- [ ] Verify WelcomeScreen renders correctly on small screen

### Known Issues / Pre-Pilot Fixes
(populate as issues are found during testing)

## Session Protocol
1. Always read this file + CLAUDE.md before writing any code
2. Run `npm run repomix` to get fresh codebase snapshot before each session
3. Confirm current phase before writing new files
4. After all changes, run `npm run dev` and confirm no build errors
5. Commit with descriptive message before ending session
6. For pilot prep: work through checklist items in order, document
   any bugs found in the Known Issues section above before fixing them.
