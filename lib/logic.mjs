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
    overrides: {}
  };
}

// ---------------------------------------------------------------------------
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
    autoSchedule: true
  }, b);
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
        var item = { text: text, catId: cat.id, bookKey: bookKey, priority: nb.priority, manual: ov != null };
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
      var cat = findCategory(categories, item.catId);
      var freq = cat ? cat.freq : 1;
      var occurrences = freq >= 4 ? days : Math.max(1, Math.round(freq));
      pickDaySlots(days, occurrences).forEach(function (dayNum) {
        addToDay(dayNum, groupOut.grp, groupOut.col, item);
      });
    });
  });
  return daysOut;
}
