# Award progress % — round the displayed percentage

**Track:** Cleanup / bug-fix (demo-surfaced)
**Type:** Frontend-only, display formatting. No awards-engine / logic / data change.
**Risk:** Low. Touches multiple award-card render sites (the awards rendering is knowingly duplicated — see §2).

---

## 1. Why

The agent Awards tab renders progress percentages as raw floats — e.g. `13.333333333333334%`, `9.538461538461538%` — instead of a clean rounded value. Demo-surfaced; looks unprofessional. The manager side currently shows clean `0%` only because 0 is round; non-zero manager percentages have the same latent bug. Fix: round every displayed award progress % consistently.

---

## 2. The duplication (read first — Rule 17)

`src/components/awards/awardPrimitives.jsx` documents in its own header comment that `AgentAwardsPanel.jsx` carries **inline-duplicated copies** of the award-card primitives (a dedup cleanup FU is still open). So the percent is rendered in more than one place. **Phase 0 MUST enumerate every site that renders an award progress percentage**, including at least:

- `awardPrimitives.jsx` — `AwardCard` (percent + bar), and `AwardDonut` if it renders a % label
- `AgentAwardsPanel.jsx` — the inline-duplicated copies
- `ManagerAwardsPanel.jsx` / `AwardMedalCard.jsx` — manager card percent, `primaryCriterionLine`, the bonus-hero bar label
- any other component rendering `…%` from an award progress value

Fix **all** of them — a one-site fix leaves the duplicates broken.

---

## 3. The fix

- Round every displayed award progress percentage to a **whole number** (`Math.round(pct)`), consistently across all sites. (If a site clearly intends 1 dp — e.g. an existing `24.8%` — keep 1 dp there via `.toFixed(1)`, but **never** display raw float digits anywhere.)
- **Display only.** Do NOT change the underlying progress value, the bar-fill width math, the awards engine, or any threshold/criterion logic.
- Prefer routing all sites through a single small shared formatter (e.g. `formatAwardPct`) if that's a clean, low-risk consolidation; otherwise apply `Math.round` at each render site. Do **not** undertake the larger `awardPrimitives` dedup here — that stays its own FU.

---

## 4. Phases

### Phase 0 — gate + source-verify
- `git fetch origin`, verify origin/main HEAD against CONTEXT.md, branch off origin/main.
- Enumerate ALL award-percent render sites (§2). Confirm the percent values are computed upstream (the awards engine) and only DISPLAYED in these components — the fix is display-only.

### Phase 1 — confirm scope
- Confirm no awards-engine / logic / threshold change; display-format only. If a fix would require touching engine logic, STOP and wait for dispatcher.

### Phase 2 — build
- Apply rounding at every site (or via a shared formatter). Bar fills unchanged.

### Phase 3 — verify
- `npm run lint` (0 errors); `npm run build` (clean).
- Add/extend a unit test asserting the percent **renders rounded** (no raw float) — in the `awardPrimitives` and/or `ManagerAwardsPanel` test. A formatter-only unit test is insufficient because of the duplication; the assertion must cover the actual components/render.

### Phase 4 — smoke (agent + manager awards, both themes)
Default RUN (user-visible). This smoke is what proves the duplication is fully fixed:
- Agent Awards tab + Manager Awards tab render; assert **no displayed percent matches a raw-float pattern** (e.g. `/\d+\.\d{3,}\s*%/`) anywhere on either tab.
- `axe` NO-NEW vs main baseline. Both themes; 0 console errors.
- AUTO-REVERT on smoke fail.

### Phase 4 — docs (placeholders; Rule 16)
- `CONTEXT.md` Recently-shipped row with `#TBD`/`{TBD}` placeholders; refresh top-of-file fields + the Where-we-left-off prose.
- `FOLLOW_UPS.md`: if a "round award %" item exists, mark it resolved; note the `awardPrimitives` dedup FU remains open (untouched).

### Phase 5 — commit / push / PR
- Conventional commit: `fix(awards): round displayed progress percentage`.
- PR body: scope, the enumerated render sites, the smoke checklist (Rule 18 — updated post-run).
- Report feature-branch HEAD SHA (Rule 20). **Do not merge or deploy (Rule 19).**

---

## 5. Acceptance criteria
- [ ] Every award-percent render site shows a rounded value; no raw floats on agent OR manager awards.
- [ ] Bar fills + award/threshold logic unchanged (display-only).
- [ ] Unit test asserts rounded render; lint 0 errors; build clean.
- [ ] Smoke green both themes (no raw-float percent anywhere), axe NO-NEW.
- [ ] Docs updated with placeholders.
