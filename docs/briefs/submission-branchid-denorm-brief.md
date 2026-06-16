# Branch Isolation via Denormalized branchId

**Sized:** M — two Tier-C slices + a backfill migration.
**Type:** True, rule-enforced branch isolation for the two-branch pilot. Denormalize `branchId` onto submission docs so a BM can read only their own branch's submissions (closes the crafted-query bypass that query-only filtering leaves open), with a simpler `branchId` query (no agentId chunking / 30-limit). **Supersedes** the query-only `branch-scoped-views` approach — operator chose the proper fix.
**Channel — SPLIT, both TIER-C (rules + write-path + migration):**
- **Slice 1** = write-path stamps branchId + write-rule forge-validation + backfill.
- **Slice 2** = BM branchId query + composite index + read-rule isolation.
**Model:** opusplan both slices.
**Persona review:** YES — findings below.
**Sequencing:** Replaces the prior branch-scoped-views build. Slice 1 fully deployed + backfilled before Slice 2.

---

## Load-bearing ordering (the thing that breaks if wrong)
ALL submissions must carry `branchId` **before** the read rule enforces `branchId == claim`, or pre-branchId submissions become unreadable by the BM. So: **write-path + backfill (Slice 1) → query branchId-constrained → read rule (Slice 2)**. And within Slice 2, the read-rule deploy comes **after** the frontend query is live, so the query is already branchId-constrained when the stricter rule lands (a rule stricter than the query → Firestore denies the whole query).

## Attribution
`branchId` is stamped at write time → **point-in-time** attribution (a submission stays with the branch that produced it, even if the agent later moves). This is the chosen default.

---

## Persona review
- **Branch isolation (the point):** read rule enforces BM → only `submission.branchId == claim.branchId`. Agents read their own (`agentId == uid`); SM / tenant_admin / platform_admin stay tenant-wide. Closes the crafted-query bypass.
- **Write-forge prevention:** the submission write rule must validate `request.resource.data.branchId == request.auth.token.branchId` so a submitter can't stamp a false branch. (branchId confirmed in the claim.)
- **Migration safety:** see ordering above. The pre-launch test-data wipe means real submissions start fresh with branchId, so the backfill is near-empty — but it ships for correctness and as a reusable tool.
- **Cyril / Phoenix:** branch producers (agents, UMs, the BM) all carry the branch's branchId → the BM's branchId query returns the whole branch incl. the Phoenix unit; the Phoenix UM anchor still scopes by unitId separately. Two-account structure intact.

---

## Slice 1 — branchId write-path + write-rule + backfill · **TIER-C**

**Branch:** `feat/submission-branchid-write`

### Phase 1 — recon
1. **Enumerate ALL submission write paths** (submissionService.js client writes, the weekly-wizard submit, the producing-manager submit, any `onSubmissionWrite` CF). Every path must stamp branchId before the write-rule validation can be added — a missed path = broken submissions.
2. The submitter's branchId source (claim — confirmed) to stamp.
3. Existing submission count/shape for the backfill.

### Phase 2 — build
- Stamp `branchId` (= submitter's branch, from the claim/profile) on every submission write path.
- Write rule: add `request.resource.data.branchId == request.auth.token.branchId` to the submission create/write arms (forge-proof).
- Backfill script: stamp branchId on existing submissions (agent's current branchId); idempotent, `--execute` guard, dry-run default.

### Phase 3 — emulator tests
- write submission with branchId == own claim → ALLOW; with a different branchId → DENY (forge).
- all enumerated write paths still succeed with the new field.

### Phase 4 — docs
### Phase 5 — PR + **HOLD for Claude pre-review** → merge → deploy rules → **run backfill** → live-verify (own-branch write ALLOW; forged-branch write DENY). Confirm every submission now carries branchId before Slice 2.

---

## Slice 2 — branchId query + index + read-rule isolation · **TIER-C**

**Branch:** `feat/submission-branchid-read`

### Phase 1 — recon
1. The BM read paths (`getWeeklySubmissions`, `getAllYTDSubmissions`) to switch to `where('branchId', '==', claim.branchId)`.
2. The current submission read rule — extend for branch isolation without breaking agent-own and higher-role tenant-wide reads.
3. The composite index Firestore wants for the YTD branchId query (`branchId ==` + `weekStarting` range + `status ==`).

### Phase 2 — build
- Switch the BM submission queries to `where('branchId', '==', claim.branchId)` (+ existing weekStarting/status filters). Drop the agentId-IN client filter. No chunking needed.
- Add the composite index to `firestore.indexes.json`.
- Read rule: BM reads only `branchId == claim.branchId`; agent reads own (`agentId == uid`); SM / tenant_admin / platform_admin tenant-wide.

### Phase 3 — emulator tests
- BM reads own-branch submission → ALLOW; other-branch → DENY.
- agent reads own → ALLOW; tenant_admin reads any-branch → ALLOW.

### Phase 4 — docs
### Phase 5 — PR + **HOLD for Claude pre-review**. Post-merge order is load-bearing: merge → frontend (branchId query) deploys via Vercel → deploy the index (wait for it to finish building) → **then** deploy the read rule → live-verify. Live-verify: BM other-branch read DENY (even via a crafted query); branch-A complete; agent-own ALLOW; tenant_admin tenant-wide ALLOW.

### Smoke
Two-branch fixture, both themes: branch-B submissions ABSENT from BM-A's response (weekly + YTD), branch-A COMPLETE.

---

## Cross-cutting
- Order is the risk: branchId on all docs (Slice 1 + backfill) before the read rule (Slice 2); frontend query live before the read-rule deploy.
- Pre-launch test-data wipe means real data starts clean with branchId.
- Point-in-time attribution (submission-time branch).
