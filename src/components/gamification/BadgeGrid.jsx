import { useMemo } from 'react';
import { Target, Flame, Zap, Star, Trophy, CheckCircle, TrendingUp, Crown, Phone } from 'lucide-react';

// eslint-disable-next-line react-refresh/only-export-components
export const BADGES = {
  first_submission: { label: 'First Step',    Icon: Target,      accent: 'text-primary',       desc: 'Submitted your first report' },
  streak_4:         { label: 'On a Roll',      Icon: Flame,       accent: 'text-warning',       desc: '4 consecutive weeks submitted' },
  streak_8:         { label: 'Consistent',     Icon: Zap,         accent: 'text-warning',       desc: '8 consecutive weeks submitted' },
  streak_13:        { label: 'Unstoppable',    Icon: Crown,       accent: 'text-danger',        desc: '13 consecutive weeks submitted' },
  mdrt_pace:        { label: 'MDRT Pace',      Icon: Star,        accent: 'text-warning',       desc: 'On track for MDRT (50%+ of $500k by mid-year)' },
  mdrt_qualified:   { label: 'MDRT Qualified', Icon: Trophy,      accent: 'text-success',       desc: 'Achieved MDRT threshold ($500k API)' },
  top_apps_week:    { label: 'App Machine',    Icon: CheckCircle, accent: 'text-primary',       desc: '5+ applications in a single week' },
  big_week:         { label: 'Big Week',       Icon: TrendingUp,  accent: 'text-success',       desc: 'Over $20,000 API in a single week' },
  century_dials:    { label: 'Dialler',        Icon: Zap,         accent: 'text-primary',       desc: '100+ dials in a single week' },
  dial_king:        { label: 'Dial King',      Icon: Phone,       accent: 'text-[#3b82f6]',     desc: 'Highest dials in unit that week' },
  sharpshooter:     { label: 'Sharpshooter',   Icon: Target,      accent: 'text-[#8b5cf6]',     desc: 'Closing ratio > 80% for a week' },
  mdrt_bound:       { label: 'MDRT Bound',     Icon: Crown,       accent: 'text-warning',       desc: 'YTD API crosses 50% of MDRT threshold' },
  untouchable:      { label: 'Untouchable',    Icon: Trophy,      accent: 'text-primary',       desc: '52 consecutive weeks submitted' },
  consistent:       { label: 'Consistent',     Icon: Star,        accent: 'text-warning',       desc: '12 consecutive months ≥ 90% persistency' },
};

// eslint-disable-next-line react-refresh/only-export-components
export const BADGE_KEY_ORDER = [
  'first_submission', 'streak_4', 'streak_8', 'streak_13',
  'mdrt_pace', 'mdrt_qualified', 'top_apps_week', 'big_week', 'century_dials',
  'dial_king', 'sharpshooter', 'mdrt_bound', 'untouchable', 'consistent',
];

// eslint-disable-next-line react-refresh/only-export-components
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

    if (apps >= 5)    earned.add('top_apps_week');
    if (api >= 20000) earned.add('big_week');
    if (dials >= 100) earned.add('century_dials');

    if (s.weekStarting?.startsWith(String(thisYear))) ytdAPI += api;
  });

  if (ytdAPI >= 500000) {
    earned.add('mdrt_qualified');
  } else {
    const weekOfYear = Math.ceil(
      (Date.now() - new Date(thisYear, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    if (weekOfYear <= 26 && ytdAPI >= 250000) earned.add('mdrt_pace');
  }

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
            <b.Icon size={20} className={isEarned ? b.accent : 'text-ink-muted'} />
            <p className={`text-xs font-semibold text-center leading-tight ${isEarned ? 'text-ink' : 'text-ink-muted'}`}>
              {b.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
