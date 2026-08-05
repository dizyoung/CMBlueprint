// CM Blueprint Planner — shared pure logic module.
// Used by both the app (CM_Blueprint_Planner_2026-27.html, via <script type="module">)
// and the Node test suite (tests/logic.test.mjs). Keep this dependency-free and pure
// (no DOM, no localStorage) so it can run unmodified under plain `node`.

export const STORAGE_KEY_V2 = 'cm_blueprint_data_v2';
export const STORAGE_KEY_V3 = 'cm_blueprint_data_v3';

// ---------------------------------------------------------------------------
// Reference data: Forms are CM pedagogy, not family-specific, so they stay as
// a fixed reference list. Which Forms are "in use" comes from FamilySetup.
// ---------------------------------------------------------------------------
export const FORMS = [
  { id: 'f1', label: 'Form 1', grades: 'Grades 1–3', sub: 'Early (gr.1–2): new reader, oral narration only. Later (gr.3): reading independently, occasional written narration.' },
  { id: 'f2', label: 'Form 2', grades: 'Grades 4–6', sub: 'Written narration begins. Dictation, grammar, general science, citizenship, foreign language all begin here.' },
  { id: 'f34', label: 'Form 3/4', grades: 'Grades 7–9', sub: 'Historically combined PNEU Forms III and IV. Fuller composition, botany/geology/physiology, deeper citizenship and history spines.' },
  { id: 'f56', label: 'Form 5/6', grades: 'Grades 10–12', sub: 'Historically combined PNEU Forms V and VI. Public speaking, astronomy, economics, government, independent research-level work.' }
];

export const CYCLES = [
  { n: 1, era: 'Ancients', dates: 'Creation through Fall of Rome (c.400 AD)',
    spines: ['SOTW Vol. 1', 'Mystery of History Vol. 1', 'Biblioplan Ancients'],
    t1: 'Egypt, Mesopotamia, Israel', t2: 'Greece, Persia, India', t3: 'Rome — Republic to Empire' },
  { n: 2, era: 'Medieval + Reformation', dates: '400 AD — 1600s',
    spines: ['SOTW Vol. 2', 'Mystery of History Vol. 2', 'Biblioplan Medieval'],
    t1: 'Fall of Rome, Byzantium, Islam', t2: 'Middle Ages, Vikings, Crusades', t3: 'Renaissance, Reformation, Exploration' },
  { n: 3, era: 'Early Modern', dates: '1600s — 1850s',
    spines: ['SOTW Vol. 3', 'Mystery of History Vol. 3', 'Biblioplan Early Modern'],
    t1: 'Colonization, Scientific Revolution', t2: 'Revolutions — American and French', t3: 'Industrialization, Westward expansion' },
  { n: 4, era: 'Modern Times', dates: '1850s — Present',
    spines: ['SOTW Vol. 4', 'Mystery of History Vol. 4', 'Biblioplan Modern Times'],
    t1: 'WWI, Immigration, Interwar years', t2: 'WWII, Cold War begins', t3: 'Civil Rights, Space Race, Modern era' }
];

export const FREQUENCIES = [
  { id: 4, label: 'Daily (4x/wk)' },
  { id: 3, label: '3x/wk' },
  { id: 2, label: '2x/wk' },
  { id: 1, label: '1x/wk' },
  { id: 0.5, label: 'Every other wk' },
  { id: 0.25, label: '1x/term' },
  { id: 0.08, label: 'A few times/yr' }
];

export const UNIT_TYPES = ['pages', 'chapters', 'lessons', 'entries', 'sittings', 'custom'];

// Audience: who actually does a given book/assignment, distinct from which
// children a category's Form/override rules make it *applicable* to.
//   together       - whole family does it once, shown under "Together/Family"
//   shared-group   - a user-labeled subset (e.g. "Older kids"), shown once per label
//   individual     - resolved per applicable child, shown under each child
//   co-op-outside  - handled outside the home; hidden from Weekly view by default
//   independent    - child does it on their own initiative, still shown
export const AUDIENCE_TYPES = ['together', 'shared-group', 'individual', 'co-op-outside', 'independent'];
export const BOOK_PRIORITIES = ['core', 'regular', 'optional-loop'];
export const BOOK_STATUSES = ['active', 'paused', 'finished', 'dropped'];

// ---------------------------------------------------------------------------
// Demo / seed family data — carries the original hardcoded family forward as
// example content so the app is still useful out of the box, without baking
// family-specific facts into logic.
// ---------------------------------------------------------------------------
export function demoFamilySetup() {
  return {
    children: [
      { id: 'charis', name: 'Charis', gradeLabel: '1st', formId: 'f1', schoolDaysPerWeek: 4, notes: '' },
      { id: 'kayla', name: 'Kayla', gradeLabel: '3rd', formId: 'f1', schoolDaysPerWeek: 4, notes: '' },
      { id: 'lucy', name: 'Lucy', gradeLabel: '7th', formId: 'f34', schoolDaysPerWeek: 4, notes: '' },
      { id: 'jeremiah', name: 'Jeremiah', gradeLabel: '10th', formId: 'f56', schoolDaysPerWeek: 3, notes: 'Most academics at Greenhouse co-op' }
    ],
    schoolYear: {
      termsPerYear: 3,
      weeksPerTerm: 12,
      examWeekPattern: 'last-of-term' // or 'explicit' with examWeeks: [...]
    },
    historyCycleId: 4
  };
}

