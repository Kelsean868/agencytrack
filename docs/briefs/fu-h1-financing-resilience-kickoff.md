# FU-H1 — financing/settlements resilience hardening — kickoff brief

**Authored:** post-#749 · dispatcher.
**Baseline:** origin/main `26b6f55` — **Phase 0 re-verifies exact HEAD.**
**run_model:** `claude-sonnet-4-6` (mechanical — mirror an existing guard pattern + add tests). *(For a fully-unattended single-model run alongside K3, may run on Opus to avoid a mid-run model switch — see dispatch note.)*
**Mode:** Autonomous, ONE PR, build straight through to PR-open, then **HOLD**. Unattended-eligible. **File-disjoint from K3** (K3 = new `src/lib` engine; this = `SettlementPanel` + tests + `FinancingBasisBadge`).
**Merge class:** **Human-merge (Rule 19)** — touches the shipped, money-adjacent `SettlementPanel` surface.

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — banked-FU hardening (resilience guard + test coverage) |
| **Shape** | `SettlementPanel.jsx` latest-request guard + nullish guard · race tests on 3 panels · `FinancingBasisBadge.jsx` DEV-warn · docs |
| **Size** | S |
| **Branch** | `fu/h1-financing-resilience` |
| **Sources** | `docs/FOLLOW_UPS.md` (the banked items below) · `src/components/manager/FinancingTermsSetup.jsx` + `MonthlyStatementEntry.jsx` (the guard pattern to mirror, shipped in K1/K2) |
| **Smoke walk** | The existing settlements smoke is the morning regression gate; the new **race unit tests** are the substantive new verification. No new collection/rules. |
| **Strike count** | 0/2 |

---

## Context

K1 (#748) and K2 (#749) added a `useRef` latest-request guard to `FinancingTermsSetup` and `MonthlyStatementEntry` to prevent a stale async resolution from overwriting the wrong agent's data — a money-write hazard. `SettlementPanel` (the mirror these were modeled on) carries the **same latent race** in shipped code and was banked for parity. None of the three guards has a dedicated test. This PR closes the parity gap, adds the race tests, and lands the GLM-flagged badge DEV-warn. No money math, no new surface.

---

## Architectural decisions (locked at brief authoring)

1. **SettlementPanel guard parity.** Apply the **identical** `useRef` latest-request guard used in `FinancingTermsSetup`/`MonthlyStatementEntry` to `SettlementPanel`'s agent-data load path (compare the resolved agentId to the latest requested; drop the result — resolution, error, and finally arms — if stale). Mirror exactly; do not invent a new pattern.
2. **Nullish guard.** Add the defensive `getTenantUsers` nullish fallback (`?? []` / array-guard) on `SettlementPanel`'s user-list load, matching the K2 panel (closes the Gemini-#1 mirror item).
3. **Race tests.** Add a focused latest-request-race test to **all three** panels (`SettlementPanel`, `FinancingTermsSetup`, `MonthlyStatementEntry`): simulate a slow first request + fast second, assert the stale resolution does **not** overwrite the displayed agent. RTL with mocked services; mirror existing component-test conventions in the repo.
4. **`FinancingBasisBadge` DEV-warn.** On an unexpected `basisSource` key, `console.warn` **in dev mode only** (`import.meta.env.DEV`), then fall back to the existing `'submitted-final'` default. No production behavior change (GLM nit 2).

## Out of scope

- The `FinancingTab` single-dropdown lift (separate banked FU — modifies shipped K1 UI, needs a re-smoke; **attended**, not this run)
- Any money math, the K3 engine, any new collection/rules/proration
- Refactoring the guard into a shared hook (in-place mirror only; a shared-hook extraction is a later FU)

## Phase 0 — gate

Standard. Fresh branch `fu/h1-financing-resilience` off synced `origin/main` (`26b6f55`). Clean tree. STOP on divergence.

## Phase 1 — source-verify (verify-and-continue)

1. `git ls-files src/components/manager/SettlementPanel.jsx src/components/manager/FinancingTermsSetup.jsx src/components/manager/MonthlyStatementEntry.jsx src/components/manager/FinancingBasisBadge.jsx` → all tracked.
2. Read the shipped guard in `FinancingTermsSetup`/`MonthlyStatementEntry` — quote the exact `useRef` pattern to mirror.
3. Read `SettlementPanel`'s agent-load + user-list paths — confirm the insertion points; confirm it's not already guarded.
4. Confirm the repo's RTL/component-test convention (an existing component test to mirror) for Decision 3.
5. Confirm `FinancingBasisBadge`'s current fallback + that `import.meta.env.DEV` is the repo's dev-guard idiom.

If clean, CONTINUE to Phase 2. Hard-stop only on a surprise (e.g. SettlementPanel already diverged structurally).

## Phase 2 — build

Decisions 1–4. Keep the three guards textually identical so they read as one pattern.

## Phase 3 — verification

- Lint 0 · build green · full suite green (incl. the 3 new race tests).
- Hex-grep changed files → clean. axe on `SettlementPanel` (no new serious/critical, both themes — it's a shipped surface, confirm no regression).

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD`).
- `docs/FOLLOW_UPS.md` — **resolve** the SettlementPanel-guard-parity FU + the GLM basisBadge DEV-warn FU; **carry** the FinancingTab single-dropdown lift and the shared-hook extraction.

## Phase 5 — commit / push / PR

Conventional commits on `fu/h1-financing-resilience`. Green gates. PR via `gh`: title `fix(fu-h1): SettlementPanel latest-request guard parity + race tests + basisBadge dev-warn`. **Rule 15** paste-back. **Rule 20** — name HEAD SHA. Do NOT merge. Surface PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (post-merge)

Human-merge (shipped money-adjacent surface). No deploy. `/post-merge <pr#>` (Sonnet). **Rule 21** poll; **Rule 22** name ≥1 gap.

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Phase 1 surprise (SettlementPanel structurally diverged from the mirror) → **STOP and wait for dispatcher**
- Phase 2 scope expansion beyond the 4 decisions, or any file outside the SettlementPanel/badge/test surface, or any touch to K3's branch files → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite/axe failure after one fix attempt → **STOP and wait for dispatcher**
