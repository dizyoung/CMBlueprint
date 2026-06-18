# DIY Charlotte Mason Blueprint Planner — Handoff Notes

## Current state
`CM_Blueprint_Planner_2026-27.html` is a working standalone HTML app (no build step, no dependencies — just open it in a browser). It uses localStorage to persist edits under the key `cm_blueprint_data_v2`.

**Family this version reflects (2026–27 school year):**
- Charis — 1st grade — Form 1
- Kayla — 3rd grade — Form 1
- Lucy — 7th grade — Form 3/4
- Jeremiah — 10th grade — Form 5/6 (most academics at Greenhouse co-op)

**Form structure:** We collapse the traditional six PNEU Forms into four bands — Form 1 (gr.1–3), Form 2 (gr.4–6), Form 3/4 (gr.7–9), Form 5/6 (gr.10–12) — since Forms III/IV and V/VI were historically taught as combined programmes anyway.

**History cycle:** 4-year CM-aligned rotation (not 3-year/classical). Currently in Cycle 4: Modern Times.

**Four tabs:** Forms (reference), History Cycles (reference), Categories (the pacing calculator — 20 categories across 10 groups, each Form-tagged, with editable book rows and live sittings-available vs. sittings-needed math), 36-week Schedule (3 terms × 12 weeks, weeks 12/24/36 are exam weeks).

## Resolved in this round
- Print-per-child: when a specific child tab is selected on the Schedule tab and "Print this view" is clicked, a dedicated printable layout (one term per page, all 3 terms) is generated into a hidden `#print-area` and shown only during print.
- Empty categories now appear in the schedule as placeholder lines ("Category name — not yet assigned") instead of being silently skipped, so the full subject list is visible even before books are chosen.
- Schedule lines are now color-coded with a small dot matching each category's group color from the Categories tab.
- Verified the weeks-behind shift math (`contentWeekIndex = Math.max(0, w-1-behind)`) at boundaries — clamps to week 1's content rather than going negative or crashing when very behind early in the year.

## Known bugs / rough edges to check first
- The schedule's `buildWeekItems` and `buildWeekItemsAll` functions cycle through each category's book list using `weekNum % cat.bks.length` — this is a simple rotation, not real pacing-aware scheduling. It works for categories with 1+ books but will look repetitive for categories with only one book (it'll show the same book every week, which is probably fine, but worth visually verifying).

## Punch list (remaining / future)

**4b. Smarter "weeks behind" repacing — further refinement.**
- The recovery message (`.rec` div) currently gives generic advice by behind-amount tier (≤2, ≤4, >4 weeks). Consider whether this should reference actual category data (e.g. name a real category that has buffer to cut) rather than generic suggestions.
- Consider whether "weeks behind" should be per-child rather than global, since Jeremiah's 3-day home week paces differently than the girls' 4-day week.

## Architecture notes for whoever picks this up
- All category/book data lives in one big `DEFAULT_CATS` array at the top of the script — structured as groups → categories → books. Each category has a `forms` array (which Form IDs it applies to) used for filtering.
- `calc(cat)` is the core pacing math: sittings available (based on frequency × days/week × 33 reading weeks) vs. sittings needed (sum of `ceil(book.total / book.per)` across all books in the category).
- Everything persists via `localStorage` under `cm_blueprint_data_v2`. Export/Import buttons exist for backing up as JSON.
- No build tooling, no framework — vanilla JS string-concatenation rendering (`innerHTML = h` pattern throughout). This was a deliberate choice to keep it a zero-dependency single file, but it does mean re-rendering is somewhat brute-force (entire sections re-rendered on every change rather than targeted DOM updates).

## Strategic context (why this exists)
This planner is currently being built for Danielle's own family use, but is also a working proof-of-concept for a potential future Chasing Wonder Co. product called the "DIY Charlotte Mason Blueprint" — a whole-family CM planning system. A written guide (digital PDF) is being drafted in parallel in a separate conversation; Part 2 (The Framework) is done. If this tool eventually becomes a sold product, it would likely need to move from a downloadable HTML file to a logged-in web app with server-side data storage (the current localStorage approach only persists per-browser, per-device, which isn't viable for a paying customer's actual product). That's a future decision, not an immediate one — for now, the priority is making this work well for Danielle's own 2026–27 planning.
