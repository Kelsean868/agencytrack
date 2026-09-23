> Three PRs, dispatched in order. H1: **Opus 5.5**, effort **high**. H2: **Opus 5.5**, effort **high**. H3: **Sonnet 5**, effort **medium**.
> H2 starts after H1 merges. H3 starts after H2 merges.

# Brief — Every hero reads the ledger

## The defect, measured on live data (23 Sep 2026)

Read-only probe (`functions/scripts/probe-hero-truth.cjs`) on `tatillife_south`, Kyron (`DRXMI8AgthW7eazwRL06l2Uac4a2`):

| Fact | Value |
|---|---|
| Policy docs | 229, all `importSource: oipa_import`, all carry `createdAt` |
| Status | settled 117 · lapsed 87 · ntu 22 · denied 3 · submitted 0 · `confirmedAt` 0 |
| Issued in 2026 | 6, of which settled 5, settled API **TTD 87,146.28** |
| Weekly submission docs in 2026 | 4 |
| `usesPolicyLedger` on his user doc | undefined |
| Campaign doc | `XssqaSKA0UyfNBuKcat9`, Christmas Campaign and Retreat 2026, active, credit table present |

Three different sources feed the heroes, so they cannot agree:

1. **`ytdTotals`** (`src/components/dashboard/AgentDashboard.jsx:408`) sums **weekly reports only** (`status === 'submitted'`, `extractTotalProductionCredit`). It feeds HomeV2 `HeroCard` (via `HomeV2/index.jsx:239`), the tab at line 796, `GapAnalysisPanel` (886), `DerivedIncomePanel` (896), `MdrtTracker` (911) and `GoalsCelebration` (923). `src/hooks/useMyProduction.js` repeats the same logic for the manager "My Production" section (`ManagerDashboard.jsx`, `ManagerWarTab.jsx`).
2. **Policy Ledger hero** (`PipelineStrip.jsx`) reads the ledger, but its "TOTAL · YTD" is `derivePipeline().totalSum`: every policy, every year, lapsed and NTU included (TTD 895K). It is a lifetime figure under a YTD label.
3. **Awards** (`AgentAwardsPanel.jsx`) reads `confirmedSettlements` unless `usesPolicyLedger` is set, and on the ledger path applies `excludeImported()` (ruling 5e). Either way Kyron's awards read 0.

## The rule being encoded (Kyron's decisions, 23 Sep 2026)

**R1. The ledger is the source of record for production.** Weekly reports record *activity* and a *self-reported* submitted figure. Heroes show ledger figures. The weekly figure appears only as a reconciliation note (R4).

**R2. Four headline figures, all from the ledger, all for the selected year:**
- **Settled API** and **Settled apps** — policies with status `settled` (or confirmed) whose `dateIssued` falls in the year.
- **Submitted API** and **Submitted apps** — policies that *went in* during the year, whatever happened after (settled, lapsed, NTU, denied, still pending all count). Date test: `dateSubmitted`; if absent, `dateWritten`; if both absent (every imported doc today), `dateIssued`, and the figure carries a visible "dated by issue" marker so nobody reads it as a true submit date.

**R3. Apps and API use Tatil's production rules, one shared helper.** New business only; an increase counts as 1 app at TTD 2,400 API or more; lump sums/deposits never count as an app. Reuse `creditFor` logic from `src/lib/policyCampaignLens.js` where the rows match; do **not** fork a second table. If the general rule and the campaign Rule 7 table disagree (lump sums: 10% API generally, 0% in the campaign), the general helper uses the general rule and the campaign keeps its own. State this in a comment at the helper.

**R4. Reconciliation note, not a hero figure.** Under the hero: "Weekly reports say you submitted TTD X this year (TTD Y this week). Your ledger shows TTD Z." When the two differ by more than TTD 1, show a mismatch flag with the gap, and a link to the ledger's create form. Same wording on every surface that shows the hero. Do not hide the note when they match; show "Matches your weekly reports."

**R5. Origin never decides eligibility for current-year production. Date does.** This amends ruling 5e for awards, the same way C-D10 amended it for campaigns. An imported policy issued in 2026 is 2026 business. One issued in 2019 is not, because of its date. `excludeImported` stays in force for persistency and financing readers — not this brief.

---

## H1 — One ledger derivation, every production hero reads it

PR title: `fix(heroes): production heroes read the ledger, not weekly reports`

1. New pure module `src/lib/ledgerProduction.js`: `deriveYearProduction(policies, { year, weekStarting, submissions })` returns
   `{ settled: { api, apps, count }, submitted: { api, apps, count, datedByIssue }, weekly: { ytdApi, weekApi }, mismatch: { ytd, week } }`.
   Pure functions only, no SDK, no JSX. R2/R3/R4 live here and nowhere else.
