# Claude Code — kickoff prompt: Planner & Scheduler **Manager Surfaces**

Paste the block below into Claude Code with this `planner-manager-handoff/` folder available in (or alongside) the `Kelsean868/agencytrack` repo. Build the agent tier (`planner-scheduler-handoff/`) first — this reads its `appointments` / `prospects` data.

---

```
You are adding the MANAGER tier of the Agent Planner & Scheduler to this existing repo. It has TWO
parts: (A) a PERSONAL PLANNER for selling managers — a manager also produces, runs meetings, and
RECRUITS, so they get the full agent planner extended with a Sell/Coach/Recruit stream model and
recruiting activity types; and (B) the coaching & visibility surfaces a manager uses on their team.
It is the SAME product and the SAME Nexus design system as the agent tier; do NOT invent new
patterns. The full spec is in `planner-manager-handoff/README.md`; the design source of truth is
`planner-manager-handoff/mockups/AgencyTrack Planner — Manager Surfaces.html` (open it — it opens
with the personal planner 0A–0C, then the coaching tier 1–6; mobile + desktop, light + dark, with
states). Exact UI/tone live in the `planner-manager-*.jsx` files; start with
`planner-manager-personal.jsx` (streams + recruiting) and `planner-manager-shared.jsx` (coaching).

⛔ FOUR LOCKED TRUST CONSTRAINTS — design AND build around them; enforce at the data/query/rules
layer, not just the UI:
  1. The per-agent STALLED-PIPELINE RATIO is AGGREGATE ONLY. Show ratio + trend. NEVER expose or
     render the individual stalled prospects behind it. The chip always carries a privacy marker.
  2. That ratio / any individual data NEVER appears on a kiosk, leaderboard, TV, or any public
     surface — private manager↔agent only. Public ranking ranks reconciled production, not this.
  3. A manager sees a NAMED prospect ONLY via an agent's explicit ESCALATION (opt-in, reversible).
  4. Tone is COACHING ("help this agent win"), never surveillance. Soft weeks are opportunities to
     coach, not failures to flag.
If a request conflicts with any of these, stop and flag it — don't build it.

Before writing code:
1. Read `CLAUDE.md`, `APP_MANUAL.md`, `src/index.css`, and the existing manager dashboard
   (`dashboard/ManagerDashboard.jsx`) + `manager/JointCallsTab.jsx` (reuse the joint-call flow).
2. Read `planner-manager-handoff/README.md` end to end (esp. §2 constraints, §6 data model + rules).
3. Confirm the agent tier's `appointments` / `prospects` model exists; these screens read aggregates
   over it.

Rules:
- Build in the repo's conventions. Reuse the SAME tokens and primitives as the agent tier — map
  every raw hex/px to an existing token; never add a color. Reuse RoleSwitcher current="manager",
  Topbar, Scorecard, Pill, Eyebrow, AmbientBg, and the planner primitives (actStyle, ActChip,
  CounterBar, DayStripCell). These render as NEW TABS inside the existing Manager dashboard / Shell.
- Mobile manager nav: Team · Coaching · [Schedule FAB] · Escalations · More.
- Data via a new `plannerManagerService.js` over Firestore (README §6). Stalled ratio is a computed
  AGGREGATE field (`pipelineStats`) — the per-prospect set is never in a manager-readable doc.
  Escalations are first-class, agent-initiated, reversible. Branch events fan out FREE-block
  appointments onto agents' agendas.
- WRITE THE FIRESTORE SECURITY RULES as part of this work — constraints #1–#3 must be impossible to
  violate via the API, not just hidden in the UI.
- Every screen needs loading / empty / error states, in both light and dark, meeting the CI a11y gate.

Build order (verify each in light + dark before moving on; run lint, tests, axe checks):
0. Personal planner for selling managers — REUSE the agent planner components for a manager user,
   then add: (a) a `stream` (sell/coach/recruit) tag on every block + a time-split readout on My Day;
   (b) the recruiting activity types (RC/RI/RSEM/1:1/UNIT) on the extended type map; (c) My Week with
   dual sell + recruit minimums; (d) My Recruiting — career funnel + candidate worklist over a new
   `recruits` model. Don't reimplement the timeline/week-booking — extend the agent ones.
1. plannerManagerService.js + pipelineStats (aggregate) + escalation model + recruits model + rules.
2. Team overview — roster (booked-vs-min, kept-rate spark, AGGREGATE stalled chip), soft-week
   coaching prompts. Loading + error states.
3. ⭐ 1-on-1 coaching pack — auto-assembled per-agent agenda: planned-vs-actual, kept trend,
   aggregate stalled ratio WITH the "aggregate only, names stay private" explainer, the agent's
   escalations, wins to open with, conversation outline. Make it feel like a gift to the manager.
4. ⭐ Escalation inbox — opt-in named prospects only; ask = advice / joint-CI / take-call; actions
   reuse the joint-call flow; reversible; empty state. The only surface with named prospects.
5. Team capacity + joint-call scheduling — manager's week + team load bars (redistribute).
6. Branch events (BM) — schedule event → fan out onto agendas. Secondary.
7. Branch booking health (BM) — private unit-comparison roll-up; NOT the public leaderboard
   component. Secondary.

The ⭐ flows (coaching pack + escalation inbox) get the most polish and are where the trust
constraints matter most — make the stalled ratio unmistakably aggregate, and named prospects
unmistakably opt-in.

Branch per screen, small PRs, mirror the repo's commit style. Match the mockup, then commit. Ask
before adding any screen, field, or data the spec doesn't call for — especially anything that would
surface individual pipeline detail to a manager.
```

---

### Notes for the human driver
- The `planner-manager-*.jsx` files are **design reference, not production code** — recreate in the repo's React/Tailwind, lifting exact tokens/spacing/tone.
- `planner-manager-shared.jsx` is the key read: `StalledRatio` encodes constraint #1 (aggregate + privacy marker); `ESCALATIONS` shows the opt-in named-prospect shape; `TEAM` is the per-agent aggregate shape (basis for `pipelineStats`).
- This pairs with `planner-scheduler-handoff/` (agent tier). The agent side needs an **"escalate / ask manager for help"** affordance (on the Prep card or churn flow) that writes the escalation this inbox reads — note it when building the agent tier if it isn't there yet.
- **The Firestore security rules are the real enforcement** of the trust constraints. Treat a manager-readable query that could return an agent's individual stalled prospects as a bug, not a UI detail.
