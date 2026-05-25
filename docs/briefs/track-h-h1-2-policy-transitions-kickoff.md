# Track H — H1.2: Policy Lifecycle, Agent Transition Vertical (BUILD LOCK)

**Branch:** `feat/track-h-h1-2-policy-transitions`
**Depends on:** H1 (#300) shipped + deployed; indexes READY.
**Banked decisions (dispatcher + Kyron, 2026-05-25):**
- Agent owns transitions Submitted → Rated / Postponed / NTU / Denied / Settled (and the secondary legal hops below). BM owns Lapsed + override — **deferred to H2.**
- No manager-confirmation rule arm in this slice (→ H2, bundled with the §7.8 reconciliation UI).
- Settled **is** in this slice, with its full §7.4 field set.

---

## In scope (the agent transition vertical)
1. A shared status model (`POLICY_STATUSES` + legal-transition map), importable by service + UI.
2. Rules: expand the **agent** `update` predicate to permit legal status transitions + enforce per-transition fields; fold in the banked **FU Entry 2** value-guards on the body-edit path. Add the `history` subcollection rules.
3. Service: `transitionPolicyStatus(...)` — validate legal transition + required fields + `parseFloat`, then **atomically** (writeBatch) update the policy doc and create a `history` doc.
4. `history` subcollection (`/policies/{policyId}/history/{historyId}`) — append-only audit, per PRD §7.4. First audit subcollection in the codebase; this sets the house pattern.
5. Agent UI in `PolicyLedgerPanel.jsx`: a legal-next-state action per own policy → per-transition field modal → `transitionPolicyStatus`.
6. Emulator + unit tests; production transition smoke (Phase 6).

## Explicitly NOT in scope (do not build)
- Manager confirmation/override rule arm; `confirmedByManager` / `managerSettledAPI` / `hasDiscrepancy` / discrepancy detection → **H2.**
- Lapsed status (BM-only) and any Settled→Lapsed transition → **H2.**
- Manager reconciliation UI (§7.8) → **H2.**
- Awards / gamification effects of Settled/Lapsed → **H3.**
- A `history` **display** UI (timeline) — data is written + tested + smoke-verified, not surfaced. Bank as a follow-up.
- No new submissions/settlements/CF/awards changes.

---

## Locked spec

### Status model — new file `src/constants/policyLifecycle.js`
- `POLICY_STATUSES = ['submitted','rated','postponed','ntu','denied','settled']` (NO `lapsed` — H2).
- `LEGAL_AGENT_TRANSITIONS` map (the agent-owned subset of PRD §7):
  - `submitted → rated | postponed | ntu | denied | settled`
  - `rated → settled | ntu`
  - `postponed → submitted | settled | denied`
  - Terminal in this slice: `ntu`, `denied`, `settled` (Settled→Lapsed is H2). No transition OUT of `ntu`/`denied`.
- Export a helper `isLegalAgentTransition(from, to)`.

### Per-transition fields (PRD §7.4 — CONFIRM at brief review; these are the acceptance criteria)
- `→ rated`: `ratedPremium` (required, parseFloat > 0); `rateReason` (optional).
- `→ postponed`: `pendingReason` (optional).
- `→ ntu`: `reason` (optional).
- `→ denied`: `reason` (optional).
- `→ settled`: `dateIssued` (required, ≥ `dateWritten`, ≤ now), `settledAPI` (required, parseFloat > 0), `issuedCoverage` (required, parseFloat > 0), `initialPremium` (required, parseFloat > 0), `earnedCommission` (required, parseFloat ≥ 0).
- `postponed → submitted`: no new fields.
- **Kyron to confirm** the required/optional split and the min constraints above (insurance-domain call).

### `firestore.rules` — policies block
- `get`, `list`, `create`, `delete` UNCHANGED.
- `allow update` becomes two OR'd predicates, both gated on `isSignedIn() && isAgent() && getTenantId()==tenantId && resource.data.agentId == request.auth.uid`:
  - **Arm A — body edit (existing, hardened):** `resource.data.status == 'submitted'` AND `request.resource.data.status == 'submitted'` (status unchanged) AND existing `hasOnly([...body fields...])` AND **FU Entry 2 value-guards on the edited values**: `sourceOfProspect in [...enum...]`, `dateWritten <= request.time`, `proposedAPI > 0`.
  - **Arm B — legal status transition (new):** `isLegalAgentTransition(resource.data.status, request.resource.data.status)` (encode the map; explicitly deny any `→ lapsed`) AND `affectedKeys().hasOnly(['status','statusUpdatedAt', <fields permitted for the target status>])` AND the required per-transition fields are present and valid (value-guards per the field table).
- Add `match /policies/{policyId}/history/{historyId}`:
  - `get`, `list`: own (`canAccessOwn(tenantId, parent agentId)`) OR manager-in-scope, mirroring the parent's read predicate.
  - `create`: `isSignedIn() && isAgent()` + history doc belongs to an own policy + valid shape.
  - `update`, `delete`: `if false` (append-only).
- **No new composite indexes expected.** History reads are single-field order (`at` desc) → auto-indexed. If any query needs a composite, ADD it and FLAG it (don't slip it in silently).

### `history` doc shape
`{ fromStatus, toStatus, changedFields (map of field → new value), actorUid, actorRole, at (serverTimestamp), note? (optional) }`

### `src/services/policiesService.js`
- New export `transitionPolicyStatus(tenantId, agentProfile, policyId, currentStatus, newStatus, fields)`:
  - Validate `isLegalAgentTransition` (JS mirror of the rules map) — throw on illegal.
  - Validate + `parseFloat` the required per-transition fields — throw on missing/invalid.
  - `writeBatch`: update policy (`status`, transition fields, `statusUpdatedAt: serverTimestamp()`) + `create` a `history` doc. Commit atomically.
- New export `getPolicyHistory(tenantId, policyId)` — own-policy history ordered by `at` desc (used by tests + smoke).
- Keep `createPolicy` / `getOwnPolicies` / `getPoliciesForManager` unchanged.

### `src/components/agent/PolicyLedgerPanel.jsx`
- Per own policy: a status action showing only the legal next-states for the current status (from the map). Selecting one opens a modal collecting the required per-transition fields, then calls `transitionPolicyStatus` and refreshes the list.
- Handle loading / error / empty. Nexus tokens, 44px touch targets, no inline styles, `parseFloat` on numeric inputs.
- No history timeline UI (deferred).

---

## Phases (Windows PowerShell — one command per line, never `&&`)

### Phase 0 — branch
```
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/track-h-h1-2-policy-transitions
```

### Phase 1 — read before writing (Rule 17)
Read in full before editing: `src/constants/` (confirm no existing lifecycle file), `src/services/policiesService.js`, the `match /policies` block + read-predicate helpers in `firestore.rules`, `src/components/agent/PolicyLedgerPanel.jsx`, `tests/rules/policies.rules.test.mjs`, `src/services/__tests__/policiesService.test.js`. Pair grep with `git ls-files` to confirm tracked status of anything you assert exists.

### Phase 2 — build
Create `src/constants/policyLifecycle.js`; expand the policies `update` rule (Arms A + B) and add the `history` subcollection rules; add `transitionPolicyStatus` + `getPolicyHistory` to `policiesService.js`; wire the transition action + modal into `PolicyLedgerPanel.jsx`.

### Phase 3 — tests / lint / build
- Emulator (`policies.rules.test.mjs`), every DENY via `assertFails`:
  - ALLOW: `submitted→rated` (+ratedPremium), `submitted→settled` (+full field set), `rated→settled`, `postponed→submitted`, history `create` on own policy.
  - DENY: `submitted→lapsed`, `ntu→rated` (out of terminal), `settled→rated` (illegal), missing required field (e.g. settled w/o `dateIssued`), transitioning another agent's policy, an `affectedKeys` set including a disallowed field, `history` `update`/`delete`, body-edit with bogus `sourceOfProspect` (Entry 2 guard).
- Unit (`policiesService.test.js`): legal vs illegal transition, `parseFloat`, batch writes BOTH docs, history shape, `getPolicyHistory` ordering.
- `npx vitest run` · `npm run lint` · `npm run build` — all green.

### Phase 4 — docs (leave SHA placeholders as `#TBD`)
- `docs/CONTEXT.md`: recently-shipped row for H1.2 (`#TBD` SHA).
- `docs/FOLLOW_UPS.md`: mark **Entry 2 (update-rule value-guards) RESOLVED** here; add a new LOW FU for the deferred `history` display UI.
- PRD §7 file (locate via `git ls-files | grep -i prd`; #300 touched `docs/phase7-8-PRD.md`): note agent transition vertical shipped; manager arm/Lapsed/reconciliation still H2.

### Phase 5 — push + PR (Rule 18; STOP at PR open — no merge, no deploy)
```
git add -A
git commit -m "feat(policy-ledger): H1.2 agent status transitions + history subcollection"
git push -u origin feat/track-h-h1-2-policy-transitions
git rev-parse HEAD
git rev-parse origin/feat/track-h-h1-2-policy-transitions
gh pr create --title "feat(policy-ledger): Track H H1.2 — agent status transitions + history" --body "<summary + checklist; Smoke box UNCHECKED — rules deploy is post-merge>"
```
Paste both SHAs verbatim (must match). Smoke box stays unchecked.

### Phase 6 — POST-merge (separate dispatch, after Kyron merges; Rule 19)
1. Sync main, capture squash SHA, fill the `#TBD` placeholders, push direct to main, Rule 15 verify.
2. `firebase deploy --only firestore:rules` (no indexes expected; if any were added, include `firestore:indexes` and gate the smoke on Enabled). Paste deploy output verbatim.
3. Smoke: log in as test agent → create a policy → transition it (e.g. Submitted→Settled with the field set) → hard-reload → assert new status persists in own-list AND a `history` doc exists. Tagged fixture; report the doc path; STOP (admin cleanup is a separate step, `delete: if false`).

---

## Expected file set (scope check — `gh pr diff <n> --name-only` must equal this exactly)
- `src/constants/policyLifecycle.js` (new)
- `firestore.rules`
- `src/services/policiesService.js`
- `src/components/agent/PolicyLedgerPanel.jsx`
- `tests/rules/policies.rules.test.mjs`
- `src/services/__tests__/policiesService.test.js`
- `docs/CONTEXT.md`, `docs/FOLLOW_UPS.md`, the PRD §7 file
- **NO** `firestore.indexes.json` expected (flag if a composite turns out to be needed). **NO** submissions/settlements/awards/CF files.

## Acceptance criteria
- Legal transitions allowed; illegal denied via `assertFails`; agent `→ lapsed` denied; per-transition required fields enforced at both rule and service layers.
- Transition + history written atomically (batch); `parseFloat` on every numeric; history append-only.
- FU Entry 2 value-guards live on the body-edit arm.
- No manager arm, no Lapsed, no awards effect, no new index (unless flagged).
- Nexus tokens + 44px + loading/error/empty in the UI.
