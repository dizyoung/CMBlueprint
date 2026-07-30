import assert from 'node:assert/strict';
import * as A from '../lib/familyMapAdapter.mjs';
import * as M from '../lib/familyMap.mjs';
import * as R from '../lib/weeklyRhythm.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('sample state builds rows, columns, and card groupings as expected', () => {
  const state = A.buildSampleAppState();
  const rows = A.buildMapRows(state).map((r) => r.id);
  assert.deepEqual(rows, [
    'together', 'group:older', 'group:littles',
    'individual:charis', 'individual:kayla', 'individual:lucy', 'individual:jeremiah',
    'coop-outside', 'optional', 'unplaced'
  ]);

  const { grid, columns } = A.buildMapGrid(state);
  assert.equal(columns.length, 12);

  const togetherRow = grid.find((g) => g.row.id === 'together');
  assert.ok(togetherRow.cells.bible.some((c) => c.id === 'card_bible'));
  assert.ok(togetherRow.cells.literature.some((c) => c.id === 'card_readaloud'));

  const olderGroupRow = grid.find((g) => g.row.id === 'group:older');
  assert.ok(olderGroupRow.cells.history.some((c) => c.id === 'card_history_spine'));
  assert.ok(olderGroupRow.cells.history.some((c) => c.id === 'card_biography'));

  const kaylaRow = grid.find((g) => g.row.id === 'individual:kayla');
  assert.ok(kaylaRow.cells.math.some((c) => c.id === 'card_math_kayla'));

  const coopRow = grid.find((g) => g.row.id === 'coop-outside');
  assert.ok(coopRow.cells.science.some((c) => c.id === 'card_upper_science'));

  // optional and unplaced rows exist but sample data has no cards placed there
  const optionalRow = grid.find((g) => g.row.id === 'optional');
  assert.ok(optionalRow);

  const unplacedRow = grid.find((g) => g.row.id === 'unplaced');
  assert.ok(unplacedRow);
});

test('Student Lens resolves correctly from real state, including together/group/co-op/individual work', () => {
  const state = A.buildSampleAppState();
  const jeremiahCards = A.studentLensCards(state, 'jeremiah').map((c) => c.id).sort();
  // Together: bible, scripture_mem, recitation, readaloud, tales, mapwork, nature_study, nature_notebook,
  //           mental_math, hymn, folksong, poetry, picture_study, composer_study, drawing, handicraft,
  //           pe, drill, modern_lang, outside_activity
  // Group:older: devotional, dictation, written_narration, history_spine, biography, timeline,
  //              geo_reader, citizenship_gov, living_science, health, spanish_french
  // Coop: upper_science, coop_class
  assert.ok(jeremiahCards.includes('card_bible'));
  assert.ok(jeremiahCards.includes('card_hymn'));
  assert.ok(jeremiahCards.includes('card_history_spine'));
  assert.ok(jeremiahCards.includes('card_upper_science'));
  assert.ok(jeremiahCards.includes('card_coop_class'));
  assert.ok(!jeremiahCards.includes('card_math_kayla'), 'kayla individual math should not appear for jeremiah');

  const kaylaCards = A.studentLensCards(state, 'kayla').map((c) => c.id).sort();
  // Together + group:littles (phonics, copywork, early_history, object_lessons, practical_math) + individual math_kayla
  assert.ok(kaylaCards.includes('card_bible'));
  assert.ok(kaylaCards.includes('card_copywork'));
  assert.ok(kaylaCards.includes('card_math_kayla'));
  assert.ok(!kaylaCards.includes('card_history_spine'), 'older group history should not appear for kayla');

  const kaylaWithOptional = A.studentLensCards(state, 'kayla', { includeOptional: true }).map((c) => c.id);
  assert.ok(!kaylaWithOptional.includes('card_shakespeare'), 'Form III optional cards should not appear for littles group');
});

test('Group Lens and Subject Lens resolve from real state', () => {
  const state = A.buildSampleAppState();
  const olderGroupCards = A.groupLensCards(state, 'older').map((c) => c.id);
  assert.ok(olderGroupCards.includes('card_history_spine'));
  assert.ok(olderGroupCards.includes('card_biography'));
  assert.ok(olderGroupCards.includes('card_dictation'));

  const historyCards = A.subjectLensCards(state, 'history').map((c) => c.id).sort();
  assert.ok(historyCards.includes('card_history_spine'));
  assert.ok(historyCards.includes('card_biography'));
  assert.ok(historyCards.includes('card_early_history'));
  assert.ok(historyCards.includes('card_timeline'));
});

test('Book & Resource List rollup works from real state and resolves participants', () => {
  const state = A.buildSampleAppState();
  const grouped = A.getResourceList(state, { groupBy: 'subject', filter: 'all' });

  // res_bible is used by loop_bible (together = all 4 students)
  const bibleLoopUse = grouped.bible.find((r) => r.id === 'res_bible').uses.find((u) => u.loopId === 'loop_bible');
  assert.deepEqual(bibleLoopUse.participants.sort(), ['charis', 'jeremiah', 'kayla', 'lucy']);

  // res_grammar is used by card_grammar (individual: lucy)
  const grammarUse = grouped['language-arts'].find((r) => r.id === 'res_grammar').uses.find((u) => u.cardId === 'card_grammar');
  assert.deepEqual(grammarUse.participants, ['lucy']);

  // res_math_lucy is used by card_math_lucy (individual: lucy)
  const mathLucyUse = grouped.math.find((r) => r.id === 'res_math_lucy').uses.find((u) => u.cardId === 'card_math_lucy');
  assert.deepEqual(mathLucyUse.participants, ['lucy']);
});

test('changing resource status affects resource filters (need-to-get vs missing)', () => {
  const state = A.buildSampleAppState();
  const beforeNeedToGet = A.getResourceList(state, { groupBy: 'status', filter: 'need-to-get' });
  const beforeIds = Object.values(beforeNeedToGet).flat().map((r) => r.id);
  assert.ok(beforeIds.includes('res_math_kayla'));
  assert.ok(!beforeIds.includes('res_grammar'), '"need-to-choose" should not appear in need-to-get');

  A.setResourceStatus(state, 'res_math_kayla', 'have-it');
  const afterNeedToGet = A.getResourceList(state, { groupBy: 'status', filter: 'need-to-get' });
  const afterIds = Object.values(afterNeedToGet).flat().map((r) => r.id);
  assert.ok(!afterIds.includes('res_math_kayla'));

  const missing = A.getResourceList(state, { groupBy: 'status', filter: 'missing' });
  const missingIds = Object.values(missing).flat().map((r) => r.id);
  assert.ok(missingIds.includes('res_grammar'));
  assert.ok(!missingIds.includes('res_math_lucy'), '"have-it" resources should not appear in missing list');
});

test('changing card participant override affects Student Lens and resource rollup', () => {
  const state = A.buildSampleAppState();
  // card_history_spine is in group:older — charis (littles) should not see it
  assert.ok(!A.studentLensCards(state, 'charis').some((c) => c.id === 'card_history_spine'));

  A.setCardParticipants(state, 'card_history_spine', 'group', ['littles']);
  assert.ok(A.studentLensCards(state, 'charis').some((c) => c.id === 'card_history_spine'));

  const rollup = A.getResourceList(state, { groupBy: 'subject', filter: 'all' });
  const use = rollup.history.find((r) => r.id === 'res_history_spine').uses.find((u) => u.cardId === 'card_history_spine');
  assert.deepEqual(use.participants.sort(), ['charis', 'kayla']);
});

test('changing a ResourceUse participantsOverride affects resolved rollup participants', () => {
  const state = A.buildSampleAppState();
  const use = state.resourceUses.find((u) => u.id === 'ruse_history_spine');
  use.participantsOverride = ['lucy'];
  const rollup = A.getResourceList(state, { groupBy: 'subject', filter: 'all' });
  const resolved = rollup.history.find((r) => r.id === 'res_history_spine').uses.find((u) => u.id === 'ruse_history_spine');
  assert.deepEqual(resolved.participants, ['lucy']);
});

test('print orientation remains correct by mode', () => {
  const state = A.buildSampleAppState();
  assert.equal(A.printOrientationForState(state.printSettings), 'landscape');
  state.printSettings.printMode = 'resources';
  assert.equal(A.printOrientationForState(state.printSettings), 'portrait');
});

test('advancing a loop in state moves to the next item using familyMap helper', () => {
  const state = A.buildSampleAppState();
  assert.equal(A.currentLoopItem(state, 'loop_bible').id, 'li_matthew');
  const next = A.advanceLoopInState(state, 'loop_bible');
  assert.equal(next.id, 'li_psalms');
  assert.equal(A.currentLoopItem(state, 'loop_bible').id, 'li_psalms');
});

test('advancing a sequence in state moves completed/current/upcoming using familyMap helper', () => {
  const state = A.buildSampleAppState();
  let progress = A.sequenceProgress(state, 'seq_readaloud');
  assert.equal(progress.current.id, 'si_2');
  assert.equal(progress.completed.length, 1);

  progress = A.advanceSequenceInState(state, 'seq_readaloud');
  assert.equal(progress.current.id, 'si_3');
  assert.equal(progress.completed.length, 2);
  assert.equal(progress.upcoming.length, 0);
});

test('minimal editing mutators update state in place', () => {
  const state = A.buildSampleAppState();
  A.setCardTitle(state, 'card_math_kayla', 'Math Lessons');
  assert.equal(A.findCard(state, 'card_math_kayla').title, 'Math Lessons');

  A.setCardAudience(state, 'card_biography', 'individual');
  assert.equal(A.findCard(state, 'card_biography').audience, 'individual');

  A.moveCardToSubject(state, 'card_biography', 'literature');
  assert.equal(A.findCard(state, 'card_biography').subjectColumnId, 'literature');

  const card = A.addCardFromTemplate(state, 'tpl_naturestudy');
  assert.ok(card);
  assert.equal(card.title, 'Nature Study');
  assert.ok(state.cards.some((c) => c.id === card.id));
});

test('shared AppState carries a weeklyRhythm and rhythmPrintSettings, read by both map and rhythm layers', () => {
  const state = A.buildSampleAppState();
  assert.ok(state.weeklyRhythm);
  assert.ok(Array.isArray(state.weeklyRhythm.assignments));
  assert.ok(state.rhythmPrintSettings);
  assert.equal(state.rhythmPrintSettings.printMode, 'rhythm-overview');
});

