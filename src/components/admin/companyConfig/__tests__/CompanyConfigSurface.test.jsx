// @vitest-environment jsdom
//
// Smoke coverage for the Company Config surface (Run 5): the rail lists all 12
// sections, future sections carry SOON tags, Targets rows are read-only
// (disabled controls) this run, and the Feature Flags section lists the 3 real
// flags. Heavy embedded panels (awards, legacy minimums) are stubbed.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  ctx: { docs: { settings: { featureFlags: {} } }, refresh: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'admin1' }, userProfile: { name: 'Admin One' }, tenantId: 't1' }),
}));
vi.mock('../../../../hooks/useToast', () => ({ default: () => ({ show: vi.fn(), dismiss: vi.fn() }) }));
vi.mock('../../../../context/ConfigProvider', () => ({ useConfigContext: () => hoisted.ctx }));
vi.mock('../../../../services/managerService', () => ({
  getTenantUserCount: vi.fn().mockResolvedValue(214),
  getTenantUsers: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../../services/managerStandardOverrideService', () => ({
  getManagerActivityStandardOverrideCounts: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../AwardsRulesetPanel', () => ({ default: () => <div data-testid="awards-panel-stub" /> }));
vi.mock('../LegacyMinimumsModal', () => ({ default: () => <div data-testid="legacy-modal-stub" /> }));

import CompanyConfigSurface from '../CompanyConfigSurface';
import { CONFIG_SECTIONS } from '../../../../config/companyConfigRegistry';

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, // desktop path
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('CompanyConfigSurface — smoke', () => {
  it('renders the rail with all 12 sections', () => {
    render(<CompanyConfigSurface />);
    expect(screen.getByTestId('ccfg-rail')).toBeInTheDocument();
    const sectionKeys = Object.keys(CONFIG_SECTIONS);
    expect(sectionKeys).toHaveLength(12);
    sectionKeys.forEach((k) => {
      expect(screen.getByTestId(`ccfg-rail-${k}`)).toBeInTheDocument();
    });
  });

  it('tags non-Phase-1 sections with SOON in the rail', () => {
    render(<CompanyConfigSurface />);
    // Identity & Branding is a future-phase section.
    expect(within(screen.getByTestId('ccfg-rail-identity')).getByText('SOON')).toBeInTheDocument();
    // Activity Standards (Phase 1) has no SOON tag.
    expect(within(screen.getByTestId('ccfg-rail-activity')).queryByText('SOON')).toBeNull();
  });

  it('renders Targets rows read-only (disabled controls) this run', () => {
    render(<CompanyConfigSurface />);
    const row = screen.getByTestId('ccfg-row-targets.floor');
    const input = within(row).getByLabelText('amount in TTD');
    expect(input).toBeDisabled();
  });

  it('lists the 2 real feature flags in the Flags section (persistencyV2 retired — P-D6)', () => {
    render(<CompanyConfigSurface />);
    fireEvent.click(screen.getByTestId('ccfg-rail-flags'));
    expect(screen.getByTestId('ccfg-flag-policyLedgerCampaignLens')).toBeInTheDocument();
    expect(screen.getByTestId('ccfg-flag-awardsProvenance')).toBeInTheDocument();
  });

  // Run 5 DECISIONS-NEEDED #2 — palette shows the REAL value for locked
  // settings, exactly as the row does (not the 'HARDCODED'/'PLATFORM' label).
  it('palette preview shows the real value for a locked (platform) setting', () => {
    render(<CompanyConfigSurface />);
    fireEvent.click(screen.getByTestId('ccfg-find-button'));
    // aw.basis is lock:'platform' with literal value 'SETTLED API ONLY'.
    fireEvent.change(screen.getByTestId('ccfg-palette-input'), {
      target: { value: 'Qualification basis' },
    });
    const results = screen.getAllByTestId('ccfg-palette-result');
    expect(results).toHaveLength(1);
    const text = results[0].textContent;
    expect(text).toContain('SETTLED API ONLY');
    expect(text).not.toMatch(/HARDCODED|PLATFORM/);
  });
});
