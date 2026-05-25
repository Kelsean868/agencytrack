/**
 * smoke-runner.mjs — Reusable E2E smoke harness primitives.
 *
 * Complements walk-helpers.mjs (low-level Playwright helpers) with higher-level
 * smoke infrastructure: env loading, result tracking, auth, navigation, Firestore
 * REST queries, Admin SDK factory, and report generation.
 *
 * Import in any smoke script to avoid copy-pasting ~200 lines of boilerplate:
 *
 *   import {
 *     loadEnv, createRunTracker,
 *     loginAs, navigateAgentTab, navigateManagerTab,
 *     getIdToken, decodeJwt, firestoreGet, firestoreQuery,
 *     getAdmin, writeReport,
 *   } from './lib/smoke-runner.mjs';
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath }          from 'url';
import { createRequire }          from 'module';
import { safeLog, waitForFirebaseReady } from './walk-helpers.mjs';

const __dir   = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

// ── Env loading ───────────────────────────────────────────────────────────────

/**
 * loadEnv — reads .env.local from rootDir and returns a key→value map.
 * Rule 4 compliant: only ^[A-Z0-9_]+= lines are parsed; values are never logged.
 *
 * @param {string} rootDir - Absolute path to the directory containing .env.local
 * @returns {Record<string, string>}
 */
