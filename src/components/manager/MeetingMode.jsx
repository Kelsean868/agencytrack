import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { formatDateLabel } from '../../utils/validators';

// Mirrors extractFields() in MasterSheet — keeps both views consistent.
function extractFields(d) {
  if (d.step1 !== undefined || d.step2 !== undefined) {
    return {
      dials: parseFloat(d.step1?.dials || 0),
      telContacts: parseFloat(d.step2?.telContacts || 0),
      f2fAttempts: parseFloat(d.step3?.f2fAttempts || 0),
      ffi:
        parseFloat(d.step3?.ffiConductedNew || 0) +
        parseFloat(d.step3?.ffiConductedOld || 0),
      ci:
        parseFloat(d.step4?.ciConductedNew || 0) +
        parseFloat(d.step4?.ciConductedOld || 0),
      apps:
        parseFloat(d.step4?.appsSoldNew || 0) +
        parseFloat(d.step4?.appsSoldOld || 0),
      api:
        parseFloat(d.step4?.apiNew || 0) +
        parseFloat(d.step4?.apiOld || 0),
    };
  }

  const callSum =
    (d.referralCalls || 0) +
    (d.followUpCalls || 0) +
    (d.coldCalls || 0) +
    (d.seminarTradeshowCalls || 0) +
    (d.serviceCalls || 0);

  return {
    dials: parseFloat(d.dials || d.totalDials || callSum || 0),
    telContacts: parseFloat(d.telContacts || d.telephoneContacts || d.qualifiedApproaches || 0),
    f2fAttempts: parseFloat(d.f2fAttempts || d.f2fContacts || 0),
    ffi: parseFloat(d.ffiConducted || d.ffisScheduled || 0),
    ci: parseFloat(d.ciConducted || d.closingInterviews || 0),
    apps: parseFloat(d.applicationsSold || d.appsSold || 0),
    api: parseFloat(d.apiSold || d.api || d.annualPremium || 0),
  };
}

function resolveAgentName(sub) {
  if (sub.agentName)   return sub.agentName;
  if (sub.displayName) return sub.displayName;
  if (sub.userName)    return sub.userName;
  const uid = sub.agentId ?? sub.userId ?? '';
  return uid ? `Agent ${uid.slice(-6)}` : 'Unknown Agent';
}

function computeUnitAverages(agentSlides) {
  const keys = ['dials', 'telContacts', 'f2fAttempts', 'ffi', 'appsSold', 'apiSold'];
  const avgs = {};
  keys.forEach((k) => {
    const values = agentSlides.map((s) => s[k]).filter((v) => typeof v === 'number');
    avgs[k] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  });
  return avgs;
}

