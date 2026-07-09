// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PersistencyV2Shell from '../PersistencyV2Shell';

afterEach(() => cleanup());

describe('PersistencyV2Shell', () => {
  it('renders the v1/v2 model toggle, pending banner, and per-lapse weighting', () => {
    render(<PersistencyV2Shell />);
    expect(screen.getByTestId('persistency-v2-shell')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-v2-pending-banner')).toBeInTheDocument();
    expect(screen.getByText(/model pending Tatil confirmation/i)).toBeInTheDocument();
    expect(screen.getByTestId('persistency-v2-model-v1')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-v2-model-v2')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-v2-weighting')).toBeInTheDocument();
    // 4 lapsed policies in the preview book
    expect(screen.getByTestId('persistency-v2-weight-baksh')).toBeInTheDocument();
  });

  it('shows the v2 figure by default and re-weights when toggled to v1', () => {
    render(<PersistencyV2Shell />);
    const now = screen.getByTestId('persistency-v2-now');
    expect(now.textContent).toMatch(/85\.8%/); // v2 on the preview book
    fireEvent.click(screen.getByTestId('persistency-v2-model-v1'));
    expect(screen.getByTestId('persistency-v2-now').textContent).toMatch(/72\.0%/); // v1
  });

  it('renders the actionable empty state when the preview book is empty', () => {
    render(<PersistencyV2Shell book={[]} />);
    expect(screen.getByTestId('persistency-v2-shell-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('persistency-v2-shell')).not.toBeInTheDocument();
  });

  it('renders loading + error states (four-states contract)', () => {
    const { rerender } = render(<PersistencyV2Shell loading />);
    expect(screen.getByTestId('persistency-v2-shell-loading')).toBeInTheDocument();
    rerender(<PersistencyV2Shell error="nope" onRetry={() => {}} />);
    expect(screen.getByTestId('persistency-v2-shell-error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
