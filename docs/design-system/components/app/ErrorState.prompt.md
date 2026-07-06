One sentence: a persistent inline error card with a Retry button for load failures — never an error toast that vanishes.

```jsx
<ErrorState onRetry={refetch} />
```

Defaults reassure the user their work is safe. Only the load-failure case uses this; field-level validation should associate its message with the input (`aria-describedby`), not a banner. Usually rendered by `StateLayer` for the `error` state.
