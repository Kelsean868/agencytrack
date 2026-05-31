# Track J redesign — AgentProductionView v2 port (shared component)

**Sized:** S–M
**Branch:** `redesign/agent-production-view` (off main)
**Type:** Track J v2 visual port of a **shared** presentational component.
**Channel:** **Human-merge + dispatcher pre-review.** NOT green-channel auto-merge.

**Channel rationale (both disqualify green-channel):**
1. The v2 hero adds structural JSX (avatar circle, 4-KPI block, "around me" mini-leaderboard) beyond className/token swaps — a layout change, not a pure restyle.
2. `AgentProductionView.jsx` is consumed by both **Production Report v2** and **Agent Report View v2** (double-mapped per the routing audit). Port it once here; the container screens assemble the ported component afterward.

## Outcome

Port `src/components/productionReport/AgentProductionView.jsx` to its v2 design using existing Nexus tokens only, as a standalone unit, so both consumers import one ported component (no double-touch). No new data fetches, no write paths, no role/route/nav change, no consumer-file edits.

## Authoring basis + verification posture

Authored from this session's routing audit (live HEAD), not from a local read of the v2 mockup. All visual specifics are delegated to the v2 mockup file; Phase 1 hard-gates confirm the assumptions below before any edit. The in-chat repomix is **pre-refactor** (shows retired `super_admin`) and must NOT be used as a source — live HEAD + the v2 mockup are authoritative.

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim.
4. Move the brief from Downloads into `docs/briefs/track-j-agent-production-view-kickoff.md` (Move-Item), then `git checkout -b redesign/agent-production-view` and commit the brief as commit 1.
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — source-verify + dependency gates (Rule 11 + Rule 17) — ALL hard-stops

Run BEFORE touching AgentProductionView.jsx. Pair `grep` with `git ls-files` for tracked-status on any referenced file.

1. **v2 mapping + mockup.** Open `design_handoff_v2_app/README.md` §6; confirm AgentProductionView's v2 mockup path; open the mockup.
2. **Cross-mapping consistency (G1).** AgentProductionView appears in BOTH "Production Report v2" and "Agent Report View v2" mappings. Confirm both mockups depict the SAME agent-production treatment. If divergent → port-once is invalid → **STOP and wait for dispatcher.**
3. **Shared-dependency (G2).** Determine whether the v2 "around me" mini-leaderboard renders via `productionReport/RankedLeaderboard.jsx` (or any other shared/double-mapped component). If it consumes RankedLeaderboard → that component ports first → **STOP and wait for dispatcher.** If the section is self-contained inline markup, proceed.
4. **Data-scope (G3).** Enumerate every value the v2 hero renders (avatar, the 4 KPI numbers, around-me entries). Confirm ALL are derivable from data the component already receives via props or its existing reads. If the v2 hero requires ANY new Firestore read, new service call, new prop, or new computed aggregate → scope beyond a visual port → **STOP and wait for dispatcher.**
5. **Invariants (G4).** Confirm no write path, no firestore.rules, no index, no role gating, no route/nav would change. If any would → **STOP and wait for dispatcher.**

## Phase 2 — execute the port (visual only)

1. Port to the v2 layout from the mockup: hero structure (avatar circle, 4-KPI block, around-me section), eyebrow labels, badge/status treatments.
2. **Nexus tokens only** — CSS-var-backed utilities (`bg-card`, `bg-surface`, `bg-{status}-tint`, `text-ink-muted`, etc.). No raw hex. No `bg-yellow-/zinc-/amber-` built-ins; map any medal/rank colors to gold/ink-muted/warning tokens.
3. Eyebrow-label convention (canary precedent): `text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted`.
4. Preserve all data wiring, props, and loading/error/empty states. Structural additions are layout-only and bind to already-available data (per G3).
5. **No consumer-file edits.** The public props contract must stay identical. If the v2 layout needs a prop the consumers don't pass, that is a G3/G4 stop — not a silent prop addition.

## Phase 3 — gates

