# Recon — Nexus v2 Reskin Surface Map

**Date:** 2026-07-05 · **Branch:** `recon/reskin-surface` · **Mode:** READ-ONLY recon (no source edits, no deploy, no merge)
**Canonical new contract:** `docs/design-system/tokens/app.css` (camelCase tokens scoped `.nexus` / `.nexus.dark`)
**Canonical app rules:** `docs/design-system/guidelines/redesign-addendum.md` (wins over `readme.md` for app surfaces)
**Scope note:** Pure React/frontend track. `functions/` was NOT read or inventoried (out of scope, per brief).

---

## Summary

The current app is **already deeply tokenized** — this is a favorable reskin surface, not a hardcoded-hex swamp. Every runtime color resolves through CSS custom properties defined in a single global file (`src/index.css`), and even Recharts and SVG donuts consume `var(--color-*)` rather than literals. The reskin is therefore primarily a **token-value + token-name reconciliation**, not a component rewrite.

Four facts dominate every downstream decision:

1. **The brief's `src/styles/index.css` path is wrong.** The one and only global stylesheet is [`src/index.css`](src/index.css) (1758 lines). All light tokens live in `:root` ([lines 8–226](src/index.css:8)); all dark overrides in `.dark` ([lines 228–319](src/index.css:228)).
2. **Dark mode is a `.dark` class on `document.documentElement`** — set pre-mount in [`src/main.jsx:19`](src/main.jsx:19), toggled in [`src/components/shell/TopBar.jsx:18,20`](src/components/shell/TopBar.jsx:18). The new file scopes tokens under `.nexus` / `.nexus.dark`, which **does not match** the shipped mechanism. `.nexus` appears in **0 runtime files** (only 1 test). This forces DECISION 1.
3. **The app relies on channel-split `--X-channels` triplets** for Tailwind alpha modifiers (`bg-primary/30`, `text-primary/70`, etc.) — **483 such usages across 80 files**. The new `app.css` provides only solid hex/rgba, **no channel-split forms**. A naïve token paste breaks all 483. This is the single biggest mechanical hazard (DECISION 2).
4. **A name collision:** current `--color-ink` is the **purple categorical accent** ([index.css:94](src/index.css:94)); new `--ink` is **body text**. New `--inkAccent` is the purple. Any mechanical `text→ink` rename collides (DECISION 3).

Hardcoded-hex holdouts in JSX are minimal and mostly a) the react-pdf report (correctly exempt) or b) two `#fff`/`#ffffff` literals. Fonts currently load from **CDN only**; the committed local woff2 package is not wired.

---

## Task 1 — Token definitions (where the app DEFINES tokens/colors)

**Only one global stylesheet exists:** [`src/index.css`](src/index.css). Glob for `src/**/*.css` returns exactly `src/index.css`. There is no `src/styles/` directory. All definitions are in two blocks.

### Structure & scope

| Block | Location | Purpose |
|---|---|---|
| `:root` | [`index.css:8–226`](src/index.css:8) | Light-mode token definitions (+ theme-independent presentation & medal tokens) |
| `.dark` | [`index.css:228–319`](src/index.css:228) | Dark-mode overrides (channel-split colors only; presentation/medal NOT redeclared) |

Each migrated color is defined in **dual form** ([rationale at index.css:9–21](src/index.css:9)):
`--X-channels: R G B` (space-separated triplet, feeds Tailwind alpha) **and** `--color-X: rgb(var(--X-channels))` (derived alias). `-tint` and pre-baked rgba tokens are kept static.

### Token inventory (light `:root` → dark `.dark`)

