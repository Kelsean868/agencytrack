# AgencyTrack — Nexus Design System

One brand, two surfaces:

1. **Marketing** (`marketing/`) — the public site: landing, resources, legal pages. Warm, editorial, trust-first. Light only.
2. **App** (`app/`) — the product portal: dashboards, capture, reconciliation, kiosk/meeting modes. Denser, functional, **light + dark modes**, plus the "Nexus Glass" hero-card tier.

## Shared brand (never varies)
- **Fonts:** Cabinet Grotesk 700/800 (display, Fontshare) · Satoshi 400/500/700 (body, Fontshare) · JetBrains Mono 400/600/700 (microlabels, Google Fonts).
- **Logo:** teal #014E52 rounded tile, rising white activity bars, #4ECDC4 accent dot; shield variant. See `logo-shield.svg`, `favicon.svg`.
- **Core hues:** teal (primary, "meaning" color — numbers, CTAs, links), gold (recognition/awards ONLY), warm neutrals (cream/beige grounds, warm inks).
- **Signature motifs:** mono uppercase eyebrows (11–12px, 700, .18–.22em tracking, teal); numbered mono labels ("01 · PLAN"); TTD currency formatting (`TTD 24K`, `TTD 1.2M`); T&T names in all sample data.
- **Voice:** domain-fluent, honest, no overclaiming. Clawback, persistency, settlement, NTU, company floor.
- **Anti-patterns (both surfaces):** no gradient buttons, no mesh/radial blur backgrounds, no emoji, no stock photos or generated faces, no purple/indigo as brand color, avatars are initials tiles.

## Where the surfaces differ
| | Marketing | App |
|---|---|---|
| Ground | #F4F2EC cream | #F7F6F2 (light) / #1A1612 (dark) |
| Modes | Light only (dark #0E0B07 used as section rhythm break) | Light + dark, user-switchable |
| Density | Generous: 72–110px sections, 17px body | Compact: 13–14.5px body, tight cards, 1280×800 desktop frame |
| Type scale | Hero clamp(36–58px) | Page titles ~31px, card numbers 24–30px |
| Semantic colors | Not used | success/warning/danger + tints (light & dark variants) |
| Glass | Never | "Nexus Glass" hero-card tier only (see app/glass.css) |
| Violet accent | Never | #5A3FA0 sparingly, for list variety |

## Files
- `shared-brand.css` — fonts, logo, brand constants
- `marketing/tokens.css` + `marketing/README.md` — site system
- `app/tokens.css` — app light + dark palettes as CSS vars (`:root` and `.dark` scope)
- `app/glass.css` — Nexus Glass recipe (light + dark physics, AA doctrine, reduced-transparency fallbacks)
- `app/README.md` — app conventions (modes, density, semantic colors, iconography)
- `reference/` — production HTML/CSS: marketing homepage + sub-page, app token source (`app-tokens.jsx`), glass recipe demo
