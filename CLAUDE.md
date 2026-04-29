# AgencyTrack — Claude Code Project Memory

## What This App Is
Insurance sales activity tracking SaaS for Tatil Life, Trinidad & Tobago.
Agents submit weekly reports. Managers review them. Built to scale to multiple companies.

## Commands
- `npm run dev` — Start dev server at localhost:5173
- `npm run build` — Production build to dist/
- `npm run repomix` — Generate Claude context snapshot
- `firebase deploy --only functions` — Deploy Cloud Functions
- `firebase deploy --only firestore:rules` — Deploy Firestore rules
- `firebase serve` — Run Firebase emulator locally
- `git push` — Triggers auto-deploy to Vercel

## Tech Stack
- React 19 + Vite (not Create React App)
- Firebase Firestore (not Realtime DB)
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
  utils/       ← calculations, validators, formatters, constants, dateHelpers
  components/
    auth/      ← LoginScreen
    onboarding/← WelcomeScreen
    dashboard/ ← AgentDashboard, ManagerDashboard, KPICard, GrowthChart
    wizard/    ← WizardForm, steps/ (7 steps)
    manager/   ← MasterSheet, ComplianceTracker, MeetingMode
    profile/   ← ProfileScreen, CareerPortal
    gamification/ ← Leaderboard, BadgeGrid
    ui/        ← Shared components
  styles/      ← index.css (design tokens), wizard.css, dashboard.css
```

## Domain Rules (NEVER BREAK THESE)
- Currency is always TTD — use `formatCurrency()` from formatters.js
- API = Annual Premium Income (primary production metric, always numeric)
- All numeric fields: `parseFloat()` enforced before saving to Firestore
- Week Starting date: must always be a Sunday — use `validateSundayDate()` from validators.js
- FFI = Fact Finding Interview | CI = Closing Interview
- No self-registration — managers create all accounts

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
  submissions/{submissionId}
  persistency/{agentId_YYYY_MM}
  goals/{goalId}
  leaderboard/{userId}
  notifications/{notificationId}
```

## Design System — Nexus
```css
--color-primary: #01696f    (teal)
--color-bg: #f7f6f2         (warm beige)
--color-surface: #ffffff
--color-text: #28251d
--color-success: #2d7a4f
--color-warning: #b45309
--color-danger: #c0392b
```
Fonts: Satoshi (body) + Cabinet Grotesk (display) from Fontshare
NO gradient buttons. NO inline styles. ALL styling via Tailwind + CSS variables.
Minimum 44px touch targets (mobile agents in field).

## Current Build Phase
Phase 1 — Firebase + Auth setup

## Critical Decisions Made
- Build on existing repo codebase patterns, new Firebase project (agencytrack)
- Firestore (not Realtime DB) — better querying for Master Sheet
- Email link auth (passwordless) — no password management
- Wizard: 7 steps (consolidated from 12)
- Multi-tenant from day one — SaaS ambition beyond Tatil Life
- Gamification layer is SEPARATE from official Tatil Life career levels (1-7)
- Service work section collapses if agent has no service work (UX win)
- API field must strip $ sign on input and enforce parseFloat()

## What NOT to Build (Out of Scope)
- CRM features (leads, contacts, client portfolio)
- Task manager / agenda / calling sessions
- Clock in / clock out
- Campaign tracking (Phase 2)
- Power BI direct integration (future)

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

## Critical Instruction for Claude Code
Always write files directly to disk. Never use worktrees or branches. 
Work only on main. After writing files, always run npm run dev to verify zero errors.