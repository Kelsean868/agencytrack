# AgencyTrack — App Manual

## Overview
AgencyTrack is an insurance sales activity tracking SaaS built for Tatil Life, Trinidad & Tobago.
Agents submit weekly activity reports. Managers review and track team compliance, production, and persistency.

---

## Phase 1 — Firebase + Auth Setup

### Accepted Commits
- `38305ac` — feat: initial scaffold — React 19 + Vite + Firebase + Tailwind + Nexus design system
- `8cf057c` — fix: add npmrc for legacy peer deps resolution

### What Was Built
- Firebase project initialised (agencytrack-2a610)
- Vite + React 19 project scaffold
- Tailwind CSS with Nexus design system tokens
- Firebase Auth, Firestore, Storage, Functions wired up

---

## Phase 2 — Login + Auth Flow + Agent Dashboard

### Accepted Commits
- `8c1fd13` — feat: Phase 2 complete — auth, dashboards, role display, firestore rules

### What Was Built
- Email link (passwordless) authentication via Firebase Auth
- AuthContext with role-based routing
- AgentDashboard: KPI cards, YTD API progress bar, Submit Weekly Report button
- ManagerDashboard: team stats, compliance rate
- Firestore security rules for users collection
- Nexus design system: CSS variables, `.card`, `.btn-primary` utility classes

---

## Phase 3 — 9-Step Weekly Wizard (Steps 1–8)

### What Was Built
- Full-screen wizard with pill-dot progress indicator
- Date picker: select week starting Sunday (validated), 8 recent Sundays shown
- Auto-save to Firestore (debounced 1.5s), draft/submitted status
- Card Stack UX: shared `CardStack.jsx` exports `Card`, `NumericField`, `CurrencyField`, `ReadOnlyField`, `SuggestedField`
- 8 wizard steps:
  1. Prospecting (letters, seminars, tradeshows, F2F)
  2. Telephone Activity (referral/follow-up/cold/seminar/service calls)
  3. Approaches & FFI (qualified approaches, appointments, FFI scheduled/conducted, presentations)
  4. Closing Interviews & Sales (CI booked/conducted, apps sold, lives, API, commissions)
  5. New Names & Pipeline (referrals, events auto-pull, cold canvass, names pool)
  6. Deliveries & Service (policy deliveries + collapsible service work section)
  7. Time Management (office/field hours with live split bar)
  8. Self-Evaluation (1–10 tap ratings for 5 dimensions + notes)
- Review screen before submit; Done screen after
- Footer nav: Prev (40%) / Next (60%) grid layout
- `submissionService.js`: `saveDraft`, `submitReport`, `getDraft`, `getLastSubmission`
- `validators.js`: `validateSundayDate`, `getRecentSundays`, `formatDateLabel`
- Firestore rules: agents can read/update own submissions, any auth user can create

---

## Phase 4 — Manager Views + Wizard Step 9

### Accepted Commits
- `ff9609e` — feat: phase 4 manager views + wizard step 9
- `245d22e` — fix: firestore rules + wizard re-submit guard
- `5da76a2` — fix: custom claims bootstrap + firestore rules UID bypass

### What Was Built

#### Wizard Step 9 — Next Week Goals
- File: `src/components/wizard/steps/Step9Goals.jsx`
- Fields: `targetDials`, `targetTelContacts`, `targetF2FAttempts`, `targetFFI`, `targetCI`, `targetAppsSold`, `targetAPI` (TTD), `goalNotes` (textarea, 500 char max)
- Summary card: "You're targeting TTD X in API next week" shown when targetAPI > 0
- WizardForm updated to 9 steps; Step 9 in STEPS array, initial data, review section
- submissionService sanitize() extended with all step 9 fields

#### ManagerDashboard Tab Bar
- File: `src/components/dashboard/ManagerDashboard.jsx`
- Tabs: Overview | Master Sheet | Compliance | Persistency
- Overview tab: existing content unchanged
- `selectedWeek` state lifted here, shared to MasterSheet and CompliancePanel as props
- `meetingActive` state triggers MeetingMode overlay
- "Start Meeting" button: fetches submissions for selectedWeek, opens MeetingMode