| Token (`--color-*` / channels) | Light value | `:root` line | Dark value | `.dark` line |
|---|---|---|---|---|
| `bg` | `#F7F6F2` (247 246 242) | [24–25](src/index.css:24) | `#1A1612` (26 22 18) | [234–235](src/index.css:234) |
| `surface` | `#FFFFFF` | [26–27](src/index.css:26) | `#252019` (37 32 25) | [236–237](src/index.css:236) |
| `surface-raised` | `#FAFAF8` (250 250 248) | [28–29](src/index.css:28) | `#302A23` (48 42 35) | [238–239](src/index.css:238) |
| `surface-muted` | `#F0EFE9` (240 239 233) | [30–31](src/index.css:30) | `#1F1B16` (31 27 22) | [240–241](src/index.css:240) |
| `text` | `#28251D` (40 37 29) | [34–35](src/index.css:34) | `#F0EBE0` (240 235 224) | [244–245](src/index.css:244) |
| `text-muted` | `#6B6560` (107 101 96) | [36–37](src/index.css:36) | `#B8AEA0` (184 174 160) | [246–247](src/index.css:246) |
| `text-faint` | `#A8A39C` (168 163 156) | [38–39](src/index.css:38) | `#8A8074` (138 128 116) | [248–249](src/index.css:248) |
| `border` | `#E5E2DB` (229 226 219) | [42–43](src/index.css:42) | `#3A3530` (58 53 48) | [252–253](src/index.css:252) |
| `border-strong` | `#CCC8C0` (204 200 192) | [44–45](src/index.css:44) | `#4A4540` (74 69 64) | [254–255](src/index.css:254) |
| `primary` | `#01696F` (1 105 111) | [48–49](src/index.css:48) | `#4AB5B8` (74 181 184) | [258–259](src/index.css:258) |
| `primary-dark` | `#014E52` (1 78 82) | [50–51](src/index.css:50) | `#01696F` (1 105 111) | [260–261](src/index.css:260) |
| `primary-light` | `#018A91` (1 138 145) | [52–53](src/index.css:52) | `#6DC8CB` (109 200 203) | [262–263](src/index.css:262) |
| `primary-tint` | `#e6f4f4` | [54](src/index.css:54) | `rgba(74,181,184,.15)` | [264](src/index.css:264) |
| `success` / tint | `#2D7A4F` / `#e8f5ee` | [57–59](src/index.css:57) | `#5DB876` / rgba .15 | [267–269](src/index.css:267) |
| `warning` / tint | `#B45309` / `#fef3e2` | [60–62](src/index.css:60) | `#E8B53E` / rgba .15 | [270–272](src/index.css:270) |
| `danger` / tint | `#C0392B` / `#fde8e7` | [63–65](src/index.css:63) | `#D96B5D` / rgba .15 | [273–275](src/index.css:273) |
| `danger-ink` | `#B22B1D` (178 43 29) | [72–73](src/index.css:72) | `#F6887A` (246 136 122) | [279–280](src/index.css:279) |
| `warning-ink` | `#A24100` (162 65 0) | [74–75](src/index.css:74) | `#E8B53E` (232 181 62) | [281–282](src/index.css:281) |
| `success-ink` | `#1F6C41` (31 108 65) | [76–77](src/index.css:76) | `#64BF7D` (100 191 125) | [283–284](src/index.css:283) |
| `gold` / tint | `#8A6011` (138 96 17) / `#fdf3dc` | [91–93](src/index.css:91) | `#E0AA3E` / rgba .14 | [288–290](src/index.css:288) |
| `ink` **(purple accent)** / tint | `#5A3FA0` (90 63 160) / `#f0ecff` | [94–96](src/index.css:94) | `#A995E0` / rgba .14 | [291–293](src/index.css:291) |
| `shadow-sm/md/lg` | warm-toned rgba | [99–101](src/index.css:99) | pure-black rgba | [296–298](src/index.css:296) |

**Theme-independent token groups (defined in `:root` only, NOT overridden in `.dark`):**

- **Nexus Glass recipe** (~40 tokens): light `--glass-l-*` [108–118](src/index.css:108); dark `--glass-d-*` [124–133](src/index.css:124); S2 hero panes `--glass-hero-l-*` / `--glass-hero-d-*` [140–162](src/index.css:140); hero-ink set `--hero-ink*` / `--hero-accent` / `--hero-dot-*` / `--hero-chip-*` [164–172](src/index.css:164).
- **Presentation tokens** (always-dark MeetingMode/kiosk surface): `--presentation-*` / `--color-presentation-*` [191–208](src/index.css:191). Explicitly theme-independent by design ([rationale 174–190](src/index.css:174)).
- **Medal palettes** (8 gradient sets + pip): `--color-medal-*` [217–225](src/index.css:217) (light) and re-declared [310–318](src/index.css:310) (dark, same 1–8 values, only `--color-medal-pip-active` shifts bronze).

---

## Task 2 — Tailwind wiring

[`tailwind.config.js`](tailwind.config.js) — `darkMode: 'class'` ([line 8](tailwind.config.js:8)). Naming style is **kebab-case**. Colors use functional `rgb(var(--X-channels) / <alpha-value>)` so opacity modifiers resolve ([rationale 16–22](tailwind.config.js:16)).

