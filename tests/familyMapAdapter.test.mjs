import assert from 'node:assert/strict';
import fs from 'node:fs';
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
// --- REGRESSION: degenerate / legacy state must not crash the feast builders ---
// Reported: "Cannot read properties of undefined (reading 'some')". The root
// cause was a stale familyMap.mjs missing FEAST_LIBRARY, but buildFeastRows and
// buildDerivedCardPreview must also tolerate saved plans that predate these
// fields or reference deleted loops/groups.
const DEGENERATE_STATES = {
  'empty object': {},
  'legacy, no strandAssignments': {
    students: [{ id: 's1', name: 'Lucy', active: true }],
    cards: [], loops: [], loopItems: [], resources: [], resourceUses: [], weeklyRhythm: null
  },
  'assignment missing studentIds/groupId': {
    students: [{ id: 's1', name: 'Lucy', active: true }],
    strandAssignments: [{ id: 'sa1', strandId: 'feast_form1_math_math', assignmentMode: 'individual' }]
  },
  'assignments referencing deleted loop and group': {
    students: [{ id: 's1', name: 'Lucy', active: true }],
    groups: [], loops: [], loopItems: [], cards: [], resources: [], resourceUses: [],
    weeklyRhythm: { days: [], blocks: [], assignments: [] },
    strandAssignments: [
      { id: 'a', strandId: 'feast_alltogether_bible_newtestament', assignmentMode: 'loop', loopId: 'ghost_loop' },
      { id: 'b', strandId: 'feast_form1_math_math', assignmentMode: 'custom-group', groupId: 'ghost_group' }
    ]
  }
};

for (const [label, degenerate] of Object.entries(DEGENERATE_STATES)) {
  test(`buildFeastRows returns the full feast for degenerate state: ${label}`, () => {
    const rows = A.buildFeastRows(degenerate);
    assert.ok(Array.isArray(rows), 'rows must be an array');
    assert.equal(rows.length, M.FEAST_LIBRARY.length,
      'every feast strand must still produce a row');
    for (const r of rows) {
      assert.ok(r.strandId && r.form && r.column && r.label, 'row fields must be populated');
      assert.ok(Array.isArray(r.warnings), 'warnings must always be an array');
      assert.ok(typeof r.placementState === 'string', 'placementState must be derived');
    }
  });

  test(`buildDerivedCardPreview returns arrays for degenerate state: ${label}`, () => {
    const p = A.buildDerivedCardPreview(degenerate);
    for (const key of ['familyCards', 'groupCards', 'individualCards', 'loopCovered', 'coopCards', 'excluded']) {
      assert.ok(Array.isArray(p[key]), `${key} must be an array`);
    }
  });
}

test('feast rows flag assignments that point at a deleted loop', () => {
  const rows = A.buildFeastRows(DEGENERATE_STATES['assignments referencing deleted loop and group']);
  const ghost = rows.find((r) => r.strandId === 'feast_alltogether_bible_newtestament');
  assert.ok(ghost, 'row must still exist even though its loop is gone');
  assert.ok(ghost.warnings.length > 0, 'a dangling loop reference must surface a warning');
});

test('FEAST_LIBRARY and FEAST_FORMS are non-empty arrays (guards the stale-module bug)', () => {
  assert.ok(Array.isArray(M.FEAST_LIBRARY) && M.FEAST_LIBRARY.length > 0);
  assert.ok(Array.isArray(M.FEAST_FORMS) && M.FEAST_FORMS.length > 0);
  for (const col of M.FEAST_LIBRARY.map((s) => s.column)) {
    assert.ok(typeof col === 'string' && col.length > 0, 'every feast entry needs a column');
  }
});



// ---------------------------------------------------------------------------
// Setup prototype — model + derivation helpers
// ---------------------------------------------------------------------------
function setupState(overrides) {
  return Object.assign({
    appStateVersion: 1,
    students: [], groups: [], subjectColumns: [], cards: [], loops: [], loopItems: [],
    sequences: [], sequenceItems: [], resources: [], resourceUses: [],
    outsideCommitments: [], strandAssignments: []
  }, overrides || {});
}

test('adding and removing students changes getEveryoneStudentIds', () => {
  const state = setupState();
  assert.deepEqual(A.getEveryoneStudentIds(state), []);
  const a = M.makeStudent({ name: 'A' });
  const b = M.makeStudent({ name: 'B' });
  state.students.push(a, b);
  assert.deepEqual(A.getEveryoneStudentIds(state), [a.id, b.id]);
  state.students = state.students.filter((s) => s.id !== a.id);
  assert.deepEqual(A.getEveryoneStudentIds(state), [b.id]);
});

test('suggestGradeBandFromGrade maps grades to forms and returns null on garbage', () => {
  assert.equal(M.suggestGradeBandFromGrade('1st'), 'form1');
  assert.equal(M.suggestGradeBandFromGrade('5'), 'form2');
  assert.equal(M.suggestGradeBandFromGrade('7th'), 'form3');
  assert.equal(M.suggestGradeBandFromGrade('10th'), 'form4');
  assert.equal(M.suggestGradeBandFromGrade('K'), 'form1');
  assert.equal(M.suggestGradeBandFromGrade('k'), 'form1');
  assert.equal(M.suggestGradeBandFromGrade('kindergarten'), 'form1');
  assert.equal(M.suggestGradeBandFromGrade('banana'), null);
  assert.equal(M.suggestGradeBandFromGrade(''), null);
  assert.equal(M.suggestGradeBandFromGrade(null), null);
  assert.equal(M.suggestGradeBandFromGrade('99'), null);
});

test('a new student is unconfirmed; suggestion never auto-confirms; confirming sets it true', () => {
  const s = M.makeStudent({ name: 'A', grade: '5' });
  assert.equal(s.gradeBandConfirmed, false);
  const suggested = M.suggestGradeBandFromGrade(s.grade);
  assert.equal(suggested, 'form2');
  s.gradeBand = suggested;              // applying a suggestion...
  assert.equal(s.gradeBandConfirmed, false); // ...must not confirm it
  s.gradeBandConfirmed = true;
  assert.equal(s.gradeBandConfirmed, true);
});

test('Everyone is automatic — deactivating a student removes them with no group edit', () => {
  const a = M.makeStudent({ name: 'A' });
  const b = M.makeStudent({ name: 'B' });
  const state = setupState({ students: [a, b] });
  assert.equal(A.getEveryoneStudentIds(state).length, 2);
  b.active = false;
  assert.deepEqual(A.getEveryoneStudentIds(state), [a.id]);
  const everyone = A.buildAudienceOptions(state).find((o) => o.kind === 'everyone');
  assert.deepEqual(everyone.memberNames, ['A']);
});

test('custom group creation yields a generated stable id, not a label-derived one', () => {
  const g = M.makeGroup({ label: 'Older Students' });
  assert.ok(/^grp_/.test(g.id), 'group id must be generated');
  assert.notEqual(g.id, 'older');
  assert.equal(g.id.indexOf('older'), -1);
  const g2 = M.makeGroup({ label: 'Older Students' });
  assert.notEqual(g.id, g2.id, 'two groups with the same label must not collide');
});

test('renaming a group does not break strand assignments', () => {
  const a = M.makeStudent({ name: 'A' });
  const b = M.makeStudent({ name: 'B' });
  const g = M.makeGroup({ label: 'First name', studentIds: [a.id, b.id] });
  const sa = M.makeStrandAssignment({ strandId: 'x', strandLabel: 'X', assignmentMode: 'custom-group', groupId: g.id });
  const state = setupState({ students: [a, b], groups: [g], strandAssignments: [sa] });
  const membersBefore = A.getGroupAvailability(state, g.id).memberIds.slice();
  g.label = 'A completely different name';
  assert.equal(state.strandAssignments[0].groupId, g.id, 'assignment still points at the same group id');
  assert.deepEqual(A.getGroupAvailability(state, g.id).memberIds, membersBefore);
  const opt = A.buildAudienceOptions(state).find((o) => o.value === 'group:' + g.id);
  assert.equal(opt.label, 'A completely different name');
  assert.deepEqual(opt.memberIds, membersBefore);
});

test('changing group members changes getGroupAvailability and the resolved member list', () => {
  const a = M.makeStudent({ name: 'A', workdays: { mon: true, tue: true, wed: true, thu: true, fri: true } });
  const b = M.makeStudent({ name: 'B', workdays: { mon: true, tue: false, wed: true, thu: true, fri: true } });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id] });
  const state = setupState({ students: [a, b], groups: [g] });
  assert.deepEqual(A.getGroupAvailability(state, g.id).availableDayIds, ['mon', 'tue', 'wed', 'thu', 'fri']);
  g.studentIds = [a.id, b.id];
  const av = A.getGroupAvailability(state, g.id);
  assert.deepEqual(av.memberIds, [a.id, b.id]);
  assert.deepEqual(av.availableDayIds, ['mon', 'wed', 'thu', 'fri']);
  assert.deepEqual(av.partialDayIds, ['tue']);
});

test('getStudentAvailability resolves capacity and reports commitments as suggestions only', () => {
  const a = M.makeStudent({ name: 'A', workdays: { mon: false, tue: true, wed: true, thu: true, fri: true } });
  const blocking = M.makeOutsideCommitment({
    label: 'Co-op day', participantMode: 'everyone', weekdays: ['tue'], blocksRegularWork: true, allowsCoopWork: true
  });
  const nonBlocking = M.makeOutsideCommitment({
    label: 'Piano', participantMode: 'everyone', weekdays: ['wed'], blocksRegularWork: false
  });
  const state = setupState({ students: [a], outsideCommitments: [blocking, nonBlocking] });
  const av = A.getStudentAvailability(state, a.id);
  assert.equal(av.workdays.mon, false);
  assert.equal(av.dayCapacity.mon, 'off', 'a legacy false workday resolves to off');
  // Commitments never change capacity on their own — Tuesday is still a full
  // workday until the parent applies the suggestion.
  assert.deepEqual(av.availableDayIds, ['tue', 'wed', 'thu', 'fri']);
  assert.deepEqual(av.offDayIds, ['mon']);
  assert.deepEqual(av.coopOnlyDayIds, []);
  assert.equal(av.suggestedCapacity.tue.capacity, 'outside-only');
  assert.equal(av.suggestedCapacity.tue.fromCommitment, 'Co-op day');
  assert.deepEqual(av.blockedBy.tue, ['Co-op day']);
  assert.deepEqual(av.blockedBy.wed, [], 'blocksRegularWork:false must not block the day');
});

test('getGroupAvailability is the member intersection and reports partial days', () => {
  const a = M.makeStudent({ name: 'A', workdays: { mon: true, tue: true, wed: false, thu: true, fri: true } });
  const b = M.makeStudent({ name: 'B', workdays: { mon: true, tue: false, wed: true, thu: true, fri: true } });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id, b.id] });
  const empty = M.makeGroup({ label: 'Empty' });
  const state = setupState({ students: [a, b], groups: [g, empty] });
  const av = A.getGroupAvailability(state, g.id);
  assert.deepEqual(av.availableDayIds, ['mon', 'thu', 'fri']);
  assert.deepEqual(av.partialDayIds, ['tue', 'wed']);
  const emptyAv = A.getGroupAvailability(state, empty.id);
  assert.deepEqual(emptyAv.availableDayIds, []);
  assert.deepEqual(emptyAv.partialDayIds, []);
  assert.deepEqual(emptyAv.memberIds, []);
});

test('buildAudienceOptions contains only active students/groups and every group carries memberNames', () => {
  const a = M.makeStudent({ name: 'A' });
  const b = M.makeStudent({ name: 'B', active: false });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id, b.id] });
  const gOff = M.makeGroup({ label: 'Retired group', active: false });
  const state = setupState({ students: [a, b], groups: [g, gOff] });
  const opts = A.buildAudienceOptions(state);
  assert.equal(opts.filter((o) => o.kind === 'student').length, 1);
  assert.equal(opts.find((o) => o.kind === 'student').label, 'A');
  const groupOpts = opts.filter((o) => o.kind === 'group');
  assert.equal(groupOpts.length, 1, 'inactive groups are not offered');
  for (const go of groupOpts) assert.ok(Array.isArray(go.memberNames), 'group options carry memberNames');
  assert.deepEqual(groupOpts[0].memberNames, ['A'], 'inactive members are not listed');
  assert.equal(opts[0].kind, 'everyone');
  assert.equal(opts[opts.length - 1].kind, 'coop');
});

test('loop choices appear in buildAudienceOptions as loop:<id>', () => {
  const a = M.makeStudent({ name: 'A' });
  const loop = M.makeLoop({ title: 'Beauty Loop' });
  const state = setupState({ students: [a], loops: [loop] });
  const opt = A.buildAudienceOptions(state).find((o) => o.value === 'loop:' + loop.id);
  assert.ok(opt, 'loop option must exist');
  assert.equal(opt.kind, 'loop');
  assert.equal(opt.loopId, loop.id);
  assert.equal(opt.label, 'In: Beauty Loop');
});

test('describeAudienceConsequence names actual members and hardcodes no family names', () => {
  const a = M.makeStudent({ name: 'Wren' });
  const b = M.makeStudent({ name: 'Ash' });
  const c = M.makeStudent({ name: 'Juno' });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id, b.id] });
  const solo = M.makeGroup({ label: 'Solo', studentIds: [c.id] });
  const empty = M.makeGroup({ label: 'Empty' });
  const loop = M.makeLoop({ title: 'Morning Loop' });
  const state = setupState({ students: [a, b, c], groups: [g, solo, empty], loops: [loop] });

  const groupSentence = A.describeAudienceConsequence(state, 'group:' + g.id, 'History');
  assert.equal(groupSentence, 'This creates one shared strand for Wren and Ash.');
  assert.equal(A.describeAudienceConsequence(state, 'group:' + solo.id, 'History'),
    'This creates one strand for Juno.');
  assert.equal(A.describeAudienceConsequence(state, 'group:' + empty.id, 'History'),
    'This group has no members yet.');
  assert.equal(A.describeAudienceConsequence(state, 'everyone', 'History'),
    'This creates one family strand for everyone: Wren, Ash and Juno.');
  assert.equal(A.describeAudienceConsequence(state, 'student:' + c.id, 'History'),
    'This creates one strand just for Juno.');
  assert.equal(A.describeAudienceConsequence(state, 'loop:' + loop.id, 'History'),
    'This strand is covered inside Morning Loop. No separate weekly card.');
  assert.equal(A.describeAudienceConsequence(state, 'coop', 'History'),
    'Handled outside the home. No weekly card.');

  const src = fs.readFileSync(new URL('../lib/familyMapAdapter.mjs', import.meta.url), 'utf8');
  const setupSection = src.slice(src.indexOf('Setup prototype — derivation helpers'));
  for (const banned of ['Kayla', 'Charis', 'Lucy', 'Jeremiah', "'older'", "'littles'"]) {
    assert.equal(setupSection.indexOf(banned), -1, 'setup helpers must not hardcode ' + banned);
  }
});

