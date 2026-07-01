# PR-K10a - Unit Financing Roster (UM view + coach, read-only)

run_model: claude-opus-4-8
size: M
track: K (New-Agent Financing & Bonus Tracker)
depends_on: K1-K7 (merged). Reuses shipped single-agent engines + coachingNotes.
design_source: docs/handoffs/financing-selfview/Track_K_Unit_Financing_-_Unit_Manager_Build.html (Screen 2) + README.md
rules_change: NONE (security posture (a) - see below)
data_model_change: NONE
deploy_required: NO (no rules, no functions)

---

## RE-SCOPE ACKNOWLEDGEMENT (read first)

The CD Screen-2 premise - "role-gate the existing K7/K8 branch-manager roster" - is VOID.
Recon (worktree @ 2d34de2d) proved via git history that **K8 was never built**: K1 #748,
K2 #749, K3 #751, K4 #753, K5 #754, K6 #756, K7 #762, K9 #766 (docs-only) - no K8 commit.
There is NO financing roster to gate. `FinancingRiskPanel.jsx:14-16` explicitly disclaims
the roster as "K8's dashboard." The shipped financing manager surface is `FinancingTab`
mounting per-agent-dropdown panels (FinancingRiskPanel = single-agent miss/adjust monitor,
FinancingProrationPanel = single-agent override, MonthlyStatementEntry, etc.).

K10a therefore BUILDS the UM unit roster FRESH from the shipped single-agent engines +
fan-out, in a new UM-only read-only surface. It does NOT build the K8 BM dashboard first.
Scope of THIS PR: roster + read-only detail drawer + CoachNote (reuse) + locked
adjustmentPct/managerFinancing readouts + nav. The EscalateToBM tracked/ack collection is
DEFERRED to K10b (net-new collection + rules + index) - not built here.

## Security posture - LOCKED: option (a)

A UM reads their unit's agents' financing via `canManage` (which already admits a UM
tenant-wide on every financing read arm - firestore.rules:656 / 711-712 / 754-755) +
UI fan-out scoping. Unit membership comes from the user-doc `unitId` (the unit key IS the
UM's own uid), and `getTenantUsers` already self-scopes to the UM's unit
(`where('unitId','==',callerUid)`, managerService.js:45-46). ZERO rules/schema/migration
change. Documented residual (Rule 23 falsifier below): a UM with a raw out-of-unit agentId
could technically read that financing doc at the rules layer - the SAME residual settlements
carry today (a UM reading a non-managed settlement is ALLOW; firestore.rules:610-612). The
UI never surfaces out-of-unit agents; the smoke proves it. Option (b) (unitId denorm + rule
+ backfill) is the documented alternative if product later wants defense-in-depth - NOT this
PR.

---

## Phase 0 - Falsification (verify recon anchors; STOP + surface on any miss)

0.1 `getTenantUsers(tenantId)` self-scopes for a UM to `where('unitId','==',callerUid)`
  (managerService.js:45-46); BM branch-scopes; TA/PA full. Confirm - this is the roster's
  unit-scoping mechanism. HARD-STOP if it does NOT self-scope (option (a) collapses).
0.2 Every financing read arm is `canAccessOwn(...) || canManage(tenantId)` and `canManage`
  admits `unit_manager` (isManager includes it; firestore.rules:17-19, 41-43, 656, 711-712,
  754-755). Confirm - this is what lets the fan-out read each unit agent's financing without
  a rules change.
0.3 Financing docs carry NO `unitId` (validFinancingData / validFinancingMonth /
  validReconciliation check only agentId/tenantId/month(+core/proration)) - confirms option
  (a) is the only zero-migration path. Cite.
0.4 Single-agent engines to reuse in a per-row roster: `financingMissEngine` exports
  (`computeConsecutiveMisses` / `severityForCount` / `terminationConditionMet` /
  `findAdjustmentFlags`; CONFIRMED_BASES = ['submitted-final','settled-confirmed']). Confirm
  they take one agent's ledger and are pure. The miss counter is MONTHLY-consecutive (a
  month is a miss when actualAPI < validatingAPI on a confirmed basis) - NOT quarterly.
