# scripts/cleanup — Test-data sweep utilities

## Purpose

`scripts/cleanup/**` contains two scripts for managing test data in the
multi-tenant Firestore. Both gate on `CLEANUP_ALLOWED_TENANTS` and exit 1 if
it does not include the target tenant. `wipe-test-data-sweep.mjs` performs the
destructive cascade (dry-run by default; `--execute` to delete).
`preview-test-data-sweep.mjs` is DRY-RUN only — enumerates would-be deletions
without modifying anything; use it before running the wipe.

## Environment requirements

Both scripts require:

```
CLEANUP_ALLOWED_TENANTS=tatillife_south
```

Comma-separated tenant ID allowlist. The script aborts (exit 1) when the env
var is unset or does not include the target tenant (`TENANT_ID` imported from
`scripts/seed/test-roster.mjs`):

```
ABORT: CLEANUP_ALLOWED_TENANTS is not set or does not include "tatillife_south".
```

PowerShell example:

```powershell
$env:CLEANUP_ALLOWED_TENANTS = "tatillife_south"
node scripts/cleanup/preview-test-data-sweep.mjs --mode=email-pattern
```

## Consumers

Direct invocation: `wipe-test-data-sweep.mjs` and `preview-test-data-sweep.mjs`.
The allowlist is also set programmatically by orchestrators that spawn these
scripts as children: `scripts/verification/pr-f-bulk-test-data-smoke.mjs` and
the shakedown harness under `scripts/verification/shakedown/**`.

## See also

See [`docs/runbooks/test-data-lifecycle.md`](../../docs/runbooks/test-data-lifecycle.md)
for the full operator runbook and lifecycle.
