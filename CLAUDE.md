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
- Vercel preview URL pattern: `agencytrack-git-{branch}-kyron-marchan-s-projects.vercel.app`. The bare `agencytrack-git-{branch}.vercel.app` form is NOT what Vercel emits — per-team URLs include the team slug. Banked from PR #52 retrospective.
- Always smoke-test the preview URL in incognito before merging
- After merge, do a 60-second smoke test on production
- **`.env.local` does NOT auto-propagate to feature worktrees.** Verification scripts that depend on `A11Y_*_EMAIL` / `A11Y_*_PASSWORD` (or `VERCEL_BYPASS_TOKEN`) need explicit setup in each worktree before they will run — the file is gitignored, so `git worktree add` does not copy it. Either copy `.env.local` from the main worktree (`cp ../AgencyTrack/.env.local .`) or run verification scripts from the main worktree against the preview URL. Banked from PR #52 retrospective.
- **`.env.local` — use, don't echo.** Programmatic reads of `.env.local` (scripts, `process.env.X`, `$env:X` substitution into commands, `firebase deploy` reading credentials) are fine and expected. **Never echo the values to chat output, PR descriptions, commit messages, logs, or screenshots** — reference by env-var name only. The file is gitignored to keep secrets out of the repo; the use-vs-echo distinction extends the same protection to ephemeral surfaces. Banked from C1 close.
  - Extended traps (banked from C2 close): never `cat` / `echo` / `head` / `less` / `type` / `grep` files containing token values. Never construct a URL with a token query-param and pass it as a tool param — use cookie injection or purpose-built scripts. **If a tool mechanism forces a token into a string param: STOP and surface, never work around.**
- **Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges.** When a PR introduces a *purely additive* change, it is safe to deploy from the feature worktree ahead of merge so the Vercel preview can exercise the new code path against real production rules / functions. Capture the deploy output in the PR description. Pre-merge deploys are permitted for:
  - `firestore.rules`: new `match /...` blocks for new paths (no edits to existing rules).
  - Cloud Functions: new exports (no edits to existing functions).
  - Cloud Functions: modifications to existing exports where new behavior is gated by new input fields not present in existing callers (defense: existing callers fall through to existing behavior, no regression vector). C2's `doCreateUser` extension for optional `data.branchId` / `data.csvImportBatchId` / `data.importedFromCsv` is the canonical example.
  Modifications where existing callers exercise the new behavior → post-merge only. Banked from C1 close (rules block deployed pre-merge for BranchesPanel preview); generalized to Cloud Functions in C2.
