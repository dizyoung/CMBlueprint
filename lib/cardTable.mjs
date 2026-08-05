// Card Table prototype — pure, DOM-free model + logic.
//
// This module is deliberately isolated from the production planner: it never
// imports lib/persistence.mjs, lib/familyMap*.mjs, or anything that touches
// `window`/`localStorage`. It can therefore be unit-tested under plain `node`,
// and it can never read or write the parent's real Setup/Feast plan.
//
// The idea it exists to prove: a parent can pick up physical index cards for
// each Form's subject, put them on top of one another to say "these are taught
// together", fan them out to say "shared instruction with Form-specific
// extension", drop the whole pile into a loop, and slide book cards underneath
// either the whole pile (shared) or one card (Form-specific).
//
// Vocabulary rules baked into the logic (not the UI):
//   * A stack holds card ID references — never copies of card data.
//   * Loop membership is independent of stack membership.
//   * A resource has at most one target: a stack (shared) XOR a card
//     (Form-specific). Both null means it is sitting in the tray.
//   * Only one stack can be expanded at a time.
//   * A stack that would drop to a single card DISSOLVES back to a loose card.

export const CARD_TABLE_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Small helpers. Every exported operation is non-mutating: it returns a new
// state object, so a caller can never accidentally half-apply a change.
// ---------------------------------------------------------------------------

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

// Accepts `{}`, `null`, a partly-damaged object, or a good state, and always
// returns a shape every other function in this file can safely walk.
export function normalizeState(state) {
  var s = state && typeof state === 'object' ? state : {};
  return {
    schemaVersion: CARD_TABLE_SCHEMA_VERSION,
    cards: arr(s.cards).filter(isObject).map(normalizeCard),
    stacks: arr(s.stacks).filter(isObject).map(normalizeStack),
    loops: arr(s.loops).filter(isObject).map(function (l) {
      return { id: String(l.id), label: String(l.label == null ? '' : l.label) };
    }),
    resources: arr(s.resources).filter(isObject).map(normalizeResource)
  };
}

function isObject(v) {
  return !!v && typeof v === 'object';
}

function normalizeCard(c, i) {
  return {
    id: String(c.id),
    subjectLabel: String(c.subjectLabel == null ? '' : c.subjectLabel),
    formLabel: c.formLabel == null ? '' : String(c.formLabel),
    stackId: c.stackId == null ? null : String(c.stackId),
    loopId: c.loopId == null ? null : String(c.loopId),
    order: typeof c.order === 'number' ? c.order : i
  };
}

function normalizeStack(s) {
  var rel = s.relationship === 'layered' ? 'layered' : 'together';
  return {
    id: String(s.id),
    subjectLabel: String(s.subjectLabel == null ? '' : s.subjectLabel),
    cardIds: arr(s.cardIds).map(String),
    relationship: rel,
    loopId: s.loopId == null ? null : String(s.loopId),
    expanded: s.expanded === true
  };
}

function normalizeResource(r) {
  // A damaged payload could claim both targets. Shared wins, so a
  // Form-specific book can never silently leak into the shared area.
  var toStack = r.attachedToStackId == null ? null : String(r.attachedToStackId);
  var toCard = r.attachedToCardId == null ? null : String(r.attachedToCardId);
  if (toStack && toCard) toCard = null;
  return {
    id: String(r.id),
    title: String(r.title == null ? '' : r.title),
    attachedToStackId: toStack,
    attachedToCardId: toCard
  };
}

export function findCard(state, cardId) {
  return arr(state && state.cards).find(function (c) { return c.id === cardId; }) || null;
}
export function findStack(state, stackId) {
  return arr(state && state.stacks).find(function (s) { return s.id === stackId; }) || null;
}
export function findResource(state, resourceId) {
  return arr(state && state.resources).find(function (r) { return r.id === resourceId; }) || null;
}
export function findLoop(state, loopId) {
  return arr(state && state.loops).find(function (l) { return l.id === loopId; }) || null;
}

export function cardsInStack(state, stackId) {
  var st = findStack(state, stackId);
  if (!st) return [];
  return st.cardIds.map(function (id) { return findCard(state, id); }).filter(Boolean);
}

export function looseCards(state) {
  return arr(state && state.cards).filter(function (c) { return !c.stackId; });
}

export function trayResources(state) {
  return arr(state && state.resources).filter(function (r) {
    return !r.attachedToStackId && !r.attachedToCardId;
  });
}

