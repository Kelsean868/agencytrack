// @vitest-environment jsdom
//
// Light RTL coverage for the five-state row grammar (design handoff README
// §The Setting-Row Grammar). Each case asserts the state's distinguishing
// marker only — full visual fidelity is covered by the manual preview /
// smoke pass, not unit tests.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ConfigRow from '../ConfigRow';

const BASE_ITEM = { id: 'pace-warning', label: 'Pace-warning threshold', def: 80 };

describe('ConfigRow — state grammar', () => {
  it('default: shows the faint DEFAULT tag and renders the control cluster', () => {
    render(
      <ConfigRow item={BASE_ITEM} state="default" effectiveValue={80}>
        <input aria-label="value" defaultValue={80} />
      </ConfigRow>
    );
    expect(screen.getByTestId('ccfg-row-pace-warning-default-tag')).toHaveTextContent('DEFAULT');
    expect(screen.getByLabelText('value')).toBeInTheDocument();
  });

  it('custom: shows provenance + a "Reset to default" affordance', () => {
    const onReset = vi.fn();
    render(
      <ConfigRow
        item={BASE_ITEM}
        state="custom"
        effectiveValue={85}
        provenance={{ whoName: 'Alicia Gopaul', date: '12 Jun 2026' }}
        onReset={onReset}
      >
        <input aria-label="value" defaultValue={85} />
      </ConfigRow>
    );
    expect(screen.getByText(/Changed by/)).toHaveTextContent('Changed by Alicia Gopaul · 12 Jun 2026');
    const resetBtn = screen.getByTestId('ccfg-row-pace-warning-reset');
    expect(resetBtn).toHaveTextContent('Reset to default (80)');
  });

  it('draft: shows the unsaved note + an Undo link', () => {
    const onUndo = vi.fn();
    render(
      <ConfigRow item={BASE_ITEM} state="draft" effectiveValue={90} draft onUndo={onUndo}>
        <input aria-label="value" defaultValue={90} />
      </ConfigRow>
    );
    expect(screen.getByText('Unsaved — applies to everyone on save')).toBeInTheDocument();
    expect(screen.getByTestId('ccfg-row-pace-warning-undo')).toHaveTextContent('Undo');
  });

  it('platform: shows the PLATFORM lock chip and does not render the control cluster', () => {
    render(
      <ConfigRow item={{ ...BASE_ITEM, lock: 'platform' }} state="platform" effectiveValue="AST · UTC-4 · TTD">
        <input aria-label="value" data-testid="should-not-render" />
      </ConfigRow>
    );
    expect(screen.getByTestId('ccfg-row-pace-warning-platform-chip')).toHaveTextContent('PLATFORM');
    expect(screen.queryByTestId('should-not-render')).not.toBeInTheDocument();
  });

  it('soon: shows the HARDCODED · UNLOCKS chip and wraps a disabled control', () => {
    render(
      <ConfigRow item={{ ...BASE_ITEM, lock: 'soon', tier: 'TIER 2' }} state="soon" effectiveValue={1020000}>
        <input aria-label="value" disabled defaultValue={1020000} />
      </ConfigRow>
    );
    expect(screen.getByTestId('ccfg-row-pace-warning-soon-chip')).toHaveTextContent('HARDCODED · UNLOCKS TIER 2');
    expect(screen.getByLabelText('value')).toBeDisabled();
  });
});
