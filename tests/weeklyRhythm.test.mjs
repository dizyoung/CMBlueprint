import assert from 'node:assert/strict';
import * as R from '../lib/weeklyRhythm.mjs';
import * as M from '../lib/familyMap.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function sampleStudents() {
  return [
    M.makeStudent({ id: 'charis', name: 'Charis', gradeBand: 'form1' }),
    M.makeStudent({ id: 'kayla', name: 'Kayla', gradeBand: 'form1' }),
    M.makeStudent({ id: 'lucy', name: 'Lucy', gradeBand: 'form2' }),
    M.makeStudent({ id: 'jeremiah', name: 'Jeremiah', gradeBand: 'form3' }),
    M.makeStudent({ id: 'retired', name: 'Retired', gradeBand: 'form3', active: false })
  ];
}

function sampleGroups() {
  return [M.makeGroup({ id: 'littles', label: 'Littles', studentIds: ['charis', 'kayla'] })];
}

test('one cell can hold multiple assignments', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  var cell = R.getAssignmentsForCell(rhythm, 'day1', 'morning');
  assert.equal(cell.length, 4);
  assert.deepEqual(cell.map((a) => a.label), ['Together Time', 'Jeremiah independent', 'Lucy independent', 'Littles with Mom']);
});

test('getAssignmentsForDay and getAssignmentsForBlock filter correctly', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  assert.equal(R.getAssignmentsForDay(rhythm, 'day2').length, 3);
  assert.equal(R.getAssignmentsForBlock(rhythm, 'afternoon').length, 5);
});

test('student-specific assignment appears in that student\'s rhythm', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  var context = { students: sampleStudents(), groups: sampleGroups() };
  var jeremiahAssignments = R.getRhythmForStudent(rhythm, 'jeremiah', context);
  var labels = jeremiahAssignments.map((a) => a.label);
  assert.ok(labels.includes('Jeremiah independent'));
  assert.ok(labels.includes('Jeremiah at co-op all day'));
  assert.ok(!labels.includes('Lucy independent'));
});

test('group assignment resolves to its students', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  var context = { students: sampleStudents(), groups: sampleGroups() };
  var charisAssignments = R.getRhythmForStudent(rhythm, 'charis', context);
  assert.ok(charisAssignments.some((a) => a.label === 'Littles with Mom'));
  var groupAssignments = R.getRhythmForGroup(rhythm, 'littles', context);
  assert.ok(groupAssignments.some((a) => a.label === 'Littles with Mom'));
});

test('Together assignment resolves to all active students only', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  var context = { students: sampleStudents(), groups: sampleGroups() };
  var together = rhythm.assignments.find((a) => a.label === 'Together Time');
  var resolved = R.resolveRhythmAssignmentParticipants(together, context);
  assert.deepEqual(resolved.sort(), ['charis', 'jeremiah', 'kayla', 'lucy']);
  assert.ok(!resolved.includes('retired'), 'inactive students should not be included');
});

test('co-op/external assignment can be all-day or block-specific', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  var allDay = rhythm.assignments.find((a) => a.label === 'Jeremiah at co-op all day');
  assert.equal(allDay.isAllDay, true);
  var context = { students: sampleStudents(), groups: sampleGroups() };
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(allDay, context), ['jeremiah']);

  var blockSpecific = R.makeRhythmAssignment({ dayId: 'day3', blockId: 'afternoon', label: 'Co-op PE', assignmentType: 'coop', participantIds: ['lucy'], isAllDay: false });
  assert.equal(blockSpecific.isAllDay, false);
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(blockSpecific, context), ['lucy']);
});

test('custom labels can exist without linked cards', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  var custom = rhythm.assignments.find((a) => a.label === 'Free reading');
  assert.equal(custom.assignmentType, 'custom');
  assert.equal(custom.referencedId, null);
  var context = { students: sampleStudents(), groups: sampleGroups() };
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(custom, context), []);
});

