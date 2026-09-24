# AgencyTrack — UI/UX & Accessibility Audit (Live App)

**Date:** 2026-07-04
**Target:** Production — `https://portal.agencytrack.app`
**Standards:** WCAG 2.2 AA, Nielsen usability heuristics, the app's Nexus design-system rules.
**Scope:** Read-only live audit. No source changes, no commits, no records created (see §6 Cleanup register — empty).
**Companion:** Merges with the code audit master table in `docs/audits/agencytrack-audit-2026-07-04.md`.

---

## Method note (how the credentialed audit was driven — and a measurement caveat)

The login screen was audited with the browser directly. **The authenticated audit was driven by a Node + Playwright harness (same Chromium engine) reading test-account credentials from `process.env`, never through a browser tool parameter** — because typing a test password into an MCP tool call would echo a secret into the transcript, which this project's credential-hygiene rules forbid. The harness reused the sanctioned `.env.local`→`process.env` pattern; credential **values never appear** in any artifact. Every screen was visited in all four cells (desktop 1440×900 / mobile 380×800 × light / dark), captured as a screenshot, and measured in-page (getComputedStyle / getBoundingClientRect / accessibility structure).

**Contrast-measurement caveat (important for reading this report):** The automated in-page contrast scan produced a **high false-positive rate** because `getComputedStyle().backgroundColor` returns transparent for CSS **gradients** and returns the pre-composited base for **alpha-tinted** backgrounds. The app uses gradient hero cards and 10%-alpha teal button tints extensively, so the scanner mis-scored white-on-teal-gradient and teal-on-tint text as failures. **All contrast findings below were therefore verified by visual inspection of the screenshots and by targeted precise re-measurement** (resolving real composited colors). Raw scan counts are treated as *candidates*, not failures. This is why the report's contrast conclusion is favorable despite the scanner flagging ~74 "violations" per role.

---

## 1. Executive summary

**Overall posture: strong.** Across 37 screens (agent, tenant-admin, branch-manager) in all four viewport/mode cells, the app is well-built for accessibility and usability: **zero console errors** anywhere, **no page-level horizontal scroll at 380px on any screen** (reflow passes; wide tables scroll within their own container), **visible focus rings** on controls, **properly associated form labels** (`label[for]`), **16px inputs** (no iOS zoom-on-focus), both custom fonts load, and a **dark mode that renders correctly and attractively** on authenticated screens (the Nexus "lifted teal" `#4ab5b8` is used on dark surfaces as designed). Sampled contrast — after correcting for the scanner's gradient/alpha artifacts — **passes AA** (primary buttons 6.46:1, teal-on-tint secondary buttons ≈5.5:1).

The genuine findings are concentrated and mostly low-to-moderate:

1. **Systematic missing document headings** — 33 of 36 authenticated screens have **no `<h1>`**, and 11 screens have **no heading elements at all**. Visually-prominent titles are styled `div`s, so assistive-technology users lose heading navigation on almost every screen. This is the highest-value fix.
2. **One sub-24px touch target** — the Money Needs "Share with my Unit Manager" control is 16×16px (WCAG 2.5.8 AA fail); plus a few sub-44px controls against the stricter Nexus 44px rule.
3. **Login ignores the saved dark preference** — the login screen always renders light even when the user has chosen dark.
4. **Bare empty states** on several manager surfaces (e.g. MasterSheet renders an empty white box).

**Top 5 UX/A11y risks**

| Rank | ID | Risk | Severity |
|------|-----|------|----------|
| 1 | A11Y-001 | 33/36 authenticated screens have no `<h1>`; 11 have no headings at all | Medium |
| 2 | A11Y-003 | Sub-24px touch target (Money Needs share control, 16×16) | Medium |
| 3 | A11Y-002 | Login screen ignores saved dark-mode preference | Low |
| 4 | UX-001 | Bare/uninformative empty states on manager tables | Low |
| 5 | A11Y-004 | Skip-to-content link likely absent with a ~20-item persistent sidebar | Low (needs-verification) |

