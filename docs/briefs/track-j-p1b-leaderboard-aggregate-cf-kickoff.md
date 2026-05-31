# Track J — P1b: Leaderboard-aggregate Cloud Function + collection + rules

**Sized:** M–L
**Branch:** `redesign/leaderboard-aggregate-cf` (off main)
**Type:** Backend — Cloud Function (scheduled + on-demand callable), new agent-readable collection, Firestore rules, write-read-verify smoke. **Human-merge + dispatcher pre-review.**
**Completes the keystone (P1).** Consumed by P3 (podium), P4 (around-me), P7 (AgentProductionView fix).

## Outcome

A Cloud Function computes per-branch, per-period (WK/MTD/QTD/YTD) production rankings by composing the merged `functions/leaderboard/rankingLogic.js`, and writes them to an **agent-readable** `tenants/{tid}/leaderboards/{branchId}` doc via the Admin SDK. Agents read their own branch's rankings (SEC-4 doc-read rule); managers in scope + kiosk read; writes are CF-only.

**Blast radius:** the `leaderboards` collection has no consumer until P3 — a buggy CF writes a doc nothing displays. The write-read-verify smoke is therefore the gate for P3, not a safety risk for P1b.

## Decisions baked in

- **CF (gen-1):** a **scheduled** recompute (model `sendSundayNudge`'s `functions.pubsub.schedule(cron).timeZone('UTC').onRun`; default hourly, tunable) **plus an admin-only on-demand recompute callable** (`functions.https.onCall`) for initial backfill + deterministic smoke triggering. **Single-tenant** (`tatillife_south`, matching the SEC-9c hardcode); multi-tenant iteration → FU. On-write trigger → optional optimization FU. Idempotent write with a loop-guard (model `recomputeJfwCount`).
- **Branch grouping:** submissions carry only `unitId` and there is no units collection, so the CF reads all submissions + all users (Admin SDK), builds `agentId → branchId` from user docs, groups by branch, and per branch×period runs `filterSubmissionsByPeriod → computeAgentTotals → rankForLeaderboard` from the merged twin.
- **Doc shape:** `tenants/{tid}/leaderboards/{branchId}` = `{ week:[…], mtd:[…], qtd:[…], ytd:[…], computedAt }`; each entry `{ agentId, name, unitName, periodApi, apps, rank, rankWithinUnit }`. Model the CF-write + rule on `agentOfMonth`, but agent-readable.
- **Rule:** read via the **SEC-4 doc-read** pattern — `get(/…/users/$(request.auth.uid)).data.branchId == branchId` for agents; manager-in-scope + `kioskCanRead`; `allow write: if false`.
- **Source:** submissions (D1). Reconciled-production migration = FU-2; this CF is the single swap point.

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`; `git checkout main && git pull --ff-only origin main`.
2. `git log origin/main --oneline -1` — capture verbatim.
3. Move brief → `docs/briefs/track-j-p1b-leaderboard-aggregate-cf-kickoff.md`; `git checkout -b redesign/leaderboard-aggregate-cf`; commit as commit 1.
4. Any failure/drift → **STOP and wait for dispatcher.**

## Phase 1 — source-verify (Rule 11 + Rule 17)

1. Confirm `functions/leaderboard/rankingLogic.js` exports (post-P1a) and the `rankForLeaderboard` signature.
2. Confirm the gen-1 patterns to model: `sendSundayNudge` (scheduled), `recomputeJfwCount` (recompute + loop-guard + Admin SDK write), any existing `onCall` callable, and `agentOfMonth` (CF-write + rule shape).
3. **Data prerequisite — confirm the test agent's user doc has `branchId`** (kelsean@gmail.com, UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`). The doc-read rule + the smoke depend on it. If missing → **STOP** (data-fix prerequisite before the smoke can pass).
4. Confirm whether the CF's submission query needs a **new composite index** (the existing `getAllYTDSubmissions` index likely covers it). If a new index is needed, it deploys pre-merge (additive).
5. Any drift/blocker → **STOP and wait for dispatcher.**

## Phase 2 — build

