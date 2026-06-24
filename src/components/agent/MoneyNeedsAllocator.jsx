import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowRight, ChevronDown, Loader2, AlertCircle, Send, Check, Plus, Trash2, Scale, BarChart2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useFocusTrap from '../../hooks/useFocusTrap';
import { formatCurrency } from '../../utils/formatters';
import { saveAllocation, PLAYGROUND_INCOME_GOAL_KEY } from '../../services/moneyNeedsService';
import { updateUserProfile } from '../../services/userService';
import { getMergedAwardsRuleset } from '../../services/awardsRulesetService';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';
import AwardProjectionStrip from './AwardProjectionStrip';
import {
  ALLOC_LINE_META, LINE_DEFAULT_RATES, MAX_PRODUCTS, PRODUCT_SEEDS,
  visibleLineKeys, allocApps, isDrilled, lineCommission, lineAPI, productAPI,
  effectiveLineRate, totalAllocatedCommission, normalizeAllocation,
  autoBalanceProducts, sumProductCommission, buildAllocationSummary,
} from '../../lib/moneyNeedsAllocation';

const LICENSE_OPTIONS = [
  { value: 'composite',    label: 'Composite (Life, A&H, General)' },
  { value: 'life_only',    label: 'Life & A&H' },
  { value: 'general_only', label: 'A&H & General' },
];

const num = (v) => parseFloat(v) || 0;
const LABEL = Object.fromEntries(ALLOC_LINE_META.map((m) => [m.key, m.label]));
const DRILLABLE = Object.fromEntries(ALLOC_LINE_META.map((m) => [m.key, m.drillable]));

// Rate (decimal fraction) → clean percent for DISPLAY (0.35 → 35, 0.125 → 12.5).
// Storage stays the decimal; ×100/÷100 conversion happens only at the input edge.
const ratePct = (rate) => parseFloat((num(rate) * 100).toFixed(2));

// Slider ceiling for a line — API-anchored: required ÷ rate × 1.5, floored so an
// empty plan still has a usable range. (Slider drives derived API.)
function lineCeiling(key, line, required) {
  const rate = num(line?.rate) || LINE_DEFAULT_RATES[key] || 0.1;
  if (required > 0 && rate > 0) return Math.max(Math.round((required / rate) * 1.5), 50000);
  const api = lineAPI(line);
  return api > 0 ? Math.round(api * 2) : 1000000;
}

// ── First-run license picker ────────────────────────────────────────────────
function LicensePicker({ onSelect, saving }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-card px-4 py-10 text-center"
      data-testid="alloc-license-picker"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <BarChart2 size={28} className="text-primary" />
      </div>
      <div>
        <p className="text-base font-bold text-ink">What lines are you licensed for?</p>
        <p className="mt-1 text-sm text-ink-muted">This sets which product lines you can allocate across.</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {LICENSE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            disabled={saving}
            className="h-11 min-h-[44px] rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-primary/50 hover:bg-surface-raised disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted">Your manager can update this later.</p>
    </div>
  );
}

// ── The Seam — the single saturated band joining worksheet → allocation ──────
function TheSeam({ required }) {
  return (
    <div className="relative" data-testid="alloc-seam">
      {/* vertical rule joining the worksheet above to the allocation below */}
      <div className="mx-auto h-5 w-px bg-primary/40" aria-hidden="true" />
      <div className="rounded-2xl bg-primary px-5 py-4 text-white shadow-md dark:bg-primary-dark">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">You need to earn</p>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl font-extrabold tabular-nums">{formatCurrency(required)}</span>
          <span className="text-sm font-semibold text-white/90">in 1st-year commissions</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white/95">
          Now, here&apos;s how you&apos;ll write it
          <ArrowRight size={15} aria-hidden="true" />
        </p>
      </div>
      <div className="mx-auto h-5 w-px bg-primary/40" aria-hidden="true" />
    </div>
  );
}

