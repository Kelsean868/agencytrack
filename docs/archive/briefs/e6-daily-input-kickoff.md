# E6 — Daily Input Mode

## Source

- Spec: `docs/Track-E-Specs.md` §E6
- Foundation:
  - PR #68 — schema utilities, V2 helpers
  - PR #69 — wizard restructure (3-source production capture)
  - PR #70 — surface adaptation, awards V2, PDF redesign
- Planning decisions (May 9 2026, with Kyron):
  - **Daily fields:** numbers (Screens 2 + 3 of weekly wizard) always required, reflection (Screen 4 fields) optional + collapsed by default
  - **Rollup:** Sunday Cloud Function aggregates daily entries into weekly draft; agent reviews + submits manually
  - **Mode switch:** anytime, with **catch-up pattern** for weekly→daily mid-week (locks weekly draft as a single date-stamped catch-up entry, future days log per-day)
  - **UI:** modal from AgentDashboard ("Log today" button)
  - **Nudge:** browser push notification v1 (WhatsApp deferred post-pilot)
  - **Default mode for existing agents:** Hybrid (agent picks per week)

## Scope

### IN — this PR

1. New Firestore subcollection: `dailyActivity` per agent, date-keyed
2. Daily entry modal UI (numbers + collapsed reflection)
3. Sunday Cloud Function aggregator (writes to existing wizard draft path)
4. Mode setting on agent profile (Weekly / Daily / Hybrid, default Hybrid)
5. Mode-switch logic with catch-up entry pattern
6. AgentDashboard adapts CTA based on mode (Log today / Submit weekly / both for hybrid)
7. Browser push notification subscription + service worker push handler
8. Profile field for nudge time-of-day (HH:MM, agent's TT local time, default 17:00)
9. Vitest unit tests for aggregator math + catch-up logic
10. Playwright walk for daily entry + mode switch + aggregated submission

### OUT — deferred

- WhatsApp Business API integration (separate post-pilot item)
- Manager-side daily-entry visibility (managers continue to see weekly submissions; the dailyActivity collection is agent-private)
- Editing past daily entries (v1: upsert per date only; agent re-saving the same date overwrites)
- Backfilling daily entries for past weeks
- Per-day breakdown views in agent history (history shows weekly submissions only)

## Discipline gates

- Single-branch PR rule
- Fetch-first
- Two-strike counter starts at 0/2 (fresh session)
- No auto-merge — substantial new feature
- Phases with stop points; CC stops between phases if complications surface
- **Phase 7 (push notifications) is allowed to defer** if discovery surfaces complex PWA setup beyond brief scope. Core feature (daily entry + aggregator + mode switching) ships without push if needed; push is a follow-up
- Bundle CONTEXT.md sync into Phase 1 first commit (precedent established)

---

## Phase 1 — Sync + worktree

```
git fetch origin --prune
git checkout main
git pull origin main
git log origin/main --oneline -5   → capture HEAD SHA (post-#70)
```

Verify CONTEXT.md HEAD matches actual. Bundle sync into first commit:
- HEAD reference → current
- Add PR #70 to "Recently shipped"
- Active follow-up row: E6 in progress
- "Where we left off" → E6 starting; E1 fully shipped

Branch: `feat/e6-daily-input-mode`
Worktree: `.claude/worktrees/feat-e6-daily-input-mode`

---

## Phase 2 — Discovery

Read these files completely before writing code:

### Wizard / draft system
- `src/components/wizard/WizardForm.jsx` — formData shape, draft save logic, screen flow
- `src/services/submissionService.js` — `saveDraft(uid, agentName, weekStarting, formData, commissionRate)` signature, draft Firestore path
- Identify the exact draft Firestore path (likely `tenants/{tenantId}/drafts/{agentId}_{weekStarting}` or similar)

### User profile
- `src/services/userService.js` (or equivalent) — user doc shape, write methods
- `src/components/profile/CareerPortal.jsx` or wherever profile settings live — pattern for adding new profile fields
- Existing user doc fields — confirm `commissionRate` shape (we know it's percentage-as-number)

### Cloud Functions
- `functions/index.js` — existing function patterns, Firebase Admin init, schedule patterns
- Check if there are existing scheduled functions (cron-style)
- Identify deployment / region config

### PWA + push infrastructure
- `public/manifest.webmanifest` or `public/manifest.json` — confirm PWA is set up
- `public/sw.js` or `src/sw.js` — service worker existence
- `vite.config.js` — PWA plugin config (vite-plugin-pwa)
- Check `package.json` for `firebase/messaging` or web-push dependencies

### Output: `docs/e6-discovery-notes.md`

Document:
- Existing draft path + shape
- User doc field-add pattern
- Cloud Function deployment region + existing schedules
- PWA + service worker state (set up? partial? not at all?)
- Push notification approach decision: Web Push API (native) vs Firebase Cloud Messaging
  - Web Push: free, no backend, requires service worker + VAPID keys
  - FCM: integrates with existing Firebase, requires SDK + setup
  - Choose based on what's lighter given existing project state
  
### STOP conditions

- Wizard draft path is non-trivial (e.g., draft state lives in localStorage, not Firestore — would change aggregator approach)
- No service worker exists and PWA setup is required from scratch — push becomes a much larger sub-project, surface and consider deferring Phase 7
- Existing scheduled Cloud Functions use a pattern incompatible with PubSub schedule (e.g., HTTP-triggered only, requires external scheduler)
- Major Firestore rules conflict (agents can't write to their own user doc, can't write to dailyActivity subcollection)

---

## Phase 3 — Schema + computations

### New file: `src/lib/schema/dailyActivity.js`

```javascript
export const DAILY_ACTIVITY_VERSION = 1;

export function createEmptyDailyEntry(date, agentId, agentName) {
  return {
    version: DAILY_ACTIVITY_VERSION,
    date,                          // 'YYYY-MM-DD'
    weekStarting: getSundayOf(date),  // 'YYYY-MM-DD' (Sunday)
    agentId,
    agentName,
    
    // Numbers (Screen 2 of weekly wizard)
    qualifiedApproaches: 0,
    appointmentsSet: 0,
    ffisScheduled: 0,
    ffisConducted: 0,
    solutionPresentations: 0,
    newCisBooked: 0,
    oldCisBooked: 0,
    cisConducted: 0,
    
    // Production (V2 shape)
    newBusiness: { apps: 0, api: 0 },
    pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums: { grossAmount: 0, apiCredit: 0, commission: 0 },
    
    // Names & Service (Screen 3)
    newNamesAdded: 0,
    oldNamesWorked: 0,
    serviceContacts: 0,
    
    // Optional reflection (Screen 4 fields, optional)
    hoursWorked: null,             // null if not entered
    wins: '',
    blockers: '',
    notes: '',
    
    // Catch-up flag (set by weekly→daily mid-week switch)
    isCatchUp: false,
    catchUpStartDate: null,        // 'YYYY-MM-DD' if catch-up covers Mon-Wed of week
    catchUpEndDate: null,
    
    createdAt: null,               // serverTimestamp on first save
    updatedAt: null,               // serverTimestamp on every save
  };
}

export function getSundayOf(dateStr) {
  // Returns the Sunday that starts the week containing this date
  // Trinidad timezone — but stored as YYYY-MM-DD without offset
  // Implementation: parse date as local, walk back to Sunday
}
```

### New file: `src/lib/schema/dailyActivity.aggregator.js`

```javascript
export function aggregateDailyToWeekly(dailyEntries) {
  // Input: array of dailyActivity docs for a single week
  // Output: V2-shape weeklyReport object suitable for wizard draft pre-population
  //
  // Sum numeric fields across daily entries.
  // For lumpsums: sum grossAmount; recompute apiCredit (10%) and commission (0.5%) from the total
  // For totalProductionCredit and totalCommission: compute from summed sub-objects (not summed from daily totals)
  //   Reason: each day's totalCommission depends on commissionRate; better to compute once at week-level
  //
  // Returns a draft-shaped object the wizard can render
}
```

### Tests: `src/lib/schema/__tests__/dailyActivity.test.js`

Cover:
- `createEmptyDailyEntry` returns correct shape with all defaults
- `getSundayOf` returns Sunday correctly for any weekday input (Mon → prior Sun, Sat → prior Sun, Sun → same Sun)
- `aggregateDailyToWeekly`:
  - Empty array → all zeros
  - Single day with NB only → totals match
  - Three days with NB + LMPS → sums correct, LMPS apiCredit/commission recomputed at total
  - Day with PPP increase → PPP rolls up, totalCommission excludes PPP
  - Catch-up entry handled correctly (its values count toward week totals)
- Boundary: 2 entries for same date (shouldn't happen but test the merge or last-wins behavior)

Run `npm test` — all should pass before moving on.

---

## Phase 4 — Cloud Function: Sunday aggregator

### New: `functions/aggregators/sundayDailyToWeekly.js`

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.aggregateDailyToWeekly = functions.pubsub
  .schedule('every sunday 23:00')
  .timeZone('America/Port_of_Spain')   // Trinidad time
  .onRun(async (context) => {
    const db = admin.firestore();
    
    // 1. Find all tenants
    const tenantsSnap = await db.collection('tenants').get();
    
    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      
      // 2. Find agents in 'daily' or 'hybrid' mode
      const usersSnap = await db.collection(`tenants/${tenantId}/users`)
        .where('loggingMode', 'in', ['daily', 'hybrid'])
        .where('role', '==', 'agent')
        .get();
      
      for (const userDoc of usersSnap.docs) {
        const agentId = userDoc.id;
        const agentName = userDoc.data().name;
        
        // 3. Determine the week being aggregated (this past week, ending today/Sunday)
        const weekStarting = getThisWeeksSunday(); // Sunday at start of week
        
        // 4. Fetch dailyActivity docs for this week
        const dailySnap = await db.collection(`tenants/${tenantId}/agents/${agentId}/dailyActivity`)
          .where('weekStarting', '==', weekStarting)
          .get();
        
        if (dailySnap.empty) continue; // No daily entries this week, skip
        
        // 5. Aggregate
        const dailyEntries = dailySnap.docs.map(d => d.data());
        const aggregated = aggregateDailyToWeekly(dailyEntries);
        
        // 6. Write to draft path (existing wizard reads from this)
        const draftRef = db.doc(`tenants/${tenantId}/drafts/${agentId}_${weekStarting}`);
        const existingDraft = await draftRef.get();
        
        await draftRef.set({
          ...existingDraft.data(),         // preserve any agent-edited fields
          ...aggregated,                   // override numerics with aggregated values
          aggregatedFromDaily: true,
          aggregatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        // 7. (Optional) Send a notification: "Your week is ready to review and submit"
        // Defer to Phase 7
      }
    }
    
    return null;
  });
```

### Tests: `functions/__tests__/sundayAggregator.test.js`

Use Firebase Functions test SDK. Test:
- Aggregator only processes agents in 'daily' or 'hybrid' mode (skips 'weekly')
- Aggregator writes to draft path with merge: true (preserves existing edits)
- Aggregator handles empty daily entries gracefully (no draft write)
- Aggregator computes correct totals matching `aggregateDailyToWeekly` pure function

### Local run + manual test

CC verifies the function deploys cleanly via `firebase functions:shell` or `firebase emulators:start`. Don't deploy to production from this PR — function deployment happens after merge.

### STOP conditions

- Existing functions use a different schedule pattern (e.g., HTTP triggers + external cron) that conflicts with PubSub schedule
- Firestore rules block the aggregator's writes (admin SDK should bypass rules but verify)

---

## Phase 5 — Daily entry modal UI

### New: `src/components/daily/DailyEntryModal.jsx`

Behavior:
- Opens when "Log today" clicked from AgentDashboard
- Pre-fills with today's date (TT local time)
- If a `dailyActivity/{today}` doc exists → loads existing values (upsert, agent can re-edit same day)
- Numbers section always visible, mirrors weekly wizard's Step 2 + 3 layout
- Reflection section collapsed by default with `+ Add reflection` button
- Submit writes to `tenants/{tenantId}/agents/{agentId}/dailyActivity/{today}`
- Dismiss / close: standard modal behavior, autosave on field-blur if values entered

Layout:

```
┌────────────────────────────────────────────────┐
│  Log today — Tuesday, May 12 2026          ×   │
├────────────────────────────────────────────────┤
│                                                  │
│  ─── Activity ───                                │
│  Approaches               [    0    ]            │
│  Appointments set         [    0    ]            │
│  FFIs scheduled           [    0    ]            │
│  FFIs conducted           [    0    ]            │
│  Solution presentations   [    0    ]            │
│  New CIs booked           [    0    ]            │
│  Old CIs booked           [    0    ]            │
│  CIs conducted            [    0    ]            │
│                                                  │
│  ─── Names & Service ───                         │
│  New names added today    [    0    ]            │
│  Old names worked today   [    0    ]            │
│  Service contacts today   [    0    ]            │
│                                                  │
│  ─── Production ───                              │
│  Apps written today       [    0    ]            │
│  API today (TTD)          [TTD] [ 0.00 ]         │
│                                                  │
│  + Add PPP increase   + Add lumpsum               │
│  (collapsed sub-sections, same as wizard Step 4) │
│                                                  │
│  + Add reflection (optional)                      │
│  (collapsed; click to expand to Hours/Wins/etc.) │
│                                                  │
├────────────────────────────────────────────────┤
│                       [ Cancel ]   [ Save ]      │
└────────────────────────────────────────────────┘
```

### Reuse wizard primitives

`Card`, `CurrencyField`, `NumericField` already exist. Use them. Don't reinvent.

PPP and Lumpsum sub-sections should mirror the option-b expandable cards from Step 4 (Slice 2A pattern). Copy/reuse the components.

### AgentDashboard CTA adaptation

In `src/components/dashboard/AgentDashboard.jsx`:
- Read `userProfile.loggingMode`
- Render CTA based on mode:
  - `weekly` → existing "Submit weekly report" button only
  - `daily` → "Log today" button only
  - `hybrid` → both buttons, side-by-side or stacked

The "Submit weekly report" button continues to open the existing wizard (no change to wizard).

The "Log today" button opens DailyEntryModal.

### Tests

Vitest:
- DailyEntryModal renders with default empty state
- Filling fields updates state
- Save calls service with correct shape
- Reflection section collapsed by default, expands on click
- AgentDashboard CTA renders correct buttons per mode

---

## Phase 6 — Mode setting + mode-switch logic

### Profile UI — `src/components/profile/CareerPortal.jsx` (or equivalent)

Add a section: "Logging mode"

```
┌────────────────────────────────────────────────┐
│  Logging mode                                   │
│                                                  │
│  ( ) Weekly — submit a single report each week  │
│  ( ) Daily  — log activity each day, review     │
│              + submit weekly                     │
│  (•) Hybrid — pick whichever fits your week     │
│                                                  │
│  Daily reminder time: [  17:00  ]                │
│  We'll prompt you at this time on days you      │
│  haven't logged yet.                             │
│                                                  │
│  [ ] Enable browser push notifications           │
│      (requires permission grant)                 │
│                                                  │
│  [ Save ]                                        │
└────────────────────────────────────────────────┘
```

### User doc additions

```javascript
{
  // ...existing fields
  loggingMode: 'weekly' | 'daily' | 'hybrid',  // default 'hybrid' for new agents
  dailyNudgeTime: '17:00',                      // HH:MM 24h, default
  pushNotificationsEnabled: false,
  pushSubscription: null,                        // Web Push subscription object or FCM token
}
```

### Migration for existing agents

Existing agents in tatillife_south have no `loggingMode` field. Set them to `'hybrid'` per the planning decision (default for existing).

Two approaches:
- **(a) Migration script** — scripts/migrations/2026-05-e6-default-logging-mode.mjs runs once, sets all existing users to hybrid
- **(b) Read-side default** — wherever `loggingMode` is read, default to `'hybrid'` if undefined

Recommend (b). Avoids running another migration. The field gets persisted next time the agent saves their profile.

### Mode-switch logic

When agent saves profile with new `loggingMode`:

**Daily → Weekly mid-week:**
- Sum existing daily entries for current week
- Pre-populate weekly draft with the totals (write to drafts collection)
- No data loss, agent can finish the week in weekly mode

**Weekly → Daily mid-week:**
- Check if weekly draft exists for current week
- If yes: show modal "Your weekly draft will lock as a single 'catch-up' entry. Future days will log per-day. Continue?"
- On confirm:
  - Convert weekly draft to a single dailyActivity doc dated today (or last edited day)
  - Set `isCatchUp: true`, `catchUpStartDate: weekStart`, `catchUpEndDate: today`
  - Delete the weekly draft (or mark it as superseded)
  - Initialize daily mode

**Hybrid mid-week:** no special logic — mode change just expands available CTAs going forward. Existing data on either path stays.

### Tests

Vitest for mode-switch logic:
- Daily → Weekly with 3 daily entries → weekly draft has correct sums
- Weekly → Daily with weekly draft present → catch-up entry created with correct date stamps
- Weekly → Daily with no weekly draft → no catch-up needed, just mode change
- Hybrid switches don't trigger catch-up logic

---

## Phase 7 — Browser push notifications

### Discovery first

Confirm what infrastructure exists from Phase 2 discovery:
- Is `vite-plugin-pwa` installed? Service worker auto-generated?
- Is FCM (Firebase Cloud Messaging) already in use?
- Are VAPID keys already in env config?

Choose approach:

### Option A: Web Push API (recommended for simplicity)

Service worker subscribes via VAPID keys. Backend (Cloud Function) sends push messages via web-push library to subscribed endpoints.

Setup:
1. Generate VAPID key pair (one-time, store private in functions config)
2. Service worker registers and subscribes to push manager
3. Subscription object saved to `users/{userId}.pushSubscription`
4. Cloud Function (separate from aggregator) runs on schedule, checks for agents who haven't logged today, sends push to their subscriptions

### Option B: Firebase Cloud Messaging

Simpler if FCM is already configured. Uses FCM tokens instead of Web Push subscription.

Setup:
1. Add Firebase Messaging SDK
2. Service worker handles FCM push events
3. Token saved to user doc
4. Cloud Function sends via Admin SDK `messaging.send()`

### v1 scope — minimum viable nudge

- Permission prompt in profile when "Enable browser push notifications" toggled
- Subscription saved to user doc
- Cloud Function `dailyNudge` runs every day at agent's nudge time (or hourly, sending to agents whose nudge time matches)
- Notification body: "Have you logged today's activity? Tap to log."
- Click → opens app, navigates to AgentDashboard with daily entry modal pre-opened

### STOP / DEFER for Phase 7

If Phase 2 discovery surfaces:
- No PWA / service worker setup → Phase 7 deferred to follow-up PR. Daily entry feature ships without push.
- Complex existing FCM config that conflicts with new push approach → defer.
- VAPID key management is non-trivial (env propagation issues) → defer.

The core feature (daily entry + aggregator + mode switching from Phases 3-6) ships regardless. Push is a nice-to-have for v1; an in-app dashboard banner ("You haven't logged today") is a fallback that ships in Phase 5 anyway.

---

## Phase 8 — Tests

### Vitest

Should accumulate to ~120+ tests total. New tests in:
- `src/lib/schema/__tests__/dailyActivity.test.js` (Phase 3)
- `src/components/daily/__tests__/DailyEntryModal.test.jsx` (Phase 5)
- `src/components/profile/__tests__/LoggingMode.test.jsx` (Phase 6)
- `functions/__tests__/sundayAggregator.test.js` (Phase 4)

```
npm test
```

All green before push.

### Lint + build

```
npm run lint    (0 errors, 3 known warnings OK)
npm run build   (green)
```

---

## Phase 9 — Playwright walk

Create `scripts/verification/e6-walk.mjs` based on `scripts/verification/e1-slice-2b-walk.mjs` patterns (the latest, has the most accumulated knowledge).

### Required checks (HARD REQUIREMENT)

1. Login as test agent
2. Profile → set logging mode to Daily, set nudge time to 09:00, save → screenshot
3. AgentDashboard now shows "Log today" button (not "Submit weekly report") → screenshot
4. Click "Log today" → DailyEntryModal opens → screenshot
5. Fill numbers (5 approaches, 2 FFIs, 1 sale, $5,000 API), save → screenshot post-save
6. Verify Firestore has dailyActivity doc at today's date with correct values (assertion via Admin SDK or browser-side fetch)
7. Re-open Log today → existing values pre-filled (upsert behavior) → screenshot
8. Switch mode to Weekly mid-week → catch-up modal appears → screenshot
9. Confirm switch → AgentDashboard now shows "Submit weekly report" only → screenshot
10. Verify Firestore: daily entry now has `isCatchUp: true`, weekly draft created with sum from daily entries → assertion
11. Switch back to Hybrid → AgentDashboard shows BOTH buttons → screenshot
12. Mobile (380px) — daily entry modal usable, fields accessible, save works → screenshot
13. Dark mode — daily entry modal renders correctly → screenshot

Save artifacts to `verification/e6-daily-input/`.

### STOP if any of checks 1-7, 9, or 10 fail

Mobile + dark mode (12, 13) failures are flag-don't-stop level.

---

## Phase 10 — Open PR + STOP

### PR title

```
feat(e6): daily input mode — agent cadence choice + Sunday aggregator
```

### PR description

```
## Summary
E6 — Daily Input Mode. Last pre-pilot HIGH item per Path B planning.
Agents can now choose daily, weekly, or hybrid logging cadence. Daily
entries auto-aggregate to a weekly draft on Sunday for agent review +
manual submission.

Per docs/Track-E-Specs.md §E6 + planning decisions May 9 2026.

## What ships

### Schema + utilities
- src/lib/schema/dailyActivity.js — empty entry factory, getSundayOf utility
- src/lib/schema/dailyActivity.aggregator.js — pure aggregation function
- Vitest tests covering all aggregation paths + catch-up handling

### Cloud Function
- functions/aggregators/sundayDailyToWeekly.js — runs every Sunday 23:00 TT,
  aggregates daily entries to weekly draft for agents in daily/hybrid mode
- merge:true preserves any agent-edited weekly draft fields
- Skips agents in weekly-only mode

### UI
- DailyEntryModal — numbers required, reflection collapsed/optional
- Reuses wizard primitives (Card, CurrencyField, NumericField)
- Reuses PPP/Lumpsum expandable sub-sections from Slice 2A

### Profile
- Logging mode setting: Weekly / Daily / Hybrid (default Hybrid for new agents,
  hybrid as read-side fallback for existing agents)
- Nudge time-of-day setting
- Browser push notifications toggle
- AgentDashboard CTA adapts to mode

### Mode-switch logic
- Daily → Weekly: clean (sum dailies, populate weekly draft)
- Weekly → Daily: catch-up entry pattern (weekly draft becomes a dated
  catch-up daily entry, future days log per-day)
- Hybrid: no special logic, both paths available

### Push notifications [Phase 7 — may defer]
[Status: shipped / deferred to follow-up — explain]

## Out of scope
- WhatsApp Business API (post-pilot follow-up)
- Manager-side daily-entry visibility (agent-private)
- Editing past daily entries beyond today (upsert per date only)
- Backfilling daily entries for past weeks

## Verification
- Vitest: <X> tests pass (new tests for aggregation, modal, mode-switch, aggregator)
- Lint + build green
- Playwright walk: <Y>/13 pass (artifacts in verification/e6-daily-input/)
- Cloud Function deploys cleanly via firebase emulator (not deployed to production from this PR)

## Awaiting Kyron
- Spot-check screenshots from verification/e6-daily-input/
- Manual test: switch mode to daily, log a day, switch back, verify catch-up
- Decide deployment timing for the Cloud Function (likely after PR merge,
  before pilot launch)
- Plan pilot launch — last pre-pilot HIGH is now done
```

**STOP. Do NOT merge.** Code change touching live UI + new Firestore subcollection + new Cloud Function — requires Kyron review.

---

## Hard stops (any → surface and wait)

- Phase 2 discovery surfaces wizard draft state in localStorage (not Firestore) — aggregator approach changes
- Phase 4 Cloud Function pattern conflicts with existing functions
- Phase 5 wizard primitives can't be cleanly reused — surface, may need a small refactor PR first
- Phase 6 mode-switch state machine surfaces an edge case not covered by spec (e.g., agent has both weekly draft AND daily entries simultaneously due to data race)
- **Phase 7 (push) discovery surfaces complex PWA/service-worker work** → defer Phase 7, ship rest. Mark explicitly in PR description.
- Two strikes hit (counter at 2/2) → STOP regardless of phase

## Success states

**Best:** PR open with green CI, Playwright 13/13, push notifications working in v1 form, awaiting Kyron review.

**Acceptable:** PR open with 11-13/13 Playwright (mobile or dark mode failures are tolerable), all phases shipped including push.

**Acceptable with note:** Phases 1-6 + 8-10 ship, Phase 7 (push) deferred to follow-up PR. Daily entry + mode switching + aggregator all working; nudge mechanism is dashboard banner only for v1. Pilot can launch with this scope; push is a polish item.

**Stopped:** Two strikes hit, full state dump in chat.

---

## Notes for CC

- **Strike counter resets to 0/2** — fresh session.
- **Phase 7 has explicit defer permission** — don't burn strikes on push notification complexity.
- **Reuse aggressively** — wizard primitives, Slice 2A's expandable card pattern, V2 schema utilities, extractFields helpers all already exist. Don't reinvent.
- **The aggregator is a pure function + a thin Cloud Function wrapper** — keep them cleanly separated for easy testing.
- **Catch-up entry pattern is the cleverest bit** — when in doubt, surface to Kyron; this is the spec, not implementation choice.
- **Pilot launch is the next milestone after E6 ships.** This is the last pre-pilot HIGH. Treat it accordingly.
