// @vitest-environment jsdom
//
// MasterSheet × Settings v2 (Fable Tier 2 · 2.4) — the sheet READS the saved
// default column preset from prefs, but an in-session override wins over a late
// Firestore reconcile (session-override-wins).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  getWeeklySubmissions: vi.fn(),
  getTenantUsers: vi.fn(),
  extractFields: vi.fn(),
  computeRatios: vi.fn(),
  extractTotalProductionCredit: vi.fn(),
  getUserPrefs: vi.fn(),
  setAppSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/managerService', () => ({
  getWeeklySubmissions: hoisted.getWeeklySubmissions,
  getTenantUsers: hoisted.getTenantUsers,
}));
vi.mock('../../../utils/extractFields', () => ({
  extractFields: hoisted.extractFields,
  computeRatios: hoisted.computeRatios,
  extractTotalProductionCredit: hoisted.extractTotalProductionCredit,
}));
vi.mock('../../../services/userPrefsService', () => ({
  getUserPrefs: (...a) => hoisted.getUserPrefs(...a),
  setAppSetting: (...a) => hoisted.setAppSetting(...a),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ tenantId: 't1', user: { uid: 'u1' } }),
}));
vi.mock('../CoachingNotesModal', () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer', () => ({ default: () => null }));

import MasterSheet from '../MasterSheet';

const FIELDS = {
  qualifiedApproaches: 6, ffisScheduled: 3, ffiConducted: 2, solutionPresentations: 2,
  newCIBooked: 1, oldCIBooked: 1, ciConducted: 2, applicationsSold: 3, livesSold: 4,
  daysWorked: 5, weekendWorked: true, weekendApi: 500, targetAPI: 10000,
  policiesDelivered: 2, serviceContacts: 1, totalNewNames: 6, targetAppsSold: 4,
};
const SUB = { id: 's1', agentId: 'a1', agentName: 'Active Agent', status: 'submitted' };

function primeData() {
  hoisted.getWeeklySubmissions.mockResolvedValue([SUB]);
  hoisted.getTenantUsers.mockResolvedValue([]);
  hoisted.extractFields.mockReturnValue(FIELDS);
  hoisted.computeRatios.mockReturnValue({ closingRatio: 50 });
  hoisted.extractTotalProductionCredit.mockReturnValue(8000);
}

const presetBtn = (name) => screen.getByRole('button', { name });

beforeEach(() => {
  localStorage.clear();
  Object.values(hoisted).forEach((fn) => fn.mockReset?.());
  hoisted.setAppSetting.mockResolvedValue(undefined);
  primeData();
});

describe('MasterSheet — reads saved default preset', () => {
  it('opens on the saved preset from prefs', async () => {
    hoisted.getUserPrefs.mockResolvedValue({ settings: { masterSheetPreset: 'Production' } });
    render(<MasterSheet selectedWeek={null} setSelectedWeek={() => {}} />);
    await waitFor(() => expect(presetBtn('Production')).toHaveAttribute('aria-pressed', 'true'));
    expect(presetBtn('All')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('MasterSheet — session override wins over late reconcile', () => {
  it('keeps the clicked preset when a later reconcile brings a different default', async () => {
    // Defer the prefs read so the user clicks BEFORE reconcile arrives.
    let resolvePrefs;
    hoisted.getUserPrefs.mockImplementation(() => new Promise((r) => { resolvePrefs = r; }));

    render(<MasterSheet selectedWeek={null} setSelectedWeek={() => {}} />);
    // Default paint is 'All' (empty mirror, prefs not yet resolved).
    await waitFor(() => expect(presetBtn('All')).toHaveAttribute('aria-pressed', 'true'));

    // User overrides to Compliance this session.
    fireEvent.click(presetBtn('Compliance'));
    expect(presetBtn('Compliance')).toHaveAttribute('aria-pressed', 'true');

    // Late reconcile brings a DIFFERENT saved default — must be ignored.
    resolvePrefs({ settings: { masterSheetPreset: 'Production' } });
    await Promise.resolve();
    await Promise.resolve();

    expect(presetBtn('Compliance')).toHaveAttribute('aria-pressed', 'true');
    expect(presetBtn('Production')).toHaveAttribute('aria-pressed', 'false');
  });
});
