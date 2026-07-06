<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# AgencyTrack Technical Specification for Claude Code

## 1. Document Purpose

This technical spec translates the product/UX recommendations into an implementation-oriented document for Claude Code. It defines the app structure, routing, component responsibilities, data flow, theming, kiosk behavior, performance constraints, testing expectations, and delivery rules.

## 2. System Overview

AgencyTrack is a React + Tailwind insurance agency platform with role-based experiences for:

- Agent.
- Unit Manager.
- Branch Manager.
- Sales Manager.
- Tenant Admin.
- Platform Admin.

The system includes:

- Planning and goal-setting flows.
- Daily and weekly capture.
- Production reports.
- Dashboards.
- Awards and gamification.
- Admin and governance tools.
- Kiosk mode for TV displays.

The implementation must remain insurance-operations focused and avoid becoming a generic CRM.

## 3. Technical Goals

- Make light mode the default runtime theme.
- Keep dark mode supported but optional.
- Make kiosk mode visually engaging and stable on large displays.
- Keep large data tables performant.
- Keep planning tools structured and guided.
- Preserve clean boundaries between presentation, logic, and service layers.
- Prioritize accessibility, clarity, and operational efficiency.


## 4. Frontend Stack Assumptions

Assume:

- React for UI.
- Tailwind CSS for styling.
- Reusable shared components.
- Existing service modules for Firebase or similar data access.
- Existing role-aware routing and auth context.
- Existing charting and table patterns.

If not already present:

- Add react-query or a comparable cache layer for data-heavy surfaces.
- Add react-hook-form or an equivalent form system for large forms.
- Add table virtualization for dense tables.
- Add tokenized CSS variables for theme switching.


## 5. File and Folder Structure

Recommended high-level organization:

- `src/components/shared/`
- `src/components/layout/`
- `src/components/dashboard/`
- `src/components/goals/`
- `src/components/agent/`
- `src/components/manager/`
- `src/components/admin/`
- `src/components/kiosk/`
- `src/components/productionReport/`
- `src/components/gamification/`
- `src/components/persistency/`
- `src/components/campaigns/`
- `src/components/daily/`
- `src/components/profile/`
- `src/services/`
- `src/hooks/`
- `src/utils/`
- `src/theme/`
- `src/routes/`


## 6. Theme Architecture

### 6.1 Default theme

- Light mode is the default theme.
- Use CSS variables or theme tokens for all surfaces.
- The root should initialize to light unless a saved preference exists.


### 6.2 Dark mode

- Dark mode is enabled through a user-facing toggle.
- A repo/build flag should be able to disable dark mode entirely.
- If dark mode is disabled, hide the toggle and ignore saved dark preferences.


### 6.3 Token files

Recommended files:

- `src/theme/tokens-light.css`
- `src/theme/tokens-dark.css`
- `src/theme/index.ts` or equivalent token loader
- optional `design/tokens.json` for design handoff

Tokens should cover:

- background.
- surface.
- text.
- border.
- accent.
- status colors.
- shadows.
- chart palette.
- focus rings.


### 6.4 Theme switch behavior

- Persist user preference in profile and/or local storage.
- Respect system preference only on first load.
- Theme change should not trigger a full page reload.
- Keep transitions subtle.


## 7. Routing Architecture

### 7.1 Role-based routing

Create routes by role, not by arbitrary section.

Recommended route groups:

- Agent routes.
- Manager routes.
- Admin routes.
- Kiosk routes.
- Shared routes.


### 7.2 Route examples

- `/dashboard`
- `/planning`
- `/planning/money-needs`
- `/planning/year-plan`
- `/planning/monthly-plan`
- `/planning/self-improvement`
- `/goals/commission-playground`
- `/goals/persistency`
- `/production-report`
- `/kiosk`
- `/kiosk/manage`
- `/admin/users`
- `/admin/company-config`
- `/manager/settlements`
- `/manager/compliance`
- `/manager/awards`
- `/manager/team-wars`


### 7.3 Route guards

- Enforce role-based visibility and access.
- Protect kiosk management routes separately from kiosk display routes.
- Do not rely only on UI hiding; enforce access in route guards and service checks.


