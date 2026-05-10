# E5.1 — Kiosk Polish Iteration

## Source

- Prior work: PR #73 (E5 base), PR #74 (Vercel SPA rewrite fix) — both merged
- Live production smoke session May 10 2026 surfaced restructure needs
- Planning decisions May 10 2026 (Kelsean + Claude)

## Decisions locked

- **Fullscreen:** (b) click-to-fullscreen button on initial kiosk load + (a) document Chrome `--kiosk` flag for proper TV deployment
- **Panel structure:** 12 panels (up from 8), restructured order
- **Branch Running Totals:** moves from slot #4 to slot #3 (right after Branch Overview), relabeled to "Branch Running Totals — Cumulative"
- **Period leaderboards:** 4 new panels (YTD / QTD / MTD / This Week), each with side-by-side API | Apps leaderboards
- **Activity Leaderboard:** new panel with side-by-side Prospecting (names + calls) | Conversions (FFIs + CIs). Appointments excluded (real activity is the conversation, not the booking)
- **Breakdown beneath totals:** show breakdown on activity rows ("Sarah W. — 87 (45 names, 42 calls)")
- **Single column layout:** all leaderboards single-column at scale; auto-paging within panel for >12 agents
- **NO emoji characters anywhere on kiosk panels.** Use Lucide React icons (already in stack) for all visual indicators. Trophy/medal positions, status indicators, accents — all icons, never emojis. This is non-negotiable.
- **Subtle animations** on data load to make kiosk engaging without being distracting. CSS/Tailwind only, no new dependencies. Specific patterns specified in Phase 5.

## Scope

### IN — this PR

1. KioskShell adds a "Click to enter fullscreen" button on initial load (Fullscreen API on user gesture)
2. Documentation update: `docs/PILOT_LAUNCH_OPS.md` — Chrome kiosk-mode launch flag for TV deployment
3. **Panel restructure** to the 12-panel order below
4. Move existing BranchRunningTotalsPanel to slot #3, rename header to "Branch Running Totals — Cumulative"
5. **Four new period leaderboard panels** (YTD / QTD / MTD / This Week), each rendering side-by-side API leaderboard | Apps leaderboard
6. **One new Activity Leaderboard panel** with side-by-side Prospecting | Conversions
7. Replace existing single AgentLeaderboardPanel — its purpose is now covered by the period leaderboards. Delete the orphaned component
8. Single-column responsive layout with sub-paging for >12 agents within each leaderboard
9. **Emoji audit + replacement** — scan all kiosk panel components for emoji characters, replace with Lucide icons
10. **Animation additions** — count-up numbers, row stagger entrance, progress bar fills (specific patterns in Phase 5)
11. Update PANEL_DURATIONS config for new 12-panel cycle
12. Vitest tests for new components + animation behavior
13. Playwright walk verifying all 12 panels rotate correctly with real data, icons rendering (not emojis), animations triggering

### OUT — deferred

- Touch/click interactions on kiosk panels (still no manual advance UI)
- Real-time Firestore listeners (still polling every 5 minutes)
- Profile photo upload UI (already deferred from E5)
- Manual panel skip from TV side
- Per-panel duration overrides via UI (timing stays config-driven)
- Multi-language support (English only)
- Service account key cleanup (separate small PR — see Notes for CC)

## Discipline gates

- Single-branch PR rule
- Fetch-first
- Two-strike counter: **CARRIES OVER from E5 at 1/2** (E5 had soft strike for AgentLeaderboardPanel scope-narrow). One more unilateral scope-narrow this session = hard stop.
- No auto-merge — restructure of a live, deployed feature
- **Lint after every commit that adds files** (E4 walk-script lesson)
- **Reused E5 patterns:** Avatar component, computations.js period boundaries, RankedLeaderboard, ProductionTable

---

## Final 12-panel sequence

