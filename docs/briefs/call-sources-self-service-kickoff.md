# Kickoff brief - call sources become SELF-SERVICE (slice A-prime)

**Drafted:** 26 August 2026 - **Merge channel:** HUMAN-MERGE (auth model + rules change)
**Model:** Opus 5 - **Effort:** high
**repomix:** pack FULL - touches `functions/`.
**Deploy gate:** changes Cloud Functions AND the rules block.
`firebase deploy --only functions,firestore:rules` is a named deliverable.

---

## Why this exists

Slice A (#915, `302b87a6`, deployed 18:25 UTC) made a **manager** create an agent's call-source
link, passing `creditUid` in the request body. The operator has ruled: **each agent attaches their
own calling software.** A manager is not in the loop.

**This is a security simplification, not a relaxation - state it that way.** Under the shipped
model, `createCallSource` accepts a `creditUid` naming SOMEONE ELSE. That is a cross-user write by
design, and it is the shape that produced BOTH defects in slice A: the `unit_manager` trap the brief
caught pre-build, and the tenant-isolation hole CodeRabbit caught in review. Forcing self-credit
deletes the entire class. **You cannot get "who may write to whose KPIs" wrong when the only legal
answer is "your own".**

Delegation still works unchanged: Kyron creates a link for Tracy-ann's KQM profile, crediting
**himself**. Creator and credit are the same person. Tracy-ann needs no AgencyTrack account.

## Phase 0 - audit of what actually shipped

| # | Finding |
|---|---|
| **F1** | `functions/callSources/createCallSource.js:29` gates on `MANAGER_ROLES`; `:36` destructures `creditUid` from `data`; `:44-49` validates it is a real user in the tenant. |
| **F2** | `firestore.rules:969-972`: `allow read: if canManageCallSources(tenantId); allow write: if false;`. **Agents cannot read their own links at all today.** |
| **F3** | Writes are already Cloud-Function-only (`allow write: if false`). That does NOT change - the client must never write here. |
| **F4** | `functions/callSources/revokeInboundLinks.js` runs under the **Admin SDK**, which bypasses rules. **Offboarding auto-revoke therefore needs no manager read access whatsoever** - this is why removing the manager path costs nothing operationally. |
| **F5** | `canManageCallSources` (`firestore.rules:56-61`) exists only to serve the manager read. Once read is owner-scoped it is **dead code** - and dead code shaped like a security gate is bait for the next author. |

## Decisions locked (operator rulings, 26 Aug)

1. **Creation is self-service and self-credit only.** `creditUid` is set from
   `context.auth.uid` **server-side** and is NEVER read from the payload.
2. **If the payload contains `creditUid`, reject with `invalid-argument`.** Fail loud. Silently
   ignoring a field a caller believed in is how a client ships a wrong assumption.
3. **The role gate is REMOVED, not widened.** Any signed-in user with a user doc in the tenant may
   create their own link. There is no privilege to check because there is no cross-user effect.
4. **Managers may NOT view an agent's links** (operator ruled explicitly). Read becomes owner-only:
   `isSignedIn() && getTenantId() == tenantId && resource.data.creditUid == request.auth.uid`.
5. **Revoke is owner-only** by the same rule. Offboarding is covered by F4's Admin-SDK path.
6. **Delete `canManageCallSources`.** Per F5.
7. `allow write: if false` **stays**. Callables mint and revoke; the client never writes.
8. Deactivation auto-revoke, 365-day TTL, `tokenHash`-not-token: **all unchanged** from slice A.

## Watch items - these are where this slice will bite

- **Rules `list` needs a constrained query.** An owner-only read rule means a `list` only passes
  when the query itself carries `where('creditUid','==',uid)`. The UI query and the rule must be
  written together, or listing silently returns permission-denied.
- **The F4 denial test from slice A INVERTS.** A `unit_manager` creating their OWN link must now
  **succeed**. Do not delete that test - flip it, and add a new one asserting a caller cannot create
  a link crediting anyone else (the decision-2 rejection). That new test is the load-bearing one.
- **Check for existing docs before changing the shape.** The collection deployed at 18:25 today and
  no smoke has run, so it is expected to be empty. Verify rather than assume; if any doc has
  `creditUid != createdBy`, STOP and wait for dispatcher.

## File inventory (scope-lock)

```
functions/callSources/createCallSource.js     drop role gate, force creditUid, reject payload field
functions/callSources/revokeCallSource.js     owner-only gate
functions/callSources/__tests__/              invert the UM test, add the cross-credit rejection
firestore.rules                               owner-only read; delete canManageCallSources
firestore.rules.test.mjs                      owner reads own / cannot read another's / manager cannot read
src/components/...                            move the tab off ManagerDashboard to the agent's own surface
src/.../navConfig.js                          remove the manager nav entries added by #915
docs/CONTEXT.md, docs/FOLLOW_UPS.md           Phase 4 only
```

## Named deliverables

- **A cross-credit rejection test.** A caller passing `creditUid` for another user is rejected. This
  replaces the `unit_manager` denial as the single most important test in the slice.
- **A rules test proving one agent cannot read another agent's link**, and that a branch manager
  cannot read either (decision 4).
- **`firebase deploy --only functions,firestore:rules`**, output captured in the PR.
- **Staging smoke, both themes:** sign in as an ordinary agent, attach a call source, see it listed,
  revoke it. Staging only - it mints real credentials. **This is also the smoke slice A never got**,
  so it is the first exercise of these rules against a real Firebase.
- **Post-merge fill** with the squash SHA.

## Note for the record

This partly reverses code merged and deployed the same day. That is cheap precisely because slice A
was small and nothing depends on it yet - no ingest endpoint, no webhook, no data. Reversing it now
costs one slice; reversing it after slice B builds on the manager model costs three.