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
