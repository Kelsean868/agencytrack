# E6 — Agent of the Month

## Source

- Prior work: PR #75 (E5.1 kiosk polish) — merged
- Live on production: 12-panel kiosk with icons, animations, period leaderboards
- Planning decisions May 10 2026 (Kelsean + Claude)

## Concept

Insurance branches in TT traditionally maintain a physical Agent of the Month display recognizing top performers in selected categories. The branch secretary tracks performance, the manager confirms and approves, and the recognition is displayed for the month. This brief digitizes that workflow into AgencyTrack.

Three categories per month per branch:

1. **API Champion** — top agent by total Annual Premium Income for the month
2. **Apps Leader** — top agent by total apps sold for the month
3. **Activity Winner** — top agent by total combined activities (names + calls + FFIs + CIs) for the month

Manager-approved (not auto-determined) — the system suggests top 5 candidates per category from data, manager picks the winner. This preserves the secretary-confirmation step that already happens offline.

## Decisions locked

- **Three categories:** API, Apps, Activity (Traditional API skipped — no separate schema field for Rest Assured; revisit if managers insist)
- **Selection mode:** suggested top 5 candidates per category from data; manager picks one (or types name to override)
- **Edit window:** approved selections editable until 7 days into the next month, then locked. Past months become read-only history
- **Kiosk display:** dedicated panel showing all three winners, prominent placement at slot #2 (right after Welcome)
- **Empty state:** if current month not yet approved, kiosk shows previous month's winners until day 7 of new month; after day 7 with no selection, shows "Awards pending"
- **No emojis** — Trophy/Crown/Award Lucide icons only (continues E5.1 standard)

## Scope

### IN — this PR

1. **Data model:** new collection `tenants/{tid}/agentOfMonth/{yyyy-mm}` with three category records per month
2. **Cloud Functions:**
   - `getAgentOfMonth` — kiosk reads (called via existing kiosk-token-authenticated path)
   - `setAgentOfMonth` — manager writes (callable, branch_manager+)
   - `getAgentOfMonthCandidates` — manager UI fetches top 5 per category (callable, branch_manager+)
3. **Firestore rules:** additive widening for `agentOfMonth` collection
4. **Manager UI:** new "Agent of the Month" tab on ManagerDashboard
   - Visible to branch_manager, sales_manager, tenant_admin, platform_admin
   - Hidden for unit_manager and agent
   - Three category sections (API / Apps / Activity)
   - Top 5 candidates per category with values
   - Selection + approval flow
   - Edit-until-day-7 enforcement
5. **Kiosk panel:** `AgentOfMonthPanel.jsx`
   - Three large columns (API / Apps / Activity)
   - Large avatars (~250px each, larger than regular leaderboard avatars)
   - Each shows: photo, name, category label, achievement value
   - Trophy icon header + month/year
   - Empty state when winners not yet approved
6. **Panel sequence update:** insert AOM panel at slot #2 (after Welcome). New 13-panel sequence
7. **PANEL_DURATIONS update:** AOM gets 45s (longer than regular panels — recognition deserves dwell time)
8. Vitest tests for new components, computations, edit-window logic
9. Playwright walk update covering the new panel + manager flow

### OUT — deferred

- Traditional API award (no schema field exists; would require schema addition)
- Quarterly Awards (different cadence, separate feature)
- Annual Awards / Agent of the Year (already in awards engine; could integrate later)
- Push notifications when a new AOM is announced (post-pilot)
- Historical view — agents seeing past months they won (post-pilot polish)

## Discipline gates

- Single-branch PR rule
- Fetch-first
- Two-strike counter: **CARRIES OVER from E5/E5.1 at 1/2.** One more unilateral scope-narrow this session = hard stop
- No auto-merge — new feature with new schema + new CFs
- **Lint after every commit that adds files** (project-permanent lesson)
- **Cloud Function exports verified** — `firebase functions:list` after Phase 3 must show all three new functions before continuing
- **Public route safety:** AOM data is read by kiosk via existing kiosk-token auth; no new public read paths
- **Discovery before code** — Phase 2 confirms exact field names for activity totals, manager dashboard tab pattern, panel placement

