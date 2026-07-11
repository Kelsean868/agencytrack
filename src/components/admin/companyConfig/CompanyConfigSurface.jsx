import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, History, ChevronLeft, ChevronRight, Shield, PencilLine } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import useToast from '../../../hooks/useToast';
import { getConfigAudit } from '../../../services/configAuditService';
import { BOOLEAN_STANDARDS } from '../../../services/managerActivityStandardsService';
import {
  CONFIG_GROUPS,
  CONFIG_SECTIONS,
  PHASE1_SECTIONS,
  CONFIG_FLAGS,
  ALL_ITEMS,
  ITEMS_BY_ID,
} from '../../../config/companyConfigRegistry';

import ConfigRail from './ConfigRail';
import ConfigGroupCard from './ConfigGroupCard';
import ConfigRow from './ConfigRow';
import { ConfigControl, NumberControl, ToggleControl } from './ConfigControls';
import FindSettingPalette from './FindSettingPalette';
import ChangeHistoryDrawer from './ChangeHistoryDrawer';
import SaveBar from './SaveBar';
import SoonBanner from './SoonBanner';
import FlagRow from './FlagRow';
import { valuePreview } from './valuePreview';
import useCompanyConfigState, { formatAuditDate } from './useCompanyConfigState';

// Legacy minimums editor (Item E) + embedded whole-object awards editor (Item D).
import LegacyMinimumsModal from './LegacyMinimumsModal';
import AwardsRulesetPanel from '../AwardsRulesetPanel';

const BOOLEAN_STANDARD_SET = new Set(BOOLEAN_STANDARDS);
const NARROW_QUERY = '(max-width: 879px)';

// ── Change-history label resolution (audit stores settingId, not a label) ──────
function resolveAuditLabel(settingId) {
  if (ITEMS_BY_ID[settingId]) return ITEMS_BY_ID[settingId].label;
  const flag = CONFIG_FLAGS.find((f) => f.key === settingId);
  if (flag) return flag.name;
  // Activity dot-path: `<role>.<standardKey>` → "Unit Managers · JFW".
  const dot = settingId.indexOf('.');
  if (dot > 0) {
    const role = settingId.slice(0, dot);
    const key = settingId.slice(dot + 1);
    const item = ITEMS_BY_ID[`act.standards.${role}`];
    if (item?.standardLabels?.[key]) {
      return `${item.label.replace('Weekly standards — ', '')} · ${item.standardLabels[key]}`;
    }
  }
  return settingId;
}

/**
 * Targets & Minimums are NOT editable this run (effective-dating engine, slice
 * 1.5). Their displayed VALUES must still be the real current ones — read from
 * the hydrated companyMinimums doc where present, else the registry default.
 */
function resolveTargetsValue(item, docs, effectiveFallback) {
  const cm = docs.companyMinimums || {};
  switch (item.id) {
    case 'targets.floor':          return cm.annualAPI ?? item.def;
    case 'targets.persistencyFloor': return cm.persistency ?? item.def;
    case 'targets.annualApps':     return cm.annualApps ?? item.def;
    case 'targets.bands': {
      const floors = cm.tenureApiFloors;
      if (floors && item.sourceKeys && Array.isArray(item.def)) {
        return item.def.map((band, i) => {
          const k = item.sourceKeys[i];
          return k in floors ? { ...band, floor: floors[k] } : band;
        });
      }
      return item.def;
    }
    default:
      return effectiveFallback;
  }
}

// ── Activity Standards editor (Item C) ─────────────────────────────────────────
// Deviation from the kit's StandardsTable (name/wk/ovr + add/delete, mock
// schema): the REAL activity schema is a FIXED 8-key set (6 numeric + 2 boolean)
// per role, with per-key manager-override counts — a shape StandardsTable's
// arbitrary-row / numeric-only / no-boolean model cannot represent honestly.
// This editor keeps the kit's dense-table grammar + leaf controls
// (NumberControl / ToggleControl) against the real schema. See build report.
const activityTh = 'font-mono text-[9.5px] font-bold tracking-[.12em] uppercase text-ink-muted pb-2 text-left';

