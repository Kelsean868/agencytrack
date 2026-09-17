import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  MIRRORED_FILES,
  SRC_DIR,
  MIRROR_DIR,
  MIRROR_PACKAGE_JSON,
} from '../../../../scripts/build/sync-portfolio-import.mjs';

/**
 * The mirror-drift gate.
 *
 * `firebase deploy --only functions` ships ONLY the `functions/` directory, so the
 * Cloud Functions run their own copy of the parser. Two copies of the logic that
 * decides whether a policy is `lapsed` is exactly the arrangement that produces a
 * wrong persistency figure with nothing erroring — the same shape as the
 * `computePoints.js` twins already in this repo, which have drifted.
 *
 * This test is the thing that makes the copy safe: it is a byte comparison, so it
 * cannot be subtly satisfied by a copy that merely "looks the same". When it
 * fails, the fix is one command:
 *
 *     npm run sync:portfolio-import
 */
describe('functions/ portfolioImport mirror', () => {
  it('mirrors every file in the closed import graph', () => {
    // If a new module joins the graph and is not listed here, the CF resolves it
    // from a path that does not exist inside the deploy bundle and every import
    // fails at runtime — after deploy, not in CI. Keep this list honest.
    expect(MIRRORED_FILES).toEqual([
      'oipaImportConfig.js',
      'parseOipaExport.js',
      'buildImportPlan.js',
    ]);
  });

  it.each(MIRRORED_FILES)('%s is byte-identical to the src original', (name) => {
    const src = join(SRC_DIR, name);
    const mirror = join(MIRROR_DIR, name);
    expect(existsSync(mirror), `${name} missing — run: npm run sync:portfolio-import`).toBe(true);
    expect(
      readFileSync(mirror).equals(readFileSync(src)),
      `${name} has drifted — run: npm run sync:portfolio-import`,
    ).toBe(true);
  });

  it('the mirror directory is marked ESM', () => {
    // Without `"type": "module"` Node parses these as CommonJS inside the
    // functions package and every `export` in them is a syntax error at runtime.
    const onDisk = readFileSync(join(MIRROR_DIR, 'package.json'), 'utf8');
    expect(onDisk).toBe(MIRROR_PACKAGE_JSON);
    expect(JSON.parse(onDisk).type).toBe('module');
  });

  it('the src modules import nothing outside the mirrored set', () => {
    // A relative import to a file OUTSIDE this directory would resolve in the app
    // build and fail only inside the deployed function. Catch it here.
    const allowed = new Set(MIRRORED_FILES.map((n) => `./${n}`));
    for (const name of MIRRORED_FILES) {
      const body = readFileSync(join(SRC_DIR, name), 'utf8');
      const specifiers = [...body.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      for (const spec of specifiers) {
        expect(allowed.has(spec), `${name} imports ${spec}, which is not mirrored`).toBe(true);
      }
    }
  });
});
