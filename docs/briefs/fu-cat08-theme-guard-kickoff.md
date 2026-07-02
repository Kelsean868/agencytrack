# FU - cat08 Dossier setTheme Conformance

run_model: claude-sonnet-4-6
size: XS
track: harness hygiene (banked by #771)
rules_change: NONE | data_model_change: NONE | deploy_required: NO

## Intent
shakedown/cat08-screenshot-dossier.mjs carries 8 boolean setTheme calls. Post-#771 the
guard throws on any non-'light'/'dark' arg - the dossier will red on its next run. #771
deliberately left it unfixed so a silent string-swap wouldn't hide the identical latent
ORDERING bug. This FU fixes it properly: string args AND theme-before-nav ordering AND
waitForTheme before any capture/assert - full conformance to the #771 helper contract, not
a cosmetic swap.

## Phase 0
0.1 Cite all 8 call sites + their current ordering relative to goto()/newPage().
0.2 Cite the #771 contract (setTheme throws on non-string; waitForTheme asserts html.dark).
0.3 Confirm what the dossier is used for (screenshot capture) - its dark captures were
    light-DOM captures until now; note which prior dossier outputs are therefore suspect.

## Phase 2
Convert each site: string arg, primed before navigation (fresh context per theme where the
file's structure allows, mirroring runBothThemes), waitForTheme before capture.

## Phase 5
Run the dossier end-to-end: zero guard throws, and spot-verify one dark capture actually
shows the dark surface (html.dark present in the captured DOM state). Attach the run log.

## Standing
HOLD at PR-open. Rule 21 poll + disposition. Rule 22 >=1 gap. Strike 0/2.
