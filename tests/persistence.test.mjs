import assert from 'node:assert/strict';
import * as P from '../lib/persistence.mjs';
import * as A from '../lib/familyMapAdapter.mjs';

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
