# Handoff: AgencyTrack — **Agent Planner & Scheduler** (new feature)

> **Read this first.** This is a build package for **one new agent feature**: a mobile-first day-planning + scheduling surface that digitizes Tatil Life's paper *Weekly Planner* booklet. It is meant to be dropped into the existing `Kelsean868/agencytrack` codebase and built **in that repo's conventions** — it is a *build-in-pattern* job, not a paste-the-HTML job. The mockups in `mockups/` are the **design source of truth**; this README is the spec; `CLAUDE_CODE_PROMPT.md` is a ready-to-paste kickoff.

---

## 1. What this is

A surface where a field agent **books a week of appointments into time slots, works the day, reports the results** — and the plan **pre-fills the report** so they confirm instead of re-type. AgencyTrack already owns the *reporting* half (Daily Capture → Weekly Report). This feature adds the *planning* half and closes the loop.

It is an **activity manager, not a CRM.** No deal pipelines with dollar values, no email composer, no custom-field builder. Speed beats features: **if a flow is slower than paper, it has failed.**

**Who uses it:** field agents, on a phone, time-poor, often between appointments. Agent-only — no manager/coaching/analytics/admin surfaces in this feature.

**The three flows that must feel effortless** (prioritize polish here):
1. **Phone-day** — booking many appointments fast across a ~2-month horizon.
2. **Daily churn** — cancel → reschedule, or fill the freed slot.
3. **Plan → report handoff** — the evening pre-fill. This is the payoff.

---

## 2. Fidelity: high-fidelity

The mockups are final colors, type, spacing, and interaction intent. Recreate faithfully using the codebase's existing primitives and tokens. When a mockup and an existing component disagree, the **mockup is the target**.

---

## 3. Target codebase (same repo as the v2 app redesign)

| Aspect | Value |
|---|---|
| Framework | **React 19** (function components + hooks) |
| Build | **Vite** |
| Styling | **Tailwind CSS 3.4** (`darkMode: 'class'`) + `@layer components` in `src/index.css` |
| Icons | **lucide-react** |
| Charts | **recharts** (not needed for this feature) |
| Backend | **Firebase** (Auth, Firestore, Cloud Functions, Storage), multi-tenant `tenants/{tenantId}/…` |
| Routing | role-based switch in `src/App.jsx` (no router lib); agent dashboards own `activeTab` and render inside `Shell` |
| State/data | Firestore via `src/services/*`; auth/role via `useAuth()` (`src/context/AuthContext`) |
| A11y | gated in CI (`@axe-core/playwright`, `eslint-plugin-jsx-a11y`): landmarks, labelled controls, `focus-visible` rings, 44px targets, `prefers-reduced-motion` guards |

**Read before starting:** `CLAUDE.md`, `APP_MANUAL.md`, `docs/CONTEXT.md`, and `src/index.css` (the whole design system lives there).

---

## 4. Design system — **Nexus** (use the existing tokens; never introduce a new hex)

The mockups were drawn in the same tokens the repo ships. Map every raw value to the existing token.

| Mockup value (raw, light) | Token → Tailwind |
|---|---|
| teal `#01696F` | `primary` → `bg-primary text-primary ring-primary` |
| teal-deep `#014E52` | `primary-dark` |
| teal-light `#018A91` | `primary-light` |
| teal-tint `#E6F4F4` | `primary/10` / `bg-primary-tint` |
| page bg `#F7F6F2` | `surface` → `bg-surface` |
| card `#FFFFFF` | `card` → `bg-card` |
| ink `#28251D` / mute `#6B6560` / faint `#A8A39C` | `text-ink` / `text-ink-muted` / `text-ink-faint` |
| rule `#E5E2DB` | `border-border` |
| gold `#B07D1A` | `gold` |
| success / warning / danger `#2D7A4F` / `#B4530A` / `#C0392B` | `success` / `warning` / `danger` (+ `*-tint`) |
| violet accent `#5A3FA0` | reuse repo's accent token if present; else `primary` family |

- **Dark mode is real & shipped** — every token has a `.dark` value; `primary` lifts to `#4ab5b8`, surfaces go warm-dark. Build with tokens only and both themes come free. Every mockup ships light + dark.
- **Fonts:** `font-display` = Cabinet Grotesk (headings/numbers), `font-sans` = Satoshi (body), `font-mono` = JetBrains Mono (eyebrows/labels/figures). Already imported.
- **Radius:** cards `rounded-xl`. **Hit targets:** `min-h-[44px]` on interactive controls. **Shadows:** warm-toned `--shadow-*`.
- **Reach for existing utilities** first: `.card`, `.btn-primary`, `.btn-secondary`, `.input`, `.label`, `.shell` / `.sidebar` / `.topbar` / `.bottom-nav`.

