# FR Today persistency tile — kickoff brief

**Status:** ready for dispatch · **Author:** Claude-web (architect) · **Date:** 28-09-2026
**Model:** Opus 5.5, effort medium (a small change, but it chooses which persistency figure an agent sees; the main model keeps that judgment). Haiku 4.5 may run searches and test counts.
**Merge channel:** `human-merge` (money-adjacent: the 90% gate drives bonuses).
**Source:** `docs/FOLLOW_UPS.md` — the MEDIUM entry "FR Today shows old persistency" (banked in #1009 from the 28-09-2026 production click-through).

## 1. What this is

On production (28-09-2026) the FR Today tile and the coach line said **"Persistency 56.5% — below the 90% gate"**. That is the newest *saved record* (Jul 2026, 12-month model). The FR Persistency screen shows this month's estimate **~86.6% (Sep 2026, 24-month model)**. The FR-2 spec told CC to use "the latest record" — the spec was wrong, not the build. Fix Today to show the same current-month figure as the Persistency screen, with its month and kind on screen.

## 2. Audit findings (verified 28-09-2026 on main `ff8f242f`, Rule 11/17)

- `src/lib/fr/todayModel.js` reads `persistencyLatestPct` (latest E3 record ×100, skipping `grossSettled === 0`) into the `persistency` tile (~line 268) and the coach line (~line 330, text `Persistency X% — below the 90% gate`).
- `src/components/fr/today/FrToday.jsx` already calls `buildPersistencyOutlook({ policies: campaignPolicies, records: persistency, today: todayTT, gate })` — but only when a gating campaign exists, and only keeps `.gateMonth` (for the win-back Do-next item).
- `src/lib/persistency/persistencyOutlook.js` `buildPersistencyOutlook` returns `estimateToday` (current month: export + hand-keyed policies; `null` when nothing counted), `headline` (newest of confirmed record / derived-from-export, `{ kind, monthKey, persistency }`), `gateMonth`, `stale`, `daysSinceExport`. `persistency` values are 0–1 fractions. `gate` is optional.
- `src/components/campaigns/CampaignScreenBlocks.jsx` already renders `estimateToday` with `outlookMonthShortLabel` / `formatOutlookPct` — reuse those helpers for the label, do not write new ones.
- The campaign card (`CampaignHeroCard.jsx`) uses `headline`. That mismatch is a **separate** LOW follow-up — do not touch the campaign card here.

## 3. Decisions locked — do not re-litigate

- **D1 — One outlook call.** In `FrToday.jsx`, call `buildPersistencyOutlook` **once** whenever `campaignPolicies` is an array — with `gate: outlookGateFor(gatingCampaign)` when a gating campaign exists, `gate: null` otherwise. Take both `gateMonth` (unchanged behaviour for the win-back item) and the new "now" figure from that one result. Keep the existing `try/catch`: on error, both are `null`.
- **D2 — Which figure Today shows ("persistency now").** First `estimateToday` (kind `'estimate'`); if that is `null`, then `headline` (kind `headline.kind`: `'confirmed'` or `'derived'`); if both are `null`, no figure (the tile is hidden and there is no coach line — never a confident 0). Pass it to the model as `persistencyNow: { pct /* 0–100, one decimal */, monthKey, kind } | null`. Remove `persistencyLatestPct` from the model input and the container (no dead twin).
- **D3 — Tile copy.** Value as today (one decimal, `%`). The note names the month and kind, then the gate: `Sep 2026 estimate · below the 90% gate` / `Jul 2026 · confirmed · at or above the 90% gate` / `Aug 2026 · from head office · below the 90% gate`. Month label from `outlookMonthShortLabel` in `src/components/persistency/outlookLabels.js` (the helper CampaignScreenBlocks uses; it is a pure function, so importing it into the pure model is fine). Percent from the same rounding as `formatOutlookPct` (`src/lib/persistency/persistencyOutlook.js`). Tone warm when below the gate, as now.
- **D4 — Coach line.** Only when below the gate: `Persistency {pct}% ({month} {estimate|confirmed|from head office}) — below the 90% gate`, action unchanged (`See persistency`).
- **D5 — Loading.** While `campaignPolicies` is not yet an array (ledger pending), the tile shows its loading state like the other tiles, not a stale record. Ledger error → tile hidden, no coach line.
- **D6 — Out of scope.** The campaign card figure, HomeV2 (Nexus look), the Persistency screen, and any change to `persistencyOutlook.js`. If D2 cannot be met without changing `persistencyOutlook.js`: **STOP and wait for dispatcher**.

## 4. Phase 1 — verify before editing (Rule 17)

```
git grep -n "persistencyLatestPct" -- src
git grep -n "buildPersistencyOutlook(" -- src/components/fr/today/FrToday.jsx
git grep -n "estimateToday\|headline" -- src/lib/persistency/persistencyOutlook.js
git grep -n "outlookMonthShortLabel\|formatOutlookPct" -- src
```
List every `persistencyLatestPct` hit in the PR body; every one must be gone or migrated at the end.

## 5. Named rituals (deliverables)

1. **Value tests** in `src/lib/fr/__tests__/todayModel.test.js`: estimate present → tile uses it with "estimate" and its month; estimate null + confirmed headline → uses that with "confirmed"; both null → no tile, no coach line; below/at gate copy; the coach line text for each kind.
2. **Container test** (`FrToday.test.jsx`): with a fixture where the latest saved record says 56.5% (Jul) and the ledger gives a September estimate ≈ 86.6%, the tile shows the estimate, not 56.5%. Build the fixture so both numbers are real outputs of the real functions (no mocked outlook).
3. **Parity test:** for one fixture, the Today tile's figure equals the `estimateToday` value the Persistency screen's `CampaignScreenBlocks` row renders.
4. **Mutation checks, pasted into the PR body:** swap D2's order (headline first) → test 2 fails; drop the month from the note → a copy test fails.
5. Local gates: `npm run lint` 0, full `npm test`, `npm run build`.
6. FR harness walk `--slice FR-2`: all rows pass; update the `today` scene fixture to use `persistencyNow`. Review the Today screenshots in both themes.
7. CI green (one re-run allowed for a named known flake). CodeRabbit `@coderabbitai review` once, Rule 21 table. PR-ready report with HEAD SHA (Rule 20) and gaps (Rule 22).
8. Close the MEDIUM follow-up in the same PR with a RESOLVED note (Rule 7).

## 6. Stops

- Any need to change `persistencyOutlook.js`, the campaign card, or HomeV2: **STOP and wait for dispatcher**.
- The outlook call would need a new Firestore read: **STOP and wait for dispatcher** (it must use the policies and records the dashboard already holds).
