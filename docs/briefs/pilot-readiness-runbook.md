# AgencyTrack — Pilot Readiness Runbook

**Tenant:** `tatillife_south`  
**Date:** 2026-06-07  
**Status:** HOLD — awaiting operator morning review  
**Consolidated status:** All Priority 1 sections complete. ⚠ OPERATOR items require morning action. Priority 1b (coming-soon gating) complete — PR [#541](https://github.com/Kelsean868/agencytrack/pull/541) (brief) + PR [#542](https://github.com/Kelsean868/agencytrack/pull/542) (impl), both HOLD. Priority 2 (flake matrix) in progress — PR TBD (branch `fix/nudge-flake-stabilization`; number assigned after matrix gates pass or cliff executes).

---

## §1 Prod Smoke Results (Priority 1A)

**Smoke run:** 2026-06-07, production URL `https://agencytrack.vercel.app`  
**Script:** `scripts/pilot-prod-smoke.mjs`  
**Result: 62/62 PASS — all surfaces, all role tiers, both themes**

| Role | Theme | Nav surfaces | Result |
|------|-------|--------------|--------|
| agent | light | Dashboard, History, Game Plan, Money Needs, Goals, Commission, Persistency, Policy Ledger, Prospect Prep, Production Report, Awards, Career Portal, Leaderboard | ✓ 13/13 |
| agent | dark | same | ✓ 13/13 |
| tenant_admin | light | Dashboard, Branches, All Users, Company Config, Campaigns | ✓ 5/5 |
| tenant_admin | dark | same | ✓ 5/5 |
| branch_manager | light | Overview, Team, Master Sheet, Compliance, Persistency, Goals, Settlements, Campaigns, Awards, Leaderboard, Production Report, Policy Recon, Kiosk | ✓ 13/13 |
| branch_manager | dark | same | ✓ 13/13 |

Screenshots: `tmp/pilot-smoke-screenshots/` (62 files)

**Findings:** None. All nav items render and load without JS errors.

---

## §2 Test-Data Census (Priority 1B)

⚠ **OPERATOR — census script requires ADC credentials (blocked).**

The census script at `scripts/census-tatillife-south.cjs` is ready but requires:
```
gcloud auth application-default login
# or: set GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
node scripts/census-tatillife-south.cjs
```

**Known test accounts** (from directive + common patterns):
- `kelsean@gmail.com` — agent account, should be deleted
- Any `kelsean+*` variants (e.g. `kelsean+tenantadmin@gmail.com`)
- Any `kyronmarchan@gmail.com` accounts
- Any `*@agencytrack.test` smoke accounts from shakedown/test sessions

**Cleanup script** (DRAFT, dry-run default): `scripts/cleanup-tatillife-south.cjs`
```
# Step 1: Review what will be deleted
node scripts/cleanup-tatillife-south.cjs

# Step 2: Operator authorizes, then execute
node scripts/cleanup-tatillife-south.cjs --execute
```

⚠ OPERATOR: Run census, review output, authorize cleanup before morning provisioning begins.

---

## §3 Provisioning Runbook (Priority 1C)

### Entity dependency order

Firestore entity dependencies: `branches` → `units` (branchId field) → `users` (unitId + branchId fields) → invite delivery verification.

### Pre-flight checklist
- [ ] Census cleanup complete (§2 above)
- [ ] Backup completed (§5 gcloud export command below)
- [ ] `kyron.marchan@tatil.co.tt` canary invite delivered and accepted
- [ ] Production smoke post-provisioning (§7 morning runbook)

### Step 1 — Create Branches (tenant_admin)

Sign in as tenant_admin → Branches tab → **New Branch**

| Branch name | Notes |
|-------------|-------|
| Cyril Murray Branch | |
| Kendell Lowhar Branch | |

Verification: both branches appear in Branches list with correct names.

### Step 2 — Create Units

Sign in as tenant_admin (or branch_manager once assigned) → branch detail → **New Unit**

> ⚠ OPERATOR AUDIT: **Phoenix Unit** — the directive lists Cyril Murray as both Branch Manager AND unit manager ("BM-as-unit-manager"). Verify whether the app's unit-manager role assignment supports a branch_manager also holding a unit_manager role, OR whether Phoenix Unit should be assigned a separate unit_manager. Check `functions/index.js` `createUser` logic and `firestore.rules` for any restriction. If unsupported, assign a placeholder until Cyril Murray's role is confirmed — do NOT block provisioning.

| Unit name | Branch | Manager |
|-----------|--------|---------|
| Phoenix Unit | Cyril Murray Branch | ⚠ See audit above |
| Juniors Unit | Cyril Murray Branch | Mary-Ann Mc Donald |
| Letitia's Unit | Kendell Lowhar Branch | Letitia Lee-Ramcharan |
| Damian's Unit | Kendell Lowhar Branch | Damian Cuffy |

Note: apostrophes in "Letitia's Unit" and "Damian's Unit" — these are stored as display strings in Firestore; no escaping needed in the UI form, but any Admin SDK script referencing these by name must escape them.

### Step 3 — CANARY: Kyron Marchan (agent, Phoenix Unit)

**HALT bulk provisioning if this invite is not delivered.**

Sign in as tenant_admin → All Users → **New User**

| Field | Value |
|-------|-------|
| Name | Kyron Marchan |
| Email | kyron.marchan@tatil.co.tt |
| Role | agent |
| Branch | Cyril Murray Branch |
| Unit | Phoenix Unit |

After creating: check that invite email arrives at `kyron.marchan@tatil.co.tt` within 5 minutes. The invite uses the SendGrid transactional email configured in Cloud Functions.

**If email not delivered:** HALT bulk provisioning. Check:
1. `firebase functions:log` for the `doCreateUser` function — look for SendGrid errors
2. Verify SendGrid API key is valid (`SENDGRID_API_KEY` in Cloud Functions env)
3. Check SendGrid dashboard for bounce/spam classification
4. `tatil.co.tt` domain may have SPF/DKIM issues — ⚠ OPERATOR before proceeding

### Step 4 — Create tenant_admin (Kelsean)

| Field | Value |
|-------|-------|
| Name | Kelsean (full name TBD) |
| Email | kyronmarchan+tenant@gmail.com |
| Role | tenant_admin |

Note: This is a Gmail `+` alias that delivers to the main Gmail inbox.

### Step 5 — Create Branch Managers

| Name | Email | Role | Branch |
|------|-------|------|--------|
| Cyril Murray | cyril.murray@tatil.co.tt | branch_manager | Cyril Murray Branch |

⚠ OPERATOR: If Cyril Murray is also the Phoenix Unit manager (see §3 Step 2 audit), resolve this first. A branch_manager account may not need a separate unit_manager assignment depending on app behavior.

### Step 6 — Create Unit Managers

| Name | Email | Role | Branch | Unit |
|------|-------|------|--------|------|
| Mary-Ann Mc Donald | maryann.mcdonald@tatil.co.tt | unit_manager | Cyril Murray Branch | Juniors Unit |
| Letitia Lee-Ramcharan | letitia.ramcharan@tatil.co.tt | unit_manager | Kendell Lowhar Branch | Letitia's Unit |
| Damian Cuffy | damian.cuffy@tatil.co.tt | unit_manager | Kendell Lowhar Branch | Damian's Unit |

### Step 7 — Create Agents (Phoenix Unit, Cyril Murray Branch)

| Name | Email | Unit |
|------|-------|------|
| Joanne Grant | joanne.grant@tatil.co.tt | Phoenix Unit |
| Christal Garcia | christal.garcia@tatil.co.tt | Phoenix Unit |
| Ria Rampersad | ria.rampersad@tatil.co.tt | Phoenix Unit |
| Darcel Lopez | darcel.lopez@tatil.co.tt | Phoenix Unit |

### Step 8 — Create Agents (Juniors Unit, Cyril Murray Branch)

| Name | Email | Unit |
|------|-------|------|
| Kamilah Collins | kamilah.collins@tatil.co.tt | Juniors Unit |
| Melissa Douglas | melissa.douglas@tatil.co.tt | Juniors Unit |
| Akil Lewis | akil.lewis@tatil.co.tt | Juniors Unit |
| Shenika Mcalister | shenika.mcalister@tatil.co.tt | Juniors Unit |

### Step 9 — DEFERRED: Kendell Lowhar

Kendell Lowhar (branch_manager, Kendell Lowhar Branch) — no email yet. Create when email is available.

### Post-provisioning visibility scoping checks
- Mary-Ann McDonald signs in → should see **Juniors Unit only** (4 agents above)
- Cyril Murray signs in → should see **all 9 Cyril Murray Branch agents** (Phoenix + Juniors)
- Letitia Lee-Ramcharan signs in → should see **empty unit** (0 agents) — legitimate, not a bug
- Damian Cuffy signs in → should see **empty unit** (0 agents) — legitimate, not a bug

### Contract dates / week-1 backfill note
All contract dates are blank. Tenure API floor defaults to `FLAT_ANNUAL_API_FALLBACK = 200,000 TTD` for agents with missing `contractStartDate`. The goals carousel will show the 200k floor until managers fill in actual contract dates via Edit User.

**Week-1 backfill note:** Agents will need to submit their first weekly report before any dashboard KPIs populate. The pilot demo should either (a) pre-seed a sample submission via the wizard on Day 1, or (b) Kyron submits the canary account's first WAR before the full-team demo.

---

## §4 Config Truth-Check (Priority 1D)

### Weekly Activity Floors
**Source:** `src/utils/weeklyActivityFloors.js` — from Tatil manager workshop 2026-05-19, "Appendix A"

| Activity | App default |
|----------|-------------|
| Prospecting calls | 60 |
| Contacts Made | 40 |
| Appointments Scheduled | 20 |
| Interviews Kept | 15 |
| Fact Finds Completed | 10 |
| Closing Interviews Kept | 10 |
| Applications Submitted | 1 |
| Clients Sold | 1 |
| API (TTD) | 4,800/week |
| Referrals / New Leads | 100 |

⚠ OPERATOR: Verify these values against `Sales_Career.pdf`. If any differ, update via tenant_admin → Company Config → Company Minimums (writes to `tenants/tatillife_south/config/companyMinimums.weeklyActivityFloors`). Changes take effect immediately without a redeploy.

### Tenure API Floors
**Source:** `src/utils/tenureFloors.js` — confirmed by head-of-sales 2026-05-21

| Tenure band | Annual floor (TTD) |
|-------------|-------------------|
| < 12 months | 150,000 |
| 12–24 months | 200,000 |
| 25–36 months | 250,000 |
| 37–48 months | 300,000 |
| 49–60 months | 400,000 |
| > 60 months | 500,000 |
| No contract date (fallback) | 200,000 |

⚠ OPERATOR: These are seeded in `config/companyMinimums.tenureApiFloors`. Verify against `Sales_Career.pdf`.

### Awards Ruleset (DEFAULT_RULESET_2026)
**Source:** `src/config/awardsRuleset/2026.js`

Key thresholds (sample — full ruleset in source):
- Advisor of Month: API ≥ 50,000 TTD (in contention ≥ 25,000)
- Advisor of Month: Apps ≥ 15 (in contention ≥ 8)
- Quarterly Award: API ≥ 125,000 / Apps ≥ 45
- Agent of Year: API ≥ 1,000,000 / Apps ≥ 50
- MDRT: API ≥ 500,000
- Bronze Club L3: 250,000–349,999 TTD API
- All awards have persistGate = 90% minimum

⚠ OPERATOR: Verify key thresholds (especially Advisor of Month / MDRT / Club tiers) against `Sales_Career.pdf`. The ruleset is hardcoded in source — changes require a code PR (not a Firestore edit).

### Nudge Config
**No dedicated config doc.** The compliance nudge cooldown is hardcoded:
- `COOLDOWN_MS = 24 * 60 * 60 * 1000` in `src/components/manager/CompliancePanel.jsx:21`
- Nudge types: `compliance.filing.nudge` (filing nudge), `compliance.plan.nudge` (plan nudge)
- Changing the cooldown requires a code PR.

### Company Config (Firestore)
⚠ OPERATOR: After ADC credentials are available, run:
```
node scripts/census-tatillife-south.cjs
```
The census output will confirm whether `config/companyMinimums` has any stored overrides or is using all defaults.

---

## §5 Firestore Region + Backup (Priority 1E)

### Region
⚠ OPERATOR: Firestore region was not specified in `firebase.json` or `functions/index.js`. Confirm in Firebase Console:
> Firebase Console → agencytrack-2a610 → Firestore Database → top bar shows region

Typical Firebase default for Trinidad-targeted apps: `us-central1` (nam5 multi-region). If region is `asia-*` or `europe-*`, data residency should be discussed with Tatil's legal/IT team before the demo.

### Backup command (draft — run before morning provisioning)
```bash
# Replace TIMESTAMP with actual date, e.g. 20260607
gcloud firestore export gs://agencytrack-2a610.appspot.com/backups/pre-pilot-TIMESTAMP \
  --project=agencytrack-2a610

# Verify export completed:
gcloud firestore operations list --project=agencytrack-2a610
```

⚠ OPERATOR: Confirm the GCS bucket `agencytrack-2a610.appspot.com` exists and you have write access before running. The export is async — `operations list` shows completion status.

---

## §6 Gap Register (Priority 1F)

### GAP-1: Kiosk — no privacy notice
**Surface:** `src/components/manager/KioskDisplay.jsx` (or similar kiosk component)  
**Severity:** HIGH for pilot. The kiosk is a shared/public display showing agent rankings. No privacy notice or consent mechanism exists.  
**Status:** Not yet implemented — no privacy/consent code anywhere in `src/`.  
**⚠ OPERATOR:** Is the kiosk screen to be used in the demo? If yes, a first-login or kiosk-display privacy notice is required before showing agent names/performance data publicly. See GAP-3 for draft DPA notice text.

### GAP-2: DPA / first-login privacy notice absent
**Severity:** MEDIUM-HIGH for pilot. No data protection agreement or privacy notice is shown to new users on first login. Agents submit personal production data; Tatil likely has legal obligations under Trinidad's Data Protection Act.  
**Draft first-login privacy notice text (for legal review):**

> *AgencyTrack collects and stores your weekly sales activity reports, production metrics, and persistency data for the purpose of performance tracking and management reporting at Tatil Life. Your data is accessible to your unit manager, branch manager, and company administrators. Data is stored securely in Google Firestore (region: see §5). By continuing to use this application, you acknowledge that your production data will be used for performance review purposes. For questions, contact your manager or Tatil Life HR.*

⚠ OPERATOR: This text is a DRAFT for legal review — not legally vetted. Tatil's legal/compliance team must approve before using with real agents.

### GAP-3: Reconciliation view absent in agent dashboard
**Surface:** AgentDashboard — no policy reconciliation tab visible to agents. Branch managers have `nav-policy-reconciliation` (Policy Reconciliation tab) but agents cannot see their own reconciliation state.  
**Severity:** LOW for pilot — agents don't need to see this for week-1 usage. Monitor for confusion if agents ask "why does my submitted report show a discrepancy."

### GAP-4: Documented flakes (test suite)
- **CompliancePanel.nudge** — TIMING-RACE flake being stabilized in `fix/nudge-flake-stabilization`. Final matrix pending. No production impact.
- **Any other flakes:** Run `npx vitest run --reporter=verbose 2>&1 | Select-String "flak\|FAIL\|timeout"` to confirm suite is clean before pilot.

### GAP-5: DOB field — confirmed ABSENT ✓
The directive requested verification that `dateOfBirth` / `dob` is absent from the profile schema and update allowlist.

**Finding:** DOB field does NOT exist in:
- `src/services/userService.js` `MANAGER_EDITABLE_FIELDS` (verified: allowlist contains name, phone, bio, unitId, unitName, agentNumber, contractStartDate, canConfirmSettlements, licenseStatus, cbttExamPassedDate, cbttExtensionGranted)
- `firestore.rules` manager update allowlist
- Any `src/` or `functions/` file (zero matches excluding test files)

**FU bank:** DOB field + kiosk birthdays — queued post-freeze XS brief (rules allowlist + userService + EditUserDrawer, PR #299 pattern). Kiosk birthday display pairs with privacy controls + consent mechanism. Add to `docs/FOLLOW_UPS.md` after pilot freeze lifts.

### GAP-6: No week-1 activity seed for demo
Agents provisioned with blank `contractStartDate` will see empty dashboards on Day 1. The demo may feel "empty" without submitted data. ⚠ OPERATOR: Decide whether Kyron submits the first canary WAR before the full-team demo, or whether the demo focuses on the manager/admin setup flow rather than agent dashboards.

---

## §7 Morning Runbook — ≤2h Target (Priority 1G)

Estimated time: ~90 min following this order. Each step has a verification before the next.

### T+0: Pre-flight (10 min)

```powershell
# 1. Confirm on main and up to date
git checkout main && git fetch origin && git pull origin main

# 2. Verify environment
node -e "require('dotenv').config(); console.log({GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS, SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY})"
```

⚠ OPERATOR: If `GOOGLE_APPLICATION_CREDENTIALS: false`, run `gcloud auth application-default login` before Steps 1–2. Census and cleanup require ADC.

### T+10: Backup (5 min)

```bash
gcloud firestore export gs://agencytrack-2a610.appspot.com/backups/pre-pilot-$(date +%Y%m%d) \
  --project=agencytrack-2a610

# Confirm export started (async — check status in 2 min):
gcloud firestore operations list --project=agencytrack-2a610 --filter="done=false"
```

Verification: export operation appears in output. Do NOT wait for it to complete — it runs async. Proceed.

### T+15: Census + Cleanup (15 min)

```bash
# Step 1: See what's there
node scripts/census-tatillife-south.cjs 2>&1 | Tee-Object census-output.txt

# Step 2: Review census-output.txt carefully
# Confirm: only test/smoke accounts listed under "CLEANUP SUMMARY"
# Confirm: no real Tatil agent names appear

# Step 3: Dry-run cleanup
node scripts/cleanup-tatillife-south.cjs

# Step 4: OPERATOR authorizes — then execute
node scripts/cleanup-tatillife-south.cjs --execute
```

Verification: re-run census → test UIDs should return 0 results. ⚠ OPERATOR: If any real account appears in test list, abort cleanup, adjust `TEST_PATTERNS` in `cleanup-tatillife-south.cjs`, re-dry-run.

**Rollback:** Firebase Console → Firestore → Import → select the backup from T+10. For Auth deletions, re-run provisioning.

### T+30: Check gating PRs (5 min)

```bash
gh pr list --json number,title,headRefName,state
```

Merge any PRs that must land before provisioning. Per freeze rules: only PRs already reviewed and holding may be merged now. No new merges without dispatcher review.

**Currently open PRs as of this runbook:**
- PR #398 (`redesign/production-ranking-hook`) — Track J hook, HOLD OPEN (needed for redesign slices, not provisioning)
- PR [#540](https://github.com/Kelsean868/agencytrack/pull/540) (`docs/pilot-readiness-runbook`) — this runbook, HOLD
- PR [#541](https://github.com/Kelsean868/agencytrack/pull/541) (`docs/coming-soon-gating-brief`) — coming-soon gating brief, HOLD
- PR [#542](https://github.com/Kelsean868/agencytrack/pull/542) (`feat/coming-soon-gating`) — coming-soon gating impl, HOLD
- PR **TBD** (`fix/nudge-flake-stabilization`) — test-only flake fix; number assigned after matrix gates pass or cliff executes

### T+35: Create Branches + Units (10 min)

Sign in as `kyronmarchan+tenant@gmail.com` (tenant_admin) → agencytrack.vercel.app

1. **Branches tab → New Branch:** "Cyril Murray Branch"
2. **Branches tab → New Branch:** "Kendell Lowhar Branch"

Verification: both branches in list.

3. **Cyril Murray Branch → New Unit:** "Phoenix Unit" — ⚠ manager assignment per §3 audit
4. **Cyril Murray Branch → New Unit:** "Juniors Unit" — manager: Mary-Ann Mc Donald (assign after account created)
5. **Kendell Lowhar Branch → New Unit:** "Letitia's Unit" — manager: Letitia Lee-Ramcharan (assign after account created)
6. **Kendell Lowhar Branch → New Unit:** "Damian's Unit" — manager: Damian Cuffy (assign after account created)

### T+45: CANARY provisioning + email verification (10 min)

1. All Users tab → New User
   - Name: Kyron Marchan | Email: kyron.marchan@tatil.co.tt | Role: agent | Branch: Cyril Murray Branch | Unit: Phoenix Unit

2. Check `kyron.marchan@tatil.co.tt` inbox — invite should arrive within 3–5 min.

**If invite NOT delivered in 5 min:** ⚠ HALT. Check `firebase functions:log` for `doCreateUser` errors. Do NOT proceed with bulk provisioning.

3. Accept invite via the email link — confirm agent dashboard loads for Kyron Marchan.

### T+55: Bulk provisioning (20 min)

Follow §3 Steps 4–8 exactly. Each role tier in order: tenant_admin → branch_manager → unit_managers → agents (Phoenix) → agents (Juniors).

For each new user:
- Verify invite email delivered (check that no function errors appear in Firebase Console)
- Do NOT wait for each agent to accept — just confirm email delivered

### T+75: Config verification (5 min)

Sign in as tenant_admin → Company Config:
- Confirm weeklyActivityFloors match values in §4 (or update if Sales_Career.pdf differs)
- Note any stored overrides vs defaults

### T+80: Post-provisioning scoping smoke (10 min)

Four quick sign-in checks per §3 "visibility scoping checks":
1. Mary-Ann Mc Donald → Juniors Unit only (4 agents)
2. Cyril Murray → all 9 Cyril Murray Branch agents
3. Letitia Lee-Ramcharan → empty unit (legitimate)
4. Damian Cuffy → empty unit (legitimate)

⚠ OPERATOR judgment call: if any scoping fails, document here and defer demo until resolved.

### T+90: Final prod smoke (5 min)

```bash
node scripts/pilot-prod-smoke.mjs
```

Expected: 62/62 PASS. Any new failures → document before demo.

**If smoke fails:** OPERATOR decision — demo or delay. Known safe path: any nav-surface failure that was passing earlier indicates a deployment issue, check Vercel deployment status.

---

## §8 Appendix — Rollback Reference

**Full data rollback:**
```bash
# Import the T+10 backup (replaces ALL Firestore data)
gcloud firestore import gs://agencytrack-2a610.appspot.com/backups/pre-pilot-TIMESTAMP \
  --project=agencytrack-2a610
```
⚠ OPERATOR: Import is destructive — it replaces current data. Only use if provisioning created bad state and census cleanup is insufficient.

**Firebase Auth rollback:** No bulk-rollback tool. Must re-create accounts individually or use a custom Admin SDK script listing and deleting by creation timestamp.

**Revert a bad code merge:**
```bash
# Find squash SHA of bad merge
git log origin/main --oneline -5

# Create revert commit on main (requires direct-to-main auth)
git revert <bad-squash-sha>
git push origin main
```
Per CLAUDE.md: only authorized for GREEN-CHANNEL auto-merge failures with auto-revert flag. Manual merges → dispatcher decision.

---

*Runbook generated: 2026-06-07. Operator: Kyron Marchan. Review before executing any destructive step.*
