---
name: agencytrack-design
description: Use this skill to generate well-branded interfaces and assets for AgencyTrack (Caribbean insurance agency-management SaaS), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key facts: two surfaces — warm editorial marketing site (light only, cream #F4F2EC) and the Nexus app portal (light + warm-dark modes, `.nexus`/`.nexus.dark` scopes, one Nexus Glass hero card max per screen). Teal #01696F = meaning; gold #B07D1A = recognition only. Cabinet Grotesk display + Satoshi body + JetBrains Mono eyebrows. TTD currency ("TTD 24.5K"), Trinidad & Tobago sample names, initials-tile avatars. Never: gradient buttons, mesh-blur backgrounds, emoji, stock photos, generated faces.

App v2 (2026 redesign): for **app** surfaces the rules in `guidelines/redesign-addendum.md` are canonical and win over README.md — state design (StateLayer / skeletons / actionable empties / persistent errors, never spinners or "No data"), motion (`--dur-1/2/3`, `--ease-out`, stagger via transform only), navigation (sectioned drag-reorder sidebar, adaptive mobile More + create FAB, command palette), dense operational tables, and WCAG 2.2 AA (`--inkFaint` = smallest text ink; `--inkDim` = non-text only). `STYLE-GUIDE.html` renders it all in both themes.
