import assert from 'node:assert/strict';
import * as CT from '../lib/cardTable.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const F1 = 'card-form1-science';
const F2 = 'card-form2-science';
const F3 = 'card-form3-science';
const NATURE = 'card-nature-walk';
const THINKING = 'loop-thinking';
const BEAUTY = 'loop-beauty';
const HANDBOOK = 'res-handbook';
const FORM3TEXT = 'res-form3-text';

function withStack() {
  const s = CT.createStackFromCards(CT.buildDefaultCardTableState(), F1, F2, { id: 'stack-science' });
  return s;
}

// 1 -------------------------------------------------------------------------
test('creating a stack from two cards puts both card IDs in the stack and stamps both cards', () => {
  const s = withStack();
  assert.equal(s.stacks.length, 1);
  const st = s.stacks[0];
  assert.deepEqual(st.cardIds.slice().sort(), [F1, F2].sort());
  assert.equal(CT.findCard(s, F1).stackId, st.id);
  assert.equal(CT.findCard(s, F2).stackId, st.id);
  // References only — no copied card data lives on the stack.
  st.cardIds.forEach((id) => assert.equal(typeof id, 'string'));
  assert.equal(st.subjectLabel, 'Science');
});

// 2 -------------------------------------------------------------------------
test('a third card can be added to an existing stack', () => {
  const s = CT.addCardToStack(withStack(), F3, 'stack-science');
  assert.deepEqual(CT.findStack(s, 'stack-science').cardIds.slice().sort(), [F1, F2, F3].sort());
  assert.equal(CT.findCard(s, F3).stackId, 'stack-science');
  assert.equal(CT.cardsInStack(s, 'stack-science').length, 3);
});

test('adding a card that is already in the stack changes nothing', () => {
  const once = CT.addCardToStack(withStack(), F3, 'stack-science');
  const twice = CT.addCardToStack(once, F3, 'stack-science');
  assert.deepEqual(twice, once);
});

// 3 -------------------------------------------------------------------------
test('relationship defaults to together and round-trips through layered and back', () => {
  let s = withStack();
  assert.equal(CT.findStack(s, 'stack-science').relationship, 'together');
  s = CT.setStackRelationship(s, 'stack-science', 'layered');
  assert.equal(CT.findStack(s, 'stack-science').relationship, 'layered');
  const json = CT.serializeCardTableState(s);
  assert.equal(CT.deserializeCardTableState(json).state.stacks[0].relationship, 'layered');
  s = CT.setStackRelationship(s, 'stack-science', 'together');
  assert.equal(CT.findStack(s, 'stack-science').relationship, 'together');
  // Nonsense falls back to the calm default rather than corrupting the pile.
  s = CT.setStackRelationship(s, 'stack-science', 'sideways');
  assert.equal(CT.findStack(s, 'stack-science').relationship, 'together');
});

test('summarizeStack reports Together / Layered in the parent\'s words', () => {
  let s = withStack();
  assert.equal(CT.summarizeStack(s, 'stack-science').relationshipLabel, 'Together');
  s = CT.setStackRelationship(s, 'stack-science', 'layered');
  assert.equal(CT.summarizeStack(s, 'stack-science').relationshipLabel, 'Layered');
});

// 4 -------------------------------------------------------------------------
test('removing one card from a three-card stack leaves the other two intact', () => {
  let s = CT.addCardToStack(withStack(), F3, 'stack-science');
  s = CT.removeCardFromStack(s, F2);
  const st = CT.findStack(s, 'stack-science');
  assert.deepEqual(st.cardIds.slice().sort(), [F1, F3].sort());
  assert.equal(CT.findCard(s, F2).stackId, null);
  // The other cards are still on the table, not deleted.
  assert.equal(s.cards.length, 6);
  assert.ok(CT.findCard(s, F1));
  assert.ok(CT.findCard(s, F3));
});

