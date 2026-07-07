# Migration-Doc Reconciliation — DS migration plan vs the executed reskin

**Date:** 2026-07-07 · **Branch:** `docs/migration-plan-reconcile` · **Mode:** DOCS-ONLY (no source/functions edits, no deploy, no merge)
**Purpose:** Reconcile the committed design-migration doc(s) in `docs/design-system/screens-v2/` against what was **actually executed** on `main`, so a future Track-J session reads one authoritative plan instead of two competing ones.

---

## 0 · TL;DR

There are **two** migration docs in `screens-v2/`, from the same author lineage:

- **DOC-A (v1)** — [`AgencyTrack App - DS Audit & Migration Plan.html`](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html). A **design-tool-only** audit; basis = "design artefacts in this project" ([DOC-A:99](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)). It **never read the repo**.
- **DOC-B (v2)** — [`AgencyTrack App - DS Audit & Migration Plan v2 (Repo-Reconciled).html`](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html). Same author, **reconciled against `main`** (cited HEAD `9dcae1a3`, [DOC-B:127](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html) — verified a real commit). Its **§0** explicitly corrects DOC-A.

**The crux — two different *layers* of "migration" are in play, and conflating them is the whole risk:**

| Layer | What it is | Status | Authoritative record |
|---|---|---|---|
| **L1 — Token-foundation reskin** | CSS-variable layer swap in `src/index.css` — "values change, plumbing stays" (token values, scope, fonts, gold, glass, motion) | **EXECUTED** (recon #811; PRs #813/#815/#816/#817/#820/#821) | [`INTEGRATION.md`](../design-system/INTEGRATION.md) + [`reskin-recon-2026-07-05.md`](reskin-recon-2026-07-05.md) + CLAUDE.md |
| **L2 — Per-screen component port** | Porting the 34 v2 mockups' visual deltas into React components, screen by screen ("Track J") | **PARTLY done** (B1–B5, J1 shipped; J2 next), **largely PENDING** | The docs themselves (their genuinely-useful part) |

The **executed record settles L1** (the token-strategy question) definitively. **Both docs are mostly about L2** — but **DOC-A conflates L2 with a *wrong* L1 token strategy** (build on the `_ds` bundle + `.nexus` camelCase tokens). **DOC-B pre-corrected that** and aligns with the executed L1 strategy, while a couple of its own L1 sub-claims went stale after PR #813.

**Bottom line for a future Track-J reader:**
- **DOC-A → SUPERSEDED, historical only.** Its token/bundle strategy is contradicted by both DOC-B and the executed reskin.
- **DOC-B → SUPERSEDED *as the authoritative migration record* (INTEGRATION.md is that), but retained as a *live Track-J input*.** Its per-screen port plan and the net-new CRO build are genuine pending work; a few token-layer claims are stale (chiefly the §1 `inkFaint` "don't port the split" note — the split *did* ship).

---

## 1 · What the migration docs prescribe

### DOC-A (v1) — the design-tool-only plan

- **Token strategy:** adopt the DS's **`.nexus` / `.nexus.dark`, camelCase** tokens (`--teal`, `--inkMute`) from `app-v2.css` — *not* the app's kebab tokens ([DOC-A:99,120,132,268](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
- **Component strategy:** build on the bound **`_ds` bundle** exports (`AppShell, Scorecard, GlassCard, StateLayer, Money`, …); **delete local re-implementations** ([DOC-A:110,121,131,242–249](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
- **Headline framing:** "**0 of 39 screens are built on the bound `_ds` bundle**" — treated as a from-scratch migration ([DOC-A:110](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
- **Four screens "No redesign / missing":** Settlements, Agent of Month, Admin Dashboard, Branches ([DOC-A:184,189,202,203,212](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
- **inkFaint AA fix:** light `#A8A39C → #7A7264`; old value → `--inkDim` (non-text) ([DOC-A:124,133](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
- **Fonts:** retire Space Mono + Fontshare/Google CDN → local `@font-face` from `_ds/assets/fonts`; mono → JetBrains Mono ([DOC-A:122,134–135,237](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
- **State design:** every data surface through `StateLayer` (loading/empty/error + skeleton) ([DOC-A:123,136,269](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
- **Glass:** one `GlassCard` max per screen, top summary only ([DOC-A:138,271](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
- **Build order:** Phase 0 scaffold the unified shell (copy `templates/nexus-portal/`, adopt `app-v2.css` verbatim) → agent → manager → admin ([DOC-A:232–263](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).

### DOC-B (v2) — the repo-reconciled plan

- **§0 Correction 1:** the production app **does not use the `_ds` bundle and shouldn't** — it runs its **own DS in `src/index.css` (Tailwind tokens in `:root`/`.dark`)**; the target is to **port mockups into existing React components using existing tokens**, not rebuild on the bundle ([DOC-B:130–132](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
- **§0 Correction 2:** the four "missing" screens all exist (`SettlementPanel`, `AgentOfMonthTab`, `TenantAdminDashboard`, `BranchesPanel`) ([DOC-B:135–136](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
- **§0 Correction 3:** it's a tracked, ~80%-shipped port ("Track J") + the B1–B5 series; **J2 Agent Dashboard is next** ([DOC-B:138–140](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
- **§1 token bridge:** map every mockup value to an existing token, **never introduce new hex** ([DOC-B:143–158](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
- **§1 inkFaint:** claims the AA concern is "**handled in-repo** via the D5 rule … **does not need the `_ds` token split ported**"; its bridge maps `--ink-faint #A8A39C → ink-faint (non-text only)` ([DOC-B:152,158](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
- **§1 gold:** `--gold #B07D1A → gold → recognition only` (single token) ([DOC-B:153](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
- **§2 screen-by-screen:** nearly every mockup already has a target component; per-screen "Port / verify" for the deltas ([DOC-B:162–223](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
- **§3 net-new:** **CRO / back-office Delivery Register + 30-day clawback clock** — "the one real build"; no CRO branch in `App.jsx` today ([DOC-B:226–234](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)). Plus transactional emails to verify ([DOC-B:232](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
- **§4 build plan:** A finish agent port (J2 first) → B manager → C build CRO → D emails + system ([DOC-B:240–267](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).

---

## 2 · What was actually executed (the L1 record)

From [`INTEGRATION.md`](../design-system/INTEGRATION.md), [`reskin-recon-2026-07-05.md`](reskin-recon-2026-07-05.md), CLAUDE.md, and the merged PRs on `main`:

- **Scope decision — UN-SCOPED to `:root`/`.dark`, kebab `--color-*` names, channel substrate kept.** The DS's `.nexus`/`.nexus.dark` camelCase scope was **not adopted** ([INTEGRATION.md §1, lines 9–26](../design-system/INTEGRATION.md); [reskin-recon DECISION 1, lines 262–265](reskin-recon-2026-07-05.md)). `.nexus` appears in **0 runtime files**.
- **The `_ds` bundle never ships** — the app already has an equivalent DS in `src/index.css`; the reskin is a **token-value reconciliation, not a component rewrite** ([reskin-recon Summary, line 12](reskin-recon-2026-07-05.md)).
- **Channel substrate retained** — every migrated color keeps its `--X-channels` triplet so Tailwind `/alpha` modifiers resolve ([INTEGRATION.md §3](../design-system/INTEGRATION.md)).
- **inkFaint AA fix — PORTED:** `--color-text-faint` `#A8A39C → #7A7264` (light) / `#8A8074 → #968B7C` (dark), **and** a new **`--color-ink-dim` `#A8A39C`** non-text role ([INTEGRATION.md §4, lines 98–101 + name-map lines 39–40](../design-system/INTEGRATION.md)). PR #813.
- **Gold — SPLIT (beyond a single token):** `--color-gold` vivid `#B07D1A` (decoration + AA-large display) **plus** `--color-gold-ink` `#8a6011` (light) / `#E0AA3E` (dark) for all other gold text ([INTEGRATION.md name-map line 49, §6 lines 120–122](../design-system/INTEGRATION.md); `gold-split-audit.md`). PR #816.
- **Fonts — Fontshare CDN removed; Satoshi + Cabinet Grotesk self-hosted** from `src/assets/fonts/` (not `_ds/`); **JetBrains Mono still CDN** (no woff2 committed) ([INTEGRATION.md §7, lines 145–178](../design-system/INTEGRATION.md)). PR #815.
- **Glass — reconciled, no source change:** the app's `--glass-*` tokens are value-identical to `tokens/glass.css`; the app ships an app-only hero superset; every live glass surface is `.glass.hero.teal` ([INTEGRATION.md §6 glass block, lines 132–143](../design-system/INTEGRATION.md); `glass-recon-2026-07-06.md`). PR #820.
- **Motion — token wiring + screen-enter + reduced-motion patches** (`--dur-*`/`--ease-*` now consumed; systemic §2) ([INTEGRATION.md §9, lines 218–271](../design-system/INTEGRATION.md)). PR #821.
- **Holdouts — PDF palette + stray `#fff` literals reconciled** to the Nexus system ([INTEGRATION.md §8](../design-system/INTEGRATION.md)). PR #817.
- **Explicitly deferred (INTEGRATION.md §6, lines 118–126):** `surfaceSoft` 5th tier, **wiring skeleton/hero-ink tokens + state-design into components**, **per-screen Track-J polish**, JetBrains Mono self-host.
- **`functions/` was out of scope** for the reskin ([reskin-recon line 6](reskin-recon-2026-07-05.md)).

Merged PRs on `main` (verified via `git log origin/main`): `8ad47761` #811 recon · `ad06768d` #813 foundation · `b8b7d72f` #815 fonts · `0773af3a` #816 gold split · `efb97a60` #817 holdouts · `141f996b` #820 glass · `7fc30ab6` #821 motion.

---

## 3 · Delta table (claim-by-claim; both sides cited)

Legend: **SUPERSEDED** = executed differently, doc now wrong · **CONFIRMED** = matches executed · **STILL-PENDING** = a real Track-J to-do the doc correctly identifies · **CONFIRMED+BEYOND** = doc's claim holds but execution went further.

| # | Doc | Claim (cited) | Executed reality (cited) | Verdict |
|---|---|---|---|---|
| A1 | DOC-A | Adopt `.nexus`/`.nexus.dark` **camelCase** tokens from `app-v2.css` ([A:99,120,132,268](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | UN-SCOPED to `:root`/`.dark`, kebab `--color-*`; `.nexus` in 0 runtime files ([INTEGRATION.md §1](../design-system/INTEGRATION.md); [recon DEC 1](reskin-recon-2026-07-05.md)) | **SUPERSEDED** (direct opposite) |
| A2 | DOC-A | Build on the bound **`_ds` bundle**; delete local re-impls ([A:110,121,242–249](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | Bundle never ships; app keeps its own DS in `src/index.css` ([DOC-B:132](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html); [recon Summary](reskin-recon-2026-07-05.md)) | **SUPERSEDED** |
| A3 | DOC-A | "0 of 39 built on the bundle"; from-scratch migration ([A:110,102](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | ~80% already ported; nearly every screen has a component ([DOC-B:138–140,162–223](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | **SUPERSEDED** (wrong yardstick) |
| A4 | DOC-A | Settlements / AOM / Admin Dash / Branches = "No redesign / missing" ([A:184,189,202,203](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | All four exist in `src/` (verified `git ls-files`); [DOC-B:136](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html) | **SUPERSEDED** |
| A5 | DOC-A | inkFaint `#A8A39C→#7A7264`; old → `--inkDim` (non-text) ([A:124,133](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | Exactly this shipped (#813) ([INTEGRATION.md §4](../design-system/INTEGRATION.md)) | **CONFIRMED** (DOC-A's systemic-gap table is *correct* here) |
| A6 | DOC-A | Retire Fontshare CDN → self-host; mono→JetBrains ([A:122,134–135,237](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | Fontshare removed, Satoshi+Cabinet self-hosted (#815); **JetBrains still CDN**; served from `src/assets/fonts/` not `_ds/`; Space Mono never in shipped app ([INTEGRATION.md §7](../design-system/INTEGRATION.md)) | **CONFIRMED (mechanism)** + JetBrains self-host **STILL-PENDING** |
| A7 | DOC-A | `StateLayer` (loading/empty/error + skeleton) on every data surface ([A:123,136,269](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | Not wired; `--color-skeleton` shipped 0-consumers; state-design **deferred** ([INTEGRATION.md §6](../design-system/INTEGRATION.md)) | **STILL-PENDING** |
| A8 | DOC-A | One `GlassCard` max/screen, top summary only ([A:138,271](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | Token side reconciled (#820); per-screen glass *usage* not audited ([INTEGRATION.md §6 glass](../design-system/INTEGRATION.md)) | **STILL-PENDING** (per-screen check) |
| A9 | DOC-A | Phase 0 "scaffold unified shell" (copy `templates/nexus-portal/`, adopt `app-v2.css` verbatim) ([A:232–239](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)) | No such scaffold; predicated on A1/A2 which were rejected | **SUPERSEDED** |
| B1 | DOC-B | §0: use the app's own `:root`/`.dark` tokens, not the bundle ([B:130–132](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | Exactly the un-scope decision ([INTEGRATION.md §1](../design-system/INTEGRATION.md); [recon DEC 1](reskin-recon-2026-07-05.md)) | **CONFIRMED** (pre-corrected A1/A2) |
| B2 | DOC-B | §1: map mockup values to existing tokens, never new hex ([B:143–158](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | Same philosophy — token-value reconciliation ([recon Summary](reskin-recon-2026-07-05.md)) | **CONFIRMED** |
| B3 | DOC-B | §1: AA "handled in-repo via D5 … does **not** need the token split ported"; bridge maps `--ink-faint #A8A39C → ink-faint (non-text)` ([B:152,158](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | The split **was** ported: faint→`#7A7264`, new `--color-ink-dim` `#A8A39C` (#813) ([INTEGRATION.md §4](../design-system/INTEGRATION.md)) | **SUPERSEDED** (see note ↓) |
| B4 | DOC-B | §1: gold = single token, `#B07D1A` recognition only ([B:153](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | Gold **split**: vivid `#B07D1A` + `--color-gold-ink` for text (#816) ([INTEGRATION.md name-map:49](../design-system/INTEGRATION.md)) | **CONFIRMED+BEYOND** (core holds; split not anticipated) |
| B5 | DOC-B | §2: per-screen "Port / verify" the mockup deltas ([B:162–223](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | L1 reskin doesn't touch per-screen deltas; Track-J polish deferred ([INTEGRATION.md §6](../design-system/INTEGRATION.md)) | **STILL-PENDING** |
| B6 | DOC-B | §0/§4A: J2 Agent Dashboard is next ([B:140,233,243](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | Not part of L1; Track-J polish deferred ([INTEGRATION.md §6](../design-system/INTEGRATION.md)) | **STILL-PENDING** |
| B7 | DOC-B | §3/§4C: CRO Delivery Register + 30-day clawback clock, net-new ([B:226–234,251–254](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | No `src/` CRO component (only mockups `cro-v2-*.jsx`, verified `git ls-files`) | **STILL-PENDING** (genuine net-new) |
| B8 | DOC-B | §3/§4D: port transactional emails vs `AgencyTrack Emails.html` ([B:232,256–257](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | `functions/` out of L1 reskin scope ([recon line 6](reskin-recon-2026-07-05.md)) | **STILL-PENDING** |
| B9 | DOC-B | §4 DoD: light+dark, tokens-only, reduced-motion, a11y gate ([B:262–267](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)) | Foundation satisfied (motion #821, reduced-motion patches); state-design still pending ([INTEGRATION.md §9,§6](../design-system/INTEGRATION.md)) | **CONFIRMED (foundation)** — DoD remains a valid Track-J gate |

**Note on B3 (the one genuine token-layer contradiction):** DOC-B *reasoned* the app didn't need to port the DS's faint→dim split because the "D5 rule" (no `text-faint` on new text) already avoids the AA failure. The executed reskin **ported the split anyway** (#813), so DOC-B's recommendation is overtaken. This makes DOC-B's §1 bridge row **stale**: post-#813, the repo's `text-faint`/`ink-faint` utility is `#7A7264` (an AA-passing *text* value), and `#A8A39C` is now the separate **`ink-dim`** (non-text) role — a Track-J author following DOC-B's bridge would map a mockup's `#A8A39C` decoration to `text-faint` and get the wrong token. (DOC-B is also internally inconsistent: its own `:root` at [B:12](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html) already uses the fixed `--inkFaint:#7A7264` + `--inkDim:#A8A39C`.) Interestingly, **DOC-A's** systemic-gap table (A5) is *more* aligned with what shipped than DOC-B's prose here.

**Executed beyond either doc (not deltas, just noted for completeness):** the systemic **motion foundation** (#821 — `--dur/ease` wiring, screen-enter) and the **PDF-palette / stray-literal holdout** reconciliation (#817) were executed but neither doc prescribed them. Neither contradicts the docs.

---

## 4 · Three-way classification

### SUPERSEDED — the doc is now wrong (do **not** follow)
- **A1** `.nexus`/camelCase token scope → app un-scoped to `:root`/`.dark`, kebab.
- **A2** build on the `_ds` bundle → bundle never ships.
- **A3** "0 of 39 built" / from-scratch → ~80% already ported.
- **A4** four screens "missing" → all four exist.
- **A9** Phase-0 "scaffold unified shell on `app-v2.css`" → predicated on the rejected strategy.
- **B3** §1 "don't port the inkFaint split" + stale `ink-faint` bridge row → the split shipped in #813.

### CONFIRMED — matches the executed plan
- **A5** inkFaint `#A8A39C→#7A7264` + old→`inkDim` (DOC-A's table is correct).
- **A6** retire Fontshare CDN → self-host Satoshi/Cabinet (mechanism; JetBrains residual pending).
- **B1** use the app's own `:root`/`.dark` tokens, not the bundle.
- **B2** map mockup values to existing tokens, never new hex.
- **B4** gold `#B07D1A` for recognition (core holds; execution added the `gold-ink` text split — CONFIRMED+BEYOND).
- **B9** the per-screen Definition-of-Done (foundation satisfied; DoD still a valid gate).

### STILL-PENDING — a real Track-J to-do the doc correctly identifies
- **A7 / B5 / B9** state-design (`StateLayer` loading/empty/error + skeleton) on every data surface — deferred in L1.
- **A8** per-screen glass discipline (one hero GlassCard max) — token side reconciled, usage audit pending.
- **A6-residual** JetBrains Mono self-hosting — last remaining CDN font.
- **B5** per-screen visual-delta verification across agent → manager → admin surfaces.
- **B6** J2 Agent Dashboard (Planning/Tools/Recognition nav groups + content deltas) — the flagged "next."
- **B7** CRO / back-office Delivery Register + 30-day clawback clock — genuine net-new.
- **B8** transactional email templates (`functions/email-templates/*`) — out of the L1 reskin scope.

---

## 5 · Extracted STILL-PENDING list (clean Track-J inputs)

These are the genuinely-useful items to carry forward. The **token foundation (L1) does not complete any of them** — they are per-screen / net-new (L2) work.

1. **Agent Dashboard J2** — Planning / Tools / Recognition nav groups + content deltas. Flagged as *next* ([DOC-B:140,243](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
2. **Per-screen visual-delta verification** — diff each v2 mockup against its live component (most are "Built"); confirm no drift, apply deltas with existing tokens. Agent → manager → admin order ([DOC-B:162–223,240–250](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html); [DOC-A:151–208](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
3. **State-design wiring** — loading / empty / error + skeleton on every data surface (redesign-addendum §1). `--color-skeleton` token exists but has **0 consumers** ([INTEGRATION.md §6](../design-system/INTEGRATION.md); [DOC-A:123,136](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).
4. **Per-screen glass discipline** — one hero `GlassCard` max per screen, top-summary only ([DOC-A:138](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)). Token side already reconciled (#820).
5. **CRO / back-office build** — route the CRO role, then build the Delivery Register + 30-day clawback clock on the Settlement/Reconciliation patterns. **Rules / functions / custom-claims changes here are human-merge + explicit `firebase deploy`** (project policy) ([DOC-B:226–234,251–254](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)).
6. **Transactional email templates** — port `functions/email-templates/*` (monday/sunday nudge, password reset) vs `AgencyTrack Emails.html`. Inline-style/table HTML, not React; **`functions/` was out of the reskin scope** ([DOC-B:232,256–257](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html); [recon line 6](reskin-recon-2026-07-05.md)).
7. **JetBrains Mono self-hosting** — commit woff2 (400/500) to `src/assets/fonts/`, drop the last CDN font ([INTEGRATION.md §7 follow-up](../design-system/INTEGRATION.md); [DOC-A:134](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan.html)).

**Adjacent (data, not screens — flagged in [DOC-B:235](../design-system/screens-v2/AgencyTrack%20App%20-%20DS%20Audit%20%26%20Migration%20Plan%20v2%20%28Repo-Reconciled%29.html)):** multi-branch AOM data model (blocks second-branch onboarding); restore the branch-scoped kiosk users-list (real names). These may already be tracked in `docs/FOLLOW_UPS.md` — **verify there before actioning** (not re-audited in this docs-only pass).

---

## 6 · Actions taken by this reconciliation

- Wrote this report (`docs/audits/migration-doc-reconciliation-2026-07-07.md`).
- Added a **SUPERSEDED — historical only** banner to the top of **DOC-A** (its token/bundle strategy is contradicted by both DOC-B and the executed reskin).
- Added a **SUPERSEDED as the authoritative record — retained as a live Track-J input** banner to the top of **DOC-B** (strategy premise aligns with what shipped; INTEGRATION.md is the authoritative L1 record; a few token-layer sub-claims are stale; its per-screen + CRO items remain genuine pending work).
- **No source, `functions/`, or token files were touched.** Banners are self-contained HTML added inside `<doc-page>`; the original doc content is preserved verbatim below each banner.

---

## 7 · Known gaps (Rule 22) & falsifiers (Rule 23)

- **Per-screen "Built" claims not independently re-verified.** DOC-B's §2 table asserts a target component exists for nearly every screen. I spot-verified the four DOC-A called "missing" (all exist) and CRO (absent), but did **not** open all ~34 components to confirm each "Built"/"Port-verify" status. The STILL-PENDING framing (item 2) treats them as *verify*, which is safe regardless.
- **"Track J" ship-state is taken from the docs + INTEGRATION.md deferrals, not a full git audit.** B1–B5 / J1 "shipped" and "J2 is next" come from DOC-B's prose and INTEGRATION.md §6's "per-screen Track-J polish (deferred)"; I did not enumerate every Track-J PR. A future session should confirm the exact J-phase HEAD before picking up item 1/2.
- **Adjacent data FUs (multi-branch AOM, kiosk users-list) not cross-checked against `docs/FOLLOW_UPS.md`** — flagged for verification, not asserted as open.
- **DOC-B's cited main HEAD `9dcae1a3` ≠ current HEAD.** It reconciled against an earlier `main`; current is `f80d5ba1`. The L1 reskin PRs (#813–#821) landed in that window, which is exactly why DOC-B's token-layer sub-claims (B3/B4) drifted. This reconciliation is anchored to `f80d5ba1`.
- **Falsifier for the classifications:** the SUPERSEDED verdicts (A1/A2/A9, B3) would be overturned only if the app later re-adopts `.nexus` scoping or the `_ds` bundle (INTEGRATION.md §1's own Rule-23 condition: a second themed region co-hosted in the same DOM). The STILL-PENDING verdicts would be overturned by evidence that a later Track-J PR already shipped that screen/CRO — check `git log origin/main --grep` for the specific surface before starting.

---

*Docs-only reconciliation. No merge, no deploy. Prepared for a future Track-J session so the executed plan (INTEGRATION.md) is authoritative and the design docs are preserved as historical reference + pending-work inputs.*
