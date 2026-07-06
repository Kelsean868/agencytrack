# AgencyTrack — Nexus Design System

**AgencyTrack** is a multi-tenant insurance agency-management SaaS for Caribbean life-insurance agencies, built in Trinidad & Tobago. It tracks agent activity, reconciles commissions against carrier settlements, and runs goals, awards and recognition — deliberately *not* a CRM. Roles: Agent → Unit Manager → Branch Manager → Sales Manager, plus CRO/back office and Tenant Admin.

One brand, two surfaces:

1. **Marketing** — public site (landing, resources, legal). Warm, editorial, trust-first. **Light only** (a near-black `--dark #0E0B07` section is the deliberate rhythm break).
2. **App ("Nexus")** — the product portal. Denser, functional, **light + dark modes**, plus the "Nexus Glass" hero-card tier.

## Sources
- Attached codebase `design-system/` (read-only local mount): `shared-brand.css`, `marketing/tokens.css` + README, `app/tokens.css` + `app/glass.css` + README, and `reference/` production files (`index.html` marketing homepage, `subpage.css`, `app-tokens.jsx` icon/palette source, `app-shell.jsx`, `nexus-glass-recipe.html`).
- Uploaded brand assets: `assets/logo-shield.svg`, `assets/favicon.svg`, `assets/og-image.png`.
- Live: agencytrack.app · portal.agencytrack.app · hello@agencytrack.app

## CONTENT FUNDAMENTALS

**Tone:** domain-fluent, honest, no overclaiming. Written by someone who has lived the insurance-agency floor. Vocabulary used without apology: *clawback, persistency, settlement, NTU, company floor, API (annualized premium income), delivery register, Master Sheet, joint call, fact finds*.

**Voice & person:** direct second person for the buyer ("Run your agency on one rhythm"), third person for roles ("Agents log it once. The CRO confirms it."). Founder speaks first person in resources ("fifteen years on the agent side of the standoff").

**Headline style:** short declaratives with a full stop — "One rhythm, start to finish." "Performance, made visible." "Read before you decide." Hero verbs: *turn activity into production*. Sentence case everywhere; never Title Case headlines.

**Microcopy patterns:**
- Mono uppercase eyebrows, often numbered: `01 · PLAN`, `THE TRUST GATE`, `YTD · SETTLED API`, `★ THIS WEEK · LEADERBOARD` (★ prefix marks live/recognition content).
- Currency is always `TTD` prefixed and compact: `TTD 24.5K`, `TTD 2.40M`, `TTD 950` (see `ttd()` rule below).
- Sample data uses Trinidad & Tobago names: Marsha Singh, Anand Persad, Selina Mohammed, Anil Boodram, Kareem Mohammed, Carla Joseph, Devin Lewis, Sara Khan, Hema Lakhan. Carriers/products: Tatil Life, Platinum Edge, Term Life 20, policy numbers like `TL-08661`.
- Status labels are mono/uppercase and banded: `ON PACE` / `AT FLOOR` / `BELOW`, `✓ MATCH` / `CONFLICT`, `26 DAYS LEFT` / `+3 DAYS OVER`.
- **No emoji, ever.** ★ and ✓ unicode glyphs are the only ornaments.
- Honest qualifiers welcomed: "what spreadsheets still do well", "Never a CRM — deliberately."

## VISUAL FOUNDATIONS

**Color.** Teal `#01696F` is the *meaning* color — numbers, CTAs, links, active nav, eyebrows. Gold `#B07D1A` strictly for recognition/awards/campaigns — nothing else. Warm neutrals everywhere: cream `#F4F2EC` ground (marketing), warm inks (`#26231C`/`#28251D` → `#A8A39C`). Semantic success/warning/danger (+tints) exist **only in the app**. Violet `#5A3FA0` sparingly, app lists only. WhatsApp green only on the chat FAB. 1–2 background colors per page max.

**Dark mode (app only)** is a *warm* dark: ground `#1A1612`, warm inks `#F0EBE0→#8A8074`, never gray/blue-black. Teal & gold **brighten** (`#4AB5B8` / `#E0AA3E`); tints become alpha washes; rules become light alpha hairlines `rgba(240,235,224,.08)` — never dark lines. Everything AA in both modes.

**Type.** Cabinet Grotesk 700/800 display, −0.03em tracking, lh 1.05; Satoshi 400/500/700 body; JetBrains Mono for eyebrows (11–12px/700/.18–.22em uppercase), timestamps, currency in tables, policy numbers, KPI labels. Marketing: hero clamp(36–58px), h2 clamp(28–40px), body 17px lh 1.7. App: page titles ~31px, card numbers 24–30px display, body 13–14.5px.

**Spacing & layout.** Marketing: 1080px wrap (720px prose), 28px side pad, 72–110px sections, grid+18px gap. App: 1280×800 desktop frame, 232px sidebar, 60px topbar, 24–28px content padding, tight cards.

**Radii.** Buttons 11–12px; cards 14–18px (app) / 18px (marketing); panels 20–22px; pills 999px. Avatars: initials tiles — circles (people) or 12px-radius squares (roles).

**Borders & shadows.** Cards are 1px `--rule` border on `--paper`/`--surface`, mostly shadowless at rest; shadow arrives on hover (`0 14px 34px rgba(38,35,28,.09)`) with translateY(-1px..-4px) lift. CTA shadow is teal-tinted. Dark panels get deep teal/black shadows. Inner top highlight only on glass.

**Backgrounds.** Flat colors, no images, no mesh/radial blur. Decorative motifs: drifting 1.5px-stroke teal line-glyph fields at 13% opacity (hero), text marquees, thin gradient progress bars (`linear-gradient(90deg, tealDark, teal)` — the ONE allowed gradient use, plus medal radials). **Never gradient buttons.**

