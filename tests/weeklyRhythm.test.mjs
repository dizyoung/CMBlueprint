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
