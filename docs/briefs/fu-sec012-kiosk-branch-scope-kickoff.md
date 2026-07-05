# FU SEC-012 — kioskCanRead is tenant-scoped but not branch-scoped (cross-branch read)

> RUN ON: Opus (/model opus). Security-sensitive rules change with a recon gate.
> HOLD FOR HUMAN MERGE. This is a firestore.rules change — build to PR-open and
> STOP. Do NOT merge. Do NOT run firebase deploy. Kyron merges and deploys
> manually with `firebase deploy --only firestore:rules`. Rules PR gets Gemini
> on-demand review per the rules-PR convention.

## Finding (from the 2026-07-05 security delta audit — STATIC ANALYSIS ONLY)
`kioskCanRead` in firestore.rules scopes reads by TENANT but not by BRANCH, so
(per static reading) any valid kiosk token can read every branch's users,
submissions, leaderboards, and Agent-of-Month records tenant-wide — not just its
own branch's. Severity HIGH (cross-branch data exposure). This has NOT been
proven at runtime; Phase 0 must confirm it is real before any fix.

## Environment (confirmed)
- Firestore + Auth emulators boot clean. `@firebase/rules-unit-testing@^5.0.0`
  is already a dependency.
- IMPORTANT: this repo's Firestore emulator runs on PORT 9090 (not the default
  8080) and Auth on 9099. Point the rules-test harness at 9090/9099.

## Phase 0 — Recon & falsification gate (REQUIRED before any rule edit)
1. Read the `kioskCanRead` rule and every rule/collection that references it.
   Identify exactly which collections a kiosk token can currently read and how
   the rule authorizes them (what claim/field it checks).
2. DETERMINE WHAT THE KIOSK TOKEN CARRIES. Read how kiosk tokens/claims are
   minted (Auth custom claims and/or the kiosk user doc). Establish precisely:
   does the kiosk credential carry a BRANCH identifier (in the claim or a
   readable field the rule can reference), or only a tenant identifier?
   - If NO branch identifier is available to the rule (claim or referenceable
     doc field), STOP AND SURFACE. The fix is then a data-model change (adding
     branch to the kiosk claim/doc), which is a design decision above this brief
     — do not invent a branch source. Report options and hold.
3. PROVE THE HOLE in the emulator with a rules-unit test (do NOT test against
   production): seed two branches (Branch A, Branch B) under one tenant, mint a
   kiosk credential scoped to Branch A, and assert it can currently READ Branch
   B's users / submissions / leaderboard / Agent-of-Month docs. If the read is
   already denied, the finding is a FALSE POSITIVE — STOP, document as not-a-bug
   with the test as evidence (mirror the run's falsification discipline on
   A11Y-002/003), and hold.
4. Report the Phase 0 verdict (real + branch-key-available / real-but-needs-
   data-model / false-positive) BEFORE editing any rule.

## Build (ONLY if Phase 0 confirms real AND a branch key is available to the rule)
5. Scope `kioskCanRead` to the kiosk's own branch: read must be allowed only
   when the target doc's branch matches the kiosk credential's branch, in
   addition to the existing tenant check. Change ONLY what is needed to close
   the cross-branch read — do not broaden or restructure unrelated rules.
6. DO NOT OVER-SCOPE. A kiosk legitimately displays its own branch's leaderboard
   / Agent-of-Month / submissions. The fix must keep SAME-branch kiosk reads
   working. Both the deny (cross-branch) and the allow (same-branch) are
   requirements.

## Verify (emulator rules-unit tests — the proof this PR ships on)
7. Extend the Phase-0 test into a committed rules-unit test that asserts, after
   the fix:
   - Branch-A kiosk is DENIED reading Branch B's users, submissions, leaderboard,
     and Agent-of-Month docs (hole closed).
   - Branch-A kiosk is STILL ALLOWED reading its OWN branch's equivalents
     (no legitimate-use regression).
   - The existing tenant-isolation guarantee is unchanged (a kiosk from another
     tenant still denied entirely).
8. Run the full rules-test suite green against the emulator on port 9090.

## Phase 4 — Docs
9. Mark SEC-012 RESOLVED in docs/audits/agencytrack-audit-2026-07-05-delta.md
   with the fix summary and a pointer to the rules-unit test. Update CONTEXT.md
   + FOLLOW_UPS.md (size-capped) noting the fix is HELD pending human deploy.

## Phase 5 — Commit / push / PR — THEN STOP
10. Single branch, one PR. git fetch origin before branching off main.
    Branch: fix/sec012-kiosk-branch-scope
    Commit: "fix: branch-scope kioskCanRead to prevent cross-branch reads (SEC-012)"
    Push, open PR. In the PR body: state it is a RULES change requiring human
    merge + `firebase deploy --only firestore:rules`, paste the before/after
    rules-unit test results (deny + allow), and request Gemini on-demand review.
    Poll CodeRabbit + Gemini, disposition all comments in a table.
11. HOLD. Do NOT merge. Do NOT deploy. Report PR-ready with the disposition
    table and the deploy command Kyron will run.

## Scope guard
kioskCanRead branch-scoping only. Do NOT touch other rules, the functions-side
weekOfYear gate, or any other audit finding. If Phase 0 reveals the branch key
must be added to the kiosk claim (data-model change), HOLD and surface rather
than implementing it. Strike count 0/2.