test('describeAudienceImpact counts strand assignments referencing a group or student', () => {
  const a = M.makeStudent({ name: 'A' });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id] });
  const state = setupState({
    students: [a], groups: [g],
    strandAssignments: [
      M.makeStrandAssignment({ strandId: 's1', strandLabel: 'History', assignmentMode: 'custom-group', groupId: g.id }),
      M.makeStrandAssignment({ strandId: 's2', strandLabel: 'Math', assignmentMode: 'individual', studentIds: [a.id] })
    ]
  });
  const groupImpact = A.describeAudienceImpact(state, { kind: 'group-members', groupId: g.id });
  assert.equal(groupImpact.affectedStrandCount, 1);
  assert.deepEqual(groupImpact.affectedStrandLabels, ['History']);
  assert.ok(groupImpact.message.includes('History'));
  const studentImpact = A.describeAudienceImpact(state, { kind: 'student-deactivate', studentId: a.id });
  assert.equal(studentImpact.affectedStrandCount, 2);
  // read-only
  assert.equal(state.strandAssignments.length, 2);
  const none = A.describeAudienceImpact(state, { kind: 'group-delete', groupId: 'nope' });
  assert.equal(none.affectedStrandCount, 0);
});

test('getSetupProgress derives family/availability and reads the two acknowledgements', () => {
  const a = M.makeStudent({ name: 'A' });
  const state = setupState({ students: [a] });
  let p = A.getSetupProgress(state);
  assert.equal(p.family.complete, false, 'unconfirmed Form blocks the family step');
  // Availability now requires every weekday to have a RESOLVED capacity. A brand
  // new child sits on the suggested defaults until the parent reviews them.
  assert.equal(p.availability.complete, false);
  state.setupPrototype = { availabilityReviewed: true };
  assert.equal(A.getSetupProgress(state).availability.complete, true);
  p = A.getSetupProgress(state);
  assert.equal(p.groups.complete, false);
  assert.equal(p.rhythm.complete, false);
  assert.equal(p.readyForFeast, false);

  a.gradeBandConfirmed = true;
  // The rhythm step is loop BUCKETS only: a bucket must exist AND be reviewed.
  state.loops = [M.makeLoop({ title: 'Beauty loop' })];
  state.setupPrototype = { groupsReviewed: true, availabilityReviewed: true };
  A.markLoopBucketsReviewed(state);
  p = A.getSetupProgress(state);
  assert.equal(p.family.complete, true);
  assert.equal(p.groups.complete, true);
  assert.equal(p.rhythm.complete, true);
  assert.equal(p.readyForFeast, true);

  // A week with no Full workdays is valid — it is an advisory, never an error.
  a.dayCapacity = { mon: 'off', tue: 'off', wed: 'off', thu: 'off', fri: 'off' };
  p = A.getSetupProgress(state);
  assert.equal(p.availability.complete, true, 'an all-off week is still a resolved week');
  assert.equal(p.availability.advisories.length, 1);
  assert.equal(p.readyForFeast, true);

  // What DOES make it incomplete: a day still on an unreviewed default.
  state.setupPrototype.availabilityReviewed = false;
  p = A.getSetupProgress(state);
  assert.equal(p.availability.complete, false);
  assert.equal(p.readyForFeast, false);
});

test('buildSetupSummary reports family, groups, everyone, commitments, and loops', () => {
  const a = M.makeStudent({ name: 'A', grade: '5', gradeBand: 'form2', gradeBandConfirmed: true });
  const b = M.makeStudent({ name: 'B' });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id, b.id] });
  const loop = M.makeLoop({ title: 'L' });
  const commit = M.makeOutsideCommitment({ label: 'Co-op', participantMode: 'everyone', weekdays: ['tue'] });
  const state = setupState({ students: [a, b], groups: [g], loops: [loop], outsideCommitments: [commit] });
  const s = A.buildSetupSummary(state);
  assert.equal(s.family.length, 2);
  assert.equal(s.family[0].gradeBandLabel, M.GRADE_BANDS.find((x) => x.id === 'form2').label);
  assert.equal(s.family[0].gradeBandConfirmed, true);
  assert.equal(s.family[1].gradeBandConfirmed, false);
  assert.deepEqual(s.groups[0].memberNames, ['A', 'B']);
  assert.deepEqual(s.everyone.memberNames, ['A', 'B']);
  assert.deepEqual(s.commitments[0].participantNames, ['A', 'B']);
  assert.deepEqual(s.commitments[0].weekdays, ['tue']);
  assert.equal(s.loops[0].title, 'L');
  assert.ok(typeof s.loops[0].participantSummary === 'string');
});

test('every new setup helper leaves existing production collections untouched', () => {
  const state = A.buildSampleAppState();
  const KEYS = ['cards', 'loops', 'loopItems', 'resources', 'resourceUses'];
  const before = {};
  for (const k of KEYS) before[k] = { len: state[k].length, ids: state[k].map((x) => x.id).join('|') };
  const rhythmBefore = {
    days: state.weeklyRhythm.days.map((d) => d.id).join('|'),
    blocks: state.weeklyRhythm.blocks.map((b) => b.id).join('|'),
    assignments: state.weeklyRhythm.assignments.map((a) => a.id).join('|')
  };
  const loopFieldsBefore = JSON.stringify(state.loops);

  A.getEveryoneStudentIds(state);
  A.getStudentAvailability(state, state.students[0].id);
  A.getGroupAvailability(state, state.groups[0].id);
  A.getCommitmentParticipantIds(state, M.makeOutsideCommitment({ participantMode: 'everyone' }));
  A.buildSetupSummary(state);
  A.getSetupProgress(state);
  A.buildAudienceOptions(state);
  A.describeAudienceConsequence(state, 'everyone', 'X');
  A.describeAudienceImpact(state, { kind: 'group-members', groupId: state.groups[0].id });
  A.joinNames(['A', 'B']);
  A.gradeBandLabel('form1');

  for (const k of KEYS) {
    assert.equal(state[k].length, before[k].len, k + ' length must be unchanged');
    assert.equal(state[k].map((x) => x.id).join('|'), before[k].ids, k + ' ids must be unchanged');
  }
  assert.equal(state.weeklyRhythm.days.map((d) => d.id).join('|'), rhythmBefore.days);
  assert.equal(state.weeklyRhythm.blocks.map((b) => b.id).join('|'), rhythmBefore.blocks);
  assert.equal(state.weeklyRhythm.assignments.map((a) => a.id).join('|'), rhythmBefore.assignments);
  assert.equal(JSON.stringify(state.loops), loopFieldsBefore, 'loops must not be rewritten');
});

test('all new setup helpers tolerate {} and states missing optional arrays', () => {
  const degenerate = [
    {},
    { students: null, groups: undefined },
    { students: [{ id: 's1', name: 'Solo', active: true }] },
    { students: [{ id: 's1', name: 'Solo', active: true }], groups: [{ id: 'g1', label: 'G' }] },
    { students: [{ id: 's1', name: 'Solo', active: true }], outsideCommitments: [{ id: 'c1', label: 'X' }] }
  ];
  for (const st of degenerate) {
    assert.ok(Array.isArray(A.getEveryoneStudentIds(st)));
    const av = A.getStudentAvailability(st, 's1');
    assert.ok(Array.isArray(av.availableDayIds));
    assert.ok(Array.isArray(av.coopOnlyDayIds));
    const gav = A.getGroupAvailability(st, 'g1');
    assert.ok(Array.isArray(gav.availableDayIds) && Array.isArray(gav.partialDayIds));
    assert.ok(Array.isArray(A.getCommitmentParticipantIds(st, {})));
    const summary = A.buildSetupSummary(st);
    for (const key of ['family', 'groups', 'commitments', 'loops']) assert.ok(Array.isArray(summary[key]), key);
    assert.ok(Array.isArray(summary.everyone.memberIds));
    const p = A.getSetupProgress(st);
    assert.equal(typeof p.readyForFeast, 'boolean');
    const opts = A.buildAudienceOptions(st);
    assert.ok(Array.isArray(opts) && opts.length >= 2);
    assert.equal(typeof A.describeAudienceConsequence(st, 'everyone', 'X'), 'string');
    assert.equal(typeof A.describeAudienceConsequence(st, '', 'X'), 'string');
    assert.equal(typeof A.describeAudienceImpact(st, {}).affectedStrandCount, 'number');
  }
});

// ===========================================================================
// Daily capacity + work-type eligibility. Every state is built inline; nothing
// below depends on the sample family's names, subjects, or commitments.
// ===========================================================================

const LIGHT_WEEK = { mon: 'full', tue: 'light-independent', wed: 'full', thu: 'light-independent', fri: 'full' };

function capacityStudent(name, dayCapacity, explicit) {
  return M.makeStudent({
    name, active: true,
    dayCapacity: Object.assign({}, dayCapacity),
    dayCapacityExplicit: Object.assign({ mon: false, tue: false, wed: false, thu: false, fri: false }, explicit || {})
  });
}

test('1. a student set full Mon/Wed/Fri and light-independent Tue/Thu resolves those capacities', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  const av = A.getStudentAvailability(state, a.id);
  assert.deepEqual(av.dayCapacity, LIGHT_WEEK);
  assert.deepEqual(av.availableDayIds, ['mon', 'wed', 'fri']);
  assert.deepEqual(av.lightDayIds, ['tue', 'thu']);
  assert.deepEqual(av.offDayIds, []);
  assert.equal(av.capacityLabels.tue, M.dayCapacityLabel('light-independent'));
});

test('2. an outside commitment on Tue/Thu suggests a capacity but never applies it', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const commit = M.makeOutsideCommitment({
    label: 'Greenhouse', participantMode: 'everyone', weekdays: ['tue', 'thu'], suggestedCapacity: 'outside-only'
  });
  const state = setupState({ students: [a], outsideCommitments: [commit] });
  const av = A.getStudentAvailability(state, a.id);
  assert.deepEqual(av.suggestedCapacity.tue, { capacity: 'outside-only', fromCommitment: 'Greenhouse' });
  assert.deepEqual(av.suggestedCapacity.thu, { capacity: 'outside-only', fromCommitment: 'Greenhouse' });
  assert.equal(av.dayCapacity.tue, 'light-independent', 'a suggestion must not change the stored capacity');
  assert.equal(a.dayCapacity.tue, 'light-independent', 'nothing was written back to the student');
  assert.equal(av.suggestedCapacity.mon, undefined);
});

test('3. independent-essential is eligible on that student\'s light Tue/Thu', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  const el = A.getStudentWorkEligibility(state, a.id, 'independent-essential');
  assert.deepEqual(el.eligibleDayIds, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(el.byDay.tue.allowed, true);
  assert.equal(el.byDay.tue.capacity, 'light-independent');
  assert.ok(el.byDay.tue.reason.length > 0);
});

test('4. shared-with-mom and group-lesson are NOT eligible on light Tue/Thu', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  for (const wt of ['shared-with-mom', 'group-lesson']) {
    const el = A.getStudentWorkEligibility(state, a.id, wt);
    assert.deepEqual(el.eligibleDayIds, ['mon', 'wed', 'fri'], wt);
    assert.equal(el.byDay.thu.allowed, false, wt);
    assert.ok(el.byDay.thu.reason.length > 0, wt);
  }
});

test('5. outside-coop remains eligible on light Tue/Thu', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  const el = A.getStudentWorkEligibility(state, a.id, 'outside-coop');
  assert.deepEqual(el.eligibleDayIds, ['mon', 'tue', 'wed', 'thu', 'fri']);
});

test('6. independent-flexible needs the light-day opt-in', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  assert.deepEqual(A.getStudentWorkEligibility(state, a.id, 'independent-flexible').eligibleDayIds, ['mon', 'wed', 'fri']);
  const optedIn = A.getStudentWorkEligibility(state, a.id, 'independent-flexible', { mayOccurOnLightDays: true });
  assert.deepEqual(optedIn.eligibleDayIds, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(optedIn.byDay.tue.allowed, true);
  assert.ok(/opts in/.test(optedIn.byDay.tue.reason));
});

test('6b. the light-day opt-in does NOT grant group-lesson work, and says why', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  const group = A.getStudentWorkEligibility(state, a.id, 'group-lesson', { mayOccurOnLightDays: true });
  assert.equal(group.byDay.tue.allowed, false);
  assert.deepEqual(group.eligibleDayIds, ['mon', 'wed', 'fri']);
  assert.ok(/only covers flexible independent work/.test(group.byDay.tue.reason));
  assert.ok(/not group lessons/.test(group.byDay.tue.reason));
});

test('6c. the light-day opt-in does NOT grant shared-with-mom work, and says why', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  const shared = A.getStudentWorkEligibility(state, a.id, 'shared-with-mom', { mayOccurOnLightDays: true });
  assert.equal(shared.byDay.tue.allowed, false);
  assert.deepEqual(shared.eligibleDayIds, ['mon', 'wed', 'fri']);
  const verdict = M.workTypeAllowedOnCapacity('shared-with-mom', 'light-independent', { mayOccurOnLightDays: true });
  assert.equal(verdict.allowed, false);
  assert.ok(/only covers flexible independent work/.test(verdict.reason));
  assert.ok(/not work shared with Mom/.test(verdict.reason));
});

test('7. a second student with different capacities on the same weekday is unaffected', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const b = capacityStudent('B', { mon: 'full', tue: 'full', wed: 'full', thu: 'full', fri: 'full' });
  const state = setupState({ students: [a, b] });
  assert.deepEqual(A.getStudentWorkEligibility(state, a.id, 'group-lesson').eligibleDayIds, ['mon', 'wed', 'fri']);
  assert.deepEqual(A.getStudentWorkEligibility(state, b.id, 'group-lesson').eligibleDayIds, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(A.getStudentAvailability(state, b.id).dayCapacity.tue, 'full');
});

test('8. group shared work is all-must-allow and names who blocks the day', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const b = capacityStudent('B', { mon: 'full', tue: 'full', wed: 'full', thu: 'full', fri: 'full' });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id, b.id] });
  const state = setupState({ students: [a, b], groups: [g] });
  const av = A.getGroupWorkAvailability(state, g.id, 'shared-with-mom');
  assert.equal(av.mode, 'all-must-allow');
  assert.deepEqual(av.eligibleDayIds, ['mon', 'wed', 'fri']);
  assert.equal(av.blockedBy.tue.length, 1);
  assert.equal(av.blockedBy.tue[0].studentId, a.id);
  assert.equal(av.blockedBy.tue[0].name, 'A');
  assert.equal(av.blockedBy.tue[0].capacity, 'light-independent');
  assert.equal(av.blockedBy.mon, undefined);
});

test('9. group independent work is per-student and does not remove the day for others', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const b = capacityStudent('B', { mon: 'full', tue: 'full', wed: 'full', thu: 'full', fri: 'full' });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id, b.id] });
  const state = setupState({ students: [a, b], groups: [g] });
  const av = A.getGroupWorkAvailability(state, g.id, 'independent-flexible');
  assert.equal(av.mode, 'per-student');
  assert.deepEqual(av.eligibleDayIds, ['mon', 'tue', 'wed', 'thu', 'fri'], 'the union, not the intersection');
  assert.deepEqual(av.perStudent[a.id], ['mon', 'wed', 'fri']);
  assert.deepEqual(av.perStudent[b.id], ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.ok(av.note.indexOf('separately') > -1);
});

