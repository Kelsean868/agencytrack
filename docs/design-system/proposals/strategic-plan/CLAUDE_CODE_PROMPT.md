# Claude Code kickoff — AgencyTrack Strategic Plan (Branch Manager)

Build the **Strategic Plan** surface described in `stratplan-handoff/README.md` into this repo. The `mockups/` folder is the visual source of truth — open `mockups/AgencyTrack Strategic Plan v2.html` in a browser to see all four artboards (dashboard light/dark + two presentation slides).

## Ground rules

- **Read `stratplan-handoff/README.md` first** — it maps every section to existing repo services, libs and idioms. Reuse, don't fork: `src/lib/teamRoster.js` for tracker rows, `src/services/recruitingService.js` + `src/components/manager/recruitingVisuals.jsx` for the pipeline, `useBranchOverview.js` as the hook template, the MeetingMode early-return pattern for Presentation mode, the `generateBranchPDF` pattern for Export PDF.
- **No new Firestore collections.** Read-only aggregation over existing data. The only possible schema touch is an optional `manpower` field on the branch goals doc (README §7.2) — propose it in the PR rather than inventing it silently.
- **Tokens only.** Every color/space/radius maps to an existing `src/index.css` Nexus token or Tailwind class. Light + dark for the dashboard, dark-only presentation. No gradient buttons, no emoji, 44px minimum touch targets, `prefers-reduced-motion` gated animation.
- **States:** every section ships loading (PanelSkeleton), empty, and error (+ Retry) states per the repo idiom.
- Explicit `import React` in anything a test mounts (vitest banked rule). Tests for: banding math, proration/run-rate derivations, granularity toggle row-switching, presentation keyboard nav, focus-return on exit.

## Build in this order (one PR per slice)

1. Nav entry (`ManagerDashboard.jsx` NAV_ITEMS + `navConfig.js` producingManager) + `StrategicPlanTab` shell + `useStrategicPlan` hook + control bar + Cover hero
2. §02 Agent Performance Tracker
3. §03 Production Summary + §04 Period Metrics (QUARTER/HALF)
4. §05 Org Structure + §06 Recruitment Pipeline
5. Presentation mode (full-screen early return, agenda rail, ←/→/ESC, focus-return)
6. Export PDF (`StrategicPlanDocument` via dynamic `@react-pdf/renderer`)

Start with slice 1. Before writing code, restate the file plan and flag any repo drift from the README's assumptions (it was reconciled against `main@cc9c339`, 17 Jul 2026).
