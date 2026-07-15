// @vitest-environment jsdom
//
// State-machine coverage for the Company Config surface (Run 5, Items 2A+4):
// draft auto-clear on equal, reset staging, rowState precedence, saveAll
// partition (plain), and immediate commitFlag. ConfigProvider + configService +
// managerService are mocked; the registry is real.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────
// vi.mock is hoisted above module init, so the ctx it closes over must be
// hoisted too (vi.hoisted) — a plain `const` would TDZ inside the factory.
const hoisted = vi.hoisted(() => ({ ctx: { docs: {}, refresh: null } }));
const ctx = hoisted.ctx;
vi.mock('../../../../context/ConfigProvider', () => ({
  useConfigContext: () => hoisted.ctx,
}));

vi.mock('../../../../services/configService', () => ({
  ALLOWED_FLAG_KEYS: ['persistencyV2', 'policyLedgerCampaignLens', 'awardsProvenance'],
  savePlainValues: vi.fn().mockResolvedValue(undefined),
  resetPlainValues: vi.fn().mockResolvedValue(undefined),
  setFeatureFlagOn: vi.fn().mockResolvedValue(undefined),
  setFeatureFlagOff: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/managerService', () => ({
  getTenantUserCount: vi.fn().mockResolvedValue(214),
}));

import useCompanyConfigState from '../useCompanyConfigState';
import * as configService from '../../../../services/configService';
import { CONFIG_FLAGS } from '../../../../config/companyConfigRegistry';

const ACTOR = { uid: 'admin1', name: 'Admin One' };
const ACT_ID = 'act.standards.unit_manager';

function setDocs(docs) { ctx.docs = docs; }

