# AgencyTrack Planning UI/UX Redesign Specification

## 1. Context and Goals

### 1.1 Product context

AgencyTrack is an insurance agency management platform used by agents, unit managers, branch managers, sales managers, tenant admins, and platform admins. It already includes:

- A dark‑mode dashboard shell with desktop sidebar and mobile bottom navigation.
- Daily/weekly reporting wizard, production reports, performance dashboards.
- Agent tools like Commission Playground, Persistency Playground, Policy Ledger.
- Manager tools like MasterSheet, GoalsPanel, Compliance, recruiting, WAR, user/admin panels.

Separately, there is a “Looking Ahead” Excel workbook used by agents to plan the year. It walks through:

1. Organizing personal money needs.
2. Organizing year activities by line of business (Life, A&H, Property, Motor).
3. Monthly activity and production sheets + summaries.
4. Self‑improvement and goal‑setting.
5. Record of business expenses.

### 1.2 Design goal

Unify the workbook planning flow and the existing app capabilities into a guided planning experience for agents, without turning AgencyTrack into a CRM.

- Primary audience: Agents planning their own income and production.
- Secondary: Managers/Admins using higher‑level dashboards, MasterSheet, config tools.
- Crucial constraint: The app should not become a full CRM — no generic contact management, pipelines, or full client records. Policy and prospect tools remain focused and minimal.

---

## 2. Global Shell and Navigation

### 2.1 Global shell

**Desktop:**

- Top bar:
  - Left: App logo + “AgencyTrack”.
  - Center: current page title (“Looking Ahead 2026”, “Agent Dashboard”, etc.).
  - Right: Notification bell, sync indicator, dark/light toggle, user avatar.

- Left sidebar (role‑aware contents):
  - Work: Dashboard, Wizard (weekly/daily entry), Production Report.
  - Planning: Looking Ahead, Goals, Money Needs.
  - Tools: Commission Playground, Persistency Playground, Policy Ledger.
  - Admin/Manager: MasterSheet, Users, Company Config, Activity Standards, Awards Ruleset.
  - Active item: amber accent, left bar indicator, icon + label.

**Mobile:**

- Bottom nav bar:
  - 4–5 tabs, e.g.: Dashboard, Planning, Reports, Profile.
  - FAB (“+” or target icon) for “Submit Report” / “Daily Entry”.
- Sidebar content appears in a “More” drawer triggered from the bottom nav.

### 2.2 Visual design system

- Dark mode by default: near‑black shell background, deep grey surfaces, warm neutral surfaces.
- Amber as the primary accent for CTAs, stepper highlights, and key status.
- Off‑white text, clear hierarchy: large page titles, medium section headings, compact body text.
- Cards with subtle shadows and 8–12px radius.

---

## 3. Looking Ahead Flow (Wizard)

### 3.1 Overview page: “Looking Ahead 2026”

A dedicated “wizard home” that structures the annual planning journey.

**Structure:**

- Page title: “Looking Ahead 2026” with subtext: “Plan your income, activities, and growth for the year.”
- Horizontal stepper across the top:

  1. Money Needs  
  2. Year Plan  
  3. Monthly Plan  
  4. Self‑Improvement  
  5. Review & Track

  - Current step highlighted in amber (pill with number and label).
  - Completed steps show a check icon. Future steps greyed.

- Main content two‑column layout:

  - Left column:
    - Short bullets summarizing the process (adapted from the workbook’s “Steps to Guide you” sheet):
      - “Estimate how much income you need to cover your lifestyle and business expenses.”
      - “Split that income target across Life / A&H / Property / Motor.”
      - “Turn yearly targets into monthly and weekly activity goals.”
      - “Track progress and adjust as life changes.”
    - Clear statement: “This is for your personal planning, not client planning or CRM.”

  - Right column:
    - Prominent card:
      - Title: “Step 1 – Money Needs”.
      - 1–2 sentences describing what will happen.
      - Primary button: “Open Money Needs”.
      - Secondary link: “Skip for now” (moves to Year Plan with default assumptions).

---

## 4. Money Needs – Agent Income Planner

This is strictly for agent personal income planning, not client needs analysis.

### 4.1 Top summary strip

Three horizontally aligned cards:

1. Total Income Needed (2026)  
   - Big TTD amount.  
   - Line: “Lifestyle + business expenses + savings.”

2. Covered by PAYE & other  
   - Uses existing PAYE summary logic in Money Needs service.  
   - Line: “Salary and other steady income.”

