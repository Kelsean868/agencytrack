# AgencyTrack — Webapp UX Audit Follow-Up + Design Verdict

**Date:** 2026-07-04
**Target:** Production — `https://portal.agencytrack.app`
**Scope:** AUDIT-ONLY follow-up to [`docs/audits/ux/agencytrack-ux-audit-2026-07-04.md`](../ux/agencytrack-ux-audit-2026-07-04.md). Closes that audit's three gaps: (1) the never-walked flows (Meeting Mode, multi-step wizard end-to-end, daily-capture entry/save), (2) the keyboard/modal focus-order pass, (3) the design-quality verdict. Also curates the Claude Design handoff set (`cd-handoff/`).
**Method:** Same credential-hygiene harness as the prior run — Node + Playwright, credentials read from `.env.local` → `process.env` only, never in a tool parameter; no credential values appear in any artifact. Desktop 1440×900 + mobile 390×844, light + dark where applicable. Writes were confined to the A11Y test agent and are listed in §5 (Cleanup register).
**Numbering:** new findings use the `-1xx` series to avoid collision with the prior report's `-00x` IDs.

---

## 1. Part 1 — Flow-walk findings (wizard, daily capture, meeting mode)

### BUG-101 — Wizard step screen is typable before the draft check resolves; in-flight input is silently clobbered or discarded
- **Severity:** High · **Category:** Bug / data integrity · **Confidence:** Confirmed (two independent probes + root-caused in source).
- **Evidence:**
  - Probe A (this week): typed `5` into "Prospecting Letters Sent" (value visibly committed — input read back `"5"`), pressed Next then Back ~2s later — value gone (`""` = 0). Probe log in session; step shown in `agent-wizard-step-01-letters-outreach-desktop-light.png`.
  - Probe B (a previously-submitted week, Sun 21 Jun): the step screen rendered **typable at t+0.5s** after "Start Report"; the typed `5` was accepted; at **t+1s** the screen flipped to the "Already submitted" interstitial, discarding the input mid-keystroke.
- **Root cause:** `WizardForm.jsx` — clicking "Start Report" enters the step flow immediately, while `getDraft()` resolves asynchronously ([WizardForm.jsx:274–301](../../../src/components/wizard/WizardForm.jsx)). On resolve it either (a) merges the stored draft over current state — `setFormData((prev) => ({ ...prev, ...fields }))` at line 297 — overwriting any keys typed during the fetch window with stale server values, or (b) for submitted weeks flips `setScreen('submitted')` (line 294), discarding everything. The **Confirm** screen is already gated on `draftLoaded` (the `wizard-v2-confirm-loading` spinner exists precisely for this); the **step** screen has no such gate.
- **User impact:** a field agent on mobile data opens the wizard, lands on Step 1, and starts typing immediately (the natural behavior). For the first 0.5–3+ seconds (draft-fetch latency), everything typed can silently revert to the stored draft value. No error, no flicker warning — the number just changes back. On fast connections this is nearly invisible; on 3G it is a multi-second data-loss window on every wizard open.
- **Fix (do not implement):** gate `screen === 'step'` rendering on `draftLoaded` exactly as the Confirm screen does (reuse the "Loading your week…" block at [WizardForm.jsx:685–693](../../../src/components/wizard/WizardForm.jsx)); alternatively track touched keys and have the late merge skip them. Gating is simpler and matches the existing pattern.

