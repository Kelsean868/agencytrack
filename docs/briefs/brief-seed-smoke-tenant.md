# Brief: Provision `tatillife_smoke` tenant + isolated A11Y accounts

**Target file in repo:** `docs/briefs/seed-smoke-tenant.md`
**Size:** M
**Type:** seed/provisioning script (data + Auth claims) — auth/data
**Merge:** HUMAN-MERGE (auth/data).
**Run:** HUMAN-RUN against production. CC builds + emulator-validates the script to PR-open and STOPS. CC does **not** run it against production Firebase.

---

## Why

The A11Y smoke accounts were deliberately deleted because, living in `tatillife_south`, they polluted production leaderboards/roll-ups. This recreates them in a dedicated, structurally-isolated tenant `tatillife_smoke`, so smokes have working role-tier logins that can never bleed into production. Immediate payoff: resolves the rejected-BM-credential blocker on PR #672 and restores the write-read-verify safety net for all future runs.

## Source-verified facts (from read-only recon — CC re-verify with `git grep` before building)

1. **No tenant-provisioning machinery exists** — a tenant is implicit doc assembly. `functions/scripts/seed-first-tenant-admin.cjs:143-196` sets claims `{role, tenantId, branchId, ownedBranchIds}` + one `tenants/{id}/users/{uid}` doc (merge). Mirror its admin-init + `.env.local` loading pattern. Note its hardcoded `DEFAULT_BRANCH_ID='tatil_south'` (:57) — do NOT inherit that literal.
2. **The app never reads `/platform/tenants/{id}`** — no registry doc required. `config/settings` and `config/companyMinimums` are optional (built-in defaults; absence does not break render).
3. **Claims are claims-primary, no env fallback** (`AuthContext.jsx:40-90`): a correctly-claimed `tatillife_smoke` account routes the whole app to that tenant automatically. Claim shape: `{ role, tenantId, branchId, ownedBranchIds? }`.
4. **User-doc shape is authoritative in `buildDocFields()` (`functions/index.js:181-224`).** The script must produce docs matching that output per role — do NOT invent fields. Per-role specifics from recon: agent needs `agentNumber`, `unitId` (→ a UM's uid), `contractStartDate`; UM has `unitId = own uid`; BM `ownedBranchIds=['<smoke branch>']`; SM/TA `ownedBranchIds=['*']`; platform_admin is **claim-only, `tenantId:null`, no Firestore doc**.
5. **Branches are a real collection** `tenants/{tid}/branches/{branchId}` with `{name, managerId, active}` (`branchService.js:36`); `listBranches()` returns `[]` (no throw) when empty. **Units are implicit** — a unit = its UM's uid.
6. **Rules + indexes are fully tenant-generic** (zero `tatillife` literal) — a new tenant works with no rules/index change.
7. **Welcome-wizard gate** (`AgentDashboard.jsx:159`): `hasSeenWelcome===false && !onboardingComplete && role==='agent'`. For a clean smoke agent set `onboardingComplete:true` (and/or `hasSeenWelcome:true`) so it lands on the dashboard, not the wizard.
8. **A11Y keys in `.env.local`:** 6 role tiers × email/password (agent, unit_manager, branch_manager, sales_manager, tenant_admin, platform_admin). No `A11Y_TENANT_ID` yet.

## Scope

**In — one new file `functions/scripts/seed-smoke-tenant.cjs`, idempotent and re-runnable:**

Target tenant = `process.env.A11Y_TENANT_ID ?? 'tatillife_smoke'`. Smoke branch id = `smoke_branch`.

Two-pass design (so cross-references resolve):
- **Pass 1 — Auth + claims:** for each of the 6 A11Y emails (read from `.env.local`, never echo passwords): get-or-create the Auth user, set its password to the `.env.local` value (keeps creds in sync each run), set custom claims. Collect resolved uids. PA claims `{role:'platform_admin', tenantId:null}`; the other five carry `tenantId:'tatillife_smoke'` + `branchId:'smoke_branch'` (+ `ownedBranchIds` per role).
- **Pass 2 — Firestore (merge:true):**
  - `tenants/tatillife_smoke/branches/smoke_branch` = `{ name:'Smoke Test Branch', managerId:<BM uid>, active:true }`.
  - User docs for the five tenant-scoped roles matching `buildDocFields()` per role: all share `branchId:'smoke_branch'`; UM `unitId=own uid`; agent `unitId=<UM uid>` + `onboardingComplete:true` + `hasSeenWelcome:true` + a valid `contractStartDate`; BM `ownedBranchIds:['smoke_branch']`; SM/TA `ownedBranchIds:['*']`.
  - **platform_admin: no doc** (claim-only).
  - Optional minimal `tenants/tatillife_smoke/config/settings` = `{ companyName:'Smoke Test Tenant', primaryColor:'#01696f' }` for a sensible tenant label (merge; safe to include).

**Out (do NOT touch):**
- Any production data, `tatillife_south`, or the hardcoded scheduled-fn `TENANT_ID` (`functions/index.js:42`) — scheduled leaderboard won't run for the smoke tenant; that's intended isolation, handled per-smoke later via `recomputeLeaderboardOnDemand({tenantId})`.
- `.env.local` (gitignored — operator adds `A11Y_TENANT_ID=tatillife_smoke` manually; CC must not commit it).
- The 46 hardcoded REST smokes — separate follow-up brief.

## Phases

- **Phase 0 — Re-verify:** `git grep` the `buildDocFields` field set, `branchService` branch shape, the seed-script admin-init/env pattern, and the welcome-wizard gate. Confirm facts 1–8. Halt on any drift.
- **Phase 1 — Build** `functions/scripts/seed-smoke-tenant.cjs` per the two-pass design.
- **Phase 2 — Static verify:** `npm run lint` clean; no password ever logged; a `--dry-run`/guard that prints intended ops without writing.
- **Phase 3 — Smoke (EMULATOR — required; no production touch):** start the Auth + Firestore emulators (Java JDK 21 available); run the script **twice**; assert (a) all 6 Auth users exist with the exact claim shapes, (b) the branch doc + 5 user docs exist matching `buildDocFields` per role, (c) PA has claims but no doc, (d) second run is a clean no-op (idempotent), (e) zero password strings in stdout. This is the machine-verifiable gate.
- **Phase 4 — Docs-with-placeholders:** add an operator runbook section (below) to the brief's companion doc; CONTEXT.md / FOLLOW_UPS note recording the smoke-tenant decision + the isolation invariant; placeholder for post-prod-run live verification.
- **Phase 5 — Commit/push/PR:** branch `chore/seed-smoke-tenant`; commit `chore(test): idempotent seed for tatillife_smoke tenant + A11Y accounts`; push; open PR; STOP. **Script is NOT run against production by CC.**
- **Phase 6 — Gemini disposition** per Rule 21.

## Operator run (HUMAN — after merge, outside CC's PR)

1. Add `A11Y_TENANT_ID=tatillife_smoke` to `.env.local`.
2. Run `node functions/scripts/seed-smoke-tenant.cjs` against production (admin creds). Re-runnable safely.
3. Re-run PR #672's kiosk smoke against its preview — the BM account now resolves to `tatillife_smoke`; the credential blocker should clear and the smoke pass.

## Self-critique gate (Rule 22 — known gaps)

- **Gap 1:** Emulator validation proves doc/claim shape + idempotency, NOT that the *live* app routes a smoke account to `tatillife_smoke`. That's confirmed only by the operator's live re-smoke (step 3) — tracked as a Phase-4 placeholder, not closed by this PR.
- **Gap 2:** Leaderboard-dependent smokes still won't have data in the smoke tenant (scheduled aggregation is `tatillife_south`-bound). Out of scope here; they'll need a `recomputeLeaderboardOnDemand({tenantId:'tatillife_smoke'})` setup step when those smokes are retargeted (Brief 2 territory).

## Falsification-before-banking (Rule 23)

- "A correctly-claimed `tatillife_smoke` account routes the whole app to that tenant with zero code change" is overturned if the operator's live re-smoke (step 3) shows the account still resolving to `tatillife_south` or an `auth/unauthorized-domain`/tenant-mismatch error. If so → halt, do not bank, investigate claim propagation before proceeding.

---

## Dispatch prompt (paste to CC)

```
/land-and-dispatch docs/briefs/seed-smoke-tenant.md

Provision a dedicated smoke tenant. M, seed/provisioning script (auth/data), HUMAN-MERGE, HUMAN-RUN (CC builds + emulator-validates to PR-open and STOPS; do NOT run against production).

Phase 0: git grep to re-confirm buildDocFields (functions/index.js:181-224) field set per role, branchService branch shape, seed-first-tenant-admin.cjs admin-init/.env-loading pattern, and the AgentDashboard welcome gate. Halt on drift.

Build functions/scripts/seed-smoke-tenant.cjs — idempotent, target = A11Y_TENANT_ID ?? 'tatillife_smoke', branch = smoke_branch. Two passes: (1) get-or-create the 6 A11Y Auth users from .env.local (never echo passwords), set password each run, set claims { role, tenantId, branchId, ownedBranchIds? } — PA is tenantId:null claim-only; (2) merge-write the branch doc {name,managerId:<BM uid>,active:true}, the 5 user docs matching buildDocFields per role (shared branchId:smoke_branch; UM unitId=own uid; agent unitId=<UM uid> + onboardingComplete:true + hasSeenWelcome:true + valid contractStartDate; BM ownedBranchIds:['smoke_branch']; SM/TA ownedBranchIds:['*']), and an optional minimal config/settings. NO platform_admin doc. Do NOT touch production data, tatillife_south, the scheduled-fn TENANT_ID, or .env.local.

Phase 2: lint clean, no password logged, dry-run guard. Phase 3 smoke: EMULATOR only — run the script twice, assert 6 Auth users + correct claims, branch + 5 docs matching buildDocFields, PA claim-only/no-doc, idempotent second run, zero password strings in stdout. Phase 4 docs + operator-run runbook + post-prod-run verify placeholder. Phase 5: branch chore/seed-smoke-tenant, open PR, STOP — do NOT run against prod. Phase 6: Gemini disposition.
```
