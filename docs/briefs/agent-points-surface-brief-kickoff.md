# Brief — Agent points surface + transparency panel

**Suggested branch:** `feat/agent-points-surface`
**Size:** M
**Type:** Frontend-only. Human-merged + pre-review (new UI). **No CF, no deploy** — reads existing `leaderboard/{uid}` + `src/lib/gamificationConfig.js`; Vercel auto-deploys on merge.
**Supersedes:** `docs/briefs/points-transparency-panel-kickoff.md` (panel-only premise — agents can't reach `Leaderboard.jsx`). Abandon `feat/points-transparency-panel`; start fresh on this branch.

---

## Context

The gamification points system (the 20-activity scale, levels, badges — PR #556/#558, all live) computes server-side on every submission and surfaces to **admins only**. Recon confirmed agents see their points / level / streak / badges **nowhere** post-Track-J: `Leaderboard.jsx` is admin-only, CareerPortal shows the *production* ladder, BadgeGrid uses a local constant, the HomeV2 streak is an activity streak not the gamification one. The scale we built for agent motivation never reaches agents. This PR closes that: a personal view of their own gamification stats + an explainer.

**Already confirmed (do NOT re-recon):**
- `Leaderboard.jsx` has an agent arm that renders own points + level (StatusPill) + streak — reusable. The rank/ranking-list is the competitive bit to **drop**.
- Config exports: `LEVEL_THRESHOLDS` ({level, threshold, title} ×5), `BADGE_DEFINITIONS` ({key, label, description, trigger} ×9, label+desc present), `UNSCORED_FIELDS` ({key, reason} ×5). `dials` and `otherNewNames` are composite weight keys → panel shows each as one abstracted line.
- Modal shell pattern: `ReportRangeModal.jsx` (`fixed inset-0 z-50 … bg-surface-raised rounded-2xl … X` close) — reuse but **widen past max-w-sm** (panel has a points table + badge grid; use max-w-lg or wider). Surface is fully themeable → both themes.

## Goal

1. **My Points surface** — a personal card on the agent home showing the agent's own level (StatusPill), points total, streak, and badges. **Personal progression only — no competitive ranking.**
2. **Transparency panel** — an info-icon (ⓘ) on that card opens a "how points work" panel rendering `gamificationConfig`: earning rules grouped by funnel stage, the level ladder, decoded badges.

## Design (mandatory)

Read `/mnt/skills/public/frontend-design/SKILL.md` first, then follow Nexus: CSS-var tokens only (no hardcoded hex), Satoshi/Cabinet Grotesk, Lucide icons, 44px touch targets, dark-mode aware, both themes. Reuse `StatusPill` for the level. Reuse the `ReportRangeModal` shell (widened) for the panel.

---

## Phase 1 — recon (HARD STOP — light; most is confirmed above)

1. **Mount.** HomeV2 (`HomeV2/index.jsx`) card structure + best insertion point for the My Points card. Recommended surface is HomeV2 (agent landing, card-based, keeps gamification level visually distinct from the production career ladder). **Flag if CareerPortal is clearly the better home** (it already holds progression + BadgeGrid) — but note the risk of conflating two parallel level systems on one screen.
2. **Extraction.** The exact agent-arm rendering in `Leaderboard.jsx` (own points / level StatusPill / streak) to extract into a reusable component. Confirm what's read from `leaderboard/{uid}` (points, levelTitle, streak, badge keys). **Drop the rank.**
3. **Badges.** `BadgeGrid.jsx`'s local `BADGES` constant vs `gamificationConfig.BADGE_DEFINITIONS` — same badges, or production-vs-gamification? Does the My Points surface showing config badges create a confusing overlap with CareerPortal's BadgeGrid? (Determines whether badge-source reconciliation is needed now or banked.)

Report findings + proposed mount before Phase 2.

---

## Phase 2 — build

**My Points card:**
1. Extract the agent-arm rendering (own points + level StatusPill + streak, **no rank**) into a reusable component; mount on the recommended surface.
2. Read `leaderboard/{uid}` for the agent's own points / levelTitle / streak / earned badge keys.
3. Badges: decode the agent's earned badge keys via `BADGE_DEFINITIONS` (label). Handle empty state (no badges yet) gracefully.
4. Handle loading / error / empty states (no leaderboard doc yet = a clean "start logging activity to earn points" empty state, not a crash).

**Transparency panel (info-icon → modal):**
5. **Earning points**, grouped by funnel stage (a frontend display-map gives each `POINTS_WEIGHTS` key a friendly label + group + note):
   - Prospect & connect: phone dials, face-to-face attempt, letter/email sent (note "up to 20/week"), new referral, other new name, seminar conducted, tradeshow attended
   - Advance: appointment set, fact-finding interview, closing interview
   - Close: application sold, API written (note "per TTD 1,000")
   - Deliver & service: policy delivered, service call, premium collection meeting, annual review, orphan review, orphan adopted, reinstated application, reinstated API (note "per TTD 1,000"), policy change
   - Render **every** `POINTS_WEIGHTS` key.
6. **Levels:** the ladder from `LEVEL_THRESHOLDS` (Rookie 0 → Legend 7,000).
7. **Badges:** decoded label + description from `BADGE_DEFINITIONS`.
8. Optional light "not scored" note for the deliberate exclusions (withdrawals/surrenders) from `UNSCORED_FIELDS`. Keep minimal.
9. **Copy:** personal progression — earn points → level up → unlock badges. Describe the current cumulative model honestly ("points build up over time toward levels"). Inline code comment flags this as the one spot to revisit if the reset-model decision flips to rolling.

---

## Phase 3 — verify

1. **Drift-guard test:** every `POINTS_WEIGHTS` key has a display-map entry (label + group). Adding a weight without a label must fail — the panel can never silently drop a scored activity.
2. **Frontend smoke** (preview, pre-merge OK — no CF dependency): log in (smoke agent) → agent home → assert the My Points card renders the agent's level + points → click the info-icon → assert the panel renders known config values (e.g. "Application sold" → 25, a level title + threshold, a decoded badge label). Both themes.
3. Lint + Vitest + build green.

---

## Phase 4 — docs (with placeholders)

1. Note the surface + panel ship — agents now see and can understand their own points/level/badges for the first time post-Track-J.
2. Record the cumulative-copy caveat (the one surface to change if the reset-model flips).
3. If Phase 1 found a badge-source overlap worth unifying, bank **BadgeGrid → gamificationConfig reconciliation** as a follow-up (don't bundle here unless trivial).
4. Bank the weekly **"you earned N points this week"** summary as the next PR — now the natural completion: agents have a home to see points, the weekly summary makes it a per-submission moment.
5. SHA placeholders for Phase 5.

---

## Phase 5 — commit / push / PR

Commit on `feat/agent-points-surface`, push, open PR. **Human-merge + pre-review** (new UI — not the auto-merge track). HEAD SHA in report (Rule 20); poll + disposition every Gemini comment (Rule 21). Smoke pre-merge on preview.

---

## Boundary

- Frontend-only — no CF, no new data, no deploy. Reads existing `leaderboard/{uid}` + `gamificationConfig`.
- **No competitive ranking** on the My Points surface — personal progression only (the deliberate distinction from the production leaderboard).
- Do not migrate BadgeGrid in this PR unless Phase 1 shows it's trivial and necessary to avoid a visible contradiction — otherwise bank it.
- No reset-model change; no weekly-summary surface (banked).
