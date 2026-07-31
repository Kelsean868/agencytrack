// The Book — everything after a case is written, before it is safe.
//
// A pipeline ends at "settled" and most systems stop there. In life insurance that is
// the middle, not the end: an issued policy that is never delivered is lost business
// already won, and a delivered policy that lapses inside the clawback window takes
// the commission back off the agent. Both are money, both have a clock, and neither
// appears anywhere else in the app.
//
// THREE LISTS, ONE CONCERN — is this business actually mine yet?
//   1. Delivery register  \u2014 issued, not delivered. Won, not banked.
//   2. Clawback clock     \u2014 inside the window, so commission is still reversible.
//   3. Persistency        \u2014 premium due or missed, whatever the age.
// A policy can appear on two of them at once, which is exactly the case worth doing
// something about today.
const { Icon: BkIcon } = window.AgencyTrackDesignSystem_ad1cd7;

// Commission is roughly 40% of first-year API in this market; the exact schedule is a
// tenant setting, but the point of showing it is that the number at risk is a real
// sum, not an abstraction.
const commissionOf = (api) => Math.round(api * 0.4);
const clawbackLeft = (p) => CLAWBACK_DAYS - (p.settledDaysAgo || 0);
const inClawback = (p) => clawbackLeft(p) > 0;
const atRisk = (p) => p.persistency !== 'in force' || p.premium === 'missed';

const PREM_TONE = { paid: ['var(--success)', 'PAID'], due: ['var(--warning)', 'DUE'], missed: ['var(--danger)', 'MISSED'] };

function ClawBar({ p }) {
  const left = Math.max(0, clawbackLeft(p));
  const pctGone = Math.min(100, Math.round((p.settledDaysAgo || 0) / CLAWBACK_DAYS * 100));
  return (
    <span className="bk-claw" title={left + ' of ' + CLAWBACK_DAYS + ' clawback days left'}>
      <span className="bk-claw-track"><i style={{ width: pctGone + '%', background: atRisk(p) ? 'var(--danger)' : 'var(--teal)' }}></i></span>
      <b style={{ color: atRisk(p) ? 'var(--danger)' : 'var(--inkMute)' }}>{left}<em>d</em></b>
    </span>
  );
}

