// Plain-Node test runner for lib/logic.mjs — no dependencies, no installs.
// Run with: node tests/logic.test.mjs
import assert from 'node:assert/strict';
import * as L from '../lib/logic.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Children: add/edit/delete + pacing recompute on school-days change
// ---------------------------------------------------------------------------
test('addChild adds a child to familySetup', () => {
  const fs = L.demoFamilySetup();
  const before = fs.children.length;
  L.addChild(fs, { id: 'newkid', name: 'New Kid', gradeLabel: '5th', formId: 'f2', schoolDaysPerWeek: 4, notes: '' });
  assert.equal(fs.children.length, before + 1);
  assert.ok(fs.children.find(c => c.id === 'newkid'));
});

test('editChild patches fields on an existing child', () => {
  const fs = L.demoFamilySetup();
  L.editChild(fs, 'lucy', { schoolDaysPerWeek: 5, gradeLabel: '8th' });
  const lucy = fs.children.find(c => c.id === 'lucy');
  assert.equal(lucy.schoolDaysPerWeek, 5);
  assert.equal(lucy.gradeLabel, '8th');
});

test('deleteChild removes the child', () => {
  const fs = L.demoFamilySetup();
  L.deleteChild(fs, 'jeremiah');
  assert.equal(fs.children.find(c => c.id === 'jeremiah'), undefined);
});

test('pacing recomputes when schoolDaysPerWeek changes', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const mathCat = L.findCategory(cats, 'math');
  const before = L.calc(mathCat, fs.children, fs.schoolYear);
  L.editChild(fs, 'jeremiah', { schoolDaysPerWeek: 5 });
  const after = L.calc(mathCat, fs.children, fs.schoolYear);
  // jeremiah is the max-days child for 'math' (applies to all forms); raising his
  // days should raise the resolved days used and thus sittings available.
  assert.ok(after.s >= before.s);
  assert.equal(after.days, 5);
});

// ---------------------------------------------------------------------------
// Groups: add/edit/delete/reorder
// ---------------------------------------------------------------------------
test('addGroup appends a new category group', () => {
  const cats = L.demoCategories();
  const before = cats.length;
  L.addGroup(cats, { grp: 'Music Theory', col: '#123456', items: [] });
  assert.equal(cats.length, before + 1);
  assert.equal(cats[cats.length - 1].grp, 'Music Theory');
});

test('deleteGroup removes a group by name', () => {
  const cats = L.demoCategories();
  const before = cats.length;
  const after = L.deleteGroup(cats, 'Math');
  assert.equal(after.length, before - 1);
  assert.ok(!after.find(g => g.grp === 'Math'));
});

test('moveGroup reorders a group up/down', () => {
  const cats = L.demoCategories();
  const originalOrder = cats.map(g => g.grp);
  L.moveGroup(cats, originalOrder[2], -1); // move 3rd group up
  assert.equal(cats[1].grp, originalOrder[2]);
  assert.equal(cats[2].grp, originalOrder[1]);
});

test('moveGroup is a no-op at boundaries', () => {
  const cats = L.demoCategories();
  const firstName = cats[0].grp;
  L.moveGroup(cats, firstName, -1);
  assert.equal(cats[0].grp, firstName);
});

// ---------------------------------------------------------------------------
// Subcategories: add/edit/delete/reorder
// ---------------------------------------------------------------------------
test('addSubcategory appends an item to a group', () => {
  const cats = L.demoCategories();
  const grp = cats[0];
  const before = grp.items.length;
  L.addSubcategory(grp, { id: 'new-sub', name: 'New Sub', forms: ['f1'], childOverrides: [], freq: 1, bks: [] });
  assert.equal(grp.items.length, before + 1);
});

test('deleteSubcategory removes an item by id', () => {
  const cats = L.demoCategories();
  const grp = cats[0];
  const idToDelete = grp.items[0].id;
  L.deleteSubcategory(grp, idToDelete);
  assert.ok(!grp.items.find(i => i.id === idToDelete));
});

test('moveSubcategory reorders items within a group', () => {
  const cats = L.demoCategories();
  const grp = cats[0];
  const ids = grp.items.map(i => i.id);
  if (ids.length >= 2) {
    L.moveSubcategory(grp, ids[1], -1);
    assert.equal(grp.items[0].id, ids[1]);
    assert.equal(grp.items[1].id, ids[0]);
  }
});

// ---------------------------------------------------------------------------
// Form-based and child-specific category assignment
// ---------------------------------------------------------------------------
test('childrenForCategory resolves by Form when no overrides present', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const cat = L.findCategory(cats, 'bch'); // forms: ['f56'] -> only jeremiah
  const result = L.childrenForCategory(cat, fs.children);
  assert.deepEqual(result.map(c => c.id), ['jeremiah']);
});

test('childOverrides can add a child not in the Form default', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const cat = L.findCategory(cats, 'bch'); // forms: ['f56']
  cat.childOverrides.push({ childId: 'lucy', included: true });
  const result = L.childrenForCategory(cat, fs.children);
  assert.ok(result.map(c => c.id).includes('lucy'));
  assert.ok(result.map(c => c.id).includes('jeremiah'));
});