## 8. App Shell Specification

### 8.1 Desktop shell

- Left role-aware sidebar.
- Top bar with title, actions, sync/status, theme toggle, and user menu.
- Main content constrained with a max-width container for readability.


### 8.2 Mobile shell

- Bottom navigation for core surfaces.
- Floating action button for daily/report capture.
- Secondary navigation in drawer or profile menu.


### 8.3 Shell behavior

- Shell structure must be shared where possible.
- Only role-specific nav data should vary.
- Keep the shell stable across theme changes and route transitions.


## 9. Shared UI Components

### 9.1 Core primitives

Build or standardize these primitives:

- Button.
- IconButton.
- Card.
- StatCard.
- Badge.
- Pill.
- Tabs.
- Stepper.
- Modal.
- Drawer.
- ConfirmDialog.
- EmptyState.
- Skeleton.
- Table.
- TableToolbar.
- PageHeader.
- SectionHeader.


### 9.2 Standard patterns

- Buttons must have primary, secondary, destructive, and ghost variants.
- Cards should share spacing, radius, and shadow rules.
- Tables should share header style, zebra logic where needed, and sticky elements where needed.
- Modals should share focus trap, escape handling, and background blocking.
- Status badges should use consistent colors and labels across the app.


## 10. Planning Module Technical Spec

### 10.1 Money Needs module

#### Data model

- Expense groups.
- Expense line items.
- Steady income offsets.
- Annual totals.
- Commission gap.


#### Component breakdown

- `MoneyNeedsPage`
- `ExpenseGroupAccordion`
- `ExpenseLineItem`
- `MoneyNeedsSummaryCard`
- `CommissionGapCard`


#### Behavior

- Live recalculation on input.
- Currency formatting.
- Group collapse/expand state.
- Save draft and final save.


#### Technical notes

- Use form state management, not ad hoc local state for many inputs.
- Memoize derived totals.
- Keep formulas in utility functions.


### 10.2 Year Plan module

#### Data model

- Annual commission target.
- Product line allocations.
- API targets.
- Commission rates.
- Expected cases.
- Activity assumptions.


#### Components

- `YearPlanPage`
- `TargetAllocatorStrip`
- `LineTargetCard`
- `TargetSummarySidebar`
- `AnnualTargetLockButton`


#### Behavior

- Support line splits across Life, A\&H, Property, Motor.
- Allow distribution by percentage or direct target.
- Recompute downstream metrics immediately.


### 10.3 Monthly Plan module

#### Data model

- Month key.
- Monthly target.
- Actuals.
- Weekly breakdown.
- Notes.
- Suggested actions.


#### Components

- `MonthlyPlanPage`
- `MonthSelector`
- `MonthKpiStrip`
- `WeeklyProgressTable`
- `MonthlyNotesPanel`
- `SuggestionChips`


#### Behavior

- Month switching should preserve state.
- Suggestions should be computed from target-vs-actual variance.
- Allow linking from annual goals to monthly context.


### 10.4 Self-Improvement module

#### Data model

- Quarterly scores.
- Improvement notes.
- Category dimensions.
- History snapshots.


#### Components

- `SelfImprovementPage`
- `ScoreGrid`
- `ImprovementNoteEditor`
- `QuarterHistoryChart` or summary list


#### Behavior

- Support quarterly review flow.
- Preserve older quarter entries.
- Make progress visible over time.


## 11. Commission Playground Spec

### 11.1 Purpose

A scenario-building tool to explore commission mix and payout timing.

### 11.2 Required panels

- Inputs panel.
- Results panel.
- Cash-flow chart.
- Insight panel.


### 11.3 Technical rules

- Use pure math utilities for forward and reverse calculations.
- Support mode mix balancing.
- Keep charts deterministic and fast.
- Provide saved scenarios if the product already supports persistence.


### 11.4 Suggested utilities

- `commissionThisMonth`
- `reverseCalc`
- `modeBreakdown`
- `cashFlowForecast`
- `rebalanceMix`


## 12. Persistency Module Spec

### 12.1 Persistency tab

#### Components

- `PersistencyTab`
- `PersistencyTrendChart`
- `PersistencyMonthSelector`
- `PersistencyBigNumber`
- `PersistencyAwardBanner`


