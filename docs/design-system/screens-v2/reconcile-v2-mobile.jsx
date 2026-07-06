// AgencyTrack — Policy Reconciliation v2. Mobile surfaces (390×844).
//   • ReconMgrMobile  — manager: at-risk hero + worklist of records to clear.
//   • ReconAgentMobile — agent (Marsha): MY settlements, how each reconciled
//     against what I submitted, and what's disputed / awaiting. This is the
//     "agent reconciles their own" half — transparency on confirmed value.
// Manager uses ManagerMNav; agent uses MNav.

// ── Manager mobile ────────────────────────────────────────────────────────
function ReconMgrMobile({ t }) {
  const atRisk = reconAtRisk();
  const list = RECON_RECORDS.filter((r) => r.state !== 'confirmed');
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.rule}`, zIndex: 10 }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY }}>Reconciliation</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{RECON_PENDING_COUNT} to clear · {RECON_EXCEPTIONS.length} exceptions</div>
      </div>

      <div style={{ position: 'absolute', top: 102, left: 0, right: 0, bottom: 92, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {/* At-risk hero */}
        <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '16px 18px', background: t.surface, border: `1px solid ${t.danger}44`, borderRadius: 17 }}>
          <div className="a-glow-soft" style={{ position: 'absolute', top: -70, right: -50, width: 200, height: 200, background: `radial-gradient(circle, ${t.dangerTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
          <div style={{ position: 'relative' }}>
            <ReconEyebrow t={t} color={t.danger}>★ TTD at risk this cycle</ReconEyebrow>
            <div style={{ fontSize: 34, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 7 }}>{ttd(atRisk)}</div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 6 }}>feeds commissions, awards &amp; campaign payouts</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
              {[['CLEAN', RECON_CLEAN.length, t.success], ['EXCEPTIONS', RECON_EXCEPTIONS.length, t.warning], ['DONE', RECON_CONFIRMED.length, t.gold]].map(([k, v, c]) => (
                <div key={k} style={{ flex: 1, padding: '8px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: APP_FONT_DISPLAY }}>{v}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO, marginTop: 2 }}>{k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {RECON_CLEAN.length > 0 && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', background: t.teal, color: '#fff', borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: `0 4px 14px ${t.teal}44` }}>
            <IconCheck size={15} color="#fff" stroke={2.4} /> Confirm all {RECON_CLEAN.length} clean
          </div>
        )}

        {list.map((r) => {
          const delta = recDelta(r);
          return (
            <div key={r.id} className="a-card" style={{ flexShrink: 0, padding: '13px 14px', background: t.surface, border: `1px solid ${isException(r) ? discTone(t, r.flag) + '33' : t.rule}`, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar2 t={t} name={r.flag === 'unmatched' ? r.insured : r.agent} size={34} tone={r.flag === 'clean' ? 'teal' : 'gold'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{r.flag === 'unmatched' ? r.insured : r.agent}</div>
                  <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{r.unit} · {r.policyNo}</div>
                </div>
                <DiscrepancyBadge t={t} flag={r.flag} small />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11, padding: '9px 11px', background: t.surfaceSoft, borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>SUBMITTED</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{r.submitted ? ttd(r.submitted.api) : '—'}</div>
                </div>
                <IconChevR size={13} color={t.inkDim} stroke={2} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>TATIL</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: r.settled ? (delta ? t.danger : t.ink) : t.warning, fontFamily: APP_FONT_MONO }}>{r.settled ? ttd(r.settled.api) : 'awaiting'}</div>
                </div>
                <div style={{ flexShrink: 0 }}>{delta != null ? <DeltaChip t={t} delta={delta} /> : null}</div>
              </div>
            </div>
          );
        })}
      </div>

      <ManagerMNav t={t} active="more" />
    </MFrame>
  );
}