2. `AgentDashboard.jsx`: build this from the **unfiltered** policy list (`policiesAll`, the same response `getOwnPolicies` already returns — no new read). Replace `ytdTotals.api` at every consumer listed above with `settled.api`. Keep `ytdTotals` for the activity fields (`apps` from weekly reports becomes `activityApps` — rename, do not delete; FFI, CI and dials stay).
3. `useMyProduction.js`: same change, so the manager's own-production section matches the agent view.
4. HomeV2 `HeroCard`: show Settled API as the big number, with Settled apps, Submitted API and Submitted apps beneath, and the R4 note. Keep the goal bar and MDRT marker against Settled API.
5. `PipelineStrip.jsx`: relabel "TOTAL · YTD" to the year's **Settled API** from the same module, and add Submitted API beside it. The six stage tiles stay lifetime counts, and say so: add the eyebrow "WHOLE BOOK" above them.
6. **Guard the #948 test.** `policiesAll` now reaches more readers. Extend the unfiltered-policies guard test so it asserts, by prop, which components may receive the unfiltered list. Do not weaken it to a text match.

Tests (add to a new `ledgerProduction.test.js`):
- Kyron's shape: 229 imported, 6 issued in 2026 of which 5 settled → settled count 5, submitted count 6, `datedByIssue` true.
- A hand-keyed policy with `dateSubmitted` 2026-03-02 and `dateIssued` 2026-04-10 counts in submitted by its submit date, not its issue date.
- A policy submitted Dec 2025 and issued Jan 2026: settled 2026 yes, submitted 2026 no.
- Increase at TTD 2,399 → 0 apps, full API. At 2,400 → 1 app.
- Mismatch: weekly TTD 30,000 vs ledger TTD 0 → `mismatch.ytd` = 30,000.

## H2 — Awards count current-year imported business by date

PR title: `fix(awards): imported policies earn awards by issue date (amends 5e)`

1. `AgentAwardsPanel.jsx`: on the ledger path, replace `excludeImported(...)` with the R5 date test from `ledgerProduction.js`. Write the amendment as a comment block at the call site, citing C-D10, in the same style as `PolicyLedgerPanel.jsx:341`.
2. Source selection: read the ledger when `usesPolicyLedger` is true **or** the agent has one or more ledger policies. Keep `confirmedSettlements` for agents with no ledger. Do not remove the flag.
3. `LedgerSourceChip` must name the source that was actually used.
4. Awards periods: an award counts a policy when `dateIssued` falls inside that award's period. Monthly awards must see the month it settled.

Tests: an imported policy issued 2026-08-15 counts toward an August award; one issued 2019 counts toward nothing; an agent with no policies and no flag still reads confirmed settlements.

## H3 — Campaign hero card on Awards and Dashboard

PR title: `feat(campaign): campaign hero card on Awards and Dashboard`

1. New presentational `src/components/campaigns/CampaignHeroCard.jsx`, props only, following `HeroAwardCard`'s grammar in `awardPrimitives.jsx`. Three rows against the **tier in reach** (`lens.tierNext`, as C2 decided): API, Applications, 24-month Persistency against the campaign gate (C1). The as-at export date shows beneath (`lens.exportDate`).
2. Feed it from `derivePolicyLens` (the same call `CampaignCard` and `CampaignLensPanel` make — not a copy) plus the C1 gate value.
3. Place it as the top hero on the agent Awards tab, above `HeroAwardCard`, when a campaign is active.
4. Reuse the same component in HomeV2, directly under `HeroCard`, replacing the per-campaign `CampaignCard` there. Keep `CampaignCard` if another surface still uses it.
5. Loading, error and empty states. Nexus v2 tokens only, no inline styles, 44px targets.

## Out of scope for all three

- No data writes, no backfill, no rules or functions changes, no deploy. Kyron deploys after merge.
- Persistency and financing keep `excludeImported`.
- The Firestore cache crash (`INTERNAL ASSERTION FAILED ID: b815`, `src/firebase.js` `persistentMultipleTabManager`) is a separate item. Bank it in `docs/FOLLOW_UPS.md`; do not fix it here.

## Deliverables (each PR)

1. **Evidence paste-back** in the PR body: the final `Test Files` / `Tests` lines from `npm test`, exactly as printed, with the baseline measured on your branch point.
2. **Smoke walk** on Kyron's account, light and dark, screenshots committed under `verification/hero-ledger/` (H1), `verification/awards-ledger/` (H2), `verification/campaign-hero/` (H3). Expected on H1: Settled 5 · TTD 87,146.28; Submitted 6 "dated by issue"; a mismatch note against his 4 weekly reports. Expected on H3: campaign API TTD 73,946.28 and 3 apps (Jul–Dec window), as in #960.
3. **Post-merge fill** in `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md`.
4. One line per PR listing every file changed.

## Not your call

- Whether the weekly-report mismatch should also notify the unit manager. Kyron decides after seeing it on screen.
