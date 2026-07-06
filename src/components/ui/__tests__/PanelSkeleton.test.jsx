import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PanelSkeleton, { Skeleton } from '../PanelSkeleton';

describe('PanelSkeleton', () => {
  it('renders a live status region with aria-busy', () => {
    const { getByRole } = render(<PanelSkeleton variant="list" rows={3} />);
    const status = getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('list variant renders the requested row count', () => {
    const { container } = render(<PanelSkeleton variant="list" rows={4} />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBe(4);
  });

  it('Skeleton primitive is decorative and reduced-motion-safe', () => {
    const { container } = render(<Skeleton className="h-10" />);
    const el = container.firstChild;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('motion-safe:animate-pulse');
  });
});
