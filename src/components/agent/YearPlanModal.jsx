import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle, BarChart2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getYearPlan, saveYearPlan,
  LICENSE_PROFILES,
} from '../../services/yearPlanService';
import { updateUserProfile } from '../../services/userService';
import { formatCurrency } from '../../utils/formatters';
import {
  applyGating,
  seedFromTargets,
  recomputePct,
  applyPctToLines,
  absorbRounding,
  blankLines,
  enrichLines,
  totalEnabledAPI,
} from '../../lib/yearPlanAllocation';
import { DEFAULT_DECOMPOSITION_INPUTS } from '../../utils/goalDecomposition';
import AwardProjectionStrip from './AwardProjectionStrip';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';
import useFocusTrap from '../../hooks/useFocusTrap';

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_AVG_POLICY = DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI;

const LINE_META = [
  { key: 'life',     label: 'Life'     },
  { key: 'ah',       label: 'A&H'      },
  { key: 'property', label: 'Property' },
  { key: 'motor',    label: 'Motor'    },
];

const PROFILE_LABELS = {
  composite:    'Composite (Life, A&H, Property & Motor)',
  life_only:    'Life & A&H',
  general_only: 'A&H, Property & Motor',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDisplayLines(rawLines, commissionRate, avgPolicyAPI) {
  return enrichLines(rawLines, commissionRate, avgPolicyAPI);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileChip({ profile, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border bg-surface-raised text-xs font-semibold text-ink-muted hover:text-ink hover:border-primary/40 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {PROFILE_LABELS[profile] ?? 'Composite'}
        <span className="text-[10px] opacity-60">▾</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-10 rounded-xl border border-border bg-surface shadow-lg py-1 min-w-[200px]"
          role="listbox"
        >
          {LICENSE_PROFILES.map((p) => (
            <button
              key={p}
              type="button"
              role="option"
              aria-selected={p === profile}
              onClick={() => { onChange(p); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-raised transition-colors ${
                p === profile ? 'text-primary font-semibold' : 'text-ink'
              }`}
            >
              {PROFILE_LABELS[p]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AllocModeToggle({ mode, onChange }) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-surface-raised self-start">
      {['percent', 'direct'].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors min-h-[32px] ${
            mode === m
              ? 'bg-primary dark:bg-primary-dark text-white shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {m === 'percent' ? '% Share' : 'Direct $'}
        </button>
      ))}
    </div>
  );
}

function LineRow({ lineKey, label, line, mode, onAPIChange, onPctChange, disabled }) {
  const enabled = line?.enabled !== false;
  const api = parseFloat(line?.targetAPI) || 0;
  const pct = parseFloat(line?.pct) || 0;

  const rowClass = enabled
    ? 'grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2 border-b border-border last:border-0'
    : 'grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2 border-b border-border last:border-0 opacity-40';

  return (
    <div className={rowClass} aria-disabled={!enabled}>
      <span className="text-sm font-semibold text-ink">{label}</span>

      {mode === 'percent' ? (
        <input
          type="number"
          value={enabled && pct ? pct : ''}
          onChange={(e) => enabled && onPctChange(lineKey, e.target.value)}
          placeholder="0"
          min={0}
          max={100}
          step={0.01}
          disabled={!enabled || disabled}
          aria-label={`${label} share percent`}
          className="w-20 h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink text-right focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed"
        />
      ) : (
        <input
          type="number"
          value={enabled && api ? api : ''}
          onChange={(e) => enabled && onAPIChange(lineKey, e.target.value)}
          placeholder="0"
          min={0}
          step={1000}
          disabled={!enabled || disabled}
          aria-label={`${label} annual API`}
          className="w-32 h-11 px-2 rounded-lg border border-border bg-surface text-sm text-ink text-right focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed"
        />
      )}

      <span className="text-xs text-ink-muted text-right tabular-nums w-24">
        {enabled ? formatCurrency(api) : '—'}
      </span>

      <div className="text-right min-w-[80px]">
        {enabled && line?.seeded && (
          <span className="inline-block px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
            Seeded {formatCurrency(line.seedSource ?? 0)}
          </span>
        )}
        {enabled && !line?.seeded && (
          <span className="text-[10px] text-ink-muted">No seed</span>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ lines, firstYearCommissionsRequired, commissionRate, avgPolicyAPI = null }) {
  const totalAPI = totalEnabledAPI(lines);
  const avg = parseFloat(avgPolicyAPI) || DEFAULT_AVG_POLICY;
  const totalApps = avg > 0 ? totalAPI / avg : 0;
  const totalComm = totalAPI * ((parseFloat(commissionRate) || 35) / 100);
  const required = parseFloat(firstYearCommissionsRequired) || 0;
  const meetNeed = required > 0 && totalComm >= required;

  return (
    <div className="rounded-xl border border-border bg-surface-raised px-4 py-4 space-y-3">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Year Plan Summary</p>

      <div className="flex justify-between text-sm">
        <span className="text-ink-muted">Total Annual API</span>
        <span className="font-bold text-ink tabular-nums">{formatCurrency(totalAPI)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-ink-muted">Implied Applications</span>
        <span className="font-semibold text-ink tabular-nums">{Math.round(totalApps)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-ink-muted">Implied Commission ({commissionRate ?? 35}%)</span>
        <span className="font-semibold text-ink tabular-nums">{formatCurrency(totalComm)}</span>
      </div>

      {required > 0 && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border ${
          meetNeed
            ? 'border-success/30 bg-success/10 text-success-ink'
            : 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 text-amber-800 dark:text-amber-200'
        }`}>
          <span>{meetNeed ? '✓' : '!'}</span>
          <span>
            {meetNeed
              ? 'Meets your Money Needs target'
              : `${formatCurrency(required - totalComm)} short of Money Needs target`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── First-run profile prompt ──────────────────────────────────────────────────

function ProfilePrompt({ onSelect, saving }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-5 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <BarChart2 size={28} className="text-primary" />
      </div>
      <div>
        <p className="font-bold text-ink text-base">What lines are you licensed for?</p>
        <p className="text-sm text-ink-muted mt-1">
          This sets which product lines appear in your Year Plan.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {LICENSE_PROFILES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            disabled={saving}
            className="h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-ink hover:border-primary/50 hover:bg-surface-raised transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {PROFILE_LABELS[p]}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted">Your manager can update this later.</p>
    </div>
  );
}

// ── No-seed edge state ────────────────────────────────────────────────────────

function NoSeedState({ onDismiss }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
        <AlertCircle size={28} className="text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <p className="font-bold text-ink text-base">No Money Needs targets yet</p>
        <p className="text-sm text-ink-muted mt-1">
          Complete Money Needs (Step 1) to seed your plan, or start entering figures directly.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="h-11 px-5 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 transition-colors min-h-[44px]"
      >
        Enter from scratch
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function YearPlanModal({ onClose, onAfterSave, moneyNeedsWorksheet, avgPolicyAPI = null }) {
  const { tenantId, user } = useAuth();
  const uid = user?.uid;
  const commissionRate = parseFloat(user?.commissionRate) || 35;
  const year = CURRENT_YEAR;

  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('loading'); // loading | profile-prompt | no-seed | allocating
  const [licenseProfile, setLicenseProfile] = useState('composite');
  const [lines, setLines] = useState(blankLines());
  const [mode, setMode] = useState('percent'); // percent | direct
  const [totalAPI, setTotalAPI] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const modalRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving || profileSaving });

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!tenantId || !uid) return;
    setPhase('loading');
    setSaveError('');
    try {
      const profile = user?.licenseProfile;
      const needsProfilePrompt = !LICENSE_PROFILES.includes(profile);

      if (needsProfilePrompt) {
        setPhase('profile-prompt');
        return;
      }

      setLicenseProfile(profile);

      const existing = await getYearPlan(tenantId, uid, year);
      const targets = moneyNeedsWorksheet?.firstYearCommissionsTargets;
      const hasTargets = targets && Object.values(targets).some((v) => parseFloat(v) > 0);

      let initialLines;
      if (existing?.lines) {
        // Reload from existing plan.
        initialLines = applyGating(existing.lines, profile);
      } else if (hasTargets) {
        // Seed from Money Needs targets.
        const seeded = seedFromTargets(targets, commissionRate);
        const merged = {};
        for (const k of Object.keys(blankLines())) {
          merged[k] = { ...blankLines()[k], ...seeded[k] };
        }
        initialLines = applyGating(merged, profile);
      } else {
        // No seed and no existing plan — show no-seed state (user can dismiss to scratch).
        const scratch = applyGating(blankLines(), profile);
        setLines(buildDisplayLines(scratch, commissionRate, avgPolicyAPI ?? DEFAULT_AVG_POLICY));
        setTotalAPI(0);
        setPhase('no-seed');
        return;
      }

      const enriched = buildDisplayLines(initialLines, commissionRate, avgPolicyAPI ?? DEFAULT_AVG_POLICY);
      const computed = recomputePct(enriched);
      setLines(computed);
      setTotalAPI(totalEnabledAPI(computed));
      setPhase('allocating');
    } catch {
      setSaveError('Could not load your Year Plan. Check your connection.');
      setPhase('allocating');
    }
  }, [tenantId, uid, year, user, moneyNeedsWorksheet, commissionRate, avgPolicyAPI]);

  useEffect(() => { load(); }, [load]);

  // ── Profile selection (first-run) ─────────────────────────────────────────
  async function handleProfileSelect(profile) {
    setProfileSaving(true);
    try {
      await updateUserProfile(tenantId, uid, { licenseProfile: profile });
      setLicenseProfile(profile);
      const targets = moneyNeedsWorksheet?.firstYearCommissionsTargets;
      const hasTargets = targets && Object.values(targets).some((v) => parseFloat(v) > 0);
      let initialLines;
      if (hasTargets) {
        const seeded = seedFromTargets(targets, commissionRate);
        const merged = Object.fromEntries(
          Object.keys(blankLines()).map((k) => [k, { ...blankLines()[k], ...seeded[k] }]),
        );
        initialLines = applyGating(merged, profile);
      } else {
        initialLines = applyGating(blankLines(), profile);
      }
      const enriched = buildDisplayLines(initialLines, commissionRate, avgPolicyAPI ?? DEFAULT_AVG_POLICY);
      const computed = recomputePct(enriched);
      setLines(computed);
      setTotalAPI(totalEnabledAPI(computed));
      setPhase(hasTargets ? 'allocating' : 'no-seed');
    } catch {
      setSaveError('Could not save your license profile. Check your connection.');
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Profile change mid-session ────────────────────────────────────────────
  async function handleProfileChange(profile) {
    setLicenseProfile(profile);
    const regated = applyGating(lines, profile);
    const enriched = buildDisplayLines(regated, commissionRate, avgPolicyAPI ?? DEFAULT_AVG_POLICY);
    const computed = recomputePct(enriched);
    setLines(computed);
    setTotalAPI(totalEnabledAPI(computed));
    try {
      await updateUserProfile(tenantId, uid, { licenseProfile: profile });
    } catch {
      // Non-blocking — the allocator still works with the local change.
    }
  }

  // ── Direct mode: API field change ─────────────────────────────────────────
  function handleAPIChange(key, value) {
    const api = parseFloat(value) || 0;
    const updated = {
      ...lines,
      [key]: { ...lines[key], targetAPI: api },
    };
    const enriched = buildDisplayLines(updated, commissionRate, avgPolicyAPI ?? DEFAULT_AVG_POLICY);
    const withPct = recomputePct(enriched);
    setLines(withPct);
    setTotalAPI(totalEnabledAPI(withPct));
  }

  // ── Percent mode: pct field change (absorb rounding) ─────────────────────
  function handlePctChange(key, value) {
    const enabledKeys = Object.keys(lines).filter((k) => lines[k]?.enabled);
    const currentPcts = Object.fromEntries(enabledKeys.map((k) => [k, lines[k]?.pct ?? 0]));
    const newPcts = absorbRounding(currentPcts, key, value, enabledKeys);

    const updatedLines = { ...lines };
    for (const k of enabledKeys) {
      updatedLines[k] = { ...lines[k], pct: newPcts[k] ?? 0 };
    }

    const withAPI = applyPctToLines(updatedLines, totalAPI);
    const enriched = buildDisplayLines(withAPI, commissionRate, avgPolicyAPI ?? DEFAULT_AVG_POLICY);
    setLines(enriched);
  }

  // ── Percent mode: total API field change ──────────────────────────────────
  function handleTotalAPIChange(value) {
    const total = parseFloat(value) || 0;
    setTotalAPI(total);
    const withAPI = applyPctToLines(lines, total);
    const enriched = buildDisplayLines(withAPI, commissionRate, avgPolicyAPI ?? DEFAULT_AVG_POLICY);
    setLines(enriched);
  }

  // ── Mode toggle ───────────────────────────────────────────────────────────
  function handleModeSwitch(newMode) {
    if (newMode === mode) return;
    if (newMode === 'percent') {
      // Direct → %: set totalAPI = Σ enabled, recompute pcts. targetAPI unchanged.
      const sum = totalEnabledAPI(lines);
      setTotalAPI(sum);
      setLines(recomputePct(lines));
    }
    // % → Direct: targetAPI is already current (applyPctToLines kept it live).
    // Just switch the display mode. No money changes.
    setMode(newMode);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      await saveYearPlan(tenantId, uid, year, lines, licenseProfile);
      onClose();
      onAfterSave?.();
    } catch {
      setSaveError('Save failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Year Plan — Step 2 of 4"
    >
      <div ref={modalRef} className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-3xl border border-border flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink-muted">STEP 2 OF 4</span>
              <span className="px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wide">Draft</span>
            </div>
            <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Year Plan</h2>
            <p className="text-sm text-ink-muted">Allocate your {year} API target across product lines.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {phase === 'allocating' && (
              <ProfileChip profile={licenseProfile} onChange={handleProfileChange} />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Year Plan"
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors min-h-[44px] min-w-[32px]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {phase === 'loading' && (
            <div className="flex items-center justify-center py-16 text-ink-muted">
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}

          {phase === 'profile-prompt' && (
            <ProfilePrompt onSelect={handleProfileSelect} saving={profileSaving} />
          )}

          {phase === 'no-seed' && (
            <NoSeedState onDismiss={() => setPhase('allocating')} />
          )}

          {phase === 'allocating' && (
            <div className="space-y-5">
              {saveError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Seed info bar */}
              {Object.values(lines).some((l) => l?.seeded) && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
                  <p className="text-xs text-ink-muted">
                    <span className="font-semibold text-ink">Seeded from Money Needs</span> — figures are converted from your commission targets at {commissionRate}% rate. Adjust as needed.
                  </p>
                </div>
              )}

              {/* Mode toggle + total (percent mode) */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <AllocModeToggle mode={mode} onChange={handleModeSwitch} />
                {mode === 'percent' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-muted font-medium">Total Annual API</span>
                    <input
                      type="number"
                      value={totalAPI || ''}
                      onChange={(e) => handleTotalAPIChange(e.target.value)}
                      placeholder="0"
                      min={0}
                      step={10000}
                      aria-label="Total annual API"
                      className="w-36 h-11 px-3 rounded-xl border border-border bg-surface text-sm text-ink text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}
              </div>

              {/* Allocator rows */}
              <div className="rounded-xl border border-border bg-card px-4 py-2">
                <div className="grid grid-cols-[1fr_auto_auto_auto] pb-1.5 border-b border-border mb-1">
                  <span className="text-xs font-semibold text-ink-muted">Line</span>
                  <span className="text-xs font-semibold text-ink-muted text-right w-20">{mode === 'percent' ? '% Share' : 'API (TTD)'}</span>
                  <span className="text-xs font-semibold text-ink-muted text-right w-24">Annual API</span>
                  <span className="text-xs font-semibold text-ink-muted text-right min-w-[80px]">Seed</span>
                </div>
                {LINE_META.map(({ key, label }) => (
                  <LineRow
                    key={key}
                    lineKey={key}
                    label={label}
                    line={lines[key]}
                    mode={mode}
                    onAPIChange={handleAPIChange}
                    onPctChange={handlePctChange}
                    disabled={saving}
                  />
                ))}
              </div>

              {/* Summary card */}
              <SummaryCard
                lines={lines}
                firstYearCommissionsRequired={moneyNeedsWorksheet?.firstYearCommissionsRequired}
                commissionRate={commissionRate}
                avgPolicyAPI={avgPolicyAPI}
              />

              {/* Award projection strip */}
              <AwardProjectionStrip
                lines={lines}
                agentProfile={{
                  monthsInIndustry: user?.monthsInIndustry,
                  monthsAtTatil:    user?.monthsAtTatil,
                  isBdoDso:         user?.isBdoDso,
                }}
                ruleset={DEFAULT_RULESET_2026}
                avgPolicyAPI={avgPolicyAPI}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === 'allocating') && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:text-ink hover:border-primary/40 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 h-11 px-6 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 min-h-[44px]"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              Save draft
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
