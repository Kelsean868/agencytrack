Compact KPI scorecard for Nexus dashboards — mono eyebrow + display number + optional progress bar. Use in a flex row of 3–4; wrap the screen in `.nexus`/`.nexus.dark`.

```jsx
<div style={{display:'flex', gap:14}}>
  <Scorecard eyebrow="YTD · Settled API" value="TTD 487K" sub="81% of TTD 600K" progress={81} big />
  <Scorecard eyebrow="Persistency" value="88%" accent="var(--success)" />
  <Scorecard eyebrow="Awards" value="MDRT" accent="var(--gold)" />
</div>
```
