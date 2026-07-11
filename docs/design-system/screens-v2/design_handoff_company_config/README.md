# Handoff: Company Config — Tenant Admin Surface

## Overview

The **Company Config** surface is the tenant admin's control panel for customizing AgencyTrack for their whole insurance company — the tenant-admin counterpart to the agent-facing Settings/My Preferences. It expresses AgencyTrack's diff-only config model: a tenant's config document stores **only what differs from the code default**, every business-policy constant is on the path to tenant-configurable, and the UI makes the boundary of admin control visible rather than hiding it.

Product principles (locked, from the product owner):
1. **Every business-policy constant is eventually tenant-configurable.** Shipped values are Tatil Life's, serving as platform defaults. Locked treatments are *release states*, not permanent design.
2. **Diff-only storage** — absent key = code default = current behavior (exactly the existing `featureFlags` pattern; fail-closed).
3. **Effective-dated settings never rewrite history** — thresholds that judge past performance take effect from a date; past periods keep the value in force at the time.
4. **Corrections are a separate, friction-ful flow** — not a checkbox on the edit form.

## About the Design Files

The files in this bundle are **design references created in HTML** — working prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the AgencyTrack codebase's existing environment** (React + Firestore + Cloud Functions) using its established patterns: the Nexus v2 design system (`app.css` tokens, `.nexus`/`.nexus.dark` scoping), the existing app shell/sidebar, the existing `featureFlags` fail-closed read pattern, and the awards module's existing override plumbing (the audit found awards already ships full override support — replicate that pattern, do not invent a new one).

`Company Config Prototype.html` + the four `cc-proto-*.jsx` files are a **fully working interactive prototype** — run it in a browser to feel every interaction (drafts, save, reset, search, corrections, uploads, dark mode, narrow viewport). `Company Config Mockups.html` + its `company-config-*.jsx` / `app-*.jsx` files are the static design-canvas mockups (multiple states side by side, incl. dark variants and the unlock-tier plan).

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, and microcopy are final and derive from the Nexus v2 tokens. Recreate pixel-perfectly using the codebase's existing token variables (`var(--teal)`, `var(--rule)`, etc.) — never hard-code the hex values listed below; they are documented only so you can verify you're reading the right token.

## Information Architecture

Route: tenant-admin area → **Company Config**. In-screen left rail (NOT the app sidebar), 12 sections in 5 groups:

| Group | Sections | Phase |
|---|---|---|
| Brand | Identity & Branding · Organization | Future |
| Standards | Targets & Minimums · Reporting Cadence · Activity Standards | Targets + Activity = **Phase 1**; Cadence future |
| Recognition | Recognition & Gamification · Awards & Clubs | Awards = **Phase 1**; Gamification future |
| Operations | Financing Thresholds · Kiosk · Policy & Delivery | Future |
| Platform | Feature Flags · Data & Privacy | Flags = **Phase 1**; Data future |

Phase 1 ships first: **Targets & Minimums, Activity Standards, Awards & Clubs, Feature Flags**. Future sections are fully designed (build the UI data-driven so they light up by registry entry alone) and carry a `SOON` tag in the rail + a dashed "Future phase" banner in the body.

The entire surface is **registry-driven**: one data module (`cc-proto-data.jsx`) declares every section, group, and setting item (id, label, desc, control type, default value, lock state, dated flag). Rendering, search, drafts, provenance, and the audit log all derive from this registry. Recreate this architecture — it is what makes "find any setting in under 10 seconds" and future-phase unlocks cheap.

## The Setting-Row Grammar (core visual system)

Every row is in exactly one state. The grammar must read at a glance — weight + tone + a marker, never color alone (AA in both themes):

1. **INHERITED DEFAULT** — quiet. Faint mono `DEFAULT` tag right of the control. Fully editable. The common case, so visually silent.
2. **TENANT-OVERRIDDEN** — teal 6px dot before the label, teal (1.5px `var(--teal)`) control border, provenance line `Changed by {name} · {date}` + teal **Reset to default ({default value})** affordance with a reset icon.
3. **DRAFT (unsaved)** — teal dot + teal border + note `Unsaved — applies to everyone on save` + underlined `Undo` link. Draft state exists only client-side.
4. **PLATFORM-LOCKED** — label + value in `var(--inkMute)`, mono value text, pill chip `🔒 PLATFORM` (lock icon + mono uppercase, `surfaceMute` bg). Sub-line: "Platform-managed for now — on the roadmap to open up like everything else." Never hidden — the admin sees the boundary of their control.
5. **HARDCODED · UNLOCKS {TIER}** — real value shown, control disabled (0.55 opacity, `surfaceMute` bg), warning-toned chip (clock icon, `warningTint` bg, `var(--warning)` text): `HARDCODED · UNLOCKS TIER 2`. Sub-line: "Ships read-only for now — editing lands with its unlock tier." When the tier ships, the row keeps its layout and just loses the chip.