test('a stack that would drop to one card dissolves, and the survivor keeps the loop', () => {
  let s = CT.moveStackToLoop(withStack(), 'stack-science', BEAUTY);
  s = CT.removeCardFromStack(s, F1);
  assert.equal(s.stacks.length, 0, 'the one-card pile dissolved');
  assert.equal(CT.findCard(s, F1).stackId, null);
  assert.equal(CT.findCard(s, F2).stackId, null);
  assert.equal(CT.findCard(s, F1).loopId, BEAUTY);
  assert.equal(CT.findCard(s, F2).loopId, BEAUTY, 'the survivor stays where the parent last put the pile');
});

test('dissolving a stack returns its shared books to the tray rather than losing them', () => {
  let s = CT.attachResourceToStack(withStack(), HANDBOOK, 'stack-science');
  s = CT.removeCardFromStack(s, F1);
  const r = CT.findResource(s, HANDBOOK);
  assert.equal(r.attachedToStackId, null);
  assert.equal(r.attachedToCardId, null);
  assert.ok(CT.trayResources(s).some((x) => x.id === HANDBOOK));
});

test('a Form-specific book follows its card out of the pile', () => {
  let s = CT.addCardToStack(withStack(), F3, 'stack-science');
  s = CT.attachResourceToCard(s, FORM3TEXT, F3);
  s = CT.removeCardFromStack(s, F3);
  assert.equal(CT.findResource(s, FORM3TEXT).attachedToCardId, F3);
});

// 5 -------------------------------------------------------------------------
test('moving a whole stack between loops never changes its cardIds', () => {
  let s = CT.addCardToStack(withStack(), F3, 'stack-science');
  const before = CT.findStack(s, 'stack-science').cardIds.slice();
  s = CT.moveStackToLoop(s, 'stack-science', THINKING);
  assert.deepEqual(CT.findStack(s, 'stack-science').cardIds, before);
  s = CT.moveStackToLoop(s, 'stack-science', BEAUTY);
  assert.deepEqual(CT.findStack(s, 'stack-science').cardIds, before);
  assert.equal(CT.findStack(s, 'stack-science').loopId, BEAUTY);
  assert.equal(CT.cardsInStack(s, 'stack-science').length, 3);
});

// 6 -------------------------------------------------------------------------
test('loop membership is independent of stack membership', () => {
  // Moving the pile between loops leaves membership alone...
  let s = CT.moveStackToLoop(withStack(), 'stack-science', THINKING);
  const members = CT.findStack(s, 'stack-science').cardIds.slice();
  s = CT.moveStackToLoop(s, 'stack-science', BEAUTY);
  assert.deepEqual(CT.findStack(s, 'stack-science').cardIds, members);

  // ...and changing membership leaves the loop alone.
  let t = CT.addCardToStack(CT.moveStackToLoop(withStack(), 'stack-science', THINKING), F3, 'stack-science');
  assert.equal(CT.findStack(t, 'stack-science').loopId, THINKING);
  t = CT.removeCardFromStack(t, F3);
  assert.equal(CT.findStack(t, 'stack-science').loopId, THINKING, 'removing a card must not move the pile');
});

test('a loose card carries its own loopId; joining a pile hands placement to the pile', () => {
  let s = CT.moveCardToLoop(CT.buildDefaultCardTableState(), NATURE, THINKING);
  assert.equal(CT.findCard(s, NATURE).loopId, THINKING);
  assert.equal(CT.findCard(s, F1).loopId, null, 'other cards are unaffected');

  let t = CT.moveStackToLoop(withStack(), 'stack-science', BEAUTY);
  t = CT.addCardToStack(t, NATURE, 'stack-science');
  assert.equal(CT.findCard(t, NATURE).stackId, 'stack-science');
  assert.equal(CT.findCard(t, NATURE).loopId, null, 'a stacked card has no second, disagreeing loop');
  assert.equal(CT.findStack(t, 'stack-science').loopId, BEAUTY);
});

test('moving a stacked card to a loop moves the whole pile, never splitting it', () => {
  let s = CT.addCardToStack(withStack(), F3, 'stack-science');
  s = CT.moveCardToLoop(s, F2, THINKING);
  assert.equal(CT.findStack(s, 'stack-science').loopId, THINKING);
  assert.equal(CT.findStack(s, 'stack-science').cardIds.length, 3);
  assert.equal(CT.findCard(s, F2).stackId, 'stack-science');
});

