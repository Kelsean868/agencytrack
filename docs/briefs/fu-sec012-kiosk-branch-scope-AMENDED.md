# FU SEC-012 (AMENDED) — Branch-scope kiosk reads (rules + kiosk client)

> RUN ON: Opus (/model opus). Security-sensitive; touches firestore.rules AND
> src/ (kiosk client). HOLD FOR HUMAN MERGE — Kyron merges + runs
> `firebase deploy --only firestore:rules`. Gemini on-demand review required.
>
> PHASE 0 IS ALREADY DONE — do NOT re-run it. The recon HARD-STOP was resolved
> by the dispatcher. The proof test tests/rules/kioskBranchScope.rules.test.mjs
> already exists (13/13 confirming the hole). Resume at BUILD with the rulings
> below.

## Dispatcher rulings (these resolve the Phase 0 STOP)
1. SCOPE = OPTION A (rules + kiosk client). Close the WHOLE hole, including the
   tenant-wide submissions-list arm, by branch-scoping the rule AND adding a
   matching client-side branch filter so the kiosk keeps working. Rules-only
   (Option B) and split (Option C) are REJECTED — B leaves the biggest hole
   (full submission enumeration) open; C ships a broken kiosk in the interim.
2. AgentOfMonth = scope for single-branch NOW, bank the multi-branch limitation
   as an FU. agentOfMonth/{monthKey} is a shared per-month doc stamped with the
   last writer's branchId; branch-scoping its read is correct for single-branch
   Tatil. The clean multi-branch fix (per-branch AOM docs) is a data-model
   change — bank it as an FU that BLOCKS second-branch onboarding.
3. Token migration = NO ACTION. There are NO live production kiosk tokens
   (confirmed by owner). Any kiosk minted post-deploy via KioskModeTab inherits
   the creating manager's branchId claim (correct). The pre-deploy step is a
   CONFIRMATION only (see Phase 5), not a re-issue.

## Build — Rules (firestore.rules)
1. Branch-scope kioskCanRead so kiosk reads require the target doc's branch to
   match request.auth.token.branchId, IN ADDITION to the existing tenant check,
   for: users, submissions (both get and list arms), leaderboards/{branchId},
   agentOfMonth/{monthKey}. Mirror the pattern the BM arms already use
   (resource.data.branchId == request.auth.token.branchId for get; the
   where-clause enforcement for list).
2. Do NOT change weeklyChampions — it is tenant-wide BY DESIGN (documented in
   the rule) and read by all tenant members. Leave it.
3. DO NOT over-scope. Same-branch kiosk reads MUST still be allowed. Both the
   cross-branch DENY and the same-branch ALLOW are hard requirements.

## Build — Kiosk client (src/)
4. getKioskYTDSubmissions (src/lib/kiosk/kioskServices.js) currently filters by
   weekStarting + status only — no branchId. Add where('branchId','==',branchId)
   so the branch-scoped list rule permits the query. Thread branchId from
   KioskShell (it already receives branchId via KioskRoute) through to the
   service call. Do the same for any other kiosk read that the branch-scoped
   rule would otherwise deny.
5. CONFIRM the users-list dead path (CC self-critique): getKioskTenantUsers does
   an unfiltered users list, but the rules grant kiosk `get` not `list`, and
   KioskShell's try/catch silently swallows the failure. Determine whether this
   path is already-dead (pre-existing, not caused by SEC-012). If it IS used by
   any live kiosk panel, either add the branch-filtered list support or confirm
   it is safely unused and note it. Do NOT expand scope to fix an unrelated
   pre-existing degradation beyond a one-line note unless it breaks the kiosk.

## Verify — Emulator rules-unit tests (port 9090)
6. Extend tests/rules/kioskBranchScope.rules.test.mjs so that AFTER the fix:
   - Branch-A kiosk is DENIED reading Branch-B users, submissions (get AND
     list), leaderboard, and AgentOfMonth (hole closed — the tests that
     currently prove the hole must flip to DENY).
   - Branch-A kiosk is STILL ALLOWED its own branch's equivalents (no regression).
   - Cross-tenant kiosk still fully DENIED (tenant isolation unchanged).
   - weeklyChampions still readable (unchanged by design).
7. Run the rules-test suite green on the emulator (firebase emulators:exec
   --only firestore "node tests/rules/kioskBranchScope.rules.test.mjs").

## Verify — Live kiosk smoke (because src/ changed)
8. Smoke the kiosk against the preview as the owning subject: confirm the kiosk
   still loads and displays its own branch's submissions/leaderboard/AOM with
   the new client branch filter (no empty/broken panels). This proves Option A
   didn't regress the working kiosk. Both themes if the kiosk surface themes.

## Phase 4 — Docs
9. Mark SEC-012 RESOLVED in docs/audits/agencytrack-audit-2026-07-05-delta.md
   with the fix summary + pointer to the rules-unit test. Bank the multi-branch
   AOM limitation as an FU in FOLLOW_UPS.md flagged "BLOCKS second-branch
   onboarding". Update CONTEXT.md + FOLLOW_UPS.md (size-capped); note the fix is
   HELD pending human merge + deploy.

## Phase 5 — Commit / push / PR — THEN STOP (HOLD)
10. Single branch, one PR. git fetch origin before branching off main.
    Branch: fix/sec012-kiosk-branch-scope
    Commit: "fix: branch-scope kiosk reads to prevent cross-branch access (SEC-012)"
    Push, open PR. PR body MUST include:
    - This is a RULES + CLIENT change requiring human merge + `firebase deploy
      --only firestore:rules`.
    - Before/after rules-unit test results (the hole-proving tests now DENY).
    - The live kiosk smoke result.
    - A PRE-DEPLOY CONFIRMATION CHECKLIST for Kyron:
        (a) Confirm no live production kiosk tokens exist (owner has confirmed
            none as of this brief) — if any were minted since, re-issue them
            after deploy via KioskModeTab so they carry the correct branchId.
        (b) Deploy command: firebase deploy --only firestore:rules
        (c) Post-deploy: mint a fresh kiosk via KioskModeTab and confirm it
            loads its branch's data on production.
    - Request Gemini on-demand review (rules PR convention).
    Poll CodeRabbit + Gemini, disposition all comments in a table.
11. HOLD. Do NOT merge. Do NOT deploy. Report PR-ready with the disposition
    table and the pre-deploy checklist.

## Scope guard
Kiosk branch-scoping only (rules + the minimal kiosk-client filter to keep it
working). Do NOT touch the functions-side weekOfYear gate, weeklyChampions, the
AOM data model (bank it), or any other audit finding. Strike count carries from
Phase 0 at 0/2.
