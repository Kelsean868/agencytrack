import React, { useEffect, useMemo, useState } from 'react';
import { SCENES } from './scenes';

/**
 * FrHarness — DEV-ONLY page that renders FR Views with sample data, no
 * Firebase and no sign-in (FR-D4, brief §5 ritual 1). Entry: fr-harness.html
 * (repo root) → ./main.jsx. Vite builds only index.html for production, so
 * this page never ships.
 *
 * URL: /fr-harness.html                          → index of scenes
 *      /fr-harness.html?scene=<id>&theme=dark    → one scene, light or dark
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
  };
}

export default function FrHarness() {
  const [{ sceneId, theme }] = useState(readRoute);
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
  return (
    <div className="min-h-screen bg-surface font-sans text-ink" data-scene={scene.id} data-variant={variant}>
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
      <div data-scene-root="">
        <Render variant={variant} />
      </div>
    </div>
  );
}