| Utility root | Maps to | Config line |
|---|---|---|
| `primary` / `.dark` / `.light` / `.tint` | `--primary-channels` / `--primary-dark-channels` / `--primary-light-channels` / `--color-primary-tint` | [24–29](tailwind.config.js:24) |
| `surface` / `.raised` / `.muted` | `--bg-channels` / `--surface-raised-channels` / `--surface-muted-channels` | [30–34](tailwind.config.js:30) |
| `card` / `.raised` | `--surface-channels` / `--surface-raised-channels` | [35–38](tailwind.config.js:35) |
| `ink` / `.muted` / `.faint` | `--text-channels` / `--text-muted-channels` / `--text-faint-channels` | [39–43](tailwind.config.js:39) |
| `border` | `--border-channels` | [44](tailwind.config.js:44) |
| `gold` / `.tint` | `--gold-channels` / `--color-gold-tint` | [45–48](tailwind.config.js:45) |
| `success` / `.tint` / `.ink` | `--success-channels` / `--color-success-tint` / `--success-ink-channels` | [49–53](tailwind.config.js:49) |
| `warning` / `.tint` / `.ink` | `--warning-channels` / `--color-warning-tint` / `--warning-ink-channels` | [54–58](tailwind.config.js:54) |
| `danger` / `.tint` / `.ink` | `--danger-channels` / `--color-danger-tint` / `--danger-ink-channels` | [59–63](tailwind.config.js:59) |
| `presentation` / `.text` / `.muted` / `.accent` / `.border` / `.gold` / `.hot` | `--presentation-*-channels` / static rgba | [68–77](tailwind.config.js:68) |
| `boxShadow` sm/md/lg | `--shadow-sm/md/lg` | [79–83](tailwind.config.js:79) |
| `fontFamily` sans/display/mono | hardcoded family strings (`'Satoshi'`, `'Cabinet Grotesk'`, `'JetBrains Mono'`) | [11–15](tailwind.config.js:11) |

> **Wiring gap for the swap:** Tailwind maps to **kebab** names (`--primary-channels`, `--color-text-faint`). The new `app.css` uses **camelCase** solid tokens (`--tealDark`, `--inkFaint`) with **no `-channels` triplet**. Neither the names nor the alpha substrate line up — see DECISION 2.

**`ink` utility ambiguity:** Tailwind's `ink` maps to `--text-*` (body text). But CSS var `--color-ink` (index.css:95) is the **purple accent**. So `text-ink` (Tailwind) ≠ `var(--color-ink)` (CSS). This existing dual meaning compounds the DECISION 3 collision.

---

## Task 3 — Dark-mode mechanism (determines the scoping decision)

| Concern | Implementation | Location |
|---|---|---|
| Toggle mechanism | `.dark` class on `document.documentElement` (`<html>`) | [main.jsx:17,19,24](src/main.jsx:17) |
| Toggle fn | `document.documentElement.classList.toggle('dark')` | [TopBar.jsx:18](src/components/shell/TopBar.jsx:18) |
| Persistence key | `localStorage.agencytrack-dark` (`'1'`/`'0'`) | [main.jsx:19](src/main.jsx:19), [TopBar.jsx:20](src/components/shell/TopBar.jsx:20) |
| Pre-mount restore (no FOUC) | reads localStorage, adds `.dark` before React mount | [main.jsx:18–25](src/main.jsx:18) |
| Kiosk force-dark | `/kiosk/` path force-adds `.dark`, ignores user pref | [main.jsx:13–17](src/main.jsx:13) |
| Sidebar-collapse (same pattern) | `.sidebar-collapsed` on `<html>`, key `agencytrack-sidebar-collapsed` | [main.jsx:22–24](src/main.jsx:22) |

**Blast-radius evidence (why scoping matters):**

- **24** `.dark`-prefixed selectors in `index.css` (1 is the token block; ~23 are component overrides like `.dark .btn-primary` [355](src/index.css:355), `.dark .glass` [411](src/index.css:411), `.dark .role-hero` [725](src/index.css:725), `.dark .goal-tab.active` [796](src/index.css:796), `.dark .medal-locked` [635](src/index.css:635), `.dark .tier-pip.dim` [676](src/index.css:676)).
- **215** `dark:` Tailwind variants across **89** component files (Tailwind `darkMode:'class'` keys off `.dark`).
- **`.nexus` in runtime code: 0 files.** Only [`src/utils/__tests__/contrast.test.js`](src/utils/__tests__/contrast.test.js) references it (a test, not runtime).

The new tokens scope under `.nexus` (light) / `.nexus.dark` (dark) and additionally set `background/color/font-family` on `.nexus` plus baseline resets (`.nexus button` [app.css:143](docs/design-system/tokens/app.css:143), `.nexus :where(...):focus-visible` [146](docs/design-system/tokens/app.css:146), reduced-motion `.nexus *` [154](docs/design-system/tokens/app.css:154)). **Adopting `.nexus` requires introducing a wrapper class the runtime has never used, and co-managing it everywhere `.dark` is set** (3 sites in main.jsx + the toggle + kiosk force-dark). See DECISION 1.

---

## Task 4 — Hardcoded-hex / inline holdouts

Grep `#[0-9a-fA-F]{3,8}` over `src/**/*.jsx` returned 59 matches across 31 files, **but the large majority are PR-number comments** (`#391`, `#723`, `#715` — hex-shaped false positives). The genuine color holdouts:

