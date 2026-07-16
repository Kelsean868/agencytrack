# Persistency v2 — PROPOSAL, not ratified design authority

**Status: PROPOSAL-STAGE.** This is a methodology + UI proposal that Tatil is currently seeking approval on. It is **not** ratified and is **distinct from [`docs/design-system/screens-v2/`](../../screens-v2/)**, which is the canonical design intent for everything else in the app (per the root `CLAUDE.md` § Theme System canonical-sources note). Nothing in this folder carries that canonical designation until Tatil actuarial signs off and a locked formula spec exists.

## What this proposal is

A new persistency calculation methodology: a rolling 24-month, per-policy, time-weighted debit/credit ledger. Early lapses are weighted heavier, reinstatements credit the remaining months, and each policy's contribution self-expires at 24 months. This replaces the current persistency calculation — it is not an incremental tweak.

## Contents

- **Manager-surface UI mockups (4 files)** — `persistency-v2-builder.jsx`, `persistency-v2-panels.jsx`, `persistency-v2-scenes.jsx`, `persistency-v2-shared.jsx`. These currently live at [`docs/design-system/screens-v2/`](../../screens-v2/) (verified present there 2026-07-15) rather than physically inside this folder — they were not moved as part of authoring this README, since relocating files designated canonical elsewhere is a scope decision beyond writing this doc. Flagged for an explicit operator call: leave in place with this README as the cross-reference, or physically relocate into this proposals folder.
- **Calc-methodology source document** — candidate file: [`docs/design-system/screens-v2/uploads/persitency_001.pdf`](../../screens-v2/uploads/persitency_001.pdf) *(filename as it exists in the repo — note the typo, "persitency" not "persistency")*. This is the only persistency-methodology PDF found in the repo and is presumed to be the draft circular referenced by the R-07 ruling, but its contents were **not** rendered/verified in this pass (no PDF-rendering tool available in this environment) — treat as unconfirmed until an operator opens and confirms it. It has not been renamed or copied to `persistency-v2-calc-methodology-PROPOSAL.pdf` pending that confirmation.

## Build constraints (binding until Tatil ratifies)

- **Do NOT build the calc from this draft.** The methodology may change before Tatil approves it. The first real deliverable is a **locked formula spec from Tatil actuarial** — not code, not this draft PDF.
- Phased build, all gated on ratification:
  1. **Calc engine** — CF-based, money-correctness-critical, attended-only.
  2. **Manager surface** — port the mockups only after the engine feeds real v2 numbers.
  3. **Calc-model switch** — Company Config setting `persistency.calcModel: current|v2`, default `current`, added when the engine lands.
- The existing `persistencyV2` feature flag gates the UI shell only — it does not gate or imply approval of the calc model.
- ABSOLUTE STOP / attended-only. No autonomous run builds any part of this without a human.

## Cross-reference

Ruled on 2026-07-13 as **R-07** in [`docs/audits/design-conformance-2026-07-13.md`](../../../audits/design-conformance-2026-07-13.md) § 5 item 2 — see that entry for the full ruling text.