- **3a hex-grep:** `grep -nE "#[0-9a-fA-F]{3,6}" src/components/productionReport/AgentProductionView.jsx` → empty.
- **3b scope (FINAL diff):** `git diff --stat main..HEAD` — AgentProductionView.jsx + brief + CONTEXT row + (optional) verification scripts under `scripts/`|`verification/` only. No `src/` file other than AgentProductionView.jsx. (Flag-1 carve-out: scope gate runs on the final diff, not an intermediate snapshot.)
- **3c lint / test / build:** all green; report counts verbatim.
- **3d axe baseline-delta:** build branch + main worktree; serve both; axe both themes; report branch N + main N per theme; assert NO-NEW **serious/critical** vs main baseline (delta, not absolute 0); break out serious/critical explicitly (Flag-2 nit).
- **3e both-themes smoke:** light + dark render; hero renders (avatar, 4 KPIs, around-me); 0 console errors. Selector + computed-style assertions (write-read-verify waived — read-only surface, no write path).

## Phase 4 — docs fill (same commit as Phase 2)

- CONTEXT.md recently-shipped row (top, `#{TBD}`/`{TBD}`): "Track J — AgentProductionView v2 port (shared component, human-merge). Hero restructure (avatar + 4-KPI + around-me) via Nexus tokens; ported once for both Production Report v2 + Agent Report View v2 consumers. No data/write/role/route change."
- Drop oldest row if >5. Top-table fields are Phase 6 (Rule 16).
- Add/refresh a Track J shared-component note in FOLLOW_UPS.md if warranted (e.g., "AgentProductionView ported; RankedLeaderboard double-mapping status").

## Phase 5 — commit, push, open PR — STOP for pre-review

1. `git add` the in-scope files only (NOT `git add -A`).
2. Commit; `git push -u origin redesign/agent-production-view`.
3. Open PR vs main. Body: reference this brief; state human-merge + dispatcher pre-review; paste Phase 3 results verbatim (lint/test/build, axe delta with serious/critical breakout, smoke).
4. **STOP and wait for dispatcher.** Do NOT merge. Do NOT auto-merge. Surface the PR URL + gate table. Dispatcher pre-reviews the diff (structural additions faithful to the mockup; bind only to existing data) before authorizing merge.

## Phase 6 — post-merge fill (after dispatcher confirms merge)

Sync main, capture squash SHA, fill `#{TBD}`/`{TBD}` in CONTEXT.md (+ FOLLOW_UPS if used), commit, push direct to main, then **Rule 15 verification** — paste verbatim `git log origin/main --oneline -1` AND `git rev-parse HEAD && git rev-parse origin/main`; confirm local HEAD == origin/main with fill commit on top and work-PR squash directly below; report "pushed and verified"; mismatch → **STOP and wait for dispatcher.** Then prod smoke (both themes) via `setupBypassSession`. AUTO-REVERT does NOT apply (human-merge) — on prod-smoke fail, **STOP and wait for dispatcher.**

## Acceptance criteria

- AgentProductionView.jsx renders the v2 hero (avatar, 4 KPIs, around-me) via Nexus tokens; zero raw hex; zero non-Nexus color built-ins.
- Public props contract unchanged; no consumer file modified.
- No new Firestore read/service/prop/aggregate; no write/rules/index/role/route/nav change.
- Final-diff scope per 3b. Lint 0 / tests green / build clean. axe NO-NEW serious/critical. Both-themes smoke pass.
- Brief committed as commit 1; CONTEXT row filled post-merge; Rule 15 verified.

## Out of scope

- `RankedLeaderboard.jsx` port (separate unit; sequences FIRST if G2 finds a dependency).
- Production Report + Agent Report View container assembly (thin assembly PRs after shared components land).
- `AgentReportDocument.jsx` (react-pdf; hex-exempt; separate Agent Report View track).
- Prospect Prep (reclassified to Track F feature spec).
- Any data-layer or write change (hard-stop in Phase 1).

## Rule references

Rule 9 (Phase 0 gate), Rule 10 (brief commit), Rule 11/17 (source-verify + `git ls-files` pairing), Rule 12 (exact halt language), Rule 15 (origin verify), Rule 16 (post-merge fill scope).
