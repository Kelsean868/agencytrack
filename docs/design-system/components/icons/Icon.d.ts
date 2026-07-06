import * as React from 'react';

/**
 * AgencyTrack icon wrapper — 24px viewBox, stroke 1.8, round caps/joins
 * (Lucide-style line icons, hand-rolled in the codebase). Named icons exported
 * alongside: IconHome, IconWizard, IconHistory, IconChart, IconTarget,
 * IconWallet, IconMedal, IconShield, IconBolt, IconRepeat, IconBook, IconUsers,
 * IconGrid, IconSettings, IconSearch, IconBell, IconSun, IconMoon, IconChevR,
 * IconChevD, IconArrowR, IconCheck, IconAlert, IconTrophy, IconFilter,
 * IconDownload, IconPlus, IconClock — each takes {size, color, stroke}.
 */
export interface IconProps {
  /** px. @default 20 */
  size?: number;
  /** @default 'currentColor' */
  color?: string;
  /** @default 1.8 */
  stroke?: number;
  fill?: string;
  /** Named glyph for the `name=` API — home, wizard, history, chart, target,
   *  wallet, medal, shield, bolt, repeat, book, users, grid, settings, search,
   *  bell, sun, moon, trophy, clock, filter, download, calendar, check, plus,
   *  arrow, pin. When set, children are ignored. */
  name?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Icon(props: IconProps): JSX.Element;
