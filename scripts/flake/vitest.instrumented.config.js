/**
 * vitest.instrumented.config.js — runs the suite with the keydown instrumentation
 * setup file APPENDED to the normal setup chain.
 *
 * It exists so the flake-race Phase 0 instrumentation can observe a failing run
 * without editing either the test file or the component under test — the whole
 * point of the exercise is that the observed run is the SAME run.
 *
 * Everything else (jsdom, the firebase stub plugin, src/test-setup.js, env) is
 * inherited from the repo config unchanged. Not referenced by vite.config.js, so
 * CI never loads it.
 *
 * Usage:
 *   $env:FLAKE_INSTRUMENT='1'
 *   npx vitest run --config scripts/flake/vitest.instrumented.config.js <file>
 */

import base from '../../vite.config.js';

const test = { ...(base.test || {}) };
test.setupFiles = [...(test.setupFiles || []), './scripts/flake/instrument-keydown-setup.js'];

export default { ...base, test };
