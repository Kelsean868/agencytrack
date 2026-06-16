# AgencyTrack Logo — Welcome Hero + Brand Consistency

**Sized:** XS–S
**Tier:** B — frontend visual slice, asset provided/locked; no rules/CF/money/migration.
**Model:** Sonnet.
**Persona review:** light — operator-legibility (brand recognition) + a11y (alt text, both-theme contrast).
**Sequencing:** Independent of the pending contract-date dispatch (disjoint files) — either order.
**Why:** The onboarding Welcome hero renders a generic Lucide layout glyph. Replace it with the real AgencyTrack mark (shield + rising bars + up-arrow accent), already in `public/`.

## Assets (already in `public/`, per operator)
- `icons.svg` — full logo, 200×200 viewBox, scalable → **UI use (hero, header, login)**.
- `favicon.svg` — 32×32 simplified → favicon.
- `icon-192.png`, `icon-512.png` — PWA manifest icons. **Note:** these are JPEG bytes with a `.png` extension (banked fix below); not used by this change.

## Phase 1 — recon
1. Confirm the four assets are **tracked** — `git ls-files public/`. If untracked, this PR `git add`s them.
2. The Welcome step component + how it renders the current icon (Lucide glyph + its tinted container).
3. How the header renders the "AgencyTrack" wordmark (component/element).
4. Whether the login screen has a brand slot.
5. Whether `index.html` / the PWA manifest already reference `favicon.svg` + the icon PNGs.

## Phase 2 — build
1. **Welcome hero (the ask):** replace the Lucide icon **and its tinted placeholder container** with the self-contained badge — `<img src="/icons.svg" alt="AgencyTrack" />` at ~96–112px. The SVG already carries its own rounded-square background, so no wrapper tint. Both themes — if the badge lacks separation on the dark theme, a subtle 1px `white/10%` ring is acceptable.
2. **Header:** add the mark beside the existing wordmark (`<img src="/icons.svg">` ~24–28px) and **keep the "AgencyTrack" text** — mark + wordmark, don't remove the text.
3. **Login:** if it has a brand area (per recon), use the mark there too.
4. **Favicon / PWA:** if `index.html` / manifest don't already reference `favicon.svg` + the icon PNGs, wire them.

Reference `public/` assets by absolute path (`/icons.svg`) per Vite — not imported from `src/`.

## Phase 3 — smoke (value-asserting, both themes)
Welcome hero renders the logo (asset request 200, no 404); header shows mark + wordmark; no console errors; both themes legible.

## Phase 4–5
Docs ledger; PR-open; Tier-B green-channel gates → auto-merge → prod smoke; report after merge.

## Banked FU (low priority)
`icon-192.png` / `icon-512.png` are JPEG bytes mislabeled `.png` — re-export as true PNG (or set manifest `type: image/jpeg`). PWA-manifest correctness only; doesn't block.

## Scope note
This bundles header/login/favicon for one-pass brand consistency. **If you want only the Welcome screen for now, scope it to step 1.**
