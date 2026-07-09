// Family School Map — shared pure data model + helper logic.
//
// Phase 0 scope only: data shapes and pure helper functions for the Family
// School Map prototype concepts (Student, Group, SubjectColumn, Card, Loop,
// Sequence, Resource/ResourceUse, StarterTemplate, AgeStageTemplate, lesson
// time + mixed-age rules, print settings, resource rollups, student lens).
//
// Dependency-free and pure (no DOM, no localStorage, no fetch) so it can run
// unmodified under plain `node` and stays deployment-neutral: it does not
// know or care whether it ends up bundled for GitHub Pages, Vercel, Netlify,
// or a custom domain. Persistence/import-export/accounts are intentionally
// NOT implemented here yet — only kept possible by making everything plain,
// serializable JSON-compatible objects.
//
// UI-facing naming note: internal type names here (Card, ResourceUse,
// ScheduleConfig, AgeStageTemplate, ...) are implementation language. The
// user-facing app should say "card", "Book & Resource List", "Who is this
// for?", etc. — never expose internal field/type names in UI copy, and never
// show the word "Direct" to a parent.

export function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

// Grade/form bands. "custom" lets a family describe a band that doesn't fit
// the three CM Forms (e.g. preschool, or a non-standard older-student track).
export const GRADE_BANDS = [
  { id: 'form1', label: 'Grades 1–3 / Form I' },
  { id: 'form2', label: 'Grades 4–6 / Form II' },
  { id: 'form3', label: 'Grades 7–9 / Form III' },
  { id: 'form4', label: 'Grades 10–12 / Form IV+' },
  { id: 'custom', label: 'Custom' }
];

// Lesson-length guardrails per band, adapted from broad PNEU timetable patterns.
// In CM/PNEU practice lessons stop at time — the hardMax is the ceiling, not a
// target to fill. min is the minimum useful session; target equals hardMax here
// so no strange exact numbers appear in the UI. All values are editable.
// Primary source: Charlotte Mason Poetry / Parents' Union School time tables.
// Adapted (not copied) for a modern home setting.
export const LESSON_TIME_GUARDRAILS = {
  form1: { min: 15, target: 20, max: 20, hardMax: 20 },
  form2: { min: 20, target: 30, max: 30, hardMax: 30 },
  form3: { min: 30, target: 45, max: 45, hardMax: 45 },
  form4: { min: 45, target: 60, max: 60, hardMax: 60 }
};

// Human-readable range label for a grade-band's lesson-length guardrail.
// Returns strings like "15–20 min" suitable for parent-facing display.
export function lessonLengthRangeLabel(gradeBand) {
  var g = LESSON_TIME_GUARDRAILS[gradeBand];
  if (!g) return '';
  if (g.min && g.min !== g.max) return g.min + '–' + g.max + ' min';
  return 'up to ' + g.max + ' min';
}

// Resource = the book/material itself.
export const RESOURCE_TYPES = ['book', 'lesson-book', 'practice', 'website', 'external', 'no-resource', 'other'];

// Resource status. "need-to-choose" is intentionally distinct from
// "need-to-buy": you cannot buy or reserve a resource you haven't chosen yet.
export const RESOURCE_STATUSES = [
  'have-it', 'need-to-choose', 'need-to-buy', 'need-library', 'reserved-library',
  'ordered', 'borrowed', 'digital', 'coop-provided', 'no-resource', 'undecided'
];

export const LOOP_MOM_NEEDED_OPTIONS = [
  { value: 'yes', label: 'Mom reads / leads' },
  { value: 'nearby', label: 'Mom nearby' },
  { value: 'no', label: 'Fully independent' }
];

export const LOOP_ATTENTION_TYPES = [
  { value: 'read-aloud', label: 'Read-aloud (Mom reads)' },
  { value: 'guided', label: 'Guided (Mom helps)' },
  { value: 'independent', label: 'Independent' },
  { value: 'listen', label: 'Listen (audio/music)' },
  { value: 'look', label: 'Look / observe' }
];

export const RHYTHM_STATUS_LABELS = {
  'placed': 'In weekly rhythm',
  'covered-by-loop': 'Covered by a loop',
  'not-in-rhythm': 'Not in weekly rhythm yet'
};

export const RESOURCE_STATUS_LABELS = {
  'have-it': 'Have it',
  'need-to-choose': 'Need to choose resource',
  'need-to-buy': 'Need to buy',
  'need-library': 'Need to reserve at library',
  'reserved-library': 'Reserved at library',
  ordered: 'Ordered, not arrived',
  borrowed: 'Borrowed',
  digital: 'Digital / online',
  'coop-provided': 'Provided by co-op',
  'no-resource': 'No resource needed',
  undecided: 'Maybe / undecided'
};

// Audience: where a card/loop/sequence lives on the map (row placement).
// Distinct from "participants", which is who actually does the work.
export const AUDIENCE_TYPES = ['together', 'group', 'individual', 'coop-outside', 'optional', 'unplaced'];

// Planning status — describes the planning decision for a work item/card.
// Separate from card.status (which controls the map row) and from resource
// coverage (which is derived from linked Resource/ResourceUse data).
// 'active'         → included in the current year's plan
// 'optional'       → included if time / interest allows
// 'not-this-year'  → skipped for this year; kept for reference
// 'co-op-external' → taught by a co-op or outside provider
// 'practice-no-book' → skill practice; no book/resource needed
export const PLANNING_STATUSES = ['active', 'optional', 'not-this-year', 'co-op-external', 'practice-no-book'];

export const PLANNING_STATUS_LABELS = {
  'active': 'Active',
  'optional': 'Optional',
  'not-this-year': 'Not this year',
  'co-op-external': 'Co-op / External',
  'practice-no-book': 'Practice'
};

// Coverage status — derived (never stored) from a card's linked Resource and
// ResourceUse objects. Kept separate from planningStatus to avoid conflation.
// 'covered'          → all linked resources have status 'have-it'
// 'needs-books'      → at least one resource needs buying
// 'need-to-choose'   → at least one resource is undecided/need-to-choose
// 'no-resource-needed' → card has no-resource type resources, or planningStatus
//                        is practice-no-book and no uses exist
// 'not-tracked'      → no ResourceUse links to this card
// 'partial'          → mixed statuses (some have-it, some not)
export const COVERAGE_STATUSES = ['covered', 'needs-books', 'need-to-choose', 'no-resource-needed', 'not-tracked', 'partial'];

