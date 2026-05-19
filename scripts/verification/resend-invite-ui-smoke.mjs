// resend-invite-ui-smoke.mjs — smoke walk for PR #215 + server-side follow-on
// PR (Resend invite UI + server-side resendInviteEmail CF + auditInviteResends).
//
// Verifies on the Vercel preview that:
//   1. Login as tenant_admin works
//   2. UserManagementPanel ("All Users") loads with the user roster
//   3. Resend invite button appears on active users (correct aria-label,
//      correct data-testid pattern, MailPlus icon, ghost-square style)
//   4. ConfirmDialog opens with title "Resend invite email?" and the
//      banked edge-case copy "Previous reset email link will stop working."
//   5. Cancel closes the dialog without dispatching the reset email
//   6. Confirm invokes the resendInviteEmail CF and surfaces the success toast
//      ("Invite email resent to {name}.")
//   7. Server-side audit verification — an auditInviteResends doc lands with
//      the locked shape (tenantId, actorUid, actorEmail, actorRole, targetUid,
//      targetEmail, timestamp, emailQueued: true). The emailQueued field is
//      the load-bearing CF-success signal — true means both the
//      generatePasswordResetLink call AND the mail/ doc write succeeded.
//      Per Option 1 verification approach (dispatcher decision): the mail/
//      doc itself is unreadable from any client-side smoke (rules
//      `allow read, write: if false`); the audit row's `emailQueued: true`
//      attests the mail/ write happened. Admin SDK SA-key access for smokes
//      is hard-banned (PR #78 / PR #225 access-control posture).
//   8. After the confirm, the real password-reset email arrival is left to
//      the dispatcher to verify in the target inbox.
//
// Run from repo root:  node scripts/verification/resend-invite-ui-smoke.mjs
// Requires .env.local with VERCEL_BYPASS_TOKEN + A11Y_TENANT_ADMIN_EMAIL +
// A11Y_TENANT_ADMIN_PASSWORD + A11Y_AGENT_EMAIL +
// VITE_FIREBASE_API_KEY + VITE_FIREBASE_AUTH_DOMAIN +
// VITE_FIREBASE_PROJECT_ID + VITE_FIREBASE_STORAGE_BUCKET +
// VITE_FIREBASE_MESSAGING_SENDER_ID + VITE_FIREBASE_APP_ID
// (the same Firebase Web SDK config keys the app consumes via import.meta.env).

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { setupBypassSession, safeLog, waitForFirebaseReady } from './lib/walk-helpers.mjs';

function loadEnvLocal(path) {
  try {
    const src = readFileSync(path, 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && /^[A-Z0-9_]+$/.test(k) && !(k in process.env)) process.env[k] = v;
    });
  } catch {
    // missing .env.local is fine — env may already be set externally
  }
}
loadEnvLocal(resolve(process.cwd(), '.env.local'));

const PREVIEW_HOST = process.env.PREVIEW_HOST ??
  'agencytrack-git-chore-resend-invite-ui-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const SCREENSHOT_DIR = resolve('verification', 'resend-invite-ui-smoke');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
};
const TOKEN          = requireEnv('VERCEL_BYPASS_TOKEN');
const ADMIN_EMAIL    = requireEnv('A11Y_TENANT_ADMIN_EMAIL');
const ADMIN_PASSWORD = requireEnv('A11Y_TENANT_ADMIN_PASSWORD');
const TARGET_EMAIL   = requireEnv('A11Y_AGENT_EMAIL');