test('childOverrides can exclude a child the Form default would include', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const cat = L.findCategory(cats, 'bf'); // forms: all -> everyone by default
  cat.childOverrides.push({ childId: 'charis', included: false });
  const result = L.childrenForCategory(cat, fs.children);
  assert.ok(!result.map(c => c.id).includes('charis'));
  assert.ok(result.map(c => c.id).includes('kayla'));
});

test('book "who" field selects specific children for assignment', () => {
  const cats = L.demoCategories();
  const lit = L.findCategory(cats, 'lit');
  const independentBook = lit.bks.find(b => b.who === 'specific');
  assert.deepEqual(independentBook.whoChildren.sort(), ['jeremiah', 'lucy']);
});

// ---------------------------------------------------------------------------
// Schedule frequency inclusion logic, each frequency type
// ---------------------------------------------------------------------------
test('frequency >=1 (4x/3x/2x/1x per week) always applies', () => {
  [4, 3, 2, 1].forEach(freq => {
    for (let w = 0; w < 10; w++) {
      assert.equal(L.categoryAppliesToWeek(freq, w, { isFirstWeekOfTerm: w === 0 }), true, `freq ${freq} week ${w}`);
    }
  });
});

test('frequency 0.5 (every other week) applies on even content-week indices', () => {
  assert.equal(L.categoryAppliesToWeek(0.5, 0, {}), true);
  assert.equal(L.categoryAppliesToWeek(0.5, 1, {}), false);
  assert.equal(L.categoryAppliesToWeek(0.5, 2, {}), true);
  assert.equal(L.categoryAppliesToWeek(0.5, 3, {}), false);
});

test('frequency 0.25 (1x/term) only applies on first week of term', () => {
  assert.equal(L.categoryAppliesToWeek(0.25, 5, { isFirstWeekOfTerm: true }), true);
  assert.equal(L.categoryAppliesToWeek(0.25, 5, { isFirstWeekOfTerm: false }), false);
});

test('frequency 0.08 (a few times/year) only applies on first week of term', () => {
  assert.equal(L.categoryAppliesToWeek(0.08, 5, { isFirstWeekOfTerm: true }), true);
  assert.equal(L.categoryAppliesToWeek(0.08, 5, { isFirstWeekOfTerm: false }), false);
});

test('buildWeekItems excludes a 1x/term category outside first week of term', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const cat = L.findCategory(cats, 'bch');
  cat.freq = 0.25;
  const itemsFirstWeek = L.buildWeekItems(cats, fs.children, fs.schoolYear, 'jeremiah', 1, 0);
  const itemsLaterWeek = L.buildWeekItems(cats, fs.children, fs.schoolYear, 'jeremiah', 5, 4);
  assert.ok(itemsFirstWeek.some(i => i.catId === 'bch'));
  assert.ok(!itemsLaterWeek.some(i => i.catId === 'bch'));
});

// ---------------------------------------------------------------------------
// Pacing math (calc) and assignment ranges
// ---------------------------------------------------------------------------
test('calc computes sittings available based on freq/days/readingWeeks', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const cat = L.findCategory(cats, 'math'); // freq 4, applies to all (max days = 4, since charis/kayla/lucy=4)
  const result = L.calc(cat, fs.children, fs.schoolYear);
  const expectedReadingWeeks = L.readingWeeksCount(fs.schoolYear);
  assert.equal(result.readingWeeks, expectedReadingWeeks);
  assert.equal(result.s, Math.floor((4 / 4) * 4 * expectedReadingWeeks));
});

test('calc flags co-op categories distinctly', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const cat = L.findCategory(cats, 'sc-up'); // jeremiah only, who has "co-op" in notes
  const result = L.calc(cat, fs.children, fs.schoolYear);
  assert.equal(result.sc, 'b');
});

test('calc does not flag a category as co-op-paced if only some applicable children are co-op', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  // 'bsp' (Personal Spiritual Reading) applies to lucy (not co-op) and jeremiah (co-op) —
  // it should NOT show as co-op-paced overall, since lucy does it at home.
  const cat = L.findCategory(cats, 'bsp');
  const result = L.calc(cat, fs.children, fs.schoolYear);
  assert.notEqual(result.sc, 'b');
});

test('calc marks empty-book categories as "z" (no books yet)', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const cat = L.findCategory(cats, 'hand'); // empty bks
  const result = L.calc(cat, fs.children, fs.schoolYear);
  assert.equal(result.sc, 'z');
});

test('assignmentRangeForSitting produces a page range for the first sitting', () => {
  const book = { t: 'Test Book', tot: 100, per: 5, unitType: 'pages' };
  assert.equal(L.assignmentRangeForSitting(book, 1), 'p.1-5');
  assert.equal(L.assignmentRangeForSitting(book, 2), 'p.6-10');
});

test('assignmentRangeForSitting clamps the final sitting to the book total', () => {
  const book = { t: 'Test Book', tot: 22, per: 5, unitType: 'pages' };
  // sittings needed = ceil(22/5) = 5; last sitting should clamp end to 22
  const last = L.assignmentRangeForSitting(book, 5);
  assert.equal(last, 'p.21-22');
});

test('assignmentRangeForSitting produces a single-unit label when per<=1', () => {
  const book = { t: 'Chapter book', tot: 10, per: 1, unitType: 'chapters' };
  assert.equal(L.assignmentRangeForSitting(book, 3), 'ch.3');
});

