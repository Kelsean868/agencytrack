# Addendum — Workspace / Both layout group definitions

Pulled verbatim from the mockup (`Nav & Quick Actions - 2 Options.html`,
functions `optionTwo` / `optionThree`). This fills the gap in the main build
spec §5, which pointed CC at the mockup for these lists.

Item shape is the same as the pinned layout: `{ key, label, icon, route, badge?, child?, soon?, scope? }`.
`scope` chip: **MINE** (own view) · **TEAM** (team view) · **BOTH** (one screen, scope toggle inside).
`soon` = visible but disabled `SOON` tag.

---

## WORKSPACE layout (`menuLayout = 'workspace'`)

### Agent — single workspace (NO My Work/My Team toggle)
- **Today:** Dashboard · Daily Log · Weekly Report
- **Plan:** Game Plan `NEW` · Money Needs *(child)* · Goals
- **Tools:** Commission · Persistency · Policy Ledger · Prospect Prep `SOON` · Production Report
- **Progress:** Leaderboard · Awards · History · Career Portal

### Producing Manager & Manager — toggle between two workspaces
Producing manager is the **"home"** producer: gets **Daily Log** in Today **and** the **Tools** group.
Manager (non-producing) gets **Weekly Report** only in Today and **no Tools group**.

**◆ My Work**
- **Today:** Dashboard · Daily Log *(producing manager only)* · Weekly Report
- **Plan:** Game Plan `NEW` · Goals `MINE`
- **Tools** *(producing manager only — omitted for manager)*: Commission · Persistency `MINE` · Policy Ledger · Production Report `MINE` · Prospect Prep `SOON`
- **Progress:** Leaderboard `BOTH` · Awards `MINE` · History · Career Portal

**◆ My Team** *(identical for producing manager & manager)*
- **Team:** Team Dashboard · Master Sheet · Weekly WARs
- **Grow:** Recruiting · Campaigns · Meetings
- **Oversight:** Team Goals `TEAM` · Compliance · Team Reports `TEAM` · Persistency Entry `TEAM` · Reconciliation
- **Recognition:** Team Awards `TEAM` · Leaderboard `BOTH` · Kiosk Mode

---

## BOTH layout (`menuLayout = 'both'`)

No new lists. It is the **★ Pinned row** (the same per-role pin seeds from main spec §2/§3)
rendered **above** the My Work / My Team toggle, followed by the workspace groups exactly as
above. So: `[★ Pinned] → [workspace toggle] → [active workspace groups]`.
Agents in `both` still show no toggle (single workspace) — pinned row then their groups.

---

## ⚠ Planner consistency fix

The mockup's workspace lists predate the "pin Planner" decision, so **Planner `SOON` is missing
from the workspace/both group lists above.** Add it so all layouts agree:

- **Agent → Plan** group: add `Planner SOON` (after Goals)
- **Producing Manager / Manager · My Work → Plan** group: add `Planner SOON` (after Goals)
- **My Team → Grow** group: add `Planner SOON` (after Meetings)
- In **Both**, Planner also rides along in the pinned row automatically (it's a pin seed).

Treatment = same as Prospect Prep: visible, disabled, `SOON` tag, route stubbed until the
Planner feature ships.

---

## Implementation note

These are reorganizations of tools that already exist in `navConfig` from PR-1 — not new
screens. `workspace`/`both` just regroup the existing per-role item set under the toggle. The
only genuinely shared/duplicated entries are the scope-chipped ones (Goals, Persistency,
Reports, Awards, Leaderboard), which intentionally appear in both workspaces.
