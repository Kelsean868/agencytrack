# E4 Phase 8 Follow-up — Playwright Walk

## Source

- Parent brief: `docs/briefs/e4-production-report-kickoff.md` (Phase 8 deferred per the explicit time-window scope-cut provision)
- Parent PR: #72 (currently open, all other E4 phases shipped, 60 new tests, lint clean, build green)
- Vercel preview URL: `https://agencytrack-git-feat-e4-production-report-kyron-marchan-s-projects.vercel.app`

This is a verification-only follow-up. No new feature work.

## Scope

### IN — this session

1. Discovery: confirm what test seats exist (agent, unit_manager, branch_manager) and what env vars are configured
2. Write `scripts/verification/e4-walk.mjs` based on `e1-slice-2b-walk.mjs` patterns
3. Run walk against the Vercel preview URL
4. Save screenshots to `verification/e4/screenshots/`
5. Commit walk script + artifacts to existing `feat/e4-production-report` branch
6. Update PR #72 description with walk results
7. STOP — Kyron reviews and merges

### OUT

- Fixes to E4 components unless walk surfaces real bugs (in which case STOP and surface, do not fix in this session)
- Updates to other features
- Creating new test seats if they don't exist (surface to Kyron instead)

## Discipline gates

- **Branch:** `feat/e4-production-report` (existing)
- **Worktree:** create new at `.claude/worktrees/feat-e4-production-report-walk` OR reuse existing if accessible
- No auto-merge — Kyron reviews after walk
- Two-strike counter starts at 0/2 (fresh session)
- Bundle this work into existing PR #72 (don't open a new PR)

---

## Phase 1 — Sync + worktree

```
git fetch origin --prune
git checkout feat/e4-production-report
git pull origin feat/e4-production-report
git log --oneline -5
```

Confirm HEAD is at `bd2f36a` (Phases 5+6+7 commit) or later.

If creating a new worktree:
```
git worktree add .claude/worktrees/feat-e4-production-report-walk feat/e4-production-report
cd .claude/worktrees/feat-e4-production-report-walk
```

---

## Phase 2 — Discovery

### Confirm template exists

```
ls scripts/verification/
```

Should see `e1-slice-2b-walk.mjs` and `e6-walk.mjs`. These are the templates — `e1-slice-2b-walk.mjs` is the most accumulated knowledge, use it as primary template.

### Confirm env vars

```
cat .env.local 2>/dev/null || echo "MISSING"
```

The walk needs these env vars:
- `A11Y_AGENT_EMAIL` + `A11Y_AGENT_PASSWORD` — agent test seat (likely `kelsean@gmail.com`)
- `A11Y_BRANCH_MANAGER_EMAIL` + `A11Y_BRANCH_MANAGER_PASSWORD` — branch manager seat
- `A11Y_UNIT_MANAGER_EMAIL` + `A11Y_UNIT_MANAGER_PASSWORD` — unit manager seat (may not exist)
- `VERCEL_BYPASS_TOKEN` — for SSO bypass

If `.env.local` is missing from worktree, copy from main project root.

### Test-seat triage

Read `.env.local` and identify which role seats are configured.

**Possible scenarios:**

- **All three role seats present** → write full 14-check walk
- **Agent + branch_manager only (no unit_manager)** → write degraded walk skipping checks 7-9 (unit_manager view), document the gap. Acceptable per success states below.
- **Only agent seat** → STOP and surface to Kyron. Walk needs at least branch_manager to be useful.

### STOP conditions

