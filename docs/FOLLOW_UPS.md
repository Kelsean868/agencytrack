# AgencyTrack — Follow-Up Items

Tracked here so they don't get lost between sessions. Items are deliberately scoped small
so each can ship as a standalone PR. Remove an item when its PR merges.

---

## Mobile audit — deferred items (from `mobile-audit-2026-05-06`)

Pilot-critical agent-flow items shipped in PR `mobile-audit-pilot-pass-1`. The
remaining items below were intentionally deferred. Audit doc: `docs/mobile-audit-2026-05-06.md`.

### Mobile follow-up #1 — Manager surface mobile pass (next-week scope)

`MasterSheet.jsx` (23-column grid wrapped in `overflow-x-auto`),
`SettlementPanel.jsx` (three grids), `ManagerDashboard.jsx` TabBar (still h-9),
`ManagerAwardsPanel.jsx` TabBar, `GoalsPanel.jsx` mode-tabs,
`CampaignPanel.jsx` filter tabs, `MeetingMode.jsx` (mobile-presentation
behaviour), `UserManagementPanel.jsx` rows. None of these are pilot-blocking
because Tatil managers will use desktop/tablet, but each has the same
36px tab-button + horizontally-scrolling-grid pattern that needs the same
treatment as the agent side. Estimated 1–2 days of focused work.

### Mobile follow-up #2 — Non-core agent surface P1s

- `CareerPortal` "Edit My Goals" button is 32px tall — bump to 44px
- `History` row eye/preview button is < 44px — bump hit area while preserving icon
- `CommissionPlayground` accordion toggle — measure and adjust if < 44px

### Mobile follow-up #3 — `bg-primary/N` opacity utilities resolve to transparent

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

### Mobile follow-up #4 — P2 cosmetic items

- Wizard close (X) button is 40×40 — bump to 44×44
- Leaderboard avatars are 40×40 — leave visual but expand surrounding tap row
- `MotivationalCarousel.jsx` line 366 hardcoded `bg-[#01696f]/8` — replace with token

---

## A11Y PR6 — global dark-mode contrast pass (manager pages)

**Scope:** PR5 added the first dark-mode axe scan in the project (manager-side, via
`scripts/a11y-axe-scan-manager.cjs --dark`). It uncovered 4 pre-existing color-contrast
nodes that don't manifest in light mode:

| Page | Nodes |
|---|---:|
| `manager_dashboard` | 1 |
| `manager_agents` | 1 |
| `manager_persistency` | 1 |
| `manager_settlements` | 1 |

These are NOT regressions from PR5 — they exist on `main` today, just never previously
exercised. Scope of PR6:

- Identify each failing node (use a per-page debug helper: log `axe.violations[].nodes[].html`
  + `failureSummary` for color-contrast on each page in dark mode)
- Apply targeted fixes (most likely candidates: `bg-primary/N text-primary` chips
  rendering against the dark `--color-bg`, similar to the latent bug PR3 found in light mode)
- Add a similar `--dark` flag to `scripts/a11y-axe-scan.cjs` (agent scan) and run a full
  agent dark-mode baseline. Any new findings → fold into this PR
- Acceptance: 0/0 in BOTH light and dark on all 9 manager + 8 agent pages

The agent-side may surface additional findings — keep the PR focused; if scope balloons,
split agent and manager into separate PRs.

---

## React Compiler adoption — already documented below; left in place for context

## react-hooks/exhaustive-deps × 3 (deferred from PR3)

Not jsx-a11y; left at `warn` rather than flipped. Fix as a small follow-up:

- `src/components/awards/AgentAwardsPanel.jsx:155` — `now` logical expression
  could change every render; move inside useMemo or wrap in its own useMemo
- `src/components/awards/AgentAwardsPanel.jsx:168` — unused eslint-disable
  directive (downstream of the above)
- `src/components/manager/GoalsPanel.jsx:361` — useEffect missing
  `onGoalsLoaded` dep; either add to deps or wrap parent definition in
  useCallback

---

## React Compiler adoption (long-term, conditional)

**Scope:** `eslint-plugin-react-hooks` v7 ships React Compiler lint rules disabled in
`eslint.config.js` (see Lint Policy in CLAUDE.md). If `@babel/plugin-react-compiler` is
ever adopted, re-enable those rules and refactor the ~19 data-fetch `useEffect` patterns
they flag.

- Not blocking anything; purely a note for when React Compiler reaches stable adoption
- No PR needed until the Compiler is intentionally added to the project

---

## PR-4 — Edit-user flows (user-mgmt track)

**Scope:** UserManagementPanel currently supports create + deactivate/reactivate.
Missing: editing an existing user's fields (name, email, phone, unitId reassignment).

- Add an Edit button/drawer to each user row (branch_manager and above)
- Inline edit for name, phone; modal for role reassignment (rare, requires caution)
- Email changes must go through Firebase Auth `updateEmail` (not just Firestore)
- Unit reassignment for agents: update `unitId` in both the Firestore doc and claims

---

## Branches Management UI

**Scope:** Branches exist as data (branchId strings in user docs) but there is no UI to
list, create, or rename branches. A branch_manager or tenant_admin cannot currently add a
new branch without direct Firestore access.

- Manager panel tab: "Branches" — lists known branches derived from user docs
- Create branch (tenant_admin only): reserves a branchId, creates a placeholder doc
- Rename branch: updates all user docs with the old branchId (batched write)

---

## SEC-9b — Cross-tenant isolation audit

**Scope:** Firestore rules were tightened in SEC-2/SEC-3/SEC-4 but a full cross-tenant
read audit has not been run. A malicious tenant_admin should not be able to read another
tenant's subcollections.

- Run `firebase emulators:start` + cross-tenant read probes for every subcollection
- Pay special attention to: campaigns, leaderboard, notifications, settlements
- Document results in `docs/SEC-9b-audit.md` and patch any failures

---

## tenant_admin email update path

**Scope:** Changing a tenant_admin's own email is blocked by Firebase Auth's re-auth
requirement, but there is no UI flow for it. Admins currently must use the Firebase console.

- Add an "Update Email" flow in ProfileScreen gated behind re-authentication (`reauthenticateWithCredential`)
- Show a "confirm current password" step before allowing the email change
- Update Firestore user doc email field after Auth email update succeeds

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
