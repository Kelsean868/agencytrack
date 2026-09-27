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
 * array to an aggregating child. It sees the reference and passes; it cannot
 * tell which consumer got which array. That gap is why the ruling-5e table is
 * reviewed by hand and not merely asserted here.
 *
 * `PolicyLedgerPanel` USED to be exactly that shape — full list for the ledger,
 * filtered array for `CampaignLensPanel`. C-D10 moved the campaign lens off the
 * origin test and onto the settlement-date test, so that file now fetches
 * unfiltered throughout and has joined ALLOW_UNFILTERED below with its reason.
 */
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

describe('call-site guard — every getOwnPolicies caller references excludeImported', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const SRC = path.resolve(HERE, '../../..');
  const REPO = path.resolve(SRC, '..');

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
   * `PolicyLedgerPanel` joined this list under C-D10. Its ledger LIST always
   * showed every doc; what changed is that its campaign lens now decides
   * eligibility by `dateIssued` rather than by `importSource`. The live ledger
   * forced it: 229 policy docs, all imported, none organic — so the origin
   * filter hid 100% of the operator's campaign production and the lens rendered
   * TTD 0 against a real 3 apps / TTD 73,946.28.
   */
  const ALLOW_UNFILTERED = new Map([
    ['src/components/agent/PersistencyTab.jsx',
      'persistency is the one reader that MUST see imported docs — they are its entire input'],
    ['src/components/agent/PolicyLedgerPanel.jsx',
      'the campaign lens tests dateIssued, not importSource (C-D10); the ledger list always showed every doc'],
    // Joined under R5 (hero-ledger-truth H2, 23 Sep 2026): awards bucket each
    // policy by the month of its dateIssued, so a 2019 import reaches no
    // current award by DATE. Same shape as the C-D10 amendment above.
    ['src/components/awards/AgentAwardsPanel.jsx',
      'awards count a policy in the month of its dateIssued, not by importSource (R5, amends 5e)'],
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

  // Deliberately a hard pin: adding a file here is a claim that a surface NEEDS
  // the imported historical book, and each entry should cost a conversation.
  // PersistencyTab is ruling 5e's own exception; PolicyLedgerPanel joined under
  // C-D10, when the campaign lens moved from the origin test to the date test.
  // AgentAwardsPanel joined under R5 (H2).
  it('allow-lists exactly the three surfaces that must fetch unfiltered', () => {
    expect([...ALLOW_UNFILTERED.keys()]).toEqual([
      'src/components/agent/PersistencyTab.jsx',
      'src/components/agent/PolicyLedgerPanel.jsx',
      'src/components/awards/AgentAwardsPanel.jsx',
    ]);
  });

  it('does not count a mere mention of getOwnPolicies in a comment', () => {
    // policyLedgerDerivation.js names getOwnPolicies() in its header prose only.
    expect(callers.map((c) => c.rel)).not.toContain('src/lib/policyLedgerDerivation.js');
  });
});

/**
 * ─── PROP-PROVENANCE GUARD ───────────────────────────────────────────────────
 *
 * The guard above checks the FILE. This one checks the ARRAY.
 *
 * Why both exist. The file-level guard asserts that every `getOwnPolicies`
 * caller references `excludeImported(` somewhere in it. That was enough while a
 * file had ONE policy array. Campaign C2 gave `AgentDashboard.jsx` one fetch and
 * two derived arrays:
 *
 *     setPoliciesAll(own);                 // unfiltered -> the campaign card
 *     setPolicies(excludeImported(own));   // filtered   -> everything else
 *
 * That file references the helper, so the file-level guard passes it — while it
 * is simultaneously handing an unfiltered array to a child. The assertion is
 * per-file presence of the helper, not per-array provenance, and a file that
 * filters one array and passes another raw satisfies it completely.
 *
 * What slips through is the ORIGINAL defect one component over: wire
 * `policiesAll` into `AgentAwardsPanel`, `useMyProduction` or a financing
 * surface and an imported historical book earns credit retroactively with no
 * test going red. On `tatillife_south` the 229 imported docs ARE the whole
 * production book, so the wrong number would be large and plausible rather than
 * obviously broken.
 *
 * So this guard enumerates every JSX site that hands a policy ARRAY to a child
 * component and pins the inventory. A new site — any new site — turns it red
 * and has to be classified by a human.
 *
 * WHAT IT CANNOT DO. It reads text, not dataflow: it cannot prove that the
 * `policies` identifier in one file holds a value that was filtered in another.
 * That is what `provenance` in the manifest asserts, by hand. `RAW_CARRIERS`
 * makes the part that CAN be mechanical mechanical: two identifiers are
 * unfiltered by construction, and a site naming either must say so.
 */
describe('prop-provenance guard — every policy array handed to a child is classified', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const SRC = path.resolve(HERE, '../../..');
  const REPO = path.resolve(SRC, '..');

  // Identifiers that are unfiltered BY CONSTRUCTION. `policiesAll` is
  // AgentDashboard's raw array; `campaignPolicies` is the prop it travels under.
  // Naming either in a prop expression is a claim that the destination wants the
  // imported book, and the manifest has to say so out loud.
  const RAW_CARRIERS = ['policiesAll', 'campaignPolicies'];

  /** A prop carrying a policy ARRAY. `onViewLapsedPolicies` is a handler, not an array. */
  function isPolicyArrayProp(name) {
    return /policies/i.test(name) && !/^on[A-Z]/.test(name);
  }

  /** Contents of the {...} beginning at `openIdx`, brace-balanced. */
  function readBraced(src, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(openIdx + 1, i);
      }
    }
    return null;
  }

  /** The JSX element an attribute at `idx` belongs to — nearest `<Component` before it. */
  function enclosingComponent(src, idx) {
    const before = src.slice(0, idx);
    const matches = [...before.matchAll(/<([A-Z][\w.]*)/g)];
    return matches.length ? matches[matches.length - 1][1] : '(unknown)';
  }

  const sites = [];
  for (const full of walk(SRC)) {
    if (!full.endsWith('.jsx')) continue;
    const rel = path.relative(REPO, full).split(path.sep).join('/');
    const code = stripComments(fs.readFileSync(full, 'utf8'));
    for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*\{/g)) {
      const name = m[1];
      if (!isPolicyArrayProp(name)) continue;
      const open = m.index + m[0].length - 1;
      const expr = (readBraced(code, open) ?? '').trim();
      sites.push({
        id: `${rel} :: <${enclosingComponent(code, m.index)} ${name}>`,
        expr,
        filteredAtSite: /excludeImported\s*\(/.test(expr),
        namesRawCarrier: RAW_CARRIERS.some((c) => new RegExp(`\\b${c}\\b`).test(expr)),
      });
    }
  }
  sites.sort((a, b) => a.id.localeCompare(b.id));

  /**
   * THE MANIFEST. Every policy array handed to a child, and why it is the shape
   * it is. `unfiltered` is a claim that the destination NEEDS the imported
   * historical book; each one should cost a conversation.
   */
  const MANIFEST = [
    {
      id: 'src/components/agent/PolicyLedgerPanel.jsx :: <AwardLensPanel policies>',
      provenance: 'unfiltered',
      why: 'L1 award lens (replaced CampaignLensPanel). C-D10 / R5: campaign and award eligibility is decided by date (dateIssued, or the L0 submit date for pending), never by importSource. An imported policy issued in the window counts; one issued in 2019 does not.',
    },
    {
      id: 'src/components/dashboard/AgentDashboard.jsx :: <AgentDashboardHomeV2 campaignPolicies>',
      provenance: 'unfiltered',
      why: 'The raw half of C2’s single fetch, travelling to CampaignCard under C-D10. Its ONLY legitimate consumer is the campaign readout.',
    },
    {
      id: 'src/components/dashboard/AgentDashboard.jsx :: <AgentDashboardHomeV2 policies>',
      provenance: 'filtered-upstream',
      why: 'The excludeImported half of the same fetch, for DeliveryStripCard and the commission strip.',
    },
    {
      id: 'src/components/dashboard/AgentDashboard.jsx :: <CommissionAnchorStrip policies>',
      provenance: 'filtered-upstream',
      why: 'Commission totals aggregate money, and imported docs were earned outside this system (ruling 5e).',
    },
    {
      id: 'src/components/dashboard/HomeV2/index.jsx :: <DeliveryStripCard policies>',
      provenance: 'filtered-upstream',
      why: 'Delivery register surface. An imported policy was delivered years ago, outside this system.',
    },
    {
      id: 'src/components/dashboard/HomeV2/index.jsx :: <CampaignHeroCard policies>',
      provenance: 'unfiltered',
      why: 'The campaign readout, C-D10, now via H3’s CampaignHeroCard (replaced CampaignCard on Home). The operator’s book is 100% imported, so the FILTERED array is empty here and the card would render TTD 0 against a real TTD 73,946.28.',
    },
    {
      id: 'src/components/awards/AgentAwardsPanel.jsx :: <CampaignScreenWithTier policies>',
      provenance: 'unfiltered',
      why: 'H3’s campaign hero on the Awards tab is fed from `ledgerPolicies`, the same raw ledger fetch this file already uses for `awardRowsFromLedger` under R5/H2 — never `excludeImported`, so the campaign readout cannot disagree with the ledger-based awards beside it.',
    },
    {
      id: 'src/components/dashboard/ManagerDashboard.jsx :: <CommissionAnchorStrip policies>',
      provenance: 'filtered-upstream',
      why: 'useMyProduction filters at its own reader; same commission surface as the agent side.',
    },
  ];

  const manifestById = new Map(MANIFEST.map((e) => [e.id, e]));

  it('finds exactly the known policy-array prop sites (RED when one is added)', () => {
    // The teeth. Wiring `policiesAll` into AgentAwardsPanel, useMyProduction or
    // a financing surface creates a site that is not in the manifest, and this
    // fails naming the file and the component.
    expect(sites.map((s) => s.id))
      .toEqual(MANIFEST.map((e) => e.id).sort((a, b) => a.localeCompare(b)));
  });

  it('classifies every site, and every unfiltered one carries a reason', () => {
    for (const site of sites) {
      const entry = manifestById.get(site.id);
      expect(entry, `unclassified policy-array prop site: ${site.id}`).toBeTruthy();
      expect(['filtered-at-site', 'filtered-upstream', 'unfiltered']).toContain(entry.provenance);
      if (entry.provenance === 'unfiltered') {
        expect(entry.why.length, `${site.id} is unfiltered with no stated reason`).toBeGreaterThan(40);
      }
    }
  });

  it('a site naming a raw carrier MUST be declared unfiltered', () => {
    // policiesAll / campaignPolicies are unfiltered by construction, so this is
    // mechanical rather than a hand claim: the text alone settles it.
    for (const site of sites.filter((s) => s.namesRawCarrier)) {
      expect(
        manifestById.get(site.id)?.provenance,
        `${site.id} passes a raw carrier (${site.expr}) but is not declared unfiltered`,
      ).toBe('unfiltered');
    }
  });

  it('a site that filters inline is never declared unfiltered', () => {
    for (const site of sites.filter((s) => s.filteredAtSite)) {
      expect(manifestById.get(site.id)?.provenance).not.toBe('unfiltered');
    }
  });

  it('pins the raw carriers — a third one has to be declared here', () => {
    expect(RAW_CARRIERS).toEqual(['policiesAll', 'campaignPolicies']);
  });

  it('the scanner actually scans: it finds sites and ignores handler props', () => {
    // Guards the guard. If the regex silently matched nothing, every assertion
    // above would pass vacuously.
    expect(sites.length).toBeGreaterThanOrEqual(8);
    expect(sites.map((s) => s.id).join(' ')).not.toContain('onViewLapsedPolicies');
    expect(sites.filter((s) => s.namesRawCarrier).length).toBe(2);
  });
});

