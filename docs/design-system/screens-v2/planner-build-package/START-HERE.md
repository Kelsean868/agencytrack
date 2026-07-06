# AgencyTrack — Planner &amp; Scheduler · Build Package

Everything Claude Code needs to build the Planner &amp; Scheduler (agent + manager) into
`Kelsean868/agencytrack`. One feature, two tiers, one design system.

## What's in here

```
planner-build-package/
├── START-HERE.md                         ← this file
├── Unified Claude Code Kickoff.md        ← THE prompt to paste into Claude Code (both tiers)
├── Planner & Scheduler Build Handoff.html ← the combined spec (screens, data model, build order)
├── 1-agent-planner/                      ← agent tier — BUILD FIRST
│   ├── README.md                         ← agent spec (tokens, screens, data model, component map)
│   ├── CLAUDE_CODE_PROMPT.md             ← agent-only kickoff (if you build the tiers separately)
│   └── mockups/                          ← design source of truth (open the .html)
│       ├── AgencyTrack Planner & Scheduler v2.html
│       └── planner-*.jsx / app-*.jsx     ← design reference (NOT production code)
└── 2-manager-planner/                    ← manager tier — BUILD SECOND
    ├── README.md                         ← manager spec + the 4 trust constraints
    ├── CLAUDE_CODE_PROMPT.md             ← manager-only kickoff
    └── mockups/
        ├── AgencyTrack Planner — Manager Surfaces.html
        └── planner-manager-*.jsx / …
```

## How to use it

### With Claude Code (building in the repo)
1. Open the `Kelsean868/agencytrack` repo in Claude Code and drop this folder in (or alongside it).
2. Paste **`Unified Claude Code Kickoff.md`** (the fenced block) into Claude Code. That's the whole
   agent-then-manager build, in order, with the repo-reuse anchors and human-merge gates.
   - Building the tiers in separate sessions instead? Use each tier's own
     `CLAUDE_CODE_PROMPT.md`, agent first.
3. Claude Code should read `CLAUDE.md`, `APP_MANUAL.md`, `docs/CONTEXT.md`, and `src/index.css`
   first, then work one screen per branch (small PRs), verifying light + dark + a11y each time.

### With Claude (design — this tool)
- Open either `mockups/*.html` to review/refine the design. They're interactive boards: drag to
  pan, ⌘/Ctrl-scroll to zoom, click an artboard's ⤢ Focus for fullscreen (←/→ to step, Esc exits).
- The `Build Handoff.html` is the at-a-glance combined spec.
- Ask me to pull any ⭐ board (Week booking, evening handoff, 1-on-1 pack, escalation inbox) into a
  focused, tweakable screen if you want to lock a design before coding.

## The non-negotiables (don't let them slip)

- **Reuse, don't rebuild:** extend the existing prospect store; the evening handoff writes through
  the *existing* Daily Capture → Weekly Report schema (`extractFields`); un-gate the coming-soon
  `planner` tab in `navConfig.js`; keep routing in the `App.jsx` role switch.
- **Four manager-tier trust constraints — enforced at the security-rules layer, not just UI:**
  stalled ratio is aggregate-only, private (never on kiosk/leaderboard), named prospects only via
  a reversible agent escalation, coaching tone.
- **Human-merge + deploy gates:** `firestore.rules` and the `pipelineStats` Cloud Function stop at
  the PR for human merge + `firebase deploy`. All React/Tailwind ships on the normal Vercel path.
- **Activity manager, not a CRM.** If a flow is slower than paper, it has failed.

## Build order (summary)

**Tier 1 — Agent:** plannerService + data shapes → Today → Day → ⭐Week booking → ⭐Add → ⭐Churn →
⭐Freed-slot → Follow-ups → Prep → ⭐Plan→report handoff → agent "escalate" affordance.
**Tier 2 — Manager:** personal planner (Sell/Coach/Recruit streams + recruiting) → ⭐Team overview →
⭐1-on-1 pack → ⭐Escalation inbox → capacity / branch events / booking health → `pipelineStats` CF
+ security rules (human-merge).
