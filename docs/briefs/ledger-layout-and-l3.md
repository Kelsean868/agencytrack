# Brief — Ledger layout to match D1/D3, MDRT vs company minimum, L3 chips, small fixes

> One orchestrated run, serial PRs. **LX** (layout) Opus 5.5 · high. **MX** (MDRT label) Sonnet 5 · medium. **L3** (chips) Sonnet 5 · medium. **FX** (small fixes) Sonnet 5 · low.
> Client-only. Same rules as `docs/briefs/autorun-2026-09-26-ledger.md` (frontend-only merges, gates, design-check ritual, production smoke, auto-revert, park-not-run). Design source unchanged: `docs/design-system/proposals/ledger-2026-09/` (D1, D2, D3, D4).

## Why
L0–L2 (#980–#982) built the parts, but `src/components/agent/PolicyLedgerPanel.jsx` still wraps them in the OLD page: the old `PipelineStrip` hero sits on top, the old `LEDGER_FILTERS` tab strip + search sits between the award card and the list, and there is no page header with export or saved-view chip row as in D1/D3. Kyron (26 Sep): "it looks different from any mockup" — on desktop especially. Target = the mockups, block for block.

## LX — Page layout matches D1 (mobile) and D3 (desktop)
Order, top to bottom, both breakpoints (desktop keeps the app sidebar):
1. **Page header**: "Policy ledger" + mono line "HEAD OFFICE LIST AS OF <latest import date>" (hide the line if no import); right side: search (desktop) and **Export** button (menu from L2: CSV, PDF check sheet — no Excel, Kyron 26 Sep). Mobile: export as an icon button in the header.
2. **Saved-view chips row** (D1) / **view tabs** (D3): All policies · ★ <active campaign> · user-saved views · "+ Save view". This REPLACES the old `LEDGER_FILTERS` tab strip. Views with no data behind them (Needs confirming, Lapse risk) stay hidden until data exists.
3. **"Counts toward" selector** (D4 chips).
4. **Award card** (D1 mobile card / D3 desktop strip: tier picker left, three rings middle, pace text right).
5. **Search + Filter · n + Sort** row (mobile, D1); desktop search lives in the header.
6. **Active filter chips + Clear**.
7. **List**: mobile grouped cards (Counting / Submitted, not settled / Not counting here); desktop = filter rail LEFT + table RIGHT + footer counts (D3).
- **Remove `PipelineStrip` from the top of the ledger.** Its figures now live in the award card and Home. If other screens use `PipelineStrip`, leave the component; just stop rendering it here. (Kyron chose the mockup layout.)
- Empty / loading / error states keep working for every block.
- Deliverable: side-by-side screenshot pairs in the PR — mockup vs build — for D1 (390) and D3 (1440), light + dark. Render with fixture data locally where the test agent has none; label them. A reviewer must be able to see they match.

## MX — "MDRT" on the Awards tab uses the real MDRT line
- Fact (MDRT official 2025/2026 conversion table, checked 26 Sep 2026): Trinidad & Tobago **2026 MDRT premium = TTD 688,800** (2025: 625,600). Already in `src/config/mdrtThresholds/2026.js`.
- The Awards tab's `ruleset.mdrtAward.apiThreshold` = 500,000 is NOT MDRT. It is the **Tatil company minimum for 6+ years of service** (company minimums: < 2 yrs 250,000 API / 40 apps; 2–5 yrs 350,000 / 40; 6+ yrs 500,000 / 40 — see `docs/briefs/tenure-company-floor-kickoff.md` and the existing tenure-floor code).
- Change: the MDRT award reads its threshold from `MDRT_THRESHOLDS_2026` (keep `apiInContention` proportional or from the same config — state which). Where the app shows the company minimum, label it "Company minimum (<n>+ yrs)" from the existing tenure-floor logic — do not hard-code 500,000. Awards tab, Home and Ledger must agree; add a parity test.

## L3 — "Counts toward" chips
As in `docs/briefs/ledger-lens-build.md` § L3 (engine helper already exists from L1).

## FX — small fixes
1. Ledger date boxes cut off the last digit of the year — widen / use `inputmode` + proper width.
2. Home hero ring legend wording: match C1 ("Settled 87,146 · Submitted 123,146" pattern with real values).

## Report
`docs/reports/autorun-<date>-ledger-layout.md` + final message, same format as the last run.