| # | Panel | Period | Notes |
|---|---|---|---|
| 1 | Welcome | — | Good morning + clock + rotating quote |
| 2 | Branch Overview | YTD | Big numbers (was here in E5) |
| 3 | **Branch Running Totals — Cumulative** | MTD/QTD/YTD | Moved up from slot #4, header relabeled |
| 4 | Unit Leaderboard | This Week | Existing — kept in sequence |
| 5 | Last Week Recap | Last week | Existing — Friday/Monday meeting context |
| 6 | **YTD Leaderboards** | YTD | NEW — API \| Apps side by side |
| 7 | **QTD Leaderboards** | QTD | NEW — API \| Apps side by side |
| 8 | **MTD Leaderboards** | MTD | NEW — API \| Apps side by side |
| 9 | **This Week Leaderboards** | This week | NEW — API \| Apps side by side |
| 10 | **Weekly Activity** | This week | NEW — Prospecting \| Conversions |
| 11 | Awards Watch | Monthly + Quarterly | Existing |
| 12 | Compliance | This week | Existing |

### PANEL_DURATIONS update

```javascript
export const PANEL_DURATIONS = {
  welcome: 15,
  branchOverview: 30,
  branchRunningTotals: 30,
  unitLeaderboard: 30,
  lastWeekRecap: 30,
  ytdLeaderboards: 35,
  qtdLeaderboards: 35,
  mtdLeaderboards: 35,
  weekLeaderboards: 35,
  weeklyActivity: 35,
  awardsWatch: 30,
  compliance: 25,
};
// Total cycle: 365s ≈ 6.1 minutes
```

---

## Phase 1 — Sync + worktree

```
git fetch origin --prune
git checkout main
git pull origin main
git log origin/main --oneline -5   → HEAD should be PR #74 merge
```

Bundle CONTEXT.md sync into first commit:
- HEAD bumped to current
- PR #73 + #74 confirmed in "Recently shipped"
- Active follow-up row → E5.1 in progress
- "Where we left off" → E5.1 starting; kiosk live in production with planned polish iteration

Branch: `feat/e5-1-kiosk-polish`
Worktree: `.claude/worktrees/feat-e5-1-kiosk-polish`

---

## Phase 2 — Discovery

Read these completely before writing code. Output to `docs/e5-1-discovery-notes.md`:

### Activity field schema
- Read `functions/index.js` `buildDocFields` and weekly submission schema
- Identify exact field names for: prospect names obtained, phone calls made, FFIs, CIs
- Confirm these are tracked weekly per agent (not aggregate-only)
- Document the field names in discovery notes — the Activity panel depends on these

### Existing components to reuse
- `src/components/kiosk/Avatar.jsx` — used unchanged
- `src/components/kiosk/panels/RunningTotalsPanel.jsx` — moves slot, gets relabeled, otherwise unchanged
- `src/components/kiosk/panels/AgentLeaderboardPanel.jsx` — REMOVED (replaced by 4 period panels)
- `src/components/productionReport/RankedLeaderboard.jsx` — primary reuse for new period leaderboards
- `src/lib/productionReport/computations.js` — has all four period boundaries (week/MTD/QTD/YTD)
- `src/lib/kiosk/utils.js` — period helpers if any added there

### Emoji audit
- Grep all `src/components/kiosk/**/*.jsx` files for emoji characters
- Common offenders: 🥇🥈🥉 🏆 ⭐ ✅ ❌ 🔥 💰 📊 📈 — any non-ASCII visual character is suspect
- Document each location found, what it represents, and proposed Lucide icon replacement
- Also check `src/lib/kiosk/utils.js` for any emoji constants
- Report to discovery notes; this becomes a checklist for Phase 5 replacement

### Lucide icons available
- Confirm Lucide React is imported and which version (`package.json`)
- Useful icons for kiosk:
  - `Trophy` — 1st place top callouts
  - `Medal` — 2nd/3rd place positions (style with color: gold/silver/bronze)
  - `Award` — general award/achievement marker
  - `Crown` — "top performer" emphasis
  - `Star` — accent / highlight
  - `TrendingUp` / `TrendingDown` — week-over-week deltas
  - `CheckCircle` / `XCircle` — submission status
  - `Activity` — activity panel header
  - `Clock` — time/cadence indicators
  - `Users` — branch/team indicators

### Single-column sub-paging pattern
- Confirm: no existing pattern for in-panel sub-paging in current kiosk code
- Pattern to introduce: state-driven page rotation within a panel component
- Each leaderboard panel receives `pageDuration` prop; auto-cycles through pages every N seconds while panel is active

### Animation infrastructure
- Check `tailwind.config.js` for existing keyframes (`animate-kiosk-fade` is there)
- Plan to add: `animate-count-up`, `animate-stagger-in`, `animate-progress-fill`
- Confirm no Framer Motion or animation library is installed (we want CSS-only to keep bundle small)

