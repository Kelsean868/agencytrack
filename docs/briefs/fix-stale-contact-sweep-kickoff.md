# PR brief — Brand/contact constant sweep (purge stale placeholder address)

**Sized:** M
**Branch:** `fix/stale-contact-sweep`
**Type:** Content + small refactor across email templates, the agent PDF, and the CF continue-URL. Touches `functions/` (deploy-gated) + `src/` (Vercel auto). Human-merge.

## Outcome
Every customer-facing email and PDF shows the **correct, current** brand/contact info, sourced from a single constant per package so it can't drift again. Trigger: the invite email footer still shows the old placeholder `kelsean+agencytrack@gmail.com` instead of `hello@agencytrack.app`.

Canonical values:
- Brand name: `AgencyTrack`
- Sender (From): `notifications@agencytrack.app`
- Contact / Reply-To: `hello@agencytrack.app`
- App / continue URL: `https://agencytrack.vercel.app` (→ `https://portal.agencytrack.app` once portal is attached — one constant change)

## Why centralize (not just find-replace)
The footer drifted because the address is a literal baked into each template. Putting it in one constant per package — and parameterizing the templates/PDF to read it — means the next change is one edit, not a scavenger hunt, which is exactly the failure mode flagged here. This also closes the banked `INVITE_CONTINUE_URL` FU (the `agencytrack.vercel.app` ActionCodeSettings dupe at `functions/index.js` L398 + L546).

## Decisions locked
1. **Two constant modules** (`functions/` and `src/` are separate packages — can't share one import cleanly): `functions/utils/brand.js` and `src/constants/brand.js`, identical canonical values, each with a "keep in sync with the other" comment. If Phase 1 finds an existing brand/config constant, extend it instead of adding new.
2. **Email footers become variables.** Add `{{contactEmail}}` / `{{appUrl}}` / `{{brandName}}` (whichever each footer uses) to the templates; the render helper injects them from `functions/utils/brand.js` on every send. Email-hex exception still applies — this PR touches text content, not styling, so hex-grep is not a gate (per PR #415).
3. **PDF reads the constant.** `AgentReportDocument.jsx` imports the contact/brand from `src/constants/brand.js`. (react-pdf resolves JS string constants fine — the hex-only rule is about CSS vars, not JS imports.)
4. **CF continue-URL** reads `APP_URL` from `functions/utils/brand.js` at both ActionCodeSettings sites — dedupes L398 + L546, closes the FU.
5. **Grep-clean:** zero `kelsean+agencytrack@gmail.com`, zero stray `@gmail.com` in templates/PDF/CF, zero stale `noreply@agencytrack.app` (the deployed From is `notifications@`).

## Out of scope
- Restyling templates or the PDF (PR #415 already did email visuals).
- The planned manager-tier production-report PDF (separate track) — only **existing** PDF surfaces here.
- Tatil Life pilot-branding text in the emails — those references are correct for the customer; don't touch.
- Self-service/runtime-editable templates.

## Phase 0 — gate
Standard sync + worktree off fresh main; capture `git log origin/main --oneline -1`. Worktree `../agencytrack-worktrees/stale-contact-sweep` on `fix/stale-contact-sweep`. STOP on divergence.

## Phase 1 — source-verify (Rule 17; pair each with a command). HARD STOP, report.
1. Every stale-address occurrence:
   `git grep -nE "kelsean\+agencytrack@gmail\.com|noreply@agencytrack\.app|@gmail\.com" functions/ src/`
2. Email templates + their footers:
   `git ls-files functions/email-templates/` ; read each `.html`/`.txt` footer.
3. Render helper + how it substitutes variables:
   `git grep -n "buildMailDoc\|{{" functions/utils/email.js`
4. ActionCodeSettings sites:
   `git grep -n "agencytrack.vercel.app\|actionCodeSettings\|url:" functions/index.js`
5. PDF footer + brand/contact strings, plus any other react-pdf docs:
   `git grep -n "gmail\|agencytrack\|Contact\|Questions" src/components/profile/AgentReportDocument.jsx` ; `git grep -rln "@react-pdf/renderer" src/`
6. Existing brand/config constant to extend vs new file:
   `git grep -rln "BRAND\|CONTACT_EMAIL\|FROM_EMAIL" src/ functions/`
7. Email static-render verifier (must learn the new variables):
   `git ls-files scripts/verification/` ; read `emails-v2-static-render.mjs`
8. PDF test, if any (to extend):
   `git grep -rln "AgentReportDocument\|generateAgentPDF" src/ __tests__/`

**Report:** full stale-occurrence list; the exact footer strings + where the contact lives in each template and the PDF; whether to extend an existing constant or add the two new ones; and how the static-render verifier maps variables.

## Phase 2 — constants + email
- Add `functions/utils/brand.js` (`BRAND_NAME`, `FROM_EMAIL`, `CONTACT_EMAIL`, `APP_URL`) — or extend an existing one.
- Parameterize the template footers to `{{contactEmail}}` / `{{appUrl}}` / `{{brandName}}`; render helper injects from brand.js on every send. Keep `.html` ↔ `.txt` variable parity.
- Replace both ActionCodeSettings `url:` literals with `APP_URL`.

## Phase 3 — PDF + src constants
- Add `src/constants/brand.js` (same canonical values) — or extend an existing one.
- `AgentReportDocument.jsx`: footer contact/brand imported from it. Hex-only rule unaffected (JS string import, not CSS var).

## Phase 4 — verification + docs
- Extend `emails-v2-static-render.mjs`: assert the new variables substitute, the rendered footer shows `hello@agencytrack.app`, no `kelsean+…@gmail.com`, no `{{` residual, `.html`↔`.txt` parity.
- PDF: extend/add a render assertion that the footer shows `hello@agencytrack.app`.
- Fix the stale `noreply@agencytrack.app` in `docs/runbooks/*email*` (DEFAULT_FROM → `notifications@agencytrack.app`).
- `docs/FOLLOW_UPS.md`: close the `INVITE_CONTINUE_URL` FU; `docs/CONTEXT.md` recently-shipped row — `#{TBD}` placeholders.

## Phase 5 — commit / push / PR
- `fix(brand): centralize contact/brand constants; purge stale placeholder address`.
- Gemini disposition (Rule 21); HEAD-SHA report (Rule 20); stop before merge.
- **Email leg = static-render verification, not preview smoke** (server-rendered; can't smoke via Vercel preview — the script is the gate, per PR #415). PDF leg: a frontend render check is fine. The CF continue-URL is exercised by the existing copy-link smoke post-deploy.

## Phase 6 — post-merge
After human merge: **`firebase deploy --only functions`** (templates + ActionCodeSettings take effect only after a functions deploy) — Vercel auto-deploys the PDF/src side. Then `/post-merge <pr>`. Quick live check: resend an invite, confirm the footer reads `hello@agencytrack.app`.

## Dispatch
1. Save to `docs/briefs/fix-stale-contact-sweep-kickoff.md`.
2. `/land-brief` → squash-merge the docs PR.
3. `/dispatch docs/briefs/fix-stale-contact-sweep-kickoff.md` → CC hard-stops at Phase 1; paste findings back.
