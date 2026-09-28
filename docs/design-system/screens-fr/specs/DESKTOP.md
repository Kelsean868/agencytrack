# AgencyTrack Free Redesign — DESKTOP screen conventions (agent role)

Read `CONVENTIONS.md` first. Every rule there still applies (format rules, palette, fonts, data,
placeholders, SAMPLE labels, `go` helper, `dark`/`embedded`/`onNav` props) EXCEPT where this file
says otherwise. Fonts are now: 'Bricolage Grotesque' (headings, big numbers, weight 700,
letter-spacing -0.02em), 'Onest' (body), 'JetBrains Mono' (small uppercase labels). Use this font
link in `<helmet>`:
`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Onest:wght@400..800&family=JetBrains+Mono:wght@500;600&display=swap`
and this style: `<style>body{margin:0}a{color:inherit}*{font-variant-numeric:tabular-nums}</style>`

Read `project/D-Home.dc.html` (the desktop template) and the MOBILE file of each screen you build
(same name without `D-`, e.g. `project/Ledger.dc.html`). The desktop screen must keep EVERY feature,
figure, label and interaction of the mobile one, but use the wide layout well (columns, tables,
side panels) instead of stretching the phone layout.

## Page skeleton (copy exactly, change the parts in CAPS)
```html
<div style="width: {{rootW}}px; height: HEIGHTpx; box-sizing: border-box; display: flex; background: {{c.bg}}; color: {{c.ink}}; font-family: 'Onest', sans-serif; overflow: hidden;">
  <sc-if value="{{showChrome}}" hint-placeholder-val="{{true}}">
    <div style="width: 240px; flex-shrink: 0; align-self: stretch; background: {{c.sideBg}};">
      <dc-import name="D-Sidebar" active="SIDEBAR_ID" dark="{{dark}}" h="{{HEIGHT}}" hint-size="240px,HEIGHTpx"></dc-import>
    </div>
  </sc-if>
  <main style="width: 1200px; flex-shrink: 0; display: flex; flex-direction: column;">
    <sc-if value="{{showChrome}}" hint-placeholder-val="{{true}}">
      <dc-import name="D-Topbar" title="PAGE TITLE" sub="SHORT SUBTITLE" back="BACK_FILE_STEM_OR_EMPTY" dark="{{dark}}" hint-size="1200px,64px"></dc-import>
    </sc-if>
    <div style="padding: 24px 32px 40px; display: flex; flex-direction: column; gap: 24px;">
      … PAGE CONTENT (1136px wide) …
    </div>
  </main>
</div>
```
- `renderVals()` must return: `showChrome: !this.props.embedded`, `rootW: this.props.embedded ? 1200 : 1440`,
  `dark: !!this.props.dark`, `c`, `go`, plus your own values.
- Add `sideBg` to both palettes: light `'#EFEBE2'`, dark `'#181816'`.
- HEIGHT: 900 minimum; taller if the content needs it (up to ~1500). `$preview` = `{"width":1440,"height":HEIGHT}`.
- SIDEBAR_ID is one of: Home, Plan, Ledger, Goals, GamePlan, MoneyNeeds, Commission, Persistency,
  Financing, Awards, Leaderboard, History, Career, ProdReport, CallSources, Me.
- Do NOT draw a page title inside the content (the top bar has it) and do NOT draw a back button
  inside the content (pass `back="D-Numbers"`-style stem to the top bar only when the page is a
  drill-down, e.g. Campaign → back="D-Awards").
- No bottom nav on desktop.

## Desktop layout rules
- Content width is 1136px. Use CSS grid with `repeat(N, minmax(0, 1fr))` and `gap: 24px`.
  Typical: a 2/3 + 1/3 split (`grid-template-columns: minmax(0, 2fr) minmax(0, 1fr)`), or 3 equal columns,
  or a KPI strip of 4 cards on top then detail below.
- Lists with many rows become real `<table>`s (thead with column labels in 12px mute uppercase-ish Onest 600,
  rows 52px tall, numbers right-aligned, a hover background via helmet CSS `tr.row:hover{background:…}` is fine).
- Controls: 40–44px tall (keep ≥ 44px for anything primary). Segmented controls / chips as on mobile.
- Drawers and modals on desktop are drawn INSIDE the page only when the mobile screen has that state
  (e.g. a detail panel). Otherwise keep it simple.
- Keyboard hints where natural: small `<kbd>` chips (JetBrains Mono 11px, `background: {{c.sunk}}`, radius 6).
- Hover: you may add simple `:hover` rules in the helmet `<style>` using classes (e.g. `.row:hover{…}`),
  but colours in those rules must be literal hex for light mode only; do not rely on them for meaning.

## Linking on desktop
Same ids and `go` helper as mobile, but hrefs point to desktop files:
Home→D-Home · Plan→D-Plan · Prep→D-Prospect-Prep · Ledger→D-Ledger · GamePlan→D-Game-Plan ·
Commission→D-Commission · Me→D-Settings · Goals→D-Goals · MoneyNeeds→D-Money-Needs ·
Persistency→D-Persistency · Financing→D-Financing · Awards→D-Awards · Campaign→D-Campaign ·
Leaderboard→D-Leaderboard · History→D-History · Career→D-Career · ProdReport→D-Production-Report ·
CallSources→D-Call-Sources · Notifications→D-Notifications · Report→D-Weekly-Report · Search→D-Search ·
Login→D-Login · Setup→D-Setup-Wizard · Numbers→D-Home (there is no Numbers hub on desktop; the sidebar replaces it).
Panels that stay mobile-sized and open as side drawers on desktop (link to these files as they are):
Log→Log-Sheet · AddAppt→Add-Appointment · Outcome→Outcome.
Params: to open booking pre-filled call `this.props.onNav('AddAppt?type=0&client=[Client name]')`
(href Add-Appointment.dc.html), exactly like the mobile Plan does.
Toasts: where mobile emits `this.props.onNav('event:toast:…')`, do the same.

When done, reply ONLY with: each file name, its HEIGHT, and interactive yes/no.