### BUG-102 — Week number disagrees between the dashboard topbar and Daily Capture (Week 28 vs WK 27), and the dashboard's drifts with time of day
- **Severity:** Medium · **Category:** Bug / correctness · **Confidence:** Confirmed (rendered + traced).
- **Evidence:** same session, same day: topbar crumb "Smoke Agent · Saturday 4 July · **Week 28**" (`dashboard-light-desktop.png`, prior set) vs Daily Capture header "SATURDAY · **WK 27**" and save CTA "ROLLS INTO WK 27" (`agent-daily-capture-entry-desktop-light.png`).
- **Root cause:** two independent Jan-1-based week formulas. [AgentDashboard.jsx:519–525](../../../src/components/dashboard/AgentDashboard.jsx) computes `Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)` on a live `new Date()` — the fractional day is **not floored**, so the result increments mid-week depending on the hour (Jul 4 2026: 27.08 → 28). [DailyCaptureV2.jsx:41–46](../../../src/components/daily/DailyCaptureV2.jsx) floors the day diff (→ 27). Neither is ISO-8601 despite the latter's `isoWeekNumber` name.
- **User impact:** the same Saturday is "Week 28" in the header and "WK 27" in the log the agent fills in — the kind of inconsistency a carrier exec notices in a demo. Worse, the header's week number can change during the day.
- **Fix:** one shared `weekNumber()` helper in `utils/dateHelpers.js` (floored day diff), consumed by both call sites; delete both inline formulas.

### BUG-103 — Daily Capture day strip wraps today's pill onto its own row (all viewports)
- **Severity:** Low · **Category:** Bug / visual jank · **Confidence:** Confirmed (measured).
- **Evidence:** geometry probe at 1440px: six pills at y=69, the seventh (`07-04`, today) at y=126, x=16 — alone on a second row, left-aligned. Identical wrap at 390px. Visible in `agent-daily-capture-entry-desktop-light.png` / `-mobile-light.png`.
- **Root cause:** `WeekStrip` in [DailyCaptureV2.jsx:264–271](../../../src/components/daily/DailyCaptureV2.jsx) is `grid grid-cols-6` (its comment says "Mon–Sat day selector") but the `days` array it receives spans Sunday-to-Saturday — 7 entries. The 7th chip wraps.
- **Fix:** `grid-cols-7` (or drop Sunday from `days` if Mon–Sat was the intent — the Sunday pill currently renders as an "off" chip, suggesting `grid-cols-7` is the honest fix).

### UX-101 — Topbar page title never changes: every agent tab says "Dashboard"
- **Severity:** Low (Medium for wayfinding when combined with prior A11Y-001) · **Category:** UX / wayfinding · **Confidence:** Confirmed.
- **Evidence:** Awards, Game Plan, Commission, Leaderboard screenshots all show topbar title "Dashboard · Smoke Agent · Saturday 4 July · Week 28" (prior set: `awards-dark-desktop.png`, `game-plan-light-desktop.png`, `commission-light-desktop.png`, `leaderboard-light-desktop.png`).
- **Root cause:** [AgentDashboard.jsx:518](../../../src/components/dashboard/AgentDashboard.jsx) hardcodes `topbarTitle="Dashboard"` for every `activeTab`; ManagerDashboard passes a static `Welcome back, {name}` ([ManagerDashboard.jsx:438](../../../src/components/dashboard/ManagerDashboard.jsx)).
- **User impact:** the one persistent text landmark on screen misidentifies 14 of 15 agent screens. Since screens also lack `<h1>`s (prior A11Y-001), some screens have *no* correct visible title anywhere except the sidebar highlight.
- **Fix:** derive `topbarTitle` from the active nav item's label (`navConfig` already holds them); pairs naturally with the A11Y-001 heading fix.

### UX-102 — Daily Capture save has no legible success moment (spinner → silent auto-close)
- **Severity:** Low · **Category:** UX / feedback · **Confidence:** Confirmed.
- **Evidence:** clicking "Save today": button → "Saving…" spinner (`agent-daily-capture-celebrate-desktop-light.png`, `-celebrate2-`), then the takeover auto-closes ([DailyCaptureV2.jsx:672](../../../src/components/daily/DailyCaptureV2.jsx), 600ms after save resolves). At capture the save was still in flight at +550ms; the saved-check state lasts well under a second before the surface disappears. The day-credit chip (`dcv2-day-credit`) is not visible on reopen.
- **User impact:** the app's most-repeated ritual (the "30-second capture" the dashboard banner sells) ends with a spinner and an abrupt dismissal, while the far rarer weekly submit gets a full confetti Celebration. The reward gradient is inverted relative to the behavior the product wants to reinforce.
- **Fix:** a brief post-save beat before close (check + "+24 pts today · rolls into WK 27" for ~1.2s, or a toast that survives the close). Not a redesign — a timing/copy change.

