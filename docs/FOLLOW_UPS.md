# AgencyTrack — Follow-Up Items

Tracked here so they don't get lost between sessions. Items are deliberately scoped small
so each can ship as a standalone PR. Remove an item when its PR merges.

---

## Untracked legacy briefs + verification scripts cleanup (LOW, banked 2026-05-13) [RESOLVED PR #211, dff2847]

**Scope:** `git status` on `main` surfaces 11 untracked files left over
from shipped work. Cleanup deferred during the memory-refresh session.

**Stale kickoff briefs** (all features shipped — archive to
`docs/archive/briefs/`):

- `docs/PR-3-Claude-Code-Brief.md` — user-mgmt PR-3 (#28). Already noted
  in CONTEXT.md Pending Operational across PR #39 + #40; un-actioned since.
- `docs/briefs/e1-slice-2a-kickoff.md` — E1 schema split (#68).
- `docs/briefs/e1-slice-2b-kickoff.md` — E1 schema split (#69/#70).
- `docs/briefs/e4-phase-8-followup-kickoff.md` — E4 follow-up.
- `docs/briefs/e4-production-report-kickoff.md` — E4 (#72).
- `docs/briefs/e5-kiosk-mode-kickoff.md` — E5 (#73).
- `docs/briefs/e6-agent-of-month-kickoff.md` — E6 AOM (#76).
- `docs/briefs/e6-daily-input-kickoff.md` — E6 daily (#71).
- `docs/briefs/pr-d-server-side-email-kickoff.md` — PR-D (#133).

**Verification scripts** (possibly reusable — defer fate to next consumer):

- `scripts/mgr-mobile-audit.cjs` — used by Mobile FU#1 #90 mgr-mobile audit.
- `scripts/verification/pr-d-email-smoke.mjs` — used by PR-D #133 smoke.

**Cleanup approach:**

1. `mkdir -p docs/archive/briefs/` if not present.
2. `git mv` each stale brief into `docs/archive/briefs/`.
3. Surface the two verification scripts for decision: archive, delete, or
   leave as-is for the next manager-mobile / email-smoke iteration.
4. Single docs-only commit: `docs(archive): archive Track-E + PR-D kickoff briefs (shipped)`.

Priority: **LOW**. Not blocking. Bank for the next docs-hygiene session.

**Closure (PR #211, squash `dff2847`):** 9 stale kickoff briefs archived to `docs/archive/briefs/` via filesystem move + `git add` (untracked files; `git mv` requires tracked source). Single docs-only commit per FU body step 4.

**Rule 11 corrected-diagnosis:** FU body banked-time count of "11 untracked files" was stale at resolution. Actual count: 15 untracked files (9 briefs + 6 scripts). Four additional verification scripts joined the untracked pool between 2026-05-13 banking and 2026-05-18 resolution: `border-border-smoke.mjs` (border-border #156), `high6-ytd-smoke.mjs` (HIGH-6 YTD), `mobile-fu2-tap-targets-smoke.mjs` (Mobile FU#2 PR #153), `mobile-fu4-cosmetics-smoke.mjs` (Mobile FU#4 PR #154). All 6 scripts (original 2 + post-banking 4) intentionally left as deferred per FU body's "possibly reusable — defer fate to next consumer" direction. If/when a future PR re-runs any of these smoke scripts (Mobile FU#5, PR-D follow-up, etc.), the consuming PR can decide commit vs delete vs archive at that time.

**Additional Rule 17 capture at execution time:** brief Phase 0 prescribed `git worktree add` for the cleanup, which fails for untracked-file operations — worktrees share the tracked object store but start with an empty working directory, so the 15 untracked files never propagated. Phase 1 hard-stop surfaced this; resolution worked from the main working tree instead. Eleventh Rule 17 in-the-wild signal of the two-day arc. Banks a candidate CLAUDE.md rule: "When PR scope is moving/staging untracked files, work from the main working tree — worktree convention applies only to tracked-file operations."

**Deferred-scripts closure (PR #225, `975b0fc`):** The 6 verification scripts left deferred per the Rule 11 corrected-diagnosis paragraph above are now resolved. 6 TRACK (structural peers of the existing 19 tracked smokes under `scripts/verification/`) + 1 DELETE — `scripts/verification/pr-d-email-smoke.mjs` removed due to forbidden `functions/service-account-key.json` import pattern (banned post-PR #78) + hardcoded production identifiers + production-mutation surface; purpose discharged at PR #133 ship time. The new untracked script `resend-invite-ui-smoke.mjs` (PR #215, merged 2026-05-18) also tracked under the same pattern. 2 polish comments documenting the PREVIEW_HOST env override added to mobile-fu2 + mobile-fu4 smokes. This PR is the "next consumer" decision moment the deferred-scripts direction anticipated.

---

### ✅ Add PREVIEW_HOST env override to 2 verification smokes (LOW, refactor, banked 2026-05-19) — CLOSED 2026-05-19 (PR #TBD, {TBD})

**RESOLVED 2026-05-19**

Banked from PR #225 (`975b0fc`) Phase 2 Edit 3 source-verify catch. Two tracked verification smokes have hardcoded preview URL defaults without env override support, blocking re-runs against future preview branches without code edits:

- [scripts/verification/border-border-smoke.mjs:34-35](scripts/verification/border-border-smoke.mjs:34)
- [scripts/verification/resend-invite-ui-smoke.mjs:43-44](scripts/verification/resend-invite-ui-smoke.mjs:43)

Pattern to apply (matches [mobile-fu2-tap-targets-smoke.mjs:61-62](scripts/verification/mobile-fu2-tap-targets-smoke.mjs:61) and [mobile-fu4-cosmetics-smoke.mjs:73-75](scripts/verification/mobile-fu4-cosmetics-smoke.mjs:73)):

```js
const PREVIEW_HOST = process.env.PREVIEW_HOST ?? '<stale-default-here>';
```

XS scope (2 line changes, 1 file each). Ship as standalone refactor PR when convenient — not blocking any active work since the smokes already discharged their PR purposes.

This is the sixth Rule 17 source-verify catch of the 2026-05-19 dispatcher arc and the first under the newly-banked Rule 17 sub-bullet (PR #223, `d40fa85`). The sub-bullet caught a brief premise gap on the next dispatched PR — exactly what it was designed for.

Banked: PR #225 (`975b0fc`).

**Closure (PR #TBD, {TBD}):** Shipped via PR #TBD ({TBD}). Both files now honor PREVIEW_HOST env override. Existing stale defaults preserved as fallback.

---

## Verify PR #166 shakedown harness fixes via runtime re-run (LOW, deferred 2026-05-15)

**Background:** PR #166 fixed shakedown bugs 001/003/004/006 (cat02 navigator off-by-one, cat04 T4.02 hard assertion, cat08 navigator off-by-one). Phase 3 runtime re-run was attempted on 2026-05-15 but blocked: `agent-001@agencytrack.test` (and all `*@agencytrack.test` test accounts) returned "Incorrect email or password" against production. Test data seeding from PR-F was not active at time of verification. Phase 1 source inspection confirmed fix shape; runtime verification deferred to next seeding cycle.

**Acceptance criteria (from PR #166 brief):**
- `cat02-role-agent.mjs` T2A.03 passes (screen 5 body matches `/summary|review|submit|total/i`)
- `cat04-form-validation.mjs` T4.02 passes (hard fail when wizard advances past invalid date; or correctly blocks)
- `cat04-form-validation.mjs` T4.03 passes (unchanged from baseline)
- `cat08-screenshot-dossier.mjs` T8.ALL captures ≥80 screenshots (was 79 pre-fix)

**To execute:** Seed `*@agencytrack.test` test accounts via PR-F tooling, then run:
```
node scripts/verification/shakedown/cat02-role-agent.mjs
node scripts/verification/shakedown/cat04-form-validation.mjs
node scripts/verification/shakedown/cat08-screenshot-dossier.mjs
```

Priority: **LOW**. No app source affected by PR #166 — this is harness-only verification. Close by removing this item once all four acceptance criteria pass.

---

## Track D — cron portion status verification — RESOLVED in PR #137 (2026-05-13)

**Resolved 2026-05-13 in PR #137** (`bb08cc7`,
`fix(functions): chain .timeZone('UTC') to all 4 scheduled CFs (Track D)`).

Phase 1 Track D investigation surfaced that all 4 scheduled CFs were firing
in `America/Los_Angeles` (Firebase Functions v1 default) instead of UTC.
The cron strings were written for UTC interpretation but no `.timeZone()`
chain was present, causing 3–7 hour drift from intended AST fire times.

Fix: chained `.timeZone('UTC')` to `sendSundayNudge`, `sendMondayNudge`,
`flagMissedDeadlines` in `functions/index.js` and `aggregateDailyToWeeklyCron`
in `functions/aggregators/sundayDailyToWeekly.js`. Pre-merge deploy from
the feature worktree. Post-deploy `gcloud scheduler jobs describe` confirmed
`timeZone: UTC` on all 4 jobs and correct `scheduleTime` UTC instants:

| Function | scheduleTime | AST wall-clock |
|---|---|---|
| sendSundayNudge | 2026-05-17T22:00Z | Sun 18:00 AST ✓ |
| sendMondayNudge | 2026-05-18T11:00Z | Mon 07:00 AST ✓ |
| flagMissedDeadlines | 2026-05-18T13:01Z | Mon 09:01 AST ✓ |
| aggregateDailyToWeekly | 2026-05-18T03:00Z | Sun 23:00 AST ✓ |

SEC-9c (hardcoded `TENANT_ID = 'tatillife_south'` on scheduled functions)
remains open — separate ticket, deferred post-pilot.

---

## RESOLVED 2026-05-11 — Service-account-key cleanup (Cloud Functions)

E5 (kiosk) shipped with `functions/service-account-key.json` loaded via
`admin.credential.cert(...)` because the App Engine default SA lacked
`iam.serviceAccounts.signBlob` — `createCustomToken` would fail otherwise.
Cleanup blocked on local `gcloud` install. Resolved in `chore/security-remove-sa-key`:

1. Granted `roles/iam.serviceAccountTokenCreator` on
   `agencytrack-2a610@appspot.gserviceaccount.com` with the SA itself as
   member (self-impersonation).
2. Replaced the cert load in `functions/index.js` with plain `admin.initializeApp()`.
3. Redeployed `validateKioskToken`, `createKioskToken`, `revokeKioskToken`,
   `setAgentOfMonth`, `getAgentOfMonthCandidates`. Production kiosk smoke-test
   confirmed `signBlob` now works under ambient credentials.
4. Key file remains gitignored (`.gitignore:24-26`); was never committed
   and is not present in any feature worktree.

Local `.cjs` admin scripts in `functions/scripts/` (`seed-first-tenant-admin`,
`seed-platform-admin`, `migrate-*`, `restore-super-admin-claim`) and
`functions/set-agent-password.cjs` still `require('./service-account-key.json')`
directly. They run on Kelsean's workstation only, never in CI/CF, so the
local key file in the main worktree stays for now. Future cleanup: refactor
those scripts to ADC + impersonation. Not blocking.

---

## Worktree + branch audit (LOW, banked 2026-05-11; scope grew 2026-05-13)

**Updated 2026-05-13:** scope is larger than the 2026-05-11 banking
suggested. Current state:

- **6 worktrees** in `.claude/worktrees/`, all attached to merged feature
  branches (post-squash, `git branch -v` shows `+` markers indicating the
  branches diverged from main post-merge):
  - `feat+pr-f-bulk-test-data` (PR #135)
  - `feat-polish-2-toast-sweep` (PR #127)
  - `feat-pr-d-server-side-email` (PR #133)
  - `feat-pr4-edit-user-flows` (PR #122)
  - `feat-pr4b-role-branch-edits` (PR #129)
  - `feat-wizard-ux-hardening` (PR #88 + R1 micro-fix #124)
- **~15 stale local branches** without remote tracking refs (most have
  `+` markers indicating squash-merged-but-locally-divergent state). The
  original two orphan branches from the 2026-05-11 audit
  (`chore-context-sync-and-verification-script-lift`,
  `chore/housekeeping-followups`) are still present.

**Cleanup approach** (extends the original audit pattern):
1. For each worktree-attached branch, run `git diff main..<branch> --stat`
   to verify no unmerged content (expected: empty diff for squash-merged
   PRs).
2. If empty diff: `git worktree remove --force <path>` then `git branch -D <branch>`.
3. For the orphan branches without worktrees: same diff check; if equivalent
   work landed under a different SHA via squash, `git branch -D`.
4. Surface any branch with unmerged content for decision (resume?
   abandon? reconcile?).
5. After cleanup, `git fetch origin --prune` to clear any stale remote
   tracking refs.

~45–60 min focused session now (was ~30–45 min before scope grew).

Audit approach (bank for whoever picks this up):
1. For each worktree-attached branch, run
   `git diff main..<branch> --stat` to see if there's unmerged content.
2. For each, check if the equivalent feature was merged under a
   different name (cross-reference against `gh pr list --state merged
   --search "<keyword>"`).
3. If equivalent work is on main: `git worktree remove --force <path>`
   then `git branch -D <branch>`.
4. If unmerged work exists: surface for decision (resume? abandon?
   reconcile?).
5. For the two orphan branches without worktrees: same diff check,
   same decision tree.

---

## PILOT-BLOCKING — Shakedown findings (surfaced 2026-05-13, must fix before Tatil demo)

Two app bugs confirmed by the pre-pilot shakedown run. Full report: [`docs/shakedown-findings-2026-05-13.md`](shakedown-findings-2026-05-13.md).

### SHAKEDOWN-001 — Manager/UM see Agent Dashboard on first login — RESOLVED in PR #141

**Resolved in PR #141** (`162b8de`, `fix(auth): manager role resolution on first login (SHAKEDOWN-001)`).

**Root cause:** `AuthContext.jsx` early-exited when `claimTenantId` was null, blocking the Firestore doc fallback. On fresh accounts where `setCustomUserClaims()` hasn't yet propagated (60–120s delay), claims were empty, so `role` resolved to null and `App.jsx` fell through to `AgentDashboard`.

**Fix shape D:** Made the Firestore user doc the load-bearing fallback. Parallel fetch via `Promise.all([getIdTokenResult(true), getDoc(...)])` using a localStorage-cached tenantId. `resolvedRole = claims.role ?? doc.role ?? null`. `ProvisioningScreen` added to `App.jsx` for the true-null case (no claims AND no doc). Post-merge manual smoke: Kyron creates fresh BM via UserManagementPanel, signs in, confirms BM dashboard renders within seconds.

### SHAKEDOWN-002 — Unit Manager sees cross-unit agents — FULLY RESOLVED in PR #142 + PR #144

**User list scoping resolved in PR #142** (`1a7526c`, `fix(services): enforce UM unit scoping on user list (SHAKEDOWN-002)`).

**Submission scoping + aria-label resolved in PR #144** (`1db8a67`, `fix(services): enforce UM unit scoping on submissions + Master Sheet aria-label (SHAKEDOWN-002B)`).

**Root cause (confirmed across both PRs):** PR #142's Phase 1 audit scoped to user-list queries only. Three separate unscoped paths leaked cross-unit data to the UM:
1. `managerService.getTenantUsers` — Master Sheet name map. **Fixed in PR #142.**
2. `agentManagementService.getAllUsers` — Team tab agent list. **Fixed in PR #142.**
3. `managerService.getWeeklySubmissions` — Master Sheet row data. **Fixed in PR #144.**
4. `managerService.getAllYTDSubmissions` — Production Report + Manager Dashboard YTD data. **Fixed in PR #144.**

**Fix shape (submissions, PR #144):** Submissions don't carry `unitId`, so the `where('unitId','==',callerUid)` pattern from #142 couldn't be applied directly. Instead: service reads `auth.currentUser.getIdTokenResult()`, UM path fetches agent UIDs via `where('unitId','==',callerUid)` on users collection, then applies `where('agentId','in',agentUids)` on the submissions query. `getAllYTDSubmissions` UM path filters status client-side to avoid a 3-field compound index requirement. Firestore rules split submissions `allow read` into `allow get` (UM restricted via cross-doc unitId lookup) + `allow list` (partial defense-in-depth; list relies on client filter due to Firestore limitation). 10 new test cases.

**Post-merge manual smoke:** Sign in as UM, confirm Team tab + Master Sheet rows + Production Report show only own unit's agents. Sign in as BM, confirm full branch visibility preserved. Verify `aria-label="Select week"` on week picker via devtools.

---

## Bug 005 — Master Sheet week picker `select-name` CRITICAL a11y — RESOLVED in PR #144 (2026-05-14)

**Resolved 2026-05-14 in PR #144** (`1db8a67`, `fix(services): enforce UM unit scoping on submissions + Master Sheet aria-label (SHAKEDOWN-002B)`).

**Root cause:** `MasterSheet.jsx` week picker `<select>` had no accessible name — no `<label>`, `aria-label`, or `aria-labelledby`. Axe rule `select-name`. Surfaced as a CRITICAL violation in the 2026-05-14 shakedown's cat07-a11y run (T7.11), first run where cat07 reached the Master Sheet after the infrastructure errors in runs 1+2 were resolved.

**Fix:** `aria-label="Select week"` added directly to the `<select>` element at `MasterSheet.jsx:207`. XS effort — one token addition.

---

## ~~Shakedown harness — LOW opportunistic follow-ups (banked 2026-05-14)~~ (ALL RESOLVED — PR #165)

### ~~Bug 001 — Wizard screen 5 selector fragility~~ (RESOLVED — PR #165)

**Source:** Shakedown run 3 T2A.03 `cat02-role-agent`.

**Resolution:** Fixed via off-by-one navigator correction in `cat02-role-agent.mjs` T2A.03 — added pre-loop click to advance past date pre-screen before the 5-iteration loop. **Original FU hypothesis ("regex adjustment only") was incorrect**; the regex `/summary|review|submit|total/i` was fine all along. The loop entry state was wrong: T2A.02 left the wizard on the date pre-screen, so the 5-iteration loop traversed date→step1→step2→step3→step4, leaving the body check on step 4 (no "review" text). With the pre-loop click, the loop correctly traverses step1→step2→step3→step4→step5, where the "Review" button label matches the existing regex. Verified via Phase 1 code inspection (`WizardForm.jsx` line 326: `nextLabel = step === TOTAL_SCREENS ? 'Review' : 'Next'`).

### ~~Bugs 003/004 — Form validation tests~~ (RESOLVED — PR #165)

**Bug 003 (T4.02) — RESOLVED:** Fixed via navigation-blocking assertion in `cat04-form-validation.mjs` T4.02 — replaced the wrong-keyword body-text WARN (`/sunday|invalid.*date|must be sunday/i`, text that never appears because validation is silent) with a hard assertion that the wizard did NOT advance past the date input after a Next-click on an invalid (non-Sunday) date. Soft `_log('WARN...')` replaced with `throw new Error(...)` on navigation success; assertion now catches real behavior.

**Bug 004 (T4.03) — RESOLVED (stale/direct closure):** STALE. Current test already uses the correct `inputValue()` check — fills 'abc', reads back the field value, warns only if 'abc' appears (i.e., filtering didn't happen). This is exactly the "assert absence of invalid input" pattern the original FU called for. No code change required. Verified via audit on 2026-05-15.

### ~~Bug 006 — Screenshot dossier 79/80 captures~~ (RESOLVED — PR #165, auto-closed via Bug 001)

**Source:** Shakedown run 3 T8.ALL `cat08-screenshot-dossier`.

**Resolution:** Cat08's wizard walk (lines 86–100) had the same off-by-one navigator as `cat02` T2A.03 — the 5-iteration loop started immediately after `submitBtn.click()`, with the wizard on the date pre-screen. The loop traversed date→step1→step2→step3→step4, so the step5 screenshot was never taken (79 instead of ≥80). Fixed in the same PR via the matching pre-loop click. Screenshot count now reaches the ≥80 target.

---

## SHAKEDOWN follow-ups — future optimization items (LOW, banked 2026-05-14)

Two architecture improvements banked during SHAKEDOWN-002B Phase 1 ack.

### ~~Cache UM agent UIDs per session~~ (RESOLVED in PR #146)

**Resolved 2026-05-14** — module-scoped `Map<"${tenantId}:${callerUid}", string[]>` in `managerService.js`, populated by a new private `getCallerAgentUids` helper used by both `getWeeklySubmissions` and `getAllYTDSubmissions`. Invalidation via exported `clearAgentUidCache()`, called from `AuthContext` sign-out path (else branch of `onAuthStateChanged`). 6 new cache-coverage tests added (cache miss, cache hit, clear, per-user keying, provisioning filter, cross-function reuse). Existing #144 `beforeEach` hooks each gained one `clearAgentUidCache()` call for test isolation — no assertion or fixture changes.

~~**Scope:** The `unit_manager` path in `getWeeklySubmissions` and `getAllYTDSubmissions` each issue a `getDocs` call to fetch agent UIDs before querying submissions. On the Master Sheet surface, both functions are called in the same `useEffect` (or close together) — 2 round-trips per data load.~~

~~**Future optimization:** cache the UM's agent UID list in session state (e.g. React context or a module-level memo keyed by `[tenantId, callerUid]`) so the agent-lookup read is issued once per session rather than once per submission-fetch. Net: one fewer Firestore read per Master Sheet load and per Production Report load.~~

~~Not urgent — at pilot scale the extra read costs fractions of a cent. Revisit if unit sizes grow or Firestore billing becomes material.~~

### ~~Denormalize `unitId` onto submission docs~~ (RESOLVED in PR #147)

Shipped in PR #147: `unitId` denormalized onto all three submission write paths (`saveDraft`, `submitReport`, `aggregateCurrentWeekDaily`). Service layer simplified to direct `where('unitId', '==', callerUid)` queries. Rules tightened from partial to full defense-in-depth (`allow list` now enforces UM scoping). Agent-uid cache from #146 removed (Path A). Backfill script at `scripts/backfill/denormalize-submission-unitId.mjs`.

### Delete tenant_admin historical test submissions (LOW, backfill cleanup)

5 test submissions exist in `tenants/tatillife_south/submissions/` for uid `4GeeZbhZBwdtGOLoJoggf4MQo142` (Kyron Marchan, tenant_admin — formerly super_admin). These are artifacts of early testing with Kyron's own account. Tenant admins don't submit weekly reports in real usage. Cleanup can be done via a one-time delete script when next touching `scripts/backfill/`.

### Delete branch_manager historical test submissions (LOW, backfill cleanup)

4 test submissions exist in `tenants/tatillife_south/submissions/` for uid `x8Zfg2TI1yf8JOljqxCsJszxnx93` (Test Branch Manager, branch_manager). These are artifacts of testing BM role flows. BMs don't submit weekly reports in real usage. Cleanup can be done via a one-time delete script when next touching `scripts/backfill/`.

---

## HIGH-priority — sales_manager onboarding regressions (surfaced 2026-05-07)

Three production-affecting bugs discovered while provisioning the missing test
accounts for B4's all-roles preview matrix. All three are likely regressions from
the May 5 roles refactor and should land before the Tatil pilot demo.

### HIGH#1 — User-creation flow does not send password reset email — RESOLVED in PR #57 (2026-05-08)

**Resolved 2026-05-08 in PR #57.** Root cause confirmed: the `createUser`
Cloud Function called `admin.auth().generatePasswordResetLink(email, ...)`,
which only returns a link string and does **not** dispatch any email. The
Admin SDK has no equivalent of `sendPasswordResetEmail`, and no email
transport (nodemailer, SendGrid, Firebase Trigger Email Extension) was
wired up — so the link was generated and discarded. The companion
`functions/index.js:398` Sunday-nudge stub revealed the same gap in a
different code path.

**Fix shape:** dispatch the password-reset email client-side from
`src/services/agentManagementService.js` using `sendPasswordResetEmail`
from the Auth SDK — the same primitive the user-initiated forgot-password
flow already uses, which hits Firebase's hosted email-template service.
Server-side `generatePasswordResetLink` deleted. Return shape extended to
`{ success, uid, emailSent, emailError? }` so the caller distinguishes
"fully provisioned" from "provisioned but email failed" and offers Retry.

**UI:** `UserManagementPanel.jsx` toast refactored to typed object
(`{ kind: 'success' | 'warning', ... }`) with a dedicated warning state
that shows a Retry button when the email dispatch fails post-creation.

**Server-side hardening tracked separately as HIGH#5 below** (Trigger
Email Extension or transport) — closes the same gap for the Sunday-nudge
stub and removes the client-side dependency for create-user delivery.

**Test-infra restoration tracked as Test Infrastructure (MEDIUM)** below —
Vitest install + the regression spec described during the original HIGH#1
triage was deferred so the P0 fix could ship without expanding scope.

---

**Original triage notes (kept for reference):**

**Reproducer:** Tenant Admin → Team tab → Add User → fill the form → Save. The
Firebase Auth user is created (and the Firestore doc is written), but no
"Set your password" email is dispatched to the new user. The created user has
no way to set their initial password without intervention.

**Workaround that was in use:** Firebase Console → Authentication → click the
new user → three-dot menu → "Reset password" — this dispatched the email
manually.

Priority was **HIGH** (pilot-blocking — Tatil cannot onboard managers/agents at
scale without this). Surfaced during B4 provisioning.

### HIGH#2 — UI role-to-label map is missing `sales_manager` → "Unknown" displayed — RESOLVED in PR #55 (2026-05-08)

**Resolved 2026-05-08 in PR #55** (commit `7264cc2`, shipped as part of the
B5 tenant-admin company-config surface). Single-line addition to
`src/utils/formatters.js:13` — `sales_manager: 'Sales Manager'` now lives
in `ROLE_LABELS` and `getRoleLabel('sales_manager')` returns the correct
label across TopBar, User Roster, and any other consumer.

---

**Original triage notes (kept for reference):**

**Symptoms:** When logged in as a `sales_manager`, the dashboard header role
label and the User Roster (Tenant Admin → Team tab) both display "Unknown"
instead of "Sales Manager." Underlying Firestore data is correct
(`role: "sales_manager"` is stored properly). This is purely a UI lookup-table
gap.

**Verified site:** [`src/utils/formatters.js:8-16`](../src/utils/formatters.js).
The `ROLE_LABELS` dict maps `tenant_admin` / `platform_admin` /
`branch_manager` / `unit_manager` / `agent` — and **omits** `sales_manager`.
`getRoleLabel(role)` falls through to the `?? 'Unknown'` default for that
one role. Fix is a single-line addition:

```js
export const ROLE_LABELS = {
  tenant_admin:   'Tenant Admin',
  platform_admin: 'Platform Admin',
  branch_manager: 'Branch Manager',
  unit_manager:   'Unit Manager',
  sales_manager:  'Sales Manager',  // ← add this line
  agent:          'Agent',
};
```

**Scope verified narrow (per HIGH#3 verification — see below).** Only
`sales_manager` is missing from the map; no companion "audit other unhandled
roles" sub-task is needed.

Priority: **HIGH** (visible in TopBar to every sales_manager session).
Surfaced during B4 provisioning. Single-line fix; safe to ship as a
standalone micro-PR before the pilot demo.

### HIGH#3 — Verify whether the role-label map gap also affects `tenant_admin` and `platform_admin` — RESOLVED, scope narrow

**Verified during B4 production walkthrough (5 roles × commit `412a681`,
2026-05-08, `agencytrack.vercel.app`).** All five roles' TopBar role-label
crumbs were inspected via the captured `verification/walk/design-v2-b4_production_<role>_dashboard-light_*.png`
screenshots:

| Role            | TopBar role-label crumb | Status |
|-----------------|-------------------------|--------|
| `agent`         | (n/a — agent's crumb shows the week date, not the role label; sidebar foot would render `Agent` from the same map) | ✅ mapped |
| `unit_manager`  | "Unit Manager"          | ✅ correct |
| `branch_manager`| "Branch Manager"        | ✅ correct |
| `sales_manager` | "Unknown"               | ❌ HIGH#2 |
| `tenant_admin`  | "Tenant Admin"          | ✅ correct |

`platform_admin` was not exercised (no test account in the pilot tenant —
Kyron is the only platform_admin, his account holds the production claim).
The `ROLE_LABELS` source confirms `platform_admin: 'Platform Admin'` is
mapped, so it would render correctly when surfaced.

**Outcome: scope confirmed narrow to `sales_manager` only.** HIGH#2 fix
remains a single-line addition to `ROLE_LABELS`. This item closes; no
companion follow-up needed.

> **Anomaly observed (does not change HIGH#2's scope):** the agent
> production walkthrough screenshot shows the sidebar-foot role label as
> "Unknown" while the agent role IS in the `ROLE_LABELS` map. Likely a
> transient render where `useAuth().role` is briefly undefined before
> custom claims hydrate, so `getRoleLabel(undefined)` falls through to the
> default. Worth a separate small investigation if it persists post-pilot
> (e.g. add a render-gate on `userProfile?.role` before the sidebar foot
> renders, or change the default to a more graceful empty-string). Not
> tracked as a new HIGH item — file separately if it reproduces consistently.

---

## HIGH#4 — Programmatic walkthroughs miss state-persistence interactions (surfaced 2026-05-08)

**What surfaced:** the post-B4 P0 sidebar-collapse bug (PR #56) — collapse
toggle and sign-out both `display: none` in the collapsed state, with the
collapsed state itself persisted via `localStorage.agencytrack-sidebar-collapsed`.
B4's full preview matrix (5 roles × 4 breakpoints × 2 themes = 40 cells)
plus the agent walkthrough plus the post-merge production walkthrough all
PASSED — yet the bug was a one-click reproducer.

**Why every existing check missed it:** every walkthrough exercised
*default state only* — `localStorage` empty, `html.sidebar-collapsed` not
set, sidebar always expanded at desktop. The bug lives behind a state
transition that no automated check ever performed.

**Class of bugs this misses:** any UI failure mode that hides only after a
toggleable persistent state is set — collapsed sidebar, dark mode (the
toggle is a different actor; once persisted across reloads, no one had
verified the toggled-state surfaces don't break in unexpected ways), any
future `localStorage.agencytrack-*` flag, future tenant-admin "advanced"
toggles in Track C. Anything reachable only via interaction.

**Lesson and remediation:**
- The verification template for future Track C/D PRs should include a
  *persisted-state cycle* step: set the state, reload the page, verify
  the persisted state behaves correctly (interactive controls reachable,
  no contrast regressions, focus order intact).
- The fix for this bug already lands a sidebar-22a/b/c regression block
  in `scripts/exploration-walk.cjs`. That pattern (cycle + assertions)
  generalises — adopt it for any new persisted UI state.
- Consider extending `exploration-walk.cjs` with a `--persisted-state`
  flag that runs the regular walk twice: once with empty localStorage,
  once with a baseline of `agencytrack-dark=1` and
  `agencytrack-sidebar-collapsed=1` pre-seeded. Same role, two passes,
  surfaces this whole class.

Priority: **HIGH** (a P0 of this exact shape escaped a multi-PR-batch
verification gate; the next one is unbounded). Not pilot-blocking — PR
#56 closes the sidebar-specific instance — but the prevention step
(walkthrough template change) lands before the next big surface PR.

---

## HIGH#5 — Server-side email infrastructure — RESOLVED in PR #133 (2026-05-13)

**Resolved 2026-05-13 in PR #133** (`5ca6ea6`,
`feat(email): PR-D — server-side email infrastructure (HIGH#5)`). Shipped:

- Firebase Trigger Email Extension installed (`8f030d0 chore(extensions): install firestore-send-email + gitignore extension config`).
- `mail/` collection rules locked to Cloud Function writes only (`0cb6cfc feat(firestore): PR-D — lock mail/ collection to CF writes only`).
- Email templates + render helper (`3be983b feat(email): PR-D — email templates and render helper`).
- `doCreateUser` saga writes `mail/` doc post-claims-commit (`c23e624 feat(functions): PR-D — server-side email via Trigger Email Extension`). Companion Sunday-nudge stub replaced with `mail/` writes per missing agent.
- Client-side `sendPasswordResetEmail` removed from `agentManagementService.createUser` (`f167708 refactor(email): PR-D — remove all client-side email dispatch`). Return shape collapsed back to `{ success, uid }` once dispatch was reliably server-side.
- Troubleshooting runbook at `docs/runbooks/pr-d-email-troubleshooting.md` (`fb2a0be docs(runbooks): PR-D — email troubleshooting runbook`).

**R1 (domain authorization gap) surfaced and was resolved same day.** Pre-PR-D
mail dispatches sat in `mail/` with `error: "Email did not validate"` until
`sendgrid.net` / the configured sender domain were authorized. Documented
in the runbook; pilot tenant authorized before PR-F.

**Open follow-up tracked separately:** `doCreateUser` step E-2 `emailQueued`
truthfulness gap (PR #134 banking) — see entry below.

---

**Original triage notes (kept for reference):**

**Scope:** Wire up a single piece of server-side email infrastructure that
covers BOTH outstanding email gaps in the codebase:

1. **Create-user reset-email fallback.** HIGH#1 fix dispatches the
   password-reset email from the client (`agentManagementService.createUser`
   → `sendPasswordResetEmail`). That works, but it depends on the
   tenant-admin's browser staying online through the dispatch. A flaky
   network at the moment of submission means the auth user exists but no
   email lands; the UI's Retry button is the human-in-the-loop fallback.
   Server-side dispatch is more reliable.
2. **Sunday-nudge reminder email** (`functions/index.js:398-399`). Stub
   left by the original author — `// Email stub — wire up nodemailer or
   Firebase Extension here when ready` — currently the nudge writes only
   an in-app notification, no email goes out.

**Recommended approach:** install the **Firebase "Trigger Email" Extension**
(watches a `mail/{docId}` collection in Firestore; renders templates and
dispatches via Firebase's SMTP). One install + template config covers both
flows by writing a `mail/...` doc from each call site:

- `functions/index.js` — replace HIGH#1 fix's client-side dispatch with a
  `mail/` doc write inside the `createUser` saga (after auth user + claims
  + Firestore doc are committed). Once verified, remove
  `sendPasswordResetEmail` from `agentManagementService.createUser` and
  swap the UI toast back to a single success state.
- `functions/index.js:398-399` — replace the stub comment with a `mail/`
  doc write per missing-agent in the Sunday-nudge `Promise.all`.

**Alternatives considered:** nodemailer + SMTP creds (adds dependency +
secret rotation surface), SendGrid/Resend SDKs (adds vendor + API key).
The Firebase Extension has the lightest operational footprint for a single-
tenant SaaS at this scale.

**Acceptance:**
- `mail/` collection has Firestore rules locked to function writes only.
- Templates exist for both flows (reset, nudge) with light/dark-aware HTML
  + plain-text fallback.
- `agentManagementService.createUser` returns `{ success, uid }` again
  (no `emailSent` field needed once dispatch is server-side and reliable).
- `UserManagementPanel.jsx` toast collapses back to a single success state.
- Sunday-nudge logs include both in-app-notif count and email-dispatch count.

Priority: **HIGH** (post-pilot if pilot succeeds; pre-pilot if Sunday-nudge
adoption matters). Closes two gaps with one install. Do not bundle with
HIGH#2 or any other open HIGH item — separate PR.

---

## HIGH#7 — `aria-hidden="true"` on modal backdrop wrappers hides dialog from a11y tree — RESOLVED in PR #63 (2026-05-08)

**Resolved 2026-05-08 in PR #63** (commit `2932cfa`,
`fix(a11y): remove aria-hidden from modal backdrop wrappers`). Single-token
deletion at each site; `aria-modal="true"` on the inner `role="dialog"`
correctly carries modal semantics on its own.

---

**Original triage notes (kept for reference):**

**Scope:** Two bulk-import modals have `aria-hidden="true"` on their outermost backdrop `<div>`:

- `src/components/admin/BulkImportUsersModal.jsx:288`
- `src/components/admin/BulkImportGoalsModal.jsx:295`

The outer backdrop being `aria-hidden` hides the entire subtree — including the inner `role="dialog" aria-modal="true"` — from the accessibility tree. Screen reader users cannot navigate into or interact with the dialog at all. The `aria-hidden` attribute was copied from an earlier pattern and is incorrect here; `aria-modal="true"` on the inner dialog is the correct way to communicate modal semantics.

**Fix:** Delete the `aria-hidden="true"` token from both lines — a single-token deletion at each site. No structural changes needed; `aria-modal="true"` on the inner `role="dialog"` already handles the semantics correctly.

**Confirmed by:** extended C3 verification (2026-05-08) — `getByRole('dialog')` returned nothing on the default a11y traversal; only a CSS-selector fallback (`[role="dialog"][aria-labelledby="..."]`) could reach the dialog. Verified in both `BulkImportUsersModal.jsx:288` and `BulkImportGoalsModal.jsx:295`.

**Shipped as:** PR #63 — `fix/aria-hidden-modal-wrappers`. Regression script `verification/aria-modal-regression.cjs`: 10/10 assertions pass on preview. Before/after screenshots at `verification/aria-fix-shots/`.

Priority: **HIGH** (pre-pilot — modal is completely inaccessible to screen reader users as-is).

---

## HIGH#6 — TenantAdminDashboard YTD composite index missing — RESOLVED in PR #131 (2026-05-12)

**Resolved 2026-05-12.** Index created manually in Firebase Console per the
prescribed fix below (no code change). Verified live in PR #131 (`a3de48b`,
`chore(firestore): mirror production composite indexes in firestore.indexes.json`):
*"The index was created manually in Firebase Console and is verified live by the
YTD tile rendering correctly in production."* Phase 2 smoke (2026-05-15) confirms:
Total API · YTD tile renders **TTD 25,123**, console free of `failed-precondition`.
FU row closed in PR #160 (`1d4f194`).

---

**Original triage notes (kept for reference):**

**Scope:** `TenantAdminDashboard.jsx` aggregates Total API · YTD via
`getAllYTDSubmissions()` in `src/services/managerService.js`. The query
needs a Firestore composite index that has not been created yet —
production console logs a `failed-precondition` error with an
auto-generated index URL the first time tenant_admin loads the
Dashboard tab. The stat tile renders `—` instead of a value.

Pre-existing from B5 (PR #55), surfaced during C1's preview walkthrough
(PR #60). Not C1's regression — the surface that exposes the query
landed before C1.

**Fix:**
1. Tenant_admin loads `https://agencytrack.vercel.app` in production.
2. Open browser console, copy the auto-generated index URL from the
   `failed-precondition` error.
3. Open the URL in Firebase console; click **Create**.
4. Wait for index to finish building (~2–5 minutes for the current data
   volume).
5. Reload Dashboard; confirm Total API · YTD renders a real value.

No code change required. Acceptance is verified by Dashboard rendering
the YTD value end-to-end.

Priority: **HIGH** (UX gap on tenant_admin's primary surface; near-zero
effort fix). Knock out manually whenever convenient — does not require a
PR.

---

## (unitId, weekStarting) composite index — production deploy status verified — RESOLVED (docs-only, 2026-05-15)

**Resolved 2026-05-15 (docs-only, no source-change PR required).**
- **Outcome:** (a) — index deployed and matches repo entry.
- **Production verification:** Firebase Console → Firestore Database → Indexes → Composite.
  Index on submissions: `unitId ASC + weekStarting ASC`. Index ID `CICAgJj7z4EK`.
  Status: **Enabled**. Verified by Kelsean via Console on 2026-05-15.
- **Audit note (FU text correction):** original FU body was imprecise. It claimed both
  `getWeeklySubmissions` and `getAllYTDSubmissions` "use unitId + range on weekStarting
  for the UM path." Correction: only `getAllYTDSubmissions` uses a range filter on
  `weekStarting`. `getWeeklySubmissions` uses equality on both `unitId` and `weekStarting`,
  which Firestore serves via single-field auto-indexes without requiring this
  composite. The composite would serve `getWeeklySubmissions` but its absence would
  not produce a `failed-precondition` error.

---

**Original triage notes (kept for reference):**

**Scope:** `firestore.indexes.json:59-72` (PR #147, commit `5434afe`,
2026-05-13) adds a composite index `submissions: unitId ASC + weekStarting ASC`
to support the `unit_manager` path of `getAllYTDSubmissions()` in
`managerService.js`. This index was added to source but there is **no evidence
of a manual production deploy** following PR #147.

If undeployed, the first `unit_manager` who opens the Master Sheet or Production
Report will hit a `failed-precondition` console error on the `getAllYTDSubmissions`
and `getWeeklySubmissions` calls (both use `unitId` + range on `weekStarting` for
the UM path).

**Audit + fix (if needed):**
1. Confirm deploy state: Firebase Console → Firestore → Indexes → verify
   `submissions (unitId ASC, weekStarting ASC)` exists and is **Enabled**.
2. If missing: copy the auto-generated index URL from a live `unit_manager`
   console error (or create manually from Firebase Console). Click **Create**.
   Wait ~2–5 min. Confirm with a UM-credentialed smoke.
3. `firestore.indexes.json` already has the entry — no source change needed;
   this is a production-state-only deploy.

Surfaced adjacent to HIGH#6 during the HIGH#6 closure audit (2026-05-15).
Different surface (unit_manager role), different index — kept as a separate
FU per Rule 9 same-category gate.

Priority: **MEDIUM** (pilot postponed indefinitely, reducing immediate
exposure — but silent `failed-precondition` failure on first UM access is
real once pilot resumes). Does not require a PR.

---

## Migrate EditConfigModal + BranchEditorModal to useFocusTrap (LOW, filed during C2)

**Scope:** C2 introduces `src/hooks/useFocusTrap.js` (extracted per the
SS-2 commitment from C1's audit — third consumer triggers extraction).
C2 consumes the hook in `BulkImportUsersModal.jsx` only; `EditConfigModal.jsx`
(B5) and `BranchEditorModal.jsx` (C1) stay on inline-duplicated focus-trap
scaffolding to keep C2's blast radius narrow.

**Fix:** When EditConfigModal or BranchEditorModal is next touched for any
reason (bug fix, behavior change, etc.), migrate it to consume
`useFocusTrap` in the same PR. Each migration drops ~25 lines of inline
useEffect scaffolding and replaces with a one-line hook call.

Priority: **LOW**. Both modals are battle-tested; opportunistic refactor
only. Do not open a standalone PR — fold into the next PR that has a real
reason to touch the file.

---

## F3 — `BulkImportUsersModal.jsx:244` error-code map missing `internal` — RESOLVED in C3 (alongside-fix)

**Surfaced** during C2 production walkthrough. The error-code → friendly-
message map at `BulkImportUsersModal.jsx:244` handles `unavailable`,
`deadline-exceeded`, and `cancelled`, but not `internal`. Firebase
Functions returns `internal` on aborted / network-failed Callable requests
that don't hit a more-specific error code, so the user sees the raw
error string instead of the friendly "Couldn't reach the server" copy.

**Fix:** add `'internal'` to the same friendly-message branch alongside
`'unavailable'` / `'cancelled'` / `'deadline-exceeded'`. ~3 line change.

**Resolved 2026-05-08 in C3** as an alongside-fix — the new
`BulkImportGoalsModal.jsx` mirrors the same error-code map shape and
includes `'internal'` from the start; the C2 modal got the same line
added.

---

## Permanent test-data cleanup utility (MEDIUM, surfaced 2026-05-08 during C3)

**Scope:** C2's verification used a one-off cleanup script
(`scripts/cleanup-c2-test-users.cjs`, run by Kyron with `--dry-run` →
review → live). C3's verification embeds the same pattern directly in
`verification/c3-goals-shots.cjs` with a built-in batch-id-match guard
(`csvImportBatchId === TEST_BATCH_ID` check before each `deleteDoc`).

The pattern is reusable enough to formalize as a permanent utility:
`scripts/cleanup-test-records.cjs` with `--dry-run`, `--collection=<name>`,
`--batch-id=<uuid>`, and `--email-pattern=<regex>` flags. Defensive
batch-id-match guard always on. Replaces ad-hoc per-PR cleanup scripts
(C2 had its own; C3 embedded; future bulk-import PRs would otherwise
each grow their own).

**Fix shape:** scaffold the script at `scripts/cleanup-test-records.cjs`
modeled on the C3 verification script's cleanup phase. firebase-admin
require path follows the CLAUDE.md tooling note
(`require('../functions/node_modules/firebase-admin')` or run from
`functions/`). Document at the top of the script: NEVER run without
`--dry-run` first; NEVER bypass the batch-id-match guard.

Priority: **MEDIUM**. Only useful when the next bulk-import PR ships;
defer until then. Until then, copy the inline pattern from
`verification/c3-goals-shots.cjs`.

---

## Extract `CsvImportModalShell` (MEDIUM, surfaced 2026-05-08 during C3)

**Scope:** C3 is the second consumer of the four-step bulk-import wizard
pattern (Step indicator → file picker → preview table → progress →
summary). The SS-2 commitment from C1 says wait for the third consumer
before extracting a shared shell. C3 honors that — copies from
`BulkImportUsersModal.jsx` precedent — and files this for the third
consumer threshold.

**Pieces to extract** when the third consumer lands:
- `StepIndicator` component (4-step `<ol aria-label="Import progress">`
  with `aria-current="step"` semantics).
- `StatusPill` component (valid / warning / error pill with Lucide
  icon + tokenized colors).
- Four-step state machine wrapper (`step` state + `setStep`).
- `CancelConfirmDialog` mid-flight pattern (`role="alertdialog"` +
  Escape-handling delegated via `escapeDisabled` flag on parent's
  `useFocusTrap`).
- Template-CSV download CTA wiring (`Papa.unparse` + `downloadCSV`).
- Error-CSV download CTA wiring (filtered failures + `Papa.unparse`).

**Likely third consumers:** bulk persistency entry, bulk activity
entry, bulk campaign creation. Until then: copy-from-precedent is
acceptable.

Priority: **MEDIUM**. Only meaningful when the third consumer
materializes.

---

## Goal-doc audit-field naming inconsistency (LOW, surfaced 2026-05-08 during C3)

**Scope:** `unitGoals` and `branchGoals` write `setAt` as the audit
timestamp; the personal-commitment doc (under the same `goals`
collection) writes `updatedAt`. The inconsistency predates C3 — both
patterns ship via the existing `goalsService.js`. C3 deliberately keeps
`updatedAt` for personal commitments to stay consistent with the existing
`setGoals` write (the field that downstream readers — `getGoalHierarchy`,
`CareerPortal` — already consume).

**Fix shape (when undertaken):**
- Pick one canonical name. `updatedAt` is the more conventional Firestore
  audit field; `setAt` is project-specific.
- Migrate the `unitGoals` and `branchGoals` writers to write both fields
  during a transition window, then drop `setAt` after readers are
  migrated.
- Or: live with the inconsistency — neither field name is wrong, they
  just differ.

Priority: **LOW**. Cosmetic. No reader is broken; the inconsistency is
historical.

---

## Test Infrastructure (MEDIUM, surfaced 2026-05-08 during HIGH#1 fix) — FULLY RESOLVED in PR #138 (2026-05-13)

**Fully resolved 2026-05-13 in PR #138** (`261b9ec`,
`test(infra): close test infra MEDIUM — agentManagementService specs + CI test step`).

All outstanding pieces shipped:

- `src/services/__tests__/agentManagementService.test.js` — 5 regression tests covering the wrapper layer:
  1. Happy path — CF returns `{ uid, emailQueued: true }`; wrapper returns unchanged.
  2. Email-dispatch failure — CF returns `{ uid, emailQueued: false, emailError }` (PR #136 guard); wrapper returns unchanged.
  3. Callable rejection — CF throws; wrapper propagates the error.
  4. Explicit `emailQueued: true` assertion (named-spec coverage).
  5. Explicit `emailQueued: false + typeof emailError === 'string'` assertion (named-spec coverage).
- `.github/workflows/ci.yml` — `npm test -- --run` step added after lint, before build. Test failures now block PRs.
- Suite grows from 48 files / 603 tests → 49 files / 608 tests (verified locally).
- The PR itself is the first CI run with the new test step — serves as self-test.

---

**Original triage notes (kept for reference):**

**Scope:** Install Vitest + add the first regression test, restoring the
unit-test layer that was deferred from the HIGH#1 fix (PR #57) so the P0
could ship without expanding scope. The repo currently has zero unit-test
infrastructure — only emulator scripts (`functions/scripts/test-pr2-emulator.cjs`,
`scripts/test-b5-config-rule.js`, `scripts/test-sec10-rule.js`). CI runs
`lint + build` only.

**Install steps:**
- Add `vitest` to `devDependencies`.
- Add `vitest.config.js` at repo root with jsdom env (or node env if no DOM
  needed for service tests) and path aliases matching Vite config.
- Add `"test": "vitest"` to `package.json` scripts (and `"test:run": "vitest run"`
  for one-shot CI).
- Plumb into `.github/workflows/ci.yml` — add a `test` step running
  `npm run test:run` after `lint` and `build`.
- Place tests in `src/services/__tests__/` (or co-located `.test.js` next
  to source — pick one convention and document in CLAUDE.md).

**First regression spec — `agentManagementService.createUser`:**

Test cases (all mocking the Firebase callable + Auth SDK):

1. **Email-dispatch happy path** — mock `httpsCallable` to return
   `{ data: { success: true, uid: 'u1' } }`; mock `sendPasswordResetEmail`
   to resolve. Assert:
   - `sendPasswordResetEmail` called exactly once with `(auth, 'new@user.com')`.
   - Return value equals `{ success: true, uid: 'u1', emailSent: true, emailError: undefined }`.
2. **Email-dispatch failure path** — mock callable to resolve normally;
   mock `sendPasswordResetEmail` to reject with
   `Error('auth/network-request-failed')`. Assert:
   - `sendPasswordResetEmail` still called exactly once.
   - Return value equals `{ success: true, uid: 'u1', emailSent: false, emailError: 'auth/network-request-failed' }`.
   - No exception thrown to caller (the auth user IS created — throwing
     would mislead the UI).
3. **Callable-rejection path** — mock callable to reject. Assert the
   error propagates (so the inline drawer error keeps working). Email
   dispatch is NOT attempted.

**Why this test specifically:** guards the exact silent-failure mode HIGH#1
masked. If a future refactor removes the `sendPasswordResetEmail` call (or
swaps it for the dead `generatePasswordResetLink` again), test 1 fails
loudly. If a future refactor accidentally throws on email failure, test 2
fails. Cheap to write, high specificity.

Priority: **MEDIUM**. Not pilot-blocking. Cite "surfaced during HIGH#1 fix
(PR #57)" in the install PR description so future readers can trace the
scope decision.

---

## Resend invite UI (MEDIUM, surfaced 2026-05-08 during HIGH#1 fix) [RESOLVED PR #215, 3690bf6]

**Scope:** Add a per-row "Resend invite" button on the user-management
list. When the create-user flow's email dispatch fails (or when an admin
realises a user never got the original email — lost-in-spam case), the
admin currently has no recourse short of recreating the user. The
inline Retry button on the post-create toast (HIGH#1 fix, PR #57) only
covers the immediate post-creation moment; once the toast dismisses, the
fallback is gone.

**Wiring:**
- `UserManagementPanel.jsx` — per-row dropdown / overflow menu next to
  the existing Deactivate button. "Resend invite email" entry visible
  for any active user (or any user without a `lastSignInTimestamp`).
- Handler calls the same primitive (`sendPasswordResetEmail(auth, email)`),
  surfaces success/failure in the existing toast.
- Once HIGH#5 (server-side email) lands, swap to a `mail/` doc write
  triggered through a callable wrapper.

**Edge case:** confirm whether re-sending a reset email invalidates the
previous link. Firebase Auth invalidates each prior reset link when a new
one is generated for the same user — the UI should clarify "Previous
reset email link will stop working." in a confirm dialog.

Priority: **MEDIUM**. Not pilot-blocking. Closes the gap when individual
emails fail. Suggested wiring: same `sendPasswordResetEmail` primitive
short-term; HIGH#5 server-side path post-migration.

**Closure (PR #215, squash `3690bf6`):** Per-row Resend invite button shipped on `UserManagementPanel.jsx` action cell, between Edit and Deactivate. Client-side path via `sendPasswordReset()` from `authService.js` (short-term per FU body); long-term server-side `mail/` doc swap deferred as a separate follow-up below. ConfirmDialog uses banked edge-case copy "Previous reset email link will stop working." Visibility gated on `canAct && !isInactive` (mirrors Edit-row pattern). aria-label="Resend invite email to {u.name ?? u.email ?? 'user'}" applied from the start — pre-empts a future aria-label sweep finding. 3 buttons always on row — kebab/responsive pattern deferred to a future dedicated mobile-manager pass (when MasterSheet, SettlementPanel, and these action rows all need it together). 2 new tests added in `src/components/manager/__tests__/UserManagementPanel.test.jsx` covering visibility gate + confirm-then-send flow with appropriate `waitFor` discipline (avoids CI-race pattern from PR #210).

**Q3 revision banked in Phase 1 surface (Rule 11 corrected-diagnosis preservation):** Original dispatcher Q3 was "yes, audit log entry mirroring `auditAdminEmailUpdates`." Phase 1 source-verification surfaced that no audit service module exists — the only existing pattern is an **inline** `addDoc` in `authService.js:50-58` writing to a **top-level** `auditAdminEmailUpdates` collection in a **self-service shape** (`uid === initiatedByUid`). For a "different actor + different target" resend, a new sibling `auditInviteResends` collection would need a dedicated function, a two-actor document shape, and a Firestore rules entry permitting write from tenant_admin/branch_manager/sales_manager + read from platform_admin. That rules infrastructure work expands MVP scope significantly. **Dispatcher revised Q3 to: audit log DEFERRED** — banked as a separate LOW follow-up below alongside the server-side `mail/` doc consistency swap. Audit log entry is not in this PR. 15th in-the-wild Rule 17 signal of the arc (audit module pattern didn't match brief assumption captured at authoring time).

---

## Resend invite: swap to server-side mail/ doc write (LOW, banked 2026-05-19)

Resend invite shipped MVP (PR #215, squash `3690bf6`) with client-side `sendPasswordReset()` (Firebase Auth default reset template). Long-term consistency with the server-side `mail/` template path that create-user uses (PR-D #133 / PR #136) requires a new Cloud Function `resendInviteEmail(uid)` that writes a `mail/` doc using the same template `createUser` emits. Trade-off: shipped MVP uses Firebase Auth's default reset template; users see different visual styling for resent vs. original invite emails. Defer to a dedicated email-template-consistency PR. Estimated size: M (CF function + callable wrapper + rule update + swap UI handler to call CF instead of `authService.sendPasswordReset`).

Priority: **LOW**. Not pilot-blocking; visual consistency only.

---

## Resend invite: add audit log entry (LOW, banked 2026-05-19)

Resend invite shipped MVP (PR #215, squash `3690bf6`) without audit log entry. Original dispatcher Q3 was "yes, audit log entry mirroring `auditAdminEmailUpdates`" but Phase 1 source-verification surfaced that no audit module exists — the current pattern is an **inline** `addDoc` in `authService.js` writing to a **top-level** `auditAdminEmailUpdates` collection in a self-service shape (`uid === initiatedByUid`). A new `auditInviteResends` sibling collection would need: (a) a dedicated function (inline or new module), (b) a document shape supporting two-actor (actor + target), (c) a Firestore rules entry permitting write from `tenant_admin`/`branch_manager`/`sales_manager` + read from `platform_admin`. The rules work specifically expands MVP scope significantly. Deferred to a future PR that can address the audit pattern architecturally (likely alongside the `mail/` swap above, or as part of a broader audit-infrastructure pass).

Priority: **LOW**. Not pilot-blocking; recovery flow itself works without audit trail. Adds compliance/forensics surface only.

---

## Sunday-nudge actual email send (LOW, surfaced 2026-05-08 during HIGH#1 fix)

**Scope:** When HIGH#5 (server-side email infrastructure) lands, wire the
existing stub at `functions/index.js:398-399`:

```js
// Email stub — wire up nodemailer or Firebase Extension here when ready
// missing.forEach(a => sendReminderEmail(a.email, 'Report Due Tomorrow').catch(console.error));
```

Replace the commented `forEach` with `mail/` collection writes (one per
missing agent) using the template installed under HIGH#5. Surface
dispatch counts in the existing
`console.log('[sendSundayNudge] Notified ${missing.length} agents ...')`
log so ops can verify both in-app + email channels delivered.

**Companion Monday-nudge** (`exports.sendMondayNudge` immediately below)
likely has the same stub structure — apply the same fix there in the
same PR if it does.

Priority: **LOW**. Sunday-nudge currently functions via in-app
notifications; email is additive. Strictly downstream of HIGH#5 — do not
attempt independently.

---

## `doCreateUser` step E-2 silently returns `emailQueued: true` on mail/ write failure — RESOLVED in PR #136 (2026-05-13)

**Resolved 2026-05-13 in PR #136** (`89182cd`,
`fix(functions): doCreateUser emailQueued truthfulness (#134 follow-up)`).
Step E-2 catch now sets `emailQueued = false` and includes an optional
`emailError` string; the return shape is `{ success, uid, emailQueued, emailError? }`.
`bulkImportUsers` propagates `emailQueued` (+ `emailError`) into each row's
result so the Step 4 SummaryStats card "Email failed" can distinguish
"created + email sent" from "created, email never queued".
`UserManagementPanel.jsx` `CreateUserDrawer` now captures the return value and
forwards `emailQueued` into `handleCreated`, which switches to a warning toast:
*"<Role> account created, but the password reset email may not have sent.
Contact support or recreate the user if they don't receive it."*

**Two brief premises corrected during Phase 1 discovery** (documented in the PR
description, banked here for the next reviewer to find):

1. Brief's locked decision *"Existing Retry button is the recovery path — no
   new UI components"* — the Retry button was deleted in PR-D commit `f167708`
   (`refactor(email): PR-D — remove all client-side email dispatch`) because
   client-side `sendPasswordResetEmail` was removed in the same change. The
   warning toast in this fix is informational with no action button. The
   genuine recovery path is the still-unshipped "Resend invite UI"
   follow-up below.
2. Brief's NOT-in-scope line *"Bulk user import path — already handles email
   failures correctly via `dispatchResetEmails`"* — `dispatchResetEmails` was
   also deleted in commit `f167708`. Post-PR-D, bulk import inherited the same
   `emailQueued: true` lie, so the bulk path WAS in scope per the original bank.

**Open follow-up:** the "Resend invite UI" item below remains the canonical
recovery path for an email failure detected after the post-create toast
dismisses. This fix surfaces the failure; "Resend invite" gives admins a way
to actually resend.

---

## Track E — Agent + Manager Tooling Enhancements

Source: planning session with Kyron + planning-Claude, May 8 2026.
Full specs in docs/Track-E-Specs.md.

Path B sequencing chosen: E1 + E6 coupled HIGH pre-pilot. Pilot launch
shifts back ~2 weeks for clean schema + agent cadence choice at launch.

### E1 — Weekly Report Schema Split [HIGH, pre-pilot]
Split weeklyReport doc into 3 production sources: newBusiness, pppIncreases,
lumpsums. Wizard step splits into 3 sub-sections. Migration of existing
reports + API-usage audit across app. ~5 days total. Spec: Track-E-Specs.md §E1.

### E6 — Daily Input Mode [HIGH, pre-pilot, depends on E1]
Optional opt-in daily activity log. Sunday Cloud Function aggregates to
weekly wizard pre-fill. New agent.loggingMode profile field (Weekly/Daily/
Hybrid). dailyActivity subcollection uses 3-source split from day 1.
~5-7 days total. Spec: Track-E-Specs.md §E6.

### E2 — Reverse Commission Calculator [SMALL, pre-pilot opportunistic]
New "Reverse Calc" tab in Commission Playground. "How much API to sell this
month to be paid $X this month?" — accounts for Tatil modal commission timing
(annual upfront, semi/quarterly/monthly per modal frequency). New business +
first-year commissions only in v1. ~1.5-2 days. Spec: Track-E-Specs.md §E2.

### E3 — Persistency Playground — RESOLVED in PR #82 (2026-05-11)

**Resolved 2026-05-11 in PR #82.** Shipped: 6-input manual entry form (businessPlaced / notTakens / incPPPs / lumpsums100 / lapses / reinstatements) with live-derived persistency, 12-month trend chart, award-gate banner, and what-if Playground (3 recovery levers: NB / NR / Orphans). Agent self-entry and manager entry share the same `PersistencyEntryForm`; Firestore rules scoped by role. CareerPortal and `exportService` average-of-percentages bugs fixed in the same PR. Tatil monthly-report manual-entry workflow fully supported.

Rules follow-ups: PR #83 fixed persistency `allow list` list-query denial. PR #85 fixed `allow get` on non-existent docs (blocked first-time agent saves). Open follow-ups from this arc: SCOPE-1, SCOPE-2, PERF-1, TEST-N, WALK-1, BUG-N2, UX-N (all added below, 2026-05-11).

### E4 — Digital Production Report / Branch Leaderboard [MEDIUM, post-pilot, depends on E1]
Three role-based views (Unit Mgr / Branch Mgr / Sales Mgr) replacing the
weekly Friday whiteboard PDF. Live updating + Friday 4pm snapshot toggle.
Print export. Cloud Function aggregator. ~4 days. Spec: §E4.

### E5 — TV Display Kiosk Mode [SMALL, post-pilot, depends on E4]
Kiosk route for office TVs. Auto-rotating slides (production report, top 10,
agent of week, goals, award watch). Branch-scoped revocable kiosk tokens.
Privacy controls per branch. ~3 days. Spec: §E5.

---

## Wizard UX + A11y Hardening (post-Track-A audit, 2026-05-06)

- ✅ **Wizard UX hardening — CLOSED** by PR #88 (2026-05-11): retry button, Saved✓ indicator, offline-vs-failed distinction, role=alert/aria-live, persistent-failure handling. PR #124 added R1 micro-fix (Saved-while-offline semantic copy).

### ✅ Wizard polish (post-pilot) — CLOSED by PR #151 (`8a8818c`)

- ✅ **R2** — CLOSED by PR #151 (`8a8818c`): Split nested `role="alert"` inside `role="status"` into sibling live regions. Polite region carries idle/saving/saved; assertive region carries failed/offline/escalated.
- ✅ **R3** — CLOSED by PR #151 (`8a8818c`): Added `motion-reduce:animate-none` guard to `animate-pulse` on the saving indicator.
- ✅ **R4** — CLOSED by PR #151 (`8a8818c`): 2s throttle on Retry button via `lastRetryAt` ref; silent no-op on rapid re-clicks; reset on each new failure.
- ✅ **R5** — CLOSED by PR #151 (`8a8818c`): Sticky failure window (8s). `stickyError` hoisted to WizardForm; `FAILURE_STICKY_MS = 8000` named const; `visibleError` derived during render from prop + `failedShownAt` ref.

---

## Mobile audit — deferred items (from `mobile-audit-2026-05-06`)

Pilot-critical agent-flow items shipped in PR `mobile-audit-pilot-pass-1`. The
remaining items below were intentionally deferred. Audit doc: `docs/mobile-audit-2026-05-06.md`.

### Mobile follow-up #1 — Manager surface mobile pass — RESOLVED in PR #90 (2026-05-11)

`MasterSheet.jsx` (23-column grid wrapped in `overflow-x-auto`),
`SettlementPanel.jsx` (three grids), `ManagerDashboard.jsx` TabBar (still h-9),
`ManagerAwardsPanel.jsx` TabBar, `GoalsPanel.jsx` mode-tabs,
`CampaignPanel.jsx` filter tabs, `MeetingMode.jsx` (mobile-presentation
behaviour), `UserManagementPanel.jsx` rows. None of these are pilot-blocking
because Tatil managers will use desktop/tablet, but each has the same
36px tab-button + horizontally-scrolling-grid pattern that needs the same
treatment as the agent side. Estimated 1–2 days of focused work.

### Mobile follow-up #2 — Non-core agent surface P1s — CLOSED by PR #153 (9571a28)

- ✅ **P1-1** — CLOSED by PR #153 (9571a28): CareerPortal Edit/Cancel/Save buttons bumped to `h-11 px-4 text-sm` (44px). All three editing-mode siblings fixed, not just "Edit My Goals".
- ✅ **P1-2** — CLOSED by PR #153 (9571a28): already-resolved structurally (entire `AgentDashboard.jsx:722-747` History row is the `<button>` with `card` class, resolving to `p-6` ≈ 78px hit area; Eye icon is decorative inside that hit area). Original audit measured icon size (15px) not button bounds.
- ✅ **P1-3** — CLOSED by PR #153 (9571a28): CommissionPlayground accordion toggle gets `min-h-[44px]`.

**New FU banked during P1-2 audit:**
- [x] **History row aria-label** — `AgentDashboard.jsx:722-747` History row button has only "Week of {date}" as visible text; Eye icon is decorative. Add `aria-label="Preview submission from week of {date}"` (or similar) for SR clarity. Surfaced during Mobile FU#2 P1-2 closure audit; defer to a comprehensive aria sweep rather than one-off fix. [RESOLVED PR #213, 38be348]

### Mobile follow-up #3 — `bg-primary/N` opacity utilities resolve to transparent — RESOLVED in PR #132 (2026-05-12)

**Resolved 2026-05-12 in PR #132** (`0573a2c`,
`fix(theme): FU#3 — channel-split token migration for working opacity modifiers`).
Option 1 implemented: CSS variables migrated to channel form (`19d3cf3 fix(theme): channel-split CSS color tokens with derived aliases`),
Tailwind config rewritten to functional notation (`595dce5 fix(theme): rewrite tailwind config to functional notation for opacity modifiers`).
All `bg-primary/N`, `text-primary/N`, `border-primary/N` modifiers now resolve
correctly app-wide. FU#3 smoke script lives at `scripts/verification/fu3-channel-split.cjs`.

Cosmetic hardcoded-hex sites (e.g. `bg-[#01696f]/8`) were intentionally
deferred — see "Hardcoded hex literals with opacity modifier" entry at the
end of this file. Those resolve correctly without channel-split (Tailwind
decomposes literal hex at build time) but bypass the design-token system.

---

**Original triage notes (kept for reference):**

The carousel inactive dot indicators show `bg-primary/30` but the computed
`background-color` is `rgba(0,0,0,0)` because the project's Tailwind config
exposes `--color-primary` as a hex string (`#01696f`), not as space-separated
RGB channels. Tailwind 3 `<color>/<opacity>` modifier silently fails when the
source color isn't channel-split.

Likely affects every `bg-primary/N`, `text-primary/N`, etc. usage in the
codebase — needs a one-pass audit. Two options:

1. Convert the CSS variables to channel form: `--color-primary: 1 105 111`
   and switch all consumers to `rgb(var(--color-primary))`.
2. Replace `/N` modifiers with explicit `rgba()` literals (loses theming).

Option 1 is the right fix but touches every theme variable + consumer.

### Mobile follow-up #4 — P2 cosmetic items — CLOSED in PR #154 (630bac1)

- ✅ **P2-1** — CLOSED by PR #154 (630bac1): WizardForm + CampaignPanel close buttons bumped to `w-11 h-11` (44×44px). Sibling sweep included.
- ✅ **P2-2** — CLOSED by PR #154 (630bac1): already-resolved structurally. LeaderRow is non-interactive (no onClick/role/href), row height ~60px via `py-3` + content, and avatar is 36px (`size="md"`) not 40px. Tap-target rules apply only to tap targets. FOLLOW_UPS text "40×40" was a doc-accuracy gap — actual size 36px. No code change required.
- ✅ **P2-3** — CLOSED by PR #154 (630bac1): closed as already-resolved-structurally. `MotivationalCarousel.jsx` has had zero live consumers since M2 (PR #107, `46eda67`) removed it from ManagerDashboard. The hex-literal defect does not manifest because the component never renders. Dead-code deletion banked as a new LOW FU (see below).

---

## `bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep (LOW, banked during Mobile FU#4)

- ✅ **`bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep** — CLOSED by PR #155 (`70c764d`): 89 utility substitutions across 28 files. `bg-[var(--color-surface)]` → `bg-card` (83), `bg-[var(--color-surface-raised)]` → `bg-card-raised` (5), `text-[var(--color-text)]` → `text-ink` (1). Computed CSS identical at full opacity (named utilities resolve to `rgb(var(--surface-channels) / 1)` vs `rgb(var(--surface-channels))` — same color when alpha=1). `border-[var(--color-border)]` outliers in WizardForm.jsx held back pending separate `border-border` resolution audit (see banked FU below).

---

## `border-border` utility resolution audit (MEDIUM, banked from arbitrary-syntax sweep) — RESOLVED in PR #156 (2026-05-14)

- ✅ **`border-border` utility resolution audit** — CLOSED by PR #156 (`1e4bdf0`): mechanism untraced because no binding existed. Audit confirmed 201 usages across 49 files were rendering Tailwind's Preflight fallback (`#e5e7eb` gray-200) instead of the warm `--color-border` theme token. Fixed via 1-line addition to `tailwind.config.js`: `theme.extend.colors.border` → `rgb(var(--border-channels) / <alpha-value>)`. All 201 named-utility usages now resolve correctly. Pattern B sites (`border-border` without width utility) banked as separate audit (see below).

---

## Pattern B `border-border` sites audit (LOW, banked from border-border resolution fix)

- [ ] **Pattern B `border-border` sites audit** — Some occurrences of `border-border` in the codebase don't pair with a `border` width utility, so Preflight's `border-width: 0` keeps them invisible even after the PR #156 color-binding fix. Audit task: enumerate Pattern B sites (grep for `border-border` NOT preceded/followed by a border width class on the same element), per-site judgment whether a visible border was intended. Surfaced during the `border-border` resolution audit (PR #155 follow-up). LOW because no visual regression — sites currently render no border and continue to render no border post-PR #156; this is intentionality verification, not defect remediation.

---

## KioskShell hex literals → presentation token family (LOW, banked from arbitrary-syntax sweep)

- [ ] **KioskShell hex literals → `presentation` token family** — `src/components/kiosk/KioskShell.jsx:80` and `src/components/kiosk/KioskRoute.jsx:44` use hex literals (`bg-[#1a1612]`, `border-[#4ab5b8]`, `text-[#f0ebe0]`, `text-[#b8aea0]`) for the kiosk fullscreen presentation shell. The `bg-presentation`, `text-presentation`, `bg-presentation-accent`, `border-presentation-border` token family already defined in `tailwind.config.js` appears designed to encode exactly this intent — theme-independent dark presentation surface. Migration would unify kiosk styling with the theme system. Surfaced during arbitrary-syntax sweep audit as a sibling pattern. Different category from the CSS-var-syntax sweep itself (hex literal vs `var()`) so banked separately.

---

## CampaignForm close button missing aria-label (LOW, banked during Mobile FU#4 smoke) [RESOLVED PR #213, 38be348]

- [x] **CampaignForm close button missing aria-label** — `src/components/campaigns/CampaignPanel.jsx:283` close button has no `aria-label`; contains only a decorative `<X />` icon (no visible text). Screen-reader users hear "button" with no description. Same defect pattern as the History row aria-label gap banked from FU#2 (`AgentDashboard.jsx:722-747`). Surfaced during Mobile FU#4 P2-1 smoke walk attempting `waitForSelector('[aria-label="Close"]')` as a form-open gate — selector never resolved, confirming the label is absent. Defer to a comprehensive aria sweep rather than a one-off fix.

**Closure (PR #213, squash `38be348`):** Resolved as part of comprehensive aria-label sweep — 10 sites total (this site + History row L722-746 + 8 net-new sites from 2026-05-19 audit). `aria-label="Close campaign form"` added to the CampaignPanel close button at `src/components/campaigns/CampaignPanel.jsx:283`. Sweep covered two defect classes: Class A icon-only buttons (8 sites via `aria-label` attribute) + Class B mobile-hidden-text pattern (2 sites in ManagerDashboard via `hidden md:inline` → `sr-only md:not-sr-only` swap so visible text stays in the a11y tree at all viewports). Rule 9 in-PR scope extension absorbed a 10th site: `KioskModeTab.jsx:178-186` is an icon-only `<a>` anchor (`<ExternalLink />` + `title="Open kiosk"`) — identical defect class to Class A, adjacent in a file already in scope. Class B fix path source-verified at Phase 1: `sr-only` is idiomatic in this codebase (2 existing hits at `ActivityFeed.jsx:77` + `ProfileScreen.jsx:370`); `md:not-sr-only` is a valid Tailwind responsive variant requiring no config change.

---

## Delete dead MotivationalCarousel component (LOW, banked during Mobile FU#4 smoke) [RESOLVED PR #208, 44db563]

- [x] **Delete dead `MotivationalCarousel` component** — `src/components/dashboard/MotivationalCarousel.jsx` (~150 LOC) has had zero live consumers since M2 (PR #107, `46eda67`) removed it from `ManagerDashboard` and wired `ManagerOverviewTab`. Component remains in source. Verified dead via grep (no JSX usage anywhere in `src/` outside the test file) and git log of PR #107 commit message ("Removes MotivationalCarousel + Sparkles placeholder"). Surfaced during Mobile FU#4 P2-3 smoke walk when the component could not be located in any rendered dashboard. Removal is mechanical: delete the component file. No imports remain to clean up. Defer to a dead-code-removal sweep rather than a one-off.

**Closure (PR #208, squash `44db563`):** Component file deleted at `src/components/dashboard/MotivationalCarousel.jsx` (actual ~378 LOC at deletion time; FU body's "~150 LOC" estimate was stale — file grew between Mobile FU#4 banking and this closure). No test file existed. Re-verified at execution: zero external imports / JSX usage in tracked `src/` files (one historical comment reference in `AgentDashboard.jsx:414` updated to remove the dangling component name — Rule 9 in-PR scope extension). Sweep scope was limited to this one component per locked decision; broader dead-code sweeps deferred.

---

## A11Y dark-mode story — CLOSED in PR7

PR3/PR4/PR5/PR6/PR7 collectively brought the project to **0 axe color-contrast
violations in BOTH light and dark modes** across all 8 agent + 9 manager pages,
plus MeetingMode. Token system is documented in CLAUDE.md.

If new dark-mode contrast violations surface, run:

```
node scripts/a11y-axe-scan.cjs --dark
node scripts/a11y-axe-scan-manager.cjs --dark
```

and apply the established `dark:bg-primary-dark dark:hover:bg-primary` pattern
(or extend `.dark .btn-primary` for new shared utility classes).

---

## React Compiler adoption — already documented below; left in place for context

## react-hooks/exhaustive-deps × 3 (deferred from PR3)

**RESOLVED 2026-05-15 via PR #164 (`33e44e6`).**

- `src/components/awards/AgentAwardsPanel.jsx:155` — **RESOLVED** — wrapped `now` in `useMemo([currentDate])` to stabilize the memo key. The computation `useMemo` now correctly skips recomputation when `currentDate` is stable.
- `src/components/awards/AgentAwardsPanel.jsx:168` — **RESOLVED** — eslint-disable removed; lint no longer flags the deps array after item 1 fix. (The directive was already "unused" at baseline — the violation fired at :155, not :168, so the disable never actually suppressed anything.)
- `src/components/manager/GoalsPanel.jsx:361` — **STALE — direct closure.** `onGoalsLoaded` does not exist anywhere in `src/` (verified via grep on 2026-05-15). `GoalsPanel` is zero-props (`export default function GoalsPanel()`); the dependency was removed in a prior refactor. No code change required.

---

## React Compiler adoption (long-term, conditional)

**Scope:** `eslint-plugin-react-hooks` v7 ships React Compiler lint rules disabled in
`eslint.config.js` (see Lint Policy in CLAUDE.md). If `@babel/plugin-react-compiler` is
ever adopted, re-enable those rules and refactor the ~19 data-fetch `useEffect` patterns
they flag.

- Not blocking anything; purely a note for when React Compiler reaches stable adoption
- No PR needed until the Compiler is intentionally added to the project

---

## PR-4 — Edit-user flows (user-mgmt track) — RESOLVED in PR #122 + PR #129 (2026-05-12)

**Resolved 2026-05-12.** Shipped in two PRs:

- **PR #122 (`f62955e`, `feat(users): PR-4 — edit-user flows + permission matrix`)** —
  EditUserDrawer + permission matrix for non-claim-keyed fields (name, phone,
  bio, etc.). `updateUserFields` service + Firestore rule allowlist; UI
  affordance in `UserManagementPanel`; reassignment-confirm dialog scaffolding.
- **PR #129 (`5645100`, `feat(users): PR-4b — role + branchId edits via updateUser Cloud Function`)** —
  Role and branchId edits via the polymorphic `updateUser` Cloud Function
  (claim-atomic, server-side permission matrix). EditUserDrawer wired with
  role/branchId dropdowns + permission-gated UI; `callUpdateUser` client
  wrapper with unit tests; PR-4b smoke walk.

Email changes and unitId reassignment-for-agents were deliberately deferred —
they belong to the post-pilot scope.

---

**Original scope (kept for reference):**

UserManagementPanel currently supports create + deactivate/reactivate.
Missing: editing an existing user's fields (name, email, phone, unitId reassignment).

- Add an Edit button/drawer to each user row (branch_manager and above)
- Inline edit for name, phone; modal for role reassignment (rare, requires caution)
- Email changes must go through Firebase Auth `updateEmail` (not just Firestore)
- Unit reassignment for agents: update `unitId` in both the Firestore doc and claims

---

## Branches Management UI — RESOLVED in PR #60 (2026-05-08)

**Original scope:** Branches existed as data (branchId strings in user docs) but there
was no UI to list, create, or rename branches. A branch_manager or tenant_admin could
not add a new branch without direct Firestore access.

**Shipped in PR #60 (Track C — C1):**

- New Firestore subcollection `tenants/{tenantId}/branches/{branchId}` with auto-ID
  branchIds (opaque random strings; display name only).
- Service layer `src/services/branchService.js` — `listBranches`, `getBranch`,
  `createBranch`, `updateBranch`, `setBranchActive`. Active-only branch-name uniqueness.
- `BranchesPanel` (table-style list, tenant_admin only) + `BranchEditorModal`
  (create + edit; lifts B5 EditConfigModal a11y patterns) + `DeactivateBranchConfirmDialog`.
- New `firestore.rules match /branches/{branchId}` block: tenant-scoped read for any
  signed-in user, write for `tenant_admin` / `platform_admin` only (cross-tenant guard
  for tenant_admin per B5 lesson).
- Emulator regression test `scripts/test-c1-branches-rule.js` — covers cross-tenant
  read denial, role-write denial, tenant_admin self-tenant write, platform_admin
  cross-tenant write.

**Rename behavior** (originally proposed) was descoped. Renaming a branch updates only
the branch doc; legacy `user.branchId` strings remain unmigrated. Migration is a
separate post-pilot ticket — tenant_admins re-target users via Edit User flows once
those ship (PR-4).

---

## SEC-9b — Cross-tenant isolation audit

**Scope:** Firestore rules were tightened in SEC-2/SEC-3/SEC-4 but a full cross-tenant
read audit has not been run. A malicious tenant_admin should not be able to read another
tenant's subcollections.

- Run `firebase emulators:start` + cross-tenant read probes for every subcollection
- Pay special attention to: campaigns, leaderboard, notifications, settlements
- Document results in `docs/SEC-9b-audit.md` and patch any failures

---

## tenant_admin email update path — RESOLVED in PR #148 (2026-05-15)

**Resolved 2026-05-15 in PR #148** (`20b7c72`,
`feat(profile): tenant_admin email update with re-auth + audit`).

Self-service email update flow in `ProfileScreen.jsx` for `tenant_admin` role only.
`verifyBeforeUpdateEmail` (Firebase Auth) requires current-password re-auth before
sending a verification link to the new address; email in Auth/Firestore only changes
after the user clicks the link. Firestore user doc syncs lazily via `AuthContext`
email-mismatch detection on next sign-in. Audit entries written to the new top-level
`auditAdminEmailUpdates` collection. Phase 1 caught a stale `updateEmail()` call in
the brief — `verifyBeforeUpdateEmail` is the correct safer API.

---

## Login screen logo

**Scope:** The LoginScreen (`src/components/auth/LoginScreen.jsx`) uses a text-based
"AgencyTrack" wordmark. A Tatil Life logo asset needs to be placed here before the pilot demo.

- Obtain the Tatil Life logo SVG/PNG from Kyron
- Place at `public/tatil-logo.svg` (or similar)
- Swap the text wordmark in LoginScreen with the `<img>` tag (or inline SVG)
- Test in both light and dark mode

---

## APP_MANUAL historical references cleanup

**Scope:** Several components contain `// APP_MANUAL` comments that were added during early
development to flag hand-maintained data (e.g. hardcoded branch lists, company minimums
duplicated in UI). Many of these are now served from Firestore (`config/settings`) but the
comments were never removed.

- `grep -r "APP_MANUAL" src/` to find all sites
- For each: verify whether the value is now dynamic (remove comment) or still hardcoded (file a separate ticket)
- Update this document with findings

---

## Dashboard heading-hierarchy harmonisation

**Scope:** AgentDashboard's existing dashboard-tab sections (KPI Activity grid,
Goals, Submit Weekly Report) use `<p class="text-xs uppercase">` as fake
headings instead of real `<h2>`/`<h3>` elements. B3 introduced real
`<h3>`s for "Recent Activity" and "Achievement Badges" — those two now
sit alongside `<p>`-styled section headers, which is internally
inconsistent.

- Convert KPI Activity grid header (`Activity Trend — Last N Weeks`) to `<h3>`
- Convert Goals card header to `<h3>` and wrap the surrounding `<div class="card">` in `<section aria-labelledby>`
- Audit the same pattern across `ManagerDashboard.jsx` and the other dashboard surfaces for parity
- Verify nothing skips heading levels (h1 → h2 → h3 only)

Priority: LOW. A11y-positive but cosmetic; B3 introduced no regressions. Surfaced during the B3 audit.

---

## Sidebar collapse toggle hit-target (32×32 → 40px+)

**Scope:** `.sidebar-collapse-btn` in `src/index.css:873-876` is a
32×32 click target. CLAUDE.md domain rules call for a 44×44 minimum,
primarily aimed at mobile field agents. The collapse toggle is desktop-
only (≥1024px expanded), so 32×32 is technically acceptable for mouse-
precision use. But the visual is also small enough that pointer-imprecise
users (large displays, pen tablets, touch-screen laptops) feel the
mistarget. Consider bumping to 40×40 or 44×44 to match the project's own
44px minimum, even though the cohort affected is narrow.

Adjacent to Mobile FU#4 cosmetic items. Not blocking — the surface is
reachable as of PR #56.

Priority: **LOW**. Surfaced as a Q2 deferral during the PR #56 triage.

---

## Defaults-warn banner positive-render test (LOW, surfaced 2026-05-08 during C3 extended verification)

**Scope:** `BulkImportGoalsModal.jsx` renders a yellow `<Info>` banner when `usingDefaultMinimums(preflight.minimums)` returns `true` — i.e. when the `companyMinimums` doc is missing `updatedBy`/`updatedAt` fields (heuristic: doc was never explicitly set by an admin, so defaults are in use). The extended C3 verification confirmed the banner does NOT render for the pilot tenant (tatillife_south's `companyMinimums` was set 2026-04-30 and has both fields). The positive-render path (banner shown when minimums are unset) was not exercised in production because the doc already exists.

**Fix:** Add a verification step or unit test (once Vitest lands from the Test Infrastructure MEDIUM item) that exercises `usingDefaultMinimums` with and without `updatedBy`/`updatedAt` fields, and optionally a smoke test that briefly deletes or replaces the `companyMinimums` doc to exercise the banner in staging. Until Vitest lands, the logic is simple enough to reason about directly from source.

Priority: **LOW**. The logic is a one-line helper (`!minimums?.updatedBy && !minimums?.updatedAt`); no known bug. This is a coverage gap, not a defect.

---

## `Bulk Import Goals` CTA label wraps at 390px (LOW, surfaced 2026-05-08 during C3 Q1 design review)

**Scope:** At 390px viewport width, the `UserManagementPanel` header has two sibling buttons — "Bulk Import Users" and "Bulk Import Goals". Both labels wrap onto two visual lines per button at 390px because the header row runs out of horizontal space. The buttons are accessible and legible (tap target exceeds 44px, labels are not truncated), but the two-line wrapping looks slightly unpolished at the smallest breakpoint.

**Options:**
1. Shorten labels to "Import Users" and "Import Goals" (saves ~35px each, probably enough to stay single-line).
2. Stack the buttons vertically at ≤640px (clean layout but takes more vertical space in the header).
3. Move them to an overflow/kebab menu at ≤640px.

**Recommendation:** Option 1 is the cheapest fix — `tenant_admin` context makes "Import" unambiguous. But since the current state is legible and accessible, defer until the manager surface mobile pass (Mobile FU#1) is scoped, so the header layout can be treated holistically.

Priority: **LOW**. Cosmetic at one breakpoint; no accessibility or usability failure.

---

## Kiosk team activity slideshow (MEDIUM, concept locked 2026-05-10)

**Scope:** Manager-uploaded photos from team events (training days, awards
ceremonies, branch outings, milestone celebrations) rotated as a dedicated
kiosk panel inside the existing E5 kiosk rotation. Branch-scoped — each
branch's kiosk shows only its own photos. Firebase Storage backed at
`team-photos/{tenantId}/{branchId}/{photoId}.jpg` with a Firestore index
collection for ordering / captions / upload metadata.

**Why this subsumes the earlier "branch hero photo" idea:** the original
proposal was a single static branch photo (one team shot, swapped manually
when staffing changed). That carried turnover-staleness risk — a departing
agent in the photo embarrasses the branch every time it renders. A
rotating slideshow of recent event photos sidesteps the risk: an outdated
photo simply ages out of rotation as newer events get uploaded, and the
staleness pressure becomes implicit (managers naturally swap in fresher
shots over time).

**Scope estimate:** ~2-3 day Claude Code session. Firebase Storage upload
UI in manager surface, Firestore index doc + rules, kiosk panel
component slotted into the existing rotation, branch-scoped query.

Priority: **MEDIUM**. Post-pilot — depends on E5 kiosk shipping first
(already shipped in PR #75). Genuine adoption signal needed (do branches
ask for this?) before scoping a PR.

---

## Kiosk per-branch customization (LOW, deferred 2026-05-10)

**Scope:** Allow each Branch Manager to pick which panels appear on their
kiosk, set the panel rotation order, and adjust KPI emphasis (e.g. show
unit comparisons vs. only individual leaderboards). Currently the kiosk
ships a single fixed 12-panel rotation tuned for the pilot branch.

**Why deferred:** premature at pilot scale. The pilot is a single branch
(tatillife_south); there is no divergent-needs signal yet. Customization
adds substantial scope (per-branch config schema, admin UI, migration of
the current fixed rotation into config-driven defaults) for zero current
benefit. Revisit when 3+ branches show divergent needs — at that point
the configuration surface justifies its weight.

**Scope estimate:** ~1-2 weeks when the time comes. New
`tenants/{tenantId}/branches/{branchId}/kioskConfig` doc, BranchEditorModal
extension or dedicated KioskConfigPanel, kiosk renderer reads config
instead of hardcoded rotation.

Priority: **LOW**. Concept reviewed 2026-05-10 and explicitly deferred —
do not pick up until a third branch is onboarded and asks for it.

---

## e5-1-walk.mjs selector fixes (LOW, banked 2026-05-10)

The Playwright walk for E5.1 (`scripts/verification/e5-1-walk.mjs`) has 4 checks (02/05/10/12) that timeout on internal selectors despite the underlying features rendering correctly per manual smoke verification on 2026-05-10. Specifically:

- 02_kiosk_shell_fullscreen_btn — selector for FullscreenButton
- 05_ytd_leaderboards — selector for API + Apps columns visibility
- 10_activity_breakdown — selector for breakdown text beneath totals
- 12_lucide_icons_render — selector for Trophy/Medal SVG elements

Features were verified visually as working. Fix is selector adjustment only — likely use stable selectors (data-testid attributes, aria-labels, semantic role queries) instead of structural-wait patterns. Target 16/16 walk pass after fix.

~30 min CC session when convenient. Not pilot-blocking.

## fieldHelpers / extractFields consolidation (LOW, banked 2026-05-10)

**Scope:** Two duplicate sources of truth for activity-total computation:

- `functions/utils/fieldHelpers.js` — CommonJS, consumed by Cloud
  Functions (Sunday aggregator, weekly recognition cron, etc.).
- `src/utils/extractFields.js` — ESM, consumed by the React app
  (dashboards, leaderboards, PDF report).

Both compute the same numeric fields (FFI count, CI count, API total,
PPP, lumpsums, new business) from the same submission documents, but
each maintains its own field-extraction logic. A bug fix or schema
migration in one easily drifts from the other — exactly the kind of
duplication that bit P8 when wizard-flat-schema rollout missed
extractFields and caused historical reports to render zeros.

**Long-term fix shape:**
- Option A: shared utility at `shared/fieldHelpers.js` compiled to both
  CJS and ESM via a build step (e.g. tsup or unbuild). Both consumers
  import from a single source.
- Option B: keep two files but generate one from the other via a
  pre-commit script. Source of truth in one location.
- Option C: migrate Cloud Functions to ESM (Node 20 supports it) and
  share the ESM file directly.

E1's schema split (Track E, pre-pilot HIGH) will exacerbate the
duplication — both files will need parallel updates for newBusiness /
pppIncreases / lumpsums extraction. Worth resolving before E1 lands, or
as part of E1 itself.

Priority: **LOW**. No active bug; structural risk only. Bank for E1
scoping conversation.

---

## SCOPE-1 — Tenant-wide persistency aggregate helper (MEDIUM, post-pilot)

**Scope:** `getPersistencyMapForYear` in `persistencyService.js` is branch-scoped (`opts.branchId` filter), which is correct for `branch_manager` Firestore rules. Future dashboard surfaces for `sales_manager` and `tenant_admin` roles need a separate tenant-wide helper (e.g. `getPersistencyMapForTenant`) that those roles' `allow get` conditions permit. Adding a new helper rather than extending `opts` keeps the access-control intent explicit.

Not pilot-blocking — those dashboards don't exist yet.

Priority: **MEDIUM**. Post-pilot. Bank for the `sales_manager` dashboard surface (P9).

---

## SCOPE-2 — Tighten persistency `allow list` rule (MEDIUM, post-pilot)

**Scope:** PR #83 added `allow list: if isSignedIn() && getTenantId() == tenantId` — intentionally permissive within tenant scope because Firestore cannot evaluate `resource.data` for list operations (per the inline rules comment). Future hardening: require client queries to include scope filters (`where('branchId','==',callerBranchId)` etc.) and validate via `request.query` in rules. Requires denormalizing `branchId` and `unitId` onto persistency docs (currently absent). Acceptable for the current single-branch pilot.

Coupled to PERF-1 (same denormalization needed).

Priority: **MEDIUM**. Post-pilot. Do not attempt without the doc-denormalization step.

---

## PERF-1 — `getAvailableMonths` tenant-wide unfiltered query (LOW, post-pilot)

**Scope:** `getAvailableMonths` in `persistencyService.js` for non-agent scopes issues an unfiltered `query(persistencyCollection())` against the full tenant collection. Fine for the pilot (one branch, hundreds of docs at most). As tenants grow into thousands of monthly docs, add a `where`-by-scope filter. Coupled to SCOPE-2 (requires `branchId`/`unitId` denormalized onto persistency docs before a scope filter is possible).

Priority: **LOW**. No urgency at pilot scale.

---

## TEST-N — Build Firebase rules-testing harness (MEDIUM, post-pilot)

**Scope:** `@firebase/rules-unit-testing` is in `devDependencies` but no test runner, environment setup, or emulator port config exists. PR #83's emulator-test step was skipped because of this gap. PR #85's `allow get` fix (non-existent-doc regression) would have been caught by automated rules tests before merging rather than discovered in production via the write-read-verify smoke. Future rules changes — especially to the persistency block, which has non-trivial role + null-resource combinations — should have coverage.

**Minimum viable harness:** configure `@firebase/rules-unit-testing` against a local emulator (port 8080), wire into a `test:rules` npm script separate from Vitest unit tests. First test suite: persistency `allow get` — covers null resource (non-existent doc) for agent / branch_manager / unit_manager; existing doc per role; cross-tenant denial.

Priority: **MEDIUM**. Ideally pre-pilot. Not blocking, but the next rules change without this is flying blind.

---

## WALK-1 — Harden walk scripts with real write-read-verify cycles (MEDIUM, ideally pre-pilot) — RESOLVED in PR #95 (2026-05-11)

**Scope:** The E3 walk (`scripts/verification/e3-persistency-walk.mjs`) reported 18/18 against both preview and production while PR #85's `allow get` regression was live in production. Walk check 9 (`entry_form_saves_to_firestore`) only verifies the Save button is enabled — it never fires the actual Firestore write. The regression was caught on the first application of the new write-read-verify smoke standard.

**New standard (memorialized in project memory):** every walk MUST include at least one real write-read-verify cycle with a hard reload between the write step and the verify step, using real auth and real Firestore. Walk pass rate alone is not sufficient verification.

**Apply to `e3-persistency-walk.mjs` first:** replace check 09 (`Save button enabled`) and check 10 (`nav-away/back state`) with a real agent self-entry write, hard reload, and read-back assertion. Same pattern for all future walk scripts.

Priority: **MEDIUM**. Ideally applied before the next rules-touching PR ships.

---

## WALK-2 — Agent self-write path coverage for persistency walks (LOW, post-pilot)

**Scope:** The persistency lock-by-manager mechanism (`PersistencyTab.jsx:77-79`, `lockedByManager` flag) makes the agent self-write path unreachable for the canonical test agent (`kelsean@gmail.com`) once a manager doc exists for the current month — which it does, persistently, after PR #94 and PR #95 smokes. The WALK-1 `e3-persistency-walk.mjs` cycle covers the manager-write + agent-read path (checks 09b/09c/11b), which exercises the full rules + claims + indexes chain. The agent self-write path is currently uncovered by automation.

**Future work:** Provision a dedicated smoke-only test agent (e.g. `smoke-agent-1@agencytrack-test.dev`) reserved for write-path verification, never written to via the manager path. Alternative: Admin-SDK-backed pre-cycle state reset.

Pilot-launch acceptable; real pilot agents exercise the agent self-write path daily, surfacing any regressions through actual use.

Priority: **LOW**. Post-pilot.

---

## BUG-N2 — `sales_manager` missing from unitGoals write rule — RESOLVED in PR #92 (2026-05-11)

**Scope:** `firestore.rules` `match /unitGoals/{docId}` write block allows `platform_admin`, `tenant_admin`, `branch_manager`, and `unit_manager` (post-BUG-N fix in PR #84). `sales_manager` is NOT in the list. Per the 5-tier hierarchy, `sales_manager` should logically have at least `branch_manager`-level write access to unit goals. Discovered during BUG-N diagnosis.

**Fix:** add `|| request.auth.token.role == 'sales_manager'` to the write condition alongside `branch_manager`.

Priority: **LOW** now; escalate to **HIGH** if sales managers need to set unit goals during the pilot.

---

## UX-N — Improve "no scope assigned" empty-state on Persistency tab — RESOLVED in PR #92 (2026-05-11)

**Scope:** When an account's profile has no `branchId`, `unitId`, or tenant-level role, the Persistency tab shows: "Persistency is scoped to a unit, branch, or tenant — your profile has none assigned." Accurate but not actionable. More useful copy: "Contact your branch manager to be assigned to a unit so you can view your unit's persistency data."

Not pilot-blocking — all pilot accounts will have scope assigned before login.

Priority: **LOW**. Post-pilot polish.

---

## BUG-N3 — Production Report shows raw Firestore UID instead of unit name (LOW, post-pilot) — RESOLVED in PR #97 (2026-05-11)

**Scope:** When a branch manager opens the Production Report screen, the unit identifier column displays the raw Firestore UID (e.g. `XQhG6awVgaYkCFX7gnd1...`) rather than the human-readable unit name. Functional but unpolished — managers can work around it but the display is confusing.

**Discovered:** During PR #90 mgr-mobile audit (visible in `verification/mgr-mobile-audit/production-report.png` reference).

**Root cause (likely):** Missing join between persistency docs and unit-name lookup, or a render-time fallback that is incorrectly using the ID field instead of the display name. Persistency docs store `unitId` as an opaque key; the Production Report likely needs to resolve it against the `units` or `users` collection to get the display name.

**Acceptance:** Unit identifier column shows the human-readable unit name (e.g. "Unit A") for all branch managers who have units in their scope.

Pilot-launch acceptable; fix in a dedicated PR before broader rollout. Not pilot-blocking — Tatil pilot is a single branch and the workaround is to recognise the UID prefix.

Priority: **LOW**. Post-pilot data-display fix.

---

## Add CI step for Firestore index deployment (POST-PILOT, banked 2026-05-12 during pilot-readiness audit)

**Scope:** No automation surrounds `firestore.indexes.json`. Today the
flow for a new composite index is: production query fails → developer
copies auto-generated URL from console error → opens it in Firebase
console → clicks Create → waits 2–5 min → reloads. HIGH#6 (the
`TenantAdminDashboard` YTD composite index) is the canonical example of
this pattern; future indexes will hit it again unless we automate.

**Fix:** Add a CI step that runs
`firebase deploy --only firestore:indexes` from `firestore.indexes.json`
on merges to main. Already partially in place for `firestore.rules` via
the pre-merge deploy pattern (CLAUDE.md). Closes two issues with one
step:

1. Removes the "find the URL in the console error" manual loop. A new
   index in source becomes a deployed index automatically.
2. Catches index-source drift — if production has indexes that aren't
   in `firestore.indexes.json`, the CI deploy reveals the divergence.

**Acceptance:**
- `.github/workflows/ci.yml` (or a separate workflow) runs
  `firebase deploy --only firestore:indexes` on push to `main`.
- Workflow has a `FIREBASE_TOKEN` (or service-account JSON) repo secret,
  scoped narrowly to the indexes resource.
- Document in CLAUDE.md alongside the existing rules-deploy convention.

Priority: **POST-PILOT**. Not blocking pilot launch; manual click is
acceptable for the small number of remaining indexes. Bank for the next
infrastructure-hygiene PR.

Banked during the 2026-05-12 pilot-readiness audit.

---

## Hardcoded hex literals with opacity modifier bypass the token system (POST-PILOT, LOW, banked 2026-05-12 during PR-C-FU3)

**Scope:** A handful of consumer sites use Tailwind arbitrary-value syntax
with a hardcoded hex literal AND an opacity modifier — e.g. `bg-[#01696f]/8`
at `src/components/dashboard/MotivationalCarousel.jsx:366`. Arbitrary hex +
opacity does render correctly (Tailwind decomposes the literal at build
time, so it does **not** hit the CSS-var opacity-resolution path that
PR-C-FU3 fixed). But it bypasses the design-token system entirely: a future
brand recolor or theme change leaves these sites stranded on the old hex,
and they don't react to light/dark switching.

**Known sites (approximate, ~5 total):**
- `MotivationalCarousel.jsx:366` — `bg-[#01696f]/8 border border-[#01696f]/15`
  (flagged in CLAUDE.md § Cosmetic Inconsistencies)
- A few additional `bg-[var(--color-surface)]` arbitrary-syntax sites
  (also flagged in CLAUDE.md). These resolve correctly but are inconsistent
  with the `bg-card` utility convention.

**Fix:** Migrate to the equivalent token-based utility:
- `bg-[#01696f]/8`        → `bg-primary/[0.08]` or `bg-primary/10`
- `border-[#01696f]/15`   → `border-primary/15`
- `bg-[var(--color-surface)]` → `bg-card`

PR-C-FU3 confirmed that token-based opacity modifiers (`bg-primary/N`) now
resolve correctly app-wide, so this migration is mechanical.

**Acceptance:**
- `grep -rn "bg-\[#" src/` returns no hits outside `AgentReportDocument.jsx`
  (react-pdf exempt — uses hex-only by design).
- `grep -rn "bg-\[var(--color-" src/` returns no hits — all converted to
  named utility equivalents.

Priority: **POST-PILOT, LOW**. Not pilot-blocking. The hardcoded hex paths
currently render correctly; this is design-system hygiene. Bank for the
next theme-system PR.

Banked during PR-C-FU3 (2026-05-12 pilot-readiness audit).

---

### SEC-9b residual: tenantId-in-deps exhaustive-deps warnings (RESOLVED 2026-05-16)

**Banked + resolved in same PR.** The tenantId-in-deps pattern was a known residual of SEC-9b (PR #139) — 16 react-hooks warnings remained at SEC-9b merge; PR #164 closed 3 (unrelated react-hooks shapes); the pattern was verbally surfaced during PR #164 closure but never formalized as a FOLLOW_UPS row. This PR formalizes the banking and closes it via mechanical dep additions across 11 files / 13 hooks.

**Audit trail:** PR #139 (SEC-9b migration) → PR #164 (3 react-hooks closures, 16→14 baseline) → PR #172 (`1ea423d` — 13 tenantId-in-deps fixes + 1 unrelated stale eslint-disable cleanup).

**Per-hook fix table:**

| # | File:line | Proposed deps |
|---|---|---|
| 1 | `agent/PersistencyTab.jsx:60` | `[user?.uid, tenantId]` |
| 2 | `daily/DailyEntryModal.jsx:77` | `[user?.uid, today, tenantId]` |
| 3 | `dashboard/AgentDashboard.jsx:251` | `[user?.uid, today, showDailyCTA, tenantId]` |
| 4 | `dashboard/ManagerDashboard.jsx:83` | `[tenantId]` |
| 5 | `kiosk/KioskShell.jsx:59` | `[tenantId]` |
| 6 | `manager/AgentOfMonthTab.jsx:66` | `[branchId, monthKey, tenantId]` |
| 7 | `manager/GoalsPanel.jsx:730` | `[tenantId]` |
| 8 | `manager/MasterSheet.jsx:99` | `[selectedWeek, tenantId]` |
| 9 | `manager/PersistencyTab.jsx:103` | `[scopeType, scopeId, tenantId]` |
| 10 | `manager/PersistencyTab.jsx:128` | `[monthKey, scopeId, scopeType, tenantId]` |
| 11 | `manager/UserManagementPanel.jsx:375` | `[showInactive, tenantId]` |
| 12 | `wizard/WizardForm.jsx:184` | `[user, tenantId]` |
| 13 | `wizard/WizardForm.jsx:206` | `[weekStarting, user, tenantId]` |

Post-PR lint baseline: 0 warnings (down from 14; +1 stale eslint-disable in `run-all.mjs:459` also removed in same PR).

---

### FU-B: Consolidate A11Y env var naming (RESOLVED 2026-05-17)

**Resolved in PR #182** (`19a8281`, 2026-05-17). A11Y env var naming consolidated: legacy `A11Y_MANAGER_*` renamed to `A11Y_BRANCH_MANAGER_*` across 2 consumer sites (`scripts/a11y-axe-scan-manager.cjs` primary + `scripts/verification/e1-slice-2b-walk.mjs` fallback chain — simplified, dual-name bridge removed). `.env.example` expanded from 2 documented A11Y_* role flavors (AGENT + legacy MANAGER) to 6 (AGENT, UNIT_MANAGER, BRANCH_MANAGER, SALES_MANAGER, TENANT_ADMIN, PLATFORM_ADMIN). CLAUDE.md Rule 14 banking note rewritten to pattern-based framing with the 2026-05-17 audit's frozen counts (7 role flavors actively read, 2 documented at banking time).

**Corrected diagnosis vs the originating FU body:** the 2026-05-16 audit's "5 role flavors actively read, only 2 documented" understated the count. Ground truth at the 2026-05-17 audit was 7 role flavors (the 5 referenced plus SALES_MANAGER and a second role flavor not enumerated in the original). FU-B body lines 1582 and 1589 both omitted SALES_MANAGER from the enumeration. Post-rename canonical count is 6 role flavors (no MANAGER-legacy).

**Surfaced from:** Section 3 Drift #1 of env-credentials propagation audit (2026-05-16). Corrected diagnosis surfaced by 2026-05-17 FU-B + Rule 14 re-baseline audit (Rule 11).

**Operator action (post-merge, required):** Rename `A11Y_MANAGER_EMAIL` / `A11Y_MANAGER_PASSWORD` keys in `.env.local` to `A11Y_BRANCH_MANAGER_*` — same logical credential, just the new canonical name. Optional: add credentials for the 4 newly-documented role flavors (`A11Y_UNIT_MANAGER_*`, `A11Y_SALES_MANAGER_*`, `A11Y_TENANT_ADMIN_*`, `A11Y_PLATFORM_ADMIN_*`) if running multi-role smoke walks locally.

---

### FU-C: Remove tracked historical super_admin scripts (MEDIUM, RESOLVED 2026-05-17)

**Resolved in PR #184** (`ddc6095`, 2026-05-17). Removed 2 vestigial dead-code
scripts from the pre-PR-3 super_admin era:
- functions/set-super-admin.cjs (22 lines, one-time claim setter)
- functions/seed-super-admin-user.cjs (45 lines, one-time user doc seeder
  containing hardcoded kyron@tatillife.com literal)

Companion cleanup landed in the same PR: .gitignore lines 27–28 entries
pruned, CLAUDE.md § Sensitive Files — Never Commit bullets for both files
removed, stale PR-1-era comment in scripts/a11y-axe-scan-manager.cjs:17
referencing super_admin credentials as a fallback (rendered obsolete by
PR-3 + FU-B PR #182) deleted.

Phase 1 sanity-check grep (2026-05-17 audit, satisfying the FU-C banking
requirement) confirmed: FUNCTIONAL_GATE bucket empty across firestore.rules
+ functions/index.js + src/. Role retirement is complete in production
code paths. Zero npm-script or CI references to the removed files. The
platform_admin successor role's scaffolding (PlatformAdminStubScreen in
App.jsx, Firestore rules cross-tenant grants, functions/scripts/
seed-platform-admin.cjs bootstrap) is untouched — its cross-tenant UI
build is deferred indefinitely per dispatcher decision 2026-05-17 (single-
tenant Tatil Life scope).

TEST_OR_SEED bucket (migration scripts, emulator harness, one test sentinel)
deliberately left in place — each has rational reasons to stay; out of
FU-C banked scope.

---

### FU-D: Remove VITE_TENANT_ID from .env.example (LOW, RESOLVED 2026-05-17)

**Surface:** `.env.example:5-9` carries a SEC-11 deprecation comment for `VITE_TENANT_ID`. SEC-11 closed in PR #26; no live `import.meta.env.VITE_TENANT_ID` reader exists in `src/`.

**Failure mode:** Var sits as bait — anyone copying the template populates a value nothing reads. Comment is factually wrong post-SEC-11.

**Fix shape:** Remove the var + comment block from `.env.example`. Trivial single-edit.

**Bundle candidate:** can ship with FU-E in one `.env.example` cleanup PR.

**Surfaced from:** Section 3 Drift #2 of env-credentials propagation audit (2026-05-16).

**Resolved in PR #178** (`c930d97`, 2026-05-17). Removed the 5-line VITE_TENANT_ID
block (4-line comment header + var declaration) from .env.example. Audit
(2026-05-17) confirmed zero tracked source readers post-SEC-11/SEC-9b — all
remaining references are docs/history only. Section banner "Vite / Firebase
client config" preserved; next entry (VITE_FIREBASE_API_KEY) sits directly
below.

---

### FU-E: Document VITE_VALIDATE_KIOSK_TOKEN_URL in .env.example (LOW, RESOLVED 2026-05-17)

**Surface:** `src/lib/kiosk/kioskConfig.js:39` reads `VITE_VALIDATE_KIOSK_TOKEN_URL` with a hardcoded production fallback. Not documented in `.env.example`.

**Failure mode:** Knowledge silo — new contributors won't discover this knob exists.

**Fix shape:** Add `VITE_VALIDATE_KIOSK_TOKEN_URL` to `.env.example` with a comment explaining it's optional (defaults to deployed CF endpoint, only set for non-prod kiosk testing).

**Bundle candidate:** can ship with FU-D in one `.env.example` cleanup PR.

**Surfaced from:** Section 3 Drift #3 of env-credentials propagation audit (2026-05-16).

**Resolved in PR #178** (`c930d97`, 2026-05-17). Added VITE_VALIDATE_KIOSK_TOKEN_URL
to .env.example under a new "Kiosk overrides" section. Comment block explains
the prod-fallback default in src/lib/kiosk/kioskConfig.js and when an operator
should set the override. Fresh-clone onboarding now surfaces the option.

---

### FU-F: Unify .env.local parsing strategy (LOW, RESOLVED 2026-05-18)

**Surface:** Two separate `.env.local` parsers exist in the repo. `dotenv` (npm package) used by most scripts. Custom `loadEnv()` in `scripts/verification/shakedown/auth-helpers.mjs:75` — bespoke parser with defensive `[A-Z_][A-Z0-9_]*=` line filter (Rule 4 alignment).

**Risk:** Parser behavior divergence (quote handling, multi-line values, embedded-key detection). Custom parser is stricter; scripts using dotenv get less protection. Low-impact today (no observed mismatch) but a future contributor could write a script using dotenv that trips an edge case the shakedown parser would catch.

**Fix shape:** Extract `loadEnv()` from `shakedown/auth-helpers.mjs` into a shared helper at `scripts/lib/loadEnv.mjs`. Migrate all script readers from `dotenv` to the shared helper.

**Sequencing:** Ship after FU-B (which already touches most A11Y-reading scripts; FU-F can reuse that touch surface).

**Surfaced from:** Section 3 Drift #5 of env-credentials propagation audit (2026-05-16).

**Part 1 resolved in PR #198** (`316b86a`, 2026-05-18). Created `scripts/lib/loadEnv.mjs` (strict parser preserving TOOLING-N embedded-key detection, frozen dict return, module-scoped cache, optional path arg with cwd-default). Migrated 19 of 23 `.mjs` inline-parser sites (Pattern A ×16 + Pattern B ×2 + Pattern D ×1; 4 untracked sites excluded per existing 2026-05-13 banked untracked-cleanup FU). FU-B PR #182 sequencing constraint satisfied — all 19 migration targets within FU-B's touch surface. **Rule 11 corrected diagnosis:** FU-F body's "Two separate .env.local parsers" claim was operationally stale; actual landscape at audit time (2026-05-18, repo HEAD `40cd5d6`) was 8 distinct parser shapes consolidating to 5 semantic patterns across 30 inline-parser sites (23 `.mjs` + 7 `.cjs`). FU body's "dotenv (npm package) used by most scripts" claim was also stale; zero dotenv consumers in source (verified). Corrected diagnosis preserved here per Rule 11 drift-trail principle. **Part 2 (FU-F-2)** deferred — `.cjs` sibling helper at `scripts/lib/loadEnv.cjs` + 7 `.cjs` migrations (audit-locked at 2026-05-18; decisions retrievable via this PR's chat context). Second canonical Rule 17 in-the-wild application during brief authoring (after FU-K's `git branch --merged main` mechanism, FU-J PR #194).

**Part 2 resolved in PR #204** (`a975706`, 2026-05-18). Created `scripts/lib/loadEnv.cjs` (CommonJS sibling to `scripts/lib/loadEnv.mjs` shipped in FU-F-1 / PR #198) preserving identical strict parser semantics including TOOLING-N embedded-key detection. Migrated 5 tracked `.cjs` inline-parser sites: `a11y-axe-scan.cjs`, `a11y-axe-scan-manager.cjs`, `exploration-walk.cjs` (Pattern G — embedded-key detection preserved); `manager-audit-screenshots.cjs`, `manager-audit-screenshots-mobile.cjs` (Pattern H — gains embedded-key detection as safety upgrade). `Object.assign(process.env, loadEnv(...))` preserves caller-side mutation contract. **Rule 11 corrected diagnosis (knock-on from FU-M closure):** Dispatcher's FU-M closure paragraph (PR #202) claimed actual tracked `.cjs` count was 6; correct count is 5 (audit's 7 minus 1 untracked `mgr-mobile-audit.cjs` minus 1 excluded `multi-role-smoke.cjs`). Arithmetic miscount preserved here as drift trail per Rule 11. **FU-N banked in same Phase 4** (audit-methodology refinement: pair `grep` with `git ls-files` for future audit enumerations). Both Parts 1 + 2 of FU-F now complete; entire script parser unification effort closed end-to-end across two PRs.

---

### FU-A: Hardcoded test agent password scrub (RESOLVED 2026-05-16)

**Banked + resolved in same PR.** The `functions/set-agent-password.cjs` script contained a literal test agent password and Firebase Auth UID, tracked in git. Same value also appeared in 2 tracked brief files: `docs/briefs/walk-1-kickoff.md:92` and `docs/briefs/polish-series-housekeeping-kickoff.md:69`. A third brief file (`docs/briefs/e1-slice-2b-kickoff.md:366`) also contained the value but is untracked (confirmed via `git ls-files` — absent from index) — out of scope per brief carve-out; noted in PR body.

**Blast radius:** Test agent account only (`kelsean@gmail.com`, UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`). Bounded but real plaintext exposure.

**Fixes applied in this PR:**
- `functions/set-agent-password.cjs`: literal password replaced with `process.env.TEST_AGENT_PASSWORD` direct read (no parser, no new dependency); fail-fast on missing env var with PowerShell + Bash invocation hints. `dotenv` is not installed in this project; direct `process.env` read avoids the install and sidesteps FU-F's parser-unification concern.
- `.env.example`: `TEST_AGENT_PASSWORD` documented with purpose comment (Rule 14 compliance)
- 2 tracked brief files: literal password scrubbed, replaced with `<TEST_AGENT_PASSWORD>` placeholder (`walk-1-kickoff.md` and `polish-series-housekeeping-kickoff.md`)
- Grep verification (`git ls-files | xargs grep`) confirmed no tracked file retains the literal value

**Operator action (post-merge, required):** Rotate test agent password via Firebase Console → Authentication → Users → kelsean@gmail.com → Reset password. **The code change alone does not invalidate the leaked credential — only rotation does.** Update `.env.local` with the new value to keep the script functional.

**Surfaced from:** Section 4 Exposure #1 of env-credentials propagation audit (2026-05-16).

---

### FU-G — Document operational env vars in script-local READMEs (LOW, RESOLVED 2026-05-17)

**Banked from:** 2026-05-17 env-credentials propagation audit Layer 3 (originating PR #178 brief deferred this). 2026-05-17 methodology batch audit confirmed scope.

**Scope:** Two operational env vars are read in `scripts/verification/**` and `scripts/cleanup/**` but absent from `.env.example`. They are orchestration knobs (not credentials or Firebase client config), so they belong in script-local READMEs, not the canonical credential doc.

- **PREVIEW_HOST** — read in ~18 verification smoke/walk scripts in `scripts/verification/**`. Existing `scripts/verification/README.md` documents VERCEL_BYPASS_TOKEN + A11Y_AGENT_PASSWORD but not PREVIEW_HOST. Extend the existing Environment requirements section.
- **CLEANUP_ALLOWED_TENANTS** — read in `scripts/cleanup/wipe-test-data-sweep.mjs:90` + `scripts/cleanup/preview-test-data-sweep.mjs:71` + consumer/orchestrator sites in `scripts/verification/pr-f-bulk-test-data-smoke.mjs` and `scripts/verification/shakedown/**`. `scripts/cleanup/README.md` does NOT exist — FU-G creates it.

**Sub-finding (worth noting in FU-G's execution brief, not blocking):** PREVIEW_HOST consumption is inconsistent — some scripts hardcode the host string (e.g. `e1-slice-2b-walk.mjs:53`, `e2-walk.mjs:48`), others read `process.env.PREVIEW_HOST` with a fallback. Documentation alone won't unify the pattern. Consolidation is out of FU-G's scope; flag in the README that the env var is the preferred path and that the hardcoded sites are pre-existing drift.

**Closure criteria:**
- `scripts/verification/README.md` Environment requirements section gains PREVIEW_HOST entry with example value, fallback behavior, and a one-line note about the hardcoded-host drift.
- `scripts/cleanup/README.md` is created documenting CLEANUP_ALLOWED_TENANTS, abort-guard semantics, and a cross-reference to `docs/runbooks/test-data-lifecycle.md`.
- `.env.example` remains untouched (these are not credential-doc material per Rule 14).

**Severity:** LOW — operationally important but no security or correctness risk; current state works because either env vars are set in operator shells or fallbacks apply.

**Resolved in PR #186** (`bd238d2`, 2026-05-17). Extended `scripts/verification/README.md` with a `PREVIEW_HOST` operational-knob section (bare-host format, source-accurate fallback behavior, drift note preserving the `e1-slice-2b-walk.mjs` + `e2-walk.mjs` hardcoded-host call-out). Created `scripts/cleanup/README.md` documenting `CLEANUP_ALLOWED_TENANTS` allowlist semantics (env unset OR target tenant absent → `exit 1`), the consumer list (direct invocation plus orchestrator sites in `pr-f-bulk-test-data-smoke.mjs` and the shakedown harness), and a cross-reference to `docs/runbooks/test-data-lifecycle.md`. Phase 1 source audit caught three content-vs-source divergences in the brief's Phase 2a/2b spec and corrected each before commit (documented in the work PR body's Phase 1 findings section). `.env.example` was intentionally NOT modified per Rule 14 carve-out (these are operational knobs, not credentials).

---

### FU-I — Parameterize hardcoded TENANT_ID constants in seed/cleanup/shakedown scripts (LOW)

**Banked from:** 2026-05-17 methodology batch Phase 1 verification. Originally proposed as FU-G scope expansion in the methodology batch audit; Phase 1 grep revealed TENANT_ID is hardcoded JS constants (not `process.env` reads), so it does not share FU-G's "operational env var" shape. Carved out into its own FU at execution time.

**Scope:** Three scripts declare or export `const TENANT_ID = 'tatillife_south'` directly:
- `scripts/seed/test-roster.mjs:18` (exported, consumed elsewhere)
- `scripts/verification/shakedown/auth-helpers.mjs:42` (exported, consumed by shakedown harness)
- `scripts/backfill/assign-test-unit.mjs:42` (local const)

All other `scripts/cleanup/**` and `scripts/verification/shakedown/**` consumers import the constant from one of the three sites above. Zero `process.env.TENANT_ID` reads in `scripts/`.

**Concern:** Multi-tenant readiness, not security or correctness. Hardcoded value is fine while the pilot is single-tenant (`tatillife_south`), but blocks any future multi-tenant test scaffolding. No current operational impact.

**Resolution direction (deferred to FU-I's execution PR):** Parameterize via env var override (e.g. `TENANT_ID=acmelife node scripts/seed/test-roster.mjs`) with `tatillife_south` as the default. Consider centralizing the constant in one shared module if multiple modules need to reference it.

**Severity:** LOW (post-pilot multi-tenant readiness, no current operational impact).

---

### FU-H — Phase 4 fill scope methodology (LOW, methodology, RESOLVED 2026-05-17)

**Banked from:** 2026-05-17 methodology batch audit. Surfaced as the second failure mode adjacent to Rule 15.

**Scope:** The post-merge placeholder-fill sequence currently updates only `#TBD`/`{TBD}` literal placeholders in CONTEXT.md and FOLLOW_UPS.md. Non-placeholder per-PR state in CONTEXT.md — `Current main HEAD`, `Active track`, `Next track`, and the "Where we left off" prose — does NOT get updated unless the work brief's Phase 4 explicitly mandates it. As a result these fields go stale within hours of any PR landing.

Evidence at banking time: even after PR #178's clean post-merge fill (`3e3afc0`), CONTEXT.md's top-table `Current main HEAD` was pinned to a pre-#178 SHA until this methodology PR's Phase 4 backfilled the state.

**Open design question (deferred to FU-H's execution PR):** Resolution options include —
- Amend § Post-merge local cleanup in CLAUDE.md to mandate top-table + "Where we left off" updates as part of every post-merge sequence, regardless of whether the work brief specified them.
- Add a canonical Phase 4 spec section to CLAUDE.md that all work briefs must inherit (so individual briefs don't need to re-specify the fill surface every time).
- Promote the post-merge placeholder-fill sequence to its own numbered canonical rule (resolves both this gap and the "Rule 4 shorthand" terminology drift simultaneously).

**Closure criteria:** Design judgment locked in a future methodology PR; canonical Phase 4 fill scope is unambiguous and enforceable; CONTEXT.md top-table state stays current automatically after every post-merge sequence.

**Severity:** LOW (methodology) — doesn't break shipping, but causes CONTEXT.md drift that erodes the doc's value as an at-a-glance state reference.

**Resolved in PR #188** (`a543c30`, 2026-05-17). Rule 16 added to `CLAUDE.md` mandating post-merge fill scope (Current main HEAD, Active track, Next track, "Where we left off", Last updated). Anchor tweak at `CLAUDE.md:344` cites Rule 16 alongside Rule 15. Retired "Rule 4 shorthand" terminology drift flagged by Rule 15:503. Top-table staleness fixed in same commit as Rule 16 demonstration case. Pass 3 amend corrected initial `fill commit` anchor wording to `work-PR squash` (the operationally-possible version) after the hotfix-Phase-4 self-application surfaced the chicken-and-egg condition. Rule 16 has self-validated across four consecutive post-merge cycles (PRs #188, #190, #192, #194) with zero drift recurrences. **Note on this footer:** PR #188's Phase 6 spec included this resolved-block conversion but execution missed it; the drift was caught during FU-J + FU-K Session A brief authoring (2026-05-18) and reconciled in this stale-row sweep PR.

---

### FU-J — Brief and rule authoring source-verification discipline (LOW, methodology, RESOLVED 2026-05-18)

**Surface:** Pattern observed 2026-05-17 across FU-G + FU-F + FU-H + Rule 16: briefs and rule additions describing source behavior (default behavior, example values, command syntax, file paths, line numbers, structural format) authored without source-level verification produced six errors. Phase 1 re-audit caught all six, but at cost of re-author cycles.

**Specific instances:**

1. FU-G brief Phase 2a default behavior — described `PREVIEW_HOST` fallback as "production preview URL"; source reality is per-feature-branch stale URLs across 9 fallback sites.
2. FU-G brief Phase 2a example — included `https://` scheme; source consumes bare host (`https://${PREVIEW_HOST}/`), prepending scheme internally. Operator copy-paste would have broken every walk.
3. FU-G brief Phase 2b Purpose — described `scripts/cleanup/**` as "operations are destructive"; source includes `preview-test-data-sweep.mjs` which is DRY-RUN only per its file header.
4. FU-F body claim — "dotenv used by most scripts"; source has zero dotenv consumers; actual landscape is 5 inline parser patterns across 30 files (23 .mjs + 7 .cjs).
5. FU-H brief Phase 2c — prescribed "one-line summary" for "Where we left off" without consulting actual format; CONTEXT.md had a 4-paragraph multi-section structure that was collapsed before CC surfaced it via Rule 1.
6. FU-H Rule 16 wording — "fill commit" anchor for Current main HEAD is operationally impossible (chicken-and-egg); surfaced by hotfix #189 Phase 4 as the de-facto first application.

Five of six are brief-authoring; one is rule-authoring. Root cause: dispatcher (chat Claude) authors briefs/rules from assumptions about source rather than reading source first.

**Proposed resolution:** A new methodology rule (candidate Rule 17) mandating source-verification at authoring time for behavioral/example/format/path claims. Concretely: grep or read source before writing behavior descriptions; trace example values through actual call sites; confirm file paths and line numbers; read existing structural format before prescribing changes. Phase 1 remains as safety net; the primary verification surface shifts to authoring time.

**Severity:** LOW (no production impact; methodology drag only).

**Sequencing:** Rule 17 canonization is a future methodology PR (separate session). This entry banks the pattern for that session.

**Resolved in PR #192** (`23bf15d`, 2026-05-18). Rule 17 added to `CLAUDE.md` mandating source-verification at brief- and rule-authoring time for behavioral/example/format/path claims. Five-bullet enumeration covers default behavior, example values, file paths, structural format, and operational possibility of proposed wording. Rule 11 explicitly carved out as the specific case for FU-body diagnoses. Meta-paragraph at `CLAUDE.md:359` extended in same commit to cover both Rule 16 (missed during PR #188) and Rule 17 entries.

---

### FU-K — Stale local docs/* and chore/* branch cleanup sweep (LOW, housekeeping, RESOLVED 2026-05-18)

**Surface:** Local branches from merged brief-docs PRs and feature PRs accumulate after upstream pruning via GitHub's `deleteBranchOnMerge`. Currently: ~11 stale local branches from pre-2026-05-17 docs PRs plus today's branches (`docs/fu-g-brief`, `docs/fu-h-brief`, `chore/fu-g-script-readmes`, `chore/fu-h-rule-16`, `fix/weekly-activity-panel-test-tz`, and the just-merged `chore/bank-fu-j-fu-k`).

**Action:** Single sweep dispatch. (1) `git branch --merged main` to enumerate merged-locally branches. (2) Filter to exclude `main`, current branch, any active worktree branches. (3) `git branch -D` each stale entry. (4) `git remote prune origin` to clear any leftover remote-tracking refs.

**Severity:** LOW (housekeeping; no production impact, no methodology surface).

**Sequencing:** Anytime; XS execution; deferrable indefinitely without consequence.

**Resolved in PR #194** (`b195782`, 2026-05-18). Created `scripts/maintenance/prune-merged-branches.mjs` (idempotent, DRY-RUN default, `--execute` to delete) and `docs/runbooks/branch-cleanup.md` (mechanism explanation + three-step runbook + troubleshooting). **Rule 11 corrected diagnosis:** FU-K body's prescribed enumeration mechanism (`git branch --merged main`) is operationally broken under AgencyTrack's squash-merge workflow — squash-merge creates a new commit on main with a different SHA from the source branch's tip, so the source branch is not in main's ancestor chain. Verified live at brief authoring time: `git branch --merged main` returned `* main` only despite 16 stale local branches present. Corrected mechanism: after `git fetch --prune origin`, local branches with `[origin/X: gone]` upstream-tracking marker are the safe sweep candidates. Live-upstream branches (open PRs, closed-unmerged, pre-deleteBranchOnMerge legacy) are skipped. Stale remote-tracking refs without local counterparts are out of scope (remote mutation). First canonical Rule 17 application in the wild during brief drafting — source-verification at authoring time caught the broken mechanism before script implementation.

---

### FU-L — `prune-merged-branches.mjs` skip worktree-attached branches (LOW, housekeeping, RESOLVED 2026-05-18)

**Surfaced:** dogfood `--execute` run 2026-05-18 (post-FU-K PR #194 + FU-H PR #196 close). Script reported `error: cannot delete branch 'chore/fu-h-stale-row-sweep' used by worktree at 'C:/Projects/AgencyTrack-fu-h-sweep'`. Failed-1 OK-1, exit reflected partial failure cleanly.

**Mechanism:** `git branch -D` refuses to delete branches checked out in ANY worktree (not just current). Script's hard exclusion list covers `main` + current branch only. Worktree attachments invisible to the script.

**Proposed fix:** before classifying `[gone]`-upstream branches into stale list, parse `git worktree list --porcelain` to identify worktree-attached branches; move into skipped list with marker `(attached to worktree at <path>)`. Print operator guidance: use `git worktree remove <path>` to detach before sweeping.

**Rule 17 dogfood signal:** brief authoring (PR #194) mentally simulated the script's first invocation but didn't query `git worktree list` at the simulation step. Second canonical Rule 17 in-the-wild surfacing (after FU-K body's `git branch --merged main` mechanism in PR #194 brief drafting). Source-verification at authoring time would have caught this gap.

**Severity:** LOW. Script reports failure cleanly, doesn't crash; operator can manually `git worktree remove <path>` then re-run.

**Sequencing:** XS work PR. Open opportunistically — could pair with FU-F-2 in same session.

**Resolved in PR #200** (`4dd9bbd`, 2026-05-18). Added `parseWorktreeBranches()` helper to `scripts/maintenance/prune-merged-branches.mjs` parsing `git worktree list --porcelain`. Integrated into classification loop: worktree-attached branches are routed to the "NOT swept" list with marker `(attached to worktree at <path>)` BEFORE the `[gone]` check, preserving operator visibility and providing actionable guidance (`git worktree remove <path>` to detach + re-run). Runbook at `docs/runbooks/branch-cleanup.md` gains a new "Worktree-attached branches" section between "Branches with live upstream" and "Branches with no upstream". Phase 3 integration test created a throwaway worktree to validate the new logic at runtime — output confirmed `(attached to worktree at <path>)` marker rendered correctly. Closes the dogfood-surfaced gap from morning 2026-05-18 (`chore/fu-h-stale-row-sweep` deletion failure).

---

### FU-M — `multi-role-smoke.cjs` likely defunct: triage + remove or update (LOW, housekeeping, RESOLVED 2026-05-18)

**Surfaced:** FU-F audit re-run 2026-05-18 Section 7 finding #1. The script at `scripts/multi-role-smoke.cjs` reads legacy `Super_admin_login` / `Branch_Manager_login` / `Unit_Manager_login` env vars in non-canonical Title_Case naming, references the retired `super_admin` role (closed in user-mgmt PR-3, PR #28/#29). Not in `.env.example`.

**Failure mode (latent):** script would not execute correctly under current auth model (super_admin role retired post-May-5 refactor). Maintenance dead weight; risks confusion for future contributors.

**Proposed fix:** triage with Kyron — three options:
- (a) Update to canonical `A11Y_*` naming + use non-retired roles (Sales Manager / Branch Manager / Unit Manager / Agent / Tenant Admin).
- (b) Delete the script entirely (preferred if functionality is unused).
- (c) Confirm operational relevance with Kyron first; defer decision.

**Sequencing:** Triage XS, then either delete-PR or update-PR. Out of FU-F-2 scope (audit explicitly excluded). If decision is (b) delete, FU-F-2 `.cjs` migration target drops from 7 → 6.

**Severity:** LOW. Doesn't break shipping; just risks confusion + represents likely-dead code.

**Resolved in PR #202** (`a4fba56`, 2026-05-18). Phase 1 source-verification surfaced that `scripts/multi-role-smoke.cjs` was NOT tracked in git — file existed only in main worktree's local filesystem, excluded via `.git/info/exclude` line 8 (personal exclude file, not repo-shared `.gitignore`). Brief's "tracked" claim was incorrect — corrected diagnosis preserved here per Rule 11 drift-trail principle. Remedy: filesystem `rm` of the local file + cleaned up `.git/info/exclude` line 8 (both local-only operations, not in repo diff). Third canonical Rule 17 in-the-wild signal — caught at Phase 1 execution gate (safety net layer), not at brief authoring time (primary layer). Both layers of the discipline validated across the two-day arc. Audit miscounting (knock-on): FU-F audit (2026-05-17 + 2026-05-18 re-run) claimed 7 `.cjs` migration targets via `grep`; actual tracked `.cjs` count is 6 (multi-role-smoke.cjs was excluded-not-tracked all along). FU-F-2's brief should reflect 6 as migration target. Methodology refinement candidate: future audit enumerations should pair `grep` with `git ls-files` to distinguish tracked/untracked/excluded — flagged for separate banking, not absorbed here.

---

### FU-N — Audit enumeration: pair `grep` with `git ls-files` to distinguish tracked/untracked/excluded (LOW, methodology, RESOLVED 2026-05-18)

**Surfaced:** FU-M execution Phase 1 (PR #202, 2026-05-18). FU-F audit (2026-05-17 + 2026-05-18 re-run) enumerated `.cjs` parser sites via `grep -rn` alone, treating all matches as tracked migration targets. CC's Phase 1 source-verification caught `scripts/multi-role-smoke.cjs` was excluded-not-tracked via `.git/info/exclude` (personal exclude file, not repo-shared `.gitignore`). Additional dispatcher miscount in FU-M closure (claimed "6"; actual 5 — fixed in FU-F-2 Phase 4a closure paragraph per Rule 11).

**Mechanism:** `grep -rn` matches all files on filesystem regardless of git-tracked status. Audit consumers (brief authors) downstream assume tracked = migration target. Discrepancy creates phantom migration targets + dispatcher miscounts.

**Proposed fix:** future audit dispatches pair enumeration with `git ls-files` to filter to tracked-only files. Alternatively: use `git grep` which only searches index/tracked content. Update CLAUDE.md Rule 17 bullet list to add a "tracked-status verification" discipline OR bank as a Methodology Patterns note.

**Severity:** LOW (methodology refinement). Doesn't break shipping; causes audit downstream inefficiency + dispatcher miscounts. Phase 1 safety net catches the discrepancy (as proven in FU-M PR #202), but caught-at-authoring-time is preferred per Rule 17.

**Sequencing:** XS work PR — opportunistic. Could pair with future methodology batch (similar to PR #168) or stand alone.

**Resolved in PR #206** (`1d36436`, 2026-05-18). Added new sub-bullet to CLAUDE.md Rule 17 bullet list at position 4: "Enumeration tracked-status: when listing files via `grep -rn` to scope a migration or audit, pair with `git ls-files` (or use `git grep`) to filter to tracked-only paths. Untracked or excluded files appear in `grep` output but are not part of canonical repo state, and silently inflate migration-target counts in briefs." Closes the methodology gap surfaced via FU-M Phase 1 discovery (PR #202) + FU-F-2 brief authoring miscount (preserved as Rule 11 drift trail in FU-F-2 RESOLVED block per PR #204). **Seventh canonical Rule 17 in-the-wild signal — and the meta-application:** this very PR's brief was authored AFTER Kyron pasted current CLAUDE.md Rule 17 content (per Rule 17 itself), making FU-N the canonical example of source-verification at brief-authoring time refining the discipline it itself implements.

---

## ✅ /post-merge slash command discovery failure (LOW, methodology — banked 2026-05-19, PR #217 cycle) — CLOSED 2026-05-19 (PR #219 cycle, second data point)

**RESOLVED 2026-05-19 (PR #219 cycle, second data point).** Both `/dispatch` and `/post-merge` displayed "unrecognized" on operator CLI but executed cleanly CC-side across PR #217 (d84a752) /post-merge cycle and PR #219 (0b3f058) /dispatch + /post-merge cycle. Pattern confirmed — cosmetic dual-surface gap, not execution failure.

/post-merge slash command discovery failure (LOW, methodology — banked 2026-05-19, PR #217 cycle). During the first deployment of /post-merge as part of PR #217's post-merge sequence, the operator-facing CLI surface displayed the command as unrecognized despite the slash command system successfully injecting the .claude/commands/post-merge.md body into CC's context (CC executed the canonical sequence end-to-end and produced commit 0e390e8). Investigate: does .claude/commands/ require additional registration step (settings.json, CC restart, plugin reload)? Is the operator-side recognition mechanism distinct from the CC-side execution mechanism? Same investigation may apply to /dispatch. Next action: verify on the next dispatched PR whether /dispatch displays as recognized; if both commands fail operator-side recognition while still executing CC-side, document the dual-surface gap in CLAUDE.md § Dispatcher tooling.

Documented in CLAUDE.md § Dispatcher tooling > Known behavior. Tooling works as designed; only the CLI display is misleading.

---

## ✅ `@apply bg-[color:var(--color-X)]` sweep in `src/index.css` (LOW, refactor — banked PR #219, 0b3f058) — CLOSED 2026-05-18 (PR #221, e074b50)

**RESOLVED 2026-05-18**

Banked from PR #219 (0b3f058) audit. 4 call-sites in `src/index.css` `@layer components` definitions (`.btn-secondary`, `.card`, `.input`, `.label`) use `@apply` with arbitrary-value CSS-var syntax — out of scope for the JSX sweep that PR #219 addressed.

`@apply` resolution semantics may differ between arbitrary-value (`@apply bg-[color:var(--color-card)]`) and named-utility (`@apply bg-card`) syntax inside `@layer` rules. Requires verification that the compiled output is byte-equivalent before sweeping.

**Next action:** scratch-build verification — change one of the 4 call-sites to named utility, run `npm run build`, compare compiled `dist/assets/index-*.css` for that class rule against baseline. If equivalent, ship the sweep. If divergent, document the cause and leave as-is.

**Banked:** PR #219 (0b3f058).

Shipped via PR #221 (e074b50). Audit confirmed runtime-equivalent at default opacity; capability-additive (opacity-modifier support gained on `.card` / `.input` / `.btn-secondary` / `.label`). Bundle grew ~400 bytes — accepted. Channel-split tokens per PR-C-FU3 design preserved.
