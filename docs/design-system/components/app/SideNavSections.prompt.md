One sentence: the desktop sidebar's sectioned, drag-reorderable nav list (mono eyebrow headers, teal active state) — the cognitive-load layer proven in the 2026 redesign.

```jsx
const sections = [
  { g: 'Planning', items: [['chart','Game Plan'], ['target','Goals']] },
  { g: 'Tools',    items: [['repeat','Persistency'], ['book','Policy Ledger']] },
];
<nav className="side" aria-label="Primary">
  <SideNavSections sections={sections} active="Goals"
    onNav={go} onReorder={persistOrder} />
</nav>
```

Items are `[iconName, label]` tuples. Pass `onReorder` to enable drag (mouse HTML5 drag + long-press touch); the host persists the new order per role. Omit it for a static sidebar. Sets `aria-current="page"` on the active item.
