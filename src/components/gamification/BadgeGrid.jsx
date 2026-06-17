import React, { useMemo } from 'react';
import {
  Target, Flame, Zap, Star, Trophy, CheckCircle, TrendingUp, Crown, Phone, Lock,
} from 'lucide-react';

const TIER_TOTAL = 5;

// eslint-disable-next-line react-refresh/only-export-components
export const BADGES = {
  first_submission: { label: 'First Step',     Icon: Target,      desc: 'Submitted your first report',                   gradient: 'medal-3', tier: 1 },
  streak_4:         { label: 'On a Roll',      Icon: Flame,       desc: '4 consecutive weeks submitted',                 gradient: 'medal-3', tier: 1 },
  streak_8:         { label: 'Committed',      Icon: Zap,         desc: '8 consecutive weeks submitted',                 gradient: 'medal-3', tier: 2 },
  streak_13:        { label: 'Quarter Strong', Icon: Crown,       desc: '13 consecutive weeks submitted',                gradient: 'medal-2', tier: 3 },
  mdrt_pace:        { label: 'MDRT Pace',      Icon: Star,        desc: 'On track for MDRT (50%+ of $500k by mid-year)', gradient: 'medal-1', tier: 3 },
  mdrt_qualified:   { label: 'MDRT Qualified', Icon: Trophy,      desc: 'Achieved MDRT threshold ($500k API)',           gradient: 'medal-4', tier: 5 },
  top_apps_week:    { label: 'Closer',         Icon: CheckCircle, desc: '5+ applications in a single week',              gradient: 'medal-3', tier: 2 },
  big_week:         { label: 'Big Week',       Icon: TrendingUp,  desc: 'Over $20,000 API in a single week',             gradient: 'medal-2', tier: 3 },
  century_dials:    { label: 'Century',        Icon: Zap,         desc: '100+ dials in a single week',                   gradient: 'medal-5', tier: 2 },
  dial_king:        { label: 'Dial King',      Icon: Phone,       desc: 'Highest dials in unit that week',               gradient: 'medal-6', tier: 3 },
  sharpshooter:     { label: 'Sharpshooter',   Icon: Target,      desc: 'Closing ratio > 80% for a week',                gradient: 'medal-1', tier: 4 },
  mdrt_bound:       { label: 'MDRT Bound',     Icon: Crown,       desc: 'YTD API crosses 50% of MDRT threshold',         gradient: 'medal-5', tier: 4 },
  untouchable:      { label: 'Untouchable',    Icon: Trophy,      desc: '52 consecutive weeks submitted',                gradient: 'medal-7', tier: 5 },
  consistent:       { label: 'Consistent',     Icon: Star,        desc: '12 consecutive months ≥ 90% persistency',       gradient: 'medal-8', tier: 5 },
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
    <div className="badge-grid">
      {BADGE_KEY_ORDER.map((key) => {
        const b = BADGES[key];
        const isEarned = earned.has(key);
        const Icon = b.Icon;
        return (
          <div
            key={key}
            className={`badge-item ${isEarned ? 'earned' : 'locked'}`}
            {...(isEarned ? {} : { 'aria-label': `${b.label} — locked` })}
          >
            <div className={`badge-medal ${isEarned ? `${b.gradient} glow` : 'medal-locked'}`}>
              <Icon className="medal-ico" size={26} strokeWidth={2} aria-hidden="true" />
              {!isEarned && (
                <span className="lock-pin">
                  <Lock size={10} strokeWidth={2.4} aria-hidden="true" />
                </span>
              )}
            </div>
            <div
              className="tier-pips"
              role="img"
              aria-label={`Tier ${b.tier} of ${TIER_TOTAL}`}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`tier-pip ${(n > b.tier || !isEarned) ? 'dim' : ''}`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <div className="badge-name">{b.label}</div>
            <div className="badge-sub">{b.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
