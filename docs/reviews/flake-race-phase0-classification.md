# Flake race — Phase 0 pre-registered classification

**Brief:** `docs/briefs/flake-race-investigation-kickoff.md`
**Branch:** `fix/flake-awaiting-pattern` off `origin/staging` `27303333`
**Written:** 2026-08-11
**Status:** PRE-REGISTRATION. Committed BEFORE any burn was run on this branch, per the
brief's protocol ("classify blind, then burn, then compare — that order is the whole
design"). No test file is edited by this commit.

---

## 0. Reconciled register — the union across all prior rounds

The brief's premise is that the working register of 7 files is "incomplete, and by a wide
margin". It is. Below is every file ever named as flaky across `d936c691` (#502),
`28968bbf` (13 files), `063fff1e` (#563), #861, #872, #875, the #543 50× burn, and data
points 6–10 in `docs/FOLLOW_UPS.md`.

**Provenance legend:** R1 = #502 `act()` wrap · R2 = `28968bbf` 13-file RTL sweep ·
R3 = #563 `delay:null` + global 5000 · R4 = #861 per-test widening ·
R5 = #872 three-mechanism fix · OBS = observed-only, never remediated.

| # | File | Rounds | Round's change still present? | Named failing test(s) | Recorded shape |
|---|---|---|---|---|---|
| 1 | `manager/__tests__/CompliancePanel.nudge.test.jsx` | R1, R2, R3 | yes (all three) | chip-missing | **CONTROL — 0/200, re-confirmed 0/30** |
| 2 | `manager/__tests__/MeetingMode.test.jsx` | **none** | — | ArrowRight · agenda rail · skip-logs · awards-in-reach | timeout ×5 (isolated burn) |
| 3 | `daily/__tests__/DailyCaptureV2.test.jsx` | R2*, R3*, R5 | yes | stepper "+" · streak ×3 · aggregate-on-save ×2 | element-not-found ×2 (167/181ms); timeout ×4 (2042/5006/5006/5007) |
| 4 | `planner/__tests__/AgentPlannerPanel.test.jsx` | R5 | yes | A5 undo · A5 ONE-undo-entry · A5 cap gate · A2 `e` · A2 `e` SERIES | assertion 31ms; timeout 5027/5046 |
| 5 | `planner/__tests__/AgentPlannerPanel.weeknav.test.jsx` | none | — | navigation is unlimited | timeout ~5000 |
| 6 | `wizard/__tests__/WizardFormV2Characterization.test.jsx` | none | — | G — draft-read failure guard | timeout |
| 7 | `awards/__tests__/AgentAwardsPanel.test.jsx` | R2, R4 | yes | error / Retry states | CI-only, unrecorded |
| 8 | `admin/__tests__/BranchesPanel.test.jsx` | R2 | yes | Retry re-invokes load path | unrecorded |
| 9 | `wizard/__tests__/WizardFormV2RetirementR2.test.jsx` | R2 | yes | (50× burn only) | unrecorded |
| 10 | `wizard/__tests__/WizardFormV2RetirementR1.test.jsx` | none | — | (50× burn only) | unrecorded |
| 11 | `admin/__tests__/AwardsRulesetPanel.test.jsx` | none | — | (50× burn only) | unrecorded |
| 12 | `agent/__tests__/PolicyLedgerPanel.test.jsx` | R2 | yes | — (swept, never observed failing) | — |
| 13 | `agent/__tests__/ProspectInfoPanel.test.jsx` | R2 | yes | — | — |
| 14 | `dashboard/GamePlanV2/__tests__/SuggestedWeekCard.test.jsx` | R2 | yes | — | — |
| 15 | `dashboard/HomeV2/__tests__/HeroCard.test.jsx` | R2 | yes | — | — |
| 16 | `manager/__tests__/CoachingNotesModal.test.jsx` | R2 | yes | — | — |
| 17 | `manager/__tests__/GoalsPanel.test.jsx` | R2 | yes | — | — |
| 18 | `manager/__tests__/JointCallsTab.test.jsx` | R2 | yes | — | — |
| 19 | `manager/__tests__/PolicyReconciliationPanel.test.jsx` | R2 | yes | — | — |
| — | ~~`daily/__tests__/DailyEntryModal.test.jsx`~~ | R2, R3 | **file DELETED** | — | — |

\* R2/R3 touched `DailyEntryModal`, not `DailyCaptureV2`; `DailyCaptureV2` inherits R3's
global `asyncUtilTimeout` only.

### Three reconciliation findings

1. **`DailyEntryModal.test.jsx` no longer exists.** Deleted 2026-07-08 in `214ea26c`
   ("tier-0.6 delete unwired onboarding steps + DailyEntryModal ruling"). It is named by
   both `28968bbf` and the #543 50× burn and is carried in the register as a live member
   in `docs/FOLLOW_UPS.md`. It is not fixable and should be struck.
2. **`aggregate-on-save (Phase 2.2)` is not a separate file.** The tenth data point banks
   it as "a NEW describe block in the family", which is true, but it is a describe block
   *inside* `DailyCaptureV2.test.jsx` (`:594`, `:607`). The register reads as though it
   were a fourth file; it is not. Real file count is **11 named + 8 swept-only**, not 12+.
3. **The real number of *files* is 19, of which only 6 have ever been observed failing.**
   Eleven of the nineteen enter the register solely because `28968bbf` swept them; not one
   has ever been recorded failing. Their presence inflates the register roughly 2×.

---

## 1. PRE-REGISTERED CLASSIFICATION — blind, before any burn

Classified against the brief's definition:

- **PROXY** — awaits a gate, then queries something else. Includes both variants: a
  mock-call gate followed by a bare DOM query, and (the corrected shape banked at
  `FOLLOW_UPS.md` fifth data point) a `findBy`/`waitFor` gate on element **A** followed by
  a bare positive query on element **B**.
- **DIRECT** — the awaited condition *is* the asserted condition.
- **NEITHER** — no positive DOM query depends on the gate (mock-object assertions,
  negative assertions).

| # | Test (`file:line`) | Gate line | Then queries | Class |
|---|---|---|---|---|
| C | `CompliancePanel.nudge.test.jsx:94` — single Nudge → cooldown chip | `:101` `waitFor(expect(sendComplianceNudge).toHaveBeenCalledWith(…))` **mock gate**; `:104` `findByTestId('compliance-cooldown-chip', …, CHIP_WAIT)` | `:105` **bare** `getByText(/Nudged just now/)` — element B | **PROXY** |
| C2 | `CompliancePanel.nudge.test.jsx:108` — chip from existing record | `:113` `waitFor(getAllByTestId('compliance-cooldown-chip'))` | `:114` **bare** `getAllByTestId('compliance-nudge-btn')` — element B | **PROXY** |
| 1 | `MeetingMode.test.jsx:124` — ArrowRight advances | `:127` `waitFor(expect(getByText(/Where the branch stands/)).toBeInTheDocument())` | nothing — gate **is** the assertion | **DIRECT** |
| 2 | `MeetingMode.test.jsx:150` — skip-logs awards scene | `:156` `waitFor(expect(getByText(/That's the room/)))` | nothing | **DIRECT** |
| 3 | `MeetingMode.test.jsx:137` — agenda rail jumps | `:144` `waitFor(getByText(/This week's activity/i))` | `:146` **bare** `getByRole('button',{name:'Branch scorecard'})` — element B | **PROXY** |
| 4 | `MeetingMode.test.jsx:163` — in-reach award card | `:178` `waitFor(getByTestId('awards-within-reach-scene'))` | `:179–181` **bare** `getByText('MDRT')`, `getByText('Alice Agent')`, `getAllByTestId('awards-reach-card')` — children of the awaited container | **PROXY (weak)** |
| 5 | `DailyCaptureV2.test.jsx:189` — stepper "+" | `:191` `await findByTestId('dcv2-save')` | `:193` **bare** `getByRole('button',{name:/FFIs conducted increase/i})` — element B, loaded on a separate async path | **PROXY** |
| 6 | `DailyCaptureV2.test.jsx:713` — streak does NOT re-fire | `:721` `waitFor(expect(onClose).toHaveBeenCalled())` **mock gate** | `:722` **negative** `queryByTestId(…).not.toBeInTheDocument()` | **NEITHER** |
| 7 | `DailyCaptureV2.test.jsx:594` — recomputes weekly draft | `:599`,`:600` mock-call gates | `:602` mock `invocationCallOrder` — no DOM | **NEITHER** |
| 8 | `DailyCaptureV2.test.jsx:607` — isolates aggregation failure | `:614`,`:615` mock-call gates | `:617` **negative** `queryByText(/save failed/i)` | **NEITHER** |
| 9 | `AgentPlannerPanel.test.jsx:536` — `e` on SERIES card | `:544` `waitFor(getByTestId('appt-card-a3'))` | `:545` bare `getByTestId('appt-card-a3')` (**same** element) → `:546` `pressKey('e')` **sync** → `:547` **bare** `getByTestId('series-edit-choice')` — element B | **PROXY** |
| 10 | `AgentPlannerPanel.test.jsx:838` — A5 undo prior date | `:842` `waitFor(getByTestId('appt-card-a1'))` | `:844–848` **five bare** queries on B (`planner-select-toggle`, `bulk-move`, `bulk-move-date`, `bulk-move-apply`) | **PROXY** |
| 11 | `AgentPlannerPanel.weeknav.test.jsx:117` — navigation unlimited | `:124` `waitFor(expect(lastRange().start).toBe(expected))` — **non-DOM value gate** | `:123` (next iteration) bare `getByTestId('planner-week-next')`; `:127` bare `getByTestId('planner-week-label')` | **PROXY** |

### 1a. How many render commits separate gate from query?

Answerable with confidence in three cases, and this is the brief's causal question:

- **#5 (stepper)** — **≥1 commit, structurally guaranteed.** `DailyCaptureV2` loads
  company minimums / weekly floors on an async path *separate* from the Save button, so
  `dcv2-save` can paint a frame before the stepper rows exist. The gate can be true before
  the queried element exists. This is the strongest causal claim in the table.
- **#3 (agenda rail)** — **≥1 commit, plausible.** The scene heading and the agenda rail
  are produced by the same scene render, but the rail is derived from `deriveDeck` over
  loaded users/submissions; the heading is not.
- **#9 (`e` SERIES)** — **0 commits, but a listener-subscription race.** The documented
  mechanism (`AgentPlannerPanel.jsx:1086-1161` keydown dep array) is stale-closure, not a
  missing element. `pressKey` at `:408-410` is still a **synchronous** `fireEvent.keyDown`
  — #872's `await userEvent.keyboard('e')` fix was applied to the sibling, **not** to this
  test. This is a genuine unfixed member.
- **#4 (award card)** — **0 commits expected.** `MDRT` / `Alice Agent` / `awards-reach-card`
  are children of the awaited `awards-within-reach-scene` container and commit in the same
  paint. Classified PROXY structurally but predicted causally inert.
- **#1, #2 (MeetingMode DIRECT)** — **0.** There is nothing between gate and assertion.

---

## 2. PRE-REGISTERED PREDICTIONS — what the hypothesis commits to

Stated before measuring, so the comparison is a test rather than a description.

**If the awaiting-pattern hypothesis is the mechanism:**

| Prediction | Commits the hypothesis to |
|---|---|
| **P1** | PROXY files burn hot; DIRECT/NEITHER files burn cold (≈0/30). |
| **P2** | PROXY failures present as **element-not-found / assertion**, fast (<500ms) — a bare `getBy*` throws synchronously. They must **not** present as 5000ms timeouts. |
| **P3** | DIRECT tests must not fail at all. A DIRECT test failing falsifies the hypothesis for that site outright. |
| **P4** | The control (`CompliancePanel.nudge`) must burn cold **despite** being PROXY — or, if the pattern is sufficient, it should burn hot and the register's 0/200 baseline is wrong. |

### 2a. Three predictions the record ALREADY contradicts

These are not burn results; they are the classification checked against evidence that
already exists in `docs/FOLLOW_UPS.md`, and they are recorded here so the burn is not
credited with discovering them.

1. **P4 fails on the control, and it fails hard.** The control is **PROXY twice over**
   (`:101` mock gate → `:105` bare query on B; `:113` gate → `:114` bare query on B). Both
   shapes were present *during* the 57% failure era and are **still present now** at
   0/200 and 0/30. What fixed it was #563's removal of `delay: null` — a userEvent
   scheduling fix that changed neither gate. **The pattern was never the variable in the
   one case where the answer is known.** By the brief's own standard — *"if your method
   gets the control wrong, the method is wrong and nothing downstream of it counts"* —
   this is the method getting the control wrong.
2. **P3 fails on MeetingMode.** `ArrowRight` (#1) and `skip-logs` (#2) are **DIRECT** — a
   single `waitFor` whose gate *is* its assertion, nothing queried afterwards. Both are
   named, CI-reproduced register members, and both were among the five isolated-burn
   failures in #896. A DIRECT test cannot fail by this mechanism, and these do.
3. **P2 fails across the board.** All five #896 isolation failures were recorded as
   **timeout** shape, including the two PROXY-classified MeetingMode tests. A PROXY defect
   fails *fast* — `getByRole` at `MeetingMode.test.jsx:146` throws synchronously if the
   rail is absent. A 5000ms timeout means execution never reached the bare query; the
   failure sat at a `waitFor`, i.e. at a **DIRECT** gate (`:144` or `:147`).

**Where the hypothesis does hold.** Exactly the two assertion-shape members, and it holds
well: #5 stepper (element-not-found, 167ms and 181ms, two independent CI observations) and
#9 `e` SERIES (assertion, 31ms). Both are fast-failure, both have a demonstrable gate/query
commit gap, and #9's synchronous `pressKey` is a concrete unfixed defect.

---

## 3. Suite-wide pattern count (brief Phase 0, question 4)

Instrument: `scripts/flake/classify-await-shapes.mjs` (read-only, committed with this
document so the count is reproducible rather than asserted).

```
files scanned: 380
gate sites:    1179
  PROXY   390  (across 64 files)
  DIRECT  178
  NEITHER 611
```

A narrower grep for the mock-call-gate variant alone returns **205 sites across 58 files**.

**Reading, stated plainly: the pattern is not sufficient on its own, and it is not close.**
390 PROXY sites across 64 files, against a register of 6 files ever observed failing. If
the shape were sufficient, the failure population would be one to two orders of magnitude
larger than it is.

Two counts that matter more than the totals:

| File | PROXY sites | Measured burn |
|---|---|---|
| `CompliancePanel.nudge.test.jsx` (**control**) | **6** | **0/30** |
| `MeetingMode.test.jsx` (**hottest member**) | **4** | **5/30 (16.7%)** |

The control carries **more** of the pattern than the hottest member and never fails. Any
dose-response reading of the classification is contradicted before the burn starts.

---

## 4. What this pre-registration expects the burn to show

- `MeetingMode` reproduces near its recorded 16.7%; failures remain **timeout**-shaped and
  land on the **DIRECT** tests (`:127`, `:156`) rather than the bare queries.
- The control stays at 0/30.
- `DailyCaptureV2` and `AgentPlannerPanel` — if anything fires, the shape discriminates:
  a fast element-not-found on the stepper or `e` SERIES supports the hypothesis for that
  site; a 5000ms timeout does not.
- Files whose only register membership is `28968bbf`'s sweep burn cold, confirming they
  are register noise rather than members.

**If the rates do not separate by class, the classification predicts nothing** and should
be reported as such — which, on the evidence in §2a, is the outcome this document expects.
