# Autorun — 26 Sep 2026 afternoon — Policy Ledger build report

**Result:** 3 merged (L0, L1, L2). L3 not started (time box). No holds. No auto-reverts. No deploys. No production data writes.

| Item | Status | PR | Merge SHA | Post-merge fill |
|---|---|---|---|---|
| Step 0 — land brief, run file, 8 mockups | DONE | — | `f5a7a16c` on `main` (Rule 15 checked) | — |
| L0 Two-layer rings | **MERGED** | [#980](https://github.com/Kelsean868/agencytrack/pull/980) | `0fcf215d` | `fb4ddc7a` |
| L1 Award lens | **MERGED** | [#981](https://github.com/Kelsean868/agencytrack/pull/981) | `72a87fd9` | `8bc2ab88` |
| L2 Filter, sort, saved views, export | **MERGED** | [#982](https://github.com/Kelsean868/agencytrack/pull/982) | `6cee9c56` | this commit |
| L3 "Counts toward" chips | **NOT STARTED** | — | — | — |

Every merge: only `src/`, `docs/` and test scripts changed. CI green on the exact head SHA. Production deploy succeeded. Production smoke passed (390 + 1440, light, read-only, A11Y test agent: Home, Awards, Policy Ledger load; no console errors; no side scroll).

---

## L0 — Two-layer rings — MERGED

- Head `28787ef2`. Lint 0. Tests 413 files / 6,978. Build OK. CodeRabbit: summary only, 0 findings.
- The donut shows settled (solid) in front and settled + submitted (faint) behind. Home hero, Home campaign card, Campaign screen API and Apps rings. Persistency ring unchanged.

| Mockup block | Matches | Note |
|---|---|---|
| C1/C3 hero ring + "+x submitted" | yes | Legend uses plain labels, not the C1 value form (LOW FU) |
| C1/C3 campaign card rings | yes | Legend hidden when nothing is waiting |
| C2/C4 Campaign screen API + Apps | yes | Persistency ring has no faint arc |
| Dark mode faint arc | yes | Visible but soft on the campaign card |
| No-pending state (preview, real data) | yes | Same as before L0 |

Screenshots: `docs/reports/screenshots/ledger-2026-09-26/l0/` (preview + `local-fixture-*`), production `prod-l0/`.

## L1 — Award lens — MERGED

- Head `ad84b287`. Lint 0. Tests 417 files / 7,038. Build OK. CodeRabbit: summary (low risk, 0 findings), then rate-limited.
- "Counts toward" selector: campaign ★, this month, this quarter, this year, MDRT, past periods. Card per award. List grouped Counting / Submitted, not settled / Not counting here, with the engine's reason. One engine: new per-policy helpers in `ledgerProduction.js`; tests prove the totals equal the Awards tab and the campaign lens.

| Mockup block | Matches | Note |
|---|---|---|
| D4 selector | yes | "Past period…" is a select styled as a chip |
| D4 campaign card + D1 tier picker | yes | Selected tier uses gold ink (white on bright gold failed contrast) |
| D4 month / quarter / annual boxes | yes | "Your credit" wording |
| D4 MDRT ring | yes | 688,800, same as Home (after my fix) |
| D4 closed period | yes | "Closed · final credit" |
| D4 / D1 grouped lists | yes | Cards are taller than the mockup (existing card + credit line) |
| D1 head-office flag | yes | Only where the data can prove it |
| D3 desktop strip + 2-column cards | yes | |
| C2/C4 Campaign hero picker | yes | Fixture only |

Screenshots: `l1/` (preview + 36 `local-fixture-*`), production `prod-l1/`.

## L2 — Filter, sort, saved views, export — MERGED

- Head `827a2746`. Lint 0. Tests 420 files / 7,095. Build OK. CodeRabbit: summary (low risk, 0 findings), then rate-limited.
- Mobile filter sheet, desktop rail with counts, sorts, filter chips with Clear, saved views, desktop table (sticky header and first column, footer counts). Export the filtered rows: CSV and a PDF head-office check sheet.

| Mockup block | Matches | Note |
|---|---|---|
| D2 filter sheet | yes | Dark-mode radios fixed in my review round |
| D2 sort list | partial | "Next premium due" hidden: no data field |
| D2/D3 Needs attention | not built | No data field for any of the 3 filters |
| D3 rail beside table | yes | Fixed in my review round (was stacked above) |
| D3 table + footer | yes | Date boxes cut the last year digit (LOW FU) |
| D3 view chips | partial | "Needs confirming" and "Lapse risk" views hidden: no data |
| D3 export menu | partial | CSV + PDF. No Excel (Ruling 1) |

Screenshots: `l2/` (preview + `local-fixture-*`), production `prod-l2/`.

## L3 — NOT STARTED

The run passed its 3 h 30 min time box while L2 was in its fix round. The rules say finish the current item, start nothing new. L3 is small: the engine helper it needs (`awardWindowsForPolicy`) is already built and tested.

---

## Decisions I made without Kyron

1. **"Waiting to settle" is its own figure** (L0). It is not "submitted minus settled"; that mixes two date rules. It counts policies sent in but not settled, and not NTU / denied / lapsed.
2. **Campaign "waiting" = the lens's existing pending set** (L0), now carrying its would-be credit. No existing number changed.
3. **No rules change for saving** (L1, L2). The rules already let an agent write its own `prefs/app` doc. Target tier → `ledgerTargetTiers`, saved views → `ledgerSavedViews`.
4. **MDRT in the ledger = 688,800** (L1). The first build used the Awards-tab figure, 500,000. Home shows 688,800. I made the ledger match Home and logged the clash for you.
5. **PDF via `@react-pdf`, not jspdf** (L2). The jspdf version needed a `vite.config.js` change. That file is outside the merge rule and changes how every page loads.
6. **No Excel export** (L2). A standing rule (Ruling 1) bans the Excel library in the app. We did not weaken it.
7. **Hide, do not guess** (L1, L2). Head-office flag only where provable. Filters with no data behind them are hidden.

## FOLLOW_UPS banked this run

| Item | Severity |
|---|---|
| Awards-tab MDRT award 500,000 vs 688,800 everywhere else — you rule | MEDIUM |
| Excel export blocked by Ruling 1 — you rule | MEDIUM |
| Head-office flag needs a per-import list to catch older missing policies | MEDIUM |
| Needs attention / Paid-to / Next premium due: no data field | (see entry) |
| Plain radio buttons may be unreadable in dark mode elsewhere in the app | (see entry) |
| L0 hero legend: value form from C1 | LOW |
| L2 date boxes cut the last year digit | LOW |

## What Kyron does next

1. **Rule on MDRT:** is Tatil's MDRT award line 500,000 or 688,800? (FU "Awards-tab MDRT award…")
2. **Rule on Excel:** CSV only, or allow an Excel export library?
3. **Look at the ledger with real data.** Open production signed in as yourself: Policy Ledger → "Counts toward". The test agent has no policies and no campaign, so no one has seen these screens with real data. Read-only is enough.
4. **Start L3** from the same brief (`docs/briefs/ledger-lens-build.md` § L3) when ready.
5. **Cleanup:** the L0 and L1 work copies are removed (an empty `ledger-l0` folder may remain; a file lock). The **L2 work copy** `C:\Projects\agencytrack-worktrees\ledger-l2` was **left in place**: it holds 5 re-made 1440-light fixture screenshots that were never committed (the merged versions are on `main`). Delete it with the junction-safe steps in `/post-merge` once you do not want them.

## Known gaps

- No lens, ring or filter screen was seen with real data. All checked on local fixture renders and unit tests.
- CodeRabbit gave summaries only, then hit its rate limit. No line-level review ran on any commit.
- The L1 card line "your branch manager chooses the winner" comes from the mockup. I did not check it against the award rules.