/**
 * ─── RAW-CARRIER GUARD (hero-ledger H1) ─────────────────────────────────────
 *
 * H1 widened who reads the unfiltered list: the production heroes now derive
 * their figures from `policiesAll` (R5 — current-year production is decided by
 * date, not origin). The manifest above keys on props whose NAME says
 * "policies", which leaves three ways the raw list could reach a new reader
 * without a test going red. Each is closed here, by prop:
 *
 *   1. The raw list handed to a child under ANY prop name (`data={policiesAll}`).
 *      Every JSX attribute whose value names a raw carrier is enumerated and
 *      pinned, whatever the attribute is called.
 *   2. The derived figures. Heroes receive `deriveYearProduction()` output, never
 *      the list. Every call site is pinned with its first argument, and every
 *      prop carrying the result is pinned by component and prop name.
 *   3. `policiesAll` itself. It may appear only in the two files that fetch it,
 *      and every line naming it must be one of the known shapes — so a hook that
 *      starts RETURNING it, or a new consumer inside the same file, fails and
 *      names the line.
 */
describe('raw-carrier guard — who may receive the unfiltered list, by prop', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const SRC = path.resolve(HERE, '../../..');
  const REPO = path.resolve(SRC, '..');
  const RAW_CARRIERS = ['policiesAll', 'campaignPolicies'];

  const files = walk(SRC).map((full) => ({
    rel: path.relative(REPO, full).split(path.sep).join('/'),
    jsx: full.endsWith('.jsx'),
    code: stripComments(fs.readFileSync(full, 'utf8')),
  }));

  function readBraced(src, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(openIdx + 1, i);
      }
    }
    return null;
  }

  function enclosingComponent(src, idx) {
    const matches = [...src.slice(0, idx).matchAll(/<([A-Z][\w.]*)/g)];
    return matches.length ? matches[matches.length - 1][1] : '(unknown)';
  }

  /** Every `name={...}` whose expression names one of `identifiers`. */
  function propSitesNaming(identifiers) {
    const out = [];
    for (const f of files.filter((x) => x.jsx)) {
      for (const m of f.code.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*\{/g)) {
        const expr = readBraced(f.code, m.index + m[0].length - 1) ?? '';
        if (identifiers.some((id) => new RegExp(`\\b${id}\\b`).test(expr))) {
          out.push(`${f.rel} :: <${enclosingComponent(f.code, m.index)} ${m[1]}>`);
        }
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }

  it('1 · the unfiltered list reaches exactly two props, under any name', () => {
    expect(propSitesNaming(RAW_CARRIERS)).toEqual([
      // C-D10: the campaign readout. Nothing else. (H3 renamed the HomeV2
      // component CampaignCard -> CampaignHeroCard; AgentAwardsPanel's own
      // CampaignHeroCard site feeds from `ledgerPolicies`, not a raw carrier
      // identifier, so it does not appear here — see the prop-provenance
      // manifest above for that site's own classification.)
      'src/components/dashboard/AgentDashboard.jsx :: <AgentDashboardHomeV2 campaignPolicies>',
      'src/components/dashboard/HomeV2/index.jsx :: <CampaignHeroCard policies>',
    ]);
  });

  it('2a · deriveYearProduction is called only where the list is unfiltered', () => {
    const calls = [];
    for (const f of files) {
      if (f.rel === 'src/lib/ledgerProduction.js') continue; // the definition
      for (const m of f.code.matchAll(/deriveYearProduction\(\s*([A-Za-z_$][\w$.]*)/g)) {
        calls.push(`${f.rel} :: ${m[1]}`);
      }
    }
    expect(calls.sort((a, b) => a.localeCompare(b))).toEqual([
      // PipelineStrip.jsx still exists, but since LX (ledger-layout-and-l3)
      // no screen renders it; if one ever does, it must pass an unfiltered list.
      'src/components/agent/policyLedger/PipelineStrip.jsx :: policies',
      // P2d (BUG-01/BUG-04): the Awards tab's "Settled {year}" line. `ledgerPolicies`
      // is the raw getOwnPolicies list (no excludeImported — see the call site).
      'src/components/awards/AgentAwardsPanel.jsx :: ledgerPolicies',
      'src/components/dashboard/AgentDashboard.jsx :: policiesAll',
      'src/hooks/useMyProduction.js :: policiesAll',
    ]);
  });

  it('2b · the derived figures travel only to the production hero', () => {
    expect(propSitesNaming(['ledgerProduction'])).toEqual([
      'src/components/dashboard/AgentDashboard.jsx :: <AgentDashboardHomeV2 ledgerProduction>',
      'src/components/dashboard/HomeV2/index.jsx :: <HeroCard production>',
    ]);
  });

  it('3 · policiesAll lives in the two fetching files, in known shapes only', () => {
    const ALLOWED_LINES = [
      /const \[policiesAll, setPoliciesAll\]\s*= useState\(null\);/,
      /=> \(policiesAll$/,
      /\? deriveYearProduction\(policiesAll, \{/,
      /\[policiesAll, thisYear, currentWeek, allSubmissions\]/,
      /policiesAll === null && !policiesError/,
      /campaignPolicies=\{policiesAll\}/,
    ];
    const hits = [];
    for (const f of files) {
      f.code.split('\n').forEach((line, i) => {
        if (/\bpoliciesAll\b/.test(line)) hits.push({ rel: f.rel, n: i + 1, line: line.trim() });
      });
    }
    expect([...new Set(hits.map((h) => h.rel))].sort()).toEqual([
      'src/components/dashboard/AgentDashboard.jsx',
      'src/hooks/useMyProduction.js',
    ]);
    for (const h of hits) {
      expect(
        ALLOWED_LINES.some((re) => re.test(h.line)),
        `${h.rel}:${h.n} uses policiesAll in an unreviewed shape: ${h.line}`,
      ).toBe(true);
    }
    // campaignPolicies={policiesAll} is the agent dashboard's alone.
    expect(hits.filter((h) => /campaignPolicies=/.test(h.line)).map((h) => h.rel))
      .toEqual(['src/components/dashboard/AgentDashboard.jsx']);
  });

  it('the scanner actually scans (guards the guard)', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(propSitesNaming(['policies']).length).toBeGreaterThanOrEqual(8);
  });
});