### Fullscreen API
- Confirm `document.documentElement.requestFullscreen()` is the right call
- Confirm browser support (modern Chrome/Firefox/Edge — yes; Safari may need vendor prefix)
- Document any quirks in discovery notes

### STOP conditions

- Activity field schema is unexpectedly different (e.g., activities stored in nested objects rather than flat counts) — surface
- Existing RankedLeaderboard component can't accept the side-by-side configuration without major refactor — surface
- Computations.js doesn't have a clean way to filter weekly submissions by current week — surface
- Lucide React is missing or out of date — surface, may need version bump

---

## Phase 3 — Fullscreen + deployment docs

### `src/components/kiosk/FullscreenButton.jsx`

Small button overlaid on kiosk shell when not in fullscreen mode. On click, calls `requestFullscreen()`. Hides itself once fullscreen is active.

```javascript
// Behavior:
//   - Renders as a small icon-button in bottom-right corner
//   - Uses Lucide's Maximize2 icon
//   - Visible only when NOT in fullscreen mode (uses fullscreenchange event)
//   - On click: calls document.documentElement.requestFullscreen()
//   - On fullscreenchange (entering fullscreen): hides itself
//   - On fullscreenchange (exiting): re-appears
//   - Visual: subtle, semi-transparent, low z-index priority
```

Mount inside KioskShell, position absolute, low priority but visible.

### Documentation update

Create or update `docs/PILOT_LAUNCH_OPS.md`. Include section:

```markdown
## TV Display Setup

For dedicated office TV displays running the kiosk full-time, launch Chrome with kiosk mode flag:

Windows:
  chrome.exe --kiosk https://agencytrack.vercel.app/kiosk/<tenant>/<token>

Linux/Raspberry Pi:
  chromium-browser --kiosk --noerrdialogs --disable-infobars https://agencytrack.vercel.app/kiosk/<tenant>/<token>

Mac:
  open -a "Google Chrome" --args --kiosk https://agencytrack.vercel.app/kiosk/<tenant>/<token>

For non-dedicated displays (e.g., manager opens kiosk on a laptop occasionally),
the on-screen "Click to enter fullscreen" button works via the browser Fullscreen API.

Recommended dedicated kiosk hardware:
  - Raspberry Pi 4 (TTD ~600 total inc. cables)
  - Mini-PC (TTD ~1,500)
  - Configure auto-launch on boot via systemd or Task Scheduler
```

### Tests

Vitest:
- FullscreenButton renders when not in fullscreen
- Click triggers requestFullscreen call (mocked)
- Hides on fullscreenchange to active state
- Reappears on fullscreenchange to inactive state
- Maximize2 icon renders (snapshot or aria-label check)

---

## Phase 4 — Animation infrastructure

### Update `tailwind.config.js`

Add new keyframes for kiosk animations:

```javascript
keyframes: {
  // Existing
  'kiosk-fade': { /* keep current */ },

  // NEW
  'count-up': {
    '0%': { opacity: '0', transform: 'translateY(10px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  'stagger-in': {
    '0%': { opacity: '0', transform: 'translateX(-20px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' },
  },
  'progress-fill': {
    '0%': { width: '0%' },
    '100%': { width: 'var(--progress-target, 100%)' },
  },
},
animation: {
  'kiosk-fade': 'kiosk-fade 800ms ease-in-out',
  'count-up': 'count-up 600ms ease-out',
  'stagger-in': 'stagger-in 400ms ease-out',
  'progress-fill': 'progress-fill 1500ms ease-out forwards',
},
```

### Hook: `src/hooks/useCountUp.js`

For numerical count-up animations on big numbers (KPIs, leaderboard totals).

```javascript
// Usage: const display = useCountUp(targetValue, { duration: 1000, decimals: 0 });
//
// Returns a number that animates from 0 (or last value) to targetValue
// over `duration` ms, with the specified decimal precision.
//
// Used by: BranchOverviewPanel big numbers, BranchRunningTotalsPanel, leaderboard totals
//
// Edge cases:
//   - If targetValue is 0, immediate display
//   - If targetValue changes mid-animation, smoothly transition to new target
//   - Cleanup interval on unmount
```

### Tests

Vitest for `useCountUp`:
- Animates from 0 to target over specified duration
- Respects decimals parameter
- Cleanup on unmount (no memory leak / hanging interval)
- Handles target change mid-animation

