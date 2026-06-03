# HeroCard marker-label collision — Bug-fix kickoff brief

- **Status:** FINAL — scope locked.
- **Channel:** HUMAN-MERGE + pre-review. (Small, but it's a visual fix — the definitive check is eyeballing the rebuilt preview.)
- **Scope class:** Single-component layout fix on the v2 agent dashboard home. **Frontend-only — no data / schema / logic / route change.**
- **Smoke:** REQUIRED — uses the shared harness. Structural label assertions + both themes; **final confirmation is visual on the preview** (a label-collision fix can't be fully proven by selectors).
- **Branch:** off `origin/main` (current HEAD `1875e82`).
- **Rules in force:** 9, 12, 15, 17, 19, 20.

---

## 0. Why

On the agent dashboard home, the HeroCard's progress bar (0 → personal annual API goal) has below-bar axis labels. At the right, the **goal/end-of-bar label and the MDRT milestone marker label (with their TTD amounts) overlap into unreadable text** — "GOAL​MDRT​TTD 200,000​TTD …" interleaved. Confirmed in both themes, so it's a layout bug, not a theme issue. The left "TTD 0" label is fine.

## 1. Scope — the fix

**Phase 0 first establishes the mechanism** (see §2), then fix to: **legible, non-overlapping marker labels in all cases.** Concretely:

1. **Markers render only on-scale.** The bar's max is the personal annual goal. Render the MDRT marker **only when MDRT ≤ goal** (position = MDRT/goal). **If MDRT exceeds the goal, do not render the MDRT marker on this bar** — it's off-scale, and MDRT progress is tracked separately (the Career/MDRT tracker). Clamping it to the right edge (the current bug) is what stacks it onto the goal label. Bank a one-line note that an over-goal MDRT could get its own treatment later if wanted.
2. **No overlapping labels.** Any remaining marker labels must not collide — if two are within label-width of each other, offset one (vertical stagger) or drop the lower-priority one. The "TTD 0" start label stays.
3. **De-dupe the goal amount if it's the collision source.** The goal value is already stated in the subtitle ("16% of TTD 200,000 goal"). If the bar additionally renders a "GOAL · TTD 200,000" end-label that duplicates it and contributes to the collision, drop the redundant amount (a bare "GOAL" tick or nothing) — **Phase 1's call**, based on what the current code renders.
4. **No data / logic / schema / route change.** The YTD value, the goal, the MDRT constant, and all aggregation stay exactly as-is — this is purely the marker/label layout.

**If Phase 0 finds the v2 mockup (`design_handoff_v2_app/mockups/app-dashboard-v2.jsx`) clearly intends a specific multi-marker layout that this fix would contradict → STOP and wait for dispatcher** (so we reconcile against the design rather than guess).

## 2. Source-verified anchors (Phase 0 — Rule 17)

- **Component:** almost certainly `src/components/dashboard/HomeV2/HeroCard.jsx` (it matches the "Submit weekly report" CTA + "NEXT STEP" layout in the screenshot). Confirm it's the component rendering the colliding labels — and confirm whether a sibling (e.g. a "YTD API vs Targets" Floor/Goal/MDRT marker overlay) is actually the culprit instead.
- **The MDRT shared constant:** find its definition and its value, and compare it to the personal annual goal (default 200,000 via `goals?.personalAnnualAPI || mins?.annualAPI || 200000`). This determines the mechanism (off-scale clamp vs incidental label overlap).
- **Marker/label rendering:** how the below-bar labels are positioned (absolute %, SVG, fl. etc.) and why the right cluster overlaps.

**If any anchor diverges from the above → STOP and wait for dispatcher.**

## Phases

**0 — Gate + diagnose.** Branch off `origin/main`. Identify the exact component + the colliding labels; read the MDRT constant and compare to the goal; pin the collision mechanism. If the mockup intends a layout this fix contradicts, or the component isn't what's expected → STOP.

**1 — Design.** Decide the label layout per §1 (on-scale gating, anti-overlap, de-dupe), grounded in what the code currently renders.

**2 — Build.** Apply the fix in the one component (+ its styles if external). No data/logic touched.

**3 — Verify.** `npm run lint` / `npm run build` green; SMOKE both themes via the shared harness (§Smoke); confirm no raw-palette regression if any classes change.

**4 — Docs (with placeholders).** `docs/CONTEXT.md` Recently-shipped row + Rule 16 refresh (`#TBD/{TBD}`). If an over-goal-MDRT treatment is banked, add it to `docs/FOLLOW_UPS.md`. (No port-ledger change — this is a fix, not a port.)

**5 — Commit / push / PR.** Conventional commit (`fix(dashboard): …`); push; `gh pr create`. **STOP. Do not merge / deploy (Rule 19).** Report PR URL + smoke result + a screenshot/description of the corrected hero + the feature-branch HEAD SHA (Rule 20).

**6 — Post-merge.** `/post-merge <pr-number>`.

## Smoke (Rule 9 — REQUIRED)

Use the shared harness (`scripts/verification/lib/walk-helpers.mjs`). The test agent's dashboard already reproduces the bug (goal 200,000, the live MDRT constant), so no seeding needed:
1. Log in as the test agent; load the dashboard home.
2. Assert the hero progress bar renders; assert the below-bar labels are **structurally non-overlapping** — e.g. no two label elements share the same bounding-box x-range, or (if MDRT is off-scale) **no MDRT marker element is present**. Assert the goal amount isn't duplicated into a colliding label.
3. Both themes (`runBothThemes`); axe NO-NEW serious/critical on the surface.
4. **Capture a screenshot of the hero both themes for the PR** — the definitive check is visual.

Report X/Y both themes + attach/describe the hero screenshots.

## Acceptance criteria
- The HeroCard's below-bar marker labels are legible and non-overlapping in both themes.
- The MDRT marker renders only when on-scale (≤ goal); off-scale MDRT is hidden (not clamped onto the goal label).
- The goal amount isn't duplicated into a colliding label.
- No data / logic / schema / route change; YTD value, goal, and MDRT constant unchanged.
- Smoke green both themes; corrected hero confirmed visually on the preview.
