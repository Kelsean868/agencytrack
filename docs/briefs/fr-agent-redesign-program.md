# FR — Agent "Free Redesign" program (FR-0 → FR-5)

**Author:** Claude (architect + executor, cloud session) · **Dispatcher:** Kyron · **Date:** 27-09-2026
**Authorisation (Kyron, 27-09-2026, verbatim):** "Option A- keep the new look. you can do all of the
tests and smoke required to ensure that the design is looking correctly and the animations and
transitions are working correctly and the the user experience is correct. I want you to go all the
way to post merge on what you can"
**Merge channel: HUMAN-MERGE for every slice** (REDESIGN-class + token definitions, CLAUDE.md
§ Standing green channel). CC never merges or deploys (Rule 19).
**Model pins:** FR-0, FR-3: **Opus 5.5, effort high** (tokens, motion engine, money screens).
FR-1, FR-2, FR-4, FR-5: **Opus 5.5 main, effort medium**; mechanical edits delegated to
**Sonnet 5 (medium)** and searches/test runs to **Haiku 4.5** per CLAUDE.md § Subagent delegation.
Money maths, gating and any `firestore`-touching code stay with the main model.

---

## 1. What this is

The Design canvas **"AgencyTrack — Free Redesign"** (claude.ai artifact `RVVmDV2fTXiLve56pWyxxr`)
holds an agent-role redesign: desktop v3 (sidebar Work/Numbers/Money/Compete/You, glanceable pages,
gliding charts, 33 trophies) and mobile v3 (tab bar Today · Pipeline · + · Money · Arena, swipe
pages). This program ports it into the real app for the **agent role only**, behind a switch that
is **off by default**, without losing any feature the app has today.

Design intent lives in `docs/design-system/screens-fr/` (landed with this brief): the canvas
source files (`D3-*`, `D3M-*`, `M3-*` `.dc.html`) and their specs (`specs/*.md`). **Name note:**
"FR" is used everywhere in code and docs because "v3" already means the Linked Agent System v3
(`design_handoff_agencytrack_v3/`). The canvas files keep their D3/M3 names.

## 2. Decisions locked — do not re-litigate

- **FR-D1 Look (Option A, Kyron 27-09-2026).** FR look = **Bricolage Grotesque** (display, 500–800),
  **Onest** (body, 400–800), **JetBrains Mono** (eyebrows). Fonts are **self-hosted** from npm
  `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/onest` (no CDN, so no CSP
  change). Palette (light / dark), from the canvas:
  bg `#F6F3EC`/`#131311` · surface `#FFFFFF`/`#1D1C19` · sunk `#ECE7DC`/`#2A2925` ·
  ink `#1F1D1A`/`#F2EFE8` · mute `#5A544A`/`#BDB6A8` · faint `#6B6558`/`#A39C8E` ·
  rule `#E2DCD0`/`#33312B` · accent `#0B5D5E`/`#63C5BF` · onAccent `#FFFFFF`/`#0D1B1A` ·
  accentTint `#DCEAE7`/`#16312F` · ghost `#A9D0CB`/`#2A5552` · warm `#A63D1A`/`#F29066` ·
  warmTint `#F7E4DA`/`#3A2217` · gold `#855400`/`#E8B44E` · goldTint `#F5EAD3`/`#342911` ·
  side `#EFEBE2`/`#181816` · pane `#FBFAF6`/`#171714`.
  Chart series (fixed order, never cycled): light `#008C85 #A96800 #2F6FC4 #C04A2B #8559A5`,
  dark `#12A39B #B8841A #4F86DB #D2643D #9F77CC`.
