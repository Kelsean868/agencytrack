import { describe, it, expect } from 'vitest';
import { awardLensSummary, tierDetailLine, daysBetween, dayMonth, persistencyRingLabels } from '../awardLensView';
import { deriveAwardLens } from '../ledgerProduction';
import { awardLensPeriods } from '../../utils/awardsEngine';
import { TODAY, CHRISTMAS, POLICIES } from './fixtures/awardLensFixtures';

const periods = awardLensPeriods({ today: TODAY, campaigns: [CHRISTMAS] });
const award = (key) => [...periods.current, ...periods.past].find((a) => a.key === key);
const summaryFor = (key, opts) => awardLensSummary(deriveAwardLens(POLICIES, award(key), opts), { today: TODAY });

// Ranked awards are decided against other advisors, so no ranked card may
// promise the award (docs/briefs/ledger-lens-build.md § Standing decisions).
const PROMISE_RE = /\b(qualif(y|ies|ied)|you'?ll win|you win|you won)\b/i;

describe('awardLensSummary — campaign card', () => {
  const s = summaryFor('campaign:xmas26');

  it('eyebrow, chip, title from the campaign', () => {
    expect(s.eyebrow).toBe('Christmas campaign · 1 Jul – 31 Dec');
    expect(s.chip).toBe('96 days left');
    expect(s.title).toBe('Christmas Campaign & Retreat');
  });

  it('ring against the default (next) tier with pending and apps', () => {
    expect(s.hasRing).toBe(true);
    expect(s.pct).toBe(27);
    expect(s.settledLabel).toBe('73,946');
    expect(s.targetLabel).toBe('275,000 (Champion)');
    expect(s.appsLabel).toBe('3 of 35 apps');
    expect(s.pendingLabel).toBe('36,000');
    expect(s.ringAria).toBe('Settled 27 percent, with submitted 40 percent');
  });

  it('pace to the chosen tier by the campaign end (96 days)', () => {
    // (275,000 − 73,946) ÷ (96 / 7) = 14,660.19 → "14.7K"
    expect(s.pace.apiPerWeek).toBeCloseTo((275_000 - 73_946) / (96 / 7), 2);
    expect(s.line1).toBe('TTD 14.7K a week to reach Champion.');
    expect(s.line2).toBe('Family policies do not count. Persistency gate: 90% in December.');
  });

  it('switching the target tier changes the target AND the pace, never the credit', () => {
    const vip = summaryFor('campaign:xmas26', { targetTierName: 'VIP' });
    expect(vip.targetLabel).toBe('375,000 (VIP)');
    expect(vip.pct).toBe(20);
    expect(vip.pace.apiPerWeek).toBeCloseTo((375_000 - 73_946) / (96 / 7), 2);
    expect(vip.line1).toBe('TTD 22K a week to reach VIP.');
    expect(vip.settledLabel).toBe(s.settledLabel);
  });
});

describe('awardLensSummary — ranked cards (month / quarter / annual)', () => {
  it('month: boxes, ranked line, Rule 10 recognition-only line', () => {
    const s = summaryFor('month:2026-09');
    expect(s.hasRing).toBe(false);
    expect(s.eyebrow).toBe('Advisor of the month · September');
    expect(s.title).toBe('Your September credit');
    expect(s.chip).toBe('4 days left');
    expect([s.settledLabel, s.appsLabel, s.pendingLabel, s.pendingAppsLabel]).toEqual(['49,346', '2 apps', '36,000', '1 app']);
    expect(s.line1).toBe('Ranked award — your branch manager chooses the winner.');
    expect(s.line2).toBe('Jul–Dec: recognition only, no cash, while the Christmas Campaign & Retreat runs.');
  });

  it('quarter: names the one pending policy by its last four digits', () => {
    const s = summaryFor('quarter:2026-Q3');
    expect(s.eyebrow).toBe('Quarterly award · Jul – Sep');
    expect(s.title).toBe('Your Q3 credit');
    expect(s.line1).toBe('Settle ···2415 by 30 Sep and it counts for Q3.');
  });

  it('annual: issue-date window line', () => {
    const s = summaryFor('annual:2026');
    expect(s.title).toBe('Your 2026 award credit');
    expect(s.line1).toBe('Counted by issue date, 1 Jan – 31 Dec 2026.');
    expect(s.line2).toBe('Family policies do not count for awards.');
  });

  it('wording guard — no ranked card promises the award', () => {
    for (const key of ['month:2026-09', 'quarter:2026-Q3', 'annual:2026', 'month:2026-08', 'quarter:2026-Q2']) {
      const s = summaryFor(key);
      for (const text of [s.eyebrow, s.chip, s.title, s.line1, s.line2]) {
        expect(text ?? '').not.toMatch(PROMISE_RE);
      }
    }
  });
});

describe('awardLensSummary — MDRT', () => {
  it('ring against the ruleset target; family counts here', () => {
    const s = summaryFor('mdrt:2026');
    expect(s.hasRing).toBe(true);
    expect(s.title).toBe('Million Dollar Round Table');
    expect(s.targetLabel).toBe('688,800');
    expect(s.pct).toBe(14); // 96,146 / 688,800
    expect(s.settledLabel).toBe('96,146');
    expect(s.line1).toMatch(/^TTD [\d.]+K a week to qualify by 31 Dec\.$/);
    expect(s.line2).toBe('Family and self policies count here.');
  });
});

describe('awardLensSummary — closed period', () => {
  it('Aug 2026 reads as final', () => {
    const s = summaryFor('month:2026-08');
    expect(s.chip).toBe('Closed · final credit');
    expect(s.title).toBe('Your August credit (final)');
    expect(s.line1).toBe('Closed period. Nothing more can count.');
    expect(s.line2).toBe('Use this to check against the head-office list for August.');
    expect(s.pendingAppsLabel).toBe('—');
    expect(s.pace).toBeNull();
  });

  it('a closed period with nothing settled says so', () => {
    const s = awardLensSummary(deriveAwardLens([], award('quarter:2026-Q2')), { today: TODAY });
    expect(s.line1).toBe('No settled policies were dated in Q2.');
    expect(s.line2).toBe('Closed period.');
  });
});

describe('helpers', () => {
  it('tierDetailLine matches the D1 copy', () => {
    expect(tierDetailLine(CHRISTMAS.tiers[0])).toBe('Champion: TTD 275,000 API + 35 apps · TTD 7,000 cash');
  });
  it('dates', () => {
    expect(daysBetween('2026-09-26', '2026-12-31')).toBe(96);
    expect(dayMonth('2026-07-01')).toBe('1 Jul');
  });
});

describe('awardLensSummary — LX campaign card strings (D1 / D3)', () => {
  const s = summaryFor('campaign:xmas26');

  it('API + Applications ring labels from the engine figures', () => {
    expect(s.rings.api.center).toBe('27%');
    expect(s.rings.api.sub).toBe('73.9K / 275K');
    expect(s.rings.api.subPending).toBe('+36K submitted');
    expect(s.rings.api.subWide).toBe('73,946 + 36,000 submitted');
    expect(s.rings.apps.center).toBe('3/35');
    expect(s.rings.apps.sub).toBe('32 to go · +1 sub.');
    expect(s.rings.apps.subWide).toBe('3 + 1 submitted / 35');
  });

  it('faint-ring notes (D1 mobile, D3 desktop)', () => {
    expect(s.pendingNote).toBe('Plus TTD 36,000 (1 app) submitted — the faint ring. It counts when head office settles it.');
    expect(s.pendingNoteShort).toBe('Faint ring = TTD 36,000 submitted, counts when settled.');
  });

  it('eyebrow falls back to the campaign name without a shortName', () => {
    const periodsNoShort = awardLensPeriods({ today: TODAY, campaigns: [{ ...CHRISTMAS, shortName: undefined }] });
    const a = periodsNoShort.current.find((x) => x.kind === 'campaign');
    const sum = awardLensSummary(deriveAwardLens(POLICIES, a), { today: TODAY });
    expect(sum.eyebrow).toBe('Christmas Campaign & Retreat · 1 Jul – 31 Dec');
  });

  it('ranked and MDRT awards carry no campaign rings', () => {
    expect(summaryFor('month:2026-09').rings).toBeNull();
    expect(summaryFor('mdrt:2026').rings).toBeNull();
  });
});

describe('persistencyRingLabels', () => {
  it('known reading → label + gate month', () => {
    expect(persistencyRingLabels({ value: 86.6, label: '86.6%', below: true, gateMonthKey: '2026-12', threshold: 90 }))
      .toEqual(expect.objectContaining({ center: '86.6%', sub: 'Gate 90% · Dec' }));
  });
  it('unknown → "—" and "Not yet known"; no reading → null', () => {
    const l = persistencyRingLabels({ value: null, label: '—', below: false, gateMonthKey: null, threshold: 90 });
    expect(l.center).toBe('—');
    expect(l.sub).toBe('Not yet known');
    expect(persistencyRingLabels(null)).toBeNull();
  });
});
