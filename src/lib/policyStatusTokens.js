/**
 * policyStatusTokens.js — single source of truth for Policy Ledger v2 status colors.
 *
 * Maps each policy to one of six SEMANTIC ROLES, and each role to canonical Nexus
 * token utility classes. No raw Tailwind palette colors (bg-blue-50 etc.) anywhere
 * on the v2 ledger surface — every chip / dot / pill derives from statusToken().
 *
 * Placed in src/lib/ so both the agent surface (now) and the manager surface
 * (later track) can import the same mapping.
 *
 * Roles → Nexus families (all utilities verified to exist in tailwind.config.js +
 * defined in both :root and .dark in src/index.css):
 *   in-flight (submitted · rated) → primary (teal)
 *   settled / clean               → success
 *   confirmed (DERIVED)           → gold
 *   soft-exception (postponed)    → warning
 *   hard-exception (ntu · denied) → danger
 *   closed (lapsed)               → ink-faint on surface-muted
 *
 * `confirmed` is a DERIVED DISPLAY role — computed from the manager-confirmation
 * fields being present. It is NOT a value in policyLifecycle.js POLICY_STATUSES.
 */

import { POLICY_STATUS_LABELS } from '../constants/policyLifecycle';

/** A policy is "confirmed" (derived) once the manager confirmation fields are set. */
export function isConfirmed(policy) {
  return Boolean(policy?.confirmedAt);
}

/**
 * policyRole — resolve a policy to one of the six semantic roles.
 * `confirmed` (derived) takes precedence over the underlying `settled` status.
 */
export function policyRole(policy) {
  if (isConfirmed(policy)) return 'confirmed';
  switch (policy?.status) {
    case 'submitted':
    case 'rated':
      return 'in-flight';
    case 'settled':
      return 'settled';
    case 'postponed':
      return 'soft';
    case 'ntu':
    case 'denied':
      return 'hard';
    case 'lapsed':
      return 'closed';
    default:
      return 'in-flight';
  }
}

/**
 * Role → token classes.
 *   text  — foreground utility (text-{family})
 *   tint  — soft background utility ({family} tint, or surface-muted for closed)
 *   solid — solid fill utility (bg-{family}) for lifecycle dots / flow segments
 */
const ROLE_TOKENS = {
  'in-flight': { text: 'text-primary',   tint: 'bg-primary-tint', solid: 'bg-primary'   },
  settled:     { text: 'text-success',   tint: 'bg-success-tint', solid: 'bg-success'   },
  confirmed:   { text: 'text-gold',      tint: 'bg-gold-tint',    solid: 'bg-gold'      },
  soft:        { text: 'text-warning',   tint: 'bg-warning-tint', solid: 'bg-warning'   },
  hard:        { text: 'text-danger',    tint: 'bg-danger-tint',  solid: 'bg-danger'    },
  closed:      { text: 'text-ink-muted', tint: 'bg-surface-muted', solid: 'bg-ink-faint' },
};

/**
 * statusToken — the single shared helper. Returns the foreground/background/solid
 * token classes for a semantic role. Every chip, dot, and pill on the v2 surface
 * derives from this — no raw palette colors.
 *
 * @param {'in-flight'|'settled'|'confirmed'|'soft'|'hard'|'closed'} role
 * @returns {{ text: string, tint: string, solid: string }}
 */
export function statusToken(role) {
  return ROLE_TOKENS[role] ?? ROLE_TOKENS['in-flight'];
}

/** Convenience: resolve a policy straight to its token classes. */
export function policyToken(policy) {
  return statusToken(policyRole(policy));
}

/**
 * policyPillLabel — the uppercase pill text for a policy. Confirmed (derived)
 * reads "Confirmed"; everything else uses the canonical POLICY_STATUS_LABELS.
 */
export function policyPillLabel(policy) {
  if (isConfirmed(policy)) return 'Confirmed';
  return POLICY_STATUS_LABELS[policy?.status] ?? policy?.status ?? '';
}
