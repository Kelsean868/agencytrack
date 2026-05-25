import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StepSocialMedia from '../StepSocialMedia';
import { SOCIAL_PLATFORMS } from '../socialMediaConstants';

const DEFAULT_DATA = {
  socialPostsTotal:        0,
  socialEngagementTotal:   0,
  socialInboxEnquiries:    0,
  namesFromSocial:         0,
  socialPlatformBreakdown: { facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0 },
};

describe('StepSocialMedia', () => {
  it('renders 4 main numeric fields', () => {
    render(<StepSocialMedia data={DEFAULT_DATA} onChange={() => {}} />);
    expect(screen.getByLabelText(/Posts Published/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Engagement/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Inbox Enquiries/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Names from Social/i)).toBeInTheDocument();
  });

  it('default data (all zeros) renders without errors', () => {
    // Should mount and render the card without throwing
    const { container } = render(<StepSocialMedia data={DEFAULT_DATA} onChange={() => {}} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('Names from Social field is present and editable', () => {
    const onChange = vi.fn();
    render(<StepSocialMedia data={DEFAULT_DATA} onChange={onChange} />);
    const input = screen.getByLabelText(/Names from Social/i);
    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith('namesFromSocial', 5);
  });

  it('toggle shows platform breakdown when clicked', () => {
    render(<StepSocialMedia data={DEFAULT_DATA} onChange={() => {}} />);
    // Platform fields should NOT be visible initially
    expect(screen.queryByLabelText(/Facebook/i)).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /show platform breakdown/i });
    fireEvent.click(toggle);

    // All 4 platform inputs should now be visible
    expect(screen.getByLabelText(/Facebook/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Instagram/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/LinkedIn/i)).toBeInTheDocument();
  });

  it('toggle hides platform breakdown when clicked twice', () => {
    render(<StepSocialMedia data={DEFAULT_DATA} onChange={() => {}} />);
    const toggle = screen.getByRole('button', { name: /show platform breakdown/i });

    fireEvent.click(toggle); // show
    expect(screen.getByLabelText(/Facebook/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide platform breakdown/i })); // hide
    expect(screen.queryByLabelText(/Facebook/i)).not.toBeInTheDocument();
  });

  it('platform inputs fire onChange with merged socialPlatformBreakdown', () => {
    const onChange = vi.fn();
    render(<StepSocialMedia data={DEFAULT_DATA} onChange={onChange} />);

    const toggle = screen.getByRole('button', { name: /show platform breakdown/i });
    fireEvent.click(toggle);

    const fbInput = screen.getByLabelText(/Facebook/i);
    fireEvent.change(fbInput, { target: { value: '3' } });

    expect(onChange).toHaveBeenCalledWith('socialPlatformBreakdown', {
      facebook:  3,
      instagram: 0,
      whatsapp:  0,
      linkedin:  0,
    });
  });

  it('SOCIAL_PLATFORMS exports the 4 expected platform keys', () => {
    expect(SOCIAL_PLATFORMS).toEqual(['facebook', 'instagram', 'whatsapp', 'linkedin']);
  });
});
