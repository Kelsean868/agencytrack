// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getDailyEntry: vi.fn(),
  saveDailyEntry: vi.fn(),
  getDailyEntriesForWeek: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/dailyActivityService', () => ({
  getDailyEntry: hoisted.getDailyEntry,
  saveDailyEntry: hoisted.saveDailyEntry,
  getDailyEntriesForWeek: hoisted.getDailyEntriesForWeek,
}));

import DailyCaptureV2 from '../DailyCaptureV2';
import { deriveCountStripChips } from '../DailyCaptureV2.helpers';
import { computeTotalProductionCredit, computeLumpsumCredit } from '../../../lib/schema/weeklyReport.computations';

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.useAuth.mockReturnValue({
    user: { uid: 'agent1' },
    userProfile: { name: 'Test Agent' },
    tenantId: 'tenant1',
  });
  hoisted.getDailyEntry.mockResolvedValue(null);
  hoisted.saveDailyEntry.mockResolvedValue(undefined);
  hoisted.getDailyEntriesForWeek.mockResolvedValue([]);
});

// ─── deriveCountStripChips — pure ────────────────────────────────────────────

describe('deriveCountStripChips (pure)', () => {
  it('returns zeros for an empty list', () => {
    expect(deriveCountStripChips([])).toEqual({ appr: 0, ffi: 0, ci: 0, apps: 0 });
  });

  it('sums verified daily keys across multiple docs', () => {
    const docs = [
      {
        qualifiedApproaches: 3,
        ffiConducted: 1,
        ciConducted: 2,
        newBusiness: { apps: 1 },
      },
      {
        qualifiedApproaches: 4,
        ffiConducted: 2,
        ciConducted: 0,
        newBusiness: { apps: 1 },
      },
    ];
    expect(deriveCountStripChips(docs)).toEqual({ appr: 7, ffi: 3, ci: 2, apps: 2 });
  });

  it('does NOT read the brief-stale keys (ffisConducted / cisConducted / newCisBooked)', () => {
    // Belt-and-braces against regression to the pre-Phase-0 stale-cased keys.
    const docs = [
      {
        ffisConducted: 99,   // stale-cased — must NOT be summed
        cisConducted:  99,   // stale-cased — must NOT be summed
        newCisBooked:  99,   // stale-cased — must NOT be summed
        ffiConducted:  1,
        ciConducted:   1,
        newBusiness:   { apps: 1 },
      },
    ];
    const chips = deriveCountStripChips(docs);
    expect(chips.ffi).toBe(1);
    expect(chips.ci).toBe(1);
    expect(chips.apps).toBe(1);
  });

  it('coerces missing fields to 0', () => {
    const docs = [{ qualifiedApproaches: 5 }, {}];
    expect(deriveCountStripChips(docs)).toEqual({ appr: 5, ffi: 0, ci: 0, apps: 0 });
  });
});

// ─── DailyCaptureV2 ──────────────────────────────────────────────────────────

