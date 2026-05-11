# Polish-1 — Mobile UX + Toast primitive — kickoff brief

**Status:** Ready to execute after M3 lands. Three user-surfaced issues bundled.
**Estimated CC effort:** 1.5–2 days. Single PR. Includes a new shared primitive (Toast).
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 2/2 (E5 + C3). Workflow operates at tolerance ceiling — next process violation triggers hard stop.

---

## Context

Three real UX issues surfaced during informal testing, bundled into one PR because all three are small standalone fixes and none are architecturally dependent on each other. The middle item closes a backlog follow-up.

**Issue 1 — Mobile sign-out missing.** The sidebar is `display:none` at <768px (per Mobile FU#1 audit). Sign-out lives in the sidebar footer on desktop. Mobile users cannot sign out. Fix: add a Sign Out button to ProfileScreen.

**Issue 2 — Agent mobile lacks Goals and Persistency access.** Same NAV_GAP pattern PR #90 solved for managers. Agent bottom-nav doesn't include Goals or Persistency, leaving these screens unreachable on mobile. Fix: reuse the MobileNavDrawer "More" drawer pattern from PR #90 for the agent bottom-nav. This closes **Mobile FU#2** ("non-core agent P1s") from the follow-up backlog.

**Issue 3 — Kiosk copy link has no feedback.** `KioskModeTab.jsx`'s copy button fires `navigator.clipboard.writeText()` silently. User has no signal that the action worked. Fix: build a proper Toast primitive (new shared component) and wire it to the Kiosk copy action. The Toast primitive becomes available for other consumers in future PRs (Settlements save, Goals save, Persistency save, bulk imports, etc. — out of scope here but documented).

**Why bundle:** all three are small user-polish issues; bundling avoids three separate session setups. Toast primitive is genuinely new shared infrastructure that could have been part of M1's primitives library — adding it now as a sister primitive to Avatar/StatusPill/TabPills/ConfirmDialog/SaveButton.

**Closures expected in PR description** (not in `docs/FOLLOW_UPS.md` — housekeeping handles that):
- Resolves **Mobile FU#2** (agent mobile bottom-nav coverage)
- Note Toast primitive is the foundation for future "build proper toast system" work; document candidate consumers as future opportunities

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the M3 squash commit (`feat(manager-revamp): M3 — Manager Awards medal system`) at top.
4. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`. Apply surface-before-act discipline if any stale worktrees exist.
5. Create worktree at `.claude/worktrees/feat-polish-1-mobile-toast` on branch `feat/polish-1-mobile-toast`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

Three small discovery streams. Run in parallel reading where it makes sense.

### 2a — Sign-out (Issue 1)

1. `src/components/profile/ProfileScreen.jsx` — read in full. Identify:
   - Current layout structure (sections, ordering)
   - Existing button patterns used (e.g., Save Changes via M1's SaveButton)
   - Best location for an "Account" section (likely at the bottom)
2. Find the existing sign-out function — likely in `src/services/authService.js` or `src/firebase.js`. Capture:
   - Function name + signature
   - Side effects (clears auth state, redirects, etc.)
3. `src/components/shell/Sidebar.jsx` (or wherever the desktop sign-out lives) — read to understand the existing sign-out wiring pattern. Mirror that pattern for ProfileScreen.

### 2b — Agent More drawer (Issue 2)

1. `src/components/shell/MobileBottomNav.jsx` — read in full. Capture:
   - Current bottom-nav items structure
   - Per-role mapping logic (does the same component serve agent + manager, or are there separate variants?)
   - How the "More" item was added for manager portal in PR #90
2. `src/components/shell/MobileNavDrawer.jsx` — read in full. Capture:
   - Props API (especially the items list and onClose handler)
   - Whether it's already generic enough for agent reuse, or needs minor extension
3. Find the agent's current bottom-nav definition (or sidebar nav items in agent context). Likely in:
   - `src/components/shell/Shell.jsx` or wherever NAV_ITEMS / BOTTOM_NAV is defined per role
   - `src/components/dashboard/AgentDashboard.jsx` if nav is dashboard-driven
4. List which agent-side screens currently are sidebar-only (unreachable on mobile). At minimum:
   - Goals (sub-tab in agent context — needs confirmation it's reachable as a top-level screen)
   - Persistency (agent self-entry surface)
   - Possibly: Career Portal, History, others
5. Confirm: which exact items should appear in the agent's "More" drawer? Surface this list in Phase 3 for approval.

### 2c — Toast primitive (Issue 3)

This is the largest discovery item in this PR. The Toast primitive is new shared infrastructure.

1. **Existing toast patterns in the codebase** — search for any inline toast implementations (per audit, "Toast pattern is inline + bespoke"). Capture all locations. They become future migration targets (NOT in M3.5's migration scope — only Kiosk wires up).
2. **Mount point.** Where does the Toast container live in the React tree? Most apps use a portal at the document root (rendered into `document.body`). Identify the appropriate parent component (likely `Shell.jsx` or `App.jsx`).
3. **Z-index considerations.** Modals (M1's ConfirmDialog) sit at z-50. Toasts should sit ABOVE modals OR below them depending on convention. Decide and surface in Phase 3.
4. **Existing animation patterns.** `prefers-reduced-motion` discipline per project memory. Match existing motion guards.
5. **A11y baseline for toasts:**
   - `role="status"` for info/success toasts (announces politely)
   - `role="alert"` for error/warning toasts (announces assertively)
   - `aria-live` regions accordingly
   - Keyboard dismiss option (Escape?) — research common patterns
6. **KioskModeTab.jsx copy button** — find the exact line(s) where the copy fires. Plan the integration point.

---

## Phase 3 — Design + scope surface (STOP HERE)

Output a structured surface covering all three items + the Toast API design.

```
DISCOVERY — Polish-1 Mobile UX + Toast primitive

ISSUE 1 — Mobile sign-out

Current ProfileScreen structure:
  - Sections: <list>
  - Recommended Account section placement: <e.g., bottom of file, after all data sections>
  - Existing button patterns: <use SaveButton with danger intent OR new variant>

Sign-out function:
  - File: <path>
  - Name: <function name>
  - Side effects: <brief>

Proposed integration:
  - New "Account" section at bottom of ProfileScreen
  - Single Sign Out button styled <approach>
  - Confirmation dialog needed? <yes via ConfirmDialog / no, sign-out is reversible>

Files to touch: <list>

ISSUE 2 — Agent More drawer

Current bottom-nav per role:
  - Agent: <list of 5 items currently shown>
  - Manager (post-PR#90): Dashboard, Team, Campaigns, Reports/MasterSheet, Profile, More (drawer)

Agent screens unreachable on mobile:
  - <list, target: Goals, Persistency, and any others>

Proposed agent BOTTOM_NAV after fix:
  - <list of 5 primary items + More drawer>

MobileNavDrawer reuse:
  - Generic enough as-is? <yes/no>
  - Extensions needed? <list>

Files to touch: <list>

ISSUE 3 — Toast primitive (NEW PRIMITIVE)

API design:
  - Hook: useToast() returns { show: (message, options) => void }
  - show({ message, variant, duration, action })
    - message: string | ReactNode (required)
    - variant: 'success' | 'error' | 'info' | 'warning' (default 'info')
    - duration: number ms (default 3000; 0 = sticky until dismissed)
    - action: { label, onClick } (optional — adds a button next to toast)
  - Returns: toastId (string, usable for programmatic dismiss)

Toast component:
  - Props: { message, variant, duration, action, onDismiss }
  - Auto-dismiss after duration via setTimeout
  - Manual dismiss via X button or action.onClick
  - prefers-reduced-motion respected on enter/exit animation
  - ARIA: role="status" for success/info, role="alert" for error/warning

Position:
  - Default: <e.g., bottom-center on mobile, top-right on desktop>
  - Z-index: <above or below modals — recommend above>

Queue management:
  - Multiple toasts displayed simultaneously? <stack vertically with max N>
  - Toast IDs allow programmatic dismiss?

Mount point:
  - <Shell.jsx wraps a ToastProvider at the top>
  - Portal target: <document.body or specific div>

Files to add:
  - src/components/ui/Toast.jsx (display component)
  - src/components/ui/ToastProvider.jsx (context provider + queue)
  - src/hooks/useToast.js (hook for consumers)
  - src/components/ui/__tests__/Toast.test.jsx
  - src/components/ui/__tests__/ToastProvider.test.jsx

Files to wire into:
  - src/components/shell/Shell.jsx (mount ToastProvider)
  - src/components/kiosk/KioskModeTab.jsx (consume useToast, replace silent copy)

KIOSK CONSUMER:
  - Copy URL → toast.show({ message: 'Link copied', variant: 'success' })
  - Copy fails → toast.show({ message: 'Copy failed', variant: 'error' })

SCOPE ESTIMATE:
- New files: <count, including Toast primitive + tests>
- Modified files: <count, ProfileScreen, MobileBottomNav, Shell, KioskModeTab>
- Total: <under 30 ceiling>
- Risk: LOW for sign-out + agent drawer (mechanical); MEDIUM for Toast primitive (new infrastructure, but well-scoped)

OPEN QUESTIONS FOR KELSEAN:
- Does sign-out need a confirmation dialog? Pro: prevents accidental sign-out. Con: extra friction for a reversible action. <recommendation>
- Agent More drawer item list — exact recommendation, awaiting confirmation
- Toast position — bottom-center mobile + top-right desktop (responsive)?
- Toast queue — stack max N or replace existing?
- Sign-out button — should it match the existing pattern from sidebar footer, or be styled differently?
- Toast Z-index above or below ConfirmDialog (z-50)?
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the Toast API design
- Confirm agent drawer items
- Answer open questions
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build order:

1. **Toast primitive first.** This is the new shared infrastructure. Build it + tests + wire to Shell's mount point before any consumer code uses it.
2. **ProfileScreen sign-out** — straightforward addition.
3. **MobileBottomNav agent drawer extension** — apply per Phase 3 approved items list.
4. **KioskModeTab toast wire-up** — replace silent `clipboard.writeText` with toast feedback.

**Constraints (carry over):**
- Use M1 primitives where applicable (Avatar, StatusPill, etc. — already in use)
- Use existing Nexus tokens — no new ones
- 44px touch targets for interactive elements
- Dark mode parity throughout
- `prefers-reduced-motion` respected for Toast enter/exit animation
- A11y baseline per Phase 3 design
- Functional components, useMemo/useCallback where appropriate

**Toast-specific constraints:**
- Portal rendering via `createPortal` from react-dom
- Cleanup on unmount (clearTimeout for auto-dismiss)
- No new dependencies (use react built-ins + lucide-react icons for variant indicators)
- TypeScript-like prop documentation in JSDoc since project is JS not TS

---

## Phase 5 — Tests

Required test coverage:

**Toast primitive:**
- Toast.jsx: renders message, applies correct variant class, calls onDismiss after duration, X button calls onDismiss, action.onClick fires when action provided
- ToastProvider.jsx: useToast hook returns show function, show() adds toast to queue, max queue size enforced, dismiss removes from queue, multiple toasts render simultaneously
- useToast.js: hook works outside ToastProvider (graceful no-op or throws clear error)

**Other consumers:**
- ProfileScreen: Sign Out button renders, click calls signOut function (mock)
- MobileBottomNav: agent role shows correct items including More, drawer opens on More click
- KioskModeTab: copy button click triggers toast (verify via mocked useToast)

Scaffold from MobileNavDrawer.test.jsx and SaveButton.test.jsx patterns established in M1.

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — not handed off)

Use `scripts/verification/lib/walk-helpers.mjs`.

### Smoke scope

1. **Mobile sign-out verification:**
   - Sign in as test agent on Vercel preview at 390x844 viewport
   - Navigate to Profile
   - Sign Out button is visible and clickable (44px touch target)
   - Click → user signed out → redirected to login screen
   - Capture screenshot

2. **Agent More drawer verification:**
   - Sign in as test agent at 390x844 viewport
   - Bottom-nav shows "More" item
   - Tap More → drawer opens with Goals, Persistency, and other approved items
   - Tap Goals → drawer dismisses + navigates to Goals
   - Reopen drawer → tap Persistency → drawer dismisses + navigates to Persistency
   - Tap backdrop → drawer dismisses
   - Escape key → drawer dismisses

3. **Kiosk toast verification:**
   - Sign in as branch_manager (use sales_manager test account per M2's discovery)
   - Navigate to Kiosk tab
   - Generate a kiosk URL
   - Click copy button on a token
   - Toast appears with "Link copied" message + success variant
   - Toast auto-dismisses after duration
   - Capture screenshot mid-toast for proof

4. **Regression sweep:**
   - Agent portal: Dashboard, Wizard (one step), Career, Profile — all render normally
   - Manager portal: Overview (M2 hero), Awards (M3 medals), Team, Goals — all render normally
   - Single screenshot per surface at desktop light

### Smoke gates

- Mobile sign-out + drawer interactions work cleanly
- Toast renders, animates, dismisses correctly
- No console errors anywhere
- No regression on existing surfaces

If smoke fails:
- Fix in scope, re-smoke
- If a regression appears that's unrelated to this PR's changes: STOP and surface

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization:
   - `feat(ui): add Toast primitive + ToastProvider + useToast hook`
   - `feat(shell): mount ToastProvider in Shell`
   - `feat(profile): add Sign Out button to ProfileScreen Account section`
   - `feat(shell): agent mobile More drawer (closes Mobile FU#2)`
   - `feat(kiosk): wire copy feedback to Toast primitive`
   - `test(ui): RTL tests for Toast + ToastProvider`
5. Push, open PR titled: `feat(polish-1): mobile sign-out + agent More drawer + Kiosk copy toast (new Toast primitive)`
6. PR description MUST include:
   - **Summary:** three user-surfaced UX issues resolved + new Toast primitive
   - **Closes:** Mobile FU#2
   - **Toast primitive API documented:** brief reference for future consumers
   - **Future consumer candidates** (document but don't implement): Settlements save, Goals save, Persistency save, bulk imports, etc.
   - **Smoke results** from Phase 6 — screenshots embedded
   - **Test coverage:** count of new tests, total after merge
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals the agent bottom-nav architecture differs significantly from manager's (e.g., different role-resolution path) → STOP and surface
- Phase 3 Toast API design surfaces conflicts with existing modal patterns (e.g., focus management overlap with ConfirmDialog) → STOP and surface
- Phase 6 smoke shows the Toast doesn't render correctly above modals OR conflicts with focus trap → STOP and surface
- Any source code changes outside the components in scope → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Migrating existing inline toast patterns to the new primitive (separate PR — future polish work)
- Other manager portal screens (M4 Goals IA, M5 WeeklyChampionsBanner — separate PRs)
- New features beyond the three fixes (no new sign-out flows, no new mobile screens)
- Modifying ConfirmDialog or other M1 primitives
- Changes to authentication/Firebase setup (sign-out wires existing function)
- TenantAdminDashboard mobile changes
- Walk script changes
- Rules changes
- Updating `docs/FOLLOW_UPS.md` (housekeeping handles closures/additions)
- Adopting Toast in any other consumer (Settlements, Goals, etc.)

---

## What success looks like

After this PR merges:

1. Mobile users can sign out via Profile screen
2. Mobile agents can reach Goals and Persistency via the "More" drawer
3. Kiosk users see "Link copied" toast feedback on copy button click
4. The codebase has a Toast primitive available for future consumers
5. Mobile FU#2 closes from the follow-up backlog
6. M4 (Goals IA flatten) can build on the Toast primitive when it adds save-feedback toasts to Goals