---

## Phase 5 — Period leaderboard panels (4 new) + animations + icons

### Component: `src/components/kiosk/panels/PeriodLeaderboardsPanel.jsx`

Shared component that renders side-by-side API | Apps leaderboards for a given period.

```javascript
// Props:
//   period: 'ytd' | 'qtd' | 'mtd' | 'week'
//   submissions: array of submissions
//   agents: array of agents
//   periodLabel: 'YTD' | 'QTD' | 'MTD' | 'This Week'
//
// Layout:
//   <h2>{periodLabel} Leaderboards</h2>
//   <div className="grid grid-cols-2 gap-12">
//     <RankedLeaderboard
//       title="API"
//       sortBy="api"
//       valueLabel="API"
//       valueFormat="currency-ttd"
//       agents={...}
//       enableStagger={true}    // NEW — rows enter with stagger animation
//       enableCountUp={true}    // NEW — totals count up on entry
//     />
//     <RankedLeaderboard
//       title="Apps"
//       sortBy="apps"
//       valueLabel="Apps"
//       valueFormat="count"
//       agents={...}
//       enableStagger={true}
//       enableCountUp={true}
//     />
//   </div>
```

### RankedLeaderboard updates

Add new props for kiosk mode:

```javascript
// New props:
//   enableStagger: boolean — applies animate-stagger-in to rows with sequential delays
//   enableCountUp: boolean — uses useCountUp for displayed totals
//   maxRowsPerPage: number (default 12) — for sub-paging
//   pageDuration: number (default 12) — seconds per page
//
// Rank icons (replace any emoji medals):
//   1st: <Trophy className="text-yellow-400" />     (gold)
//   2nd: <Medal className="text-slate-300" />        (silver)
//   3rd: <Medal className="text-amber-600" />        (bronze)
//   4+: numerical rank "#4", "#5", etc. (no icon)
//
// Stagger delays (when enableStagger):
//   Row 1: animation-delay: 0ms
//   Row 2: 100ms
//   Row 3: 200ms
//   Row N: (N-1) * 100ms
```

### Four panel wrappers (thin adapters around PeriodLeaderboardsPanel)

- `YTDLeaderboardsPanel.jsx` — period='ytd', label='YTD'
- `QTDLeaderboardsPanel.jsx` — period='qtd', label='QTD'
- `MTDLeaderboardsPanel.jsx` — period='mtd', label='MTD'
- `WeekLeaderboardsPanel.jsx` — period='week', label='This Week'

Each is ~10 lines — just configures the shared component.

### Single-column sub-paging

Each leaderboard renders as single column. If agent count > 12, paginate within the panel:
- Page 1: agents 1-12
- Page 2: agents 13-24
- etc.

Auto-advance pages every 12 seconds while panel is active. Visual indicator at bottom (e.g., "Page 1 of 2") so viewers know more is coming.

### Tests

Vitest for PeriodLeaderboardsPanel:
- Renders side-by-side leaderboards correctly
- Filters submissions by correct period
- Empty state when no agents
- API and Apps leaderboards rank independently
- Trophy icon for 1st, Medal icons for 2nd/3rd, numerical for 4+
- No emoji characters in rendered output (snapshot test)

Tests for sub-paging:
- ≤12 agents: single page, no auto-advance
- 13-24 agents: 2 pages, advances at configured interval
- 25+: 3 pages, etc.
- Page indicator visible when >1 page

Tests for animations:
- enableStagger applies stagger delays to rows
- enableCountUp triggers useCountUp for totals
- Animations don't crash when data updates mid-animation

### STOP conditions

- RankedLeaderboard refactor for sub-paging is more invasive than expected — surface, may need a new TVRankedLeaderboard variant instead
- Period filtering returns wrong dates (e.g., week boundary off by one day) — surface

---

## Phase 6 — Activity panel

### Component: `src/components/kiosk/panels/WeeklyActivityPanel.jsx`