// ---------------------------------------------------------------------------
// School-year / exam-week math
// ---------------------------------------------------------------------------
test('examWeeksFor "last-of-term" returns last week of each term', () => {
  const sy = { termsPerYear: 3, weeksPerTerm: 12, examWeekPattern: 'last-of-term' };
  assert.deepEqual(L.examWeeksFor(sy), [12, 24, 36]);
});

test('examWeeksFor "explicit" uses the provided list, sorted', () => {
  const sy = { termsPerYear: 2, weeksPerTerm: 10, examWeekPattern: 'explicit', examWeeks: [10, 5] };
  assert.deepEqual(L.examWeeksFor(sy), [5, 10]);
});

test('readingWeeksCount subtracts exam weeks from total', () => {
  const sy = { termsPerYear: 3, weeksPerTerm: 12, examWeekPattern: 'last-of-term' };
  assert.equal(L.readingWeeksCount(sy), 33);
});

test('termRanges produces correct week ranges per term', () => {
  const sy = { termsPerYear: 3, weeksPerTerm: 12, examWeekPattern: 'last-of-term' };
  const ranges = L.termRanges(sy);
  assert.deepEqual(ranges[1], [1, 12]);
  assert.deepEqual(ranges[2], [13, 24]);
  assert.deepEqual(ranges[3], [25, 36]);
});

// ---------------------------------------------------------------------------
// Backup export/import round trip
// ---------------------------------------------------------------------------
test('freshAppData round-trips through JSON.stringify/parse and stays valid', () => {
  const data = L.freshAppData();
  const json = JSON.stringify(data);
  const parsed = JSON.parse(json);
  const validation = L.validateAppData(parsed);
  assert.equal(validation.valid, true, validation.errors.join('; '));
  assert.deepEqual(parsed.familySetup.children.map(c => c.id), data.familySetup.children.map(c => c.id));
});

test('validateAppData rejects data missing familySetup', () => {
  const bad = { categories: [] };
  const result = L.validateAppData(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('familySetup')));
});

test('validateAppData rejects data missing categories', () => {
  const bad = { familySetup: L.demoFamilySetup() };
  const result = L.validateAppData(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('categories')));
});

test('validateAppData rejects non-object top-level data', () => {
  assert.equal(L.validateAppData(null).valid, false);
  assert.equal(L.validateAppData([1, 2, 3]).valid, false);
  assert.equal(L.validateAppData('a string').valid, false);
});

test('validateAppData rejects malformed children entries', () => {
  const data = L.freshAppData();
  data.familySetup.children.push({ gradeLabel: 'no id or name' });
  const result = L.validateAppData(data);
  assert.equal(result.valid, false);
});

// ---------------------------------------------------------------------------
// Old-data migration / detection
// ---------------------------------------------------------------------------
test('isOldShapeData recognizes a v2-style CATS array', () => {
  const oldData = L.demoCategories(); // plain array of {grp, items}
  assert.equal(L.isOldShapeData(oldData), true);
});

test('isOldShapeData returns false for v3 wrapped data', () => {
  const data = L.freshAppData();
  assert.equal(L.isOldShapeData(data), false);
});

test('isOldShapeData returns false for empty/null/garbage input', () => {
  assert.equal(L.isOldShapeData(null), false);
  assert.equal(L.isOldShapeData([]), false);
  assert.equal(L.isOldShapeData({}), false);
  assert.equal(L.isOldShapeData('garbage'), false);
});

// ---------------------------------------------------------------------------
// Print-view data generation
// ---------------------------------------------------------------------------
test('buildPrintTermData produces one entry per week in the term, marking exam weeks', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const weeks = L.buildPrintTermData(cats, fs.children, fs.schoolYear, 'lucy', 1, 0);
  assert.equal(weeks.length, 12);
  assert.equal(weeks[11].weekNum, 12);
  assert.equal(weeks[11].isExam, true);
  assert.equal(weeks[0].isExam, false);
  assert.ok(weeks[0].items.length > 0);
});

test('buildPrintTermData respects behindWeeks shift without going negative', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const weeks = L.buildPrintTermData(cats, fs.children, fs.schoolYear, 'lucy', 1, 8);
  // week 1 with 8 behind would be content index -8, clamped to 0
  assert.equal(weeks[0].weekNum, 1);
  assert.ok(weeks[0].items.length >= 0);
});

test('buildWeekItems for "all" dedupes categories across children', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const items = L.buildWeekItems(cats, fs.children, fs.schoolYear, 'all', 1, 0);
  const ids = items.map(i => i.catId);
  assert.equal(ids.length, new Set(ids).size);
});

// ---------------------------------------------------------------------------
// Weekly-by-Subject: grouping, audience, co-op/loop visibility
// ---------------------------------------------------------------------------
test('buildWeeklyBySubject groups assignments under their category group', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const out = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 1, 0, {});
  assert.ok(out.length > 0);
  out.forEach(g => assert.ok(typeof g.grp === 'string' && g.grp.length > 0));
});

test('Together/Family book appears exactly once, not duplicated per child', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const mathGrp = cats.find(g => g.grp === 'Math');
  // demo Math book defaults to who:'all' -> normalizeBook resolves audienceType 'together'
  const out = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 1, 0, {});
  const mathOut = out.find(g => g.grp === 'Math');
  assert.equal(mathOut.together.length, 1);
  assert.equal(Object.keys(mathOut.individual).length, 0);
});

