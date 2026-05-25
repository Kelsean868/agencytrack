# AgencyTrack Phase 7–8 Design Spec

**Status:** Master design reference. Consolidates all locked decisions from the May 2026 design conversation. Supersedes the prior `AgencyTrack_Phase7_Spec.md`.

**Build timing:** Pilot is currently postponed indefinitely (as of May 14, 2026). No runway pressure — prioritize by value-to-user and architectural cleanliness.

**Companion doc:** `AgencyTrack_Implementation_Plan.md` — covers track sequencing, PR breakdown, dependencies, and recommended order.

---

## 1. Current State Summary

What's already built and shipped (relevant to this spec):

- **E6 logging mode** — daily / weekly / hybrid cadence is in production. `ProfileScreen` has the mode panel, `loggingModeService.js` handles mid-week transitions, `dailyActivityService.js` + `dailyActivity.js` schema hold per-day entries, `sundayDailyToWeekly` aggregator rolls daily up to weekly. Daily nudge banner on `AgentDashboard`.
- **Tenant Admin Dashboard** — shipped in Track B (Design System v2, B5) with Company Config tab. Currently exposes `annualAPI` minimum only; persistency floor and other fields scaffolded but editing deferred.
- **Awards engine** — `awardsEngine.js` consumes weekly submissions + monthly settlements, applies Tatil 2026 rules. Three-state quality badge (Confirmed teal / Estimated amber) on agent surfaces.
- **Manager drill-down (partial)** — Master Sheet → click row → `SubmissionViewer` drawer (single-week snapshot). No full agent-mirror dashboard yet.
- **Goals system (3 tiers)** — Company Floor / Manager Target / Personal Commitment. Plus Tier 2 unit + branch goals (P8C).
- **Settlements layer** — `/tenants/{tid}/settlements/{agentId}_{year}_{periodKey}` for monthly Branch Manager confirmation entry from Tatil circular.
- **Persistency tracking** — aggregate per-agent monthly via `/tenants/{tid}/persistency/{agentId}_{YYYY_MM}`.
- **Roles** — Agent → Unit Manager → Branch Manager → Sales Manager → Tenant Admin → Platform Admin. Post-May refactor: `super_admin` retired, migration complete for `tatillife_south`.

What's deferred or out of scope (relevant to this spec):

- **Multi-tenant config UI** — plumbing exists, full config surface not built (P10 deferred).
- **Pilot prep** — postponed indefinitely.
- **Policy Ledger** — not built.
- **Money Needs Worksheet** — not built.
- **Coaching notes** — not built.
- **At-risk awards view** — not built.
- **Per-agent work schedule (with holidays/vacation)** — not built; logging mode is the closest existing concept.
- **Floating Action Button for daily entry** — not built.

---

## 2. Multi-Tenant Architecture Gap (acknowledged, deferred)

### Status
Multi-tenancy plumbing is built: tenant-scoped Firestore data under `/tenants/{tenantId}/...`, `tenant_admin` role exists with `TenantAdminDashboard.jsx` and Company Config tab (Track B B5), `tenantId` rides in auth claims.

