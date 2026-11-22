// Plain-Node test runner for lib/plannerSpread.mjs — no dependencies.
// Run with: node tests/plannerSpread.test.mjs
import assert from 'node:assert/strict';
import * as P from '../lib/plannerSpread.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// A fixed week so no assertion depends on the day the suite happens to run.
// Monday 2026-03-02 .. Sunday 2026-03-08. Thursday is OFF.
const MON = '2026-03-02';
const TUE = '2026-03-03';
const WED = '2026-03-04';
const THU = '2026-03-05';
const FRI = '2026-03-06';
const SAT = '2026-03-07';
const NEXT_MON = '2026-03-09';
const NEXT_TUE = '2026-03-10';
const NEXT_WED = '2026-03-11';

function t(id, title, date, order) {
  return { id, title, who: 'Everyone', date, order, done: false, sourceLabel: null };
}

// Mon: a, b   Tue: c   Wed: d, e   Fri: f
function week() {
  return {
    schemaVersion: 1,
    weekStartDate: MON,
    schoolDays: { mon: true, tue: true, wed: true, thu: false, fri: true, sat: false },
    tasks: [
      t('a', 'Bible reading', MON, 0),
      t('b', 'Math lesson', MON, 1),
      t('c', 'Nature walk', TUE, 0),
      t('d', 'Dictation', WED, 0),
      t('e', 'Hymn study', WED, 1),
      t('f', 'Handicraft', FRI, 0)
    ],
    lastShift: null
  };
}

function dateOf(state, id) {
  const found = P.normalizeState(state).tasks.find(x => x.id === id);
  return found ? found.date : null;
}
function idsOn(state, date) {
  return P.tasksForDate(state, date).map(x => x.id);
}
function dateMap(state) {
  const out = {};
  for (const task of P.normalizeState(state).tasks) out[task.id] = task.date;
  return out;
}

// ---------------------------------------------------------------------------
// 1 — moveTask
// ---------------------------------------------------------------------------
test('moveTask moves one task and nothing else', () => {
  const before = dateMap(week());
  const after = P.moveTask(week(), 'a', WED);
  assert.equal(dateOf(after, 'a'), WED, 'the moved task is on Wednesday');
  for (const id of ['b', 'c', 'd', 'e', 'f']) {
    assert.equal(dateOf(after, id), before[id], id + ' did not move');
  }
  assert.deepEqual(idsOn(after, WED), ['d', 'e', 'a'], 'it lands at the end of that day');
});

test('moveTask onto its own day, an unknown task, or a bad date changes nothing', () => {
  const base = week();
  assert.deepEqual(dateMap(P.moveTask(base, 'a', MON)), dateMap(base));
  assert.deepEqual(dateMap(P.moveTask(base, 'nope', WED)), dateMap(base));
  assert.deepEqual(dateMap(P.moveTask(base, 'a', 'not-a-date')), dateMap(base));
});

// ---------------------------------------------------------------------------
// 2 — stack
// ---------------------------------------------------------------------------
test('shiftDay stack lands tasks alongside what is already there, and nothing later moves', () => {
  const after = P.shiftDay(week(), MON, TUE, 'stack');
  assert.deepEqual(idsOn(after, TUE), ['c', 'a', 'b'], 'Monday doubles up behind Tuesday');
  assert.deepEqual(idsOn(after, MON), [], 'Monday is now empty');
  assert.deepEqual(idsOn(after, WED), ['d', 'e'], 'Wednesday is untouched');
  assert.deepEqual(idsOn(after, FRI), ['f'], 'Friday is untouched');
});

// ---------------------------------------------------------------------------
// 3 — cascade
// ---------------------------------------------------------------------------
test('shiftDay cascade moves the day and pushes everything on or after the target forward', () => {
  const after = P.shiftDay(week(), MON, TUE, 'cascade');
  assert.deepEqual(idsOn(after, TUE), ['a', 'b'], "Monday's work lands on Tuesday");
  assert.deepEqual(idsOn(after, WED), ['c'], "Tuesday's work flows to Wednesday");
  assert.deepEqual(idsOn(after, FRI), ['d', 'e'], "Wednesday's work flows past Thursday to Friday");
  assert.deepEqual(idsOn(after, NEXT_MON), ['f'], "Friday's work flows into next Monday");
  assert.deepEqual(idsOn(after, MON), [], 'Monday is now empty');
});