export const SCHEDULE_STYLE_SUGGESTIONS = ['fixed', 'loop', 'fixed-or-loop', 'family-rhythm', 'seasonal', 'co-op-external', 'manual'];
export const SCHEDULE_STYLE_SUGGESTION_LABELS = {
  'fixed': 'Fixed rhythm',
  'loop': 'Loop-friendly',
  'fixed-or-loop': 'Fixed or loop',
  'family-rhythm': 'Family rhythm',
  'seasonal': 'Seasonal',
  'co-op-external': 'Co-op / External',
  'manual': 'As scheduled'
};

export const COVERAGE_STATUS_LABELS = {
  'covered': 'Covered',
  'needs-books': 'Needs books',
  'need-to-choose': 'Need to choose',
  'no-resource-needed': 'No resource needed',
  'not-tracked': 'No resource tracked',
  'partial': 'Partially covered'
};

// Derive a card's coverage status from its linked ResourceUse + Resource data.
// Pure function — never mutates.
export function deriveCoverageStatus(card, resourceUses, resources) {
  var planningStatus = card.planningStatus || 'active';
  var cardUses = (resourceUses || []).filter(function (u) { return u.cardId === card.id; });
  if (!cardUses.length) {
    return planningStatus === 'practice-no-book' ? 'no-resource-needed' : 'not-tracked';
  }
  var cardResources = cardUses.map(function (u) {
    return (resources || []).find(function (r) { return r.id === u.resourceId; });
  }).filter(Boolean);
  if (!cardResources.length) return 'not-tracked';
  if (cardResources.every(function (r) { return r.type === 'no-resource' || r.status === 'no-resource'; })) {
    return 'no-resource-needed';
  }
  if (cardResources.some(function (r) { return r.status === 'need-to-choose' || r.status === 'undecided'; })) {
    return 'need-to-choose';
  }
  if (cardResources.some(function (r) { return r.status === 'need-to-buy'; })) {
    return 'needs-books';
  }
  if (cardResources.every(function (r) { return r.status === 'have-it'; })) {
    return 'covered';
  }
  return 'partial';
}

// Parent-facing schedule modes (UI copy) mapped to stable internal `mode`
// values. Never render the internal value or the word "Direct" in the UI.
export const SCHEDULE_MODE_LABELS = {
  weekly: 'A few times each week',
  'fixed-days': 'On certain days',
  loop: 'As part of a loop',
  sequence: 'One after another',
  practice: 'Practice habit',
  coop: 'Handled outside home',
  manual: 'Keep on the map only'
};
export const SCHEDULE_MODES = Object.keys(SCHEDULE_MODE_LABELS);

export const SEQUENCE_ITEM_STATUSES = ['completed', 'current', 'upcoming', 'skipped'];

export const PRINT_MODES = ['overview', 'student', 'detailed', 'resources'];
export const PRINT_ORIENTATION = { overview: 'landscape', student: 'landscape', detailed: 'landscape', resources: 'portrait' };

export const RESOURCE_GROUP_BY = ['subject', 'student', 'status'];

// Resource-list filters. Keep "need-to-choose" out of pure shopping lists
// (you can't buy/reserve a resource you haven't chosen) but include it in
// "missing/undecided". Keep "no-resource" out of both by default.
export const RESOURCE_FILTERS = ['all', 'need-to-get', 'missing', 'one-student', 'one-subject'];

const SHOPPING_STATUSES = ['need-to-buy', 'need-library', 'ordered'];
const MISSING_STATUSES = ['need-to-choose', 'undecided', 'need-to-buy', 'need-library'];

