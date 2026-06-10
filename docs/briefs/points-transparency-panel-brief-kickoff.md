# Brief — Activity points transparency panel (PR2)

**Suggested branch:** `feat/points-transparency-panel`
**Size:** M
**Type:** Frontend-only. Human-merged + pre-review (new UI surface). **No CF, no deploy** — Vercel auto-deploys on merge. Reads `src/lib/gamificationConfig.js`.
**PREREQUISITE:** PR #556 + #558 merged and deployed — the config (POINTS_WEIGHTS 21 keys, LEVEL_THRESHOLDS, BADGE_DEFINITIONS, UNSCORED_FIELDS) is populated, cross-checked, and live.

---

## Context

PR1/1.5 made the gamification config the single source of truth, all values verified in production. This PR makes the system transparent to agents: a "how points work" panel on the leaderboard that renders the config. No new logic — a pure render. It also closes the existing blind spots: levels are server-only (an agent sees "Associate" but not that Pro is 1,500), and badge keys are never decoded to readable labels.

## Goal

An info-icon (ⓘ) on the in-app gamification leaderboard (`Leaderboard.jsx`) opens a panel showing, all read from `gamificationConfig`:
1. How points are earned — the weights, grouped by funnel stage.
2. Levels — thresholds + titles.
3. Badges — decoded labels + descriptions.

## Design system (mandatory)

The panel must look native to AgencyTrack. **Read `/mnt/skills/public/frontend-design/SKILL.md` first**, then follow the project's Nexus doctrine: CSS-var tokens only (no hardcoded hex), Satoshi/Cabinet Grotesk, Lucide React icons, 44px touch targets, dark-mode aware. Reuse the app's existing modal/drawer component (Phase 1 identifies it) — do not introduce a new modal pattern.

---

## Phase 1 — recon (HARD STOP — paste findings before Phase 2)

1. **Mount point.** `Leaderboard.jsx` structure — where the info-icon belongs, and the app's existing modal/drawer pattern to reuse. Is `Leaderboard.jsx` a themeable surface (light/dark) or a presentation/always-dark surface? (Determines which token set.)
2. **Config key structure.** The exact `POINTS_WEIGHTS` keys — confirm whether dials is one key applied to a summed set of 4 call types (vs per-call-type keys), and how `otherNewNames` is keyed (it's a composite per the PR1.5 ruling). This drives how the panel groups lines.
3. **Config exports.** Confirm the ESM shapes of `LEVEL_THRESHOLDS`, `BADGE_DEFINITIONS` (label + description present per PR1.5), and `UNSCORED_FIELDS`.
4. **Kiosk panels.** Do `ActivityLeaderboard.jsx` / `MTDLeaderboardsPanel.jsx` / `PeriodLeaderboardsPanel.jsx` warrant the same info-icon, or is in-app `Leaderboard.jsx` the sole v1 mount? Recommend in-app only for v1 (kiosks are passive displays) unless trivial.

---

## Phase 2 — build

1. Info-icon on `Leaderboard.jsx` opening the panel via the app's modal/drawer pattern.
2. **Earning points**, grouped by funnel stage (a frontend display-map provides each config key's friendly label + group + note):
   - **Prospect & connect:** phone dials, face-to-face attempt, letter/email sent (note "up to 20/week"), new referral, other new name, seminar conducted, tradeshow attended
   - **Advance:** appointment set, fact-finding interview, closing interview
   - **Close:** application sold, API written (note "per TTD 1,000")
   - **Deliver & service:** policy delivered, service call, premium collection meeting, annual review, orphan review, orphan adopted, reinstated application, reinstated API (note "per TTD 1,000"), policy change
   - Render **every** `POINTS_WEIGHTS` key — the display-map is the friendly layer, but no key may be silently omitted.
3. **Levels:** the ladder from `LEVEL_THRESHOLDS` (Rookie 0 → Legend 7,000).
4. **Badges:** from `BADGE_DEFINITIONS` — decoded label + description per badge.
5. Optional light "not scored" note for the deliberate exclusions (withdrawals/surrenders) from `UNSCORED_FIELDS`, so agents understand servicing-exits don't earn points. Keep it minimal — the panel is about how to earn.
6. **Copy:** describe the current cumulative model honestly ("points build up over time toward levels"). This is the one spot to revisit if the ranking model later changes to rolling — flag it inline in the code with a short comment tied to the banked reset-model FU.

---

## Phase 3 — verify

1. **Drift-guard test:** assert every `POINTS_WEIGHTS` key has a display-map entry (label + group). Adding a weight without a label must fail this test — so the panel can never silently drop a scored activity.
2. **Frontend smoke** (preview, pre-merge OK — no CF dependency): log in (smoke agent) → open the leaderboard → click the info-icon → assert the panel renders known config values (e.g. "Application sold" → 25, a level title + threshold, a decoded badge label). Both themes if the surface is themeable.
3. Lint + Vitest + build green.

---

## Phase 4 — docs (with placeholders)

1. Note the panel ships and closes the levels/badges visibility gap.
2. Record the cumulative-copy caveat — the one surface that needs a word changed if the reset-model decision flips to rolling.
3. Bank the weekly **"you earned N points this week"** summary as the next surface — it's a separate build (needs frontend points computation or a post-submission leaderboard-delta read) and a different surface (submission/dashboard, not the leaderboard). It's the weekly pride-moment half of the original goal; the panel is the reference half.
4. SHA placeholders to fill at Phase 5.

---

## Phase 5 — commit / push / PR

Commit on `feat/points-transparency-panel`, push, open PR. **Human-merge + pre-review** (new UI surface — not the auto-merge track). HEAD SHA in report (Rule 20); poll + disposition every Gemini comment (Rule 21).

---

## Boundary

- Frontend-only — no config change, no CF, no deploy. If the panel needs a grouping or note the config can't express, the frontend display-map handles it; do not modify the config.
- No reset-model change; no weekly-summary surface (banked).
- If Phase 1 finds `Leaderboard.jsx` is an always-dark presentation surface, the panel uses the presentation tokens and a themed smoke isn't needed — report and proceed accordingly.