// ---------------------------------------------------------------------------
// 4 — cascade skips a non-school day
// ---------------------------------------------------------------------------
test('cascade skips a non-school day: work landing on Wednesday pushes to Friday, not Thursday', () => {
  const after = P.shiftDay(week(), MON, TUE, 'cascade');
  assert.deepEqual(idsOn(after, THU), [], 'Thursday is off, so nothing lands there');
  assert.deepEqual(idsOn(after, FRI), ['d', 'e'], 'it went to Friday instead');

  // And with Thursday switched back on, the same shift uses Thursday.
  const openThu = Object.assign({}, week(), {
    schoolDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false }
  });
  const after2 = P.shiftDay(openThu, MON, TUE, 'cascade');
  assert.deepEqual(idsOn(after2, THU), ['d', 'e'], 'with Thursday on, Wednesday flows to Thursday');
  assert.deepEqual(idsOn(after2, WED), ['c'], "Tuesday's work still flows to Wednesday");
  assert.deepEqual(idsOn(after2, FRI), [], "Friday's own work has flowed on past the weekend");
  assert.deepEqual(idsOn(after2, NEXT_MON), ['f']);
});

// ---------------------------------------------------------------------------
// 5 — order preserved
// ---------------------------------------------------------------------------
test('cascade preserves relative order within a day and across days', () => {
  const after = P.shiftDay(week(), MON, TUE, 'cascade');
  assert.deepEqual(P.tasksForDate(after, TUE).map(x => x.title), ['Bible reading', 'Math lesson']);
  assert.deepEqual(P.tasksForDate(after, FRI).map(x => x.title), ['Dictation', 'Hymn study']);
  // Across days: the sequence a,b then c then d,e then f is unchanged.
  const seq = P.normalizeState(after).tasks
    .slice()
    .sort((x, y) => (x.date === y.date ? x.order - y.order : (x.date < y.date ? -1 : 1)))
    .map(x => x.id);
  assert.deepEqual(seq, ['a', 'b', 'c', 'd', 'e', 'f']);
  // Orders are re-written as a clean 0..n-1 per day.
  assert.deepEqual(P.tasksForDate(after, TUE).map(x => x.order), [0, 1]);
  assert.deepEqual(P.tasksForDate(after, FRI).map(x => x.order), [0, 1]);
});

// ---------------------------------------------------------------------------
// 6 — nothing lost
// ---------------------------------------------------------------------------
test('cascade never loses a task, extending into the next week as needed', () => {
  const base = week();
  const before = P.normalizeState(base).tasks.length;
  const after = P.shiftDay(base, MON, TUE, 'cascade');
  const tasks = P.normalizeState(after).tasks;
  assert.equal(tasks.length, before, 'count before equals count after');
  assert.deepEqual(tasks.map(x => x.id).sort(), ['a', 'b', 'c', 'd', 'e', 'f'], 'the same tasks, all present');
  assert.ok(tasks.some(x => x.date > SAT), 'it extended into the following week');
  assert.ok(tasks.every(x => P.isValidDate(x.date)), 'every task still has a real date');
});

test('a cascade from the far end of a packed week walks on through the following week', () => {
  const packed = Object.assign({}, week(), {
    tasks: [
      t('a', 'One', MON, 0), t('b', 'Two', TUE, 0), t('c', 'Three', WED, 0),
      t('d', 'Four', FRI, 0), t('e', 'Five', NEXT_MON, 0), t('f', 'Six', NEXT_TUE, 0)
    ]
  });
  const after = P.shiftDay(packed, MON, TUE, 'cascade');
  assert.equal(P.normalizeState(after).tasks.length, 6);
  assert.equal(dateOf(after, 'a'), TUE);
  assert.equal(dateOf(after, 'b'), WED);
  assert.equal(dateOf(after, 'c'), FRI, 'Thursday skipped');
  assert.equal(dateOf(after, 'd'), NEXT_MON);
  assert.equal(dateOf(after, 'e'), NEXT_TUE);
  assert.equal(dateOf(after, 'f'), NEXT_WED);
});

