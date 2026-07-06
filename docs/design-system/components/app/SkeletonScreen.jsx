// SkeletonScreen — loading skeletons that match the final layout so nothing
// shifts when data lands. Four archetypes: cards | table | timeline | detail.
// Fill uses --skeleton; shimmer is reduced-motion gated (nexus-patterns.css).
import * as React from 'react';

function Sk({ w = '100%', h = 12, r = 6, style }) {
  return <span className="nx-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function SkeletonScreen({ kind = 'cards' }) {
  const R = (n, fn) => Array.from({ length: n }).map((_, i) => fn(i));
  if (kind === 'table') return (
    <div className="nx-skel-screen" aria-busy="true" aria-label="Loading">
      <div className="nx-skel-toolbar"><Sk w={190} h={30} r={9} /><div style={{ flex: 1 }} /><Sk w={104} h={30} r={9} /></div>
      <div className="nx-skel-table">
        <div className="nx-skel-tr nx-skel-th">{R(6, i => <Sk key={i} w={i === 0 ? '24%' : '13%'} h={11} r={5} />)}</div>
        {R(9, r => <div className="nx-skel-tr" key={r}>{R(6, i => <Sk key={i} w={i === 0 ? '24%' : '13%'} h={12} r={5} />)}</div>)}
      </div>
    </div>
  );
  if (kind === 'timeline') return (
    <div className="nx-skel-screen" aria-busy="true" aria-label="Loading">
      <div className="nx-skel-hero"><Sk w={210} h={22} r={7} /><Sk w={'58%'} h={12} style={{ marginTop: 12 }} /></div>
      {R(6, i => <div className="nx-skel-row" key={i}><Sk w={52} h={52} r={13} /><div style={{ flex: 1 }}><Sk w={`${40 + (i * 7) % 30}%`} h={14} /><Sk w={`${24 + (i * 5) % 20}%`} h={11} style={{ marginTop: 9 }} /></div><Sk w={58} h={26} r={13} /></div>)}
    </div>
  );
  if (kind === 'detail') return (
    <div className="nx-skel-screen" aria-busy="true" aria-label="Loading">
      <div className="nx-skel-hero"><Sk w={250} h={24} r={7} /><Sk w={'46%'} h={12} style={{ marginTop: 12 }} /></div>
      <div className="nx-skel-cards">{R(4, i => <div className="nx-skel-card" key={i}><Sk w={'55%'} h={11} r={5} /><Sk w={'42%'} h={26} r={7} style={{ marginTop: 14 }} /></div>)}</div>
      <Sk w={'100%'} h={220} r={14} />
    </div>
  );
  return ( /* cards — dashboard */
    <div className="nx-skel-screen" aria-busy="true" aria-label="Loading">
      <div className="nx-skel-hero nx-skel-hero--split"><div style={{ flex: 1 }}><Sk w={150} h={12} /><Sk w={290} h={30} r={8} style={{ marginTop: 13 }} /><Sk w={'66%'} h={12} style={{ marginTop: 13 }} /></div><Sk w={92} h={92} r={46} /></div>
      <div className="nx-skel-cards">{R(4, i => <div className="nx-skel-card" key={i}><Sk w={'55%'} h={11} r={5} /><Sk w={'42%'} h={28} r={7} style={{ marginTop: 14 }} /><Sk w={'100%'} h={32} r={6} style={{ marginTop: 16 }} /></div>)}</div>
    </div>
  );
}
