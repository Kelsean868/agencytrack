// PR-B2 — dynamic focus-trap enumeration (AgentPlanDrawer rework).
//
// The GPM1 drawer trap hardcoded exactly two focusables (Close, Coach); tabs
// and future B3 controls would silently escape it. Enumerate the container's
// tabbables at keydown time instead. Hidden/disabled elements are excluded;
// panels render conditionally (not CSS-hidden), so attribute checks are
// sufficient (and jsdom-testable — no layout reads).
export function enumerateFocusables(container) {
  if (!container) return [];
  const selector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  return Array.from(container.querySelectorAll(selector)).filter(
    (el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true',
  );
}
