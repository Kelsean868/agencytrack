# Onboarding — Add Contract Date + Industry Tenure to the Identity Step

**Sized:** S–M
**Type:** Extends the deployed onboarding identity rule + the Slice-B identity step to capture, self-entered and write-once: (1) the agent's **Tatil contract date** → `monthsAtTatil`, and (2) **industry tenure** → `monthsInIndustry`. **Higher-stakes than DOB** — both drive tenure, which feeds the career floors + the rookie / new-business award guards.
**Channel — SPLIT (mirrors Slice A→B):**
- **Slice 1 (rule amendment) = TIER-C** — Claude pre-review + human-merge + `firebase deploy --only firestore:rules`.
- **Slice 2 (identity fields) = TIER-B** — after Slice 1 is deployed.
**Suggested model:** opusplan (rules-adjacent + stakes) for Slice 1; Sonnet for Slice 2.
**Persona review:** YES — findings below.
**Sequencing:** Independent of onboarding Slice C (different components). Run before or after; no conflict.
**Why:** Pilot managers are slow to provide this data, so agents self-enter during onboarding (same rationale as agentNumber/DOB). Future: a manager confirm/reconcile surface (banked below).

---

## Industry-tenure model (the design)

- **Contract date** → `monthsAtTatil` (baseline tenure).
- **Industry tenure** → for a genuinely-new agent, industry time = Tatil time, so it's **derived from the contract date** — no extra input. Framed as a first-company check:
  - **"Is Tatil Life your first insurance company as an agent?"** → **Yes** → `monthsInIndustry` derived from contract date (no input). → **No** → enter total experience **as an agent** in years or months, normalized to **months**, **validated ≥ Tatil tenure** (industry time can't be less than time at Tatil), sanity-capped.
- **Boundary alignment (data-integrity):** the award guard is `monthsInIndustry > 18`, so the "new" path must yield **≤ 18** — an agent at exactly 18 stays on the new path and the guard agrees. The self-report line must not drift from the eligibility line.
- **Storage of the "new" case is locked after recon** (Phase 1.4 below): if `monthsInIndustry` is consumed *only* by the 18-month gate, any safe sub-18 value (or the derived-from-contract-date value) is fine; if it's used granularly anywhere, store the derived value faithfully (floor = Tatil tenure) rather than a placeholder.

---

## Persona review — what surfaced (the stakes lens)

- **Money-correctness / data-integrity (the big one):** a wrong contract date or industry tenure shifts the agent's tenure band → wrong career floor + wrong award eligibility. Mitigations: write-once + manager-correctable, a **near-term** manager-confirm reconciliation, an in-wizard note, the boundary-alignment above, and — critically — the self-entered values must drive `monthsAtTatil`/`monthsInIndustry` through the **same computation** manager data uses (no parallel tenure math).
- **Role / permissions:** add the new fields to the **same owner write-once whitelist** — not free owner-write; manager retains correction. Do not widen beyond the named fields.
- **Pilot-ops / reversibility:** write-once + manager-correctable + rule-tightenable post-pilot; the manager-confirm workflow is the reconciliation path.
- **Operator-legibility:** date picker (max = today), a simple yes/no for prior experience, write-once messaging, and a neutral note that the manager will confirm it.
- **a11y:** inputs labeled + keyboard-accessible; both themes.

---

## Slice 1 — Rule amendment · **TIER-C (Claude pre-review → human-merge → deploy)**

**Branch:** `feat/onboarding-tenure-rule`

### Phase 1 — recon
1. The actual field name(s) for the contract date (→ `monthsAtTatil`) and how `monthsAtTatil` derives from it.
2. The actual field/shape backing `monthsInIndustry` — a stored number, a stored date, or **derived from contract date today**? (Determines whether the "new" path needs *any* stored value or just reuses contract date.) Also confirm what it **semantically represents** — total-industry time vs *agent* tenure — so the "first company as an agent" framing matches the guard's intent.
3. The exact award-guard boundary (`> 18`) to align the "new" path.
4. **What consumes `monthsInIndustry`** — only the rookie/new-business gate, or anywhere granular? (Locks the "new"-case storage.)
5. Confirm the new fields aren't already owner-writable.

### Phase 2 — build
Extend the owner write-once arm whitelist to include `contractDate` **and the industry-tenure field** (per recon) — `hasOnly([...four existing..., <tenure fields>])` + write-once guard (existing null/absent; incoming `!= ''`) + add the same fields to the **manager hasOnly** list (correction path).

### Phase 3 — emulator tests
Owner sets each new field once ✓ · can't change after ✗ · can't write `role` bundled ✗ · `canManage` corrects ✓.

### Phase 4 — docs
CONTEXT ledger; note the stakes + the banked manager-confirm FU.

### Phase 5 — PR + **HOLD for Claude pre-review** → human-merge → deploy → live-verify (owner-set ALLOW · post-set change DENY · bundled `role` DENY).

---

## Slice 2 — Identity fields · **TIER-B (after Slice 1 deployed)**

**Branch:** `feat/onboarding-tenure-fields`

Add to `WizardIdentity`, alongside agentNumber/DOB:
- **Contract date** — date picker, **max = `getTodayTT()`** (no future), stored **YYYY-MM-DD string** (like DOB). Not-future validation.
- **Industry tenure** — "Is Tatil your first insurance company as an agent?" yes/no; **no** → years-or-months input normalized to months, **validated ≥ Tatil tenure**, sanity-capped; **yes** → derived from contract date (no input). Boundary aligned to the guard's `> 18`.
- Write-once messaging + neutral note: "Your manager will confirm this."
- Wired through `saveOnboardingIdentity` (extended for the new fields, **still no `updatedAt`** — the hasOnly rule rejects it).
- Same **optional/skippable** behavior as agentNumber/DOB; resume / data-derived completion accounts for the new fields.

**Smoke (rules-dependent → live rule, clean/resettable account):** set contract date + (seasoned path) industry months → reload → persisted + locked; value-assert both stored values and that the derived `monthsInIndustry`/`monthsAtTatil` land on the right side of 18. Both themes.

---

## Banked follow-up — **near-term, not distant**

**Manager tenure confirmation/reconciliation surface** — managers see and confirm/correct self-entered contract date + industry tenure. Because these drive award eligibility + career floors, this is the error-catch for self-entry; prioritize it early in the pilot.

---

## Cross-cutting

- Dates stored YYYY-MM-DD strings (no Timestamp).
- `monthsInIndustry` stored/derived in **months**, one unit, sanity-capped.
- `saveOnboardingIdentity` still omits `updatedAt`.
- Same write-once + manager-correct pattern as agentNumber — stakes higher, mechanism identical, which keeps this an S–M.
