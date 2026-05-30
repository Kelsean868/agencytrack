# Track J — Career Portal v2 Kickoff Brief

**Branch:** `redesign/career-portal`  
**Target:** `src/components/profile/CareerPortal.jsx`  
**Mockup source:** `design_handoff_v2_app/mockups/app-career-v2.jsx`

## Visual Deltas

| Old | New |
|-----|-----|
| Simple circle with level number | 7-node vertical career ladder (achieved=teal coin, current=gold coin+YOU ARE HERE pill, locked=flat grey+lock badge) |
| Progress toward next level (criterion rows) | Level drill drawer (click locked level → slide-in panel with criteria + unlocks) |
| GoalsOverview table | 3 CommitmentCard components (API, Apps, Persistency) each with step-bar showing floor/target/mine |
| CommissionPlayground embedded | Removed (pulled out to Tools surface per design) |
| GapAnalysisPanel embedded | Removed from this screen |
| MDRT tracker (plain progress bar) | Removed (subsumed into Awards) |
| BadgeGrid below | BadgesSection (same data, 6-col grid desktop, 3-col mobile) |
| No time-to-next card | TimeToNextCard (estimate + weekly pace) |
| No trajectory chart | TrajectoryCard (8-quarter bar chart using recharts) |

## Token Map

All values from existing CSS vars:
- Achieved node: `var(--primary-channels)` gradient → `medal-3`-like teal coin
- Current node: `var(--gold-channels)` gradient → gold coin with glow
- Locked node: `var(--surface-muted-channels)` + `var(--border-channels)`
- YOU ARE HERE pill: `bg-gold/20 text-gold`
- Connector (achieved): `border-primary`
- Connector (pending): `border-dashed border-border`

**Gold token addition:** Add `gold` to tailwind.config.js (existing `--gold-channels` + `--color-gold-tint` wired to Tailwind utilities).

## Decisions Locked

1. `levelDates` for achieved levels — computed from submission history first-submission per level window; fallback to "Earned (no date)" if history gap
2. `estimateToNext` — computed as `(gap_to_next_level_api / weeklyPace)` rounded to nearest week
3. `weeklyPace` — `ytdAPI / weeksSubmitted` (current year)
4. `monthsAtCurrent` — omitted (not stored; drawer just shows "Reached level X")
5. TrajectoryCard — uses recharts BarChart with quarterly API grouping from submissions prop
6. CommissionPlayground, GapAnalysisPanel, MDRT tracker removed from this screen
7. BadgeGrid stays (wired to existing BadgeGrid component — data source unchanged)
8. Level drill drawer state managed with `useState(null)` in CareerPortal