// ---------------------------------------------------------------------------
// 7 / 8 — undo
// ---------------------------------------------------------------------------
test('undoLastShift restores the exact previous task set after a cascade', () => {
  const base = week();
  const before = dateMap(base);
  const after = P.shiftDay(base, MON, TUE, 'cascade');
  assert.notDeepEqual(dateMap(after), before, 'the cascade really did change the week');
  const back = P.undoLastShift(after);
  assert.deepEqual(dateMap(back), before, 'undo puts every task back on its own day');
  assert.deepEqual(
    P.normalizeState(back).tasks.map(x => [x.id, x.date, x.order]),
    P.normalizeState(base).tasks.map(x => [x.id, x.date, x.order]),
    'order is restored too'
  );
});

test('undoLastShift restores the exact previous task set after a stack', () => {
  const base = week();
  const before = dateMap(base);
  const back = P.undoLastShift(P.shiftDay(base, MON, TUE, 'stack'));
  assert.deepEqual(dateMap(back), before);
});

test('undo is one level only, and is cleared after use', () => {
  const base = week();
  const one = P.shiftDay(base, MON, TUE, 'cascade');
  const two = P.shiftDay(one, FRI, SAT, 'stack');
  assert.ok(P.canUndo(two), 'there is something to undo');
  const back = P.undoLastShift(two);
  assert.deepEqual(dateMap(back), dateMap(one), 'undo goes back exactly one step, not two');
  assert.equal(P.canUndo(back), false, 'the snapshot is cleared after use');
  assert.equal(P.undoDescription(back), null);
  // A second undo is a no-op rather than a surprise.
  assert.deepEqual(dateMap(P.undoLastShift(back)), dateMap(one));
});

test('undoLastShift with nothing to undo returns the state unchanged', () => {
  const base = week();
  assert.deepEqual(dateMap(P.undoLastShift(base)), dateMap(base));
  assert.equal(P.canUndo(base), false);
});

// ---------------------------------------------------------------------------
// 9 — description
// ---------------------------------------------------------------------------
test('lastShift.description names the real days in plain language', () => {
  const cascade = P.shiftDay(week(), MON, TUE, 'cascade');
  const text = P.undoDescription(cascade);
  assert.equal(text, 'Moved Monday to Tuesday and flowed everything after');
  const stack = P.shiftDay(week(), WED, FRI, 'stack');
  assert.equal(P.undoDescription(stack), 'Moved Wednesday to Friday alongside what was already there');
  for (const d of [text, P.undoDescription(stack)]) {
    assert.ok(!/cascade|stack/i.test(d), 'the words cascade and stack never reach a parent');
  }
});