---

## Final 13-panel sequence

| # | Panel | Period | Notes |
|---|---|---|---|
| 1 | Welcome | — | Existing |
| 2 | **Agent of the Month** | Current month | NEW — prominent placement |
| 3 | Branch Overview | YTD | Existing — moved from #2 |
| 4 | Branch Running Totals — Cumulative | MTD/QTD/YTD | Existing — moved from #3 |
| 5 | Unit Leaderboard | This Week | Existing — moved from #4 |
| 6 | Last Week Recap | Last week | Existing — moved from #5 |
| 7 | YTD Leaderboards | YTD | Existing — moved from #6 |
| 8 | QTD Leaderboards | QTD | Existing — moved from #7 |
| 9 | MTD Leaderboards | MTD | Existing — moved from #8 |
| 10 | This Week Leaderboards | This week | Existing — moved from #9 |
| 11 | Weekly Activity | This week | Existing — moved from #10 |
| 12 | Awards Watch | Monthly + Quarterly | Existing — moved from #11 |
| 13 | Compliance | This week | Existing — moved from #12 |

### PANEL_DURATIONS update

```javascript
export const PANEL_DURATIONS = {
  welcome: 15,
  agentOfMonth: 45,            // NEW — recognition deserves dwell time
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
// Total cycle: 410s ≈ 6.8 minutes (was ~6.1 with 12 panels)
```

---

## Phase 1 — Sync + worktree

```
git fetch origin --prune
git checkout main
git pull origin main
git log origin/main --oneline -5   → HEAD should be PR #75 merge
```

If `git fetch` fails with network error: **STOP and surface** — do not branch from potentially-stale local state (E5.1 lesson).

Bundle CONTEXT.md sync into first commit:
- HEAD bumped to current
- PR #75 confirmed in "Recently shipped"
- Active follow-up row → E6 in progress
- "Where we left off" → E6 starting; E5.1 fully shipped

Branch: `feat/e6-agent-of-month`
Worktree: `.claude/worktrees/feat-e6-agent-of-month`

---

## Phase 2 — Discovery

Read these completely before writing code. Output to `docs/e6-discovery-notes.md`:

### Activity field schema (re-confirm from E5.1)
- Confirm exact field names from `functions/index.js` for: prospect names obtained, phone calls made, FFIs completed, CIs completed
- These four sum to the Activity Winner metric
- Cross-reference with E5.1 discovery notes if they exist

### API and Apps fields
- Confirm: `apiSold` / `applicationsSold` (or whatever the canonical names are)
- Same fields used in existing leaderboards from E5.1

### Manager dashboard tab pattern
- Read `src/components/dashboard/ManagerDashboard.jsx` — KioskModeTab is the model to follow
- Identify role-gating mechanism (E5.1 used `filteredNavItems`)
- New tab "Agent of the Month" follows the same pattern

### Existing Cloud Function patterns
- Read `functions/index.js` — kiosk CFs (`createKioskToken`, `revokeKioskToken`, `validateKioskToken`) are the model for AOM CFs
- Confirm role validation pattern for callables (`context.auth.token` claims)

### Existing computations.js usage
- Period boundaries for "current month" — already in `src/lib/productionReport/computations.js`
- Aggregation helpers per agent for a period — confirm which exist, which need adding

### Kiosk shell architecture
- `src/components/kiosk/KioskShell.jsx` — how panels are registered and rotated
- `src/lib/kiosk/kioskConfig.js` — PANEL_DURATIONS and PANEL_ORDER updates needed
- New panel is added to PANEL_ORDER between welcome and branchOverview

### Custom token + Firestore rules pattern
- Confirm kiosk reads use `isKiosk()` rules helper (added in E5)
- New collection `agentOfMonth` needs additive rules for both manager writes and kiosk reads