- **FR-D2 Scoping, not replacement.** The FR tokens live in a scoped block
  `html[data-look="fr"]` (+ `html.dark[data-look="fr"]`) in `src/index.css` that **re-points the
  existing channel tokens** (`--bg-channels`, `--surface-channels`, `--text-*`, `--primary-*`,
  `--gold-*`, `--warning-*`, `--border-*` …) and adds new ones (`--fr-*`, `--chart-1..5`).
  Nexus v2 `:root` / `.dark` values are **unchanged**. Tailwind `fontFamily` moves to
  `var(--font-body)` / `var(--font-display)` with Satoshi / Cabinet Grotesk as the `:root`
  values, so nothing changes unless the scope is on. Making FR the default (moving values into
  `:root`) is a **later flip PR, not in this program**.
- **FR-D3 The switch.** `useLook()` returns `'fr'` only when the signed-in role is `agent` AND the
  per-user opt-in `localStorage['agencytrack-look'] === 'fr'` is set. The attribute is restored in
  `src/main.jsx` before React mounts (same pattern as `agencytrack-dark`, no flash) and removed for
  non-agent roles after auth resolves. Opt-in control: an agent-only "Try the new design" switch in
  Settings. **No opt-in ⇒ the app renders exactly as today** (a test pins this). No rules change.
  **Amended 27-09-2026 (FR-0 build):** the tenant-wide `featureFlags.agentRedesign` switch is
  **dropped from this program.** A flag must also be togglable in Company Config (parity test
  `companyConfigRegistry.parity.test.js`), and that write path is allowlisted in `firestore.rules`
  (`ccfgFlagKeysAllowed`) — a rules change, which §6 keeps out of scope. The tenant switch lands
  with the later flip PR (human merge + rules deploy). `resolveLook` keeps a `flagOn` input for it.
- **FR-D4 Code layout.** New code under `src/components/fr/` (screens, shell, charts, motion,
  trophies, pager) and `src/lib/fr/` (pure derivations). Each screen = a **container** (reads
  through existing services/hooks — no new service files, no new Firestore write paths) + a
  **pure View** (props only). Views are what the harness renders.
- **FR-D5 Wrap, don't rewrite, the calculators.** Money tabs get the FR glanceable header (tiles,
  hero chart) and then **mount the existing calculator components** (Money Needs allocator,
  Game Plan loop, Goals gap analysis, Commission playground, Persistency playground, Financing
  self-view), reskinned by the scoped tokens. Every item in
  `claude/money-calculators-inventory-2026-09-27.md` (claude.ai project doc; copied to
  `docs/design-system/screens-fr/specs/MONEY-INVENTORY.md`) must still be reachable — checked
  item by item in FR-3's PR body. New visuals the canvas adds (persistency month-by-month bars
  from the 90% gate, reinstatement planner list) are new read-only components.
- **FR-D6 FR chart kit.** New FR charts are small SVG/div components in `src/components/fr/charts/`
  (Bullet, Meter, Columns, GateBars, Line, Donut ≤5 parts, Sparkline, Table toggle), because the
  glide rule needs CSS transitions on geometry. Recharts stays for existing screens. Rules
  (canvas `DESKTOP3.md`): one idea per chart, takeaway title, a **Table** toggle on every chart,
  direct labels, no dual axis, ≤24px bars, targets as 1px solid lines with a text label.
- **FR-D7 Motion (canvas `MOTION3.md`).** Data changes glide: geometry in style with
  `transition: <prop> 480ms cubic-bezier(0.32, 0.72, 0, 1)`; lines redraw 600ms; big numbers count
  old → new in 420ms (existing `useCountUp`, `duration: 420`); tab swaps cross-fade 220ms; stagger
  ≤25ms and only on first entrance; lists keep keys so nodes are reused;
  `prefers-reduced-motion` ⇒ ~instant. Inline `style` is allowed **only** for data-driven geometry
  and CSS custom properties (precedent: progress widths across the app); all static styling stays
  Tailwind + tokens.
