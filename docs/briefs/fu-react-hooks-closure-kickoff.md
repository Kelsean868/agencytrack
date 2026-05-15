# FU Closure Kickoff — react-hooks ×3 (AgentAwardsPanel `now` memo + GoalsPanel stale)

**Type:** Mixed code + docs closure PR (XS)
**Shape:** HIGH#6 / PR #160 closure pattern
**Strike count opens at:** 0/2
**Smoke:** Waived (lint-only behavior change; no user-visible surface affected)

---

## Audit findings (from batched 4-FU audit, 2026-05-15)

Three items, two require code change in one file, one is direct docs closure:

- **Item 1:** `src/components/awards/AgentAwardsPanel.jsx:155` — `const now = currentDate ?? new Date();` is at component scope. When `currentDate` is undefined, `now` becomes a fresh `Date` object every render, defeating the `useMemo` at lines 157–168 (which has `now` in its deps array). No functional bug, but a memoization perf regression.
- **Item 2:** `src/components/awards/AgentAwardsPanel.jsx:168` — `// eslint-disable-line react-hooks/exhaustive-deps` on the computation `useMemo` deps array. After item 1's fix, the lint suppression may become unused. Phase 1 lint run will confirm.
- **Item 3 (STALE — direct closure):** `src/components/manager/GoalsPanel.jsx:361` — FU says `useEffect missing onGoalsLoaded dep`. CC's audit confirmed `onGoalsLoaded` does not exist anywhere in `src/` (zero grep matches). `GoalsPanel` is zero-props today (`export default function GoalsPanel()`). The lint warning was resolved in a prior refactor; the FU is stale. No code change required.

## Phase 0 — Gate

1. Confirm on `main`, working tree clean. `git fetch origin && git pull origin main`.
2. Create fresh branch off freshly-fetched main: `chore/close-fu-react-hooks-3x`
3. Confirm CLAUDE.md Phase 0 gate checks pass (no uncommitted work, no stale worktree).

## Phase 1 — Locate sources & baseline lint

1. Read `docs/FOLLOW_UPS.md` and locate the "react-hooks/exhaustive-deps × 3 (deferred from PR3)" FU entry verbatim. Confirm priority and item list.
2. Read `src/components/awards/AgentAwardsPanel.jsx` lines 150–180 to confirm current state matches audit characterization.
3. Read `src/components/manager/GoalsPanel.jsx` (full file) and grep entire `src/` for `onGoalsLoaded` to confirm zero matches (item 3 stale-closure prerequisite).
4. Run `npm run lint` and capture current react-hooks warnings on `AgentAwardsPanel.jsx`. Note exact line numbers and rule names. This baseline determines whether the `:168` eslint-disable is specifically suppressing item 1's warning, or something else.

## Phase 2 — Code change (Items 1+2)

1. **Item 1 fix:** Replace `AgentAwardsPanel.jsx:155` line:
   ```js
   const now = currentDate ?? new Date();
   ```
   with:
   ```js
   const now = useMemo(() => currentDate ?? new Date(), [currentDate]);
   ```
2. Confirm `useMemo` is already imported from React at the top of the file. If not, add to the existing React import.
3. **Item 2 fix (conditional):** Re-run `npm run lint`. If no warnings remain on the computation `useMemo` deps array, remove the `// eslint-disable-line react-hooks/exhaustive-deps` directive at `:168`. If lint still flags warnings on that line, leave the directive in place and document the reason in the PR body.

## Phase 3 — Verification

1. `npm run lint` — confirm 0 errors and reduced warning count vs Phase 1 baseline.
2. `npm run build` — confirm clean build.
3. `npm test src/components/awards/__tests__/AgentAwardsPanel*` (if such tests exist) — confirm no regressions.
4. Confirm `git status` shows only `src/components/awards/AgentAwardsPanel.jsx`, `docs/FOLLOW_UPS.md`, and `docs/CONTEXT.md` modified.

## Phase 4 — Docs (FOLLOW_UPS.md + CONTEXT.md)

1. Locate the "react-hooks/exhaustive-deps × 3 (deferred from PR3)" FU entry in `FOLLOW_UPS.md`.
2. Mark all three items as RESOLVED with closure notes:
   - **Item 1 (AgentAwardsPanel.jsx:155):** RESOLVED — wrapped `now` in `useMemo([currentDate])` to stabilize the memo key. The computation `useMemo` now correctly skips recomputation when `currentDate` is stable.
   - **Item 2 (AgentAwardsPanel.jsx:168):** `[RESOLVED — eslint-disable removed; lint no longer flags the deps array after item 1 fix.]` OR `[DEFERRED — eslint-disable retained; lint still flags non-react-hooks suppression at this line. Refile as separate FU if needed.]` (Pick based on Phase 2 outcome.)
   - **Item 3 (GoalsPanel.jsx:361):** STALE — direct closure. `onGoalsLoaded` does not exist anywhere in `src/` (verified via grep on 2026-05-15). `GoalsPanel` is zero-props; the dependency was removed in a prior refactor. No code change required.
3. Add a recently-shipped placeholder row in `docs/CONTEXT.md` matching the Rule 4 placeholder pattern (SHA + PR# placeholders for post-merge fill).

## Phase 5 — Commit, push, PR

1. `git add src/components/awards/AgentAwardsPanel.jsx docs/FOLLOW_UPS.md docs/CONTEXT.md`
2. `git commit -m "chore: close react-hooks/exhaustive-deps × 3 FU (item 1 fix + items 2/3 direct closure)"`
3. `git push -u origin chore/close-fu-react-hooks-3x`
4. Open PR with body containing:
   - Reference to batched 4-FU audit dispatch (2026-05-15)
   - Per-item summary: item 1 code fix, item 2 conditional eslint-disable handling, item 3 stale-direct-closure
   - **Smoke waiver justification:** "Memoization stability change — output value identical, only memo cache hit-rate affected. No user-visible behavior path touched. Lint + build verified; baseline warning count reduced."
5. Stop after PR is open. Wait for Kelsean to merge.

---

## Acceptance criteria

- `AgentAwardsPanel.jsx:155` wraps `now` in `useMemo([currentDate])`
- Item 2 eslint-disable handling decision documented in PR body (removed if lint allows, retained with reason if not)
- All three react-hooks items marked RESOLVED in `FOLLOW_UPS.md` with accurate closure notes
- Recently-shipped placeholder row added in `CONTEXT.md`
- Lint passes with reduced warning count vs baseline
- Build clean
- Smoke waiver justified inline

## Out of scope

- Any other react-hooks lint cleanup beyond these three items
- Any change to `GoalsPanel.jsx` (item 3 is docs-only direct closure)
- Mobile FU#2 residual aria-label priority downgrade (MEDIUM→LOW) — deferred to a separate docs cleanup pass
- Any CLAUDE.md methodology edits (queued for the deliberate edit session, currently 5 items)

## Standing rule reminders

- Single-branch PR rule applies (fresh branch off freshly-fetched main, never reuse)
- Phase 0 gate fires as usual
- Smoke waiver allowed for non-user-visible changes per banked May 14 rule; justification required inline
- Post-merge sequence (Rule 4) runs automatically after Kelsean merges
