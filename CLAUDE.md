# AgencyTrack — Claude Code Project Memory

## What This App Is
Insurance sales activity tracking SaaS for Tatil Life, Trinidad & Tobago.
Agents submit weekly reports. Managers review them. Built to scale to multiple companies.
Firebase project: agencytrack-2a610 | App: portal.agencytrack.app | Marketing: agencytrack.app | Repo: github.com/Kelsean868/agencytrack

## Commands
- `npm run dev` — Start dev server at localhost:5173
- `npm run build` — Production build to dist/
- `npm run repomix` — Generate Claude context snapshot (run before every session)
  - Scope: pack only the active track's src/ subtree for pure React tracks (K9, planner, goals). Pack full — or grep full — the moment a brief touches functions/. That tree has no trusted structural index, so a scoped pack there is building on stale anchors (Rule 17). Never scope a functions/-touching pack.
- `firebase deploy --only functions` — Deploy Cloud Functions
- `firebase deploy --only firestore:rules` — Deploy Firestore rules
- `firebase deploy --only firestore:indexes` — Deploy Firestore composite indexes
- `firebase serve` — Run Firebase emulator locally

## Workflow — IMPORTANT
- **Never push directly to main.** Production auto-deploys from main on every merge.
- Claude Code uses worktree branches by default. Push branch, open PR, verify Vercel preview, merge manually.
- Vercel preview URL pattern: `agencytrack-git-{branch}-kyron-marchan-s-projects.vercel.app`. The bare `agencytrack-git-{branch}.vercel.app` form is NOT what Vercel emits — per-team URLs include the team slug. Banked from PR #52 retrospective.
  - **63-char DNS label limit:** the branch-alias hostname is a single DNS label and silently fails to resolve when `len("agencytrack-git-" + branch + "-kyron-marchan-s-projects") > 63` — long branch names (e.g. `feat/gpm1-team-plans-reader` → 68 chars) get NO working alias at all, not an error page. Fallback: use the immutable per-deployment URL (`agencytrack-<hash>-kyron-marchan-s-projects.vercel.app`) read from the GitHub deployment status — `gh api repos/{owner}/{repo}/deployments` → statuses → `environment_url` with state `success`. Check the length BEFORE relying on the alias in smokes. Banked from PR #785 smoke; codified via the verification-hygiene FU batch.
- Always smoke-test the preview URL in incognito before merging
- **Branch protection is not platform-enforced on this plan. Merge gates are procedural:** never merge a PR until local lint + full suite + build are green AND the PR's `lint-and-build` and `functions-tests` checks show `SUCCESS` (poll them). `gh pr merge --admin` is forbidden in all circumstances. Banked from the Track J overnight queue (merges were observed landing while CI was still in progress — the platform does not gate, so the discipline must).
- **Standing green channel (auto-merge eligibility).** Replaces all prior night-only auto-merge authorizations. **Channel assignment is the dispatcher's call, per item, in the brief** (`green-channel` / `human-merge`); **CC NEVER self-promotes an item into the channel** — when the brief is silent or there is any doubt, it is human-merge.
  - **Green-channel-ELIGIBLE** (CC may `gh pr merge --squash` at any hour) ONLY when EVERY gate self-passes: scope-lock · lint 0 · full suite · build · hex-grep (Nexus-token-only) · axe NO-NEW vs main · both-themes preview smoke with §2 screenshot review · §7 self-review · §6 external-review triage · the procedural CI gate above (`lint-and-build` + `functions-tests` polled to `SUCCESS`) · then merge → wait for prod deploy → **prod-smoke** → **AUTO-REVERT** (`git revert <squash-sha>` direct to main) on prod-smoke fail. **Two consecutive auto-reverts HALT the channel** — all remaining items end at open PRs. Eligible categories: docs-only · test-only · verification scripts/smokes · read-only probes · **TRUE-RESTYLE** ports that pass the Phase-0 mockup-vs-component diff-lock · mechanical refactors fully covered by characterization tests.
  - **ALWAYS HUMAN-MERGE** (never auto, regardless of gates): `firestore.rules` / auth / custom claims · new collections or write paths (first landing) · functions or email-template deploys · anything money-affecting or data-migrating · token **DEFINITIONS** / design-system changes · REDESIGN-class slices · anything carrying an aesthetic or product judgment call · anything that only fits the channel by stretching a definition. **When in doubt → human-merge.**
  - The strike system and Rules 15 / 16 / 18 / 20 are unchanged. Banked from the Track J overnight program (codifies the night-only §1 auto-merge loop as a standing, dispatcher-gated policy).