// ---------------------------------------------------------------------------
// 10 — timezone safety
// ---------------------------------------------------------------------------
test('date arithmetic is timezone-safe across a month boundary', () => {
  assert.equal(P.addDays('2026-03-31', 1), '2026-04-01');
  assert.equal(P.addDays('2026-04-01', -1), '2026-03-31');
  assert.equal(P.addDays('2026-02-28', 1), '2026-03-01', '2026 is not a leap year');
  assert.equal(P.addDays('2024-02-28', 1), '2024-02-29', '2024 is');
  assert.equal(P.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(P.weekdayLabel('2026-03-02'), 'Monday');
  assert.equal(P.mondayOf('2026-03-08'), '2026-03-02', 'Sunday belongs to the week that just ended');
});

test('a shift across a month boundary lands on the intended date', () => {
  // Mon 2026-03-30, Tue 03-31, Wed 04-01, Thu 04-02 (off), Fri 04-03.
  const endOfMonth = {
    weekStartDate: '2026-03-30',
    schoolDays: { mon: true, tue: true, wed: true, thu: false, fri: true, sat: false },
    tasks: [
      t('a', 'One', '2026-03-30', 0),
      t('b', 'Two', '2026-03-31', 0),
      t('c', 'Three', '2026-04-01', 0)
    ]
  };
  const after = P.shiftDay(endOfMonth, '2026-03-30', '2026-03-31', 'cascade');
  assert.equal(dateOf(after, 'a'), '2026-03-31');
  assert.equal(dateOf(after, 'b'), '2026-04-01', 'across the month boundary, not a day either side');
  assert.equal(dateOf(after, 'c'), '2026-04-03', 'Thursday 2 April is off, so it goes to Friday');
});

test('a shift across a DST change lands on the intended date', () => {
  // US DST starts Sun 2026-03-08; EU clocks change Sun 2026-03-29. Both are
  // crossed here, and a UTC-based model must not slip a day either way.
  const dst = {
    weekStartDate: '2026-03-02',
    schoolDays: { mon: true, tue: true, wed: true, thu: false, fri: true, sat: false },
    tasks: [t('a', 'One', FRI, 0), t('b', 'Two', NEXT_MON, 0)]
  };
  const after = P.shiftDay(dst, FRI, NEXT_MON, 'cascade');
  assert.equal(dateOf(after, 'a'), '2026-03-09', 'straight over the Sunday clock change');
  assert.equal(dateOf(after, 'b'), '2026-03-10');

  const euWeek = {
    weekStartDate: '2026-03-23',
    schoolDays: { mon: true, tue: true, wed: true, thu: false, fri: true, sat: false },
    tasks: [t('a', 'One', '2026-03-27', 0), t('b', 'Two', '2026-03-30', 0)]
  };
  const euAfter = P.shiftDay(euWeek, '2026-03-27', '2026-03-30', 'cascade');
  assert.equal(dateOf(euAfter, 'a'), '2026-03-30');
  assert.equal(dateOf(euAfter, 'b'), '2026-03-31');
});

// ---------------------------------------------------------------------------
// 11 — purity
// ---------------------------------------------------------------------------
test('every function is pure — the input state object is never mutated', () => {
  const calls = [
    ['moveTask', s => P.moveTask(s, 'a', WED)],
    ['shiftDay cascade', s => P.shiftDay(s, MON, TUE, 'cascade')],
    ['shiftDay stack', s => P.shiftDay(s, MON, TUE, 'stack')],
    ['addTask', s => P.addTask(s, { title: 'New', date: TUE })],
    ['editTaskTitle', s => P.editTaskTitle(s, 'a', 'Changed')],
    ['editTaskWho', s => P.editTaskWho(s, 'a', 'Older students')],
    ['deleteTask', s => P.deleteTask(s, 'a')],
    ['toggleDone', s => P.toggleDone(s, 'a')],
    ['setWeekStart', s => P.setWeekStart(s, NEXT_MON)],
    ['shiftWeek', s => P.shiftWeek(s, 1)],
    ['tasksForDate', s => P.tasksForDate(s, MON)],
    ['daysForSpread', s => P.daysForSpread(s)],
    ['normalizeState', s => P.normalizeState(s)],
    ['clearLastShift', s => P.clearLastShift(s)],
    ['serializePlannerState', s => P.serializePlannerState(s)]
  ];
  for (const [label, fn] of calls) {
    const input = week();
    const snapshot = JSON.parse(JSON.stringify(input));
    const result = fn(input);
    assert.deepEqual(JSON.parse(JSON.stringify(input)), snapshot, label + ' did not mutate its input');
    assert.ok(result !== input, label + ' returned something new');
  }
  // undoLastShift runs on a state that has a snapshot to restore.
  const shifted = P.shiftDay(week(), MON, TUE, 'cascade');
  const frozen = JSON.parse(JSON.stringify(shifted));
  P.undoLastShift(shifted);
  assert.deepEqual(JSON.parse(JSON.stringify(shifted)), frozen, 'undoLastShift did not mutate its input');
});

test('a returned state does not share task objects with the state it came from', () => {
  const base = week();
  const after = P.moveTask(base, 'a', WED);
  const afterTask = P.normalizeState(after).tasks.find(x => x.id === 'b');
  const baseTask = base.tasks.find(x => x.id === 'b');
  assert.ok(afterTask !== baseTask, 'untouched tasks are copies, not the originals');
  // Deep-freezing the input is not enough on its own; prove the arrays differ.
  assert.ok(P.shiftDay(base, MON, TUE, 'stack').tasks !== base.tasks);
});

// ---------------------------------------------------------------------------
// 12 / 13 — serialization
// ---------------------------------------------------------------------------
test('persistence round trip reproduces the state exactly', () => {
  const base = P.normalizeState(week());
  const back = P.deserializePlannerState(P.serializePlannerState(base));
  assert.deepEqual(back, base);

  // Including a pending undo snapshot and a done flag.
  const shifted = P.toggleDone(P.shiftDay(week(), MON, TUE, 'cascade'), 'c');
  const roundTripped = P.deserializePlannerState(P.serializePlannerState(shifted));
  assert.deepEqual(roundTripped, P.normalizeState(shifted));
  assert.equal(P.canUndo(roundTripped), true, 'the undo snapshot survives a reload');
  assert.equal(P.undoDescription(roundTripped), 'Moved Monday to Tuesday and flowed everything after');

  // And the real seed survives a round trip.
  const seed = P.buildDefaultPlannerState(new Date('2026-03-04T12:00:00Z'));
  assert.deepEqual(P.deserializePlannerState(P.serializePlannerState(seed)), P.normalizeState(seed));
});

test('a damaged payload loads defaults rather than throwing', () => {
  const bad = ['', '   ', 'not json at all', '{', '[]', 'null', '{"tasks":"nope"}',
    '{"schemaVersion":1}', '12', '"a string"', undefined, null, 42, {}];
  for (const raw of bad) {
    let out;
    assert.doesNotThrow(() => { out = P.deserializePlannerState(raw); }, 'did not throw on ' + String(raw));
    assert.ok(Array.isArray(out.tasks) && out.tasks.length > 0, 'defaults came back for ' + String(raw));
    assert.equal(out.schemaVersion, 1);
  }
  // A payload with a real task list but junk inside it is repaired, not thrown.
  const repaired = P.deserializePlannerState(JSON.stringify({
    schemaVersion: 1, weekStartDate: 'yesterday',
    tasks: [{ id: 'x', title: 'Fine', date: MON, order: 0 }, { nonsense: true }, null, 7]
  }));
  assert.equal(repaired.tasks.length, 4);
  assert.equal(P.isValidDate(repaired.weekStartDate), true, 'a junk week start falls back to a real Monday');
  assert.equal(P.weekdayLabel(repaired.weekStartDate), 'Monday');
});

// ---------------------------------------------------------------------------
// 14 — storage keys
// ---------------------------------------------------------------------------
test('the prototype writes only its own keys — the production keys are never named', async () => {
  const store = await import('../docs/app/plannerSpreadStore.mjs');
  assert.equal(store.PLANNER_STORAGE_KEY, 'cmblueprint.plannerSpreadPrototype.v1');
  assert.equal(store.PLANNER_SAVED_AT_KEY, 'cmblueprint.plannerSpreadPrototype.v1.savedAt');

  const fs = await import('node:fs');
  const files = [
    'lib/plannerSpread.mjs',
    'docs/app/plannerSpreadStore.mjs',
    'docs/app/planner-spread-prototype.html',
    'docs/app/planner-spread.css'
  ];
  for (const file of files) {
    const body = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.ok(!body.includes('cmblueprint.familySchoolMap'), file + ' never names the Family School Map key');
    assert.ok(!body.includes('cm_blueprint_data_v3'), file + ' never names the old planner key');
  }

  // With a stub localStorage in place, a real save touches nothing else.
  const written = {};
  globalThis.localStorage = {
    getItem: k => (k in written ? written[k] : null),
    setItem: (k, v) => { written[k] = String(v); },
    removeItem: k => { delete written[k]; }
  };
  written['cmblueprint.familySchoolMap.v1'] = 'REAL PLAN — DO NOT TOUCH';
  written['cm_blueprint_data_v3'] = 'REAL PLAN — DO NOT TOUCH';
  try {
    const result = store.savePlannerState(week());
    assert.equal(result.ok, true);
    assert.deepEqual(
      Object.keys(written).sort(),
      ['cm_blueprint_data_v3', 'cmblueprint.familySchoolMap.v1',
        'cmblueprint.plannerSpreadPrototype.v1', 'cmblueprint.plannerSpreadPrototype.v1.savedAt'].sort()
    );
    assert.equal(written['cmblueprint.familySchoolMap.v1'], 'REAL PLAN — DO NOT TOUCH');
    assert.equal(written['cm_blueprint_data_v3'], 'REAL PLAN — DO NOT TOUCH');
    // And the loader reads only its own key.
    const loaded = store.loadPlannerState();
    assert.equal(loaded.source, 'saved');
    assert.deepEqual(dateMap(loaded.state), dateMap(week()));
    // A damaged prototype payload loads defaults, and still leaves the real keys alone.
    written['cmblueprint.plannerSpreadPrototype.v1'] = '{{{ not json';
    const damaged = store.loadPlannerState();
    assert.equal(damaged.source, 'default-after-damaged');
    assert.ok(damaged.state.tasks.length > 0);
    assert.equal(written['cmblueprint.familySchoolMap.v1'], 'REAL PLAN — DO NOT TOUCH');
  } finally {
    delete globalThis.localStorage;
  }
});

// ---------------------------------------------------------------------------
// 15 — tolerance
// ---------------------------------------------------------------------------
test('all functions tolerate {} and missing arrays', () => {
  const empties = [{}, null, undefined, { tasks: null }, { tasks: undefined, schoolDays: null },
    { schemaVersion: 1 }, { tasks: [], schoolDays: {} }, 'not an object', 5];
  for (const e of empties) {
    const label = JSON.stringify(e);
    assert.doesNotThrow(() => {
      const n = P.normalizeState(e);
      assert.ok(Array.isArray(n.tasks));
      assert.equal(P.isValidDate(n.weekStartDate), true);
      assert.deepEqual(P.tasksForDate(e, MON), []);
      assert.ok(Array.isArray(P.daysForSpread(e)));
      assert.equal(P.daysForSpread(e).length, 5, 'an empty week still shows Monday to Friday');
      P.moveTask(e, 'a', MON);
      P.shiftDay(e, MON, TUE, 'cascade');
      P.shiftDay(e, MON, TUE, 'stack');
      P.undoLastShift(e);
      P.canUndo(e);
      P.undoDescription(e);
      P.editTaskTitle(e, 'a', 'x');
      P.deleteTask(e, 'a');
      P.toggleDone(e, 'a');
      P.setWeekStart(e, MON);
      P.shiftWeek(e, 1);
      P.serializePlannerState(e);
      const added = P.addTask(e, { title: 'Something', date: MON });
      assert.equal(added.tasks.length, 1);
    }, 'threw on ' + label);
  }
});

test('an empty day cannot be shifted, and a bad mode is treated as a cascade', () => {
  const base = week();
  assert.deepEqual(dateMap(P.shiftDay(base, THU, FRI, 'cascade')), dateMap(base), 'Thursday holds nothing');
  assert.equal(P.canUndo(P.shiftDay(base, THU, FRI, 'cascade')), false, 'and nothing is recorded to undo');
  const odd = P.shiftDay(base, MON, TUE, 'whatever');
  assert.deepEqual(dateMap(odd), dateMap(P.shiftDay(base, MON, TUE, 'cascade')));
});

test('a week with every weekday marked off still shifts without spinning', () => {
  const closed = Object.assign({}, week(), {
    schoolDays: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false }
  });
  const after = P.shiftDay(closed, MON, TUE, 'cascade');
  assert.equal(P.normalizeState(after).tasks.length, 6, 'no task is dropped');
  assert.ok(P.normalizeState(after).tasks.every(x => P.isValidDate(x.date)));
  assert.deepEqual(idsOn(after, TUE), ['a', 'b'], 'the grabbed day still lands where it was dropped');
});

