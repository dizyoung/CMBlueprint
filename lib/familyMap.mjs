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
  { id: 'custom', label: 'Custom' }
];

// Literal lesson-length guardrails per band. Inspirational reference only —
// see AGE_STAGE_TEMPLATES below for the "do not copy a single provider's
// table wholesale" reminder. min/target/max are *suggestions*; hardMax is a
// guardrail a lesson should not exceed by default, not a target to fill.
export const LESSON_TIME_GUARDRAILS = {
  form1: { min: 15, target: 18, max: 20, hardMax: 20 },
  form2: { min: 20, target: 25, max: 30, hardMax: 30 },
  form3: { min: 30, target: 38, max: 45, hardMax: 45 }
};

// Resource = the book/material itself.
export const RESOURCE_TYPES = ['book', 'lesson-book', 'practice', 'website', 'external', 'no-resource', 'other'];

// Resource status. "need-to-choose" is intentionally distinct from
// "need-to-buy": you cannot buy or reserve a resource you haven't chosen yet.
export const RESOURCE_STATUSES = [
  'have-it', 'need-to-choose', 'need-to-buy', 'need-library', 'reserved-library',
  'ordered', 'borrowed', 'digital', 'coop-provided', 'no-resource', 'undecided'
];

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

export function makeResourceUse(fields) {
  return Object.assign({
    id: newId('ruse'),
    resourceId: null,
    usedByStudentIds: [],
    audience: 'together', // see AUDIENCE_TYPES
    participants: [],
    subjectColumnId: null,
    cardId: null,
    loopId: null,
    loopItemId: null,
    sequenceId: null,
    sequenceItemId: null,
    coopRef: null,
    optionalRef: null,
    scheduleSummary: '',
    nextAssignment: '',
    progressCursor: null,
    notes: ''
  }, fields);
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
    status: 'active', // active | optional | coop | unplaced
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
    sortOrder: 0
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
    notes: ''
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

// ---------------------------------------------------------------------------
// StarterTemplate — editable Charlotte Mason-style suggestions, never
// mandatory curriculum.
// ---------------------------------------------------------------------------
export function makeStarterTemplate(fields) {
  return Object.assign({
    id: newId('tpl'),
    title: '',
    subjectColumnId: null,
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
export function buildResourceRollup(resources, resourceUses) {
  var byId = {};
  resources.forEach(function (r) { byId[r.id] = Object.assign({}, r, { uses: [] }); });
  resourceUses.forEach(function (u) {
    if (byId[u.resourceId]) byId[u.resourceId].uses.push(u);
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
