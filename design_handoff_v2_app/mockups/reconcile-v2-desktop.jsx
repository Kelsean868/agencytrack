// AgencyTrack — Policy Reconciliation v2. Desktop manager surface.
//   • PolicyReconScene — at-risk summary + worklist of settled records to
//     reconcile (clean matches, exceptions, missing, unmatched), filterable.
//   • ReconDrawer — one record: side-by-side Submitted | Settled (Tatil)
//     compare, the manager keys in the Tatil figure, the delta is computed,
//     and resolution actions fire (Confirm / Dispute / Add / Resolve / Escalate)
//     with the downstream impact (commissions, awards, campaigns) spelled out.
// Wraps ManagerShell (active='recon'). teal = ledger · gold = confirmed value.

function reconStateMeta(t, state) {
  const m = RECON_STATE[state] || RECON_STATE.pending;
  const tone = m.tone;
  const fg = tone === 'success' ? t.success : tone === 'gold' ? t.gold : tone === 'danger' ? t.danger : t.warning;
  const bg = tone === 'success' ? t.successTint : tone === 'gold' ? t.goldTint : tone === 'danger' ? t.dangerTint : t.warningTint;
  return { fg, bg, label: m.label };
}

function ReconStatePill({ t, state }) {
  const m = reconStateMeta(t, state);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: m.bg, color: m.fg, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{m.label}</span>;
}

