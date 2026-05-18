import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, X, Check, CheckCircle2, XCircle, Trophy, Star } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { getGoals, setGoals, getCompanyMinimums } from '../../services/goalsService';
import { aggregatePersistency } from '../../lib/persistency/calculations';
import { useAuth } from '../../context/AuthContext';
import BadgeGrid from '../gamification/BadgeGrid';
import CommissionPlayground from '../goals/CommissionPlayground';
import GapAnalysisPanel from '../goals/GapAnalysisPanel';

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
          {met
            ? <CheckCircle2 size={14} className="text-success shrink-0" />
            : <XCircle size={14} className="text-danger shrink-0" />
          }
        </div>
      </div>
      <ProgressBar value={current} max={target} colorClass={barColor} />
    </div>
  );
}

function commitmentColorClass(value, managerTarget, floor) {
  if (value >= managerTarget && managerTarget > 0) return 'text-success font-semibold';
  if (value >= floor)                               return 'text-warning font-semibold';
  return 'text-danger font-semibold';
}

// ── Goals Overview section ────────────────────────────────────────────────────
function GoalsOverview({ _submissions, _user, _persistencyData }) {
  const { user: authUser, userProfile, tenantId } = useAuth();
  const [goals, setGoalsState]       = useState(null);
  const [minimums, setMinimums]      = useState(null);
  const [editing, setEditing]        = useState(false);
  const [showDerived, setShowDerived] = useState(false);
  const [saving, setSaving]          = useState(false);
  const [saveError, setSaveError]    = useState('');
  const [draft, setDraft]            = useState({
    personalAnnualAPI:         '',
    personalAnnualApps:        '',
    personalAnnualPersistency: '',
  });

  useEffect(() => {
    if (!authUser?.uid || !tenantId) return;
    Promise.all([
      getGoals(tenantId, authUser.uid).catch(() => null),
      getCompanyMinimums(tenantId).catch(() => ({ annualAPI: 200000, annualApps: 42, persistency: 90 })),
    ]).then(([g, mins]) => {
      setGoalsState(g);
      setMinimums(mins);
      setDraft({
        personalAnnualAPI:         g?.personalAnnualAPI         ?? '',
        personalAnnualApps:        g?.personalAnnualApps        ?? '',
        personalAnnualPersistency: g?.personalAnnualPersistency ?? '',
      });
    });
  }, [authUser?.uid, tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setSaveError('');
    try {
      const name = userProfile?.name ?? userProfile?.email ?? 'Agent';
      await setGoals(tenantId, authUser.uid, {
        personalAnnualAPI:         draft.personalAnnualAPI,
        personalAnnualApps:        draft.personalAnnualApps,
        personalAnnualPersistency: draft.personalAnnualPersistency,
      }, authUser.uid, name);
      const updated = await getGoals(tenantId, authUser.uid);
      setGoalsState(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const mins  = minimums ?? { annualAPI: 200000, annualApps: 42, persistency: 90 };
  const mgr   = {
    api:         goals?.targetAnnualAPI         ?? 0,
    apps:        goals?.targetAnnualApps        ?? 0,
    persistency: goals?.targetAnnualPersistency ?? 0,
  };
  const mine  = {
    api:         goals?.personalAnnualAPI         ?? 0,
    apps:        goals?.personalAnnualApps        ?? 0,
    persistency: goals?.personalAnnualPersistency ?? 0,
  };

  const rows = [
    {
      label: 'Annual API (TTD)',
      min: formatCurrency(mins.annualAPI),
      mgr: mgr.api > 0 ? formatCurrency(mgr.api) : '—',
      mine: mine.api > 0 ? formatCurrency(mine.api) : '—',
      color: mine.api > 0 ? commitmentColorClass(mine.api, mgr.api, mins.annualAPI) : 'text-ink-muted',
      draftKey: 'personalAnnualAPI',
      monthly: mine.api > 0 ? formatCurrency(mine.api / 10) : '—',
      weekly:  mine.api > 0 ? formatCurrency(mine.api / 40) : '—',
    },
    {
      label: 'Annual Apps',
      min: mins.annualApps,
      mgr: mgr.apps > 0 ? mgr.apps : '—',
      mine: mine.apps > 0 ? mine.apps : '—',
      color: mine.apps > 0 ? commitmentColorClass(mine.apps, mgr.apps, mins.annualApps) : 'text-ink-muted',
      draftKey: 'personalAnnualApps',
      monthly: mine.apps > 0 ? Math.ceil(mine.apps / 10) : '—',
      weekly:  mine.apps > 0 ? Math.ceil(mine.apps / 40) : '—',
    },
    {
      label: 'Persistency %',
      min: `${mins.persistency}%`,
      mgr: mgr.persistency > 0 ? `${mgr.persistency}%` : '—',
      mine: mine.persistency > 0 ? `${mine.persistency}%` : '—',
      color: mine.persistency > 0 ? commitmentColorClass(mine.persistency, mgr.persistency, mins.persistency) : 'text-ink-muted',
      draftKey: 'personalAnnualPersistency',
      monthly: null,
      weekly:  null,
    },
  ];

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-ink">Goals Overview</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDerived((v) => !v)}
            className="text-xs text-primary hover:underline"
          >
            {showDerived ? 'Hide monthly / weekly' : 'Show monthly / weekly'}
          </button>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 h-11 px-4 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              <Pencil size={12} />
              Edit My Goals
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                aria-label="Cancel edit"
                onClick={() => { setEditing(false); setSaveError(''); }}
                className="h-11 px-4 rounded-lg border border-border text-sm text-ink-muted hover:text-ink transition-colors"
              >
                <X size={12} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-11 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold disabled:opacity-60 hover:bg-primary-dark dark:hover:bg-primary transition-colors flex items-center gap-1"
              >
                <Check size={12} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs border-collapse min-w-[320px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-2 py-1.5 text-ink-muted font-semibold">Metric</th>
              <th className="text-right px-2 py-1.5 text-ink-muted font-semibold">Company Min</th>
              <th className="text-right px-2 py-1.5 text-ink-muted font-semibold">Manager Target</th>
              <th className="text-right px-2 py-1.5 text-ink-muted font-semibold">My Commitment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <React.Fragment key={row.label}>
                <tr className={i % 2 === 0 ? 'bg-card-raised' : 'bg-card'}>
                  <td className="px-2 py-2 font-medium text-ink">{row.label}</td>
                  <td className="px-2 py-2 text-right text-ink-muted">{String(row.min)}</td>
                  <td className="px-2 py-2 text-right text-ink-muted">{String(row.mgr)}</td>
                  <td className={`px-2 py-2 text-right ${row.color}`}>
                    {editing ? (
                      <input
                        type="number"
                        min={0}
                        step={row.draftKey === 'personalAnnualAPI' ? 1000 : 1}
                        value={draft[row.draftKey]}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [row.draftKey]: e.target.value }))
                        }
                        className="w-28 h-7 px-2 rounded border border-primary/40 text-xs text-ink focus:outline-none text-right"
                      />
                    ) : (
                      String(row.mine)
                    )}
                  </td>
                </tr>
                {showDerived && row.monthly !== null && (
                  <tr className={`${i % 2 === 0 ? 'bg-card-raised' : 'bg-card'} opacity-70`}>
                    <td className="pl-6 pr-2 py-1 text-ink-muted italic">↳ Monthly / Weekly</td>
                    <td className="px-2 py-1 text-right text-ink-muted">—</td>
                    <td className="px-2 py-1 text-right text-ink-muted">—</td>
                    <td className="px-2 py-1 text-right text-ink-muted">
                      {row.monthly !== '—' ? `${row.monthly} / ${row.weekly}` : '—'}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manager-set period targets — read-only */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Manager-Set Period Targets</p>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Monthly Target (set by manager)</span>
          <span className="font-medium text-ink">
            {goals?.targetMonthlyAPI ? formatCurrency(parseFloat(goals.targetMonthlyAPI)) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Quarterly Target (set by manager)</span>
          <span className="font-medium text-ink">
            {goals?.targetQuarterlyAPI ? formatCurrency(parseFloat(goals.targetQuarterlyAPI)) : '—'}
          </span>
        </div>
      </div>

      {saveError && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{saveError}</p>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-ink-muted pt-1 border-t border-border/60">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> At or above manager target</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> Above floor, below target</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger inline-block" /> Below company minimum</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CareerPortal({ submissions, user, persistencyData, hierarchy, hierarchyLoading, hierarchyError, ytdTotals }) {
  const thisYear = new Date().getFullYear();

  const { ytdAPI, ytdApps, avgPersistency, yearsOfService } = useMemo(() => {
    const ytdSubs = (submissions ?? []).filter(
      (s) => s.status === 'submitted' && s.weekStarting?.startsWith(String(thisYear))
    );
    const ytdAPI  = ytdSubs.reduce((sum, s) => sum + (parseFloat(s.apiSold) || 0), 0);
    const ytdApps = ytdSubs.reduce((sum, s) => sum + (parseFloat(s.applicationsSold || s.appsSold) || 0), 0);

    // E3: persistencyData is now an array of E3 records (oldest-first). YTD
    // aggregation uses sum-then-divide via aggregatePersistency() — fixes the
    // pre-existing average-of-percentages bug. avgPersistency is kept on the
    // 0–100 scale so CAREER_LEVELS thresholds (minPersistency: 90) still apply.
    const persArr = Array.isArray(persistencyData) ? persistencyData : [];
    const ytdPers = persArr.filter((p) => p.year === thisYear);
    const avgPersistency = ytdPers.length > 0
      ? aggregatePersistency(ytdPers).aggregatedPersistency * 100
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

  const { user: authUser, tenantId } = useAuth();

  return (
    <div className="flex flex-col gap-5 pb-8">

      {/* Goals Overview — first section */}
      <GoalsOverview submissions={submissions} user={user} persistencyData={persistencyData} />

      {/* Commission Playground */}
      <CommissionPlayground
        submissions={submissions}
        agentId={authUser?.uid}
        tenantId={tenantId}
      />

      {/* Current level badge */}
      <div className="card flex items-center gap-5">
        <div className="w-20 h-20 shrink-0 rounded-full border-4 border-primary flex items-center justify-center">
          <span className="text-3xl font-bold text-primary">{currentLevel.level}</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-0.5">Current Career Level</p>
          <p className="text-xl font-bold text-ink">{currentLevel.title}</p>
          {currentLevel.level === 7 && (
            <p className="text-xs text-primary mt-1 flex items-center gap-1"><Trophy size={12} /> You've reached the pinnacle</p>
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

      {/* Goal Hierarchy */}
      <GapAnalysisPanel
        hierarchy={hierarchy ?? null}
        ytdTotals={ytdTotals ?? { api: ytdAPI, apps: ytdApps, ffiConducted: 0, ciConducted: 0, dials: 0 }}
        loading={hierarchyLoading ?? false}
        error={hierarchyError ?? null}
        title="Goal Hierarchy"
      />

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
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-success/15 text-success">
              <Trophy size={12} /> MDRT Qualified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-warning/15 text-warning">
              <Star size={12} /> MDRT Tracker
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
      <section
        aria-labelledby="career-portal-achievements-heading"
        className="card"
      >
        <h3
          id="career-portal-achievements-heading"
          className="text-sm font-semibold text-ink mb-3"
        >
          Achievement Badges
        </h3>
        <BadgeGrid submissions={submissions} />
      </section>
    </div>
  );
}
