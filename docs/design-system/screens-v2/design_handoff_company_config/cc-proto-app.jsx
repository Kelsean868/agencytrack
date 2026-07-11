// Company Config prototype — app shell, rail, rows, search, drafts, save,
// provenance, history. State lives here; registry in cc-proto-data.jsx.

const CCPDS = window.AgencyTrackDesignSystem_ad1cd7;
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const ccpLoad = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? fb : v; } catch (e) { return fb; } };
const ccpSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const ccpEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── provenance + row ──────────────────────────────────────────────────────
function CcpProvenance({ meta, def, onReset }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--inkMute)' }}>Changed by <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{meta.who}</b> · {meta.date}</span>
      <button className="ccp-link" onClick={onReset} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', padding: 0, font: '700 11px var(--sans)', color: 'var(--teal)', cursor: 'pointer' }}>
        <CcpIconReset /> Reset to default{def !== undefined ? ` (${def})` : ''}
      </button>
    </div>
  );
}
function CcpDraftNote({ resetting, onUndo, dated, eff, onEff }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>{resetting ? 'Will reset to default on save' : 'Unsaved — applies to everyone on save'}</span>
      {dated && !resetting && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--inkMute)' }}>
          Takes effect
          <input className="ccp-input" type="text" value={eff} onChange={(e) => onEff(e.target.value)}
            style={{ width: 92, padding: '3px 8px', border: '1.5px solid var(--teal)', borderRadius: 7, background: 'var(--surface)', font: '700 11px var(--mono)', color: 'var(--ink)', outline: 'none' }} aria-label="Effective from date" />
          · past periods keep the value in force at the time
        </span>
      )}
      <button className="ccp-link" onClick={onUndo} style={{ border: 'none', background: 'transparent', padding: 0, font: '700 11px var(--sans)', color: 'var(--inkMute)', cursor: 'pointer', textDecoration: 'underline' }}>Undo</button>
    </div>
  );
}
// Effective-dating history + correction escape hatch, for dated settings.
function CcpDatedBits({ item, meta, cfg }) {
  if (!item.dated || !meta || !meta.eff) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
      <span style={{ font: '500 11px var(--mono)', color: 'var(--inkMute)' }}>
        <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{ccpPreview(item, meta.value)}</b> from {meta.eff}{meta.was !== undefined ? <span> · was {ccpPreview(item, meta.was)}</span> : null}
      </span>
      <button className="ccp-link" onClick={() => cfg.openCorrect(item.id)} style={{ border: 'none', background: 'transparent', padding: 0, font: '600 11px var(--sans)', color: 'var(--inkMute)', cursor: 'pointer', textDecoration: 'underline dotted' }}>Correct a past value…</button>
    </div>
  );
}

function CcpControl({ item, value, changed, disabled, onChange }) {
  switch (item.type) {
    case 'number': return <CcpNumber value={value} onChange={onChange} suffix={item.suffix} changed={changed} disabled={disabled} />;
    case 'currency': return <CcpCurrency value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'text': return <CcpText value={value} onChange={onChange} changed={changed} disabled={disabled} w={item.w} mono={item.mono} />;
    case 'seg': return <CcpSeg options={item.options} value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'toggle': return <CcpToggle on={value} onChange={onChange} disabled={disabled} />;
    case 'milestones': return <CcpMilestones value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'textchips': return <CcpTextChips value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'bands': return <CcpBandTable value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'points': return <CcpPointsTable value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'clubs': return <CcpClubsTable value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'standards': return <CcpStandardsTable value={value} onChange={onChange} changed={changed} disabled={disabled} />;
    case 'upload': return <CcpUpload value={value} onChange={onChange} shape={item.shape} changed={changed} disabled={disabled} />;
    default: return null;
  }
}

