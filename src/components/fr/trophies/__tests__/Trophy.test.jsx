// Trophy.jsx / trophyKinds.js — see the header comments in both files.
// Structure over pixels (jsdom has no layout): every kind mounts and gets a
// non-empty accessible name, locked/progress toggle the right DOM, two
// instances never collide on gradient ids, and an unknown kind throws in dev
// (v3 rule 11).
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Trophy from '../Trophy';
import { TROPHY_KINDS, TROPHY_LABELS, trophyGeometry } from '../trophyKinds';

describe('trophyKinds — data', () => {
  it('has exactly 33 kinds', () => {
    expect(TROPHY_KINDS.length).toBe(33);
  });

  it('every kind has a non-empty label', () => {
    TROPHY_KINDS.forEach((kind) => {
      expect(typeof TROPHY_LABELS[kind]).toBe('string');
      expect(TROPHY_LABELS[kind].length).toBeGreaterThan(0);
    });
  });

  it('throws in development for an unknown kind', () => {
    expect(() => trophyGeometry('not-a-real-kind')).toThrow();
  });
});

describe('Trophy — renders every kind', () => {
  TROPHY_KINDS.forEach((kind) => {
    it(`renders "${kind}" without throwing, with a non-empty accessible name`, () => {
      render(<Trophy kind={kind} />);
      const el = screen.getByRole('img');
      const name = el.getAttribute('aria-label');
      expect(name).toBeTruthy();
      expect(name.length).toBeGreaterThan(0);
      expect(name).toBe(TROPHY_LABELS[kind]);
    });
  });
});

describe('Trophy — locked state', () => {
  it('appends ", locked" to the accessible name when locked', () => {
    render(<Trophy kind="mdrt-qualified" locked />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/, locked$/);
  });

  it('has no ", locked" suffix when unlocked', () => {
    render(<Trophy kind="mdrt-qualified" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/locked/);
  });

  it('renders the lock badge only when locked', () => {
    const { container: lockedContainer } = render(<Trophy kind="mdrt-qualified" locked />);
    expect(lockedContainer.querySelector('.fr-t-lock-badge')).not.toBeNull();
  });

  it('renders no lock badge when unlocked', () => {
    const { container: unlockedContainer } = render(<Trophy kind="mdrt-qualified" />);
    expect(unlockedContainer.querySelector('.fr-t-lock-badge')).toBeNull();
  });

  it('sets data-metal="lock" when locked', () => {
    const { container: lockedContainer } = render(<Trophy kind="century" locked />);
    expect(lockedContainer.querySelector('.fr-trophy').getAttribute('data-metal')).toBe('lock');
  });

  it('uses the kind\'s own metal when unlocked', () => {
    const { container: unlockedContainer } = render(<Trophy kind="century" />);
    expect(unlockedContainer.querySelector('.fr-trophy').getAttribute('data-metal')).toBe('gold');
  });
});

describe('Trophy — progress ring', () => {
  it('renders the ring with dasharray reflecting the value, only when locked', () => {
    const { container } = render(<Trophy kind="mdrt-bound" locked progress={40} />);
    const ring = container.querySelector('.fr-t-ring-progress');
    expect(ring).not.toBeNull();
    expect(ring.style.strokeDasharray).toBe('40 100');
  });

  it('does not render a ring when unlocked, even with a progress value', () => {
    const { container } = render(<Trophy kind="mdrt-bound" progress={40} />);
    expect(container.querySelector('.fr-t-ring-progress')).toBeNull();
  });

  it('does not render a ring when locked but progress is null', () => {
    const { container } = render(<Trophy kind="mdrt-bound" locked />);
    expect(container.querySelector('.fr-t-ring-progress')).toBeNull();
  });

  it('changes the dasharray when re-rendered with a new progress value', () => {
    const { container, rerender } = render(<Trophy kind="mdrt-bound" locked progress={20} />);
    expect(container.querySelector('.fr-t-ring-progress').style.strokeDasharray).toBe('20 100');

    rerender(<Trophy kind="mdrt-bound" locked progress={75} />);
    expect(container.querySelector('.fr-t-ring-progress').style.strokeDasharray).toBe('75 100');
  });

  it('clamps progress to 0..100', () => {
    const { container } = render(<Trophy kind="mdrt-bound" locked progress={150} />);
    expect(container.querySelector('.fr-t-ring-progress').style.strokeDasharray).toBe('100 100');
  });
});

describe('Trophy — gradient id uniqueness', () => {
  it('two instances on one page never share a gradient id', () => {
    const { container } = render(
      <div>
        <Trophy kind="century" />
        <Trophy kind="century" />
      </div>
    );
    const ids = Array.from(container.querySelectorAll('linearGradient')).map((g) => g.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Trophy — unknown kind', () => {
  it('throws in development', () => {
    expect(() => render(<Trophy kind="not-a-real-kind" />)).toThrow();
  });
});