| file:line | value | context | Themeable? |
|---|---|---|---|
| [AgentReportDocument.jsx:23–43](src/components/profile/AgentReportDocument.jsx:23) | 21 hex (`#01696f`, `#f7f6f2`, `#28251d`, …) | react-pdf `COLORS` palette | **(b) intentionally fixed** — react-pdf cannot resolve CSS vars; EXEMPT per CLAUDE.md. Confirmed. |
| [kiosk/Avatar.jsx:35](src/components/kiosk/Avatar.jsx:35) | `'#fff'` | avatar initials text color on colored bg | (b) mostly fixed — always-dark kiosk surface; low value in tokenizing |
| [dashboard/HomeV2/MiniViz.jsx:70](src/components/dashboard/HomeV2/MiniViz.jsx:70) | `'#ffffff'` | white glyph on a dynamically-passed `background: color` chip | (b) fixed — white-on-accent by design |
| [awards/awardPrimitives.jsx:16](src/components/awards/awardPrimitives.jsx:16) | `#f59e0b`/`#4ab5b8`/`#a89a85` | **comment only** — documents mock hex that is *intentionally NOT used* | n/a — already tokenized ([awardPrimitives.jsx:36–40](src/components/awards/awardPrimitives.jsx:36) uses `var(--color-gold/primary/text-faint)`) |

**Inline `style={{…}}`:** 391 occurrences across 68 files — but the overwhelming majority are **layout/animation, not color** (dynamic widths, `--progress-target`, animation delays, `size`/`flexShrink`). Color-bearing inline styles that were sampled resolve to tokens, e.g. [awardPrimitives.jsx:66](src/components/awards/awardPrimitives.jsx:66) `color: accentColor` where `accentColor` is a `var(--color-*)`. The exception is again [AgentReportDocument.jsx](src/components/profile/AgentReportDocument.jsx) (131 inline styles — react-pdf `StyleSheet`, exempt).

**Recharts / SVG-chart color props — already tokenized (no hardcoded hex):**

| file | color source | line |
|---|---|---|
| [CommissionPlayground/.../CashFlowChart.jsx](src/components/goals/CommissionPlayground/components/CashFlowChart.jsx) | `MODE_COLORS` → `var(--color-primary)` / `var(--color-gold)`; axes/grid → `var(--color-border)`, `var(--color-text-muted)` | [10–13, 62–91](src/components/goals/CommissionPlayground/components/CashFlowChart.jsx:10) |
| [dashboard/KPICard.jsx](src/components/dashboard/KPICard.jsx) | sparkline `stroke="var(--color-primary)"` | [47](src/components/dashboard/KPICard.jsx:47) |
| [awards/awardPrimitives.jsx](src/components/awards/awardPrimitives.jsx) `AwardDonut` | `stroke={accentColor}` = `var(--color-*)` | [36–63](src/components/awards/awardPrimitives.jsx:36) |

Other Recharts consumers (`PersistencyTab.jsx`, `kiosk/panels/UnitLeaderboardPanel.jsx`) matched the pattern grep; spot-checks show the same `var(--color-*)` convention. **No hardcoded chart palettes were found.**

**`--color-presentation-*` / MeetingMode confirmation:** Definitions are in `:root` only ([index.css:191–208](src/index.css:191)), theme-independent as memory hypothesized — **confirmed**. Consumers: 29 files matching `presentation|data-kiosk|data-meeting-mode`, including [`manager/MeetingMode.jsx`](src/components/manager/MeetingMode.jsx), [`kiosk/KioskShell.jsx`](src/components/kiosk/KioskShell.jsx), and the `kiosk/panels/*` set. CSS behavior hooks: `[data-kiosk] .glass` [457–491](src/index.css:457), `[data-meeting-mode] .glass` [494–503](src/index.css:494).

---

## Task 5 — Font loading

**Current (CDN only):** `@import` at the top of [`index.css:1–2`](src/index.css:1):
- [line 1](src/index.css:1) — Fontshare CDN: **Satoshi** (400,500,700) + **Cabinet Grotesk** (700,800).
- [line 2](src/index.css:2) — Google Fonts CDN: **JetBrains Mono** (400,500).

Family strings are then hardcoded in [`index.css` (`html`/`h1–h4`, sidebar, topbar, donut)](src/index.css:324) and in [`tailwind.config.js:11–15`](tailwind.config.js:11). Grep for `@font-face`/`woff2` in `src/` returns **only** the Fontshare `@import` — **no local `@font-face`, no woff2 wired into the app.** [`index.html`](index.html) loads no fonts (only `main.jsx`).

**New (committed, NOT wired):** local woff2/woff package at [`docs/design-system/assets/fonts/`](docs/design-system/assets/fonts/) (17 files) with the `@font-face` reference sheet at [`docs/design-system/tokens/fonts.css`](docs/design-system/tokens/fonts.css):
- Cabinet Grotesk 400/500/700/800/900 ([12–36](docs/design-system/tokens/fonts.css:12)), Satoshi 400/500/700 ([39–50](docs/design-system/tokens/fonts.css:39)), General Sans 400/500/600/700 ([53–68](docs/design-system/tokens/fonts.css:53), *available, not the body token*), JetBrains Mono via CDN ([9](docs/design-system/tokens/fonts.css:9)).