### UX-103 — Wizard validation is fully permissive; a zero report submits with full celebration
- **Severity:** Info · **Category:** UX / validation timing · **Confidence:** Confirmed.
- **Evidence:** clicking Next on a pristine step advances (no `role="alert"` fired anywhere across all 12 steps); an all-zero report submits successfully; Celebration then headlines "**You shipped — TTD 0**" with full confetti framing (`agent-wizard-celebration-desktop-light.png`).
- **Assessment:** zero-activity weeks are legitimate (validation permissiveness is likely intentional), but the celebration copy shouldn't brag about TTD 0 — the component already has a zero-points variant ("Logged — keep building"); an equivalent zero-API variant of the "You shipped" block would fix the tone mismatch. No blocking validation recommended.

### Meeting Mode — verified PASS (no defect findings)
- **Presentation tokens render correctly and are theme-independent:** overlay background measured `rgb(26, 22, 18)` (`--color-presentation`) with the app in **both** light and dark modes; accent resolves to lifted teal `rgb(74, 181, 184)`; text tokens present (`bm-meeting-mode-slide-1-of-2-desktop.png`, `-appdark-`, `-mobile`). The index.css contrast documentation (15.18:1 text, 7.42:1 accent) is honored in the rendered surface — projector legibility is excellent (5xl numerals, uppercase muted labels).
- **Keyboard:** ArrowRight/ArrowLeft advance slides, **Escape exits** ([MeetingMode.jsx:198](../../../src/components/manager/MeetingMode.jsx)), Group/1-on-1 toggle, exit, prev/next and per-slide dots are all reachable by Tab with accessible names. Zero console errors.
- **Observation (not a defect):** with no submissions in the selected week the deck is 2 slides — a "TTD 0" summary and "0 agents reviewed — Meeting Complete". Honest, but a manager who taps Start Meeting on a quiet week projects an empty deck; a "no submissions yet this week" pre-flight note on the button would be kinder. The empty-week deck is also why this walk couldn't evaluate the per-agent slides (see §7).

---

## 2. Part 2 — Keyboard / modal focus-order findings

### A11Y-101 — Wizard modal: `aria-modal="true"` with no focus management at all
- **Severity:** Medium · **Category:** Accessibility · **WCAG:** 2.4.3 Focus Order, 2.1.2-adjacent (dialog conventions), 2.4.7 pass · **Confidence:** Confirmed.
- **Evidence (desktop, wizard open):** initial focus stays on `body` (never moved into the dialog); Tab walks Close → week select → Start Report → **out of the dialog to browser chrome (`body`)** → cycles back in; **Escape does not close** (verified on the Select Week screen and inside Step 1); after closing via the X, focus returns to `body`, not the "Weekly Report" trigger. Focus *visibility* is good (2px outline + ring on every stop).
- **Why it matters:** [WizardForm.jsx:525–527](../../../src/components/wizard/WizardForm.jsx) declares `role="dialog" aria-modal="true"` — which tells AT to treat the rest of the page as inert — but DOM focus is free to wander behind the overlay and to browser chrome. Keyboard users get no entry focus, no trap, no Escape, no focus return: all four dialog conventions missing.
- **Fix:** on open, focus the dialog (or first control); trap Tab within it; `onKeyDown` Escape → `onClose` (mirror [MeetingMode.jsx:198](../../../src/components/manager/MeetingMode.jsx), which already does this correctly); on close, return focus to the invoking nav item. One shared `useModalFocus` hook would fix this and A11Y-102 together.