Row layout: flex, `flexWrap: wrap`, label column `flex: 1 1 220px; minWidth: 200px` (prevents label crush at mid widths — wide controls wrap below the label), control cluster right-aligned, `13px` vertical padding, `1px var(--rule)` separators between rows. Rows are wrapped in group cards: `var(--surface)` bg, `1px var(--rule)` border, radius 14, padding `16px 20px`, mono uppercase group eyebrow (10.5px/700/.14em) in `var(--teal)` — **`var(--gold)` for Recognition & Awards eyebrows only** (gold = recognition, nothing else).

## Screens / Sections

### Shell
- Tenant-admin sidebar (existing app sidebar component): Overview / **Company Config** / Users & Roles / Branches & Units / Audit Log / Billing; brand block "AgencyTrack · Tatil Life · Admin"; admin identity footer (initials tile, name, role).
- Header: page title (Cabinet Grotesk 20px/800), subtitle "How AgencyTrack runs for {company} — every change is logged", **Find a setting… ⌘F** search button (250px, `surfaceMute`, kbd chip), **Change history** button, dark-mode toggle.
- Content: left rail 216px + scrollable content column; content column bottom padding 90px so the floating save bar never covers rows.

### Left rail
Group eyebrows (mono 9.5px uppercase), section buttons 36px min height, active = `tealTint` bg + teal text + 3px teal left bar. Right-side markers: teal 6px dot = section contains overrides (committed or draft); outlined mono `SOON` tag = future phase. Footer legend: "● customized for {company}".

### Targets & Minimums (Phase 1)
- **Tenure-band minimums** — editable table (bare, no row chrome): columns Band (text input, 72px) / Tenure months (from–to number inputs, last band `∞ OPEN` disabled) / Annual API floor (currency input, right-aligned) / Weekly floor (derived, read-only mono, `annual ÷ 48`) / delete. "Add band" ghost button + helper copy: bands must cover month 0 onward with no gaps; last band open-ended. Table is effective-dated.
- **Pace & warnings** — Pace-warning threshold (number + `%`, ships overridden: 85, default 80, provenance "Changed by Alicia Gopaul · 12 Jun 2026"); Below-floor grace period (seg 1wk/2wk/4wk, default 2wk).
- **Club & company thresholds** — Company API floor (currency, **effective-dated with seeded history**: `TTD 9.60M from 1 Jan 2026 · was TTD 8.80M` + "Correct a past value…" link); MDRT threshold (currency TTD 1.02M, `HARDCODED · UNLOCKS TIER 2` — value is applied by Cloud Functions).

### Activity Standards (Phase 1)
- **Weekly company-floor standards** — fully editable table: name (text), per-week (number), **manager-overrides indicator** (read-only: `👥 3 managers override this`, em-dash when 0 — per-manager overrides live in the manager flow, not here), delete; "Add standard" button. Defaults: Calls Made 60, Contacts Made 40, Appointments 20, Interviews Kept 15, Fact Finds 10, Closing Interviews 10, Clients Sold 1, Referrals 100 (ovr counts: 3/3/1/0/2/0/0/5).
- **Counting rules** — "At floor" band (90%), Joint calls count toward minimums (toggle, on).

### Awards & Clubs (Phase 1, gold eyebrows)
- **Award catalog** — fully customizable table: name (text) / qualifying API (currency) / recognition (seg: Badge / Badge + trip) / **active toggle** (inactive rows at 0.6 opacity) / delete; "Add award". Defaults: Gold Club 1.80M Badge+trip · Silver Club 1.20M · Bronze Club 800K · MDRT Award 1.02M · Rising Star (first 24 months) 400K inactive. Helper: inactive awards stop qualifying new seasons — earned badges are never revoked. **Effective-dated.**
- **Season & basis** — Award season (Calendar year / Fiscal Oct–Sep); Announce qualifiers (Kiosk + app / App only / Managers only); Qualification basis = PLATFORM-LOCKED `SETTLED API ONLY`.

### Feature Flags (Phase 1)
- Info banner (shield icon, `surfaceMute`): "Flags are **fail-closed**: any flag absent from your tenant is off. Enabling takes effect immediately for all **214 users** and is written to the audit log."
- Flag rows: name + mono key chip (`persistency.v2_model` etc.) + description. OFF state: chip `NOT SET → OFF` + **danger-outlined** "⚠ Enable for everyone" button → inline confirm strip (`dangerTint` bg): "Turn on {flag} for all 214 users at {company}, effective immediately?" Cancel / danger-solid **Enable now**. ON state: `✓ ON` teal chip + provenance + quiet ghost "Disable". Flag flips commit immediately (no draft) and log.
- Flags: Persistency v2 model (seeded ON, by Alicia Gopaul · 2 Jun 2026) · Planner & Scheduler · Track K financing · Branch kiosk display · WhatsApp nudges. Only allowlisted flags appear.

