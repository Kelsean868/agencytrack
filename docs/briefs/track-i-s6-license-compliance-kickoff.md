# Track I §6 — License-State & CBTT Compliance — Build Lock / Dispatch

**Type:** Feature (Track I §6 — the remaining Track I item; I1/I2/I3 already shipped)
**Branch:** `feat/track-i-s6-license-compliance`
**Readiness verify:** complete (against current main). One product decision now resolved: CBTT window = **12 months, extendable to 24** (binary extension).
**Scope class:** user-doc fields + `firestore.rules` allowlist extension (emulator-tested) + edit UI + a compliance listing + a pure helper. No new collection, no new CF, no claim-keyed fields.
**Environment:** Windows PowerShell. One command per line — never `&&`. All blocks from repo root `C:\Projects\AgencyTrack`.

---

## Confirmed model

- **`licenseStatus`**: `'provisional' | 'official'`. Manager-set. **Missing = untracked** (not flagged) — so established staff aren't false-flagged and no migration is needed.
- **`cbttExamPassedDate`**: `date | null`. Set when the agent passes / is marked official.
- **`cbttExtensionGranted`**: `boolean` (default false). True = the 12-month window was extended to the full 24.
- **Effective deadline (derived, never stored)**: `addMonths(contractStartDate, cbttExtensionGranted ? 24 : 12)`.
- **Compliance signal**: flag a user where `licenseStatus === 'provisional'` AND `contractStartDate` is present AND `daysUntil(effectiveDeadline) <= 90`.

`contractStartDate` already exists and is manager-editable (allowlisted at `firestore.rules:159`, in `MANAGER_EDITABLE_FIELDS` at `userService.js:16`). The three new fields follow the identical path.

## Scope boundary (hard)

- Touch only: `firestore.rules`, the rules emulator test file, `src/services/userService.js`, `src/components/.../EditUserDrawer.jsx`, `src/components/.../CompliancePanel.jsx`, a new helper util + its test, `docs/CONTEXT.md`, `docs/FOLLOW_UPS.md`, the spec doc.
- **No CF change.** Do NOT touch `doCreateUser` or account-creation paths — defaulting new agents to provisional is a logged fast-follow, not this PR.
- Do NOT touch the `active`/`role`/`branchId` exclusions or any other allowlist arm beyond adding the three fields.

## Decisions (do not re-litigate)

- Binary extension (12 → 24), boolean-stored, deadline derived. (If the dispatcher later says partial extensions exist, swap the boolean for a stored `cbttExamDeadline` date capped at +24mo — additive.)
- `isProvisional(user) === (user.licenseStatus === 'provisional')` — explicit only; missing is NOT provisional.
- Deadline derived at render time; nothing stored for it.

## Phase 0 — Branch

```powershell
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/track-i-s6-license-compliance
```

## Phase 2 — Code

### New helper — `src/utils/cbttCompliance.js` (pure, no Firebase)

- `isProvisional(user)` → `user.licenseStatus === 'provisional'`
- `cbttEffectiveDeadline(user)` → `addMonths(parse(user.contractStartDate), user.cbttExtensionGranted ? 24 : 12)`, or `null` if no `contractStartDate`.
- `cbttComplianceFlag(user, today)` → `null` unless provisional + has deadline; else `{ deadline, daysRemaining, atRisk: daysRemaining <= 90, extended: !!user.cbttExtensionGranted }`.

### `firestore.rules` — extend the manager `allow update` hasOnly allowlist (the arm at ~`:156`)

Add `licenseStatus`, `cbttExamPassedDate`, `cbttExtensionGranted` to the `hasOnly([...])` list (alongside `contractStartDate`). Add a one-line comment noting these are manager-editable license fields, no CF/claim mirror. **Do not** add them to the agent self-edit arm.

### `src/services/userService.js`

Add the same three fields to `MANAGER_EDITABLE_FIELDS` (`:16`) — must stay in lockstep with the rules allowlist (per the existing comment there).

### `EditUserDrawer.jsx`

Add manager inputs (Nexus tokens, 44px targets, no inline styles):
- `licenseStatus` — select (Provisional / Official).
- `cbttExamPassedDate` — date input, shown/relevant when Official.
- `cbttExtensionGranted` — toggle, labelled e.g. "CBTT exam extension granted (extends the 12-month window to 24)".

### `CompliancePanel.jsx`

