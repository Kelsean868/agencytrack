import React, { useState, useRef } from 'react';
import { Plus, Trash2, X, Users, Image as ImageIcon } from 'lucide-react';
import { formatTTD } from './ttd';

/**
 * Leaf controls + table renderers for the Company Config surface (design
 * handoff README §The Setting-Row Grammar + cc-proto-controls.jsx, recreated
 * against this codebase's Tailwind/CSS-variable tokens instead of the
 * prototype's inline DS-bundle styles).
 *
 * Every control here is a pure controlled component: `value` in, `onChange`
 * out. None of them read Firestore/context/services. `changed` toggles the
 * teal "customized/draft" border; `disabled` is the platform/soon lock.
 *
 * Dense-table note: per-row icon buttons (delete, add) intentionally stay at
 * the app's existing dense-table size (~32px, matching BranchesPanel's row
 * action buttons) rather than the global 44px touch-target minimum —
 * redesign-addendum §5 carves dense operational tables out of that rule.
 * Primary/standalone actions (SaveBar's Save button, FlagRow's Enable/Disable)
 * keep the 44px (or the spec's explicit 40px) minimum.
 */

const fieldBase =
  'box-border rounded-[9px] font-mono text-[13px] font-bold text-ink bg-card border-[1.5px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-55 disabled:bg-surface-muted';

function fieldBorder(changed) {
  return changed ? 'border-primary' : 'border-border';
}

/** Plain text input. `mono=false` renders in the sans body font (names, labels). */
export function TextControl({ value, onChange, changed, disabled, w = 180, mono = false }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="value"
      className={`${fieldBase} ${fieldBorder(changed)} px-3 py-2 text-left ${mono ? '' : 'font-sans'}`}
      style={{ width: w }}
    />
  );
}

/** Integer input with an optional trailing unit suffix (e.g. "%", "of month"). */
export function NumberControl({ value, onChange, suffix, changed, disabled, w = 74 }) {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <input
        type="text"
        inputMode="numeric"
        value={value ?? 0}
        disabled={disabled}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '');
          onChange(digits === '' ? 0 : parseInt(digits, 10));
        }}
        aria-label="value"
        className={`${fieldBase} ${fieldBorder(changed)} px-3 py-2 text-right`}
        style={{ width: w }}
      />
      {suffix && <span className="font-mono text-[11px] text-ink-muted whitespace-nowrap">{suffix}</span>}
    </span>
  );
}

/**
 * Currency input — edits as a raw digit string while focused, displays the
 * abbreviated TTD form (`formatTTD`) once blurred. Mirrors the prototype's
 * `CcpCurrency` edit/blur pattern.
 */
export function CurrencyControl({ value, onChange, changed, disabled }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={editing ? raw : formatTTD(value)}
      onFocus={() => {
        setRaw(String(value ?? 0));
        setEditing(true);
      }}
      onBlur={() => {
        setEditing(false);
        const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onChange={(e) => setRaw(e.target.value)}
      aria-label="amount in TTD"
      className={`${fieldBase} ${fieldBorder(changed)} px-3 py-2 text-right w-[130px]`}
    />
  );
}

/**
 * Segmented control — roving-tabindex button group with `aria-pressed`
 * (per this component's contract; not a radiogroup).
 */
export function SegControl({ options, value, onChange, changed, disabled }) {
  const refs = useRef([]);
  const move = (fromIdx, dir) => {
    if (disabled) return;
    const next = (fromIdx + dir + options.length) % options.length;
    refs.current[next]?.focus();
  };
  return (
    <span
      className={`inline-flex gap-1 p-1 rounded-[9px] bg-surface-muted border ${fieldBorder(changed)} ${
        disabled ? 'opacity-55' : ''
      } shrink-0`}
    >
      {options.map((o, i) => {
        const on = o === value;
        return (
          <button
            key={o}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            tabIndex={on || (value === undefined && i === 0) ? 0 : -1}
            onClick={() => onChange(o)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(i, 1); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); move(i, -1); }
            }}
            className={`px-3 py-1.5 rounded-md text-[11.5px] font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              on ? 'bg-primary text-white dark:bg-primary-dark' : 'bg-transparent text-ink-muted'
            }`}
          >
            {o}
          </button>
        );
      })}
    </span>
  );
}

