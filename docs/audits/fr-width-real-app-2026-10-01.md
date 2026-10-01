# FR width sweep — real app (staging) — 2026-10-01T13:22Z

Staging build served at a local port · signed in as the staging fixture agent · FR look · widths 1024, 1280, 1366, 1440, 390 · light + dark · read-only (1 write/function requests aborted).

**72 findings** on 7/24 routes · **1 route(s) NOT CHECKED**. Screenshots are not committed.

| Route | 1024 | 1280 | 1366 | 1440 | 390 |
|---|---|---|---|---|---|
| Today | 0 | 0 | 0 | 0 | 0 |
| Focus | 0 | 0 | 0 | 0 | 0 |
| Week | 0 | 0 | 0 | 0 | **1** |
| Pipeline | 0 | 0 | 0 | 0 | 0 |
| Prospect prep | 0 | 0 | 0 | 0 | 0 |
| Numbers · Production report | 0 | 0 | 0 | 0 | **2** |
| Numbers · Performance report | **3** | 0 | 0 | 0 | 0 |
| Numbers · History | **3** | **3** | **2** | **2** | **9** |
| Policy ledger | 0 | 0 | 0 | 0 | 0 |
| Money · Overview | 0 | 0 | 0 | 0 | 0 |
| Money · Goals and MDRT | 0 | 0 | 0 | 0 | 0 |
| Money · Game plan | **1** | **2** | **1** | **1** | **1** |
| Money · Money needs | 0 | 0 | 0 | 0 | 0 |
| Money · Commission | 0 | 0 | 0 | 0 | 0 |
| Money · Persistency | 0 | 0 | 0 | 0 | 0 |
| Money · Financing | 0 | 0 | 0 | 0 | 0 |
| Leaderboard | 0 | 0 | 0 | 0 | 0 |
| Campaign | 0 | 0 | 0 | 0 | 0 |
| Awards | **39** | 0 | 0 | 0 | 0 |
| Trophy room | 0 | 0 | 0 | 0 | 0 |
| Me | 0 | 0 | 0 | 0 | 0 |
| Career | 0 | **2** | 0 | 0 | 0 |
| Connections | 0 | 0 | 0 | 0 | 0 |
| Weekly reportSubmit when your week is done | **NOT CHECKED** — a modal dialog would not close with Escape (Weekly reportSubmit when your week is done) | | | | |

Modal dialogs closed with Escape before probing:

- Today: `filing-streak-celebration`
- Money · Goals and MDRT: `goals-celebration-streak`
- Weekly reportSubmit when your week is done: `wizard-v2-modal`
- Weekly reportSubmit when your week is done: `wizard-v2-modal`
- Weekly reportSubmit when your week is done: `wizard-v2-modal`