0.5 Write targets to DISABLE (K10a renders these read-only, never writes them):
  `setFinancingProration` (financingService.js:391-471; persists `managerFinancing` :451,
  `adjustmentPct` :452) is the confirm/override write in FinancingProrationPanel
  (input :368-378, Confirm button :403-408). Confirm. K10a's drawer shows the confirmed
  value + adjustmentPct as LOCKED readouts and omits the input + Confirm button.
0.6 CoachNote reuse: `coachingNotes` subcollection ships - service
  `addCoachingNote`/`getCoachingNotes` (coachingNotesService.js:37,70), UI
  `CoachingNotesModal.jsx`, rules match /users/{agentId}/coachingNotes/{noteId}
  (firestore.rules:911-961), managers-only + UM-scoped (`agentUnitId == request.auth.uid`).
  Confirm the create path denormalizes `agentUnitId` (coachingNotesService.js:41-48) so a
  coach-from-roster call MUST pass the agent's unitId.
0.7 Nav sources for the UM exclusion of the BM FinancingTab: PRODUCING_MANAGER_NAV financing
  `roles:['branch_manager']` (navConfig.js:111) + NAV_ITEMS financing roles
  (ManagerDashboard.jsx:93); render switch `activeTab === 'financing'` is NOT role-gated
  (ManagerDashboard.jsx:489). Confirm - K10a adds a SEPARATE `unit-financing` tabId, never
  reuses `financing`.
0.8 The financed-UM-in-own-roster edge: the fan-out filters `u.role === 'agent'`, so a UM
  (role unit_manager) does NOT appear in their own unit roster (their own financing is K9's
  My-Production self-view). Confirm the filter, one line.

Paste path:line evidence for 0.1-0.8 before proceeding.

---

## Phase 1 - Anchor confirm
1.1 New nav entry: where `unit-financing` goes in PRODUCING_MANAGER_NAV (UM-visible - either
  no `roles` gate or explicit `roles:['unit_manager']`) + WORKSPACE_TEAM_SECTIONS
  (navConfig.js:243-249) + a new render-switch arm in ManagerDashboard. Cite insertion pts.
1.2 Fan-out composition: `getTenantUsers` (unit-scoped for UM) -> filter role==='agent' ->
  per-agent `getFinancingTerms` + `listFinancingMonths` (financingService.js:292-305, single
  where, no composite index). Confirm the N-GET shape; no new index.
