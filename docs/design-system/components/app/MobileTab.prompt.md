One sentence: the mobile bottom navigation bar — four primary tabs, an always-in-place "More" slot (with a ⋮ menu affordance), and an optional center create FAB.

```jsx
<MobileTab
  tabs={[['home','Home','dash'], ['chart','Plan','plan'], ['wallet','Money','money'], ['trophy','Awards','awards']]}
  screen={screen} go={go} onMore={openMore}
  primary={{ label: 'Log activity' }} onCreate={openCreate}
  current={{ ic: 'book', label: 'Policy Ledger' }}
  onReorder={persistTabOrder}
/>
```

Slot 5 never moves — on a deep (off-tab) screen it shows that screen's name but keeps the ⋮ so it still reads as a menu. Pass `current` for that adaptive label. `primary` + `onCreate` add the raised FAB; `onReorder` enables drag. Pairs with `MobileMore` and `MobileCreateSheet`.
