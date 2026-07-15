import React from 'react';

/**
 * Group card shell for the Company Config surface (design handoff README
 * §The Setting-Row Grammar): `bg-card` surface, `border-border` hairline,
 * 14px radius, mono uppercase group eyebrow — teal, or gold for the
 * Recognition group (gold = recognition, nothing else — never used
 * decoratively elsewhere on this surface).
 *
 * Pure/presentational: renders `children` (typically a stack of
 * `ConfigRow`s) inside the card body. No Firestore/service/context imports.
 *
 * @param {object} props
 * @param {string} props.title group eyebrow, e.g. "TARGETS & MINIMUMS"
 * @param {string} [props.sub] optional one-line group description
 * @param {'gold'} [props.accent] pass 'gold' for Recognition & Awards groups only
 * @param {React.ReactNode} props.children row content
 */
export default function ConfigGroupCard({ title, sub, accent, children }) {
  return (
    <section className="bg-card border border-border rounded-[14px] px-5 py-4">
      <div className="mb-2.5">
        <div
          className={`font-mono text-[10.5px] font-bold uppercase tracking-[.14em] ${
            accent === 'gold' ? 'text-gold-ink' : 'text-primary'
          }`}
        >
          {title}
        </div>
        {sub && <p className="text-[11.5px] text-ink-muted mt-1 leading-snug">{sub}</p>}
      </div>
      {children}
    </section>
  );
}
