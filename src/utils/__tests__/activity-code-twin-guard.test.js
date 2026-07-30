/**
 * Guard 1 — no twin lists of activity codes (v3 rule 1).
 *
 * Static source-scan, in the style of dark-ink-static-guard.test.js. Fails if any
 * file other than `src/constants/activityMetadata.js` declares a LITERAL (array
 * or object) containing ≥3 known activity codes.
 *
 * Why ≥3 and not ≥4: a 3-code list drifts exactly as readily as a 6-code one.
 * The prototype's `KIND_OF` list — which routed new codes to the task closer and
 * DELETED appointments — got there because the guard against it was tuned down
 * to keep a known problem quiet.
 *
 * TWO DETECTION SUBTLETIES, both load-bearing:
 *
 * 1. Codes appear as QUOTED literals (`'PC'`) *and* as BARE OBJECT KEYS (`PC:`).
 *    The two biggest twins this slice removed — TYPE_TONE and PLAN_TO_DAILY_FIELD
 *    — used bare keys. A quoted-literal-only scan finds NEITHER, and would have
 *    passed while both sat in plain sight.
 *
 * 2. Codes are counted per LITERAL REGION, not per file, and a region rolls up
 *    its nested regions. Per-file counting would flag AppointmentSheet.jsx, which
 *    legitimately compares against 'PC' / 'FREE' / 'SALE' / 'CI' in four
 *    unrelated single-code expressions. A `{` only opens a literal region when it
 *    is preceded by `= ( [ , :` or `return` — a function body (preceded by `)`)
 *    is not a literal, which is what keeps those comparisons out of scope.
 *
 * SCOPE: production source only — `__tests__` is excluded, as in
 * dark-ink-static-guard.test.js. Test files are FULL of mock appointment arrays
 * (`[{ type: 'CI' }, { type: 'FFI' }, { type: 'PC' }]`) that are sample data, not
 * classifiers — and they are structurally indistinguishable from the real
 * counter-row twins, so no rule can separate them. Allowlisting each one by name
 * would add friction to every future planner test and teach authors to reach for
 * the allowlist, which is how a guard gets tuned down until it stops guarding.
 * The risk this guard exists for — a classifier drifting from the table — lives
 * in production code. Deliberate contract fixtures like plannerService.test.js's
 * verbatim TYPE_KEYS pin are SUPPOSED to hold the literal: deriving them from the
 * table they check would test nothing.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, relative, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ALL_CODES } from '../../constants/activityMetadata.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = resolve(ROOT, 'src');
const TABLE = 'src/constants/activityMetadata.js';

const CODES = new Set(ALL_CODES);

/**
 * Files permitted to hold a code literal, each with the reason it is allowed.
 * A test FIXTURE is a valid reason; a production classifier is not. Entries that
 * stop carrying a literal fail the suite below, so this list cannot go stale.
 */
const ALLOWLIST = new Map([
  [
    'src/components/planner/AgentPlannerPanel.jsx',
    'WEEK_COUNTER_ROWS — duplicate pair with TeamPlannerPanel COUNTER_ROWS; '
    + 'consolidation owned by Phase 2.1. Floors are out of scope for P0-A. Pinned '
    + 'equal to its twin by the companion assertion below.',
  ],
  [
    'src/components/planner/manager/TeamPlannerPanel.jsx',
    'COUNTER_ROWS — duplicate pair with AgentPlannerPanel WEEK_COUNTER_ROWS; '
    + 'consolidation owned by Phase 2.1. Floors are out of scope for P0-A. Pinned '
    + 'equal to its twin by the companion assertion below.',
  ],
]);

function collectSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      collectSourceFiles(full, out);
    } else if (/\.(jsx|js)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Strip line + block comments so commentary listing codes is never counted. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/**
 * Largest number of DISTINCT activity codes inside any single literal region,
 * counting nested regions toward their ancestors.
 */
function maxCodesInAnyLiteral(src) {
  const text = stripComments(src);
  // A code token in literal position: quoted, or a bare object key `CODE:`.
  const TOKEN = /'([A-Z]{2,10})'|"([A-Z]{2,10})"|\b([A-Z]{2,10})\s*:/g;

  // Precompute code hits by index.
  const hits = [];
  for (let m; (m = TOKEN.exec(text)) !== null;) {
    const code = m[1] ?? m[2] ?? m[3];
    if (CODES.has(code)) hits.push({ index: m.index, code });
  }
  if (hits.length === 0) return 0;

  const stack = [];
  let best = 0;
  let hitAt = 0;

  const opensLiteral = (i) => {
    if (text[i] === '[') return true;
    // `{` is a literal only when preceded by = ( [ , : or `return`.
    let j = i - 1;
    while (j >= 0 && /\s/.test(text[j])) j -= 1;
    if (j < 0) return false;
    if ('=([,:'.includes(text[j])) return true;
    return /\breturn$/.test(text.slice(Math.max(0, j - 5), j + 1));
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '[' || ch === '{') {
      stack.push(opensLiteral(i) ? new Set() : null);
    } else if (ch === ']' || ch === '}') {
      const closed = stack.pop();
      if (closed) {
        best = Math.max(best, closed.size);
        // Roll up into the nearest enclosing literal, if any.
        for (let k = stack.length - 1; k >= 0; k -= 1) {
          if (stack[k]) { closed.forEach((c) => stack[k].add(c)); break; }
        }
      }
    }
    // Attribute any code hits at this position to every open literal region.
    while (hitAt < hits.length && hits[hitAt].index === i) {
      for (let k = stack.length - 1; k >= 0; k -= 1) {
        if (stack[k]) { stack[k].add(hits[hitAt].code); break; }
      }
      hitAt += 1;
    }
  }
  return best;
}

