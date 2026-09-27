# AgencyTrack — DESKTOP v3 conventions ("the middle ground")

v1 gave every feature its own page but was the phone layout made wider. v2 merged features into
8 workspaces with strong workflows (power hour, drag to schedule, bulk confirm, what-if) but hid
some features. v3 keeps v2's workflows AND gives every feature a visible home again, and makes each
page GLANCEABLE: the top of every page answers "am I on track?" in 3 seconds with a chart or a
stat tile, details below. Think like a sales agent at a desk between calls.

Read `CONVENTIONS.md` (format rules, `go` helper, data, placeholders, SAMPLE labels), then
`DESKTOP.md` (fonts link, helmet, tables), then `DESKTOP2.md` (page skeleton, palette extras,
macOS feel, the game rules). Where they conflict, THIS file wins. Copy structure from an existing
D2 file (e.g. `project/D2-Money.dc.html`) — same head, helmet, fonts, palette, script shape.

## Skeleton changes from v2
- Sidebar component is `D3-Sidebar` (not D2-Sidebar): `<dc-import name="D3-Sidebar" active="ID"
  dark="{{dark}}" h="{{HEIGHT}}" hint-size="220px,HEIGHTpx"></dc-import>` inside the same
  `sc-if showChrome` wrapper. Sidebar ids: Today · Calls · Week · Funnel · Numbers · Ledger ·
  Money · Arena · Campaign · Awards · Trophies · Me · Connections.
- Pages with tabs take a `params` prop (`"params":{"editor":null}`) holding e.g. `{tab:'Persistency'}`.
  Initial tab = `(this.props.params && this.props.params.tab) || 'Overview'`; keep the chosen tab
  in state after that. Tabs are a segmented control in the 56px toolbar (hit area ≥ 44px).
  data-props for tabbed pages:
  `'{"dark":{"editor":"boolean","default":false},"embedded":{"editor":"boolean","default":false},"params":{"editor":null},"onNav":{"editor":null},"$preview":{"width":1440,"height":900}}'`
- Page size 1440 × 900 (1220 wide when embedded). Content scrolls inside panes.

## Linking ids → files (v3)
Today→D3-Today · Calls→D3-Calls · Week→D2-Week · Funnel→D3-Funnel · Numbers→D3-Numbers ·
Ledger→D2-Ledger · Money→D3-Money · Arena→D2-Arena · Campaign→D3-Campaign · Awards→D3-Awards ·
Trophies→D3-Trophies · Me→D2-Me · Connections→D3-Connections · Report→D2-Report ·
Log→Log-Sheet · AddAppt→Add-Appointment · Outcome→Outcome · Search→D3-Today (the shell opens search).
To open a tab on another page use an id with a query: `this.props.onNav('Money?tab=Persistency')`
(href stays the plain file). Toasts: `onNav('event:toast:Saved …')` as before.

## Glanceable rules (every page)
1. First row = the answer: 3–5 stat tiles or one hero chart. Stat tile = label (sentence case) ·
   value (Onest 26–30px weight 700, proportional figures) · delta or "vs target" line · optional
   12-point sparkline (de-emphasis colour, last point in accent).
2. One idea per chart. Title says the takeaway ("On pace for TTD 402K — MDRT needs 688.8K"),
   subtitle says what is plotted. No chart without a title.
3. Every chart has a "Table" toggle (small text button top-right of the card) that swaps the chart
   for a plain table of the same values (state flag). Tooltips on hover of bars/points (CSS
   `:hover` tooltip or state), but values are never ONLY in the tooltip — endpoint / key values are
   direct-labelled.
4. Charts are inline SVG built from arrays in `renderVals()` (compute x/y/width/height/path `d`
   strings there; holes can't do maths). No chart libraries.

## Chart specs (validated palette — use exactly these)
- Series colours in FIXED order, never cycled:
  light `cat: ['#008C85', '#A96800', '#2F6FC4', '#C04A2B', '#8559A5']`
  dark  `cat: ['#12A39B', '#B8841A', '#4F86DB', '#D2643D', '#9F77CC']`
  One series → `cat[0]` for every bar. Most charts are ONE series; prefer emphasis (highlight one
  bar in `cat[0]`, the rest in `c.ghost`) over many colours.
- Settled vs submitted: solid `cat[0]` = settled; `c.ghost` = submitted/waiting, and always say so
  in a legend or label.
- Targets / thresholds: a 1px solid line in `c.faint` with a direct text label ("MDRT 688,800",
  "Gate 90%"). Never dashed gridlines. Gridlines: 1px solid `c.rule`, few of them.
- Bars ≤ 24px thick, 4px rounded data-end (use a path or rx and cover the baseline corners with a
  rect), 2px gap between adjacent bars. Lines 2px, round caps; end dot r=4 with a 2px ring in the
  surface colour. Area fill = series colour at 0.10 opacity.
- NEVER a dual-axis chart. Two measures of different scale = two small charts side by side.
- Donut only for part-to-whole with ≤ 5 parts; otherwise bars.
- Text never uses a series colour — labels/values use c.ink / c.mute / c.faint.
- Warnings use `c.warm` WITH an icon + words. Campaign/awards use `c.gold`.
- Chart entrance motion: bars grow from baseline (scaleY from 0, transform-origin bottom,
  380ms, stagger 30ms via inline `animation-delay`), lines draw with stroke-dasharray. Wrap in
  `@media (prefers-reduced-motion: reduce)`.

## Trophies (shared component — use it, don't draw your own)
`<dc-import name="D3-Trophy" kind="KIND" size="96" locked="{{bool}}" progress="{{0..100}}" dark="{{dark}}" hint-size="96px,96px"></dc-import>`
Root is size × size. KIND is one of:
- badges: `first-steps, on-a-roll, committed, quarter-strong, mdrt-pace, mdrt-qualified, closer,
  big-week, century, dial-king, sharpshooter, mdrt-bound, untouchable, consistent`
- levels: `level-rookie, level-associate, level-pro, level-elite, level-legend`
- awards: `aotm-api, aotm-apps, quarterly-api, quarterly-apps, persistency-silver, persistency-gold,
  rookie-year, new-business, centurion, agent-year, mdrt`
- campaign: `xmas-champion, xmas-tier` · streak: `streak`
`locked` = grey silhouette with a small lock; `progress` draws a thin ring for locked items.

## Real data additions (may use)
- Company weekly minimums (Tatil workshop 19-05-2026): Calls 60 · Contacts 40 · Appointments
  scheduled 20 · Interviews kept 15 · Fact finds 10 · Closing interviews 10 · Applications 1 ·
  Clients sold 1 · API TTD 4,800 · Referrals/new leads 100.
- KQM Calls = the agent's own calling app/CRM. It holds people, households and opportunities in
  campaigns (e.g. "Portfolio 2026", "Orphans 2026"). Calls logged in KQM already flow into
  AgencyTrack KPIs, and into the company CRM (ApplyOn) as rows that sometimes wait for a human
  (e.g. an appointment location). AgencyTrack is NOT a CRM: people live in KQM, AgencyTrack
  counts the work. Calls happen on the agent's own phone (`tel:` link) plus a captured outcome —
  no call recording, no telephony bridge. An assistant (Tracy-ann) can log calls for Kyron; they
  count as his. Any KQM numbers you show are SAMPLE.
