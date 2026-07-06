Nexus Glass hero card — max ONE per app screen, top-of-screen summary only. Glass is a surface treatment, never a content style.

```jsx
<GlassCard tint="teal">
  <Eyebrow size="sm">YTD · Settled API</Eyebrow>
  <div style={{fontFamily:'var(--display)', fontWeight:800, fontSize:30, marginTop:8}}>TTD 487K</div>
</GlassCard>
```

`tint="gold"` for recognition heroes. Needs a visible backdrop to blur; kiosk and `prefers-reduced-transparency` automatically get opaque fallbacks. Regular cards/tables/nav: use `Card`/`Scorecard` instead.
