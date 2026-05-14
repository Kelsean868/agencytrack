// @vitest-environment jsdom
/* eslint-disable jsx-a11y/aria-role -- role is a component prop (not a DOM role) in this test */
import React from 'react';
import { it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MotivationalCarousel from '../MotivationalCarousel';

it('carousel section uses bg-primary/8 and border-primary/15 tokens (FU#4 P2-3)', () => {
  const { container } = render(
    <MotivationalCarousel
      role="agent"
      submissions={[]}
      confirmedSettlements={[]}
      leaderboardDoc={null}
      goals={{}}
      agentProfile={{}}
      unitAgents={[]}
      currentDate={new Date('2026-01-01')}
    />
  );
  const section = container.querySelector('section[aria-label="Motivational insights"]');
  expect(section.className).toContain('bg-primary/8');
  expect(section.className).toContain('border-primary/15');
});