#### MasterSheet
- File: `src/components/manager/MasterSheet.jsx`
- Props: `{ selectedWeek, setSelectedWeek }`
- Columns: Agent, Status, Dials, Tel Contacts, F2F Attempts, FFI, CI, Apps Sold, API (TTD), Closing %
- API column: green ≥80% of targetAPI, amber 50–79%, red <50%
- Closing ratio: appsSold / ciConducted × 100; shows "—" if denominator is 0
- Controls: week dropdown (last 8 Sundays), agent name search (client-side), Export CSV button
- States: loading skeleton rows, empty, error

#### CompliancePanel
- File: `src/components/manager/CompliancePanel.jsx`
- Props: `{ selectedWeek, setSelectedWeek }`
- Three columns: Submitted (green) / Pending–Draft (amber) / Missing (red)
- Missing agents show "X days since Sunday"
- Summary bar: "X of Y agents submitted · Z missing"
- Shared week selector updates selectedWeek prop

#### PersistencyPanel
- File: `src/components/manager/PersistencyPanel.jsx`
- Month/year selector (defaults to current month)
- Table: agent name + number input (0–100, step 0.1) pre-filled from Firestore
- "Last updated" date shown per agent if record exists
- "Save All" batch-writes to `/tenants/{tenantId}/persistency/{agentId}_{YYYY_MM}`
- Validation: rejects values < 0 or > 100

#### MeetingMode
- File: `src/components/manager/MeetingMode.jsx`
- Props: `{ submissions, selectedWeek, onClose }`
- Fixed overlay, dark background (#28251d), z-50
- Slide flow: Summary → one slide per agent (alphabetical) → Closing
- Summary slide: Total API, Apps Sold, Avg Closing %, Submission rate
- Agent slide: name (2.5rem+), week, 3×2 stat grid (Dials/Tel/F2F/FFI/Apps/API), status badge, closing ratio badge
- Outlier flag: any field > 3× unit average; visible only in MeetingMode, never on agent view
- Navigation: arrow buttons (44px), keyboard ArrowLeft/ArrowRight/Escape, dot indicators, slide counter

#### New Utilities and Services
- `src/utils/dateHelpers.js` — `getMostRecentSunday()`, `getLastNSundays(n)`
- `src/services/managerService.js` — `getWeeklySubmissions(weekStarting)`, `getTenantUsers()`
- `src/services/persistencyService.js` — `getMonthlyPersistency(year, month)`, `savePersistencyBatch(entries, enteredBy)`

---

---

## Phase 4 — Post-Launch Fixes

### What Was Fixed
- **MasterSheet** — switched from users-list-driven to submissions-driven rendering; added `extractFields()` helper to normalise flat wizard schema, old flat schema, and aspirational nested schema; removed dependency on users collection being populated
- **CompliancePanel** — Submitted and Draft columns now populated directly from submissions without needing the users list; Missing column shows "No user list available yet" when users collection is empty; summary bar shows live submitted/draft/total counts
- **PersistencyPanel** — improved empty state copy when users collection is empty
- **AuthContext bootstrap** — fixed `tenantId: 'tatil-life'` hardcode to use the `tenantId` env var (`tatillife_south`)
- **Seed script** — `functions/seed-super-admin-user.cjs` seeds Kyron's user document at `tenants/tatillife_south/users/4GeeZbhZBwdtGOLoJoggf4MQo142`

---

## Upcoming — Phase 5
- Notifications (in-app + email via Firebase Cloud Functions)
- Career Portal (agent level progression 1–7)
- Gamification layer (Leaderboard, BadgeGrid) — separate from official Tatil Life career levels

## Upcoming — Phase 6
- Deploy polish + performance
- Code splitting (chunk size optimisation)
- Power BI integration (post-launch / future)