// ---------------------------------------------------------------------------
// Reading the spread, seed, and small helpers
// ---------------------------------------------------------------------------
test('daysForSpread shows Monday to Friday, and the weekend only when it holds work', () => {
  const plain = P.daysForSpread(week());
  assert.deepEqual(plain.map(d => d.weekdayLabel),
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.equal(plain[3].isSchoolDay, false, 'Thursday is shown, quietly, even though it is off');
  assert.equal(plain[3].taskCount, 0);
  assert.equal(plain[0].humanDate, 'March 2');

  const withSat = P.moveTask(week(), 'f', SAT);
  const days = P.daysForSpread(withSat);
  assert.equal(days.length, 6);
  assert.equal(days[5].weekdayLabel, 'Saturday');
  assert.equal(days[5].taskCount, 1);
});

test('the default seed is a believable week with Thursday off and no real names', () => {
  const seed = P.buildDefaultPlannerState(new Date('2026-03-04T12:00:00Z'));
  assert.equal(seed.weekStartDate, MON, 'the spread opens on the current week');
  assert.equal(seed.schoolDays.thu, false, 'Thursday is off so the skip is visible at once');
  assert.ok(seed.tasks.length >= 8);
  const days = new Set(seed.tasks.map(x => P.weekdayKey(x.date)));
  assert.deepEqual(Array.from(days).sort(), ['fri', 'mon', 'tue', 'wed']);
  assert.ok(seed.tasks.every(x => x.who && x.title), 'every line says what it is and who it is for');
  assert.equal(seed.lastShift, null);
  assert.ok(new Set(seed.tasks.map(x => x.id)).size === seed.tasks.length, 'ids are unique');
});

test('nextSchoolDay skips the days that are off and runs into the next week', () => {
  const s = week();
  assert.equal(P.nextSchoolDay(s, WED), FRI, 'Thursday is skipped');
  assert.equal(P.nextSchoolDay(s, FRI), NEXT_MON, 'the weekend is skipped');
  assert.equal(P.nextSchoolDay(s, SAT), NEXT_MON);
  assert.equal(P.isSchoolDay(s, THU), false);
  assert.equal(P.isSchoolDay(s, '2026-03-08'), false, 'Sunday is never a school day');
});

test('parseDate rejects the dates that would silently slide', () => {
  assert.equal(P.isValidDate('2026-02-31'), false);
  assert.equal(P.isValidDate('2026-13-01'), false);
  assert.equal(P.isValidDate('2026-3-4'), false);
  assert.equal(P.isValidDate(''), false);
  assert.equal(P.isValidDate(null), false);
  assert.equal(P.isValidDate('2026-03-04'), true);
});

test('addTask, editTaskTitle, toggleDone and deleteTask do the small things right', () => {
  let s = P.addTask(week(), { title: 'Composer study', who: 'Everyone', date: TUE });
  assert.deepEqual(P.tasksForDate(s, TUE).map(x => x.title), ['Nature walk', 'Composer study']);
  const newId = P.tasksForDate(s, TUE)[1].id;
  s = P.editTaskTitle(s, newId, 'Composer study — Haydn');
  assert.equal(P.tasksForDate(s, TUE)[1].title, 'Composer study — Haydn');
  s = P.toggleDone(s, newId);
  assert.equal(P.tasksForDate(s, TUE)[1].done, true);
  s = P.toggleDone(s, newId);
  assert.equal(P.tasksForDate(s, TUE)[1].done, false);
  s = P.deleteTask(s, newId);
  assert.deepEqual(P.tasksForDate(s, TUE).map(x => x.title), ['Nature walk']);
});

test('setWeekStart always snaps to a Monday, and shiftWeek steps a week at a time', () => {
  assert.equal(P.setWeekStart(week(), WED).weekStartDate, MON);
  assert.equal(P.shiftWeek(week(), 1).weekStartDate, NEXT_MON);
  assert.equal(P.shiftWeek(week(), -1).weekStartDate, '2026-02-23');
  assert.equal(P.setWeekStart(week(), 'rubbish').weekStartDate, MON, 'a bad date leaves the week alone');
});

test('moving a task does not create an undo snapshot — only a whole-day shift does', () => {
  assert.equal(P.canUndo(P.moveTask(week(), 'a', WED)), false);
  assert.equal(P.canUndo(P.shiftDay(week(), MON, TUE, 'stack')), true);
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
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
