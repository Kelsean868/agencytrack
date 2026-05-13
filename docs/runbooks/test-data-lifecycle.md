# Test Data Lifecycle Runbook

Pre-Tatil-pilot end-to-end system shake-down. Creates 10 test users (1 BM + 2
UMs + 7 agents), realistic submissions/persistency/campaign data, then wipes
everything cleanly before the real Tatil roster lands.

**Scope:** tenant `tatillife_south` only.
**Duration:** ~15 minutes to seed, exercise, and wipe.

---

## Pre-flight

### 1. Service account key

The Admin SDK scripts require a service account key at
`functions/service-account-key.json`. This file is gitignored and must be
present on the machine running the scripts. Contact the project owner if you
need a copy.

### 2. Tenant allow-list (required for cleanup scripts)

```powershell
$env:CLEANUP_ALLOWED_TENANTS = "tatillife_south"
```

This must be set in every shell session before running any cleanup script. The
wipe script will abort immediately if the env var is unset or does not include
the target tenant.

### 3. Verify clean slate

Before seeding, confirm no leftover test users from a previous run:

```powershell
node scripts/cleanup/preview-test-data-sweep.mjs --mode=email-pattern
```

If the preview shows any `*@agencytrack.test` users, wipe them first (see
Step 7) before continuing.

---

## Step 1 — Generate CSVs and capture the batch ID

```powershell
node scripts/seed/generate-users-csv.mjs
node scripts/seed/generate-goals-csv.mjs
```

Both scripts print a line like:

```
BATCH_ID=550e8400-e29b-41d4-a716-446655440000
```

**Copy the batch ID printed by `generate-users-csv.mjs`.** You will pass this
same ID to every subsequent seeder script so all docs in the session share one
batch ID. If you run both generators, both should print the same ID (they accept
`--batch-id` to fix it; without the flag, each generates a fresh UUID).

To fix a shared batch ID across both generators:

```powershell
$BATCH_ID = [guid]::NewGuid().ToString()
node scripts/seed/generate-users-csv.mjs  --batch-id $BATCH_ID
node scripts/seed/generate-goals-csv.mjs --batch-id $BATCH_ID
```

Default output paths:
- `verification/test-users.csv`
- `verification/test-goals.csv`

---

## Step 2 — Import users via the Bulk Import Users modal

1. Log in to the app as `kyron@tatillife.com` (tenant admin).
2. Go to **User Management** → **Bulk import users**.
3. Upload `verification/test-users.csv`.
4. Review the preview — expect 10 rows: 1 BM, 2 UMs, 7 agents.
5. Click **Import**. All 10 users should be created with a temporary password
   printed in the modal summary.

> **Unit IDs:** The generated CSV leaves agent `unitId` blank because UM UIDs
> are assigned by Firebase at creation time and are not known before import.
> After UMs are created (they will appear in the users list), edit each
> agent's profile to assign them to their UM's unit — or accept blank `unitId`
> for the shake-down test.

---

## Step 3 — Import goals via the Bulk Import Goals modal

1. Still in **User Management**, click **Bulk import 2026 personal commitments**.
2. Upload `verification/test-goals.csv`.
3. Review — expect 7 rows (one per agent).
4. Click **Import**.

---

## Step 4 — Run direct seeders

Pass the same batch ID you captured in Step 1.

```powershell
node scripts/seed/seed-test-submissions.mjs  --batch-id $BATCH_ID --apply
node scripts/seed/seed-test-persistency.mjs --batch-id $BATCH_ID --apply
node scripts/seed/seed-test-campaign.mjs     --batch-id $BATCH_ID --apply
```

Expected writes:
| Script | Docs |
|--------|------|
| `seed-test-submissions.mjs` | 28 weekly submissions (4 weeks × 7 agents) |
| `seed-test-persistency.mjs` | 21 persistency records (Jan/Feb/Mar 2026 × 7 agents) |
| `seed-test-campaign.mjs` | 1 campaign + 7 notification docs |

Each script logs every doc path written and exits 0 on success.

---

## Step 5 — Exercise the app end-to-end

Log in as each role and verify the key surfaces:

