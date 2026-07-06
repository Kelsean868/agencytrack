Nexus app sidebar — 232px nav with brand block, mono section titles, teal active state, initials-tile user footer. Usually used via `AppShell`.

```jsx
<Sidebar active="ledger" onNavigate={(key) => setScreen(key)} />
```

Default sections mirror the agent role; pass `sections` for other roles (Manager, CRO). Active row = teal tint bg + 3px teal left rail.
