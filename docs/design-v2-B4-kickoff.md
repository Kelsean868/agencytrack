# AgencyTrack Session Kickoff — Design v2 PR B4 (Desktop Sidebar Shell + Mobile Drawer)

> **For Kyron:** This is the prompt to paste into a fresh Claude Code session to start PR B4. Copy from the line below all the way down. The prompt is self-contained — Claude Code will read the right files and produce a plan before writing any code.
>
> **B4 is the largest structural change in the B-series.** The sidebar shell wraps every dashboard, touches `App.jsx`, and changes layout for all 5 roles. The verification matrix is 5 logins × 4 breakpoints × 2 themes = 40+ render checks. Build the verification protocol into the brief explicitly — this is not a generic "verify on preview" pass.
>
> When B4 ships, duplicate this file (`design-v2-B5-kickoff.md`) and adjust §Session scope, §Files to read, and §Decisions locked for B5 (Tenant Admin Config). §Hard rules and §Discipline gates stay the same.

---

## ✂ COPY FROM HERE ✂

# AgencyTrack Session Kickoff — Design v2 PR B4 (Desktop Sidebar Shell + Mobile Drawer)

## Step 0 — Read these in order, do not skip
1. `CLAUDE.md` — static project rules (code style, domain rules, theme system, workflow). Pay attention to the post-merge protocol (steps 9 and 9.5) and the new `git branch -D` rule banked into B4's first commit (see §Session scope).
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. **CONTEXT.md overrides CLAUDE.md where they differ — it's newer.**
3. `docs/design-v2-PRD.md` — product requirements for the redesign. Read fully. Pay attention to:
   - § 3.1 Cross-cutting (sidebar nav shell, top bar, mobile bottom nav, theme toggle persistence)
   - § 3.2–3.6 (per-role dashboard surfaces — defines the nav items per role, even though B4 does not redesign the dashboards themselves)
   - Q6, Q7, Q8 in § 7 Open questions (sidebar collapsed width, theme toggle location, manager bottom-nav per role)
4. `docs/design-v2-implementation.md` — phased PR plan. Focus on the **PR B4** section.
5. `mocks/concept-4-complete.html` — canonical visual source of truth. Locate:
   - The sidebar shell markup (search `.sidebar`, `.sidebar-link`, `.desktop-content`, `data-screen=`)
   - Each role's dashboard wrapper (search `data-screen="agent"`, `data-screen="unit"`, `data-screen="branch"`, `data-screen="sales"`, `data-screen="tenant"` or equivalent)
   - The mobile bottom-nav block + drawer/hamburger pattern if present
   - The g4-mix layout (`.g4-mix`, `grid-template-columns: 1.6fr 1fr`) — B3 deferred this to B4
