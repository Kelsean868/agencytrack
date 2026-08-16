# Dispatcher scripts, slash commands and `/wayfinder`

Moved out of CLAUDE.md (§ Dispatcher tooling, original lines 700–761; § Where `/wayfinder`
fits, lines 914–926) on the router split.

CLAUDE.md keeps the names and the three binding facts: audit-only dispatches stay inline
(no brief commit PR, no slash command); decision points are the dispatcher's, not the
tooling's; and the verbatim `git log` paste-back (Rule 16) stays a manual operator action.
It also keeps the CC model-tier ladder and the persona-review requirement. This file
carries usage and troubleshooting.

Note: the original § Dispatcher tooling preamble asserted that "the canonical methodology
(Session Protocol, § Post-merge local cleanup, Methodology Rules 1–18) remains
authoritative — these tools embed the rules, they do not replace them." The rule range was
stale (there are 25 rules) and the second clause was content-free; both were dropped at the
split. The authority relationship is unchanged: the rules govern, the tooling embeds them.

### `scripts/dispatcher/new-brief.ps1`

One-command brief docs PR shuffle (Rule 10). Operator invokes after writing the brief to `docs/briefs/` via the dispatcher's paste-block.

Usage:

```powershell
.\scripts\dispatcher\new-brief.ps1 -File "fu-foo-closure-kickoff.md" -Topic "FU-foo closure"
```

The script enforces the Phase 0 gate (must be on main), fetches origin, pulls main, creates a fresh branch derived from the filename slug, commits, and pushes. Branch naming convention: `docs/<slug>-brief`. Commit message convention: `docs(briefs): <Topic> kickoff`.

### `/dispatch <brief-path>` (CC slash command)

Defined in `.claude/commands/dispatch.md`. CC reads the brief at the given path, applies the standing methodology (Phases 0–5, Rules 9 / 12 / 15 / 17), executes, opens PR, surfaces URL for dispatcher review.

Operator usage in CC:

```
/dispatch docs/briefs/fu-foo-closure-kickoff.md
```

Replaces the long-form "PR dispatch — Kickoff brief: ..." prose payload from prior PRs.

### `/post-merge <pr-number>` (CC slash command)

Defined in `.claude/commands/post-merge.md`. CC runs the canonical post-merge sequence: sync main, capture squash SHA, fill `#TBD` / `{TBD}` placeholders, commit + push direct to main, Rule 15 verification.

Operator usage in CC (after confirming squash merge in GitHub UI):

```
/post-merge 217
```

### When NOT to use the tooling

- **Audit-only dispatches** stay inline (no brief commit PR, no slash command). Short, scoped, no-PR-output investigations are not subject to Rule 10.
- **Decision points** — scope judgment, smoke waiver evaluation, hard-stop recovery options — handled by dispatcher in chat. Tooling embeds methodology, not judgment.
- **Verbatim `git log` paste-back** (Rule 16) — operator pastes raw output to dispatcher. Slash commands report verification, but the operator-side paste-back remains manual per banked rule.

### Known behavior: slash commands display as unrecognized but execute correctly

Slash commands defined in `.claude/commands/` (currently `/dispatch` and `/post-merge`) are injected into CC's prompt context and execute correctly when invoked. The operator-facing CLI may display them as "unrecognized" at invocation time — this is a cosmetic dual-surface gap, not an execution failure. CC has received the command body and will begin executing within a few seconds.

If you see "unrecognized" after pasting a slash command: wait briefly. If CC begins executing the brief or post-merge sequence, the command worked. If CC does not respond to the command body within ~30 seconds, treat as a real failure and fall back to the long-form payload from the dispatcher.

Confirmed across 2 cycles: PR #217 (d84a752) /post-merge invocation, PR #219 (0b3f058) /dispatch + /post-merge invocations.

Banked: PR #217 (d84a752).

- Dispatch Orchestrator (sibling folder, not this repo; see `docs/orchestrator/README.md`): local Python tool that runs the dispatch workflow headlessly - Phase 0 gate -> `claude -p` (opusplan) -> full-transcript capture -> hard-stop pause. v1 supports `--resume` (Phase 2+ after lock) and `--build` (Edit/Write); writes confined to feature branches, never main; PR-open pauses for manual merge. Post-merge fill stays manual (v2 planned). Digests in its `logs/` are the rule-banking source; `cost-ledger.json` tracks burn.

- **CC model tier per brief.** Every brief carries a suggested tier — operator overrides at will: **Tier-A** mechanical / test / docs → Haiku or Sonnet; **Tier-B** feature-from-brief (standard build) → Sonnet; **Tier-C** net-new / cross-cutting / ambiguous surface → Opus (via `opusplan` profile).

- **Persona-review section in net-new/complex briefs.** Briefs for new collections, auth surfaces, or cross-cutting changes include a persona-review checklist before the Decisions-locked section. Standard lenses: tenant-isolation/data-integrity · role/permissions · money-correctness · operator-legibility · a11y/contrast · pilot-ops/reversibility · maintainability.

---

## Where `/wayfinder` fits


`/wayfinder` charts multi-session planning work as a map issue with decision-ticket
children. It sits **ahead of** the kickoff brief: the map's destination is a landed
brief, and Rule 10's docs-PR gate then runs unchanged. Two deviations from the
skill's upstream defaults are deliberate:

- **Briefs are persistent.** The upstream skill treats its spec as disposable
  (closed and deleted once the code lands). Rule 10 makes briefs a permanent audit
  trail in `docs/briefs/`. Keep them.
- **`task` tickets never merge or deploy.** Rule 19 is unchanged — a `task` ticket
  whose work is a merge, a `firebase deploy`, or a production data mutation is
  HITL only.
