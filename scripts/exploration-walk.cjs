/**
 * exploration-walk.cjs
 *
 * Programmatic walkthrough that mirrors the manual exploration template in
 * scripts/exploration-template.md. Drives the app with Playwright, captures
 * console errors, network failures, uncaught rejections, and
 * structural-element verification. Saves a filled-out markdown report to
 * verification/exploration_<role>_<scope>_<timestamp>.md.
 *
 * Multi-role support (Design System v2 — B4): pass --role=<name> to run the
 * walkthrough as that role. Each role supplies its own credentials (env
 * vars) and its own tab plan. Without --role, defaults to agent for
 * backwards compatibility.
 *
 * Use after every PR merge against production, and against any preview URL
 * during PR verification.
 *
 * Usage:
 *   node scripts/exploration-walk.cjs                                       # default role: agent, uses A11Y_BASE_URL or http://localhost:5173
 *   node scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app  # explicit URL, default role: agent
 *   node scripts/exploration-walk.cjs --url=<preview> --label=pr1_preview   # custom report label
 *   node scripts/exploration-walk.cjs --role=branch_manager --url=<preview> # walk a different role
 *   node scripts/exploration-walk.cjs --role=tenant_admin --url=<preview>   # ditto
 *
 * Roles supported: agent | branch_manager | unit_manager | sales_manager | tenant_admin
 *
 * Env (read from .env.local):
 *   A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD                  — agent walk
 *   A11Y_BRANCH_MANAGER_EMAIL, A11Y_BRANCH_MANAGER_PASSWORD — branch_manager walk
 *   A11Y_UNIT_MANAGER_EMAIL, A11Y_UNIT_MANAGER_PASSWORD     — unit_manager walk
 *   A11Y_SALES_MANAGER_EMAIL, A11Y_SALES_MANAGER_PASSWORD   — sales_manager walk
 *   A11Y_TENANT_ADMIN_EMAIL, A11Y_TENANT_ADMIN_PASSWORD     — tenant_admin walk
 *   VERCEL_BYPASS_TOKEN                                     — required for protected previews
 *   A11Y_BASE_URL                                           — fallback if --url not passed
 *
 * Bypass-cookie auto-detection:
 *   - URL on agencytrack.vercel.app domain with a "-git-" or hashed subdomain → preview, wires bypass
 *   - URL == https://agencytrack.vercel.app                                   → production, no bypass
 *   - localhost                                                                → no bypass
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

loadDotEnvLocal();
function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  const lines = text.split(/\r?\n/);
  // First pass: validate every line. Throw before mutating process.env so a
  // partial parse can't precede the failure. Detection target: a line where
  // the value half contains an embedded `KEY=` pattern, which only happens
  // when two key=value pairs got concatenated by a missing newline (see
  // TOOLING-N — silent corruption ate an hour of the SEC-9 autonomous run).
  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const embedded = val.match(/([A-Z][A-Z0-9_]*)=/);
    if (embedded) {
      throw new Error(
        `Malformed .env.local: line ${i + 1} appears to concatenate two keys ` +
        `("${key}" and "${embedded[1]}"). Ensure each key is on its own line ` +
        `and the file ends with a trailing newline.`
      );
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    parsed.push([key, val]);
  }
  for (const [key, val] of parsed) {
    if (!(key in process.env)) process.env[key] = val;
  }
}

function arg(name, fallback) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.replace(`--${name}=`, '') : fallback;
}

const BASE_URL = arg('url', process.env.A11Y_BASE_URL || 'http://localhost:5173');
const LABEL    = arg('label', null);
const ROLE     = arg('role', 'agent');
const BYPASS   = process.env.VERCEL_BYPASS_TOKEN || '';

// ── Role profiles (multi-role walkthrough, B4) ──────────────────────────
// Each role drives different credentials, a different home-tab name, a
// different landing-text wait selector, and a different tab plan. The
// manager profile is shared across all 4 manager-tier roles since they
// render identical sidebars in B4 — per-role differentiation lands in
// B5/P9.
const MANAGER_TABS = [
  ['5',   'Team'],
  ['6',   'Campaigns'],
  ['7',   'Awards'],
  ['8',   'Master Sheet'],
  ['9',   'Compliance'],
  ['10',  'Persistency'],
  ['11',  'Goals'],
  ['12',  'Settlements'],
  ['13',  'Leaderboard'],
  ['14',  'Profile'],
];
const AGENT_TABS = [
  ['5',   'Career'],
  ['6',   'Awards'],
  ['14',  'Leaderboard'],
  ['15a', 'History'],
  ['16',  'Profile'],
];
// Design System v2 — B5 + Track C C1: tenant_admin renders the
// TenantAdminDashboard surface. Tab list mirrors the actionable sidebar
// items only — Roles & Permissions / Audit Log / Billing / Settings are
// aria-disabled stubs and intentionally skipped.
//
// Track C C1: Branches upgraded from B5 stub to a real tab; included
// here so the regression walk visits the new surface and verifies the
// single-<main> invariant for it.
const TENANT_ADMIN_TABS = [
  ['5',  'Branches'],
  ['6',  'Company Config'],
  ['7',  'All Users'],
  ['8',  'Campaigns'],
  ['9',  'Profile'],
];
const ROLE_PROFILES = {
  agent: {
    envEmail: 'A11Y_AGENT_EMAIL',
    envPassword: 'A11Y_AGENT_PASSWORD',
    homeTabName: 'Dashboard',
    landingText: 'Recent Activity',
    tabs: AGENT_TABS,
  },
  branch_manager: {
    envEmail: 'A11Y_BRANCH_MANAGER_EMAIL',
    envPassword: 'A11Y_BRANCH_MANAGER_PASSWORD',
    homeTabName: 'Overview',
    landingText: 'Team YTD API',
    tabs: MANAGER_TABS,
  },
  unit_manager: {
    envEmail: 'A11Y_UNIT_MANAGER_EMAIL',
    envPassword: 'A11Y_UNIT_MANAGER_PASSWORD',
    homeTabName: 'Overview',
    landingText: 'Team YTD API',
    tabs: MANAGER_TABS,
  },
  sales_manager: {
    envEmail: 'A11Y_SALES_MANAGER_EMAIL',
    envPassword: 'A11Y_SALES_MANAGER_PASSWORD',
    homeTabName: 'Overview',
    landingText: 'Team YTD API',
    tabs: MANAGER_TABS,
  },
  tenant_admin: {
    envEmail: 'A11Y_TENANT_ADMIN_EMAIL',
    envPassword: 'A11Y_TENANT_ADMIN_PASSWORD',
    // B5: tenant_admin renders TenantAdminDashboard with the Dashboard
    // tab as home. Landing text matches the <h2> heading on that tab
    // (Users by role card) — the Company Config card lives on a separate
    // tab now per the locked Dashboard / Company Config split.
    homeTabName: 'Dashboard',
    landingText: 'Users by role',
    tabs: TENANT_ADMIN_TABS,
  },
};

const profile = ROLE_PROFILES[ROLE];
if (!profile) {
  console.error(`Unknown --role=${ROLE}. Supported: ${Object.keys(ROLE_PROFILES).join(', ')}`);
  process.exit(1);
}
const EMAIL    = process.env[profile.envEmail];
const PASSWORD = process.env[profile.envPassword];

if (!EMAIL || !PASSWORD) {
  console.error(`Missing ${profile.envEmail} / ${profile.envPassword} in .env.local for role=${ROLE}`);
  process.exit(1);
}

// ── Bypass auto-detection ───────────────────────────────────────────────────
function detectScope(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'agencytrack.vercel.app') return { scope: 'production', needsBypass: false };
    if (u.hostname.endsWith('.vercel.app'))      return { scope: 'preview',    needsBypass: !!BYPASS };
    return { scope: 'local', needsBypass: false };
  } catch {
    return { scope: 'unknown', needsBypass: false };
  }
}
const { scope, needsBypass } = detectScope(BASE_URL);
const REPORT_LABEL = LABEL || `${scope}_${ROLE}`;

// ── Known-harmless console / network patterns (per exploration-template.md) ─
const HARMLESS_CONSOLE = [
  /\[AgencyTrack\] Auth claims:/,
  /\[AgencyTrack\] UID:/,
];
const HARMLESS_NET = [
  // Initial Firestore Listen channel POST aborts under StrictMode double-mount,
  // immediately retried successfully. Per scripts/exploration-template.md.
  /firestore\.googleapis\.com\/.*Listen\/channel/,
  // Fontshare WOFF2 font requests get cancelled by the browser when the
  // page paints before the font is needed (especially behind the Vercel
  // SSO bypass-cookie redirect). Harmless — fonts load on the next paint.
  /cdn\.fontshare\.com\/.*\.woff2/,
];
const isHarmless = (text, patterns) => patterns.some((p) => p.test(text));

(async () => {
  // Dynamic import of shared ESM helpers. CJS cannot require() ESM; import() is used
  // instead. pathToFileURL ensures the path resolves to the correct file regardless of
  // the working directory from which the script is run.
  const { setupBypassSession, hardReloadAndAwaitReady, writeReadVerifyCycle } =
    await import(pathToFileURL(path.join(__dirname, 'verification', 'lib', 'walk-helpers.mjs')).href);

  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '').slice(0, 15);
  console.log(`[exploration-walk] target=${BASE_URL} role=${ROLE} scope=${scope} bypass=${needsBypass ? 'on' : 'off'}`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const networkFailures = [];
  const uncaughtRejections = [];
  const actionsCompleted = new Set();
  const stepNotes = [];
  const verificationDir = path.resolve(process.cwd(), 'verification', 'walk');
  fs.mkdirSync(verificationDir, { recursive: true });

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error'   && !isHarmless(text, HARMLESS_CONSOLE)) consoleErrors.push(text);
    if (msg.type() === 'warning' && !isHarmless(text, HARMLESS_CONSOLE)) consoleWarnings.push(text);
  });
  page.on('pageerror',     (err) => uncaughtRejections.push(String(err)));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (isHarmless(url, HARMLESS_NET)) return;
    networkFailures.push(`${req.method()} ${url} — ${req.failure()?.errorText || 'unknown'}`);
  });

  async function applyVercelBypass() {
    if (!needsBypass) return;
    // Lesson 5: cookie-after-handshake. setupBypassSession sets
    // x-vercel-set-bypass-cookie=samesitenone (lesson 1) on a throwaway page,
    // catches and sanitizes any errors, and closes the page — the session
    // cookie is set on `ctx` and all subsequent navigation in `page` (which
    // shares the context) uses bare URLs with no token reintroduction.
    await setupBypassSession(ctx, BASE_URL, BYPASS);
  }

  async function step(id, label, fn) {
    try {
      await fn();
      actionsCompleted.add(id);
      console.log(`  [ok] ${id}: ${label}`);
    } catch (e) {
      const msg = e.message?.slice(0, 200) || String(e);
      console.log(`  [SKIP] ${id}: ${label} — ${msg}`);
      stepNotes.push(`Step ${id} (${label}): ${msg}`);
    }
  }

  try {
    // ── 1: Navigate to target URL ────────────────────────────────────────────
    await step('1', 'Navigate to target URL (login screen renders)', async () => {
      await applyVercelBypass();
      // Lesson 2: 'domcontentloaded', never 'networkidle' for Firebase apps.
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=AgencyTrack', { timeout: 15_000 });
      await page.waitForSelector('input[type="email"]', { timeout: 5_000 });
    });
    await step('1a', 'LoginScreen has exactly one <main>', async () => {
      const count = await page.locator('main').count();
      if (count !== 1) throw new Error(`expected 1 main, got ${count}`);
    });

    // ── 2: Login ─────────────────────────────────────────────────────────────
    await step('2', 'Login (auth chain returns 200)', async () => {
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForSelector(`text=${profile.homeTabName}`, { timeout: 20_000 });
    });
    await step('2a', 'Dashboard shell: 1 main, 1 header, 1 sidebar nav, 1 bottom-nav (B4)', async () => {
      const mains       = await page.locator('main').count();
      const headers     = await page.locator('header').count();
      const sidebarNavs = await page.locator('nav[aria-label="Primary navigation"]').count();
      const bottomNavs  = await page.locator('nav[aria-label="Quick navigation"]').count();
      if (mains !== 1)        throw new Error(`expected 1 main, got ${mains}`);
      if (headers !== 1)      throw new Error(`expected 1 header, got ${headers}`);
      if (sidebarNavs !== 1)  throw new Error(`expected 1 sidebar nav, got ${sidebarNavs}`);
      if (bottomNavs !== 1)   throw new Error(`expected 1 bottom-nav (DOM, hidden via CSS at desktop), got ${bottomNavs}`);
    });

    // ── 3: Landing surface rendered (per-role landmark text) ─────────────────
    await step('3', `Wait for dashboard (${profile.landingText} rendered)`, async () => {
      await page.waitForSelector(`text=${profile.landingText}`, { timeout: 10_000 });
    });

    // ── 4: Screenshot light ──────────────────────────────────────────────────
    await step('4', 'Screenshot dashboard (light mode)', async () => {
      await page.screenshot({ path: path.join(verificationDir, `${REPORT_LABEL}_dashboard-light_${stamp}.png`), fullPage: true });
    });

    // ── 5–N: per-role tab walkthrough ────────────────────────────────────────
    const tabs = profile.tabs;
    for (const [id, name] of tabs) {
      await step(id, `${name} tab renders`, async () => {
        await page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).click();
        await page.waitForTimeout(500);
      });
      await step(`${id}a`, `${name} tab — single <main>`, async () => {
        const count = await page.locator('main').count();
        if (count !== 1) throw new Error(`expected 1 main, got ${count}`);
      });
    }

    // ── awards-pre, 7-9: awards subtabs ──────────────────────────────────────
    // The tab loop above lands on the last tab in the role's plan (Profile).
    // Navigate back to Awards before testing subtabs. Both agent and manager
    // sidebars expose an "Awards" item, so this works across all roles.
    await step('awards-pre', 'Navigate back to Awards tab', async () => {
      await page.getByRole('button', { name: /^Awards$/i }).first().click();
      await page.waitForTimeout(400);
    });
    await step('7-9', 'Awards subtabs (Quarterly/Annual/Club, if present)', async () => {
      for (const sub of ['Quarterly', 'Annual', 'Club']) {
        const btn = page.getByRole('button', { name: new RegExp(`^${sub}$`, 'i') }).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(300);
        }
      }
    });

    // ── 20–22: dark mode ─────────────────────────────────────────────────────
    await step('20', 'Toggle dark mode', async () => {
      // Navigate back to home tab (per role) before toggling — the screenshot
      // in step 21 captures the role's primary surface.
      await page.getByRole('button', { name: new RegExp(`^${profile.homeTabName}$`, 'i') }).first().click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /toggle dark mode/i }).click();
      await page.waitForTimeout(400);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (!isDark) throw new Error('html.dark class not added');
    });
    await step('21', 'Screenshot dashboard (dark mode)', async () => {
      await page.screenshot({ path: path.join(verificationDir, `${REPORT_LABEL}_dashboard-dark_${stamp}.png`), fullPage: true });
    });
    await step('22', 'Toggle back to light mode', async () => {
      await page.getByRole('button', { name: /toggle dark mode/i }).click();
      await page.waitForTimeout(400);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (isDark) throw new Error('html.dark class still present');
    });

    // ── sidebar-22a/b/c: collapsed-sidebar regression check ──────────────────
    //  Permanent guard for the post-B4 P0 (PR #56). When the sidebar
    //  collapses, both the expand toggle and the sign-out button MUST stay
    //  reachable — they're the only paths out of the collapsed state and
    //  out of the app. The bug reproducer becomes a regression check, same
    //  precedent as scripts/test-b5-config-rule.js.
    await step('sidebar-22a', 'Collapse sidebar (html.sidebar-collapsed set)', async () => {
      await page.locator('button[aria-label="Collapse sidebar"]').click();
      await page.waitForTimeout(300);
      const collapsed = await page.evaluate(
        () => document.documentElement.classList.contains('sidebar-collapsed')
      );
      if (!collapsed) throw new Error('html.sidebar-collapsed not set after click');
    });
    await step('sidebar-22b', 'Toggle + sign-out reachable in collapsed state', async () => {
      const state = await page.evaluate(() => {
        const probe = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return { exists: false };
          const cs = getComputedStyle(el);
          const r  = el.getBoundingClientRect();
          return {
            exists: true,
            display:    cs.display,
            visibility: cs.visibility,
            width:  r.width,
            height: r.height,
          };
        };
        return {
          toggle:     probe('.sidebar-collapse-btn'),
          signOut:    probe('.sidebar-foot-action'),
          sidebarPx:  document.querySelector('.sidebar')?.getBoundingClientRect().width ?? null,
        };
      });
      const reachable = (s) =>
        s.exists && s.display !== 'none' && s.visibility !== 'hidden' && s.width > 0 && s.height > 0;
      if (!reachable(state.toggle))
        throw new Error(`expand toggle not reachable: ${JSON.stringify(state.toggle)}`);
      if (!reachable(state.signOut))
        throw new Error(`sign-out not reachable: ${JSON.stringify(state.signOut)}`);
      if (state.sidebarPx == null || state.sidebarPx > 100)
        throw new Error(`sidebar not at collapsed width: ${state.sidebarPx}`);
    });
    await step('sidebar-22c', 'Re-expand via same toggle (html.sidebar-collapsed cleared)', async () => {
      await page.locator('button[aria-label="Expand sidebar"]').click();
      await page.waitForTimeout(300);
      const collapsed = await page.evaluate(
        () => document.documentElement.classList.contains('sidebar-collapsed')
      );
      if (collapsed) throw new Error('html.sidebar-collapsed still set after expand click');
    });

    // ── 23, 23a, 26: wizard (both agent and managers expose
    //  "Submit Weekly Report" on their home tab) ────────────────────────────
    await step('23', 'Open wizard (Select Week renders)', async () => {
      await page.getByRole('button', { name: /Submit Weekly Report/i }).click();
      await page.waitForSelector('text=Select Week', { timeout: 10_000 });
    });
    await step('23a', 'Wizard has header + main + label/select binding', async () => {
      const mains   = await page.locator('main').count();
      const headers = await page.locator('header').count();
      if (mains !== 1)   throw new Error(`expected 1 main in wizard, got ${mains}`);
      if (headers !== 1) throw new Error(`expected 1 header in wizard, got ${headers}`);
      const sel    = await page.locator('select#wizard-week').count();
      const label  = await page.locator('label[for="wizard-week"]').count();
      if (sel !== 1)   throw new Error(`expected 1 select#wizard-week, got ${sel}`);
      if (label !== 1) throw new Error(`expected 1 label[for=wizard-week], got ${label}`);
    });
    await step('26', 'Close wizard (returns to dashboard)', async () => {
      await page.getByRole('button', { name: /^close$/i }).click();
      await page.waitForSelector(`text=${profile.homeTabName}`, { timeout: 5_000 });
      const onWizard = await page.locator('text=Select Week').count();
      if (onWizard > 0) throw new Error('still on wizard after close');
    });

    // ── 26b: agent wizard write-read-verify (agent role only) ────────────────
    // Re-opens the wizard, types a value into the first NumericField, waits for
    // the auto-save "Saved" indicator, hard-reloads, re-opens the wizard for the
    // same week, and asserts the value persisted. Exercises rules + claims + index.
    // Not run for manager/admin roles — their write surfaces vary too much for a
    // single canonical cycle (each gets its own WRC in future PRs).
    if (ROLE === 'agent') {
      let chosenWeek = null;
      await step('26b', 'Agent wizard write-read-verify (type → save indicator → reload → persist-verify)', async () => {
        const { pass, errors } = await writeReadVerifyCycle(page, {
          description: 'agent-wizard-write-read-verify',
          screenshotDir: verificationDir,

          writeFn: async (pg) => {
            await pg.getByRole('button', { name: /Submit Weekly Report/i }).click();
            await pg.waitForSelector('text=Select Week', { timeout: 10_000 });

            // Try up to 3 weeks until we find one that's not already submitted.
            const select = pg.locator('select#wizard-week');
            const options = await select.locator('option').all();
            if (options.length === 0) throw new Error('No weeks in wizard dropdown');

            let weekReady = false;
            for (let i = 0; i < Math.min(options.length, 3); i++) {
              const weekVal = await options[i].getAttribute('value');
              if (i > 0) await select.selectOption(weekVal);
              chosenWeek = weekVal;
              await pg.getByRole('button', { name: /Start Report/i }).click();
              await pg.waitForTimeout(400);
              const title = await pg.locator('h1').innerText().catch(() => '');
              if (/Prospecting|Calls|Interviews|Names|Time|Goals/i.test(title)) {
                weekReady = true;
                break;
              }
              // Week was submitted — navigate back and try next.
              const changeBtn = pg.getByRole('button', { name: /Change week|Pick another/i });
              if (await changeBtn.count() > 0) await changeBtn.first().click();
              await pg.waitForSelector('text=Select Week', { timeout: 5_000 });
            }
            if (!weekReady) throw new Error('All tried weeks are submitted — cannot exercise write path');

            // Lesson 3: CardStack.NumericField is type="text" inputMode="numeric".
            const numericInput = pg.locator('input[inputmode="numeric"]').first();
            await numericInput.fill('7');

            // Wait for auto-save debounce (1500ms) + network buffer.
            await pg.waitForTimeout(2000);
            // Verify the "Saved" indicator appears (role="status" aria-live="polite").
            await pg.locator('[role="status"][aria-live="polite"]:has-text("Saved")').waitFor({ timeout: 8000 });

            // Close wizard — returns to dashboard.
            await pg.getByRole('button', { name: /^close$/i }).click();
            await pg.waitForSelector(`text=${profile.homeTabName}`, { timeout: 5_000 });
          },

          verifyFn: async (pg) => {
            // After hardReloadAndAwaitReady: Firebase auth restores, dashboard appears.
            await pg.waitForSelector(`text=${profile.homeTabName}`, { timeout: 15_000 });

            // Re-open wizard for the same week.
            await pg.getByRole('button', { name: /Submit Weekly Report/i }).click();
            await pg.waitForSelector('text=Select Week', { timeout: 10_000 });
            if (chosenWeek) await pg.locator('select#wizard-week').selectOption(chosenWeek);
            await pg.getByRole('button', { name: /Start Report/i }).click();
            await pg.waitForSelector('text=Prospecting', { timeout: 8000 });
            await pg.waitForTimeout(600); // allow getDraft to load

            // Assert the value we typed is still there.
            const numericInput = pg.locator('input[inputmode="numeric"]').first();
            const savedValue = await numericInput.inputValue();
            if (savedValue !== '7') throw new Error(`Expected persisted value "7", got "${savedValue}"`);

            // Close wizard.
            await pg.getByRole('button', { name: /^close$/i }).click();
            await pg.waitForSelector(`text=${profile.homeTabName}`, { timeout: 5_000 });
          },
        });

        if (!pass) throw new Error(`write-read-verify failed: ${errors.join('; ')}`);
      });
    }

    // ── 27, 28: sign out ─────────────────────────────────────────────────────
    await step('27', 'Sign out', async () => {
      await page.getByRole('button', { name: /sign out/i }).click();
      await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
    });
    await step('28', 'Verify login redirect', async () => {
      const visible = await page.getByRole('button', { name: /sign in/i }).isVisible();
      if (!visible) throw new Error('not redirected to login');
    });

  } finally {
    await browser.close();
  }

  // ── Compose report ─────────────────────────────────────────────────────────
  // Build the action list dynamically from the role's tab plan so the
  // checklist always matches what was actually exercised.
  const tabActions = profile.tabs.flatMap(([id, name]) => [
    [id,         `${name} tab renders`],
    [`${id}a`,   `${name} tab — single <main>`],
  ]);
  const allActions = [
    ['1',           'Navigate to target URL (login screen renders)'],
    ['1a',          'LoginScreen has exactly one <main>'],
    ['2',           'Login (auth chain returns 200)'],
    ['2a',          'Dashboard shell: 1 main, 1 header, 1 sidebar nav, 1 bottom-nav (B4)'],
    ['3',           `Wait for dashboard (${profile.landingText} rendered)`],
    ['4',           'Screenshot dashboard (light mode)'],
    ...tabActions,
    ['awards-pre',  'Navigate back to Awards tab'],
    ['7-9',         'Awards subtabs (Quarterly/Annual/Club, if present)'],
    ['20',          'Toggle dark mode'],
    ['21',          'Screenshot dashboard (dark mode)'],
    ['22',          'Toggle back to light mode'],
    ['sidebar-22a', 'Collapse sidebar (html.sidebar-collapsed set)'],
    ['sidebar-22b', 'Toggle + sign-out reachable in collapsed state'],
    ['sidebar-22c', 'Re-expand via same toggle (html.sidebar-collapsed cleared)'],
    ['23',          'Open wizard (Select Week renders)'],
    ['23a',         'Wizard has header + main + label/select binding'],
    ['26',          'Close wizard (returns to dashboard)'],
    ...(ROLE === 'agent' ? [['26b', 'Agent wizard write-read-verify (type → save indicator → reload → persist-verify)']] : []),
    ['27',          'Sign out'],
    ['28',          'Verify login redirect'],
  ];
  const completed = allActions.filter(([id]) => actionsCompleted.has(id)).length;

  const lines = [];
  lines.push(`# AgencyTrack Exploration — ${REPORT_LABEL}`);
  lines.push('');
  lines.push(`**Target:** ${BASE_URL}`);
  lines.push(`**Scope:** ${scope}${needsBypass ? ' (bypass cookie wired)' : ''}`);
  lines.push(`**Role:** ${ROLE}`);
  lines.push(`**Date:** ${startedAt.toISOString()}`);
  lines.push(`**Test user:** ${EMAIL}`);
  lines.push('');
  lines.push('## Headline');
  lines.push('');
  const wrcNote = ROLE === 'agent' ? ' Real write-read-verify cycle exercised for agent wizard (type → auto-save → reload → persist-verify).' : '';
  lines.push(`Programmatic walkthrough completed ${completed}/${allActions.length} checks. Exercises tab navigation, dark-mode toggle, wizard open/close, sign out + login redirect, and structural-element verification per tab.${wrcNote} Out-of-scope steps (PDF download, notifications bell, multi-week wizard interstitial flows) require manual verification.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Actions completed: ${completed} / ${allActions.length}`);
  lines.push(`- Console errors captured: ${consoleErrors.length}`);
  lines.push(`- Console warnings captured: ${consoleWarnings.length}`);
  lines.push(`- Network failures: ${networkFailures.length}`);
  lines.push(`- Uncaught rejections: ${uncaughtRejections.length}`);
  lines.push(`- Step failure notes: ${stepNotes.length}`);
  lines.push('');
  lines.push('## Action checklist');
  lines.push('');
  for (const [id, label] of allActions) {
    lines.push(`- [${actionsCompleted.has(id) ? 'x' : ' '}] ${id}. ${label}`);
  }
  lines.push('');
  lines.push('Steps not exercised programmatically (manual / out-of-scope): 11–13 (PDF download), 15b/15c (SubmissionViewer), 17–19 (notifications bell), 24–26.b (B1-specific wizard interstitial flows).');
  lines.push('');
  lines.push('## Console errors');
  lines.push('');
  if (consoleErrors.length === 0) lines.push('None observed (filtered known patterns: AuthContext logging).');
  else                            consoleErrors.forEach((e) => lines.push(`- \`${e}\``));
  lines.push('');
  lines.push('## Console warnings');
  lines.push('');
  if (consoleWarnings.length === 0) lines.push('None observed.');
  else                              consoleWarnings.forEach((w) => lines.push(`- \`${w}\``));
  lines.push('');
  lines.push('## Network failures');
  lines.push('');
  if (networkFailures.length === 0) lines.push('None (excluding known-harmless StrictMode Listen ERR_ABORTED).');
  else                              networkFailures.forEach((n) => lines.push(`- \`${n}\``));
  lines.push('');
  lines.push('## Uncaught rejections');
  lines.push('');
  if (uncaughtRejections.length === 0) lines.push('None.');
  else                                 uncaughtRejections.forEach((r) => lines.push(`- \`${r}\``));
  lines.push('');
  lines.push('## Step failure notes');
  lines.push('');
  if (stepNotes.length === 0) lines.push('None.');
  else                        stepNotes.forEach((s) => lines.push(`- ${s}`));
  lines.push('');
  lines.push('## Screenshots saved');
  lines.push('');
  lines.push(`- \`verification/walk/${REPORT_LABEL}_dashboard-light_${stamp}.png\``);
  lines.push(`- \`verification/walk/${REPORT_LABEL}_dashboard-dark_${stamp}.png\``);
  lines.push('');
  lines.push('## Recommendation');
  lines.push('');
  const allClean =
    consoleErrors.length === 0 &&
    networkFailures.length === 0 &&
    uncaughtRejections.length === 0 &&
    stepNotes.length === 0 &&
    completed === allActions.length;
  if (allClean) {
    lines.push('**PASS** — all programmatic checks completed cleanly. Manual interactive flows (PDF download, notifications, multi-week wizard) remain out of scope for this automated walkthrough.');
  } else {
    lines.push('**REVIEW** — see sections above for specifics.');
  }
  lines.push('');
  lines.push('---');
  lines.push('Generated by `scripts/exploration-walk.cjs`.');

  const outPath = path.resolve(process.cwd(), 'verification', `exploration_${REPORT_LABEL}_${stamp}.md`);
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\nReport saved: ${path.relative(process.cwd(), outPath)}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
