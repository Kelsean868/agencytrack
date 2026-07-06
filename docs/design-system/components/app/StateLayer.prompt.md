One sentence: wrap any surface that fetches, and it renders through the four required states (loading skeleton → empty → error → ready) instead of assuming happy-path data.

```jsx
<StateLayer
  state={q.status}          // 'loading' | 'empty' | 'error' | 'ready'
  kind="table"              // skeleton archetype while loading
  empty={<EmptyState title="No settlements pending" cta="View policy ledger" onCta={goLedger} />}
  onRetry={q.refetch}
>
  <MasterSheet rows={q.data} />
</StateLayer>
```

Match `kind` to the real layout so nothing shifts on load. Provide a bespoke `empty` per surface (name the reason + next step); the default empty/error are generic fallbacks. Composes `SkeletonScreen`, `EmptyState`, `ErrorState`.