#### Behavior

- Support self-entry and manager-entered records.
- Respect existing data precedence rules.
- Show award thresholds and current standing.


### 12.2 Persistency playground

#### Components

- `PersistencyPlayground`
- `PersistencyLeverSlider`
- `PersistencyShortfallCard`
- `PersistencyProjectionChart`


#### Behavior

- Live what-if calculation.
- Return shortfall information per lever.
- Keep calculations isolated and testable.


## 13. Prospect Prep Spec

### 13.1 Scope

This is a joint-call prep and prospect information surface, not a CRM pipeline.

### 13.2 Components

- `ProspectInfoPanel`
- `PrepCard`
- `ProspectEditorForm`
- `ProspectReadOnlyCard`


### 13.3 Behavior

- Appointment-bound data.
- Structured fields where possible.
- Save and edit only where permitted.
- Keep manager access read-only where defined.


## 14. Daily Capture Spec

### 14.1 Components

- `DailyFAB`
- `DailyEntryModal`
- `DailyWizard`
- `ProgressiveFieldGroup`


### 14.2 Behavior

- Mobile-first.
- Fast entry.
- Strong validation.
- Minimal friction.


### 14.3 Technical notes

- Keep form logic isolated.
- Use field groups and progressive disclosure.
- Avoid loading the entire page for one capture action.


## 15. Dashboard Specs

### 15.1 Agent dashboard

Components:

- `ManagerHeroSection` equivalent for agent if needed.
- KPI cards.
- Recent activity feed.
- Goal cards.
- Awards summary.
- Badge grid.

Behavior:

- Show progress and next action prominently.
- Keep the dashboard compact and useful.


### 15.2 Manager dashboard

Components:

- `ManagerDashboard`
- `ManagerHeroSection`
- `ManagerOverviewTab`
- `BranchActivityFeed`
- `BranchKPIStrip`
- `TeamMedalsPanel`
- `GoalCarousel`

Behavior:

- Use role-aware dashboard layout.
- Use compact KPI visuals instead of giant circular gauges where possible.
- Make branch/team context visible without overwhelming the user.


### 15.3 Tenant admin dashboard

Components:

- `TenantAdminDashboard`
- `RoleDistributionCard`
- `BranchHealthCards`
- `CompanyConfigPanel`

Behavior:

- Real surfaces only.
- Avoid placeholder admin items.
- Keep governance screens safe and explicit.


## 16. Admin and Governance Spec

### 16.1 User management

Components:

- `UserManagementPanel`
- `CreateUserDrawer`
- `EditUserDrawer`
- `DeactivateConfirmDialog`
- `ReactivateConfirmDialog`
- `BulkImportUsersModal`

Behavior:

- Search, filter, and inline row actions.
- Role-based editing permissions.
- Explicit destructive action confirmation.
- Multi-step bulk import flow with preview and error handling.


### 16.2 Company config

Components:

- `CompanyConfigPanel`
- `EditConfigModal`

Behavior:

- No auto-save.
- Explicit save only.
- Read-before-write discipline.
- Clear error state on failed writes.
- Validate inputs before commit.


### 16.3 Branch admin

- Similar safety and confirmation patterns.
- Avoid destructive action ambiguity.
- Keep reversible actions distinct from irreversible ones.


## 17. Awards and Gamification Spec

### 17.1 Agent awards

Components:

- `AgentAwardsPanel`
- `AwardCard`
- `DataSourceBadge`
- `GapBadge`
- `PacePill`

Behavior:

- Show award state clearly.
- Use progress, criteria, and gap messaging.
- Keep visual feedback motivational and easy to scan.


### 17.2 Manager awards

Components:

- `ManagerAwardsPanel`
- `MonthlyBonusHero`
- `AwardMedal`
- `AwardMedalCard`

Behavior:

- Show performance, bonus tier, and award categories.
- Use a clean, premium layout.
- Maintain strong consistency with the shared badge and medal style system.


### 17.3 Weekly champions

- Highlight weekly top performers.
- Use clear ranking and celebratory treatment.
- Avoid cluttering the dashboard.