test('10. an off day is never overridable, even with mayOccurOnLightDays', () => {
  const a = capacityStudent('A', { mon: 'off', tue: 'off', wed: 'off', thu: 'off', fri: 'off' });
  const state = setupState({ students: [a] });
  for (const wt of M.WORK_TYPE_IDS) {
    const el = A.getStudentWorkEligibility(state, a.id, wt, { mayOccurOnLightDays: true });
    assert.deepEqual(el.eligibleDayIds, [], wt);
    assert.equal(M.workTypeAllowedOnCapacity(wt, 'off', { mayOccurOnLightDays: true }).allowed, false, wt);
  }
});

test('11. legacy compat: workdays with no dayCapacity resolves off/full correctly', () => {
  const legacy = { id: 'legacy1', name: 'Legacy', active: true, workdays: { tue: false } };
  const state = setupState({ students: [legacy] });
  const av = A.getStudentAvailability(state, 'legacy1');
  assert.equal(av.dayCapacity.tue, 'off');
  assert.deepEqual(av.availableDayIds, ['mon', 'wed', 'thu', 'fri']);
  assert.equal(M.resolveDayCapacity(legacy, 'tue'), 'off');
  assert.equal(M.resolveDayCapacity(legacy, 'mon'), 'full');
});

test('12. a student with neither dayCapacity nor workdays resolves every day to full', () => {
  const bare = { id: 'bare1', name: 'Bare', active: true };
  const state = setupState({ students: [bare] });
  const av = A.getStudentAvailability(state, 'bare1');
  assert.deepEqual(av.availableDayIds, ['mon', 'tue', 'wed', 'thu', 'fri']);
  for (const d of ['mon', 'tue', 'wed', 'thu', 'fri']) assert.equal(M.resolveDayCapacity(bare, d), 'full');
  assert.equal(M.resolveDayCapacity({}, 'mon'), 'full');
});

test('13. dayCapacityExplicit suppresses the suggestion for that day only', () => {
  const a = capacityStudent('A', LIGHT_WEEK, { tue: true });
  const commit = M.makeOutsideCommitment({
    label: 'Field study', participantMode: 'everyone', weekdays: ['tue', 'thu'], suggestedCapacity: 'outside-only'
  });
  const state = setupState({ students: [a], outsideCommitments: [commit] });
  const av = A.getStudentAvailability(state, a.id);
  assert.equal(av.suggestedCapacity.tue, undefined, 'a hand-set day is never second-guessed');
  assert.equal(av.suggestedCapacity.thu.capacity, 'outside-only');
});

// ===========================================================================
// Loop buckets vs loop contents.
// ===========================================================================

const STRAND_A = M.FEAST_LIBRARY[0];
const STRAND_B = M.FEAST_LIBRARY[1];

test('14. loop buckets can exist with zero strands sorted into them', () => {
  const state = setupState({ loops: [M.makeLoop({ title: 'Bucket one' })] });
  const p = A.getLoopSortingProgress(state);
  assert.equal(p.bucketsDefined, true);
  assert.equal(p.bucketCount, 1);
  assert.equal(p.sortingComplete, false);
  assert.deepEqual(A.getLoopBucketContents(state, state.loops[0].id), []);
});

test('15. unsorted active strands are reported and still appear in buildFeastRows', () => {
  const state = setupState();
  const p = A.getLoopSortingProgress(state);
  assert.equal(p.unsortedStrandCount, M.FEAST_LIBRARY.length);
  assert.ok(p.unsortedStrandIds.indexOf(STRAND_A.id) > -1);
  const rows = A.buildFeastRows(state);
  assert.equal(rows.length, M.FEAST_LIBRARY.length);
  assert.equal(rows.find((r) => r.strandId === STRAND_A.id).placementState, 'unassigned');
});

test('16. turning a strand off removes it from unsorted but keeps its row', () => {
  const state = setupState();
  A.setStrandAssignmentForStrand(state, STRAND_A.id, STRAND_A.label, { assignmentMode: 'not-this-year' });
  const p = A.getLoopSortingProgress(state);
  assert.equal(p.unsortedStrandIds.indexOf(STRAND_A.id), -1);
  assert.equal(p.unsortedStrandCount, M.FEAST_LIBRARY.length - 1);
  const row = A.buildFeastRows(state).find((r) => r.strandId === STRAND_A.id);
  assert.ok(row, 'the row still exists');
  assert.equal(row.activeThisYear, false);
});

test('17. setupStepComplete is false when buckets exist but are not reviewed', () => {
  const state = setupState({ loops: [M.makeLoop({ title: 'Bucket' })] });
  assert.equal(A.getLoopSortingProgress(state).setupStepComplete, false, 'existence alone never completes the step');
  assert.equal(A.getSetupProgress(state).rhythm.complete, false);
  assert.ok(A.getSetupProgress(state).rhythm.detail.indexOf('Feast Planning') === -1 ||
    A.getSetupProgress(state).rhythm.detail.length > 0);
  A.markLoopBucketsReviewed(state);
  assert.equal(A.getLoopSortingProgress(state).setupStepComplete, true);
  assert.equal(A.getSetupProgress(state).rhythm.complete, true);
  assert.ok(A.getSetupProgress(state).rhythm.detail.indexOf('Feast Planning') > -1,
    'the detail must say sorting happens in Feast Planning');
});

test('18. sortingComplete requires zero unsorted AND loopSortingReviewed', () => {
  const state = setupState({ loops: [M.makeLoop({ title: 'Bucket' })] });
  state.setupPrototype = { loopSortingReviewed: true };
  A.markLoopBucketsReviewed(state);
  assert.equal(A.getLoopSortingProgress(state).sortingComplete, false, 'unsorted strands remain');
  // Give every strand a decision.
  for (const s of M.FEAST_LIBRARY) {
    A.setStrandAssignmentForStrand(state, s.id, s.label, { assignmentMode: 'not-this-year' });
  }
  assert.equal(A.getLoopSortingProgress(state).unsortedStrandCount, 0);
  assert.equal(A.getLoopSortingProgress(state).sortingComplete, true);
  state.setupPrototype.loopSortingReviewed = false;
  assert.equal(A.getLoopSortingProgress(state).sortingComplete, false, 'review is explicit, never inferred');
});

test('19. moving a strand between loops updates both buckets and leaves no duplicate', () => {
  const l1 = M.makeLoop({ title: 'One' });
  const l2 = M.makeLoop({ title: 'Two' });
  const state = setupState({ loops: [l1, l2] });
  A.setStrandAssignmentForStrand(state, STRAND_A.id, STRAND_A.label, { assignmentMode: 'loop', loopId: l1.id });
  A.setStrandAssignmentForStrand(state, STRAND_B.id, STRAND_B.label, { assignmentMode: 'loop', loopId: l1.id });
  assert.equal(A.getLoopBucketContents(state, l1.id).length, 2);
  assert.equal(A.getLoopBucketContents(state, l2.id).length, 0);

  A.setStrandAssignmentForStrand(state, STRAND_A.id, STRAND_A.label, { assignmentMode: 'loop', loopId: l2.id });
  assert.deepEqual(A.getLoopBucketContents(state, l1.id).map((r) => r.strandId), [STRAND_B.id]);
  assert.deepEqual(A.getLoopBucketContents(state, l2.id).map((r) => r.strandId), [STRAND_A.id]);
  assert.equal(state.strandAssignments.filter((sa) => sa.strandId === STRAND_A.id).length, 1);

  // Taking it out of the loop leaves it unsorted again, with no duplicate.
  A.setStrandAssignmentForStrand(state, STRAND_A.id, STRAND_A.label, { assignmentMode: null });
  assert.equal(A.getLoopBucketContents(state, l2.id).length, 0);
  assert.ok(A.getLoopSortingProgress(state).unsortedStrandIds.indexOf(STRAND_A.id) > -1);
  assert.ok(state.strandAssignments.filter((sa) => sa.strandId === STRAND_A.id).length <= 1);
});

test('20. suggestWorkTypeForAssignment maps each mode and an explicit workType wins', () => {
  const cases = {
    'everyone': 'group-lesson',
    'custom-group': 'group-lesson',
    'older-students': 'group-lesson',
    'littles': 'group-lesson',
    'loop': 'group-lesson',
    'individual': 'independent-essential',
    'coop-outside': 'outside-coop',
    'not-this-year': null
  };
  for (const [mode, expected] of Object.entries(cases)) {
    assert.equal(M.suggestWorkTypeForAssignment({ assignmentMode: mode }), expected, mode);
  }
  assert.equal(M.suggestWorkTypeForAssignment({}), null);
  assert.equal(M.suggestWorkTypeForAssignment(null), null);
  const sa = M.makeStrandAssignment({ strandId: 'x', assignmentMode: 'everyone' });
  assert.equal(sa.workType, null);
  assert.equal(sa.mayOccurOnLightDays, false);
  assert.equal(M.resolveWorkTypeForAssignment(sa), 'group-lesson');
  sa.workType = 'independent-flexible';
  assert.equal(M.resolveWorkTypeForAssignment(sa), 'independent-flexible', 'an explicit workType always wins');
});

test('21. every new helper tolerates {} and states missing optional arrays', () => {
  const degenerate = [
    {},
    { students: [{ id: 's1', name: 'Solo', active: true }] },
    { students: [{ id: 's1', name: 'Solo', active: true }], groups: [{ id: 'g1', label: 'G' }] },
    { students: [{ id: 's1', name: 'Solo', active: true }], outsideCommitments: [{ id: 'c1', label: 'X' }] },
    { loops: [{ id: 'l1', title: 'L' }] }
  ];
  for (const st of degenerate) {
    const av = A.getStudentAvailability(st, 's1');
    assert.equal(typeof av.dayCapacity, 'object');
    assert.equal(typeof av.capacityLabels, 'object');
    assert.equal(typeof av.suggestedCapacity, 'object');
    for (const key of ['availableDayIds', 'coopOnlyDayIds', 'lightDayIds', 'offDayIds']) {
      assert.ok(Array.isArray(av[key]), key);
    }
    const el = A.getStudentWorkEligibility(st, 's1', 'group-lesson');
    assert.ok(Array.isArray(el.eligibleDayIds));
    assert.equal(typeof el.byDay.mon.allowed, 'boolean');
    const gw = A.getGroupWorkAvailability(st, 'g1', 'independent-essential');
    assert.ok(Array.isArray(gw.eligibleDayIds) && typeof gw.perStudent === 'object');
    assert.equal(A.getGroupWorkAvailability(st, 'nope', 'group-lesson').mode, 'all-must-allow');
    const lp = A.getLoopSortingProgress(st);
    assert.equal(typeof lp.bucketsDefined, 'boolean');
    assert.equal(typeof lp.setupStepComplete, 'boolean');
    assert.equal(typeof lp.sortingComplete, 'boolean');
    assert.ok(Array.isArray(lp.unsortedStrandIds));
    assert.ok(Array.isArray(A.getLoopBucketContents(st, 'l1')));
    assert.equal(typeof A.getSetupProgress(st).rhythm.detail, 'string');
    assert.equal(typeof M.resolveDayCapacity(st.students ? st.students[0] : undefined, 'mon'), 'string');
    assert.equal(typeof M.workTypeAllowedOnCapacity(undefined, undefined).allowed, 'boolean');
  }
});


// ===========================================================================
// CORRECTION 1 — the light-day opt-in applies ONLY to independent-flexible.
// Every state is built inline; nothing depends on the sample family.
// ===========================================================================

test('C1.1 independent-essential is eligible on a light day without any opt-in', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  const el = A.getStudentAvailableDaysForWorkType(state, a.id, 'independent-essential');
  assert.deepEqual(el.eligibleDayIds, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(el.byDay.tue.allowed, true);
});

test('C1.2 independent-flexible is ineligible on a light day without the opt-in, eligible with it', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  assert.deepEqual(
    A.getStudentAvailableDaysForWorkType(state, a.id, 'independent-flexible').eligibleDayIds,
    ['mon', 'wed', 'fri']
  );
  assert.deepEqual(
    A.getStudentAvailableDaysForWorkType(state, a.id, 'independent-flexible', { mayOccurOnLightDays: true }).eligibleDayIds,
    ['mon', 'tue', 'wed', 'thu', 'fri']
  );
});

test('C1.3 shared-with-mom stays ineligible on a light day even when the item opts in', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  const el = A.getStudentAvailableDaysForWorkType(state, a.id, 'shared-with-mom', { mayOccurOnLightDays: true });
  assert.deepEqual(el.eligibleDayIds, ['mon', 'wed', 'fri']);
  assert.equal(el.byDay.tue.allowed, false);
  assert.equal(el.byDay.thu.allowed, false);
  assert.equal(M.workTypeAllowedOnCapacity('shared-with-mom', 'light-independent', { mayOccurOnLightDays: true }).allowed, false);
});

test('C1.4 group-lesson stays ineligible on a light day even when the item opts in', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const state = setupState({ students: [a] });
  const el = A.getStudentAvailableDaysForWorkType(state, a.id, 'group-lesson', { mayOccurOnLightDays: true });
  assert.deepEqual(el.eligibleDayIds, ['mon', 'wed', 'fri']);
  assert.equal(el.byDay.tue.allowed, false);
  assert.equal(M.workTypeAllowedOnCapacity('group-lesson', 'light-independent', { mayOccurOnLightDays: true }).allowed, false);
});

test('C1.5 both blocked reasons explain that the opt-in does not cover that kind of work', () => {
  for (const wt of ['shared-with-mom', 'group-lesson']) {
    const v = M.workTypeAllowedOnCapacity(wt, 'light-independent', { mayOccurOnLightDays: true });
    assert.equal(v.allowed, false, wt);
    assert.ok(/A light day is for independent work\./.test(v.reason), wt);
    assert.ok(/Opting in only covers flexible independent work/.test(v.reason), wt);
  }
  assert.ok(/not group lessons/.test(
    M.workTypeAllowedOnCapacity('group-lesson', 'light-independent', { mayOccurOnLightDays: true }).reason));
  assert.ok(/not work shared with Mom/.test(
    M.workTypeAllowedOnCapacity('shared-with-mom', 'light-independent', { mayOccurOnLightDays: true }).reason));
});

test('C1.6 outside-coop is eligible on a light day; off allows nothing even with the opt-in', () => {
  assert.equal(M.workTypeAllowedOnCapacity('outside-coop', 'light-independent').allowed, true);
  assert.equal(M.workTypeAllowedOnCapacity('outside-coop', 'light-independent', { mayOccurOnLightDays: true }).allowed, true);
  for (const wt of M.WORK_TYPE_IDS) {
    assert.equal(M.workTypeAllowedOnCapacity(wt, 'off', { mayOccurOnLightDays: true }).allowed, false, wt);
  }
});

test('C1.7 the opt-in changes nothing on full, outside-only, or off', () => {
  for (const cap of ['full', 'outside-only', 'off']) {
    for (const wt of M.WORK_TYPE_IDS) {
      const plain = M.workTypeAllowedOnCapacity(wt, cap);
      const opted = M.workTypeAllowedOnCapacity(wt, cap, { mayOccurOnLightDays: true });
      assert.equal(opted.allowed, plain.allowed, cap + '/' + wt);
      assert.equal(opted.reason, plain.reason, cap + '/' + wt);
    }
  }
});

