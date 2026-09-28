# Desktop v3 — Money workspace rebuild ("every calculator survives, and gets better")

The owner spent a lot of time on the real app's money calculators. The redesign must keep EVERY
input, output, formula, state and action they have, and improve how they read on a desktop.
The source of truth is `MONEY-INVENTORY.md` (an inventory of the live repo). Its FLAT CHECKLIST at
the end is what your tab will be checked against — every line for your tab must be visibly present
(or reachable in one click) in your file. Where the inventory quotes a label, use it verbatim.
If you need more detail than the inventory gives, you may read the real source read-only on the
owner's PC with the tool `mcp__remote-devices__windows-mcp__PowerShell` (load via ToolSearch
`select:mcp__remote-devices__windows-mcp__PowerShell`): repo `C:\Projects\AgencyTrack`, use
`Get-Content -Raw <path>`, never chain with `&&`, never modify anything there.

Also read: CONVENTIONS.md, DESKTOP.md, DESKTOP2.md, DESKTOP3.md, MOTION3.md (format, palette,
chart rules, motion rules). Later files win.

## Architecture
`D3-Money.dc.html` becomes a thin SHELL (sidebar + 56px toolbar with the tab control). Each tab is
its own component file that the shell mounts with
`<dc-import name="D3M-XXX" dark="{{dark}}" on-nav="{{onNav}}" params="{{params}}" hint-size="1220px,844px">`.
Your component:
- Root: `width: 1220px; height: 844px; display: flex; overflow: hidden; background: {{c.bg}}`.
  NO sidebar, NO toolbar (the shell draws them). Main area scrolls inside (`overflow-y: auto`).
- The right INSPECTOR (340px, `c.pane`, left hairline) is this tab's CALCULATOR: the inputs and
  levers live there, always visible, and the main area shows the results, charts and lists that
  react to them live. (That's the desktop improvement: change a number on the right, watch every
  chart on the left glide.) Tabs with no inputs may use the inspector for detail/drill-down.
- data-props: `'{"dark":{"editor":"boolean","default":false},"params":{"editor":null},"onNav":{"editor":null},"$preview":{"width":1220,"height":844}}'`
- Links: `go` helper → `this.props.onNav(id)`; toasts `onNav('event:toast:…')`; sheets
  `onNav('Log')`, `onNav('AddAppt?type=…&client=…')`. Other Money tabs: `onNav('Money?tab=Persistency')`.
- Inputs are real `<input>`s with `<label>`s (type number / range / checkbox), 44px tall; wire
  `onInput`/`onChange` to setState and recompute everything in renderVals(). Format money as
  `TTD 12,345` (whole TTD unless the source shows cents), percents with 1 decimal.
- Every chart: title states the takeaway, direct labels on key points, a "Table" toggle, and
  glide on change per MOTION3.md (style-based sizes + 480ms transitions, redraw keyframes A/B).
- Plain short copy. Each number the agent might not understand gets a one-line "how this is
  worked out" disclosure ("Why?" button) showing the formula with their numbers.
- Placeholders `[Client name]`; anything not real gets a visible mono SAMPLE label per section.

## Real figures (use these; everything else is SAMPLE)
- 2026 settled API TTD 87,146 (5 apps); submitted TTD 123,146 (6 apps); TTD 36,000 / 1 app submitted
  not settled. MDRT 2026 = TTD 688,800 (13% reached; TTD 601,654 to go; 14 weeks left; TTD 42,975/wk).
- Tatil company minimum for Kyron's tenure band: TTD 500,000 API a year (bands: 150K <12 mo ·
  200K 12–24 · 250K 25–36 · 300K 37–48 · 400K 49–60 · 500K >60) + 40 applications a year.
- Company weekly minimums: calls 60 · contacts 40 · appointments 20 · interviews kept 15 ·
  fact finds 10 · closing interviews 10 · applications 1 · clients sold 1 · API TTD 4,800 ·
  referrals/new names 100.
- Christmas Campaign & Retreat 2026: settled TTD 73,946 of 275,000 (Champion), 3 of 35 apps,
  96 days left; prize TTD 7,000 cash; persistency bands ≥90 → 100% · ≥85 → 50% · ≥80 → 25% · <80 → out.
- Persistency (24-month model, Tatil memo 29-08-2026, effective September 2026 onward; ledger
  export 15-09-2026, annuity rule "ignore"): September 2026 derived **86.6%**.
  Net Gross Settled TTD 210,975.24 · Lapses TTD 28,196.88 · Net Settled TTD 182,778.36.
  90% needs Net Settled ≥ 189,877.72 → gap **TTD 7,099.36** (display "TTD 7,100", rounded up).
  Lapsed policies still inside 24 months (the ONLY ones that can help; 80 older lapses are aged out
  and must never be listed as a lever):
  | Issued | Months left in window | API |
  | 28-10-2024 | 1 | 1,182.36 |
  | 28-05-2025 | 8 | 2,400.00 |
  | 14-08-2025 | 11 | 11,996.64 |
  | 19-11-2025 | 14 | 4,821.12 |
  | 11-11-2025 | 14 | 3,617.64 |
  | 19-11-2025 | 14 | 2,400.00 |
  | 20-11-2025 | 14 | 1,779.12 |
  Smallest set that clears 90%: 4,821.12 + 2,400.00 = 7,221.12 → 90.06%. One policy alone:
  11,996.64 → 92.3%. The 28-10-2024 policy ages out after October 2026. Same ledger under the
  annuity rule "lapse" gives 72.2%.
- Formulas (memo): Net Gross Settled = Gross Settled − Not Takens − Decreases + Increases + 10% ×
  Lumpsums; Net Settled = Net Gross Settled − Lapses + Reinstatements; Persistency = Net Settled ÷
  Net Gross Settled. PERS_GATE 90% (awards/campaign gate), PERS_FLOOR 80% (at-risk). Model is
  picked by month: before 2026-09 = 12-month model, from 2026-09 = 24-month model (no switch).
- Commission (first-payment): commission = Σ API × modeMix × rate × FIRST_PAYMENT_RATIO
  (annual 1 · semi-annual 0.5 · quarterly 0.25 · monthly 1/12). Reverse: API = commission ÷
  (rate × Σ modeMix × ratio). Rate is per agent → show as SAMPLE (e.g. 40%).
- PAYE: personal allowance TTD 90,000; 25% on chargeable income up to 1,000,000, 30% above.
