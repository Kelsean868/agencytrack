# K6 AMENDMENT — reconciliation gap-fill (manager-confirmed missing months) — kickoff brief

**Authored:** post-#756 · dispatcher.
**Extends:** the **OPEN** `feat/k6-reconciliation` branch @ `823faaf` (PR #756) in the **K6 worktree** `C:/Projects/agencytrack-k6`. **This is a follow-up commit on the existing branch — do NOT cut a new branch, do NOT open a new PR.** PR #756 updates with the new commits.
**run_model:** `claude-opus-4-8` (money-write — judgment-dense).
**Mode:** Attended. **Phase 1 ends in a hard-stop for dispatcher lock** (gap-fill field-set + UI shape), then build, push to the open branch, then **HOLD**.
**Merge class:** **Human-merge (Rule 19)** — part of K6; money-write. Phase 6 (deploy + seeded write-read-verify) runs over base K6 **plus** this amendment as one PR.

## Header

| Field | Value |
|---|---|
| **Type** | Amendment to PR #756 — reconciliation gap-fill guard (no silent assume-zero) |
| **Shape** | gap-detection on the reconciliation flow + inline manager-confirm UI on `FinancingReconciliationPanel.jsx` + write each confirmed gap via the existing `financingService.setFinancingMonth` + reconcile-gate + tests + docs |
| **Size** | S–M |
| **Branch** | `feat/k6-reconciliation` (EXISTING — @ `823faaf`) |
| **Sources** | `docs/briefs/k6-reconciliation-kickoff.md` (the base) · `FinancingReconciliationPanel.jsx` (#756) · `financingService.js` (`setFinancingMonth`, gap/month helpers) · `MonthlyStatementEntry.jsx` (K2 — the statement-write shape) |
| **Risky classification** | **YES (Phase 1 hard-stop)** — money-write into the K2 ledger from a new entry point. Attended. |
| **Smoke walk** | Folds into K6's Phase 6 seeded write-read-verify (adds a gap-fill leg). Offline + emulator green at push. |
| **Strike count** | 0/2 |

---

## Context & the rule (owner-confirmed this session)

Base K6 (#756, `823faaf`) currently reconciles even when a month has **no statement entered** — it effectively treats a missing month as $0. That's wrong: a *forgotten* entry and a *genuinely-zero* month look identical, and the manager never knows a number was assumed.

**The rule:** when reconciliation finds a month with no entry, the manager is **prompted to confirm an amount for that month — even $0 — and must affirmatively confirm it.** A manager-confirmed $0 is trustworthy; a system-assumed $0 is not. Reconciliation is **never silently run over a gap, and never hard-blocked** — it is **gated** on the manager confirming each gap, which is a quick inline action. Once every gap is confirmed, reconciliation proceeds over a complete ledger.

This **replaces** the mockup's hard "Blocked" state (CD#10) with the confirm-the-gap flow — a better fit than refuse-entirely.

---

## Architectural decisions (locked at brief authoring)

1. **Gap detection.** On the reconciliation flow for the selected agent, enumerate every month from `effectiveDate`'s month through the reconciliation month (inclusive). Any month with **no** `financing/{agentId}_{YYYY_MM}` doc is a **gap**. Reuse the existing month/gap helper (`detectSkippedMonths` / `enumerateMonthKeys` — Phase 1 confirms which). **All** missing months are surfaced, not just the math-critical ones (owner wants a complete, confirmed ledger before year-end close).
2. **No silent assume-zero; no hard-block.** The reconcile action is **disabled while any gap is unconfirmed**. The manager is never bounced to another screen and never refused outright — the gaps are confirmed **inline** on the reconciliation panel.
3. **Explicit manager confirmation per gap.** Each gap requires the manager to **affirmatively confirm** the month's figures — including explicitly confirming **$0**. A pre-filled-zero field that is silently accepted does NOT count; the manager must take a confirm action per gap (the exact control — per-row confirm, save-each, or batch-confirm — is the Phase 1 lock).
4. **Write through the EXISTING K2 service.** Each confirmed gap calls `financingService.setFinancingMonth(...)` (the deployed K2 statement-write path — **no new write logic, no new rules**) to write a real, authoritative statement for that month. Flag provenance `source: 'reconciliation_gap_fill'` so a gap-confirmed statement is auditably distinct from a normal ledger entry. (The deployed K2 rules — the K5-restructured `validFinancingMonth` — accept this: a gap-fill writes the statement-core fields, which the rule requires when statement fields are present.)
5. **Then reconcile.** Once all gaps are confirmed/written, `closingBalance` (authoritative reconciliation-month `runningBalance`) and the months-1–3 waiver sum compute over a **complete** ledger. The base-K6 reconciliation math (Decisions 1–3 of the base brief) is **unchanged** — this amendment only guarantees a complete ledger before it runs.

## Out of scope

- The base-K6 reconciliation/garnish/clock math (unchanged) · any new collection or rules (writes K2 statements through deployed K2 rules) · the incentives garnish component (base-K6 banked FU)
- Editing **existing** statements (gap-fill writes only **missing** months; a present month is never overwritten) · routing to the K2 statement screen (confirm inline instead)

## Phase 0 — gate

**On the EXISTING branch.** Confirm `pwd` == `C:/Projects/agencytrack-k6`, `git rev-parse --abbrev-ref HEAD` == `feat/k6-reconciliation`, HEAD == `823faaf` (or the current tip of #756), clean tree. **Do NOT create a new branch.** Re-verify branch at each phase gate. STOP on divergence.

## Phase 1 — source-verify (ends in a hard-stop for dispatcher lock)

1. Confirm the gap/month helper: read `financingService.js` / `dateInputs.js` for `detectSkippedMonths` / `enumerateMonthKeys` / `monthsBetweenKeys` — report the exact helper that enumerates `effectiveDate`-month → reconciliation-month and flags missing docs.
2. Confirm `setFinancingMonth` writes a valid statement the **deployed** K2 rules accept (the K5-restructured `validFinancingMonth` — statement-core fields required when present). Quote the field-set `setFinancingMonth` writes.
3. Read `FinancingReconciliationPanel.jsx` (#756) — identify where the gap-list + inline confirm attaches and where the reconcile action is gated.
4. **Recommend the gap-fill field-set + UI shape (the lock):** which fields the manager confirms per gap (minimum to write a valid K2 statement — `financingPaid`, `netCommission`, `bonusOffset`, `runningBalance`); the control shape (per-row inline confirm vs a gap modal vs batch); and whether the math-critical months (reconciliation month + months 1–3) should be visually distinguished from non-critical middle gaps.

**Report 1–4, then STOP and wait for dispatcher.** No build until the dispatcher locks the field-set + UI shape.

## Phase 2 — build (after dispatcher lock)

1. Gap detection wired into the reconciliation flow (Decision 1).
2. Inline confirm UI on `FinancingReconciliationPanel` (Decisions 2–3) — reconcile disabled while any gap unconfirmed; explicit per-gap confirm.
3. Write each confirmed gap via `setFinancingMonth` with `source: 'reconciliation_gap_fill'` (Decision 4).
4. Reconcile proceeds only over a complete ledger (Decision 5).
5. Tests: gap detected → reconcile disabled; confirm a $0 gap → statement written (source flag set), reconcile enabled; present month → never flagged/overwritten; all-gaps-confirmed → reconciliation runs.

## Phase 3 — verification

- Lint 0 · build green · full suite green.
- Hex-grep new/changed → clean. axe on the updated panel (both themes).
- Emulator: the gap-fill writes K2 statements (deployed K2 rules) — confirm the K2 financing rules test still passes (regression); add a gap-fill-write case if the existing K2 matrix doesn't cover a `reconciliation_gap_fill`-sourced statement. **No new rules block.**
- Seeded write-read-verify folds into K6 Phase 6 (deferred): seed an agent **with a missing month**, confirm the gap inline, assert the statement persisted + reconcile then succeeds.

## Phase 4 — docs

- `docs/CONTEXT.md` — the K6 row note reflects the gap-fill guard (placeholder until `/post-merge`).
- `docs/FOLLOW_UPS.md` — **resolve** the base-K6 "skipped-month-blocking" FU as **"implemented as confirm-the-gap (manager confirms each missing month, incl. $0; reconcile gated, not hard-blocked) — supersedes the mockup's hard-Blocked state."**

## Phase 5 — push to the open branch

Conventional commits on `feat/k6-reconciliation` (the open branch). Green gates. **Push to the existing branch** (updates PR #756 — do NOT open a new PR). Update the PR description noting the gap-fill amendment. **Rule 15** paste-back. **Rule 20** — name the new HEAD SHA. Do NOT merge. Then **STOP and wait for dispatcher**.

## Phase 6 — held (with base K6, morning, operator-gated)

Unchanged from base K6: operator deploys the **base-K6** additive `financingReconciliation` rules from `C:/Projects/agencytrack-k6` (the gap-fill adds no rules; verify ruleset createTime advances + contains the K6 block, Rule 23/24). CC runs the seeded write-read-verify **including the gap-fill leg** (seed an agent with a missing month → inline-confirm → statement persists → reconcile succeeds), Admin-SDK cleans the seed. Human-merge the whole PR #756 → `/post-merge 756` (Sonnet). **Rule 21** poll; **Rule 22** name ≥1 gap.

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Phase 1 ends in the mandatory dispatcher lock (field-set + UI) → **STOP and wait for dispatcher**
- Any decision not pre-listed (Rule 1), or a new branch/PR created instead of extending #756 → **STOP and wait for dispatcher**
- Phase 2 scope expansion — new rules, new collection, editing/overwriting present statements, changing the base-K6 reconciliation math → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite/axe/emulator failure after one fix attempt → **STOP and wait for dispatcher**
- A wrong-worktree/wrong-branch detection at any phase gate → **STOP IMMEDIATELY**
