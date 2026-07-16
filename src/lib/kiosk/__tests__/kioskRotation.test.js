import { describe, it, expect } from 'vitest';
import { buildKioskRotation } from '../kioskRotation';

const BASE = [
  'welcome', 'agentOfMonth', 'weekLeaderboards', 'awardsWatch', 'compliance',
];

describe('buildKioskRotation (3.6)', () => {
  it('returns the base order untouched with no dynamic input', () => {
    const out = buildKioskRotation(BASE);
    expect(out.map((e) => e.key)).toEqual(BASE);
  });

  it('splices a campaign panel per flagged campaign after weekLeaderboards', () => {
    const out = buildKioskRotation(BASE, {
      flaggedCampaigns: [{ id: 'c1' }, { id: 'c2' }],
    });
    const keys = out.map((e) => e.key);
    const wkIdx = keys.indexOf('weekLeaderboards');
    expect(keys[wkIdx + 1]).toBe('campaignLeaderboards');
    expect(keys[wkIdx + 2]).toBe('campaignLeaderboards');
    expect(out[wkIdx + 1].campaignId).toBe('c1');
    expect(out[wkIdx + 2].campaignId).toBe('c2');
    expect(keys[wkIdx + 3]).toBe('awardsWatch');
  });

  it('ignores campaigns without an id', () => {
    const out = buildKioskRotation(BASE, { flaggedCampaigns: [{}, { id: 'c1' }] });
    expect(out.filter((e) => e.key === 'campaignLeaderboards')).toHaveLength(1);
  });

  it('adds celebrations after awardsWatch only when present', () => {
    const withC = buildKioskRotation(BASE, { hasCelebrations: true }).map((e) => e.key);
    const awIdx = withC.indexOf('awardsWatch');
    expect(withC[awIdx + 1]).toBe('celebrations');

    const withoutC = buildKioskRotation(BASE, { hasCelebrations: false }).map((e) => e.key);
    expect(withoutC).not.toContain('celebrations');
  });

  it('drops base keys reported empty', () => {
    const out = buildKioskRotation(BASE, { droppedKeys: new Set(['agentOfMonth', 'compliance']) });
    const keys = out.map((e) => e.key);
    expect(keys).not.toContain('agentOfMonth');
    expect(keys).not.toContain('compliance');
    expect(keys).toContain('welcome');
  });

  it('accepts droppedKeys as an array', () => {
    const out = buildKioskRotation(BASE, { droppedKeys: ['welcome'] });
    expect(out.map((e) => e.key)).not.toContain('welcome');
  });

  it('never returns an empty rotation — falls back to welcome', () => {
    const out = buildKioskRotation(BASE, { droppedKeys: BASE });
    expect(out).toEqual([{ key: 'welcome' }]);
  });

  // Tier-3 #15: manager per-panel enable/disable.
  it('excludes manager-disabled base keys (Set)', () => {
    const out = buildKioskRotation(BASE, {
      disabledKeys: new Set(['agentOfMonth', 'compliance']),
    });
    const keys = out.map((e) => e.key);
    expect(keys).not.toContain('agentOfMonth');
    expect(keys).not.toContain('compliance');
    expect(keys).toContain('welcome');
    expect(keys).toContain('weekLeaderboards');
  });

  it('accepts disabledKeys as an array', () => {
    const out = buildKioskRotation(BASE, { disabledKeys: ['welcome'] });
    expect(out.map((e) => e.key)).not.toContain('welcome');
  });

  it('disabling every base key still falls back to the welcome slide (fallback not suppressed)', () => {
    const out = buildKioskRotation(BASE, { disabledKeys: BASE });
    expect(out).toEqual([{ key: 'welcome' }]);
  });

  it('dynamic campaign panels stay auto even when the weekLeaderboards anchor is disabled', () => {
    const out = buildKioskRotation(BASE, {
      disabledKeys: ['weekLeaderboards'],
      flaggedCampaigns: [{ id: 'c1' }],
    });
    const keys = out.map((e) => e.key);
    expect(keys).not.toContain('weekLeaderboards');
    // Campaign panel still spliced at the (now-disabled) anchor's position.
    expect(keys).toContain('campaignLeaderboards');
    expect(out.find((e) => e.key === 'campaignLeaderboards').campaignId).toBe('c1');
  });

  it('celebrations stay auto even when the awardsWatch anchor is disabled', () => {
    const out = buildKioskRotation(BASE, {
      disabledKeys: ['awardsWatch'],
      hasCelebrations: true,
    });
    const keys = out.map((e) => e.key);
    expect(keys).not.toContain('awardsWatch');
    expect(keys).toContain('celebrations');
  });

  it('disabledKeys and droppedKeys compose (both excluded)', () => {
    const out = buildKioskRotation(BASE, {
      disabledKeys: ['agentOfMonth'],
      droppedKeys: ['compliance'],
    });
    const keys = out.map((e) => e.key);
    expect(keys).not.toContain('agentOfMonth');
    expect(keys).not.toContain('compliance');
  });
});
