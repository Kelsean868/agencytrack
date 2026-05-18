# E5 — TV Display Kiosk Mode

## Source

- Spec: `docs/Track-E-Specs.md` §E5
- Foundation:
  - PR #72 — E4 Production Report (three role-based views, computation utilities, reusable components)
  - All earlier Track E work shipped
- Planning decisions (May 9 2026, with Kyron):
  - **Auth:** token-based kiosk URL — manager generates URL with embedded tenant token, pastes in TV browser
  - **Panel rotation:** 8 panels, multi-panel auto-rotation
  - **Rotation timing:** variable per panel (data-heavy panels longer, branding shorter)
  - **Time period per panel:** mixed — different panels show different periods (week / monthly / quarterly / running totals) per their semantics
  - **Refresh:** poll every 5 minutes
  - **URL generation:** "Kiosk Mode" tab on manager dashboard, branch_manager+ only
  - **Cadence context:** Friday submissions / Monday meetings — Last Week Recap panel makes the kiosk Monday-meeting-ready without time-based logic
  - **Agent avatars:** circular profile photo next to name on agent panels, with initials fallback if photo doesn't exist or fails to load

## Scope

### IN — this PR

1. Token-based kiosk auth (Cloud Function or middleware that validates tenant tokens)
2. Public route `/kiosk/{tenantId}/{token}` (no app shell, no auth UI, full-screen)
3. KioskShell component — full-screen container, auto-rotation, panel transitions, polling
4. **Avatar component** — circular profile photo with initials fallback (used across panels)
5. 8 panel components:
   - BranchOverviewPanel (this week — totals + week-over-week delta)
   - UnitLeaderboardPanel (this week — units ranked by avg API per agent)
   - AgentLeaderboardPanel (this week — all agents, responsive 1/2-column layout, sub-panels for 51+, **avatars beside names**)
   - **RunningTotalsPanel** (MTD + YTD per agent — **avatars beside names**)
   - LastWeekRecapPanel (just-completed week — totals + top 3 performers, **avatars on top 3**)
   - AwardsWatchPanel (monthly + quarterly — agents close to qualifying, **avatars beside names**)
   - CompliancePanel (this week — submission rate, agents on track / behind, no avatars)
   - WelcomePanel (branch name + week starting + clock — resting state)
6. Manager-side "Kiosk Mode" tab on ManagerDashboard:
   - Visible to branch_manager, sales_manager, tenant_admin, platform_admin (not unit_manager — branch-scoped feature)
   - Shows current kiosk URL with copy-to-clipboard button
   - "Revoke and regenerate" button if URL leaks
   - Token storage in Firestore (`tenants/{tid}/kioskTokens/{tokenId}`)
7. Vitest unit tests for token validation, panel components, rotation logic, Avatar fallback
8. Playwright walk against Vercel preview verifying the kiosk URL flow + panel rotation

### OUT — deferred

