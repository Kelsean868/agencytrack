#!/usr/bin/env node
/**
 * classify-await-shapes.mjs — Phase 0 instrument for the flake-race investigation.
 *
 * Counts the "await a gate on element/mock A, then synchronously query element B"
 * shape across the unit suite, and reports it per file so the flake register can be
 * compared against the suite-wide population.
 *
 * The shape this looks for is the CORRECTED one banked in docs/FOLLOW_UPS.md
 * (fifth data point, PR #878): the earlier audit only searched for a bare query
 * following a *call-count* `waitFor`, and therefore missed the `findBy*`-gate
 * variant that actually fired. Both variants are counted here, tagged separately.
 *
 * Classification per await-gate site:
 *   PROXY   — the gate awaits something OTHER than the thing subsequently queried:
 *             either a mock-call assertion, or a findBy/waitFor on element A followed
 *             by a bare positive DOM query for a different element B.
 *   DIRECT  — the gate IS the assertion (`expect(await screen.findByX(...))...`),
 *             or the awaited DOM query is the same element that is then asserted on.
 *   NEITHER — no positive DOM query depends on the gate (mock-object assertions,
 *             negative assertions, or nothing follows).
 *
 * Usage:  node scripts/flake/classify-await-shapes.mjs [--json] [globs...]
 *
 * Read-only. Touches no test file.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const globArgs = args.filter((a) => !a.startsWith('--'));

// execFileSync, not execSync: pathspecs arrive from argv, and interpolating them
// into a shell string makes this a command-injection surface for no benefit.
// Each pathspec is passed as its own argument, so no shell evaluation occurs.
const pathspecs = globArgs.length ? globArgs : ['src/**/*.test.jsx', 'src/**/*.test.js'];

