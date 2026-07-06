<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# AgencyTrack Complete UX/UI Specification

## 1. Purpose

This document consolidates all recommendations made across this chat into one exhaustive, implementation-ready specification for Claude Code. It covers the full app shell, every major screen and surface, role-specific navigation, light-first design, optional dark mode, kiosk mode improvements, data-entry patterns, performance, accessibility, API contracts, and rollout guidance.

## 2. Product Direction

### 2.1 Core decisions

- Default theme: light mode.
- Dark mode: optional, toggleable, and controlled by a repo feature flag.
- Kiosk mode: redesigned to be lively, celebratory, and engaging.
- Scope: full UX/UI specification for planning, production, admin, reporting, awards, and kiosk surfaces.
- Product boundary: keep the app focused on insurance agency operations and planning, not a generic CRM.


### 2.2 Design goals

- Make the interface easier to scan in bright office environments.
- Keep complex data readable without overwhelming users.
- Turn planning into a guided experience instead of scattered forms.
- Make kiosk screens something agents actually want to watch.
- Preserve enterprise rigor: auditability, clarity, and speed.


## 3. Theme System

### 3.1 Light-first rule

- Light mode must be the default for all new installs and all standard user sessions.
- The app should open in light mode unless a saved user preference overrides it.
- Light mode should be the canonical look in screenshots, documentation, and marketing examples.
- The visual style should feel clean, modern, and premium rather than stark or flat.


### 3.2 Dark mode option

- Dark mode must remain available as an option.
- It should be exposed through a visible user toggle in the app shell.
- The repository should also include a feature flag or build-time switch for enabling/disabling dark mode support.
- If dark mode is disabled by flag, the toggle should be hidden and the app should remain light-only.


### 3.3 Theme token model

Use semantic CSS tokens rather than hard-coded colors.

Recommended tokens:

- `--bg`
- `--surface`
- `--surface-2`
- `--border`
- `--text-primary`
- `--text-secondary`
- `--text-muted`
- `--accent`
- `--accent-soft`
- `--success`
- `--warning`
- `--danger`
- `--info`
- `--shadow`

Light theme guidance:

- Backgrounds should be white or soft gray.
- Surfaces should be slightly tinted off-white.
- Text should be dark charcoal.
- Amber remains the brand/action color.

Dark theme guidance:

- Backgrounds should use deep slate or charcoal.
- Surfaces should be slightly lighter than the background.
- Text should be off-white or cool gray.
- Amber remains the brand/action color, but softened slightly so it does not glow too aggressively.


### 3.4 Theme behavior

- Save the user’s theme preference in profile settings.
- Respect `prefers-color-scheme` for first-time users.
- Provide a quick toggle in the top bar on desktop.
- On mobile, the toggle can live under the profile or “More” menu.
- Theme transitions should be subtle and avoid flashing or jarring changes.


## 4. Global Shell and Navigation

### 4.1 Desktop shell

- Use a left sidebar for role-aware navigation.
- Use a top bar for page title, sync indicators, theme toggle, and user actions.
- Constrain content width on wide displays to keep line length readable.
- Keep the shell stable and consistent across all roles.


### 4.2 Mobile shell

- Use a bottom navigation bar for the most important surfaces.
- Add a floating action button for primary capture actions such as daily entry or report submission.
- Move less-used surfaces into a “More” drawer or profile menu.
- Keep tap targets large enough for thumb use.


### 4.3 Navigation rules

- Agents should see planning, daily entry, production, performance, and tools.
- Managers should see dashboards, team tools, awards, production reports, settlement, compliance, and user-facing controls.
- Tenant admins should see user management, company configuration, branch admin, and audit-adjacent surfaces.
- Remove placeholder links or dead-end menu items.
- Every navigation item should lead to a real, useful surface.


## 5. Information Architecture

### 5.1 Primary surface groups

1. Planning.
2. Daily capture.
3. Production reporting.
4. Performance and goals.
5. Awards and recognition.
6. Admin and governance.
7. Kiosk and broadcast displays.

