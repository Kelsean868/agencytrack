# Track I — Remaining work prep notes (I2 · I3 · §6)

**Status:** Analysis only. No code committed. Source-verified against `main @ 1eb6782` (the post-#266 + post-rank-fn-hoist-brief-PR HEAD; the rank-fn-hoist refactor itself lives on `feat/rank-fn-hoist` at the time of writing and does not change anything load-bearing here).
**Author:** CC autonomous run, 2026-05-22.
**Purpose:** Sketch how each remaining Track I piece would be built — storage shape, rule shape, indexes, UI surfaces, and the open decisions that need dispatcher input before a kickoff brief can be locked. This is a thinking-document. It is not a brief.

**Canonical design source:** `docs/AgencyTrack_TrackI_ManagerWAR_DesignSpec.md` (the locked Track I spec). All references like "§2 #3" or "§4" or "§6" point into that file unless otherwise noted.

---

## Already shipped (for context, then everything below is what's left)

I1 core is complete and merged. The remaining Track I work splits into three pieces, each independently buildable:

- **I2** — recruiting monthly roll-up. Adds `candidatesAssessed` + `agentsContracted` on a SEPARATE monthly collection (deliberately separate from the WAR's weekly recruiting fields — per spec §3, monthly-cadence stages should not surface as failures on flat weeks).
- **I3** — accountability flag. Tier 1 (visibility on the manager's own dashboard) + Tier 2 (notification escalation to the direct upline) per spec §4. Compares per-activity `actual` vs `resolved standard` already computed in I1.3c-ii (`getResolvedStandards`).
- **§6 (license-state)** — `licenseStatus` (`provisional` | `official`), derived `cbttExamDeadline = contractStartDate + 24mo`, ~90-day expiring-provisional compliance flag. Anchors on the existing `contractStartDate` (verified present on the user doc + already drives J1 tenure floors).

---

# I2 — Recruiting monthly roll-up

## What spec §3 locks

- **Weekly fields stay on the WAR** (already shipped in I1.1, fields `namesSourced`, `interviewsConducted`, `recruitsInFirstWeeks` — verified in `firestore.rules:693`, `ManagerWarTab.jsx:12-14`, `ManagerWarDetail.jsx:79-81`).
- **Monthly fields are NEW** and live on a separate collection so a flat recruiting week doesn't read as failure (it shouldn't — assessment/contracting are inherently low-volume per month).
- Two monthly fields: `candidatesAssessed`, `agentsContracted`.

## Proposed storage shape

Mirror the existing weekly WAR doc-id pattern + the persistency collection's monthly pattern:

| Aspect | Proposal | Reasoning |
|---|---|---|
| Collection path | `/tenants/{tid}/managerMonthlyRollups/{managerId}_{YYYY_MM}` | Mirrors `managerWeeklyReports/{managerId}_{weekStartISO}` (existing) and `persistency/{agentUid}_{YYYY_MM}` (existing `persistencyDocId` pattern at `persistencyService.js:59-61`). |
| Doc id shape | `{managerId}_{YYYY_MM}` | Predictable id = owner existence-check on null resource (same trick I1.1 uses at `firestore.rules:711` to allow owner pre-write reads). |
| Required fields | `managerId`, `tenantId`, `monthKey` (`YYYY-MM`), `managerRole`, `managerRoleRank`, `branchId`, `unitId`, `candidatesAssessed` (int ≥ 0), `agentsContracted` (int ≥ 0), `status` (`draft` \| `submitted`), `updatedAt`, optional `submittedAt`. | Same shape language as WAR — managerRole + managerRoleRank + branchId + unitId denormalized so upline rules can use the cheap `roleRank() > resource.data.managerRoleRank` predicate (now that the rank fn is hoisted). |
| Optional context fields | `notes` (free text, trim 1000) — capture qualitative reasons "only one contracted this month" | Mirrors WAR's `trainingTopic` pattern. |

**Why a separate collection, not extra fields on the WAR:** the spec is explicit (§3, last paragraph). Putting `candidatesAssessed` on each WAR would either (a) require monthly fields on weekly docs (4-5 weeks per month all showing the same number, error-prone) or (b) demand cross-week aggregation logic that adds query complexity for no benefit. A separate monthly doc is the smaller, clearer design.

**Why mirror WAR shape and not persistency shape:** WAR's privacy model is "owner RW, upline R" with rank-based scoping (`firestore.rules:639-722`). Persistency's privacy model is `manager-can-write-for-any-agent-in-scope` because managers enter persistency *for* their agents. I2 is the manager's OWN report about recruiting they ran — same privacy direction as the WAR.

## Proposed rule shape

Direct mirror of `managerWeeklyReports` (lines 648-722 in `firestore.rules`). The hoist of `roleRank()` to top-level (PR #268) means I2's block doesn't need any block-local rank helper:

```
// I2: manager monthly recruiting roll-up (candidatesAssessed + agentsContracted).
// Privacy = WAR direction: owner RW, upline R; peers + downline DENY.
match /managerMonthlyRollups/{rollupId} {
  function callerBranchId(tenantId) {
    return get(/databases/$(database)/documents/tenants/$(tenantId)/users/$(request.auth.uid)).data.branchId;
  }
  function uplineCanRead() {
    return roleRank() > resource.data.managerRoleRank
      && (
        getRole() in ['tenant_admin', 'platform_admin', 'sales_manager']
        || (getRole() == 'branch_manager'
            && callerBranchId(tenantId) == resource.data.branchId)
      );
  }
  function validRollupWrite() {
    let d = request.resource.data;
    return d.managerId == request.auth.uid
      && d.tenantId == tenantId
      && d.keys().hasAll([
           'managerId', 'tenantId', 'monthKey',
           'managerRole', 'managerRoleRank', 'branchId', 'unitId',
           'candidatesAssessed', 'agentsContracted',
           'status', 'updatedAt'
         ])
      && d.candidatesAssessed is int && d.candidatesAssessed >= 0
      && d.agentsContracted is int && d.agentsContracted >= 0
      && d.status in ['draft', 'submitted']
      && d.monthKey is string
      && d.managerRole in ['unit_manager', 'branch_manager', 'sales_manager']
      && d.managerRoleRank == roleRank();
  }
  allow create: if isSignedIn() && getTenantId() == tenantId
    && getRole() in ['unit_manager', 'branch_manager', 'sales_manager']
    && validRollupWrite();
  allow update: if isSignedIn() && getTenantId() == tenantId
    && resource.data.managerId == request.auth.uid
    && validRollupWrite();
  allow get: if isSignedIn() && getTenantId() == tenantId
    && (resource == null
        ? rollupId.split('_')[0] == request.auth.uid
        : resource.data.managerId == request.auth.uid || uplineCanRead());
  allow list: if getTenantId() == tenantId
    && roleRank() >= 2
    && (resource.data.branchId == callerBranchId(tenantId) || roleRank() >= 3);
  allow delete: if false;
}
```

## Is this a new rule? Does it trigger a Phase-1 stop next time?

**Yes — new collection, new rule block, new index for the upline list query.** Per CLAUDE.md's brief-completeness sub-bullet (Rule 17): "Briefs that introduce a new Firestore collection must enumerate ALL parts of the architectural unit explicitly in Phase 1 source-verify and Phase 2 edits." The full unit here is:

1. New rule block (above)
2. Composite index `(branchId ASC, monthKey ASC)` for the BM-scope upline list query (mirrors I1.3b's `(branchId ASC, weekStart ASC)` deployed in PR #260)
3. New service: `src/services/managerMonthlyRollupService.js` with `getRollup`, `saveRollupDraft`, `submitRollup`, `getRollupsForUpline`, etc.
4. UI: new monthly tab inside `ManagerWarTab.jsx`'s side region OR a sibling tab on `ManagerDashboard`. See "Open decisions" below.
5. Smoke verification: at minimum, monthly-doc owner create + upline read; cross-branch DENY; downline DENY.

The rule + index are **additive** → pre-merge deploy from the feature worktree is safe per CLAUDE.md's additive-deploy policy.

## UI surface — three options

| Option | Where it lives | Pros | Cons |
|---|---|---|---|
| **A** Extra tab inside `ManagerWarTab.jsx` (e.g. "Monthly Recruiting") | Same dashboard surface as the weekly WAR | One nav entry; mental adjacency ("this is also my filing") | WAR tab gets visually noisier; date semantics mix (week + month) |
| **B** Sibling tab on `ManagerDashboard` ("Monthly Recruiting") next to "My WAR" | Top-level nav | Cleanest separation of cadence; matches the spec's intent that monthly ≠ weekly | More clicks; "where do I file recruiting?" becomes a question |
| **C** Single panel that lives BELOW the weekly fields in `ManagerWarTab.jsx`, scoped to "the month containing the current week-start" | One screen, no extra nav | Always at-hand; no extra tab to remember | Same surface mixes cadences; risk of dispatcher misreading the monthly figure as weekly |

**Tentative recommendation:** Option B (sibling tab). Clean separation matches the spec's reason for splitting cadence in the first place. But this is a dispatcher call.

## Open decisions (need Kyron's call before kickoff brief)

1. **UI placement** (Option A / B / C above).
2. **Month-key convention** — is the "month" calendar-month (`YYYY-MM`)? Or "the month containing weekStart"? Mirror persistency's `YYYY-MM` calendar convention is the default; deferred call only matters if a manager files mid-month for a calendar month they haven't finished.
3. **Edit window** — once a month closes, can the manager still edit? Persistency has no time gate (the doc is editable indefinitely; audit trail captures `lastEditedBy`). WAR similarly has no time gate. Default: same — no time gate. Decision needed only if compliance wants a freeze date.
4. **`candidatesAssessed` definition** — confirm with head-of-sales: is this the count of names that moved from "Initial Interview" to "Second-round / Assessment" stage during the month? Spec §3 implies yes but doesn't define the boundary precisely.
5. **`agentsContracted` lag** — contracting is gated by CBTT Form 3 + TTII exam (spec §3). If a candidate is contracted on the LAST day of the month, does the manager log it under that month, or under the month they passed the exam (which can be weeks later)? Default: log the month of contract issuance. Confirm with head-of-sales.
6. **Standards/targets for monthly fields?** I1.3c-i shipped activity standards for the 6 numeric + 2 boolean WAR fields. Does the same `config/managerActivityStandards` doc grow `candidatesAssessed` + `agentsContracted` keys? If yes, I2 needs a small extension to `NUMERIC_STANDARDS` in `managerActivityStandardsService.js`. (Note: this also implies the I1.3c-ii override doc extends to monthly — `managerActivityStandardOverrides` already has the right shape to do so.)
7. **JFW-style auto-count for `recruitsInFirstWeeks`** — is the weekly `recruitsInFirstWeeks` value auto-derivable from the recruit's user doc (e.g., `contractStartDate` within last 4 weeks)? If yes, that's an I3-adjacent improvement (read-only auto-count, same pattern as I1.3a's `jfwCount` denormalization CF). Not blocking I2 but worth flagging.

---

# I3 — Accountability flag (Tier 1 + Tier 2)

## What spec §4 locks

- **Tier 1 (visibility):** missed weekly standard surfaces on the manager's OWN dashboard.
- **Tier 2 (escalation):** the miss notifies the direct upline via the existing notification system (`createNotification`).
- **No automated consequences.** Consequence is the upline's human decision.
- **Optional intensifier:** two consecutive missed weeks can raise the flag's prominence.

## What "missed" means

Per spec §2 #5 (`unitMeetingHeld`) and §2 #6 (`dashboardReviewDone`): boolean standards "held = Y" / "done = Y" → miss = false.
Per spec §2 #1-4 (numeric activities): miss = WAR field < resolved standard for the role.

I1.3c-i + I1.3c-ii already deliver `getResolvedStandards({tenantId, managerId, role})` returning the merged org-default + upline-override map. The flag computation is therefore a pure function over `(warDoc, resolvedStandards)` — no new data fetch needed for Tier 1.

## Proposed Tier 1 implementation (visibility only)

**No new collection. No new rule.** Tier 1 is computed client-side from data already loaded:

1. On `ManagerWarTab.jsx` (manager's own WAR): compute `missedActivities = []` after both the WAR doc and `resolvedStandards` are loaded. For each `NUMERIC_STANDARDS` key, `missed = actual < target` (when target is set; absent target = not measured, never missed). For each `BOOLEAN_STANDARDS` key, `missed = target === true && actual === false`.
2. Render a "Flagged" panel above the form when `missedActivities.length > 0`. Listed by activity label + actual/target.
3. The same computation runs in `ManagerWarDetail.jsx` (upline view) so the upline sees the same flag chips. This is already most of "Tier 2 visibility" — the upline who opens the report sees the flagged items.

This is a UI-only change. Zero rule changes. Zero new storage. Zero index. Single new pure utility `computeMissedActivities(war, standards)` in (proposal) `src/utils/accountabilityFlag.js`.

## Proposed Tier 2 implementation (notification escalation)

This needs a write path because the upline must be notified asynchronously of the submission, not just when they open the report.

**Trigger:** Cloud Function on WAR write, gated on `status === 'submitted'` (and only on the submit transition, not on every draft save — mirrors how `onWarWrite` already gates in `functions/index.js:14+`).

**Resolution of "direct upline":**
- UM (rank 1) → BM in same branch. Resolution: `branches/{branchId}.managerId` (the existing convention used by F2.1 BM-notify-on-joint-call at `jointCallsService.js:115`, where `resolveBmInfo` already does this lookup — pattern reusable).
- BM (rank 2) → SM (rank 3) tenant-wide. Resolution: find the SM user doc in the same tenant. Edge case: multiple SMs? Default to the first, or notify all? Open decision.
- SM (rank 3) → Head of Sales / Tenant Admin. Conceptually `tenant_admin`. Open decision: does TA want a notification, or is this where the flag stops?

**Write shape (per notification doc):**
```
{
  userId:    <upline-uid>,
  tenantId:  <tid>,
  type:      'manager_alert',       // existing type, already in NotificationDrawer iconography
  title:     'Activity standards missed',
  body:      '<managerName> missed N standard(s) for week of <weekStart>: ...',
  link:      '/manager/team-wars/<warId>',  // deep-link to ManagerWarDetail
  read:      false,
  createdAt: serverTimestamp(),
}
```

Mirrors F2.1's joint-call BM-notify shape (`jointCallsService.js:115-130` writes `manager_alert` type, body string, link). Best-effort try/catch around the notification write — submission must never be blocked by a failed escalation.

**De-duplication:** WAR can be re-submitted (e.g., manager edits + re-submits). The CF should write the escalation notification only on the FIRST `status === 'submitted'` transition, not on every subsequent edit-and-resubmit. Pattern: compare `before.status` vs `after.status`; only notify when `before.status !== 'submitted' && after.status === 'submitted'`. (Same loop-guard shape as I1.3a's `onWarWrite` jfwCount writeback in `functions/war/recomputeJfwCount.js`.)

**No new collection. No new rule.** Notifications collection + rules already exist. The CF reuses the Admin SDK write path (bypasses rules anyway). The only architectural unit changes are:

1. CF: new export (or extend `onWarWrite` to also do escalation when the conditions match). Per CLAUDE.md additive-CF policy, **NEW exports** are pre-merge-safe; **modifications to existing CFs** are post-merge unless the new branch is gated by a field new callers don't exercise. Extending `onWarWrite` likely fits the latter (new branch fires only on submit-transition + missed-activity present), but the cleaner design is a NEW CF export `onWarSubmitNotifyUpline` keyed to the same trigger. Safer + pre-merge deployable.
2. Service-layer helper: `resolveUpline({tenantId, managerRole, managerBranchId})` returning `{ uid, role, name }` for the direct upline (or `null` if none — e.g., a tenant_admin filing has no upline). New module `src/services/uplineResolveService.js`.
3. No UI change for the upline beyond what already exists: `NotificationDrawer.jsx:9` already renders `manager_alert` icon.

## Optional intensifier (two consecutive misses)

Per spec §4: "two consecutive missed weeks can raise the flag's prominence."

**Approach:** read the previous week's WAR doc when computing the current week's flag chips. If `previousWeek.missedActivities` and `currentWeek.missedActivities` share any activity, render that chip with a stronger visual (red border, ⚠ icon).

**Storage impact:** none if computed at render time. One extra read per WAR detail render (the previous-week doc). For Tier 2 escalation, the CF could also include "this is the Nth consecutive miss" in the notification body, but that requires the CF to do the previous-week read — single Firestore `getDoc` by predictable id, low cost.

**Decision:** is the intensifier in-scope for the initial I3 PR, or a follow-up?

## Is this a new rule? Phase-1 stop?

**No new rule.** I3 reuses existing infrastructure entirely (notifications collection, WAR collection, getResolvedStandards). The only architectural-unit additions are the new CF export and the new service helper — neither needs a rule change.

**The Phase-1 stop signal is NOT triggered.** Per CLAUDE.md Rule 17 + brief-completeness sub-bullet, the rule trigger fires for *new collections*. I3 introduces none. Cloud Function changes need their own surface enumeration (existing-CF modification vs new export, deploy timing), but those are CF discipline, not rule-discipline.

## Open decisions (need Kyron's call before kickoff brief)

1. **SM → who?** Direct upline of an SM is conceptually Head of Sales / tenant_admin. Does TA receive escalation notifications? Or does the chain stop at SM?
2. **Multiple SMs in one tenant** — if a BM's tenant has multiple SMs, notify which? All? First by some sort key? Same question applies to multiple TAs.
3. **Intensifier scope** — initial PR or follow-up?
4. **De-dup on resubmit** — confirm the "only on first submit transition" semantic. Edge case: manager submits → corrects → resubmits same week. Default: no second notification. Confirm.
5. **Tier 1 visibility on `ManagerDashboard` (not just the WAR tab)?** Spec §4 says "on the manager's own dashboard" — does that mean the WAR tab, or a top-of-dashboard chip on the main `ManagerDashboard` Overview tab? If the latter, it's a slightly bigger touch (read latest-week WAR + standards on dashboard mount).
6. **Notification cadence** — escalation fires on first submit-transition. What if the upline is also the offender (e.g., a BM misses a standard AND submits their own WAR)? In that case, who escalates? Spec is silent. Default: escalation skips upward to the SM. Confirm.
7. **WAR vs monthly rollup** — does I3's accountability flag also apply to I2's monthly fields? If yes, the design generalizes; if no, I3 is WAR-only and I2 has no escalation. Default: WAR-only for the initial I3 PR; revisit when I2 ships.

---

# §6 — License-state (provisional/official + 90-day expiring flag)

## What spec §6 locks

| Field | Type | Notes |
|-------|------|-------|
| `contractDate` | date | Tenure clock start. **Already shipped as `contractStartDate`** on user docs (drives J1 tenure floors). |
| `licenseStatus` | enum `provisional` \| `official` | `provisional` = sells under supervision. |
| `cbttExamDeadline` | date (derived) | `contractStartDate + 24 months`. |
| `cbttExamPassedDate` | date \| null | Set when status flips to `official`. |

**Compliance signal:** flag any `provisional` agent within ~90 days of `cbttExamDeadline`.

## Source-verification: what already exists

- `contractStartDate` is **present** on user docs (`BulkImportUsersModal.jsx:383` lists it as an optional column; `EditUserDrawer.jsx:42` includes it in the editable-fields set; `UserManagementPanel.jsx:46+73` requires it for new agents; `GoalsPanel.jsx:30` resolves it for J1 floor lookup). The field is the right anchor; spec §6 calls it `contractDate` but the codebase uses `contractStartDate` — keep `contractStartDate` to avoid a rename migration.
- No `licenseStatus` / `cbttExamDeadline` / `cbttExamPassedDate` field exists today. Confirmed: `grep -rn licenseStatus src functions firestore.rules` returns zero matches.
- Edit surface for user-doc fields: `EditUserDrawer.jsx` (used by managers/admins to edit existing users) and `UserManagementPanel.jsx` (used to create new agents). Both already gate on role for which fields are editable.

## Proposed storage shape (additive — no new collection)

Add three optional fields to the **existing user doc** at `/tenants/{tid}/users/{userId}`:

| Field | Type | Default | Validation |
|---|---|---|---|
| `licenseStatus` | `'provisional' \| 'official'` | `'provisional'` (newly-created agents are always provisional) | enum check in rule + UI |
| `cbttExamPassedDate` | ISO date string \| `null` | `null` | when set, must be ≤ today; only settable when `licenseStatus` flips to `official` |
| `cbttExamDeadline` | (derived, not stored) | computed: `contractStartDate + 24 months` | client-side derivation; no storage |

**Why not store `cbttExamDeadline`?** It's a pure function of `contractStartDate`. Storing it would create a sync-drift risk (someone edits `contractStartDate` and forgets to update `cbttExamDeadline`). Render-time derivation is cheaper and safer.

**Migration:** none required. Missing fields read as `undefined`; the resolver defaults to `provisional` (the safer assumption — surfaces the field on the UI for affirmation rather than silently treating undocumented agents as `official`).

## Proposed rule shape

Extend the existing `match /tenants/{tid}/users/{userId}` block. The current rule allows manager-write within unit/branch scope. The new fields are user-doc fields, so they follow the same write-permission scope. Add a small validation predicate:

```
function validLicenseFields() {
  let d = request.resource.data;
  return (!('licenseStatus' in d) || d.licenseStatus in ['provisional', 'official'])
      && (!('cbttExamPassedDate' in d) || d.cbttExamPassedDate is string || d.cbttExamPassedDate == null);
}
```

Bolted into the existing manager-write predicate via `&& validLicenseFields()`. **No new collection. No new rule block. No new index.** Pure user-doc field extension.

## ~90-day expiring-provisional flag

Pure derivation, no storage:

```js
// src/utils/licenseStatus.js (new)
const TWENTY_FOUR_MONTHS_MS = 24 * 30 * 24 * 60 * 60 * 1000; // ≈ 24 months; refine to calendar arithmetic
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function deriveLicenseState({ licenseStatus, contractStartDate, cbttExamPassedDate }, now = Date.now()) {
  if (licenseStatus === 'official') {
    return { status: 'official', cbttExamDeadline: null, daysUntilDeadline: null, expiringSoon: false, expired: false };
  }
  if (!contractStartDate) {
    return { status: 'provisional', cbttExamDeadline: null, daysUntilDeadline: null, expiringSoon: false, expired: false };
  }
  // Use calendar arithmetic (proper month arithmetic), not ms approximation:
  const start = new Date(contractStartDate);
  const deadline = new Date(start.getFullYear(), start.getMonth() + 24, start.getDate());
  const daysUntilDeadline = Math.floor((deadline.getTime() - now) / (24 * 60 * 60 * 1000));
  return {
    status: 'provisional',
    cbttExamDeadline: deadline.toISOString().slice(0, 10),
    daysUntilDeadline,
    expiringSoon: daysUntilDeadline > 0 && daysUntilDeadline <= 90,
    expired:      daysUntilDeadline <= 0,
  };
}
```

Three rendering surfaces:

1. **Agent's own AgentDashboard** — small chip near the profile area: "Provisional · CBTT exam due 2027-04-15 (90 days)" when `expiringSoon`. Style: warning (amber); when `expired`, error (red, "Provisional license expired — exam overdue").
2. **MasterSheet manager view** — column or chip in the per-agent row: "Prov · 90d" for expiringSoon; "Prov · expired" for expired.
3. **Optional: compliance-only dashboard tab** — list of all `provisional` agents in the tenant sorted by `daysUntilDeadline`. Tenant-admin / branch-manager scoped. Probably out of scope for the initial §6 PR — flag a follow-up.

## Edit surfaces

- **`EditUserDrawer.jsx`** — add two fields: `licenseStatus` dropdown (provisional/official) + `cbttExamPassedDate` date (visible only when `licenseStatus === 'official'`).
- **`UserManagementPanel.jsx`** create form — default new agents to `provisional`, no `cbttExamPassedDate`. Surface as read-only "Provisional (default for new agents)".
- **`BulkImportUsersModal.jsx`** — add `licenseStatus` to optional columns (defaults to `provisional`).

## Is this a new rule? Phase-1 stop?

**No new collection. Existing rule block extended with a validation predicate.** Not a new-rule-block trigger. But still surface in Phase 1 of any §6 brief that:

1. The user-doc rule predicate is being modified (modification, not addition).
2. Per CLAUDE.md additive-deploy policy: this is a rule MODIFICATION to existing predicates. Even though the new fields are optional, the validation predicate gates ALL writes through the existing path. **Conservative default: post-merge deploy** unless the new behavior is purely additive in effect (which it is — missing fields pass the predicate trivially).

Either way, capture the deploy decision explicitly in the brief.

## Open decisions (need Kyron's call before kickoff brief)

1. **Spec terminology drift** — spec §6 uses `contractDate`; codebase uses `contractStartDate`. Keep `contractStartDate`? (Yes, default — avoiding rename migration.)
2. **Default value for existing agents post-migration** — backfill all current users to `licenseStatus: 'provisional'`? Or leave undefined (resolver defaults to provisional)? Backfill is the more visible choice but requires a backfill script + writeback. Tentatively recommend: NO backfill; let the resolver default handle it. Confirm.
3. **CBTT exam date precision** — calendar-month arithmetic (spec wording: "24 months") vs ms-approximation? Calendar is correct; ms-approximation drifts at year boundaries. Default: calendar arithmetic.
4. **Compliance dashboard tab** — in scope or follow-up?
5. **Notification when a provisional license is 90 days from expiring** — does the agent's manager get a notification? Or is it visibility-only? Spec §6 says "flag... on the manager/compliance view," so visibility-only is the read. Confirm.
6. **Who can set `licenseStatus: 'official'`?** Currently `EditUserDrawer.jsx` is gated by role for which fields are editable. Should `licenseStatus` be tenant-admin only (compliance gate)? Or any manager up the chain? Spec is silent. Default: tenant_admin only (compliance ownership pattern). Confirm.
7. **`cbttExamPassedDate` validation** — must be ≥ `contractStartDate`. Worth adding to the rule, or trust UI validation?
8. **Existing tenure floor logic** — `tenureFloors.js` already computes `monthsOfService` from `contractStartDate`. Does §6 need to coordinate with J1 for any cross-cut concern? On inspection: no — J1 cares about tenure for floor sizing; §6 cares about exam deadline for compliance. Different consumers of the same anchor. No coordination needed.

---

# Cross-cutting notes

## Build order recommendation

**§6 → I3 → I2** (smallest first, but actually each is independent — they can ship in any order). My read:

- **§6** is the smallest (no new collection; pure field additions + a resolver). Ship first to keep the iteration cycle short and validate the dispatcher discipline for "modification" rule deploys.
- **I3** is medium (new CF + new service helper, no new collection). Ship second because it reuses existing surfaces and proves out the notification-escalation pattern (which is reusable for I2 if Tier 2 escalation extends there).
- **I2** is the largest (new collection, new rule, new index, new UI). Ship last so the lessons from §6 (rule-modification discipline) and I3 (new-CF discipline) are banked first.

**Counter-argument for I2 first:** the spec lists it as the "next" piece (CONTEXT.md "Next track: I2 (recruiting roll-up) — first active"). If Kyron's stated next-step matters more than mechanical sizing, I2 ships first.

**Recommendation: defer to dispatcher.**

## Rank-fn-hoist dependency

The rank-fn-hoist PR (this autonomous run's Task 1, PR #268) introduces top-level `roleRank()`. I2's proposed rule shape above uses `roleRank()` directly (no block-local re-declaration). I3 and §6 don't use rank in their rule paths.

If the rank-fn-hoist PR has NOT merged at the time an I2 kickoff brief is written, the I2 brief must either (a) wait for the hoist PR, or (b) declare a block-local `warRoleRank()` copy and add a "post-hoist swap" follow-up note. Option (a) is cleaner.

## Composite indexes summary

- **I2:** one new index `(branchId ASC, monthKey ASC)` on `managerMonthlyRollups` (BM-scope upline list query). Additive; pre-merge deploy.
- **I3:** no new index.
- **§6:** no new index (no new query — all reads are by user-doc id, and existing user-doc queries don't change).

## Smoke surfaces (one-line each)

- **I2:** owner create + upline read + cross-branch DENY + downline DENY (mirror I1.3b smoke matrix).
- **I3:** Tier 1 chip rendering on missed activity (single render-only test); Tier 2 CF triggers `manager_alert` on submit-transition (CF-emulator test or service-mock test, since the CF runs in Functions framework).
- **§6:** licenseState resolver unit tests (provisional/official/expiringSoon/expired); edit surface smoke (tenant_admin toggles to official, agent dashboard chip updates).

---

# What this document is NOT

- Not a kickoff brief. Three of these are needed (one per piece, per CLAUDE.md Rule 10: each ships as its own docs-PR-then-implementation-PR pair).
- Not a final design. Each "open decisions" list is where Kyron's input is needed before locking a brief.
- Not source-of-truth for storage shapes. The locked Track I spec (`docs/AgencyTrack_TrackI_ManagerWAR_DesignSpec.md`) is authoritative; this doc proposes implementation paths consistent with that spec.

## Methodology safety check

- Phase 1 source-verify reads: `firestore.rules` (user doc, persistency, WAR, override blocks), `src/services/notificationService.js`, `src/services/persistencyService.js`, `src/services/managerActivityStandardsService.js`, `src/services/managerStandardOverrideService.js`, `src/services/jointCallsService.js` (F2.1 BM-notify pattern), `functions/index.js` (CF patterns), all touched components.
- Per CLAUDE.md Rule 17 (source verification at authoring time): file paths cited in this doc were grepped or read directly; no claim about source state was paraphrased from memory.
- Per CLAUDE.md Rule 12 (hard-stop semantics): this is a prep doc, not an implementation. No "STOP and wait for dispatcher" conditions fire — every "open decision" is explicitly flagged as needing Kyron's call before a kickoff brief locks.
