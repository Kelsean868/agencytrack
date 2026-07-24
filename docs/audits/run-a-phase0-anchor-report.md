# RUN A — PHASE 0 ANCHOR VERIFICATION REPORT

**Run:** Run A, Waves 1–3 (brief: `docs/briefs/run-a-waves1-3-kickoff.md`, landed `60dbf1c2`)
**Orchestrator:** Claude Opus 4.8
**Date:** 2026-07-23
**Repo state at verification:** local `main` == `origin/main` == `60dbf1c2` (clean tracked tree)
**Status:** 10 / 10 anchors VERIFIED · 0 FAILED · **4 brief-vs-repo divergences surfaced — see § Divergences**

---

## Anchor table

| # | Anchor | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | `docs/design-system/proposals/planner-scheduler-v2/README.md` — sole Tier 2 design authority | **VERIFIED** | File exists on `origin/main`. Describes exactly the five enhancements: **E1** desktop 3-day+week toggle (`grid-cols-3`/`grid-cols-7`, fluid `1fr`, reuse `groupByDate`/`sortByStartTime`/`buildWeekDates`) · **E2** drag-drop → *"call the EXISTING `postponeWithRebook(tenantId, apptId, newData, meta)`"* · **E3** running-late gap-smart cascade (`computeLateCascade`) · **E4** per-appointment notes thread (`appointments/{id}/notes[]`) · **E5** collapsed-rail `max-w-none` adaptation. Build order in README §"Build order & wiring" = E1 → E5 → E2 → E3 → E4. **Matches the brief's E1–E5 feature set.** |
| 2 | Seeder — locate + confirm current fixture coverage | **VERIFIED** (path differs from brief) | Actual path is **`scripts/staging/seed-fixtures.mjs`**, not `scripts/seed-fixtures.mjs`. Targets project `agencytrack-staging`, tenant `staging_test`; hard-aborts before any write if project resolves to `agencytrack-2a610` (prod). Coverage confirmed — **see Divergence D1.** |
| 3 | `SMOKES.md` — registry format before adding six Run-9 smokes | **VERIFIED** | Path is **`scripts/verification/SMOKES.md`**. Format = single markdown table under `## Standing per-surface smokes` with 4 columns: `Surface \| Smoke file \| Run mode \| Re-run when touching`. Second section `## Retired / one-off (not standing)`. All six Run-9 smoke files exist: `smoke-run9-{a1-undo,a2-shortcuts,a3-conflicts,a4-templates,a5-bulk,f3e-series}.mjs`. None currently registered. |
| 4 | Track J ledger + recon still lack supersession banners | **VERIFIED** | `docs/track-j-port-ledger.md` — no banner at head; `18 of 34` claim live at **L3** and **L13**. `docs/audits/trackj-recon-2026-07-07.md` — no banner at head; its own **L158** states it *supersedes* the ledger ("its port-status column is ~1 month stale"), yet the ledger carries no reciprocal banner. Both confirmed stale-unbannered. |
| 5 | `CONTEXT.md` — stale "J2 is next"; head lineage `ebb168f1` / fill `53a65faa` | **VERIFIED** | Stale prose confirmed at **`docs/CONTEXT.md:205`**: *"J2 (Agent Dashboard — Planning/Tools/Recognition nav groups + content deltas) is next."* `Current main HEAD` row (**L18**) = `` `ebb168f1` `` (PR #864). Fill commit `53a65faa` present in `git log` as *"docs: post-merge fill for PR #864"*. Lineage matches the brief. |
| 6 | `FOLLOW_UPS.md` index rows in the stated stale states | **VERIFIED** | **L55** index row *"Planner recurrence — 'edit this and all future' instances"* listed **MEDIUM / open**, while its body at **L563** reads *"RESOLVED … shipped as Run 9 F3, evidence `d0e74c12`"* — exact drift the brief predicted, including the SHA. **L37** index row `t1-compliance-scope` carries **RESOLVED** text yet remains in the open index. Both stale states confirmed. |
| 7 | Verification lib production-URL construction (pre-pin behavior) | **VERIFIED** | `scripts/verification/lib/walk-helpers.mjs` — **L207** `const PROD_URL = 'https://agencytrack.vercel.app';`; **L211** returns it for `--prod` / `SMOKE_PROD=1`; **L215** returns it as the default fallback; **L190** `process.env.SMOKE_PREVIEW_URL ?? 'https://agencytrack.vercel.app'`. **Confirmed non-pinned — `portal.agencytrack.app` appears nowhere in the lib.** This is exactly the rollback-scare vector Tier 1 item 3 targets. |
| 8 | Existing reschedule/propagation service (Run 9 F3) — must not be reimplemented | **VERIFIED** | `src/services/plannerService.js` exports **`postponeWithRebook(tenantId, originalApptId, newData, meta)`** (param 2 is `originalApptId`; README names it `apptId` — same arity/semantics). Sibling write paths present and reusable: `updateAppointment`, `bulkUpdateAppointments` (`BULK_CHUNK_SIZE = 400`), `setAppointmentStatus`, `undoPostpone`, `getSeriesInstances`, `getAgentDay`, `getAgentWeek`, `createRecurringAppointments`. E2 wires to `postponeWithRebook`; propagation is NOT to be reimplemented. |
| 9 | Appointments collection name (recorded, not assumed) | **VERIFIED** | `src/services/plannerService.js:91-92` — `function apptCollection(tenantId) { return collection(db, ` `tenants/${tenantId}/appointments` `); }`. **Exact collection: `tenants/{tenantId}/appointments`.** All planner reads/writes route through this helper (L135, 162, 330, 347, 369, 388). |
| 10 | ChampionsPanel live ranking source (pre-Tier-3a) | **VERIFIED** | `src/components/dashboard/ChampionsPanel.jsx:71` renders the literal string **"Ranked by API, this week"** — matches the R-08 ruling text. Fed as the `champions` prop from `ManagerOverviewTab.jsx:123` (`weeklyChampions`). Ranking math lives in `src/utils/weeklyChampions.js`; its L72 header documents *"Ranks by weekly API desc"* with an honest empty state (L75) rather than a podium of zeros. |

---

## Divergences (brief vs. repo state) — dispatcher ruling requested

### D1 — Tier 1 item 1: two of the three fixture families already exist
**Brief:** *"Extend the seeder with three fixture families: campaigns, settled policies, jointCalls."*

**Repo (`scripts/staging/seed-fixtures.mjs`):**
- **campaigns — ALREADY SEEDED.** L683–684: `CAMP_QUALIFY`, `CAMP_PLACEMENT`.
- **settled policies — ALREADY SEEDED.** Six docs with `status: 'settled'` (L639–646: `vhfix-pol-a1-{within,atrisk,overdue,delivered}`, `vhfix-pol-a2-within`), spread across a 30-day clawback clock.
- **jointCalls — GENUINELY ABSENT.** `src/services/jointCallsService.js` + `JointCallsTab.jsx` exist and are live, but no `jointCalls` fixture family is seeded.

**Consequence:** Tier 1 item 1 reduces from three families to **one** (`jointCalls`).

### D2 — Tier 1 item 2: the non-vacuity precondition is already satisfied
**Brief:** *"the fixture must contain at least one lapsed policy so Net ≠ Gross and the assertion is non-vacuous."*

**Repo:** `vhfix-pol-a2-lapsed` already exists (L646) — `status: 'lapsed'`, `lapsedDaysAgo: 15`, `issuedDaysAgo: 100`, `sapi: 4500`, with `dateLapsed` + `lapseReason` set. `src/lib/policiesDerivation.js` exists as the Net-vs-Gross derivation path named in the brief.

**Consequence:** no fixture work needed for item 2 — only the assertion itself. The assertion is non-vacuous against the *existing* fixture set.

### D3 — Tier 2 / E4: the README **does** require the `prospectId` shape the brief pre-flagged
**README §E4:** *"**notes travel with the prospect**: past appointments' notes for the same `prospectId` surface on the prep card / booking sheet."*

**Brief §Tier 2.4:** *"If the README requires notes keyed by `prospectId` … build the contract layer + UI against the appointment-scoped shape, tag the divergence NEEDS-HUMAN-REVIEW in the PR body, and STOP the E4 arm there."*

**Assessment:** the *storage* shape the README specifies (`appointments/{id}/notes[]` or a subcollection) is already appointment-scoped and inherits the existing rules surface — no rules change needed for storage. The `prospectId` requirement is a **cross-appointment read/surfacing** concern, not a new write shape. Whether that read is already covered depends on the live `appointments` rules, which this run may not edit. **This trips the brief's own E4 protocol on its face** — flagging rather than deciding.

### D4 — Tier 2 / E3: "Notify" scope — README vs brief
**README §E3:** *"**Notify**: Call / WhatsApp buttons per affected prospect with a prepared copy-on-tap message."*

**Brief §Tier 2.5:** *"The 'notify prospect' half is DISPLAY-ONLY (banner/status affordance). Any actual send (email/WhatsApp/SMS/notification) is functions-adjacent and out."*

**Assessment:** `tel:` / `wa.me` deep links plus copy-to-clipboard are entirely client-side and send nothing from our system — arguably inside the brief's constraint. But *"display-only (banner/status affordance)"* is narrower than *"Call / WhatsApp buttons"*. The brief's tie-break says the README wins on disagreement; its own scope sentence says otherwise. **Genuine design-authority mismatch — ruling requested.**

---

## Non-blocking observations (logged, no action taken)

- **Tier 1 item 6 (CI action bumps):** only two workflows exist — `.github/workflows/ci.yml` and `gemini-review.yml`. Current pins are `actions/checkout@v4` (×3) and `actions/setup-node@v4` (×2). **No `@v3` actions remain.** The "deprecated Node-20" framing therefore maps to a v4 → v5 bump (Node 24 runner), which needs currency verification (Rule 24) at build time rather than a blind bump.
- **`gemini-review.yml` is still present** though CONTEXT.md records Gemini sunset 2026-07-17 and names CodeRabbit as sole reviewer. Not in the brief's scope; FU candidate.
- **Tier 1 item 7 (orphan cleanup) — the guard bites.** `ManagerHeroSection.jsx` has **zero real imports** (only a comment mention at `ManagerOverviewTab.jsx:22` plus its own test) ⇒ genuinely orphaned. But **`MedalCoin.jsx` is LIVE** — imported by `ChampionsPanel.jsx:22` and `ProductionLeaderboardSurface.jsx:26` (used at L154, L306). The brief's phrase *"medal trio"* has **no confirmable three-file referent** in the repo (nearest candidates: `MedalCoin.jsx` [live], `TeamMedalsPanel.jsx`, `KioskMedal.jsx`). The brief's own guard — *"delete ONLY after grep-confirming zero imports"* — correctly reduces item 7 to deleting `ManagerHeroSection.jsx` (+ its test) and nothing else.
- **Branch flow available:** `origin/staging` exists, so the feature → `staging` PR flow in the brief is executable as written.
- **Tier 3a environment note:** `scripts/staging/seed-fixtures.mjs` can only seed `staging_test` on `agencytrack-staging` (it hard-aborts on the prod project), whereas Tier 3a's `tatillife_smoke` live-verification item is prod-side (`agencytrack-2a610`). These are two different environments; existing prod smokes (per `SMOKES.md`) already write to `tatillife_smoke` behind hard guards that abort on `tatillife_south`. Recorded so the Tier 3 dependency is not misread as "one seeder feeds both".

---

## Gate disposition

**No anchor failed** — the Phase 0 gate as written (*"If any anchor fails, STOP"*) does **not** trip.

Halting nonetheless under the run's **ESCALATION RULE** (*"any conflict between this brief and repo state"* → STOP), on **D1/D2** (Tier 1 item 1–2 scope is materially smaller than the brief assumes) and **D3/D4** (Tier 2 design-authority mismatches that are expensive to rework after E1/E5 land).

**STOP and wait for dispatcher.**

---

## DISPATCHER RULINGS (received 2026-07-24) — divergences resolved

- **D1 — APPROVED.** Build `jointCalls` fixtures only. Log campaigns + settled policies as pre-existing (run log + Tier 1 PR body). Existing fixture families untouched.
- **D2 — APPROVED.** Assertion only, no seeding. The assertion must pin **direction and cause**: `net < gross` **because** `vhfix-pol-a2-lapsed` is excluded by `policiesDerivation.js` — not merely `net != gross`.
- **D3 — IN-BOUNDS, two conditions.** (1) Storage stays appointment-scoped (`appointments/{id}` subcollection/field). Read aggregation by `prospectId` approved ONLY scoped to the requesting agent's own appointments (record the actual owner field used). Any cross-agent note visibility ⇒ NEEDS-HUMAN-REVIEW tag + build the own-appointments version. (2) Before building E4, READ (never edit) `firestore.rules` and confirm the `appointments` read arm permits the `prospectId`-filtered own-scope query; record the rule arm in the run log as E4 precondition evidence.
- **D4 — README WINS, GUARDED.** Build Call/WhatsApp buttons as pure client-side deep links (`tel:`, `wa.me`) + copy-on-tap clipboard. Absolute guard: no CF, no third-party API, no notification service, no background send. Any README fragment implying automated send is out of scope and logged.

**Non-blocking rulings:**
- **Item 6:** bump `actions/checkout` → v5 (Node-24 runtime) and `actions/setup-node` → v6. Pin majors. (Verified current 2026-07-24: v4 pins are the Node-20 deprecation source; Node 20 removed from runners 2026-09-16.) CI green = acceptance.
- **Delete `gemini-review.yml`** in the same Tier 1 commit (dead post-sunset workflow; removal in scope).
- **Item 7:** delete `ManagerHeroSection.jsx` only. `MedalCoin.jsx` is live — keep. "Medal trio" = stale FU claim; record it in the item 5 index sweep.

## BUILD BASE DECISION (recorded)

Tier 1 PRs into `staging` (brief Target-branch-flow + dispatcher). `origin/staging` (`a31d52d7`) has **diverged** from `origin/main` (`60dbf1c2`) — the documented "staging re-baseline pending" drift: 8 commits on main not staging (incl. Track K P1 code `ebb168f1` + #864 fill `53a65faa`), 5 docs-only commits on staging not main (the E1–E5 recon inputs). Feature branch `run-a-tier1-hygiene` cut off **`origin/staging`** for a clean PR diff. Of the 12 files Tier 1 touches, 10 are byte-identical between staging and main; only `CONTEXT.md` and `FOLLOW_UPS.md` differ (staging lacks the #864 fill). The specific stale strings Tier 1 sweeps were re-confirmed present in the **staging** copies of both — Phase 0 evidence (gathered against main) transfers. The CONTEXT.md sweep is scoped strictly to the "J2 is next" prose; the staging re-baseline is a separate attended item and is NOT attempted here.
