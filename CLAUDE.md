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

## Workflow — IMPORTANT
- **Never push directly to main.** Production auto-deploys from main on every merge.
- Claude Code uses worktree branches by default. Push branch, open PR, verify Vercel preview, merge manually.
- Vercel preview URL pattern: `agencytrack-git-{branch}.vercel.app`
- Always smoke-test the preview URL in incognito before merging
- After merge, do a 60-second smoke test on production

## Tech Stack
- React 19 + Vite (not Create React App)
- Firebase Firestore (not Realtime DB) — project: agencytrack-2a610
- Firebase Auth: email + password (NOT email link — passwordless was abandoned, too unreliable for field agents)
- Firebase Storage: profile photos at avatars/{tenantId}/{uid}.jpg
- Firebase Cloud Functions (Node 20)
- Tailwind CSS + CSS custom properties (theme system below)
- @react-pdf/renderer: PDF generation (html2canvas was REMOVED)
- vite-plugin-pwa: PWA + offline support
- Recharts for charts
- Lucide React for icons
- jsPDF: kept only for branch CSV export
- Hosted on Vercel

## Theme System — Nexus (Warm Theme)

### Color tokens — CSS variables in src/index.css
All Tailwind utilities resolve through CSS variables. Tailwind config maps token names to `var(--color-*)`.

**Light mode (`:root`):**
- `--color-bg: #f7f6f2` (warm beige page bg)
- `--color-surface: #ffffff` (cards)
- `--color-surface-raised: #fafaf8` (elevated)
- `--color-text: #28251d`
- `--color-text-muted: #6b6560`
- `--color-primary: #01696f` (teal)
- Shadows: warm beige drop

**Dark mode (`.dark`):** Bear/Apple Notes aesthetic
- `--color-bg: #1a1612` (warm near-black)
- `--color-surface: #252019` (warm dark cards)
- `--color-surface-raised: #302a23` (elevated)
- `--color-text: #f0ebe0` (warm off-white)
- `--color-text-muted: #b8aea0` (warm muted, softer contrast)
- `--color-primary: #4ab5b8` (lifted teal for legibility)
- Shadows: pure black drop

### Tailwind utilities
- `bg-surface` → page background (`var(--color-bg)`)
- `bg-card` → card surface (`var(--color-surface)`)
- `bg-card-raised` → elevated surface (`var(--color-surface-raised)`)
- `shadow-sm/md/lg` → CSS-var-driven, theme-aware

### Dark mode toggle
- Toggles `dark` class on `document.documentElement`
- Persists to `localStorage.agencytrack-dark`
- Restored in `src/main.jsx` BEFORE React mount (no FOUC)
- Toggle button lives in header of AgentDashboard + ManagerDashboard

### Fonts
Satoshi (body) + Cabinet Grotesk (display) from Fontshare CDN

### UI rules
- NO gradient buttons. NO inline styles.
- ALL styling via Tailwind classes + CSS variables.
- Minimum 44px touch targets (mobile agents in field).
- AgentReportDocument.jsx is EXEMPT — react-pdf doesn't support CSS vars, uses HEX only.

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
| P7C | Dark mode toggle, photos in Leaderboard+MeetingMode, SVG login, PWA | ✅ COMPLETE |
| P8A | Weekly Recognition Badges | ✅ COMPLETE |
| P8B | Campaign Module (manager panel + agent progress) | ✅ COMPLETE |
| P8C | Goals Tier 2 — gap analysis (unitGoals + branchGoals) | ✅ COMPLETE |
| P8D | Multi-tenancy rollout | ⏳ Deferred to P10 |
| P8E | Agent Management + Campaign Notifications + Welcome Screen | ✅ COMPLETE |
| Dark Mode Hotfix | Warm palette + CSS-var theme system + persistence | ✅ COMPLETE |
| Track A | Security/perf hardening | 🔄 NEXT |
| Pilot Prep | End-to-end testing, account setup, mobile audit | ⏸️ DEFERRED (app not at Tatil yet) |
| P9  | Sales Manager role | ⏳ Planned (post-pilot) |
| P10 | Multi-tenancy full rollout | ⏳ Deferred |

## Current Phase
**Pre-Tatil-demo polish.** App has not been demoed to Tatil yet. Goal: ship app close to v1.0 because Kyron is also the decision-maker for the branch and wants minimal rework after pilot.

**Active task:** Track A — security & performance hardening (4 fixes across firestore.rules, WizardForm, AgentDashboard, firebase.js).

**Then:** Track B — visible polish (mobile audit, loading/error states, WelcomeScreen copy, hardcoded color sweep).

**Then:** Track C — configuration & data (real Tatil accounts, company minimums, 2026 goals, persistency historicals).

**Then:** Track D — cron + notifications verification.

