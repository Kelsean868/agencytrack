import React, { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { AlertCircle, Check, ArrowRight, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getPoliciesForManager, confirmPolicy, lapsePolicy } from '../../services/policiesService';
import { getTenantUsers } from '../../services/managerService';
import { parseDateOnlyTT } from '../../utils/dateInputs';
import { formatCurrency, formatCompactTTD } from '../../utils/formatters';
import { statusToken, needsManagerConfirmation } from '../../lib/policyStatusTokens';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Reconciliation display state → shared statusToken() base role (no fork — PR #432).
//   to-reconcile (pending, unconfirmed) → in-flight (primary) · clean (keyed=ledger) → settled (success)
//   flagged → soft (warning) · confirmed → gold
const reconToken = (state) =>
  statusToken({ toReconcile: 'in-flight', clean: 'settled', flagged: 'soft', confirmed: 'confirmed' }[state] ?? 'in-flight');

function buildYearOptions() {
  const current = new Date().getFullYear();
  const opts = [];
  for (let y = current; y >= current - 2; y--) opts.push(y);
  return opts;
}

function initials(name) {
  if (!name) return '—';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '—';
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric' });
}

function inPeriod(dateIssued, year, month) {
  if (!dateIssued) return false;
  const d = dateIssued.toDate ? dateIssued.toDate() : new Date(dateIssued);
  return d.getFullYear() === year && (d.getMonth() + 1) === month;
}

export default function PolicyReconciliationPanel() {
  const { userProfile, role, tenantId } = useAuth();

  // canAccess mirrors SettlementPanel: BM / tenant_admin / platform_admin / canConfirmSettlements
  const canAccess =
    role === 'branch_manager' ||
    role === 'tenant_admin'   ||
    role === 'platform_admin' ||
    Boolean(userProfile?.canConfirmSettlements);

  // Lapse is BM+ only
  const canLapse =
    role === 'branch_manager' ||
    role === 'tenant_admin'   ||
    role === 'platform_admin';

  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [activeTab,     setActiveTab]     = useState('confirm'); // 'confirm' | 'lapse'
  const [reconFilter,   setReconFilter]   = useState('toReconcile'); // toReconcile | flagged | confirmed

  const [allPoliciesRaw, setAllPoliciesRaw] = useState([]);
  const [agentMap,       setAgentMap]       = useState({});
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  // Per-policy confirm form state keyed by policyId
  const [formState, setFormState] = useState({});

  // Per-policy lapse form state
  const [lapseState, setLapseState] = useState({});

  const loadData = useCallback(async () => {
    if (!tenantId || !userProfile) return;
    setLoading(true);
    setError(null);
    try {
      const scope = { role, uid: userProfile.uid, branchId: userProfile.branchId };
      const [allPolicies, users] = await Promise.all([
        getPoliciesForManager(tenantId, scope),
        getTenantUsers(tenantId),
      ]);

      const map = {};
      for (const u of users) map[u.id] = u.name ?? u.email ?? u.id;
      setAgentMap(map);
      setAllPoliciesRaw(allPolicies);

      // Seed form state for unconfirmed settled policies in the period.
      const toConfirm = allPolicies.filter(
        (p) => p.status === 'settled' && !p.confirmedAt && inPeriod(p.dateIssued, selectedYear, selectedMonth),
      );
      setFormState((prev) => {
        const next = { ...prev };
        toConfirm.forEach((p) => {
          if (!next[p.id]) {
            next[p.id] = { managerSettledAPI: '', managerNote: '', submitting: false, done: false, confirmedByName: null, localDiscrepancy: false };
          }
        });
        return next;
      });
    } catch (err) {
      setError(err.message ?? 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [tenantId, role, userProfile, selectedYear, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  /** Confirm a single policy. resolvedAPIStr overrides the form value. */
  const confirmOne = async (policy, resolvedAPIStr) => {
    const parsedAPI = parseFloat(resolvedAPIStr);
    if (!(parsedAPI > 0)) return { error: `Confirmed figure for "${policy.ownerName ?? policy.id}" must be a positive number.` };

    setFormState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], submitting: true } }));
    try {
      const managerProfile = { uid: userProfile.uid, name: userProfile.name ?? userProfile.email ?? 'Manager', role };
      const noteStr = formState[policy.id]?.managerNote ?? '';
      await confirmPolicy(tenantId, managerProfile, policy.id, policy, resolvedAPIStr, noteStr);
      setFormState((prev) => ({
        ...prev,
        [policy.id]: { ...prev[policy.id], submitting: false, done: true, confirmedByName: managerProfile.name, localDiscrepancy: parsedAPI !== policy.settledAPI },
      }));
      return { error: null };
    } catch (err) {
      setFormState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], submitting: false } }));
      return { error: err.message ?? 'Confirmation failed' };
    }
  };

  const handleConfirm = async (policy) => {
    const fs = formState[policy.id];
    if (!fs) return;
    // Blank key-in = agree with the ledger figure (clean confirm).
    const resolvedAPI = fs.managerSettledAPI?.trim() ? fs.managerSettledAPI : String(policy.settledAPI ?? '');
    const result = await confirmOne(policy, resolvedAPI);
    if (result.error) setError(result.error);
    else { setError(null); setTimeout(loadData, 800); }
  };

  const handleLapse = async (policy) => {
    const ls = lapseState[policy.id];
    if (!ls?.dateLapsed) { setError('Date lapsed is required.'); return; }
    setError(null);
    setLapseState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], submitting: true } }));
    try {
      const managerProfile = { uid: userProfile.uid, name: userProfile.name ?? userProfile.email ?? 'Manager', role };
      const dateLapsedTs = Timestamp.fromDate(parseDateOnlyTT(ls.dateLapsed));
      const fields = { dateLapsed: dateLapsedTs, lapseReason: ls.lapseReason?.trim() || '' };
      await lapsePolicy(tenantId, managerProfile, policy.id, policy, fields);
      setLapseState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], submitting: false, done: true, expanded: false } }));
      setTimeout(loadData, 800);
    } catch (err) {
      setLapseState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], submitting: false } }));
      setError(err.message ?? 'Lapse failed');
    }
  };

  if (!canAccess) {
    return (
      <div className="bg-card rounded-xl p-8 text-center">
        <p className="text-sm text-ink-muted">You do not have access to Policy Reconciliation.</p>
      </div>
    );
  }

  const years = buildYearOptions();

  // ── Derivations (client-side, existing data only) ──
  const periodSettled = allPoliciesRaw.filter((p) => p.status === 'settled' && inPeriod(p.dateIssued, selectedYear, selectedMonth));
  // `!confirmedAt` alone put all 117 imported settled policies in this worklist:
  // the import never sets a confirmation, because head office IS the authority
  // for those statuses and no manager step exists on that path. `flaggedSet` and
  // `confirmedClean` both already require `confirmedAt`, so neither can contain
  // an imported policy and neither needs this filter. `pendingValue` follows
  // `toReconcile` and is corrected by it.
  const toReconcile = periodSettled.filter((p) => !p.confirmedAt && needsManagerConfirmation(p));
  const flaggedSet  = periodSettled.filter((p) => p.confirmedAt && p.hasDiscrepancy);
  const confirmedClean = periodSettled.filter((p) => p.confirmedAt && !p.hasDiscrepancy);
  // Pending reconciliation = Σ ledger settledAPI over the UNCONFIRMED queue (the
  // "To reconcile" set). A pre-confirmation "at-risk delta" is not knowable —
  // hasDiscrepancy only exists after the manager keys + confirms.
  const pendingValue = toReconcile.reduce((s, p) => s + (Number(p.settledAPI) || 0), 0);

  const lapseTabPolicies = allPoliciesRaw.filter((p) =>
    (p.status === 'settled' || p.status === 'lapsed') && inPeriod(p.dateIssued, selectedYear, selectedMonth),
  );

  const TILES = [
    { key: 'toReconcile', label: 'To reconcile', state: 'toReconcile', count: toReconcile.length,    note: 'awaiting your confirm' },
    { key: 'flagged',     label: 'Flagged',      state: 'flagged',     count: flaggedSet.length,     note: 'need a decision' },
    { key: 'confirmed',   label: 'Confirmed',    state: 'confirmed',   count: confirmedClean.length, note: 'locked this cycle' },
  ];

  const worklist =
    reconFilter === 'flagged' ? flaggedSet :
    reconFilter === 'confirmed' ? confirmedClean :
    toReconcile;

  return (
    <div className="space-y-5" data-testid="policy-reconciliation-surface">
      {/* Header + tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-ink">Policy Reconciliation</h2>
          <p className="text-sm text-ink-muted">
            Read Tatil&rsquo;s circular and key the confirmed figure per policy. Blank = agree with the ledger.
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1 p-1 bg-surface-muted border border-border rounded-lg" role="tablist">
          <button
            type="button" role="tab" aria-selected={activeTab === 'confirm'}
            onClick={() => setActiveTab('confirm')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'confirm' ? 'bg-card text-ink border border-border shadow-sm' : 'text-ink-muted hover:text-ink'}`}
            data-testid="tab-confirm"
          >
            Confirm
          </button>
          {canLapse && (
            <button
              type="button" role="tab" aria-selected={activeTab === 'lapse'}
              onClick={() => setActiveTab('lapse')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${activeTab === 'lapse' ? 'bg-card text-ink border border-border shadow-sm' : 'text-ink-muted hover:text-ink'}`}
              data-testid="tab-lapse"
            >
              Lapse
              <span className="font-mono text-[8px] font-bold tracking-wide px-1.5 py-px rounded-full bg-gold-tint text-gold-ink">BM+</span>
            </button>
          )}
        </div>
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap gap-3">
        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} aria-label="Year"
          className="h-11 rounded-lg border border-border bg-card text-ink text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/40">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} aria-label="Month"
          className="h-11 rounded-lg border border-border bg-card text-ink text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/40">
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* Shared states */}
      {loading && (
        <div className="card bg-card p-4 space-y-3" data-testid="reconcil-loading">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 bg-surface-muted border border-border rounded-lg p-3">
              <div className="w-9 h-9 rounded-full bg-border/60 animate-pulse" />
              <div className="flex-1 space-y-2"><div className="h-2.5 rounded bg-border/60 animate-pulse w-1/2" /><div className="h-2.5 rounded bg-border/50 animate-pulse w-1/3" /></div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div role="alert" className="card text-center py-10 flex flex-col items-center gap-3" data-testid="reconcil-error">
          <div className="w-11 h-11 rounded-xl bg-danger-tint text-danger-ink flex items-center justify-center"><AlertCircle size={20} /></div>
          <p className="font-display font-extrabold text-[15px] text-ink">Couldn&rsquo;t load the worklist</p>
          <p className="text-xs text-ink-muted">{error}</p>
          <button onClick={loadData} className="mt-1 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-sm font-semibold text-ink hover:bg-surface-muted transition-colors">
            <RotateCcw size={14} /> Retry
          </button>
        </div>
      )}

      {/* ── Confirm tab ── */}
      {!loading && !error && activeTab === 'confirm' && (
        <>
          {periodSettled.length === 0 ? (
            <div className="card text-center py-12 flex flex-col items-center gap-2.5" data-testid="reconcil-empty">
              <div className="w-11 h-11 rounded-xl bg-success-tint text-success-ink flex items-center justify-center text-xl"><Check size={22} /></div>
              <p className="font-display font-extrabold text-[15px] text-ink">No policies to reconcile</p>
              <p className="text-xs text-ink-muted">Settled policies will appear here as agents log them.</p>
            </div>
          ) : (
            <>
              {/* @@hero-pane-start */}
              {/* Pending-reconciliation hero + tiles */}
              <div className="glass hero teal p-5 flex items-center gap-6 flex-wrap" data-testid="pending-hero">
                <div className="shrink-0">
                  <p className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-[--hero-ink-muted-teal]">Pending reconciliation</p>
                  <p className="font-display font-extrabold text-[34px] text-[--hero-ink] tracking-tight leading-none mt-1.5" data-testid="pending-value">{formatCompactTTD(pendingValue)}</p>
                  <p className="text-[11px] text-[--hero-ink-muted-teal] mt-1.5">across {toReconcile.length} {toReconcile.length === 1 ? 'policy' : 'policies'} · awaiting your confirm</p>
                </div>
                <span className="w-px self-stretch bg-white/20 hidden sm:block" />
                <div className="flex-1 flex gap-3 min-w-[260px]">
                  {TILES.map((t) => {
                    // Map recon states to hero-safe dot classes (chip-island grammar).
                    const heroDot =
                      t.state === 'toReconcile' ? 'bg-[--hero-ink]' :
                      t.state === 'flagged'     ? 'bg-[--hero-dot-warning]' :
                      t.state === 'confirmed'   ? 'bg-[--hero-dot-warning]' :
                                                  'bg-[--hero-dot-success]';
                    return (
                      <div key={t.key} className="flex-1 p-3.5 bg-[--hero-chip-island] border border-[--hero-chip-border] rounded-xl" data-testid={`recon-tile-${t.key}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${heroDot}`} />
                          <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-[--hero-ink-muted-teal] uppercase whitespace-nowrap">{t.label}</span>
                        </div>
                        <p className="font-display font-extrabold text-[26px] tracking-tight leading-none mt-2 text-[--hero-ink]" data-testid={`recon-tile-count-${t.key}`}>{t.count}</p>
                        <p className="font-mono text-[10.5px] text-[--hero-ink-muted-teal] mt-1">{t.note}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* @@hero-pane-end */}

              {/* Filter chips — per-policy confirm only (no bulk; see Slice-2 FU) */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 p-1 bg-surface-muted border border-border rounded-[10px]" role="tablist" aria-label="Filter reconciliation worklist">
                  {[
                    { key: 'toReconcile', label: 'To reconcile', count: toReconcile.length },
                    { key: 'flagged',     label: 'Flagged',      count: flaggedSet.length },
                    { key: 'confirmed',   label: 'Confirmed',    count: confirmedClean.length },
                  ].map((f) => {
                    const on = reconFilter === f.key;
                    return (
                      <button key={f.key} role="tab" aria-selected={on} onClick={() => setReconFilter(f.key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${on ? 'bg-card text-ink border border-border shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                        data-testid={`recon-filter-${f.key}`}>
                        {f.label}
                        <span className={`font-mono text-[10px] px-1.5 rounded-full ${on ? 'bg-primary-tint text-primary' : 'text-ink-muted'}`}>{f.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Worklist */}
              <div className="flex flex-col gap-2.5" data-testid="recon-worklist">
                {worklist.length === 0 ? (
                  <div className="card text-center py-8"><p className="text-sm text-ink-muted">Nothing in this view.</p></div>
                ) : worklist.map((policy) => {
                  const fs = formState[policy.id] ?? { managerSettledAPI: '', managerNote: '', submitting: false, done: false };
                  const isConfirmedView = Boolean(policy.confirmedAt);
                  const ledger = Number(policy.settledAPI) || 0;
                  const keyed = isConfirmedView ? (Number(policy.managerSettledAPI) || 0) : (fs.managerSettledAPI?.trim() ? Number(fs.managerSettledAPI) : null);
                  const delta = keyed != null ? keyed - ledger : 0;
                  const flagged = isConfirmedView ? Boolean(policy.hasDiscrepancy) : (keyed != null && delta !== 0);
                  const pillState = isConfirmedView ? (flagged ? 'flagged' : 'confirmed') : (keyed == null ? 'toReconcile' : flagged ? 'flagged' : 'clean');
                  const pillLabel = isConfirmedView ? (flagged ? 'Flagged' : 'Confirmed') : (keyed == null ? 'To reconcile' : flagged ? 'Flagged' : 'Clean');
                  const tok = reconToken(pillState);
                  const agentName = agentMap[policy.agentId] ?? policy.agentId;

                  return (
                    <div key={policy.id}
                      className={`card bg-card p-4 ${flagged ? 'border-warning/40' : ''}`}
                      data-testid={`recon-row-${policy.id}`}>
                      <div className="flex items-start gap-3.5 flex-wrap">
                        <span className={`w-9 h-9 rounded-full ${flagged || isConfirmedView ? 'bg-gold-tint text-gold-ink' : 'bg-primary-tint text-primary'} flex items-center justify-center font-display font-bold text-[13px] shrink-0`}>
                          {initials(agentName)}
                        </span>
                        <div className="min-w-0 w-[150px]">
                          <p className="text-[13px] font-bold text-ink truncate">{policy.ownerName ?? policy.insuredName ?? policy.id}</p>
                          <p className="font-mono text-[10px] text-ink-muted mt-0.5 truncate">{agentName}{policy.policyNumber ? ` · ${policy.policyNumber}` : ''}</p>
                        </div>

                        {/* Compare: ledger → confirmed (from circular) */}
                        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                          <div>
                            <p className="font-mono text-[8.5px] font-bold tracking-[0.1em] text-ink-muted">LEDGER · SUBMITTED</p>
                            <p className="font-mono text-[13px] font-bold text-ink mt-0.5" data-testid={`ledger-api-${policy.id}`}>{formatCurrency(ledger)}</p>
                          </div>
                          <ArrowRight size={14} className="text-ink-muted shrink-0" />
                          <div>
                            <p className="font-mono text-[8.5px] font-bold tracking-[0.1em] text-ink-muted">CONFIRMED · FROM CIRCULAR</p>
                            {isConfirmedView ? (
                              <p className={`font-mono text-[13px] font-bold mt-0.5 ${flagged ? 'text-danger-ink' : 'text-ink'}`}>{formatCurrency(keyed)}</p>
                            ) : (
                              <input
                                type="number" step="0.01" min="0.01"
                                value={fs.managerSettledAPI}
                                onChange={(e) => setFormState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], managerSettledAPI: e.target.value } }))}
                                placeholder={formatCurrency(ledger)}
                                disabled={fs.submitting}
                                aria-label={`Confirmed figure from circular for ${policy.ownerName ?? policy.id}`}
                                className="mt-0.5 w-32 h-9 rounded-lg border border-border bg-surface-muted text-ink text-sm px-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                                data-testid={`manager-api-input-${policy.id}`}
                              />
                            )}
                          </div>
                        </div>

                        {/* Delta + pill */}
                        <div className="text-right shrink-0 w-[88px]">
                          <p className={`font-mono text-[11.5px] font-bold ${keyed == null ? 'text-ink-muted' : flagged ? 'text-danger-ink' : 'text-success-ink'}`}>
                            {keyed == null ? '—' : flagged ? `${delta > 0 ? '+' : '−'}${formatCompactTTD(Math.abs(delta)).replace('TTD ', 'TTD ')}` : '✓ match'}
                          </p>
                          <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide ${tok.tint} ${tok.text}`}>
                            {pillLabel}
                          </span>
                        </div>

                        {/* Action */}
                        {!isConfirmedView && (
                          <button type="button" onClick={() => handleConfirm(policy)} disabled={fs.submitting}
                            className="h-9 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-[12.5px] font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-50 shrink-0"
                            data-testid={`confirm-btn-${policy.id}`}>
                            {fs.submitting ? '…' : 'Confirm'}
                          </button>
                        )}
                      </div>

                      {/* Manager note (key-in rows only) */}
                      {!isConfirmedView && (
                        <input
                          type="text"
                          value={fs.managerNote}
                          onChange={(e) => setFormState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], managerNote: e.target.value } }))}
                          placeholder="Manager note (optional) — e.g. settled under submission per circular"
                          disabled={fs.submitting}
                          aria-label={`Manager note for ${policy.ownerName ?? policy.id}`}
                          className="mt-3 w-full h-9 rounded-lg border border-border bg-surface-muted text-ink text-xs px-3 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                          data-testid={`manager-note-input-${policy.id}`}
                        />
                      )}
                      {isConfirmedView && policy.managerNote && (
                        <p className="mt-2 text-xs text-ink-muted">Note: {policy.managerNote}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Lapse tab ── */}
      {!loading && !error && activeTab === 'lapse' && (
        lapseTabPolicies.length === 0 ? (
          <div className="card text-center py-10" data-testid="lapse-empty">
            <p className="text-sm text-ink-muted">No settled policies for {MONTHS[selectedMonth - 1]} {selectedYear}.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5" data-testid="lapse-worklist">
            {lapseTabPolicies.map((policy) => {
              const ls = lapseState[policy.id] ?? { dateLapsed: '', lapseReason: '', expanded: false, submitting: false, done: false };
              const isAlreadyLapsed = policy.status === 'lapsed' || ls.done;
              const agentName = agentMap[policy.agentId] ?? policy.agentId;
              return (
                <div key={policy.id} className="card bg-card p-4" data-testid={`lapse-policy-card-${policy.id}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-full bg-surface-muted text-ink-muted flex items-center justify-center font-display font-bold text-[13px] shrink-0">{initials(agentName)}</span>
                      <div>
                        <p className="text-[13px] font-bold text-ink">{policy.ownerName ?? policy.insuredName ?? policy.id}</p>
                        <p className="font-mono text-[10px] text-ink-muted mt-0.5">{agentName}{policy.policyNumber ? ` · ${policy.policyNumber}` : ''}</p>
                      </div>
                    </div>
                    {isAlreadyLapsed ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide bg-surface-muted text-ink-muted" data-testid={`lapsed-pill-${policy.id}`}>
                        Lapsed{policy.dateLapsed ? ` on ${fmtDate(policy.dateLapsed)}` : ''}
                      </span>
                    ) : (
                      <button type="button"
                        onClick={() => setLapseState((prev) => ({ ...prev, [policy.id]: { ...(prev[policy.id] ?? { dateLapsed: '', lapseReason: '', submitting: false, done: false }), expanded: !ls.expanded } }))}
                        className="h-9 px-3 rounded-lg text-xs font-semibold text-danger-ink border border-danger/30 hover:bg-danger/5 transition-colors min-w-[44px]"
                        data-testid={`mark-lapsed-btn-${policy.id}`}>
                        {ls.expanded ? 'Cancel' : 'Mark as Lapsed'}
                      </button>
                    )}
                  </div>

                  {!isAlreadyLapsed && ls.expanded && (
                    <div className="mt-3 space-y-3 pt-3 border-t border-border">
                      <div>
                        <label htmlFor={`date-lapsed-${policy.id}`} className="block text-xs font-medium text-ink-muted mb-1">Date Lapsed <span className="text-danger-ink">*</span></label>
                        <input id={`date-lapsed-${policy.id}`} type="date" value={ls.dateLapsed}
                          onChange={(e) => setLapseState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], dateLapsed: e.target.value } }))}
                          disabled={ls.submitting}
                          className="w-full h-11 rounded-lg border border-border bg-surface-muted text-ink text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                          data-testid={`date-lapsed-input-${policy.id}`} />
                      </div>
                      <div>
                        <label htmlFor={`lapse-reason-${policy.id}`} className="block text-xs font-medium text-ink-muted mb-1">Lapse Reason <span className="font-normal">(optional)</span></label>
                        <input id={`lapse-reason-${policy.id}`} type="text" value={ls.lapseReason}
                          onChange={(e) => setLapseState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], lapseReason: e.target.value } }))}
                          placeholder="e.g. Non-payment of premium" disabled={ls.submitting}
                          className="w-full h-11 rounded-lg border border-border bg-surface-muted text-ink text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                          data-testid={`lapse-reason-input-${policy.id}`} />
                      </div>
                      <button type="button" onClick={() => handleLapse(policy)} disabled={ls.submitting || !ls.dateLapsed}
                        className="h-11 px-6 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors disabled:opacity-50 min-w-[44px]"
                        data-testid={`confirm-lapse-btn-${policy.id}`}>
                        {ls.submitting ? 'Lapsing…' : 'Confirm Lapse'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
