// lib/plannerFromPlan.mjs — building one learner's dated week from the plan.
//
// Run with:  node tests/plannerFromPlan.test.mjs
//
// Every fixture here is made up and neutral: no real learner's name, no real
// subject, no real outside commitment. Day capacities are built from the
// capacity model itself (resolveDayCapacity's own vocabulary), never from a
// name or a hardcoded list of days.
//
// NOTE on this file's shape: the test runner loop lives at the very BOTTOM, so
// a test added anywhere above it still runs. (Some older suites in this repo
// run their loop part-way down the file, which silently skips anything after.)

import {
  buildStudentWeek, listPlannableStudents, schoolDaysForStudent, describeUnresolved
} from '../lib/plannerFromPlan.mjs';
import { normalizeState } from '../lib/plannerSpread.mjs';
import { makeStudent } from '../lib/familyMap.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg || 'not equal') + '\n  got:      ' + sa + '\n  expected: ' + sb);
}

// ---------------------------------------------------------------------------
// Fixture — a small, made-up plan
// ---------------------------------------------------------------------------
// One learner whose Wednesday and Friday are OFF and whose Thursday is a light
// independent day. Built from the capacity model's own ids.
function makeLearner(fields) {
  return makeStudent(Object.assign({
    id: 'learner_one',
    name: 'Wren',
    active: true,
    dayCapacity: { mon: 'full', tue: 'full', wed: 'off', thu: 'light-independent', fri: 'off' }
  }, fields || {}));
}

function fixture(overrides) {
  const base = {
    appStateVersion: 1,
    students: [makeLearner(), makeStudent({ id: 'learner_two', name: 'Ash', sortOrder: 1 })],
    groups: [{ id: 'grp_both', label: 'Both Learners', studentIds: ['learner_one', 'learner_two'] }],
    subjectColumns: [{ id: 'col_a', label: 'Column A', visible: true, sortOrder: 0 }],
    cards: [
      {
        id: 'card_one', title: 'Strand One', subjectColumnId: 'col_a',
        audience: 'individual', participantMode: 'individual', participantIds: ['learner_one']
      },
      {
        id: 'card_two', title: 'Strand Two', subjectColumnId: 'col_a',
        audience: 'group', participantMode: 'group', participantIds: ['grp_both']
      }
    ],
    loops: [
      {
        id: 'loop_one', title: 'Bucket One', audience: 'group', participantMode: 'group',
        participantIds: ['grp_both'], itemIds: ['item_a', 'item_b'], currentItemId: 'item_a'
      }
    ],
    loopItems: [
      { id: 'item_a', loopId: 'loop_one', title: 'First Item' },
      { id: 'item_b', loopId: 'loop_one', title: 'Second Item' }
    ],
    sequences: [
      {
        id: 'seq_one', title: 'Series One', audience: 'group', participantMode: 'group',
        participantIds: ['grp_both'], itemIds: [], currentItemId: null
      }
    ],
    sequenceItems: [],
    resources: [],
    resourceUses: [],
    weeklyRhythm: {
      id: 'rhythm_one',
      title: 'Our Weekly Rhythm',
      days: [
        { id: 'rd1', label: 'Day 1', sortOrder: 0, dateMode: 'day-number' },
        { id: 'rd2', label: 'Day 2', sortOrder: 1, dateMode: 'day-number' },
        { id: 'rd3', label: 'Day 3', sortOrder: 2, dateMode: 'day-number' },
        { id: 'rd4', label: 'Day 4', sortOrder: 3, dateMode: 'day-number' }
      ],
      blocks: [
        { id: 'blk_morning', label: 'Morning', sortOrder: 0 },
        { id: 'blk_afternoon', label: 'Afternoon', sortOrder: 1 }
      ],
      assignments: [
        { id: 'as1', dayId: 'rd1', blockId: 'blk_morning', label: 'Strand One', assignmentType: 'card', referencedId: 'card_one', sortOrder: 0 },
        { id: 'as2', dayId: 'rd1', blockId: 'blk_morning', label: 'Bucket One', assignmentType: 'loop', referencedId: 'loop_one', sortOrder: 1 },
        { id: 'as3', dayId: 'rd2', blockId: 'blk_afternoon', label: 'Series One', assignmentType: 'sequence', referencedId: 'seq_one', sortOrder: 0 },
        { id: 'as4', dayId: 'rd4', blockId: 'blk_morning', label: 'Strand Two', assignmentType: 'card', referencedId: 'card_two', sortOrder: 0 }
      ]
    }
  };
  return Object.assign(base, overrides || {});
}