3. To be covered by commissions  
   - Amber card showing the “commission gap”.  
   - This becomes the Year Plan base commission target.

All three numbers update as the agent edits expense inputs.

### 4.2 Expense groups (left column)

4 collapsible accordions:

1. Fixed Household  
   - “Rent/mortgage, utilities, school fees, groceries.”  
   - On expand: list of monthly currency fields for each category.

2. Lifestyle & Family  
   - “Entertainment, vacations, hobbies.”

3. Business Expenses  
   - “Fuel, parking, tools, licenses, marketing, office costs.”  
   - Align categories with the workbook’s “Record of Business Expense” but at aggregated level, not per receipt.

4. Savings & Debt  
   - “Loan repayments, credit cards, emergency fund, investments.”

Each accordion header shows monthly total for that group; inside: simple rows of “Label | TTD / month”.

### 4.3 “Your Plan” card (right column)

Sticky card visible while scrolling:

- Shows:
  - Total monthly expenses.
  - Annual expenses.
  - Net income gap after PAYE: “You need TTD X in commissions this year.”

- Controls:
  - Primary button: “Send to Year Plan”  
    - Locks the year (e.g., 2026) and pushes the commission gap into Year Plan.
  - Small link: “Adjust commission assumptions”  
    - Opens a tiny modal to set global assumptions like average commission rate %, % of income expected from commissions.

---

## 5. Year Plan 2026 – Product Line Targets

This unifies the workbook’s “Year activities – Life/A&H/Property/Motor” sheets into one screen.

### 5.1 Header

- Title: “Year Plan 2026”.
- Pill on the right: “Commission gap from Money Needs: TTD X”.
- Toggle: Projected vs Modal commission mode, with a brief text snippet explaining the projected commission timing behavior.

### 5.2 Product line distribution strip

Horizontal strip of 4 mini cards:

- Lines: Life, A&H, Property, Motor.
- Each card shows:
  - Line name + icon.
  - Percentage slider or pill control labeled “Share of commission” (e.g., 60%, 20%, 10%, 10%).
  - Under that:
    - “Commission target: TTD X”.
    - “API target: TTD Y”.

Changing the percentage re‑allocates the constant total commission target across lines.

### 5.3 Selected line detail card

Large card in the center for the selected line (e.g. Life):

- Fields (left = label, right = value/input):

  - Annual commission target (read‑only from distribution).
  - Average commission rate (editable).
  - Implied API target (formula; allow override if user wants).
  - Average case size (input).
  - Cases needed (calculated).
  - Suggested weekly appointments (calculated using existing activity standards / conversion ratios).

- A tiny note: “Based on current conversion assumptions; adjust standards in Settings if needed.”

### 5.4 Sidebar checklist

Right sidebar for completion status:

- Checklist items:
  - Life targets configured (check when key fields are filled).
  - A&H targets configured.
  - Property targets configured.
  - Motor targets configured.

- Button: “Lock my annual targets”  
  - Persists these values into the agent’s yearly goals/personal commitments.

---

## 6. Monthly Plan & Progress

Replaces 12+ monthly worksheets and summaries with a single, reusable layout.

### 6.1 Header

- Title: “Monthly Plan & Progress”.
- Month selector as chip row or dropdown (Jan–Dec).
- Subtext: “Year target: API X, Cases Y”.

### 6.2 Top KPI cards

Three horizontal cards:

1. This month’s API target (from Year Plan, split across months).
2. API achieved so far (from submissions/production data).
3. Status: “On track / Slightly behind / Behind” (simple rule based on progress vs time in month).

### 6.3 Body layout

Two columns:

- Left: Plan vs Actual
  - Week‑by‑week tiles (or a table) showing:
    - Weekly API target vs actual.
    - Calls, appointments, apps vs standards.
  - Reuse the existing Weekly Standard card styling for consistency.
  - Button: “Open Weekly Wizard” → opens the existing weekly/daily Wizard with this week/month context.

- Right: Notes and suggestions
  - Text area for a short free‑form “Plan for this month”.
  - Suggestion chips like “Increase focus on Life”, “Boost A&H”, “Work on persistency”, derived from where current actuals are behind targets by line.

---

## 7. Commission Playground – Income Mix Tool

Clarify that this is an agent tool to plan commission mix, not a client calculator.

### 7.1 Layout

**Header:** “Commission Playground” with subtext: “Test different product and mode mixes to hit your commission target.”

