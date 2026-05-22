# PR Kickoff — Track I · I1.3c-ii: Upline Standard Overrides (completes the I1 core + hybrid)

**Track:** I (closes the I1 core). **Type:** Feature PR · **Size:** M–L · **Risk:** Medium — a NEW write-permission rule (upline writes a subordinate's override), plus a resolution layer over the c-i overlay.
**Provenance:** Track I spec §2 + Kyron's HYBRID model decision. c-i shipped org defaults + the actual-vs-target overlay (#262). This is the override half: a manager's direct upline customizes a specific subordinate's standards. After this, the I1 core and the hybrid model are both complete.

## Goal

A per-subordinate override of the activity standards, settable by that subordinate's upline, with **per-activity resolution `effective[activity] = override[activity] ?? orgDefault[role][activity]`**. The overlay (ManagerWarTab owner view + ManagerWarDetail browse view) switches from the org-default to the resolved value. The upline sets overrides from the browse view (where they're already looking at the subordinate's WAR).

## Source-verify first (Rule 17, Phase 1 — STOP, the rule is the crux)

Report verbatim before any code:

1. **The I1.3b browse rule** — quote the full `managerWeeklyReports` get/list block from firestore.rules: `warRoleRank()`, `callerBranchId()`, the rank/branch logic, the get-vs-list split. This is the read-direction precedent the override read/write must align with.
2. **User-doc fields + denormalization precedent** — quote the user-doc shape (role, branchId, unitId, tenantId) and how I1.3b/the WAR doc denormalizes `branchId` (so the rule reads `resource.data.branchId` rather than a `get()`). Report whether any existing rule uses `get(/databases/.../users/$(uid))`. This decides: denormalize the subordinate's role+branchId onto the override doc (mirror I1.3b, no `get()`, drift-managed) vs `get()` the user doc in the rule (fresh, costs a read). **Recommend.**
3. **Hierarchy / "direct upline" model** — confirm how the reporting line works: do all UMs in a branch report to that branch's BM (so "rank > target AND same branch" ≈ direct upline)? Is there a strict reporting-parent link on the user doc, or is rank+branch the model? This decides whether the write rule mirrors I1.3b's rank+branch or needs a stricter parent check. **Recommend.**
4. **The c-i overlay + standards service** — quote where ManagerWarTab + ManagerWarDetail compute the target today (the c-i lookup `orgDefault[role][activity]`) and the standards service surface (`getManagerActivityStandards`/`getRoleStandards`), so the override read + resolution slot in with one extra fetch.
5. **Edit-surface reuse** — confirm whether c-i's `ActivityStandardsModal` can be parameterized for per-manager override mode (vs the org-default mode), or whether a separate modal is cleaner. Report the modal's current props.

**STOP and report** — especially items 1–3 (the rule direction + denormalize decision + the upline model). I'll lock the rule shape before any code.

## Approach (subject to Phase-1 confirmation)

- **Storage** — `/tenants/{tid}/managerActivityStandardOverrides/{managerId}`: a partial map of activity → target (only the overridden activities; absent activities fall back to org-default), plus the Phase-1-decided isolation fields (tenantId, and likely denormalized role + branchId for the rule).
- **Rule (new)** — read by the subordinate (owner, sees own resolved target) + the upline chain (mirror I1.3b browse); **write by the direct upline only** (the Phase-1-locked rank/branch or strict-parent shape). Uplines never write peers/downline/cross-branch; the subordinate never writes their own override.
- **Resolution** — `getResolvedStandards({tenantId, managerId, role})` returning per-activity `override ?? orgDefault[role]`; blank both → no target (not "0 of 0").
- **Overlay** — ManagerWarTab + ManagerWarDetail use the resolved target. Where an activity is overridden vs inheriting the org-default, the value just reflects the resolved number (no need to badge "overridden" unless trivial — informational, not alarm; the flag is I3).
- **Edit surface** — from ManagerWarDetail (the upline viewing the subordinate's WAR), an upline-gated "Set custom standards for this manager" action opening the (reused or new) modal scoped to that subordinate.

## Scope

**IN:** the override collection + new rule + emulator rules; `getResolvedStandards` + resolution; the overlay switch to resolved values on both surfaces; the upline-gated override edit surface; service + component + emulator tests.
**OUT (named):** the accountability flag / escalation (I3); recruiting monthly roll-up (I2); §6 license-state. No `needCovered`. No change to the c-i org-default config or its admin edit surface.

## Phases

1. **Source-verify** (the 5 items). STOP; I lock the storage shape + the write/read rule before code.
2. **Storage + rule + service.** The override collection; the new read/write rule mirroring/extending I1.3b; `getManagerActivityStandardOverride` (read) + `setManagerActivityStandardOverride` (upline write) + `getResolvedStandards` (resolution). Emulator rules: direct-upline write ALLOW; peer/downline/cross-branch/self write DENY; owner read ALLOW; upline read ALLOW; unrelated read DENY. Service + resolution unit tests.
3. **Overlay + edit surface.** Switch ManagerWarTab + ManagerWarDetail to resolved targets; the upline-gated override edit from the browse view. Component tests (override takes precedence; falls back to org-default; blank-both → no target). Loading/empty/error; Nexus/44px/light+dark.
4. **Docs (placeholders).** CONTEXT.md recently-shipped + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark I1.3c-ii shipped, note **I1 core COMPLETE → Track I next: I2 (recruiting roll-up), I3 (accountability flag), §6 (license-state)**.
5. **Commit / push / PR.** Branch off fresh main. New rule additive → deploy pre-merge; confirm whether an index is needed (a by-`managerId` get needs none; a list query would). Lint + build. Full suite (env-unset is now the default). Push, PR via `gh`, Rule 15. Do NOT merge.

## Smoke — RUN

`setupBypassSession` (VERCEL_BYPASS_TOKEN by name only; negatives via REST):

1. **Upline sets override:** the subordinate's upline sets a custom target for one activity → reload → persist.
2. **Owner sees resolved:** the subordinate opens their WAR → the overridden activity shows the OVERRIDE target; a non-overridden activity shows the org-default; a blank-both activity shows actual-only.
3. **Browse sees resolved:** the upline opens the subordinate's WAR → same resolved targets.
4. **Write DENY:** a non-upline (a peer manager, or a cross-branch manager, via REST) writing the override → 403.
5. Light + dark, 390×844, 0 console errors.

## Acceptance criteria

- Overrides persist; writable only by the Phase-1-locked upline (peer/downline/cross-branch/self DENY in emulator + live); readable by owner + upline.
- Overlay shows `override ?? org-default` per activity; falls back correctly; no "0 of 0".
- New rule additive, deployed pre-merge; index only if a list query is introduced.
- Lint 0; build green; full suite green (env-unset default); smoke green.

## Post-merge

Standard fill. (Rule deployed pre-merge — no deploy post-merge.) Mark the I1 core complete in CONTEXT.md.
