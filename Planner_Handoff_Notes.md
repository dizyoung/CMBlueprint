# DIY Charlotte Mason Blueprint Planner — Handoff Notes

## Current state (post-refactor)
`CM_Blueprint_Planner_2026-27.html` is a standalone HTML app (no build step,
no dependencies — open it in a browser, or serve over local HTTP since it
loads `lib/logic.mjs` as an ES module). It is now **generic** — driven
entirely by a `FamilySetup` data model rather than hardcoded family data.
Persistence is in `localStorage` under key `cm_blueprint_data_v3`.

See `README.md` for how to run it, run the tests, and publish via GitHub
Pages.

## Data model
- `FamilySetup`: `{ children: [{id,name,gradeLabel,formId,schoolDaysPerWeek,notes}], schoolYear: {termsPerYear, weeksPerTerm, examWeekPattern: 'last-of-term'|'explicit', examWeeks?}, historyCycleId }`.
- `categories`: array of groups `{grp, col, items: [...]}`. Each item
  (subcategory) is `{id, name, forms: [formId...], childOverrides: [{childId, included}], freq, bks: [...]}`.
  `forms` is the Form-level default; `childOverrides` refines it per child
  (include a child not in the Form default, or exclude one who is).
- Each book: `{t, who: 'all'|'specific', whoChildren: [childId...], tot, per, unitType}`.
  `unitType` is one of `pages|chapters|lessons|entries|sittings`, used for
  display/labeling in pacing math (`p.12-24`, `ch.3`, etc).
- Forms (`f1/f2/f34/f56`) and Cycles are fixed CM-pedagogy reference lists
  in `lib/logic.mjs` — not family-specific, so they aren't part of
  `FamilySetup`, but *which* Forms are "in use" is derived from
  `FamilySetup.children` at render time.

## Architecture
- `lib/logic.mjs` — all pure logic: pacing math (`calc`), frequency-based
  week-inclusion (`categoryAppliesToWeek`), schedule/print generation
  (`buildWeekItems`, `buildPrintTermData`), Family Setup mutation helpers,
  and migration/validation (`isOldShapeData`, `validateAppData`). No DOM,
  no localStorage — fully unit-testable with plain Node.
- `tests/logic.test.mjs` — Node-runnable test suite (`node tests/logic.test.mjs`),
  custom runner on `assert`, no install required. 42 tests as of this
  writing.
- The HTML file's `<script type="module">` imports `lib/logic.mjs`, owns
  all DOM rendering (still brute-force `innerHTML = h` string concatenation,
  consistent with the original design), and owns `localStorage` read/write.

## Frequency → schedule inclusion
Categories have a `freq` field: `4` (daily), `3`, `2`, `1` (all show every
week, differing only in how many sittings/year they're allotted), `0.5`
(every other week), `0.25` (1x/term — shown only the first week of each
term), `0.08` (a few times/year — currently also anchored to first week of
term; this is a simplification documented in `categoryAppliesToWeek`'s
comments — revisit if "a few times/year" needs sub-term-level spacing).

## Pacing math
`calc(category, children, schoolYear)` resolves the relevant children via
Form match + `childOverrides`, takes the **max** `schoolDaysPerWeek` among
them (busiest relevant schedule), and computes sittings available vs.
needed. A category is only flagged "co-op paced" (`sc: 'b'`) if **every**
applicable child has "co-op" in their notes — a category split across a
co-op child and a home-taught child is NOT marked co-op-paced, since that
was misleading in an earlier draft of this refactor (a mixed-pacing
category looked "handled elsewhere" when really one kid needed it covered
at home).

`assignmentRangeForSitting(book, sittingNumber)` produces a real
unit-labeled range (`p.12-24`, `ch.3`) for a given 1-indexed sitting,
clamping the final sitting to the book's total.

## Migration & validation
- Old `cm_blueprint_data_v2` data (a bare array of `{grp, items}`, no
  FamilySetup wrapper) is detected via `isOldShapeData` and is **never**
  silently discarded. The app shows a banner: export-old-data-as-backup,
  then continue to fresh v3 setup.
- Import validates structurally via `validateAppData` before accepting —
  checks `familySetup.children`/`schoolYear` and `categories` shape: bad
  imports show an error message inline rather than crashing or silently
  corrupting state.

## Known simplifications / decisions made where the spec was ambiguous
- "A few times/year" (freq `0.08`) is treated the same as "1x/term" for
  week-inclusion purposes (shows on the first week of each term) — there
  was no spec for finer-grained scheduling within a term for that tier.
- Reordering groups/subcategories uses simple up/down buttons rather than
  drag-and-drop, per the spec's explicit suggestion that this is acceptable.
- `resolveSchoolDaysForCategory` uses the **max** schoolDaysPerWeek among a
  category's applicable children (rather than e.g. an average) so pacing
  reflects the most demanding relevant schedule.
- The original hardcoded family (Charis/Kayla/Lucy/Jeremiah) is preserved
  as the default/demo `FamilySetup` + categories (`lib/logic.mjs`'s
  `demoFamilySetup()`/`demoCategories()`), so the app is still useful out of
  the box, but none of that data is baked into logic — deleting all
  children and adding new ones via Family Setup works the same way.

## Strategic context (why this exists)
This planner was originally built for one family's own use, and is also a
working proof-of-concept for a potential future Chasing Wonder Co. product
("DIY Charlotte Mason Blueprint") — a whole-family CM planning system. If
it eventually becomes a sold product, it would likely need to move from a
downloadable HTML file with localStorage to a logged-in web app with
server-side storage. That's a future decision, not an immediate one.