// 7 -------------------------------------------------------------------------
test('a shared book sets attachedToStackId and leaves attachedToCardId null', () => {
  const s = CT.attachResourceToStack(withStack(), HANDBOOK, 'stack-science');
  const r = CT.findResource(s, HANDBOOK);
  assert.equal(r.attachedToStackId, 'stack-science');
  assert.equal(r.attachedToCardId, null);
  assert.deepEqual(CT.sharedResources(s, 'stack-science').map((x) => x.id), [HANDBOOK]);
});

// 8 -------------------------------------------------------------------------
test('a Form-specific book sets attachedToCardId only, and never both targets', () => {
  let s = CT.addCardToStack(withStack(), F3, 'stack-science');
  s = CT.attachResourceToCard(s, FORM3TEXT, F3);
  const r = CT.findResource(s, FORM3TEXT);
  assert.equal(r.attachedToCardId, F3);
  assert.equal(r.attachedToStackId, null);
  s.resources.forEach((x) => {
    assert.ok(!(x.attachedToStackId && x.attachedToCardId), x.title + ' must never have two homes');
  });
  assert.deepEqual(CT.resourcesForCard(s, F3).map((x) => x.id), [FORM3TEXT]);
  assert.deepEqual(CT.sharedResources(s, 'stack-science'), []);
});

// 9 -------------------------------------------------------------------------
test('reassigning a book shared <-> Form-specific always clears the other target', () => {
  let s = CT.attachResourceToStack(withStack(), HANDBOOK, 'stack-science');
  s = CT.attachResourceToCard(s, HANDBOOK, F1);
  assert.equal(CT.findResource(s, HANDBOOK).attachedToStackId, null);
  assert.equal(CT.findResource(s, HANDBOOK).attachedToCardId, F1);
  s = CT.attachResourceToStack(s, HANDBOOK, 'stack-science');
  assert.equal(CT.findResource(s, HANDBOOK).attachedToCardId, null);
  assert.equal(CT.findResource(s, HANDBOOK).attachedToStackId, 'stack-science');
});

test('a normalized payload claiming both targets is repaired to shared only', () => {
  const damaged = CT.buildDefaultCardTableState();
  damaged.resources[0].attachedToStackId = 'stack-science';
  damaged.resources[0].attachedToCardId = F1;
  const s = CT.normalizeState(damaged);
  assert.equal(s.resources[0].attachedToStackId, 'stack-science');
  assert.equal(s.resources[0].attachedToCardId, null);
});

// 10 ------------------------------------------------------------------------
test('detaching returns a book to the tray', () => {
  let s = CT.attachResourceToStack(withStack(), HANDBOOK, 'stack-science');
  assert.equal(CT.trayResources(s).length, 3);
  s = CT.detachResource(s, HANDBOOK);
  const r = CT.findResource(s, HANDBOOK);
  assert.equal(r.attachedToStackId, null);
  assert.equal(r.attachedToCardId, null);
  assert.equal(CT.trayResources(s).length, 4);
});

// 11 ------------------------------------------------------------------------
test('persistence round trip reproduces the state exactly', () => {
  let s = CT.addCardToStack(withStack(), F3, 'stack-science');
  s = CT.setStackRelationship(s, 'stack-science', 'layered');
  s = CT.moveStackToLoop(s, 'stack-science', BEAUTY);
  s = CT.attachResourceToStack(s, HANDBOOK, 'stack-science');
  s = CT.attachResourceToCard(s, FORM3TEXT, F3);
  s = CT.setStackExpanded(s, 'stack-science', true);
  const back = CT.deserializeCardTableState(CT.serializeCardTableState(s));
  assert.equal(back.source, 'saved');
  assert.deepEqual(back.state, CT.normalizeState(s));
  assert.deepEqual(back.state, s);
});

