# Motion Surface Recon — Systemic-Motion Track

**Date:** 2026-07-06
**Branch:** `recon/motion-surface` (off `main` @ `0773af3a`)
**Role:** READ-ONLY recon. No source touched. Scope: pure frontend (`src/`, `docs/design-system/`). `functions/` not read.
**Goal:** Map the app's current motion surface so the systemic-motion track can wire the Nexus v2 motion tokens (`--dur-*`, `--ease-*`) that #813 defined but left unconsumed.

---

## Summary

- **No motion library.** The app has **no** framer-motion / motion / react-spring dependency ([package.json:14-56](../../package.json)). Recharts is present but its animation is **explicitly disabled** everywhere it renders. All motion today is hand-authored CSS + Tailwind utilities + a small amount of JS (rAF count-up, `matchMedia` gates).
- **Five mechanisms in use:** (1) hand-written CSS `transition`/`@keyframes` in `src/index.css`; (2) Tailwind `transition-*` / `duration-*` / `animate-*` utilities (config keyframes in `tailwind.config.js`); (3) inline `style={{ animation: … }}` referencing named `@keyframes`; (4) a rAF count-up hook; (5) `window.matchMedia` reduced-motion gates in two components.
- **The motion tokens are 100% unconsumed.** `--dur-1/2/3` and `--ease-out`/`--ease-spring` are defined once ([src/index.css:172-176](../../src/index.css)) and referenced **nowhere** (`git grep var(--dur-` / `var(--ease-` in `src/` → 0 hits). Every existing animation hardcodes its own duration/easing. **This is the substrate the track wires.**
- **Reduced-motion contract is real but non-uniform.** The dominant pattern is the *positive* gate `@media (prefers-reduced-motion: no-preference)` in `index.css` (13 blocks), which degrades correctly. Tailwind `animate-*` usages degrade only where a `motion-reduce:*` variant is added per-usage — and several **kiosk** entrance animations lack that guard. The `useCountUp` hook honors **no** reduced-motion preference at all. There is **no global reduced-motion reset** — declined on purpose ([src/index.css:456-458](../../src/index.css)).
- **The addendum §2 target is mostly *unbuilt* at the systemic layer.** Screen-enter, staggered-assemble, and sheet-spring exist in the **spec** and (partially) on the **kiosk** surface, but the app's shared shell / navigation / dashboards have **no** enter/exit or stagger motion today. Count-up exists but only on kiosk. The systemic track is largely greenfield wiring, not migration.

---

## Task 1 — Current animation mechanism

### 1a. Library check

| Candidate | Present? | Evidence |
|---|---|---|
| framer-motion | ❌ | absent from [package.json:14-56](../../package.json) |
| motion (`motion/react`) | ❌ | absent |
| react-spring | ❌ | absent |
| **Recharts** | ✅ (charts only) | `recharts ^3.8.1` [package.json:27](../../package.json) — **animation disabled**, see 1b |

