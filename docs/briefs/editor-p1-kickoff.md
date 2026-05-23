# Track D — Tenant-Admin Awards Ruleset Editor (Phase-1-FIRST kickoff brief)

**Track:** D, third PR. Follows D1 (#283, ruleset extracted to `src/config/awardsRuleset/2026.js`) and D1b (#285, `getAwardsRuleset(tenantId, year)` loader reads `tenants/{tid}/config/awardsRuleset_2026` AS-IS, falls back to `DEFAULT_RULESET_2026`; three consumers threaded).
**Type:** Feature (tenant-admin UI + Firestore write). **Size:** L. **Risk:** Medium-High — first WRITE path to the ruleset doc; user-visible admin UI; gated to tenant_admin/platform_admin.
**Goal of the eventual PR:** a Tenant-Admin screen that loads the current ruleset (doc-or-default), lets the admin edit award thresholds/criteria, and writes the COMPLETE ruleset back to `tenants/{tid}/config/awardsRuleset_2026`. This is what makes per-tenant rulesets actually configurable; the loader (D1b) already consumes whatever is written.

**PHASE-1-FIRST.** Run Phase 1 source-verify, report, and STOP — no code. The dispatcher locks the Phase 2-5 scope (editor location/host, write-service shape, form strategy for nested/array fields, validation, save UX, any split) before you resume.

---

## Phase 0 — clean main

git checkout main
git fetch origin
git pull --ff-only origin main
git status
Untracked files under scripts/verification/ and scripts/seed/ are expected — ignore them.
Single new branch off fresh main when you eventually build: `feat/d-ruleset-editor`. Do NOT create it during Phase 1 (read-only).

**Hard stops (Rule 12):** not on main after sync, dirty tree beyond known untracked scripts, or a pull conflict -> `STOP and wait for dispatcher`.

---

## Phase 1 — source-verify, then HARD-STOP

Report each with file:line + short quotes. Pair grep with `git ls-files` for tracked status (Rule 17). Then emit `STOP and wait for dispatcher`, no code.

1. **Loader + write-rule landing state.** Confirm `getAwardsRuleset` in `src/services/awardsRulesetService.js` — quote the doc path it reads, the AS-IS return, and the `DEFAULT_RULESET_2026` fallback. Then quote the `firestore.rules` config block (the `match /config/{docId}` write clause): does the EXISTING rule already allow `tenant_admin` / `platform_admin` to WRITE `tenants/{tid}/config/awardsRuleset_2026`? If yes, the editor needs NO rule change (parallel to D1b's loader) — state that explicitly.

2. **`DEFAULT_RULESET_2026` shape — the form's field map.** From `src/config/awardsRuleset/2026.js`, enumerate the top-level award groups and, under each, the editable fields with their types: scalar thresholds (TTD/API), counts (apps), percentages (persistency), and any ARRAYS (e.g. club tiers). Flag scalars vs arrays clearly — arrays drive form complexity and a possible split.

3. **Tenant-admin UI host.** Find where a tenant_admin lands after login and whether a settings/config/admin surface exists to mount the editor on. Quote the component path, route/tab wiring, and how it is gated to tenant_admin (role check / claim). If NO host surface exists yet, flag that one must be created and where it would naturally live.

4. **Config-WRITE precedent (the template to mirror).** D1b found `companyMinimums` is written "only via the B5 tenant-admin config UI." Verify whether that B5 editor ACTUALLY EXISTS in code: search services for any `setDoc`/`updateDoc` to `tenants/{tid}/config/*`, and any companyMinimums editor component. If it exists, quote its write-service signature + form/validation pattern in full — that is the exact template. If it is only planned (no code), say so plainly.

5. **Validation + form + state patterns.** Confirm the `parseFloat()`-on-numeric-fields rule with an example site. Identify the form/input components and validation approach used in comparable editors, and how save/loading/error/empty states are handled. Note the Nexus design tokens / 44px touch-target / no-gradient constraints that apply.

6. **AS-IS write constraint (correctness gate).** Confirm the implication of D1b's AS-IS loader: the editor MUST load the current ruleset (doc or `DEFAULT_RULESET_2026`), edit in place, and write the COMPLETE object back — a partial write would replace the whole ruleset and break awards. Verify nothing in `getAwardsRuleset` deep-merges or tolerates partials. State this as a hard acceptance criterion for the build.

---

## Phase 1 Recommendations (report, do not implement)

- **Editor location + host** (new component path; which screen/tab it mounts on; gating).
- **Write service**: extend `awardsRulesetService.js` with `setAwardsRuleset(tenantId, year, ruleset)` vs a separate file — recommend, with reason.
- **Form strategy** for the nested groups + arrays (esp. club tiers): flat scalar fields first vs full array editing.
- **Validation rules** (parseFloat, non-negative, required) and **save UX** (await + success/error toast; no optimistic write).
- **Split recommendation**: is this one L PR, or scalars-first (P-a) + array/tier editing (P-b)? Recommend based on what you found.
- **Test plan**: write-service unit tests (mirror the loader tests), and what the pre-merge browser smoke must cover (load → edit one threshold → save → reload → loader returns it → awards reflect it → reset).

**STOP and wait for dispatcher.**
