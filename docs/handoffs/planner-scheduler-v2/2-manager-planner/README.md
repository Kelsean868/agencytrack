# Handoff: AgencyTrack — Planner & Scheduler **Manager Surfaces** (coaching tier)

> **Read this first.** This is the **manager tier** of the Agent Planner & Scheduler — the coaching and visibility surfaces a Unit/Branch Manager uses. It is the **same product and the same Nexus design system** as the agent handoff (`planner-scheduler-handoff/`); it does **not** introduce new patterns. Build it in the existing `Kelsean868/agencytrack` repo's conventions. The mockup board (`mockups/AgencyTrack Planner — Manager Surfaces.html`) is the design source of truth; this is the spec; `CLAUDE_CODE_PROMPT.md` is a paste-ready kickoff.

---

## 1. What this is

The agent side lets a field agent **plan and book** their week and **report** results. This manager tier adds two things on top of that same booking data:

- **A personal planner for selling managers** — a manager is *also* a producer. They carry their own book of clients, run management meetings, and **recruit** (career calls, recruiting interviews, career seminars). So they get the full agent planner, extended for a manager's reality: a day that blends **three streams — Sell · Coach · Recruit**.
- **Coaching & visibility surfaces** — leading-indicator visibility on their team and the tools to run a great 1-on-1 and respond when an agent asks for help.

It is a **coaching surface, not a surveillance dashboard.** Everything is framed as "help this agent win" — and the manager's own producing/recruiting life is a first-class part of the product, not an afterthought.

**Persona:** Devon Ramlal · Unit Manager · Unit S·02 · South branch — coaches a 6-agent unit that includes **Marsha Singh** (the agent from the agent mockups), **and** carries his own clients and a recruiting pipeline. Same agents, prospects, activity types (P.C / S.C / A.I / F.F.I / C.I, Sales, free blocks), TTD amounts, and Trinidad names as the agent side — the tiers are one product.

---

## 2. ⛔ Non-negotiable trust constraints (locked product decisions — design and build around them)

These are **not** styling choices. They are enforced in the mockups and must be enforced in code, including at the data/query layer:

1. **The per-agent stalled-pipeline ratio is AGGREGATE ONLY.** Show the ratio and its trend. **Never** render a drill-down of that agent's individual stalled prospects. No names behind the ratio. (In the UI it always carries a shield/"AGG · PRIVATE" marker so it can't be mistaken for a list.)
2. **The stalled ratio and anything individual NEVER appears on a kiosk, leaderboard, TV, or any public/branch-wide surface.** It lives only in the private manager↔agent coaching context. (Public ranking surfaces rank *reconciled production*, not forward bookings or pipeline health.)
3. **A manager sees a NAMED prospect only when the agent has explicitly ESCALATED it.** Escalations are **agent-initiated, opt-in, and reversible** — the agent can pull one back anytime.
4. **Tone is coaching, not surveillance.** Copy reads as "help this agent win," never "audit this agent." Soft-week signals are framed as *opportunities to coach*, never *failures to flag*.

> If a feature request conflicts with any of the four, it is out of scope until product reopens the decision.

---

## 3. Reuse — do NOT rebuild (shared with the agent tier)

This package ships the shared infra so the board runs standalone, but in the repo you reuse the **same** primitives:

- **Tokens:** `APP_LIGHT` / `APP_DARK` (`app-tokens.jsx`) → repo's `src/index.css` Nexus tokens. Never introduce a new color. (Color bridge table is in the agent handoff README §4.)
- **Fonts:** Cabinet Grotesk (display) · Satoshi (body) · JetBrains Mono (labels) — already imported.
- **Shell:** the existing **Manager** dashboard context. Use `RoleSwitcher current="manager"`; reuse `Topbar`, `Scorecard`, `Pill`, `Eyebrow`, `AmbientBg`. These screens render inside the manager dashboard (`dashboard/ManagerDashboard.jsx`), as new tabs.
- **Motion:** `app-motion.jsx` utilities (`.a-rise`, `.a-fade-up`, `.a-progress-grow`, …) — same gentle daily-use tone.
- **Planner primitives:** reuse `actStyle()`, `ActChip`, `STATUS` pills, `CounterBar`, `DayStripCell` from `planner-shared.jsx` so activity types and status read identically to the agent side.
- **Same DesignCanvas / DCSection / DCArtboard** board pattern; mobile + desktop, light + dark, with empty/loading/error per screen.