export function demoCategories() {
  return [
    { grp: 'Bible + Faith', col: '#d4537e', items: [
      { id: 'bf', name: 'Bible — Family', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 4,
        bks: [
          { t: 'New Testament reading', who: 'all', whoChildren: [], tot: 260, per: 2, unitType: 'chapters' },
          { t: 'Psalms + Proverbs', who: 'all', whoChildren: [], tot: 66, per: 1, unitType: 'chapters' },
          { t: 'Hymn Study — rotating', who: 'all', whoChildren: [], tot: 36, per: 1, unitType: 'lessons' }
        ] },
      { id: 'bsp', name: 'Personal Spiritual Reading', forms: ['f34', 'f56'], childOverrides: [], freq: 2,
        bks: [{ t: 'Spiritual reading (choose one)', who: 'all', whoChildren: [], tot: 30, per: 1, unitType: 'pages' }] },
      { id: 'bch', name: 'Theology / Church History', forms: ['f56'], childOverrides: [], freq: 3,
        bks: [{ t: 'Church History spine (choose one)', who: 'all', whoChildren: [], tot: 30, per: 1, unitType: 'chapters' }] }
    ] },
    { grp: 'Citizenship', col: '#17626d', items: [
      { id: 'ci-hab', name: 'Habit Building (Citizenship, early)', forms: ['f1'], childOverrides: [], freq: 1,
        bks: [{ t: 'Family expectations + habit discussions', who: 'all', whoChildren: [], tot: 33, per: 1, unitType: 'sittings' }] },
      { id: 'ci-civ', name: 'Citizenship / Constitution', forms: ['f2', 'f34'], childOverrides: [], freq: 1,
        bks: [{ t: 'Constitution / Law text (choose one)', who: 'all', whoChildren: [], tot: 30, per: 1, unitType: 'chapters' }] },
      { id: 'ci-plu', name: 'Plutarch', forms: ['f2', 'f34', 'f56'], childOverrides: [], freq: 1,
        bks: [{ t: "Plutarch's Lives (choose one life)", who: 'all', whoChildren: [], tot: 20, per: 1, unitType: 'chapters' }] },
      { id: 'ci-gov', name: 'Government + Economics', forms: ['f56'], childOverrides: [], freq: 3,
        bks: [{ t: 'Economics in One Lesson — Hazlitt (free)', who: 'all', whoChildren: [], tot: 25, per: 1, unitType: 'chapters' }] },
      { id: 'ci-cur', name: 'Current Events', forms: ['f34', 'f56'], childOverrides: [], freq: 1,
        bks: [{ t: 'Weekly news discussion', who: 'all', whoChildren: [], tot: 33, per: 1, unitType: 'sittings' }] }
    ] },
    { grp: 'History — American', col: '#993556', items: [
      { id: 'am-pic', name: 'American Picture Books', forms: ['f1'], childOverrides: [], freq: 1,
        bks: [{ t: 'Modern Times picture book basket', who: 'all', whoChildren: [], tot: 27, per: 1, unitType: 'sittings' }] },
      { id: 'am-story', name: 'American History Story', forms: ['f2', 'f34'], childOverrides: [], freq: 2,
        bks: [{ t: 'American narrative spine (choose one)', who: 'all', whoChildren: [], tot: 40, per: 2, unitType: 'chapters' }] },
      { id: 'am-spine', name: 'American History — Independent', forms: ['f56'], childOverrides: [], freq: 3,
        bks: [{ t: 'Survey spine — independent study', who: 'all', whoChildren: [], tot: 40, per: 1, unitType: 'chapters' }] }
    ] },
    { grp: 'History — World', col: '#378add', items: [
      { id: 'wh-tales', name: 'Ancient Tales (cycle-matched)', forms: ['f2'], childOverrides: [], freq: 1, bks: [] },
      { id: 'wh-spine', name: 'World History spine', forms: ['f34', 'f56'], childOverrides: [], freq: 2,
        bks: [{ t: 'Modern Times spine (SOTW / Biblioplan / MoH)', who: 'all', whoChildren: [], tot: 320, per: 3, unitType: 'pages' }] },
      { id: 'nb', name: 'Neighboring Lands', forms: ['f2', 'f34'], childOverrides: [], freq: 1,
        bks: [{ t: 'Britain / Mexico / Canada rotating', who: 'all', whoChildren: [], tot: 30, per: 1, unitType: 'chapters' }] }
    ] },
    { grp: 'Science + Nature', col: '#639922', items: [
      { id: 'nh', name: 'Natural History', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 1,
        bks: [{ t: 'Living books about nature (choose one)', who: 'all', whoChildren: [], tot: 50, per: 2, unitType: 'pages' }] },
      { id: 'ns', name: 'Nature Study', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 1,
        bks: [{ t: 'Outdoor nature walks + journal', who: 'all', whoChildren: [], tot: 33, per: 1, unitType: 'entries' }] },
      { id: 'sc-gen', name: 'General Science', forms: ['f2'], childOverrides: [], freq: 1, bks: [] },
      { id: 'sc-adv', name: 'Botany / Geology / Physiology', forms: ['f34'], childOverrides: [], freq: 1,
        bks: [{ t: 'Science living book (choose one)', who: 'all', whoChildren: [], tot: 40, per: 1, unitType: 'chapters' }] },
      { id: 'sc-up', name: 'Astronomy / Chemistry / Physics', forms: ['f56'], childOverrides: [], freq: 3,
        bks: [{ t: 'Upper science text (handled at co-op)', who: 'all', whoChildren: [], tot: 30, per: 1, unitType: 'lessons' }] }
    ] },
    { grp: 'Language Arts', col: '#ba7517', items: [
      { id: 'la-oral', name: 'Narration (oral)', forms: ['f1'], childOverrides: [], freq: 4, bks: [] },
      { id: 'la-written', name: 'Narration, Dictation + Composition', forms: ['f2', 'f34', 'f56'], childOverrides: [], freq: 4, bks: [] },
      { id: 'gr', name: 'Grammar', forms: ['f2', 'f34', 'f56'], childOverrides: [], freq: 2,
        bks: [{ t: 'Grammar text (choose one)', who: 'all', whoChildren: [], tot: 30, per: 1, unitType: 'lessons' }] },
      { id: 'lit', name: 'Literature (incl. Shakespeare)', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 2,
        bks: [
          { t: 'Family read-aloud (Shakespeare as story for littles)', who: 'all', whoChildren: [], tot: 20, per: 1, unitType: 'chapters' },
          { t: 'Independent literature (older kids)', who: 'specific', whoChildren: ['lucy', 'jeremiah'], tot: 200, per: 8, unitType: 'pages' }
        ] },
      { id: 'flang', name: 'Foreign Language', forms: ['f2', 'f34', 'f56'], childOverrides: [], freq: 2,
        bks: [{ t: 'Latin or modern language course', who: 'all', whoChildren: [], tot: 30, per: 1, unitType: 'lessons' }] }
    ] },
    { grp: 'Math', col: '#555', items: [
      { id: 'math', name: 'Math', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 4,
        bks: [{ t: 'Math curriculum (individual pacing)', who: 'all', whoChildren: [], tot: 144, per: 1, unitType: 'lessons' }] }
    ] },
    { grp: 'Beauty Loop', col: '#7f77dd', items: [
      { id: 'pic', name: 'Picture Study', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 1,
        bks: [{ t: 'Artist rotation — 3 per year', who: 'all', whoChildren: [], tot: 3, per: 0.08, unitType: 'lessons' }] },
      { id: 'comp', name: 'Composer Study', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 1,
        bks: [{ t: 'Composer rotation — 3 per year', who: 'all', whoChildren: [], tot: 3, per: 0.08, unitType: 'lessons' }] },
      { id: 'poet', name: 'Poetry + Recitation', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 4,
        bks: [{ t: 'Family Poetry — rotating poems', who: 'all', whoChildren: [], tot: 36, per: 1, unitType: 'entries' }] },
      { id: 'hym', name: 'Hymns + Folk Songs', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 1,
        bks: [{ t: 'Hymn + folk song rotation', who: 'all', whoChildren: [], tot: 9, per: 0.25, unitType: 'lessons' }] }
    ] },
    { grp: 'Hands + Body', col: '#2e9e6b', items: [
      { id: 'hand', name: 'Handicrafts', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 1, bks: [] },
      { id: 'drill', name: 'Drill / PE', forms: ['f1', 'f2', 'f34', 'f56'], childOverrides: [], freq: 1, bks: [] }
    ] },
    { grp: 'Geography', col: '#1fb6b6', items: [
      { id: 'geo-fam', name: 'Family Geography', forms: ['f1'], childOverrides: [], freq: 1, bks: [] },
      { id: 'geo-map', name: 'Mapping', forms: ['f2', 'f34', 'f56'], childOverrides: [], freq: 1,
        bks: [{ t: 'Map work + atlas', who: 'all', whoChildren: [], tot: 33, per: 1, unitType: 'sittings' }] }
    ] }
  ];
}

export function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// ---------------------------------------------------------------------------
// School year helpers
// ---------------------------------------------------------------------------
export function totalWeeks(schoolYear) {
  return schoolYear.termsPerYear * schoolYear.weeksPerTerm;
}

// Returns sorted array of exam week numbers (1-indexed, absolute across the year).
export function examWeeksFor(schoolYear) {
  if (schoolYear.examWeekPattern === 'explicit' && Array.isArray(schoolYear.examWeeks)) {
    return schoolYear.examWeeks.slice().sort(function (a, b) { return a - b; });
  }
  // default: 'last-of-term' — last week of each term is an exam week
  var weeks = [];
  for (var t = 1; t <= schoolYear.termsPerYear; t++) {
    weeks.push(t * schoolYear.weeksPerTerm);
  }
  return weeks;
}

export function readingWeeksCount(schoolYear) {
  return totalWeeks(schoolYear) - examWeeksFor(schoolYear).length;
}

export function termRanges(schoolYear) {
  var ranges = {};
  for (var t = 1; t <= schoolYear.termsPerYear; t++) {
    ranges[t] = [(t - 1) * schoolYear.weeksPerTerm + 1, t * schoolYear.weeksPerTerm];
  }
  return ranges;
}

// ---------------------------------------------------------------------------
// Frequency / week-inclusion logic
// ---------------------------------------------------------------------------
// Given a category frequency and a 0-indexed "content week" number (i.e. the
// nth reading week, exam weeks excluded), determine whether the category's
// content should appear in that week.
//   4  -> every week (daily within a 4-day school week model)
//   3  -> every week (3x/week still shown each week, just fewer sittings)
//   2  -> every week
//   1  -> every week
//   0.5 -> every OTHER week (even content-week indices, 0,2,4,...)
//   0.25 -> 1x/term: only the first content week of each term
//   0.08 -> a few times/year: roughly once per term (anchored to first week of term)
export function categoryAppliesToWeek(freq, contentWeekIndex, opts) {
  opts = opts || {};
  if (freq >= 1) return true; // 4x,3x,2x,1x/week all show every week (the *count* of sittings differs, not presence)
  if (freq === 0.5) return (contentWeekIndex % 2) === 0;
  if (freq === 0.25) return !!opts.isFirstWeekOfTerm;
  if (freq === 0.08) return !!opts.isFirstWeekOfTerm; // "a few times/year" ~ once per term
  return true;
}

// ---------------------------------------------------------------------------
// Pacing math
// ---------------------------------------------------------------------------
// Sittings available per year for a given frequency + school days/week for the
// relevant child(ren), across the family's reading weeks.
export function sittingsAvailable(freq, schoolDaysPerWeek, readingWeeks) {
  return Math.floor((freq / 4) * schoolDaysPerWeek * readingWeeks);
}

// Sittings needed for one book: ceil(total / per).
export function sittingsNeededForBook(book) {
  return Math.ceil(book.tot / Math.max(0.01, book.per));
}

// Resolve which schoolDaysPerWeek to use for a category: take the max across
// all children to whom the category applies (Form match or explicit override),
// so pacing reflects the busiest relevant schedule. Falls back to 4 if no match.
export function resolveSchoolDaysForCategory(category, children) {
  var applicable = childrenForCategory(category, children);
  if (applicable.length === 0) return 4;
  var max = 0;
  for (var i = 0; i < applicable.length; i++) {
    max = Math.max(max, applicable[i].schoolDaysPerWeek || 0);
  }
  return max || 4;
}

// Determine which children a category applies to: Form-level match, plus/minus
// childOverrides ({childId, included:true|false}) that refine the Form default.
export function childrenForCategory(category, children) {
  var overrides = {};
  (category.childOverrides || []).forEach(function (o) { overrides[o.childId] = o.included; });
  return children.filter(function (c) {
    if (overrides.hasOwnProperty(c.id)) return overrides[c.id];
    return (category.forms || []).indexOf(c.formId) > -1;
  });
}

export function calc(category, children, schoolYear) {
  var readingWeeks = readingWeeksCount(schoolYear);
  var days = resolveSchoolDaysForCategory(category, children);
  var s = sittingsAvailable(category.freq, days, readingWeeks);
  var bs = 0, i;
  for (i = 0; i < category.bks.length; i++) bs += sittingsNeededForBook(category.bks[i]);
  var pct = bs === 0 ? (category.bks.length === 0 ? 0 : 100) : Math.min(100, Math.round((s / Math.max(1, bs)) * 100));
  var applicableChildren = childrenForCategory(category, children);
  // Only treat the whole category as co-op-paced if EVERY child it applies to
  // is co-op (otherwise a mixed category would misleadingly look "handled
  // elsewhere" for a child who actually does it at home).
  var isCoop = applicableChildren.length > 0 && applicableChildren.every(function (c) { return /co-op/i.test(c.notes || ''); });
  var sc;
  if (category.bks.length === 0) sc = 'z';
  else if (isCoop) sc = 'b';
  else if (pct >= 95) sc = 'g';
  else if (pct >= 75) sc = 'y';
  else sc = 'r';
  var bc = sc === 'g' ? '#639922' : sc === 'y' ? '#ef9f27' : sc === 'r' ? '#e24b4a' : sc === 'b' ? '#378add' : '#aaa';
  var st = sc === 'g' ? 'Covered' : sc === 'y' ? 'Slightly short' : sc === 'r' ? 'Needs books' : sc === 'b' ? 'Co-op paced' : 'No books yet';
  return { s: s, bs: bs, pct: pct, sur: s - bs, sc: sc, bc: bc, st: st, days: days, readingWeeks: readingWeeks };
}