function ActivityStandardsEditor({ item, value, onChange, changed, disabled, overrideCounts }) {
  const roleMap = value || {};
  const setKey = (key, val) => {
    const next = { ...roleMap };
    if (val === undefined || val === null || val === '' || val === false) delete next[key];
    else next[key] = val;
    onChange(next);
  };
  return (
    <div className="overflow-x-auto w-full">
      <div className="min-w-[560px]">
        <div className="grid gap-3 items-center" style={{ gridTemplateColumns: '1fr 132px 190px' }}>
          <div className={activityTh}>Standard</div>
          <div className={`${activityTh} text-right`}>Per week</div>
          <div className={activityTh}>Manager overrides</div>
        </div>
        {item.standardKeys.map((key) => {
          const isBool = BOOLEAN_STANDARD_SET.has(key);
          const count = overrideCounts?.[key];
          return (
            <div
              key={key}
              className="grid gap-3 items-center py-1.5 border-t border-border"
              style={{ gridTemplateColumns: '1fr 132px 190px' }}
            >
              <span className="text-[13px] text-ink">{item.standardLabels[key]}</span>
              <span className="flex justify-end">
                {isBool ? (
                  <ToggleControl on={roleMap[key] === true} onChange={(v) => setKey(key, v)} disabled={disabled} />
                ) : (
                  <NumberControl
                    value={roleMap[key] ?? 0}
                    onChange={(v) => setKey(key, v)}
                    changed={changed}
                    disabled={disabled}
                    w={72}
                  />
                )}
              </span>
              {/* Override counts unavailable: managerActivityStandardOverrides has
                  `allow list: if false` — tenant_admin cannot query it (build FINDING). */}
              <span
                className="text-[11px] text-ink-muted"
                title={count == null ? 'Override counts need a rules extension — banked' : undefined}
              >
                {count == null ? '—' : `${count} manager${count === 1 ? '' : 's'} override this`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CompanyConfigSurface() {
  const { user, userProfile, tenantId } = useAuth();
  const { show } = useToast();

  const company = 'Tatil Life'; // mirrors the tenant-admin topbar crumb; no dynamic tenant-name field exists yet
  const actor = useMemo(
    () => ({ uid: user?.uid ?? null, name: userProfile?.name ?? userProfile?.email ?? null }),
    [user, userProfile],
  );
  const notify = useCallback((message) => show({ message, variant: 'success' }), [show]);

  const cfg = useCompanyConfigState({ tenantId, actor, company, notify });
  const {
    docs, draftCount, effective, rowState,
    setDraftValue, undoDraft, stageReset, discardAll, saveAll,
    commitFlag, flagOn, flagProvenance, customizedSections,
  } = cfg;

  const [active, setActive] = useState('targets');
  const [searchOpen, setSearchOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [histEntries, setHistEntries] = useState([]);
  const [flashId, setFlashId] = useState(null);
  const [confirmingFlag, setConfirmingFlag] = useState(null); // single flag key
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(NARROW_QUERY).matches,
  );
  const [mobileSection, setMobileSection] = useState(null); // narrow drill-in

  const contentRef = useRef(null);
  const pendingJump = useRef(null);
  const flashTimer = useRef(null);

  // Viewport tracking (breakpoint 880px, README §Responsive).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // ⌘F / Ctrl+F opens the find-a-setting palette. Deliberately NOT ⌘K — the app
  // Shell owns ⌘K for its global command palette (Shell.jsx). Active only while
  // this surface is mounted.
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // Palette jump: switch section, then scroll the row into view via container
  // scrollTop math (~84px offset — README forbids scrollIntoView) + flash 2s.
  const goSection = useCallback((key) => {
    setActive(key);
    setMobileSection(key);
  }, []);

  const jumpTo = useCallback((item) => {
    goSection(item.section);
    pendingJump.current = item.id;
    setFlashId(item.id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 2000);
  }, [goSection]);

  useEffect(() => {
    if (!pendingJump.current || !contentRef.current) return;
    const id = pendingJump.current;
    pendingJump.current = null;
    const c = contentRef.current;
    const el = c.querySelector(`[data-sid="${CSS.escape(id)}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 84;
      c.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }); // runs after every render; pendingJump guards to a single fire per jump

  const openHistory = useCallback(async () => {
    setHistOpen(true);
    setHistLoading(true);
    const raw = await getConfigAudit(tenantId, { limit: 50 });
    setHistEntries(
      (raw || []).map((e) => ({
        section: e.section,
        label: resolveAuditLabel(e.settingId),
        from: e.from,
        to: e.to,
        who: e.whoName ?? e.who ?? '—',
        date: formatAuditDate(e.at),
        reason: e.correction,
        correction: !!e.correction,
      })),
    );
    setHistLoading(false);
  }, [tenantId]);

  const paletteValuePreview = useCallback((item) => valuePreview(item, effective(item.id)), [effective]);

  // ── Row renderers ──────────────────────────────────────────────────────────
  const renderRow = useCallback((item) => {
    const state = rowState(item.id);
    const changed = state === 'draft';

    // Activity standards — the one editable registry-control type this run.
    if (item.type === 'standards') {
      return (
        <ConfigRow
          key={item.id}
          item={item}
          state={state}
          effectiveValue={effective(item.id)}
          draft={state === 'draft' || state === 'reset'}
          onUndo={() => undoDraft(item.id)}
          onReset={() => stageReset(item.id)}
          flash={flashId === item.id}
        >
          <ActivityStandardsEditor
            item={item}
            value={effective(item.id)}
            onChange={(next) => setDraftValue(item.id, next)}
            changed={changed}
            disabled={false}
            overrideCounts={null}
          />
        </ConfigRow>
      );
    }

    // Everything else renders READ-ONLY this run (targets = effective-dating
    // slice 1.5; future sections = soon/unbacked). Platform rows render no
    // control; the rest render a disabled control showing the real value.
    const displayValue = item.section === 'targets'
      ? resolveTargetsValue(item, docs, effective(item.id))
      : effective(item.id);

    return (
      <ConfigRow
        key={item.id}
        item={item}
        state={state}
        effectiveValue={displayValue}
        flash={flashId === item.id}
      >
        {state !== 'platform' && item.type && (
          <ConfigControl item={item} value={displayValue} onChange={() => {}} changed={false} disabled />
        )}
      </ConfigRow>
    );
  }, [rowState, effective, docs, undoDraft, stageReset, setDraftValue, flashId]);

  const renderGroup = useCallback((sectionKey, section, group) => {
    // Awards catalog exception (Item D): the group hosting the awardsRuleset item
    // renders the EXISTING whole-object AwardsRulesetPanel embedded in a gold
    // ConfigGroupCard rather than a registry-native table.
    if (group.items.some((it) => it.type === 'awardsRuleset')) {
      return (
        <ConfigGroupCard key={group.title} title="AWARD CATALOG" sub={group.sub} accent="gold">
          {/*
            AWARDS EXCEPTION (Run 5, operator lock #2): awards keeps
            awardsRulesetService's validated-complete whole-object storage this
            run; diff-only migration is slice 2. The surrounding surface is
            diff-only — do NOT copy this embed pattern for new sections.
          */}
          <AwardsRulesetPanel embedded />
        </ConfigGroupCard>
      );
    }
    return (
      <ConfigGroupCard key={group.title} title={group.title} sub={group.sub} accent={section.accent}>
        {group.items.map(renderRow)}
      </ConfigGroupCard>
    );
  }, [renderRow]);

  const renderFlags = useCallback(() => (
    <ConfigGroupCard title="FEATURE FLAGS">
      <div className="flex items-start gap-3 mb-3 px-3.5 py-3 rounded-xl bg-surface-muted border border-border">
        <Shield size={16} className="text-ink-muted shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-[11.5px] text-ink-muted leading-snug">
          Flags are fail-closed: any flag absent from your tenant is off. Enabling takes effect
          immediately for {cfg.userCount != null ? `all ${cfg.userCount} users` : 'everyone'} and is written to the audit log.
        </p>
      </div>
      {CONFIG_FLAGS.map((flag) => (
        <FlagRow
          key={flag.key}
          flag={flag}
          on={flagOn(flag.key)}
          provenance={flagProvenance(flag.key)}
          confirming={confirmingFlag === flag.key}
          onRequestEnable={() => setConfirmingFlag(flag.key)}
          onCancelConfirm={() => setConfirmingFlag(null)}
          onConfirmEnable={() => { setConfirmingFlag(null); commitFlag(flag, true); }}
          onDisable={() => commitFlag(flag, false)}
          userCount={cfg.userCount ?? undefined}
          company={company}
        />
      ))}
    </ConfigGroupCard>
  ), [cfg.userCount, flagOn, flagProvenance, confirmingFlag, commitFlag, company]);

  // ── Section body ───────────────────────────────────────────────────────────
  const renderSectionBody = useCallback((sectionKey) => {
    const section = CONFIG_SECTIONS[sectionKey];
    if (!section) return null;
    const isFuture = !PHASE1_SECTIONS.includes(sectionKey);
    return (
      <React.Fragment>
        <div className="shrink-0">
          <h2 className="font-display text-[22px] font-extrabold tracking-tight text-ink leading-[1.05]">
            {section.label}
          </h2>
          <p className="text-[12px] text-ink-muted mt-1 leading-relaxed max-w-[640px]">{section.blurb}</p>
        </div>

        {isFuture && <SoonBanner />}

        {sectionKey === 'flags'
          ? renderFlags()
          : section.groups.map((group) => renderGroup(sectionKey, section, group))}

        {/* Targets legacy editor (Item E) — quiet escape hatch to the existing
            company-minimums editor until effective-dating lands (slice 1.5). */}
        {sectionKey === 'targets' && (
          <div className="flex items-center gap-3 flex-wrap px-1">
            <button
              type="button"
              onClick={() => setLegacyOpen(true)}
              data-testid="ccfg-targets-legacy-open"
              className="inline-flex items-center gap-2 text-[12px] font-semibold text-ink-muted hover:text-ink underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
            >
              <PencilLine size={13} aria-hidden="true" /> Edit minimums (legacy editor)
            </button>
            <span className="text-[11px] text-ink-muted">
              The legacy editor retires when effective-dating lands (slice 1.5).
            </span>
          </div>
        )}
      </React.Fragment>
    );
  }, [renderFlags, renderGroup]);

  const searchButton = (grow) => (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      aria-label="Find a setting (Command F)"
      data-testid="ccfg-find-button"
      className={`inline-flex items-center gap-2.5 h-10 px-3 rounded-xl bg-surface-muted border border-border text-ink-muted text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        grow ? 'w-full' : 'min-w-[250px]'
      }`}
    >
      <Search size={15} aria-hidden="true" />
      <span className="flex-1 text-left">Find a setting…</span>
      <kbd className="font-mono text-[10px] font-bold tracking-wide bg-surface border border-border rounded px-1.5 py-0.5 text-ink-muted">
        ⌘F
      </kbd>
    </button>
  );

  const overlays = (
    <React.Fragment>
      <FindSettingPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={ALL_ITEMS}
        valuePreview={paletteValuePreview}
        onJump={jumpTo}
      />
      <ChangeHistoryDrawer
        open={histOpen}
        onClose={() => setHistOpen(false)}
        entries={histEntries}
        loading={histLoading}
      />
      {legacyOpen && <LegacyMinimumsModal onClose={() => setLegacyOpen(false)} />}
    </React.Fragment>
  );

  // ── NARROW (drill-in) ──────────────────────────────────────────────────────
  if (narrow) {
    const sec = mobileSection;
    return (
      <div className="relative min-h-[60vh]" data-testid="ccfg-surface">
        <div className="sticky top-0 z-20 bg-surface pb-2.5 mb-2.5 border-b border-border">
          {sec ? (
            <button
              type="button"
              onClick={() => setMobileSection(null)}
              className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary min-h-[44px] focus-visible:outline-none"
            >
              <ChevronLeft size={16} aria-hidden="true" /> Company Config
            </button>
          ) : (
            <div>
              <div className="font-display text-[21px] font-extrabold tracking-tight text-ink">Company Config</div>
              <p className="text-[12px] text-ink-muted mt-0.5">
                How AgencyTrack runs for {company} — every change is logged
              </p>
            </div>
          )}
          {sec && (
            <h1 className="font-display text-[21px] font-extrabold tracking-tight text-ink mt-1.5">
              {CONFIG_SECTIONS[sec].label}
            </h1>
          )}
        </div>

        <div ref={contentRef} className="flex flex-col gap-3 pb-[110px] overflow-x-hidden">
          {sec ? (
            renderSectionBody(sec)
          ) : (
            <React.Fragment>
              {searchButton(true)}
              <button
                type="button"
                onClick={openHistory}
                className="inline-flex items-center gap-2 h-11 px-3 rounded-xl bg-surface-muted border border-border text-ink-muted text-[12.5px] font-bold self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <History size={15} aria-hidden="true" /> Change history
              </button>
              {CONFIG_GROUPS.map((g) => (
                <div key={g.g}>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-ink-muted px-1 pt-1 pb-1.5">
                    {g.g}
                  </div>
                  <div className="bg-card border border-border rounded-[13px] overflow-hidden">
                    {g.keys.map((k, i) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setMobileSection(k)}
                        className={`flex items-center gap-2.5 w-full text-left px-4 min-h-[48px] ${i === 0 ? '' : 'border-t border-border'}`}
                      >
                        <span className="flex-1 text-[14px] font-semibold text-ink">{CONFIG_SECTIONS[k].label}</span>
                        {!PHASE1_SECTIONS.includes(k) && (
                          <span className="font-mono text-[8px] font-bold tracking-[.1em] text-ink-muted border border-border rounded px-1 py-px">SOON</span>
                        )}
                        {customizedSections.has(k) && <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />}
                        <ChevronRight size={15} className="text-ink-muted" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </React.Fragment>
          )}
        </div>

        {draftCount > 0 && (
          <div className="fixed left-3.5 right-3.5 bottom-4 z-40 flex items-center gap-3 px-4 py-2.5 rounded-[14px] bg-ink text-surface shadow-lg">
            <span className="flex-1 text-[12.5px] font-semibold">{draftCount} unsaved change{draftCount === 1 ? '' : 's'}</span>
            <button type="button" onClick={discardAll} className="text-[12px] font-bold underline opacity-80">Discard</button>
            <button type="button" onClick={saveAll} className="min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-[13px] font-bold">Save</button>
          </div>
        )}
        {overlays}
      </div>
    );
  }

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[60vh]" data-testid="ccfg-surface">
      <header className="flex items-center gap-3.5 flex-wrap pb-4 mb-1">
        <div className="min-w-0">
          <div className="font-display text-[20px] font-extrabold tracking-tight text-ink leading-tight">Company Config</div>
          <div className="text-[12px] text-ink-muted mt-0.5">
            How AgencyTrack runs for {company} — every change is logged
          </div>
        </div>
        <div className="flex-1" />
        {searchButton(false)}
        <button
          type="button"
          onClick={openHistory}
          data-testid="ccfg-history-button"
          className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-surface-muted border border-border text-ink-muted text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <History size={15} aria-hidden="true" /> Change history
        </button>
      </header>

      <div className="flex gap-4.5 flex-1 min-h-0" style={{ gap: 18 }}>
        <ConfigRail
          groups={CONFIG_GROUPS}
          sections={CONFIG_SECTIONS}
          activeKey={active}
          customizedSet={customizedSections}
          phase1Keys={PHASE1_SECTIONS}
          onNav={goSection}
          company={company}
        />
        <main
          ref={contentRef}
          key={active}
          className="screen-enter flex-1 min-w-0 overflow-y-auto flex flex-col gap-3 pr-1.5 pb-[90px] relative"
        >
          {renderSectionBody(active)}
          <SaveBar count={draftCount} onSave={saveAll} onDiscard={discardAll} />
        </main>
      </div>
      {overlays}
    </div>
  );
}
