// @vitest-environment jsdom
//
// Shell command-palette wiring (Fable Tier 1 · 1.1): Cmd/Ctrl-K toggles the
// palette, and the TopBar search trigger opens it. Shell's other children are
// stubbed so this isolates the palette open/close plumbing.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../Sidebar', () => ({ default: () => null }));
vi.mock('../MobileBottomNav', () => ({ default: () => null }));
vi.mock('../TopBar', () => ({
  default: ({ onOpenSearch }) => (
    <button data-testid="topbar-search-stub" onClick={onOpenSearch}>search</button>
  ),
}));
vi.mock('../CommandPalette', () => ({
  default: ({ onClose }) => (
    <div data-testid="cmdk-stub">
      <button data-testid="cmdk-close" onClick={onClose}>close</button>
    </div>
  ),
}));
vi.mock('../../../hooks/usePullToRefresh', () => ({ usePullToRefresh: () => 'idle' }));
vi.mock('../../../hooks/useFrequentNav', () => ({ default: () => [] }));
vi.mock('../navSections', () => ({ buildSectionMap: () => new Map() }));

import Shell from '../Shell';

afterEach(() => cleanup());

function renderShell() {
  return render(
    <Shell navItems={[]} activeTab="dashboard" setActiveTab={vi.fn()} onAction={vi.fn()}>
      <div>content</div>
    </Shell>
  );
}

describe('Shell — command palette wiring', () => {
  it('does not render the palette until invoked', () => {
    renderShell();
    expect(screen.queryByTestId('cmdk-stub')).toBeNull();
  });

  it('Ctrl-K opens the palette and toggles it closed again', () => {
    renderShell();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('cmdk-stub')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.queryByTestId('cmdk-stub')).toBeNull();
  });

  it('Meta-K (mac) opens the palette', () => {
    renderShell();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByTestId('cmdk-stub')).toBeInTheDocument();
  });

  it('the TopBar search trigger opens the palette, and onClose dismisses it', () => {
    renderShell();
    fireEvent.click(screen.getByTestId('topbar-search-stub'));
    expect(screen.getByTestId('cmdk-stub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cmdk-close'));
    expect(screen.queryByTestId('cmdk-stub')).toBeNull();
  });
});