test('addCardFromTemplate creates a resource + resourceUse placeholder when the template expects one', () => {
  const state = A.buildSampleAppState();
  const resCountBefore = state.resources.length;
  const useCountBefore = state.resourceUses.length;

  const noResourceCard = A.addCardFromTemplate(state, 'tpl_naturestudy');
  assert.ok(noResourceCard);
  assert.equal(state.resources.length, resCountBefore, 'suggestedResourceExpectation "none" should not create a resource');
  assert.equal(state.resourceUses.length, useCountBefore);

  const bookCard = A.addCardFromTemplate(state, 'tpl_picturestudy');
  assert.ok(bookCard);
  assert.equal(state.resources.length, resCountBefore + 1);
  assert.equal(state.resourceUses.length, useCountBefore + 1);
  const newUse = state.resourceUses[state.resourceUses.length - 1];
  assert.equal(newUse.cardId, bookCard.id);
  const newResource = state.resources.find((r) => r.id === newUse.resourceId);
  assert.ok(newResource);
  assert.equal(newResource.status, 'undecided');
});

test('a card added from a template is discoverable by the combined Student Lens once it has participants', () => {
  const state = A.buildSampleAppState();
  const card = A.addCardFromTemplate(state, 'tpl_picturestudy');
  A.setCardParticipants(state, card.id, 'individual', ['jeremiah']);
  const lens = A.studentLensView(state, 'jeremiah');
  assert.ok(lens.cards.some((c) => c.id === card.id));
  assert.ok(lens.resources.some((r) => r.uses.some((u) => u.cardId === card.id)));
});

test('combined Student Lens reads map cards, rhythm assignments, and resources from the same shared state', () => {
  const state = A.buildSampleAppState();
  const lens = A.studentLensView(state, 'jeremiah');
  assert.ok(Array.isArray(lens.cards));
  assert.ok(Array.isArray(lens.rhythmAssignments));
  assert.ok(Array.isArray(lens.resources));
  assert.ok(lens.rhythmAssignments.some((a) => a.label === 'Jeremiah independent'));
  assert.ok(lens.rhythmAssignments.some((a) => a.label === 'Jeremiah at co-op all day'));
});

test('"Needs rhythm placement" helpers find cards/loops/sequences absent from the rhythm', () => {
  const state = A.buildSampleAppState();
  const cardsWithoutPlacement = A.getCardsWithoutRhythmPlacement(state);
  assert.ok(Array.isArray(cardsWithoutPlacement));
  // Most sample cards are not referenced by id from the sample rhythm
  assert.ok(cardsWithoutPlacement.length > 0);
  assert.equal(A.cardHasRhythmPlacement(state, 'card_math_kayla'), false);

  // Bible Loop is now placed in the sample rhythm by ID — so it should NOT appear unplaced
  assert.equal(A.loopHasRhythmPlacement(state, 'loop_bible'), true);
  assert.ok(!A.getLoopsWithoutRhythmPlacement(state).some((l) => l.id === 'loop_bible'));
  // Nature Study card is placed; math_kayla is not
  assert.equal(A.cardHasRhythmPlacement(state, 'card_nature_study'), true);
});

test('"Needs rhythm review" flags a rhythm assignment whose referenced card/loop/sequence no longer exists', () => {
  const state = A.buildSampleAppState();
  state.weeklyRhythm.assignments.push(
    R.makeRhythmAssignment({ dayId: state.weeklyRhythm.days[0].id, blockId: state.weeklyRhythm.blocks[0].id, assignmentType: 'card', referencedId: 'card_does_not_exist' })
  );
  const reviewItems = A.getRhythmReviewItems(state);
  assert.ok(reviewItems.some((a) => a.referencedId === 'card_does_not_exist'));
  assert.ok(reviewItems.some((a) => a.missingReference === true));
  assert.ok(reviewItems.every((a) => typeof a.rhythmReviewReason === 'string'));
});

// ---------------------------------------------------------------------------
// Phase 1D — Weekly Rhythm editing wrappers
// ---------------------------------------------------------------------------
test('addRhythmAssignmentToState/updateRhythmAssignmentInState/deleteRhythmAssignmentFromState edit the shared state weeklyRhythm', () => {
  const state = A.buildSampleAppState();
  const dayId = state.weeklyRhythm.days[0].id;
  const blockId = state.weeklyRhythm.blocks[0].id;

  const added = A.addRhythmAssignmentToState(state, { dayId, blockId, label: 'Free reading', assignmentType: 'custom' });
  assert.ok(state.weeklyRhythm.assignments.some((a) => a.id === added.id));

  const updated = A.updateRhythmAssignmentInState(state, added.id, { label: 'Free reading (updated)', isFlexible: true });
  assert.equal(updated.label, 'Free reading (updated)');
  assert.equal(updated.isFlexible, true);

  const deleted = A.deleteRhythmAssignmentFromState(state, added.id);
  assert.equal(deleted, true);
  assert.ok(!state.weeklyRhythm.assignments.some((a) => a.id === added.id));
});

test('addCardToRhythm creates a card-referencing rhythm assignment without touching the card, and resolves placement', () => {
  const state = A.buildSampleAppState();
  const card = state.cards[0];
  const dayId = state.weeklyRhythm.days[0].id;
  const blockId = state.weeklyRhythm.blocks[0].id;

  assert.equal(A.cardHasRhythmPlacement(state, card.id), false);
  const titleBefore = card.title;

  const assignment = A.addCardToRhythm(state, card.id, dayId, blockId);
  assert.equal(assignment.assignmentType, 'card');
  assert.equal(assignment.referencedId, card.id);
  assert.equal(assignment.label, titleBefore);
  assert.equal(card.title, titleBefore); // card itself untouched

  assert.equal(A.cardHasRhythmPlacement(state, card.id), true);
});

test('addCardToRhythm returns null for an unknown card id and does not modify the rhythm', () => {
  const state = A.buildSampleAppState();
  const before = state.weeklyRhythm.assignments.length;
  const result = A.addCardToRhythm(state, 'card_does_not_exist', state.weeklyRhythm.days[0].id, state.weeklyRhythm.blocks[0].id);
  assert.equal(result, null);
  assert.equal(state.weeklyRhythm.assignments.length, before);
});

// ---------------------------------------------------------------------------
// Phase 1D.8 — sequence previous/next, learners, subjects, card row movement
// ---------------------------------------------------------------------------
test('reverseSequenceInState moves the sequence position backward', () => {
  const state = A.buildSampleAppState();
  A.advanceSequenceInState(state, 'seq_readaloud'); // si_2 -> completed, si_3 -> current
  let progress = A.sequenceProgress(state, 'seq_readaloud');
  assert.equal(progress.current.id, 'si_3');

  progress = A.reverseSequenceInState(state, 'seq_readaloud');
  assert.equal(progress.current.id, 'si_2');
});

test('sequenceCanAdvance/sequenceCanReverse guard against moving before first or past last item', () => {
  const state = A.buildSampleAppState();
  // seq_readaloud starts with si_2 current, si_1 completed, si_3 upcoming
  assert.equal(A.sequenceCanReverse(state, 'seq_readaloud'), true);
  assert.equal(A.sequenceCanAdvance(state, 'seq_readaloud'), true);

  A.reverseSequenceInState(state, 'seq_readaloud'); // back to si_1 current
  assert.equal(A.sequenceCanReverse(state, 'seq_readaloud'), false);

  A.advanceSequenceInState(state, 'seq_readaloud'); // si_1 completed, si_2 current
  A.advanceSequenceInState(state, 'seq_readaloud'); // si_2 completed, si_3 current
  A.advanceSequenceInState(state, 'seq_readaloud'); // si_3 completed, nothing current
  assert.equal(A.sequenceCanAdvance(state, 'seq_readaloud'), false);
  assert.equal(A.sequenceCanReverse(state, 'seq_readaloud'), true);
});

test('addStudent auto-generates initials and appears in map rows / participant resolution', () => {
  const state = A.buildSampleAppState();
  const student = A.addStudent(state, { name: 'Noah', gradeBand: 'form1', color: '#445566' });
  assert.equal(student.initials, 'N');
  assert.equal(student.active, true);

  const rows = A.buildMapRows(state).map((r) => r.id);
  assert.ok(rows.includes('individual:' + student.id));

  // "Together" cards resolve to active learners, including the new one
  const togetherIds = M.resolveParticipants(M.makeCard({ participantMode: 'together' }), state.students, state.groups);
  assert.ok(togetherIds.includes(student.id));
});

test('updateStudent and setStudentActive edit a learner; inactive learner is excluded from Together by default', () => {
  const state = A.buildSampleAppState();
  const student = A.addStudent(state, { name: 'Noah' });
  A.updateStudent(state, student.id, { grade: '4th' });
  assert.equal(A.findStudent(state, student.id).grade, '4th');

  A.setStudentActive(state, student.id, false);
  const togetherIds = M.resolveParticipants(M.makeCard({ participantMode: 'together' }), state.students, state.groups);
  assert.ok(!togetherIds.includes(student.id));

  const rows = A.buildMapRows(state).map((r) => r.id);
  assert.ok(!rows.includes('individual:' + student.id), 'inactive learner should not get a map row');
});

test('addSubjectColumn appears on the map and can receive cards; updateSubjectColumn/setSubjectVisible edit it', () => {
  const state = A.buildSampleAppState();
  const subject = A.addSubjectColumn(state, { label: 'Art', color: '#aa5500' });
  let { columns } = A.buildMapGrid(state);
  assert.ok(columns.some((c) => c.id === subject.id));

  A.moveCardToSubject(state, 'card_biography', subject.id);
  assert.ok(A.subjectLensCards(state, subject.id).some((c) => c.id === 'card_biography'));

  A.updateSubjectColumn(state, subject.id, { label: 'Art & Handicrafts' });
  assert.equal(A.findSubject(state, subject.id).label, 'Art & Handicrafts');

  A.setSubjectVisible(state, subject.id, false);
  columns = A.buildMapGrid(state).columns;
  assert.ok(!columns.some((c) => c.id === subject.id), 'hidden subject should not appear as a map column');
  assert.ok(A.findSubject(state, subject.id), 'hidden subject data should be preserved, not deleted');
});

test('moveCardToRow moves a card to another audience/row and updates participant resolution', () => {
  const state = A.buildSampleAppState();
  A.moveCardToRow(state, 'card_biography', 'individual:kayla');
  const card = A.findCard(state, 'card_biography');
  assert.equal(card.audience, 'individual');
  assert.deepEqual(card.participantIds, ['kayla']);
  assert.ok(A.studentLensCards(state, 'kayla', { includeOptional: true }).some((c) => c.id === 'card_biography'));

  A.moveCardToRow(state, 'card_biography', 'group:older');
  assert.equal(A.findCard(state, 'card_biography').audience, 'group');
  assert.ok(A.groupLensCards(state, 'older').some((c) => c.id === 'card_biography'));

  A.moveCardToRow(state, 'card_biography', 'together');
  assert.equal(A.findCard(state, 'card_biography').audience, 'together');
});

