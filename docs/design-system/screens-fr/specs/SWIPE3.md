# Mobile v3 — "swipe pages" pattern (replaces long vertical scrolls)

The owner finds long phone screens tiring and liked the old Home's left/right swipe. Convert the
long mobile screens into named, swipeable pages. Keep EVERY feature — you are re-arranging, not
cutting. Read MOBILE3.md and CONVENTIONS.md for the format rules (they still apply).

## Rules
1. Header stays at the top (back button, title, header actions). Under it: a PAGER = a row of
   named chips (buttons, 44px tall, horizontally scrollable if they don't fit, active chip filled,
   `role="tablist"` / `role="tab"` / `aria-selected`) + a row of small dots (active dot wider).
2. Below the pager: the TRACK — all pages side by side, each exactly 390px wide
   (`display: flex; width: N*390px; transform: translateX({{tx}}px)`), inside a 390px wrapper
   with `overflow: hidden; touch-action: pan-y`.
3. Each page answers ONE question and should fit about one phone screen (aim ≤ ~1100px tall;
   split further if longer). Page order = importance. 3–5 pages per screen.
4. Swipe engine — copy the one in project/Home-Swipe.dc.html (pointer down/move/up handlers):
   horizontal intent only when |dx| > 10 and |dx| > |dy| (otherwise let the page scroll
   vertically), 1:1 drag, rubber-band at the first/last page (`dx*390*0.55/(390+0.55*|dx|)`),
   velocity projection on release (`x + (v/1000)*0.99/(1-0.99)`, threshold ±195), snap with
   `transform 520ms cubic-bezier(0.32, 0.72, 0, 1)`, no transition while dragging. Tapping a
   chip jumps there with the same animation. ArrowLeft/ArrowRight on the focused pager move pages
   (onKeyDown on the pager element, not a global listener).
5. No blank scroll: the page you are on sets the height. Give inactive pages
   `max-height: {{p.clip}}px; overflow: hidden` (clip = the active page's height estimate) and set
   the ROOT height from the active page: `height: {{rootH}}px` where rootH = header + pager +
   active page height estimate + 104 (nav). Keep `$preview` height = the tallest you expect.
   `aria-hidden` on inactive pages.
6. Things that must stay reachable from every page stay OUTSIDE the track: sticky bottom action
   bars ("Adjust", "What if…", result bars), bottom sheets, celebration overlays.
7. Deep link: `params` may contain `page=<Id>`; start on that page. Keep the current page in state.
8. First page = the answer at a glance (the number, the chart, the next action). Put a small
   "Swipe for more →" hint under the pager on first view only (state flag, hide after first swipe).
9. Charts still glide (MOTION3.md). Page changes don't replay chart entrances every time — only
   the first time a page is shown.
10. prefers-reduced-motion: snap without the 520ms slide.

After editing, run for each file:
`cd /tmp/claude-0/-home-claude/d8f98879-7dab-55d3-8edd-6582ad180b1c/scratchpad/atr && python3 validate.py project/<file>` (must be ok, ignoring nothing)
and `MISS=1 node mini-render.js <Name> '{}' >/dev/null` (must print nothing).