## 18. Production Report Spec

### 18.1 Components

- `ProductionReportTab`
- `TimePeriodToggle`
- `ProductionTable`
- `RankedLeaderboard`
- `DataSourceBadge`
- `AgentProductionView`
- `BranchManagerProductionView`
- `UnitManagerProductionView`


### 18.2 Behavior

- Support week, month, quarter, and year views.
- Keep table layout predictable and printable.
- Use highlight rows for current user or selected entity.
- Use accessible rank labels and badges.


### 18.3 Table rules

- Sticky headers where useful.
- Right-align currency and percentages.
- Use consistent row highlighting.
- Keep tables dense but readable.


## 19. Campaigns and Wars Spec

### 19.1 Campaigns

Components:

- `CampaignPanel`
- `CampaignCard`
- `CampaignForm`
- `ProgressTable`

Behavior:

- Create/edit in drawer or modal.
- Use validation before save.
- Support campaign targets, dates, prizes, and scope.


### 19.2 Team wars / leaderboards

Components:

- `TeamWarsTab`
- `WarSummaryRow`
- `Leaderboard` or equivalent rank components

Behavior:

- Fast scanability.
- Simple rank and progress presentation.
- Team context should be obvious.


## 20. Kiosk Technical Spec

### 20.1 Goals

- Make kiosk mode a visually engaging broadcast surface.
- Keep it stable, readable, and simple to recover.
- Use it to celebrate performance and increase office energy.


### 20.2 Kiosk shell

Components:

- `KioskShell`
- `FullscreenButton`
- `KioskRoute`
- `KioskModeTab`

Behavior:

- Display full-screen content without regular app chrome.
- Support token-based kiosk sessions.
- Auto-advance panels.
- Allow local fullscreen control.
- Poll or subscribe for updates.


### 20.3 Panel set

Components:

- `WelcomePanel`
- `AgentOfMonthPanel`
- `BranchOverviewPanel`
- `RunningTotalsPanel`
- `UnitLeaderboardPanel`
- `LastWeekRecapPanel`
- `YTDLeaderboardsPanel`
- `QTDLeaderboardsPanel`
- `MTDLeaderboardsPanel`
- `WeekLeaderboardsPanel`
- `WeeklyActivityPanel`
- `AwardsWatchPanel`
- `CompliancePanel`
- `TVRankedLeaderboard`
- `PeriodLeaderboardsPanel`


### 20.4 Rotation logic

- Each panel gets a configurable display duration.
- Default rotation should feel slow enough to read from a distance.
- Auto-advance should continue even if no interaction occurs.
- Panel changes should use crossfade or subtle transition.
- Reset page or substate when new data arrives if necessary.


### 20.5 Engagement features

Add the following:

- Count-up animations for totals.
- Rank-change animation.
- Celebration overlays for milestones.
- Gentle confetti for special events.
- Social ticker for brief messages.
- Daypart playlists.
- Spotlight cards for winners and announcements.
- Optional short media clips for especially important moments.


### 20.6 Kiosk data model

Recommended payloads:

- Playlist definition.
- Panel duration map.
- Top agent leaderboard.
- Branch overview metrics.
- Awards watch payload.
- Announcements payload.
- Highlight event payload.


### 20.7 Kiosk admin

Components:

- `KioskModeTab`
- management list
- create token
- revoke token
- copy token URL
- preview kiosk
- set playlist
- set dayparts
- mute sound
- set theme


### 20.8 Kiosk resilience

- Cache last known data.
- Resume after reload or power loss.
- Show offline fallback when necessary.
- Recover gracefully from polling failure.


## 21. Motion and Animation

### 21.1 General motion

- Use motion to support comprehension and celebration.
- Use opacity and transform for efficiency.
- Keep durations moderate.
- Avoid overly flashy effects.


### 21.2 Reduced motion

- Disable non-essential motion.
- Keep transitions functional and minimal.
- Respect system settings.


## 22. Accessibility Spec

- Maintain contrast in both themes.
- Use visible focus states.
- Use semantic buttons and landmarks.
- Keep tap targets large.
- Ensure keyboard navigation works across modals and drawers.
- Provide accessible labels for charts, badges, and kiosk items.
- Keep animation safe for users sensitive to motion.


