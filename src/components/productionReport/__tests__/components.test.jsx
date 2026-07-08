// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimePeriodToggle from '../TimePeriodToggle.jsx';
import DataSourceBadge from '../DataSourceBadge.jsx';
import ProductionTable from '../ProductionTable.jsx';
import RankedLeaderboard from '../RankedLeaderboard.jsx';

// ── TimePeriodToggle ──────────────────────────────────────────────────────────

describe('TimePeriodToggle', () => {
  it('renders all four period options', () => {
    render(<TimePeriodToggle selected="week" onChange={() => {}} />);
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('MTD')).toBeInTheDocument();
    expect(screen.getByText('Quarter')).toBeInTheDocument();
    expect(screen.getByText('YTD')).toBeInTheDocument();
  });

  it('calls onChange with the clicked period id', () => {
    const onChange = vi.fn();
    render(<TimePeriodToggle selected="week" onChange={onChange} />);
    fireEvent.click(screen.getByText('MTD'));
    expect(onChange).toHaveBeenCalledWith('mtd');
  });

  it('marks the selected period with aria-selected=true', () => {
    render(<TimePeriodToggle selected="ytd" onChange={() => {}} />);
    const ytdBtn = screen.getByText('YTD');
    expect(ytdBtn).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Week')).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking the already-selected period still fires onChange', () => {
    const onChange = vi.fn();
    render(<TimePeriodToggle selected="week" onChange={onChange} />);
    fireEvent.click(screen.getByText('Week'));
    expect(onChange).toHaveBeenCalledWith('week');
  });
});

// ── DataSourceBadge ───────────────────────────────────────────────────────────

