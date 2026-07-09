/**
 * tier0.mjs — suite sanity legs (orchestrator-authored reference pattern).
 * Every tier module exports LEGS: [{ id, role, desc, run({browser, shot}) }].
 * A leg PASSES by returning a detail string, FAILS by throwing, SKIPs by
 * throwing new Error('SKIP: <reason>'). assertLegHygiene MUST run at leg end.
 */
import { newLegContext, login, assertLegHygiene, expectText, currencyRe } from './vh-helpers.mjs';
import { EXPECT, BASE } from './expectations.mjs';

export const LEGS = [
  {
    id: 'sanity-deploy-reachable',
    role: 'anon',
    desc: 'staging deploy serves the login screen through the bypass session',
    async run({ browser }) {
      const ctx = await newLegContext(browser);
      try {
        await ctx.page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        await ctx.page.waitForSelector('input[type="email"]', { timeout: 25_000 });
        assertLegHygiene(ctx);
        return 'login form rendered; console clean; no prod requests';
      } finally { await ctx.context.close(); }
    },
  },
  {
    id: 'sanity-agent1-login-populated',
    role: 'agent1',
    desc: 'agent-1 logs in; dashboard renders with seeded (non-empty) data',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        await login(ctx.page, 'agent1');
        // Value-level: the seeded YTD settled API hero must show the exact
        // hand-computed figure (sum of 9 submitted weeks).
        await expectText(ctx.page, currencyRe(EXPECT.a1.ytdApi), `YTD hero = TTD ${EXPECT.a1.ytdApi}`);
        await expectText(ctx.page, new RegExp(`${EXPECT.a1.streakWeeks}\\s?weeks`, 'i'), 'streak weeks');
        await shot(ctx.page, 'sanity-agent1-dashboard');
        assertLegHygiene(ctx);
        return `agent-1 dashboard: YTD ${EXPECT.a1.ytdApi} + ${EXPECT.a1.streakWeeks}-wk streak verified; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
];