function CcpRow({ item, cfg, first, flash }) {
  const { effective, rowState, committed, setDraftValue, undoDraft, resetToDefault, setDraftEff, draft } = cfg;
  const st = rowState(item.id); // 'platform'|'soon'|'draft'|'reset'|'custom'|'default'
  const grey = st === 'platform' || st === 'soon';
  const changed = st === 'draft' || st === 'custom';
  const value = effective(item.id);
  const defPreview = ccpPreview(item, item.def);
  const meta = committed[item.id];
  const d = draft[item.id];
  const draftBits = (st === 'draft' || st === 'reset') && (
    <CcpDraftNote resetting={st === 'reset'} onUndo={() => undoDraft(item.id)}
      dated={item.dated} eff={(d && d.eff) || CCP_NEXT_EFF} onEff={(v) => setDraftEff(item.id, v)} />
  );
  const control = item.lock === 'platform' ? null : (
    <CcpControl item={item} value={value} changed={changed} disabled={!!item.lock} onChange={(v) => setDraftValue(item.id, v)} />
  );
  const body = (
    <React.Fragment>
      <div style={{ flex: '1 1 220px', minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {(st === 'custom' || st === 'draft') && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }}></span>}
          <span style={{ font: '600 13.5px var(--sans)', color: grey ? 'var(--inkMute)' : 'var(--ink)' }}>{item.label}</span>
        </div>
        {item.desc && <div style={{ fontSize: 11.5, color: 'var(--inkFaint)', marginTop: 3, lineHeight: 1.45, maxWidth: 520 }}>{item.desc}</div>}
        {st === 'custom' && <CcpDatedBits item={item} meta={meta} cfg={cfg} />}
        {st === 'custom' && <CcpProvenance meta={committed[item.id]} def={defPreview} onReset={() => resetToDefault(item.id)} />}
        {draftBits}
        {st === 'platform' && <div style={{ fontSize: 11, color: 'var(--inkMute)', marginTop: 4 }}>Platform-managed for now — on the roadmap to open up like everything else.</div>}
        {st === 'soon' && <div style={{ fontSize: 11, color: 'var(--inkMute)', marginTop: 4 }}>Ships read-only for now — editing lands with its unlock tier.</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 1, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' }}>
        {st === 'default' && <CcpDefaultTag />}
        {st === 'platform' && <span style={{ font: '700 12.5px var(--mono)', color: 'var(--inkMute)' }}>{item.value}</span>}
        {control}
        {st === 'platform' && <CcpPlatformChip />}
        {st === 'soon' && <CcpSoonChip tier={item.tier} />}
      </div>
    </React.Fragment>
  );
  if (item.bare) {
    return (
      <div data-sid={item.id} className={flash === item.id ? 'ccp-flash' : ''} style={{ borderRadius: 8 }}>
        <CcpControl item={item} value={value} changed={changed} disabled={!!item.lock} onChange={(v) => setDraftValue(item.id, v)} />
        {st === 'custom' && <div style={{ marginTop: 8 }}><CcpDatedBits item={item} meta={meta} cfg={cfg} /><CcpProvenance meta={committed[item.id]} onReset={() => resetToDefault(item.id)} /></div>}
        {(st === 'draft' || st === 'reset') && <div style={{ marginTop: 8 }}>{draftBits}</div>}
      </div>
    );
  }
  return (
    <div data-sid={item.id} className={flash === item.id ? 'ccp-flash' : ''}
      style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px 16px', padding: '13px 8px', margin: '0 -8px', borderTop: first ? 'none' : '1px solid var(--rule)', borderRadius: 8 }}>
      {body}
    </div>
  );
}

function CcpGroupCard({ group, accent, cfg, flash }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 14, padding: '16px 20px', flexShrink: 0 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ font: '700 10.5px var(--mono)', letterSpacing: '.14em', color: accent === 'gold' ? 'var(--gold)' : 'var(--teal)' }}>{group.title}</div>
        {group.sub && <div style={{ fontSize: 11.5, color: 'var(--inkMute)', marginTop: 3, lineHeight: 1.45 }}>{group.sub}</div>}
      </div>
      {group.items.map((it, i) => <CcpRow key={it.id} item={it} cfg={cfg} first={i === 0 || it.bare} flash={flash} />)}
    </section>
  );
}

