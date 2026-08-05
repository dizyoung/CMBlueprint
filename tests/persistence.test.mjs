import assert from 'node:assert/strict';
import * as P from '../lib/persistence.mjs';
import * as A from '../lib/familyMapAdapter.mjs';
import * as M from '../lib/familyMap.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('serializeAppState / deserializeAppState round-trip a sample AppState', () => {
  const state = A.buildSampleAppState();
  const json = P.serializeAppState(state);
  assert.equal(typeof json, 'string');
  const back = P.deserializeAppState(json);
  assert.deepEqual(back, state);
});

test('validateAppState accepts a well-formed sample AppState', () => {
  const state = A.buildSampleAppState();
  const result = P.validateAppState(state);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateAppState rejects non-objects, missing version, and missing required collections', () => {
  assert.equal(P.validateAppState(null).valid, false);
  assert.equal(P.validateAppState('not an object').valid, false);

  const noVersion = Object.assign({}, A.buildSampleAppState());
  delete noVersion.appStateVersion;
  assert.equal(P.validateAppState(noVersion).valid, false);

  const noStudents = Object.assign({}, A.buildSampleAppState());
  delete noStudents.students;
  const result = P.validateAppState(noStudents);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('students')));

  const noCards = Object.assign({}, A.buildSampleAppState(), { cards: 'not-an-array' });
  assert.equal(P.validateAppState(noCards).valid, false);
});

test('validateAppState rejects a backup from a newer, unknown app version', () => {
  const future = Object.assign({}, A.buildSampleAppState(), { appStateVersion: 999 });
  const result = P.validateAppState(future);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.toLowerCase().includes('newer')));
});

test('migrateAppState migrates version 1 successfully', () => {
  const state = A.buildSampleAppState();
  const result = P.migrateAppState(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.appStateVersion, P.CURRENT_APP_STATE_VERSION);
  assert.equal(result.state.students.length, state.students.length);
});

test('migrateAppState fails safely on an unknown newer version', () => {
  const future = Object.assign({}, A.buildSampleAppState(), { appStateVersion: 999 });
  const result = P.migrateAppState(future);
  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string' && result.error.length > 0);
});

test('normalizeAppState fills missing weekly rhythm and print settings safely without dropping user data', () => {
  const state = A.buildSampleAppState();
  const stripped = Object.assign({}, state);
  delete stripped.weeklyRhythm;
  delete stripped.rhythmPrintSettings;
  delete stripped.printSettings;

  const normalized = P.normalizeAppState(stripped);
  assert.ok(normalized.weeklyRhythm);
  assert.ok(Array.isArray(normalized.weeklyRhythm.days));
  assert.ok(Array.isArray(normalized.weeklyRhythm.blocks));
  assert.ok(Array.isArray(normalized.weeklyRhythm.assignments));
  assert.ok(normalized.rhythmPrintSettings);
  assert.ok(normalized.printSettings);

  // user data preserved
  assert.deepEqual(normalized.students, state.students);
  assert.deepEqual(normalized.cards, state.cards);
});

test('normalizeAppState preserves an existing weeklyRhythm rather than replacing it', () => {
  const state = A.buildSampleAppState();
  const normalized = P.normalizeAppState(state);
  assert.deepEqual(normalized.weeklyRhythm, state.weeklyRhythm);
});

test('loadAppStateSafely accepts a valid AppState end-to-end', () => {
  const state = A.buildSampleAppState();
  const result = P.loadAppStateSafely(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.cards.length, state.cards.length);
});

test('loadAppStateSafely rejects an invalid backup with readable errors', () => {
  const result = P.loadAppStateSafely({ appStateVersion: 1, cards: 'nope' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.every((e) => typeof e === 'string'));
});

test('buildExportPayload includes appStateVersion and exportedAt', () => {
  const state = A.buildSampleAppState();
  const exported = P.buildExportPayload(state, new Date('2026-06-20T12:00:00Z'));
  assert.equal(exported.appStateVersion, state.appStateVersion);
  assert.equal(exported.exportedAt, '2026-06-20T12:00:00.000Z');
  assert.deepEqual(exported.students, state.students);
});

test('suggestedExportFilename produces a readable, date-stamped filename', () => {
  const name = P.suggestedExportFilename(new Date('2026-06-20T12:00:00Z'));
  assert.equal(name, 'family-school-map-backup-2026-06-20.json');
});

test('an imported backup only replaces state after passing validation', () => {
  const goodBackup = P.buildExportPayload(A.buildSampleAppState());
  const goodResult = P.loadAppStateSafely(goodBackup);
  assert.equal(goodResult.ok, true);

  const badBackup = { appStateVersion: 1, students: 'not-an-array', groups: [], subjectColumns: [], cards: [] };
  const badResult = P.loadAppStateSafely(badBackup);
  assert.equal(badResult.ok, false, 'an invalid backup must never be treated as the new state');
});

test('persistence module exposes no browser globals (document/window/localStorage untouched)', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof window, 'undefined');
  assert.equal(typeof localStorage, 'undefined');
});

