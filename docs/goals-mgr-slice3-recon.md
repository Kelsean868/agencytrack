# Goals Manager — Slice 3 Recon

**Date:** 2026-06-14
**Type:** Recon-only — no build
**Scope:** Map what's reusable vs net-new for the next goals manager iteration

---

## 1. What is already built

| Surface | File | Notes |
|---------|------|-------|
| Manager goal-setting UI (unit/branch tiers) | `src/components/manager/GoalsPanel.jsx` | UnitGoalsTab, BranchGoalsTab, agent sub-tab |
| Recommend/lock drawer | `src/components/goals/RecommendLockDrawer.jsx` | PR #618 — sets `targetLocked` on agent goals row |
| Inline `LockToggle` component | `GoalsPanel.jsx:158-185` | Used at lines 318, 417, 528; NOT shared with RecommendLockDrawer |
| Inline `LockedBadge` component | `GoalsPanel.jsx:138-156` | Shows "Locked" / "Suggested" chip on agent row header |
| `RecommendLockDrawer` recommend/lock toggle | `RecommendLockDrawer.jsx:133-157` | Separate inline duplicate of the same UI concept |
| Agent gap analysis | `src/components/goals/GapAnalysisPanel.jsx` | CommitmentHero + OrgContextStrip + FloorRow + GapNote |
| Agent "Save as My Goals" CTA | `GoalDecompositionTab.jsx` | Already wired to `setGoals(personalAnnualAPI + personalAnnualApps)` |
| Nudge CF (extensible) | `functions/compliance/sendComplianceNudge.js` | `NUDGE_CONFIG` dict — ships `compliance.filing.nudge` + `compliance.plan.nudge` |
| Nudge client service | `src/services/nudgeService.js` | Calls CF with `{ type, audienceUids, weekStart }` |
| Nudge cooldown record | `nudges/{audienceUid}_{type}_{weekStart}` | SET-MERGE deterministic dedupe |
| Bell notification schema | `notifications/{autoId}` | Standard `{ userId, title, body, link, read, createdAt }` |
| Audit nudge record | `auditNudges/{autoId}` | Admin-only append |
| Email templates (compliance nudges) | `functions/email-templates/compliance-*.txt/.html` | Pattern to replicate for goals nudge |

---

## 2. Key gaps

### 2a. LockToggle DRY extraction (MECHANICAL — AUTO-MERGE eligible)

`GoalsPanel.jsx` defines `LockToggle` inline (lines 158–185). `RecommendLockDrawer.jsx`
has a near-duplicate inline recommend/lock toggle (not using `LockToggle`). The two are
semantically identical (Recommend=false / Lock=true toggle) but have diverged slightly
in className.

**Fix shape:**
- Extract to `src/components/goals/LockToggle.jsx` as a shared primitive.
- Update both `GoalsPanel.jsx` and `RecommendLockDrawer.jsx` to import from the shared file.
- No behavior change; all existing tests pass by construction (no API surface change).
- RTL tests for the shared component add confidence.

**Classification:** Mechanical DRY extraction. Zero behavior change. AUTO-MERGE eligible
once lint + tests + build green.

### 2b. LockedBadge legacy-default question (HOLD — product call)

`LockedBadge` renders `null` when `locked` is `undefined`/absent (GoalsPanel:139-155).
The question: when a manager has set a target but `targetLocked` was written before the
Slice 2 recommend/lock model, should the badge show "Suggested" (treating undefined as
`false`) or nothing (current `null`)?

Currently `LockedBadge` is rendered only when `hasManagerTarget` is true. Legacy targets
(pre-Slice-2) have no `targetLocked` field → `locked === undefined` → badge is hidden.

**Decision needed:** should legacy targets default to "Suggested" or show no badge?
**Hold until Kyron confirms.** Do NOT implement either way without explicit dispatcher call.

### 2c. Manager personalAPI suggestion nudge (BUILD-AND-HOLD — CF extension)

The highest-value v3 feature: a manager can nudge an agent with a suggested
`personalAnnualAPI` value directly from the GoalsPanel agent tab. The agent gets a bell
notification + email with the TTD-formatted figure. The agent acts via the existing
GoalDecompositionTab "Save as My Goals" CTA.

**This is distinct from `unitGoals`/`branchGoals`** — it targets the agent's personal
commitment layer (`goals/{agentId}.personalAnnualAPI`) as a non-binding suggestion.

---

## 3. Reusable vs net-new for 2c

### Reusable (zero changes needed)

| Component | Why it's already sufficient |
|-----------|----------------------------|
| `sendComplianceNudge` CF | Add one entry to `NUDGE_CONFIG`; all scope/auth/batch logic is unchanged |
| `nudgeService.js` | Call with `type: 'goals.suggest.api'` + optional `payload: { suggestedAPI }` |
| Cooldown record (`nudges/`) | Same deterministic-ID pattern; `_goals.suggest.api_` in the key |
| Bell notification schema | Same shape; body carries formatted TTD value |
| `auditNudges` | Same Admin-only append pattern |
| GoalDecompositionTab CTA | Agent already has "Save as My Goals" — receiving end is complete |
| `firestore.rules` nudges block | Already allows any `type`; `goals.suggest.api` requires no rule change |

### Net-new

| Surface | What's needed |
|---------|--------------|
| `NUDGE_CONFIG['goals.suggest.api']` | One new config entry in `sendComplianceNudge.js` |
| `functions/email-templates/goals-suggest-api.txt` | New email template (mirrors compliance-plan-nudge.txt shape) |
| `functions/email-templates/goals-suggest-api.html` | New email template (HTML pair) |
| "Suggest API" row action in GoalsPanel agent tab | Button in the agent row action set (alongside "Set target") |
| `src/services/nudgeService.js` update | Optional: add `suggestGoalsAPI(tenantId, uid, suggestedAPI, weekStart)` convenience wrapper |
| Cooldown chip on GoalsPanel agent row | Same chip pattern as CompliancePanel (reuse `nudgeService.getCooldownStatus`) |
| CF functions test update | Add test case for `goals.suggest.api` type validation |

---

## 4. Open questions for dispatcher

1. **2b LockedBadge default**: undefined → "Suggested" or nothing?
2. **Nudge entry point**: from GoalsPanel agent row only, or also from GoalDecompositionTab manager view?
3. **Pre-fill on click?** Should the notification bell link carry the suggestedAPI value and pre-fill the GoalDecompositionTab input, or just inform the agent of the value and leave the fill manual?
4. **cooldown window**: same 24-hour cooldown as compliance nudges, or different?
5. **Multi-agent suggest?** Single-agent only (one at a time from agent row), or also a "Suggest API target to all" for agents without a personal commitment?

---

## 5. Implementation order (once product calls are resolved)

1. **2a LockToggle DRY extraction** — mechanical, can ship first as XS PR, AUTO-MERGE eligible.
2. **2c goals.suggest.api nudge** — CF extension + GoalsPanel entry point + email templates. BUILD-AND-HOLD (touches CF).
3. **2b LockedBadge default** — follow dispatcher decision.

---

## 6. Self-critique (Rule 22)

- `nudgeService.getCooldownStatus` existence and signature was NOT verified — Phase 1 must grep before assuming the function exists as named.
- `firestore.rules` nudges block type-checking was not read — Phase 1 must confirm `allow read` for `goals.suggest.api` type is covered by the existing rule shape (likely yes, since the rules don't filter by type, but verify).
- GoalDecompositionTab "Save as My Goals" CTA wire-in (whether it can accept a pre-filled value) was NOT read — Phase 1 must check if the CTA reads from props or internal state only.
