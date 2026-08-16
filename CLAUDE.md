# AgencyTrack — Claude Code Project Memory

This file is the always-loaded router. It carries identity, hard constraints, schemas and
named rituals, plus the Rules 1–25 index. Explanatory detail, incident history and
specialised playbooks live in `docs/agents/` and are opened on demand — the router table
at the bottom says which file holds what.

## What This App Is
Insurance sales activity tracking SaaS for Tatil Life, Trinidad & Tobago.
Agents submit weekly reports. Managers review them. Built to scale to multiple companies.
Firebase project: agencytrack-2a610 | App: portal.agencytrack.app | Marketing: agencytrack.app | Repo: github.com/Kelsean868/agencytrack


## Commands
- `npm run dev` — Start dev server at localhost:5173
- `npm run build` — Production build to dist/
- `npm run repomix` — Generate Claude context snapshot (run before every session)
  - Scope: pack only the active track's `src/` subtree for pure React tracks (K9, planner, goals). **Never scope a `functions/`-touching pack** — that tree has no trusted structural index, so a scoped pack there builds on stale anchors (Rule 17). Pack full, or grep full, the moment a brief touches `functions/`.
- `firebase deploy --only functions` — Deploy Cloud Functions
- `firebase deploy --only firestore:rules` — Deploy Firestore rules
- `firebase deploy --only firestore:indexes` — Deploy Firestore composite indexes
- `firebase serve` — Run Firebase emulator locally


