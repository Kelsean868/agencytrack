import { useMemo } from 'react';

export const BADGES = {
  first_submission: { label: 'First Step',      icon: '🎯', desc: 'Submitted your first report' },
  streak_4:         { label: 'On a Roll',        icon: '🔥', desc: '4 consecutive weeks submitted' },
  streak_8:         { label: 'Consistent',       icon: '💎', desc: '8 consecutive weeks submitted' },
  streak_13:        { label: 'Unstoppable',      icon: '🚀', desc: '13 consecutive weeks submitted' },
  mdrt_pace:        { label: 'MDRT Pace',        icon: '⭐', desc: 'On track for MDRT (50%+ of $500k by mid-year)' },
  mdrt_qualified:   { label: 'MDRT Qualified',   icon: '🏆', desc: 'Achieved MDRT threshold ($500k API)' },
  top_apps_week:    { label: 'App Machine',      icon: '📋', desc: '5+ applications in a single week' },
  big_week:         { label: 'Big Week',         icon: '💰', desc: 'Over $20,000 API in a single week' },
  century_dials:    { label: 'Dialler',          icon: '📞', desc: '100+ dials in a single week' },
};

export const BADGE_KEY_ORDER = [
  'first_submission', 'streak_4', 'streak_8', 'streak_13',
  'mdrt_pace', 'mdrt_qualified', 'top_apps_week', 'big_week', 'century_dials',
];

export function computeEarnedBadges(submissions) {
  const earned = new Set();
  if (!submissions || submissions.length === 0) return earned;

  const submitted = submissions.filter((s) => s.status === 'submitted');
  if (submitted.length === 0) return earned;

  earned.add('first_submission');

  const thisYear = new Date().getFullYear();
  let ytdAPI = 0;

  submitted.forEach((s) => {
    const dials =
      (parseFloat(s.referralCalls) || 0) +
      (parseFloat(s.followUpCalls) || 0) +
      (parseFloat(s.coldCalls) || 0) +
      (parseFloat(s.seminarTradeshowCalls) || 0);
    const apps = parseFloat(s.applicationsSold || s.appsSold) || 0;
    const api  = parseFloat(s.apiSold || s.api) || 0;

    if (apps >= 5)   earned.add('top_apps_week');
    if (api >= 20000) earned.add('big_week');
    if (dials >= 100) earned.add('century_dials');

    if (s.weekStarting?.startsWith(String(thisYear))) ytdAPI += api;
  });

  if (ytdAPI >= 500000) {
    earned.add('mdrt_qualified');
  } else {
    // MDRT pace: first 26 weeks of year and already at 50%+
    const weekOfYear = Math.ceil(
      (Date.now() - new Date(thisYear, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    if (weekOfYear <= 26 && ytdAPI >= 250000) earned.add('mdrt_pace');
  }

  // Consecutive-week streak (sorted desc, unique weeks)
  const uniqueWeeks = [
    ...new Set(submitted.map((s) => s.weekStarting).filter(Boolean)),
  ].sort((a, b) => b.localeCompare(a));

  let streak = uniqueWeeks.length > 0 ? 1 : 0;
  for (let i = 1; i < uniqueWeeks.length; i++) {
    const prev = new Date(uniqueWeeks[i - 1] + 'T00:00:00');
    const curr = new Date(uniqueWeeks[i] + 'T00:00:00');
    if (Math.round((prev - curr) / (7 * 24 * 60 * 60 * 1000)) === 1) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 4)  earned.add('streak_4');
  if (streak >= 8)  earned.add('streak_8');
  if (streak >= 13) earned.add('streak_13');

  return earned;
}

// Props: earnedBadges (Set or string[]) OR submissions (array) — if both, submissions takes precedence
export default function BadgeGrid({ earnedBadges, submissions }) {
  const earned = useMemo(() => {
    if (submissions) return computeEarnedBadges(submissions);
    if (earnedBadges instanceof Set) return earnedBadges;
    return new Set(earnedBadges ?? []);
  }, [submissions, earnedBadges]);

  return (
    <div className="grid grid-cols-3 gap-3">
      {BADGE_KEY_ORDER.map((key) => {
        const b = BADGES[key];
        const isEarned = earned.has(key);
        return (
          <div
            key={key}
            title={b.desc}
            className={`flex flex-col items-center gap-1.5 rounded-xl p-3 border transition-colors ${
              isEarned
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-surface opacity-40 grayscale'
            }`}
          >
            <span className="text-2xl leading-none">{b.icon}</span>
            <p className={`text-xs font-semibold text-center leading-tight ${isEarned ? 'text-ink' : 'text-ink-muted'}`}>
              {b.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