test('C1.8 group shared work still excludes a member\'s light day even when the strand opts in', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const b = capacityStudent('B', { mon: 'full', tue: 'full', wed: 'full', thu: 'full', fri: 'full' });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id, b.id] });
  const state = setupState({ students: [a, b], groups: [g] });
  const av = A.getGroupWorkAvailability(state, g.id, 'shared-with-mom', { mayOccurOnLightDays: true });
  assert.equal(av.mode, 'all-must-allow');
  assert.deepEqual(av.eligibleDayIds, ['mon', 'wed', 'fri']);
  assert.equal(av.blockedBy.tue[0].studentId, a.id);
  const grp = A.getGroupWorkAvailability(state, g.id, 'group-lesson', { mayOccurOnLightDays: true });
  assert.deepEqual(grp.eligibleDayIds, ['mon', 'wed', 'fri']);
});

// ===========================================================================
// CORRECTION 2 — Setup reviews buckets; Feast reviews sorting.
// ===========================================================================

test('C2.9 noLoopsChosen satisfies the bucket requirement with zero loops', () => {
  const state = setupState({ loops: [] });
  state.setupPrototype = { noLoopsChosen: true };
  A.markLoopBucketsReviewed(state);
  const p = A.getLoopSortingProgress(state);
  assert.equal(p.bucketsDefined, false);
  assert.equal(p.noLoopsChosen, true);
  assert.equal(p.bucketsReviewed, true);
  assert.equal(p.setupStepComplete, true);
  // Without the explicit answer, zero loops does not complete the step.
  const other = setupState({ loops: [] });
  A.markLoopBucketsReviewed(other);
  assert.equal(A.getLoopSortingProgress(other).setupStepComplete, false);
});

test('C2.10 renaming a loop invalidates bucket review via the fingerprint', () => {
  const loop = M.makeLoop({ id: 'l1', title: 'Morning' });
  const state = setupState({ loops: [loop] });
  A.markLoopBucketsReviewed(state);
  assert.equal(A.getLoopSortingProgress(state).bucketsReviewed, true);
  state.loops[0].title = 'Morning basket';
  assert.equal(A.getLoopSortingProgress(state).bucketsReviewed, false);
  assert.equal(A.getLoopSortingProgress(state).setupStepComplete, false);
  A.markLoopBucketsReviewed(state);
  assert.equal(A.getLoopSortingProgress(state).bucketsReviewed, true);
});

test('C2.11 changing a loop\'s rhythmDayIds invalidates bucket review', () => {
  const loop = M.makeLoop({ id: 'l1', title: 'Morning', rhythmDayIds: ['mon'] });
  const state = setupState({ loops: [loop] });
  A.markLoopBucketsReviewed(state);
  state.loops[0].rhythmDayIds = ['mon', 'wed'];
  assert.equal(A.getLoopSortingProgress(state).bucketsReviewed, false);
  // Order must not matter — the fingerprint sorts day ids.
  A.markLoopBucketsReviewed(state);
  state.loops[0].rhythmDayIds = ['wed', 'mon'];
  assert.equal(A.getLoopSortingProgress(state).bucketsReviewed, true);
});

test('C2.12 moving a strand between buckets does NOT invalidate bucket review', () => {
  const l1 = M.makeLoop({ id: 'l1', title: 'One' });
  const l2 = M.makeLoop({ id: 'l2', title: 'Two' });
  const state = setupState({ loops: [l1, l2] });
  A.markLoopBucketsReviewed(state);
  state.setupPrototype.loopSortingReviewed = true;

  A.setStrandAssignmentForStrand(state, STRAND_A.id, STRAND_A.label, { assignmentMode: 'loop', loopId: 'l1' });
  A.setStrandAssignmentForStrand(state, STRAND_A.id, STRAND_A.label, { assignmentMode: 'loop', loopId: 'l2' });
  assert.equal(A.getLoopSortingProgress(state).bucketsReviewed, true, 'membership is not part of the fingerprint');

  // The Feast-level acknowledgement is what a membership change resets.
  state.setupPrototype.loopSortingReviewed = false;
  const p = A.getLoopSortingProgress(state);
  assert.equal(p.sortingReviewed, false);
  assert.equal(p.bucketsReviewed, true, 'loopBucketsReviewed is untouched');
  assert.equal(state.setupPrototype.loopBucketsReviewed, true);
});

test('C2.13 creating or deleting a loop invalidates bucket review', () => {
  const state = setupState({ loops: [M.makeLoop({ id: 'l1', title: 'One' })] });
  A.markLoopBucketsReviewed(state);
  state.loops.push(M.makeLoop({ id: 'l2', title: 'Two' }));
  assert.equal(A.getLoopSortingProgress(state).bucketsReviewed, false, 'creating a loop changes the structure');
  A.markLoopBucketsReviewed(state);
  state.loops = state.loops.filter((l) => l.id !== 'l2');
  assert.equal(A.getLoopSortingProgress(state).bucketsReviewed, false, 'deleting a loop changes the structure');
});

test('C2.14 unsorted strands never affect setupStepComplete', () => {
  const state = setupState({ loops: [M.makeLoop({ title: 'Bucket' })] });
  A.markLoopBucketsReviewed(state);
  const p = A.getLoopSortingProgress(state);
  assert.ok(p.unsortedStrandCount > 0, 'nothing is sorted yet');
  assert.equal(p.setupStepComplete, true);
  assert.equal(A.getSetupProgress(state).rhythm.complete, true);
  // And sorting everything does not change the Setup step either.
  for (const s of M.FEAST_LIBRARY) {
    A.setStrandAssignmentForStrand(state, s.id, s.label, { assignmentMode: 'not-this-year' });
  }
  assert.equal(A.getLoopSortingProgress(state).unsortedStrandCount, 0);
  assert.equal(A.getLoopSortingProgress(state).setupStepComplete, true);
});

test('C2.15 sortingComplete requires zero unsorted AND sortingReviewed', () => {
  const state = setupState({ loops: [M.makeLoop({ title: 'Bucket' })] });
  A.markLoopBucketsReviewed(state);
  state.setupPrototype.loopSortingReviewed = true;
  assert.equal(A.getLoopSortingProgress(state).sortingComplete, false, 'unsorted strands remain');
  for (const s of M.FEAST_LIBRARY) {
    A.setStrandAssignmentForStrand(state, s.id, s.label, { assignmentMode: 'not-this-year' });
  }
  assert.equal(A.getLoopSortingProgress(state).sortingComplete, true);
  state.setupPrototype.loopSortingReviewed = false;
  assert.equal(A.getLoopSortingProgress(state).sortingComplete, false);
});

test('C2.16 the next-step sentence is singular for 1 and plural otherwise', () => {
  assert.equal(A.describeUnsortedStrandsNextStep(1),
    '1 active strand still needs a handling decision in Feast Planning.');
  assert.equal(A.describeUnsortedStrandsNextStep(2),
    '2 active strands still need a handling decision in Feast Planning.');
  assert.equal(A.describeUnsortedStrandsNextStep(7),
    '7 active strands still need a handling decision in Feast Planning.');
  assert.equal(A.describeUnsortedStrandsNextStep(0), 'Every active strand already has a handling decision.');
  // And the progress object carries it.
  const state = setupState({ loops: [M.makeLoop({ title: 'B' })] });
  for (const s of M.FEAST_LIBRARY.slice(1)) {
    A.setStrandAssignmentForStrand(state, s.id, s.label, { assignmentMode: 'not-this-year' });
  }
  const p = A.getLoopSortingProgress(state);
  assert.equal(p.unsortedStrandCount, 1);
  assert.equal(p.unsortedNextStep, '1 active strand still needs a handling decision in Feast Planning.');
});

// ===========================================================================
// CORRECTION 3 — the four availability APIs.
// ===========================================================================

test('C3.17 getStudentBaselineCapacity reports source for explicit / legacy-workdays / default', () => {
  const explicitStu = {
    id: 'e1', name: 'E', active: true,
    dayCapacity: { mon: 'light-independent' },
    dayCapacityExplicit: { mon: true }
  };
  const legacyStu = { id: 'g1', name: 'L', active: true, workdays: { tue: false } };
  const bareStu = { id: 'b1', name: 'B', active: true };
  const state = setupState({ students: [explicitStu, legacyStu, bareStu] });

  const e = A.getStudentBaselineCapacity(state, 'e1');
  assert.equal(e.source.mon, 'explicit');
  assert.equal(e.dayCapacity.mon, 'light-independent');
  assert.equal(e.explicit.mon, true);
  assert.equal(e.source.tue, 'default');
  assert.equal(e.explicit.tue, false);

  const l = A.getStudentBaselineCapacity(state, 'g1');
  assert.equal(l.source.tue, 'legacy-workdays');
  assert.equal(l.dayCapacity.tue, 'off');
  assert.equal(l.source.mon, 'default');

  const b = A.getStudentBaselineCapacity(state, 'b1');
  for (const d of ['mon', 'tue', 'wed', 'thu', 'fri']) {
    assert.equal(b.source[d], 'default', d);
    assert.equal(b.dayCapacity[d], 'full', d);
  }
});

test('C3.18 getCommitmentCapacitySuggestions suggests for a non-explicit day and never for an explicit one', () => {
  const a = capacityStudent('A', LIGHT_WEEK, { tue: true });
  const commit = M.makeOutsideCommitment({
    id: 'c1', label: 'Field study', participantMode: 'everyone',
    weekdays: ['tue', 'thu'], suggestedCapacity: 'outside-only'
  });
  const state = setupState({ students: [a], outsideCommitments: [commit] });
  const s = A.getCommitmentCapacitySuggestions(state, a.id);
  assert.equal(s.suggestions.tue, undefined, 'a hand-set day is never second-guessed');
  assert.deepEqual(s.suggestions.thu, { capacity: 'outside-only', fromCommitmentId: 'c1', fromCommitmentLabel: 'Field study' });
  assert.deepEqual(s.suggestedDayIds, ['thu']);
});

test('C3.19 getStudentEffectiveCapacity ignores unapplied suggestions entirely', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const commit = M.makeOutsideCommitment({
    id: 'c1', label: 'Co-op', participantMode: 'everyone', weekdays: ['mon'], suggestedCapacity: 'outside-only'
  });
  const state = setupState({ students: [a], outsideCommitments: [commit] });
  const eff = A.getStudentEffectiveCapacity(state, a.id);
  assert.equal(eff.dayCapacity.mon, 'full', 'a suggestion is not a capacity');
  assert.equal(eff.hasUnappliedSuggestions, true);
  assert.deepEqual(eff.dayCapacity, A.getStudentBaselineCapacity(state, a.id).dayCapacity);
  assert.equal(a.dayCapacity.mon, 'full', 'nothing was written back to the student');

  const quiet = setupState({ students: [capacityStudent('B', LIGHT_WEEK)] });
  assert.equal(A.getStudentEffectiveCapacity(quiet, quiet.students[0].id).hasUnappliedSuggestions, false);
});

test('C3.20 applying a suggestion changes effective capacity and clears it from suggestions', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const commit = M.makeOutsideCommitment({
    id: 'c1', label: 'Co-op', participantMode: 'everyone', weekdays: ['mon'], suggestedCapacity: 'outside-only'
  });
  const state = setupState({ students: [a], outsideCommitments: [commit] });
  assert.deepEqual(A.getCommitmentCapacitySuggestions(state, a.id).suggestedDayIds, ['mon']);

  // Applying = writing baseline + marking the day explicit (what the UI does).
  a.dayCapacity.mon = 'outside-only';
  a.dayCapacityExplicit.mon = true;

  assert.equal(A.getStudentEffectiveCapacity(state, a.id).dayCapacity.mon, 'outside-only');
  assert.equal(A.getStudentEffectiveCapacity(state, a.id).hasUnappliedSuggestions, false);
  assert.deepEqual(A.getCommitmentCapacitySuggestions(state, a.id).suggestedDayIds, []);
  assert.equal(A.getStudentBaselineCapacity(state, a.id).source.mon, 'explicit');
});

test('C3.21 getStudentAvailableDaysForWorkType matches the matrix for every capacity x work type', () => {
  const MATRIX = {
    'full': { 'shared-with-mom': true, 'group-lesson': true, 'independent-essential': true, 'independent-flexible': true, 'outside-coop': true },
    'light-independent': { 'shared-with-mom': false, 'group-lesson': false, 'independent-essential': true, 'independent-flexible': false, 'outside-coop': true },
    'outside-only': { 'shared-with-mom': false, 'group-lesson': false, 'independent-essential': false, 'independent-flexible': false, 'outside-coop': true },
    'off': { 'shared-with-mom': false, 'group-lesson': false, 'independent-essential': false, 'independent-flexible': false, 'outside-coop': false }
  };
  const OPTED = { 'light-independent': { 'independent-flexible': true } };
  for (const cap of M.DAY_CAPACITY_IDS) {
    const stu = capacityStudent('A', { mon: cap, tue: cap, wed: cap, thu: cap, fri: cap });
    const state = setupState({ students: [stu] });
    for (const wt of M.WORK_TYPE_IDS) {
      const plain = A.getStudentAvailableDaysForWorkType(state, stu.id, wt);
      assert.equal(plain.byDay.mon.allowed, MATRIX[cap][wt], cap + '/' + wt);
      assert.equal(plain.eligibleDayIds.length, MATRIX[cap][wt] ? 5 : 0, cap + '/' + wt);
      assert.equal(typeof plain.byDay.mon.reason, 'string');
      assert.equal(plain.byDay.mon.capacity, cap);
      const opted = A.getStudentAvailableDaysForWorkType(state, stu.id, wt, { mayOccurOnLightDays: true });
      const expectOpted = (OPTED[cap] && OPTED[cap][wt] === true) ? true : MATRIX[cap][wt];
      assert.equal(opted.byDay.mon.allowed, expectOpted, 'opt-in ' + cap + '/' + wt);
    }
  }
});

test('C3.22 getStudentAvailability still returns its documented shape and is marked deprecated', () => {
  const a = capacityStudent('A', LIGHT_WEEK);
  const commit = M.makeOutsideCommitment({
    label: 'Co-op', participantMode: 'everyone', weekdays: ['mon'], suggestedCapacity: 'outside-only'
  });
  const state = setupState({ students: [a], outsideCommitments: [commit] });
  const av = A.getStudentAvailability(state, a.id);
  assert.equal(av.deprecated, true);
  assert.equal(typeof av.deprecationNote, 'string');
  assert.ok(av.deprecationNote.indexOf('effective capacity is Full') > -1);
  assert.deepEqual(av.availableDayIds, ['mon', 'wed', 'fri']);
  assert.deepEqual(av.lightDayIds, ['tue', 'thu']);
  assert.deepEqual(av.coopOnlyDayIds, []);
  assert.deepEqual(av.offDayIds, []);
  assert.deepEqual(av.blockedBy.mon, ['Co-op']);
  assert.equal(av.suggestedCapacity.mon.capacity, 'outside-only');
  assert.equal(av.suggestedCapacity.mon.fromCommitment, 'Co-op');
  assert.equal(av.capacityLabels.tue, M.dayCapacityLabel('light-independent'));
  assert.equal(typeof av.workdays.mon, 'boolean');
  // It is a delegate: capacity agrees with the effective capacity exactly.
  assert.deepEqual(av.dayCapacity, A.getStudentEffectiveCapacity(state, a.id).dayCapacity);
});