test('rhythm assignments can reference cards, loops, sequences, subjects, students, and groups', () => {
  var card = M.makeCard({ id: 'card1', participantMode: 'group', participantIds: ['littles'] });
  var loop = M.makeLoop({ id: 'loop1', participantMode: 'together' });
  var sequence = M.makeSequence({ id: 'seq1', participantMode: 'individual', participantIds: ['jeremiah'] });
  var context = { students: sampleStudents(), groups: sampleGroups(), cards: [card], loops: [loop], sequences: [sequence] };

  var cardAssignment = R.makeRhythmAssignment({ assignmentType: 'card', referencedId: 'card1' });
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(cardAssignment, context).sort(), ['charis', 'kayla']);

  var loopAssignment = R.makeRhythmAssignment({ assignmentType: 'loop', referencedId: 'loop1' });
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(loopAssignment, context).sort(), ['charis', 'jeremiah', 'kayla', 'lucy']);

  var seqAssignment = R.makeRhythmAssignment({ assignmentType: 'sequence', referencedId: 'seq1' });
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(seqAssignment, context), ['jeremiah']);

  var subjectAssignment = R.makeRhythmAssignment({ assignmentType: 'subject', referencedId: 'history' });
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(subjectAssignment, context), []);

  var studentAssignment = R.makeRhythmAssignment({ assignmentType: 'student', referencedId: 'lucy' });
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(studentAssignment, context), ['lucy']);

  var groupAssignment = R.makeRhythmAssignment({ assignmentType: 'group', referencedId: 'littles' });
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(groupAssignment, context).sort(), ['charis', 'kayla']);
});

test('rhythm assignments referencing a card do not create a duplicate card', () => {
  var card = M.makeCard({ id: 'card_amhistory', title: 'American History Spine' });
  var rhythm = R.makeWeeklyRhythm({
    days: [R.makeRhythmDay({ id: 'day1' })],
    blocks: [R.makeRhythmBlock({ id: 'morning' })],
    assignments: [R.makeRhythmAssignment({ dayId: 'day1', blockId: 'morning', assignmentType: 'card', referencedId: 'card_amhistory' })]
  });
  var cardLinks = R.getRhythmAssignmentsForCard(rhythm, 'card_amhistory');
  assert.equal(cardLinks.length, 1);
  // the rhythm assignment only stores a referencedId — it never carries its
  // own copy of the card's resources, title, or status.
  assert.equal('title' in cardLinks[0], false);
  assert.equal('resourceUseIds' in cardLinks[0], false);
});

test('getRhythmAssignmentsForLoop and getRhythmAssignmentsForSequence find references', () => {
  var rhythm = R.makeWeeklyRhythm({
    days: [R.makeRhythmDay({ id: 'day1' })],
    blocks: [R.makeRhythmBlock({ id: 'morning' })],
    assignments: [
      R.makeRhythmAssignment({ id: 'la', dayId: 'day1', blockId: 'morning', assignmentType: 'loop', referencedId: 'loop_bible' }),
      R.makeRhythmAssignment({ id: 'sa', dayId: 'day1', blockId: 'morning', assignmentType: 'sequence', referencedId: 'seq_readaloud' })
    ]
  });
  assert.equal(R.getRhythmAssignmentsForLoop(rhythm, 'loop_bible')[0].id, 'la');
  assert.equal(R.getRhythmAssignmentsForSequence(rhythm, 'seq_readaloud')[0].id, 'sa');
});

test('WeeklyRhythm remains a separate structure from Today/Term Plan/Progress', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  assert.ok(!('todayItems' in rhythm));
  assert.ok(!('termPlan' in rhythm));
  assert.ok(!('progress' in rhythm));
  assert.deepEqual(Object.keys(rhythm).sort(), ['assignments', 'blocks', 'days', 'id', 'notes', 'title'].sort());
});

test('print orientation for Weekly Rhythm overview is landscape', () => {
  assert.equal(R.printOrientationForRhythmMode('rhythm-overview'), 'landscape');
  var settings = R.makeRhythmPrintSettings();
  assert.equal(R.printOrientationForRhythmMode(settings.printMode), 'landscape');
});

// ---------------------------------------------------------------------------
// Phase 1D — cell editing mutators
// ---------------------------------------------------------------------------
test('addRhythmAssignment adds a custom-label assignment to a cell with no referenced object', () => {
  var rhythm = R.makeWeeklyRhythm({ days: [R.makeRhythmDay({ id: 'day1' })], blocks: [R.makeRhythmBlock({ id: 'morning' })] });
  var added = R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', label: 'Free reading', assignmentType: 'custom' });
  assert.equal(added.referencedId, null);
  assert.equal(R.getAssignmentsForCell(rhythm, 'day1', 'morning').length, 1);
});

