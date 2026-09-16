import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isImportedPolicy,
  excludeImported,
  partitionImported,
  countImported,
} from '../excludeImported';
import { OIPA_IMPORT_SOURCE } from '../oipaImportConfig';

const imported = (n = 'IMP0001') => ({ policyNumber: n, importSource: OIPA_IMPORT_SOURCE, proposedAPI: 1000 });
const organic = (n = 'ORG0001') => ({ policyNumber: n, proposedAPI: 500 });

describe('isImportedPolicy', () => {
  it('is true only for the OIPA import tag', () => {
    expect(isImportedPolicy(imported())).toBe(true);
    expect(isImportedPolicy(organic())).toBe(false);
  });

  it('does NOT match a different importer tag', () => {
    // A future importer is a different question. A filter written for OIPA must
    // not silently sweep up somebody else's provenance.
    expect(isImportedPolicy({ importSource: 'some_other_import' })).toBe(false);
  });

  it('treats a missing or blank importSource as organic', () => {
    // Every policy written before the importer existed has no importSource, and
    // those are exactly the docs that must survive the filter.
    expect(isImportedPolicy({})).toBe(false);
    expect(isImportedPolicy({ importSource: null })).toBe(false);
    expect(isImportedPolicy({ importSource: '' })).toBe(false);
  });

  it('does not throw on null or undefined', () => {
    expect(isImportedPolicy(null)).toBe(false);
    expect(isImportedPolicy(undefined)).toBe(false);
  });
});

