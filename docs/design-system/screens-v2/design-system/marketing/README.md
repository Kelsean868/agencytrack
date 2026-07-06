# AgencyTrack Marketing — surface conventions

The public site: landing page, resource pages, legal pages. Warm, editorial, light-only.

## Color usage
Ground is --cream #F4F2EC; cards/alt sections are --paper #FFFFFF. Teal #01696F is spent on meaning (numbers, badges, CTAs, links). Gold #B07D1A reserved for recognition content. --dark #0E0B07 sections (kiosk/meeting showcase, footer) are the deliberate rhythm break — warm text #B5AB9C on dark. 1-2 background colors per page max. WhatsApp FAB #25D366 (brand color, chat button only).

## Type scale
Hero h1 clamp(36px,5.4vw,58px) · section h2 clamp(28px,3.6vw,40px) · card h3 19-21px · body 15-19px lh 1.6-1.75 · eyebrow mono 12px/700/.22em uppercase.

## Components
- Buttons: primary solid teal 12px radius; ghost 1.5px rule border. Hover translateY(-1px)+shadow. Never gradients.
- Cards: 18px radius, 1px rule border, 26-32px padding, mono number label + h3 + muted body.
- Compare table: 3-col grid, cream header row, ours-column teal-tinted.
- Next-up trail card: deep-teal panel, white display type, hover lift.
- Resource pills: 999px radius, current = solid teal.
- FAQ: details/summary, mono "+" rotating 45deg.
- Callout: gold-tint bg, 25%-alpha gold border, 14px radius.

## Layout
1080px max (720-760px prose), 28px side padding, 72-110px section padding, grid+gap (18px). Mobile: hamburger nav at 860px, 44px+ tap targets.

## Motion
Reveal-on-scroll fade+translateY with .d1-.d3 stagger. No infinite loops. Respect prefers-reduced-motion.

See ../reference/ for production files.