| Route | Width | Theme | Probe | Element | Text | Detail |
|---|---|---|---|---|---|---|
| Week | 390 | dark+light | overflow | `div.screen-enter > div.max-w-3xl.mx-auto > div.flex.items-center` | Planner Select Book | scrollWidth 335 > clientWidth 326 |
| Numbers · Production report | 390 | dark+light | crushed | `div. > div.grid.grid-cols-4 > div.rounded-xl.p-3 > p.text-lg.font-bold` | TTD 125,000 | 2 lines · 2 words · 56px (4.7ch) |
| Numbers · Production report | 390 | dark+light | overflow | `div. > div.grid.grid-cols-4 > div.rounded-xl.p-3 > p.text-lg.font-bold` | TTD 125,000 | scrollWidth 64 > clientWidth 56 |
| Numbers · Performance report | 1024 | dark+light | crushed | `[data-testid="agent-report-windows"] > div.rounded-xl.p-3 > p.text-lg.font-bold` | TTD 122,000 | 2 lines · 2 words · 60px (5.0ch) |
| Numbers · Performance report | 1024 | dark+light | overflow | `[data-testid="agent-report-windows"] > div.rounded-xl.p-3 > p.text-lg.font-bold` | TTD 122,000 | scrollWidth 67 > clientWidth 60 |
| Numbers · Performance report | 1024 | dark+light | overflow | `[data-testid="agent-report-activity"] > div.rounded-xl.p-3 > p.text-[9px].font-bold` | TEL CONTACTS | scrollWidth 50 > clientWidth 47 |
| Numbers · History | 1024 | dark+light | overflow | `div.screen-enter > div.flex.flex-col > div.card.p-4 > div.relative.h-4` | JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC | scrollWidth 979 > clientWidth 714 |
| Numbers · History | 1024 | dark+light | overflow | `div.flex.flex-col > div.card.p-4 > div.flex.flex-wrap > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 1024 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 1280 | dark+light | overflow | `div.screen-enter > div.flex.flex-col > div.card.p-4 > div.relative.h-4` | JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC | scrollWidth 979 > clientWidth 970 |
| Numbers · History | 1280 | dark+light | overflow | `div.flex.flex-col > div.card.p-4 > div.flex.flex-wrap > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 1280 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 1366 | dark+light | overflow | `div.flex.flex-col > div.card.p-4 > div.flex.flex-wrap > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 1366 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 1440 | dark+light | overflow | `div.flex.flex-col > div.card.p-4 > div.flex.flex-wrap > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 1440 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 390 | dark+light | crushed | `button.card.w-full > div.grid.grid-cols-4 > div.p-2.rounded-lg > span.text-base.font-bold` | TTD 3.0K | 2 lines · 2 words · 34px (3.2ch) |
| Numbers · History | 390 | dark+light | crushed | `button.card.w-full > div.grid.grid-cols-4 > div.p-2.rounded-lg > span.text-base.font-bold` | TTD 13K | 2 lines · 2 words · 29px (2.7ch) |
| Numbers · History | 390 | dark+light | crushed | `button.card.w-full > div.grid.grid-cols-4 > div.p-2.rounded-lg > span.text-base.font-bold` | TTD 14K | 2 lines · 2 words · 29px (2.7ch) |
| Numbers · History | 390 | dark+light | crushed | `button.card.w-full > div.grid.grid-cols-4 > div.p-2.rounded-lg > span.text-base.font-bold` | TTD 12K | 2 lines · 2 words · 29px (2.7ch) |
| Numbers · History | 390 | dark+light | crushed | `button.card.w-full > div.grid.grid-cols-4 > div.p-2.rounded-lg > span.text-base.font-bold` | TTD 22K | 2 lines · 2 words · 29px (2.8ch) |
| Numbers · History | 390 | dark+light | overflow | `div.screen-enter > div.flex.flex-col > div.card.p-4 > div.relative.h-4` | JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC | scrollWidth 979 > clientWidth 324 |
| Numbers · History | 390 | dark+light | overflow | `div.flex.flex-col > div.card.p-4 > div.flex.flex-wrap > div.rounded-sm.bg-primary` |  | scrollWidth 21 > clientWidth 17 |
| Numbers · History | 390 | dark+light | overflow | `div.card.p-4 > div.flex.flex-wrap > div.flex.items-center > div.relative.w-2` |  | scrollWidth 12 > clientWidth 8 |
| Numbers · History | 390 | dark+light | overflow | `div.screen-enter > div.flex.flex-col > div.flex.items-start` | All weeks 11 Submitted 9 Draft 2 Unlocked 2026 All months January Febr | scrollWidth 397 > clientWidth 358 |
| Money · Game plan | 1024 | dark+light | overflow | `div. > div.pt-5 > div.relative.border-b > div.absolute.inset-0` | TTD 20,833 TTD 20,833 | scrollWidth 465 > clientWidth 450 |
| Money · Game plan | 1280 | dark+light | overflow | `div. > div.pt-5 > div.relative.border-b > div.absolute.inset-0` | TTD 20,833 TTD 20,833 | scrollWidth 365 > clientWidth 346 |
| Money · Game plan | 1280 | dark+light | chart | `div.absolute.inset-0 > button.group.relative > div.relative.flex > span.absolute.bottom-full  ×  div` | TTD 20,833 × TTD 20,833 | labels collide 7×14px |
| Money · Game plan | 1366 | dark+light | overflow | `div. > div.pt-5 > div.relative.border-b > div.absolute.inset-0` | TTD 20,833 TTD 20,833 | scrollWidth 447 > clientWidth 432 |
| Money · Game plan | 1440 | dark+light | overflow | `div. > div.pt-5 > div.relative.border-b > div.absolute.inset-0` | TTD 20,833 TTD 20,833 | scrollWidth 518 > clientWidth 506 |
| Money · Game plan | 390 | dark+light | chart | `div.absolute.inset-0 > button.group.relative > div.relative.flex > span.absolute.bottom-full  ×  div` | TTD 20,833 × TTD 20,833 | labels collide 12×14px |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-advisor_month_api"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm` | Advisor of the Month — API | 4 lines · 6 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-advisor_month_apps"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-s` | Advisor of the Month — Apps | 4 lines · 6 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-quarterly_api"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.fon` | Quarterly API Award | 3 lines · 3 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-quarterly_api"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.tex` | Quarterly Bonus | 2 lines · 2 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-quarterly_apps"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.fo` | Quarterly Apps Award | 3 lines · 3 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-quarterly_apps"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.te` | Quarterly Bonus | 2 lines · 2 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-persistency_silver"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-s` | Persistency Award — Silver | 3 lines · 4 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-persistency_silver"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-x` | Silver Trophy + Bonus | 3 lines · 4 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-persistency_gold"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.` | Persistency Award — Gold | 3 lines · 4 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-persistency_gold"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.` | Gold Trophy + Premium Bonus | 4 lines · 5 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-rookie_of_year"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.fo` | Rookie of the Year | 3 lines · 4 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-rookie_of_year"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.te` | Rookie Trophy + Premium Recognition | 4 lines · 5 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-new_bs_award"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.font` | New Business Advisor Award | 4 lines · 4 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-new_bs_award"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.text` | New Advisor Trophy + Bonus | 4 lines · 5 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-centurion"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.font-bo` | Centurion Award | 2 lines · 2 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-centurion"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.text-in` | Centurion Trophy | 2 lines · 2 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-bronze_club_l3"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.fo` | Bronze Club — Level 3 | 3 lines · 5 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-bronze_club_l3"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.te` | Bronze Club Membership | 3 lines · 3 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-bronze_club_l2"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.fo` | Bronze Club — Level 2 | 3 lines · 5 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-bronze_club_l2"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.te` | Bronze Club Membership + Bonus | 4 lines · 5 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-bronze_club_l1"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.fo` | Bronze Club — Level 1 | 3 lines · 5 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-bronze_club_l1"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.te` | Bronze Club Level 1 + Trip | 4 lines · 6 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-silver_club"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.font-` | Silver Club | 2 lines · 2 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-silver_club"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.text-` | Silver Club + Premium Trip | 4 lines · 5 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-gold_club"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.font-bo` | Gold Club | 2 lines · 2 words · 58px (6.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-gold_club"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.text-in` | Gold Club + Luxury Trip | 3 lines · 5 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-agent_of_year"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.tex` | Agent of the Year Trophy + Grand Prize | 5 lines · 8 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | crushed | `[data-testid="award-card-mdrt"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.text-ink-mut` | MDRT Membership + Recognition | 4 lines · 4 words · 58px (7.3ch) |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-advisor_month_api"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs` | Recognition + Gift | scrollWidth 67 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-advisor_month_apps"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-x` | Recognition + Gift | scrollWidth 67 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-quarterly_api"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.fon` | Quarterly API Award | scrollWidth 63 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-quarterly_apps"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.fo` | Quarterly Apps Award | scrollWidth 63 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-persistency_silver"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-s` | Persistency Award — Silver | scrollWidth 78 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-persistency_gold"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.` | Persistency Award — Gold | scrollWidth 78 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-rookie_of_year"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.te` | Rookie Trophy + Premium Recognition | scrollWidth 67 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-centurion"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-sm.font-bo` | Centurion Award | scrollWidth 65 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-bronze_club_l3"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.te` | Bronze Club Membership | scrollWidth 69 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-bronze_club_l2"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.te` | Bronze Club Membership + Bonus | scrollWidth 69 > clientWidth 58 |
| Awards | 1024 | dark+light | overflow | `[data-testid="award-card-mdrt"] > div.flex.items-start > div.min-w-0.flex-1 > p.text-xs.text-ink-mut` | MDRT Membership + Recognition | scrollWidth 69 > clientWidth 58 |
| Career | 1280 | dark+light | clipped | `[data-testid="fr-career-trajectory"] > div. > div.mt-1.5.flex > span.min-w-0.flex-1` | Q2 ’26 | figure cut: 34 > 32 |
| Career | 1280 | dark+light | clipped | `[data-testid="fr-career-trajectory"] > div. > div.mt-1.5.flex > span.min-w-0.flex-1` | Q3 ’26 | figure cut: 34 > 32 |