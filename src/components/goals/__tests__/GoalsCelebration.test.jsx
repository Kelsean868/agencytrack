// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GoalsCelebration from '../GoalsCelebration';

describe('GoalsCelebration', () => {
  it('renders nothing for a null celebration', () => {
    const { container } = render(
      <GoalsCelebration celebration={null} annualTarget={0} ytdApi={0} streak={0} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the annual takeover with the commitment figure', () => {
    render(
      <GoalsCelebration
        celebration={{ type: 'annual' }}
        annualTarget={600000}
        ytdApi={612000}
        streak={0}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('goals-celebration-annual')).toBeInTheDocument();
    expect(screen.getByText(/ANNUAL COMMITMENT · HIT/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('renders the streak takeover with the milestone week count', () => {
    render(
      <GoalsCelebration
        celebration={{ type: 'streak', milestone: 8 }}
        annualTarget={0}
        ytdApi={0}
        streak={8}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('goals-celebration-streak')).toBeInTheDocument();
    expect(screen.getByText(/WEEKLY STREAK · 8 WEEKS/i)).toBeInTheDocument();
  });
});