const MON = '2026-03-02';   // a plain Monday

// ---------------------------------------------------------------------------
// School days come from the learner's own capacity model
// ---------------------------------------------------------------------------
test('days the learner has marked off are not school days, and the rest are', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  eq(week.schoolDays, { mon: true, tue: true, wed: false, thu: true, fri: false, sat: false },
    'school days should follow the capacity model exactly');
});

test('a light independent day still counts as a school day', () => {
  const sd = schoolDaysForStudent(makeLearner());
  assert(sd.thu === true, 'a light day is still a day work happens on');
});

test('Sunday is never a school day, and Saturday is not offered by the plan', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  assert(!('sun' in week.schoolDays), 'the planner model has no Sunday flag at all');
  assert(week.schoolDays.sat === false, 'the plan deals in Monday to Friday');
});

test('a learner with every weekday off gets no school days', () => {
  const allOff = makeLearner({
    dayCapacity: { mon: 'off', tue: 'off', wed: 'off', thu: 'off', fri: 'off' }
  });
  eq(schoolDaysForStudent(allOff), { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false });
});

// ---------------------------------------------------------------------------
// Generic week -> real dates
// ---------------------------------------------------------------------------
test('the generic rhythm days land on the real dates of the chosen week', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  const byTitle = {};
  week.tasks.forEach(t => { byTitle[t.title] = t.date; });
  eq(byTitle['Strand One'], '2026-03-02', 'the first rhythm day is the Monday');
  eq(byTitle['Series One'], '2026-03-03', 'the second rhythm day is the Tuesday');
  eq(byTitle['Strand Two'], '2026-03-05', 'the fourth rhythm day is the Thursday');
});

test('a week that crosses a month boundary still lands on the right dates', () => {
  // Monday 2026-03-30 — the fourth rhythm day falls in April.
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: '2026-03-30' });
  const dates = week.tasks.map(t => t.date).sort();
  assert(dates.indexOf('2026-03-30') > -1, 'Monday is the 30th of March');
  assert(dates.indexOf('2026-04-02') > -1, 'the fourth day runs over into April');
});

test('a week containing a daylight-saving change does not slip a day', () => {
  // US DST begins Sunday 2026-03-08; this week starts the next morning, and
  // the week before contains the change at its far end.
  const after = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: '2026-03-09' });
  const datesAfter = after.tasks.map(t => t.date);
  assert(datesAfter.indexOf('2026-03-09') > -1 && datesAfter.indexOf('2026-03-12') > -1,
    'the week after the clock change maps Monday to Thursday exactly');
  // And the European change, Sunday 2026-03-29.
  const euro = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: '2026-03-23' });
  const datesEuro = euro.tasks.map(t => t.date);
  assert(datesEuro.indexOf('2026-03-23') > -1 && datesEuro.indexOf('2026-03-26') > -1,
    'a week ending at a clock change maps Monday to Thursday exactly');
});

test('any day given in the middle of a week is read as that week', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: '2026-03-04' });
  eq(week.weekStartDate, MON, 'a Wednesday belongs to the week that began on Monday');
});

// ---------------------------------------------------------------------------
// Loop buckets
// ---------------------------------------------------------------------------
test('a loop bucket becomes exactly one line, and never invents which item comes up', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  const loopLines = week.tasks.filter(t => /Bucket One/.test(t.title));
  eq(loopLines.length, 1, 'one line per loop assignment, not one per item');
  eq(loopLines[0].title, 'Bucket One — next item');
  const all = JSON.stringify(week);
  assert(!/First Item|Second Item/.test(all), 'no loop item is ever named');
});