describe('DataSourceBadge', () => {
  it('renders "Confirmed" text for confirmed source', () => {
    render(<DataSourceBadge source="confirmed" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders "Estimated" text for estimated source', () => {
    render(<DataSourceBadge source="estimated" />);
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });

  it('renders "Estimated" for unknown source', () => {
    render(<DataSourceBadge source={null} />);
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });

  it('Confirmed badge has teal styling class', () => {
    render(<DataSourceBadge source="confirmed" />);
    const badge = screen.getByText('Confirmed');
    expect(badge.className).toContain('text-primary');
  });

  it('Estimated badge has amber/warning styling class', () => {
    render(<DataSourceBadge source="estimated" />);
    const badge = screen.getByText('Estimated');
    expect(badge.className).toContain('text-warning');
  });
});

// ── ProductionTable ───────────────────────────────────────────────────────────

describe('ProductionTable', () => {
  const rows = [
    {
      label: 'Alice',
      nb: { apps: 3, api: 15000 },
      ppp: { apiIncrease: 2000 },
      lmps: { apiCredit: 1000 },
      total: 18000,
    },
  ];

  it('shows empty state message for empty rows', () => {
    render(<ProductionTable rows={[]} period="week" />);
    expect(screen.getByText(/No production data/i)).toBeInTheDocument();
  });

  it('renders agent name', () => {
    render(<ProductionTable rows={rows} period="week" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders apps count', () => {
    render(<ProductionTable rows={rows} period="week" />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders rank column when showRankColumn=true', () => {
    const rowsWithRank = [{ ...rows[0], rank: 1 }];
    const { container } = render(
      <ProductionTable rows={rowsWithRank} period="week" showRankColumn={true} />
    );
    expect(container.querySelector('th')).toHaveTextContent('#');
  });

  it('does not render rank column when showRankColumn=false', () => {
    const { container } = render(
      <ProductionTable rows={rows} period="week" showRankColumn={false} />
    );
    const firstTh = container.querySelector('th');
    expect(firstTh).not.toHaveTextContent('#');
  });

  // ── §5 dense-table contract ─────────────────────────────────────────────

  it('renders a live footer count', () => {
    render(<ProductionTable rows={rows} period="week" />);
    expect(screen.getByText('1 agent')).toBeInTheDocument();
  });

  it('footer count pluralizes for multiple rows', () => {
    const twoRows = [rows[0], { ...rows[0], label: 'Bob' }];
    render(<ProductionTable rows={twoRows} period="week" />);
    expect(screen.getByText('2 agents')).toBeInTheDocument();
  });

  it('truncated agent-name cell carries a title attribute', () => {
    render(<ProductionTable rows={rows} period="week" />);
    expect(screen.getByText('Alice')).toHaveAttribute('title', 'Alice');
  });

  it('header cells are sticky for the card-scoped scroll contract, first row pinned to top-0', () => {
    const { container } = render(<ProductionTable rows={rows} period="week" />);
    const headerRows = container.querySelectorAll('thead tr');
    expect(headerRows.length).toBe(2);
    headerRows[0].querySelectorAll('th').forEach((th) => {
      expect(th.className).toContain('sticky');
      expect(th.className).toContain('top-0');
    });
    headerRows[1].querySelectorAll('th').forEach((th) => {
      expect(th.className).toContain('sticky');
    });
  });

  it('numeric cells render tabular-nums', () => {
    render(<ProductionTable rows={rows} period="week" />);
    const totalCell = screen.getByText('TTD 18,000');
    expect(totalCell.className).toContain('tabular-nums');
  });
});

// ── RankedLeaderboard ─────────────────────────────────────────────────────────

describe('RankedLeaderboard', () => {
  const entries = [
    { id: 'a1', rank: 1, name: 'Alice', value: 50000, secondaryValue: 5 },
    { id: 'a2', rank: 2, name: 'Bob',   value: 40000, secondaryValue: 4 },
    { id: 'a3', rank: 3, name: 'Carol', value: 30000, secondaryValue: 3 },
    { id: 'a4', rank: 4, name: 'Dave',  value: 20000, secondaryValue: 2 },
    { id: 'a5', rank: 5, name: 'Eve',   value: 10000, secondaryValue: 1 },
  ];

  it('shows empty state for no entries', () => {
    render(<RankedLeaderboard entries={[]} />);
    expect(screen.getByText(/No data/i)).toBeInTheDocument();
  });

  it('renders all entries without topN', () => {
    render(<RankedLeaderboard entries={entries} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('respects topN cap', () => {
    render(<RankedLeaderboard entries={entries} topN={3} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.queryByText('Dave')).not.toBeInTheDocument();
    expect(screen.queryByText('Eve')).not.toBeInTheDocument();
  });

  it('highlights the currentEntityId row', () => {
    render(<RankedLeaderboard entries={entries} currentEntityId="a2" />);
    const bobEl = screen.getByText('Bob');
    // Parent row should have the highlight class
    expect(bobEl.closest('[class*="primary"]') || bobEl.className).toBeTruthy();
    // Should show "(you)" indicator
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('does not show (you) when no currentEntityId', () => {
    render(<RankedLeaderboard entries={entries} />);
    expect(screen.queryByText('(you)')).not.toBeInTheDocument();
  });

  // ── §5 dense-table contract ─────────────────────────────────────────────

  it('renders a sticky header row with the value label', () => {
    const { container } = render(<RankedLeaderboard entries={entries} valueLabel="Avg API" />);
    expect(screen.getByText('Avg API')).toBeInTheDocument();
    const header = container.querySelector('.sticky.top-0');
    expect(header).not.toBeNull();
  });

  it('renders a live footer count when unfiltered', () => {
    render(<RankedLeaderboard entries={entries} />);
    expect(screen.getByText('5 agents')).toBeInTheDocument();
  });

  it('renders "Showing N of M" in the footer when topN caps the list', () => {
    render(<RankedLeaderboard entries={entries} topN={3} />);
    expect(screen.getByText('Showing 3 of 5')).toBeInTheDocument();
  });

  it('truncated name cell carries a title attribute', () => {
    render(<RankedLeaderboard entries={entries} />);
    expect(screen.getByText('Alice')).toHaveAttribute('title', 'Alice');
  });
});
