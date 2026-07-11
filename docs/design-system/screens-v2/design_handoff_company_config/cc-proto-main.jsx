// Company Config prototype — root component: state, shell, save bar, toasts,
// mobile drill-in. Uses CcpRail/CcpRow/etc from cc-proto-app.jsx and the DS
// nav components for the app chrome.

const CCPMain = window.AgencyTrackDesignSystem_ad1cd7;

const CCP_ADMIN_NAV = [
  { g: 'Overview', items: [['home', 'Overview']] },
  { g: 'Administration', items: [['settings', 'Company Config'], ['users', 'Users & Roles'], ['grid', 'Branches & Units']] },
  { g: 'Account', items: [['history', 'Audit Log'], ['wallet', 'Billing']] },
];

function CcpSectionBody({ sk, cfg, flash }) {
  const sec = CCP_SECTIONS[sk];
  const coming = !CCP_PHASE1.includes(sk);
  return (
    <React.Fragment>
      <div style={{ flexShrink: 0, paddingBottom: 2 }}>
        <h2 style={{ margin: 0, font: '800 22px var(--display)', letterSpacing: '-.025em', color: 'var(--ink)', lineHeight: 1.05 }}>{sec.label}</h2>
        <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--inkMute)', lineHeight: 1.5, maxWidth: 640 }}>{sec.blurb}</p>
      </div>
      {coming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surfaceMute)', border: '1px dashed var(--ruleStrong)', borderRadius: 11, flexShrink: 0 }}>
          <CCPMain.Icon name="clock" size={14} />
          <span style={{ fontSize: 11.5, color: 'var(--inkMute)', lineHeight: 1.45 }}><b style={{ color: 'var(--ink)' }}>Future phase.</b> Designed ahead so the phase ships into a finished surface — fully interactive here, ships after Phase 1.</span>
        </div>
      )}
      {sk === 'flags'
        ? <CcpFlagsSection cfg={cfg} flash={flash} />
        : sec.groups.map((g) => <CcpGroupCard key={g.title} group={g} accent={sec.accent} cfg={cfg} flash={flash} />)}
    </React.Fragment>
  );
}

function CcpSaveBar({ count, onSave, onDiscard }) {
  if (!count) return null;
  return (
    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 18, zIndex: 20, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px 10px 18px', background: 'var(--ink)', borderRadius: 14, boxShadow: '0 14px 34px rgba(14,11,7,.35)' }}>
      <span style={{ font: '600 13px var(--sans)', color: 'var(--bg)', whiteSpace: 'nowrap' }}>{count} unsaved change{count > 1 ? 's' : ''}</span>
      <button className="ccp-link" onClick={onDiscard} style={{ border: 'none', background: 'transparent', font: '700 12.5px var(--sans)', color: 'var(--bg)', opacity: 0.65, cursor: 'pointer' }}>Discard</button>
      <button onClick={onSave} style={{ border: 'none', background: 'var(--teal)', color: '#fff', font: '700 13px var(--sans)', padding: '10px 18px', borderRadius: 10, cursor: 'pointer', minHeight: 40 }}>Save changes</button>
    </div>
  );
}

