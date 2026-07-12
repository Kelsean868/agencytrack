/**
 * tier2.mjs — VH Run-2 Tier-2 LIVE smoke legs (per-role, value-level).
 * Same contract as tier0.mjs: each leg { id, role, desc, run({browser, shot}) }.
 * PASS = return a detail string · FAIL = throw · SKIP = throw Error('SKIP: …').
 * Fresh context per leg; assertLegHygiene before returning; context closed in finally.
 *
 * Ground-truth selectors/values were probed against the staging deploy
 * (agencytrack-git-staging) on the seed's TT day. Nav model:
 *   • agent          → `agent-tab-*` testids (flat sidebar).
 *   • unit_manager   → flat "both" layout: `nav-*` testids directly (no toggle).
 *   • branch_manager → workspace layout: My Work default; team surfaces
 *                      (team-wars, monthly-recruiting, campaigns, financing)
 *                      live behind the `sidebar-ws-toggle-team` toggle.
 */
import { newLegContext, login, assertLegHygiene, currencyRe } from './vh-helpers.mjs';
import {
  DAILY, W, TODAY, weekLabel, A1_MONTH_ORDER, A1_MONTH_ORDER_LABEL,
  sumDayApiThrough, appsThrough,
} from './expectations.mjs';
import { selectReactOption } from '../lib/walk-helpers.mjs';

// ── tier2-private helpers ─────────────────────────────────────────────────────
const tsel = (id) => `[data-testid="${id}"]`;

async function clickTid(page, id, { timeout = 12_000 } = {}) {
  await page.locator(tsel(id)).first().click({ timeout });
}

async function toggleTeamWorkspace(page) {
  await page.locator(tsel('sidebar-ws-toggle-team')).click({ timeout: 10_000 });
  await page.waitForTimeout(700);
}

/** Read innerText of a scope. Bare 'body'/'main' are element selectors; a raw
 *  CSS selector ([…], '.', '#', or a space) passes through; anything else is a testid. */