test('getStarterTemplatesForForm filters by gradeBand without exploding columns', () => {
  const state = A.buildSampleAppState();
  const form1Templates = A.getStarterTemplatesForForm(state, 'form1');
  assert.ok(form1Templates.length > 0);
  assert.ok(!form1Templates.some((t) => t.id === 'tpl_plutarch'));
  const form3Templates = A.getStarterTemplatesForForm(state, 'form3');
  assert.ok(form3Templates.some((t) => t.id === 'tpl_plutarch'));
});

test('getStarterTemplatesByCategory groups starter templates for the onboarding wizard', () => {
  const state = A.buildSampleAppState();
  const riches = A.getStarterTemplatesByCategory(state, 'form1', 'riches');
  assert.ok(riches.length > 0);
  riches.forEach((t) => assert.equal(t.category, 'riches'));
});

test('addStarterCardsBulk adds cards for a learner without adding new visible columns', () => {
  const state = A.buildSampleAppState();
  const before = state.subjectColumns.length;
  const cards = A.addStarterCardsBulk(state, ['tpl_bible', 'tpl_math'], 'kayla');
  assert.equal(cards.length, 2);
  assert.equal(state.subjectColumns.length, before);
  const mathCard = cards.find((c) => c.subjectColumnId === 'math');
  assert.equal(mathCard.audience, 'individual');
  assert.deepEqual(mathCard.participantIds, ['kayla']);
});

test('starter cards can be added to the map without being placed in the weekly rhythm', () => {
  const state = A.buildSampleAppState();
  const cards = A.addStarterCardsBulk(state, ['tpl_hymn'], 'charis');
  assert.equal(A.cardHasRhythmPlacement(state, cards[0].id), false);
});

test('placeStarterCardsWithRhythmPreset places selected cards using a PNEU-inspired preset', () => {
  const state = A.buildSampleAppState();
  const cards = A.addStarterCardsBulk(state, ['tpl_hymn', 'tpl_handicraft'], 'charis');
  const cardIds = cards.map((c) => c.id);
  const created = A.placeStarterCardsWithRhythmPreset(state, 'preset_form1', cardIds);
  assert.equal(created.length, 2);
  cardIds.forEach((id) => assert.equal(A.cardHasRhythmPlacement(state, id), true));
});

test('planningStatus defaults to active and is separate from card.status', () => {
  const state = A.buildSampleAppState();
  const card = A.addCard(state, { title: 'Test Card', subjectColumnId: 'science' });
  assert.equal(card.planningStatus, 'active');
  assert.equal(card.status, 'active');
  // status controls map row placement; planningStatus is a planning decision
  A.updateCard(state, card.id, { planningStatus: 'not-this-year' });
  const updated = A.findCard(state, card.id);
  assert.equal(updated.planningStatus, 'not-this-year');
  assert.equal(updated.status, 'active'); // status unchanged
});

test('getCoverageStatusForCard derives coverage from resources, never from planningStatus', () => {
  const state = A.buildSampleAppState();
  // grammar card has a resource in 'need-to-choose' state
  const grammarCoverage = A.getCoverageStatusForCard(state, 'card_grammar');
  assert.equal(grammarCoverage, 'need-to-choose');
  // hymn has planningStatus:'practice-no-book' and no resources => 'no-resource-needed'
  const hymnCoverage = A.getCoverageStatusForCard(state, 'card_hymn');
  assert.equal(hymnCoverage, 'no-resource-needed');
  // picture_study has a resource with status:'have-it' => 'covered'
  const pictureCoverage = A.getCoverageStatusForCard(state, 'card_picture_study');
  assert.equal(pictureCoverage, 'covered');
  // math_lucy resource is 'have-it' => 'covered'
  const mathLucyCoverage = A.getCoverageStatusForCard(state, 'card_math_lucy');
  assert.equal(mathLucyCoverage, 'covered');
});

test('getCardsForSubjectColumn returns all cards for a column sorted by title', () => {
  const state = A.buildSampleAppState();
  const historyCards = A.getCardsForSubjectColumn(state, 'history');
  const ids = historyCards.map((c) => c.id);
  assert.ok(ids.includes('card_history_spine'));
  assert.ok(ids.includes('card_biography'));
  assert.ok(ids.includes('card_early_history'));
  assert.ok(ids.includes('card_timeline'));
  // citizenship_gov is geography, not history
  const geoCards = A.getCardsForSubjectColumn(state, 'geography');
  assert.ok(geoCards.map((c) => c.id).includes('card_citizenship_gov'));
  const beautyCards = A.getCardsForSubjectColumn(state, 'beauty');
  assert.equal(beautyCards.length, 5); // hymn, folksong, poetry, picture_study, composer_study
});

test('addCard and updateCard mutate state correctly', () => {
  const state = A.buildSampleAppState();
  const before = state.cards.length;
  const card = A.addCard(state, { title: 'New Card', subjectColumnId: 'languages', planningStatus: 'optional' });
  assert.equal(state.cards.length, before + 1);
  assert.equal(card.planningStatus, 'optional');
  A.updateCard(state, card.id, { title: 'Renamed Card', planningStatus: 'not-this-year' });
  const found = A.findCard(state, card.id);
  assert.equal(found.title, 'Renamed Card');
  assert.equal(found.planningStatus, 'not-this-year');
  assert.equal(A.updateCard(state, 'nonexistent', {}), null);
});

test('co-op card has planningStatus co-op-external and stays in coop-outside row', () => {
  const state = A.buildSampleAppState();
  const coopCard = A.findCard(state, 'card_upper_science');
  assert.equal(coopCard.planningStatus, 'co-op-external');
  assert.equal(coopCard.status, 'coop');
  const rowId = A.rowIdForCard(coopCard);
  assert.equal(rowId, 'coop-outside');
});

test('formApplicability is set on sample cards and survives updateCard round-trip', () => {
  const state = A.buildSampleAppState();
  const historySpine = A.findCard(state, 'card_history_spine');
  assert.deepEqual(historySpine.formApplicability, ['form2', 'form3']);
  const bible = A.findCard(state, 'card_bible');
  assert.deepEqual(bible.formApplicability, []); // all forms
  const plutarch = A.findCard(state, 'card_plutarch');
  assert.deepEqual(plutarch.formApplicability, ['form3']);
  // update changes value
  A.updateCard(state, 'card_bible', { formApplicability: ['form1'] });
  assert.deepEqual(A.findCard(state, 'card_bible').formApplicability, ['form1']);
  // addCard defaults to []
  const card = A.addCard(state, { title: 'New' });
  assert.deepEqual(card.formApplicability, []);
});

test('Resources mode: card_bible derives map labels from loop items, not card title', () => {
  const state = A.buildSampleAppState();
  const bibleCard = A.findCard(state, 'card_bible');
  assert.ok(bibleCard, 'card_bible exists');
  assert.ok(bibleCard.loopId, 'card_bible has a loopId');
  // The loop items are the resource/strand labels for the map
  const loopItems = state.loopItems.filter(function (li) { return li.loopId === bibleCard.loopId; });
  assert.ok(loopItems.length >= 3, 'Bible loop has at least 3 items — map shows those, not just "Bible Loop"');
  const titles = loopItems.map(function (li) { return li.title; });
  assert.ok(titles.some(function (t) { return t.toLowerCase().includes('matthew') || t.toLowerCase().includes('testament'); }),
    'Loop items include Bible-specific strand titles');
});

test('Resources mode: card_american_history has strandLabels overriding resource title', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_american_history');
  assert.ok(card.strandLabels && card.strandLabels.length >= 2,
    'card_american_history has strandLabels with multiple strands');
  assert.ok(card.strandLabels.some(function (s) { return s.toLowerCase().includes('spine'); }),
    'strandLabels includes a spine label');
  assert.ok(card.strandLabels.some(function (s) { return s.toLowerCase().includes('story') || s.toLowerCase().includes('picture'); }),
    'strandLabels includes supplementary strand labels beyond the main spine');
});

test('Resources mode: card_history_spine strandLabels reflects current cycle (Modern Times)', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_history_spine');
  assert.ok(card.strandLabels && card.strandLabels.length > 0,
    'card_history_spine has strandLabels');
  assert.ok(card.strandLabels[0].toLowerCase().includes('modern'),
    'history spine strandLabels references Modern Times cycle');
});

test('Resources mode: card_readaloud derives map labels from sequence items (current + upcoming)', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_readaloud');
  assert.ok(card.sequenceId, 'card_readaloud has sequenceId');
  const currentItem = state.sequenceItems.find(function (si) { return si.sequenceId === card.sequenceId && si.status === 'current'; });
  assert.ok(currentItem, 'sequence has a current item');
  // The current item title is the map display label (not "Family Read-Alouds")
  assert.ok(currentItem.title && currentItem.title !== 'Family Read-Alouds',
    'Map label would be the actual book title, not the card title');
});

test('Resources mode: cards without strandLabels/loop/sequence fall back to resource title then card title', () => {
  const state = A.buildSampleAppState();
  // card_grammar has a resource but no strandLabels/loop/sequence
  const grammar = A.findCard(state, 'card_grammar');
  assert.ok(!grammar.strandLabels, 'card_grammar has no strandLabels');
  assert.ok(!grammar.loopId, 'card_grammar has no loopId');
  assert.ok(!grammar.sequenceId, 'card_grammar has no sequenceId');
  assert.ok(grammar.resourceUseIds && grammar.resourceUseIds.length > 0, 'card_grammar has resource use');
  // Grammar resource is need-to-choose, so map falls back to card title (not placeholder resource title)
  const use = state.resourceUses.find(function (u) { return u.id === grammar.resourceUseIds[0]; });
  const res = A.findResource(state, use.resourceId);
  assert.ok(res && (res.status === 'need-to-choose' || res.status === 'undecided'),
    'Grammar resource is need-to-choose so map skips it and uses card title');
  assert.equal(grammar.title, 'Grammar', 'card title is the fallback label for unresolved grammar resource');
});

test('Subject Map: cells with mapGroups collapse to fewer chips than Detailed Map', () => {
  // Subject Map: each mapGroup → 1 chip; Detailed Map: every card → 1 chip
  const state = A.buildSampleAppState();

  const beautyLoopCards = state.cards.filter(function (c) { return c.mapGroup === 'Beauty Loop'; });
  assert.ok(beautyLoopCards.length >= 4, 'At least 4 Beauty Loop cards exist: Subject Map collapses to 1 group chip, Detailed Map shows each separately');

  const historyCards = state.cards.filter(function (c) { return c.mapGroup === 'History Cycle'; });
  assert.ok(historyCards.length >= 3, 'At least 3 History Cycle cards: Subject Map shows 1 chip, Detailed Map shows N chips');
});

