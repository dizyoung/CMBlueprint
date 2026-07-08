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
// Cell editing — add/update/delete RhythmAssignment objects only. These
// never touch cards/loops/sequences/resources; a rhythm assignment only
// stores a reference to them (see makeRhythmAssignment's referencedId).
// ---------------------------------------------------------------------------
export function addRhythmAssignment(rhythm, fields) {
  fields = fields || {};
  if (fields.sortOrder === undefined) {
    var existing = getAssignmentsForCell(rhythm, fields.dayId, fields.blockId);
    fields = Object.assign({}, fields, { sortOrder: existing.length });
  }
  var assignment = makeRhythmAssignment(fields);
  rhythm.assignments.push(assignment);
  return assignment;
}

export function updateRhythmAssignment(rhythm, assignmentId, fields) {
  var assignment = rhythm.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return null;
  Object.assign(assignment, fields);
  return assignment;
}

export function deleteRhythmAssignment(rhythm, assignmentId) {
  var index = rhythm.assignments.findIndex((a) => a.id === assignmentId);
  if (index === -1) return false;
  rhythm.assignments.splice(index, 1);
  return true;
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
// Rhythm review state — gentle, parent-facing "Needs rhythm review" support.
//
// Reference-based display means a rhythm assignment that points at a card
// always shows that card's *current* title/subject/participants — nothing
// here ever silently rewrites a rhythm assignment when its source changes.
// The only thing this layer flags is: (a) the referenced card/loop/sequence/
// student/group/subject no longer exists, or (b) the card's audience has
// visibly diverged from the audience it had when added to the rhythm (if
// that snapshot was recorded on the assignment). Both are surfaced as a
// review hint for a parent to look at — never auto-resolved.
// context = {students, groups, cards, loops, sequences, subjectColumns}
// ---------------------------------------------------------------------------
export function resolveRhythmAssignmentReviewState(assignment, context) {
  context = context || {};
  var missingReference = false;
  var reasons = [];

  function checkReference(list, label) {
    var found = (list || []).find((item) => item.id === assignment.referencedId);
    if (!found) {
      missingReference = true;
      reasons.push('Referenced ' + label + ' no longer exists');
    }
    return found;
  }

  if (assignment.assignmentType === 'card') {
    var card = checkReference(context.cards, 'card');
    if (card && assignment.audience && card.audience !== assignment.audience) {
      reasons.push('Card audience changed since this was added to the rhythm');
    }
  } else if (assignment.assignmentType === 'loop') {
    checkReference(context.loops, 'loop');
  } else if (assignment.assignmentType === 'sequence') {
    checkReference(context.sequences, 'sequence');
  } else if (assignment.assignmentType === 'group') {
    checkReference(context.groups, 'group');
  } else if (assignment.assignmentType === 'student') {
    checkReference(context.students, 'student');
  } else if (assignment.assignmentType === 'subject') {
    checkReference(context.subjectColumns, 'subject');
  }
  // 'together' and 'custom' have nothing to reference, so nothing to flag.

  return {
    needsRhythmReview: reasons.length > 0,
    missingReference: missingReference,
    rhythmReviewReason: reasons.length ? reasons.join('; ') : null
  };
}

export function getRhythmReviewItems(rhythm, context) {
  return rhythm.assignments
    .map((a) => Object.assign({}, a, resolveRhythmAssignmentReviewState(a, context)))
    .filter((a) => a.needsRhythmReview);
}

// ---------------------------------------------------------------------------
// "Needs rhythm placement" — find cards/loops/sequences that don't yet show
// up anywhere in the rhythm. Not every card needs rhythm placement (optional,
// unplaced, and map-only cards may intentionally have none) — callers decide
// which statuses matter via opts.includeStatuses.
// ---------------------------------------------------------------------------
export function cardHasRhythmPlacement(rhythm, cardId) {
  return rhythm.assignments.some((a) => a.assignmentType === 'card' && a.referencedId === cardId);
}

export function loopHasRhythmPlacement(rhythm, loopId) {
  return rhythm.assignments.some((a) => a.assignmentType === 'loop' && a.referencedId === loopId);
}

export function sequenceHasRhythmPlacement(rhythm, sequenceId) {
  return rhythm.assignments.some((a) => a.assignmentType === 'sequence' && a.referencedId === sequenceId);
}

export function getCardsWithoutRhythmPlacement(rhythm, cards, opts) {
  opts = opts || {};
  var statuses = opts.includeStatuses || ['active'];
  return cards.filter((c) => statuses.indexOf(c.status) > -1 && !cardHasRhythmPlacement(rhythm, c.id));
}

export function getLoopsWithoutRhythmPlacement(rhythm, loops) {
  return loops.filter((l) => !loopHasRhythmPlacement(rhythm, l.id));
}

export function getSequencesWithoutRhythmPlacement(rhythm, sequences) {
  return sequences.filter((s) => !sequenceHasRhythmPlacement(rhythm, s.id));
}

// ---------------------------------------------------------------------------
// Rhythm presets — PNEU-inspired, form-aware, editable *starting points* for
// the Weekly Rhythm. These are not an exact reproduction of any historical
// PNEU time table or any modern provider's schedule — they're broad shape
// only (lesson-length guardrail, daily/weekly rhythm, family vs individual
// split), inspired by general Charlotte Mason / PNEU time-table patterns and
// kept fully editable. Parent-facing copy should call these "Suggested
// rhythm" / "Charlotte Mason-inspired" / "Editable starting point" — never
// "Official" or "Exact PNEU schedule".
// ---------------------------------------------------------------------------
export const RHYTHM_PRESETS = [
  {
    id: 'preset_form1', label: 'Form I morning rhythm', forms: ['form1'],
    description: 'A gentle, short-lesson morning rhythm for younger learners — Charlotte Mason-inspired, not an exact historical schedule.',
    suggestedLessonMinutes: 20,
    slots: [
      { blockLabel: 'morning', assignmentType: 'together', label: 'Together Time', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'individual', label: 'Short individual lesson', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'together', label: 'Beauty / Riches (short)', frequency: 'weekly' },
      { blockLabel: 'afternoon', assignmentType: 'together', label: 'Outside / free time', frequency: 'daily' }
    ]
  },
  {
    id: 'preset_form2', label: 'Form II morning rhythm', forms: ['form2'],
    description: 'A moderate morning rhythm for middle-form learners, with somewhat longer lessons than Form I.',
    suggestedLessonMinutes: 30,
    slots: [
      { blockLabel: 'morning', assignmentType: 'together', label: 'Together Time', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'individual', label: 'Individual lesson', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'individual', label: 'Skill subject practice', frequency: 'several-times-weekly' },
      { blockLabel: 'afternoon', assignmentType: 'together', label: 'Beauty / Riches', frequency: 'weekly' }
    ]
  },
  {
    id: 'preset_form3', label: 'Form III morning rhythm', forms: ['form3'],
    description: 'A fuller morning rhythm for older learners, with longer lessons and some independent work.',
    suggestedLessonMinutes: 45,
    slots: [
      { blockLabel: 'morning', assignmentType: 'together', label: 'Together Time', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'individual', label: 'Individual lesson', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'individual', label: 'Independent reading / extension', frequency: 'several-times-weekly' },
      { blockLabel: 'afternoon', assignmentType: 'individual', label: 'Older-form optional subject', frequency: 'weekly' }
    ]
  },
  {
    id: 'preset_mixed_family', label: 'Mixed-age family rhythm', forms: ['form1', 'form2', 'form3'],
    description: 'A together-leaning rhythm for families schooling several forms at once.',
    suggestedLessonMinutes: 25,
    slots: [
      { blockLabel: 'morning', assignmentType: 'together', label: 'Together Time', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'group', label: 'Older students together', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'group', label: 'Littles together', frequency: 'daily' },
      { blockLabel: 'afternoon', assignmentType: 'together', label: 'Beauty / Riches', frequency: 'weekly' }
    ]
  },
  {
    id: 'preset_shorter_modern', label: 'Shorter modern homeschool rhythm', forms: ['form1', 'form2', 'form3'],
    description: 'A condensed rhythm for families who want a CM-inspired flavor on a tighter daily schedule.',
    suggestedLessonMinutes: 20,
    slots: [
      { blockLabel: 'morning', assignmentType: 'together', label: 'Together Time (brief)', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'individual', label: 'Individual lesson (brief)', frequency: 'daily' }
    ]
  },
  {
    id: 'preset_four_day', label: 'Four-day week rhythm', forms: ['form1', 'form2', 'form3'],
    description: 'The same broad morning rhythm spread across four school days instead of five.',
    suggestedLessonMinutes: 25,
    slots: [
      { blockLabel: 'morning', assignmentType: 'together', label: 'Together Time', frequency: 'daily' },
      { blockLabel: 'morning', assignmentType: 'individual', label: 'Individual lesson', frequency: 'daily' },
      { blockLabel: 'afternoon', assignmentType: 'together', label: 'Beauty / Riches', frequency: 'weekly' }
    ]
  },
  {
    id: 'preset_coop_day', label: 'Co-op day rhythm', forms: ['form1', 'form2', 'form3'],
    description: 'A rhythm that sets aside one day mainly for co-op / outside classes.',
    suggestedLessonMinutes: 30,
    slots: [
      { blockLabel: 'morning', assignmentType: 'coop', label: 'Co-op / outside classes', frequency: 'weekly' },
      { blockLabel: 'afternoon', assignmentType: 'custom', label: 'Catch-up / flex', frequency: 'weekly' }
    ]
  }
];

export function findRhythmPreset(presetId) {
  return RHYTHM_PRESETS.find((p) => p.id === presetId) || null;
}

export function getRhythmPresetsForForm(gradeBand) {
  return RHYTHM_PRESETS.filter((p) => p.forms.indexOf(gradeBand) > -1);
}

// Place a parent-selected set of cards into the rhythm using a preset as a
// starting point: one RhythmAssignment per card (assignmentType:'card',
// referencedId:cardId), distributed round-robin across the preset's slots
// (which determine day/block placement), and across the rhythm's available
// days. This never touches the cards themselves, and is just a starting
// point — fully editable afterward like any other rhythm assignment.
export function placeCardsUsingRhythmPreset(rhythm, presetId, cardIds, cardLabelById) {
  var preset = findRhythmPreset(presetId);
  if (!preset || !cardIds || !cardIds.length) return [];
  cardLabelById = cardLabelById || {};

  var days = rhythm.days.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  var blocksByLabel = {};
  rhythm.blocks.forEach((b) => { blocksByLabel[b.id] = b; });
  function blockIdForLabel(label) {
    var found = rhythm.blocks.find((b) => b.id === label || b.label.toLowerCase().indexOf(label) > -1);
    return found ? found.id : (rhythm.blocks[0] ? rhythm.blocks[0].id : null);
  }

  var created = [];
  cardIds.forEach(function (cardId, index) {
    var slot = preset.slots[index % preset.slots.length];
    var day = days.length ? days[index % days.length] : null;
    var blockId = blockIdForLabel(slot.blockLabel);
    created.push(addRhythmAssignment(rhythm, {
      dayId: day ? day.id : null,
      blockId: blockId,
      label: cardLabelById[cardId] || slot.label,
      assignmentType: 'card',
      referencedId: cardId
    }));
  });
  return created;
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
    // Day 1 — full morning rhythm
    makeRhythmAssignment({ id: 'a1', dayId: 'day1', blockId: 'morning', label: 'Bible Loop', assignmentType: 'loop', referencedId: 'loop_bible', sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a1b', dayId: 'day1', blockId: 'morning', label: 'Together Time', assignmentType: 'together', sortOrder: 1 }),
    makeRhythmAssignment({ id: 'a2', dayId: 'day1', blockId: 'morning', label: 'Jeremiah independent', assignmentType: 'student', referencedId: 'jeremiah', sortOrder: 2 }),
    makeRhythmAssignment({ id: 'a3', dayId: 'day1', blockId: 'morning', label: 'Lucy independent', assignmentType: 'student', referencedId: 'lucy', sortOrder: 3 }),
    makeRhythmAssignment({ id: 'a4', dayId: 'day1', blockId: 'morning', label: 'Littles with Mom', assignmentType: 'group', referencedId: 'littles', sortOrder: 4 }),
    makeRhythmAssignment({ id: 'a1c', dayId: 'day1', blockId: 'afternoon', label: 'Family Read-Alouds', assignmentType: 'sequence', referencedId: 'seq_readaloud', sortOrder: 0 }),

    // Day 2 — co-op day; Bible Loop still happens at home for those present
    makeRhythmAssignment({ id: 'a5', dayId: 'day2', blockId: 'morning', label: 'Jeremiah at co-op all day', assignmentType: 'coop', referencedId: null, participantIds: ['jeremiah'], isAllDay: true, sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a5b', dayId: 'day2', blockId: 'morning', label: 'Bible Loop', assignmentType: 'loop', referencedId: 'loop_bible', sortOrder: 1 }),
    makeRhythmAssignment({ id: 'a6', dayId: 'day2', blockId: 'morning', label: 'Lucy independent', assignmentType: 'student', referencedId: 'lucy', sortOrder: 2 }),
    makeRhythmAssignment({ id: 'a7', dayId: 'day2', blockId: 'morning', label: 'Littles with Mom', assignmentType: 'group', referencedId: 'littles', sortOrder: 3 }),

    // Day 3 — nature afternoon; Bible Loop in the morning
    makeRhythmAssignment({ id: 'a7b', dayId: 'day3', blockId: 'morning', label: 'Bible Loop', assignmentType: 'loop', referencedId: 'loop_bible', sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a7c', dayId: 'day3', blockId: 'morning', label: 'Together Time', assignmentType: 'together', sortOrder: 1 }),
    makeRhythmAssignment({ id: 'a8', dayId: 'day3', blockId: 'afternoon', label: 'Nature Study', assignmentType: 'card', referencedId: 'card_nature_study', sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a9', dayId: 'day3', blockId: 'afternoon', label: 'Outside time', assignmentType: 'together', sortOrder: 1 }),
    makeRhythmAssignment({ id: 'a10', dayId: 'day3', blockId: 'afternoon', label: 'Free reading', assignmentType: 'custom', sortOrder: 2 }),

    // Day 4
    makeRhythmAssignment({ id: 'a10b', dayId: 'day4', blockId: 'morning', label: 'Bible Loop', assignmentType: 'loop', referencedId: 'loop_bible', sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a11', dayId: 'day4', blockId: 'afternoon', label: 'Afternoon occupations', assignmentType: 'together', sortOrder: 0 }),
    makeRhythmAssignment({ id: 'a11b', dayId: 'day4', blockId: 'afternoon', label: 'Family Read-Alouds', assignmentType: 'sequence', referencedId: 'seq_readaloud', sortOrder: 1 }),

    // Day 5 — flex day; Bible Loop if not read yet
    makeRhythmAssignment({ id: 'a12', dayId: 'day5', blockId: 'afternoon', label: 'Catch-up / flex', assignmentType: 'custom', isFlexible: true, sortOrder: 0 })
  ];

  return makeWeeklyRhythm({ id: 'rhythm_sample', title: 'Our Weekly Rhythm', days, blocks, assignments });
}
