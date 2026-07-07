// Family School Map — Phase 1A adapter.
//
// Pure, dependency-free glue between the lib/familyMap.mjs data model and a
// renderable "app state" shape. Owns: building a sample in-memory app state
// from the model's factory functions, deriving map/lens/resource views from
// that state, and a small set of safe in-memory editing mutators.
//
// No DOM, no localStorage, no fetch — runs unmodified under plain `node` so
// every piece of render/derivation logic here can be unit tested without a
// browser. The HTML app (docs/app/family-school-map.html) is a thin renderer
// on top of this module; it should not duplicate this logic.

import * as M from './familyMap.mjs';
import * as R from './weeklyRhythm.mjs';

// ---------------------------------------------------------------------------
// Not built yet — model notes only. "Today" (what exact assignment comes
// next, right now) is intentionally out of scope through Phase 1B. When it
// is eventually built, it will need to read from: the Family School Map
// (cards/participants), the Weekly Rhythm (which buckets apply today),
// loops/sequences (current item per loop/sequence), resource progress
// (buildResourceRollup), and some not-yet-built schedule/calendar config
// (which day-of-week maps to which RhythmDay). Today should wait until
// those planning layers agree with each other; it must not be approximated
// here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sample in-memory app state
// ---------------------------------------------------------------------------
// One app-state object holds every collection Phase 1A needs to render the
// map, the lenses, loops, sequences, and the Book & Resource List. This is
// in-memory only — nothing here touches storage of any kind.
export function buildSampleAppState() {
  var students = [
    M.makeStudent({ id: 'charis', name: 'Charis', initials: 'C', color: '#e08a3c', gradeBand: 'form1', grade: '2nd', sortOrder: 0 }),
    M.makeStudent({ id: 'kayla', name: 'Kayla', initials: 'K', color: '#5c9e8f', gradeBand: 'form1', grade: '3rd', sortOrder: 1 }),
    M.makeStudent({ id: 'lucy', name: 'Lucy', initials: 'L', color: '#b5708a', gradeBand: 'form2', grade: '5th', sortOrder: 2 }),
    M.makeStudent({ id: 'jeremiah', name: 'Jeremiah', initials: 'J', color: '#3f7a82', gradeBand: 'form3', grade: '7th', sortOrder: 3 })
  ];

  var groups = [
    M.makeGroup({ id: 'older', label: 'Older Students', studentIds: ['lucy', 'jeremiah'], sortOrder: 0 }),
    M.makeGroup({ id: 'littles', label: 'Littles Together', studentIds: ['charis', 'kayla'], sortOrder: 1 })
  ];

  var subjectColumns = M.DEFAULT_VISIBLE_SUBJECT_COLUMNS.map(function (col, index) {
    return M.makeSubjectColumn({ id: col.id, label: col.label, color: col.color, sortOrder: index });
  });

  var loops = [
    M.makeLoop({
      id: 'loop_bible', title: 'Bible Loop', subjectColumnId: 'bible', audience: 'together',
      participantMode: 'together', turnsPerWeek: 4,
      itemIds: ['li_matthew', 'li_psalms', 'li_theology', 'li_ot'], currentItemId: 'li_matthew'
    })
  ];
  var loopItems = [
    M.makeLoopItem({ id: 'li_matthew', loopId: 'loop_bible', title: 'Matthew', resourceUseIds: ['ruse_bible_loop'], nextAssignment: 'chapter 1', sortOrder: 0 }),
    M.makeLoopItem({ id: 'li_psalms', loopId: 'loop_bible', title: 'Psalms + Proverbs', resourceUseIds: ['ruse_bible_loop'], nextAssignment: 'Psalm 1', sortOrder: 1 }),
    M.makeLoopItem({ id: 'li_theology', loopId: 'loop_bible', title: 'Theology', resourceUseIds: ['ruse_theology'], nextAssignment: 'lesson 1', sortOrder: 2 }),
    M.makeLoopItem({ id: 'li_ot', loopId: 'loop_bible', title: 'Old Testament', resourceUseIds: ['ruse_bible_loop'], nextAssignment: 'Genesis 1', sortOrder: 3 })
  ];

  var sequences = [
    M.makeSequence({
      id: 'seq_readaloud', title: 'Family Read-Alouds', subjectColumnId: 'literature', audience: 'together',
      participantMode: 'together', itemIds: ['si_1', 'si_2', 'si_3'], currentItemId: 'si_2'
    })
  ];
  var sequenceItems = [
    M.makeSequenceItem({ id: 'si_1', sequenceId: 'seq_readaloud', title: 'The Hobbit', status: 'completed', position: 0 }),
    M.makeSequenceItem({ id: 'si_2', sequenceId: 'seq_readaloud', title: "Charlotte's Web", status: 'current', position: 1, resourceUseIds: ['ruse_charlottesweb'], nextAssignment: 'chapter 4' }),
    M.makeSequenceItem({ id: 'si_3', sequenceId: 'seq_readaloud', title: 'The Wind in the Willows', status: 'upcoming', position: 2 })
  ];

  var extensionWorks = [
    M.makeExtensionWork({
      id: 'ext_jeremiah_history', parentCardId: 'card_amhistory', studentId: 'jeremiah',
      title: 'Independent reading + written narration', minutes: 15
    })
  ];

  var cards = [
    M.makeCard({
      id: 'card_bible', title: 'Bible Loop', subjectColumnId: 'bible', audience: 'together',
      participantMode: 'together', status: 'active', loopId: 'loop_bible',
      scheduleConfig: M.makeScheduleConfig({ mode: 'loop', loopId: 'loop_bible' }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form1')
    }),
    M.makeCard({
      id: 'card_amhistory', title: 'American History Spine', subjectColumnId: 'history', audience: 'group',
      participantMode: 'group', participantIds: ['older'], status: 'active',
      resourceUseIds: ['ruse_amhistory'], extensionWorkIds: ['ext_jeremiah_history'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 2 }),
      lessonTimeConfig: M.makeLessonTimeConfig({ minMinutes: 20, targetMinutes: 25, maxMinutes: 30, hardMaxMinutes: 30, timeOwnership: 'shared' })
    }),
    M.makeCard({
      id: 'card_ancienthistory', title: 'Ancient History Spine', subjectColumnId: 'history', audience: 'group',
      participantMode: 'group', participantIds: ['older'], status: 'active',
      resourceUseIds: ['ruse_ancienthistory'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 2 })
    }),
    M.makeCard({
      id: 'card_math', title: 'Math', subjectColumnId: 'math', audience: 'individual',
      participantMode: 'individual', participantIds: ['kayla'], status: 'active',
      resourceUseIds: ['ruse_math_kayla'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 4 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form1')
    }),
    M.makeCard({
      id: 'card_science_coop', title: 'Upper Science', subjectColumnId: 'science', audience: 'coop-outside',
      participantMode: 'coop', participantIds: ['jeremiah'], status: 'coop',
      planningStatus: 'co-op-external',
      scheduleConfig: M.makeScheduleConfig({ mode: 'coop', outsideProvider: 'Greenhouse Co-op' })
    }),
    M.makeCard({
      id: 'card_mapquiz', title: 'Map Quizzing', subjectColumnId: 'history', audience: 'optional',
      participantMode: 'optional', participantIds: [], status: 'optional',
      planningStatus: 'optional'
    }),
    M.makeCard({
      id: 'card_neighboring', title: 'Neighboring Lands Spine', subjectColumnId: 'history', audience: 'unplaced',
      participantMode: 'individual', participantIds: [], status: 'unplaced'
    }),
    M.makeCard({
      id: 'card_readaloud', title: 'Family Read-Alouds', subjectColumnId: 'literature', audience: 'together',
      participantMode: 'together', status: 'active', sequenceId: 'seq_readaloud',
      scheduleConfig: M.makeScheduleConfig({ mode: 'sequence', sequenceId: 'seq_readaloud' })
    }),
    // Language Arts
    M.makeCard({
      id: 'card_copywork', title: 'Copywork', subjectColumnId: 'language-arts', audience: 'group',
      participantMode: 'group', participantIds: ['littles'], status: 'active',
      planningStatus: 'active',
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 4 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form1'),
      notes: 'Short daily practice — no separate book needed beyond handwriting curriculum.'
    }),
    M.makeCard({
      id: 'card_dictation', title: 'Dictation', subjectColumnId: 'language-arts', audience: 'group',
      participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active',
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 2 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form2')
    }),
    M.makeCard({
      id: 'card_grammar', title: 'Grammar', subjectColumnId: 'language-arts', audience: 'individual',
      participantMode: 'individual', participantIds: ['lucy'], status: 'active',
      planningStatus: 'active',
      resourceUseIds: ['ruse_grammar'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 2 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form2')
    }),
    // Beauty / Riches
    M.makeCard({
      id: 'card_hymn', title: 'Hymn', subjectColumnId: 'beauty', audience: 'together',
      participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book',
      scheduleConfig: M.makeScheduleConfig({ mode: 'loop' }),
      notes: 'One hymn per term, learned together at morning time.'
    }),
    M.makeCard({
      id: 'card_folksong', title: 'Folk Song', subjectColumnId: 'beauty', audience: 'together',
      participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book',
      scheduleConfig: M.makeScheduleConfig({ mode: 'loop' })
    }),
    M.makeCard({
      id: 'card_picturestudy', title: 'Picture Study', subjectColumnId: 'beauty', audience: 'together',
      participantMode: 'together', status: 'active',
      planningStatus: 'active',
      resourceUseIds: ['ruse_picturestudy'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 1 })
    }),
    // Geography / Citizenship
    M.makeCard({
      id: 'card_geography', title: 'Geography', subjectColumnId: 'geography', audience: 'together',
      participantMode: 'together', status: 'active',
      planningStatus: 'active',
      resourceUseIds: ['ruse_geography'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 2 })
    }),
    M.makeCard({
      id: 'card_citizenship', title: 'Citizenship / Civics', subjectColumnId: 'geography', audience: 'group',
      participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active',
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 1 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form2')
    }),
    // Science / Nature
    M.makeCard({
      id: 'card_naturestudy', title: 'Nature Study', subjectColumnId: 'science', audience: 'together',
      participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book',
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 1 }),
      notes: 'Outdoor observation — nature notebooks, no formal text.'
    }),
    // Arts / Handicrafts
    M.makeCard({
      id: 'card_handicraft', title: 'Handicraft', subjectColumnId: 'arts', audience: 'together',
      participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book',
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 1 })
    }),
    // PE / Health
    M.makeCard({
      id: 'card_pe', title: 'PE / Health', subjectColumnId: 'pe', audience: 'together',
      participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book',
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 3 })
    }),
    // Literature (older/optional)
    M.makeCard({
      id: 'card_plutarch', title: 'Plutarch', subjectColumnId: 'literature', audience: 'group',
      participantMode: 'group', participantIds: ['older'], status: 'optional',
      planningStatus: 'optional',
      resourceUseIds: ['ruse_plutarch'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 1 }),
      notes: 'Optional for Form III. Not placed in weekly rhythm yet.'
    }),
    // Math — Lucy
    M.makeCard({
      id: 'card_math_lucy', title: 'Math', subjectColumnId: 'math', audience: 'individual',
      participantMode: 'individual', participantIds: ['lucy'], status: 'active',
      planningStatus: 'active',
      resourceUseIds: ['ruse_math_lucy'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 4 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form2')
    })
  ];

  var resources = [
    M.makeResource({ id: 'res_bible', title: 'Bible', type: 'book', status: 'have-it' }),
    M.makeResource({ id: 'res_theology', title: 'Big Truths for Young Hearts', author: 'Bruce Ware', type: 'lesson-book', status: 'have-it' }),
    M.makeResource({ id: 'res_amhistory', title: 'This Country of Ours', author: 'H.E. Marshall', type: 'book', status: 'have-it' }),
    M.makeResource({ id: 'res_ancienthistory', title: 'Ancient History Spine (unchosen)', type: 'book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_math_kayla', title: "Kayla's Math Curriculum", type: 'lesson-book', status: 'need-to-buy' }),
    M.makeResource({ id: 'res_charlottesweb', title: "Charlotte's Web", author: 'E.B. White', type: 'book', status: 'have-it' }),
    M.makeResource({ id: 'res_mapquiz', title: 'Map Quizzing', type: 'no-resource', status: 'no-resource' }),
    M.makeResource({ id: 'res_grammar', title: 'Grammar Curriculum (TBD)', type: 'lesson-book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_picturestudy', title: 'Picture Study Portfolios', type: 'book', status: 'have-it' }),
    M.makeResource({ id: 'res_geography', title: 'Geography Resource (TBD)', type: 'lesson-book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_plutarch', title: "Plutarch's Lives (abridged)", type: 'book', status: 'need-to-buy' }),
    M.makeResource({ id: 'res_math_lucy', title: "Lucy's Math Curriculum", type: 'lesson-book', status: 'have-it' })
  ];

  var resourceUses = [
    M.makeResourceUse({ id: 'ruse_bible_loop', resourceId: 'res_bible', loopId: 'loop_bible', subjectColumnId: 'bible', scheduleSummary: '4x/week (loop)' }),
    M.makeResourceUse({ id: 'ruse_bible_personal', resourceId: 'res_bible', cardId: 'card_amhistory', participantsOverride: ['jeremiah'], subjectColumnId: 'bible', scheduleSummary: '2x/week, personal reading' }),
    M.makeResourceUse({ id: 'ruse_theology', resourceId: 'res_theology', loopId: 'loop_bible', subjectColumnId: 'bible' }),
    M.makeResourceUse({ id: 'ruse_amhistory', resourceId: 'res_amhistory', cardId: 'card_amhistory', subjectColumnId: 'history', scheduleSummary: '2x/week' }),
    M.makeResourceUse({ id: 'ruse_ancienthistory', resourceId: 'res_ancienthistory', cardId: 'card_ancienthistory', subjectColumnId: 'history', scheduleSummary: '2x/week' }),
    M.makeResourceUse({ id: 'ruse_math_kayla', resourceId: 'res_math_kayla', cardId: 'card_math', subjectColumnId: 'math', scheduleSummary: '4x/week' }),
    M.makeResourceUse({ id: 'ruse_charlottesweb', resourceId: 'res_charlottesweb', sequenceItemId: 'si_2', sequenceId: 'seq_readaloud', subjectColumnId: 'literature', nextAssignment: 'chapter 4' }),
    M.makeResourceUse({ id: 'ruse_jeremiah_ext', resourceId: 'res_amhistory', extensionWorkId: 'ext_jeremiah_history', subjectColumnId: 'history', scheduleSummary: 'extension reading' }),
    M.makeResourceUse({ id: 'ruse_mapquiz', resourceId: 'res_mapquiz', cardId: 'card_mapquiz', subjectColumnId: 'history' }),
    M.makeResourceUse({ id: 'ruse_grammar', resourceId: 'res_grammar', cardId: 'card_grammar', subjectColumnId: 'language-arts', scheduleSummary: '2x/week' }),
    M.makeResourceUse({ id: 'ruse_picturestudy', resourceId: 'res_picturestudy', cardId: 'card_picturestudy', subjectColumnId: 'beauty', scheduleSummary: '1x/week' }),
    M.makeResourceUse({ id: 'ruse_geography', resourceId: 'res_geography', cardId: 'card_geography', subjectColumnId: 'geography', scheduleSummary: '2x/week' }),
    M.makeResourceUse({ id: 'ruse_plutarch', resourceId: 'res_plutarch', cardId: 'card_plutarch', subjectColumnId: 'literature', scheduleSummary: '1x/week' }),
    M.makeResourceUse({ id: 'ruse_math_lucy', resourceId: 'res_math_lucy', cardId: 'card_math_lucy', subjectColumnId: 'math', scheduleSummary: '4x/week' })
  ];

  var starterTemplates = M.defaultStarterTemplateLibrary();

  return {
    appStateVersion: 1,
    students: students,
    groups: groups,
    subjectColumns: subjectColumns,
    cards: cards,
    loops: loops,
    loopItems: loopItems,
    sequences: sequences,
    sequenceItems: sequenceItems,
    extensionWorks: extensionWorks,
    resources: resources,
    resourceUses: resourceUses,
    starterTemplates: starterTemplates,
    printSettings: M.makePrintSettings(),
    weeklyRhythm: R.buildSampleWeeklyRhythm(),
    rhythmPrintSettings: R.makeRhythmPrintSettings()
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export function findStudent(state, id) { return state.students.find(function (s) { return s.id === id; }); }
export function findGroup(state, id) { return state.groups.find(function (g) { return g.id === id; }); }
export function findSubject(state, id) { return state.subjectColumns.find(function (s) { return s.id === id; }); }
export function findCard(state, id) { return state.cards.find(function (c) { return c.id === id; }); }
export function findResource(state, id) { return state.resources.find(function (r) { return r.id === id; }); }
export function findLoop(state, id) { return state.loops.find(function (l) { return l.id === id; }); }
export function findSequence(state, id) { return state.sequences.find(function (s) { return s.id === id; }); }

// Build the resolver context resolveResourceUseParticipants() needs, from a
// full app state.
export function resourceContext(state) {
  return {
    cards: state.cards, loops: state.loops, sequences: state.sequences,
    extensionWorks: state.extensionWorks || [], students: state.students, groups: state.groups
  };
}

// Build the resolver context the weeklyRhythm helpers need, from a full app
// state. Same shape as resourceContext(), plus subjectColumns since rhythm
// assignments can reference a subject directly.
export function rhythmContext(state) {
  return {
    students: state.students, groups: state.groups, cards: state.cards,
    loops: state.loops, sequences: state.sequences, subjectColumns: state.subjectColumns
  };
}

// ---------------------------------------------------------------------------
// Map rows / grid
// ---------------------------------------------------------------------------
// Audience row ids, in display order. "individual" expands to one row per
// active student; everything else is a single fixed row.
export var FIXED_ROW_IDS = ['together', 'group', 'individual', 'coop-outside', 'optional', 'unplaced'];

export function buildMapRows(state) {
  var rows = [];
  rows.push({ id: 'together', label: 'Together / Family' });
  state.groups.filter(function (g) { return g.active; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; }).forEach(function (g) {
    rows.push({ id: 'group:' + g.id, label: g.label, groupId: g.id });
  });
  state.students.filter(function (s) { return s.active; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; }).forEach(function (s) {
    rows.push({ id: 'individual:' + s.id, label: s.name, studentId: s.id });
  });
  rows.push({ id: 'coop-outside', label: 'Co-op / Outside' });
  rows.push({ id: 'optional', label: 'Optional / Not this year' });
  rows.push({ id: 'unplaced', label: 'Needs placement' });
  return rows;
}

// Which row a card belongs to on the map, given its audience + (for group
// audience) which specific group it's linked to.
export function rowIdForCard(card) {
  if (card.audience === 'group') {
    var groupId = card.groupId || (card.participantIds && card.participantIds[0]);
    return groupId ? 'group:' + groupId : 'group';
  }
  if (card.audience === 'individual') {
    var studentId = card.participantIds && card.participantIds[0];
    return studentId ? 'individual:' + studentId : 'unplaced';
  }
  return card.audience; // together | coop-outside | optional | unplaced
}

// Build the full row x subjectColumn grid of cards, sorted columns left to
// right, each cell an array of cards (empty array if none).
export function buildMapGrid(state) {
  var rows = buildMapRows(state);
  var columns = state.subjectColumns.filter(function (s) { return s.visible; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  var grid = rows.map(function (row) {
    var cells = {};
    columns.forEach(function (col) { cells[col.id] = []; });
    return { row: row, cells: cells };
  });
  state.cards.forEach(function (card) {
    var rowId = rowIdForCard(card);
    var gridRow = grid.find(function (g) { return g.row.id === rowId; });
    if (gridRow && gridRow.cells[card.subjectColumnId]) gridRow.cells[card.subjectColumnId].push(card);
  });
  return { rows: rows, columns: columns, grid: grid };
}

// ---------------------------------------------------------------------------
// Lens
// ---------------------------------------------------------------------------
// lens shapes: {type:'all'} | {type:'student', studentId} | {type:'group', groupId} | {type:'subject', subjectColumnId}
export function cardMatchesLens(card, lens, state) {
  if (!lens || lens.type === 'all') return true;
  if (lens.type === 'subject') return card.subjectColumnId === lens.subjectColumnId;
  var participants = M.resolveParticipants(card, state.students, state.groups);
  if (lens.type === 'student') return participants.indexOf(lens.studentId) > -1;
  if (lens.type === 'group') {
    var group = findGroup(state, lens.groupId);
    if (!group) return false;
    return group.studentIds.some(function (id) { return participants.indexOf(id) > -1; });
  }
  return true;
}

// Student Lens: every card the student participates in — Together, group,
// co-op/external, and individual work. Optional/not-this-year work is
// included only when explicitly opted in (it's hidden by default since it's
// often undecided/skippable).
export function studentLensCards(state, studentId, opts) {
  opts = opts || {};
  return state.cards.filter(function (card) {
    if (card.status === 'optional' && !opts.includeOptional) return false;
    return cardMatchesLens(card, { type: 'student', studentId: studentId }, state);
  });
}

export function groupLensCards(state, groupId) {
  return state.cards.filter(function (card) { return cardMatchesLens(card, { type: 'group', groupId: groupId }, state); });
}

export function subjectLensCards(state, subjectColumnId) {
  return state.cards.filter(function (card) { return cardMatchesLens(card, { type: 'subject', subjectColumnId: subjectColumnId }, state); });
}

// Combined Student Lens: everything the Family School Map, Weekly Rhythm,
// and Book & Resource List know about one student, read from the same
// shared state — map cards, rhythm assignments, and resource rollup uses.
export function studentLensView(state, studentId, opts) {
  var cards = studentLensCards(state, studentId, opts);
  var rhythmAssignments = state.weeklyRhythm
    ? R.getRhythmForStudent(state.weeklyRhythm, studentId, rhythmContext(state))
    : [];
  var rollup = M.buildResourceRollup(state.resources, state.resourceUses, resourceContext(state));
  var resources = M.getResourcesForStudent(rollup, studentId);
  return { cards: cards, rhythmAssignments: rhythmAssignments, resources: resources };
}

// ---------------------------------------------------------------------------
// Rhythm placement / review — state-level wrappers around weeklyRhythm.mjs's
// pure helpers. "Needs rhythm placement" finds cards/loops/sequences that
// don't yet appear anywhere in the rhythm; "Needs rhythm review" flags
// rhythm assignments whose reference is missing or has visibly diverged —
// never an automatic rewrite, just a parent-facing hint.
// ---------------------------------------------------------------------------
export function cardHasRhythmPlacement(state, cardId) {
  return R.cardHasRhythmPlacement(state.weeklyRhythm, cardId);
}
export function loopHasRhythmPlacement(state, loopId) {
  return R.loopHasRhythmPlacement(state.weeklyRhythm, loopId);
}
export function sequenceHasRhythmPlacement(state, sequenceId) {
  return R.sequenceHasRhythmPlacement(state.weeklyRhythm, sequenceId);
}
export function getCardsWithoutRhythmPlacement(state, opts) {
  return R.getCardsWithoutRhythmPlacement(state.weeklyRhythm, state.cards, opts);
}
export function getLoopsWithoutRhythmPlacement(state) {
  return R.getLoopsWithoutRhythmPlacement(state.weeklyRhythm, state.loops);
}
export function getSequencesWithoutRhythmPlacement(state) {
  return R.getSequencesWithoutRhythmPlacement(state.weeklyRhythm, state.sequences);
}
export function getRhythmReviewItems(state) {
  return R.getRhythmReviewItems(state.weeklyRhythm, rhythmContext(state));
}

// ---------------------------------------------------------------------------
// Weekly Rhythm editing — thin state-level wrappers around weeklyRhythm.mjs's
// pure cell mutators. These only ever create/change/remove RhythmAssignment
// objects; they never touch cards/loops/sequences/resources, per the
// reference-based-display, no-silent-rewrite rule from Phase 1B/1D.
// ---------------------------------------------------------------------------
export function addRhythmAssignmentToState(state, fields) {
  return R.addRhythmAssignment(state.weeklyRhythm, fields);
}

export function updateRhythmAssignmentInState(state, assignmentId, fields) {
  return R.updateRhythmAssignment(state.weeklyRhythm, assignmentId, fields);
}

export function deleteRhythmAssignmentFromState(state, assignmentId) {
  return R.deleteRhythmAssignment(state.weeklyRhythm, assignmentId);
}

// Small, contained "Add to Weekly Rhythm" action from the Family School Map:
// creates one RhythmAssignment that references the given card on the chosen
// day/block. Does not touch the card itself.
export function addCardToRhythm(state, cardId, dayId, blockId) {
  var card = findCard(state, cardId);
  if (!card) return null;
  return addRhythmAssignmentToState(state, {
    dayId: dayId,
    blockId: blockId,
    label: card.title,
    assignmentType: 'card',
    referencedId: cardId
  });
}

// ---------------------------------------------------------------------------
// Loops / Sequences (current-item views; mutation delegates to familyMap helpers)
// ---------------------------------------------------------------------------
export function currentLoopItem(state, loopId) {
  var loop = findLoop(state, loopId);
  if (!loop) return null;
  return state.loopItems.find(function (i) { return i.id === loop.currentItemId; }) || null;
}

// Mutates state.loops in place (in-memory only) by replacing the loop with
// the advanced version from M.advanceLoop. Returns the new current item.
export function advanceLoopInState(state, loopId) {
  var idx = state.loops.findIndex(function (l) { return l.id === loopId; });
  if (idx === -1) return null;
  state.loops[idx] = M.advanceLoop(state.loops[idx]);
  return currentLoopItem(state, loopId);
}

export function sequenceProgress(state, sequenceId) {
  var items = state.sequenceItems.filter(function (i) { return i.sequenceId === sequenceId; });
  return M.resolveSequenceProgress(items);
}

// Mutates state.sequenceItems in place (in-memory only) by replacing this
// sequence's items with the advanced set from M.advanceSequence.
export function advanceSequenceInState(state, sequenceId) {
  var items = state.sequenceItems.filter(function (i) { return i.sequenceId === sequenceId; });
  var advanced = M.advanceSequence(items);
  state.sequenceItems = state.sequenceItems
    .filter(function (i) { return i.sequenceId !== sequenceId; })
    .concat(advanced);
  return sequenceProgress(state, sequenceId);
}

// Mutates state.sequenceItems in place (in-memory only) by replacing this
// sequence's items with the reversed set from M.reverseSequence.
export function reverseSequenceInState(state, sequenceId) {
  var items = state.sequenceItems.filter(function (i) { return i.sequenceId === sequenceId; });
  var reversed = M.reverseSequence(items);
  state.sequenceItems = state.sequenceItems
    .filter(function (i) { return i.sequenceId !== sequenceId; })
    .concat(reversed);
  return sequenceProgress(state, sequenceId);
}

// Whether "Next" should be available — there is a current item to advance.
export function sequenceCanAdvance(state, sequenceId) {
  return sequenceProgress(state, sequenceId).current != null;
}

// Whether "Previous" should be available — there is something before the
// current position to move back to (a completed item, or a current item
// that isn't already the first).
export function sequenceCanReverse(state, sequenceId) {
  var items = state.sequenceItems.filter(function (i) { return i.sequenceId === sequenceId; })
    .sort(function (a, b) { return a.position - b.position; });
  var curIdx = items.findIndex(function (i) { return i.status === 'current'; });
  if (curIdx === -1) return items.some(function (i) { return i.status === 'completed'; });
  return curIdx > 0;
}

// ---------------------------------------------------------------------------
// Resource list
// ---------------------------------------------------------------------------
// One call that produces exactly what the Book & Resource List panel needs:
// a deduplicated, participant-resolved, filtered, grouped resource view.
export function getResourceList(state, opts) {
  opts = opts || {};
  var groupBy = opts.groupBy || 'subject';
  var filter = opts.filter || 'all';
  var rollup = M.buildResourceRollup(state.resources, state.resourceUses, resourceContext(state));
  var filtered = M.filterResourceRollup(rollup, filter, { studentId: opts.studentId, subjectColumnId: opts.subjectColumnId });
  return M.groupResources(filtered, groupBy);
}

// Human-readable "used in" label for a single ResourceUse, preserving
// card/loop/loop-item/sequence/sequence-item/extension-work/co-op/optional
// context, for both screen and print rendering.
export function resourceUseContextLabel(use, state) {
  if (use.cardId) {
    var card = findCard(state, use.cardId);
    return card ? card.title : 'Card';
  }
  if (use.loopItemId || use.loopId) {
    var loop = findLoop(state, use.loopId);
    var loopItem = state.loopItems.find(function (i) { return i.id === use.loopItemId; });
    if (loop && loopItem) return loop.title + ' — ' + loopItem.title;
    if (loop) return loop.title;
    return 'Loop';
  }
  if (use.sequenceItemId || use.sequenceId) {
    var seq = findSequence(state, use.sequenceId);
    var seqItem = state.sequenceItems.find(function (i) { return i.id === use.sequenceItemId; });
    if (seq && seqItem) return seq.title + ' — ' + seqItem.title;
    if (seq) return seq.title;
    return 'Sequence';
  }
  if (use.extensionWorkId) {
    var ext = (state.extensionWorks || []).find(function (e) { return e.id === use.extensionWorkId; });
    return ext ? 'Extension — ' + ext.title : 'Extension work';
  }
  if (use.coopRef) return 'Co-op: ' + use.coopRef;
  if (use.optionalRef) return 'Optional: ' + use.optionalRef;
  return '';
}

export function resourceUseWhoLabel(use, state) {
  var participants = use.participants || [];
  if (!participants.length) return 'Everyone';
  return participants.map(function (id) {
    var s = findStudent(state, id);
    return s ? s.name : id;
  }).join(', ');
}

// ---------------------------------------------------------------------------
// Minimal, safe in-memory editing mutators (Phase 1A scope only)
// ---------------------------------------------------------------------------
export function setCardTitle(state, cardId, title) {
  var card = findCard(state, cardId);
  if (card) card.title = title;
  return state;
}

export function setCardAudience(state, cardId, audience) {
  var card = findCard(state, cardId);
  if (card) card.audience = audience;
  return state;
}

export function setCardParticipants(state, cardId, participantMode, participantIds) {
  var card = findCard(state, cardId);
  if (!card) return state;
  card.participantMode = participantMode;
  card.participantIds = (participantIds || []).slice();
  return state;
}

export function setResourceStatus(state, resourceId, status) {
  var resource = findResource(state, resourceId);
  if (resource) resource.status = status;
  return state;
}

export function moveCardToSubject(state, cardId, subjectColumnId) {
  var card = findCard(state, cardId);
  if (card) card.subjectColumnId = subjectColumnId;
  return state;
}

// Move a card to a different map row ("Who is this for?"), matching the row
// ids buildMapRows() produces (together | group:<id> | individual:<id> |
// coop-outside | optional | unplaced). Sets audience + a sane default
// participantMode/participantIds for that row; explicit participant overrides
// (setCardParticipants) can still be applied on top afterward.
export function moveCardToRow(state, cardId, rowId) {
  var card = findCard(state, cardId);
  if (!card || !rowId) return state;
  if (rowId === 'together') {
    card.audience = 'together';
    card.participantMode = 'together';
    card.participantIds = [];
  } else if (rowId.indexOf('group:') === 0) {
    card.audience = 'group';
    card.participantMode = 'group';
    card.participantIds = [rowId.slice('group:'.length)];
  } else if (rowId.indexOf('individual:') === 0) {
    card.audience = 'individual';
    card.participantMode = 'individual';
    card.participantIds = [rowId.slice('individual:'.length)];
  } else if (rowId === 'coop-outside') {
    card.audience = 'coop-outside';
    card.participantMode = 'coop';
  } else if (rowId === 'optional') {
    card.audience = 'optional';
    card.participantMode = 'optional';
  } else if (rowId === 'unplaced') {
    card.audience = 'unplaced';
  }
  return state;
}

// ---------------------------------------------------------------------------
// Family members / Learners — simple add/edit/deactivate management. Kept
// intentionally minimal: no profile system, just the fields a parent needs
// to see a learner show up correctly across the map, lenses, and the
// participant picker (all of which already derive from state.students).
// ---------------------------------------------------------------------------
export function addStudent(state, fields) {
  fields = fields || {};
  var student = M.makeStudent(Object.assign({
    initials: fields.initials || M.autoInitials(fields.name || ''),
    sortOrder: state.students.length
  }, fields));
  state.students.push(student);
  return student;
}

export function updateStudent(state, studentId, fields) {
  var student = findStudent(state, studentId);
  if (!student) return null;
  Object.assign(student, fields);
  return student;
}

export function setStudentActive(state, studentId, active) {
  var student = findStudent(state, studentId);
  if (student) student.active = !!active;
  return student;
}

// ---------------------------------------------------------------------------
// Subjects — simple add/edit/hide management for the Family School Map's
// subject columns.
// ---------------------------------------------------------------------------
export function addSubjectColumn(state, fields) {
  fields = fields || {};
  var col = M.makeSubjectColumn(Object.assign({ sortOrder: state.subjectColumns.length }, fields));
  state.subjectColumns.push(col);
  return col;
}

export function updateSubjectColumn(state, subjectColumnId, fields) {
  var col = findSubject(state, subjectColumnId);
  if (!col) return null;
  Object.assign(col, fields);
  return col;
}

export function setSubjectVisible(state, subjectColumnId, visible) {
  var col = findSubject(state, subjectColumnId);
  if (col) col.visible = !!visible;
  return col;
}

export function addCardFromTemplate(state, templateId) {
  var tpl = state.starterTemplates.find(function (t) { return t.id === templateId; });
  if (!tpl) return null;
  var card = M.makeCard({
    title: tpl.title,
    subjectColumnId: tpl.subjectColumnId,
    audience: tpl.suggestedAudience,
    participantMode: tpl.suggestedParticipantMode,
    scheduleConfig: M.makeScheduleConfig({ mode: tpl.suggestedScheduleMode }),
    lessonTimeConfig: tpl.suggestedLessonTimeConfig || M.makeLessonTimeConfig(),
    sourceTemplateId: tpl.id
  });
  state.cards.push(card);

  // If the template expects a resource (book/lesson-book/etc, anything but
  // 'none'), create a placeholder Resource + linked ResourceUse so the new
  // card shows up correctly in the Book & Resource List right away — left
  // 'undecided'/unspecified for the parent to fill in, never guessed.
  if (tpl.suggestedResourceExpectation && tpl.suggestedResourceExpectation !== 'none') {
    var resource = M.makeResource({
      title: tpl.title + ' (resource TBD)',
      type: tpl.suggestedResourceExpectation,
      status: 'undecided'
    });
    state.resources.push(resource);
    var use = M.makeResourceUse({
      resourceId: resource.id,
      cardId: card.id,
      subjectColumnId: tpl.subjectColumnId
    });
    state.resourceUses.push(use);
  }

  return card;
}

// Starter templates grouped/filtered for the learner-onboarding wizard. A
// learner's gradeBand (form1/form2/form3/custom) filters which templates are
// "for this form"; category groups them so a parent can add by group
// (core/riches/skills) instead of facing one giant list.
export function getStarterTemplatesForForm(state, gradeBand) {
  return state.starterTemplates.filter(function (t) {
    return !t.ageStageApplicability.length || t.ageStageApplicability.indexOf(gradeBand) > -1;
  });
}

export function getStarterTemplatesByCategory(state, gradeBand, category) {
  return getStarterTemplatesForForm(state, gradeBand).filter(function (t) { return t.category === category; });
}

// Add starter cards for a set of template ids, all assigned to one learner
// (audience/participantMode individual unless the template suggests
// together/group). Returns the created cards. Never called silently — the
// caller (UI) always asks the parent first per template/category.
export function addStarterCardsBulk(state, templateIds, studentId) {
  return templateIds.map(function (templateId) {
    var card = addCardFromTemplate(state, templateId);
    if (card && studentId && card.audience !== 'together' && card.audience !== 'group') {
      card.audience = 'individual';
      card.participantMode = 'individual';
      card.participantIds = [studentId];
    }
    return card;
  }).filter(Boolean);
}

// Place a set of already-created cards into the Weekly Rhythm using a
// PNEU-inspired rhythm preset as a starting point. A thin state-level
// wrapper around weeklyRhythm.mjs's pure placeCardsUsingRhythmPreset —
// creates RhythmAssignments only, never touches the cards.
export function placeStarterCardsWithRhythmPreset(state, presetId, cardIds) {
  var labelById = {};
  cardIds.forEach(function (id) {
    var card = findCard(state, id);
    if (card) labelById[id] = card.title;
  });
  return R.placeCardsUsingRhythmPreset(state.weeklyRhythm, presetId, cardIds, labelById);
}

// ---------------------------------------------------------------------------
// Card editing — workbench-level add/update helpers.
// ---------------------------------------------------------------------------
export function addCard(state, fields) {
  fields = fields || {};
  var card = M.makeCard(fields);
  state.cards.push(card);
  return card;
}

export function updateCard(state, cardId, fields) {
  var card = findCard(state, cardId);
  if (!card) return null;
  Object.assign(card, fields);
  return card;
}

// All cards for a given subject column (visible or not), sorted by sortOrder
// then title. Used by the Subjects & Books workbench to group cards by column.
export function getCardsForSubjectColumn(state, columnId) {
  return state.cards.filter(function (c) { return c.subjectColumnId === columnId; })
    .sort(function (a, b) {
      var diff = (a.sortOrder || 0) - (b.sortOrder || 0);
      return diff !== 0 ? diff : (a.title || '').localeCompare(b.title || '');
    });
}

// Derive the coverage status for one card from its linked resources.
// Pure derivation — result is never stored on the card.
export function getCoverageStatusForCard(state, cardId) {
  var card = findCard(state, cardId);
  if (!card) return 'not-tracked';
  return M.deriveCoverageStatus(card, state.resourceUses, state.resources);
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------
export function printOrientationForState(printSettings) {
  return M.printOrientationForMode(printSettings.printMode);
}