- Audio/sound effects (silent display per spec)
- Real-time Firestore listeners (polling per Decision 5)
- Multi-tenant kiosks (one URL = one tenant; different branches get different URLs)
- Custom branding per branch beyond branch name (logos, colors — post-pilot polish)
- Touch/click interaction on kiosk (auto-rotate only; no manual advance UI)
- Per-panel "freeze" toggle for managers (post-pilot if requested)
- **Profile photo upload UI** (if photos don't yet exist as a feature — kiosk uses initials avatars only, photo upload becomes a separate follow-up feature)

## Discipline gates

- Single-branch PR rule
- Fetch-first
- Two-strike counter starts at 0/2 (fresh session)
- No auto-merge — substantial new feature with public route + Cloud Function
- Phases produce intermediate state. Stop and surface between phases if running long
- **Public route safety check:** the kiosk URL is intended to be world-readable when token is valid. Token must scope strictly to a single tenant's read-only data. STOP and surface if any path could leak data across tenants
- Bundle CONTEXT.md sync into Phase 1 first commit (HEAD will be at PR #72's merge — confirm)
- **Lint + tests after EVERY commit that adds files** (lesson from E4 walk-script lint miss)

---

## Phase 1 — Sync + worktree

```
git fetch origin --prune
git checkout main
git pull origin main
git log origin/main --oneline -5   → HEAD should be PR #72 merge
```

Bundle CONTEXT.md sync into first commit:
- HEAD bumped to current
- PR #72 added to "Recently shipped"
- Active follow-up row → E5 in progress
- "Where we left off" → E5 starting; E4 fully shipped

Branch: `feat/e5-kiosk-mode`
Worktree: `.claude/worktrees/feat-e5-kiosk-mode`

---

## Phase 2 — Discovery

Read these completely before writing code. Output to `docs/e5-discovery-notes.md`:

### Routing infrastructure
- `src/App.jsx` (or wherever routes are defined) — how routes are configured, whether there's a "no auth" route pattern
- Existing auth gate component — confirm it's bypassable for `/kiosk/*` paths

### Profile photo discovery — critical for avatars
- Read user doc schema in `functions/index.js` — `buildDocFields` function and CSV bulk-import schema
- Search codebase for `photoURL`, `profilePhoto`, `avatar`, `photo` field references
- Check `src/components/profile/` for any profile photo display or upload code
- Check Firebase Storage rules for `/profilePhotos/` or similar path
- Determine which scenario applies:
  - **(a) Photos already exist** — `photoURL` field on user doc, Firebase Storage backed. Avatar component consumes it.
  - **(b) Field exists but unused** — schema supports it but no upload UI. Avatar shows fallback for everyone, ready to display photos when uploaded.
  - **(c) Photos don't exist as a feature** — Avatar uses initials-only for v1. Profile photo upload becomes a documented follow-up.

Document the scenario in discovery notes.

### Token storage + validation
- Existing patterns for Firestore-backed tokens (likely none — this is new)
- Firebase Admin SDK token verification patterns in `functions/index.js` (existing CFs use `context.auth.token` for callables; kiosk needs server-side token check)

### E4 components to reuse
- `src/components/productionReport/ProductionTable.jsx` — for branch overview + last week recap
- `src/components/productionReport/RankedLeaderboard.jsx` — for unit + agent leaderboards (will need TV-sized variant + avatar slot)
- `src/lib/productionReport/computations.js` — period boundaries, ranking, aggregates (reuse all four periods: week, MTD, quarter, YTD)
- `src/utils/extractFields.js` — totalProductionCredit, totalCommission helpers
- `src/utils/awardsEngine.js` — for awards watch panel data
- `src/components/awards/DataSourceBadge.jsx` — display data source

### Existing dashboard tab pattern
- `src/components/dashboard/ManagerDashboard.jsx` — the new "Kiosk Mode" tab follows the same pattern as the Production Report tab from E4

### Firestore rules
- `firestore.rules` — current rules for kiosk tokens collection. New collection `tenants/{tid}/kioskTokens/{tokenId}` needs additive rules:
  - Manager-tier roles: read + create + delete (revoke)
  - Public reads via Cloud Function only — direct client reads denied
  - Validation function reads via Admin SDK (bypasses rules)

### STOP conditions

- Routing infrastructure doesn't support unauthenticated routes cleanly — surface; may need refactor
- Existing public-data path exists (e.g., previous public sharing feature) that conflicts with token approach — surface
- Firestore rules architecture doesn't support per-collection cross-cutting reads — surface

---

## Phase 3 — Avatar component + Token validation Cloud Functions

### `src/components/kiosk/Avatar.jsx`

Reusable avatar component, used across all panels showing agent names.

```javascript
// Props:
//   agent: { uid, name, photoURL? }
//   size: 'sm' | 'md' | 'lg' | 'tv'  (different sizes for different panels)
//
// Behavior:
//   - If photoURL present and image loads: display circular photo
//   - If no photoURL OR image fails to load: display initials avatar
//   - Initials: first letter of first name + first letter of last name
//   - Background color derived from hash of agent.uid (consistent per agent)
//   - 'tv' size: 60px diameter (visible from across the room)
//   - 'lg' size: 48px (top-3 callouts)
//   - 'md' size: 32px (general use)
//   - 'sm' size: 24px (compact lists)
```

Tests (vitest):
- Renders photo when URL provided and loads successfully
- Falls back to initials when URL missing
- Falls back to initials when image fails to load (onError handler)
- Initials computed correctly: "Sarah Williams" → "SW"
- Single-name handling: "Cher" → "C"
- Empty/whitespace name: shows neutral placeholder, no crash
- Hash-based color: same UID always produces same color across renders

### Schema: `tenants/{tenantId}/kioskTokens/{tokenId}`

```javascript
{
  tokenId: string,           // random 32-byte hex
  tenantId: string,
  branchId: string,          // scoped to a single branch
  createdBy: string,         // manager UID
  createdAt: timestamp,
  expiresAt: timestamp,      // default: createdAt + 1 year (renewable)
  revokedAt: timestamp | null,
  lastUsedAt: timestamp | null,
}
```

### New Cloud Function: `validateKioskToken`

```javascript
// HTTP-callable (not callable — public route)
exports.validateKioskToken = functions.https.onRequest(async (req, res) => {
  // CORS handling for cross-origin TV browsers
  // GET /validateKioskToken?tenant={tid}&token={tokenId}
  // Returns: { valid: bool, tenantId, branchId, expiresAt }
  //   or 401 with reason: { valid: false, reason: 'expired' | 'revoked' | 'invalid' }
  // Updates lastUsedAt on each successful validation
});
```

### Manager-callable functions

```javascript
// Callable
exports.createKioskToken = functions.https.onCall(async (data, context) => {
  // Validates caller role: branch_manager+
  // Generates cryptographic random tokenId
  // Writes to kioskTokens
  // Returns: { tokenId, kioskUrl }
});

exports.revokeKioskToken = functions.https.onCall(async (data, context) => {
  // Validates caller role: branch_manager+
  // Sets revokedAt timestamp
});
```

### Re-export from `functions/index.js`

**Critical step (lesson from E6 aggregator miss):**

```javascript
exports.validateKioskToken = require('./kiosk/validateToken').validateKioskToken;
exports.createKioskToken = require('./kiosk/createToken').createKioskToken;
exports.revokeKioskToken = require('./kiosk/revokeToken').revokeKioskToken;
```

**Verification step before proceeding:** run `firebase functions:list` from the worktree (after `npm install` in functions/) — all three new functions must appear before continuing to UI work.

### firestore.rules updates

Additive widening only (per CLAUDE.md additive-rules policy):

```
match /tenants/{tenantId}/kioskTokens/{tokenId} {
  allow read, write: if isManagerOrAbove(tenantId);
  // Cloud Function validateKioskToken bypasses rules via Admin SDK
}
```

Deploy rules pre-merge per project precedent.

### Token tests

Vitest:
- Token generation produces 32-byte hex
- Expired token returns valid=false, reason='expired'
- Revoked token returns valid=false, reason='revoked'
- Valid token updates lastUsedAt
- Cross-tenant validation: token for tenant A cannot validate against tenant B

### STOP conditions

- Cloud Function deploy fails locally via emulator
- Firestore rules can't be expressed cleanly — surface
- Avatar discovery surfaces architectural concern — e.g., photoURL field exists in unexpected shape — surface

---

## Phase 4 — KioskShell + routing

### Public route: `/kiosk/:tenantId/:token`

Bypasses normal auth gate. Initial component fetches `validateKioskToken` HTTP endpoint with the token. If valid, renders `KioskShell`. If invalid, shows "Display unavailable — contact your manager" message.

### KioskShell.jsx

Full-screen container. Manages:
- Current panel index (rotates through 8 panels)
- Panel-specific timing (variable per panel, hardcoded config)
- Polling timer (5-minute data refresh, separate from panel rotation)
- Smooth crossfade between panels
- Branch data state (fetched once on mount, refreshed on poll)

Panel timing (hardcoded in `kioskConfig.js`):
```javascript
export const PANEL_DURATIONS = {
  branchOverview: 30,    // seconds
  unitLeaderboard: 35,
  agentLeaderboard: 50,  // longer because all agents
  runningTotals: 35,     // MTD + YTD per agent
  lastWeekRecap: 30,
  awardsWatch: 30,
  compliance: 25,
  welcome: 15,           // shortest — resting state
};
// Total cycle: 250s ≈ 4.2 minutes
```

Polling: every 300 seconds (5 minutes), refetch branch data. Spinner not shown — silent background refresh.

### Tests

Vitest:
- Rotation cycles through all 8 panels in order
- Each panel shows for its configured duration
- Polling triggers data refresh on schedule
- Invalid token shows error state

### STOP conditions

- Auth gate refactor needed to support public routes — surface, may need separate small PR first

---

## Phase 5 — Panel components

Build each panel component. TV-sized — designed for 1920×1080 viewing at 6-10 feet distance. Larger fonts, more whitespace, no hover states (no mouse).

### BranchOverviewPanel
- Big numbers: Total API, Total Apps, Avg API per agent
- Week-over-week delta: arrow + percentage
- Currency in TTD with thousand separators

### UnitLeaderboardPanel
- Reuses RankedLeaderboard with `tvSize` variant
- Each row: rank | unit name | total API | avg API per agent
- All units in branch shown
- Highlight top unit with subtle accent
- No avatars (units not agents)

### AgentLeaderboardPanel
- Responsive layout per agent count:
  - ≤10 agents: single column, large font (~32px row text), Avatar size='lg'
  - 11-50: 2-column, evenly split (~24px row text), Avatar size='tv' (60px)
  - 51+: 2-column with sub-paneling (page 1: agents 1-50, page 2: 51+, auto-advance every 25s within the panel), Avatar size='tv'
- Each row: **avatar** | rank | name | this week API | apps
- Sorted by API rank, ties broken by apps then name (matches E4 ranking)

### RunningTotalsPanel — NEW
- Header: "Running Totals — May 2026" (current month + YTD)
- Same responsive layout as AgentLeaderboardPanel
- Each row: **avatar** | rank | name | MTD API | YTD API
- Sorted by YTD (most cumulative measure)
- Subtle column headers indicating MTD and YTD periods
- All agents in branch shown

### LastWeekRecapPanel
- Header: "Last Week — [date range]"
- Big totals: API, Apps
- Top 3 performers: **avatar (lg)** | name | API
- Small "Submitted by Friday" badge if all-submitted, else "X of Y submitted"

### AwardsWatchPanel
- Two columns: Monthly Awards | Quarterly Awards
- Each column: agents currently close to qualifying (within 80% of threshold)
- Each row: **avatar (md)** | agent name | award name | progress bar | "X away"
- Empty state: "No agents in qualifying range"

### CompliancePanel
- Big number: "X of Y agents submitted"
- Visual progress bar
- List of agents not yet submitted (this week) — names only, no avatars (lighter visual treatment, no shaming-style emphasis)

### WelcomePanel
- Branch name large
- Current week starting (Sunday date)
- Live clock (HH:MM, updates every second)
- Subtle Tatil branding (existing theme colors only — no new logos)

### Tests

Vitest for each panel:
- Renders with empty data gracefully (no crashes)
- Renders with realistic data
- Avatar fallback works when photoURL missing or fails to load
- Mobile viewport sanity check (kiosk is TV-sized, but components should not break in narrow viewports for development)

### STOP conditions

- A panel needs data that doesn't exist yet (e.g., week-over-week deltas if not pre-computed) — surface, may need small computation utility addition
- TV-size variants of E4 components require complex restyling — surface, may need to add new variant prop to existing components
- Avatar component needs adjustments based on actual photoURL discovery — small iteration is fine; major rework should surface

---

## Phase 6 — Manager Kiosk Mode tab

### Visibility
- branch_manager, sales_manager, tenant_admin, platform_admin: tab visible
- unit_manager: tab hidden (kiosk is branch-scoped, not unit-scoped)
- agent: tab hidden

### Layout

```
┌─────────────────────────────────────────────────┐
│  Kiosk Mode                                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  Display URL for office TVs                      │
│  ┌──────────────────────────────────────────┐   │
│  │ https://agencytrack.vercel.app/kiosk/    │   │
│  │ tatillife_south/abc123...                │   │
│  └──────────────────────────────────────────┘   │
│  [Copy URL]                                      │
│                                                  │
│  Created: May 9 2026 by Kyron Marchan            │
│  Expires: May 9 2027                             │
│  Last seen: 2 minutes ago                        │
│                                                  │
│  [Revoke and regenerate]                         │
│                                                  │
│  Setup instructions:                             │
│  1. Copy the URL above                           │
│  2. On the office TV, open a browser            │
│  3. Paste the URL — display starts automatically │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Behavior
- On first load (no token exists for this branch): "Generate kiosk URL" button
- After generation: shows the URL + metadata
- Revoke prompts confirmation: "This will disable any TV currently displaying this URL. Continue?"

### Tests

Vitest:
- Tab hidden for unit_manager and agent roles
- Generate URL calls createKioskToken
- Revoke calls revokeKioskToken with confirmation
- Display shows correct metadata after generation

---

## Phase 7 — Tests + lint + build

```
npm test     → all green
npm run lint → 0 errors, 3 known warnings OK (AgentAwardsPanel + GoalsPanel)
npm run build → green
```

**Run lint AGAIN after Phase 8 commits any new walk script files** (E4 lesson — lint can pass mid-PR but fail after later commits add files).

---

## Phase 8 — Playwright walk

Create `scripts/verification/e5-walk.mjs` based on `e1-slice-2b-walk.mjs` patterns. Top-level await safety: confirm parens balanced before commit (E4 lesson).

### Required checks

1. Login as branch_manager → ManagerDashboard shows Kiosk Mode tab → click → screenshot
2. Generate kiosk URL → URL appears with metadata → screenshot
3. Open kiosk URL in incognito context (no auth) → KioskShell renders → screenshot
4. Wait 30s → first panel transitions to second panel → screenshot of each
5. Cycle through all 8 panels → screenshot of each (8 screenshots)
6. Branch overview panel: data matches MasterSheet for branch → assertion via Admin SDK fetch
7. Agent leaderboard panel: all branch agents present → assertion (count check)
8. **Running totals panel: agents shown with MTD + YTD values, avatars rendering (photo or fallback)** — screenshot
9. Last week recap panel: shows previous week's data, not current — assertion
10. Revoke URL from manager view → kiosk URL now shows "Display unavailable" → screenshot
11. Mobile (380px) — kiosk URL accessed on phone — should still render but with smaller text → screenshot
12. Dark mode — kiosk display in dark mode (default for kiosk regardless) → screenshot

Save artifacts to `verification/e5/`.

### STOP if checks 1-3, 5, 7-8, or 10 fail

Mobile rendering (11) is flag-don't-stop. Other checks are core functionality.

### Lint check after walk script committed

```
npm run lint
```

Must be 0 errors. If walk script introduces top-level await issues, wrap in async IIFE OR check for unclosed parens (E4 root cause was missing closing paren, not actual top-level await issue).

---

## Phase 9 — Open PR + STOP

### PR title

```
feat(e5): tv display kiosk mode — token-based public route, 8-panel rotation
```

### PR description

```
## Summary
E5 — TV Display Kiosk Mode. Office TV displays for the Friday/Monday meeting cadence.
Token-based kiosk URL generated by managers, pasted into TV browser, no auth needed
on the TV side.

8 panels auto-rotating: Branch overview / Unit leaderboard / Agent leaderboard
(all agents) / Running Totals (MTD + YTD per agent) / Last Week Recap (Monday meeting
context) / Awards watch / Compliance / Welcome.

Agent avatars on leaderboard panels — real photos when available, initials fallback
otherwise.

Per docs/Track-E-Specs.md §E5 + planning decisions May 9 2026.

## What ships

### Cloud Functions
- validateKioskToken (HTTP, public, validates tenant tokens)
- createKioskToken (callable, branch_manager+)
- revokeKioskToken (callable, branch_manager+)
- All three exported from functions/index.js — verified via firebase functions:list

### Routing
- New public route /kiosk/:tenantId/:token bypasses auth gate
- KioskShell with auto-rotation + 5-minute polling

### Panel components (8)
- BranchOverviewPanel, UnitLeaderboardPanel, AgentLeaderboardPanel,
  RunningTotalsPanel (MTD + YTD), LastWeekRecapPanel, AwardsWatchPanel,
  CompliancePanel, WelcomePanel
- All TV-sized (1920×1080 viewing distance), reuse E4 computations + extractors

### Avatar component
- Circular profile photo with initials fallback
- Photo discovery scenario: [a/b/c per discovery notes]
- Used on Agent leaderboard, Running Totals, Last Week Recap top 3, Awards watch

### Manager UI
- New "Kiosk Mode" tab on ManagerDashboard
- Visible to branch_manager+; hidden for unit_manager and agent
- URL generation, copy, revoke flow

### Schema
- New collection: tenants/{tid}/kioskTokens/{tokenId}
- firestore.rules additive widening for kiosk token reads/writes

## Verification

### Vitest
- <X> tests pass (new tests for token validation, panels, rotation, avatar fallback, manager UI)

### Lint + build
- 0 errors, 3 known warnings (baseline)
- Build green

### Playwright walk
- <Y>/12 checks pass (artifacts in verification/e5/)
- Token generation, public route, panel rotation, avatars, revocation all verified

### Cloud Function deploy verification
- firebase functions:list shows validateKioskToken, createKioskToken, revokeKioskToken
- Cloud Functions committed but NOT YET DEPLOYED to production
- Deploy command for Kyron post-merge:
  firebase deploy --only functions:validateKioskToken,functions:createKioskToken,functions:revokeKioskToken,firestore:rules

## Out of scope (deferred)
- Audio/sound effects (silent display per spec)
- Real-time Firestore listeners (polling per Decision 5)
- Touch interaction on kiosk
- Per-panel freeze/manual advance UI
- Custom branding per branch beyond name
- Profile photo upload UI (if photos don't exist as a feature — see discovery notes)

## Awaiting Kyron
- Spot-check screenshots from verification/e5/
- Manual test: generate URL on Vercel preview, open in another browser, verify rotation
- Confirm Avatar discovery scenario matches expectation
- After merge: deploy Cloud Functions + firestore rules per command above
- Test the kiosk URL on a real TV before pilot launch

## Strike count
- 0/2 going in, 0/2 going out — clean session
```

**STOP. Do NOT merge.** Public route + Cloud Function + new schema — requires Kyron review.

---

## Hard stops (any → surface and wait)

- Phase 2 discovery surfaces auth gate refactor needed → surface; may need separate small PR first
- Phase 2 photo discovery surfaces unexpected schema (photoURL exists but with different field name or shape) → surface, ~5 minute confirmation conversation
- Phase 3 Cloud Function patterns conflict with existing functions architecture → surface
- Phase 3 Avatar component requires complex photo loading patterns (e.g., signed URLs, CORS issues) → surface
- Phase 4 KioskShell rotation logic surfaces unexpected complexity → surface
- Phase 5 panel data needs computation utility additions beyond E4's — surface
- Phase 8 Playwright walk fails on core checks (1-3, 5, 7-8, 10) — STOP, document, surface
- Two strikes hit (counter at 2/2) → STOP regardless of phase

## Success states

**Best:** PR open with green CI, Playwright 12/12, all 8 panels rendering correctly with avatars on Vercel preview, awaiting Kyron review + post-merge Cloud Function deploy.

**Acceptable:** PR open with 10-12/12 Playwright (mobile rendering tolerable), all panels working with avatars, awaiting Kyron review.

**Acceptable with note:** Phases 1-7 + 9 ship, Phase 8 Playwright deferred per time-window scope-cut. Manual smoke acceptable substitute. Document gap explicitly in PR description.

**Stopped:** Architectural blocker (auth gate, public route handling, photo discovery surprises) → state-dump for Kyron's direction.

---

## Notes for CC

- **Strike counter resets to 0/2** — fresh session.
- **Public route safety is paramount** — token validation must scope strictly to single tenant. Cross-tenant data leakage is the only thing that matters more than feature completeness. Audit Phase 3 carefully.
- **Verify Cloud Function exports before declaring Phase 3 done** — run `firebase functions:list` from the worktree after `npm install` in functions/. All three new functions must appear. This is the explicit lesson from E6 aggregator miss.
- **Lint discipline:** run `npm run lint` after EVERY commit that adds files. The E4 walk-script lint miss happened because lint passed mid-PR but a later commit added a file with a syntax error. This time, lint after every commit.
- **Top-level await in walk scripts:** the E4 "top-level await" CI failure was actually a missing closing paren on the prior line — ESLint's parser saw the next line's await as a continuation. When debugging "unexpected token" errors, check syntax balance first before assuming parser config issues.
- **Photo discovery is critical for Avatar scope** — Phase 2 must determine which scenario (a/b/c) applies before building Avatar. The fallback path is the same for all three, but the photo-loading path differs. Document the scenario clearly in discovery notes.
- **Reuse E4 aggressively** — RankedLeaderboard, ProductionTable, computations.js (all four periods!), extractFields helpers, awards engine, DataSourceBadge. Don't reinvent. TV-size variants likely need new prop (e.g., `size="tv"`) on existing components rather than new components.
- **Friday/Monday cadence is the design driver** — Last Week Recap panel exists specifically to make Monday meetings work. Don't subtract this panel for "simplicity."
- **Branch-scoped, not tenant-scoped** — the kiosk URL is for one branch's display. Tenant-wide kiosks across multiple branches is out of scope.
- **8 panels, 250s cycle** — that's 4.2 minutes. Don't add a 9th panel without surfacing.