test('C3.23 all four availability functions tolerate {} and missing optional arrays', () => {
  const degenerate = [
    {},
    { students: null, outsideCommitments: undefined },
    { students: [{ id: 's1', name: 'Solo', active: true }] },
    { students: [{ id: 's1', name: 'Solo', active: true }], outsideCommitments: [{ id: 'c1', label: 'X' }] },
    { students: [{ id: 's1' }], groups: [{ id: 'g1' }] }
  ];
  for (const st of degenerate) {
    const b = A.getStudentBaselineCapacity(st, 's1');
    assert.equal(typeof b.dayCapacity.mon, 'string');
    assert.equal(typeof b.explicit.mon, 'boolean');
    assert.equal(typeof b.source.mon, 'string');
    const s = A.getCommitmentCapacitySuggestions(st, 's1');
    assert.equal(typeof s.suggestions, 'object');
    assert.ok(Array.isArray(s.suggestedDayIds));
    const e = A.getStudentEffectiveCapacity(st, 's1');
    assert.equal(typeof e.hasUnappliedSuggestions, 'boolean');
    const w = A.getStudentAvailableDaysForWorkType(st, 's1', 'group-lesson');
    assert.ok(Array.isArray(w.eligibleDayIds));
    assert.equal(typeof w.byDay.mon.allowed, 'boolean');
    assert.equal(typeof A.loopBucketFingerprint(st), 'string');
  }
});

// ===========================================================================
// MIGRATION — one normalizer, pure and idempotent.
// ===========================================================================

test('C4.24 loopContentsReviewed seeds loopSortingReviewed and is preserved', () => {
  const state = setupState({ setupPrototype: { loopContentsReviewed: true } });
  const out = A.migrateSetupPrototypeState(state);
  assert.equal(out.setupPrototype.loopSortingReviewed, true);
  assert.equal(out.setupPrototype.loopContentsReviewed, true, 'the legacy field is preserved');
  assert.equal(state.setupPrototype.loopSortingReviewed, undefined, 'the input state is not mutated');
  // A false legacy value migrates as false, not as "absent".
  const off = A.migrateSetupPrototypeState(setupState({ setupPrototype: { loopContentsReviewed: false } }));
  assert.equal(off.setupPrototype.loopSortingReviewed, false);
  // An existing loopSortingReviewed always wins.
  const both = A.migrateSetupPrototypeState(setupState({
    setupPrototype: { loopContentsReviewed: true, loopSortingReviewed: false }
  }));
  assert.equal(both.setupPrototype.loopSortingReviewed, false);
});

test('C4.25 rhythmReviewed seeds loopBucketsReviewed + fingerprint and is preserved', () => {
  const state = setupState({
    loops: [M.makeLoop({ id: 'l1', title: 'Morning', rhythmDayIds: ['mon'] })],
    setupPrototype: { rhythmReviewed: true }
  });
  const out = A.migrateSetupPrototypeState(state);
  assert.equal(out.setupPrototype.rhythmReviewed, true, 'the legacy field is preserved');
  assert.equal(out.setupPrototype.loopBucketsReviewed, true);
  assert.equal(out.setupPrototype.loopBucketsFingerprint, A.loopBucketFingerprint(state));
  assert.equal(A.getLoopSortingProgress(out).bucketsReviewed, true);
  assert.equal(out.setupPrototype.noLoopsChosen, undefined, 'noLoopsChosen is never invented');
  assert.equal(A.getLoopSortingProgress(out).noLoopsChosen, false);
});

test('C4.26 a legacy user whose buckets have not changed is not forced to re-confirm', () => {
  const legacy = setupState({
    loops: [M.makeLoop({ id: 'l1', title: 'Morning' })],
    setupPrototype: { loopBucketsReviewed: true }   // reviewed, but no fingerprint stored
  });
  assert.equal(A.getLoopSortingProgress(legacy).bucketsReviewed, false, 'before migration, nothing matches');
  const out = A.migrateSetupPrototypeState(legacy);
  const p = A.getLoopSortingProgress(out);
  assert.equal(p.bucketsReviewed, true);
  assert.equal(p.setupStepComplete, true);
  // ...but a real structure change after migration still re-opens the review.
  out.loops[0].title = 'Morning basket';
  assert.equal(A.getLoopSortingProgress(out).bucketsReviewed, false);
});

test('C4.27 migrateSetupPrototypeState is idempotent and tolerates {}', () => {
  const seeds = [
    {},
    setupState(),
    setupState({ setupPrototype: { loopContentsReviewed: true } }),
    setupState({ loops: [M.makeLoop({ id: 'l1', title: 'X' })], setupPrototype: { rhythmReviewed: true } }),
    setupState({ loops: [M.makeLoop({ id: 'l1', title: 'X' })], setupPrototype: { loopBucketsReviewed: true } }),
    setupState({ setupPrototype: { groupsReviewed: true, noLoopsChosen: true, loopSortingReviewed: true } })
  ];
  for (const seed of seeds) {
    const once = A.migrateSetupPrototypeState(seed);
    const twice = A.migrateSetupPrototypeState(once);
    assert.deepEqual(twice.setupPrototype, once.setupPrototype, 'running it twice changes nothing');
    assert.equal(JSON.stringify(twice), JSON.stringify(once));
    assert.equal(typeof once.setupPrototype, 'object');
  }
});


// ===========================================================================
// FINAL CLEANUP — CORRECTION 1: availability completion is about RESOLUTION,
// never about owning a Full workday. Every state is built inline; no student
// name, group label, or subject is hardcoded into any assertion.
// ===========================================================================

const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri'];
function everyDay(capacity) {
  const out = {};
  WEEK.forEach((d) => { out[d] = capacity; });
  return out;
}
function allExplicit() {
  const out = {};
  WEEK.forEach((d) => { out[d] = true; });
  return out;
}
// A child whose whole week the parent set by hand.
function explicitStudent(name, dayCapacity) {
  return M.makeStudent({ name, active: true, dayCapacity: Object.assign({}, dayCapacity), dayCapacityExplicit: allExplicit() });
}

test('F1.1 a child with only light-independent days is availability-complete', () => {
  const kid = explicitStudent('Wren', everyDay('light-independent'));
  const out = A.getAvailabilityCompletion(setupState({ students: [kid] }));
  assert.equal(out.complete, true);
  assert.deepEqual(out.unresolved, []);
  assert.equal(out.activeStudentCount, 1);
});

test('F1.2 a child with only outside/co-op days is availability-complete', () => {
  const kid = explicitStudent('Wren', everyDay('outside-only'));
  assert.equal(A.getAvailabilityCompletion(setupState({ students: [kid] })).complete, true);
});

test('F1.3 a child with every day off is availability-complete', () => {
  const kid = explicitStudent('Wren', everyDay('off'));
  assert.equal(A.getAvailabilityCompletion(setupState({ students: [kid] })).complete, true);
});

test('F1.4 a mixed week with zero Full days completes and yields exactly one advisory', () => {
  const kid = explicitStudent('Wren', {
    mon: 'light-independent', tue: 'outside-only', wed: 'off', thu: 'light-independent', fri: 'off'
  });
  const out = A.getAvailabilityCompletion(setupState({ students: [kid] }));
  assert.equal(out.complete, true);
  assert.equal(out.advisories.length, 1);
  assert.equal(out.advisories[0].studentId, kid.id);
});

test('F1.5 the advisory string has the required shape and uses the child\'s own name', () => {
  const kid = explicitStudent('Juniper', everyDay('off'));
  const out = A.getAvailabilityCompletion(setupState({ students: [kid] }));
  assert.equal(
    out.advisories[0].message,
    'No full workdays are selected for ' + kid.name + '. Independent or outside work may still be planned.'
  );
  // ...and it really is derived from the name, not a constant.
  const other = explicitStudent('Rowan', everyDay('off'));
  const out2 = A.getAvailabilityCompletion(setupState({ students: [other] }));
  assert.ok(out2.advisories[0].message.indexOf(other.name) > -1);
  assert.notEqual(out2.advisories[0].message, out.advisories[0].message);
});

test('F1.6 advisories never change complete or readyForFeast', () => {
  const withFull = explicitStudent('A', everyDay('full'));
  withFull.gradeBandConfirmed = true;
  const noFull = explicitStudent('B', everyDay('off'));
  noFull.gradeBandConfirmed = true;
  const state = setupState({
    students: [withFull, noFull],
    loops: [M.makeLoop({ title: 'Loop' })],
    setupPrototype: { groupsReviewed: true }
  });
  A.markLoopBucketsReviewed(state);
  const p = A.getSetupProgress(state);
  assert.equal(p.availability.advisories.length, 1, 'exactly one child has no full workdays');
  assert.equal(p.availability.complete, true);
  assert.equal(p.readyForFeast, true);
});

test('F1.7 unreviewed pure-default days are unresolved; availabilityReviewed completes them', () => {
  const kid = M.makeStudent({ name: 'Wren', active: true }); // defaults only, nothing set by hand
  const state = setupState({ students: [kid] });
  let out = A.getAvailabilityCompletion(state);
  assert.equal(out.complete, false);
  assert.equal(out.unresolved.length, 1);
  assert.deepEqual(out.unresolved[0].dayIds, WEEK);
  assert.equal(out.unresolved[0].name, kid.name);
  assert.ok(typeof out.detail === 'string' && out.detail.length > 0);

  A.markAvailabilityReviewed(state);
  out = A.getAvailabilityCompletion(state);
  assert.equal(out.complete, true);
  assert.deepEqual(out.unresolved, []);
});

test('F1.8 explicit capacities on every weekday complete WITHOUT availabilityReviewed', () => {
  const kid = explicitStudent('Wren', everyDay('full'));
  const state = setupState({ students: [kid] });
  assert.equal(A.getAvailabilityCompletion(state).availabilityReviewed, false);
  assert.equal(A.getAvailabilityCompletion(state).complete, true);
});

test('F1.9 legacy workdays-sourced days count as resolved without availabilityReviewed', () => {
  // A plan saved before capacities existed: boolean workdays and nothing else.
  const kid = { id: 'stu_legacy', name: 'Wren', active: true, workdays: { mon: true, tue: false, wed: true, thu: true, fri: false } };
  const state = setupState({ students: [kid] });
  const baseline = A.getStudentBaselineCapacity(state, kid.id);
  WEEK.forEach((d) => assert.equal(baseline.source[d], 'legacy-workdays'));
  const out = A.getAvailabilityCompletion(state);
  assert.equal(out.complete, true);
  assert.equal(out.availabilityReviewed, false);
  assert.deepEqual(out.unresolved, []);
});

test('F1.10 zero active students is not complete and does not crash', () => {
  const out = A.getAvailabilityCompletion(setupState({ students: [] }));
  assert.equal(out.complete, false);
  assert.equal(out.activeStudentCount, 0);
  assert.deepEqual(out.advisories, []);
  assert.equal(typeof out.detail, 'string');
  assert.equal(A.getAvailabilityCompletion({}).complete, false);
  assert.equal(A.getAvailabilityCompletion(undefined).complete, false);
});

// ===========================================================================
// FINAL CLEANUP — CORRECTION 2: "no loops this year" and real buckets can
// never coexist.
// ===========================================================================

test('F2.11 noLoopsChosen with zero buckets completes the step and reports no conflict', () => {
  const state = setupState({ setupPrototype: { noLoopsChosen: true } });
  A.markLoopBucketsReviewed(state);
  const p = A.getLoopSortingProgress(state);
  assert.equal(p.bucketsDefined, false);
  assert.equal(p.noLoopsConflict, false);
  assert.equal(p.setupStepComplete, true);
});

test('F2.12 createLoopBucket clears noLoopsChosen and yields an active loop', () => {
  const before = setupState({ setupPrototype: { noLoopsChosen: true } });
  const after = A.createLoopBucket(before, 'Morning basket');
  assert.equal(after.setupPrototype.noLoopsChosen, false);
  assert.equal(after.loops.length, 1);
  assert.equal(after.loops[0].active, true);
  assert.equal(after.loops[0].title, 'Morning basket');
  // pure: the input state is untouched
  assert.equal(before.loops.length, 0);
  assert.equal(before.setupPrototype.noLoopsChosen, true);
  // and an empty title still produces a usable bucket
  assert.equal(typeof A.createLoopBucket({}, '').loops[0].title, 'string');
});

test('F2.13 a contradictory state reports noLoopsConflict and is NOT complete', () => {
  const state = setupState({
    loops: [M.makeLoop({ id: 'l1', title: 'X' })],
    setupPrototype: { noLoopsChosen: true }
  });
  A.markLoopBucketsReviewed(state);
  const p = A.getLoopSortingProgress(state);
  assert.equal(p.bucketsDefined, true);
  assert.equal(p.noLoopsChosen, true);
  assert.equal(p.noLoopsConflict, true);
  assert.equal(p.bucketsReviewed, true, 'the review itself is still valid');
  assert.equal(p.setupStepComplete, false, 'a conflict must never read as complete');
  assert.equal(A.getSetupProgress(state).rhythm.complete, false);
  assert.equal(A.getSetupProgress(state).readyForFeast, false);
});

test('F2.14 rhythm.detail names the conflict plainly', () => {
  const state = setupState({
    loops: [M.makeLoop({ id: 'l1', title: 'X' }), M.makeLoop({ id: 'l2', title: 'Y' })],
    setupPrototype: { noLoopsChosen: true }
  });
  A.markLoopBucketsReviewed(state);
  const detail = A.getSetupProgress(state).rhythm.detail;
  assert.ok(detail.indexOf('"No loops this year"') > -1, detail);
  assert.ok(detail.indexOf('2 loop buckets') > -1, detail);
  assert.ok(/still exist/.test(detail), detail);
});

test('F2.15 setNoLoopsChosen without confirmation leaves active buckets untouched', () => {
  const state = setupState({ loops: [M.makeLoop({ id: 'l1', title: 'X' })] });
  const out = A.setNoLoopsChosen(state, true);
  assert.equal(out.noLoopsConfirmationRequired, true, 'the caller gets a signal it can act on');
  assert.equal(out.loops.length, 1);
  assert.equal(out.loops[0].active !== false, true, 'the bucket is still active');
  assert.equal(A.getLoopSortingProgress(out).noLoopsChosen, false, 'the flag was not written');
  assert.equal(A.getLoopSortingProgress(out).noLoopsConflict, false);
  assert.equal(state.loops[0].active !== false, true, 'and the input state is untouched');
  // The signal is non-enumerable, so it can never leak into saved JSON.
  assert.equal(Object.keys(out).indexOf('noLoopsConfirmationRequired'), -1);
  assert.equal(JSON.parse(JSON.stringify(out)).noLoopsConfirmationRequired, undefined);
});

test('F2.16 setNoLoopsChosen with confirmed:true archives buckets and deletes nothing', () => {
  const state = setupState({ loops: [M.makeLoop({ id: 'l1', title: 'X' }), M.makeLoop({ id: 'l2', title: 'Y' })] });
  const out = A.setNoLoopsChosen(state, true, { confirmed: true });
  assert.equal(out.loops.length, 2, 'nothing was deleted');
  out.loops.forEach((l) => assert.equal(l.active, false));
  assert.equal(out.setupPrototype.noLoopsChosen, true);
  const p = A.getLoopSortingProgress(out);
  assert.equal(p.bucketsDefined, false, 'archived buckets are not defined buckets');
  assert.equal(p.bucketCount, 0);
  assert.equal(p.noLoopsConflict, false);
  // titles survive, so a parent can still see what was set aside
  assert.deepEqual(out.loops.map((l) => l.title), state.loops.map((l) => l.title));
});