| Role | Login | What to verify |
|------|-------|----------------|
| Agent (any) | `agent-001@agencytrack.test` | Dashboard KPIs, submission history (4 weeks), campaign card, goals gap analysis |
| Branch Manager | `bm-001@agencytrack.test` | Master sheet (7 agents), persistency panel (3 months each), campaign panel |
| Unit Manager | `um-001@agencytrack.test` | Unit view (agents 001–004), weekly submissions |

Passwords were set during the Bulk Import (or `TestSeed!2026` if imported via
the smoke script's Admin SDK path).

Recommended checks:
- [ ] Agent dashboard shows API and apps totals for the 4 seeded weeks
- [ ] Leaderboard renders without errors
- [ ] Campaign "Test Campaign Q2" appears for all 7 agents
- [ ] Persistency panel (manager view) shows Jan/Feb/Mar 2026 data for each agent
- [ ] Goals gap analysis shows 2026 targets vs. YTD production
- [ ] Dark mode toggle does not break any seeded data display

---

## Step 6 — Preview cleanup

Before deleting anything, confirm exactly what will be removed:

```powershell
node scripts/cleanup/preview-test-data-sweep.mjs --mode=email-pattern
```

Review the printed list. Every path should belong to a `*@agencytrack.test`
user. The summary at the end shows:
- **Auth users** — should be 10
- **Firestore paths** — should be ≥84 (users + submissions + persistency + goals
  + notifications + campaign + auditAdminCreations)

The preview writes a log to `verification/cleanup-preview-<timestamp>.log`.

> **Cleanup mode selection:**
> `--mode=batch` is only valid after the smoke script path (where ALL docs are
> written via Admin SDK and stamped with `testDataBatchId`). After the manual
> runbook import steps (Steps 2–3 above), the user and goals docs carry
> `csvImportBatchId`, not `testDataBatchId` — batch mode will miss them. **Always
> use `--mode=email-pattern` for cleanup after a manual import.**

---

## Step 7 — Wipe cleanup

```powershell
node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute
```

The script will:
1. Print the list of users and Firestore paths to delete.
2. Show a **typed confirmation prompt**:
   ```
   Type exactly:
     DELETE 10 USERS AT 2026-05-13T12:34:56Z
   ```
3. Type the phrase verbatim and press Enter (you have 60 seconds).
4. Revoke Auth sessions → delete Firestore docs → delete Auth users.
5. Print a summary and write a full audit log to
   `verification/cleanup-<timestamp>.log`.

After the wipe, verify nothing remains:

```powershell
node scripts/cleanup/preview-test-data-sweep.mjs --mode=email-pattern
```

Both "Auth users" and "Firestore paths" totals should be 0.

---

## Step 8 — Pilot handover

Once the wipe confirms zero test data:

1. Delete the generated CSVs from `verification/` (they are gitignored).
2. The real Tatil agent roster import can begin via the normal Bulk Import Users
   workflow.
3. Unset the cleanup env var:
   ```powershell
   Remove-Item Env:CLEANUP_ALLOWED_TENANTS
   ```

---

## Automated smoke test (optional)

The smoke script runs all 7 steps programmatically against the real Firebase
project and asserts guard violations and cleanup completeness:

```powershell
$env:CLEANUP_ALLOWED_TENANTS = "tatillife_south"
node scripts/verification/pr-f-bulk-test-data-smoke.mjs
```

The smoke seeds users via Admin SDK (bypasses the modal), exercises all safety
guards, runs a full wipe with correct typed confirmation, and asserts zero docs
remain. Output is logged to `verification/pr-f-smoke-<timestamp>.log`.

Run the smoke after merging PR-F to confirm everything works before the manual
runbook steps are needed.

---

## Troubleshooting

**`ERROR: service account key not found`**
The service account key file must be at `functions/service-account-key.json`.
It is gitignored — copy it from a secure location.

**`ABORT: CLEANUP_ALLOWED_TENANTS is not set`**
Run `$env:CLEANUP_ALLOWED_TENANTS = "tatillife_south"` in the current shell.

**`ERROR: N test agent(s) not found in Firestore`**
The seeder scripts resolve UIDs by looking up emails in the Firestore users
collection. Complete Steps 2–3 (import users and goals) before running the
seeders in Step 4.

**Smoke script fails mid-run (partial data created)**
Run the wipe manually to clean up:
```powershell
node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute
```