const files = execFileSync('git', ['ls-files', '--', ...pathspecs], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

// A positive DOM query that depends on a render commit having happened.
const POSITIVE_QUERY = /\b(?:screen\.)?(getBy|getAllBy|queryBy|queryAllBy)([A-Za-z]+)\s*\(/;
// Negative assertions make a bare query safe — the wait itself proves the branch.
const NEGATIVE_ASSERT = /\.not\.|toBeNull\(\)|toHaveLength\(\s*0\s*\)|toBeUndefined\(\)/;
// A mock-object assertion is structurally immune: no re-render dependency.
const MOCK_ASSERT = /\.(toHaveBeenCalled|toHaveBeenCalledTimes|toHaveBeenCalledWith|mock\.calls|mock\.results)/;

const AWAIT_WAITFOR = /await\s+waitFor\s*\(/;
const AWAIT_FINDBY = /await\s+(?:screen\.)?(findBy|findAllBy)([A-Za-z]+)\s*\(/;
const EXPECT_AWAIT_FINDBY = /expect\s*\(\s*await\s+(?:screen\.)?(?:findBy|findAllBy)[A-Za-z]+\s*\(/;

/** Extract the argument text of a call starting at `openIdx` (index of "("). */
function balanced(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return text.slice(openIdx + 1);
}

/** Normalise a query target so "same element" comparisons are meaningful. */
function targetKey(kind, argText) {
  const m = argText.match(/['"`]([^'"`]+)['"`]/);
  const name = argText.match(/name:\s*(\/[^/]+\/[a-z]*|['"`][^'"`]+['"`])/);
  return `${kind}::${(m ? m[1] : '').trim()}::${name ? name[1] : ''}`.toLowerCase();
}

const rows = [];

for (const rel of files) {
  const abs = path.resolve(rel);
  let src;
  try {
    src = readFileSync(abs, 'utf8');
  } catch {
    continue;
  }
  const lines = src.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    // Classify from the COMPLETE enclosing statement, not the single line. A
    // multiline `await screen.findByRole(\n  'button', { name: /x/i },\n)` has its
    // query arguments on later lines; reading only line i yields an empty target,
    // and the same-element follow-up then misreports as PROXY — which would
    // inflate the suite-wide PROXY count this script exists to produce.
    const stmt = lines.slice(i, Math.min(i + 12, lines.length)).join('\n');
    const firstLineLen = lines[i].length;
    // Only accept a match that BEGINS on line i; otherwise a gate two lines down
    // would be counted once per line of the window.
    const startsHere = (re) => {
      const m = stmt.match(re);
      return m && m.index <= firstLineLen ? m : null;
    };

    // `expect(await screen.findByX(...))` — gate IS the assertion. Always DIRECT.
    if (startsHere(EXPECT_AWAIT_FINDBY)) {
      rows.push({ file: rel, line: i + 1, gate: 'expect(await findBy)', klass: 'DIRECT', detail: lines[i].trim().slice(0, 140) });
      continue;
    }

    const isWaitFor = !!startsHere(AWAIT_WAITFOR);
    const findMatch = startsHere(AWAIT_FINDBY);
    if (!isWaitFor && !findMatch) continue;

    // Gate body: the balanced call args, which may span lines.
    const openIdx = stmt.indexOf('(', stmt.search(isWaitFor ? /waitFor\s*\(/ : AWAIT_FINDBY));
    const gateBody = openIdx >= 0 ? balanced(stmt, openIdx) : '';
    const gateIsMockOnly = isWaitFor && MOCK_ASSERT.test(gateBody) && !POSITIVE_QUERY.test(gateBody);

    // What does the gate await?
    let gateTarget = null;
    if (findMatch) {
      const fOpen = stmt.indexOf('(', stmt.search(AWAIT_FINDBY));
      gateTarget = targetKey(findMatch[2], fOpen >= 0 ? balanced(stmt, fOpen) : '');
    } else if (!gateIsMockOnly) {
      const q = gateBody.match(POSITIVE_QUERY);
      if (q) {
        const qOpen = gateBody.indexOf('(', gateBody.search(POSITIVE_QUERY));
        gateTarget = targetKey(q[2], qOpen >= 0 ? balanced(gateBody, qOpen) : '');
      }
    }

    // Scan forward for the first positive DOM query that is NOT itself awaited,
    // stopping at the next await gate (that gate would re-synchronise).
    let follow = null;
    const gateEndLine = i + Math.max(0, (gateBody.match(/\n/g) || []).length);
    for (let j = gateEndLine + 1; j < Math.min(gateEndLine + 9, lines.length); j += 1) {
      const l = lines[j];
      if (!l.trim() || l.trim().startsWith('//')) continue;
      if (AWAIT_WAITFOR.test(l) || AWAIT_FINDBY.test(l) || EXPECT_AWAIT_FINDBY.test(l)) break;
      if (/^\s*\}\s*\)?\s*;?\s*$/.test(l)) continue;
      const q = l.match(POSITIVE_QUERY);
      if (!q) continue;
      if (NEGATIVE_ASSERT.test(l)) { follow = { line: j + 1, text: l.trim(), negative: true }; break; }
      if (MOCK_ASSERT.test(l) && !POSITIVE_QUERY.test(l.split('expect')[1] || '')) continue;
      const qOpen = l.indexOf('(', l.search(POSITIVE_QUERY));
      follow = {
        line: j + 1,
        text: l.trim().slice(0, 140),
        negative: false,
        target: targetKey(q[2], qOpen >= 0 ? balanced(l, qOpen) : ''),
      };
      break;
    }

    let klass;
    let detail;
    if (!follow || follow.negative) {
      klass = 'NEITHER';
      detail = gateIsMockOnly ? 'mock-only gate, no positive DOM query depends on it' : 'no positive DOM query depends on this gate';
    } else if (gateIsMockOnly) {
      klass = 'PROXY';
      detail = `mock-call gate -> bare query L${follow.line}: ${follow.text}`;
    } else if (gateTarget && follow.target && gateTarget === follow.target) {
      klass = 'DIRECT';
      detail = `gate and query are the same element (L${follow.line})`;
    } else {
      klass = 'PROXY';
      detail = `gate on A -> bare query on B at L${follow.line}: ${follow.text}`;
    }

    rows.push({
      file: rel,
      line: i + 1,
      gate: findMatch ? 'await findBy' : gateIsMockOnly ? 'waitFor(mock)' : 'waitFor(dom)',
      klass,
      detail,
    });
  }
}

if (asJson) {
  process.stdout.write(JSON.stringify(rows, null, 2));
} else {
  const byClass = rows.reduce((a, r) => ((a[r.klass] = (a[r.klass] || 0) + 1), a), {});
  const proxyFiles = new Set(rows.filter((r) => r.klass === 'PROXY').map((r) => r.file));
  console.log(`files scanned: ${files.length}`);
  console.log(`gate sites:    ${rows.length}`);
  console.log(`  PROXY   ${byClass.PROXY || 0}  (across ${proxyFiles.size} files)`);
  console.log(`  DIRECT  ${byClass.DIRECT || 0}`);
  console.log(`  NEITHER ${byClass.NEITHER || 0}`);
  console.log('\nPROXY sites per file (desc):');
  const perFile = {};
  rows.filter((r) => r.klass === 'PROXY').forEach((r) => (perFile[r.file] = (perFile[r.file] || 0) + 1));
  Object.entries(perFile)
    .sort((a, b) => b[1] - a[1])
    .forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));
}