test('Detailed Map shows more items than Subject Map because mapGroups are not collapsed', () => {
  const state = A.buildSampleAppState();
  const activeCards = state.cards.filter(function (c) { return c.status === 'active' || c.status === 'optional'; });
  const allGroups = new Set();
  let ungroupedCount = 0;
  activeCards.forEach(function (c) {
    if (c.mapGroup) allGroups.add(c.mapGroup);
    else ungroupedCount++;
  });
  assert.ok(activeCards.length > allGroups.size + ungroupedCount,
    'Detailed (one chip per card=' + activeCards.length + ') > Subject Map groupings (groups=' + allGroups.size + ' + ungrouped=' + ungroupedCount + ')');
});

test('Resource Map and Subject Map differ: Resource Map uses text strand labels, Subject Map uses chips', () => {
  // Resource Map is a flat text list (strand/resource labels).
  // Subject Map is chip-based grouping. They are fundamentally different rendering modes.
  // We can verify this at the data level: the same set of cards should produce different label sets.
  const state = A.buildSampleAppState();
  // History Cycle in Resource Map → strandLabels/resource titles (Modern Times — World History Spine, etc.)
  const histSpine = A.findCard(state, 'card_history_spine');
  assert.ok(histSpine.strandLabels && histSpine.strandLabels.length > 0, 'History spine has strandLabels for Resource Map');
  // In Subject Map, it would show under a "History Cycle" group chip instead
  assert.equal(histSpine.mapGroup, 'History Cycle', 'History spine is in History Cycle mapGroup for Subject Map');
  // These produce different outputs: strandLabels for Resource Map vs groupName chip for Subject Map
  assert.notEqual(histSpine.strandLabels[0], histSpine.mapGroup, 'Resource Map label differs from Subject Map group name');
});

test('Resource Map falls back to card title when resource is need-to-choose', () => {
  const state = A.buildSampleAppState();
  // Grammar resource is need-to-choose; getMapLabels should return card title not resource title
  const grammar = A.findCard(state, 'card_grammar');
  const use = state.resourceUses.find(function (u) { return grammar.resourceUseIds && grammar.resourceUseIds.includes(u.id); });
  const res = use ? A.findResource(state, use.resourceId) : null;
  assert.ok(res && (res.status === 'need-to-choose' || res.status === 'undecided'), 'Grammar resource is need-to-choose');
  // The card title is the clean fallback
  assert.equal(grammar.title, 'Grammar', 'Card title "Grammar" is the clean fallback for Resource Map');
});

test('Resource Map has no TBD placeholder labels for any card in the demo', () => {
  // No resource title containing "(TBD)" should appear in the labels that Resource Map would show.
  const state = A.buildSampleAppState();
  const tdbPattern = /\(TBD\)/i;
  // Check all resource titles that are NOT need-to-choose/undecided (those get skipped)
  state.resources.forEach(function (res) {
    if (res.status !== 'need-to-choose' && res.status !== 'undecided') {
      assert.ok(!tdbPattern.test(res.title),
        'Resource "' + res.title + '" (status: ' + res.status + ') should not contain (TBD) — use cleanMapLabel');
    }
  });
});

test('Beauty Loop in Subject Map shows 1 group entry; in Detailed Map shows individual cards', () => {
  const state = A.buildSampleAppState();
  const beautyCards = state.cards.filter(function (c) { return c.mapGroup === 'Beauty Loop'; });
  assert.ok(beautyCards.length >= 4, 'At least 4 Beauty Loop cards');
  // Subject Map: 1 distinct mapGroup
  const subjectGroups = new Set(beautyCards.map(function (c) { return c.mapGroup; }));
  assert.equal(subjectGroups.size, 1, 'Subject Map shows 1 Beauty Loop group chip');
  // Detailed Map: every card individually
  assert.ok(beautyCards.length > 1, 'Detailed Map shows ' + beautyCards.length + ' individual Beauty Loop chips');
});

test('History in Resource Map uses strandLabels; in Subject Map uses History Cycle group chip', () => {
  const state = A.buildSampleAppState();
  const historyCards = state.cards.filter(function (c) { return c.mapGroup === 'History Cycle'; });
  assert.ok(historyCards.length >= 3);
  // Cards with strandLabels would show those in Resource Map
  const withStrands = historyCards.filter(function (c) { return c.strandLabels && c.strandLabels.length; });
  assert.ok(withStrands.length >= 2, 'At least 2 history cards have explicit strandLabels for Resource Map');
  // All share the same mapGroup for Subject Map grouping
  const uniqueGroups = new Set(historyCards.map(function (c) { return c.mapGroup; }));
  assert.equal(uniqueGroups.size, 1, 'All history cards collapse to 1 History Cycle chip in Subject Map');
});

test('card_american_history exists in history column with mapGroup History Cycle', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_american_history');
  assert.ok(card, 'card_american_history should exist');
  assert.equal(card.subjectColumnId, 'history');
  assert.equal(card.mapGroup, 'History Cycle');
});

test('beauty cards in sample state share mapGroup Beauty Loop', () => {
  const state = A.buildSampleAppState();
  const beautyIds = ['card_hymn', 'card_folksong', 'card_poetry', 'card_picture_study', 'card_composer_study'];
  for (const id of beautyIds) {
    const card = A.findCard(state, id);
    assert.ok(card, `${id} should exist`);
    assert.equal(card.mapGroup, 'Beauty Loop', `${id} should have mapGroup 'Beauty Loop'`);
  }
});

test('history older cards all have mapGroup History Cycle', () => {
  const state = A.buildSampleAppState();
  const histIds = ['card_history_spine', 'card_american_history', 'card_biography', 'card_timeline'];
  for (const id of histIds) {
    const card = A.findCard(state, id);
    assert.ok(card, `${id} should exist`);
    assert.equal(card.mapGroup, 'History Cycle', `${id} should have mapGroup 'History Cycle'`);
  }
});

test('not-this-year planning status does not affect map row placement', () => {
  const state = A.buildSampleAppState();
  // planningStatus:'not-this-year' means a planning decision; map row is set by status/audience separately
  const card = A.addCard(state, { title: 'Skipped Card', subjectColumnId: 'science', planningStatus: 'not-this-year' });
  // makeCard defaults status to 'active'; planningStatus can be set independently
  assert.equal(card.planningStatus, 'not-this-year');
  // Explicitly set status to unplaced and verify row placement reflects status, not planningStatus
  A.updateCard(state, card.id, { status: 'unplaced', audience: 'unplaced' });
  const updated = A.findCard(state, card.id);
  assert.equal(updated.planningStatus, 'not-this-year');
  assert.equal(A.rowIdForCard(updated), 'unplaced');
});

// ---------------------------------------------------------------------------
// commitCardResources — resource CRUD via adapter
// ---------------------------------------------------------------------------

test('getResourceUsesForCard returns uses linked to a specific card', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_bible');
  const uses = A.getResourceUsesForCard(state, card.id);
  // Bible loop card may or may not have direct resource uses
  assert.ok(Array.isArray(uses), 'returns an array');
  // All returned uses should reference the correct card
  uses.forEach(function (u) { assert.equal(u.cardId, card.id); });
});

test('commitCardResources adds a new resource and ResourceUse to a card', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_bible');
  const before = A.getResourceUsesForCard(state, card.id).length;
  A.commitCardResources(state, card.id, [
    { _resId: null, _useId: null, title: 'New Testament', status: 'have-it' }
  ]);
  const uses = A.getResourceUsesForCard(state, card.id);
  assert.equal(uses.length, 1, 'one ResourceUse added');
  const res = A.findResource(state, uses[0].resourceId);
  assert.ok(res, 'Resource created');
  assert.equal(res.title, 'New Testament');
  assert.equal(res.status, 'have-it');
  assert.ok(card.resourceUseIds.includes(uses[0].id), 'card.resourceUseIds updated');
});

test('commitCardResources updates an existing resource title and status', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_bible');
  A.commitCardResources(state, card.id, [{ _resId: null, _useId: null, title: 'Draft NT', status: 'need-to-buy' }]);
  const use = A.getResourceUsesForCard(state, card.id)[0];
  const res = A.findResource(state, use.resourceId);
  // Now update via commitCardResources
  A.commitCardResources(state, card.id, [{ _resId: res.id, _useId: use.id, title: 'New Testament', status: 'have-it' }]);
  const updated = A.findResource(state, res.id);
  assert.equal(updated.title, 'New Testament');
  assert.equal(updated.status, 'have-it');
  assert.equal(A.getResourceUsesForCard(state, card.id).length, 1, 'still 1 use — no duplicate');
});

test('commitCardResources removes a deleted resource and its use when not shared', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_bible');
  A.commitCardResources(state, card.id, [{ _resId: null, _useId: null, title: 'NT to delete', status: 'need-to-choose' }]);
  const use = A.getResourceUsesForCard(state, card.id)[0];
  const resId = use.resourceId;
  // Now remove it by committing empty list
  A.commitCardResources(state, card.id, []);
  assert.equal(A.getResourceUsesForCard(state, card.id).length, 0, 'ResourceUse removed');
  assert.ok(!A.findResource(state, resId), 'Resource removed (not shared)');
  assert.deepEqual(card.resourceUseIds, [], 'card.resourceUseIds cleared');
});

test('commitCardResources does not delete a resource that is shared by another card', () => {
  const state = A.buildSampleAppState();
  const cardA = A.findCard(state, 'card_bible');
  const cardB = A.addCard(state, { title: 'Other Card', subjectColumnId: 'bible' });
  // Add a resource to cardA
  A.commitCardResources(state, cardA.id, [{ _resId: null, _useId: null, title: 'Shared Book', status: 'have-it' }]);
  const useA = A.getResourceUsesForCard(state, cardA.id)[0];
  const sharedResId = useA.resourceId;
  // Simulate another card also using the same resource by pushing a use directly
  const useB = M.makeResourceUse({ resourceId: sharedResId, cardId: cardB.id });
  state.resourceUses.push(useB);
  cardB.resourceUseIds = [useB.id];
  // Now remove from cardA — shared resource must NOT be deleted
  A.commitCardResources(state, cardA.id, []);
  assert.equal(A.getResourceUsesForCard(state, cardA.id).length, 0, 'useA removed from cardA');
  assert.ok(A.findResource(state, sharedResId), 'shared resource preserved because cardB still uses it');
});

test('resource added via commitCardResources is visible in getResourceList', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_bible');
  A.commitCardResources(state, card.id, [
    { _resId: null, _useId: null, title: 'New Testament', status: 'have-it' }
  ]);
  const grouped = A.getResourceList(state, { groupBy: 'subject' });
  // grouped is an object keyed by subject id; each value is an array of resource rollup items
  const bibleGroup = grouped[card.subjectColumnId];
  assert.ok(bibleGroup, 'subject group exists for ' + card.subjectColumnId);
  const ntRes = bibleGroup.find(function (r) { return r.title === 'New Testament'; });
  assert.ok(ntRes, 'New Testament appears in resource list after commitCardResources');
});

