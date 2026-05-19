# PR brief — Rule 17 brief-completeness sub-bullet (new Firestore collections)

**Sized:** XS (pure docs, CLAUDE.md + CONTEXT.md)
**Branch:** `docs/rule-17-brief-completeness-subbullet`
**Type:** Methodology refinement.

## Outcome

Append a second sub-bullet to Rule 17 in `CLAUDE.md` formalizing brief-completeness expectations when a PR introduces a new Firestore collection. Codifies the lesson from PR #229 (Resend invite server-side + `auditInviteResends`), which required two Rule 9 in-PR extensions during operator smoke because the brief under-specified the verification surface.

## Decisions locked

- Motivating catch: PR #229 (`0fdebc0`). Two Rule 9 extensions during operator smoke: `848c16c` (smoke query tenantId filter — Firestore rule constraint requirement) and `cd2ef7b` (composite index for `auditInviteResends` smoke query — 4-field query: `tenantId + actorUid + targetUid + timestamp DESC`).
- Sub-bullet wording locked verbatim (Phase 2 — CC must not redraft).
- Scope: new Firestore collections specifically. Does NOT generalize to all new architectural units (Cloud Function categories, auth flows, etc.) — future catches can extend.
- Sits as a second sub-bullet under Rule 17, parallel to the existing source-verification sub-bullet banked at `d40fa85` (PR #223).
- Rule 17 main body remains unchanged.

## Out of scope

- Modifying Rule 17 main body or other methodology rules
- Modifying the existing source-verification sub-bullet
- Backfilling prior briefs with the brief-completeness pattern
- Generalizing to non-Firestore architectural units (auth flows, CF categories, etc.) — separate scope if pattern surfaces again
- `FOLLOW_UPS.md` changes (no FU to close)

## Phase 0 — gate

Standard. STOP on divergence.

## Phase 1 — sanity checks (Rule 17 source-verify, including the existing sub-bullet)

1. Confirm Rule 17 exists at expected position in `CLAUDE.md` (last numbered methodology rule). Read its current body + the existing source-verification sub-bullet to identify the insertion point for the new sub-bullet.

2. Identify exact insertion point: AFTER the existing source-verification sub-bullet's `Banked from PR #223...` trailer, BEFORE the next rule heading or `---` separator. Surface the line number.

3. Confirm `CLAUDE.md` does NOT already contain a similar brief-completeness sub-bullet:
Select-String -Path CLAUDE.md -Pattern "Brief-completeness sub-bullet|enumerate the full architectural unit|new Firestore collection"
   Expected: zero matches (the phrase "new Firestore collection" might appear in unrelated prose — surface any matches for dispatcher review before proceeding).

4. Verify PR #229 squash SHA `0fdebc0` and Rule 9 extension SHAs (`848c16c`, `cd2ef7b`) are accurate via:
git log origin/main --oneline | Select-String "0fdebc0|848c16c|cd2ef7b"
   If any SHA mismatches, STOP for dispatcher (premise shifted).

5. Verify the existing Rule 17 source-verification sub-bullet trailer references PR #223 with SHA `d40fa85`:
Select-String -Path CLAUDE.md -Pattern "d40fa85"
   Expected: at least one match. If zero, premise has shifted — STOP for dispatcher.

If any premise shifts: STOP and wait for dispatcher.

## Phase 2 — edits

### Edit 1 — Append new sub-bullet to Rule 17 in `CLAUDE.md`

Insert at the line identified in Phase 1 step 2. Match the formatting of the existing source-verification sub-bullet (heading depth, blank lines, banking-trailer).

Use this exact body (CC must NOT rewrite):

```markdown
**Brief-completeness sub-bullet: enumerate the full architectural unit when introducing a new Firestore collection.**

Briefs that introduce a new Firestore collection must enumerate ALL parts of the architectural unit explicitly in Phase 1 source-verify and Phase 2 edits, not just the obvious surfaces. The full unit includes:

- **Rules block** — read/write permissions, helper functions or inline role checks, tenant scoping if applicable
- **Write surface** — Cloud Function logic (with `Admin SDK` writes bypassing rules) and/or client-side write logic (subject to rules)
- **Read surface** — client-side query shape if any frontend consumes the collection, including filter clauses and orderBy
- **Composite indexes** — required for any query with 2+ `where()` clauses, range filters, or `orderBy` on non-equality fields. Encode as `firestore.indexes.json` additions in Phase 2 alongside the rules block.
- **Smoke verification** — if user-visible behavior depends on the new collection, the smoke's own query is part of the architectural unit. The smoke's index requirements must be in `firestore.indexes.json` even if the production app does not yet query the collection in the same shape.

Common gap: smoke queries on the new collection often have different shape than production app queries. The smoke's index requirements are easy to miss because the brief author is focused on the production app's read surface (if any). The smoke is real verification code that runs against real Firestore — its query needs its index.

Two Rule 9 in-PR extensions on a single PR is a signal the brief under-specified the verification surface and should be banked as a methodology learning. Strikes do NOT accrue for these Rule 9 extensions when the corrections are mechanical (filter clause addition, index addition) and the brief's locked decisions remain intact.

Banked from PR #TBD ({TBD}). Motivating catch: PR #229 (`0fdebc0`, Resend invite server-side + `auditInviteResends`). Brief covered rules, CF write, frontend swap, and smoke, but missed the smoke's composite index (4-field: `tenantId + actorUid + targetUid + timestamp DESC`) and the smoke query's required `tenantId` filter clause for the rules to accept the read. Both surfaced during operator smoke as Rule 9 extensions: `848c16c` (smoke query tenantId filter), `cd2ef7b` (composite index add).
```

### Edit 2 — Update `docs/CONTEXT.md`

1. Drop oldest row in Recently-shipped table.
2. Add new row at top with `#TBD` / `{TBD}` placeholders. Description: "Rule 17 brief-completeness sub-bullet — banks PR #229's two Rule 9 extensions as methodology learning for briefs introducing new Firestore collections (rules + CF + index + smoke query shape as a single architectural unit)."
3. Update `Current main HEAD` field to `{TBD}`.
4. Update `Active track` field to "Rule 17 brief-completeness sub-bullet — docs/rule-17-brief-completeness-subbullet in flight."
5. Update `Next track` field to "Pending: Worktree + branch audit cleanup (7 pre-existing gone branches), BEH-1 (blocked on copy)."
6. Update "Where we left off" prose: 1–2 short paragraphs noting this PR banks the brief-completeness sub-bullet for new Firestore collections, mirroring the bank-and-validate pattern from PR #223 (Rule 17 source-verification sub-bullet). Future briefs touching new collections will inherit the architectural-unit enumeration expectation.

## Phase 3 — verification

1. `npm run lint` → expect clean (no source files touched).
2. Markdown structural check on `CLAUDE.md`: confirm Rule 17 still has its main body + first sub-bullet + new second sub-bullet in correct order. No stray heading levels introduced.
3. Confirm the new sub-bullet sits between the existing first sub-bullet's banking trailer and any rule/separator below:
Select-String -Path CLAUDE.md -Pattern "Brief-completeness sub-bullet" -Context 3,3

## Phase 4 — smoke

**Waived.** Justification: pure docs change to `CLAUDE.md` (methodology rule sub-bullet) + `CONTEXT.md` (state placeholder row). No source code, no Firestore rules, no user-visible surface, no runtime behavior change.

## Phase 5 — commit, push, open PR

1. Fresh branch off Phase 0 SHA: `git checkout -b docs/rule-17-brief-completeness-subbullet` (Rule 1).
2. Stage `CLAUDE.md` + `docs/CONTEXT.md`.
3. Commit message:
docs(methodology): Rule 17 brief-completeness sub-bullet for new Firestore collections
Codifies the lesson from PR #229 (Resend invite server-side +
auditInviteResends, squash 0fdebc0): briefs that introduce a new
Firestore collection must enumerate the full architectural unit upfront,
including:

Rules block
Write surface (CF and/or client)
Read surface (client-side query shape)
Composite indexes for any non-trivial query (including smoke queries)
Smoke verification (smoke's query is part of the architectural unit)

PR #229 missed the smoke's composite index + the smoke query's tenantId
filter, surfacing as two Rule 9 in-PR extensions during operator smoke
(848c16c smoke query tenantId filter; cd2ef7b composite index add).
Strikes did not accrue — corrections were mechanical and brief's locked
decisions remained intact.
Sits as second sub-bullet under Rule 17, parallel to the existing
source-verification sub-bullet banked at d40fa85 (PR #223).
Smoke waived: pure docs change, no runtime surface.

4. Push: `git push -u origin docs/rule-17-brief-completeness-subbullet`.
5. Open PR via `gh pr create` or GitHub UI. Title: `docs(methodology): Rule 17 brief-completeness sub-bullet for new Firestore collections`.
6. Surface PR URL.

## Phase 6 — held

Standard. Per documented dual-surface gap at `cb18914`: if `/post-merge` displays "unrecognized" on CLI, CC still executes — wait for the post-merge summary.
