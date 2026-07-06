One sentence: loading-state skeleton whose shape matches the final screen so nothing jumps when data arrives — use it (via `StateLayer`) instead of a spinner on any data surface.

```jsx
<SkeletonScreen kind="table" />
```

Archetypes: `cards` (dashboard hero + KPI grid), `table` (Master Sheet / ledgers), `timeline` (daily capture / history), `detail` (policy / career). Mount inside a `.nexus` / `.nexus dark` scope; the shimmer is automatically disabled under `prefers-reduced-motion`.
