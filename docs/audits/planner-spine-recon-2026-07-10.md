# Planner spine recon — shipped vs design intent (2026-07-10)

**Item:** F11a (read-only recon). **Branch:** `staging` (`4674d6b4`). **Scope:** the *appointments* Planner (item 3.2 — agent Planner + manager Team Planner), NOT the "Weekly Planner v2 / Game-Plan" derived-suggestion surface (a separate spine — `weeklyPlans` collection + `utils/goalDecomposition.js`; see the trap note in § Confidence).

**Purpose:** let a later slice — "agent-side vertical: recurrence/edit flows on OWN appointments" — be contracted and built without further discovery.

**Bottom line up front:** The appointments planner is *shipped and un-gated* (agent Planner + Team Planner both live). **Edit-in-place is fully plumbed at the service/sheet layer but has NO UI entry point.** **Recurrence does not exist anywhere — not in code, not in the mockups, not in any spec.** So slice 1's *edit* half is contractible today (no rules/index change); its *recurrence* half is net-new product design blocked on ~6 operator rulings.

---

## Exists (shipped state, line-cited)

### Routing / gating — Planner is LIVE (un-gated)
- **Coming-soon set is EMPTY.** `src/config/comingSoonTabs.js:5-10` — `COMING_SOON_TABS = new Set([])`; the comments record that Planner (item 3.2) and Prospect Prep (item 3.5) were both un-gated. `MANAGER_COMING_SOON_TABS` is also empty (`:13-14`).
- **Agent Planner nav + render:** nav item `src/components/shell/navConfig.js:60` (`tabId:'planner'`, `testId:'agent-tab-planner'`); render switch `src/components/dashboard/AgentDashboard.jsx:819-830` (`activeTab === 'planner'` → `<AgentPlannerPanel>`), imported `AgentDashboard.jsx:49`.
  - **STALE COMMENT (not a code bug):** `navConfig.js:56` still says *"Planner is the only SOON item (gated via COMING_SOON_TABS)"* and `:61-62` says Prospect Prep "stays SOON" — both stale; neither is in the (empty) set. Cosmetic doc drift.
- **Producing-manager (UM+BM) reach the agent-style route too:** `navConfig.js:104` puts `planner` in `PRODUCING_MANAGER_NAV`; `:243` lists `planner` in the producing-manager order. (But the *manager dashboards* render the Team Planner for `activeTab==='planner'`, see below — so UM/BM landing on 'planner' get the **read-only team view**, not a personal booking desk. See Delta.)
- **Team Planner (manager) nav + render:**
  - ManagerDashboard: import `:58`, nav item `:93` (`roles:['sales_manager']`), render `:650-651` (`activeTab==='planner'` → `<TeamPlannerPanel>`).
  - TenantAdminDashboard: import `:21`, nav item `:57`, render `:387-388`.

