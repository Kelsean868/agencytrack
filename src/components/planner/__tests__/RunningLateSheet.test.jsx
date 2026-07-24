// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RunningLateSheet from '../RunningLateSheet.jsx';

const TODAY = '2026-07-24';
const late = { id: 'a', date: TODAY, startTime: '09:00', durationMin: 60, status: 'scheduled', prospectId: 'pa' };
const appts = [
  late,
  { id: 'b', date: TODAY, startTime: '10:00', durationMin: 30, status: 'scheduled', prospectId: 'pb' },
  { id: 'c', date: TODAY, startTime: '13:00', durationMin: 60, status: 'scheduled', prospectId: 'pc' },
];
const prospectName = (id) => ({ pa: 'Ann', pb: 'Ben', pc: 'Cara' })[id] || null;

function renderSheet(props = {}) {
  return render(
    <RunningLateSheet
      lateAppt={late}
      appts={appts}
      prospectName={prospectName}
      prospectPhone={() => null}
      onPush={vi.fn()}
      onKeep={vi.fn()}
      onWrapKept={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );
}

describe('RunningLateSheet — E3', () => {
  it('defaults to "next" scope + +20 push and previews only the next appt shifted', () => {
    renderSheet();
    expect(screen.getByTestId('late-scope-next')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('late-push-20')).toHaveAttribute('aria-pressed', 'true');
    const b = screen.getByTestId('late-affected-b');
    expect(b).toHaveTextContent('10:00');
    expect(b).toHaveTextContent('10:20');
    expect(screen.getByTestId('late-unaffected-c')).toBeInTheDocument();
  });

  it('switching to "all" cascades every later appt', () => {
    renderSheet();
    fireEvent.click(screen.getByTestId('late-scope-all'));
    expect(screen.getByTestId('late-affected-b')).toHaveTextContent('10:20');
    expect(screen.getByTestId('late-affected-c')).toHaveTextContent('1:20');   // 13:20 → 1:20 PM
    expect(screen.queryByTestId('late-unaffected-c')).toBeNull();
  });

  it('changing the push updates the preview', () => {
    renderSheet();
    fireEvent.click(screen.getByTestId('late-push-30'));
    expect(screen.getByTestId('late-affected-b')).toHaveTextContent('10:30');
  });

  it('notify shows a copy-message button; Call/WhatsApp only with a phone', () => {
    renderSheet({ prospectPhone: () => null });
    expect(screen.getAllByTestId('late-notify-copy').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('late-notify-call')).toBeNull();
    expect(screen.queryByTestId('late-notify-whatsapp')).toBeNull();
  });

  it('renders tel: + wa.me deep links when the prospect has a phone (no send path)', () => {
    renderSheet({ prospectPhone: () => '1868-123-4567' });
    const call = screen.getAllByTestId('late-notify-call')[0];
    expect(call).toHaveAttribute('href', 'tel:1868-123-4567');
    const wa = screen.getAllByTestId('late-notify-whatsapp')[0];
    expect(wa.getAttribute('href')).toContain('https://wa.me/18681234567');
  });

  it('actions fire the right callbacks', () => {
    const onPush = vi.fn(); const onKeep = vi.fn(); const onWrapKept = vi.fn();
    renderSheet({ onPush, onKeep, onWrapKept });
    fireEvent.click(screen.getByTestId('late-push-apply'));
    expect(onPush).toHaveBeenCalledWith(20, 'next');
    fireEvent.click(screen.getByTestId('late-keep'));
    expect(onKeep).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('late-wrap-kept'));
    expect(onWrapKept).toHaveBeenCalled();
  });
});
