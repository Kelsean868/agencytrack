# Track J — AgentPersistencyTab v2 visual port (kickoff)

**Track:** J — V2 Redesign canary run  
**Branch:** `redesign/persistency`  
**Scope:** `src/components/agent/PersistencyTab.jsx` only (+ brief + docs)  
**Channel:** Green-channel auto-merge if all gates pass

---

## v2 source

`design_handoff_v2_app/mockups/AgencyTrack Persistency v2.html`  
Mockup files: `persistency-v2-shared.jsx`, `persistency-v2-panels.jsx`, `persistency-v2-builder.jsx`, `persistency-v2-scenes.jsx`  
README §6 mapping: `agent/PersistencyTab.jsx` → Persistency v2

---

## Visual deltas (current → v2)

| Site | Current | V2 target (Nexus token) |
|------|---------|------------------------|
| `badgeClass()` — null state | `bg-border/40 text-ink-muted` | `bg-surface-muted text-ink-muted` |
| `badgeClass()` — ≥90% | `bg-success/15 text-success` | `bg-success-tint text-success` |
| `badgeClass()` — 80–89% | `bg-warning/15 text-warning` | `bg-warning-tint text-warning` |
| `badgeClass()` — <80% | `bg-danger/15 text-danger` | `bg-danger-tint text-danger` |
| Section eyebrow labels (4×) | `text-xs font-semibold uppercase tracking-wide text-ink-muted` | `text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted` |
| Award gate banner bg | `bg-warning/10 border-warning/30` | `bg-warning-tint border-warning/30` |
| Chart 90% reference line | `stroke="var(--color-success)"` | `stroke="var(--color-gold)"` (v2 award-gate = gold) |
| "Award-eligible" inline tag | bare `text-success text-xs` | `bg-success-tint text-success` pill with `text-[9px] font-mono uppercase tracking-widest` |

Rationale for gold reference line: v2 `PersTrendChart` uses `t.gold` for the 90% gridline (matching `TargetSlider` gold gate marker); success green is kept for the persistency band badge/text.

Rule 9 carve-out applied: `t.inkFaint` from v2 → `text-ink-muted` (pre-authorized contrast fix from PR #392).

---

## Decisions locked

- No new tokens, no raw hex values
- Only `src/components/agent/PersistencyTab.jsx` + this brief + CONTEXT.md
- Recharts inline-style pixel values (`borderRadius: 8`, `fontSize: 10/12`) are exempt from hex-grep (not hex)
- `text-white` on primary button is the accepted exception
- Auto-merge if all 6 gates pass
