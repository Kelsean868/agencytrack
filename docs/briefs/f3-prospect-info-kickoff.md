# PR Kickoff — Track F3: Prospect-Info (agent-authored, pre-call prep)

**Track:** F (Manager drill-down + field tools). **F3 of 3** (F1 #242, F2 #244 shipped). Completes Track F.
**Type:** Feature PR · **Size:** M/L · **Risk:** Medium — introduces a NEW privacy direction (agent-authored, manager-reads) and the first agent-facing Track F surface.
**Provenance:** Tatil manager workshop 2026-05-19; roadmap revision §3.2(b) + §0 guardrail. Authorship clarified by Kyron 2026-05-21: **the agent enters it.**

---

## Goal

The **agent** enters prospect-info for an upcoming joint call (pre-call prep) so the manager arrives informed. Agent-authored, manager-chain-readable. A **separate record** from the manager's observation (F2).

## CRITICAL — this is the OPPOSITE privacy direction from F1/F2. Do not copy them.

- F1 (coaching notes) and F2 (joint-call observation) are **manager-authored, agent-EXCLUDED, rank-based**.
- F3 prospect-info is the reverse: **agent-authored; agent reads/edits OWN; managers in scope READ.**
- **The precedent is the SUBMISSIONS rule** (agent owns own data, managers read in scope) — NOT `coachingNotes`/`jointCalls`. Copying F1/F2's agent-exclusion here would be exactly backwards. The agent CAN read their own prospect-info; managers CANNOT write it.

## Workflow

1. **Pre-call:** agent creates a prospect-info prep record for an upcoming joint call (prospect details + intended appointment date).
2. **Pre-call:** manager (chain) reads it in the per-agent surface — arrives informed.
3. **Post-call:** manager logs the F2 observation (separate doc, agent-excluded — unchanged). Linking the observation to the prep is **deferred to F3.1**.

## Guardrail (read first — §0)

Each record is **bound to a specific upcoming joint call** (an intended appointment date is required). This is joint-call prep, **NOT a standing prospect list / CRM**: no pipeline stages, no disposition tracking, no general prospect search, no contact management. If a Phase-1 finding or a UI choice pushes past that, STOP and flag it.

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

- **The SUBMISSIONS rule + service as the precedent.** Confirm exactly how agents create their own + managers read in scope (UM via denormalized `unitId`; BM+ tenant). Mirror this for `prospectInfo` (denormalize `agentUnitId`). Report the rule shape.
- **Agent entry point.** Where does the agent enter this — a section on the agent dashboard, a new agent surface? Report the cleanest spot; this is the first agent-facing Track F piece.
- **Manager read surface.** The per-agent modal is now tabbed (Notes | Joint Calls). Add a third **read-only** "Prospect Info" tab vs surfacing within Joint Calls. Recommend a third tab; report your call.
- **Taxonomies.** `policyType` — reuse an existing product taxonomy if present, else free text. `prospectingSource` — this is the §3.3 Track H "Source of Prospect" taxonomy; export it reusably from the service.

## Schema

`/tenants/{tenantId}/users/{agentId}/prospectInfo/{prospectId}`
- `agentId`, `tenantId`, `agentUnitId` (denormalized for manager UM scope — mirror submissions)
- `createdBy` (= `agentId`; agent-authored)
- `clientName` (trim/length-guard), `clientAge` (`parseFloat`, optional), `clientOccupation`
- `prospectingSource` enum: `seminar`|`booth-event`|`referral`|`cold-call`|`social-media`|`orphan`|`existing-client`|`family-friend`|`BOA`|`self`|`other`
- `appointmentType` enum: `2nd-interview`|`closing-interview`
- `objections` enum, **multi-select**: `no-money`|`no-need`|`no-hurry`|`no-confidence` (raised so far)
- `policyType` (free text or taxonomy per Phase 1)
- `intendedAppointmentDate` (the planned joint-call date — REQUIRED; the appointment binding)
- `createdAt`, `updatedAt`

## Privacy (SUBMISSIONS-style — NOT coaching-notes)

- **Create / update:** agent only (`request.auth.uid == agentId`). Managers do NOT write.
- **Read:** agent OWN (`request.auth.uid == agentId`) **OR** manager in scope (UM via `agentUnitId == caller uid`; BM/SM/tenant_admin/platform_admin tenant-scoped). NOT rank-based; NOT agent-excluded.
- **Delete:** agent-own only, or none — confirm against the submissions precedent in Phase 1.

## Scope

**IN**
- `prospectInfo` subcollection + **submissions-style** Firestore rule + composite index(es) for the manager list query (mirror submissions' `agentUnitId` scoping).
- `prospectInfoService.js` — agent create / edit-own / list-own; manager list-for-agent. Export `PROSPECTING_SOURCES`, `APPOINTMENT_TYPES`, `OBJECTIONS` enums (reusable).
- **Agent entry UI** — form + list of the agent's own prep records (the agent surface per Phase 1). `intendedAppointmentDate` required; `parseFloat` on `clientAge`.
- **Manager read surface** — read-only Prospect Info tab in the per-agent modal (or per Phase-1 call). Manager cannot edit.
- Tests: **emulator rules tests (submissions-style matrix)**, `prospectInfoService` unit tests, agent-form + manager-read component tests.

**OUT / DEFERRED**
- **F3.1 (fast-follow):** explicit prospect-info ↔ observation link (manager selects the prep when logging the F2 observation).
- Any prospect pipeline / disposition / search / contact management — **out per §0 guardrail.**
- F2.1 BM notification (still queued).

## Phases

1. **Source-verify** (above). STOP if the submissions precedent, agent entry point, or taxonomies differ from this brief.
2. **Schema + rule + service.** Mirror the SUBMISSIONS rule (agent owns; managers read in scope). **Mandatory emulator rules tests** (Java JDK 21) — the submissions-style matrix below.
3. **UI.** Agent entry form + own-list; manager read-only Prospect Info tab. Loading/empty/error; Nexus tokens; 44px; light + dark.
4. **Docs (placeholders).** CONTEXT.md recently-shipped row (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark F3 shipped (**Track F complete**), queue F3.1 (observation link) + F2.1, note taxonomies provisional if unconfirmed.
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first; expected HEAD `5ee194f`). Deploy the additive rule + index(es) pre-merge (`firebase deploy --only firestore:rules,firestore:indexes`); confirm indexes `READY`. Lint + build gate. **Run the full suite with `.env.local` moved aside** (the F2 CI lesson) before pushing. Push, open PR via `gh`, Rule 15 verify. Do NOT merge.

**Emulator rules matrix (SUBMISSIONS-style — NOT F1/F2's exclusion matrix):**
- Agent create / read / update **OWN** prospect-info: ALLOW.
- Agent read / write **ANOTHER agent's**: DENY.
- UM read **own-unit** agent's: ALLOW; **other-unit** agent's: DENY (scope).
- BM / SM / tenant_admin read in-scope: ALLOW.
- Manager **WRITE** prospect-info: DENY (agent-authored only).

**Smoke: RUN — note the INVERTED assertions vs F1/F2:**
- **Agent** logs in → enters prospect-info → reload → persists AND the **agent SEES their own** (inclusion, not exclusion). Light + dark, 390×844, 0 console errors.
- **Manager in scope** → per-agent surface → sees the agent's prospect-info (read-only).
- **Cross-agent negative:** a DIFFERENT agent CANNOT see this agent's prospect-info (direct Firestore read → denied). This is the boundary that matters here.
- Verify the manager list query returns and indexes are `READY`.

## Acceptance criteria

- Agent owns/reads/edits own; managers in scope read; **cross-agent read denied**; manager-write denied (emulator + smoke).
- Each record requires `intendedAppointmentDate` (appointment-bound); no pipeline/disposition/search introduced.
- Lint 0; build green; suite green incl. env-unset parity run; smoke green (agent-inclusion + manager-read + cross-agent-deny).

## Post-merge

Standard sequence: sync main, capture squash SHA, fill `#TBD`/`{TBD}`, commit + push direct to main, Rule 15 verify. (Rule + indexes deployed pre-merge.)
