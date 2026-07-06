# AgencyTrack — Game Plan Loop · build handoff

Everything Claude Code (and Claude) needs to build the **full Game Plan loop**: the cycle that turns an agent's life goal into a required commission, an API allocation, a weekly activity prescription, a booked week, logged activity, and settled policies — then feeds settled production back to re-solve the plan.

## Read in this order
1. **`Loop Map.html`** — one-page visual of the whole cycle (① → ⑧ + the feedback edge), each stage mapped to its surface and read/write contract. *Open in a browser.*
2. **`AgencyTrack Loop Prototype.html`** (in `mockups/`) — the interactive, fully-stateful walkthrough. Drive the entire loop on one phone and watch every number propagate. **This is the fastest way to understand what you're building.**
3. **`LOOP_SPEC.md`** — the master build spec: canonical data model, per-stage read/write contract, the shared engines, conventions, design-around flags, and build order.
4. **`CLAUDE_CODE_PROMPT.md`** — paste-ready kickoff for Claude Code.

## The surfaces (each a stage of the loop)
All in `mockups/` — open the `.html`; the `.jsx` are the exact UI (design reference, not production code).

| Stage | Surface |
|---|---|
| ① Goal · Money Needs + Allocator | `Money Needs Merged.html` (+ `Money Needs Merged - Build Notes.html`) |
| ① Goals hub | `AgencyTrack Goals v2.html` |
| ③ Game Plan hub (commit) | `AgencyTrack Game Plan v2.html` |
| ④ Playground + On-Track engine | `AgencyTrack On-Track Engine.html` |
| ⑤ Planner & Scheduler | `AgencyTrack Planner & Scheduler v2.html` |
| ⑤ Planner — Manager surfaces | `AgencyTrack Planner - Manager Surfaces.html` |
| ⑤ Campaigns / Hit-list | `AgencyTrack Campaigns.html` |
| ⑤ Prospect Prep (hit-list → book) | `AgencyTrack Prospect Prep v2.html` |
| ⑥ Daily Capture | `AgencyTrack Daily Capture v2.html` |
| ⑦ Policy Ledger | `AgencyTrack Policy Ledger v2.html` |
| ⑧ Persistency gate | `AgencyTrack Persistency v2.html` |
| — The whole loop, interactive | `AgencyTrack Loop Prototype.html` |

## The one thing to hold onto
There is **one number chain** the whole app is a transformation of: life budget → required commission → API targets → apps (`API ÷ avgPolicySize`) → weekly activity → booked → logged → Written→Submitted→Settled → settled Life API → award tier → re-solve. Every surface is a view onto, or a transformation of, that chain. Never let two surfaces compute the same step with different math; only Life API drives awards. (Full detail in `LOOP_SPEC.md`.)

## Conventions (all surfaces)
Nexus tokens as **CSS variables**, light + dark · Satoshi / Cabinet Grotesk / JetBrains Mono · **Lucide icons** · ≥44px targets · `:focus-visible` · **TTD** · no gradient buttons · **navigation is tab-state (`onOpenTab`), not a router** · mobile primary + desktop for week-booking and manager surfaces.

> The `.jsx` files are **design reference, not production code** — recreate in the repo's React/Tailwind, lifting exact tokens/spacing/tone. Ask before adding any field or screen the spec doesn't call for.
