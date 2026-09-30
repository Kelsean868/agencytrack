/**
 * FR-6 (Option A) — a declared reinstatement NEVER feeds money (Kyron ruling
 * R-b, 29-09-2026: awards, financing and commission read evidenced figures
 * only). Two kinds of pin:
 *   1. behaviour — the money readers over policies return the same result with
 *      and without a declaration on a lapsed policy;
 *   2. source — only the allow-listed display files read the declaration
 *      fields at all, and no award / financing / commission / settlement /
 *      points module reads them or the outlook's `declared` block. A new
 *      consumer must be added here on purpose.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../services/financingService', () => ({ getFinancingTerms: vi.fn() }));
vi.mock('../../services/policiesService', () => ({ getOwnPolicies: vi.fn() }));
vi.mock('../../services/persistencyService', () => ({ getPersistencyForAgent: vi.fn() }));
vi.mock('../../utils/dateInputs', async (importOriginal) => ({ ...(await importOriginal()), getTodayTT: vi.fn() }));

import { getProjectedBonus } from '../financingProjectedBonus';
import { getFinancingTerms } from '../../services/financingService';
import { getOwnPolicies } from '../../services/policiesService';
import { getPersistencyForAgent } from '../../services/persistencyService';
import { getTodayTT } from '../../utils/dateInputs';
import { ytdEarned, runRate } from '../../utils/commissionAnchor';
import { deriveYearProduction } from '../ledgerProduction';
import { settlementShapeFromPolicies } from '../policiesDerivation';
import { campaignPersistencyReading } from '../campaignPersistencyReading';
import { buildPersistencyOutlook } from '../persistency/persistencyOutlook';
import { roundPersistencyPct } from '../persistency/persistencyRounding';
import { CHRISTMAS } from './fixtures/awardLensFixtures';

const ts = (d) => ({ toDate: () => new Date(`${d}T04:00:00Z`), seconds: Date.parse(`${d}T04:00:00Z`) / 1000 });
const DECLARATION = { reinstatementDeclaredAt: ts('2026-05-02'), reinstatementDeclaredBy: 'a1', reinstatementNote: 'Receipt 1' };

// Own, hand-keyed (financing reads written-in-app business), in Q2 of year 1.
const POLICIES = [
  {
    id: 'p-settled', agentId: 'a1', status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary',
    proposedAPI: 12000, settledAPI: 12000, earnedCommission: 3000,
    dateWritten: ts('2026-04-05'), dateSubmitted: ts('2026-04-06'), dateIssued: ts('2026-04-20'),
  },
  {
    id: 'p-lapsed', agentId: 'a1', status: 'lapsed', productLine: 'life', newBusinessType: 'nb_ordinary',
    proposedAPI: 6000, settledAPI: 6000, earnedCommission: 1500,
    dateWritten: ts('2026-04-07'), dateSubmitted: ts('2026-04-08'), dateIssued: ts('2026-04-22'),
  },
];
const DECLARED = POLICIES.map((p) => (p.status === 'lapsed' ? { ...p, ...DECLARATION } : p));

beforeEach(() => {
  vi.clearAllMocks();
  getTodayTT.mockReturnValue('2026-05-10');
  getFinancingTerms.mockResolvedValue({ effectiveDate: '2026-01-15', financingStatus: 'on_financing' });
  getPersistencyForAgent.mockResolvedValue({ persistency: 0.92 });
});

describe('a declaration never moves a money figure', () => {
  it('financing projected bonus: identical, and the lapse still counts as lapsed', async () => {
    getOwnPolicies.mockResolvedValueOnce(POLICIES);
    const plain = await getProjectedBonus('t1', 'a1');
    getOwnPolicies.mockResolvedValueOnce(DECLARED);
    const declared = await getProjectedBonus('t1', 'a1');
    expect(declared).toEqual(plain);
    expect(plain.quarter).toBe(2);
  });

  it('commission (ytdEarned, runRate): identical', () => {
    expect(ytdEarned(DECLARED, 2026)).toBe(ytdEarned(POLICIES, 2026));
    const today = new Date('2026-05-10T12:00:00Z');
    expect(runRate(DECLARED, today)).toEqual(runRate(POLICIES, today));
  });

  it('production heroes (deriveYearProduction): identical', () => {
    expect(deriveYearProduction(DECLARED, { year: 2026 })).toEqual(deriveYearProduction(POLICIES, { year: 2026 }));
  });

  it('settlement shape feeding the awards engine: identical', () => {
    expect(settlementShapeFromPolicies(DECLARED)).toEqual(settlementShapeFromPolicies(POLICIES));
  });

  it('campaign persistency gate reading (award-bearing): identical — the declared figure never lifts it', () => {
    // A head-office book under the 90 % gate on evidence (gross 112,000, net 100,000 = 89.29 %),
    // above it with the declaration (100 %). The reading must stay on evidence.
    const HO = { productLine: 'life', agentId: 'a1', isWritingAgent: true, exportDate: '2026-09-15', importSource: 'oipa_import', statusSource: 'oipa_import' };
    const book = [
      { ...HO, id: 's', policyNumber: 'S', status: 'settled', proposedAPI: 100000, dateIssued: '2025-06-01' },
      { ...HO, id: 'l', policyNumber: 'L', status: 'lapsed', proposedAPI: 12000, dateIssued: '2025-01-10' },
    ];
    const declaredBook = book.map((p) => (p.status === 'lapsed' ? { ...p, ...DECLARATION } : p));
    const today = '2026-09-26';
    const plain = campaignPersistencyReading({ campaign: CHRISTMAS, policies: book, records: [], today });
    const withDecl = campaignPersistencyReading({ campaign: CHRISTMAS, policies: declaredBook, records: [], today });
    // R-a (#1014): the campaign reading is the 2-dp half-up rounded percent.
    expect(plain.value).toBeCloseTo(roundPersistencyPct((100000 / 112000) * 100), 9);
    expect(plain.below).toBe(true);
    expect(withDecl).toEqual(plain);
    // Live guard: the declaration really is counted — in the separate `declared` figure only.
    const o = buildPersistencyOutlook({ policies: declaredBook, records: [], today });
    expect(o.headline.persistency).toBeCloseTo(100000 / 112000, 12);
    expect(o.derived.declared.policies).toEqual(['L']);
    expect(o.derived.declared.persistency).toBeCloseTo(1, 9);
  });
});

// ── Source guard ─────────────────────────────────────────────────────────────
// ESM-safe project root (no Node globals — see clarity-mask-guard.test.js).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = join(ROOT, 'src');
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === '__tests__' || name === '__mocks__') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}
const FILES = walk(SRC).map((p) => ({ path: relative(ROOT, p).split('\\').join('/'), text: readFileSync(p, 'utf8') }));

const FIELD_RE = /reinstatementDeclared(At|By)|reinstatementNote|hasLiveDeclaration|declarationView|canDeclareReinstatement|useReinstatementDeclaration|ReinstatementDeclaration/;
const ALLOWED = new Set([
  'src/lib/persistency/reinstatementDeclaration.js',
  'src/lib/persistency/deriveFromLedger.js',
  'src/lib/fr/moneyModel.js',
  'src/services/policiesService.js',
  'src/components/persistency/ReinstatementDeclaration.jsx',
  'src/components/persistency/useReinstatementDeclaration.js',
  'src/components/fr/money/ReinstatementPlanner.jsx',
  'src/components/agent/PolicyLedgerPanel.jsx',
  'src/components/agent/policyLedger/PolicyDrillDrawer.jsx',
  'src/components/agent/policyLedger/PolicyCard.jsx',
  'src/components/agent/policyLedger/LedgerTable.jsx',
  'src/components/dashboard/AgentDashboard.jsx',
  'src/components/fr/money/FrMoneyHeader.jsx',
  'src/components/fr/work/FrFocus.jsx',
  'src/components/fr/harness/scenes/reinstatementScenes.jsx', // DEV-only harness, sample data
]);
// `campaign` covers every campaign surface and engine (award-bearing gates and tiers).
const MONEY_PATH_RE = /financing|award|commission|computePoints|settlement|ledgerProduction|campaign|leaderboard|bonus|trophy|goalDecomposition/i;

describe('source guard — declarations reach display only', () => {
  it('only the allow-listed display files read the declaration fields', () => {
    const readers = FILES.filter((f) => FIELD_RE.test(f.text)).map((f) => f.path).sort();
    expect(readers.filter((p) => !ALLOWED.has(p))).toEqual([]);
    // The guard is live: the core reader is found.
    expect(readers).toContain('src/lib/persistency/deriveFromLedger.js');
  });

  it('no award / financing / commission / settlement / points module reads a declaration or the `declared` block', () => {
    const money = FILES.filter((f) => MONEY_PATH_RE.test(f.path));
    expect(money.length).toBeGreaterThan(10); // the guard scans real files
    const offenders = money.filter((f) => FIELD_RE.test(f.text) || /\.declared\b/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