---

## 5. The feature — screens, states & flows

The mockup board (`mockups/AgencyTrack Planner & Scheduler v2.html`) is organized into 9 numbered sections, each shown **mobile (390×844) + desktop (1280×800), light + dark**, with empty/loading/error states where they matter.

| # | Screen | Purpose | Key behavior |
|---|---|---|---|
| 1 | **Today (home)** | Default landing. Time-ordered timeline with a live **NOW** marker + visible empty gaps; a day-pulse; a **follow-ups-due strip**; the thumb-reachable **quick-add** (center FAB on mobile, ⌘B on desktop). | Tap a gap → Add sheet. Tap an appointment → Status churn. Empty (nothing booked) + offline error states included. |
| 2 | **Day timeline** | A selected day as a time-ordered list. Each appointment card: time · prospect (or free-block label) · activity type · status. | Empty gaps render as dashed, tappable "tap to book" strips showing the free duration. Day-to-day nav arrows. |
| 3 | **Forward day-strip + week booking** ⭐ | The phone-day booking surface. A horizontally-scrollable strip of upcoming days (~2-month horizon) with a **per-day load/density count**, over the selected week as a 7-day list with a running counter **vs the weekly minimum** ("C.I booked 6/10", visibly short). | **NOT a month grid, NOT a Google/Outlook calendar.** Hand-rolled, list-based. "Add" under each day. Desktop = same strip over a 7-column day board (list per day, no time axis). |
| 4 | **Add / edit appointment** ⭐ | Fast entry. Pick an existing prospect (search) **or** a free block; set time, length, activity type. | Optimized for rapid repeat entry — **"Save & add another"** beside Save. Saved-toast + undo. Desktop = centered dialog. |
| 5 | **Status churn** ⭐ | Tap an appointment → quick actions: **Kept · Reschedule · Postpone · Cancel**. | Cancelled & postponed are **RETAINED** (dimmed / struck-through), **never deleted** — the week stays an honest record. |
| 6 | **Freed-slot suggested fill** ⭐ | When an appointment is cancelled, the freed slot surfaces a "fill this slot" prompt. | Offers: a **due follow-up**, a **"ready anytime" waitlist prospect**, or **"log as prospecting time."** One tap turns a hole back into activity. |
| 7 | **Follow-up worklist** | Prospects whose callback date is due, **batched into one list**. Each row: name · why due ("said call back month-end") · actions **Book · Snooze · Re-qualify · Release**. | ~50% convert, so this list is **central, not secondary**. All-caught-up empty state included. |
| 8 | **Prep card** | Tap an appointment → prospect history, **logged objections (+ how handled)**, product interest, last contact. | **"Copy WhatsApp confirmation"** copies a message the agent pastes & sends manually — **the app never sends.** |
| 9 | **Plan → actual handoff** ⭐ | End-of-day capture, **pre-filled from what was planned and kept** — the agent confirms rather than re-types. Kept appointments map straight to report fields (+ a written sale's API); the postponed item rebooks itself. | Confirm → terminal **"Day logged"** state that flows into the weekly report. **The core payoff — make it obvious & satisfying.** |

**States are required, not optional** — every panel needs loading (skeleton), empty (friendly copy), and error (offline) states. The empty states are drawn explicitly because they matter for a daily tool.

---

## 6. Domain vocabulary (use these exact activity types)

| Code | Meaning | Tone in mockups |
|---|---|---|
| **P.C** | Prospecting calls | violet (a call) |
| **S.C** | Seen call | violet |
| **A.I** | Approach interview | teal (interview ladder) |
| **F.F.I** | Fact-finding interview | teal |
| **C.I** | Closing interview | **solid teal** (the money type) |
| **Sale** | Life / Annuity written | **solid gold** |
| **Free** | Training · company seminars/tradeshows · prospecting time · personal | neutral, dashed |

Currency is always **TTD**. Use realistic Trinidad & Tobago names and amounts (the mockups already do: Marsha Singh, Kavita Ramlogan, Anand Maharaj, Reshma Ali, Dexter Charles, etc.).

---

## 7. Navigation & routing

- **New top-level agent nav item — "Planner"** (mockups place it second, after Dashboard, badged `NEW`). On mobile it gets its **own bottom nav**: `Today · Week · [Book FAB] · Follow-ups · More`, where the center FAB is the quick-add (the thumb-reachable primary action). On desktop it sits in the `Shell` sidebar's top group.
- It renders inside the existing agent `Shell` (sidebar + topbar + mobile bottom-nav) like every other agent tab — wire a new `activeTab` value, don't fork the shell.
- "Today" is the feature's landing tab.

---

## 8. Suggested data model (Firestore — confirm against existing collections first)

Reuse existing prospect data; **do not** build a parallel prospect store. The repo already has prospect surfaces (`agent/ProspectInfoPanel.jsx`) — extend that model.

```
tenants/{tenantId}/agents/{agentId}/appointments/{apptId}
  date            // 'YYYY-MM-DD' in AST (America/Port_of_Spain)
  startTime       // 'HH:mm'
  durationMin     // number
  type            // 'PC'|'SC'|'AI'|'FFI'|'CI'|'SALE'|'FREE'
  prospectId      // ref → prospects (null for FREE blocks)
  freeBlockLabel  // 'Training' | 'Company seminar' | 'Tradeshow' | 'Prospecting time' | 'Personal' (FREE only)
  status          // 'scheduled'|'confirmed'|'kept'|'cancelled'|'postponed'|'done'
  note            // short free text
  apiAmount       // TTD, set when a CI converts to a SALE
  rescheduledToId // apptId the postponed/rescheduled item moved to (retained link)
  createdAt, updatedAt
```

```
prospects/{prospectId}   // likely already exists — extend, don't duplicate
  name, phone, productInterest[], objections[{ text, handledNote }],
  lastContactAt, callbackDueAt, callbackReason, waitlistReadyAnytime (bool), unitCode
```

- **Follow-up worklist** = a query/view over prospects where `callbackDueAt <= now`, batched + sorted by overdue-ness. Not necessarily its own collection.
- **Cancelled/postponed are never hard-deleted** — keep the doc, flip `status`, keep `rescheduledToId`.
- **Offline-first:** the agent books on a phone between calls. Use Firestore offline persistence; show the "N changes waiting to sync" state when offline (mockup screen 05). Plan/booking writes must survive offline and reconcile on reconnect.

### Plan → report mapping (the payoff)

At end of day, aggregate that day's **kept** appointments into the existing report pipeline rather than a new one:

| Kept appointment type | Feeds report field |
|---|---|
| P.C | prospecting-calls count |
| S.C | seen-calls count |
| A.I | approach-interview count |
| F.F.I | fact-finding count |
| C.I | closing-interview count |
| SALE (CI that converted) | new-business app + **API (TTD)** |

Wire this into **`daily/DailyEntryModal.jsx`** / the Daily Capture → Weekly Report path, normalizing through **`src/utils/extractFields.js`** so it lands in the same schema the wizard already uses. The handoff screen is a *confirm* over a pre-filled form, not a fresh entry — reuse the Daily Capture field components, seeded from the day's appointments.

---

## 9. Screen → component map (build in-pattern; all ★ new)

| Mockup screen | Suggested component(s) — under `src/components/planner/` |
|---|---|
| Shell wiring | new `activeTab: 'planner'` in `dashboard/AgentDashboard.jsx`; new bottom-nav set in `shell/MobileBottomNav.jsx` |
| 1 · Today | `planner/PlannerToday.jsx` + `DayTimeline`, `NowMarker`, `FollowupsDueStrip`, `DayPulse` |
| 2 · Day timeline | `planner/DayTimeline.jsx` + `AppointmentCard`, `EmptyGap` |
| 3 · Week booking | `planner/WeekBooking.jsx` + `ForwardDayStrip` (h-scroll, density), `WeeklyMinimums` (counter bars), `WeekDayList` / desktop `WeekBoard` |
| 4 · Add/edit | `planner/AppointmentSheet.jsx` (bottom sheet ↔ desktop dialog) + `ProspectSearch`, `ActivityTypePicker`, `TimePicker` |
| 5 · Status churn | `planner/ChurnActions.jsx` (action sheet/menu) |
| 6 · Freed-slot fill | `planner/FreedSlotFill.jsx` |
| 7 · Follow-up worklist | `planner/FollowupWorklist.jsx` + `FollowupRow` |
| 8 · Prep card | `planner/PrepCard.jsx` + `CopyWhatsappButton` (clipboard only) |
| 9 · Plan→actual handoff | `planner/EveningHandoff.jsx` — composes Daily Capture fields, seeded from kept appointments; on confirm hands to existing report path |
| services | `src/services/plannerService.js` (appointments CRUD, week/day queries, follow-up view, day→report aggregation) |

Factor shared bits into small primitives the way the mockup does: an `ActivityChip` (code + tone), a `StatusPill`, a `TimeRail`, a `CounterBar`, a `DayStripCell`. The mockup `.jsx` files show exact composition, spacing, and tone mapping — lift values from there.

---

## 10. Behavior rules (don't skip)

- **Retention:** cancelled & postponed appointments stay visible (dimmed / struck), never deleted. A postponed item shows where it moved to.
- **WhatsApp:** "Copy confirmation" writes to clipboard only. The app **never** sends a message.
- **Speed:** "Save & add another" keeps the sheet open and resets to the next slot for rapid booking. Minimize taps on the booking path.
- **Freed-slot prompt** auto-surfaces on cancel — it is not a manual action.
- **Handoff** is a confirm over a pre-fill, not data entry. Don't make the agent re-key anything the plan already knows.
- **Time zone:** all day/week windows are **AST (America/Port_of_Spain)** and must match the production-report engine's windows (WK = the Sunday-anchored WAR week).
- **A11y:** semantic timeline (`<ol>`/`<li>`), labelled controls, 44px targets, `focus-visible` rings, reduced-motion guards on the NOW pulse / FAB pulse / progress bars.

---

## 11. Assumptions made in the mockups (validate before/while building)

1. **Nav:** Planner is a **new top-level agent nav item** with its own mobile bottom-nav (Book FAB center). If product prefers it as a tab inside an existing module, the screens are unchanged — only the entry point moves.
2. **"Today"** in the mockup = Tue 23 Jun 2026; horizon runs ~8 weeks out. Real dates come from the clock.
3. **Prospects already exist** in the system; the planner references them and does not create a new prospect store (new prospects can be quick-created from the Add sheet — see screen 10).
4. **Follow-up = a prospect with a due `callbackDueAt`.** "~50% convert" is product framing, not a computed field.
5. **Plan→report** writes into the **existing** Daily Capture / Weekly Report schema; the handoff is the only screen that performs a "real" report write. Booking/churn write only to `appointments`.
6. **Weekly minimums** (e.g. "C.I 6/10") come from the agent's plan/company floor — reuse the Game Plan / Goals targets if available, else a per-agent config.
7. **Offline-first** with Firestore persistence; the "N changes waiting to sync" banner is the offline error state.
8. **Free-block types** are the fixed set: Training · Company seminar · Tradeshow · Prospecting time · Personal.

---

## 12. Bundle contents & how to view

```
planner-scheduler-handoff/
├── README.md                  ← this spec
├── CLAUDE_CODE_PROMPT.md      ← ready-to-paste kickoff prompt for Claude Code
└── mockups/
    ├── AgencyTrack Planner & Scheduler v2.html   ← the design source of truth (open this)
    ├── design-canvas.jsx       ← canvas wrapper (pan/zoom/focus) — infra, not product
    ├── app-tokens.jsx          ← Nexus palettes (light/dark), icons, ttd(), logo
    ├── app-motion.jsx          ← ambient bg + motion classes
    ├── app-shell.jsx           ← desktop sidebar/topbar primitives (reused)
    ├── app-mobile.jsx          ← mobile frame (MFrame) + status bar
    ├── planner-shared.jsx      ← ★ activity model, sample data, all planner primitives
    ├── planner-mobile-a.jsx    ← ★ Today, Day, Week booking, Add sheet
    ├── planner-mobile-b.jsx    ← ★ Churn, Freed-fill, Follow-ups, Prep, Handoff
    ├── planner-states.jsx      ← ★ empty / loading / error
    ├── planner-desktop.jsx     ← ★ desktop shell frame + week board
    └── planner-desktop-screens.jsx ← ★ desktop Today/Day/Follow-ups/Prep/Handoff + modals
```

**To view:** open the `.html` in a browser (or `npx serve` the `mockups/` folder so the sibling `.jsx` modules load). It's an interactive design-canvas board — **pan** = drag, **zoom** = ⌘/Ctrl-scroll, click an artboard's **Focus** (⤢) for fullscreen then **←/→** to step, **Esc** exits. Read each section's subtitle for design intent. The `planner-*.jsx` files (★) carry the exact product UI; the others are shared infra/tokens.

**The activity-tone, spacing, and status logic live in `planner-shared.jsx`** — start there. `actStyle()` is the type→color map; `STATUS` is the status→pill map; the `TODAY_APPTS` / `WEEK_*` / `FOLLOWUPS` consts are the sample data shapes (a good starting point for the Firestore schema).

---

## 13. Out of scope for this feature

Manager / coaching screens · analytics dashboards · admin config · kiosk/TV. Agent-only. No CRM constructs (pipelines, dollar-value deal stages, email composer, custom-field builder). The marketing website and tenant-admin suite are out of scope (covered elsewhere).
