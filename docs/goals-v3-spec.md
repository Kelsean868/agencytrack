# Spec / Future Plan — Goals v3 (agent goal portfolio: "your committed goal → what it unlocks")

Status: PLANNED — **prep only**. This is a design-heavy agent-facing feature; the build runs
through CD (design) + Kyron, NOT autonomously. Gate: build only after the agent hero (DONE) and
the manager recommend-vs-lock build land (Slices 1+2 landing; Slice 3 = the additive Playground
embed). Every phase is **build-and-hold**.

## The idea
Broaden the agent Goals tab from the bare production cascade (API / Apps / Persistency) into a
goal portfolio framed as **"your committed goal → what it unlocks."** The agent's committed
production goal stays the spine; v3 layers on what that goal *gets* them — income, recognition,
MDRT standing — which is the language agents actually motivate themselves in.

Three layers, all derived from the committed goal (reuse, don't rebuild):

1. **Derived income** — what the committed production earns. Reuse the **Commission Playground**
   blended-rate math (already built). Display-only. *Start here* — it's the cheapest and most
   decided.
2. **Award reach + aspirational awards** — which awards the committed goal already clears, plus
   agent-selected *stretch* awards showing the **gap** to reach them. Reuse `awardsRuleset_2026`.
   The commitment-vs-aspiration gap is the motivating mechanic.
3. **MDRT / COT / TOT qualification** — progress toward the industry standard, premium method
   (matches API). Verified 2026 TTD thresholds (re-verify annually at build):
   - MDRT ~TTD 688,800 · COT ~TTD 2,066,400 · TOT ~TTD 4,132,800 (premium)
   - (commission method: MDRT ~344,400 · COT ~1,033,200 · TOT ~2,066,400)
   - Source: MDRT 2026 conversion-factor table (2026 membership / 2025 production). Note the
     three qualification methods (commission / premium / income); premium is the natural fit but
     an agent could qualify via any. MDRT premium ~689K ≈ career L5–L6 tier.

## Reusable vs net-new (confirm in the run recon)
- Commission Playground blended-rate math — EXISTS; embed display-only for the income readout.
- `awardsRuleset_2026` + `awardsRulesetService` — EXIST; drive the award-reach + aspirational gap.
- The agent Goals tab / GapAnalysisPanel hero + cascade — EXISTS (v2); v3 extends it.
- Net-new: the portfolio framing/layout, the aspirational-award selector, the MDRT/COT/TOT
  thresholds config (per-year) + qualification logic.

## Open design questions (for CD + Kyron — NOT to be guessed autonomously)
- The "committed goal → what it unlocks" layout: one scrolling portfolio, tabs, or cards?
- Which awards surface by default vs the agent-selected aspirational set; how the gap reads.
- MDRT presentation: a single premium-method track, or all three methods?
- **Privacy (separate call):** a *set* income target (vs derived-only) and whether managers see
  agent income. Start **derived-income-only**; defer the set-target + manager-visibility call.

## Phasing
- v3.1 — derived income (reuse Playground), display-only.
- v3.2 — award reach + aspirational-award selector + gap (reuse awardsRuleset).
- v3.3 — MDRT/COT/TOT qualification (thresholds config + logic; web-verify figures at build).

## Merge posture
Build-and-hold at every phase, CD-designed, human-merged. Not auto-built, not auto-merged.
