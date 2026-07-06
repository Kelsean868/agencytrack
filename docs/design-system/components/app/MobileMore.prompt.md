One sentence: the full mobile navigation sheet opened from the "More" tab — Pinned + Frequent rows plus the role's screens in labelled sections, focus-trapped with a thumb-reach Done.

```jsx
<MobileMore
  open={moreOpen} title="All screens"
  sections={sidebarSections}
  active={current} onNav={go} onClose={() => setMoreOpen(false)}
  pinnedItems={pins} pinnedSet={pinSet} onTogglePin={togglePin}
  frequentItems={topVisited}
/>
```

Always sectioned — never one long list. The host owns pins and visit counts per role. Add `lens`/`onLens` for a selling-manager who toggles My Book / My Team. Opened by `MobileTab`'s More slot.
