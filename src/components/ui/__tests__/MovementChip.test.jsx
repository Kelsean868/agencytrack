// @vitest-environment jsdom
//
// Track J — MovementChip unit tests (PRIMARY ▲/▼/even/none coverage).
//
// Direction is the bit that's easy to invert. A rank IMPROVES by getting
// numerically SMALLER, so delta = previousRank − rank:
//   previousRank 5, rank 2 → delta +3 → ▲3 (climbed)
//   previousRank 2, rank 5 → delta −3 → ▼3 (dropped)
//   previousRank 4, rank 4 → delta  0 → –  (even)
//   previousRank null → no chip (returns null)

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MovementChip from '../MovementChip';

describe('MovementChip — direction (THE PROOF)', () => {
  it('previousRank 5, rank 2 → ▲3 (climbed; rank improves by getting smaller)', () => {
    const { getByTestId } = render(<MovementChip previousRank={5} rank={2} />);
    const chip = getByTestId('movement-chip');
    expect(chip.getAttribute('data-delta')).toBe('3');
    expect(chip.getAttribute('data-direction')).toBe('up');
    expect(chip.textContent).toContain('▲');
    expect(chip.textContent).toContain('3');
    expect(chip.getAttribute('aria-label')).toMatch(/Climbed 3 spots? this week/);
  });

  it('previousRank 2, rank 5 → ▼3 (dropped)', () => {
    const { getByTestId } = render(<MovementChip previousRank={2} rank={5} />);
    const chip = getByTestId('movement-chip');
    expect(chip.getAttribute('data-delta')).toBe('-3');
    expect(chip.getAttribute('data-direction')).toBe('down');
    expect(chip.textContent).toContain('▼');
    expect(chip.textContent).toContain('3');
    expect(chip.getAttribute('aria-label')).toMatch(/Dropped 3 spots? this week/);
  });

  it('previousRank 4, rank 4 → – (even, no magnitude)', () => {
    const { getByTestId } = render(<MovementChip previousRank={4} rank={4} />);
    const chip = getByTestId('movement-chip');
    expect(chip.getAttribute('data-delta')).toBe('0');
    expect(chip.getAttribute('data-direction')).toBe('even');
    expect(chip.textContent).toContain('–');
    // Even state has NO magnitude number (just the dash glyph).
    expect(chip.textContent.replace(/[–\s]/g, '')).toBe('');
    expect(chip.getAttribute('aria-label')).toBe('No change this week');
  });

  it('+1 spot up — singular "spot" in aria-label', () => {
    const chip = render(<MovementChip previousRank={2} rank={1} />).getByTestId('movement-chip');
    expect(chip.getAttribute('aria-label')).toBe('Climbed 1 spot this week');
    expect(chip.textContent).toContain('1');
  });

  it('-1 spot down — singular "spot" in aria-label', () => {
    const chip = render(<MovementChip previousRank={1} rank={2} />).getByTestId('movement-chip');
    expect(chip.getAttribute('aria-label')).toBe('Dropped 1 spot this week');
    expect(chip.textContent).toContain('1');
  });

  it('large climb (+20) — magnitude renders', () => {
    const chip = render(<MovementChip previousRank={28} rank={8} />).getByTestId('movement-chip');
    expect(chip.getAttribute('data-delta')).toBe('20');
    expect(chip.textContent).toContain('▲');
    expect(chip.textContent).toContain('20');
  });

  it('large drop (-15) — magnitude renders', () => {
    const chip = render(<MovementChip previousRank={5} rank={20} />).getByTestId('movement-chip');
    expect(chip.getAttribute('data-delta')).toBe('-15');
    expect(chip.textContent).toContain('▼');
    expect(chip.textContent).toContain('15');
  });
});

describe('MovementChip — null path (no chip)', () => {
  it('previousRank null → null (no chip)', () => {
    const { container } = render(<MovementChip previousRank={null} rank={3} />);
    expect(container.firstChild).toBeNull();
  });

  it('previousRank undefined → null (defensive)', () => {
    const { container } = render(<MovementChip previousRank={undefined} rank={3} />);
    expect(container.firstChild).toBeNull();
  });

  it('rank null → null (defensive — can\'t compute a delta)', () => {
    const { container } = render(<MovementChip previousRank={3} rank={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('both null → null', () => {
    const { container } = render(<MovementChip previousRank={null} rank={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('MovementChip — visual treatment (Nexus tokens)', () => {
  it('climbed → text-success + bg-success-tint', () => {
    const chip = render(<MovementChip previousRank={3} rank={1} />).getByTestId('movement-chip');
    const cls = chip.getAttribute('class') ?? '';
    expect(cls).toContain('text-success');
    expect(cls).toContain('bg-success-tint');
  });

  it('dropped → text-danger + bg-danger-tint', () => {
    const chip = render(<MovementChip previousRank={1} rank={3} />).getByTestId('movement-chip');
    const cls = chip.getAttribute('class') ?? '';
    expect(cls).toContain('text-danger');
    expect(cls).toContain('bg-danger-tint');
  });

  it('even → text-ink-muted + bg-surface-muted (neutral)', () => {
    const chip = render(<MovementChip previousRank={3} rank={3} />).getByTestId('movement-chip');
    const cls = chip.getAttribute('class') ?? '';
    expect(cls).toContain('text-ink-muted');
    expect(cls).toContain('bg-surface-muted');
  });

  it('passes through className', () => {
    const chip = render(<MovementChip previousRank={1} rank={1} className="custom-test-class" />).getByTestId('movement-chip');
    expect(chip.getAttribute('class')).toContain('custom-test-class');
  });
});
