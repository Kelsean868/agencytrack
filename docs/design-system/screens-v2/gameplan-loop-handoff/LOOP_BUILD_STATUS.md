# AgencyTrack — Game Plan Loop · build status (memory)

> Drop this in your repo as `CLAUDE.md` (or paste into Claude's project memory). It tells Claude/CC
> the current state of the Game Plan loop redesign so it always knows what's left. Re-derive anytime
> with the prompt in `CC_PROMPT_build_status.md` (reads navConfig.js + comingSoonTabs.js + the
> dashboard render-switch). Last scanned: `main`, June 2026.

## The loop (one number chain)
Life budget → required first-year commission → API targets → apps (`API ÷ avgPolicySize`, defined
once) → weekly activity (P.C / A.I / F.F.I / C.I) → booked appts → logged activity →
Written→Submitted→Settled policies → settled **Life** API → award tier → re-solve. Never let two
surfaces compute the same step with different math. **Only Life API drives awards.** Navigation is
tab-state (`onOpenTab` / `setActiveTab`), **not a router**.

## Status by stage

### 🔴 Not built — net-new (do first)
- **Planner & Scheduler (agent)** — tab `'planner'` is in `COMING_SOON_TABS`; **no component, no
  render case**. Book the week from the On-Track prescription + hit-list (activity-coded events,
  day/week mobile, desktop week-booking). Reads `weeklyTargets` + `hitList`; writes `plannerEvents`.
- **Manager personal planner** — same `'planner'` tab in `PRODUCING_MANAGER_NAV`; adds manager event
  types **1-on-1, unit meeting, joint work, training** + team layer. Ships with the agent Planner.
  - **To build:** remove `'planner'` from `comingSoonTabs.js` → build the surface → add the
    activeTab render case in AgentDashboard (and the producing-manager dashboard).

### 🟡 Built but gated / needs rewire
- **Prospect Prep** — tab `'prospect-info'`. `ProspectInfoPanel.jsx` (24KB) **exists** but is gated
  coming-soon. Un-gate (remove from `COMING_SOON_TABS`, restore import, swap `<ComingSoonPanel>`),
  then align to the hit-list → book → sale-log flow.
- **On-Track time-aware re-solve** — decomposition lives in `GamePlanV2/SuggestedWeekCard.jsx` +
  `goals/CommissionPlayground/`. Confirm targets re-solve as weeksLeft shrinks and settled
  production lands; promote to a standalone engine view only if intended. Likely enhancement.

### 🟢 Built — verify against final design (not net-new)
- **Money Needs + Allocator** (tab `money-needs`) — merged allocator **shipped** (#738; see
  `MoneyNeedsPanel.merged.test.jsx`). Verify: license-aware lines (show-not-grey), A&H as its own
  line, ≤4 user-named products (Life + General), 3-level worksheet disclosure, car split **33/67**,
  Send → confirm → ack → `onOpenTab('game-plan')`. Files: `agent/MoneyNeedsPanel.jsx`,
  `agent/MoneyNeedsAllocator.jsx`, `CommissionAnchorStrip.jsx`, `AwardProjectionStrip.jsx`.
- **Game Plan hub** (tab `game-plan`) — `dashboard/GamePlanV2/` built through Slice 3b. Verify it's
  the landing tab for the allocator's Send, pre-filled.
- **Campaigns + Hit-list** (tab `campaigns`) — `campaigns/CampaignPanel.jsx` built (manager + agent
  seeding). Verify the hit-list tie-in: targeted call list whose close flows into the Policy Ledger;
  agent-seeded vs manager-seeded share one model.

### ✅ Built & live — done
- **Daily Capture** — `daily/DailyCaptureV2.jsx`, `DailyEntryModal`, `DailyFAB`.
- **Policy Ledger** (tab `policy-ledger`) — `agent/PolicyLedgerPanel.jsx`, `policyLedger/{PipelineStrip,PolicyCard,PolicyDrillDrawer}`. Written→Submitted→Settled, multi-application.
- **Persistency** (tab `persistency`) — `agent/PersistencyTab.jsx`, `persistency/PersistencyPlayground.jsx`, `manager/Pers*`.
- **Awards** (tab `awards`) — `awards/AgentAwardsPanel.jsx`, `awardPrimitives.jsx`, `agent/AwardProjectionStrip.jsx`. Life-only tiers.
- **Goals hub** (tab `goals`) — `goals/{GapAnalysisPanel,DerivedIncomePanel,AwardsReachPanel,MdrtTracker,RecommendLockDrawer}`.
- **Commission Playground** (tab `commission`) — `goals/CommissionPlayground/` (GoalDecompositionTab, `commissionMath.js`).

## Bottom line
The only truly unbuilt screen is the **Planner & Scheduler** (agent + manager) — one gated
`'planner'` tab with no component. Then un-gate **Prospect Prep**. Everything else is built; the rest
is verifying shipped surfaces match the final design. **Work on `'planner'` first.**

## Design references (in `gameplan-loop-handoff/`)
`Build Status Tracker.html` (this, visual) · `LOOP_SPEC.md` (data model + contracts) ·
`Loop Map.html` (cycle diagram) · `mockups/AgencyTrack Planner & Scheduler v2.html` +
`AgencyTrack Planner - Manager Surfaces.html` (the Planner designs) ·
`mockups/AgencyTrack Loop Prototype.html` (interactive whole-loop walkthrough).
