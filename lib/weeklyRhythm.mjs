// Family School Map — Weekly Rhythm Builder (Phase 1A.5).
//
// Pure, dependency-free data model + helpers for the "missing middle layer"
// between the Family School Map (what are we doing, and who is it for?) and
// Today (what exact assignment comes next?). Weekly Rhythm answers: when do
// the big buckets happen, in broad daily strokes?
//
// Explicitly NOT in scope here: localStorage/persistence, Today, Term Plan,
// Progress, accounts, minute-by-minute scheduling. A WeeklyRhythm is a
// separate, optional layer — it does not replace or duplicate cards, loops,
// sequences, or resources; it only references them.
//
// No DOM, no localStorage, no fetch — runs unmodified under plain `node`.

import { resolveParticipants } from './familyMap.mjs';

function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
export const RHYTHM_ASSIGNMENT_TYPES = [
  'custom',  // a plain label, no linked entity (e.g. "Catch-up / flex")
  'student', // referencedId = studentId (or participantIds explicit)
  'group',   // referencedId = groupId
  'together',// all active students
  'coop',    // co-op/external; usually participantIds explicit, may be all-day
  'subject', // referencedId = subjectColumnId; not a per-student assignment
  'card',    // referencedId = cardId; participants derived from the card
  'loop',    // referencedId = loopId; participants derived from the loop
  'sequence' // referencedId = sequenceId; participants derived from the sequence
];

export const RHYTHM_PRINT_MODES = ['rhythm-overview'];
export const RHYTHM_PRINT_ORIENTATION = { 'rhythm-overview': 'landscape' };

export function printOrientationForRhythmMode(printMode) {
  return RHYTHM_PRINT_ORIENTATION[printMode] || 'landscape';
}

// ---------------------------------------------------------------------------
// WeeklyRhythm / RhythmDay / RhythmBlock / RhythmAssignment
// ---------------------------------------------------------------------------
export function makeWeeklyRhythm(fields) {
  return Object.assign({
    id: newId('rhythm'),
    title: 'Weekly Rhythm',
    days: [],        // RhythmDay[]
    blocks: [],       // RhythmBlock[]
    assignments: [],  // RhythmAssignment[]
    notes: ''
  }, fields);
}

export function makeRhythmDay(fields) {
  return Object.assign({
    id: newId('rday'),
    label: '',
    sortOrder: 0,
    dateMode: 'day-number' // day-number | weekday | date — display hint only, not scheduling math
  }, fields);
}

export function makeRhythmBlock(fields) {
  return Object.assign({
    id: newId('rblock'),
    label: '',
    sortOrder: 0,
    defaultTimeRange: '',
    color: '#888888',
    notes: ''
  }, fields);
}

export function makeRhythmAssignment(fields) {
  return Object.assign({
    id: newId('rasn'),
    dayId: null,
    blockId: null,
    label: '',
    assignmentType: 'custom', // see RHYTHM_ASSIGNMENT_TYPES
    referencedId: null,
    participantIds: null, // explicit override; null = derive from assignmentType/referencedId
    audience: null,
    notes: '',
    sortOrder: 0,
    color: null,
    showOnPrint: true,
    isAllDay: false,
    isFlexible: false
  }, fields);
}

export function makeRhythmPrintSettings(fields) {
  return Object.assign({
    printMode: 'rhythm-overview', // see RHYTHM_PRINT_MODES
    studentId: null,
    groupId: null,
    includedDayIds: null,   // null = all days
    includedBlockIds: null, // null = all blocks
    compact: false
  }, fields);
}

