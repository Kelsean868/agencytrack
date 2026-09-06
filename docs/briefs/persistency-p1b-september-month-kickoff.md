# Persistency P1b — reach the new month, guard the denominator

**Written 6 September 2026.** Follow-up to `docs/briefs/persistency-24-month-model-brief.md` after PR #937 (slice P1, branch HEAD `9728f840`). Sequenced **after #937 merges**; do not branch off `persistency-24m-p1`.

**Model: Sonnet 5, medium effort.** Three small, fenced changes. No rules change.

---

## 1. Why this exists

PR #937 proved the seven-field September form in a real browser and then proved nobody can reach it: `getAvailableMonths` (`src/services/persistencyService.js:198`) lists only months that already have a record, and falls back to "today" only when the tenant has **no** records at all. There is no "add month" control. When Tatil's September report lands in October, the manager will see a dropdown ending at the last month anyone entered. This predates P1, but P1 is what makes it bite.

Two smaller items ride along because they are in the same two files and were named in #937's Rule 22 list.

---

## 2. Decisions locked

| # | Decision | Rationale |
|---|---|---|
| P-D8 | **#937's deviation stands:** `getAvailableMonths` keeps filtering on `isE3Doc`, not `isModelCompleteDoc`. Written into the brief here so it is not re-litigated at P2. | A September doc written on six-field code has no `decreases`; the stricter filter would delete that month from the picker with no way back. Listing it and letting the seven-field form overwrite it is the only path that repairs the data. |
| P-D9 | **The picker always offers an entry window, not a button.** The month list is the union of months with data **and** the current TT month plus the two before it, sorted newest first. | Tatil's monthly report lags by weeks; a three-month window covers a late report without an "add month" UI, a modal, or a new state. Nothing is written until the manager saves. |
| P-D10 | **A negative denominator is refused; zero is not.** `savePersistency` refuses when the derived `grossSettled` (the memo's Net Gross Settled) is `< 0`. `0` keeps today's behaviour (`calculatePersistency` returns `0`). | A decrease larger than the business placed is a transcription error and would store a negative percentage. Zero is a real state for an agent with no business in the window and must stay saveable. |

---

## 3. Changes

1. **`persistencyService.js` `getAvailableMonths`:** after collecting `monthKeys` from docs, add the current month and the two prior months, derived from `getTodayTT()` (`src/utils/dateInputs.js`) — **not** `new Date()`, which is UTC and is the previous day for four hours every evening in Trinidad. Drop the `sorted.length === 0` fallback; the window now covers it. Sort descending. Tests: a tenant with records `2026-05`, `2026-06` on a TT "today" of `2026-10-03` returns `['2026-10','2026-09','2026-08','2026-06','2026-05']`; a tenant with no records returns the three-month window; a month present in both sources appears once.
2. **`persistencyService.js` `savePersistency`:** after deriving, if `grossSettled < 0` throw with the message `Net Gross Settled is negative — check Decreases against Gross Settled.` Test: `businessPlaced 1000, notTakens 0, decreases 1500` on `2026-09` is refused; the same with `decreases 1000` (gross `0`) is accepted and stores `persistency: 0`.
3. **`PersistencyEntryForm.jsx` line 236:** replace the literal `0.90` with `PERS_GATE` from `lib/persistency/calculations.js`, and the copy `Meets 90% award gate` with a template on `PERS_GATE_PCT`. Show the negative-denominator message inline before the save button fires (same text as the service), so the manager sees it without a round-trip.
4. Both `manager/PersistencyTab.jsx` and `agent/PersistencyTab.jsx` consume the list unchanged — `setMonthKey((prev) => prev ?? months[0])` now lands on the current month for a fresh load. Confirm that is the wanted default in the PR body (it is: the newest month is the one being entered).

---

## 4. Deliverables

- **Evidence paste-back:** the three `getAvailableMonths` test outputs and the two `savePersistency` cases, verbatim.
- **Smoke:** re-run `scripts/verification/` persistency smoke from #937 read-only against the preview and paste the manager month options line — it must now contain `2026-09`.
- PR body states: no `firestore.rules` change, no `functions/` change, ships with the Vercel rebuild.

---

## 5. Amendments to the P2 slice of the parent brief (apply when P2 is dispatched)

- **P2 item 4 is void.** `companyConfigRegistry.js` does not cite `calculations.js` by line number (#937 checked). Remove it; the parity test still runs.
- **P2 item 1 / P1 item 4:** the agent self-entry form and the manager entry form are the **same component** (`PersistencyEntryForm.jsx`). One edit, not two. The parent brief's wording is wrong, not the code.
- **P2 item 3 unchanged:** retire `rollingModelV2.js`, `PersistencyV2Shell.jsx`, the `persistencyV2` flag.
- **CodeRabbit:** #937's second commit (the smoke script) was never reviewed — rate limit. Re-poll before merge, and note the result in the post-merge fill.

---

## 6. Out of scope

- Any change to the seven inputs or the formula (P1, merged).
- The vocabulary sweep (P2).
- An upper sanity bound on `decreases` other than the sign check in P-D10.
