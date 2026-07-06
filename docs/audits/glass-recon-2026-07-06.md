# Glass surface + contrast recon — 2026-07-06

**Role:** read-only recon for the deferred glass-recipe reconciliation
(INTEGRATION.md §6: "glass-recipe reconciliation (`tokens/glass.css` vs the app's
`--glass-*`)"). Read-only — no source touched. Cites `path:line` throughout.

---

## Summary (read this first — it inverts the brief's premise)

The brief assumed the app "currently renders glass surfaces via its own mechanism
(unknown)" and that "glass was deferred from #813 and is NOT yet reconciled." The
recon finds the opposite:

1. **The app already has a complete, tokenised glass subsystem in
   [`src/index.css:189-648`](src/index.css#L189).** It landed well *before* the
   Nexus v2 foundation swap — Nexus Glass S1 (PR #513, `54dad438`), S2 hero tier,
   and the S3 sweep (PR #534, `3601341f`).

2. **The app's S1 glass tokens are byte-for-byte identical to
   [`docs/design-system/tokens/glass.css`](docs/design-system/tokens/glass.css).**
   All 20 `--glass-l-*` / `--glass-d-*` variables match exactly (values, alpha,
   units). This is not a coincidence: glass.css's own header says *"Source:
   app/glass.css"* ([`glass.css:2`](docs/design-system/tokens/glass.css#L2) / the
   internal source [`.../app/glass.css:3`](docs/design-system/screens-v2/design-system/app/glass.css#L3)).
   **The DS glass recipe was derived FROM the app, not the other way around.** For
   the S1 tier the reconciliation is effectively already done.

3. **The naming/scope question #813 wrestled with does NOT recur for glass.**
   glass.css already uses `:root` / `.dark` scope + kebab `--glass-*-l/d` names —
   the exact plumbing the app uses. There is no `.nexus` / camelCase mismatch to
   adapt (contrast this with INTEGRATION.md §1, where app.css needed un-scoping).

4. **The real gap runs the other way: the app is a *superset* of glass.css.** The
   app added an entire **S2 hero tier** (`--glass-hero-*`, 26 additional
   variables, [`src/index.css:221-248`](src/index.css#L221)) plus a certified
   hero-ink set ([`src/index.css:249-258`](src/index.css#L249)). **glass.css has
   no hero tier at all** — confirmed in both DS copies. Every glass surface
   actually rendered in the app is the hero tier, not the S1 tier glass.css
   defines.

5. **Every in-use glass surface is `.glass.hero.teal` (13 surfaces).** The S1
   `.glass` / `.glass.teal` / `.glass.gold` classes and the `.glass.hero.gold`
   variant are **defined but unused by any component** (gold hero unused per
   operator verdict 2026-06-06,
   [`hero-pane-foreign-ink-guard.test.js:30-31`](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js#L30)).

6. **Text-on-glass is already AA-certified by a static guard + ratio matrix**
   ([`hero-pane-foreign-ink-guard.test.js`](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js),
   `heroPair()`/`heroPairDeep()` in [`contrast.js:110-164`](src/utils/contrast.js#L110)).
   A glass reconciliation that leaves the hero tier and its inks untouched carries
   **no new contrast risk**. The dominant risk is *regression*, not a gap: naively
   "reconciling the app down to glass.css" would delete the hero tier and break all
   13 live surfaces.

**Net:** this is a **documentation / direction** reconciliation, not a values port.
The DECISIONS-NEEDED list is about how to record that the S1 tier already matches
and how to treat the app-only hero superset — not about restyling live surfaces.

---

## Task 1 — Glass definition today

The app defines glass in `src/index.css` in three layers plus environment
fallbacks. Nothing outside `index.css` defines the recipe; `contrast.js` only
*mirrors* the token values for test math.

### 1a. S1 tokens (identical to glass.css)

| Token | `src/index.css` | `tokens/glass.css` | Match |
|---|---|---|---|
| `--glass-l-base` | `rgba(255,255,255,0.62)` [`:194`](src/index.css#L194) | `:6` | ✅ |
| `--glass-l-tint-teal` | `rgba(1,138,145,0.10)` [`:195`](src/index.css#L195) | `:7` | ✅ |
| `--glass-l-tint-gold` | `rgba(176,125,26,0.10)` [`:196`](src/index.css#L196) | `:8` | ✅ |
| `--glass-l-blur` | `18px` [`:197`](src/index.css#L197) | `:9` | ✅ |
| `--glass-l-sat` | `135%` [`:198`](src/index.css#L198) | `:10` | ✅ |
| `--glass-l-border` | `rgba(1,105,111,0.16)` [`:199`](src/index.css#L199) | `:11` | ✅ |
| `--glass-l-hi` | `rgba(255,255,255,0.65)` [`:200`](src/index.css#L200) | `:12` | ✅ |
| `--glass-l-shadow` | `0 8px 28px rgba(38,35,28,0.10)` [`:201`](src/index.css#L201) | `:13` | ✅ |
| `--glass-l-solid-teal` | `#EAF3F3` [`:203`](src/index.css#L203) | `:14` | ✅ |
| `--glass-l-solid-gold` | `#F6EEDD` [`:204`](src/index.css#L204) | `:15` | ✅ |
| `--glass-d-base` | `rgba(28,25,20,0.55)` [`:210`](src/index.css#L210) | `:18` | ✅ |
| `--glass-d-tint-teal` | `rgba(74,181,184,0.14)` [`:211`](src/index.css#L211) | `:19` | ✅ |
| `--glass-d-tint-gold` | `rgba(232,183,62,0.12)` [`:212`](src/index.css#L212) | `:20` | ✅ |
| `--glass-d-blur` | `20px` [`:213`](src/index.css#L213) | `:21` | ✅ |
| `--glass-d-sat` | `120%` [`:214`](src/index.css#L214) | `:22` | ✅ |
| `--glass-d-border` | `rgba(255,255,255,0.12)` [`:215`](src/index.css#L215) | `:23` | ✅ |
| `--glass-d-hi` | `rgba(255,255,255,0.08)` [`:216`](src/index.css#L216) | `:24` | ✅ |
| `--glass-d-shadow` | `0 8px 28px rgba(0,0,0,0.45)` [`:217`](src/index.css#L217) | `:25` | ✅ |
| `--glass-d-solid-teal` | `#15201F` [`:218`](src/index.css#L218) | `:26` | ✅ |
| `--glass-d-solid-gold` | `#221C12` [`:219`](src/index.css#L219) | `:27` | ✅ |

**20/20 identical.** These are the complete contents of glass.css.

### 1b. S2 hero tier (app-only — NOT in glass.css)

26 additional tokens the DS file has no equivalent for:
- Light panes: `--glass-hero-l-teal-a/b/-solid`, `--glass-hero-l-gold-a/b/-solid`,
  `--glass-hero-l-blur/sat/border/hi/shadow` ([`src/index.css:226-236`](src/index.css#L226)).
- Dark panes: `--glass-hero-d-*` ([`src/index.css:238-248`](src/index.css#L238)).
- Hero ink set (text ON the hero pane): `--hero-ink`, `--hero-ink-muted-teal`,
  `--hero-ink-muted-gold`, `--hero-accent`, `--hero-dot-success/-warning/-danger`,
  `--hero-chip-island`, `--hero-chip-border` ([`src/index.css:249-258`](src/index.css#L249)).

The hero pane is a **deep, near-opaque saturated teal/gold** (alpha 0.86–0.96) with
an *inverted, light-on-dark ink world* — a different design intent from the light,
translucent S1 tint (alpha 0.10). glass.css's header even says glass is for the
"hero-card tier ONLY" ([`glass.css:1`](docs/design-system/tokens/glass.css#L1)), but
the *recipe it ships* is the S1 translucent one; the app's actual hero cards use the
deeper S2 recipe the app authored separately.

### 1c. Class implementation + environment fallbacks

- S1 classes: [`src/index.css:515-546`](src/index.css#L515) (`.glass`, `.glass.teal`,
  `.glass.gold`, `+ .dark` variants).
- S2 hero classes (3-class specificity `.glass.hero.teal` = 0,3,0):
  [`src/index.css:551-578`](src/index.css#L551).
- Kiosk (no `backdrop-filter`, solid fallback): [`src/index.css:582-616`](src/index.css#L582).
- Meeting Mode (blur reduced to 8px / sat 100%): [`src/index.css:619-628`](src/index.css#L619).
- `prefers-reduced-transparency` opaque fallback: [`src/index.css:635-648`](src/index.css#L635).

**Plumbing divergence (S1):** glass.css sets the gradient tint via a bare
`var(--tile-tint)` ([`glass.css:32,38-39`](docs/design-system/tokens/glass.css#L32));
the app uses a namespaced var **with a `transparent` fallback**:
`var(--glass-tile-tint, transparent)` set by `.glass.teal`/`.gold`
([`src/index.css:524,531-532`](src/index.css#L524)). Same rendered output when a
tint class is present; the app's form degrades gracefully for a bare `.glass`.
Different variable *name* (`--tile-tint` vs `--glass-tile-tint`) — a naming
micro-decision (D3 below).

---

## Task 2 — Surface inventory

### 2a. Token-glass surfaces (the `.glass.*` class system)

All 13 live surfaces read the class token; none hardcode the effect inline. **All
are `glass hero teal`. Zero `glass hero gold`, zero bare/S1 `glass`.**

| # | Component | path:line | Class | Theme(s) |
|---|---|---|---|---|
| 1 | CommissionAnchorStrip | [`:155`](src/components/agent/CommissionAnchorStrip.jsx#L155) | `... glass hero teal` | both |
| 2 | SuggestedWeekCard | [`:214`](src/components/dashboard/GamePlanV2/SuggestedWeekCard.jsx#L214) | `... glass hero teal` | both |
| 3 | PersRealityBar | [`:75`](src/components/manager/PersRealityBar.jsx#L75) | `glass hero teal ...` | both |
| 4 | HeroCard (Agent YTD) | [`:33`](src/components/dashboard/HomeV2/HeroCard.jsx#L33) | `glass hero teal ...` | both |
| 5 | PipelineStrip (Policy Ledger) | [`:27`](src/components/agent/policyLedger/PipelineStrip.jsx#L27) | `glass hero teal p-5` | both |
| 6 | ManagerHeroSection | [`:26`](src/components/dashboard/ManagerHeroSection.jsx#L26) | `glass hero teal mb-6` | both |
| 7 | HistoryTab anchor strip | [`:91`](src/components/submissions/HistoryTab.jsx#L91) | `glass hero teal ...` | both |
| 8 | AgentProductionView | [`:154`](src/components/productionReport/AgentProductionView.jsx#L154) | `glass hero teal p-6` | both |
| 9 | PersistencyTab summary | [`:107`](src/components/agent/PersistencyTab.jsx#L107) | `glass hero teal ...` | both |
| 10 | BranchManagerProductionView | [`:136`](src/components/productionReport/BranchManagerProductionView.jsx#L136) | `glass hero teal p-6` | both |
| 11 | ManagerAwardsPanel (MonthlyBonusHero) | [`:62`](src/components/awards/ManagerAwardsPanel.jsx#L62) | `glass hero teal ...` | both |
| 12 | PolicyReconciliationPanel (pending hero) | [`:279`](src/components/manager/PolicyReconciliationPanel.jsx#L279) | `glass hero teal ...` | both |
| 13 | CompliancePanel (reality bar) | [`:450`](src/components/manager/CompliancePanel.jsx#L450) | `glass hero teal ...` | both |

Notes:
- **No `GlassCard` primitive exists** (grep for `GlassCard` = 0). Each surface
  applies the class string directly on its container `<div>`. There is no shared
  wrapper component — the "primitive" is the CSS class alone.
- Defined-but-unused: `.glass` / `.glass.teal` / `.glass.gold` (S1) and
  `.glass.hero.gold` render nowhere in the app.

### 2b. Hand-rolled glass surfaces (outside the token system)

These use Tailwind `backdrop-blur-*` or inline `backdropFilter`, **not** the
`--glass-*` recipe. They are a *different aesthetic* (neutral card / page scrim),
not teal/gold hero glass.

**Content cards (neutral frosted card over a pattern):**
| Component | path:line | Effect |
|---|---|---|
| LoginScreen (auth card) | [`:164`](src/components/auth/LoginScreen.jsx#L164) | `card ... bg-card/80 backdrop-blur-md` |
| ResetPasswordHandler | [`:141`](src/components/auth/ResetPasswordHandler.jsx#L141) | `card ... bg-card/80 backdrop-blur-md` |
| EmailVerificationHandler | [`:98`](src/components/auth/EmailVerificationHandler.jsx#L98) | `card ... bg-card/80 backdrop-blur-md` |

**Modal scrims (blur the page *behind* a modal — a backdrop, not a content surface):**
`bg-black/40|60 backdrop-blur-sm` at:
[EmailUpdateModal:66](src/components/profile/EmailUpdateModal.jsx#L66),
[EditConfigModal:237](src/components/admin/EditConfigModal.jsx#L237),
[BulkImportUsersModal:282](src/components/admin/BulkImportUsersModal.jsx#L282) & [:670](src/components/admin/BulkImportUsersModal.jsx#L670),
[BulkImportGoalsModal:294](src/components/admin/BulkImportGoalsModal.jsx#L294) & [:681](src/components/admin/BulkImportGoalsModal.jsx#L681),
[BranchEditorModal:194](src/components/admin/BranchEditorModal.jsx#L194),
[ActivityStandardsModal:151](src/components/admin/ActivityStandardsModal.jsx#L151),
[ReportRangeModal:15](src/components/ui/ReportRangeModal.jsx#L15),
[MonthlyPlanModal:179](src/components/agent/MonthlyPlanModal.jsx#L179),
[MoneyNeedsPanel:718](src/components/agent/MoneyNeedsPanel.jsx#L718),
[MoneyNeedsAllocator:367](src/components/agent/MoneyNeedsAllocator.jsx#L367),
[ReviewCommitModal:38](src/components/dashboard/GamePlanV2/ReviewCommitModal.jsx#L38),
[ManagerOverrideModal:161](src/components/manager/ManagerOverrideModal.jsx#L161),
[MyPointsCard:61](src/components/gamification/MyPointsCard.jsx#L61).

**Inline locked-state / decorative blur overlays:**
[CareerPortal:488](src/components/profile/CareerPortal.jsx#L488) (`backdropFilter: blur(2px)`),
[HomeV2/StandardDetail:170](src/components/dashboard/HomeV2/StandardDetail.jsx#L170),
[awardPrimitives:285](src/components/awards/awardPrimitives.jsx#L285),
[kiosk/FullscreenButton:34](src/components/kiosk/FullscreenButton.jsx#L34) (`backdrop-blur-sm` on a button).
Pure `filter: blur()` decorative (not backdrop, not a glass surface):
[CareerPortal:170](src/components/profile/CareerPortal.jsx#L170) (orb),
[MedalCoin:81](src/components/gamification/MedalCoin.jsx#L81).

---

## Task 3 — Text-on-glass (contrast risk)

### 3a. What sits on the live (hero-teal) surfaces

Every live surface is `.glass.hero.teal`, whose text world is **inverted
light-on-dark** and governed by a certified ink set, not the app's normal ink
tokens:

- **Values / headings:** `--hero-ink` (`#FFFFFF`) — [`src/index.css:250`](src/index.css#L250).
- **Muted labels:** `--hero-ink-muted-teal` (`#DCEEEE`, solved 4.73:1 on the light
  teal floor) — [`src/index.css:251`](src/index.css#L251).
- **Accent numerals:** `--hero-accent` (`#F4ECC8`, 4.79:1) — [`src/index.css:253`](src/index.css#L253).
- **Status dots (graphical, 3:1):** `--hero-dot-success/-warning/-danger`
  (3.64 / 3.49 / 3.24:1 on the chip island) — [`src/index.css:254-256`](src/index.css#L254).
- **Chip islands** carry status hue as a *background*, with `text-{status}-ink`
  inside — [`CompliancePanel.jsx:695-696`](src/components/manager/CompliancePanel.jsx#L695).

### 3b. "Hero ink can't escape hero panes" — already enforced two-way

- **Forward guard** ([`hero-pane-foreign-ink-guard.test.js:136-205`](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js#L136)):
  every `text-[--var]` on a hero pane must be one of the 4 certified hero-ink vars
  ([`:32-37`](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js#L32)); raw
  `text-success/-warning/-danger/-primary/-ink-faint` are forbidden on glass
  ([`:47-56`](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js#L47)).
- **Inverse guard** ([`:235-259`](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js#L235)):
  card-context branches (marked `@@card-context-*`) must NOT leak hero-ink tokens —
  hero ink cannot escape into a card render path (origin: CommissionAnchorStrip
  no-goal state, [G-1 trace :215-216](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js#L215)).
- **Ratio matrix:** `heroPair()` / `heroPairDeep()` compute the worst-case
  (lightest) floor the inks must clear ([`contrast.js:110-164`](src/utils/contrast.js#L110));
  asserted in `contrast.test.js`. Runtime axe can't measure glass compositing
  (reports "incomplete"), so this static pair is *the* certifier
  ([guard header :12-16](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js#L12)).

### 3c. Gold-on-glass

`.glass.hero.gold` panes are **unused** (operator verdict 2026-06-06); the gold
hero tokens + `--hero-ink-muted-gold` remain defined/certified for future
reinstatement ([guard :30-31](src/utils/__tests__/hero-pane-foreign-ink-guard.test.js#L30)).
The S1 `.glass.gold` (light gold tint) is also unused. **No gold-on-glass renders
in production today**, so no gold contrast risk exists to adjust.

### 3d. Risk verdict

- The **20 S1 tokens are the only thing glass.css could "reconcile," and they
  already match** — changing nothing. So a faithful reconciliation touches **no
  live text** and carries **no new contrast risk**.
- The genuine hazard is **regression by over-reach**: if a reconciliation deleted
  or "simplified" the app's hero tier to match glass.css (which has no hero tier),
  all 13 surfaces + their certified inks break. The guards would catch ink drift,
  but not deletion of the tier itself.
- Hand-rolled auth cards (`bg-card/80`) put standard ink tokens on a ~card
  background — long-established, low risk, out of the glass-token scope.

---

## Task 4 — Recipe gap analysis (app ⇄ glass.css)

### (a) App glass with a direct glass.css equivalent — **exact match, 20/20**
All `--glass-l-*` / `--glass-d-*` (see Task 1a table). Values, alpha, and units are
identical. The `.glass` / `.dark .glass` / `prefers-reduced-transparency` class
structure also matches (app adds `[data-kiosk]` + `[data-meeting-mode]` overrides
glass.css doesn't specify, and the `--glass-tile-tint` vs `--tile-tint` name/fallback
difference in Task 1c).

### (b) App glass with NO clean glass.css mapping — **needs a decision**
- **Entire S2 hero tier** — `--glass-hero-l-*` / `--glass-hero-d-*` (blur, sat,
  border, hi, shadow, and the teal/gold `-a`/`-b`/`-solid` pane stops),
  [`src/index.css:221-248`](src/index.css#L221). No glass.css equivalent.
- **Hero ink set** — `--hero-ink*`, `--hero-accent`, `--hero-dot-*`, `--hero-chip-*`,
  [`src/index.css:249-258`](src/index.css#L249). No glass.css equivalent.
- **Environment overrides** — `[data-kiosk]` and `[data-meeting-mode]` glass
  reductions, [`src/index.css:582-628`](src/index.css#L582). glass.css only covers
  `prefers-reduced-transparency`.

### (c) glass.css recipes the app doesn't currently *render*
- The S1 translucent tier (`.glass`, `.glass.teal`, `.glass.gold`) — **defined in
  the app but applied by zero components.** glass.css defines only this tier; the
  app's live surfaces all use the S2 hero tier instead. So glass.css's *entire
  shipped recipe* is unused-as-rendered, even though its token values are present.

### Naming / scope fit
Unlike the app.css reconciliation (INTEGRATION.md §1, which had to un-scope
`.nexus`/camelCase → `:root`/kebab), **glass.css already uses `:root`/`.dark` +
kebab `--glass-*-l/d`** ([`glass.css:4,41,48`](docs/design-system/tokens/glass.css#L4)) —
the app's exact mechanism. **No scope adaptation is required.** The only naming
delta is the intermediate `--tile-tint` (DS) vs `--glass-tile-tint` (app).

---

## Task 5 — Scope count

- **Distinct token-glass surfaces:** **13**, all `.glass.hero.teal`, all reading the
  shared CSS class (no per-surface hardcoding). One CSS definition site
  (`src/index.css`) governs all 13.
- **High-risk areas — already handled by existing overrides, not new work:**
  - **Kiosk:** `[data-kiosk] .glass*` drops `backdrop-filter` and resolves to the
    precomputed solids ([`src/index.css:582-616`](src/index.css#L582)). GPU-safe.
  - **MeetingMode:** `[data-meeting-mode] .glass*` caps blur at 8px / sat 100%
    ([`src/index.css:619-628`](src/index.css#L619)). Projector-safe.
  - **PDF (`AgentReportDocument.jsx`): EXEMPT — confirmed.** `@react-pdf/renderer`
    can't resolve CSS vars and has no `backdrop-filter`; the report prints on white
    paper (no glass effect). It uses literal hex mirrored from light `:root` tokens
    (INTEGRATION.md §8). It renders **no** `.glass` class and reads **no** `--glass-*`
    var. Not in scope for glass reconciliation.
- **Direct `--glass-*` consumers outside `index.css`:** only
  [`contrast.js:70-164`](src/utils/contrast.js#L70), which *mirrors* the token
  values in JS for test math (manual-sync liability — see Known gaps). No component
  reads a `--glass-*` var directly; they consume the `.glass.hero.teal` class and
  the `--hero-*` ink vars.

**Bottom line on scope:** if the decision is "S1 already reconciled + document the
hero superset," **zero source surfaces need touching** — the work is docs
(close/annotate the FU, optionally back-port the hero tier into glass.css). If the
decision instead reaches into live surfaces, that is a restyle, not a reconciliation,
and would be a REDESIGN-class change (human-merge, out of this recon's framing).

---

## DECISIONS-NEEDED

**D1 — Direction of the reconciliation (the load-bearing call).**
Given the S1 tokens are already byte-identical and glass.css was derived from the
app, choose one:
- **(D1-a) Close-as-reconciled + document *(recommended)*.** Mark the INTEGRATION.md
  §6 glass FU resolved: state that S1 `--glass-*` matches glass.css exactly and that
  the app ships an app-only S2 hero superset. Optionally add an "app extends the DS
  glass with a hero tier" note. **No source change.**
- **(D1-b) Back-port the hero tier INTO glass.css** so the DS captures the full app
  reality (glass.css becomes a true mirror incl. `--glass-hero-*` + hero inks). Docs
  change only; larger surface; keeps DS and app in lockstep for future work.
- **(D1-c) Adopt glass.css "as-is" as canonical.** Near no-op (values already match);
  would leave the hero tier undocumented in the DS and is the weakest option.

**D2 — Which surfaces are in-scope vs leave-as-is.**
Recommendation to confirm: **leave all 13 live hero surfaces untouched** (already
AA-certified); **leave the unused S1 + gold-hero definitions in place** (cheap
option value, guarded); **leave hand-rolled auth cards + modal scrims out of scope**
(separate neutral/scrim aesthetic, not teal/gold hero glass). Confirm nothing here
is meant to be restyled under the banner of "reconciliation."

**D3 — Naming micro-decision: `--glass-tile-tint` vs DS `--tile-tint`.**
The app namespaces the intermediate tint var and adds a `transparent` fallback
([`src/index.css:524`](src/index.css#L524)); glass.css uses bare `--tile-tint`
([`glass.css:32`](docs/design-system/tokens/glass.css#L32)). Recommendation: **keep
the app's `--glass-tile-tint` + fallback** (more robust; the fallback lets a bare
`.glass` degrade gracefully). If D1-b/c, align glass.css to the app's name rather
than the reverse.

**D4 — Does any text-on-glass need an ink adjustment alongside the glass change?**
Recommendation: **no.** All live inks are certified against the hero pane floors;
gold-on-glass doesn't render; S1 is unused. This holds **only if D2 keeps the hero
tier and its inks intact** — the moment a live surface's glass values change, its
inks must be re-run through `heroPair()`/`heroPairDeep()` before merge.

**D5 — Handling of the stale FU wording.**
INTEGRATION.md §6 and the CLAUDE.md theme section both list glass reconciliation as
"NOT yet done," which this recon shows is misleading for the S1 tier. Confirm whether
D-owner wants those notes corrected as part of closing the FU (docs hygiene), and by
whom (this is a token-DEFINITIONS-adjacent doc edit → human-merge per the channel
policy regardless).

---

## Known gaps (Rule 22) & falsifier (Rule 23)

**Known gaps in this recon:**
1. **Static-only.** I read source and token values; I did **not** render the app or
   measure computed styles/contrast in a browser (read-only, no preview). The 13
   surfaces are confirmed by class string, not by screenshot; theme appearance
   ("both") is inferred from the `.dark .glass*` rules existing, not visually
   verified.
2. **`contrast.js` manual-sync liability, unquantified.** `glassPair()`/`heroPair()`/
   `heroPairDeep()` ([`contrast.js:70-164`](src/utils/contrast.js#L70)) hardcode the
   token RGBs/alphas in JS with "update both here and there" comments
   ([`:60-61`](src/utils/contrast.js#L60)). Any glass-value reconciliation must
   update `contrast.js` in lockstep or the ratio matrix silently tests stale values.
   I did not audit whether every current token matches its `contrast.js` mirror
   value-for-value (spot-checks matched; not exhaustively diffed).
3. **Third DS copy not diffed.** A third `glass.css` exists at
   [`docs/design-system/screens-v2/_ds/.../tokens/glass.css`](docs/design-system/screens-v2/_ds/agencytrack-design-system-ad1cd77a-1bcf-4449-a9f6-c870361300fb/tokens/glass.css);
   I diffed the two canonical/source copies (identical, S1-only) but not this third
   packaged artifact. Low risk (CLAUDE.md names `tokens/glass.css` as canonical).
4. **"Unused" is grep-scoped.** S1/gold-hero classes are unused per JSX grep of
   `src/`; I did not exhaustively rule out a dynamically-constructed class string
   (none seen; no `GlassCard` primitive exists to hide one).

**Rule 23 — what would overturn the D1-a "already reconciled (S1)" recommendation:**
Finding any **live** surface that (a) applies the bare S1 `.glass`/`.glass.teal`/
`.glass.gold` class, or (b) reads a `--glass-l-*`/`--glass-d-*` token whose app
value has **drifted** from glass.css. Either would mean the S1 tier is load-bearing
and/or divergent, turning this from a docs close-out into a real values
reconciliation. The Task-1a table (20/20 identical) and Task-2a inventory (zero S1
usages) are the evidence; a counterexample to either overturns the recommendation.