function BookScreen({ store, onGoto }) {
  const { useState } = React;
  const [tab, setTab] = useState('all');
  const policies = store.policies || [];
  const toDeliver = (store.applications || []).filter(a => a.stage === 'Delivery');
  const claw = policies.filter(inClawback);
  const persist = policies.filter(p => p.premium !== 'paid' || p.persistency !== 'in force');
  const exposed = claw.filter(atRisk).reduce((n, p) => n + commissionOf(p.api), 0);
  const undelivered = toDeliver.reduce((n, a) => n + a.api, 0);

  const TABS = [['all', 'Everything'], ['deliver', 'To deliver'], ['claw', 'In clawback'], ['persist', 'Persistency']];
  const showDeliver = tab === 'all' || tab === 'deliver';
  const showClaw = tab === 'all' || tab === 'claw';
  const showPersist = tab === 'all' || tab === 'persist';

  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">The book · written, and not yet safe</span>
        <div className="seg-sm">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <span className="pl-stat">{policies.length} in force · {toDeliver.length} to deliver</span>
      </div>

      <div className="bk">
        <div className="bk-tiles">
          <div className="bk-tile">
            <span className="gp-lab">WON, NOT BANKED</span>
            <b className="gp-big" style={{ color: undelivered ? 'var(--goldInk)' : 'var(--ink)' }}>{ttd(undelivered)}</b>
            <span className="gp-of">{toDeliver.length} issued polic{toDeliver.length === 1 ? 'y' : 'ies'} not delivered</span>
          </div>
          <div className="bk-tile">
            <span className="gp-lab">COMMISSION AT RISK</span>
            <b className="gp-big" style={{ color: exposed ? 'var(--danger)' : 'var(--success)' }}>{ttd(exposed)}</b>
            <span className="gp-of">{claw.filter(atRisk).length} shaky polic{claw.filter(atRisk).length === 1 ? 'y' : 'ies'} still inside {CLAWBACK_DAYS} days</span>
          </div>
          <div className="bk-tile">
            <span className="gp-lab">IN THE CLAWBACK WINDOW</span>
            <b className="gp-big">{claw.length}</b>
            <span className="gp-of">of {policies.length} · reversible until the clock runs out</span>
          </div>
        </div>

        {showDeliver && (
          <section className="mg-card">
            <div className="mg-card-h"><span className="pf-eb">DELIVERY REGISTER</span>
              <span className="mg-card-note">issued, awaiting delivery and receipt</span></div>
            {toDeliver.length === 0
              ? <div className="ap-empty"><b>Nothing waiting to be delivered</b><span>Every issued policy has been handed over and receipted.</span></div>
              : <div className="bk-rows" role="table" aria-label="Delivery register">
                {toDeliver.map(a => (
                  <div key={a.id} className="bk-row bk-del" role="row">
                    <span className="bk-pol" role="cell">{a.policyNo}</span>
                    <span className="bk-who" role="cell"><b>{a.client}</b><span>{a.product}</span></span>
                    <span className="bk-api" role="cell">{ttd(a.api)}</span>
                    <span className="bk-age" role="cell" title={'Issued ' + (a.issuedOn || 'recently')}>issued {a.issuedOn || '\u2014'}</span>
                    <span className="bk-note" role="cell">Commission of {ttd(commissionOf(a.api))} is not yours until this is receipted</span>
                    <span role="cell"><button className="mg-act" onClick={() => store.deliverApplication(a.id)}>Delivered</button></span>
                  </div>
                ))}
              </div>}
          </section>
        )}

        {showClaw && (
          <section className="mg-card">
            <div className="mg-card-h"><span className="pf-eb">CLAWBACK CLOCK</span>
              <span className="mg-card-note">commission reversible for {CLAWBACK_DAYS} days from settlement</span></div>
            <div className="bk-rows" role="table" aria-label="Clawback window">
              {claw.sort((a, b) => clawbackLeft(a) - clawbackLeft(b)).map(p => (
                <div key={p.id} className={'bk-row bk-claw-row' + (atRisk(p) ? ' is-risk' : '')} role="row">
                  <span className="bk-pol" role="cell">{p.policyNo}</span>
                  <span className="bk-who" role="cell"><b>{p.client}</b><span>{p.product}</span></span>
                  <span className="bk-api" role="cell">{ttd(p.api)}</span>
                  <span role="cell"><ClawBar p={p} /></span>
                  <span className="bk-note" role="cell">{atRisk(p)
                    ? ttd(commissionOf(p.api)) + ' comes back off you if this lapses'
                    : 'in force \u00b7 ' + ttd(commissionOf(p.api)) + ' safe in ' + clawbackLeft(p) + ' days'}</span>
                  <span role="cell">{atRisk(p)
                    ? <button className="mg-act" onClick={() => store.chasePremium(p.id)}>Chase it</button>
                    : <span className="gp-done"><BkIcon name="check" size={13} /> holding</span>}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {showPersist && (
          <section className="mg-card">
            <div className="mg-card-h"><span className="pf-eb">PERSISTENCY</span>
              <span className="mg-card-note">premium due or missed, whatever the age</span></div>
            {persist.length === 0
              ? <div className="ap-empty"><b>Every premium is paid</b><span>Nothing on the book needs chasing.</span></div>
              : <div className="bk-rows" role="table" aria-label="Persistency">
                {persist.map(p => {
                  const [tone, lab] = PREM_TONE[p.premium] || PREM_TONE.due;
                  return (
                    <div key={p.id} className="bk-row bk-persist" role="row">
                      <span className="bk-pol" role="cell">{p.policyNo}</span>
                      <span className="bk-who" role="cell"><b>{p.client}</b><span>{p.product}</span></span>
                      <span className="bk-prem" role="cell" style={{ color: tone }}>{lab}</span>
                      <span className="bk-age" role="cell">{p.settledDaysAgo}d on the book</span>
                      <span className="bk-note" role="cell">{inClawback(p)
                        ? 'Inside the clawback window \u2014 ' + ttd(commissionOf(p.api)) + ' at risk with ' + clawbackLeft(p) + ' days to go'
                        : 'Outside clawback \u2014 the commission is yours, the client is still the point'}</span>
                      <span className="bk-acts" role="cell">
                        <button className="mg-act" onClick={() => store.chasePremium(p.id)}>Chase</button>
                        <button className="mg-act" onClick={() => store.resolvePersistency(p.id)}>Received</button>
                      </span>
                    </div>
                  );
                })}
              </div>}
          </section>
        )}

        <p className="rc-fine">A pipeline that ends at &ldquo;settled&rdquo; is telling you half the story. Delivery is the difference between business won and business banked; the clawback clock is the difference between commission paid and commission kept. Chasing a premium books a real collection block in the action plan rather than flipping a flag \u2014 a premium is not saved by ticking a box. Where a policy shows on two lists at once, that is the one to act on today.</p>
      </div>
    </div>
  );
}

Object.assign(window, { BookScreen, commissionOf, clawbackLeft, inClawback, atRisk });
