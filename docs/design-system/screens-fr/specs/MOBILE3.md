# Mobile v3 — carry the desktop v3 work to the phone

The mobile prototype (Proto.dc.html) was built before desktop v2/v3. Desktop v3 added: Pipeline
(Funnel + Board), Focus sessions (Calls · Win-back · Paperwork), the Money calculators rebuilt from
the live app (see DESKTOP3-MONEY.md + MONEY-INVENTORY.md), month-by-month persistency bars, the
reinstatement planner, Coach insights, trophies (D3-Trophy component), Connections (KQM), gliding
charts. Mobile v3 brings all of that to a 390px phone — redesigned for thumbs, not shrunk.

Read first: CONVENTIONS.md (format rules, palette, data, `go` helper, SAMPLE labels), MOTION3.md
(motion), DESKTOP3.md (chart rules, trophy kinds, KQM facts), DESKTOP3-MONEY.md (real money
figures and formulas). For content, read the desktop v3 source file(s) named in your task — your
mobile screen must keep every feature they have (reachable on the phone, maybe one tap deeper).
For structure copy an existing mobile screen, e.g. project/Persistency.dc.html or
project/Commission.dc.html (head, helmet, fonts, palette, header, Nav block, script shape).

## Format (strict)
- File `project/M3-<Name>.dc.html`. Root: `width: 390px; height: <H>px` (tall pages are fine,
  the prototype scrolls the whole screen; pick H so content fits, and set the same H in
  `$preview`). Padding `12px 16px 104px` (room for the tab bar).
- data-props exactly:
  `'{"dark":{"editor":"boolean","default":false},"embedded":{"editor":"boolean","default":false},"params":{"editor":null},"onNav":{"editor":null},"$preview":{"width":390,"height":H}}'`
- Bottom nav only when not embedded:
  `<sc-if value="{{showNav}}" hint-placeholder-val="{{true}}"><div style="position: absolute; left: 0; bottom: 0;"><dc-import name="M3-Nav" active="TAB" dark="{{dark}}" hint-size="390px,84px"></dc-import></div></sc-if>`
  TAB = today | pipeline | money | arena | none.
- `{{dotted.lookup}}` holes only; sc-for/sc-if with hint attrs; `class Component extends DCLogic`;
  `onClick="{{fn}}"`; no emoji / no dingbat characters (✓ ★ ↗ ◯ …) — inline SVG icons;
  44px tap targets (primary buttons 48–52px); real inputs with labels.
- Header: screen title Bricolage Grotesque 28px 700 (-0.02em); pushed screens get a 44px round
  back button (`go.back`). Cards: surface, 1px rule, radius 18–20.
- Linking: `<a href="M3-X.dc.html" onClick="{{go.X}}">`; build `go` with the CONVENTIONS helper.

## Screen ids → files (use ONLY these ids with onNav)
Today→M3-Home · Focus→M3-Focus (params mode=Calls|Winback|Paperwork) · Pipeline→M3-Pipeline
(params view=Funnel|Board) · Numbers→M3-Numbers · Money→M3-Money · Goals→M3-Goals ·
GamePlan→M3-GamePlan · MoneyNeeds→M3-MoneyNeeds · Commission→M3-Commission ·
Persistency→M3-Persistency · Financing→Financing · Ledger→M3-Ledger (params view=Winback) ·
Arena→M3-Arena · Trophies→M3-Trophies · Awards→M3-Awards · Campaign→M3-Campaign ·
Connections→M3-Connections · Me→Me · Plan→Plan · Prep→Prospect-Prep · Log→Log-Sheet ·
Report→Weekly-Report · AddAppt→Add-Appointment · Outcome→Outcome · Search→Search ·
Notifications→Notifications · History→History · Career→Career · ProdReport→Production-Report ·
CallSources→Call-Sources.
Pass params in the id: `this.props.onNav('Focus?mode=Winback')`. Read them from
`this.props.params` (a string like `mode=Winback` in the prototype) — parse with
`/mode=([A-Za-z]+)/` etc. Toasts: `onNav('event:toast:Saved · …')`.

## Phone patterns (use these)
- Calculators: results on the screen, inputs in an in-page BOTTOM SHEET opened by a sticky
  "Adjust" button (sheet slides up with the iOS curve `cubic-bezier(0.32,0.72,0,1)`, 44px drag
  handle row, a Done button). Results behind it update live and glide.
- Tabs inside a screen: horizontally scrollable chip row (44px tall), active chip filled.
- Lists: 56–64px rows, swipe is NOT required — use a trailing "…" button that opens a small
  action sheet.
- Charts: fewer points than desktop, bigger labels (≥11px), still titled with the takeaway and
  with a Table toggle; glide on change (MOTION3.md).
- Focus sessions: one person/task per screen, huge outcome buttons (≥56px) in the thumb zone.

## Reinstatement / Win-back (new flow, same on desktop and mobile)
Lapsed policies still inside the 24-month window (the 7 in DESKTOP3-MONEY.md) are the ONLY ones
that can move persistency. The flow:
1. Persistency → reinstatement planner: tick policies (smallest set pre-ticked) → "Add to win-back"
   / "Start win-back session".
2. Focus · Win-back: call each client; outcomes: 1 Will reinstate · 2 Send form · 3 Call back ·
   4 No answer · 5 Not interested. Each policy carries a status track:
   To call → Agreed → Form sent → Paid → Reinstated (waiting on head office).
   Persistency meter updates as policies reach "Paid" (projected) — 86.6% → 90.1% with the pair.
3. Policy ledger → "Win-back" view: the same policies with their status; "Mark reinstated" sets
   "Reinstated · waiting on head office" (self-confirmed, like self-confirmed settlements — the
   next OIPA export confirms it). Only the confirmed figure counts for awards; the projected
   figure shows the effect straight away.
