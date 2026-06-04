# Track J — redesign schema-gap matrix

**Authored:** 2026-06-04 (Track J overnight queue, item 22). **Companion to** [`track-j-redesign-scoping-notes.md`](track-j-redesign-scoping-notes.md).
**Purpose:** dispatcher brief-writing input for the redesign program. For each of the 8 REDESIGN screens, every mockup data element is classified:

- **EXISTS** — already stored (`collection.field`).
- **DERIVABLE** — computable read-only from existing data (names the source).
- **NET-NEW** — requires new schema (sketch given). NET-NEW elements drive the brief-completeness checklist (rules + write + read + indexes + smoke per the new-collection rule).

Sources: the scoping-notes doc, `src/services/*`, `firestore.rules`, `src/utils/extractFields.js` (all read-only). Field names verified against services where cited; treat sketches as starting points, not locked schema.

---

## Item 1 · Settings v2 (row 17)
| Mockup element | Class | Source / sketch |
|---|---|---|
| Appearance (theme) | EXISTS | `localStorage.agencytrack-dark` (client) |
| View defaults (period, KPI detail, presets) | NET-NEW | per-user prefs doc `users/{uid}.preferences{}` or `prefs/{uid}` |
| Meeting Mode prefs | NET-NEW | same prefs store |
| Notification prefs | NET-NEW | same prefs store |
| Team Defaults (recommend/lock per setting) | NET-NEW | `teamDefaults/{level}_{key}` → `{ value, mode: recommend\|lock, setByRole, setByUid, scopeId }` |
| Hierarchy resolution + provenance | DERIVABLE | resolver walking Company→SM→Branch→Unit→Agent over the teamDefaults docs + `companyMinimums` |
| Company floors referenced (API floor, activity floors, persistency, award criteria) | EXISTS | `config/companyMinimums`, awards ruleset, tenure/activity floors |

**Heaviest schema lift of the 8.** Two new stores (per-user prefs + per-level team-defaults) + a resolver. Model on the existing Goals cascade.

## Item 2 · Compliance v2 (row 20)
| Mockup element | Class | Source / sketch |
|---|---|---|
| Filed % · submitted / pending / missing | EXISTS | `submissions.status` + `users` (current panel already computes) |
| On-time vs late | DERIVABLE | `submissions.submittedAt` vs Sunday deadline (`validators`/`dateHelpers`) |
| On-time streak | DERIVABLE | aggregate `submissions.submittedAt` across weeks per agent (new read-only compute) |
| Nudge / Nudge all | NET-NEW | write a `notifications/{id}` doc (and/or CF email send); new action, not a field |
| Coaching drawer (Weekly tab) | EXISTS (reuse) | shared coaching drawer component |
| CBTT section (present today) | EXISTS | `users.contractStartDate` via `cbttCompliance` — mockup omits it (confirm keep/move) |

## Item 3 · Monthly Recruiting v2 (row 22)
| Mockup element | Class | Source / sketch |
|---|---|---|
| Monthly aggregate (candidatesAssessed, agentsContracted) | EXISTS | `managerMonthlyRollupService` rollup doc |
| 8-stage candidate pipeline | NET-NEW | `candidates/{id}` → `{ name, stage, referrerUid, ownerUid, stageHistory[], createdAt }` |
| Kanban board (per-stage columns) | DERIVABLE | group `candidates` by `stage` |
| Candidate drawer (timeline, referrer/owner, advance) | NET-NEW (read) / writes on `candidates` | `stageHistory[]` + `advance-stage` write |
| Configurable target (monthly/quarterly) | NET-NEW | `config/recruitingTarget` `{ value, period }` |
| "Licensed & active" → WAR Recruiting KPI | DERIVABLE | count `candidates` at terminal stage → feed managerWar |

**Largest data-model delta.** New per-candidate collection replaces/feeds the aggregate. PII (candidate contacts) → privacy + retention question.

## Item 4 · Campaigns v2 (row 23)
| Mockup element | Class | Source / sketch |
|---|---|---|
| Campaign core (type, scope, prize) | EXISTS | `campaigns/{id}` (`type`, `scope`, `prize` confirmed in `campaignService`) |
| Qualify-target ladders (tiers) | NET-NEW | `campaigns/{id}.tiers[{ threshold, prize }]` |
| 1st/2nd/3rd placement races | NET-NEW | `campaigns/{id}.structure: 'placement'` + ranked standings |
| Persistency gate (≥90/85/80/<80 bands) | NET-NEW | `campaigns/{id}.persistencyGate{}` + join to persistency at confirm |
| Live standings | DERIVABLE | join campaign scope → production (submissions/settlements) |
| Confirm-winners | NET-NEW | `campaigns/{id}.winners[]` write flow |

