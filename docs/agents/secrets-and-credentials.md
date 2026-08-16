# Credential handling — traps, safe existence checks, worktree propagation

Moved out of CLAUDE.md (§ Workflow, original lines 31–40) on the router split. CLAUDE.md
keeps the bare prohibitions (use don't echo; never `cat`/`echo`/`head`/`less`/`type`/`grep`
a file containing token values; never put a token in a URL query param; if a tool mechanism
forces a token into a string param, STOP and surface). This file carries the worked
examples and the near-miss history.

Rule 4 (env-listing `^[A-Z0-9_]+=` filter) and Rule 14 (`.env.example` is canonical
credential documentation) are **not** duplicated here — their canonical text lives in
[`methodology-rules.md`](methodology-rules.md), and their binding sentences stay in
CLAUDE.md's rules index.

## `.env.local` does not propagate to feature worktrees

- **`.env.local` does NOT auto-propagate to feature worktrees.** Verification scripts that depend on `A11Y_*_EMAIL` / `A11Y_*_PASSWORD` (or `VERCEL_BYPASS_TOKEN`) need explicit setup in each worktree before they will run — the file is gitignored, so `git worktree add` does not copy it. Either copy `.env.local` from the main worktree (`cp ../AgencyTrack/.env.local .`) or run verification scripts from the main worktree against the preview URL. Banked from PR #52 retrospective.

## Use, don't echo — full text and the banked near-misses

- **`.env.local` — use, don't echo.** Programmatic reads of `.env.local` (scripts, `process.env.X`, `$env:X` substitution into commands, `firebase deploy` reading credentials) are fine and expected. **Never echo the values to chat output, PR descriptions, commit messages, logs, or screenshots** — reference by env-var name only. The file is gitignored to keep secrets out of the repo; the use-vs-echo distinction extends the same protection to ephemeral surfaces. Banked from C1 close.
  - Shell-substitution safety (banked from PR #111 close near-miss): even when a tool parameter itself is sanitized, bash/PowerShell command substitution (e.g., $(node -e "console.log(process.env.X)") or $env:X) can resolve to a command line containing the token before execution. Avoid any shell construction that would inject sensitive values into the resolved command. For ad-hoc probing of preview URLs, use bare URLs only — the bypass cookie established by setupBypassSession() carries through subsequent navigation.
  - Extended traps (banked from C2 close): never `cat` / `echo` / `head` / `less` / `type` / `grep` files containing token values. Never construct a URL with a token query-param and pass it as a tool param — use cookie injection or purpose-built scripts. **If a tool mechanism forces a token into a string param: STOP and surface, never work around.**
  - Positive guidance for existence checks (banked from PR #102 close): to verify whether a key is present in `.env.local` without surfacing its value, use a boolean-only node check:
    ```
    node -e "require('dotenv').config(); console.log({VERCEL_BYPASS_TOKEN: !!process.env.VERCEL_BYPASS_TOKEN})"
    ```
    Output: `{ VERCEL_BYPASS_TOKEN: true }` if present, `false` otherwise. The grep prohibition has no exceptions — "I'm just checking it exists" is not a workaround.
  - Cookie-after-handshake pattern (banked from M3-smoke incident): sensitive tokens must never appear in URLs that pass through Playwright's standard error paths. The canonical pattern in `scripts/verification/lib/walk-helpers.mjs` is `setupBypassSession()` — a tightly-scoped initial-handshake function that catches and sanitizes all errors before they surface. After session setup, all navigation uses bare URLs. URL-parameter-bypass patterns from consumer code are forbidden — direct calls to `buildBypassUrl` are private to the helper module.