// ── feature flags section ─────────────────────────────────────────────────
function CcpFlagsSection({ cfg, flash }) {
  const { effective, committed, commitFlag } = cfg;
  const [confirmId, setConfirmId] = useState(null);
  return (
    <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surfaceMute)', border: '1px solid var(--rule)', borderRadius: 12, flexShrink: 0 }}>
        <CCPDS.Icon name="shield" size={17} />
        <div style={{ fontSize: 12, color: 'var(--inkMute)', lineHeight: 1.5 }}>
          Flags are <b style={{ color: 'var(--ink)' }}>fail-closed</b>: any flag absent from your tenant is off. Enabling takes effect immediately for all <b style={{ color: 'var(--ink)' }}>{CCP_ADMIN.users} users</b> and is written to the audit log.
        </div>
      </div>
      <section style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 14, padding: '16px 20px', flexShrink: 0 }}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ font: '700 10.5px var(--mono)', letterSpacing: '.14em', color: 'var(--teal)' }}>AVAILABLE FLAGS</div>
          <div style={{ fontSize: 11.5, color: 'var(--inkMute)', marginTop: 3 }}>Enable affordances are deliberately loud — a flag flip changes the product for everyone at once.</div>
        </div>
        {CCP_FLAGS.map((f, i) => {
          const on = !!effective(f.id);
          const meta = committed[f.id];
          return (
            <div key={f.id} data-sid={f.id} className={flash === f.id ? 'ccp-flash' : ''} style={{ padding: '14px 8px', margin: '0 -8px', borderTop: i === 0 ? 'none' : '1px solid var(--rule)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px 16px' }}>
                <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ font: '700 13.5px var(--sans)', color: 'var(--ink)' }}>{f.name}</span>
                    <span style={{ font: '500 10.5px var(--mono)', color: 'var(--inkMute)', padding: '2px 7px', background: 'var(--surfaceMute)', border: '1px solid var(--rule)', borderRadius: 5 }}>{f.key}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--inkFaint)', marginTop: 4, lineHeight: 1.45, maxWidth: 540 }}>{f.desc}</div>
                  {on && meta && <div style={{ fontSize: 11, color: 'var(--inkMute)', marginTop: 5 }}>Enabled by <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{meta.who}</b> · {meta.date}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 2 }}>
                  {on ? (
                    <React.Fragment>
                      <span className="ccp-chip" style={{ background: 'var(--tealTint)', color: 'var(--teal)', border: '1px solid transparent' }}><CCPDS.Icon name="check" size={11} /> ON</span>
                      <CcpGhostBtn small onClick={() => commitFlag(f, false)}>Disable</CcpGhostBtn>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <span className="ccp-chip" style={{ background: 'var(--surfaceMute)', border: '1px solid var(--rule)', color: 'var(--inkFaint)' }}>NOT SET → OFF</span>
                      <CcpGhostBtn small danger onClick={() => setConfirmId(f.id)}><CCPDS.Icon name="alert" size={13} /> Enable for everyone</CcpGhostBtn>
                    </React.Fragment>
                  )}
                </div>
              </div>
              {confirmId === f.id && !on && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: '10px 14px', background: 'var(--dangerTint)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', borderRadius: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1 }}>Turn on <b>{f.name}</b> for all {CCP_ADMIN.users} users at {CCP_ADMIN.company}, effective immediately?</span>
                  <button className="ccp-link" onClick={() => setConfirmId(null)} style={{ border: 'none', background: 'transparent', font: '700 12px var(--sans)', color: 'var(--inkMute)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => { commitFlag(f, true); setConfirmId(null); }}
                    style={{ border: 'none', background: 'var(--danger)', color: '#fff', font: '700 12px var(--sans)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}>Enable now</button>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </React.Fragment>
  );
}

// ── section rail ──────────────────────────────────────────────────────────
function CcpRail({ active, onNav, customizedSet }) {
  return (
    <nav aria-label="Config sections" style={{ width: 216, flexShrink: 0, overflowY: 'auto', paddingRight: 6 }}>
      {CCP_GROUPS.map((g) => (
        <div key={g.g} style={{ marginBottom: 10 }}>
          <div style={{ font: '700 9.5px var(--mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--inkFaint)', padding: '8px 10px 5px' }}>{g.g}</div>
          {g.keys.map((k) => {
            const on = active === k;
            const p1 = CCP_PHASE1.includes(k);
            return (
              <button key={k} onClick={() => onNav(k)} className="ccp-railitem"
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: on ? 'var(--tealTint)' : 'transparent', color: on ? 'var(--teal)' : 'var(--inkMute)', font: `${on ? 700 : 600} 12.5px var(--sans)`, position: 'relative', minHeight: 36 }}>
                {on && <span style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: 'var(--teal)', borderRadius: 999 }}></span>}
                <span style={{ flex: 1, lineHeight: 1.25 }}>{CCP_SECTIONS[k].label}</span>
                {!p1 && <span style={{ font: '700 8px var(--mono)', letterSpacing: '.1em', color: 'var(--inkFaint)', border: '1px solid var(--rule)', borderRadius: 4, padding: '1.5px 5px', flexShrink: 0 }}>SOON</span>}
                {customizedSet.has(k) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }}></span>}
              </button>
            );
          })}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }}></span>
        <span style={{ fontSize: 10, color: 'var(--inkFaint)' }}>customized for {CCP_ADMIN.company}</span>
      </div>
    </nav>
  );
}

