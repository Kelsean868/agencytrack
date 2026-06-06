import { describe, it, expect } from 'vitest';
import {
  policyValue,
  pipelineStage,
  derivePipeline,
  applyLedgerFilter,
  filterCounts,
  lifecycleNodes,
} from '../policyLedgerDerivation';

const P = (o) => ({ status: 'submitted', proposedAPI: 0, confirmedAt: null, ...o });

describe('policyLedgerDerivation', () => {
  describe('policyValue', () => {
    it('prefers managerSettledAPI, then settledAPI, then proposedAPI', () => {
      expect(policyValue({ managerSettledAPI: 9, settledAPI: 5, proposedAPI: 1 })).toBe(9);
      expect(policyValue({ settledAPI: 5, proposedAPI: 1 })).toBe(5);
      expect(policyValue({ proposedAPI: 1 })).toBe(1);
      expect(policyValue({})).toBe(0);
      expect(policyValue({ proposedAPI: 'abc' })).toBe(0);
    });
  });

  describe('pipelineStage (edge-status bucketing)', () => {
    it('confirmed (derived) → confirmed regardless of settled status', () => {
      expect(pipelineStage(P({ status: 'settled', confirmedAt: {} }))).toBe('confirmed');
    });
    it('ntu / denied / lapsed all fold into closed', () => {
      expect(pipelineStage(P({ status: 'ntu' }))).toBe('closed');
      expect(pipelineStage(P({ status: 'denied' }))).toBe('closed');
      expect(pipelineStage(P({ status: 'lapsed' }))).toBe('closed');
    });
    it('postponed folds into submitted (earliest active)', () => {
      expect(pipelineStage(P({ status: 'postponed' }))).toBe('submitted');
    });
    it('straight statuses bucket as themselves', () => {
      expect(pipelineStage(P({ status: 'submitted' }))).toBe('submitted');
      expect(pipelineStage(P({ status: 'rated' }))).toBe('rated');
      expect(pipelineStage(P({ status: 'settled' }))).toBe('settled');
    });
  });

  describe('derivePipeline', () => {
    const policies = [
      P({ id: 'a', status: 'submitted', proposedAPI: 24000 }),
      P({ id: 'b', status: 'rated', proposedAPI: 30000 }),
      P({ id: 'c', status: 'rated', proposedAPI: 21000 }),
      P({ id: 'd', status: 'settled', settledAPI: 21600 }),
      P({ id: 'e', status: 'settled', confirmedAt: {}, managerSettledAPI: 48000 }),
      P({ id: 'f', status: 'lapsed', settledAPI: 16800 }),
    ];
    const out = derivePipeline(policies);

    it('counts + sums each stage', () => {
      const byKey = Object.fromEntries(out.stages.map((s) => [s.key, s]));
      expect(byKey.submitted.count).toBe(1);
      expect(byKey.rated.count).toBe(2);
      expect(byKey.rated.sum).toBe(51000);
      expect(byKey.settled.count).toBe(1);
      expect(byKey.confirmed.count).toBe(1);
      expect(byKey.closed.count).toBe(1);
    });
    it('totals + in-flight', () => {
      expect(out.totalSum).toBe(24000 + 51000 + 21600 + 48000 + 16800);
      expect(out.inFlightSum).toBe(24000 + 51000);
    });
    it('flow bar excludes closed; percentages of the active book', () => {
      const conf = out.flow.find((f) => f.key === 'confirmed');
      expect(conf.sum).toBe(48000);
      // active book = 48000 + 21600 + 75000 = 144600 → confirmed ≈ 33%
      expect(conf.pct).toBe(33);
      expect(out.flow.every((f) => f.solid.startsWith('bg-'))).toBe(true);
    });
    it('empty input → zeroed stages, no NaN', () => {
      const e = derivePipeline([]);
      expect(e.totalSum).toBe(0);
      expect(e.flow.every((f) => f.pct === 0)).toBe(true);
    });
  });

  describe('applyLedgerFilter + filterCounts', () => {
    // Includes ntu + denied alongside lapsed to prove closed != lapsed.
    const policies = [
      P({ id: 'a', status: 'submitted', ownerName: 'Anjali Persaud' }),
      P({ id: 'b', status: 'rated', ownerName: 'Kareem Mohammed', planName: 'Platinum Edge' }),
      P({ id: 'c', status: 'settled', ownerName: 'Sara' }),
      P({ id: 'd', status: 'settled', confirmedAt: {}, ownerName: 'Naomi' }),
      P({ id: 'e', status: 'lapsed', ownerName: 'Old One' }),
      P({ id: 'f', status: 'ntu',    ownerName: 'NTU Case' }),
      P({ id: 'g', status: 'denied', ownerName: 'Denied Case' }),
    ];

    it('inflight excludes confirmed + closed', () => {
      const ids = applyLedgerFilter(policies, { filter: 'inflight' }).map((p) => p.id);
      expect(ids).toEqual(['a', 'b', 'c']);
    });
    it('action needed = settled & unconfirmed', () => {
      expect(applyLedgerFilter(policies, { filter: 'action' }).map((p) => p.id)).toEqual(['c']);
    });
    it('confirmed bucket is byte-unchanged', () => {
      expect(applyLedgerFilter(policies, { filter: 'confirmed' }).map((p) => p.id)).toEqual(['d']);
    });
    it('closed = lapsed + ntu + denied (byte-unchanged)', () => {
      expect(applyLedgerFilter(policies, { filter: 'closed' }).map((p) => p.id)).toEqual(['e', 'f', 'g']);
    });
    it('lapsed = lapsed only, excludes ntu and denied', () => {
      expect(applyLedgerFilter(policies, { filter: 'lapsed' }).map((p) => p.id)).toEqual(['e']);
    });
    it('search matches owner / plan, case-insensitive', () => {
      expect(applyLedgerFilter(policies, { search: 'platinum' }).map((p) => p.id)).toEqual(['b']);
      expect(applyLedgerFilter(policies, { search: 'naomi' }).map((p) => p.id)).toEqual(['d']);
    });
    it('filterCounts tallies each chip including lapsed', () => {
      const c = filterCounts(policies);
      expect(c.all).toBe(7);
      expect(c.inflight).toBe(3);
      expect(c.action).toBe(1);
      expect(c.confirmed).toBe(1);
      expect(c.closed).toBe(3);
      expect(c.lapsed).toBe(1);
    });
  });

  describe('lifecycleNodes', () => {
    it('rated → submitted done, rated current, rest future; confirmed node is derived', () => {
      const nodes = lifecycleNodes(P({ status: 'rated', dateSubmitted: '2026-01-01' }));
      expect(nodes.map((n) => n.state)).toEqual(['done', 'cur', 'future', 'future']);
      expect(nodes[3].derived).toBe(true);
    });
    it('confirmed → confirmed node current', () => {
      const nodes = lifecycleNodes(P({ status: 'settled', confirmedAt: { toDate: () => new Date() } }));
      expect(nodes[3].state).toBe('cur');
    });
  });
});