- **FR-D8 Swipe pages (canvas `SWIPE3.md`).** Phone screens longer than about one screen become
  named pages: chip pager (`role="tablist"`, 44px) + dots, 1:1 drag, horizontal intent when
  |dx|>10 and |dx|>|dy|, rubber band `dx*W*0.55/(W+0.55*|dx|)`, velocity projection
  `x+(v/1000)*0.99/(1-0.99)`, threshold ±W/2, 520ms snap, ArrowLeft/Right on the pager, height from
  the active page, sticky bars and sheets outside the track, `?page=` deep link, reduced motion snaps.
- **FR-D9 Navigation map (agent).** FR ids map onto existing `activeTab` routes; new routes only
  where the canvas adds a surface:
  Today→`dashboard` · Focus→**`focus`** (new; `mode` Calls|Paperwork|Winback) · Week→`planner` ·
  Pipeline→**`pipeline`** (new; `view` Funnel|Board) · Numbers→**`numbers`** (new hub: week,
  history, production report, agent report) · Ledger→`policy-ledger` · Money→**`money`** (new hub;
  `tab` Overview|Goals|GamePlan|MoneyNeeds|Commission|Persistency|Financing, each tab mounting the
  existing route's component) · Arena→`production-leaderboard` · Campaign→**`campaign`** (new) ·
  Awards→`awards` · Trophies→**`trophies`** (new) · Me→`profile` (+ Career, Settings) ·
  Connections→`call-sources`. Weekly Report / Daily Log stay actions. Prospect Prep stays reachable
  (Work group). **Every AGENT_NAV destination stays reachable** (test enumerates them).
- **FR-D10 Honest numbers.** No figure is invented. Where a canvas tile has no data source today it
  is **omitted**, not faked (known: KQM opportunity counts, AI coach text). Coach insights are
  computed in code from existing numbers (gap to weekly minimum, pace to MDRT, persistency gap) —
  no AI call. Settled vs submitted always shown apart; provenance lines kept
  (`settledProvenance.js`).
- **FR-D11 Focus sessions are read + `tel:` only in this program.** Calls = today's planner call
  blocks and appointments with a `tel:` link and today's counts (from the daily entry, any
  source); outcomes are captured by the existing Daily Capture sheet (no new writes). The
  named-lead dialer is Linked Agent v3 Phase 1.5 — not duplicated here. Paperwork = own policies in
  `written`/`submitted`/`rated`/`postponed`, oldest first, with age. Win-back = lapsed policies
  inside the 24-month window, from the existing persistency derivation, with the gap maths.
- **FR-D12 Out of scope.** Manager / SM / TA / PA screens · `firestore.rules`, functions, indexes,
  new collections · "Mark reinstated" / reinstatement status (→ FR-6 brief, human, rules + deploy)
  · KQM Supabase reads · AI · PDFs · Wizard Step1–Step9 (never modified) · flipping FR to default.

## 3. Persona review (net-new surface)
- **Tenant isolation / data integrity:** no new reads outside existing services; no writes added.
- **Role / permissions:** FR only for `agent`; managers never get the attribute (test).
- **Money correctness:** calculators mounted, not re-implemented; new money visuals read existing
  derivations; FR-3 PR carries the inventory checklist.
- **Operator legibility:** switch is per-user and reversible from Settings; tenant flag off.
- **a11y / contrast:** harness axe run both themes; 44px targets; focus-visible on FR fills.
- **Pilot ops / reversibility:** turning the opt-in off restores Nexus v2 instantly.
- **Maintainability:** container/View split; one chart kit; one motion module.

## 4. Slices (one branch, one PR each; stacked on the previous slice until it merges)