Add a **"CBTT License Compliance"** section (the panel already loads `getTenantUsers(tenantId)` at `:131`). List provisional agents with a `contractStartDate`, each showing effective deadline + days remaining, with an amber/red emphasis when `atRisk` (within 90 days). Use `cbttComplianceFlag`. This is a new section in the existing panel — no new route or tab.

## Phase 3 — Tests, lint, build

**Emulator rules tests** (add to the rules suite — the four CC identified):
1. Manager writes `licenseStatus: 'official'` → ALLOW.
2. Agent writes `licenseStatus` on own doc → DENY (not in self-edit arm).
3. UM writes `licenseStatus` on an agent outside own unit → DENY (existing UM scope guard holds).
4. `active` still cannot be written client-side after the allowlist expansion → DENY (regression check).

**Unit tests** for `cbttCompliance.js`: provisional detection (explicit only; missing → false); effective deadline 12 vs 24 by `cbttExtensionGranted`; 90-day `atRisk` boundary; missing `contractStartDate` → `null` (not flagged).

```powershell
npm run test
npm run lint
npm run build
```

All green before proceeding.

## Phase 4 — Docs (placeholders, filled post-merge)

- **`docs/CONTEXT.md`**: top table + recently-shipped row `Track I §6 — license-state + CBTT compliance signal — #TBD`. Update "Where we left off".
- **`docs/FOLLOW_UPS.md`**:
  - **Clear the two stale Track I markers** — line ~26 (`I2 IN FLIGHT — PR #280 open` → I2 SHIPPED #280) and line ~2515 (`I1 CORE COMPLETE PENDING MERGE` → I1/I2/I3 SHIPPED; §6 now in progress).
  - Add **LOW** — *default new agents to `licenseStatus: 'provisional'` at creation* (doCreateUser CF), so tracking is automatic rather than relying on a manual mark.
  - Add **LOW** — *isProducingManager setter* if not already tracked (dormant field, policy TBD).
- **Spec** (`docs/AgencyTrack_TrackI_ManagerWAR_DesignSpec.md`): correct §6 (window is **12 months, extendable to 24**, not flat 24) and resolve §10 item 2 (confirmed by dispatcher; extension modeled as binary).

## Phase 5 — Commit, push, verify, PR (STOP after)

```powershell
git add -A
git status
git commit -m "feat(compliance): Track I s6 license-state + CBTT compliance signal"
git push -u origin feat/track-i-s6-license-compliance
```

Rule 15 verify (paste all SHAs full; HEAD == origin/branch):

```powershell
git fetch origin
git log origin/feat/track-i-s6-license-compliance --oneline -1
git rev-parse HEAD
git rev-parse origin/feat/track-i-s6-license-compliance
```

Open the PR. Fill the checklist per Rule 18 from `.github/pull_request_template.md` — check emulator/tests/lint/build/docs/scope; leave the smoke box unchecked. Write the body to a temp file, create, remove it:

```powershell
gh pr create --title "feat(compliance): Track I s6 license-state + CBTT compliance signal" --body-file pr-body-s6.md
Remove-Item pr-body-s6.md
```

Report PR number, Rule 15 SHAs, `gh pr diff <n> --name-only`. Then **STOP and wait for the dispatcher.** Do NOT merge.

## Phase 5.5 — Smoke (CC runs; warm desktop, browser MCP + setupBypassSession)

Assert rendered/persisted state, not selectors. Seed → verify → cleanup in one pass; tag seeded changes for clean teardown; restore fixtures.

1. As a manager in `EditUserDrawer`, set a test agent to `licenseStatus: 'provisional'` with a `contractStartDate` ~within 90 days of the 12-month deadline → save → reload → the agent appears **flagged (at-risk)** in CompliancePanel's CBTT section with the right days-remaining.
2. Toggle `cbttExtensionGranted` on → save → the effective deadline moves to 24 months; if now >90 days out, the at-risk flag clears (still listed as provisional, not at-risk).
3. Set `licenseStatus: 'official'` → save → the agent drops off the provisional list entirely.
4. Confirm the writes persisted (reload-and-read), then revert the test agent to its prior state (cleanup).

Report per-leg results + console errors. Update the PR smoke box with the real result. **STOP and wait for the dispatcher. Do NOT merge.**

---

**Hard stops:** end every phase boundary with "STOP and wait for the dispatcher." Never merge, never deploy.