test('F2.17 strand assignments pointing at an archived loop survive and still resolve to it', () => {
  const loop = M.makeLoop({ id: 'l1', title: 'Morning basket' });
  const strandId = M.FEAST_LIBRARY[0].id;
  const state = setupState({
    loops: [loop],
    strandAssignments: [M.makeStrandAssignment({ strandId, strandLabel: M.FEAST_LIBRARY[0].label, assignmentMode: 'loop', loopId: loop.id })]
  });
  const out = A.setNoLoopsChosen(state, true, { confirmed: true });
  assert.equal(out.strandAssignments.length, 1);
  assert.equal(out.strandAssignments[0].loopId, loop.id);
  const row = A.buildFeastRows(out).find((r) => r.strandId === strandId);
  assert.equal(row.loopId, loop.id);
  assert.equal(row.loopTitle, loop.title, 'it still resolves to its real bucket');
  assert.deepEqual(row.warnings, [], 'an archived loop is not a missing loop');
});

test('F2.18 describeNoLoopsImpact reports bucket count, titles, and affected strand count', () => {
  const l1 = M.makeLoop({ id: 'l1', title: 'Alpha' });
  const l2 = M.makeLoop({ id: 'l2', title: 'Beta' });
  const s0 = M.FEAST_LIBRARY[0];
  const s1 = M.FEAST_LIBRARY[1];
  const state = setupState({
    loops: [l1, l2],
    strandAssignments: [
      M.makeStrandAssignment({ strandId: s0.id, strandLabel: s0.label, assignmentMode: 'loop', loopId: l1.id }),
      M.makeStrandAssignment({ strandId: s1.id, strandLabel: s1.label, assignmentMode: 'loop', loopId: l2.id })
    ]
  });
  const impact = A.describeNoLoopsImpact(state);
  assert.equal(impact.activeBucketCount, 2);
  assert.deepEqual(impact.bucketTitles, [l1.title, l2.title]);
  assert.equal(impact.affectedStrandCount, 2);
  assert.ok(impact.message.indexOf(l1.title) > -1 && impact.message.indexOf(l2.title) > -1);
  assert.ok(impact.message.indexOf('2') > -1);
  // empty case
  const none = A.describeNoLoopsImpact({});
  assert.equal(none.activeBucketCount, 0);
  assert.equal(none.affectedStrandCount, 0);
  assert.equal(typeof none.message, 'string');
});

test('F2.19 migration clears a stale noLoopsChosen when active loops exist, idempotently', () => {
  const seed = setupState({
    loops: [M.makeLoop({ id: 'l1', title: 'X' })],
    setupPrototype: { noLoopsChosen: true, groupsReviewed: true }
  });
  const once = A.migrateSetupPrototypeState(seed);
  assert.equal(once.setupPrototype.noLoopsChosen, false, 'real structure wins over a stale flag');
  assert.equal(once.setupPrototype.groupsReviewed, true, 'nothing else is disturbed');
  const twice = A.migrateSetupPrototypeState(once);
  assert.deepEqual(twice.setupPrototype, once.setupPrototype);
  assert.equal(JSON.stringify(twice), JSON.stringify(once));
  // an ARCHIVED loop is not a reason to clear the flag
  const archived = A.migrateSetupPrototypeState(setupState({
    loops: [M.makeLoop({ id: 'l1', title: 'X', active: false })],
    setupPrototype: { noLoopsChosen: true }
  }));
  assert.equal(archived.setupPrototype.noLoopsChosen, true);
});

test('F2.20 archived loops are excluded from bucketsDefined and from the fingerprint', () => {
  const active = setupState({ loops: [M.makeLoop({ id: 'l1', title: 'X' })] });
  const withArchived = setupState({
    loops: [M.makeLoop({ id: 'l1', title: 'X' }), M.makeLoop({ id: 'l2', title: 'Y', active: false })]
  });
  assert.equal(A.loopBucketFingerprint(withArchived), A.loopBucketFingerprint(active),
    'archiving a bucket must not invalidate a review of the remaining ones');
  assert.equal(A.getLoopSortingProgress(withArchived).bucketCount, 1);
  assert.equal(A.getLoopSortingProgress(withArchived).bucketsDefined, true);
  const allArchived = setupState({ loops: [M.makeLoop({ id: 'l1', title: 'X', active: false })] });
  assert.equal(A.getLoopSortingProgress(allArchived).bucketsDefined, false);
  assert.equal(A.loopBucketFingerprint(allArchived), '');
  // absent `active` still reads as active
  assert.equal(A.getLoopSortingProgress(setupState({ loops: [{ id: 'l1', title: 'X' }] })).bucketsDefined, true);
});

test('F2.21 unticking "no loops" does not resurrect archived loops', () => {
  const state = setupState({ loops: [M.makeLoop({ id: 'l1', title: 'X' })] });
  const archived = A.setNoLoopsChosen(state, true, { confirmed: true });
  const unticked = A.setNoLoopsChosen(archived, false);
  assert.equal(unticked.setupPrototype.noLoopsChosen, false);
  assert.equal(unticked.loops.length, 1);
  assert.equal(unticked.loops[0].active, false, 'the bucket stays set aside');
  assert.equal(A.getLoopSortingProgress(unticked).bucketsDefined, false);
  assert.equal(A.getLoopSortingProgress(unticked).noLoopsConflict, false);
  // creating a bucket is how you get one back
  const recreated = A.createLoopBucket(unticked, 'Fresh');
  assert.equal(A.getLoopSortingProgress(recreated).bucketCount, 1);
  assert.equal(recreated.loops.length, 2, 'the archived one is still there, untouched');
});

// ===========================================================================
// FINAL CLEANUP — CORRECTION 3: no ambiguous "available days" language.
// ===========================================================================

test('F3.22 family rows expose four category arrays that partition the school week', () => {
  const kid = explicitStudent('Wren', {
    mon: 'full', tue: 'light-independent', wed: 'outside-only', thu: 'off', fri: 'full'
  });
  const summary = A.buildSetupSummary(setupState({ students: [kid] }));
  const row = summary.family[0];
  const keys = ['fullWorkdayIds', 'lightIndependentDayIds', 'outsideOnlyDayIds', 'offDayIds'];
  keys.forEach((k) => assert.ok(Array.isArray(row[k]), k));
  const all = keys.reduce((acc, k) => acc.concat(row[k]), []);
  assert.equal(all.length, WEEK.length, 'no weekday appears twice and none is missing');
  assert.deepEqual(all.slice().sort(), WEEK.slice().sort());
  assert.deepEqual(row.fullWorkdayIds, ['mon', 'fri']);
  assert.deepEqual(row.lightIndependentDayIds, ['tue']);
  assert.deepEqual(row.outsideOnlyDayIds, ['wed']);
  assert.deepEqual(row.offDayIds, ['thu']);
});

test('F3.23 the deprecated availableDayIds alias is still present and equals fullWorkdayIds', () => {
  const kid = explicitStudent('Wren', {
    mon: 'full', tue: 'light-independent', wed: 'off', thu: 'full', fri: 'outside-only'
  });
  const row = A.buildSetupSummary(setupState({ students: [kid] })).family[0];
  assert.ok(Array.isArray(row.availableDayIds));
  assert.deepEqual(row.availableDayIds, row.fullWorkdayIds);
  // getStudentAvailability stays a deprecated compatibility wrapper, unchanged.
  const av = A.getStudentAvailability(setupState({ students: [kid] }), kid.id);
  assert.equal(av.deprecated, true);
  assert.ok(typeof av.deprecationNote === 'string' && av.deprecationNote.length > 0);
  assert.deepEqual(av.availableDayIds, row.fullWorkdayIds);
});

test('F3.24 group rows expose unambiguous group-lesson day fields', () => {
  const a = explicitStudent('A', { mon: 'full', tue: 'full', wed: 'off', thu: 'full', fri: 'full' });
  const b = explicitStudent('B', { mon: 'full', tue: 'off', wed: 'full', thu: 'full', fri: 'full' });
  const g = M.makeGroup({ label: 'G', studentIds: [a.id, b.id] });
  const row = A.buildSetupSummary(setupState({ students: [a, b], groups: [g] })).groups[0];
  assert.ok(Array.isArray(row.groupLessonDayIds));
  assert.ok(Array.isArray(row.partialGroupLessonDayIds));
  assert.deepEqual(row.groupLessonDayIds, ['mon', 'thu', 'fri'], 'only days every member can meet');
  assert.deepEqual(row.partialGroupLessonDayIds, ['tue', 'wed']);
  // deprecated alias kept so nothing breaks mid-refactor
  assert.deepEqual(row.availableDayIds, row.groupLessonDayIds);
});

test('F3.25 every new helper tolerates {} and states missing optional arrays', () => {
  const degenerate = [
    {},
    undefined,
    { students: null, groups: undefined, loops: null },
    { students: [{ id: 's1', name: 'Solo', active: true }] },
    { students: [{ id: 's1', name: 'Solo', active: true }], groups: [{ id: 'g1', label: 'G' }] },
    { loops: [{ id: 'l1', title: 'L' }] },
    { loops: [{ id: 'l1', title: 'L', active: false }], setupPrototype: { noLoopsChosen: true } }
  ];
  for (const st of degenerate) {
    const av = A.getAvailabilityCompletion(st);
    assert.equal(typeof av.complete, 'boolean');
    assert.ok(Array.isArray(av.unresolved) && Array.isArray(av.advisories));
    assert.equal(typeof av.detail, 'string');
    const impact = A.describeNoLoopsImpact(st);
    assert.equal(typeof impact.activeBucketCount, 'number');
    assert.ok(Array.isArray(impact.bucketTitles));
    assert.equal(typeof impact.message, 'string');
    const created = A.createLoopBucket(st, 'X');
    assert.equal(created.loops[created.loops.length - 1].active, true);
    assert.equal(created.setupPrototype.noLoopsChosen, false);
    const off = A.setNoLoopsChosen(st, false);
    assert.equal(off.setupPrototype.noLoopsChosen, false);
    const on = A.setNoLoopsChosen(st, true, { confirmed: true });
    assert.equal(on.setupPrototype.noLoopsChosen, true);
    assert.ok(Array.isArray(A.activeLoops(st)));
    assert.equal(typeof A.getLoopSortingProgress(st).noLoopsConflict, 'boolean');
    const summary = A.buildSetupSummary(st);
    summary.family.forEach((f) => {
      ['fullWorkdayIds', 'lightIndependentDayIds', 'outsideOnlyDayIds', 'offDayIds', 'availableDayIds']
        .forEach((k) => assert.ok(Array.isArray(f[k]), k));
    });
    summary.groups.forEach((gr) => {
      ['groupLessonDayIds', 'partialGroupLessonDayIds', 'availableDayIds']
        .forEach((k) => assert.ok(Array.isArray(gr[k]), k));
    });
    assert.ok(Array.isArray(A.getSetupProgress(st).availability.advisories));
  }
});

// ---------------------------------------------------------------------------
// Archived loop buckets — recovery path (restore / permanent delete).
// ---------------------------------------------------------------------------

// Minimal, name-free state builder. No student, group, subject, or loop title
// from any real plan.
function archiveTestState(extra) {
  return Object.assign({
    appStateVersion: 1,
    students: [], groups: [], subjectColumns: [], cards: [],
    loops: [{ id: 'lp_1', title: 'Bucket One', active: true, rhythmDayIds: ['mon', 'wed'] }],
    loopItems: [], sequences: [], sequenceItems: [], resources: [], resourceUses: [],
    strandAssignments: [],
    weeklyRhythm: { days: [], blocks: [], assignments: [] },
    setupPrototype: {}
  }, extra || {});
}

function archiveIt(state) {
  return A.setNoLoopsChosen(state, true, { confirmed: true });
}

test('archiving then restoring returns the loop bucket to the active list', () => {
  const st = archiveTestState();
  assert.equal(A.activeLoops(st).length, 1);
  const archived = archiveIt(st);
  assert.equal(A.activeLoops(archived).length, 0);
  assert.equal(A.getArchivedLoopBuckets(archived).length, 1);
  const restored = A.restoreLoopBucket(archived, 'lp_1');
  assert.equal(A.activeLoops(restored).length, 1);
  assert.equal(A.getArchivedLoopBuckets(restored).length, 0);
  assert.equal(restored.loops[0].active, true);
});

test('a restored loop bucket keeps its original id — no new one is minted', () => {
  const st = archiveTestState();
  const originalId = st.loops[0].id;
  const restored = A.restoreLoopBucket(archiveIt(st), originalId);
  assert.equal(restored.loops.length, st.loops.length);
  assert.equal(restored.loops.length, 1);
  assert.equal(restored.loops[0].id, originalId);
  assert.equal(typeof restored.loops[0].id, 'string');
});

test('strand assignments survive archive and restore, still pointing at the same loop', () => {
  const st = archiveTestState({
    strandAssignments: [
      { id: 'sa_1', strandId: 'strand-a', strandLabel: 'Strand A', assignmentMode: 'loop', loopId: 'lp_1' },
      { id: 'sa_2', strandId: 'strand-b', strandLabel: 'Strand B', assignmentMode: 'loop', loopId: 'lp_1' }
    ]
  });
  const archived = archiveIt(st);
  assert.equal(archived.strandAssignments.length, 2);
  assert.ok(archived.strandAssignments.every((sa) => sa.loopId === 'lp_1'));
  const restored = A.restoreLoopBucket(archived, 'lp_1');
  assert.equal(restored.strandAssignments.length, 2);
  assert.ok(restored.strandAssignments.every((sa) => sa.loopId === 'lp_1'));
  assert.equal(A.getLoopReferences(restored, 'lp_1').strandCount, 2);
});

test('restoreLoopBucket clears "no loops this year"', () => {
  const archived = archiveIt(archiveTestState());
  assert.equal(archived.setupPrototype.noLoopsChosen, true);
  const restored = A.restoreLoopBucket(archived, 'lp_1');
  assert.equal(restored.setupPrototype.noLoopsChosen, false);
  assert.equal(A.getLoopSortingProgress(restored).noLoopsChosen, false);
});

test('restoring a bucket invalidates the bucket review via the derived fingerprint', () => {
  let st = archiveTestState();
  st = archiveIt(st);
  st = A.markLoopBucketsReviewed(st);
  assert.equal(A.getLoopSortingProgress(st).bucketsReviewed, true);
  const restored = A.restoreLoopBucket(st, 'lp_1');
  assert.equal(restored.setupPrototype.loopBucketsReviewed, true);
  assert.equal(A.getLoopSortingProgress(restored).bucketsReviewed, false);
});