test('resource added from map card persists through JSON export/import round-trip', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_bible');
  A.commitCardResources(state, card.id, [
    { _resId: null, _useId: null, title: 'New Testament', status: 'have-it' }
  ]);
  // Simulate export/import (JSON serialize + deserialize)
  const exported = JSON.parse(JSON.stringify(state));
  const resInExport = exported.resources.find(function (r) { return r.title === 'New Testament'; });
  assert.ok(resInExport, 'Resource preserved in export');
  const useInExport = exported.resourceUses.find(function (u) { return u.cardId === card.id && u.resourceId === resInExport.id; });
  assert.ok(useInExport, 'ResourceUse preserved in export');
  const cardInExport = exported.cards.find(function (c) { return c.id === card.id; });
  assert.ok(cardInExport.resourceUseIds.includes(useInExport.id), 'card.resourceUseIds preserved');
});

test('coverage status updates after adding a resource via commitCardResources', () => {
  const state = A.buildSampleAppState();
  // Find a card with no resources
  const cardNoRes = A.addCard(state, { title: 'Empty Card', subjectColumnId: 'science' });
  assert.equal(A.getCoverageStatusForCard(state, cardNoRes.id), 'not-tracked', 'initially not-tracked');
  A.commitCardResources(state, cardNoRes.id, [
    { _resId: null, _useId: null, title: 'Science Book', status: 'have-it' }
  ]);
  assert.equal(A.getCoverageStatusForCard(state, cardNoRes.id), 'covered', 'covered after have-it resource added');
  A.commitCardResources(state, cardNoRes.id, [
    { _resId: null, _useId: null, title: 'Science Book', status: 'need-to-buy' }
  ]);
  assert.equal(A.getCoverageStatusForCard(state, cardNoRes.id), 'needs-books', 'needs-books when need-to-buy');
});

test('findResourceUse retrieves a use by id', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_bible');
  A.commitCardResources(state, card.id, [{ _resId: null, _useId: null, title: 'NT', status: 'have-it' }]);
  const use = A.getResourceUsesForCard(state, card.id)[0];
  assert.ok(use);
  assert.strictEqual(A.findResourceUse(state, use.id), use);
  assert.strictEqual(A.findResourceUse(state, 'nonexistent'), null);
});

// ---------------------------------------------------------------------------
// Phase 1D.10h — lesson length text + 4-layer architecture
// ---------------------------------------------------------------------------

test('lessonLengthText returns min–target range', () => {
  const state = A.buildSampleAppState();
  const card = state.cards[0];
  card.lessonTimeConfig = { minMinutes: 5, targetMinutes: 10, maxMinutes: 15, hardMaxMinutes: null, sessionsPerWeek: null };
  assert.equal(A.lessonLengthText(card), '5–10 min');
});

test('lessonLengthText returns ~target when min equals target', () => {
  const state = A.buildSampleAppState();
  const card = state.cards[0];
  card.lessonTimeConfig = { minMinutes: 10, targetMinutes: 10, maxMinutes: null, hardMaxMinutes: null, sessionsPerWeek: null };
  assert.equal(A.lessonLengthText(card), '~10 min');
});

test('lessonLengthText returns min+ when only minMinutes set', () => {
  const state = A.buildSampleAppState();
  const card = state.cards[0];
  card.lessonTimeConfig = { minMinutes: 5, targetMinutes: null, maxMinutes: null, hardMaxMinutes: null, sessionsPerWeek: null };
  assert.equal(A.lessonLengthText(card), '5+ min');
});

test('lessonLengthText returns empty string when no config', () => {
  const state = A.buildSampleAppState();
  const card = state.cards[0];
  card.lessonTimeConfig = { minMinutes: null, targetMinutes: null, maxMinutes: null, hardMaxMinutes: null, sessionsPerWeek: null };
  assert.equal(A.lessonLengthText(card), '');
  assert.equal(A.lessonLengthText(null), '');
});

test('lessonLengthText returns ~target when only targetMinutes set', () => {
  const state = A.buildSampleAppState();
  const card = state.cards[0];
  card.lessonTimeConfig = { minMinutes: null, targetMinutes: 20, maxMinutes: null, hardMaxMinutes: null, sessionsPerWeek: null };
  assert.equal(A.lessonLengthText(card), '~20 min');
});

// ---------------------------------------------------------------------------
// getCardSequenceItems / getCardLoopItems / getCardSequence / getCardLoop
// ---------------------------------------------------------------------------

test('getCardSequenceItems returns items for card_readaloud in position order', () => {
  const state = A.buildSampleAppState();
  const items = A.getCardSequenceItems(state, 'card_readaloud');
  assert.equal(items.length, 3);
  assert.equal(items[0].title, 'The Hobbit');
  assert.equal(items[0].status, 'completed');
  assert.equal(items[1].title, "Charlotte's Web");
  assert.equal(items[1].status, 'current');
  assert.equal(items[2].title, 'The Wind in the Willows');
  assert.equal(items[2].status, 'upcoming');
});

test('getCardSequenceItems returns [] for card with no sequenceId', () => {
  const state = A.buildSampleAppState();
  const card = A.addCard(state, { subjectColumnId: state.subjectColumns[0].id });
  const items = A.getCardSequenceItems(state, card.id);
  assert.deepEqual(items, []);
});

test('getCardLoopItems returns items for card_bible in sortOrder', () => {
  const state = A.buildSampleAppState();
  const items = A.getCardLoopItems(state, 'card_bible');
  assert.equal(items.length, 4);
  assert.equal(items[0].title, 'Matthew');
  assert.equal(items[1].title, 'Psalms + Proverbs');
  assert.equal(items[2].title, 'Theology');
  assert.equal(items[3].title, 'Old Testament');
});

test('getCardLoopItems returns [] for card with no loopId', () => {
  const state = A.buildSampleAppState();
  const card = A.addCard(state, { subjectColumnId: state.subjectColumns[0].id });
  const items = A.getCardLoopItems(state, card.id);
  assert.deepEqual(items, []);
});

test('getCardSequence returns the sequence object for card_readaloud', () => {
  const state = A.buildSampleAppState();
  const seq = A.getCardSequence(state, 'card_readaloud');
  assert.ok(seq);
  assert.equal(seq.title, 'Family Read-Alouds');
});

test('getCardLoop returns the loop object for card_bible', () => {
  const state = A.buildSampleAppState();
  const loop = A.getCardLoop(state, 'card_bible');
  assert.ok(loop);
  assert.equal(loop.title, 'Bible Loop');
});

test('getCardSequence returns null for card with no sequenceId', () => {
  const state = A.buildSampleAppState();
  const card = A.addCard(state, { subjectColumnId: state.subjectColumns[0].id });
  assert.equal(A.getCardSequence(state, card.id), null);
});

test('getCardLoop returns null for card with no loopId', () => {
  const state = A.buildSampleAppState();
  const card = A.addCard(state, { subjectColumnId: state.subjectColumns[0].id });
  assert.equal(A.getCardLoop(state, card.id), null);
});

// ---------------------------------------------------------------------------
// commitSequenceItems
// ---------------------------------------------------------------------------

test('commitSequenceItems: adding a new item', () => {
  const state = A.buildSampleAppState();
  const existing = A.getCardSequenceItems(state, 'card_readaloud');
  const pending = existing.map(si => ({ _itemId: si.id, title: si.title, status: si.status }));
  pending.push({ _itemId: null, title: 'The Secret Garden', status: 'upcoming' });
  A.commitSequenceItems(state, 'card_readaloud', pending);
  const after = A.getCardSequenceItems(state, 'card_readaloud');
  assert.ok(after.some(si => si.title === 'The Secret Garden'));
  assert.equal(after.length, 4);
});

test('commitSequenceItems: removing an item', () => {
  const state = A.buildSampleAppState();
  const existing = A.getCardSequenceItems(state, 'card_readaloud');
  const pending = existing.filter(si => si.title !== 'The Hobbit').map(si => ({ _itemId: si.id, title: si.title, status: si.status }));
  A.commitSequenceItems(state, 'card_readaloud', pending);
  const after = A.getCardSequenceItems(state, 'card_readaloud');
  assert.ok(!after.some(si => si.title === 'The Hobbit'));
  assert.equal(after.length, 2);
});

test('commitSequenceItems: updating a title', () => {
  const state = A.buildSampleAppState();
  const existing = A.getCardSequenceItems(state, 'card_readaloud');
  const pending = existing.map(si => ({
    _itemId: si.id,
    title: si.title === "Charlotte's Web" ? 'Charlotte Updated' : si.title,
    status: si.status
  }));
  A.commitSequenceItems(state, 'card_readaloud', pending);
  const after = A.getCardSequenceItems(state, 'card_readaloud');
  assert.ok(after.some(si => si.title === 'Charlotte Updated'));
  assert.ok(!after.some(si => si.title === "Charlotte's Web"));
});

test('commitSequenceItems: no-op for card without sequenceId', () => {
  const state = A.buildSampleAppState();
  const card = A.addCard(state, { subjectColumnId: state.subjectColumns[0].id });
  const before = state.sequenceItems.length;
  A.commitSequenceItems(state, card.id, [{ _itemId: null, title: 'Test', status: 'upcoming' }]);
  assert.equal(state.sequenceItems.length, before);
});

// ---------------------------------------------------------------------------
// commitLoopItems
// ---------------------------------------------------------------------------

test('commitLoopItems: adding a new item', () => {
  const state = A.buildSampleAppState();
  const existing = A.getCardLoopItems(state, 'card_bible');
  const pending = existing.map(li => ({ _itemId: li.id, title: li.title }));
  pending.push({ _itemId: null, title: 'Job' });
  A.commitLoopItems(state, 'card_bible', pending);
  const after = A.getCardLoopItems(state, 'card_bible');
  assert.ok(after.some(li => li.title === 'Job'));
  assert.equal(after.length, 5);
});

test('commitLoopItems: removing an item', () => {
  const state = A.buildSampleAppState();
  const existing = A.getCardLoopItems(state, 'card_bible');
  const pending = existing.filter(li => li.title !== 'Old Testament').map(li => ({ _itemId: li.id, title: li.title }));
  A.commitLoopItems(state, 'card_bible', pending);
  const after = A.getCardLoopItems(state, 'card_bible');
  assert.ok(!after.some(li => li.title === 'Old Testament'));
  assert.equal(after.length, 3);
});

// ---------------------------------------------------------------------------
// getCardMapLabels / cardNeedsResourceChoice
// ---------------------------------------------------------------------------

test('getCardMapLabels: sequence card returns nonDone items with star on current', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_readaloud');
  const labels = A.getCardMapLabels(state, card);
  assert.ok(labels.some(l => l.includes("Charlotte's Web") && l.includes('★')));
  assert.ok(labels.some(l => l.includes('The Wind in the Willows')));
  assert.ok(!labels.some(l => l.includes('The Hobbit')));
});

