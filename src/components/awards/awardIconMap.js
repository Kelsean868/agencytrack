import {
  Trophy, Crown, ShieldCheck, Shield, TrendingUp,
  Activity, Zap, Users, Building2, Star,
} from 'lucide-react';

// Presentation-layer mapping of manager award id → icon component.
// Pure rendering concern — awardsEngine does not model icons.
const ICON_BY_AWARD_ID = {
  // Annual category (manager-side)
  production_award:   TrendingUp,
  persistency_silver: ShieldCheck,
  persistency_gold:   Shield,
  unit_of_year:       Crown,
  agency_of_year:     Building2,

  // Activity category
  activity_bronze:  Activity,
  activity_silver:  Activity,
  activity_gold:    Activity,
  highest_activity: Zap,

  // Recruiting category
  recruiting_bronze: Users,
  recruiting_silver: Users,
  recruiting_gold:   Users,
};

export function getAwardIcon(awardId) {
  return ICON_BY_AWARD_ID[awardId] ?? Trophy;
}

export { Star };
