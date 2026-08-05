# Nexus v2 design system — canonical sources, token values, gold split

Moved out of CLAUDE.md (§ Theme System, original lines 87–120 and the explanatory
tails of § UI rules, lines 140–146) on the router split. CLAUDE.md retains the binding
authoring rules (no gradients, no inline styles, 44px targets, no `text-ink-faint` on
new text, `dark:bg-primary-dark` pairing, AgentReportDocument hex exemption); this file
carries the values, the precedence map and the derivations.

## Canonical sources & precedence (2026 redesign)

The Nexus v2 design system is canonical for **app** surfaces:
- **Values:** [`docs/design-system/tokens/app.css`](docs/design-system/tokens/app.css) (the v2 reconciliation; camelCase `.nexus`-scoped in the DS — see scope note).
- **App rules:** [`docs/design-system/guidelines/redesign-addendum.md`](docs/design-system/guidelines/redesign-addendum.md) — wins over the DS `readme.md` for app surfaces (state design, motion, nav, a11y, dense tables).
- **Integration record:** [`docs/design-system/INTEGRATION.md`](docs/design-system/INTEGRATION.md) — scope decision + name-mapping + channels rule for the shipped app.
- **Design intent (mockups):** the redesigned per-screen `.html` mockups under [`docs/design-system/screens-v2/`](docs/design-system/screens-v2/) (+ their sibling `.jsx` scene modules) are the **CANONICAL design intent** a builder ports toward — the folder's own [`Reference Index`](docs/design-system/screens-v2/AgencyTrack%20-%20Claude%20Code%20Reference%20Index.md) calls them the "design source of truth." These mockups are **not** historical. Only pre-2026-redesign artifacts are: the `DS Audit & Migration Plan` HTMLs (the v2 self-marks "⚠ SUPERSEDED"), the early Zoho/Perplexity/Gemini ideation inputs under `screens-v2/uploads/`, and the design sections of the legacy PRD/Config docs. Full generation map (canonical / historical / reference / unclear), the screen→mockup index, and the "looks-canonical-but-isn't" traps (embedded DS copies, the ⌘K/drag-reorder authoring demos, the marketing `deploy/`) live in [`docs/design-system/DESIGN-FOLDER-CATALOG.md`](docs/design-system/DESIGN-FOLDER-CATALOG.md).

**Scope decision (foundation swap, `feat/nexus-v2-foundation`):** the app **retains its `:root` / `.dark` scoping and kebab `--color-*` names + `--X-channels` alpha substrate** — the DS's `.nexus` / `.nexus.dark` scope and camelCase names were NOT adopted (they'd require a wrapper class the runtime has never used + co-managing it at every `.dark` site). This is a **reskin: values change, plumbing stays.** The v2 values were poured into the existing `:root` / `.dark` blocks in `src/index.css`.

