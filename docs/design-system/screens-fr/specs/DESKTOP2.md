# AgencyTrack — DESKTOP v2 conventions ("the agent's desk")

The first desktop pass was the phone layout made wider. v2 is designed for how a sales agent works
at a desk: planning the week, working the phones in blocks, preparing meetings, confirming money,
and chasing awards. Use the width: master–detail, inspectors, tables with bulk actions, drag and
drop, keyboard shortcuts, hover actions. Look and feel: macOS (unified translucent toolbar,
sidebar, inspector on the right, popovers, sheets that drop down from the toolbar).

Read `CONVENTIONS.md` (format rules, palette, data, placeholders, SAMPLE labels, `go` helper,
`dark`/`embedded`/`onNav` props) and `DESKTOP.md` (fonts, font link, helmet style, table rules).
Where they conflict, THIS file wins.

## Page skeleton (copy exactly; change CAPS)
```html
<div style="width: {{rootW}}px; height: HEIGHTpx; box-sizing: border-box; display: flex; background: {{c.bg}}; color: {{c.ink}}; font-family: 'Onest', sans-serif; overflow: hidden;">
  <sc-if value="{{showChrome}}" hint-placeholder-val="{{true}}">
    <div style="width: 220px; flex-shrink: 0; align-self: stretch; background: {{c.sideBg}};">
      <dc-import name="D2-Sidebar" active="SIDEBAR_ID" dark="{{dark}}" h="{{HEIGHT}}" hint-size="220px,HEIGHTpx"></dc-import>
    </div>
  </sc-if>
  <main style="width: 1220px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0;">
    <!-- TOOLBAR: always drawn by the page itself (also when embedded) -->
    <header style="height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 0 20px 0 28px; display: flex; align-items: center; gap: 12px; background: {{c.glass}}; border-bottom: 1px solid {{c.rule}};">
      <h1 style="margin: 0; font-family: 'Bricolage Grotesque', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">TITLE</h1>
      … page controls (segmented, filters) …
      <span style="flex-grow: 1;"></span>
      … search field (onClick go.Search, href D2-Today.dc.html, 240px, "Search  Ctrl K") and page actions …
    </header>
    … page body (flex-grow: 1; usually a row of panes) …
  </main>
</div>
```
- `renderVals()` returns `showChrome: !this.props.embedded`, `rootW: this.props.embedded ? 1220 : 1440`,
  `dark: !!this.props.dark`, `c`, `go`, plus your values.
- Palette: the CONVENTIONS palette plus `sideBg` (light `'#EFEBE2'`, dark `'#181816'`), `glass`
  (light `'rgba(246,243,236,0.86)'`, dark `'rgba(19,19,17,0.86)'`), `pane` (light `'#FBFAF6'`, dark `'#171714'`),
  `sel` (selected row: light `'#DCEAE7'`, dark `'#16312F'`).
- HEIGHT: 900 is the window height. Panes scroll INSIDE (`overflow-y: auto`), so most pages are
  exactly 900 tall. Only go taller if a design really needs a long page.
- SIDEBAR_ID: Today · Calls · Pipeline · Week · Ledger · Money · Arena · Me.
- No top bar component, no bottom nav, no back button unless it is a drill-down inside the page.

## macOS feel (do these)
- Toolbar 56px, translucent `c.glass`, hairline under it. Controls in the toolbar are 32–36px tall
  visually but their hit area is ≥ 44px (use padding or a 44px-tall wrapper).
- Three-pane layouts: list pane (`background: {{c.pane}}`, right hairline) · content · inspector
  (320–360px, left hairline). Selected list row: `background: {{c.sel}}`, radius 8.
- Hover actions: rows reveal small action buttons on hover via helmet CSS
  (`.row .acts{opacity:0;transition:opacity 120ms}.row:hover .acts{opacity:1}`). Actions must also be
  reachable without hover (they are always in the inspector).
- Keyboard hints: `<kbd>` chips (JetBrains Mono 11px, `background: {{c.sunk}}`, radius 5, padding 2px 6px).
- Motion inside a page: use CSS keyframes in the helmet, curve `cubic-bezier(0.32, 0.72, 0, 1)`,
  220–420ms. Selection changes: inspector content fades/slides 8px. Popovers: scale from 0.96 + fade,
  `transform-origin` at the button. Add `@media (prefers-reduced-motion: reduce){*{animation-duration:1ms !important;transition-duration:1ms !important}}`.
- Drag and drop (where asked): pointer events. On pointerdown record the item; while dragging show
  the item "lifted" (scale 1.03, bigger shadow) following the pointer 1:1 with the grab offset; drop
  targets highlight on hover; on drop update state and let the card settle with a transition. Also give
  a non-drag way to do the same (a "Move to…" button/menu) for accessibility.

## Linking (ids → files)
Today→D2-Today · Calls→D2-Power-Hour · Pipeline→D2-Pipeline · Week→D2-Week · Ledger→D2-Ledger ·
Money→D2-Money · Arena→D2-Arena · Me→D2-Me · Report→D2-Report · Search→D2-Today (the shell opens
the palette) · Log→Log-Sheet · AddAppt→Add-Appointment · Outcome→Outcome (these three open as
sheets in the shell; link to the mobile files as they are). Params and toasts as in DESKTOP.md.

## The game (use these exact rules and names — they are the live app's)
- Points: dial 1 · letter 1 (cap 20/wk) · referral 3 · appointment set 3 · FFI 5 · CI 10 · application 25 ·
  per TTD 1,000 API 1 · policy delivered 3 · annual review 5 · reinstatement 10.
- Levels: Rookie (0) · Associate (500) · Pro (1,500) · Elite (3,500) · Legend (7,000). Kyron: Pro,
  2,940 pts, 560 to Elite (SAMPLE).
- Leaderboard ranks by period API (TTD). Period chips: WK · MTD · QTD · YTD (default YTD). Podium labels:
  Champion · Runner-up · Third place. Movement arrows only for WK. Agents do not get a scope picker.
- Streak: 13 weeks (SAMPLE); milestones 5 · 10 · 25 · 52.
- Badges: First Steps, On a Roll, Committed, Quarter Strong, MDRT Pace, MDRT Qualified, Closer, Big Week,
  Century, Dial King, Sharpshooter, MDRT Bound, Untouchable, Consistent.
- Award groups: ✓ Qualified · ★ Almost there · 70%+ · ↗ Making progress · 30–70% · ◯ Just starting · under 30%.
  Award names: Advisor of the Month — API, Advisor of the Month — Apps, Quarterly API Award, Quarterly Apps
  Award, Persistency Award — Silver/Gold, Rookie of the Year, New Business Advisor Award, Centurion Award,
  Agent of the Year, MDRT. Source chips: "LIVE FROM POLICY LEDGER" / "FROM CONFIRMED SETTLEMENTS".
- Campaign persistency gate bands: ≥90% → 100% of the prize · ≥85% → 50% · ≥80% → 25% · <80% → not qualified.
  Kyron is at 86.6% → 50% band today; +TTD 7,100 reinstated → 90%+ → 100% band.
- Celebrations: full-window takeover — medal circle that pops, glowing halo, confetti (deterministic
  positions, no Math.random), numbers that count up, level-up line when a threshold is crossed.
