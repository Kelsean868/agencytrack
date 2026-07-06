Brand card — paper surface, 1px rule, 18px radius, optional mono number label + display title; the standard content container on both surfaces.

```jsx
<Card num="01 · PLAN" title="Set the year" hoverLift>
  <p style={{fontSize:14, color:'var(--ink-mute)', lineHeight:1.55, margin:0}}>
    Agents build their Game Plan from income goals.
  </p>
</Card>
```

Body copy inside: 14–14.5px, `var(--ink-mute)`, lh ~1.55. Set `hoverLift` on clickable/feature cards only.
