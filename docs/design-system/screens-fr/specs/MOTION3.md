# Desktop v3 — chart motion rules ("data changes glide, never jump")

Why charts don't animate today: most bars are SVG `<rect width="{{x}}">` or divs with a one-shot
entrance keyframe. When the data changes (period chip, tab, slider, switch, + button) the attribute
just jumps. Entrance keyframes only play on mount.

## The rules
1. **Bars / meters / bullet charts**: the size must live in an inline STYLE, with a CSS transition.
   - HTML bar: `style="width: {{r.pct}}%; transition: width 480ms cubic-bezier(0.32, 0.72, 0, 1);"`
     (or `height` for columns). Preferred — use HTML divs for bars where you can.
   - SVG rect: keep the attribute AND add the CSS geometry property:
     `<rect x="0" y="6" width="{{r.w}}" height="22" style="width: {{r.w}}px; transition: width 480ms cubic-bezier(0.32, 0.72, 0, 1);">`
     For columns growing up: animate `height` and `y` together
     (`style="height: {{h}}px; y: {{y}}px; transition: height 480ms …, y 480ms …;"`).
   - Keep a one-shot entrance (grow from 0) if one exists — but it must be on a WRAPPER or use
     `transform: scaleX/scaleY` so it doesn't fight the width/height transition.
2. **Markers, ticks, dots, labels that move** (target ticks, YOU markers, end dots, value labels
   riding a bar end): position via style `left: {{x}}%` / `transform: translateX({{x}}px)` or SVG CSS
   `cx`/`cy`/`x` with the same 480ms transition. Labels move WITH their bar.
3. **Lines and areas** (paths can't tween reliably): when the data version changes, replay a
   redraw: stroke-dasharray/dashoffset draw 600ms using ALTERNATING keyframe names
   (`xDrawA` / `xDrawB`, flip on each change, held in state as a counter) so it replays; the area
   wash fades 0 → 0.10 in 400ms the same way. End dot fades in after the line (delay 450ms).
4. **Numbers**: big figures that change on interaction count from old → new over 420ms
   (ease-out cubic, setInterval 30ms, clear on each new change; keep the timer on `this`).
   Small labels just change.
5. **Swapping to a different chart** (tab change): cross-fade the chart area 220ms
   (alternating A/B keyframe names), then bars grow in. Don't slide whole pages.
6. **Keep it calm**: 380–520ms, curve `cubic-bezier(0.32, 0.72, 0, 1)`, no bounce/overshoot on
   data, stagger at most 25ms per item and ONLY on first entrance (not on every update), nothing
   loops except celebrations/shine that already exist.
7. **Don't remount**: keep lists the same length and order between states so the runtime reuses the
   DOM nodes (that's what lets the CSS transition run). Never wrap a changing chart in an `sc-if`
   that flips off/on for a data change — only for a real view swap.
8. Every file keeps (or gets) `@media (prefers-reduced-motion: reduce){*{animation-duration:1ms !important;transition-duration:1ms !important}}`.
