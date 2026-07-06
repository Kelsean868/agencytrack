# AgencyTrack — Planner & Scheduler · complete build handoff

This bundle contains **everything Claude Code needs** to build the Planner & Scheduler feature into the existing `Kelsean868/agencytrack` repo. It is split into two self-contained sub-packages that together make one product.

```
agencytrack-planner-handoff/
├── README.md                 ← you are here (start here)
├── 1-agent-planner/          ← BUILD FIRST — the field-agent planner
│   ├── README.md             ← feature spec
│   ├── CLAUDE_CODE_PROMPT.md ← paste-ready kickoff prompt
│   └── mockups/              ← runnable design board + JSX modules (design source of truth)
└── 2-manager-planner/        ← BUILD SECOND — the manager tier (personal planner + coaching)
    ├── README.md             ← feature spec
    ├── CLAUDE_CODE_PROMPT.md ← paste-ready kickoff prompt
    └── mockups/              ← runnable design board + JSX modules
```

## How to use this

1. **Open each `mockups/*.html` in a browser** (or `npx serve` the `mockups/` folder so the sibling `.jsx` modules load) to see the design. They're interactive design-canvas boards: **pan** = drag, **zoom** = ⌘/Ctrl-scroll, click an artboard's **Focus** (⤢) for fullscreen then **←/→** to step, **Esc** exits.
2. **Read the sub-package `README.md`** — each is the full spec (Nexus tokens, screens, states, data model, screen→component map, assumptions).
3. **Paste the sub-package `CLAUDE_CODE_PROMPT.md`** into Claude Code with that folder available in/alongside the repo.

## Build order

**Build `1-agent-planner` first.** The manager tier reads the agent tier's `appointments` / `prospects` data and its escalation object. Then build `2-manager-planner`.

| | Tier | What it is | Hero flows |
|---|---|---|---|
| **1** | **Agent planner** | Field agent plans & books a week into time slots, works the day, reports results — and the plan **pre-fills the report**. Activity manager, not a CRM. | Phone-day booking · daily churn (cancel→fill/reschedule) · plan→report evening handoff |
| **2** | **Manager tier** | (a) A **personal planner for selling managers** — the agent planner extended with a Sell/Coach/Recruit stream model + recruiting; (b) **coaching & visibility** surfaces over the team. | 1-on-1 coaching pack · escalation inbox · book-a-block (1:1s / unit meetings / joint work / training / recruiting) |

## What's shared (build it once, in the agent tier)

Both tiers use the **same Nexus design system** (tokens in `src/index.css`), the **same Shell** (sidebar/topbar/bottom-nav with `RoleSwitcher`), and the **same planner primitives** (activity chips, status pills, time rail, counter bars, day-strip cells). The manager tier reuses the agent timeline & week-booking components rather than reimplementing them. Don't fork; parameterize.

## The four non-negotiable trust constraints (manager tier)

Enforced in the mockups **and required in code at the data/query/security-rules layer** — see `2-manager-planner/README.md` §2:
1. Per-agent **stalled-pipeline ratio is aggregate only** — never a drill-down of named prospects.
2. That ratio / any individual data is **private manager↔agent** — never on a kiosk/leaderboard.
3. A manager sees a **named prospect only via an agent's explicit, reversible escalation**.
4. Tone is **coaching, not surveillance**.

## Target stack (both tiers)

React 19 · Vite · Tailwind 3.4 (`darkMode:'class'`) + `@layer components` in `src/index.css` · lucide-react · Firebase (Auth/Firestore/Functions/Storage), multi-tenant `tenants/{tenantId}/…` · role-based switch in `src/App.jsx` (no router lib) · CI a11y gate (axe/Playwright). Map every raw hex/px in the mockups to an existing token — never introduce a new color. Every screen ships light + dark with empty/loading/error states.

> The `mockups/*.jsx` files are **design reference, not production code** — recreate the UI in the repo's React/Tailwind, lifting exact tokens/spacing/tone. Start each tier from its `*-shared.jsx`.