## 23. Performance Spec

### 23.1 Tables

- Virtualize large tables.
- Avoid rendering thousands of nodes when only a small viewport is visible.


### 23.2 Forms

- Use form libraries for large forms.
- Avoid full re-render on every keystroke where possible.
- Separate expensive calculations from input state.


### 23.3 Charts and dashboards

- Memoize data transforms.
- Use skeletons while loading.
- Avoid needless global re-fetches.
- Use cached shared data for common dashboards.


### 23.4 Kiosk

- Preload the next panel.
- Keep media optimized.
- Degrade gracefully if a resource fails.


## 24. Services and Utility Layer

### 24.1 Recommended utility separation

- Pure math in `src/utils/`.
- UI state and layout in `src/components/`.
- Services in `src/services/`.
- Theme logic in `src/theme/`.
- Route definitions in `src/routes/`.


### 24.2 Example utility groups

- commission math.
- persistency math.
- goal and standard calculations.
- date and period helpers.
- formatting helpers.
- kiosk playlist helpers.


## 25. Data Flow Rules

- Shared dashboards may fetch shared entities once and pass them down.
- Large screens should prefer component-level fetching only where it improves parallel loading.
- Use caching for repeated data.
- Avoid redundant queries.
- Keep data derivation deterministic and testable.


## 26. Error Handling

- Preserve user input where possible on validation failure.
- Show readable error messages.
- Distinguish network errors from validation errors.
- Do not silently fail important writes.
- Use confirm dialogs for destructive operations and mid-flight cancel cases where needed.


## 27. Loading States

- Use skeletons for major surfaces.
- Use small inline loading indicators for localized waits.
- Avoid generic blank spinners on complex screens.
- Loading placeholders should mimic the eventual layout.


## 28. Testing Strategy

### 28.1 Unit tests

- Theme switching.
- Commission math.
- Persistency calculations.
- Target allocation.
- Kiosk rotation logic.
- Role visibility logic.


### 28.2 Component tests

- Modals.
- Drawers.
- Tables.
- Dashboard cards.
- Kiosk panels.
- Admin dialogs.


### 28.3 Integration tests

- Planning flow.
- Admin save flow.
- Kiosk token flow.
- Production report route behavior.
- Role-based routing.


### 28.4 Visual and accessibility checks

- Light/dark theme snapshots.
- Kiosk panel visuals.
- Contrast and focus behavior.
- Reduced-motion behavior.


## 29. Deployment and Rollout

### Phase 1

- Establish light-first theme tokens.
- Add optional dark mode support.
- Update shell and shared styling.


### Phase 2

- Build and connect planning surfaces.
- Implement Money Needs and Year Plan first.
- Add monthly and self-improvement flows.


### Phase 3

- Build kiosk redesign.
- Add playlist scheduling and celebration logic.
- Add kiosk admin management.


### Phase 4

- Harden performance.
- Run accessibility checks.
- Pilot with selected users.
- Refine based on feedback.


## 30. Acceptance Criteria

The implementation is complete only when:

- Light mode is the default runtime theme.
- Dark mode remains available but optional.
- Kiosk mode feels lively and deliberate.
- Planning flows are guided and connected.
- Large tables remain usable and fast.
- Admin actions are explicit and safe.
- Accessibility and motion requirements are met.
- Role-based routing is enforced.
- The app remains focused on insurance agency workflows.


## 31. Practical Implementation Checklist

- Add theme tokens and root theme switching.
- Add dark-mode feature flag.
- Update app shell and nav styling.
- Implement planning screens with shared forms and summary cards.
- Wire Money Needs to Year Plan.
- Implement monthly and quarterly tracking.
- Add persistency and commission tools.
- Refine dashboards and awards surfaces.
- Implement kiosk shell, panels, rotation, and admin controls.
- Add motion, accessibility, and performance tests.
- Update docs and release notes.


## 32. Final Instruction for Claude Code

Use this document as the authoritative technical implementation guide. Build the system around light-first UI, preserve dark mode as an option, and make kiosk mode feel exciting enough that agents actually watch it. Keep the product focused, testable, and fast.

