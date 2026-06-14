# Producing-Manager Personal Production — Kickoff Brief

**Date:** 2026-06-14
**Status:** RECON COMPLETE — product call required before Phase 2
**Branch target:** `feat/producing-manager-isproducing-toggle` (3a only, pending Kyron's call on 3b)
**Related spec:** `docs/producing-manager-personal-prod-spec.md`

---

## Decisions locked

None yet. Phase 1 recon done. 3b pipeline option requires Kyron's call (A/B/C/D).
3a (`isProducingManager` toggle UI) can proceed independently, but brief is HELD pending
product decision on 3b so a single coordinated PR can ship both slices in the right order.

---

## Background

All Tatil Life managers are producing managers. Track I WAR (already shipped) already
captures `personalApi` / `personalApps` from the WAR form, gated by `isProducingManager`.
Two things are missing:

1. **No UI to set `isProducingManager`** — requires a direct Firestore write today.
2. **No downstream pipeline for `personalApi`** — data is captured but goes nowhere.

Both gaps are pilot-critical (Kyron confirmed "all Tatil managers produce").

---

## Phase 1 — recon findings (already executed, verified 2026-06-14)

### What's already built (do NOT re-implement)

| Surface | File | Line(s) | Status |
|---------|------|---------|--------|
| WAR personal-production panel | `ManagerWarTab.jsx` | 302-320 | Gated by `isProducingManager` |
| `isProducingManager` read | `ManagerWarTab.jsx` | 48 | From `userProfile` |
| `sanitizeWar` personal branch | `managerWarService.js` | 45-50 | Includes/omits based on flag |
| WAR doc write with personal fields | `managerWarService.js` | 78-95 | Stored on `managerWeeklyReports/{id}` |
| Tests: include/omit behavior | `managerWarService.test.js` | 155-170 | Passing |

Track I WAR tab itself is confirmed shipped at `src/components/manager/ManagerWarTab.jsx`.
`isProducingManager` boolean is the sole gate. Default is `false` (flag absent = disabled).

### Genuine gaps

**Gap 3a — `isProducingManager` toggle UI (mechanical, no product call needed)**
- No UI exists. Only a direct Firestore write enables the feature.
- Target: boolean toggle in the Edit User form, writable by `tenant_admin` + `branch_manager`.
- Files: `UserManagementPanel.jsx` (or `EditUserModal.jsx`), `userService.js` (persist field).

**Gap 3b — `personalApi` downstream pipeline (PRODUCT CALL REQUIRED)**
- `personalApi`/`personalApps` from WAR docs are read by zero surfaces.
- Options A–D enumerated in `docs/producing-manager-personal-prod-spec.md`.
- Recommended starting point: **Option D** (dashboard-only, no aggregate changes, reversible).
  But this is Kyron's call — do NOT implement without explicit choice.

---

## STOP condition

**STOP and wait for dispatcher** before Phase 2 work on Gap 3b.

Kyron must choose one of Options A–D from the spec. Gap 3a (toggle UI) can ship
independently in a focused XS PR, but the brief and branch scope should reflect whether
3a and 3b ship together or sequentially.

---

## Phase 2 — planned edits (3a only, upon dispatcher authorization)

**`UserManagementPanel.jsx` / `EditUserModal.jsx`**
- Add `isProducingManager` boolean field to the edit user form.
- Visible only when the target user has a manager role (`unit_manager`, `branch_manager`,
  `sales_manager`). Hidden for `agent` role users.
- Label: "Producing manager" (checkbox or toggle switch, consistent with existing form controls).
- Value defaults to `false` when not present on user doc.

**`userService.js`**
- Ensure `isProducingManager` is included in the user doc update payload on save.
- No Firestore rules change needed — the existing `isManager` path already covers the field
  (managers can write their own unit's user docs; `tenant_admin` can write any user).
  Phase 1 must verify rules coverage before Phase 2 starts.

---

## Phase 3 acceptance criteria (3a)

- [ ] Toggle renders in Edit User form for manager-role users.
- [ ] Toggle does NOT render for agent-role users.
- [ ] Saving `isProducingManager=true` persists to Firestore user doc.
- [ ] After save: `ManagerWarTab` personal-production panel appears on page reload.
- [ ] After save: `isProducingManager=false` hides the personal-production panel.
- [ ] `npm run lint && npm test && npm run build` all pass.
- [ ] Smoke: tenant_admin login → User Management → edit a manager → enable → reload WAR tab.

---

## Files that will change (3a scope)

```
src/components/manager/UserManagementPanel.jsx   (or EditUserModal.jsx — verify actual modal location)
src/services/userService.js
```

---

## Known gaps / self-critique (Rule 22)

- The exact modal component name (`EditUserModal.jsx` vs inline form in `UserManagementPanel.jsx`)
  was not verified at brief authoring — Phase 1 must grep before editing.
- Firestore rules coverage for the `isProducingManager` field write was not verified —
  Phase 1 must confirm `tenant_admin` + `branch_manager` write path covers this field.
- 3b options have NOT been evaluated for index requirements — if Option A (rollup) or C
  (new board) is chosen, a composite index may be needed. Not scoped here.
