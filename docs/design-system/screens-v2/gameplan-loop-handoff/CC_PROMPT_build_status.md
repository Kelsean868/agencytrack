# CC prompt — regenerate the Game Plan Loop build-status list

Paste this into Claude Code inside the `Kelsean868/agencytrack` repo. It re-derives the same
status list from the live source, so it stays accurate as the repo changes.

---

```
Scan this repo and produce a build-status list for the "Game Plan Loop" — the cycle that turns an
agent's life goal into daily activity and feeds results back. I want to know, per loop stage, what
is BUILT, what is GATED/stubbed, and what is NOT BUILT, so I know which tab to work on next.

The loop stages (and the tab IDs they route on) are:
  ① Money Needs + Allocator      → tabId 'money-needs'
  ① Goals hub                    → tabId 'goals'
  ③ Game Plan hub (commit)       → tabId 'game-plan'
  ④ Playground / On-Track engine → tabId 'commission' (+ GamePlanV2 SuggestedWeekCard)
  ⑤ Planner & Scheduler          → tabId 'planner'
  ⑤ Manager personal planner     → tabId 'planner' (producingManager nav)
  ⑤ Campaigns / Hit-list         → tabId 'campaigns'
  ⑤ Prospect Prep                → tabId 'prospect-info'
  ⑥ Daily Capture                → action 'log-today' / daily/
  ⑦ Policy Ledger                → tabId 'policy-ledger'
  ⑧ Persistency                  → tabId 'persistency'
  ⑧ Awards                       → tabId 'awards'

Method — read these to ground every verdict (do not guess from memory):
1. src/components/shell/navConfig.js — the per-role nav (AGENT_NAV, PRODUCING_MANAGER_NAV). Tells
   you which tab IDs exist and their labels.
2. src/config/comingSoonTabs.js — the COMING_SOON_TABS set. Any tab here is a GATED stub (visible
   in the sidebar but disabled, no real render case).
3. The dashboard render-switch that maps activeTab → component (AgentDashboard.jsx,
   ManagerDashboard.jsx). A tab with a real component case = BUILT; a tab rendering
   <ComingSoonPanel> = GATED; a tab with no case = NOT BUILT.
4. The component directories that back each stage (e.g. src/components/agent/,
   dashboard/GamePlanV2/, goals/CommissionPlayground/, daily/, campaigns/, persistency/, awards/).

For each stage output: STATUS (✅ built & live / 🟡 gated or needs rewire / 🔴 not built), the
backing component file(s) or "none", the tab ID, and the specific next action (e.g. "remove from
COMING_SOON_TABS + restore import + swap ComingSoonPanel for the real component"). Sort 🔴 first,
then 🟡, then 🟢/✅. End with a one-line "work on this tab next" recommendation.

Do not change any code — this is a read-only audit. Just produce the list.
```

---

### Why this works
The list is derived from three source-of-truth files (`navConfig.js`, `comingSoonTabs.js`, and the dashboard render-switch), so re-running it after any PR gives a current picture without you tracking it by hand. A tab in `COMING_SOON_TABS` is gated; a tab with no render case is unbuilt; everything else is live.