### Identity & Branding (future phase; Zoho-style organization profile)
- **Brand marks** — Organization logo (wide slot 168×56) and Fav icon (56×56): dashed placeholder tile with image glyph → Upload/Replace ghost button + Remove link; preview `object-fit: contain`. Accept png/svg/jpeg/webp. In production store in tenant assets; prototype uses dataURL.
- **Contact info** — Organization name, Address, Short code (mono, uppercase), Report footer.
- **Super admin** — email PLATFORM-LOCKED (`A.GOPAUL@TATIL.CO.TT`; "Changing it is an ownership transfer — handled by AgencyTrack support"), phone editable.
- **Preferences** — Org namespace PLATFORM-LOCKED (`TATIL`, portal address), Fiscal year (seg Jan–Dec / Oct–Sep), Date format (seg `dd MMM yyyy` / `yyyy-mm-dd`, "display only — dates are stored the same way for every tenant"), Timezone & currency PLATFORM-LOCKED (`AST · UTC−4 · TTD`).

### Other future sections (fully specified in the registry)
Organization (career-level name chips, unit-size/span alerts) · Reporting Cadence (week start, WAR due day, monthly close, nudge schedule = `HARDCODED · UNLOCKS TIER 2`) · Recognition & Gamification (points scale table with editable names/codes/points + add/delete, `points applied at capture` = TIER 2, streak milestone number-chips with add/remove, streak grace toggle, leaderboard scope seg (seeded override: Branch, by Rajiv Maharaj · 4 Mar 2026), show-TTD toggle, celebration intensity Off/Subtle/Full) · Financing Thresholds · Kiosk · Policy & Delivery · Data & Privacy (PII on leaderboards = PLATFORM `NEVER`, audit retention = PLATFORM `FOREVER`). Exact items, defaults, and copy: see `cc-proto-data.jsx`.

## Interactions & Behavior

### Find a setting (⌘F / ⌘K)
Modal command palette (560px, 14vh from top, scrim `rgba(14,11,7,.4)`). Searches label + section + description + group across ALL sections. Result rows: section eyebrow (mono uppercase) + setting label + current-value preview (mono; `HARDCODED`/`PLATFORM` for locked). ↑↓ move, ↵ jump, Esc close; footer legend. **Jump** = switch section, scroll row into view (container scroll, ~84px offset — do NOT use scrollIntoView), flash the row (`tealTint` fade, 2s; static highlight under `prefers-reduced-motion`).

### Draft → Save lifecycle
Edits accumulate client-side as drafts (`{value, eff?}` per id; draft equal to base value auto-clears). Floating pill save bar, bottom-center (`var(--ink)` bg, radius 14): "{n} unsaved changes · Discard · Save changes" (teal solid). Save commits all drafts → each becomes `{value, who, date (+eff, was for dated)}` in the tenant config doc, writes one audit entry per setting, toast: "Saved {n} changes — applied to 214 users at Tatil Life". Reset-to-default stages a draft (`Will reset to default on save` + Undo); on save the key is **deleted** from the config doc (diff-only semantics — never write the default value back).

