# K5 — validation-schedule proration — kickoff brief

**Authored:** post-#751 · dispatcher.
**Baseline:** origin/main `7c1a628` (K3 fill; K3 squash `83a491d`) — **Phase 0 re-verifies exact HEAD.**
**run_model:** `claude-opus-4-8` (money math + ledger write — judgment-dense).
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — money math + ledger write. **Rules: verified at Phase 1** (expected: K2's permissive block already permits the new fields → no rules change, no deploy; if a coarse-check edit is needed, K5 owns it + an additive deploy).

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — Track K · monthly financing proration (reuses K3 Gross) + ledger proration fields + manager-override UI |
| **Shape** | `src/lib/financingProration.js` (reuses K3 `creditWeight`/`computeApiChain`) + `financingService.js` proration-write method + proration UI in the financing tab + tests + docs (+ rules **only if** Phase 1 shows the permissive block rejects the new fields) |
| **Size** | M–L |
| **Branch** | `feat/k5-proration` |
| **Sources** | `docs/track-k-financing-new-agent-design.md` §2/§5/§6 · `docs/design/track-k-locked-decisions.md` **B.1–B.5** · `design_handoff_track_k/Track K Validation Dashboard - Manager Build.html` + `README.md` · **`src/lib/financingBonusEngine.js` (K3 — Gross assembly this reuses)** · the deployed K2 `financing` ledger rules + `financingService.js` |
| **Risky classification** | **YES (Phase 1 hard-stop)** — money math + ledger write + provisional/confirmed basis subtlety. Hard-stop after Phase 1 for dispatcher lock. |
| **Smoke walk** | **Required — write-read-verify** (writes proration fields to the ledger) + both themes. Pre-merge after any additive deploy (only if rules change). |
| **Strike count** | 0/2 |

---

## Context

K2 made the monthly running balance visible; K3 built the credit-filtered Gross. K5 is the **proration** — each month, compute the agent's actual production as a credit-filtered Gross, compare it to the validating target, and produce a **suggested** prorated financing draw the manager confirms or overrides. This is "financing stops being a black box mid-month." `actualAPI` is the **contract's credit-filtered Gross New Settled API** (owner-confirmed) — so K5 **reuses K3's engine**, making its dependency K3 (not just K1+K2 as the design spec's graph claimed; this brief supersedes that edge).

---

## Architectural decisions (locked at brief authoring)

1. **`actualAPI` = K3's credit-filtered Gross, monthly** (owner-confirmed; supersedes spec §6's loose "submitted/settled" and the spec's K5⊥K3 dependency). Reuse `creditWeight` + the Gross arm of `computeApiChain` from `financingBonusEngine.js` — do **not** re-implement the credit filter. Fed the agent's monthly policy set on the basis below. Staff policies **count** (A.4 closed — same `'count'` the engine uses; consistent across bonus + financing).
2. **Basis resolution** (relative to `effectiveDate`): **months 1–3 → submitted Gross** (policies with `dateSubmitted ∈ month`, credit-filtered); **month 4+ → settled Gross** (policies settled `dateIssued ∈ month`, credit-filtered). **Provisional vs confirmed:** the current month at M4+ is `submitted-provisional` (live projection) until settlement is confirmed, then `settled-confirmed`. `basisSource` (the K2-reserved enum) is **written by K5** here.
3. **Proration:** `suggestedFinancing = agreedMonthlyFinancing × min(1, actualAPI ÷ validatingAPI)`, **capped at 100%** (the agreed amount is the ceiling). Computed per month on the resolved basis.
4. **Determinations use the confirmed basis only** (locked §2.4). The provisional projection drives the *display* readout; any stored determination figure (the `adjustmentPct` K7 will flag on) is computed on the **confirmed** (settled, M4+) basis, never the provisional projection.
5. **Manager override → `managerFinancing`.** `suggestedFinancing` is computed; the manager confirms it or sets a different final figure (discretion is final, locked §2.2). Both stored.
6. **`validatingAPI` per month, schedule-history-preserving.** Defaults from `financingTerms.validatingAPI`; the manager can set a different amount for a month when a new Validation Schedule is issued (a downward adjustment). The month's value is snapshotted to the ledger doc (spec §6 "amount in effect that month").
7. **`adjustmentPct` computed + stored** — the month's distance below full. K5 **produces and stores** it; the clause-5.3 **>10% flag + notify-Sales-Admin duty is K7, NOT K5** (addendum B.5 — K5 supplies the number, K7 surfaces the flag/duty). Denominator per B.5 is `currentMonthlyFinancing`.
8. **Ledger write + rules.** Writes `validatingAPI`, `actualAPI`, `suggestedFinancing`, `managerFinancing`, `adjustmentPct`, `basisSource` onto the existing `financing/{agentId}_{YYYY_MM}` doc via a `financingService.js` proration method (parseFloat, audit, `Timestamp.now()` for any in-array value). **Rules:** Phase 1 verifies whether K2's deliberately-permissive block (no `hasOnly`, no key-allowlist) already permits these additional numeric/enum fields — **expected yes → no rules change, no deploy.** If it would reject them, K5 adds coarse type checks (numbers when present; `basisSource` in the 3-enum) + an additive deploy.
9. **Proration UI** — the manager **suggested-vs-confirmed override drawer** (manager mockup) in the financing tab: per agent per month, show `actualAPI` (with basis badge), `validatingAPI`, `suggestedFinancing`, an editable `managerFinancing`, and `adjustmentPct`. Nexus tokens, both themes, 44px.

