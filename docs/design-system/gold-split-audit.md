# Gold Split — Phase-0 Audit & Decisions

**Branch:** `feat/nexus-gold-split` · **Status:** audit surfaced, **implementation HELD** per the brief's Phase-0(e) stop-condition (>5 borderline sites + genuine entanglement → surface, do not mass-apply). No tokens changed, no sites swept in this PR — this is the decision gate.

**Goal:** split gold into two roles so vivid gold can be used where it's legible without regressing AA:
- `--color-gold` = **vivid `#B07D1A`** → decorative (fills, dots, borders, chart series, icons) + gold **text large enough to pass AA-large** at its actual background.
- `--color-gold-ink` = **`#8a6011`** (the current AA-safe value) → all other gold text (small/normal, or large text that fails AA-large at its bg).

---

## 1. Current state (source-verified)

| Token | Light `:root` | Dark `.dark` |
|---|---|---|
| `--gold-channels` / `--color-gold` | `138 96 17` = **#8a6011** ([index.css:102](../../src/index.css:102)) | `224 170 62` = **#E0AA3E** ([index.css:329](../../src/index.css:329)) |
| `--color-gold-tint` | `#fdf3dc` ([:104](../../src/index.css:104)) | `rgba(224,170,62,0.14)` ([:331](../../src/index.css:331)) |

Gold **is** consumed with alpha modifiers (`bg-gold/15`, `bg-gold/10`, `border-gold/20|30|40|50`), so the `--X-channels` substrate must be preserved for both `--color-gold` and (if consumed with alpha) `--color-gold-ink`. Today light gold is the AA-darkened `#8a6011` used for **both** decoration and text — the split lets decoration go vivid while text stays legible.

## 2. WCAG basis (computed, not eyeballed)

Thresholds: normal text ≥ 4.5:1 · large text (≥24px reg **or** ≥18.66px/14pt bold) ≥ 3:1 · graphical (fills/borders/icons, SC 1.4.11) ≥ 3:1.