6. **B-series retrospectives** — read inline notes in `design-v2-implementation.md` for B1 / B2 / B3, plus PR #49 (B3 retrospective in `docs/CONTEXT.md` § Where we left off) and PR #50 retrospective (post-merge cleanup tightening + branch sweep). Three lessons apply directly:
   - Speculative file listings in the implementation plan are **starting hypotheses, not directives**.
   - Mock-vs-code surface-gap audit before any code.
   - Honest data-availability check — don't fabricate routes, accounts, or data the codebase doesn't actually have.

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match the SHA in `docs/CONTEXT.md` § Current main HEAD. If either fails: STOP, surface in chat, do not absorb the discrepancy. (Per the audit-on-arrival safeguard introduced in PR #42 — B1, B2, and B3 each ran this check; B1 caught CONTEXT.md drift, B2 + B3 caught nothing because the protocol had self-corrected. B4 still runs it; the protocol is the value, not the find.)

## Session scope

**In scope (PR B4 only):**

- **Sidebar shell wrapping every dashboard.** Touches `src/App.jsx` and the chrome layout of `AgentDashboard.jsx` + `ManagerDashboard.jsx`. Mock canonical reference: `mocks/concept-4-complete.html` sidebar markup (locate during audit). Sidebar at 240px on desktop (≥1024px), collapsed icon-only at 72px on tablet (768–1023px), hidden + replaced by mobile drawer below 768px. Persistent collapse/expand state on desktop via `localStorage.agencytrack-sidebar-collapsed` (mirror existing `agencytrack-dark` pattern).
- **Mobile drawer pattern.** Hamburger trigger in topbar. Slide-in from left below 768px. Backdrop dismisses. `<dialog>` or accessible custom drawer — audit confirms the cleanest path.
- **Active route highlighting.** Sidebar knows current dashboard view, highlights the matching nav item. Wires into the **existing tab state** — both `AgentDashboard` and `ManagerDashboard` use `useState`-driven tab systems today (no React Router). Sidebar plugs into that state, doesn't replace it.
- **Role-based nav visibility.** Agent sees a different sidebar than unit_manager / branch_manager / sales_manager / tenant_admin. Items per role per `design-v2-implementation.md` § B4 Sidebar items per role + the mock. Items routing to surfaces that don't exist in the codebase yet are surfaced as decisions (stub link? hide? defer to B5?), not silently rendered.
- **Deferred g4-mix 2-col layout from B3.** Activity Feed + Achievements side-by-side at desktop (≥1024px), stack vertically below. Inherits from B3's S2 deferral. Verify the new sidebar geometry doesn't compress the dashboard's content area below the g4-mix's effective minimum width before shipping.
- **CLAUDE.md `git branch -D` rule** (banked from PR #50 retrospective) bundled into B4's **first commit** alongside the standard CONTEXT.md SHA bump. Framed as standard post-merge sequence, not exception. Wording per the post-PR-#50 banking (see §Decisions locked).

**Out of scope (do not expand into):**
- Tenant Admin Config — B5
- Manager-side feature work beyond nav visibility (no new manager dashboards, no new manager-only views, no redesigned manager surfaces beyond the shell wrap)
- New Firestore collections, queries, or schema changes
- Wizard or Step files (per CLAUDE.md, never touched)
- Any redesign of existing dashboards beyond the sidebar wrap and the g4-mix layout absorption
- **Routing library swap.** If a router exists, use it as-is. If no router exists (audit will confirm), B4 cannot introduce one — surface as a decision-point. The implementation plan calls this out: "do not introduce React Router yet."
- Notification drawer redesign (PRD § 4 Out of scope — only the topbar bell visual updates if the audit confirms it needs to)
- Search field functionality — placeholder only is acceptable per PRD Q7 default
- Audit Log surface — deferred-data stub only, no Cloud Function triggers
- Activity feed / BadgeGrid (B3-locked) — B4 does not modify these components, only their layout container if g4-mix absorbs them
- Goal carousel / donut behavior (B2-locked)
- Medal badge tokens or gradient classes (B1-locked)

**Files Claude Code should read for the audit (starting points only — the actual change set comes from the audit, not from `docs/design-v2-implementation.md` § B4 Files):**

- `src/App.jsx` — confirm the role-branching pattern that decides which dashboard renders. Identify the wrap-point for `<Shell role={...}>`. Note: any tenant_admin / platform_admin branching also lives here.
- `src/components/dashboard/AgentDashboard.jsx` — locate the existing header (`<header>` with sign-out, dark-mode toggle, NotificationBell, SyncIndicator) and tab bar (`<nav aria-label="Dashboard sections">`). These move to the Shell's TopBar; the dashboard keeps content + scroll container only.
- `src/components/dashboard/ManagerDashboard.jsx` — same exercise. Manager tab bar is wider than agent's (`max-w-5xl mx-auto` vs agent's `max-w-2xl`). Confirm shell width math doesn't crowd manager tables (`MasterSheet.jsx` 23-column grid, `SettlementPanel.jsx` three grids).
- `src/index.css` — locate `:root` and `.dark` blocks for shell/sidebar/topbar token additions. Locate end of file for new class block (B1 → B2 → B3 each appended; follow the pattern).
- `mocks/concept-4-complete.html` — lift sidebar / topbar / mobile-drawer CSS verbatim. Identify per-role nav item lists. Confirm whether the mock has a per-role mobile bottom-nav (PRD Q8 default: yes) or just one universal bottom-nav.
- `package.json` — **verify whether a router exists.** Search for `react-router`, `react-router-dom`, `@remix-run/router`, `wouter`, etc. If absent, confirm the active-route highlighting hooks into existing `useState` tab systems on both dashboards. If a router IS present (unlikely but possible — audit confirms), the active-route detection uses that.
- `tailwind.config.js` — confirm any utilities the shell needs aren't purged.
- `src/context/AuthContext.jsx` — confirm `role` and `tenantId` are reliably available where the shell renders (App.jsx).
- `src/components/ui/NotificationBell.jsx` — confirm prop signature so it slots into TopBar without changes.
- `src/components/ui/SyncIndicator.jsx` — same.
- `scripts/exploration-walk.cjs` — read the post-B3 assertion structure (step 3 = `text=Recent Activity`). B4 may need additional assertions for the sidebar landmark; design those during audit.

> **B1 + B2 + B3 retrospective audit lesson — apply here:** `docs/design-v2-implementation.md` § B4 lists `Shell.jsx`, `Sidebar.jsx`, `TopBar.jsx`, `MobileBottomNav.jsx` as files to create plus `App.jsx` / both dashboards / `index.css` to modify. Treat all of this as **starting hypotheses, not directives.** Audit the actual current state. B1 corrected `AgentAwardsPanel.jsx` / `ManagerAwardsPanel.jsx` listings (PR #45). B2 corrected `personalCommitment` → `personalAnnualAPI` and `extractFields.api` → `extractFields.apiSold`. B3 caught `MotivationalCarousel.jsx` was not orphaned (`ManagerDashboard.jsx:24,247` still consumed it). B4's equivalent corrections will likely cluster around routing, role-aware shell branching, or sidebar items routing to surfaces that don't exist yet.

> **B1 + B2 + B3 retrospective surface-gap lesson — apply here:** Confirm the mock's sidebar surfaces actually exist on every role's dashboard. The mock shows nav items like "Reports," "Audit Log," "Billing" — some of these have no corresponding route in the codebase. Surface every gap as a decision (stub link / hide / defer), don't silently render dead items. **The verification matrix is 5 roles × 4 breakpoints × 2 themes = 40+ render checks.** Build that into the audit explicitly — every role's dashboard needs to render correctly under the new shell.

> **Honest data-availability check (B3 lesson):** If a sidebar nav item routes to a surface that doesn't exist (e.g., "Reports" tab when no reports route exists), surface as a scope decision before coding. Do not fabricate destinations. Do not stub a route to a 404 component.

## Decisions locked — do not re-litigate

These are settled before the session starts. If the audit surfaces a reason to revisit, treat it as a surprise-stop — do not unilaterally override.

### Layout breakpoints
- **Desktop (≥1024px):** sidebar 240px expanded, dashboard content area takes the rest.
- **Tablet (768–1023px):** sidebar collapses to 72px icon-only.
- **Mobile (<768px):** sidebar hidden; mobile drawer triggered by hamburger in topbar; mobile bottom-nav present.
- **Mobile navigation surface count:** the above implies *two* navigation surfaces at <768px (drawer triggered by hamburger + bottom-nav). PRD Q8 default is "yes — mobile bottom-nav per role." If the mock shows only one surface (drawer-only or bottom-nav-only), surface as a decision-point and reconcile against PRD Q8 before locking. **Don't render both if the mock shows one.**

Per `docs/design-v2-implementation.md` § B4 Responsive behavior. The mock breakpoints arbitrate any ambiguity.

### Routing strategy
- **Do not introduce a router.** The codebase uses `useState`-driven tab systems on both `AgentDashboard.jsx` and `ManagerDashboard.jsx` today. Sidebar items hook into that state via callback props.
- If the audit shows a router IS present (unexpected), **surprise-stop** and surface — the integration approach changes materially.
- URL routing / deep-linkable dashboard tabs are a future ticket, not B4.

### Theme toggle relocation
- Moves from each dashboard header to the Shell's TopBar (right side, before NotificationBell). PRD Q7 default.
- `localStorage.agencytrack-dark` key + `dark` class on `documentElement` stay unchanged.
- The toggle's reduced-motion guards already exist; don't re-add them.

### Sidebar collapse/expand state
- Persistent on desktop via `localStorage.agencytrack-sidebar-collapsed` (mirror existing dark-mode pattern).
- Restored before React mount in `src/main.jsx` to prevent FOUC (mirror dark-mode restoration at `src/main.jsx`).
- Toggle button has `aria-expanded={!collapsed}` and `aria-label="Toggle sidebar"`.

### Mobile drawer behavior
- Slide-in from left, backdrop dismiss.
- **Escape closes** the drawer (a11y).
- **Focus trap when open** — first focusable element receives focus on open; last → first cycles via Tab; first → last via Shift+Tab.
- Returns focus to the hamburger trigger on close.
- `aria-modal="true"`, `role="dialog"`, `aria-label="Navigation menu"`.
- Reduced-motion guards on the slide animation: `@media (prefers-reduced-motion: no-preference)` wraps the transform transition; reduced-motion users get an instant snap.

### Sidebar items per role
- **Agent:** Dashboard · Career · Awards · Leaderboard · History · Profile (mirrors the existing TabBar `TABS` array — no fabricated items).
- **Unit Mgr / Branch Mgr / Sales Mgr / Tenant Admin:** mirror the manager TabBar's existing tabs (Overview / Team / Campaigns / Awards / Master Sheet / Compliance / Persistency / Goals / Settlements / Leaderboard / Profile per `ManagerDashboard.jsx` post-B3). The mock's "Reports", "Audit Log", "Billing", etc. items must be **audit-confirmed against existing dashboard tabs**. Anything that doesn't map to an existing surface is surfaced as a decision, not silently added.
- Sidebar item ordering follows the mock; semantic grouping (`Workspace` / `Manage` / `Tools` etc.) per the implementation plan if the existing tab labels fit those buckets — otherwise flat list.

### Active-route detection
- Wires into the dashboard's existing `activeTab` state (both dashboards expose this). Sidebar receives `activeTab` + `setActiveTab` as props.
- Active item gets `aria-current="page"` and a visual highlight (per mock).

### Token naming
- All new CSS variables use the `--color-*` prefix (B1/B2/B3 retrospective — locked). E.g., `--color-sidebar-bg`, `--color-sidebar-link-active`. No `--sidebar-*` / `--shell-*` style names.
- Add tokens to BOTH `:root` and `.dark` blocks. Light + dark designed together.
- **Reuse existing semantic tokens where possible:** `--color-surface`, `--color-surface-muted`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-primary-tint`, `--color-border`. Only add new tokens for surfaces that don't fit existing roles.

### A11y — bake in from the start (B1/B2/B3 retrospective lesson)
- **Landmark roles:** sidebar = `<aside>` or `<nav aria-label="Primary navigation">`. TopBar = `<header role="banner">` or just `<header>`. Main content area = `<main>` (already exists per `[2a]` walkthrough check; do not duplicate).
- **Single-`<main>` invariant** — `scripts/exploration-walk.cjs` step 2a asserts exactly one `<main>` per dashboard. The shell must keep this true. If the existing dashboard `<main>` moves into the shell, the dashboards must drop theirs.
- **Keyboard:** sidebar items are keyboard-reachable in DOM order. Focus rings visible (`focus-visible:ring-2 focus-visible:ring-primary/40` per existing pattern).
- **Drawer:** Escape closes; focus trap when open; focus returns to trigger on close.
- **ARIA expanded:** sidebar collapse toggle uses `aria-expanded`. Mobile hamburger uses `aria-expanded` + `aria-controls` pointing at the drawer's id.
- **Reduced motion:** drawer slide, sidebar collapse animation, any new transition wrapped in `@media (prefers-reduced-motion: no-preference)`.
- **Color contrast:** active sidebar item, active mobile bottom-nav item, hamburger icon — all ≥ 4.5:1 against their backgrounds in both modes. Audit dark-mode active-item colors specifically.
- **Heading hierarchy:** B3 introduced `<h3>` "Recent Activity" / "Achievement Badges" alongside existing `<p class="text-xs uppercase">` fake headings (logged in `docs/FOLLOW_UPS.md`). B4 should not regress this — keep `<h1>` "AgencyTrack" → `<h2>` per dashboard → `<h3>` per section. If the shell's TopBar changes the `<h1>` location, surface as a decision.

### Project-wide policy (recap)
- Lucide React for icons (sidebar items, hamburger, collapse chevron).
- No emojis as structural icons.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`).
- Both light and dark mode tested before opening PR.
- Verification artifacts stay local — never commit.

Plus everything in `docs/CONTEXT.md` § Locked decisions.

### CLAUDE.md banked rule (lands in B4's first commit)
Append to CLAUDE.md Session Protocol post-merge section, alongside step 9.5:

> **Post-merge local branch cleanup:** After `git pull` and squash-SHA capture, run `git branch -D <feature-branch>`. With `deleteBranchOnMerge: true` enabled on the repo, the remote tracking ref is pruned automatically before local cleanup runs, so `git branch -d` (lowercase) cannot verify merge status and will refuse. `git branch -D` is the correct tool here — the squash SHA captured one step earlier verifies the diff is preserved in main. Reference: PR #50 retrospective, B3 post-merge.

Frame as standard post-merge sequence, not exception. Bundled into the same commit as the CONTEXT.md SHA bump (commit 1).

## What to do first

**Option A — Plan first (use this for B4):**

> Do not write code yet. Produce a work plan in chat covering:
>
> 1. **Audit current state vs scope.** Read the files listed in §Session scope. Confirm:
>    - Whether a router exists in the codebase. Surface `package.json` dependency listing.
>    - The exact `useState`-driven tab system on each dashboard (`AgentDashboard.jsx` and `ManagerDashboard.jsx`) — name the state variable, the setter, and how it's currently consumed by the existing TabBar.
>    - Where the existing dashboard headers (`<header>` with sign-out, dark-mode, NotificationBell, SyncIndicator, etc.) live, and what's safe to lift into the Shell vs what must stay per dashboard.
>    - Whether the existing single-`<main>` invariant survives the shell wrap (no duplicate `<main>` elements). The walkthrough step `2a` asserts exactly one — confirm the shell keeps it true.
>    - The mock's sidebar items per role vs the live tab labels per dashboard. Per-role gap analysis (mock has X, live has Y, what's missing/extra).
>    - Whether mobile bottom-nav per role (PRD Q8) — the mock arbitrates.
>    - Whether the g4-mix 2-col absorption fits within the new dashboard content-area geometry. AgentDashboard's existing `max-w-2xl mx-auto` cap may need to lift to `max-w-5xl` (or be dropped entirely) at desktop. Surface the math.
>    - `src/main.jsx` — confirm the dark-mode pre-mount restoration pattern, and design the equivalent sidebar-collapse pre-mount restoration to match.
>    - **Test account discovery.** Confirm whether test accounts exist for each non-agent role: `unit_manager`, `branch_manager`, `sales_manager`, `tenant_admin`. The agent test account is `kelsean@gmail.com` (in `.env.local` as `A11Y_AGENT_PASSWORD`). The other 4 are unknown. **If 1+ accounts don't exist, surface as a discovery — Kyron provisions them before code starts.** This is an audit-phase deliverable, not assumed.
>    - Heading hierarchy across all 5 dashboards under the shell. Where does each dashboard's `<h1>` live today? Does the shell's TopBar move it? No skips — `<h1>` → `<h2>` → `<h3>` only.
>    - Whether `scripts/exploration-walk.cjs` needs any new assertions (sidebar landmark, hamburger button, drawer dialog) or just the existing step 2a single-`<main>` guard surviving.
>    - The existing TabBar component(s) on each dashboard. Under the new shell, does the existing TabBar (a) transform into the mobile bottom-nav, (b) get deleted in favor of a new `MobileBottomNav` component, (c) survive only at mobile breakpoints, or (d) something else? **The mock arbitrates.** If the mock shows the existing TabBar disappearing entirely with no equivalent at mobile, surface as a structural decision.
>
> 2. **Mock-vs-code parity check across all 5 roles.** For each role, confirm:
>    - The mock's dashboard renders correctly inside the shell at the role's expected breakpoints.
>    - The mock's sidebar items map 1:1 to existing tab labels in the live `ManagerDashboard.jsx` / `AgentDashboard.jsx`. Surface every mismatch (item routes to nothing, item missing from mock, etc.) as a decision-point.
>    - The mock's mobile bottom-nav per role matches what the existing dashboards render at narrow widths.
>
> 3. **File-by-file change map** with risk assessment per file. Distinguish "additive" (new shell files, new tokens, new CSS class block) from "structural" (`App.jsx` wrap, dashboard chrome removal) from "tooling" (`scripts/exploration-walk.cjs` if applicable). For any file in the implementation plan's B4 list that the audit shows is unrelated, drop it from the change set with a one-line justification.
>
> 4. **All-roles preview matrix plan.** Explicitly enumerate the 40+ render-state checks: 5 roles × {1440px, 1024px, 768px, 390px} × {light, dark}. For each cell: which screenshot, which assertion, which interaction (drawer open/close, collapse toggle, active-item highlight). Build this as the verification protocol before code starts — don't improvise it during preview verification.
>
> 5. **A11y verification plan.** Sidebar landmark roles. Drawer focus trap (focus-visible cycling test). Escape-closes test. ARIA expanded for collapse + hamburger toggles. Reduced-motion check on drawer slide. Active-item contrast at light + dark for every nav state. Heading hierarchy across all 5 dashboards.
>
> 6. **g4-mix absorption decision.** AgentDashboard's max-w-2xl cap may collide with the 2-column desktop layout. Surface options: lift cap to max-w-5xl at ≥1024px? Drop cap entirely under shell (shell controls width)? Keep stacked on AgentDashboard, only apply g4-mix at ≥1024px? Make a recommendation, justify briefly.
>
> 7. **Routing strategy decision.** Confirm no router exists. Confirm the sidebar-prop pattern (sidebar receives `activeTab` + `setActiveTab` from each dashboard). Surface any case where this won't work (e.g., if the shell needs to know `activeTab` before the dashboard renders, which would invert the dependency).
>
> 8. **Test-account discovery report.** List which roles have working test accounts and which don't. If any are missing, surface explicitly — this blocks preview verification, not code. If 1+ accounts can't be provisioned at all (e.g., Kyron lacks admin permissions to create `tenant_admin` in the pilot tenant), surface options before defaulting to "block B4": (a) block B4 entirely until provisioning resolves, (b) accept narrower verification with explicit risk acceptance for un-verifiable roles documented in the PR description, (c) split B4 into agent-side ship first + manager-side verification as a follow-up PR. Don't auto-decide. Kyron picks based on what's actually blocked.
>
> 9. **Open questions for me to answer before code starts.** Especially: routing strategy edge cases, g4-mix absorption choice, sidebar items routing to non-existent surfaces, test-account provisioning, anything mock-vs-code surfaces.
>
> I'll review and approve before any code is written.

