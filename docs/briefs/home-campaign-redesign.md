# Brief — Home + Campaign redesign (mobile and desktop)

> Two PRs, in order. **R1 (Home):** Opus 5.5, effort high. **R2 (Campaign):** Sonnet 5, effort high. R2 starts after R1 merges.
> Client-only (Vercel). No rules, no functions, no data writes. Can run in parallel with the Phase 2 P2a functions PR.

## Design source
**Landing:** commit the four mockup files in `docs/design-system/proposals/home-campaign-2026-09/` (untracked on `C:\Projects\AgencyTrack`) together with this brief, so the executor can read them.

Approved mockups, 26 Sep 2026: `docs/design-system/proposals/home-campaign-2026-09/`
- `C1-Home.dc.html` — Home, mobile 390 px
- `C3-Home-Desktop.dc.html` — Home, desktop 1440 px
- `C2-Campaign.dc.html` — Campaign, mobile
- `C4-Campaign-Desktop.dc.html` — Campaign, desktop

They are Design-canvas files (inline styles, stand-in fonts Figtree / Bricolage Grotesque). Read them for **layout, order, copy and hierarchy only**. Build with the app's rules: Tailwind + Nexus v2 tokens (`docs/design-system/tokens/app.css`, `guidelines/redesign-addendum.md`), Satoshi + Cabinet Grotesk, **no inline styles** (SVG geometry attributes are fine), 44 px touch targets, every block handles loading / error / empty, light **and** dark theme. Gold is for campaign/recognition only.

Sample figures in the mockups ("This week" tiles, "Do next" copy) are placeholders. Every number in the build comes from real data or is hidden.

## Decision that shapes this (26 Sep 2026, Kyron — BUG-01 option B)
Agent-declared settled policies keep counting in heroes, campaigns and awards. Show provenance instead: "[n] from head office · [n] self-confirmed". Head office = `statusSource === 'oipa_import'`; everything else settled = self-confirmed. The branch manager no longer confirms; agents own confirming settled status, policy details and persistency.

---

## R1 — Home (mobile + desktop)

Files you will touch (find by name if lines moved): `src/components/dashboard/HomeV2/index.jsx`, `HomeV2/HeroCard.jsx`, `src/components/campaigns/CampaignHeroCard.jsx` (compact variant only), `src/components/dashboard/GoalDonut.jsx` (reuse or extend), the mobile page header that renders above HomeV2.

### Order (both breakpoints)
1. **Header (mobile):** one 56 px bar — avatar, "Home", a one-line mono date ("SAT 26 SEP · WEEK 39"), notifications button. Replace today's tall header. Desktop keeps the sidebar; the page header is title + date + notifications + "Submit weekly report" primary button (top right).
2. **Hero:** one donut + one big number.
   - Donut = settled API ÷ goal (personal annual API goal if set, else MDRT, as `HeroCard` does today). Centre label "13%" + "OF MDRT" or "OF GOAL". If goal > MDRT, draw the MDRT point as a tick on the ring.
   - Big number = settled API from `deriveYearProduction` (whole TTD on the hero; full value in `aria-label`).
   - Sub-line: "of <goal> <MDRT|goal> · <n> weeks to year-end".
   - Row of 3: Settled apps · Submitted API · Submitted apps. Keep the "Dated by issue" marker.
   - Provenance line (decision B above).
   - Keep `LedgerReconciliationNote` behaviour (mismatch flag vs weekly report).
   - Mobile: full-width "Submit weekly report" button inside the hero. Desktop: button moves to the page header.
3. **Campaign card (compact):** for the active campaign the agent is in (same selection as today). Title, days left chip, "Next tier: <tier> · TTD <cash>". Three donuts: **API** (current / next-tier target), **Applications** (current / target), **Persistency** (value vs gate, gate drawn as a tick at the threshold; warning tone when below gate). Pace line "TTD <x> + <a–b> apps / week" = remaining ÷ weeks left to `campaign.endDate`. "Details" → the Campaign screen (R2). No active campaign → hide the card (no empty shell).
4. **Do next:** up to 3 items, each built only from real data, each a real link, hidden when not applicable:
   - "Confirm settled policies — <n> waiting" → Policy Ledger filtered to settled, not head-office, not yet confirmed. (Link only; the agent self-confirm action itself is P2d.)
   - "Win back a lapsed policy — TTD <x> reinstated clears the <g>% gate" → Persistency. `<x>` = `gap.reinstateNeeded` from `src/lib/persistency/persistencyOutlook.js`. Hide when at or above the gate.
   - Behind on the weekly activity standard → the first unmet row of `WEEKLY_ACTIVITY_FLOOR_ROWS` ("Log <n> more <activity> to meet this week's standard") → Daily log.
   - None apply → one line "You're on track this week." (no empty card).
