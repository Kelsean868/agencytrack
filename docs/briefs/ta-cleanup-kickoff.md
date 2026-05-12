# TA-CLEANUP — TenantAdminDashboard placeholder cleanup — kickoff brief

**Status:** First post-M-series PR. Path (A) completion sequence.
**Estimated CC effort:** Half-day to one day. Single PR.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 0/2 (clean state).

---

## Context

Per the manager portal audit, TenantAdminDashboard has unfinished "Coming soon" placeholders that any pilot user with `tenant_admin` role would see. Path (A) completion means the TA surface should look intentional — either real functionality or designed empty states with clear forward-looking language.

**What this PR DOES:**
- Inventory every "Coming soon" placeholder in TenantAdminDashboard
- For each, decide: (a) route to existing functional surface, (b) replace with designed empty state, or (c) remove if not needed
- Apply Nexus design language consistent with M-series work
- Use M1 primitives (TabPills, SaveButton, Avatar, ConfirmDialog) where applicable
- Use Polish-1 Toast primitive for any save/action feedback
- Maintain dark mode parity throughout

**What this PR does NOT do:**
- Build full Branches Mgmt UI (that's its own HIGH-priority PR in the completion path)
- Build PR-4 edit-user flows (separate PR)
- Add new tenant-admin features beyond cleanup
- Change tenant_admin role permissions, security rules, or auth claims
- Touch the platform_admin (cross-tenant) surface

**Closures expected in PR description** (not in FOLLOW_UPS.md — housekeeping handles):
- Resolves "TenantAdminDashboard 'Coming soon' placeholders" from the post-M-series HIGH backlog

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the M5 squash commit at top.
4. Confirm clean state: `git worktree list` shows only main; surface-before-act for any stale worktrees from M5.
5. Create worktree at `.claude/worktrees/feat-ta-cleanup` on branch `feat/ta-cleanup-placeholders`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

This is a discovery-heavy phase. The triage matters more than the implementation.

### 2a — Locate TenantAdminDashboard

1. Find `TenantAdminDashboard.jsx` — read in full. Capture:
   - File path
   - Total lines + structure
   - Tab structure (if any)
   - Each "Coming soon" placeholder location and surrounding context
2. Find where it's routed — likely in `App.jsx` or a router file. Confirm:
   - Which role(s) reach it (`tenant_admin`, possibly `platform_admin`)
   - Whether `platform_admin` uses a different/extended dashboard

### 2b — Existing functional surfaces that could fill placeholders

For each placeholder, identify whether an existing component could be routed to:
- `UserManagementPanel.jsx` — user CRUD (likely candidate for "Users" placeholder)
- `BranchesPanel.jsx` (if exists) — branch admin (likely candidate for "Branches" placeholder, but full Branches Mgmt UI is a separate HIGH PR — minimal placeholder is OK for now)
- `CampaignPanel.jsx` — campaign config (possible candidate for "Campaigns" placeholder)
- Settings/configuration surfaces
- Reports/analytics surfaces

Capture for each: what it does, what role can access it currently, whether routing TA there makes sense, and what scope-fit looks like.

### 2c — TA role expectations

What does a tenant_admin role actually do day-to-day? Per project memory:
- Administers their own company (per-tenant scope)
- Likely manages users + branches + tenant-level config
- Cross-tenant work is platform_admin (Kyron only)

If any placeholders represent functionality that's genuinely "post-pilot Phase 9" work, the right answer might be a designed empty state with copy like "Reports — coming after pilot launch" rather than functional implementation.

### 2d — Mobile + accessibility audit

While reading TenantAdminDashboard, capture:
- Does it have mobile bottom-nav coverage? (compare to Mobile FU#1's manager mobile work)
- Are inputs h-9 or h-11?
- Any hardcoded hex strings?
- Dark mode tested?

These adjacent issues might be small enough to bundle, OR worth flagging as a separate "TA mobile/a11y" follow-up.

---

## Phase 3 — Design + scope surface (STOP HERE — critical triage gate)

Output a triage matrix per placeholder + scope decisions:

```
DISCOVERY — TenantAdminDashboard cleanup

CURRENT STATE:
- File: <path>
- Total lines: <N>
- Tab/section structure: <description>
- Reachable by: <roles>

PLACEHOLDERS INVENTORY:

| # | Placeholder | Location (file:line) | Proposed resolution | Justification |
|---|-------------|---------------------|---------------------|---------------|
| 1 | "Users — Coming soon" | <path:line> | Route to UserManagementPanel scoped to tenant | UserManagementPanel exists and handles tenant-scoped users today |
| 2 | "Branches — Coming soon" | <path:line> | Designed empty state with "Full UI coming — use Firebase Console workaround for now" | Branches Mgmt UI is a separate HIGH PR; placeholder should signal intent without being functional |
| 3 | "Reports — Coming soon" | <path:line> | <decision> | <reason> |
| ... | | | | |

EMPTY STATE DESIGN PATTERN (for placeholders that stay as empty states):
- Card with .role-hero or .card chrome (decide based on hierarchy)
- Icon (lucide-react, appropriate for the placeholder topic)
- Heading: "<Feature Name>"
- Body: forward-looking copy (NOT "Coming soon" — too generic; use specific intent like "Full UI scheduled post-pilot launch — for now, contact platform admin for changes" or similar)
- Optional: secondary action button (e.g., "View documentation" or "Contact support")

REAL SURFACE ROUTING (for placeholders that route to existing functionality):
- Confirm TA role has appropriate permissions in Firestore rules (check security rules; might need a small rules update OR confirmation that rules already allow)
- Verify the routed component renders correctly when accessed by TA role (not just manager roles)
- If rules need updates: SURFACE BEFORE IMPLEMENTING (rules changes are higher-risk)

MOBILE + A11Y NOTES (separate scope decision):
- Bottom-nav coverage for TA on mobile: <yes/no>
- Input heights: <h-9 / h-11>
- Hardcoded hex: <list>
- Recommend: bundle into THIS PR if small (<5 cosmetic touch-ups), OR file as separate TA-MOBILE follow-up

NEW / MODIFIED COMPONENTS:
- TenantAdminDashboard.jsx — heavy modification (placeholder swaps)
- TenantAdminDashboard.test.jsx — new or extended
- Possibly: new shared empty-state component if 3+ placeholders use same pattern (extract for cohesion)
- Possibly: rules updates IF Phase 2 reveals TA can't access UserManagementPanel today

SCOPE ESTIMATE:
- Files modified: <count, target ≤6>
- New files: <count>
- Rules changes: <yes/no> — if yes, surface scope risk
- Total file count: <under 30 ceiling>

SHOULD TA-CLEANUP BE SPLIT?
- TA-CLEANUP-A (placeholder swaps only): <yes/no>
- TA-CLEANUP-B (mobile + a11y bundled): <yes/no>
- Recommendation: <single PR / split>

OPEN QUESTIONS FOR KELSEAN:
- <For each placeholder, the (a)/(b)/(c) decision if not obvious from discovery>
- <e.g., "Users tab — route to UserManagementPanel: confirm TA permissions sufficient, or rules update needed?">
- <e.g., "Reports tab — designed empty state with what specific copy?">
- <e.g., "Empty state pattern — extract shared component vs inline per placeholder?">
- <e.g., "Mobile + a11y bundling — yes in this PR, or separate TA-MOBILE follow-up?">
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the resolution per placeholder
- Approve empty state copy (specific wording, not generic)
- Decide mobile+a11y bundling
- Confirm rules changes (if any)
- Answer open questions
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per locked design. Order:

1. **Real-surface routings first** — these reuse existing components; lower risk
2. **Designed empty states** — apply consistent pattern (extracted shared component if used 3+ times)
3. **Rules updates (if any)** — separately, with explicit security review focus
4. **Mobile + a11y cleanup** — if bundled per Phase 3

**Constraints (carry over):**
- Use M1 primitives where applicable (TabPills, SaveButton, Avatar, ConfirmDialog)
- Use Polish-1 Toast primitive for any save feedback
- Use existing Nexus tokens — no new ones
- 44px touch targets
- Dark mode parity throughout
- `prefers-reduced-motion` respected
- Functional components, useMemo/useCallback where appropriate

**Empty state copy guidelines:**
- Specific, not generic ("Branches management — full UI coming in [timeframe]; use Firebase Console for now")
- Forward-looking but honest
- Avoid "Coming soon" (the original problem)
- If unsure, surface in Phase 3 for specific wording approval

---

## Phase 5 — Tests

Cover key surfaces:
- TA Dashboard renders all expected tabs/sections without placeholder text
- Real-surface routings: when TA navigates to a routed tab, the routed component renders
- Empty states: render with correct copy + icon + chrome
- Role gating: tenant_admin sees the dashboard correctly; other roles don't accidentally see TA-only content
- If rules updated: rules tests cover the new permissions (Firebase rules emulator if set up; otherwise document the rules change in PR description for security review)

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — non-negotiable per project standard)

Use `scripts/verification/lib/walk-helpers.mjs` setupBypassSession pattern.

### Smoke scope

1. **TA Dashboard rendering:**
   - Sign in as a tenant_admin role account. If `A11Y_TENANT_ADMIN_EMAIL` doesn't exist, surface that in Phase 2 and Kelsean will create a test account.
   - Navigate to TA Dashboard
   - Verify NO "Coming soon" text appears anywhere
   - Verify each placeholder shows its intended resolution (real surface or designed empty state)
   - Capture screenshots at desktop (1440x900) and mobile (390x844), light + dark — minimum 8 screenshots

2. **Real-surface routings work:**
   - If TA Users tab routes to UserManagementPanel, verify TA can:
     - See user list (read works under TA role)
     - Add a user (if rules allow)
     - Edit a user (if PR-4 edit flows exist OR is out of scope here)
   - Real Firestore write/read cycle if functionality is wired

3. **Other dashboards regression sweep:**
   - Manager portal (Overview, Awards, Goals, Persistency) — all still render normally
   - Agent portal — still renders normally
   - Login flows — work normally

### Smoke gates

- No "Coming soon" text anywhere in TA Dashboard
- All placeholder resolutions render correctly
- No console errors
- No regression on manager or agent portals

If smoke fails:
- TA role can't access a routed surface due to rules: STOP and surface (security implications)
- Empty state copy looks wrong vs Phase 3 lock: fix in scope
- Other regressions: STOP and surface

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization:
   - `feat(ta): cleanup TenantAdminDashboard placeholders — <brief description>`
   - For each major change: separate commit (real-surface routings, empty states, rules updates if any, mobile/a11y if bundled)
   - `test(ta): RTL + smoke coverage for TenantAdminDashboard cleanup`
5. Push, open PR titled: `feat(ta): TenantAdminDashboard placeholder cleanup`
6. PR description MUST include:
   - **Summary:** all "Coming soon" placeholders replaced with real surfaces or designed empty states
   - **Closes:** "TenantAdminDashboard Coming soon placeholders" from post-M-series HIGH backlog
   - **Triage matrix** (verbatim from Phase 3 approval) showing each placeholder → resolution
   - **Rules changes (if any):** explicit before/after diff for security review
   - **Smoke results** from Phase 6 — screenshots embedded
   - **What's still placeholder-style:** any items resolved as designed empty states (so Kelsean knows what's pending future work)
   - **Mobile + a11y outcomes:** if bundled, summary; if separate, follow-up note
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals TA role doesn't have necessary Firestore rules permissions to access proposed routed surfaces → SURFACE; may need rules changes (separate scope decision)
- Phase 3 placeholder count is much higher than expected (>10) → SURFACE; may need to split into TA-CLEANUP-A/B/C by domain area
- Phase 6 reveals rules issue blocking smoke verification → STOP; rules changes are higher-risk and may need a separate PR
- Any source code changes outside TenantAdminDashboard surfaces + tests + rules → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- ANY token appearance in any artifact → IMMEDIATE STOP
- Two strikes hit → STOP

---

## Out of scope

- Full Branches Mgmt UI implementation (separate HIGH PR)
- PR-4 edit-user flows (separate HIGH PR)
- New tenant_admin features beyond placeholder resolution
- Platform_admin (cross-tenant) surface changes
- Role permission changes (security-sensitive, would need its own PR if needed)
- Migrating other inline toast patterns (Polish-2 sweep is its own PR)
- Updating `docs/FOLLOW_UPS.md` (housekeeping handles closures)
- Phase 9 features (Sales Manager Target layer, etc.)

---

## What success looks like

After this PR merges:

1. TenantAdminDashboard has zero "Coming soon" placeholders
2. Every section either functions or shows a designed empty state with intentional copy
3. Tenant admins logging in see a polished surface consistent with the manager portal's M-series work
4. Path (A) HIGH-priority sequence advances: 1 of 3 HIGH items closed (TA cleanup); PR-4 edit-user flows next, then Wizard UX+A11y hardening

This PR is the first post-M-series PR. It moves the project from "manager portal polished, TA surface unfinished" to "both major admin surfaces look intentional."
