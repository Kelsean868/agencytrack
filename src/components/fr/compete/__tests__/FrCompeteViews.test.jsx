/**
 * FR-5 pure views: Trophy room, Campaign, Arena and Me headers — states,
 * honesty (nothing earned client-side, unknown reads "—"), navigation.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FrTrophyRoomView from '../FrTrophyRoomView';
import FrCampaignView from '../FrCampaignView';
import { FrArenaHeaderView, FrMeHeaderView } from '../FrCompeteHeaderViews';
import { trophyRoom, arenaStanding, meTiles, awardTrophies } from '../../../../lib/fr/competeModel';

const ROOM = trophyRoom({ badges: ['first_submission', 'streak_4', 'big_week'], points: 2100, weeklyStreak: 6 });

describe('FrTrophyRoomView', () => {
  it('count, level, streak and the shelves reflect the engine doc', () => {
    render(<FrTrophyRoomView room={ROOM} />);
    expect(screen.getByTestId('trophy-count')).toHaveTextContent('6 of 14 earned');
    expect(screen.getByTestId('trophy-level-next')).toHaveTextContent('1,400 points to Elite.');
    expect(screen.getByTestId('trophy-streak')).toHaveTextContent('6 weeks');
    expect(screen.getByTestId('trophy-streak')).toHaveTextContent('next badge at 8');
    expect(within(screen.getByTestId('trophy-big_week')).getByText('Earned')).toBeInTheDocument();
    expect(within(screen.getByTestId('trophy-century_dials')).getByText('Locked')).toBeInTheDocument();
    expect(within(screen.getByTestId('trophy-streak_8')).getByText('75% there')).toBeInTheDocument();
  });

  it('selecting a trophy shows how it is earned (engine copy, TTD)', () => {
    render(<FrTrophyRoomView room={ROOM} />);
    fireEvent.click(screen.getByTestId('trophy-big_week'));
    expect(screen.getByTestId('trophy-big_week')).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByTestId('trophy-detail');
    expect(detail).toHaveTextContent('Big Week');
    expect(detail).toHaveTextContent('TTD 20,000+ API in one week');
  });

  it('defaults the detail to what is closest to unlocking', () => {
    render(<FrTrophyRoomView room={ROOM} />);
    expect(screen.getByTestId('trophy-detail')).toHaveTextContent('Committed');
    expect(screen.getByTestId('trophy-detail')).toHaveTextContent('2 more weeks in a row');
  });

  it('loading, error with Retry, and a brand-new agent (no engine doc)', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<FrTrophyRoomView room={null} loading />);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    rerender(<FrTrophyRoomView room={null} error onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<FrTrophyRoomView room={trophyRoom(null)} />);
    expect(screen.getByTestId('trophy-streak')).toHaveTextContent('—');
    expect(screen.getByTestId('trophy-count')).toHaveTextContent('1 of 14 earned');
  });
});

describe('FrTrophyRoomView — award trophies (FR-5b)', () => {
  const NOW = new Date('2026-09-15T16:00:00Z');
  const crit = (label, target, current, unit) => ({ label, target, current, unit });
  const AWARDS = awardTrophies({
    awards: {
      quarterly_api: { id: 'quarterly_api', name: 'Quarterly API Award', category: 'quarterly', eligible: true, criteria: [crit('Quarterly API', 125000, 135000, 'TTD')] },
      advisor_month_api: { id: 'advisor_month_api', name: 'Advisor of the Month — API', category: 'monthly', eligible: false, criteria: [crit('Monthly API', 50000, 30000, 'TTD')] },
    },
  }, NOW);
  const AROOM = trophyRoom({ badges: ['first_submission'], points: 2100, weeklyStreak: 2 }, AWARDS);

  it('an Awards shelf after Levels: qualified shows "Qualified — {period}", unlit shows progress; counts include awards', () => {
    render(<FrTrophyRoomView room={AROOM} />);
    const shelf = screen.getByTestId('trophy-shelf-awards');
    expect(within(shelf).getByRole('heading', { name: 'Awards' })).toBeInTheDocument();
    expect(within(screen.getByTestId('trophy-quarterly_api')).getByText('Qualified — Q3 2026')).toBeInTheDocument();
    expect(within(screen.getByTestId('trophy-advisor_month_api')).getByText('60% there')).toBeInTheDocument();
    expect(screen.getByTestId('trophy-count')).toHaveTextContent(`${AROOM.earnedCount} of 16 earned`);
    fireEvent.click(screen.getByTestId('trophy-quarterly_api'));
    expect(screen.getByTestId('trophy-detail')).toHaveTextContent('Qualified — Q3 2026');
    expect(screen.getByTestId('trophy-detail')).toHaveTextContent('Decided at the end of the period');
    expect(screen.getByTestId('trophy-detail')).not.toHaveTextContent(/won/i);
  });

  it('the Awards group has its own loading and error states (badges and levels stay)', () => {
    const onRetryAwards = vi.fn();
    const { rerender } = render(<FrTrophyRoomView room={ROOM} awardsState="loading" />);
    expect(within(screen.getByTestId('trophy-shelf-awards')).getByText('Awards')).toBeInTheDocument();
    expect(screen.getByTestId('trophy-shelf-awards').querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.getByTestId('trophy-shelf-badges')).toBeInTheDocument();
    rerender(<FrTrophyRoomView room={ROOM} awardsState="error" onRetryAwards={onRetryAwards} />);
    fireEvent.click(within(screen.getByTestId('trophy-shelf-awards')).getByRole('button', { name: 'Retry' }));
    expect(onRetryAwards).toHaveBeenCalled();
  });

  it('no award from the engine: no Awards shelf (never an empty fake group)', () => {
    render(<FrTrophyRoomView room={ROOM} />);
    expect(screen.queryByTestId('trophy-shelf-awards')).toBeNull();
  });
});

describe('FrCampaignView', () => {
  it('mounts the existing campaign screen for each active campaign', () => {
    const renderCampaign = vi.fn((c) => <div data-testid={`screen-${c.id}`} />);
    render(<FrCampaignView campaigns={[{ id: 'c1', name: 'Christmas Campaign' }]} renderCampaign={renderCampaign} />);
    expect(screen.getByRole('heading', { name: 'Christmas Campaign' })).toBeInTheDocument();
    expect(screen.getByTestId('screen-c1')).toBeInTheDocument();
  });

  it('no campaign: says so and links to Awards', () => {
    const onOpenAwards = vi.fn();
    render(<FrCampaignView campaigns={[]} renderCampaign={() => null} onOpenAwards={onOpenAwards} />);
    expect(screen.getByRole('heading', { name: 'No campaign running' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /See your awards/ }));
    expect(onOpenAwards).toHaveBeenCalled();
  });
});

describe('FR-5 headers', () => {
  it('Arena: own rank and every period; off the board reads "—"', () => {
    const standing = arenaStanding({ ytd: [{ agentId: 'a', rank: 1, periodApi: 5000 }, { agentId: 'me', rank: 2, periodApi: 3000 }], week: [], mtd: [], qtd: [] }, 'me');
    render(<FrArenaHeaderView standing={standing} />);
    expect(screen.getByTestId('money-tile-rank-value')).toHaveTextContent('#2 of 2');
    expect(screen.getByTestId('arena-periods')).toHaveTextContent('This week: —');
    expect(screen.getByTestId('arena-periods')).toHaveTextContent('This year: #2');
  });

  it('Arena with no board yet: unknown tiles, no invented rank', () => {
    render(<FrArenaHeaderView standing={null} />);
    expect(screen.getByTestId('money-tile-rank-value')).toHaveTextContent('—');
    expect(screen.queryByTestId('arena-periods')).toBeNull();
  });

  it('Me: level tiles and a way into the Trophy room', () => {
    const onOpenTrophies = vi.fn();
    render(<FrMeHeaderView tiles={meTiles(ROOM)} onOpenTrophies={onOpenTrophies} />);
    expect(screen.getByTestId('money-tile-level-value')).toHaveTextContent('Pro');
    fireEvent.click(screen.getByTestId('me-open-trophies'));
    expect(onOpenTrophies).toHaveBeenCalled();
  });
});
