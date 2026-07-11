import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ESM source of truth for the feature-flag allowlist.
import { ALLOWED_FLAG_KEYS } from '../configService.js';

/**
 * Triple-copy drift guard for the feature-flag allowlist (Run 5 Item 5).
 *
 * The allowlist of togglable feature-flag keys is duplicated in THREE places
 * that cannot share an import:
 *   1. src/services/configService.js       — `ALLOWED_FLAG_KEYS` (ESM, app source)
 *   2. firestore.rules                      — `ccfgFlagKeysAllowed()` literal
 *      (Firestore rules is its own language; it cannot import JS)
 *   3. scripts/verification/vh/flag-toggle.cjs — `ALLOWED_FLAGS` Set (CJS smoke
 *      helper; a CJS require of an ESM module is intentionally avoided here)
 * This test fails if any copy drifts from the ESM source of truth.
 */

const EXPECTED = ['awardsProvenance', 'persistencyV2', 'policyLedgerCampaignLens']; // sorted

const HERE = dirname(fileURLToPath(import.meta.url)); // src/services/__tests__
const REPO_ROOT = resolve(HERE, '../../..');
const rulesText = readFileSync(resolve(REPO_ROOT, 'firestore.rules'), 'utf8');
const cjsText = readFileSync(resolve(REPO_ROOT, 'scripts/verification/vh/flag-toggle.cjs'), 'utf8');

/** Extract the string-literal keys from a JS/rules array-literal source fragment. */
function parseKeys(arrayInner) {
  return (arrayInner.match(/['"]([^'"]+)['"]/g) ?? [])
    .map((s) => s.replace(/['"]/g, ''))
    .sort();
}

describe('feature-flag allowlist — triple-copy drift guard', () => {
  it('ESM ALLOWED_FLAG_KEYS is the expected set', () => {
    expect([...ALLOWED_FLAG_KEYS].sort()).toEqual(EXPECTED);
  });

  it('firestore.rules ccfgFlagKeysAllowed() literal matches the ESM set exactly', () => {
    const m = rulesText.match(/ccfgFlagKeysAllowed\(\)\s*\{[\s\S]*?let allowed = \[([^\]]*)\]/);
    expect(m, 'ccfgFlagKeysAllowed() allowlist literal not found in firestore.rules').toBeTruthy();
    const rulesKeys = parseKeys(m[1]);
    expect(rulesKeys).toEqual([...ALLOWED_FLAG_KEYS].sort());
    // And every ESM key is present in the rules allowlist.
    for (const k of ALLOWED_FLAG_KEYS) expect(rulesKeys).toContain(k);
  });

  it('flag-toggle.cjs ALLOWED_FLAGS matches the ESM set exactly', () => {
    const m = cjsText.match(/ALLOWED_FLAGS\s*=\s*new Set\(\[([^\]]*)\]/);
    expect(m, 'ALLOWED_FLAGS Set literal not found in flag-toggle.cjs').toBeTruthy();
    const cjsKeys = parseKeys(m[1]);
    expect(cjsKeys).toEqual([...ALLOWED_FLAG_KEYS].sort());
    for (const k of ALLOWED_FLAG_KEYS) expect(cjsKeys).toContain(k);
  });
});
