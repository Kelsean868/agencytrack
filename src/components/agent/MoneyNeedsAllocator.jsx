import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  visibleLineKeys, allocApps, isDrilled, lineCommission, effectiveLineRate,
  totalAllocatedCommission, normalizeAllocation,
  autoBalanceProducts, sumProductAPI,
} from '../../lib/moneyNeedsAllocation';

const LICENSE_OPTIONS = [
  { value: 'composite',    label: 'Composite (Life, A&H, General)' },
  { value: 'life_only',    label: 'Life & A&H' },
  { value: 'general_only', label: 'A&H & General' },
];

const num = (v) => parseFloat(v) || 0;
const LABEL = Object.fromEntries(ALLOC_LINE_META.map((m) => [m.key, m.label]));
const DRILLABLE = Object.fromEntries(ALLOC_LINE_META.map((m) => [m.key, m.drillable]));

// Slider ceiling for a line — required ÷ rate × 1.5, floored so an empty plan
// still has a usable range. Mirrors the brief's two-way ceiling rule.
function lineCeiling(key, line, required) {
  const rate = num(line?.rate) || LINE_DEFAULT_RATES[key] || 0.1;
  if (required > 0 && rate > 0) return Math.max(Math.round((required / rate) * 1.5), 50000);
  const api = num(line?.api);
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
  const lineTotal = sumProductAPI(products);

  function update(i, field, value) {
    const next = products.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
    onProducts(lineKey, next);
  }
  function add() {
    if (products.length >= MAX_PRODUCTS) return;
    const seed = (PRODUCT_SEEDS[lineKey] ?? [])[products.length] ?? { name: '', rate: LINE_DEFAULT_RATES[lineKey] ?? 0.1 };
    onProducts(lineKey, [...products, { name: seed.name ?? '', api: 0, rate: seed.rate }]);
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
            <label className="sr-only" htmlFor={`alloc-product-api-${lineKey}-${i}`}>{LABEL[lineKey]} product {i + 1} API</label>
            <input
              id={`alloc-product-api-${lineKey}-${i}`}
              type="number"
              value={p.api === 0 ? '' : p.api}
              onChange={(e) => update(i, 'api', e.target.value)}
              onBlur={onBlur}
              placeholder="0"
              min={0}
              step={1000}
              aria-label={`${p.name || `Product ${i + 1}`} API`}
              data-testid={`alloc-product-api-${lineKey}-${i}`}
              className="h-11 w-28 rounded-lg border border-border bg-surface px-2 text-right text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="text-[11px] text-ink-muted">API ×</span>
            <input
              type="number"
              value={p.rate === 0 ? '' : p.rate}
              onChange={(e) => update(i, 'rate', e.target.value)}
              onBlur={onBlur}
              placeholder="0"
              min={0}
              max={1}
              step={0.005}
              aria-label={`${p.name || `Product ${i + 1}`} commission rate`}
              data-testid={`alloc-product-rate-${lineKey}-${i}`}
              className="h-11 w-20 rounded-lg border border-border bg-surface px-2 text-right text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="ml-auto text-xs font-semibold text-ink tabular-nums">
              {formatCurrency(num(p.api) * num(p.rate))}
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
          Line total <span className="font-semibold text-ink tabular-nums">{formatCurrency(lineTotal)}</span>
        </span>
      </div>
    </div>
  );
}

