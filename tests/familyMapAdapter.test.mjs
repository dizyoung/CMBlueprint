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
  assert.equal(columns.length, 5);

  const togetherRow = grid.find((g) => g.row.id === 'together');
  assert.ok(togetherRow.cells.bible.some((c) => c.id === 'card_bible'));
  assert.ok(togetherRow.cells.literature.some((c) => c.id === 'card_readaloud'));

  const olderGroupRow = grid.find((g) => g.row.id === 'group:older');
  assert.ok(olderGroupRow.cells.history.some((c) => c.id === 'card_amhistory'));
  assert.ok(olderGroupRow.cells.history.some((c) => c.id === 'card_ancienthistory'));

  const kaylaRow = grid.find((g) => g.row.id === 'individual:kayla');
  assert.ok(kaylaRow.cells.math.some((c) => c.id === 'card_math'));

  const coopRow = grid.find((g) => g.row.id === 'coop-outside');
  assert.ok(coopRow.cells.science.some((c) => c.id === 'card_science_coop'));

  const optionalRow = grid.find((g) => g.row.id === 'optional');
  assert.ok(optionalRow.cells.history.some((c) => c.id === 'card_mapquiz'));

  const unplacedRow = grid.find((g) => g.row.id === 'unplaced');
  assert.ok(unplacedRow.cells.history.some((c) => c.id === 'card_neighboring'));
});

test('Student Lens resolves correctly from real state, including together/group/co-op/individual work', () => {
  const state = A.buildSampleAppState();
  const jeremiahCards = A.studentLensCards(state, 'jeremiah').map((c) => c.id);
  assert.deepEqual(jeremiahCards.sort(), [
    'card_amhistory', 'card_ancienthistory', 'card_bible', 'card_readaloud', 'card_science_coop'
  ].sort());

  const kaylaCards = A.studentLensCards(state, 'kayla').map((c) => c.id);
  assert.deepEqual(kaylaCards.sort(), ['card_bible', 'card_math', 'card_readaloud'].sort());

  const kaylaWithOptional = A.studentLensCards(state, 'kayla', { includeOptional: true }).map((c) => c.id);
  assert.ok(!kaylaWithOptional.includes('card_mapquiz'));
});

test('Group Lens and Subject Lens resolve from real state', () => {
  const state = A.buildSampleAppState();
  const olderGroupCards = A.groupLensCards(state, 'older').map((c) => c.id);
  assert.ok(olderGroupCards.includes('card_amhistory'));
  assert.ok(olderGroupCards.includes('card_ancienthistory'));

  const historyCards = A.subjectLensCards(state, 'history').map((c) => c.id).sort();
  assert.deepEqual(historyCards, [
    'card_amhistory', 'card_ancienthistory', 'card_mapquiz', 'card_neighboring'
  ].sort());
});

test('Book & Resource List rollup works from real state and resolves participants', () => {
  const state = A.buildSampleAppState();
  const grouped = A.getResourceList(state, { groupBy: 'subject', filter: 'all' });
  const amhistory = grouped.history.find((r) => r.id === 'res_amhistory');
  assert.ok(amhistory);
  const cardUse = amhistory.uses.find((u) => u.cardId === 'card_amhistory');
  assert.deepEqual(cardUse.participants.sort(), ['jeremiah', 'lucy']);

  const bibleLoopUse = grouped.bible.find((r) => r.id === 'res_bible').uses.find((u) => u.loopId === 'loop_bible');
  assert.deepEqual(bibleLoopUse.participants.sort(), ['charis', 'jeremiah', 'kayla', 'lucy']);

  const bibleOverrideUse = grouped.bible.find((r) => r.id === 'res_bible').uses.find((u) => u.cardId === 'card_amhistory');
  assert.deepEqual(bibleOverrideUse.participants, ['jeremiah']);
});

test('changing resource status affects resource filters (need-to-get vs missing)', () => {
  const state = A.buildSampleAppState();
  const beforeNeedToGet = A.getResourceList(state, { groupBy: 'status', filter: 'need-to-get' });
  const beforeIds = Object.values(beforeNeedToGet).flat().map((r) => r.id);
  assert.ok(beforeIds.includes('res_math_kayla'));
  assert.ok(!beforeIds.includes('res_ancienthistory'), '"need-to-choose" should not appear in need-to-get');

  A.setResourceStatus(state, 'res_math_kayla', 'have-it');
  const afterNeedToGet = A.getResourceList(state, { groupBy: 'status', filter: 'need-to-get' });
  const afterIds = Object.values(afterNeedToGet).flat().map((r) => r.id);
  assert.ok(!afterIds.includes('res_math_kayla'));

  const missing = A.getResourceList(state, { groupBy: 'status', filter: 'missing' });
  const missingIds = Object.values(missing).flat().map((r) => r.id);
  assert.ok(missingIds.includes('res_ancienthistory'));
  assert.ok(!missingIds.includes('res_mapquiz'), '"no resource needed" should be excluded from missing list');
});

test('changing card participant override affects Student Lens and resource rollup', () => {
  const state = A.buildSampleAppState();
  assert.ok(!A.studentLensCards(state, 'charis').some((c) => c.id === 'card_amhistory'));

  A.setCardParticipants(state, 'card_amhistory', 'group', ['littles']);
  assert.ok(A.studentLensCards(state, 'charis').some((c) => c.id === 'card_amhistory'));

  const rollup = A.getResourceList(state, { groupBy: 'subject', filter: 'all' });
  const use = rollup.history.find((r) => r.id === 'res_amhistory').uses.find((u) => u.cardId === 'card_amhistory');
  assert.deepEqual(use.participants.sort(), ['charis', 'kayla']);
});

test('changing a ResourceUse participantsOverride affects resolved rollup participants', () => {
  const state = A.buildSampleAppState();
  const use = state.resourceUses.find((u) => u.id === 'ruse_amhistory');
  use.participantsOverride = ['lucy'];
  const rollup = A.getResourceList(state, { groupBy: 'subject', filter: 'all' });
  const resolved = rollup.history.find((r) => r.id === 'res_amhistory').uses.find((u) => u.id === 'ruse_amhistory');
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
  A.setCardTitle(state, 'card_math', 'Math Lessons');
  assert.equal(A.findCard(state, 'card_math').title, 'Math Lessons');

  A.setCardAudience(state, 'card_mapquiz', 'individual');
  assert.equal(A.findCard(state, 'card_mapquiz').audience, 'individual');

  A.moveCardToSubject(state, 'card_mapquiz', 'literature');
  assert.equal(A.findCard(state, 'card_mapquiz').subjectColumnId, 'literature');

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
  // none of the sample cards are referenced by id from the sample rhythm (the
  // sample rhythm uses its own student/group ids, not the sample card ids)
  assert.ok(cardsWithoutPlacement.length > 0);
  assert.equal(A.cardHasRhythmPlacement(state, 'card_math'), false);

  const loop = state.loops[0];
  assert.equal(A.loopHasRhythmPlacement(state, loop.id), false);
  assert.ok(A.getLoopsWithoutRhythmPlacement(state).some((l) => l.id === loop.id));
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
