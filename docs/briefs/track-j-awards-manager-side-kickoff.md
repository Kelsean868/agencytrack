# Track J — Agent Awards v2: Manager Awards carve-out (pure restyle)

**Sized:** S–M
**Branch:** `redesign/awards-manager-side` (off main)
**Type:** Client-only UI. **Pure visual restyle** continuing the shipped #391 pattern onto the Manager Awards subsection. Audit-classified TRUE-RESTYLE. **No backend, no deploy.** **Human-merge + dispatcher pre-review.**

## Outcome

`ManagerAwardsPanel.jsx` and `BmAtRiskPanel.jsx` adopt the same v2 treatment #391 already shipped for `AgentAwardsPanel` — hero award card with donut, grouped award cards, criteria drawer — with zero change to the awards computation or data path. This completes the Agent Awards v2 mockup (the agent side shipped in #391).

## Decisions baked in (do not re-litigate)

- **VISUAL ONLY.** The `awardsEngine` computation (already shipped), the manager-awards data path, and the existing panel schemas are preserved untouched. If the restyle appears to need a computation/data change, **STOP and surface**.
- **Continue the #391 pattern** — `HeroAwardCard` donut + grouped cards + criteria drawer, applied to the manager panels. Do not invent a new aesthetic; mirror #391.
- **Arc colors → Nexus tokens** per #391 precedent: qualified/contention/locked map to Nexus gold/teal tokens. **No raw hex** (the audit flagged the mockup's `#f59e0b` / `#4ab5b8` / `#a89a85` — these map to existing tokens, exactly as #391 handled them).
- **Visual source** = the Manager Awards subsection of the Agent Awards v2 mockup in `design_handoff_v2_app/mockups/` (locate in Phase 1).

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-awards-manager-side-kickoff.md`; branch `redesign/awards-manager-side` off main; commit as commit 1.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read the frontend SKILL (or repo Nexus conventions).
2. Read #391's `AgentAwardsPanel.jsx` to lift the exact shipped pattern (HeroAwardCard, grouped cards, criteria drawer, the token mapping for the arc colors).
3. Locate the Manager Awards subsection in the v2 mockup; map it onto `ManagerAwardsPanel.jsx` + `BmAtRiskPanel.jsx`.
4. Pin the preserve-list: `awardsEngine` computation + the manager-awards data path + the panel schemas — leave untouched.
5. Confirm the `#f59e0b`/`#4ab5b8`/`#a89a85` → Nexus token mapping #391 established (so hex-grep stays clean).
6. Drift / any restyle that can't avoid touching computation/data → STOP.

## Phase 2 — build

- Apply the #391 visual pattern to `ManagerAwardsPanel.jsx` + `BmAtRiskPanel.jsx`. Presentational diff only; computation/data untouched. Nexus tokens, no raw hex, 44px targets, dark mode.

## Phase 3 — gates

- **3a hex-grep** empty (the arc colors must resolve to tokens, per #391).
- **3b scope (terminal):** the two panels + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no `awardsEngine` change, no unrelated `src/`.
- **3c lint / test / build** green.
- **3d axe baseline-delta** both themes; NO-NEW serious/critical; 44px targets.
- **3e REGRESSION + component tests:** the manager panels render the same awards data, restyled; the criteria drawer opens; computation untouched (snapshot/values unchanged).
- **3f LIVE smoke (both themes):** manager (A11Y_UNIT_MANAGER_ or A11Y_BRANCH_MANAGER_) → open the awards panel → assert the restyled hero + grouped cards + criteria drawer render (empty-state acceptable if the test tenant has no manager-award data — verifies the restyle renders); 0 errors. Credentials boolean-presence only (Rule 4). Preview; prod in Phase 6.

## Phase 4 — docs + FUs

- CONTEXT.md row; resolve the Agent Awards manager-side carve-out in the Track J ledger.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gates + the manager smoke. STOP. I pre-review that the diff is presentational only and mirrors #391 (no new aesthetic), and that the token mapping keeps hex-grep clean.

## Phase 6 — post-merge (no deploy)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke verbatim. Frontend-only.

## Acceptance criteria

- `ManagerAwardsPanel` + `BmAtRiskPanel` adopt the #391 v2 treatment; `awardsEngine`/data/schemas preserved (regression-tested); manager smoke renders the restyled panels both themes; no raw hex; gates green.

## Out of scope

Any `awardsEngine`/computation change. Other Wave B screens. The agent-side awards panel (already shipped #391).

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
