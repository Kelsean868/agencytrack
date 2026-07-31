# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`docs/CONTEXT.md`** — not the repo root; this repo keeps it under `docs/`. Dynamic state: active track, recently shipped, where-we-left-off, current main HEAD. Size caps and fill rules are in CLAUDE.md § Methodology Rule 16.
- **`docs/CONTEXT-history.md`** — entries aged out of `docs/CONTEXT.md` by the Rule 16 size caps. Read when the current file's 5-row window is too narrow for the question.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CLAUDE.md
├── docs/
│   ├── CONTEXT.md            ← under docs/, not the repo root
│   ├── CONTEXT-history.md    ← aged-out entries
│   ├── FOLLOW_UPS.md         ← open follow-ups
│   ├── briefs/               ← committed kickoff briefs (Rule 10)
│   └── adr/                  ← does not exist yet; created lazily
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

The domain vocabulary for this project is also fixed in CLAUDE.md § Domain Rules and § Roles & Permissions — API means Annual Premium Income, FFI means Fact Finding Interview, CI means Closing Interview, and the role ladder is agent → unit_manager → branch_manager → sales_manager → tenant_admin → platform_admin. Use those terms exactly.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

The same applies to the locked decisions in CLAUDE.md and `docs/CONTEXT.md` § Locked decisions. Surface the contradiction; never silently override.
