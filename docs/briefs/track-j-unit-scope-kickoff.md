# Track J — P5a unit-scope toggle (UM/BM scope control)

**Sized:** M–L
**Branch:** `redesign/leaderboard-unit-scope` (off main)
**Type:** Client-only UI. Role-aware scope control on `ProductionLeaderboardSurface`, filtering on the now-live `unitId` and re-ranking via `rankWithinUnit` (both P5-prep). **No backend, no deploy.** **Human-merge + dispatcher pre-review.**

## Outcome

Managers can scope the leaderboard to a unit. UM gets a My Unit / My Branch toggle; BM gets My Branch + a unit-picker. Scoping to a unit re-ranks the whole surface within that unit, rescales the %-of-leader bars to the unit's leader, and updates the subtitle. Agents see no control. The selection persists per user.

## Decisions baked in (do not re-litigate)

- **Role gating:** Agent → **no control** (branch-wide, unchanged). UM → 2-segment **My Unit / My Branch**, default **My Branch**. BM → **My Branch** + a **unit-picker** (any unit in their branch), default My Branch. **SM → out of scope (P5b).**
- **The filter is one rule:** scoped-to-unit means `entries.filter(e => e.unitId === targetUnitId)`, where `targetUnitId` = the **viewer's own UID** for a UM's My Unit (a UM's `unitId` == their UID; their agents carry it — verified in the P5-prep smoke: agents sat under `unitId` = the UM's id), or the **picked unitId** for a BM. Same code path.
- **Re-rank within scope:** when scoped to a unit, display `entry.rankWithinUnit` (already computed, no server round-trip). My Branch shows `entry.rank`.
- **Rescale %-of-leader:** the bar's reference leader = the **max API within the current scope**, not the branch leader. (Claude Design's explicit note: the same agent's bar is longer under My Unit because the reference changes.)
- **Subtitle** updates to show scope + count (e.g., "South · Test Unit · YTD · N agents").
- **BM unit-picker options** = the distinct `(unitId, unitName)` pairs already present on the loaded branch entries — no extra fetch.
- **Persist** the last-used scope per user via `localStorage` keyed by UID (mirror the dark-mode persistence pattern), default My Branch.
- **Visual:** segmented control matching the period chips + a leading lucide icon (`Users` = unit, `Building2` = branch). Desktop: scope sits LEFT of the period chips with a 1px divider. Mobile: scope stacks above the chips.

## ⚠️ Test-data dependency — resolve in Phase 1

Live-verifying the scoped view needs a **usable UM (and ideally BM) test credential**. The seed roster lists `um-001@agencytrack.test` / `bm-001@agencytrack.test`, but a working password is unconfirmed. **Phase 1 must confirm a usable manager credential.** If none exists, the toggle is **component-tested only** and CC surfaces this to the dispatcher (Kyron decides: provide a credential, or accept component-only verification for this PR). Do NOT block the build on it — build + component-test regardless; only the live smoke is gated on the credential.

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-unit-scope-kickoff.md`; branch `redesign/leaderboard-unit-scope`; commit as commit 1.
3. Failure/drift → STOP.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read the frontend SKILL (or repo Nexus conventions).
2. Confirm entries carry `unitId` + `unitName` + `rankWithinUnit` (P5-prep) and that a UM's agents carry `unitId == the UM's UID`.
3. Confirm how the viewer's role is read (auth claim / user doc) to gate the control.
4. Confirm the `localStorage` persistence pattern (dark mode); check whether the period chip persists and mirror it if so.
5. Source-verify the segmented-control + icon + placement treatment against the mockup.
6. **Confirm a usable UM/BM test credential** (see the dependency block). If none, flag it and proceed component-only.
7. Drift → STOP.

## Phase 2 — build

- **Scope control** (role-aware): agent → render nothing; UM → My Unit / My Branch segmented control; BM → My Branch + unit-picker (options = distinct units on the branch entries).
- **Scope filter** that derives the displayed ranking from the loaded branch entries:
  - My Branch → all entries, `rank`, branch maxApi.
  - Scoped unit → `filter(e.unitId === targetUnitId)`, `rankWithinUnit`, unit maxApi.
- Feed the scoped+re-ranked set to the podium, tail, and around-me (all re-scope together). Empty unit → `EmptyState`.
- Subtitle shows scope + count. Persist scope (localStorage, keyed by UID, default My Branch).
- Nexus tokens; no raw hex; no backend/aggregate change.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** the scope control + scope-filter logic + surface wiring + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no rules, no unrelated `src/`.
- **3c lint / test / build** green (verbatim).
- **3d axe baseline-delta** both themes; NO-NEW serious/critical (gold/contrast FU-tracked).
- **3e UNIT/LOGIC tests (the scope filter — PRIMARY):** My Branch → all entries / `rank` / branch maxApi; My Unit (mock UM UID) → only that unit's entries / `rankWithinUnit` / unit maxApi; empty unit → empty; BM picked unit → that unit's set. Exhaustive on filter + re-rank + rescale.
- **3f COMPONENT tests:** the control renders per role (agent → absent; UM → 2-segment; BM → segment + picker); selecting My Unit re-scopes the podium + tail (mock UM role + mock entries); subtitle updates; persistence round-trips (set → remount → restored).
- **3g LIVE smoke (both themes):**
  - Agent (test agent) → assert **NO scope control** renders; surface is branch-wide as before. (Always runnable.)
  - Manager → IF a UM/BM credential exists: log in, select My Unit, assert the surface re-scopes (fewer agents, re-ranked by `rankWithinUnit`, subtitle shows the unit + count), both themes. IF no credential: skip + report "live manager-scope unverified — component-tested only; credential needed" to the dispatcher.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`).
- Resolve the P5a FU. Record: **P5b = SM scope picker, parked** — head of sales confirmed an SM oversees ALL branches (2026-05-31), so the existing `ownedBranchIds: ['*']` model is correct; P5b is a single-branch picker over all tenant branches, blocked only on seeding an SM account + a second branch.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gate results + the credential outcome. STOP. I pre-review the **role-gating** (agents must get NO control), the **filter + re-rank correctness** (My Unit uses `rankWithinUnit` + unit maxApi, not branch), the **persistence keying** (per-user), and the **live-vs-component verification outcome**.

## Phase 6 — post-merge (no deploy)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke (agent sees no control; manager scope if credentialed) verbatim. Frontend-only; Vercel auto-deploys on merge.

## Acceptance criteria

- Role-aware scope control (agent none / UM My Unit+My Branch / BM My Branch+unit-picker); scoping to a unit re-scopes the whole surface (filter `unitId`, re-rank `rankWithinUnit`, rescale %-of-leader to the unit leader, subtitle scope+count); persists per user; logic-tested exhaustively; component-tested per role; live-smoked for the agent no-control case always and the manager scoped case if a credential exists (else component-only + flagged); gates green.

## Out of scope

SM scope (P5b — all-branches picker, parked on seeding an SM + a 2nd branch). Movement chip. Banner re-home.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
