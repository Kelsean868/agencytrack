# Brief: Fix BM User Roster — unfiltered query violates list rule

**Target file in repo:** `docs/briefs/fix-bm-user-roster-query.md`
**Size:** S
**Type:** frontend — auth/rules-adjacent (a `list` query that must satisfy a Firestore security rule)
**Merge:** HUMAN-MERGE (rules-adjacent).
**Deploy:** frontend — Vercel auto-deploy on merge. No functions deploy.

---

## Why

`getAllUsers` sends an **unfiltered** `tenants/{id}/users` collection query for a `branch_manager` caller. The BM `list` rule (`firestore.rules:153-156`) requires `resource.data.branchId == callerBranchId(tenantId)`, and Firestore rejects any `list` query that references `resource.data.X` in the rule but omits a matching `where('X','==',...)` constraint — so the whole query fails with permission-denied. `UserManagementPanel`'s catch block swallows it (console-only), leaving `users:[]` → "No users yet." Net effect: **no branch_manager can use the User Roster** in any tenant. Latent until `tatillife_smoke` became the first BM to open the tab. `getTenantUsers` (Compliance panel) works because it adds the `where('branchId',...)` constraint.

## Source-verified facts (CC re-verify with `git grep`)

1. `agentManagementService.js:43-59` `getAllUsers`: UM caller → `where('unitId','==',callerUid)`; **all other roles → bare `col` (no filter)** — the BM gap.
2. `managerService.js:47-48` `getTenantUsers` BM path → `where('branchId','==',claims.branchId)` (the correct pattern to mirror).
3. `firestore.rules:153-156` — BM `list` allowed only with `resource.data.branchId == callerBranchId(tenantId)`; SM/TA/PA roles allowed unfiltered (no `resource.data` constraint) — so bare `col` is legitimate for them, only BM is broken.
4. `UserManagementPanel.jsx:378-389` `loadUsers` catch logs and returns, never surfacing the error → silent empty.

## Scope

**In:**
1. **Primary — add the BM arm** to `getAllUsers`'s query builder (`agentManagementService.js:50-52`), mirroring `getTenantUsers`:
   ```
   const q = claims.role === 'unit_manager'
     ? query(col, where('unitId', '==', callerUid))
     : claims.role === 'branch_manager' && claims.branchId
     ? query(col, where('branchId', '==', claims.branchId))
     : col;
   ```
   Downstream client-side `provisioning`/`active` filters unchanged.
2. **Secondary (recommended) — stop swallowing the error.** In `UserManagementPanel.loadUsers`, set an error state on catch and render a distinct "Couldn't load users — retry" state, separate from the legitimate empty-but-successful "No users yet." This is what kept the bug invisible; surfacing it prevents the next query/rules mismatch from hiding the same way. Preserve the genuine-empty case (successful load, zero docs) as "No users yet."

**Out:** the Firestore rules (correct as written — do NOT loosen them to accept the unfiltered query); functions; the seed/tenant.

## Phases

- **Phase 0 — Re-verify + sibling sweep:** confirm facts 1–4. Then `git grep` for other BM-facing `list` queries on tenant-scoped collections that omit the rule-required `where` (same pattern: `collection(.../{users|branches|...})` passed to `getDocs`/`query` without a branch filter for BM). If a sibling exists → report it; fix in-scope only if trivial and same shape, else surface as a follow-up. Halt to dispatcher if the sibling is non-trivial.
- **Phase 1 — Edit:** the primary arm; the secondary error-surfacing.
- **Phase 2 — Static verify:** lint clean; build clean; the genuine-empty vs error states are distinct in the panel.
- **Phase 3 — Smoke (Vercel preview — required, the smoke tenant validates the fix):** log in as the smoke BM, open Team → User Roster, assert **Smoke Agent + Smoke Unit Manager** now render and "No users yet" is gone; confirm console shows no permission-denied; both themes; 0 console errors. Plus full test suite.
- **Phase 4 — Docs-with-placeholders:** CONTEXT.md / FOLLOW_UPS note the fix + the "list query must carry the rule-required constraint" lesson; resolve any related FU.
- **Phase 5 — Commit/push/PR:** branch `fix/bm-user-roster-query`; commit `fix(users): scope BM getAllUsers query to branch so list rule passes`; push; open PR; STOP.
- **Phase 6 — Gemini disposition** per Rule 21.

## Self-critique gate (Rule 22 — known gaps)

- **Gap 1:** The fix assumes BM is the only role whose `getAllUsers` query violates a rule constraint. Phase 0's sibling sweep tests that; if a sibling collection/role has the same pattern, this PR fixes only the user-roster instance and flags the rest.
- **Gap 2:** The error-surfacing change alters UX on genuine load failures. Confirm a real empty tenant still shows "No users yet" (success + zero docs), not the error state — the two paths must stay distinct.

## Falsification-before-banking (Rule 23)

- "BM is the only role with an unfiltered-query-vs-rules mismatch in user/roster reads" is overturned if Phase 0 finds another role/collection with the same shape. If found → do not bank "isolated"; report the sibling.

---

## Dispatch prompt (paste to CC)

```
/land-and-dispatch docs/briefs/fix-bm-user-roster-query.md

Fix the BM User Roster permission-denied bug. S, frontend, HUMAN-MERGE (rules-adjacent), Vercel-deploy on merge.

Phase 0: re-verify getAllUsers (agentManagementService.js:43-59), getTenantUsers BM path (managerService.js:47-48), the BM list rule (firestore.rules:153-156), and the swallowing catch (UserManagementPanel.jsx:378-389). Then git grep for SIBLING unfiltered BM list queries on tenant-scoped collections that omit the rule-required where — report any; halt if non-trivial.

Edit: (1) add the branch_manager arm to getAllUsers's query builder mirroring getTenantUsers — query(col, where('branchId','==',claims.branchId)) when role==='branch_manager' && claims.branchId. (2) In UserManagementPanel.loadUsers, surface the catch error as a distinct "couldn't load" state instead of silently leaving users:[]; keep genuine-empty ("No users yet", successful zero-doc load) distinct. Do NOT touch firestore.rules or functions.

Phase 3 smoke (preview, required): log in as the smoke BM, open Team → User Roster, assert Smoke Agent + Smoke Unit Manager render and no permission-denied in console; both themes; full test suite. Phase 4 docs. Phase 5: branch fix/bm-user-roster-query, open PR, STOP. Phase 6: Gemini disposition.
```