## Workflow — IMPORTANT
- **Never push directly to main.** Production auto-deploys from main on every merge.
- Claude Code uses worktree branches by default. Push branch, open PR, verify Vercel preview, merge manually.
- Vercel preview URL pattern: `agencytrack-git-{branch}-kyron-marchan-s-projects.vercel.app` (per-team URLs include the team slug; the bare form is NOT what Vercel emits). **Check the 63-char DNS-label limit BEFORE relying on the alias in a smoke** — a long branch name silently fails to resolve rather than erroring. Fallback: the immutable per-deployment URL from the GitHub deployment status. Mechanics + `gh api` recipe: `docs/agents/release-and-post-merge.md`.
- Always smoke-test the preview URL in incognito before merging
  - **⚠️ A feature-branch preview runs against PRODUCTION Firebase (`agencytrack-2a610`). Treat anything you do there as touching live data.** Vercel's staging env vars are bound to the **`staging` branch specifically**, not to the Preview *environment*, so a branch cut off `staging` builds against prod. Evidence (2026-07-26, same credentials, same minute): the staging A11Y agent gets **LOGIN-OK** on `agencytrack-git-staging-…` and **AUTH-ERROR** on `agencytrack-git-<feature>-…` — the account does not exist in prod. **Signing in with a PRODUCTION account authenticates normally and reads/writes the live tenant.** A read-only click-through is acceptable with that understanding; **never run a MUTATING smoke against a feature-branch preview.** This supersedes the older belief that Firebase's authorized-domains allowlist keeps previews away from a live backend — that read the right symptom backwards. To verify a feature branch against staging instead: `npm run build -- --mode staging`, confirm the bundle carries `agencytrack-staging` and **zero** `agencytrack-2a610`, and serve it locally. Full finding + remedies: `docs/FOLLOW_UPS.md` § Feature-branch Vercel previews are bound to PRODUCTION Firebase; smoke-side hard rule in `scripts/verification/SMOKES.md`. Banked from the planner week-nav track (PR #875).
- **`main` IS protected, but admins bypass it — so the merge gates remain procedural.** Verified 2026-08-16 via `gh api repos/Kelsean868/agencytrack/branches/main/protection`: two required status checks (`lint-and-build`, `functions-tests`), `allow_force_pushes: false`, `allow_deletions: false`, and **no** required PR reviews. The one that matters: **`enforce_admins: false`** — Kyron is an admin and is the only person who pushes to `main`, so every required check is bypassable and in practice advisory for him. A direct push reports `remote: Bypassed rule violations for refs/heads/main: 2 of 2 required status checks are expected.` and lands anyway. **`staging` is not protected at all** (the protection API returns 404), which is why promotion can delete it.
  So the discipline still binds: never merge a PR until local lint + full suite + build are green AND the PR's `lint-and-build` and `functions-tests` checks show `SUCCESS` (poll them). `gh pr merge --admin` is forbidden in all circumstances. Banked from the Track J overnight queue (merges were observed landing while CI was still in progress); **corrected 2026-08-16** — the earlier wording claimed protection was "not platform-enforced on this plan", which was false. The observed behaviour was admin bypass, not absent protection. Whether to set `enforce_admins: true` is tracked as a HIGH follow-up.
- **Standing green channel (auto-merge eligibility).** Replaces all prior night-only auto-merge authorizations. **Channel assignment is the dispatcher's call, per item, in the brief** (`green-channel` / `human-merge`); **CC NEVER self-promotes an item into the channel** — when the brief is silent or there is any doubt, it is human-merge.
  - **Green-channel-ELIGIBLE** (CC may `gh pr merge --squash` at any hour) ONLY when EVERY gate self-passes: scope-lock · lint 0 · full suite · build · hex-grep (Nexus-token-only) · axe NO-NEW vs main · both-themes preview smoke with §2 screenshot review · §7 self-review · §6 external-review triage · the procedural CI gate above (`lint-and-build` + `functions-tests` polled to `SUCCESS`) · then merge → wait for prod deploy → **prod-smoke** → **AUTO-REVERT** (`git revert <squash-sha>` direct to main) on prod-smoke fail. **Two consecutive auto-reverts HALT the channel** — all remaining items end at open PRs. Eligible categories: docs-only · test-only · verification scripts/smokes · read-only probes · **TRUE-RESTYLE** ports that pass the Phase-0 mockup-vs-component diff-lock · mechanical refactors fully covered by characterization tests.
  - **ALWAYS HUMAN-MERGE** (never auto, regardless of gates): `firestore.rules` / auth / custom claims · new collections or write paths (first landing) · functions or email-template deploys · anything money-affecting or data-migrating · token **DEFINITIONS** / design-system changes · REDESIGN-class slices · anything carrying an aesthetic or product judgment call · anything that only fits the channel by stretching a definition. **When in doubt → human-merge.**
  - The strike system and Rules 15 / 16 / 18 / 20 are unchanged. Banked from the Track J overnight program (codifies the night-only §1 auto-merge loop as a standing, dispatcher-gated policy).
- After merge, do a 60-second smoke test on production
- **`.env.local` does NOT auto-propagate to feature worktrees.** Verification scripts depending on `A11Y_*_EMAIL` / `A11Y_*_PASSWORD` / `VERCEL_BYPASS_TOKEN` need explicit setup per worktree (`cp ../AgencyTrack/.env.local .`) or must run from the main worktree. See `docs/agents/secrets-and-credentials.md`.
- **`.env.local` — use, don't echo.** Programmatic reads (scripts, `process.env.X`, `firebase deploy` reading credentials) are fine and expected. **Never echo the values to chat output, PR descriptions, commit messages, logs, or screenshots** — reference by env-var name only.
  - Never `cat` / `echo` / `head` / `less` / `type` / `grep` a file containing token values. "I'm just checking it exists" is not a workaround — use the boolean-only `node -e` check in `docs/agents/secrets-and-credentials.md`.
  - Never construct a URL with a token query-param and pass it as a tool param. Beware shell/PowerShell command substitution resolving a token into the command line before execution. Use `setupBypassSession()` from `scripts/verification/lib/walk-helpers.mjs`; after handshake, all navigation uses bare URLs. **This bullet states the SECRETS case of a general rule — see § Banked patterns, "Any text passed to a shell inside double quotes is EVALUATED, not quoted." The general form bit on a commit message, not a credential.**
  - **If a tool mechanism forces a token into a string param: STOP and surface, never work around.**
- **Additive Firestore rules / Cloud Functions may be deployed from the feature worktree before the PR merges**, so the preview can exercise the new path against real prod rules/functions. Permitted only for: new `match` blocks (no edits to existing rules); new CF exports; CF changes gated behind new input fields absent from existing callers. Modifications where existing callers exercise the new behavior → post-merge only. Capture deploy output in the PR description. Detail: `docs/agents/release-and-post-merge.md`.
- **`firestore.indexes.json` changes require an explicit `firebase deploy --only firestore:indexes` and explicit deploy confirmation** — they do NOT auto-deploy via Vercel. Capture the output or the Console index ID + `Enabled` status in the PR description before merge.
- **Functions / email-template / index changes take effect only after an explicit `firebase deploy` (`--only` as appropriate) — never assume deployed because merged.** A squash-merge to `main` ships the *code*, but Cloud Functions, `functions/email-templates/*`, and `firestore.indexes.json` do NOT auto-deploy via Vercel. Production behavior for these surfaces changes only when the corresponding `firebase deploy --only functions|firestore:indexes|...` has actually run (a dispatcher/human action per Rule 19). Treat "merged" and "deployed" as independent states for these three surfaces. Banked from ledger row-34 (Emails) lesson; codified Track J overnight queue 2026-06-04.
- **After a PROMOTION, audit the whole range for deploy-gated surfaces — per-slice "zero backend delta" claims do NOT compose.** Run the trigger between merge and acceptance: `git diff --stat <old main HEAD> <merge commit> -- firestore.rules firestore.indexes.json functions/`. **Non-empty is a TRIGGER, not a verdict** — git cannot see what Firebase is serving, so never report a production gap from it. The verdict comes from *running* the deploy, which is idempotent and says `already up to date, skipping upload` when nothing is stale. First run (`b4d9be7b`, 2026-08-16): trigger fired on `firestore.rules +18/−2` (`74a321bc`/#878), deploy was a **NO-OP** — #878 was DEPLOY-GATED and already live. Full text + the reference-point rule it belongs to: `docs/agents/release-and-post-merge.md`.
- **The reference point must match the question.** A correct comparison against the wrong reference point runs, returns, and answers something else — it never errors. Three instances so far: two endpoints where the **merge-base** was needed (Rule 3, #886) · the merge-base where a **fixed ref** was needed (#907 pre-flight) · **git** where the **deploy target** was needed (the rules audit above). Name the question in words first, then check the reference point can even see what the question is about. Detail: `docs/agents/release-and-post-merge.md`.
- **`firebase deploy` pre-flight, every time:** (1) worktree HEAD matches `origin/main` — mismatch → STOP and surface (waived only for the additive pre-merge carve-out above); (2) `node_modules` installed at the relevant package root (`functions/node_modules` for functions deploys); (3) authenticated against the correct Firebase project via `firebase use`. Why each: `docs/agents/release-and-post-merge.md`.
- **Squash SHA ≠ feature-branch SHA.** GitHub generates a fresh SHA on squash-merge. Kickoff briefs and CONTEXT.md `Recently shipped` rows record the squash SHA from `git log origin/main --oneline -1` post-merge, never the feature branch's pre-squash final SHA.
- **Brief drafting from FOLLOW_UPS.md items must verify codebase state first** — `git log --all --grep="<topic>"` before drafting. If the work already shipped, update FOLLOW_UPS.md instead of writing the brief. (Rule 10 for brief commit convention; Rule 11 for FU-body re-audit.)
- **Admin-script firebase-admin require path.** `firebase-admin` is installed only in `functions/node_modules`, not at the repo root. Scripts at `scripts/` or `verification/` that use the Admin SDK must either `require('../functions/node_modules/firebase-admin')` (relative to the script's location) or run from inside `functions/`. Adding `firebase-admin` to repo-root `package.json` is intentionally avoided — Cloud Functions packaging is the canonical install path. Banked from C2 close.
- **Cloud Functions auth: ambient credentials, not key files.** Functions that mint custom tokens or call `signBlob` use plain `admin.initializeApp()` — **never ship `service-account-key.json` in the deploy bundle.** The one-time `roles/iam.serviceAccountTokenCreator` grant and its `gcloud` invocation are in `docs/agents/release-and-post-merge.md`.
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


## Theme System — Nexus v2 (Warm Theme)

Canonical for **app** surfaces. Values: `docs/design-system/tokens/app.css`. App rules:
`docs/design-system/guidelines/redesign-addendum.md` (wins over the DS `readme.md`).
Integration record: `docs/design-system/INTEGRATION.md`. **Design intent:** the per-screen
mockups under `docs/design-system/screens-v2/` are canonical, not historical — port toward
them. The "looks-canonical-but-isn't" traps are catalogued in
`docs/design-system/DESIGN-FOLDER-CATALOG.md`.

**Scope decision:** the app retains its `:root` / `.dark` scoping and kebab `--color-*`
names — the DS's `.nexus` scope and camelCase names were NOT adopted. This is a **reskin:
values change, plumbing stays.** Token values, the gold split (`--color-gold` decoration-only
vs `--color-gold-ink` for text), the AA fix and the glass reconciliation:
`docs/agents/design-system-notes.md`.

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
- **No `text-ink-faint` on any new text element — use `text-ink-muted`.** (D5.) For non-text dividers/disabled glyphs use `--color-ink-dim` (`border-ink-dim`), never text.
- **White-text primary buttons always pair `bg-primary` with `dark:bg-primary-dark`** — dark-mode `--color-primary` is the lifted text teal, not a button background. (D6.)
- AgentReportDocument.jsx is EXEMPT — react-pdf doesn't support CSS vars, uses HEX only.

## Current Phase
**Pre-Tatil-demo polish — wrapping up.** App has not been demoed to Tatil yet. Goal: ship app close to v1.0 because Kyron is also the decision-maker for the branch and wants minimal rework after pilot.

Tracks A through E are complete. User-mgmt PR-3/PR-4/PR-4b, M-series, Polish-1/2, PR-D server-side email, and PR-F bulk test data tooling have all shipped. The remaining pre-pilot work is **end-to-end pilot prep using the new PR-F bulk-seed + cleanup tooling**: exercise the full create-user → wizard → manager review → kiosk → AOM flow under realistic data volumes before the Tatil demo. After that, **SEC-9b** services-tenantId refactor is queued.

Not-yet-complete tracks (the rest of the build history is in git log and `docs/CONTEXT.md`):
- **Track D** — cron + notifications verification: ⚠️ PARTIAL. PR-D server-side email (#133) closed the notifications half (HIGH#5); the cron half is tracked in `docs/FOLLOW_UPS.md` § Track D cron portion status verification.
- **Pilot Prep** — end-to-end testing using PR-F tooling with real Tatil accounts: 🚧 IN FLIGHT (next track). App not at Tatil yet.
- **P9** — Sales Manager role: ⏳ Planned (post-pilot). `sales_manager` claim + rules shipped via user-mgmt PR-1+; cross-branch UI surfaces remain.
- **P10** — Multi-tenancy full rollout: ⏳ Deferred (post-pilot).

Open follow-ups live in [`docs/FOLLOW_UPS.md`](docs/FOLLOW_UPS.md). Dynamic state (active track, recent shipping, where-we-left-off) lives in [`docs/CONTEXT.md`](docs/CONTEXT.md).

## Key Technical Decisions
- `isTestAccount: true` on a user doc (`tenants/{tid}/users/{uid}`) excludes that account from **both** leaderboard surfaces — `leaderboard/{uid}` via a write-layer guard in `onSubmissionWrite`, and `leaderboards/{branchId}` via a read-layer filter in `leaderboardAggregate.js`. Set via `scripts/maintenance/flag-test-accounts.mjs` (`--apply --emails`). **Hard-excluded from flagging: `kyronmarchan+tenant@gmail.com`** (real tenant admin). Absent/false → behavior unchanged. Mechanism + PR references: `docs/agents/firestore-notes.md`.
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
Source tree map: `docs/agents/architecture-map.md`. Prefer `npm run repomix` — it
regenerates the authoritative tree every session.

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

> **Writing `firestore.rules`, adding a composite index, or putting a `FieldValue`
> sentinel inside an array in a Cloud Function? Read `docs/agents/firestore-notes.md`
> first.** Three of the traps there produce a *falsely passing* test rather than an error.

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

## Lint Policy

`npm run lint`, `npm test`, and `npm run build` must all pass before any push. Enforced by
`.github/workflows/ci.yml` (lint + tests + build on every PR to main).

**Baseline:** 0 errors, 0 `jsx-a11y` warnings.

**`_` prefix convention:** variables that must appear in a destructuring/param list but are
intentionally unused are prefixed with `_`; the lint rule ignores `/^_/`.

React Compiler rules are deliberately `off` in `eslint.config.js` — see
`docs/agents/test-and-lint-notes.md`.

## Test Policy

`src/firebase.js` is **globally stubbed in tests** via `firebaseTestStubPlugin` in
`vite.config.js`. Rules for test authors:
- **Never mock a service solely to avoid Firebase init.** The global stub handles init. Mock services only to control return values for assertions.
- **`vi.mock(id, factory)` takes priority** over the global stub for any service a test explicitly mocks.
- **Env-unset parity is the default gate, not a separate check.** The baseline is the full suite passing with `VITE_FIREBASE_*` UNSET, matching CI exactly. Do not rely on local env vars masking failures that will surface in CI.

Mechanism, the Vite 8 alias limitation, and the explicit-React-import requirement for new
JSX components: `docs/agents/test-and-lint-notes.md`.

## Session Protocol

Step numbering is preserved from the original file — Rules 15 and 16 cite "step 9" and
"step 9.5" by number.

2. Run `npm run repomix` to get fresh codebase snapshot before each session
4. Work on a feature branch (Claude Code default), never main directly
5. After all changes, run `npm run lint && npm test && npm run build` — all must pass before pushing
6. Push branch, open PR — CI will run lint + tests + build automatically on GitHub
7. Verify Vercel preview URL in incognito
8. User merges PR manually — only then does production update
9. After merge, do a 60-second production smoke test
9.5. After merge, before running production verification: `git fetch origin --prune && git pull origin main`. The pull ensures worktree-local verification tooling matches the merged state on origin; `--prune` keeps `git branch -r` and `git branch --merged` accurate. (Rationale + the PR #49 / #57 lessons: `docs/agents/release-and-post-merge.md`.)

### Post-merge local cleanup (standard sequence, not exception)

**Phase 0 — branch confirmation gate.** Before step 9.5's pull, verify
`git rev-parse --abbrev-ref HEAD` returns `main`. If not, `git checkout main` before any
further command.

After the pull and after capturing the squash SHA from `git log origin/main --oneline -5`:

- **Local branch deletion uses `git branch -D <feature-branch>` (force)** — with `deleteBranchOnMerge: true`, the remote tracking ref is pruned before local cleanup runs, so `git branch -d` cannot verify merge status and will refuse.
- **If `git pull` aborts on an untracked doc collision**, follow the hash-compare procedure in `docs/agents/release-and-post-merge.md` — identical hashes → `rm` and re-pull; differing hashes → surface as a real conflict, never auto-resolve. Prevention: draft docs-only PR files inside the PR's own worktree.
- **Verification target = no NEW stale state from this PR.** "Clean" means this PR's branch is deleted, its worktree removed, no PR-specific untracked artifacts remain. Pre-existing stale branches belong to the running Worktree + branch audit FU, not this PR's cleanup.

Rule 16 governs the fill scope for this sequence; Rule 15 governs the origin-verification step for any commit produced by it.

### Single-branch PR rule
One worktree branch = one PR. Never extend an open PR by pushing unrelated work to its branch.
If scope grows mid-PR, open a follow-up PR on a fresh branch after the current one merges.
Claude Code creates worktree branches automatically — each maps 1:1 to a PR.

- **Always sync before branching:** run `git fetch origin && git pull origin main` before creating a new branch off main. This eliminates the merge-conflict class entirely. (PR #31 / A11Y PR2 incident: `docs/agents/release-and-post-merge.md`.)

## Methodology Rules 1–25

Apply on every CC brief and dispatch. Below is the binding index — number, name, and the
instruction. **Full canonical text, every incident, PR number and SHA:
`docs/agents/methodology-rules.md`.** Cite rules by number; the numbering is stable.

**1. Surface before architectural decisions.** CC must surface (per Rule 12's STOP and wait
for dispatcher semantics) for Kyron's acknowledgement BEFORE any decision not pre-listed in
a brief's "Decisions locked" section: scope expansion beyond the file inventory · new
architectural patterns (cache, helper, state mechanism, localStorage) · test-file rewrite
from scratch · inline fix of unexpected behavior · any "how to solve" decision not
pre-decided. **"Solve rather than surface" is itself a strike condition even when the
resulting fix is correct.** Never skip a brief's Phase 1 discovery gate, even for "small" fixes - standing practice, not part of Rule 1's canonical text (see the brief-drafting appendix in `docs/agents/methodology-rules.md`).

**2. Phase 1 audits enumerate ALL data paths.** For permission-boundary fixes, Phase 1
enumerates every function returning data joinable to the entity being scoped — not just
those named in the bug report. Document the enumeration in the Phase 1 surface output:
list every exported function in the relevant service(s) and classify each (already scoped /
not joinable / unscoped gap).

**3. Autonomous-mode strike calibration.** For autonomous runs: **bugs found are NOT
strikes** · **infrastructure failures ARE strikes** (seed/wipe failures, cleanup orphans,
script crashes) · **data-safety issues are STOP IMMEDIATELY** — single stop, not 2-strike,
regardless of strike count · **cleanup is non-negotiable** — wrap orchestration in
`try/finally` with cleanup in `finally`.

**4. env-listing commands filter for KEY= pattern.** Any command listing `.env.local` (or
any env file) must filter for `^[A-Z0-9_]+=` so non-`KEY=VALUE` lines are never echoed as
raw values. The character class **must include digits** — `A11Y_*` keys are silently missed
by a digit-less pattern. PowerShell:
`Get-Content .env.local | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { ($_ -split '=')[0] }`

**5. Phase 3 verification must include actual invocation, not just module resolution.** For
briefs with scripts touching external services, Phase 3 includes a real invocation in
non-destructive mode (dry-run, list, count) that exercises the connection layer.
"Compiles" or "loads" is insufficient.

**6. Phase 1 validates data quality, not just data structure.** For permission-boundary
fixes, denormalization, or any change depending on existing values, Phase 1 verifies both
**structural integrity** (does the field exist?) and **assignment completeness** (does it
hold a non-null, non-empty value?). Sample-read a representative subset and surface sparse
fields or assignment gaps as Phase 1 findings.

**7. Active follow-ups table = active items only.** When a row's status transitions to
CLOSED, remove it from Active follow-ups in the same Phase 4 docs commit as the resolving
PR. Audit trail lives in git log, the Recently-shipped table and `docs/FOLLOW_UPS.md`.

**7(b). New FOLLOW_UPS entries APPEND AT THE END — never insert mid-file.** New detail
bodies go at the end of `docs/FOLLOW_UPS.md`; the index table at the top is still edited in
place. Appending makes concurrent additions land in disjoint regions so git merges them
without a human. Applies to any append-only doc a slice touches — `SMOKES.md`, the
prototype-defect register, `CONTEXT-history.md`. Rule 7 governs **removing** closed rows;
7(b) governs **where new ones go**. Full text: `docs/agents/methodology-rules.md`.

**8. Phase 4 stale-row audit.** During Phase 4, scan the Active follow-ups status column for
"PR open" / "awaiting merge" / "in progress" claims and verify each against
`gh pr list --state open` and recent `git log origin/main --oneline -20`; reconcile drift in
the same commit. **The audit extends to CONTEXT.md prose, not just the table** — `git grep`
any named component referenced in prose and verify the claim against current state.

**9. Dispatcher Phase-5 scope-extension protocol.** CC MUST NOT unilaterally expand scope.
When findings adjacent to locked scope surface, the dispatcher MAY authorize an in-PR
extension: surface as out-of-scope → dispatcher evaluates → if authorized, CC applies via a
NEW commit (not amend), updates the PR description, re-stops at Phase 5. **Standing
carve-out — the only one:** the `text-*-faint → text-*-muted` contrast fix (PR #392) is
pre-authorized in-PR without a per-instance stop. Any other new serious/critical axe node vs
the main baseline still requires surface → STOP → authorization.

**10. Kickoff briefs commit before CC dispatch.** Every kickoff brief for an implementation
PR — any size, no exception — commits to `docs/briefs/` via a standalone docs PR BEFORE CC
is dispatched against it. Audit-only dispatches stay inline (the chat prompt is the brief).
Execution is via the `/land-brief <topic-slug>` skill. **Dispatch guard:** before reading any
brief, `/dispatch` MUST `git fetch origin` and confirm the brief exists on `origin/main`
(`git ls-tree origin/main -- docs/briefs/<file>` non-empty); if missing, **STOP IMMEDIATELY**
("brief not on origin/main — merge the docs PR first").

**11. FU body re-audit before first work.** When a FU is referenced for first implementation
work after any gap, the brief author must verify the FU body's claims against current source
BEFORE locking "Decisions locked" — for any named root cause/mechanism, `file:line` target,
or suggested fix shape, quote the current source and either confirm the diagnosis or document
the corrected one in the brief's audit-findings section. The correction lands in the RESOLVED
note when the FU closes.

**12. Hard-stop language must be unambiguous.** Briefs use only two phrases for halt
conditions, no synonyms:

- **STOP and wait for dispatcher** — CC halts execution, posts the surface finding to chat, and does NOT proceed until receiving an explicit dispatcher reply. No autonomous next step, no "I'll continue with a defensible path." This is the default for any condition the brief identifies as a stop.
- **STOP IMMEDIATELY** — reserved for data-safety / production-touch / cross-tenant risk (carried from Rule 3). Same halt semantics, escalated visual weight.

Forbidden synonyms: "hard stop and surface", "flag to Kelsean", "note and continue",
"surface for review". Brief authors must rewrite any halt condition into one of the two
canonical phrases. Pre-banking committed briefs are grandfathered.

**13. Acceptance-criteria waiver protocol.** When environment conditions prevent acceptance
criteria from being verified at Phase 3, the dispatcher MAY authorize merge with a waiver
requiring BOTH artifacts at merge time: (a) an explicit "verification waived because <env
condition>" note in the PR body — not implicit, not "will verify later"; and (b) a
deferred-verification FU banked in `docs/FOLLOW_UPS.md` with full re-run instructions and the
unverified criteria copied verbatim, in the same merge cycle as the resolving PR.

**14. `.env.example` is canonical credential documentation.** Every `process.env.X` /
`import.meta.env.X` / post-`loadEnv` read site must reference a key documented in
`.env.example`. Add the key + one-line purpose comment in the same PR as the first read site;
REMOVE it in the same PR as the reader removal — do not leave deprecated keys with
explanatory comments, they accumulate as bait. Phase 1 audits touching credential-reading
scripts scan both `.env.example` and live reads.

**15. Direct-to-main pushes require origin verification.** For any commit landing on `main`
outside the squash-merge-PR path — including the post-merge fill commit (Session Protocol
step 9 and § Post-merge local cleanup), authorized hotfixes, any dispatcher-authorized direct
push — CC MUST run `git fetch origin && git log origin/main --oneline -1` immediately after
the push and confirm the SHA matches `git rev-parse HEAD` on local `main`. **If it does not
match: STOP and wait for dispatcher** — do not retry, do not amend, do not exit the sequence.
CC's sequence summary MUST include an explicit line stating the commit was pushed to
`origin/main` and the verification SHA matched. "Committed" is not "pushed and verified".

**16. Post-merge fill scope is canonical.** The post-merge cleanup sequence (Session Protocol
step 9.5 + § Post-merge local cleanup) MUST update the following in `docs/CONTEXT.md` every
cycle, regardless of whether the work brief's Phase 4 specified them:

- **Current main HEAD** — squash SHA of the most recently merged work PR (not the post-merge fill commit). For direct-to-main commits without a PR, the commit SHA.
- **Active track** — identifier of the just-shipped work.
- **Next track** — remove what just shipped; promote the next item, or note "(queue clear)".
- **"Where we left off"** prose — summary of the just-shipped PR and what's next.
- **Last updated** — ISO date of the fill commit.

Any `#TBD` / `{TBD}` placeholders from the work PR's Phase 4 are filled with that PR's number
and squash SHA.

**16(b).** Housekeeping / docs-only merges take no post-merge fill commit, and
`Current main HEAD` tracks work squashes only. A merge counts as "work" when it changes
`src/`, `functions/`, schema, rules, or config the build/runtime consumes.

**16(c).** Any program that auto-merges multiple work PRs (harvest batch, night-queue,
remediation batch) is NOT complete until a single consolidated post-merge fill commit covers
every merged PR, with a fill ledger in the commit body (each PR number + squash SHA, Rule
16(b) classification noted). The closing report must reference the fill commit SHA. CC must
not declare a program closed without the fill.

**16 — size caps.** `Recently shipped` ≤ 5 rows; `Last updated` / `Where we left off` /
`Current main HEAD` / `Active track` each ≤ 3 entries. A fill that would exceed a cap moves
the oldest entry to `docs/CONTEXT-history.md` in the same commit.

**16 — naming collision.** Some older briefs use "Rule 4" as shorthand for this post-merge
fill sequence; that collides with canonical Rule 4 (env-listing credential safety) and is
retired — briefs and dispatches cite **Rule 16** for post-merge fill scope, and **Rule 4**
only for env-listing safety. Rule 15 verifies the push produced by Rule 16's fill commit.

**17. Source verification at authoring time.** When a brief or rule describes source
behavior, the author MUST verify each claim against current source BEFORE locking "Decisions
locked" or proposing rule wording:

- **Default behavior / fallback claims** — grep or read the consumer site; never paraphrase from memory.
- **Example values** — trace actual call sites (scheme prefixes, separators, escape rules, units). Operator copy-paste must work verbatim.
- **File paths and line numbers** — open the file and confirm; line numbers drift.
- **Enumeration tracked-status** — pair `grep -rn` with `git ls-files` (or use `git grep`); untracked files inflate migration-target counts.
- **Existing structural format** — read the target document end-to-end before prescribing changes.
- **Operational possibility of proposed wording** — simulate the rule's first execution; check for chicken-and-egg conditions.
- **Aggregated snapshots** — `repomix` compresses function bodies to `⋮----`; a value seen there is **not** verified source. Open the actual file.

Each source-derived claim in a brief should be paired with a Phase 1 verification command CC
can execute (`git ls-files | Select-String`, `git grep -c`, `git check-ignore -v`). If a brief
asserts one without a paired command, CC may verify inline in Phase 1 — no strike accrues for
that, nor for inline correction via Rule 9 when the correction does not change scope or risk.

**17 — new-collection completeness.** A brief introducing a new Firestore collection must
enumerate the full architectural unit in Phase 1 and Phase 2: rules block · write surface
(CF and/or client) · read surface (query shape, filters, orderBy) · composite indexes in
`firestore.indexes.json` · **and the smoke's own query**, whose index requirements differ from
the production app's and are the commonest gap.

Rule 11 is the specific case of this discipline for FU-body diagnoses; Rule 17 is the general
principle. Cite Rule 11 when the FU-body diagnosis is the gap; Rule 17 otherwise.

**18. PR checklist from ground truth.** When opening a PR, fill the template checklist by
what is actually verified at PR-creation time — not what is expected to be true:

- Check `[x]` only for items confirmed true at the moment the PR is opened: tests passing, lint/build clean, docs updated, scope matches brief.
- Leave the smoke box **unchecked** (`[ ]`) until the smoke actually runs. After it completes, edit the PR description to reflect the real result and annotate findings inline.
- An unchecked or annotated box is information, not a failure of process. A reflexively checked box that doesn't reflect reality is the failure.

**19. CC never merges or deploys.** Merge is the dispatcher's action after review in the
GitHub UI. Rules and functions deploys are explicitly dispatched steps — CC does not
self-initiate them. When a deploy or merge gate blocks a task, **STOP and wait for
dispatcher** and report the blocker explicitly. Never cross the gate to unblock yourself.

**20. PR-ready report names the feature-branch HEAD SHA.** Every "PR is ready for review" /
"smoke PASS, holding for pre-review" report MUST include the exact feature-branch HEAD SHA
from `git rev-parse HEAD` on the feature worktree at report time. Once sent, **no further
commits may be pushed to that branch without an explicit re-report** stating the new HEAD SHA
plus a re-run of any verification the new commit could invalidate. **Dispatcher protocol:**
before merging, compare the PR's current HEAD on GitHub against the SHA in the latest report;
if they disagree the PR is NOT ready.

**21. Bot reviewer disposition gate.** After opening any PR, poll for **both** configured bot
reviewers (up to 10 min each; if a reviewer is absent, note the absence explicitly — absence
is NOT "no comments"). Every comment gets a disposition in the Phase 5 report:
IMPLEMENT · ALREADY-RESOLVED · OBSOLETE · DISAGREE (one-line technical rationale; recorded
doctrine and dispatcher rulings outrank any bot) · OUT-OF-SCOPE (banked as an FU, never
silently implemented). The disposition table is a mandatory report section; a PR is not
pre-review-ready without it.

- **Bot-author logins carry NO `[bot]` suffix in the API.** Gemini = `"gemini-code-assist"`, CodeRabbit = `"coderabbitai"`. Filtering on the UI display name silently matches nothing.
- Gemini: `gh pr view <pr> --json reviews` → `.author.login == "gemini-code-assist"`. *Sunsets 2026-07-17.* **On money/rules PRs, trigger the on-demand `/gemini review` PR comment** — the auto-batch review is materially weaker.
- CodeRabbit: posts **both** a review and a summary comment; poll `--json reviews` and `--json comments`. The reviews channel carries the substance. Activates automatically on PR open.
- **Pre-merge final poll.** Before any squash-merge, check for reviewer activity posted AFTER the last disposition table and disposition it BEFORE clicking merge. A stale disposition table does not satisfy the gate.
- **Post-merge backstop.** A pre-merge "absent" is provisional per reviewer. `/post-merge` re-polls for BOTH; late comments are dispositioned under the same taxonomy (IMPLEMENT → banked as a follow-up PR or FU, since no in-PR fix is possible).

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

Helpers that reduce per-PR copy-paste between dispatcher (Claude chat), operator (Kyron)
and Claude Code. The rules govern; the tooling embeds them.

- `scripts/dispatcher/new-brief.ps1` — one-command brief docs PR shuffle (Rule 10).
- `/dispatch <brief-path>` — defined in `.claude/commands/dispatch.md`.
- `/post-merge <pr-number>` — defined in `.claude/commands/post-merge.md`.

Usage, branch/commit naming conventions and troubleshooting: `docs/agents/dispatcher-tooling.md`.

**When NOT to use the tooling:**
- **Audit-only dispatches** stay inline — no brief commit PR, no slash command. Not subject to Rule 10.
- **Decision points** — scope judgment, smoke waiver evaluation, hard-stop recovery — are handled by the dispatcher in chat. Tooling embeds methodology, not judgment.
- **Verbatim `git log` paste-back (Rule 16)** — the operator pastes raw output to the dispatcher. Slash commands report verification; the operator-side paste-back remains manual.

- **CC model tier per brief.** Every brief carries a suggested tier — operator overrides at will: **Tier-A** mechanical / test / docs → Haiku or Sonnet; **Tier-B** feature-from-brief (standard build) → Sonnet; **Tier-C** net-new / cross-cutting / ambiguous surface → Opus (via `opusplan` profile).

- **Persona-review section in net-new/complex briefs.** Briefs for new collections, auth surfaces, or cross-cutting changes include a persona-review checklist before the Decisions-locked section. Standard lenses: tenant-isolation/data-integrity · role/permissions · money-correctness · operator-legibility · a11y/contrast · pilot-ops/reversibility · maintainability.

---

## Banked patterns

**Smoke standard.** Walks MUST include a real write-read-verify cycle — selector-only checks
miss permission/rules/index bugs; every category does at least one real Firestore write
through the rule layer. **Smoke is CC's default, not Kyron's manual check:** CC runs the
production smoke autonomously for every PR via `setupBypassSession` from
`scripts/verification/lib/walk-helpers.mjs`. The default is RUN. A waiver is acceptable only
when changes are clearly outside any user-visible behavior path, must be justified explicitly
by the brief author, and **absence of a waiver = CC runs the walk.** Even
rendering/a11y/timing changes get a smoke walk. Helper APIs, locator patterns, mobile-viewport
handling, the static-CSS waiver carve-out and the seed-path options below:
`docs/agents/smoke-playbook.md`. **When a smoke step needs data the preview env has no seed
for, that step MUST skip-not-fail with an explicit note in output** - a missing-data step must
never read as a pass.

Standing per-surface regression smokes are catalogued in `scripts/verification/SMOKES.md`
(descriptive, not CI-enforced).

**Before any recursive delete of a worktree, verify no junction or symlink to shared state remains inside it — and treat a failed unlink as a HARD STOP, not a warning to proceed past.** Worktrees are routinely given a `node_modules` junction (`mklink /J`) pointing at the main worktree's real `node_modules`, because installing per-worktree is expensive. A recursive delete that follows that link destroys the SHARED tree, and the failure is silent and unrecoverable — nothing errors, the next build just cannot resolve anything.

Sequence: `cmd //c rmdir "<worktree>\node_modules"` (unlinks a junction without touching the target) → **confirm the path is gone** → only then `git worktree remove`. On Windows `rmdir` can fail on a junction with *"The directory is not empty"*; that is the HARD STOP, not a nuisance — resolve it before any recursive delete runs.

This is the same family as the `slice(indexOf(a), indexOf(b))` rule: a destructive operation whose failure mode produces no error. Banked from P0-B / PR #884 cleanup, where `rmdir` failed exactly this way and `git worktree remove` then ran with the junction still in place. The shared `node_modules` happened to survive — but that was established by checking afterwards, which is luck, not method.

**A burn tree is FROZEN for the duration of the burn. Any checkout, rebase, stash-pop, or branch switch inside it invalidates EVERY iteration of that burn — not just the ones after the switch.** A "burn" is any repeated-measurement run: an N-iteration flake hunt, a timing series, a before/after benchmark, a bisect harness. The tree it runs in must not change under it.

**The freeze covers EVERY input the runner re-reads per iteration, not only checkouts.** `npx vitest run` re-reads the config, every setup file, every test file and every source module in the import graph on *each* iteration. So the burn is invalidated identically by editing a **setup file** or a **vitest config** (e.g. `scripts/flake/instrument-keydown-setup.js`, `scripts/flake/vitest.instrumented.config.js`) as by moving HEAD. A config edit loses 200 iterations exactly as a checkout does and is **harder** to notice afterwards, because `git status` shows a modified file rather than a moved HEAD. Practical rule: **while a burn is running, edit only documentation.** If an instrument change is needed, let the burn finish or kill it — never edit under it, and never reason that "the change is small". Banked 2026-08-11 (flake Phase 0, PR #898), where the `AgentPlannerPanel` probe was written but deliberately held unapplied until the `MeetingMode` burn completed, precisely to avoid pooling two instrument versions into one rate.

The invalidation is total, and that is the part worth internalising: you cannot keep the iterations that ran before the switch. At the moment you discover the tree moved, you no longer know **which** iterations saw which tree — a burn does not stamp each iteration with the SHA it measured, so there is no boundary to cut at. Salvaging "the first N" requires knowing N, and the whole problem is that you don't. Discard the run and start again from a frozen tree.

If a burn must measure two refs, use **two separate worktrees** and run them as two burns. Never move one tree between them.

Banked from PR #543's invalidated first attempt: a ~200-iteration burn had a different ref checked out mid-run, silently measured the unfixed file for part of it, and **all 200 results were discarded**. Nothing errored — the burn completed and reported a clean-looking number, which is exactly why this needs to be a rule rather than a habit. Same family as the junction rule above and the `slice(indexOf(...))` rule: the failure mode produces no error, only a plausible wrong answer.

**Any text passed to a shell inside double quotes is EVALUATED, not quoted.** Backticks, `$(...)` and `$VAR` all execute or expand. **This is not a secrets rule** — the existing § `.env.local` bullet frames it that way, but it applies to *every* string this workflow routes through a shell: commit messages, PR bodies, FOLLOW_UPS entries, ruling text pasted from chat.

Much of that text is prose written by a model, and it routinely contains backticks around command names — which is precisely the dangerous case. In P0-E's bank, a commit message containing a backticked `gh run rerun --failed` caused bash to **actually execute it**. It errored harmlessly for want of a run-id. It might not have.

**Use single quotes, or a quoted heredoc (`<<'EOF'`), for any text you did not author character by character.** And **verify the committed message after writing it** — the file content and the commit message can diverge silently, which is exactly what happened: `docs/FOLLOW_UPS.md` was correct while the message read *"any  inflates run_attempt"* with the backticked command eaten. Banked from PR #887 / `2591c740`.

## graphify
This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).


## Linked Agent System v3 — binding implementation rules
Source: `design_handoff_agencytrack_v3/CLAUDE.md`, merged 2026-07-29. Scope: all work
on the v3 linked agent system (planner, dialer, lead intake, weekly activity ledger,
policy book, commission reconciliation). Each rule was learned from a real defect
during prototyping; three of them caused wrong business numbers to be shown to a
manager. Where a rule conflicts with an existing repo pattern, do not silently pick —
raise it with the dispatcher.

### Non-negotiables

1. **`ACTIVITY_METADATA` is the only source of truth for activity codes.** Colours,
   classifiers, counters, filters and prep-capability all derive from it. Adding a new
   code must require **zero** edits anywhere else. Every regression in prototyping came
   from a hardcoded list that had a twin.

2. **Derived, never stored.** Verdicts, totals, queue membership, hours splits and
   ledger figures are computed at read time. Never cache a number you can derive.

3. **Monotonicity is a test, not a hope.** For any derived count representing work
   done: `f(state + record) >= f(state)`. This was violated twice, and both times a
   manager-facing screen accused a named agent because of a scoping bug.

4. **One factory per entity.** `newPolicy()` is the only way a policy is created. Same
   pattern for any entity with derived fields.

5. **Evidenced and declared are never blended.** Separate columns, provenance stated in
   the UI, percentage evidenced always visible. Derived figures say what they were
   derived from ("8 in blocks + 2 ad-hoc").

6. **Ink on `--teal` or any semantic fill must be checked in both themes**, including
   `:focus-visible` and `:disabled` states. `--teal` is *brighter* in dark mode. Fix
   the ink (`.dark .thing{color:var(--bg)}`), never the fill. Five defects, one of them
   in a keyboard-only state.

7. **Rows that accumulate children wrap.** `flex-wrap:wrap` + row gap on toolbars from
   day one. Flexible labels get `min-width:0` + ellipsis.

8. **Name the shrink victim.** Times and figures `flex:0 0 auto`; status words shrink
   and abbreviate with a `title`. Never let a time be crushed.

9. **No `-webkit-line-clamp` on a flex child** — it blockifies and dies silently.
   Clamp by height; always pair truncation with `title`.

10. **A sticky header lives inside the grid it heads**, as the first row — never as a
    sibling grid, which drifts against the scrollbar.

11. **Silent fallbacks throw in development.** `LOOKUP[x] || DEFAULT` must log or throw.
    A fallback that renders something plausible is worse than one that renders nothing.

12. **Never `slice(indexOf(a), indexOf(b))` without asserting both are `> -1`.** A
    missing needle returns `-1` and `slice(start, -1)` eats the rest of the file.

### Product rules that look like implementation details but aren't

- **Every consequence is a real object.** Chasing a premium creates a `COLL` block, not
  a `chased: true` flag. There is no tick box that marks a premium saved.
- **A call block is capacity; a call is activity.** Never sum a container with its
  contents. The per-block `max(dials, itemised)` rule is in `03-DATA-MODEL.md`.
- **Coaching is not own production.** `JC`/`ONE`/`RI`/`UM` are development hours.
- **Prep is a property of an appointment**, never an activity with floor credit.
- **Reconcile in both directions** — an unmatched carrier line matters as much as an
  unpaid policy.
- **Copy is design.** Ship the strings verbatim; several of them *are* the feature.

### Review method

Measure, don't look. Query computed style and bounding boxes in both themes before and
after every fix. Several real defects here are invisible in a screenshot of the default
state. State the root cause in one sentence before editing — if you can't, you don't
have it yet, and tweaking the same numeric property twice means the diagnosis is wrong.

---


---

## Agent skills
Configuration consumed by the `mattpocock-skills` plugin (`/wayfinder`, `/triage`,
`/to-spec`, `/to-tickets`, `/grill-with-docs`, `/code-review`, and siblings).

### Issue tracker

GitHub Issues on `Kelsean868/agencytrack`, via the `gh` CLI. Native sub-issues and
issue dependencies are both enabled. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

The five canonical triage roles, each label string equal to its role name. Distinct
from the green-channel / human-merge merge-authority vocabulary in § Workflow — these
govern implementation authority, not merge authority. See
[`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context. `CONTEXT.md` lives at `docs/CONTEXT.md`, not the repo root. See
[`docs/agents/domain.md`](docs/agents/domain.md).

### Where `/wayfinder` fits

`/wayfinder` charts multi-session planning work as a map issue with decision-ticket children.
It sits **ahead of** the kickoff brief: the map's destination is a landed brief, and Rule 10's
docs-PR gate then runs unchanged. Two deliberate deviations from the skill's defaults:
**briefs are persistent** (Rule 10 makes them a permanent audit trail in `docs/briefs/` — keep
them, never delete on landing), and **`task` tickets never merge or deploy** (Rule 19
unchanged — such a ticket is HITL only). Detail: `docs/agents/dispatcher-tooling.md`.

---

## Router — where the rest lives

Open these on demand. Nothing below is loaded until you read it.

| Topic | File |
|---|---|
| Deploy, preview and post-merge mechanics — Vercel URL fallbacks, `firebase deploy` pre-flight rationale, ambient-credential IAM setup, untracked-doc collision procedure, **doc placement by propagation direction**, **the merge-base scope gate** | `docs/agents/release-and-post-merge.md` |
| Credential handling — echo traps, safe boolean existence check, bypass-session pattern, worktree propagation | `docs/agents/secrets-and-credentials.md` |
| Nexus v2 tokens, gold split, glass reconciliation, design-intent map | `docs/agents/design-system-notes.md` |
| Methodology Rules 1–25 — full text, every incident, PR number and SHA | `docs/agents/methodology-rules.md` |
| Smoke walk mechanics — helper APIs, locator specificity, mobile viewport, waiver carve-outs, **skip-not-fail on preview data gaps** | `docs/agents/smoke-playbook.md` |
| Firestore rules, indexes and query traps — **read before writing rules, indexes or CF array writes** | `docs/agents/firestore-notes.md` |
| Test harness and lint config internals — global Firebase stub, React Compiler rules, **property tests must be mutation-verified**, **`userEvent` vs `fireEvent`** | `docs/agents/test-and-lint-notes.md` |
| Dispatcher scripts, slash commands, `/wayfinder` deviations | `docs/agents/dispatcher-tooling.md` |
| Source tree map (or run `npm run repomix`) | `docs/agents/architecture-map.md` |
| Open follow-ups | `docs/FOLLOW_UPS.md` |
| Dynamic state — active track, recent shipping, where we left off | `docs/CONTEXT.md` |
| Issue tracker / triage labels / domain docs | `docs/agents/issue-tracker.md` · `triage-labels.md` · `domain.md` |