### Effective dating (dated items: tenure bands, company API floor, award catalog)
- Committed dated value shows history line (mono 11px): **`TTD 9.60M` from 1 Jan 2026 · was TTD 8.80M** + dotted-underline link "Correct a past value…". Undated settings show nothing extra — dating must not clutter immediate settings.
- Drafting a dated change adds to the draft note: `Takes effect [1 Aug 2026] · past periods keep the value in force at the time` (editable date field, teal border, defaults to next month's 1st).

### Correct a past value (friction-ful escape hatch)
Distinct danger modal (520px), opened only from the history line — deliberately NOT on the edit form: danger icon tile + "Correct a past value" (Cabinet Grotesk) + "{label} · in force since {eff}" → warning copy ("not a normal change… rewrites the value already used to score past periods… only for genuine mistakes, like a typo'd threshold") → warningTint consequence box ("Saving re-derives, for every affected period: pace flags on past WARs · award & club qualification · Master Sheet summaries. All 214 users see the corrected history.") → corrected-value input (mono) → **required reason** textarea ("REASON — REQUIRED, WRITTEN TO THE AUDIT LOG"; confirm disabled until ≥10 chars; helper "A few more words — the reason is the audit trail."). Confirm = danger solid **"Rewrite past periods"**. Writes an audit entry flagged `CORRECTION` (rendered in red in history, with the quoted reason).

### Change history
Right-side drawer (400px): per entry — section eyebrow (red + `CORRECTION ·` prefix when correction), label, `from → to` (mono; dated entries read "TTD 9.60M from 1 Jan 2026"), quoted reason if present, who · date. Footer: "Full audit trail lives in the Audit Log."

### Responsive (breakpoint 880px)
Narrow = section **list → drill-in**: sticky header (eyebrow + Cabinet Grotesk title; drill-in shows teal ‹ back link), search field on top, grouped section list (cards, 48px rows, teal dot + SOON tag + chevron), same section bodies, fixed bottom save bar (44px+ touch targets). Tables inside cards get `overflow-x: auto` with a min-width inner grid (bands 700px, standards 560px, clubs 700px, points 380px).

### Motion
.15s ease transitions (toggle knob, seg hover); row flash 2s fade; no infinite loops; respect `prefers-reduced-motion` (static tealTint instead of flash animation).

## State Management

```
committed: { [settingId]: { value, who, date, eff?, was? } }   // the tenant config doc — DIFF ONLY
draft:     { [settingId]: { value?, eff?, reset?: true } }      // client-side only
log:       [ { label, section, from, to, who, date, correction?, reason? } ]
ui:        activeSection · searchOpen · historyOpen · correctId · flash · dark
```

- `effective(id)` = draft ?? committed ?? codeDefault. `rowState(id)` = platform | soon | draft | reset | custom | default.
- Firestore shape (per audit): tenant config doc(s) keyed by section, read with fail-closed fallback — exactly the `featureFlags` pattern. Tier 1 keys are read by src only; Tier 2 keys (nudge schedules, onSubmissionWrite points, MDRT pace, tenure bands as CFs apply them) must be read by Cloud Functions **at runtime** (mind cold-start reads and the no-cross-bundle-import rule; this also retires the ESM/CJS dual-copy drift risk).
- Prototype persists to localStorage (`ccp-committed-v2`, `ccp-log-v2`, `ccp-dark`, `ccp-active`); production = Firestore + audit collection.
- Effective dating: store `{ value, eff }` history (prototype keeps latest + `was`; production should keep the full array and resolve by period).

## Design Tokens (verify against app.css — always use the vars)

- Teal `--teal #01696F` (light) / `#4AB5B8` (dark); `--tealTint`. Gold `--gold #B07D1A`/`#E0AA3E` — recognition eyebrows ONLY. Danger/warning + tints per app.css. Ground `#F0EEE9` light / `#1A1612` dark; `--surface`, `--surfaceMute`, `--rule`, `--ruleStrong`; inks `--ink`, `--inkMute`, `--inkFaint`.
- Type: Cabinet Grotesk (`--display`) section titles 22px/800/−0.025em, page title 20–21px; Satoshi (`--sans`) labels 13.5/600, desc 11.5, helper 11; JetBrains Mono (`--mono`) eyebrows/chips/values/kbd 8–13px.
- Radii: rows 8 · inputs/segs 9 · buttons 9–11 · cards 13–14 · modals 16 · pills 999. Currency via `ttd()` rule (`TTD 9.60M` / `TTD 24.5K` / `TTD 950`).
- Touch targets ≥44px on mobile; AA contrast both themes; no gradient buttons; no emoji (lock/clock/users/alert are stroke icons from the DS icon set).

## Assets

No external assets. Icons: DS icon set (`Icon name="search|history|clock|shield|check|alert|users|plus|sun|moon"`) plus four inline 24px-viewBox stroke-1.8–2.2 glyphs defined in `cc-proto-controls.jsx` (lock, reset, x, trash). Logo/favicon upload slots are user-supplied content with drawn placeholders.

## Files

Working prototype (primary reference — run it):
- `Company Config Prototype.html` — entry; DS bundle + stylesheet links, hover/focus/flash CSS
- `cc-proto-data.jsx` — **the settings registry**: all 12 sections, every item (id/type/default/lock/tier/dated), flags allowlist, seeds, phase list
- `cc-proto-controls.jsx` — controls: number/text/currency/seg/toggle/ghost, milestone chips, text chips, bands/points/standards/clubs tables, upload, chips, `ccpPreview`
- `cc-proto-app.jsx` — row grammar, group cards, flags section, rail, search palette, history drawer, correction modal, dated bits
- `cc-proto-main.jsx` — root app: state, draft/save/reset/correct logic, shell, save bar, toasts, narrow-viewport drill-in

Static mockups (states side by side, incl. dark + unlock-tier plan):
- `Company Config Mockups.html` — design canvas: Targets (light+dark), ⌘F search state, Recognition, Flags, row-grammar specimen, unlock plan, mobile list + drill-in
- `company-config-shared.jsx`, `company-config-scenes.jsx`, `company-config-mobile.jsx` — mockup components
- `app-tokens.jsx`, `app-motion.jsx`, `app-shell.jsx`, `app-mobile.jsx`, `design-canvas.jsx` — mockup support files
