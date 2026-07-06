One sentence: an empty state that names *why* a surface has no data and offers the next step as a real CTA — never a bare "No data".

```jsx
<EmptyState
  icon="calendar"
  title="No activity logged yet"
  body="Log your first call, appointment or sale — it rolls into this week's report."
  cta="Log your first activity"
  onCta={logActivity}
/>
```

Keep the title to one line (the reason) and the body to ≤2 lines. The CTA is the primary teal button. Usually rendered by `StateLayer` for the `empty` state.