describe('DailyCaptureV2', () => {
  it('renders dialog with v2 testid and Log Today title', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    expect(await screen.findByTestId('daily-capture-v2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /log today/i })).toBeInTheDocument();
  });

  it('shows the count strip with all four chip labels', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await screen.findByTestId('dcv2-count-strip');
    expect(screen.getByTestId('dcv2-chip-appr')).toBeInTheDocument();
    expect(screen.getByTestId('dcv2-chip-ffi')).toBeInTheDocument();
    expect(screen.getByTestId('dcv2-chip-ci')).toBeInTheDocument();
    expect(screen.getByTestId('dcv2-chip-apps')).toBeInTheDocument();
  });

  it('count-strip chips reflect deriveCountStripChips after week read resolves', async () => {
    hoisted.getDailyEntriesForWeek.mockResolvedValue([
      { qualifiedApproaches: 6, ffiConducted: 2, ciConducted: 1, newBusiness: { apps: 1 } },
      { qualifiedApproaches: 1, ffiConducted: 1, ciConducted: 1, newBusiness: { apps: 1 } },
    ]);
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('dcv2-chip-appr')).toHaveTextContent('7');
      expect(screen.getByTestId('dcv2-chip-ffi')).toHaveTextContent('3');
      expect(screen.getByTestId('dcv2-chip-ci')).toHaveTextContent('2');
      expect(screen.getByTestId('dcv2-chip-apps')).toHaveTextContent('2');
    });
  });

  it('Save writes the entry shape with verified storage keys (no stale-cased keys)', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());

    const args = hoisted.saveDailyEntry.mock.calls[0];
    expect(args[0]).toBe('tenant1');
    expect(args[1]).toBe('agent1');
    expect(args[2]).toBe('Test Agent');
    expect(typeof args[3]).toBe('string');   // date
    const entry = args[4];

    // Verified source keys must be present in the entry shape:
    for (const k of [
      'qualifiedApproaches', 'appointmentsSet', 'ffisScheduled', 'ffiConducted',
      'solutionPresentations', 'newCIBooked', 'oldCIBooked', 'ciConducted',
      'newNamesAdded', 'oldNamesWorked', 'serviceContacts',
      'hoursWorked', 'wins', 'blockers', 'notes',
    ]) {
      expect(entry).toHaveProperty(k);
    }
    expect(entry.newBusiness).toEqual(expect.objectContaining({ apps: 0, api: 0 }));
    expect(entry.pppIncreases).toEqual(expect.objectContaining({ apps: 0, apiIncrease: 0 }));
    expect(entry.lumpsums).toEqual(expect.objectContaining({ grossAmount: 0 }));

    // Stale-cased keys from the pre-Phase-0 brief MUST NOT be present:
    expect(entry).not.toHaveProperty('ffisConducted');
    expect(entry).not.toHaveProperty('cisConducted');
    expect(entry).not.toHaveProperty('newCisBooked');
    expect(entry).not.toHaveProperty('oldCisBooked');
  });

  it('stepper "+" increments the bound storage key and Save writes it', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await screen.findByTestId('dcv2-save');
    // Press "+" on the "FFIs conducted" stepper → should set ffiConducted = 1.
    const inc = screen.getByRole('button', { name: /FFIs conducted increase/i });
    fireEvent.click(inc);
    fireEvent.click(inc);
    fireEvent.click(screen.getByTestId('dcv2-save'));
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    const entry = hoisted.saveDailyEntry.mock.calls[0][4];
    expect(entry.ffiConducted).toBe(2);
  });

  it('Save calls onClose after the post-save timeout', async () => {
    const onClose = vi.fn();
    render(<DailyCaptureV2 onClose={onClose} />);
    const save = await screen.findByTestId('dcv2-save');
    fireEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('refreshes the count strip after a successful Save', async () => {
    hoisted.getDailyEntriesForWeek
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { qualifiedApproaches: 2, ffiConducted: 0, ciConducted: 0, newBusiness: { apps: 0 } },
      ]);
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('dcv2-chip-appr')).toHaveTextContent('0'));

    fireEvent.click(screen.getByTestId('dcv2-save'));
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('dcv2-chip-appr')).toHaveTextContent('2'));
  });

  it('per-day credit (header slot) matches computeTotalProductionCredit', async () => {
    // Seed an existing daily entry so the surface mounts pre-populated.
    const grossLump = 5000;
    hoisted.getDailyEntry.mockResolvedValue({
      newBusiness:  { apps: 2, api: 10000 },
      pppIncreases: { apps: 1, apiIncrease: 3000 },
      lumpsums:     { grossAmount: grossLump },
    });
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const expectedCredit = computeTotalProductionCredit({
      newBusiness:  { apps: 2, api: 10000 },
      pppIncreases: { apps: 1, apiIncrease: 3000 },
      lumpsums:     { grossAmount: grossLump, apiCredit: computeLumpsumCredit(grossLump) },
    });
    expect(expectedCredit).toBe(10000 + 3000 + 500);

    const slot = await screen.findByTestId('dcv2-day-credit');
    // formatCurrency wraps with TTD prefix — assert the numeric body appears.
    expect(slot.textContent).toMatch(/13[,.]500/);
  });
});