### STOP conditions

- Activity field schema differs unexpectedly from E5.1 spec → surface
- Manager dashboard tab system can't accept a new tab cleanly → surface
- Cloud Function patterns conflict with existing CF architecture → surface
- Firestore rules architecture can't express per-collection role gates → surface

---

## Phase 3 — Schema + Cloud Functions

### Schema: `tenants/{tenantId}/agentOfMonth/{yyyy-mm}`

```javascript
{
  monthKey: string,              // "2026-05" — also the doc ID
  tenantId: string,
  branchId: string,              // scoped to a single branch
  api: {
    agentUid: string,
    agentName: string,            // denormalized for kiosk read
    photoURL: string | null,
    achievementValue: number,     // e.g., 145000 (TTD)
    approvedBy: string,           // manager UID
    approvedAt: timestamp,
  } | null,
  apps: { same shape, achievementValue is count } | null,
  activity: { same shape, achievementValue is total activity count } | null,
}
```

If a category isn't yet selected, that field is `null`. Empty state on kiosk handles this.

### Cloud Function: `getAgentOfMonthCandidates`

```javascript
// Callable, requires branch_manager+
// Input: { tenantId, branchId, monthKey }
// Returns: {
//   api: [{ agentUid, agentName, photoURL, value, rank }, ...top 5],
//   apps: [{ ... }],
//   activity: [{ ... }],
// }
//
// Behavior:
//   - Filters all submissions for tenant+branch in the given month
//   - Aggregates per agent for each category
//   - Returns top 5 ranked per category
//   - Includes agent's photoURL from user doc (denormalized for UI display)
```

### Cloud Function: `setAgentOfMonth`

```javascript
// Callable, requires branch_manager+
// Input: { tenantId, branchId, monthKey, category, agentUid }
// category: 'api' | 'apps' | 'activity'
//
// Behavior:
//   - Validates caller role (branch_manager or higher)
//   - Validates monthKey is current OR (current month - 1) AND today is within first 7 days of current month (edit window)
//   - Looks up agent's name + photoURL from user doc
//   - Looks up agent's actual value for that category in that month
//   - Writes to tenants/{tid}/agentOfMonth/{monthKey}.{category}
//   - Returns: { success, monthKey, category, agentUid }
//
// Validation:
//   - If monthKey is locked (>7 days into next month), reject with reason='locked'
//   - If agentUid doesn't belong to specified branch, reject with reason='wrong_branch'
```

### Cloud Function: `getAgentOfMonth`

```javascript
// HTTP-callable (used by kiosk like validateKioskToken pattern)
// OR: extend kioskCanRead() rule to allow direct Firestore read by kiosk
//
// Recommended: direct Firestore read by kiosk (lower latency, fewer round-trips)
// kiosk authenticates with custom token, reads tenants/{tid}/agentOfMonth/{currentMonth}
// Falls back to {previousMonth} if current is empty AND today is within first 7 days
```

**Recommendation:** kiosk reads directly from Firestore using the existing custom-token + isKiosk() rule pattern. Simpler than another HTTP function. Phase 3 work focuses on the two writer-side CFs (setAgentOfMonth, getAgentOfMonthCandidates).

### Re-export from `functions/index.js`

```javascript
exports.setAgentOfMonth = require('./agentOfMonth/setAgentOfMonth').setAgentOfMonth;
exports.getAgentOfMonthCandidates = require('./agentOfMonth/getCandidates').getAgentOfMonthCandidates;
```

**Verification step before proceeding:** run `firebase functions:list` from the worktree (after `npm install` in functions/) — both new functions must appear before continuing to UI work.

### firestore.rules updates

Additive widening only:

```
match /tenants/{tenantId}/agentOfMonth/{monthKey} {
  // Manager-tier reads + writes via callables (rules-bypassed via Admin SDK)
  // Kiosk reads via existing isKiosk() helper
  allow read: if isManagerOrAbove(tenantId) || isKiosk(tenantId);
  allow write: if false;  // writes go through CFs only
}
```

