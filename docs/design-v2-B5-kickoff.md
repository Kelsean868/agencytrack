# AgencyTrack Session Kickoff — Design v2 PR B5 (Tenant Admin Config)

> **For Kyron:** This is the prompt to paste into a fresh Claude Code session to start PR B5. Copy from the line below all the way down. The prompt is self-contained — Claude Code will read the right files and produce a plan before writing any code.
>
> **B5 is the only write-path PR in Track B (v2).** Smaller surface area than B4, but the write path on `tenants/{tid}/config/companyMinimums` means validation, confirmation, error-handling, and Firestore-rules discipline matter more per line of code. This brief adds a dedicated §Write-path discipline gate and a B5-specific surprise-stop list around security rules and document existence.
>
> When B5 ships, Track B (v2) is complete. There is no B6. The redesign sequence ends here. Any next track is a different scope (Track C — configuration & data, real Tatil accounts, 2026 goals).

---

## ✂ COPY FROM HERE ✂

# AgencyTrack Session Kickoff — Design v2 PR B5 (Tenant Admin Config)

## Step 0 — Read these in order, do not skip
1. `CLAUDE.md` — static project rules (code style, domain rules, theme system, workflow). Pay attention to: post-merge protocol (steps 9 and 9.5); the `git branch -D` rule (banked into B4's first commit); and the docs-only-PR untracked-doc collision pattern banked into B4's CLAUDE.md updates.
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. **CONTEXT.md overrides CLAUDE.md where they differ — it's newer.**
3. `docs/design-v2-PRD.md` — product requirements for the redesign. Read fully. Pay attention to:
   - § 3.6 Tenant Admin (or equivalent — confirm section number) — defines the Tenant Admin dashboard surface
   - § 3.1 Cross-cutting (sidebar nav shell) — B4 already shipped the shell; B5 only adds tenant-admin-specific nav items inside it
   - § 4 Out of scope — confirms what B5 must not absorb
   - Open questions in § 7 — flag any that touch tenant admin surfaces, especially around audit logging or billing surfaces
4. `docs/design-v2-implementation.md` — phased PR plan. Focus on the **PR B5** section. Treat its file listing as starting hypotheses, not directives (B-series retrospective lesson).
5. `mocks/concept-4-complete.html` — canonical visual source of truth. Locate:
   - The Tenant Admin dashboard view (search `data-screen="tenant"` or equivalent)
   - The Company Config tile section (search `Company Config`, `companyMinimums`, `min API`, or visual cues — 6 tiles per the implementation plan)
   - The Edit Config modal markup (search `.modal`, `.config-modal`, or whatever the mock uses)
   - The Tenant Admin sidebar items list — confirm what differs from the manager sidebar shipped in B4
   - The Users-by-role distribution card and Branch health cards (per implementation plan — confirm presence/absence in mock)
6. **B-series retrospectives** — read inline notes in `design-v2-implementation.md` for B1 / B2 / B3 / B4, plus the latest entries in `docs/CONTEXT.md` § Where we left off (PR #52 close + any subsequent retrospectives). Four lessons apply directly:
   - Speculative file listings in the implementation plan are **starting hypotheses, not directives**.
   - Mock-vs-code surface-gap audit before any code.
   - Honest data-availability check — don't fabricate routes, accounts, or data the codebase doesn't actually have.
   - Implement the mock faithfully — do not redesign mid-flight.

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match the SHA in `docs/CONTEXT.md` § Current main HEAD. If either fails: STOP, surface in chat, do not absorb the discrepancy. (Per the audit-on-arrival safeguard introduced in PR #42 — every B-series PR has run this check; the protocol is the value, not the find.)

## Session scope

**In scope (PR B5 only):**

- **Editable `config/companyMinimums` write path.** The only behavioural deliverable in Track B (v2). Tenant admin can read + edit the document at `tenants/{tid}/config/companyMinimums`. Per AgencyTrack domain knowledge, the canonical default is `annualAPI: 200000` (sourced from `goalsService.js` `getCompanyMinimums()` fallback). Form + validation + confirmation modal + write path. Pre-write read seeds the form (no blind writes). See §Write-path discipline gate below.
- **Tenant Admin sidebar differentiation.** Deferred from B4 (intentional boundary — B4 shipped role visibility for agent / unit_manager / branch_manager / sales_manager but Tenant Admin items were left aligned with the manager set). Tenant Admin sidebar items now diverge from unit/branch/sales manager items per the mock and PRD. Audit confirms which mock items become real B5 surfaces (Company Config), which are deferred-data stubs (Audit Log, Billing — confirm against codebase reality), and which get dropped entirely.
- **Confirmation copy + validation for the write path.** TTD currency input, `parseFloat` enforced, no negative values, sensible upper bound (proposed: TTD 10,000,000 — confirm via audit), confirmation modal copy along the lines of:
  > "You're updating the company minimum API for all agents to TTD X. This affects N agents' floor goals. Confirm?"
  Modal closes only on write success (no optimistic UI). Modal has focus trap + Escape to cancel + returns focus to trigger. Audit confirms whether `N agents` counter requires a separate read or can derive from already-loaded data.
- **Sidebar item routing for tenant-admin-only surfaces.** Surfaces that don't yet exist in the codebase (Audit Log, Billing per mock) get **deferred-data stubs only** — no Cloud Function triggers, no new Firestore collections, no new routes. Audit confirms which mock items become real B5 surfaces (Company Config, plus anything else the codebase already supports) vs stubs vs dropped entirely. Same scope-decision pattern as B4's Reports / Audit Log handling.

**Out of scope (do not expand into):**
- Sidebar shell behavior — B4-locked
- Activity feed / BadgeGrid — B3-locked
- Goal carousel / donut — B2-locked
- Medal badges — B1-locked
- New routing library
- New Firestore collections beyond what `config/companyMinimums` already implies (the doc itself probably already exists with default values per the existing `goalsService.js` fallback chain — audit confirms current document state)
- Wizard or Step files (per CLAUDE.md, never touched)
- User-management flows (HIGH#1 in `docs/FOLLOW_UPS.md` — separate fix, do not absorb)
- Manager-side dashboards beyond the sidebar nav-item differentiation
- Notification drawer redesign
- Any chrome layout changes beyond what the new tenant-admin sidebar items require
- Audit Log surface — deferred-data stub only, no Cloud Function triggers, no new collections
- Billing surface — deferred-data stub only, no payment integration, no new collections
- The cross-branch Sales Manager target layer (planned Phase 9, not yet built — explicitly out of B5)
- Persistency floor write path — only the `annualAPI` field is in B5's editable scope unless the audit shows the field already exists in `companyMinimums` and Kyron approves absorbing it

**Files Claude Code should read for the audit (starting points only — the actual change set comes from the audit, not from `docs/design-v2-implementation.md` § B5 Files):**

- `src/services/goalsService.js` — confirm the existing `getCompanyMinimums()` read pattern. Verify it tolerates a missing `companyMinimums` document and falls back to `200000`. Confirm whether the field is `annualAPI` or `minAPI` (the implementation plan uses `minAPI`; CLAUDE.md uses `annualAPI` — the audit confirms which is real). Same exercise for any `setCompanyMinimums` or equivalent — if absent, the write path is new.
- `firestore.rules` — **CRITICAL.** Confirm whether writes to `tenants/{tid}/config/companyMinimums` are restricted to `role === 'tenant_admin'`. If they're not, this is a SECURITY surprise-stop (see §B5-specific surprise-stop triggers).
- `src/App.jsx` — confirm where tenant_admin currently routes. The implementation plan suggests two options: (a) branch inside `ManagerDashboard.jsx` on `role === 'tenant_admin'`, or (b) route to a new `<TenantAdminDashboard />`. Audit recommends one based on existing branching density.
- `src/components/dashboard/ManagerDashboard.jsx` — confirm whether tenant_admin currently sees the manager dashboard, what tabs render for that role, and whether B4's sidebar wraps it correctly.
- `src/components/shell/Sidebar.jsx` (or wherever B4 landed the sidebar component — audit confirms file location) — locate the role-aware nav-item map. B5 extends the tenant_admin branch.
- `src/utils/formatters.js` — confirm the role label map (per HIGH#2 in `docs/FOLLOW_UPS.md`, the `sales_manager` label is missing). Surface this as an absorb-or-defer decision (see §B5-specific surprise-stop triggers).
- `src/index.css` — locate `:root` and `.dark` blocks for any new tokens (confirm B1/B2/B3/B4 prefix convention `--color-*` is followed). Locate end of file for new class block — B1 → B2 → B3 → B4 each appended; B5 follows the pattern.
- `mocks/concept-4-complete.html` — lift Tenant Admin dashboard markup, Company Config tile CSS, and Edit Config modal CSS verbatim. Identify per-role nav item lists. Confirm whether the mock's tenant-admin-specific surfaces (Audit Log, Billing) have any backing data assumption or are pure visual placeholders.
- `package.json` — verify no new dependencies are required. Modal patterns should reuse existing utilities (focus trap, etc.). If a focus-trap library was added in B4, reuse it.
- `src/context/AuthContext.jsx` — confirm `role` and `tenantId` are reliably available where the `<CompanyConfigPanel>` (or equivalent) renders. Confirm `tenantId` is non-null for tenant_admin (per CLAUDE.md, only `platform_admin` has `tenantId: null`).
- `firestore.indexes.json` — confirm no new indexes are required (B5's reads/writes are document-level, not query-based).
- `scripts/exploration-walk.cjs` — confirm whether B5 needs new assertions (e.g., Tenant Admin landmark, Company Config tile presence). Today the script logs in as the agent only. Tenant-admin verification will likely be manual screenshots — confirm during audit.

> **B-series retrospective audit lesson — apply here:** `docs/design-v2-implementation.md` § B5 lists `CompanyConfigPanel.jsx`, `EditConfigModal.jsx`, `RoleDistributionCard.jsx`, `BranchHealthCards.jsx` as files to create. **Treat all of this as starting hypotheses, not directives.** B1 corrected awards-panel listings. B2 corrected `personalCommitment` → `personalAnnualAPI` and `extractFields.api` → `extractFields.apiSold`. B3 caught `MotivationalCarousel.jsx` was not orphaned. B4's corrections clustered around routing assumptions and sidebar items routing to non-existent surfaces. B5's most likely corrections: the actual field name on `companyMinimums` (`annualAPI` vs `minAPI`), whether `RoleDistributionCard` and `BranchHealthCards` are real B5 deliverables or speculative additions the audit confirms aren't in the mock, and whether the tenant-admin dashboard already has stub tabs that the new surface plugs into.

> **B-series retrospective surface-gap lesson — apply here:** Confirm the mock's tenant-admin sidebar items actually map to real surfaces. The implementation plan calls out `Audit Log` as deferred-data, but Billing, Roles & Permissions, and any "All Users" surface need explicit audit-vs-mock reconciliation. **Surface every gap as a decision (stub link / hide / defer), don't silently render dead items.**

> **Honest data-availability check (B3/B4 lesson):** If a sidebar nav item routes to a surface that doesn't exist (e.g., "Billing" tab when no billing infra exists), surface as a scope decision before coding. Do not fabricate destinations. Do not stub a route to a 404 component.

## Decisions locked — do not re-litigate

These are settled before the session starts. If the audit surfaces a reason to revisit, treat it as a surprise-stop — do not unilaterally override.

### Write target
- **One Firestore document only:** `tenants/{tenantId}/config/companyMinimums`.
- **One field in scope for B5:** the company-minimum annual API. Confirm the field name during audit (`annualAPI` per CLAUDE.md vs `minAPI` per implementation plan — exactly one is correct, the codebase arbitrates).
- **No new collections.** No new Cloud Function triggers. No audit-log writes (see §Write-path discipline gate § Audit trail).

### Editable surface
- **Tenant Admin only.** Other roles (agent, unit_manager, branch_manager, sales_manager) cannot read or write the config surface. Verified at three layers: sidebar visibility, route-level branching, Firestore rules.
- **One editable tile in B5:** company minimum annual API. Other tiles per the mock (Currency, Fiscal year, Week start day, Self-registration toggle) are **display-only stubs** in B5. Persistency floor is **deferred** unless audit shows the field already exists on `companyMinimums` and Kyron approves absorbing it (decision-point, not a default).

### Validation rules (client-side, mirrored in Firestore rules)
- `parseFloat` enforced before write — never store as string.
- Numeric only. Minimum: 0 (zero allowed only if Kyron explicitly approves; default is `> 0`).
- Maximum: TTD 10,000,000 (proposed sensible upper bound). Audit-phase deliverable: query the pilot tenant for the highest existing `personalAnnualAPI` across all agents and the highest agent-of-the-year API achievement. The cap must be at least 2× the highest observed value to provide headroom without false rejection during legitimate company-minimum increases. If the audit surfaces values that compress the headroom too tightly (e.g., highest `personalAnnualAPI` > TTD 5,000,000), surface a revised cap proposal in the plan rather than locking 10M unilaterally.
- TTD currency input formatting via existing `formatCurrency()` from `formatters.js` for display; raw number for write.
- Required field — empty submit blocked.
- **Firestore rules MUST also enforce the same constraints.** If they don't currently, that's a SECURITY surprise-stop — see triggers below.

### Confirmation modal behavior
- Modal opens on Edit click, with form pre-seeded from a fresh read of the current `companyMinimums` document (pre-write read — no blind writes).
- Save button shows the diff in the confirmation copy: "You're updating the company minimum API for all agents from TTD X to TTD Y. This affects N agents' floor goals. Confirm?"
- Save button disables on click, shows spinner.
- **Modal closes only on write success.** No optimistic UI. On error, modal stays open and surfaces a specific error (permission denied vs network failure vs write conflict).
- Cancel discards changes, no write.
- Escape cancels (a11y).
- Focus trap when open — first focusable receives focus on open; cycle Tab/Shift+Tab.
- Returns focus to the Edit trigger button on close.
- `aria-modal="true"`, `role="dialog"`, `aria-labelledby` pointing at the modal heading.
- Reduced-motion guards on any open/close animation.

### Tenant Admin sidebar items (mock arbitrates final list)
- Per `docs/design-v2-implementation.md` § B5: Dashboard · Branches · All Users · Roles & Permissions · Company Config · Campaigns · Audit Log *(deferred-data stub)* · Billing *(stub)* · Settings.
- B5 audit confirms which of these have real backing surfaces, which are deferred-data stubs, and which (if any) get dropped entirely.
- Items routing to surfaces that don't exist render as stub links with `aria-disabled="true"` and a "Coming soon" affordance, OR are hidden entirely — pick one consistently per the mock.
- **No new routes / no new dashboards** beyond the Company Config surface and any stubs.

### Token naming
- All new CSS variables use the `--color-*` prefix (B1/B2/B3/B4 retrospective — locked).
- Add tokens to BOTH `:root` and `.dark` blocks. Light + dark designed together.
- **Reuse existing semantic tokens where possible:** `--color-surface`, `--color-surface-muted`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-primary-tint`, `--color-border`. Only add new tokens for surfaces that don't fit existing roles (e.g., a "danger" / "destructive" tone for the confirmation modal's emphasis, if the mock specifies one).

### A11y — bake in from the start (B-series retrospective lesson)
- **Form labels:** every input has a `<label>` (not just `aria-label`). Currency input has `aria-describedby` pointing at the help text ("Minimum API per agent, in TTD").
- **Validation errors announced:** invalid input gets `aria-invalid="true"`, error text in a `aria-live="polite"` region.
- **Modal a11y:** focus trap + Escape + return focus + `role="dialog"` + `aria-modal` (per §Confirmation modal behavior above).
- **Reduced-motion guards** on modal animations.
- **Keyboard:** every interactive element keyboard-reachable in DOM order. Focus rings visible (`focus-visible:ring-2 focus-visible:ring-primary/40` per existing pattern).
- **Color contrast:** Save button (active + disabled), error text, confirmation copy — all ≥ 4.5:1 against their backgrounds in both modes.
- **Heading hierarchy:** Tenant Admin dashboard `<h1>` → section `<h2>` → tile/card `<h3>` (no skips). Confirm B4's shell-level heading structure isn't disrupted.

### Project-wide policy (recap)
- Lucide React for icons.
- No emojis as structural icons.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`).
- Both light and dark mode tested before opening PR.
- Verification artifacts stay local — never commit.

Plus everything in `docs/CONTEXT.md` § Locked decisions.

### Banked items landing in B5's first commit (single docs commit, conventional title)
B5's first commit bundles three banked items in addition to the standard CONTEXT.md SHA bump:

1. **CONTEXT.md SHA bump** — standard B-series first commit.
2. **CLAUDE.md preview URL pattern fix** (banked from PR #52 retrospective) — the documented pattern `agencytrack-git-{branch}.vercel.app` doesn't match real Vercel preview URLs, which include `-kyron-marchan-s-projects` (or equivalent) per Vercel's per-team URL scheme. Update the CLAUDE.md preview URL line to the actual pattern Vercel emits.
3. **CLAUDE.md `.env.local` worktree-propagation note** (banked from PR #52 retrospective) — `.env.local` does NOT auto-propagate to feature worktrees; verification scripts that depend on `.env.local` (e.g., `A11Y_AGENT_PASSWORD`) need explicit setup in each worktree, OR a documented inheritance step. Add a CLAUDE.md note covering this so future B-series PRs don't lose verification time rediscovering it.

Suggested commit title: `chore(docs): bump CONTEXT.md to <sha> + CLAUDE.md preview URL + worktree env note`.

Frame all three as standard hygiene, not exception. Single commit. No code changes mixed in.

## Write-path discipline gate (B5-specific)

This is the only write-path PR in Track B (v2). The discipline below is non-negotiable; any deviation is a surprise-stop.

### Pre-write read
The form must perform a fresh read of `tenants/{tid}/config/companyMinimums` and seed inputs from the current state. **Do not write blindly.** If the read returns no document (the doc doesn't exist yet for this tenant — entirely possible per goalsService.js's fallback), surface as a state — the write path needs a create-vs-update branch.

### Optimistic UI is forbidden
Modal stays open until write completes. Save button disables on click and shows a spinner. Modal closes **only on write success**. On failure, modal stays open and surfaces the specific error.

### Error states (each gets a specific message and recovery path)
- **Permission denied** (Firestore rules reject the write) — "You don't have permission to update company config. Contact your platform admin." Logs to console with rule context. No retry button.
- **Network failure** (offline / timeout) — "Couldn't reach the server. Check your connection and try again." Retry button keeps the modal open with the user's input intact.
- **Write conflict** (rare; doc updated server-side between read and write) — "Someone else just updated this. Refresh to see the latest." Retry button refetches and reseeds the form.
- **Validation error** (client-side, before any write) — inline under the field, never as a generic toast. Specific copy per rule (negative number, exceeds max, empty, non-numeric).

**No silent failures.** Every catch path surfaces a user-visible message. No `console.error(...)` without a UI update.

### Firestore rules enforcement (mandatory)
Client-side validation runs first for UX, but the source of truth is `firestore.rules`. If the rules currently allow any authenticated user (or any role beyond `tenant_admin`) to write `tenants/{tid}/config/companyMinimums`, **that is a SECURITY surprise-stop** — the rules fix lands as a separate PR before B5's write path goes live. Do not ship the write path on top of permissive rules.

Rule-level constraints to verify:
- `request.auth != null`
- `request.auth.token.role == 'tenant_admin'`
- `request.auth.token.tenantId == tenantId` (path scope)
- Data shape: `request.resource.data.annualAPI is number && request.resource.data.annualAPI > 0 && request.resource.data.annualAPI <= 10000000` (or whatever the validation max is locked to)

If any of these are missing, surface in chat with a proposed rules change and wait for Kyron's approval before extending the rules in B5's scope. The rules fix may absorb into B5 (cheap, 1 file, ~10 lines) or land as a separate prerequisite PR — Kyron decides.

### Audit trail consideration
B5 does **not** ship an audit log. The mock shows an Audit Log sidebar item, but that surface is a deferred-data stub (per §Decisions locked § Tenant Admin sidebar items).

The decision-point is: should the `companyMinimums` write path log who-changed-what-when, even without a viewable surface? Two possible answers:
- **Yes** — log to a new collection (e.g., `tenants/{tid}/auditLog/{eventId}` with `{ actorUid, actorRole, target: 'config/companyMinimums', before, after, ts }`). This expands B5's scope (new collection, new write path, rules for the audit collection). File as a follow-up if absorbed; flag explicitly if not.
- **No** — tenant admin trust model assumes the actor is accountable through other means (Firebase Auth user records + Firestore document `updatedBy` / `updatedAt` fields on the config doc itself). Document the decision in PR description so it's not silently assumed.

**Audit-phase deliverable:** surface this decision-point to Kyron in the plan output. Default recommendation: option 2 (no separate audit log; add `updatedBy: uid` and `updatedAt: serverTimestamp()` to the document write) unless Kyron flags compliance/regulatory concerns.

## What to do first

**Option A — Plan first (use this for B5):**

> Do not write code yet. Produce a work plan in chat covering:
>
> 1. **Audit current state vs scope.** Read the files listed in §Session scope. Confirm:
>    - The exact field name on `companyMinimums` (`annualAPI` per CLAUDE.md vs `minAPI` per implementation plan — name the file and line where the truth lives).
>    - Whether `getCompanyMinimums()` in `goalsService.js` tolerates a missing document and falls back to `200000`. Name the line.
>    - Whether a `setCompanyMinimums()` (or equivalent write helper) already exists. If yes, name it. If no, B5 adds one.
>    - The current `firestore.rules` posture for `tenants/{tid}/config/companyMinimums` writes. Quote the relevant `match` block. **If rules don't restrict to `role == 'tenant_admin'`, surface as a SECURITY surprise-stop in this same plan output — do not silently absorb a rules fix.**
>    - Whether the `companyMinimums` document currently exists in the pilot tenant. If unknown / unreachable from local tooling, surface as a discovery.
>    - The role-label map at `src/utils/formatters.js:8-16` — confirm the HIGH#2 sales_manager gap. Surface the 1-line fix and ask Kyron whether to absorb into B5's first commit (cheap absorb) or keep separate (clean PR boundary). Don't auto-decide.
>    - The B4 sidebar component's tenant_admin branch — name the file, name the lines where role-aware items render, identify the diff B5 introduces.
>    - Whether `App.jsx` currently routes tenant_admin separately or if `ManagerDashboard.jsx` branches on `role === 'tenant_admin'`. Recommend (a) extend the existing branch or (b) introduce a `<TenantAdminDashboard />` component, with one-line justification.
>    - Heading hierarchy on the tenant-admin dashboard surface under the B4 shell. `<h1>` → `<h2>` → `<h3>` no skips.
>    - **Test account discovery.** Confirm whether a `tenant_admin` test account exists. (Per B4 audit, this should already be resolved — confirm via `docs/CONTEXT.md` or by reading the env-var pattern.) **If no `tenant_admin` test account exists or is reachable, surface as a discovery — Kyron provisions before code starts.**
>    - Whether `scripts/exploration-walk.cjs` needs any new assertions (Company Config tile presence, Edit modal landmark, validation error live-region). The script currently logs in as the agent only; tenant-admin verification will likely be manual screenshots — confirm.
>
> 2. **Mock-vs-code parity check (Tenant Admin focus).** For the tenant_admin role, confirm:
>    - The mock's tenant-admin dashboard surfaces map to real codebase routes/components. Surface every gap (item routes to nothing, surface assumed but not built).
>    - The mock's Tenant Admin sidebar items vs the codebase's existing tenant_admin tab labels (under B4's sidebar). Per-item gap analysis: real surface vs deferred-data stub vs drop entirely.
>    - The mock's Edit Config modal markup vs any existing modal pattern in the codebase. Reuse existing modal infra if present (e.g., `ReportRangeModal.jsx`); only introduce new modal infra if nothing reusable exists.
>    - The mock's Company Config tile section vs the implementation plan's 6-tile assumption. The mock arbitrates final tile count and which are editable.
>
> 3. **File-by-file change map** with risk assessment per file. Distinguish "additive" (new tenant-admin component, new tokens, new CSS class block, new write helper) from "structural" (sidebar items map extension, App.jsx branch) from "policy" (firestore.rules update, if absorbed) from "tooling" (`scripts/exploration-walk.cjs` if applicable). For any file in the implementation plan's B5 list that the audit shows is unrelated, drop it from the change set with a one-line justification.
>
> 4. **Firestore rules verification + plan.** Quote the current rule for `tenants/{tid}/config/companyMinimums` writes. State whether it's safe (restricts to `tenant_admin`, tenant-scoped, validates data shape) or unsafe. If unsafe, propose the rule diff and ask Kyron: absorb into B5 (cheap, 1 file) or land as a separate prerequisite PR. **If unsafe and not addressed, the write-path code does not ship.**
>
> 5. **Tenant-admin preview matrix plan.** B4 shipped the all-roles matrix. B5's primary verification is tenant_admin × {1440px, 1024px, 768px, 390px} × {light, dark} = 8 render-state checks for the new surface. Plus sanity checks on the other 4 roles to confirm they cannot access the Company Config tile or sidebar item — call those drive-by verifications, not full matrix checks. Enumerate the exact assertions per breakpoint per theme: tile renders, edit modal opens/closes/focus-traps, validation error displays, save success closes modal, save failure keeps modal open with error.
>
> 6. **A11y verification plan.** Form labels + `aria-describedby` for input help text. `aria-invalid` + live-region announcements for validation errors. Modal focus trap + Escape + return focus. Reduced-motion guards on modal animations. Color contrast on Save button states (active, disabled, error) at light + dark.
>
> 7. **Audit-trail decision.** Default recommendation per §Write-path discipline gate § Audit trail (option 2: `updatedBy` + `updatedAt` fields on the doc, no separate audit collection) unless the audit surfaces a compliance concern. Name the call and the reason.
>
> 8. **Stub-vs-defer-vs-drop decisions for tenant-admin sidebar items.** For each mock item (Audit Log, Billing, Roles & Permissions, etc.) that doesn't have a real surface: stub link with `aria-disabled` / "Coming soon" affordance, hidden entirely, or dropped from sidebar. Pick one consistently. Justify briefly.
>
> 9. **Open questions for me to answer before code starts.** Especially: rules-fix absorb-or-defer, sales_manager label-map fix absorb-or-defer, audit-trail decision, validation max bound (TTD 10,000,000 vs other), persistency-floor in-or-out, stub-vs-defer-vs-drop on each tenant-admin nav item.
>
> I'll review and approve before any code is written.

## Autonomous scope — what Claude Code can do without further check-in (after plan approval)

> 1. Sync main: `git fetch origin && git pull origin main` (per locked feedback memory).
> 2. Create worktree branch off `origin/main` HEAD (verify SHA against `docs/CONTEXT.md`).
> 3. **First commit on the branch must bundle the CONTEXT.md SHA bump AND the two CLAUDE.md updates banked from PR #52** (preview URL pattern fix + `.env.local` worktree-propagation note). Single commit, conventional title `chore(docs): bump CONTEXT.md to <sha> + CLAUDE.md preview URL + worktree env note`. Drafted directly inside the B5 feature worktree (per CLAUDE.md banked rule from PR #51).
> 4. Implement changes per the approved plan.
> 5. `npm run lint && npm run build` — must both pass.
> 6. Commit (conventional commits, per CLAUDE.md). Suggested sequence: docs commit (step 3) → token additions (if any) → CSS additions → write helper in `goalsService.js` → `firestore.rules` update (if absorbed) → `<EditConfigModal>` (or whatever the audit lands on) → `<CompanyConfigPanel>` → tenant-admin dashboard wire-up (`ManagerDashboard.jsx` branch or new `<TenantAdminDashboard />`) → sidebar item map extension.
> 7. Push to feature branch.
> 8. Open PR titled `feat(design-v2-b5): tenant admin company config surface + write path` with description covering: scope, file count breakdown, tenant-admin preview matrix verification (8 cells), other-role drive-by verification (cannot-access checks), Firestore rules state (quoted before/after), write-path failure-mode verification (permission denied / network failure / validation error each demonstrated), audit-trail decision, dark-mode verification, a11y verification, open follow-ups.
> 9. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh <sha> --target preview --pr <PR#>`.
> 10. Run preview walkthroughs **for the tenant_admin role**, plus a drive-by per other-role test account confirming the Company Config tile is absent. The exploration-walk script today logs in as the agent only — for B5, run the agent walkthrough as a regression check, plus manual login + screenshots per role per tenant_admin breakpoint.
> 11. Post the verification summary in PR comments. Include: 8-cell tenant-admin matrix render confirmations, drive-by confirmations for the other 4 roles, write-path success + failure-mode demonstrations (screenshots showing each error state), modal focus-trap manual confirmation, reduced-motion check, single-`<main>` invariant survival.
> 12. **STOP at preview-verified.** No merge. Kyron merges manually.

## Hard rules — non-negotiable, applies every session

- **Worktree branch only.** Never push directly to `main`. Branch off `origin/main` HEAD.
- **Always pull main before branching:** `git fetch origin && git pull origin main` (per existing feedback memory).
- **Docs drafts live inside the feature worktree** (per PR #51 retrospective banking) — do not draft in main worktree, do not draft in a sibling worktree.
- **No auto-merge.** Push → PR → preview Ready → tenant-admin matrix walkthrough + drive-by other-roles → STOP for human merge.
- **Post-merge verification (tightened in PR #50):** `git fetch origin && git pull origin main && git log origin/main --oneline -5` to confirm squash SHA — the pull is required so worktree-local tooling matches production. Then production walkthrough via `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=design-v2-b5_production`.
- **Worktree teardown after merge.** `git worktree remove <path>` then `git worktree prune`. **Local branch deletion uses `git branch -D <feature-branch>`** (force, per CLAUDE.md banked rule).
- **Never echo `.env.local` values** to chat output, PR comments, logs, or screenshots. Reference by env var name only.
- **Verification artifacts stay local.** Logs, screenshots, one-off verification scripts — never commit.
- **No emojis as structural icons.** Lucide React only.
- **No hardcoded hex outside CSS variables** (except `AgentReportDocument.jsx`).
- **All new tokens use `--color-*` prefix** (B-series locked).
- **Implement the mock faithfully — do not redesign.** Form CSS and modal CSS are lifted from `mocks/concept-4-complete.html` and refactored only to swap mock tokens for project `--color-*` tokens. If a mock element has no live equivalent (stub item, surface that doesn't exist), surface as a surprise-stop. The only design decisions this session are token-name mappings, sidebar item stub-vs-defer-vs-drop, and the audit-trail call.
- **No new routing library.**
- **No new Firestore collections** beyond what `companyMinimums` already implies. The write path updates one document; no audit-log collection unless Kyron explicitly approves it during plan review.
- **Both light + dark mode tested** before opening PR — for tenant_admin specifically, plus drive-by the other 4 roles.
- **A11y is not a follow-up.** Form labels, modal focus trap, Escape, return focus, ARIA invalid + live region, reduced-motion guards — all ship in the PR.
- **Optimistic UI is forbidden** for the write path (per §Write-path discipline gate).
- **Firestore rules enforcement is a hard floor.** If rules don't restrict the write to `tenant_admin`, the write path does not ship until they do (per §Write-path discipline gate).

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** If you hit the same kind of unexpected friction twice in a row on this session — two ambiguous mock-vs-code disagreements, two retries on the same step, two dark-mode contrast issues, two unsafe-rules surfaces, two sidebar items routing to non-existent surfaces — STOP and wait for me, regardless of progress. Counter resets at the start of each new session.

### B5-specific surprise-stop triggers

- **Firestore rules don't restrict `companyMinimums` writes to `role === 'tenant_admin'`** — would mean any authenticated user can update company-wide minimums. **SECURITY surprise-stop.** Surface before any code, including the rules fix itself if it's larger than ~10 lines. Kyron picks: absorb into B5's first non-docs commit, or land as a separate prerequisite PR.
- **`config/companyMinimums` document doesn't exist** in the pilot tenant — `getCompanyMinimums()` falls back to `200000` in code, but the write path needs an explicit create-vs-update branch. Surface during audit; the create branch is a small addition but must be explicit, not assumed.
- **Tenant-admin sidebar items in the mock route to surfaces with no Firestore data backing** (Audit Log, Billing, possibly Roles & Permissions) — same scope-decision pattern as B4's "Reports" handling. Don't fabricate destinations. Stub-vs-defer-vs-drop per item, surfaced as a decision point.
- **`goalsService.js` `getCompanyMinimums()` fallback breaks under B5's write path** — confirm B5's writes don't accidentally regress the fallback to `200000` for new tenants whose document hasn't been seeded yet. Audit-phase verification.
- **HIGH#2 `sales_manager` label-map gap fix** at `src/utils/formatters.js:8-16` — ~1 line. Audit-phase deliverable: surface the file, surface the 1-line fix, ask Kyron whether to absorb into B5 (cheap absorb) or keep as a separate tiny PR. Default: ask, don't auto-decide.
- **The mock's Tenant Admin dashboard surfaces (Users-by-role, Branch health) require new Firestore reads** that don't fit B5's "no new collections" boundary. If the mock shows a tile that requires `tenants/{tid}/meta/branches` and that path doesn't exist in the codebase, surface as a scope decision (defer to Track C? deferred-data stub?). Don't silently add reads.
- **The audit-trail decision** turns out to be load-bearing — i.e., the field name `updatedBy` collides with an existing `companyMinimums` field, or compliance concerns surface that demand a separate audit collection. Surface as a scope question; don't quietly add a new collection.
- **Validation max bound is wrong** — TTD 10,000,000 is a proposed sensible upper bound. If the audit shows existing agents have personal goals above that (extremely unlikely but possible), surface and revise upward.
- **Modal infrastructure already exists** — `ReportRangeModal.jsx` or another modal pattern that B5 should reuse rather than reinvent. Audit-phase deliverable: surface what's reusable vs net-new.

Discipline gates are the value of this workflow. They're not friction — they're catching bugs before they ship. B1 caught two surface-gap surprises. B2 caught two field-name drifts. B3 caught the MotivationalCarousel non-orphan + 4-event-type vision pared back to 2. B4's surprises clustered around routing assumptions and sidebar items routing to non-existent surfaces. **B5's most likely surprises cluster around Firestore rules state, the `companyMinimums` document existence, and tenant-admin sidebar items routing to non-existent surfaces.**

## Stash / pending state from prior sessions

Read `docs/CONTEXT.md` § Pending operational state. Surface anything notable in chat before starting B5. Known carry-overs as of B4 close:

- **Untracked legacy doc** at `docs/PR-3-Claude-Code-Brief.md` — stale, intentionally untracked across multiple PRs. Decide separately (archive or delete) — not B5 scope.
- **`MotivationalCarousel.jsx` consumption** — B4's manager-side header restructure may have touched `ManagerDashboard.jsx:24,247` (verify against current main HEAD post-B4). If the consumption line is gone, the file is now orphaned and can be deleted; surface as a decision (B5 absorb cleanup vs separate cleanup PR). If still consumed, leave alone.
- **GitHub "Automatically delete head branches" is ON** (confirmed via PR #50 cleanup). Worktree teardown should be clean. Local branch removal uses `-D`.
- **Open follow-ups in `docs/FOLLOW_UPS.md`:**
  - HIGH#1 — user-management flows (out of B5 scope, separate fix).
  - HIGH#2 — `sales_manager` label-map gap at `src/utils/formatters.js:8-16` — surface as absorb-or-defer decision (see §B5-specific surprise-stop triggers).
  - Dashboard heading-hierarchy harmonisation (LOW priority) — B5 should not regress.
  - Wizard UX + a11y hardening — out of B5 scope.

## Final stop condition

End the session when:
- PR B5 is open with Vercel preview verified for **tenant_admin** at 1440px desktop, 1024px tablet, 768px tablet-portrait, and 390px mobile in **both light and dark mode** (8 render-state checks for the new surface)
- Drive-by verification confirms the Company Config tile is absent for the other 4 roles (4 sanity checks)
- Edit Config modal opens, focus-traps, closes via Escape, closes via Cancel, returns focus to trigger
- Save success path closes modal and updates the on-screen value
- Save failure paths each surface a specific error message and keep the modal open: permission denied (rule-blocked), network failure (offline), validation error (client-side)
- Firestore rules verified to restrict `companyMinimums` writes to `role === 'tenant_admin'` (quoted in PR description)
- Firestore document state confirmed: write succeeds with `parseFloat`-enforced numeric value, `updatedBy: uid`, `updatedAt: serverTimestamp()` (or whatever the audit-trail decision lands on)
- Theme toggle still works in B4's TopBar; dark-mode persistence still works
- Existing single-`<main>` invariant holds on the tenant-admin dashboard (walkthrough step 2a still passes)
- Reduced-motion behavior verified on modal open/close
- Form label / `aria-describedby` / `aria-invalid` / live-region a11y verified at light + dark
- Test account login verified for tenant_admin; missing accounts surfaced and provisioned before this stop condition can be met
- All open questions for Kyron are listed at the end of the plan / PR description
- `npm run lint` and `npm run build` both green on the feature branch
- Two-strike counter is at 0 or surfaced if not

Post a summary in chat with: tree state, PR link, what's done (Company Config tile + Edit modal + write path + tenant-admin sidebar diff + first-commit doc bumps), Firestore rules state (safe before write-path ship — yes/no), what's blocked on Kyron, two-strike counter status, and the closing line: **"Track B (v2) complete. No B6. Next track is C — configuration & data."**

## ✂ COPY ENDS HERE ✂

---

## Notes for Kyron

- **Smaller PR than B4 but write-path surface area means the discipline matters more per line of code.** The §Write-path discipline gate is non-negotiable: pre-write read, optimistic UI forbidden, specific error messages per failure mode, Firestore rules as the source of truth. If rules don't currently restrict the write to `tenant_admin`, the brief stops the write-path code from shipping until they do.
- **Final PR in Track B (v2).** After B5 merges, the redesign sequence is complete. Track B (v2) closes. Any next track is a different scope entirely (Track C — configuration & data, real Tatil accounts, 2026 goals; Track D — cron + notifications verification).
- **Test-account discovery is light.** Primary verification is tenant_admin (likely already provisioned post-B4 — confirm during audit). Drive-by sanity checks on the other 4 roles to confirm they can't access the Company Config surface — those are quick, not full matrix passes.
- **Security rules verification is the largest unknown.** Equivalent of B4's routing-strategy uncertainty. The audit confirms whether `firestore.rules` currently restricts `companyMinimums` writes to `role === 'tenant_admin'` and whether it validates data shape. If not safe, the rules fix may absorb into B5's first non-docs commit (cheap, ~10 lines) or land as a separate prerequisite PR — your call when the audit surfaces it.
- **First commit bundles three banked items:** CONTEXT.md SHA bump + CLAUDE.md preview URL pattern fix (PR #52 retrospective) + CLAUDE.md `.env.local` worktree-propagation note (PR #52 retrospective). Single docs commit, drafted inside the B5 feature worktree per the PR #51 banking rule.
- **HIGH#2 `sales_manager` label-map fix is a 1-line absorb candidate.** The brief surfaces it as a decision-point in audit, not an auto-absorb. You pick: bundle into B5's docs commit (cheap), keep as a separate tiny PR (clean boundary), or defer further.
- **Audit-trail decision is a real decision, not a default.** Default recommendation in the brief is option 2 — `updatedBy: uid` + `updatedAt: serverTimestamp()` on the document write, no separate audit collection. If you want a real audit log surface (the mock's Audit Log sidebar item becoming real instead of stub), that's a scope expansion that lands as a follow-up, not in B5.
- **Stub-vs-defer-vs-drop on tenant-admin sidebar items** (Audit Log, Billing, possibly Roles & Permissions) is the equivalent of B4's "Reports" decision. The audit surfaces each item with a recommendation; you pick the consistent treatment.
- **"Tenant_admin matrix verified before merge" is a hard floor.** 8 render-state cells for the new surface (4 breakpoints × 2 themes) plus 4 drive-by other-role sanity checks. If any cell can't be verified (test account missing, Vercel preview broken), the PR doesn't ship.
- **No B6.** When B5 merges, the redesign sequence is done. The summary line at session close confirms it: "Track B (v2) complete. No B6. Next track is C — configuration & data."
