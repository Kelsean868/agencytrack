> Validity: describes staging @ `bf881e4f175446929ea4c75ee1e67af962a596b1` (2026-07-10). Re-verify claims against HEAD before acting on this doc.

# 1-on-1 takeover — RECON (Master Sheet funnel edition, Item 6)

Read-only reconnaissance. Scene 08 of `docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner/mockups/mastersheet-funnel-scenes.jsx` (rendered by `.../AgencyTrack Master Sheet Funnel.html`) is a **first pass, not settled design** — treated here as input, not authority. No source was modified.

---

## 1. What the shipped coaching drawer has today

There are **two separate, unwired surfaces** in the live app that together cover what the mockup imagines as one 5-tab drawer. This is the single most important correction to the brief's premise (which expected one drawer referenced from `MasterSheet.jsx`).

### 1a. `AgentDrillDrawer` — 3 tabs, opened from the Team Dashboard exception list

- `src/components/manager/AgentDrillDrawer.jsx:27-31` — `TABS = [overview, report, goals]`. **No Notes tab, no Joint Work tab.**
- Entry point: `ExceptionLeadPanel`'s row button (`src/components/dashboard/ExceptionLeadPanel.jsx:44-76`, `onDrill` prop at `:83`), wired up in `src/components/dashboard/ManagerOverviewTab.jsx:9,54,100,117-125`. This is the **Team Dashboard's** exception-first lead, not the Master Sheet.
- Grepping `src/components/manager/MasterSheet.jsx` for `Drill` returns **zero matches** — `MasterSheet.jsx` does not import or open `AgentDrillDrawer` at all. The brief's assumption that the drill drawer is "likely referenced from `MasterSheet.jsx`" does not hold in current source.
- Data sources on open (`AgentDrillDrawer.jsx:170-190`): `submissions` arrive as a prop (`submissionsByAgent[agentId]` from `useBranchOverview`, already loaded); on-open lazy loads `getSettlements` (settlementService), `getGoals` + `getGoalHierarchy` (goalsService), `getAgentHistory` (persistencyService) — each independently `.catch()`-guarded so a rules-denied read degrades to a neutral empty/"unavailable" state rather than an error banner.
- **Overview tab** (`AgentDrillDrawer.jsx:36-116`): a mini hero (YTD API vs floor pace) + a client-derived "Why flagged" reasons list (pace-behind, trending-down via a spark-slope check, reporting-gap) built from the `agent` prop already computed by `managerExceptions.js` — no dedicated talking-points data source, it's a re-presentation of the exception reason.
- **Report tab** (`AgentDrillDrawer.jsx:275-289`): renders `AgentReportView` (`src/components/profile/AgentReportView.jsx`) — the full week→year breakdown (activity, production, ratios) derived via `deriveAgentReportModel`, the same model backing the PDF.
- **Goals tab** (`AgentDrillDrawer.jsx:129-160`, `290-292`): 4-row cascade — Personal commitment / Unit recommendation / Branch target / Company floor — from `getGoalHierarchy`.
- Per-agent daily/weekly activity detail (incl. `serviceCalls`) is available wherever `extractFields()` is called on a submission (`src/utils/extractFields.js:34,84` — `serviceCalls` is the step2/flat "service calls" count, distinct from `serviceContacts` at `:48,99`, a step6/post-sale field). `AgentReportView` (Report tab) is the surface that exposes this field-level detail today; `AgentDrillDrawer`'s Overview/Goals tabs do not.

### 1b. `CoachingNotesModal` — 3 tabs, opened from the Master Sheet row (separate modal, separate entry point)

