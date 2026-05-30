// AgencyTrack — CRO ops surfaces. Desktop.
//   • SubmissionsScene  — the data-entry queue: new business the CRO keys into
//     Tatil. Branch-issued products (Annuity, Funeral Expense) are flagged —
//     she can issue + settle those here; everything else is enter-only and
//     comes back later with an issue date (= settlement date).
//   • SettlementsScene  — branch-issued issue+settle workspace + the awaiting-
//     Tatil list (enter-only) where she records the returned issue date.
//   • WeeklyReportScene — the Friday 4pm production report: an entry/compile
//     screen on the left, a live preview of the report that goes out on the right.
// Wraps CROShell. teal = data entry · gold = branch-issued/settled.

// ── Branch-issued badge ───────────────────────────────────────────────────
function ProductTag({ t, product, branchIssued }) {
  const c = branchIssued ? t.gold : t.inkMute;
  const bg = branchIssued ? t.goldTint : t.surfaceMute;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, background: bg, color: c, fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>
      {branchIssued ? '★ ' : ''}{product}
    </span>
  );
}

// ── SUBMISSIONS (data entry) ──────────────────────────────────────────────
function SubmissionsScene({ t }) {
  const toEnter = SUBMISSIONS.filter((s) => s.state === 'to_enter');
  const entered = SUBMISSIONS.filter((s) => s.state === 'entered');
  const totalApi = SUBMISSIONS.reduce((s, x) => s + x.api, 0);

  return (
    <CROShell t={t} active="submissions" title="Submissions" subtitle={`New business to enter on Tatil · ${CRO_NOW}`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
        {/* Stat strip */}
        <div className="a-card a-rise" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 26, padding: '15px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
          {[
            { k: 'TO ENTER', v: toEnter.length, c: t.warning },
            { k: 'ENTERED TODAY', v: entered.length, c: t.success },
            { k: 'BRANCH-ISSUED', v: SUB_BRANCH_ISSUE.length, c: t.gold },
            { k: 'API IN QUEUE', v: ttd(totalApi), c: t.teal },
          ].map((s) => (
            <div key={s.k}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginTop: 4 }}>{s.k}</div>
            </div>
          ))}
          <div style={{ flex: 1 }}></div>
          <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}>
            <IconPlus size={16} color="#fff" stroke={2.4} /> New submission
          </div>
        </div>

        {/* To-enter queue */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <CroEyebrow t={t} color={t.warning}>● To enter on Tatil</CroEyebrow>
            <span style={{ fontSize: 11, color: t.inkFaint }}>{toEnter.length} policies waiting</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {toEnter.map((s) => (
              <div key={s.id} className="a-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: t.surface, border: `1px solid ${s.branchIssued ? t.gold + '44' : t.rule}`, borderRadius: 12 }}>
                <div style={{ width: 160, flexShrink: 0, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{s.owner}</div>
                  <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>rec'd {s.date}</div>
                </div>
                <div style={{ width: 150, flexShrink: 0 }}><ProductTag t={t} product={s.product} branchIssued={s.branchIssued} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: t.inkMute }}>{s.plan}</div>
                  <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{s.agent} · {s.unit}</div>
                </div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{ttd(s.api)}</div>
                <div style={{ width: 132, display: 'flex', justifyContent: 'flex-end' }}>
                  {s.branchIssued
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: t.gold, color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}><IconWallet size={13} color="#fff" /> Issue & settle</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: t.teal, color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}><IconArrowR size={13} color="#fff" stroke={2.4} /> Enter on Tatil</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Entered */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, flexShrink: 0 }}>
            <CroEyebrow t={t} color={t.success}>✓ Entered today</CroEyebrow>
            <span style={{ fontSize: 11, color: t.inkFaint }}>keyed into Tatil · flow into the weekly report</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
            {entered.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                <IconCheck size={15} color={t.success} stroke={2.4} />
                <div style={{ width: 150, flexShrink: 0, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{s.owner}</div>
                  <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{s.policyNo}</div>
                </div>
                <div style={{ width: 150, flexShrink: 0 }}><ProductTag t={t} product={s.product} branchIssued={s.branchIssued} /></div>
                <div style={{ flex: 1, fontSize: 12, color: t.inkMute }}>{s.agent} · {s.unit}</div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{ttd(s.api)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CROShell>
  );
}

// ── SETTLEMENTS ───────────────────────────────────────────────────────────
function SettlementsScene({ t }) {
  // branch-issued the CRO can settle herself
  const branchIssue = SUBMISSIONS.filter((s) => s.branchIssued && s.state === 'to_enter');
  // everything else: entered on Tatil, awaiting return with an issue date
  const awaiting = [
    { policyNo: 'TL-2026-08712', owner: 'Nadia Persad',  product: 'Universal Life', api: 33600, agent: 'Selina Mohammed', sent: 'Nov 26' },
    { policyNo: 'TL-2026-08709', owner: 'Kern Bridglal',  product: 'Life',           api: 16800, agent: 'Anand Persad',    sent: 'Nov 26' },
    { policyNo: 'TL-2026-08698', owner: 'Dexter Joseph',  product: 'Life',           api: 30000, agent: 'Marsha Singh',    sent: 'Nov 25' },
  ];
  return (
    <CROShell t={t} active="settlements" title="Settlements" subtitle="Issue branch products · record returned issue dates">
      <div style={{ height: '100%', display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* LEFT — branch-issued issue+settle */}
        <div style={{ width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '16px 20px', background: t.surface, border: `1px solid ${t.gold}44`, borderRadius: 14 }}>
            <div className="a-glow-soft" style={{ position: 'absolute', top: -70, right: -50, width: 220, height: 220, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
            <div style={{ position: 'relative' }}>
              <CroEyebrow t={t} color={t.gold}>★ Branch-issued · issue &amp; settle here</CroEyebrow>
              <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 7, lineHeight: 1.5 }}>Annuities and Funeral Expense are issued and settled at the branch. Settling here writes the API straight to the ledger.</div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
            {branchIssue.map((s) => (
              <div key={s.id} className="a-card" style={{ padding: '14px 16px', background: t.surface, border: `1px solid ${t.gold}33`, borderRadius: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{s.owner}</div>
                    <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{s.plan}</div>
                  </div>
                  <ProductTag t={t} product={s.product} branchIssued />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <div style={{ flex: 1, padding: '9px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>API</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, marginTop: 2 }}>{ttd(s.api)}</div>
                  </div>
                  <div style={{ flex: 1, padding: '9px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>ISSUE DATE</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, marginTop: 2 }}>Today</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, padding: '10px', background: t.gold, color: '#fff', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  <IconCheck size={15} color="#fff" stroke={2.4} /> Issue &amp; settle · {s.agent.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — awaiting Tatil return (enter-only) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="a-card" style={{ flex: 1, minHeight: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, flexShrink: 0 }}>
              <CroEyebrow t={t} color={t.teal}>Entered on Tatil · awaiting return</CroEyebrow>
              <span style={{ fontSize: 11, color: t.inkMute }}>{awaiting.length} policies</span>
            </div>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginBottom: 14, flexShrink: 0, lineHeight: 1.5 }}>
              These were keyed into Tatil and underwritten centrally. When a policy comes back it carries the <b>issue date — which is the settlement date</b>. Record it here and it flows to reconciliation.
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, paddingRight: 4 }}>
              {awaiting.map((s) => (
                <div key={s.policyNo} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{s.owner}</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{s.policyNo} · {s.product}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{ttd(s.api)}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: t.surface, border: `1px dashed ${t.ruleStrong}`, borderRadius: 9, fontSize: 11.5, fontWeight: 700, color: t.inkMute }}>
                    <PlusMark t={t} /> Record issue date
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </CROShell>
  );
}

// tiny helper used above — a plus mark in the muted tone
function PlusMark({ t }) { return <IconPlus size={13} color={t.inkMute} stroke={2.4} />; }

// ── WEEKLY REPORT (entry + preview) ───────────────────────────────────────
function WeeklyReportScene({ t }) {
  const tot = reportTotals();
  return (
    <CROShell t={t} active="report" title="Weekly Report" subtitle={`${WEEKLY_REPORT.weekLabel} · sent by 4pm Friday`}>
      <div style={{ height: '100%', display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* LEFT — compile / send */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
          <div className="a-card a-rise" style={{ flexShrink: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.teal}44`, borderRadius: 14 }}>
            <CroEyebrow t={t} color={t.teal}>Compile the report</CroEyebrow>
            <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 8, lineHeight: 1.55 }}>Pulled from everything entered this week. Review, then send to the branch — it feeds Monday's meeting and the production report.</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                ['Submissions entered', `${SUBMISSIONS.filter((s)=>s.state==='entered').length} this week`],
                ['Branch-issued settled', `${SUB_BRANCH_ISSUE.length} annuities/funeral`],
                ['Agents reporting', `${WEEKLY_REPORT.agents.length}`],
                ['Cut-off', 'Fri 4:00 PM'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 11.5, color: t.inkMute }}>{k}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: t.ink, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="a-card" style={{ flexShrink: 0, padding: '15px 17px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <CroEyebrow t={t} color={t.inkFaint}>Send to</CroEyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 11 }}>
              {['Branch Manager · T. Ramcharan', 'All unit managers (3)', 'Sales Manager · F. Mahadeo'].map((r) => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: t.ink }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={12} color="#fff" stroke={3} /></span>
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', background: t.teal, color: '#fff', borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${t.teal}44` }}>
            <IconArrowR size={16} color="#fff" stroke={2.4} /> Send weekly report
          </div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontStyle: 'italic', textAlign: 'center', lineHeight: 1.5 }}>Also downloadable as the branch production PDF.</div>
        </div>

        {/* RIGHT — live preview of the report */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="a-card" style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Report header */}
            <div style={{ flexShrink: 0, padding: '18px 22px', borderBottom: `1px solid ${t.rule}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>SOUTH BRANCH · PRODUCTION REPORT</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.015em', marginTop: 4 }}>{WEEKLY_REPORT.weekLabel}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>WEEK API</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>{ttd(tot.wkApi)}</div>
              </div>
            </div>
            {/* Table */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: t.surfaceSoft }}>
                    <th style={{ textAlign: 'left', padding: '9px 22px', fontSize: 8.5, color: t.inkFaint, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>AGENT</th>
                    {['WK APPS', 'WK API', 'MTD API', 'YTD API'].map((h) => (
                      <th key={h} style={{ textAlign: 'right', padding: '9px 14px', fontSize: 8.5, color: t.inkFaint, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEKLY_REPORT.agents.map((a, i) => (
                    <tr key={a.name} style={{ borderTop: `1px solid ${t.rule}`, background: i % 2 ? t.surfaceSoft : 'transparent' }}>
                      <td style={{ padding: '10px 22px' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{a.unit}</div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: APP_FONT_MONO, color: t.ink }}>{a.wkApps}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: APP_FONT_MONO, color: t.ink }}>{ttd(a.wkApi)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: APP_FONT_MONO, color: t.inkMute }}>{ttd(a.mtdApi)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: APP_FONT_MONO, color: t.inkMute }}>{ttd(a.ytdApi)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${t.ruleStrong}`, background: t.tealTint }}>
                    <td style={{ padding: '11px 22px', fontWeight: 700, color: t.ink, fontSize: 12.5 }}>Branch total</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: APP_FONT_MONO, fontWeight: 700, color: t.ink }}>{tot.wkApps}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: APP_FONT_MONO, fontWeight: 700, color: t.teal }}>{ttd(tot.wkApi)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: APP_FONT_MONO, fontWeight: 700, color: t.ink }}>{ttd(tot.mtdApi)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: APP_FONT_MONO, fontWeight: 700, color: t.ink }}>{ttd(tot.ytdApi)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ flexShrink: 0, padding: '10px 22px', borderTop: `1px solid ${t.rule}`, fontSize: 10.5, color: t.inkFaint, fontStyle: 'italic', textAlign: 'center' }}>
              Compiled by {CRO_ME.name} · the report that lands on the Monday meeting production slide.
            </div>
          </div>
        </div>
      </div>
    </CROShell>
  );
}

Object.assign(window, { ProductTag, SubmissionsScene, SettlementsScene, WeeklyReportScene });