### A11Y-102 — Daily Capture takeover: same dialog-convention gaps (Escape, trap, focus return)
- **Severity:** Medium · **Category:** Accessibility · **WCAG:** 2.4.3 / dialog conventions · **Confidence:** Confirmed.
- **Evidence:** `role="dialog" aria-modal="true"` ([DailyCaptureV2.jsx:691–696](../../../src/components/daily/DailyCaptureV2.jsx)); **Escape does not close**; focus not trapped; initial focus not set. Mitigations present: the Close button is the first Tab stop, and the day-strip buttons have exemplary `aria-label`s ("M 29 — missing", "S 4 — off") with `aria-pressed` state.
- **Fix:** same shared hook as A11Y-101.

### A11Y-103 — Skip link confirmed absent (upgrades prior A11Y-004 from needs-verification to Confirmed)
- **Severity:** Low · **WCAG:** 2.4.1 Bypass Blocks (A) · **Confidence:** Confirmed.
- **Evidence:** from page top on the agent dashboard, the first Tab stop is the "Collapse sidebar" button, then the pinned nav items — no skip-to-content link exists. A keyboard user tabs through the full ~20-item sidebar on every screen. (Landmark navigation remains a partial mitigation for AT users.)

### Keyboard pass — verified PASS
- **Primary form (Commission Playground):** logical Tab order through all inputs; every stop shows a visible 2px focus outline; labels associated (prior audit) — no findings. `agent-commission-focus-visible-desktop-light.png`.
- **Meeting Mode:** Escape/arrows correct (§1). The only overlay in the app with correct Escape handling.
- **Focus visibility app-wide (sampled):** every focus stop in every trail (wizard, daily capture, sidebar, form) rendered a visible outline or ring — 2.4.7 holds up under keyboard walking, not just static inspection.

**Merged severity counts (prior report + this follow-up):**
Critical 0 · **High 1** (BUG-101) · **Medium 5** (A11Y-001, A11Y-003 prior; BUG-102, A11Y-101, A11Y-102 new) · **Low 9** (A11Y-002, UX-001, A11Y-004→103 confirmed, A11Y-005 prior; BUG-103, UX-101, UX-102 new, +2 prior-low retained) · Info 3 (INFO-001, prior notes; UX-103).

---

## 3. Part 3 — Design-quality verdict

### 3.1 Overall verdict

**The app reads as professionally and intentionally designed — clearly human-directed, not template output — but the conviction is unevenly distributed. Overall: 7.5/10.**

