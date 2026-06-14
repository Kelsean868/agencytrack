# Agent Goals — GapAnalysisPanel restyle (Goal Hierarchy)

## Context
The agent half of the now-live Goals tab (un-gated PR #610). `GapAnalysisPanel`
(`src/components/goals/GapAnalysisPanel.jsx`) renders the 5-layer goal cascade with API &
Apps progress vs YTD — **read-only** for the agent (they edit in Game Plan, not here). This
applies CD's Goals v2 redesign (Nexus warm, hero doctrine, group-key dots) as a **visual +
states pass**. Source sheet: `Agent_Goals_-_Goal_Hierarchy_Build.html`. This panel is where
the planning-loop Commit lands — Personal Commitment is its destination — so it's high agent
value and ties back to the Step 4 commit sheet.

## Decisions locked (surface ANY deviation before implementing)
- **Restyle only — do NOT rewire.** Props stay exactly as wired: `hierarchy`, `ytdTotals`,
  `hierarchyLoading`, `hierarchyError`. No new data, no service change, no rules change.
- New chrome (all derived from existing props):
  - **CommitmentHero** (NEW) — hero treatment on the agent's Personal Commitment (Annual
    API) with API / Apps / Persistency each vs YTD. Hero ink scoped to the pane
    (white-on-teal light; raised surface + teal border in dark). Gold hero tokens retired.
  - **GoalCascade** (REDESIGN) — group-key dots + per-layer API + YTD bar; agent's own row
    `--teal-tint` banded so "yours" reads instantly. Order top→bottom: Company Floor → SM →
    Branch → Unit → Personal.
  - **GapNote** (NEW) — plain-words "your commitment vs floor" readout; `--success` tone
    above floor, `--warning` tone if below.
  - Reuse **`statusToken`** from the planning loop (on-track / above-floor / below-floor) —
    do not fork a second status helper.
- **DECISION POINT — cascade org-tier scale (recommendation baked in; flip on Kyron's
  word):** Render **Personal Commitment** and **Company Floor** as the two prominent
  full-detail rows. **Collapse SM / Branch / Unit** into a single light "rolls up through
  Unit → Branch → SM" context strip — no millions-scale prominence, no YTD bars competing
  with the agent's own row. Rationale: the Company Floor is the agent's real measuring
  stick; the org tiers are roll-up context that shouldn't dwarf the agent's number.
  *(Alternative, if Kyron flips it: keep all three org tiers as full context rows with their
  own YTD bars, exactly as drawn in the sheet's populated specimen.)*
- Nexus warm tokens via CSS vars only (no hex outside vars), Lucide icons only, ≥44px rows,
  TTD throughout, both themes, mobile.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
**Only stop if a prop shape is missing/different enough to need rewiring** (which would
break the "restyle only" decision — flag it).
1. Confirm the real **`hierarchy`** shape matches the sheet's assumption — a 5-layer array,
   per node `{ annualAPI, annualApps, persistency, label, groupKey }`, with the company-floor
   node carrying the tenure-scaled API (L1–L6 200→800K). Report any field the redesign needs
   that isn't present (e.g. `groupKey`, per-node `persistency`).
2. Confirm **`ytdTotals`** shape (`{ api, apps }` per layer) drives the progress bars/hero.
3. Confirm **`statusToken`** is importable from the loop and covers above/below-floor.
4. Confirm the **committed date** (the sheet's "committed in Game Plan · 12 Jun") is
   available (`committedAt` from the loop's Commit) — if not, drop the date line, don't
   invent it.

## Phase 2 — restyle
- CommitmentHero, GoalCascade (per the cascade decision above), GapNote.
- All four states: **loading** (skeleton cascade via `hierarchyLoading`), **error** (honest
  retry via `hierarchyError` — "Nothing's wrong with your plan"), **empty** (no commitment —
  "Build it in Game Plan", with a Go-to-Game-Plan link; cascade still shows the floors),
  **populated** including the **honest below-floor edge** (hero + agent row flip to
  `--warning`, never dressed as on-track).

## Phase 3 — tests
- Update/extend the panel's existing test for the new structure + the four states. Keep the
  suite green.

## Phase 4 — docs + commit/PR
- PR row; note it's the agent half of the Goals v2 redesign, restyle-only.
- CONTEXT.md per Rule 16(b): this is a **live, user-visible UI change** to a non-gated
  panel — advances Current main HEAD (confirm against the rule as you fill).
- Branch `feat/goals-agent-restyle`; `feat(goals): restyle agent Goal Hierarchy (v2)`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
**Production-facing (live panel) — render smoke, no write-read needed (read-only panel).**
Against the preview, log in as the test agent (who has a committed goal from the loop), open
Goals → assert the **CommitmentHero**, the **group-keyed cascade** (with the chosen org-tier
treatment), and the **GapNote** all render, and that the panel reads the committed goal.
Exercise the **empty** state too (an agent with no committed goal → the "Build it in Game
Plan" state, cascade-floors-still-shown). Both themes + a mobile leg (More-drawer routine).

## Merge posture
**Human-merge — visual redesign, aesthetic gate.** Build to PR-open and STOP; do not merge,
do not deploy. Kyron eyeballs the redesigned panel in the preview (both themes + the chosen
cascade treatment) and merges. On merge, Vercel auto-deploys. No rules deploy.
