# FU Closure Kickoff — `(unitId, weekStarting)` Composite Index Production Deploy State

**Type:** Docs-only resolution PR
**Shape:** HIGH#6 / PR #160 closure pattern
**Strike count opens at:** 0/2
**Smoke:** Waived (waiver justified inline; pure docs change)

---

## Audit findings (from prior audit dispatch, 2026-05-15)

- **Outcome (a):** Index deployed in production and matches `firestore.indexes.json` exactly.
- **Production verification:** Kelsean confirmed via Firebase Console → Firestore Database → Indexes → Composite tab. `submissions: unitId ASC + weekStarting ASC`. Index ID `CICAgJj7z4EK`. Status: **Enabled**. Verified 2026-05-15.
- **FU text inaccuracy surfaced:** original body claimed both `getWeeklySubmissions` and `getAllYTDSubmissions` "use unitId + range on weekStarting for the UM path." Only `getAllYTDSubmissions` uses a range filter. `getWeeklySubmissions` uses equality on both fields.

---

## Phase 0 — Gate

1. Confirm on `main`, working tree clean. `git fetch origin`.
2. Create fresh branch off freshly-fetched main: `chore/close-fu-unitid-weekstarting-index-audit`
3. Confirm CLAUDE.md Phase 0 gate checks pass (no uncommitted work, no stale worktree).

## Phase 1 — Locate sources to edit

1. `docs/FOLLOW_UPS.md`: locate the entry "(unitId, weekStarting) composite index — production deploy status unverified (MEDIUM, banked from HIGH#6 closure audit, 2026-05-15)" — audit identified lines 568–598. Re-verify exact lines before editing.
2. `docs/CONTEXT.md`: locate references on (a) "Next track" row (audit identified line 18), (b) "Where we left off" deferred list (audit identified line 164). Re-verify exact lines.
3. Locate the RESOLVED section of `FOLLOW_UPS.md` and the most recent RESOLVED entry (PR #160 / HIGH#6) to mirror its formatting style.

## Phase 2 — `FOLLOW_UPS.md`: move entry to RESOLVED with closure note

1. Cut the FU entry from its current Active position.
2. Paste under the RESOLVED section, formatted to match the HIGH#6 RESOLVED entry style.
3. Append closure note:

   ```
   RESOLVED 2026-05-15 (docs-only, no source-change PR required):
   - Outcome: (a) — index deployed and matches repo entry.
   - Production verification: Firebase Console → Firestore Database → Indexes → Composite.
     Index on submissions: unitId ASC + weekStarting ASC. Index ID CICAgJj7z4EK.
     Status: Enabled. Verified by Kelsean via Console on 2026-05-15.
   - Audit note (FU text correction): original FU body was imprecise. It claimed both
     getWeeklySubmissions and getAllYTDSubmissions "use unitId + range on weekStarting
     for the UM path." Correction: only getAllYTDSubmissions uses a range filter on
     weekStarting. getWeeklySubmissions uses equality on both unitId and weekStarting,
     which Firestore serves via single-field auto-indexes without requiring this
     composite. The composite would serve getWeeklySubmissions but its absence would
     not produce a failed-precondition error.
   ```

## Phase 3 — `CONTEXT.md` edits

1. Remove the "(unitId, weekStarting) index deploy-state audit (MEDIUM, banked 2026-05-15)" reference from the "Next track" row.
2. Remove the same reference from the "Where we left off" deferred list.
3. Add a recently-shipped placeholder row for this PR, matching the standard placeholder pattern (SHA + PR# placeholders for post-merge fill per Rule 4).

## Phase 4 — Verification

1. `npm run lint` — no code touched, expect trivial pass. Capture output.
2. Confirm no other files were modified beyond `docs/FOLLOW_UPS.md` and `docs/CONTEXT.md` (`git status`).
3. No tests to run (no code changes).

## Phase 5 — Commit, push, PR

1. `git add docs/FOLLOW_UPS.md docs/CONTEXT.md`
2. `git commit -m "chore: close (unitId, weekStarting) index deploy-state FU (Outcome a — deployed)"`
3. `git push -u origin chore/close-fu-unitid-weekstarting-index-audit`
4. Open PR with body containing:
   - Reference to audit dispatch from 2026-05-15 and Outcome (a)
   - Verification record: Firebase Console, index ID `CICAgJj7z4EK`, status Enabled, verified by Kelsean 2026-05-15
   - Note that FU text correction is included in the RESOLVED entry
   - **Smoke waiver justification:** "Pure docs change to `docs/FOLLOW_UPS.md` and `docs/CONTEXT.md` only. No source code, configuration, rules, or indexes files touched. No user-visible surface affected. Production state verified independently via Firebase Console (see closure note)."
5. Stop after PR is open. Wait for Kelsean to merge.

---

## Acceptance criteria

- FU entry moved from Active to RESOLVED in `FOLLOW_UPS.md` with full closure note (outcome, verification, text correction)
- Both `CONTEXT.md` references removed; recently-shipped placeholder row added
- Smoke waiver justified inline in PR body
- No files touched beyond the two docs files

## Out of scope

- Any change to `firestore.indexes.json` (source is correct as-is)
- Any change to `managerService.js` (the FU text correction is docs-only; no code is wrong)
- Any CLAUDE.md edit banking the methodology candidate (`firestore.indexes.json` deploy-confirmation rule) — queued for a future deliberate CLAUDE.md edit session alongside two other pending methodology items (env-credentials propagation audit, inventory-prose-instability)
- Any production deploy

## Standing rule reminders

- Single-branch PR rule applies (fresh branch off freshly-fetched main, never reuse)
- Phase 0 gate fires as usual
- Smoke waiver allowed for pure docs changes per banked May 14 rule; justification required inline
- Post-merge sequence (Rule 4: CC syncs main, captures squash SHA, fills `CONTEXT.md` + `FOLLOW_UPS.md` placeholders, commits+pushes direct to main) runs automatically after Kelsean merges