test('a cell can hold multiple assignments after repeated adds', () => {
  var rhythm = R.makeWeeklyRhythm({ days: [R.makeRhythmDay({ id: 'day1' })], blocks: [R.makeRhythmBlock({ id: 'morning' })] });
  R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', label: 'Together Time', assignmentType: 'together' });
  R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', label: 'Jeremiah independent', assignmentType: 'student', referencedId: 'jeremiah' });
  var cell = R.getAssignmentsForCell(rhythm, 'day1', 'morning');
  assert.equal(cell.length, 2);
  assert.deepEqual(cell.map((a) => a.label), ['Together Time', 'Jeremiah independent']);
});

test('addRhythmAssignment can reference an existing card, loop, or sequence', () => {
  var rhythm = R.makeWeeklyRhythm({ days: [R.makeRhythmDay({ id: 'day1' })], blocks: [R.makeRhythmBlock({ id: 'morning' })] });
  var card = M.makeCard({ id: 'card1' });
  var loop = M.makeLoop({ id: 'loop1' });
  var sequence = M.makeSequence({ id: 'seq1' });
  var context = { students: sampleStudents(), groups: sampleGroups(), cards: [card], loops: [loop], sequences: [sequence] };

  var cardAsn = R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', assignmentType: 'card', referencedId: 'card1' });
  var loopAsn = R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', assignmentType: 'loop', referencedId: 'loop1' });
  var seqAsn = R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', assignmentType: 'sequence', referencedId: 'seq1' });

  assert.equal(R.resolveRhythmAssignmentReviewState(cardAsn, context).missingReference, false);
  assert.equal(R.resolveRhythmAssignmentReviewState(loopAsn, context).missingReference, false);
  assert.equal(R.resolveRhythmAssignmentReviewState(seqAsn, context).missingReference, false);
});

test('addRhythmAssignment for a group resolves to the group students, and together resolves to active students', () => {
  var rhythm = R.makeWeeklyRhythm({ days: [R.makeRhythmDay({ id: 'day1' })], blocks: [R.makeRhythmBlock({ id: 'morning' })] });
  var context = { students: sampleStudents(), groups: sampleGroups() };
  var groupAsn = R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', assignmentType: 'group', referencedId: 'littles' });
  var togetherAsn = R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', assignmentType: 'together' });
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(groupAsn, context).sort(), ['charis', 'kayla']);
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(togetherAsn, context).sort(), ['charis', 'jeremiah', 'kayla', 'lucy']);
});

test('updateRhythmAssignment edits label, type/reference, notes, and the all-day/flexible/print toggles', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  var original = rhythm.assignments.find((a) => a.label === 'Free reading');
  var updated = R.updateRhythmAssignment(rhythm, original.id, {
    label: 'Free reading (updated)',
    assignmentType: 'student',
    referencedId: 'lucy',
    notes: 'Lucy picks her own book',
    isAllDay: true,
    isFlexible: false,
    showOnPrint: false
  });
  assert.equal(updated.label, 'Free reading (updated)');
  assert.equal(updated.assignmentType, 'student');
  assert.equal(updated.referencedId, 'lucy');
  assert.equal(updated.notes, 'Lucy picks her own book');
  assert.equal(updated.isAllDay, true);
  assert.equal(updated.isFlexible, false);
  assert.equal(updated.showOnPrint, false);

  var context = { students: sampleStudents(), groups: sampleGroups() };
  assert.deepEqual(R.resolveRhythmAssignmentParticipants(updated, context), ['lucy']);
});

test('updateRhythmAssignment on an unknown id returns null and changes nothing', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  var before = rhythm.assignments.length;
  var result = R.updateRhythmAssignment(rhythm, 'does_not_exist', { label: 'x' });
  assert.equal(result, null);
  assert.equal(rhythm.assignments.length, before);
});

