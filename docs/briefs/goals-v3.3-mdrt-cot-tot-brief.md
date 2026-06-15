# Goals v3.3 — MDRT / COT / TOT tracking

**Sized:** S–M
**Branch:** `feat/goals-v3.3-mdrt-cot-tot` (off freshly-fetched main)
**Type:** Agent-facing frontend feature — display-only YTD-API progress + gap to each MDRT tier, against verified threshold constants. **NO rules / CF / migration / money.**
**Channel:** **TIER-B AUTO-MERGE** (same as v3.2). Design locked (decisions ledger, 2026-06-15). Full lint/test/build + value-asserting smoke (the gap numbers) + Gemini disposed (HARD gate) + axe NO-NEW + both-themes + scope-lock → prod-smoke + AUTO-REVERT on fail. **Report after merge — do not hold** (per the v3.2 first-run calibration).
**Dispatch gate:** v3.2 (#641) must be merged on `origin/main` first — sequential slices (Rule 10).

---

## What it is

Below `AwardsReachPanel` on the agent Goals tab, an MDRT/COT/TOT tracker:
- The viewer's YTD API measured against three tiers: MDRT → COT → TOT.
- Per tier: progress (YTD API ÷ threshold) + the gap (threshold − YTD API, in TTD).
- Highlight the nearest tier not yet reached (the active target).
- YTD-vs-annual-threshold by design — mid-year it reads partial; the gap = "how much more this year," same framing as awards reach.

---

## Thresholds — VERIFIED, embed as a year-keyed config constant

**Trinidad & Tobago, 2026, premium method (maps to API):**

| Tier | TTD threshold | Basis |
|------|--------------|-------|
| MDRT | **688,800** | Official MDRT 2026 conversion-factor table, T&T premium requirement (based on 2025 production) |
| COT  | **2,066,400** | 3 × MDRT base (MDRT canon) |
| TOT  | **4,132,800** | 6 × MDRT base (MDRT canon) |

Verified June 2026. Store as a `mdrtThresholds_2026` config constant — **mirror the `awardsRuleset_2026` pattern** (year-keyed, single source of truth, annually bumpable in one place).

Phase 1 re-confirms the MDRT figure against the official source as a cheap double-check; if MDRT has published a newer T&T premium figure, use it and note the change; otherwise use the above.

---

## Modeling caveat — put it in BOTH the UI and a code comment

The tracker uses **API as the proxy for MDRT-eligible premium**. Close, but not identical — real MDRT premium credit can carry product-category weighting/eligibility. So this is **indicative goal-tracking, not an official MDRT qualification calculation**.

- Label the panel so no agent mistakes it for confirmed standing — a small "indicative — based on your API" note near the heading.
- This is also why it's API-only for now; the income method is a future add (decisions ledger).

---

## Role-agnostic principle

Operates on the viewing user's own YTD API — no role hardcoding. The post-v3.3 manager catch-up slice mounts this panel (+ derived income + awards reach) into the manager's own-goals GoalsPanel view.

---

## Phase 1 — source-verify · report-and-PROCEED (STOP only on premise break)

1. **YTD API source** — reuse the value `DerivedIncomePanel` / `AwardsReachPanel` already use (allSubmissions + settlements + userProfile, already in AgentDashboard state; zero new reads). Confirm it's the canonical computed API (formula: `newBusinessAPI + pppAPIInc + 0.10 × lumpsumGross`) and is **reused, not recomputed**.
2. Re-confirm the MDRT 2026 T&T premium threshold against the official MDRT source.
3. Mount point — below `AwardsReachPanel` on the agent Goals tab.
4. Config location/shape for the threshold constant (mirror `awardsRuleset_2026`).
5. Tests touching the Goals tab.

STOP conditions: YTD API not available without a new read or a recompute that diverges from canon · any rules/CF/money implication appears.

---

## Phase 2 — build

`MdrtTracker` panel (role-agnostic): three tiers, progress + gap each, nearest-unreached highlighted, "indicative — based on your API" label, both themes, mobile, ≥44px targets, Nexus tokens (no hex), Lucide icons. States: loading · no-production.
Mount below `AwardsReachPanel`.

---

## Phase 3 — tests

- **Value assertions:** given a known YTD API, progress % and gap to each tier match expected (e.g. YTD 344,400 → 50% to MDRT, gap 344,400; YTD ≥ 688,800 → MDRT met, nearest = COT, gap 1,377,600).
- **Tier transitions:** at/above each threshold, that tier reads met and the nearest-unreached shifts up.
- States; role-agnostic (manager own-data shape).
- Full suite green; lint 0; build clean; hex-grep clean.

---

## Phase 4 — docs (placeholders)

- `CONTEXT.md` ledger; ROADMAP Goals v3 — mark v3.3 done → **Goals v3 portfolio complete** (derived income + awards reach + MDRT/COT/TOT).
- `FOLLOW_UPS.md` — **sharpen the manager catch-up FU** from the generic finding into the concrete plan: *one role-agnostic slice mounting `DerivedIncomePanel` + `AwardsReachPanel` + `MdrtTracker` into the manager own-goals GoalsPanel view; display-only; Tier-B candidate; precursor the Tier-2 cockpit absorbs.* Bank income-method MDRT as a future add.

---

## Phase 5 — PR + smoke + Tier-B auto-merge

1. Open PR. **Gemini poll + disposition (HARD gate).**
2. **Smoke (both themes):** assert the ACTUAL progress % + gap-to-nearest-tier **values** for a seeded agent (not presence) · indicative label present · axe NO-NEW.
3. **Auto-merge on all-green** → prod-smoke + AUTO-REVERT on fail. **Report after — don't hold.**
4. Post-merge report: both-theme screenshots, asserted values, Gemini disposition.

---

## Risk notes

- API-as-premium-proxy is an approximation — **must** be labeled indicative in-UI.
- Threshold is a year-keyed constant — the annual bump is a one-line config change.
- The value-asserting smoke is the Tier-B gate: progress % and gap checked, not just rendered.