export function resourceMatchesNeedToGet(resource) {
  return SHOPPING_STATUSES.indexOf(resource.status) > -1;
}
export function resourceMatchesMissing(resource) {
  return MISSING_STATUSES.indexOf(resource.status) > -1;
}
export function resourceIsNoResourceNeeded(resource) {
  return resource.status === 'no-resource';
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------
export function makeStudent(fields) {
  return Object.assign({
    id: newId('stu'),
    name: '',
    initials: '',
    color: '#888888',
    active: true,
    sortOrder: 0,
    grade: '',
    gradeBand: 'form1', // form1 | form2 | form3 | custom
    ageStageLabel: '',
    notes: ''
  }, fields);
}

// ---------------------------------------------------------------------------
// Group (custom, editable groupings of students)
// ---------------------------------------------------------------------------
export function makeGroup(fields) {
  return Object.assign({
    id: newId('grp'),
    label: '',
    studentIds: [],
    colorMode: 'auto', // auto | explicit color below
    color: null,
    active: true,
    sortOrder: 0,
    notes: ''
  }, fields);
}

// ---------------------------------------------------------------------------
// SubjectColumn / SubjectFamily
// ---------------------------------------------------------------------------
export function makeSubjectColumn(fields) {
  return Object.assign({
    id: newId('subj'),
    label: '',
    color: '#888888',
    visible: true,
    sortOrder: 0,
    notes: ''
  }, fields);
}

// ---------------------------------------------------------------------------
// ScheduleConfig
// ---------------------------------------------------------------------------
export function makeScheduleConfig(fields) {
  return Object.assign({
    mode: 'weekly', // see SCHEDULE_MODES
    timesPerWeek: null,
    daysOfWeek: [],
    loopId: null,
    sequenceId: null,
    showOnToday: true,
    spreadEvenly: true,
    avoidDays: [],
    outsideProvider: '',
    outsideLocation: '',
    outsideTime: '',
    notes: ''
  }, fields);
}

export function scheduleModeLabel(mode) {
  return SCHEDULE_MODE_LABELS[mode] || mode;
}

// ---------------------------------------------------------------------------
// LessonTimeConfig
// ---------------------------------------------------------------------------
export function makeLessonTimeConfig(fields) {
  return Object.assign({
    minMinutes: null,
    targetMinutes: null,
    maxMinutes: null,
    hardMaxMinutes: null,
    sessionsPerWeek: null,
    totalWeeklyMinutes: null,
    timeOwnership: 'parent-led', // parent-led | independent | shared | extension
    narrationIncluded: 'varies', // yes | no | varies
    notes: ''
  }, fields);
}

// Build a LessonTimeConfig pre-filled from a grade-band's literal guardrail,
// so a starter template/card can start from a sane default and still be
// freely overridden by the parent.
export function lessonTimeConfigFromGradeBand(gradeBand, overrides) {
  var g = LESSON_TIME_GUARDRAILS[gradeBand];
  if (!g) return makeLessonTimeConfig(overrides);
  return makeLessonTimeConfig(Object.assign({
    minMinutes: g.min, targetMinutes: g.target, maxMinutes: g.max, hardMaxMinutes: g.hardMax
  }, overrides));
}

// ---------------------------------------------------------------------------
// ExtensionWork — older-student extension attached to a shared/group card or
// resource use, without inflating the shared lesson length.
// ---------------------------------------------------------------------------
export function makeExtensionWork(fields) {
  return Object.assign({
    id: newId('ext'),
    parentCardId: null,
    parentResourceUseId: null,
    studentId: null,
    title: '',
    resourceUseIds: [],
    minutes: null,
    scheduleConfig: null,
    isNarrationOrWrittenWork: false,
    notes: ''
  }, fields);
}

// ---------------------------------------------------------------------------
// MixedAgeTimeRule
// ---------------------------------------------------------------------------
export const MIXED_AGE_RULE_MODES = ['youngest', 'middle', 'manual'];

export function makeMixedAgeTimeRule(fields) {
  return Object.assign({
    mode: 'youngest', // youngest (default) | middle | manual
    manualMinutes: null,
    notes: ''
  }, fields);
}

// Resolve the shared lesson length in minutes for a group of participating
// students, given each student's grade band, per the chosen rule. Defaults to
// the youngest participant's guardrail max — per direct product guidance,
// shared lessons should be sized to the youngest (or, optionally, the middle)
// child, with older students doing additional work via ExtensionWork instead
// of stretching the shared lesson.
export function resolveMixedAgeLessonMinutes(rule, studentGradeBands) {
  rule = rule || makeMixedAgeTimeRule();
  if (rule.mode === 'manual') return rule.manualMinutes;
  var maxes = studentGradeBands
    .map(function (band) { return LESSON_TIME_GUARDRAILS[band] ? LESSON_TIME_GUARDRAILS[band].max : null; })
    .filter(function (m) { return m != null; });
  if (maxes.length === 0) return null;
  if (rule.mode === 'middle') {
    var sorted = maxes.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor((sorted.length - 1) / 2)];
  }
  // default: youngest participant -> smallest guardrail max
  return Math.min.apply(Math, maxes);
}

// ---------------------------------------------------------------------------
// Resource & ResourceUse
// ---------------------------------------------------------------------------
export function makeResource(fields) {
  return Object.assign({
    id: newId('res'),
    title: '',
    author: '',
    type: 'book', // see RESOURCE_TYPES
    status: 'undecided', // see RESOURCE_STATUSES
    notes: '',
    source: '',
    copyCount: null
  }, fields);
}

// IMPORTANT — participants on a ResourceUse are derived, not duplicated data.
// A ResourceUse should NOT carry its own independently-maintained participant
// list that can drift from the card/loop/sequence/extension work it belongs
// to (e.g. a card with Lucy + Jeremiah should never have its linked
// ResourceUse silently say "Jeremiah only"). By default, participants are
// resolved at read-time from whichever parent the use is linked to (cardId,
// loopId, sequenceId, or extensionWorkId) via resolveResourceUseParticipants()
// below. `participantsOverride` exists ONLY for the rare case a parent
// intentionally wants to narrow/widen the resource's actual audience (e.g. a
// shared card where only one of the two participants actually touches this
// particular resource) — when present and non-empty, it wins over derivation.
// `audience` follows the same override-vs-derive convention for print/rollup
// grouping purposes (together/group/individual/coop-outside/optional).
export function makeResourceUse(fields) {
  return Object.assign({
    id: newId('ruse'),
    resourceId: null,
    audience: 'together', // see AUDIENCE_TYPES; override-able, otherwise derive from parent
    participantsOverride: null, // null = derive from parent; non-empty array = explicit override that wins
    subjectColumnId: null,
    cardId: null,
    loopId: null,
    loopItemId: null,
    sequenceId: null,
    sequenceItemId: null,
    extensionWorkId: null,
    coopRef: null,
    optionalRef: null,
    scheduleSummary: '',
    nextAssignment: '',
    progressCursor: null,
    notes: ''
  }, fields);
}

