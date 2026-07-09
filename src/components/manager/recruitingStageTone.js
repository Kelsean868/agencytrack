// recruitingStageTone.js — pure token/label helpers for the Monthly Recruiting
// kanban (item 2.2). Kept out of the .jsx so the visuals module can stay a
// components-only fast-refresh boundary (react-refresh/only-export-components).
//
// The mockup's grey→teal→gold→green stage ramp maps to app tokens. Per the gold
// rule, small gold TEXT uses `text-gold-ink`; gold decoration (dots/fills) uses
// `bg-gold`. Literal class strings only (Tailwind JIT cannot see composed ones).
import { RECRUITING_STAGES } from '../../services/recruitingService';

export function stageTone(stage) {
  if (stage === 'licensed') {
    return { dot: 'bg-success', border: 'border-success', text: 'text-success-ink', avaBg: 'bg-success/15', avaFg: 'text-success-ink', pillBg: 'bg-success/10' };
  }
  if (stage === 'offer' || stage === 'licensing') {
    return { dot: 'bg-gold', border: 'border-gold', text: 'text-gold-ink', avaBg: 'bg-gold/15', avaFg: 'text-gold-ink', pillBg: 'bg-gold/10' };
  }
  if (stage === 'seminar' || stage === 'interview' || stage === 'assessment') {
    return { dot: 'bg-primary', border: 'border-primary', text: 'text-primary', avaBg: 'bg-primary/10', avaFg: 'text-primary', pillBg: 'bg-primary/10' };
  }
  return { dot: 'bg-ink-dim', border: 'border-ink-dim', text: 'text-ink-muted', avaBg: 'bg-surface-muted', avaFg: 'text-ink-muted', pillBg: 'bg-surface-muted' };
}

export function stageLabel(stage) {
  return RECRUITING_STAGES.find((s) => s.key === stage)?.label ?? stage;
}
export function stageShort(stage) {
  return RECRUITING_STAGES.find((s) => s.key === stage)?.short ?? stage;
}
