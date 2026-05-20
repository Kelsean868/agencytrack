# PR Kickoff — Track F1: Coaching Notes

**Track:** F (Manager drill-down + field tools). This is **F1 of 3** (F2 = Joint-Call Observation Log; F3 = Prospect-Info form).
**Type:** Feature PR · **Size:** M · **Risk:** Medium-High (introduces a privacy boundary — agent must never read these)
**Provenance:** Tatil manager workshop 2026-05-19 ("manager coaching into an agent"); base Track F design in `docs/phase7-8-PRD.md` / `docs/phase7-8-implementation.md`, privacy/audit model per roadmap revision §3.2.

---

## Goal

Let a manager log private, categorised **coaching notes** on an agent — visible up the manager chain, **never to the agent** — surfaced in the manager's existing per-agent drill-down. This establishes the manager-chain-private subcollection + audit pattern that F2 (joint-call log) and F3 (prospect-info) reuse.

## Why this is the foundation

F2 and F3 are structured forms under the **same privacy + audit model** as coaching notes (roadmap §3.2 says so explicitly). Building the simplest member first — free-text categorised notes — proves the rules boundary, the denormalized-scope pattern, and the audit trail once, so the structured forms inherit a tested model instead of inventing one.

## Source-verify first (Rule 17, Phase 1 — confirm before coding; STOP on contradiction per Rule 12)

- **Base spec.** Read `docs/phase7-8-PRD.md` and `docs/phase7-8-implementation.md` for the existing Track F Coaching Notes spec — the **category enum**, field set, privacy model, and audit-trail rules. Use the doc's category list as authoritative; do not invent one. If the docs don't fully specify it, report what's there and propose the enum before building.
- **Live rules model.** Confirm in `firestore.rules` (the repo's live file, NOT `AgencyTrack_Config_Files.md`): `isManager()` = role in [unit_manager, branch_manager, sales_manager, tenant_admin, platform_admin]; `canManage(tenantId)`; `canAccessOwn(tenantId, agentId)`; `callerUnitId(tenantId)` (reads caller's `unitId` from their user doc — `unitId` is NOT a claim). Confirm how unit-scope is enforced today (the `users/{userId}` get rule uses `resource.data.unitId == request.auth.uid` for unit_manager) and whether branch_manager is branch-scoped or tenant-scoped in practice.
- **Denormalization pattern.** Confirm submissions denormalize `unitId` (and branchId?) at write time for rule scoping without cross-doc reads. Coaching notes should mirror this: store `agentUnitId` (+ `agentBranchId` if branch scope is enforced) on the note so the read/write rule scopes without a `get()`.
- **Drill-down entry point.** Find where a manager currently views a *specific* agent (Master Sheet row → ? / SubmissionViewer / Meeting Mode / a per-agent panel). That's where the Coaching Notes panel attaches. Report the exact component + entry path.
- **Manager test account.** Identify a manager account whose scope covers the test agent `kelsean@gmail.com` (e.g. `kelsean+tenantadmin@gmail.com`, or a unit_manager whose uid == the test agent's `unitId`) for the smoke. Confirm the test agent's `unitId`.

## Schema (reconcile field names with the base spec in Phase 1)

`/tenants/{tenantId}/users/{agentId}/coachingNotes/{noteId}`
- `agentId`, `tenantId` (auto)
- `agentUnitId` (+ `agentBranchId` if branch scope enforced) — denormalized for rule scoping
- `authorUid`, `authorName`, `authorRole`
- `category` — enum from the base spec
- `note` — free text (parseFloat N/A; trim/length-guard)
- `createdAt`, `updatedAt` — server timestamps (audit)

## Privacy boundary (the point of this PR)

- **Read:** managers with scope over the agent only. unit_manager → only where the note's `agentUnitId` == caller uid; branch_manager/sales_manager/tenant_admin/platform_admin → per the existing manager scope. **The agent must NOT be able to read notes on their own doc** — the rule must NOT include a `canAccessOwn` branch.
- **Create/Update:** same manager scope; `authorUid` must equal the caller; audit fields server-set; agents cannot write.
- **No delete** from the client (audit immutability) unless the base spec says otherwise — confirm in Phase 1.

## Scope

**IN**
- Schema + Firestore rule for the `coachingNotes` subcollection (manager-chain read/write, agent excluded, denormalized scope).
- `coachingNotesService.js` — create / list-for-agent / update, manager-scoped.
- UI: a **Coaching Notes panel** in the manager's per-agent drill-down (the entry point confirmed in Phase 1) — note history (newest first) + add-note form (category select + free text). Loading / empty / error states. Nexus tokens, 44px, light + dark.
- Tests: **emulator rules tests** (manager-in-scope read/write OK; **agent read DENIED**; out-of-scope unit_manager DENIED), `coachingNotesService` unit tests, panel component tests.

**OUT / DEFERRED**
- F2 Joint-Call Observation Log; F3 Prospect-Info form (next PRs, same model).
- Auto-notifications on note (coaching notes are private review material; the joint-call log is what notifies the BM in F2) — unless the base spec says otherwise; confirm in Phase 1, default OFF.
- Agent-mirror dashboard / nightly aggregation (base Track F item; not needed for F1).

## Phases

1. **Source-verify** (above). STOP and report if the base spec, rules model, or drill-down entry point differ from this brief.
2. **Schema + rules + service.** Subcollection rule (agent-excluded, denormalized scope); `coachingNotesService.js`. **Emulator rules tests are mandatory here** (Java JDK 21 is installed) — must assert the agent-read DENY and the out-of-scope-UM DENY, not just happy path.
3. **UI.** Coaching Notes panel in the per-agent drill-down; add + list; states; tokens; light + dark.
4. **Docs (with placeholders).** CONTEXT.md recently-shipped row (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark F1 shipped, note F2/F3 queued under Track F; roadmap doc Track F status touch if applicable.
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first). Lint + build gate. Push, open PR via `gh`, Rule 15 post-push verify. Do NOT merge.

**Smoke: RUN** (user-visible + privacy-critical). Real write-read-verify via `setupBypassSession` against the preview:
- As a **manager in scope**: open the test agent's drill-down, add a coaching note, reload, assert it persisted and is visible. Light + dark, 390×844, 0 console errors.
- **Critical negative leg:** log in as the **test agent** (`kelsean@gmail.com`) and assert the coaching note is **not** visible anywhere in the agent UI, and a direct read is denied (no leak). This is the assertion that matters most — a selector-only pass is insufficient; it must exercise the rule.

## Acceptance criteria

- `coachingNotes` subcollection: managers in scope read/write; **agent read denied** (emulator-proven AND smoke-confirmed); out-of-scope unit_manager denied.
- Note persists with author + category + timestamps; surfaced in the manager's per-agent drill-down; agent UI never shows it.
- Category enum matches the base Track F spec.
- Lint 0; build green; emulator rules tests pass; smoke green incl. the negative agent leg.

## Post-merge

Standard sequence: sync main, capture squash SHA, fill `#TBD`/`{TBD}`, commit + push direct to main, Rule 15 verify.