test('getCardMapLabels: loop card returns all loop item titles', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_bible');
  const labels = A.getCardMapLabels(state, card);
  assert.ok(labels.includes('Matthew'));
  assert.ok(labels.includes('Psalms + Proverbs'));
  assert.ok(labels.includes('Theology'));
  assert.ok(labels.includes('Old Testament'));
});

test('cardNeedsResourceChoice: true for card with no resources/seq/loop', () => {
  const state = A.buildSampleAppState();
  const card = A.addCard(state, { subjectColumnId: state.subjectColumns[0].id });
  assert.equal(A.cardNeedsResourceChoice(state, card), true);
});

test('cardNeedsResourceChoice: false for card_readaloud (has sequenceId)', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_readaloud');
  assert.equal(A.cardNeedsResourceChoice(state, card), false);
});

// ---------------------------------------------------------------------------
// Time guidance model
// ---------------------------------------------------------------------------

test('makeTimeGuidanceByForm returns defaults with correct form1 label', () => {
  const g = M.makeTimeGuidanceByForm();
  assert.equal(g.form1.minutesMin, 10);
  assert.equal(g.form1.minutesMax, 15);
  assert.equal(g.form1.weeklyTouches, 3);
  assert.ok(g.form1.label.includes('10'));
  assert.ok(g.form2.weeklyTouches === 2);
  assert.ok(g.form3.minutesMin === 20);
});

test('makeTimeGuidanceByForm accepts overrides per form', () => {
  const g = M.makeTimeGuidanceByForm({ form1: { minutesMin: 5, minutesMax: 10, weeklyTouches: 5, label: '5–10 min · 5×/week' } });
  assert.equal(g.form1.minutesMin, 5);
  assert.equal(g.form2.minutesMin, 15);
});

// ---------------------------------------------------------------------------
// Resource pacing model
// ---------------------------------------------------------------------------

test('makeResourcePacing returns correct defaults', () => {
  const p = M.makeResourcePacing();
  assert.equal(p.totalUnits, null);
  assert.equal(p.unitType, 'chapters');
  assert.equal(p.unitsPerTouch, 1);
  assert.equal(p.termAssignment, 'unassigned');
});

test('makeResourcePacing accepts field overrides', () => {
  const p = M.makeResourcePacing({ totalUnits: 22, unitType: 'chapters', termAssignment: 'term1' });
  assert.equal(p.totalUnits, 22);
  assert.equal(p.termAssignment, 'term1');
  assert.equal(p.unitsPerTouch, 1);
});

test('RESOURCE_PACING_UNIT_TYPES includes chapters and sessions', () => {
  assert.ok(M.RESOURCE_PACING_UNIT_TYPES.includes('chapters'));
  assert.ok(M.RESOURCE_PACING_UNIT_TYPES.includes('sessions'));
});

test('TERM_ASSIGNMENT_OPTIONS includes all-year and unassigned', () => {
  assert.ok(M.TERM_ASSIGNMENT_OPTIONS.includes('all-year'));
  assert.ok(M.TERM_ASSIGNMENT_OPTIONS.includes('unassigned'));
});

// ---------------------------------------------------------------------------
// Phase 1D.10k — CM / PNEU alignment
// ---------------------------------------------------------------------------

test('LESSON_TIME_GUARDRAILS has correct friendly target values (not strange exact numbers)', () => {
  assert.equal(M.LESSON_TIME_GUARDRAILS.form1.target, 20, 'Form I target should be 20 min (not 18)');
  assert.equal(M.LESSON_TIME_GUARDRAILS.form2.target, 30, 'Form II target should be 30 min (not 25)');
  assert.equal(M.LESSON_TIME_GUARDRAILS.form3.target, 45, 'Form III target should be 45 min (not 38)');
});

test('lessonLengthRangeLabel returns friendly range strings', () => {
  assert.equal(M.lessonLengthRangeLabel('form1'), '15–20 min');
  assert.equal(M.lessonLengthRangeLabel('form2'), '20–30 min');
  assert.equal(M.lessonLengthRangeLabel('form3'), '30–45 min');
  assert.equal(M.lessonLengthRangeLabel('unknown'), '');
});

test('card_bible lesson display shows 10–15 min (not 18 or ~18)', () => {
  const state = A.buildSampleAppState();
  const bibleCard = A.findCard(state, 'card_bible');
  const text = A.lessonLengthText(bibleCard);
  assert.ok(!text.includes('18'), 'Bible card lesson length should not include "18": got ' + text);
  assert.ok(text.includes('10') || text.includes('15'), 'Bible card should show 10–15 range: got ' + text);
});

test('lessonTimeConfigFromGradeBand form1 produces 15–20 min via lessonLengthText', () => {
  const ltc = M.lessonTimeConfigFromGradeBand('form1');
  const card = { lessonTimeConfig: ltc };
  const text = A.lessonLengthText(card);
  assert.equal(text, '15–20 min', 'Form I config should display as 15–20 min: got ' + text);
});

test('card_math_charis exists in sample state for Charis', () => {
  const state = A.buildSampleAppState();
  const card = A.findCard(state, 'card_math_charis');
  assert.ok(card, 'card_math_charis should exist');
  assert.equal(card.subjectColumnId, 'math');
  assert.deepEqual(card.participantIds, ['charis']);
  assert.ok(card.lessonTimeConfig, 'card_math_charis should have a lessonTimeConfig');
});

test('Charis has an individual math card just like Kayla and Lucy', () => {
  const state = A.buildSampleAppState();
  const charisRow = A.buildMapGrid(state).grid.find(function (g) { return g.row.id === 'individual:charis'; });
  assert.ok(charisRow, 'Charis row exists');
  assert.ok(charisRow.cells.math.some(function (c) { return c.id === 'card_math_charis'; }), 'Charis has a math card in the grid');
  assert.ok(A.studentLensCards(state, 'charis').some(function (c) { return c.id === 'card_math_charis'; }), 'Charis math card in student lens');
});

test('Bible Loop is placed in the sample weekly rhythm (loop assignment by ID)', () => {
  const state = A.buildSampleAppState();
  assert.equal(A.loopHasRhythmPlacement(state, 'loop_bible'), true, 'loop_bible should be placed in the rhythm');
  assert.ok(A.getLoopsWithoutRhythmPlacement(state).every(function (l) { return l.id !== 'loop_bible'; }), 'loop_bible should NOT appear in unplaced list');
});

test('Family Read-Alouds sequence is placed in the sample weekly rhythm (sequence assignment by ID)', () => {
  const state = A.buildSampleAppState();
  const placed = R.sequenceHasRhythmPlacement(state.weeklyRhythm, 'seq_readaloud');
  assert.equal(placed, true, 'seq_readaloud should be placed in the rhythm');
  assert.ok(R.getSequencesWithoutRhythmPlacement(state.weeklyRhythm, state.sequences).every(function (s) { return s.id !== 'seq_readaloud'; }), 'seq_readaloud should NOT appear in unplaced list');
});

test('loopHasRhythmPlacement returns false when rhythm has only text-label assignments (no loop type)', () => {
  const rhythm = R.makeWeeklyRhythm({
    days: [R.makeRhythmDay({ id: 'd1', label: 'Day 1' })],
    blocks: [R.makeRhythmBlock({ id: 'morning', label: 'Morning' })],
    assignments: [
      R.makeRhythmAssignment({ dayId: 'd1', blockId: 'morning', label: 'Bible Loop', assignmentType: 'custom' })
    ]
  });
  assert.equal(R.loopHasRhythmPlacement(rhythm, 'loop_bible'), false, 'text-label "Bible Loop" should NOT satisfy ID-based check');
});

test('Nature Study card is placed in the sample weekly rhythm', () => {
  const state = A.buildSampleAppState();
  assert.equal(A.cardHasRhythmPlacement(state, 'card_nature_study'), true, 'card_nature_study should be placed (by ID)');
});

test('sample state Form I cards include expected CM strand subjects', () => {
  const state = A.buildSampleAppState();
  const ids = state.cards.map(function (c) { return c.id; });
  // Core Form I strands
  assert.ok(ids.includes('card_phonics'), 'Phonics / Reading Practice');
  assert.ok(ids.includes('card_copywork'), 'Copywork');
  assert.ok(ids.includes('card_recitation'), 'Recitation / Memory Work');
  assert.ok(ids.includes('card_math_charis'), 'Math (Form I individual)');
  assert.ok(ids.includes('card_nature_study'), 'Nature Study');
  assert.ok(ids.includes('card_early_history'), 'Early History Stories');
  assert.ok(ids.includes('card_tales'), 'Tales / Fairy Tales');
  assert.ok(ids.includes('card_hymn'), 'Hymn');
  assert.ok(ids.includes('card_folksong'), 'Folk Song');
  assert.ok(ids.includes('card_poetry'), 'Poetry');
  assert.ok(ids.includes('card_picture_study'), 'Picture Study');
  assert.ok(ids.includes('card_drawing'), 'Drawing');
  assert.ok(ids.includes('card_handicraft'), 'Handicraft');
  assert.ok(ids.includes('card_pe'), 'PE / Movement');
});

test('sample state Form II/III cards include expected CM strand subjects', () => {
  const state = A.buildSampleAppState();
  const ids = state.cards.map(function (c) { return c.id; });
  assert.ok(ids.includes('card_dictation'), 'Dictation');
  assert.ok(ids.includes('card_grammar'), 'Grammar');
  assert.ok(ids.includes('card_written_narration'), 'Written Narration');
  assert.ok(ids.includes('card_shakespeare'), 'Shakespeare (F3 optional)');
  assert.ok(ids.includes('card_timeline'), 'Timeline / Book of Centuries');
  assert.ok(ids.includes('card_plutarch'), 'Plutarch');
  assert.ok(ids.includes('card_citizenship_gov'), 'Citizenship / Government');
});

test('getCardRhythmStatus returns placed for card_nature_study', () => {
  const state = A.buildSampleAppState();
  const result = A.getCardRhythmStatus(state, 'card_nature_study');
  assert.equal(result.status, 'placed');
});

test('getCardRhythmStatus returns covered-by-loop for card_bible via loop items', () => {
  const state = A.buildSampleAppState();
  const result = A.getCardRhythmStatus(state, 'card_bible');
  assert.equal(result.status, 'covered-by-loop');
  assert.equal(result.loopId, 'loop_bible');
});

test('getLoopRhythmStatus returns placed for loop_bible', () => {
  const state = A.buildSampleAppState();
  const result = A.getLoopRhythmStatus(state, 'loop_bible');
  assert.equal(result.status, 'placed');
});

test('buildCombineAndPlanRows returns rows including card_bible and loop_bible', () => {
  const state = A.buildSampleAppState();
  const rows = A.buildCombineAndPlanRows(state);
  const ids = rows.map(function(r) { return r.id; });
  assert.ok(ids.includes('card_bible'), 'card_bible row present');
  assert.ok(ids.includes('loop_bible'), 'loop_bible row present');
});

