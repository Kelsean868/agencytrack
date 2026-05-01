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
- Firebase Auth (email link — passwordless)
- Firebase Cloud Functions (Node 20)
- Tailwind CSS + CSS custom properties
- Recharts for charts
- Lucide React for icons
- Hosted on Vercel

## Architecture
```
src/
  context/     ← AuthContext, TenantContext, NotificationContext
  hooks/       ← useAuth, useSubmissions, useAgentMetrics, usePersistency
  services/    ← firebaseService, authService, submissionService, exportService
  utils/       ← calculations, validators, formatters, constants, dateHelpers, extractFields
  components/
    auth/         ← LoginScreen
    onboarding/   ← WelcomeScreen
    dashboard/    ← AgentDashboard, ManagerDashboard, KPICard, GrowthChart
    wizard/       ← WizardForm, steps/ (Steps 1–9)
    manager/      ← MasterSheet, CompliancePanel, MeetingMode, PersistencyPanel
    profile/      ← ProfileScreen, CareerPortal
    gamification/ ← Leaderboard, BadgeGrid
    ui/           ← Shared components
  styles/      ← index.css (design tokens), wizard.css, dashboard.css
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
```
super_admin (Kyron) — all access + sensitive system config
branch_manager — full branch, create accounts across all units
unit_manager — own unit only, create accounts for own agents
agent — own data only
```
Role is stored in Firebase custom claims AND in Firestore `/tenants/{id}/users/{uid}.role`

## Firestore Structure
```
/tenants/{tenantId}/
  config/settings
  users/{userId}
  submissions/{submissionId}                    ← weekly wizard submissions
  persistency/{agentId_YYYY_MM}                ← manager-entered persistency %
  goals/{goalId}
  leaderboard/{userId}
  notifications/{notificationId}
  settlements/{agentId}_{year}_{periodKey}     ← confirmed production data entered by branch manager
```

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
**Phase 6 — Feature Set B Complete**

## Build Phase Status
| Phase | Scope | Status |
|-------|-------|--------|
| P1 | Firebase + Auth setup | ✅ COMPLETE |
| P2 | Login + Auth flow + Agent Dashboard | ✅ COMPLETE |
| P3 | 9-step Weekly Wizard with auto-save | ✅ COMPLETE |
| P4 | Manager Views + Meeting Mode + Persistency | ✅ COMPLETE |
| P5 | Notifications + Career Portal + Gamification | ✅ COMPLETE |
| P6 | History Viewer + Awards Tracker + Settlement Confirmation + Motivational Carousel | ✅ COMPLETE |

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

## Session Protocol
1. Always read this file + CLAUDE.md before writing any code
2. Run `npm run repomix` to get fresh codebase snapshot before each session
3. Confirm current phase before writing new files
4. After all changes, run `npm run dev` and confirm no build errors
5. Commit with descriptive message before ending session
