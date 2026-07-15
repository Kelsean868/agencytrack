import React from 'react';

/**
 * Desktop left rail for Company Config (design handoff README §Left rail).
 * Pure/presentational — navigation intent flows out via `onNav(key)`; no
 * routing or Firestore access happens here.
 *
 * Contract note: the design handoff's footer legend reads
 * "● customized for {company}" — the brief's prop list for this component
 * did not include a company-name prop, so `company` is added here as an
 * additional OPTIONAL prop (non-breaking: omitting it just omits the name
 * from the footer sentence). Flagged in the build report.
 *
 * @param {object} props
 * @param {{g: string, keys: string[]}[]} props.groups group eyebrow + ordered section keys (mirrors the registry's CCP_GROUPS shape)
 * @param {Record<string, {label: string}>} props.sections section key → { label } (mirrors CCP_SECTIONS)
 * @param {string} props.activeKey the currently active section key
 * @param {Set<string>|string[]} props.customizedSet section keys that contain any committed or draft override — rendered with a teal dot
 * @param {Set<string>|string[]} props.phase1Keys section keys that ship in Phase 1 — any section NOT in this set gets an outlined "SOON" tag
 * @param {Function} props.onNav(key) called when a section button is clicked
 * @param {string} [props.company] optional tenant/company name for the footer legend
 */
export default function ConfigRail({ groups, sections, activeKey, customizedSet, phase1Keys, onNav, company }) {
  const phase1 = phase1Keys instanceof Set ? phase1Keys : new Set(phase1Keys || []);
  const customized = customizedSet instanceof Set ? customizedSet : new Set(customizedSet || []);

  return (
    <nav aria-label="Config sections" className="w-[216px] shrink-0 overflow-y-auto pr-1.5" data-testid="ccfg-rail">
      {(groups || []).map((g) => (
        <div key={g.g} className="mb-2.5">
          <div className="font-mono text-[9.5px] font-bold uppercase tracking-[.14em] text-ink-muted px-2.5 pt-2 pb-1.5">
            {g.g}
          </div>
          {g.keys.map((k) => {
            const active = activeKey === k;
            const isPhase1 = phase1.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => onNav(k)}
                aria-current={active ? 'true' : undefined}
                data-testid={`ccfg-rail-${k}`}
                className={`relative flex items-center gap-2 w-full text-left px-2.5 rounded-lg min-h-[36px] text-[12.5px] transition-colors motion-reduce:transition-none ${
                  active
                    ? 'bg-primary-tint text-primary font-bold'
                    : 'text-ink-muted font-semibold hover:bg-surface-muted'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" aria-hidden="true" />
                )}
                <span className="flex-1 leading-tight">{sections?.[k]?.label ?? k}</span>
                {!isPhase1 && (
                  <span className="font-mono text-[8px] font-bold tracking-[.1em] text-ink-muted border border-border rounded px-1 py-px shrink-0">
                    SOON
                  </span>
                )}
                {customized.has(k) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      ))}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
        <span className="text-[10px] text-ink-muted">customized for {company}</span>
      </div>
    </nav>
  );
}