| Slice | Branch | Contents | Model |
|---|---|---|---|
| FR-0 | `feat/fr-0-foundation` | fonts, scoped tokens, `useLook` + Settings switch + main.jsx restore, motion module, chart kit, `Trophy` (33 kinds), `SwipePager`, dev harness `/__fr` (DEV only, tree-shaken from prod), `scripts/verification/fr-harness-walk.mjs`, addendum § FR | Opus 5.5 high |
| FR-1 | `feat/fr-1-shell` | FR desktop sidebar (groups Work · Numbers · Money · Compete · You, pin/collapse kept) + phone tab bar Today · Pipeline · + · Money · Arena (+ = QuickAdd), More drawer, route map FR-D9, new-route stubs | Opus 5.5 med |
| FR-2 | `feat/fr-2-today` | Today desktop + phone swipe pages (Today · Week · Money · Campaign) from HomeV2 data | Opus 5.5 med |
| FR-3 | `feat/fr-3-money` | Money hub + Overview + 7 tabs per FR-D5; persistency month bars + reinstatement planner (read-only) | Opus 5.5 high |
| FR-4 | `feat/fr-4-work` | Focus (3 modes, FR-D11), Pipeline (Funnel from submissions/daily entries; Board from policy lifecycle), Numbers hub, Ledger FR header + Win-back lens (read-only) | Opus 5.5 med |
| FR-5 | `feat/fr-5-compete-you` | Arena, Campaign, Awards, Trophy room (earned from existing badge/award engines), Me, Connections | Opus 5.5 med |
| FR-6 | brief only | reinstatement status field + "Mark reinstated" (rules + deploy, human) | — |

Each slice: container + View + tests (View renders loading / error / empty / data; gate tests;
reduced-motion), harness fixtures, and PR body with the evidence below.

## 5. Named rituals (deliverables, every slice)

1. **FR harness walk** — `node scripts/verification/fr-harness-walk.mjs --slice FR-n` against the
   local dev server (`npm run dev`, harness at `/__fr`). Produces, per slice screen:
   screenshots at 1440×900 and 390×844 in light and dark; **axe** (serious/critical = 0 on harness
   pages); **motion probe** (after a data change, the animated geometry is sampled at ~0 / 240 /
   700 ms and must be strictly between old and new at 240 ms, and equal new at 700 ms); **swipe
   probe** (phone: 60px drag snaps back; 220px drag or fast flick moves one page; ArrowRight moves
   one page); **reduced-motion probe** (same change settles in <50 ms); **tap-target probe**
   (interactive boxes ≥44px). The walk's summary table is **pasted into the PR body** (evidence
   paste-back) with the screenshots attached as a PR comment.
2. **Gate parity** — Vitest: flag off + no opt-in renders the current agent dashboard; manager
   roles never get `data-look`.
3. **Full gates** — `npm run lint` 0 errors / 0 jsx-a11y warnings · `npm test` full suite with
   `VITE_FIREBASE_*` unset · `npm run build` · CI `lint-and-build` + `functions-tests` polled to
   SUCCESS · CodeRabbit disposition table (Rule 21) · ≥1 stated gap (Rule 22) · PR-ready report
   names HEAD SHA (Rule 20).
4. **Preview smoke — read-only only.** Feature previews run against production Firebase, and this
   cloud session has no `.env.local`, so no signed-in preview walk runs from here. Offered instead:
   a read-only click-through in Kyron's Chrome (Claude in Chrome) with the opt-in switched on.
   **Waiver (Rule 13) if not done:** the FR surface is invisible in production until someone opts
   in; the deferred-verification FU is banked with the walk steps.
5. **Post-merge fill** (Rule 16/15) after each merge Kyron makes: CONTEXT.md fields, squash SHA,
   `git log origin/main --oneline -1` verification pasted in the report. Deploy audit
   (`git diff --stat <prev> <squash> -- firestore.rules firestore.indexes.json functions/`)
   must be empty for every FR slice.

## 6. Stops
- **STOP and wait for dispatcher** if: a feature in AGENT_NAV cannot be given an FR home; a
  calculator cannot be mounted without changing its logic; any change would touch
  `firestore.rules`, `functions/`, indexes or a new collection; the harness walk cannot measure a
  probe it is supposed to pass; two consecutive CI failures that are not the known
  `DailyCaptureV2` streak-test flake.
- **STOP IMMEDIATELY** on anything that writes to production data from this session.
