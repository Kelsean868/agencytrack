# Nexus app UI kit

Interactive recreation of the AgencyTrack portal ("Nexus") agent experience, composed from the design-system bundle (`AppShell`, `GlassCard`, `Scorecard`, `Money`, `Pill`, `Avatar`, `Eyebrow`, `Button`, icons).

- **Screens:** Dashboard (glass hero + floor scorecards + delivery clock + leaderboard), Policy Ledger (reconciliation exceptions), Awards (gold glass hero + persistency-gate ladder + campaign standings + awards watch).
- **Interactions:** sidebar navigation between the three screens (other nav items are present but not built); topbar sun/moon toggles warm dark mode; state persists in localStorage.
- Desktop frame 1280×800. One glass card max per screen (teal on Dashboard, gold on Awards — recognition context).
- Not built (exists in product, no source screens provided): Weekly Report wizard, Game Plan, Money Needs, manager/CRO role dashboards, kiosk & meeting modes.
