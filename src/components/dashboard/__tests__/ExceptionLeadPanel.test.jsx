// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExceptionLeadPanel from '../ExceptionLeadPanel';

const mkExc = (over = {}) => ({
  id: 'a1', agentId: 'a1', name: 'Devin Lewis', initials: 'DL',
  type: 'floor', kind: 'Below floor', tone: 'danger',
  detail: 'TTD 30,000 YTD · TTD 69,726 behind floor pace',
  spark: [40, 30, 22], ...over,
});

describe('ExceptionLeadPanel — four states', () => {
  it('loading → skeleton, no rows', () => {
    render(<ExceptionLeadPanel loading exceptions={[]} />);
    expect(screen.getByLabelText(/loading exceptions/i)).toBeInTheDocument();
    expect(screen.queryByTestId('exception-lead-list')).toBeNull();
  });

  it('error → alert + Retry wired', () => {
    const onRetry = vi.fn();
    render(<ExceptionLeadPanel error="boom" exceptions={[]} onRetry={onRetry} />);
    expect(screen.getByTestId('exception-lead-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('empty → honest all-clear state', () => {
    render(<ExceptionLeadPanel exceptions={[]} />);
    expect(screen.getByTestId('exception-lead-empty')).toBeInTheDocument();
    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
  });

  it('list → renders a row per exception with its derived detail', () => {
    render(<ExceptionLeadPanel exceptions={[mkExc(), mkExc({ id: 'a2', agentId: 'a2', name: 'Hema Lakhan', kind: 'Off pace', tone: 'warning', type: 'pace', detail: 'TTD 80,000 YTD · pace target TTD 99,726' })]} />);
    expect(screen.getByText('Devin Lewis')).toBeInTheDocument();
    expect(screen.getByText('Hema Lakhan')).toBeInTheDocument();
    expect(screen.getByText(/behind floor pace/i)).toBeInTheDocument();
    expect(screen.getByText('Below floor')).toBeInTheDocument();
    expect(screen.getByText('Off pace')).toBeInTheDocument();
  });

  it('clicking a row drills into that exact agent', () => {
    const onDrill = vi.fn();
    render(<ExceptionLeadPanel exceptions={[mkExc()]} onDrill={onDrill} />);
    fireEvent.click(screen.getByTestId('exception-row-a1'));
    expect(onDrill).toHaveBeenCalledTimes(1);
    expect(onDrill.mock.calls[0][0].agentId).toBe('a1');
  });
});
