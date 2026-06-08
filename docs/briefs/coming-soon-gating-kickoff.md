# Coming-Soon Tab Gating — Kickoff Brief

**Date:** 2026-06-07  
**Priority:** 1b (overnight order — pilot readiness)  
**Size:** S  
**Branch:** `feat/coming-soon-gating`  
**Merge gate:** HOLD — operator confirms exact gated set at morning review  
**Auto-merge:** NO — human merge required

## Problem

Several nav tabs in AgentDashboard and ManagerDashboard surface features that are not ready for the Tatil pilot. They are currently reachable via the sidebar and via internal CTAs (GamePlanV2 buttons). Real users will see empty/broken panels on Day 1.

## Decisions locked

1. **Gated tabs (exact set — operator confirms at morning review):**
   - Agent: `money-needs` (Money Needs), `goals` (Goals), `prospect-info` (Prospect Prep)
   - Manager: `goals` (Goals)

2. **Treatment:** tabs remain VISIBLE in the sidebar but are DISABLED (pointer-events-none, muted styling) and display a "Coming soon" inline badge. A `<ComingSoonPanel>` placeholder renders when the tab is active.

3. **Single config constant:** `src/config/comingSoonTabs.js` exports `COMING_SOON_TABS` (agent) and `MANAGER_COMING_SOON_TABS` (manager) as `Set<string>`. All gating logic reads from this constant — one place to flip a tab back on.

4. **Internal CTAs:** GamePlanV2 StepRail (`onOpenMoneyNeeds`) and CommitPreviewCard/onBuildPlan (`onOpenGoals`) may still call `setActiveTab`. They will navigate to the tab, which renders `<ComingSoonPanel>`. No changes to GamePlanV2 internals — directs only the tab render path.

5. **Must NOT touch:** CareerPortal tab, Game Plan tab, wizard Step 9 goal flows, wizard WizardForm.jsx.

6. **Nexus tokens, both themes:** `ComingSoonPanel` uses `bg-card`, `text-ink-muted`, `text-ink` — no hardcoded colors. Sidebar disabled state uses `text-ink-muted` + `opacity-60`. No inline styles.

7. **Direct access blocked:** When `activeTab` is in the gated set, `ComingSoonPanel` renders unconditionally — even if a CTA sets the tab programmatically. The real panel component is never mounted.

## Files touched

| File | Change |
|------|--------|
| `src/config/comingSoonTabs.js` | NEW — config constant |
| `src/components/ui/ComingSoonPanel.jsx` | NEW — placeholder component |
| `src/components/shell/Sidebar.jsx` | Disabled + badge treatment for gated items |
| `src/components/dashboard/AgentDashboard.jsx` | Replace `money-needs`, `goals`, `prospect-info` tab renders with `<ComingSoonPanel>` |
| `src/components/dashboard/ManagerDashboard.jsx` | Replace `goals` tab render with `<ComingSoonPanel>` |

## Full surface inventory — gated CTAs

| Location | Prop/handler | Destination | Treatment |
|----------|-------------|-------------|-----------|
| `GamePlanV2/StepRail.jsx` | `onOpenMoneyNeeds` click | `money-needs` tab | Navigates → ComingSoonPanel |
| `GamePlanV2/CommitPreviewCard.jsx:42` | `onOpenGoals` click | `goals` tab | Navigates → ComingSoonPanel |
| `GamePlanV2/index.jsx:244` | `onBuildPlan={openGoals}` | `goals` tab | Navigates → ComingSoonPanel |
| Sidebar nav item | `agent-tab-money-needs` | `money-needs` | Disabled + badge |
| Sidebar nav item | `agent-tab-goals` | `goals` | Disabled + badge |
| Sidebar nav item | `agent-tab-prospect-info` | `prospect-info` | Disabled + badge |
| Sidebar nav item | `nav-goals` (manager) | `goals` | Disabled + badge |
| PulseStrip chips | `handleChipClick` | NOT mapped to any gated tab (chips: awards, persist, streak, activity) | No change |

## Acceptance criteria

1. `npm run lint && npm test && npm run build` pass
2. Gated sidebar items: visible, muted style, "Coming soon" chip, not clickable
3. Direct `setActiveTab('money-needs' | 'goals' | 'prospect-info')` → `ComingSoonPanel` renders; real panel component not mounted
4. GamePlanV2 StepRail + CommitPreviewCard CTAs navigate to coming-soon state, no JS errors
5. CareerPortal, Game Plan, and all wizard surfaces unaffected
6. Both light and dark themes render correctly (no hardcoded colors)
7. PR description lists every gated surface explicitly

## Phase 1 verification commands

```bash
# Config constant exists
git ls-files src/config/comingSoonTabs.js

# ComingSoonPanel exists
git ls-files src/components/ui/ComingSoonPanel.jsx

# No 'goals' real component still mounted (confirm GapAnalysisPanel + GoalsPanel gated)
grep -n "GapAnalysisPanel\|GoalsPanel\|MoneyNeedsPanel\|ProspectInfoPanel" src/components/dashboard/AgentDashboard.jsx src/components/dashboard/ManagerDashboard.jsx

# CareerPortal + Game Plan untouched
grep -c "career\|game-plan" src/components/dashboard/AgentDashboard.jsx
```

## Methodology reminders

- STOP and wait for dispatcher on any scope expansion beyond the 5 files above
- No smoke required (operator confirms at morning review; internal refactor with no external-service writes)
- Rule 20: include HEAD SHA in PR-ready report
