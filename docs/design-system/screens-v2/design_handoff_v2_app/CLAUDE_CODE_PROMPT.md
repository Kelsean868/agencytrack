# Kickoff prompt for Claude Code

Paste this into Claude Code with the repo open and `design_handoff_v2_app/` available.

---

You are applying a **v2 visual redesign** to this existing app (`agencytrack`). The redesigns are hi-fi HTML mockups in `design_handoff_v2_app/mockups/`. **Read `design_handoff_v2_app/README.md` in full first** — it maps every mockup to the component(s) to update and explains the shared design system.

Ground rules:

1. **This repo already has the design system.** All tokens live in `src/index.css` (`:root` / `.dark`) and `tailwind.config.js`. The mockups use the SAME language. Map every raw hex/px in a mockup to an existing token/utility (`bg-primary`, `text-ink`, `.card`, `.btn-primary`, `.medal-N`, `.shell`, etc.). **Never introduce a new hex.** Confirm with the token-bridge table in the README.

2. **Mockups are references, not code.** Recreate them in React using existing components and primitives (`shell/`, `dashboard/KPICard`, `ui/*`, `awards/AwardMedal`, services in `src/services/*`). Do not paste mockup HTML/JS.

3. **The mockup is the target.** Where a current component and a mockup disagree, update the component to match the mockup. Preserve all data/services/state logic (Firestore, `submissionService`, `extractFields`, role routing) unless the redesign truly requires a change.

4. **Both themes + a11y are required.** Verify light AND dark mode. Keep the a11y gate green: semantic markup, labelled controls, `focus-visible:ring-2 ring-primary`, 44px hit targets, and `@media (prefers-reduced-motion: no-preference)` guards on motion. Run `npm run lint` and `npm test` before each commit.

Start with **App Layout / App Mobile** (the `Shell`), since every screen renders inside it. Then go screen-by-screen in the README's order. For each: open the mockup beside the mapped component, list the visual deltas, port them with tokens, add loading/empty/error states, verify both themes, then commit on a per-area branch (e.g. `redesign/agent-dashboard`).

Before writing code for a screen, show me: (a) the mockup → component mapping you'll touch, (b) the specific visual deltas, and (c) which existing tokens/primitives you'll use. Wait for my go-ahead on the first screen, then proceed.
