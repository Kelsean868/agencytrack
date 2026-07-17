# Planner E1–E5 — read-only recon

| | |
|---|---|
| **Validity SHA** | `17a7ec3189db58775d1946424ff010c951fb41ba` (staging HEAD, branch `staging`) |
| **Date** | 2026-07-13 |
| **Mode** | READ-ONLY recon. No code, no builds, no deploys. |
| **Design authority** | `docs/design-system/proposals/planner-scheduler-v2/README.md` + `mockups/` (§10 "Feedback round", artboards F1–F12). **Sole source.** |
| **Scope** | E1–E5 as the folder README defines them. Run 9's six features are shipped and out of scope. |

> Every finding below was grep-verified against the validity SHA. Where the README's stated assumption is contradicted by shipped code, the finding is marked **README WRONG** and is the highest-value content in this document.

---

## 0. Headline

**The README predates Run 9 and its central E2 instruction is now wrong.** It says drag-drop must "call the EXISTING `postponeWithRebook`". At HEAD, Run 9's F3b split explicitly made reschedule an **update-in-place** and left `postponeWithRebook` as the **rebook + tombstone** grammar — with a regression test locking that separation. Following the README literally would make every drag create a duplicate doc and a `postponed` tombstone, reintroducing exactly what F3b removed.

**E3 has a hard blocker the README does not mention:** there is no phone number on prospects anywhere in the schema, so E3's Call/WhatsApp notify is not buildable as specced.

Two of nine named reuse targets don't exist as claimed. Two README numbers (64px rail, ~168px reclaim) are design-board numbers that don't match shipped CSS (72px, 160px).

---

## 1. Rule 17 verification — every function the README names

| Named target | Exists? | Evidence | Verdict |
|---|---|---|---|
| `groupByDate` | ✅ | `planner.helpers.js:41` — `groupByDate(appts = [])` → `Map<date, sorted[]>` | Reuse as claimed |
| `sortByStartTime` | ✅ | `planner.helpers.js:35` — `sortByStartTime(appts = [])` → new array | Reuse as claimed |
| `buildWeekDates` | ✅ | `planner.helpers.js:15` — `buildWeekDates(dateStr)` → 7 `YYYY-MM-DD` Sun→Sat | Reuse as claimed |
| `postponeWithRebook` | ⚠️ **exists, but README's use of it is WRONG** | `plannerService.js:298` | **See §2 — the E2 headline** |
| `deriveFollowups` | ✅ | `planner.helpers.js:198`; tested in `__tests__/planner.helpers.test.js` | "test like `deriveFollowups` is tested" is a valid model |
| `getTodayTT` | ✅ **but wrong path implied** | `src/utils/dateInputs.js:41` — **not** a planner helper | Import path correction only |
| `weeklyActivityFloors` | ❌ **README WRONG** | Not a planner helper. It is a **config field** on companyMinimums, constants at `src/utils/weeklyActivityFloors`, consumed via `getCompanyMinimums()` (`DailyCaptureV2.jsx:663`) | See §7 |
| `onCarryToDaily` | ✅ | Real prop: `AgentPlannerPanel.jsx:293`, invoked `:1122`, wired from `AgentDashboard.jsx:828` | Reuse as claimed |
| `computeLateCascade` | ❌ (expected) | No match anywhere | E3 creates it — correct as specced |

**Un-named but load-bearing — the README missed it:** `bulkUpdateAppointments(tenantId, updates)` already exists at `plannerService.js:249`, with `BULK_CHUNK_SIZE = 400` (`:232`), sequential chunk commits, and a never-silent partial-apply error (`:265`). The README tells E3 to "batch `updateAppointment` time shifts" as if that batching must be built. **It already exists and E3 should call it.** See §5.

---

## 2. E1 — Desktop 3-day + week views

**Premise: CONFIRMED.** `AgentPlannerPanel.jsx:969` is the single `max-w-3xl mx-auto px-4 py-6` wrapper — the only `max-w-*` in the whole planner tree. The panel has just **2** responsive-prefix usages total in ~60k of JSX; it is effectively a single non-responsive column. The README's description of production is accurate.

**Touches:** `AgentPlannerPanel.jsx` (view state `:300`, `VIEWS` `:95–97`, render `:969+`). NEW: `PlannerViewToggle` + desktop grid renderer (README suggests a sibling `PlannerDesktopBoard.jsx` mounted at `lg:` — reasonable).

**Reuse targets are all real** (see §1) — no new date math needed, as claimed.