Deploy rules pre-merge per project precedent.

### Tests

Vitest:
- setAgentOfMonth happy path: writes correctly, returns success
- setAgentOfMonth rejects when monthKey locked (>day 7 of next month)
- setAgentOfMonth rejects when agent not in branch
- getAgentOfMonthCandidates returns top 5 per category, sorted correctly
- Edge case: month with no submissions returns empty arrays

### STOP conditions

- Cloud Function deploy fails locally via emulator
- Firestore rules can't express the manager-OR-kiosk read pattern cleanly
- Edit window logic gets complex (timezone considerations) — surface for design discussion

---

## Phase 4 — Manager UI tab

### New file: `src/components/manager/AgentOfMonthTab.jsx`

```javascript
// Layout:
//   <h2>Agent of the Month — [Current Month Year]</h2>
//   <p>Confirm each category's winner. Editable until [date] (7 days into next month).</p>
//
//   <CategorySection
//     title="API Champion"
//     icon={<Trophy />}
//     candidates={topFive.api}
//     selected={current.api}
//     onSelect={...}
//   />
//   <CategorySection title="Apps Leader" icon={<Award />} ... />
//   <CategorySection title="Activity Winner" icon={<TrendingUp />} ... />
//
//   <Button onClick={approveAll}>Approve all selections</Button>
```

### Sub-component: `src/components/manager/CategorySection.jsx`

```javascript
// Per category:
//   Header with icon + title
//   Top 5 candidates as cards or rows
//   Each card: avatar, name, value, "Select" button
//   Selected candidate visually highlighted
//   "Select different agent" override option (search-by-name input)
//   Confirmation when manager clicks final approve
```

### Behavior

- Tab loads → fetches `getAgentOfMonthCandidates` for current month
- Also fetches existing approved selections for current month (if any) to show current state
- Manager selects per category, clicks "Approve all selections"
- Calls `setAgentOfMonth` for each category that changed
- Shows toast confirmation: "Agents of the Month for May 2026 approved"
- After approval, kiosk picks up changes on next 5-min poll

### Edit window UI

- If current date is within first 7 days of new month AND prior month's selections exist:
  - Section at top: "Last month's winners (editable until [date])"
  - Same UI pattern, lets manager correct prior-month selections
- After day 7: prior month section is hidden / read-only

### Visibility (role-gating)
- branch_manager: visible
- sales_manager, tenant_admin, platform_admin: visible
- unit_manager, agent: hidden

### Tests

Vitest:
- Tab renders three category sections
- Selecting a candidate updates UI state
- Approve button calls setAgentOfMonth for each category
- Edit window UI shows for first 7 days of month, hides after
- Tab hidden for unit_manager + agent roles
- Empty state when no candidates exist (early in new month)

---

## Phase 5 — Kiosk panel

### New file: `src/components/kiosk/panels/AgentOfMonthPanel.jsx`

```javascript
// Layout:
//   <header>
//     <Trophy icon, large /> 
//     <h2>Agents of the Month</h2>
//     <subtitle>{monthYear}</subtitle>
//   </header>
//
//   <div className="grid grid-cols-3 gap-16">
//     <CategoryColumn
//       title="API Champion"
//       icon={<Trophy />}
//       winner={data.api}
//     />
//     <CategoryColumn
//       title="Apps Leader"
//       icon={<Award />}
//       winner={data.apps}
//     />
//     <CategoryColumn
//       title="Activity Winner"
//       icon={<TrendingUp />}
//       winner={data.activity}
//     />
//   </div>
```

### Sub-component: `src/components/kiosk/panels/AOMCategoryColumn.jsx`

```javascript
// Per column:
//   Centered icon (Trophy/Award/TrendingUp, large)
//   Avatar (size='aom' — ~250px diameter, larger than 'tv')
//   Agent name (text-4xl)
//   Category label (text-xl, muted)
//   Achievement value (text-3xl, accent color)
//   Stagger-in animation on column entry (~150ms delay between columns)
```

