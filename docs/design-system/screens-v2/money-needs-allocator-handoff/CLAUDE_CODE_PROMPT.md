# Claude Code — kickoff: Money Needs + Allocator (merged surface)

Paste the block below into Claude Code with this `money-needs-allocator-handoff/` folder available in (or alongside) the `Kelsean868/agencytrack` repo.

---

```
You are merging two existing tools — the Money Needs budget calculator and the Year-Plan
allocator — into ONE surface, and wiring its handoff to the Playground. The full spec is in
`money-needs-allocator-handoff/README.md`; the annotated element-by-element spec is
`money-needs-allocator-handoff/Build Notes.html`; the interactive design source of truth is
`money-needs-allocator-handoff/mockups/Money Needs Merged.html` (open it — toolbar toggles
desktop/mobile, light/dark, and the demo states). The exact UI lives in the two mn-merge*.jsx
files; start with mn-merge-core.jsx (the seam + domain constants).

Before writing code:
1. Read `CLAUDE.md`, `APP_MANUAL.md`, `src/index.css` (Nexus tokens), and the existing
   `goalsService` (esp. the `playground*` ratio fields + `deriveApps`/goalDecomposition) and the
   current Money Needs + Year-Plan components — you are merging and reusing them, not starting fresh.
2. Read README.md end to end, especially §3 (locked rules) and §5 (data model + design-around flags).

Rules (enforce — these are decisions, not suggestions):
- Build in the repo's conventions. Nexus tokens are CSS variables; map every value to an existing
  token, never add a hex. Light + dark for everything. lucide-react icons. ≥44px targets,
  focus-visible rings, TTD currency, no gradient buttons. Meet the CI a11y gate.
- THE SEAM is the point of the merge: one full-width primary band restating the single Money Needs
  output (required first-year commission) and pointing into allocation. Budget above, allocation
  below, one visual spine. Nail this before anything else.
- License: SHOW ONLY the lines the license grants — omit unavailable lines, never grey them out.
  A&H is its own line for every class. Eligibility is positive-only (a gold tag on award-eligible
  lines; NO lock/disabled badge on the rest). Only Life API drives awards.
- Each drillable line (Life AND General) splits into UP TO 4 USER-NAMED products (slider+field
  each) with a balance indicator + auto-balance. Defaults: Life = Whole Life/Annuities/Critical
  Illness/Term; General = Motor/Property/Group/Commercial. Motor & Property are General-license
  lines — never under Life. Names are editable, so the data model is {name, api}, not enums.
- Apps = API ÷ average policy size, the SAME divisor the weekly planner uses — one math source.
- Send to Playground: a confirm sheet that names exactly which line/product API figures hand over,
  then NAVIGATE to the Playground as its own route (breadcrumb + back), pre-filled with the weekly
  activity decomposition. One-directional: Money Needs is the source; back to change the split.
- Every state is honest: license-unset first-run picker, no-commission-need, loading skeleton,
  error — never zeros-as-data.

Respect the three design-around flags in README §5 (per-product schema, apps divisor, ahSide) —
build the UI as if supported, and surface the schema/data decisions in your PR rather than guessing.

Build order (verify each in light + dark before moving on; run lint, tests, axe):
1. Token bridge + BudgetCard (required-commission chain).
2. ★ The Seam.
3. Allocation: license-aware lines, slider+field, %-of-need meter, award strip (Life-only).
4. ProductDrill: ≤4 named products for Life and General, balance + auto-balance.
5. States: license picker, no-need, loading, error.
6. Send → confirm → navigate to pre-filled Playground (reuse goalsService.playground* ratios).

The mn-merge*.jsx files are design reference, not production code — recreate in the repo's
React/Tailwind, lifting exact tokens/spacing/tone. Match the mockup, then commit. Ask before adding
any field or screen the spec doesn't call for.
```

---

### Notes for the human driver
- `mn-merge-core.jsx` is the key read: the **seam**, the `LINES` / `PRODUCT_DEFAULTS` / `AWARDS` domain constants, and the CSS-var token block that maps to `src/index.css`.
- The Playground hop reuses ratios that **already exist** in `goalsService` (`playgroundCiToSaleRatio`, `playgroundDialsToCIRatio`, etc.) — this surface just sets the API target those ratios decompose. Don't build a second decomposition.
- The only genuinely new persistence is **named per-product targets** (`{name, api}`, ≤4 per drillable line) — flagged as schema change A.
