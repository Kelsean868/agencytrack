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
- fix: firestore rules rewritten with UID bypass for super_admin (4GeeZbhZBwdtGOLoJoggf4MQo142)
- fix: custom claims set via Admin SDK script (role: super_admin, tenantId: tatillife_south)
- fix: MasterSheet dual schema support — extractFields() normalises flat wizard, old flat, and nested step1–9
- fix: MasterSheet queries submissions directly, no users collection dependency
- fix: CompliancePanel graceful empty state when users collection is empty
- fix: PersistencyPanel graceful empty state message
- fix: WizardForm silent skip on auto-save for submitted reports
- seed: super admin user doc created at tenants/tatillife_south/users/4GeeZbhZBwdtGOLoJoggf4MQo142
- seed: tatillife_south confirmed as canonical tenantId
- polish: agent name display — full fallback chain (agentName → displayName → userName → users lookup → Agent + last6 UID)
- polish: extractFields() updated — nested schema detection by step1/step2, flat branch covers both current wizard and legacy field names
- polish: formatCurrency updated — minimumFractionDigits: 0 (TTD 5,000 not TTD 5,000.00)
- polish: MeetingMode uses extractFields() for all submission schemas; same name chain as MasterSheet
- seed: seed-agent-names.cjs back-fills agentName onto existing submissions without it
- `e0af086` — polish: agent name display fixed in MeetingMode
- `dc10bd6` — fix: meeting mode agent name resolved correctly (submissionService now writes agentName; ManagerDashboard enriches submissions before passing to MeetingMode)
- `1bf19bb` — feat: full KPI set + dual meeting mode (group + 1on1) — MasterSheet 23-col sticky table; extractFields.js shared utility; MeetingMode Group/1-on-1 toggle with coaching ratios + self-eval bars
- **Phase 4 COMPLETE — all features verified working**

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
- Fixed overlay, `bg-ink` (#28251d), z-50
- Mode toggle pill in top bar: 📊 Group (default) / 🔍 1-on-1
- Top bar: `grid grid-cols-3` — slide counter | mode toggle | close button
- Slide flow: Summary → one slide per agent (alphabetical) → Closing
- Summary slide: Total API, Apps Sold, Avg Closing %, Submission rate
- Agent slide (Group): 9-stat 3×3 grid (Prospect.Touches/Tel/F2F/Qual.App/FFI/Solutions/CI/Apps/API), status badge, closing ratio badge
- Agent slide (1-on-1): Group stats + 8 coaching ratio cards (2×4) + 5 self-eval rating bars (1–10) + eval notes
- Outlier flag ⚠️: any field > 3× unit average; visible ONLY in 1-on-1 mode
- Navigation: arrow buttons (56px), keyboard ArrowLeft/ArrowRight/Escape, Tailwind dot indicators, slide counter

#### New Utilities and Services
- `src/utils/dateHelpers.js` — `getMostRecentSunday()`, `getLastNSundays(n)`
- `src/services/managerService.js` — `getWeeklySubmissions(weekStarting)`, `getTenantUsers()`
- `src/services/persistencyService.js` — `getMonthlyPersistency(year, month)`, `savePersistencyBatch(entries, enteredBy)`

---

## Upcoming — Phase 5
- Notifications (in-app + email via Firebase Cloud Functions)
- Career Portal (agent level progression 1–7)
- Gamification layer (Leaderboard, BadgeGrid) — separate from official Tatil Life career levels

## Upcoming — Phase 6
- Deploy polish + performance
- Code splitting (chunk size optimisation)
- Power BI integration (post-launch / future)