- **2a CF** under `functions/leaderboard/`: recompute logic (read submissions + users → `agentId→branchId` join → group by branch → per branch×period compose the twin → write `leaderboards/{branchId}` via Admin SDK, idempotent loop-guard). The **scheduled** trigger + the **admin-only on-demand callable**. Register both in `functions/index.js`.
- **2b rules** (`firestore.rules`): `match /tenants/{tid}/leaderboards/{branchId}` — `allow get, list` via SEC-4 doc-read branchId for agents + manager-in-scope + `kioskCanRead`; `allow write: if false`.

## Phase 3 — tests + gates (pre-merge)

- **3a CF unit tests (Jest):** branch grouping via the user-doc join, per-period ranking, multi-branch separation, empty-branch handling.
- **3b rules emulator tests (Java JDK 21):** agent reads OWN branch ALLOW; agent reads OTHER branch DENY; agent write DENY; manager-in-scope ALLOW; out-of-scope manager DENY; kiosk ALLOW.
- **3c lint / test / build:** both suites green; report verbatim.
- **3d hex-grep:** N/A (no JSX) — run for form.
- **3e scope (FINAL diff):** `functions/leaderboard/*` + `functions/index.js` registration + `firestore.rules` + CF/rules tests + brief + CONTEXT + FOLLOW_UPS (+ index file if a new index). No `src/` change; no edit to `rankingLogic.js` (consume only).
- **axe + both-themes smoke — WAIVED** (no UI). The **write-read-verify smoke is Phase 6** (needs the deployed CF).

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`): "Track J P1b — leaderboard-aggregate CF (scheduled + on-demand callable) writing agent-readable `leaderboards/{branchId}` per period via the P1a ranking twin; SEC-4 doc-read rules. Keystone complete. No consumer until P3."
- Bank FUs: multi-tenant CF iteration; on-write-trigger optimization. Reference FU-2 (reconciled migration — this CF is the swap point).

## Phase 5 — deploy rules pre-merge, push, open PR — STOP for pre-review

1. **Deploy `firestore.rules` pre-merge** (additive — new collection only). Confirm deploy success.
2. If a new composite index is needed, deploy it pre-merge too.
3. Commit; `git push -u origin redesign/leaderboard-aggregate-cf`.
4. Open PR vs main. Body: human-merge; paste CF-unit + rules-emulator + lint/build results verbatim; state the smoke is Phase 6 (post-CF-deploy) and the blast-radius note.
5. **STOP and wait for dispatcher.** Do NOT merge. I pre-review the **rules** (the security surface), the **branch join**, and the **smoke plan** before authorizing.

## Phase 6 — post-merge: deploy CF + write-read-verify smoke (NOT waived)

After dispatcher authorizes merge:
1. Sync main, capture squash SHA; fill `#{TBD}`/`{TBD}`; push direct to main; **Rule 15 — PASTE VERBATIM** (`git log origin/main --oneline -1` + `git rev-parse HEAD && git rev-parse origin/main`); mismatch → **STOP.**
2. **Deploy the CF** (us-central1, model the escalation-CF deploy). Confirm successful create.
3. **Backfill:** invoke the on-demand recompute callable; confirm a `leaderboards/{branchId}` doc is written.
4. **Write-read-verify smoke (production):** as the **test agent** — ensure a submitted submission exists → trigger recompute (admin callable) → reload → read `leaderboards/{branchId}` as the agent → assert the agent appears in the ranking with the correct period API (exercises rules + claims + CF + read path, the path the mocked tests can't). Report verbatim.
5. On smoke fail: the collection has no consumer, so fix forward (the bad doc is unread) — surface to dispatcher; do not let P3 proceed until the smoke is green.

## Acceptance criteria

- CF computes per-branch per-period rankings via the P1a twin and writes `leaderboards/{branchId}` (Admin SDK, idempotent).
- Scheduled trigger + admin-only on-demand callable both registered.
- Rules: agent reads own branch ALLOW / other branch DENY / write DENY; manager-in-scope + kiosk ALLOW — all emulator-proven.
- CF unit tests + rules emulator tests green; lint/build green; final-diff scope per 3e; `rankingLogic.js` untouched.
- Post-merge: CF deployed, backfill writes a doc, write-read-verify smoke green as the agent.

## Out of scope

- Any UI (P3 podium, P4 around-me). AgentProductionView fix (P7). Reconciled migration (FU-2). Multi-tenant iteration + on-write trigger (FUs).

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