**Glass ("Nexus Glass", app hero tier only).** One glass card max per screen, top-of-screen summary only. Light: white 62% base + 18px blur + saturate 135% + teal hairline + inset highlight. Dark: thinner (55% dark base, 20px blur, light hairline). Teal or gold context tint painted as a 135° fade. Opaque fallbacks for kiosk / `prefers-reduced-transparency` (`#EAF3F3`/`#F6EEDD` light, `#15201F`/`#221C12` dark). Regular cards/tables/nav: never glass. Marketing: never glass (nav backdrop-blur excepted).

**Motion.** Fast and quiet: .15–.18s ease transitions; reveal-on-scroll one-shot fade+translateY(20px) with .d1–.d3 stagger; count-ups with cubic ease-out; no infinite loops on content (marquee/glyph drift are decorative exceptions); respect `prefers-reduced-motion`. Hover = lift + shadow (+ border-color to teal-ish); ghost buttons darken border.

**Anti-patterns (hard rules).** No gradient buttons; no mesh-blur backgrounds; no emoji; no stock photos or generated faces (avatars are initials tiles); no purple/indigo as brand color; no cool grays.

## ICONOGRAPHY

Inline SVG line icons, 24px viewBox, stroke 1.8, round caps/joins — Lucide-style, hand-rolled in the codebase (copied into `components/icons/Icon.jsx`: home, wizard, history, chart, target, wallet, medal, shield, bolt, repeat, book, users, grid, settings, search, bell, sun, moon, chevrons, arrow, check, alert, trophy, filter, download, plus, clock). Icons are functional (nav, actions, statuses) — never decorative grids. Marketing hero uses larger 32px-viewBox 1.5-stroke glyphs at 13% opacity as a drifting field. No icon font. No emoji. Unicode ★ (live/recognition) and ✓ (checks) are used as text glyphs. Logo: teal `#014E52` rounded tile + shield + rising white activity bars + `#4ECDC4` dot (`assets/logo-shield.svg`, inline-SVG version in `components/icons/AgencyLogo.jsx`).

## Currency rule

`ttd(n)`: ≥1M → `TTD 2.40M` (2dp) · ≥1K → `TTD 24.5K` (1dp) · else `TTD 950`. Always the TTD prefix, mono or display font per context.

## Using the tokens

- Link root `styles.css`. Marketing tokens live on `:root` (kebab-case: `--ink-mute`, `--teal-tint`).
- App tokens are scoped: wrap app UI in `class="nexus"` (light) or `class="nexus dark"` (dark) — camelCase names (`--inkMute`, `--tealTint`). This scoping is the one deviation from the source (source app tokens were `:root`/`.dark` in an app-only bundle; here both surfaces share one stylesheet).
- Glass classes: `.glass.teal` / `.glass.gold` inside a `.nexus` (or `.nexus.dark`) scope.

## Index

- `styles.css` → `tokens/` — fonts, brand, marketing, app (light+dark), glass. Plus app component styles: `components/app/nexus-patterns.css`, `nexus-nav.css`.
- `assets/` — logo-shield.svg, favicon.svg, og-image.png.
- `components/core/` — Button, Eyebrow, Card, Callout, Pill, Avatar.
- `components/icons/` — Icon (+27 named icons, plus a `name=` API: home, users, grid, bell, repeat, check, plus, target, arrow, pin), AgencyLogo.
- `components/app/` — Scorecard, GlassCard, Sidebar, Topbar, AppShell, Money.
- `components/app/` (2026 redesign, v2) — **state design:** StateLayer, SkeletonScreen, EmptyState, ErrorState, CountUp · **navigation:** SideNavSections, MobileTab, MobileMore, MobileCreateSheet, CommandPalette · **hooks** (`nexus-hooks.jsx`): usePrefersReducedMotion, useCountUp, useFocusTrap, useStress, useTouchReorder.
- `ui_kits/marketing/` — homepage recreation (`index.html`).
- `ui_kits/nexus/` — agent portal on the **v2 nav** (drag-reorder sidebar, ⌘K command palette, adaptive mobile bar + sheets), light/dark switchable (`index.html`, `shell.jsx`, `screens.jsx`).
- `templates/marketing-page/` — starting point: the editorial cream landing (relocated marketing screen).
- `templates/nexus-portal/` — starting point: the Nexus agent portal shell on the v2 nav.
- `guidelines/` — foundation specimen cards.
- `guidelines/redesign-addendum.md` — **the app v2 rules doc:** state design, motion, navigation, dense tables, accessibility (WCAG 2.2 AA), + the token reconciliation table. Wins over this readme for **app** surfaces.
- `STYLE-GUIDE.html` — living style guide: tokens, type, controls, state design, dense tables, motion + a11y, rendered in both themes.
- `SKILL.md` — agent-skill entry point.

**Intentional additions:** `Money` (wraps the source's `ttd()` helper as a render component); app-token `.nexus` scoping (above). Source's `RoleSwitcher` (a mock-navigation aid, not a product primitive) was folded into the Sidebar as an optional prop.

**Font status:** **Cabinet Grotesk** (display, 400/500/700/800/900) and **Satoshi** (body, 400/500/700) are both shipped locally from `assets/fonts/` — no CDN needed. **JetBrains Mono** loads from Google Fonts. **General Sans** (400/500/600/700) is also shipped locally and registered as a `@font-face`, but is **not** the canonical body font: the brand body is Satoshi, so `--brand-sans`/`--sans` point at Satoshi. To switch the body to General Sans, repoint those two tokens (in `tokens/brand.css` and `tokens/app.css`).
