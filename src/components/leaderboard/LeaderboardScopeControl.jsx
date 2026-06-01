/**
 * LeaderboardScopeControl — role-gated scope toggle for the leaderboard.
 *
 * Role gating (the brief's locked decision):
 *   - agent           → renders NOTHING (returns null)
 *   - unit_manager    → segmented control: [Users] My Unit / [Building2] My Branch
 *                       (My Unit selects unitId == viewer's OWN uid — per
 *                       P5-prep, a UM's agents carry unitId == UM uid)
 *   - branch_manager  → segmented control: [Building2] My Branch + unit-picker
 *                       (options derived from the loaded branch entries —
 *                       no extra fetch)
 *   - sales_manager,
 *     tenant_admin,
 *     platform_admin  → currently no control (P5b — SM picker — parked on
 *                       seeding an SM account + a second branch).
 *
 * Visual treatment (mirrors the PeriodChips pattern):
 *   - Same chip shell (rounded-xl, bg-surface-muted, border, gap-1, p-1)
 *   - Same active-chip styling (bg-primary dark:bg-primary-dark text-white)
 *   - Lucide icons (Users / Building2) for unit / branch
 *   - Nexus tokens only; no raw hex
 *
 * Placement (handled by the parent surface):
 *   - Desktop: scope sits LEFT of the period chips with a 1px divider
 *   - Mobile: scope stacks above the chips
 */

import React from 'react';
import { Users, Building2 } from 'lucide-react';

function ChipButton({ active, onClick, ariaLabel, testId, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={ariaLabel}
      onClick={onClick}
      data-testid={testId}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-widest transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? 'bg-primary dark:bg-primary-dark text-white shadow-sm'
          : 'text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export default function LeaderboardScopeControl({
  role,
  viewerUid,
  scope,
  targetUnitId,
  unitOptions, // [{ unitId, unitName }]
  onSelectBranch,
  onSelectUnit,
}) {
  // ── Agents (and everyone else not UM/BM) get NO control. ──────────────────
  if (role !== 'unit_manager' && role !== 'branch_manager') return null;

  // ── UM: 2-segment My Unit / My Branch. ───────────────────────────────────
  if (role === 'unit_manager') {
    // A UM's "My Unit" is the unit they manage — by project convention, the
    // UM's UID IS their unitId (verified at P5-prep). If viewerUid isn't
    // available yet, fall back to a disabled-ish render that defaults to
    // branch + provides only the branch chip (defensive).
    const myUnitTargetUid = viewerUid;
    const onUnit = () => myUnitTargetUid && onSelectUnit(myUnitTargetUid);

    return (
      <div
        role="tablist"
        aria-label="Leaderboard scope"
        data-testid="leaderboard-scope-control"
        data-role="unit_manager"
        data-scope={scope}
        className="inline-flex gap-1 p-1 rounded-xl bg-surface-muted border border-border"
      >
        <ChipButton
          active={scope === 'unit'}
          onClick={onUnit}
          ariaLabel="My Unit"
          testId="leaderboard-scope-myunit"
        >
          <Users size={12} aria-hidden="true" />
          My Unit
        </ChipButton>
        <ChipButton
          active={scope === 'branch'}
          onClick={onSelectBranch}
          ariaLabel="My Branch"
          testId="leaderboard-scope-mybranch"
        >
          <Building2 size={12} aria-hidden="true" />
          My Branch
        </ChipButton>
      </div>
    );
  }

  // ── BM: My Branch + unit-picker. ─────────────────────────────────────────
  const options = Array.isArray(unitOptions) ? unitOptions : [];

  return (
    <div
      role="tablist"
      aria-label="Leaderboard scope"
      data-testid="leaderboard-scope-control"
      data-role="branch_manager"
      data-scope={scope}
      className="inline-flex items-center gap-2"
    >
      <div className="inline-flex gap-1 p-1 rounded-xl bg-surface-muted border border-border">
        <ChipButton
          active={scope === 'branch'}
          onClick={onSelectBranch}
          ariaLabel="My Branch"
          testId="leaderboard-scope-mybranch"
        >
          <Building2 size={12} aria-hidden="true" />
          My Branch
        </ChipButton>
      </div>

      {/* Unit-picker: a native <select> for keyboard + screen-reader parity.
          Selecting a unit moves scope to 'unit'; selecting "—" returns to
          branch. data-testid + data-value for assertion stability. */}
      <label
        className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-ink-muted"
        data-testid="leaderboard-scope-unit-picker-label"
      >
        <Users size={12} aria-hidden="true" />
        <select
          data-testid="leaderboard-scope-unit-picker"
          data-value={scope === 'unit' ? (targetUnitId ?? '') : ''}
          aria-label="Pick a unit"
          value={scope === 'unit' ? (targetUnitId ?? '') : ''}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) onSelectBranch();
            else onSelectUnit(v);
          }}
          className="text-xs font-bold font-mono uppercase tracking-widest bg-card border border-border rounded-lg px-2 py-1.5 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">— Pick a unit —</option>
          {options.map((u) => (
            <option key={u.unitId} value={u.unitId}>
              {u.unitName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