// ── Agent mobile — MY reconciliation ──────────────────────────────────────
function ReconAgentMobile({ t }) {
  const me = 'Marsha Singh';
  const mine = RECON_RECORDS.filter((r) => r.agent === me);
  const confirmedVal = mine.filter((r) => r.state === 'confirmed').reduce((s, r) => s + (r.settled?.api || 0), 0);
  const disputedVal = mine.filter((r) => r.state === 'disputed' || (isException(r) && r.state === 'pending')).reduce((s, r) => s + Math.abs(recDelta(r) || r.submitted?.api || 0), 0);

  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.rule}`, zIndex: 10 }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY }}>My settlements</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>How Tatil settled each policy you submitted</div>
      </div>

      <div style={{ position: 'absolute', top: 102, left: 0, right: 0, bottom: 92, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {/* Confirmed vs in question */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 10 }}>
          <div className="a-card a-rise" style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '15px 16px', background: t.surface, border: `1px solid ${t.gold}44`, borderRadius: 16 }}>
            <div className="a-glow-soft" style={{ position: 'absolute', top: -50, right: -40, width: 150, height: 150, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
            <div style={{ position: 'relative' }}>
              <ReconEyebrow t={t} color={t.gold}>★ Confirmed</ReconEyebrow>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 6 }}>{ttd(confirmedVal)}</div>
              <div style={{ fontSize: 10, color: t.inkMute, marginTop: 3 }}>locked for awards</div>
            </div>
          </div>
          <div className="a-card a-rise" style={{ flex: 1, padding: '15px 16px', background: t.surface, border: `1px solid ${t.danger}33`, borderRadius: 16 }}>
            <ReconEyebrow t={t} color={t.danger}>In question</ReconEyebrow>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 6 }}>{ttd(disputedVal)}</div>
            <div style={{ fontSize: 10, color: t.inkMute, marginTop: 3 }}>needs follow-up</div>
          </div>
        </div>

        {mine.map((r) => {
          const delta = recDelta(r);
          const clean = r.flag === 'clean';
          const confirmed = r.state === 'confirmed';
          return (
            <div key={r.id} className="a-card" style={{ flexShrink: 0, padding: '14px 15px', background: t.surface, border: `1px solid ${confirmed ? t.gold + '33' : isException(r) ? discTone(t, r.flag) + '33' : t.rule}`, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{r.insured}</div>
                  <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{r.plan} · {r.policyNo}</div>
                </div>
                {confirmed ? <ReconStatePill t={t} state="confirmed" /> : <DiscrepancyBadge t={t} flag={r.flag} small />}
              </div>

              {clean ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, fontSize: 12, color: t.inkMute }}>
                  <IconCheck size={15} color={t.success} stroke={2.4} />
                  Settled at <span style={{ color: t.ink, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{ttd(r.settled.api)}</span> — matches your submission
                </div>
              ) : (
                <div style={{ marginTop: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: t.surfaceSoft, borderRadius: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>YOU SUBMITTED</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{r.submitted ? ttd(r.submitted.api) : '—'}</div>
                    </div>
                    <IconChevR size={13} color={t.inkDim} stroke={2} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>TATIL SETTLED</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_MONO }}>{r.settled ? (r.settled.status === 'ntu' ? 'NTU' : ttd(r.settled.api)) : 'missing'}</div>
                    </div>
                    {delta != null && <DeltaChip t={t} delta={delta} />}
                  </div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 8, lineHeight: 1.5 }}>{r.note}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <div style={{ flex: 1, textAlign: 'center', padding: '9px', background: t.danger, color: '#fff', borderRadius: 9, fontSize: 12, fontWeight: 700 }}>Dispute</div>
                    <div style={{ flex: 1, textAlign: 'center', padding: '9px', background: t.surface, border: `1px solid ${t.rule}`, color: t.inkMute, borderRadius: 9, fontSize: 12, fontWeight: 700 }}>Accept Tatil</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <MNav t={t} active="more" />
    </MFrame>
  );
}

Object.assign(window, { ReconMgrMobile, ReconAgentMobile });