// ---------------------------------------------------------------------------
// Hardened saving — a real family's plan must survive a save/load round trip
// field for field, and a damaged file must never touch what is already there.
// ---------------------------------------------------------------------------

// A plan that exercises every field the prototypes write.
function buildRichState() {
  const state = A.buildSampleAppState();
  // Setup edits
  state.students = state.students.map((s, i) =>
    Object.assign({}, s, { name: 'Child ' + i, grade: '4', gradeBand: 'form-1', gradeBandConfirmed: true, active: true }));
  state.students[0].dayCapacity = { mon: 'light' };
  state.students[0].dayCapacityExplicit = { mon: true };
  state.outsideCommitments = [
    M.makeOutsideCommitment
      ? M.makeOutsideCommitment({ label: 'Co-op', dayIds: ['tue'] })
      : { id: 'oc1', label: 'Co-op', dayIds: ['tue'] }
  ];
  state.setupPrototype = {
    groupsReviewed: true, loopBucketsReviewed: true, loopSortingReviewed: true,
    noLoopsChosen: false, availabilityReviewed: true
  };

  // Two loops: one active, one set aside.
  let next = A.createLoopBucket(state, 'Morning Loop');
  next = A.createLoopBucket(next, 'Nature Loop');
  next.loops[next.loops.length - 1].active = false;

  // Feast decisions: audience, loop, notes, workType, light-day flag.
  next.strandAssignments = [
    {
      id: 'sa_1', strandId: 'strand_a', strandLabel: 'Nature study',
      assignmentMode: 'group', groupId: next.groups[0] ? next.groups[0].id : 'g1', studentIds: [],
      coopProvider: '', loopId: next.loops[0].id, workType: 'group-lesson',
      mayOccurOnLightDays: true, notes: 'Tuesdays after lunch', useThisYear: true,
      sortOrder: 0, createdBy: 'feast-prototype'
    },
    {
      id: 'sa_2', strandId: 'strand_b', strandLabel: 'Latin',
      assignmentMode: 'students', groupId: null,
      studentIds: [next.students[0].id], coopProvider: '', loopId: null,
      workType: 'independent', mayOccurOnLightDays: false, notes: '',
      useThisYear: false, sortOrder: 1, createdBy: 'feast-prototype'
    }
  ];
  return next;
}

function roundTrip(state) {
  const result = P.loadAppStateSafely(P.deserializeAppState(P.serializeAppState(state)));
  assert.equal(result.ok, true, 'round trip must load cleanly: ' + (result.errors || []).join(', '));
  return result.state;
}

test('Setup edits survive serialize → deserialize', () => {
  const back = roundTrip(buildRichState());
  assert.equal(back.students[0].name, 'Child 0');
  assert.equal(back.students[0].gradeBandConfirmed, true);
  assert.deepEqual(back.students[0].dayCapacity, { mon: 'light' });
  assert.deepEqual(back.students[0].dayCapacityExplicit, { mon: true });
  assert.equal(back.outsideCommitments.length, 1);
  assert.equal(back.outsideCommitments[0].label, 'Co-op');
  assert.deepEqual(back.setupPrototype, buildRichState().setupPrototype);
});

test('Feast strand assignments survive serialize → deserialize', () => {
  const back = roundTrip(buildRichState());
  assert.equal(back.strandAssignments.length, 2);
  assert.equal(back.strandAssignments[0].strandLabel, 'Nature study');
  assert.equal(back.strandAssignments[1].strandLabel, 'Latin');
});

test('audience and loopId persist independently of each other', () => {
  const state = buildRichState();
  const back = roundTrip(state);
  const a = back.strandAssignments[0];
  const b = back.strandAssignments[1];
  // In a loop AND assigned to a group.
  assert.equal(a.assignmentMode, 'group');
  assert.equal(a.groupId, state.strandAssignments[0].groupId);
  assert.equal(a.loopId, state.loops[0].id);
  // Audience set, no loop — the audience must not be dragged along by loopId.
  assert.equal(b.assignmentMode, 'students');
  assert.deepEqual(b.studentIds, state.strandAssignments[1].studentIds);
  assert.equal(b.loopId, null);
});

test('notes, workType, mayOccurOnLightDays and useThisYear all persist', () => {
  const back = roundTrip(buildRichState());
  const a = back.strandAssignments[0];
  const b = back.strandAssignments[1];
  assert.equal(a.notes, 'Tuesdays after lunch');
  assert.equal(a.workType, 'group-lesson');
  assert.equal(a.mayOccurOnLightDays, true);
  assert.equal(a.useThisYear, true);
  assert.equal(b.workType, 'independent');
  assert.equal(b.mayOccurOnLightDays, false);
  assert.equal(b.useThisYear, false);
});