### Avatar sizing

Add new size to Avatar.jsx:
- `'aom'` size: 200-250px (depending on layout testing)
- All other sizes unchanged

### Empty state behavior

Logic in panel data fetch:
1. Try to read current month's AOM doc
2. If doc exists with all three categories filled → display all three
3. If doc exists but some categories null → show approved categories, "Pending" for nulls
4. If doc doesn't exist (no selections yet for current month):
   - If today is within first 7 days of month: try previous month, display with "[Last Month] Champions" label
   - Else: show "Awards pending — winners coming soon" empty state with Trophy icon centered

### Animation

- Trophy header fades in
- Three columns enter with stagger-in (150ms delay each) — left to right
- Numbers use count-up animation on entry (consistent with E5.1 patterns)

### Tests

Vitest:
- Renders all three categories when data complete
- Renders pending state for null categories
- Renders previous month's winners with appropriate label during first 7 days if current empty
- Renders "Awards pending" empty state otherwise
- Stagger animation applies correctly
- No emoji characters in output (snapshot)

### STOP conditions

- Panel layout breaks at 1920×1080 with three large avatars side-by-side → surface, may need to adjust avatar size or spacing
- Avatar component can't accept 'aom' size cleanly → surface

---

## Phase 6 — KioskShell integration + reorder

### Update kioskConfig.js

```javascript
import { AgentOfMonthPanel } from '../components/kiosk/panels/AgentOfMonthPanel';

export const PANEL_ORDER = [
  WelcomePanel,
  AgentOfMonthPanel,            // NEW — slot #2
  BranchOverviewPanel,
  BranchRunningTotalsPanel,
  UnitLeaderboardPanel,
  LastWeekRecapPanel,
  YTDLeaderboardsPanel,
  QTDLeaderboardsPanel,
  MTDLeaderboardsPanel,
  WeekLeaderboardsPanel,
  WeeklyActivityPanel,
  AwardsWatchPanel,
  CompliancePanel,
];
```

PANEL_DURATIONS gets the new entry (45s for agentOfMonth) per spec above.

### Update KioskShell.jsx data fetching

Add `agentOfMonth` to the data fetched on mount and during 5-min polling:
- Read `tenants/{tid}/agentOfMonth/{currentMonth}`
- If null AND today within first 7 days of month, also read `{previousMonth}`
- Pass to AgentOfMonthPanel via props

### Tests