function CcpApp() {
  const [dark, setDark] = React.useState(() => ccpLoad('ccp-dark', false));
  const [navScreen, setNavScreen] = React.useState('Company Config');
  const [active, setActive] = React.useState(() => ccpLoad('ccp-active', 'targets'));
  const [committed, setCommitted] = React.useState(() => ccpLoad('ccp-committed-v2', CCP_SEED));
  const [draft, setDraft] = React.useState({});
  const [log, setLog] = React.useState(() => ccpLoad('ccp-log-v2', CCP_SEED_LOG));
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [histOpen, setHistOpen] = React.useState(false);
  const [flash, setFlash] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [correctId, setCorrectId] = React.useState(null);
  const [narrow, setNarrow] = React.useState(() => window.innerWidth < 880);
  const [mobileSection, setMobileSection] = React.useState(null); // narrow drill-in
  const contentRef = React.useRef(null);
  const pendingJump = React.useRef(null);

  React.useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 880);
    window.addEventListener('resize', onR); return () => window.removeEventListener('resize', onR);
  }, []);
  React.useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const showToast = (msg) => { setToast(msg); window.clearTimeout(showToast._t); showToast._t = window.setTimeout(() => setToast(null), 2800); };

  // ---- config state api (passed to rows) ----
  const baseValue = (id) => (committed[id] !== undefined ? committed[id].value : CCP_BY_ID[id].def);
  const effective = (id) => {
    const d = draft[id];
    if (d) return d.reset ? CCP_BY_ID[id].def : d.value;
    return baseValue(id);
  };
  const rowState = (id) => {
    const item = CCP_BY_ID[id];
    if (item.lock) return item.lock;
    const d = draft[id];
    if (d) return d.reset ? 'reset' : 'draft';
    return committed[id] !== undefined ? 'custom' : 'default';
  };
  const setDraftValue = (id, v) => setDraft((dr) => {
    if (ccpEq(v, baseValue(id))) { const nx = { ...dr }; delete nx[id]; return nx; }
    return { ...dr, [id]: { ...(dr[id] || {}), value: v, reset: undefined } };
  });
  const setDraftEff = (id, eff) => setDraft((dr) => (dr[id] ? { ...dr, [id]: { ...dr[id], eff } } : dr));
  const undoDraft = (id) => setDraft((dr) => { const nx = { ...dr }; delete nx[id]; return nx; });
  const resetToDefault = (id) => setDraft((dr) => ({ ...dr, [id]: { reset: true } }));
  const openCorrect = (id) => setCorrectId(id);

  const saveAll = () => {
    const n = Object.keys(draft).length;
    if (!n) return;
    const nxC = { ...committed };
    const entries = [];
    Object.entries(draft).forEach(([id, d]) => {
      const item = CCP_BY_ID[id];
      const from = ccpPreview(item, baseValue(id));
      const to = ccpPreview(item, d.reset ? item.def : d.value);
      if (d.reset) delete nxC[id];
      else {
        nxC[id] = { value: d.value, who: CCP_ADMIN.name, date: CCP_TODAY };
        if (item.dated) { nxC[id].eff = d.eff || CCP_NEXT_EFF; nxC[id].was = baseValue(id); }
      }
      entries.push({ label: item.label, section: item.sectionLabel, from, to: d.reset ? to + ' (default)' : (item.dated ? `${to} from ${d.eff || CCP_NEXT_EFF}` : to), who: CCP_ADMIN.name, date: CCP_TODAY });
    });
    const nxL = [...entries, ...log];
    setCommitted(nxC); setLog(nxL); setDraft({});
    ccpSave('ccp-committed-v2', nxC); ccpSave('ccp-log-v2', nxL);
    showToast(`Saved ${n} change${n > 1 ? 's' : ''} — applied to ${CCP_ADMIN.users} users at ${CCP_ADMIN.company}`);
  };
  const commitFlag = (f, on) => {
    const nxC = { ...committed };
    if (on) nxC[f.id] = { value: true, who: CCP_ADMIN.name, date: CCP_TODAY };
    else delete nxC[f.id];
    const entry = { label: f.name, section: 'Feature Flags', from: on ? 'OFF' : 'ON', to: on ? 'ON' : 'OFF', who: CCP_ADMIN.name, date: CCP_TODAY };
    const nxL = [entry, ...log];
    setCommitted(nxC); setLog(nxL);
    ccpSave('ccp-committed-v2', nxC); ccpSave('ccp-log-v2', nxL);
    showToast(on ? `${f.name} is ON for all ${CCP_ADMIN.users} users` : `${f.name} turned off`);
  };
  const cfg = { effective, rowState, committed, draft, setDraftValue, setDraftEff, undoDraft, resetToDefault, commitFlag, openCorrect };

  const confirmCorrection = (valText, reason) => {
    const id = correctId; const item = CCP_BY_ID[id]; const meta = committed[id];
    // parse a TTD-ish or numeric string back to a number where possible
    let v = valText;
    const m = String(valText).replace(/,/g, '').match(/([0-9.]+)\s*([MK])?/i);
    if (m && (item.type === 'currency' || item.type === 'number')) {
      v = parseFloat(m[1]) * (m[2] ? (m[2].toUpperCase() === 'M' ? 1e6 : 1e3) : 1);
    }
    const nxC = { ...committed, [id]: { ...meta, value: v, who: CCP_ADMIN.name, date: CCP_TODAY } };
    const entry = { label: item.label, section: item.sectionLabel, from: ccpPreview(item, meta.value), to: `${ccpPreview(item, v)} from ${meta.eff}`, who: CCP_ADMIN.name, date: CCP_TODAY, correction: true, reason };
    const nxL = [entry, ...log];
    setCommitted(nxC); setLog(nxL); setCorrectId(null);
    ccpSave('ccp-committed-v2', nxC); ccpSave('ccp-log-v2', nxL);
    showToast(`Past periods rewritten — ${item.label} re-derived for all affected WARs and seasons`);
  };

  const customizedSet = new Set(Object.keys(committed).concat(Object.keys(draft)).map((id) => CCP_BY_ID[id] && CCP_BY_ID[id].section).filter(Boolean));
  const draftCount = Object.keys(draft).length;

  const goSection = (k) => { setActive(k); ccpSave('ccp-active', k); setMobileSection(k); };
  const jumpTo = (r) => {
    goSection(r.section);
    pendingJump.current = r.id;
    setFlash(r.id);
    window.clearTimeout(jumpTo._t); jumpTo._t = window.setTimeout(() => setFlash(null), 2000);
  };
  React.useEffect(() => {
    if (!pendingJump.current || !contentRef.current) return;
    const id = pendingJump.current; pendingJump.current = null;
    const c = contentRef.current;
    const el = c.querySelector(`[data-sid="${CSS.escape(id)}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 84;
      c.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  });

  const themeClass = 'nexus' + (dark ? ' dark' : '');
  React.useEffect(() => { document.body.style.background = dark ? '#1A1612' : '#F0EEE9'; }, [dark]);

  const overlays = (
    <React.Fragment>
      <CcpSearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} onJump={jumpTo} cfg={cfg} />
      <CcpHistory open={histOpen} onClose={() => setHistOpen(false)} log={log} />
      {correctId && committed[correctId] && <CcpCorrectModal item={CCP_BY_ID[correctId]} meta={committed[correctId]} onClose={() => setCorrectId(null)} onConfirm={confirmCorrection} />}
      {toast && (
        <div role="status" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 84, zIndex: 70, padding: '11px 18px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 12, font: '600 12.5px var(--sans)', boxShadow: '0 14px 34px rgba(14,11,7,.35)', maxWidth: '86vw' }}>{toast}</div>
      )}
    </React.Fragment>
  );

  const searchBtn = (grow) => (
    <button onClick={() => setSearchOpen(true)} aria-label="Find a setting (Command F)"
      style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 12px', minWidth: grow ? 0 : 250, flex: grow ? 1 : 'none', background: 'var(--surfaceMute)', border: '1px solid var(--rule)', borderRadius: 11, color: 'var(--inkFaint)', font: '500 13px var(--sans)', cursor: 'pointer' }}>
      <CCPMain.Icon name="search" size={15} /><span style={{ flex: 1, textAlign: 'left' }}>Find a setting…</span>
      <kbd style={{ font: '700 10px var(--mono)', letterSpacing: '.05em', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 6, padding: '2px 6px', color: 'var(--inkMute)' }}>⌘F</kbd>
    </button>
  );

  /* ---------- NARROW (mobile) ---------- */
  if (narrow) {
    const sec = mobileSection;
    return (
      <div className={themeClass} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg)', padding: '14px 16px 10px', borderBottom: '1px solid var(--rule)' }}>
          {sec ? (
            <button className="ccp-link" onClick={() => setMobileSection(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, font: '700 12.5px var(--sans)', color: 'var(--teal)', cursor: 'pointer', minHeight: 24 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18" /></svg>
              Company Config
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 10.5px var(--mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--inkFaint)' }}>{CCP_ADMIN.company} · Tenant admin</div>
                <h1 style={{ margin: '2px 0 0', font: '800 21px var(--display)', letterSpacing: '-.02em', color: 'var(--ink)' }}>Company Config</h1>
              </div>
              <button onClick={() => setDark((d) => { ccpSave('ccp-dark', !d); return !d; })} aria-label="Toggle dark mode" style={{ width: 40, height: 40, borderRadius: 11, border: '1px solid var(--rule)', background: 'var(--surfaceMute)', color: 'var(--inkMute)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><CCPMain.Icon name={dark ? 'sun' : 'moon'} size={16} /></button>
              <CCPMain.Avatar initials={CCP_ADMIN.initials} size={38} />
            </div>
          )}
          {sec && <h1 style={{ margin: '6px 0 0', font: '800 21px var(--display)', letterSpacing: '-.02em', color: 'var(--ink)' }}>{CCP_SECTIONS[sec].label}</h1>}
        </div>
        <div ref={contentRef} style={{ padding: '14px 16px 120px', display: 'flex', flexDirection: 'column', gap: 13, overflowX: 'hidden' }}>
          {sec ? (
            <CcpSectionBody sk={sec} cfg={cfg} flash={flash} />
          ) : (
            <React.Fragment>
              {searchBtn(true)}
              {CCP_GROUPS.map((g) => (
                <div key={g.g}>
                  <div style={{ font: '700 10px var(--mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--inkFaint)', padding: '4px 4px 7px' }}>{g.g}</div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 13, overflow: 'hidden' }}>
                    {g.keys.map((k, i) => (
                      <button key={k} onClick={() => goSection(k)} className="ccp-railitem"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '14px 15px', minHeight: 48, border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--rule)', background: 'transparent', cursor: 'pointer' }}>
                        <span style={{ flex: 1, font: '600 14px var(--sans)', color: 'var(--ink)' }}>{CCP_SECTIONS[k].label}</span>
                        {!CCP_PHASE1.includes(k) && <span style={{ font: '700 8px var(--mono)', letterSpacing: '.1em', color: 'var(--inkFaint)', border: '1px solid var(--rule)', borderRadius: 4, padding: '1.5px 5px' }}>SOON</span>}
                        {customizedSet.has(k) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }}></span>}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--inkFaint)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }}></span>
                <span style={{ fontSize: 10.5, color: 'var(--inkFaint)' }}>customized for {CCP_ADMIN.company}</span>
              </div>
            </React.Fragment>
          )}
        </div>
        {draftCount > 0 && (
          <div style={{ position: 'fixed', left: 14, right: 14, bottom: 16, zIndex: 40, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 16px', background: 'var(--ink)', borderRadius: 14, boxShadow: '0 14px 34px rgba(14,11,7,.4)' }}>
            <span style={{ flex: 1, font: '600 12.5px var(--sans)', color: 'var(--bg)' }}>{draftCount} unsaved change{draftCount > 1 ? 's' : ''}</span>
            <button className="ccp-link" onClick={() => setDraft({})} style={{ border: 'none', background: 'transparent', font: '700 12px var(--sans)', color: 'var(--bg)', opacity: 0.65, cursor: 'pointer' }}>Discard</button>
            <button onClick={saveAll} style={{ border: 'none', background: 'var(--teal)', color: '#fff', font: '700 13px var(--sans)', padding: '11px 16px', borderRadius: 10, cursor: 'pointer', minHeight: 44 }}>Save</button>
          </div>
        )}
        {overlays}
      </div>
    );
  }

  /* ---------- DESKTOP ---------- */
  return (
    <div className={themeClass} style={{ height: '100vh', overflow: 'hidden', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)', display: 'flex' }}>
      <nav className="side" aria-label="Primary" style={{ height: '100%' }}>
        <div className="side-brand"><span className="side-mark">A</span><span>AgencyTrack</span></div>
        <div className="side-role">{CCP_ADMIN.company} · Tenant admin</div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <CCPMain.SideNavSections sections={CCP_ADMIN_NAV} active={navScreen} onNav={setNavScreen} />
        </div>
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CCPMain.Avatar initials={CCP_ADMIN.initials} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 12.5px var(--sans)', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CCP_ADMIN.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--inkMute)', marginTop: 1 }}>{CCP_ADMIN.role}</div>
          </div>
        </div>
      </nav>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: '1px solid var(--rule)', background: 'var(--surface)', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '800 20px var(--display)', letterSpacing: '-.015em', color: 'var(--ink)', lineHeight: 1.1 }}>{navScreen}</div>
            <div style={{ fontSize: 12, color: 'var(--inkMute)', marginTop: 2, whiteSpace: 'nowrap' }}>How AgencyTrack runs for {CCP_ADMIN.company} — every change is logged</div>
          </div>
          <div style={{ flex: 1 }} />
          {searchBtn(false)}
          <button onClick={() => setHistOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', background: 'var(--surfaceMute)', border: '1px solid var(--rule)', borderRadius: 11, font: '700 12px var(--sans)', color: 'var(--inkMute)', cursor: 'pointer' }}>
            <CCPMain.Icon name="history" size={15} /> Change history
          </button>
          <button onClick={() => setDark((d) => { ccpSave('ccp-dark', !d); return !d; })} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ width: 40, height: 40, borderRadius: 11, border: '1px solid var(--rule)', background: 'var(--surfaceMute)', color: 'var(--inkMute)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <CCPMain.Icon name={dark ? 'sun' : 'moon'} size={17} />
          </button>
        </header>
        {navScreen === 'Company Config' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 18, padding: '18px 24px 0' }}>
            <CcpRail active={active} onNav={goSection} customizedSet={customizedSet} />
            <main ref={contentRef} className="nx-screen-enter" key={active} style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 13, paddingRight: 6, paddingBottom: 90, position: 'relative' }}>
              <CcpSectionBody sk={active} cfg={cfg} flash={flash} />
            </main>
          </div>
        ) : (
          <main style={{ flex: 1, overflow: 'auto', padding: '22px 26px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 16 }}>
              <CCPMain.EmptyState icon="grid" title={navScreen}
                body="This screen isn't part of the Company Config prototype — but the config surface, find-a-setting (⌘F), drafts and change history are fully wired."
                cta="Back to Company Config" onCta={() => setNavScreen('Company Config')} />
            </div>
          </main>
        )}
        <CcpSaveBar count={navScreen === 'Company Config' ? draftCount : 0} onSave={saveAll} onDiscard={() => setDraft({})} />
      </div>
      {overlays}
    </div>
  );
}

Object.assign(window, { CcpApp });
