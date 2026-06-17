# Brief: Smoke-tenant data seed — populate `tatillife_smoke` so visual smokes have teeth

## Context
Visual smoke assertions (e.g., #677's per-month-figure check) skip because the smoke agent has no
committed monthly plan or production data. seed-smoke-tenant (PR #674) already provisions an isolated
`tatillife_smoke` tenant (branch `smoke_branch`) built so smoke accounts can't bleed into
`tatillife_south` roll-ups. This brief seeds agent + roster DATA into that tenant so the skipped
assertions — and future #4 sorting / leaderboard smokes — can actually assert.

**Distinct-email path (locked):** smoke accounts use **plus-aliases of kelsean@gmail.com**
(e.g., `kelsean+smokeagent@gmail.com`). Firebase treats each as a distinct account/UID; Gmail routes
mail to kelsean's single inbox. kelsean@gmail.com itself stays in `tatillife_south`, untouched — no
re-claim, no orphaned south docs, no broken south-bound scripts.

## Decisions (locked)
- Smoke identity = plus-aliases of kelsean@gmail.com for the five tenant-scoped roles
  (agent/UM/BM/SM/TA); platform_admin per existing convention (claim-only). Exact env var names
  confirmed in Phase 1.
- **All seed writes target `tatillife_smoke` ONLY. NEVER `tatillife_south`.**
- kelsean@gmail.com (original) remains a `tatillife_south` member, untouched.

## Human preconditions (Kyron — before the prod-run steps; CC can't read prod)
1. **Confirm kelsean@gmail.com's current `tenantId` claim in the Firebase console.** The earlier
   seed-smoke-tenant run's email is unverified — if it used the kelsean@gmail.com default, kelsean may
   already be claimed into `tatillife_smoke`. If so, **restore its claim to `tatillife_south`** before
   proceeding so south is whole. If already south, nothing to do.
2. Set the A11Y role-email vars in `.env.local` to the plus-aliases (exact var names from Phase 1).

## CC build scope (emulator-validated; CC performs NO prod writes)
A new data-seed script (e.g., `functions/scripts/seed-smoke-data.cjs`) that, against
`tatillife_smoke` ONLY:
- **Smoke agent** (`A11Y_AGENT_EMAIL` alias): a committed annual Game Plan + a committed monthly plan
  (even split fine) + production data (submissions yielding non-zero settled/submitted API, apps, and
  persistency, so % of goal computes). This is what un-skips #677's figure assertion.
- **Varied roster** — 3–4 agent **Firestore user docs** under the smoke UM/BM (no Auth accounts needed;
  smokes view them as a manager, they don't log in as them), each with **different** settled/submitted
  API, apps, persistency, % of goal, and contractDate — so leaderboard ranks and the future #4 sorting
  smokes have real spread to assert on.
- Idempotent; `--dry-run` / `--apply` guard; emulator-aware; passwords never logged; **a hard guard
  that aborts if the resolved target tenant is `tatillife_south`** (match seed-smoke-tenant's safety
  conventions).
- An emulator-verify script in parity with seed-smoke-tenant's `__verify__`.

Also re-enable the #677 skipped assertions (`S3-c-distinct`, `S3-c-ratio`, `S3-d`) so they assert the
per-month figure is distinct from the annual once the agent has a monthly plan.

## Out of scope
- The #4 sorting UI itself (separate brief). This only seeds the data its smoke will later assert on.
- Any `tatillife_south` write of any kind.
- Re-running seed-smoke-tenant (existing script; Kyron runs it).

## Procedure note
Branch at **Phase 0, before any code**. PowerShell — no `&&`.
**Data + tenant-claim infra → human review (Tier C); build-and-hold, do not auto-merge.**

## Phase 1 — recon (report before building)
1. Read `seed-smoke-tenant.cjs` — match its tenant/branch ids, env-var names, doc-field builders, and
   guards exactly.
2. Read the app's read paths for: a committed Game Plan (annual), a committed monthly plan, and a weekly
   submission — so seeded docs match the shapes the app actually queries (a mismatch = the smoke won't
   see the data). Reference `seed-weekly-floors-test-submission.mjs` for the submission shape, but target
   `tatillife_smoke`, not south.
3. Read the #677 smoke's skip guards (`S3-c`/`S3-d`) to know the exact assertion to re-enable.
4. Report findings, then proceed.

## Phase 2 — build
- The data-seed script (agent full data + varied roster) per scope above.
- The emulator-verify script.
- Re-enable the #677 assertions.

## Verification
- **CC (emulator only):** dry-run + apply against the emulator; confirm the docs are created with the
  right shapes; confirm the hard south-guard aborts when the target resolves to `tatillife_south`;
  lint/test/build green; Gemini polled + dispositioned.
- **CC cannot verify the live assertions** — prod data isn't seeded yet. State this in the report.
- **Kyron (prod — the real proof):** complete preconditions 1–2; re-run `seed-smoke-tenant --apply` to
  provision the alias accounts in `tatillife_smoke`; run `seed-smoke-data --apply`; re-run the #677 smoke
  and confirm `S3-c`/`S3-d` now **PASS** (per-month figure distinct from annual). Report PASS.

## Phase 4-5
- Docs placeholders (CONTEXT.md, FOLLOW_UPS.md). Branch, push, open PR. **HOLD for human review (Tier C).**

## Acceptance
- Smoke agent in `tatillife_smoke` has annual + monthly + production data; roster has 3–4 varied agents;
  the #677 assertions un-skip and pass after the prod seed; **zero `tatillife_south` writes**.

## Risks
- Data writes + tenant claims touch the live Firebase project → human review required. The hard
  south-guard and the kelsean@gmail.com placement precondition are the safeguards against disturbing or
  polluting the live tenant. The skipped-assertion un-skip only proves out after Kyron's prod seed —
  that manual re-run is the gate.