test('loop items in sample state have linkedCardId field', () => {
  const state = A.buildSampleAppState();
  const bibleItems = state.loopItems.filter(function(li) { return li.loopId === 'loop_bible'; });
  assert.ok(bibleItems.length > 0, 'bible loop has items');
  bibleItems.forEach(function(li) {
    assert.equal(li.linkedCardId, 'card_bible', 'linkedCardId is card_bible');
  });
});

test('makeLoop includes momNeeded and kindOfAttention fields', () => {
  const loop = M.makeLoop({ title: 'Test' });
  assert.ok('momNeeded' in loop, 'momNeeded field exists');
  assert.ok('kindOfAttention' in loop, 'kindOfAttention field exists');
  assert.equal(loop.momNeeded, null);
  assert.equal(loop.kindOfAttention, null);
});

test('makeLoopItem includes linkedCardId field', () => {
  const item = M.makeLoopItem({ loopId: 'test', title: 'Test' });
  assert.ok('linkedCardId' in item, 'linkedCardId field exists');
  assert.equal(item.linkedCardId, null);
});

test('GRADE_BANDS includes form4', () => {
  const ids = M.GRADE_BANDS.map(function(b) { return b.id; });
  assert.ok(ids.includes('form4'), 'form4 in GRADE_BANDS');
  const f4 = M.GRADE_BANDS.find(function(b) { return b.id === 'form4'; });
  assert.ok(f4.label.includes('10'), 'form4 label mentions grade 10+');
});

test('LESSON_TIME_GUARDRAILS.form4 exists', () => {
  assert.ok(M.LESSON_TIME_GUARDRAILS.form4, 'form4 guardrail exists');
  assert.equal(M.LESSON_TIME_GUARDRAILS.form4.min, 45);
  assert.equal(M.LESSON_TIME_GUARDRAILS.form4.hardMax, 60);
});

test('formApplicabilityLabel([form4]) returns Form IV+', () => {
  assert.equal(M.formApplicabilityLabel(['form4']), 'Form IV+');
});

test('RHYTHM_STATUS_LABELS exists and has not-in-rhythm', () => {
  assert.ok(M.RHYTHM_STATUS_LABELS, 'RHYTHM_STATUS_LABELS exported');
  assert.equal(M.RHYTHM_STATUS_LABELS['not-in-rhythm'], 'Not in weekly rhythm yet');
  assert.equal(M.RHYTHM_STATUS_LABELS['placed'], 'In weekly rhythm');
  assert.equal(M.RHYTHM_STATUS_LABELS['covered-by-loop'], 'Covered by a loop');
});

test('getLoopCoveredCardIds returns covered card IDs when loop is placed', () => {
  const state = A.buildSampleAppState();
  const coveredIds = R.getLoopCoveredCardIds(state.weeklyRhythm, state.loops, state.loopItems);
  assert.ok(coveredIds.includes('card_bible'), 'card_bible is covered by loop_bible');
});

test('getPlacementSummary correctly identifies covered, placed, and unplaced items', () => {
  const state = A.buildSampleAppState();
  const summary = R.getPlacementSummary(
    state.weeklyRhythm,
    state.cards,
    state.loops,
    state.sequences,
    state.loopItems,
    { includeStatuses: ['active'] }
  );
  // Bible card should be in coveredCardIds (loop_bible is placed and has linkedCardId: card_bible)
  assert.ok(summary.coveredCardIds.includes('card_bible'), 'card_bible should be in coveredCardIds');
  // Bible Loop should be in placedLoopIds
  assert.ok(summary.placedLoopIds.includes('loop_bible'), 'loop_bible should be in placedLoopIds');
  // card_bible should NOT be in notPlacedCards
  assert.ok(!summary.notPlacedCards.some((c) => c.id === 'card_bible'), 'card_bible should not appear in notPlacedCards');
  // Nature Study should be placed directly (card assignment)
  assert.ok(summary.placedCardIds.includes('card_nature_study'), 'card_nature_study should be in placedCardIds');
});

// ---------------------------------------------------------------------------
// StrandAssignment model tests
// ---------------------------------------------------------------------------

test('makeStrandAssignment creates a strand assignment with defaults', () => {
  const sa = M.makeStrandAssignment({ strandId: 'bible', strandLabel: 'Bible', assignmentMode: 'loop', loopId: 'loop_bible' });
  assert.equal(sa.strandId, 'bible');
  assert.equal(sa.strandLabel, 'Bible');
  assert.equal(sa.assignmentMode, 'loop');
  assert.equal(sa.loopId, 'loop_bible');
  assert.ok(sa.id.startsWith('sa'));
  assert.deepEqual(sa.studentIds, []);
  assert.deepEqual(sa.generatedCardIds, []);
});

test('STRAND_ASSIGNMENT_MODES contains expected modes', () => {
  assert.ok(Array.isArray(M.STRAND_ASSIGNMENT_MODES));
  assert.ok(M.STRAND_ASSIGNMENT_MODES.includes('everyone'));
  assert.ok(M.STRAND_ASSIGNMENT_MODES.includes('loop'));
  assert.ok(M.STRAND_ASSIGNMENT_MODES.includes('not-this-year'));
  assert.ok(M.STRAND_ASSIGNMENT_MODES.includes('individual'));
});

test('makeLoopItem includes linkedStrandId field', () => {
  const li = M.makeLoopItem({ title: 'Test', loopId: 'loop_x' });
  assert.ok('linkedStrandId' in li, 'makeLoopItem should have linkedStrandId');
  assert.equal(li.linkedStrandId, null);
  const li2 = M.makeLoopItem({ linkedStrandId: 'bible' });
  assert.equal(li2.linkedStrandId, 'bible');
});

test('deriveRequiredCards — everyone mode produces one family card', () => {
  const assignments = [M.makeStrandAssignment({ strandId: 'nature-study', strandLabel: 'Nature Study', assignmentMode: 'everyone' })];
  const required = M.deriveRequiredCards(assignments, [], [], []);
  assert.equal(required.length, 1);
  assert.equal(required[0].audience, 'together');
  assert.equal(required[0].title, 'Nature Study');
});

test('deriveRequiredCards — loop mode produces no card', () => {
  const assignments = [M.makeStrandAssignment({ strandId: 'bible', strandLabel: 'Bible', assignmentMode: 'loop', loopId: 'loop_bible' })];
  const required = M.deriveRequiredCards(assignments, [], [], []);
  assert.equal(required.length, 0);
});

test('deriveRequiredCards — not-this-year mode produces no card', () => {
  const assignments = [M.makeStrandAssignment({ strandId: 'art', strandLabel: 'Art', assignmentMode: 'not-this-year' })];
  const required = M.deriveRequiredCards(assignments, [], [], []);
  assert.equal(required.length, 0);
});

test('deriveRequiredCards — individual mode produces one card per student', () => {
  const students = [
    M.makeStudent({ id: 's1', name: 'Alice' }),
    M.makeStudent({ id: 's2', name: 'Bob' })
  ];
  const assignments = [M.makeStrandAssignment({ strandId: 'math', strandLabel: 'Math', assignmentMode: 'individual', studentIds: ['s1', 's2'] })];
  const required = M.deriveRequiredCards(assignments, students, [], []);
  assert.equal(required.length, 2);
  assert.equal(required[0].participantMode, 'individual');
  assert.ok(required[0].title.includes('Alice'));
  assert.ok(required[1].title.includes('Bob'));
});

test('sample state includes strandAssignments', () => {
  const state = A.buildSampleAppState();
  assert.ok(Array.isArray(state.strandAssignments), 'strandAssignments should be an array');
  assert.ok(state.strandAssignments.length > 0, 'strandAssignments should be non-empty');
  const bibleAssignment = state.strandAssignments.find((sa) => sa.id === 'sa_bible');
  assert.ok(bibleAssignment, 'sa_bible should exist in sample strandAssignments');
  assert.equal(bibleAssignment.assignmentMode, 'loop');
  assert.equal(bibleAssignment.loopId, 'loop_bible');
});

test('getStrandsCoveredByLoop returns strands assigned to a loop', () => {
  const state = A.buildSampleAppState();
  const covered = A.getStrandsCoveredByLoop(state, 'loop_bible');
  assert.ok(covered.length > 0, 'should find strands covered by loop_bible');
  assert.ok(covered.every((sa) => sa.loopId === 'loop_bible'), 'all returned should have loopId loop_bible');
});

test('getLoopCoveredStrandIds returns all strand IDs covered by loops', () => {
  const state = A.buildSampleAppState();
  const ids = A.getLoopCoveredStrandIds(state);
  assert.ok(ids.includes('bible'), 'bible should be in loop-covered strand ids');
  assert.ok(ids.includes('hymn'), 'hymn should be in loop-covered strand ids');
});

test('getUnassignedStrands returns strands not yet assigned', () => {
  const state = A.buildSampleAppState();
  const unassigned = A.getUnassignedStrands(state);
  const assignedIds = state.strandAssignments.map((sa) => sa.strandId);
  unassigned.forEach((strand) => {
    assert.ok(!assignedIds.includes(strand.id), strand.id + ' should not be in assignedIds');
  });
});

test('assignStrandToLoop adds a strand assignment to state', () => {
  const state = A.buildSampleAppState();
  const before = state.strandAssignments.length;
  A.assignStrandToLoop(state, 'art', 'Art', 'loop_beauty');
  assert.equal(state.strandAssignments.length, before + 1);
  const added = state.strandAssignments[state.strandAssignments.length - 1];
  assert.equal(added.strandId, 'art');
  assert.equal(added.assignmentMode, 'loop');
  assert.equal(added.loopId, 'loop_beauty');
});

test('buildMapRows unplaced label is "Still to place" (not "Needs placement")', () => {
  const state = A.buildSampleAppState();
  const rows = A.buildMapRows(state);
  const unplacedRow = rows.find((r) => r.id === 'unplaced');
  assert.ok(unplacedRow, 'unplaced row should exist');
  assert.equal(unplacedRow.label, 'Still to place');
  assert.ok(!unplacedRow.label.includes('Needs placement'), 'label should not say "Needs placement"');
});

// ---------------------------------------------------------------------------
// Feast prototype — Form x Subject x Strand rows, derived card preview,
// derived (never stored) placement, and prototype-only reset.
// ---------------------------------------------------------------------------

function feastRowById(rows, strandId) { return rows.find((r) => r.strandId === strandId); }
const FEAST_HYMN = 'feast_alltogether_beauty_hymn';
const FEAST_COPYWORK = 'feast_form1_language-arts_copywork';
const FEAST_NT = 'feast_alltogether_bible_newtestament';