- `src/components/manager/CoachingNotesModal.jsx:284-328` — tab strip: **Notes / Joint Calls / Prospect Info**.
- Entry point: a per-row hover icon button in `MasterSheet.jsx:363-378` (`onClick` sets `notesAgent` state at `:156`, modal rendered at `:450-457`). This is a **completely separate React tree** from `AgentDrillDrawer` — clicking a Master Sheet row's coaching icon never touches `AgentDrillDrawer`, and there is no path from `AgentDrillDrawer` into `CoachingNotesModal` either.
- **Notes tab**: `coachingNotesService.js` (`addCoachingNote`/`getCoachingNotes`/`updateCoachingNote`/`pinCoachingNote`, `coachingNotesService.js:37-118`). Stored at `tenants/{tid}/users/{agentId}/coachingNotes/{noteId}` (`coachingNotesService.js:29-31`). Categories: `observation | goal | concern | win | action_item` (`coachingNotesService.js:17-23`) — **`action_item` is a display category only; there is no due date, owner, or completion-state field anywhere in the schema** (`coachingNotesService.js:37-62` create payload; `firestore.rules:979-983` create-rule `hasAll` allowlist confirms the same 9 fields, no status/due-date). Visibility is rank-based (`ROLE_RANKS`, `coachingNotesService.js:9-15`); **the agent never reads their own coaching notes** (`firestore.rules:944`, explicit comment).
- **Joint Calls tab** (`JointCallsTab.jsx`): logs `appointmentDate/Time`, `meetingType`, `needCovered`, `comments`, `saleMade`, `coachingMinutes`, `trainingIdentified`, optional link to a Prospect Info prep (`JointCallsTab.jsx:23-37,295-307`). Same manager-chain-private / agent-excluded model as coaching notes (`firestore.rules:1089-1090`).
- **Prospect Info tab** (`ProspectInfoTab.jsx`, via `prospectInfoService.getProspectInfo`): the *inverse* privacy model — **agent-authored, agent reads own, managers read (never write)** (`firestore.rules:997-1011`).

### 1c. No existing "1-on-1" / meeting-session concept anywhere in source