### 5.2 Product boundaries

- Do not drift into full CRM behavior.
- Prospect and policy surfaces should remain focused on preparation, tracking, and reporting.
- Any client-management behavior should remain minimal and purpose-built.
- Keep the product centered on insurance business outcomes.


## 6. Looking Ahead Planning System

### 6.1 Purpose

The “Looking Ahead” workbook should be translated into a guided annual planning experience inside the app. The app should help an agent work through:

1. Money needs.
2. Yearly activity and commission planning.
3. Monthly planning and tracking.
4. Self-improvement goals.
5. Business record keeping and review.

### 6.2 Wizard structure

Use a guided multi-step layout:

1. Money Needs.
2. Year Plan.
3. Monthly Plan.
4. Self-Improvement.
5. Review and Track.

Each step should:

- Explain the purpose of the step.
- Show the input fields that matter most.
- Update totals and downstream targets in real time.
- Allow saving progress and resuming later.


### 6.3 Wizard home

The wizard home should:

- Explain the full annual planning process.
- Show progress across the steps.
- Provide a large CTA to begin with Money Needs.
- Make clear that this is personal planning, not a CRM or client pipeline tool.


## 7. Money Needs Screen

### 7.1 Objective

This screen should help the agent determine how much income they need for the year and how much of that must come from commissions.

### 7.2 Layout

Use a two-column layout:

- Left: grouped expense sections.
- Right: sticky summary panel.


### 7.3 Expense groups

Recommended groups:

- Fixed household.
- Lifestyle and family.
- Business expenses.
- Savings and debt.
- Miscellaneous and contingency.

Each group should show:

- A monthly total.
- Expand/collapse behavior.
- Line items with labels and amounts.
- Clear currency formatting.


### 7.4 Summary panel

The sticky summary should show:

- Total monthly requirement.
- Total annual requirement.
- Any covered income or steady income.
- Commission gap remaining.


### 7.5 Behavior

- All totals must recalculate live.
- The summary should explain the path from expenses to commission target.
- Allow “send to year plan” or similar action to pass the target forward.
- Provide clear assumptions for commission rates and timing.


## 8. Year Plan Screen

### 8.1 Objective

This screen should translate the annual commission gap into line-of-business targets.

### 8.2 Product lines

Support the main insurance lines:

- Life.
- A\&H.
- Property.
- Motor.


### 8.3 Distribution model

For each line:

- Show commission target.
- Show API target.
- Show average commission rate.
- Show expected average case size.
- Show estimated cases needed.
- Show implied appointments or activity counts where useful.


### 8.4 Controls

- Allow the user to distribute commission targets across lines.
- Use sliders, percentage controls, or compact inputs for share allocation.
- Show projected versus modal commission timing if relevant.
- Explain how the total target is being split.


### 8.5 Completion behavior

- Allow the user to lock annual targets once configured.
- Persist the plan so it can drive monthly targets later.
- Surface whether each line has been configured.


## 9. Monthly Plan and Progress

### 9.1 Objective

This screen should connect annual targets to current monthly activity and progress.

### 9.2 Layout

Use:

- Month selector.
- KPI strip.
- Weekly breakdown or comparison table.
- Notes area.
- Suggestions panel.


### 9.3 KPI strip

Recommended cards:

- This month’s target.
- Actual achieved so far.
- Status label such as on track, slightly behind, or behind.


### 9.4 Weekly view

Show:

- Weekly target versus actual.
- Calls, interviews, appointments, applications, or other relevant activity.
- A compact progress view that can reuse weekly standard card styling.


### 9.5 Notes and guidance

- Provide space for the user to write a monthly plan.
- Suggest practical next steps based on where the user is lagging.
- Keep the suggestions concise and actionable.


## 10. Self-Improvement Screen

### 10.1 Objective

This screen should convert the workbook’s self-improvement section into a usable quarterly reflection and action-planning surface.

