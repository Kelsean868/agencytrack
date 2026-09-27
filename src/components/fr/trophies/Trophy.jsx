// FR trophies — Trophy component, ported from
// docs/design-system/screens-fr/D3-Trophy.dc.html (`<div class="d3t">` + SVG).
//
// What: renders one of the 33 trophy kinds (trophyKinds.js) as an SVG badge —
// shape, ribbon, laurel, metal gradient, glyph/number, locked silhouette +
// lock badge, progress ring, shine sweep, pop entrance and hover lift.
// Why the split: all colour lives in fr-trophy.css (no hex/rgb() literal in
// this file — CLAUDE.md's colour rule, plus the brief's explicit ask), keyed
// by the `data-metal` / `data-metal-secondary` / `data-ribbon` attributes set
// below. Geometry (paths, transforms, symbolic metal/ribbon keys) comes from
// trophyGeometry(kind), which is pure and kind-only — locked/dark/size/
// progress are runtime concerns handled here.
import React, { useId } from 'react';
import { trophyGeometry } from './trophyKinds';
import '../../../styles/fr-trophy.css';

export default function Trophy({ kind, size = 96, locked = false, progress = null, className = '' }) {
  // useId() includes colons (":r0:") which are unsafe inside a url(#id) SVG
  // reference in some engines — strip them so the ids are plain tokens.
  const rawId = useId().replace(/:/g, '');
  const gradMainId = `fr-t-grad-${rawId}`;
  const gradSecondaryId = `fr-t-grad2-${rawId}`;
  const gradShineId = `fr-t-shine-grad-${rawId}`;
  const clipId = `fr-t-clip-${rawId}`;

  const geo = trophyGeometry(kind);

  // Locked always renders the neutral "lock" metal/ribbon regardless of the
  // kind's own award colour — CSS switches lock's hi/mid/lo/rim/glyph (and
  // the locked ribbon's base) between light and dark via html.dark.
  const metalKey = locked ? 'lock' : geo.metal;
  const metal2Key = locked ? 'lock' : geo.metal2;
  const ribbonKey = locked ? 'locked' : geo.ribbon;

  const hasProgress = typeof progress === 'number' && !Number.isNaN(progress);
  const clampedProgress = hasProgress ? Math.max(0, Math.min(100, progress)) : null;
  const showRing = locked && hasProgress;

  const lockBox = Math.max(16, Math.round(size * 0.26));
  const lockIconSize = Math.max(10, Math.round(size * 0.15));

  const label =
    geo.label +
    (locked ? ', locked' : '') +
    (clampedProgress != null ? `, ${clampedProgress}% there` : '');

  const shineSourceD = geo.isPlaque ? geo.plateD : geo.bodyD;
  const bodyFillId = geo.isPlaque ? gradSecondaryId : gradMainId;
  const bodyRimClass = geo.isPlaque ? 'fr-t-rim-stroke-2' : 'fr-t-rim-stroke';
  const laurelClass = locked ? 'fr-t-lo-both' : geo.laurelAccent === 'plat' ? 'fr-t-laurel-plat' : 'fr-t-laurel-gold';
  const dotsFillClass = locked ? 'fr-t-fill-lo' : geo.dotsAccent === 'ruby' ? 'fr-t-dots-ruby' : 'fr-t-dots-teal';

  return (
    <span
      role="img"
      aria-label={label}
      className={['fr-trophy', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      data-metal={metalKey}
      data-metal-secondary={metal2Key}
      data-ribbon={ribbonKey}
    >
      <svg className="fr-t-art" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={gradMainId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="fr-t-stop-hi" />
            <stop offset="0.48" className="fr-t-stop-mid" />
            <stop offset="1" className="fr-t-stop-lo" />
          </linearGradient>
          <linearGradient id={gradSecondaryId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="fr-t-stop-hi-2" />
            <stop offset="1" className="fr-t-stop-lo-2" />
          </linearGradient>
          <linearGradient id={gradShineId} x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0.35" className="fr-t-shine-stop-a" />
            <stop offset="0.5" className="fr-t-shine-stop-b" />
            <stop offset="0.65" className="fr-t-shine-stop-a" />
          </linearGradient>
          {!locked && (
            <clipPath id={clipId}>
              <path d={shineSourceD} />
            </clipPath>
          )}
        </defs>

        <ellipse cx="50" cy="97" rx="26" ry="3" className="fr-t-shadow" />

        <g transform={geo.mainTransform}>
          <path d={geo.laurelD} className={laurelClass} strokeWidth="1.2" strokeLinejoin="round" />
          <path d={geo.tailsD} className="fr-t-ribbon-fill" strokeWidth="1.2" strokeLinejoin="round" />
          <path d={geo.tailStripeD} className="fr-t-ribbon-stripe" strokeWidth="2.2" />
          <path d={geo.handlesD} className="fr-t-no-fill fr-t-rim-stroke" strokeWidth="6" strokeLinecap="round" />
          <path d={geo.handlesD} className="fr-t-no-fill" stroke={`url(#${gradMainId})`} strokeWidth="3.6" strokeLinecap="round" />
          <path d={geo.body2D} fill={`url(#${gradMainId})`} className="fr-t-rim-stroke" strokeWidth="1.6" strokeLinejoin="round" />
          <path d={geo.bodyD} fill={`url(#${bodyFillId})`} className={bodyRimClass} strokeWidth="2" strokeLinejoin="round" />
          <path d={geo.plateD} fill={`url(#${gradMainId})`} className="fr-t-rim-stroke" strokeWidth="1.6" strokeLinejoin="round" />
          <path d={geo.innerD} className="fr-t-no-fill fr-t-rim-stroke fr-t-inner-op" strokeWidth="1.4" />
          <path d={geo.facetD} className="fr-t-facet" strokeWidth="1.4" strokeLinejoin="round" />
          <path d={geo.dotsD} className={`${dotsFillClass} fr-t-rim-stroke`} strokeWidth="1" />
          {!locked && (
            <g clipPath={`url(#${clipId})`}>
              <rect className="fr-t-shine-sweep" x="-40" y="-20" width="55" height="140" fill={`url(#${gradShineId})`} />
            </g>
          )}
          <g transform={geo.glyphTransform}>
            <path d={geo.glyphFillD} className="fr-t-glyph-fill" />
            <path d={geo.glyphD} className="fr-t-glyph-stroke" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          {geo.text && (
            <text
              x="50"
              y={geo.textY}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-display font-extrabold tracking-[-0.02em] fr-t-glyph-fill"
              style={{ fontSize: geo.textSize }}
            >
              {geo.text}
            </text>
          )}
        </g>
      </svg>

      {showRing && (
        <svg className="fr-t-ring" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="49" className="fr-t-no-fill fr-t-ring-track" strokeWidth="2.5" />
          <circle
            cx="50"
            cy="50"
            r="49"
            className="fr-t-no-fill fr-t-ring-fill fr-t-ring-progress"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength="100"
            style={{ strokeDasharray: `${clampedProgress} 100` }}
          />
        </svg>
      )}

      {locked && (
        <span className="fr-t-lock fr-t-lock-badge" style={{ width: lockBox, height: lockBox }}>
          <svg
            width={lockIconSize}
            height={lockIconSize}
            viewBox="0 0 24 24"
            className="fr-t-no-fill fr-t-lock-icon"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
          </svg>
        </span>
      )}
    </span>
  );
}