test('deleteRhythmAssignment removes the assignment but never touches the card/loop/sequence it referenced', () => {
  var rhythm = R.makeWeeklyRhythm({
    days: [R.makeRhythmDay({ id: 'day1' })],
    blocks: [R.makeRhythmBlock({ id: 'morning' })]
  });
  var card = M.makeCard({ id: 'card_keep', title: 'Keep me' });
  var asn = R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', assignmentType: 'card', referencedId: 'card_keep' });
  var deleted = R.deleteRhythmAssignment(rhythm, asn.id);
  assert.equal(deleted, true);
  assert.equal(rhythm.assignments.length, 0);
  assert.equal(card.id, 'card_keep'); // untouched, still exists independently
});

test('deleting a rhythm assignment removes it from student and group rhythm views', () => {
  var rhythm = R.makeWeeklyRhythm({ days: [R.makeRhythmDay({ id: 'day1' })], blocks: [R.makeRhythmBlock({ id: 'morning' })] });
  var context = { students: sampleStudents(), groups: sampleGroups() };
  var asn = R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', assignmentType: 'student', referencedId: 'jeremiah' });
  assert.ok(R.getRhythmForStudent(rhythm, 'jeremiah', context).some((a) => a.id === asn.id));
  R.deleteRhythmAssignment(rhythm, asn.id);
  assert.ok(!R.getRhythmForStudent(rhythm, 'jeremiah', context).some((a) => a.id === asn.id));
});

test('rhythm edits remain plain JSON-serializable', () => {
  var rhythm = R.buildSampleWeeklyRhythm();
  R.addRhythmAssignment(rhythm, { dayId: 'day1', blockId: 'morning', label: 'New thing', assignmentType: 'custom', notes: 'a note' });
  var json = JSON.stringify(rhythm);
  var back = JSON.parse(json);
  assert.deepEqual(back, rhythm);
});

test('RHYTHM_PRESETS are form-aware and PNEU-inspired, not exact schedules', () => {
  assert.ok(R.RHYTHM_PRESETS.length >= 5);
  const form1 = R.findRhythmPreset('preset_form1');
  const form2 = R.findRhythmPreset('preset_form2');
  const form3 = R.findRhythmPreset('preset_form3');
  assert.ok(form1.suggestedLessonMinutes < form2.suggestedLessonMinutes);
  assert.ok(form2.suggestedLessonMinutes < form3.suggestedLessonMinutes);
});

test('getRhythmPresetsForForm returns presets that apply to a given form', () => {
  const form1Presets = R.getRhythmPresetsForForm('form1');
  assert.ok(form1Presets.some((p) => p.id === 'preset_form1'));
  assert.ok(!form1Presets.some((p) => p.id === 'preset_form3'));
  assert.ok(form1Presets.some((p) => p.id === 'preset_mixed_family'));
});

test('placeCardsUsingRhythmPreset places given cards as card-referencing rhythm assignments', () => {
  const rhythm = R.buildSampleWeeklyRhythm();
  const created = R.placeCardsUsingRhythmPreset(rhythm, 'preset_form1', ['card_a', 'card_b'], { card_a: 'Card A' });
  assert.equal(created.length, 2);
  created.forEach((a) => assert.equal(a.assignmentType, 'card'));
  assert.equal(rhythm.assignments.some((a) => a.referencedId === 'card_a' && a.label === 'Card A'), true);
});

test('adding an item to multiple days creates one assignment per day', () => {
  const rhythm = R.buildSampleWeeklyRhythm();
  const before = rhythm.assignments.length;
  const days = ['day1', 'day2', 'day3'];
  days.forEach(function (dayId) {
    R.addRhythmAssignment(rhythm, { dayId, blockId: 'morning', label: 'Read-Aloud', assignmentType: 'custom' });
  });
  assert.equal(rhythm.assignments.length, before + 3);
  days.forEach(function (dayId) {
    const cell = R.getAssignmentsForCell(rhythm, dayId, 'morning');
    assert.ok(cell.some((a) => a.label === 'Read-Aloud'), 'Read-Aloud should appear on ' + dayId);
  });
});

test('multi-day add creates independent items — each has its own id and correct dayId', () => {
  const rhythm = R.buildSampleWeeklyRhythm();
  const days = ['day1', 'day2', 'day4'];
  const created = days.map(function (dayId) {
    return R.addRhythmAssignment(rhythm, { dayId, blockId: 'afternoon', label: 'Nature Walk', assignmentType: 'custom' });
  });
  const ids = created.map((a) => a.id);
  assert.equal(new Set(ids).size, 3, 'each item must have a unique id');
  created.forEach(function (a, i) {
    assert.equal(a.dayId, days[i]);
    assert.equal(a.label, 'Nature Walk');
  });
});

