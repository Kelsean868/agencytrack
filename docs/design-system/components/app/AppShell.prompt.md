Nexus page shell — sidebar + topbar + content in the 1280×800 desktop frame; the starting point for any app screen. Handles the `.nexus`/`.nexus.dark` scope itself.

```jsx
<AppShell active="home" title="Dashboard" subtitle="Week 27" dark={dark} onToggleMode={() => setDark(!dark)}>
  <GlassCard tint="teal">…hero summary…</GlassCard>
  <div style={{display:'flex', gap:14, marginTop:14}}>
    <Scorecard eyebrow="YTD · Settled API" value="TTD 487K" progress={81} />
  </div>
</AppShell>
```

Content area: 24px/28px padding on `--bg`. One GlassCard max, at the top; everything else `--surface` cards.
