import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { X, ChevronLeft, ChevronRight, AlertTriangle, BarChart2, Search } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { formatDateLabel } from '../../utils/validators';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

function AgentAvatar({ photoURL, name, size = 40 }) {
  const initials = (name ?? 'A')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return photoURL ? (
    <img
      src={photoURL}
      alt={name}
      style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0,
      }}
    />
  ) : (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--color-primary)', color: '#fff',
        fontSize: size * 0.36, fontWeight: 700,
        border: '2px solid rgba(255,255,255,0.2)',
      }}
    >
      {initials}
    </div>
  );
}
import {
  extractFields,
  computeRatios,
  RATIO_KEY_ORDER,
  RATIO_LABELS,
  ratioColorClass,
  formatRatioValue,
} from '../../utils/extractFields';

function resolveName(sub) {
  if (sub.agentName)   return sub.agentName;
  if (sub.displayName) return sub.displayName;
  if (sub.userName)    return sub.userName;
  const uid = sub.agentId ?? sub.userId ?? '';
  return uid ? `Agent ${uid.slice(-6)}` : 'Unknown';
}

function StatusBadge({ status }) {
  const cls = status === 'submitted'
    ? 'bg-success/25 text-success'
    : 'bg-warning/25 text-warning';
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${cls}`}>
      {status === 'submitted' ? 'Submitted' : 'Draft'}
    </span>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl p-4 bg-white/5">
      <p className="text-[0.68rem] uppercase tracking-widest text-white/70 text-center">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-[#4ab5b8]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function RatioCard({ ratioKey, value }) {
  const info = RATIO_LABELS[ratioKey];
  return (
    <div className="rounded-xl p-3 bg-white/5 flex flex-col gap-1">
      <p className="text-[0.62rem] uppercase tracking-widest text-white/65">{info.label}</p>
      <p className={`text-xl font-bold ${ratioColorClass(ratioKey, value)}`}>
        {formatRatioValue(ratioKey, value)}
      </p>
      <p className="text-[0.58rem] text-white/60 leading-tight">{info.desc}</p>
    </div>
  );
}

function RatingBar({ label, value }) {
  const pct = value > 0 ? (value / 10) * 100 : 0;
  const barCls = value >= 7 ? 'bg-success' : value >= 4 ? 'bg-warning' : value > 0 ? 'bg-danger' : 'bg-white/20';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <p className="text-xs text-white/70">{label}</p>
        <p className="text-sm font-semibold text-white">{value > 0 ? `${value}/10` : '—'}</p>
      </div>
      <div className="h-1.5 rounded-full bg-white/10">
        <div className={`h-1.5 rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MeetingMode({ submissions, selectedWeek, onClose }) {
  const { tenantId } = useAuth();
  const [slide, setSlide]       = useState(0);
  const [mode, setMode]         = useState('group'); // 'group' | 'one-on-1'
  const [photoMap, setPhotoMap] = useState({});

  useEffect(() => {
    if (!tenantId) return;
    getDocs(collection(db, `tenants/${tenantId}/users`))
      .then((snap) => {
        const map = {};
        snap.forEach((d) => {
          const data = d.data();
          if (data.provisioning === true) return;
          if (data.photoURL) map[d.id] = data.photoURL;
        });
        setPhotoMap(map);
      })
      .catch(() => {});
  }, [tenantId]);

  const agentSlides = useMemo(() => {
    return [...submissions]
      .sort((a, b) => resolveName(a).localeCompare(resolveName(b)))
      .map((sub) => {
        const f = extractFields(sub);
        const ratios = computeRatios(f);
        return {
          name:                  resolveName(sub),
          agentId:               sub.agentId ?? sub.userId ?? '',
          status:                sub.status ?? 'draft',
          prospectingTouches:    f.prospectingTouches,
          totalTelAttempts:      f.totalTelAttempts,
          f2fAttempts:           f.f2fAttempts,
          qualifiedApproaches:   f.qualifiedApproaches,
          ffiConducted:          f.ffiConducted,
          solutionPresentations: f.solutionPresentations,
          ciConducted:           f.ciConducted,
          applicationsSold:      f.applicationsSold,
          livesSold:             f.livesSold,
          apiSold:               f.apiSold,
          ratios,
          planningEffectiveness: f.planningEffectiveness,
          timeManagement:        f.timeManagement,
          salesPerformance:      f.salesPerformance,
          prospectingEffort:     f.prospectingEffort,
          overallRating:         f.overallRating,
          evaluationNotes:       f.evaluationNotes,
        };
      });
  }, [submissions]);

  const unitAvgs = useMemo(() => {
    const keys = ['prospectingTouches', 'totalTelAttempts', 'f2fAttempts', 'qualifiedApproaches', 'ffiConducted', 'applicationsSold', 'apiSold'];
    const avgs = {};
    keys.forEach((k) => {
      const vals = agentSlides.map((s) => s[k]).filter((v) => typeof v === 'number');
      avgs[k] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    return avgs;
  }, [agentSlides]);

  const totalSlides = agentSlides.length + 2; // summary + agents + closing
  const isFirst = slide === 0;
  const isLast  = slide === totalSlides - 1;

  const totalAPI = useMemo(
    () => agentSlides.reduce((s, a) => s + a.apiSold, 0),
    [agentSlides]
  );
  const totalApps = useMemo(
    () => agentSlides.reduce((s, a) => s + a.applicationsSold, 0),
    [agentSlides]
  );
  const avgClosing = useMemo(() => {
    const vals = agentSlides.map((a) => a.ratios.closingRatio).filter((v) => v !== null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [agentSlides]);
  const submittedCount = useMemo(
    () => agentSlides.filter((a) => a.status === 'submitted').length,
    [agentSlides]
  );

  const go = useCallback(
    (dir) => setSlide((s) => Math.min(Math.max(s + dir, 0), totalSlides - 1)),
    [totalSlides]
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, onClose]);

  const isOutlier = useCallback(
    (agent) => {
      const keys = ['prospectingTouches', 'totalTelAttempts', 'f2fAttempts', 'qualifiedApproaches', 'ffiConducted', 'applicationsSold', 'apiSold'];
      return keys.some((k) => unitAvgs[k] > 0 && agent[k] > unitAvgs[k] * 3);
    },
    [unitAvgs]
  );

  const agentStats = (agent) => [
    { label: 'Prospect. Touches', value: agent.prospectingTouches },
    { label: 'Tel Attempts',      value: agent.totalTelAttempts },
    { label: 'F2F Attempts',      value: agent.f2fAttempts },
    { label: 'Qual. Approaches',  value: agent.qualifiedApproaches },
    { label: 'FFI Conducted',     value: agent.ffiConducted },
    { label: 'Solutions',         value: agent.solutionPresentations },
    { label: 'Total CI',          value: agent.ciConducted },
    { label: 'Apps Sold',         value: agent.applicationsSold },
    { label: 'API (TTD)',         value: formatCurrency(agent.apiSold), accent: true },
  ];

  const ratingBars = (agent) => [
    { label: 'Planning',     value: agent.planningEffectiveness },
    { label: 'Time Mgmt',    value: agent.timeManagement },
    { label: 'Sales Perf.',  value: agent.salesPerformance },
    { label: 'Prospecting',  value: agent.prospectingEffort },
    { label: 'Overall',      value: agent.overallRating },
  ];

  const renderSlide = () => {
    // Summary slide
    if (slide === 0) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-10 px-8 text-center">
          <h2 className="text-2xl font-semibold text-[#4ab5b8]">
            Week of {formatDateLabel(selectedWeek)}
          </h2>
          <div className="grid grid-cols-2 gap-10 w-full max-w-2xl">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-white/70">Total API</p>
              <p className="text-5xl font-bold text-[#4ab5b8]">{formatCurrency(totalAPI)}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-white/70">Apps Sold</p>
              <p className="text-5xl font-bold text-white">{totalApps}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-white/70">Avg Closing</p>
              <p className="text-5xl font-bold text-white">
                {avgClosing !== null ? `${avgClosing}%` : '—'}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-white/70">Submissions</p>
              <p className="text-5xl font-bold text-white">
                {submittedCount}/{agentSlides.length}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Closing slide
    if (isLast) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-8">
          <p className="text-xs uppercase tracking-widest text-[#4ab5b8]">Meeting Complete</p>
          <p className="text-4xl font-bold text-white">
            {agentSlides.length} agent{agentSlides.length !== 1 ? 's' : ''} reviewed
          </p>
          <p className="text-white/70">Week of {formatDateLabel(selectedWeek)}</p>
        </div>
      );
    }

    // Agent slide
    const agent = agentSlides[slide - 1];

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 px-8 py-4 w-full max-w-3xl mx-auto">

          {/* Agent header */}
          <div className="flex flex-col items-center gap-2 text-center">
            {mode === 'group' ? (
              <>
                <AgentAvatar photoURL={photoMap[agent.agentId]} name={agent.name} size={40} />
                <h2 className="text-4xl font-display font-bold text-white leading-tight">
                  {agent.name}
                </h2>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <AgentAvatar photoURL={photoMap[agent.agentId]} name={agent.name} size={56} />
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-display font-bold text-white leading-tight">
                    {agent.name}
                  </h2>
                  {isOutlier(agent) && (
                    <AlertTriangle
                      size={22}
                      className="text-warning shrink-0"
                      title="One or more stats significantly above team average"
                    />
                  )}
                </div>
              </div>
            )}
            <p className="text-sm text-white/70">Week ending {formatDateLabel(selectedWeek)}</p>
            <StatusBadge status={agent.status} />
          </div>

          {/* 3×3 stat grid */}
          <div className="grid grid-cols-3 gap-3">
            {agentStats(agent).map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
            ))}
          </div>

          {/* Closing ratio */}
          {agent.ratios.closingRatio !== null && (
            <div className="flex justify-center">
              <span className="inline-flex px-4 py-1.5 rounded-full text-sm font-semibold bg-primary/25 text-[#4ab5b8]">
                {agent.ratios.closingRatio}% closing ratio
              </span>
            </div>
          )}

          {/* ONE-ON-ONE — Coaching Ratios */}
          {mode === 'one-on-1' && (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/65 mb-3">Coaching Ratios</p>
                <div className="grid grid-cols-4 gap-2">
                  {RATIO_KEY_ORDER.map((key) => (
                    <RatioCard key={key} ratioKey={key} value={agent.ratios[key]} />
                  ))}
                </div>
              </div>

              {/* ONE-ON-ONE — Self-Evaluation */}
              <div>
                <p className="text-xs uppercase tracking-widest text-white/65 mb-3">Self-Evaluation</p>
                <div className="flex flex-col gap-3 rounded-xl bg-white/5 p-4">
                  {ratingBars(agent).map((r) => (
                    <RatingBar key={r.label} label={r.label} value={r.value} />
                  ))}
                </div>
                {agent.evaluationNotes && (
                  <p className="mt-3 text-sm text-white/70 italic leading-relaxed">
                    "{agent.evaluationNotes}"
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">

      {/* Top bar — 3-col grid */}
      <header className="grid grid-cols-3 items-center px-6 py-4 shrink-0">
        <p className="text-sm text-white/65">{slide + 1} / {totalSlides}</p>

        {/* Mode toggle */}
        <div className="flex justify-center">
          <div className="flex rounded-full bg-white/10 p-0.5">
            <button
              onClick={() => setMode('group')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                mode === 'group' ? 'bg-primary text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              <BarChart2 size={14} className="inline mr-1" /> Group
            </button>
            <button
              onClick={() => setMode('one-on-1')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                mode === 'one-on-1' ? 'bg-primary text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              <Search size={14} className="inline mr-1" /> 1-on-1
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full text-white/60 hover:text-white transition-colors"
            aria-label="Exit meeting mode"
          >
            <X size={22} />
          </button>
        </div>
      </header>

      {/* Slide content */}
      <main className="flex flex-1 overflow-hidden">
        {renderSlide()}
      </main>

      {/* Navigation */}
      <footer className="flex items-center justify-between px-6 py-5 shrink-0">
        <button
          onClick={() => go(-1)}
          disabled={isFirst}
          className="w-14 h-14 flex items-center justify-center rounded-full border border-white/30 bg-white/5 text-white hover:bg-white/10 transition-colors disabled:opacity-20"
          aria-label="Previous slide"
        >
          <ChevronLeft size={28} />
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1.5 items-center">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all ${
                i === slide ? 'w-5 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          disabled={isLast}
          className="w-14 h-14 flex items-center justify-center rounded-full border border-white/30 bg-white/5 text-white hover:bg-white/10 transition-colors disabled:opacity-20"
          aria-label="Next slide"
        >
          <ChevronRight size={28} />
        </button>
      </footer>
    </div>
  );
}
