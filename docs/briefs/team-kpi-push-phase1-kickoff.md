# Team KPI Push - Phase 1 kickoff (16 Sep 2026)

Model: Opus 5, high effort, for slices R0-R3. Sonnet 5, medium effort, as subagents for R4 (emails) and R5 (React screen).

## The spec is elsewhere. Read it first, in this order.
1. `C:\Projects\kqm-crm\docs\TEAM_KPI_PUSH_PHASE1.md` - the canonical brief, v2 plus addenda v2.1-v2.4 at the bottom. Every rule in it applies here. This kickoff only slices it and names the gates.
2. Design canvas (build R5 to match it): https://claude.ai/artifact/MNB9PFkvEJZTBTM9osgA84
3. The "Read first" file list inside that brief (kqm-crm sql and edge function, AgencyTrack auth/callSources/aggregator, tatil_automation applyon_bulk, buzz-agents clock scripts, Supabase third-party auth doc).

## Goal in one line
Ten teammates log in to AgencyTrack only, log calls there, press Confirm at day end, and a runner posts each agent's day into that agent's own ApplyOn account overnight, with evidence, never touching anyone else's rows and never holding anyone's password.

## Hard rules (repeated because they outrank everything)
- Never print .env or any secret. Never store an agent's ApplyOn password anywhere, in any form.
- ApplyOn cannot undo. Only outbox rows in status `staged` post. Nothing posts in any test unless the slice says LIVE and Kyron says go in that session.
- Kyron (admin), Tracy-ann (caller) and the existing AgencyTrack dispatch keep working. RLS changes are additive until the smoke walk passes.
- No emoji in any deployed bundle. Push before deploy. "Deployment complete" is not "live".

## Three repos, three gates
- AgencyTrack (`C:\Projects\AgencyTrack`): normal Phases 0-5 from CLAUDE.md - lint, build, PR, preview smoke, both bot reviewers.
- kqm-crm (`C:\Projects\kqm-crm`): branch + PR as its CLAUDE.md says; migrations applied to Supabase project `oujnscwyxwuzmgyszkxd` and named in the PR; edge functions deployed only after push; app deployed with `npx wrangler pages deploy dist --project-name kqm-calls` only after push.
- tatil_automation (`C:\Users\noryk\OneDrive\Documents\tatil_automation`, junction `C:\Projects\tatil_automation`): no PR flow. Gate = `python -m py_compile` on touched files plus the evidence paste-back named in the slice. Never run `applyon_crm.py --live` outside the smoke walk.

## Slices (run in order; each one stops with its paste-back and waits for Kyron)

R0 - Session lifetime probe (tatil_automation). Ships alone. `applyon_bulk\session_probe.py` with `--signin <slug>` and `--check <slug>`, PROFILE_ROOT from `APPLYON_PROFILE_ROOT` (default `%LOCALAPPDATA%\kqm-runner\profiles`, never OneDrive), Task Scheduler job `kqm session probe` every 6 h for slug `kyron`. Paste-back: the first 3 lines of `applyon_bulk\session_probe.log`. Decision after 7 days: sessions survive = continue; die inside 24 h = stop after R2 and report.

R1a - Identity (AgencyTrack functions + kqm-crm sql 40 part 1). Register Firebase project `agencytrack-2a610` as Third-Party Auth in Supabase project kqm; blocking Cloud Function stamps `role: 'authenticated'` on every user plus a one-off Admin SDK script for existing users; `crm.profiles` gains `firebase_uid`, `agent_number`, `credit_to`; helper `crm.current_profile_id()`. Paste-back: from AgencyTrack signed in as Kyron, supabase-js with `accessToken: () => firebaseUser.getIdToken()` returns exactly Kyron's row from `select id, full_name from crm.profiles`, plus the decoded token `role` claim.

R1 - Tenancy (kqm-crm sql 40 part 2). Role `agent`; `crm.applyon_accounts` (no credential columns); `applyon_outbox.agent_id` = coalesce(credit_to, user_id); additive RLS keyed on `crm.current_profile_id()`; RPC `crm.confirm_day(p_date)`; `crm.activity_voids`; `crm.activity_applications(activity_id, product, api, seq)`; `crm.applyon_options` seeded from `applyon_crm.py` OPTIONS (exact portal spelling, e.g. "Annuity - Registered"). Paste-back: the RLS test - Kyron sees all, Tracy-ann unchanged, a throwaway agent profile sees zero of Kyron's rows (query results), then the throwaway is deleted.

