# Mobile Audit — Pilot-Critical Pass (2026-05-06)

Branch: `mobile-audit-pilot-pass-1`
Auditor: Claude (browser MCP via Playwright on dev server, port 5180)
Test agent: kelsean@gmail.com (UID J0j4uBqzTPcfm1IlGCPyDzo27RP2)
Viewports tested: **320×568** (iPhone SE), **375×812** (iPhone standard), **768×1024** (iPad portrait)

## TL;DR

Agent core flow (login → dashboard → wizard 5 steps → review → submit → history)
**works end-to-end at every tested viewport** today — there is no fully-blocked
showstopper. The agent can complete a weekly report on a 320px phone right now.

What's painful enough to fix before the Tatil pilot:

| Severity | Surface | Issue | Why pilot-blocking |
|----------|---------|-------|---------------------|
| **P0** | Wizard (all 5 steps) | All 17 inputs render at 14px → iOS Safari auto-zooms on every focus | Agents focus inputs ~30+ times per submission; the constant zoom-out/zoom-in is hostile and field-disorienting |
| **P1** | Dashboard, Career | `GapAnalysisPanel` hierarchy rows have 336px+ of fixed-width columns → page horizontally scrolls ~38px at 375 and worse at 320 | Every dashboard load shows clipped "to go" pills; entire page rocks left-right |
| **P1** | All authenticated surfaces | TabBar buttons are 36px tall (h-9), below 44px touch target | Six tabs that agents tap dozens of times daily |
| **P1** | Dashboard | Carousel arrow buttons are 28×28px and dot indicators are 6×6px | Below 44px target on the agent's primary surface |

Manager surfaces have known desktop-first table layouts (MasterSheet 23 columns,
SettlementPanel grids) wrapped in `overflow-x-auto`. Usable on mobile but not
optimized — explicitly **out of scope** per brief, deferred to next-week mobile pass.

---

## Phase 1 audit method

For each viewport × surface combination:

1. Set viewport via `playwright.browser_resize`
2. Navigate / click into the surface
3. Capture full-page PNG → `verification/mobile/screenshots/<surface>-<viewport>.png`
4. Run instrumentation script that returns:
   - `body.scrollWidth` vs viewport (horizontal-scroll detection)
   - All elements whose `right > viewport + 1` and not inside `overflow-x: auto/scroll` ancestor (overflow offenders)
   - All `button / a / input / select / textarea / [role=button|link|tab]` whose bounding box is < 44×44 (touch-target violations)
   - All `input / textarea / select` computed `font-size` (iOS auto-zoom screen)

The same audit script is rerun in Phase 2 to confirm fixes.

---

## Findings — agent surfaces

### LOGIN (`LoginScreen`)

| Viewport | hScroll | Overflow | Small targets | Input font-size |
|----------|---------|----------|---------------|-----------------|
| 320      | no      | 0        | 0 in critical path | 16px ✓ |
| 375      | no      | 0        | 0 in critical path | 16px ✓ |
| 768      | no      | 0        | 0 in critical path | 16px ✓ |

Screenshots: `login-{320,375,768}.png`. **Clean.**

---

### DASHBOARD (`AgentDashboard`)

| Viewport | hScroll | Overflow culprits | Small targets |
|----------|---------|-------------------|---------------|
| 320      | **yes** (53px+) | `GapAnalysisPanel` w-24 columns, "to go" badges | TabBar (6×) 36h, carousel arrows 28h, carousel dots 6h |
| 375      | **yes** (38px) | same — `div.w-24.flex.justify-end.shrink-0` | same |
| 768      | no      | 0 | TabBar (6×) 36h, carousel arrows 28h, carousel dots 6h |

Issues:

- **P1 horizontal page scroll** — `src/components/goals/GapAnalysisPanel.jsx:62-71`
  Each layer row stacks `w-36 (144) + flex-1 + w-24 (96) + w-24 (96)` plus
  `gap-3` × 3 (36) plus card padding (~32). Minimum row width ≈ 404px. At
  ≤375px viewports the row pushes the parent card to overflow the page.
- **P1 TabBar buttons 36px tall** — `src/components/dashboard/AgentDashboard.jsx:59` (`h-9`)
- **P1 carousel arrows 28px** — `src/components/dashboard/MotivationalCarousel.jsx:382,389` (`w-7 h-7`)
- **P1 carousel dot indicators 6px** — `src/components/dashboard/MotivationalCarousel.jsx:404-407` (`w-1.5 h-1.5`)

Screenshots: `dashboard-{320,375,768}.png`.

---

### CAREER (`CareerPortal`)

| Viewport | hScroll | Notes |
|----------|---------|-------|
| 375 | **yes** (38px) | Same `GapAnalysisPanel` overflow as dashboard. Goals Overview table also clips on right ("My Commitm…") but uses table semantics, scrollable inline. |

Issues inherited from GapAnalysisPanel — fixed once it's fixed.
Career-specific: `Edit My Goals` button is 32px tall (P2 non-core, deferred).

Screenshot: `career-375.png`.

---

### AWARDS (`AgentAwardsPanel`)