// ── Worklist row ──────────────────────────────────────────────────────────
function ReconRow({ t, r, active, onOpen }) {
  const delta = recDelta(r);
  const subApi = r.submitted ? ttd(r.submitted.api) : '—';
  const setApi = r.settled ? ttd(r.settled.api) : 'awaiting';
  const clean = r.flag === 'clean';
  return (
    <div onClick={onOpen} className="a-card" style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 15px',
      background: active ? t.tealTint : t.surface,
      border: `1px solid ${active ? t.teal + '88' : isException(r) ? discTone(t, r.flag) + '33' : t.rule}`,
      borderRadius: 12, cursor: 'pointer',
    }}>
      <Avatar2 t={t} name={r.unmatched ? r.insured : r.agent} tone={clean ? 'teal' : 'gold'} size={36} />
      <div style={{ width: 150, flexShrink: 0, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.flag === 'unmatched' ? r.insured : r.agent}</div>
        <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{r.unit} · {r.policyNo}</div>
      </div>

      {/* Submitted → Settled */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>SUBMITTED</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{subApi}</div>
        </div>
        <IconChevR size={14} color={t.inkDim} stroke={2} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>TATIL SETTLED</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: r.settled ? (delta && delta !== 0 ? t.danger : t.ink) : t.warning, fontFamily: APP_FONT_MONO }}>{setApi}</div>
        </div>
      </div>

      {/* Delta */}
      <div style={{ width: 92, textAlign: 'right', flexShrink: 0 }}>
        {delta != null ? <DeltaChip t={t} delta={delta} /> : <span style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, fontStyle: 'italic' }}>{r.flag === 'missing' ? 'not found' : r.flag === 'unmatched' ? 'no entry' : '—'}</span>}
      </div>

      {/* Flag + state */}
      <div style={{ width: 138, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}><DiscrepancyBadge t={t} flag={r.flag} /></div>
      <div style={{ width: 110, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        {clean && r.state === 'pending'
          ? <span style={{ padding: '6px 12px', background: t.teal, color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>Confirm</span>
          : <ReconStatePill t={t} state={r.state} />}
      </div>
      <IconChevR size={15} color={t.inkFaint} stroke={2.4} />
    </div>
  );
}

// ── Reconcile drawer ──────────────────────────────────────────────────────
function ReconDrawer({ t, id, keyedIn = false }) {
  const r = RECON_RECORDS.find((x) => x.id === id) || RECON_RECORDS[0];
  const d = DISCREPANCY[r.flag];
  const delta = recDelta(r);
  const clean = r.flag === 'clean';
  const hasSettled = !!r.settled;
  const fg = discTone(t, r.flag);

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)', animation: 'app-fade-in 280ms ease both', zIndex: 20 }}></div>
      <div className="a-card" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 500,
        background: t.surface, borderLeft: `1px solid ${t.rule}`, zIndex: 21,
        display: 'flex', flexDirection: 'column', animation: 'app-slide-in 320ms cubic-bezier(0.22,1,0.36,1) both',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.16)',
      }}>
        {/* Close + flag */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${t.rule}` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>✕ Close</span>
          <div style={{ flex: 1 }}></div>
          <DiscrepancyBadge t={t} flag={r.flag} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Avatar2 t={t} name={r.flag === 'unmatched' ? r.insured : r.agent} size={48} tone={clean ? 'teal' : 'gold'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY }}>{r.flag === 'unmatched' ? r.insured : r.agent}</div>
              <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1, fontFamily: APP_FONT_MONO }}>{r.unit} · {r.policyNo}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: t.inkMute, marginTop: 10 }}>{r.product} · {r.plan} · insured {r.insured}</div>

          {/* What's wrong */}
          {!clean && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: discBg(t, r.flag), border: `1px solid ${fg}33`, borderRadius: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: fg }}>{d.label}</span>
              </div>
              <div style={{ fontSize: 11.5, color: t.ink, marginTop: 5, lineHeight: 1.5 }}>{r.note || d.blurb}</div>
            </div>
          )}

          {/* Side-by-side compare */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1, fontSize: 9.5, fontWeight: 700, color: t.teal, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>● LEDGER · SUBMITTED</div>
              <div style={{ flex: 1, textAlign: 'right', fontSize: 9.5, fontWeight: 700, color: t.gold, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>TATIL REPORT ●</div>
            </div>
            <CompareField t={t} label="API"
              submitted={r.submitted ? ttd(r.submitted.api) : '— no entry'}
              settled={r.settled ? ttd(r.settled.api) : (keyedIn ? '…' : 'not keyed')}
              mismatch={hasSettled && r.submitted && r.settled.api !== r.submitted.api} />
            <CompareField t={t} label="Premium"
              submitted={r.submitted ? `${ttd(r.submitted.premium)}/${r.submitted.freq}` : '—'}
              settled={r.settled ? ttd(r.settled.premium) : '—'}
              mismatch={hasSettled && r.submitted && r.settled.premium !== r.submitted.premium} />
            <CompareField t={t} label="Status"
              submitted={r.submitted ? r.submitted.status.toUpperCase() : '—'}
              settled={r.settled ? r.settled.status.toUpperCase() : '—'}
              mismatch={hasSettled && r.submitted && r.settled.status !== r.submitted.status} />
            <CompareField t={t} label="Period"
              submitted={r.submitted ? r.submitted.month : '—'}
              settled={r.settled ? r.settled.month : '—'}
              mismatch={hasSettled && r.submitted && r.settled.month !== r.submitted.month} />

            {/* Delta read */}
            {delta != null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '11px 14px', background: delta === 0 ? t.successTint : t.dangerTint, border: `1px solid ${delta === 0 ? t.success : t.danger}33`, borderRadius: 11 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: t.ink }}>{delta === 0 ? 'Figures agree' : 'Difference to resolve'}</span>
                <DeltaChip t={t} delta={delta} big />
              </div>
            )}
          </div>

          {/* Key-in affordance — manager enters the Tatil figure */}
          {!hasSettled && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: t.surfaceSoft, border: `1px dashed ${t.ruleStrong}`, borderRadius: 12 }}>
              <ReconEyebrow t={t} color={t.gold}>Key in Tatil figure</ReconEyebrow>
              <div style={{ fontSize: 11.5, color: t.inkMute, margin: '6px 0 11px', lineHeight: 1.5 }}>This policy isn't in Tatil's file yet. Enter the settled figure from the report, or escalate to trace it.</div>
              <div style={{ display: 'flex', gap: 9 }}>
                <div style={{ flex: 1, padding: '10px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>SETTLED API</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.inkDim, fontFamily: APP_FONT_MONO, marginTop: 3 }}>TTD ____</div>
                </div>
                <div style={{ flex: 1, padding: '10px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>STATUS</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.inkDim, fontFamily: APP_FONT_MONO, marginTop: 3 }}>Select…</div>
                </div>
              </div>
            </div>
          )}

          {/* Downstream impact — the stakes */}
          <div style={{ marginTop: 16 }}>
            <ReconEyebrow t={t} color={t.inkFaint}>Downstream impact</ReconEyebrow>
            <div style={{ marginTop: 9, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 11.5, color: t.ink, lineHeight: 1.55 }}>
                {clean
                  ? 'Confirming locks this API into commissions, persistency, and the awards/campaign rollup.'
                  : r.flag === 'status'
                    ? 'If Tatil\u2019s NTU stands, this API must come OUT of commissions and any campaign/award progress it was counted toward.'
                    : r.flag === 'unmatched'
                      ? 'Until matched to an agent, this settled API counts toward no one\u2019s commissions or awards.'
                      : 'The delta changes commissionable API, persistency, and what this policy contributes to awards + campaigns.'}
              </div>
              {r.feeds && r.feeds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>FEEDS:</span>
                  {r.feeds.map((f) => (
                    <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', background: t.goldTint, color: t.gold, borderRadius: 999, fontSize: 10, fontWeight: 700 }}>★ {f}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Confirmed footprint */}
          {r.state === 'confirmed' && (
            <div style={{ marginTop: 14, padding: '11px 14px', background: t.goldTint, border: `1px solid ${t.gold}33`, borderRadius: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconCheck size={16} color={t.gold} stroke={2.4} />
              <div style={{ fontSize: 11.5, color: t.ink }}>Confirmed by {r.confirmedBy} · {r.confirmedOn} · locked for awards &amp; persistency</div>
            </div>
          )}
        </div>

        {/* Footer actions — depend on flag */}
        <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${t.rule}` }}>
          {clean && r.state === 'pending' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="a-card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}>
                <IconCheck size={15} color="#fff" stroke={2.4} /> Confirm settlement
              </div>
              <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>Dispute</div>
            </div>
          ) : r.state === 'confirmed' ? (
            <div style={{ fontSize: 11.5, color: t.inkMute, textAlign: 'center' }}>✓ Reconciled &amp; locked. No further action.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {r.flag === 'unmatched' ? (
                <>
                  <ActionBtn t={t} primary icon={IconPlus} label="Add to ledger" />
                  <ActionBtn t={t} label="Match to agent" />
                  <ActionBtn t={t} label="Escalate" tone="danger" />
                </>
              ) : r.flag === 'missing' ? (
                <>
                  <ActionBtn t={t} primary icon={IconBolt} label="Escalate to head office" tone="danger" />
                  <ActionBtn t={t} label="Keep / dispute" />
                  <ActionBtn t={t} label="Resolve with note" />
                </>
              ) : r.flag === 'duplicate' ? (
                <>
                  <ActionBtn t={t} primary icon={IconCheck} label="Confirm one, void other" />
                  <ActionBtn t={t} label="Resolve with note" />
                </>
              ) : (
                <>
                  <ActionBtn t={t} primary icon={IconAlert} label="Keep mine / dispute" tone="danger" />
                  <ActionBtn t={t} label="Resolve with note" />
                  <ActionBtn t={t} label="Escalate" />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ActionBtn({ t, label, icon: Ic, primary = false, tone = 'teal' }) {
  const c = tone === 'danger' ? t.danger : t.teal;
  return (
    <div className="a-card" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 10,
      fontSize: 12, fontWeight: 700, cursor: 'pointer',
      background: primary ? c : t.surface, color: primary ? '#fff' : t.inkMute,
      border: primary ? 'none' : `1px solid ${t.rule}`,
      boxShadow: primary ? `0 2px 8px ${c}44` : 'none',
    }}>
      {Ic && <Ic size={14} color={primary ? '#fff' : t.inkMute} stroke={2.2} />} {label}
    </div>
  );
}

// ── SCENE ─────────────────────────────────────────────────────────────────
function PolicyReconScene({ t, drawer = null, drawerKeyedIn = false, filter = 'all' }) {
  const atRisk = reconAtRisk();
  const list = filter === 'clean' ? RECON_CLEAN
    : filter === 'exceptions' ? RECON_EXCEPTIONS
    : filter === 'done' ? RECON_CONFIRMED
    : RECON_RECORDS.filter((r) => r.state !== 'confirmed');
  const filters = [
    { key: 'all', label: 'To reconcile', count: RECON_PENDING_COUNT },
    { key: 'clean', label: 'Clean · ready', count: RECON_CLEAN.length },
    { key: 'exceptions', label: 'Exceptions', count: RECON_EXCEPTIONS.length },
    { key: 'done', label: 'Confirmed', count: RECON_CONFIRMED.length },
  ];

  return (
    <ManagerShell t={t} active="recon" title="Policy Reconciliation" subtitle="Confirm Tatil settlements against the ledger — clear what's at risk" teamView>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden', position: 'relative' }}>
        {/* Summary */}
        <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '16px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
          <div className="a-glow-soft" style={{ position: 'absolute', top: -90, right: -60, width: 300, height: 300, background: `radial-gradient(circle, ${t.dangerTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ flexShrink: 0 }}>
              <ReconEyebrow t={t} color={t.danger}>★ TTD at risk this cycle</ReconEyebrow>
              <div style={{ fontSize: 34, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 7 }}>{ttd(atRisk)}</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 6 }}>across {RECON_EXCEPTIONS.length} exceptions · feeds commissions, awards &amp; campaigns</div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: t.rule, margin: '2px 0' }}></div>
            <div style={{ flex: 1, display: 'flex', gap: 12 }}>
              <ReconTile t={t} label="CLEAN · READY" count={RECON_CLEAN.length} value="confirm in one tap" color={t.success} />
              <ReconTile t={t} label="EXCEPTIONS" count={RECON_EXCEPTIONS.length} value="need a decision" color={t.warning} active />
              <ReconTile t={t} label="CONFIRMED" count={RECON_CONFIRMED.length} value="locked this cycle" color={t.gold} />
            </div>
          </div>
        </div>

        {/* Filter row */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
            {filters.map((f) => {
              const on = f.key === filter;
              return (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.ink : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent' }}>
                  {f.label}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '0 6px', background: on ? t.tealTint : 'transparent', color: on ? t.teal : t.inkFaint, borderRadius: 999, fontFamily: APP_FONT_MONO }}>{f.count}</span>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1 }}></div>
          {RECON_CLEAN.length > 0 && (
            <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}>
              <IconCheck size={15} color="#fff" stroke={2.4} /> Confirm all {RECON_CLEAN.length} clean
            </div>
          )}
        </div>

        {/* Worklist */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, paddingRight: 4 }}>
          {list.map((r) => <ReconRow key={r.id} t={t} r={r} active={drawer === r.id} onOpen={() => {}} />)}
        </div>

        {drawer && <ReconDrawer t={t} id={drawer} keyedIn={drawerKeyedIn} />}
      </div>
    </ManagerShell>
  );
}

Object.assign(window, {
  reconStateMeta, ReconStatePill, ReconRow, ReconDrawer, ActionBtn, PolicyReconScene,
});