// ---------------------------------------------------------------------------
// Cell / day / block lookups
// ---------------------------------------------------------------------------
export function getAssignmentsForDay(rhythm, dayId) {
  return rhythm.assignments
    .filter((a) => a.dayId === dayId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getAssignmentsForBlock(rhythm, blockId) {
  return rhythm.assignments
    .filter((a) => a.blockId === blockId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// A single cell (one day x one block) can hold multiple assignments.
export function getAssignmentsForCell(rhythm, dayId, blockId) {
  return rhythm.assignments
    .filter((a) => a.dayId === dayId && a.blockId === blockId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------------------------------------------------------------------------
// Participant resolution — mirrors resolveResourceUseParticipants: explicit
// participantIds win; otherwise derive from assignmentType/referencedId.
// context = {students, groups, cards, loops, sequences}
// ---------------------------------------------------------------------------
export function resolveRhythmAssignmentParticipants(assignment, context) {
  context = context || {};
  if (Array.isArray(assignment.participantIds) && assignment.participantIds.length) {
    return assignment.participantIds.slice();
  }
  var students = context.students || [];
  var groups = context.groups || [];

  if (assignment.assignmentType === 'together') {
    return students.filter((s) => s.active).map((s) => s.id);
  }
  if (assignment.assignmentType === 'student') {
    return assignment.referencedId ? [assignment.referencedId] : [];
  }
  if (assignment.assignmentType === 'group') {
    var group = groups.find((g) => g.id === assignment.referencedId);
    return group ? group.studentIds.slice() : [];
  }
  if (assignment.assignmentType === 'card') {
    var card = (context.cards || []).find((c) => c.id === assignment.referencedId);
    return card ? resolveParticipants(card, students, groups) : [];
  }
  if (assignment.assignmentType === 'loop') {
    var loop = (context.loops || []).find((l) => l.id === assignment.referencedId);
    return loop ? resolveParticipants(loop, students, groups) : [];
  }
  if (assignment.assignmentType === 'sequence') {
    var sequence = (context.sequences || []).find((s) => s.id === assignment.referencedId);
    return sequence ? resolveParticipants(sequence, students, groups) : [];
  }
  // 'coop' (no explicit participantIds given) and 'subject' and 'custom'
  // have no inferred participants — they're not tied to specific students.
  return [];
}

// ---------------------------------------------------------------------------
// Student / Group rhythm views
// ---------------------------------------------------------------------------
export function getRhythmForStudent(rhythm, studentId, context) {
  return rhythm.assignments.filter((a) =>
    resolveRhythmAssignmentParticipants(a, context).indexOf(studentId) > -1
  );
}

export function getRhythmForGroup(rhythm, groupId, context) {
  var groups = (context && context.groups) || [];
  var group = groups.find((g) => g.id === groupId);
  if (!group) return [];
  return rhythm.assignments.filter((a) => {
    var participants = resolveRhythmAssignmentParticipants(a, context);
    return group.studentIds.some((id) => participants.indexOf(id) > -1);
  });
}

// ---------------------------------------------------------------------------
// Card / Loop / Sequence cross-reference — find every rhythm assignment that
// points at a given card/loop/sequence (so editing one place stays honest
// about everywhere it shows up in the rhythm).
// ---------------------------------------------------------------------------
export function getRhythmAssignmentsForCard(rhythm, cardId) {
  return rhythm.assignments.filter((a) => a.assignmentType === 'card' && a.referencedId === cardId);
}

export function getRhythmAssignmentsForLoop(rhythm, loopId) {
  return rhythm.assignments.filter((a) => a.assignmentType === 'loop' && a.referencedId === loopId);
}

export function getRhythmAssignmentsForSequence(rhythm, sequenceId) {
  return rhythm.assignments.filter((a) => a.assignmentType === 'sequence' && a.referencedId === sequenceId);
}

// ---------------------------------------------------------------------------
// Sample weekly rhythm — sample data only, not persistence.
// ---------------------------------------------------------------------------
export function buildSampleWeeklyRhythm() {
  var days = [
    makeRhythmDay({ id: 'day1', label: 'Day 1', sortOrder: 0 }),
    makeRhythmDay({ id: 'day2', label: 'Day 2', sortOrder: 1 }),
    makeRhythmDay({ id: 'day3', label: 'Day 3', sortOrder: 2 }),
    makeRhythmDay({ id: 'day4', label: 'Day 4', sortOrder: 3 }),
    makeRhythmDay({ id: 'day5', label: 'Day 5', sortOrder: 4 })
  ];

  var blocks = [
    makeRhythmBlock({ id: 'morning', label: 'Morning Rhythm', sortOrder: 0, color: '#d4537e' }),
    makeRhythmBlock({ id: 'lunch', label: 'Lunch', sortOrder: 1, color: '#e0b23c' }),
    makeRhythmBlock({ id: 'afternoon', label: 'Afternoon Rhythm', sortOrder: 2, color: '#378add' })
  ];

  var assignments = [
    makeRhythmAssignment({ id: 'a1', dayId: 'day1', blockId: 'morning', label: 'Together Time', assignmentType: 'together', sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a2', dayId: 'day1', blockId: 'morning', label: 'Jeremiah independent', assignmentType: 'student', referencedId: 'jeremiah', sortOrder: 1 }),
    makeRhythmAssignment({ id: 'a3', dayId: 'day1', blockId: 'morning', label: 'Lucy independent', assignmentType: 'student', referencedId: 'lucy', sortOrder: 2 }),
    makeRhythmAssignment({ id: 'a4', dayId: 'day1', blockId: 'morning', label: 'Littles with Mom', assignmentType: 'group', referencedId: 'littles', sortOrder: 3 }),

    makeRhythmAssignment({ id: 'a5', dayId: 'day2', blockId: 'morning', label: 'Jeremiah at co-op all day', assignmentType: 'coop', referencedId: null, participantIds: ['jeremiah'], isAllDay: true, sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a6', dayId: 'day2', blockId: 'morning', label: 'Lucy independent', assignmentType: 'student', referencedId: 'lucy', sortOrder: 1 }),
    makeRhythmAssignment({ id: 'a7', dayId: 'day2', blockId: 'morning', label: 'Littles with Mom', assignmentType: 'group', referencedId: 'littles', sortOrder: 2 }),

    makeRhythmAssignment({ id: 'a8', dayId: 'day3', blockId: 'afternoon', label: 'Nature Study', assignmentType: 'together', sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a9', dayId: 'day3', blockId: 'afternoon', label: 'Outside time', assignmentType: 'together', sortOrder: 1 }),
    makeRhythmAssignment({ id: 'a10', dayId: 'day3', blockId: 'afternoon', label: 'Free reading', assignmentType: 'custom', sortOrder: 2 }),

    makeRhythmAssignment({ id: 'a11', dayId: 'day4', blockId: 'afternoon', label: 'Afternoon occupations', assignmentType: 'together', sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a12', dayId: 'day5', blockId: 'afternoon', label: 'Catch-up / flex', assignmentType: 'custom', isFlexible: true, sortOrder: 0 })
  ];

  return makeWeeklyRhythm({ id: 'rhythm_sample', title: 'Our Weekly Rhythm', days, blocks, assignments });
}
