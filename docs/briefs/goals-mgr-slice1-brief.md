# Manager Goals — Slice 1: recommend-vs-lock model + cascade-floor + committed denorm (headless)

## Context
First slice of the manager Goals build. **Pure service/schema logic, NO UI** — the headless
foundation Slices 2 (manager surface) and 3 (Playground/awards) build on. The recon confirmed
the role-aware roster, per-agent target editing, manager R/W rules, and `setBy`/`setByName`
provenance all EXIST; this slice adds only the behavioral model the flat goal-writes lack.

Confirmed decisions (Kyron):
- **Recommend vs Lock:** a manager sets a goal as **Recommend** (advisory; the owner confirms
  their own number; no enforcement) or **Lock** (a binding floor the level below must meet).
  At the agent level, a *Locked* manager target is a personal floor the agent's own commitment
  must clear; *Recommended* is a suggestion the agent confirms in Game Plan.
- **Committed badge:** denormalize a `gamePlanCommitted` flag onto the agent's goals doc at
  commit time, plus a one-time backfill.

## Scope baked in (flag if you disagree) — cascade-floor granularity
- **Agent-level lock = HARD-enforced** here: a Locked manager target raises the agent's
  effective floor; the agent's personal commitment must be ≥ the locked target, validated at
  write exactly as the company floor already is.
- **Tier-level lock = STORED intent/provenance** here, **not** write-time roll-up-enforced
  (children's SUM ≥ locked parent is cross-document and fragile). Slice 2 shows it as a
  display gap. A hard roll-up is a separate Cloud-Function-class piece — banked.
- Note: like the existing company-floor check, this enforcement is **service-side** (in
  `goalsService`/`commitPlanService`), not a Firestore-rules boundary. Rule-level enforcement
  would be a separate hardening — out of scope, consistent with how the company floor works
  today.

## Phase 1 — recon (report inline, then PROCEED)
1. Confirm the agent goals-doc schema — the manager-set `target*` namespace (targetAnnualAPI,
   …) and the agent `personal*` namespace, and the existing company-floor validation in
   `setGoals` (goalsService.js ~139–147) so the lock floor extends it consistently.
2. Confirm where `setUnitGoals`/`setBranchGoals`/`setSalesManagerGoals` write, so the `locked`
   flag is added beside `setBy`/`setByName`/`updatedAt`.
3. Confirm the commit transaction's write to the agent goals doc (`commitPlanService` — the
   personalAnnualAPI/Apps set) so `gamePlanCommitted` joins that same atomic write.
4. Confirm no rules change is needed (recon: managers already R/W goals docs; the agent writes
   their own on commit). Flag anything off.

## Phase 2 — build
- **Lock fields:**
  - `targetLocked: boolean` on the agent goals doc, written by the manager-set-target path
    (default `false` = recommended).
  - `locked: boolean` on the tier-goal writes (default `false`).
- **Agent-level cascade floor (hard):** extend `setGoals`'s personal-commitment validation —
  for each metric (API, apps, persistency), the agent's `personal*` must be ≥
  **max(company tenure floor, `targetLocked` ? `target*` : 0)**. On violation, throw the floor
  error naming whether the binding floor was the company floor or a manager lock. A
  *recommended* (unlocked) target must NOT constrain the commitment.
- **Committed denorm:** in `commitPlanService`'s commit transaction, write
  `gamePlanCommitted: true` (reuse the loop's `committedAt` if handy) onto the agent's goals
  doc alongside the existing personalAnnualAPI/Apps set.
- **Backfill script** (`scripts/migrations/…`): set `gamePlanCommitted: true` on the goals doc
  for every agent whose `yearPlan/{year}` or `monthlyPlan/{year}` already has status
  `committed`. Idempotent, `--dry-run` flag, logs counts.

## Phase 3 — tests
- Lock fields persist (default false; locked true).
- Agent-level floor: a personal commitment below a `targetLocked` target is rejected; at/above
  succeeds; a *recommended* (unlocked) target does NOT constrain it.
- Company floor still enforced independently (the `max()` picks whichever is higher).
- `gamePlanCommitted` written on commit.
- Backfill: dry-run reports, apply sets the flag, idempotent on re-run.

## Phase 4 — docs + commit/PR
- CONTEXT.md per Rule 16(b): service-logic change on a live path — advances Current main HEAD.
- Branch `feat/goals-mgr-slice1-model`;
  `feat(goals): recommend-vs-lock model + agent cascade-floor + committed flag`.
- Push; PR; **Rule 21** Gemini; **Rule 20** SHA.

## Smoke
**Write-read-verify against preview** (client-side service logic — no CF/rules deploy). Manager
= tenant admin (kelsean+tenantadmin@gmail.com); agent = test agent (kelsean@gmail.com):
1. As the manager, set a **locked** target on the test agent above their company floor.
2. As the agent, attempt to commit a personal goal **below** the locked target → assert
   **rejected**.
3. Commit **at/above** the locked target → assert it **persists** and `gamePlanCommitted: true`
   is written.
4. Set a **recommended** (unlocked) target → assert a lower commitment is **allowed**.
Both themes not required (headless), but exercise the full rules + claims path.

## Merge posture
**Human-merge** — new enforcement logic on a live goal-write path. Build to PR-open and STOP;
pre-review the floor logic + the commit denorm, then merge. The **backfill is run by Kyron
post-merge** (service-account/Admin SDK — the same credential the Money Needs clear needed).

## Banked (NOT this slice)
- Unit-scoping the goals-write rules (any manager can currently write any agent's goals doc) —
  separate security FU.
- Hard cross-doc tier roll-up enforcement — Cloud-Function-class, separate.