test('a set-aside loop persists with active:false and is never dropped', () => {
  const state = buildRichState();
  const back = roundTrip(state);
  assert.equal(back.loops.length, state.loops.length);
  const setAside = back.loops.filter((l) => l.active === false);
  assert.equal(setAside.length, 1);
  assert.equal(setAside[0].title, 'Nature Loop');
});

test('buildExportPayload carries the complete state plus export stamps', () => {
  const state = buildRichState();
  const payload = P.buildExportPayload(state, new Date('2026-06-20T12:00:00Z'));
  assert.equal(payload.appStateVersion, P.CURRENT_APP_STATE_VERSION);
  assert.equal(payload.exportedAt, '2026-06-20T12:00:00.000Z');
  assert.equal(typeof payload.exportedAtLocal, 'string');
  assert.ok(payload.exportedAtLocal.length > 0);
  ['students', 'groups', 'subjectColumns', 'cards', 'loops', 'loopItems', 'sequences',
   'sequenceItems', 'extensionWorks', 'resources', 'resourceUses', 'starterTemplates',
   'strandAssignments', 'outsideCommitments'].forEach((key) => {
    assert.deepEqual(payload[key], state[key], key + ' must be exported intact');
  });
  assert.deepEqual(payload.setupPrototype, state.setupPrototype);
  assert.deepEqual(payload.weeklyRhythm, state.weeklyRhythm);
  assert.deepEqual(payload.printSettings, state.printSettings);
});

test('export → import reproduces the normalized state exactly', () => {
  const state = P.normalizeAppState(buildRichState());
  const payload = P.buildExportPayload(state, new Date('2026-06-20T12:00:00Z'));
  const onDisk = JSON.parse(JSON.stringify(payload));       // what the file holds
  const result = P.loadAppStateSafely(onDisk);
  assert.equal(result.ok, true);
  const reloaded = Object.assign({}, result.state);
  delete reloaded.exportedAt;
  delete reloaded.exportedAtLocal;
  assert.deepEqual(reloaded, state);
});

test('an invalid or truncated import returns ok:false and changes nothing', () => {
  const state = P.normalizeAppState(buildRichState());
  const before = P.serializeAppState(state);

  const payload = P.buildExportPayload(state);
  const text = JSON.stringify(payload);

  // 1. Truncated file — not even parseable.
  let threw = false;
  try { P.deserializeAppState(text.slice(0, Math.floor(text.length / 2))); } catch (e) { threw = true; }
  assert.equal(threw, true, 'a truncated file must fail to parse rather than load partially');

  // 2. Parseable but corrupted in a required collection.
  const corrupted = Object.assign({}, payload, { cards: 'not-an-array', students: null });
  const result = P.loadAppStateSafely(corrupted);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.every((e) => typeof e === 'string' && e.length > 0));
  assert.equal(result.state, undefined, 'a failed import must hand back no state at all');

  // 3. The plan we already had is byte-identical afterwards.
  assert.equal(P.serializeAppState(state), before);
});

test('a plan file from a newer build is rejected with a readable message', () => {
  const payload = P.buildExportPayload(
    Object.assign({}, P.normalizeAppState(buildRichState()), { appStateVersion: P.CURRENT_APP_STATE_VERSION + 1 })
  );
  const result = P.loadAppStateSafely(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.toLowerCase().includes('newer')));
  assert.ok(result.errors.every((e) => !/undefined|\[object/.test(e)));
});

test('summarizeAppState describes a plan file in terms a parent can check', () => {
  const state = P.normalizeAppState(buildRichState());
  const payload = P.buildExportPayload(state, new Date('2026-06-20T12:00:00Z'));
  const summary = P.summarizeAppState(state, payload);
  assert.equal(summary.childCount, state.students.length);
  assert.deepEqual(summary.childNames, state.students.map((s) => s.name));
  assert.equal(summary.groupCount, state.groups.length);
  assert.equal(summary.loopCount, state.loops.length);
  assert.equal(summary.activeLoopCount, state.loops.filter((l) => l.active !== false).length);
  assert.equal(summary.setAsideLoopCount, 1);
  assert.equal(summary.strandDecisionCount, 2);
  assert.equal(summary.exportedAt, '2026-06-20T12:00:00.000Z');

  const text = P.describeImportSummary(summary);
  assert.ok(text.includes(String(summary.childCount)));
  assert.ok(text.includes('set aside'));
  assert.ok(text.includes('Exported:'));
});

test('summarizeAppState never throws on junk', () => {
  const summary = P.summarizeAppState(null, null);
  assert.equal(summary.childCount, 0);
  assert.equal(summary.loopCount, 0);
  assert.equal(typeof P.describeImportSummary(summary), 'string');
});

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log('ok - ' + t.name);
    passed++;
  } catch (err) {
    console.log('FAIL - ' + t.name);
    console.log('    ' + err.message);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
if (failed > 0) process.exit(1);