Update existing KioskShell tests:
- Cycles through 13 panels (was 12)
- AgentOfMonthPanel appears at index 1 (slot #2)
- Polling refreshes AOM data alongside other data

---

## Phase 7 — Tests + lint + build

```
npm test     → all green (target: 240+ tests passing, exact count depends on additions)
npm run lint → 0 errors, 3 known warnings OK (baseline)
npm run build → green
```

**Run lint AGAIN after Phase 8 commits the walk script** (project-permanent lesson).

---

## Phase 8 — Playwright walk

Update `scripts/verification/e6-walk.mjs` based on `e5-1-walk.mjs` patterns. Address selector issues from E5.1's failing checks (banking lessons from prior walk).

### Required checks (18 total)

1. Login as branch_manager → ManagerDashboard shows "Agent of the Month" tab → click → screenshot
2. Tab loads → three category sections visible (API, Apps, Activity) → screenshot
3. Each category shows top 5 candidates with values
4. Select winner per category → "Approve all selections" → success toast
5. Refresh tab → selections persist (not lost on reload)
6. Open kiosk URL → cycle to slot #2 → AgentOfMonthPanel renders → screenshot
7. AOM panel shows all three winners with avatars + names + values
8. Trophy/Award/TrendingUp icons render (Lucide SVGs, no emojis)
9. Cycle through all 13 panels → screenshot of each (13 screenshots, replaces E5.1's 12)
10. Empty state: revoke a category selection (manager UI) → kiosk shows "Pending" for that category
11. Empty state: clear all selections → kiosk shows "Awards pending" empty state OR previous month's winners
12. Edit window: setAgentOfMonth call for prior-month succeeds within first 7 days
13. Edit window: setAgentOfMonth call for prior-month rejects after day 7 (mock date if needed)
14. Tab visibility: unit_manager doesn't see "Agent of the Month" tab
15. Mobile (380px) — manager UI degrades gracefully → screenshot
16. Dark mode rendering correct
17. **No emoji characters anywhere in rendered output** (DOM scan, like E5.1)
18. Token revoke + regenerate still works (regression check)

Save artifacts to `verification/e6/screenshots/`.

### STOP if checks 1-2, 4, 6-9, 14, or 17 fail

Other failures are flag-don't-stop unless they reveal real bugs.

### Selector-correctness lesson from E5.1

Four E5.1 walk checks (02/05/10/12) failed due to selector issues, not real bugs. For E6 walk:
- Use stable selectors (data-testid attributes if added, semantic role queries, aria-labels)
- Wait for specific text content rather than generic structural waits
- For Lucide SVG detection: use `[data-lucide]` attribute or class pattern from actual rendered output, confirm during discovery

### Lint check after walk script committed

Must be 0 errors. Check syntax balance carefully (E4 lesson on "unexpected token" errors).

---

## Phase 9 — Open PR + STOP

### PR title

```
feat(e6): agent of the month — manager-approved monthly recognition for API / Apps / Activity
```

### PR description

```
## Summary
E6 — Agent of the Month feature. Digitizes the traditional branch recognition workflow.

Three categories per month:
- API Champion (top agent by total API)
- Apps Leader (top agent by total apps sold)
- Activity Winner (top agent by total combined activities: names + calls + FFIs + CIs)

Manager-approved (not auto-determined). System suggests top 5 candidates per category from data; manager picks winner per category. Editable until 7 days into next month, then locked as historical record.

Displayed as dedicated kiosk panel at slot #2 (right after Welcome) with three large avatars and 45s dwell time. Empty-state handling for early-month transition.

13-panel kiosk cycle now ~6.8 minutes (up from 6.1).

## What ships

### Cloud Functions
- setAgentOfMonth (callable, branch_manager+)
- getAgentOfMonthCandidates (callable, branch_manager+)
- All exported from functions/index.js — verified via firebase functions:list

### Schema
- New collection: tenants/{tid}/agentOfMonth/{yyyy-mm}
- firestore.rules additive widening for kiosk reads + manager writes

### Manager UI
- New "Agent of the Month" tab on ManagerDashboard
- Visible to branch_manager+, hidden for unit_manager and agent
- Three-category selection with top 5 candidate suggestions per category
- Edit window enforcement (first 7 days of new month for prior month corrections)

### Kiosk panel
- AgentOfMonthPanel — three large columns, avatars at new 'aom' size (~250px)
- Position: slot #2 (right after Welcome) for prominence
- Empty state: previous month's winners during first 7 days; "Awards pending" thereafter
- Stagger-in animation, count-up on values
- All Lucide icons (Trophy/Award/TrendingUp), zero emoji characters

### Panel sequence
- 13 panels (was 12 after E5.1)
- AOM at slot #2 pushes existing panels down by one
- PANEL_DURATIONS updated; cycle is ~6.8 minutes

## Verification

### Vitest
- <X> tests pass (new tests for setAgentOfMonth, candidates, AOM panel, manager tab, edit window)

### Lint + build
- 0 errors, 3 known warnings (baseline)
- Build green

### Playwright walk
- <Y>/18 checks pass (artifacts in verification/e6/)

### Cloud Function deploy verification
- firebase functions:list shows setAgentOfMonth, getAgentOfMonthCandidates
- Cloud Functions committed but NOT YET DEPLOYED to production
- Deploy command for Kelsean post-merge:
  firebase deploy --only functions:setAgentOfMonth,functions:getAgentOfMonthCandidates,firestore:rules

## Out of scope (deferred)
- Traditional API award (no schema field for Rest Assured)
- Quarterly Awards
- Annual Agent of the Year
- Push notifications when AOM announced
- Historical AOM view for agents
- Service account key cleanup (separate small PR — gcloud installed)

## Awaiting Kelsean
- Spot-check screenshots from verification/e6/
- Manual smoke on Vercel preview, then production after merge
- Test the manager workflow end-to-end (select winners, approve, see on kiosk)
- After merge: deploy CFs + firestore rules per command above

## Strike count
- 1/2 going in (carries from E5/E5.1)
- 1/2 going out (clean session) OR 2/2 if any unilateral scope-narrows
```

**STOP. Do NOT merge.** New schema + new CFs + new manager workflow — requires Kelsean review.

---

## Hard stops (any → surface and wait)

- Phase 2 activity field schema differs unexpectedly → surface
- Phase 2 manager dashboard tab pattern conflicts with new tab requirements → surface
- Phase 3 Cloud Function deploy fails locally via emulator → surface
- Phase 5 panel layout breaks at 1920×1080 with three large avatars → surface
- Phase 8 Playwright walk fails on core checks (1-2, 4, 6-9, 14, 17) → STOP, document, surface
- Network down for `git fetch` → STOP and surface (E5.1 lesson — do not branch from stale local state)
- Two strikes hit (counter at 2/2 — already at 1/2 going in) → STOP regardless of phase
- Any unilateral scope-narrow on a stakeholder-flagged decision → STOP

## Success states

**Best:** PR open with green CI, Playwright 16-18/18, AOM panel rendering correctly with three winners on Vercel preview, manager flow tested end-to-end, awaiting Kelsean review + post-merge CF deploy.

**Acceptable:** PR open with 14-18/18 Playwright (some selector issues tolerable per E5.1 precedent), all features working per manual smoke, awaiting review.

**Acceptable with note:** Phase 8 Playwright partially deferred per time-window scope-cut. Manual smoke acceptable substitute. Document gap explicitly in PR description.

**Stopped:** Architectural blocker, schema mismatch, or scope concern → state-dump for direction.

---

## Notes for CC

- **Strike counter starts at 1/2 — carries over from E5/E5.1.** One more unilateral scope-narrow and this session hits hard stop.
- **The "managers insist" / stakeholder-flagged language is non-negotiable.** When the brief flags a decision as locked or stakeholder-driven, that scope cannot be narrowed without surfacing.
- **NO EMOJIS RULE continues** — Phase 8 walk includes the cross-cutting DOM scan; this is the third PR enforcing this discipline.
- **Animations are SUBTLE not flashy** — same standard as E5.1.
- **Reuse aggressively** — Avatar (with new 'aom' size), RankedLeaderboard, computations.js, ProductionTable, Tab patterns from KioskModeTab. This is a new feature but borrows heavily from existing infrastructure.
- **Trust-but-verify discipline:** PR description must include explicit X/18 walk count and what failed and why.
- **Lint after every commit that adds files** (project-permanent).
- **For "unexpected token" errors:** check syntax balance in surrounding code FIRST.
- **Cloud Function exports verified via `firebase functions:list`** before declaring Phase 3 done.
- **Service account key cleanup is OUT OF SCOPE** — that's a separate small PR Kelsean handles after gcloud install.
- **Network down on `git fetch` triggers STOP-and-surface** — do not branch from potentially stale local state (E5.1 lesson).
- **Edit window logic timezone awareness** — use UTC for monthKey computation OR document clearly which timezone applies. Insurance offices in TT operate AST/UTC-4. Confirm in discovery.
- **Discovery before code** — Phase 2 confirms activity field names AND manager dashboard tab pattern. The Phase 4-5 specs are illustrative; real findings from schema take precedence.
