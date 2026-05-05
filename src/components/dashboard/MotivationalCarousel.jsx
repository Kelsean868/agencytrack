import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight,
  Flame, Trophy, Target, Award, CheckCircle2,
  Users, TrendingUp, Calendar, Star,
  ClipboardList, Crown,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { computeAgentAwards } from '../../utils/awardsEngine';
import { extractFields } from '../../utils/extractFields';

// ── Helpers ──────────────────────────────────────────────────────────

function getQuarter(date) {
  const m = date.getMonth();
  if (m < 3) return 1;
  if (m < 6) return 2;
  if (m < 9) return 3;
  return 4;
}

function weeksUntilQuarterEnd(date) {
  const quarter = getQuarter(date);
  const year = date.getFullYear();
  const quarterEnds = {
    1: new Date(year, 2, 31),
    2: new Date(year, 5, 30),
    3: new Date(year, 8, 30),
    4: new Date(year, 11, 31),
  };
  const msLeft = quarterEnds[quarter].getTime() - date.getTime();
  return Math.max(0, Math.ceil(msLeft / (7 * 24 * 60 * 60 * 1000)));
}

function computeWeeklyStreak(submissions) {
  const submitted = (submissions ?? [])
    .filter((s) => s.status === 'submitted')
    .sort((a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? ''));

  if (submitted.length === 0) return 0;
  let streak = 1;
  for (let i = 0; i < submitted.length - 1; i++) {
    const cur  = new Date((submitted[i].weekStarting ?? '') + 'T12:00:00Z');
    const prev = new Date((submitted[i + 1].weekStarting ?? '') + 'T12:00:00Z');
    const diffWeeks = Math.round((cur.getTime() - prev.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks === 1) streak++;
    else break;
  }
  return streak;
}

function monthClosingRatio(submissions) {
  const now = new Date();
  const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthSubs = (submissions ?? []).filter(
    (s) => s.status === 'submitted' && (s.weekStarting ?? '').startsWith(curMonthStr)
  );
  const totalCI   = monthSubs.reduce((s, sub) => s + (parseInt(sub.ciConducted) || 0), 0);
  const totalApps = monthSubs.reduce((s, sub) => s + (parseInt(sub.applicationsSold) || 0), 0);
  return totalCI > 0 ? Math.round((totalApps / totalCI) * 100) : 0;
}

const AGENT_ENCOURAGEMENTS = [
  'Every dial is a step closer. Keep dialling.',
  'Consistency beats intensity. One week at a time.',
  'Your pipeline today is your commission tomorrow.',
  'Top producers weren\'t born — they were built, one submission at a time.',
  'The policy you don\'t write today is the one someone else will write tomorrow.',
];

const MANAGER_ENCOURAGEMENTS = [
  'A coached agent is a consistent agent.',
  'Your unit\'s persistency is your legacy.',
  'The best managers create more managers.',
  'An active agency is a growing agency.',
];

// ── Card builders ─────────────────────────────────────────────────────

function buildAgentCards({ submissions, confirmedSettlements, leaderboardDoc, goals, agentProfile, currentDate }) {
  const cards = [];
  const now = currentDate instanceof Date ? currentDate : new Date();
  const year = now.getFullYear();

  // 1. Streak
  const streak = computeWeeklyStreak(submissions);
  if (streak >= 2) {
    cards.push({
      id: 'streak',
      icon: Flame,
      headline: `${streak}-Week Streak!`,
      body: 'Consistency is your competitive advantage. Keep it going.',
    });
  }

  // 2. Rank
  const rank = leaderboardDoc?.rank;
  const totalAgents = leaderboardDoc?.totalAgents;
  if (rank && totalAgents) {
    cards.push({
      id: 'rank',
      icon: Trophy,
      headline: `You're ranked #${rank} of ${totalAgents}`,
      body: 'in your branch. Keep pushing.',
    });
  }

  // 3. MDRT progress (annual API from confirmed + submitted)
  const yearSubs = (submissions ?? []).filter(
    (s) => s.status === 'submitted' && (s.weekStarting ?? '').startsWith(String(year))
  );
  const confYear = (confirmedSettlements ?? []).filter((d) => {
    const y = (d.periodKey ?? '').substring(0, 4);
    return y === String(year);
  });
  const submittedAPI = yearSubs.reduce((s, sub) => s + (parseFloat(sub.apiSold) || 0), 0);
  const confirmedAPI = confYear.reduce((s, d) => s + (parseFloat(d.settledAPI) || 0), 0);
  const bestAPI = Math.max(submittedAPI, confirmedAPI);
  const mdrtTarget = 500000;
  const mdrtPct = Math.min(100, Math.round((bestAPI / mdrtTarget) * 100));
  const mdrtToGo = Math.max(0, mdrtTarget - bestAPI);
  if (mdrtPct < 100) {
    cards.push({
      id: 'mdrt',
      icon: Target,
      headline: `${mdrtPct}% to MDRT`,
      body: `${formatCurrency(mdrtToGo)} to go for your MDRT qualification.`,
    });
  } else {
    cards.push({
      id: 'mdrt_qualified',
      icon: Target,
      headline: 'MDRT Qualified!',
      body: 'Outstanding. You\'ve hit MDRT threshold for the year.',
    });
  }

  // 4. Next club
  const awards = computeAgentAwards(confirmedSettlements, submissions, agentProfile, now);
  const clubOrder = ['bronze_club_l3','bronze_club_l2','bronze_club_l1','silver_club','gold_club'];
  const nextClub = clubOrder.find((id) => awards[id] && !awards[id].eligible && awards[id].inContention);
  if (nextClub && awards[nextClub]) {
    const a = awards[nextClub];
    const apiCriterion = a.criteria.find((c) => c.unit === 'TTD');
    if (apiCriterion) {
      const toGo = Math.max(0, apiCriterion.target - apiCriterion.current);
      cards.push({
        id: 'next_club',
        icon: Award,
        headline: `${formatCurrency(toGo)} from ${a.name}`,
        body: 'Keep building your production.',
      });
    }
  }

  // 5. Weekly goal
  if (goals?.targetWeeklyAPI) {
    const sortedSubs = [...(submissions ?? [])].sort((a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? ''));
    const latestSub = sortedSubs[0];
    const weekAPI = parseFloat(latestSub?.apiSold) || 0;
    if (latestSub) {
      cards.push({
        id: 'weekly_goal',
        icon: CheckCircle2,
        headline: `${formatCurrency(weekAPI)} of ${formatCurrency(goals.targetWeeklyAPI)} API`,
        body: `This week's target from your manager.`,
      });
    }
  }

  // 6. New Names Pipeline
  const latestSubmitted = [...(submissions ?? [])]
    .filter((s) => s.status === 'submitted')
    .sort((a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? ''))[0];

  if (latestSubmitted) {
    const f = extractFields(latestSubmitted);
    const totalNewNames = f.totalNewNames ?? 0;
    const oldNamesPool  = parseFloat(latestSubmitted.oldNamesPool) || 0;

    if (totalNewNames > 0 || oldNamesPool > 0) {
      let body;
      if (totalNewNames > 0 && oldNamesPool > 0) {
        body = `You added ${totalNewNames} new names last week. Combined with your pool of ${oldNamesPool}, you have ${totalNewNames + oldNamesPool} names ready to dial.`;
      } else if (totalNewNames > 0) {
        body = `You added ${totalNewNames} new names last week. Get dialling — your pipeline is growing.`;
      } else {
        body = `You have ${oldNamesPool} names in your pipeline. Don't let them go cold.`;
      }
      cards.push({ id: 'new_names', icon: Users, headline: 'New Names Pipeline', body });
    }
  }

  // 7. Best ratio (closing)
  const closingRatio = monthClosingRatio(submissions);
  if (closingRatio > 0) {
    cards.push({
      id: 'closing_ratio',
      icon: TrendingUp,
      headline: `${closingRatio}% closing ratio this month`,
      body: 'Keep converting those CIs into sales.',
    });
  }

  // 8. Quarter countdown
  const weeksLeft = weeksUntilQuarterEnd(now);
  if (weeksLeft > 0 && weeksLeft <= 6) {
    const qtrAPIToGo = Math.max(0, 125000 - (bestAPI / 4));
    if (!awards.quarterly_api?.eligible) {
      cards.push({
        id: 'quarter_countdown',
        icon: Calendar,
        headline: `${weeksLeft} weeks left in Q${getQuarter(now)}`,
        body: `You need approx. ${formatCurrency(qtrAPIToGo)} more API for your quarterly award.`,
      });
    }
  }

  // 9. Badge earned
  const badges = leaderboardDoc?.badges ?? [];
  const recentBadge = badges[badges.length - 1];
  if (recentBadge) {
    cards.push({
      id: 'badge',
      icon: Star,
      headline: `Badge Earned: ${recentBadge}`,
      body: 'A new achievement unlocked. Well done!',
    });
  }

  // Pad with encouragements if < 2 cards
  const pool = [...AGENT_ENCOURAGEMENTS];
  let poolIdx = Math.floor(Math.random() * pool.length);
  while (cards.length < 2) {
    cards.push({
      id: `enc_${poolIdx}`,
      icon: Star,
      headline: 'Stay Consistent',
      body: pool[poolIdx % pool.length],
    });
    poolIdx++;
  }

  // Always append one encouragement rotation
  cards.push({
    id: 'encouragement',
    icon: Star,
    headline: 'Daily Reminder',
    body: AGENT_ENCOURAGEMENTS[new Date().getDay() % AGENT_ENCOURAGEMENTS.length],
  });

  return cards;
}

function buildManagerCards({ _submissions, _leaderboardDoc, _goals, unitAgents, _currentDate }) {
  const cards = [];

  // 1. Compliance
  const total = unitAgents?.length ?? 0;
  const submitted = (unitAgents ?? []).filter((a) => a.submitted).length;
  if (total > 0) {
    const pending = total - submitted;
    cards.push({
      id: 'compliance',
      icon: ClipboardList,
      headline: `${submitted} of ${total} agents submitted`,
      body: pending > 0 ? `${pending} still pending this week.` : 'Full compliance this week!',
    });
  }

  // 2. Top performer
  const topPerformer = (unitAgents ?? []).reduce((best, a) => {
    const api = parseFloat(a.weekAPI) || 0;
    return api > (parseFloat(best?.weekAPI) || 0) ? a : best;
  }, null);
  if (topPerformer && parseFloat(topPerformer.weekAPI) > 0) {
    cards.push({
      id: 'top_performer',
      icon: Crown,
      headline: `Top performer: ${topPerformer.name}`,
      body: `${formatCurrency(topPerformer.weekAPI)} API, ${topPerformer.weekApps ?? 0} apps this week.`,
    });
  }

  // 3. Streak spotlight
  const longestStreakAgent = (unitAgents ?? []).reduce((best, a) => {
    return (a.weeklyStreak ?? 0) > (best?.weeklyStreak ?? 0) ? a : best;
  }, null);
  if ((longestStreakAgent?.weeklyStreak ?? 0) >= 3) {
    cards.push({
      id: 'streak_spotlight',
      icon: Flame,
      headline: `${longestStreakAgent.name} on a ${longestStreakAgent.weeklyStreak}-week streak`,
      body: 'Celebrate their consistency in your next meeting.',
    });
  }

  // Pad to minimum 2
  const pool = [...MANAGER_ENCOURAGEMENTS];
  let poolIdx = 0;
  while (cards.length < 2) {
    cards.push({
      id: `menc_${poolIdx}`,
      icon: Star,
      headline: 'Manager Reminder',
      body: pool[poolIdx % pool.length],
    });
    poolIdx++;
  }

  cards.push({
    id: 'encouragement',
    icon: Star,
    headline: 'Leadership Today',
    body: MANAGER_ENCOURAGEMENTS[new Date().getDay() % MANAGER_ENCOURAGEMENTS.length],
  });

  return cards;
}

// ── Component ─────────────────────────────────────────────────────────

export default function MotivationalCarousel({
  role,
  submissions,
  confirmedSettlements,
  leaderboardDoc,
  goals,
  agentProfile,
  unitAgents,
  currentDate,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pausedRef = useRef(false);
  const timerRef  = useRef(null);

  const cards = useMemo(() => {
    if (role === 'agent' || role === 'tenant_admin' || role === 'platform_admin') {
      return buildAgentCards({ submissions, confirmedSettlements, leaderboardDoc, goals, agentProfile, currentDate });
    }
    return buildManagerCards({ submissions, leaderboardDoc, goals, unitAgents, currentDate });
  }, [role, submissions, confirmedSettlements, leaderboardDoc, goals, agentProfile, unitAgents, currentDate]);

  const total = cards.length;

  function advance() {
    setCurrentIndex((i) => (i + 1) % total);
  }

  function prev() {
    setCurrentIndex((i) => (i - 1 + total) % total);
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) advance();
    }, 6000);
    return () => clearInterval(timerRef.current);
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  if (total === 0) return null;

  const card = cards[currentIndex];

  return (
    <div
      className="rounded-xl bg-[#01696f]/8 border border-[#01696f]/15 px-4 py-4 mb-6 relative select-none"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Content */}
      <div className="text-center px-8 min-h-[56px] flex flex-col items-center justify-center transition-all duration-300">
        {card.icon && (
          <card.icon size={28} className="text-primary mb-2" aria-hidden="true" />
        )}
        <p className="text-sm font-bold text-primary leading-snug">{card.headline}</p>
        <p className="text-xs text-ink-muted mt-1 leading-snug">{card.body}</p>
      </div>

      {/* Nav buttons */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={advance}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`rounded-full transition-all duration-200 ${
                i === currentIndex
                  ? 'w-4 h-1.5 bg-primary'
                  : 'w-1.5 h-1.5 bg-primary/30 hover:bg-primary/60'
              }`}
              aria-label={`Go to card ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