test('Individual-audience book appears only under its assigned child(ren)', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const litCat = L.findCategory(cats, 'lit');
  // mark the "Independent literature" book (who:'specific', lucy+jeremiah) as individual audience
  const indepBook = litCat.bks.find(b => b.who === 'specific');
  indepBook.audienceType = 'individual';
  const out = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 1, 0, {});
  const litOut = out.find(g => g.grp === 'Language Arts');
  assert.ok(litOut.individual['lucy'] && litOut.individual['lucy'].length > 0);
  assert.ok(litOut.individual['jeremiah'] && litOut.individual['jeremiah'].length > 0);
  assert.equal(litOut.individual['charis'], undefined);
  assert.equal(litOut.individual['kayla'], undefined);
});

test('co-op/outside books are hidden by default and shown when opts.showCoop is true', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const upperSci = L.findCategory(cats, 'sc-up');
  upperSci.bks[0].audienceType = 'co-op-outside';
  const hidden = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 1, 0, { showCoop: false });
  const shown = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 1, 0, { showCoop: true });
  const hiddenSci = hidden.find(g => g.grp === 'Science + Nature');
  const shownSci = shown.find(g => g.grp === 'Science + Nature');
  assert.equal((hiddenSci && hiddenSci.coop.length) || 0, 0);
  assert.ok(shownSci.coop.length > 0);
});

test('optional-loop books are hidden when opts.hideOptionalLoop is true', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const picStudy = L.findCategory(cats, 'pic');
  picStudy.bks[0].priority = 'optional-loop';
  const withLoop = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 1, 0, { hideOptionalLoop: false });
  const withoutLoop = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 1, 0, { hideOptionalLoop: true });
  const beautyWith = withLoop.find(g => g.grp === 'Beauty Loop');
  const beautyWithout = withoutLoop.find(g => g.grp === 'Beauty Loop');
  const picWith = beautyWith.together.some(it => it.catId === 'pic');
  const picWithout = beautyWithout ? beautyWithout.together.some(it => it.catId === 'pic') : false;
  assert.ok(picWith);
  assert.equal(picWithout, false);
});

// ---------------------------------------------------------------------------
// Daily View
// ---------------------------------------------------------------------------
test('buildDailyView produces one entry per schoolDaysPerWeek day for a child', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const days = L.buildDailyView(cats, fs.children, fs.schoolYear, 1, 0, 'jeremiah', {});
  assert.equal(days.length, 3); // jeremiah has schoolDaysPerWeek: 3
});

test('a 2x/week category does not appear on every day of a 4-day week', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  // grammar ('gr') is freq:2, applies to charis? no (f2/f34/f56) - use kayla? kayla is f1.
  // Use 'am-story' (American History Story, freq:2, forms f2/f34) - none of demo kids are f2; add one.
  L.addChild(fs, { id: 'testkid', name: 'Test', gradeLabel: '5th', formId: 'f2', schoolDaysPerWeek: 4, notes: '' });
  const days = L.buildDailyView(cats, fs.children, fs.schoolYear, 1, 0, 'testkid', {});
  assert.equal(days.length, 4);
  let daysWithAmStory = 0;
  days.forEach(d => {
    d.groups.forEach(g => {
      if (g.items.some(it => it.catId === 'am-story')) daysWithAmStory++;
    });
  });
  assert.ok(daysWithAmStory < 4, 'a 2x/week category should not appear on all 4 days');
  assert.ok(daysWithAmStory > 0);
});

test('pickDaySlots never exceeds totalDays and respects occurrence count', () => {
  assert.deepEqual(L.pickDaySlots(4, 4), [1, 2, 3, 4]);
  assert.ok(L.pickDaySlots(4, 2).length <= 2);
  assert.ok(L.pickDaySlots(3, 10).length <= 3);
});

// ---------------------------------------------------------------------------
// Book-level scheduling: startWeek/endWeek bounds, status, rebalancing
// ---------------------------------------------------------------------------
test('bookActiveForWeek respects startWeek/endWeek bounds', () => {
  const book = { t: 'Test', tot: 100, per: 5, startWeek: 5, endWeek: 10 };
  assert.equal(L.bookActiveForWeek(book, 3), false);
  assert.equal(L.bookActiveForWeek(book, 5), true);
  assert.equal(L.bookActiveForWeek(book, 10), true);
  assert.equal(L.bookActiveForWeek(book, 11), false);
});

test('startWeek/endWeek bound generated weekly assignments', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const mathCat = L.findCategory(cats, 'math');
  mathCat.bks[0].startWeek = 10;
  mathCat.bks[0].endWeek = 20;
  const before = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 5, 4, {});
  const during = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 12, 11, {});
  const after = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 25, 24, {});
  const mathBefore = before.find(g => g.grp === 'Math');
  const mathDuring = during.find(g => g.grp === 'Math');
  const mathAfter = after.find(g => g.grp === 'Math');
  assert.equal(mathBefore, undefined);
  assert.ok(mathDuring && mathDuring.together.length > 0);
  assert.equal(mathAfter, undefined);
});

test('paused books are excluded until pauseUntilWeek, then resume', () => {
  const book = { t: 'Test', tot: 100, per: 5, status: 'paused', pauseUntilWeek: 8 };
  assert.equal(L.bookActiveForWeek(book, 5), false);
  assert.equal(L.bookActiveForWeek(book, 8), true);
  assert.equal(L.bookActiveForWeek(book, 20), true);
});