function StatusBadge({ status }) {
  const styles = {
    submitted: 'bg-success/25 text-success',
    draft: 'bg-warning/25 text-warning',
    missing: 'bg-danger/25 text-danger',
  };
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${styles[status] ?? styles.missing}`}>
      {status === 'submitted' ? 'Submitted' : status === 'draft' ? 'Draft' : 'Missing'}
    </span>
  );
}

export default function MeetingMode({ submissions, selectedWeek, onClose }) {
  const [slide, setSlide] = useState(0);

  const agentSlides = useMemo(() => {
    return [...submissions]
      .sort((a, b) => resolveAgentName(a).localeCompare(resolveAgentName(b)))
      .map((sub) => {
        const fields = extractFields(sub);
        const ci = fields.ci;
        const apps = fields.apps;
        return {
          agentId: sub.agentId ?? sub.userId,
          name: resolveAgentName(sub),
          status: sub.status ?? 'draft',
          dials: fields.dials,
          telContacts: fields.telContacts,
          f2fAttempts: fields.f2fAttempts,
          ffi: fields.ffi,
          appsSold: apps,
          apiSold: fields.api,
          closingRatio: ci > 0 ? Math.round((apps / ci) * 100) : null,
        };
      });
  }, [submissions]);

  const unitAvgs = useMemo(() => computeUnitAverages(agentSlides), [agentSlides]);

  const totalSlides = agentSlides.length + 2; // summary + agents + closing
  const isFirst = slide === 0;
  const isLast  = slide === totalSlides - 1;

  const totalAPI   = useMemo(() => agentSlides.reduce((sum, s) => sum + s.apiSold,  0), [agentSlides]);
  const totalApps  = useMemo(() => agentSlides.reduce((sum, s) => sum + s.appsSold, 0), [agentSlides]);
  const avgClosing = useMemo(() => {
    const ratios = agentSlides.map((s) => s.closingRatio).filter((v) => v !== null);
    return ratios.length > 0 ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length) : null;
  }, [agentSlides]);
  const submittedCount = useMemo(
    () => agentSlides.filter((s) => s.status === 'submitted').length,
    [agentSlides]
  );

  const go = useCallback((dir) => {
    setSlide((s) => Math.min(Math.max(s + dir, 0), totalSlides - 1));
  }, [totalSlides]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, onClose]);

  const isOutlier = (agentSlide) => {
    const keys = ['dials', 'telContacts', 'f2fAttempts', 'ffi', 'appsSold', 'apiSold'];
    return keys.some((k) => unitAvgs[k] > 0 && agentSlide[k] > unitAvgs[k] * 3);
  };

  const renderSlide = () => {
    // Summary slide
    if (slide === 0) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-10 px-8 text-center">
          <h2 className="text-2xl font-semibold" style={{ color: '#01696f' }}>
            Week of {formatDateLabel(selectedWeek)}
          </h2>
          <div className="grid grid-cols-2 gap-10 w-full max-w-2xl">
            <div>
              <p className="text-sm uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Total API</p>
              <p className="font-bold" style={{ fontSize: '2.5rem', color: '#01696f' }}>
                {formatCurrency(totalAPI)}
              </p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Apps Sold</p>
              <p className="font-bold text-white" style={{ fontSize: '2.5rem' }}>{totalApps}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Avg Closing</p>
              <p className="font-bold text-white" style={{ fontSize: '2.5rem' }}>
                {avgClosing !== null ? `${avgClosing}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Submission</p>
              <p className="font-bold text-white" style={{ fontSize: '2.5rem' }}>
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
          <p className="text-sm uppercase tracking-widest" style={{ color: '#01696f' }}>Meeting Complete</p>
          <p className="text-white font-bold" style={{ fontSize: '2rem' }}>
            {agentSlides.length} agent{agentSlides.length !== 1 ? 's' : ''} reviewed
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem' }}>
            Week of {formatDateLabel(selectedWeek)}
          </p>
        </div>
      );
    }

    // Agent slide
    const agent = agentSlides[slide - 1];
    const outlier = isOutlier(agent);
    const ratio = agent.closingRatio;

    const stats = [
      { label: 'Dials',       value: agent.dials },
      { label: 'Tel Contacts', value: agent.telContacts },
      { label: 'F2F',         value: agent.f2fAttempts },
      { label: 'FFI',         value: agent.ffi },
      { label: 'Apps Sold',   value: agent.appsSold },
      { label: 'API',         value: formatCurrency(agent.apiSold), accent: true },
    ];

    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8 w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <h2
            className="font-display font-bold text-white text-center"
            style={{ fontSize: '2.5rem', lineHeight: 1.1 }}
          >
            {agent.name}
          </h2>
          {outlier && (
            <span title="One or more stats are significantly above the team average">
              <AlertTriangle size={24} className="text-warning shrink-0" />
            </span>
          )}
        </div>

        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
          Week ending {formatDateLabel(selectedWeek)}
        </p>

        <div className="grid grid-cols-3 gap-4 w-full">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {s.label}
              </p>
              <p
                className="font-bold"
                style={{ fontSize: '1.5rem', color: s.accent ? '#01696f' : 'white' }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-4 items-center">
          <StatusBadge status={agent.status} />
          {ratio !== null && (
            <span
              className="inline-flex px-3 py-1 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(1,105,111,0.25)', color: '#01696f' }}
            >
              {ratio}% closing ratio
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#28251d' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>
          {slide + 1} / {totalSlides}
        </p>
        <button
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full transition-colors"
          style={{ color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
          aria-label="Exit meeting mode"
        >
          <X size={22} />
        </button>
      </div>

      {/* Slide content */}
      <div className="flex flex-1 overflow-hidden">
        {renderSlide()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-5 shrink-0">
        <button
          onClick={() => go(-1)}
          disabled={isFirst}
          className="w-14 h-14 flex items-center justify-center rounded-full border transition-colors disabled:opacity-20"
          style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', background: 'rgba(255,255,255,0.06)' }}
          aria-label="Previous slide"
        >
          <ChevronLeft size={28} />
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className="rounded-full transition-all"
              style={{
                width: i === slide ? '20px' : '6px',
                height: '6px',
                background: i === slide ? '#01696f' : 'rgba(255,255,255,0.25)',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          disabled={isLast}
          className="w-14 h-14 flex items-center justify-center rounded-full border transition-colors disabled:opacity-20"
          style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', background: 'rgba(255,255,255,0.06)' }}
          aria-label="Next slide"
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}
