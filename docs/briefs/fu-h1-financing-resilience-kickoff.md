# FU-H1 — financing/settlements resilience hardening — kickoff brief (re-baselined)

**Authored:** post-#754 · dispatcher (re-baselined from the original post-#749 draft).
**Baseline:** origin/main `ffcb129` (K5 fill) — **Phase 0 re-verifies exact HEAD.**
**run_model:** `claude-sonnet-4-6` (mechanical — mirror an existing guard + add tests). *(For a fully-unattended run alongside K6 without a mid-run model switch, may run on Opus.)*
**Mode:** Autonomous, ONE PR, build straight through to PR-open, then **HOLD**. **Unattended-eligible.** **File-disjoint from K6** (K6 = reconciliation/garnish/clocks; this = SettlementPanel + tests + basisBadge).
**Merge class:** **Human-merge (Rule 19)** — touches the shipped, money-adjacent `SettlementPanel`. No rules, no deploy.

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — banked-FU hardening (resilience guard parity + the missing race-test coverage) |
| **Shape** | `SettlementPanel.jsx` latest-request guard + nullish guard · race tests across the financing panels · `FinancingBasisBadge.jsx` DEV-warn · docs |
| **Size** | S |
| **Branch** | `fu/h1-financing-resilience` |
| **Sources** | `docs/FOLLOW_UPS.md` (the banked items below) · `FinancingTermsSetup.jsx` / `MonthlyStatementEntry.jsx` / `FinancingProrationPanel.jsx` (the shipped guard pattern to mirror — K1/K2/K5) |
| **Smoke walk** | The existing settlements smoke is the morning regression gate; the new **race unit tests** are the substantive verification. No new collection/rules. |
| **Strike count** | 0/2 |

---

## Context

K1/K2/K5 added a `useRef` latest-request guard to `FinancingTermsSetup`, `MonthlyStatementEntry`, and `FinancingProrationPanel` to stop a stale async resolution overwriting the wrong agent's data (a money-write hazard). `SettlementPanel` — the original these were modeled on — still carries the **same latent race** in shipped code, and none of the four guards has a dedicated test. This PR brings `SettlementPanel` to parity, adds the missing race tests, and lands the GLM-flagged badge DEV-warn. No money math, no new surface.

---

## Architectural decisions (locked at brief authoring)

1. **SettlementPanel guard parity.** Apply the **identical** `useRef` latest-request guard used in the three financing panels to `SettlementPanel`'s agent-data load path (compare the resolved agentId to the latest requested; drop the result — resolution, error, and finally arms — if stale). Mirror exactly; invent nothing new.
2. **Nullish guard.** Add the defensive `getTenantUsers` nullish fallback (`?? []` / array-guard) on `SettlementPanel`'s user-list load, matching the financing panels.
3. **Race tests.** Add a focused latest-request-race test to each panel that carries the guard — **`SettlementPanel`, `FinancingTermsSetup`, `MonthlyStatementEntry`, `FinancingProrationPanel`** (simulate a slow first + fast second request; assert the stale resolution does not overwrite the displayed agent). RTL with mocked services; mirror existing component-test conventions.
4. **`FinancingBasisBadge` DEV-warn.** On an unexpected `basisSource` key, `console.warn` **in dev only** (`import.meta.env.DEV`), then fall back to the existing `'submitted-final'` default. No production behavior change (GLM nit).

## Out of scope

- The `FinancingTab` single-dropdown lift (separate banked FU — modifies shipped UI, needs a re-smoke; attended)
- Any money math, the K6 reconciliation work, any new collection/rules/proration
- Extracting the guard into a shared hook (in-place mirror only; the shared-hook extraction is a later FU)

## Phase 0 — gate

Standard. Fresh branch `fu/h1-financing-resilience` off synced `origin/main` (`ffcb129`). **Re-verify branch at each phase gate** (worktree-switch lesson). Clean tree. STOP on divergence.

## Phase 1 — source-verify (verify-and-continue)

1. `git ls-files` the four panels + `FinancingBasisBadge.jsx` → tracked.
2. Read the shipped guard in `FinancingTermsSetup`/`MonthlyStatementEntry`/`FinancingProrationPanel` — quote the exact `useRef` pattern to mirror.
3. Read `SettlementPanel`'s agent-load + user-list paths — confirm insertion points; confirm it's not already guarded.
4. Confirm the repo's RTL/component-test convention (an existing component test to mirror) for Decision 3.
5. Confirm `FinancingBasisBadge`'s current fallback + that `import.meta.env.DEV` is the repo's dev-guard idiom.

If clean, CONTINUE to Phase 2. Hard-stop only on a surprise (e.g. SettlementPanel already structurally diverged from the mirror).

## Phase 2 — build

Decisions 1–4. Keep the guards textually identical across panels so they read as one pattern.

## Phase 3 — verification

- Lint 0 · build green · full suite green (incl. the new race tests).
- Hex-grep changed files → clean. axe on `SettlementPanel` (no new serious/critical, both themes — shipped surface, confirm no regression).

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD`).
- `docs/FOLLOW_UPS.md` — **resolve** the SettlementPanel-guard-parity FU + the GLM basisBadge DEV-warn FU; **carry** the FinancingTab single-dropdown lift and the shared-hook extraction.

## Phase 5 — commit / push / PR

Conventional commits on `fu/h1-financing-resilience`. Green gates. PR via `gh`: title `fix(fu-h1): SettlementPanel latest-request guard parity + race tests + basisBadge dev-warn`. **Rule 15** paste-back. **Rule 20** — HEAD SHA. Do NOT merge. Surface PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (post-merge)

Human-merge (shipped money-adjacent surface). No deploy. `/post-merge <pr#>` (Sonnet). **Rule 21** poll; **Rule 22** name ≥1 gap.

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Phase 1 surprise (SettlementPanel structurally diverged) → **STOP and wait for dispatcher**
- Phase 2 scope expansion beyond the 4 decisions, any file outside the panels/badge/test surface, or any touch to K6's branch files → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite/axe failure after one fix attempt → **STOP and wait for dispatcher**
- A wrong-worktree/wrong-branch detection at any phase gate → **STOP IMMEDIATELY**