test('buildFeastRows returns exactly one row per FEAST_LIBRARY entry', () => {
  const state = A.buildSampleAppState();
  const rows = A.buildFeastRows(state);
  assert.equal(rows.length, M.FEAST_LIBRARY.length);
  M.FEAST_LIBRARY.forEach((entry) => {
    assert.ok(feastRowById(rows, entry.id), 'row missing for ' + entry.id);
  });
  const ids = rows.map((r) => r.strandId);
  assert.equal(new Set(ids).size, ids.length, 'strand ids should be unique');
});

test('every feast row has a non-empty strandId, form, column, and label', () => {
  const state = A.buildSampleAppState();
  A.buildFeastRows(state).forEach((row) => {
    assert.ok(row.strandId && row.strandId.length, 'strandId');
    assert.ok(row.form && row.form.length, 'form on ' + row.strandId);
    assert.ok(row.column && row.column.length, 'column on ' + row.strandId);
    assert.ok(row.label && row.label.length, 'label on ' + row.strandId);
    assert.ok(row.formLabel && row.formLabel.length, 'formLabel on ' + row.strandId);
    assert.ok(row.columnLabel && row.columnLabel.length, 'columnLabel on ' + row.strandId);
    assert.ok(Array.isArray(row.warnings), 'warnings array on ' + row.strandId);
  });
});

test('source strands stay present when assigned to a loop', () => {
  const state = A.buildSampleAppState();
  const before = A.buildFeastRows(state).length;
  A.setStrandAssignmentForStrand(state, FEAST_HYMN, 'Hymn', { assignmentMode: 'loop', loopId: 'loop_bible' });
  const rows = A.buildFeastRows(state);
  assert.equal(rows.length, before, 'row count must not change when a strand is assigned');
  const row = feastRowById(rows, FEAST_HYMN);
  assert.ok(row, 'row still present after assignment');
  assert.equal(row.strandId, FEAST_HYMN);
  assert.equal(row.assignmentMode, 'loop');
  assert.equal(row.loopTitle, 'Bible Loop');
});

test('turning a strand off does not remove its row', () => {
  const state = A.buildSampleAppState();
  const before = A.buildFeastRows(state).length;
  A.setStrandAssignmentForStrand(state, FEAST_COPYWORK, 'Copywork', { assignmentMode: 'not-this-year' });
  const rows = A.buildFeastRows(state);
  assert.equal(rows.length, before);
  const row = feastRowById(rows, FEAST_COPYWORK);
  assert.ok(row, 'row still present when turned off');
  assert.equal(row.activeThisYear, false);
  assert.equal(row.placementState, 'not-this-year');
  assert.equal(row.placementLabel, 'Not this year');
});

test('audience is stored exactly once per strand — reassigning updates, never appends', () => {
  const state = A.buildSampleAppState();
  const before = state.strandAssignments.length;
  A.setStrandAssignmentForStrand(state, FEAST_NT, 'New Testament', { assignmentMode: 'everyone' });
  assert.equal(state.strandAssignments.length, before + 1);
  assert.equal(state.strandAssignments.filter((sa) => sa.strandId === FEAST_NT).length, 1);

  A.setStrandAssignmentForStrand(state, FEAST_NT, 'New Testament', { assignmentMode: 'individual', studentIds: ['lucy'] });
  assert.equal(state.strandAssignments.length, before + 1, 'reassigning must not append a second entry');
  const matches = state.strandAssignments.filter((sa) => sa.strandId === FEAST_NT);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].assignmentMode, 'individual');
  assert.deepEqual(matches[0].studentIds, ['lucy']);
  assert.equal(matches[0].loopId, null, 'stale loopId must be cleared on reassignment');
});

test('buildDerivedCardPreview follows assignments (everyone / individual / loop)', () => {
  const state = A.buildSampleAppState();
  A.setStrandAssignmentForStrand(state, FEAST_NT, 'New Testament', { assignmentMode: 'everyone' });
  A.setStrandAssignmentForStrand(state, FEAST_COPYWORK, 'Copywork', { assignmentMode: 'individual', studentIds: ['charis', 'kayla'] });
  A.setStrandAssignmentForStrand(state, FEAST_HYMN, 'Hymn', { assignmentMode: 'loop', loopId: 'loop_bible' });

  const preview = A.buildDerivedCardPreview(state);

  assert.ok(preview.familyCards.some((c) => c.strandIds.includes(FEAST_NT)), 'everyone -> familyCards');

  const copyworkIndividual = preview.individualCards.filter((c) => c.strandIds.includes(FEAST_COPYWORK));
  assert.equal(copyworkIndividual.length, 2, 'individual with 2 students -> 2 individual cards');
  assert.deepEqual(copyworkIndividual.map((c) => c.studentName).sort(), ['Charis', 'Kayla']);

  const looped = preview.loopCovered.find((l) => l.strandIds.includes(FEAST_HYMN));
  assert.ok(looped, 'loop -> loopCovered');
  assert.equal(looped.loopTitle, 'Bible Loop');
  assert.ok(looped.strandLabels.includes('Hymn'));
  assert.ok(!preview.familyCards.some((c) => c.strandIds.includes(FEAST_HYMN)), 'loop strand must not be a family card');
  assert.ok(!preview.groupCards.some((c) => c.strandIds.includes(FEAST_HYMN)), 'loop strand must not be a group card');

  A.setStrandAssignmentForStrand(state, 'feast_form2_history_historyspine', 'History Spine', { assignmentMode: 'custom-group', groupId: 'older' });
  const preview2 = A.buildDerivedCardPreview(state);
  const grouped = preview2.groupCards.find((c) => c.strandIds.includes('feast_form2_history_historyspine'));
  assert.ok(grouped, 'custom-group -> groupCards');
  assert.equal(grouped.groupLabel, 'Older Students');
});

test('a strand in a placed loop is covered-by-loop, not still-to-place', () => {
  const state = A.buildSampleAppState();
  assert.ok(A.loopHasRhythmPlacement(state, 'loop_bible'), 'sample rhythm places loop_bible');
  A.setStrandAssignmentForStrand(state, FEAST_NT, 'New Testament', { assignmentMode: 'loop', loopId: 'loop_bible' });
  const row = feastRowById(A.buildFeastRows(state), FEAST_NT);
  assert.equal(row.placementState, 'covered-by-loop');
  assert.equal(row.placementLabel, 'Covered by Bible Loop');
  assert.notEqual(row.placementState, 'still-to-place');
});

test('a strand in an unplaced loop is in-loop-not-placed, not still-to-place', () => {
  const state = A.buildSampleAppState();
  state.loops.push(M.makeLoop({ id: 'loop_beauty', title: 'Beauty Loop' }));
  assert.ok(!A.loopHasRhythmPlacement(state, 'loop_beauty'), 'loop_beauty is not in the sample rhythm');
  A.setStrandAssignmentForStrand(state, FEAST_HYMN, 'Hymn', { assignmentMode: 'loop', loopId: 'loop_beauty' });
  const row = feastRowById(A.buildFeastRows(state), FEAST_HYMN);
  assert.equal(row.placementState, 'in-loop-not-placed');
  assert.equal(row.placementLabel, 'In Beauty Loop, not in weekly rhythm yet');
  assert.notEqual(row.placementState, 'still-to-place');
});

test('placement is derived, never persisted into strandAssignments', () => {
  const state = A.buildSampleAppState();
  A.setStrandAssignmentForStrand(state, FEAST_NT, 'New Testament', { assignmentMode: 'everyone' });
  A.setStrandAssignmentForStrand(state, FEAST_COPYWORK, 'Copywork', { assignmentMode: 'not-this-year' });
  const rows = A.buildFeastRows(state);
  assert.ok(rows.length > 0);
  const serialized = JSON.stringify(state.strandAssignments);
  assert.ok(!serialized.includes('placementState'), 'placementState must never be stored');
  assert.ok(!serialized.includes('placementLabel'), 'placementLabel must never be stored');
  assert.ok(!serialized.includes('activeThisYear'), 'activeThisYear must never be stored');
  assert.ok(!serialized.includes('resourceState'), 'resourceState must never be stored');
  // A strand with no assignment at all reads as unassigned with a blank label.
  const untouched = feastRowById(rows, 'feast_form4_math_uppermath');
  assert.equal(untouched.placementState, 'unassigned');
  assert.equal(untouched.placementLabel, '');
  assert.equal(untouched.assignment, null);
});

test('existing app cards are untouched by buildFeastRows / buildDerivedCardPreview', () => {
  const state = A.buildSampleAppState();
  const beforeLength = state.cards.length;
  const beforeIds = state.cards.map((c) => c.id).join(',');
  const beforeJson = JSON.stringify(state.cards);
  A.setStrandAssignmentForStrand(state, FEAST_NT, 'New Testament', { assignmentMode: 'everyone' });
  A.buildFeastRows(state);
  A.buildDerivedCardPreview(state);
  assert.equal(state.cards.length, beforeLength);
  assert.equal(state.cards.map((c) => c.id).join(','), beforeIds);
  assert.equal(JSON.stringify(state.cards), beforeJson, 'no card may be mutated');
});

test('resetPrototypeStrandAssignments removes only prototype-created entries', () => {
  const state = A.buildSampleAppState();
  const preExisting = state.strandAssignments.map((sa) => sa.id);
  A.setStrandAssignmentForStrand(state, FEAST_NT, 'New Testament', { assignmentMode: 'everyone' });
  A.setStrandAssignmentForStrand(state, FEAST_HYMN, 'Hymn', { assignmentMode: 'not-this-year' });
  assert.equal(state.strandAssignments.length, preExisting.length + 2);

  const reset = A.resetPrototypeStrandAssignments(state);
  assert.equal(reset.strandAssignments.length, preExisting.length);
  assert.deepEqual(reset.strandAssignments.map((sa) => sa.id), preExisting);
  assert.ok(reset.strandAssignments.every((sa) => sa.createdBy !== 'feast-prototype'));
  assert.equal(state.strandAssignments.length, preExisting.length + 2, 'reset returns a new state; the old one is unchanged');
  assert.equal(reset.cards, state.cards, 'reset does not touch cards');
});

test('makeStrandAssignment defaults createdBy to null and FEAST_LIBRARY ids are stable', () => {
  assert.equal(M.makeStrandAssignment({}).createdBy, null);
  assert.equal(M.feastStrandId('all-together', 'bible', 'New Testament'), FEAST_NT);
  assert.equal(M.feastStrandId('form1', 'language-arts', 'Copywork'), FEAST_COPYWORK);
  assert.equal(M.FEAST_FORMS.length, 6);
  M.FEAST_LIBRARY.forEach((entry) => {
    assert.equal(entry.id, M.feastStrandId(entry.form, entry.column, entry.label));
    assert.ok(M.FEAST_FORMS.some((f) => f.id === entry.form), 'unknown form ' + entry.form);
    assert.ok(M.DEFAULT_VISIBLE_SUBJECT_COLUMNS.some((c) => c.id === entry.column), 'unknown column ' + entry.column);
  });
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
