# Kickoff brief — Axe Find F: GroupHeader `var(--color-text-faint)` eyebrow labels

**Type:** XS fix (2 lines, 2 files) · GREEN-CHANNEL eligible  
**Dispatched:** 2026-06-15  
**Authority:** RUN queue item 6 (axe sweep) + CLAUDE.md text-faint→text-muted standing carve-out  
**Rule 10 note:** This brief commits to `docs/briefs/` per Rule 10 before dispatch.

---

## Problem statement

Production axe smoke for PR #636 surfaced a pre-existing `serious color-contrast` violation in Awards (light mode):

```
<p class="text-xs font-bold tracking-widest font-mono uppercase" style="color: var(--color-text-faint)">
```

This is the `GroupHeader` component's eyebrow `<p>` when `accentStyle.color = 'var(--color-text-faint)'`. `--color-text-faint` in light mode fails AA (12px bold small text requires 4.5:1; `text-faint` is below threshold). Dark mode passes. NOT introduced by PR #636 — pre-existing on main.

Banked as Find F in `docs/FOLLOW_UPS.md` during PR #636 post-merge fill.

---

## Source verification (Rule 17)

**Two call sites** pass `color: 'var(--color-text-faint)'`:

| File | Line | Label |
|------|------|-------|
| `src/components/awards/AgentAwardsPanel.jsx` | 203 | `"◯ Just starting · under 30%"` |
| `src/components/awards/ManagerAwardsPanel.jsx` | 305 | `"◯ Just starting · under 30%"` |

All other `GroupHeader` call sites in both files use `var(--color-gold)` or `var(--color-primary)` — both pass AA.

**Target contrast:** `var(--color-text-muted)` achieves 4.76:1 in light mode (confirmed in PR #623 for identical token on same surface — passes 4.5:1 AA). Preserves visual de-emphasis intent vs gold/teal group headers. Dark mode: `text-muted` also passes (confirmed by PR #623 smoke).

---

## Decisions locked

- **Token choice:** `var(--color-text-muted)` — not `var(--color-text)`. Preserves hierarchy (just-starting = lowest visual weight).
- **Scope:** exactly these 2 lines in 2 files. No other changes.
- **Carve-out:** CLAUDE.md standing pre-authorization for `text-*-faint → text-*-muted` applies. No Phase-5 stop needed for this pattern.

---

## Phase 0 — branch + sync

```
git fetch origin && git pull origin main
git checkout -b fix/axe-find-f-groupheader
```

## Phase 1 — source verify

```
grep -n "text-faint" src/components/awards/AgentAwardsPanel.jsx
grep -n "text-faint" src/components/awards/ManagerAwardsPanel.jsx
```

Expected: 1 hit each at lines 203 and 305. If different line numbers, update the fix targets.

## Phase 2 — edits

**`src/components/awards/AgentAwardsPanel.jsx:203`**  
Old: `accentStyle={{ color: 'var(--color-text-faint)' }}`  
New: `accentStyle={{ color: 'var(--color-text-muted)' }}`

**`src/components/awards/ManagerAwardsPanel.jsx:305`**  
Old: `accentStyle={{ color: 'var(--color-text-faint)' }}`  
New: `accentStyle={{ color: 'var(--color-text-muted)' }}`

## Phase 3 — verification

```
npm run lint && npm test && npm run build
```

All must pass. No new test file needed — purely cosmetic inline style value swap on a component with no behavior.

**Hex-grep:** confirm no hardcoded hex introduced:
```
grep -n "#[0-9a-fA-F]\{3,6\}" src/components/awards/AgentAwardsPanel.jsx
grep -n "#[0-9a-fA-F]\{3,6\}" src/components/awards/ManagerAwardsPanel.jsx
```

(Pre-existing hex refs for award colors are exempt per Nexus token policy — only NEW hex is a gate failure.)

## Phase 4 — PR

Open PR: `fix(a11y): axe Find F — GroupHeader just-starting accentStyle faint→muted`

PR body must include:
- Find F description + axe violation snippet
- Both files + line numbers
- Token choice rationale
- Green-channel gate checklist (pre-smoke boxes unchecked per Rule 18)
- Gemini disposition table (Rule 21)
- Self-critique gap (Rule 22)

## Phase 5 — smoke

Run `axe-finds-acd-smoke.mjs` against the Vercel preview (it covers the Awards panel). Expect:
- Awards (light): 0 serious violations (Find F resolved)
- Awards (dark): 0 serious violations (already clean)
- Dashboard/bell: 0 serious violations (Find A already resolved)

If Awards (light) still shows a violation: diagnose before reporting PR-ready.

Run against production post-merge for the AUTO-REVERT gate.

## Acceptance criteria

- `npm run lint && npm test && npm run build` all pass
- Axe smoke Awards (light): 0 serious `color-contrast` violations
- Axe smoke Awards (dark): 0 serious violations
- NO new violations vs main baseline on any leg
- CI `lint-and-build` + `functions-tests` both `SUCCESS`