## Autonomous scope — what Claude Code can do without further check-in (after plan approval)

> 1. Sync main: `git fetch origin && git pull origin main` (per locked feedback memory).
> 2. Create worktree branch off `origin/main` HEAD (verify SHA against `docs/CONTEXT.md`).
> 3. **First commit on the branch must bundle the CONTEXT.md SHA bump AND the CLAUDE.md `git branch -D` rule** (banked from PR #50 retrospective — see §Decisions locked § CLAUDE.md banked rule). Single commit, conventional title `chore(docs): bump CONTEXT.md to <sha> + CLAUDE.md branch-D post-merge rule`.
> 4. Implement changes per the approved plan.
> 5. `npm run lint && npm run build` — must both pass.
> 6. Commit (conventional commits, per CLAUDE.md). Suggested sequence: CONTEXT.md+CLAUDE.md bump → token additions → shell CSS block → `Shell.jsx` (or whatever the audit lands on) → `Sidebar.jsx` → `TopBar.jsx` → mobile drawer → `App.jsx` wrap → AgentDashboard chrome removal → ManagerDashboard chrome removal → g4-mix absorption on AgentDashboard.
> 7. Push to feature branch.
> 8. Open PR titled `feat(design-v2-b4): desktop sidebar shell + mobile drawer` with description covering: scope, file count breakdown, all-roles preview matrix verification (5 × 4 × 2 = 40+ checks listed), dark-mode verification per role, drawer focus-trap verification, reduced-motion verification, a11y verification, g4-mix absorption result, open follow-ups for B5.
> 9. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh <sha> --target preview --pr <PR#>`.
> 10. Run preview walkthroughs **for every role's test account**. The exploration-walk script today logs in as the agent only — for B4, run the agent walkthrough plus manual login + screenshot per non-agent role per breakpoint per theme. If `scripts/exploration-walk.cjs` is extended in B4 to support multi-role, run that. Otherwise run the agent walkthrough programmatically and capture the other 4 roles via manual screenshots wired into the PR description.
> 11. Post all-roles walkthrough summary in PR comments. Include: per-role render confirmation at all 4 breakpoints in both modes, sidebar landmark a11y check, drawer focus-trap manual confirmation, reduced-motion check, single-`<main>` survival per role.
> 12. **STOP at preview-verified.** No merge. Kyron merges manually.

## Hard rules — non-negotiable, applies every session

- **Worktree branch only.** Never push directly to `main`. Branch off `origin/main` HEAD.
- **Always pull main before branching:** `git fetch origin && git pull origin main` (per existing feedback memory).
- **No auto-merge.** Push → PR → preview Ready → all-roles walkthrough → STOP for human merge.
- **Post-merge verification (tightened in PR #50):** `git fetch origin && git pull origin main && git log origin/main --oneline -5` to confirm squash SHA — the pull is required so worktree-local tooling matches production. Then production walkthrough via `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=design-v2-b4_production`. The production walkthrough should pass the same shell-aware assertions as the preview walkthrough.
- **Worktree teardown after merge.** `git worktree remove <path>` then `git worktree prune`. **Local branch deletion uses `git branch -D <feature-branch>`** (force) — auto-delete on merge prunes the remote tracking ref before local cleanup, so lowercase `-d` cannot verify merge status. The squash SHA captured one step earlier proves the diff is preserved in main. (This is the rule landing in B4's first commit.)
- **Never echo `.env.local` values** to chat output, PR comments, logs, or screenshots. Reference by env var name only.
- **Verification artifacts stay local.** Logs, screenshots, one-off verification scripts — never commit.
- **No emojis as structural icons.** Lucide React only.
- **No hardcoded hex outside CSS variables** (except `AgentReportDocument.jsx`).
- **All new tokens use `--color-*` prefix** (B-series locked).
- **Implement the mock faithfully — do not redesign.** Sidebar markup and CSS are lifted verbatim from `mocks/concept-4-complete.html` and refactored only to swap mock tokens for project `--color-*` tokens. If a mock element has no live equivalent (item routes to surface that doesn't exist, dashboard surface assumed but not built), surface as a surprise-stop. The only design decisions this session are token-name mappings, role-aware nav-item reconciliation, and the g4-mix absorption choice.
- **No new routing library.** If the codebase doesn't already have one (audit confirms), B4 cannot introduce one.
- **No new Firestore reads / collections / schema changes.** Shell renders chrome only — it consumes data already loaded by the dashboards or the AuthContext.
- **Both light + dark mode tested** before opening PR — per role, per breakpoint.
- **A11y is not a follow-up.** Landmark roles, focus trap, escape-closes, ARIA expanded, reduced-motion guards — all ship in the PR.
- **All 5 role logins verified on preview** before requesting merge. PR #50 risk-mitigation step from the implementation plan is the floor, not the ceiling.

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** If you hit the same kind of unexpected friction twice in a row on this session — two roles' dashboards break under the shell, two retries on the same step, two dark-mode contrast issues, two ambiguous mock-vs-code disagreements, two sidebar items routing to non-existent surfaces — STOP and wait for me, regardless of progress. Counter resets at the start of each new session.

**Surprise-stop triggers anticipated for B4:**
- A router exists in the codebase (not expected — audit confirms presence/absence)
- Test accounts for any of the 5 roles don't exist or are unreachable — **kicks back to Kyron for provisioning before any code**
- The shell wrap breaks single-`<main>` invariant on any role's dashboard
- The g4-mix 2-col layout collides with `max-w-2xl` and the absorption choice isn't obvious
- Sidebar items in the mock route to surfaces that don't exist (e.g., "Reports" tab when no reports route exists) — surface as scope decision
- Drawer focus trap interferes with an existing modal/dialog elsewhere in the app
- ManagerDashboard's wide tables (`MasterSheet.jsx` 23-column grid) crowd unacceptably under the new shell width
- Active-item highlight needs state the existing tab system doesn't expose
- Sidebar collapse-state restoration in `src/main.jsx` collides with the existing dark-mode restoration ordering
- Mock's per-role mobile bottom-nav (PRD Q8) doesn't match what the live dashboards render at narrow widths

Both gates are the value of this workflow. They're not friction — they're catching bugs before they ship. B1 caught two surface-gap surprises (CONTEXT.md drift + AgentDashboard-vs-CareerPortal mismatch). B2 caught two field-name drifts. B3 caught the MotivationalCarousel non-orphan + 4-event-type vision pared back to 2. B4's surprises will most likely cluster around routing, role-aware shell branching, sidebar items routing to non-existent surfaces, or the all-roles preview matrix surfacing dashboard breakages.

## Stash / pending state from prior sessions

Read `docs/CONTEXT.md` § Pending operational state. Surface anything notable in chat before starting B4. Known carry-overs as of B3 + PR #50 close:

- **Untracked legacy doc** at `docs/PR-3-Claude-Code-Brief.md` — stale, intentionally untracked across multiple PRs. Decide separately (archive or delete) — not B4 scope.
- **`MotivationalCarousel.jsx` still consumed by `ManagerDashboard.jsx:24,247`** — B3 audit caught this as a surprise. Deletion remains deferred. **B4 may absorb the cleanup if the manager-side header restructure under the shell makes it natural to remove the carousel render line at the same time** — but only as a side effect, not a B4 deliverable. If the manager header restructure does NOT touch `:247`, leave it alone and surface in PR description.
- **GitHub "Automatically delete head branches" is ON** (confirmed via PR #50 cleanup). Worktree teardown should be clean. Local branch removal uses `-D` (see Hard rules).
- **B3 follow-ups in `docs/FOLLOW_UPS.md`:**
  - Dashboard heading-hierarchy harmonisation (LOW priority) — B4 should not regress and may fix some of these as a side effect of moving headers into the shell, but is not the canonical fix.
  - Various mobile follow-ups (FU#1–#4) — manager surface mobile pass etc. Not B4 scope unless the shell wrap surfaces a regression.

## Final stop condition

End the session when:
- PR B4 is open with Vercel preview verified for **all 5 roles** at 1440px desktop, 1024px tablet, 768px tablet-portrait, and 390px mobile in **both light and dark mode** (40+ render-state checks)
- Sidebar collapses + expands on desktop with persistent state across reload
- Mobile drawer opens via hamburger, closes via Escape, closes via backdrop, focus-traps when open, returns focus to hamburger on close
- Active sidebar item highlights correctly when the dashboard's `activeTab` changes
- Theme toggle in TopBar still works; dark-mode persistence still works
- Existing single-`<main>` invariant holds on every role's dashboard (walkthrough step 2a still passes)
- g4-mix 2-col layout for Activity Feed + Achievements renders side-by-side at ≥1024px, stacks at narrow
- Reduced-motion behavior verified on drawer slide + sidebar collapse animation
- Pill / nav-item contrast verified ≥ 4.5:1 (text-on-bg) and ≥ 3:1 (active-item indicator vs surrounding surface) across both modes for every role
- Test account login verified for **every** role; missing accounts surfaced and provisioned before this stop condition can be met
- All open questions for Kyron are listed at the end of the plan / PR description
- `npm run lint` and `npm run build` both green on the feature branch
- Two-strike counter is at 0 or surfaced if not

Post a summary in chat with: tree state, PR link, what's done (shell + drawer + active highlight + role visibility + g4-mix + first-commit doc bumps), what's blocked on Kyron, two-strike counter status, and a one-line readiness check for PR B5 (Tenant Admin Config — note the editable `config/companyMinimums` write path is the largest behavioural deliverable in B5).

## ✂ COPY ENDS HERE ✂

---

## Notes for Kyron

- **Largest verification surface in the B-series.** The all-roles preview matrix is non-trivial: 5 logins × 4 breakpoints × 2 themes = 40+ render-state checks. The brief builds the verification protocol explicitly into Step 4 of the plan so it's not improvised during preview verification. Expect this PR to take 2–3× the verification time of B3.
- **Test-account discovery is an audit-phase deliverable, not assumed.** The agent test account (`kelsean@gmail.com`) is confirmed; the other four (`unit_manager`, `branch_manager`, `sales_manager`, `tenant_admin`) are unknown. If any are missing, the audit surfaces this as a discovery — provisioning is on you, not Claude. Kicks back to you before code starts.
- **Routing strategy is the largest unknown.** The implementation plan says "no React Router" but the audit must verify whether a router exists at all. If one is present, the integration approach changes. If none is present (expected), the sidebar plugs into existing `useState` tab state. Surface as Plan-Step 7 explicitly.
- **CONTEXT.md SHA bump + CLAUDE.md `git branch -D` rule are bundled into B4's first commit.** Per the post-PR-#50 banking decision. Frame as standard post-merge sequence, not exception. Reference: PR #50 retrospective, B3 post-merge.
- **MotivationalCarousel cleanup may absorb naturally** if the manager dashboard chrome restructure under the shell touches `ManagerDashboard.jsx:247`. Side effect only — not a B4 deliverable. If the shell wrap doesn't disturb that line, leave it alone and surface in PR description. The proper fix lands in a future manager-side redesign or B5+.
- **g4-mix absorption is the only "design decision" inside B4.** Everything else is mock-faithful translation. The brief asks for a recommendation in Plan-Step 6; you'll review before code.
- **B5 (Tenant Admin Config) is the next track.** B5 is smaller (1–2 days estimate per the implementation plan) and behaviour-heavy rather than chrome-heavy — it surfaces `config/companyMinimums` for read/edit. Once B4 lands, B5's kickoff brief follows the same pattern, focused on the edit modal + confirmation copy + branch-on-`role==='tenant_admin'` pattern.
- **"All 5 role logins verified before merge" is a hard floor.** PR #50's risk-mitigation step from the implementation plan is the minimum bar — the brief raises it to per-breakpoint per-theme matrix verification. If the matrix can't be completed (e.g., test accounts missing), the PR doesn't ship.
