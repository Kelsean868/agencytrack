// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  extractFields: vi.fn(),
}));

vi.mock('../../../utils/extractFields', () => ({
  extractFields: hoisted.extractFields,
}));

import SubmissionViewer from '../SubmissionViewer';

const BASE_FIELDS = {
  apiSold: 5000, applicationsSold: 2, telContacts: 30,
  overallRating: 4, planningEffectiveness: 3, timeManagement: 4,
  salesPerformance: 5, prospectingEffort: 3, evaluationNotes: '',
};

const BASE_SUB = {
  status: 'submitted',
  weekStarting: '2026-05-19',
  submittedAt: null,
  agentName: 'Jordan Ellis',
  referralCalls: 10, followUpCalls: 5, coldCalls: 8,
  f2fContacts: 3,
  ffisScheduled: 2, ffiConducted: 2,
  newCIBooked: 1, oldCIBooked: 1, ciConducted: 2,
  applicationsSold: 2, livesSold: 3,
  persistencyRate: 91.5,
  targetDials: 60, targetFFI: 5, targetCI: 3, targetAppsSold: 2, targetAPI: 8000,
  goalNotes: '',
  ratingOverall: 4,
};

describe('SubmissionViewer — null guard', () => {
  beforeEach(() => { vi.clearAllMocks(); hoisted.extractFields.mockReturnValue(BASE_FIELDS); });

  it('renders nothing when submission is null', () => {
    const { container } = render(<SubmissionViewer submission={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('SubmissionViewer — submitted state', () => {
  beforeEach(() => { vi.clearAllMocks(); hoisted.extractFields.mockReturnValue(BASE_FIELDS); });

  it('renders agent name in header', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.getByText('Jordan Ellis')).toBeInTheDocument();
  });

  it('renders Submitted status badge', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('renders week label', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.getByText(/Week of Sunday/i)).toBeInTheDocument();
  });

  it('renders activity section heading', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('renders production section heading', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders referral, follow-up, and cold call values', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.getByText('Referral Calls')).toBeInTheDocument();
    expect(screen.getByText('Follow-up Calls')).toBeInTheDocument();
    expect(screen.getByText('Cold Calls')).toBeInTheDocument();
  });

  it('renders Total Dials as sum of call types', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    // 10+5+8 = 23
    expect(screen.getByText('23')).toBeInTheDocument();
  });

  it('renders persistency rate with % format', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.getByText('91.5%')).toBeInTheDocument();
  });

  it('renders self-evaluation section when overallRating is present', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.getByText('Self-Evaluation')).toBeInTheDocument();
  });

  it('does not render unlock banner when unlockedBy is absent', () => {
    render(<SubmissionViewer submission={BASE_SUB} onClose={() => {}} />);
    expect(screen.queryByText(/Unlocked by/i)).toBeNull();
  });
});

describe('SubmissionViewer — draft state', () => {
  beforeEach(() => { vi.clearAllMocks(); hoisted.extractFields.mockReturnValue({ ...BASE_FIELDS, applicationsSold: 0, apiSold: 0 }); });

  it('renders Draft status badge for draft submissions', () => {
    render(<SubmissionViewer submission={{ ...BASE_SUB, status: 'draft' }} onClose={() => {}} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});

describe('SubmissionViewer — unlock banner', () => {
  beforeEach(() => { vi.clearAllMocks(); hoisted.extractFields.mockReturnValue(BASE_FIELDS); });

  it('renders unlock banner with manager name when unlockedBy is set', () => {
    const sub = { ...BASE_SUB, unlockedBy: 'mgr1', unlockedByName: 'Maria Ramos' };
    render(<SubmissionViewer submission={sub} onClose={() => {}} />);
    expect(screen.getByText(/Maria Ramos/)).toBeInTheDocument();
    expect(screen.getByText(/Unlocked by/i)).toBeInTheDocument();
  });

  it('falls back to "a manager" when unlockedByName is absent', () => {
    const sub = { ...BASE_SUB, unlockedBy: 'mgr1', unlockedByName: undefined };
    render(<SubmissionViewer submission={sub} onClose={() => {}} />);
    expect(screen.getByText(/a manager/i)).toBeInTheDocument();
  });
});

describe('SubmissionViewer — close interactions', () => {
  beforeEach(() => { vi.clearAllMocks(); hoisted.extractFields.mockReturnValue(BASE_FIELDS); });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<SubmissionViewer submission={BASE_SUB} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn();
    render(<SubmissionViewer submission={BASE_SUB} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<SubmissionViewer submission={BASE_SUB} onClose={onClose} />);
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SubmissionViewer — zero/null field display', () => {
  beforeEach(() => { vi.clearAllMocks(); hoisted.extractFields.mockReturnValue({ ...BASE_FIELDS, applicationsSold: 0, apiSold: 0, overallRating: 0 }); });

  it('renders em-dash for zero applicationsSold', () => {
    const sub = { ...BASE_SUB, applicationsSold: 0, livesSold: 0, ratingOverall: 0 };
    render(<SubmissionViewer submission={sub} onClose={() => {}} />);
    // display() returns '—' for 0 numeric values; multiple fields may show it
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('does not render self-evaluation section when no rating fields', () => {
    const sub = { ...BASE_SUB, ratingOverall: 0, overallRating: 0 };
    render(<SubmissionViewer submission={sub} onClose={() => {}} />);
    expect(screen.queryByText('Self-Evaluation')).toBeNull();
  });
});
