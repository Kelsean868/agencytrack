One sentence: the global ⌘K / "/" command palette — search-and-jump to any screen plus role-scoped quick create, focus-trapped and Escape-dismissable.

```jsx
<CommandPalette
  open={open} mode="search"
  screens={allScreens}                 // [{id,label,ic,grp,shell}]
  roles={['agent','manager']}
  quickActions={[
    ['plus','Log activity','capture',['agent']],
    ['users','New settlement','settle',['manager']],
  ]}
  onGo={go} onClose={() => setOpen(false)}
/>
```

Only actions whose `roles` intersect the active `roles` show. Typing filters both screens and creates; `mode="create"` opens straight into quick-create. Excludes `shell:'bare'` screens (auth, kiosk) from search.
