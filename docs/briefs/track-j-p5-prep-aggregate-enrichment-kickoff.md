# Track J — P5-prep: Aggregate-enrichment CF (unitId + previousRank + last-week champions)

**Sized:** L (keystone CF change + new collection + rules — P1b-like)
**Branch:** `redesign/leaderboard-aggregate-enrichment` (off main)
**Type:** Cloud Function change + new agent-readable collection + Firestore rules. **Human-merge + dispatcher pre-review.** Per **Rule 19**, the merge (GitHub UI) AND the CF/rules **deploys** (CLI) are dispatcher actions — CC opens the PR and stops; after the dispatcher merges + deploys, CC runs the backfill + smoke.

## Outcome

The leaderboard-aggregate CF gains three additions, all derived from **one** prior-WAR-week computation:

1. **`unitId`** on every entry (all periods) — enables client-side unit-scoping (P5a). Trivial passthrough; the CF already has it and currently drops it.
2. **`previousRank`** on **WEEK** entries only — the agent's rank in the prior WAR week, **branch-scoped** (matching the current branch rank). Enables the week-over-week movement chip. MTD/QTD/YTD `previousRank = null`.
3. **Last-week champions doc** `tenants/{tid}/weeklyChampions/{weekStarting}` — **tenant-wide** top by API / Apps / Activity for the most-recently-completed week, agent-readable. Enables the `WeeklyChampionsBanner` re-home.

## Decisions baked in (do not re-litigate)

