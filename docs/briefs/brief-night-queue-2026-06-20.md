# Night-Queue Brief — 2026-06-20 (autonomous run, ≤10h window)

**Model:** multi-item autonomous queue, per-PR rules apply to every item. Green-channel auto-merge is opt-in and limited to the items flagged **GREEN** below; CC never self-promotes. All other items build to **PR-open + HOLD** for dispatcher/human review.

## Run parameters & standing rails (apply to EVERY item)
1. **No deploys.** Every `firebase deploy` (rules/functions/hosting) is HELD for human. The live environment must be unchanged at run end (the 2026-06-21 Sunday check depends on this).
2. **HOLD-always classes (Rule 19), regardless of green opt-in:** firestore.rules changes, Cloud Functions code, money-path, auth, roles, and any agent-facing surface → PR-open + HOLD, never auto-merge, never deploy.
3. **Green-channel ELIGIBLE this run (explicit opt-in):** docs-only PRs and test-only emulator PRs that cover a rule confirmed *correct* by the audit. Full battery required: hex-grep empty, scope == target files only, lint/test/build green + CC's local emulator run green, both-themes smoke green, axe NO-NEW serious/critical, no feature/nav/token/role/route change → then prod-smoke (exploration walk, 0 console errors) with **AUTO-REVERT on fail**.
4. **Wizard surface reserved:** NO edits to `src/components/wizard/WizardForm.jsx`, `WizardForm.helpers.js`, `src/.../AgentDashboard.jsx`, `WeekConfirmView*`, or any `v2steps/` wizard step. That is the held Phase-1 territory. Any task needing them → STOP + report.
5. **Per-PR rigor every item:** Rule 15 (SHA-match after push), Rule 20 (re-report HEAD on any push), Rule 21 (Gemini poll + disposition every comment before PR-ready), Rule 22 (≥1 known gap), Rule 23 (falsification before banking a decision). Briefs/docs commit via small docs PR per the normal shuffle.
6. **Stop condition:** queue complete OR window elapses. End with the **morning digest** (template at bottom). Do not pad work to fill the window.

---

## Item 1 — Firestore read-exposure audit  (READ-ONLY → docs, GREEN)
**Why:** #701 was a latent rules-deny on a non-existent doc, invisible to mocked tests. Find the rest of that class before it surfaces in a demo.

- **Audit:** grep `firestore.rules` for every `allow get` / `allow read` arm that dereferences `resource.data` (the deref that denies on a non-existent doc). For each, cross-reference `src/` client reads on that collection — especially read-before-write paths (`getDoc` then `setDoc`/`updateDoc` with no try/catch), the exact #701 shape.
- **Rank** each exposure: collection · rule path:line · client path:line · class (null-resource-deref / missing null-arm / read-before-write-no-catch) · severity (HIGH if load-bearing hot path: dashboard load, aggregation, submit, leaderboard) · recommended action (add tests only vs rule-fix-needed).
- **Output:** commit `docs/audits/firestore-read-exposure-audit.md` (ranked table + per-row evidence). Docs PR → **GREEN** (no behavior change).
- **No fixes in this item.** Item 2 consumes the ranked list.

## Item 2 — Emulator deny-matrix tests for audited exposures  (test-only GREEN / rule-fix HOLD)
For each Item-1 exposure ranked HIGH/MEDIUM, one PR per collection/rule (keep reviewable):

- **Rule confirmed CORRECT but untested** → add an emulator deny-matrix test (owner-allow · non-owner-deny · unsigned-deny · cross-tenant-deny · null-resource case) following `tests/rules/submissions.rules.test.mjs`. Run locally via `firebase emulators:exec` (Java 21 present). **Test-only → GREEN** (full battery + auto-revert).
- **Rule is a LIVE BUG** (legitimate read denied, like #701) → author the rule fix + emulator tests, open PR, **HOLD for human merge, NO deploy**, and flag **HIGH** in the digest with the blast-radius (which client path breaks). Mirror the #701 fix shape (null-resource owner arm + tenant gate) only where the same pattern applies; do not invent stricter variants.

## Item 3 — firebase-functions v4→v5 upgrade brief  (recon → docs, GREEN)
**Why:** Node 20 EOL Oct-30 (hard) + live deploy warnings; prep now, build in Sept.

- **Recon:** grep `functions/` for the v4 SDK surface that changes in v5 (e.g. `functions.https.onCall`, `functions.firestore.document().on*`, `functions.pubsub.schedule`, `functions.config()`, region/runtime config). Cite each usage path:line.
- **Source the v5 breaking changes from `github.com/firebase/firebase-functions` CHANGELOG** (allowed domain) + the installed package changelog. Do NOT rely on `firebase.google.com` (not in the network allowlist) — if a fact can't be sourced from an allowed domain, mark it `UNVERIFIED` rather than asserting.
- **Output:** `docs/briefs/brief-firebase-functions-v5-upgrade.md` — per-usage migration map (v4 → v5), Node runtime bump, SDK version target, risks, phased plan, test/deploy strategy. Source-verified (Rule 17). Docs PR → **GREEN**.

## Item 4 — Build the `/autonomous-run` slash command  (docs/tooling → HOLD)
- Read the existing `docs/briefs/brief-autonomous-run-command.md` (if absent, report + skip this item).
- Produce `.claude/commands/autonomous-run.md` encoding the orchestration rules: multi-item queue, green-channel as an explicit per-run opt-in declaration (never CC-self-promoted), the HOLD-always classes, the no-deploy rail, per-PR rigor, and the morning-digest requirement.
- **HOLD for human merge** — this governs all future autonomous runs, so it gets human eyes despite being docs. Do not auto-merge.

---

## Morning digest (required at run end)
Per item: outcome + commit/PR SHAs + merge state (green-auto-merged / held / skipped). Specifically:
- Item 1: link to the audit doc + the ranked exposure count by severity.
- Item 2: which test PRs opened/auto-merged; **any LIVE rules bug flagged HIGH with blast-radius** (held, not deployed).
- Item 3: functions-upgrade brief landed (PR).
- Item 4: `/autonomous-run` command PR (held).
- Rule 22: known gaps across the run. Confirm: no deploys executed, no wizard-surface files touched, green-channel used only on qualifying items.