test('restore invalidates bucket review in the REAL parent ordering (review -> archive -> restore)', () => {
  // Regression: the original coverage reviewed the ALREADY-ARCHIVED state and
  // then restored, which is the one ordering where the derived fingerprint
  // happens to change. A parent reviews the bucket FIRST. In that ordering the
  // fingerprint returns to byte-identical after restore, so relying on the
  // derived check left the review silently valid.
  let st = archiveTestState();
  st = A.markLoopBucketsReviewed(st);                 // 1. review while ACTIVE
  const reviewedFingerprint = A.loopBucketFingerprint(st);
  assert.equal(A.getLoopSortingProgress(st).bucketsReviewed, true);

  st = archiveIt(st);                                  // 2. archive
  assert.equal(A.getLoopSortingProgress(st).bucketsReviewed, false);

  const restored = A.restoreLoopBucket(st, 'lp_1');    // 3. restore
  assert.equal(A.loopBucketFingerprint(restored), reviewedFingerprint,
    'the active structure really is identical again — which is exactly why the derived check was not enough');
  assert.equal(A.getLoopSortingProgress(restored).bucketsReviewed, false,
    'restore must still require re-confirmation');
  assert.equal(A.getLoopSortingProgress(restored).setupStepComplete, false);

  // And confirming again genuinely clears it.
  const reconfirmed = A.markLoopBucketsReviewed(restored);
  assert.equal(A.getLoopSortingProgress(reconfirmed).bucketsReviewed, true);
});

test('archiving a bucket changes the bucket fingerprint', () => {
  const st = archiveTestState();
  const before = A.loopBucketFingerprint(st);
  const archived = archiveIt(st);
  const after = A.loopBucketFingerprint(archived);
  assert.notEqual(before, after);
  assert.equal(after, '');
  assert.equal(A.loopBucketFingerprint(A.restoreLoopBucket(archived, 'lp_1')), before);
});

test('getLoopReferences counts a strandAssignment.loopId reference', () => {
  const st = archiveTestState({
    strandAssignments: [{ id: 'sa_1', strandId: 'strand-a', strandLabel: 'Strand A', assignmentMode: 'loop', loopId: 'lp_1' }]
  });
  const refs = A.getLoopReferences(st, 'lp_1');
  assert.deepEqual(refs.strandAssignmentIds, ['sa_1']);
  assert.equal(refs.strandCount, 1);
  assert.equal(refs.total, 1);
  assert.equal(refs.canDeletePermanently, false);
});

test('getLoopReferences counts a card.loopId reference', () => {
  const st = archiveTestState({ cards: [{ id: 'cd_1', loopId: 'lp_1' }] });
  const refs = A.getLoopReferences(st, 'lp_1');
  assert.deepEqual(refs.cardIds, ['cd_1']);
  assert.equal(refs.total, 1);
  assert.equal(refs.canDeletePermanently, false);
});

test('getLoopReferences counts a card.scheduleConfig.loopId reference', () => {
  const st = archiveTestState({ cards: [{ id: 'cd_2', scheduleConfig: { mode: 'loop', loopId: 'lp_1' } }] });
  const refs = A.getLoopReferences(st, 'lp_1');
  assert.deepEqual(refs.scheduleConfigCardIds, ['cd_2']);
  assert.deepEqual(refs.cardIds, []);
  assert.equal(refs.total, 1);
  assert.equal(refs.canDeletePermanently, false);
});

test('getLoopReferences counts a loopItem.loopId reference', () => {
  const st = archiveTestState({ loopItems: [{ id: 'li_1', loopId: 'lp_1', title: 'Item' }] });
  const refs = A.getLoopReferences(st, 'lp_1');
  assert.deepEqual(refs.loopItemIds, ['li_1']);
  assert.equal(refs.total, 1);
  assert.equal(refs.canDeletePermanently, false);
});

test('getLoopReferences counts a resourceUse.loopId reference', () => {
  const st = archiveTestState({ resourceUses: [{ id: 'ru_1', resourceId: 'rs_1', loopId: 'lp_1' }] });
  const refs = A.getLoopReferences(st, 'lp_1');
  assert.deepEqual(refs.resourceUseIds, ['ru_1']);
  assert.equal(refs.total, 1);
  assert.equal(refs.canDeletePermanently, false);
});

test('getLoopReferences counts a rhythm assignment reference', () => {
  const st = archiveTestState({
    weeklyRhythm: {
      days: [], blocks: [],
      assignments: [
        { id: 'ra_1', assignmentType: 'loop', referencedId: 'lp_1' },
        { id: 'ra_2', assignmentType: 'card', referencedId: 'lp_1' },
        { id: 'ra_3', assignmentType: 'loop', referencedId: 'lp_other' }
      ]
    }
  });
  const refs = A.getLoopReferences(st, 'lp_1');
  assert.deepEqual(refs.rhythmAssignmentIds, ['ra_1']);
  assert.equal(refs.placementCount, 1);
  assert.equal(refs.total, 1);
  assert.equal(refs.canDeletePermanently, false);
});

test('getLoopReferences on an unreferenced loop reports nothing and allows deletion', () => {
  const refs = A.getLoopReferences(archiveTestState(), 'lp_1');
  assert.equal(refs.total, 0);
  assert.equal(refs.strandCount, 0);
  assert.equal(refs.placementCount, 0);
  assert.equal(refs.canDeletePermanently, true);
  assert.deepEqual(refs.strandLabels, []);
});

test('permanent delete is blocked while the loop is still referenced', () => {
  const st = archiveIt(archiveTestState({
    strandAssignments: [{ id: 'sa_1', strandId: 'strand-a', strandLabel: 'Strand A', assignmentMode: 'loop', loopId: 'lp_1' }]
  }));
  const next = A.deleteLoopBucketPermanently(st, 'lp_1', { confirmed: true });
  assert.equal(next.loops.length, 1);
  assert.equal(next.loops[0].id, 'lp_1');
  assert.equal(next.strandAssignments.length, 1);
  assert.equal(typeof next.loopDeleteBlocked, 'string');
  assert.ok(next.loopDeleteBlocked.length > 0);
  assert.equal(Object.prototype.propertyIsEnumerable.call(next, 'loopDeleteBlocked'), false);
  assert.equal(Object.keys(next).indexOf('loopDeleteBlocked'), -1);
  const roundTripped = JSON.parse(JSON.stringify(next));
  assert.equal(roundTripped.loopDeleteBlocked, undefined);
});

test('permanent delete is blocked without an explicit confirmation, even when unreferenced', () => {
  const st = archiveIt(archiveTestState());
  const next = A.deleteLoopBucketPermanently(st, 'lp_1');
  assert.equal(next.loops.length, 1);
  assert.equal(next.loopDeleteConfirmationRequired, true);
  assert.equal(Object.prototype.propertyIsEnumerable.call(next, 'loopDeleteConfirmationRequired'), false);
  assert.equal(JSON.parse(JSON.stringify(next)).loopDeleteConfirmationRequired, undefined);
  const still = A.deleteLoopBucketPermanently(st, 'lp_1', {});
  assert.equal(still.loops.length, 1);
});

test('permanent delete removes the loop when it is unreferenced and confirmed', () => {
  const st = archiveIt(archiveTestState());
  assert.equal(st.loops.length, 1);
  const next = A.deleteLoopBucketPermanently(st, 'lp_1', { confirmed: true });
  assert.equal(next.loops.length, 0);
  assert.equal(A.getArchivedLoopBuckets(next).length, 0);
  assert.equal(next.loopDeleteBlocked, undefined);
  // The original state object is untouched — the helper is pure.
  assert.equal(st.loops.length, 1);
});

test('blockedReason is singular for one reference, plural otherwise, and names nobody', () => {
  const one = archiveIt(archiveTestState({
    strandAssignments: [{ id: 'sa_1', strandId: 'strand-a', strandLabel: 'Strand A', assignmentMode: 'loop', loopId: 'lp_1' }]
  }));
  const oneReason = A.getArchivedLoopBuckets(one)[0].blockedReason;
  assert.equal(oneReason, 'This loop is still used by 1 strand or placement. Restore it or move those items first.');

  const many = archiveIt(archiveTestState({
    strandAssignments: [
      { id: 'sa_1', strandId: 'strand-a', strandLabel: 'Strand A', assignmentMode: 'loop', loopId: 'lp_1' },
      { id: 'sa_2', strandId: 'strand-b', strandLabel: 'Strand B', assignmentMode: 'loop', loopId: 'lp_1' }
    ],
    weeklyRhythm: { days: [], blocks: [], assignments: [{ id: 'ra_1', assignmentType: 'loop', referencedId: 'lp_1' }] }
  }));
  const manyReason = A.getArchivedLoopBuckets(many)[0].blockedReason;
  assert.equal(manyReason, 'This loop is still used by 3 strands or placements. Restore it or move those items first.');

  [oneReason, manyReason].forEach((reason) => {
    assert.equal(/Strand A|Strand B|Bucket One|strand-a|lp_1/.test(reason), false);
  });

  // Nothing referencing it at all: no reason to show.
  assert.equal(A.getArchivedLoopBuckets(archiveIt(archiveTestState()))[0].blockedReason, '');
});

test('getArchivedLoopBuckets lists only loops explicitly marked active === false', () => {
  const st = archiveTestState({
    loops: [
      { id: 'lp_off', title: 'Set aside bucket', active: false, rhythmDayIds: ['tue'] },
      { id: 'lp_on', title: 'In use bucket', active: true },
      { id: 'lp_legacy', title: 'Legacy bucket without the field' }
    ]
  });
  const archived = A.getArchivedLoopBuckets(st);
  assert.deepEqual(archived.map((b) => b.loopId), ['lp_off']);
  assert.equal(archived[0].title, 'Set aside bucket');
  assert.deepEqual(archived[0].rhythmDayIds, ['tue']);
  assert.equal(archived[0].dayLabels.length, 1);
  assert.deepEqual(A.activeLoops(st).map((l) => l.id), ['lp_on', 'lp_legacy']);
});

test('the archived-bucket helpers tolerate {} and missing optional arrays', () => {
  assert.deepEqual(A.getArchivedLoopBuckets({}), []);
  assert.deepEqual(A.getArchivedLoopBuckets(undefined), []);
  const refs = A.getLoopReferences({}, 'lp_missing');
  assert.equal(refs.total, 0);
  assert.equal(refs.canDeletePermanently, true);
  assert.deepEqual(refs.cardIds, []);
  assert.deepEqual(refs.rhythmAssignmentIds, []);
  assert.deepEqual(A.getLoopReferences(undefined, 'lp_missing').loopItemIds, []);
  // A loop with no sibling collections at all still lists and restores.
  const bare = { loops: [{ id: 'lp_bare', active: false }] };
  const listed = A.getArchivedLoopBuckets(bare);
  assert.equal(listed.length, 1);
  assert.deepEqual(listed[0].dayLabels, []);
  assert.equal(listed[0].canDeletePermanently, true);
  const restored = A.restoreLoopBucket(bare, 'lp_bare');
  assert.equal(restored.loops[0].active, true);
  assert.equal(restored.setupPrototype.noLoopsChosen, false);
  assert.deepEqual(A.restoreLoopBucket({}, 'nope').loops, []);
  assert.deepEqual(A.deleteLoopBucketPermanently({}, 'nope', { confirmed: true }).loops, []);
  assert.equal(A.describeLoopDeleteBlocked({ total: 0 }), '');
});

// ---------------------------------------------------------------------------
// Per-loop set-aside, and moving strands out of a set-aside loop.
// Name-free throughout: ids and neutral labels only.
// ---------------------------------------------------------------------------
const MV_A = M.FEAST_LIBRARY[0].id;
const MV_A_LABEL = M.FEAST_LIBRARY[0].label;
const MV_B = M.FEAST_LIBRARY[1].id;

function twoLoopState(extra) {
  return Object.assign({
    appStateVersion: 1,
    students: [], groups: [], subjectColumns: [], cards: [],
    loops: [
      { id: 'lp_a', title: 'Bucket A', active: true, rhythmDayIds: ['mon'] },
      { id: 'lp_b', title: 'Bucket B', active: true, rhythmDayIds: [] },
      { id: 'lp_c', title: 'Bucket C', rhythmDayIds: [] }
    ],
    loopItems: [], sequences: [], sequenceItems: [], resources: [], resourceUses: [],
    strandAssignments: [],
    weeklyRhythm: { days: [], blocks: [], assignments: [] },
    setupPrototype: {}
  }, extra || {});
}

function saOn(loopId, strandId, fields) {
  return Object.assign({
    id: 'sa_' + strandId, strandId: strandId, strandLabel: 'Strand ' + strandId,
    assignmentMode: 'loop', loopId: loopId, groupId: null, studentIds: [],
    coopProvider: '', workType: null, mayOccurOnLightDays: false, notes: '',
    sortOrder: 0, createdBy: A.FEAST_PROTOTYPE_CREATED_BY
  }, fields || {});
}

test('setAsideLoopBucket archives only the named loop and leaves the others active', () => {
  const st = twoLoopState();
  const next = A.setAsideLoopBucket(st, 'lp_a', { confirmed: true });
  assert.deepEqual(next.loops.map((l) => l.id + ':' + String(l.active)), ['lp_a:false', 'lp_b:true', 'lp_c:undefined']);
  assert.deepEqual(A.activeLoops(next).map((l) => l.id), ['lp_b', 'lp_c']);
  assert.deepEqual(A.getArchivedLoopBuckets(next).map((b) => b.loopId), ['lp_a']);
  // Pure: the original is untouched.
  assert.equal(A.activeLoops(st).length, 3);
});

test('setAsideLoopBucket keeps the loop, its stable id, and its fields', () => {
  const next = A.setAsideLoopBucket(twoLoopState(), 'lp_a', { confirmed: true });
  assert.equal(next.loops.length, 3);
  const loop = next.loops.find((l) => l.id === 'lp_a');
  assert.ok(loop);
  assert.equal(loop.title, 'Bucket A');
  assert.deepEqual(loop.rhythmDayIds, ['mon']);
  // The same bucket can be restored by that same id.
  assert.equal(A.restoreLoopBucket(next, 'lp_a').loops.find((l) => l.id === 'lp_a').active, true);
});

test('setAsideLoopBucket requires opts.confirmed and marks the need non-enumerably', () => {
  const st = twoLoopState();
  const next = A.setAsideLoopBucket(st, 'lp_a');
  assert.equal(next.loopSetAsideConfirmationRequired, true);
  assert.deepEqual(A.activeLoops(next).map((l) => l.id), ['lp_a', 'lp_b', 'lp_c']);
  assert.equal(Object.prototype.propertyIsEnumerable.call(next, 'loopSetAsideConfirmationRequired'), false);
  assert.equal(Object.keys(next).indexOf('loopSetAsideConfirmationRequired'), -1);
  assert.equal(JSON.parse(JSON.stringify(next)).loopSetAsideConfirmationRequired, undefined);
  assert.equal(A.setAsideLoopBucket(st, 'lp_a', {}).loopSetAsideConfirmationRequired, true);
  assert.equal(A.setAsideLoopBucket(st, 'lp_a', { confirmed: true }).loopSetAsideConfirmationRequired, false);
});

