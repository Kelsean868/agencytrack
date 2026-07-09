// ObjectionRehearsal — the Prospect Prep design centerpiece.
//
// Turns the four stored objection labels into a rehearsal aid: each matched
// objection expands to label + meaning + a suggested counter (coaching copy
// from OBJECTION_TAXONOMY, ported from the v2 mockup). Unmatched labels (legacy
// free-text, unknown values) render as a plain chip — an honest fallback that
// never fabricates a counter it doesn't have.
//
// SHARED by the agent panel (NextCallHero + prep cards) and the manager read
// view — one component, not a fork.

import React from 'react';
import { Zap } from 'lucide-react';
import { matchObjection } from '../../utils/prospectPrep';

export default function ObjectionRehearsal({ objections, className = '' }) {
  const list = Array.isArray(objections) ? objections : [];
  if (list.length === 0) return null;

  return (
    <div className={className} data-testid="objection-rehearsal">
      <p className="text-[10px] font-bold tracking-wider text-ink-muted uppercase mb-2">
        Rehearse the Objections · {list.length}
      </p>
      <div className="flex flex-col gap-2">
        {list.map((value) => {
          const o = matchObjection(value);
          if (!o) {
            return (
              <span
                key={value}
                className="inline-flex self-start px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning-ink"
                data-testid="objection-plain"
              >
                {value}
              </span>
            );
          }
          return (
            <div
              key={value}
              className="p-3 rounded-lg bg-warning/10 border border-warning/20"
              data-testid="objection-expanded"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-warning-ink">{o.label}</span>
                <span className="text-[11px] text-ink-muted italic">— {o.means}</span>
              </div>
              <div className="flex gap-2 mt-1.5 items-start">
                <Zap size={12} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[11px] text-ink leading-relaxed">{o.counter}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
