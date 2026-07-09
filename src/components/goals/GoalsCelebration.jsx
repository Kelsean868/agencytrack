import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import CelebrationTakeover from '../ui/CelebrationTakeover';
import { useCountUp } from '../../hooks/useCountUp';

/**
 * GoalsCelebration — the Goals-surface celebration takeovers (design intent:
 * goals-v2-celebrate). Two variants ship; the third (quarter) is skip-logged
 * because no per-quarter target exists in the goal hierarchy (only an annual
 * personal.api), so "Q closed on goal" cannot be derived honestly.
 *
 *   • annual — gold trophy, annual commitment hit (the year's biggest moment)
 *   • streak — bronze flame, N consecutive weeks clearing the weekly API target
 *
 * `celebration` is the resolved shape from resolveGoalsCelebration(); null
 * renders nothing.
 */
export default function GoalsCelebration({ celebration, annualTarget, ytdApi, streak, onClose }) {
  if (!celebration) return null;
  if (celebration.type === 'annual') {
    return <AnnualTakeover annualTarget={annualTarget} ytdApi={ytdApi} onClose={onClose} />;
  }
  if (celebration.type === 'streak') {
    return <StreakTakeover milestone={celebration.milestone} streak={streak} onClose={onClose} />;
  }
  return null;
}

function AnnualTakeover({ annualTarget, ytdApi, onClose }) {
  const shownYtd = useCountUp(ytdApi, { duration: 1100, decimals: 0 });
  const over = Math.max(0, ytdApi - annualTarget);
  const stats = [
    { label: 'COMMITMENT', value: formatCurrency(annualTarget), highlight: true },
    { label: 'YTD', value: formatCurrency(shownYtd) },
  ];
  if (over > 0) stats.push({ label: 'OVER', value: `+${formatCurrency(over)}` });
  return (
    <CelebrationTakeover
      open
      onClose={onClose}
      medal="gold"
      accent="gold"
      eyebrow="ANNUAL COMMITMENT · HIT"
      title={<>{formatCurrency(annualTarget)}. Done.</>}
      body={`You hit the annual commitment you set for yourself${over > 0 ? ` — ${formatCurrency(over)} above it` : ''}. That's the whole year, delivered.`}
      stats={stats}
      primaryCta={{ label: 'Keep building', onClick: onClose }}
      confettiColors={['gold', 'primary', 'success']}
      testId="goals-celebration-annual"
      labelId="goals-celebration-annual-title"
    />
  );
}

function StreakTakeover({ milestone, streak, onClose }) {
  const shownStreak = useCountUp(streak, { duration: 900, decimals: 0 });
  return (
    <CelebrationTakeover
      open
      onClose={onClose}
      medal="bronze"
      accent="warning"
      eyebrow={`WEEKLY STREAK · ${milestone} WEEKS`}
      title={<>{milestone} weeks.<br />Every target.</>}
      body={`${milestone} straight weeks clearing your weekly API target — this is how the annual number gets caught.`}
      stats={[{ label: 'WEEK STREAK', value: String(shownStreak), highlight: true }]}
      primaryCta={{ label: 'Keep the streak alive', onClick: onClose }}
      confettiColors={['gold', 'warning', 'primary']}
      testId="goals-celebration-streak"
      labelId="goals-celebration-streak-title"
    />
  );
}