test('every line reads in the words of the plan, with no ids on it', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  week.tasks.forEach(t => {
    assert(t.title && t.title.trim() !== '', 'a line is never blank');
    assert(!/card_|loop_|seq_|learner_|_one\b(?!\w)/.test(t.title) || !/_/.test(t.title),
      'a line never shows an id: ' + t.title);
    eq(t.who, 'Wren', 'the line says whose work it is');
    eq(t.sourceLabel, 'From your Weekly Rhythm');
  });
});

// ---------------------------------------------------------------------------
// Something the plan no longer holds
// ---------------------------------------------------------------------------
test('a rhythm line pointing at something no longer in the plan is left off and reported', () => {
  const state = fixture();
  state.weeklyRhythm.assignments.push({
    id: 'as_dangling', dayId: 'rd2', blockId: 'blk_morning',
    label: 'Strand Three', assignmentType: 'card', referencedId: 'card_gone', sortOrder: 9
  });
  const week = buildStudentWeek(state, { studentId: 'learner_one', weekStartDate: MON });
  assert(!JSON.stringify(week).includes('card_gone'), 'the id is never rendered');
  assert(!week.tasks.some(t => t.title === 'Strand Three'), 'the line is left off, not shown blank');
  assert(week.report.unresolved.length === 1, 'exactly one quiet note about it');
  assert(week.report.counts.skipped === 1, 'it is counted as left off');
});

test('the quiet note is plain language, with no ids and no alarming words', () => {
  const state = fixture();
  state.weeklyRhythm.assignments.push({
    id: 'as_nowhere', dayId: 'rd_unknown', blockId: 'blk_morning',
    label: 'Strand Four', assignmentType: 'card', referencedId: 'card_one', sortOrder: 9
  });
  const week = buildStudentWeek(state, { studentId: 'learner_one', weekStartDate: MON });
  const note = describeUnresolved(week.report);
  assert(note.length > 0, 'something is said');
  assert(!/error|invalid|failed|conflict|violation|missing|required/i.test(note),
    'the note never speaks in those words: ' + note);
  assert(!/rd_unknown|card_|_id\b/.test(note), 'the note never shows an id: ' + note);
});

// ---------------------------------------------------------------------------
// Capacity is respected without anything being dropped
// ---------------------------------------------------------------------------
test('work that does not really fit a light day is still placed, with a gentle note', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  const thursday = week.tasks.filter(t => t.date === '2026-03-05');
  assert(thursday.length === 1, 'the Thursday line is placed, not dropped');
  eq(thursday[0].capacityNote, 'This is a light independent day');
  assert(week.report.counts.withNotes === 1, 'the note is counted');
});

test('a note never reads as a problem, and never persists', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  const noted = week.tasks.find(t => t.capacityNote);
  assert(!/error|invalid|conflict|violation|must|not allowed/i.test(noted.capacityNote),
    'the note is in the parent\'s own register');
  assert(!JSON.stringify(week).includes('capacityNote'), 'a note can never reach saved JSON');
  assert(Object.keys(noted).indexOf('capacityNote') === -1, 'the note is non-enumerable');
});

// ---------------------------------------------------------------------------
// Purity and persistence
// ---------------------------------------------------------------------------
test('the plan passed in is left deeply unchanged', () => {
  const state = fixture();
  const before = JSON.stringify(state);
  buildStudentWeek(state, { studentId: 'learner_one', weekStartDate: MON });
  buildStudentWeek(state, { studentId: 'learner_two', weekStartDate: '2026-04-06' });
  listPlannableStudents(state);
  eq(JSON.stringify(state), before, 'nothing in the saved plan may be touched');
});

test('the report is non-enumerable and absent from the saved shape', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  assert(week.report && typeof week.report === 'object', 'the report can be read on screen');
  assert(Object.keys(week).indexOf('report') === -1, 'the report is non-enumerable');
  const json = JSON.stringify(week);
  assert(!json.includes('report'), 'the report never reaches saved JSON');
  assert(!json.includes('unresolved') && !json.includes('studentName') && !json.includes('counts'),
    'nothing derived reaches saved JSON');
});

