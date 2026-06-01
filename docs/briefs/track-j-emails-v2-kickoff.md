# Track J — Emails v2 (email-template refresh)

**Sized:** S–M
**Branch:** `redesign/emails-v2` — **stacked off `redesign/system-screens-v2`** (last in the sequence, so the `CONTEXT.md` rows don't collide). Note: different file tree (`functions/`) + a deploy lifecycle, so it gets a distinct merge/deploy treatment even though it stacks for branch cleanliness.
**Type:** **Server-rendered email-template restyle** in `functions/email-templates/`. **Email-hex exception applies** (no Nexus tokens). Verified by **static render**, not a preview smoke. **Needs a FUNCTIONS DEPLOY at merge (dispatcher).** **Human-merge + dispatcher-deploy.**

## Why this one is different (read first)

Email clients don't support CSS variables or external stylesheets, so these templates use **inline styles + raw hex by necessity**. The normal "no raw hex / Nexus tokens" rule is **inverted here** — inline hex (brand teal `#01696F`, etc.) is correct and required. hex-grep is not a violation gate on this PR. And because the templates are read by Cloud Functions at send time, the restyle only takes effect after a **functions deploy** — so this is NOT a frontend-auto-deploy PR.

## Outcome

The three email templates (`monday-nudge`, `sunday-nudge`, `password-reset`) adopt the v2 refresh — refined card layout, accent stripe, cleaner table grammar — with every template variable and the matching `.txt` parts preserved, all email-client-safe.

## Decisions baked in (do not re-litigate)

- **VISUAL ONLY (template refresh).** Preserve: **all template variables** (every `{{var}}` intact), the matching **`.txt` parts** (kept in sync), email-safe HTML (table layout + inline styles), and brand teal `#01696F`.
- **Email-hex is correct** — do NOT tokenize, do NOT convert to Nexus vars. Inline styles only.
- **No `functions/index.js` or CF-logic change** — templates + `.txt` only.
- **Visual source** = the Emails mockup in `design_handoff_v2_app/mockups/` (locate in Phase 1).

## Phase 0 — pre-flight

1. `git fetch origin`; confirm base is `redesign/system-screens-v2` (stacked, last in the sequence); `git log --oneline -1` of the base verbatim.
2. Move brief → `docs/briefs/track-j-emails-v2-kickoff.md`; branch `redesign/emails-v2` off `redesign/system-screens-v2`; commit as commit 1.

## Phase 1 — source-verify

1. Read the three `functions/email-templates/*.html` + their `.txt` siblings; inventory every template variable.
2. Locate the Emails mockup; source-verify the refined card/stripe/table grammar.
3. Pin the preserve-list: variables, `.txt` sync, email-safe HTML, brand teal.
4. **If the mockup turns out to add features (new sections needing new template variables / new CF data) → surprise-stop and surface — that needs a CF-logic change, out of scope.**

## Phase 2 — build

- Restyle the three templates (refined card, accent stripe, cleaner table grammar) — email-safe inline styles + hex. Keep every variable; update the `.txt` parts to stay in sync.

## Phase 3 — gates

- **3b scope (terminal):** `functions/email-templates/*.html` + `.txt` + brief + CONTEXT + FOLLOW_UPS. No `functions/index.js`, no CF logic, no `src/`.
- **hex-grep:** N/A as a violation gate — inline email hex is expected and correct.
- **3c lint** (HTML/whatever the repo runs) clean; build clean.
- **3e STATIC-RENDER verification (not a preview smoke):** render each template `.html` standalone (headless or browser) with sample variable values → visual check against the mockup (card, stripe, table grammar) → assert every `{{var}}` still resolves and the `.txt` part matches the HTML's content. Capture the render output.

## Phase 4 — docs + FUs

- CONTEXT.md row; resolve the Emails row in the Track J ledger.

## Phase 5 — PR + STOP for pre-review

Open PR; paste the static-render output + the variable/`.txt`-sync confirmation. STOP. I pre-review that **every template variable is preserved** (a dropped `{{var}}` = a broken email), the `.txt` parts are in sync, and the HTML stayed email-safe (inline only).

## Phase 6 — post-merge — DISPATCHER FUNCTIONS DEPLOY

This is the deploy-gated step. After merge, the dispatcher deploys functions (per Rule 19 + the deploy-hygiene check: deploying worktree at `origin/main` HEAD + `node_modules` installed in `functions/`). The new templates take effect on deploy. Optional post-deploy: trigger a test send to confirm the live render. Rule 15 on the docs push.

## Acceptance criteria

- The three templates adopt the v2 refresh; every variable + the `.txt` parts preserved; email-safe inline HTML; static-render-verified; CONTEXT/ledger updated. Live on the dispatcher's functions deploy.

## Out of scope

`functions/index.js` / CF-logic changes. New template variables (would need CF data). Other Wave screens. `src/`.

## Rule references

Rule 10, 11, 12, 15, 17, 19. Deploy-hygiene check before the functions deploy.