```javascript
// Layout:
//   <h2>Weekly Activity</h2>
//   <div className="grid grid-cols-2 gap-12">
//     <ActivityLeaderboard
//       title="Prospecting"
//       icon={<Activity />}
//       subtitle="(Names + Calls)"
//       computeTotal={(s) => s.namesObtained + s.callsMade}
//       breakdown={[
//         { label: 'names', field: 'namesObtained' },
//         { label: 'calls', field: 'callsMade' }
//       ]}
//     />
//     <ActivityLeaderboard
//       title="Conversions"
//       icon={<TrendingUp />}
//       subtitle="(FFIs + CIs)"
//       computeTotal={(s) => s.ffisCompleted + s.cisCompleted}
//       breakdown={[
//         { label: 'FFIs', field: 'ffisCompleted' },
//         { label: 'CIs', field: 'cisCompleted' }
//       ]}
//     />
//   </div>
```

Field names above are illustrative — Phase 2 discovery confirms actual schema.

### Component: `src/components/kiosk/panels/ActivityLeaderboard.jsx`

Sub-component used twice in WeeklyActivityPanel. Renders single-column leaderboard with breakdown beneath each total.

```
[Trophy] KA  Kelsean Agent     87
              45 names, 42 calls

[Medal-silver] TM  Test Manager   72
                    38 names, 34 calls

[Medal-bronze] KP  Kegan Peele    65
                    30 names, 35 calls
```

Total in large text (text-3xl), breakdown in smaller text below (text-sm, muted color).

Same icon system as RankedLeaderboard: Trophy/Medal-silver/Medal-bronze for top 3, numerical rank "#4", "#5"... for 4+.

Stagger animation: rows enter with cascading 100ms delays.

### Filter to current week only

Uses computations.js period filter for 'week' (Sunday-Saturday).

### Tests

Vitest:
- Renders both leaderboards side by side
- Prospecting and Conversions rank independently
- Breakdown displays beneath each total
- Empty state ("No activity recorded this week") when no submissions
- Excludes appointmentsSet from both totals (per locked decision)
- Trophy/Medal icons used (no emoji characters in output)
- Stagger animation applies to rows

### STOP conditions

- Activity field names from discovery don't match this Phase 6 spec — surface, adjust field references
- Computations utility doesn't expose a clean per-agent activity total helper — surface, may need small addition to computations.js

---

## Phase 7 — KioskShell integration + reorder + emoji audit cleanup

### Update KioskShell.jsx

Replace existing panel array with the new 12-panel sequence. Update PANEL_DURATIONS config.

```javascript
const PANELS = [
  WelcomePanel,
  BranchOverviewPanel,
  BranchRunningTotalsPanel,    // moved up (was index 3)
  UnitLeaderboardPanel,
  LastWeekRecapPanel,
  YTDLeaderboardsPanel,         // NEW
  QTDLeaderboardsPanel,         // NEW
  MTDLeaderboardsPanel,         // NEW
  WeekLeaderboardsPanel,        // NEW
  WeeklyActivityPanel,          // NEW
  AwardsWatchPanel,
  CompliancePanel,
];
```

### Mount FullscreenButton in KioskShell

Add `<FullscreenButton />` at the same level as the panel wrapper, positioned absolute bottom-right.

### Remove orphaned AgentLeaderboardPanel

Delete `src/components/kiosk/panels/AgentLeaderboardPanel.jsx` — its purpose is replaced by the period leaderboards.

Confirm no other code references it before deletion.

### Update RunningTotalsPanel rename

Header text changes from "Running Totals" to "Branch Running Totals — Cumulative" so it's distinct from the per-agent period leaderboards.

Apply count-up animation to the big MTD/QTD/YTD numbers using `useCountUp`.

### Apply emoji-to-icon replacements (per Phase 2 discovery)

Walk through every emoji location identified in Phase 2 discovery notes. Replace with Lucide icons per the mapping defined there.

### Apply animations to existing panels

- BranchOverviewPanel — count-up on big numbers (Total API, Total Apps, Avg API per agent, Active Agents)
- BranchRunningTotalsPanel — count-up on each period column
- UnitLeaderboardPanel — stagger entrance for unit rows
- LastWeekRecapPanel — count-up on totals, stagger on top performers
- AwardsWatchPanel — progress-fill animation on each progress bar (CSS variable `--progress-target` set per row)
- CompliancePanel — count-up on the big percentage, stagger on pending agents
- WelcomePanel — keep clean, only the existing live clock animation

### Tests

Vitest:
- KioskShell rotates through all 12 panels in order
- Each panel shows for its configured duration
- Polling triggers data refresh on schedule
- Invalid token shows error state
- FullscreenButton renders inside KioskShell
- No emoji characters appear in any rendered panel output (cross-cutting snapshot test)

