/**
 * WALK-3 induced-failure test — proves setupBypassSession's error path is
 * sanitized. Calls setupBypassSession with a nonexistent hostname; captures
 * the thrown Error.message; asserts it contains only the error name + code,
 * NOT the URL and NOT the token.
 *
 * The captured error message is written to verification/walk-3-induced-failure.txt
 * (gitignored) so the PR description can reference its content without
 * surfacing any token value.
 *
 * Run: node scripts/verification/walk-3-induced-failure-test.mjs
 *
 * Exit codes:
 *   0 — test passed (error message is properly sanitized)
 *   1 — test FAILED (token leaked OR unexpected behavior)
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession } from './lib/walk-helpers.mjs';

const OUT_DIR  = resolve(process.cwd(), 'verification');
const OUT_FILE = resolve(OUT_DIR, 'walk-3-induced-failure.txt');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Load env minimally to get the real token — we then assert it does NOT appear
// in the thrown error.
function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  const env = {};
  text.split('\n').forEach((line) => {
    const eq = line.indexOf('=');
    if (eq < 1) return;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[k] = v;
  });
  return env;
}

const env = loadEnv();
const TOKEN = env.VERCEL_BYPASS_TOKEN;
if (!TOKEN) {
  console.error('VERCEL_BYPASS_TOKEN not present in .env.local — cannot run induced-failure test');
  process.exit(1);
}

// NOTE: kickoff suggested `https://this-domain-does-not-exist-walk3-test.vercel.app`,
// but Vercel's `*.vercel.app` wildcard DNS catches that and returns a 404
// deployment-not-found page (no DNS failure, no thrown error). Use the
// RFC-6761-reserved `.invalid` TLD which is guaranteed to fail name resolution
// — that's the original M3-incident failure mode (ERR_NAME_NOT_RESOLVED).
const BAD_HOST = 'https://this-domain-does-not-exist-walk3-test.invalid';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

let capturedMessage = null;
let testStatus = 'unknown';

try {
  await setupBypassSession(context, BAD_HOST, TOKEN);
  testStatus = 'FAIL: setupBypassSession did NOT throw on a nonexistent host';
} catch (err) {
  capturedMessage = err.message;
  // Check: does the error message contain the token anywhere?
  if (typeof capturedMessage === 'string' && capturedMessage.includes(TOKEN)) {
    testStatus = 'FAIL: error message contains the bypass token';
  }
  // Check: does the error message contain the URL/query-param substring?
  else if (typeof capturedMessage === 'string' && /x-vercel-protection-bypass/i.test(capturedMessage)) {
    testStatus = 'FAIL: error message contains URL bypass-parameter substring';
  }
  // Check: does the error message contain the hostname (URL leak indicator)?
  else if (typeof capturedMessage === 'string' && /this-domain-does-not-exist-walk3-test|\.invalid/i.test(capturedMessage)) {
    testStatus = 'FAIL: error message contains the URL hostname';
  }
  else {
    testStatus = 'PASS: error message is sanitized (no token, no URL, no hostname)';
  }
} finally {
  await browser.close();
}

// Write the captured message to disk — this file is gitignored, so it's safe
// to record even though we have already asserted that no token/URL is present.
const report = [
  `WALK-3 induced-failure test result`,
  `Timestamp: ${new Date().toISOString()}`,
  `Status: ${testStatus}`,
  ``,
  `Captured error message:`,
  `  "${capturedMessage ?? '<no error thrown>'}"`,
  ``,
  `Assertions:`,
  `  - Contains token value:   ${typeof capturedMessage === 'string' && capturedMessage.includes(TOKEN)}`,
  `  - Contains URL param:     ${typeof capturedMessage === 'string' && /x-vercel-protection-bypass/i.test(capturedMessage)}`,
  `  - Contains hostname:      ${typeof capturedMessage === 'string' && /this-domain-does-not-exist-walk3-test|\.invalid/i.test(capturedMessage)}`,
  ``,
].join('\n');

writeFileSync(OUT_FILE, report);
console.log(report);
console.log(`Wrote: verification/walk-3-induced-failure.txt`);

if (testStatus.startsWith('PASS')) {
  process.exit(0);
} else {
  process.exit(1);
}