// ── Allocation line row ──────────────────────────────────────────────────────
function AllocationLineRow({ lineKey, line, required, onAPIChange, onRateChange, onBlur, onToggleDrill, eligible }) {
  const drilled = isDrilled(line);
  const api = num(line.api);
  const commission = lineCommission(line);
  const apps = Math.round(allocApps(api));
  const effRate = effectiveLineRate(line);
  const ceiling = lineCeiling(lineKey, line, required);
  const drillable = DRILLABLE[lineKey];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm" data-testid={`alloc-line-${lineKey}`}>
      <div className="space-y-2.5 px-3 py-3">
        {/* Row 1 — label + eligibility tag + commission */}
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

        {/* Row 2 — slider + TTD field (two-way). Collapsed only; drilled total is
            derived from products (read-only here, edited in the drawer). */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={ceiling}
            step={1000}
            value={Math.min(api, ceiling)}
            onChange={(e) => onAPIChange(lineKey, e.target.value)}
            onMouseUp={onBlur}
            onTouchEnd={onBlur}
            disabled={drilled}
            aria-label={`${LABEL[lineKey]} API`}
            data-testid={`alloc-line-slider-${lineKey}`}
            className={`h-2 flex-1 cursor-pointer appearance-none rounded-full bg-surface-muted accent-primary disabled:cursor-not-allowed ${eligible ? '' : '[&::-webkit-slider-thumb]:bg-ink-muted'}`}
          />
          <input
            type="number"
            value={api === 0 ? '' : api}
            onChange={(e) => onAPIChange(lineKey, e.target.value)}
            onBlur={onBlur}
            placeholder="0"
            min={0}
            step={1000}
            disabled={drilled}
            aria-label={`${LABEL[lineKey]} annual API`}
            data-testid={`alloc-line-api-${lineKey}`}
            className="h-11 w-32 rounded-lg border border-border bg-surface px-2 text-right text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
        </div>

        {/* Row 3 — rate + derived apps + drill toggle */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            Rate
            {drilled ? (
              <span className="font-semibold text-ink tabular-nums" data-testid={`alloc-line-rate-${lineKey}`}>
                {(effRate * 100).toFixed(1)}% <span className="font-normal text-ink-muted">(weighted)</span>
              </span>
            ) : (
              <input
                type="number"
                value={line.rate === 0 ? '' : line.rate}
                onChange={(e) => onRateChange(lineKey, e.target.value)}
                onBlur={onBlur}
                placeholder="0"
                min={0}
                max={1}
                step={0.005}
                aria-label={`${LABEL[lineKey]} commission rate`}
                data-testid={`alloc-line-rate-${lineKey}`}
                className="h-9 w-16 rounded-md border border-border bg-surface px-1.5 text-right text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
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
                  <span className="font-semibold text-ink tabular-nums">{formatCurrency(s.api)} API</span>
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

  // Re-seed when the worksheet identity changes (year switch / fresh load).
  useEffect(() => {
    setAlloc(normalizeAllocation(worksheet?.allocation, worksheet, licenseProfile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheet?.year, worksheet?.allocation]);

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
  async function handleLicenseSelect(profile) {
    setLicenseSaving(true);
    try {
      await updateUserProfile(tenantId, uid, { licenseProfile: profile });
      setLicenseProfile(profile);
      setAlloc((prev) => ({ ...prev, licenseClass: profile }));
    } catch {
      setSaveError('Could not save your license. Check your connection.');
    } finally {
      setLicenseSaving(false);
    }
  }

  // ── Line edits ──────────────────────────────────────────────────────────
  function setLineAPI(key, value) {
    setAlloc((prev) => ({ ...prev, lines: { ...prev.lines, [key]: { ...prev.lines[key], api: num(value) } } }));
  }
  function setLineRate(key, value) {
    setAlloc((prev) => ({ ...prev, lines: { ...prev.lines, [key]: { ...prev.lines[key], rate: num(value) } } }));
  }

  function toggleDrill(key) {
    setAlloc((prev) => {
      const line = prev.lines[key];
      const next = { ...line };
      if (isDrilled(line)) {
        // Collapse: keep the line total = current product sum.
        next.drilled = false;
        next.api = sumProductAPI(line.products);
      } else {
        // Drill: seed products to evenly sum to the current line total.
        const seeds = (line.products && line.products.length > 0)
          ? line.products
          : (PRODUCT_SEEDS[key] ?? []).map((p) => ({ name: p.name, api: 0, rate: p.rate }));
        next.products = autoBalanceProducts(seeds, line.api);
        next.drilled = true;
        next.api = sumProductAPI(next.products);
      }
      const out = { ...prev, lines: { ...prev.lines, [key]: next } };
      persist(out);
      return out;
    });
  }

  function setProducts(key, products) {
    setAlloc((prev) => {
      const capped = products.slice(0, MAX_PRODUCTS).map((p) => ({ name: p.name ?? '', api: num(p.api), rate: num(p.rate) }));
      const line = { ...prev.lines[key], products: capped, drilled: true, api: sumProductAPI(capped) };
      return { ...prev, lines: { ...prev.lines, [key]: line } };
    });
  }
  function autoBalance(key) {
    setAlloc((prev) => {
      const line = prev.lines[key];
      const balanced = autoBalanceProducts(line.products, line.api);
      const out = { ...prev, lines: { ...prev.lines, [key]: { ...line, products: balanced } } };
      persist(out);
      return out;
    });
  }

  const handleBlur = useCallback(() => { persist(alloc); }, [persist, alloc]);

  // ── Send → confirm → ack → tab ──────────────────────────────────────────
  function handleSend() {
    const lifeLine = alloc.lines.life ?? {};
    const generalLine = alloc.lines.general ?? {};
    const productAPIs = (line) => (isDrilled(line) ? (line.products ?? []).map((p) => ({ name: p.name, api: num(p.api) })) : []);
    // Extend the existing #738 payload — value + preTaxAlreadyApplied preserved so
    // the Playground reader (which ignores unknown keys) is unaffected.
    const payload = {
      value: required,
      preTaxAlreadyApplied: true,
      allocation: {
        licenseClass: licenseProfile,
        lines: visibleKeys.reduce((acc, k) => {
          const line = alloc.lines[k] ?? {};
          acc[k] = { api: num(line.api), commission: lineCommission(line) };
          if (DRILLABLE[k]) acc[k].products = productAPIs(line);
          return acc;
        }, {}),
        life: { api: num(lifeLine.api), products: productAPIs(lifeLine) },
        general: { api: num(generalLine.api), products: productAPIs(generalLine) },
      },
    };
    localStorage.setItem(PLAYGROUND_INCOME_GOAL_KEY, JSON.stringify(payload));
    persist(alloc);
    setShowAck(true);
  }

  const ackSummary = visibleKeys
    .map((k) => ({ label: LABEL[k], api: num(alloc.lines[k]?.api) }))
    .filter((s) => s.api > 0);

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
                onAPIChange={setLineAPI}
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

      {/* Award strip — Life API only, real ruleset tiers. */}
      <AwardProjectionStrip
        lines={{ life: { targetAPI: num(alloc.lines.life?.api) } }}
        agentProfile={{
          monthsInIndustry: user?.monthsInIndustry,
          monthsAtTatil: user?.monthsAtTatil,
          isBdoDso: user?.isBdoDso,
        }}
        ruleset={ruleset}
      />

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
          summary={ackSummary}
        />
      )}
    </div>
  );
}
