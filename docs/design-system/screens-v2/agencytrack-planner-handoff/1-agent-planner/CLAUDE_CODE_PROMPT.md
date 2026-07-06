# Claude Code — kickoff prompt: Agent Planner & Scheduler

Paste the block below into Claude Code with this `planner-scheduler-handoff/` folder available in (or alongside) the `Kelsean868/agencytrack` repo. It assumes you've already opened the repo so Claude Code can read `CLAUDE.md`, `APP_MANUAL.md`, and `src/index.css`.

---

```
You are adding ONE new agent feature to this existing repo: an **Agent Planner & Scheduler**
— a mobile-first day-planning + scheduling surface that digitizes Tatil Life's paper Weekly
Planner. It is an ACTIVITY MANAGER, not a CRM. The full spec is in
`planner-scheduler-handoff/README.md`; the design source of truth is
`planner-scheduler-handoff/mockups/AgencyTrack Planner & Scheduler v2.html` (open it — it's an
interactive board with mobile + desktop, light + dark, and empty/loading/error states for each
screen). The exact UI/spacing/tone logic is in the `planner-*.jsx` files in that folder,
starting with `planner-shared.jsx`.

Before writing code:
1. Read `CLAUDE.md`, `APP_MANUAL.md`, `docs/CONTEXT.md`, and `src/index.css` so you internalize
   the Nexus tokens, the Shell, the services layer, and the CI a11y gate.
2. Read `planner-scheduler-handoff/README.md` end to end. Confirm the existing prospect model
   (`agent/ProspectInfoPanel.jsx`) and the Daily Capture → Weekly Report path
   (`daily/DailyEntryModal.jsx`, `src/utils/extractFields.js`) — the planner reuses both, it
   does not fork them.

Rules:
- Build in the repo's conventions. Map every raw hex/px in the mockups to an existing token
  (§4 of the README). Never introduce a new color. Tailwind + `@layer components` utilities
  (`.card`, `.btn-primary`, `.input`, `.shell`, `.bottom-nav`) first; bespoke classes only when
  needed. Every screen must work in light AND dark via tokens, and meet the a11y gate
  (landmarks, labelled controls, 44px targets, focus-visible rings, prefers-reduced-motion).
- Data lives in Firestore under `tenants/{tenantId}/…` via a new `src/services/plannerService.js`
  (don't query Firestore from components). Reuse the existing prospect store. Offline-first with
  Firestore persistence. Cancelled/postponed appointments are RETAINED, never deleted.
- Every panel needs loading / empty / error states (the mockups draw them).

Nav & placement:
- Add a new top-level agent nav item "Planner" (badge NEW) inside the existing Shell. On mobile
  it has its own bottom nav: Today · Week · [Book FAB] · Follow-ups · More (center FAB = quick-add).
- Wire it as a new agent tab; do not fork the Shell.

Build order (one screen at a time, verify each in light + dark before moving on — run lint, tests,
and the Playwright/axe checks):
1. plannerService.js + the appointment/prospect/follow-up data shapes (README §8).
2. Today (home) — timeline + NOW marker + follow-ups-due strip + quick-add. Empty + offline states.
3. Day timeline — appointment cards + tappable empty gaps.
4. ⭐ Week booking — forward day-strip (h-scroll, density, NOT a calendar grid) + 7-day list +
   weekly-minimum counter bars ("C.I 6/10"). Desktop = 7-column day board.
5. ⭐ Add/edit appointment — bottom sheet (desktop dialog): prospect search OR free block, time,
   length, activity type, "Save & add another".
6. ⭐ Status churn — Kept · Reschedule · Postpone · Cancel; retain cancelled/postponed.
7. ⭐ Freed-slot fill — auto-prompt on cancel: due follow-up / ready-anytime waitlist / log P.C time.
8. Follow-up worklist — batched, Book · Snooze · Re-qualify · Release.
9. Prep card — history, objections, product interest; "Copy WhatsApp confirmation" (clipboard only,
   never sends).
10. ⭐ Plan → actual handoff — end-of-day confirm over a pre-fill seeded from kept appointments;
    aggregate into the EXISTING Daily Capture / Weekly Report schema via extractFields. This is the
    payoff — make it obvious and satisfying. Confirm → "Day logged" terminal state.

The three ⭐ flows (phone-day booking, daily churn, plan→report handoff) get the most polish — if a
flow is slower than paper, it has failed.

Branch per screen (e.g. `feat/planner-today`), small PRs, mirror the repo's commit style. Match the
mockup, then commit. Ask me before adding any screen, field, or data the spec doesn't call for.
```

---

### Notes for the human driver
- The mockup `.jsx` files are **design reference, not production code** — Claude Code should recreate the UI in the repo's React/Tailwind, lifting exact tokens/spacing/tone from them, not import them.
- `planner-shared.jsx` is the best starting read: `actStyle()` (type→color), `STATUS` (status→pill), and the `TODAY_APPTS` / `WEEK_*` / `FOLLOWUPS` consts (data shapes).
- If the repo's prospect or report schema differs from README §8, **the repo wins** — adapt the planner to it.
