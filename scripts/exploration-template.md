# AgencyTrack Exploration Template
# Derived from exploration_post_b1_recovery_production.md
# Use: agent flow coverage testing post-PR-merge / pre-demo / weekly baseline
# Refine as new flows ship — flag scope-specific items for review.

**Target:** <preview-or-production-url>
**Date:** <yyyy-mm-dd>
**Test agent:** kelsean@gmail.com (UID: J0j4uBqzTPcfm1IlGCPyDzo27RP2)
**Branch under test:** <branch> @ `<sha>`

## Headline

<one-line outcome — what this run was meant to verify>

## Summary

- Actions completed: __ / 28
- Recharts warnings captured: __
- Other console errors captured: __
- Console warnings captured: __
- Network failures: __ (note any harmless filtered patterns)
- Uncaught rejections: __
- Visual issues: __

## Action checklist

- [ ] 1. Navigate to target URL (login screen renders)
- [ ] 2. Login (auth chain returns 200)
- [ ] 3. Wait for dashboard (KPI cards + sparklines rendered)
- [ ] 4. Screenshot dashboard (light mode)
- [ ] 5. Career tab (Goals overview + hierarchy + MDRT + badges render)
- [ ] 6. Awards → Monthly (cards + Activity Ratio Trends render)
- [ ] 7. Awards → Quarterly (quarterly awards render)
- [ ] 8. Awards → Annual (all 7 annual awards render)
- [ ] 9. Awards → Club (Bronze L3/L2/L1, Silver, Gold render)
- [ ] 10. Awards → back to Monthly
- [ ] 11. Click Download Performance Report (modal with 4w/8w/12w/Year)
- [ ] 12. Pick Last 4 Weeks → Generate (modal closes, download triggered)
- [ ] 13. Wait for PDF (no console error)
- [ ] 14. Leaderboard (champions + agent ranking render)
- [ ] 15a. History tab (weekly cards render)
- [ ] 15b. Open a SubmissionViewer entry (full submission rendered)
- [ ] 15c. Close SubmissionViewer (returns to History list)
- [ ] 16. Profile tab (edit form + Account Info render)
- [ ] 17. Open notifications bell (panel renders)
- [ ] 18. Mark all read (skip allowed if no unread)
- [ ] 19. Close notification panel
- [ ] 20. Toggle dark mode (recolors immediately)
- [ ] 21. Screenshot dark mode
- [ ] 22. Toggle back to light mode
- [ ] 23. Open wizard (Select Week picker renders)
- [ ] 24. Pick a previously-submitted week (selection accepted)
- [ ] 25. [B1-SPECIFIC?] Click Start Report on submitted week → WIZARD-1 interstitial renders with heading, DD-MM-YYYY submitted-on date, View Submission + Pick Different Week buttons
- [ ] 25.a. [B1-SPECIFIC?] View Submission → close → return to date picker (NOT dashboard)
- [ ] 25.b. [B1-SPECIFIC?] Re-pick + Start Report → Pick Different Week → return to date picker
- [ ] 26. Close wizard (returns to dashboard, no test data persisted)
- [ ] 27. Sign out
- [ ] 28. Verify login redirect

## Console errors (after filtering known noise)

<list runtime errors observed; filter and note known-harmless patterns separately>

Known-harmless patterns to filter:
- `[AgencyTrack] Auth claims: …` — intentional AuthContext logging
- `[AgencyTrack] UID: …` — intentional AuthContext logging
- 1–2× `net::ERR_ABORTED` on initial Firestore Listen channel POST when AuthContext mounts under StrictMode, immediately followed by a successful retry on the next reqid. Filter regex: `firestore\.googleapis\.com/.*Listen/channel` (broader than the older `Listen.*\?gsessionid=` — actual abort URLs interleave other params before `gsessionid`).

DevTools issues panel (NOT runtime errors, accessibility-only):
- Form field id/name missing (count: __)
- Label-association missing (count: __)

## Network failures

- __ / __ XHR/fetch requests returned 200
- List any 4xx / 5xx / permission-denied / non-StrictMode aborts here

## Visual issues found

<list any layout shift, zero-height frames, dark-mode regressions, etc. — `None observed` if clean>

## Screenshots saved

- `<path-to-dashboard-light.png>`
- `<path-to-dashboard-dark.png>`
- `<path-to-feature-specific-screenshot.png>` (if applicable)

## Recommendation

<PASS/FAIL judgement and any follow-up notes>