describe('excludeImported', () => {
  it('keeps the organic docs and drops the imported ones', () => {
    const res = excludeImported([imported('A'), organic('B'), imported('C'), organic('D')]);
    expect(res.map((d) => d.policyNumber)).toEqual(['B', 'D']);
  });

  it('keeps legacy docs that have no importSource field at all', () => {
    // The whole reason this filter is client-side: a Firestore
    // `where('importSource','!=','oipa_import')` would DROP these, returning the
    // imported docs and nothing else — the exact inverse, with no error.
    const legacy = [{ policyNumber: 'OLD1' }, { policyNumber: 'OLD2' }];
    expect(excludeImported(legacy)).toHaveLength(2);
  });

  it('returns a new array and never mutates the input', () => {
    const input = [imported('A'), organic('B')];
    const snapshot = JSON.stringify(input);
    const out = excludeImported(input);
    expect(out).not.toBe(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('returns [] for anything that is not an array', () => {
    // Callers pass the result of a fetch that may not have resolved.
    expect(excludeImported(null)).toEqual([]);
    expect(excludeImported(undefined)).toEqual([]);
    expect(excludeImported('nope')).toEqual([]);
  });

  it('returns [] when every doc is imported', () => {
    expect(excludeImported([imported('A'), imported('B')])).toEqual([]);
  });
});

describe('partitionImported', () => {
  it('splits into two disjoint halves that account for every doc', () => {
    const input = [imported('A'), organic('B'), imported('C')];
    const { imported: imp, organic: org } = partitionImported(input);

    expect(imp.map((d) => d.policyNumber)).toEqual(['A', 'C']);
    expect(org.map((d) => d.policyNumber)).toEqual(['B']);
    expect(imp.length + org.length).toBe(input.length);
    expect(imp.filter((d) => org.includes(d))).toEqual([]);
  });

  it('agrees with excludeImported on the organic half', () => {
    const input = [imported('A'), organic('B'), { policyNumber: 'OLD' }];
    expect(partitionImported(input).organic).toEqual(excludeImported(input));
  });

  it('handles an empty or non-array input', () => {
    expect(partitionImported([])).toEqual({ imported: [], organic: [] });
    expect(partitionImported(null)).toEqual({ imported: [], organic: [] });
  });
});

describe('countImported', () => {
  it('counts only the imported docs', () => {
    expect(countImported([imported('A'), organic('B'), imported('C')])).toBe(2);
    expect(countImported([organic('B')])).toBe(0);
    expect(countImported(null)).toBe(0);
  });
});

/**
 * CALL-SITE GUARD.
 *
 * The real failure mode is not a broken helper — it is a NEW `getOwnPolicies`
 * call site added later that forgets to filter. Nothing about that fails: a
 * production total silently gains an imported historical book.
 *
 * So this asserts the invariant against the source tree: every file that CALLS
 * `getOwnPolicies` also references `excludeImported`. Adding an unfiltered call
 * site turns this red and names the file.
 *
 * COMMENTS ARE STRIPPED FIRST. Without that, `policyLedgerDerivation.js` fails
 * the guard on the phrase "derived from the existing getOwnPolicies() list" in
 * its header — a false positive that cost a real diagnosis on the first run.
 *
 * WHAT THIS GUARD DOES *NOT* CATCH: a file that fetches unfiltered and hands the
 * array to an aggregating child. `PolicyLedgerPanel` is exactly that shape — it
 * keeps the full list for the ledger and filters only for `CampaignLensPanel`.
 * The guard sees the reference and passes; it cannot tell which consumer got
 * which array. That gap is why the ruling-5e table is reviewed by hand and not
 * merely asserted here.
 */
describe('call-site guard — every getOwnPolicies caller references excludeImported', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const SRC = path.resolve(HERE, '../../..');
  const REPO = path.resolve(SRC, '..');

  /** Removes block and line comments so a mention in prose is not read as a call. */
  function stripComments(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  }

  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full, out);
      } else if (/\.(js|jsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  const callers = walk(SRC)
    .map((full) => ({
      rel: path.relative(REPO, full).split(path.sep).join('/'),
      code: stripComments(fs.readFileSync(full, 'utf8')),
    }))
    .filter((f) => /getOwnPolicies\s*\(/.test(f.code));

  it('finds exactly the known call sites (red when one is added or removed)', () => {
    expect(callers.map((c) => c.rel).sort()).toEqual([
      'src/components/agent/PersistencyTab.jsx',
      'src/components/agent/PolicyLedgerPanel.jsx',
      'src/components/awards/AgentAwardsPanel.jsx',
      'src/components/dashboard/AgentDashboard.jsx',
      'src/components/manager/FinancingProrationPanel.jsx',
      'src/hooks/useMyProduction.js',
      'src/lib/financingProjectedBonus.js',
      // The DEFINITION site, matched because `export async function
      // getOwnPolicies(` looks like a call. It belongs in this list on its own
      // merit: it filters getDeliverablePolicies and getPoliciesForManager.
      'src/services/policiesService.js',
    ]);
  });

  /**
   * Files allowed to fetch UNFILTERED, each with the reason it must.
   *
   * Dispatcher ruling 5e names exactly two exceptions, and both are here. This
   * list is deliberately awkward to add to: an entry is a claim that a surface
   * NEEDS the imported historical book, and there are only two such surfaces.
   *
   * Note `PolicyLedgerPanel` is NOT on it. It fetches unfiltered for the ledger
   * LIST but filters for `CampaignLensPanel`, so it does reference the helper --
   * which is why the guard passes it and why the guard alone cannot prove that
   * file is correct. See the caveat above.
   */
  const ALLOW_UNFILTERED = new Map([
    ['src/components/agent/PersistencyTab.jsx',
      'persistency is the one reader that MUST see imported docs — they are its entire input'],
  ]);

  it.each(callers.map((c) => [c.rel, c.code]))('%s references excludeImported, or is allow-listed', (rel, code) => {
    const allowed = [...ALLOW_UNFILTERED.keys()].some((k) => rel.endsWith(k));
    if (allowed) {
      // Asserted, not skipped: if an allow-listed file STARTS filtering, the
      // surface that needs the imported book silently stops seeing it. For
      // persistency that means the figure quietly drops to zero.
      expect(/excludeImported\s*\(/.test(code)).toBe(false);
    } else {
      expect(/excludeImported\s*\(/.test(code)).toBe(true);
    }
  });

  it('allow-lists exactly the exceptions ruling 5e names', () => {
    expect([...ALLOW_UNFILTERED.keys()]).toEqual(['src/components/agent/PersistencyTab.jsx']);
  });

  it('does not count a mere mention of getOwnPolicies in a comment', () => {
    // policyLedgerDerivation.js names getOwnPolicies() in its header prose only.
    expect(callers.map((c) => c.rel)).not.toContain('src/lib/policyLedgerDerivation.js');
  });
});
