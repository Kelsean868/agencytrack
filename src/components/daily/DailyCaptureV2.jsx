import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Plus, Loader2, Check, Minus, Flame } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import { useAuth } from '../../context/AuthContext';
import {
  saveDailyEntry,
  getDailyEntry,
  getDailyEntriesForWeek,
} from '../../services/dailyActivityService';
import { createEmptyDailyEntry, getSundayOf } from '../../lib/schema/dailyActivity';
import { getDraft } from '../../services/submissionService';
import { aggregateCurrentWeekDaily } from '../../services/loggingModeService';
import { getTodayTT } from '../../utils/dateInputs';
import { weekNumber } from '../../utils/dateHelpers';
import {
  computeLumpsumCredit,
  computeLumpsumCommission,
  computeTotalProductionCredit,
  validatePppIncrease,
} from '../../lib/schema/weeklyReport.computations';
import { MIN_PPP_INCREASE } from '../../lib/schema/weeklyReport';
import { formatCurrency } from '../../utils/formatters';
import {
  deriveCountStripChips,
  computeDayPoints,
  deriveWeekStripDays,
  computeStreak,
  mapFloorToPoints,
  elapsedWorkingDays,
  computePaceState,
  computeWeekToDatePoints,
  sumWeekApi,
} from './DailyCaptureV2.helpers';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../utils/weeklyActivityFloors';
import { getCompanyMinimums } from '../../services/goalsService';
import CelebrationTakeover from '../ui/CelebrationTakeover';
import { resolveStreakCelebration } from '../../lib/celebrations';
import {
  getDailyStreakCelebratedMax,
  setDailyStreakCelebratedMax,
} from '../../lib/celebrationPrefs';
import { useCountUp } from '../../hooks/useCountUp';

// ── Local helpers ──────────────────────────────────────────────────────────

/**
 * Blank-fill a daily entry from a Planner handoff seed (item 3.2 screen 9). Only
 * fills fields whose current value is 0/blank — NEVER overwrites an existing
 * logged value, so a partly-logged day is safe. Seed shape: flat count fields
 * (dials/telContacts/qualifiedApproaches/ffiConducted/ciConducted) + a nested
 * newBusiness { apps, api }. The agent still confirms/edits before Save.
 */
function blankFillSeed(entry, seed) {
  if (!seed) return entry;
  const next = { ...entry };
  for (const [k, v] of Object.entries(seed)) {
    if (k === 'newBusiness' && v && typeof v === 'object') {
      const nb = { ...(next.newBusiness ?? {}) };
      if ((parseFloat(nb.apps) || 0) === 0 && v.apps) nb.apps = v.apps;
      if ((parseFloat(nb.api)  || 0) === 0 && v.api)  nb.api  = v.api;
      next.newBusiness = nb;
    } else if (typeof v === 'number' && v > 0) {
      if ((parseFloat(next[k]) || 0) === 0) next[k] = v;
    }
  }
  return next;
}

function weekdayLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-TT', { weekday: 'long' }).toUpperCase();
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-TT', { weekday: 'long', day: 'numeric', month: 'short' });
}

const intOrZero   = (v) => parseInt(v, 10) || 0;
const floatOrZero = (v) => parseFloat(v) || 0;

const PACE_LABELS = {
  ahead:    'Ahead',
  'on-pace': 'On pace',
  behind:   'Behind',
};