New manager-only primitives (in `planner-manager-shared.jsx`) you can lift directly:
`Spark` (sparkline) · `StalledRatio` (aggregate-only chip, always shows the privacy marker) · `KeptRate` · `SoftWeek` (opportunity-framed flag) · `AskPill` (advice / joint-CI / you-take-the-call) · `WinChip` · `BookedVsMin` · `ManagerNav` · `Ava`.

---

## 4. The screens (mockup board sections)

Each is shown **mobile (390×844) + desktop (1280×800), light + dark**, with states where they matter. The board opens with the manager's **personal planner** (sections 0A–0C), then the **coaching/visibility** tier (1–6).

### Personal planner — the manager as producer + recruiter

Managers get the **whole agent planner** (Today, week-booking, add/churn/follow-ups/prep/handoff — see the agent handoff), reused as-is. What's *added* for managers:

| # | Screen | Purpose / behavior |
|---|---|---|
| 0A | **My day (blended)** | The manager's personal landing. The same timeline as an agent's, but every block is tagged with one of **three streams — Sell** (own clients) **· Coach** (1-on-1s, joint calls, unit meetings) **· Recruit** (career calls, recruiting interviews, seminars) — each a distinct hue, with a **time-split readout** so no hat gets dropped. |
| 0B | **My week (book)** | Personal week-booking with **dual minimums**: a (lighter) personal **sales** floor AND a **recruiting-activity** target (R.I / R.C / career seminar). The 7-day board shows the blended mix per day, so a manager can see when coaching is crowding out their own selling. |
| 0C | **My recruiting** | The genuinely new surface the agent planner doesn't have: a **career funnel** (Contacted → Interviewed → Seminar → Selecting), the week's recruiting-activity targets, and a **candidate worklist** with the next step for each. Recruiting interviews & career seminars book onto the same My-Day timeline. + empty state. |
| 0D | **Book a block** | The manager's booking sheet — where **1-on-1s, unit meetings, joint work, training, and recruiting** are all first-class bookable options. A **stream selector** (Sell · Coach · Recruit · Block) reveals the right TYPE choices: **Coach** → 1-on-1 / unit meeting / joint work; **Recruit** → career calls / recruiting interview / career seminar; **Block** → training / company seminar / tradeshow / personal; **Sell** → the P.C–C.I ladder. The "who/what" field **adapts to the type** — an agent for a 1-on-1, the whole unit for a unit meeting, an agent + prospect for joint work, a candidate for recruiting, a free-text title for training. "Save & add another" for rapid entry. (mobile sheet ↔ desktop dialog) |

**New activity types (manager-only), on top of the selling codes:** `R.C` career calls · `R.I` recruiting interview · `R.SEM` career seminar · `1:1` one-on-one · `UNIT` unit meeting, plus free-block types training / company seminar / tradeshow / personal. Joint closing interviews reuse `C.I` but belong to the **Coach** stream. All of these are **bookable from the Book sheet (0D)**, grouped by stream. The three streams map to three hues (Sell = teal, Coach = gold, Recruit = violet/accent) so a blended day stays legible.

### Coaching & visibility tier