// Resolve the actual participants for a ResourceUse. Explicit override always
// wins; otherwise participants are derived from whichever parent the use is
// linked to:
//   cardId           -> resolveParticipants(card, ...)
//   loopId/loopItemId -> resolveParticipants(loop, ...)  (loop items don't carry their own audience)
//   sequenceId/sequenceItemId -> resolveParticipants(sequence, ...)
//   extensionWorkId  -> [extensionWork.studentId] (extension work is always single-student)
// `context` holds the lookup collections needed to resolve a parent:
// { cards, loops, sequences, extensionWorks, students, groups }. Returns []
// if the use has no override and no resolvable parent.
export function resolveResourceUseParticipants(use, context) {
  context = context || {};
  if (Array.isArray(use.participantsOverride) && use.participantsOverride.length) {
    return use.participantsOverride.slice();
  }
  var students = context.students || [];
  var groups = context.groups || [];
  if (use.cardId) {
    var card = (context.cards || []).find(function (c) { return c.id === use.cardId; });
    if (card) return resolveParticipants(card, students, groups);
  }
  if (use.loopId) {
    var loop = (context.loops || []).find(function (l) { return l.id === use.loopId; });
    if (loop) return resolveParticipants(loop, students, groups);
  }
  if (use.sequenceId) {
    var sequence = (context.sequences || []).find(function (s) { return s.id === use.sequenceId; });
    if (sequence) return resolveParticipants(sequence, students, groups);
  }
  if (use.extensionWorkId) {
    var ext = (context.extensionWorks || []).find(function (e) { return e.id === use.extensionWorkId; });
    if (ext && ext.studentId) return [ext.studentId];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Card (internal type name: PlanCard) — the core planning card on the map.
// ---------------------------------------------------------------------------
export function makeCard(fields) {
  return Object.assign({
    id: newId('card'),
    title: '',
    subjectColumnId: null,
    audience: 'together', // see AUDIENCE_TYPES
    participantMode: 'together', // together | group | individual | coop | optional | override
    participantIds: [],
    status: 'active', // active | optional | coop | unplaced — controls map row placement
    planningStatus: 'active', // see PLANNING_STATUSES — planning decision, separate from map placement
    formApplicability: [], // [] = all forms; otherwise array of gradeBand ids: ['form1','form2','form3']
    suggestedWeeklyTouches: null, // parent-facing frequency hint, e.g. 'daily', '2–3x/week', '1x/week', 'loop', 'seasonal'
    scheduleStyleSuggestion: null, // 'fixed' | 'loop' | 'fixed-or-loop' | 'family-rhythm' | 'seasonal' | 'co-op-external' | 'manual'
    mapGroup: null, // display-only grouping hint for Map view — e.g. 'Beauty Loop', 'History Cycle'; null = show individually
    strandLabels: null, // explicit parent-facing map labels, e.g. ['American History Spine','American History Story']; null = auto-derive from resources/loop/sequence
    scheduleConfig: makeScheduleConfig(),
    resourceUseIds: [],
    loopId: null,
    sequenceId: null,
    extensionWorkIds: [],
    lessonTimeConfig: makeLessonTimeConfig(),
    notes: '',
    sortOrder: 0,
    sourceTemplateId: null
  }, fields);
}

// ---------------------------------------------------------------------------
// Loop / LoopItem — turns/week belongs to the loop, not the loop item.
// ---------------------------------------------------------------------------
export function makeLoop(fields) {
  return Object.assign({
    id: newId('loop'),
    title: '',
    subjectColumnId: null,
    audience: 'together',
    participantMode: 'together',
    participantIds: [],
    turnsPerWeek: 1,
    itemIds: [],
    currentItemId: null,
    advanceMode: 'on-check', // on-check | per-scheduled-day | manual
    scheduleConfig: makeScheduleConfig({ mode: 'loop' }),
    notes: '',
    sortOrder: 0,
    momNeeded: null,        // 'yes' | 'nearby' | 'no' | null
    approxTimeLabel: '',    // e.g. 'about 10–15 min'
    touchesPerWeek: null,   // number or null
    itemsPerTouch: 1,       // how many loop items per sitting
    kindOfAttention: null   // 'read-aloud' | 'guided' | 'independent' | 'listen' | 'look' | null
  }, fields);
}

export function makeLoopItem(fields) {
  return Object.assign({
    id: newId('litem'),
    loopId: null,
    title: '',
    resourceUseIds: [],
    nextAssignment: '',
    progressCursor: null,
    status: 'active',
    sortOrder: 0,
    notes: '',
    linkedCardId: null     // optional: links this loop item to a planned subject card
  }, fields);
}

// Advance a loop to its next item by itemIds order, wrapping around. Pure:
// returns a NEW loop object; does not mutate progress cursors on items (that
// is left to whatever updates the specific item's progressCursor/nextAssignment).
export function advanceLoop(loop) {
  var copy = Object.assign({}, loop);
  if (!loop.itemIds || loop.itemIds.length === 0) return copy;
  var idx = loop.itemIds.indexOf(loop.currentItemId);
  var nextIdx = idx === -1 ? 0 : (idx + 1) % loop.itemIds.length;
  copy.currentItemId = loop.itemIds[nextIdx];
  return copy;
}

// ---------------------------------------------------------------------------
// Sequence / SequenceItem — used / current / upcoming, one after another.
// ---------------------------------------------------------------------------
export function makeSequence(fields) {
  return Object.assign({
    id: newId('seq'),
    title: '',
    subjectColumnId: null,
    audience: 'together',
    participantMode: 'together',
    participantIds: [],
    itemIds: [],
    currentItemId: null,
    scheduleConfig: makeScheduleConfig({ mode: 'sequence' }),
    notes: '',
    sortOrder: 0
  }, fields);
}

export function makeSequenceItem(fields) {
  return Object.assign({
    id: newId('sitem'),
    sequenceId: null,
    title: '',
    resourceUseIds: [],
    status: 'upcoming', // see SEQUENCE_ITEM_STATUSES
    position: 0,
    nextAssignment: '',
    progressCursor: null,
    notes: ''
  }, fields);
}

// Given a sequence's items (in position order), return derived view info:
// the single current item (first with status 'current', else first
// 'upcoming'), plus completed/upcoming arrays. Pure / read-only.
export function resolveSequenceProgress(items) {
  var sorted = items.slice().sort(function (a, b) { return a.position - b.position; });
  var completed = sorted.filter(function (i) { return i.status === 'completed'; });
  var current = sorted.find(function (i) { return i.status === 'current'; }) ||
    sorted.find(function (i) { return i.status === 'upcoming'; }) || null;
  var upcoming = sorted.filter(function (i) { return i !== current && i.status !== 'completed' && i.status !== 'skipped'; });
  return { completed: completed, current: current, upcoming: upcoming };
}

// Advance a sequence: mark the current item completed and promote the next
// upcoming item to current. Pure: returns a NEW items array.
export function advanceSequence(items) {
  var sorted = items.slice().sort(function (a, b) { return a.position - b.position; });
  var curIdx = sorted.findIndex(function (i) { return i.status === 'current'; });
  return sorted.map(function (item, idx) {
    if (idx === curIdx) return Object.assign({}, item, { status: 'completed' });
    if (curIdx !== -1 && idx === curIdx + 1 && item.status === 'upcoming') return Object.assign({}, item, { status: 'current' });
    if (curIdx === -1 && idx === 0 && item.status === 'upcoming') return Object.assign({}, item, { status: 'current' });
    return item;
  });
}

// Reverse a sequence: move the current item back to upcoming and promote the
// previous completed item back to current. Pure: returns a NEW items array.
// No-ops (returns items unchanged, sorted) if already at the first item, so
// callers never need to guard against moving before the first item.
export function reverseSequence(items) {
  var sorted = items.slice().sort(function (a, b) { return a.position - b.position; });
  var curIdx = sorted.findIndex(function (i) { return i.status === 'current'; });
  if (curIdx === -1) {
    // Finished (no current item) — bring the last completed item back to current.
    var lastCompletedIdx = -1;
    sorted.forEach(function (item, idx) { if (item.status === 'completed') lastCompletedIdx = idx; });
    if (lastCompletedIdx === -1) return sorted;
    return sorted.map(function (item, idx) {
      return idx === lastCompletedIdx ? Object.assign({}, item, { status: 'current' }) : item;
    });
  }
  if (curIdx === 0) return sorted; // already at the first item
  return sorted.map(function (item, idx) {
    if (idx === curIdx) return Object.assign({}, item, { status: 'upcoming' });
    if (idx === curIdx - 1) return Object.assign({}, item, { status: 'current' });
    return item;
  });
}

// Auto-generate initials from a name (e.g. "Charis" -> "C", "Mary Jane" ->
// "MJ"), for the Learners UI's "auto-generated if possible" initials field.
export function autoInitials(name) {
  var parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ---------------------------------------------------------------------------
// Broad Charlotte Mason subject library + default visible map columns.
//
// CM defaults inspired by broad Charlotte Mason practice and historical PNEU
// time-table patterns (not any single modern provider's exact schedule or
// booklist). The library is intentionally richer than the columns a parent
// sees on the map by default — many library subjects (Hymn, Folk Song,
// Picture Study, Composer Study, ...) fold under one broad visible column
// (e.g. "Beauty / Riches") so the map itself stays manageable, while starter
// templates and the subject picker can still be specific underneath.
// ---------------------------------------------------------------------------
export const SUBJECT_LIBRARY = [
  { id: 'bible', label: 'Bible', column: 'bible' },
  { id: 'copywork', label: 'Copywork', column: 'language-arts' },
  { id: 'dictation', label: 'Dictation', column: 'language-arts' },
  { id: 'grammar', label: 'Grammar', column: 'language-arts' },
  { id: 'recitation', label: 'Recitation', column: 'language-arts' },
  { id: 'language-arts', label: 'Language Arts', column: 'language-arts' },
  { id: 'literature', label: 'Literature', column: 'literature' },
  { id: 'plutarch', label: 'Plutarch', column: 'literature' },
  { id: 'history', label: 'History', column: 'history' },
  { id: 'geography', label: 'Geography', column: 'geography' },
  { id: 'citizenship', label: 'Citizenship', column: 'geography' },
  { id: 'nature-study', label: 'Nature Study', column: 'science' },
  { id: 'science', label: 'Science', column: 'science' },
  { id: 'math', label: 'Math', column: 'math' },
  { id: 'hymn', label: 'Hymn', column: 'beauty' },
  { id: 'folk-song', label: 'Folk Song', column: 'beauty' },
  { id: 'picture-study', label: 'Picture Study', column: 'beauty' },
  { id: 'composer-study', label: 'Composer Study', column: 'beauty' },
  { id: 'poetry', label: 'Poetry', column: 'beauty' },
  { id: 'handicraft', label: 'Handicraft', column: 'arts' },
  { id: 'drawing', label: 'Drawing', column: 'arts' },
  { id: 'pe', label: 'PE / Health', column: 'pe' },
  { id: 'drill', label: 'Drill / Exercise', column: 'pe' },
  { id: 'foreign-language', label: 'Foreign Language', column: 'languages' }
];

// Broad, manageable default set of visible Family School Map columns. Most
// CM subjects above roll up under one of these by default; a parent can
// always add more columns or hide ones they don't use.
export const DEFAULT_VISIBLE_SUBJECT_COLUMNS = [
  { id: 'bible', label: 'Bible', color: '#d4537e' },
  { id: 'language-arts', label: 'Language Arts', color: '#378add' },
  { id: 'literature', label: 'Literature', color: '#7f77dd' },
  { id: 'history', label: 'History', color: '#a0622d' },
  { id: 'geography', label: 'Geography / Citizenship', color: '#3f9e6a' },
  { id: 'science', label: 'Science / Nature', color: '#639922' },
  { id: 'math', label: 'Math', color: '#555555' },
  { id: 'beauty', label: 'Beauty / Riches', color: '#c9608a' },
  { id: 'arts', label: 'Arts / Handicrafts', color: '#caa23c' },
  { id: 'pe', label: 'PE / Health', color: '#3c8fc9' },
  { id: 'languages', label: 'Languages', color: '#7a4fb5' },
  { id: 'custom', label: 'Custom', color: '#888888' }
];

// Parent-facing guidance for a lesson length given a learner's grade band.
// A guide, never a hard blocker — the hardMax guardrail is still surfaced as
// a suggestion to split the lesson or use extension work, not a rule the app
// enforces.
export function lessonLengthGuidance(gradeBand, minutes) {
  var g = LESSON_TIME_GUARDRAILS[gradeBand];
  if (!g || minutes == null) return { label: 'Suggested lesson length', isLong: false };
  if (minutes <= g.target) return { label: 'Usually short for this form', isLong: false };
  if (minutes <= g.hardMax) return { label: 'Suggested lesson length: about ' + g.hardMax + ' minutes for this form', isLong: false };
  return { label: 'This may be long for this form — consider splitting this or using extension work', isLong: true };
}

// ---------------------------------------------------------------------------
// StarterTemplate — editable Charlotte Mason-style suggestions, never
// mandatory curriculum.
// ---------------------------------------------------------------------------
// Human-readable label for a card's formApplicability array.
// [] or null => 'All forms'; otherwise a compact range label.
export function formApplicabilityLabel(formApplicability) {
  var fa = formApplicability || [];
  if (!fa.length) return 'All forms';
  var has1 = fa.indexOf('form1') > -1;
  var has2 = fa.indexOf('form2') > -1;
  var has3 = fa.indexOf('form3') > -1;
  var has4 = fa.indexOf('form4') > -1;
  if (has1 && has2 && has3 && has4) return 'All forms';
  if (has1 && has2 && has3 && !has4) return 'All forms';
  if (!has1 && !has2 && !has3 && has4) return 'Form IV+';
  if (has1 && has2 && !has3 && !has4) return 'Forms I–II';
  if (!has1 && has2 && has3 && !has4) return 'Forms II–III';
  if (!has1 && has2 && has3 && has4) return 'Forms II–IV+';
  if (!has1 && !has2 && has3 && has4) return 'Forms III–IV+';
  if (has1 && !has2 && has3 && !has4) return 'Forms I & III';
  if (has1 && !has2 && !has3 && !has4) return 'Form I';
  if (!has1 && has2 && !has3 && !has4) return 'Form II';
  if (!has1 && !has2 && has3 && !has4) return 'Form III+';
  return fa.join(', ');
}

export function makeStarterTemplate(fields) {
  return Object.assign({
    id: newId('tpl'),
    title: '',
    subjectColumnId: null,
    subjectLibraryId: null,
    category: 'core', // core | riches | skills | other — used to group starter cards so they stay browsable, not a curriculum warehouse
    suggestedAudience: 'together',
    suggestedParticipantMode: 'together',
    suggestedScheduleMode: 'weekly',
    suggestedResourceExpectation: 'book', // see RESOURCE_TYPES, or 'none'
    likelyLoop: false,
    likelySequence: false,
    likelyPracticeNoBook: false,
    suggestedLessonTimeConfig: null,
    ageStageApplicability: [], // array of gradeBand ids
    notes: '',
    tags: []
  }, fields);
}

// Broad, editable starter card library spanning multiple CM traditions
// (general CM practice, historical PNEU time-table patterns, and the kind of
// subjects common to AO/Wildwood/SCM-style plans) without integrating with,
// importing from, or being specific to any single provider. Grouped by
// category (core / riches / skills) and tagged by form, so the parent-facing
// UI can offer "Add core subjects" / "Add beauty & riches" / "Add skill
// subjects" / "a light full starter set" rather than one giant list.
export function defaultStarterTemplateLibrary() {
  var allForms = ['form1', 'form2', 'form3'];
  function tpl(fields) { return makeStarterTemplate(fields); }
  return [
    tpl({ id: 'tpl_bible', title: 'Bible', subjectColumnId: 'bible', subjectLibraryId: 'bible', category: 'core', ageStageApplicability: allForms }),
    tpl({ id: 'tpl_copywork', title: 'Copywork', subjectColumnId: 'language-arts', subjectLibraryId: 'copywork', category: 'skills', suggestedParticipantMode: 'individual', suggestedAudience: 'individual', ageStageApplicability: ['form1', 'form2'] }),
    tpl({ id: 'tpl_dictation', title: 'Dictation', subjectColumnId: 'language-arts', subjectLibraryId: 'dictation', category: 'skills', suggestedParticipantMode: 'individual', suggestedAudience: 'individual', ageStageApplicability: ['form2', 'form3'] }),
    tpl({ id: 'tpl_grammar', title: 'Grammar', subjectColumnId: 'language-arts', subjectLibraryId: 'grammar', category: 'skills', suggestedParticipantMode: 'individual', suggestedAudience: 'individual', ageStageApplicability: ['form2', 'form3'] }),
    tpl({ id: 'tpl_recitation', title: 'Recitation', subjectColumnId: 'language-arts', subjectLibraryId: 'recitation', category: 'riches', suggestedResourceExpectation: 'none', likelyPracticeNoBook: true, ageStageApplicability: allForms }),
    tpl({ id: 'tpl_literature', title: 'Literature', subjectColumnId: 'literature', subjectLibraryId: 'literature', category: 'core', likelySequence: true, ageStageApplicability: allForms }),
    tpl({ id: 'tpl_plutarch', title: 'Plutarch', subjectColumnId: 'literature', subjectLibraryId: 'plutarch', category: 'core', ageStageApplicability: ['form3'], tags: ['older-form-optional'] }),
    tpl({ id: 'tpl_history', title: 'History', subjectColumnId: 'history', subjectLibraryId: 'history', category: 'core', ageStageApplicability: allForms }),
    tpl({ id: 'tpl_geography', title: 'Geography', subjectColumnId: 'geography', subjectLibraryId: 'geography', category: 'core', ageStageApplicability: allForms }),
    tpl({ id: 'tpl_citizenship', title: 'Citizenship', subjectColumnId: 'geography', subjectLibraryId: 'citizenship', category: 'core', ageStageApplicability: ['form2', 'form3'] }),
    tpl({ id: 'tpl_naturestudy', title: 'Nature Study', subjectColumnId: 'science', subjectLibraryId: 'nature-study', category: 'core', suggestedResourceExpectation: 'none', likelyPracticeNoBook: true, ageStageApplicability: allForms }),
    tpl({ id: 'tpl_science', title: 'Science', subjectColumnId: 'science', subjectLibraryId: 'science', category: 'core', ageStageApplicability: ['form2', 'form3'] }),
    tpl({ id: 'tpl_math', title: 'Math', subjectColumnId: 'math', subjectLibraryId: 'math', category: 'core', suggestedParticipantMode: 'individual', suggestedAudience: 'individual', ageStageApplicability: allForms }),
    tpl({ id: 'tpl_hymn', title: 'Hymn', subjectColumnId: 'beauty', subjectLibraryId: 'hymn', category: 'riches', suggestedResourceExpectation: 'none', likelyLoop: true, ageStageApplicability: allForms }),
    tpl({ id: 'tpl_folksong', title: 'Folk Song', subjectColumnId: 'beauty', subjectLibraryId: 'folk-song', category: 'riches', suggestedResourceExpectation: 'none', likelyLoop: true, ageStageApplicability: allForms }),
    tpl({ id: 'tpl_picturestudy', title: 'Picture Study', subjectColumnId: 'beauty', subjectLibraryId: 'picture-study', category: 'riches', likelyLoop: true, ageStageApplicability: allForms }),
    tpl({ id: 'tpl_composerstudy', title: 'Composer Study', subjectColumnId: 'beauty', subjectLibraryId: 'composer-study', category: 'riches', suggestedResourceExpectation: 'none', likelyLoop: true, ageStageApplicability: allForms }),
    tpl({ id: 'tpl_poetry', title: 'Poetry', subjectColumnId: 'beauty', subjectLibraryId: 'poetry', category: 'riches', likelyLoop: true, ageStageApplicability: allForms }),
    tpl({ id: 'tpl_handicraft', title: 'Handicraft', subjectColumnId: 'arts', subjectLibraryId: 'handicraft', category: 'riches', suggestedResourceExpectation: 'none', ageStageApplicability: allForms }),
    tpl({ id: 'tpl_drawing', title: 'Drawing', subjectColumnId: 'arts', subjectLibraryId: 'drawing', category: 'riches', suggestedResourceExpectation: 'none', ageStageApplicability: allForms }),
    tpl({ id: 'tpl_pe', title: 'PE / Health', subjectColumnId: 'pe', subjectLibraryId: 'pe', category: 'skills', suggestedResourceExpectation: 'none', ageStageApplicability: allForms }),
    tpl({ id: 'tpl_foreignlanguage', title: 'Foreign Language', subjectColumnId: 'languages', subjectLibraryId: 'foreign-language', category: 'skills', suggestedParticipantMode: 'individual', suggestedAudience: 'individual', ageStageApplicability: ['form2', 'form3'] })
  ];
}

// ---------------------------------------------------------------------------
// AgeStageTemplate — literal time parameters + subject applicability per band.
// ---------------------------------------------------------------------------
export const AGE_STAGE_APPLICABILITY = ['recommended', 'optional', 'not-usually-yet'];

export function makeAgeStageTemplate(fields) {
  return Object.assign({
    id: newId('agetpl'),
    label: '',
    gradeBand: 'form1',
    suggestedSubjectIds: [],
    applicability: 'recommended', // see AGE_STAGE_APPLICABILITY
    minMinutes: null,
    targetMinutes: null,
    hardMaxMinutes: null,
    sessionsPerWeek: null,
    totalWeeklyMinutes: null,
    timeOwnership: 'parent-led', // parent-led | independent | shared
    usualGrouping: 'together', // together | group | individual
    usuallyNeedsResource: true,
    oftenInLoop: false,
    oftenInSequence: false,
    usuallyPracticeNoBook: false,
    showOnTodayByDefault: true,
    extensionWorkMayApply: false,
    notes: ''
  }, fields);
}

// Pre-built starter set of AgeStageTemplates, one per band, carrying the
// literal lesson-time guardrails. Loosely informed by general Charlotte
// Mason scheduling practice (e.g. AmblesideOnline's scheduling notes, Juniper
// Pines' Form I/II/III timetable articles) but NOT copied wholesale from any
// single provider — these are editable starting parameters, not a fixed table.
function ageStageTimeFields(guardrail) {
  return { minMinutes: guardrail.min, targetMinutes: guardrail.target, hardMaxMinutes: guardrail.hardMax };
}

export function defaultAgeStageTemplates() {
  return [
    makeAgeStageTemplate(Object.assign({ id: 'agetpl_form1', label: 'Grades 1–3 / Form I', gradeBand: 'form1' }, ageStageTimeFields(LESSON_TIME_GUARDRAILS.form1))),
    makeAgeStageTemplate(Object.assign({ id: 'agetpl_form2', label: 'Grades 4–6 / Form II', gradeBand: 'form2' }, ageStageTimeFields(LESSON_TIME_GUARDRAILS.form2))),
    makeAgeStageTemplate(Object.assign({ id: 'agetpl_form3', label: 'Grades 7–9 / Form III', gradeBand: 'form3', extensionWorkMayApply: true }, ageStageTimeFields(LESSON_TIME_GUARDRAILS.form3)))
  ];
}

// ---------------------------------------------------------------------------
// PrintSettings
// ---------------------------------------------------------------------------
export function makePrintSettings(fields) {
  return Object.assign({
    printMode: 'overview', // see PRINT_MODES
    selectedStudentId: null,
    includedAudienceCategories: ['together', 'group', 'coop-outside', 'individual'],
    selectedRowIds: [],
    selectedSubjectIds: [],
    compact: true,
    hideOptional: true,
    hideEmpty: true,
    resourceGroupBy: 'subject', // see RESOURCE_GROUP_BY
    resourceStatusFilter: 'all', // see RESOURCE_FILTERS
    resourceIncludeCategories: ['together', 'group', 'coop-outside', 'individual'],
    notes: ''
  }, fields);
}

export function printOrientationForMode(printMode) {
  return PRINT_ORIENTATION[printMode] || 'landscape';
}

// ---------------------------------------------------------------------------
// Participant resolution
// ---------------------------------------------------------------------------
// Resolve the actual student ids participating in a card/loop/sequence-like
// object ({participantMode, participantIds, audience}), given the family's
// full student/group lists. Explicit participantIds (when participantMode is
// 'override', or simply present and non-empty) always win over the mode's
// default resolution.
export function resolveParticipants(entity, students, groups) {
  if (entity.participantMode === 'override' && Array.isArray(entity.participantIds) && entity.participantIds.length) {
    return entity.participantIds.slice();
  }
  switch (entity.participantMode) {
    case 'together':
      return students.filter(function (s) { return s.active; }).map(function (s) { return s.id; });
    case 'group': {
      var group = groups.find(function (g) { return entity.participantIds.indexOf(g.id) > -1; }) ||
        groups.find(function (g) { return g.id === entity.groupId; });
      if (group) return group.studentIds.slice();
      // participantIds may already directly be a list of student ids for an ad-hoc group
      return (entity.participantIds || []).slice();
    }
    case 'individual':
      return (entity.participantIds || []).slice(0, 1);
    case 'coop':
      return (entity.participantIds || []).slice();
    case 'optional':
      return (entity.participantIds || []).slice();
    default:
      return (entity.participantIds || []).slice();
  }
}

// ---------------------------------------------------------------------------
// Student Lens helpers
// ---------------------------------------------------------------------------
function entityIncludesStudent(entity, studentId, students, groups) {
  var participants = resolveParticipants(entity, students, groups);
  return participants.indexOf(studentId) > -1;
}

export function getCardsForStudent(cards, studentId, students, groups) {
  return cards.filter(function (c) { return entityIncludesStudent(c, studentId, students, groups); });
}

export function getCardsForGroup(cards, groupId, groups) {
  var group = groups.find(function (g) { return g.id === groupId; });
  if (!group) return [];
  return cards.filter(function (c) {
    return c.participantMode === 'group' && (c.participantIds.indexOf(groupId) > -1 || c.groupId === groupId);
  });
}

export function getCardsForSubject(cards, subjectColumnId) {
  return cards.filter(function (c) { return c.subjectColumnId === subjectColumnId; });
}

export function getResourcesForStudent(resourceRollup, studentId) {
  return resourceRollup
    .map(function (r) {
      var uses = r.uses.filter(function (u) { return (u.participants || []).indexOf(studentId) > -1; });
      return uses.length ? Object.assign({}, r, { uses: uses }) : null;
    })
    .filter(Boolean);
}

// Scaffold only — Phase 0 intentionally does not compute real workload math.
// Returns the shape future UI can render against, with everything null/empty
// until Phase 1+ wires real computation.
export function getWorkloadForStudent(studentId) {
  return {
    studentId: studentId,
    totalWeeklyMinutes: null,
    minutesPerDay4Day: null,
    minutesPerDay5Day: null,
    parentLedMinutes: null,
    independentMinutes: null,
    sharedMinutes: null,
    extensionMinutes: null,
    cardsWithoutResources: null,
    cardsWithoutSchedule: null,
    lessonsOverSuggestedMax: null
  };
}

// ---------------------------------------------------------------------------
// Resource rollup
// ---------------------------------------------------------------------------
// Build a deduplicated resource list ({resource fields, uses: [ResourceUse]})
// from raw resources + resource uses. The same Resource may have multiple
// ResourceUses; this never creates a duplicate resource card for the same
// resourceId — every use is folded into that one resource's `uses` array.
//
// Each use's `participants` is always RESOLVED here (via
// resolveResourceUseParticipants), never read as stale stored data, so the
// rollup can't drift from the card/loop/sequence/extension work a use
// belongs to. Pass `context` ({ cards, loops, sequences, extensionWorks,
// students, groups }) so derivation has something to resolve against; if
// omitted, derived uses simply resolve to an empty participant list (only
// explicit participantsOverride values will show participants).
export function buildResourceRollup(resources, resourceUses, context) {
  var byId = {};
  resources.forEach(function (r) { byId[r.id] = Object.assign({}, r, { uses: [] }); });
  resourceUses.forEach(function (u) {
    if (!byId[u.resourceId]) return;
    var resolvedUse = Object.assign({}, u, { participants: resolveResourceUseParticipants(u, context) });
    byId[u.resourceId].uses.push(resolvedUse);
  });
  return Object.keys(byId).map(function (id) { return byId[id]; });
}

function audienceCategoryFromUse(use) {
  if (use.coopRef) return 'coop-outside';
  if (use.optionalRef) return 'optional';
  return use.audience || 'together';
}

export function resourceRollupMatchesIncludeCategories(resource, includeCategories) {
  if (!includeCategories || !includeCategories.length) return true;
  return resource.uses.some(function (u) { return includeCategories.indexOf(audienceCategoryFromUse(u)) > -1; });
}

export function resourceMatchesFilter(resource, filter, opts) {
  opts = opts || {};
  if (resourceIsNoResourceNeeded(resource) && filter !== 'all') return false;
  switch (filter) {
    case 'need-to-get':
      return resourceMatchesNeedToGet(resource);
    case 'missing':
      return resourceMatchesMissing(resource);
    case 'one-student':
      return resource.uses.some(function (u) { return (u.participants || []).indexOf(opts.studentId) > -1; });
    case 'one-subject':
      return resource.uses.some(function (u) { return u.subjectColumnId === opts.subjectColumnId; });
    default:
      return true;
  }
}

export function filterResourceRollup(rollup, filter, opts) {
  return rollup.filter(function (r) { return resourceMatchesFilter(r, filter, opts); });
}

export function groupResourcesBySubject(rollup) {
  var groups = {};
  rollup.forEach(function (r) {
    r.uses.forEach(function (u) {
      var key = u.subjectColumnId || 'unassigned';
      (groups[key] = groups[key] || []).push(r);
    });
  });
  return groups;
}

export function groupResourcesByStudent(rollup) {
  var groups = {};
  rollup.forEach(function (r) {
    r.uses.forEach(function (u) {
      (u.participants && u.participants.length ? u.participants : ['everyone']).forEach(function (sid) {
        (groups[sid] = groups[sid] || []).push(r);
      });
    });
  });
  return groups;
}

export function groupResourcesByStatus(rollup) {
  var groups = {};
  rollup.forEach(function (r) {
    (groups[r.status] = groups[r.status] || []).push(r);
  });
  return groups;
}

export function groupResources(rollup, groupBy) {
  if (groupBy === 'student') return groupResourcesByStudent(rollup);
  if (groupBy === 'status') return groupResourcesByStatus(rollup);
  return groupResourcesBySubject(rollup);
}

// ---------------------------------------------------------------------------
// Time guidance by form (CM/PNEU-inspired, parent-facing, editable)
// ---------------------------------------------------------------------------
export function makeTimeGuidanceByForm(overrides) {
  var defaults = {
    form1: { minutesMin: 10, minutesMax: 15, weeklyTouches: 3, label: '10–15 min · 3×/week' },
    form2: { minutesMin: 15, minutesMax: 20, weeklyTouches: 2, label: '15–20 min · 2×/week' },
    form3: { minutesMin: 20, minutesMax: 30, weeklyTouches: 1, label: '20–30 min · 1×/week' }
  };
  if (!overrides) return defaults;
  var result = {};
  ['form1', 'form2', 'form3'].forEach(function (f) {
    result[f] = Object.assign({}, defaults[f], overrides[f] || {});
  });
  return result;
}

// ---------------------------------------------------------------------------
// Resource pacing scaffold (for future Term Map capacity estimates)
// ---------------------------------------------------------------------------
export function makeResourcePacing(fields) {
  return Object.assign({
    totalUnits: null,
    unitType: 'chapters',
    unitsPerTouch: 1,
    estimatedMinutesPerTouch: null,
    termAssignment: 'unassigned',
    startUnit: null,
    endUnit: null
  }, fields);
}

export var RESOURCE_PACING_UNIT_TYPES = ['pages', 'chapters', 'lessons', 'scenes', 'poems', 'sessions', 'custom'];
export var TERM_ASSIGNMENT_OPTIONS = ['all-year', 'term1', 'term2', 'term3', 'spans-terms', 'unassigned'];