## Key Technical Decisions
- Auth: email + password. Passwordless email link was abandoned — unreliable for field agents with intermittent connectivity.
- Wizard: Step1–Step9 files are NEVER modified. WizardForm.jsx groups them into 5 screens. Revert to 9 steps = one git revert on WizardForm.jsx only.
- PDF: @react-pdf/renderer ONLY. html2canvas removed — had unfixable text alignment issues in production.
- AgentReportDocument.jsx: HARDCODED HEX colours only. No CSS variables — react-pdf cannot resolve them.
- extractFields.js: ONLY way to read submission fields. Never access raw Firestore fields directly.
- Profile photos: Firebase Storage at avatars/{tenantId}/{uid}.jpg. photoURL in Firestore user doc. Shown in ProfileScreen, Leaderboard, MeetingMode.
- PWA: vite-plugin-pwa + Workbox. Firestore offline persistence via enableIndexedDbPersistence(db) in firebase.js — **TRACK A WILL MIGRATE TO persistentLocalCache (deprecated API)**.
- Theme system: Tailwind tokens in `tailwind.config.js` resolve through `var(--color-*)` (NOT hardcoded hex). Adding new utilities requires updating BOTH `:root` and `.dark` blocks in `src/index.css` with the same variable names.
- Goals system (5 layers, full hierarchy):
  1. **Personal Commitment** — agent sets own target (≥ company floor) — `goals/{goalId}` ✅ built
  2. **Unit Target** — unit manager sets target — `unitGoals/{unitId}_{year}` ✅ built
  3. **Branch Target** — branch manager sets target — `branchGoals/{year}` ✅ built
  4. **Company Floor** — super admin sets minimum floor — `config/companyMinimums` ✅ built
  5. **Sales Manager Target** — cross-branch layer (planned Phase 9, not yet built)
  Gap analysis fetched via `getGoalHierarchy(tenantId, unitId, year, agentId)` in goalsService.js. Displayed in AgentDashboard Goals section and CareerPortal via `GapAnalysisPanel.jsx`.

## Architecture
```
src/
  context/        ← AuthContext, NotificationContext
  hooks/          ← useAuth, useSubmissions, useAgentMetrics
  services/       ← authService, submissionService, exportService,
                     goalsService, managerService, notificationService,
                     persistencyService, settlementService,
                     unlockService, userService, agentManagementService,
                     campaignService
  utils/          ← awardsEngine, campaignEngine, dateHelpers,
                     extractFields, formatters, gapAnalysis,
                     validators, weeklyChampions
  components/
    auth/         ← LoginScreen (SVG pattern background)
    awards/       ← AgentAwardsPanel, ManagerAwardsPanel
    campaigns/    ← CampaignCard, CampaignPanel
    dashboard/    ← AgentDashboard, ManagerDashboard,
                     KPICard, MotivationalCarousel
    gamification/ ← Leaderboard (AgentAvatar), BadgeGrid
    goals/        ← CommissionPlayground, GapAnalysisPanel
    manager/      ← MasterSheet, CompliancePanel, GoalsPanel,
                     MeetingMode (AgentAvatar), PersistencyPanel,
                     SettlementPanel, AgentManagementPanel
    onboarding/   ← WelcomeScreen
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
sales_manager        — cross-branch visibility, company-wide campaigns
                       (planned Phase 9, NOT YET IMPLEMENTED)
branch_manager       — full branch, create accounts across all units
unit_manager         — own unit only, create accounts for own agents
agent                — own data only
```
Role is stored in Firebase custom claims AND in Firestore `/tenants/{id}/users/{uid}.role`

> **Note:** `sales_manager` role is defined here for planning purposes only.
> Do not add `sales_manager` checks to any component until Phase 9 begins.

## Firestore Structure
```
/tenants/{tenantId}/
  config/settings              ← companyMinimums, tenant config
  users/{userId}               ← profile, role, photoURL, phone, bio, unitId
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

### Submission Document Shape (flat schema — current wizard)
All fields stored at document root (NOT nested under step1, step2, etc.).
Use `extractFields()` in `src/utils/extractFields.js` — single source of truth for reading submission KPI fields. Three schema variants supported: nested (future), flat current, flat legacy.

### Persistency Document Shape
```
{
  agentId, agentName, tenantId,
  year, month,           // month = 1–12
  persistency,           // parseFloat, 0–100
  enteredBy,             // uid of manager
  enteredAt              // Firestore Timestamp
}
```

## Sensitive Files — Never Commit
- `functions/service-account-key.json` — Firebase Admin SDK key
- `functions/set-super-admin.cjs` — one-time Admin SDK script
- `functions/seed-super-admin-user.cjs` — one-time seed script
- `functions/seed-agent-names.cjs` — one-time seed script

All four are confirmed in `.gitignore`.

## Known Open Items (Track A targets)
1. **firestore.rules**: hardcoded super_admin UID (`4GeeZbhZBwdtGOLoJoggf4MQo142`) bypasses tenant scoping — must remove
2. **firestore.rules**: leaderboard reads not tenant-scoped (cross-tenant leak risk when 2nd tenant onboards)
3. **firestore.rules**: notification reads not tenant-scoped (same issue)
4. **firestore.rules**: unit_managers can write any user in tenant (should be scoped to own unit)
5. **WizardForm.jsx**: auto-save fires on every keystroke (no debounce) — Firestore cost + battery drain
6. **WizardForm.jsx**: auto-save errors silently swallowed — agents lose data without warning
7. **AgentDashboard.jsx**: dead html2canvas off-screen mount + 900ms setTimeout still active
8. **firebase.js**: `enableIndexedDbPersistence` is deprecated, migrate to `persistentLocalCache`

## Cosmetic Inconsistencies (low priority, not blocking)
- `MotivationalCarousel.jsx:367` uses hex literal `bg-[#01696f]/8` instead of CSS var
- A few components use `bg-[var(--color-surface)]` arbitrary syntax instead of `bg-card` utility — works fine, just inconsistent

## Session Protocol
1. Always read this file before writing any code
2. Run `npm run repomix` to get fresh codebase snapshot before each session
3. Confirm current phase before writing new files
4. Work on a feature branch (Claude Code default), never main directly
5. After all changes, run `npm run dev` and confirm no build errors
6. Push branch, open PR, verify Vercel preview URL in incognito
7. User merges PR manually — only then does production update
8. After merge, do a 60-second production smoke test