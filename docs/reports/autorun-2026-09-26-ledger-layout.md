# Autorun — 26–27 Sep 2026 — Ledger layout, MDRT, L3 chips, small fixes — report

**Result:** 4 merged (LX, MX, L3, FX). No holds. No auto-reverts. No deploys. No production data writes.

Brief: `docs/briefs/ledger-layout-and-l3.md` (landed on `main` as `01262033`, Rule 15 checked). Rules: `docs/briefs/autorun-2026-09-26-ledger.md`.

| Item | Status | PR | Merge SHA | Post-merge fill |
|---|---|---|---|---|
| LX Page layout matches D1 / D3 | **MERGED** | [#983](https://github.com/Kelsean868/agencytrack/pull/983) | `869ca694` | `b795d9fd` |
| MX MDRT award uses 688,800 | **MERGED** | [#984](https://github.com/Kelsean868/agencytrack/pull/984) | `1662ac4f` | `19eb561b` |
| L3 "Counts toward" chips | **MERGED** | [#985](https://github.com/Kelsean868/agencytrack/pull/985) | `a9053196` | `339e8de7` |
| FX Date boxes + hero legend | **MERGED** | [#986](https://github.com/Kelsean868/agencytrack/pull/986) | `2e18be8e` | this commit |

Every merge: only `src/`, `docs/` and `scripts/verification/` changed. CI green on the exact head SHA. Production deploy succeeded. Production smoke passed after each merge (390 + 1440, light, read-only, A11Y test agent: Home, Awards, Policy Ledger load; no console errors; no side scroll). Screenshots: `docs/reports/screenshots/ledger-2026-09-26/prod-lx/`, `prod-mx/`, `prod-l3/`, `prod-fx/`.

---

## LX — Page layout — MERGED

- Head `1d4d4392`. Lint 0. CI 421 files / 7,111 tests. Build OK. CodeRabbit rate-limited (no review).
- New order at both sizes: header (title, head-office date, search on desktop, Export) → view chips → Counts toward → award card → search / Filter / Sort row (mobile) → active chips → list.
- The old pipeline strip and the old filter tab strip are gone from the ledger.
- Mockup-vs-build pairs (your condition): `docs/reports/screenshots/ledger-2026-09-26/lx/pair-D1-390-light.png`, `pair-D1-390-dark.png`, `pair-D3-1440-light.png`, `pair-D3-1440-dark.png`. The mockups have no dark version, so the dark pairs show the light mockup beside the dark build.

| Mockup block | Matches | Note |
|---|---|---|
| 1 Header + Export | yes | New Policy and Import kept in the header |
| 2 View chips | yes | "Needs confirming" / "Lapse risk" hidden: no data |
| 3 Counts toward | yes | |
| 4 Award card | yes | Desktop strip: tier picker, 3 rings, pace |
| 5 Search / Filter / Sort (mobile) | yes | |
| 6 Active chips + Clear | yes | |
| 7 List — mobile cards | partial | Existing card, not D1's slim card |
| 7 List — desktop rail + table | partial | Rail uses chips, not checkboxes; long page. Table scrolls sideways at 1440 |

## MX — MDRT line — MERGED

- Head `fee3a4ca`. Lint 0. 422 files / 7,119 tests. Build OK. CodeRabbit: summary, low risk, 0 findings.
- The Awards-tab MDRT award now uses 688,800 (the real 2026 MDRT line). "In contention" starts at 50% = 344,400.
- A saved tenant ruleset that still says 500,000 is ignored for MDRT. The admin editor no longer shows the MDRT number fields (prize still editable).
- The company floor row now says "Company minimum (<years>)", from the existing tenure bands.
- A parity test proves Awards = Home = ledger = 688,800.
- Live check: production Awards shows "TTD 540,554 of TTD 688,800" for the test agent.

| Surface | Shows 688,800 | Note |
|---|---|---|
| Awards MDRT card (fixture, 3 states) | yes | 390 / 1440, light / dark |
| Awards MDRT card (production) | yes | `prod-mx/awards-1440.png` |
| Home hero / ledger MDRT | yes | Already 688,800; now covered by the parity test |

## L3 — Chips — MERGED

- Head `cde43bcf`. Lint 0. 421 files / 7,120 tests (builder's run). Build OK. CodeRabbit rate-limited.
- Gold chips on every policy card and in the drawer list the open award windows the policy counts toward. Waiting policies show grey "Will count toward" chips.
- Family policies show MDRT only. NTU and out-of-window policies show none.
- Chips come from the same engine helper as the award lens. They cannot disagree with it.

| Mockup block | Matches | Note |
|---|---|---|
| D4 gold chip row | yes | |
| D4 grey "Will count toward" row | yes | |
| D4 family → MDRT only | yes | |
| D4 short all-caps labels ("SEP", "Q3") | no | Uses the selector's labels ("Sep 2026") as the brief asked |
| D4 closed-month chip ("AUG") | no | Only open windows get chips |

## FX — Small fixes — MERGED

- Head `8b7d5257` (updated with `main` after MX and L3). CI 423 files / 7,135 tests. CI all pass. CodeRabbit rate-limited.
- Date boxes: full `DD-MM-YYYY` now fits (390: 169 px box, 1440: 194 px box; text width = box width). The desktop rail stacks From / To.
- Home hero legend now reads "Settled 87,146 · Submitted 123,146" (real values), like C1. Other rings keep their words.

| Block | Matches | Note |
|---|---|---|
| Date boxes 390 / 1440 | yes | Measured, not eyeballed |
| C1 hero legend values | yes | Hidden when nothing is waiting, as before |

---

## Decisions I made without Kyron

1. **MDRT "in contention" = 50% of the line (344,400).** Same ratio as the old 250,000 / 500,000.
2. **MDRT fields removed from the admin ruleset editor.** They no longer do anything; an editable field that does nothing is a trap.
3. **Company minimum labels follow the app's tenure table, not the brief's table.** The two disagree (see "Kyron must rule").
4. **LX kept New Policy and Import in the header.** The mockups have no slot for them; removing them would remove features.
5. **LX moved the campaign Persistency reading into one shared helper** so Home and the ledger read it the same way.
6. **L3 chips show open windows only**, with the selector's labels.
7. **FX legend "Submitted" = the hero's own "Submitted" figure.** It is the number already on the card.
8. **I merged `main` into MX and FX before merging** so CI ran on the combined code.

## FOLLOW_UPS banked this run

| Item | Severity |
|---|---|
| Company minimum bands: brief (3 bands) vs `tenureFloors.js` (6 bands) — you rule | MEDIUM |
| LX partial blocks vs D1 / D3 (card, rail, 1440 table side scroll) | LOW |
| Closed this run: Awards-tab MDRT 500,000 vs 688,800; L2 date boxes clip the year; L0 hero legend value form | — |

## What Kyron does next

1. **Rule on company minimums.** Brief: < 2 yrs 250,000 · 2–5 yrs 350,000 · 6+ yrs 500,000 (40 apps). App: 150,000 / 200,000 / 250,000 / 300,000 / 400,000 / 500,000 by year of service. Which is current? (FU "Company minimum bands: brief vs tenureFloors".)
2. **Look at the ledger with real data.** Open production as yourself → Policy Ledger. The test agent has no policies, so no one has seen LX, L3 or FX with real data. Read-only is enough.
3. **Decide on the LX partials** (slim card, checkbox rail, table fit). Small restyle PR if you want them.
4. **Still open from the last run:** Excel export vs Ruling 1.

## Known gaps

- Nothing in this run was seen with real policies. All populated states were checked on local fixture renders and unit tests.
- CodeRabbit gave one summary (MX) and was rate-limited on LX, L3 and FX. No line-level review ran.
- The Sonnet builders for MX, L3 and FX stopped on usage limits after opening their PRs. I finished their gates, reviews and merges on Opus. I re-ran the MX gates locally after merging `main`. For L3 and FX I relied on the builders' runs plus CI on the exact head.
- The run was interrupted by a session restart and a long idle gap, so it ran past the 3 h 30 min time box in wall-clock time. No item was started after the builders had stopped except by me finishing open PRs.
- FX: the faint ring draws settled + waiting; the legend's "Submitted" is the hero's submitted figure. They use different date rules and can differ a little.
