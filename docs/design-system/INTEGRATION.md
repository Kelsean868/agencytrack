# Nexus v2 — App Integration Record

How the Nexus v2 design system (`tokens/app.css` + `guidelines/redesign-addendum.md`)
was integrated into the shipped app's token layer. Written for the
`feat/nexus-v2-foundation` foundation swap — a **reskin: values change, plumbing
stays.** This is the reconciliation between the DS's canonical naming/scope and
the app's shipped runtime.

## 1. Scope decision — un-scoped to `:root` / `.dark`

The DS defines tokens under `.nexus` (light) / `.nexus.dark` (dark) with
**camelCase** names. **The app does NOT adopt that scope or naming.** Instead the
v2 values were poured into the app's existing global blocks in
[`src/index.css`](../../src/index.css):

- Light tokens live in `:root`; dark overrides in `.dark`.
- Names stay **kebab-case** `--color-*` (e.g. `--color-text-faint`, not `--inkFaint`).
- The `--X-channels` alpha substrate (below) is retained.

**Why:** `.nexus` appears in **0 runtime files** — adopting it would require a
wrapper class the runtime has never carried, co-managed at every `.dark` site
(`src/main.jsx` pre-mount restore + kiosk force-dark, the `TopBar` toggle) plus
rehoming the theme-independent presentation/medal tokens. The `.dark` mechanism
(class on `document.documentElement`, key `agencytrack-dark`) is untouched by the
swap. If the app ever co-hosts a second themed region in the same DOM, revisit
this (Rule 23 falsifier).

## 2. Name mapping (DS camelCase → app kebab)