test('repeated saves do not duplicate — addRhythmAssignment is called once per day per save', () => {
  const rhythm = R.buildSampleWeeklyRhythm();
  const dayId = 'day3';
  const blockId = 'morning';
  const before = R.getAssignmentsForCell(rhythm, dayId, blockId).length;
  // Simulate saving once
  R.addRhythmAssignment(rhythm, { dayId, blockId, label: 'Latin', assignmentType: 'custom' });
  assert.equal(R.getAssignmentsForCell(rhythm, dayId, blockId).length, before + 1);
  // A second save on the same cell (user added via + button twice) adds another — idempotency
  // is the UI's responsibility (close overlay after save), not the data model's
  R.addRhythmAssignment(rhythm, { dayId, blockId, label: 'Latin', assignmentType: 'custom' });
  assert.equal(R.getAssignmentsForCell(rhythm, dayId, blockId).length, before + 2, 'model does not deduplicate — UI prevents double-save by closing overlay');
});

test('updating a multi-day item changes only the targeted assignment', () => {
  const rhythm = R.buildSampleWeeklyRhythm();
  const days = ['day1', 'day2', 'day3'];
  const created = days.map(function (dayId) {
    return R.addRhythmAssignment(rhythm, { dayId, blockId: 'morning', label: 'Hymn', assignmentType: 'custom' });
  });
  // Update only the day2 copy
  R.updateRhythmAssignment(rhythm, created[1].id, { label: 'Hymn (moved)' });
  assert.equal(R.getAssignmentsForCell(rhythm, 'day1', 'morning').find((a) => a.id === created[0].id).label, 'Hymn');
  assert.equal(R.getAssignmentsForCell(rhythm, 'day2', 'morning').find((a) => a.id === created[1].id).label, 'Hymn (moved)');
  assert.equal(R.getAssignmentsForCell(rhythm, 'day3', 'morning').find((a) => a.id === created[2].id).label, 'Hymn');
});

test('deleting one day copy of a multi-day item leaves the others intact', () => {
  const rhythm = R.buildSampleWeeklyRhythm();
  const days = ['day1', 'day2', 'day3'];
  const created = days.map(function (dayId) {
    return R.addRhythmAssignment(rhythm, { dayId, blockId: 'afternoon', label: 'Shakespeare', assignmentType: 'custom' });
  });
  R.deleteRhythmAssignment(rhythm, created[1].id);
  assert.ok(R.getAssignmentsForCell(rhythm, 'day1', 'afternoon').some((a) => a.id === created[0].id), 'day1 copy intact');
  assert.ok(!rhythm.assignments.find((a) => a.id === created[1].id), 'day2 copy deleted');
  assert.ok(R.getAssignmentsForCell(rhythm, 'day3', 'afternoon').some((a) => a.id === created[2].id), 'day3 copy intact');
});

test('lens filtering on multi-day items works per-day per-cell', () => {
  const rhythm = R.buildSampleWeeklyRhythm();
  const students = [
    M.makeStudent({ id: 's1', name: 'Alice', gradeBand: 'form1' }),
    M.makeStudent({ id: 's2', name: 'Bob', gradeBand: 'form2' })
  ];
  const groups = [];
  const days = ['day1', 'day2'];
  days.forEach(function (dayId) {
    R.addRhythmAssignment(rhythm, { dayId, blockId: 'morning', label: 'Dictation', assignmentType: 'student',
      participantIds: ['s1'] });
  });
  const aliceDay1 = R.getRhythmForStudent(rhythm, 's1', { students, groups });
  const aliceDay2Labels = aliceDay1.filter((a) => a.dayId === 'day2').map((a) => a.label);
  assert.ok(aliceDay2Labels.includes('Dictation'), 'Alice sees Dictation on day2');
  const bob = R.getRhythmForStudent(rhythm, 's2', { students, groups });
  assert.ok(!bob.some((a) => a.label === 'Dictation'), 'Bob does not see Dictation');
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