- `.env.local` missing entirely from project (not just from worktree)
- Only agent seat exists (insufficient coverage for E4's role-aware views)
- Vercel preview URL returns 404 or auth wall the bypass token can't bypass

---

## Phase 3 — Write the walk script

Create `scripts/verification/e4-walk.mjs`. Pattern after `e1-slice-2b-walk.mjs` exactly — same imports, same helpers, same screenshot directory convention, same continue-after-failure pattern with `check()` wrapper.

### The 14 checks (from parent brief Phase 8)

1. Login as agent → AgentDashboard shows Production Report tab → click → screenshot
2. Agent view: production breakdown shows correct values → screenshot
3. Agent view: rank within unit + branch displayed → screenshot
4. Agent view: TimePeriodToggle to MTD → values change → screenshot
5. Agent view: TimePeriodToggle to YTD → values change → screenshot
6. Agent view: DataSourceBadge shows correct status → screenshot
7. Login as unit_manager → ManagerDashboard shows Production Report tab → click → screenshot
8. Unit Manager view: unit aggregate, compliance count, unit leaderboard → screenshot
9. Unit Manager view: TimePeriodToggle works → screenshot
10. Login as branch_manager → branch view shows → screenshot
11. Branch Manager view: branch aggregate, unit leaderboard, top 10 agents → screenshot
12. Branch Manager view: "View all agents" expansion works → screenshot
13. Mobile (380px) — Agent view + Branch view → screenshots
14. Dark mode — Agent view + Branch view → screenshots

### Critical patterns from prior walks (don't re-derive)

- Bypass token URL pattern: `?x-vercel-protection-bypass=<TOKEN>&x-vercel-set-bypass-cookie=true` on first request, sets cookie for subsequent requests
- Wizard "Select Week" entry (relevant if any check involves the wizard)
- PDF flow goes through `ReportRangeModal` → "Generate & Download" (not relevant for E4 specifically)
- Branch Manager email env var: `A11Y_BRANCH_MANAGER_EMAIL` (not `A11Y_MANAGER_EMAIL`)
- Dark mode toggle button: confirm aria-label via discovery if needed
- After role-switching tests, navigate explicitly back to dashboard before next check (prevents stale state)

### Selector discovery

Visit the live preview, inspect what selectors the new E4 components actually use. The brief specs them generically; the actual implementation may differ. CC should:

1. Visit Vercel preview, inspect the Production Report tab
2. Identify reliable selectors (data-testid attributes, aria-labels, semantic role queries)
3. If selectors are missing or fragile, NOTE it but proceed — selector hardening is a separate concern not in scope here

---

## Phase 4 — Run the walk

Single run, document results.

```
node scripts/verification/e4-walk.mjs
```

Expected outcomes:

- **14/14 pass:** commit script + screenshots, update PR, done
- **12-13/14:** review failures. Mobile or dark mode failures (checks 13-14) are flag-don't-stop. Document and proceed.
- **<12:** STOP and surface. Either selectors are off (flake — fix in walk script and retry once) OR real component bugs (surface to Kyron, do NOT fix components in this session)

### One retry allowed

If walk fails 11-13/14 on first run, ONE retry is permitted with selector adjustments. Beyond that, STOP and surface.

---

## Phase 5 — Commit + update PR

### Files to commit

- `scripts/verification/e4-walk.mjs` (new)
- `verification/e4/screenshots/*` (artifacts)
- Possibly `scripts/verification/README.md` updates if any new patterns accumulated

### Commit message

```
test(e4): playwright walk for production report — X/14 pass

Phase 8 of E4 brief, deferred during main session per time-window scope-cut.
Walk verifies all three role views, time-period toggles, data source badge,
mobile, dark mode.

Skipped checks: [list any]
Real bugs surfaced: [none / list]
Flakes/selectors: [none / list]
```

### PR #72 description update

Append a "Phase 8 verification" section:

```
## Phase 8 — Playwright Walk (added in follow-up session)

Status: SHIPPED
Results: X/14 pass
Artifacts: verification/e4/screenshots/

[List any deferrals or known issues]

Walk script: scripts/verification/e4-walk.mjs
```

### STOP — do not merge

Kyron reviews the screenshots and walk script, then merges if happy.

---

## Hard stops (any → surface and wait)

- Phase 2 surfaces missing test seats beyond the unit_manager-only gap (agent missing, or branch_manager missing)
- Phase 3 selector discovery surfaces architectural concern (e.g., new components have no testable selectors at all)
- Phase 4 walk surfaces a real bug in E4 components (component doesn't render, data wrong, navigation broken)
- Two strikes hit

## Success states

**Best:** 14/14 pass, walk script + screenshots committed, PR #72 updated with verification section.

**Acceptable:** 12-14/14 pass with mobile or dark mode failures documented as known issues. Real bugs in those checks surfaced for follow-up but not blocking E4 merge.

**Acceptable with note:** Unit_manager test seat doesn't exist → walk covers ~10/14 (agent + branch_manager + cross-cutting checks). Document the gap clearly in PR description with a follow-up note for Kyron to either create the seat OR accept the coverage gap.

**Stopped:** Real bugs surfaced by walk → state-dump in chat with screenshots, do NOT fix in this session, do NOT merge. Bugs become a separate small PR.

---

## Notes for CC

- **Strike counter resets to 0/2** — fresh session.
- **Verification-only scope.** If the walk surfaces bugs in E4 components, do NOT fix them. Document, surface, stop. Bug-fixing is a separate session with its own PR cycle.
- **One retry allowed on selector flakes** — beyond that, stop. The goal is verification, not perfection.
- **Reuse e1-slice-2b-walk.mjs ruthlessly** — patterns there are battle-tested. Don't re-derive bypass token handling, dark mode toggling, mobile viewport, screenshot naming.
- **Trust-but-verify discipline:** PR description update must include explicit verification evidence — not just "walk ran" but X/14 with which checks failed and why. The E6 false-completion-report lesson applies.
