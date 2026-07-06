TTD currency figure formatted by the brand rule (always `TTD` prefix, compact K/M).

```jsx
<Money value={24500} />                      {/* TTD 24.5K, mono 700 */}
<Money value={2400000} mono={false} size={28} /> {/* TTD 2.40M, display 800 */}
<Money value={950} color="var(--teal)" />
```
