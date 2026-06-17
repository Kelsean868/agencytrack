/**
 * portal-bundle-probe.mjs — credential-free static proof that the migrated
 * app host shipped to the preview JS bundle. Loads the preview (bypass cookie),
 * fetches every module script the page references, and greps for the portal host
 * vs the old vercel host.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ambient */ }
}
loadEnv();

const BASE = (process.argv.slice(2).find((a) => a.startsWith('--url='))?.split('=')[1] ?? 'https://agencytrack.vercel.app').replace(/\/$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  try {
    await setupBypassSession(context, BASE, TOKEN);
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    // Pull every same-origin .js asset the bundle references, fetch + scan.
    const result = await page.evaluate(async () => {
      const out = { scanned: [], portal: 0, vercel: 0 };
      const hrefs = new Set();
      document.querySelectorAll('script[src]').forEach((s) => hrefs.add(s.src));
      // index-*.js is the entry; also scan any modulepreload links
      document.querySelectorAll('link[rel="modulepreload"][href]').forEach((l) => hrefs.add(l.href));
      for (const u of hrefs) {
        try {
          const txt = await (await fetch(u)).text();
          const p = (txt.match(/portal\.agencytrack\.app/g) || []).length;
          const v = (txt.match(/agencytrack\.vercel\.app/g) || []).length;
          out.scanned.push({ u: u.split('/').pop(), portal: p, vercel: v });
          out.portal += p;
          out.vercel += v;
        } catch (e) { out.scanned.push({ u, err: String(e) }); }
      }
      return out;
    });
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nportal hits: ${result.portal} | vercel hits: ${result.vercel}`);
  } finally {
    await context.close();
    await browser.close();
  }
})();
