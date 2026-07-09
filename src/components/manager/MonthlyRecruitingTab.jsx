/**
 * MonthlyRecruitingTab.jsx — item 2.2 Monthly Recruiting kanban CRM (UI half).
 *
 * The pipeline board is now the primary surface: an 8-stage kanban of recruiting
 * candidates (recruiting-v2 desktop mockup), with a funnel stat strip, owner
 * filter chips (BM+), a candidate drill drawer, and an add-candidate form. The
 * shipped monthly-aggregate rollup (I2) is RETAINED below the board via
 * <MonthlyRecruitingRollup /> — a separate feature that complements the funnel.
 *
 * Data contract locked in firestore.rules (commit f9829645): managers only;
 * creator self-owns; senior-in-scope may reassign; no delete (archive instead);
 * equality-only board queries split by role (see recruitingService).
 *
 * Stage-move affordance: explicit Advance button + a "Move to: <stage>" picker
 * in the drill (covers advance AND regress). Pointer-drag kanban is a follow-up
 * (noted in the build progress row) — not required for this slice.
 *
 * 'stalled' is DERIVED client-side (recruitingService.isStalled): active,
 * non-licensed, stageChangedAt older than STALLED_THRESHOLD_DAYS (14, CC-chosen
 * / operator-tunable). No configurable recruiting target source exists in the
 * repo, so the funnel renders WITHOUT a hard target — a guidance line stands in.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserPlus, Plus, Clock, RotateCw, Users2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  RECRUITING_STAGES, getCandidatesForBoard, isStalled, daysInStage, toMillis,
} from '../../services/recruitingService';
import { CandidateAvatar } from './recruitingVisuals';
import { stageTone } from './recruitingStageTone';
import PanelSkeleton from '../ui/PanelSkeleton';
import RecDrillDrawer from './RecDrillDrawer';
import RecCandidateForm from './RecCandidateForm';
import MonthlyRecruitingRollup from './MonthlyRecruitingRollup';

const SENIOR_ROLES = ['sales_manager', 'tenant_admin', 'platform_admin'];

function formatShortDate(ts) {
  const ms = toMillis(ts);
  if (ms == null) return '';
  try {
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

// ── Candidate mini card ──────────────────────────────────────────────────────
function CandidateCard({ candidate, onOpen }) {
  const stalled = isStalled(candidate);
  const days = daysInStage(candidate);
  const hired = candidate.stage === 'licensed';
  const ownerFirst = String(candidate.ownerName ?? '').split(/\s+/)[0] || '—';
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="rec-candidate-card"
      className={`w-full text-left rounded-xl border bg-card p-3 hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        stalled ? 'border-warning/50' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <CandidateAvatar name={candidate.name} stage={candidate.stage} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink truncate" title={candidate.name}>{candidate.name}</p>
          {candidate.source && (
            <p className="text-[10px] font-mono text-ink-muted truncate mt-0.5" title={candidate.source}>{candidate.source}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2.5">
        {hired ? (
          <span className="text-[10px] font-mono font-bold text-success-ink">
            HIRED{formatShortDate(candidate.licensedAt ?? candidate.stageChangedAt) ? ` ${formatShortDate(candidate.licensedAt ?? candidate.stageChangedAt)}` : ''}
          </span>
        ) : stalled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-warning-ink">
            <Clock size={10} aria-hidden="true" /> {days}d stalled
          </span>
        ) : (
          <span className="text-[10px] font-mono text-ink-muted tabular-nums">{days != null ? `${days}d in stage` : '—'}</span>
        )}
        <span className="text-[10px] text-ink-muted truncate max-w-[45%]" title={candidate.ownerName}>↳ {ownerFirst}</span>
      </div>
    </button>
  );
}

// ── Pipeline column (one stage) ──────────────────────────────────────────────
function PipelineColumn({ stage, candidates, onOpen }) {
  const tone = stageTone(stage.key);
  return (
    <section
      aria-label={`${stage.label} — ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}`}
      className="w-full md:w-44 shrink-0 flex flex-col min-h-0"
    >
      <div className={`flex items-center gap-2 px-2 py-1.5 border-b-2 mb-2.5 ${tone.border}`}>
        <span className={`h-2 w-2 rounded-sm ${tone.dot}`} aria-hidden="true" />
        <span className="text-[11px] font-bold text-ink flex-1 min-w-0 truncate">{stage.short}</span>
        <span className={`text-[11px] font-bold font-mono tabular-nums ${tone.text}`}>{candidates.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {candidates.length ? (
          candidates.map((c) => <CandidateCard key={c.id} candidate={c} onOpen={() => onOpen(c.id)} />)
        ) : (
          <p className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-[10px] italic text-ink-muted">Empty</p>
        )}
      </div>
    </section>
  );
}

// ── Funnel stat strip ────────────────────────────────────────────────────────
function FunnelStrip({ inPipeline, nearHire, stalled, hired }) {
  const stats = [
    { k: 'IN PIPELINE', v: inPipeline, cls: 'text-primary' },
    { k: 'NEAR HIRE',   v: nearHire,   cls: 'text-gold-ink' },
    { k: 'STALLED',     v: stalled,    cls: 'text-warning-ink' },
    { k: 'HIRED · YR',  v: hired,      cls: 'text-success-ink' },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4" data-testid="rec-funnel-strip">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {stats.map((s) => (
          <div key={s.k}>
            <p className={`font-display text-2xl font-extrabold tabular-nums leading-none ${s.cls}`} data-testid={`rec-funnel-${s.k.split(' ')[0].toLowerCase()}`}>{s.v}</p>
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mt-1.5">{s.k}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-muted mt-3">
        Only “Licensed &amp; active” counts as a hire · feeds your WAR. Guidance: at least 1 new licensed advisor per quarter.
      </p>
    </div>
  );
}

export default function MonthlyRecruitingTab() {
  const { user, userProfile, role, tenantId } = useAuth();
  const ownerUid = user?.uid ?? null;
  const branchId = userProfile?.branchId ?? null;
  const myName = userProfile?.name ?? userProfile?.email ?? '';

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const loadSeq = useRef(0);

  const loadBoard = useCallback(async () => {
    if (!tenantId || !ownerUid) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(false);
    try {
      const rows = await getCandidatesForBoard({ tenantId, role, branchId, ownerUid });
      if (seq !== loadSeq.current) return;
      setCandidates(rows);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      console.error('[MonthlyRecruitingTab] board load failed', e);
      setError(true);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [tenantId, role, branchId, ownerUid]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const active = useMemo(() => candidates.filter((c) => c.status === 'active'), [candidates]);

  // Unique owners across the active board — powers filter chips + reassign list.
  const owners = useMemo(() => {
    const map = new Map();
    for (const c of active) {
      if (c.ownerUid && !map.has(c.ownerUid)) map.set(c.ownerUid, { uid: c.ownerUid, name: c.ownerName || '—' });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [active]);

  const showChips = owners.length > 1;
  const effectiveFilter = showChips ? ownerFilter : 'all';
  const filtered = useMemo(
    () => (effectiveFilter === 'all' ? active : active.filter((c) => c.ownerUid === effectiveFilter)),
    [active, effectiveFilter],
  );

  const thisYear = new Date().getFullYear();
  const funnel = useMemo(() => {
    const hired = filtered.filter((c) => {
      if (c.stage !== 'licensed') return false;
      const ms = toMillis(c.licensedAt ?? c.stageChangedAt);
      return ms == null ? true : new Date(ms).getFullYear() === thisYear;
    }).length;
    return {
      inPipeline: filtered.length,
      nearHire: filtered.filter((c) => c.stage === 'offer' || c.stage === 'licensing').length,
      stalled: filtered.filter((c) => isStalled(c)).length,
      hired,
    };
  }, [filtered, thisYear]);

  const byStage = useMemo(() => {
    const map = {};
    for (const s of RECRUITING_STAGES) {
      map[s.key] = filtered
        .filter((c) => c.stage === s.key)
        .sort((a, b) => (daysInStage(b) ?? 0) - (daysInStage(a) ?? 0));
    }
    return map;
  }, [filtered]);

  const selected = useMemo(() => active.find((c) => c.id === selectedId) ?? null, [active, selectedId]);
  // Membership-driven close: an archived/absent selection unmounts the drawer.
  useEffect(() => {
    if (selectedId && !active.some((c) => c.id === selectedId)) setSelectedId(null);
  }, [active, selectedId]);

  const canReassign = useMemo(() => {
    if (!selected) return false;
    if (SENIOR_ROLES.includes(role)) return true;
    return role === 'branch_manager' && selected.branchId === branchId;
  }, [selected, role, branchId]);

  const createMeta = { branchId, ownerUid, ownerName: myName };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8 screen-enter">
      <div className="stagger space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-display font-extrabold text-ink flex items-center gap-2">
              <UserPlus size={22} className="text-primary" aria-hidden="true" /> Recruiting
            </h1>
            <p className="text-sm text-ink-muted mt-0.5">Build the bench — anyone refers, you drive the pipeline.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            data-testid="rec-add-candidate"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus size={16} aria-hidden="true" /> Add candidate
          </button>
        </div>

        {/* Funnel strip (hidden while the board is loading/error to avoid stale zeros) */}
        {!loading && !error && <FunnelStrip {...funnel} />}

        {/* Owner filter chips (BM+ with >1 owner) */}
        {showChips && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by owner">
            <button
              type="button"
              onClick={() => setOwnerFilter('all')}
              aria-pressed={effectiveFilter === 'all'}
              className={`min-h-[36px] px-3 rounded-full text-xs font-semibold border transition-colors ${
                effectiveFilter === 'all' ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border text-ink-muted hover:text-ink'
              }`}
            >
              All ({active.length})
            </button>
            {owners.map((o) => (
              <button
                key={o.uid}
                type="button"
                onClick={() => setOwnerFilter(o.uid)}
                aria-pressed={effectiveFilter === o.uid}
                className={`min-h-[36px] px-3 rounded-full text-xs font-semibold border transition-colors ${
                  effectiveFilter === o.uid ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border text-ink-muted hover:text-ink'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        )}

        {/* Board */}
        <div>
          {loading ? (
            <PanelSkeleton variant="card-grid" count={4} label="Loading recruiting pipeline…" />
          ) : error ? (
            <div
              role="alert"
              data-testid="rec-board-error"
              className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center"
            >
              <p className="text-sm text-danger-ink font-medium">Couldn&apos;t load the recruiting pipeline — check your connection and try again.</p>
              <button
                type="button"
                onClick={loadBoard}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCw size={15} aria-hidden="true" /> Retry
              </button>
            </div>
          ) : active.length === 0 ? (
            <div
              data-testid="rec-board-empty"
              className="flex flex-col items-center gap-3 p-10 rounded-2xl border border-border bg-card text-center"
            >
              <Users2 size={26} className="text-ink-muted" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">No candidates in your pipeline yet</p>
                <p className="text-xs text-ink-muted mt-1">Add your first recruiting candidate to start building the bench.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                data-testid="rec-empty-add"
                className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus size={16} aria-hidden="true" /> Add your first candidate
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div
                className="flex flex-col md:flex-row gap-3 md:overflow-x-auto pb-1"
                data-testid="rec-board"
              >
                {RECRUITING_STAGES.map((s) => (
                  <PipelineColumn key={s.key} stage={s} candidates={byStage[s.key]} onOpen={setSelectedId} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Retained monthly rollup (shipped I2 feature) */}
        <section aria-label="Monthly recruiting rollup" className="border-t border-border pt-8">
          <MonthlyRecruitingRollup />
        </section>
      </div>

      {/* Drawers */}
      {selected && (
        <RecDrillDrawer
          candidate={selected}
          tenantId={tenantId}
          canReassign={canReassign}
          owners={owners}
          onClose={() => setSelectedId(null)}
          onMutated={loadBoard}
        />
      )}
      {formOpen && (
        <RecCandidateForm
          tenantId={tenantId}
          meta={createMeta}
          onClose={() => setFormOpen(false)}
          onCreated={loadBoard}
        />
      )}
    </div>
  );
}