async function scopeText(page, scope = 'body') {
  const isCss = scope === 'body' || scope === 'main'
    || /^[.#\[]/.test(scope) || scope.includes(' ');
  const sel = isCss ? scope : tsel(scope);
  return page.locator(sel).first().innerText();
}

/** Assert a regex hits within a scope's text; throws with the actual snippet. */
async function mustText(page, re, label, scope = 'body') {
  const txt = await scopeText(page, scope);
  if (!re.test(txt)) {
    throw new Error(`${label}: /${re.source}/ not found. Got: "${txt.replace(/\s+/g, ' ').slice(0, 240)}"`);
  }
  return txt;
}

/** Navigate an agent surface and wait for a readiness testid. */
async function gotoAgent(page, tabTestid, readyTestid, timeout = 15_000) {
  await clickTid(page, tabTestid);
  await page.locator(tsel(readyTestid)).first().waitFor({ state: 'attached', timeout });
  await page.waitForTimeout(600);
}

export const LEGS = [
  // ── 1. WAR review round-trip AS UPLINE (mutates review fields; re-seed resets) ──
  {
    id: 't2-war-review-roundtrip',
    role: 'branch_manager+unit_manager',
    desc: 'BM approves UM 2026-06-28 WAR (+note) then requests changes on UM 2026-06-21; re-reads pills. '
      + 'UM my-war shows the review + has NO self-review controls (owner self-review denied). MUTATES managerWeeklyReports review fields.',
    async run({ browser, shot }) {
      const APPROVE_NOTE = 'VH upline review — strong week, approved.';
      const CHANGES_NOTE = 'VH upline review — please revise the fact-find counts.';
      const bm = await newLegContext(browser);
      try {
        const p = bm.page;
        await login(p, 'branch_manager');
        await toggleTeamWorkspace(p);
        await clickTid(p, 'nav-team-wars');
        await p.locator(tsel('war-header-strip')).waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(800);

        // ── Approve UM's W(-1)=2026-06-28 WAR ──
        await selectReactOption(p, p.locator('select').first(), W(-1));
        await p.waitForTimeout(1500);
        await p.locator('button', { hasText: 'Staging Unit Manager' }).first().click({ timeout: 10_000 });
        await p.locator(tsel('war-review-controls')).waitFor({ state: 'visible', timeout: 12_000 });
        await p.locator(`${tsel('war-review-controls')} textarea`).fill(APPROVE_NOTE);
        await p.getByRole('button', { name: /Approve WAR/i }).click();
        await p.locator(tsel('war-review-state')).waitFor({ state: 'visible', timeout: 12_000 });
        await p.waitForTimeout(600);
        await mustText(p, /Approved/i, 'BM approve → pill', 'war-review-state');
        await mustText(p, /Reviewed by Staging Branch Manager/i, 'BM approve → reviewer name', 'war-review-state');
        await shot(p, 't2-war-approved');

        // ── Request changes on UM's W(-2)=2026-06-21 WAR ──
        // Return to the list via the detail's Back control (re-clicking the nav is
        // a no-op — activeTab is already 'team-wars', so it never remounts).
        await p.locator('button[aria-label="Back to list"]').click({ timeout: 8000 });
        await p.locator(tsel('war-header-strip')).waitFor({ state: 'attached', timeout: 12_000 });
        await p.waitForTimeout(600);
        await selectReactOption(p, p.locator('select').first(), W(-2));
        await p.waitForTimeout(1500);
        await p.locator('button', { hasText: 'Staging Unit Manager' }).first().click({ timeout: 10_000 });
        await p.locator(tsel('war-review-controls')).waitFor({ state: 'visible', timeout: 12_000 });
        await p.locator(`${tsel('war-review-controls')} textarea`).fill(CHANGES_NOTE);
        await p.getByRole('button', { name: /Request changes/i }).click();
        await p.locator(tsel('war-review-state')).waitFor({ state: 'visible', timeout: 12_000 });
        await p.waitForTimeout(600);
        await mustText(p, /Changes requested/i, 'BM request-changes → pill', 'war-review-state');
        await shot(p, 't2-war-changes');
        assertLegHygiene(bm);
      } finally {
        await bm.context.close();
      }

      // ── UM side: own my-war surfaces the upline review (F9) + NO self-review controls ──
      // F9 flipped the former "pill ABSENT (finding)" note into hard assertions:
      // the owner's my-war MUST render the review pill + reviewer name for the
      // approved week, and the note-disclosure affordance MUST reveal the note
      // text for the changes-requested week. Self-review-denied assertion kept.
      const um = await newLegContext(browser);
      try {
        const p = um.page;
        await login(p, 'unit_manager');
        await clickTid(p, 'nav-my-war');
        await p.locator('select').first().waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(800);

        // W(-1)=2026-06-28 (approved): pill + reviewer name (F9 hard assert).
        await selectReactOption(p, p.locator('select').first(), W(-1));
        await p.waitForTimeout(1800);
        // Required WRITE-DENIED assertion (unchanged): owner cannot self-review → controls absent.
        const controls = await p.locator(tsel('war-review-controls')).count();
        if (controls > 0) throw new Error('SELF-REVIEW LEAK: war-review-controls rendered on UM own WAR (owner should be denied review).');
        await p.locator(tsel('my-war-review-state')).waitFor({ state: 'visible', timeout: 12_000 });
        await mustText(p, /Approved/i, 'UM my-war approved → pill', 'my-war-review-state');
        await mustText(p, /Reviewed by Staging Branch Manager/i, 'UM my-war approved → reviewer name', 'my-war-review-state');

        // Item E — My WAR hero (MyWarCard conformance): structure + deterministic
        // own-production for W(-1) (seed UM_WEEKS = api 5,200 / apps 1).
        await p.locator(tsel('my-war-hero')).waitFor({ state: 'visible', timeout: 12_000 });
        await mustText(p, /MY API/i, 'UM my-war hero → API label', 'my-war-hero');
        await mustText(p, /APPLICATIONS/i, 'UM my-war hero → apps label', 'my-war-hero');
        await mustText(p, /FILING STREAK/i, 'UM my-war hero → streak label', 'my-war-hero');
        await p.locator(tsel('war-streak-dots')).waitFor({ state: 'visible', timeout: 8000 });
        await p.locator(tsel('my-war-hero-api')).waitFor({ state: 'visible', timeout: 12_000 });
        await p.waitForTimeout(1200); // let the API count-up settle to the exact seed value
        await mustText(p, /TTD\s*5,200/, 'UM my-war hero → API value W(-1)', 'my-war-hero-api');
        await mustText(p, /^\s*1\s*$/, 'UM my-war hero → apps value W(-1)', 'my-war-hero-apps');
        await shot(p, 't2-war-um-side');

        // W(-2)=2026-06-21 (changes requested): pill + note affordance reveals the note (F9 hard assert).
        await selectReactOption(p, p.locator('select').first(), W(-2));
        await p.waitForTimeout(1800);
        await p.locator(tsel('my-war-review-state')).waitFor({ state: 'visible', timeout: 12_000 });
        await mustText(p, /Changes requested/i, 'UM my-war changes → pill', 'my-war-review-state');

        // Item E — hero own-production for W(-2) (seed UM_WEEKS = api 7,500 / apps 2).
        await p.locator(tsel('my-war-hero-api')).waitFor({ state: 'visible', timeout: 12_000 });
        await p.waitForTimeout(1200);
        await mustText(p, /TTD\s*7,500/, 'UM my-war hero → API value W(-2)', 'my-war-hero-api');
        await mustText(p, /^\s*2\s*$/, 'UM my-war hero → apps value W(-2)', 'my-war-hero-apps');
        // The leader's note sits behind a disclosure affordance — click to reveal, then assert the text.
        await p.locator(tsel('my-war-review-note-toggle')).click({ timeout: 8000 });
        await p.locator(tsel('my-war-review-note')).waitFor({ state: 'visible', timeout: 8000 });
        const noteRe = new RegExp(CHANGES_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        await mustText(p, noteRe, 'UM my-war changes → note revealed', 'my-war-review-note');
        await shot(p, 't2-war-um-changes');
        assertLegHygiene(um);
      } finally {
        await um.context.close();
      }
      return 'BM approved UM 06-28 (+reviewer name) & requested-changes UM 06-21 — both pills re-read; '
        + 'UM my-war: self-review controls ABSENT (denied); owner review pill + reviewer name shown for the '
        + 'approved week; changes-requested note affordance reveals the note text; '
        + 'My WAR hero (item E) renders the MY API/APPLICATIONS/FILING STREAK metric row with the seed '
        + 'own-production values (W-1 5,200/1, W-2 7,500/2).';
    },
  },

  // ── 2. Recruiting kanban write-read (mutates vhfix-rec-1; re-seed resets) ──
  {
    id: 't2-recruiting-kanban',
    role: 'branch_manager',
    desc: "BM Recruiting: Nadia Mohammed shows STALLED (>14d); advance Anil Maharaj sourced→contacted via drill; reload → stage persisted in Contacted column. MUTATES recruitingCandidates/vhfix-rec-1.",
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'branch_manager');
        await toggleTeamWorkspace(p);
        await clickTid(p, 'nav-monthly-recruiting');
        await p.locator(tsel('rec-board')).waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(900);

        // STALLED badge on Nadia (BM-owned; UM would not see her).
        await mustText(p, /Nadia Mohammed/, 'Nadia present', 'rec-board');
        await mustText(p, /stalled/i, 'STALLED badge rendered', 'rec-board');
        await mustText(p, /\b1\b/, 'stalled funnel count = 1', 'rec-funnel-stalled');

        // Advance Anil sourced → contacted via the drill.
        await p.locator(tsel('rec-candidate-card'), { hasText: 'Anil Maharaj' }).first().click({ timeout: 10_000 });
        await p.locator(tsel('rec-drill-drawer')).waitFor({ state: 'visible', timeout: 10_000 });
        await mustText(p, /Advance to/i, 'advance CTA present', 'rec-drill-drawer');
        await clickTid(p, 'rec-advance-btn');
        await p.waitForTimeout(2000);
        // Close drawer if still open, then reload the board.
        await p.keyboard.press('Escape').catch(() => {});
        await p.waitForTimeout(500);
        await clickTid(p, 'nav-monthly-recruiting');
        await p.locator(tsel('rec-board')).waitFor({ state: 'attached', timeout: 12_000 });
        await p.waitForTimeout(1200);

        // Re-read: Anil now under the Contacted column (was "Empty" pre-advance).
        const contactedCol = p.locator('[aria-label^="Contacted"]').first();
        await contactedCol.waitFor({ state: 'attached', timeout: 8000 });
        const colTxt = await contactedCol.innerText();
        if (!/Anil Maharaj/.test(colTxt)) {
          await shot(p, 'FAIL-t2-recruiting-kanban');
          throw new Error(`stage did not persist: Anil not in Contacted column after reload. Column="${colTxt.replace(/\s+/g, ' ').slice(0, 160)}"`);
        }
        await shot(p, 't2-recruiting-advanced');
        assertLegHygiene(ctx);
        return 'Nadia STALLED (funnel=1) verified; Anil advanced sourced→contacted, persisted in Contacted column after reload.';
      } finally {
        await ctx.context.close();
      }
    },
  },

  // ── 3. Settings round-trip (mutates device-local prefs; restored in-leg) ──
  {
    id: 't2-settings-roundtrip',
    role: 'agent1',
    desc: 'Agent Settings: theme Light→Dark applies html.dark + persists across reload; default-period Week→Month persists across reload (aria-selected). Both restored. Device-local (localStorage) — no Firestore mutation.',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        await p.locator('button[aria-label="Settings"]').click({ timeout: 12_000 });
        await p.locator(tsel('settings-theme-dark')).waitFor({ state: 'visible', timeout: 12_000 });

        const isDark = () => p.evaluate(() => document.documentElement.classList.contains('dark'));
        if (await isDark()) throw new Error('precondition: fresh context booted dark (expected light default).');

        // Theme → Dark, assert applied, reload, assert persisted.
        await clickTid(p, 'settings-theme-dark');
        await p.waitForTimeout(500);
        if (!(await isDark())) throw new Error('theme: html.dark not applied after selecting Dark.');
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
        await p.waitForTimeout(800);
        if (!(await isDark())) throw new Error('theme: html.dark NOT persisted after reload (localStorage round-trip failed).');
        await shot(p, 't2-settings-dark');

        // Re-open settings; default-period Week → Month, reload, assert persisted via aria-selected.
        await p.locator('button[aria-label="Settings"]').click({ timeout: 12_000 });
        await p.locator(tsel('settings-period-month')).waitFor({ state: 'visible', timeout: 12_000 });
        await clickTid(p, 'settings-period-month');
        await p.waitForTimeout(1200);
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
        await p.waitForTimeout(800);
        await p.locator('button[aria-label="Settings"]').click({ timeout: 12_000 });
        await p.locator(tsel('settings-period-month')).waitFor({ state: 'visible', timeout: 12_000 });
        // SegmentedControl radios use role="radio" aria-checked (NOT aria-selected).
        const monthSel = await p.locator(tsel('settings-period-month')).getAttribute('aria-checked');
        if (monthSel !== 'true') throw new Error(`period: Month not persisted (aria-checked=${monthSel}) after reload.`);

        // Restore defaults (Light + Week).
        await clickTid(p, 'settings-period-week');
        await clickTid(p, 'settings-theme-light');
        await p.waitForTimeout(400);
        if (await isDark()) throw new Error('restore: html.dark still set after selecting Light.');
        assertLegHygiene(ctx);
        return 'Theme Dark applied + persisted across reload; default-period Month persisted (aria-checked); both restored to Light/Week.';
      } finally {
        await ctx.context.close();
      }
    },
  },

  // ── 4. PDF download CTAs (no byte diff — busy/download-event only) ──
  {
    id: 't2-pdf-download-ctas',
    role: 'agent1',
    desc: 'Agent Report tab Download PDF: enabled → click → generation starts (Generating… busy state or download event). Best-effort BM Team Reports PDF spot-check.',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      let bmNote = 'manager PDF: not attempted';
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        await gotoAgent(p, 'agent-tab-report', 'agent-report-download');
        const btn = p.locator(tsel('agent-report-download'));
        if (await btn.isDisabled()) throw new Error('agent report Download PDF button is disabled at rest.');
        // Download PDF opens the "Generate Performance Report" range modal (ReportRangeModal).
        await btn.click();
        await p.getByRole('heading', { name: /Generate Performance Report/i }).waitFor({ state: 'visible', timeout: 10_000 });
        // Confirm the default range → generation starts (busy state) and a download fires.
        await p.getByRole('button', { name: /Generate & ?Download/i }).click({ timeout: 8000 });
        const outcome = await Promise.any([
          p.getByText(/Generating/i).first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'busy(Generating…)'),
          p.waitForEvent('download', { timeout: 15_000 }).then(() => 'download-event'),
        ]).catch(() => null);
        if (!outcome) throw new Error('agent PDF: neither Generating… busy state nor a download event fired within 15s after Generate & Download.');
        await shot(p, 't2-pdf-agent');
        assertLegHygiene(ctx);
      } finally {
        await ctx.context.close();
      }

      // Best-effort manager-side spot-check (does not fail the leg).
      const bm = await newLegContext(browser);
      try {
        const p = bm.page;
        await login(p, 'branch_manager');
        await toggleTeamWorkspace(p);
        await clickTid(p, 'nav-production-report');
        const mbtn = p.locator(tsel('agent-production-download')).first();
        if (await mbtn.count() && !(await mbtn.isDisabled().catch(() => true))) {
          await mbtn.click();
          // May open the same range modal — confirm it if present.
          const heading = p.getByRole('heading', { name: /Generate Performance Report/i });
          if (await heading.isVisible({ timeout: 4000 }).catch(() => false)) {
            await p.getByRole('button', { name: /Generate & ?Download/i }).click({ timeout: 6000 }).catch(() => {});
          }
          const ok = await Promise.any([
            p.getByText(/Generating|Preparing/i).first().waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'busy'),
            p.waitForEvent('download', { timeout: 10_000 }).then(() => 'download'),
          ]).catch(() => null);
          bmNote = ok ? `manager Team Reports PDF: ${ok}` : 'manager PDF: CTA clicked, no busy/download signal (finding)';
        } else {
          bmNote = 'manager PDF: Team Reports download CTA not present/enabled';
        }
      } catch (e) {
        bmNote = `manager PDF: spot-check errored (${String(e.message).slice(0, 60)})`;
      } finally {
        await bm.context.close();
      }
      return `Agent Report Download PDF fired generation (busy/download). ${bmNote}.`;
    },
  },

  // ── 5. History drill + edit path ──
  {
    id: 't2-history-edit-path',
    role: 'agent1',
    desc: 'Agent History: 9 submitted weeks + best week (W(-5), positional — the seed\'s max-API week) + award markers; open the W0 DRAFT row → viewer → Continue editing opens WizardForm on that week; exit without submitting. NOTE: Continue-editing may autosave the (already-draft) week.',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        await clickTid(p, 'agent-tab-history');
        await p.getByText(/WEEKS SUBMITTED/i).first().waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(1000);

        // Value-level header rollups + the best-week row (values render COMPACT, e.g. "TTD 22K").
        await mustText(p, /9\s*OF\s*52\s*WEEKS\s*SUBMITTED/i, 'submitted-count header');
        await mustText(p, /TTD\s*122K/i, 'YTD API compact');
        await mustText(p, /BEST WEEK/i, 'best-week marker');
        // Best week is the seed's positional max — W(-5) @ 22,000 (seed-fixtures.mjs
        // A1_WEEKS: w:-5 is the only entry annotated "best week"). Its calendar date
        // (and therefore its "Sun DD Mon" aria-label) shifts as TODAY advances, so
        // the label is derived via weekLabel() (mirrors HistoryTab.jsx's own
        // formatter) rather than hardcoded to a specific date.
        const bestWeekLabel = weekLabel(W(-5));
        const bestRow = p.locator(`[aria-label="Open submission from ${bestWeekLabel}"]`);
        await bestRow.waitFor({ state: 'attached', timeout: 8000 });
        const bestTxt = await bestRow.innerText();
        if (!/★?\s*BEST WEEK/i.test(bestTxt) || !/TTD\s*22K/i.test(bestTxt)) {
          throw new Error(`best-week row mismatch: "${bestTxt.replace(/\s+/g, ' ').slice(0, 120)}"`);
        }

        // Open the DRAFT (W0) row → read-only viewer showing that week.
        const draftLabel = weekLabel(W(0));
        await p.locator(`[aria-label="Open submission from ${draftLabel}"]`).click({ timeout: 8000 });
        await p.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 10_000 });
        await mustText(p, new RegExp(W(0)), 'viewer week identity', '[role="dialog"]');
        await mustText(p, /DRAFT/i, 'viewer draft status', '[role="dialog"]');

        // Continue editing → WizardForm (wizard-v2-modal) opens ON that week.
        await p.getByRole('button', { name: /Continue editing/i }).click({ timeout: 8000 });
        await p.locator(tsel('wizard-v2-modal')).waitFor({ state: 'visible', timeout: 12_000 });
        await p.waitForTimeout(800);
        await shot(p, 't2-history-wizard');

        // Exit WITHOUT submitting (close the wizard; never touch week-confirm-next).
        const closeBtn = p.locator(tsel('wizard-v2-close')).first();
        if (await closeBtn.count()) await closeBtn.click({ timeout: 6000 });
        else await p.keyboard.press('Escape');
        await p.waitForTimeout(1000);
        assertLegHygiene(ctx);
        return `9 submitted weeks + best-week ${W(-5)} (${bestWeekLabel}, TTD 22K) verified; draft row ${W(0)} → viewer → Continue editing opened WizardForm on that week; exited without submitting.`;
      } finally {
        await ctx.context.close();
      }
    },
  },

  // ── 6. Awards pace narrative ──
  {
    id: 't2-awards-pace-line',
    role: 'agent1',
    desc: 'Agent Awards: open an annual award drill → "Your pace" narrative renders seeded gap (TTD 128,000 from qualifying) at avg per-week pace derived from YTD 122,000 (TTD 122,000 of TTD 250,000).',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        await gotoAgent(p, 'agent-tab-awards', 'award-card-persistency_silver');
        // Open an annual award whose target is the personal-annual 250,000 (current 122,000 → 49%).
        await clickTid(p, 'award-card-persistency_silver');
        await p.locator(tsel('award-drawer-your-pace')).waitFor({ state: 'visible', timeout: 12_000 });
        const pace = await scopeText(p, 'award-drawer-your-pace');
        // Value-level: seeded gap (250,000 − 122,000 = 128,000) + a TTD/wk rate in a hand-computable band.
        if (!/TTD\s*128,000\s*from qualifying/i.test(pace)) {
          throw new Error(`pace gap mismatch (expected 128,000): "${pace.replace(/\s+/g, ' ').slice(0, 200)}"`);
        }
        const rate = pace.match(/avg pace of\s*TTD\s*([\d,]+(?:\.\d+)?)\/wk/i);
        if (!rate) throw new Error(`pace rate not rendered: "${pace.replace(/\s+/g, ' ').slice(0, 200)}"`);
        const perWk = parseFloat(rate[1].replace(/,/g, ''));
        // 122,000 ÷ weeks-elapsed(~25–28) ⇒ ~4,350–4,900/wk. Assert the hand-computable band.
        if (!(perWk > 3800 && perWk < 5400)) {
          throw new Error(`pace rate ${perWk}/wk outside hand-computable band (122,000 ÷ elapsed weeks ≈ 4,350–4,900).`);
        }
        // Cross-check the drawer shows the seeded YTD 122,000 vs 250,000.
        await mustText(p, currencyRe(122000), 'drawer YTD 122,000', '[role="dialog"]');
        await mustText(p, currencyRe(250000), 'drawer target 250,000', '[role="dialog"]');
        await shot(p, 't2-awards-pace');
        assertLegHygiene(ctx);
        return `Awards pace narrative: TTD 128,000 gap · avg TTD ${perWk}/wk (band-checked vs 122,000÷elapsed) · YTD 122,000 of 250,000.`;
      } finally {
        await ctx.context.close();
      }
    },
  },

  // ── 7. Financing K9 (agent self-view) + K7 (BM roster at-risk) ──
  {
    id: 't2-financing-k9-k7',
    role: 'agent1+branch_manager',
    desc: 'Agent Financing: PaydownArcHero balance TTD 11,000 + projection (~3 months / Sep 2026). BM Financing Risk roster: Staging Agent Two chip AT RISK (2 consecutive misses + −15% adj flag).',
    async run({ browser, shot }) {
      // K9 — agent self-view.
      const a1 = await newLegContext(browser);
      try {
        const p = a1.page;
        await login(p, 'agent1');
        await gotoAgent(p, 'agent-tab-financing', 'fsv-paydown-hero');
        try {
          await mustText(p, currencyRe(11000), 'K9 current balance 11,000', 'fsv-paydown-now');
          // Projection present (declining ledger → clear-month rendered).
          await mustText(p, /clear it in about|PROJECTED CLEAR|months?/i, 'K9 projection narrative', 'fsv-paydown-hero');
          await mustText(p, /SEP 2026|Sep 2026/i, 'K9 projected clear month', 'fsv-paydown-hero');
        } catch (e) {
          await shot(p, 'FAIL-t2-financing-k9');
          throw e;
        }
        await shot(p, 't2-financing-k9');
        assertLegHygiene(a1);
      } finally {
        await a1.context.close();
      }

      // K7 — BM risk roster.
      const bm = await newLegContext(browser);
      try {
        const p = bm.page;
        await login(p, 'branch_manager');
        await toggleTeamWorkspace(p);
        await clickTid(p, 'nav-financing');
        await p.locator(tsel('financing-subview-risk')).waitFor({ state: 'visible', timeout: 15_000 });
        await clickTid(p, 'financing-subview-risk');
        const riskPanel = p.locator(tsel('financing-risk-panel'));
        await riskPanel.waitFor({ state: 'attached', timeout: 12_000 });
        try {
          // Known flake: the panel shell (financing-risk-panel) can attach on
          // first paint before its async-fetched roster rows land — a fixed
          // post-navigation timeout races that fetch. Explicitly await the K7
          // roster ROW itself (Staging Agent Two) with a generous timeout so
          // the assertions below run against real content, not first paint.
          await riskPanel.getByText(/Staging Agent Two/i).first()
            .waitFor({ state: 'attached', timeout: 20_000 });
          await mustText(p, /Staging Agent Two/, 'K7 at-risk agent', 'financing-risk-panel');
          await mustText(p, /at\s*risk/i, 'K7 AT RISK chip', 'financing-risk-panel');
          await mustText(p, /\b1\b/, 'K7 at-risk count = 1', 'frp-at-risk');
          await mustText(p, /2 consecutive misses|2 misses/i, 'K7 two-miss monitor', 'financing-risk-panel');
          await mustText(p, /−?-?15%|15%/, 'K7 −15% adjustment flag', 'financing-risk-panel');
        } catch (e) {
          await shot(p, 'FAIL-t2-financing-k7');
          throw e;
        }
        await shot(p, 't2-financing-k7');
        assertLegHygiene(bm);
      } finally {
        await bm.context.close();
      }
      return 'K9 agent balance TTD 11,000 + projection Sep 2026 verified; K7 BM roster: Staging Agent Two AT RISK (2 misses + −15% adj flag), at-risk count 1.';
    },
  },

  // ── 8. Campaign standings — KEY value-level assertions of this tier ──
  {
    id: 't2-campaign-standings',
    role: 'branch_manager',
    desc: "BM Campaigns: expand 'Staging Sprint — Qualify' → agent-1 API 122,000 + tier Gold + projected TTD 12,500 (cash 10,000 + voucher 2,500 combined, ×1.0 gate); expand 'Staging Placement Dash' → agent-2 projected TTD 375 (1,500 ×0.25 gate).",
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'branch_manager');
        await toggleTeamWorkspace(p);
        await clickTid(p, 'nav-campaigns');
        await p.getByText(/Staging Sprint — Qualify/i).first().waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(800);

        // Expand Qualify and read LIVE STANDINGS for Staging Agent One.
        await p.getByRole('button', { name: /Staging Sprint — Qualify/i }).first().click({ timeout: 10_000 });
        await p.waitForTimeout(2000);
        const qualifyTxt = await scopeText(p, 'main');
        const a1Gold = /Staging Agent One[\s\S]{0,140}\bGold\b/i.test(qualifyTxt);
        // Standings PROJECTED combines cash + voucher (10,000 + 2,500), both
        // gate-scaled ×1.0 — assert API 122,000 and the combined 12,500.
        const a1Api = /Staging Agent One[\s\S]{0,140}TTD\s*122,000/i.test(qualifyTxt);
        const a1Payout = a1Api && /Staging Agent One[\s\S]{0,260}TTD\s*12,500/i.test(qualifyTxt);

        // Expand Placement and read agent-2 projected 375.
        await p.getByRole('button', { name: /Staging Placement Dash/i }).first().click({ timeout: 10_000 }).catch(() => {});
        await p.waitForTimeout(2000);
        const placementTxt = await scopeText(p, 'main');
        const a2Payout = /Staging Agent Two[\s\S]{0,200}TTD\s*375\b/i.test(placementTxt);

        if (!(a1Gold && a1Payout && a2Payout)) {
          await shot(p, 'FAIL-t2-campaign-standings');
          const stand = (placementTxt.match(/LIVE STANDINGS[\s\S]{0,600}/i)?.[0]
            ?? qualifyTxt.match(/LIVE STANDINGS[\s\S]{0,600}/i)?.[0] ?? qualifyTxt.slice(0, 400))
            .replace(/\s+/g, ' ').slice(0, 400);
          const consoleErrs = ctx.capture.consoleMessages.filter((m) => m.type === 'error').map((m) => m.text.slice(0, 160));
          const netFails = ctx.capture.networkFailures.map((n) => `${n.failure}:${n.url.slice(0, 100)}`);
          throw new Error(
            `CAMPAIGN STANDINGS BUG — expected: agent-1 API 122,000 + Gold + projected 12,500 (got Gold=${a1Gold}, projected=${a1Payout}); `
            + `agent-2 TTD 375 (got=${a2Payout}). Standings="${stand}". `
            + `console.errors=${JSON.stringify(consoleErrs)}; network.failures=${JSON.stringify(netFails)}.`,
          );
        }
        await shot(p, 't2-campaign-standings');
        assertLegHygiene(ctx);
        return 'Qualify: agent-1 API 122,000 / Gold / projected TTD 12,500 (10,000 cash + 2,500 voucher, ×1.0 gate); Placement: agent-2 TTD 375 (1,500 ×0.25 gate) — standings verified.';
      } finally {
        await ctx.context.close();
      }
    },
  },

  // ── 9. Daily anchor strip + streak-celebration semantics ──
  {
    id: 't2-daily-anchor-strip',
    role: 'agent1',
    desc: 'Agent Daily Log, weekday (dow>=1): anchor strip renders weekly API floor TTD 4,800 and WTD = sum of seeded dailyActivity docs (A1b family, DAILY.wtd). Celebration asserted absent unless DAILY.milestoneReachable. On Sunday (dow===0): DailyCaptureV2 gates the anchor strip off entirely (`{!isTodaySunday && <DailyAnchorStrip/>}`, DailyCaptureV2.jsx:906-913) and renders SundayConfirmView (completed-week rollup) instead — asserted as the TRUE Sunday state (strip genuinely absent by design, not a bug), plus the honest zero rollup (seed-fixtures A1b\'s daily-doc loop is a no-op on a Sunday run: `for (dow=1; dow<getUTCDay(); dow++)` never executes when getUTCDay()===0).',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        await clickTid(p, 'agent-tab-daily-log');

        const dow = new Date(`${TODAY}T12:00:00Z`).getUTCDay();
        if (dow === 0) {
          // Sunday: no anchor strip — DailyCaptureV2 renders "Review week" +
          // SundayConfirmView (a read-only rollup of the COMPLETED PRIOR week,
          // not the just-started current week) instead of the Mon-Sat logging
          // form. Wait on that heading rather than the (never-mounted)
          // anchor-strip testid.
          await p.getByText(/Review week/i).first().waitFor({ state: 'visible', timeout: 15_000 });
          await p.waitForTimeout(800);
          if (await p.locator(tsel('dcv2-anchor-strip')).count()) {
            throw new Error('dcv2-anchor-strip unexpectedly present on Sunday (DailyCaptureV2 gates it off via isTodaySunday — check for regression).');
          }
          const bodyTxt = (await scopeText(p, 'body')).replace(/\s+/g, ' ');
          if (!/Your week from daily logs/i.test(bodyTxt)) {
            throw new Error(`SundayConfirmView heading not found. Got: "${bodyTxt.slice(0, 240)}"`);
          }
          // The completed-prior-week rollup is NOT necessarily zero — A1b
          // writes CONSECUTIVE weekdays starting Monday, and residue from
          // whatever day the seed last ran can leave 0-6 days logged in that
          // week. Read the LIVE "Days logged" count N and derive the expected
          // API/apps sum from N via the shared DAY_API model (sumDayApiThrough/
          // appsThrough) rather than assuming a fixed day-count or amount.
          const daysMatch = bodyTxt.match(/Days logged\s*(\d+)\s*\/\s*5/i);
          if (!daysMatch) {
            throw new Error(`SundayConfirmView "Days logged" row not found. Got: "${bodyTxt.slice(0, 240)}"`);
          }
          const n = Number(daysMatch[1]);
          const expectedApi = sumDayApiThrough(n);
          const expectedApps = appsThrough(n);
          const expectedFfiCi = n; // A1b seeds ffiConducted=1, ciConducted=1 per day
          if (!new RegExp(`FFIs conducted\\D{0,10}${expectedFfiCi}\\b`, 'i').test(bodyTxt)) {
            throw new Error(`SundayConfirmView FFIs conducted mismatch (expected ${expectedFfiCi} for N=${n} days). Got: "${bodyTxt.slice(0, 240)}"`);
          }
          if (!new RegExp(`CIs conducted\\D{0,10}${expectedFfiCi}\\b`, 'i').test(bodyTxt)) {
            throw new Error(`SundayConfirmView CIs conducted mismatch (expected ${expectedFfiCi} for N=${n} days). Got: "${bodyTxt.slice(0, 240)}"`);
          }
          if (!new RegExp(`Apps written\\D{0,10}${expectedApps}\\b`, 'i').test(bodyTxt)) {
            throw new Error(`SundayConfirmView Apps written mismatch (expected ${expectedApps} for N=${n} days). Got: "${bodyTxt.slice(0, 240)}"`);
          }
          if (!currencyRe(expectedApi).test(bodyTxt)) {
            throw new Error(`SundayConfirmView API rollup mismatch (expected TTD ${expectedApi.toLocaleString('en-US')} for N=${n} days, per DAY_API[1..${n}]). Got: "${bodyTxt.slice(0, 240)}"`);
          }
          if (await p.locator(tsel('daily-streak-celebration')).count()) {
            throw new Error('unexpected streak celebration on Sunday review.');
          }
          await shot(p, 't2-daily-anchor');
          assertLegHygiene(ctx);
          return `Sunday state (dow=0): dcv2-anchor-strip correctly ABSENT (DailyCaptureV2 gates it off via isTodaySunday); SundayConfirmView rendered instead ("Review week" + completed-prior-week rollup: ${n}/5 days logged, API TTD ${expectedApi.toLocaleString('en-US')}, apps ${expectedApps}, FFI/CI ${expectedFfiCi} each — all derived from N via the shared DAY_API model); celebration correctly absent.`;
        }

        // Weekday path (dow>=1) — unchanged behavior/assertions.
        await p.locator(tsel('dcv2-anchor-strip')).waitFor({ state: 'visible', timeout: 15_000 });
        await p.waitForTimeout(800);

        // Weekly API floor (seed weeklyActivityFloors.api = 4800) — exact value assertion.
        await mustText(p, currencyRe(4800), 'weekly API floor 4,800', 'dcv2-anchor-strip');
        // WTD sums daily-capture docs; seed created none ⇒ honest 0 (data-wtd-api="0").
        const wtd = await p.locator(tsel('dcv2-anchor-strip')).getAttribute('data-wtd-api');
        if (wtd !== String(DAILY.wtd)) {
          throw new Error(`daily anchor WTD expected ${DAILY.wtd} (A1b seeded daily docs), got data-wtd-api="${wtd}".`);
        }
        // Fire-once semantics: no celebration overlay on open.
        if (await p.locator(tsel('daily-streak-celebration')).count()) {
          throw new Error('unexpected streak celebration on open (should only fire post-save at a milestone).');
        }
        // Reload → still no celebration (fire-once holds; nothing to re-fire).
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
        await p.waitForTimeout(1200);
        if (await p.locator(tsel('daily-streak-celebration')).count()) {
          throw new Error('streak celebration appeared after reload (should not fire from seeded state).');
        }
        await shot(p, 't2-daily-anchor');
        assertLegHygiene(ctx);
        return `Daily anchor strip: floor TTD 4,800 + WTD ${DAILY.wtd} (${DAILY.days} seeded daily docs); celebration correctly absent on open+reload (streak-if-logged-today=${DAILY.streakAfterLoggingToday}, milestone 5 unreachable today).`;
      } finally {
        await ctx.context.close();
      }
    },
  },

  // ── 10. Game-plan hub (AllocationBar + MiniMonthStrip seeded actuals) ──
  {
    id: 't2-game-plan-hub',
    role: 'agent1',
    desc: 'Agent Game Plan: AllocationBar legend Life 60% / A&H 20% / General 20% (150k/50k/50k) + API commitment TTD 250,000 + monthly target TTD 20,833; MiniMonthStrip bar heights reflect seeded actuals, ranked by A1_MONTH_ORDER (computed from the positional A1_WEEKS model — the calendar months + rank shift as TODAY advances, so this is NOT a fixed May>June>July shape).',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        await gotoAgent(p, 'agent-tab-game-plan', 'game-plan-hub');
        await p.locator(tsel('cascade-allocation-bar')).waitFor({ state: 'attached', timeout: 12_000 });
        await p.waitForTimeout(800);

        // AllocationBar legend proportions (life 60 / ah 20 / general 20).
        await mustText(p, /60%/, 'allocation Life 60%', 'cascade-alloc-legend-life');
        await mustText(p, /20%/, 'allocation A&H 20%', 'cascade-alloc-legend-ah');
        await mustText(p, /20%/, 'allocation General 20%', 'cascade-alloc-legend-general');
        // API commitment + monthly target (250,000 / 20,833).
        await mustText(p, currencyRe(250000), 'API commitment 250,000', 'game-plan-hub');
        await mustText(p, /20,833/, 'monthly target 20,833', 'game-plan-hub');

        // MiniMonthStrip: seeded monthly buckets are height-only bars (aria-hidden, no text).
        // Value-level check via relative heights, ranked by the POSITIONAL model
        // (A1_MONTH_ORDER — derived from A1_WEEKS grouped by each W(k)'s calendar
        // month; see expectations.mjs). Which months are highest is NOT assumed —
        // it's computed fresh each run, since W(k) crosses month boundaries as
        // TODAY advances (the prior May>June>July hardcode broke on rollover).
        const h = async (i) => {
          const style = await p.locator(tsel(`cascade-month-${i}`)).getAttribute('style');
          const m = (style || '').match(/height:\s*([\d.]+)%/);
          return m ? parseFloat(m[1]) : NaN;
        };
        const heights = {};
        for (const idx of A1_MONTH_ORDER) heights[idx] = await h(idx);
        for (let i = 0; i < A1_MONTH_ORDER.length - 1; i++) {
          const a = A1_MONTH_ORDER[i], b = A1_MONTH_ORDER[i + 1];
          if (!(heights[a] > heights[b])) {
            throw new Error(
              `MiniMonthStrip heights not monotonic for seeded actuals: `
              + `cascade-month-${a}=${heights[a]}% cascade-month-${b}=${heights[b]}% `
              + `(expected desc order per computed buckets: ${A1_MONTH_ORDER_LABEL}).`,
            );
          }
        }
        await shot(p, 't2-game-plan');
        assertLegHygiene(ctx);
        const heightsStr = A1_MONTH_ORDER.map((i) => `m${i}=${heights[i]}%`).join(' > ');
        return `Game Plan: AllocationBar 60/20/20 + API 250,000 + monthly 20,833; MiniMonthStrip heights ${heightsStr} (computed bucket order: ${A1_MONTH_ORDER_LABEL}).`;
      } finally {
        await ctx.context.close();
      }
    },
  },

  // ── 11. D2 — Keyboard nav-reorder (Alt+Arrow within-section, aria-live, persists) ──
  // NOTE: this leg exercises the Fable VH D2 keyboard-reorder affordance layered onto
  // the 1.4 Sidebar drag machine. It will FAIL against any staging deploy that predates
  // the D2 push (the deployed Sidebar has no Alt+Arrow handler and no `nav-reorder-live`
  // region, so the move is a no-op). Pre-deploy proof lives in the Sidebar.reorder vitest
  // suite; the orchestrator re-runs this leg post-deploy for the live confirmation.
  {
    id: 't2-d2-keyboard-reorder',
    role: 'agent1',
    desc: 'Agent sidebar keyboard reorder (D2): focus Awards in the Recognition section → Alt+ArrowDown moves it below Career Portal (aria-live announces "position 3 of 3"); FRESH context re-login shows the persisted order (Firestore navOrder reconcile); restored via Alt+ArrowUp. MUTATES prefs/app.navOrder (restored in-leg).',
    async run({ browser, shot }) {
      const AWARDS = 'agent-tab-awards';
      const CAREER = 'agent-tab-career';
      // DOM index of a nav row's button among the rendered sidebar links (-1 if absent).
      const orderIndex = (page, tid) => page.evaluate((id) => {
        const btns = [...document.querySelectorAll('.sidebar-link')];
        return btns.findIndex((b) => b.getAttribute('data-testid') === id);
      }, tid);

      let mover, other; // assigned in the writer context, used by the reader
      // WRITER stays OPEN until the reader confirms persistence — closing it
      // early strands the fire-and-forget navOrder write in its IndexedDB
      // before ACK (the t1-nav-drag-reorder lesson).
      const ctx = await newLegContext(browser);
      let fresh = null;
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        await p.locator(tsel(AWARDS)).first().waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(600);

        // ORDER-RELATIVE design (no absolute precondition): whichever of
        // Awards/Career currently renders FIRST is the mover — immune to
        // navOrder residue from earlier legs.
        const aIdx = await orderIndex(p, AWARDS);
        const cIdx = await orderIndex(p, CAREER);
        if (aIdx < 0 || cIdx < 0) throw new Error(`precondition: Awards/Career rows absent (awards=${aIdx}, career=${cIdx}).`);
        mover = aIdx < cIdx ? AWARDS : CAREER;
        other = aIdx < cIdx ? CAREER : AWARDS;

        // Focus the mover and move it down one slot within its section.
        await p.locator(tsel(mover)).focus();
        await p.keyboard.press('Alt+ArrowDown');
        await p.waitForTimeout(400);

        // aria-live announcement (the D2-specific assertion that fails pre-deploy).
        const live = await p.locator(tsel('nav-reorder-live')).innerText().catch(() => '');
        if (!/moved to position \d+ of \d+ in Recognition/i.test(live)) {
          await shot(p, 'FAIL-t2-d2-keyboard-reorder');
          throw new Error(`D2 aria-live not announced (deploy predates D2?). Got nav-reorder-live="${live.replace(/\s+/g, ' ').slice(0, 160)}".`);
        }
        // Visual order changed: the other row now precedes the mover.
        const moverAfter = await orderIndex(p, mover);
        const otherAfter = await orderIndex(p, other);
        if (!(otherAfter < moverAfter)) {
          throw new Error(`D2 visual reorder did not apply: expected ${other} before ${mover} (got ${otherAfter} vs ${moverAfter}).`);
        }
        await shot(p, 't2-d2-reordered');
        // Writer stays open — give the write time to reach the server.
        await p.waitForTimeout(3000);

        // READER: fresh context, empty localStorage mirror — a persisted order
        // can only come from the Firestore prefs/app.navOrder reconcile.
        fresh = await newLegContext(browser);
        const pf = fresh.page;
        await login(pf, 'agent1');
        await pf.locator(tsel(mover)).first().waitFor({ state: 'attached', timeout: 15_000 });
        await pf.waitForFunction(([m, o]) => {
          const btns = [...document.querySelectorAll('.sidebar-link')];
          const mi = btns.findIndex((b) => b.getAttribute('data-testid') === m);
          const oi = btns.findIndex((b) => b.getAttribute('data-testid') === o);
          return mi >= 0 && oi >= 0 && oi < mi; // other before mover => persisted
        }, [mover, other], { timeout: 15_000 }).catch(() => { throw new Error('D2 persistence: reordered order did not survive a fresh-context re-login (Firestore navOrder reconcile).'); });
        await shot(pf, 't2-d2-persisted');

        // Restore the pre-leg order via keyboard in the reader (both contexts
        // stay open through the flush so the revert write ACKs too).
        await pf.locator(tsel(mover)).focus();
        await pf.keyboard.press('Alt+ArrowUp');
        await pf.waitForFunction(([m, o]) => {
          const btns = [...document.querySelectorAll('.sidebar-link')];
          const mi = btns.findIndex((b) => b.getAttribute('data-testid') === m);
          const oi = btns.findIndex((b) => b.getAttribute('data-testid') === o);
          return mi >= 0 && oi >= 0 && mi < oi; // mover back above other => restored
        }, [mover, other], { timeout: 10_000 }).catch(() => { throw new Error('D2 restore: could not move the row back up.'); });
        await pf.waitForTimeout(4000); // restore-write flush headroom
        assertLegHygiene(fresh);
        assertLegHygiene(ctx);
      } finally {
        if (fresh) await fresh.context.close();
        await ctx.context.close();
      }
      return `D2 keyboard reorder: ${mover} moved down in Recognition (aria-live announced, visual order flipped); persisted to a fresh-context re-login (Firestore navOrder, writer held open); pre-leg order restored.`;
    },
  },

  // ── D1 (VH). Manager mp-game-plan prefetch — extends #829 to producing managers.
  //   Login unit_manager → let the dashboard sit idle (~3s) so the idle-time Game
  //   Plan prefetch (ManagerDashboard.jsx, gated to producing managers) has warmed
  //   the manager's OWN moneyNeeds/yearPlan/monthlyPlan year-docs into the Firestore
  //   cache → open the Game Plan tab → the POPULATED panel (anchor strip + the seeded
  //   yearPlan total TTD 150,000, mirrors EXPECT.goals.umYearPlanTotal) must attach
  //   quickly. game-plan-anchor is one of the inner nodes that pops in on a cold
  //   cache (the #833 finding), so its attachment == real content, not the empty hub
  //   shell. Timing cap is deliberately GENEROUS: prefetch is a warm-cache
  //   optimization, not a hard SLA — the cold (un-prefetched) pop-in the fix targets
  //   still settles ~0.7s, so <2.5s is a regression fence + hygiene check, not a
  //   stopwatch. DEPLOY-GATED: the prefetch path is exercised only against a deploy
  //   that INCLUDES the D1 change — this leg verifies fully after the orchestrator
  //   deploys the staging branch. Against an un-prefetched deploy it still passes
  //   (cold settle is under the cap); the before/after prefetch win is measured by
  //   motion-verifier, not by this leg's wall-clock.
  {
    id: 't2-d1-manager-gameplan-prefetch',
    role: 'unit_manager',
    desc: 'producing-manager Game Plan opens fast + populated (TTD 150,000) after dashboard-idle prefetch; console clean',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'unit_manager');
        // Dashboard idle window: the prefetch fires via requestIdleCallback
        // (timeout 2000ms) / a 400ms setTimeout fallback — 3s covers both plus
        // Firestore listener-warm headroom before we tap Game Plan.
        await p.waitForTimeout(3000);
        const CAP_MS = 2500;
        const t0 = Date.now();
        await clickTid(p, 'nav-mp-game-plan');
        // Populated readiness: wait for game-plan-anchor (a real inner node), not
        // the game-plan-hub shell which attaches even in the empty/loading state.
        await p.locator(tsel('game-plan-anchor')).first()
          .waitFor({ state: 'attached', timeout: 15_000 });
        // Value-level: the seeded yearPlan total must render (populated, not zero-state).
        await mustText(p, currencyRe(150000), 'D1 Game Plan yearPlan total', 'body');
        const elapsed = Date.now() - t0;
        await shot(p, 't2-d1-manager-gameplan');
        if (elapsed > CAP_MS) {
          throw new Error(`D1 Game Plan populated content took ${elapsed}ms (> ${CAP_MS}ms generous cap) — prefetch warm-cache path may be broken.`);
        }
        assertLegHygiene(ctx);
        return `unit_manager Game Plan opened populated (anchor + TTD 150,000 yearPlan total) in ${elapsed}ms (< ${CAP_MS}ms cap); console clean, zero prod requests. NOTE: prefetch path verified only against a deploy INCLUDING the D1 change.`;
      } finally {
        await ctx.context.close();
      }
    },
  },

  // ── F10 (C4). Filing-streak milestone celebration (agent home) ──
  //   The A1 fixture has a 9-week filing streak (9 submitted weekly reports,
  //   W(-9)..W(-1) — seed-fixtures A1_WEEKS). With FILING_WEEKLY_STREAK_MILESTONES
  //   [5, 10, 25, 52] and NO celebratedMax persisted (fresh context = empty
  //   localStorage), opening the home surface fires the milestone-5 takeover.
  //   Device-local only (localStorage marker, per-year) — NOT a Firestore mutation,
  //   and the marker is discarded when the leg's context closes, so the leg is
  //   idempotent across suite runs with no re-seed / reset needed (same class as
  //   t2-settings-roundtrip's device-local state). The in-leg reload proves the
  //   fire-once guarantee (marker persisted within the surviving context).
  {
    id: 't2-filing-streak-milestone',
    role: 'agent1',
    desc: 'Agent home: 9-week filing streak (A1 seeded) crosses milestone 5 → FilingStreakCelebration takeover fires on first load (FILING STREAK · 5 WEEKS); dismiss → gone; reload → stays absent (per-year celebratedMax persisted, fire-once). Device-local localStorage marker only — no Firestore mutation; discarded with the context.',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        // Opt out of the login helper's celebration auto-dismiss — the takeover IS this leg's subject.
        await login(p, 'agent1', { dismissCelebration: false }); // default tab = dashboard (home) where the streak lives
        const takeover = p.locator(tsel('filing-streak-celebration'));

        // Fires on load: the seeded 9-week streak crosses the uncelebrated rung 5.
        await takeover.waitFor({ state: 'visible', timeout: 20_000 });
        await mustText(p, /FILING STREAK.{0,4}5 WEEKS/i, 'filing-streak milestone-5 copy', 'filing-streak-celebration');
        await shot(p, 't2-filing-streak-fired');

        // Dismiss via the primary CTA → takeover unmounts.
        await clickTid(p, 'celebration-primary-cta');
        await takeover.waitFor({ state: 'detached', timeout: 8_000 });

        // Reload: the per-year celebratedMax (now 5) survives in this context, so
        // the fire-once guarantee holds — no re-fire from the same seeded streak.
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
        await p.waitForTimeout(2500); // give the on-load effect its chance to (not) fire
        if (await takeover.count()) {
          await shot(p, 'FAIL-t2-filing-streak-refired');
          throw new Error('filing-streak celebration re-fired after reload (celebratedMax marker should suppress it).');
        }
        await shot(p, 't2-filing-streak-after-reload');
        assertLegHygiene(ctx);
        return 'Filing-streak milestone: 9-week streak fired the milestone-5 takeover on home load (FILING STREAK · 5 WEEKS); dismissed cleanly; stayed absent after reload (per-year celebratedMax fire-once). Device-local marker only, no Firestore mutation; console clean, zero prod requests.';
      } finally {
        await ctx.context.close();
      }
    },
  },
];
