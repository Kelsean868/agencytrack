# Track E — Feature Specs

Source: planning session with Kyron + planning-Claude, May 8 2026.
Six items spec'd against real Tatil production-report PDF and Kyron's
persistency-calculator spreadsheet. None are pilot-blocking strictly,
but E1 + E6 promoted to HIGH pre-pilot per Path B decision.

Path B rationale: Couple E1 (schema split) + E6 (daily input mode) pre-pilot
so agents can choose Daily / Weekly / Hybrid logging cadence at launch with
the clean 3-source schema from day 1, no future migration debt.

Tradeoff: Pilot launch shifts back ~2 weeks. Acknowledged and accepted.

---

## E1 — Weekly Report Schema Split (3 production sources) [HIGH, pre-pilot]

### Problem
Current weeklyReport doc stores API as a single number. Tatil tracks three
distinct production sources on the branch whiteboard PDF:

- New Business: APPS count + API $ (commissionable at agent's rate)
- PPP increases (Planned Periodic Premium): APPS count + API $ — production
  credit toward YTD, but ZERO commission. Minimum increase = $2,400 annual API.
- LMPS (Lumpsums): gross $ amount; agent earns 10% as API credit + 0.5% commission

Production report TOTAL = newBusiness.api + pppIncreases.apiIncrease + lumpsums.apiCredit

### Schema additions to weeklyReport doc

```
newBusiness: { apps: number, api: number }
pppIncreases: { apps: number, apiIncrease: number }
lumpsums: {
  grossAmount: number,            // raw lumpsum received from client
  apiCredit: number,              // computed: 10% × grossAmount
  commission: number              // computed: 0.5% × grossAmount
}
totalProductionCredit: number     // computed: newBusiness.api + pppIncreases.apiIncrease + lumpsums.apiCredit
totalCommission: number           // computed: newBusiness.api × agent.commissionRate + lumpsums.commission
```

PPP excluded from commission. LMPS uses fixed 0.5% rate, NOT agent's commissionRate.

### Wizard step
Production capture step splits into 3 sub-sections matching the three sources.
Each section has show/hide toggle (most weeks an agent has only NB; PPP and
LMPS are intermittent).

### Migration
Backfill existing weeklyReport docs:
- newBusiness.api = existing api field
- newBusiness.apps = existing apps field (if exists)
- pppIncreases = { apps: 0, apiIncrease: 0 }
- lumpsums = { grossAmount: 0, apiCredit: 0, commission: 0 }
- Compute totalProductionCredit + totalCommission

Migration script + dry-run mode + production rollback plan required.

### API audit follow-up
Every "API" usage across the app needs review — production credit vs
commissionable. Likely candidates:
- AgentDashboard KPI cards
- PDF reports (agent + manager-tier)
- Goals progress calculations
- Commission Playground inputs
- Leaderboards (when E4 ships)
- Award eligibility logic

### Sizing
~3 days schema + wizard split + migration script
+1 day migration testing in staging
+1 day API audit

### Coupling note
E1 must ship before E6's daily entry UI is built — E6's dailyActivity schema
inherits the 3-source split.

---

## E2 — Reverse Commission Calculator [SMALL, pre-pilot opportunistic]

### Goal
Add a "Reverse Calc" tab to the existing Commission Playground. Answers:
"How much API to sell THIS month to be paid $X commission this month?"

Existing forward calc stays unchanged. Pure addition.

### Math — modal first-payment ratios
Tatil pays first-year commission upfront on ANNUAL mode only. Other modes
follow modal frequency:

| Mode | First-payment ratio | Reasoning |
|---|---|---|
| Annual | 1.0 | Full first-year commission upfront |
| Semi-annual | 0.5 | Client pays ½ premium now |
| Quarterly | 0.25 | Client pays ¼ premium now |
| Monthly | 1/12 ≈ 0.0833 | Client pays 1/12 premium now |

Forward formula:
  Commission this month = TotalAPI × C × Σ(M_mode × FirstPaymentRatio_mode)

Reverse formula:
  TotalAPI required = TargetCommission / (C × Σ(M_mode × FirstPaymentRatio_mode))

Where C = commission rate, M_mode = decimal weight per mode summing to 1.0.

### Worked test cases (use for unit tests)
Agent commission rate = 50%, target = $5,000:
- All annual: $10,000 API
- All monthly: $120,000 API
- 50/50 annual/semi: $13,333 API
- 30A/30S/20Q/20M mix: ~$19,355 API  ← corrected; original spec said $21,432 (formula gives $19,355)

### UI
Three vertically stacked panels:
1. Inputs — target commission, commission rate (default from agent.commissionRate,
   override allowed but doesn't persist), 4 auto-balancing mode-mix sliders
2. Result — required API (big number) + per-mode breakdown table
3. Insight — smart suggestions ("Shift 10% monthly→annual to reduce API by $X")
   + 12-month cash flow chart

### Component structure
The existing Commission Playground (`src/components/goals/CommissionPlayground.jsx`)
is a goal-decomposition tool (income goal → API/activity required), not a forward
commission solver. E2 adds a "Modal Targeting" tab rather than reworking that math.

The file was refactored to a directory (Path A) so consumers keep the same import path:

src/components/goals/CommissionPlayground/
├── index.jsx                    (tab shell — Goal Decomposition / Modal Targeting)
├── tabs/
│   ├── GoalDecompositionTab.jsx (existing goal-decomp logic, verbatim)
│   └── ModalTargetingTab.jsx    (NEW — §E2 reverse modal calc)
├── components/
│   ├── ModeMixSlider.jsx        (auto-balancing sliders)
│   ├── CommissionBreakdownTable.jsx
│   ├── CashFlowChart.jsx        (recharts, 12-month cash flow)
│   └── InsightCard.jsx
└── utils/
    ├── commissionMath.js        (pure functions, 15 unit tests)
    └── modeMixBalancer.js

### Pure function signatures (commissionMath.js)

```
export const FIRST_PAYMENT_RATIO = {
  annual: 1.0, semiAnnual: 0.5, quarterly: 0.25, monthly: 1/12
};
export function commissionThisMonth({ totalApi, modeMix, commissionRate })
export function reverseCalc({ targetCommission, modeMix, commissionRate })
export function modeBreakdown({ totalApi, modeMix, commissionRate })
export function cashFlowForecast({ totalApi, modeMix, commissionRate })
```

### Data model
Existing user doc must have `commissionRate` field (confirmed exists per agent
profile, varies per-policy and agent-tier; used as average).
No new collections in v1.

### Validation
- Target commission > 0, ≤ $1,000,000
- Commission rate 0 < r ≤ 100%
- Mode mix sum = 100% (auto-balanced — should never trip)
- parseFloat() enforced per project rule

### V1 scope (locked)
- New business only
- First-year commissions only (renewals deferred)
- No saved scenarios (deferred to v2)
- No "optimize for me" (deferred)
- No product-specific commission rates (deferred)

### Sizing
~1.5–2 days

### Pre-pilot fit
Pure addition, no schema risk, agent-loved on day 1. Slot after E1 + E6 if
pilot timeline absorbs it; otherwise immediate post-pilot.

---

## E3 — Persistency Playground [MEDIUM, post-pilot]

### Source
Replicates Kyron's existing Excel persistency calculator (Sheet:
"Persistency Calculator" in Campaign_Tracker workbook). Formula reverse-
engineered and validated against worked example.

### Three-section layout

**Section 1: Current State**
- Manual input (no policy records in Firestore — Kyron deliberately avoided
  CRM territory). Pre-fill option from YTD weeklyReport aggregates.
- Inputs: Business Placed, NTU (Not Taken), Lapses, Reinstatements
- Computed: Gross Settled, Net Settled, current Persistency
- Visual: gauge with red <85%, amber 85–90%, green ≥90%

**Section 2: Target Setting**
- Target % (default 90% = award eligibility threshold per 2026 incentives)
- Target date (default = year end)
- Anticipated **Good Lapses** (Q8 in spreadsheet) — counts against persistency
- Anticipated **Bad Lapses** (Q9 in spreadsheet) — forgiven, removed from
  calc entirely (lapsed bad business is treated as cleaning the book)

Three alternative recovery paths displayed as side-by-side cards:
1. New Business needed (m)
2. Reinstatements needed (n) = m × (100−target)/100
3. Orphans needed (o) = m

**Section 3: Scenario Builder**
- Sliders for: NB placed, reinstatements, NTU, lapses, orphans adopted
- Live persistency recalc + shortfall display
- Save up to 3 named scenarios per agent

### Formula (validated against spreadsheet)

```
Future Gross Settled = (Business Placed - NTU - Good Lapses - Bad Lapses) + NB
Future Net Settled = (Business Placed + Reinstatements - NTU - Existing Lapses - Good Lapses) + NB
NB = (R5×(F9-F10-Q9-Q8) - 100×(F9+F13-F10-Q8-F12)) / (100-R5)
```

where R5 = target %, F9 = placed, F10 = NTU, F12 = lapses, F13 = reinstatements,
Q8 = good lapses anticipated, Q9 = bad lapses anticipated.

Worked example to validate implementation:
- F9=200K, F10=0, F12=50K, F13=0, target=90%, Q8=20K, Q9=6K
- → NB needed = $266,000

Asymmetric Good/Bad lapse handling is intentional — preserve from source.

Bug to NOT replicate from spreadsheet: H24 has `++G24` typo (Excel collapses
silently; clean it up in our implementation).

### Enhancements
- Award Eligibility Flag overlay on gauge: "Below 90% — disqualifies from
  Monthly Award, Quarterly Award, Club"
- Pace tracker: "$266K NB needed by Dec 31. You're at $80K with 3 months —
  $X behind pace"

### Sizing
~3–4 days base + 1–2 days enhancements

### Dependency
Pre-fill mode benefits from E1's clean schema, but Section 1 manual input
works without it. Can ship before E1 if needed.

---

## E4 — Digital Production Report / Branch Leaderboard [MEDIUM, post-pilot]

### Three role-based views

**Unit Manager view** — `/leaderboard/unit/:unitId`
- One row per agent in unit
- Columns mirror Tatil whiteboard PDF: Weekly | MTD | YTD × (NB Apps/API,
  PPP Apps/$, LMPS $, Total)
- Sortable, top-3 highlight (gold/silver/bronze)
- Footer: Unit subtotal

**Branch Manager view** — `/leaderboard/branch/:branchId`
- Grouped table by Unit:
  - Unit header bar + agents + Unit subtotal (bold)
  - Repeat per unit
  - Branch grand total at bottom (extra-bold, primary teal)
- Collapsible units
- Rank column

**Sales Manager view** — `/leaderboard/sales-manager`
- Top-level: one row per branch, branch totals only
- Click branch → drills into Branch Manager view
- Cross-branch ranking + delta vs last week

### Live updating
Firestore listeners — sub-second updates as agents submit during the week.

"Snapshot as of Friday 4pm" toggle — preserves the existing weekly cadence
where production reports go out Friday 4pm to branch managers for meetings.

### Print/PDF export
"Print this view" button generates same layout as current Tatil PDF.
Branch managers still want paper for offline meetings + emailing upward.
~½ day add.

### Aggregation architecture
Cloud Function on weeklyReport write recomputes and writes to:
  /tenants/{tid}/aggregations/branches/{branchId}/current

Schema:

```
{
  branchName, branchManagerId, lastUpdated,
  units: [{
    unitId, unitName, unitManagerId,
    agents: [{ agentId, agentName,
      weekly: {newBusiness, pppIncreases, lmpsCredit, total},
      mtd: {...same}, ytd: {...same}
    }],
    unitSubtotal: { weekly, mtd, ytd }
  }],
  branchTotal: { weekly, mtd, ytd }
}
```

Views read this single doc — fast, cheap, scales.

### Sizing
~3–4 days for three views + ½ day print export

### Hard dependency
E1 schema must ship first. Otherwise leaderboard built against legacy
single-API and needs refactor.

---

## E5 — TV Display Kiosk Mode [SMALL, post-pilot]

### Route
`/display/branch/:branchId?token=:kioskToken`

Kiosk auth: Branch-scoped revocable token generated by Branch Manager from
settings. No login UI on TV.

### Auto-rotating slides (5 default, 15s each, configurable)
1. Branch Production Report (full whiteboard layout from E4)
2. Top 10 This Week (with ↑↓ movement vs last week)
3. Agent of the Week spotlight
4. Branch Goal Progress (API, Apps, Persistency)
5. Award Eligibility Watch — agents within striking distance of awards

### Privacy controls (Branch Manager-set)
- Name display: full / first+initial / initials
- $ visibility: amounts / ranks only / top-10 only
- Bottom-rank: show all / spotlight mode (top 10 + recent improvers only)
- Slide selection + rotation speed

### Sizing
~3 days

### Dependency
E4 must ship first.

---

## E6 — Daily Input Mode [HIGH, pre-pilot — Path B]

### Goal (Path B rationale)
Promoted to HIGH pre-pilot so agents can choose their preferred logging
cadence at pilot launch. Coupled with E1 so dailyActivity schema uses 3-source
split from day 1 — no migration debt.

### Daily entry
Lightweight form, target 30-second entry:
- Date (default today, editable for backfill)
- Calls made (numeric)
- FFIs (Fact-Finding Interviews)
- CIs (Closing Interviews)
- Sales count
- Production: 3 sub-sections matching E1 schema (NB / PPP / LMPS), each with
  show/hide toggle. Most days agent has zero or one source.

Goals + reflection sections do NOT appear daily — those stay weekly only
(retrospective by nature).

### Sunday aggregator
Cloud Function runs Sunday 11:59 PM:
1. Reads agents/{agentId}/dailyActivity/* for past 7 days
2. Sums into 3-source weekly aggregate
3. Pre-fills next weekly wizard with these totals
4. Agent reviews, can edit, then submits

### Schema

```
agents/{agentId}/dailyActivity/{YYYY-MM-DD}: {
  date, callsMade, ffis, cis, salesCount,
  newBusiness: {apps, api},
  pppIncreases: {apps, apiIncrease},
  lumpsums: {grossAmount},        // apiCredit + commission computed at aggregation
  createdAt, updatedAt
}
```

### Profile setting
agents/{agentId}.loggingMode: 'weekly' | 'daily' | 'hybrid'
- weekly = current behavior (default for backwards-compat)
- daily = daily entry required, weekly is just review/submit
- hybrid = either path acceptable in any week

Mode-switch UX: change anytime via profile, mid-week transitions handled
gracefully (existing daily entries preserved on switch to weekly).

### Adoption risk + mitigation
Agents who don't submit weekly may submit even less daily (7 chances to
fall off vs 1). Mitigation: pair with daily push notification at agent's
chosen time-of-day. WhatsApp nudge integration is a separate item, not
bundled.

### Sizing
~4–6 days end-to-end + 1 day testing

### Dependency
E1 must ship FIRST (E6's dailyActivity inherits 3-source split).

---

## Sequencing — Path B locked

### Pre-pilot HIGH (in strict order)
1. aria-hidden a11y fix (already queued)
2. **E1** — Weekly report schema split + wizard split + migration (3+1+1 days)
3. **E6** — Daily input mode (4-6+1 days, builds on E1 schema)
4. **E2** — Reverse Commission Calculator (1.5-2 days, opportunistic add)

### → PILOT LAUNCH ←

### Post-pilot (in order, can parallelize where possible)
5. E3 — Persistency Playground
6. E4 — Digital Production Report / Leaderboard
7. E5 — TV Display Kiosk Mode

### Pre-pilot timeline impact
Path B adds ~10–13 days pre-pilot work vs. the "ship just the aria-hidden
fix" baseline. Pilot launch shifts back ~2 weeks. Tradeoff accepted to
give agents cadence choice + clean schema at launch.