test('the saved shape holds exactly the planner spread\'s own fields', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  eq(Object.keys(week), ['schemaVersion', 'weekStartDate', 'schoolDays', 'tasks', 'lastShift']);
  eq(week.lastShift, null, 'a freshly generated week has nothing to undo yet');
  week.tasks.forEach(t => {
    eq(Object.keys(t), ['id', 'title', 'who', 'date', 'order', 'done', 'sourceLabel']);
  });
});

test('the planner spread accepts the generated week unchanged', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  const normalized = normalizeState(week);
  eq(JSON.stringify(normalized), JSON.stringify(week),
    'normalizeState should have nothing left to fix');
});

test('lines are numbered from zero within each day', () => {
  const week = buildStudentWeek(fixture(), { studentId: 'learner_one', weekStartDate: MON });
  const monday = week.tasks.filter(t => t.date === MON).map(t => t.order).sort();
  eq(monday, [0, 1], 'the two Monday lines are in written order');
});

// ---------------------------------------------------------------------------
// Tolerance
// ---------------------------------------------------------------------------
test('an empty plan produces an empty week rather than throwing', () => {
  const week = buildStudentWeek({}, { studentId: 'learner_one', weekStartDate: MON });
  eq(week.tasks, []);
  assert(week.report.unresolved.length > 0, 'and says plainly that there is nothing to read');
});

test('a plan with no weekly rhythm at all produces an empty week', () => {
  const state = fixture();
  delete state.weeklyRhythm;
  const week = buildStudentWeek(state, { studentId: 'learner_one', weekStartDate: MON });
  eq(week.tasks, []);
  eq(week.schoolDays.wed, false, 'the learner\'s own days still come through');
});

test('missing students, missing arrays and bad arguments are all tolerated', () => {
  eq(listPlannableStudents(undefined), []);
  eq(listPlannableStudents({}), []);
  eq(listPlannableStudents({ students: 'not a list' }), []);
  const nothing = buildStudentWeek(undefined, undefined);
  eq(nothing.tasks, []);
  assert(typeof nothing.weekStartDate === 'string', 'a week start is always a date string');
  const noWeek = buildStudentWeek(fixture(), { studentId: 'learner_one' });
  eq(noWeek.tasks, [], 'with no week chosen nothing is placed');
});

test('only active learners are offered, in their own order', () => {
  const state = fixture();
  state.students.push(makeStudent({ id: 'learner_three', name: 'Bay', active: false, sortOrder: 2 }));
  eq(listPlannableStudents(state), [
    { id: 'learner_one', name: 'Wren' },
    { id: 'learner_two', name: 'Ash' }
  ]);
});

test('each learner gets their own week, not the whole family\'s', () => {
  const state = fixture();
  const one = buildStudentWeek(state, { studentId: 'learner_one', weekStartDate: MON });
  const two = buildStudentWeek(state, { studentId: 'learner_two', weekStartDate: MON });
  assert(one.tasks.some(t => t.title === 'Strand One'), 'individual work shows for its own learner');
  assert(!two.tasks.some(t => t.title === 'Strand One'), 'and not for the other learner');
  assert(two.tasks.some(t => t.title === 'Strand Two'), 'shared work shows for both');
  one.tasks.forEach(t => eq(t.who, 'Wren'));
  two.tasks.forEach(t => eq(t.who, 'Ash'));
});

test('a rhythm day carrying a real date is read from that date, not its position', () => {
  const state = fixture();
  state.weeklyRhythm.days[0] = { id: 'rd1', label: 'Day 1', sortOrder: 0, dateMode: 'date', date: '2020-01-03' };
  const week = buildStudentWeek(state, { studentId: 'learner_one', weekStartDate: MON });
  const strandOne = week.tasks.find(t => t.title === 'Strand One');
  eq(strandOne.date, '2026-03-06', 'the 3rd of January 2020 was a Friday, so this day is the Friday');
});

// ---------------------------------------------------------------------------
// Runner — stays at the bottom so every test above is reached.
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); console.log('ok - ' + t.name); passed++; }
  catch (e) { console.log('FAIL - ' + t.name + '\n  ' + e.message); failed++; }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