// 12 ------------------------------------------------------------------------
test('a damaged payload loads the defaults instead of throwing', () => {
  const cases = ['', 'not json at all', '{"cards":', '{"schemaVersion":1}', '[]', 'null'];
  for (const bad of cases) {
    const result = CT.deserializeCardTableState(bad);
    assert.ok(result.state, 'a state is always returned for: ' + bad);
    assert.deepEqual(result.state.cards.length, 6);
    assert.notEqual(result.source, 'saved');
  }
  // A payload from a newer version is refused rather than half-read.
  const future = JSON.stringify(Object.assign(CT.buildDefaultCardTableState(), { schemaVersion: 99 }));
  assert.equal(CT.deserializeCardTableState(future).source, 'default-after-damage');
  assert.deepEqual(CT.deserializeCardTableState(undefined).state, CT.buildDefaultCardTableState());
});

// 13 ------------------------------------------------------------------------
test('no operation touches production state or production storage keys', async () => {
  const writes = [];
  const store = {};
  globalThis.localStorage = {
    setItem(k, v) { writes.push(k); store[k] = v; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    removeItem(k) { writes.push(k); delete store[k]; }
  };
  try {
    const A = await import('../lib/familyMapAdapter.mjs');
    const sampleBefore = JSON.stringify(A.buildSampleAppState());

    let s = CT.buildDefaultCardTableState();
    s = CT.createStackFromCards(s, F1, F2, { id: 'stack-science' });
    s = CT.addCardToStack(s, F3, 'stack-science');
    s = CT.setStackRelationship(s, 'stack-science', 'layered');
    s = CT.moveStackToLoop(s, 'stack-science', THINKING);
    s = CT.moveStackToLoop(s, 'stack-science', BEAUTY);
    s = CT.moveCardToLoop(s, NATURE, THINKING);
    s = CT.attachResourceToStack(s, HANDBOOK, 'stack-science');
    s = CT.attachResourceToCard(s, FORM3TEXT, F3);
    s = CT.detachResource(s, HANDBOOK);
    s = CT.setStackExpanded(s, 'stack-science', true);
    s = CT.collapseAllStacks(s);
    s = CT.removeCardFromStack(s, F3);
    CT.summarizeTable(s);
    CT.serializeCardTableState(s);

    assert.deepEqual(writes, [], 'the pure model writes to no storage key at all');
    assert.equal(JSON.stringify(A.buildSampleAppState()), sampleBefore, 'the production sample state is unchanged');

    // The only key this prototype may ever write is its own.
    const { CARD_TABLE_STORAGE_KEY, CARD_TABLE_SAVED_AT_KEY, saveCardTableState } =
      await import('../docs/app/cardTableStore.mjs');
    assert.equal(CARD_TABLE_STORAGE_KEY, 'cmblueprint.cardTablePrototype.v1');
    assert.equal(saveCardTableState(s).ok, true);
    const unique = Array.from(new Set(writes)).sort();
    assert.deepEqual(unique, [CARD_TABLE_SAVED_AT_KEY, CARD_TABLE_STORAGE_KEY].sort());
    assert.ok(!unique.includes('cmblueprint.familySchoolMap.v1'));
  } finally {
    delete globalThis.localStorage;
  }
});

// 14 ------------------------------------------------------------------------
test('every default card and resource exists exactly once', () => {
  const s = CT.buildDefaultCardTableState();
  const cardLabels = s.cards.map((c) => (c.formLabel ? c.formLabel + ' ' : '') + c.subjectLabel);
  ['Form I Science', 'Form II Science', 'Form III Science', 'Nature Walk', 'Special Studies', 'Natural History']
    .forEach((label) => {
      assert.equal(cardLabels.filter((x) => x === label).length, 1, label + ' appears exactly once');
    });
  assert.equal(s.cards.length, 6);
  assert.equal(new Set(s.cards.map((c) => c.id)).size, 6, 'card ids are unique');

  const titles = s.resources.map((r) => r.title);
  ['Handbook of Nature Study', 'Exploring Nature With Children', 'Shared science read-aloud', 'Form III science text']
    .forEach((t) => assert.equal(titles.filter((x) => x === t).length, 1, t + ' appears exactly once'));
  assert.equal(s.resources.length, 4);
  assert.equal(new Set(s.resources.map((r) => r.id)).size, 4, 'resource ids are unique');

  assert.deepEqual(s.loops.map((l) => l.label), ['Thinking', 'Beauty']);
  assert.deepEqual(s.stacks, []);
  assert.equal(s.schemaVersion, CT.CARD_TABLE_SCHEMA_VERSION);
});

// 15 ------------------------------------------------------------------------
test('only one stack can be expanded at a time', () => {
  let s = CT.createStackFromCards(CT.buildDefaultCardTableState(), F1, F2, { id: 'stack-a' });
  s = CT.createStackFromCards(s, NATURE, 'card-special-studies', { id: 'stack-b' });
  s = CT.setStackExpanded(s, 'stack-a', true);
  assert.deepEqual(s.stacks.map((x) => x.expanded), [true, false]);
  s = CT.setStackExpanded(s, 'stack-b', true);
  assert.deepEqual(s.stacks.map((x) => x.expanded), [false, true]);
  s = CT.setStackExpanded(s, 'stack-b', false);
  assert.deepEqual(s.stacks.map((x) => x.expanded), [false, false]);
  assert.equal(CT.buildDefaultCardTableState().stacks.filter((x) => x.expanded).length, 0);
});

// 16 ------------------------------------------------------------------------
test('every function tolerates {} and missing arrays', () => {
  const empties = [{}, { cards: null }, { stacks: 'nope', resources: undefined }, null, undefined];
  for (const e of empties) {
    assert.doesNotThrow(() => {
      CT.normalizeState(e);
      CT.createStackFromCards(e, 'x', 'y');
      CT.addCardToStack(e, 'x', 'z');
      CT.removeCardFromStack(e, 'x');
      CT.setStackRelationship(e, 'z', 'layered');
      CT.moveStackToLoop(e, 'z', 'l');
      CT.moveCardToLoop(e, 'x', 'l');
      CT.attachResourceToStack(e, 'r', 'z');
      CT.attachResourceToCard(e, 'r', 'x');
      CT.detachResource(e, 'r');
      CT.setStackExpanded(e, 'z', true);
      CT.collapseAllStacks(e);
      CT.summarizeTable(e);
      CT.serializeCardTableState(e);
    }, 'input ' + JSON.stringify(e) + ' must not throw');
    const n = CT.normalizeState(e);
    assert.deepEqual(n.cards, []);
    assert.deepEqual(n.stacks, []);
    assert.deepEqual(n.resources, []);
    assert.deepEqual(n.loops, []);
  }
  assert.equal(CT.summarizeStack({}, 'nope'), null);
});

// summary --------------------------------------------------------------------
test('the collapsed summary says everything the parent needs and nothing more', () => {
  let s = CT.addCardToStack(withStack(), F3, 'stack-science');
  s = CT.setStackRelationship(s, 'stack-science', 'layered');
  s = CT.moveStackToLoop(s, 'stack-science', THINKING);
  s = CT.attachResourceToStack(s, HANDBOOK, 'stack-science');
  s = CT.attachResourceToCard(s, FORM3TEXT, F3);
  const sum = CT.summarizeStack(s, 'stack-science');
  assert.deepEqual(sum.forms, ['Form I', 'Form II', 'Form III']);
  assert.equal(sum.relationshipLabel, 'Layered');
  assert.equal(sum.loopLabel, 'Thinking');
  assert.equal(sum.sharedResourceCount, 1);
  assert.equal(sum.formSpecificResourceCount, 1);
  assert.equal(sum.unresolvedCount, 0, 'in a loop, with something to read — nothing left owed');
});

test('a pile with no loop and nothing to read counts as unresolved', () => {
  const s = withStack();
  const sum = CT.summarizeStack(s, 'stack-science');
  assert.equal(sum.loopLabel, 'No loop yet');
  assert.equal(sum.unresolvedCount, 3, 'no loop (1) + two cards with nothing to read (2)');
  const table = CT.summarizeTable(s);
  assert.equal(table.trayResourceCount, 4);
  assert.equal(table.looseCardCount, 4);
  assert.ok(table.unresolvedCount > sum.unresolvedCount);
});

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log('ok - ' + t.name);
    passed++;
  } catch (err) {
    console.log('FAIL - ' + t.name);
    console.log('  ' + (err && err.message ? err.message : err));
    failed++;
  }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
