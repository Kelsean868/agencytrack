# Claude Code Prompt — Build the Company Config surface

Paste this (or adapt it) as the task brief for Claude Code, run from the AgencyTrack repo root with this handoff folder available.

---

Build the **tenant-admin Company Config surface** in the AgencyTrack codebase, implementing the design in `design_handoff_company_config/`.

**Start by reading `design_handoff_company_config/README.md` end to end** — it is the spec. Then open `Company Config Prototype.html` in a browser (it runs standalone from the handoff folder) and click through every interaction: drafts → save bar → provenance, reset-to-default, ⌘F find-a-setting with jump-and-flash, the feature-flag enable confirm, the effective-dated Company API floor and its "Correct a past value" modal, the change-history drawer, dark mode, and the <880px list → drill-in layout. The prototype's behavior is the acceptance criteria.

Ground rules:
1. **Recreate, don't copy.** The handoff files are HTML/JSX design references. Implement with the repo's real stack, components, tokens (`.nexus` scoped `var(--*)`), routing and auth (tenant-admin role gate).
2. **Diff-only config storage.** A tenant's config stores only keys that differ from code defaults; absent = code default, fail-closed — extend the existing `featureFlags` read pattern. Reset-to-default DELETES the key. Replicate the awards module's existing override plumbing rather than inventing new plumbing.
3. **Registry-driven UI.** Port `cc-proto-data.jsx`'s settings registry (sections → groups → items with id/type/default/lock/tier/dated) into a typed module. Rendering, ⌘F search, drafts, provenance and audit entries must all derive from it.
4. **Phase 1 scope to wire live:** Targets & Minimums, Activity Standards, Awards & Clubs, Feature Flags. Build ALL 12 sections' UI from the registry, but future-phase sections keep their SOON tag + banner; their lock states (`platform`, `soon · TIER 1/2`) render exactly per the row grammar in the README.
5. **Tier semantics:** Tier 1 keys are read client-side (config doc + fail-closed default). Tier 2 keys (nudge schedules, onSubmissionWrite gamification points, MDRT pace figures, tenure bands as CFs apply them) require Cloud Functions to read config at runtime instead of module constants — mind cold starts and the no-cross-bundle-import rule; this replaces the ESM/CJS dual-copy constants.
6. **Effective dating** (tenure bands, company API floor, award thresholds): store value history with effective dates; past periods resolve against the value in force at the time. Changing a dated value never re-derives history. The **Correct a past value** modal is the only path that rewrites history: requires a reason, writes a CORRECTION audit entry, and triggers re-derivation (pace flags on past WARs, award qualification, Master Sheet summaries).
7. **Audit everything:** every save/flag flip/correction writes to the audit log with who/when/from/to (+reason for corrections).
8. AA contrast both themes, 44px touch targets on mobile, no gradient buttons, no emoji, `prefers-reduced-motion` respected.

Deliverables: the Company Config route + section components, config read/write layer with fail-closed helpers, Tier-2 CF runtime-read refactor (can be a follow-up PR), audit-log writes, and tests for: diff-only semantics (absent key = default), reset deletes the key, fail-closed flag reads, effective-date resolution by period, and correction re-derivation triggers.
