# Claude Code — kickoff: the full Game Plan Loop

Paste the block below into Claude Code with this `gameplan-loop-handoff/` folder available alongside the `Kelsean868/agencytrack` repo.

---

```
You are building the full "Game Plan Loop" — the cycle that turns an agent's life goal into
daily activity and feeds results back. The connective spec is `gameplan-loop-handoff/LOOP_SPEC.md`
(READ IT FIRST — it has the canonical data model, the per-stage read/write contract, the shared
engines, and the build order). `Loop Map.html` is the one-page visual. Each stage already exists as
an interactive design in `gameplan-loop-handoff/mockups/` — open the .html files; the .jsx are the
exact UI (design reference, not production code).

Before writing code:
1. Read CLAUDE.md, APP_MANUAL.md, src/index.css (Nexus tokens), and the EXISTING services you must
   reuse, not rebuild: moneyNeedsService (the shipped #738 worksheet), goalsService (esp.
   playground* ratios + goal decomposition), the policies/ledger module, and how tabs switch
   (setActiveTab / onOpenTab — there is NO router).
2. Read LOOP_SPEC.md §2 (data spine) and §3 (stage contracts) end to end. Confirm avgPolicySize,
   the policies status enum (written/submitted/settled), and PLAYGROUND_INCOME_GOAL_KEY exist.

The non-negotiables (from the spec):
- ONE number chain. apps = API ÷ avgPolicySize, defined once, used by allocator + playground +
  on-track + reports. Never a second math path. Only Life API drives awards.
- Navigation is tab-state, not a router: hand-offs write to the destination's state/storage then
  onOpenTab(tabKey). No breadcrumb/back chrome.
- Nexus tokens as CSS variables, light + dark everywhere. Lucide icons. ≥44px targets,
  focus-visible, TTD currency, no gradient buttons. Meet the CI a11y gate.
- Targets are TIME-AWARE: the On-Track engine re-solves weekly activity as weeksLeft shrinks and as
  settled production lands. Tiered campaigns show progress toward the next tier as business is
  submitted — the agent does not pre-select a tier.
- Sale flow: from a kept appointment → "Sale written"; one client → MULTIPLE applications; policy #
  optional (Pending # until settled); status Written → Submitted → Settled (Written is the default,
  meaning written-but-not-submitted). Ledger pipeline header doubles as the status filter.
- Branch & unit managers also sell and recruit → they get their own personal planner (1-on-1, unit
  meeting, joint work, training) plus their team surfaces.

Respect the consolidated design-around flags in LOOP_SPEC §6 (per-product schema, apps divisor,
ahSide, campaign seeding, playground payload) — build the UI as if supported and surface the
schema/data decisions in your PR rather than guessing.

Build in the order of LOOP_SPEC §7. Verify each stage in light + dark; run lint, tests, axe. After
the stages, walk AgencyTrack Loop Prototype.html end to end as the acceptance test that the whole
cycle connects and state propagates.

The .jsx files are design reference — recreate in the repo's React/Tailwind, lifting exact
tokens/spacing/tone. Match the mockups, then commit. Ask before adding any field or screen the
spec doesn't call for.
```

---

### Notes for the human driver
- **Start the reviewer on `Loop Map.html` then `AgencyTrack Loop Prototype.html`** — the map shows the spine, the prototype lets you drive it. Everything else is the production version of one stage.
- The biggest reuse wins (don't rebuild): `moneyNeedsService` (worksheet), `goalsService.playground*` (ratios + decomposition), the `policies` ledger, and the avg-policy divisor.
- The genuinely new persistence is small: per-product targets (`{name, api}`, ≤4 per drillable line) and extending the Playground payload to carry per-line/product API. Both flagged in LOOP_SPEC §6.
