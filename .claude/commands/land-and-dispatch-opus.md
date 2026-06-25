---
description: Land a brief to main + dispatch it, pinned to Opus 4.8 (judgment-dense builds â€” U1/U2-class)
model: opus
disable-model-invocation: true
---

# /land-and-dispatch-opus â€” fast brief landing + dispatch, PINNED TO OPUS 4.8 (DOCS-ONLY)

Identical to `/land-and-dispatch`, but pins the run to **Opus 4.8** via frontmatter so the
dispatched build runs on Opus regardless of the session's selected model. Use for
judgment-dense / money-adjacent / schema / rules briefs whose header reads
`run_model: claude-opus-4-8`.

> Model-scope note: the `model:` pin is guaranteed for THIS command's execution. Whether it
> carries through the nested `/dispatch` and the full multi-turn build is verified on first use â€”
> check the session model indicator after the build starts. If it reverts, set the session model
> with `/model` before dispatching (or use the `/dispatch-opus` variant if present).

Lands a brief directly to `main` (no PR, no CI wait) and dispatches it, in one command. It is
**DOCS-ONLY**: it stages only the brief and aborts if anything outside `docs/` would be committed.
It is NEVER a path for code â€” code merges keep the full PR -> CI-green -> bot review (Rule 21) ->
human-merge flow.

## Usage
`/land-and-dispatch-opus <brief-filename>`
e.g. `/land-and-dispatch-opus pr-u2-rules-cleanup-kickoff.md`

The brief must already be in the operator's Downloads folder (downloaded from chat).

## Why this is safe to fast-track
A brief is a `.md` in `docs/briefs/` â€” not linted, not in the Vite build, can't break the app. It
is reviewed before it lands (authored in chat, read by the operator). The recon HARD-STOP (for
recon-gated briefs) remains the real review pause and is untouched by this command.

## Procedure (PowerShell â€” no `&&` chaining; separate lines)

1. **Preconditions â€” no uncommitted TRACKED changes.**
   ```powershell
   git checkout main
   git pull origin main

   # Scoped etag-churn tolerance (fail-CLOSED).
   # Firebase CLI rewrites the ETag hash in .firebaserc on every `firebase deploy`.
   # Discard ONLY when: (a) .firebaserc is the SOLE dirty tracked file, AND
   # (b) every +/- line in the diff matches the extension-etag pattern
   # (key = extension-instance name, value = 64-char lowercase hex SHA-256).
   # ANY other dirty tracked file, ANY change to "projects"/"targets", or ANY
   # unrecognised line pattern â†’ ABORT unchanged.
   $tracked = (git status --porcelain --untracked-files=no)
   if ($tracked) {
       $dirtyLines = @($tracked -split "\r?\n" | Where-Object { $_ -match '\S' })
       $onlyFirebaserc = ($dirtyLines.Count -eq 1) -and ($dirtyLines[0] -match '\.firebaserc$')
       if (-not $onlyFirebaserc) {
           Write-Error "ABORT: uncommitted tracked changes (not .firebaserc-only):`n$tracked"
           exit 1
       }
       # Sole dirty file is .firebaserc â€” inspect diff for etag-only churn pattern.
       $diff = (git diff -- .firebaserc)
       $changedLines = @($diff -split "\r?\n" | Where-Object {
           $_ -match '^[+-]' -and $_ -notmatch '^\+\+\+' -and $_ -notmatch '^---'
       })
       $nonEtagLines = @($changedLines | Where-Object {
           $_ -notmatch '^[+-]\s+"[A-Za-z0-9_-]+":\s+"[0-9a-f]{64}"$'
       })
       if ($nonEtagLines.Count -gt 0) {
           Write-Error "ABORT: .firebaserc has changes outside the etag block â€” resolve manually:"
           $nonEtagLines | ForEach-Object { Write-Error "  $_" }
           exit 1
       }
       git checkout -- .firebaserc
       if ($LASTEXITCODE -ne 0) {
           Write-Error "ABORT: git checkout -- .firebaserc failed (exit $LASTEXITCODE)"
           exit 1
       }
       Write-Host "discarded .firebaserc extension-etag churn (etag hash rotation only)"
   }
   ```
   On a clean tree the block is a no-op. On etag-only churn it discards and proceeds.
   Any other dirty tracked file, or any `.firebaserc` change outside the etag block, exits 1.
   Untracked files are fine and are ignored â€” step 3 stages only the brief, so stale
   working-tree artifacts never enter the commit.

2. **Move the brief from Downloads -> docs/briefs/.**
   ```powershell
   Move-Item "$HOME\Downloads\<brief-filename>" "docs\briefs\"
   ```
   Quote the source name exactly (it may contain spaces). If the file is not in Downloads ->
   **ABORT** and report.

3. **Stage ONLY the brief, then GUARD.**
   ```powershell
   git add "docs/briefs/<brief-filename>"
   git diff --cached --name-only
   ```
   The staged output MUST be EXACTLY `docs/briefs/<brief-filename>` and nothing else. If it is
   empty (the Move failed -> brief not where expected) OR any path is outside `docs/`:
   ```powershell
   git reset
   ```
   -> **ABORT.** Report the reason. Do NOT commit. (Never use `git add -A` here â€” it would sweep
   in untracked working-tree artifacts.)

4. **Commit + push directly to main.**
   ```powershell
   git commit -m "docs: land <brief-filename>"
   git push origin main
   ```

5. **Rule 15 verification.**
   ```powershell
   git fetch origin
   git rev-parse HEAD
   git log origin/main --oneline -1
   ```
   Local HEAD SHA MUST match `origin/main`. On mismatch -> **HARD-STOP** and report. On match ->
   report `pushed and verified â€” SHA <sha>`.

6. **Dispatch.** Run the existing dispatch on the now-landed brief:
   ```
   /dispatch-opus docs/briefs/<brief-filename>
   ```
   CC then proceeds per the brief â€” a recon HARD-STOP (paste the recon back to the dispatcher) or
   the build, exactly as the brief specifies.

## Abort conditions (any one -> stop; do not push)
- Uncommitted tracked changes (step 1).
- Brief not found in Downloads (step 2).
- Staged set is not exactly the one brief under `docs/` (step 3).
- SHA mismatch after push (step 5).

## NOT for code
Component / service / rules / CF / test / config changes ALWAYS go through the normal
PR -> CI-green -> Gemini -> human-merge flow and the operator's deploy. Never route a build, fix,
or any non-`docs/` change through this command.

## Final report
End with: the landed brief, its commit SHA on `origin/main`, the Rule-15 line, the dispatch
outcome (recon hard-stop reached, or build started), and the model the build is running on.

