# PR Kickoff — Track I · I1.3b: Upline WAR Browse View

**Track:** I. **Type:** Feature PR · **Size:** M · **Risk:** Medium (a new read surface + an upline-scoped `list` rule + index — the list-rule is the privacy-adjacent piece).
**Provenance:** Track I spec §2/§4 — uplines review subordinate WARs; the flag-upward accountability (§4) presupposes the upline can *see* the reports. The I1.1 rule already permits upline single-doc reads; I1.3a denormalized `jfwCount`. This adds the browse UI + the scoped `list` query so a BM/SM sees the **full** WAR (manual activities + the stored `jfwCount`).

Third of the I1.3 sequence. **No standards overlay** (I1.3c), **no accountability flag** (I3), **read-only** (no editing of subordinate WARs).

---

## Goal

A BM/SM (and tenant/platform admin) browses their subordinates' WARs for a selected week, read-only — a list of the managers in scope with their week's report, drillable to the full WAR including the now-stored `jfwCount`.

## CONFIRMED read direction (unchanged from I1.1)

Upline reads down the chain: a BM sees the UMs in their branch; an SM (≈ head of sales) sees tenant-wide; tenant/platform admin see all. Peers and downline still can't read. This PR exercises that direction via a **list** query for the first time.

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

The list-rule is the determining piece; report before any code:

1. **`managerWeeklyReports` rules** — quote the current block. Does it have an `allow list`, or only `allow get`/`read` + the write rules from I1.1/I1.3a? The single-doc `get` rule (owner OR `warRoleRank() > managerRoleRank && scope`) works for a `get` because `resource` exists — but for a **list** query the rank inequality `warRoleRank() > resource.data.managerRoleRank` is **not query-constrainable** (same hazard as I1.2's collectionGroup). Report exactly what's there.
2. **Query-safe upline scope** — confirm the cleanest list rule avoids the rank inequality and scopes on data fields: a BM lists `where('branchId','==', ownBranch)` gated by `resource.data.branchId == callerBranchId(tenantId)`; an SM+ lists tenant-wide gated by `warRoleRank() >= 3` (a caller-claim, query-safe). Confirm `callerBranchId(tenantId)` (added in I1.1) and `warRoleRank()` are reachable from the `managerWeeklyReports` block. Note: this IS a collection query (single tenant path), **not** collectionGroup — so `getTenantId() == tenantId` is fine here (path variable available), unlike I1.2.
3. **Dashboard placement** — where the browse view lives for BM/SM/admin (a new nav item, e.g. "Team WARs" / "Manager Activity"), and how it differs by role. Confirm `ManagerDashboard.jsx`'s nav pattern (per I1.1's `My WAR` item).
4. **Display reuse** — can `ManagerWarTab`'s rendering be reused in a read-only mode for the drill-down detail, or is a separate read-only display component cleaner? Recommend.
5. **Index** — what composite index the list query needs (`branchId, weekStart` for BM; `weekStart` alone for SM is single-field/auto). Check `firestore.indexes.json`.

**STOP and report.** Especially the rule's current `list` provision (item 1) and the query-safe scope (item 2) — I'll confirm the rule shape before any code.

## Approach (subject to Phase-1 confirmation)

- **List rule** on `managerWeeklyReports` — a new `allow list` (separate from `allow get`), query-safe:
  `allow list: if isManager() && getTenantId() == tenantId && ( resource.data.branchId == callerBranchId(tenantId) || warRoleRank() >= 3 );`
  BM → their branch; SM+ → tenant-wide; admins via the existing role checks. Drops the rank inequality (handled by the branch-scope data: UMs in a BM's branch carry that `branchId`). The single-doc `get` rule stays unchanged.
- **Index** — `(branchId, weekStart)` collection-scoped on `managerWeeklyReports` (additive).
- **Service** — `getWarsForUpline({ tenantId, weekStart, role, branchId })`: BM → `where('branchId','==',branchId).where('weekStart','==',weekStart)`; SM+ → `where('weekStart','==',weekStart)`. Returns the WAR docs (with `jfwCount`).
- **UI** — a new browse surface (nav item, BM/SM/admin): pick a week → a list of in-scope managers' WARs (name, role, the activity summary incl. `jfwCount`) → drill to a **read-only** full WAR detail. Reuse `ManagerWarTab` read-only or a dedicated read-only display per Phase-1's recommendation. Empty state when no WARs filed for the week.

## Scope

**IN:** the `allow list` rule + emulator tests; the index; `getWarsForUpline` service + unit tests; the browse surface (list + read-only detail) + component tests.
**OUT (named):** standards / actual-vs-target overlay (**I1.3c**); accountability flag (I3); any editing of a subordinate's WAR; `needCovered`.

## Phases

1. **Source-verify** (the 5 items). STOP; confirm the list-rule shape before code.
2. **Rule + index + service.** New `allow list` (query-safe); the composite index; `getWarsForUpline`. Emulator rules tests: **BM lists own-branch ALLOW; BM lists another branch DENY; SM lists tenant-wide ALLOW; UM list DENY; agent list DENY;** the single-doc `get`/owner/write cases stay green. Service unit tests (BM-scope vs SM-scope queries).
3. **UI** — the browse surface + read-only detail + component tests. Loading/empty/error; Nexus tokens; 44px; light + dark; mobile (mind the More-drawer pattern from I1.2 if it's a sidebar item).
4. **Docs (placeholders).** CONTEXT.md recently-shipped + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark I1.3b shipped, note **I1.3c (standards config) next** (the last I1-core piece).
5. **Commit / push / PR.** Branch off fresh main. List rule + index additive → **deploy pre-merge**; confirm the index is **built** before smoke. Lint + build. Full suite, env-unset parity. Push, PR via `gh`, Rule 15. Do NOT merge.

## Smoke — RUN (the upline read path, finally via UI)

`setupBypassSession` against the preview (`VERCEL_BYPASS_TOKEN` by name only; negatives via REST):

1. **BM in-scope ALLOW:** a BM opens the browse view → sees the UMs in their branch with WARs for the selected week, including `jfwCount`; drill into one → read-only full WAR renders. Light + dark, 390×844, 0 console errors.
2. **SM tenant-wide ALLOW:** an SM sees managers across the tenant for the week.
3. **BM cross-branch DENY:** a BM's list does not return WARs from another branch (REST query scoped to another branch → 403 / empty per the rule).
4. **Downline DENY:** a UM and the test agent cannot access the browse / a UM REST list of WARs → DENY.
5. The list runs against the **deployed, built index** — no `FAILED_PRECONDITION`.

## Acceptance criteria

- BM sees their branch's WARs; SM+ sees tenant-wide; UM/agent denied — proven in emulator + live smoke (incl. BM cross-branch DENY).
- The drill-down shows the full WAR read-only, including the stored `jfwCount` (I1.3a's value, now consumed by UI).
- List rule is query-safe (no `FAILED_PRECONDITION`/`PERMISSION_DENIED` on the scoped list); rule + index additive, deployed pre-merge, index built before smoke.
- Lint 0; build green; suite green incl. env-unset parity; smoke green.

## Post-merge

Standard fill. (Rule + index deployed pre-merge — no deploy post-merge.)
