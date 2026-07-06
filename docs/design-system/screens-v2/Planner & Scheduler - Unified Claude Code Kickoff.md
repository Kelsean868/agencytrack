# Claude Code — kickoff: AgencyTrack Planner &amp; Scheduler (Agent + Manager, one build)

Paste the fenced block below into Claude Code with **both** handoff folders available in / alongside the `Kelsean868/agencytrack` repo:

- `planner-scheduler-handoff/` — agent tier (spec `README.md`, mockup `mockups/AgencyTrack Planner & Scheduler v2.html`)
- `planner-manager-handoff/` — manager tier (spec `README.md`, mockup `mockups/AgencyTrack Planner — Manager Surfaces.html`)

It assumes the repo is open so Claude Code can read `CLAUDE.md`, `APP_MANUAL.md`, `docs/CONTEXT.md`, and `src/index.css`.

---

```
You are building ONE new feature into this existing repo, in two sequenced tiers: an **Agent
Planner & Scheduler** and its **Manager tier**. It is an ACTIVITY MANAGER, not a CRM — if a flow
is slower than paper, it has failed. Both tiers are the SAME product on the SAME Nexus design
system; the manager tier reuses the agent components, parameterized — never forked.

SPECS (read fully before coding):
- Agent:   planner-scheduler-handoff/README.md   + mockups/AgencyTrack Planner & Scheduler v2.html
- Manager: planner-manager-handoff/README.md     + mockups/AgencyTrack Planner — Manager Surfaces.html
The exact UI/spacing/tone lives in each folder's planner-*.jsx files — START with each tier's
*-shared.jsx (actStyle/STATUS/sample-data for the agent; StalledRatio/ESCALATIONS/TEAM for the
manager). Those .jsx files are DESIGN REFERENCE, not production code — recreate in the repo's
React/Tailwind, lifting exact tokens/spacing/tone. Do not import them.

BEFORE WRITING CODE
1. Read CLAUDE.md, APP_MANUAL.md, docs/CONTEXT.md, src/index.css so you internalize the Nexus
   tokens, the Shell, the services layer, and the CI a11y gate.
2. Confirm the surfaces this feature REUSES (do not fork or duplicate):
   - Prospect store — src/components/agent/ProspectInfoPanel.jsx (+ its service). Extend it; the
     planner references prospects, it does not build a parallel prospect store.
   - Daily Capture → Weekly Report path — src/components/daily/DailyEntryModal.jsx /
     DailyCaptureV2.jsx and src/utils/extractFields.js. The evening handoff is a CONFIRM over a
     pre-fill that lands in this existing schema — not a new report write path.
   - Shell + nav — src/components/shell/Shell.jsx and src/components/shell/navConfig.js. The
     `planner` tab already EXISTS in navConfig (agent AND producingManager configs) but is gated
     coming-soon via COMING_SOON_TABS. UN-GATE it and build behind it; add manager tabs to
     dashboard/ManagerDashboard.jsx. Routing stays the role switch in src/App.jsx — no router lib.

RULES (repo conventions — non-negotiable)
- Map every raw hex/px in the mockups to an existing token (agent README §4). NEVER introduce a
  new color. Tailwind + @layer components utilities (.card/.btn-primary/.input/.shell/.bottom-nav)
  first; bespoke classes only when needed. Every screen works in light AND dark via tokens, and
  meets the a11y gate: semantic timeline (<ol>/<li>), labelled controls, 44px targets,
  focus-visible rings, prefers-reduced-motion guards.
- Data lives in Firestore under tenants/{tenantId}/… via services (src/services/plannerService.js,
  then plannerManagerService.js) — never query Firestore from components; always pass tenantId.
  OFFLINE-FIRST (Firestore persistence + an "N changes waiting to sync" state). Cancelled/postponed
  appointments are RETAINED, never deleted. Day/week windows are AST (America/Port_of_Spain),
  matching the Sunday-anchored WAR week.
- Every panel needs loading / empty / error states (the mockups draw them).
- Reuse before rebuild. The manager personal planner is the agent timeline + week-booking with a
  `stream` prop, NOT a reimplementation.

MANAGER-TIER TRUST CONSTRAINTS — enforce at the DATA / QUERY / SECURITY-RULES layer, not just UI
(these are locked product decisions; a violating request is out of scope until product reopens it):
  1. Per-agent stalled-pipeline ratio is AGGREGATE ONLY — number + trend, never a drill-down of
     named prospects. It carries an "AGG · PRIVATE" marker. The pipelineStats doc must NOT contain
     the per-prospect stalled set; a manager query that could return it must be IMPOSSIBLE.
  2. That ratio / anything individual is PRIVATE manager↔agent — never on a kiosk/leaderboard/TV.
  3. A manager sees a NAMED prospect ONLY via an agent's explicit, reversible escalation.
  4. Tone is coaching ("help this agent win"), not surveillance.

HUMAN-MERGE + DEPLOY GATES (project policy — do NOT self-merge these):
- firestore.rules (planner appointments/escalations/pipelineStats/branch-events arms; the §1
  aggregate-only + branch/unit scoping) — human-merge + `firebase deploy --only firestore:rules`.
- The pipelineStats aggregation Cloud Function (functions/) — human-merge + `firebase deploy
  --only functions`.
- All React/Tailwind ships on the normal Vercel PR path.
STOP and hand off at the PR for any rules/functions change; surface, don't deploy.

BUILD ORDER — one screen per branch (feat/planner-*), small PRs; verify each in light + dark and
run lint + tests + Playwright/axe before moving on. Match the mockup, then commit.

TIER 1 — AGENT (build first; it owns the shared data the manager reads)
  1. plannerService.js + appointment/prospect/follow-up shapes (agent README §8). Un-gate the
     `planner` nav item; agent mobile bottom nav = Today · Week · [Book FAB] · Follow-ups · More.
  2. Today (home) — timeline + NOW marker + follow-ups-due strip + quick-add. Empty + offline.
  3. Day timeline — appointment cards + tappable empty gaps.
  4. ⭐ Week booking — forward day-strip (h-scroll, density; NOT a calendar grid) + 7-day list +
     weekly-minimum counter bars ("C.I 6/10"). Desktop = 7-column day board.
  5. ⭐ Add/edit — bottom sheet ↔ desktop dialog: prospect search OR free block; time/length/type;
     "Save & add another".
  6. ⭐ Status churn — Kept · Reschedule · Postpone · Cancel; retain cancelled/postponed.
  7. ⭐ Freed-slot fill — auto-prompt on cancel: due follow-up / ready-anytime / log P.C time.
  8. Follow-up worklist — batched; Book · Snooze · Re-qualify · Release.
  9. Prep card — history, objections, product interest; "Copy WhatsApp" = clipboard only, NEVER sends.
 10. ⭐ Plan → report handoff — end-of-day confirm over a pre-fill seeded from KEPT appointments,
     aggregated into the EXISTING Daily Capture / Weekly Report schema via extractFields. THE PAYOFF.
 11. Agent-side "escalate / ask manager" affordance (Prep card / churn) — writes an `escalation`.
     Required so the manager tier has data to read.

TIER 2 — MANAGER (reads Tier 1's appointments/prospects/escalations)
  A. Personal planner (selling managers) — REUSE the agent DayTimeline + WeekBooking with a
     `stream` prop (Sell=teal / Coach=gold / Recruit=violet) + StreamTag + time-split. Add the
     recruiting model (`recruits`), My Recruiting funnel (Contacted→Interviewed→Seminar→Selecting),
     dual minimums (sales floor + recruiting target), and the stream-aware Book-a-block sheet
     (Coach→1:1/unit/joint, Recruit→R.C/R.I/R.SEM, Block→training/seminar/tradeshow/personal).
     Two manager nav groups: My Planner (My Day/Week/Recruit) + Team Planner.
  B. ⭐ Team overview — roster booked-vs-min + kept-rate spark + AGGREGATE stalled ratio + soft-week
     nudge (opportunity-framed).
  C. ⭐ 1-on-1 coaching pack — auto-assembled per agent; planned-vs-actual, aggregate ratio + trend
     WITH the "aggregate only — names stay private" explainer, escalations raised, wins to open
     with, a conversation outline. Make it feel like a gift to the manager.
  D. ⭐ Escalation inbox — the ONLY named-prospect surface; agent · prospect · stall history ·
     logged objection · the ask (advice / joint-CI / take-call). Reuse manager/JointCallsTab for
     "schedule joint CI". Include the empty state.
  E. Capacity + joint-call scheduling; Branch events (fan-out FREE blocks); Branch booking health
     (private unit-compare, NEVER the public leaderboard component).
  F. pipelineStats Cloud Function + firestore.rules for the whole tier — HUMAN-MERGE + deploy;
     rules are part of the deliverable and encode constraints §1–§3.

The ⭐ flows (agent: phone-day booking / daily churn / plan→report handoff; manager: 1-on-1 pack /
escalation inbox) get the most polish. Ask me before adding ANY screen, field, or data the specs
don't call for. If the repo's prospect or report schema differs from a handoff README, the REPO wins
— adapt the planner to it.
```

---

### Notes for the human driver
- **Sequence is load-bearing:** the manager tier reads the agent tier's `appointments` / `prospects` and the `escalation` object, so Tier 1 (at minimum its data model + the escalate affordance) must land first.
- **The two things to watch in review:** (1) the evening handoff writes through the *existing* Daily Capture schema via `extractFields` — not a new report path; (2) the manager `pipelineStats` doc and its security rules must make the aggregate-only stalled ratio *impossible* to drill down, not merely un-rendered.
- **Repo-verified anchors:** the `planner` tab is already present but coming-soon-gated in `src/components/shell/navConfig.js` (agent + producingManager); routing is the role switch in `src/App.jsx`; manager surfaces are new `activeTab`s in `dashboard/ManagerDashboard.jsx`.
- Full combined spec (screen inventory, data model, component map, phased order) is in `AgencyTrack — Planner & Scheduler Build Handoff.html`.