### Service — `src/services/plannerService.js` (single Firestore access point)
- **Collection (deliberate divergence from handoff):** FLAT `tenants/{tid}/appointments/{autoId}` — `apptCollection()` `:87-89`, `apptRef()` `:90-92`. Contract + rationale in the file header `:1-32` (handoff suggested a per-agent subcollection; flat + denormalized scope keys was chosen so Team Planner can do cross-agent queries without collectionGroup-rule pitfalls).
- **Contract (header `:9-14`, emulator-tested 20/20):** required keys `tenantId, agentId, agentUnitId, agentBranchId, date('YYYY-MM-DD'), startTime('HH:mm'), durationMin(int 1–720), type∈TYPE_KEYS, status∈STATUS_KEYS, note(≤2000), createdAt, updatedAt`; optional `prospectId, freeBlockLabel, apiAmount(≥0|null), rescheduledToId`. Extra keys allowed (rule uses a `hasAll` floor).
- **Enums:** `APPOINTMENT_TYPES` `:44-52` (PC/SC/AI/FFI/CI/SALE/FREE), `APPOINTMENT_STATUSES` `:56-63` (scheduled/confirmed/kept/done/postponed/cancelled), `FREE_BLOCK_LABELS` `:67-69`.
- **Write paths:**
  - `createAppointment(tenantId, data, meta)` `:130-133` — pins `agentId`+denormalized unit/branch from `meta`; `buildCreatePayload` `:98-122`.
  - `updateAppointment(tenantId, apptId, patch)` `:141-153` — **owner field edit** (date/startTime/durationMin/type/status/note/prospectId/freeBlockLabel/apiAmount). **Deliberately never mutates the immutable pins** `agentId/agentUnitId/agentBranchId/tenantId` (they aren't in the patch allowlist). `updateDoc` merges, so the merged doc still satisfies the `hasAll` floor.
  - `setAppointmentStatus(...)` `:160-167` — status flip (+ optional apiAmount).
  - `postponeWithRebook(...)` `:175-183` — creates the NEW appt first, then flips the original to `status:'postponed'` + `rescheduledToId:<newId>`. Two writes; no delete.
- **Read paths:** `getAgentDay` `:188-198` (`agentId==` + `date==`); `getAgentWeek` `:205-215` (`agentId==` + date RANGE + `orderBy('date')`); `getTeamWeek` `:225-255` (role-split: UM `agentUnitId==uid`, BM `agentBranchId==branchId`, SM+/TA date-range only). Role rank via `getWarRoleRank` (`services/managerWarService`).
- **NO delete path anywhere** — cancel/postpone are status flips (honest week record).

### Agent panel — `src/components/planner/AgentPlannerPanel.jsx`
- Three views: Today / Week / Follow-ups (`VIEWS` `:21-25`; pills `:271-292`). Week is the **current** Sun–Sat only (`weekRange(getTodayTT())` `:138-140`); there is no forward-horizon navigation.
- Loads `getAgentWeek` + `getProspectInfo` in parallel `:158-171`; four states (loading skeleton `:294-295`, error+retry `:296-306`, empty `:312-323`, list).
- Booking sheet: `<AppointmentSheet>` `:444-454`; churn action sheet `ChurnDialog` `:71-115` (Kept/Reschedule/Postpone/Cancel) opened by tapping a card (`AppointmentCard onChurn` `:36-68`, `:326`).
- **Every sheet open is `mode:'create'`** — `openBook` `:200-201`, churn reschedule/postpone `:227-235`, follow-up "Book" `:431`. **There is NO `mode:'edit'` caller** (grep-confirmed: only three `setSheet` sites, all `mode:'create'`).
- Week counters vs floor `:190-197`; end-of-day handoff (screen 9) `:330-352` → `onCarryToDaily(seed)` seeds DailyCaptureV2 (`AgentDashboard.jsx:828`, seed derived by `deriveSeedFromKept`).

### Sheet — `src/components/planner/AppointmentSheet.jsx`
- **Already supports edit:** prop `mode='create'|'edit'` `:18`; title switches on it `:93-95`; "Save & add another" only in create mode `:277`; initial values hydrate every field from `initial` `:29-38`. **So the edit UI exists and is ready — it just is never invoked with `mode:'edit'`.**
- Field set matches the contract; API field shows for SALE/CI `:41`, `:232-250`.

### Helpers — `src/components/planner/planner.helpers.js`
- Week/day math `:15-32`, grouping `:41-59`, `deriveFollowups` (client-side over prospect prep, keyed on `intendedAppointmentDate` — the handoff's `callbackDueAt` is explicitly NOT contracted) `:101-119`, `deriveSeedFromKept` + `PLAN_TO_DAILY_FIELD` `:130-164`. `RETIRED_STATUSES={cancelled,postponed}` / `COMPLETED_STATUSES={kept,done}` `:83-85`.

### Team panel — `src/components/planner/manager/TeamPlannerPanel.jsx`
- Read-only roster of agents with a booking this week `:143-159`; read-only `CoachingDrill` per agent `:24-86`; **no write arm** (documented `:88-102`). Explicitly SKIP-LOGGED (needs collections outside the item-3.2 contract): stalled-pipeline ratio, escalation inbox, recruiting funnel, and all coaching WRITE actions `:96-101`.

### Firestore rules — `firestore.rules:1433-1502` (`match /appointments/{apptId}`)
- `validApptWrite()` `:1448-1464` — enforces `tenantId==tenantId`, `agentId==request.auth.uid`, the `hasAll` required-key floor, date regex, `durationMin` int 1–720, type/status enum membership, note ≤2000, apiAmount null|(number≥0). **Extra keys pass** (hasAll floor, not hasOnly).
- `allow create` `:1466-1469` — signed-in owner who `isAgent() || isProducingManager()` + `validApptWrite()`.
- `allow update` `:1471-1474` — `resource.data.agentId == request.auth.uid` + `validApptWrite()` on the merged doc. **Owner can update own appt fields today.**
- `allow get` `:1476-1483` — owner OR SM/TA/PA OR BM(same branch) OR UM(agentUnitId==uid).
- `allow list` `:1485-1499` — four query-safe split arms (owner / UM / BM / SM+TA+PA), mirroring `recruitingCandidates`.
- `allow delete: if false` `:1501` — **no deletes, ever.**

### Composite indexes — `firestore.indexes.json:347-388`
- `(agentId ASC, date ASC)` `:347-360` — serves `getAgentDay` + `getAgentWeek`.
- `(agentUnitId ASC, date ASC)` `:361-374` — serves UM `getTeamWeek`.
- `(agentBranchId ASC, date ASC)` `:375-388` — serves BM `getTeamWeek`.
- (SM+/TA `getTeamWeek` uses a single-field `date` range — no composite.)

### Verification / smokes
- **NO dedicated appointments-planner smoke exists.** `scripts/verification/weekly-planner-slice-1-smoke.mjs` is the *other* spine (Game-Plan "Suggested weekly plan" card + goal decomposition — header `:1-24`; touches no `appointments`).
- The only real write-read planner coverage is the **VH staging suite**: `scripts/verification/vh/tier3.mjs` leg `t3-appt-churn-postpone` `:140-201` (drives postpone-with-rebook through the UI: original → Postponed + new appt appears after reload) and `t3-team-planner-readonly` `:205+`. Catalogued in `scripts/verification/SMOKES.md:16`. Staging-only, requires seeded fixtures.

---

## Delta (design intent vs shipped)

**Canonical design intent** = `docs/design-system/screens-v2/agencytrack-planner-handoff/1-agent-planner/` (README spec + `mockups/`) and `2-manager-planner/`. Per `DESIGN-FOLDER-CATALOG.md:44,92-93` this is the single (post-dedupe) planner handoff and is CURRENT/canonical (byte-identical duplicate folders were deleted). **Catalog staleness:** `DESIGN-FOLDER-CATALOG.md:92` still says the `planner` tab is *"gated coming-soon in navConfig.js"* — stale; it is live.

README screen table: `agencytrack-planner-handoff/1-agent-planner/README.md:74-88`.

### Agent planner — per-screen
| # | Screen (README `:74-88`) | Shipped? | Delta |
|---|---|---|---|
| 1 | Today home: time-axis timeline, live **NOW** marker, day-pulse, follow-ups strip, center **Book FAB** / ⌘B | **PARTIAL** | Shipped Today is a simple card **list** (`AgentPlannerPanel.jsx:310-354`), no time axis, no NOW marker, no day-pulse, no dedicated bottom-nav/FAB (a header "Book" button `:260-267`). |
| 2 | Day timeline w/ empty gaps as dashed **"tap to book"** strips + day-nav arrows | **NOT shipped** | No gap rendering, no per-day arrows. |
| 3 | ⭐ Forward day-strip **~2-month horizon** (h-scroll, per-day density) + week 7-day list w/ counters vs minimum | **PARTIAL** | Week 7-day list + counters SHIPPED (`:357-407`); the **forward ~2-month horizon strip is NOT** — week is locked to the current week (`:138-140`). No future-week booking navigation. |
| 4 | ⭐ **Add / edit** appointment; "Save & add another"; saved-toast + undo | **PARTIAL — the key one** | Add SHIPPED; **Edit has no entry point** (see Exists). No saved-toast/undo. |
| 5 | ⭐ Status churn: Kept · Reschedule · Postpone · Cancel; cancelled/postponed retained | **SHIPPED** | `ChurnDialog` `:71-115`; retained-status styling `:37-50`. |
| 6 | ⭐ **Freed-slot suggested fill** on cancel (due follow-up / waitlist / log-as-PC) | **NOT shipped** | No freed-slot prompt. |
| 7 | Follow-up worklist: Book · **Snooze · Re-qualify · Release** | **PARTIAL** | List SHIPPED (derived) `:411-439`; only **Book** action — Snooze/Re-qualify/Release absent. |
| 8 | Prep card: objections+handling, product interest, **Copy WhatsApp** (never sends) | **NOT shipped** in planner | Prospect prep lives in a separate `prospect-info` tab; no in-planner prep card / WhatsApp copy. |
| 9 | ⭐ Plan→actual handoff (pre-filled Daily Capture) | **SHIPPED** | `deriveSeedFromKept` + `onCarryToDaily` → DailyCaptureV2 (`:330-352`, `AgentDashboard.jsx:828`). |

### RECURRENCE / appointment-EDIT semantics — what the mockups actually specify
- **Recurrence: NOTHING.** Exhaustive grep of the handoff (HTML + all `.jsx` mockups) for `recur/repeat/series/every week`: **zero recurrence concept.** Every "repeat"/"Repeat" hit is either CSS `gridTemplateColumns:'repeat(...)'`, the lucide **`IconRepeat`** glyph used on a *follow-up-due* card ("Said call back month-end" — `planner-desktop-screens.jsx:465`, `planner-mobile-a.jsx:41`), or **"rapid repeat entry"** = the *Save-&-add-another* fast-booking pattern (`planner-mobile-a.jsx:194,345`; README `:80`). The feature is explicitly scoped "activity manager, not a CRM… speed beats features" (README `:12`). **→ Agent-side recurrence is net-new product design with no design source.**
- **Edit:** screen 4 is titled **"Add / edit appointment"** (README `:80`; mockup section `planner-mobile-a.jsx:194`). Design intent is that tapping an appointment can open the same sheet to edit its fields. But the **churn** action sheet (screen 5) lists only Kept/Reschedule/Postpone/Cancel — **no explicit "Edit fields" action** — so *where* Edit is triggered is under-specified by the mockups.

### Data-model deltas (README `:113-146` vs shipped)
- **Collection path:** README suggested `tenants/{tid}/agents/{agentId}/appointments/{apptId}`; shipped is **flat** `tenants/{tid}/appointments/{apptId}` + denormalized `agentUnitId`/`agentBranchId` (deliberate — `plannerService.js:4-6`, `firestore.rules:1435-1441`).
- **Follow-ups:** README wanted a `callbackDueAt`/`callbackReason`/`waitlistReadyAnytime` prospect extension; shipped derives from the existing `intendedAppointmentDate` client-side (`planner.helpers.js:87-119`). So screens 6/7's richer actions have no backing fields.

### Manager Team Planner
- README `2-manager-planner/` designs a coaching cockpit (team overview + drill + coaching write actions); shipped is **read-only roster + read-only drill** with the richer surfaces SKIP-LOGGED for a data-contract ruling (`TeamPlannerPanel.jsx:96-101`). Out of scope for slice 1 but relevant sequencing context.

---

## Rules / index implications for an agent-side recurrence+edit slice

### Edit-in-place (own appointment)
- **Rules: NO CHANGE.** `allow update` already permits an owner to rewrite own-appt fields and re-validates via `validApptWrite()` on the merged doc (`firestore.rules:1471-1474`). `updateAppointment` (`plannerService.js:141-153`) is the emulator-tested path.
- **Index: NO CHANGE.** Edit is a single-doc `updateDoc`; no query.
- **Delete:** stays `false` — edit must never rely on delete (already true; the sheet only patches).

### Recurrence (create-many; optional series operations)
- **Simplest materialization = N independent `createAppointment` calls.** Each passes `validApptWrite()` unchanged → **no rule change** for create-many.
- **If a series needs a grouping key** (e.g. `recurrenceId`/`seriesId` to later edit/cancel a series): it is an **extra key** → passes the `hasAll` floor with **no rule change** (extra keys allowed, `firestore.rules:1452-1456`). *(Optional hardening: add it to the validated set — a rules edit, not required.)*
- **Index only if you QUERY by the series key across weeks.** Editing/cancelling "this and all following" by querying `where('agentId'==)+where('seriesId'==)` would need a new composite `(agentId ASC, seriesId ASC)` in `firestore.indexes.json`. **Avoidable:** operate within the already-loaded week (client-side filter by seriesId) → no new index. Cross-week series ops → +1 composite.
- **No-delete constraint shapes recurrence.** Because `allow delete:false`, a "delete this occurrence / cancel series" must be **status flips** (`cancelled`) on concrete docs — a virtual/rule-only recurrence model fights the shipped per-doc churn model. Concrete-doc expansion is the grain-of-the-code choice.

---

## Slice sequence (recommended)

> **Recommendation: split the briefed "recurrence/edit" into two slices** — edit is contractible now; recurrence needs rulings first.

### Slice 1a — Edit-in-place on own appointment (CONTRACTIBLE NOW)
Wire the already-built edit plumbing to a UI entry point.
- **Files to touch:**
  - `src/components/planner/AgentPlannerPanel.jsx` — add an "Edit details" action to `ChurnDialog` (`:71-115`) (or a secondary tap on `AppointmentCard`), and a `setSheet({ mode:'edit', initial: {...appt, id: appt.id} })` caller. `handleSheetSave` already routes `mode==='edit' && sheet.initial?.id` → `updateAppointment` (`:209-210`) — **no new save logic.**
  - (Optional) `AppointmentSheet.jsx` — no change needed; already `mode`-aware.
- **Service:** none new — `updateAppointment` exists (`plannerService.js:141-153`).
- **Rules:** none. **Index:** none.
- **Smoke legs to add** (there is no dedicated planner smoke — either add `scripts/verification/appointments-planner-smoke.mjs` or a VH tier3 leg): (1) open an existing appt in edit mode, change time+type+note, save, reload, assert persisted; (2) assert immutable pins (`agentUnitId`/`agentBranchId`) unchanged after edit; (3) four-states + console-clean.
- **Decision surface:** only the *placement* of the Edit trigger (defensible default: "Edit details" row in `ChurnDialog`). Contractible with that default noted.

### Slice 1b — Recurrence on own appointments (BLOCKED — needs rulings; see DECISIONS-NEEDED)
- **Files:** `AppointmentSheet.jsx` (recurrence controls in create mode), `plannerService.js` (a `createRecurringAppointments` that loops `createAppointment`, optionally stamping a `seriesId`), `planner.helpers.js` (occurrence-date expansion).
- **Rules:** none required for create-many; optional additive `seriesId` validation.
- **Index:** none *unless* cross-week series edit/cancel is chosen (then `(agentId, seriesId)` composite).
- **Smoke:** create a weekly series over N weeks; assert N docs; if series-edit chosen, assert the chosen scope semantics.

### Later slices (sequencing context, not slice 1)
- 2 — Forward ~2-month horizon week navigation (screen 3). 3 — Day-timeline gaps + NOW marker (screens 1-2). 4 — Freed-slot fill (screen 6). 5 — Follow-up actions Snooze/Re-qualify/Release + `callbackDueAt` prospect extension (screen 7). 6 — In-planner Prep card + WhatsApp copy (screen 8). 7 — Manager Team Planner coaching write surfaces (needs the SKIP-LOGGED data-contract ruling).

---

## Ambiguities / DECISIONS-NEEDED (operator, one line each)

**Recurrence (all net-new — no design source):**
1. **Cadence:** weekly only, or also daily / biweekly / monthly?
2. **Horizon/termination:** end-date, occurrence-count (N times), or rolling/indefinite?
3. **Materialization:** expand into N concrete appointment docs at create time (fits the no-delete, honest-week model), or store a rule and render virtually?
4. **Edit scope on a recurring occurrence:** this-only / this-and-following / whole-series (calendar-standard three-way) — which are supported?
5. **Cancel/postpone scope for a series:** does cancelling one occurrence detach it, and is there a "cancel series" action (must be status-flip, not delete)?
6. **What recurs:** FREE blocks (e.g. "Training every Monday") only, or also prospect-bound appointments (recurring the same prospect weekly is unusual for this domain)?

**Edit (small, but a placement call):**
7. **Edit trigger placement:** add "Edit details" to the `ChurnDialog` action sheet, a secondary tap/long-press on the card, or a header affordance? (Mockup screen 4 says "Add/edit" but screen 5's churn actions omit an explicit Edit — under-specified.)

**Adjacent (not slice-1-blocking, flag for a ruling):**
8. **`agentUnitId` source:** `AgentDashboard.jsx:824` passes `agentUnitId={userProfile?.unitId}`, while the contract/UM-read-arm expects `agentUnitId == the caller's unit manager's uid` (`plannerService.js:18-20`; UM arm `:247`). Correct **iff** `userProfile.unitId` is the UM's uid (plausible — matches `unitGoals/{unitId}` and `prospectInfoService` conventions) but **unverified** here. If it's a unit *code* instead, UM Team-Planner reads silently return nothing. Worth a one-time data check before any team-planner slice.

---

## Confidence + gaps
- **HIGH:** shipped agent/team components, service, rules block, indexes, gating state, and the recurrence-absence in the mockups — all directly read and line-cited.
- **Trap avoided:** "Weekly Planner v2 / Slice 1-3" briefs + `weekly-planner-*-smoke.mjs` + `docs/design/Weekly-Planner-Slice-*.html` are a **different spine** (Game-Plan derived-suggestion / `weeklyPlans`), not the appointments planner. Do not conflate.
- **NOT verified:** (a) the `userProfile.unitId == UM uid` assumption (item 8 above — not chased); (b) whether the emulator-tested "20/20" contract claim in `plannerService.js:9` still holds against current `firestore.rules` (I read the rule; did not run the emulator); (c) any live prod/staging data shape; (d) full read of the manager mockups (`2-manager-planner/`) beyond the recurrence grep and the shipped-panel's own SKIP notes; (e) the HTML mockup boards were grepped, not visually rendered.
- **Falsification hooks:** the "recurrence absent" claim would be overturned by any recurrence field in `firestore.rules`/`plannerService.js` or a recurrence control in a mockup `.jsx` — none found. The "edit un-wired" claim would be overturned by a `setSheet({mode:'edit'})` caller — grep found none (only three `setSheet` sites, all create).
