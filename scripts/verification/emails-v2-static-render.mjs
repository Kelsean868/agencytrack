/**
 * Track J — Emails v2 static-render verification.
 *
 * Per brief Phase 3e: "render each template .html standalone (headless or
 * browser) with sample variable values → visual check against the mockup
 * (card, stripe, table grammar) → assert every {{var}} still resolves and
 * the .txt part matches the HTML's content."
 *
 * This script is NOT a preview smoke. It runs against the local checkout
 * (no network, no auth). It:
 *
 *   1. Inventories every {{var}} in each .html + matching .txt sibling.
 *   2. Asserts variable parity: every .html var appears in the .txt, and
 *      vice versa. A mismatch = the .txt is out of sync.
 *   3. Substitutes sample variable values into the .html.
 *   4. Asserts no `{{` survives the substitution (proves every var was
 *      caught + sample-mapped).
 *   5. Writes the rendered HTML to scripts/verification/emails-v2-rendered/
 *      so the dispatcher can open them in a browser for the visual check.
 *   6. Captures byte counts, var counts, and accent-stripe + eyebrow
 *      presence as a static-render audit summary.
 *
 * No `functions/index.js` is touched — templates only.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const TPL_DIR = join(REPO_ROOT, 'functions', 'email-templates');
const OUT_DIR = join(__dirname, 'emails-v2-rendered');

// `requiresBrandTeal` = false for the monday-nudge "urgency" variant, which
// uses danger red `#c0392b` as its entire accent palette (preserved from the
// pre-v2 template — the 2-hour deadline urgency is the design intent).
const TEMPLATES = [
  { name: 'monday-nudge',    expectedAccent: '#c0392b', expectedEyebrow: /Final reminder/i, requiresBrandTeal: false },
  { name: 'sunday-nudge',    expectedAccent: '#01696f', expectedEyebrow: /Weekly report/i,  requiresBrandTeal: true  },
  { name: 'password-reset',  expectedAccent: '#01696f', expectedEyebrow: /Account invite/i, requiresBrandTeal: true  },
];

const SAMPLE_VALUES = {
  userName:     'Marsha Singh',
  weekStarting: '24 November 2026',
  resetLink:    'https://agencytrack.vercel.app/auth/reset?oobCode=SAMPLE_oobCode_value_for_static_render',
};

function vars(text) {
  const set = new Set();
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return set;
}

function setEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function setDiff(a, b) {
  return [...a].filter((v) => !b.has(v));
}

function substitute(text, values) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    if (!(k in values)) throw new Error(`Sample value missing for {{${k}}}`);
    return values[k];
  });
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const results = [];
let allPass = true;

for (const tpl of TEMPLATES) {
  const htmlPath = join(TPL_DIR, `${tpl.name}.html`);
  const txtPath  = join(TPL_DIR, `${tpl.name}.txt`);

  const html = readFileSync(htmlPath, 'utf8');
  const txt  = readFileSync(txtPath,  'utf8');

  // ── 1. Inventory vars ─────────────────────────────────────────────────────
  const htmlVars = vars(html);
  const txtVars  = vars(txt);
  const varsInHtml = [...htmlVars].sort();
  const varsInTxt  = [...txtVars].sort();

  // ── 2. .html ↔ .txt parity ────────────────────────────────────────────────
  const htmlOnly = setDiff(htmlVars, txtVars);
  const txtOnly  = setDiff(txtVars,  htmlVars);
  const varParity = setEqual(htmlVars, txtVars);

  // ── 3. Substitute + assert no residual {{ ────────────────────────────────
  const rendered = substitute(html, SAMPLE_VALUES);
  const residual = (rendered.match(/\{\{/g) || []).length;

  // ── 4. Accent stripe + eyebrow presence ──────────────────────────────────
  const accentPresent = html.includes(tpl.expectedAccent) &&
    /height:4px;line-height:4px/.test(html);
  const eyebrowPresent = tpl.expectedEyebrow.test(html);

  // ── 5. Brand teal + safe-HTML invariants (regression) ────────────────────
  // Monday-nudge legitimately uses only danger red (urgency variant).
  const brandTealPresent = tpl.requiresBrandTeal
    ? html.toLowerCase().includes('#01696f')
    : true;
  const safeHtmlOk = (
    /role="presentation"/.test(html) &&
    /<table /.test(html) &&
    !/<style[^>]*>/.test(html) &&             // no <style> blocks (email-unsafe)
    !/class=/.test(html.replace(/<title>[^<]+<\/title>/, '')) // no class= (inline only)
  );

  // ── 6. Variable substitution sanity for .txt as well ─────────────────────
  const renderedTxt = substitute(txt, SAMPLE_VALUES);
  const txtResidual = (renderedTxt.match(/\{\{/g) || []).length;

  // ── 7. Write rendered output for dispatcher visual review ────────────────
  writeFileSync(join(OUT_DIR, `${tpl.name}.html`), rendered, 'utf8');
  writeFileSync(join(OUT_DIR, `${tpl.name}.txt`),  renderedTxt, 'utf8');

  const pass = (
    varParity &&
    residual === 0 &&
    txtResidual === 0 &&
    accentPresent &&
    eyebrowPresent &&
    brandTealPresent &&
    safeHtmlOk
  );
  if (!pass) allPass = false;

  results.push({
    name: tpl.name,
    htmlBytes: html.length,
    txtBytes:  txt.length,
    varsInHtml,
    varsInTxt,
    varParity,
    htmlOnly,
    txtOnly,
    residualHtml: residual,
    residualTxt:  txtResidual,
    accentPresent,
    eyebrowPresent,
    brandTealPresent,
    safeHtmlOk,
    renderedHtmlBytes: rendered.length,
    renderedTxtBytes:  renderedTxt.length,
    pass,
  });
}

console.log('\n=== Emails v2 static-render summary ===');
for (const r of results) {
  console.log(JSON.stringify(r, null, 2));
}
console.log(`\nRendered output written to: ${OUT_DIR}`);
console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