// Compute a per-sitting assignment range for a book, given which "sitting
// number" (1-indexed, within the book's own sequence) is being displayed.
// Returns a unit-labeled range string, e.g. "p.12-24" for pages, "ch.3" for a
// single-chapter sitting, etc.
export function assignmentRangeForSitting(book, sittingNumber) {
  var per = Math.max(0.01, book.per);
  var startUnit = Math.floor((sittingNumber - 1) * per) + 1;
  var endUnit = Math.min(book.tot, Math.ceil(sittingNumber * per));
  if (endUnit < startUnit) endUnit = startUnit;
  var abbr = unitAbbr(book.unitType);
  if (endUnit === startUnit) return abbr + startUnit;
  return abbr + startUnit + '-' + endUnit;
}

export function unitAbbr(unitType) {
  switch (unitType) {
    case 'pages': return 'p.';
    case 'chapters': return 'ch.';
    case 'lessons': return 'lesson ';
    case 'entries': return 'entry ';
    case 'sittings': return 'sitting ';
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Family Setup mutation helpers (pure — take state, return nothing; caller owns
// persistence). These exist so the same logic can be unit tested without DOM.
// ---------------------------------------------------------------------------
export function addChild(familySetup, child) {
  familySetup.children.push(child);
  return familySetup;
}
export function editChild(familySetup, childId, patch) {
  var c = familySetup.children.find(function (x) { return x.id === childId; });
  if (!c) return familySetup;
  Object.assign(c, patch);
  return familySetup;
}
export function deleteChild(familySetup, childId) {
  familySetup.children = familySetup.children.filter(function (c) { return c.id !== childId; });
  return familySetup;
}

export function addGroup(categories, group) {
  categories.push(group);
  return categories;
}
// Note: unlike deleteChild/deleteSubcategory (which mutate in place), this
// returns a new filtered array — callers must reassign their categories
// reference to the result, e.g. `CATS = deleteGroup(CATS, name)`.
export function deleteGroup(categories, groupName) {
  return categories.filter(function (g) { return g.grp !== groupName; });
}
export function moveGroup(categories, groupName, direction) {
  var idx = categories.findIndex(function (g) { return g.grp === groupName; });
  if (idx === -1) return categories;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= categories.length) return categories;
  var tmp = categories[idx];
  categories[idx] = categories[newIdx];
  categories[newIdx] = tmp;
  return categories;
}

export function addSubcategory(group, subcat) {
  group.items.push(subcat);
  return group;
}
export function deleteSubcategory(group, subcatId) {
  group.items = group.items.filter(function (i) { return i.id !== subcatId; });
  return group;
}
export function moveSubcategory(group, subcatId, direction) {
  var idx = group.items.findIndex(function (i) { return i.id === subcatId; });
  if (idx === -1) return group;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= group.items.length) return group;
  var tmp = group.items[idx];
  group.items[idx] = group.items[newIdx];
  group.items[newIdx] = tmp;
  return group;
}

export function findCategory(categories, id) {
  for (var g = 0; g < categories.length; g++) {
    for (var i = 0; i < categories[g].items.length; i++) {
      if (categories[g].items[i].id === id) return categories[g].items[i];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Schedule generation
// ---------------------------------------------------------------------------
// Build the list of category items (with resolved book + assignment range)
// that should show for a given child in a given absolute week number.
// childId === 'all' means whole-family aggregated view (one row per category,
// deduped, not filtered to a single child's Form).
export function buildWeekItems(categories, children, schoolYear, childId, absoluteWeekNum, contentWeekIndex) {
  var ranges = termRanges(schoolYear);
  var weeksPerTerm = schoolYear.weeksPerTerm;
  var termOfWeek = Math.ceil(absoluteWeekNum / weeksPerTerm);
  var firstWeekOfThatTerm = ranges[termOfWeek] ? ranges[termOfWeek][0] : 1;
  var isFirstWeekOfTerm = absoluteWeekNum === firstWeekOfThatTerm;

  var items = [];
  var child = childId === 'all' ? null : children.find(function (c) { return c.id === childId; });
  if (childId !== 'all' && !child) return items;

  var seen = {};
  for (var g = 0; g < categories.length; g++) {
    var grp = categories[g];
    for (var ci = 0; ci < grp.items.length; ci++) {
      var cat = grp.items[ci];
      var applicableChildren = childrenForCategory(cat, children);
      if (child) {
        if (applicableChildren.indexOf(child) === -1) continue;
      } else {
        if (seen[cat.id]) continue;
        if (applicableChildren.length === 0) continue;
        seen[cat.id] = true;
      }
      if (!categoryAppliesToWeek(cat.freq, contentWeekIndex, { isFirstWeekOfTerm: isFirstWeekOfTerm })) continue;

      if (cat.bks.length === 0) {
        items.push({ col: grp.col, text: cat.name + ' — not yet assigned', ph: true, catId: cat.id });
      } else {
        var relevantBooks = cat.bks.filter(function (b) {
          if (b.who === 'all') return true;
          if (!child) return true;
          return (b.whoChildren || []).indexOf(child.id) > -1;
        });
        if (relevantBooks.length === 0) relevantBooks = cat.bks;
        var b = relevantBooks[contentWeekIndex % relevantBooks.length];
        var sittingNumber = Math.floor(contentWeekIndex / relevantBooks.length) + 1;
        var range = assignmentRangeForSitting(b, sittingNumber);
        items.push({ col: grp.col, text: cat.name + ': ' + b.t + ' (' + range + ')', ph: false, catId: cat.id });
      }
    }
  }
  return items;
}

// Build print-view data: array of { weekNum, isExam, items } for a term, for a child.
export function buildPrintTermData(categories, children, schoolYear, childId, term, behindWeeks) {
  var ranges = termRanges(schoolYear);
  var range = ranges[term];
  var examWeeks = examWeeksFor(schoolYear);
  var weeks = [];
  for (var w = range[0]; w <= range[1]; w++) {
    var isExam = examWeeks.indexOf(w) > -1;
    if (isExam) {
      weeks.push({ weekNum: w, isExam: true, items: [] });
    } else {
      var contentWeekIndex = Math.max(0, w - 1 - (behindWeeks || 0));
      weeks.push({ weekNum: w, isExam: false, items: buildWeekItems(categories, children, schoolYear, childId, w, contentWeekIndex) });
    }
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// Migration & validation
// ---------------------------------------------------------------------------
// Detect "old shape" (v2) data: an array of {grp, col, items:[...]} with no
// FamilySetup wrapper (v2 stored CATS directly at the top level).
export function isOldShapeData(raw) {
  if (!raw) return false;
  if (Array.isArray(raw)) {
    return raw.length > 0 && raw[0] && typeof raw[0] === 'object' && 'grp' in raw[0] && 'items' in raw[0];
  }
  return false;
}

// Structural validation for v3 backup/import data. Returns {valid, errors}.
export function validateAppData(data) {
  var errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Top-level data must be an object.'] };
  }
  if (!data.familySetup || typeof data.familySetup !== 'object') {
    errors.push('Missing "familySetup" object.');
  } else {
    if (!Array.isArray(data.familySetup.children)) errors.push('"familySetup.children" must be an array.');
    else {
      data.familySetup.children.forEach(function (c, i) {
        if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') {
          errors.push('familySetup.children[' + i + '] is missing required id/name fields.');
        }
      });
    }
    if (!data.familySetup.schoolYear || typeof data.familySetup.schoolYear !== 'object') {
      errors.push('Missing "familySetup.schoolYear" object.');
    } else {
      var sy = data.familySetup.schoolYear;
      if (typeof sy.termsPerYear !== 'number' || typeof sy.weeksPerTerm !== 'number') {
        errors.push('"familySetup.schoolYear" must have numeric termsPerYear and weeksPerTerm.');
      }
    }
  }
  if (!Array.isArray(data.categories)) {
    errors.push('Missing "categories" array.');
  } else {
    data.categories.forEach(function (g, i) {
      if (!g || typeof g.grp !== 'string' || !Array.isArray(g.items)) {
        errors.push('categories[' + i + '] is missing required grp/items fields.');
      }
    });
  }
  return { valid: errors.length === 0, errors: errors };
}

export function freshAppData() {
  return {
    version: 3,
    familySetup: demoFamilySetup(),
    categories: demoCategories(),
    uiState: { behind: 0 },
    overrides: {},
    loops: [],
    isDemo: true
  };
}

// A genuinely empty starting point for "Start a blank plan" — no preloaded
// family names, no demo subjects/books. Used by the first-time welcome flow.
export function blankAppData() {
  return {
    version: 3,
    familySetup: { children: [], schoolYear: { termsPerYear: 3, weeksPerTerm: 12, examWeekPattern: 'last-of-term' }, historyCycleId: 1 },
    categories: [],
    uiState: { behind: 0 },
    overrides: {},
    loops: [],
    isDemo: false
  };
}

// ---------------------------------------------------------------------------
// Scheduling method: NOT every item belongs in a loop. Each book chooses how
// it gets onto the Daily checklist:
//   direct-frequency - appears on its own frequency (e.g. Math 4x/wk), no loop
//   loop-rotation    - belongs to a loop; the loop's current slot pulls it
//   fixed-days       - appears only on user-chosen day numbers (1-indexed)
//   manual-only      - tracked (planning/queues) but never auto-scheduled
// ---------------------------------------------------------------------------
export const SCHEDULE_STYLES = ['direct-frequency', 'loop-rotation', 'fixed-days', 'manual-only'];

// Book model v2: normalize legacy book shape with the new scheduling fields,
// without mutating stored data or breaking the original {t,who,whoChildren,
// tot,per,unitType} shape used by calc()/assignmentRangeForSitting above.
// ---------------------------------------------------------------------------
export function normalizeBook(b) {
  return Object.assign({
    startWeek: null,
    endWeek: null,
    assignedChildren: null, // null = inherit from who/whoChildren or category rules
    audienceType: b.who === 'specific' ? 'individual' : 'together',
    sharedGroupLabel: '',
    priority: 'regular', // core | regular | optional-loop
    status: 'active', // active | paused | finished | dropped
    pauseUntilWeek: null,
    currentUnit: 0,
    autoSchedule: true,
    scheduleStyle: 'direct-frequency', // direct-frequency | loop-rotation | fixed-days | manual-only
    loopId: null, // explicit book-level loop assignment (loop-rotation only)
    fixedDays: [], // 1-indexed day numbers (fixed-days only)
    subjectFamily: null, // broad family for daily-load purposes, e.g. 'history', 'science', 'literature'
    conflictGroup: null, // e.g. 'heavy-reading', 'writing-output', 'hands-on', 'light-beauty', 'skill-practice'
    brainLoad: 'medium' // light | medium | heavy
  }, b);
}

// Resolve which loop a loop-rotation book belongs to, using inheritance:
// book-level > subcategory-level default > category-group-level default.
// Returns null if nothing resolves (caller should treat as "Needs Loop Assignment").
export function resolveBookLoopId(book, category, grp) {
  var nb = normalizeBook(book);
  if (nb.loopId) return nb.loopId;
  if (category && category.defaultLoopId) return category.defaultLoopId;
  if (grp && grp.defaultLoopId) return grp.defaultLoopId;
  return null;
}

// True only for loop-rotation books that cannot resolve to any loop at all.
// Direct-frequency, fixed-days, and manual-only books never need a loop.
export function bookNeedsLoopAssignment(book, category, grp) {
  var nb = normalizeBook(book);
  if (nb.scheduleStyle !== 'loop-rotation') return false;
  return !resolveBookLoopId(nb, category, grp);
}

// Scan all books across all categories/groups and list every loop-rotation
// book that has no resolvable loop — i.e. the "Needs Loop Assignment" bucket.
export function findBooksNeedingLoopAssignment(categories) {
  var out = [];
  categories.forEach(function (grp) {
    grp.items.forEach(function (cat) {
      cat.bks.forEach(function (book, bIdx) {
        if (bookNeedsLoopAssignment(book, cat, grp)) {
          out.push({ catId: cat.id, catName: cat.name, grpName: grp.grp, bookIndex: bIdx, bookKey: cat.id + '#' + bIdx, title: book.t });
        }
      });
    });
  });
  return out;
}

// Is this book eligible to appear in generated schedules for this absolute week?
export function bookActiveForWeek(book, absoluteWeekNum) {
  var nb = normalizeBook(book);
  if (nb.autoSchedule === false) return false;
  if (nb.status === 'dropped' || nb.status === 'finished') return false;
  if (nb.status === 'paused') {
    if (!nb.pauseUntilWeek || absoluteWeekNum < nb.pauseUntilWeek) return false;
  }
  if (nb.startWeek != null && absoluteWeekNum < nb.startWeek) return false;
  if (nb.endWeek != null && absoluteWeekNum > nb.endWeek) return false;
  return true;
}

// Which children a specific book is for, refining the category's Form/override
// resolution: assignedChildren (new, explicit) > legacy who/whoChildren > category default.
export function resolveBookAudience(book, category, children) {
  var nb = normalizeBook(book);
  if (Array.isArray(nb.assignedChildren) && nb.assignedChildren.length) {
    return children.filter(function (c) { return nb.assignedChildren.indexOf(c.id) > -1; });
  }
  if (nb.who === 'specific' && Array.isArray(nb.whoChildren) && nb.whoChildren.length) {
    return children.filter(function (c) { return nb.whoChildren.indexOf(c.id) > -1; });
  }
  return childrenForCategory(category, children);
}

// Which "sitting number" (1-indexed) a book is on for a given absolute week,
// used to compute the assignment range. If the book has an explicit startWeek,
// count from there; otherwise fall back to the category's content-week index.
export function sittingNumberForBook(book, absoluteWeekNum, contentWeekIndex) {
  var nb = normalizeBook(book);
  if (nb.startWeek != null) return Math.max(1, absoluteWeekNum - nb.startWeek + 1);
  return contentWeekIndex + 1;
}

// ---------------------------------------------------------------------------
// Manual overrides: keyed by "<bookKey>|<weekNum>[|<dayNum>]" so a specific
// generated cell can be hand-edited and will survive regeneration until the
// user explicitly resets it.
// ---------------------------------------------------------------------------
export function overrideKey(bookKey, weekNum, dayNum) {
  return bookKey + '|' + weekNum + (dayNum != null ? '|' + dayNum : '');
}
export function setOverride(overrides, bookKey, weekNum, dayNum, text) {
  overrides[overrideKey(bookKey, weekNum, dayNum)] = text;
  return overrides;
}
export function clearOverride(overrides, bookKey, weekNum, dayNum) {
  delete overrides[overrideKey(bookKey, weekNum, dayNum)];
  return overrides;
}
export function resetGeneratedOverrides(overrides) {
  Object.keys(overrides).forEach(function (k) { delete overrides[k]; });
  return overrides;
}

// ---------------------------------------------------------------------------
// Book-level rescheduling actions — pure mutations on a book object (and, for
// cross-category moves, the categories array). Callers own persistence.
// ---------------------------------------------------------------------------
export function setBookProgress(book, currentUnit) {
  book.currentUnit = currentUnit;
  return book;
}

// Recompute per-sitting pace so the book's remaining units finish by endWeek,
// starting from fromWeek, given how many sittings/week the category allows.
export function rebalanceBookFromProgress(book, fromWeek, toWeek, sittingsPerWeek) {
  var nb = normalizeBook(book);
  var remainingUnits = Math.max(0, nb.tot - (nb.currentUnit || 0));
  var weeks = Math.max(1, toWeek - fromWeek + 1);
  var sittingsRemaining = Math.max(1, Math.round(weeks * Math.max(0.01, sittingsPerWeek || 1)));
  book.per = remainingUnits > 0 ? remainingUnits / sittingsRemaining : book.per;
  book.startWeek = fromWeek;
  book.endWeek = toWeek;
  book.status = 'active';
  return book;
}

export function skipBookForWeek(overrides, bookKey, weekNum, dayNum) {
  return setOverride(overrides, bookKey, weekNum, dayNum, ''); // empty text = "skipped"
}

export function pauseBookUntilWeek(book, weekNum) {
  book.status = 'paused';
  book.pauseUntilWeek = weekNum;
  return book;
}

export function finishBookByWeek(book, weekNum, fromWeek, sittingsPerWeek) {
  return rebalanceBookFromProgress(book, fromWeek || book.startWeek || 1, weekNum, sittingsPerWeek);
}

export function dropBookRemaining(book) {
  book.status = 'dropped';
  return book;
}

export function setBookAutoSchedule(book, auto) {
  book.autoSchedule = !!auto;
  return book;
}

export function moveBookToCategory(categories, fromCatId, toCatId, bookIndex) {
  var fromCat = findCategory(categories, fromCatId);
  var toCat = findCategory(categories, toCatId);
  if (!fromCat || !toCat) return categories;
  var book = fromCat.bks.splice(bookIndex, 1)[0];
  if (book) toCat.bks.push(book);
  return categories;
}

// ---------------------------------------------------------------------------
// Weekly-by-Subject schedule: books grouped by category GROUP, then by
// audience (Together/Family once, shared-group labels once each, individual
// per child, co-op/outside and independent each their own bucket).
// ---------------------------------------------------------------------------
export function buildWeeklyBySubject(categories, children, schoolYear, absoluteWeekNum, contentWeekIndex, opts) {
  opts = opts || {};
  var ranges = termRanges(schoolYear);
  var weeksPerTerm = schoolYear.weeksPerTerm;
  var termOfWeek = Math.ceil(absoluteWeekNum / weeksPerTerm);
  var firstWeekOfThatTerm = ranges[termOfWeek] ? ranges[termOfWeek][0] : 1;
  var isFirstWeekOfTerm = absoluteWeekNum === firstWeekOfThatTerm;
  var overrides = opts.overrides || {};

  var out = [];
  categories.forEach(function (grp) {
    var groupOut = { grp: grp.grp, col: grp.col, together: [], sharedGroup: {}, individual: {}, coop: [], independent: [] };
    var any = false;
    grp.items.forEach(function (cat) {
      if (!categoryAppliesToWeek(cat.freq, contentWeekIndex, { isFirstWeekOfTerm: isFirstWeekOfTerm })) return;
      cat.bks.forEach(function (book, bIdx) {
        if (!bookActiveForWeek(book, absoluteWeekNum)) return;
        var nb = normalizeBook(book);
        if (nb.audienceType === 'co-op-outside' && !opts.showCoop) return;
        if (nb.priority === 'optional-loop' && opts.hideOptionalLoop) return;
        var audience = resolveBookAudience(book, cat, children);
        if (audience.length === 0 && !opts.showUnassigned) return;

        var bookKey = cat.id + '#' + bIdx;
        var ov = overrides[overrideKey(bookKey, absoluteWeekNum)];
        var text;
        if (ov != null) {
          text = ov === '' ? cat.name + ': ' + nb.t + ' — skipped this week' : ov;
        } else {
          var sittingNumber = sittingNumberForBook(nb, absoluteWeekNum, contentWeekIndex);
          var range = assignmentRangeForSitting(nb, sittingNumber);
          text = cat.name + ': ' + nb.t + ' (' + range + ')';
        }
        var item = {
          text: text, catId: cat.id, bookKey: bookKey, priority: nb.priority, manual: ov != null,
          scheduleStyle: nb.scheduleStyle, fixedDays: nb.fixedDays,
          loopId: resolveBookLoopId(nb, cat, grp),
          needsLoopAssignment: bookNeedsLoopAssignment(nb, cat, grp),
          conflictGroup: nb.conflictGroup, audienceType: nb.audienceType, subjectFamily: nb.subjectFamily
        };
        any = true;

        if (nb.audienceType === 'together') groupOut.together.push(item);
        else if (nb.audienceType === 'shared-group') {
          var label = nb.sharedGroupLabel || 'Shared group';
          (groupOut.sharedGroup[label] = groupOut.sharedGroup[label] || []).push(item);
        } else if (nb.audienceType === 'co-op-outside') groupOut.coop.push(item);
        else if (nb.audienceType === 'independent') groupOut.independent.push(item);
        else { // individual
          audience.forEach(function (c) {
            (groupOut.individual[c.id] = groupOut.individual[c.id] || []).push(item);
          });
        }
      });
    });
    if (any) out.push(groupOut);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Daily View: distribute a week's Weekly-by-Subject content across Day 1..N
// (N = schoolDaysPerWeek for the selected child, or the family max for 'all'),
// honoring each category's frequency so e.g. a 2x/week book doesn't land on
// every day. Deterministic, evenly-spaced day picks.
// ---------------------------------------------------------------------------
export function pickDaySlots(totalDays, occurrences) {
  occurrences = Math.max(1, Math.min(occurrences, totalDays));
  var slots = [];
  var step = totalDays / occurrences;
  for (var i = 0; i < occurrences; i++) {
    slots.push(Math.min(totalDays, Math.round(i * step) + 1));
  }
  return Array.from(new Set(slots));
}

export function buildDailyView(categories, children, schoolYear, absoluteWeekNum, contentWeekIndex, childId, opts) {
  opts = opts || {};
  var days;
  if (childId === 'all') {
    days = children.reduce(function (m, c) { return Math.max(m, c.schoolDaysPerWeek || 4); }, 1);
  } else {
    var child = children.find(function (c) { return c.id === childId; });
    days = child ? (child.schoolDaysPerWeek || 4) : 4;
  }

  var weekly = buildWeeklyBySubject(categories, children, schoolYear, absoluteWeekNum, contentWeekIndex, opts);
  var daysOut = [];
  for (var d = 1; d <= days; d++) daysOut.push({ day: d, groups: [] });

  function addToDay(dayNum, grp, col, item) {
    var dayEntry = daysOut[dayNum - 1];
    var grpEntry = dayEntry.groups.find(function (g) { return g.grp === grp; });
    if (!grpEntry) { grpEntry = { grp: grp, col: col, items: [] }; dayEntry.groups.push(grpEntry); }
    grpEntry.items.push(item);
  }

  weekly.forEach(function (groupOut) {
    var bucket = []; // [{item, scope}] scope used only for individual filtering
    groupOut.together.forEach(function (it) { bucket.push(it); });
    Object.keys(groupOut.sharedGroup).forEach(function (k) { groupOut.sharedGroup[k].forEach(function (it) { bucket.push(it); }); });
    if (childId === 'all') {
      Object.keys(groupOut.individual).forEach(function (k) { groupOut.individual[k].forEach(function (it) { bucket.push(it); }); });
    } else if (groupOut.individual[childId]) {
      bucket = bucket.concat(groupOut.individual[childId]);
    }
    bucket.forEach(function (item) {
      // Loop-rotation items are scheduled through their loop (see
      // buildLoopDailySlots), and manual-only items never auto-schedule —
      // neither belongs in this category-driven fallback Daily View.
      if (item.scheduleStyle === 'loop-rotation' || item.scheduleStyle === 'manual-only') return;
      if (item.scheduleStyle === 'fixed-days') {
        (item.fixedDays || []).forEach(function (dayNum) {
          if (dayNum >= 1 && dayNum <= days) addToDay(dayNum, groupOut.grp, groupOut.col, item);
        });
        return;
      }
      var cat = findCategory(categories, item.catId);
      var freq = cat ? cat.freq : 1;
      var occurrences = freq >= 4 ? days : Math.max(1, Math.round(freq));
      pickDaySlots(days, occurrences).forEach(function (dayNum) {
        addToDay(dayNum, groupOut.grp, groupOut.col, item);
      });
    });
  });

  if (opts.loadRules !== false) {
    var loadRules = opts.loadRules || defaultLoadRules();
    daysOut.forEach(function (dayEntry, dayIdx) {
      var flat = [];
      dayEntry.groups.forEach(function (g) { g.items.forEach(function (it) { flat.push({ item: it, g: g }); }); });
      var result = applyDailyLoadRules(flat.map(function (f) { return f.item; }), loadRules);
      var acceptedSet = new Set(result.accepted);
      dayEntry.groups.forEach(function (g) { g.items = g.items.filter(function (it) { return acceptedSet.has(it); }); });
      dayEntry.groups = dayEntry.groups.filter(function (g) { return g.items.length > 0; });
      result.deferred.forEach(function (it) {
        var entry = flat.find(function (f) { return f.item === it; });
        var nextDay = daysOut[dayIdx + 1];
        if (nextDay) addToDay(nextDay.day, entry.g.grp, entry.g.col, Object.assign({}, it, { text: it.text + ' (shifted — daily load limit)' }));
        else addToDay(dayEntry.day, entry.g.grp, entry.g.col, Object.assign({}, it, { text: it.text + ' (over daily load limit)' }));
      });
    });
  }

  return daysOut;
}

// ---------------------------------------------------------------------------
// Loops & Rhythm
// ---------------------------------------------------------------------------
// Architecture: categories/subcategories organize curriculum CONTENT. Books
// carry their own progress cursor (currentUnit) — a "book queue". Loops are
// the daily-rhythm layer: a loop is an ordered list of slots, each of which
// points at a subcategory (round-robin across its books), a specific book, a
// task type, or a manual custom item. Daily View asks each scheduled loop for
// its CURRENT item only (not every book in every category) and resolves that
// item against its target's queue cursor. Checking an item off advances both
// the target's queue cursor and the loop's own slot cursor.
export const LOOP_ITEM_TARGET_TYPES = ['subcategory', 'book', 'task', 'custom'];
export const LOOP_AUDIENCE_TYPES = ['together', 'form', 'child', 'custom-group'];
export const LOOP_ADVANCE_MODES = ['on-check', 'per-scheduled-day', 'manual'];
export const LOOP_ATTENTION_LEVELS = ['light', 'medium', 'heavy'];
export const LOOP_MODES = ['read', 'write', 'discuss', 'hands-on', 'listen', 'move', 'observe'];
export const LOOP_SETTINGS = ['together', 'independent', 'outside', 'table work'];

export function normalizeLoop(loop) {
  return Object.assign({
    id: loop.id,
    name: loop.name || 'Loop',
    audience: { type: 'together', value: null },
    advanceMode: 'per-scheduled-day',
    cursor: 0,
    items: []
  }, loop, { items: (loop.items || []).map(normalizeLoopItem) });
}

export function normalizeLoopItem(item) {
  return Object.assign({
    id: item.id,
    targetType: 'custom', // subcategory | book | task | custom
    targetCatId: null,
    targetBookIndex: null,
    taskLabel: '',
    customText: '',
    tags: { attention: null, mode: null, setting: null }
  }, item, { tags: Object.assign({ attention: null, mode: null, setting: null }, item.tags || {}) });
}

function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// Loop CRUD (pure mutations on the `loops` array; caller owns persistence)
// ---------------------------------------------------------------------------
export function addLoop(loops, loop) {
  loops.push(normalizeLoop(Object.assign({ id: newId('loop') }, loop)));
  return loops;
}
export function renameLoop(loops, loopId, newName) {
  var l = loops.find(function (x) { return x.id === loopId; });
  if (l) l.name = newName;
  return loops;
}
export function deleteLoop(loops, loopId) {
  return loops.filter(function (l) { return l.id !== loopId; });
}
export function moveLoop(loops, loopId, direction) {
  var idx = loops.findIndex(function (l) { return l.id === loopId; });
  if (idx === -1) return loops;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= loops.length) return loops;
  var tmp = loops[idx]; loops[idx] = loops[newIdx]; loops[newIdx] = tmp;
  return loops;
}
export function setLoopAudience(loops, loopId, audience) {
  var l = loops.find(function (x) { return x.id === loopId; });
  if (l) l.audience = audience;
  return loops;
}
export function setLoopAdvanceMode(loops, loopId, mode) {
  var l = loops.find(function (x) { return x.id === loopId; });
  if (l) l.advanceMode = mode;
  return loops;
}

export function addLoopItem(loops, loopId, item) {
  var l = loops.find(function (x) { return x.id === loopId; });
  if (!l) return loops;
  l.items.push(normalizeLoopItem(Object.assign({ id: newId('li') }, item)));
  return loops;
}
export function removeLoopItem(loops, loopId, itemId) {
  var l = loops.find(function (x) { return x.id === loopId; });
  if (!l) return loops;
  l.items = l.items.filter(function (i) { return i.id !== itemId; });
  if (l.cursor >= l.items.length) l.cursor = 0;
  return loops;
}
export function moveLoopItem(loops, loopId, itemId, direction) {
  var l = loops.find(function (x) { return x.id === loopId; });
  if (!l) return loops;
  var idx = l.items.findIndex(function (i) { return i.id === itemId; });
  if (idx === -1) return loops;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= l.items.length) return loops;
  var tmp = l.items[idx]; l.items[idx] = l.items[newIdx]; l.items[newIdx] = tmp;
  return loops;
}
export function updateLoopItem(loops, loopId, itemId, patch) {
  var l = loops.find(function (x) { return x.id === loopId; });
  if (!l) return loops;
  var i = l.items.find(function (x) { return x.id === itemId; });
  if (!i) return loops;
  Object.assign(i, patch);
  if (patch.tags) i.tags = Object.assign({}, i.tags, patch.tags);
  return loops;
}

// ---------------------------------------------------------------------------
// Starter templates. Templates reference subcategories by NAME (matched
// case-insensitively against the family's existing categories at apply-time)
// so nothing about a family's actual curriculum is hardcoded — a template
// only proposes loop *shapes*; unmatched names become 'custom' placeholder
// items the user can repoint later.
// ---------------------------------------------------------------------------
export function loopTemplates() {
  return [
    { id: 'simple-cm', label: 'Simple CM Rhythm', loops: [
      { name: 'Loop A: Language Arts', matchNames: ['Narration (oral)', 'Narration, Dictation + Composition', 'Grammar', 'Literature (incl. Shakespeare)', 'Foreign Language'] },
      { name: 'Loop B: Beauty', matchNames: ['Picture Study', 'Composer Study', 'Poetry + Recitation', 'Hymns + Folk Songs', 'Nature Study', 'Handicrafts'] },
      { name: 'Loop C: History + Natural History', matchNames: ['American History Story', 'World History spine', 'Natural History', 'Botany / Geology / Physiology', 'Astronomy / Chemistry / Physics'] }
    ] },
    { id: 'expanded-family', label: 'Expanded Family Rhythm', loops: [
      { name: 'Bible Loop', matchNames: ['Bible — Family', 'Personal Spiritual Reading', 'Theology / Church History'] },
      { name: 'Reading Loop', matchNames: ['Literature (incl. Shakespeare)', 'American Picture Books', 'Ancient Tales (cycle-matched)'] },
      { name: 'Writing Loop', matchNames: ['Narration, Dictation + Composition', 'Grammar'] },
      { name: 'Riches / Beauty Loop', matchNames: ['Picture Study', 'Composer Study', 'Poetry + Recitation', 'Hymns + Folk Songs'] },
      { name: 'History + Science Loop', matchNames: ['American History Story', 'World History spine', 'Natural History', 'Nature Study'] }
    ] },
    { id: 'blank', label: 'Custom Blank', loops: [] }
  ];
}

export function applyLoopTemplate(categories, templateId) {
  var tpl = loopTemplates().find(function (t) { return t.id === templateId; });
  if (!tpl) return [];
  var byName = {};
  categories.forEach(function (grp) {
    grp.items.forEach(function (cat) { byName[cat.name.toLowerCase()] = cat; });
  });
  return tpl.loops.map(function (loopDef) {
    var items = loopDef.matchNames.map(function (name) {
      var cat = byName[name.toLowerCase()];
      if (cat) return normalizeLoopItem({ id: newId('li'), targetType: 'subcategory', targetCatId: cat.id });
      return normalizeLoopItem({ id: newId('li'), targetType: 'custom', customText: name });
    });
    return normalizeLoop({ id: newId('loop'), name: loopDef.name, items: items });
  });
}

// ---------------------------------------------------------------------------
// Book queue: each book carries its own progress cursor (currentUnit). The
// "next" assignment is whatever sitting starts at currentUnit; advancing the
// queue moves currentUnit forward by `per` (clamped to `tot`).
// ---------------------------------------------------------------------------
export function nextBookSittingNumber(book) {
  var nb = normalizeBook(book);
  return Math.floor((nb.currentUnit || 0) / Math.max(0.01, nb.per)) + 1;
}
export function advanceBookQueue(book) {
  var nb = normalizeBook(book);
  book.currentUnit = Math.min(nb.tot, (nb.currentUnit || 0) + nb.per);
  return book;
}

// Subcategory queue: round-robins across its (active) books via queueCursor.
export function nextBookForSubcategory(cat, absoluteWeekNum) {
  var pool = cat.bks.filter(function (b) { return absoluteWeekNum == null || bookActiveForWeek(b, absoluteWeekNum); });
  if (pool.length === 0) return null;
  var cursor = cat.queueCursor || 0;
  return pool[cursor % pool.length];
}
export function advanceSubcategoryQueue(cat, absoluteWeekNum) {
  var pool = cat.bks.filter(function (b) { return absoluteWeekNum == null || bookActiveForWeek(b, absoluteWeekNum); });
  cat.queueCursor = pool.length ? ((cat.queueCursor || 0) + 1) % pool.length : 0;
  return cat;
}

// ---------------------------------------------------------------------------
// Resolve a loop item to its current concrete assignment text, without
// advancing anything. E.g. "Bible Loop -> Bible — Family -> Matthew -> ch. 1".
// ---------------------------------------------------------------------------
export function resolveLoopItemAssignment(item, categories, absoluteWeekNum) {
  if (item.targetType === 'task') return { text: item.taskLabel || 'Task', catId: null, bookKey: null };
  if (item.targetType === 'custom') return { text: item.customText || '(custom item)', catId: null, bookKey: null };
  if (item.targetType === 'subcategory') {
    var cat = findCategory(categories, item.targetCatId);
    if (!cat) return { text: '(subcategory not found)', catId: null, bookKey: null };
    var book = nextBookForSubcategory(cat, absoluteWeekNum);
    if (!book) return { text: cat.name + ' — not yet assigned', catId: cat.id, bookKey: null };
    var sn = nextBookSittingNumber(book);
    var range = assignmentRangeForSitting(normalizeBook(book), sn);
    var bIdx = cat.bks.indexOf(book);
    return { text: cat.name + ' → ' + book.t + ' (' + range + ')', catId: cat.id, bookKey: cat.id + '#' + bIdx };
  }
  if (item.targetType === 'book') {
    var cat2 = findCategory(categories, item.targetCatId);
    if (!cat2 || item.targetBookIndex == null || !cat2.bks[item.targetBookIndex]) return { text: '(book not found)', catId: null, bookKey: null };
    var book2 = cat2.bks[item.targetBookIndex];
    var sn2 = nextBookSittingNumber(book2);
    var range2 = assignmentRangeForSitting(normalizeBook(book2), sn2);
    return { text: cat2.name + ' → ' + book2.t + ' (' + range2 + ')', catId: cat2.id, bookKey: cat2.id + '#' + item.targetBookIndex };
  }
  return { text: '(unresolved loop item)', catId: null, bookKey: null };
}

// Advance the target queue (book/subcategory) for a loop item, then advance
// the loop's own slot cursor. Call this when an item is checked off.
export function advanceLoopAndQueue(loop, item, categories, absoluteWeekNum) {
  if (item.targetType === 'subcategory') {
    var cat = findCategory(categories, item.targetCatId);
    if (cat) {
      var book = nextBookForSubcategory(cat, absoluteWeekNum);
      if (book) advanceBookQueue(book);
      advanceSubcategoryQueue(cat, absoluteWeekNum);
    }
  } else if (item.targetType === 'book') {
    var cat2 = findCategory(categories, item.targetCatId);
    if (cat2 && item.targetBookIndex != null && cat2.bks[item.targetBookIndex]) {
      advanceBookQueue(cat2.bks[item.targetBookIndex]);
    }
  }
  loop.cursor = loop.items.length ? (loop.cursor + 1) % loop.items.length : 0;
  return loop;
}

// Does a loop apply to a given child (or 'all')? 'together' applies to
// everyone; 'form' applies to children of that Form; 'child' applies only to
// that one child; 'custom-group' applies to an explicit list of child ids.
export function loopAppliesToChild(loop, childId, children) {
  if (childId === 'all') return true;
  var aud = loop.audience || { type: 'together' };
  if (aud.type === 'together') return true;
  if (aud.type === 'form') {
    var child = children.find(function (c) { return c.id === childId; });
    return !!child && child.formId === aud.value;
  }
  if (aud.type === 'child') return aud.value === childId;
  if (aud.type === 'custom-group') return Array.isArray(aud.value) && aud.value.indexOf(childId) > -1;
  return true;
}

// Build Daily View slots purely from loops + their queues — one slot per
// applicable loop per day, each showing only the loop's CURRENT item (not
// every book in the loop/category). Does not mutate/advance anything.
export function buildLoopDailySlots(loops, categories, children, childId, absoluteWeekNum) {
  return loops
    .map(normalizeLoop)
    .filter(function (loop) { return loop.items.length > 0 && loopAppliesToChild(loop, childId, children); })
    .map(function (loop) {
      var item = loop.items[loop.cursor % loop.items.length];
      var resolved = resolveLoopItemAssignment(item, categories, absoluteWeekNum);
      return {
        loopId: loop.id,
        loopName: loop.name,
        itemId: item.id,
        text: loop.name + ': ' + resolved.text,
        catId: resolved.catId,
        bookKey: resolved.bookKey,
        tags: item.tags
      };
    });
}

// ---------------------------------------------------------------------------
// Daily conflict groups & load rules. Keep this simple and editable: a small
// set of named buckets, plus a per-bucket max-per-child-per-day count. Rules
// are NOT applied across "together" vs "individual" audience unless the user
// explicitly opts in (treatTogetherAsIndividualLoad) — family read-alouds
// should never silently block a child's own independent reading.
// ---------------------------------------------------------------------------
export const CONFLICT_GROUPS = ['heavy-reading', 'writing-output', 'hands-on', 'light-beauty', 'skill-practice'];

export function defaultLoadRules() {
  return {
    maxPerConflictGroupPerDay: { 'heavy-reading': 1, 'writing-output': 1 },
    treatTogetherAsIndividualLoad: false
  };
}

// Given a flat list of candidate items for ONE child on ONE day (each item
// optionally carrying {conflictGroup, audienceType}), return {accepted,
// deferred} where `deferred` items exceeded their conflict-group's daily cap
// and were held back (caller may reschedule them to another day/slot).
// Items with no conflictGroup, or whose group has no configured max, always
// pass through. By default, 'together' items don't count against a child's
// individual load (and vice versa) — only same-audience-class items compete.
export function applyDailyLoadRules(items, loadRules) {
  loadRules = loadRules || defaultLoadRules();
  var caps = loadRules.maxPerConflictGroupPerDay || {};
  var treatTogetherAsIndividual = !!loadRules.treatTogetherAsIndividualLoad;
  var counts = {}; // key: (audienceClass)|(conflictGroup) -> count
  var accepted = [], deferred = [];

  function audienceClass(item) {
    if (treatTogetherAsIndividual) return 'all';
    return item.audienceType === 'together' ? 'together' : 'individual';
  }

  items.forEach(function (item) {
    var grp = item.conflictGroup;
    if (!grp || !caps.hasOwnProperty(grp)) { accepted.push(item); return; }
    var key = audienceClass(item) + '|' + grp;
    var cap = caps[grp];
    var used = counts[key] || 0;
    if (used < cap) {
      counts[key] = used + 1;
      accepted.push(item);
    } else {
      deferred.push(item);
    }
  });
  return { accepted: accepted, deferred: deferred };
}

// ---------------------------------------------------------------------------
// View 1: Family Coverage Matrix — "what are we studying". Not week-based.
// Columns = subject/category groups; rows = audience (Together/Family, each
// Form in use, each child, plus any shared-group labels found on books).
// Cells = list of subcategory/book/loop labels assigned to that audience for
// that subject group.
// ---------------------------------------------------------------------------
export function buildFamilyCoverageMatrix(categories, children, loops) {
  loops = loops || [];
  var columns = categories.map(function (grp) { return { grp: grp.grp, col: grp.col }; });

  var formsInUse = [];
  children.forEach(function (c) {
    if (formsInUse.indexOf(c.formId) === -1) formsInUse.push(c.formId);
  });

  var rows = [];
  rows.push({ key: 'together', label: 'All Together / Family', cells: {} });
  formsInUse.forEach(function (fid) {
    var form = FORMS.find(function (f) { return f.id === fid; });
    rows.push({ key: 'form:' + fid, label: form ? form.label : fid, cells: {} });
  });
  children.forEach(function (c) {
    rows.push({ key: 'child:' + c.id, label: c.name, cells: {} });
  });

  function cellFor(row, grpName) {
    if (!row.cells[grpName]) row.cells[grpName] = [];
    return row.cells[grpName];
  }
  function rowsForBook(book, cat, grp) {
    var nb = normalizeBook(book);
    var out = [];
    if (nb.audienceType === 'together' || nb.audienceType === 'shared-group' ||
        nb.audienceType === 'co-op-outside' || nb.audienceType === 'independent') {
      out.push(rows[0]); // Together/Family bucket
    } else {
      var audience = resolveBookAudience(nb, cat, children);
      audience.forEach(function (c) {
        var r = rows.find(function (rr) { return rr.key === 'child:' + c.id; });
        if (r) out.push(r);
      });
    }
    // Also surface on each Form row the category applies to, for an at-a-glance Form view.
    (cat.forms || []).forEach(function (fid) {
      var r = rows.find(function (rr) { return rr.key === 'form:' + fid; });
      if (r) out.push(r);
    });
    return out;
  }

  categories.forEach(function (grp) {
    grp.items.forEach(function (cat) {
      var label = cat.name;
      var loopId = null;
      if (cat.bks.length === 0) {
        var r0 = rows[0];
        cellFor(r0, grp.grp).push(label + ' — not yet assigned');
        return;
      }
      cat.bks.forEach(function (book) {
        var nb = normalizeBook(book);
        var entry = cat.name + ': ' + nb.t;
        if (nb.scheduleStyle === 'loop-rotation') {
          loopId = resolveBookLoopId(nb, cat, grp);
          var loop = loops.find(function (l) { return l.id === loopId; });
          entry += loop ? ' (' + loop.name + ')' : ' (needs loop)';
        }
        rowsForBook(nb, cat, grp).forEach(function (row) {
          var cell = cellFor(row, grp.grp);
          if (cell.indexOf(entry) === -1) cell.push(entry);
        });
      });
    });
  });

  return { columns: columns, rows: rows };
}

// ---------------------------------------------------------------------------
// View 2: Term Chart — "where the plan says we are going". Rows =
// subject/book/loop item (grouped under subject headers); columns = Week 1..N
// for the given term. Cells = planned assignment text for that week.
// Filters: 'all' (whole family), a childId, or a Form id ('form:<id>').
// ---------------------------------------------------------------------------
export function buildTermChart(categories, children, schoolYear, term, filter, opts) {
  opts = opts || {};
  var ranges = termRanges(schoolYear);
  var range = ranges[term];
  if (!range) return { weeks: [], groups: [] };
  var weeks = [];
  for (var w = range[0]; w <= range[1]; w++) weeks.push(w);
  var examWeeks = examWeeksFor(schoolYear);

  var filterChild = null;
  if (filter && filter !== 'all' && filter.indexOf('form:') !== 0) {
    filterChild = children.find(function (c) { return c.id === filter; });
  }
  var filterFormId = filter && filter.indexOf('form:') === 0 ? filter.slice(5) : null;

  function rowApplies(cat) {
    if (filterFormId) return (cat.forms || []).indexOf(filterFormId) > -1;
    if (filterChild) return childrenForCategory(cat, children).indexOf(filterChild) > -1;
    return true; // 'all'
  }

  var groups = [];
  categories.forEach(function (grp) {
    var rows = [];
    grp.items.forEach(function (cat) {
      if (!rowApplies(cat)) return;
      cat.bks.forEach(function (book, bIdx) {
        var nb = normalizeBook(book);
        if (filterChild) {
          var aud = resolveBookAudience(nb, cat, children);
          if (nb.audienceType === 'individual' && aud.indexOf(filterChild) === -1) return;
        }
        var bookKey = cat.id + '#' + bIdx;
        var rowCells = {};
        weeks.forEach(function (wk) {
          if (examWeeks.indexOf(wk) > -1) { rowCells[wk] = 'Exam week'; return; }
          if (!bookActiveForWeek(nb, wk)) { rowCells[wk] = ''; return; }
          var contentWeekIndex = Math.max(0, wk - 1 - (opts.behindWeeks || 0));
          var sittingNumber = sittingNumberForBook(nb, wk, contentWeekIndex);
          rowCells[wk] = assignmentRangeForSitting(nb, sittingNumber);
        });
        rows.push({ catId: cat.id, bookKey: bookKey, label: cat.name + ': ' + nb.t, cells: rowCells, scheduleStyle: nb.scheduleStyle });
      });
    });
    if (rows.length) groups.push({ grp: grp.grp, col: grp.col, rows: rows });
  });

  return { weeks: weeks, examWeeks: examWeeks, groups: groups };
}

// ---------------------------------------------------------------------------
// Needs Decisions v2 — kinder, grouped, actionable. A subcategory with no
// books is NOT automatically urgent: it carries a `decisionStatus` that the
// user sets once and which then keeps it out of the urgent list forever
// (until they change their mind). Loop-assignment gaps are always
// "Scheduling" decisions since a loop-rotation book genuinely cannot run
// without one.
// ---------------------------------------------------------------------------
export const DECISION_STATUSES = ['active', 'optional', 'practice-no-book', 'manual-only', 'co-op-external', 'ignored'];
export const DECISION_STATUS_LABELS = {
  active: 'Active (needs a decision)',
  optional: 'Optional',
  'practice-no-book': 'Practice / no book needed',
  'manual-only': 'Manual only',
  'co-op-external': 'Co-op / external',
  ignored: 'Ignore this year'
};

// Subcategories with no decisionStatus set default to 'active' so existing
// data (pre-dating this feature) behaves exactly as before.
export function resolveDecisionStatus(cat) {
  return cat.decisionStatus || 'active';
}
export function setSubcategoryDecisionStatus(cat, status) {
  cat.decisionStatus = DECISION_STATUSES.indexOf(status) > -1 ? status : 'active';
  return cat;
}

// Returns { required, helpful, optional, hidden } — each an array of
// { type, text, grpName, catName, catId, bookKey, status, actions }.
// `actions` is a list of action keys the UI can offer as quick-action buttons.
// "required" blocks scheduling outright; "helpful" is a nudge, not a problem;
// "optional" is something the user already chose not to treat as a gap;
// "hidden" is fully ignored-this-year items, kept visible only so they can
// be reactivated later.
export function buildReviewCenter(categories, familySetup) {
  var out = { required: [], helpful: [], optional: [], hidden: [] };

  if (!familySetup || !familySetup.children || familySetup.children.length === 0) {
    out.required.push({ type: 'required', text: 'Add at least one child to get started.', actions: ['goSetup'] });
  }
  if (!categories || categories.length === 0) {
    out.required.push({ type: 'required', text: 'Add subjects to plan your year.', actions: ['goCats'] });
  }

  findBooksNeedingLoopAssignment(categories || []).forEach(function (n) {
    out.required.push({
      type: 'required', text: n.grpName + ' — ' + n.catName + ': "' + n.title + '" needs a loop chosen.',
      grpName: n.grpName, catName: n.catName, catId: n.catId, bookKey: n.bookKey,
      actions: ['chooseRhythm']
    });
  });

  (categories || []).forEach(function (grp) {
    grp.items.forEach(function (cat) {
      if (cat.bks.length > 0) return;
      var status = resolveDecisionStatus(cat);
      var entry = {
        type: 'helpful', text: grp.grp + ' — ' + cat.name + ' has no books yet.',
        grpName: grp.grp, catName: cat.name, catId: cat.id, status: status,
        actions: ['addBook', 'assignAudience', 'markPractice', 'markManual', 'markCoop', 'makeOptional', 'ignoreYear']
      };
      if (status === 'active') out.helpful.push(entry);
      else if (status === 'ignored') out.hidden.push(Object.assign({}, entry, {
        text: grp.grp + ' — ' + cat.name + ': ' + DECISION_STATUS_LABELS[status]
      }));
      else out.optional.push(Object.assign({}, entry, {
        text: grp.grp + ' — ' + cat.name + ': ' + DECISION_STATUS_LABELS[status]
      }));
    });
  });

  return out;
}
// Back-compat alias.
export function buildNeedsDecisions(categories, familySetup) { return buildReviewCenter(categories, familySetup); }
export function countUrgentDecisions(decisions) {
  return decisions.required.length + decisions.helpful.length;
}

// ---------------------------------------------------------------------------
// Who Does What — editable planning workspace. Moving a subject's audience
// is just setting audienceType/sharedGroupLabel/assignedChildren on every
// book in that subcategory (the common case: a whole subcategory moves as a
// unit). Custom groups are just a sharedGroupLabel the user types/picks.
// ---------------------------------------------------------------------------
export function setCategoryAudience(cat, audience) {
  // audience: { type: 'together'|'shared-group'|'individual', sharedGroupLabel?, assignedChildren?: [childId,...] }
  cat.bks.forEach(function (b) {
    b.audienceType = audience.type;
    b.sharedGroupLabel = audience.type === 'shared-group' ? (audience.sharedGroupLabel || 'Shared group') : '';
    b.assignedChildren = audience.type === 'individual' ? (audience.assignedChildren || []) : null;
  });
  // Once a human has actively placed it, it's never "needs placement" again.
  cat.placementResolved = true;
  return cat;
}

// A subcategory "needs placement" (rather than defaulting silently to
// Together) when nobody has ever actively chosen an audience for it AND it
// isn't already marked optional/practice/manual/co-op/ignored (those are
// resolved on purpose, just not via an audience). This only affects how the
// Who Does What planning workspace groups things — it does not change
// normalizeBook()'s scheduling default, so existing scheduling math is
// unaffected.
export function categoryNeedsPlacement(cat) {
  if (!cat.bks.length) return false;
  if (resolveDecisionStatus(cat) !== 'active') return false;
  if (cat.placementResolved) return false;
  return cat.bks.every(function (b) {
    return !Object.prototype.hasOwnProperty.call(b, 'audienceType') && !Object.prototype.hasOwnProperty.call(b, 'who');
  });
}

// Resolve the Who Does What lane id for a subcategory: 'together' |
// 'group:<label>' | 'individual' | 'co-op' | 'independent' | 'optional' |
// 'needs-placement'. Subcategories with no books at all aren't placed here —
// they show up in the Review Center as content gaps instead.
export function categoryAudienceLane(cat) {
  if (!cat.bks.length) return null;
  var status = resolveDecisionStatus(cat);
  if (status !== 'active') return 'optional';
  if (categoryNeedsPlacement(cat)) return 'needs-placement';
  var nb = normalizeBook(cat.bks[0]);
  if (nb.audienceType === 'shared-group') return 'group:' + (nb.sharedGroupLabel || 'Shared group');
  if (nb.audienceType === 'co-op-outside') return 'co-op';
  if (nb.audienceType === 'independent') return 'independent';
  if (nb.audienceType === 'individual') return 'individual';
  return 'together';
}

// Build the Plan Workspace lanes: a fixed set of well-known lanes (Together,
// Individual children, Co-op/Outside, Optional/Not this year, Needs
// placement) plus one lane per custom group label in use, each containing
// compact chip descriptors for its subcategories.
export function buildPlanWorkspaceLanes(categories, familySetup) {
  var lanes = {
    'needs-placement': { id: 'needs-placement', label: 'Needs placement', chips: [] },
    together: { id: 'together', label: 'All Together / Family', chips: [] },
    individual: { id: 'individual', label: 'Individual children', chips: [] },
    'co-op': { id: 'co-op', label: 'Co-op / Outside', chips: [] },
    independent: { id: 'independent', label: 'Independent Work', chips: [] },
    optional: { id: 'optional', label: 'Optional / Not this year', chips: [] }
  };
  var customLanes = [];
  (categories || []).forEach(function (grp) {
    grp.items.forEach(function (cat) {
      var laneId = categoryAudienceLane(cat);
      if (!laneId) return;
      var nb = cat.bks.length ? normalizeBook(cat.bks[0]) : {};
      var chip = {
        catId: cat.id, grpName: grp.grp, catName: cat.name, color: grp.col,
        bookCount: cat.bks.length, status: resolveDecisionStatus(cat),
        assignedChildren: nb.assignedChildren || []
      };
      if (laneId.indexOf('group:') === 0) {
        var label = laneId.slice(6);
        var lane = lanes[laneId];
        if (!lane) { lane = { id: laneId, label: label, chips: [] }; lanes[laneId] = lane; customLanes.push(lane); }
        lane.chips.push(chip);
      } else if (lanes[laneId]) {
        lanes[laneId].chips.push(chip);
      }
    });
  });
  var order = ['needs-placement', 'together'].concat(customLanes.map(function (l) { return l.id; }))
    .concat(['individual', 'co-op', 'independent', 'optional']);
  return order.map(function (id) { return lanes[id]; }).filter(Boolean);
}

// Distinct custom-group labels currently in use across all books, for the
// Who Does What "move to a custom group" picker.
export function listCustomGroupLabels(categories) {
  var seen = {}, out = [];
  (categories || []).forEach(function (grp) {
    grp.items.forEach(function (cat) {
      cat.bks.forEach(function (b) {
        var nb = normalizeBook(b);
        if (nb.audienceType === 'shared-group' && nb.sharedGroupLabel && !seen[nb.sharedGroupLabel]) {
          seen[nb.sharedGroupLabel] = true;
          out.push(nb.sharedGroupLabel);
        }
      });
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------
function csvCell(v) {
  v = v == null ? '' : String(v);
  if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}
export function termChartToCSV(termChart) {
  var header = ['Subject', 'Item'].concat(termChart.weeks.map(function (w) { return 'Wk ' + w; }));
  var rows = [header];
  termChart.groups.forEach(function (g) {
    g.rows.forEach(function (r) {
      rows.push([g.grp, r.label].concat(termChart.weeks.map(function (w) { return r.cells[w] || ''; })));
    });
  });
  return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
}
export function bookProgressToCSV(categories, children, schoolYear) {
  var header = ['Group', 'Subject', 'Book', 'Status', 'Current unit', 'Total', '% complete'];
  var rows = [header];
  (categories || []).forEach(function (grp) {
    grp.items.forEach(function (cat) {
      cat.bks.forEach(function (b) {
        var nb = normalizeBook(b);
        var pct = nb.tot > 0 ? Math.min(100, Math.round(((nb.currentUnit || 0) / nb.tot) * 100)) : 0;
        rows.push([grp.grp, cat.name, nb.t, nb.status, nb.currentUnit || 0, nb.tot, pct]);
      });
    });
  });
  return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
}

// ---------------------------------------------------------------------------
// Long-term year tools. These operate on the whole app-data object (the same
// shape as freshAppData()/validateAppData()) and always return a NEW object —
// callers should treat appData as immutable input and swap in the result.
// ---------------------------------------------------------------------------
export function duplicateYear(appData) {
  var copy = deepClone(appData);
  copy.overrides = {};
  copy.uiState = Object.assign({}, appData.uiState, { behind: 0 });
  copy.categories.forEach(function (grp) {
    grp.items.forEach(function (cat) {
      cat.queueCursor = 0;
      cat.bks.forEach(function (b) {
        b.currentUnit = 0;
        b.status = 'active';
        b.pauseUntilWeek = null;
      });
    });
  });
  (copy.loops || []).forEach(function (l) { l.cursor = 0; });
  return copy;
}

export function archiveYear(appData, label) {
  var copy = deepClone(appData);
  copy.archived = true;
  copy.archivedLabel = label || ('Archived ' + new Date().toISOString().slice(0, 10));
  return copy;
}

export function resetProgress(appData) {
  var copy = deepClone(appData);
  copy.overrides = {};
  copy.uiState = Object.assign({}, appData.uiState, { behind: 0 });
  copy.categories.forEach(function (grp) {
    grp.items.forEach(function (cat) {
      cat.queueCursor = 0;
      cat.bks.forEach(function (b) {
        b.currentUnit = 0;
        b.status = b.status === 'dropped' ? 'dropped' : 'active';
        b.pauseUntilWeek = null;
      });
    });
  });
  (copy.loops || []).forEach(function (l) { l.cursor = 0; });
  return copy;
}

export function keepSetupChooseNewCycle(appData, newCycleId) {
  var copy = deepClone(appData);
  copy.familySetup.historyCycleId = newCycleId;
  return copy;
}