**Confirmed:** the app currently loads these families **from CDN**, not from the committed woff2. Wiring the local files = replace the two `@import`s + copy woff2 into a served path (`public/` or `src/assets`) with corrected `src:` URLs. See DECISION 7.

---

## Task 6 — Screen / route inventory

**The app is NOT react-router.** Top-level routing is a `pathname` split in [`main.jsx:13–38`](src/main.jsx:13) plus role-based conditional rendering in `AppRoot` ([App.jsx:99–146](src/App.jsx:99)).

| # | Render target | Trigger | Location |
|---|---|---|---|
| 1 | `KioskRoute` | path starts `/kiosk/` (always dark) | [main.jsx:7,30](src/main.jsx:7) |
| 2 | `ResetPasswordHandler` | `?mode=resetPassword&oobCode` | [App.jsx:107](src/App.jsx:107) |
| 3 | `EmailVerificationHandler` | `?mode=verifyEmail&oobCode` | [App.jsx:110](src/App.jsx:110) |
| 4 | `LoadingScreen` | `loading` | [App.jsx:32–42,114](src/App.jsx:32) |
| 5 | `LoginScreen` | unauthenticated | [App.jsx:115](src/App.jsx:115) |
| 6 | `PlatformAdminStubScreen` | role `platform_admin` | [App.jsx:44–69,116](src/App.jsx:44) |
| 7 | `TenantAdminDashboard` (lazy) | role `tenant_admin` | [App.jsx:23,124](src/App.jsx:124) |
| 8 | `ManagerDashboard` (lazy) | roles `unit_manager`/`branch_manager`/`sales_manager` | [App.jsx:22,126](src/App.jsx:126) |
| 9 | `AgentDashboard` (lazy) | role `agent` | [App.jsx:21,131](src/App.jsx:131) |
| 10 | `ProvisioningScreen` | authed, role/profile unresolved | [App.jsx:76–97,130,134](src/App.jsx:76) |

**Count: 10 top-level render targets.** The **39 app screens** cited in the DS/addendum are the *internal tab surfaces* inside the 3 role dashboards (driven by [`src/components/shell/navConfig.js`](src/components/shell/navConfig.js)), not top-level routes.

**Theme-sensitive edge cases to flag for the reskin:**
- **Kiosk** — force-dark ([main.jsx:15–17](src/main.jsx:15)); uses `[data-kiosk]` no-blur glass fallbacks ([index.css:457–491](src/index.css:457)) + presentation tokens. Ignores user theme.
- **MeetingMode** — `[data-meeting-mode]` reduced-glass ([index.css:494–503](src/index.css:494)) + presentation tokens.
- **PDF export** ([AgentReportDocument.jsx](src/components/profile/AgentReportDocument.jsx)) — always-light hardcoded hex; theme-independent; EXEMPT.

---

## Task 7 — Token name-gap analysis (current → new `app.css`)

New contract read from [`docs/design-system/tokens/app.css`](docs/design-system/tokens/app.css) (`.nexus` [24–91](docs/design-system/tokens/app.css:24), `.nexus.dark` [93–135](docs/design-system/tokens/app.css:93)).

### (a) Direct matches — rename + rescope (value equal unless flagged)

