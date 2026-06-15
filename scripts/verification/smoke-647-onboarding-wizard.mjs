/**
 * smoke-647-onboarding-wizard.mjs — pre-merge smoke for PR #647 (Slice B)
 *
 * Confirms the onboarding wizard shows for a clean agent account, identity
 * fields are written to Firestore under the live Slice-A hasOnly rule, resume
 * works after reload, and onboardingComplete gates the wizard out on "Enter
 * AgencyTrack". Runs both light and dark themes. Account is admin-reset before
 * and after each theme run so the smoke is re-runnable indefinitely.
 *
 * Legs (per theme):
 *   {theme}-wizard-shows    agent signs in → wizard renders (not AgentDashboard)
 *   {theme}-identity-save   fill agentNumber + DOB → Save → Completion screen
 *   {theme}-persist-reload  hard reload → wizard resumes at Completion (data signal)
 *   {theme}-fields-written  admin read: agentNumber + dateOfBirth correct, onboardingComplete absent
 *   {theme}-enter-app       "Enter AgencyTrack" → wizard detaches
 *   {theme}-complete-flag   admin read: onboardingComplete === true
 *
 * Account: A11Y_AGENT_EMAIL — admin-reset before each theme run (re-runnable).
 *
 * Run:
 *   node scripts/verification/smoke-647-onboarding-wizard.mjs
 *   SMOKE_BASE_URL=https://... node scripts/verification/smoke-647-onboarding-wizard.mjs
 */

import { chromium } from 'playwright';
import { createRequire } from 'module';
import { resolve } from 'path';
import {
  setupBypassSession,
  setTheme,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  stamp,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const require = createRequire(import.meta.url);

// ── env ───────────────────────────────────────────────────────────────────────
const envVars = loadEnv(resolve(process.cwd(), '.env.local'));
for (const [k, v] of Object.entries(envVars)) {
  if (!(k in process.env)) process.env[k] = v;
}
const req = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing required env var: ${k}`);
  return v;
};

const TOKEN        = req('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL  = req('A11Y_AGENT_EMAIL');
const AGENT_PASS   = req('A11Y_AGENT_PASSWORD');
const API_KEY      = req('VITE_FIREBASE_API_KEY');

const PREVIEW_HOST = 'agencytrack-git-feat-onboarding-aec24b-kyron-marchan-s-projects.vercel.app';
const BASE_URL     = resolveSmokeBaseUrl({ defaultHost: PREVIEW_HOST });

// Distinct values from Slice-A smoke ('123A45') to avoid collision if cleanup missed
const TEST_AGENT_NUM = '456C78';
const TEST_DOB       = '1992-03-20';

// ── result tracking ──────────────────────────────────────────────────────────
const results = [];
const record = (leg, passed, detail) => {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'}  ${leg}: ${detail}`);
};

// ── global timeout ────────────────────────────────────────────────────────────
const clear = installGlobalTimeout(14 * 60 * 1000, () => {
  console.error(`[${stamp()}] GLOBAL TIMEOUT — smoke exceeded 14 min`);
});

// ── Admin SDK (bypasses rules; pre/post state management only) ───────────────
const admin = require('../../functions/node_modules/firebase-admin');
admin.initializeApp();
const adminDb = admin.firestore();

async function getAgentDocRef() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: AGENT_EMAIL, password: AGENT_PASS, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`Auth REST sign-in failed: ${res.status}`);
  const { idToken, localId } = await res.json();
  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
  return adminDb.doc(`tenants/${claims.tenantId}/users/${localId}`);
}

async function resetAgentDoc(ref) {
  await ref.update({
    agentNumber:        admin.firestore.FieldValue.delete(),
    dateOfBirth:        admin.firestore.FieldValue.delete(),
    onboardingComplete: admin.firestore.FieldValue.delete(),
  });
  console.log(`[${stamp()}] Agent doc reset — agentNumber/dateOfBirth/onboardingComplete deleted`);
}

