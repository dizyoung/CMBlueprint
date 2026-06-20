// Plain-Node test runner for lib/familyMap.mjs — no dependencies, no installs.
// Run with: node tests/familyMap.test.mjs
import assert from 'node:assert/strict';
import * as M from '../lib/familyMap.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function sampleStudents() {
  return [
    M.makeStudent({ id: 'charis', name: 'Charis', gradeBand: 'form1', active: true }),
    M.makeStudent({ id: 'kayla', name: 'Kayla', gradeBand: 'form1', active: true }),
    M.makeStudent({ id: 'lucy', name: 'Lucy', gradeBand: 'form2', active: true }),
    M.makeStudent({ id: 'jeremiah', name: 'Jeremiah', gradeBand: 'form3', active: true }),
    M.makeStudent({ id: 'inactive-kid', name: 'Retired', gradeBand: 'form1', active: false })
  ];
}
function sampleGroups() {
  return [M.makeGroup({ id: 'older', label: 'Older Students', studentIds: ['lucy', 'jeremiah'] })];
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------
test('Together resolves all active students', () => {
  const card = M.makeCard({ participantMode: 'together' });
  const ids = M.resolveParticipants(card, sampleStudents(), sampleGroups());
  assert.deepEqual(ids.sort(), ['charis', 'jeremiah', 'kayla', 'lucy']);
});

test('Group resolves group studentIds', () => {
  const card = M.makeCard({ participantMode: 'group', participantIds: ['older'] });
  const ids = M.resolveParticipants(card, sampleStudents(), sampleGroups());
  assert.deepEqual(ids.sort(), ['jeremiah', 'lucy']);
});

test('Individual resolves one student', () => {
  const card = M.makeCard({ participantMode: 'individual', participantIds: ['kayla'] });
  const ids = M.resolveParticipants(card, sampleStudents(), sampleGroups());
  assert.deepEqual(ids, ['kayla']);
});

test('Co-op/external participants resolve correctly', () => {
  const card = M.makeCard({ participantMode: 'coop', participantIds: ['jeremiah'] });
  const ids = M.resolveParticipants(card, sampleStudents(), sampleGroups());
  assert.deepEqual(ids, ['jeremiah']);
});

test('Explicit participant override wins over mode default', () => {
  const card = M.makeCard({ participantMode: 'override', participantIds: ['kayla'] });
  const ids = M.resolveParticipants(card, sampleStudents(), sampleGroups());
  assert.deepEqual(ids, ['kayla']);
});

test('Optional/not-this-year may have selected or no participants', () => {
  const withNone = M.makeCard({ participantMode: 'optional', participantIds: [] });
  const withSome = M.makeCard({ participantMode: 'optional', participantIds: ['charis'] });
  assert.deepEqual(M.resolveParticipants(withNone, sampleStudents(), sampleGroups()), []);
  assert.deepEqual(M.resolveParticipants(withSome, sampleStudents(), sampleGroups()), ['charis']);
});

// ---------------------------------------------------------------------------
// Student Lens
// ---------------------------------------------------------------------------
test('Student Lens: selected student sees Together work', () => {
  const cards = [M.makeCard({ id: 'c1', participantMode: 'together' })];
  const matches = M.getCardsForStudent(cards, 'kayla', sampleStudents(), sampleGroups());
  assert.equal(matches.length, 1);
});

test('Student Lens: selected student sees group work', () => {
  const cards = [M.makeCard({ id: 'c1', participantMode: 'group', participantIds: ['older'] })];
  const matchesLucy = M.getCardsForStudent(cards, 'lucy', sampleStudents(), sampleGroups());
  const matchesCharis = M.getCardsForStudent(cards, 'charis', sampleStudents(), sampleGroups());
  assert.equal(matchesLucy.length, 1);
  assert.equal(matchesCharis.length, 0);
});

test('Student Lens: selected student sees co-op work', () => {
  const cards = [M.makeCard({ id: 'c1', participantMode: 'coop', participantIds: ['jeremiah'] })];
  const matches = M.getCardsForStudent(cards, 'jeremiah', sampleStudents(), sampleGroups());
  assert.equal(matches.length, 1);
});

test('Student Lens: selected student sees individual work', () => {
  const cards = [M.makeCard({ id: 'c1', participantMode: 'individual', participantIds: ['kayla'] })];
  const matches = M.getCardsForStudent(cards, 'kayla', sampleStudents(), sampleGroups());
  assert.equal(matches.length, 1);
});

test('Student Lens: selected student does not see unrelated sibling work', () => {
  const cards = [M.makeCard({ id: 'c1', participantMode: 'individual', participantIds: ['kayla'] })];
  const matches = M.getCardsForStudent(cards, 'charis', sampleStudents(), sampleGroups());
  assert.equal(matches.length, 0);
});

// ---------------------------------------------------------------------------
// Loops
// ---------------------------------------------------------------------------
test('turns/week belongs to the loop, not the loop item', () => {
  const loop = M.makeLoop({ turnsPerWeek: 3 });
  const item = M.makeLoopItem({ loopId: loop.id });
  assert.equal(loop.turnsPerWeek, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(item, 'turnsPerWeek'), false);
});

test('loop item has its own resource and next assignment', () => {
  const item = M.makeLoopItem({ resourceUseIds: ['ruse_1'], nextAssignment: 'Genesis 1' });
  assert.deepEqual(item.resourceUseIds, ['ruse_1']);
  assert.equal(item.nextAssignment, 'Genesis 1');
});

test('advancing loop changes current item without losing item progress', () => {
  const loop = M.makeLoop({ itemIds: ['a', 'b', 'c'], currentItemId: 'a' });
  const item = M.makeLoopItem({ id: 'a', progressCursor: 5, nextAssignment: 'ch. 6' });
  const advanced = M.advanceLoop(loop);
  assert.equal(advanced.currentItemId, 'b');
  // the loop item itself is untouched by advancing the loop's cursor
  assert.equal(item.progressCursor, 5);
  assert.equal(item.nextAssignment, 'ch. 6');
});

test('advanceLoop wraps around at the end', () => {
  const loop = M.makeLoop({ itemIds: ['a', 'b', 'c'], currentItemId: 'c' });
  const advanced = M.advanceLoop(loop);
  assert.equal(advanced.currentItemId, 'a');
});

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------
test('only one current item resolves from resolveSequenceProgress', () => {
  const items = [
    M.makeSequenceItem({ id: '1', position: 0, status: 'completed' }),
    M.makeSequenceItem({ id: '2', position: 1, status: 'current' }),
    M.makeSequenceItem({ id: '3', position: 2, status: 'upcoming' })
  ];
  const progress = M.resolveSequenceProgress(items);
  assert.equal(progress.current.id, '2');
  assert.equal(progress.completed.length, 1);
  assert.equal(progress.upcoming.length, 1);
});

test('completed/current/upcoming statuses work', () => {
  const items = [
    M.makeSequenceItem({ id: '1', position: 0, status: 'completed' }),
    M.makeSequenceItem({ id: '2', position: 1, status: 'completed' }),
    M.makeSequenceItem({ id: '3', position: 2, status: 'upcoming' }),
    M.makeSequenceItem({ id: '4', position: 3, status: 'upcoming' })
  ];
  const progress = M.resolveSequenceProgress(items);
  assert.equal(progress.completed.length, 2);
  assert.equal(progress.current.id, '3');
  assert.equal(progress.upcoming.length, 1);
});

test('current sequence item can provide a Today assignment later', () => {
  const items = [M.makeSequenceItem({ id: '1', position: 0, status: 'current', nextAssignment: 'p.12-24' })];
  const progress = M.resolveSequenceProgress(items);
  assert.equal(progress.current.nextAssignment, 'p.12-24');
});

test('advanceSequence completes current and promotes next upcoming to current', () => {
  const items = [
    M.makeSequenceItem({ id: '1', position: 0, status: 'current' }),
    M.makeSequenceItem({ id: '2', position: 1, status: 'upcoming' }),
    M.makeSequenceItem({ id: '3', position: 2, status: 'upcoming' })
  ];
  const advanced = M.advanceSequence(items);
  assert.equal(advanced.find(i => i.id === '1').status, 'completed');
  assert.equal(advanced.find(i => i.id === '2').status, 'current');
  assert.equal(advanced.find(i => i.id === '3').status, 'upcoming');
});

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------
test('resource and resource use are separate concepts', () => {
  const resource = M.makeResource({ id: 'r1', title: 'Bible' });
  const use = M.makeResourceUse({ resourceId: 'r1', participantsOverride: ['charis'] });
  assert.notEqual(resource.id, use.id);
  assert.equal(use.resourceId, resource.id);
});

test('same resource can appear in multiple uses without duplicating the resource card', () => {
  const resources = [M.makeResource({ id: 'bible', title: 'Bible' })];
  const uses = [
    M.makeResourceUse({ resourceId: 'bible', participantsOverride: ['charis', 'kayla'], usedIn: 'Bible Loop' }),
    M.makeResourceUse({ resourceId: 'bible', participantsOverride: ['jeremiah'], usedIn: 'Personal Spiritual Reading' })
  ];
  const rollup = M.buildResourceRollup(resources, uses);
  assert.equal(rollup.length, 1);
  assert.equal(rollup[0].uses.length, 2);
});

test('resource rollup preserves who/where/how context per use', () => {
  const resources = [M.makeResource({ id: 'bible', title: 'Bible' })];
  const uses = [M.makeResourceUse({ resourceId: 'bible', participantsOverride: ['jeremiah'], scheduleSummary: '2x/week', nextAssignment: 'Psalm 1' })];
  const rollup = M.buildResourceRollup(resources, uses);
  assert.equal(rollup[0].uses[0].scheduleSummary, '2x/week');
  assert.equal(rollup[0].uses[0].nextAssignment, 'Psalm 1');
});

test('resources can group by subject', () => {
  const resources = [M.makeResource({ id: 'r1' }), M.makeResource({ id: 'r2' })];
  const uses = [
    M.makeResourceUse({ resourceId: 'r1', subjectColumnId: 'bible' }),
    M.makeResourceUse({ resourceId: 'r2', subjectColumnId: 'history' })
  ];
  const rollup = M.buildResourceRollup(resources, uses);
  const grouped = M.groupResourcesBySubject(rollup);
  assert.equal(grouped.bible.length, 1);
  assert.equal(grouped.history.length, 1);
});

test('resources can group by student', () => {
  const resources = [M.makeResource({ id: 'r1' })];
  const uses = [M.makeResourceUse({ resourceId: 'r1', participantsOverride: ['lucy', 'jeremiah'] })];
  const rollup = M.buildResourceRollup(resources, uses);
  const grouped = M.groupResourcesByStudent(rollup);
  assert.equal(grouped.lucy.length, 1);
  assert.equal(grouped.jeremiah.length, 1);
});

// ---------------------------------------------------------------------------
// ResourceUse participant derivation (no drift from parent)
// ---------------------------------------------------------------------------
test('ResourceUse derives participants from parent card by default', () => {
  const card = M.makeCard({ id: 'card1', participantMode: 'group', participantIds: ['older'] });
  const use = M.makeResourceUse({ resourceId: 'r1', cardId: 'card1' });
  const context = { cards: [card], students: sampleStudents(), groups: sampleGroups() };
  const resolved = M.resolveResourceUseParticipants(use, context);
  assert.deepEqual(resolved.sort(), ['jeremiah', 'lucy']);
});

test('ResourceUse derives participants from loop/sequence context when applicable', () => {
  const loop = M.makeLoop({ id: 'loop1', participantMode: 'together' });
  const sequence = M.makeSequence({ id: 'seq1', participantMode: 'individual', participantIds: ['kayla'] });
  const loopUse = M.makeResourceUse({ resourceId: 'r1', loopId: 'loop1' });
  const seqUse = M.makeResourceUse({ resourceId: 'r2', sequenceId: 'seq1' });
  const context = { loops: [loop], sequences: [sequence], students: sampleStudents(), groups: sampleGroups() };
  assert.deepEqual(M.resolveResourceUseParticipants(loopUse, context).sort(), ['charis', 'jeremiah', 'kayla', 'lucy']);
  assert.deepEqual(M.resolveResourceUseParticipants(seqUse, context), ['kayla']);
});

test('ResourceUse explicit participant override wins over parent derivation', () => {
  const card = M.makeCard({ id: 'card1', participantMode: 'group', participantIds: ['older'] }); // Lucy + Jeremiah
  const use = M.makeResourceUse({ resourceId: 'r1', cardId: 'card1', participantsOverride: ['jeremiah'] });
  const context = { cards: [card], students: sampleStudents(), groups: sampleGroups() };
  const resolved = M.resolveResourceUseParticipants(use, context);
  assert.deepEqual(resolved, ['jeremiah']);
});

test('Resource rollup uses resolved participants, not stale duplicated participant data', () => {
  // The card includes both Lucy and Jeremiah. The stored ResourceUse has no
  // override at all — it must reflect both, not whatever (if anything) was
  // ever separately and possibly incorrectly stored on the use.
  const card = M.makeCard({ id: 'card1', participantMode: 'group', participantIds: ['older'] });
  const resources = [M.makeResource({ id: 'spine', title: 'American History Spine' })];
  const uses = [M.makeResourceUse({ resourceId: 'spine', cardId: 'card1' })];
  const context = { cards: [card], students: sampleStudents(), groups: sampleGroups() };
  const rollup = M.buildResourceRollup(resources, uses, context);
  assert.deepEqual(rollup[0].uses[0].participants.sort(), ['jeremiah', 'lucy']);
});

test('resources can group by status', () => {
  const resources = [M.makeResource({ id: 'r1', status: 'have-it' }), M.makeResource({ id: 'r2', status: 'need-to-buy' })];
  const rollup = M.buildResourceRollup(resources, []);
  const grouped = M.groupResourcesByStatus(rollup);
  assert.equal(grouped['have-it'].length, 1);
  assert.equal(grouped['need-to-buy'].length, 1);
});

test('"Need to choose resource" is missing/undecided but not "need to get"', () => {
  const resource = M.makeResource({ id: 'r1', status: 'need-to-choose' });
  assert.equal(M.resourceMatchesNeedToGet(resource), false);
  assert.equal(M.resourceMatchesMissing(resource), true);
});

test('"No resource needed" is excluded from shopping/missing lists by default', () => {
  const rollup = M.buildResourceRollup([M.makeResource({ id: 'r1', status: 'no-resource' })], []);
  assert.equal(M.filterResourceRollup(rollup, 'need-to-get').length, 0);
  assert.equal(M.filterResourceRollup(rollup, 'missing').length, 0);
  // still shows up in the full/all view
  assert.equal(M.filterResourceRollup(rollup, 'all').length, 1);
});

// ---------------------------------------------------------------------------
// Mixed-age lesson time
// ---------------------------------------------------------------------------
test('group lesson defaults to youngest participant max', () => {
  const rule = M.makeMixedAgeTimeRule({ mode: 'youngest' });
  const minutes = M.resolveMixedAgeLessonMinutes(rule, ['form1', 'form2']);
  assert.equal(minutes, M.LESSON_TIME_GUARDRAILS.form1.max);
});

test('group with Form II + Form III uses Form II max by default', () => {
  const rule = M.makeMixedAgeTimeRule({ mode: 'youngest' });
  const minutes = M.resolveMixedAgeLessonMinutes(rule, ['form2', 'form3']);
  assert.equal(minutes, M.LESSON_TIME_GUARDRAILS.form2.max);
});

test('middle-child rule can be selected', () => {
  const rule = M.makeMixedAgeTimeRule({ mode: 'middle' });
  const minutes = M.resolveMixedAgeLessonMinutes(rule, ['form1', 'form2', 'form3']);
  assert.equal(minutes, M.LESSON_TIME_GUARDRAILS.form2.max);
});

test('manual override wins over youngest/middle rules', () => {
  const rule = M.makeMixedAgeTimeRule({ mode: 'manual', manualMinutes: 27 });
  const minutes = M.resolveMixedAgeLessonMinutes(rule, ['form1', 'form3']);
  assert.equal(minutes, 27);
});

test('older student extension work can attach separately without inflating shared lesson length', () => {
  const rule = M.makeMixedAgeTimeRule({ mode: 'youngest' });
  const sharedMinutes = M.resolveMixedAgeLessonMinutes(rule, ['form2', 'form3']);
  const ext = M.makeExtensionWork({ studentId: 'jeremiah', minutes: 15 });
  assert.equal(sharedMinutes, M.LESSON_TIME_GUARDRAILS.form2.max);
  assert.equal(ext.minutes, 15);
  assert.notEqual(ext.minutes, sharedMinutes);
});

test('shared lesson time does not inflate to oldest student max', () => {
  const rule = M.makeMixedAgeTimeRule({ mode: 'youngest' });
  const minutes = M.resolveMixedAgeLessonMinutes(rule, ['form1', 'form3']);
  assert.notEqual(minutes, M.LESSON_TIME_GUARDRAILS.form3.max);
  assert.equal(minutes, M.LESSON_TIME_GUARDRAILS.form1.max);
});

// ---------------------------------------------------------------------------
// Print settings
// ---------------------------------------------------------------------------
test('Book & Resource List defaults to portrait', () => {
  assert.equal(M.printOrientationForMode('resources'), 'portrait');
});

test('map views default to landscape', () => {
  assert.equal(M.printOrientationForMode('overview'), 'landscape');
  assert.equal(M.printOrientationForMode('detailed'), 'landscape');
  assert.equal(M.printOrientationForMode('student'), 'landscape');
});

test('Student overview can include/exclude Together, Group, Co-op, Individual, Optional', () => {
  const settings = M.makePrintSettings({ includedAudienceCategories: ['individual'] });
  assert.deepEqual(settings.includedAudienceCategories, ['individual']);
});

test('resource list can group by subject, student, or status', () => {
  const resources = [M.makeResource({ id: 'r1' })];
  const uses = [M.makeResourceUse({ resourceId: 'r1', subjectColumnId: 'bible', participantsOverride: ['kayla'] })];
  const rollup = M.buildResourceRollup(resources, uses);
  assert.ok(M.groupResources(rollup, 'subject').bible);
  assert.ok(M.groupResources(rollup, 'student').kayla);
  assert.ok(M.groupResources(rollup, 'status'));
});

// ---------------------------------------------------------------------------
// Age-stage templates
// ---------------------------------------------------------------------------
test('Form I hard max = 20', () => {
  assert.equal(M.LESSON_TIME_GUARDRAILS.form1.hardMax, 20);
});
test('Form II hard max = 30', () => {
  assert.equal(M.LESSON_TIME_GUARDRAILS.form2.hardMax, 30);
});
test('Form III hard max = 45', () => {
  assert.equal(M.LESSON_TIME_GUARDRAILS.form3.hardMax, 45);
});

test('starter card can include time metadata', () => {
  const tpl = M.makeStarterTemplate({ suggestedLessonTimeConfig: M.lessonTimeConfigFromGradeBand('form2') });
  assert.equal(tpl.suggestedLessonTimeConfig.maxMinutes, 30);
});

test('starter card can be recommended/optional/not-usually-yet by age-stage', () => {
  const tpl = M.makeAgeStageTemplate({ applicability: 'not-usually-yet' });
  assert.equal(tpl.applicability, 'not-usually-yet');
  assert.ok(M.AGE_STAGE_APPLICABILITY.indexOf('not-usually-yet') > -1);
});

test('defaultAgeStageTemplates carries literal guardrails per band', () => {
  const templates = M.defaultAgeStageTemplates();
  const form3 = templates.find(t => t.gradeBand === 'form3');
  assert.equal(form3.hardMaxMinutes, 45);
  assert.equal(form3.extensionWorkMayApply, true);
});

// ---------------------------------------------------------------------------
// Deployment-neutral / static-web-friendly sanity checks
// ---------------------------------------------------------------------------
test('module exposes no browser globals (document/window/localStorage untouched)', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof window, 'undefined');
  assert.equal(typeof localStorage, 'undefined');
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log('  ok - ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL - ' + name);
    console.log('    ' + (err && err.message ? err.message : err));
  }
}
console.log('');
console.log(passed + ' passed, ' + failed + ' failed, ' + tests.length + ' total');
if (failed > 0) process.exit(1);