/** Switch — 44px track, `role="switch"`. */
export function ToggleControl({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors motion-reduce:transition-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        on ? 'bg-primary' : 'bg-surface-muted border border-border'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[left] duration-150 ease-out motion-reduce:transition-none ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

/** Small bordered ghost button — "Add X", "Upload", "Disable", etc. */
export function GhostButton({ children, danger, small, onClick, disabled, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] font-bold whitespace-nowrap shrink-0 disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        small ? 'px-2.5 py-1.5 text-[12px]' : 'px-3.5 py-2 text-[12px]'
      } ${danger ? 'border-danger text-danger-ink' : 'border-border text-ink'}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Editable numeric-week milestone chips (add/remove) — Recognition & Gamification streak milestones. */
export function MilestoneChips({ value = [], onChange, changed, disabled }) {
  const [adding, setAdding] = useState('');
  const commit = () => {
    const n = parseInt(adding, 10);
    if (!Number.isNaN(n) && n > 0 && !value.includes(n)) onChange([...value, n].sort((a, b) => a - b));
    setAdding('');
  };
  return (
    <span className="inline-flex items-center gap-2 flex-wrap justify-end max-w-[420px]">
      {value.map((wk) => (
        <span
          key={wk}
          className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-card rounded-[9px] border-[1.5px] ${fieldBorder(changed)}`}
        >
          <span className="font-mono text-[13px] font-bold text-ink">{wk}</span>
          <span className="font-mono text-[10px] text-ink-muted">WK</span>
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove ${wk}-week milestone`}
              onClick={() => onChange(value.filter((x) => x !== wk))}
              className="text-ink-muted hover:text-ink p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X size={11} aria-hidden="true" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <span className="inline-flex items-center gap-1 px-2 py-1 border-[1.5px] border-dashed border-border rounded-[9px]">
          <input
            type="text"
            inputMode="numeric"
            placeholder="wk"
            value={adding}
            onChange={(e) => setAdding(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            onBlur={() => { if (adding) commit(); }}
            aria-label="Add milestone (weeks)"
            className="w-8 border-none outline-none bg-transparent font-mono text-[13px] font-bold text-ink text-center"
          />
          <button
            type="button"
            onClick={commit}
            aria-label="Add milestone"
            className="text-ink-muted hover:text-ink p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </span>
      )}
    </span>
  );
}

/** Editable text chips (e.g. career-level names). */
export function TextChips({ value = [], onChange, changed, disabled }) {
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap justify-end max-w-[480px]">
      {value.map((s, i) => (
        <input
          key={i}
          type="text"
          value={s}
          disabled={disabled}
          onChange={(e) => { const nx = [...value]; nx[i] = e.target.value; onChange(nx); }}
          aria-label={`Career level ${i + 1}`}
          className={`${fieldBase} ${fieldBorder(changed)} font-sans text-center px-3 py-1.5`}
          style={{ width: Math.max(84, s.length * 7.4 + 30) }}
        />
      ))}
    </span>
  );
}

const th = 'font-mono text-[9.5px] font-bold tracking-[.12em] uppercase text-ink-muted pb-2 text-left';

/** Tenure-band minimums table — editable; last band is open-ended (∞ OPEN, disabled). */
export function BandsTable({ value = [], onChange, changed, disabled }) {
  const upd = (i, patch) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="overflow-x-auto w-full">
      <div className="min-w-[560px]">
        <div className="grid gap-3 items-center" style={{ gridTemplateColumns: '92px 1fr 148px 34px' }}>
          <div className={th}>Band</div>
          <div className={th}>Tenure (months)</div>
          <div className={`${th} text-right`}>Annual API floor</div>
          <div />
        </div>
        {value.map((b, i) => (
          <div
            key={i}
            className="grid gap-3 items-center py-1.5 border-t border-border"
            style={{ gridTemplateColumns: '92px 1fr 148px 34px' }}
          >
            <TextControl value={b.band} onChange={(v) => upd(i, { band: v })} changed={changed} disabled={disabled} w={72} mono />
            <span className="flex items-center gap-1.5">
              <NumberControl value={b.from} onChange={(v) => upd(i, { from: v })} changed={changed} disabled={disabled} w={60} />
              <span className="text-[11px] text-ink-muted">to</span>
              {b.to === null || b.to === undefined ? (
                <span className={`${fieldBase} ${fieldBorder(false)} inline-grid place-items-center text-center px-3 py-2`} style={{ width: 60 }}>
                  ∞
                </span>
              ) : (
                <NumberControl value={b.to} onChange={(v) => upd(i, { to: v })} changed={changed} disabled={disabled} w={60} />
              )}
              {(b.to === null || b.to === undefined) && (
                <span className="font-mono text-[10px] font-bold text-ink-muted">OPEN</span>
              )}
            </span>
            <span className="text-right">
              <CurrencyControl value={b.floor} onChange={(v) => upd(i, { floor: v })} changed={changed} disabled={disabled} />
            </span>
            {!disabled && value.length > 1 ? (
              <button
                type="button"
                aria-label={`Delete band ${b.band}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-ink-muted hover:text-danger-ink p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            ) : <span />}
          </div>
        ))}
        {!disabled && (
          <div className="flex items-center gap-3.5 pt-2.5 border-t border-border mt-1">
            <GhostButton
              small
              onClick={() => {
                const last = value[value.length - 1];
                const nx = value.map((b, i) => (i === value.length - 1 ? { ...b, to: (b.from || 0) + 12 } : b));
                onChange([...nx, { band: `L${value.length + 1}`, from: (last?.from || 0) + 13, to: null, floor: (last?.floor || 0) + 100000 }]);
              }}
            >
              <Plus size={13} aria-hidden="true" /> Add band
            </GhostButton>
            <span className="text-[11px] text-ink-muted leading-snug">
              Bands must cover month 0 onward with no gaps — the last band stays open-ended.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Weekly company-floor activity standards — editable; per-manager override count is read-only. */
export function StandardsTable({ value = [], onChange, changed, disabled }) {
  const upd = (i, patch) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="overflow-x-auto w-full">
      <div className="min-w-[560px]">
        <div className="grid gap-3 items-center" style={{ gridTemplateColumns: '1fr 110px 190px 34px' }}>
          <div className={th}>Standard</div>
          <div className={`${th} text-right`}>Per week</div>
          <div className={th}>Manager overrides</div>
          <div />
        </div>
        {value.map((r, i) => (
          <div key={i} className="grid gap-3 items-center py-1.5 border-t border-border" style={{ gridTemplateColumns: '1fr 110px 190px 34px' }}>
            <TextControl value={r.name} onChange={(v) => upd(i, { name: v })} changed={changed} disabled={disabled} w="100%" />
            <span className="text-right">
              <NumberControl value={r.wk} onChange={(v) => upd(i, { wk: v })} changed={changed} disabled={disabled} w={70} />
            </span>
            {r.ovr > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Users size={12} aria-hidden="true" /> {r.ovr} manager{r.ovr > 1 ? 's' : ''} override this
              </span>
            ) : <span className="text-[11px] text-ink-muted">—</span>}
            {!disabled && value.length > 1 ? (
              <button
                type="button"
                aria-label={`Delete ${r.name || 'standard'}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-ink-muted hover:text-danger-ink p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            ) : <span />}
          </div>
        ))}
        {!disabled && (
          <div className="flex items-center gap-3.5 pt-2.5 border-t border-border mt-1">
            <GhostButton small onClick={() => onChange([...value, { name: 'New standard', wk: 5, ovr: 0 }])}>
              <Plus size={13} aria-hidden="true" /> Add standard
            </GhostButton>
            <span className="text-[11px] text-ink-muted leading-snug">
              Override counts are read-only here — per-manager overrides live in the manager flow.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Points/activity table — editable name, mono code, points; add/delete.
 *
 * Row-shape tolerance: consumers feed three REAL shapes —
 *   { act, code, pts }            (editable catalog rows, prototype shape)
 *   { key, pts }                  (POINTS_WEIGHTS, registry rec.points)
 *   { level, threshold, title }   (LEVEL_THRESHOLDS, registry rec.levels)
 * The latter two are read-only (soon-locked) this run; when `disabled`, cells
 * render as plain mono text (full key visible, no fake input chrome).
 */
const humanizeKey = (k) =>
  String(k)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());

function pointsRowDisplay(r) {
  return {
    label: r.act ?? r.title ?? (r.key != null ? humanizeKey(r.key) : ''),
    code: r.code ?? r.key ?? (r.level != null ? `L${r.level}` : ''),
    pts: r.pts ?? r.threshold ?? 0,
  };
}

export function PointsTable({ value = [], onChange, changed, disabled }) {
  const upd = (i, patch) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="overflow-x-auto w-full">
      <div className="min-w-[380px]">
        <div className="grid gap-3 items-center" style={{ gridTemplateColumns: disabled ? '1fr 180px 84px 34px' : '1fr 88px 84px 34px' }}>
          <div className={th}>Activity</div>
          <div className={th}>Code</div>
          <div className={`${th} text-right`}>Points</div>
          <div />
        </div>
        {value.map((r, i) => {
          const d = pointsRowDisplay(r);
          if (disabled) {
            return (
              <div key={i} className="grid gap-3 items-center py-2 border-t border-border" style={{ gridTemplateColumns: '1fr 180px 84px 34px' }}>
                <span className="text-[13px] font-semibold text-ink-muted">{d.label}</span>
                <span className="font-mono text-[11.5px] text-ink-muted break-all">{d.code}</span>
                <span className="text-right font-mono text-[13px] font-bold text-ink-muted">{d.pts}</span>
                <span />
              </div>
            );
          }
          return (
          <div key={i} className="grid gap-3 items-center py-1.5 border-t border-border" style={{ gridTemplateColumns: '1fr 88px 84px 34px' }}>
            <TextControl value={d.label} onChange={(v) => upd(i, { act: v })} changed={changed} disabled={disabled} w="100%" />
            <TextControl
              value={d.code}
              onChange={(v) => upd(i, { code: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) })}
              changed={changed}
              disabled={disabled}
              w={80}
              mono
            />
            <span className="text-right">
              <NumberControl value={d.pts} onChange={(v) => upd(i, { pts: v })} changed={changed} disabled={disabled} w={64} />
            </span>
            {value.length > 1 ? (
              <button
                type="button"
                aria-label={`Delete ${d.label || 'activity'}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-ink-muted hover:text-danger-ink p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            ) : <span />}
          </div>
          );
        })}
        {!disabled && (
          <div className="flex items-center gap-3.5 pt-2.5 border-t border-border mt-1">
            <GhostButton small onClick={() => onChange([...value, { act: 'New activity', code: 'NEW', pts: 1 }])}>
              <Plus size={13} aria-hidden="true" /> Add activity
            </GhostButton>
            <span className="text-[11px] text-ink-muted leading-snug">
              Codes appear on Daily Capture and the WAR — keep them short. Deleting an activity stops new points; history keeps what was already earned.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Awards & Clubs catalog table (`awardsRuleset` registry type) — name,
 * qualifying API, recognition tier, active toggle, delete. Inactive rows
 * dim to opacity-60 (earned badges are never revoked; only new-season
 * qualification stops).
 */
export function AwardsRulesetTable({ value = [], onChange, changed, disabled }) {
  const upd = (i, patch) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="overflow-x-auto w-full">
      <div className="min-w-[700px]">
        <div className="grid gap-3 items-center" style={{ gridTemplateColumns: '1fr 150px 150px 62px 34px' }}>
          <div className={th}>Club / award</div>
          <div className={`${th} text-right`}>Qualifying API</div>
          <div className={th}>Recognition</div>
          <div className={th}>Active</div>
          <div />
        </div>
        {value.map((c, i) => (
          <div
            key={i}
            className={`grid gap-3 items-center py-1.5 border-t border-border ${c.active === false ? 'opacity-60' : ''}`}
            style={{ gridTemplateColumns: '1fr 150px 150px 62px 34px' }}
          >
            <TextControl value={c.name} onChange={(v) => upd(i, { name: v })} changed={changed} disabled={disabled} w="100%" />
            <span className="text-right">
              <CurrencyControl value={c.threshold} onChange={(v) => upd(i, { threshold: v })} changed={changed} disabled={disabled} />
            </span>
            <SegControl options={['Badge', 'Badge + trip']} value={c.tier} onChange={(v) => upd(i, { tier: v })} changed={changed} disabled={disabled} />
            <ToggleControl on={c.active !== false} onChange={(v) => upd(i, { active: v })} disabled={disabled} />
            {!disabled && value.length > 1 ? (
              <button
                type="button"
                aria-label={`Delete ${c.name || 'award'}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-ink-muted hover:text-danger-ink p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            ) : <span />}
          </div>
        ))}
        {!disabled && (
          <div className="flex items-center gap-3.5 pt-2.5 border-t border-border mt-1">
            <GhostButton small onClick={() => onChange([...value, { name: 'New award', threshold: 500000, tier: 'Badge', active: true }])}>
              <Plus size={13} aria-hidden="true" /> Add award
            </GhostButton>
            <span className="text-[11px] text-ink-muted leading-snug">
              Inactive awards stop qualifying new seasons — earned badges are never revoked. Qualification reads settled API for the active season.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Brand-mark upload slot (logo/favicon) — data-URL preview, Upload/Replace + Remove. */
export function UploadControl({ value, onChange, shape = 'tile', changed, disabled }) {
  const ref = useRef(null);
  const wide = shape === 'wide';
  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(f);
    e.target.value = '';
  };
  return (
    <span className="inline-flex items-center gap-3 shrink-0">
      <span
        className={`h-14 rounded-xl grid place-items-center overflow-hidden shrink-0 bg-surface-muted border-[1.5px] ${
          value ? 'border-solid' : 'border-dashed'
        } ${fieldBorder(changed)}`}
        style={{ width: wide ? 168 : 56 }}
      >
        {value ? (
          <img src={value} alt="Uploaded mark" className="max-w-full max-h-full object-contain" />
        ) : (
          <ImageIcon size={20} className="text-ink-muted" aria-hidden="true" />
        )}
      </span>
      <span className="inline-flex flex-col gap-1.5 items-start">
        <GhostButton small onClick={() => ref.current?.click()} disabled={disabled}>
          {value ? 'Replace' : 'Upload'}
        </GhostButton>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] font-bold text-ink-muted hover:text-ink focus-visible:outline-none"
          >
            Remove
          </button>
        )}
      </span>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        onChange={pick}
        disabled={disabled}
        className="hidden"
        aria-label="Upload image"
      />
    </span>
  );
}

const CONTROL_BY_TYPE = {
  text: TextControl,
  number: NumberControl,
  currency: CurrencyControl,
  seg: SegControl,
  toggle: ToggleControl,
  milestones: MilestoneChips,
  textchips: TextChips,
  bands: BandsTable,
  standards: StandardsTable,
  points: PointsTable,
  awardsRuleset: AwardsRulesetTable,
  upload: UploadControl,
};

/**
 * Convenience dispatcher — maps a registry item's `type` to the matching
 * control above. Optional glue for consumers wiring `ConfigRow`'s `children`
 * from a registry item; not required if a caller prefers to pick the control
 * directly.
 *
 * @param {object} props
 * @param {object} props.item registry item ({ type, options?, suffix?, w?, mono?, shape? })
 * @param {*} props.value
 * @param {Function} props.onChange
 * @param {boolean} [props.changed]
 * @param {boolean} [props.disabled]
 */
export function ConfigControl({ item, value, onChange, changed, disabled }) {
  const Cmp = CONTROL_BY_TYPE[item?.type];
  if (!Cmp) return null;
  switch (item.type) {
    case 'number':
      return <NumberControl value={value} onChange={onChange} suffix={item.suffix} changed={changed} disabled={disabled} />;
    case 'text':
      return <TextControl value={value} onChange={onChange} changed={changed} disabled={disabled} w={item.w} mono={item.mono} />;
    case 'seg':
      return <SegControl options={item.options} value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'toggle':
      return <ToggleControl on={value} onChange={onChange} disabled={disabled} />;
    case 'upload':
      return <UploadControl value={value} onChange={onChange} shape={item.shape} changed={changed} disabled={disabled} />;
    default:
      return <Cmp value={value} onChange={onChange} changed={changed} disabled={disabled} />;
  }
}
