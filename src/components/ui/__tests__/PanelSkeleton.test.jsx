import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PanelSkeleton, { Skeleton, SkeletonText } from '../PanelSkeleton';

const pulses = (container) =>
  container.querySelectorAll('[class*="animate-pulse"]');

describe('PanelSkeleton', () => {
  it('renders a live status region with aria-busy / aria-live / default label', () => {
    const { getByRole } = render(<PanelSkeleton variant="list" count={3} />);
    const status = getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-label')).toBe('Loading…');
  });

  it('applies a custom accessible label', () => {
    const { getByRole } = render(<PanelSkeleton label="Loading team…" />);
    expect(getByRole('status').getAttribute('aria-label')).toBe('Loading team…');
  });

  describe('variant rendering — count', () => {
    it('list renders the requested row count', () => {
      const { container } = render(<PanelSkeleton variant="list" count={4} />);
      expect(pulses(container)).toHaveLength(4);
    });

    it('card-grid renders the requested card count', () => {
      const { container } = render(<PanelSkeleton variant="card-grid" count={6} />);
      expect(pulses(container)).toHaveLength(6);
    });

    it('metric-row renders the requested metric count', () => {
      const { container } = render(<PanelSkeleton variant="metric-row" count={5} />);
      expect(pulses(container)).toHaveLength(5);
    });

    it('table renders a header bar + count*columns cells', () => {
      const { container } = render(
        <PanelSkeleton variant="table" count={3} columns={4} />,
      );
      // 1 header + (3 rows * 4 columns) = 13 pulsing blocks
      expect(pulses(container)).toHaveLength(1 + 3 * 4);
    });

    it('applies a sensible per-variant default when count is omitted', () => {
      const { container } = render(<PanelSkeleton variant="list" />);
      expect(pulses(container)).toHaveLength(4); // DEFAULT_COUNT.list
    });

    it('falls back to the list variant for an unknown variant', () => {
      const { container } = render(<PanelSkeleton variant="nope" count={3} />);
      // list shape: 3 full-width rows, each carrying the list height class
      const blocks = pulses(container);
      expect(blocks).toHaveLength(3);
      expect(blocks[0].className).toContain('h-14');
    });

    it('guards against zero / negative counts without throwing', () => {
      expect(() =>
        render(<PanelSkeleton variant="list" count={0} />),
      ).not.toThrow();
      const { container } = render(<PanelSkeleton variant="list" count={-5} />);
      expect(pulses(container)).toHaveLength(0);
    });

    it('falls back to the variant default when count is non-numeric / NaN', () => {
      const bad = render(<PanelSkeleton variant="list" count="invalid" />);
      expect(pulses(bad.container)).toHaveLength(4); // DEFAULT_COUNT.list
      const nan = render(<PanelSkeleton variant="table" count={NaN} columns={NaN} />);
      // table default count (5) rows × default columns (4) + 1 header
      expect(pulses(nan.container)).toHaveLength(1 + 5 * 4);
    });
  });

  describe('geometry stability — each variant reserves a fixed box', () => {
    it('list rows reserve the h-14 box', () => {
      const { container } = render(<PanelSkeleton variant="list" count={2} />);
      pulses(container).forEach((b) => expect(b.className).toContain('h-14'));
    });

    it('card-grid cards reserve the h-24 box', () => {
      const { container } = render(<PanelSkeleton variant="card-grid" count={2} />);
      pulses(container).forEach((b) => expect(b.className).toContain('h-24'));
    });

    it('metric-row slots reserve the h-16 box and flex evenly', () => {
      const { container } = render(<PanelSkeleton variant="metric-row" count={2} />);
      pulses(container).forEach((b) => {
        expect(b.className).toContain('h-16');
        expect(b.className).toContain('flex-1');
      });
    });

    it('table reserves a header box (h-10) and cell boxes (h-11)', () => {
      const { container } = render(
        <PanelSkeleton variant="table" count={1} columns={3} />,
      );
      const blocks = Array.from(pulses(container));
      expect(blocks[0].className).toContain('h-10'); // header
      blocks.slice(1).forEach((cell) => expect(cell.className).toContain('h-11'));
    });
  });

  it('reduced-motion: every block pulses only under motion-safe', () => {
    const { container } = render(<PanelSkeleton variant="card-grid" count={4} />);
    const blocks = pulses(container);
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((b) =>
      expect(b.className).toContain('motion-safe:animate-pulse'),
    );
  });
});

describe('Skeleton (atom)', () => {
  it('is decorative (aria-hidden), reduced-motion-safe, and muted-filled', () => {
    const { container } = render(<Skeleton className="h-10 rounded-xl" />);
    const el = container.firstChild;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('motion-safe:animate-pulse');
    expect(el.className).toContain('bg-surface-muted');
    expect(el.className).toContain('h-10'); // passthrough layout class
  });
});

describe('SkeletonText (geometry-stable value slot)', () => {
  it('loading: reserves width in ch, hides the value, pulses motion-safe', () => {
    const { container } = render(
      <SkeletonText loading reserveCh={7}>
        1,234
      </SkeletonText>,
    );
    const span = container.querySelector('span');
    // Width reserved via CSS custom property + Tailwind arbitrary class (no raw
    // inline min-width — project UI rule).
    expect(span.style.getPropertyValue('--skeleton-reserve-ch')).toBe('7ch');
    expect(span.className).toContain('min-w-[var(--skeleton-reserve-ch)]');
    expect(span.className).toContain('text-transparent');
    expect(span.className).toContain('motion-safe:animate-pulse');
    expect(span.className).toContain('tabular-nums');
    expect(span.textContent).not.toContain('1,234'); // real value withheld while loading
  });

  it('ready: shows the value, keeps tabular-nums, drops the pulse', () => {
    const { container } = render(
      <SkeletonText loading={false} reserveCh={7}>
        1,234
      </SkeletonText>,
    );
    const span = container.querySelector('span');
    expect(span.textContent).toBe('1,234');
    expect(span.className).toContain('tabular-nums');
    expect(span.className).not.toContain('text-transparent');
    expect(span.className).not.toContain('motion-safe:animate-pulse');
  });

  it('geometry is stable across loading→ready: same span node, same reserved width', () => {
    const { container, rerender } = render(
      <SkeletonText loading reserveCh={9}>
        88.5%
      </SkeletonText>,
    );
    const before = container.querySelector('span');
    expect(before.style.getPropertyValue('--skeleton-reserve-ch')).toBe('9ch');

    rerender(
      <SkeletonText loading={false} reserveCh={9}>
        88.5%
      </SkeletonText>,
    );
    const after = container.querySelector('span');
    // In-place fill: the same DOM node persists (no unmount/remount = no shift)…
    expect(after).toBe(before);
    // …and the reserved width is identical in both states.
    expect(after.style.getPropertyValue('--skeleton-reserve-ch')).toBe('9ch');
    expect(after.className).toContain('min-w-[var(--skeleton-reserve-ch)]');
    expect(after.textContent).toBe('88.5%');
  });

  it('omits the reservation (no var, no class) when reserveCh is not provided', () => {
    const { container } = render(<SkeletonText loading>x</SkeletonText>);
    const span = container.querySelector('span');
    expect(span.style.getPropertyValue('--skeleton-reserve-ch')).toBe('');
    expect(span.className).not.toContain('min-w-[var(--skeleton-reserve-ch)]');
  });
});