## Out of scope

- The **>10% flag + notify-Sales-Admin duty** → **K7** (K5 stores `adjustmentPct` only)
- Take-home → **K4** · reconciliation/garnish → **K6** · termination/consecutive-miss → **K7** · dashboard/drill-down → **K8**
- Re-implementing the credit filter (reuse K3) · any new collection · the take-home waterfall

## Phase 0 — gate

Standard. Fresh branch `feat/k5-proration` off synced `origin/main` (`7c1a628`). Clean tree. STOP on divergence. **File-disjoint from K4** (K4 = take-home calc/adapter/waterfall, no writes; K5 = proration/ledger-write/override-UI).

## Phase 1 — source-verify (ends in a hard-stop)

1. `git ls-files` the sources (spec, addendum, manager mockup, `financingBonusEngine.js`, `financingService.js`) → tracked.
2. Greenfield grep: `financingProration` / proration symbols new.
3. **K3 reuse (load-bearing).** Read `financingBonusEngine.js` — confirm `creditWeight` + the Gross arm of `computeApiChain` are importable as pure functions and produce Gross from a monthly policy set without re-implementation. If the Gross assembly isn't cleanly reusable at monthly granularity → **STOP and wait for dispatcher**.
4. **Rules-permissive verification (load-bearing).** Read the **deployed** K2 `financing` rules block; confirm a write that adds `suggestedFinancing`/`managerFinancing`/`adjustmentPct`/`validatingAPI`/`actualAPI`/`basisSource` is **permitted** (no `hasOnly`/key-allowlist). Report: **no rules change** (expected) or **rules edit needed** (K5 owns it + deploy).
5. **Basis sources.** Confirm `dateSubmitted`/`dateIssued`/`settledAPI`/`proposedAPI` on the policy ledger; confirm `financingTerms.effectiveDate` (bare `YYYY-MM-DD`) drives the month-index and `validatingAPI`/`currentMonthlyFinancing` are readable.
6. **Mount.** Read the K1 `FinancingTab` / K2 ledger surface; recommend where the override drawer attaches (file:line).
7. Mockup parity — manager Validation Dashboard sheet; confirm the override drawer fields; list anything drawn but out of K5 scope (esp. the >10%/notify, which is K7).

**Report 1–7 with file:line + the rules verdict + the recommended mount, then STOP and wait for dispatcher.** No build until the dispatcher locks the mount, the rules path, and the provisional/confirmed determination handling.

## Phase 2 — build (after dispatcher lock)

1. `financingProration.js` — basis resolution + monthly Gross (via K3) + `suggestedFinancing` + `adjustmentPct` (Decisions 1–4, 7).
2. `financingService.js` proration-write method (Decision 8) + the gap/basis helpers as needed.
3. Rules + emulator tests **only if** Phase 1 #4 shows a change is needed.
4. Proration override UI (Decision 9) at the locked mount.

## Phase 3 — verification

- Lint 0 · build green · full suite green (+ emulator rules tests only if rules changed).
- Hex-grep new/changed source → clean. axe on the new UI (both themes).
- **Write-read-verify smoke (pre-merge):** for the test agent, an M1–3 month → `suggestedFinancing` computed off submitted Gross, basis `submitted-final`; an M4+ month → settled Gross, basis `settled-confirmed`; a manager override → `managerFinancing` persists ≠ suggested; `adjustmentPct` stored; reload → all persisted. Cap test: `actualAPI > validatingAPI` → suggested caps at agreed (100%). Both themes.

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD`), top table → K5 shipped, Where-we-left-off. (Size cap.)
- `docs/FOLLOW_UPS.md` — note the spec's K5⊥K3 dependency edge is **corrected** (K5 reuses K3); carry the K7 dependency (consumes `adjustmentPct`).

## Phase 5 — commit / push / PR

Conventional commits on `feat/k5-proration`. Green gates. PR via `gh`: title `feat(k5): validation-schedule proration + manager override (Track K)`; description = outcome + smoke evidence + the Phase 1 rules verdict + the K3-reuse confirmation. **Rule 15** paste-back. **Rule 20** — name HEAD SHA. Do NOT merge. Surface PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (post-merge)

Human-merge (money + ledger write). Deploy **only if** rules changed (operator additive deploy pre-merge, same carve-out as K1/K2 — then the write-read-verify is the production run); else **no deploy**. `/post-merge <pr#>` (Sonnet). **Rule 21** poll; **Rule 22** name ≥1 gap.

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Phase 1 check failing — K3 Gross not cleanly reusable, or a basis source missing → **STOP and wait for dispatcher**
- Any decision not pre-listed (Rule 1), or the >10%/notify duty pulled in from K7 → **STOP and wait for dispatcher**
- Phase 2 scope expansion — re-implementing the credit filter, any new collection, the K4 waterfall → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite/axe/emulator failure after one fix attempt → **STOP and wait for dispatcher**
- Smoke write-read-verify failure → **STOP IMMEDIATELY**