test('dropped and finished books are excluded from all weeks', () => {
  const dropped = { t: 'Test', tot: 100, per: 5, status: 'dropped' };
  const finished = { t: 'Test', tot: 100, per: 5, status: 'finished' };
  assert.equal(L.bookActiveForWeek(dropped, 1), false);
  assert.equal(L.bookActiveForWeek(finished, 1), false);
});

test('autoSchedule:false excludes a book from generation entirely', () => {
  const book = { t: 'Test', tot: 100, per: 5, autoSchedule: false };
  assert.equal(L.bookActiveForWeek(book, 1), false);
});

test('rebalanceBookFromProgress recomputes per-sitting pace from remaining units', () => {
  const book = { t: 'Test', tot: 100, per: 5, currentUnit: 40 };
  L.rebalanceBookFromProgress(book, 10, 19, 1); // 10 weeks, 1 sitting/week = 10 sittings
  assert.equal(book.per, 6); // 60 remaining / 10 sittings
  assert.equal(book.startWeek, 10);
  assert.equal(book.endWeek, 19);
});

test('finishBookByWeek rebalances to land exactly on the target week', () => {
  const book = { t: 'Test', tot: 90, per: 3, currentUnit: 0 };
  L.finishBookByWeek(book, 9, 1, 1); // weeks 1-9, 1 sitting/wk = 9 sittings
  assert.equal(book.endWeek, 9);
  assert.equal(book.per, 10); // 90 / 9
});

test('dropBookRemaining marks status dropped', () => {
  const book = { t: 'Test', tot: 90, per: 3, status: 'active' };
  L.dropBookRemaining(book);
  assert.equal(book.status, 'dropped');
});

test('pauseBookUntilWeek sets status and resume week', () => {
  const book = { t: 'Test', tot: 90, per: 3, status: 'active' };
  L.pauseBookUntilWeek(book, 15);
  assert.equal(book.status, 'paused');
  assert.equal(book.pauseUntilWeek, 15);
});

test('moveBookToCategory moves a book between categories', () => {
  const cats = L.demoCategories();
  const fromCat = L.findCategory(cats, 'math');
  const toCat = L.findCategory(cats, 'gr');
  const beforeFrom = fromCat.bks.length, beforeTo = toCat.bks.length;
  L.moveBookToCategory(cats, 'math', 'gr', 0);
  assert.equal(fromCat.bks.length, beforeFrom - 1);
  assert.equal(toCat.bks.length, beforeTo + 1);
});

// ---------------------------------------------------------------------------
// Manual overrides: survive regeneration, distinguishable from generated
// ---------------------------------------------------------------------------
test('a manual override replaces the generated text for that book/week', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const overrides = {};
  L.setOverride(overrides, 'math#0', 5, null, 'Math: Custom lesson note for week 5');
  const out = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 5, 4, { overrides });
  const mathOut = out.find(g => g.grp === 'Math');
  assert.equal(mathOut.together[0].text, 'Math: Custom lesson note for week 5');
  assert.equal(mathOut.together[0].manual, true);
});

test('manual overrides survive regeneration (calling buildWeeklyBySubject again)', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const overrides = {};
  L.setOverride(overrides, 'math#0', 5, null, 'Manual note');
  L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 5, 4, { overrides });
  // second "regeneration" call with the same overrides object
  const out2 = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 5, 4, { overrides });
  const mathOut = out2.find(g => g.grp === 'Math');
  assert.equal(mathOut.together[0].text, 'Manual note');
});

test('resetGeneratedOverrides clears all overrides, restoring generated text', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const overrides = {};
  L.setOverride(overrides, 'math#0', 5, null, 'Manual note');
  L.resetGeneratedOverrides(overrides);
  const out = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 5, 4, { overrides });
  const mathOut = out.find(g => g.grp === 'Math');
  assert.notEqual(mathOut.together[0].text, 'Manual note');
  assert.equal(mathOut.together[0].manual, false);
});

test('skipBookForWeek marks a week as skipped via an empty-string override', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const overrides = {};
  L.skipBookForWeek(overrides, 'math#0', 5);
  const out = L.buildWeeklyBySubject(cats, fs.children, fs.schoolYear, 5, 4, { overrides });
  const mathOut = out.find(g => g.grp === 'Math');
  assert.ok(/skipped this week/.test(mathOut.together[0].text));
});

// ---------------------------------------------------------------------------
// Loops & Rhythm
// ---------------------------------------------------------------------------
test('addLoop/renameLoop/deleteLoop/moveLoop manage the loops array', () => {
  let loops = [];
  loops = L.addLoop(loops, { name: 'Bible Loop' });
  loops = L.addLoop(loops, { name: 'Reading Loop' });
  assert.equal(loops.length, 2);
  const id1 = loops[0].id;
  loops = L.renameLoop(loops, id1, 'Faith Loop');
  assert.equal(loops[0].name, 'Faith Loop');
  loops = L.moveLoop(loops, id1, 1);
  assert.equal(loops[1].name, 'Faith Loop');
  loops = L.deleteLoop(loops, id1);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].name, 'Reading Loop');
});

