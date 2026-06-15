# Producing-manager Phase 3 — UM mandatory-filing (compliance scope) + retroactive-cutoff guard

**Sized:** S–M
**Branch:** `feat/producing-mgr-phase3-um-compliance` (off freshly-fetched main)
**Type:** Frontend compliance-scope change + one cutoff constant. **NO rules / CF / index / deploy.**
**Channel:** **BUILD-AND-HOLD + dispatcher pre-review + human squash-merge.** Single slice, and the cutoff logic is correctness-sensitive (historical compliance % must not regress), so I review the cutoff + smoke assertions before merge. The wider auto-merge envelope applies to the multi-PR runs, not this one.

## Why

2.1a/2.1b made managers producers who file the weekly wizard. UMs are now **mandatory** filers (like agents); BMs stay **optional** (2.1b). This folds UMs into the compliance **denominator** so a UM who doesn't file counts against branch compliance — **with a cutoff guard** so weeks before the arc (when UMs weren't expected to file) don't retroactively drop the historical %.

## Locked decisions (dispatcher)

- `UM_MANDATORY_FILING_CUTOFF = '2026-06-14'` — a named constant (this week's Sunday). UMs are in the compliance denominator **only** for weeks where `weekStarting >= cutoff`. Operator-adjustable; documented so it's reset to the real pilot go-live Sunday if that differs. *(Confirm the date — see dispatch note.)*
- **Filing lens only.** UMs must FILE the weekly wizard. The plan-adoption lens (UMs committing a weekly plan) is OUT of scope — banked as a decision for the manager-cockpit arc.
- BMs stay **optional** (never in the denominator). Agents unchanged (always mandatory).

## Phase 1 — source-verify · **HARD-STOP, report back, await authorization**

Pair grep with `git ls-files`. Report, then wait.

1. `useBranchOverview` — quote the `complianceScopeIds` definition (agents-only post-2.1a) and how `kpiData.compliance` consumes it.
2. `CompliancePanel.jsx` (~L114 per the arc map — confirm) — where the filing **roster**, the "Haven't filed" **exception list**, and the **reality bar** derive their *expected set* (the denominator) from `getWeeklySubmissions` + `getTenantUsers`. Quote.
3. `complianceDerive.js` — `classifyWeek` / `onTimeStreak`: how the streak iterates weeks (so the cutoff can gate where a UM's streak starts).
4. Confirm compliance is N×fetch from existing collections — **no new index** is required to include UMs in the roster (the roster filter is client-side over already-fetched `getTenantUsers`). Flag if any query/index is implicated.
5. The week comparison: confirm `weekStarting` is the 'YYYY-MM-DD' Sunday string and that a `>=` cutoff compare is consistent with the `parseDateOnlyTT` convention used for deadlines (lexicographic `>=` on ISO dates is safe; confirm the format matches).
6. Tests touching compliance scope/roster — enumerate (`CompliancePanel.lens.test.jsx`, `complianceDerive` tests, `useBranchOverview` compliance tests).

## Phase 2 — build (after authorization)

1. Add `UM_MANDATORY_FILING_CUTOFF` as a named constant alongside the other compliance constants.
2. `useBranchOverview` `complianceScopeIds` — for the selected week, include UMs **iff** `weekStarting >= cutoff` (agents always; BMs never).
3. `CompliancePanel.jsx` — the roster / exception / reality-bar *expected set*: the same cutoff-aware UM inclusion for the selected week (a single shared scope filter so the % and the panel can't drift).
4. `complianceDerive.js` streak — a UM's on-time streak only counts weeks `>= cutoff` (no pre-cutoff "miss").

## Phase 3 — tests

- **Pre-cutoff week:** UMs NOT in the denominator — assert a known compliance % is *unchanged* whether or not a UM filed (historical preserved).
- **Post-cutoff week:** a non-filing UM IS counted (drops the %) and appears in the "Haven't filed" list; a filing UM counts as filed.
- **Boundary:** the cutoff Sunday itself includes UMs (`>=` inclusive).
- **Streak:** a UM's on-time streak starts at the cutoff (no pre-cutoff miss).
- Full suite green; lint 0; build clean; hex-grep clean.

## Phase 4 — docs (with placeholders)

- `CONTEXT.md` ledger; mark Phase 3 done → **producing-manager arc COMPLETE**.
- `FOLLOW_UPS.md`: bank the deferred plan-lens-UM question (do UMs commit weekly plans?) tied to the manager-cockpit arc.

## Phase 5 — PR + smoke

- BUILD-AND-HOLD; human squash-merge; report feature-branch HEAD SHA (Rule 20); Gemini disposition (Rule 21).
- **Smoke (frontend, pre-merge against the Vercel preview, both themes — no rules/CF so preview is valid):** open the BM (or SM) compliance panel and assert (a) for a **pre-cutoff** week the % and roster **exclude** UMs (historical preserved), (b) for a **post-cutoff** week a non-filing smoke-UM appears in "Haven't filed" and the % reflects it, (c) the boundary week includes UMs. No production writes needed beyond the existing smoke roster.
- Rule 16 post-merge fill.

## Risk notes

- Correctness-sensitive: the entire point is **not** regressing historical %. The pre-cutoff smoke assertion is the gate.
- Frontend-only — no rules/CF/index/deploy; auto-deploys on merge.
- `>=` on ISO 'YYYY-MM-DD' Sunday strings is lexicographically safe (Phase 1.5 confirms the format matches the deadline convention).