export function sharedResources(state, stackId) {
  return arr(state && state.resources).filter(function (r) { return r.attachedToStackId === stackId; });
}

export function resourcesForCard(state, cardId) {
  return arr(state && state.resources).filter(function (r) { return r.attachedToCardId === cardId; });
}

// Cards in a pile always read in table order (Form I, then II, then III), so
// the staggered edges of a `layered` pile match how a parent lays them down.
function orderedCardIds(state, ids) {
  return ids.slice().sort(function (a, b) {
    var ca = findCard(state, a);
    var cb = findCard(state, b);
    return (ca ? ca.order : 0) - (cb ? cb.order : 0);
  });
}

var idCounter = 0;
function nextId(prefix) {
  idCounter += 1;
  return prefix + '-' + Date.now().toString(36) + '-' + idCounter.toString(36);
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function buildDefaultCardTableState() {
  return {
    schemaVersion: CARD_TABLE_SCHEMA_VERSION,
    cards: [
      { id: 'card-form1-science', subjectLabel: 'Science', formLabel: 'Form I', stackId: null, loopId: null, order: 0 },
      { id: 'card-form2-science', subjectLabel: 'Science', formLabel: 'Form II', stackId: null, loopId: null, order: 1 },
      { id: 'card-form3-science', subjectLabel: 'Science', formLabel: 'Form III', stackId: null, loopId: null, order: 2 },
      { id: 'card-nature-walk', subjectLabel: 'Nature Walk', formLabel: '', stackId: null, loopId: null, order: 3 },
      { id: 'card-special-studies', subjectLabel: 'Special Studies', formLabel: '', stackId: null, loopId: null, order: 4 },
      { id: 'card-natural-history', subjectLabel: 'Natural History', formLabel: '', stackId: null, loopId: null, order: 5 }
    ],
    stacks: [],
    loops: [
      { id: 'loop-thinking', label: 'Thinking' },
      { id: 'loop-beauty', label: 'Beauty' }
    ],
    resources: [
      { id: 'res-handbook', title: 'Handbook of Nature Study', attachedToStackId: null, attachedToCardId: null },
      { id: 'res-exploring', title: 'Exploring Nature With Children', attachedToStackId: null, attachedToCardId: null },
      { id: 'res-readaloud', title: 'Shared science read-aloud', attachedToStackId: null, attachedToCardId: null },
      { id: 'res-form3-text', title: 'Form III science text', attachedToStackId: null, attachedToCardId: null }
    ]
  };
}

// ---------------------------------------------------------------------------
// Stack operations
// ---------------------------------------------------------------------------

// Drag card A onto card B. Both become one object. The new stack inherits the
// loop of the card being dropped on, if it had one — a pile put down inside a
// loop stays in that loop.
export function createStackFromCards(state, cardIdA, cardIdB, options) {
  var s = normalizeState(state);
  var a = findCard(s, cardIdA);
  var b = findCard(s, cardIdB);
  if (!a || !b || a.id === b.id) return s;
  // Dragging a card that is already stacked: pull it out first.
  if (a.stackId) s = removeCardFromStack(s, a.id);
  if (b.stackId) {
    // Dropping onto a stacked card means "add to that stack".
    return addCardToStack(s, a.id, findCard(s, b.id).stackId);
  }
  a = findCard(s, cardIdA);
  b = findCard(s, cardIdB);
  var opts = options || {};
  var stack = {
    id: opts.id || nextId('stack'),
    subjectLabel: opts.subjectLabel || b.subjectLabel || a.subjectLabel,
    cardIds: orderedCardIds(s, [b.id, a.id]),
    relationship: opts.relationship === 'layered' ? 'layered' : 'together',
    loopId: opts.loopId !== undefined ? opts.loopId : (b.loopId || a.loopId || null),
    expanded: false
  };
  s.stacks = s.stacks.concat([stack]);
  s.cards = s.cards.map(function (c) {
    if (c.id === a.id || c.id === b.id) {
      // The card's own loopId is cleared: a stacked card's placement is
      // governed by its stack, so leaving a stale value here would be a
      // second, silently disagreeing source of truth.
      return Object.assign({}, c, { stackId: stack.id, loopId: null });
    }
    return c;
  });
  return s;
}

export function addCardToStack(state, cardId, stackId) {
  var s = normalizeState(state);
  var card = findCard(s, cardId);
  var stack = findStack(s, stackId);
  if (!card || !stack) return s;
  if (card.stackId === stackId) return s;
  if (card.stackId) s = removeCardFromStack(s, cardId);
  s.stacks = s.stacks.map(function (st) {
    if (st.id !== stackId) return st;
    if (st.cardIds.indexOf(cardId) !== -1) return st;
    return Object.assign({}, st, { cardIds: orderedCardIds(s, st.cardIds.concat([cardId])) });
  });
  s.cards = s.cards.map(function (c) {
    return c.id === cardId ? Object.assign({}, c, { stackId: stackId, loopId: null }) : c;
  });
  return s;
}

// Drag a card out of a stack. It becomes loose again and lands in the loop the
// stack was sitting in, which is what the parent just saw on the table.
// If that leaves a single card behind, the stack dissolves: one card is not a
// pile, and leaving a one-card "stack" on the table would be a lie.
export function removeCardFromStack(state, cardId) {
  var s = normalizeState(state);
  var card = findCard(s, cardId);
  if (!card || !card.stackId) return s;
  var stack = findStack(s, card.stackId);
  if (!stack) {
    s.cards = s.cards.map(function (c) { return c.id === cardId ? Object.assign({}, c, { stackId: null }) : c; });
    return s;
  }
  var stackLoopId = stack.loopId;
  var remaining = stack.cardIds.filter(function (id) { return id !== cardId; });

  s.cards = s.cards.map(function (c) {
    return c.id === cardId ? Object.assign({}, c, { stackId: null, loopId: stackLoopId }) : c;
  });
  // Any Form-specific resources stay with the card that leaves — that is the
  // whole point of a Form-specific attachment.

  if (remaining.length >= 2) {
    s.stacks = s.stacks.map(function (st) {
      return st.id === stack.id ? Object.assign({}, st, { cardIds: remaining }) : st;
    });
    return s;
  }

  // Dissolve.
  var survivorId = remaining[0] || null;
  s.cards = s.cards.map(function (c) {
    return c.id === survivorId ? Object.assign({}, c, { stackId: null, loopId: stackLoopId }) : c;
  });
  s.stacks = s.stacks.filter(function (st) { return st.id !== stack.id; });
  // Shared resources had nothing left to be shared between, so they go back to
  // the tray rather than vanishing.
  s.resources = s.resources.map(function (r) {
    return r.attachedToStackId === stack.id
      ? Object.assign({}, r, { attachedToStackId: null, attachedToCardId: null })
      : r;
  });
  return s;
}

export function setStackRelationship(state, stackId, relationship) {
  var s = normalizeState(state);
  var rel = relationship === 'layered' ? 'layered' : 'together';
  s.stacks = s.stacks.map(function (st) {
    return st.id === stackId ? Object.assign({}, st, { relationship: rel }) : st;
  });
  return s;
}

// Moving the pile never disturbs what is in it.
export function moveStackToLoop(state, stackId, loopId) {
  var s = normalizeState(state);
  s.stacks = s.stacks.map(function (st) {
    return st.id === stackId ? Object.assign({}, st, { loopId: loopId == null ? null : String(loopId) }) : st;
  });
  return s;
}

export function moveCardToLoop(state, cardId, loopId) {
  var s = normalizeState(state);
  var card = findCard(s, cardId);
  if (!card) return s;
  // A stacked card follows its stack; move the stack instead, so the pile
  // never silently splits.
  if (card.stackId) return moveStackToLoop(s, card.stackId, loopId);
  s.cards = s.cards.map(function (c) {
    return c.id === cardId ? Object.assign({}, c, { loopId: loopId == null ? null : String(loopId) }) : c;
  });
  return s;
}

// Only one pile can be open on the table at a time.
export function setStackExpanded(state, stackId, expanded) {
  var s = normalizeState(state);
  var want = expanded !== false;
  s.stacks = s.stacks.map(function (st) {
    if (st.id === stackId) return Object.assign({}, st, { expanded: want });
    return want ? Object.assign({}, st, { expanded: false }) : st;
  });
  return s;
}

export function collapseAllStacks(state) {
  var s = normalizeState(state);
  s.stacks = s.stacks.map(function (st) { return Object.assign({}, st, { expanded: false }); });
  return s;
}

// ---------------------------------------------------------------------------
// Resource operations — at most one target, always.
// ---------------------------------------------------------------------------

export function attachResourceToStack(state, resourceId, stackId) {
  var s = normalizeState(state);
  if (!findStack(s, stackId)) return s;
  s.resources = s.resources.map(function (r) {
    return r.id === resourceId
      ? Object.assign({}, r, { attachedToStackId: String(stackId), attachedToCardId: null })
      : r;
  });
  return s;
}

export function attachResourceToCard(state, resourceId, cardId) {
  var s = normalizeState(state);
  if (!findCard(s, cardId)) return s;
  s.resources = s.resources.map(function (r) {
    return r.id === resourceId
      ? Object.assign({}, r, { attachedToStackId: null, attachedToCardId: String(cardId) })
      : r;
  });
  return s;
}

export function detachResource(state, resourceId) {
  var s = normalizeState(state);
  s.resources = s.resources.map(function (r) {
    return r.id === resourceId
      ? Object.assign({}, r, { attachedToStackId: null, attachedToCardId: null })
      : r;
  });
  return s;
}

// ---------------------------------------------------------------------------
// Derived summary for the collapsed view. Everything the parent needs to read
// a closed pile at a glance, and nothing else.
//
// `unresolvedCount` = decisions still owed on this pile:
//   + 1 if the stack itself has no loop yet
//   + 1 for each card in the stack that has no resource of its own AND the
//     stack has no shared resource either (nothing to read from).
// Tray resources are counted separately, at table level, by
// summarizeTable(), because they belong to no pile.
// ---------------------------------------------------------------------------

export function summarizeStack(state, stackId) {
  var s = normalizeState(state);
  var stack = findStack(s, stackId);
  if (!stack) return null;
  var cards = cardsInStack(s, stackId);
  var loop = stack.loopId ? findLoop(s, stack.loopId) : null;
  var shared = sharedResources(s, stackId);
  var formSpecific = s.resources.filter(function (r) {
    return r.attachedToCardId && stack.cardIds.indexOf(r.attachedToCardId) !== -1;
  });

  var unresolved = 0;
  if (!stack.loopId) unresolved += 1;
  if (shared.length === 0) {
    cards.forEach(function (c) {
      if (resourcesForCard(s, c.id).length === 0) unresolved += 1;
    });
  }

  return {
    stackId: stack.id,
    subjectLabel: stack.subjectLabel,
    forms: cards.map(function (c) { return c.formLabel || c.subjectLabel; }),
    cardIds: stack.cardIds.slice(),
    relationship: stack.relationship,
    relationshipLabel: stack.relationship === 'layered' ? 'Layered' : 'Together',
    loopId: stack.loopId,
    loopLabel: loop ? loop.label : 'No loop yet',
    sharedResourceCount: shared.length,
    formSpecificResourceCount: formSpecific.length,
    unresolvedCount: unresolved,
    expanded: stack.expanded
  };
}

export function summarizeTable(state) {
  var s = normalizeState(state);
  var stacks = s.stacks.map(function (st) { return summarizeStack(s, st.id); });
  var loose = looseCards(s);
  var tray = trayResources(s);
  var unresolved = stacks.reduce(function (n, x) { return n + x.unresolvedCount; }, 0) +
    loose.filter(function (c) { return !c.loopId; }).length +
    tray.length;
  return {
    stacks: stacks,
    looseCardCount: loose.length,
    trayResourceCount: tray.length,
    unresolvedCount: unresolved
  };
}

// ---------------------------------------------------------------------------
// Serialization. Tolerant on the way in, strict on the way out.
// ---------------------------------------------------------------------------

export function serializeCardTableState(state) {
  return JSON.stringify(normalizeState(state));
}

// Never throws. A damaged, truncated, or foreign payload yields the defaults,
// so a parent can always keep working.
export function deserializeCardTableState(json) {
  if (typeof json !== 'string' || !json.trim()) {
    return { state: buildDefaultCardTableState(), source: 'default' };
  }
  var parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { state: buildDefaultCardTableState(), source: 'default-after-damage', reason: 'the saved table could not be read' };
  }
  if (!isObject(parsed) || !Array.isArray(parsed.cards) || !Array.isArray(parsed.loops)) {
    return { state: buildDefaultCardTableState(), source: 'default-after-damage', reason: 'the saved table was incomplete' };
  }
  if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > CARD_TABLE_SCHEMA_VERSION) {
    return { state: buildDefaultCardTableState(), source: 'default-after-damage', reason: 'the saved table came from a newer version' };
  }
  return { state: normalizeState(parsed), source: 'saved' };
}

export function clonePlain(state) {
  return clone(normalizeState(state));
}
