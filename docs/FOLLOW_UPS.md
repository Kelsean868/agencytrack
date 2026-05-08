# AgencyTrack — Follow-Up Items

Tracked here so they don't get lost between sessions. Items are deliberately scoped small
so each can ship as a standalone PR. Remove an item when its PR merges.

---

## HIGH-priority — sales_manager onboarding regressions (surfaced 2026-05-07)

Three production-affecting bugs discovered while provisioning the missing test
accounts for B4's all-roles preview matrix. All three are likely regressions from
the May 5 roles refactor and should land before the Tatil pilot demo.

### HIGH#1 — User-creation flow does not send password reset email

**Reproducer:** Tenant Admin → Team tab → Add User → fill the form → Save. The
Firebase Auth user is created (and the Firestore doc is written), but no
"Set your password" email is dispatched to the new user. The created user has
no way to set their initial password without intervention.

**Workaround in use today:** Firebase Console → Authentication → click the
new user → three-dot menu → "Reset password" — this dispatches the email
manually.

**Likely site:** the `createUser` Cloud Function path (or its successor after
the polymorphic refactor in user-mgmt PR-2). The original flow likely called
`generatePasswordResetLink` + `sendEmail` and one of those calls was lost in
the refactor. Verify against `functions/index.js` and the email transport
config.

Priority: **HIGH** (pilot-blocking — Tatil cannot onboard managers/agents at
scale without this). Surfaced during B4 provisioning.

### HIGH#2 — UI role-to-label map is missing `sales_manager` → "Unknown" displayed

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

## Wizard UX + A11y Hardening (post-Track-A audit, 2026-05-06)

Discovered during Track A PR-1 audit. Items 5 and 6 of CLAUDE.md
"Known Open Items" were already resolved (commit `57828d7`, 2026-05-02), but the
audit surfaced a genuine hardening list for future scoping:

- Add explicit "Try again now" retry button when `saveError === true`
  (currently auto-retries on next debounce only)
- Add fading "Saved ✓" success indicator (currently only "Saving…"
  pulse; no positive confirmation)
- Distinguish "offline (queued, will retry)" vs "save rejected
  (action needed)" — Firestore offline persistence queues writes
  silently; UI should reflect that
- Add persistent-failure handling: after N consecutive failures,
  escalate (block submit? force user ack?)
- Add `role="alert"` / `aria-live="polite"` to the save-error span so
  screen readers announce the failure (a11y gap, surfaced 2026-05-06)
- Save errors currently clear silently on next attempt — could mask
  intermittent failure patterns; consider sticky-until-acknowledged
  for repeat failures

Priority: MEDIUM. Not pilot-blocking. The `aria-live` item is the
smallest and highest a11y value; could ship as a single-line micro-PR.

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
