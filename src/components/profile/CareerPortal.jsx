import { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import BadgeGrid from '../gamification/BadgeGrid';

const CAREER_LEVELS = [
  { level: 1, title: 'Salesperson',    minApi: 200000, minApps: 42, minPersistency: 90, minYears: 0  },
  { level: 2, title: 'Advisor II',     minApi: 250000, minApps: 42, minPersistency: 90, minYears: 2  },
  { level: 3, title: 'Advisor III',    minApi: 350000, minApps: 48, minPersistency: 90, minYears: 3  },
  { level: 4, title: 'Advisor IV',     minApi: 450000, minApps: 48, minPersistency: 90, minYears: 4  },
  { level: 5, title: 'Senior Advisor', minApi: 600000, minApps: 52, minPersistency: 90, minYears: 5  },
  { level: 6, title: 'Elite Advisor',  minApi: 800000, minApps: 52, minPersistency: 90, minYears: 6  },
  { level: 7, title: 'Legend',         minApi: null,   minApps: null, minPersistency: null, minYears: 10 },
];

const MDRT_THRESHOLD = 500000;

const UNLOCK_COPY = {
  2: ['Higher commission rate (Level 2 tier)', '"Advisor II" official title', 'Access to advanced training modules'],
  3: ['Elevated commission tier', '"Advisor III" designation', 'Priority client referral access'],
  4: ['Senior commission tier unlocked', '"Advisor IV" title + business cards', 'Mentorship programme eligibility'],
  5: ['"Senior Advisor" — industry recognition', 'Dedicated branch manager support', 'Quarterly bonus eligibility'],
  6: ['"Elite Advisor" designation', 'Top-tier commission structure', 'Conference + retreat invitations'],
  7: ['"Legend" — Chairman\'s recognition', 'Lifetime achievement acknowledgement', 'Legacy client portfolio management'],
};

function ProgressBar({ value, max, colorClass = 'bg-primary' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 rounded-full bg-border/50">
      <div className={`h-2 rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CriterionRow({ label, current, target, met, formatVal }) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const barColor = met ? 'bg-success' : pct >= 0.5 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-xs text-ink">{formatVal(current)} / {formatVal(target)}</p>
          <span className="text-sm">{met ? '✅' : '❌'}</span>
        </div>
      </div>
      <ProgressBar value={current} max={target} colorClass={barColor} />
    </div>
  );
}

export default function CareerPortal({ submissions, user, persistencyData }) {
  const thisYear = new Date().getFullYear();

  const { ytdAPI, ytdApps, avgPersistency, yearsOfService } = useMemo(() => {
    const ytdSubs = (submissions ?? []).filter(
      (s) => s.status === 'submitted' && s.weekStarting?.startsWith(String(thisYear))
    );
    const ytdAPI  = ytdSubs.reduce((sum, s) => sum + (parseFloat(s.apiSold) || 0), 0);
    const ytdApps = ytdSubs.reduce((sum, s) => sum + (parseFloat(s.applicationsSold || s.appsSold) || 0), 0);

    const persEntries = Object.values(persistencyData ?? {}).filter((p) => p.year === thisYear);
    const avgPersistency =
      persEntries.length > 0
        ? persEntries.reduce((sum, p) => sum + (parseFloat(p.persistency) || 0), 0) / persEntries.length
        : null;

    let yearsOfService = null;
    if (user?.startDate) {
      const start = new Date(user.startDate);
      if (!isNaN(start)) {
        yearsOfService = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      }
    }

    return { ytdAPI, ytdApps, avgPersistency, yearsOfService };
  }, [submissions, persistencyData, user, thisYear]);

  const currentLevel = useMemo(() => {
    let highest = CAREER_LEVELS[0];
    for (const lvl of CAREER_LEVELS) {
      const apiOk   = lvl.minApi === null   || ytdAPI >= lvl.minApi;
      const appsOk  = lvl.minApps === null  || ytdApps >= lvl.minApps;
      const persOk  = lvl.minPersistency === null || (avgPersistency !== null && avgPersistency >= lvl.minPersistency);
      const yearsOk = lvl.minYears === 0 || (yearsOfService !== null && yearsOfService >= lvl.minYears);
      if (apiOk && appsOk && persOk && yearsOk) {
        highest = lvl;
      } else {
        break;
      }
    }
    return highest;
  }, [ytdAPI, ytdApps, avgPersistency, yearsOfService]);

  const nextLevel = CAREER_LEVELS.find((l) => l.level === currentLevel.level + 1) ?? null;

  return (
    <div className="flex flex-col gap-5 pb-8">

      {/* Current level badge */}
      <div className="card flex items-center gap-5">
        <div className="w-20 h-20 shrink-0 rounded-full border-4 border-primary flex items-center justify-center">
          <span className="text-3xl font-bold text-primary">{currentLevel.level}</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-0.5">Current Career Level</p>
          <p className="text-xl font-bold text-ink">{currentLevel.title}</p>
          {currentLevel.level === 7 && (
            <p className="text-xs text-primary mt-1">You've reached the pinnacle 🏆</p>
          )}
        </div>
      </div>

      {/* Progress to next level */}
      {nextLevel && (
        <div className="card flex flex-col gap-4">
          <p className="text-sm font-semibold text-ink">
            Progress toward Level {nextLevel.level} — {nextLevel.title}
          </p>

          {nextLevel.minApi !== null && (
            <CriterionRow
              label="Annual API (TTD)"
              current={ytdAPI}
              target={nextLevel.minApi}
              met={ytdAPI >= nextLevel.minApi}
              formatVal={formatCurrency}
            />
          )}
          {nextLevel.minApps !== null && (
            <CriterionRow
              label="Applications Sold"
              current={ytdApps}
              target={nextLevel.minApps}
              met={ytdApps >= nextLevel.minApps}
              formatVal={(v) => Math.round(v)}
            />
          )}
          {nextLevel.minPersistency !== null && avgPersistency !== null && (
            <CriterionRow
              label="Persistency Rate"
              current={avgPersistency}
              target={nextLevel.minPersistency}
              met={avgPersistency >= nextLevel.minPersistency}
              formatVal={(v) => `${Math.round(v)}%`}
            />
          )}
          {nextLevel.minPersistency !== null && avgPersistency === null && (
            <p className="text-xs text-ink-muted italic">Persistency not yet recorded for this year.</p>
          )}
          {nextLevel.minYears > 0 && yearsOfService === null && (
            <p className="text-xs text-ink-muted italic">Contact your manager to confirm your service years.</p>
          )}
          {nextLevel.minYears > 0 && yearsOfService !== null && (
            <CriterionRow
              label="Years of Service"
              current={yearsOfService}
              target={nextLevel.minYears}
              met={yearsOfService >= nextLevel.minYears}
              formatVal={(v) => `${Math.floor(v)} yr${Math.floor(v) !== 1 ? 's' : ''}`}
            />
          )}
        </div>
      )}

      {/* What unlocks next */}
      {nextLevel && UNLOCK_COPY[nextLevel.level] && (
        <div className="card">
          <p className="text-sm font-semibold text-ink mb-3">What you unlock at Level {nextLevel.level}</p>
          <ul className="flex flex-col gap-2">
            {UNLOCK_COPY[nextLevel.level].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
                <span className="text-primary mt-0.5 shrink-0">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* MDRT tracker */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-semibold text-ink">MDRT Status</p>
          {ytdAPI >= MDRT_THRESHOLD ? (
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-success/15 text-success">
              🏆 MDRT Qualified
            </span>
          ) : (
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-warning/15 text-warning">
              ⭐ MDRT Tracker
            </span>
          )}
        </div>
        <div className="flex justify-between text-xs text-ink-muted">
          <span>{formatCurrency(ytdAPI)}</span>
          <span>{formatCurrency(MDRT_THRESHOLD)}</span>
        </div>
        <ProgressBar
          value={ytdAPI}
          max={MDRT_THRESHOLD}
          colorClass={ytdAPI >= MDRT_THRESHOLD ? 'bg-success' : ytdAPI >= MDRT_THRESHOLD * 0.5 ? 'bg-warning' : 'bg-primary'}
        />
        <p className="text-xs text-ink-muted">
          {ytdAPI >= MDRT_THRESHOLD
            ? 'Congratulations — MDRT threshold achieved!'
            : `${formatCurrency(Math.max(0, MDRT_THRESHOLD - ytdAPI))} remaining to qualify`}
        </p>
      </div>

      {/* Badges */}
      <div className="card">
        <p className="text-sm font-semibold text-ink mb-3">Achievement Badges</p>
        <BadgeGrid submissions={submissions} />
      </div>
    </div>
  );
}