- **Squash SHA ≠ feature-branch SHA.** GitHub generates a fresh SHA on squash-merge (the feature branch's pre-squash final commit is NOT what lands on main). Kickoff briefs and CONTEXT.md `Recently shipped` rows must record the squash SHA captured from `git log origin/main --oneline -1` post-merge, not the feature branch's pre-squash final SHA. Banked from C2 close.
- **Admin-script firebase-admin require path.** `firebase-admin` is installed only in `functions/node_modules`, not at the repo root. Scripts at `scripts/` or `verification/` that use the Admin SDK must either `require('../functions/node_modules/firebase-admin')` (relative to the script's location) or run from inside `functions/`. Adding `firebase-admin` to repo-root `package.json` is intentionally avoided — Cloud Functions packaging is the canonical install path. Banked from C2 close.
- **Cloud Functions auth: ambient credentials, not key files.** Functions that mint custom tokens (`admin.auth().createCustomToken(...)`) or otherwise call `signBlob` must use the App Engine default service account's ambient credentials via plain `admin.initializeApp()` — **never ship `service-account-key.json` in the deploy bundle**. Ambient credentials need `roles/iam.serviceAccountTokenCreator` granted to the SA on itself. One-time setup:
  ```
  gcloud iam service-accounts add-iam-policy-binding \
    <project>@appspot.gserviceaccount.com \
    --member=serviceAccount:<project>@appspot.gserviceaccount.com \
    --role=roles/iam.serviceAccountTokenCreator
  ```
  Why: a checked-in (or bundled-but-gitignored) key file is a long-lived credential leak vector. Ambient credentials rotate automatically and never sit on disk. Reference: PR #78 — `chore(security): remove service-account-key.json from CF deploy, use ambient credentials`.
- **Order matters when removing key-file workarounds.** Sequence is **non-negotiable** to avoid production downtime:
  1. **IAM grant first** — verify `roles/iam.serviceAccountTokenCreator` is in place via `gcloud iam service-accounts get-iam-policy`.
  2. **Code change second** — replace `admin.initializeApp({ credential: admin.credential.cert(...) })` with plain `admin.initializeApp()`.
  3. **Deploy third** — `firebase deploy --only functions`.
  4. **Smoke test fourth** — production smoke test in incognito (login, custom-token-minting flows). Mandatory before key removal.
  5. **Key file deletion last** — only after smoke test passes. Reverse order risks production auth failures with no rollback safety net. Banked from PR #78 retrospective.

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
| A11y Trilogy + Mobile Audit | PR #30, #33, #34, #35, #36, #37, #38 — agent + manager surfaces + dark mode + mobile pilot pass | ✅ COMPLETE |
| Track A | Security/perf hardening | ✅ COMPLETE — all 4 fixes shipped (see § Track A — Historical Items) |
| Track B (v2) | Design System v2 — "Concept 4 Complete" redesign (5 sub-PRs B1–B5) | 📋 PLANNED — see `docs/design-v2-PRD.md` |
| Pilot Prep | End-to-end testing, account setup, mobile audit | ⏸️ DEFERRED (app not at Tatil yet) |
| P9  | Sales Manager role | ⏳ Planned (post-pilot) |
| P10 | Multi-tenancy full rollout | ⏳ Deferred |

## Current Phase
**Pre-Tatil-demo polish.** App has not been demoed to Tatil yet. Goal: ship app close to v1.0 because Kyron is also the decision-maker for the branch and wants minimal rework after pilot.

**Track A — security & performance hardening — COMPLETE** (all 4 originally-listed fixes shipped: firestore.rules SEC-2/3/4, WizardForm debounce + error UI, AgentDashboard html2canvas mount removed, firebase.js `persistentLocalCache` migration). Next: Track B (v2) — Design System v2.

**Then:** Track B (v2) — Design System v2 redesign. Replaces the original "visible polish" Track B scope. Ships in 5 sub-PRs (B1 medal badges, B2 goal carousel, B3 activity feed, B4 sidebar shell, B5 tenant admin config). Canonical spec: [`docs/design-v2-PRD.md`](docs/design-v2-PRD.md). Phased plan: [`docs/design-v2-implementation.md`](docs/design-v2-implementation.md). Visual source of truth: [`mocks/concept-4-complete.html`](mocks/concept-4-complete.html). Goal is visual parity with the mock at 1440px / 1024px / 768px / 390px in both light and dark mode.

**Then:** Track C — configuration & data (real Tatil accounts, company minimums, 2026 goals, persistency historicals). Note: B5 covers the company-minimums UI surface ahead of Track C.

**Then:** Track D — cron + notifications verification.

## Key Technical Decisions
- Auth: email + password. Passwordless email link was abandoned — unreliable for field agents with intermittent connectivity.
- Wizard: Step1–Step9 files are NEVER modified. WizardForm.jsx groups them into 5 screens. Revert to 9 steps = one git revert on WizardForm.jsx only.
- PDF: @react-pdf/renderer ONLY. html2canvas removed — had unfixable text alignment issues in production.
- AgentReportDocument.jsx: HARDCODED HEX colours only. No CSS variables — react-pdf cannot resolve them.
- extractFields.js: ONLY way to read submission fields. Never access raw Firestore fields directly.
- Profile photos: Firebase Storage at avatars/{tenantId}/{uid}.jpg. photoURL in Firestore user doc. Shown in ProfileScreen, Leaderboard, MeetingMode.
- PWA: vite-plugin-pwa + Workbox. Firestore offline persistence via `initializeFirestore` + `persistentLocalCache` in `src/firebase.js:23-27` (migrated from deprecated `enableIndexedDbPersistence`).
- Theme system: Tailwind tokens in `tailwind.config.js` resolve through `var(--color-*)` (NOT hardcoded hex). Adding new utilities requires updating BOTH `:root` and `.dark` blocks in `src/index.css` with the same variable names.
- Goals system (5 layers, full hierarchy):
  1. **Personal Commitment** — agent sets own target (≥ company floor) — `goals/{goalId}` ✅ built
  2. **Unit Target** — unit manager sets target — `unitGoals/{unitId}_{year}` ✅ built
  3. **Branch Target** — branch manager sets target — `branchGoals/{year}` ✅ built
  4. **Company Floor** — tenant_admin sets minimum floor — `config/companyMinimums` ✅ built
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
                     SettlementPanel, UserManagementPanel
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
**Agent → Unit Manager → Branch Manager → Sales Manager → Tenant Admin → Platform Admin**

```
platform_admin       — cross-tenant. Lives outside any tenant. Kyron only.
tenant_admin         — all access within a single tenant + sensitive system config
sales_manager        — cross-branch visibility, company-wide campaigns
branch_manager       — full branch, create accounts across all units
unit_manager         — own unit only, create accounts for own agents
agent                — own data only
```
Role is stored in Firebase custom claims AND in Firestore `/tenants/{id}/users/{uid}.role` (`platform_admin` has no Firestore user doc — claim only, with `tenantId: null`).

> **`super_admin` retired in PR-3.** All `super_admin` claim holders and UI branches removed.
> Bootstrap the first `tenant_admin` for a new tenant via `functions/scripts/seed-first-tenant-admin.cjs`.
> Bootstrap a `platform_admin` (cross-tenant operator) via `functions/scripts/seed-platform-admin.cjs`.

> **Status:** `sales_manager` is recognized as a manager role from PR-1 onward
> (firestore.rules `isManager`, App.jsx MANAGER_ROLES, etc.). Branch-aware
> permission grants and cross-branch UI logic ship in PR-2/PR-3 of the user-mgmt track.

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
- `functions/set-super-admin.cjs` — historical bootstrap script (super_admin era, retired PR-3); gitignored
- `functions/seed-super-admin-user.cjs` — historical seed script (super_admin era, retired PR-3); gitignored
- `functions/seed-agent-names.cjs` — one-time seed script

All four are confirmed in `.gitignore`.

## Tool installation policy

CC may install without surfacing:
- Project-local dev dependencies (npm/pip packages, vitest/eslint plugins, anything in node_modules or project-local)

CC must surface intent then proceed (no per-instance approval needed):
- Standard CLI tools from official sources (gcloud, gh, gsutil, firebase-tools)
- IDE extensions, dotfile additions
- Global npm/pip packages

CC must STOP and surface BEFORE installing:
- Anything requiring auth/credentials (CC can't complete auth alone — Kelsean must)
- Paid tools or services with cost implications
- Tools modifying system PATH or registry beyond standard installer behavior
- Anything from non-official or unverified sources

When in doubt, surface and ask.

## Track A — Historical Items (all resolved)
1. **functions/index.js**: hardcoded `SUPER_ADMIN_UID` bypass — **RESOLVED in user-mgmt PR-2** (bypass removed; `SUPER_ADMIN_UID` const deleted; AuthContext bootstrap deleted; SEC-11 closed; claims seeded via `seed-first-tenant-admin.cjs`)
2. **firestore.rules**: leaderboard reads not tenant-scoped — RESOLVED in SEC-2
3. **firestore.rules**: notification reads not tenant-scoped — RESOLVED in SEC-3
4. **firestore.rules**: unit_managers can write any user in tenant — RESOLVED in SEC-4 (callerUnitId helper)
5. **WizardForm.jsx**: auto-save fires on every keystroke (no debounce) — **RESOLVED** (commit `57828d7`, 2026-05-02). Auto-save was already debounced at 1500ms in `WizardForm.jsx:194-211` (verified 2026-05-06).
6. **WizardForm.jsx**: auto-save errors silently swallowed — **RESOLVED** (commit `57828d7`, 2026-05-02). Save errors surfaced via `AlertTriangle` + "Save failed — check connection" inline indicator in `WizardForm.jsx:153, 199-208, 306-311` (verified 2026-05-06). Genuine hardening opportunities (retry button, success indicator, offline-vs-failed distinction, `aria-live`) tracked in `docs/FOLLOW_UPS.md` § Wizard UX + A11y Hardening.
7. **AgentDashboard.jsx**: dead html2canvas off-screen mount + 900ms setTimeout — **RESOLVED** (commit `0e9b6f2`, 2026-05-02): `refactor(dashboard): remove dead off-screen AgentReportDocument mount`. Verified: only an innocuous comment reference remains at `AgentReportDocument.jsx:5` (describes why react-pdf is used instead of html2canvas).

## Cosmetic Inconsistencies (low priority, not blocking)
- `MotivationalCarousel.jsx:367` uses hex literal `bg-[#01696f]/8` instead of CSS var
- A few components use `bg-[var(--color-surface)]` arbitrary syntax instead of `bg-card` utility — works fine, just inconsistent

## Lint Policy

`npm run lint` must exit 0 before any push. This is enforced by `.github/workflows/ci.yml` (lint + build on every PR to main).

**Baseline:** 0 errors, 0 `jsx-a11y` warnings (3 deferred `react-hooks/exhaustive-deps` warnings tracked separately, addressed in PR #33 → PR #38).

**React Compiler rules disabled:** `eslint-plugin-react-hooks` v7 ships React Compiler lint rules (`set-state-in-effect`, `purity`, `preserve-manual-memoization`, etc.) in its `flat.recommended` preset. This project does not use `@babel/plugin-react-compiler`, so all Compiler-only rules are set to `off` in `eslint.config.js`. If the Compiler is ever adopted, remove those overrides and fix the flagged sites.

**`_` prefix convention:** Variables that must appear in a destructuring/param list but are intentionally unused should be prefixed with `_` (e.g. `_agentId`, `_ws`). The lint rule is configured to ignore `/^_/` patterns.

## Session Protocol
1. Always read this file before writing any code
2. Run `npm run repomix` to get fresh codebase snapshot before each session
3. Confirm current phase before writing new files
4. Work on a feature branch (Claude Code default), never main directly
5. After all changes, run `npm run lint && npm run build` — both must pass before pushing
6. Push branch, open PR — CI will run lint + build automatically on GitHub
7. Verify Vercel preview URL in incognito
8. User merges PR manually — only then does production update
9. After merge, do a 60-second production smoke test
9.5. After merge, before running production verification: `git fetch origin --prune && git pull origin main`. The pull ensures worktree-local tooling (especially `scripts/exploration-walk.cjs` and any other verification scripts) matches the merged state on origin. Fetching alone leaves verification scripts at pre-merge versions and they may run stale (lesson from B3 post-merge — PR #49). The `--prune` flag deletes stale remote-tracking refs for branches GitHub already removed via `deleteBranchOnMerge`, so `git branch -r` stays clean and `git branch --merged` returns accurate results — without it, post-squash refs accumulate across PRs (banked from PR #57 cleanup).

### Post-merge local cleanup (standard sequence, not exception)

After step 9.5's pull and after capturing the squash SHA from `git log origin/main --oneline -5`:

- **Local branch deletion uses `git branch -D <feature-branch>` (force).** With GitHub's `deleteBranchOnMerge: true` enabled on the repo, the remote tracking ref is pruned automatically before local cleanup runs, so `git branch -d` (lowercase) cannot verify merge status and will refuse. `git branch -D` is the correct tool here — the squash SHA captured one step earlier verifies the diff is preserved in main. Reference: PR #50 retrospective, B3 post-merge.
- **Untracked-doc collision on `git pull`:** If `git pull` aborts with `error: The following untracked working tree files would be overwritten by merge: <path>` for a doc that was drafted in the main worktree before opening its PR from a sibling worktree, this is the expected collision pattern (origin has the merged version, main worktree still has the local untracked draft). Resolve by:
  1. `git hash-object <local-path>` and compare against `git show origin/main:<path> | git hash-object --stdin`.
  2. If hashes match, content is identical — `rm <local-path>` and re-run `git pull`.
  3. If hashes don't match, the local copy has unmerged edits — surface as a real conflict, do not auto-resolve.

  Prevention (preferred): When opening a docs-only PR, draft the file directly inside the PR's feature worktree, not the main worktree. This keeps main's working tree clean and avoids the collision entirely. Reference: PR #51 retrospective, B-series cleanup pattern across PRs #45, #50, #51.

### Single-branch PR rule
One worktree branch = one PR. Never extend an open PR by pushing unrelated work to its branch.
If scope grows mid-PR, open a follow-up PR on a fresh branch after the current one merges.
Claude Code creates worktree branches automatically — each maps 1:1 to a PR.

- **Always sync before branching:** run `git fetch origin && git pull origin main` before
  creating a new branch off main. PR #31 (lint cleanup) was cut while A11Y PR2 was still
  open; PR2 merged first and both had touched `ManagerAwardsPanel.jsx`, producing a
  conflict that required a manual merge commit. Pulling latest main before branching
  eliminates this class of conflict entirely.