test('addLoopItem/removeLoopItem/moveLoopItem manage items within a loop', () => {
  let loops = L.addLoop([], { name: 'Loop A' });
  const loopId = loops[0].id;
  loops = L.addLoopItem(loops, loopId, { targetType: 'custom', customText: 'Item 1' });
  loops = L.addLoopItem(loops, loopId, { targetType: 'custom', customText: 'Item 2' });
  assert.equal(loops[0].items.length, 2);
  const item1Id = loops[0].items[0].id;
  loops = L.moveLoopItem(loops, loopId, item1Id, 1);
  assert.equal(loops[0].items[1].customText, 'Item 1');
  loops = L.removeLoopItem(loops, loopId, item1Id);
  assert.equal(loops[0].items.length, 1);
  assert.equal(loops[0].items[0].customText, 'Item 2');
});

test('updateLoopItem sets target type, audience tags, and custom fields', () => {
  let loops = L.addLoop([], { name: 'Loop A' });
  const loopId = loops[0].id;
  loops = L.addLoopItem(loops, loopId, { targetType: 'custom', customText: 'X' });
  const itemId = loops[0].items[0].id;
  loops = L.updateLoopItem(loops, loopId, itemId, { targetType: 'task', taskLabel: 'Tidy desk', tags: { attention: 'light', mode: 'hands-on', setting: 'independent' } });
  const item = loops[0].items[0];
  assert.equal(item.targetType, 'task');
  assert.equal(item.taskLabel, 'Tidy desk');
  assert.deepEqual(item.tags, { attention: 'light', mode: 'hands-on', setting: 'independent' });
});

test('loopTemplates exposes Simple CM Rhythm, Expanded Family Rhythm, and Custom Blank', () => {
  const tpls = L.loopTemplates();
  const ids = tpls.map(t => t.id);
  assert.ok(ids.includes('simple-cm'));
  assert.ok(ids.includes('expanded-family'));
  assert.ok(ids.includes('blank'));
  const blank = tpls.find(t => t.id === 'blank');
  assert.equal(blank.loops.length, 0);
});

test('applyLoopTemplate matches existing subcategories by name into loop items', () => {
  const cats = L.demoCategories();
  const loops = L.applyLoopTemplate(cats, 'simple-cm');
  assert.equal(loops.length, 3);
  const loopA = loops.find(l => /Language Arts/.test(l.name));
  assert.ok(loopA.items.length > 0);
  const grammarItem = loopA.items.find(i => i.targetType === 'subcategory');
  assert.ok(grammarItem);
  const cat = L.findCategory(cats, grammarItem.targetCatId);
  assert.ok(cat);
});

test('applyLoopTemplate falls back to a custom item when no subcategory name matches', () => {
  const cats = [{ grp: 'Empty', col: '#000', items: [] }];
  const loops = L.applyLoopTemplate(cats, 'simple-cm');
  const loopA = loops.find(l => /Language Arts/.test(l.name));
  assert.ok(loopA.items.every(i => i.targetType === 'custom'));
});

test('nextBookForSubcategory round-robins across a subcategory\'s books via queueCursor', () => {
  const cat = { id: 'c1', bks: [{ t: 'Book 1', tot: 10, per: 1, unitType: 'chapters' }, { t: 'Book 2', tot: 10, per: 1, unitType: 'chapters' }] };
  let next = L.nextBookForSubcategory(cat);
  assert.equal(next.t, 'Book 1');
  L.advanceSubcategoryQueue(cat);
  next = L.nextBookForSubcategory(cat);
  assert.equal(next.t, 'Book 2');
  L.advanceSubcategoryQueue(cat);
  next = L.nextBookForSubcategory(cat);
  assert.equal(next.t, 'Book 1');
});

test('advanceBookQueue moves currentUnit forward by per, clamped to tot', () => {
  const book = { t: 'B', tot: 5, per: 2, unitType: 'pages', currentUnit: 0 };
  L.advanceBookQueue(book);
  assert.equal(book.currentUnit, 2);
  L.advanceBookQueue(book);
  assert.equal(book.currentUnit, 4);
  L.advanceBookQueue(book);
  assert.equal(book.currentUnit, 5); // clamped to tot, not 6
});

test('resolveLoopItemAssignment for a subcategory item pulls the next book and unit range', () => {
  const cats = [{ grp: 'Bible', col: '#000', items: [
    { id: 'bf', name: 'Bible — Family', forms: [], childOverrides: [], freq: 4, bks: [
      { t: 'Matthew', tot: 28, per: 1, unitType: 'chapters', currentUnit: 0 }
    ] }
  ] }];
  const item = L.normalizeLoopItem({ id: 'i1', targetType: 'subcategory', targetCatId: 'bf' });
  const resolved = L.resolveLoopItemAssignment(item, cats, 1);
  assert.ok(/Bible — Family/.test(resolved.text));
  assert.ok(/Matthew/.test(resolved.text));
  assert.ok(/ch\.1/.test(resolved.text));
});

test('resolveLoopItemAssignment for a task item shows the task label; custom item shows custom text', () => {
  const taskItem = L.normalizeLoopItem({ id: 'i1', targetType: 'task', taskLabel: 'Memory work' });
  assert.equal(L.resolveLoopItemAssignment(taskItem, [], 1).text, 'Memory work');
  const customItem = L.normalizeLoopItem({ id: 'i2', targetType: 'custom', customText: 'Family read-aloud' });
  assert.equal(L.resolveLoopItemAssignment(customItem, [], 1).text, 'Family read-aloud');
});

