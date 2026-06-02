// @vitest-environment jsdom
//
// Track J retirement R3 — StepSocialContent (step 4) component test.
// Proves the v2 extraction of legacy StepSocialMedia: 4 flat social fields +
// the collapsible platform breakdown (nested socialPlatformBreakdown writer).

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StepSocialContent from '../StepSocialContent';
import { SOCIAL_PLATFORMS } from '../socialMediaConstants';

afterEach(() => cleanup());

const FLAT = [
  ['Posts Published', 'socialPostsTotal'],
  ['Engagement (Likes + Comments)', 'socialEngagementTotal'],
  ['Inbox Enquiries', 'socialInboxEnquiries'],
  ['Names from Social', 'namesFromSocial'],
];

describe('StepSocialContent — flat social fields', () => {
  it('renders + writes each flat field directly', () => {
    for (const [label, key] of FLAT) {
      const onChange = vi.fn();
      const { unmount } = render(<StepSocialContent data={{}} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText(label), { target: { value: '9' } });
      expect(onChange).toHaveBeenCalledWith(key, 9);
      unmount();
    }
  });
});

describe('StepSocialContent — platform breakdown', () => {
  it('breakdown is collapsed by default', () => {
    render(<StepSocialContent data={{}} onChange={vi.fn()} />);
    expect(screen.getByText('Show platform breakdown')).toBeInTheDocument();
    expect(screen.queryByLabelText('Facebook')).toBeNull();
  });

  it('expands on toggle + reveals all 4 platform inputs', () => {
    render(<StepSocialContent data={{}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Show platform breakdown'));
    expect(screen.getByLabelText('Facebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Instagram')).toBeInTheDocument();
    expect(screen.getByLabelText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument();
  });

  it('a platform input writes socialPlatformBreakdown via nested spread', () => {
    const onChange = vi.fn();
    render(
      <StepSocialContent
        data={{ socialPlatformBreakdown: { facebook: 0, instagram: 5 } }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('Show platform breakdown'));
    fireEvent.change(screen.getByLabelText('Facebook'), { target: { value: '7' } });
    // nested spread preserves the existing instagram value.
    expect(onChange).toHaveBeenCalledWith('socialPlatformBreakdown', { facebook: 7, instagram: 5 });
  });

  it('SOCIAL_PLATFORMS constant still exposes the 4 platform keys', () => {
    expect(SOCIAL_PLATFORMS).toEqual(['facebook', 'instagram', 'whatsapp', 'linkedin']);
  });
});