**Counts by severity:** Critical 0 · High 0 · Medium 2 · Low 4 · Info 2.
**Counts by category:** Accessibility 4 · Usability 1 · Nexus/design 1 · Info/notes 2.

---

## Coverage map

All screens captured in **4 cells** (desktop-light, desktop-dark, mobile-light, mobile-dark) unless noted. 147 screenshots total (see §7).

| Role | Screens audited (4 cells each) | Not reached / notes |
|------|-------------------------------|---------------------|
| Unauthenticated | login | Login dark cell == light (finding A11Y-002: dark not applied) |
| Agent (15) | dashboard, daily-log, wizard, history, game-plan, money-needs, goals, commission, persistency, policy-ledger, financing, production-report, leaderboard, awards, career | "Planner" & "Prospect Prep" are `Soon`/disabled (correctly non-navigable — not a defect) |
| Tenant Admin (5) | dashboard, branches, users, config, campaigns | Slim admin surface; no operational manager screens by design |
| Branch Manager (16) | overview, mastersheet, team-perf, compliance, settlements, financing, policy-reconciliation, team-wars, team-game-plans, goals, persistency, agent-of-month, kiosk, production-report, my-war, campaigns | Meeting Mode launches from within Overview/Compliance ("Start Meeting") — not drilled into; multi-step wizard/daily-capture flows and modals not deep-audited (see §8) |

**Reachability:** every enumerated screen loaded successfully in all four cells (0 load errors, 0 console errors). No unreachable/erroring screens.

---

## 2. Prioritized master table

| ID | Title | Severity | Category | WCAG/Heuristic | Effort | Priority |
|----|-------|----------|----------|----------------|--------|----------|
| A11Y-001 | No `<h1>` / missing headings on 33/36 screens | Medium | Accessibility | 1.3.1 (A), 2.4.6 (AA) | M | P1 |
| A11Y-003 | Sub-24px touch target (Money Needs share control) | Medium | Accessibility | 2.5.8 (AA) | S | P1 |
| A11Y-002 | Login ignores saved dark-mode preference | Low | Nexus/Consistency | 1.4.3 rendering / consistency | S | P2 |
| UX-001 | Bare empty states on manager tables | Low | Usability | Nielsen: visibility of status | S | P2 |
| A11Y-004 | Skip-to-content link likely absent | Low | Accessibility | 2.4.1 (A) | S | P2 (verify) |
| A11Y-005 | Sub-44px controls vs Nexus 44px rule (mobile inputs, "Start Meeting") | Low | Accessibility/Nexus | 2.5.8 pass / Nexus fail | S | P3 |
| INFO-001 | Audit screenshots contain test-tenant email addresses | Info | Privacy (artifact) | — | S | P3 |

---

## 3. Findings by dimension

### A. Accessibility (WCAG 2.2 AA)

---

**A11Y-001 — Missing document headings: 33/36 authenticated screens have no `<h1>`; 11 have no headings at all**
- **Category / mapping:** WCAG 1.3.1 Info & Relationships (A), 2.4.6 Headings & Labels (AA).
- **Severity:** Medium — heading navigation is a primary assistive-technology wayfinding mechanism; on almost every screen it yields nothing, and screens with zero headings give AT users no in-page structure at all.
- **Confidence:** Confirmed (DOM facts, gradient-independent).
- **Evidence:** desktop-light measurement across roles:
  - Agent: 12/15 screens have `h1Count=0`; **5 screens have no `h1–h4` at all** (`history`, `persistency`, `financing`, `production-report`, `awards`).
  - Tenant Admin: **5/5 screens have no `<h1>`**; `admin-users` has no headings at all.
  - Branch Manager: **16/16 screens have no `<h1>`**; 5 have no headings at all (`mastersheet`, `settlements`, `financing`, `goals`, `persistency`).
  - The visually-prominent titles are styled non-heading elements — e.g. the awards hero "Persistency Award — Silver" (`awards-dark-desktop.png`), the BM banner "Welcome back, Smoke Branch Manager" (`bm-mastersheet-light-desktop.png`), and the agent dashboard hero are large text, not `<h1>`/`<h2>`.
