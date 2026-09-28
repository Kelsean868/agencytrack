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
import { trophyRoom, arenaStanding, meTiles } from '../../../../lib/fr/competeModel';

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