### 10.2 Scoring categories

Use categories such as:

- Personal effectiveness.
- Organization efficiency.
- Prospecting.
- Selling skills.
- Quality business.


### 10.3 Layout

- A scorecard or rating grid for quarterly self-assessment.
- A text area or notes area for improvement actions.
- A visible record of prior quarter ratings.


### 10.4 Behavior

- Encourage quarterly revisits rather than one-time completion.
- Show historical ratings so progress is visible over time.
- Keep language supportive, not punitive.


## 11. Record Keeping and Review

### 11.1 Purpose

Translate workbook-based record keeping into a lightweight digital record and review experience.

### 11.2 What to show

- Monthly summaries.
- Commissions paid.
- Expense summaries.
- Performance progression.
- Notes on what worked and what did not.


### 11.3 Behavior

- Make it easy to review progress without turning the app into accounting software.
- Keep the view summary-oriented.
- Allow export where appropriate.


## 12. Commission Playground

### 12.1 Purpose

This is an income-planning tool, not a client quoting tool.

### 12.2 Features

- Target input or pull-through from Year Plan.
- Mode mix controls.
- Cash-flow forecast.
- Insight box with recommendations.
- Saveable scenarios.


### 12.3 Behavior

- Show how different product and mode combinations affect commission timing.
- Make assumptions visible.
- Offer a clear way to apply the chosen scenario back into the plan.


## 13. Persistency Tools

### 13.1 Persistency tab

- Show current persistency value.
- Show trend over time.
- Allow self-entry when permitted.
- Lock or read-only view when a manager has already entered the same period.


### 13.2 Persistency playground

- Provide what-if scenarios.
- Show shortfall against target.
- Highlight levers that could improve persistency.
- Keep it simple and educational.


## 14. Prospect and Prep Tools

### 14.1 Prospect info panel

- Treat this as joint-call preparation.
- Keep it appointment-bound.
- Do not use it as a generic pipeline or CRM screen.
- Support structured inputs and clear saved notes.


### 14.2 Manager view

- Managers should be able to view in-scope content where appropriate.
- Managers should not be able to write into agent-authored prep data on read-only screens.
- The UI should clearly signal read-only versus editable states.


## 15. Daily and Weekly Capture

### 15.1 Purpose

Make daily and weekly entry fast enough that people actually use it.

### 15.2 UX rules

- Minimize typing where possible.
- Use clear labels and compact controls.
- Support mobile-first capture.
- Avoid burying the primary action.


### 15.3 Daily FAB

- Floating action button should remain visible on agent-facing screens when relevant.
- The button should sit above the bottom navigation safely.
- Use a visible reminder dot when the day has not yet been logged.


## 16. Dashboard System

### 16.1 Agent dashboard

- Show current goals.
- Show progress to today’s target.
- Show recent activity.
- Show badge or award movement.
- Show a clear next-best action.


### 16.2 Manager dashboard

- Show team summary.
- Show KPI strip.
- Show branch activity feed.
- Show awards and medals.
- Show the right amount of role-specific surface area without making the page feel crowded.


### 16.3 Tenant admin dashboard

- Show user distribution.
- Show branch health or status summary.
- Show configuration and governance surfaces.
- Remove dead placeholders and keep only real destinations.


## 17. Awards and Gamification

### 17.1 Agent awards

- Show badges, progress bars, and gap indicators.
- Make award state easy to understand at a glance.
- Use strong but restrained visual emphasis.


### 17.2 Manager awards

- Use medal cards and bonus-tier hero elements.
- Show award categories such as annual, activity, and recruiting.
- Make the reward status feel positive and motivating.


### 17.3 Champions banner

- Use for weekly recognition and high-visibility celebration.
- Keep the emphasis on visible ranking and achievement.


## 18. Campaigns and War Tools

- Campaign cards should show prize, dates, status, and progress.
- Campaign forms should support edit and create with clear validation.
- War or leadership tools should remain compact, scan-friendly, and easy to compare.
- Use confirmation dialogs for destructive actions.