const files = collectSourceFiles(SRC);
const posixRel = (f) => relative(ROOT, f).split('\\').join('/');

describe('Guard 1 — activity codes live in exactly one table', () => {
  it('scans a non-trivial source tree (sanity)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('detects bare object keys, not just quoted literals (self-test)', () => {
    expect(maxCodesInAnyLiteral('const X = { PC: 1, SC: 2, AI: 3 };')).toBe(3);
    expect(maxCodesInAnyLiteral("const X = ['PC', 'SC', 'AI'];")).toBe(3);
    // Nested regions roll up to the enclosing literal.
    expect(maxCodesInAnyLiteral("const X = [{t:'PC'},{t:'SC'},{t:'AI'}];")).toBe(3);
    // Unrelated single-code comparisons in a function body are NOT a literal.
    expect(maxCodesInAnyLiteral(
      "function f(t){ if(t==='PC') return 1; if(t==='SC') return 2; if(t==='AI') return 3; }",
    )).toBe(0);
    // Comments listing codes are stripped.
    expect(maxCodesInAnyLiteral("// PC, SC, AI, FFI\nconst X = ['PC'];")).toBe(1);
  });

  it('no file outside the table declares a literal with ≥3 activity codes', () => {
    const offenders = files
      .filter((f) => posixRel(f) !== TABLE)
      .filter((f) => !ALLOWLIST.has(posixRel(f)))
      .filter((f) => maxCodesInAnyLiteral(readFileSync(f, 'utf-8')) >= 3)
      .map(posixRel);

    expect(
      offenders,
      'These files declare a literal list of activity codes — a twin of '
      + `${TABLE}, which is the shape every v3 prototype regression came from:\n`
      + offenders.map((f) => `  ❌ ${f}`).join('\n')
      + '\nFix: derive from ACTIVITY_METADATA instead. Colours, classifiers, '
      + 'counters, filters and prep-capability all have a field there. Only a '
      + 'deliberate, documented exception belongs in ALLOWLIST, with its reason — '
      + 'a production classifier is not one.',
    ).toEqual([]);
  });

  it('every allowlist entry still carries a code literal (no stale entries)', () => {
    const stale = [...ALLOWLIST.keys()].filter((rel) => {
      try {
        return maxCodesInAnyLiteral(readFileSync(resolve(ROOT, rel), 'utf-8')) < 3;
      } catch {
        return true; // file gone → stale
      }
    });
    expect(
      stale,
      `Allowlist entries no longer carrying a code literal — remove them:\n${
        stale.map((f) => `  ❌ ${f}`).join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * Companion assertion for the one allowlisted PRODUCTION pair. The two counter-row
 * lists are byte-identical today and their consolidation belongs to Phase 2.1;
 * until then this stops them drifting apart while they wait. Editing one without
 * the other fails here.
 */
describe('Guard 1 companion — the allowlisted counter-row twins stay identical', () => {
  const extractArray = (rel, name) => {
    const src = readFileSync(resolve(ROOT, rel), 'utf-8');
    const m = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`).exec(src);
    expect(m, `${name} not found in ${rel} — the guard's anchor moved`).toBeTruthy();
    return m[1].replace(/\s+/g, ' ').trim();
  };

  it('WEEK_COUNTER_ROWS and COUNTER_ROWS have identical contents', () => {
    const agent = extractArray('src/components/planner/AgentPlannerPanel.jsx', 'WEEK_COUNTER_ROWS');
    const team = extractArray('src/components/planner/manager/TeamPlannerPanel.jsx', 'COUNTER_ROWS');
    expect(
      agent,
      'The agent and manager counter-row lists have drifted. They are a known '
      + 'duplicate pair awaiting consolidation in Phase 2.1 — until then they must '
      + 'stay identical, or the agent and their manager read different floors for '
      + 'the same week.',
    ).toBe(team);
  });
});
