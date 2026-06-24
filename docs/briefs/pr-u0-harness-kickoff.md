# Kickoff Brief — PR-U0 · Game Plan Unification Verification Harness

**Authored:** 2026-06-24 · dispatcher
**Baseline:** origin/main post-#739 (`b1f2d41` + `7d4d7ee`) — Phase 0 re-verifies the exact HEAD.
**run_model:** `claude-sonnet-4-6` (mechanical seed + smoke; no judgment-dense math).
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — touches smoke-tenant seed tooling.
**Run:** Run 1, paired with PR-U1 on a separate file-disjoint branch off main. `/clear` at the boundary.
**Parent PRD:** `docs/design/gameplan-unification-prd.md` (Direction 1).

---

## Why

The merged Money Needs + Allocator surface (#739) ships behind `VITE_MONEY_NEEDS_MERGED_ENABLED` (OFF in prod). Its flag-ON live drive-through (gap #1) was **never run** — the smoke agent had no PAYE / money-needs figure, so Send stayed disabled and commission-entry was RTL-only. This PR builds the harness so the operator's Step-zero flag flip (preview → prod default-ON) is verifiable, not an eyeball. It verifies the **current** `.allocation` surface — the sound foundation PR-U1 then restructures.

---

## Scope (DO)

1. **Seed the smoke tenant** with a complete money-needs / PAYE figure for the existing smoke agent, so the allocator's required-commission seed is non-zero and Send is enabled. Extend the existing smoke-seed script; do not author a parallel one.
2. **Flag-ON write-read-verify smoke** (`smoke-mn-allocator-flagon.mjs`, location per the repo's smoke convention — Phase 0 confirms): with the flag ON, write an allocation through the surface's persistence path → reload via `getMoneyNeeds` → **assert `.allocation` persisted** (real write-read-verify cycle, not a selector check) → drive **Send** → assert the Playground key payload + `onOpenTab('game-plan')`.
3. Viewport-aware login + skip-not-fail on preview data gaps (per the banked smoke standards).

## Out of scope (DO NOT)

- No change to `MoneyNeedsAllocator.jsx`, `moneyNeedsService.js`, or any writer. This PR is seed + smoke only.
- No flag flip (operator action). No rules/CF/index changes.
- This smoke targets the **current `.allocation`** flow and is **superseded by PR-U1's** `smoke-yearplan-unified.mjs`; it is removed in PR-U2 cleanup. Do not try to make it future-proof against the unification.

---

## Phase 0 — falsification + source-verify (Rule 17/23; STOP on mismatch)

- Confirm HEAD; grep-confirm `VITE_MONEY_NEEDS_MERGED_ENABLED` and `saveAllocation` exist (else baseline wrong → **STOP and wait for dispatcher**).
- Confirm the smoke harness directory + runner pattern and the existing smoke-seed script name (`git ls-files` for the seed + smoke paths). Do not invent a new harness location.
- Confirm `getMoneyNeeds` returns `allocation` (normalizeWorksheet spread) so the read-back assertion is valid.
- State the one piece of evidence that would overturn the "seed enables Send" assumption (e.g., Send gated on a field the seed doesn't set) before building.

## Phases 1–3 — build + self-verify

- Seed extension; smoke file; run the smoke flag-ON locally (set the env var for the run) in both themes. Lint 0; build clean; no new hex.

## Phase 4 — docs (placeholders until merge)

- `CONTEXT.md`: Recently-shipped row placeholder; note the smoke is a step-zero harness, superseded by U1.
- `FOLLOW_UPS.md`: none new expected.

## Phase 5 — commit / push / PR

- Single branch off fresh main. Commit, push, open PR. **Rule 15:** `git fetch origin && git log origin/main --oneline -1`, SHA-match, verbatim "pushed and verified". **Rule 20:** name the feature-branch HEAD SHA; no silent post-report pushes.

## Phase 6 — hold

- **Rule 21:** poll Gemini/GLM 15 min; disposition all comments. **Rule 22:** enumerate ≥1 known gap. Then **STOP and wait for dispatcher** — do not merge, do not run Phase 6 post-merge until merge is confirmed.

---

## Operator note (post-merge, Step zero)

After merge: set `VITE_MONEY_NEEDS_MERGED_ENABLED=true` on a **Vercel preview** → redeploy → run this smoke against the seeded tenant → eyeball L/D → flip **prod** default-ON → verify. Only then merge PR-U1.