- **User-impact scenario:** A screen-reader user pressing "H" / using the rotor to jump between headings hears nothing on the dashboard, users list, MasterSheet, financing, settlements, awards, etc. — they must read linearly through the whole sidebar and page every time.
- **Recommendation:** Promote each screen's existing visual title to a semantic `<h1>` (one per screen), and mark section titles as `<h2>`/`<h3>` in order. No visual change required — the text already exists and is styled; only the tag/`role` changes.
- **Impact if fixed:** Restores heading navigation app-wide for AT users; improves SEO-irrelevant-but-real document semantics; trivial visual risk.
- **Effort:** M (many screens, but mechanical) · **Change-risk:** Low.

---

**A11Y-003 — Sub-24px touch target: Money Needs "Share with my Unit Manager" control (16×16px)**
- **Category / mapping:** WCAG 2.5.8 Target Size (Minimum) (AA — 24×24 CSS px).
- **Severity:** Medium — a genuine AA target-size failure on an interactive control (the share/visibility opt-in), hard to hit for motor-impaired and touch users.
- **Confidence:** Confirmed (getBoundingClientRect: 16×16, in all four cells).
- **Evidence:** `agent / money-needs` measurement: `[{"nm":"Share with my Unit Man","w":16,"h":16}]`. It is the only control app-wide measured under the 24px AA floor.
- **User-impact scenario:** An agent trying to toggle whether their money-needs worksheet is shared with their manager must hit a 16px target — easy to miss on mobile, and it gates a privacy-relevant action.
- **Recommendation:** Enlarge the control's hit area to ≥24×24 (ideally the Nexus 44×44) via padding or an enlarged label/tap wrapper. No layout redesign needed.
- **Impact if fixed:** Closes the one confirmed AA target-size fail; improves a privacy-control's usability.
- **Effort:** S · **Change-risk:** Low.

---

