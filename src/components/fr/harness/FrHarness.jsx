import React, { useEffect, useMemo, useState } from 'react';
import { SCENES } from './scenes';
import { HarnessFrameContext } from './harnessFrame';
import FrSidebar from '../shell/FrSidebar';
import { frIconComponent } from '../shell/frIconComponent';
import { FR_TABBAR, frFlatItems } from '../shell/frNav';
import MobileBottomNav from '../../shell/MobileBottomNav';

/**
 * FrHarness — DEV-ONLY page that renders FR Views with sample data, no
 * Firebase and no sign-in (FR-D4, brief §5 ritual 1). Entry: fr-harness.html
 * (repo root) → ./main.jsx. Vite builds only index.html for production, so
 * this page never ships.
 *
 * URL: /fr-harness.html                          → index of scenes
 *      /fr-harness.html?scene=<id>&theme=dark    → one scene, light or dark
 *      …&frame=app                               → the scene inside the real
 *        app shell (FrSidebar + the phone tab bar), so the view gets the width
 *        it gets in the app — 220px less at ≥1024, 72px less at 768–1023, the
 *        whole window below 768 (fr-fit-any-width W-1). Without `frame` the
 *        scene renders frameless, as before, for the existing walk checks.
 *
 * Every scene can offer two data states (A/B). The "Change data" button
 * (data-testid="fr-harness-change") flips them, which is how
 * scripts/verification/fr-harness-walk.mjs measures the glide.
 */
function readRoute() {
  const params = new URLSearchParams(window.location.search);
  return {
    sceneId: params.get('scene') || '',
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
    frame: params.get('frame') === 'app' ? 'app' : null,
  };
}

/**
 * AppFrame — the real FR shell around a scene (W-1 width sweep). Same classes
 * as Shell.jsx (`.shell` / `.shell-main` / `.shell-content`), so the grid
 * column widths and content padding are the app's own CSS, not a copy. The
 * TopBar needs the notification context (Firebase), so a plain header of the
 * same role stands in for it (as in the FR-1 shell scene). `fr-harness-frame`
 * lets the page grow to its content height so a full-page screenshot shows the
 * whole view; widths are untouched.
 */
function AppFrame({ title, children }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const items = useMemo(() => frFlatItems().map((i) => ({ ...i, Icon: frIconComponent(i.frIcon) })), []);
  const onBar = new Set(FR_TABBAR.flatMap((b) => [b.tabId, ...(b.matchTabs ?? [])]).filter(Boolean));
  const drawer = items.filter((i) => !onBar.has(i.tabId));
  const bottom = FR_TABBAR.map((i) => ({ ...i, Icon: frIconComponent(i.frIcon) }));
  return (
    <div className="shell fr-harness-frame" data-harness-frame="app">
      <FrSidebar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onAction={() => {}}
        report={{ done: false, title: 'Weekly report', sub: 'Submit when your week is done' }}
        user={{ name: '[Agent]', roleLabel: 'Agent' }}
        onSignOut={() => {}}
      />
      <div className="shell-main">
        <header className="flex min-h-[56px] items-center border-b border-border px-6">
          <h1 className="min-w-0 truncate font-display text-[20px] font-bold" title={title}>{title}</h1>
        </header>
        <main className="shell-content" id="main-content">
          {children}
        </main>
      </div>
      <MobileBottomNav items={bottom} drawerNavItems={drawer} activeTab={activeTab} setActiveTab={setActiveTab} onAction={() => {}} showPinnedZone={false} />
    </div>
  );
}

export default function FrHarness() {
  const [{ sceneId, theme, frame }] = useState(readRoute);
  const [variant, setVariant] = useState('A');
  const scene = useMemo(() => SCENES.find((s) => s.id === sceneId) || null, [sceneId]);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-look', 'fr');
    el.classList.toggle('dark', theme === 'dark');
    document.title = scene ? `FR harness · ${scene.title}` : 'FR harness';
  }, [theme, scene]);

  if (!scene) {
    return (
      <main className="min-h-screen bg-surface p-8 font-sans text-ink">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">FR harness · dev only · sample data</p>
        <h1 className="mt-2 font-display text-[28px] font-bold">Scenes</h1>
        <ul className="mt-4 grid gap-2">
          {SCENES.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3">
              <a className="inline-flex min-h-[44px] items-center font-semibold text-primary underline" href={`/fr-harness.html?scene=${s.id}`}>
                {s.title}
              </a>
              <a className="inline-flex min-h-[44px] items-center text-[13px] text-ink-muted underline" href={`/fr-harness.html?scene=${s.id}&theme=dark`}>
                dark
              </a>
              <span className="text-[12px] text-ink-muted">{s.slice} · {s.viewport}</span>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const Render = scene.render;
  // A scene that already draws the shell itself (FR-1) is never framed twice.
  const framed = frame === 'app' && scene.frame !== false;
  const body = (
    <HarnessFrameContext.Provider value={framed}>
      <div data-scene-root="">
        <Render variant={variant} />
      </div>
    </HarnessFrameContext.Provider>
  );
  return (
    <div className="min-h-screen bg-surface font-sans text-ink" data-scene={scene.id} data-variant={variant} data-frame={framed ? 'app' : 'none'}>
      {scene.hasVariants ? (
        <div className="fixed right-3 top-3 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 shadow-md">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">Sample {variant}</span>
          <button
            type="button"
            data-testid="fr-harness-change"
            onClick={() => setVariant((v) => (v === 'A' ? 'B' : 'A'))}
            className="inline-flex min-h-[44px] items-center rounded-full bg-fr-accent px-4 text-[13px] font-semibold text-fr-on-accent"
          >
            Change data
          </button>
        </div>
      ) : null}
      {framed ? <AppFrame title={scene.title}>{body}</AppFrame> : body}
    </div>
  );
}