## Item 5 · Persistency v2 manager (row 10)
| Mockup element | Class | Source / sketch |
|---|---|---|
| Reality bar (month/scope/branch persistency/trend) | DERIVABLE | aggregate `persistency/{agentId_YYYY_MM}` |
| Below-80%-floor band, 90/80 banding | DERIVABLE | `persistency.persistency` vs gate/floor constants |
| Source badge (manager-locked vs self-entry) | NET-NEW (small) | no `source` field today — only `enteredBy`. Add `source: 'manager'\|'self'` (or derive from `enteredBy` presence) |
| Manager entry (6 figures → derived %) | EXISTS | `persistencyService` write path |
| What-if playground (levers → projected %) | DERIVABLE (ephemeral) | client compute, no persistence |

**Lightest manager redesign.** Mostly derivable; one small field add + the what-if compute.

## Item 6 · Weekly WARs v2 (row 21)
| Mockup element | Class | Source / sketch |
|---|---|---|
| Managerial KPIs (1-on-1, joint work, recruiting, training, etc.) | EXISTS | `managerWarService` doc (`oneOnOne`, `training`, … confirmed) |
| Team matrix (filed/draft/not-filed) | EXISTS | WAR `status` field |
| 8-week consistency | DERIVABLE | aggregate WAR `status` across weeks |
| Review drawer: approve / request changes | NET-NEW (values) | new `status` values + reviewer write on existing WAR doc |
| Filing streaks | DERIVABLE | WAR submit history |
| Configurable KPI targets | NET-NEW | `config/managerKpiTargets` (none mandatory yet) |

## Item 7 · Master Sheet v2 (row 19) — lightest
| Mockup element | Class | Source / sketch |
|---|---|---|
| 23 columns + derivations | EXISTS | unchanged from shipped `MasterSheet.jsx` |
| Reality bar (team API / on-pace / exceptions) | DERIVABLE | aggregate of the same columns |
| Column presets | NET-NEW (client) | client UI state / `localStorage`; no Firestore |
| "Show only exceptions" toggle | DERIVABLE | reuse dashboard's five-flag rule |
| 5-tab coaching drawer | EXISTS (reuse) | shared coaching drawer |

**No Firestore schema delta** — adds are client-state + reuse. S1 (chrome only) is the strongest near-term TRUE-RESTYLE candidate.

## Item 8 · Meeting Mode v2 (row 32) — largest
| Mockup element | Class | Source / sketch |
|---|---|---|
| Branch scorecard (week/month/quarter/year) | DERIVABLE | aggregate submissions/settlements |
| Units team-by-team, two master sheets | DERIVABLE | existing production/activity reads |
| Exception drill vs floors | DERIVABLE | activity floors + submissions |
| Recognition (top producers / most-active / on-the-rise) | DERIVABLE | leaderboard/production aggregates |
| Birthdays & anniversaries | NET-NEW (fields) | `users.dob` / `users.hireDate` — verify presence; likely absent |
| Awards within reach | DERIVABLE | awards engine (`computeAgentAwards`) |
| 1-on-1 step (coaching ratios + self-eval) | EXISTS/DERIVABLE | coaching notes + ratio computes |
| Tweaks (theme/chrome/sort persistence) | NET-NEW (small) | per-user meeting prefs (overlaps item 1 prefs) |
| Team-photo upload (persisted, separate from kiosk) | NET-NEW | Firebase Storage path `meeting-photos/{tenantId}/...` + a refs doc |
| Phone presenter remote | NET-NEW | lightweight sync channel (`meetingSessions/{id}.currentStep`) |

---

## NET-NEW collection/field inventory (brief-completeness driver)
Each of these triggers the full architectural-unit checklist (rules + write + read + composite indexes + smoke) per CLAUDE.md's new-collection rule:

- **per-user preferences** store (items 1, 8 Tweaks)
- **team-defaults** store + resolver (item 1)
- **candidates** pipeline collection (item 3)
- **campaign** tiers / persistency-gate / placement / winners (item 4)
- **persistency `source`** field (item 5 — small)
- **manager-KPI targets** config (item 6)
- **recruiting target** config (item 3)
- **users `dob`/`hireDate`** fields (item 8 — verify first)
- **meeting team-photo** Storage path + refs, **presenter-remote** session doc (item 8)

Everything else is EXISTS or DERIVABLE — meaning much of each redesign is presentation over data already present, with the NET-NEW items above the true scope drivers.