Grep for `oneOnOne|one_on_one|1on1|meetingNotes|meetingLog` across `src/` returns 17 files, all false positives (`ManagerWarTab`/`managerWarService` = the manager's own Weekly Activity Report tracking, unrelated). There is no session/meeting grouping construct in the schema today.

---

## 2. What the mockup's scene 08 proposes

`FunnelOneOnOne` — `docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner/mockups/mastersheet-funnel-scenes.jsx:280-365`. Confirmed as scene **"08 · Desktop · Light · 1-on-1 mode · Devin Lewis"** in the handoff HTML (`.../AgencyTrack Master Sheet Funnel.html:107-109`), inside the `DCSection id="drill"` group whose subtitle (`:102`) describes it as "a full-frame meeting takeover with the agent's week as 8 stage tiles + the weekly standard strip."

- **Entry point**: the coaching drawer's pinned footer "Start 1-on-1" button (`mastersheet-funnel-scenes.jsx:263-270`), which flips `oneOnOne` state to `true` in `FunnelDesktopScene` (`:379-380`) and swaps the entire scene render to `FunnelOneOnOne`.
- **Layout**: full-frame takeover (`width/height: 100%`), not a drawer/modal — replaces the whole app surface. Header (`:295-312`): agent avatar/initials, `"1-ON-1 · WEEK 48 · SOUTH BRANCH"` eyebrow, agent name + status pill, `unit · level · contracted · YTD API` summary line, and an "Exit 1-on-1" pill.
- **Body**: a 4×2 grid of the 8 funnel-stage tiles (`FUNNEL_GROUPS`, from the sibling data file) — each tile shows one KPI (large number, teal-highlighted if terminal/API) plus its sub-metrics (`:315-342`).
- **Footer**: "The Weekly Standard · Actual / Floor" strip — 8 metrics (Tel Attempts, Tel Contacts, F2F Attempts, Qual. Appr., FFIs Cond., CIs Cond., Apps, New Names), each rendered as `actual/floor` with a mini progress bar (`:284-293, 344-362`).
- **What it does NOT show**: no note-taking field, no talking-points list, no action-item/commitment capture, no reference to prior 1-on-1s or open follow-ups, no way to record what was discussed or agreed. It is a pure **read-only, projector-facing number display** — the mockup itself is silent on how the "meeting" part of the meeting (conversation, commitments) gets captured.
- The floor numbers baked into this scene (Tel Attempts 20 / Tel Contacts 8 / F2F 5 / Qual. Appr. 6 / FFIs 3 / CIs 2 / Apps 1 / New Names 5 — `manager-v2-drill.jsx:20-29` has the same 8-row shape as `DRILL_STANDARD`) are mockup-local constants, not sourced from the app's real activity-floors config (see § 5).

---

## 3. Gap analysis — what a REAL 1-on-1 surface needs

**Talking-points generation.** Candidate seed data already exists but is scattered: `AgentDrillDrawer`'s "Why flagged" reasons (`AgentDrillDrawer.jsx:49-64`, pace/trend/reporting-gap), the goal cascade gaps (`getGoalHierarchy`, wired at `AgentDrillDrawer.jsx:181`), and the weekly activity floor comparisons (`weeklyActivityFloors.js`, see §5). None of these are currently assembled into a single "here's what to discuss" view — that would be new composition logic, not new data plumbing, for the read-only parts. The parts that genuinely need new data (open commitments from the last 1-on-1, joint-call follow-ups due) don't exist yet at all (see next point).

**In-room note capture.** The only existing free-text capture UI is `CoachingNotesModal`'s add-note form (`CoachingNotesModal.jsx:389-433`) — but it lives in a modal that is architecturally disconnected from `AgentDrillDrawer` / any future 1-on-1 takeover (see §1b). For notes to be captured live during a projected 1-on-1 without leaving the takeover screen, the note-capture UI would need to be embedded in (or reachable without exiting) the takeover component. Persistence can reuse the existing `coachingNotes` subcollection (`tenants/{tid}/users/{agentId}/coachingNotes`) with no new collection — an optional `meetingDate`/`sessionId` tag would be an **additive** field (extends the `hasAll` list in `firestore.rules:979-983`, itself a rules change and therefore human-gated per CLAUDE.md).

**Action/commitment logging.** No structured tracking exists anywhere. `action_item` is only a `coachingNotes` category label (`coachingNotesService.js:22`) with no `dueDate`, `owner`, or `status` field, and the create-rule's `hasAll` allowlist (`firestore.rules:979-983`) would reject any such field today without a rules change. Two schema paths: (a) extend `coachingNotes` with optional `dueDate`/`status` fields, or (b) a new `tenants/{tid}/users/{agentId}/commitments` subcollection mirroring the coaching-notes privacy pattern. **Either path is a `firestore.rules` change → always human-gated** per CLAUDE.md ("new collections or write paths (first landing)" and "`firestore.rules`... never auto").

**Follow-up on previous 1-on-1 actions.** Depends on the action-item schema above, plus a query surface: `getCoachingNotes()` today only takes `{tenantId, agentId, callerRole, callerUid}` — no category filter, no "open/unresolved" filter, no time-window (`coachingNotesService.js:70-94`). A cross-agent "my open commitments" view for a manager would need either a new query shape per-agent (cheap, N reads) or a `collectionGroup` query (needs a new top-level wildcard rule per the standing collectionGroup-rules pattern already used for `jointCalls`, `firestore.rules:2042-2058`) plus a composite index (`firestore.indexes.json`, which per CLAUDE.md needs explicit deploy confirmation even when additive).

**Privacy considerations.** Two precedents already exist and should be chosen from, not reinvented: (1) the F1/F2 model — manager-chain-private, agent **excluded** entirely (`coachingNotes`, `jointCalls` — `firestore.rules:944,1089-1090`), rank-scoped so a peer unit_manager can't read another UM's note; (2) the F3 model — agent-owned, agent reads own, managers read-only (`prospectInfo` — `firestore.rules:997-1011`). A 1-on-1 surface plausibly needs **both** at once: private manager prep/impressions (F1/F2-shaped) alongside agent-visible commitments the agent should be able to see later (closer to F3-shaped, or a new hybrid — manager writes, agent reads, agent cannot edit). This is exactly the kind of split that needs an explicit ruling (see open question 3), not an assumption baked into a build.

---

## 4. Open design questions for the operator/CD

1. Does "Start 1-on-1" open from the shipped 3-tab `AgentDrillDrawer`, or does it require first porting the mockup's 5-tab `AgentDrill` (Overview/Weekly/Goals/Notes/Joint Work, `manager-v2-drill.jsx:140-147`) into production?
2. Should `CoachingNotesModal`'s Notes/Joint Calls/Prospect Info tabs be folded into the drill drawer (as the mockup implies), or stay a separate modal reached a different way?
3. Are manager-authored 1-on-1 notes agent-visible (F3 `prospectInfo` model) or manager-chain-private (F1/F2 `coachingNotes` model) — or does visibility depend on note category (e.g. "commitment" visible to the agent, "concern" private)?
4. Does a commitment/action item need a due date and an explicit owner (agent vs. manager), or is free-text + category sufficient for a v1?
5. Should the 1-on-1 takeover be a distinct full-screen mode (as mocked, replacing the whole app chrome) or an enhanced tab inside the existing drawer?
6. Is "Start 1-on-1" available to `unit_manager` and up, or scoped narrower/wider than the existing coaching-notes rank model?
7. Is real-time Firestore data required for the takeover screen, or is a snapshot taken at "Start 1-on-1" time (closer to the mockup's static `agent.v`) acceptable for a v1 read-only display?
8. Should "open commitments" surface only the current manager's own authored items (rank-scoped like `coachingNotes`), or every open item across the full management chain for that agent?
9. Is a `meetingId`/session grouping needed for v1, or is a per-note timestamp sufficient to reconstruct "what was discussed at the last 1-on-1"?
10. Should the takeover's "Weekly Standard" floors be sourced from `weeklyActivityFloors.js`'s real `DEFAULT_WEEKLY_ACTIVITY_FLOORS` (10 rows, tenant-configurable), replacing the mockup's 8 hardcoded, differently-named, differently-valued floors?

---

## 5. Feasibility notes

**Buildable as a thin slice with NO schema/rules changes:**
- A read-only "1-on-1 mode" full-screen view that reuses data `AgentDrillDrawer` already loads (`agent` prop + `dataState.settlements/goals/persistency/hierarchy`, `AgentDrillDrawer.jsx:170-190`), re-laid-out as stage tiles + a standard strip. Zero new writes, zero new collections, zero rules changes — purely presentational, sourcing real floors from `weeklyActivityFloors.js` (`DEFAULT_WEEKLY_ACTIVITY_FLOORS`, `weeklyActivityFloors.js:4-15`) instead of the mockup's illustrative numbers. **Note the mockup's 8 floors (Tel Attempts 20 / Tel Contacts 8 / F2F 5 / Qual. Appr. 6 / FFIs 3 / CIs 2 / Apps 1 / New Names 5) do not match the app's real 10-row floor config at all** (different field set, different values) — any real build must source from the live config, not port the mockup's numbers verbatim.
- Wiring a "Start 1-on-1" button that opens the *existing* `CoachingNotesModal` (already has a working Notes tab for live capture) as a side panel or sequential step — reuses existing schema/rules entirely, though it doesn't match the mockup's single-takeover-screen vision and keeps the two-separate-surfaces problem from §1 unresolved rather than fixing it.

**Needs new schema and/or `firestore.rules` changes (always human-gated per CLAUDE.md):**
- Any structured commitment/action item with `dueDate`/`status`/`owner` — new fields (extends a `hasAll`/`hasOnly` allowlist) or a new `commitments` subcollection. **Flag: `firestore.rules` change, human-gated.**
- Any agent-visible commitment that breaks the current agent-excluded `coachingNotes` model — a new `allow get/list` arm for the agent. **Flag: `firestore.rules` change, human-gated.**
- A `meetingId`/session-grouping field spanning notes + joint calls + commitments, if enforced server-side (vs. purely client-side convention) — schema + rules touch across multiple collections. **Flag: `firestore.rules` change if enforced, human-gated.**
- A cross-agent "my open commitments" view for a manager — likely needs a new top-level `collectionGroup` wildcard rule (mirroring the existing `jointCalls` author-arm pattern, `firestore.rules:2042-2058`) plus a new composite index. **Flag: `firestore.rules` change (human-gated) + `firestore.indexes.json` change (requires explicit deploy confirmation per CLAUDE.md, even if additive).**

**Unresolved by the mockup, must be decided before any build brief locks scope:** how the "meeting" content (talking points shown, notes taken, commitments made) gets captured at all — the mockup's scene 08 is purely a number display with an "Exit 1-on-1" button and no other interaction surface.