## 19. User Management and Admin UX

- Include search, filters, and clear row actions.
- Show role-specific edit rules.
- Use explicit save confirmation for important config changes.
- Keep destructive actions guarded by confirmation dialogs.
- Preserve auditability in admin flows.


## 20. Company Config

- Keep configuration separate from reporting surfaces.
- Use a clear edit flow with a single save action.
- Do not auto-save critical company configuration.
- Validate before write and show clear errors if saving fails.
- Keep the screen organized and conservative.


## 21. Kiosk Mode Redesign

### 21.1 Objective

The kiosk should become one of the most exciting surfaces in the product, not a passive background screen. It should energize the office, celebrate performance, and create social momentum.

### 21.2 Design principles

- Big, readable, high-impact visuals.
- Enough motion to feel alive, but not so much that it becomes distracting.
- Must be readable from a distance.
- Must survive poor connectivity.
- Must resume cleanly after interruption or power loss.


### 21.3 Visual tone

- For kiosks, light mode should generally be the default because office TVs are often in bright spaces.
- Use bold typography, large counters, and prominent ranking movements.
- Highlight achievement moments with motion and celebration, but keep content polished.


### 21.4 Kiosk content types

Rotate through:

- Leaderboards.
- Agent of the Month.
- Branch overview.
- Running totals.
- Weekly recap.
- Monthly/quarterly/year-to-date leaderboards.
- Awards watch.
- Compliance status.
- Announcements.
- Champion or spotlight cards.


### 21.5 Kiosk engagement features

Add the following to make kiosk mode feel lively:

- Animated rank changes.
- Count-up number transitions.
- Celebration bursts on milestones.
- Social ticker for short congratulatory messages.
- Scheduled spotlight cards.
- Optional short clips or media overlays for winners.
- Daypart-based playlists, such as morning focus, mid-day momentum, and evening celebration.
- Periodic “hero moments” when an award is won or a goal is crossed.


### 21.6 Kiosk interaction model

- The kiosk is primarily passive.
- Admin or branch staff can trigger special events.
- The playlist should rotate automatically.
- Live events should override or insert themselves gracefully, then return to the schedule.


### 21.7 Kiosk resilience

- Cache the last good state.
- Show offline fallback when the network is down.
- Reconnect gracefully.
- Resume the last playlist after reboot.
- Use polling or push updates with safe fallback behavior.


## 22. Kiosk Screen Set

Recommended kiosk panels:

- Welcome panel.
- Agent of the Month panel.
- Branch overview panel.
- Running totals panel.
- Unit leaderboard panel.
- Last week recap panel.
- YTD leaderboard panel.
- QTD leaderboard panel.
- MTD leaderboard panel.
- Weekly activity panel.
- Awards watch panel.
- Compliance panel.

Each panel should:

- Be readable from a distance.
- Use strong typography hierarchy.
- Present one main idea.
- Avoid clutter.


## 23. Kiosk Motion and Animation

### 23.1 Motion rules

- Use opacity and transform, not layout-shifting properties.
- Keep transitions smooth and modest.
- Use motion to guide attention, not to decorate everything.
- Respect reduced-motion preferences.


### 23.2 Suggested transitions

- Crossfade between panels.
- Slide or rise for ranking changes.
- Count-up animation for numeric totals.
- Gentle pulse or glow for achievement moments.
- Confetti or particle celebration only for meaningful wins.


### 23.3 Reduced motion behavior

- Disable heavy animation when motion reduction is enabled.
- Keep transitions simple and subtle.
- Preserve readability and stability over excitement when necessary.


## 24. Kiosk Content Scheduling

### 24.1 Rotation

- Each panel should have a configurable duration.
- Default durations should feel long enough to be read from a distance.
- Allow branch-level overrides.


### 24.2 Dayparts

Support different playlists for:

- Morning.
- Midday.
- Afternoon or closing hours.


### 24.3 Priority rules

- Milestone wins can interrupt the standard rotation.
- Announcements can temporarily take precedence.
- Certain panels can be pinned or emphasized during special events.


## 25. Kiosk Admin and Management

### 25.1 Admin controls

- Create and revoke kiosk tokens.
- Set playlist and panel durations.
- Configure quiet hours or muted periods.
- Preview the kiosk.
- Set the theme.
- Manage media assets.


### 25.2 Security

- Kiosk tokens should be read-only.
- Tokens should be scoped to branch or location.
- Tokens should expire and be revocable.
- Do not expose sensitive admin functionality in the kiosk client.


## 26. Accessibility

### 26.1 General rules

- Maintain strong contrast in both light and dark themes.
- Use visible focus states.
- Support keyboard navigation.
- Provide clear labels and error text.
- Make tap targets large enough on mobile.


### 26.2 Kiosk accessibility

- Use legible font sizes.
- Avoid flashing content.
- Keep motion controlled.
- Support captions or alternative text for media where relevant.
- Respect reduced-motion settings.


## 27. Performance

### 27.1 General app performance

- Virtualize long tables.
- Memoize heavy calculations.
- Split large forms into logical chunks.
- Use skeleton states instead of blank spinners.
- Avoid unnecessary full-page re-renders.


### 27.2 Kiosk performance

- Preload the next panel before switching.
- Cache remote data where possible.
- Keep media optimized.
- Gracefully handle slow network conditions.
- Keep rotation logic stable over long runtime sessions.


## 28. Architecture Recommendations

### 28.1 Separation of concerns

- Keep math and calculation logic in pure utility modules.
- Keep UI components presentation-focused.
- Keep services focused on fetching and mutation.
- Avoid mixing business rules into presentation files.


### 28.2 State management

- Use component-level fetching where useful.
- Use cached data for shared dashboards.
- Use form helpers for large input screens.
- Avoid unnecessary global state.


### 28.3 Reusable patterns

- Use consistent card shells.
- Use consistent table styles.
- Use consistent modal patterns.
- Use consistent empty states and loading states.
- Use consistent status badges across the app.


## 29. Data and API Contracts

### 29.1 Planning data

Support data for:

- Money needs.
- Year plan allocations.
- Monthly progress.
- Persistency entries.
- Self-improvement ratings.
- Notes and review states.


### 29.2 Kiosk data

Support endpoints or payloads for:

- Playlist definition.
- Panel content.
- Top agents.
- Leaderboards.
- Awards watch.
- Announcements.
- Highlight events.


### 29.3 Response behavior

- Use lightweight payloads where possible.
- Prefer deltas for live changes.
- Make timestamps explicit.
- Keep payloads easy to cache and replay.


## 30. Component Inventory

### 30.1 Shared primitives

- Card.
- Stat card.
- Badge.
- Pill.
- Table.
- Modal.
- Drawer.
- Stepper.
- Tabs.
- Empty state.
- Skeleton loader.
- Confirm dialog.


### 30.2 Planning components

- Money needs group card.
- Annual target allocator.
- Monthly summary card.
- Activity standards card.
- Self-improvement grid.
- Commission scenario panel.
- Persistency playground panel.


### 30.3 Dashboard components

- Hero section.
- KPI strip.
- Activity feed.
- Branch activity feed.
- Goal donut or progress card.
- Team medals panel.
- Role distribution card.


### 30.4 Kiosk components

- Kiosk shell.
- Panel rotator.
- Welcome panel.
- Leaderboard panels.
- Champion panel.
- Awards watch panel.
- Announcement ticker.
- Branch overview panel.
- Compliance panel.
- Running totals panel.
- Fullscreen button.


## 31. Loading, Empty, and Error States

### 31.1 Loading

- Prefer skeletons over spinners for major data surfaces.
- Skeletons should resemble the final layout.
- Use spinners only for short localized waits.


