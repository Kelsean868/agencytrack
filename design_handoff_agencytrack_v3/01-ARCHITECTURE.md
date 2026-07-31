# 01 — Architecture

## 1. Shell

One shell owns everything. A single `screen` string drives the sidebar's active
state, the topbar title/subtitle, and which screen component renders. There are no
nested layouts and no per-screen chrome.

```
<div class="nexus" [data-view="mobile"] [.dark] [.is-focus]>
  <a class="skip">                          skip link (see DEFECT-CLASSES §1)
  <div class="shell">                       grid: sidebar | column
    <nav class="side" [.is-collapsed]>      sidebar, COLLAPSED BY DEFAULT
      brand · role line · SideNavSections · footer avatar · chevron toggle
    <div>                                   flex column, min-width:0
      <Topbar title subtitle dark onToggleMode>
      <div class="pl-body">                 flex row
        <main id="at-main" class="pl-main"> the routed screen
        <div class="pl-rail" [.is-collapsed]>  action plan (Planner only)
  overlays (event · prep · call console · sheets)
```

### Shell state

| State | Default | Persisted | Notes |
|---|---|---|---|
| `screen` | `Planner` | no | the router |
| `role` | `Agent` | no | Agent · Manager · Recruit; changes nav + screen set |
| `dark` | from `localStorage` | **yes** (`at-app-dark`) | |
| `navCollapsed` | **`true`** | no | collapsed by default — decision §1 |
| `railOpen` | `true` | no | action-plan rail |
| `focus` | `false` | no | requests real Fullscreen API on the frame |
| `scale` | `day` | via prefs | `day` \| `week` |
| `smart` | `false` | via prefs | **modifier**, not a third scale — decision §5 |
| `view` | `desktop` | no | prototype-only |
| `currentHour` | `11.33` | no | the "now" line; `autoAdvance` steps it |
| `modal` | `null` | no | `{kind, ...}` — single modal slot |
| `prefs` | see `at-prefs.jsx` | **yes** | 12 settings, per-row + global reset |

### Focus mode

`f` toggles. Requests `requestFullscreen()` on the frame element and sets
`.is-focus`, which drops the frame's border/radius and switches width/height to
`100vw`/`100vh`. Listens for `fullscreenchange` to un-set state when the user
presses Escape — **do not** rely on your own toggle alone; the browser can exit
fullscreen without telling your handler.

### Responsive / mobile

The prototype renders mobile as a **separate component tree** (`at-mobile.jsx`) in a
390×844 frame, not as CSS breakpoints on the desktop tree. That was the right call
for a prototype and is probably the right call in production too: the mobile
information model is genuinely different (see decision §9), not a reflow. It shares
the store, the tokens and the DS components — the frame carries `class="nexus"
data-view="mobile"` so it **inherits app tokens** rather than defining a palette.

Mobile chrome uses the design system's `MobileTab` (fixed 5-slot bottom bar, **More
always in slot five**) and `MobileMore` (slide-up sheet, sections mirroring the
desktop sidebar groups). `MobileTab` is `position:absolute`, so **the consumer must
reserve its height**: `padding-bottom: calc(61px + 14px + env(safe-area-inset-bottom))`.

---

## 2. The shared store — `at-store.jsx`

A single `useSyncStore()` hook returns all state and every mutator. Screens receive
it as one `store` prop. In production this becomes your real store (Zustand/Redux/
server state) — **but keep the mutator boundary**: screens never mutate state
directly, they call a named business action (`logCallOutcome`, `deliverApplication`,
`chasePremium`). The cross-module rules live inside those actions, which is why the
system stays coherent as screens are added.

### Collections

`leads` · `calls` · `tasks` · `events` · `queues` · `activities` · `notifications`
· `agents` · `batches` · `policies` · `settlements` · `recruits`

### Infrastructure

- `commit(label, fn)` — **every** mutation goes through this. Online: sets `syncing`
  for 650ms. Offline: pushes `{label}` onto `queued`. This makes the offline queue
  real rather than decorative, and it is the single seam where you attach optimistic
  updates + server reconciliation in production.
- `log(type, message)` — appends to `activities`, capped at 60. The activity feed is
  this log made visible, which is how a reviewer can *watch* the cross-module rules
  fire instead of taking them on trust.
- `goOnline(next)` — flushes the queue and logs the flush.

### The cross-module rules — the actual system

These are the reason the app is not a CRM. Each is one small rule with a large
consequence; **all of them must survive the port.**