- Left panel:
  - Source target from Year Plan: “2026 commission target: TTD X”.
  - Option to nudge: “Try +10% stretch target” or manual override.
  - Mode mix sliders: e.g., “Annual vs Modal vs Single premium”, per line or overall.

- Right panel:
  - Cash‑flow chart showing monthly commission flows over current + next year.
  - Insight box at the top:
    - Example: “Shifting 10% of cases from modal to annual would bring TTD Y extra into this year.”
    - Button: “Apply this mix” to sync the sliders with the suggested scenario.

- Footer actions:
  - “Use this as my API target” → writes back into the Year Plan/goals.
  - “Save scenario…” → allows saving 2–3 named mixes (“Current”, “Stretch”, “Conservative”).

---

## 8. Persistency Playground – What‑If Tool

Support agent understanding of how persistency improvements help hit gates, without deep CRM.

### 8.1 Layout

- Header: “Persistency Playground”.
- Top card: current persistency %, target gate (e.g., 90%), visual indicator if below gate.

- Left column: sliders
  - Group 1: Protect the book
    - Slider: “Policies saved per month” or “% of at‑risk policies saved.”
  - Group 2: New clean business
    - “Additional TTD of clean API per quarter.”

- Right column: outputs
  - Progress ring bar: projected persistency vs gate given slider settings.
  - Three shortfall cards describing for each lever “If you only changed X… this is what you need”.
  - Optional mini list: top 5 at‑risk policies, each with a link to open that policy in the Policy Ledger.

---

## 9. Policy Ledger – Agent View

Keep this strictly about policy status and cleanup, not a CRM.

### 9.1 Filters and table

- Header: “Policy Ledger”.
- Filter chips at top:
  - Line of business, Status (Needs action, At risk, New this month, All).

- Table columns:
  - Client initials / masked name (no full CRM contact view).
  - Product name.
  - Status (New, In force, At risk, Lapsed).
  - Annual premium.
  - API credit.
  - Issue date.
  - Next action.

### 9.2 Row actions & transitions

- Rightmost cell per row:
  - Buttons for allowed transitions (e.g., Confirm settled, Mark NTU, Postpone).
  - Clicking opens a slim inline editor or right side drawer with only required fields for that transition.

- Secondary links:
  - “Add to persistency plan” → opens Persistency Playground with this policy selected.
  - “Include in income planning” → conceptually just adds its API to summary stats, no dedicated CRM.

---

## 10. Dashboard Tweaks (Agent & Manager)

### 10.1 Agent Dashboard

Above the fold:

- “This week” KPI strip (API, apps, calls vs standards).
- “Today” tile: daily entry status with CTA to daily entry modal.

On the right:

- “Looking Ahead” widget:
  - Year commission target vs progress bar.
  - Next self‑improvement goal milestone.
  - Link to open “Looking Ahead 2026”.

Below:

- Recent Activity list.
- Campaigns snippet (active campaigns & progress).
- Recognition strip (badges / leaderboards).

### 10.2 Manager Dashboard & MasterSheet

- Manager Home:
  - “Needs attention” cards: below‑floor goals, missing WARs, low persistency.
  - Branch KPI strip using compact scorecards (no circular gauges).
  - Recognition section: team medals, weekly champions.

- MasterSheet:
  - Sticky Agent/Unit columns.
  - Column presets: All / Production / Recruiting / Compliance / Persistency.
  - “Show only exceptions” toggle to filter down to rows with issues.
  - Click‑to‑expand row reveals per‑agent detail (goals, coaching summary, persistency) inline.

---

## 11. Self‑Improvement & Career

A dedicated planning surface tying into existing CareerPortal and goals.

- Left:
  - 3 self‑improvement goals for the year (e.g., FSCP module, prospecting habit, time management).
  - Each has a simple status (Not started / In progress / Done) and optional due date.

- Right:
  - Career snapshot: current career level, MDRT progress, key awards.

- Per goal: switch “Pin to dashboard” to surface it on the Agent Dashboard.

---

## 12. Non‑CRM Boundary

Throughout all designs:

- No generic client/contact modules or pipelines.
- No big list of prospects or deals.
- Policy and prospect info remain in focused tools: Policy Ledger, Prospect Info, Joint Call prep.
- Planning is done on aggregated metrics (income, API, cases, activity counts, persistency rates), not on contact‑level pipelines.

Use this spec as instructions to design high‑fidelity mockups and/or React + Tailwind components for each screen described above.