function mount() {
  return renderHook(() => useCompanyConfigState({ tenantId: 't1', actor: ACTOR, company: 'Tatil Life', notify: vi.fn() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.docs = {};
  ctx.refresh = vi.fn().mockResolvedValue(undefined);
});

describe('draft auto-clear on equal (deep)', () => {
  it('a draft equal to the stored base value auto-clears; a different value stays', () => {
    setDocs({ managerActivityStandards: { unit_manager: { jfwCount: 5 } } });
    const { result } = mount();

    // Equal → no draft.
    act(() => result.current.setDraftValue(ACT_ID, { jfwCount: 5 }));
    expect(result.current.draftCount).toBe(0);

    // Different → draft present.
    act(() => result.current.setDraftValue(ACT_ID, { jfwCount: 6 }));
    expect(result.current.draftCount).toBe(1);
    expect(result.current.rowState(ACT_ID)).toBe('draft');

    // Back to equal (deep) → auto-clears.
    act(() => result.current.setDraftValue(ACT_ID, { jfwCount: 5 }));
    expect(result.current.draftCount).toBe(0);
  });
});

describe('reset staging', () => {
  it('stageReset marks the row reset; effective falls back to the code default; undo clears it', () => {
    setDocs({ managerActivityStandards: { unit_manager: { jfwCount: 5 } } });
    const { result } = mount();

    act(() => result.current.stageReset(ACT_ID));
    expect(result.current.rowState(ACT_ID)).toBe('reset');
    // Activity code default is null ("no standard set").
    expect(result.current.effective(ACT_ID)).toBeNull();

    act(() => result.current.undoDraft(ACT_ID));
    expect(result.current.rowState(ACT_ID)).toBe('custom');
  });
});

describe('rowState precedence (lock > draft > custom > default)', () => {
  it('locked wins over everything', () => {
    const { result } = mount();
    expect(result.current.rowState('aw.season')).toBe('soon');   // lock: 'soon'
    expect(result.current.rowState('aw.basis')).toBe('platform'); // lock: 'platform'
  });

  it('draft > custom for a stored activity item', () => {
    setDocs({ managerActivityStandards: { unit_manager: { jfwCount: 5 } } });
    const { result } = mount();
    expect(result.current.rowState(ACT_ID)).toBe('custom');
    act(() => result.current.setDraftValue(ACT_ID, { jfwCount: 9 }));
    expect(result.current.rowState(ACT_ID)).toBe('draft');
  });

  it('default when neither stored nor drafted', () => {
    const { result } = mount();
    expect(result.current.rowState(ACT_ID)).toBe('default');
  });
});

describe('saveAll partition (plain mode)', () => {
  it('edited cells → savePlainValues with dot-paths + section label + from-values; cleared cells → resetPlainValues', async () => {
    setDocs({ managerActivityStandards: { unit_manager: { jfwCount: 5, namesSourced: 3 } } });
    const { result } = mount();

    // Change jfwCount 5→8 (edit) and drop namesSourced (clear).
    act(() => result.current.setDraftValue(ACT_ID, { jfwCount: 8 }));

    await act(async () => { await result.current.saveAll(); });

    expect(configService.savePlainValues).toHaveBeenCalledTimes(1);
    const [tenant, docId, updates, actor, meta] = configService.savePlainValues.mock.calls[0];
    expect(tenant).toBe('t1');
    expect(docId).toBe('managerActivityStandards');
    expect(updates).toEqual({ 'unit_manager.jfwCount': 8 });
    expect(actor).toBe(ACTOR);
    expect(meta.sectionLabel).toBe('Activity Standards');
    expect(meta.fromValues['unit_manager.jfwCount']).toBe(5);

    expect(configService.resetPlainValues).toHaveBeenCalledTimes(1);
    const [, , dotPaths, , , resetMeta] = configService.resetPlainValues.mock.calls[0];
    expect(dotPaths).toContain('unit_manager.namesSourced');
    expect(resetMeta.sectionLabel).toBe('Activity Standards');

    // Drafts cleared + committed re-read after save.
    expect(result.current.draftCount).toBe(0);
    expect(ctx.refresh).toHaveBeenCalled();
  });

  it('a staged reset deletes every stored key for the role via resetPlainValues (no save call)', async () => {
    setDocs({ managerActivityStandards: { unit_manager: { jfwCount: 5, namesSourced: 3 } } });
    const { result } = mount();

    act(() => result.current.stageReset(ACT_ID));
    await act(async () => { await result.current.saveAll(); });

    expect(configService.savePlainValues).not.toHaveBeenCalled();
    expect(configService.resetPlainValues).toHaveBeenCalledTimes(1);
    const [, , dotPaths] = configService.resetPlainValues.mock.calls[0];
    expect(dotPaths.sort()).toEqual(['unit_manager.jfwCount', 'unit_manager.namesSourced']);
  });
});

describe('commitFlag (immediate — no draft)', () => {
  it('enabling calls setFeatureFlagOn, refreshes, and never touches the draft map', async () => {
    const flag = CONFIG_FLAGS[0]; // persistencyV2
    const { result } = mount();

    await act(async () => { await result.current.commitFlag(flag, true); });

    expect(configService.setFeatureFlagOn).toHaveBeenCalledWith('t1', 'persistencyV2', ACTOR);
    expect(configService.setFeatureFlagOff).not.toHaveBeenCalled();
    expect(result.current.draftCount).toBe(0);
    expect(ctx.refresh).toHaveBeenCalled();
  });

  it('disabling calls setFeatureFlagOff', async () => {
    const flag = CONFIG_FLAGS[0];
    const { result } = mount();
    await act(async () => { await result.current.commitFlag(flag, false); });
    expect(configService.setFeatureFlagOff).toHaveBeenCalledWith('t1', 'persistencyV2', ACTOR);
  });

  it('flagOn reflects the stored featureFlags map (=== true)', async () => {
    setDocs({ settings: { featureFlags: { persistencyV2: true } } });
    const { result } = mount();
    await waitFor(() => expect(result.current.userCount).toBe(214));
    expect(result.current.flagOn('persistencyV2')).toBe(true);
    expect(result.current.flagOn('awardsProvenance')).toBe(false);
  });
});