| Trigger | Rule | Why |
|---|---|---|
| `logCallOutcome` any | writes a `call` record with `atHour`, and an activity entry | evidence |
| `logCallOutcome` = **Callback Requested** | creates `PC 30m · Call back <name>` task | the follow-up exists before you hang up |
| `logCallOutcome` = **Appointment Set** | creates `FFI 1h · <name> — <need>` task | ready to drag onto the grid |
| 3 consecutive non-contacts | raises an **archive** notification | stops infinite dialling |
| archive when `cycleCount >= 2` | offers **mark dead** instead | two cycles is enough |
| all calls for a task done | that planner task auto-completes | no manual bookkeeping |
| `completeTask` on a call block | its pending calls auto-complete | same, inverted |
| `finishCallBlock` | logs the block with its **real** duration | duration is measured, not typed |
| `scheduleTask(task, hour)` | task leaves the rail, becomes an `event` | one object, two views |
| `setEventStatus(id, 'Kept')` | marks completed → becomes **evidence** in the ledger | derived numbers |
| `escalateLead` / `bookJointCall` / `answerJointOffer` | emit **`JC`** (not `MTG`) | dev-hours split — decision §7 |
| recruit → Career interview | books `RI 1h · Career interview · <name>` | stage and calendar are one event |
| `deliverApplication` / `convertToClient` | create a policy via **one `newPolicy()` factory** | prevents field desync |
| `chasePremium` | books `COLL 30m · Collect · <name> (<policy>)` | a premium isn't saved by a tick |
| `raiseQuery(settlement)` | records the query, marks the row queried, opens a counter | queries are records |

### Derived, never stored

`dialerQueue` (leads with `status === 'pending'`), `loggedFor(day)`,
`declaredFor(day)`, `pcBreakdown(day)`, `weekTotals()`. **Never** cache a number
that can be derived — the two worst defects in this build were both a stored
figure drifting from its derivation (`06-DEFECT-CLASSES.md` §3).

---

## 3. Roles

| Role | Nav | Screens added |
|---|---|---|
| **Agent** | Today · Planning · Book · Tools · Recognition | Planner, Dialer, Lead Entry, Activities, Weekly Numbers, Pipeline, Book, Commission, Game Plan |
| **Manager** | + Unit | Unit Desk, Planner Manager, Recruit, Who Sees What |
| **Recruit** | reduced | Career portal path only |

Role changes the nav sections **and** the meaning of some screens: the Planner in
Manager role gains the unit lane and the three-way hours split (own / manager /
development). Roles are a prototype switch; in production they are claims on the
session, and `at-trust.jsx` ("Who Sees What") is the spec for what each role may see.

---

## 4. Module map

| File | Contains |
|---|---|
| `at-store.jsx` | `useSyncStore`, seed data, all business rules |
| `at-app.jsx` | shell, routing, roles, keyboard, drag-to-schedule, harness |
| `planner-v3-data.jsx` | `ACTIVITY_METADATA`, hours model, `layoutSlots`, week seed |
| `planner-v3-grid.jsx` | `DayGrid`, `WeekGrid`, smart compression, event blocks |
| `planner-v3-actionplan.jsx` | the right rail: tasks, month strip, counters |
| `at-overlays.jsx` | `EventOverlay`, `PrepOverlay` |
| `at-dialer.jsx` | dialer screen, queue, disposition, wrap-up |
| `at-callconsole.jsx` | connect methods (`tel:`, WhatsApp, bridge, softphone), live notes |
| `at-leadentry.jsx` | single lead form |
| `at-import*.jsx` | bulk CSV/Excel import: parse · map · review · commit |
| `at-activities.jsx` | unified tasks + appointments + call log |
| `at-tally.jsx` | Weekly Numbers ledger — derived vs declared |
| `at-pipeline.jsx` | stage board, Approach → Client |
| `at-book.jsx` | delivery register · clawback clock · persistency |
| `at-commission.jsx` | settlement reconciliation, 4 verdicts, queries |
| `at-gameplan.jsx` | goals → required activity |
| `at-manager.jsx` / `at-pmanager.jsx` | Unit Desk, manager planner |
| `at-recruit.jsx` | recruiting ladder |
| `at-trust.jsx` | Who Sees What — the permissions spec |
| `at-prefs.jsx` | Customise: 12 settings |
| `at-mobile.jsx` | the phone tree |
| `planner-v3.css` | all authored CSS (the DS supplies tokens + components) |
