# Track E (c) — Social / Content KPIs — Kickoff Brief

**Date:** 2026-05-25  
**Track:** E (c) — social/content KPIs  
**Size:** S (new step file + WizardForm extension + extractFields + docs)

---

## Background

Workshop ask (§3.4): "add an optional content section to the Track E daily-log / wizard:
content pieces produced (videos), engagement (likes/comments), inbox enquiries, names-from-social.
Surface a simple content KPI for agents and a roll-up for managers. Do not let it expand into
a social-media management tool."

Operator instruction: "socialPlatform sub-field on social source path + collapsible per-platform
post count for configurable SOCIAL_PLATFORMS [Facebook, Instagram, WhatsApp, LinkedIn]"

---

## Source-verified state (Rule 17)

- Step1–Step9 files are NEVER modified (CLAUDE.md constraint). Creating a NEW file
  `StepSocialMedia.jsx` is additive — no existing step file touched.
- `WizardForm.jsx:SCREENS` is the mapping layer (OK to modify).
- `WizardForm.jsx:INITIAL_DATA` holds all field defaults (OK to add new fields).
- `extractFields.js` is the single source of truth for reading submission fields — must be updated.
- `Step5NewNames.jsx:totalNewNames` computes from referrals + cold canvass + other + events.
  Adding `namesFromSocial` to this sum requires modifying Step5NewNames.jsx (FORBIDDEN).
  Decision: `namesFromSocial` is tracked as a standalone field, NOT fed into `totalNewNames`.
  Rationale: social names are a distinct prospecting channel; surfacing them separately is a feature,
  not a limitation. A future PR (after pilot feedback) can integrate into totalNewNames if needed.
- `src/utils/weeklyActivityFloors.js` does NOT include social fields — no floor tracking for social KPIs.
  Defer social-floor tracking until pilot feedback.

---

## Decisions locked

1. **New file** `src/components/wizard/steps/StepSocialMedia.jsx` — wizard step for social/content.
   Not a "Step1–9" file. Wired into WizardForm.jsx Screen 1 ("Prospecting & Calls") after
   Step1Prospecting and Step2Telephone. Screen 1 now has 3 sub-components.

2. **Fields added to INITIAL_DATA:**
   ```
   socialPostsTotal: 0,        // posts published (all platforms)
   socialEngagementTotal: 0,   // likes + comments received
   socialInboxEnquiries: 0,    // DMs/enquiries that turned into conversations
   namesFromSocial: 0,         // new names obtained via social
   socialPlatformBreakdown: {  // per-platform (optional, collapsible)
     facebook: 0,
     instagram: 0,
     whatsapp: 0,
     linkedin: 0,
   },
   ```

3. **StepSocialMedia UI:** Single "Social & Content" Card with:
   - 4 NumericField rows: Posts Published, Engagement (Likes/Comments), Inbox Enquiries, Names from Social
   - A "Show platform breakdown" collapse toggle with 4 platform rows (Facebook, Instagram, WhatsApp, LinkedIn)
   - Platform breakdown tracks posts-per-platform (single count per platform, user decides what "posts" means on WhatsApp vs Facebook)
   - Toggle uses local state (`useState(false)`) — not persisted in formData
   - ChevronDown/ChevronUp toggle icon from lucide-react

4. **SOCIAL_PLATFORMS constant** exported from `StepSocialMedia.jsx`:
   ```
   ['facebook', 'instagram', 'whatsapp', 'linkedin']
   ```

5. **extractFields.js** additions: read `socialPostsTotal`, `socialEngagementTotal`,
   `socialInboxEnquiries`, `namesFromSocial`, `socialPlatformBreakdown` from the flat schema.
   `socialPlatformBreakdown` defaults to `{}` when absent.

6. **No MasterSheet column** for social fields (screen is already wide). Social KPI display
   deferred to Track F or Track I manager view redesign.

7. **No new Firestore rules** — submissions path already allows agent writes; social fields
   are flat additions to the same doc.

8. **No compositeIndex change** — no new query shape.

9. **Tests:** New `StepSocialMedia.test.jsx` — 6 tests:
   - Renders 4 main numeric fields
   - Toggle shows/hides platform breakdown
   - Platform inputs fire onChange correctly
   - Default data (all zeros) renders without errors
   - Names from Social field present and editable
   - `socialPlatformBreakdown` sub-fields (facebook/instagram/whatsapp/linkedin)

---

## File set

| File | Change |
|---|---|
| `src/components/wizard/steps/StepSocialMedia.jsx` | NEW — social/content wizard step |
| `src/components/wizard/WizardForm.jsx` | Add step to SCREENS + INITIAL_DATA |
| `src/utils/extractFields.js` | Add social field reads |
| `src/components/wizard/steps/__tests__/StepSocialMedia.test.jsx` | NEW — 6 tests |
| `docs/FOLLOW_UPS.md` | Close social KPI FU item |
| `docs/CONTEXT.md` | Phase 4 docs update |

---

## Phase 1 verification commands

```bash
# Confirm Step5NewNames.jsx does NOT include namesFromSocial in totalNewNames
grep -n "namesFromSocial" src/components/wizard/steps/Step5NewNames.jsx
# (should return empty — we are NOT modifying this file)

# Confirm SCREENS structure to understand where to insert
grep -n "SCREENS\|title:" src/components/wizard/WizardForm.jsx | head -20

# Confirm extractFields reads/defaults for existing wizard fields
grep -n "namesFromOther\|namesFromColdCanvass" src/utils/extractFields.js | head -5
```

---

## Smoke gate

Agent login → open weekly wizard → scroll to Screen 1 → verify "Social & Content" card
appears → enter values → toggle platform breakdown → verify counts appear → submit.
Preview smoke using setupBypassSession + agent login.
