import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import KioskShell from '../KioskShell';
import { PANEL_ORDER, PANEL_DURATIONS } from '../../../lib/kiosk/kioskConfig';

// Mock all panel components to simple identifiable divs
vi.mock('../panels/WelcomePanel',          () => ({ default: () => <div data-panel="welcome" /> }));
vi.mock('../panels/BranchOverviewPanel',   () => ({ default: () => <div data-panel="branchOverview" /> }));
vi.mock('../panels/RunningTotalsPanel',    () => ({ default: () => <div data-panel="branchRunningTotals" /> }));
vi.mock('../panels/UnitLeaderboardPanel',  () => ({ default: () => <div data-panel="unitLeaderboard" /> }));
vi.mock('../panels/LastWeekRecapPanel',    () => ({ default: () => <div data-panel="lastWeekRecap" /> }));
vi.mock('../panels/YTDLeaderboardsPanel',  () => ({ default: () => <div data-panel="ytdLeaderboards" /> }));
vi.mock('../panels/QTDLeaderboardsPanel',  () => ({ default: () => <div data-panel="qtdLeaderboards" /> }));
vi.mock('../panels/MTDLeaderboardsPanel',  () => ({ default: () => <div data-panel="mtdLeaderboards" /> }));
vi.mock('../panels/WeekLeaderboardsPanel', () => ({ default: () => <div data-panel="weekLeaderboards" /> }));
vi.mock('../panels/WeeklyActivityPanel',   () => ({ default: () => <div data-panel="weeklyActivity" /> }));
vi.mock('../panels/AwardsWatchPanel',      () => ({ default: () => <div data-panel="awardsWatch" /> }));
vi.mock('../panels/CompliancePanel',       () => ({ default: () => <div data-panel="compliance" /> }));
vi.mock('../FullscreenButton',             () => ({ default: () => <button data-testid="fullscreen-btn" /> }));

vi.mock('../../../services/managerService', () => ({
  getAllYTDSubmissions: vi.fn().mockResolvedValue([]),
  getTenantUsers: vi.fn().mockResolvedValue([]),
}));

describe('KioskShell', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  async function mountShell() {
    let container;
    await act(async () => {
      ({ container } = render(<KioskShell tenantId="t1" branchId="b1" />));
      // Let the async fetchData resolve
      await vi.runAllTimersAsync();
    });
    return container;
  }

  it('renders all 12 panels in PANEL_ORDER sequence', async () => {
    await mountShell();

    for (const panelKey of PANEL_ORDER) {
      expect(document.querySelector(`[data-panel="${panelKey}"]`)).not.toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(PANEL_DURATIONS[panelKey] * 1000);
      });
    }
  });

  it('PANEL_ORDER has exactly 12 entries', () => {
    expect(PANEL_ORDER.length).toBe(12);
  });

  it('branchRunningTotals is at slot #3 (index 2)', () => {
    expect(PANEL_ORDER[2]).toBe('branchRunningTotals');
  });

  it('FullscreenButton is mounted inside the shell', async () => {
    await mountShell();
    expect(screen.getByTestId('fullscreen-btn')).toBeInTheDocument();
  });

  it('each panel in PANEL_DURATIONS has a positive duration', () => {
    for (const [key, secs] of Object.entries(PANEL_DURATIONS)) {
      expect(secs).toBeGreaterThan(0);
      expect(PANEL_ORDER).toContain(key);
    }
  });
});
