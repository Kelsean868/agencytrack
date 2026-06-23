# Claude Code slash commands

These are the four canonical actor-dispatch commands for the AgencyTrack workflow. Each `.md` file
defines a `/command` that Claude Code loads from `.claude/commands/` — the filename (without `.md`)
is the slash command name. Because they encode the project's procedural gates (Rule 10, Rule 12,
Rule 15, Rule 19, Rule 20, Rule 21), edits must go through a PR and CI review rather than being
applied locally. The `.gitignore` carve-out (`!.claude/commands/`, `!.claude/commands/**`) keeps
this directory tracked even though the rest of `.claude/` is excluded.

| Command | Purpose |
|---|---|
| `/dispatch` | Execute a kickoff brief through Phases 0–5 with standing methodology. |
| `/land-brief` | Land a kickoff brief + optional design annotation via a docs-only PR (Rule 10). |
| `/land-and-dispatch` | Fast path: land a brief directly to main and dispatch it in one step (docs-only). |
| `/post-merge` | Run the canonical post-merge fill sequence after dispatcher confirms a squash-merge. |
