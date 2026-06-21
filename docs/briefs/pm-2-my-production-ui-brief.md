# PM-2 — "My Production" for producing managers (UI)

## Status & channel
- **Status:** READY pending Phase 0. Depends on **PM-1 rules deployed** (done — self-access for UM/BM is live).
- **Channel:** build → PR-open → **HOLD** (human merge). **SUPERVISED** — this surfaces the widened access to real users. No auto-merge.
- **Goal:** give Unit Managers + Branch Managers the full agent toolset, scoped to **their own** production, under a single **"My Production"** section in ManagerDashboard. No new `personalApi` — own-production derives from submissions/settlements (the existing `GoalsPanel` pattern).
- **Size:** L. If Phase 0's screen-audit or the existing-surface reconciliation reveals materially more than mounting + light wiring (e.g. several screens carry `role==='agent'` guards needing real fixes), **report and propose phasing before building** rather than absorbing it silently.
- **Rules in force:** 10, 15, 16, 17, 19, 20, 21, 22, 23. No deploys (rules already deployed; this is app code).

## Phase 0 — source-verify (report before building; Rule 17)
1. **Nav pattern.** Confirm `ManagerDashboard` `NAV_ITEMS` and the role-gated entry pattern (`roles:['unit_manager','branch_manager']`, e.g. the existing Policy Ledger item). Confirm how to add a grouped **"My Production"** section gated to UM/BM.
2. **The seven agent screens.** Identify each component and how `AgentDashboard` mounts it: weekly report, daily capture, Goals, Game Plan, Money Needs, History, Commission. For **each**, audit two load-bearing things:
   - Does it carry a `role==='agent'` guard (return null / redirect / hide) that would block a producing manager? If so, that's a **targeted** guard-fix (extend to producing managers), not a rewrite — list each.
   - Does it read **team-aggregate** data anywhere, or does it scope strictly to a passed `uid`/the logged-in user? Any team-aggregate read is a leak risk in a "my production" screen — flag it.
3. **Existing producing-manager surface — reconcile.** Map what UM/BM already have (the Goals **Self** sub-tab; the Policy Ledger nav item). Decide how "My Production" relates: subsume them into the one section, sit alongside, or reuse. **If consolidating risks disrupting current PM workflow, STOP and propose the reconciliation before building.** Goal is one home for personal production, without breaking what works today.
4. **Wiring pattern.** Confirm the derive-from-submissions path to reuse: `getAgentSubmissions(tenantId, user.uid)` → `ytdTotals`, and `getSettlements(tenantId, user.uid, year)` for Commission (the `GoalsPanel` precedent). No `personalApi` field.
5. **Smoke identities.** Confirm whether **UM and BM** smoke credentials exist (`.env.local` / smoke tenant). PM-1's recon was static — no live manager session existed — so the manager smoke harness likely needs building, and UM/BM smoke accounts may need seeding (manager-created, producing-manager role, smoke tenant). Report what's present vs. what this PR must create.

## Design (locked intent)
- One **"My Production"** section in ManagerDashboard, gated `roles:['unit_manager','branch_manager']`, mounting the **seven** agent screens **scoped to `user.uid`**, reusing the existing agent screen components (do **not** fork them).
- Wire each to **own** production (own submissions → `ytdTotals`; own settlements for Commission). No new data field.
- Reconcile the existing Goals-Self + Policy-Ledger per the Phase 0 decision (one home, no duplication, no regression to current PM access).
- **Hard invariant:** every screen under "My Production" shows **only the manager's own** production. No team-aggregate data may appear in any of these screens — that's the UI-level counterpart to PM-1's own-only rule proof.
- Where a screen has a `role==='agent'` guard, extend it to producing managers (targeted) so the same component renders for UM/BM under their own uid.

## Do NOT change
The agent screen components' internals beyond a necessary guard extension; the manager team-management views; the PM-1 rules; `moneyNeedsService` and the other services' contracts. Reuse, don't rebuild. Nexus tokens only, no new hex.

## Tests & smoke (the load-bearing part)
- **Component tests:** "My Production" renders for UM and BM, and **not** for agent / SM / TA; each of the seven screens mounts with the `user.uid` scope; any extended role-guard now admits producing managers.
- **Live production smoke — UM *and* BM** (setupBypassSession; build the manager smoke harness — manager login + navigate ManagerDashboard → "My Production"; seed UM/BM smoke identities if Phase 0 finds none). For each screen, under each of UM and BM:
  - It **renders** (no crash, no role-guard block).
  - It reads **own** production — write-read-verify where the screen writes (submit a weekly report as the UM → reload → assert it persisted under the UM's uid and appears in History; own goals; own Money Needs; own Commission/settlements).
  - **It shows ONLY own data — assert no team member's production appears** (the UI own-only proof; if a team member's row/figure shows in a "My Production" screen, STOP and report).
  - Both viewports (mobile + desktop), both themes.
- Rule 22: note what the smoke can't reach.

## Gates & close
lint/test/build · both-theme · **axe NO-NEW** · hex-grep empty (token-only). PR-open, **HOLD**. Rule 20/21/22/23.

## Dispatch
1. Download to `~/Downloads/`.
2. `/land-and-dispatch pm-2-my-production-ui-brief.md`