### Finding E1-a — the toggle collides with the existing view tabs (**DECISION**)

`VIEWS` at `:95–97` is already `Today · Week · Follow-ups`. E1 adds a `Day / 3 days / Week` **density** toggle. That is a second, orthogonal axis that reuses the words "Day"/"Week" with different meaning — the shipped "Week" is a *tab*, E1's "Week" is a *column density*. Left unresolved this ships two controls both labelled Week.

Three coherent resolutions: (a) density toggle replaces the Today/Week tabs on desktop, Follow-ups becoming its own tab; (b) density toggle is a sub-control that only appears when the Week tab is active; (c) tabs stay and the density toggle is desktop-only chrome beside them. The mockups (F1 "3-day", F2 "Week board") show a board, not tabs — but do not show the Follow-ups tab at all, so they don't settle it. **Operator ruling required.**

### Finding E1-b — a multi-column grid breaks the A5 selection model

`visibleSelectableIds` (`:404–411`) documents its own contract: *"index order here IS DOM order — shift-click ranges resolve against it (A5 req 2)"*. For the week view it does `weekDates.flatMap(d => live(sorted(byDate.get(d))))` — day-major order. In a single column that equals DOM order. In a `grid-cols-7` board, DOM order is still day-major per column, but the *visual* order a user shift-clicks across is row-major (reading across columns at the same time-of-day). Shift-click ranges will select what looks like the wrong set.

Not fatal, but E1 must either re-derive `visibleSelectableIds` for grid views or scope shift-click to within-column. **This is a real E1 cost the README doesn't price.**

### Finding E1-c — ArrowLeft/Right already cycles views