- **`previousRank` is WEEK-only.** Movement is a week-over-week concept ("▲2 this week" per the Claude Design spec + the P7A weekly-delta precedent). MTD/QTD/YTD entries get `previousRank: null` (no chip on those views). If per-period movement is wanted later, that's an enhancement — flag it, don't build it now.
- **`previousRank` is branch-scoped** (the agent's prior-week rank within their branch), matching the current branch rank — so the chip reads "you moved within your branch."
- **Champions are tenant-wide** (one doc per week, top-1 per category across all tenant agents), matching the retired banner's scope (it read all-tenant submissions). NOT branch-scoped, NOT current-week.
- **One prior-week computation feeds both** `previousRank` (per-branch prior-week rankings) and the champions doc (tenant-wide top-1 by API/Apps/Activity) — load the prior week once, aggregate twice.
- This PR is **backend only.** The banner re-home UI, the movement-chip UI, and the P5a scope UI are separate downstream PRs that consume these additions.

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-p5-prep-aggregate-enrichment-kickoff.md`; branch `redesign/leaderboard-aggregate-enrichment`; commit as commit 1.
3. Failure/drift → STOP and wait for dispatcher.

## Phase 1 — source-verify (Rule 11 + 17)

1. The CF structure: `leaderboardAggregate.js` (the recompute functions + the entry map at ~152-160), and the P1a `rankingLogic.js` (`computeAgentTotals`, `rankForLeaderboard`). Confirm `unitId` is available in the ranking pipeline at the entry-map point.
2. `src/utils/weeklyChampions.js` — exactly what `topAPI` / `topApps` / `topActivity` compute (the **Activity** metric especially — it's not in `computeAgentTotals`, so confirm what it sums and ensure the CF can compute it for the prior week).
3. `WeeklyChampionsBanner.jsx` — the **doc shape the re-homed banner will need** (props/fields), so the champions doc matches what the banner reads.
4. The prior-week boundary the retired banner used (`prevSunday = getLastNSundays(2)[1]`) — reuse it for "most-recently-completed week."
5. The `leaderboards` read-rule pattern (to mirror for `weeklyChampions`).
6. **Cross-check impact:** adding `unitId` + `previousRank` changes the entry shape — confirm whether the P1a ESM↔CJS cross-check test (and its fixtures) needs updating for the new shape, and whether the CJS twin must mirror the prior-week/champions logic.
7. Drift/conflict → STOP and surface.

## Phase 2 — build

- **2a `unitId`** passthrough in the entry map (all periods).
- **2b prior-week branch rankings → `previousRank`** on WEEK entries (null for mtd/qtd/ytd). Compute the prior WAR week's per-branch ranking via the existing rank logic; map `agentId → priorRank`; attach.
- **2c tenant-wide champions** — from the same prior-week per-agent totals (API, Apps, Activity), extract top-1 per category; write `tenants/{tid}/weeklyChampions/{weekStarting}` in the shape the banner needs (Phase 1 §3). Include `computedAt` + a `skipped`/metadata field consistent with the leaderboard doc's observability pattern.
- **2d rules** — `weeklyChampions/{weekStarting}`: `read` (get + list) if signed-in tenant member (within `tenantId`); `write: false`. Mirror the `leaderboards` pattern minus the branch arm (champions is tenant-wide).
- Mirror any new ranking math into the CJS twin + update the cross-check test if the shape/logic changed (Phase 1 §6). ESM `computations.js` stays the source of truth.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** `functions/leaderboard/*` + `firestore.rules` + the cross-check/unit tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `src/` UI edits (this is backend-only).
- **3c lint / test / build** green (verbatim).
- **3d P1a cross-check** green (or updated for the new entry shape, with the drift-guard still firing — prove it).
- **3e NEW unit tests:** the prior-week `previousRank` mapping (week entries get prior-week branch rank; mtd/qtd/ytd get null; an agent absent from the prior week → previousRank null); the champions extraction (top-1 by API, by Apps, by Activity; ties; empty prior week → honest empty doc).
- **3f rules emulator tests:** an agent CAN read `weeklyChampions/{weekStarting}`; write is DENIED; cross-tenant read denied.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`).
- Mark the P5-prep FU resolved; note that the **banner re-home**, the **movement chip**, and **P5a unit-scope** are now unblocked (their own PRs).
- Reconfirm the sequencing constraint is now satisfied for the eventual P5 manager nav swap (the champions doc exists before that retirement).

## Phase 5 — PR + STOP for pre-review

Open PR; paste gate results. **STOP — do not merge, do not deploy (Rule 19).** I pre-review the prior-week computation correctness, the champions doc shape vs the banner's needs, the week-only `previousRank` scoping, and the cross-check/rules coverage.

## Phase 6 — post-merge + deploy

**Dispatcher actions (Rule 19):** merge PR in the GitHub UI; deploy the CF (`firebase deploy --only functions:…`) and the rules (`firebase deploy --only firestore:rules`) via CLI.

**CC actions (after the dispatcher confirms merge + deploy):**
- Sync main, fill `#TBD/{TBD}`, push direct to main. Rule 15 verbatim; mismatch → STOP.
- Invoke the on-demand recompute callable (runtime call, not a deploy) to backfill; confirm the enriched entries (`unitId` present; WEEK entries carry `previousRank`) and the `weeklyChampions/{weekStarting}` doc were written (paste keys + metadata).
- **Write-read-verify prod smoke:** client-SDK auth as the test agent → read `leaderboards/{branch}` and assert `unitId` present + WEEK entries carry `previousRank`; read `weeklyChampions/{weekStarting}` (ALLOWED) and assert the top-1 categories; assert a write is DENIED. Both the enriched-entry read and the champions read are the gate. Report verbatim.
- On smoke fail: fix forward; surface; do NOT let downstream UI PRs proceed until green.

## Acceptance criteria

- Entries carry `unitId` (all periods) + `previousRank` (WEEK only; null elsewhere); `weeklyChampions/{weekStarting}` written (tenant-wide top API/Apps/Activity, last-week), agent-readable, write-denied; P1a cross-check green; new unit + rules-emulator tests; deploy + backfill + prod smoke green.

## Out of scope

Banner re-home UI; movement-chip UI; P5a scope UI; P5b SM (parked on head-of-sales). Per-period (non-week) `previousRank` (enhancement).

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17, 19.