The agent-facing product has a real, ownable identity: the warm beige/near-black Nexus palette, the mono-uppercase eyebrow system (`YTD · SETTLED API`, `YOUR 2026 PLAN`, `FILING REALITY`), Cabinet Grotesk display numerals, disciplined teal-plus-gold accenting, and small editorial gestures (the leaderboard's "Who's leading the year." headline, contextual wizard buttons like "Next · Seminars & tradeshows") that template products simply don't have. Dark mode is not an inverted afterthought — it's a warm, Bear-Notes-grade rendering that at times (Awards) looks *better* than light. The strongest screens — agent dashboard, Awards, Game Plan, Compliance, the wizard chrome — would pass a carrier exec's "is this a real product?" sniff test without hesitation.

What keeps it from an 8.5: the design system's energy decays with distance from the agent dashboard. Manager and admin operational surfaces devolve into plain white cards, bare tables and unstyled loading text; several desktop layouts are transparently mobile-first flows floating in dead whitespace (Daily Capture's narrow column under a full-bleed header, the Select Week screen's single control on an empty canvas); and the chrome misfires — a topbar that says "Dashboard" everywhere, a wrapped day-pill row, two different week numbers on screen at once — read as exactly the kind of unfinishedness the strong screens successfully argue against. The identity is real; the coverage is incomplete.

### 3.2 Cluster scores

| Cluster | Score | Basis |
|---------|-------|-------|
| Agent dashboard | **8.5** | Teal YTD hero with progress-to-MDRT rail is a signature moment; KPI row is uniform-grid but each card carries a distinct visualization (sparkline / rings / bars / count chip); crafted amber "log today" banner. Docked: static topbar title, duplicate Pinned/section nav rows. |
| Agent input flows (daily-log / wizard / daily-capture) | **7.5** | Wizard chrome is the best multi-step form I've seen in this class: phase rail (ACTIVITY 1/5 · SALES · REFLECTION · GOALS), live "Your week so far" panel, autosave chip, contextual Next labels, per-section Edit-Step jump-backs on Review. Docked hard for the flow *seams*: Select Week is an empty canvas, Daily Capture desktop is a mobile sheet stretched to 1440px with the wrapped day strip, and the save moment is a spinner. |
| Agent analytics (commission / persistency / goals / awards / game-plan / money-needs) | **8** | Awards (9) and Game Plan (8.5) are the two most crafted screens in the app — hero ring + tiered QUALIFIED/ALMOST-THERE sections; plan hero with done-rail and color-coded step tiers. Commission's "YOUR REALITY" gradient band + playground form is strong (7.5). The tier drops where surfaces become long label-input stacks. |
| Manager operational (mastersheet / compliance / settlements / financing / reconciliation / …) | **6** | Compliance (8) proves the system can do operational surfaces — the "Filing Reality" segmented band + nudge roster is genuinely good ops design. But MasterSheet greets managers with an empty white rectangle (5), Kiosk is a heading, a sentence and a bare "Loading…" string (4.5), and most of the remaining 13 surfaces are competent-but-anonymous white-card stacks that could belong to any SaaS. |
| Meeting / kiosk mode | **6** | Meeting Mode's presentation surface is tokenized, high-contrast and projector-legible (7.5 as a surface), but the empty-week experience is two nearly-blank slides, and Kiosk mode's generator page is the sparsest screen in the app (4.5). |

### 3.3 "AI-made tells" hunt

Genuine tells found (with evidence), per cluster:

1. **Dead-whitespace desktop canvases (input flows, worst tell).** Select Week: one select + one button in the top 25% of an otherwise empty 1440×900 page (`batch-a-07`). Daily Capture desktop: full-bleed header strip over a ~460px centered column with acres of untouched white either side (`batch-a-05`). These are mobile flows rendered on desktop without a desktop opinion — the single most "generated" feeling moment in the app.
2. **Uniform card grids with no rhythm (manager cluster).** The agent dashboard earns its 6-equal-card row through varied content, but manager surfaces repeat same-size, same-radius, same-shadow white cards in undifferentiated stacks (settlements, financing, goals) — no hero, no hierarchy, no full-width moment. The eye has nowhere to start.
3. **Empty-state quality is bimodal — the clearest craft-vs-default seam.** Leaderboard's empty state is designed (gold medal, headline, guidance — `batch-a-21`); MasterSheet's is an empty white box with a caption *below* it (`batch-b-07`); Kiosk shows the string "Loading…" in plain text (`batch-b-21`). The same app, three tiers of care. (Prior finding UX-001 covers the fix.)
4. **Chrome that doesn't track state.** Topbar reads "Dashboard" on every agent tab (UX-101); week numbering disagrees across surfaces (BUG-102); duplicate nav entries (Daily Log, Weekly Report, Goals, Planner appear in both PINNED and their home sections by default — a redundancy a design pass would have caught, since the default pin set mirrors the section list exactly).
5. **Timid type hierarchy on secondary manager screens.** Where the agent screens deploy the eyebrow + display-numeral system, several manager panels are 14px-label-on-14px-value tables with no display type at all — the identity simply isn't applied there.

**Tells checked and NOT found:** no generic icon soup (Lucide set used consistently and sparingly); no gradient-button kitsch (gradients confined to hero cards per Nexus rules); no placeholder microcopy anywhere sampled — copy is consistently domain-literate ("30-second capture · rolls into your weekly report Sunday", "Gap TTD 0 to qualify", "never filed"); no radius/spacing chaos (radius and shadow tokens are visibly consistent app-wide); no visual monotony across the *agent* screens — each has a distinct composition.

### 3.4 Nexus design-language consistency

**Carried with conviction on agent surfaces; applied thinly on manager/admin surfaces.** The tokens are everywhere (nothing sampled breaks palette), but tokens alone aren't identity. The eyebrow system, display numerals, gold-for-achievement, and hero-band-then-detail composition — the things that make a screen recognizably AgencyTrack — appear on perhaps 12 of 37 screens. Compliance shows the language ports to dense operational surfaces beautifully; the other 15 manager surfaces never got that pass. Meeting Mode's dedicated presentation token set (documented contrast ratios in `index.css`, verified rendering this audit) is design-system maturity most apps this size don't have. Dark mode integrity: excellent everywhere authenticated (login gap = prior A11Y-002).

### 3.5 Keep-list (do not regress)

1. **Agent dashboard YTD hero** — the teal band, mono eyebrow, display numeral, MDRT progress rail (`batch-a-02/03`).
2. **Awards screen composition** — hero ring + QUALIFIED / ALMOST THERE · 70%+ tiering, gold accent discipline, dark-mode rendering (`batch-a-22`).
3. **Wizard chrome** — phase rail, live Week-So-Far panel, autosave chip, contextual Next labels, Review's Edit·Step jump-backs (`batch-a-08/10`).
4. **Compliance "Filing Reality" band + nudge roster** — the template for how every manager surface should look (`batch-b-09`).
5. **Leaderboard editorial headline + crafted empty state** (`batch-a-21`).
6. **Game Plan hero + three-step done rail** (`batch-a-12`).
7. **The mono-uppercase eyebrow system and warm dark palette globally** — they ARE the brand.
8. **Meeting Mode presentation tokens** — theme-independent, contrast-documented, verified (`batch-b-22`).

---

## 4. New-screenshot index

36 new PNGs under `docs/audits/webapp-ux/screenshots/` (joining the prior 95 there and 147 under `docs/audits/ux/screenshots/`):

- **Wizard (21):** `agent-wizard-step-null-select-week-desktop-{light,dark}`, `agent-wizard-step-01…12-*-desktop-light` (12 steps; step-01 also dark), `agent-wizard-celebration-desktop-{light,dark}`, mobile: `agent-wizard-reopen-mobile-{light,dark}`, `agent-wizard-next-state-mobile-light`, `agent-wizard-post-submit-mobile-light`, `agent-wizard-step-mobile-{light,dark}` (the "Already submitted" interstitial).
- **Daily Capture (9):** `agent-daily-capture-entry-desktop-{light,dark}`, `-entry-mobile-{light,dark}`, `-filled-desktop-light`, `-celebrate-desktop-light`, `-celebrate2-desktop-light` (both mid-save), `-saved-desktop-light` (streak flame, reloaded values).
- **Meeting Mode (4):** `bm-meeting-mode-slide-1-of-2-desktop`, `-slide-2-of-2-desktop`, `-slide-1-appdark-desktop` (app in dark mode — identical surface), `-slide-1-mobile`.
- **Keyboard pass (1):** `agent-commission-focus-visible-desktop-light`.
- **Console noise:** zero console errors across all walks except one transient `ERR_QUIC_PROTOCOL_ERROR` resource retry (network blip, not app).

## 5. Cleanup register (writes made — all on the A11Y **test agent**, Smoke test tenant)

| # | Record | Details | State |
|---|--------|---------|-------|
| 1 | Daily activity log, **2026-07-04** | Saved via the real "Save today" path: prospecting letters 2, seminars 2, dials 2 (→ 24 pts day credit) | Left in place (test-agent data; delete via Firestore console if desired) |
| 2 | Weekly submission, week of **2026-06-28** | Submitted via the real wizard path: zero production, activity = daily-log rollup only (calls 2), ratings 0. Leaderboard points +24 accrued via the existing CF path | Left in place. Test agent is `isTestAccount`-excluded from both leaderboard surfaces, so no leaderboard contamination |
| 3 | Weekly draft doc, week of 2026-06-28 | Auto-save wrote during the walk; superseded by the submission (status submitted) | Left in place |
| 4 | Transient probe keystrokes | A `5` typed into Letters (this week — reverted by BUG-101 itself / zeroed back with autosave flush); a `5` typed on the 21-Jun submitted week (discarded by the interstitial — no write) | No net change |

No "AUDIT-TEST" text fields persisted: the harness's step-filler had a selector bug (matched the step-counter node, filled nothing), so the submitted report contains only zeros + daily rollup. No real (non-test) records were touched at any point. No source files modified, nothing committed.

## 6. Root-caused fix list (for future briefs — do not implement in this audit)

| Finding | File anchor | Fix shape | Effort |
|---------|------------|-----------|--------|
| BUG-101 | `WizardForm.jsx:274–301` + step render ~697 | Gate step screen on `draftLoaded` (mirror Confirm's loading gate) | S |
| BUG-102 | `AgentDashboard.jsx:519–525`, `DailyCaptureV2.jsx:41–46` | Single floored `weekNumber()` in dateHelpers | S |
| BUG-103 | `DailyCaptureV2.jsx:268` | `grid-cols-6` → `grid-cols-7` | XS |
| UX-101 | `AgentDashboard.jsx:518` | topbarTitle from navConfig label | S |
| UX-102 | `DailyCaptureV2.jsx:643–672` | Post-save beat / surviving toast before auto-close | S |
| A11Y-101/102 | `WizardForm.jsx:525`, `DailyCaptureV2.jsx:691` | Shared modal-focus hook: initial focus, trap, Escape, return | M |
| A11Y-103 | Shell | Skip-to-content link before sidebar | S |
| UX-103 | `Celebration.jsx:86–104` | Zero-API copy variant | XS |

## 7. Self-critique — known gaps (Rule 22)

- **BUG-101's two probes ran against post-submission draft states** (the walk had already submitted this week). The t+0.5s-typable → t+1s-interstitial window is demonstrated cleanly; the merge-clobber symptom on a *never-submitted* week is inferred from the unambiguous code path (line 297 merge + ungated step screen) plus the observed revert, not from a pristine-week reproduction. A pristine-week repro would need a fresh test week (next Sunday) or a seeded account.
- **Meeting Mode was walked in its empty-week state only** — the per-agent slides (coaching ratios, self-evaluation panels, `presentation-gold` award chips) never rendered because the branch had no submissions this week; their projector legibility is verified only via the token layer, not visually. Re-run after seeding a submission-bearing week to close this.
- **Daily Capture's transient day-credit/saved-check moment was never captured** — save latency outran both screenshot offsets, and the takeover closes ~600ms after resolve. The UX-102 finding is anchored on code + the spinner captures; the exact visual of the sub-second success state is undocumented.
- **The design verdict rests on ~20 directly-reviewed screenshots** of the 183 total; the remaining cells were relied on via the prior audit's descriptions and cluster sampling. Per-screen scores for unviewed manager panels (settlements, team-wars, gameplans, etc.) carry cluster-level confidence, not screen-level.
- **The wizard walk submitted an all-zero report** because of the harness selector bug (§5) — so per-step *filled* states and any per-step validation that only fires on non-zero interactions (e.g. policy-row entry on Step 7) were not exercised. Step 7's dynamic policy rows in particular were captured empty.