1.3 `basisBadge`/`FinancingBasisBadge` export + props (reused on every row's figures).
1.4 `CoachingNotesModal` props + how it's invoked today (so K10a wires it from the drawer).

---

## Phase 2 - Build the roster + read-only detail drawer

New surface (confirm dir Phase 1; e.g. `src/components/financing/UnitFinancingRoster.jsx`
+ a read-only `AgentFinancingDrawer.jsx`). Recreate the CD Screen-2 design in repo
conventions - the HTML is a high-fidelity REFERENCE, not code to copy.

### Roster
Topbar with a read-only tag ("Read-only - confirm & notify with your BM"). A reality strip
of unit-scoped aggregates (# on financing, total drawn (unit), confirmed this month,
at-risk count, >=2-misses count, ">10% adj - with BM" count). One row per unit agent: rank,
avatar + name + `financingStatus` chip, term progress + MONTHLY-miss count, confirmed draw
(LOCKED, "BM"), balance-vs-ceiling mini-bar, `adjustmentPct` (LOCKED readout), action
(Coach / View).

- **>10% flag = STATUS, not action.** Render as a disabled/locked pill "Notify Sales Admin -
  with Branch Manager" + a Coach action. The 5.3 notify is the BM's; the UM never fires it.
- **Miss counter = MONTHLY consecutive** on confirmed basis; provisional months show but
  never count; the UM has no path to confirm one (write is BM-gated,
  FinancingProrationPanel WRITE_ROLES excludes unit_manager; rules exclude UM on the write
  arm). Copy says "misses," never "quarters."
- **Surplus rows** (negative balance) render success-green = "owed to agent," ceiling bar
  near empty - NOT an error.
- **basisBadge** on every figure; a balance never renders without its `basisSource`.
- Every threshold ($37,500, 95%/90%, 6x ceiling, 25% tax) read from `config` - NEVER
  hardcoded (SPEC s11).

### Read-only detail drawer
The override drawer MINUS the input: proration calc, the LOCKED confirmed value ("set by
your Branch Manager - date"), `adjustmentPct` readout, and a footer with **Coach** (opens
the reused CoachingNotesModal). The **Flag to BM** action is DEFERRED to K10b - render it
disabled with a "coming soon" affordance OR omit it; do not wire a write.

### Fan-out failure handling
Partial fan-out failure -> show resolved rows ONLY; NEVER compute a unit aggregate or a
trigger count from a partial read (Compliance-v2 pattern). Loading = fan-out skeleton;
Empty = none in unit on financing; Error = partial -> resolved rows only.

---

## Phase 3 - CoachNote (reuse)
Wire the shipped `CoachingNotesModal` from the drawer/row Coach action. Managers-only;
NEVER rendered on the agent self-view (K9). The create call MUST pass the agent's `unitId`
(agentUnitId denorm) so the coachingNotes UM-scope rule (`agentUnitId == request.auth.uid`)
is satisfied. No new collection, no new service.

## Phase 4 - Nav
Add the `unit-financing` tabId to PRODUCING_MANAGER_NAV (UM-visible) + WORKSPACE_TEAM_SECTIONS
+ a new render-switch arm mounting `<UnitFinancingRoster/>`. Distinct from `financing`
(the BM FinancingTab). Confirm no collision and that the 5.3 BM-FinancingTab exclusion is
untouched.

---

## Phase 5 - Smoke (UM-signed-in, unit-scoped, value-level) - NON-WAIVABLE
Seed >=2 agents IN the UM's unit with financing terms + ledger (one miss-flagged, one with a
>10% adjustment, one surplus/negative-balance), AND >=1 agent OUTSIDE the unit (foil).
Sign in AS THE UM -> open Unit Financing:
5.1 Roster shows ONLY the unit's agents - the out-of-unit foil is ABSENT (proves the
  fan-out unit-scoping; the option-(a) residual is never surfaced).
5.2 The UM's OWN row is ABSENT (role filter).
5.3 The miss-flagged agent shows the MONTHLY-miss count (value-level); the provisional month
  shows but does not advance the count.
5.4 `adjustmentPct` + confirmed draw render as LOCKED readouts - NO proration input and NO
  Confirm button present in the DOM (assert absence).
5.5 The >10% flag is a STATUS pill ("with Branch Manager"), not an actionable control.
5.6 Surplus row renders success-green "owed to agent," not an error.
5.7 CoachNote: write a note from the drawer as the UM -> reload -> assert it persisted
  (real write-read cycle, exercises the coachingNotes UM-scope rule with agentUnitId).
5.8 No figure renders without its `basisSource` badge.
Use the out-of-unit foil for 5.1; value-level assertions throughout.

---

## Standing reminders
- Rule 19 (human-merge gate): money-adjacent AND reads other agents' financing + renders
  risk - HOLD for human review at PR-open. CC never merges/deploys. Option (a) = no rules
  change, so no `firebase deploy`.
- Rule 23 (falsifier): state the option-(a) residual explicitly (UM can technically read an
  out-of-unit financing doc via a raw agentId - accepted, matches settlements) AND the
  evidence it's contained (fan-out via getTenantUsers unit-scope; smoke 5.1 proves the UI
  never surfaces out-of-unit rows).
- Rule 22: >=1 known gap before PR-ready.
- Rule 21: poll Gemini + GLM; disposition every comment before PR-ready.
- Functional component; no inline styles; loading/error/empty all handled; all reads via
  service files. Strike 0/2. Build to PR-open and HOLD.

## Self-critique seed (carry into Rule 22)
- Option (a) residual (above) - confirm the smoke actually proves UI containment, not just
  that the happy path works.
- EscalateToBM deferred to K10b - the "Flag to BM" affordance must degrade cleanly, not be a
  dead button.
- If any reused single-agent engine assumes a single-agent render context (state, memo keys)
  that breaks in an N-row roster, surface it rather than papering over with per-row remounts.
