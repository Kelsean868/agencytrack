import { describe, it, expect } from 'vitest';
import {
  policyValue,
  pipelineStage,
  derivePipeline,
  applyLedgerFilter,
  filterCounts,
  lifecycleNodes,
  PIPELINE_STAGES,
} from '../policyLedgerDerivation';

const P = (o) => ({ status: 'submitted', proposedAPI: 0, confirmedAt: null, ...o });

describe('policyLedgerDerivation', () => {
  describe('pipelineStage', () => {
    it('written gets its own bucket — it is NOT folded into Submitted', () => {
      expect(pipelineStage(P({ status: 'written' }))).toBe('written');
      expect(pipelineStage(P({ status: 'submitted' }))).toBe('submitted');
    });
  });

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
      P({ id: 'w', status: 'written', proposedAPI: 12000 }),
      P({ id: 'a', status: 'submitted', proposedAPI: 24000 }),
      P({ id: 'b', status: 'rated', proposedAPI: 30000 }),
      P({ id: 'c', status: 'rated', proposedAPI: 21000 }),
      P({ id: 'd', status: 'settled', settledAPI: 21600 }),
      P({ id: 'e', status: 'settled', confirmedAt: {}, managerSettledAPI: 48000 }),
      P({ id: 'f', status: 'lapsed', settledAPI: 16800 }),
    ];
    const out = derivePipeline(policies);

    it('has SIX tiles, Written at the head (revises the 5-tile banked decision)', () => {
      expect(out.stages.map((s) => s.key)).toEqual([
        'written', 'submitted', 'rated', 'settled', 'confirmed', 'closed',
      ]);
    });

    it('counts + sums each stage', () => {
      const byKey = Object.fromEntries(out.stages.map((s) => [s.key, s]));
      expect(byKey.written.count).toBe(1);
      expect(byKey.written.sum).toBe(12000);
      expect(byKey.submitted.count).toBe(1);
      expect(byKey.rated.count).toBe(2);
      expect(byKey.rated.sum).toBe(51000);
      expect(byKey.settled.count).toBe(1);
      expect(byKey.confirmed.count).toBe(1);
      expect(byKey.closed.count).toBe(1);
    });
    it('totals + in-flight (written counts as in-flight)', () => {
      expect(out.totalSum).toBe(12000 + 24000 + 51000 + 21600 + 48000 + 16800);
      expect(out.inFlightSum).toBe(12000 + 24000 + 51000);
    });
    it('flow bar excludes closed; percentages of the active book', () => {
      const conf = out.flow.find((f) => f.key === 'confirmed');
      expect(conf.sum).toBe(48000);
      // active book = 48000 + 21600 + 87000 = 156600 → confirmed ≈ 31%
      expect(conf.pct).toBe(31);
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
      P({ id: 'w', status: 'written', ownerName: 'Unsigned Application' }),
      P({ id: 'a', status: 'submitted', ownerName: 'Anjali Persaud' }),
      P({ id: 'b', status: 'rated', ownerName: 'Kareem Mohammed', planName: 'Platinum Edge' }),
      P({ id: 'c', status: 'settled', ownerName: 'Sara' }),
      P({ id: 'd', status: 'settled', confirmedAt: {}, ownerName: 'Naomi' }),
      P({ id: 'e', status: 'lapsed', ownerName: 'Old One' }),
      P({ id: 'f', status: 'ntu',    ownerName: 'NTU Case' }),
      P({ id: 'g', status: 'denied', ownerName: 'Denied Case' }),
    ];

    it('inflight includes written, excludes confirmed + closed', () => {
      const ids = applyLedgerFilter(policies, { filter: 'inflight' }).map((p) => p.id);
      expect(ids).toEqual(['w', 'a', 'b', 'c']);
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
      expect(c.all).toBe(8);
      expect(c.inflight).toBe(4);
      expect(c.action).toBe(1);
      expect(c.confirmed).toBe(1);
      expect(c.closed).toBe(3);
      expect(c.lapsed).toBe(1);
    });
  });

  describe('lifecycleNodes', () => {
    it('is a FIVE-node bar, Written first', () => {
      expect(lifecycleNodes(P({ status: 'submitted' })).map((n) => n.key))
        .toEqual(['written', 'submitted', 'rated', 'settled', 'confirmed']);
    });
    it('written → written current, everything after it future', () => {
      const nodes = lifecycleNodes(P({ status: 'written', dateWritten: '2026-01-01' }));
      expect(nodes.map((n) => n.state)).toEqual(['cur', 'future', 'future', 'future', 'future']);
      expect(nodes[0].date).toBeInstanceOf(Date);
    });
    it('rated → written+submitted done, rated current, rest future; confirmed node is derived', () => {
      const nodes = lifecycleNodes(P({ status: 'rated', dateSubmitted: '2026-01-01' }));
      expect(nodes.map((n) => n.state)).toEqual(['done', 'done', 'cur', 'future', 'future']);
      expect(nodes[4].derived).toBe(true);
    });
    it('confirmed → confirmed node current', () => {
      const nodes = lifecycleNodes(P({ status: 'settled', confirmedAt: { toDate: () => new Date() } }));
      expect(nodes[4].state).toBe('cur');
    });
  });
  // ── Settled is terminal when head office set the status ────────────────────
  // An OIPA-imported status carries `statusSource: 'oipa_import'`, which means
  // no manager confirmation is pending. A hand-keyed settled policy has no
  // `statusSource` and still waits on the branch manager.
  describe('settled is terminal for an imported status', () => {
    const IMPORTED = (o) => P({ statusSource: 'oipa_import', ...o });

    it('the settled stage is labelled Settled; confirmed is still Confirmed', () => {
      const byKey = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, s]));
      expect(byKey.settled.label).toBe('Settled');
      expect(byKey.confirmed.label).toBe('Confirmed');
    });

    const book = [
      ...Array.from({ length: 117 }, (_, i) => IMPORTED({ id: `s${i}`, status: 'settled' })),
      ...Array.from({ length: 112 }, (_, i) => IMPORTED({ id: `c${i}`, status: 'ntu' })),
      ...Array.from({ length: 87 }, (_, i) => IMPORTED({ id: `l${i}`, status: 'lapsed' })),
    ];

    it('derivePipeline buckets the imported settled book under settled, not confirmed', () => {
      const byKey = Object.fromEntries(derivePipeline(book).stages.map((s) => [s.key, s]));
      expect(byKey.settled.count).toBe(117);
      expect(byKey.confirmed.count).toBe(0);
    });

    it('the action and inflight chips are empty for an imported book; closed and lapsed unchanged', () => {
      const c = filterCounts(book);
      expect(c.action).toBe(0);
      expect(c.inflight).toBe(0);
      expect(c.closed).toBe(112 + 87);
      expect(c.lapsed).toBe(87);
    });

    it('GUARD — a hand-keyed settled policy still counts in action and inflight', () => {
      const c = filterCounts([P({ id: 'hand', status: 'settled' })]);
      expect(c.action).toBe(1);
      expect(c.inflight).toBe(1);
    });

    it('lifecycleNodes ends at Settled for an imported settled policy', () => {
      const nodes = lifecycleNodes(IMPORTED({ status: 'settled' }));
      expect(nodes).toHaveLength(4);
      expect(nodes[3].key).toBe('settled');
      expect(nodes[3].state).not.toBe('future');
    });

    it('lifecycleNodes still draws five nodes for a hand-keyed settled policy', () => {
      const nodes = lifecycleNodes(P({ status: 'settled' }));
      expect(nodes).toHaveLength(5);
      expect(nodes.map((n) => n.key)).toContain('confirmed');
    });

    it('an imported policy that DOES carry confirmedAt gets its fifth node back', () => {
      const nodes = lifecycleNodes(IMPORTED({ status: 'settled', confirmedAt: { toDate: () => new Date() } }));
      expect(nodes).toHaveLength(5);
      expect(nodes[4].state).toBe('cur');
    });
  });
});
