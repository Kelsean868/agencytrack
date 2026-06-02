# Track J — Daily Capture v2 (chrome-only restyle)

**Sized:** S–M
**Branch:** `redesign/daily-capture-v2` — **stacked off `redesign/wizard-v2`** (not main) for the unsupervised-window sequence, so the `CONTEXT.md` rows don't collide.
**Type:** Client-only UI. **Visual restyle** of the Daily Capture modal + FAB to the v2 mockup. Daily-entry schema, write path, and validation **PRESERVED untouched**. **No backend, no deploy.** **Human-merge + dispatcher pre-review.**

## Outcome

`DailyEntryModal` and `DailyFAB` match the v2 mockup visually, with zero change to the daily-entry schema, the write path, or validation.

## Decisions baked in (do not re-litigate)

- **VISUAL ONLY.** The daily-entry doc schema, the Firestore write path, and validation (`parseFloat` on numerics) are preserved. If the restyle appears to require a schema/logic change, **STOP and surface**.
- **Visual source = the Daily Capture v2 mockup** in `design_handoff_v2_app/mockups/` (locate the exact file in Phase 1). Nexus tokens, no raw hex, 44px touch targets, dark mode.
- Same restyle discipline as the Wizard: presentational diff, logic untouched.

## Phase 0 — pre-flight

1. `git fetch origin`; confirm the branch base is `redesign/wizard-v2` (stacked — this PR sits on top of the Wizard PR so the shared docs rows don't conflict); `git log --oneline -1` of the base verbatim.
2. Move brief → `docs/briefs/track-j-daily-capture-v2-kickoff.md`; branch `redesign/daily-capture-v2` off `redesign/wizard-v2`; commit as commit 1.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read the frontend SKILL (or repo Nexus conventions).
2. Locate the Daily Capture v2 mockup in `design_handoff_v2_app/mockups/` (confirm the filename); source-verify the modal chrome + FAB treatment.
3. Map onto `daily/DailyEntryModal.jsx` + `dashboard/DailyFAB.jsx`.
4. Pin the preserve-list: the daily-entry write service + validation + the doc schema — leave untouched.
5. Drift / any restyle that can't avoid touching schema/write/validation → STOP.

## Phase 2 — build

- Restyle `DailyEntryModal` + `DailyFAB` to the mockup. Preserve schema/write/validation. Presentational diff only. Nexus tokens, no raw hex, 44px targets, dark mode.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (terminal):** the modal + FAB + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no schema/service/validation change, no unrelated `src/`.
- **3c lint / test / build** green.
- **3d axe baseline-delta** both themes; NO-NEW serious/critical; 44px targets.
- **3e REGRESSION tests:** daily entry still writes the correct schema; validation enforced; FAB opens the modal; close/cancel behaves.
- **3f component tests:** the restyled modal + FAB render; the v2 chrome elements present.
- **3g LIVE smoke (both themes) — full write-read-verify:** test agent → tap the FAB → fill the daily entry → submit → reload → assert the daily-entry doc persisted with the correct schema. Both themes. Preview; prod in Phase 6.

## Phase 4 — docs + FUs

- CONTEXT.md row; resolve the Daily Capture v2 pending row in the Track J ledger.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gates + the write-read-verify result. STOP. I pre-review that the diff is presentational only, the regression coverage, and the live write-read-verify.

## Phase 6 — post-merge (no deploy)

After the Wizard merges first and this is rebased onto the updated main: sync, fill, push direct to main, Rule 15 verbatim; prod smoke (write-read-verify, both themes) verbatim. Frontend-only.

## Acceptance criteria

- `DailyEntryModal` + `DailyFAB` match the v2 mockup; daily-entry schema/write/validation preserved (regression-tested); the daily-entry flow live-smoked write-read-verify; both themes; 44px targets; gates green.

## Out of scope

Schema/write/validation changes. Other Wave B screens. Any WAR-wizard change (separate PR).

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