| DS (`app.css`) | App (`--color-*` / channels) | Notes |
|---|---|---|
| `--bg` | `--color-bg` / `--bg-channels` | equal |
| `--surface` | `--color-surface` / `--surface-channels` | equal |
| `--surfaceRaised` | `--color-surface-raised` / `--surface-raised-channels` | equal |
| `--surfaceMute` | `--color-surface-muted` / `--surface-muted-channels` | equal |
| `--surfaceSoft` | — | 5th tier, **not adopted** (unused; follow-up) |
| `--ink` (body text) | `--color-text` / `--text-channels` | **kept app name** — resolves the collision below |
| `--inkMute` | `--color-text-muted` / `--text-muted-channels` | equal |
| `--inkFaint` | `--color-text-faint` / `--text-faint-channels` | **VALUE CHANGED** — AA fix (§4) |
| `--inkDim` | `--color-ink-dim` / `--ink-dim-channels` | **NEW role** — non-text only |
| `--inkAccent` (purple) | `--color-ink` / `--ink-channels` | **kept app name** (purple accent) |
| `--rule` | `--color-border` / `--border-channels` | equal |
| `--ruleStrong` | `--color-border-strong` / `--border-strong-channels` | kept app value (v2 delta <1.5%, cosmetic) |
| `--teal` | `--color-primary` / `--primary-channels` | equal |
| `--tealLight` | `--color-primary-light` / `--primary-light-channels` | equal (dark kept app `#6dc8cb`) |
| `--tealDark` | `--color-primary-dark` / `--primary-dark-channels` | equal |
| `--tealTint` | `--color-primary-tint` | equal |
| `--success` / `--warning` / `--danger` (+Tint) | same `--color-*` (+`-tint`) | equal |
| `--gold` / `--goldTint` / `--goldInk` | `--color-gold` (vivid #B07D1A) / `--color-gold-tint` / `--color-gold-ink` | **gold SPLIT shipped** (feat/nexus-gold-sweep): `--color-gold` = vivid decoration + AA-large display; `--color-gold-ink` (#8a6011 light / #E0AA3E dark) = all other gold text. See `gold-split-audit.md` |
| `--heroInk` / `--heroFaint` | `--color-hero-ink` / `--color-hero-faint` | **NEW role** (flat hero; distinct from glass `--hero-ink*`) |
| `--skeleton` | `--color-skeleton` | **NEW role** |
| `--ease-*` / `--dur-*` | `--ease-*` / `--dur-*` | **NEW roles** (verbatim; theme-independent) |
| `--focus` / `--focus-offset` | `--focus` / `--focus-offset` | **NEW roles** |

### `--ink` collision resolution
The DS's `--ink` (body text `#28251D`) and the app's existing `--color-ink` (the
**purple categorical accent** `#5A3FA0`) collide by name. Resolution: **no rename.**
Body text stays `--color-text` (value unchanged); the purple stays `--color-ink`
(= DS `--inkAccent`, value unchanged). The DS name `--ink` is not adopted.

## 3. Regenerated-channels rule

Every migrated color is defined in **dual form** (preserved from PR-C-FU3):

```
--X-channels: R G B                         /* space-separated triplet */
--color-X:    rgb(var(--X-channels))        /* derived opaque alias    */
```

Tailwind maps colors to `rgb(var(--X-channels) / <alpha-value>)` so opacity
modifiers (`bg-primary/30`, `border-border/50`, `text-ink-muted/70`) resolve.
**17 distinct tokens across 156 files are consumed with `/alpha`** (1199 sites;
`primary` alone = 542) — so **any token whose value changes MUST regenerate its
`--X-channels` triplet**, or those alpha usages break. In this swap only
`--text-faint-channels` changed value (both themes), and it was regenerated. The
new `--ink-dim` role also ships in dual form so dividers can take `/alpha`.

**Rule 23 falsifier for this approach:** a consumed token that cannot be resolved
to an opaque RGB triplet (e.g. a v2 token that is inherently an alpha `rgba`)
would break the substrate. This surfaced once — see §4 dark borders.

## 4. Value-adoption policy

Adopt the v2 value for every token **except** where doing so would:

- **(E1) break the channel-split substrate** — the DS dark `--rule` /
  `--ruleStrong` are alpha hairlines (`rgba(240,235,224,0.08/0.18)`), which
  cannot be an opaque RGB triplet. The app keeps its opaque dark border values
  (`#3A3530` / `#4A4540`), which already read as lifted hairlines on the dark
  surface and work with the 188 `border-border/NN` alpha consumers.
- **(E2) regress a documented AA guarantee** — in the #813 foundation swap light
  `--gold` was kept at `#8a6011` (not the vivid mock `#B07D1A`, only 3.28:1 on
  gold-tint) to protect the ~15 `text-gold`-on-tint sites. **Resolved by the later
  gold split** (feat/nexus-gold-sweep): `--color-gold` is now vivid `#B07D1A` for
  decoration + AA-large display text, and `--color-gold-ink` (#8a6011) carries all
  other gold text. See `gold-split-audit.md`.

**Substantive v2 changes actually applied:** the `--inkFaint` AA fix
(`#A8A39C`→`#7A7264` light, `#8A8074`→`#968B7C` dark) + the new role groups. The
app palette was already ~99% v2 (v2 was reconciled *from* this app's rated
prototype), so surfaces/brand/semantic values were already equal.

## 5. Baseline resets (shipped with the tokens)

- `button { font-family: inherit; color: inherit; cursor: pointer; }` — the v2
  dark-mode fix (a bare `<button>` fell back to UA black and went invisible).
- Token-driven `:where(a,button,input,select,textarea,[tabindex],[role="button"],[role="tab"]):focus-visible`
  ring. `:where()` has **zero specificity**, so the app's mature per-component
  `:focus-visible` rules (sidebar, topbar, tabs, bottom-nav) still win — this only
  adds a ring where none existed. The v2 rule's `border-radius:6px` was **not
  ported** (it would round square elements on focus; a bare outline follows each
  element's own radius).
- Reduced-motion is **not** globally reset — the app already gates every animation
  behind `@media (prefers-reduced-motion: no-preference)`, satisfying
  redesign-addendum §2 without a global killer.

## 6. Deferred (follow-ups, out of the foundation swap)

Vivid-gold + `--color-gold-ink` split — **✅ SHIPPED** (feat/nexus-gold-sweep; see
[`gold-split-audit.md`](gold-split-audit.md); dark gold stays `#E0AA3E`) · local
woff2 font wiring — Satoshi/Cabinet Grotesk now **self-hosted** (see §7); JetBrains
Mono still CDN, no committed woff2 · glass-recipe reconciliation (`tokens/glass.css`
vs the app's `--glass-*`) · `surfaceSoft` 5th
surface tier · per-screen Track-J polish · wiring motion/skeleton/hero-ink tokens
into components (state-design + motion work per redesign-addendum §1–§2).

**Resolved since (see §8):** `AgentReportDocument.jsx` PDF palette (react-pdf hex,
now a documented mirror of the light `:root` tokens) · the two `#fff` literals
(kiosk Avatar, MiniViz).

## 7. Self-hosted fonts (Satoshi + Cabinet Grotesk)

The prior Fontshare CDN `@import` in [`src/index.css`](../../src/index.css) was
**removed** and replaced with local `@font-face` blocks. Fonts now ship from the
app tree at `src/assets/fonts/` (Vite fingerprints them into `dist/assets/*.woff2`),
so first paint no longer depends on a third-party CDN round-trip.

**Reskin discipline — zero visual change.** Only the exact weights the CDN was
serving are self-hosted, at the same family names + `font-display: swap` the app
already used, so rendering is unchanged:

| Family | Weight | woff2 (in `src/assets/fonts/`) |
|---|---|---|
| Satoshi | 400 | `Satoshi-Regular.woff2` |
| Satoshi | 500 | `Satoshi-Medium.woff2` |
| Satoshi | 700 | `Satoshi-Bold.woff2` |
| Cabinet Grotesk | 700 | `CabinetGrotesk-Bold.woff2` |
| Cabinet Grotesk | 800 | `CabinetGrotesk-Extrabold.woff2` |

Source woff2 copied from `docs/design-system/assets/fonts/` (`docs/` is reference,
never a served runtime path). Blocks are written inline in `index.css` rather than
importing the DS `tokens/fonts.css` (which enumerates the full 17-asset package) —
minimal set, minimal surface.

**Weight-600 note:** some Satoshi/Cabinet surfaces use `font-weight: 600` /
`font-semibold`, but the Fontshare CDN never served a 600 face either — the browser
already rounded to the nearest available weight. The self-hosted set reproduces that
exactly; adding a 600 face would *change* rendering, so it was intentionally omitted.

**JetBrains Mono (mono) — still CDN.** No JetBrains Mono woff2 is committed anywhere
in the repo, so its Google Fonts `@import` is retained (`index.css:1`). This is the
one remaining CDN font reference. **Rule 23 falsifier / follow-up:** commit a
JetBrains Mono woff2 (400/500) to `src/assets/fonts/` and it can be self-hosted the
same way, dropping the last CDN font dependency.

## 8. Token-holdout reconciliation (PDF palette + stray literals)

Closes the last two holdouts flagged in the recon
([`docs/audits/reskin-recon-2026-07-05.md`](../audits/reskin-recon-2026-07-05.md),
Task 4) and previously deferred in §6.

### PDF palette — `src/components/profile/AgentReportDocument.jsx`

`@react-pdf/renderer` cannot resolve CSS custom properties (`var(--x)` renders
blank), so this file **must** use literal hex — that constraint is unchanged and
correct. What changed: the literal `COLORS` object is now a documented, one-way
**mirror of the light-mode `:root` tokens** in [`src/index.css`](../../src/index.css)
(the PDF always prints on white paper, so only the light theme applies). A
`PDF PALETTE` comment block at the top of the style section lists every literal and
the `--color-*` token it mirrors, as the anti-drift trace — **keep in sync manually**
whenever a token value changes in `src/index.css`.

Because a printed report has no theme toggle, on-tint / on-surface **text** was
routed to the deeper `*-ink` tokens (`--color-success-ink` / `--color-warning-ink`
/ `--color-danger-ink`), while base `success` / `warning` / `danger` remain for
non-text marks only (chart lines, marker rules, legend dots). This fixes a real
AA failure: base danger on danger-tint measured **4.28:1** (below WCAG AA 4.5);
every PDF text color now clears AA on its paper background (worst case 4.99:1). The
generic-emerald "Achieved" badge (`#065f46` / `#d1fae5`) was folded into the Nexus
success system (`--color-success-ink` / `--color-success-tint`) for single-source
consistency.

### Stray `#fff` literals

- **`dashboard/HomeV2/MiniViz.jsx`** — the redundant inline `color: '#ffffff'`
  was removed; the badge already carries `className="text-white"` (a fixed-white
  Tailwind utility, retained via `extend.colors`), so rendering is identical and
  the literal is gone.
- **`kiosk/Avatar.jsx`** — the `#fff` initials color is **kept and commented** as
  intentionally fixed: white-on-accent on the saturated `avatarColor()` circle,
  identical in both themes (worst-case white-on-palette contrast 5.15:1, AA-safe).
  Not a theme token — converting it would change intended rendering.