| # | Screen | Tier | Purpose / behavior |
|---|---|---|---|
| 1 | **Team overview** | UM/BM | The landing. Roster: each agent's next-week **booked vs weekly minimum** (per activity code), **kept-rate trend** (sparkline), and the **private aggregate stalled ratio**. Soft weeks (e.g. zero C.I booked Thu–Fri) surface early as a gentle "could use a nudge" prompt. Leading indicator, **not** a scoreboard. + loading + error states. |
| 2 | **1-on-1 coaching pack** ⭐ | UM | A per-agent sheet **auto-assembled** for the weekly 1-on-1: planned-vs-actual (booked/kept/target), kept-rate trend, the **aggregate** stalled ratio + trend **with an explicit "aggregate only — names stay private" explainer**, the escalations this agent raised, and **wins to open with**. Plus a suggested conversation outline. Make it feel like a **gift to the manager.** |
| 3 | **Escalation inbox** ⭐ | UM | Prioritized worklist of prospects agents **chose to escalate**. Each card: agent · prospect · stall history (pushes / age) · logged objection · the specific **ask** (advice / joint CI / you take the call). Actions: schedule joint CI, reply with advice, take the call. The **only** surface with named prospects. Includes the **empty state** (a good thing). |
| 4 | **Team capacity + joint-call scheduling** | UM/BM | The manager's own week with agents' escalated **joint calls** slotted in, plus a **team-capacity read** (who's heavy / balanced / light next week) so referrals can be redistributed. Reuses the day-strip + load bars. |
| 5 | **Branch events** | BM | Schedule a branch-wide event (training · company seminar/tradeshow · campaign) that **pushes onto agents' agendas** across the ~2-month horizon — landing as the same free-block types agents book themselves. Secondary. |
| 6 | **Branch booking health** | BM | Branch-level roll-up of forward booked activity + **unit comparison** — shown in the **private** management context, **never** a public leaderboard. Secondary. |

⭐ = gets the most polish. The 1-on-1 pack + escalation inbox are the manager's core value, and the surfaces where the trust constraints matter most. Make the stalled ratio **unmistakably aggregate**.

**States:** every screen needs empty / loading / error, drawn explicitly (the board shows Team loading + error, and Escalation empty on mobile + desktop; reuse the same patterns for the rest).

---

## 5. Assumptions made in the mockups (validate before/while building)

0. **Selling managers get the agent planner too.** The personal planner (0A–0C) **reuses the agent tier's components** (timeline, week-booking, add/churn/prep/handoff) for a manager user — it is not a reimplementation. The only net-new is the **stream tagging** and the **recruiting** activity types + funnel. A non-selling branch manager can have the Sell stream hidden; the Coach/Recruit streams remain.
1. **Placement:** these are **new tabs in the existing Manager dashboard** (`dashboard/ManagerDashboard.jsx`), reached via the manager role — not a separate app. There are two groupings: **My Planner** (personal: My Day / Week / Recruit) and **Team Planner** (coaching: Team / Coaching / Escalations / …). Mobile personal nav: `My Day · Week · [Book FAB] · Recruit · Team`; mobile coaching nav: `Team · Coaching · [Schedule FAB] · Escalations · More`.
2. **Stalled ratio is computed server-side as an aggregate** (e.g. `stalledCount / activePipelineCount` per agent) and **exposed to managers only as the number + a trend** — the API must **not** return the underlying prospect list to a manager. Enforce at the query/security-rule layer, not just the UI. The "stalled" threshold (days since last touch) is tenant-admin config in a **later** handoff; assume a sane default now.
3. **Escalation is a first-class, agent-initiated object** — an agent action on the agent side (a future "escalate / ask manager for help" affordance on the Prep card / churn flow) writes an escalation; the manager inbox reads it; either party can withdraw it. Model it explicitly (see §6).
4. **Kept-rate, booked-vs-minimum, soft-week** are derived from the **same `appointments` data** the agent tier writes — managers read aggregates over their team, scoped by `unitId` / `branchId` and role.
5. **Weekly minimums** are the agent's plan / company floor (reuse Game Plan / Goals targets if present, else per-agent config) — the same source the agent's week-booking counters use.
6. **Branch events** create FREE-block appointments of type training / company-seminar / tradeshow on each targeted agent's calendar (a fan-out write or a referenced shared event the agent agendas resolve).
7. **"~50% of follow-ups convert"** and **"stalled"** framings are product language, not computed guarantees.
8. **Public ranking** (kiosk / leaderboard) already exists and ranks reconciled production; nothing in this tier feeds it. Branch booking health is a separate, private view.

---

## 6. Suggested data model (Firestore — confirm against existing collections)

Builds on the agent tier's `appointments` + `prospects` (don't duplicate). New manager-relevant pieces:

### Personal planner (selling manager)

The manager's own appointments use the **same `appointments` collection** as agents (the manager *is* the agent for their own book), with two additions:

```
// reuse tenants/{tenantId}/agents/{managerId}/appointments/{apptId} with:
  type      // EXTENDED set: ...existing selling codes... | 'RC' | 'RI' | 'RSEM' | 'ONE' | 'UNIT'
  stream    // 'sell' | 'coach' | 'recruit'   (derived from type, stored for fast filtering)
  candidateId  // ref → recruits (for RC/RI/RSEM), instead of prospectId

// Recruiting pipeline — candidates, a parallel light funnel (NOT the sales prospect store)
tenants/{tenantId}/agents/{managerId}/recruits/{recruitId}
  name, phone, source ('referral'|'seminar'|'cold'|...), referredByAgentId?,
  stage   // 'contacted' | 'interview' | 'seminar' | 'selecting'
  nextStep, nextStepAt, notes
  createdAt, updatedAt
```

- **Stream is derived from type** (`RC/RI/RSEM→recruit`, `ONE/UNIT/joint-CI→coach`, everything else→sell) — store it so the My-Day timeline and time-split can filter without a lookup.
- **Recruiting minimums** (R.I/week, career calls/week, seminars) are per-manager config, parallel to the agent's selling minimums.
- Career seminars can be a `recruits`-linked event or reuse the branch-event fan-out (§below) when run at branch level.

### Coaching & visibility tier

```
// Aggregate, manager-readable — NO underlying prospect list exposed to managers.
tenants/{tenantId}/agents/{agentId}/pipelineStats   (computed, e.g. Cloud Function)
  stalledRatio        // number 0–1 (aggregate)
  stalledRatioTrend   // 'up' | 'down' | 'flat'  (vs prior period)
  keptRate            // number 0–1
  keptRateSpark       // number[]  (last N periods)
  bookedNextWeek      // { CI, FFI, AI, SC, ... } counts
  minimums            // { CI, FFI, AI, SC, ... }
  softWeek            // null | { reason }   (derived, opportunity-framed)
  updatedAt
  // ⚠ security rules: a manager may read these aggregate fields for agents in
  //   their unit/branch; the per-prospect "stalled" set is NEVER in this doc.

// Agent-initiated, opt-in, reversible. The ONLY path to a named prospect for a manager.
tenants/{tenantId}/escalations/{escalationId}
  agentId, unitId
  prospectId          // named prospect — visible to manager BECAUSE the agent shared it
  ask                 // 'advice' | 'joint-ci' | 'take-call'
  pushes              // how many times the agent pushed it
  objection           // short text the agent logged
  status              // 'open' | 'scheduled' | 'resolved' | 'withdrawn'
  priority            // 'high' | 'med' | 'low'
  createdAt, withdrawnAt?
  // agent can set status:'withdrawn' anytime → drops off the manager inbox.

// Branch-wide event that fans out onto agent agendas.
tenants/{tenantId}/branches/{branchId}/events/{eventId}
  title, type ('training'|'seminar'|'tradeshow'|'campaign'),
  date, time, reach (audience selector), state ('draft'|'scheduled')
  → on schedule, writes FREE-block appointments to each targeted agent.
```

- **Security rules are part of the deliverable**, not an afterthought — constraints #1–#3 are enforced here. A manager query that could return an agent's individual stalled prospects must be impossible, not merely un-rendered.
- **Team aggregates** (roster, capacity, branch health) read `pipelineStats` + `appointments` scoped by `unitId`/`branchId` via the services layer (`managerService` or a new `plannerManagerService`).

---

## 7. Screen → component map (build in-pattern; all ★ new, under `src/components/planner/manager/`)