// ── find-a-setting palette ────────────────────────────────────────────────
function CcpSearchPalette({ open, onClose, onJump, cfg }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return CCP_ALL_ITEMS.filter((it) =>
      it.label.toLowerCase().includes(s) || it.sectionLabel.toLowerCase().includes(s) ||
      (it.desc || '').toLowerCase().includes(s) || (it.group || '').toLowerCase().includes(s)
    ).slice(0, 8);
  }, [q]);
  useEffect(() => { setSel(0); }, [results.length]);
  if (!open) return null;
  const jump = (r) => { if (r) { onJump(r); onClose(); } };
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,11,7,.4)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
      <div role="dialog" aria-label="Find a setting" style={{ width: 'min(560px, 92vw)', background: 'var(--surface)', border: '1px solid var(--ruleStrong)', borderRadius: 16, boxShadow: '0 24px 60px rgba(14,11,7,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--rule)' }}>
          <CCPDS.Icon name="search" size={16} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a setting — try “mdrt”, “streak”, “kiosk”…"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(x + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(x - 1, 0)); }
              if (e.key === 'Enter') jump(results[sel]);
              if (e.key === 'Escape') onClose();
            }}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: '600 14px var(--sans)', color: 'var(--ink)' }} aria-label="Find a setting" />
          <kbd style={{ font: '700 10px var(--mono)', color: 'var(--inkMute)', background: 'var(--surfaceMute)', border: '1px solid var(--rule)', borderRadius: 5, padding: '2px 6px' }}>ESC</kbd>
        </div>
        {q.trim() !== '' && (
          <div style={{ padding: 6, maxHeight: 380, overflowY: 'auto' }}>
            {results.length === 0 && <div style={{ padding: '18px 14px', fontSize: 12.5, color: 'var(--inkFaint)' }}>No settings match “{q}”.</div>}
            {results.map((r, i) => (
              <button key={r.id} onClick={() => jump(r)} onMouseEnter={() => setSel(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: i === sel ? 'var(--tealTint)' : 'transparent' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', font: '700 9.5px var(--mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: i === sel ? 'var(--teal)' : 'var(--inkFaint)' }}>{r.sectionLabel}</span>
                  <span style={{ display: 'block', font: '600 13px var(--sans)', color: 'var(--ink)', marginTop: 2 }}>{r.label}</span>
                </span>
                <span style={{ font: '500 11px var(--mono)', color: 'var(--inkMute)', flexShrink: 0 }}>{r.lock === 'soon' ? 'HARDCODED' : r.lock === 'platform' ? 'PLATFORM' : ccpPreview(r, cfg.effective(r.id))}</span>
              </button>
            ))}
            {results.length > 0 && (
              <div style={{ display: 'flex', gap: 14, padding: '9px 12px 6px', borderTop: '1px solid var(--rule)', marginTop: 4 }}>
                {['↑↓ MOVE', '↵ JUMP TO SETTING', 'ESC CLOSE'].map((s) => <span key={s} style={{ font: '500 10px var(--mono)', color: 'var(--inkFaint)' }}>{s}</span>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── change history drawer ─────────────────────────────────────────────────
function CcpHistory({ open, onClose, log }) {
  if (!open) return null;
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(14,11,7,.3)', zIndex: 55, display: 'flex', justifyContent: 'flex-end' }}>
      <div role="dialog" aria-label="Change history" style={{ width: 'min(400px, 94vw)', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--ruleStrong)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: '1px solid var(--rule)' }}>
          <CCPDS.Icon name="history" size={17} />
          <span style={{ font: '800 16px var(--display)', letterSpacing: '-.015em', color: 'var(--ink)', flex: 1 }}>Change history</span>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', color: 'var(--inkMute)', cursor: 'pointer', padding: 6, display: 'grid', placeItems: 'center' }}><CcpIconX size={14} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 20px' }}>
          {log.length === 0 && <div style={{ padding: '20px 0', fontSize: 12.5, color: 'var(--inkFaint)' }}>No changes yet.</div>}
          {log.map((e, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ font: '700 9.5px var(--mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: e.correction ? 'var(--danger)' : 'var(--inkFaint)' }}>{e.correction ? 'CORRECTION · ' : ''}{e.section}</div>
              <div style={{ font: '600 13px var(--sans)', color: 'var(--ink)', marginTop: 3 }}>{e.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--inkMute)', marginTop: 3, fontFamily: 'var(--mono)' }}>{e.from} → <b style={{ color: e.correction ? 'var(--danger)' : 'var(--teal)' }}>{e.to}</b></div>
              {e.reason && <div style={{ fontSize: 11, color: 'var(--inkMute)', marginTop: 3, lineHeight: 1.45 }}>“{e.reason}”</div>}
              <div style={{ fontSize: 11, color: 'var(--inkFaint)', marginTop: 3 }}>{e.who} · {e.date}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--rule)', fontSize: 11, color: 'var(--inkFaint)' }}>Full audit trail lives in the Audit Log.</div>
      </div>
    </div>
  );
}

// ── correct-a-past-value — deliberately friction-ful escape hatch ────────
function CcpCorrectModal({ item, meta, onClose, onConfirm }) {
  const [reason, setReason] = React.useState('');
  const [val, setVal] = React.useState(() => ccpPreview(item, meta.value));
  const ok = reason.trim().length >= 10;
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,11,7,.45)', zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div role="dialog" aria-label="Correct a past value" style={{ width: 'min(520px, 94vw)', background: 'var(--surface)', border: '1px solid var(--ruleStrong)', borderRadius: 16, boxShadow: '0 24px 60px rgba(14,11,7,.4)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--dangerTint)', color: 'var(--danger)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><CCPDS.Icon name="alert" size={16} /></span>
          <div>
            <div style={{ font: '800 16px var(--display)', letterSpacing: '-.015em', color: 'var(--ink)' }}>Correct a past value</div>
            <div style={{ fontSize: 11.5, color: 'var(--inkMute)', marginTop: 1 }}>{item.label} · in force since {meta.eff}</div>
          </div>
        </div>
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.55 }}>
            This is not a normal change. It rewrites the value <b>already used to score past periods</b> — use it only for genuine mistakes, like a typo’d threshold.
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--warningTint)', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)', borderRadius: 10, fontSize: 11.5, color: 'var(--ink)', lineHeight: 1.55 }}>
            Saving re-derives, for every affected period: pace flags on past WARs · award &amp; club qualification · Master Sheet summaries. All {CCP_ADMIN.users} users see the corrected history.
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '700 10px var(--mono)', letterSpacing: '.12em', color: 'var(--inkFaint)' }}>CORRECTED VALUE (FROM {meta.eff.toUpperCase()})</span>
            <input className="ccp-input" value={val} onChange={(e) => setVal(e.target.value)}
              style={{ width: 170, padding: '8px 12px', border: '1.5px solid var(--ruleStrong)', borderRadius: 9, background: 'var(--surface)', font: '700 13px var(--mono)', color: 'var(--ink)', outline: 'none' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '700 10px var(--mono)', letterSpacing: '.12em', color: 'var(--inkFaint)' }}>REASON — REQUIRED, WRITTEN TO THE AUDIT LOG</span>
            <textarea className="ccp-input" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Threshold entered as 96,000 instead of 960,000 when the season opened."
              style={{ resize: 'vertical', padding: '9px 12px', border: '1.5px solid var(--ruleStrong)', borderRadius: 9, background: 'var(--surface)', font: '500 12.5px var(--sans)', color: 'var(--ink)', outline: 'none', lineHeight: 1.5 }} />
            {!ok && reason.length > 0 && <span style={{ fontSize: 10.5, color: 'var(--inkFaint)' }}>A few more words — the reason is the audit trail.</span>}
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--rule)', background: 'var(--surfaceMute)' }}>
          <button className="ccp-link" onClick={onClose} style={{ border: 'none', background: 'transparent', font: '700 12.5px var(--sans)', color: 'var(--inkMute)', cursor: 'pointer', padding: '8px 6px' }}>Cancel</button>
          <button disabled={!ok} onClick={() => onConfirm(val, reason.trim())}
            style={{ border: 'none', background: ok ? 'var(--danger)' : 'var(--surfaceMute)', color: ok ? '#fff' : 'var(--inkFaint)', font: '700 13px var(--sans)', padding: '10px 18px', borderRadius: 10, cursor: ok ? 'pointer' : 'default', minHeight: 40, border: ok ? 'none' : '1px solid var(--rule)' }}>Rewrite past periods</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ccpLoad, ccpSave, ccpEq, CcpRow, CcpGroupCard, CcpFlagsSection, CcpRail, CcpSearchPalette, CcpHistory, CcpProvenance, CcpDatedBits, CcpCorrectModal });