- After merge, do a 60-second smoke test on production
- **`.env.local` does NOT auto-propagate to feature worktrees.** Verification scripts that depend on `A11Y_*_EMAIL` / `A11Y_*_PASSWORD` (or `VERCEL_BYPASS_TOKEN`) need explicit setup in each worktree before they will run — the file is gitignored, so `git worktree add` does not copy it. Either copy `.env.local` from the main worktree (`cp ../AgencyTrack/.env.local .`) or run verification scripts from the main worktree against the preview URL. Banked from PR #52 retrospective.
- **`.env.local` — use, don't echo.** Programmatic reads of `.env.local` (scripts, `process.env.X`, `$env:X` substitution into commands, `firebase deploy` reading credentials) are fine and expected. **Never echo the values to chat output, PR descriptions, commit messages, logs, or screenshots** — reference by env-var name only. The file is gitignored to keep secrets out of the repo; the use-vs-echo distinction extends the same protection to ephemeral surfaces. Banked from C1 close.
  - Shell-substitution safety (banked from PR #111 close near-miss): even when a tool parameter itself is sanitized, bash/PowerShell command substitution (e.g., $(node -e "console.log(process.env.X)") or $env:X) can resolve to a command line containing the token before execution. Avoid any shell construction that would inject sensitive values into the resolved command. For ad-hoc probing of preview URLs, use bare URLs only — the bypass cookie established by setupBypassSession() carries through subsequent navigation.
  - Extended traps (banked from C2 close): never `cat` / `echo` / `head` / `less` / `type` / `grep` files containing token values. Never construct a URL with a token query-param and pass it as a tool param — use cookie injection or purpose-built scripts. **If a tool mechanism forces a token into a string param: STOP and surface, never work around.**
  - Positive guidance for existence checks (banked from PR #102 close): to verify whether a key is present in `.env.local` without surfacing its value, use a boolean-only node check:
    ```
    node -e "require('dotenv').config(); console.log({VERCEL_BYPASS_TOKEN: !!process.env.VERCEL_BYPASS_TOKEN})"
    ```
    Output: `{ VERCEL_BYPASS_TOKEN: true }` if present, `false` otherwise. The grep prohibition has no exceptions — "I'm just checking it exists" is not a workaround.
  - Cookie-after-handshake pattern (banked from M3-smoke incident): sensitive tokens must never appear in URLs that pass through Playwright's standard error paths. The canonical pattern in `scripts/verification/lib/walk-helpers.mjs` is `setupBypassSession()` — a tightly-scoped initial-handshake function that catches and sanitizes all errors before they surface. After session setup, all navigation uses bare URLs. URL-parameter-bypass patterns from consumer code are forbidden — direct calls to `buildBypassUrl` are private to the helper module.
- **Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges.** When a PR introduces a *purely additive* change, it is safe to deploy from the feature worktree ahead of merge so the Vercel preview can exercise the new code path against real production rules / functions. Capture the deploy output in the PR description. Pre-merge deploys are permitted for:
  - `firestore.rules`: new `match /...` blocks for new paths (no edits to existing rules).
  - Cloud Functions: new exports (no edits to existing functions).
  - Cloud Functions: modifications to existing exports where new behavior is gated by new input fields not present in existing callers (defense: existing callers fall through to existing behavior, no regression vector). C2's `doCreateUser` extension for optional `data.branchId` / `data.csvImportBatchId` / `data.importedFromCsv` is the canonical example.
  Modifications where existing callers exercise the new behavior → post-merge only. Banked from C1 close (rules block deployed pre-merge for BranchesPanel preview); generalized to Cloud Functions in C2.
- **`firestore.indexes.json` changes require explicit deploy confirmation.** Adding or modifying a composite index in `firestore.indexes.json` does NOT auto-deploy via Vercel — `firebase deploy --only firestore:indexes` must be run from a worktree authenticated against the production project. Capture the deploy output (or Firebase Console index ID + status) in the PR description before merge. Pre-merge deploy is safe for additive index changes (new composites that don't redefine an existing one); modifications/removals deploy post-merge with the same staging discipline as rules. Verification path: Firebase Console → Firestore Database → Indexes → Composite tab, confirm status `Enabled`. Banked from PR #162 closure audit (composite `(unitId, weekStarting)` deploy state required manual Console verification because no rule existed).
- **Functions / email-template / index changes take effect only after an explicit `firebase deploy` (`--only` as appropriate) — never assume deployed because merged.** A squash-merge to `main` ships the *code*, but Cloud Functions, `functions/email-templates/*`, and `firestore.indexes.json` do NOT auto-deploy via Vercel. Production behavior for these surfaces changes only when the corresponding `firebase deploy --only functions|firestore:indexes|...` has actually run (a dispatcher/human action per Rule 19). Treat "merged" and "deployed" as independent states for these three surfaces. Banked from ledger row-34 (Emails) lesson; codified Track J overnight queue 2026-06-04.
- **`firebase deploy` pre-flight: worktree at `origin/main` HEAD + `node_modules` installed.** Before any `firebase deploy --only functions` / `--only firestore:rules` / `--only firestore:indexes` from a feature worktree:
  1. **Confirm the worktree's HEAD matches `origin/main`** (unless this is a pre-merge additive-rule deploy per the existing "Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges" carve-out). Pattern: `git fetch origin && git rev-parse HEAD == git rev-parse origin/main`. Mismatch → STOP and surface.
  2. **Confirm `node_modules` is installed and current** at the worktree's package root for whichever surface is being deployed: `functions/node_modules` for functions deploys, repo-root `node_modules` for any build-step that runs ahead of the deploy. Pattern: a quick `npm install --silent` in the relevant directory (idempotent if already installed). Missing → install before proceeding.
  3. **Confirm authenticated against the correct Firebase project** via `firebase use` or the project flag.
  Why: stale-worktree deploys ship code that doesn't match what the PR proved; missing-`node_modules` deploys fail mid-flight with cryptic errors that look like Firebase issues. Both classes are silent until they bite. Carve-out for pre-merge additive rules / function exports: the existing § Workflow bullet ("Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges") authorizes a deploy from a worktree NOT at `origin/main` HEAD — step 1 is waived for that specific case; steps 2 + 3 still apply. Banked 2026-06-01; codified Track J overnight queue 2026-06-04.
- **Squash SHA ≠ feature-branch SHA.** GitHub generates a fresh SHA on squash-merge (the feature branch's pre-squash final commit is NOT what lands on main). Kickoff briefs and CONTEXT.md `Recently shipped` rows must record the squash SHA captured from `git log origin/main --oneline -1` post-merge, not the feature branch's pre-squash final SHA. Banked from C2 close.
  - **Brief drafting from FOLLOW_UPS.md items must verify codebase state first.** Before drafting a kickoff brief for a follow-up item, grep git log + PR history for the topic (`git log --all --grep="<topic>"`). If the work is already shipped, the brief is unnecessary — update FOLLOW_UPS.md to reflect actual state instead. Banked from PR #124 close (wizard hardening brief was drafted while PR #88 had already shipped the work, causing ~45 min of wasted CC discovery). (see Methodology Rule 10 for brief commit convention; Rule 11 for FU-body re-audit before first work).
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
- **No `text-ink-faint` on any new text element — use `text-ink-muted`.** (D5, banked from S3b: four consecutive slices had smoke catch faint-on-new-text AA failures; this bans it at authoring time.)
- **White-text primary buttons always pair `bg-primary` with `dark:bg-primary-dark`** (dark-mode `--color-primary` is the lifted text teal, not a button background). (D6, banked from compliance-v2-s2: dark-mode smoke axe caught white-on-lifted-teal AA failure on a `bg-primary text-white` button missing the `dark:` variant the rest of the app already uses.)
- AgentReportDocument.jsx is EXEMPT — react-pdf doesn't support CSS vars, uses HEX only.
**Phase 7-8 design docs:** [`docs/phase7-8-PRD.md`](docs/phase7-8-PRD.md) (full spec across 5 tracks D–H) + [`docs/phase7-8-implementation.md`](docs/phase7-8-implementation.md) (build sequence, recommended order D → E → G → F → H, ~36–46 PRs total). Tracks D–H detailed in the table below. Pilot remains postponed indefinitely.

**Workshop-driven roadmap revision (2026-05-20):** [`docs/AgencyTrack_Workshop_Roadmap_Revision.md`](docs/AgencyTrack_Workshop_Roadmap_Revision.md) — adds Track I; extends Track F (structured Joint-Call Observation Log + appointment-bound Prospect-Info form); locks Track H column decision (Source-of-Prospect/Cash-with-App/Date-Placed/Delivery-Date IN, demographics OUT, Need-Covered → joint-call form); adds social/content KPIs (Track E) + Personal Growth/CPD (Career Portal/Phase 8); re-sequences for insider-seat strategy; no-CRM guardrail (future integrated CRM separately scoped).

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
| Track B (v2) | Design System v2 — "Concept 4 Complete" redesign (5 sub-PRs B1–B5) | ✅ COMPLETE — B1 medals, B2 goals carousel, B3 activity feed, B4 sidebar shell (#52), B5 tenant admin config (#55) |
| Track C | Configuration & data — branches schema, bulk import users/goals, company minimums | ✅ COMPLETE — C1 branches (#60), C2 bulk-import users, C3 bulk-import goals, FU#3 channel-split tokens (#132) |
| Track D | Cron + notifications verification | ⚠️ PARTIAL — PR-D server-side email (#133) closed the notifications half (HIGH#5). Cron half tracked separately in `docs/FOLLOW_UPS.md` § Track D cron portion status verification. |
| Track E | Agent + Manager Tooling Enhancements (E1–E6) | ✅ COMPLETE — E1 schema split (#68–#70), E2 reverse commission calc (#66), E3 persistency playground (#82), E4 production report (#72), E5 kiosk (#73/#74), E5.1 kiosk polish (#75), E6 daily input (#71), E6 AOM (#76) |
| Track I | Manager Activity Reporting (manager's own WAR: planning/training/1-on-1/joint work/recruiting/supervision + recruitment activity; mirrors agent wizard) | ✅ COMPLETE — shipped as I1.3a/b/c-i/c-ii, I3a, I3b, §6 (see `git log --all --grep="Track I"` for PR list) |
| M-series | Manager portal revamp | ✅ COMPLETE — M1 shared primitives (#105), M2 manager overview hero (#107), M3 manager awards medal (#113), M4 goals IA flatten (#116), M5 weekly champions medals (#118) |
| User-mgmt | PR-3 retire super_admin + PR-4 edit-user + PR-4b role/branch edits | ✅ COMPLETE — PR-3 (#28/#29), PR-4 (#122), PR-4b (#129) |
| Polish | Toast adoption + mobile polish + bulk test data | ✅ COMPLETE — Polish-1 (#114), Polish-2 (#127), PR-F bulk seeders + cleanup (#135) |
| Pilot Prep | End-to-end testing using PR-F tooling, real Tatil accounts | 🚧 IN FLIGHT (next track) — app not at Tatil yet |
| P9  | Sales Manager role | ⏳ Planned (post-pilot) — note: `sales_manager` claim + rules shipped via user-mgmt PR-1+; cross-branch UI surfaces remain |
| P10 | Multi-tenancy full rollout | ⏳ Deferred (post-pilot) |

## Current Phase
**Pre-Tatil-demo polish — wrapping up.** App has not been demoed to Tatil yet. Goal: ship app close to v1.0 because Kyron is also the decision-maker for the branch and wants minimal rework after pilot.

Tracks A through E are complete (see Build Phase History). User-mgmt PR-3/PR-4/PR-4b, M-series, Polish-1/2, PR-D server-side email, and PR-F bulk test data tooling have all shipped. The remaining pre-pilot work is **end-to-end pilot prep using the new PR-F bulk-seed + cleanup tooling**: exercise the full create-user → wizard → manager review → kiosk → AOM flow under realistic data volumes before the Tatil demo. After that, **SEC-9b** services-tenantId refactor is queued.

Open follow-ups live in [`docs/FOLLOW_UPS.md`](docs/FOLLOW_UPS.md). Dynamic state (active track, recent shipping, where-we-left-off) lives in [`docs/CONTEXT.md`](docs/CONTEXT.md).

## Key Technical Decisions
- `isTestAccount: true` on a user doc (`tenants/{tid}/users/{uid}`) excludes that account from both leaderboard surfaces. Two-surface architecture:
  - **`leaderboard/{uid}` (singular, gamification points, `Leaderboard.jsx`):** Write-layer guard in `onSubmissionWrite` (CF) — if flagged, skips the leaderboard `.set()` and deletes any existing `leaderboard/{uid}` doc (self-healing). Banked PR #550 (`0ccab45`).
  - **`leaderboards/{branchId}` (plural, branch-aggregate podium + champions, `ProductionLeaderboardSurface.jsx` via `useLeaderboard.js`):** Read-layer filter in `leaderboardAggregate.js` (`groupByBranch` + `computeWeeklyChampions`) — test accounts excluded from `branchByAgent` map (subs dropped/skipped), from `byBranch.users` (not ranked even at $0), and from weekly champion eligibility. Propagated by hourly `recomputeLeaderboardScheduled` cron or `recomputeLeaderboardOnDemand` callable. Banked PR #552 (`8d91eeb`).
  Set via `scripts/maintenance/flag-test-accounts.mjs` (`--apply --emails`). Hard-excluded from flagging: `kyronmarchan+tenant@gmail.com` (real tenant admin). Absent/false → behavior unchanged on both surfaces.
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
- `functions/seed-agent-names.cjs` — one-time seed script

Both are confirmed in `.gitignore`.

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

## Lint Policy

`npm run lint`, `npm test`, and `npm run build` must all pass before any push. This is enforced by `.github/workflows/ci.yml` (lint + tests + build on every PR to main).

**Baseline:** 0 errors, 0 `jsx-a11y` warnings (3 deferred `react-hooks/exhaustive-deps` warnings tracked separately, addressed in PR #33 → PR #38).

**React Compiler rules disabled:** `eslint-plugin-react-hooks` v7 ships React Compiler lint rules (`set-state-in-effect`, `purity`, `preserve-manual-memoization`, etc.) in its `flat.recommended` preset. This project does not use `@babel/plugin-react-compiler`, so all Compiler-only rules are set to `off` in `eslint.config.js`. If the Compiler is ever adopted, remove those overrides and fix the flagged sites.

**`_` prefix convention:** Variables that must appear in a destructuring/param list but are intentionally unused should be prefixed with `_` (e.g. `_agentId`, `_ws`). The lint rule is configured to ignore `/^_/` patterns.

## Test Policy

### Global Firebase stub

`src/firebase.js` calls `initializeApp` / `getAuth` / `initializeFirestore` at module load. Any test that transitively imports it (via a service or component) without a local `vi.mock` factory would crash in CI (where no `VITE_FIREBASE_*` env vars are set) with `auth/invalid-api-key`.

**`src/firebase.js` is globally stubbed in tests via a custom Vite plugin** in `vite.config.js` (the `firebaseTestStubPlugin`, active only when `process.env.VITEST` is set). The plugin intercepts any relative import ending in `/firebase` at the Rollup `resolveId` layer (before `vite:import-analysis`), redirecting it to `src/__mocks__/firebase.js` — an inert stub exporting `auth = {}`, `db = {}`, `storage = {}`, `functions = {}`, and `default = {}`. **Note (Vite 8):** `test.alias` (Vitest) and `resolve.alias` (Vite) do not intercept relative transitive imports in Vite 8 — `vite:import-analysis` processes relative specifiers before the alias resolver fires. The custom `resolveId` plugin with `enforce: 'pre'` is the only approach that works.

**Rules for test authors:**
- **Never mock a service solely to avoid Firebase init.** The global stub handles init. Mock services only to control their return values for assertions.
- **`vi.mock(id, factory)` takes priority** over the global stub for any service a test explicitly mocks — all existing return-value mocks are fully backward-compatible.

**Env-unset parity is now the default gate, not a separate parity check.** `942/942` with `VITE_FIREBASE_*` env vars UNSET is the baseline, matching CI exactly. Run `npx vitest run` after temporarily removing (or not having) `.env.local` to confirm. Do not rely on local env vars masking failures that will surface in CI.

Banked from PR #264 (2026-05-22). Surfaced 3× before the fix: F2 (#244), F3 (#246), I1.3c-i (#262).

## Session Protocol
1. Always read this file before writing any code
2. Run `npm run repomix` to get fresh codebase snapshot before each session
3. Confirm current phase before writing new files
4. Work on a feature branch (Claude Code default), never main directly
5. After all changes, run `npm run lint && npm test && npm run build` — all must pass before pushing
6. Push branch, open PR — CI will run lint + tests + build automatically on GitHub
7. Verify Vercel preview URL in incognito
8. User merges PR manually — only then does production update
9. After merge, do a 60-second production smoke test
9.5. After merge, before running production verification: `git fetch origin --prune && git pull origin main`. The pull ensures worktree-local tooling (especially `scripts/exploration-walk.cjs` and any other verification scripts) matches the merged state on origin. Fetching alone leaves verification scripts at pre-merge versions and they may run stale (lesson from B3 post-merge — PR #49). The `--prune` flag deletes stale remote-tracking refs for branches GitHub already removed via `deleteBranchOnMerge`, so `git branch -r` stays clean and `git branch --merged` returns accurate results — without it, post-squash refs accumulate across PRs (banked from PR #57 cleanup).

### Post-merge local cleanup (standard sequence, not exception)

**Phase 0 — branch confirmation gate (validated PRs #154–#158).** Before step 9.5's pull, verify `git rev-parse --abbrev-ref HEAD` returns `main`. If not, `git checkout main` before any further command. Step 9.5's `git pull origin main` from a feature branch creates an unintended merge commit or operates on the wrong working tree; the Phase 0 gate eliminates both modes. Surfaced after PR #154 hiccup (placeholder edits applied to wrong branch, required recovery); validated in PRs #155, #156, #157, #158.

After step 9.5's pull and after capturing the squash SHA from `git log origin/main --oneline -5`:

- **Local branch deletion uses `git branch -D <feature-branch>` (force).** With GitHub's `deleteBranchOnMerge: true` enabled on the repo, the remote tracking ref is pruned automatically before local cleanup runs, so `git branch -d` (lowercase) cannot verify merge status and will refuse. `git branch -D` is the correct tool here — the squash SHA captured one step earlier verifies the diff is preserved in main. Reference: PR #50 retrospective, B3 post-merge.
- **Untracked-doc collision on `git pull`:** If `git pull` aborts with `error: The following untracked working tree files would be overwritten by merge: <path>` for a doc that was drafted in the main worktree before opening its PR from a sibling worktree, this is the expected collision pattern (origin has the merged version, main worktree still has the local untracked draft). Resolve by:
  1. `git hash-object <local-path>` and compare against `git show origin/main:<path> | git hash-object --stdin`.
  2. If hashes match, content is identical — `rm <local-path>` and re-run `git pull`.
  3. If hashes don't match, the local copy has unmerged edits — surface as a real conflict, do not auto-resolve.

  Prevention (preferred): When opening a docs-only PR, draft the file directly inside the PR's feature worktree, not the main worktree. This keeps main's working tree clean and avoids the collision entirely. Reference: PR #51 retrospective, B-series cleanup pattern across PRs #45, #50, #51.
- **Verification target = no NEW stale state from this PR.** After cleanup, "clean" means this PR's branch is deleted, its worktree (if any) removed, no PR-specific untracked artifacts remain. Pre-existing stale branches from prior sessions fall under the running Worktree + branch audit FU, not this PR's cleanup. Verification must scope honestly to what this PR introduced; "only main + remote refs" is aspirational across all PRs, not a per-PR-enforceable target. Banked from PR #155 (arbitrary-syntax sweep) surfacing 4 pre-existing stale branches that were correctly identified as out-of-scope.

Rule 16 governs the fill scope for this sequence; Rule 15 governs the origin-verification step for any commit produced by it.

### Single-branch PR rule
One worktree branch = one PR. Never extend an open PR by pushing unrelated work to its branch.
If scope grows mid-PR, open a follow-up PR on a fresh branch after the current one merges.
Claude Code creates worktree branches automatically — each maps 1:1 to a PR.

- **Always sync before branching:** run `git fetch origin && git pull origin main` before
  creating a new branch off main. PR #31 (lint cleanup) was cut while A11Y PR2 was still
  open; PR2 merged first and both had touched `ManagerAwardsPanel.jsx`, producing a
  conflict that required a manual merge commit. Pulling latest main before branching
  eliminates this class of conflict entirely.

## Methodology requirements (added 2026-05-14, from pilot prep session)

These rules emerged from productive sessions and post-incident learnings (originally 8 from pilot prep 2026-05-14; rule 9 added 2026-05-15 from FU#4 → border-border arc; rules 10–13 added 2026-05-15 from CLAUDE.md methodology batch — firestore-indexes + brief-discipline arc; rule 14 added 2026-05-16 from env-credentials propagation audit closure; rule 15 added 2026-05-17 from PR #176 silent-push recovery arc; rule 16 added 2026-05-17 from FU-H methodology PR (#188) — post-merge fill scope canonization; rule 17 added 2026-05-18 from FU-J methodology PR (#192) — source verification at authoring time). Apply on every CC brief and dispatch.

### 1. Surface before architectural decisions

CC must surface (per Rule 12's STOP and wait for dispatcher semantics) for Kyron's acknowledgement BEFORE making any decision not pre-listed in a brief's "Decisions locked" section. Specifically:

- Scope expansion (touching files outside the brief's file inventory)
- New architectural patterns (cache, helper, state mechanism, localStorage usage, etc.)
- Test file rewrite from scratch (vs. targeted edits that preserve existing coverage)
- Inline fix of unexpected behavior (vs. STOP and wait for dispatcher)
- Any "how to solve" decision not explicitly pre-decided

"Solve rather than surface" is itself a strike condition even when the resulting fix is correct. The methodology requirement statement should appear at the top of every brief that involves implementation work. SHAKEDOWN-001 (#141), SEC-9b (#139), and the original shakedown (#140) all had at least one unsurfaced methodology decision; #142, #144, and subsequent re-runs were clean once the requirement was banked into briefs.

### 2. Phase 1 audits enumerate ALL data paths

For permission-boundary fixes, Phase 1 must enumerate every function that returns data joinable to the entity being scoped — not just the ones mentioned in the bug report.

SHAKEDOWN-002's first fix (#142) scoped two user-list queries (`getTenantUsers`, `getAllUsers`) but missed two submission paths (`getWeeklySubmissions`, `getAllYTDSubmissions`). SHAKEDOWN-002B (#144) closed those. A complete Phase 1 audit before #142 would have caught all four.

Pattern: when a bug report says "X data leaks to Y," Phase 1 enumerates every read path that could leak any data joinable to X, not just the specific one cited. Document the enumeration in the Phase 1 surface output — list every exported function in the relevant service(s) and classify each (already scoped / not joinable / unscoped gap).

### 3. Autonomous-mode strike calibration

For autonomous CC runs (shakedown-style multi-hour execution where Kyron is away):

- **Bugs found are NOT strikes.** The shakedown finding defects is the test working as designed.
- **Infrastructure failures ARE strikes** — seed failures, wipe failures, cleanup orphans, script crashes, mid-run script bugs.
- **Data safety issues are STOP IMMEDIATELY** — single stop, not 2-strike. If any operation could touch real production data or cross tenant boundaries, halt and surface, regardless of strike count.
- **Cleanup is non-negotiable.** Even if a shakedown finds 50 bugs mid-flight, Phase 6 cleanup must execute. Wrap orchestration in `try/finally` with cleanup in `finally`. The original shakedown (#140) initially missed this and orphaned 10 test users for ~13 seconds before emergency recovery.

STOP IMMEDIATELY is the data-safety variant of Rule 12's halt-condition vocabulary.

### 4. env-listing commands filter for KEY= pattern

Any PowerShell or bash command that lists `.env.local` (or any env file) contents must filter for `^[A-Z0-9_]+=` patterns to prevent echoing non-KEY=VALUE lines as raw values.

The pilot prep session caught a SendGrid SMTP credential leak this way — CC's command split on `=` and printed the value of a bare URI line. Credential was rotated; this rule prevents recurrence.

Correct pattern in PowerShell:

`Get-Content .env.local | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { ($_ -split '=')[0] }`

Returns only the key names. Values never reach the chat. Apply the same `^[A-Z0-9_]+=` filter in bash, grep, or any equivalent command.

Character class must include digits (`[A-Z0-9_]+`, not `[A-Z_]+`) — keys like `A11Y_AGENT_PASSWORD`, `A11Y_BRANCH_MANAGER_PASSWORD` etc. begin with digit-containing prefixes and the digit-less pattern silently misses them. PR #156 smoke walk surfaced this gap when env-listing reported `A11Y_*` keys as absent; values were then pasted inline to unblock, requiring post-PR credential rotation. Both the credentials and the regex pattern are now fixed; this rule update prevents recurrence.

### 5. Phase 3 verification must include actual invocation, not just module resolution

For briefs that include scripts touching external services (Firestore, APIs, cloud resources, file systems), Phase 3 verification must include an actual invocation in non-destructive mode (dry-run, list, count, etc.), not just module loading or import resolution checks.

PR #147's `denormalize-submission-unitId.mjs` passed Phase 3 with "module resolution path is right" but had a missing `credential.cert(...)` initialization block that only surfaced when Kyron ran the script. A real dry-run invocation in Phase 3 would have caught the credentials gap before it reached production verification.

Pattern: for any new script that connects to external services, Phase 3 must include a real invocation that exercises the connection layer (auth, transport, basic round-trip). "Compiles" or "loads" is insufficient. The dry-run pattern (read-only, non-destructive default with explicit `--execute` flag) makes this safe to run against production from Phase 3.

### 6. Phase 1 validates data quality, not just data structure

For permission-boundary fixes, denormalization work, or any change that depends on existing data having specific values populated, Phase 1 must verify both:
- **Structural integrity:** does the source field exist on the doc?
- **Assignment completeness:** does the field have a non-null, non-empty value?

PR #147's Phase 1 hard stops covered "agent doc missing" (structural) but not "agent doc exists with `unitId` field missing or null" (assignment). Result: all 22 backfilled submissions wrote `unitId = null`, only surfaced when Kyron reviewed the dry-run output. The new rules would have silently broken UM visibility in production if the dry-run hadn't been carefully read.

Pattern: for any denormalization or value-dependent fix, Phase 1 must sample-read a representative subset of source docs and verify the relevant field values are populated as the change assumes. Surface sparse fields, unexpected nulls, or assignment gaps as Phase 1 findings before designing the fix, not after running it.

### 7. Active follow-ups table = active items only

When a row's status transitions to CLOSED (resolving PR merged), remove the row from Active follow-ups in the same Phase 4 docs commit as the resolving PR. Audit trail is preserved in git log + the Recently-shipped table + `docs/FOLLOW_UPS.md` closed sections. Closed rows lingering in Active follow-ups is documentation debt, not audit trail. Banked from PR #153 Phase 4 (Mobile FU#2 row left as CLOSED in Active follow-ups, cleaned up post-hoc at `ba2f4e5`).

### 8. Phase 4 stale-row audit

During Phase 4 docs maintenance, in addition to filling the current PR's placeholders, scan the Active follow-ups table's status column for "PR open", "awaiting merge", "in progress", or similar live-state claims. For each, verify against `gh pr list --state open` and recent `git log origin/main --oneline -20`. Reconcile any drift in the same commit. Banked from one session surfacing three stale SEC-9b "PR open" references (PR #139 had shipped weeks earlier); without this audit, CONTEXT.md state drifts silently from shipped reality.

The audit extends to CONTEXT.md prose claims, not just the table. Component-consumer tracking ("X.jsx still consumed by Y"), deferred-but-still-valid annotations, and recently-shipped narrative all drift silently in the same way. PR #156 exposed a 22-day-stale "still consumed by ManagerDashboard" claim about MotivationalCarousel that survived the table-scoped scan because it lived in prose. Phase 4 must `git grep` for any named component referenced in CONTEXT.md prose and verify the claim against current state.

### 9. Dispatcher Phase-5 scope-extension protocol

Phase 5 stops exist for dispatcher review and authorization, not just go/no-go on merge. When CC surfaces findings adjacent to the brief's locked scope — same category, same risk profile, same verification basis — the dispatcher MAY authorize an in-PR extension rather than requiring a follow-up. CC MUST NOT unilaterally expand; the scope-lock protects against silent drift. The dispatcher's authority to extend exists precisely because Phase 5 is review-authorization.

Protocol: surface as out-of-scope per brief → dispatcher evaluates → if authorized, CC applies via NEW commit (not amend — preserves "extended at Phase 5 review" audit trail), updates PR description, re-stops at Phase 5. Validated in PR #158 (placeholder-sweep), where 2 additional sites mapping to PRs already verified HIGH-confidence landed via commit 0f6a4b5 on the same branch. 

**Carve-out (banked 2026-05-30):** the `text-*-faint → text-*-muted` contrast fix established in PR #392 is standing pre-authorized — CC MAY apply it in-PR and report it without a per-instance Phase-5 stop. This is the ONLY pre-authorized self-extension; ANY OTHER new serious/critical axe node vs the main baseline still requires surface → STOP → dispatcher authorization per this rule. (Origin: PR #393 review — CC applied the fix unilaterally citing this rule, which actually forbids unilateral expansion; the carve-out makes that one specific fix compliant going forward.)

### 10. Kickoff briefs commit before CC dispatch

Every kickoff brief for an implementation PR (any size — XS, S, M, L, XL — no exception) commits to `docs/briefs/` via a small standalone docs PR BEFORE CC is dispatched against it. The pattern: dispatcher drafts brief → opens `docs(briefs): <topic> kickoff` PR → merges → dispatches CC against the merged brief on a fresh feature branch. This preserves the dispatch-vs-implementation boundary in git history (the brief's authorship and timing is separate from CC's execution) and lets reviewers trace methodology drift across PRs.

Audit-only dispatches stay inline. Pre-flight surface audits, read-only investigations, and any task that produces no source/docs commit do NOT require a committed brief — the chat prompt is the brief.

Banked from May 2026 closure cadence (PRs #161/#162, #163/#164, #165/#166 all followed this pattern).

**Execution.** The docs-PR landing is performed by the `/land-brief <topic-slug>` skill — CC creates the docs branch off `origin/main`, moves the brief (+ optional annotation) into `docs/briefs/` / `docs/design/`, and opens the `docs(briefs)` PR. The dispatcher merges it, then `/dispatch`es the merged brief. The separate-docs-PR requirement above is unchanged; only the executor moves from manual dispatcher terminal to CC. Banked from PR #428.

**Dispatch guard (enforced in `/dispatch`).** Before reading any brief, `/dispatch` MUST `git fetch origin` and confirm the brief path exists on `origin/main` (`git ls-tree origin/main -- docs/briefs/<file>` non-empty); if it is missing, **STOP IMMEDIATELY** ("brief not on origin/main — merge the docs PR first"). Dispatching against a local/docs-branch copy is forbidden — it ships the work while the Rule 10 audit trail (brief on main) is still absent. Banked from the 2026-06-04 #476 near-miss: the Prospecting Calls Flip work (#477) merged while its brief docs PR (#476) was still open, leaving the brief off `origin/main` until caught post-merge.

### 11. FU body re-audit before first work

When a FU is referenced for first implementation work after any gap (banking-date to dispatch-date), the brief author must verify the FU body's diagnosis claims against current source code BEFORE locking the brief's "Decisions locked" section. Specifically, for any FU body that names:

- a root cause / mechanism (e.g., "regex adjustment", "downstream of bug X", "race condition in handler Y")
- a file:line target
- a suggested fix shape ("just adjust the regex", "wrap in useMemo")

the brief MUST quote the current source at that location and either (a) confirm the FU diagnosis matches reality, or (b) document the corrected diagnosis in the brief's audit-findings section. The corrected diagnosis lands in the RESOLVED note when the FU closes — preserving the drift trail.

Banked from PR #164 (react-hooks Item 2: FU body claimed "downstream of Item 1"; reality was "eslint-disable was vestigial — unused at any baseline") and PR #166 Bug 001 (FU body claimed "regex adjustment only"; reality was navigator off-by-one).

### 12. Hard-stop language must be unambiguous

Briefs use only two phrases for halt conditions, no synonyms:

- **STOP and wait for dispatcher** — CC halts execution, posts the surface finding to chat, and does NOT proceed until receiving an explicit dispatcher reply. No autonomous next step, no "I'll continue with a defensible path." This is the default for any condition the brief identifies as a stop.
- **STOP IMMEDIATELY** — reserved for data-safety / production-touch / cross-tenant risk (carried from Rule 3). Same halt semantics, escalated visual weight.

Forbidden synonyms: "hard stop and surface", "flag to Kelsean", "note and continue", "surface for review". These are interpretable as either halt-and-wait OR proceed-with-note; the ambiguity caused PR #166's first-turn methodology miss (CC encountered an env-gap stop, rationalized continuation via the smoke waiver, and only halted on the second turn). Brief authors must rewrite any halt condition into one of the two canonical phrases.

Existing committed briefs (pre-banking) are grandfathered. Rule applies to all new briefs from banking date forward.

### 13. Acceptance-criteria waiver protocol

When environment conditions prevent a brief's acceptance criteria from being verified at Phase 3 (seeded data absent, third-party service unavailable, indexed-state not yet propagated, etc.), the dispatcher MAY authorize merge with an explicit waiver. The waiver requires BOTH artifacts to land at merge time:

- **Waiver decision in PR body** — dispatcher's explicit "verification waived because <env condition>" note. Not implicit. Not "merge anyway, will verify later."
- **Deferred-verification FU banked in `docs/FOLLOW_UPS.md`** — full re-run instructions (commands, env prerequisites, seed paths) and the unverified acceptance criteria copied verbatim. Banked in the same merge cycle as the resolving PR — never deferred to a follow-up commit.

CC's Phase 3 surfaces the env gap (via Rule 12's STOP and wait for dispatcher); dispatcher authorizes waiver or instructs CC to resolve the env condition. Banked from PR #166 (shakedown harness re-run blocked by absent `*@agencytrack.test` accounts; deferred FU at `docs/FOLLOW_UPS.md:44`, PR #166 squash commit `eedd2bb`).

### 14. .env.example is canonical credential documentation

Every `process.env.X`, `import.meta.env.X`, or post-`loadEnv` env read site must reference a key documented in `.env.example`. When a new credential is introduced:

- Add the key + a one-line purpose comment to `.env.example` in the same PR as the first read site.
- If the credential is deprecated, REMOVE it from `.env.example` in the same PR as the reader removal. Do NOT leave deprecated keys with explanatory comments — they accumulate as bait.

Why: drift between `.env.example` and live read sites creates onboarding gaps (new contributors don't know what to set) and stale-bait risk (deprecated vars get re-populated by anyone copying the template). Surfaced via 2026-05-16 env-credentials propagation audit: A11Y_* test credentials for multiple role tiers were partly documented in `.env.example`, partly drifting in script env reads (later quantified in the 2026-05-17 FU-B audit: 7 role flavors actively read, 2 documented at banking time). `VITE_TENANT_ID` was documented as deprecated despite having no live reader post-SEC-11. Rule 14 canonicalizes `.env.example` as the credential doc.

How to apply: Before opening a PR that adds or removes a credential read site, grep `.env.example` for the key name. If new, add it. If the last reader was removed, delete the entry. Brief Phase 1 audits for any work touching credential-reading scripts MUST scan both `.env.example` and live `process.env.X` reads as part of the enumeration.

Banked from PR #174 (env-credentials propagation audit closure).

### 15. Direct-to-main pushes require origin verification

For any commit that lands on `main` outside the squash-merge-PR path — including the post-merge placeholder-fill commit (per Session Protocol step 9 and § Post-merge local cleanup), authorized hotfixes, and any other dispatcher-authorized direct push — CC MUST run `git fetch origin && git log origin/main --oneline -1` immediately after the push, and confirm the SHA matches `git rev-parse HEAD` on local `main`.

If the SHA does not match: the push has not reached origin. **STOP and wait for dispatcher** — do not retry, do not amend, do not exit the sequence. Push-failure modes are non-obvious (auth re-prompt, upstream rejection, network blip, malformed commit) and each warrants dispatcher review rather than autonomous retry.

CC's sequence summary MUST include an explicit line stating the commit was pushed to `origin/main` and the verification SHA matched. "Committed" alone is not equivalent to "pushed and verified" — the verification step is not complete until both have been confirmed in the report.

Why: on 2026-05-17 a silent push failure from the previous day's post-merge sequence was caught only when the next PR's Phase 0 gate detected a divergence between local `main` and `origin/main`. PR #176's placeholder-fill commit (`148c15c`) had been committed locally but never reached origin; the failure was invisible because the post-merge summary described the commit without claiming verification. Same shape as the "preview verified + merged via UI is not proof of shipping" learning already in memory: execution reports don't equal verification.

Note on terminology: This rule anchors to canonical CLAUDE.md sections (Session Protocol step 9 + § Post-merge local cleanup), not to "Rule 4." Some prior briefs use "Rule 4" as shorthand for the post-merge placeholder-fill sequence; that shorthand collides with canonical Rule 4 (env-listing credential safety) and should not be carried forward in new briefs.

Banked from PR #180 (2026-05-17, methodology batch).

### 16. Post-merge fill scope is canonical

The post-merge cleanup sequence (Session Protocol step 9.5 + § Post-merge local cleanup) MUST update the following in `docs/CONTEXT.md` as part of every cycle, regardless of whether the work brief's Phase 4 specified them:

- **Current main HEAD** — squash SHA of the most recently merged PR (the work PR squash, not the post-merge fill commit which is housekeeping). For direct-to-main commits without an associated PR, use the commit SHA.
- **Active track** — identifier of the just-shipped work.
- **Next track** — remove items that just shipped; promote the next-up item, or note "(queue clear)" if none.
- **"Where we left off"** prose — summary of the just-shipped PR and what's next. Format flexible; content must be current.
- **Last updated** — ISO date of the fill commit.

Any `#TBD` or `{TBD}` placeholders introduced in the work PR's Phase 4 are filled with the work PR's number and squash SHA (the pre-existing mechanic, now consolidated under Rule 16).

**Housekeeping / docs-only merges take no post-merge fill commit; `Current main HEAD` tracks work squashes only.** A docs-only or housekeeping merge — kickoff-brief landings, scoping/design notes, methodology-doc edits, branch-cleanup commits, test-only PRs, and audit/verification scripts that nothing in the build/runtime imports — does NOT get its own CONTEXT.md fill cycle and does NOT become the `Current main HEAD` value (which continues to point at the last *work*-PR squash). This avoids fill-commit churn for merges that ship nothing to production. A merge counts as "work" when it changes `src/`, `functions/`, schema, rules, or config that the build/runtime consumes. Banked from the Track J overnight queue (2026-06-04).

**Terminology resolution.** Some prior briefs used "Rule 4 shorthand" to refer to this sequence; that collides with canonical Rule 4 (env-listing safety) and is retired. Briefs and dispatches cite **Rule 16** when referencing the post-merge fill scope.

**Verification anchor.** Rule 15 (origin-verification) verifies the push produced by Rule 16's fill commit.

**16(c): consolidated post-merge fill for auto-merge programs.** Any program that auto-merges multiple work PRs (harvest batch, night-queue, remediation batch, or similar) is NOT complete until a single consolidated post-merge fill commit covers every merged PR in the program. The fill may be written as one direct-to-main commit with a fill ledger in the commit body (each PR number + squash SHA, with Rule 16(b) classification noted). The program's closing report must reference the fill commit SHA. CC must not declare a program closed without the fill; the dispatcher's "program complete" acknowledgement carries the same obligation.

Motivating incident (2026-06-06): the Gemini harvest program (Batches A–E, PRs #520–#525) + night-queue R1 fixes (PRs #526–#528, #530) merged via GREEN-CHANNEL without a consolidated fill; `Current main HEAD` in CONTEXT.md remained at `4a72d79` (#517) while the actual last work squash was `681af69` (#528) — a 9-PR drift that only surfaced at the next morning's dispatcher check. Resolved by fill commit `731da1e`.

**CONTEXT.md size caps (banked 2026-06-19):** `Recently shipped` ≤ 5 rows; `Last updated` / `Where we left off` / `Current main HEAD` / `Active track` each ≤ 3 entries. When a fill would exceed a cap, move the oldest entry to `docs/CONTEXT-history.md` in the same fill commit. The cap note at the top of `CONTEXT.md` is the canonical reminder; this bullet is the enforcement hook in the fill sequence.

### 17. Source verification at authoring time

When a brief or methodology rule describes source behavior — default behavior, example values, command syntax, file paths, line numbers, existing structural format — the author MUST verify each claim against current source BEFORE locking the brief's "Decisions locked" section or proposing rule wording. Specifically:

- **Default behavior / fallback claims:** grep or read the consumer site; never paraphrase from memory.
- **Example values:** trace through actual call sites (scheme prefixes, separator characters, escape rules, units). Operator copy-paste must work verbatim.
- **File paths and line numbers:** open the file and confirm; line numbers drift between sessions.
- **Enumeration tracked-status:** when listing files via `grep -rn` to scope a migration or audit, pair with `git ls-files` (or use `git grep`) to filter to tracked-only paths. Untracked or excluded files appear in `grep` output but are not part of canonical repo state, and silently inflate migration-target counts in briefs.
- **Existing structural format:** read the existing target document end-to-end before prescribing changes (table cadence, paragraph count, heading levels).
- **Operational possibility of proposed wording:** for rule additions, mentally simulate the rule's first execution and check for chicken-and-egg conditions (e.g., "fill commit SHA captured before fill commit exists").
- **Aggregated snapshots:** aggregated snapshots (e.g. `repomix` output) compress function bodies to `⋮----`; a value seen in such a snapshot is **not** verified source — open the actual file, and never substitute an embedded older brief for a compressed body. (Banked from the 2026-06-02 Daily Capture key-casing catch.)

Rule 11 is the specific case of this discipline for FU-body diagnoses; Rule 17 is the general principle applied to all source-derived claims in briefs and rule wording. Cite Rule 11 when the FU-body diagnosis itself is the gap; cite Rule 17 otherwise.

Phase 1 audits remain the execution-time safety net (per Rule 11's "re-audit before first work" and existing Phase 1 gates in every brief). Rule 17 shifts the primary verification surface to authoring time — Phase 1 catches what authoring missed, not what authoring shouldn't have written.

Banked from PR #192 (2026-05-18). Six instances surfaced 2026-05-17 across FU-G + FU-F + FU-H briefs and Rule 16 wording; enumerated in `docs/FOLLOW_UPS.md` FU-J body at banking time (PR #190, `54c7d1c`).

**Source-verification sub-bullet: paired Phase 1 commands for source-derived claims.**

Brief authoring frequently makes assertions about source state beyond mere file existence — file paths in specific directories, grep counts, line numbers, gitignore reachability, per-token sub-counts. Each such source-derived claim must be paired with a Phase 1 verification command that CC can execute against current source, not just asserted in the brief body.

Common patterns:

- File paths in specific directories: `git ls-files | Select-String "<filename>"` (catches wrong-directory assertions)
- Grep counts: `git grep -c "<pattern>"` (catches drift from prior audit)
- Gitignore reachability when adding new file paths: `git check-ignore -v "<path>"` (catches negation-pattern gaps when introducing files into ignored parent directories)
- Per-token / per-rule sub-counts: explicit grep with token isolation (catches commit-message-template drift)

If a brief asserts a source-derived fact without a paired Phase 1 verification command, CC may verify inline as part of Phase 1 before relying on it. Strikes do NOT accrue for inline verification of unguarded source-derived assertions, nor for inline correction via Rule 9 scope extension when the corrected detail does not change the PR's surface area, scope, or risk profile.

Banked from PR #223 (`d40fa85`). Motivating catches: PR #217 (`d84a752`, CLAUDE.md path), PR #217 (`d84a752`, .gitignore scope), PR #219 (`0b3f058`, AgentReportDocument path), PR #221 (`e074b50`, per-token sub-counts).

**Brief-completeness sub-bullet: enumerate the full architectural unit when introducing a new Firestore collection.**

Briefs that introduce a new Firestore collection must enumerate ALL parts of the architectural unit explicitly in Phase 1 source-verify and Phase 2 edits, not just the obvious surfaces. The full unit includes:

- **Rules block** — read/write permissions, helper functions or inline role checks, tenant scoping if applicable
- **Write surface** — Cloud Function logic (with `Admin SDK` writes bypassing rules) and/or client-side write logic (subject to rules)
- **Read surface** — client-side query shape if any frontend consumes the collection, including filter clauses and orderBy
- **Composite indexes** — required for any query with 2+ `where()` clauses, range filters, or `orderBy` on non-equality fields. Encode as `firestore.indexes.json` additions in Phase 2 alongside the rules block.
- **Smoke verification** — if user-visible behavior depends on the new collection, the smoke's own query is part of the architectural unit. The smoke's index requirements must be in `firestore.indexes.json` even if the production app does not yet query the collection in the same shape.

Common gap: smoke queries on the new collection often have different shape than production app queries. The smoke's index requirements are easy to miss because the brief author is focused on the production app's read surface (if any). The smoke is real verification code that runs against real Firestore — its query needs its index.

Two Rule 9 in-PR extensions on a single PR is a signal the brief under-specified the verification surface and should be banked as a methodology learning. Strikes do NOT accrue for these Rule 9 extensions when the corrections are mechanical (filter clause addition, index addition) and the brief's locked decisions remain intact.

Banked from PR #231 (`5be20e7`). Motivating catch: PR #229 (`0fdebc0`, Resend invite server-side + `auditInviteResends`). Brief covered rules, CF write, frontend swap, and smoke, but missed the smoke's composite index (4-field: `tenantId + actorUid + targetUid + timestamp DESC`) and the smoke query's required `tenantId` filter clause for the rules to accept the read. Both surfaced during operator smoke as Rule 9 extensions: `848c16c` (smoke query tenantId filter), `cd2ef7b` (composite index add).

### 18. PR checklist from ground truth

When opening a PR, fill the template checklist by what is actually verified at PR-creation time — not what is expected to be true:

- Check `[x]` only for items confirmed true at the moment the PR is opened: tests passing, lint/build clean, docs updated, scope matches brief.
- Leave the smoke box **unchecked** (`[ ]`) until the smoke actually runs. After the smoke completes, edit the PR description to reflect the real result and annotate any findings inline (e.g., `[x] smoke — 4/4 pass; Finding: leaderboard ranking not filtered (out of scope)`).
- An unchecked or annotated box is information, not a failure of process. A reflexively checked box that doesn't reflect reality is the failure.

Why: PR #296's smoke ran after PR open and surfaced two out-of-scope findings (leaderboard ranking gap, `deactivateUser` CF crash). A checklist pre-checked at creation would have obscured both. The checklist's value is as a live signal, not a formality.

Banked from PR #296 smoke (`27b1c8a`, 2026-05-24).

### 19. CC never merges or deploys

CC never merges PRs or deploys rules/functions. These are explicit dispatcher/human actions. Merge is the dispatcher's action after review in the GitHub UI. Rules and functions deploys are explicitly dispatched steps — CC does not self-initiate them.

When a deploy or merge gate blocks a task (e.g. a rules-dependent smoke needs the new rules live), **STOP and wait for dispatcher** — report the blocker explicitly. Never cross the gate to unblock yourself.

Why: PR #299 smoke surfaced this when the Firestore `licenseStatus` allowlist extension hadn't been deployed pre-merge. The correct response was to stop and report the blocker; instead the deploy ran autonomously, which violated the gate. Banked from PR #299 post-merge fill (2026-05-24).

### 20. PR-ready report names the feature-branch HEAD SHA

Every "PR is ready for review" / "smoke PASS, holding for pre-review" report from CC MUST include the exact feature-branch HEAD SHA the report describes — captured via `git rev-parse HEAD` on the feature worktree at report time. The SHA is the contract between CC's verification (tests + smoke + the report's narrative) and the dispatcher's merge decision.

Once a PR-ready report is sent, **no further commits may be pushed to that PR's branch without an explicit re-report** stating the new HEAD SHA + a re-run of any verification the new commit could invalidate (smoke at minimum; lint/tests/build per scope). The dispatcher merges only the SHA in the latest verified report.

**Dispatcher protocol:** before clicking merge, compare the PR's current HEAD on GitHub against the SHA in the latest CC report. If they disagree, the PR is NOT ready — request a re-report or wait for the gap to close.

Why: PR #418 surfaced this. CC posted the PR-ready report; the dispatcher merged shortly after. Two follow-up smoke-debugging commits (`94a196d` per-scorecard value testid + `6e52923` card-scoped fillProductionStep + LOW-FU bank) were pushed AFTER the dispatcher's squash had already executed and never made it into main. The 1-line `data-testid={${testid}-value}` addition to `WeekSoFarPanel.jsx` Scorecard was a small production-functional source change that should have shipped via the merged PR; it was orphaned by the timing gap and surfaced only at post-merge smoke (`0fb0992`, 2026-06-01). Folded into Wizard v2 PR3 as a 1-line carry-over per dispatcher direction.

Banked from PR #418 post-merge fill (2026-06-01).

### 21. Bot reviewer disposition gate

After opening any PR, poll for **both** configured bot reviewers (up to 10 min each; if a reviewer is absent, note its absence explicitly — do NOT treat absence as "no comments"). Every comment from each reviewer gets a disposition in the Phase 5 report using the same taxonomy: IMPLEMENT (agreed, in-family with the PR's scope — apply in-PR before the report) · ALREADY-RESOLVED · OBSOLETE · DISAGREE (one-line technical rationale; recorded doctrine and dispatcher rulings outrank any bot) · OUT-OF-SCOPE (valid but expands the PR — banked as an FU, never silently implemented). The disposition table covers both reviewers and is a mandatory report section; a PR is not pre-review-ready without it. On auto-merge green-channel PRs, CC self-dispositions under the same taxonomy and the report records it; DISAGREE and OUT-OF-SCOPE items on auto-merged PRs roll up to the dispatcher in the next report.

**Configured reviewers and poll targets:**

**Note: bot-author logins in the GitHub JSON carry NO `[bot]` suffix.** The display names shown in the GitHub UI (e.g. `gemini-code-assist[bot]`, `coderabbitai[bot]`) differ from the `.author.login` field returned by the API. Filtering on the `[bot]`-suffixed display name silently matches nothing. Correct values: Gemini = `"gemini-code-assist"`, CodeRabbit = `"coderabbitai"`. Banked from PR #735 audit (2026-06-23); CodeRabbit login confirmed from PR #756.

- **Gemini** (`gemini-code-assist` in API) — PR Reviews API. Poll: `gh pr view <pr> --json reviews` → entries where `.author.login == "gemini-code-assist"` (state `COMMENTED`). *Gemini sunsets 2026-07-17; CodeRabbit is the durable reviewer after sunset.* **On money/rules PRs, trigger Gemini via the on-demand `/gemini review` PR comment (posted via PowerShell to avoid Git-Bash MSYS path mangling) — the auto-batch review is materially weaker (missed 3 HIGH money-write races on PR #756 that the on-demand pass caught).**
- **CodeRabbit** (`coderabbitai` in API) — GitHub App; no workflow file required. Posts **both** a review (`gh pr view <pr> --json reviews` → entries where `.author.login == "coderabbitai"`, state `COMMENTED`) with actionable findings, and a summary comment (`gh pr view <pr> --json comments` → entries where `.author.login == "coderabbitai"`). Poll both channels; the reviews channel carries the substance. CodeRabbit activates automatically on PR open via the GitHub App — no trigger comment needed.

**Pre-merge final poll.** Before any squash-merge (dispatcher click or green-channel auto-merge alike), check for reviewer activity posted AFTER the last disposition table — `gh pr view <pr> --json reviews,comments` and compare timestamps against the report's disposition table. Any newer reviewer comment gets dispositioned under the same taxonomy BEFORE clicking merge; a stale disposition table does not satisfy the gate. Banked from the #783/#784 near-miss: a Gemini re-review landed after the disposition table was posted and was only caught post-merge, forcing a docs-side backstop bank instead of an in-PR fix.

**Post-merge backstop.** A pre-merge "absent" is provisional for each reviewer independently. `/post-merge` re-polls for BOTH reviewers; any comment that arrived after the pre-merge window is dispositioned in the post-merge report under the same taxonomy — IMPLEMENT → banked as a follow-up PR or FU (the PR is already merged, no in-PR fix possible) · DISAGREE → recorded in summary · OUT-OF-SCOPE → banked as FU · ALREADY-RESOLVED → noted · OBSOLETE → noted. The gate is not satisfied by a pre-merge "absent" for either reviewer alone.

### 22. Self-critique gate

Before posting any PR-ready report, plan, or final session summary, CC enumerates ≥1 known gap — what it did NOT verify, the weakest part of the change, or an assumption that could be wrong. Self-generated and independent of Rule 21 (bot reviewer disposition gate): surfaces blind spots before external review, not after. A report with no stated gap is incomplete, not clean.

### 23. Falsification-before-banking gate

Before a finding is banked as a locked decision (CONTEXT.md § Locked decisions), an active follow-up, or a CLAUDE.md rule, state what evidence would overturn it. If that can't be answered, the finding is provisional — record it as provisional, do not bank it as settled. Applies to architecture findings, audit conclusions, and rule rationales.

### 24. Currency verification

Any time-sensitive or current-world fact handed to the operator — role holders, prices, laws/regulatory status, product or model availability, recent events — is web-searched and verified current at answer time, not asserted from training priors. Rule 17 extended from brief-authoring to live answers: training-era confidence on a present-tense fact is the trigger to search, not to assert. State the as-of date or source when the fact could have changed. Applies to the dispatcher's chat answers and CC's knowledge-work outputs alike.

### 25. Session & cache hygiene

Load repomix once per session; never re-paste a fresh pack mid-session. Don't edit CLAUDE.md or add/remove MCP servers mid-build — batch those at session boundaries. Keep the task/volatile instruction last in the turn. Batch related work into one session; spin a fresh context only when isolation buys tangle-safety.

---

## Dispatcher tooling

These helpers reduce per-PR copy-paste between dispatcher (Claude chat), operator (Kyron), and Claude Code. The canonical methodology (Session Protocol, § Post-merge local cleanup, Methodology Rules 1–18) remains authoritative — these tools embed the rules, they do not replace them.

### `scripts/dispatcher/new-brief.ps1`

One-command brief docs PR shuffle (Rule 10). Operator invokes after writing the brief to `docs/briefs/` via the dispatcher's paste-block.

Usage:

```powershell
.\scripts\dispatcher\new-brief.ps1 -File "fu-foo-closure-kickoff.md" -Topic "FU-foo closure"
```

The script enforces the Phase 0 gate (must be on main), fetches origin, pulls main, creates a fresh branch derived from the filename slug, commits, and pushes. Branch naming convention: `docs/<slug>-brief`. Commit message convention: `docs(briefs): <Topic> kickoff`.

### `/dispatch <brief-path>` (CC slash command)

Defined in `.claude/commands/dispatch.md`. CC reads the brief at the given path, applies the standing methodology (Phases 0–5, Rules 9 / 12 / 15 / 17), executes, opens PR, surfaces URL for dispatcher review.

Operator usage in CC:

```
/dispatch docs/briefs/fu-foo-closure-kickoff.md
```

Replaces the long-form "PR dispatch — Kickoff brief: ..." prose payload from prior PRs.

### `/post-merge <pr-number>` (CC slash command)

Defined in `.claude/commands/post-merge.md`. CC runs the canonical post-merge sequence: sync main, capture squash SHA, fill `#TBD` / `{TBD}` placeholders, commit + push direct to main, Rule 15 verification.

Operator usage in CC (after confirming squash merge in GitHub UI):

```
/post-merge 217
```

### When NOT to use the tooling

- **Audit-only dispatches** stay inline (no brief commit PR, no slash command). Short, scoped, no-PR-output investigations are not subject to Rule 10.
- **Decision points** — scope judgment, smoke waiver evaluation, hard-stop recovery options — handled by dispatcher in chat. Tooling embeds methodology, not judgment.
- **Verbatim `git log` paste-back** (Rule 16) — operator pastes raw output to dispatcher. Slash commands report verification, but the operator-side paste-back remains manual per banked rule.

### Known behavior: slash commands display as unrecognized but execute correctly

Slash commands defined in `.claude/commands/` (currently `/dispatch` and `/post-merge`) are injected into CC's prompt context and execute correctly when invoked. The operator-facing CLI may display them as "unrecognized" at invocation time — this is a cosmetic dual-surface gap, not an execution failure. CC has received the command body and will begin executing within a few seconds.

If you see "unrecognized" after pasting a slash command: wait briefly. If CC begins executing the brief or post-merge sequence, the command worked. If CC does not respond to the command body within ~30 seconds, treat as a real failure and fall back to the long-form payload from the dispatcher.

Confirmed across 2 cycles: PR #217 (d84a752) /post-merge invocation, PR #219 (0b3f058) /dispatch + /post-merge invocations.

Banked: PR #217 (d84a752).

- Dispatch Orchestrator (sibling folder, not this repo; see `docs/orchestrator/README.md`): local Python tool that runs the dispatch workflow headlessly - Phase 0 gate -> `claude -p` (opusplan) -> full-transcript capture -> hard-stop pause. v1 supports `--resume` (Phase 2+ after lock) and `--build` (Edit/Write); writes confined to feature branches, never main; PR-open pauses for manual merge. Post-merge fill stays manual (v2 planned). Digests in its `logs/` are the rule-banking source; `cost-ledger.json` tracks burn.

- **CC model tier per brief.** Every brief carries a suggested tier — operator overrides at will: **Tier-A** mechanical / test / docs → Haiku or Sonnet; **Tier-B** feature-from-brief (standard build) → Sonnet; **Tier-C** net-new / cross-cutting / ambiguous surface → Opus (via `opusplan` profile).

- **Persona-review section in net-new/complex briefs.** Briefs for new collections, auth surfaces, or cross-cutting changes include a persona-review checklist before the Decisions-locked section. Standard lenses: tenant-isolation/data-integrity · role/permissions · money-correctness · operator-legibility · a11y/contrast · pilot-ops/reversibility · maintainability.

---

## Banked patterns (also from 2026-05-14 session)

**Brief-drafting verification rule (already banked, reinforced this session):** `project_knowledge_search` lags `main` by several PRs. Briefs based on project knowledge alone can embed stale premises. The Phase 1 discovery gate in every brief catches this — never skip it, even for "small" fixes. emailQueued (#136), SEC-9b (#139), and SHAKEDOWN-001 (#141) all had brief assumptions Phase 1 corrected.

**Smoke standard, reinforced:** Walks MUST include a real write-read-verify cycle. Selector-only checks miss permission/rules/index bugs. The shakedown design follows this principle — every category does at least one real Firestore write through the rule layer.

- **Smoke is CC's default, not Kyron's manual check.** CC runs production smoke autonomously for every PR via `setupBypassSession` from `scripts/verification/lib/walk-helpers.mjs`. The default is RUN. Waiver is only acceptable when changes are clearly outside any user-visible behavior path (pure docs commits, pure type changes, internal refactors with no UI surface). Even rendering/a11y/timing changes get a smoke walk — RTL covers component logic, but smoke covers real-DOM + real-timer behavior under real Firebase backoff that RTL can't simulate. Brief authors must justify a smoke waiver explicitly; absence of waiver = CC runs the walk. Banked from PR #151 (Wizard R2-R5 polish) where brief waived smoke for pure-rendering changes and Kyron retroactively flagged this as too permissive a default.

- Standing per-surface regression smokes are catalogued in `scripts/verification/SMOKES.md` (descriptive, not CI-enforced).

- **Static CSS verification as smoke replacement for utility-alias and config-binding refactors.** When smoke is genuinely waived per the "internal refactor, no user-visible behavior" carve-out, CSS-only changes verify deterministically by inspecting the compiled bundle: fetch `dist/assets/index-*.css` (post-build) or the Vercel preview's served bundle, grep for expected utility classes, confirm rules emit with expected `var(--*)` resolution. Stronger than human spot-check (deterministic), cheaper than full smoke (no auth or navigation). Validated in PR #155 (arbitrary CSS-var-syntax → named-utility sweep — verified target utilities present in preview bundle, source patterns tree-shaken) and PR #156 (border-border resolution — verified `.border-border` rule emission in compiled bundle BEFORE smoke measured computed colors). For genuinely-waivable CSS-only refactors, this is the load-bearing verification.

- **Mobile-viewport smokes need viewport-aware login routines.** `setupBypassSession` in `walk-helpers.mjs` currently waits on a sidebar nav selector (`nav[aria-label="Primary navigation"]`) that is CSS-hidden at mobile (390×844). Mobile-viewport smokes must either use a mobile-friendly selector for login confirmation (e.g., `waitForFunction(() => document.body.textContent.length > 100)`) or briefs must call out the workaround explicitly. Future improvement: make `setupBypassSession` viewport-aware. Banked from PR #153 smoke debug.

- **Preview env data gaps can force smoke skips.** When a smoke step needs data behind a Firestore state (submission history, settled awards, etc.) and the preview env has no seed data for it, the smoke MUST skip-not-fail with an explicit note in output. Briefs should anticipate this by either providing a seed path or accepting code-inspection-derived findings + manual production verification. Banked from PR #153 where P1-2 History row smoke verification skipped due to no submission data in preview.

- **Self-service `list` queries must be smoke-tested as the owning user.** For any Firestore collection where an agent (or any `canAccessOwn` user) should be able to list their own docs, the smoke MUST include a write-then-list cycle signed in as that user: `signInAs(agentUid) → getDocs(query where ownerId == uid) → assert non-empty`. Admin SDK reads (bypass rules) and manager reads (`canManage`) do NOT prove agent list access. Pattern: `allow read → allow get/list` split silently drops the `canAccessOwn` arm from `list`; verified only by an agent-signed-in list query. This is the second `list`-rule regression to slip past `get`-only coverage (SHAKEDOWN-002B → hotfix PR #298). Banked from PR #298 (`a2ffbff`).

- **All new JSX components must explicitly import React for Vitest compatibility.** Vite supports automatic JSX transform but Vitest does not apply the same config. Files relying on automatic transform will fail any new test that mounts them. Audit: as of PR #153, `CommissionPlayground/index.jsx` was the only file in this state; post-#153 it is fixed. Future new components must explicitly import React even when adding only `useState`/`useEffect`/etc. Banked from PR #153 test phase debug.

**Cron timezone handling for Trinidad pilot:** Trinidad observes permanent AST (UTC-4, no DST). Firebase Functions v1 default is `America/Los_Angeles` (DST-observing). For scheduled functions whose cron strings are written in UTC reasoning (e.g., comments like "Sunday 6 PM Trinidad time = 22:00 UTC"), chain `.timeZone('UTC')` to preserve author intent and avoid DST drift. Alternative — `.timeZone('America/Port_of_Spain')` with cron strings rewritten to AST-local — works but requires rewriting all cron strings.

- **Firestore collectionGroup rules require a top-level recursive wildcard `match /{path=**}/collectionName/{id}`.** Path-specific match rules (`match /tenants/{tid}/users/{uid}/collectionName/{id}`) are NOT reliably evaluated for collectionGroup queries by Firestore's security rule engine. ALWAYS add a separate top-level wildcard match when a collection needs a `allow list` for collectionGroup access. Two additional gotchas caught in I1.2 (PR #256): (1) A combined `allow list: if arm1 || arm2` where arm2 references a `{pathVariable}` causes production Firestore to reject the ENTIRE OR expression for collectionGroup queries — it cannot short-circuit OR when any arm is statically unverifiable. Split such rules into two separate `allow list` declarations (each is evaluated independently). (2) The emulator false-fails for collectionGroup rules that reference path variables in any arm — production Firestore is the authoritative gate for collectionGroup rule validity. Emulator-green is necessary but not sufficient for collectionGroup rules.

- **React 19 controlled-select automation in smokes.** Use `selectReactOption(page, locator, value)` from `walk-helpers.mjs`. Playwright's `selectOption()` fires a trusted Chromium change event that React 19 handles correctly. Do NOT layer an extra `dispatchEvent('change')` with a generic `Event` after `selectOption()` — the extra dispatch can interact badly with React's synthetic event system and may leave the select appearing blank on subsequent reads. Banked from PR #248 smoke debugging.

- **Overflow-container visibility in smokes.** Use `domTextCount(page, selector, text)` from `walk-helpers.mjs` for "is this data rendered anywhere in the DOM" checks inside `overflow-auto` containers (modals, drawers, scrollable lists). Playwright's `waitFor({ state: 'visible' })` treats elements scrolled off-screen within an overflow container as not visible — correct for viewport/UX checks, wrong for data-rendering checks. Use `isVisible()` only when the human-visible viewport is what you're asserting. Banked from PR #248.

- **REST-write vs SDK-read in smokes.** The canonical smoke pattern is end-to-end via the UI path (write via SDK in the app → hard-reload → observe via SDK). Smokes that write via Firestore REST in a fresh context cannot reliably observe their own write via the same context's SDK — the SDK may cache or see a pending state. REST reads of the same doc are the correct diagnostic path; SDK observation in the same context is not. Banked from PR #248 (`6b3c252` reverted wrong `getDocsFromServer` production code change).

- **Console/network capture in smokes.** Call `captureConsoleAndNetwork(page)` from `walk-helpers.mjs` immediately after `context.newPage()` and before any `goto()`. Returns `{ consoleMessages, networkFailures }` accumulating across the page's lifetime. Call `formatCaptureReport(capture)` before smoke exit to print the summary block. Static-asset noise (`.map`, `.ico`) is filtered inside the helper — per-feature smokes need no extra filter. Banked from PR #238 post-merge (ad-hoc supplemental script pattern, now canonical).

- **Mobile bottom nav "More" drawer pattern.** On 390×844 mobile viewport, ManagerDashboard sidebar-only tabs (any item NOT in `BOTTOM_NAV`) are accessible only via the "More" button in the bottom nav, which opens a slide-up drawer (`MobileNavDrawer`). Smokes navigating to sidebar-only tabs on mobile must click the "More" button first (`getByRole('button', { name: /^more$/i })`), wait 500ms for the drawer to animate, then click the target nav item. Tabs in `BOTTOM_NAV` (Dashboard, Team, Reports, Campaigns, Profile) are directly clickable without opening the drawer. Banked from I1.2 PR #256 smoke fix.

- **Smoke locator specificity — diagnose with screenshots before adding waits.** When a smoke step fails with a timeout, take a screenshot immediately after the timeout fires. If the expected element is **already visible** in that screenshot, the issue is locator breadth, not timing — do not add a wait. `locator('div').filter({ hasText }).first()` resolves to the outermost ancestor `<div>` containing the text (often `<div id="root">`), making any chained `locator('text=')` on it unreliable. Fix pattern: scope to the semantic container class (`.card` for policy cards in `PolicyLedgerPanel.jsx`, `.modal` for modals, etc.) and use chained `.filter({ hasText })` instead of `.locator('text=')` on a `first()` element. `filter({ hasText })` checks whether the matched element itself contains the text; `locator('text=')` searches descendants and can match unexpectedly wide ancestors. Banked from PR #358 (`4167af9`, 2026-05-27) — leg3-reload-settled was 47/48 for three consecutive runs; screenshots showed the "Settled" badge clearly present while the test had already failed.

- **`hasOnly` enforcement relies on `diff().affectedKeys()`, so unchanged field values are invisible to the rule.** Firestore's `request.resource.data.diff(resource.data).affectedKeys()` only includes keys whose values *change* in the write. If an emulator deny-test writes `{ agentId: 'agent-a' }` and the document already has `agentId: 'agent-a'`, `agentId` does NOT appear in `affectedKeys()`, `hasOnly` never evaluates it, and the write is allowed. **Emulator deny-tests for `hasOnly` violations must write a value that differs from the existing document** (e.g. `agentId: 'tampered-id'`) so the key appears in the diff and triggers the rule. Same caveat applies to `hasAll`, `hasAny`, and any rule expression that reads from `diff().affectedKeys()`. Banked from PR #365 (`359149b`, 2026-05-27).

- **`FieldValue.serverTimestamp()` is rejected by Firestore inside array elements during `tx.update()` — use `Timestamp.now()` instead.** Firestore's Admin SDK enforces this at runtime, not at type-check time: `Update() requires either a single JavaScript object… FieldValue.serverTimestamp() cannot be used inside of an array (found in field "pendingReview.\`0\`.firstLoggedAt")`. Replace with `admin.firestore.Timestamp.now()` (a real value, not a sentinel) anywhere a timestamp is stored inside an array field. CF unit tests that mock `admin.firestore.FieldValue` to return a plain string do NOT catch this — the mock is a valid Firestore value but the sentinel validation only fires against real Firestore. Always verify CF writes that use `FieldValue` methods inside arrays via post-deploy smoke or CF emulator integration tests. Banked from PR #373 (`df161fe`, 2026-05-28) — H4 `aggregatePendingPlan` CF.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