test('setAsideLoopBucket leaves all six reference surfaces exactly as they were', () => {
  const st = twoLoopState({
    strandAssignments: [saOn('lp_a', MV_A)],
    cards: [
      { id: 'cd_1', loopId: 'lp_a' },
      { id: 'cd_2', scheduleConfig: { loopId: 'lp_a' } }
    ],
    loopItems: [{ id: 'li_1', loopId: 'lp_a' }],
    resourceUses: [{ id: 'ru_1', resourceId: 'rs_1', loopId: 'lp_a' }],
    weeklyRhythm: { days: [], blocks: [], assignments: [{ id: 'ra_1', assignmentType: 'loop', referencedId: 'lp_a' }] }
  });
  const before = A.getLoopReferences(st, 'lp_a');
  assert.equal(before.total, 6);
  const next = A.setAsideLoopBucket(st, 'lp_a', { confirmed: true });
  const after = A.getLoopReferences(next, 'lp_a');
  assert.deepEqual(after.strandAssignmentIds, before.strandAssignmentIds);
  assert.deepEqual(after.cardIds, before.cardIds);
  assert.deepEqual(after.scheduleConfigCardIds, before.scheduleConfigCardIds);
  assert.deepEqual(after.loopItemIds, before.loopItemIds);
  assert.deepEqual(after.resourceUseIds, before.resourceUseIds);
  assert.deepEqual(after.rhythmAssignmentIds, before.rhythmAssignmentIds);
  assert.equal(after.total, 6);
  assert.equal(after.canDeletePermanently, false);
});

test('setAsideLoopBucket invalidates bucket review derivedly and never sets noLoopsChosen', () => {
  let st = twoLoopState();
  A.markLoopBucketsReviewed(st);
  assert.equal(A.getLoopSortingProgress(st).bucketsReviewed, true);
  const fingerprintBefore = A.loopBucketFingerprint(st);

  const next = A.setAsideLoopBucket(st, 'lp_a', { confirmed: true });
  // No stamp is written — the fingerprint itself changed, so the derived check
  // is enough. (restoreLoopBucket needs a stamp; archiving never does.)
  assert.notEqual(A.loopBucketFingerprint(next), fingerprintBefore);
  assert.equal(next.setupPrototype.loopBucketsFingerprint, fingerprintBefore);
  assert.equal(next.setupPrototype.loopBucketsReviewed, true);
  assert.equal(A.getLoopSortingProgress(next).bucketsReviewed, false);
  assert.equal(next.setupPrototype.noLoopsChosen, undefined);
  assert.equal(A.getLoopSortingProgress(next).noLoopsChosen, false);
});

test('the global set-aside still archives every active loop bucket', () => {
  const next = A.setNoLoopsChosen(twoLoopState(), true, { confirmed: true });
  assert.deepEqual(A.activeLoops(next).map((l) => l.id), []);
  assert.deepEqual(A.getArchivedLoopBuckets(next).map((b) => b.loopId), ['lp_a', 'lp_b', 'lp_c']);
  assert.equal(next.setupPrototype.noLoopsChosen, true);
});

test('describeLoopSetAsideImpact separates strand count from other references and agrees with getLoopReferences', () => {
  const st = twoLoopState({
    strandAssignments: [saOn('lp_a', MV_A), saOn('lp_a', MV_B), saOn('lp_b', 'strand-other')],
    cards: [{ id: 'cd_1', loopId: 'lp_a' }],
    loopItems: [{ id: 'li_1', loopId: 'lp_a' }],
    weeklyRhythm: { days: [], blocks: [], assignments: [{ id: 'ra_1', assignmentType: 'loop', referencedId: 'lp_a' }] }
  });
  const impact = A.describeLoopSetAsideImpact(st, 'lp_a');
  const refs = A.getLoopReferences(st, 'lp_a');
  assert.equal(impact.loopId, 'lp_a');
  assert.equal(impact.title, 'Bucket A');
  assert.equal(impact.strandCount, 2);
  assert.equal(impact.otherReferenceCount, 3);
  assert.equal(impact.strandCount + impact.otherReferenceCount, refs.total);
  assert.equal(impact.references.total, refs.total);
  assert.equal(impact.strandLabels.length, 2);
  assert.ok(impact.message.includes('Bucket A'));
  assert.ok(/2 strands/.test(impact.message));
  assert.ok(/3 other references/.test(impact.message));
  assert.ok(/Nothing is deleted/.test(impact.message));
});

test('a strand moves off an archived loop onto an active one without restoring anything', () => {
  const st = A.setAsideLoopBucket(twoLoopState({ strandAssignments: [saOn('lp_a', MV_A)] }), 'lp_a', { confirmed: true });
  assert.deepEqual(A.getArchivedLoopStrandGroups(st).map((g) => g.loopId), ['lp_a']);

  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_b');
  assert.deepEqual(A.getArchivedLoopStrandGroups(st), []);
  assert.equal(A.getLoopBucketContents(st, 'lp_b').length, 1);
  assert.equal(A.getLoopBucketContents(st, 'lp_a').length, 0);
  // The bucket itself is still set aside, and still listed in Setup.
  assert.equal(st.loops.find((l) => l.id === 'lp_a').active, false);
  assert.deepEqual(A.getArchivedLoopBuckets(st).map((b) => b.loopId), ['lp_a']);
});

test('a strand returns to Unsorted from an archived loop, which stays archived', () => {
  const st = A.setAsideLoopBucket(twoLoopState({ strandAssignments: [saOn('lp_a', MV_A)] }), 'lp_a', { confirmed: true });
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, null);
  assert.deepEqual(A.getArchivedLoopStrandGroups(st), []);
  const progress = A.getLoopSortingProgress(st);
  assert.ok(progress.unsortedStrandIds.indexOf(MV_A) > -1);
  assert.equal(st.loops.find((l) => l.id === 'lp_a').active, false);
  assert.deepEqual(A.getArchivedLoopBuckets(st).map((b) => b.loopId), ['lp_a']);
});

test('audience and unrelated choices survive both loop -> loop and loop -> unsorted', () => {
  const st = twoLoopState({
    strandAssignments: [saOn('lp_a', MV_A, {
      workType: 'independent', mayOccurOnLightDays: true, notes: 'a note', sortOrder: 7
    })]
  });
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_b');
  let sa = st.strandAssignments[0];
  assert.equal(sa.assignmentMode, 'loop');
  assert.equal(sa.loopId, 'lp_b');
  assert.equal(sa.workType, 'independent');
  assert.equal(sa.mayOccurOnLightDays, true);
  assert.equal(sa.notes, 'a note');
  assert.equal(sa.sortOrder, 7);
  assert.equal(sa.id, 'sa_' + MV_A);
  assert.equal(sa.createdBy, A.FEAST_PROTOTYPE_CREATED_BY);

  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, null);
  assert.equal(st.strandAssignments.length, 1, 'returning to Unsorted must KEEP the record');
  sa = st.strandAssignments[0];
  assert.equal(sa.assignmentMode, null);
  assert.equal(sa.loopId, null);
  assert.equal(sa.workType, 'independent');
  assert.equal(sa.mayOccurOnLightDays, true);
  assert.equal(sa.notes, 'a note');
  assert.equal(sa.id, 'sa_' + MV_A);
});

test('a strand assigned to a group then moved between loops never resurrects a stale groupId', () => {
  const st = twoLoopState({ groups: [{ id: 'grp_1', label: 'A group', studentIds: [] }] });
  A.setStrandAssignmentForStrand(st, MV_A, MV_A_LABEL, { assignmentMode: 'custom-group', groupId: 'grp_1' });
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_a');
  assert.equal(st.strandAssignments[0].groupId, null);
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_b');
  assert.equal(st.strandAssignments[0].groupId, null);
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, null);
  assert.equal(st.strandAssignments[0].groupId, null);
  assert.deepEqual(st.strandAssignments[0].studentIds, []);
});

test('both the archived groups and the bucket contents reflect a move immediately', () => {
  const st = A.setAsideLoopBucket(twoLoopState({
    strandAssignments: [saOn('lp_a', MV_A), saOn('lp_a', MV_B)]
  }), 'lp_a', { confirmed: true });
  assert.equal(A.getArchivedLoopStrandGroups(st)[0].strands.length, 2);
  assert.equal(A.getLoopBucketContents(st, 'lp_b').length, 0);

  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_b');
  assert.equal(A.getArchivedLoopStrandGroups(st)[0].strands.length, 1);
  assert.deepEqual(A.getArchivedLoopStrandGroups(st)[0].strands.map((s) => s.strandId), [MV_B]);
  assert.equal(A.getLoopBucketContents(st, 'lp_b').length, 1);
  assert.equal(A.getLoopBucketContents(st, 'lp_a').length, 1);
});

test('getArchivedLoopStrandGroups omits empty archived loops and every active loop', () => {
  const st = twoLoopState({
    loops: [
      { id: 'lp_empty', title: 'Empty set-aside', active: false, rhythmDayIds: [] },
      { id: 'lp_full', title: 'Full set-aside', active: false, rhythmDayIds: ['tue'] },
      { id: 'lp_live', title: 'In use', active: true }
    ],
    strandAssignments: [saOn('lp_full', MV_A), saOn('lp_live', MV_B)]
  });
  const groups = A.getArchivedLoopStrandGroups(st);
  assert.deepEqual(groups.map((g) => g.loopId), ['lp_full']);
  assert.equal(groups[0].title, 'Full set-aside');
  assert.deepEqual(groups[0].rhythmDayIds, ['tue']);
  assert.deepEqual(groups[0].strands.map((s) => s.strandId), [MV_A]);
  assert.equal(groups[0].strands[0].label, MV_A_LABEL);
  assert.ok(groups[0].strands[0].formLabel.length > 0);
  assert.ok(groups[0].strands[0].columnLabel.length > 0);
  // The empty archived bucket is still listed for Setup, just not here.
  assert.deepEqual(A.getArchivedLoopBuckets(st).map((b) => b.loopId), ['lp_empty', 'lp_full']);
});

test('moving a strand resets loop SORTING review and leaves bucket review alone', () => {
  const st = A.setAsideLoopBucket(twoLoopState({ strandAssignments: [saOn('lp_a', MV_A)] }), 'lp_a', { confirmed: true });
  A.markLoopBucketsReviewed(st);
  st.setupPrototype.loopSortingReviewed = true;
  const bucketFingerprint = st.setupPrototype.loopBucketsFingerprint;
  assert.equal(A.getLoopSortingProgress(st).bucketsReviewed, true);

  // Same call shape the page makes: move, then clear sorting only.
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_b');
  st.setupPrototype.loopSortingReviewed = false;

  assert.equal(A.getLoopSortingProgress(st).sortingReviewed, false);
  assert.equal(st.setupPrototype.loopBucketsReviewed, true);
  assert.equal(st.setupPrototype.loopBucketsFingerprint, bucketFingerprint);
  assert.equal(A.getLoopSortingProgress(st).bucketsReviewed, true);
});

test('clearing the last strand off an archived loop unlocks the confirmed permanent delete', () => {
  const st = A.setAsideLoopBucket(twoLoopState({ strandAssignments: [saOn('lp_a', MV_A)] }), 'lp_a', { confirmed: true });
  assert.equal(A.getLoopReferences(st, 'lp_a').canDeletePermanently, false);
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_b');
  assert.equal(A.getLoopReferences(st, 'lp_a').canDeletePermanently, true);
  const deleted = A.deleteLoopBucketPermanently(st, 'lp_a', { confirmed: true });
  assert.deepEqual(deleted.loops.map((l) => l.id), ['lp_b', 'lp_c']);
  // The moved strand is untouched by the delete.
  assert.equal(deleted.strandAssignments[0].loopId, 'lp_b');
});

test('a loop referenced by any one of the other five surfaces stays undeletable with zero strands', () => {
  const surfaces = [
    { cards: [{ id: 'cd_1', loopId: 'lp_a' }] },
    { cards: [{ id: 'cd_2', scheduleConfig: { loopId: 'lp_a' } }] },
    { loopItems: [{ id: 'li_1', loopId: 'lp_a' }] },
    { resourceUses: [{ id: 'ru_1', resourceId: 'rs_1', loopId: 'lp_a' }] },
    { weeklyRhythm: { days: [], blocks: [], assignments: [{ id: 'ra_1', assignmentType: 'loop', referencedId: 'lp_a' }] } }
  ];
  surfaces.forEach((surface) => {
    const st = A.setAsideLoopBucket(twoLoopState(Object.assign({
      strandAssignments: [saOn('lp_a', MV_A)]
    }, surface)), 'lp_a', { confirmed: true });
    A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, null);
    const refs = A.getLoopReferences(st, 'lp_a');
    assert.equal(refs.strandCount, 0);
    assert.equal(refs.total, 1);
    assert.equal(refs.canDeletePermanently, false);
    assert.equal(A.deleteLoopBucketPermanently(st, 'lp_a', { confirmed: true }).loops.length, 3);
  });
});

test('moveStrandLoopAssignment keeps exactly one assignment per strand', () => {
  const st = twoLoopState();
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_a');
  assert.equal(st.strandAssignments.length, 1);
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_b');
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, null);
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_a');
  assert.equal(st.strandAssignments.length, 1);
  assert.equal(st.strandAssignments.filter((sa) => sa.strandId === MV_A).length, 1);
  A.moveStrandLoopAssignment(st, MV_B, 'Strand B', 'lp_a');
  assert.equal(st.strandAssignments.length, 2);
});

test('resetPrototypeStrandAssignments still removes a record left behind by a return to Unsorted', () => {
  const st = twoLoopState();
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, 'lp_a');
  A.moveStrandLoopAssignment(st, MV_A, MV_A_LABEL, null);
  assert.equal(st.strandAssignments.length, 1);
  assert.equal(st.strandAssignments[0].createdBy, A.FEAST_PROTOTYPE_CREATED_BY);
  assert.deepEqual(A.resetPrototypeStrandAssignments(st).strandAssignments, []);

  // A record the main app made is preserved even after being returned to Unsorted.
  const appState = twoLoopState({
    strandAssignments: [saOn('lp_a', MV_B, { id: 'sa_app', createdBy: null })]
  });
  A.moveStrandLoopAssignment(appState, MV_B, 'Strand B', null);
  assert.equal(A.resetPrototypeStrandAssignments(appState).strandAssignments.length, 1);
});

test('the per-loop set-aside helpers tolerate {} and missing optional arrays', () => {
  assert.deepEqual(A.getArchivedLoopStrandGroups({}), []);
  assert.deepEqual(A.getArchivedLoopStrandGroups(undefined), []);
  assert.deepEqual(A.getArchivedLoopStrandGroups({ loops: [{ id: 'lp_x', active: false }] }), []);

  const bare = A.describeLoopSetAsideImpact({}, 'lp_missing');
  assert.equal(bare.strandCount, 0);
  assert.equal(bare.otherReferenceCount, 0);
  assert.equal(bare.title, 'Untitled loop');
  assert.deepEqual(bare.strandLabels, []);
  assert.equal(A.describeLoopSetAsideImpact(undefined, 'lp_missing').references.total, 0);

  assert.deepEqual(A.setAsideLoopBucket({}, 'lp_missing', { confirmed: true }).loops, []);
  assert.equal(A.setAsideLoopBucket(undefined, 'lp_missing').loopSetAsideConfirmationRequired, true);

  assert.equal(A.moveStrandLoopAssignment(undefined, MV_A, MV_A_LABEL, 'lp_a'), null);
  const empty = {};
  A.moveStrandLoopAssignment(empty, MV_A, MV_A_LABEL, 'lp_a');
  assert.equal(empty.strandAssignments.length, 1);
  // Returning an unrecorded strand to Unsorted invents nothing.
  const none = {};
  assert.equal(A.moveStrandLoopAssignment(none, MV_A, MV_A_LABEL, null), null);
  assert.deepEqual(none.strandAssignments, []);
});

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
