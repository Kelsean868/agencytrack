import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FrSidebar from '../FrSidebar';
import FrHubHeader from '../FrHubHeader';
import FrIcon from '../FrIcon';
import { FR_NAV, FR_TABBAR, frNavItems, frFindByTab, frTargetTab, frTitleFor, frFlatItems } from '../frNav';
import MobileBottomNav from '../../../shell/MobileBottomNav';

const baseProps = () => ({
  activeTab: 'dashboard',
  onNavigate: vi.fn(),
  onAction: vi.fn(),
  report: { done: false, title: 'Weekly report', sub: 'Submit when your week is done' },
  user: { name: 'Kyron Marchan', roleLabel: 'Agent' },
  onSignOut: vi.fn(),
});

describe('frNav model', () => {
  it('hides items whose slice has not landed (never a stub)', () => {
    const ids = frNavItems().map((i) => i.id);
    // FR-4 landed Focus and Pipeline; Campaign and Trophy room land with FR-5.
    expect(ids).toContain('focus');
    expect(ids).toContain('pipeline');
    expect(ids).not.toContain('campaign');
    expect(ids).not.toContain('trophies');
    expect(ids).toContain('money');
  });
  it('phone tab bar is the canvas order: Today · Pipeline · + · Money · Arena', () => {
    expect(FR_TABBAR.map((i) => i.id)).toEqual(['today', 'pipeline', 'log', 'money', 'arena']);
  });
  it('finds the hub that owns a section route', () => {
    expect(frFindByTab('commission').item.id).toBe('money');
    expect(frFindByTab('commission').sub.id).toBe('commission');
    expect(frFindByTab('dashboard').item.id).toBe('today');
    expect(frFindByTab('nope')).toBeNull();
  });
  it('a hub click goes to its first section', () => {
    expect(frTargetTab(FR_NAV.find((i) => i.id === 'money'))).toBe('money');
    expect(frTitleFor('persistency')).toBe('Money');
    expect(frTitleFor('dashboard')).toBe('Today');
  });
  it('flat rows carry one section label per group, in order', () => {
    const labels = frFlatItems().map((r) => r.sectionLabel).filter(Boolean);
    expect(labels).toEqual(['Work', 'Numbers', 'Money', 'Compete', 'You']);
  });
});

describe('FrSidebar', () => {
  it('shows the five groups and marks Today current', () => {
    render(<FrSidebar {...baseProps()} />);
    for (const g of ['Work', 'Numbers', 'Money', 'Compete', 'You']) expect(screen.getAllByText(g).length).toBeGreaterThan(0);
    expect(screen.getByTestId('fr-nav-today')).toHaveAttribute('aria-current', 'page');
  });
  it('opens the active hub and marks the current section', () => {
    render(<FrSidebar {...baseProps()} activeTab="persistency" />);
    expect(screen.getByTestId('fr-nav-money')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('fr-nav-money-persistency')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByTestId('fr-nav-numbers-history')).toBeNull();
  });
  it('navigates: item → its route, hub → first section, section → its route', () => {
    const p = baseProps();
    render(<FrSidebar {...p} activeTab="goals" />);
    fireEvent.click(screen.getByTestId('fr-nav-ledger'));
    expect(p.onNavigate).toHaveBeenLastCalledWith('policy-ledger');
    fireEvent.click(screen.getByTestId('fr-nav-numbers'));
    expect(p.onNavigate).toHaveBeenLastCalledWith('production-report');
    fireEvent.click(screen.getByTestId('fr-nav-money-commission'));
    expect(p.onNavigate).toHaveBeenLastCalledWith('commission');
  });
  it('report card submits; account row reaches profile, settings and sign out', () => {
    const p = baseProps();
    render(<FrSidebar {...p} />);
    fireEvent.click(screen.getByTestId('fr-nav-report'));
    expect(p.onAction).toHaveBeenCalledWith('submit');
    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(p.onNavigate).toHaveBeenLastCalledWith('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(p.onNavigate).toHaveBeenLastCalledWith('settings');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(p.onSignOut).toHaveBeenCalled();
    expect(screen.getByText('KM')).toBeInTheDocument();
  });
});

describe('FrHubHeader', () => {
  it('renders nothing outside a hub', () => {
    const { container } = render(<FrHubHeader activeTab="dashboard" onNavigate={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders the hub sections with the current one marked', () => {
    const nav = vi.fn();
    render(<FrHubHeader activeTab="history" onNavigate={nav} />);
    expect(screen.getByRole('navigation', { name: 'Numbers sections' })).toBeInTheDocument();
    expect(screen.getByTestId('fr-hub-numbers-history')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByTestId('fr-hub-numbers-report'));
    expect(nav).toHaveBeenCalledWith('agent-report');
  });
});

describe('FrIcon', () => {
  it('throws on an unknown icon in development', () => {
    expect(() => render(<FrIcon name="nope" />)).toThrow(/unknown icon/);
  });
});

describe('MobileBottomNav matchTabs (FR-1)', () => {
  const Icon = () => null;
  it('keeps a hub tab lit on any of its sections', () => {
    render(
      <MobileBottomNav
        items={[{ id: 'money', label: 'Money', tabId: 'goals', matchTabs: ['goals', 'commission'], Icon }]}
        activeTab="commission"
        setActiveTab={() => {}}
      />,
    );
    expect(screen.getByTestId('bottomnav-money')).toHaveAttribute('aria-current', 'page');
  });
  it('items without matchTabs behave as before', () => {
    render(<MobileBottomNav items={[{ id: 'home', label: 'Home', tabId: 'dashboard', Icon }]} activeTab="commission" setActiveTab={() => {}} />);
    expect(screen.getByTestId('bottomnav-home')).not.toHaveAttribute('aria-current');
  });
});