R2 - Enqueue the whole ladder (kqm-crm sql 41). `crm.applyon_rows_for_activity()` maps all eight steps + Referrals, one Application Submitted row per `activity_applications` child, seq in ladder order, and never a second Call Made for the same person_id (follow-up rule: reached = Contact Made on the existing lead; not reached = nothing to ApplyOn). The stepper moves the opportunity stage so the existing set_status trigger fires. Paste-back: for one test activity tapped at "Closing interview" on a new name, the outbox rows produced, in seq, then rolled back.

R3 - Runner multi-tenant (tatil_automation applyon_bulk). `open_for(slug)` persistent context, no password; `/login` redirect -> needs_signin + skip; `applyon_crm.py --agents [--live] [--limit N] [--slug X] [--headless]`; per-agent run log `runs\<slug>\<date>.csv`; Task Scheduler `kqm applyon nightly` 23:00 America/Port_of_Spain + at logon +10 min; confirm the agencytrack-dispatch token map scales to ten (move to `crm.agencytrack_call_sources` if hard-coded). Paste-back: a `--agents` dry run (no --live) listing what it WOULD post per agent, and the Task Scheduler entries.

R4 - Notify (kqm-crm, Sonnet 5 medium). Per agent per run one Resend email via the existing edge function: "Posted to ApplyOn: <n> rows" with a plain list; needs_signin: "Sign in needed for ApplyOn". Paste-back: one rendered email body from a dry run.

R5 - /today inside AgencyTrack (Sonnet 5 medium, Opus 5 reviews). Build to the canvas: Quick log with prospect search, Due today strip, "use my contact details" default on, real option chips, eight-step ladder with tap-step-N behaviour and required-field gating, repeatable Applications block with per-app API, Referral toggle, returning-prospect view with greyed done steps, Today with six tiles and Confirm, Locked state, needs_signin banner, morning receipt page, laptop table, Outlook deep link per appointment + "Add today's appointments" .ics on Confirm, per-agent `calendar_prompt`. Nav link for role agent only. Normal AgencyTrack Phases 0-5. Paste-back: the preview URL and the smoke green.

## Smoke walk (LIVE, Kyron present, after R5)
1. R1a paste-back passes. 2. `python session_probe.py --signin kyron`. 3. Kyron logs one real call WITH an appointment in `/today`, confirms. 4. `python applyon_crm.py --agents --live --limit 1 --slug kyron`. 5. Paste back: run log line, outbox row after, ApplyOn activity list, the appointment date/time as ApplyOn History shows it (confirms input format), the matching agencytrack_outbox status. 6. Tracy-ann logs one call in KQM Calls; the new applyon_outbox row must carry Kyron's agent_id. 7. Prove ApplyOn accepts a second Contact Made on the same lead. 8. Fresh test agent opens `/today`: zero of Kyron's prospects, zero outbox rows. 9. Delete the test agent everywhere incl. Firebase.

## Post-merge fill
`applyon_bulk\README.md` (add an agent, runs folder, needs_signin); kqm-crm README (agent role, sql 40/41, activity_voids, activity_applications, applyon_options, third-party auth); AgencyTrack docs/CONTEXT.md + CLAUDE.md (`/today`, role-claim function, kqm dependency); the migrations applied and to which project; the design canvas link. Open https://portal.agencytrack.app/today and paste the visible header.

## Out of scope
WhatsApp/voice intake, Excel import, screenshots in emails, Hyper / e-App, OIPA code, reversal of voids to AgencyTrack, Graph calendar sync, moving the runner to the home PC.

## Known gaps to carry into the report
Appointment date/time input format (smoke step 5). Whether Referrals/New Leads creates a lead. Whether ApplyOn accepts repeated Contact Made (smoke step 7). Deleted-before-Confirm calls already sent to AgencyTrack (logged in activity_voids; reversal is phase 2).