`:938–944` binds Arrow keys to cycling `VIEWS`. In a multi-column board, Arrow keys are the natural cross-column card navigation (and E2's required keyboard alternative). The bindings will collide. **Decision coupled to E1-a.**

### Finding E1-d — the tablet band is unspecified (**DECISION**)

`src/index.css:1955–1956` forces the 72px rail at **768–1023px**. E1 says "desktop only" and mobile untouched. 768–1023 is neither: the rail is already collapsed there but the planner would still render mobile single-column. Does the board start at `md:` (768) or `lg:` (1024)? **Operator ruling required.**

**Backend surface: NONE.** No new reads, writes, rules, or indexes. Pure-client. ✅

---

## 3. E2 — Drag & drop rescheduling

### Finding E2-a — **README WRONG.** `postponeWithRebook` is the wrong mutation. *(highest-value finding)*

The README (and `CLAUDE_CODE_PROMPT.md`) instruct: *"ON DROP call the EXISTING `postponeWithRebook` — drag is a faster path to the same reschedule, not a new mutation."*

At HEAD this is false in both halves:

**1. `postponeWithRebook` is not a move — it's a create + tombstone.** `plannerService.js:298–306`:
```js
export async function postponeWithRebook(tenantId, originalApptId, newData, meta) {
  const newId = await createAppointment(tenantId, newData, meta);
  await updateDoc(apptRef(tenantId, originalApptId), {
    status: 'postponed', rescheduledToId: newId, updatedAt: serverTimestamp(),
  });
  return newId;
}
```
Two writes, a new doc id, and the original retained forever as a `postponed` tombstone. Dragging a card 20 minutes would permanently add a postponed row to the agent's honest week record and a second doc.

**2. Run 9 F3b already built the correct path and explicitly divorced it from this one.** `AgentPlannerPanel.jsx:723–731`:
> *"F3b (R4): Reschedule is an update-IN-PLACE on the SAME doc — identity and series linkage preserved (contrast with postpone's rebook + tombstone)."*

and `:614–615`:
> *"Postpone rebook (F3b: reschedule NO LONGER uses this path — it is now an update-in-place on the same doc…)"*

**3. A regression test locks the separation.** `__tests__/AgentPlannerPanel.test.jsx:1016`: *"postpone still rebooks via postponeWithRebook — never an update-in-place"*.

**Corrected instruction for the build brief:** on drop, call **`updateAppointment(tenantId, apptId, { date, startTime })`** — the F3b reschedule grammar. `date` and `startTime` are both in the `buildUpdatePatch` allowlist (`plannerService.js:209–210`), so a drag needs **no service change at all**. The README's own intent ("drag is a faster path to the same reschedule, not a new mutation") is *better served* by `updateAppointment` — it is the reschedule path; `postponeWithRebook` is the postpone path.

Everything downstream in the README's E2 paragraph inherits the error: **"Series instances: drop = 'just this one moves' (same scope-lock as postpone; show the existing series note)"** is redundant under the correction — `:727–729` records that a reschedule *is inherently* "just this one" because a single-doc update touches no other instance, and therefore does **not** raise `SeriesEditChoice`. No scope-lock UI is needed on drop; the property falls out of the mutation.

### Finding E2-b — undo/redo is an unpriced requirement

Every churn action pushes to `usePlannerHistory` (`:622–628`, `:641–647`), with undo writing back *only* the patched keys. A drag that bypasses history would be the sole un-undoable mutation in the planner — a real regression in a surface whose whole grammar is undoable. E2 must push a `{label:'Reschedule', undo, redo}` entry. Cheap, but must be in the brief.

### Finding E2-c — touch story (**DECISION**)

README: grip dots "(desktop)", churn dialog "the only mobile path". Consistent with E1 being desktop-only, and no touch DnD is implied. But the **768–1023 tablet band** (E1-d) is touch-capable *and* rail-collapsed. If the board renders at `md:`, drag lands on touch devices with no touch DnD implementation. Cleanest: board + drag both gate at `lg:` (1024). **Confirm.**

**Backend surface: NONE** *under the correction.* `updateAppointment` with `{date, startTime}` uses the existing allowlist and the existing `allow update` arm (`firestore.rules:1559–1562`). No new writes, rules, or indexes. Pure-client. ✅
*(Had the README been followed, E2 would still be rules-clean — but semantically wrong.)*

---

## 4. E5 — Collapsed-rail space adaptation

**Premise: CONFIRMED, mechanism better than the README hopes.** The rail is real: `Shell.jsx:118–129` toggles a `sidebar-collapsed` class on `document.documentElement` and persists to `localStorage.agencytrack-sidebar-collapsed`.

**Crucially it is a CSS class on `<html>`, not React state.** `src/index.css:1924` — `.sidebar-collapsed .shell { grid-template-columns: 72px 1fr; }`. So the planner needs **no prop, no context, no subscription**. Dropping the cap on multi-column views is genuinely automatic, exactly as the README claims. E5 is close to a one-line change at `AgentPlannerPanel.jsx:969` (conditional `max-w-3xl` → `max-w-none` for desktop board views).

### Finding E5-a — **README WRONG (numbers).** 72px rail, 160px reclaim — not 64px / ~168px

- Rail is **72px**, not 64px: `index.css:1924` and `:1956`.
- Expanded is **232px**: `index.css:1295` — `grid-template-columns: 232px 1fr`.
- Reclaim is therefore **232 − 72 = 160px**, not "~168px".

Cosmetic, but diagnostic: these are design-board numbers, not shipped-CSS numbers — the same provenance gap that produced the E2 error. Any brief copying "64px"/"168px" into a comment or test would bake in a wrong constant.

**Backend surface: NONE.** Pure CSS. ✅

---

## 5. E3 — Running-late cascade

The most complex of the five, and the only one with a **hard blocker**.

### Finding E3-a — **BLOCKER.** Prospects have no phone number. Call/WhatsApp is not buildable.

E3 requires *"Call / WhatsApp buttons per affected prospect with a prepared copy-on-tap message"*. The complete prospect write surface is `prospectInfoService.js:96–134`:

`clientName, clientAge, clientOccupation, prospectingSource, socialPlatform, appointmentType, objections, policyType, intendedAppointmentDate`

**There is no phone, mobile, or contact-number field.** An exhaustive grep for `phone|mobile|contactNumber|telNumber|msisdn|whatsappNumber` across `src/services/**` and `src/lib/schema/**` returns hits only on **users** (`onboardingService.js:46`, `userService`) and **recruiting candidates** (`recruitingService.js:115`) — never prospects. There is no number to link to.

Compounding it, this isn't an oversight to patch casually: `docs/AgencyTrack_Workshop_Roadmap_Revision.md` locked **demographics OUT** of prospect fields. Adding a phone number is a product decision that reopens a locked ruling — and it converts E3 from pure-client into a **schema + rules change** (`prospectInfo` validator), which carries a **promotion flag-review gate**.

Options for the operator: **(a)** add `phone` to prospectInfo — reopens the locked decision, adds rules + service + form surface, promotion-gated; **(b)** ship E3 without notify (cascade + preview + push only) — keeps E3 pure-client and autonomous-safe, delivers most of the value; **(c)** notify via a manual-entry number not persisted — awkward, low value. **Operator ruling required. (b) is the recommendation** — it decouples the blocker from the feature and keeps E3 in the autonomous channel.

*Also note:* no `tel:` or `wa.me` link pattern exists anywhere in the app today (`LoginScreen.jsx:299` explicitly declines one). Even under (a), the notify affordance is net-new UX with no in-repo precedent to match.

### Finding E3-b — the cascade batch already exists; use `bulkUpdateAppointments`

The README says "batch `updateAppointment` time shifts", implying hand-rolled batching. **`bulkUpdateAppointments` (`plannerService.js:249–276`) is exactly this and already shipped** — same `buildUpdatePatch` allowlist as single edits (so a cascade can never write a field a single edit couldn't), chunked at 400 under Firestore's 500 cap, sequential commits, and a partial-apply failure that **throws with counts and is never silent** (`:265–270`). Its own docstring confirms the rules story: *"Rules evaluate client-SDK batch writes per-doc, so each update passes the same owner + `validApptWrite` arm a single update does."*

**Batch bound: a non-issue.** A cascade is bounded by appointments remaining in one agent's day — realistically <20, against a 400-doc chunk. The cap will never be approached.

**Answering the brief's question directly: the cascade batch is entirely within existing rules and limits, and introduces no new write path** — *provided* notify is resolved via option (b).

### Finding E3-c — cascade semantics (**DECISIONS**)

The README's gap-smart rule is well specified for the simple case but leaves four holes, all needing rulings before `computeLateCascade` can be written:

1. **Does "everything after this" cross midnight into tomorrow?** A 4:30pm appt pushed +30 with a 5pm following could spill past end-of-day. Recommend: clamp at day boundary, surface a "can't fit today" row. The `date` field is per-doc so crossing days is *possible* — which is exactly why it needs an explicit ruling rather than an accident.
2. **Already-late-chained appointments** — if an appt was already pushed once and is late again, does the second cascade re-derive from original or current times? (Current times, presumably — but the preview's struck-through "old time" then means "before this push", not "as booked".)
3. **Notify message wording ownership** — who owns the copy ("running ~20 min behind, still good for 1:20?")? Moot under option (b).
4. **What counts as "un-churned"** — `RETIRED_STATUSES` exists in the panel; E3 must state which of `scheduled|confirmed` trigger the prompt and confirm `kept|cancelled|postponed|done` never do.

Also: the client tick must use TT conventions via `getTodayTT` (`src/utils/dateInputs.js:41` — **not** the planner-helpers path the README implies).

**Backend surface under option (b): NONE new.** Reuses `bulkUpdateAppointments` + `setAppointmentStatus`. Pure-client. ✅
**Under option (a): schema + rules change → promotion flag-review gate.** ⚠️

---

## 6. E4 — Meeting notes thread

The only enhancement with a genuine, unavoidable **data-model decision**, and the one whose cost the README most understates.

### Finding E4-a — the storage decision, resolved against shipped rules (**DECISION**)

The README offers `appointments/{id}/notes[]` **"(or a subcollection)"** as if interchangeable. Against shipped rules they are very different:

**Array-on-doc.** `validApptWrite()` (`firestore.rules:1529–1552`) uses **`hasAll`** — a *floor*, not `hasOnly`. An unknown `notes` key therefore **passes the existing rule unchanged**. That sounds free, and it is the trap: it means a `notes` array would land **completely unvalidated** — no element shape, no length cap, no per-note size bound — inside a collection where every other field is tightly constrained (`note is string && size() <= 2000` at `:1543`). Shipping an unvalidated unbounded array into an otherwise-locked doc is a real regression in the rules' integrity, and Firestore's 1MiB doc cap becomes the only ceiling. Doing it *properly* means adding validation → **rules change anyway**.
*(Contrast `appointmentTemplates` at `:1601`, which does use `hasOnly` — the codebase knows the stricter idiom.)*

**Subcollection.** The `match /appointments/{apptId}` block **closes at `firestore.rules:1594`** with no nested match and no recursive wildcard. Firestore rules do not cascade, so `appointments/{id}/notes/{noteId}` is **denied by default** → a new rules arm is required, unambiguously.

**Either path is a rules change.** The array's "no rules change needed" appearance is an artifact of `hasAll` being a floor, and acting on it would be the wrong call. **Operator ruling required.** Recommendation: **array-on-doc with added validation** (`notes is list && notes.size() <= N`), because it keeps notes inside the existing single-doc read the week query already performs — a subcollection would need a per-appointment read to display a thread, which the week board (7 days × N appts) cannot afford.

### Finding E4-b — the service allowlist blocks notes today

`buildUpdatePatch` (`:207–219`) copies **only** allowlisted keys. `notes` is not among them, so `updateAppointment` would **silently drop** a notes write — no error, just nothing persisted. E4 requires a `plannerService` change regardless of storage model. Worth stating plainly since the silent-drop failure mode is easy to lose an hour to.

### Finding E4-c — **the hidden cost the brief must price.** "Notes travel with prospectId" needs a new index

E4 requires past appointments' notes for the same `prospectId` to surface on the prep card / booking sheet. Today's reads cannot serve that:
- `getAgentWeek` (`:345`) is `(agentId, date>=, date<=)` — the loaded week only.
- `getAgentDay` (`:328`) is `(agentId, date)`.
- `getSeriesInstances` (`:367`) is `(agentId, seriesId, date)`.

None can fetch *"all appointments for this prospect across all time"*. That is a new query — `where('agentId','==',uid) + where('prospectId','==',pid) + orderBy('date')` — requiring a new composite `(agentId ASC, prospectId ASC, date ASC)`.

**`firestore.indexes.json` contains zero `prospectId` entries** (grep count: 0). The three shipped `appointments` composites are `(agentId, date)`, `(agentUnitId, date)`, `(agentBranchId, date)` (lines 348–387), plus the F3c series composite. **A new index is required**, must be deployed via `firebase deploy --only firestore:indexes` (does *not* auto-deploy on merge), and the query must keep `agentId == uid` first to stay inside the owner `allow list` arm (`:1574–1576`).

The precedent is exact and reassuring: F3c added `(agentId, seriesId, date)` for the same class of cross-week read. E4 needs the `prospectId` sibling.

### Finding E4-d — legacy note migrate-read (**DECISION**)

README: *"Keep the legacy `note` as the first thread entry on migrate-read."* Read-time synthesis (never written back) is the safe reading and keeps `note` authoritative for its 2000-char rule at `:1543`. But it needs an explicit ruling on: does editing the legacy entry write it into `notes[]` and blank `note`? Does the booking sheet still write `note`, or does it become thread-only? Both `note` (`:214`) and any new `notes` would otherwise drift. **Operator ruling required.**

**Backend surface: rules change + new composite index + service change → promotion needs attended flag-review.** ⚠️ E4 is not autonomous-safe.

---

## 7. Finding — `weeklyActivityFloors` is misdescribed (**README WRONG**)

The README's framing sentence describes shipped production as *"week counters vs `weeklyActivityFloors`"*, listing it alongside genuine planner helpers. It is not a planner helper and not a planner-local anything:

- Constants live at `src/utils/weeklyActivityFloors` (`WEEKLY_ACTIVITY_FLOOR_ROWS`, `DEFAULT_WEEKLY_ACTIVITY_FLOORS`).
- It is a **tenant config field** on companyMinimums, written by `EditConfigModal.jsx:205–210` via `setCompanyMinimums`.
- It is read at runtime via `getCompanyMinimums()` → `mins.weeklyActivityFloors` (`DailyCaptureV2.jsx:663`).

Low blast radius — E1–E5 don't need to touch it — but it confirms the README describes production from memory rather than from source, which is the root cause of the E2 and E5 errors. **No brief should treat any un-verified README claim as load-bearing.**

---

## 8. Backend surface summary — autonomous eligibility

| | Backend surface | New writes / rules / indexes | Channel |
|---|---|---|---|
| **E1** | None | None | **Pure-client — autonomous-safe** ✅ |
| **E2** | None *(under the §3 correction)* | None — `updateAppointment` + existing allowlist + existing rules arm | **Pure-client — autonomous-safe** ✅ |
| **E5** | None | None — CSS only | **Pure-client — autonomous-safe** ✅ |
| **E3** | Reuses `bulkUpdateAppointments` + `setAppointmentStatus` | **None under option (b)** (no notify). Option (a) adds prospect schema + rules ⚠️ | **Autonomous-safe under (b); promotion-gated under (a)** |
| **E4** | Rules change (validated `notes`) + **new composite `(agentId, prospectId, date)`** + service allowlist | **Yes — rules + index** | **Promotion needs attended flag-review** ⚠️ |

Confirmations against the brief's specific questions:
- **E1/E2/E5 are pure-client — confirmed.** No new writes, rules, or indexes. ✅
- **`postponeWithRebook` still exists and is unchanged by Run 9** (`plannerService.js:298`) — but Run 9 **did** split Reschedule out of it, so it no longer behaves as E2 expects. See §3.
- **E3's cascade is within existing rules and limits** — `bulkUpdateAppointments` is chunked at 400 vs Firestore's 500, and a day's cascade is <20 docs. No new write path.
- **E3's notify is not client-only-safe as specced** — not because links write anything (they don't), but because **there is no phone number to link to**. §5.
- **E4's array-vs-subcollection is a real decision**, and — contrary to the natural reading — the array does *not* avoid a rules change once validated. §6.
- **E4's prospectId surfacing needs a new index.** Zero `prospectId` entries exist today. §6.

---

## 9. Build sequence — validated

The README's order is **E1 → E5 → E2 → E3 → E4**. Against the code this holds, with one addition:

- **E1 first — correct and load-bearing.** The grid is the canvas; E2's drop targets are grid cells and E5's cap-drop only means anything once multi-column views exist.
- **E5 with E1 — correct, and cheaper than the README thinks.** The `sidebar-collapsed` class is CSS-only, so E5 is effectively one conditional class at `:969`. It could fold into E1's PR entirely.
- **E2 after E1 — correct** (hard dependency: drop targets need columns).
- **E3 after E2 — NOT a dependency.** `computeLateCascade` is a pure helper over appointment arrays and its sheet/modal is independent of the board. **E3 is parallelizable with E1/E2/E5** — the only reason to sequence it later is review bandwidth. Worth knowing if the operator wants to split runs.
- **E4 last — correct**, and now clearly right for a second reason the README doesn't give: it is the only rules+index-touching item, so it belongs in a separately-gated PR regardless of build order.

**Hidden prerequisite the README omits:** E1 must resolve the view-toggle IA collision (§2, E1-a) and the `visibleSelectableIds` DOM-order contract (E1-b) *before* E2 lands, because drag interacts with card selection. That makes E1's brief materially larger than "add a toggle and a grid".

---

## 10. Verdict — split, don't run E1–E5 as one

**Recommendation: two runs, split at the promotion boundary.**

**Run A (autonomous-eligible, pure-client): E1 + E5 + E2 + E3(b).** All four touch zero rules, zero indexes, zero new write paths. E1+E5 are naturally one PR. E2 is small once corrected (a drag calling `updateAppointment` + a history entry). E3 under option (b) is a pure helper + a modal over an existing bulk service. Nothing here needs a flag-review gate.

**Run B (promotion needs attended flag-review): E4.** Rules change + new composite index + service allowlist change + a migrate-read semantic. It is the only item that must not auto-merge, and `firestore.indexes.json` does not auto-deploy on merge — it needs an explicit dispatcher `firebase deploy --only firestore:indexes` with Console verification. Isolating it keeps Run A's channel clean.

**Reasoning.** The complexity argument for splitting is real but secondary — E3's cascade math and E4's notes model are each meaty, but E3 is meaty in a *testable pure-helper* way (`computeLateCascade`, exactly like `deriveFollowups`) which is well-suited to an autonomous run. The decisive line isn't complexity, it's the **promotion gate**: E4 is the only item that touches rules and indexes, and mixing it into a run with four pure-client items forfeits the autonomous channel for all five. Splitting at that seam costs one extra PR and buys a clean gate.

**Caveat on Run A:** it is autonomous-eligible only *after* the §11 decisions are ruled. E3-a in particular is a hard blocker — without the (b) ruling, E3 cannot be built at all, and if the operator picks (a), E3 moves to Run B.

---

## 11. DECISIONS-NEEDED — **11 rulings**

Ordered by blocking severity. Nothing should be briefed until these are ruled.

| # | Item | Decision | Severity |
|---|---|---|---|
| **1** | **E2** | **Confirm the §3 correction: drop calls `updateAppointment` (F3b reschedule), NOT `postponeWithRebook`.** The README's instruction contradicts shipped code + a regression test. Everything in E2's brief depends on this. | 🔴 **Blocker — README is wrong** |
| **2** | **E3** | **Notify has no phone number to call.** Choose: (a) add `phone` to prospectInfo — reopens the locked "demographics OUT" ruling, adds rules+schema, promotion-gated; **(b) ship E3 without notify (recommended)** — keeps E3 pure-client; (c) manual entry. | 🔴 **Blocker — not buildable as specced** |
| **3** | **E4** | **Notes storage: array-on-doc vs subcollection.** Both require a rules change (array passes `hasAll` unvalidated → must add validation; subcollection needs a new arm — the match block closes at `:1594`). **Recommend array + validation** (subcollection can't serve the week board's read budget). | 🔴 **Blocker — data model** |
| **4** | **E4** | **Confirm the new composite `(agentId, prospectId, date)`** for prospectId-cross-appointment surfacing, + that it deploys via explicit `firebase deploy --only firestore:indexes` with Console verification. Zero `prospectId` indexes exist today. | 🔴 **Blocker — hidden cost** |
| **5** | **E1** | **View-toggle IA collision** — shipped `Today · Week · Follow-ups` tabs vs E1's `Day / 3 days / Week` density toggle, both saying "Week". Replace tabs / nest under Week / coexist? Mockups don't settle it (no Follow-ups tab shown). | 🟠 High |
| **6** | **E1/E2** | **Breakpoint: `md:` (768) or `lg:` (1024)?** The 768–1023 band already forces the 72px rail but is touch-capable. Board at `md:` puts drag on touch with no touch-DnD. **Recommend `lg:` for both.** | 🟠 High |
| **7** | **E3** | **Cascade scope semantics** — does "everything after this" cross midnight into tomorrow (recommend: clamp at day boundary + surface a "can't fit today" row)? How do already-late-chained appts re-derive — from original or current times? | 🟠 High |
| **8** | **E4** | **Legacy `note` migrate-read** — read-time synthesis only (recommend), or write-back? Does the booking sheet keep writing `note`, or become thread-only? Otherwise `note` and `notes[]` drift. | 🟠 High |
| **9** | **E1** | **`visibleSelectableIds` DOM-order contract** (`:404–411`, A5 req 2) breaks in a grid — shift-click ranges resolve against day-major order while users read row-major. Re-derive for grid, or scope shift-click within-column? | 🟡 Medium |
| **10** | **E1/E2** | **ArrowLeft/Right already cycles views** (`:938–944`) but is the natural cross-column navigation and E2's required keyboard alternative. Rebind? Coupled to #5. | 🟡 Medium |
| **11** | **E3** | **"Un-churned" definition** — which statuses trigger the late prompt? Confirm `scheduled|confirmed` only and that `RETIRED_STATUSES` never do. Also confirm notify-copy ownership if #2 resolves to (a). | 🟡 Medium |

---

## 12. Self-critique (Rule 22) — what this recon did NOT verify

- **No mockup pixel review.** F1–F12 were enumerated by grepping artboard labels out of the HTML, not opened in a browser. Spacing, density, and the exact grip/ghost/tilt treatments are unverified — a builder must open the board. Any claim here about *visual* intent is weaker than the code claims.
- **`hasAll`-passes-unknown-keys is reasoned, not executed.** §6's claim that a `notes` array passes `validApptWrite` unchanged follows from `hasAll` being a floor (`:1533`), and the codebase's own `hasOnly` contrast at `:1601` supports the reading. But no emulator test was run to prove it. It's the load-bearing premise of E4's rules story and deserves an emulator check in Phase 1 — note CLAUDE.md's own banked caveat that `diff().affectedKeys()`-style rule tests mislead when values don't change.
- **The E4 index shape is inferred from the query I'd write, not from a query that exists.** `(agentId, prospectId, date)` assumes the surfacing reads all-time per prospect and orders by date. A different product shape (e.g. last-3-appointments only, or prospect-scoped without ordering) could need a different composite — or none. #4 should be re-derived once #3 and the surfacing UX are ruled.
- **Run 9's six features were taken as out-of-scope on the operator's word,** not independently audited for E1–E5 collisions beyond the F3b/postpone split and the A5 selection model. A5 bulk-select and A1 undo both surfaced as E2 interactions only because I went looking; there may be more in A2/A3/A4 that a full Run 9 diff read would surface.
- **`prospectInfoService` was read at its write surface** (`addProspectInfo`, `:96–134`) and grep-confirmed across services/schema. If a phone lives on a *different* prospect-ish collection I didn't enumerate, E3-a softens. I consider this unlikely — the grep was broad — but it is the finding with the largest consequence if wrong.
- **Not verified:** that the shipped 3 appointments composites are actually `Enabled` in the Firebase Console (read from `firestore.indexes.json`, not Console), and no lint/test/build was run (read-only mode, correctly).

---

## 13. OPERATOR RULINGS (2026-07-13)

All 11 DECISIONS-NEEDED from §11 are dispositioned below. These rulings **govern the build briefs** — where a ruling overrides a recon recommendation, the ruling wins. Item numbers match §11.

| # | Item | Ruling |
|---|---|---|
| **1** | **E2 mutation** | **ACCEPTED** the §3 correction. Drag-drop calls **`updateAppointment(tenantId, apptId, { date, startTime })`** — both keys are in the `buildUpdatePatch` allowlist — **NOT `postponeWithRebook`**. The README instruction is stale (pre-Run-9); shipped code + the F3b regression test govern. |
| **2** | **E3 notify** | **Ship WITHOUT Call/WhatsApp notify (option b).** No prospect phone field exists, and adding one reopens the locked "demographics OUT" ruling. **Bank "prospect contact fields" as a separate product decision** (out of scope for E1–E5). E3 stays **pure-client**. |
| **3** | **E4 storage** | **SUBCOLLECTION** — `appointments/{id}/notes/{noteId}` — **OVERRIDING the recon's array-on-doc recommendation.** Rationale: the array path rests on the `hasAll`-passes-unvalidated premise the recon itself flags as *reasoned, not emulator-tested* (§12); a subcollection gets a **clean independent rules arm with per-note validation** and **cannot bloat the appointment doc**. The recon's "array serves the week-board read budget" argument does **not** apply — the week grid never reads notes (they render only on appointment-open). **Run B item; Phase 1 must emulator-test the rules regardless.** |
| **4** | **E4 prospectId index** | **DEFERRED.** With subcollection storage + "notes travel with the prospect" pushed to **Run B phase 2**, the `(agentId, prospectId, date)` composite is **not needed for the core thread**. Re-derive if/when cross-appointment surfacing is actually built. |
| **5** | **E1 IA collision** | **NEST** the `Day / 3-day / Week` density toggle **UNDER the existing Week tab.** Keep `Today · Week · Follow-ups` as the top-level modes; density is a **sub-control within Week**. Today stays single-day. |
| **6** | **E1/E2 breakpoint** | **`lg:` (1024) for BOTH** the board and drag. The 768–1023 touch-capable band gets **no drag-drop** (no touch-DnD implementation); below `lg:` keeps the single-column planner + churn-dialog reschedule path. |
| **7** | **E3 cascade scope** | **CLAMP at the day boundary** — never cross midnight; surface a **"can't fit today"** row for overflow. **Already-late-chained** appointments **re-derive from CURRENT (pushed) times**, not original booked times. |
| **8** | **E4 legacy note** | **READ-TIME SYNTHESIS, thread-only going forward.** The legacy `note` string surfaces as a **synthesized first thread entry** (never written back); the booking sheet writes to the **thread**, and **stops writing `note`**. **No dual-write.** Run B. |
| **9** | **E1 shift-click** | **SCOPE within-column.** Cross-column selection is **individual-click only**. Avoids the day-major-vs-row-major DOM-order break in `visibleSelectableIds` (§2, E1-b). |
| **10** | **E1/E2 arrow keys** | **Coupled to #5:** since density is now a sub-toggle, view-cycling **no longer needs the Arrow keys** — so Arrows become **cross-column card navigation** + (with a modifier) **E2's keyboard-move alternative**. Concrete key binding to be specified in the build brief. |
| **11** | **E3 trigger** | **`scheduled` \| `confirmed` ONLY** trigger the running-late prompt. `RETIRED_STATUSES` (`kept` \| `cancelled` \| `postponed` \| `done`) **never** trigger it. |

### The split (locked)

- **Run A — autonomous, pure-client:** **E1 + E5 + E2 + E3 (without notify)**. `lg:`-gated, **no rules / no index changes**, normal merge channel.
- **Run B — attended:** **E4 alone** — subcollection storage + a **new rules arm** with per-note validation. **Phase 1 must emulator-verify the `hasAll` premise before building.** The `prospectId`-cross-appointment surfacing is **phase 2** of Run B (deferred index per #4).

### Carried-forward caveat (Rule 22, §12 item 1)

**No mockup pixel review was done in this recon.** The **Run A build MUST open `mockups/AgencyTrack Planner & Scheduler v2.html`** (§10, artboards F1–F12) and match the **visual intent** — grip dots, ghosted origin, lift/tilt, cascade preview with struck-through old times — **not build from the structural description alone.** F1–F12 were enumerated by grepping labels out of the HTML, never rendered.
