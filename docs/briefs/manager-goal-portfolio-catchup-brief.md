# Manager Goal-Portfolio Catch-up

**Sized:** S
**Branch:** `feat/manager-goal-portfolio-catchup` (off freshly-fetched main)
**Type:** Display-only — mount the three role-agnostic v3 panels into the producing-manager's own-goals view in `GoalsPanel`. **NO rules / CF / migration / money / schema.**
**Channel:** **TIER-B AUTO-MERGE.** Reuses existing panels (same as the agent dashboard), so no new design. Full gates + value-asserting smoke (manager's own portfolio values + hidden-for-non-producer) + Gemini hard gate + both-themes → prod-smoke + AUTO-REVERT. **Report after — don't hold.**
**Suggested CC model:** **Sonnet** — Tier-B feature from a detailed brief; the reasoning is in the brief.
**Persona review:** none — well-trodden mount pattern, not net-new design.

---

## What it is

A producing manager's own-goals view in `GoalsPanel` currently shows `GapAnalysisPanel` but **not** the three v3 portfolio panels (`DerivedIncomePanel`, `AwardsReachPanel`, `MdrtTracker`) — those live only on the agent dashboard. This slice mounts those three into the manager's own-goals section so a producing manager sees the *identical* portfolio for their own production. The panels are already role-agnostic (operate on the viewer's own data), so this is a mount + wiring, **not** a rebuild — no panel-internal changes.

---

## Phase 1 — source-verify · report-and-PROCEED (STOP on premise break)

1. **The manager's OWN-production data in `GoalsPanel` scope.** Confirm `GoalsPanel` has the manager's own `allSubmissions` / `settlements` / `userProfile` / `ytdTotals.api` in the same shape `AgentDashboard` passes to the three panels. `CommissionPlayground` (L567) already sets the manager's own commitment, so the own-production context is *likely* present — confirm the exact props/values and that they're the manager's **own**, not team-aggregate. **STOP if** the manager's own production isn't available without a new read or a rules-touching pattern (that's a scope change, not this slice).
2. **`GapAnalysisPanel` scope in `GoalsPanel` (L1081)** — is it personal-inclusive (shows the manager's own personal-commitment gap in the cascade) or team-only? This decides whether the three panels join an existing personal section or need a small "My goals" wrapper. Report which; proceed with the matching shape.
3. **Producing-manager gate** — reuse the **existing** gate that shows the "Submit Weekly Report" button to **UM + BM only** (hidden SM / TA / platform_admin). The three panels mount behind that **same** gate — only producing managers see the personal portfolio. Identify and reuse it; do not invent a new one.
4. **Mount point** — where the manager's own-goals section sits (with/below `GapAnalysisPanel`), mirroring agent-dashboard order: GapAnalysis → DerivedIncome → AwardsReach → MdrtTracker.
5. Existing `GoalsPanel` tests.

---

## Phase 2 — build

Mount `DerivedIncomePanel` + `AwardsReachPanel` + `MdrtTracker` in `GoalsPanel`'s manager own-goals section, **behind the producing-manager gate (UM/BM only)**, fed the manager's own production data, in agent-dashboard order. **Do NOT re-add `GapAnalysisPanel`** (already present). Both themes, mobile, ≥44px, Nexus tokens (no hex), Lucide. Reuse panels as-is — no panel-internal edits (already role-agnostic).

---

## Phase 3 — tests

- **Render:** the three panels appear in `GoalsPanel` for UM and BM.
- **Gate:** hidden for SM, TA, platform_admin.
- **Data (value assertion):** panels fed the manager's OWN production — on a known fixture, assert the manager's own gap / derived income / MDRT progress numbers.
- Full suite green; lint 0; build clean; hex-grep clean.

---

## Phase 4 — docs

- `CONTEXT.md` ledger; ROADMAP — mark manager catch-up **done** (producing managers now have the full own-goal portfolio).
- `FOLLOW_UPS.md` — close/annotate the manager catch-up FU as shipped; note the Tier-2 manager cockpit re-port absorbs this surfacing.

---

## Phase 5 — PR + smoke + Tier-B auto-merge

1. Gemini hard gate.
2. **Smoke (both themes):** sign in as a producing manager (the existing BM test account), open Goals, assert the three panels render with the manager's OWN production **values** (real gap number, derived income, MDRT progress) — not presence. Then sign in as a non-producing role (the tenant-admin account) and assert the panels are **hidden**. axe NO-NEW.
3. **Auto-merge on green** → prod-smoke (deployment-aware, per the smoke-hardening FU if it's landed) + AUTO-REVERT. **Report after.**
4. Post-merge report: both-theme screenshots (manager view), asserted values, the gate-hidden confirmation, Gemini disposition.

---

## Risk notes

- The one real recon risk is Phase 1.1 — whether the manager's OWN production is in `GoalsPanel` scope. `CommissionPlayground` suggests it is; if not, sourcing it could expand scope → STOP and report.
- Gate correctly to producing managers only — a personal-production portfolio shown to an SM/TA who files no personal production would be empty and confusing.
- Panels reused unchanged — no role hardcoding to add; they're already role-agnostic, which is the whole reason this is an S.
