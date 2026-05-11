# Manager Overview placeholder hide — pre-pilot patch kickoff brief

**Status:** Ready to execute. Pre-pilot blocker — pilot branch managers cannot see fake data on their landing page.
**Estimated CC effort:** 30 minutes.
**Two-strike counter:** 0/2 (fresh session).

---

## Context

The manager portal audit (in progress, PR #100 brief, ongoing audit work) identified a critical pre-pilot issue: **Manager Overview shows hardcoded placeholder stats** at `src/components/dashboard/ManagerDashboard.jsx:134-140`:

```js
const stats = {
  totalAgents: 8,
  submittedThisWeek: 5,
  pendingSubmissions: 3,
  teamYTDAPI: 384000,
  teamAPIGoal: 960000
};
```

These render as 4 StatCard tiles on the Overview tab. **Every branch manager who logs in sees these literal placeholder values regardless of their actual branch data.**

The Manager Overview hero redesign (audit recommendation #1) will replace this surface with a real Team YTD donut + KPI sparkline strip backed by real Firestore reads. That's a P0/large PR coming out of the audit's implementation roadmap, but it lands weeks-to-months from now.

**This PR is a pre-pilot patch: hide the cards entirely** so pilot BMs see honest "data not yet available" messaging instead of misleading numbers. Once the Overview hero redesign lands, it removes/replaces this patch.

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -3`. HEAD should include PR #99 + the audit brief PR #100.
4. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`. **Note:** the audit worktree at `.claude/worktrees/design-manager-portal-audit` is currently active in another session — leave it untouched. This patch uses a separate worktree.
5. Create worktree at `.claude/worktrees/fix-manager-overview-placeholder` on branch `fix/manager-overview-placeholder-hide`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery (short)

1. Read `src/components/dashboard/ManagerDashboard.jsx` in full. Identify:
   - Exact lines where `stats` is defined (lines 134-140 per audit)
   - Where the 4 StatCard tiles render (downstream JSX)
   - The Overview tab's enclosing structure (how to surgically hide without breaking the Overview tab's other content like MotivationalCarousel)

2. Identify the StatCard component (`src/components/ui/StatCard.jsx` or similar) — read it to understand its props shape (in case the empty-state pattern uses it differently).

3. Find the existing Nexus empty-state pattern. The agent portal has a clean empty state for "no submissions yet" — search for that pattern in `src/components/dashboard/AgentDashboard.jsx` and reuse the same shape if reasonable.

Output briefly in chat (no full surface stop — this is too small):
- Exact lines to modify
- Replacement approach (single empty tile vs row of empty tiles vs section hidden entirely)
- Files to touch (target: 1 file, max 2)

Then proceed directly to Phase 3.

---

## Phase 3 — Implement

**Recommended approach (default):** Replace the 4 hardcoded-data StatCards with a SINGLE empty-state tile that reads:

> **"Branch metrics coming soon"**
> 
> A redesigned dashboard with real-time team metrics is in development. Until then, use Production Report and Master Sheet to track team performance.

Style it as a card matching Nexus tokens:
- `bg-card` or `bg-surface-raised`
- Border-radius matching existing cards
- Padding consistent with cards in the Overview tab
- Icon (use `Sparkles` or `BarChart3` from lucide-react — pick the one that fits visually)
- Heading: Cabinet Grotesk via `font-display` if available, otherwise inherit
- Body: standard Satoshi
- Colors: text-muted-foreground for the secondary line; text-foreground for the heading

Constraints:
- **No new dependencies**
- **No new design tokens**
- **Remove the hardcoded `stats` object** — leaving it as dead code invites future "why is this here" confusion. Delete the whole `stats` const block.
- **Preserve the rest of the Overview tab** — MotivationalCarousel, Submit Weekly Report button, anything else stays exactly as-is
- **Single file change** if possible. If the empty-state tile is reusable (it is), consider extracting to `src/components/ui/EmptyStatTile.jsx` (NEW file) — but only if extraction is cleaner than inline. Default to inline.

If discovery surfaces that the StatCards have other usages elsewhere, do not touch those — only the Manager Overview ones.

---

## Phase 4 — Tests

If `ManagerDashboard.test.jsx` exists, extend with one test asserting the empty-state tile renders and the old stat values (`8`, `5`, `3`, `384000`) do NOT appear in the rendered output.

If no existing test file, skip — the change is small enough and visually obvious enough to verify by smoke alone.

`npm test` must remain 100% passing.

---

## Phase 5 — Smoke

Quick visual check via Playwright at the preview URL:

1. Apply bypass via `buildBypassUrl` from `scripts/verification/lib/walk-helpers.mjs`.
2. Sign in as test branch manager.
3. Land on Manager Dashboard → Overview tab is default.
4. Capture screenshot at desktop (1440x900).
5. **Programmatic check:** assert the rendered text does NOT contain `"Total Agents"`, `"384,000"`, or any of the placeholder numbers (`"8"`, `"5"`, `"3"` — these as exact integers via the StatCard pattern). The empty-state tile's text `"Branch metrics coming soon"` SHOULD appear.
6. Repeat at mobile (390x844) — confirm the empty tile renders cleanly without horizontal scroll.

Capture light + dark. Total 4 screenshots.

---

## Phase 6 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit:
   ```
   fix(manager-overview): hide hardcoded placeholder stats before pilot
   
   Manager Overview previously rendered 4 StatCards with hardcoded placeholder
   data ({ totalAgents: 8, submittedThisWeek: 5, pendingSubmissions: 3,
   teamYTDAPI: 384000, teamAPIGoal: 960000 }) regardless of actual branch state.
   
   Replaced with a single "Branch metrics coming soon" empty-state tile.
   The full Overview hero redesign (audit recommendation #1) will replace this
   tile with a real Team YTD donut + KPI sparkline strip backed by Firestore.
   
   Pre-pilot patch; superseded by future Overview hero redesign PR.
   
   Smoke: PASS at 390x844 + 1440x900, light + dark. Placeholder numbers
   confirmed absent; empty-state tile renders.
   ```
5. Push, open PR titled: `fix(manager-overview): hide hardcoded placeholder stats before pilot`
6. PR description MUST include:
   - Before/after screenshots (light + dark, desktop + mobile)
   - Explicit note: "Pre-pilot patch — superseded by Overview hero redesign coming out of the manager portal audit."
   - Smoke results
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Discovery reveals the `stats` object is consumed elsewhere (not just the 4 StatCards) → STOP and surface
- Removing the hardcoded stats breaks the build or tests → STOP and surface
- Any change needed outside `ManagerDashboard.jsx` (and one optional new EmptyStatTile.jsx if extraction makes sense) → STOP
- Two strikes hit → STOP

---

## Out of scope

- Adding real Firestore reads for the Overview stats (audit recommendation #1 — separate PR, post-audit-merge)
- Redesigning the Overview tab visual hierarchy (audit territory)
- Touching MotivationalCarousel
- Touching any other dashboard surface
- Touching `docs/FOLLOW_UPS.md`
- Modifying the StatCard component itself
- Touching the audit work in progress at `.claude/worktrees/design-manager-portal-audit`