**What v2 changed (the app palette was already ~99% v2 — v2 was reconciled *from* this app's rated prototype):**
- **AA fix (the point):** `--color-text-faint` darkened to the AA-passing v2 `--inkFaint` (`#7A7264` light / `#968B7C` dark; was `#A8A39C` / `#8A8074`, which failed WCAG 2.2 AA as text). The old faint value moved to the new **non-text** role `--color-ink-dim` (dividers/disabled glyphs only — never text).
- **New role groups added:** motion (`--ease-out` / `--ease-spring` / `--dur-1..3`), focus ring (`--focus` / `--focus-offset`), `--color-skeleton`, and the flat teal-hero ink pair (`--color-hero-ink` / `--color-hero-faint`). Baseline resets shipped with the tokens: `button { color: inherit }` + a token-driven `:where(...):focus-visible` ring (zero-specificity, so existing per-component focus styles still win).
- **Surfaces / brand / semantic values are unchanged** — `#f7f6f2` bg, `#01696f` teal, `#28251d` text, dark `#1a1612` / `#4ab5b8` etc. all match v2 already.

**Light mode (`:root`):**
- `--color-bg: #f7f6f2` (warm beige page bg) · `--color-surface: #ffffff` · `--color-surface-raised: #fafaf8`
- `--color-text: #28251d` · `--color-text-muted: #6b6560` · `--color-text-faint: #7a7264` (v2 AA) · `--color-ink-dim: #a8a39c` (non-text)
- `--color-primary: #01696f` (teal) · Shadows: warm beige drop

**Dark mode (`.dark`):** Bear/Apple Notes aesthetic
- `--color-bg: #1a1612` · `--color-surface: #252019` · `--color-surface-raised: #302a23`
- `--color-text: #f0ebe0` · `--color-text-muted: #b8aea0` · `--color-text-faint: #968b7c` (v2 AA) · `--color-ink-dim: #4f473e` (non-text)
- `--color-primary: #4ab5b8` (lifted teal for legibility) · Shadows: pure black drop

**Gold rule — the split (shipped, feat/nexus-gold-sweep; see [`docs/design-system/gold-split-audit.md`](docs/design-system/gold-split-audit.md)):**
- `--color-gold` = **vivid `#B07D1A`** (light) — **decoration ONLY** (fills, dots, borders, chart series, standalone icons) **+** gold **display text that certifies AA-large ≥3:1** at its actual composited bg (≥24px reg / ≥18.66px bold). It is 3.28:1 on gold-tint and 3.62:1 on white/card — **never small/normal gold text**.
- `--color-gold-ink` = **`#8a6011`** (light) — **all other gold text**, via the `text-gold-ink` utility (or `var(--color-gold-ink)`): small/normal, or large text that fails AA-large. 5.06–5.58:1 in light.
- **Dark (both roles) = `#E0AA3E`** — already AA-normal as text (7.69:1 on surface), so no split is needed and dark `text-gold`/`text-gold-ink` render identically; vivid `#B07D1A` is NOT used in dark (it would drop to 4.46:1).
- Promoting gold text to vivid requires certifying AA-large at its **actual** bg — never on assumption (e.g. the leaderboard champion value stays gold-ink because a gold-hued medal glow drops the worst case to 2.74:1).

**Glass-recipe reconciliation — ✅ RECONCILED (no source change; #818 recon).** The app's 20 S1 `--glass-l-*`/`--glass-d-*` tokens are value-identical to `tokens/glass.css` (which was derived *from* the app), and the app ships an app-only `--glass-hero-*` superset `glass.css` lacks; every live glass surface is `.glass.hero.teal`. See [`docs/audits/glass-recon-2026-07-06.md`](docs/audits/glass-recon-2026-07-06.md) + INTEGRATION.md §6.

**Deferred to follow-ups (NOT yet done):** local woff2 font wiring, `AgentReportDocument.jsx` hex, `surfaceSoft` 5th tier. See INTEGRATION.md.


## Derivations behind the UI rules

The two authoring bans in CLAUDE.md § UI rules were each banked from a repeated smoke
failure. Full text as it stood before the split:

- **No `text-ink-faint` on any new text element — use `text-ink-muted`.** (D5, banked from S3b: four consecutive slices had smoke catch faint-on-new-text AA failures; this bans it at authoring time.) *Nexus v2 note:* the inkFaint AA fix raised `--color-text-faint` to ~4.7:1 on flat surfaces, so faint now technically passes AA there — but it remains the smallest ink and **still fails on glass by design** (see the glass-faint guard in `contrast.test.js`), so D5's prefer-muted guidance stands. For non-text dividers/disabled glyphs use the new `--color-ink-dim` (`border-ink-dim`), never text.
- **White-text primary buttons always pair `bg-primary` with `dark:bg-primary-dark`** (dark-mode `--color-primary` is the lifted text teal, not a button background). (D6, banked from compliance-v2-s2: dark-mode smoke axe caught white-on-lifted-teal AA failure on a `bg-primary text-white` button missing the `dark:` variant the rest of the app already uses.)

## Roadmap and spec pointers (were inline in § UI rules)

**Phase 7-8 design docs:** [`docs/phase7-8-PRD.md`](docs/phase7-8-PRD.md) (full spec across 5 tracks D–H) + [`docs/phase7-8-implementation.md`](docs/phase7-8-implementation.md) (build sequence, recommended order D → E → G → F → H, ~36–46 PRs total). Tracks D–H detailed in the table below. Pilot remains postponed indefinitely.

**Workshop-driven roadmap revision (2026-05-20):** [`docs/AgencyTrack_Workshop_Roadmap_Revision.md`](docs/AgencyTrack_Workshop_Roadmap_Revision.md) — adds Track I; extends Track F (structured Joint-Call Observation Log + appointment-bound Prospect-Info form); locks Track H column decision (Source-of-Prospect/Cash-with-App/Date-Placed/Delivery-Date IN, demographics OUT, Need-Covered → joint-call form); adds social/content KPIs (Track E) + Personal Growth/CPD (Career Portal/Phase 8); re-sequences for insider-seat strategy; no-CRM guardrail (future integrated CRM separately scoped).