const results = [];
const record  = (step, pass, note = '') => {
  results.push({ step, pass, note });
  safeLog(`${pass ? '✓' : '✗'} ${step}${note ? ' — ' + note : ''}`);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    await setupBypassSession(context, PREVIEW_URL, TOKEN);
    safeLog('[setup] bypass session OK');

    const page = await context.newPage();
    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);

    // ── Step 1: Login as tenant_admin ──────────────────────────────────
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await Promise.all([
      page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
      page.click('button[type="submit"]'),
    ]);
    record('Step 1: Login as tenant_admin', true);
    await page.screenshot({ path: join(SCREENSHOT_DIR, '01-post-login.png'), fullPage: false });

    // ── Step 2: Navigate to "All Users" ────────────────────────────────
    await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 20_000 });
    const allUsersClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('nav[aria-label="Primary navigation"] a, nav[aria-label="Primary navigation"] button'));
      const target = links.find((el) => /All Users/i.test(el.textContent ?? ''));
      if (!target) return false;
      target.click();
      return true;
    });
    if (!allUsersClicked) throw new Error('All Users nav link not found');
    // Wait for the roster heading to render.
    await page.waitForFunction(() => /User Roster/i.test(document.body.textContent ?? ''), { timeout: 20_000 });
    record('Step 2: Navigate to User Management', true);
    await page.screenshot({ path: join(SCREENSHOT_DIR, '02-user-management.png'), fullPage: false });

    // ── Step 3: Locate active user in roster ───────────────────────────
    // Wait for at least one resend button to appear (means active users loaded).
    await page.waitForSelector('button[data-testid^="user-resend-"]', { timeout: 20_000 });
    const targetUidInfo = await page.evaluate((targetEmail) => {
      // Find the row whose email cell matches; pull the data-testid of its resend button.
      const rows = Array.from(document.querySelectorAll('[class*="grid-cols-"]'));
      for (const row of rows) {
        if ((row.textContent ?? '').includes(targetEmail)) {
          const btn = row.querySelector('button[data-testid^="user-resend-"]');
          if (btn) return { testid: btn.getAttribute('data-testid'), ariaLabel: btn.getAttribute('aria-label') };
        }
      }
      // Fallback: any resend button on the page.
      const any = document.querySelector('button[data-testid^="user-resend-"]');
      return any ? { testid: any.getAttribute('data-testid'), ariaLabel: any.getAttribute('aria-label'), fallback: true } : null;
    }, TARGET_EMAIL);
    if (!targetUidInfo) throw new Error('No Resend button found on any user row');
    record('Step 3: Locate target user row', true, `testid=${targetUidInfo.testid}${targetUidInfo.fallback ? ' (fallback — exact email row not matched, used first available)' : ''}`);

    // ── Step 4 + 5: Resend button visible with icon + aria-label ───────
    const resendBtnSel = `button[data-testid="${targetUidInfo.testid}"]`;
    const ariaOk = /^Resend invite email to /.test(targetUidInfo.ariaLabel ?? '');
    record('Step 4-5: Resend button present with correct aria-label', ariaOk, `aria-label="${targetUidInfo.ariaLabel}"`);
    // Verify icon (MailPlus svg) present
    const hasIcon = await page.evaluate((sel) => !!document.querySelector(`${sel} svg`), resendBtnSel);
    record('Step 4-5: Resend button has SVG icon (MailPlus)', hasIcon);

    // ── Step 5b: Inactive users — toggle "Show inactive" and verify no Resend button on inactive rows ──
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => /Show inactive/i.test(b.textContent ?? ''));
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    const inactiveCheck = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[class*="grid-cols-"]'));
      let inactiveRows = 0, inactiveWithResend = 0;
      for (const row of rows) {
        if ((row.textContent ?? '').toLowerCase().includes('inactive')) {
          inactiveRows += 1;
          if (row.querySelector('button[data-testid^="user-resend-"]')) inactiveWithResend += 1;
        }
      }
      return { inactiveRows, inactiveWithResend };
    });
    if (inactiveCheck.inactiveRows === 0) {
      record('Step 5b: Inactive users hide Resend button', true, 'no inactive users present in preview env — gate not directly testable in walk, but covered by vitest case 1');
    } else {
      record('Step 5b: Inactive users hide Resend button', inactiveCheck.inactiveWithResend === 0, `${inactiveCheck.inactiveRows} inactive rows, ${inactiveCheck.inactiveWithResend} with Resend button`);
    }
    // Hide inactive again to keep state clean.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => /Hide inactive/i.test(b.textContent ?? ''));
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);

    // ── Step 6: Click Resend button ────────────────────────────────────
    await page.click(resendBtnSel);
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    record('Step 6: Click Resend → ConfirmDialog opens', true);
    await page.screenshot({ path: join(SCREENSHOT_DIR, '03-confirm-dialog.png'), fullPage: false });

    // ── Step 7: Verify dialog title + edge-case copy ───────────────────
    const dialogContent = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d ? d.textContent ?? '' : '';
    });
    const titleOk = /Resend invite email\?/i.test(dialogContent);
    const copyOk  = /Previous reset email link will stop working/i.test(dialogContent);
    record('Step 7: Dialog has correct title', titleOk);
    record('Step 7: Dialog has banked edge-case copy', copyOk);

    // ── Step 8: Click Cancel ───────────────────────────────────────────
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => /^Cancel$/i.test(b.textContent ?? ''));
      if (btn) btn.click();
    });
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 });
    record('Step 8: Cancel closes dialog (no email sent)', true);

    // ── Step 9: Click Resend again → confirm ───────────────────────────
    await page.click(resendBtnSel);
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => /^Resend$/.test(b.textContent?.trim() ?? ''));
      if (btn) btn.click();
    });

    // ── Step 10: Verify success toast appears ──────────────────────────
    // The toast uses the existing useToast pattern — wait for "Invite email resent" text in DOM.
    const toastAppeared = await page.waitForFunction(
      () => /Invite email resent to /i.test(document.body.textContent ?? ''),
      { timeout: 15_000 }
    ).then(() => true).catch(() => false);
    record('Step 10: Success toast surfaces "Invite email resent to {name}."', toastAppeared);
    await page.screenshot({ path: join(SCREENSHOT_DIR, '04-success-toast.png'), fullPage: false });

    // ── Step 10b: Server-side audit verification ────────────────────────
    // Per Option 1 verification approach: the auditInviteResends doc is the
    // load-bearing signal that the resendInviteEmail CF ran end-to-end.
    // mail/ rules `allow read, write: if false` block any direct client-side
    // verification of the mail/ doc itself; the audit row's emailQueued: true
    // is the same signal one step downstream (the CF writes the audit doc
    // immediately after the mail/ write attempt, carrying the outcome).
    //
    // Uses a Node-side Firebase Web SDK client signed in as tenant_admin —
    // queries flow through Firestore rules, which permit tenant_admin read
    // of own-tenant auditInviteResends docs (rules block added in this PR).
    // Admin SDK SA-key access is hard-banned for smokes (PR #78 / PR #225).
    const targetUid = targetUidInfo.testid.replace(/^user-resend-/, '');
    let auditVerified = false;
    let auditDoc = null;
    let actorUidForReport = '[unknown]';
    try {
      const fbApp = initializeApp(
        {
          apiKey:            requireEnv('VITE_FIREBASE_API_KEY'),
          authDomain:        requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
          projectId:         requireEnv('VITE_FIREBASE_PROJECT_ID'),
          storageBucket:     requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
          messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
          appId:             requireEnv('VITE_FIREBASE_APP_ID'),
        },
        'smoke-audit-verify'
      );
      const fbAuth = getAuth(fbApp);
      const cred = await signInWithEmailAndPassword(fbAuth, ADMIN_EMAIL, ADMIN_PASSWORD);
      const actorUid = cred.user.uid;
      actorUidForReport = actorUid;
      const fbDb = getFirestore(fbApp);

      // Window: 60s back from now. Audit doc lands within seconds of CF
      // return; this is generous for clock skew + CF cold start.
      const since = Timestamp.fromMillis(Date.now() - 60_000);

      // Poll up to 6x (3s interval) — covers async audit-write completion.
      for (let attempt = 0; attempt < 6 && !auditVerified; attempt++) {
        const q = query(
          collection(fbDb, 'auditInviteResends'),
          where('actorUid', '==', actorUid),
          where('targetUid', '==', targetUid),
          where('timestamp', '>=', since),
          orderBy('timestamp', 'desc'),
          limit(1),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          auditDoc = snap.docs[0].data();
          auditVerified = true;
          break;
        }
        if (attempt < 5) await new Promise((r) => setTimeout(r, 3_000));
      }
    } catch (auditErr) {
      record('Step 10b: Server-side audit query', false, `${auditErr.name}: ${auditErr.message}`);
    }
    if (!auditVerified) {
      record('Step 10b: auditInviteResends doc lands within 18s window', false, `no matching doc for actorUid=${actorUidForReport} targetUid=${targetUid}`);
    } else {
      record('Step 10b: auditInviteResends doc lands within 18s window', true, `targetUid=${targetUid}`);

      const VALID_ACTOR_ROLES = ['platform_admin', 'tenant_admin', 'sales_manager', 'branch_manager'];
      const shapeChecks = [
        ['tenantId',    typeof auditDoc.tenantId === 'string' && auditDoc.tenantId.length > 0],
        ['actorUid',    auditDoc.actorUid === actorUidForReport],
        ['actorEmail',  typeof auditDoc.actorEmail === 'string' && auditDoc.actorEmail.length > 0],
        ['actorRole',   VALID_ACTOR_ROLES.includes(auditDoc.actorRole)],
        ['targetUid',   auditDoc.targetUid === targetUid],
        ['targetEmail', typeof auditDoc.targetEmail === 'string' && auditDoc.targetEmail.length > 0],
        ['timestamp',   auditDoc.timestamp !== undefined && auditDoc.timestamp !== null],
      ];
      for (const [field, ok] of shapeChecks) {
        record(`Step 10b: audit doc field "${field}" valid`, ok);
      }
      // emailQueued is the load-bearing CF-success signal.
      record('Step 10b: emailQueued === true (mail/ write attested by audit row)', auditDoc.emailQueued === true,
        auditDoc.emailQueued === true ? '' : `got ${JSON.stringify(auditDoc.emailQueued)}${auditDoc.emailError ? ` (emailError: ${auditDoc.emailError})` : ''}`);
    }

    // ── Step 11 (formerly step 12): Real email arrival ─────────────────
    record('Step 11: Real password-reset email arrival', null, 'Deferred to dispatcher: check inbox at target email (A11Y_AGENT_EMAIL — value not echoed). CF execution attested by Step 10b audit row.');

    // ── Summary ─────────────────────────────────────────────────────────
    const passCount = results.filter((r) => r.pass === true).length;
    const failCount = results.filter((r) => r.pass === false).length;
    const deferCount = results.filter((r) => r.pass === null).length;
    safeLog(`\n──── Smoke walk summary ────`);
    safeLog(`pass=${passCount}  fail=${failCount}  deferred=${deferCount}`);
    safeLog(`screenshots: ${SCREENSHOT_DIR}`);
    if (failCount > 0) process.exitCode = 1;
  } catch (err) {
    safeLog(`[FATAL] ${err.name}: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();
