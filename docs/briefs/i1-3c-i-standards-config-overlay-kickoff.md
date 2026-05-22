# PR Kickoff — Track I · I1.3c-i: Org-Default Activity Standards + Actual-vs-Target Overlay

**Track:** I (closing the I1 core). **Type:** Feature PR · **Size:** M · **Risk:** Low–Medium (a new tenant config + an edit surface + a display overlay; mirrors an existing config pattern).
**Provenance:** Track I spec §2 ("upline-set, customizable per tier" activity standards). **Kyron's model decision: HYBRID** — org defaults + upline override. This PR is the **org-defaults + overlay** half; the **upline-override** layer is I1.3c-ii.

Closes the I1 core when paired with c-ii. **No override layer** (c-ii), no accountability flag (I3), no monthly roll-up (I2).

---

## Goal

A tenant-level, per-tier (UM/BM/SM) set of weekly activity standards with blank defaults; an edit surface for the org-defaults owner to fill them in; and an **actual-vs-target overlay** on both the manager's own WAR (`ManagerWarTab`) and the upline browse detail (`ManagerWarDetail`). Effective standard here = the org default for the manager's role (overrides come in c-ii).

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

The whole point is to mirror what's already there. Report before any code:

1. **Existing tenant-config pattern** — how are the **tenure Company Floor** (#240) and the **Company Floor / Goals** configs stored and edited? Quote: the Firestore path (e.g. `/tenants/{tid}/config/{docId}`?), the read rule, the **write rule (who edits)**, and the edit-surface component. The standards config must mirror this exactly — same collection/doc pattern, same rule shape.
2. **Who edits the org defaults** — read it off the precedent in (1). Report what role edits the tenure/company-floor config (tenant_admin? sales_manager? rank-gated?) and **recommend** the editor for activity standards. My lean: whoever edits the tenure floor, plus the head-of-sales tier (`sales_manager`) since these are sales-activity targets — but confirm against the precedent and I'll lock it.
3. **Which activities get a standard** — from spec §2, the standard-bearing activities are: JFW, one-on-ones, recruiting (names/interviews/first-weeks), training sessions, unit meeting (held = Y), dashboard review (done = Y). Confirm the exact `ManagerWarTab` field set and which are numeric-target vs boolean-expectation. Personal production is **not** standardized.
4. **Overlay placement** — where in `ManagerWarTab` (owner) and `ManagerWarDetail` (browse) the per-activity rows render, so the standard + an actual-vs-target indicator can sit beside each. Confirm both read the same activity field set.

**STOP and report** — especially items 1 + 2 (the config pattern and the editor permission).

## Approach (subject to Phase-1 confirmation)

- **Config** — a tenant-level `managerActivityStandards` doc mirroring the tenure-floor config: per-role keys (`unit_manager`/`branch_manager`/`sales_manager`), each a map of activity → weekly target, **blank/null by default**. Same read rule (all managers read) and write rule (the Phase-1-confirmed editor role) as the precedent.
- **Edit surface** — a settings panel for the org-defaults editor to set per-role standards (numeric inputs; booleans as expected-Y toggles), `parseFloat` on numerics, blank = "no standard set." Mirror the tenure-floor edit surface.
- **Read + resolve** — a small `getActivityStandards({tenantId, role})` (or reuse the config read) returning the role's standards; `null`/blank standard → render no target for that activity (not "0 of 0").
- **Overlay** — in `ManagerWarTab` and `ManagerWarDetail`, beside each standard-bearing activity show `actual / target` with a simple met/under indicator (Nexus tokens, no red-alarm styling — this is informational, the accountability *flag* is I3). Blank standard → show actual only, no target.

## Scope

**IN:** the standards config (schema + read + edit surface) mirroring the tenure-floor pattern; `getActivityStandards`; the actual-vs-target overlay on `ManagerWarTab` + `ManagerWarDetail`; service + component + emulator-rules tests (editor can write, non-editor DENY, all-managers read).
**OUT (named):** the upline-override layer + resolution (**I1.3c-ii**); the accountability flag / escalation (I3); recruiting monthly roll-up (I2); §6 license-state. No `needCovered`.

## Phases

1. **Source-verify** (the 4 items). STOP; confirm the config pattern + editor permission before code.
2. **Config + rule + read.** The `managerActivityStandards` config mirroring the precedent; the read rule (all managers) + write rule (the confirmed editor). `getActivityStandards`. Emulator rules: editor write ALLOW; non-editor (e.g. UM/agent) write DENY; all-managers read ALLOW. Service unit tests.
3. **Edit surface + overlay.** The per-role standards edit panel; the actual-vs-target overlay in `ManagerWarTab` + `ManagerWarDetail`. Component tests (overlay renders target when set, actual-only when blank). Loading/empty/error; Nexus/44px/light+dark.
4. **Docs (placeholders).** CONTEXT.md recently-shipped + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark I1.3c-i shipped, note **I1.3c-ii (upline overrides) next — completes the I1 core and the hybrid model**.
5. **Commit / push / PR.** Branch off fresh main. Config rule additive (new config doc rules) → deploy pre-merge; confirm no index needed (a single config-doc read is by id). Lint + build. Full suite, env-unset parity. Push, PR via `gh`, Rule 15. Do NOT merge.

## Smoke — RUN

`setupBypassSession` against the preview (`VERCEL_BYPASS_TOKEN` by name only; negatives via REST):

1. **Editor sets standards:** as the org-defaults editor, set per-role weekly standards → reload → persist.
2. **Owner overlay:** a manager (matching a configured role) opens their WAR → each standard-bearing activity shows `actual / target`; an activity with a blank standard shows actual-only.
3. **Browse overlay:** an upline opens a subordinate's WAR in the browse view → same actual-vs-target overlay renders.
4. **Edit DENY:** a non-editor (UM via REST) writing the standards config → 403.
5. Light + dark, 390×844, 0 console errors.

## Acceptance criteria

- Per-role standards persist; editable only by the confirmed editor (non-editor DENY in emulator + live); all managers read.
- WAR + browse show actual-vs-target where a standard is set, actual-only where blank (no "0 of 0").
- Config rule additive, deployed pre-merge; no index needed.
- Lint 0; build green; suite green incl. env-unset parity; smoke green.

## Post-merge

Standard fill. (Config rule deployed pre-merge — no deploy post-merge.)
