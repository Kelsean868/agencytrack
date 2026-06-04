# Kickoff ADDENDUM — Track J overnight queue, items 5–10

**Extends:** `docs/briefs/track-j-night-queue-kickoff.md`. ALL six STANDING NIGHT RULES of
that brief govern these items unchanged (sequential · fresh branch off origin/main per item ·
Rule 19 absolute · park-on-stop · NO docs edits, fill text in PR bodies · green-channel
self-checks · end-of-night report). Execute items 0–4 from the base brief first, then
continue directly into 5–10. Over-provisioning is deliberate: any item not reached is simply
reported NOT-STARTED in the end-of-night summary — do not rush items to clear the list.

---

## ITEM 5 — Persistency v2, manager-entry side (port-ledger row 10 completion)

**Branch:** `feat/track-j-persistency-manager-v2` · **Scope lock:**
`src/components/manager/PersistencyTab.jsx`, `src/components/manager/PersistencyEntryForm.jsx`,
`src/components/manager/PersistencyAgentRow.jsx` + new
`scripts/verification/persistency-manager-v2-smoke.mjs`.

- Phase-0 diff-lock vs the mockup AND the shipped agent-side v2
  (`src/components/agent/PersistencyTab.jsx`, #395) — the agent side is the in-repo styling
  reference; this item brings the manager-entry side to parity. TRUE RESTYLE only; park on
  redesign-class deltas.
- Preserve the entry form's behavior, validation, and writes exactly — presentation only.
- **Smoke:** BM login; persistency manager surface; entry form opens and renders; axe both
  themes; 0 console errors.

## ITEM 6 — Weekly WARs v2 restyle (row 21)

**Branch:** `feat/track-j-weekly-wars-v2` · **Scope lock:**
`src/components/manager/ManagerWarTab.jsx`, `src/components/manager/ManagerWarDetail.jsx`,
`src/components/manager/TeamWarsTab.jsx` + new `scripts/verification/weekly-wars-v2-smoke.mjs`.

- Phase-0 diff-lock; presentation only. These are functional Track-I surfaces: the existing
  functional smokes (`manager-war-smoke`, `upline-war-browse-smoke`) MUST be run and stay
  green as part of this item's gate, untouched.
- **Smoke:** BM login; WAR tab + a WAR detail render (real BM WARs exist in the tenant); axe
  both themes; 0 console errors.

## ITEM 7 — Master Sheet v2 restyle (row 19)

**Branch:** `feat/track-j-master-sheet-v2` · **Scope lock:**
`src/components/manager/MasterSheet.jsx` + new `scripts/verification/master-sheet-v2-smoke.mjs`.

- The big one: 23-column sticky table, data-identical restyle. Phase-0 diff-lock is
  ESPECIALLY load-bearing here — dense tables are where redesigns hide. Column set, order,
  derivations, sticky behavior, and horizontal scroll must be byte-for-byte preserved; park
  if the mockup's table differs structurally.
- **Smoke:** BM login; Master Sheet renders; assert header/column count unchanged, sticky
  first column functions, at least one data row present; axe both themes; 0 console errors.

## ITEM 8 — Meeting Mode v2 restyle (row 32)

**Branch:** `feat/track-j-meeting-mode-v2` · **Scope lock:**
`src/components/manager/MeetingMode.jsx` + new `scripts/verification/meeting-mode-v2-smoke.mjs`.

- SPECIAL TOKEN RULE: MeetingMode is an always-dark presentation surface — restyle within
  the `--color-presentation-*` token set (defined in `:root` only). Do NOT introduce
  theme-reactive tokens here and do NOT add presentation tokens to `.dark`. No token
  DEFINITIONS change anywhere (green-channel rule).
- **Smoke:** BM login; enter Meeting Mode; surface renders identically composed under BOTH
  app themes (it is theme-invariant by design — assert that invariance); exit cleanly; axe;
  0 console errors.

## ITEM 9 — Awards primitives dedup + orphan sweep (banked FUs; closes the #440 verification)

**Branch:** `refactor/awards-primitives-dedup` · **Scope lock:**
`src/components/awards/*` + their tests only. No other src.

- Consolidate the duplicated percent-format/medal logic (the #440-era inline copies in
  `AgentAwardsPanel.jsx` / `ManagerAwardsPanel.jsx`) into `ui/awardPrimitives` — single
  source. Characterization-test-first if the touched logic lacks coverage; zero visual or
  behavioral change intended.
- Orphan sweep (`AwardMedalCard` / `AwardMedal` / `awardIconMap` per the 2026-06-03 audit):
  DELETE only on double proof — grep shows zero importers AND full suite green after
  deletion. Otherwise leave them and note in the PR.
- **Smoke:** agent + BM logins; BOTH awards tabs render; every visible award percentage is a
  rounded integer (this live-closes the open PR #440 verification — state the result
  explicitly in the PR body); axe both themes; 0 console errors.

## ITEM 10 — Gold-contrast AUDIT (read-only tail; no branch, no PR)

- Sweep gold/amber accent usages (weekly-champions gold, award medals, badge-new, any
  `amber-*`/gold token consumers) for WCAG AA contrast in BOTH themes — axe on the relevant
  live surfaces plus computed-contrast checks where axe can't reach.
- OUTPUT: a findings table (surface · theme · fg/bg · ratio · pass/fail · suggested token
  fix) inside the end-of-night summary. FIX NOTHING — this feeds a future daytime brief.

---

## End-of-night report (supersedes the base brief's rule 6 wording)

One final summary: every item 0–10 → status (READY-FOR-REVIEW PR + HEAD SHA / PARKED-STOP +
reason / NOT-STARTED), the item-10 findings table if reached, and total wall-time per item.
Then stop. If all 11 close with time remaining: STOP — do not start unqueued work.
