# Dispatch Orchestrator

A local Python tool that automates the mechanical parts of the AgencyTrack
dispatch workflow (brief -> Claude Code -> verify -> repeat), so the dispatcher
stops hand-copying between web Claude and Claude Code.

It lives in a sibling folder, NOT in this repo (e.g.
`C:/Projects/AgencyTrack-Orchestrator`). This file is the in-repo pointer so the
tool stays in the project's audit trail. The orchestrator's own code, config,
and README live in that sibling folder.

## What it is

- `orchestrate.py` - entry point. Runs the Phase 0 gate, dispatches a prompt to
  Claude Code headless (`claude -p`, model `opusplan`), captures the full event
  stream, and pauses on hard-stops / PR-open.
- `cc_driver.py` - headless dispatch + full transcript capture (`stream-json`).
- `config.yaml` - `repo_path`, model, gate settings, tool allowlists,
  hard-stop phrases.
- `logs/` - per-dispatch `.jsonl` (full record) + `.md` digest (paste to web
  Claude for rule-banking) + `cost-ledger.json` (cumulative token/cost burn) +
  `strikes.json`.

## Status

- v0 (validated 2026-05-23): Phase 0 gate, opusplan dispatch, full capture,
  hard-stop pause (matches "STOP and wait for dispatcher" / "wait for my lock"),
  per-dispatch usage + cost ledger. Read-only / audit dispatches.
- v1 (built 2026-05-23): `--resume <session_id>` continues a session into
  Phase 2+ after a lock; `--build` widens the tool set to Edit/Write; PR-open
  detection pauses for manual merge. Writes confined to feature branches; a
  build dispatch ending on main warns. `--resume` auto-skips Phase 0.
- v2 (planned): Phase 6 post-merge fill + Rule 15 verification (push to
  main) - deferred, heavily gated, manual until then.

## Usage (PowerShell, from the orchestrator folder)

    # Audit / source-verify (read-only), reads a prompt from a file:
    python orchestrate.py --name <label> --prompt-file <file>.txt

    # Dry run - prints the exact command, executes nothing:
    python orchestrate.py --name <label> --prompt-file <file>.txt --dry-run

    # Resume Phase 2+ after a lock (build tools, skips Phase 0):
    python orchestrate.py --name <label>-p2 --build --resume <SESSION_ID> --prompt-file lock.txt

## Boundaries (by design)

- Never edits `CLAUDE.md` or source files itself - it only runs Claude Code and
  reads git state.
- Never pushes to main (v1). Never merges PRs.
- Human keeps: the Phase 1 lock decision, the PR merge click, the post-merge
  push.

## Key learning banked from build

A fresh headless session pays a one-time cache-write cost (the dominant cost
of a first dispatch). `--resume` reuses that cache at ~0.1x read rate, so
multi-phase arcs should resume one session rather than fire independent
dispatches. The `cost-ledger.json` makes this burn visible per run.

Note: when creating files via dispatches on Windows, prefer plain ASCII. Em
dashes, arrows, and similar glyphs are valid UTF-8 but display as mojibake in
Windows PowerShell 5.x (Get-Content), which causes false alarms.
