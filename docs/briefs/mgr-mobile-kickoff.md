# Mobile FU#1 — Manager mobile experience — kickoff brief

**Status:** Ready to execute. Second of three Pilot Polish PRs (Wizard UX ✓ → **this** → Login logo + UX-N + BUG-N2).
**Estimated CC effort:** 1–2 days. Single PR (or split if discovery surfaces a much larger scope — Kelsean decides at Phase 3).
**Two-strike counter:** 0/2 (fresh session).

---

## Context

Branch managers, unit managers, sales managers, and tenant admins increasingly use the app from phones — during meetings, on the road between branches, between client visits. Currently the manager experience was built desktop-first; agent-side mobile is largely solid (wizard works at 380px), but manager screens have accumulating gaps.

**Per memory (item #17):** Mobile FU#1 mgr-mobile is tagged **HIGH priority, 1–2 days**. It's specifically the **manager-side** mobile experience (FU#2 covers non-core agent screens; FU#3 is the channel-split opacity refactor; FU#4 is final cosmetics).

**Prior context:** PR #36 was a "mobile audit" during the a11y arc. CC should READ the PR #36 description and surface what it covered vs what remained as follow-up. That output anchors Phase 2's scope — don't re-audit anything PR #36 already fixed.

**Discipline:** discovery → surface → approve → implement. CC does NOT touch code until Phase 4 is approved. The audit in Phase 2/3 is the most important phase of this work — getting the scope right matters more than the implementation.

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -3`. HEAD should include the PR #88 squash commit at top (or newer).
4. Confirm clean state: `git worktree list` shows only the main worktree. `git branch` shows only `main`.
5. Create worktree at `.claude/worktrees/feat-mgr-mobile` on branch `feat/mgr-mobile`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery + mobile audit

### 2a — Prior-work review

Before any new audit work, anchor against existing context:

1. Read the description of PR #36 (mobile audit) via `gh pr view 36`. Capture:
   - Which screens it audited
   - Which issues it fixed
   - Which issues it explicitly deferred to follow-ups
2. Read `docs/FOLLOW_UPS.md` and search for entries tagged "mobile", "FU#1", "mgr-mobile", "Mobile FU". Capture the documented gap list.
3. Read `CLAUDE.md` for any mobile-specific rules (touch targets, viewport conventions, breakpoints).

### 2b — Live audit (Playwright + screenshots)

Run a programmatic audit at mobile viewport (default 390x844, matching iPhone 14 dimensions used elsewhere in the project per CLAUDE.md or memory). Use the canonical bypass pattern from `scripts/exploration-walk.cjs` (URL parameter approach, `x-vercel-set-bypass-cookie=samesitenone`, `waitUntil: 'domcontentloaded'`, never log the token).

**Audit script behavior:**

- Reads `VERCEL_BYPASS_TOKEN` via `dotenv` from `C:\Projects\AgencyTrack\.env.local`
- Logs in once as a test branch manager (use a real test branch manager account — Kelsean: confirm credentials or use `kelsean@gmail.com` agent path if no manager test creds; this is a discovery script, the audit findings matter, not the role-specific behavior)
- Navigates through every manager screen reachable from the manager dashboard nav:
  - Overview / Manager Dashboard landing
  - Team
  - Campaigns
  - Production Report
  - Awards
  - Master Sheet
  - Compliance
  - Persistency (top-level + entry sub-view)
  - Goals
  - Settlements
  - Leaderboard
  - Profile
- For each screen:
  - Screenshot at 390x844 (mobile portrait)
  - Capture any console errors
  - Run a programmatic check for common mobile issues:
    1. Horizontal scroll on the document body (`document.documentElement.scrollWidth > window.innerWidth`)
    2. Touch targets smaller than 44px (query all `button`, `a`, `[role="button"]`; check `getBoundingClientRect()` width/height)
    3. Text overflow (text-clamp violations, ellipsis applied where it shouldn't be, content cut off)
    4. Off-screen elements (any element with `getBoundingClientRect().right > window.innerWidth` is suspicious)
    5. Tap-blocked elements (elements with `pointer-events: none` overlaying interactive ones)
  - Note any interactions that are obviously broken (e.g., sidebar can't open, modal goes off-screen, scroll-locked body)

Screenshots go to a worktree-local gitignored directory (e.g. `verification/mgr-mobile-audit/`).

### 2c — Manual spot-checks (optional, if time permits)

Some mobile issues only surface from real interaction:
- Sidebar collapse/expand
- Modal open/close + interior scroll
- Long lists (Persistency agent list, Settlements rows)
- Form modals (Persistency entry, Goals entry)

Capture screenshots of these too if you spot issues.

---

## Phase 3 — Surface audit findings (STOP HERE)

Output a single structured summary in chat. Use this template verbatim:

```
DISCOVERY — Mobile FU#1 mgr-mobile

Prior work context:
- PR #36 audited: <list of screens>
- PR #36 fixed: <list of issues>
- PR #36 deferred (in FOLLOW_UPS): <list>

Live audit results:

Per-screen findings:

OVERVIEW / MANAGER DASHBOARD
  Issue 1: <description>
    Severity: P0 / P1 / P2
    Screenshot: <path>
    Proposed fix: <one-line>
    File(s) to touch: <list>
  Issue 2: ...

TEAM
  ...

PERSISTENCY
  ...

[... and so on for each screen]

Cross-cutting issues (apply to multiple screens):
- <e.g., navbar overlap on scroll>
- <e.g., notification dropdown off-screen>

Severity summary:
- P0 (blockers — unusable on mobile): <count>
- P1 (important — degraded UX, frustrating but workable): <count>
- P2 (polish — looks rough but functional): <count>

Estimated scope:
- Files modified: <count>
- New files: <count>  
- New tests: <count> (note: mostly visual changes, test surface is limited)
- Risk assessment: <low/medium/high + why>

Out-of-scope candidates surfaced during audit (NOT for this PR — recommend follow-up entries):
- <e.g., "real device testing on iOS Safari shows different sidebar behavior — FU#5 candidate">
- <e.g., "manager-dashboard landing card grid wants a 2-up to 1-up transition with animation — FU#6 candidate">

Recommendation:
- Suggested scope for this PR: <e.g., "all P0 + most P1; defer P2 to Mobile FU#4 cosmetics">
- Or: "scope too large for single PR — recommend splitting"
```

**STOP at end of Phase 3.** Do not write any code. Wait for Kelsean's response: approval, scope re-cut, defer-some-items decision.

---

## Phase 4 — Implement (only after approval)

Implement per Kelsean's approved scope. Constraints:

1. **Stay surgical.** Don't refactor adjacent code "while you're in there." If a file has 3 issues and 1 is in scope, fix only the 1 — surface the other 2 for separate handling.
2. **Use existing Nexus tokens.** No hardcoded colors. No new theme tokens unless absolutely necessary (and surface to Kelsean first if needed).
3. **44px minimum touch targets.** Per project convention (memory + CLAUDE.md). If an existing touch target was undersized, bumping it to 44px is in scope.
4. **Responsive utilities preferred over custom CSS.** Tailwind's `sm:` / `md:` / `lg:` breakpoints exist for a reason. Custom media queries only when there's no clean utility.
5. **No source code changes outside the audit findings.** No drive-by lint fixes, no "improving" component structure, no adding props that "would be useful."
6. **No new dependencies.** If a fix wants a new lib (e.g., `react-use-mediaquery`), STOP and surface.
7. **Match existing patterns.** Functional components, useMemo/useCallback for expensive calcs, no inline styles.
8. **Dark mode parity.** Every visual fix must work in both light and dark themes. Spot-check both in the smoke.

---

## Phase 5 — Tests

Mobile fixes are mostly visual — heavy testing is limited. Where tests make sense:

1. **Responsive utility application:** if a component conditionally renders different layouts at different viewports, a JSDOM test can verify the right element appears at the right `window.innerWidth`. Use existing RTL test patterns from `WizardFormSaveStatus.test.jsx` (the first RTL test set, added in PR #88).
2. **Touch target sizes:** consider adding a single regression test that asserts critical interactive elements meet 44px at mobile viewport. May overlap with what `scripts/exploration-walk.cjs` could already check — extend rather than duplicate.
3. **Existing test suite:** `npm test` must remain 100% passing.

If the test surface for the approved scope is genuinely small (< 3 new test cases warranted), skip and document in PR description — visual fixes don't need fabricated tests.

---

## Phase 6 — Production smoke (new standard)

Apply the smoke standard, mobile-viewport flavor.

### Pre-merge smoke (mandatory)

Run against the Vercel preview URL after pushing the branch. Use the canonical bypass pattern (URL parameter, `samesitenone`, `domcontentloaded`).

1. Launch Playwright with mobile viewport (390x844).
2. Log in as test branch manager (or use agent test account if no manager creds available — confirm with Kelsean in Phase 3).
3. Navigate through every screen that was modified.
4. For each screen:
   - Verify horizontal scroll absent
   - Verify the specific issue(s) fixed are now visually correct (screenshot)
   - Verify no console errors
5. Dark mode pass: toggle dark mode, navigate through the same screens, screenshot.
6. **Real interaction check:** pick ONE meaningful interaction per fixed screen (open a modal, click a tab, scroll a list) and confirm it works at mobile viewport.

### Post-merge production smoke (mandatory)

Same procedure but against production URL after merge + Vercel rebuild. No bypass needed for production.

Both smokes' results documented in PR body (preview) + reported in chat after merge (production).

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit (one or more conventional commits — logical chunks):
   ```
   feat(mobile): manager mobile experience hardening — <brief scope summary>

   Audit context:
   - Built on PR #36 (mobile audit, agent-side fixes)
   - Audited screens: <count>
   - Issues found: P0=<n> P1=<n> P2=<n>
   - This PR addresses: <P0 + P1 / scope as approved>

   Sub-changes:
   - <Screen 1>: <change>
   - <Screen 2>: <change>
   - ...

   Out of scope (added to follow-ups):
   - <items>

   Tests: <count> new, <total> passing
   Pre-merge smoke: PASS at 390x844 (light + dark)
   ```
5. Push, open PR titled: `feat(mobile): manager mobile experience hardening`
6. PR description MUST include:
   - Audit summary table (screen → issues found → fix applied / deferred)
   - Before/after screenshots for each significant fix
   - Pre-merge smoke results (light + dark, screenshots)
   - Test count + names
   - Explicit follow-ups for deferred items (so the housekeeping PR after this can close them or carry them forward)
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 3 reveals scope > 12 files modified OR > 25 distinct issues → STOP and surface; we'll cut scope before implementing
- Audit reveals a fundamental responsive architecture issue (e.g., the layout system itself can't handle mobile without significant refactor) → STOP and surface; that's a separate effort, not Pilot Polish
- Any test suite regression on existing tests → STOP
- Any new npm dependency desired → STOP and surface
- Pre-merge smoke fails on the happy paths covered by the audit → STOP and surface
- Bypass token issue (token doesn't work / cookie isn't set) → STOP and read `scripts/exploration-walk.cjs` for the canonical pattern before retrying; don't burn time on workarounds
- Two strikes hit → STOP

---

## Out of scope

- Agent-side mobile fixes (Mobile FU#2 is the agent-side follow-up)
- Channel-split opacity refactor (Mobile FU#3, separate scope)
- Final cosmetics (Mobile FU#4, separate scope)
- Login logo work (PR #3 of Pilot Polish, separate)
- BEH-1 welcome screen copy
- Any backend / Firestore / rules changes
- Walk script changes (WALK-1, separate)
- Real-device testing (audit is desktop-Playwright at mobile viewport; real iOS Safari / Android Chrome behavior is outside this PR's tooling)