| Mockup screen | Suggested component(s) |
|---|---|
| New manager tabs | extend `dashboard/ManagerDashboard.jsx` `activeTab` + **two** nav groups (My Planner / Team Planner); reuse `Shell` |
| 0A · My day (blended) | reuse the agent `DayTimeline` with a `stream` prop on each block + `StreamTag`, `TimeSplitBar`; manager activity codes via an extended `activityType` map |
| 0B · My week | reuse the agent `WeekBooking` + a second `RecruitingTargets` counter group; `streamMixPerDay` |
| 0C · My recruiting | `manager/Recruiting.jsx` + `CareerFunnel`, `CandidateRow`, `RecruitTargets` (new `recruits` model) |
| 1 · Team overview | `TeamOverview.jsx` + `AgentRosterRow`, `StalledRatioChip` (aggregate, privacy marker), `KeptRateSpark`, `SoftWeekFlag`, `BookedVsMin` |
| 2 · 1-on-1 pack | `CoachingPack.jsx` + `PlannedVsActual`, `StalledRatioCard` (+ aggregate explainer), `EscalationMini`, `WinChip`, `ConversationOutline` |
| 3 · Escalation inbox | `EscalationInbox.jsx` + `EscalationCard`, `AskPill`; reuse `manager/JointCallsTab.jsx` for "schedule joint CI" |
| 4 · Capacity + joint calls | `TeamCapacity.jsx` + `JointCallList` (reuse `DayStripCell` / `CounterBar`) |
| 5 · Branch events | `BranchEvents.jsx` + `EventCard`, `EventComposer` (fan-out write) |
| 6 · Branch booking health | `BranchBookingHealth.jsx` + `UnitCompareRow` (private view; not the public leaderboard component) |
| services / rules | `plannerManagerService.js` (team aggregates, escalation CRUD, event fan-out, **recruits** CRUD) + Firestore **security rules** enforcing §2 |

Lift exact spacing/tone/composition from the `planner-manager-*.jsx` files; map every raw value to a token. The personal-planner streams + recruiting primitives live in `planner-manager-personal.jsx` (`streamStyle`, `RCODE`, `mgrCodeMeta`, `StreamTag`, `TimeSplit`, `MgrApptRow`, `StagePill`, `RTarget`).

---

## 8. Bundle contents & how to view

```
planner-manager-handoff/
├── README.md                  ← this spec
├── CLAUDE_CODE_PROMPT.md      ← paste-ready kickoff for Claude Code
└── mockups/
    ├── AgencyTrack Planner — Manager Surfaces.html  ← design source of truth (open this)
    ├── design-canvas.jsx       ← canvas wrapper — infra, not product
    ├── app-tokens.jsx          ← Nexus palettes (light/dark), icons, ttd(), logo
    ├── app-motion.jsx          ← ambient bg + motion classes
    ├── app-shell.jsx           ← Topbar / RoleSwitcher / Scorecard / Pill / Eyebrow (reused)
    ├── app-mobile.jsx          ← mobile frame (MFrame)
    ├── planner-shared.jsx      ← shared agent primitives reused here (ActChip, CounterBar, DayStripCell, PHeader/PBody/PBtn)
    ├── planner-manager-shared.jsx   ← ★ coaching data + primitives (Spark, StalledRatio, AskPill, ManagerNav, TEAM/ESCALATIONS/…)
    ├── planner-manager-mobile.jsx   ← ★ 6 coaching screens (mobile) + states
    ├── planner-manager-desktop.jsx  ← ★ manager shell + 6 coaching screens (desktop)
    ├── planner-manager-personal.jsx      ← ★ PERSONAL planner: streams + recruiting model + primitives + My Day/Week/Recruiting (mobile) + states
    └── planner-manager-personal-desk.jsx ← ★ personal planner: My Day/Week/Recruiting (desktop)
```

**To view:** open the `.html` in a browser (or `npx serve` the `mockups/` folder so the sibling `.jsx` modules load). Interactive board — **pan** = drag, **zoom** = ⌘/Ctrl-scroll, **Focus** (⤢) → fullscreen then **←/→**, **Esc** exits. **Start in `planner-manager-shared.jsx`:** `StalledRatio` is where constraint #1 is encoded; `ESCALATIONS` shows the opt-in named-prospect shape; `TEAM` is the per-agent aggregate shape (a good basis for `pipelineStats`).

> Pairs with the agent package `planner-scheduler-handoff/`. Build the agent tier (or at least its `appointments`/`prospects` model + an "escalate" affordance) first — this tier reads that data.

---

## 9. Out of scope

The agent surfaces (separate handoff — already done). Deep tenant-admin config (stall-threshold settings, funnel analytics) — a later, separate handoff. Anything that violates the four trust constraints in §2. Public recognition surfaces (kiosk/leaderboard) — they already exist and rank reconciled production, not this data.
