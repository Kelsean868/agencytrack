# PR Kickoff — Track F2: Joint-Call Observation Log

**Track:** F (Manager drill-down + field tools). **F2 of 3** (F1 Coaching Notes shipped #242; F3 = Prospect-Info form).
**Type:** Feature PR · **Size:** M · **Risk:** Medium (same privacy boundary as F1 — agent must never read)
**Provenance:** Tatil manager workshop 2026-05-19 (Gia Rauseo-Suite's joint-call form walkthrough); roadmap revision §3.2(a).

---

## Goal

A manager logs a structured **joint-call observation** on an agent — visible up the manager chain, **never to the agent** — on the same per-agent surface as F1's coaching notes. This is the field-observation form the managers were most animated about.

## Reuse F1 — this is the point of having built it first

F2 is the **same privacy + rules + service + modal pattern as F1 (coachingNotes, #242)**, applied to a `jointCalls` subcollection with a structured field set instead of free text. Inherit, don't reinvent:
- Agent-excluded, **rank-based read** (`authorRoleRank`; UM<BM<SM<tenant_admin<platform_admin), denormalized `agentUnitId` for UM scope, defense-in-depth list (client `where('authorRoleRank','<=',callerRank)` + UM `where('agentUnitId','==',uid)`).
- Reuse/generalize the `cnRoleRank()` / `cnUMScopeOk()` rule helpers (rename to shared helpers if cleaner — same logic).
- **Heed the F1 query lesson:** the list query has an inequality on `authorRoleRank`, so the FIRST `orderBy` must be `authorRoleRank` (asc) before `orderBy('createdAt','desc')` — Firestore returns `FAILED_PRECONDITION` otherwise. F1 hit this in smoke; build it right from the start here.

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

- Confirm F1's shipped shape to mirror: `coachingNotesService.js`, the rule block + `cnRoleRank`/`cnUMScopeOk`, `CoachingNotesModal`, the MasterSheet Notes-icon entry, the 2 composite indexes.
- **UI integration decision:** extend the existing per-agent `CoachingNotesModal` into a tabbed modal (Notes | Joint Calls) vs a separate `JointCallModal` off a second MasterSheet affordance. Recommend the tabbed modal (both are per-agent manager surfaces). Report your call.
- **`needCovered` enum:** roadmap §3.3 routes "Need Covered" here as an enum. Check for any existing needs taxonomy in the codebase (wizard, Track G money-needs, config). If none exists, propose a provisional set and flag it for confirmation (like the tenure floors) — do not hard-code a permanent taxonomy unconfirmed.
- Confirm the agent's BM is resolvable via `branches/{agent.branchId}.managerId` and unit via `agent.unitId` (= UM uid) — for F2.1's notification, not built here, but confirm the path exists.

## Schema

`/tenants/{tenantId}/users/{agentId}/jointCalls/{callId}`
- `agentId`, `tenantId`, `agentUnitId` (denormalized for scope)
- `authorUid`, `authorName`, `authorRole`, `authorRoleRank`
- `appointmentDate`, `appointmentTime`
- `appointmentKept` (bool); if false/rescheduled → `nextMeetingDate`
- `meetingType` enum: `demonstration` | `observation` | `collaboration`
- `needCovered` enum (provisional per Phase 1; flagged)
- `comments` (free text, trim/length-guard)
- `saleMade` (bool)
- `coachingMinutes` (number — `parseFloat`)
- `trainingIdentified` (free text + optional tags)
- `createdAt`, `updatedAt` (server timestamps, audit)

## Privacy boundary (identical to F1)

- **Read:** managers in scope only; `callerRank >= authorRoleRank`; UM → `agentUnitId == uid`. **No agent read branch** (no `canAccessOwn`). Agent-read DENIED is non-negotiable.
- **Create:** manager in scope; `authorUid == caller`; `authorRoleRank == caller rank`; audit fields server-set.
- **Update (edit-own):** `authorUid == caller` only. No client delete/archive in F2 (matches F1; deferred).

## Scope

**IN**
- `jointCalls` subcollection schema + Firestore rule (mirror F1) + composite indexes for the list query (`authorRoleRank` + `createdAt`; `agentUnitId` for UM).
- `jointCallsService.js` — create / list-for-agent / edit-own (mirror `coachingNotesService`, with the correct orderBy).
- UI: Joint-Call Observation form + list on the per-agent surface (tabbed modal recommended). Enum selects, conditional `nextMeetingDate`, `parseFloat` on `coachingMinutes`. Loading / empty / error. Nexus tokens, 44px, light + dark.
- Tests: **emulator rules tests** (mirror F1's matrix — agent DENY, rank ladder, UM scope), `jointCallsService` unit tests, form/list component tests.

**OUT / DEFERRED**
- **F2.1 (fast-follow):** on-submit notification to the agent's branch manager — needs a tenant-scoped Cloud Function + BM resolution (`branches/{branchId}.managerId`); the existing `createNotification` CF is legacy (top-level collections) and needs reworking. Distinct concern, own PR + functions deploy.
- F3 Prospect-Info form (next).
- Cross-agent "manager joint-call summary" roll-up (per-agent list is enough for F2; summary is a later enhancement).
- Client delete/archive, `isPinned` (deferred with F1).

## Phases

1. **Source-verify** (above). STOP if F1's shape, the surface, or the `needCovered` taxonomy differ from this brief.
2. **Schema + rules + service.** Mirror F1; correct orderBy from the start. **Mandatory emulator rules tests** (Java JDK 21): agent read DENY, rank ladder (UM can't read BM/SM, BM can't read SM), UM scope, non-author update DENY.
3. **UI.** Tabbed per-agent modal (Notes | Joint Calls) or sibling modal per your Phase-1 call; form + list; states; tokens; light + dark.
4. **Docs (placeholders).** CONTEXT.md recently-shipped row (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark F2 shipped, queue F2.1 (BM notification) + F3, note `needCovered` provisional.
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first; expected HEAD `4e16a34`). **Deploy the additive rules + indexes pre-merge** from the worktree (`firebase deploy --only firestore:rules,firestore:indexes`) — confirm indexes `READY` before the smoke. Lint + build gate. Push, open PR via `gh`, Rule 15 verify. Do NOT merge.

**Smoke: RUN** (privacy-critical; mirror F1). Real write-read-verify via `setupBypassSession`:
- Manager in scope → per-agent surface → log a joint-call observation → reload → visible. Light + dark, 390×844, 0 console errors.
- **Critical negative leg:** as test agent `kelsean@gmail.com`, the joint-call entry is NOT visible AND a direct Firestore read → permission-denied (on real Firestore, not emulator).
- Rank leg if a suitable manager account exists (else rely on the emulator matrix).
- Verify the list query returns post-reload (the orderBy fix) and indexes are `READY`, not building.

## Acceptance criteria

- `jointCalls`: managers in scope read/write per rank; **agent read denied** (emulator + smoke negative leg); list query correct (no `FAILED_PRECONDITION`).
- Structured fields persist; surfaced on the per-agent surface; agent UI never shows it.
- `needCovered` enum present + flagged provisional if unconfirmed.
- Lint 0; build green; emulator rules tests pass; smoke green incl. negative agent leg.

## Post-merge

Standard sequence: sync main, capture squash SHA, fill `#TBD`/`{TBD}`, commit + push direct to main, Rule 15 verify. (Rules/indexes already deployed pre-merge, so no separate post-merge deploy.)