// ── Per-product drill drawer (Life + General) ───────────────────────────────
function ProductDrillDrawer({ lineKey, line, onProducts, onAutoBalance, onBlur }) {
  const products = line.products ?? [];
  const lineCommissionTotal = sumProductCommission(products);

  function update(i, field, value) {
    const next = products.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
    onProducts(lineKey, next);
  }
  function add() {
    if (products.length >= MAX_PRODUCTS) return;
    const seed = (PRODUCT_SEEDS[lineKey] ?? [])[products.length] ?? { name: '', rate: LINE_DEFAULT_RATES[lineKey] ?? 0.1 };
    onProducts(lineKey, [...products, { name: seed.name ?? '', commission: 0, rate: seed.rate }]);
  }
  function remove(i) {
    onProducts(lineKey, products.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2 border-t border-border bg-surface-muted px-3 py-3" data-testid={`alloc-drill-${lineKey}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {LABEL[lineKey]} products
        </span>
        <button
          type="button"
          onClick={() => onAutoBalance(lineKey)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
          data-testid={`alloc-balance-${lineKey}`}
        >
          <Scale size={13} aria-hidden="true" /> Distribute evenly
        </button>
      </div>

      {products.map((p, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-2.5 shadow-sm" data-testid={`alloc-product-${lineKey}-${i}`}>
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              value={p.name}
              onChange={(e) => update(i, 'name', e.target.value)}
              onBlur={onBlur}
              placeholder="Product name"
              aria-label={`${LABEL[lineKey]} product ${i + 1} name`}
              data-testid={`alloc-product-name-${lineKey}-${i}`}
              className="min-w-0 flex-1 rounded-md border-0 bg-surface-muted px-2 py-1.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove ${p.name || `product ${i + 1}`}`}
              className="flex h-8 min-h-[44px] w-8 min-w-[32px] items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`alloc-product-commission-${lineKey}-${i}`}>{LABEL[lineKey]} product {i + 1} commission</label>
            <span className="text-[11px] text-ink-muted">TTD</span>
            <input
              id={`alloc-product-commission-${lineKey}-${i}`}
              type="number"
              value={p.commission === 0 ? '' : p.commission}
              onChange={(e) => update(i, 'commission', e.target.value)}
              onBlur={onBlur}
              placeholder="0"
              min={0}
              step={1000}
              aria-label={`${p.name || `Product ${i + 1}`} commission`}
              data-testid={`alloc-product-commission-${lineKey}-${i}`}
              className="h-11 w-28 rounded-lg border border-border bg-surface px-2 text-right text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="text-[11px] text-ink-muted">@</span>
            <input
              type="number"
              value={p.rate === 0 ? '' : ratePct(p.rate)}
              onChange={(e) => update(i, 'rate', num(e.target.value) / 100)}
              onBlur={onBlur}
              placeholder="0"
              min={0}
              max={100}
              step={0.5}
              aria-label={`${p.name || `Product ${i + 1}`} commission rate percent`}
              data-testid={`alloc-product-rate-${lineKey}-${i}`}
              className="h-11 w-16 rounded-lg border border-border bg-surface px-2 text-right text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="text-[11px] text-ink-muted">%</span>
            <span
              className="ml-auto text-xs text-ink-muted tabular-nums"
              data-testid={`alloc-product-api-${lineKey}-${i}`}
            >
              {formatCurrency(productAPI(p))} API
            </span>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        {products.length < MAX_PRODUCTS ? (
          <button
            type="button"
            onClick={add}
            data-testid={`alloc-add-product-${lineKey}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-dashed border-primary/50 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            <Plus size={13} /> Add product
          </button>
        ) : (
          <span className="text-[11px] text-ink-muted">Max {MAX_PRODUCTS} products</span>
        )}
        <span className="text-[11px] text-ink-muted" data-testid={`alloc-product-sum-${lineKey}`}>
          Line commission <span className="font-semibold text-ink tabular-nums">{formatCurrency(lineCommissionTotal)}</span>
          <span className="text-ink-muted"> · {formatCurrency(lineAPI(line))} API</span>
        </span>
      </div>
    </div>
  );
}

// ── Allocation line row (commission-first) ───────────────────────────────────
function AllocationLineRow({ lineKey, line, required, onCommissionChange, onSliderAPIChange, onRateChange, onBlur, onToggleDrill, eligible }) {
  const drilled = isDrilled(line);
  const commission = lineCommission(line);   // canonical (Σ products when drilled)
  const api = lineAPI(line);                 // DERIVED from commission ÷ rate
  const apps = Math.round(allocApps(api));
  const effRate = effectiveLineRate(line);
  const ceiling = lineCeiling(lineKey, line, required);
  const drillable = DRILLABLE[lineKey];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm" data-testid={`alloc-line-${lineKey}`}>
      <div className="space-y-2.5 px-3 py-3">
        {/* Row 1 — label + eligibility tag + commission headline */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink">{LABEL[lineKey]}</span>
          {eligible ? (
            <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
              Counts for awards
            </span>
          ) : null}
          <span className="ml-auto text-sm font-bold text-ink tabular-nums" data-testid={`alloc-line-commission-${lineKey}`}>
            {formatCurrency(commission)}
          </span>
        </div>

        {/* Row 2 — COMMISSION number field (canonical) + API slider (derived) with
            a live API readout. Drilled → both disabled; products define the line. */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-muted">TTD</span>
            <input
              type="number"
              value={commission === 0 ? '' : commission}
              onChange={(e) => onCommissionChange(lineKey, e.target.value)}
              onBlur={onBlur}
              placeholder="0"
              min={0}
              step={1000}
              disabled={drilled}
              aria-label={`${LABEL[lineKey]} commission target`}
              data-testid={`alloc-line-commission-input-${lineKey}`}
              className="h-11 w-36 rounded-lg border border-border bg-surface px-2 text-right text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
            <span className="text-[11px] text-ink-muted">commission you want</span>
          </div>
          <input
            type="range"
            min={0}
            max={ceiling}
            step={1000}
            value={Math.min(api, ceiling)}
            onChange={(e) => onSliderAPIChange(lineKey, e.target.value)}
            onMouseUp={onBlur}
            onTouchEnd={onBlur}
            disabled={drilled}
            aria-label={`${LABEL[lineKey]} annual API`}
            data-testid={`alloc-line-slider-${lineKey}`}
            className={`h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-primary disabled:cursor-not-allowed ${eligible ? '' : '[&::-webkit-slider-thumb]:bg-ink-muted'}`}
          />
          <p className="text-[11px] text-ink-muted tabular-nums" data-testid={`alloc-line-api-label-${lineKey}`}>
            Annual API · {formatCurrency(api)}
          </p>
        </div>

        {/* Row 3 — rate (shown as %) + derived apps + drill toggle */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            Rate
            {drilled ? (
              <span className="font-semibold text-ink tabular-nums" data-testid={`alloc-line-rate-${lineKey}`}>
                {(effRate * 100).toFixed(1)}% <span className="font-normal text-ink-muted">(weighted)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5">
                <input
                  type="number"
                  value={line.rate === 0 ? '' : ratePct(line.rate)}
                  onChange={(e) => onRateChange(lineKey, e.target.value)}
                  onBlur={onBlur}
                  placeholder="0"
                  min={0}
                  max={100}
                  step={0.5}
                  aria-label={`${LABEL[lineKey]} commission rate percent`}
                  data-testid={`alloc-line-rate-${lineKey}`}
                  className="h-9 w-14 rounded-md border border-border bg-surface px-1.5 text-right text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span aria-hidden="true">%</span>
              </span>
            )}
          </span>
          <span data-testid={`alloc-line-apps-${lineKey}`}>· {apps} apps est.</span>
          {drillable && (
            <button
              type="button"
              onClick={() => onToggleDrill(lineKey)}
              aria-expanded={drilled}
              data-testid={`alloc-drill-toggle-${lineKey}`}
              className="ml-auto inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              {drilled ? 'Collapse products' : 'Break into products'}
              <ChevronDown size={13} className={`transition-transform ${drilled ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Allocated-vs-required meter ──────────────────────────────────────────────
function AllocatedMeter({ allocated, required }) {
  const pct = required > 0 ? Math.min(Math.round((allocated / required) * 100), 999) : 0;
  const met = required > 0 && allocated >= required;
  const barPct = Math.min(pct, 100);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3" data-testid="alloc-meter">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Allocated vs required</span>
        <span className={`text-sm font-bold tabular-nums ${met ? 'text-success-ink' : 'text-ink'}`} data-testid="alloc-meter-pct">
          {formatCurrency(allocated)} <span className="text-ink-muted">/ {formatCurrency(required)}</span> · {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all ${met ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${barPct}%` }}
          aria-hidden="true"
        />
      </div>
      {required > 0 && !met && (
        <p className="mt-1.5 text-[11px] text-ink-muted">
          {formatCurrency(required - allocated)} short — keep allocating to cover your need.
        </p>
      )}
    </div>
  );
}

// ── Send acknowledgement modal ───────────────────────────────────────────────
function AckModal({ onClose, onContinue, summary }) {
  const ref = useFocusTrap({ onEscape: onClose });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Target sent"
        data-testid="alloc-ack-modal"
        className="flex w-full flex-col rounded-t-2xl border border-border bg-surface-raised shadow-xl outline-none sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex flex-col items-center gap-4 px-5 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Check size={28} className="text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-ink">Target sent!</p>
            <p className="mt-1 text-sm text-ink-muted">Saved to your Commission Playground</p>
          </div>
          {summary?.length > 0 && (
            <ul className="w-full space-y-1 rounded-xl bg-surface-muted px-3 py-2 text-left text-xs text-ink-muted">
              {summary.map((s) => (
                <li key={s.label} className="flex justify-between gap-2">
                  <span>{s.label}</span>
                  <span className="font-semibold text-ink tabular-nums">{formatCurrency(s.commission)} commission</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onContinue}
            data-testid="alloc-ack-continue"
            className="flex min-h-12 items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-primary-dark"
          >
            Continue to Game Plan <ArrowRight size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Always-visible allocation summary card ───────────────────────────────────
// Mirrors the ack modal's line breakdown but adds per-product subtotals when a
// line is drilled, so the agent sees the full decomposition while allocating.
function AllocationSummaryCard({ summary }) {
  const { lines, totalCommission, totalAPI, allocatedPct, required } = summary;
  if (totalCommission === 0) {
    return (
      <div
        className="rounded-xl bg-surface-muted px-4 py-3 text-center text-sm text-ink-muted"
        data-testid="alloc-summary-card"
      >
        Allocate above to see your breakdown.
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-surface-muted px-4 py-3" data-testid="alloc-summary-card">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        Breakdown
      </p>
      <ul className="space-y-2.5 text-xs">
        {lines.filter((l) => l.commission > 0).map((line) => (
          <li key={line.key}>
            {/* Line headline — name + commission */}
            <div
              className="flex items-baseline justify-between gap-2"
              data-testid={`summary-line-${line.key}`}
            >
              <span className="font-semibold text-ink">{line.label}</span>
              <span className="font-semibold text-ink tabular-nums">{formatCurrency(line.commission)}</span>
            </div>
            {/* API · apps · effective rate */}
            <p className="text-[11px] text-ink-muted tabular-nums">
              {formatCurrency(line.api)} API · {line.apps} apps · {(line.effectiveRate * 100).toFixed(1)}%
            </p>
            {/* Per-product rows (drilled lines only) */}
            {line.products && (
              <ul className="mt-1 space-y-1 border-l-2 border-primary/20 pl-2.5 text-[11px] text-ink-muted">
                {line.products.map((p, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0"
                    data-testid={`summary-product-${line.key}-${i}`}
                  >
                    <span>{p.name || `Product ${i + 1}`}</span>
                    <span className="font-semibold text-ink tabular-nums">{formatCurrency(p.commission)}</span>
                    <span className="w-full tabular-nums">
                      {formatCurrency(p.api)} API · {(p.rate * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {/* Grand total */}
        <li
          className="flex items-baseline justify-between gap-2 border-t border-border pt-2"
          data-testid="summary-total"
        >
          <span className="font-semibold text-ink">Total</span>
          <span className="font-semibold text-ink tabular-nums">{formatCurrency(totalCommission)}</span>
        </li>
      </ul>
      <p className="mt-1 text-[11px] text-ink-muted tabular-nums">
        {formatCurrency(totalAPI)} API · {Math.round(allocatedPct * 100)}% of {formatCurrency(required)} covered
      </p>
    </div>
  );
}

// ── Main allocator ───────────────────────────────────────────────────────────
export default function MoneyNeedsAllocator({ worksheet, onOpenTab }) {
  const { tenantId, user } = useAuth();
  const uid = user?.uid;

  const [licenseProfile, setLicenseProfile] = useState(user?.licenseProfile ?? null);
  const [licenseSaving, setLicenseSaving] = useState(false);
  const [alloc, setAlloc] = useState(() => normalizeAllocation(worksheet?.allocation, worksheet, user?.licenseProfile));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showAck, setShowAck] = useState(false);
  const [ruleset, setRuleset] = useState(DEFAULT_RULESET_2026);

  const year = worksheet?.year;

  // Sync licenseProfile when the user profile resolves/changes asynchronously
  // (useAuth can deliver `user` after mount; the useState initializer runs once).
  useEffect(() => {
    if (user?.licenseProfile && !licenseProfile) setLicenseProfile(user.licenseProfile);
  }, [user?.licenseProfile, licenseProfile]);

  // Re-seed when the worksheet identity OR the license profile changes. Returning
  // agents keep their stored allocation (normalizeAllocation merges it); a first-run
  // license pick re-seeds with the correct licenseClass/visible lines. The `worksheet`
  // OBJECT is intentionally excluded — the parent recreates it on every expense edit,
  // and re-seeding then would wipe in-progress allocation edits. Only year /
  // persisted-allocation / license are meaningful re-seed triggers.
  useEffect(() => {
    setAlloc(normalizeAllocation(worksheet?.allocation, worksheet, licenseProfile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheet?.year, worksheet?.allocation, licenseProfile]);

  // Real awards ruleset (graceful fallback to bundled default). Read-only path
  // already in prod use (AgentDashboard / YearPlanModal) — no rules change.
  useEffect(() => {
    if (!tenantId) return undefined;
    let alive = true;
    getMergedAwardsRuleset(tenantId, year ?? new Date().getFullYear())
      .then((r) => { if (alive && r) setRuleset(r); })
      .catch(() => { /* keep DEFAULT_RULESET_2026 */ });
    return () => { alive = false; };
  }, [tenantId, year]);

  const renewalTotal = num(worksheet?.estimatedRenewalIncome?.total);
  const required = Math.max(0, num(worksheet?.totalAnnualPreTax) - renewalTotal);
  const visibleKeys = useMemo(() => visibleLineKeys(licenseProfile), [licenseProfile]);
  const allocatedCommission = totalAllocatedCommission(alloc.lines, visibleKeys);

  const persist = useCallback(async (next) => {
    if (!tenantId || !uid || !year) return;
    setSaving(true); setSaveError('');
    try {
      await saveAllocation(tenantId, uid, year, next);
    } catch {
      setSaveError('Save failed — check connection.');
    } finally {
      setSaving(false);
    }
  }, [tenantId, uid, year]);

  // ── License first-run ───────────────────────────────────────────────────
  // setLicenseProfile triggers the re-seed effect above (which sets licenseClass +
  // visible lines) — no manual setAlloc needed here.
  async function handleLicenseSelect(profile) {
    setLicenseSaving(true);
    try {
      await updateUserProfile(tenantId, uid, { licenseProfile: profile });
      setLicenseProfile(profile);
    } catch {
      setSaveError('Could not save your license. Check your connection.');
    } finally {
      setLicenseSaving(false);
    }
  }

  // ── Line edits (commission-canonical) ────────────────────────────────────
  // Number field: commission is the canonical value the agent types. Clamp to
  // [0, required] (you can't need more commission than your need).
  function setLineCommission(key, value) {
    const clamped = Math.max(0, Math.min(num(value), required));
    setAlloc((prev) => ({ ...prev, lines: { ...prev.lines, [key]: { ...prev.lines[key], commission: clamped } } }));
  }
  // Slider drives API → derive commission = api × rate, store the commission.
  function setSliderAPI(key, value) {
    setAlloc((prev) => {
      const line = prev.lines[key];
      const commission = num(value) * num(line.rate);
      return { ...prev, lines: { ...prev.lines, [key]: { ...line, commission } } };
    });
  }
  // Rate change KEEPS commission fixed and re-derives API (API is derived from
  // commission ÷ rate, so just storing the new rate re-derives it). Value is the
  // percent typed → ÷100 to the stored decimal (single 0–100 boundary at the edge).
  function setLineRate(key, value) {
    const rate = num(value) / 100;
    setAlloc((prev) => ({ ...prev, lines: { ...prev.lines, [key]: { ...prev.lines[key], rate } } }));
  }

  // Pure compute-then-set-then-persist (no side-effect inside the updater, so
  // StrictMode / concurrent double-invocation can't double-fire the write).
  function toggleDrill(key) {
    const line = alloc.lines[key];
    const next = { ...line };
    if (isDrilled(line)) {
      // Collapse: keep the line commission = current product commission sum.
      next.drilled = false;
      next.commission = sumProductCommission(line.products);
    } else {
      // Drill: seed products and evenly distribute the line commission across them.
      const seeds = (line.products && line.products.length > 0)
        ? line.products
        : (PRODUCT_SEEDS[key] ?? []).map((p) => ({ name: p.name, commission: 0, rate: p.rate }));
      next.products = autoBalanceProducts(seeds, line.commission);
      next.drilled = true;
      next.commission = sumProductCommission(next.products);
    }
    const out = { ...alloc, lines: { ...alloc.lines, [key]: next } };
    setAlloc(out);
    persist(out);
  }

  function setProducts(key, products) {
    setAlloc((prev) => {
      const capped = products.slice(0, MAX_PRODUCTS).map((p) => ({ name: p.name ?? '', commission: num(p.commission), rate: num(p.rate) }));
      const line = { ...prev.lines[key], products: capped, drilled: true, commission: sumProductCommission(capped) };
      return { ...prev, lines: { ...prev.lines, [key]: line } };
    });
  }
  function autoBalance(key) {
    const line = alloc.lines[key];
    const balanced = autoBalanceProducts(line.products, line.commission);
    const out = { ...alloc, lines: { ...alloc.lines, [key]: { ...line, products: balanced, commission: sumProductCommission(balanced) } } };
    setAlloc(out);
    persist(out);
  }

  // Keep a ref to the latest alloc so a blur firing before the onChange re-render
  // still persists the freshest values (avoids reverting the last keystroke).
  const allocRef = useRef(alloc);
  useEffect(() => { allocRef.current = alloc; }, [alloc]);
  const handleBlur = useCallback(() => { persist(allocRef.current); }, [persist]);

  // ── Send → confirm → ack → tab ──────────────────────────────────────────
  function handleSend() {
    const lifeLine = alloc.lines.life ?? {};
    const generalLine = alloc.lines.general ?? {};
    // Products carry commission (canonical) + derived API.
    const productRows = (line) => (isDrilled(line)
      ? (line.products ?? []).map((p) => ({ name: p.name, commission: num(p.commission), api: productAPI(p) }))
      : []);
    // Extend the existing #738 payload — value + preTaxAlreadyApplied preserved so
    // the Playground reader (which ignores unknown keys) is unaffected. API is derived.
    const payload = {
      value: required,
      preTaxAlreadyApplied: true,
      allocation: {
        licenseClass: licenseProfile,
        lines: visibleKeys.reduce((acc, k) => {
          const line = alloc.lines[k] ?? {};
          acc[k] = { commission: lineCommission(line), api: lineAPI(line) };
          if (DRILLABLE[k]) acc[k].products = productRows(line);
          return acc;
        }, {}),
        life: { commission: lineCommission(lifeLine), api: lineAPI(lifeLine), products: productRows(lifeLine) },
        general: { commission: lineCommission(generalLine), api: lineAPI(generalLine), products: productRows(generalLine) },
      },
    };
    localStorage.setItem(PLAYGROUND_INCOME_GOAL_KEY, JSON.stringify(payload));
    persist(alloc);
    setShowAck(true);
  }

  // Single derivation shared by AllocationSummaryCard (always visible) and
  // AckModal (shown on Send). AckModal renders the line-level subset only.
  const allocSummary = buildAllocationSummary(alloc, visibleKeys, required);
  const ackLines = allocSummary.lines
    .filter((l) => l.commission > 0)
    .map((l) => ({ label: l.label, commission: l.commission }));

  // ── Render ──────────────────────────────────────────────────────────────
  if (!licenseProfile) {
    return <LicensePicker onSelect={handleLicenseSelect} saving={licenseSaving} />;
  }

  // honest-data: no commission need yet → guide back to the worksheet.
  if (required <= 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center" data-testid="alloc-no-need">
        <p className="text-sm font-semibold text-ink">No commission target yet</p>
        <p className="mt-1 text-sm text-ink-muted">Fill in your worksheet above to see how much you&apos;ll need to write.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="merged-allocator">
      <TheSeam required={required} />

      {saveError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          <AlertCircle size={12} className="shrink-0" /><span>{saveError}</span>
        </div>
      )}

      <div className="space-y-2">
        {visibleKeys.map((key) => {
          const eligible = key === 'life'; // positive-only: only Life counts for awards
          return (
            <div key={key}>
              <AllocationLineRow
                lineKey={key}
                line={alloc.lines[key]}
                required={required}
                onCommissionChange={setLineCommission}
                onSliderAPIChange={setSliderAPI}
                onRateChange={setLineRate}
                onBlur={handleBlur}
                onToggleDrill={toggleDrill}
                eligible={eligible}
              />
              {DRILLABLE[key] && isDrilled(alloc.lines[key]) && (
                <ProductDrillDrawer
                  lineKey={key}
                  line={alloc.lines[key]}
                  onProducts={setProducts}
                  onAutoBalance={autoBalance}
                  onBlur={handleBlur}
                />
              )}
            </div>
          );
        })}
      </div>

      <AllocatedMeter allocated={allocatedCommission} required={required} />

      {/* Award strip — Life API only (derived from commission ÷ rate), real ruleset tiers. */}
      <AwardProjectionStrip
        lines={{ life: { targetAPI: lineAPI(alloc.lines.life ?? {}) } }}
        agentProfile={{
          monthsInIndustry: user?.monthsInIndustry,
          monthsAtTatil: user?.monthsAtTatil,
          isBdoDso: user?.isBdoDso,
        }}
        ruleset={ruleset}
      />

      <AllocationSummaryCard summary={allocSummary} />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSend}
          disabled={saving || allocatedCommission <= 0}
          data-testid="alloc-send-btn"
          className="flex h-11 min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50 dark:bg-primary-dark"
        >
          <Send size={14} /> Send to Game Plan
        </button>
        {saving && <Loader2 size={14} className="animate-spin text-ink-muted" />}
      </div>

      {showAck && (
        <AckModal
          onClose={() => setShowAck(false)}
          onContinue={() => { setShowAck(false); onOpenTab?.('game-plan'); }}
          summary={ackLines}
        />
      )}
    </div>
  );
}