| Current (`--color-*`) | New (`--*`) | New line | Value note |
|---|---|---|---|
| `bg` | `bg` | [26](docs/design-system/tokens/app.css:26) | equal `#F7F6F2` |
| `surface` | `surface` | [27](docs/design-system/tokens/app.css:27) | equal `#FFFFFF` |
| `surface-raised` | `surfaceRaised` | [28](docs/design-system/tokens/app.css:28) | equal `#FAFAF8` |
| `surface-muted` | `surfaceMute` | [30](docs/design-system/tokens/app.css:30) | equal `#F0EFE9` |
| `text` | `ink` | [33](docs/design-system/tokens/app.css:33) | equal `#28251D` ⚠ **collides w/ current `--color-ink`** |
| `text-muted` | `inkMute` | [34](docs/design-system/tokens/app.css:34) | equal `#6B6560` |
| `text-faint` | `inkFaint` | [35](docs/design-system/tokens/app.css:35) | ⚠ **VALUE CHANGE** `#A8A39C`→`#7A7264` (AA fix) |
| `border` | `rule` | [39](docs/design-system/tokens/app.css:39) | equal `#E5E2DB` |
| `border-strong` | `ruleStrong` | [40](docs/design-system/tokens/app.css:40) | Δ `#CCC8C0`→`#CFCBC2` (~1%) |
| `primary` | `teal` | [43](docs/design-system/tokens/app.css:43) | equal `#01696F` |
| `primary-light` | `tealLight` | [44](docs/design-system/tokens/app.css:44) | equal `#018A91` |
| `primary-dark` | `tealDark` | [45](docs/design-system/tokens/app.css:45) | equal `#014E52` |
| `primary-tint` | `tealTint` | [46](docs/design-system/tokens/app.css:46) | equal `#E6F4F4` |
| `gold` | `gold` | [47](docs/design-system/tokens/app.css:47) | ⚠ **VALUE CHANGE** `#8A6011`(AA-darkened)→`#B07D1A`(mock) + new `goldInk` `#8A6010` for text |
| `gold-tint` | `goldTint` | [48](docs/design-system/tokens/app.css:48) | Δ `#FDF3DC`→`#FAEFD3` |
| `success` / tint | `success` / `successTint` | [52](docs/design-system/tokens/app.css:52) | equal / equal |
| `warning` / tint | `warning` / `warningTint` | [53](docs/design-system/tokens/app.css:53) | equal / equal |
| `danger` / tint | `danger` / `dangerTint` | [54](docs/design-system/tokens/app.css:54) | equal / equal |
| `ink` **(purple)** / `ink-tint` | `inkAccent` / `inkAccentTint` | [55](docs/design-system/tokens/app.css:55) | equal `#5A3FA0` / `#F0ECFF` ⚠ **name collision** |

### (b) Current tokens with NO new equivalent (need decision)

| Current | Line | Note |
|---|---|---|
| `--*-channels` triplets (every color) | throughout `:root`/`.dark` | **No channel-split forms in `app.css`.** Substrate for 483 opacity modifiers (DECISION 2). |
| `--color-success-ink` / `--color-warning-ink` / `--color-danger-ink` | [72–77](src/index.css:72) | New has only `goldInk`; no per-semantic text inks. |
| `--shadow-sm/md/lg` | [99–101](src/index.css:99) | `app.css` defines no shadow tokens. |
| Nexus Glass recipe `--glass-*` (~40) | [108–172](src/index.css:108) | `app.css` hero model is only `heroA/B/Ink/Faint`; canonical glass lives in separate `tokens/glass.css`. |
| Hero-ink set `--hero-ink*`/`--hero-accent`/`--hero-dot-*`/`--hero-chip-*` | [164–172](src/index.css:164) | New `heroInk`/`heroFaint` only. |
| `--presentation-*` (MeetingMode/kiosk) | [191–208](src/index.css:191) | No equivalent; theme-independent. Keep. |
| `--color-medal-1..8-*` + pip | [217–225](src/index.css:217) | No equivalent. Keep static. |

### (c) New tokens the app does NOT yet consume

| New token | Line | Note |
|---|---|---|
| `surfaceSoft` | [29](docs/design-system/tokens/app.css:29) | New 5th surface tier; app has 4. |
| `inkDim` | [36](docs/design-system/tokens/app.css:36) | **New non-text role.** App currently overloads `text-faint` for both text + non-text — the AA hazard the DS split fixes. |
| `goldInk` | [49](docs/design-system/tokens/app.css:49) | App instead AA-darkens `--color-gold` inline. |
| `heroA`/`heroB`/`heroInk`/`heroFaint` | [60–63](docs/design-system/tokens/app.css:60) | App uses the richer glass hero set instead. |
| `skeleton` | [66](docs/design-system/tokens/app.css:66) | State-design token (addendum §1 requires skeletons); app has no skeleton token. |
| `display`/`sans`/`mono` (font tokens) | [69–71](docs/design-system/tokens/app.css:69) | App hardcodes family strings in CSS + Tailwind config. |
| `ease-out`/`ease-spring`/`dur-1/2/3` | [78–82](docs/design-system/tokens/app.css:78) | App hardcodes durations inline (`0.15s`/`0.18s`/`0.2s`/`0.35s`). |
| `focus`/`focus-offset` | [85–86](docs/design-system/tokens/app.css:85) | App hardcodes `outline: 2px solid var(--color-primary)` at every focus site. |
| `app-w`/`app-h` | [74–75](docs/design-system/tokens/app.css:74) | Prototype frame; app doesn't use. |

---

## Task 8 — Core component locations (locations only)

