Brand button — solid teal primary or ghost outline; use for all CTAs on both surfaces (never gradient buttons).

```jsx
<Button>Book a demo</Button>
<Button icon="→">Book a demo</Button>
<Button variant="ghost">Sign in</Button>
<Button size="sm" variant="ghost">Export</Button>
```

Variants: `primary` (teal, white text, hover lift + teal shadow), `ghost` (transparent, 1.5px rule border, hover darkens border). Sizes sm/md/lg. `href` renders an anchor. Works in marketing (`:root` tokens) and app (`.nexus` scope) alike.