**A11Y-002 — Login screen ignores the saved dark-mode preference**
- **Category / mapping:** Nexus dark-mode integrity / consistency (WCAG 1.4.3 is met in both themes; this is a preference-persistence/consistency defect, not an AA contrast failure).
- **Severity:** Low — the login screen renders light even when the user previously chose dark; a dark-preferring user gets a bright flash on every sign-in.
- **Confidence:** Confirmed. With `localStorage['agencytrack-dark'] = '1'` set, the login page reports `document.documentElement.classList.contains('dark') === false` and body bg `#f7f6f2` (light). The restore logic (`src/main.jsx:19`) keys on `=== '1'`, but the login route does not apply it (dashboards do — dark works correctly once authenticated).
- **User-impact scenario:** Field agents who prefer dark (glare, night use) hit a full-brightness login screen every session; minor but repeated.
- **Recommendation:** Apply the same pre-mount dark restore to the login route (or don't gate the restore behind authenticated layout). Also honor `prefers-color-scheme` for first-run.
- **Impact if fixed:** Consistent theming end-to-end; removes the light flash.
- **Effort:** S · **Change-risk:** Low.

---

**A11Y-004 — Skip-to-content link likely absent with a ~20-item persistent sidebar**
- **Category / mapping:** WCAG 2.4.1 Bypass Blocks (A).
- **Severity:** Low · **Confidence:** Needs-verification.
- **Evidence:** Every authenticated screen renders a persistent sidebar of ~15–27 nav items before `main`. Accessibility-tree captures show `nav`/`header`/`main` landmarks present (so AT users *can* jump to `main` via landmarks — a partial mitigation), but no skip link surfaced in any snapshot. A keyboard-only user without landmark support must Tab through the entire sidebar on every screen.
- **Recommendation:** Add a visually-hidden "Skip to main content" link as the first focusable element, targeting the `main` landmark. **Verify** current presence via a keyboard Tab from page top.
- **Effort:** S · **Change-risk:** Low.

---

**A11Y-005 — Controls under the Nexus 44px rule (mobile number inputs ~34px; "Start Meeting" 40px)**
- **Category / mapping:** WCAG 2.5.8 (these **pass** the 24px AA floor) vs the stricter **Nexus 44px** rule.
- **Severity:** Low — not a WCAG AA failure, but below the project's own 44px minimum.
- **Confidence:** Confirmed. Mobile Commission number inputs measure 184×34; BM "Start Meeting" 144×40. (Desktop's large sub-44 count is dominated by inline text links, which are exempt under 2.5.8.)
- **Recommendation:** Bump input min-height and the "Start Meeting" button to 44px to meet the Nexus rule; leave inline text links as-is.
- **Effort:** S · **Change-risk:** Low.

---

**Accessibility — verified PASS (no finding):**
- **Reflow / 1.4.10 (AA):** No page-level horizontal scroll at **380px on any of the 37 screens**; wide manager tables (MasterSheet) scroll **within their container**, which is correct.
- **Contrast / 1.4.3 (AA):** Sampled screens pass after correcting scanner artifacts — primary buttons white-on-teal **6.46:1**, secondary teal-on-10%-tint **≈5.5:1**, dark mode uses lifted teal `#4ab5b8` on warm-dark surfaces (visually verified on `awards-dark-desktop.png`, `game-plan-dark-desktop.png`). No confirmed AA contrast failure in the sample.
- **Focus visible / 2.4.7 (AA):** Focus rings present on inputs and buttons (box-shadow ring; browser outline on the "Forgot password" link).
- **Name, Role, Value / 4.1.2, Labels / 3.3.2:** Form inputs have associated `<label for>` (Commission Playground: 11 inputs, **0 unnamed**); the login show-password toggle has an accessible name.
- **Input purpose / iOS zoom:** Text inputs are 16px (no focus-zoom on iOS).

---

### B. Nexus design-system conformance

- **Dark mode integrity (authenticated): PASS.** All 36 authenticated screens render correctly in dark; the lifted-teal token is applied on dark surfaces (not the light `#01696f`), warm-dark card hierarchy is coherent, no light-mode "flash" or foreign-ink leakage observed in the sampled screenshots. The one dark-mode gap is the **login screen** (A11Y-002).
- **Fonts:** Satoshi (body) + Cabinet Grotesk (display) load (`document.fonts.status === 'loaded'`); no FOUT/fallback observed.
- **Buttons:** No gradient buttons on interactive controls; gradients are confined to decorative hero cards. Primary = solid teal + white text; secondary = teal text on 10%-teal tint — both measured to pass AA.
- **Token discipline (rendered):** No hardcoded non-token colors surfaced in the sampled rendered styles beyond the sanctioned gradient/tint hero treatments. (The code audit separately notes inline-style debt at the source level — ARCH-002 there.)

### C. Usability heuristics (Nielsen)

**UX-001 — Bare empty states on manager tables** *(Visibility of system status / Aesthetic-minimalist balance)*
- **Severity:** Low · **Confidence:** Confirmed.
- **Evidence:** `bm-mastersheet-light-desktop.png` / `-mobile` — with no submissions, the table area is an empty white box with only a small "0 submissions • 0 submitted • 0 draft" caption below it. No in-table "No submissions this week" message or guidance.
- **User-impact:** A manager opening MasterSheet on a quiet week sees a blank card and may wonder whether it failed to load vs. genuinely empty.
- **Recommendation:** Add an explicit in-container empty state ("No submissions for this week yet") with an optional hint (e.g. nudge action). Apply consistently across manager tables/rosters.
- **Effort:** S · **Change-risk:** Low.

**Usability — positives observed:** consistent nav grouping (Pinned / Today / Planning / Tools / My Production / My Team), current-location highlighting in the sidebar, TTD currency + DD-MM-YYYY dates rendered consistently in sampled screens, and clear primary actions ("Add User", "Nudge all", "Export Branch Report"). "Soon" tabs (Planner, Prospect Prep) are visibly disabled and non-navigable — honest system status.

### D. Mobile-specific UX

- **Bottom nav + "More" drawer:** present and thumb-reachable at 380px (`bm-mastersheet-light-mobile.png` shows Dashboard/Team/Create/Reports/Profile/More; agent has Home/Create/History/Leaderboard/Profile/More).
- **Wide tables:** scroll horizontally **within the table container** (not the page) — correct responsive behavior.
- **No 380px page-level horizontal scroll** on any screen.
- **Numeric inputs:** `type="number"` triggers the numeric keyboard (good), but are ~34px tall on mobile (A11Y-005).

### E. Perceived performance

- **Zero console errors** across all 37 screens × 4 cells — no runtime error noise.
- **No layout-shift or blank-route errors** observed in captures; screens rendered content within the harness's post-navigation settle window. (Note: the code audit separately flags **no route/code-splitting** — PERF-001 there — as a cold-load weight concern; that is a build-level finding, corroborated here by the single-bundle SPA behavior but not re-measured for CLS in this pass.)

### F. Empty / error / edge states

- **New-ish account empty states:** agent screens rendered with sparse data showed content-appropriate states (no crashes/blank screens). The main gap is the **manager table empty state** (UX-001).
- **Long content / large values:** large TTD values (e.g. "TTD 532,777", "TTD 1,200,000") render without overflow in the sampled cards.
- **Offline behavior:** not exercised in this pass (see §8).

---

## 4. WCAG 2.2 AA conformance register (sampled)

| SC | Level | Status | Finding / evidence |
|----|-------|--------|--------------------|
| 1.3.1 Info & Relationships | A | **Partial fail** | A11Y-001 (missing headings app-wide); form label associations pass |
| 1.4.3 Contrast (Minimum) | AA | **Pass (sampled)** | Buttons 6.46:1; teal-on-tint ≈5.5:1; dark lifted-teal — visually verified |
| 1.4.4 Resize Text / 1.4.10 Reflow | AA | **Pass** | No 380px page h-scroll on any screen; tables scroll in-container |
| 1.4.11 Non-text Contrast | AA | Pass (sampled) | Focus rings / control borders visible in both themes |
| 2.4.1 Bypass Blocks | A | **Needs-verification** | A11Y-004 (skip link); `main` landmark present |
| 2.4.6 Headings & Labels | AA | **Partial fail** | A11Y-001 (few/no headings) |
| 2.4.7 Focus Visible | AA | Pass | Rings on inputs/buttons |
| 2.5.8 Target Size (Minimum) | AA | **Fail (1 instance)** | A11Y-003 (16×16 share control); A11Y-005 sub-44 pass AA |
| 3.3.2 Labels or Instructions | A | Pass | Inputs have associated `<label for>` |
| 4.1.2 Name, Role, Value | A | Pass (sampled) | Controls have accessible names in sampled screens |

Not evaluated this pass (see §8): 2.1.1/2.1.2 full keyboard operability of complex widgets, 1.4.13 hover/focus content, 2.4.3 focus order through modals, 3.3.1/3.3.3 form-error identification (no write flows exercised).

---

## 5. Quick wins & roadmap

**Quick wins (high value / low effort):**
1. **A11Y-001** — Promote each screen's existing visual title to a semantic `<h1>` (mechanical, app-wide, no visual change). Biggest AT improvement.
2. **A11Y-003** — Enlarge the Money Needs share control to ≥24×24 (ideally 44×44).
3. **A11Y-002** — Apply the dark-mode restore to the login route.
4. **A11Y-004** — Add a "Skip to main content" link (verify absence first).
5. **UX-001** — Add explicit empty-state copy inside manager tables.

**Phased roadmap:**
- **Phase 1 (accessibility polish, all S–M, low risk):** A11Y-001, A11Y-003, A11Y-004, A11Y-002. Pure a11y/consistency wins with no behavioral change.
- **Phase 2 (usability + Nexus):** UX-001 (empty states), A11Y-005 (44px targets), and a keyboard/modal focus-order pass (deferred item, §8).
- **Phase 3 (verification):** the deferred deep-audit items in §8 — modal focus traps, form-error association on write flows, offline behavior, and a real `npm run build` CLS/bundle measurement (ties to code-audit PERF-001).

---

## 6. Cleanup register

**No records were created, edited, or deleted.** The entire authenticated audit was read-only navigation + measurement; no forms were submitted and no "AUDIT-TEST" records exist. Nothing to clean up.

---

## 7. Screenshot index

147 PNGs under `docs/audits/ux/screenshots/`. Naming: `<screen>-<mode>-<viewport>.png` (`mode` ∈ light/dark, `viewport` ∈ desktop/mobile).

- **Login (3):** `login-light-desktop`, `login-dark-desktop` (renders light — A11Y-002), `login-light-mobile`.
- **Agent (15 screens × 4 cells = 60):** dashboard, daily-log, wizard, history, game-plan, money-needs, goals, commission, persistency, policy-ledger, financing, production-report, leaderboard, awards, career.
- **Tenant Admin (5 × 4 = 20):** admin-dashboard, admin-branches, admin-users, admin-config, admin-campaigns.
- **Branch Manager (16 × 4 = 64):** bm-overview, bm-mastersheet, bm-team-perf, bm-compliance, bm-settlements, bm-financing, bm-policy-recon, bm-team-wars, bm-team-gameplans, bm-goals, bm-persistency, bm-agent-of-month, bm-kiosk, bm-production-report, bm-my-war, bm-campaigns.

Cited in findings: `awards-dark-desktop.png`, `game-plan-dark-desktop.png`, `commission-light-desktop.png`, `bm-compliance-light-desktop.png`, `bm-mastersheet-light-desktop.png`, `bm-mastersheet-light-mobile.png`, `admin-users-dark-desktop.png`.

**INFO-001 — Audit artifacts contain test-tenant PII.** Several screenshots (e.g. `admin-users-dark-desktop.png`) show the test tenant's email addresses, which include the operator's own personal Gmail aliases used as test accounts. These are test-tenant data, but the screenshots should **not be shared externally** without redaction. Consider gitignoring `docs/audits/ux/screenshots/` or redacting the users-list captures before any public sharing.

---

## 8. Self-critique — known gaps in this audit

- **Contrast coverage is sample-based, not exhaustive.** Because the automated scanner was confounded by gradients/alpha tints, contrast conclusions rest on visual inspection of a **subset** of the 147 screenshots plus targeted precise re-measurement of the most-flagged controls. A per-element contrast pass with a gradient-aware sampler (or manual review of all 147) could surface a borderline case I did not catch. No confirmed AA contrast failure was found in the reviewed sample.
- **Keyboard operability was validated on login only.** Tab order, focus traps, and Escape behavior inside the app's **modals** (Daily Capture takeover, wizard steps, drawers) and complex widgets were **not** exercised. A11Y-004 (skip link) is marked needs-verification for the same reason.
- **No write flows were exercised** (read-only mandate honored strictly), so form-error identification/association (3.3.1/3.3.3), inline vs on-submit validation timing, and destructive-action confirmations are unassessed.
- **Not every surface was drilled into:** multi-step flows (wizard steps 1–5, daily-capture), modals/drawers, Meeting Mode, and unit-manager / sales-manager / platform-admin role views were not separately captured — the audit covered the primary agent, tenant-admin, and branch-manager screen sets.
- **Perceived-performance was observational, not instrumented:** no Lighthouse/CLS trace or real `npm run build` bundle measurement was run; the cold-load weight concern is carried by the code audit's PERF-001.
- **Heading finding severity** is set at Medium assuming AT users are in scope for the pilot; if the immediate pilot cohort is exclusively sighted mouse/touch users, its practical urgency is lower — but it remains a real conformance gap and a cheap fix.
