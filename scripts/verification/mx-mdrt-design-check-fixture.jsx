/**
 * mx-mdrt-design-check-fixture.jsx — MX (MDRT award threshold) design-check
 * FIXTURE renderer.
 *
 * NOT a src/ route. Dev-server-only scratch page, served by `vite` in dev
 * mode and screenshotted by mx-mdrt-design-check.mjs. Renders the REAL
 * `AwardCard` primitive (src/components/awards/awardPrimitives.jsx) fed by
 * the REAL `computeAgentAwards` engine (src/utils/awardsEngine.js) — no
 * mocked award shape — at three annual-API levels chosen to land in each of
 * MDRT's three states under the new 688,800 / 344,400 thresholds:
 *   - not-yet:     200,000 annual API (below 344,400 in-contention)
 *   - contention:  500,000 annual API (between 344,400 and 688,800)
 *   - qualified:   720,000 annual API (at/above 688,800)
 *
 * This is the only surface this PR's diff visually changes — the Home hero
 * (HeroCard.jsx / homeDerivations.js) already read MDRT_THRESHOLDS_2026
 * before and after, so it carries no pixel delta from this PR and is not
 * re-screenshotted here (see the PR body for the git-diff citation).
 *
 * `?case=<id>` renders one case; no param renders all of them.
 */
/* eslint-disable react-refresh/only-export-components -- scratch harness */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';

(() => {
  const themeMode = localStorage.getItem('agencytrack-theme');
  let dark;
  if (themeMode === 'dark') dark = true;
  else if (themeMode === 'light') dark = false;
  else dark = localStorage.getItem('agencytrack-dark') === '1';
  document.documentElement.classList.toggle('dark', dark);
})();

import { AwardCard } from '../../src/components/awards/awardPrimitives.jsx';
import { computeAgentAwards } from '../../src/utils/awardsEngine.js';

const GOLDEN_DATE = new Date('2026-06-15');

function confirmedFor(annualAPI) {
  const monthly = annualAPI / 12;
  return Array.from({ length: 12 }, (_, i) => ({
    periodKey: `2026-${String(i + 1).padStart(2, '0')}`,
    settledAPI: monthly,
    settledApps: 5,
    persistency: 93,
  }));
}

function mdrtAwardAt(annualAPI) {
  return computeAgentAwards(confirmedFor(annualAPI), [], {}, GOLDEN_DATE).mdrt;
}

const CASES = [
  {
    id: 'not-yet',
    title: 'MDRT — not yet started (200,000 annual API, below 344,400 in-contention)',
    node: <AwardCard award={mdrtAwardAt(200000)} onClick={() => {}} />,
  },
  {
    id: 'in-contention',
    title: 'MDRT — in contention (500,000 annual API, between 344,400 and 688,800)',
    node: <AwardCard award={mdrtAwardAt(500000)} onClick={() => {}} />,
  },
  {
    id: 'qualified',
    title: 'MDRT — qualified (720,000 annual API, at/above 688,800)',
    node: <AwardCard award={mdrtAwardAt(720000)} onClick={() => {}} />,
  },
];

function App() {
  const params = new URLSearchParams(window.location.search);
  const only = params.get('case');
  const cases = only ? CASES.filter((c) => c.id === only) : CASES;
  return (
    <div className="min-h-screen bg-surface p-4 flex flex-col gap-6 max-w-md mx-auto">
      {cases.map((c) => (
        <div key={c.id} data-case={c.id} className="flex flex-col gap-2">
          <p className="text-xs font-mono text-ink-muted">{c.title}</p>
          {c.node}
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