| Concept | Location | One line |
|---|---|---|
| **Button** | **No component.** CSS classes `.btn-primary` [index.css:342](src/index.css:342), `.btn-secondary` [index.css:362](src/index.css:362) (+ `.dark .btn-primary` override [355](src/index.css:355)) | Buttons are `@apply` utility classes, not a `<Button>` React component. |
| **Card** | **No component.** CSS class `.card` [index.css:368](src/index.css:368) | Card is a single `@apply` class (`rounded-xl p-6 shadow-sm border`). `CardStack.jsx` is wizard-specific, unrelated. |
| **App shell** | [`src/components/shell/Shell.jsx:25`](src/components/shell/Shell.jsx:25) | Wraps every dashboard; owns `<main>`, sidebar collapse, topbar chrome, bottom-nav. |
| **Sidebar / nav** | [`src/components/shell/Sidebar.jsx:27`](src/components/shell/Sidebar.jsx:27) | `<nav aria-label="Primary navigation">`; CSS `.sidebar*` [index.css:1020–1272](src/index.css:1020). |
| **Topbar** | [`src/components/shell/TopBar.jsx:16`](src/components/shell/TopBar.jsx:16) | Title/crumb/search + dark toggle; CSS `.topbar*` [index.css:1306](src/index.css:1306). |
| **Mobile nav** | [`src/components/shell/MobileBottomNav.jsx`](src/components/shell/MobileBottomNav.jsx), [`MobileNavDrawer.jsx`](src/components/shell/MobileNavDrawer.jsx) | Bottom-nav + "More" drawer; CSS `.bottom-nav*` [index.css:1446](src/index.css:1446). |
| Existing real UI atoms | [`ui/StatusPill.jsx`](src/components/ui/StatusPill.jsx), [`gamification/BadgeGrid.jsx`](src/components/gamification/BadgeGrid.jsx), [`ui/Avatar.jsx`](src/components/ui/Avatar.jsx) | Reference points for component-convention deltas. |

**Convention delta to weigh (foundation vs follow-up):** the new grammar carries radius (`rounded-2xl`/16px hero), the glass tier, a `--focus` ring token, and motion tokens. Because Button/Card are **CSS classes not components**, restyle is a class-body edit (low reflow risk), but there is no single `<Button>`/`<Card>` seam to swap — the reskin edits `.btn-*`/`.card` in `index.css` directly.

---

## DECISIONS-NEEDED

**1. Scoping model — `.nexus`/`.nexus.dark` vs un-scope to `:root`/`.dark`. → Recommend UN-SCOPE.**
- *Adopt `.nexus`*: paste tokens under `.nexus`/`.nexus.dark`; requires adding a `.nexus` wrapper the runtime has never carried (`.nexus` in **0** runtime files) and co-managing it at all 3 `.dark` sites in [main.jsx](src/main.jsx:17) + the [toggle](src/components/shell/TopBar.jsx:18) + kiosk force-dark. Presentation/medal tokens (currently `:root`, consumed by kiosk which adds `.dark` but not `.nexus`) would also need rehoming.
- *Un-scope to `:root`/`.dark`* (recommended): drop the `.nexus`/`.nexus.dark` prefixes, land new token bodies in the existing `:root`/`.dark` blocks. **Zero** changes to main.jsx, the toggle, kiosk, the 24 `.dark` selectors, or 215 `dark:` variants — the `.dark` mechanism is untouched; only token names/values change. The `.nexus` baseline resets (`.nexus button` [143](docs/design-system/tokens/app.css:143), focus-visible [146](docs/design-system/tokens/app.css:146), reduced-motion [154](docs/design-system/tokens/app.css:154)) rehome to bare/`:root` selectors.
- **Rule 23 (what would overturn UN-SCOPE):** evidence that the app bundle co-hosts a second themed region in the same DOM (e.g. an embedded marketing surface needing `.nexus` to isolate token scope), a near-term requirement to mount multiple themes per document, or DS acceptance tests that assert on `.nexus` presence. Checked and currently negative: no `src/**/{marketing,landing}` dir (glob empty); marketing is a separate deploy (`agencytrack.app`); `.nexus` is referenced only by one test. If any of those flips, prefer `.nexus`.

**2. Opacity-modifier substrate — regenerate `--X-channels` triplets, or migrate 483 consumers.** The new `app.css` has no channel-split forms; **483** `bg-/text-/ring-/border-X/NN` modifier usages across **80** files depend on them (and Tailwind config maps every color to `rgb(var(--X-channels)/<alpha>)`). The foundation swap MUST either (a) emit a `--X-channels` triplet for each new token and keep the derived-alias pattern, or (b) rewrite 80 files off alpha modifiers. **(a) is strongly indicated.** This is the biggest mechanical item and is independent of DECISION 1.

**3. `--color-ink` (purple) vs new `--ink` (text) name collision.** Current `--color-ink` = purple categorical accent → new `--inkAccent`; new `--ink` = body text ← current `--color-text`. Tailwind's `ink` utility already means *text* while CSS `--color-ink` means *purple*. Owner must choose the rename map so no site silently flips purple↔text (e.g. `.ai-ink`/`.activity-pill-ink`/`.role-bar-fill-ink` consume the purple `--color-ink` at [index.css:951,974,1723](src/index.css:951)).