const PACE_BADGE_CLASSES = {
  ahead:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'on-pace': 'bg-primary/10 text-primary',
  behind:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

// ── Sub-components ─────────────────────────────────────────────────────────

function Stepper({ value, onChange, ariaLabel, allowDecimal = false }) {
  const v    = allowDecimal ? floatOrZero(value) : intOrZero(value);
  const step = allowDecimal ? 0.5 : 1;
  const handle = (next) => {
    if (next < 0) return;
    onChange(allowDecimal ? next : Math.round(next));
  };
  const handleType = (raw) => {
    if (raw === '') return onChange(0);
    if (allowDecimal) {
      const n = parseFloat(raw);
      if (!Number.isNaN(n) && n >= 0) onChange(n);
    } else {
      const cleaned = raw.replace(/[^0-9]/g, '');
      onChange(cleaned === '' ? 0 : parseInt(cleaned, 10));
    }
  };
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${ariaLabel} decrease`}
        onClick={() => handle(v - step)}
        disabled={v <= 0}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-ink transition-colors"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        pattern={allowDecimal ? undefined : '[0-9]*'}
        value={v === 0 ? '' : v}
        placeholder="0"
        aria-label={ariaLabel}
        onChange={(e) => handleType(e.target.value)}
        className="w-12 h-11 text-center rounded-lg border border-border bg-surface text-ink text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="button"
        aria-label={`${ariaLabel} increase`}
        onClick={() => handle(v + step)}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function StepperRow({ label, name, value, onChange, allowDecimal = false }) {
  const id = `dcv2-${name}`;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="text-sm text-ink flex-1">
        {label}
      </label>
      <Stepper
        value={value}
        onChange={(v) => onChange(name, v)}
        ariaLabel={label}
        allowDecimal={allowDecimal}
      />
    </div>
  );
}

function MoneyRow({ label, name, value, onChange }) {
  const id = `dcv2-${name}-money`;
  const v  = floatOrZero(value);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="text-sm text-ink flex-1">
        {label}
      </label>
      <div className="flex h-11 rounded-lg border border-border overflow-hidden bg-surface">
        <span className="flex items-center px-2 text-[11px] font-semibold text-ink-muted bg-surface border-r border-border shrink-0">
          TTD
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={v === 0 ? '' : v}
          placeholder="0.00"
          aria-label={`${label} (TTD)`}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, '');
            onChange(name, cleaned === '' ? 0 : floatOrZero(cleaned));
          }}
          className="w-28 px-2 bg-transparent text-ink text-base text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}

/** Hours stepper row with Half / Full / Long quick-chip buttons. */
function QuickChipRow({ label, name, value, onChange }) {
  const v = floatOrZero(value);
  const CHIPS = [
    { label: 'Half', hours: 4 },
    { label: 'Full', hours: 8 },
    { label: 'Long', hours: 10 },
  ];
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm text-ink flex-1">{label}</span>
        <Stepper
          value={v}
          onChange={(n) => onChange(name, n)}
          ariaLabel={label}
          allowDecimal
        />
      </div>
      <div className="flex gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onChange(name, c.hours)}
            className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors ${
              v === c.hours
                ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark'
                : 'bg-card-raised border-border text-ink-muted hover:border-primary/40 hover:text-primary'
            }`}
            aria-label={`${label} ${c.label} (${c.hours}h)`}
            aria-pressed={v === c.hours}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupCard({ accent, title, filledCount, totalCount, headerRight, children }) {
  const dotClass    = accent === 'gold' ? 'bg-warning' : 'bg-primary';
  const borderClass = accent === 'gold' ? 'border-warning/30' : 'border-primary/20';
  return (
    <div className={`rounded-xl bg-card border ${borderClass} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        {headerRight != null ? (
          headerRight
        ) : (
          <span className="text-xs font-mono text-ink-muted">
            {filledCount}/{totalCount}
          </span>
        )}
      </div>
      <div className="flex flex-col divide-y divide-border/50">{children}</div>
    </div>
  );
}

function CountStrip({ chips, loading }) {
  const items = [
    { label: 'APPR', value: chips.appr },
    { label: 'FFI',  value: chips.ffi },
    { label: 'CI',   value: chips.ci },
    { label: 'APPS', value: chips.apps },
  ];
  return (
    <div
      data-testid="dcv2-count-strip"
      data-loading={loading ? 'true' : 'false'}
      data-chips={`${chips.appr}|${chips.ffi}|${chips.ci}|${chips.apps}`}
      className="grid grid-cols-4 gap-2 mt-2"
      aria-label="Week-to-date counts"
    >
      {items.map((it) => (
        <div
          key={it.label}
          data-testid={`dcv2-chip-${it.label.toLowerCase()}`}
          className="flex flex-col items-center rounded-lg bg-card-raised border border-border/60 px-2 py-1.5"
        >
          <span className="text-lg font-bold text-ink leading-tight">
            {loading ? '–' : it.value}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Week-to-date anchor — WTD production API vs the weekly API target (the
 *  company activity floor, `weeklyActivityFloors.api`, the same source
 *  HistoryTab's award-week logic uses). Four-states: loading → dash; target
 *  always known (code default 4800), so the target line always ships.
 *
 *  Mode-provenance tag SKIPPED: the app stores only `userProfile.loggingMode`,
 *  written solely by the agent's own ProfileScreen — there is no setter-
 *  attribution field, so a "Your choice / Set by your manager" distinction
 *  cannot be derived honestly. (Skip-logged in the 2.10 build notes.) */
function DailyAnchorStrip({ wtdApi, weeklyTarget, loading }) {
  const hasTarget = weeklyTarget > 0;
  const pct = hasTarget ? Math.min(100, Math.round((wtdApi / weeklyTarget) * 100)) : 0;
  const hit = hasTarget && wtdApi >= weeklyTarget;
  return (
    <div
      data-testid="dcv2-anchor-strip"
      data-wtd-api={wtdApi}
      data-target={hasTarget ? weeklyTarget : ''}
      data-pct={hasTarget ? pct : ''}
      className="mt-3 rounded-lg bg-card-raised border border-border/60 px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
          Week to date · API
        </span>
        <span className="text-xs font-semibold text-ink tabular-nums">
          {loading ? '–' : formatCurrency(wtdApi)}
          {!loading && hasTarget && (
            <span className="text-ink-muted font-normal"> / {formatCurrency(weeklyTarget)}</span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border/40 overflow-hidden" aria-hidden="true">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${hit ? 'bg-primary' : 'bg-primary/70'}`}
          style={{ width: `${loading ? 0 : pct}%` }}
        />
      </div>
      {!loading && hasTarget && (
        <p className="text-[10px] text-ink-muted mt-1 text-right">
          {hit ? 'Weekly target cleared' : `${pct}% of weekly target`}
        </p>
      )}
    </div>
  );
}

/** Daily streak-milestone celebration takeover. Owns its count-up hooks so the
 *  shared CelebrationTakeover primitive stays presentational. Only mounts when
 *  a milestone fires (fire-and-forget; the save is already committed). */
function DailyStreakTakeover({ milestone, streak, apiCredit, onClose }) {
  const shownStreak = useCountUp(streak, { duration: 900, decimals: 0 });
  const stats = [{ label: 'DAY STREAK', value: String(shownStreak), highlight: true }];
  if (apiCredit > 0) stats.push({ label: 'TODAY', value: formatCurrency(apiCredit) });
  return (
    <CelebrationTakeover
      open
      onClose={onClose}
      medal="flame"
      accent="warning"
      eyebrow="STREAK MILESTONE"
      title={<>{milestone} days logged<br />in a row</>}
      body={`You logged today and hit a ${milestone}-day streak — consistency is how the week's number gets built.`}
      stats={stats}
      primaryCta={{ label: 'Keep it going', onClick: onClose }}
      confettiColors={['gold', 'warning', 'primary']}
      testId="daily-streak-celebration"
      labelId="daily-streak-celebration-title"
    />
  );
}

/** Horizontal Sun–Sat day selector for back-fill navigation (7 chips; Sunday
 *  renders as an off-chip). */
function WeekStrip({ days, selectedDate, onSelect }) {
  return (
    <div
      data-testid="dcv2-week-strip"
      className="grid grid-cols-7 gap-1 mt-3"
      role="group"
      aria-label="Select day"
    >
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const tappable   = !day.isFuture;
        let chipClass =
          'flex flex-col items-center rounded-lg px-1 py-1.5 text-center border transition-colors ';

        if (isSelected) {
          chipClass += 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark';
        } else if (day.isToday) {
          chipClass += 'bg-card border-primary/60 text-ink ring-1 ring-primary/40';
        } else if (day.isLogged) {
          chipClass += 'bg-card-raised border-border text-ink';
        } else if (day.isOff) {
          chipClass += 'bg-card border-border/40 text-ink-muted opacity-50';
        } else if (day.isFuture) {
          chipClass += 'bg-card border-border/30 text-ink-muted opacity-40';
        } else {
          // missing — past, not logged
          chipClass += 'bg-card border-warning/40 text-ink-muted';
        }

        return (
          <button
            key={day.date}
            type="button"
            disabled={!tappable}
            onClick={() => tappable && onSelect(day.date)}
            aria-pressed={isSelected}
            aria-label={`${day.label} ${day.dayNum}${day.isLogged ? ' — logged' : day.isFuture ? ' — upcoming' : day.isOff ? ' — off' : ' — missing'}`}
            className={`${chipClass} min-h-[44px]`}
            data-testid={`dcv2-strip-day-${day.date}`}
            data-off={day.isOff ? 'true' : 'false'}
          >
            <span className="text-[10px] font-semibold uppercase">{day.label}</span>
            <span className="text-sm font-bold leading-tight">{day.dayNum}</span>
            {day.isLogged && !isSelected && (
              <span className="w-1 h-1 mt-0.5 rounded-full bg-primary dark:bg-primary-dark" aria-hidden="true" />
            )}
            {!day.isLogged && !isSelected && !day.isFuture && !day.isOff && (
              <span className="w-1 h-1 mt-0.5 rounded-full bg-warning" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Sunday "Review day" confirmation view — aggregated read-only summary. */
function SundayConfirmView({ weekDocs, onClose, submitted, onReviewSubmit }) {
  const total = weekDocs.length;
  const apps  = weekDocs.reduce((s, d) => s + intOrZero(d.newBusiness?.apps), 0);
  const api   = weekDocs.reduce((s, d) => s + floatOrZero(d.newBusiness?.api), 0);
  const ffi   = weekDocs.reduce((s, d) => s + intOrZero(d.ffiConducted), 0);
  const ci    = weekDocs.reduce((s, d) => s + intOrZero(d.ciConducted), 0);
  const dials = weekDocs.reduce((s, d) => s + intOrZero(d.dials), 0);

  const rows = [
    { label: 'Days logged', value: total, unit: '/5' },
    { label: 'Dials', value: dials },
    { label: 'FFIs conducted', value: ffi },
    { label: 'CIs conducted', value: ci },
    { label: 'Apps written', value: apps },
    { label: 'API (TTD)', value: formatCurrency(api), raw: true },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 max-w-lg mx-auto w-full">
      <div className="w-full rounded-xl bg-card border border-primary/20 p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Your week from daily logs</h2>
          <span className="ml-auto text-xs text-primary font-semibold">✓ from daily</span>
        </div>
        <div className="flex flex-col divide-y divide-border/50">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2">
              <span className="text-sm text-ink-muted">{r.label}</span>
              <span className="text-sm font-semibold text-ink">
                {r.value}{r.unit ?? ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full rounded-xl bg-card-raised border border-border p-4 text-center">
        {submitted ? (
          <>
            <p className="text-sm text-ink-muted leading-relaxed">
              Your weekly report is <span className="font-semibold text-primary">submitted</span>.
              Nothing more to do this week.
            </p>
            <button
              type="button"
              disabled
              className="mt-3 h-11 px-6 rounded-xl bg-card border border-border text-ink-muted font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-default"
            >
              <Check size={16} aria-hidden="true" />
              Submitted
            </button>
          </>
        ) : onReviewSubmit ? (
          <>
            <p className="text-sm text-ink-muted leading-relaxed">
              Open the <span className="font-semibold text-primary">Weekly Wizard</span> to add ratings,
              next-week targets, and submit your report.
            </p>
            <button
              type="button"
              onClick={onReviewSubmit}
              className="mt-3 h-11 px-6 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm transition-colors hover:bg-primary/90 dark:hover:bg-primary"
            >
              Review &amp; submit
            </button>
          </>
        ) : (
          // Defensive fallback when no deep-link handler is wired (no production
          // caller hits this — AgentDashboard always passes onReviewSubmit): keep
          // the label honest so the CTA never claims "Review" while only closing.
          <>
            <p className="text-sm text-ink-muted leading-relaxed">
              Open the <span className="font-semibold text-primary">Weekly Wizard</span> to add ratings,
              next-week targets, and submit your report.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 h-11 px-6 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm transition-colors hover:bg-primary/90 dark:hover:bg-primary"
            >
              Close &amp; open wizard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DailyCaptureV2({ onClose, onReviewSubmit, seedCounts = null }) {
  const { user, userProfile, tenantId, branchId } = useAuth();
  const agentName  = userProfile?.name ?? userProfile?.email ?? '';
  const today      = useMemo(() => getTodayTT(), []);
  const isTodaySunday = useMemo(() => {
    const d = new Date(today + 'T12:00:00Z');
    return d.getUTCDay() === 0;
  }, [today]);
  // Mon–Sat: the current logging week. Sunday is the review/submit day, so it
  // targets the COMPLETED (prior) week the agent logged — mirroring
  // sundayDailyToWeekly.js::resolveWeekToAggregate (getSundayOf then −7).
  // `getSundayOf(Sunday)` returns that same Sunday (the empty just-starting
  // week), which is why Sunday must subtract a week. (Declared after
  // isTodaySunday — it is now a dependency.)
  const weekStarting = useMemo(() => {
    const currentSunday = getSundayOf(today);
    if (!isTodaySunday) return currentSunday;
    const d = new Date(currentSunday + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 7);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [today, isTodaySunday]);

  // Selected date for back-fill; defaults to today.
  const [selectedDate, setSelectedDate] = useState(today);

  const [data, setData]         = useState(() =>
    createEmptyDailyEntry(today, user?.uid ?? '', agentName)
  );
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savedAt, setSavedAt]   = useState(null);
  const [error, setError]       = useState('');
  // Which action produced `error` — drives what the Retry button re-invokes
  // (§1 states contract: Retry must re-run the SAME failed fetch/action).
  const [errorKind, setErrorKind] = useState(''); // '' | 'load' | 'save'
  const [loadRetryToken, setLoadRetryToken] = useState(0);

  // Collapsible section toggles
  const [pppExpanded,        setPppExpanded]        = useState(false);
  const [socialExpanded,     setSocialExpanded]     = useState(false);
  const [interviewsExpanded, setInterviewsExpanded] = useState(false);
  const [deliveryExpanded,   setDeliveryExpanded]   = useState(false);
  const [reflectionExpanded, setReflectionExpanded] = useState(false);

  // Week-level state (for strip + chips)
  const [weekDocs,      setWeekDocs]      = useState([]);
  const [chipsLoading,  setChipsLoading]  = useState(true);
  const [weeklyFloors,  setWeeklyFloors]  = useState(null);
  const [workingDays,   setWorkingDays]   = useState(5);

  // Streak-milestone celebration (fire-and-forget; set only after a save that
  // crosses a milestone). null = no takeover showing.
  const [celebration,   setCelebration]   = useState(null);

  // ── Load entry for selectedDate whenever it changes ──────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    setErrorKind('');
    setSavedAt(null);
    // Reset to empty for the new date, then overlay with any saved data.
    setData(createEmptyDailyEntry(selectedDate, user.uid, agentName));
    // Collapse optional sections until we know if they have data.
    setPppExpanded(false);
    setSocialExpanded(false);
    setInterviewsExpanded(false);
    setDeliveryExpanded(false);
    setReflectionExpanded(false);

    // Planner handoff seed (item 3.2 screen 9) applies to TODAY only, blank-fill.
    const applySeed = seedCounts && selectedDate === today;

    let active = true;
    getDailyEntry(tenantId, user.uid, selectedDate)
      .then((existing) => {
        if (!active) return;
        if (existing) {
          setData((prev) => blankFillSeed({ ...prev, ...existing }, applySeed ? seedCounts : null));
          if (
            existing.pppIncreases?.apps > 0 ||
            existing.pppIncreases?.apiIncrease > 0 ||
            existing.lumpsums?.grossAmount > 0
          ) setPppExpanded(true);
          if (
            existing.socialPostsTotal > 0 ||
            existing.socialEngagementTotal > 0 ||
            existing.socialInboxEnquiries > 0 ||
            existing.namesFromSocial > 0
          ) setSocialExpanded(true);
          if (
            existing.newCIBooked > 0 ||
            existing.oldCIBooked > 0 ||
            existing.ciConducted > 0 ||
            existing.solutionPresentations > 0
          ) setInterviewsExpanded(true);
          if (
            existing.policiesDelivered > 0 ||
            existing.serviceContacts > 0
          ) setDeliveryExpanded(true);
          if (existing.hoursWorked != null || existing.wins || existing.blockers) {
            setReflectionExpanded(true);
          }
          if (applySeed && (seedCounts.newCIBooked || seedCounts.ciConducted)) setInterviewsExpanded(true);
        } else if (applySeed) {
          // No saved entry yet — blank-fill the empty entry with the seed.
          setData((prev) => blankFillSeed(prev, seedCounts));
          if (seedCounts.ciConducted) setInterviewsExpanded(true);
        }
      })
      .catch((e) => {
        if (!active) return;
        console.error('Failed to load daily entry:', e);
        setError('Could not load entry — your save will overwrite.');
        setErrorKind('load');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.uid, selectedDate, tenantId, agentName, loadRetryToken, seedCounts, today]);

  // ── Week-level read: chips + strip ───────────────────────────────────────
  const refreshWeekDocs = useCallback(async () => {
    if (!user?.uid) return;
    setChipsLoading(true);
    try {
      const docs = await getDailyEntriesForWeek(tenantId, user.uid, weekStarting);
      setWeekDocs(docs);
      return docs;
    } catch (e) {
      console.error('Week docs read failed:', e);
      return null;
    } finally {
      setChipsLoading(false);
    }
  }, [tenantId, user?.uid, weekStarting]);

  useEffect(() => { refreshWeekDocs(); }, [refreshWeekDocs]);

  // ── Load per-tenant activity floors + working days once (fallback to code defaults) ──
  useEffect(() => {
    if (!tenantId) return;
    setWeeklyFloors(null); // reset so prior tenant's floors never show on switch
    setWorkingDays(5);
    let active = true;
    getCompanyMinimums(tenantId)
      .then((mins) => {
        if (!active) return;
        setWeeklyFloors(mins.weeklyActivityFloors);
        const wd = Number(mins.workingDaysPerWeek);
        setWorkingDays([5, 6].includes(wd) ? wd : 5);
      })
      .catch(() => { /* silently use code defaults */ });
    return () => { active = false; };
  }, [tenantId]);

  // ── Sunday-only: is this week's weekly report already submitted? ──────────
  // Drives the SundayConfirmView CTA (deep-link "Review & submit" vs disabled
  // "Submitted"). Keyed on DCv2's own TT-anchored weekStarting so the status
  // always matches the week the agent is reviewing. Only reads on Sunday.
  const [weeklySubmitted, setWeeklySubmitted] = useState(false);
  useEffect(() => {
    // Reset first so a uid/tenant/week change can't surface the prior week's
    // status while the new getDraft resolves (Gemini #1).
    setWeeklySubmitted(false);
    if (!isTodaySunday || !tenantId || !user?.uid) return;
    let active = true;
    getDraft(tenantId, user.uid, weekStarting)
      .then((draft) => { if (active) setWeeklySubmitted(draft?.status === 'submitted'); })
      .catch(() => { if (active) setWeeklySubmitted(false); });
    return () => { active = false; };
  }, [isTodaySunday, tenantId, user?.uid, weekStarting]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const chips     = useMemo(() => deriveCountStripChips(weekDocs), [weekDocs]);
  const stripDays = useMemo(() => deriveWeekStripDays(weekDocs, today, weekStarting, workingDays), [weekDocs, today, weekStarting, workingDays]);
  const streak    = useMemo(() => computeStreak(weekDocs, today), [weekDocs, today]);
  // WTD anchor: sum of saved daily API vs the weekly API target (company floor,
  // same source HistoryTab uses). Code default (4800) applies until floors load.
  const wtdApi         = useMemo(() => sumWeekApi(weekDocs), [weekDocs]);
  const weeklyApiTarget = useMemo(
    () => Number(weeklyFloors?.api ?? DEFAULT_WEEKLY_ACTIVITY_FLOORS.api) || 0,
    [weeklyFloors],
  );
  const dayPoints        = useMemo(() => computeDayPoints(data), [data]);
  const weekPoints       = useMemo(
    () => computeWeekToDatePoints(weekDocs, selectedDate, data),
    [weekDocs, selectedDate, data],
  );
  const weeklyPointsFloor = useMemo(
    () => mapFloorToPoints(weeklyFloors ?? DEFAULT_WEEKLY_ACTIVITY_FLOORS),
    [weeklyFloors],
  );
  const elapsedDays      = useMemo(() => elapsedWorkingDays(today, weekStarting, workingDays), [today, weekStarting, workingDays]);
  const weekToDateTarget = useMemo(
    () => weeklyPointsFloor * (elapsedDays / workingDays),
    [weeklyPointsFloor, elapsedDays, workingDays],
  );
  const paceState        = useMemo(
    () => computePaceState(weekPoints, weekToDateTarget),
    [weekPoints, weekToDateTarget],
  );

  // Production credit (header slot in Production card).
  const lmpsGross      = floatOrZero(data.lumpsums?.grossAmount);
  const lmpsCredit     = computeLumpsumCredit(lmpsGross);
  const lmpsCommission = computeLumpsumCommission(lmpsGross);
  const dayProductionCredit = computeTotalProductionCredit({
    newBusiness:  data.newBusiness ?? {},
    pppIncreases: data.pppIncreases ?? {},
    lumpsums:     { ...(data.lumpsums ?? {}), apiCredit: lmpsCredit },
  });
  const pppApps       = intOrZero(data.pppIncreases?.apps);
  const pppInc        = floatOrZero(data.pppIncreases?.apiIncrease);
  const pppAvgPerApp  = pppApps > 0 ? pppInc / pppApps : null;
  const pppWarn       = pppInc > 0 && pppAvgPerApp != null && !validatePppIncrease(pppAvgPerApp);

  // Filled-field counters for GroupCard badges.
  const prospectingFilled =
    (intOrZero(data.prospectingLettersSent) > 0 ? 1 : 0) +
    (intOrZero(data.seminarsConducted) > 0 ? 1 : 0) +
    (intOrZero(data.dials) > 0 ? 1 : 0) +
    (intOrZero(data.telContacts) > 0 ? 1 : 0) +
    (intOrZero(data.f2fAttempts) > 0 ? 1 : 0) +
    (intOrZero(data.qualifiedApproaches) > 0 ? 1 : 0) +
    (intOrZero(data.newNamesAdded) > 0 ? 1 : 0) +
    (intOrZero(data.oldNamesWorked) > 0 ? 1 : 0);
  const apptsFilled =
    (intOrZero(data.appointmentsSet) > 0 ? 1 : 0) +
    (intOrZero(data.ffisScheduled) > 0 ? 1 : 0) +
    (intOrZero(data.ffiConducted) > 0 ? 1 : 0);
  const interviewsFilled =
    (intOrZero(data.newCIBooked) > 0 ? 1 : 0) +
    (intOrZero(data.oldCIBooked) > 0 ? 1 : 0) +
    (intOrZero(data.ciConducted) > 0 ? 1 : 0) +
    (intOrZero(data.solutionPresentations) > 0 ? 1 : 0);

  // ── Field setters ─────────────────────────────────────────────────────────
  const handleChange = (name, value) =>
    setData((prev) => ({ ...prev, [name]: value }));

  const nbChange  = (field, value) =>
    setData((prev) => ({ ...prev, newBusiness: { ...prev.newBusiness, [field]: value } }));
  const pppChange = (field, value) =>
    setData((prev) => ({ ...prev, pppIncreases: { ...prev.pppIncreases, [field]: value } }));
  const lmpsChange = (field, value) =>
    setData((prev) => ({ ...prev, lumpsums: { ...prev.lumpsums, [field]: value } }));
  const spbChange  = (field, value) =>
    setData((prev) => ({
      ...prev,
      socialPlatformBreakdown: { ...prev.socialPlatformBreakdown, [field]: value },
    }));

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setError('');
    setErrorKind('');
    try {
      // Daily doc MUST persist first (Decision #4).
      await saveDailyEntry(tenantId, user.uid, agentName, selectedDate, data);
      setSavedAt(new Date());
      const postSaveDocs = await refreshWeekDocs();
      // Best-effort: recompute the current week's weekly DRAFT from the daily
      // entries so the Sunday review + #687 deep-link wizard are pre-filled
      // before the Sunday 23:00 cron. aggregateCurrentWeekDaily merges (rollup
      // has no ratings/targets keys) so manual draft fields are preserved, and
      // keys on getMostRecentSunday — which is the correct current week on the
      // Mon–Sat save path (saves never happen on Sunday; the form is hidden).
      // Failure-isolated (Decision #4): a thrown aggregation must NOT fail the
      // log — swallow, don't propagate.
      try {
        await aggregateCurrentWeekDaily(
          tenantId,
          user.uid,
          agentName,
          userProfile?.commissionRate ?? 0,
          userProfile?.unitId ?? null,
          branchId ?? null,
        );
      } catch (aggErr) {
        console.error('Weekly-draft aggregation after save failed (daily log saved):', aggErr);
      }

      // Fire-and-forget streak celebration — the save is already committed, so
      // any failure here must never surface as a save failure. Evaluate against
      // the authoritative post-save week docs (includes the day just written).
      let celebrating = false;
      try {
        const newStreak = computeStreak(postSaveDocs ?? weekDocs, today);
        const celebratedMax = getDailyStreakCelebratedMax(user.uid);
        const { milestone, nextCelebratedMax } = resolveStreakCelebration({
          streak: newStreak,
          celebratedMax,
        });
        // Keep the persisted marker in sync (run-reset clamp) regardless of fire.
        setDailyStreakCelebratedMax(user.uid, nextCelebratedMax);
        if (milestone) {
          celebrating = true;
          setCelebration({ milestone, streak: newStreak, apiCredit: dayProductionCredit });
        }
      } catch (celErr) {
        console.error('Streak celebration evaluation failed (daily log saved):', celErr);
      }

      // Only auto-close when not celebrating — the takeover owns dismissal.
      if (!celebrating) setTimeout(() => onClose?.(), 600);
    } catch (e) {
      console.error('Save failed:', e);
      setError('Save failed — check your connection and try again.');
      setErrorKind('save');
    } finally {
      setSaving(false);
    }
  };

  // Retry re-invokes whichever action actually failed — the load effect (via
  // a token bump) or the save handler — never a generic "reload the world".
  const handleRetryError = () => {
    if (errorKind === 'load') {
      setLoadRetryToken((t) => t + 1);
    } else if (errorKind === 'save') {
      handleSave();
    }
  };

  // ── Header label ──────────────────────────────────────────────────────────
  const isBackfill = selectedDate !== today;

  const titleText = isTodaySunday
    ? 'Review week'
    : isBackfill
    ? `Back-fill — ${formatDateShort(selectedDate)}`
    : 'Log Today';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-bg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dcv2-title"
      data-testid="daily-capture-v2"
    >
      {/* ── Sticky header ── */}
      <header className="px-4 pt-4 pb-3 bg-bg shrink-0 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 id="dcv2-title" className="text-lg font-bold text-ink leading-tight">
                {titleText}
              </h1>
              {/* Mode pill */}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                Daily
              </span>
              {/* Streak flame */}
              {streak > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-warning-ink"
                  aria-label={`${streak}-day streak`}
                >
                  <Flame size={13} aria-hidden="true" />
                  {streak}
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-ink-muted mt-0.5">
              {weekdayLong(today)} · WK {weekNumber(today)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 -mt-2 -mr-2 flex items-center justify-center rounded-full hover:bg-surface text-ink-muted transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Week strip — not shown when today is Sunday (no back-fill into the weekly report's day) */}
        {!isTodaySunday && (
          <WeekStrip
            days={stripDays}
            selectedDate={selectedDate}
            onSelect={(date) => setSelectedDate(date)}
          />
        )}

        {/* WTD anchor — API vs weekly target (weekday form only) */}
        {!isTodaySunday && (
          <DailyAnchorStrip
            wtdApi={wtdApi}
            weeklyTarget={weeklyApiTarget}
            loading={chipsLoading}
          />
        )}

        {/* WTD count chips */}
        <CountStrip chips={chips} loading={chipsLoading} />
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-4 max-w-lg mx-auto">
            <PanelSkeleton
              variant="list"
              count={4}
              label={isBackfill ? 'Loading entry…' : 'Loading today’s entry…'}
            />
          </div>
        ) : isTodaySunday ? (
          chipsLoading ? (
            <div className="px-4 py-4 max-w-lg mx-auto">
              <PanelSkeleton variant="list" count={3} label="Loading weekly summary…" />
            </div>
          ) : (
            <SundayConfirmView
              weekDocs={weekDocs}
              onClose={onClose}
              submitted={weeklySubmitted}
              // Pass the reviewed (completed) week's real daily-aggregation hint
              // so the wizard's resolvePath gates on actual days logged — fast
              // path (→ Confirm) when this week has daily entries, full otherwise.
              onReviewSubmit={onReviewSubmit ? () => onReviewSubmit(weekStarting, {
                aggregatedFromDaily: weekDocs.length > 0,
                daysWorked: weekDocs.length,
              }) : undefined}
            />
          )
        ) : (
          <div className="px-4 py-4 max-w-lg mx-auto flex flex-col gap-4">
            {/* Back-fill banner */}
            {isBackfill && (
              <div
                className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning-ink font-medium"
                role="status"
              >
                Back-filling {formatDateShort(selectedDate)} — save will write to that date.
              </div>
            )}

            {/* ── Prospecting & outreach ── */}
            <GroupCard
              accent="teal"
              title="Prospecting &amp; outreach"
              filledCount={prospectingFilled}
              totalCount={8}
            >
              <StepperRow label="Prospecting letters sent"  name="prospectingLettersSent" value={data.prospectingLettersSent} onChange={handleChange} />
              <StepperRow label="Seminars conducted"        name="seminarsConducted"       value={data.seminarsConducted}      onChange={handleChange} />
              <StepperRow label="Dials (total calls)"       name="dials"                   value={data.dials}                  onChange={handleChange} />
              <StepperRow label="Tel contacts (reached)"    name="telContacts"             value={data.telContacts}            onChange={handleChange} />
              <StepperRow label="F2F attempts"              name="f2fAttempts"             value={data.f2fAttempts}            onChange={handleChange} />
              <StepperRow label="Qualified approaches"      name="qualifiedApproaches"     value={data.qualifiedApproaches}    onChange={handleChange} />
              <StepperRow label="New names added"           name="newNamesAdded"           value={data.newNamesAdded}          onChange={handleChange} />
              <StepperRow label="Old names worked"          name="oldNamesWorked"          value={data.oldNamesWorked}         onChange={handleChange} />

              {/* Social — collapsible sub-section */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setSocialExpanded((v) => !v)}
                  className="w-full min-h-[44px] flex items-center justify-between gap-2 text-sm font-semibold text-ink-muted hover:text-primary transition-colors"
                  aria-expanded={socialExpanded}
                  aria-controls="dcv2-social-body"
                >
                  <span>Social activity — optional</span>
                  <span aria-hidden="true">{socialExpanded ? '▴' : '▾'}</span>
                </button>
                {socialExpanded && (
                  <div id="dcv2-social-body" className="flex flex-col divide-y divide-border/50 mt-2">
                    <StepperRow label="Posts / content published"  name="socialPostsTotal"       value={data.socialPostsTotal}       onChange={handleChange} />
                    <StepperRow label="Engagement total"           name="socialEngagementTotal"  value={data.socialEngagementTotal}  onChange={handleChange} />
                    <StepperRow label="Inbox enquiries"            name="socialInboxEnquiries"   value={data.socialInboxEnquiries}   onChange={handleChange} />
                    <StepperRow label="Names from social"          name="namesFromSocial"        value={data.namesFromSocial}        onChange={handleChange} />
                    {/* Platform breakdown */}
                    <div className="pt-2 pb-1">
                      <p className="text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wider">Platform breakdown</p>
                      <div className="flex flex-col divide-y divide-border/40">
                        <StepperRow label="Facebook"  name="facebook"  value={data.socialPlatformBreakdown?.facebook  ?? 0} onChange={spbChange} />
                        <StepperRow label="Instagram" name="instagram" value={data.socialPlatformBreakdown?.instagram ?? 0} onChange={spbChange} />
                        <StepperRow label="WhatsApp"  name="whatsapp"  value={data.socialPlatformBreakdown?.whatsapp  ?? 0} onChange={spbChange} />
                        <StepperRow label="LinkedIn"  name="linkedin"  value={data.socialPlatformBreakdown?.linkedin  ?? 0} onChange={spbChange} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </GroupCard>

            {/* ── Appointments & FFI ── */}
            <GroupCard
              accent="teal"
              title="Appointments &amp; FFI"
              filledCount={apptsFilled}
              totalCount={3}
            >
              <StepperRow label="Appointments set" name="appointmentsSet" value={data.appointmentsSet} onChange={handleChange} />
              <StepperRow label="FFIs scheduled"   name="ffisScheduled"   value={data.ffisScheduled}   onChange={handleChange} />
              <StepperRow label="FFIs conducted"   name="ffiConducted"    value={data.ffiConducted}    onChange={handleChange} />
            </GroupCard>

            {/* ── Interviews — collapsible ── */}
            <div className="rounded-xl bg-card border border-warning/30 p-4">
              <button
                type="button"
                onClick={() => setInterviewsExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-3 min-h-[44px]"
                aria-expanded={interviewsExpanded}
                aria-controls="dcv2-interviews-body"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-warning" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink">Interviews</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-ink-muted">
                    {interviewsFilled}/{4}
                  </span>
                  <span aria-hidden="true" className="text-ink-muted text-xs">
                    {interviewsExpanded ? '▴' : '▾'}
                  </span>
                </div>
              </button>
              {interviewsExpanded && (
                <div
                  id="dcv2-interviews-body"
                  className="flex flex-col divide-y divide-border/50 mt-2"
                >
                  <StepperRow label="New CIs booked"        name="newCIBooked"          value={data.newCIBooked}          onChange={handleChange} />
                  <StepperRow label="Old CIs booked"        name="oldCIBooked"          value={data.oldCIBooked}          onChange={handleChange} />
                  <StepperRow label="CIs conducted"         name="ciConducted"          value={data.ciConducted}          onChange={handleChange} />
                  <StepperRow label="Solution presentations" name="solutionPresentations" value={data.solutionPresentations} onChange={handleChange} />
                </div>
              )}
            </div>

            {/* ── Production ── */}
            <GroupCard
              accent="gold"
              title="Production"
              headerRight={
                dayProductionCredit > 0 ? (
                  <span
                    data-testid="dcv2-day-credit"
                    className="text-xs font-semibold text-warning-ink"
                  >
                    {formatCurrency(dayProductionCredit)} credit
                  </span>
                ) : (
                  <span className="text-xs font-mono text-ink-muted">—</span>
                )
              }
            >
              <StepperRow label="New business — apps" name="apps" value={data.newBusiness?.apps ?? 0} onChange={nbChange} />
              <StepperRow label="Lives sold"           name="livesSold" value={data.livesSold} onChange={handleChange} />
              <MoneyRow   label="New business — API"  name="api"  value={data.newBusiness?.api  ?? 0} onChange={nbChange} />

              {/* PPP / Lumpsums optional disclosure */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setPppExpanded((v) => !v)}
                  className="w-full min-h-[44px] flex items-center justify-between gap-2 text-sm font-semibold text-ink-muted hover:text-primary transition-colors"
                  aria-expanded={pppExpanded}
                  aria-controls="dcv2-ppp-body"
                >
                  <span>PPP increases &amp; lumpsums — optional</span>
                  <span aria-hidden="true">{pppExpanded ? '▴' : '▾'}</span>
                </button>
                {pppExpanded && (
                  <div id="dcv2-ppp-body" className="flex flex-col divide-y divide-border/50 mt-2">
                    <StepperRow label="PPP increases — apps" name="apps"        value={data.pppIncreases?.apps ?? 0}        onChange={pppChange} />
                    <MoneyRow   label="PPP — API increase"   name="apiIncrease" value={data.pppIncreases?.apiIncrease ?? 0} onChange={pppChange} />
                    <MoneyRow   label="Lumpsum — gross"      name="grossAmount" value={data.lumpsums?.grossAmount ?? 0}     onChange={lmpsChange} />
                    {pppWarn && (
                      <p className="text-xs text-warning-ink font-medium py-2" role="status">
                        Average {formatCurrency(Math.round(pppAvgPerApp))} per app is below the {formatCurrency(MIN_PPP_INCREASE)} minimum.
                      </p>
                    )}
                    {lmpsGross > 0 && (
                      <div className="pt-2 pb-1 flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-muted">Lumpsum API credit (10%)</span>
                          <span className="font-semibold text-primary">{formatCurrency(lmpsCredit)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-muted">Lumpsum commission (0.5%)</span>
                          <span className="font-semibold text-primary">{formatCurrency(lmpsCommission)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </GroupCard>

            {/* ── Delivery &amp; service — collapsible ── */}
            <div className="rounded-xl bg-card border border-border/60 p-4">
              <button
                type="button"
                onClick={() => setDeliveryExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-3 min-h-[44px]"
                aria-expanded={deliveryExpanded}
                aria-controls="dcv2-delivery-body"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink">Delivery &amp; service</span>
                </div>
                <span aria-hidden="true" className="text-ink-muted text-xs">
                  {deliveryExpanded ? '▴' : '▾'}
                </span>
              </button>
              {deliveryExpanded && (
                <div
                  id="dcv2-delivery-body"
                  className="flex flex-col divide-y divide-border/50 mt-2"
                >
                  <StepperRow label="Policies delivered" name="policiesDelivered" value={data.policiesDelivered} onChange={handleChange} />
                  <StepperRow label="Service contacts"   name="serviceContacts"   value={data.serviceContacts}   onChange={handleChange} />
                </div>
              )}
            </div>

            {/* ── Hours ── */}
            <div className="rounded-xl bg-card border border-border/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">Hours</h2>
              </div>
              <div className="flex flex-col divide-y divide-border/50">
                <QuickChipRow label="Office hours" name="officeHours" value={data.officeHours} onChange={handleChange} />
                <QuickChipRow label="Field hours"  name="fieldHours"  value={data.fieldHours}  onChange={handleChange} />
              </div>
            </div>

            {/* ── Reflection (optional) ── */}
            <div className="rounded-xl bg-card border border-border/60 p-4">
              <button
                type="button"
                onClick={() => setReflectionExpanded((v) => !v)}
                className="w-full min-h-[44px] flex items-center justify-between gap-2 text-sm font-semibold text-ink-muted hover:text-primary transition-colors"
                aria-expanded={reflectionExpanded}
                aria-controls="dcv2-reflection-body"
              >
                <span>Reflection — optional</span>
                <span aria-hidden="true">{reflectionExpanded ? '▴' : '▾'}</span>
              </button>
              {reflectionExpanded && (
                <div
                  id="dcv2-reflection-body"
                  className="flex flex-col gap-3 mt-3 pb-3 border-b border-border/50"
                >
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Optional journal — captured per day, not propagated to the weekly report.
                  </p>
                  <StepperRow
                    label="Hours worked (total)"
                    name="hoursWorked"
                    value={data.hoursWorked ?? 0}
                    onChange={(_n, v) => handleChange('hoursWorked', v === 0 ? null : v)}
                    allowDecimal
                  />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="dcv2-wins" className="text-sm font-medium text-ink">Wins</label>
                    <textarea
                      id="dcv2-wins"
                      rows={2}
                      value={data.wins}
                      onChange={(e) => handleChange('wins', e.target.value)}
                      placeholder="What went well today…"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="dcv2-blockers" className="text-sm font-medium text-ink">Blockers</label>
                    <textarea
                      id="dcv2-blockers"
                      rows={2}
                      value={data.blockers}
                      onChange={(e) => handleChange('blockers', e.target.value)}
                      placeholder="What got in the way…"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1 pt-3">
                <label htmlFor="dcv2-note" className="text-sm font-medium text-ink">
                  Note — optional
                </label>
                <textarea
                  id="dcv2-note"
                  rows={3}
                  value={data.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Anything else to remember…"
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-danger-ink flex-1">{error}</p>
                <button
                  type="button"
                  onClick={handleRetryError}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Sticky save footer — not shown in Sunday confirm view ── */}
      {!isTodaySunday && (
        <footer className="px-4 py-4 border-t border-border bg-card shrink-0">
          {/* Points pill + pace badge */}
          {!loading && (dayPoints > 0 || (!chipsLoading && elapsedDays > 0 && weeklyPointsFloor > 0)) && (
            <div
              data-testid="dcv2-points-pill"
              className="flex items-center justify-center gap-1.5 mb-3 flex-wrap"
              aria-live="polite"
            >
              {dayPoints > 0 && (
                <>
                  <span className="text-2xl font-bold text-primary tabular-nums">{dayPoints}</span>
                  <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">pts today</span>
                </>
              )}
              {!chipsLoading && elapsedDays > 0 && weeklyPointsFloor > 0 && (
                <span
                  data-testid="dcv2-pace-badge"
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PACE_BADGE_CLASSES[paceState]}`}
                  aria-label={`Pace: ${PACE_LABELS[paceState]}`}
                >
                  {PACE_LABELS[paceState]}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !!savedAt}
            data-testid="dcv2-save"
            className="w-full h-12 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-base hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Saving…
              </>
            ) : savedAt ? (
              <>
                <Check size={18} /> Saved
              </>
            ) : isBackfill ? (
              <>
                Save back-fill
                <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">
                  · {formatDateShort(selectedDate)}
                </span>
              </>
            ) : (
              <>
                Save today
                <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">
                  · Rolls into WK {weekNumber(today)}
                </span>
              </>
            )}
          </button>
        </footer>
      )}

      {/* Streak-milestone celebration takeover (layers over the entry) */}
      {celebration && (
        <DailyStreakTakeover
          milestone={celebration.milestone}
          streak={celebration.streak}
          apiCredit={celebration.apiCredit}
          onClose={() => { setCelebration(null); onClose?.(); }}
        />
      )}
    </div>
  );
}
