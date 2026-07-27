# AgencyTrack — Design-Conformance Revalidation (supersedes 2026-07-13)

> **Validity SHA:** describes `origin/staging` @ `8a1a17e48b0a...` (`8a1a17e4`, PR #870 squash — Run A Tier 3 conformance closeout). Cross-referenced against `origin/main` @ `60dbf1c2`. Captured **2026-07-25**.
>
> **Type:** READ-ONLY code-level recon · **Method:** Rule-17 source verification. Every finding below cites a `path:line` or a `git grep` result taken against `origin/staging` during this pass. No browser, no smokes, no live verification — this is a static conformance read only, and §6 states exactly what that leaves unproven.
>
> **Scope:** the screens Run A touched — planner suite · Commission · sidebar/shell · ChampionsPanel · Master Sheet. This is **not** a full-app revalidation; the 2026-07-13 doc's findings for surfaces Run A did not touch stand unchanged.
>
> **Findings are RECORDED, not fixed.** Nothing in this document was actioned.

---

## 0 · Why this document exists

`docs/audits/design-conformance-2026-07-13.md` was the declared active build map, pinned to `origin/main` @ `b1f2e2e3` + `origin/staging` @ `01be5fd3` (Run 8 tip). Since that capture, **Run 9** (planner enhancements, promoted `d0e74c12`) and the whole of **Run A** (Tiers 1–3, PRs #865/#866/#870 plus fixes #867/#868/#869) have landed on `origin/staging`.

Run A materially rewrote three of the five surfaces below (`PlannerDesktopBoard` is net-new; `Sidebar`/`index.css` rail rules were fixed; `CommissionPlayground` gained the R-06 chips and the §4.7 daily chip). Their 07-13 citations are therefore stale by construction, and this pass re-derives them.

**This document is the successor to 2026-07-13 for the five surfaces it covers.** The 07-13 doc remains the active map for everything else and is preserved unedited.

---

## 1 · Summary buckets

| Class | Count | Meaning |
|---|---:|---|
| **CONFORMANT** | 9 | Verified against the addendum rule; no action. |
| **DELIBERATE-DIVERGENCE** | 2 | Divergence is required by another rule or documented in-source. Not a defect. |
| **SCOPED-OUT (documented)** | 2 | Mockup scene deliberately outside the built scope, self-documented in-source. Not a defect; a product decision to re-ratify. |
| **FINDING** | 4 | Genuine conformance gap. Recorded for a future build slice. |
| **UNVERIFIABLE (static pass)** | 3 | Cannot be settled without a browser/smoke. Named, not guessed. |

**Headline: 4 findings, all LOW–MEDIUM, none blocking.** The Run A surfaces are in materially better conformance shape than the pre-Run-A baseline — most notably the token layer is now **100% clean** across the entire touch-set.

---

## 2 · CONFORMANT (verified, no action)

| # | Rule | Surface | Evidence (`origin/staging`) |
|---|---|---|---|
| C1 | **Tokens — zero raw hex** | Entire Run A touch-set | `git grep -nE "#[0-9a-fA-F]{3,6}\b"` over `components/planner`, `CommissionPlayground`, `CommissionAnchorStrip.jsx`, `components/shell`, `ChampionsPanel.jsx`, `MasterSheet.jsx`, `utils/funnelStatus.js` → **0 matches** (tests excluded). The strongest single result in this pass. |
| C2 | §1 four-states | `planner/AgentPlannerPanel.jsx` | Header `:290-292` self-declares "four-states throughout; §4 dialogs on the book/churn sheets"; `PanelSkeleton` + `Retry` + `role="alert"` all present. |
| C3 | §1 four-states | `planner/manager/TeamPlannerPanel.jsx` | Same three primitives present. |
| C4 | §1 four-states | `dashboard/ChampionsPanel.jsx` | `:51-55` loading → `PanelSkeleton variant="list"`; `:74-75` honest empty ("No champions yet this week — check back once reports start coming in"), not "No data". Error is **delegated by design** — `:13-16` documents the shared `loading`/`error` gate living in the consuming `ManagerOverviewTab`. |
| C5 | §5 dense tables | `manager/MasterSheet.jsx` | 9× `tabular-nums`, 13× `sticky`; sticky header row + sticky first three lead columns with computed `left` offsets (`:719-721`, `:794-824`); live footer count `:836`. |
| C6 | §4 44px targets | `planner/AppointmentSheet.jsx` | 22 `min-h-[44px]`-class hits vs 13 `<button>` — comfortably over. |
| C7 | §4 44px targets | `CommissionPlayground/components/SavedScenarioChips.jsx` (R-06, #870) | 5 target-class hits vs 4 `<button>`; delete control carries `aria-label={\`Delete scenario ${s.label}\`}` (`:74`) — §4 icon-only-control rule satisfied. |
| C8 | §4 44px targets | `planner/PlannerDesktopBoard.jsx` (E1, net-new) | 3 target-class hits vs 3 `<button>` — 1:1. |
| C9 | §1 four-states N/A | `goals/CommissionPlayground/index.jsx` | Zero `useEffect` / service call / `await` — a **pure-compute playground**, not a data surface. The rule does not apply. *(Recorded explicitly because a naive grep flags this file as a four-states gap; it is a false positive.)* |

---

## 3 · DELIBERATE-DIVERGENCE (confirmed intact)

| # | Item | Why it is not a defect |
|---|---|---|
| D1 | `MasterSheet.jsx` uses inline `style={{ width }}` / `style={{ left }}` at ~14 sites (`:64,73,81,678,685,719-721,731,758,794,798,824,851`) despite CLAUDE.md's "NO inline styles". | Addendum §5 **requires** a sticky first column with `position:sticky; left:0`. The lead-column offsets are computed at runtime from `FUNNEL_LEAD_W`/`FUNNEL_LEAD_LEFT`; Tailwind cannot express a derived pixel offset. This is dense-table geometry, not styling. Same reasoning covers `AppointmentSheet.jsx:763` (`width`/`height` from a `size` prop). |
| D2 | `CommissionPlayground/components/CashFlowChart.jsx:103` inline `style={{ background: MODE_COLORS[mode] }}`. | `MODE_COLORS` (`:9-14`) resolves to `var(--color-primary)` / `var(--color-gold)` — **canonical tokens, not literals**. Recharts takes `fill` as a value prop, so a CSS class is not available at that boundary. Token discipline is intact. |

---

## 4 · SCOPED-OUT (documented product decisions, not defects)

The Planner v2 mockup (`design_handoff_v2_app/mockups/AgencyTrack Planner & Scheduler v2.html`) declares **9 scenes**. `AgentPlannerPanel.jsx:290-291` self-documents the built scope as *"handoff screens 1-9, **scoped to Today / Week / Follow-ups + the plan→actual handoff**"*. Two starred scenes fall outside that scope:

| # | Mockup scene | Build state |
|---|---|---|
| S1 | **6 · Freed-slot suggested fill** ⭐ (daily-churn flow) | `git grep -lni "freed\|suggestedFill\|fillSlot\|freeSlot"` over `components/planner` + `services` → **0 files**. Unbuilt. One of the mockup's two starred daily-churn scenes; the other (5 · Status churn) **is** built. |
| S2 | **8 · Prep card** | No `prepCard` / `NextCall` reference inside `components/planner`. `prospect/NextCallHero.jsx` exists but sits on the Prospect Prep surface and is not wired into the planner. |

**Verified built:** scene 3 (`PlannerDesktopBoard`, E1 Day/3-day/Week toggle) · scene 4 (`AppointmentSheet`) · scene 5 (churn sheet) · scene 7 (`followupsList`, 13 refs in `AgentPlannerPanel`) · scene 9 (`DailyCaptureV2.jsx:47,586` — `blankFillSeed` cites *"Planner handoff seed (item 3.2 screen 9)"* by name).

These are recorded as **decisions to re-ratify**, not gaps to close silently. The mockup's own intro card also states *"Every screen in light + dark, with empty / loading / error states"* — the four-states half is satisfied (C2); light+dark parity is **UNVERIFIABLE** in a static pass (see U1).

---

## 5 · FINDINGS (recorded, not fixed)

| # | Sev | Rule | Surface | Finding | Evidence |
|---|---|---|---|---|---|
| **F1** | **MEDIUM** | §1 "Error → a persistent inline card **with Retry**" | `manager/MasterSheet.jsx` | The error state renders an inline card but ships **no Retry affordance** — the agent/manager must reload the page to recover from a failed load. Loading (`:754`), actionable empty (`:765-773`) and footer count (`:836`) are all correct; only the error arm is incomplete. | `:657-658` — `{error && (<div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>)}`. No button, no `onRetry`. Contrast with the compliant idiom at `gamification/Leaderboard.jsx` (`retryKey`). |
| **F2** | **LOW** | CLAUDE.md "NO inline styles" | `shell/Sidebar.jsx` | Genuine **static** inline styling on the brand mark — not derived geometry, so D1's carve-out does not apply. Should be Tailwind utilities (`block rounded-[7px] shrink-0`). | `:391` — `style={{ display: 'block', borderRadius: 7, flexShrink: 0 }}` on the `<img src="/icons.svg">`. |
| **F3** | **LOW** | §2 "Timing tokens `--dur-1/2/3`" | `MasterSheet.jsx`, `PlannerDesktopBoard.jsx` | Three sites use bare `transition-all` with **no duration token**, so they inherit Tailwind's default 150ms rather than the Nexus scale. Cosmetically invisible today; it is a drift vector the moment the tokens are retuned. | `MasterSheet.jsx:565` (filter toggle knob), `MasterSheet.jsx:810` (row-action button), `PlannerDesktopBoard.jsx:140`. |
| **F4** | **LOW** | §4 44px targets | `planner/RunningLateSheet.jsx` (E3, net-new) | 7 `<button>` vs only **4** target-class hits — the lowest ratio in the Run A touch-set, and the only net-new Run A component where buttons outnumber sized targets. The push presets (+10/+20/+30) and the what-moves radios are the likely shortfall. | `git show origin/staging:…/RunningLateSheet.jsx` → `grep -c '<button>'`=7, `grep -cE 'min-h-\[44px\]\|min-h-11\|h-11\|touch-target'`=4. Which specific controls are undersized is **not** established by the count alone — see U3. |

---

## 6 · UNVERIFIABLE in a static pass (named, not guessed)

| # | Item | Why it cannot be settled here | What would settle it |
|---|---|---|---|
| **U1** | Light + dark parity across the Run A surfaces (the planner mockup explicitly demands it). | Token-cleanliness (C1) is *necessary but not sufficient* — a component can be 100% tokenised and still pick the wrong token for dark. | Both-themes preview smoke + axe, per the standing §2 screenshot review. |
| **U2** | Whether `SavedScenarioChips`' write path surfaces a failure to the agent. | The chips component has an `aria-label` and target sizing, but the `prefs/app` merge-write happens in the parent/service; I did not trace the error propagation. Claiming either way would be a guess. | Read `userPrefsService` + the R-06 call site, or run `smoke-r06-scenario-chips.mjs`. |
| **U3** | F4's exact undersized controls in `RunningLateSheet`. | A grep count proves a *ratio*, not which buttons are small. Some hits may cover multiple buttons via a shared class constant. | Read the component's render path, or an axe target-size pass. |

---

## 7 · Cross-reference — what this pass CLOSES from prior docs

| Prior claim | Disposition now |
|---|---|
| 2026-07-13 §4 STILL-VALID motion/four-states items on planner surfaces | **Superseded** — the planner suite was rewritten in Run A Tier 2; C2/C3 re-verify four-states against the new code, not the old citations. |
| Run A Tier 3c item 2, "motion pop-in wiring" (LOW) | **Partially informed** — F3 gives it three concrete, cited sites to start from rather than a general instruction. |
| Run A Tier 3c item 4, "gold-contrast usage fixes" (LOW) | **No new instances** in the Run A touch-set: C1 found zero raw hex and D2 confirms the only gold usage here resolves through `--color-gold`. The FU's remaining scope lies outside these five surfaces. |

---

## 8 · Self-critique (Rule 22)

1. **This is a five-surface pass, not an app-wide revalidation.** The headline "4 findings" must never be read as "the app has 4 conformance gaps." Surfaces Run A did not touch were not re-examined at all.
2. **Mockup-vs-component structural diffing was done at scene-inventory granularity only** — I enumerated the Planner mockup's 9 `DCSection` scenes and checked each for a built counterpart. I did **not** diff layout, hierarchy, or copy within a scene that exists. A scene can be "built" per §4 and still diverge substantially in composition.
3. **Only the Planner mockup was scene-inventoried.** Commission, Master Sheet, sidebar/shell and ChampionsPanel were audited against the **addendum rules** (tokens/states/targets/motion/tables) but not against their own mockups' scene lists. That asymmetry is a real coverage gap in this pass.
4. **Grep-count evidence for 44px (C6/C7/C8/F4) is a proxy, not a proof.** It cannot see targets sized via a shared constant, a parent class, or CSS. F4 is flagged as a *signal to investigate*, and U3 says so.
5. **`git grep` for raw hex (C1) does not catch hex reaching the DOM at runtime** — via a service response, a config value, or a computed string. It proves source cleanliness only.
6. **No live verification of any kind.** Per the brief this was code-level only; every claim about rendered output is an inference from source.
