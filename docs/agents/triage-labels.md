# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Not the same as green-channel / human-merge

CLAUDE.md § Workflow defines a **green-channel / human-merge** vocabulary. These are a different axis and must not be conflated:

- `ready-for-agent` / `ready-for-human` govern **implementation** authority — can an AFK agent build this at all?
- `green-channel` / `human-merge` govern **merge** authority — who clicks merge once it is built?

An item can be `ready-for-agent` and still `human-merge` (a `firestore.rules` change, for example: fully specified and buildable by an agent, but never auto-merged). Applying one vocabulary as a proxy for the other would erode the merge gate.