test('advanceLoopAndQueue advances both the book/subcategory queue and the loop cursor', () => {
  const cats = [{ grp: 'Bible', col: '#000', items: [
    { id: 'bf', name: 'Bible — Family', forms: [], childOverrides: [], freq: 4, bks: [
      { t: 'Matthew', tot: 28, per: 1, unitType: 'chapters', currentUnit: 0 },
      { t: 'Psalms', tot: 10, per: 1, unitType: 'chapters', currentUnit: 0 }
    ] }
  ] }];
  let loops = L.addLoop([], { name: 'Bible Loop' });
  loops = L.addLoopItem(loops, loops[0].id, { targetType: 'subcategory', targetCatId: 'bf' });
  loops = L.addLoopItem(loops, loops[0].id, { targetType: 'task', taskLabel: 'Prayer' });
  const loop = loops[0];
  const item = loop.items[0];
  L.advanceLoopAndQueue(loop, item, cats, 1);
  assert.equal(cats[0].items[0].bks[0].currentUnit, 1); // book queue advanced
  assert.equal(cats[0].items[0].queueCursor, 1); // subcategory round-robin advanced
  assert.equal(loop.cursor, 1); // loop moved to its next slot
});

test('loopAppliesToChild filters by together/form/child/custom-group audience', () => {
  const children = [
    { id: 'a', formId: 'f1' },
    { id: 'b', formId: 'f2' }
  ];
  assert.equal(L.loopAppliesToChild({ audience: { type: 'together' } }, 'a', children), true);
  assert.equal(L.loopAppliesToChild({ audience: { type: 'form', value: 'f1' } }, 'a', children), true);
  assert.equal(L.loopAppliesToChild({ audience: { type: 'form', value: 'f1' } }, 'b', children), false);
  assert.equal(L.loopAppliesToChild({ audience: { type: 'child', value: 'a' } }, 'b', children), false);
  assert.equal(L.loopAppliesToChild({ audience: { type: 'custom-group', value: ['a', 'b'] } }, 'b', children), true);
});

test('buildLoopDailySlots shows only the current item per loop, not every book in the loop', () => {
  const cats = [{ grp: 'Bible', col: '#000', items: [
    { id: 'bf', name: 'Bible — Family', forms: [], childOverrides: [], freq: 4, bks: [
      { t: 'Matthew', tot: 28, per: 1, unitType: 'chapters', currentUnit: 0 }
    ] }
  ] }];
  let loops = L.addLoop([], { name: 'Bible Loop' });
  loops = L.addLoopItem(loops, loops[0].id, { targetType: 'subcategory', targetCatId: 'bf' });
  loops = L.addLoopItem(loops, loops[0].id, { targetType: 'task', taskLabel: 'Prayer' });
  const slots = L.buildLoopDailySlots(loops, cats, [], 'all', 1);
  assert.equal(slots.length, 1); // one slot per loop, current item only
  assert.ok(/Matthew/.test(slots[0].text));
});

test('buildLoopDailySlots excludes loops whose audience does not apply to the requested child', () => {
  const children = [{ id: 'lucy', formId: 'f34' }, { id: 'kayla', formId: 'f1' }];
  let loops = L.addLoop([], { name: 'Older Loop', audience: { type: 'child', value: 'lucy' } });
  loops = L.addLoopItem(loops, loops[0].id, { targetType: 'custom', customText: 'Latin' });
  const forLucy = L.buildLoopDailySlots(loops, [], children, 'lucy', 1);
  const forKayla = L.buildLoopDailySlots(loops, [], children, 'kayla', 1);
  assert.equal(forLucy.length, 1);
  assert.equal(forKayla.length, 0);
});

// ---------------------------------------------------------------------------
// Scheduling method: direct-frequency vs loop-rotation vs fixed-days vs manual
// ---------------------------------------------------------------------------
test('Daily Math (direct-frequency, 4x/wk) schedules itself without any loop', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories(); // Math is freq:4, scheduleStyle defaults to direct-frequency
  const days = L.buildDailyView(cats, fs.children, fs.schoolYear, 5, 4, 'all', {});
  const mathDays = days.filter(d => d.groups.some(g => g.grp === 'Math'));
  assert.equal(mathDays.length, days.length); // 4x/wk shows every school day
});

test('2x/week Foreign Language schedules itself without any loop', () => {
  const fs = L.demoFamilySetup();
  const cats = L.demoCategories();
  const flang = L.findCategory(cats, 'flang');
  flang.freq = 2; // ensure 2x/week regardless of demo defaults
  const days = L.buildDailyView(cats, fs.children, fs.schoolYear, 5, 4, 'all', {});
  const flangDays = days.filter(d => d.groups.some(g => g.items.some(it => /Foreign Language/.test(it.text))));
  assert.equal(flangDays.length, 2);
});