**Light mode:**
| Foreground | on white | on gold-tint `#fdf3dc` | on card-raised | verdict |
|---|---|---|---|---|
| vivid `#B07D1A` | 3.62 | 3.28 | 3.47 | **passes AA-large & graphical (≥3.0); FAILS AA-normal (<4.5)** everywhere |
| gold-ink `#8a6011` | 5.58 | 5.06 | 5.30 | passes AA-normal everywhere |
| white text **on** vivid fill | 3.62 | — | — | small white text on a vivid gold fill would FAIL AA-normal (was 5.58 on #8a6011) |

**Dark mode:** `#E0AA3E` = **7.69** on dark surface, **8.56** on dark bg, **5.86** on its own /14 tint → **passes AA-normal as text everywhere**. Vivid `#B07D1A` would only score **4.46** on the dark surface (and be near-invisible as a fill on near-black).

### Dark-mode decision (brief asked to confirm the dark vivid value)
**Dark `--color-gold` stays `#E0AA3E`; dark `--color-gold-ink` = `#E0AA3E` (identical).** Rationale: `#E0AA3E` is *already* the vivid, bright gold for dark and already clears AA-normal as text — it serves both roles. Substituting `#B07D1A` in dark would regress both text (4.46 vs 7.69) and decoration (a dark gold on near-black). This mirrors the app's existing dark status-ink pattern (`warning-ink` == `warning` base in dark because the base already passes). **Net: the split is materially light-mode-only.** In dark mode, `text-gold` and `text-gold-ink` render identically, so migrated sites are visually unchanged in dark.

> **Consequence:** migrating a normal-text site to `text-gold-ink` is a **zero-visual-change** edit *today* (gold-ink light `#8a6011` == current light gold; dark `#E0AA3E` == current dark gold). The only sites that change appearance under the split are the **decorative** ones kept on `--color-gold` (which brighten to `#B07D1A` in light) and any **large text promoted to vivid**.

## 3. Classification summary (~55 gold consumers)

| Class | Rule | Count (approx) | Action |
|---|---|---|---|
| **decorative-vivid** | non-text: fills, dots, borders, chart strokes, icons | ~28 | keep `--color-gold` (→ vivid) |
| **gold-ink** | text < 18.66px bold / < 24px reg, on any bg | ~22 | migrate → `text-gold-ink` / `var(--color-gold-ink)` |
| **BORDERLINE** | large text (bg-dependent) OR entangled variable OR dynamic size OR within 0.2 of threshold | **7** (see §5) | **default gold-ink; owner decides vivid** |

### 3a. Decorative-vivid (keep `--color-gold`) — representative
Borders: `border-gold/NN` on cards — GoalDecompositionTab:53, CommissionAnchorStrip:55, ProductionLeaderboardSurface:105, PolicyDrillDrawer:164, PlanCascade:71/82, ReviewSubmit:55, AgentPlanDrawer:405, FinancingBasisBadge:19, FinancingProrationPanel:339, FinancingStatusBadge:22, LedgerTimelineStrip:22, MonthlyStatementEntry:345. · Dots/particles (`bg-gold`): MoneyNeedsPanel:30, PlanAnchorStrip:35, PolicyDrillDrawer:145 (holds a white dot — graphical 3:1 OK), PolicyCard:30, Celebration:199/232, FinancingBasisBadge:20, FinancingStatusBadge:23, LedgerTimelineStrip:29. · Icons (`text-gold` on Lucide): WhereYouRankPanel:193 (Trophy), FinancingProrationPanel:341 (AlertTriangle), PersistencyEntryForm:148 (Lock). · Charts (`var(--color-gold)` stroke/fill): PersistencyTab:185, CashFlowChart:12/13, MiniSparkline:46, PulseStrip:20 (fg → icon + viz only, no text). · CSS: `.role-bar-fill-gold` ([index.css:1793](../../src/index.css:1793)).

### 3b. Gold-ink (migrate → gold-ink) — representative
Small text (7–14px), grouped: MoneyNeedsAllocator:235, ProductionLeaderboardSurface:147/415/469, MoneyNeedsPanel:115, PolicyDrillDrawer:152/155, Celebration:91/111, ReviewSubmit:67, AgentPlanDrawer:406, WeekSoFarPanel:230/331 (9px eyebrow), FinancingBasisBadge:19, FinancingProrationPanel:342, FinancingReconciliationPanel:330/700, FinancingStatusBadge:22, FinancingTermsSetup:309, LedgerTimelineStrip:22, MonthlyStatementEntry:339/347, PersistencyEntryForm:149, PolicyReconciliationPanel:226/351, WhereYouRankPanel:88 (14px rank), RankedLeaderboard:33, GoalDecompositionTab:58. · Inline `color:var(--color-gold)` text: BmAtRiskPanel:70/236, CareerPortal:232/513/577, AgentAwardsPanel:176 (GroupHeader), ManagerAwardsPanel:260. · **CSS gold text-on-tint** (these are `color:var(--color-gold)` in index.css and would fail AA at vivid): `.ai-gold` ([:1020](../../src/index.css:1020)), `.activity-pill-gold` ([:1043](../../src/index.css:1043)), and [:1213-1214](../../src/index.css:1213). **These must go to `var(--color-gold-ink)` as part of any sweep or they regress AA.**

## 4. Entanglement finding (why a naive className sweep is unsafe)

`src/components/awards/awardPrimitives.jsx` drives a **single `accentColor` variable** to both graphical and text roles at once:
- **AwardDonut** ([:36-70](../../src/components/awards/awardPrimitives.jsx:36)): `accentColor` = SVG ring stroke (graphical) **+** center `%` text with **dynamic** `fontSize: size*0.26` (≈26px at size 100, ≈12px at size 48 — small **or** large depending on caller).
- **AwardCard** ([:166](../../src/components/awards/awardPrimitives.jsx:166)): `accentColor` = 9px pill text (:208) **+** 24px `%` text (:217) **+** progress-bar fill (:232).
- **AwardDrillDrawer** ([:262](../../src/components/awards/awardPrimitives.jsx:262)): `accentColor` (drawer accent — mixed).

A single token can't be both vivid (decoration) and gold-ink (small text) here. Two safe resolutions, **owner's call**: (A) set the whole variable to `gold-ink` — simplest, zero visual change (rings stay today's `#8a6011`), foregoes vivid rings; or (B) split each into `ringColor` (vivid) + `textColor` (gold-ink) — a real per-component refactor to get vivid rings *and* legible text. PulseStrip's `fg` is **not** entangled (icon + viz only) → clean vivid.

## 5. DECISIONS-NEEDED (borderline — default gold-ink; owner confirms vivid)

All default to **gold-ink** (safe, AA-passing, zero visual change). Owner may promote any to **vivid** if the large-text + background is confirmed. Rule 23 falsifier for each: *a promotion to vivid is overturned if the site's real composited background is darker than card/tint (dropping vivid below 3.0:1) or the text renders below the large threshold.*

| # | Site | Text | Size/weight | AA-large @ its bg (vivid) | Default | Vivid-eligible? |
|---|---|---|---|---|---|---|
| 1 | ProductionLeaderboardSurface:184 | champion API value | `text-2xl/xl` **bold** (24/20px) | 3.62 on white card → ✓ **if** podium bg is card/white (unverified — champion card may be tinted) | gold-ink | **likely** — confirm podium bg |
| 2 | PlanAnchorStrip:62 | commission currency | `text-xl extrabold` (20px) | 3.62 on card → ✓ **if** hero bg is card (not glass/tinted) | gold-ink | **likely** — confirm hero bg |
| 3 | awardPrimitives AwardCard:217 | progress `%` | `text-2xl` bold (24px) | entangled with 9px pill (:208) | gold-ink | only via §4-option-B refactor |
| 4 | awardPrimitives AwardDonut:65 | center `%` | **dynamic** `size*0.26` | entangled with ring; size unresolved statically | gold-ink | only via §4-option-B + size guard |
| 5 | awardPrimitives AwardDrillDrawer:262 | drawer accent | mixed (unverified) | entangled | gold-ink | verify uses |
| 6 | MoneyNeedsPanel:456 | commission total | `text-lg extrabold` (**18px** < 18.66 bold threshold) | fails large by 0.66px | gold-ink | **no** (below threshold) |
| 7 | CareerPortal:186 | tier accent label | unverified (likely `text-xs`) | — | gold-ink | verify size |

**Additional owner decisions:**
- **D1 — dark-mode value:** confirm dark `--color-gold` stays `#E0AA3E` and dark `--color-gold-ink` = `#E0AA3E` (§2). Recommended: yes.
- **D2 — award donuts/cards (§4):** option A (whole variable → gold-ink, simplest) or option B (split for vivid rings)? Recommended: A for this pass; B as a follow-up if vivid award rings are wanted.
- **D3 — vivid promotions:** approve #1 and #2 (after bg confirmation) as vivid large text? The rest default gold-ink.
- **D4 — icon/text adjacency:** with the split, small status **icons** (Lock, AlertTriangle) go vivid `#B07D1A` while their adjacent **text** goes gold-ink `#8a6011` — a subtle two-tone gold. Acceptable, or keep those paired icons on gold-ink for visual match? (Brief default: non-text → vivid.)

## 6. Proposed implementation (follow-up, after greenlight)

1. **Tokens** ([src/index.css](../../src/index.css)): add `--color-gold-ink` + `--color-gold-ink-channels` = `138 96 17` (light) / `224 170 62` (dark); change `--color-gold` → `176 125 26` (**#B07D1A**) light, keep `224 170 62` dark.
2. **Tailwind** ([tailwind.config.js](../../tailwind.config.js)): add `gold.ink` (`text-gold-ink`, + `bg-/border-gold-ink` if the sweep needs them).
3. **Sweep**: migrate every §3b + confirmed-borderline site to gold-ink; keep §3a on vivid; apply the §4 decision to awardPrimitives; migrate the three index.css CSS classes (`.ai-gold`, `.activity-pill-gold`, :1213) to `var(--color-gold-ink)`.
4. **Verify**: lint + build + full suite (no contrast/guard test pins gold — none reference gold, verified in [contrast.test.js](../../src/utils/__tests__/contrast.test.js)); compiled-bundle grep for both tokens; both-theme smoke of §5 highest-risk sites.

## 7. Known gaps (Rule 22)

- **Backgrounds for #1/#2 not composited to a pixel.** I classified by the nearest surface token; the champion podium and GamePlan hero *may* sit on a glass/tinted pane that lowers vivid below 3.0:1. Both are defaulted to gold-ink (safe) precisely because I did not verify their exact composited bg — the owner/sweep must confirm before any vivid promotion.
- **A few inline sites classified from grep context, not full reads** (AwardDrillDrawer:262 uses, CareerPortal:186, GroupHeader label size). All defaulted to gold-ink; the follow-up sweep re-verifies each.
- **AgentReportDocument.jsx** (react-pdf hardcoded hex) is an out-of-scope holdout — it uses gold hex but cannot resolve CSS vars; **not touched**, deferred per the existing holdout follow-up.
- **No code shipped in this PR** — this is the decision gate. Nothing is verified at runtime because nothing changed; verification lands with the sweep.
