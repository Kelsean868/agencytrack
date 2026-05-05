# AgencyTrack — Follow-Up Items

Tracked here so they don't get lost between sessions. Items are deliberately scoped small
so each can ship as a standalone PR. Remove an item when its PR merges.

---

## A11Y PR3 — agent-side surfaces + strict mode flip

**Scope:** Agent-side axe violations (separate scan script: `scripts/a11y-axe-scan.cjs`).
Also includes the jsx-a11y warn→error flip for rules already fixed in PR1/PR2.

- Run `A11Y_AGENT_EMAIL=... node scripts/a11y-axe-scan.cjs --url=<preview>` to baseline
- Fix all serious + critical violations on agent surfaces (login, dashboard, career, awards,
  leaderboard, history, profile, wizard)
- Check `AgentAwardsPanel.jsx` for `opacity-60` on greyed award cards — likely same
  `color-contrast × N` pattern fixed in manager awards (PR2)
- After all agent findings fixed, flip jsx-a11y `label-has-associated-control` and any other
  rules that are clean to `error` in `eslint.config.js`
- 35 jsx-a11y warnings currently in lint output — all agent/manager forms; treat as the
  backlog for this PR

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