---

## Phase 8 — Tests + lint + build

```
npm test     → all green
npm run lint → 0 errors, 3 known warnings OK (AgentAwardsPanel + GoalsPanel)
npm run build → green
```

**Run lint AGAIN after Phase 9 commits the walk script** (E4 lesson).

---

## Phase 9 — Playwright walk

Update `scripts/verification/e5-walk.mjs` (or create `e5-1-walk.mjs`) covering the new structure.

### Required checks (16 total)

1. Login as branch_manager → kiosk URL still valid → screenshot
2. Open kiosk URL in incognito → KioskShell renders with FullscreenButton visible
3. **Cycle through all 12 panels** → screenshot of each (12 screenshots)
4. Branch Running Totals appears at slot #3 (right after Branch Overview)
5. YTD Leaderboards: API and Apps both visible side by side
6. QTD/MTD/Week Leaderboards: similar verification
7. Weekly Activity: both Prospecting and Conversions visible
8. Activity breakdown text visible beneath totals
9. Single-column layout for all leaderboards
10. **No emoji characters present in any panel** — assertion via DOM inspection (search for common emoji code points; none should be present)
11. **Trophy/Medal Lucide icons rendering** for top 3 rank positions on at least one leaderboard
12. **Count-up animation visible on initial panel load** (assertion: number starts low, increases to target within ~1s)
13. **Stagger animation visible on leaderboard rows** (rows fade in sequentially, not all at once)
14. Mobile (380px) — degraded but renders without crashes
15. Token revoke → "Display unavailable" message
16. Re-generate token → new URL works

Save artifacts to `verification/e5-1/screenshots/`.

### STOP if checks 3, 5-8, 10-13, or 15 fail

Other failures are flag-don't-stop unless they reveal real bugs.

### Lint check after walk script committed

```
npm run lint
```

Must be 0 errors. Check syntax balance carefully (E4 lesson).

---

## Phase 10 — Open PR + STOP

### PR title

```
feat(e5.1): kiosk polish — 12-panel restructure, period × KPI leaderboards, activity panel, icons + animations
```

### PR description

```
## Summary
E5.1 — kiosk polish iteration based on production smoke feedback May 10 2026.

Restructures kiosk display from 8 panels to 12 with:
- Branch Running Totals moved to slot #3 (right after Branch Overview)
- Four new period leaderboard panels (YTD/QTD/MTD/Week), each side-by-side API | Apps
- New Weekly Activity panel — side-by-side Prospecting (names + calls) | Conversions (FFIs + CIs)
- Single-column layout with sub-paging for >12 agents
- Click-to-fullscreen button + Chrome --kiosk deployment docs
- All emoji characters replaced with Lucide icons (Trophy/Medal/Award)
- Subtle CSS animations: count-up on numbers, stagger entrance on rows, progress-fill on award bars

Total cycle: ~6 minutes through 12 panels (was ~4 minutes through 8).

## What ships

### New panels
- YTDLeaderboardsPanel, QTDLeaderboardsPanel, MTDLeaderboardsPanel, WeekLeaderboardsPanel
- WeeklyActivityPanel (Prospecting | Conversions)
- All use shared PeriodLeaderboardsPanel + ActivityLeaderboard sub-components

### Reorganized
- BranchRunningTotalsPanel: moved to slot #3, header relabeled "Branch Running Totals — Cumulative"
- AgentLeaderboardPanel: REMOVED (replaced by period leaderboards)

### Visual polish
- Lucide icons everywhere (no emoji characters)
- count-up animation on KPI numbers
- stagger-in animation on leaderboard rows
- progress-fill animation on award progress bars
- All animations CSS-only, no new dependencies

### New UI
- FullscreenButton on KioskShell — appears when not fullscreen
- Subtle bottom-right placement, hides on fullscreen activation

### Layout changes
- All leaderboards single-column at scale
- Sub-paging within panel for >12 agents (auto-advances every 12s)

### Documentation
- docs/PILOT_LAUNCH_OPS.md — Chrome --kiosk launch pattern for production TV deployment

## Verification

### Vitest
- <X> tests pass (new tests for period panels, activity panel, fullscreen button, sub-paging, animations, no-emoji assertion)

### Lint + build
- 0 errors, 3 known warnings (baseline)
- Build green

### Playwright walk
- <Y>/16 checks pass (artifacts in verification/e5-1/)

## Out of scope (deferred)
- Touch/click panel skip on TV side
- Real-time Firestore listeners (still polling every 5 minutes)
- Profile photo upload UI (separate post-pilot feature)
- Service account key cleanup (separate small PR — gcloud now installed, IAM grant pending)

## Awaiting Kelsean
- Spot-check screenshots from verification/e5-1/
- Manual smoke on Vercel preview, then production after merge
- Confirm 12-panel cycle feels right at the actual TV-viewing distance
- Confirm icon choices (Trophy/Medal vs Award/Crown) feel correct

## Strike count
- 1/2 going in (carries from E5)
- 1/2 going out (clean session) OR 2/2 if any unilateral scope-narrows
```

