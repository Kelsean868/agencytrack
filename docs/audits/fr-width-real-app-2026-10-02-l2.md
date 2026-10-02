# FR width sweep — real app (staging) — 2026-10-02T18:57Z

Staging build served at a local port · signed in as the staging fixture agent · FR look · widths 1024, 1280, 1366, 1440, 390 · light + dark · read-only (1 write/function requests aborted).

**14 findings** on 2/24 routes. Screenshots are not committed.

| Route | 1024 | 1280 | 1366 | 1440 | 390 |
|---|---|---|---|---|---|
| Today | 0 | 0 | 0 | 0 | 0 |
| Focus | 0 | 0 | 0 | 0 | 0 |
| Week | 0 | 0 | 0 | 0 | 0 |
| Pipeline | 0 | 0 | 0 | 0 | 0 |
| Prospect prep | 0 | 0 | 0 | 0 | 0 |
| Numbers · Production report | 0 | 0 | 0 | 0 | 0 |
| Numbers · Performance report | 0 | 0 | 0 | 0 | 0 |
| Numbers · History | **2** | **2** | **2** | **2** | **2** |
| Policy ledger | 0 | 0 | 0 | 0 | 0 |
| Money · Overview | 0 | 0 | 0 | 0 | 0 |
| Money · Goals and MDRT | 0 | 0 | 0 | 0 | 0 |
| Money · Game plan | **1** | **1** | **1** | **1** | 0 |
| Money · Money needs | 0 | 0 | 0 | 0 | 0 |
| Money · Commission | 0 | 0 | 0 | 0 | 0 |
| Money · Persistency | 0 | 0 | 0 | 0 | 0 |
| Money · Financing | 0 | 0 | 0 | 0 | 0 |
| Leaderboard | 0 | 0 | 0 | 0 | 0 |
| Campaign | 0 | 0 | 0 | 0 | 0 |
| Awards | 0 | 0 | 0 | 0 | 0 |
| Trophy room | 0 | 0 | 0 | 0 | 0 |
| Me | 0 | 0 | 0 | 0 | 0 |
| Career | 0 | 0 | 0 | 0 | 0 |
| Connections | 0 | 0 | 0 | 0 | 0 |
| Weekly report | 0 | 0 | 0 | 0 | 0 |

Notes:

- Leaderboard: boards probed: Activity · API · Apps
- Weekly report: wizard probed as its own screen; wizard closed with its Close button

Modal dialogs closed with Escape before probing:

- after sign-in: `filing-streak-celebration`
- Money · Goals and MDRT: `goals-celebration-streak`

| Route | Width | Theme | Probe | Element | Text | Detail |
|---|---|---|---|---|---|---|
| Numbers · History | 1024 | dark+light | overflow | `div.flex.flex-wrap > div.flex.flex-col > div.flex.gap-[3px] > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 1024 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 1280 | dark+light | overflow | `div.flex.flex-wrap > div.flex.flex-col > div.flex.gap-[3px] > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 1280 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 1366 | dark+light | overflow | `div.flex.flex-wrap > div.flex.flex-col > div.flex.gap-[3px] > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 1366 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 1440 | dark+light | overflow | `div.flex.flex-wrap > div.flex.flex-col > div.flex.gap-[3px] > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 1440 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 390 | dark+light | overflow | `div.flex.flex-wrap > div.flex.flex-col > div.flex.gap-[3px] > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 390 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Money · Game plan | 1024 | dark+light | overflow | `div.@container > div.pt-5 > div.relative.border-b > div.absolute.inset-0` | TTD 20,833 TTD 20,833 | scrollWidth 465 > clientWidth 450 |
| Money · Game plan | 1280 | dark+light | overflow | `div.@container > div.pt-5 > div.relative.border-b > div.absolute.inset-0` | TTD 20,833 TTD 20,833 | scrollWidth 365 > clientWidth 346 |
| Money · Game plan | 1366 | dark+light | overflow | `div.@container > div.pt-5 > div.relative.border-b > div.absolute.inset-0` | TTD 20,833 TTD 20,833 | scrollWidth 447 > clientWidth 432 |
| Money · Game plan | 1440 | dark+light | overflow | `div.@container > div.pt-5 > div.relative.border-b > div.absolute.inset-0` | TTD 20,833 TTD 20,833 | scrollWidth 518 > clientWidth 506 |
