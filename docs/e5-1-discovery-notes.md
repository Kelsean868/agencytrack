# E5.1 Discovery Notes

## Activity Field Schema

Fields read via `extractFields()` from `src/utils/extractFields.js`. Both nested (future) and flat (current) schemas produce the same extracted field names.

### Prospecting — Names

Derived field `f.totalNewNames`:
```
namesFromColdCanvass + referralsObtained + namesFromSeminarsConducted +
namesFromSeminarsAttended + namesFromTradeshowsConducted +
namesFromTradeshowsAttended + namesFromOther
```
Direct submission fields: `namesFromColdCanvass`, `referralsObtained`, etc. (flat, stored at document root).

### Prospecting — Calls

Derived field `f.totalTelAttempts`:
```
referralCalls + coldCalls + followUpCalls + seminarTradeshowCalls
```

### Conversions

- FFI: `ffiConducted` (direct field, both schemas)
- CI: `ciConducted` (direct field, both schemas)
- Appointments excluded per locked decision.

### WeeklyActivityPanel computation pattern

For each submission in the current week:
1. `extractFields(sub)` → get `totalNewNames`, `totalTelAttempts`, `ffiConducted`, `ciConducted`
2. Aggregate per agent across their week's submissions
3. Rank independently for Prospecting (names+calls) and Conversions (FFIs+CIs)

---

## Emoji Audit

Locations found:

| File | Line | Emoji | Represents | Lucide replacement |
|---|---|---|---|---|
| `AgentLeaderboardPanel.jsx` | 15 | `🥇🥈🥉` (MEDALS array) | rank 1/2/3 | DELETED — component being removed |
| `LastWeekRecapPanel.jsx` | 25 | `🥇🥈🥉` (MEDALS array) | rank 1/2/3 in top performers | Trophy (rank 1), Medal (ranks 2 & 3) |
| `AwardsWatchPanel.jsx` | 79 | `🏆` | achieved award marker | Trophy icon |

No emojis found in:
- `UnitLeaderboardPanel.jsx` — uses `#{rank}` text with color classes (already clean)
- `WelcomePanel.jsx` — clean
- `BranchOverviewPanel.jsx` — clean
- `RunningTotalsPanel.jsx` — clean
- `CompliancePanel.jsx` — clean
- `src/lib/kiosk/utils.js` — clean
- `src/lib/kiosk/kioskConfig.js` — clean

---

## Existing Components to Reuse

- `Avatar.jsx` — unchanged, pass-through
- `RunningTotalsPanel.jsx` — move to slot #3, relabel header, add count-up
- `AgentLeaderboardPanel.jsx` — DELETE (replaced by 4 period panels)
- `src/lib/productionReport/computations.js` — has `filterSubmissionsByPeriod`, `computeAgentTotals`, `rankAgentsByApi`. Need to add `rankAgentsByApps`.
- Period string mapping: 'ytd' → ytd, 'quarter' → QTD, 'mtd' → MTD, 'week' → this week

---

## RankedLeaderboard Reuse Assessment

The existing `RankedLeaderboard` (`src/components/productionReport/RankedLeaderboard.jsx`) is a compact, production-report-scoped component:
- Small text (text-sm)
- Border-separated rows
- Designed for dashboard/report context

For kiosk (TV scale), the visual requirements are fundamentally different:
- Large text (text-3xl+)
- Full-bleed row cards
- Trophy/Medal Lucide icons for top 3
- Count-up and stagger animations
- Sub-paging for >12 agents

**Decision:** Create `TVRankedLeaderboard.jsx` — a kiosk-native leaderboard variant. Adding TV-scale props to the production report component would create conditional-style spaghetti. This is the STOP-condition alternative the brief pre-authorized.

---

## Single-Column Sub-paging Pattern

No existing sub-paging in current kiosk code. New pattern:
- State: `page` (starts at 0), `pageCount = Math.ceil(agentCount / PAGE_SIZE)`
- Auto-advance: `setInterval` inside component, cleared on unmount
- Page size: 12 agents per page (single column)
- Indicator: "Page X of Y" in bottom-right corner when pageCount > 1

---

## Animation Infrastructure

Current: `animate-kiosk-fade` in `tailwind.config.js` (0→1 opacity over 0.6s).

Need to add:
- `count-up`: slide-up + fade for big numbers (600ms ease-out)
- `stagger-in`: slide-left + fade for leaderboard rows (400ms ease-out)
- `progress-fill`: width 0→var(--progress-target) for award bars (1500ms ease-out forwards)

No Framer Motion installed. CSS-only confirmed.

`useCountUp` hook: animates a number from 0 to target using `requestAnimationFrame`. Returns current display value. Cleans up on unmount.

---

## Fullscreen API

- `document.documentElement.requestFullscreen()` — standard, supported in Chrome/Firefox/Edge
- `document.exitFullscreen()` — to exit
- `fullscreenchange` event on `document` — fires on both enter and exit
- `document.fullscreenElement` — null when not in fullscreen
- Safari vendor prefix: `webkitRequestFullscreen` — worth handling as fallback

---

## Lucide React

- Installed: `lucide-react@1.12.0`
- All required icons present: Trophy, Medal, Award, Crown, Star, TrendingUp, TrendingDown, CheckCircle, XCircle, Activity, Clock, Users, Maximize2

---

## No STOP Conditions Triggered

- Activity field schema is flat + well-documented — confirmed per `extractFields.js`
- RankedLeaderboard reuse for TV scale deferred to new `TVRankedLeaderboard` component (pre-authorized alternative per brief)
- `computations.js` has clean period filtering — will add `rankAgentsByApps` helper
- Lucide React is current and complete
- All existing kiosk components are readable and clearly scoped
