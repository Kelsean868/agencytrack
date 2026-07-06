/* ============================================================================
   redesign-icons.js — 14 line-icon glyphs added in the 2026 redesign so every
   nav tab has its own icon (no repeats within a role).
   ----------------------------------------------------------------------------
   Lucide-style, 24×24 viewBox, stroke 1.8, round caps/joins — matches the DS
   Icon set. Fold these entries into components/icons/Icon.jsx's path map.

   Tab → icon assignments (for reference):
     Agent    History→history · Game Plan→map · Money Needs→wallet ·
              Commission→calculator · Leaderboard→medal · Career→ladder
     Manager  Master Sheet→grid* · Team Performance→gauge · Settlements→coins ·
              Financing→bank · Reconciliation→scale · Team Plans→map ·
              Team WARs→clipboard · Agent of Month→medal · Kiosk→tv
     Admin    Branches→bank · Company Config→sliders
     (*grid already existed; listed for completeness)
   ============================================================================ */
export const REDESIGN_ICON_PATHS = {
  history: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2',
  wallet: 'M2 7h18v12H2zM2 7l3-4h11l3 4M16 13h.01',
  coins: 'M9 9m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M21 12a6 6 0 0 1-6 6M15 6a6 6 0 0 1 0 12',
  calculator: 'M6 2h12v20H6zM9 6h6M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h4',
  medal: 'M7 3l3 6M17 3l-3 6M12 21a6 6 0 1 0 0-12a6 6 0 0 0 0 12M10 14l2 1.5 2-1.5',
  ladder: 'M7 2v20M17 2v20M7 7h10M7 12h10M7 17h10',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  clipboard: 'M9 3h6v3H9zM7 4.5H5v16.5h14V4.5h-2M9 12h6M9 16h6',
  bank: 'M3 10h18M4 10 12 4l8 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18',
  scale: 'M12 3v18M8 21h8M6 6h12M6 6 3 12h6zM3 12a3 3 0 0 0 6 0M18 6l-3 6h6zM15 12a3 3 0 0 0 6 0',
  tv: 'M2 7h20v13H2zM8 3l4 4 4-4',
  gauge: 'M12 13l4-3M12 13a1.6 1.6 0 1 0 0 .01M4 19a9 9 0 1 1 16 0',
  flag: 'M4 21V3M4 4h13l-3 4 3 4H4',
  sliders: 'M4 21v-7M4 10V3M12 21v-11M12 6V3M20 21v-5M20 12V3M2 14h4M10 6h4M18 16h4',
};