**Conclusion:** there is no JS animation library. Introducing one is a live decision (see DECISIONS-NEEDED #1).

### 1b. Mechanisms actually in use

| # | Mechanism | Where (path:line) | Notes |
|---|---|---|---|
| 1 | Hand-written CSS `transition` / `@keyframes` | [src/index.css](../../src/index.css) throughout | Gated behind `prefers-reduced-motion: no-preference` (see Task 3). Durations/easings hardcoded. |
| 2 | Tailwind `transition-*` / `duration-*` / `animate-*` | ~304 utility occurrences across 100 `.jsx` files under `src/components` | Config keyframes/animations in [tailwind.config.js:100-186](../../tailwind.config.js). |
| 3 | Inline `style={{ animation: '<name> …' }}` | [Celebration.jsx:208,236](../../src/components/wizard/v2chrome/Celebration.jsx); [LoginScreen.jsx:83](../../src/components/auth/LoginScreen.jsx) (+ ResetPasswordHandler.jsx:53, EmailVerificationHandler.jsx:51) | References `@keyframes` by name with per-particle/per-row duration overrides. |
| 4 | JS rAF count-up | [src/hooks/useCountUp.js:13-53](../../src/hooks/useCountUp.js) | Custom ease-out-cubic; **no reduced-motion check**. |
| 5 | JS `window.matchMedia` reduced-motion gate | [GoalCarousel.jsx:16-27](../../src/components/dashboard/GoalCarousel.jsx); [Celebration.jsx:39-48](../../src/components/wizard/v2chrome/Celebration.jsx) | Gates auto-rotate / confetti at the React layer. |
| 6 | Recharts `isAnimationActive={false}` | [KPICard.jsx:50](../../src/components/dashboard/KPICard.jsx); [CashFlowChart.jsx:85,95](../../src/components/goals/CommissionPlayground/components/CashFlowChart.jsx) | Chart draw-on animation is **turned off** app-wide. No Recharts animation to reconcile. |

---

## Task 2 — Motion tokens status

**Definitions** ([src/index.css:172-176](../../src/index.css), in `:root`, theme-independent, no `.dark` override):

| Token | Value | Intended use (comment) |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22, 1, .36, 1)` | default reveal / hover |
| `--ease-spring` | `cubic-bezier(.34, 1.56, .64, 1)` | sheets / overshoot only |
| `--dur-1` | `.14s` | hover, focus, small state |
| `--dur-2` | `.20s` | toggles, tab change |
| `--dur-3` | `.32s` | screen enter, sheet open |

**Consumption:** **CONFIRMED UNCONSUMED.** `git grep -n "var(--dur-\|var(--ease-" -- 'src/*'` → **NO CONSUMERS**. The only near-neighbor role from the same #813 block that *is* consumed is `--focus` ([src/index.css:461-464](../../src/index.css)) — but that is a focus ring, not motion. Every existing transition/animation hardcodes its timing (Task 4).

> Note: `--dur-*` durations are also *unreachable from `tailwind.config.js`* today — the config's `animation` shorthands (line 100-122) hardcode `0.6s`, `600ms`, etc. rather than `var(--dur-*)`. Wiring tokens into Tailwind's `theme.extend.transitionDuration` / `transitionTimingFunction` is part of the substrate decision.

---

## Task 3 — Reduced-motion contract (gates the whole track)

Three enforcement layers, **no global reset**:

### Layer A — CSS positive-gate (dominant, correct)

`index.css` wraps motion in `@media (prefers-reduced-motion: no-preference) { … }` so reduced-motion users receive the base (static) style. The base end-state is always the visible one (addendum §2 "degrade to visible"). 13 such blocks:

[src/index.css](../../src/index.css) lines **675** (badge hover), **1015** (goal slide-track + donut), **1059** (activity-item), **1205** (sidebar-link), **1326** (sidebar-nav-star), **1386** (sidebar-foot-action), **1411** (sidebar-collapse-btn), **1505** (topbar-search), **1544** (topbar-icon-btn), **1598** (bottom-nav-item), **1644** (bottom-nav-fab), **1729** (mobile-nav-drawer), **1840** (role-bar-fill).

The decision **not** to add a global `prefers-reduced-motion: reduce { * { animation:none } }` killer is explicit and documented ([src/index.css:456-458](../../src/index.css)): "the app already gates every animation behind `@media (prefers-reduced-motion: no-preference)`."

### Layer B — Tailwind `motion-reduce:` / `motion-safe:` variant (per-usage)

Applied on individual elements. Guarded examples: login drift ([LoginScreen.jsx:75](../../src/components/auth/LoginScreen.jsx) + ResetPasswordHandler.jsx:45, EmailVerificationHandler.jsx:43 all carry `motion-reduce:animate-none`), spinners (`animate-spin motion-reduce:animate-none` — WizardForm.jsx:689/735/922, AutosaveChip.jsx:120, BulkImport*Modal), confetti/sparkle wrappers (`motion-reduce:hidden` — [Celebration.jsx:192,227](../../src/components/wizard/v2chrome/Celebration.jsx)), Toast ([Toast.jsx:83](../../src/components/ui/Toast.jsx) `transition-opacity … motion-reduce:transition-none`), PhaseProgress/ReviewSubmit/WeekConfirmView (`motion-reduce:transition-none`), MobileNavDrawer/WorkspaceToggle (`motion-safe:transition-colors`).

### Layer C — JS `matchMedia` (React state gate)

- [GoalCarousel.jsx:16-27,44](../../src/components/dashboard/GoalCarousel.jsx) — a local `usePrefersReducedMotion()` disables carousel auto-rotate.
- [Celebration.jsx:39-48](../../src/components/wizard/v2chrome/Celebration.jsx) — gates whether confetti/sparkle layers mount.

### Gaps in the contract (decision-relevant)

| Gap | path:line | Detail |
|---|---|---|
| `useCountUp` ignores reduced-motion | [src/hooks/useCountUp.js:19-50](../../src/hooks/useCountUp.js) | The rAF loop runs unconditionally. A reduced-motion user still sees numerals tick up. No `matchMedia` guard, no instant-set path. |
| Kiosk entrance animations unguarded | `animate-stagger-in` / `animate-count-up` / `animate-kiosk-fade` / `animate-progress-fill` at [KioskShell.jsx:113](../../src/components/kiosk/KioskShell.jsx), [CompliancePanel.jsx:9,81](../../src/components/kiosk/panels/CompliancePanel.jsx), [LastWeekRecapPanel.jsx:102](../../src/components/kiosk/panels/LastWeekRecapPanel.jsx), [AOMCategoryColumn.jsx:14](../../src/components/kiosk/panels/AOMCategoryColumn.jsx), UnitLeaderboardPanel:43, ActivityLeaderboard:52, TVRankedLeaderboard:38, BranchOverviewPanel:23, AwardsWatchPanel:25, RunningTotalsPanel:16,21 | These carry **no** `motion-reduce:animate-none`. (Kiosk *ambient* halos/breathe *are* guarded — AOMCategoryColumn:29, WelcomePanel:43, AwardsWatchPanel:95 — but the *entrance/count* animations are not.) |
| Inaccurate comment claims a global reset exists | [AOMCategoryColumn.jsx:26](../../src/components/kiosk/panels/AOMCategoryColumn.jsx) | Comment says the halo is safe "via … the @media (prefers-reduced-motion) reset in the global CSS." **No such global reset exists** ([src/index.css:456-458](../../src/index.css)). That element is safe only because of its own `motion-reduce:animate-none` (line 29); the comment's stated basis is false and would mislead anyone copying the pattern to an unguarded element. |
| One unconditional CSS transition | [src/index.css:1463-1468](../../src/index.css) `.skip-link` | `transition: top .15s ease` sits outside any `no-preference` block, and `.skip-link:focus` (not gated) changes `top` — so the skip link slides even under reduced motion. Trivial, but it's the one true exception to Layer A. |

**Contract summary:** the contract is **per-component/per-usage**, not global. Any new systemic motion must plug into Layer A (CSS `no-preference` gate) for CSS, and add `motion-reduce:` variants or `matchMedia` for Tailwind/JS. The track should also decide whether to *keep* the per-usage model or introduce a **global** `prefers-reduced-motion: reduce` reset now that motion is about to become systemic (DECISIONS-NEEDED #4).

---

## Task 4 — Ad-hoc motion inventory

Legend: **Tok?** = uses `--dur-*`/`--ease-*`? (all currently **No** — that's the point). **RM** = reduced-motion handling.

### CSS (`src/index.css`)

| Surface | path:line | Mechanism | Duration / easing | RM | Migrate? |
|---|---|---|---|---|---|
| `.btn-primary` hover | [467-471](../../src/index.css) | `transition-colors duration-150` (Tailwind @apply) | 0.15s | via Layer B on element usage | → `--dur-1` |
| `.btn-secondary` hover | [487-491](../../src/index.css) | `transition-colors duration-150` | 0.15s | " | → `--dur-1` |
| `.card` hover shadow | [493-496](../../src/index.css) | `transition-shadow duration-200` | 0.20s | ungated (benign: shadow only) | → `--dur-2` |
| `.badge-item` hover lift | [668,675-684](../../src/index.css) | `transition: transform .2s ease…`; hover `translateY(-2px)` + medal `scale(1.08) rotate(-4deg)` | 0.2s ease | hover **gated** @675 | → `--dur-2`/`--ease-out` |
| `.badge-medal` | [700](../../src/index.css) | `transition: transform .25s ease, box-shadow .25s` | 0.25s ease | state changes gated | → `--dur-2`/`--dur-3` |
| Goal carousel slide | [1016-1018](../../src/index.css) | `transition: transform .35s cubic-bezier(.4,0,.2,1)` | 0.35s, **custom bezier ≠ token** | **gated** @1015 | → `--dur-3` + `--ease-out` (bezier differs) |
| Goal donut fill | [1019-1021](../../src/index.css) | `transition: stroke-dashoffset .45s ease` | 0.45s (**> §2's ~320ms ceiling**) | **gated** @1015 | decision: keep long or clamp |
| `.activity-item` hover | [1060](../../src/index.css) | `transition: background-color .15s` | 0.15s | **gated** @1059 | → `--dur-1` |
| `.sidebar-link` hover | [1206](../../src/index.css) | `transition: background-color .15s, color .15s` | 0.15s ease | **gated** @1205 | → `--dur-1` |
| `.sidebar-nav-star` | [1327](../../src/index.css) | `transition: opacity .12s, color .12s` | 0.12s | **gated** @1326 | → `--dur-1` |
| `.sidebar-foot-action` | [1387](../../src/index.css) | `transition: color .18s, border-color .18s` | 0.18s | **gated** @1386 | → `--dur-1`/`--dur-2` |
| `.sidebar-collapse-btn` | [1412-1414](../../src/index.css) | `transition: color/border/transform .18s` | 0.18s | **gated** @1411 | → `--dur-2` |
| `.skip-link` slide | [1463](../../src/index.css) | `transition: top .15s ease` | 0.15s | **ungated** (see Task 3 gap) | → `--dur-1` + gate |
| `.topbar-search input` | [1506](../../src/index.css) | `transition: border-color/background .15s` | 0.15s | **gated** @1505 | → `--dur-1` |
| `.topbar-icon-btn` | [1545](../../src/index.css) | `transition: color/border .18s` | 0.18s | **gated** @1544 | → `--dur-2` |
| `.bottom-nav-item` | [1599](../../src/index.css) | `transition: color .15s` | 0.15s | **gated** @1598 | → `--dur-1` |
| `.bottom-nav-fab` | [1645](../../src/index.css) | `transition: transform/box-shadow .15s` | 0.15s | **gated** @1644 | → `--dur-1` |
| Mobile nav drawer enter | [1730-1737](../../src/index.css) | `animation: drawer-slide-up .22s ease-out` + `@keyframes` | 0.22s ease-out | **gated** @1729 | → `--dur-3` + `--ease-out` (a §2 "sheet open"; spec says `--ease-spring`) |
| `.role-bar-fill` width | [1841](../../src/index.css) | `transition: width .4s ease` | 0.4s (**> §2 ceiling**) | **gated** @1840 | decision: keep long or clamp |
| Wizard confetti | [1747-1751](../../src/index.css) | `@keyframes wizardv2-confetti-fall` | per-particle inline (1100-1820ms) | wrapper `motion-reduce:hidden` | keep (decorative) |
| Wizard sparkle | [1752-1756](../../src/index.css) | `@keyframes wizardv2-sparkle-pop` | 900ms inline | wrapper `motion-reduce:hidden` | keep (decorative) |

### Tailwind config (`tailwind.config.js:100-186`)

All hardcode duration/easing; none reference `--dur-*`/`--ease-*`. Consumers are almost entirely **kiosk** (the presentation/TV surface) except `login-drift-*`.

| Utility | Duration / easing | Used at | RM |
|---|---|---|---|
| `animate-kiosk-fade` | `0.6s ease-in-out` | [KioskShell.jsx:113](../../src/components/kiosk/KioskShell.jsx) | ❌ unguarded |
| `animate-count-up` | `600ms ease-out` (entrance) | kiosk panels (6 sites) | ❌ unguarded |
| `animate-stagger-in` | `400ms ease-out` | kiosk panels (5 sites) | ❌ unguarded |
| `animate-progress-fill` | `1500ms ease-out forwards` | [AwardsWatchPanel.jsx:25](../../src/components/kiosk/panels/AwardsWatchPanel.jsx) | ❌ unguarded |
| `animate-kiosk-pulse-dot` | `1.8s …infinite` | kiosk | (ambient — some guarded) |
| `animate-kiosk-breathe` | `3.2s …infinite` | [WelcomePanel.jsx:43](../../src/components/kiosk/panels/WelcomePanel.jsx) | ✅ `motion-reduce:animate-none` |
| `animate-kiosk-halo-{gold,teal,hot}` | `2.4–2.8s …infinite` | AOMCategoryColumn:29, AwardsWatchPanel:95 | ✅ guarded |
| `animate-kiosk-sparkle` | `2.2s …infinite` | kiosk | ambient |
| `animate-login-drift-{l,r}` | `30s linear infinite` (per-row override) | [LoginScreen.jsx:75](../../src/components/auth/LoginScreen.jsx), ResetPasswordHandler, EmailVerificationHandler | ✅ `motion-reduce:animate-none` |

### JS

| Mechanism | path:line | Duration / easing | RM |
|---|---|---|---|
| `useCountUp` | [src/hooks/useCountUp.js:13-53](../../src/hooks/useCountUp.js) | default 1000ms, ease-out-cubic (JS) | ❌ **none** |
| GoalCarousel auto-rotate | [GoalCarousel.jsx:13,43-49](../../src/components/dashboard/GoalCarousel.jsx) | 6000ms interval | ✅ matchMedia |
| Celebration confetti/sparkle | [Celebration.jsx:179-242](../../src/components/wizard/v2chrome/Celebration.jsx) | inline ms per particle | ✅ matchMedia + `motion-reduce:hidden` |

**Hardcoded-duration migration candidates** (should move to `--dur-*`/`--ease-*`): every `.15s`/`.18s`/`.2s`/`.25s`/`.35s` transition in `index.css` above, plus the Tailwind config animation shorthands. Two durations **exceed the §2 ~320ms content ceiling** and need an explicit keep/clamp call: goal-donut `0.45s` ([1020](../../src/index.css)) and role-bar-fill `0.4s` ([1841](../../src/index.css)).

---

## Task 5 — Addendum spec (the target)

### `redesign-addendum.md §2` — "Motion — fast, quiet, and it must degrade to visible"

**Timing tokens:** `--dur-1 .14s` (hover/focus), `--dur-2 .20s` (toggles/tabs), `--dur-3 .32s` (screen enter / sheet). **Easing:** `--ease-out` for reveals/hovers; `--ease-spring` **only** for sheets. **No motion over ~320ms on content.** (redesign-addendum.md §2, lines 69-89.)

**Approved motions (the target set):**

| Motion | Spec | Systemic or per-screen? |
|---|---|---|
| **Screen enter** | content region **fades + rises 8px** on navigation | Systemic (shell/route level) |
| **Staggered assemble** | top-level blocks rise in sequence (~40ms step). **`transform` only, never `opacity`** — a paused/throttled tab must never strand a block at `opacity:0` | Systemic shared helper; per-screen block wiring |
| **Sheet open** | mobile sheets **spring up** (`--ease-spring`) + backdrop fade + lightly staggered items | Systemic (shared sheet/drawer primitive) |
| **Count-up** | KPI/hero numerals count from 0, cubic ease-out, on load | Systemic hook (`useCountUp`) + per-screen adoption |

**Hard rules (§2):** everything gated behind `@media (prefers-reduced-motion: no-preference)`; **no infinite loops on content** (decorative glyph-drift / marquee are the only exceptions); the visible end-state is always the base style so print / PDF / reduced-motion show content, not the pre-animation frame.

### `docs/design-system/guidelines/motion.html` — Foundations "Motion & hover" card

Reinforces §2 with concrete numbers ([motion.html:1-19](../design-system/guidelines/motion.html)): hover card-lift `translateY(-4px)` + soft shadow + teal-ish border over **`.18s ease`**; one-shot progress-grow (`cubic-bezier(.2,.7,.3,1)` `1.1s forwards`, degrades to static `width:78%` under reduced-motion); subtitle codifies "**.15–.18s ease · lift −1..−4px + shadow · one-shot reveals · no infinite loops.**" (Note: its `.18s`/`1.1s` sample values predate and slightly diverge from §2's tokenized `.14/.20/.32`; §2 wins per the addendum precedence rule.)

### `docs/design-system/screens-v2/AgencyTrack Logo - Glass & Motion Lab.html`

An interactive **logo/brand-motion studio** (light/dark toggle, motion-preset controls, phone-mockup hero — [file head:1-50](../design-system/screens-v2/AgencyTrack%20Logo%20-%20Glass%20%26%20Motion%20Lab.html)). It prototypes **glass treatments + motion presets for the AgencyLogo mark**, not app-surface systemic motion. **Out of scope** for this track (brand-asset decoration), noted for completeness.

---

## Task 6 — Gap analysis

### (a) Spec motion the app already does (needs token-wiring only)

| §2 motion | Where it exists today | Wiring needed |
|---|---|---|
| Count-up | [useCountUp.js](../../src/hooks/useCountUp.js) + kiosk panels | Add reduced-motion guard; adopt on non-kiosk KPI/hero numerals; already ease-out-cubic per spec |
| Hover reveals (`--dur-1`, `--ease-out`) | dozens of `index.css` transitions (Task 4) | Swap hardcoded `.12–.2s` for `--dur-1`/`--dur-2` + `--ease-out` |
| Sheet open (mobile drawer) | [index.css:1730-1737](../../src/index.css) `drawer-slide-up` | Retime to `--dur-3`; §2 wants `--ease-spring` (currently `ease-out`) — small behavior change, decision |
| Reduced-motion "degrade to visible" | Layer A pattern (Task 3) | Extend the same gate to new systemic motion; close the `useCountUp` + kiosk-entrance gaps |

### (b) Spec motion that is MISSING

| §2 motion | Status | Where it must land (systemic) |
|---|---|---|
| **Screen enter** (fade + rise 8px on nav) | ❌ absent app-wide | Shell/tab-switch layer ([src/components/shell/Shell.jsx](../../src/components/shell/Shell.jsx) + dashboards). App is tab-based (no router); tab content swaps with no transition. |
| **Staggered assemble** (transform-only, ~40ms step) | ⚠️ only on **kiosk** (`animate-stagger-in`, and it animates `translateX` — transform-only, spec-compliant on that axis) | A shared systemic helper for dashboard top-level blocks. None exists outside kiosk. |
| **Sheet spring** (`--ease-spring` + backdrop fade + staggered items) | ⚠️ partial — mobile drawer slides but with `ease-out`, no item stagger | Shared sheet/drawer primitive (MobileNavDrawer, QuickAddMenu, modals). |
| Tokenized durations/easings on all systemic motion | ❌ 0 consumers | `--dur-*`/`--ease-*` wired into CSS + Tailwind theme. |

### (c) Existing ad-hoc motion NOT in the spec — keep / migrate / drop (flag for decision)

| Motion | path:line | Recommendation | Rationale |
|---|---|---|---|
| Login glyph drift (30–48s infinite) | [LoginScreen.jsx:75](../../src/components/auth/LoginScreen.jsx) + Reset/EmailVerify | **KEEP** | §2 explicitly exempts "decorative glyph-drift / marquee" from the no-infinite-loop rule; already RM-guarded. |
| Kiosk ambient halos/breathe/pulse/sparkle (infinite) | tailwind.config.js:106-176 + kiosk panels | **KEEP (kiosk-scoped)** | Presentation/TV surface (Track J Kiosk), its own aesthetic; ambient loops guarded. But its **entrance** animations need RM guards (Task 3 gap). |
| Wizard confetti + sparkle (one-shot celebration) | [Celebration.jsx](../../src/components/wizard/v2chrome/Celebration.jsx) + index.css:1747-1756 | **KEEP** | One-shot, RM-guarded, a deliberate success moment. Not systemic. |
| Spinners (`animate-spin`) on loaders | WizardForm, AutosaveChip, BulkImport modals | **KEEP or reconcile with §1** | §1 says "skeletons, never spinners" for load states — but these are inline action-spinners (submit/import in-progress), arguably fine. Flag: confirm none is a *page-load* spinner that §1 would ban. |
| Goal-donut `0.45s` / role-bar `0.4s` fills | index.css:1020, 1841 | **MIGRATE + clamp decision** | Exceed §2's ~320ms content ceiling. Keep as intentional data-reveal, or clamp to `--dur-3`. |
| Recharts (animation already off) | KPICard:50, CashFlowChart:85/95 | **KEEP off** | No reconciliation needed; sparklines/charts are static by choice. |

### Systemic vs per-screen scope line

- **SYSTEMIC (this track) — the token layer + shared components:**
  1. Wire `--dur-*`/`--ease-*` into `index.css` transitions **and** `tailwind.config.js` (`transitionDuration`/`transitionTimingFunction`/`animation` referencing the tokens).
  2. Build the **screen-enter** (fade + rise 8px) at the shell/tab-swap layer.
  3. Build a **staggered-assemble** helper (transform-only) usable by any screen's top-level blocks.
  4. Reconcile the **sheet/drawer** primitive to `--ease-spring` + backdrop fade + item stagger.
  5. Fix the reduced-motion contract holes: `useCountUp` guard, kiosk entrance guards (or a global `reduce` reset), skip-link gate, and the false comment at AOMCategoryColumn:26.
  6. Adopt `useCountUp` on shared KPI/hero numeral components (the hook is systemic; each screen's adoption is per-screen).
- **PER-SCREEN (rides Track-J, out of scope here):** applying the stagger/enter helpers to each individual dashboard/screen's specific blocks, per-screen count-up adoption on specific numerals, and any screen-unique choreography. This recon does **not** enumerate per-screen wiring.

---

## DECISIONS-NEEDED

**1. Mechanism — pure CSS/Tailwind vs introduce a JS motion library.**
The app has zero motion-lib footprint and a working CSS-first pattern. Screen-enter + stagger + sheet-spring are all expressible in CSS transitions/`@keyframes` + a tiny amount of state (a mount flag / `IntersectionObserver`), matching the existing idiom. **Recommendation: stay pure CSS/Tailwind + minimal JS** (extend the `useCountUp`/`matchMedia` pattern; no framer-motion). Owner call required before any build.
→ *What would overturn it:* see Rule 23 note below.

**2. Which ad-hoc motions migrate to tokens vs stay vs drop.** Specifically:
   - (a) Migrate all `index.css` hardcoded `.12–.35s` transitions to `--dur-*`/`--ease-*`? (recommend yes)
   - (b) The two **>320ms** fills (goal-donut `0.45s`, role-bar `0.4s`) — clamp to `--dur-3` or keep as intentional long data-reveals? (owner call)
   - (c) Goal-carousel slide uses a **custom bezier** (`.4,0,.2,1`) ≠ `--ease-out` — normalize to the token or preserve? (owner call)
   - (d) Mobile drawer is currently `ease-out`; §2 says sheets use `--ease-spring` — adopt the spring (visible behavior change) or keep ease-out? (owner call)
   - (e) Keep kiosk's own animation vocabulary separate from the systemic tokens, or fold kiosk onto `--dur-*`/`--ease-*` too? (recommend keep kiosk separate — it's Track-J-owned)

**3. Systemic-vs-per-screen scope line (what this track ships vs defers to Track-J).** Confirm the split in Task 6: this track = token wiring + screen-enter + stagger helper + sheet reconcile + RM-contract fixes + shared count-up adoption; Track-J = per-screen application. Is building the **screen-enter at the shell/tab-swap layer** in-scope now, or deferred until the tab-switch architecture is confirmed? (The app is tab-based, not routed — screen-enter hooks into tab-content swap in [Shell.jsx](../../src/components/shell/Shell.jsx)/dashboards, which is a shared surface, hence proposed in-scope.)

**4. Reduced-motion enforcement approach — keep per-usage, or add a global `reduce` reset.** Today the contract is per-component (Layer A/B/C) with documented holes (`useCountUp`, kiosk entrances, skip-link). Options: **(a)** keep the per-usage model and just patch the three holes; or **(b)** add a global `@media (prefers-reduced-motion: reduce)` safety-net reset now that motion is going systemic (belt-and-suspenders, but the base-is-visible invariant must hold everywhere first). **Recommendation: (a) + patch holes**, because the app's base end-states are already the visible ones and a global killer risks stranding any future `opacity`-entrance; but this is explicitly an owner call flagged by §2's hard rule. Also decide: fix the misleading comment at [AOMCategoryColumn.jsx:26](../../src/components/kiosk/panels/AOMCategoryColumn.jsx) as part of the track (recommend yes — it's a correctness/documentation trap).

---

## Known gaps (Rule 22)

- **Not verified in a running browser.** This is a static source audit; I did **not** boot the app to observe motion timings, confirm which transitions actually fire, or measure the reduced-motion degradation live. The `>320ms` ceiling violations and the "screen-enter is absent" claim are inferred from source, not observed. A preview smoke (both themes, reduced-motion emulation on/off) would confirm.
- **`functions/` deliberately not read** (per brief) — if any server-driven surface (e.g. email templates) carries motion, it is outside this map. Believed none, unverified.
- **Tab-switch architecture not fully traced.** I identified the app as tab-based (no router) and named [Shell.jsx](../../src/components/shell/Shell.jsx) as the screen-enter host, but did **not** trace the exact tab-content mount/unmount path that a screen-enter animation would hook into — that tracing is a Phase-1 task for the build brief, and it directly affects DECISIONS-NEEDED #3.
- **The 304 Tailwind `transition-*`/`animate-*` occurrences were counted, not each individually classified.** The inventory covers every distinct *mechanism* and all *config-defined animations* + `index.css` transitions with citations, but per-utility-call classification across all 100 component files is per-screen scope (Track-J), not done here.

## Rule 23 — falsifiability for the mechanism recommendation (DECISION #1)

**Claim:** stay pure CSS/Tailwind + minimal JS; do not introduce a motion library.
**What would overturn it:** if the build brief's screen-enter / staggered-assemble / sheet-spring requirements turn out to need **orchestrated, interruptible, list-reordering, or shared-element/FLIP transitions** (e.g. items animating between positions on reorder, or enter/exit choreography that must survive rapid tab-switching without stranding state) — cases where hand-rolled CSS + mount flags become brittle — then a purpose-built library (framer-motion / `motion`) would be justified. The current §2 spec (fade+rise, transform-only stagger, spring sheet, count-up) does **not** require any of those, so the recommendation holds unless the scope in DECISION #3 expands beyond §2's four approved motions.