test('Beauty Loop rotates one item per loop slot, not every item at once', () => {
  const cats = [{ grp: 'Beauty Loop', col: '#000', items: [
    { id: 'pic', name: 'Picture Study', forms: [], childOverrides: [], freq: 1, bks: [{ t: 'Artist rotation', tot: 3, per: 1, unitType: 'lessons', currentUnit: 0, scheduleStyle: 'loop-rotation' }] },
    { id: 'comp', name: 'Composer Study', forms: [], childOverrides: [], freq: 1, bks: [{ t: 'Composer rotation', tot: 3, per: 1, unitType: 'lessons', currentUnit: 0, scheduleStyle: 'loop-rotation' }] },
    { id: 'folk', name: 'Folk Song', forms: [], childOverrides: [], freq: 1, bks: [{ t: 'Folk song rotation', tot: 3, per: 1, unitType: 'lessons', currentUnit: 0, scheduleStyle: 'loop-rotation' }] }
  ] }];
  let loops = L.addLoop([], { name: 'Beauty Loop' });
  loops = L.addLoopItem(loops, loops[0].id, { targetType: 'subcategory', targetCatId: 'pic' });
  loops = L.addLoopItem(loops, loops[0].id, { targetType: 'subcategory', targetCatId: 'comp' });
  loops = L.addLoopItem(loops, loops[0].id, { targetType: 'subcategory', targetCatId: 'folk' });
  const slots = L.buildLoopDailySlots(loops, cats, [], 'all', 1);
  assert.equal(slots.length, 1); // one slot for the whole loop, not 3
  assert.ok(/Picture Study/.test(slots[0].text));
});

test('Bible Loop rotates one item (Matthew, then Psalms, then Hymn Study) per slot', () => {
  const cats = [{ grp: 'Bible + Faith', col: '#000', items: [
    { id: 'matt', name: 'Matthew', forms: [], childOverrides: [], freq: 1, bks: [{ t: 'Matthew', tot: 28, per: 1, unitType: 'chapters', currentUnit: 0, scheduleStyle: 'loop-rotation' }] },
    { id: 'psalms', name: 'Psalms + Proverbs', forms: [], childOverrides: [], freq: 1, bks: [{ t: 'Psalms', tot: 66, per: 1, unitType: 'chapters', currentUnit: 0, scheduleStyle: 'loop-rotation' }] },
    { id: 'hymn', name: 'Hymn Study', forms: [], childOverrides: [], freq: 1, bks: [{ t: 'Hymn rotation', tot: 9, per: 1, unitType: 'lessons', currentUnit: 0, scheduleStyle: 'loop-rotation' }] }
  ] }];
  let loops = L.addLoop([], { name: 'Bible Loop' });
  const loopId = loops[0].id;
  loops = L.addLoopItem(loops, loopId, { targetType: 'subcategory', targetCatId: 'matt' });
  loops = L.addLoopItem(loops, loopId, { targetType: 'subcategory', targetCatId: 'psalms' });
  loops = L.addLoopItem(loops, loopId, { targetType: 'subcategory', targetCatId: 'hymn' });
  const loop = loops[0];

  let slots = L.buildLoopDailySlots(loops, cats, [], 'all', 1);
  assert.ok(/Matthew/.test(slots[0].text));
  L.advanceLoopAndQueue(loop, loop.items[loop.cursor % loop.items.length], cats, 1);

  slots = L.buildLoopDailySlots(loops, cats, [], 'all', 1);
  assert.ok(/Psalms/.test(slots[0].text));
  L.advanceLoopAndQueue(loop, loop.items[loop.cursor % loop.items.length], cats, 1);

  slots = L.buildLoopDailySlots(loops, cats, [], 'all', 1);
  assert.ok(/Hymn/.test(slots[0].text));
});

test('Direct-frequency items never appear in Needs Loop Assignment', () => {
  const cats = L.demoCategories(); // all demo books default to scheduleStyle 'direct-frequency'
  const needing = L.findBooksNeedingLoopAssignment(cats);
  assert.equal(needing.length, 0);
});

test('Loop-rotation items appear in Needs Loop Assignment only when no loop resolves', () => {
  const cats = [{ grp: 'Beauty Loop', col: '#000', defaultLoopId: null, items: [
    { id: 'pic', name: 'Picture Study', forms: [], childOverrides: [], freq: 1,
      bks: [{ t: 'Artist rotation', tot: 3, per: 1, unitType: 'lessons', scheduleStyle: 'loop-rotation', loopId: null }] }
  ] }];
  // No loopId anywhere yet -> needs assignment.
  let needing = L.findBooksNeedingLoopAssignment(cats);
  assert.equal(needing.length, 1);
  assert.equal(needing[0].title, 'Artist rotation');

  // Book-level loopId resolves it.
  cats[0].items[0].bks[0].loopId = 'loop_abc';
  needing = L.findBooksNeedingLoopAssignment(cats);
  assert.equal(needing.length, 0);

  // Subcategory-level default also resolves it, even without a book-level id.
  cats[0].items[0].bks[0].loopId = null;
  cats[0].items[0].defaultLoopId = 'loop_xyz';
  needing = L.findBooksNeedingLoopAssignment(cats);
  assert.equal(needing.length, 0);

  // Group-level default also resolves it.
  cats[0].items[0].defaultLoopId = null;
  cats[0].defaultLoopId = 'loop_grp';
  needing = L.findBooksNeedingLoopAssignment(cats);
  assert.equal(needing.length, 0);
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log('  ok - ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL - ' + name);
    console.log('    ' + (err && err.message ? err.message : err));
  }
}
console.log('');
console.log(passed + ' passed, ' + failed + ' failed, ' + tests.length + ' total');
if (failed > 0) process.exit(1);
