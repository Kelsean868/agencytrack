# Policy Ledger — Producing-Manager Self-Write

**Sized:** S–M
**Type:** Let **producing managers** (branch_manager, unit_manager) log their **own** individual policies via the policy ledger, same as agents — required day-1 for the pilot (Cyril and Mary-Ann produce). Today the policies write rule is `isAgent()`-gated (firestore.rules ~297–308) and the ledger UI is agent-only.
**Channel — SPLIT (mirrors A→B):**
- **Slice 1 (rule) = TIER-C** — Claude pre-review + human-merge + `firebase deploy --only firestore:rules`.
- **Slice 2 (UI exposure) = TIER-B** — after Slice 1 deployed.
**Model:** opusplan (Slice 1), Sonnet (Slice 2).
**Persona review:** YES — findings below.
**Sequencing:** Independent of the branch-scoping work; do this first.

---

## Persona review — what surfaced

- **Production correctness (the big one):** a producing manager's own policies are *their personal production*. The producing-manager phases already shipped (#631/#634/#635/#639/#640), so the recon must confirm that **policy-ledger entries for a producing manager flow into the SAME personal-production aggregation as their weekly-wizard submissions** — no separate path, and critically **no double-count** into the team totals they manage. Same treatment as a producing manager's wizard production.
- **Role / permissions (the security invariant):** the rule must let a producing manager write **only their OWN** policies (ownerUid == auth.uid). There must be **no path to writing a team member's policy** — self-scoped only.
- **Tenant isolation:** same-tenant (existing).

---

## Slice 1 — Rule · **TIER-C (Claude pre-review → human-merge → deploy)**

**Branch:** `feat/policy-ledger-mgr-write`

### Phase 1 — recon
1. The policies-collection write rule (firestore.rules ~297–308) — exact current predicate (`isAgent()` + tenant + any ownership clause).
2. The policy doc's **owner field** (`agentId`? `ownerUid`? `uid`?) — what links a policy to its producer.
3. Choose the predicate: prefer a **producing-role allowlist writing their OWN policy** — `(isAgent() || role==unit_manager || role==branch_manager)` **AND** the policy's owner == auth.uid — since those are the roles that produce and this keeps admin roles out. Confirm against the owner field; if an ownership-only predicate is cleaner given the doc shape, note it (v3 role-agnostic-own-data principle), but do NOT widen to non-producing roles without reason.
4. **How a producing manager's own production aggregates today** (where wizard production lands, where policy entries roll up) — so policy entries land in the same personal bucket and don't double-count into managed team totals.
5. What operations agents have on their OWN policies (create/edit/delete) — producing managers get the same set, self-scoped.

### Phase 2 — build
Extend the policies write rule so a producing manager can create/edit/delete a policy they **own**, in their tenant — mirroring agent self-policy capabilities, ownership-scoped.

### Phase 3 — emulator tests
- BM creates own policy → ALLOW · UM creates own policy → ALLOW
- producing manager writes ANOTHER user's policy → **DENY** (self-only — the key case)
- agent writes own policy → ALLOW (unchanged)
- non-producing role (e.g. tenant_admin) writes a policy → DENY (unless recon says otherwise)
- cross-tenant → DENY

### Phase 4 — docs
### Phase 5 — PR + **HOLD for Claude pre-review** → human-merge → deploy → live-verify (BM/UM own-policy ALLOW · other-owner DENY · cross-tenant DENY).

---

## Slice 2 — UI exposure · **TIER-B (after Slice 1 deployed)**

**Branch:** `feat/policy-ledger-mgr-ui`

Expose the policy-ledger entry/screen to producing managers so they can reach it and log their own policies — scoped to **their own ledger**, not a team view. Recon the current agent-only gate and extend it to the producing roles. Confirm a producing manager's own policies display in their ledger AND aggregate into their personal production consistently with their wizard submissions.

**Smoke (live rule, both themes, write-read-verify on a resettable producing-manager account):** log a policy → persists → appears in their own ledger → counts in their personal production (and does not double-count); confirm they cannot see or write another user's policies.

---

## Cross-cutting
- **Self-only ownership is the invariant** — never let a producing manager write a team member's policy.
- **No double-count** — a producing manager's own production (wizard + policy entries) flows through one personal-production path, not added twice.