// ── Per-theme run ─────────────────────────────────────────────────────────────
async function runTheme(theme, agentRef) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await setupBypassSession(context, BASE_URL, TOKEN);
  await setTheme(context, theme);

  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    // ── Login → wait for wizard testid directly (bypasses body.textContent check) ──
    // Note: loginAs uses body.textContent.length > 200 which Welcome step (~190 chars)
    // doesn't satisfy. We wait on the wizard testid directly with a generous timeout.
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
    await page.fill('input[type="email"]', AGENT_EMAIL);
    await page.fill('input[type="password"]', AGENT_PASS);
    await page.click('button[type="submit"]');

    // ── Leg 1: wizard shows ───────────────────────────────────────────────────
    const wizardEl = await page.waitForSelector('[data-testid="onboarding-wizard"]', {
      timeout: 45_000,
    }).catch(() => null);
    record(`${theme}-wizard-shows`, !!wizardEl,
      wizardEl ? 'wizard rendered after login (not AgentDashboard)' : 'wizard NOT found — onboarding gate may not be firing');

    if (!wizardEl) return;

    // ── Leg 2: identity save → Completion ─────────────────────────────────────
    await page.getByRole('button', { name: /get started/i }).click();
    await page.waitForSelector('#wizard-agent-number', { timeout: 10_000 });

    await page.fill('#wizard-agent-number', TEST_AGENT_NUM);
    await page.fill('#wizard-dob', TEST_DOB);
    await page.click('button[type="submit"]');

    const completionOk = await page.waitForFunction(
      () => document.body.textContent.includes("You're all set"),
      null,
      { timeout: 20_000 },
    ).catch(() => null);
    record(`${theme}-identity-save`, !!completionOk,
      completionOk ? 'Completion screen shown after Save & Continue' : '"You\'re all set" not found');

    // ── Leg 3: reload → data-derived resume at Completion ─────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    // After reload: onboardingComplete absent → wizard shows; agentNumber set → STEP_COMPLETION
    const wizardAfterReload = await page.waitForSelector('[data-testid="onboarding-wizard"]', {
      timeout: 30_000,
    }).catch(() => null);
    const atCompletion = wizardAfterReload
      ? await page.evaluate(() => document.body.textContent.includes("You're all set"))
      : false;
    record(`${theme}-persist-reload`, !!wizardAfterReload && atCompletion,
      wizardAfterReload
        ? (atCompletion ? 'wizard at Completion after reload — data-derived resume works' : 'wizard shown but NOT at Completion step')
        : 'wizard not present after reload');

    // ── Leg 4: fields written (admin read before completing) ──────────────────
    const snap = await agentRef.get();
    const d = snap.data() ?? {};
    const fieldsOk = d.agentNumber === TEST_AGENT_NUM && d.dateOfBirth === TEST_DOB && !d.onboardingComplete;
    record(`${theme}-fields-written`, fieldsOk,
      `agentNumber=${d.agentNumber ?? 'absent'} dateOfBirth=${d.dateOfBirth ?? 'absent'} onboardingComplete=${d.onboardingComplete ?? 'absent'}`);

    // ── Leg 5: Enter AgencyTrack → wizard detaches ────────────────────────────
    // Note: waitForSelector(state:'detached') always returns null on success per Playwright API
    // ("Returns null if waiting for hidden or detached"). Use waitForFunction for a definitive check.
    await page.getByRole('button', { name: /enter agencytrack/i }).click();
    const wizardGone = await page.waitForFunction(
      () => !document.querySelector('[data-testid="onboarding-wizard"]'),
      null,
      { timeout: 30_000 },
    ).then(() => true).catch(() => false);
    record(`${theme}-enter-app`, wizardGone,
      wizardGone ? 'wizard removed from DOM — AgentDashboard now rendering' : 'wizard still in DOM after 30s');

    // ── Leg 6: onboardingComplete flag set ────────────────────────────────────
    const snap2 = await agentRef.get();
    const flagSet = snap2.data()?.onboardingComplete === true;
    record(`${theme}-complete-flag`, flagSet,
      `onboardingComplete=${snap2.data()?.onboardingComplete ?? 'absent'}`);

  } finally {
    formatCaptureReport(capture);
    await page.close();
    await browser.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nonboarding-wizard Slice-B smoke`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Firebase project: ${process.env.VITE_FIREBASE_PROJECT_ID ?? '(from credentials)'}`);
  console.log(`Test account: ${AGENT_EMAIL.replace(/(?<=.{3}).+(?=@)/, '***')}\n`);

  const agentRef = await getAgentDocRef();

  for (const theme of ['light', 'dark']) {
    console.log(`\n── ${theme.toUpperCase()} ────────────────────────────────────────────────`);
    await resetAgentDoc(agentRef);
    try {
      await runTheme(theme, agentRef);
    } finally {
      await resetAgentDoc(agentRef);
    }
  }

  await admin.app().delete();
  finishSmoke(results, { clearTimeout: clear });
}

main().catch(async (err) => {
  console.error('Fatal:', err.message ?? err);
  try { await admin.app().delete(); } catch { /* best-effort */ }
  process.exit(1);
});
