# Smoke Script Discipline Runbook

Establishes the two canonical patterns for verification scripts in `scripts/verification/`.
Every script that writes to Firestore (emulator or production) must follow one of these patterns.

---

## Pattern A — Emulator-based data scripts

Reference implementation: [`h3-parity-test.mjs`](../../scripts/verification/h3-parity-test.mjs)

### Requirements

| Requirement | Detail |
|---|---|
| `RUN_ID` sentinel | `const RUN_ID = \`<prefix>_${Date.now()}\`` at top of script |
| Tag every created doc | Every seeded doc carries `{ <prefix>TestRunId: RUN_ID }` (or similar named field) |
| `cleanup()` in `finally{}` | Must always execute; query by `RUN_ID` field and batch-delete |
| Zero-verify after delete | Re-query by `RUN_ID` and `throw` if any docs remain |
| Exit code on failure | `process.exitCode = 1` if cleanup throws |

### Skeleton

```javascript
const RUN_ID = `myprefix_${Date.now()}`;

async function cleanup() {
  const snap = await db.collection('...').where('myRunId', '==', RUN_ID).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  const check = await db.collection('...').where('myRunId', '==', RUN_ID).get();
  if (check.size > 0) throw new Error(`Cleanup incomplete: ${check.size} docs remain`);
}

let runPassed = false;
try {
  runPassed = await main();
} finally {
  try {
    await cleanup();
  } catch (err) {
    console.error('Cleanup FAILED:', err.message);
    process.exitCode = 1;
  }
}
if (!runPassed) process.exitCode = 1;
```

---

## Pattern B — Production Playwright UI smokes

Reference implementation: [`p9-sm-target-smoke.mjs`](../../scripts/verification/p9-sm-target-smoke.mjs)

Production smokes can't tag docs with a runId via the UI path. The pattern is:
**snapshot-before → test → REST-restore in `finally{}`**.

### Requirements

| Requirement | Detail |
|---|---|
| `SMOKE_RUN_ID` constant | Printed at start for log tracing; included in any cleanup failure message |
| Pre-test snapshot | REST GET of every doc the test will mutate, before the first write |
| Track created docs | Any doc created (not modified) during the test has a known path; attempt DELETE in cleanup |
| Cleanup in `finally{}` | REST PATCH / DELETE — not UI interaction, which can silently fail |
| Verify after restore | REST GET confirms restored values match pre-test snapshot |
| Set `process.exitCode = 1` on failure | Cleanup failure is a test failure; include `SMOKE_RUN_ID` in the warning message for manual sweep |

### `firestoreGetDoc` / `firestoreDeleteDoc` helpers

Add alongside the existing `firestorePatch` helper in any smoke that needs them:

```javascript
async function firestoreGetDoc(idToken, docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${docPath} failed: ${res.status}`);
  return res.json();
}

async function firestoreDeleteDoc(idToken, docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } });
  return res.status; // 200 = deleted, 404 = already gone, either is acceptable
}
```

### Cleanup function skeleton

```javascript
async function cleanupSmoke(idToken, origDocSnapshot, docPath, extraFieldsToRemove = [], SMOKE_RUN_ID) {
  let ok = true;
  try {
    if (origDocSnapshot === null) {
      // Doc was created by the test — delete it entirely
      const st = await firestoreDeleteDoc(idToken, docPath);
      safeLog(`  Cleanup DELETE ${docPath}: HTTP ${st}`);
    } else {
      // Doc was modified — restore original fields and remove any smoke-added fields
      // Use updateMask to remove extra fields by including them in the mask but not in the body
      const maskParams = [
        ...Object.keys(origDocSnapshot.fields),
        ...extraFieldsToRemove,
      ].map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?${maskParams}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ fields: origDocSnapshot.fields }),
      });
      safeLog(`  Cleanup PATCH ${docPath}: HTTP ${res.status}`);
      if (res.status !== 200) throw new Error(`PATCH failed: HTTP ${res.status}`);

      // Verify
      const afterSnap = await firestoreGetDoc(idToken, docPath);
      for (const field of extraFieldsToRemove) {
        if (afterSnap?.fields?.[field]) {
          throw new Error(`Field "${field}" still present after cleanup`);
        }
      }
      safeLog(`  Cleanup verify: ✓`);
    }
  } catch (e) {
    ok = false;
    safeLog(`  Cleanup FAILED: ${e.message}  SMOKE_RUN_ID=${SMOKE_RUN_ID} — restore manually`);
  }
  return ok;
}
```

### Structural pattern

```javascript
async function main() {
  const SMOKE_RUN_ID = `mysmoke_${Date.now()}`;
  safeLog(`SMOKE_RUN_ID: ${SMOKE_RUN_ID}`);

  const idToken = await getIdToken(email, password);
  const origDoc = await firestoreGetDoc(idToken, docPath).catch(() => null);

  const browser = await _chromium.launch({ headless: true });
  let ctx;

  try {
    ctx = await browser.newContext(...);
    // ... test legs ...
  } finally {
    const cleanOk = await cleanupSmoke(idToken, origDoc, docPath, ['extraField'], SMOKE_RUN_ID);
    if (!cleanOk) process.exitCode = 1;
    await ctx?.close().catch(() => {});
    await browser.close();
  }

  safeLog(summaryLine);
  if (failed > 0 || process.exitCode === 1) process.exit(1);
}
```

---

## Checklist for new smoke scripts

- [ ] `SMOKE_RUN_ID` or `RUN_ID` constant defined at top of scope
- [ ] Every doc written during the test is covered by cleanup (created → delete; modified → restore)
- [ ] Cleanup runs in `finally{}`, not in the `try` body (a mid-test throw must not skip cleanup)
- [ ] Cleanup verifies zero docs remain (emulator) or original values restored (production)
- [ ] Cleanup failure sets `process.exitCode = 1` and logs the runId for manual identification
- [ ] No bare `catch(e) => console.warn(...)` in cleanup — failures must be surfaced as exit code changes

---

## Scripts conformance status

| Script | Type | Status | Notes |
|---|---|---|---|
| `h3-parity-test.mjs` | Emulator | ✅ Conforms | Gold standard Pattern A |
| `p9-sm-target-smoke.mjs` | Production UI | ✅ Conforms | Retrofitted — REST restore in `finally{}` |
| `h3-awards-settlements-path-smoke.mjs` | Production UI | ⚠️ Not audited | Audit on next touch |
| `h3-prod-smoke.mjs` | Production UI | ⚠️ Not audited | Audit on next touch |
| `h3-flip-capstone.mjs` | Production UI | ⚠️ Not audited | Audit on next touch |
| `h3-tz-fix-smoke.mjs` | Emulator/data | ⚠️ Not audited | Audit on next touch |
| `h3-tt-tz-probe.mjs` | Emulator/data | ⚠️ Not audited | Audit on next touch |
