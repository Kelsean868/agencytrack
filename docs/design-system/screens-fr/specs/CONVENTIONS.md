# AgencyTrack Free Redesign — screen conventions (agent role, mobile)

You are writing mobile artboards for a Design canvas. Each artboard is ONE self-contained
`.dc.html` file under `project/`. Read `project/Commission.dc.html` and `project/Ledger.dc.html`
FIRST and copy their structure exactly (head, helmet, fonts, palette object, header, nav import,
script block). Then write your files. Do NOT publish anything, do NOT touch `project/canvas.json`,
do NOT edit other people's files.

## Hard format rules (each fails silently if broken)
- Keep `<script src="./support.js"></script>` in `<head>` exactly.
- Root `<div>`: fixed `width: 390px; height: <H>px`, same H in `data-props` `$preview`.
  Pick H so content fits (typically 1100–1500). `padding: 12px 16px 104px` (room for the nav).
- Close every element, quote every attribute. Inline `style="…"` for everything; `<helmet><style>`
  only has `body{margin:0}a{color:inherit}`.
- `{{hole}}` = dotted lookup into `renderVals()` ONLY. Never an expression (`{{a+b}}`, `{{!x}}` fail).
  Compute everything in `renderVals()`.
- Loops: `<sc-for list="{{items}}" as="it" hint-placeholder-count="3">`. Branches:
  `<sc-if value="{{flag}}" hint-placeholder-val="{{true}}">`.
- Events: `onClick="{{handler}}"` where handler is a function from `renderVals()`. Per-item handlers
  are built in `renderVals()` with `.map`. State via `this.state` / `this.setState` in a constructor.
- Script: classic JS, `class Component extends DCLogic { renderVals() {...} }`, no imports.
- `data-props` single-quoted JSON. Every screen declares exactly:
  `'{"dark":{"editor":"boolean","default":false},"embedded":{"editor":"boolean","default":false},"onNav":{"editor":null},"$preview":{"width":390,"height":H}}'`
- No emoji. Icons = inline stroke SVG (`fill="none" stroke="currentColor"`, stroke-width ~2,
  `aria-hidden="true"`). Real `<button>`, `<a href>`, `<input>` + `<label>`. `aria-label` on icon-only
  buttons. Every tap target ≥ 44px tall (buttons 44–52px).
- No network except the Google Fonts `<link>` already in the template.

## Look (copy from the template, do not invent a new style)
- Fonts: Newsreader (serif, headings and big numbers, weight 500), Geist (body), Geist Mono
  (small uppercase eyebrows, letter-spacing 0.08em, 11px).
- Palette object in `renderVals()` — use exactly these, switched by `this.props.dark`:
  light `{ bg:'#F6F3EC', surface:'#FFFFFF', sunk:'#ECE7DC', ink:'#1F1D1A', mute:'#5A544A', faint:'#6B6558', rule:'#E2DCD0', accent:'#0B5D5E', onAccent:'#FFFFFF', accentTint:'#DCEAE7', ghost:'#A9D0CB', warm:'#A63D1A', warmTint:'#F7E4DA', gold:'#855400', goldTint:'#F5EAD3' }`
  dark `{ bg:'#131311', surface:'#1D1C19', sunk:'#2A2925', ink:'#F2EFE8', mute:'#BDB6A8', faint:'#A39C8E', rule:'#33312B', accent:'#63C5BF', onAccent:'#0D1B1A', accentTint:'#16312F', ghost:'#2A5552', warm:'#F29066', warmTint:'#3A2217', gold:'#E8B44E', goldTint:'#342911' }`
- Cards: `background: {{c.surface}}; border: 1px solid {{c.rule}}; border-radius: 18px`.
  Section headings: Newsreader 22px. Screen title: Newsreader 28px, with a 44px round back button
  (`background: {{c.sunk}}`) on the left for pushed screens.
- Segmented controls: copy the tablist from Commission.dc.html.
- Settled vs submitted: solid `c.accent` = settled (counts); faint `c.ghost` = submitted, waiting.
- Warnings use `c.warm`; campaigns/awards use `c.gold`.

## Linking (this is how the prototype navigates)
Every link or navigating button MUST be written like this:
`<a href="Ledger.dc.html" onClick="{{go.Ledger}}" …>` and every back button:
`<a href="Numbers.dc.html" onClick="{{go.back}}" aria-label="Back" …>`.
Build `go` in `renderVals()` with this exact helper (list the ids your screen links to):
```js
const go = {};
['Ledger', 'Numbers'].forEach((t) => {
  go[t] = (e) => { if (this.props.onNav) { e.preventDefault(); this.props.onNav(t); } };
});
go.back = (e) => { if (this.props.onNav) { e.preventDefault(); this.props.onNav('back'); } };
```
Return `go` from `renderVals()`.

Screen ids → files (use ONLY these ids; the href is the file):
Home→Home-Swipe.dc.html · Log→Log-Sheet.dc.html · Report→Weekly-Report.dc.html · Plan→Plan.dc.html ·
Prep→Prospect-Prep.dc.html · Numbers→Numbers.dc.html · Ledger→Ledger.dc.html · GamePlan→Game-Plan.dc.html ·
Commission→Commission.dc.html · Me→Me.dc.html · Goals→Goals.dc.html · MoneyNeeds→Money-Needs.dc.html ·
Persistency→Persistency.dc.html · Financing→Financing.dc.html · Awards→Awards.dc.html ·
Campaign→Campaign.dc.html · Leaderboard→Leaderboard.dc.html · History→History.dc.html ·
Career→Career.dc.html · ProdReport→Production-Report.dc.html · CallSources→Call-Sources.dc.html ·
Notifications→Notifications.dc.html · Login→Login.dc.html · Setup→Setup-Wizard.dc.html

Bottom nav: include it ONLY when not embedded:
```html
<sc-if value="{{showNav}}" hint-placeholder-val="{{true}}">
  <div style="position: absolute; left: 0; bottom: 0;">
    <dc-import name="Nav" active="numbers" dark="{{dark}}" hint-size="390px,80px"></dc-import>
  </div>
</sc-if>
```
with `showNav: !this.props.embedded` and `dark: !!this.props.dark` returned from `renderVals()`.
`active` is one of home | plan | numbers | me | none (which tab the screen lives under).

## Data (never invent figures that look real)
Real figures you MAY use: 2026 settled API TTD 87,146 (5 apps); submitted TTD 123,146 (6 apps);
TTD 36,000 · 1 app submitted, not settled; MDRT 2026 threshold TTD 688,800 (13% reached);
TTD 601,654 to go, 14 weeks left, TTD 42,975 a week. Christmas Campaign & Retreat 2026: settled
TTD 73,946 of TTD 275,000 (Champion tier, next tier = Champion, TTD 7,000 cash), 3 of 35 apps,
+TTD 36,000 / +1 app submitted, 96 days left, pace TTD 14.7K + 2–3 apps a week.
Persistency (24-month window, aggregate formula, Tatil memo 29-08-2026): 86.6%, gate 90%;
reinstating TTD 7,100 clears the gate. Family policies count for MDRT only. Jul–Dec monthly awards
are recognition only. Agent: Kyron (initials KM), San Fernando branch. Today: Sunday 27-09-2026,
week 40 (weeks start Sunday). Currency always TTD. Dates always DD-MM-YYYY.
Anything else: either a clear placeholder in square brackets (`[Client name]`, `TTD [n]`,
`[Level name]`) or sample values with a visible `SAMPLE` mono label on that section.
Plain, short English copy. No lorem ipsum.