**STOP. Do NOT merge.** Substantial restructure of live deployed feature — requires Kelsean review of screenshots + Vercel preview test before merge.

---

## Hard stops (any → surface and wait)

- Phase 2 activity field schema differs unexpectedly from spec → surface
- Phase 2 emoji audit reveals emojis in unexpected files (e.g., Cloud Functions, services) → surface, scope decision needed
- Phase 4 RankedLeaderboard sub-paging refactor too invasive → surface, propose new TV variant instead
- Phase 5 computations.js needs significant additions for per-agent activity totals → surface
- Phase 9 Playwright walk fails on core checks (3, 5-8, 10-13, 15) → STOP, document, surface
- Two strikes hit (counter at 2/2 — already at 1/2 going in) → STOP regardless of phase
- Any unilateral scope-narrow on a "managers insist" or stakeholder-flagged requirement → STOP

## Success states

**Best:** PR open with green CI, Playwright 14-16/16, 12-panel cycle visibly correct on Vercel preview, icons rendering correctly (no emojis), animations smooth, awaiting Kelsean review.

**Acceptable:** PR open with 12-16/16 Playwright (mobile + edge cases tolerable), all 12 panels working, awaiting review.

**Acceptable with note:** Phase 9 Playwright partially deferred per time-window scope-cut. Manual smoke acceptable substitute. Document gap explicitly in PR description.

**Stopped:** Architectural blocker, schema mismatch, or scope concern → state-dump for direction.

---

## Notes for CC

- **Strike counter starts at 1/2 — carries over from E5.** One more unilateral scope-narrow and this session hits hard stop.
- **The "managers insist" lesson from E5:** when the brief flags a stakeholder requirement as non-negotiable, that scope cannot be narrowed without surfacing.
- **NO EMOJIS RULE:** The user has been clear about professional aesthetic. Emoji characters in any rendered output are a strict no-go. Phase 2 discovery audits + Phase 5/7 replaces. Phase 9 walk verifies. The cross-cutting snapshot test is a non-negotiable safety net.
- **Animations are subtle, not flashy.** This kiosk runs all day. No bouncing, no confetti, no color cycling. Count-up over ~1s, stagger ~100ms per row, progress fills over ~1.5s. If an animation feels "look at me," it's wrong.
- **Reuse aggressively** — Avatar, RankedLeaderboard, computations.js, ProductionTable, period boundaries all exist. This iteration is restructure + additions, not new architecture.
- **Trust-but-verify discipline:** PR description must include explicit X/16 walk count and what failed and why. Don't claim success based on local lint alone.
- **Lint after every commit that adds files** (E4 walk-script lesson is now project-permanent).
- **For "unexpected token" errors:** check syntax balance in surrounding code FIRST before assuming parser config issues (E4 root cause was missing closing paren).
- **No new Cloud Functions in this iteration** — but if any are added (unlikely), `firebase functions:list` verification is mandatory before declaring done.
- **Service account key cleanup is OUT OF SCOPE for this PR.** Kelsean has gcloud installed now and will run the IAM fix as a separate small PR. Do NOT touch `functions/index.js`'s admin.initializeApp configuration in this iteration.
- **Discovery before code** — Phase 2 confirms activity field names AND emoji locations. The Phase 5/6 specs are illustrative; real findings from schema and audit take precedence.
- **Branch Running Totals "Cumulative" label:** the user explicitly wants this distinguished from per-agent period leaderboards. The relabel is a small but meaningful UX clarity fix.
