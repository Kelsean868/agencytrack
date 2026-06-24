# Tweak Brief — Money Needs allocator: commission-first input + rate-as-% + slider label

**Authored:** 2026-06-24 · dispatcher
**Continues:** PR #739, branch `feat/money-needs-merged-allocator` (UNMERGED, flag-OFF). No new branch, no new PR — commits onto #739.
**run_model:** `claude-sonnet-4-6` (presentation + binding + persistence-shape on a flag-off unmerged branch; no rules/auth; "money" is a flag-off planning projection).
**Mode:** Build, push to #739, then HOLD. **Human-merge (Rule 19).** No merge, no deploy.

---

## Why

Live flag-on review of the merged allocator surfaced three input-model fixes. All are presentation/binding plus one persistence-shape change; the surface is flag-OFF and unmerged with no real data, so the shape change is free (no migration).

## The three changes

### 1 · Commission rates display as percent
- Both the **line rate field** and the **per-product rate field**: display the value ×100 with a `%` affix (show `35`, not `0.35`), parse input ÷100 back to a decimal.
- **Storage stays the decimal fraction** (`0.35`) — conversion happens only at the input boundary (the data-layer-is-the-single-0–100-boundary rule). No math changes downstream; everything that consumes `rate` keeps getting the decimal.

### 2 · Slider labels its API figure
- The per-line slider controls **API** (unchanged behavior). Add a live readout label on/near the slider — e.g. **"Annual API · TTD {derivedApi}"** — updating as it drags, so it's no longer vague that the slider moves the API figure.

### 3 · Commission-first input model (the real change)
Flip the primary input from API to commission. Per line:
- **Number field = commission** (the income the agent wants from this line) — the canonical value the agent types.
- **Slider = API** (labeled per #2). Dragging it sets API; commission updates live (`commission = api × rate`).
- **Two-way bound through the rate:** type commission → `api = commission ÷ rate` (slider moves); drag slider / API changes → `commission = api × rate`.
- **Rate-change behavior:** changing a rate **keeps commission fixed** and **re-derives API** (intent: the agent still wants that income; a better rate just needs less API). This is why commission is canonical.
- **Per product (drill):** the agent enters **commission per product** (+ the product's rate %); **product API derives** (`commission ÷ rate`). No API-per-policy entry required. Line commission = Σ product commissions; line API = Σ product APIs; line effective rate = lineCommission ÷ lineAPI (the existing weighted-average, now from commission-canonical products, shown read-only when drilled).

## Persistence shape change (free — unmerged, no data)

`moneyNeeds/{year}.allocation.lines[k]` becomes **commission-canonical**:
```
life:    { commission, rate, products: [{ name, commission, rate }] }
ah:      { commission, rate }
general: { commission, rate, products: [{ name, commission, rate }] }
```
(Was `{ api, rate, products: [{ name, api, rate }] }`.) **API is derived everywhere** from `commission ÷ rate` — there is no stored `api`. Update every consumer to derive: the slider position/ceiling, the apps estimate (`derivedApi ÷ avgPolicy`), the award strip's Life API, the Send→Playground payload, and the allocated-vs-required meter (which is already commission-based: Σ line commissions ÷ required — keep it).

## Phase 0 — source-verify (on the #739 branch)

1. Confirm the current `allocation` shape and the math helper(s) that derive commission/apps from api (the lib CC created in #739). Identify every read of `line.api` / `product.api` that must flip to a derived `commission ÷ rate`.
2. Confirm where API feeds: Send payload, apps estimate, `AwardProjectionStrip` Life API, slider value/ceiling, the %-meter. All switch to derived API.
3. Confirm the rate fields (line + product) and the slider component to relabel.

## Phase 1 — build

Apply 1, 2, 3 above. Keep it token-only (no new hex; `bg-surface-muted` trailing-d), ≥44px, light+dark, Lucide, TTD, no gradient buttons. Slider ceiling stays API-anchored (`required ÷ rate × 1.5`); commission field clamps `[0, required]`.

## Phase 2 — tests

Update/extend: rate field display=×100 / parse=÷100 round-trip (stores decimal); commission-canonical persistence round-trip; **type commission → API derives** (and slider lands); **drag slider/API → commission derives**; **rate change keeps commission, re-derives API**; per-product commission input → product API derived; weighted-average effective rate from commission-canonical products; apps = derivedApi ÷ avgPolicy; Send payload carries derived API. Keep the full suite green.

## Phase 3 — smoke

Flag-ON local smoke (the established harness): the relabeled slider shows its live API value, the number field accepts a commission and the slider tracks it, the rate field shows `%`. Both themes. Name any data-dependent gap (Rule 22).

## Phase 4 / 5 / 6

- **Phase 4:** CONTEXT note (no new FUs unless something surfaces).
- **Phase 5:** commit `feat(money-needs): commission-first allocator input + rate-as-% + slider API label` onto `feat/money-needs-merged-allocator`; push (updates #739). Name the new feature HEAD (Rule 20).
- **Phase 6:** Gemini poll + disposition (Rule 21); hex-grep; ≥1 named gap; **HOLD for human merge**.

---

## Report back

New #739 HEAD; Phase-0 list of every api→derived consumer switched; per-change done; test + flag-on smoke results; ≥1 named gap; confirmation flag stays OFF and it's **HELD for human merge**.