export function loadEnv(rootDir) {
  const raw = readFileSync(join(rootDir, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// ── Result tracker ────────────────────────────────────────────────────────────

/**
 * createRunTracker — creates a result accumulator for one smoke run.
 *
 * @param {{ ssDir: string }} options
 * @returns {{
 *   pass:       (step: string, note?: string) => void,
 *   fail:       (step: string, note?: string) => void,
 *   skip:       (step: string, note?: string) => void,
 *   ss:         (page: Page, name: string)    => Promise<void>,
 *   results:    Array<{ step: string, status: string, note: string }>,
 *   totalPass:  number,
 *   totalFail:  number,
 *   totalSkip:  number,
 * }}
 */
export function createRunTracker({ ssDir }) {
  const results = [];
  let _pass = 0, _fail = 0, _skip = 0;

  function pass(step, note = '') {
    results.push({ step, status: 'PASS', note });
    _pass++;
    safeLog(`  ✓ ${step}`, note || undefined);
  }
  function fail(step, note = '') {
    results.push({ step, status: 'FAIL', note });
    _fail++;
    safeLog(`  ✗ ${step}`, note || undefined);
  }
  function skip(step, note = '') {
    results.push({ step, status: 'SKIP', note });
    _skip++;
    safeLog(`  ~ ${step}`, note || undefined);
  }
  async function ss(page, name) {
    try { await page.screenshot({ path: join(ssDir, `${name}.png`) }); } catch (_) {}
  }

  return {
    pass, fail, skip, ss,
    results,
    get totalPass() { return _pass; },
    get totalFail() { return _fail; },
    get totalSkip() { return _skip; },
  };
}

// ── Navigation helpers ────────────────────────────────────────────────────────

/**
 * loginAs — navigates to targetUrl, fills email + password, submits, and waits
 * for Firebase auth to resolve.
 *
 * @param {import('playwright').Page} page
 * @param {string} email
 * @param {string} password
 * @param {string} targetUrl
 */
export async function loginAs(page, email, password, targetUrl) {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1500);
}

/**
 * navigateAgentTab — clicks an agent nav tab by its data-testid, with mobile
 * More-drawer fallback and DOM-dispatch last resort.
 *
 * Banked: mobile bottom-nav "More" drawer pattern (CLAUDE.md banked patterns).
 *
 * @param {import('playwright').Page} page
 * @param {string} tabId - e.g. 'dashboard', 'policy-ledger', 'career'
 */
export async function navigateAgentTab(page, tabId) {
  const sel = `[data-testid="agent-tab-${tabId}"]`;
  await page.waitForTimeout(600);

  const loc = page.locator(sel);
  if (await loc.first().isVisible({ timeout: 4000 }).catch(() => false)) {
    await loc.first().click({ force: true });
    await page.waitForTimeout(800);
    return;
  }

  const moreBtn = page.getByRole('button', { name: /^more$/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    const drawerLoc = page.locator(sel);
    if (await drawerLoc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerLoc.first().click({ force: true });
      await page.waitForTimeout(800);
      return;
    }
  }

  const found = await page.evaluate((s) => !!document.querySelector(s), sel);
  if (!found) throw new Error(`agent-tab-${tabId} not found in DOM`);
  await page.evaluate((s) => {
    document.querySelector(s).dispatchEvent(new Event('click', { bubbles: true }));
  }, sel);
  await page.waitForTimeout(800);
}

/**
 * navigateManagerTab — clicks a manager nav tab by its data-testid, with mobile
 * More-drawer fallback.
 *
 * Note: 'persistency' uses data-testid="tab-persistency"; all other tabs use
 * data-testid="nav-{tabId}".
 *
 * @param {import('playwright').Page} page
 * @param {string} tabId - e.g. 'overview', 'policy-reconciliation', 'persistency'
 */
export async function navigateManagerTab(page, tabId) {
  const sel = tabId === 'persistency'
    ? '[data-testid="tab-persistency"]'
    : `[data-testid="nav-${tabId}"]`;
  await page.waitForTimeout(600);

  const loc = page.locator(sel);
  if (await loc.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await loc.first().click({ force: true });
    await page.waitForTimeout(800);
    return;
  }

  const moreBtn = page.getByRole('button', { name: /^more$/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    const drawerLoc = page.locator(sel);
    if (await drawerLoc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerLoc.first().click({ force: true });
      await page.waitForTimeout(800);
      return;
    }
  }

  throw new Error(`Manager tab nav-${tabId} not found`);
}

// ── Firestore REST helpers ────────────────────────────────────────────────────

/**
 * getIdToken — signs in via Firebase Identity Toolkit REST and returns an ID token.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} apiKey - VITE_FIREBASE_API_KEY
 * @returns {Promise<string>}
 */
export async function getIdToken(email, password, apiKey) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!resp.ok) throw new Error(`signIn failed: ${resp.status}`);
  const j = await resp.json();
  return j.idToken;
}

/**
 * decodeJwt — decodes the payload of a JWT without verifying the signature.
 *
 * @param {string} token
 * @returns {Record<string, unknown>}
 */
export function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(
    parts[1].length + (4 - parts[1].length % 4) % 4, '='
  );
  try { return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')); } catch { return {}; }
}

/**
 * firestoreGet — reads a single Firestore document via the REST API.
 *
 * @param {string} path    - Document path relative to /databases/(default)/documents/
 * @param {string} idToken
 * @param {string} project - Firebase project ID (e.g. 'agencytrack-2a610')
 * @returns {Promise<{ ok: boolean, status: number, body: object }>}
 */
export async function firestoreGet(path, idToken, project) {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  return { ok: resp.ok, status: resp.status, body: await resp.json() };
}

/**
 * firestoreQuery — runs a structured query via the Firestore REST API.
 *
 * @param {string} parent        - Parent path (e.g. 'tenants/tatillife_south')
 * @param {string} collectionId
 * @param {Array}  filters       - Array of fieldFilter objects
 * @param {string} idToken
 * @param {{ project: string, limit?: number }} options
 * @returns {Promise<Array>}     Matching documents (each has a .document property)
 */
export async function firestoreQuery(parent, collectionId, filters, idToken, { project, limit = 5 }) {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${parent}:runQuery`;
  const where = filters.length === 1
    ? { fieldFilter: filters[0] }
    : { compositeFilter: { op: 'AND', filters: filters.map(f => ({ fieldFilter: f })) } };
  const body = {
    structuredQuery: {
      from: [{ collectionId, allDescendants: false }],
      where,
      limit,
    }
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const docs = await resp.json();
  return Array.isArray(docs) ? docs.filter(d => d.document) : [];
}

// ── Admin SDK factory ─────────────────────────────────────────────────────────

let _cachedAdmin = null;

/**
 * getAdmin — initializes (or returns a cached) firebase-admin instance using a
 * service-account key file. Must be called from scripts at project root level;
 * resolves firebase-admin from functions/node_modules as per CLAUDE.md convention.
 *
 * @param {string} keyPath - Absolute path to service-account-key.json
 * @returns {import('firebase-admin')}
 */
export function getAdmin(keyPath) {
  if (_cachedAdmin) return _cachedAdmin;
  if (!existsSync(keyPath)) throw new Error(`service-account-key.json not found: ${keyPath}`);
  // firebase-admin is installed in functions/node_modules per CLAUDE.md convention.
  const admin = _require(resolve(__dir, '../../../functions/node_modules/firebase-admin'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(_require(keyPath)) });
  }
  _cachedAdmin = admin;
  return admin;
}

// ── Report generation ─────────────────────────────────────────────────────────

/**
 * writeReport — generates a Markdown smoke report and writes it to reportPath.
 *
 * @param {{
 *   reportPath:  string,
 *   title:       string,
 *   runTs:       string,
 *   results:     Array<{ step: string, status: string, note: string }>,
 *   totalPass:   number,
 *   totalFail:   number,
 *   totalSkip:   number,
 *   duration:    number,
 *   targetUrl:   string,
 *   runner?:     string,
 *   tags?:       Record<string, string>,
 *   surfaces?:   string[],
 *   ssDirPath?:  string,
 * }} options
 */
export function writeReport({
  reportPath, title, runTs,
  results, totalPass, totalFail, totalSkip,
  duration, targetUrl,
  runner = 'CC autonomous block',
  tags = {},
  surfaces = [],
  ssDirPath,
}) {
  const statusIcon = totalFail === 0 ? '✅' : '⚠️ REGRESSION DETECTED';

  const tagsSection = Object.keys(tags).length > 0
    ? `\n## Smoke Tags Seeded\n\n${Object.entries(tags).map(([k, v]) => `- ${k}: \`${v}\``).join('\n')}\n`
    : '';

  const ssSection = ssDirPath
    ? `\n## Screenshots\n\nSaved to: \`${ssDirPath}\`\n`
    : '';

  const surfacesSection = surfaces.length > 0
    ? `\n## Surfaces Covered\n\n${surfaces.map(s => `- ${s}`).join('\n')}\n`
    : '';

  const report = `# ${title} — ${runTs}

**Overall:** ${statusIcon} ${totalPass} PASS / ${totalFail} FAIL / ${totalSkip} SKIP
**Duration:** ${duration}s
**Target:** ${targetUrl}
**Runner:** ${runner}

## Results

| Step | Status | Note |
|------|--------|------|
${results.map(r => `| ${r.step} | ${r.status} | ${r.note || ''} |`).join('\n')}
${tagsSection}${ssSection}${surfacesSection}`;

  writeFileSync(reportPath, report, 'utf8');
  safeLog(`Report written to: ${reportPath}`);
}