5. **This week:** 4 tiles from the weekly activity standard the Home already computes (`StandardDetail` / `WEEKLY_ACTIVITY_FLOOR_ROWS`): label, done / target, bar. Use the 4 rows that matter most to Kyron's flow: calls, FFIs, CIs, applications — map to the real floor keys; if a key does not exist, show the rows that do (max 4).
6. Keep below these, unchanged: `FilingStreakCelebration`, `RecentCompact`. `PulseStrip` — remove from Home; its Awards / Persistency / Standard / Action chips are now covered by blocks 3–5. Keep the component file (other surfaces may use it; check).

### Desktop layout (≥ 1024 px)
12-column grid, 20 px gap: Hero (7) + Campaign (5); then Do next (7) + This week (5, tiles 2×2). Mobile (< 1024 px): single column in the order above.

### Donut component
One shared `ProgressDonut` (extend `GoalDonut` or add beside it): props `value`, `max`, `tone` (`teal` | `warning` | `onHero`), optional `tick` (0–1), `centerLabel`, `subLabel`, `ariaLabel`. `role="img"`. Respect `prefers-reduced-motion` for the fill animation.

### Tests
- `ProgressDonut`: arc length, tick position, clamp at 100%, aria-label.
- Hero: goal vs MDRT label, provenance counts (fixture: 3 `oipa_import` + 2 manual settled → "3 from head office · 2 self-confirmed").
- Campaign card: pace maths (fixture: 73,946 of 275,000 with 96 days left → 14.7K a week), hidden when no active campaign, persistency below gate → warning tone.
- Do next: each item appears/hides on its condition; "You're on track" when none.
- Loading / error / empty for every block.

### Deliverables (R1)
1. One PR. `npm test`, lint, build pass — paste counts.
2. **Preview smoke walk** on the Vercel preview, read-only, logged in as the A11Y test agent: Home at 390×844 and 1440×900, light and dark → 4 screenshots in the PR. No client names or policy numbers in committed screenshots.
3. Side-by-side note in the PR: each mockup block → the component that renders it.
4. Post-merge: `/post-merge <PR>` as usual.

---

## R2 — Campaign screen (mobile + desktop)

Where: the agent Awards tab campaign view (`src/components/awards/AgentAwardsPanel.jsx` → `CampaignHeroCard`), opened from Home's "Details". Reuse R1's `ProgressDonut`.

### Blocks (mobile order; desktop = left 8 cols: 1–3, right 4 cols: 4–5)
1. **Progress:** three donut rows (mobile) / three donut cards (desktop): API, Applications, Persistency — value, "of <target>", "<x> to go". Persistency row: gate tick + "need <g>% in <gate month>".
2. **What it takes:** three plain lines — API per week, apps per week (remaining ÷ weeks left), and "TTD <reinstateNeeded> of lapsed premium reinstated lifts persistency to <g>%" (hide that line when at or above the gate).
3. **Persistency gate:** bar from 80% to 95% with the gate tick and the projected value; the month history row — last derived month ("From HO · Confirm", confirm only for 24-month-model months, as today), current month "Estimate", gate month "Projected". Reuse the existing derived/estimate/confirm logic from #971 — do not recompute.
4. **Tier ladder:** every tier of the campaign, highest first; next tier highlighted (gold tint, "NEXT TIER"); "You" row with API · apps and "% of the way to <next tier>". Cash values from the campaign config.
5. **What if:** a slider (TTD 5K–40K per week, step 1K, `<input type="range">` with a `<label>`) → "You reach <next tier> around <date>" and the tier after it, or "not reached by <end date> at this pace". API only; show the reminder that apps and persistency still apply. Pure client maths; no writes.
6. Footer: "An indication only. Executive Business Development decides."

### Tests
Pace and what-if date maths (fixture above: 20K a week → Champion ~6 Dec), tier highlighting, hidden reinstate line at/above gate, loading/error/empty.

### Deliverables (R2)
Same as R1: one PR, test/lint/build counts, preview smoke walk with 4 screenshots (Campaign at 390 and 1440, light and dark), block-to-component map, `/post-merge <PR>`.

## Out of scope
Agent self-confirm write path and its rules (P2d). Manager dashboards. Any Firestore rules or functions change. New fonts.