**4. Value reconciliations — which value wins.** Enumerate + rule per token: `inkFaint` AA fix `#A8A39C`→`#7A7264` **and** adopt new `inkDim` for non-text (the app currently overloads faint); `gold` `#8A6011`(AA-darkened, app) vs `#B07D1A`(mock, new) + whether to adopt `goldInk` for on-tint text; `border-strong`→`ruleStrong` (`#CCC8C0`→`#CFCBC2`); `gold-tint` delta; `surface-muted`→`surfaceMute` **+** whether to add the new `surfaceSoft` tier. The app's current values already passed a deterministic contrast suite ([`src/utils/__tests__/contrast.test.js`](src/utils/__tests__/contrast.test.js)) — any value change re-opens that gate.

**5. Holdouts — stay fixed vs get themed.** Recommend **stay fixed**: AgentReportDocument.jsx hex palette ([23–43](src/components/profile/AgentReportDocument.jsx:23), react-pdf, EXEMPT); `--presentation-*` + medal palettes (theme-independent by design); `kiosk/Avatar.jsx:35 '#fff'` and `HomeV2/MiniViz.jsx:70 '#ffffff'` (white-on-accent, low value). **Separate call:** glass-recipe reconciliation — the app's `--glass-*` (index.css) vs the DS `tokens/glass.css` + `app.css`'s slimmer `heroA/B/Ink/Faint`. Is glass in-scope for the foundation pass or a follow-up? (Recommend follow-up — glass is its own subsystem and `app.css` doesn't fully carry it.)

**6. Component-convention deltas (task 8) — foundation pass or follow-up.** Button/Card are CSS classes (`.btn-primary`/`.card`), so radius/shadow/glass/focus-ring restyle is an `index.css` class-body edit, not a component refactor — low reflow risk, no `<Button>`/`<Card>` seam. Decide whether the foundation pass also adopts the `--focus` token ([85](docs/design-system/tokens/app.css:85)) and motion tokens ([78–82](docs/design-system/tokens/app.css:78)) at every hardcoded focus/transition site, or defers those to a follow-up.

**7. Font wiring — now or later.** Now = replace the two CDN `@import`s ([index.css:1–2](src/index.css:1)) with local `@font-face` (port [`tokens/fonts.css`](docs/design-system/tokens/fonts.css)) and copy the 17 woff2/woff files from [`docs/design-system/assets/fonts/`](docs/design-system/assets/fonts/) into a served path (`public/` or `src/assets`) with corrected `src:` URLs. Later = keep CDN through the foundation pass, wire local fonts as a separate PR. (Families are unchanged either way — Satoshi/Cabinet Grotesk/JetBrains Mono — so this is a delivery-path decision, not a visual one.)

**8. New token-group adoption — in foundation or deferred.** `skeleton` (addendum §1 makes skeletons *required* on every data surface — currently zero skeleton token/primitive in the app), motion tokens, and `focus`/`focus-offset` are net-new capabilities, not renames. Decide whether the foundation pass introduces them (enabling the state-design + motion work the addendum mandates) or ships tokens-only and defers behavior.

---

## Known gaps (Rule 22)

- **Not exhaustively enumerated:** the 483 opacity-modifier lines (80 files) and 391 inline-style lines (68 files) were **counted and sampled**, not transcribed line-by-line. The holdout classification is representative; a full per-line table would require reading every file. Confidence that no hardcoded chart/color palette hides in the tail is high (grep-driven) but not 100%.
- **Glass/brand/marketing token files not opened.** I scoped the contract to `app.css` per brief. `docs/design-system/tokens/{glass,brand,marketing}.css` exist and likely carry the canonical glass/brand tokens the app's `--glass-*` should reconcile against — flagged in DECISION 5 but not diffed here.
- **`app-v2.css` filename discrepancy:** [`redesign-addendum.md:21`](docs/design-system/guidelines/redesign-addendum.md:21) calls the merged result `tokens/app-v2.css`, but only `tokens/app.css` exists (its header says it *is* the v2 reconciliation and "supersedes tokens/app.css"). I treated `app.css` as canonical (its `--inkFaint` = `#7A7264` matches the addendum's v2 column). Worth an owner confirmation that no separate `app-v2.css` is expected.
- **`.nexus` test reference not opened:** [`src/utils/__tests__/contrast.test.js`](src/utils/__tests__/contrast.test.js) is the only file referencing `nexus`; I did not read it to confirm whether it already imports the new token file (relevant to DECISION 4's contrast-gate re-open).
- **"39 app screens"** is taken from the DS/addendum copy, not independently counted from [`navConfig.js`](src/components/shell/navConfig.js). I inventoried the 10 top-level render targets directly.
- **Static recon only** — no build run, no rendered visual diff. All findings are source-derived.
