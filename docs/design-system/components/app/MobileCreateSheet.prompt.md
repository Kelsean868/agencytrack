One sentence: the bottom-sheet of quick-create actions raised by the center "+" FAB, pre-filtered to what the current role can create.

```jsx
<MobileCreateSheet
  open={createOpen}
  actions={[
    ['plus','Log activity','capture'],
    ['book','New policy','ledger'],
    ['chart','Weekly report','wizard'],
  ]}
  onGo={go} onClose={() => setCreateOpen(false)}
/>
```

Scope `actions` to the role (agent vs manager vs admin); a dual selling-manager gets both sets. Opened by `MobileTab`'s `onCreate`.