### 31.2 Empty states

- Explain what the user can do next.
- Avoid guilt or vague messages.
- Keep actions clear and contextual.


### 31.3 Errors

- Surface actionable error messages.
- Keep destructive consequences clear in confirmation dialogs.
- Do not hide failed writes.
- Preserve user inputs on error where possible.


## 32. Visual Style Guidance

### 32.1 Light mode style

- Clean white background.
- Soft neutral cards.
- Amber accents.
- Clear shadows and borders.
- Strong but calm hierarchy.


### 32.2 Dark mode style

- Deep slate background.
- Elevated cards.
- Soft amber accents.
- High contrast text.
- Avoid oversaturated glow effects.


### 32.3 Typography

- Large, readable titles.
- Moderate body size.
- Compact but legible labels.
- Kiosk typography should be larger than regular app typography.


## 33. Interaction Rules

- Use explicit CTAs.
- Avoid ambiguous links.
- Keep destructive actions separated and confirmed.
- Make primary actions visually dominant.
- Preserve user context when moving between steps or tabs.


## 34. Testing Requirements

### 34.1 Functional tests

- Planning flow completion.
- Theme persistence.
- Kiosk rotation.
- Playlist override.
- Admin save flows.
- Role-based visibility.


### 34.2 Visual tests

- Light and dark theme variants.
- Large table states.
- Kiosk panel layouts.
- Mobile bottom nav.
- Card and modal consistency.


### 34.3 Accessibility tests

- Contrast.
- Keyboard navigation.
- Focus order.
- Reduced motion behavior.
- Label coverage.


## 35. Rollout Plan

### Phase 1

- Introduce light-first theme system.
- Add dark mode toggle and repository flag.
- Update shell and shared component tokens.


### Phase 2

- Build planning flows.
- Connect Money Needs to Year Plan.
- Add monthly planning and review surfaces.


### Phase 3

- Implement kiosk redesign.
- Add playlist rotation and engagement features.
- Introduce admin controls and preview mode.


### Phase 4

- Refine motion, performance, and metrics.
- Pilot with a limited group.
- Expand rollout after feedback.


## 36. Metrics to Track

### Planning

- Percentage of users completing Money Needs.
- Percentage of users configuring Year Plan.
- Revisit rate for Monthly Plan.
- Self-improvement engagement.


### Kiosk

- Time spent viewing kiosk screens.
- Number of celebration events displayed.
- Number of announcements viewed.
- Playlist uptime.
- Panel load time.


### Admin and operations

- Theme toggle adoption.
- Error rate on saves.
- Latency on table and dashboard loads.
- Use of exports and configuration surfaces.


## 37. Implementation Checklist

- Add light-first theme tokens.
- Add optional dark mode toggle.
- Add repo-level dark mode flag.
- Update shell and navigation styles.
- Build annual planning flows.
- Add year target allocation logic.
- Add monthly planning and review.
- Add self-improvement tracking.
- Add commission and persistency tools.
- Add kiosk playlist and panels.
- Add kiosk engagement animations.
- Add admin kiosk management controls.
- Add accessibility and motion tests.
- Add virtualization for large tables.
- Add skeleton states and performance optimizations.
- Update documentation and screenshots.


## 38. Final Guidance for Claude Code

- Use this document as the single source of truth.
- Treat light mode as the default across the app.
- Keep dark mode as a valid option, not the primary identity.
- Make kiosk mode emotionally engaging, lively, and polished.
- Preserve enterprise clarity and simplicity.
- Avoid turning the app into a full CRM.
- Build for real insurance workflows, not generic dashboard aesthetics.

If you want, I can also turn this into a stricter engineering version with:

- file-by-file implementation notes,
- component props,
- route map,
- and backend endpoint definitions in a more code-ready format.
<span style="display:none">[^1][^2]</span>

<div align="center">⁂</div>

[^1]: repomix-output.xml

[^2]: AgencyTrack-Technical-Design-Specification-2.md