No horizontal overflow at any viewport. Cards stack cleanly. Tab strip
(Monthly / Quarterly / Annual / Club) is wrapped, not scrolled.

Screenshot: `awards-375.png`. **Clean apart from inherited TabBar P1.**

---

### LEADERBOARD (`Leaderboard`)

No horizontal overflow at any viewport. Top-3 row wraps to 3 column at narrow
widths. Avatars are 40px (slightly under 44 — **P2**, defer).

Screenshot: `leaderboard-375.png`. **Clean apart from inherited TabBar P1.**

---

### HISTORY

No horizontal overflow at any viewport. Each row's eye/preview button is < 44px
(**P2 non-core, deferred**). The "Submitted" / "Draft" status pill is small but
non-interactive.

Screenshot: `history-375.png`. **Clean apart from inherited TabBar P1.**

---

### PROFILE (`ProfileScreen`)

No horizontal overflow. **Inputs (Display Name, Phone, Bio) are 14px** — would
trigger iOS auto-zoom (P1 non-core, fixed by global wizard fix anyway since
inputs share styling).

Screenshot: `profile-375.png`.

---

### WIZARD PICKER

Single select + button. Clean at every viewport.
Screenshot: `wizard_picker-375.png`.

---

### WIZARD STEPS 1–5 (`WizardForm`)

| Viewport | hScroll | Input font-size | Nav buttons | Notes |
|----------|---------|-----------------|-------------|-------|
| 320 | no | **14px ✗** | Change/Prev 110×44, Next/Review 170×44 | Close (X) 40×40 (P2) |
| 375 | no | **14px ✗** | Change/Prev 167×44, Next/Review 167×44 | Close (X) 40×40 (P2) |
| 768 | no | **14px ✗** | wide | clean |

**P0 — iOS keyboard auto-zoom.** All `<input>` elements rendered by
`src/components/wizard/CardStack.jsx` (NumericField, CurrencyField, SuggestedField)
use `text-sm` (14px). On iOS Safari, focusing a sub-16px input scales the entire
viewport up to make the input legible — agents lose the wizard layout on every
field tap. With ~17 inputs per step × 5 steps the agent can experience this
~30+ times in a single submission.

Note: The standalone `src/components/wizard/NumericField.jsx` and
`CurrencyField.jsx` use `text-lg` (18px) but they are **not** used by the
shipping wizard — Step1–9 import from `CardStack.jsx`.

Screenshots: `wizard-step{1,2,3,4,5}-375.png`, `wizard-step1-320.png`,
`wizard-review-375.png`.

---

## Findings — manager surfaces (light pass, code-only)

Code review of `src/components/manager/*`:

| Component | Mobile-hostile pattern | Severity |
|-----------|------------------------|----------|
| `MasterSheet.jsx` | 23 columns × min-w-[80–110px] = ~2000px wide grid wrapped in `overflow-x-auto`. Sticky left columns rely on pixel-positioned `left-[160px]` etc. | next-week |
| `SettlementPanel.jsx` | Three grids in `overflow-x-auto` containers. | next-week |
| `CompliancePanel.jsx` | `flex-1 min-w-[200px]` cards — wrap correctly, OK at mobile. | clean |
| `MeetingMode.jsx` | Full-screen presentation surface. Designed-for-projector but PR4/5 already addressed dark mode contrast. Mobile-presentation specifically not in pilot scope. | next-week |
| `UserManagementPanel.jsx` | List rows with `min-w-[80px]` action buttons. Likely scrolls. | next-week |
| `GoalsPanel.jsx` | Multi-section form with grids. Likely OK due to grid wrapping. | next-week |

Manager mobile pass deferred per brief.

---

## Phase 2 — what this PR will fix

**In scope (P0 + P1 on agent core flow):**

1. iOS keyboard auto-zoom — change `text-sm` to `text-base` (16px) on all
   wizard inputs in `src/components/wizard/CardStack.jsx`. Also patch the
   non-core inputs (ProfileScreen) for consistency since the cost is one
   character per file.
2. `GapAnalysisPanel` horizontal overflow — restructure layer row to allow
   the right-side metrics to wrap below the bar at narrow viewports
   (collapse `w-36 + bar + w-24 + w-24` into a stacked layout < 480px),
   remove `shrink-0` on the badge column.
3. TabBar 44px touch target — bump `h-9` (36) to `h-11` (44) in
   `AgentDashboard.jsx::TabBar`.
4. Carousel controls 44px touch targets — expand the arrow `<button>` hit
   area to 44×44 (preserve visual via `before:` overlay or padding); same
   for dot indicators (preserve the visual w-1.5 / w-4 dot but expand the
   button to 44×44 with transparent padding).

**Out of scope, filed as follow-ups in `docs/FOLLOW_UPS.md`:**

- P1 issues on non-core agent surfaces (career edit button, history eye
  button, profile inputs already covered by global fix)
- All manager surface mobile work
- All P2 cosmetic issues (Close X 40×40, leaderboard avatars 40×40,
  hardcoded color in carousel `bg-[#01696f]/8`)
