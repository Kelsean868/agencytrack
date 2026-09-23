> Model: **Opus 5.5**, effort **high**. One PR. It touches the persistency gate that decides the retreat, and it may write a persistency record, so the care is in provenance, not layout.

# Brief — Persistency: derived, confirmed, and estimated live

## Why

Kyron has no 24-month persistency record saved, so the campaign card's gate row reads "—" and cannot warn him. The ledger can already derive the figure (`src/lib/persistency/deriveFromLedger.js` + `calculations.js#deriveAll`), but only inside the Persistency tab's entry form, which will not save until the four "not in export" inputs are typed. So nothing reaches any hero.

Kyron's ruling (23 Sep 2026): show the head-office-derived month as **derived**, let him **confirm** it against the HO report later, and show a separate **estimated today** figure that moves as he keys policies.

## Live figures (read-only probe, 23 Sep 2026, export 15 Sep, annuity rule `ignore` per ruling R5, the four manual inputs at 0)

Run with the SHIPPED `deriveFromLedger` + `deriveAll` via `functions/scripts/probe-persistency-derive*.mjs` (untracked, read-only). These are the smoke's expected values.

| Report month | Business placed | Lapses | Persistency |
|---|---|---|---|
| 2026-08 (derived, last full month) | 296,457.24 | 30,878.88 | **89.6%** |
| 2026-09 (estimate today) | 210,975.24 | 28,196.88 | **86.6%** (matches the 20 Sep ground-truth doc) |
| 2026-12 (projection, no new business) | 188,595.72 | 27,014.52 | **85.7%** |

Under the `lapse` annuity rule the same book gives 77.7% (Aug) and 72.2% (Sep). The rule in use must be visible on every figure.

**December gap on today's book:** 90% needs gross ≥ 10 × lapses = 270,145.20, so **+81,549.48 of new settled API** issued by 31 Dec and not lapsing, **or** reinstate ≥ **8,154.95** of in-window lapses, or a mix. The campaign's own production target (Champion = 275,000 settled) closes this gap by itself. The card should say that plainly.

## The rules

**R1. One module.** New pure `src/lib/persistency/persistencyOutlook.js`. It calls `deriveFromLedger` and `deriveAll`; it never re-implements the formula. It returns:
- `confirmed` — the newest saved 24-month record, with its month and source; or null.
- `derived` — the last full month before the export date, derived from the ledger, with `source: 'ho_export'` and the export date.
- `estimateToday` — the current month, derived from the ledger **including hand-keyed policies**.
- `ifPendingSettle` — the same as `estimateToday`, but with every pending policy (written / submitted / rated / postponed) treated as placed. Show it only when at least one pending policy exists.
- `december` — the gate month (from the campaign's gate config, not hard-coded) projected on today's ledger, plus `gap: { settledApiNeeded, reinstateNeeded }`.
- `assumptions` — which of the four manual inputs were taken from a saved record and which were assumed 0; the annuity rule; the export date; days since export.

**R2. Only placed business moves `estimateToday`.** A submitted policy is not placed. That is why `ifPendingSettle` exists as a separate line.

**R3. Manual inputs.** If a saved record for that month exists, its manual inputs win (same rule as `ledgerPrefill`). Otherwise they are 0 **and named** in `assumptions`. Never silently 0.

**R4. Staleness.** When the export is more than 45 days old, the outlook carries `stale: true` and the UI says "Estimate is getting stale; import a fresh export." One constant.

**R5. Precedence on the gate.** The campaign gate uses `confirmed` for the gate month when it exists. Before then it shows the newest of `confirmed` / `derived` as the preview, as H3 already does, and says which it is.

## Confirm flow

On the derived month, a **Confirm** control opens a small sheet with two choices:
1. **"Matches the HO report"** — saves the month through the existing persistency service with the derived inputs, `source: 'ho_confirmed'`, who, when, and the export date.
2. **"HO report says: __%"** — saves the head-office figure as that month's persistency, keeps the derived figure alongside, and shows the gap.

**Phase 0 recon, then STOP if needed:** check whether a persistency doc can hold a head-office percentage without the seven inputs under `savePersistency` and `firestore.rules`. If choice 2 needs a rules or schema change, **stop and report**. Rules changes are human-merge plus a manual deploy by Kyron. Do not change `firestore.rules` in this PR. Choice 1 may ship alone if choice 2 is blocked.

Both choices ask for the four manual inputs, reusing `ledgerPrefill`'s gate. Zero is a valid answer; blank is not.

## Surfaces

1. **Persistency tab hero:** Confirmed or Derived month (with Confirm), Estimated today (with an info popover listing `assumptions`), the "if pending settle" line when relevant, the December projection against 90%, and the gap sentence.
2. **CampaignHeroCard persistency row:** reads the same outlook (R5). No second derivation.
3. **Home pulse-strip persistency chip:** read the outlook's newest figure on the 24-month model. This closes the FOLLOW_UPS item banked at `148a1fd7` (12-month/24-month blend). Remove that entry.

Nexus v2 tokens only, no inline styles, 44px targets, loading / error / empty states. Below 90% uses the warning family. Only a confirmed gate-month figure below 90% may use danger.

## Tests

- Kyron's shape reproduces the table above to the cent (Aug 89.6%, Sep 86.6%, Dec 85.7%, gap 81,549.48 / 8,154.95).
- A hand-keyed SETTLED policy issued this month raises `estimateToday`; a SUBMITTED one does not, but raises `ifPendingSettle`.
- A saved record's manual inputs win over 0; missing ones are named in `assumptions`.
- Export 46 days old → `stale: true`.
- Confirm choice 1 writes `source: 'ho_confirmed'` through the service (mocked); the gate then prefers it.
- Annuity rule switch changes every figure and the label.

## Out of scope

- No `firestore.rules`, index or functions changes. No deploy.
- No change to `deriveFromLedger` or `calculations.js` arithmetic. If a bug turns up there, stop and report it.
- The reinstatement "smallest set that clears the gate" engine is its own track.

## Deliverables

1. PR titled `feat(persistency): derived, confirmed and live-estimated persistency on the heroes`.
2. **Evidence paste-back:** the final `Test Files` / `Tests` lines from `npm test`, with the baseline measured at your branch point.
3. **Smoke walk**, read-only, on Kyron's account, light and dark. Screenshots go to `verification/persistency-outlook/`, cropped to the cards, with no client names. Expected: Derived Aug 89.6% with a Confirm control; Estimated today 86.6% with the popover listing 4 assumed-0 inputs, rule `ignore` and export 15 Sep; December 85.7% with the gap sentence; campaign row showing the Aug preview in warning; the pulse chip matching. **Do not click Confirm on production.** Tests prove the write; Kyron confirms by hand after merge.
4. **Post-merge fill** in `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md`.

## Not your call

- Whether the four manual inputs should default from last month's saved values instead of 0. Kyron decides after he sees the popover.