### Gap
The following are hardcoded to Tatil Life and would block a second carrier:
- Awards engine constants in `awardsEngine.js` (Centurion 100 apps, Club tiers, AoY $1M TTD, Monthly $50K/15 apps, persistency gate, time windows)
- Persistency formula (Tatil-specific: `(Placed − NTs) + Inc PPPs + Lumpsums × 0.10`)
- Production credit rules per product type (NB 100%, PPP 100%, Replacement 0%/diff, SPIA 0%/10%, Lumpsum 0%/10%, Platinum Edge 0%)
- Career levels (Tatil's 1-7 / 8-10 progression)
- Wizard terminology (FFI, CI, "Approaches Qualified")
- Branding (Nexus theme is product-level)

### Decision
Don't build full Tenant Admin config UI before a second carrier is in conversation. Two preparation moves:
1. Tag hardcoded Tatil constants with `// TENANT-CONFIG-DEFERRED` comment as a future hit-list
2. Treat `awardsEngine.js` mentally as a Tatil 2026 ruleset, not the engine itself

Track D (Awards Expansion) begins the migration for one slice of this surface.

---

## 3. Track D — Awards Expansion + Ruleset Config Migration

### 3.1 Awards Ruleset Config Migration

Awards rules move from hardcoded constants in `awardsEngine.js` to `/tenants/{tid}/config/awardsRuleset/{year}`.

Schema:

```
{
  year: 2026,
  productionCreditRules: {
    nb_ordinary:    { appsCredit: 1.0, apiCredit: 1.0 },
    inc_ppp:        { appsCredit: 1.0, apiCredit: 1.0, apiMinThreshold: 2400 },
    replacement:    { appsCredit: 0,   apiCredit: 'difference' },
    spia:           { appsCredit: 0,   apiCredit: 0.1 },
    lumpsum:        { appsCredit: 0,   apiCredit: 0.1 },
    platinum_edge:  { appsCredit: 0,   apiCredit: 0 }
  },
  exclusions: {
    selfFamilyPolicies: true
  },
  awards: {
    advisorOfMonth: {
      apiThreshold: 50000, appsThreshold: 15,
      persistencyMin: 0.9, prizes: { 1: 3000, 2: 1500, 3: 500 },
      excludeAgentTypes: ['bdo', 'dso']
    },
    quarterlyAPI:  { threshold: 125000, persistencyMin: 0.9, prize: 3000 },
    quarterlyApps: { threshold: 45, persistencyMin: 0.9, prize: 3000 },
    centurion: {
      appsThreshold: 100, maxIncPpps: 20,
      persistencyMin: 0.9, prize: 10000,
      excludeAgentTypes: ['bdo', 'dso']
    },
    clubTiers: [
      { name: 'Bronze 3', apiMin: 250000, apiMax: 349999, appsMin: 50, prize: 3000 },
      { name: 'Bronze 2', apiMin: 350000, apiMax: 449999, appsMin: 50, prize: 4000 },
      { name: 'Bronze 1', apiMin: 450000, apiMax: 549999, appsMin: 50, prize: 5000 },
      { name: 'Silver',   apiMin: 550000, apiMax: 649999, appsMin: 50, prize: 10000 },
      { name: 'Gold 3rd', apiMin: 650000, apiMax: null, appsMin: 50, prize: 10000 },
      { name: 'Gold 2nd', apiMin: 650000, apiMax: null, appsMin: 50, prize: 12000 },
      { name: 'Gold 1st', apiMin: 650000, apiMax: null, appsMin: 50, prize: 15000 }
    ],
    agentOfYear: { apiThreshold: 1000000, appsThreshold: 50, persistencyMin: 0.9, prize: 40000 },
    rookieOfYear: {
      apiThreshold: 325000, appsThreshold: 52, persistencyMin: 0.95,
      maxIndustryMonths: 18, prize: 12000
    },
    newBs: {
      apiThreshold: 250000, appsThreshold: 52, persistencyMin: 0.95,
      maxCompanyMonths: 18, prize: 1500
    },
    persistencySilver: { apiMin: 250000, appsMin: 45, persistencyMin: 0.92, prize: 1000 },
    persistencyGold:   { apiMin: 250000, appsMin: 45, persistencyMin: 0.95, prize: 1500 }
  },
  defaultPersistencyGate: 0.9
}
```

Same schema applies to manager-tier awards (`agencyOfYear`, `unitOfYear`, `recruitingBronze/Silver/Gold`, `activityBronze/Silver/Gold`, `productionAward`, `monthlyBonusTiers`).

`awardsEngine.js` becomes a pure function: `(submissions, settlements, persistency, ruleset) → awardProgress[]`. No more hardcoded constants.

### 3.2 Awards Parity Expansion

**Current state:** Agent Awards tab shows agent-eligible awards (Advisor of Month, Quarterly, Club tiers, Centurion, Rookie, New B's, Agent of Year, MDRT). Manager Awards tab shows manager-eligible awards (Recruiting, Activity, Production, Persistency, Unit/Agency of Year, Monthly Bonus tiers).

**Manager feedback:** Agent's awards page should be as detailed as the manager's, scoped to agent-eligible awards. Same applies for UM page mirroring BM detail level, scoped to UM-eligible awards.

**Required detail level per award:**
- Current progress (e.g. "78 apps / 100 needed")
- Distance to next tier (e.g. "$45,000 TTD to Silver Club")
- Persistency gate status (current vs required)
- Trend indicator (on pace / off pace based on remaining time)
- Source badge (Confirmed / Agent-tracked / Estimated)
- Prize value when achieved

**Agent's view:** Their own data, all agent-eligible awards.
**UM's view:** UM-eligible awards (Unit Recruiting/Activity/Production/Persistency, Unit of the Year).
**BM's view:** BM-eligible awards (Agency Recruiting/Activity/Production/Persistency, Agency of the Year, Monthly Bonus tier).

### 3.3 At-Risk Awards View (new on BM Awards page)

A new section on the BM Awards page shows agents' status across all agent-eligible awards:

- **Close to achieving** — agents at 80-99% of any threshold, sorted by smallest delta to push them over
- **Just achieved** — agents who hit a threshold this period (coaching moment + celebration)
- **At risk of losing** — agents currently qualifying but trending down (persistency falling toward 92%, app pace slowing)
- **No longer eligible** — agents who fell below a threshold they previously held

Filters: time period (this month / this quarter / this year), specific award, unit.

UM gets the same view scoped to their unit's agents.

**Configurable thresholds** in `config/awardsRuleset/{year}`:
```
atRiskView: {
  closeToAchievingPct: 0.80,  // 80% of threshold
  atRiskTrendWeeks: 4,         // last 4 weeks slowing
  ...
}
```

---

## 4. Track E — Daily Reporting Polish

E6 logging mode infrastructure is built. This track polishes it for production readiness.

### 4.1 Per-Agent Work Schedule

New section on `ProfileScreen` below the logging mode panel:

**Working Days**
- Checkboxes for Mon / Tue / Wed / Thu / Fri / Sat / Sun
- Default: Mon-Fri checked

**Working Hours (optional, informational)**
- Start time + end time
- Used for nudge timing (e.g. "log today" notification at end of work day)

**Holiday Overrides**
- T&T public holidays loaded from `/tenants/{tid}/config/holidays/{year}`
- Each holiday has a checkbox: "I work on this day" (default unchecked)
- Allows agents who do work on holidays to override the auto-skip

**Vacation Periods**
- Date range entries (start date → end date)
- No reporting expected during these ranges
- Free-text label optional (e.g. "Family trip — Tobago")

Stored on user doc:
```
{
  workSchedule: {
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    workingHoursStart: '08:00',
    workingHoursEnd: '17:00',
    holidayOverrides: ['2026-02-16', '2026-08-31'],  // dates agent will work
    vacationPeriods: [
      { start: '2026-07-15', end: '2026-07-29', label: 'Family trip' }
    ]
  }
}
```

### 4.2 T&T Holiday Calendar — Tenant Config

`/tenants/{tid}/config/holidays/{year}`:

```
{
  year: 2026,
  holidays: [
    { date: '2026-01-01', name: "New Year's Day", isFixed: true },
    { date: '2026-02-16', name: 'Carnival Monday', isFixed: false },
    { date: '2026-02-17', name: 'Carnival Tuesday', isFixed: false },
    { date: '2026-03-30', name: 'Spiritual Shouter Baptist Liberation Day', isFixed: true },
    { date: '2026-04-03', name: 'Good Friday', isFixed: false },
    { date: '2026-04-06', name: 'Easter Monday', isFixed: false },
    { date: '2026-05-30', name: 'Indian Arrival Day', isFixed: true },
    { date: '2026-06-04', name: 'Corpus Christi', isFixed: false },
    { date: '2026-06-19', name: 'Labour Day', isFixed: true },
    { date: '2026-08-01', name: 'Emancipation Day', isFixed: true },
    { date: '2026-08-31', name: 'Independence Day', isFixed: true },
    { date: '2026-09-24', name: 'Republic Day', isFixed: true },
    { date: '2026-XX-XX', name: 'Eid-ul-Fitr', isFixed: false },     // variable
    { date: '2026-XX-XX', name: 'Divali', isFixed: false },          // variable
    { date: '2026-12-25', name: 'Christmas Day', isFixed: true },
    { date: '2026-12-26', name: 'Boxing Day', isFixed: true }
  ],
  updatedBy, updatedAt
}
```

Tenant Admin maintains this annually (Eid and Divali shift by year).

### 4.3 Auto-Skip Behavior

System checks each calendar day:
1. Is it in the agent's `workingDays`? If no → skip.
2. Is it in `config/holidays/{year}` AND not in agent's `holidayOverrides`? If yes → skip.
3. Is it within any `vacationPeriods` range? If yes → skip.

Effect of skipping:
- No nudge banner
- No missed-day flag in compliance tracker
- Streak calculation ignores the day (doesn't break the streak)
- Manager dashboard shows "off" status, not "missing"

Agent can still tap the FAB to log activity on a skip day — overrides the skip silently.

### 4.4 Floating Action Button (FAB) for Daily Log

**Design:**
- Bottom-right circular button, 56dp, Nexus teal `#01696f` primary color
- `+` icon (or pencil-on-paper for "add entry")
- Tap → opens bottom sheet (mobile) or modal (desktop) with Daily Log form
- Pre-filled: date = today, agent = current user
- State indicator: small accent dot when today is not yet logged; disappears once logged

**Visibility:**
- All agent portal screens (Dashboard / Career / Awards / Leaderboard / History)
- Manager portal "My Production" tab (UMs and BMs sell, log their own)
- Hidden during forms, modals, confirmation dialogs to avoid double-entry confusion
- Hidden when daily reporting is disabled for the tenant (weekly-only mode)
- Hidden on skip days unless agent explicitly opens it via menu

**Accessibility:**
- ARIA label "Log today's activity"
- Tap target 56dp exceeds 44dp minimum
- Keyboard accessible
- Respects safe-area-insets on mobile (doesn't hide under iPhone home indicator)

### 4.5 Daily Log Form Structure (refinement of existing daily entry modal)

Bottom sheet with collapsible sections. Section 1 and 2 expanded by default; 3 and 4 collapsed.

**Section 1 — Activity (6 fields, expanded)**
- Dials
- Telephone contacts
- F2F attempts
- F2F successful
- FFI conducted
- CI conducted

**Section 2 — Time (2 fields, expanded)**
- Office hours
- Field hours

**Section 3 — Production (3 fields, expand-on-tap)**
- Apps sold
- API written (TTD)
- New prospects added

**Section 4 — Service (3 fields, collapsed)**
- Service calls
- Policies received
- Policies delivered

**Layout:** 2-column grid on mobile so each row is two thumb-tap inputs (Dials | Tel contacts, F2F att | F2F succ, FFI | CI, Office | Field). Compact, scannable.

**Behavior:**
- All eight default-visible fields default to zero
- Agent types only where they have a value
- Number-pad keyboard for every numeric input
- Submit at any time saves what's entered; nothing required below Section 1
- 60-90 seconds for typical entry

### 4.6 Weekly Wrap-up (refined from existing wizard)

The existing 7-step wizard becomes the Weekly Wrap-up surface, reorganized rather than rewritten:

- **Steps 1-4 (activity, production, prospects)** — values aggregated from daily logs, with verify/edit surface so agent confirms or corrects
- **Step 5 (service work)** — stays largely as-is; detailed service breakdown (withdrawals, surrenders, orphan reviews, reinstatements) is reflection-cadence work
- **Step 6 (time management)** — moves to wrap-up with daily hour logs feeding the totals; donut chart preview
- **Step 7 (self-evaluation)** — stays as-is; five 1-10 ratings + free-text notes; weekly cadence makes sense

**Wrap-up is not required for the week to count as "submitted."** Daily logs are sufficient for KPI tracking; wrap-up is optional but recommended. Nudge banner encourages completion; gamification rewards consistent completion (potential "Reflective Week" badge). This is what prevents the cadence shift from creating new friction.

### 4.7 Backfill / Catch-up Flow

Two cases:

- **Agent forgot Tuesday until Friday.** Dashboard surfaces missing-day cards: "You haven't logged Tuesday yet. [Log Tuesday now]" — opens Daily Log form pre-set to Tuesday's date. FAB stays today-only, which keeps it simple.
- **Agent wants to edit a past day's entry.** History tab → click day → opens Daily Log form in edit mode. Audit trail captures the edit.

---

## 5. Track F — Manager Drill-down Dashboards + Coaching Notes

### 5.1 Drill-down Architecture

New route pattern that mirrors agent portal scoped by hierarchy:

- `/manager/agent/:agentId` — full agent-mirror dashboard
- `/manager/unit/:unitId` — unit summary with UM details + agent list
- `/manager/branch/:branchId` — branch summary with unit details + UM list

Permissions:
- **Unit Manager** can access `/manager/agent/:agentId` for agents in their unit
- **Branch Manager** can access agents, units, UMs in their branch
- **Sales Manager** can access any branch / BM / unit / UM / agent in the tenant
- **Tenant Admin** can access everything (audit-logged)

Hierarchical navigation: SM clicks a branch → sees BM's branch view → clicks a unit → sees UM's unit view → clicks an agent → sees agent-mirror dashboard. Breadcrumb across the top.

### 5.2 Agent-Mirror Dashboard (what managers see when they drill into an agent)

Read-only mirror of the agent's full portal, with a "manager overlay":

**Mirror sections (same as agent sees):**
- Dashboard tab — goal carousel, KPI grid, week-over-week, activity feed, badge grid
- Career tab — Commission Playground, Career Level tracker, MDRT progress
- Awards tab — full detail per Track D 3.2 spec
- History tab — submission list
- Production Report tab — same as agent

**Manager overlay (only managers see):**
- Outlier flags (existing concept, surfaced here)
- Peer comparison row: "vs unit average / vs branch average / vs same-tenure cohort"
- Coaching notes section (see 5.3)
- Historic averages: trailing 4w / 12w / 26w / YTD / prior YTD
- "Start 1-on-1 Mode" button → opens Meeting Mode pre-focused on this agent

### 5.3 Coaching Notes

**Schema:** `/tenants/{tid}/users/{agentId}/coachingNotes/{noteId}`

```
{
  noteId: 'auto-uuid',
  agentId,                        // who it's about
  authorUid,                      // who wrote it
  authorRole,                     // 'unit_manager' | 'branch_manager' | 'sales_manager'
  authorName,                     // denormalized for display
  category: 'observation' | 'goal' | 'concern' | 'win' | 'action_item',
  body: 'string',                 // free text, markdown-light
  isPinned: false,                // surface to top
  createdAt: Timestamp,
  updatedAt: Timestamp,
  visibility: 'manager_chain'     // always manager_chain; agent never sees
}
```

**Visibility rule:** Notes are visible to the author's role AND all roles above them in the chain for that agent. UM's note is visible to UM, BM, SM. BM's note is visible to BM, SM. SM's note is visible to SM only. **Agent never sees their own coaching notes** — that's the whole point.

**Firestore rule excerpt:**
```
match /tenants/{tid}/users/{agentId}/coachingNotes/{noteId} {
  allow read, write: if isManagerInChain(request.auth, agentId)
                    && !isAgentSelf(request.auth, agentId);
}
```

**UI:** A "Coaching Notes" card on the agent-mirror dashboard. List of notes, newest first, with pinned notes sticky on top. Filter by category. "Add note" affordance opens a quick-entry modal. Edit/delete own notes only; archive (soft-delete) any note in the manager's scope.

### 5.4 Historic Trends — Aggregation Strategy

Live computation across 100+ agents × 52+ weeks of submissions would be too heavy at view time. Build a nightly Cloud Function aggregator:

**Aggregations collection:** `/tenants/{tid}/aggregates/{agentId}_{periodKey}`

Where `periodKey` is one of: `{YYYY}_{MM}` (monthly), `{YYYY}_Q{N}` (quarterly), `{YYYY}` (annual), `trailing_4w` (rolling 4-week), `trailing_12w` (rolling 12-week), `trailing_26w` (rolling 26-week).

Each aggregate doc contains:
- Totals (apiSold, applicationsSold, ffiConducted, ciConducted, dials, etc.)
- Ratios (closing ratio, FFI-to-CI, CI-to-Sale, etc.)
- Persistency (point-in-time and trailing average)
- Compliance metrics (submissions on time / late / missing)
- Computed at materialization time, not query time

**Refresh strategy:**
- Nightly Cloud Function (Tatil time 02:00) refreshes trailing aggregates
- Triggered by submission creation/update for current-period aggregates
- Versioned with `aggregatedAt` so stale data is detectable

**Visualization:**
- Recharts for sparklines and trend charts
- Per-metric: line chart with trailing 12w + vs prior 12w overlay
- Per-period: bar chart with goal line
- Per-ratio: side-by-side bars (current vs unit avg vs branch avg)

### 5.5 1-on-1 Mode Integration

Existing Meeting Mode already supports 1-on-1 mode with 8 coaching ratio cards. The agent-mirror dashboard gets a "Start 1-on-1" button that opens Meeting Mode pre-focused on this agent.

### 5.6 Audit Logging for Drill-down Reads

Track D awards detail and Track F agent-mirror drill-down read events log to a subcollection on the agent's doc:

`/tenants/{tid}/users/{agentId}/access_log/{logId}`

```
{
  readerUid, readerRole, readerName,
  surface: 'mirror_dashboard' | 'coaching_note_view' | 'meeting_mode_1on1' | ...,
  readAt: Timestamp,
  durationMs?: optional
}
```

Used for: audit transparency, future analytics on manager engagement, regulatory compliance if applicable.

---

## 6. Track G — Money Needs Worksheet

### 6.1 Five Expense Groups + Three Sub-Calculators

Based on Kyron's existing T&T-localized Looking Ahead worksheet (canonical default for tenant config, not the original LIMRA template).

**Five core expense groups:**
- **Fixed Expenses** — rent/mortgage, utilities, disability income insurance, homeowners insurance, car insurance, property taxes, other
- **Living Expenses** — food, clothing, laundry/tailoring, entertainment, car expenses (nonbusiness), medical, household, other
- **Business Expenses** — sales promotion/advertising/tuition, trade association dues/services/events, telephone/computer/stationery, secretarial/banking, business travel/car, business entertainment, other
- **Savings & Accumulation** — life insurance, savings account, debt reduction (non-mortgage), investments, slush fund, other
- **Miscellaneous** — donations, recreation, club dues, gifts and services, vacation, other

**Three sub-calculators that roll up:**
- **Insurance Industry Expenses** — TTAIFA fees/Congress/Courses, TTII Portal Fee, General License Renewal, CPD classes, MDRT membership/Convention, Branch Retreats, Other Industry Events → rolls into Business Expenses
- **Car Expenses** — gas/petrol, mechanical, insurance, parking, tickets, wash, miscellaneous, vehicle loan; split Personal 1/3 vs Business 2/3, with-loan vs without-loan variants → rolls into Living (personal share) AND Business (business share)
- **Loans/Debt Payments** — credit cards, car loans, personal loans, sou-sou, hire-purchase, other → separate total

### 6.2 PAYE Formula (piecewise, tenant-config-driven)

Current T&T model (verified accurate by Kyron, May 2026 — chargeable-income basis):
- Personal allowance: first **$90,000 TTD** of gross is tax-free.
- **25%** on chargeable income (gross − allowance) up to **$1,000,000** chargeable → gross $90,000–$1,090,000.
- **30%** on chargeable income above **$1,000,000** → gross above $1,090,000.
- Allowance-only simplification (v1): NIS/annuity deductions ignored — conservative planning estimate.

Tenant config: `/tenants/{tid}/config/payeFormula`

```
{
  method: 'reverse-progressive-chargeable',
  currency: 'TTD',
  personalAllowance: 90000,
  chargeableBrackets: [
    { upToChargeable: 1000000, rate: 0.25 },
    { upToChargeable: null,    rate: 0.30 }
  ],
  effectiveFrom, versionId, updatedBy, updatedAt, notes
}
```

Engine walks brackets in **chargeable-income terms** (`chargeable = max(0, gross − allowance)`). Pivot in net terms at **$840,000 TTD**: at that net, gross is exactly $1,090,000 (top of 25% band); above that net, gross has crossed into the 30% bracket.

**Historical accuracy:** Each `moneyNeeds/{year}` doc embeds `payeBracketsSnapshot` (full bracket set used at creation) plus `payeBracketsVersionId` (reference back to config history). Past worksheets stay mathematically faithful forever; new worksheets pull current brackets.

**Update path:** Tenant Admin edits via Company Config → Tax Configuration. Version history in `config/payeFormula/history/{id}` with effectiveFrom/effectiveTo/updatedBy/notes. **Hard banner** on existing worksheets when brackets change, with "Refresh PAYE Calculation" button.

**Excel formula reference (for Kyron's current sheet):**
```
=IF(G55<=90000, 0,
  IF(G55<=840000, (((G55-22500)/0.75)-G55)/12,
    (((G55-77000)/0.70)-G55)/12))
```

### 6.3 Multi-Product Approach (Option C)

Money Needs supports all four product lines (Life / A&H / Property / Motor). Only Life flows downstream to Commission Playground / Goals / Wizard. All other AgencyTrack surfaces stay Life-only for Phase 7.

A&H respects `countsTowardCompanyMetrics: false` flag per Track H 7.7.

### 6.4 Privacy Model

| Worksheet owner | Sees by default | Owner can toggle |
|---|---|---|
| Agent | nobody (private by default) | yes — can turn ON to share with UM + BM |
| Unit Manager | nobody (private by default) | yes — can turn ON to share with BM |
| Branch Manager | nobody | yes — can turn ON to share with SM (default OFF) |
| Sales Manager | nobody | no toggle (top of coaching chain) |
| Tenant Admin | nobody — audit-logged access only by exception | n/a |
| Platform Admin | n/a (cross-tenant, outside model) | n/a |

> **Correction (G1, 2026-05-25):** Original PRD rows for Agent and UM had "default ON / opt-out to turn OFF." Locked decision in G1 brief: **visibility defaults to `'private'` (off). Sharing is opt-in, built in G5.** The table above reflects the corrected model.

**Required UX components:**
- Onboarding consent modal on first worksheet creation (blocking modal, names the UM and BM who will see it)
- Persistent "Shared with [Name] and [Name] · Change visibility" footer on worksheet
- Manager-read audit trail (subcollection on `moneyNeeds/{year}`)
- Per-doc visibility toggle (not global preference) — each year's worksheet has independent setting

**Future v2 refinement (not Phase 7):** Category-subtotal-only view for managers — productive coaching without exposing every line.

### 6.5 Schema — `moneyNeeds` doc

Path: `/tenants/{tid}/users/{uid}/moneyNeeds/{year}`

```
{
  year: 2026,
  productLines: ['life', 'ah', 'property', 'motor'],
  
  expenseGroups: {
    fixedExpenses: { lineItems: [...], subCalculatorRefs: [...], groupAnnualTotal },
    livingExpenses: { lineItems: [...], subCalculatorRefs: [...], groupAnnualTotal },
    businessExpenses: { lineItems: [...], subCalculatorRefs: [...], groupAnnualTotal },
    savingsAccumulation: { lineItems: [...], subCalculatorRefs: [...], groupAnnualTotal },
    miscellaneous: { lineItems: [...], subCalculatorRefs: [...], groupAnnualTotal }
  },
  
  subCalculators: {
    insuranceIndustry: { lineItems: [...], annualTotal },
    carExpenses: { lineItems: [...], withLoan, personalSharePct, businessSharePct, annualTotalPersonal, annualTotalBusiness },
    loansDebt: { lineItems: [...], annualTotal }
  },
  
  totalAnnualAfterTax,
  payeBracketsSnapshot: { ... },
  payeBracketsVersionId,
  computedPAYE,
  totalAnnualPreTax,
  
  estimatedRenewalIncome: { life, ah, property, motor, total },
  firstYearCommissionsRequired,
  firstYearCommissionsTargets: { life, ah, property, motor, total },
  
  visibility: 'default' | 'private',
  shareWithSm: boolean,           // BM-only field
  
  createdAt, createdBy, updatedAt, updatedBy
}
```

Each line item:
```
{
  id, label, amount, frequency, annualizedAmount, isCustom: boolean
}
```

### 6.6 "Send to Playground" Integration

Button on worksheet copies `firstYearCommissionsTargets.life` into Commission Playground as the income goal. Other product line targets stay in the worksheet only.

### 6.7 Soft Validation Against Personal Commitment

When agent saves Personal Commitment that falls below calculated annual need:

> "Your Personal Commitment of $X TTD is below your annual need of $Y TTD. Continue?"

Nudge, not block. Encourages real-grounded commitment.

---

## 7. Track H — Policy Ledger MVP

> **Build status (as of 2026-05-25):**
> - **H1 (walking skeleton)** — SHIPPED PR #300 (`02415c2`). `policies` collection, agent create + own-list, `status='submitted'` only, 3 composite indexes, `PolicyLedgerPanel.jsx`.
> - **H1.2 (agent transition vertical)** — SHIPPED PR #302 (`6886ed1`). `policyLifecycle.js` constants, `isLegalAgentTransition` rules helper, two-arm `allow update` (Arm A body-edit + FU Entry 2 value-guards; Arm B legal status transitions), `/history/{historyId}` append-only subcollection, `transitionPolicyStatus` + `getPolicyHistory` service exports, `PolicyLedgerPanel.jsx` status modal.
> - **H2a (manager confirmation walking skeleton)** — SHIPPED PR #304 (`86541fe`). Firestore Arm C (`confirmedByManager` / `managerSettledAPI` / `hasDiscrepancy` write gate, mirrors settlements gate + UM unit-scope); `confirmPolicy` atomic batch (policy update + manager history + discrepancy notification only when `managerSettledAPI !== policy.settledAPI`); `PolicyReconciliationPanel.jsx` month-selector + settled-unconfirmed list + per-policy confirm form wired into `ManagerDashboard`. Banked loosenings #1 (Arm B per-target) + #2 (history parent-ownership) RESOLVED in same PR.
> - **Remaining (post-H2a):** §7.8 bulk/grouped polish + bulk-confirm (H2b); Lapsed status BM-only `Settled → Lapsed` arm + lapse notification (H2c); awards engine integration (`usesPolicyLedger` flag, §7.6) (H3).

### 7.1 Status State Machine

States:
- **Submitted** (start state)
- **Rated** — head office accepted at loaded premium
- **Postponed** — head office deferred pending more info
- **NTU (Not Taken Up)** — client withdrew or refused first premium
- **Denied** — head office declined outright
- **Settled** — issued and first premium paid (the counting state)
- **Lapsed** — previously Settled, fell out of force (deducted from campaign + award counts)

Legal transitions:
- Submitted → Settled, Rated, Postponed, NTU, Denied
- Rated → Settled (client accepts loaded terms), NTU (client rejects)
- Postponed → Submitted (info provided), Settled, Denied
- Settled → **Lapsed** (new — 13+ months later, typically)

Terminal states: NTU, Denied, Lapsed. (Settled is "intermediate-terminal" — it counts for awards but can still transition to Lapsed.)

### 7.2 Editing Model

**Agent edits, Manager overrides.** Agent updates status in real-time. Branch Manager (or any user with `canConfirmSettlements: true`) can override any policy with audit trail. Manager override carries "Confirmed by [Name]" badge.

**Lapsed status:** Agent cannot independently set Lapsed — too many ways to game it. Branch Manager updates from head office circular (authoritative). Agent gets notification: "Policy X for Owner Y lapsed on date Z; deducted from your Centurion progress."

### 7.3 Migration Strategy

**Soft migration.** Existing `/tenants/{tid}/settlements/{agentId}_{periodKey}` coexists with new `/tenants/{tid}/policies/{policyId}`. Awards engine prefers ledger data per-agent (`usesPolicyLedger: true` on user doc), falls back to settlements where not. Settlements collection retires in Phase 8 once ledger adoption is universal.

### 7.4 Schema — `policies` collection

Path: `/tenants/{tid}/policies/{policyId}`

**Agent-entered at creation (9 required + 3 optional + 1 auto + 2 conditional)**

| Field | Type | Required | Notes |
|---|---|---|---|
| `ownerName` | string | ✓ | Free text |
| `insuredName` | string | ✓ | Auto-fills from owner with "Same as Owner" checkbox |
| `policyNumber` | string | optional | Can be blank until head office issues |
| `productLine` | enum | ✓ | life / ah / property / motor |
| `newBusinessType` | enum | ✓ | nb_ordinary / inc_ppp / replacement / spia / lumpsum / platinum_edge |
| `policyClass` | enum | ✓ | whole_life / term / universal_life / endowment / annuity (auto-fills from plan if picked) |
| `planId` | string | optional | Set if Plan Name came from curated list |
| `planName` | string | optional | Curated or custom free text |
| `proposedPremium` | number | ✓ | parseFloat enforced, > 0 |
| `proposedFrequency` | enum | ✓ | A / S / Q / M |
| `proposedAPI` | number | auto | Premium × frequency; agent can override |
| `proposedCoverage` | number | optional | Face value / sum insured |
| `dateWritten` | date | ✓ | Defaults to today; cannot be future |
| `dateSubmitted` | date | ✓ | Defaults to today; ≥ dateWritten |
| `notes` | string | optional | Free text |
| `isSelfOrFamily` | boolean | ✓ | Defaults false; excludes from awards if true |
| `replacedPolicyAPI` | number | conditional | Required only when newBusinessType=replacement |
| `sourceOfProspect` | enum | ✓ | 11-value taxonomy from `prospectInfoService.js`; confirmed 2026-05-21 (BOA → `bank-referral`). Added per workshop §3.3 decision. |
| `cashWithApp` | object | optional | `{collected: boolean, amount: number\|null}`; amount populated only when collected=true. Added per workshop §3.3 decision. |
| `policyDeliveryDate` | date | optional | Settled-state milestone; unpopulated in H1; set on physical policy delivery after issue. Added per workshop §3.3 decision. |

**Status-update fields:**

- → Rated: `ratedPremium`, optional `rateReason`
- → Settled: `dateIssued`, `settledAPI`, `issuedCoverage`, `initialPremium`, `earnedCommission`
- → Postponed: optional `pendingReason`
- → NTU / Denied: optional `reason`
- → Lapsed: `dateLapsed`, optional `lapseReason`

**System auto-fills on creation:**
- `agentId`, `agentNumber`, `unitId`, `branchId`, `tenantId`
- `createdAt`, `createdBy`
- `status = 'submitted'`, `statusDate = serverTimestamp()`

**Manager-populated on confirmation/override:**
- `confirmedByManager`, `confirmedByUid`, `confirmedAt`
- `managerSettledAPI`, `managerNote`
- `hasDiscrepancy` (computed)

**Audit trail subcollection:** `/tenants/{tid}/policies/{policyId}/history/{historyId}` — every status transition and significant field change.

### 7.5 Plan/Class Hybrid + Tenant Config

Two fields on policy record:
- `policyClass` — required, drives awards (stable 6-8 generic classes)
- `planName` (+ optional `planId`) — agent context only, doesn't affect awards

Tenant config: `/tenants/{tid}/config/policyPlans`

```
{
  plans: [
    { id, name, class, productLine, isActive }
  ],
  pendingReview: [
    { name, loggedByAgents, firstLoggedAt }
  ]
}
```

Custom plan entries (when agent picks "Other") go to `pendingReview`; Tenant Admin promotes to official list. Retired plans set `isActive: false`. Tenant Admin notification badge: "N plans pending review (oldest X days)".

### 7.6 Awards Engine Integration

**Per-agent enablement:** `usesPolicyLedger: boolean` on user doc. Default false during pilot. Enables soft migration.

**Credit rules** apply from `config/awardsRuleset/{year}.productionCreditRules` (see Track D 3.1).

**Three-state data quality badge:**
- **Confirmed** (green) — manager has reviewed the ledger entry
- **Agent-tracked** (yellow/amber) — ledger entry exists, no manager review yet
- **Estimated** (red/amber) — no ledger entry; fell back to aggregate path (legacy behavior)

### 7.7 A&H Handling

`countsTowardCompanyMetrics` flag per product line in tenant config:

```
productLines: {
  life:     { displayName: 'Life',     countsTowardCompanyMetrics: true,  active: true },
  ah:       { displayName: 'A&H',      countsTowardCompanyMetrics: false, active: true },
  property: { displayName: 'Property', countsTowardCompanyMetrics: false, active: true },
  motor:    { displayName: 'Motor',    countsTowardCompanyMetrics: false, active: true }
}
```

Each surface respects the flag:
- **Money Needs worksheet** — ignores flag; all enabled lines participate
- **Policy Ledger MVP** — accepts entries for any enabled product line
- **Awards Engine, Persistency, Wizard, Master Sheet** — filter to lines where `countsTowardCompanyMetrics === true`

Visual cue: "Does not count toward Tatil Life awards or persistency" wherever A&H is displayed.

### 7.8 Manager Reconciliation UI

Branch Manager workflow for reviewing ledger entries against head-office circular:

- List of pending-review policies for the period, grouped by agent
- For each policy: shows agent's entry side-by-side with editable fields
- BM fills in confirmed values from circular
- If values match agent's: silent confirmation
- If values differ: discrepancy flagged, agent notified
- Bulk-confirm mode: select multiple matching entries, confirm all at once

---

## 8. Phase 8+ — Smaller Items (identified, not yet designed)

These were identified during the May 2026 design conversation but not designed in detail. Each is a Phase 8 or later candidate.

- **Opportunity Grid** — top 25 clients × product matrix (Owns / Discussed / Not Needed / Wants Investments). Lightweight cross-sell radar.
- **Quarterly Self-Improvement** — 25 attributes across Personal Effectiveness / Organization-Efficiency / Prospecting / Skill in Selling / Quality Business, rated quarterly (Jan/Apr/Jul/Oct) on 1-3 scale with improvement notes. Pairs with Meeting Mode.
- **Long-Range 3-Year Plan** — one structured doc per agent across Production / Personal-Family / Business-Career / Markets / Professional Development / Other.

Each small enough for one design pass when prioritized.

---

## 9. Out of Scope (Phase 8+ or Zoho One CRM)

Explicitly excluded:

- Monthly prospect lists with names / Centers of Influence / Nests
- Prospect Call List with disposition tracking
- Reinstatement Hit List
- Record of Business Expense
- Bulk import from head-office circular CSV (BM does manually for now)
- Full Looking Ahead demographic columns (Occupation, Employer, Marital Status, Number of Children, Smoker, Email, DOB, Total Insurance Owned) — held out per workshop 2026-05-19; these belong in a future CRM, not the Policy Ledger
- Need Covered — routed to the Joint-Call Observation Log (Track F `jointCalls` collection), not the Policy Ledger; held out per workshop §3.3 decision
- Service-form tracking (Date Policy Received by Agent, Date Delivered, Date of Last Review)
- Plan-level awards (e.g., "top seller of Smart Life" specific awards)

These belong in Zoho One CRM or are deferred until post-pilot evidence demands them.

---

## 10. Key Architectural Principles

Surfaced across the design conversation; apply broadly:

1. **Tenant config over hardcoded constants** — anything that varies by carrier (awards thresholds, PAYE brackets, product lines, plan lists, budget categories, holidays) lives in `/tenants/{tid}/config/...`, not in code.
2. **Point-in-time data integrity** — historical docs embed snapshots of config used at creation, so retrospective views stay accurate when config changes.
3. **Soft migration over hard replace** — when introducing new collections (policies vs settlements), let them coexist with per-agent enablement; retire the old after adoption proves out.
4. **Three-state data quality** — Confirmed / Agent-tracked / Estimated, surfaced per metric, so users know which numbers are trustworthy.
5. **Privacy by default for sensitive surfaces** — Money Needs and Coaching Notes default scoping matches where coaching actually happens; never assume managers above the natural chain need read access.
6. **Manager-read audit trails** — sensitive surfaces (Money Needs, Coaching Notes, agent-mirror drill-down) log every read for transparency and accountability.
7. **Aggregation over live computation** — heavy reads (historic trends, drill-down dashboards) use nightly Cloud Function aggregates, not query-time computation across hundreds of agents × thousands of submissions.
8. **Agent edits, manager overrides** — for shared-truth data (Policy Ledger, settlements), agent is the source of speed, manager is the source of authority, both are versioned.

---

*Document generated May 19, 2026 from the design conversation. Living document — update as new features are designed.*
