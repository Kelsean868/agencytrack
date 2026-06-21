# PM-1 — Producing-manager self-access (firestore.rules only)

## Status & channel
- **Status:** READY pending Phase 0. This is the **rules-only** first phase of the producing-manager track. PM-2 (the "My Production" UI) is a separate later brief and is **out of scope here**.
- **Channel:** build to PR-open, **HOLD** for human merge. **SUPERVISED** — run this with the operator watching; it's an access-control change. CC does **not** merge and does **not** deploy (Rule 19); the operator merges and runs the `firestore:rules` deploy manually.
- **Why rules-first:** isolating the access change from the UI lets the rules diff + the deny-matrix be reviewed in isolation, and lets the rules deploy be verified before any screen surfaces the widened access. PM-1 has **no user-visible effect** — nothing in the UI reads via these widened arms until PM-2 — so it's safe to merge + deploy on its own.
- **Producing managers = Unit Manager + Branch Manager only.** SM / TA / Platform must gain nothing from this change.
- **Rules in force:** 10, 15, 16, 17, 19, 20, 21, 22, 23. Halt: "STOP and wait for dispatcher."
- **Surface:** `firestore.rules` + `@firebase/rules-unit-testing` deny-matrix tests. **No app/UI/nav code in this PR** — if any non-rules/non-test file is touched, STOP and report.

## Phase 0 — source-verify (HARD STOP on miss; this governs correctness)
1. **Confirm the helper definitions** (Rule 17): `isAgent()` (~:22), `isProducingManager()` (~:27), and `canAccessOwn` (~:45-46) — paste their exact bodies. Confirm `isProducingManager()` resolves to UM **or** BM only.
2. **Enumerate every call site of `canAccessOwn`.** The recon shows it's used by `submissions` (get/list/create/update), `moneyNeeds` (get/list), and `leaderboard` (get). Confirm the complete list. **This decides the mechanism:** if *every* `canAccessOwn` call site is an own-data context where producing-manager own-access is intended, extend the helper once (centralized). If any call site should stay agent-only, do **targeted per-arm edits** instead. Report the decision.
3. **Confirm the own-only constraint in each target arm.** For `dailyActivity` (~:547/556, `isAgent() && agentId==uid`), `goals` (~:565/572, `isAgent() && goalId==uid`), `weeklyPlans` (~:1290/1293/1306, `isAgent()` — **verify it has an `==uid`/ownership constraint; if it does not, that's a pre-existing hole — STOP and report before widening it**). The extension is only safe where an own-only check exists.
4. **Confirm the `moneyNeeds` asymmetry** (write allows `isProducingManager()`, read via `canAccessOwn` does not) so the fix makes read symmetric with write.

## The change (locked principle)
Every **self-access** arm that currently gates on `isAgent()` — directly or via `canAccessOwn` — extends to **`isAgent() || isProducingManager()`**, with the existing **own-only constraint (`request.auth.uid == <ownerId>`) strictly preserved**. Target arms:
- `submissions` (get/list/create/update) — via `canAccessOwn` or targeted.
- `moneyNeeds` get/list — resolves the read/write asymmetry.
- `dailyActivity` self-arm — keep `agentId == uid`.
- `goals` self-arm — keep `goalId == uid`.
- `weeklyPlans` self-arm — keep the own-only constraint (per Phase 0).
- `leaderboard` — already grants UM/BM via `canManage`; if it also comes through the `canAccessOwn` extension, that's redundant-but-harmless own-access (note it).

**Hard invariant:** the extension grants a producing manager access to **their own** docs only. It must **not** widen the self-path into any doc the manager doesn't own. Team-member access is a separate concern and flows through the **unchanged** `canManage` arms — do not touch those.

## Verification — emulator deny-matrix (this is the proof, not a formality)
Build a comprehensive matrix with `@firebase/rules-unit-testing`. For each target collection (`submissions`, `moneyNeeds`, `dailyActivity`, `goals`, `weeklyPlans`):
- **UM on own doc → ALLOW.** **BM on own doc → ALLOW.** (the self-arm now works for producing managers)
- **UM/BM on a doc owned by a user they do NOT manage** (e.g. a peer manager, or an agent outside their unit/branch) **→ DENY.** (proves the own-only constraint holds — the self-path doesn't leak into non-owned, non-managed data)
- **Agent on own doc → ALLOW; agent on another's doc → DENY.** (no regression)
- **SM and TA via the self-arm → DENY.** (only UM/BM gain self-access)
- Where applicable, confirm the **team-management (`canManage`) path is unchanged** — a UM reading a managed team member's doc still resolves via the team arm, not the self-arm.

The "UM/BM on a non-managed user's doc → DENY" cases are the load-bearing ones — they prove the change is own-only. If any of those ALLOW, the change is too broad: **STOP and report.**

## Close
- Diff is `firestore.rules` + the deny-matrix test file **only**. Gates: full deny-matrix green; existing rules tests green (no regression); lint/build unaffected (rules-only).
- PR-open, **HOLD**. Rule 20 HEAD SHA · Rule 21 Gemini poll + disposition · Rule 22 name ≥1 gap (e.g. the static-recon caveat: no live UM/BM session — that's PM-2's smoke) · Rule 23 falsification (state what deny-matrix result would overturn "own-only holds").
- **Operator steps after merge:** deploy `firestore:rules` manually, then PM-2 can proceed. CC does neither.

## Dispatch
1. Download to `~/Downloads/`.
2. `/land-and-dispatch pm-1-producing-manager-rules-brief.md`
