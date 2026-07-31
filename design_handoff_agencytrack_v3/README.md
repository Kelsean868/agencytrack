# Handoff: AgencyTrack — Linked Agent System (Planner · Calls · Book · Commission)

## Overview

This package specifies a working, cross-linked agent system for AgencyTrack: an
insurance-agency production platform. The prototype in `prototypes/` is a single
running application with **17 routed screens, three roles, a mobile frame, and one
shared store** in which every screen writes to the same state — so a lead entered in
one screen appears in the dialer queue, a call outcome becomes a planner task, a
kept appointment becomes evidence in the weekly ledger, and a delivered application
becomes a policy on the book with a clawback clock running.

The system it replaces is a set of disconnected surfaces (a calendar, a call list,
a spreadsheet, a commission statement) where the agent is the integration layer.
The whole design premise is: **the app should already know what the agent did.**

### The one idea to carry into production

Every number an agent is judged on should be **derived from a record**, never typed.
Where a record cannot exist, the number is explicitly labelled **declared** and shown
separately, never blended. This is what makes the weekly ledger trustworthy to a
manager and non-punitive to an agent — and it is the constraint that generated most
of the design decisions in `04-DECISIONS.md`.

---

## About the design files

**The files in `prototypes/` are design references created in HTML.** They are
prototypes showing intended look, structure, data model and behaviour. They are
**not production code to copy**.

They run as browser-transpiled JSX (`<script type="text/babel">`) against a design
system loaded from a stylesheet + UMD bundle. There is no build step, no router, no
persistence layer, and no network. Several patterns exist only to make the prototype
demonstrable in a single file (a `hz` harness bar with role and screen switches, an
in-memory store seeded with a fictional Wednesday 1 July 2026).

**Your task is to recreate these designs in the target codebase's existing
environment**, using its established patterns, component library, router and data
layer. The prototype's *component boundaries and state shape are worth keeping* —
they were arrived at deliberately and are documented in `01-ARCHITECTURE.md` — but
its DOM, its CSS file, and its harness are not.

If the target codebase does not exist yet, React + TypeScript with a real router and
a server-backed store is the closest fit to the structure documented here.

---

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, states, copy and interaction
behaviour are final and should be recreated faithfully. All visual values come from
the bound AgencyTrack design system, not from this prototype — see
`05-DESIGN-TOKENS.md`. Every screen has been contrast-checked in **both light and
dark mode** and every reported failure fixed; the ratios and the rules that produced
them are in `06-DEFECT-CLASSES.md`, which you should read before styling anything.

Copy is also final. It was written to be legible to a working agent, not to a
product manager: "Won, not banked", "It's the record, not an opinion", "Working the
dialer can only ever raise the number". Please carry the copy across verbatim — in
several places the wording *is* the feature (see `04-DECISIONS.md` §12).

---

## Read these in order

| File | What it gives you |
|---|---|
| `01-ARCHITECTURE.md` | Shell, routing, roles, the shared store, every cross-module rule, module map |
| `02-SCREENS.md` | Every screen: purpose, layout, components, states, exact copy |
| `03-DATA-MODEL.md` | Entities, activity codes, the derived-vs-declared contract |
| `04-DECISIONS.md` | **Why** each choice was made, and what the rejected alternative was |
| `05-DESIGN-TOKENS.md` | Colors, type, spacing, radii, the family-hue system |
| `06-DEFECT-CLASSES.md` | The four defect classes this build hit repeatedly, and the standing rules |
| `07-BUILD-ORDER.md` | Implementation sequence with dependencies and effort |
| `08-OPEN-ITEMS.md` | What is genuinely unfinished, stated honestly |

---

## Running the prototype

Open `prototypes/AgencyTrack Linked App.html`. It needs the AgencyTrack design
system at `_ds/agencytrack-design-system-<id>/` (stylesheet + `_ds_bundle.js`)
relative to the HTML — copy that folder alongside `prototypes/` if it is missing,
or read the specs and ignore the runtime.

**Harness controls** (top bar — prototype-only, do not build):

- Role switch: **Agent · Manager · Recruit**
- Screen tabs, plus keyboard `1`–`9`
- **Sync pill** — click to toggle offline; writes queue and flush on reconnect
- **Desktop / Mobile** — swaps to a 390×844 phone frame
- **Dark / Light**

**Real shortcuts** (do build these): `d` day · `w` week · `s` smart ·
`f` focus mode · `[` nav collapse · `]` action-plan rail.

---

## Assets

No images or bitmaps. All iconography is the design system's `Icon` component
(24px viewBox, 1.8 stroke, round caps). Five icons the prototype needed did not
exist in the DS set and are drawn inline as `children` passed to `Icon`:
`play`, `pause`, `grip`, `chevron`, `alert`, `upload`. **These should be added to
the real icon set** rather than re-inlined — see `06-DEFECT-CLASSES.md` §2.

Names, policy numbers, premiums and areas are fictional but locally plausible
(Trinidad & Tobago: San Fernando, Chaguanas, Couva; TTD; `868` dialling codes).
Phone normalisation assumes TT numbers — see `03-DATA-MODEL.md`.
