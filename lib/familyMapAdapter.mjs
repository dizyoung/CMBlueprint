// Family School Map — Phase 1A adapter.
//
// Pure, dependency-free glue between the lib/familyMap.mjs data model and a
// renderable "app state" shape. Owns: building a sample in-memory app state
// from the model's factory functions, deriving map/lens/resource views from
// that state, and a small set of safe in-memory editing mutators.
//
// No DOM, no localStorage, no fetch — runs unmodified under plain `node` so
// every piece of render/derivation logic here can be unit tested without a
// browser. The HTML app (docs/app/family-school-map.html) is a thin renderer
// on top of this module; it should not duplicate this logic.

import * as M from './familyMap.mjs';
import * as R from './weeklyRhythm.mjs';

// ---------------------------------------------------------------------------
// Not built yet — model notes only. "Today" (what exact assignment comes
// next, right now) is intentionally out of scope through Phase 1B. When it
// is eventually built, it will need to read from: the Family School Map
// (cards/participants), the Weekly Rhythm (which buckets apply today),
// loops/sequences (current item per loop/sequence), resource progress
// (buildResourceRollup), and some not-yet-built schedule/calendar config
// (which day-of-week maps to which RhythmDay). Today should wait until
// those planning layers agree with each other; it must not be approximated
// here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sample in-memory app state
// ---------------------------------------------------------------------------
// One app-state object holds every collection Phase 1A needs to render the
// map, the lenses, loops, sequences, and the Book & Resource List. This is
// in-memory only — nothing here touches storage of any kind.
export function buildSampleAppState() {
  var students = [
    M.makeStudent({ id: 'charis', name: 'Charis', initials: 'C', color: '#e08a3c', gradeBand: 'form1', grade: '2nd', sortOrder: 0 }),
    M.makeStudent({ id: 'kayla', name: 'Kayla', initials: 'K', color: '#5c9e8f', gradeBand: 'form1', grade: '3rd', sortOrder: 1 }),
    M.makeStudent({ id: 'lucy', name: 'Lucy', initials: 'L', color: '#b5708a', gradeBand: 'form2', grade: '5th', sortOrder: 2 }),
    M.makeStudent({ id: 'jeremiah', name: 'Jeremiah', initials: 'J', color: '#3f7a82', gradeBand: 'form3', grade: '7th', sortOrder: 3 })
  ];

  var groups = [
    M.makeGroup({ id: 'older', label: 'Older Students', studentIds: ['lucy', 'jeremiah'], sortOrder: 0 }),
    M.makeGroup({ id: 'littles', label: 'Littles Together', studentIds: ['charis', 'kayla'], sortOrder: 1 })
  ];

  var subjectColumns = M.DEFAULT_VISIBLE_SUBJECT_COLUMNS.map(function (col, index) {
    return M.makeSubjectColumn({ id: col.id, label: col.label, color: col.color, sortOrder: index });
  });

  var loops = [
    M.makeLoop({
      id: 'loop_bible', title: 'Bible Loop', subjectColumnId: 'bible', audience: 'together',
      participantMode: 'together', turnsPerWeek: 4,
      itemIds: ['li_matthew', 'li_psalms', 'li_theology', 'li_ot'], currentItemId: 'li_matthew',
      momNeeded: 'yes', approxTimeLabel: 'about 10–15 min', touchesPerWeek: 4, itemsPerTouch: 1, kindOfAttention: 'read-aloud'
    })
  ];
  var loopItems = [
    M.makeLoopItem({ id: 'li_matthew', loopId: 'loop_bible', title: 'Matthew', resourceUseIds: ['ruse_bible_loop'], nextAssignment: 'chapter 1', sortOrder: 0, linkedCardId: 'card_bible' }),
    M.makeLoopItem({ id: 'li_psalms', loopId: 'loop_bible', title: 'Psalms + Proverbs', resourceUseIds: ['ruse_bible_loop'], nextAssignment: 'Psalm 1', sortOrder: 1, linkedCardId: 'card_bible' }),
    M.makeLoopItem({ id: 'li_theology', loopId: 'loop_bible', title: 'Theology', resourceUseIds: ['ruse_theology'], nextAssignment: 'lesson 1', sortOrder: 2, linkedCardId: 'card_bible' }),
    M.makeLoopItem({ id: 'li_ot', loopId: 'loop_bible', title: 'Old Testament', resourceUseIds: ['ruse_bible_loop'], nextAssignment: 'Genesis 1', sortOrder: 3, linkedCardId: 'card_bible' })
  ];

  var sequences = [
    M.makeSequence({
      id: 'seq_readaloud', title: 'Family Read-Alouds', subjectColumnId: 'literature', audience: 'together',
      participantMode: 'together', itemIds: ['si_1', 'si_2', 'si_3'], currentItemId: 'si_2'
    })
  ];
  var sequenceItems = [
    M.makeSequenceItem({ id: 'si_1', sequenceId: 'seq_readaloud', title: 'The Hobbit', status: 'completed', position: 0 }),
    M.makeSequenceItem({ id: 'si_2', sequenceId: 'seq_readaloud', title: "Charlotte's Web", status: 'current', position: 1, resourceUseIds: ['ruse_charlottesweb'], nextAssignment: 'chapter 4' }),
    M.makeSequenceItem({ id: 'si_3', sequenceId: 'seq_readaloud', title: 'The Wind in the Willows', status: 'upcoming', position: 2 })
  ];

  var extensionWorks = [];

  // Shorthand helpers for building sample cards concisely
  function c(fields) { return M.makeCard(fields); }
  var ALL = [];
  var F1 = ['form1'];
  var F2 = ['form2'];
  var F3 = ['form3'];
  var F12 = ['form1', 'form2'];
  var F23 = ['form2', 'form3'];
  var F13 = ['form1', 'form3'];

  var cards = [
    // -----------------------------------------------------------------------
    // Bible / Faith
    // -----------------------------------------------------------------------
    c({
      id: 'card_bible', title: 'Bible Loop', subjectColumnId: 'bible',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'active', formApplicability: ALL, loopId: 'loop_bible',
      suggestedWeeklyTouches: 'daily', scheduleStyleSuggestion: 'family-rhythm',
      scheduleConfig: M.makeScheduleConfig({ mode: 'loop', loopId: 'loop_bible' }),
      // Family Scripture reading: PNEU-inspired range. Together time sized to
      // the youngest; older students engage more deeply in discussion/narration.
      lessonTimeConfig: M.makeLessonTimeConfig({ minMinutes: 10, targetMinutes: 15, maxMinutes: 15, hardMaxMinutes: 20 }),
      notes: 'Morning Scripture and Bible reading together. Loop rotates through Old Testament, Gospels, Psalms/Proverbs, and theology as the family grows.'
    }),
    c({
      id: 'card_scripture_mem', title: 'Scripture Memory / Recitation', subjectColumnId: 'bible',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      suggestedWeeklyTouches: '3–5x/week', scheduleStyleSuggestion: 'family-rhythm',
      notes: 'Short daily or alternate-day practice — no separate curriculum needed.'
    }),
    c({
      id: 'card_devotional', title: 'Personal Devotional Reading', subjectColumnId: 'bible',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      suggestedWeeklyTouches: '3–5x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Independent reading for older students — adjust per learner.'
    }),
    c({
      id: 'card_theology', title: 'Theology / Church History', subjectColumnId: 'bible',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'optional',
      planningStatus: 'optional', formApplicability: F3,
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'fixed-or-loop',
      resourceUseIds: ['ruse_theology'],
      notes: 'Optional for older students. Typical Form III introduction.'
    }),
    // -----------------------------------------------------------------------
    // Language Arts
    // -----------------------------------------------------------------------
    c({
      id: 'card_phonics', title: 'Reading Practice / Phonics', subjectColumnId: 'language-arts',
      audience: 'group', participantMode: 'group', participantIds: ['littles'], status: 'active',
      planningStatus: 'active', formApplicability: F1,
      suggestedWeeklyTouches: 'daily', scheduleStyleSuggestion: 'fixed',
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form1'),
      notes: 'Short daily lesson — adjust when reading fluency is established.'
    }),
    c({
      id: 'card_copywork', title: 'Copywork', subjectColumnId: 'language-arts',
      audience: 'group', participantMode: 'group', participantIds: ['littles'], status: 'active',
      planningStatus: 'active', formApplicability: F12,
      suggestedWeeklyTouches: '3–5x/week', scheduleStyleSuggestion: 'fixed',
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form1'),
      notes: 'Short daily or alternate-day practice. No separate book needed beyond a handwriting resource.'
    }),
    c({
      id: 'card_dictation', title: 'Dictation', subjectColumnId: 'language-arts',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      suggestedWeeklyTouches: '1–2x/week', scheduleStyleSuggestion: 'fixed',
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form2')
    }),
    c({
      id: 'card_grammar', title: 'Grammar', subjectColumnId: 'language-arts',
      audience: 'individual', participantMode: 'individual', participantIds: ['lucy'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      suggestedWeeklyTouches: '1–2x/week', scheduleStyleSuggestion: 'fixed-or-loop',
      resourceUseIds: ['ruse_grammar'],
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form2')
    }),
    c({
      id: 'card_written_narration', title: 'Written Narration', subjectColumnId: 'language-arts',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      suggestedWeeklyTouches: '2–4x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Narration follows readings — no separate curriculum needed.'
    }),
    c({
      id: 'card_recitation', title: 'Recitation / Memory Work', subjectColumnId: 'language-arts',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      suggestedWeeklyTouches: '2–4x/week', scheduleStyleSuggestion: 'family-rhythm',
      notes: 'Poems, prayers, catechism — rotate what is being memorized each term.'
    }),
    // -----------------------------------------------------------------------
    // Literature
    // -----------------------------------------------------------------------
    c({
      id: 'card_readaloud', title: 'Family Read-Alouds', subjectColumnId: 'literature',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'active', formApplicability: ALL, sequenceId: 'seq_readaloud',
      suggestedWeeklyTouches: '3–5x/week', scheduleStyleSuggestion: 'fixed',
      scheduleConfig: M.makeScheduleConfig({ mode: 'sequence', sequenceId: 'seq_readaloud' }),
      notes: 'Charlotte Mason placed great value on the family read-aloud. One living book at a time.'
    }),
    c({
      id: 'card_tales', title: 'Tales / Fairy Tales / Myths', subjectColumnId: 'literature',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'active', formApplicability: F12,
      suggestedWeeklyTouches: '1–2x/week', scheduleStyleSuggestion: 'fixed-or-loop',
      notes: 'Oral or read-aloud. Rotate topics — Norse, Greek, fairy tales, etc.'
    }),
    c({
      id: 'card_indep_lit', title: 'Independent Literature', subjectColumnId: 'literature',
      audience: 'individual', participantMode: 'individual', participantIds: ['lucy'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      suggestedWeeklyTouches: '3–5x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Living books assigned per student. Narration follows each reading.'
    }),
    c({
      id: 'card_shakespeare', title: 'Shakespeare', subjectColumnId: 'literature',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'optional',
      planningStatus: 'optional', formApplicability: F3,
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      notes: 'One play per term or year. Read aloud together or in parts. Optional for Form II+.'
    }),
    // -----------------------------------------------------------------------
    // History
    // Two parallel strands for older students mirror the old planner CYCLES data
    // in lib/logic.mjs: History — World (4-year cycle) and History — American.
    // -----------------------------------------------------------------------
    c({
      id: 'card_early_history', title: 'Early History Stories', subjectColumnId: 'history',
      audience: 'group', participantMode: 'group', participantIds: ['littles'], status: 'active',
      planningStatus: 'active', formApplicability: F1,
      suggestedWeeklyTouches: '2x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Stories from antiquity, myths, and early civilizations suited to younger students.'
    }),
    c({
      id: 'card_history_spine', title: 'World History Spine', subjectColumnId: 'history',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      mapGroup: 'History Cycle',
      strandLabels: ['Modern Times — World History Spine'],
      suggestedWeeklyTouches: '2–3x/week', scheduleStyleSuggestion: 'fixed',
      resourceUseIds: ['ruse_history_spine'],
      lessonTimeConfig: M.makeLessonTimeConfig({ minMinutes: 20, targetMinutes: 25, maxMinutes: 30, hardMaxMinutes: 30, timeOwnership: 'shared' }),
      notes: 'Cycle-matched world history spine — SOTW, Mystery of History, Biblioplan, or similar.'
    }),
    c({
      id: 'card_american_history', title: 'American History', subjectColumnId: 'history',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      mapGroup: 'History Cycle',
      strandLabels: ['American History Spine', 'American History Story', 'American Picture Books'],
      suggestedWeeklyTouches: '2x/week', scheduleStyleSuggestion: 'fixed',
      resourceUseIds: ['ruse_american_history'],
      notes: 'American history strand — runs alongside world history cycle. Choose a living narrative spine.'
    }),
    c({
      id: 'card_biography', title: 'Biography', subjectColumnId: 'history',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      mapGroup: 'History Cycle',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      notes: 'Living biographies — rotate figures across history. Loop-friendly.'
    }),
    c({
      id: 'card_timeline', title: 'Timeline / Book of Centuries', subjectColumnId: 'history',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'practice-no-book', formApplicability: F23,
      mapGroup: 'History Cycle',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Entries added as history is read — no separate text needed.'
    }),
    // -----------------------------------------------------------------------
    // Geography (includes Citizenship)
    // -----------------------------------------------------------------------
    c({
      id: 'card_mapwork', title: 'Map Work', subjectColumnId: 'geography',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'active', formApplicability: ALL,
      suggestedWeeklyTouches: '1–2x/week', scheduleStyleSuggestion: 'fixed-or-loop',
      notes: 'Tied to history and geography reading — sketch maps, fill-in maps, atlas use.'
    }),
    c({
      id: 'card_geo_reader', title: 'Geography Reader', subjectColumnId: 'geography',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      mapGroup: 'Geography',
      suggestedWeeklyTouches: '1–2x/week', scheduleStyleSuggestion: 'loop',
      resourceUseIds: ['ruse_geo_reader'],
      notes: 'Living geography books — rotate regions or topics. Loop-friendly.'
    }),
    c({
      id: 'card_citizenship_gov', title: 'Citizenship / Government', subjectColumnId: 'geography',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      mapGroup: 'Citizenship',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'fixed-or-loop'
    }),
    c({
      id: 'card_current_events', title: 'Current Events', subjectColumnId: 'geography',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'optional',
      planningStatus: 'optional', formApplicability: F3,
      mapGroup: 'Citizenship',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      notes: 'Discussion-based. Loop or fixed slot — adjust to family rhythm.'
    }),
    c({
      id: 'card_plutarch', title: 'Plutarch', subjectColumnId: 'geography',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'optional',
      planningStatus: 'optional', formApplicability: F3,
      mapGroup: 'Citizenship',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      resourceUseIds: ['ruse_plutarch'],
      notes: 'Optional for Form III. One life per term — read aloud and discuss.'
    }),
    // -----------------------------------------------------------------------
    // Science / Nature
    // -----------------------------------------------------------------------
    c({
      id: 'card_nature_study', title: 'Nature Study', subjectColumnId: 'science',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      mapGroup: 'Nature Study',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Outdoor observation — nature notebooks, field guides, unhurried time outside.'
    }),
    c({
      id: 'card_nature_notebook', title: 'Nature Notebook', subjectColumnId: 'science',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      mapGroup: 'Nature Study',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      notes: 'Drawing, labeling, and recording from nature outings. Loop-friendly.'
    }),
    c({
      id: 'card_object_lessons', title: 'Object Lessons / Early Science', subjectColumnId: 'science',
      audience: 'group', participantMode: 'group', participantIds: ['littles'], status: 'active',
      planningStatus: 'active', formApplicability: F1,
      suggestedWeeklyTouches: '1–2x/week', scheduleStyleSuggestion: 'loop',
      notes: 'Simple hands-on science observation. Loop through topics — seasons, animals, plants.'
    }),
    c({
      id: 'card_living_science', title: 'General Science', subjectColumnId: 'science',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      suggestedWeeklyTouches: '2x/week', scheduleStyleSuggestion: 'fixed-or-loop',
      resourceUseIds: ['ruse_living_science']
    }),
    c({
      id: 'card_upper_science', title: 'Upper Science', subjectColumnId: 'science',
      audience: 'coop-outside', participantMode: 'coop', participantIds: ['jeremiah'], status: 'coop',
      planningStatus: 'co-op-external', formApplicability: F3,
      suggestedWeeklyTouches: '2–3x/week', scheduleStyleSuggestion: 'co-op-external',
      scheduleConfig: M.makeScheduleConfig({ mode: 'coop', outsideProvider: 'Greenhouse Co-op' })
    }),
    // -----------------------------------------------------------------------
    // Math
    // -----------------------------------------------------------------------
    c({
      id: 'card_math_charis', title: 'Math', subjectColumnId: 'math',
      audience: 'individual', participantMode: 'individual', participantIds: ['charis'], status: 'active',
      planningStatus: 'active', formApplicability: ALL,
      suggestedWeeklyTouches: 'daily', scheduleStyleSuggestion: 'fixed',
      resourceUseIds: ['ruse_math_charis'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 4 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form1')
    }),
    c({
      id: 'card_math_kayla', title: 'Math', subjectColumnId: 'math',
      audience: 'individual', participantMode: 'individual', participantIds: ['kayla'], status: 'active',
      planningStatus: 'active', formApplicability: ALL,
      suggestedWeeklyTouches: 'daily', scheduleStyleSuggestion: 'fixed',
      resourceUseIds: ['ruse_math_kayla'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 4 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form1')
    }),
    c({
      id: 'card_math_lucy', title: 'Math', subjectColumnId: 'math',
      audience: 'individual', participantMode: 'individual', participantIds: ['lucy'], status: 'active',
      planningStatus: 'active', formApplicability: ALL,
      suggestedWeeklyTouches: 'daily', scheduleStyleSuggestion: 'fixed',
      resourceUseIds: ['ruse_math_lucy'],
      scheduleConfig: M.makeScheduleConfig({ mode: 'weekly', timesPerWeek: 4 }),
      lessonTimeConfig: M.lessonTimeConfigFromGradeBand('form2')
    }),
    c({
      id: 'card_mental_math', title: 'Mental Math', subjectColumnId: 'math',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      suggestedWeeklyTouches: '2–5x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Quick oral math — no curriculum needed. Adjust frequency by age.'
    }),
    c({
      id: 'card_practical_math', title: 'Practical Math / Arithmetic Games', subjectColumnId: 'math',
      audience: 'group', participantMode: 'group', participantIds: ['littles'], status: 'active',
      planningStatus: 'practice-no-book', formApplicability: F12,
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      notes: 'Games, cooking math, measuring. Loop-friendly.'
    }),
    // -----------------------------------------------------------------------
    // Beauty / Riches
    // -----------------------------------------------------------------------
    c({
      id: 'card_hymn', title: 'Hymn', subjectColumnId: 'beauty',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      mapGroup: 'Beauty Loop',
      suggestedWeeklyTouches: '1–2x/week', scheduleStyleSuggestion: 'loop',
      notes: 'One hymn per term, learned together. Beauty Loop with Folk Song and others.'
    }),
    c({
      id: 'card_folksong', title: 'Folk Song', subjectColumnId: 'beauty',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      mapGroup: 'Beauty Loop',
      suggestedWeeklyTouches: '1–2x/week', scheduleStyleSuggestion: 'loop',
      notes: 'One folk song per term. Beauty Loop.'
    }),
    c({
      id: 'card_poetry', title: 'Poetry', subjectColumnId: 'beauty',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      mapGroup: 'Beauty Loop',
      suggestedWeeklyTouches: '2–4x/week', scheduleStyleSuggestion: 'loop',
      notes: 'Read aloud, memorize, enjoy. Rotate poets each term.'
    }),
    c({
      id: 'card_picture_study', title: 'Picture Study', subjectColumnId: 'beauty',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'active', formApplicability: ALL,
      mapGroup: 'Beauty Loop',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      resourceUseIds: ['ruse_picture_study'],
      notes: 'One artist per term — study 6 works before moving on. Beauty Loop.'
    }),
    c({
      id: 'card_composer_study', title: 'Composer Study', subjectColumnId: 'beauty',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'active', formApplicability: ALL,
      mapGroup: 'Beauty Loop',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      resourceUseIds: ['ruse_composer_study'],
      notes: 'One composer per term — listen, identify, enjoy. Beauty Loop.'
    }),
    // -----------------------------------------------------------------------
    // Arts / Handicrafts
    // -----------------------------------------------------------------------
    c({
      id: 'card_drawing', title: 'Drawing / Brush Drawing', subjectColumnId: 'arts',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'active', formApplicability: ALL,
      mapGroup: 'Handicraft & Arts',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      resourceUseIds: ['ruse_drawing'],
      notes: 'Observation drawing, nature drawing, or method drawing. Riches Loop.'
    }),
    c({
      id: 'card_handicraft', title: 'Handicraft', subjectColumnId: 'arts',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      mapGroup: 'Handicraft & Arts',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      notes: 'Knitting, sewing, woodwork, or other handwork. Riches Loop.'
    }),
    c({
      id: 'card_sloyd', title: 'Sloyd / Practical Skill', subjectColumnId: 'arts',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'optional',
      planningStatus: 'optional', formApplicability: F23,
      mapGroup: 'Handicraft & Arts',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'loop',
      notes: 'Traditional handwork for older students — optional. Riches Loop.'
    }),
    // -----------------------------------------------------------------------
    // PE / Health
    // -----------------------------------------------------------------------
    c({
      id: 'card_pe', title: 'Physical Education', subjectColumnId: 'pe',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      mapGroup: 'PE & Health',
      suggestedWeeklyTouches: '3–5x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Outdoor free movement, games, sport. Charlotte Mason considered outdoor time essential.'
    }),
    c({
      id: 'card_drill', title: 'Swedish Drill / Fitness', subjectColumnId: 'pe',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      mapGroup: 'PE & Health',
      suggestedWeeklyTouches: '2–4x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Structured movement, exercises, or morning drill. Adjust to family routine.'
    }),
    c({
      id: 'card_health', title: 'Health', subjectColumnId: 'pe',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      mapGroup: 'PE & Health',
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'fixed-or-loop',
      notes: 'Practical health knowledge — body, hygiene, first aid basics.'
    }),
    // -----------------------------------------------------------------------
    // Languages
    // -----------------------------------------------------------------------
    c({
      id: 'card_modern_lang', title: 'Modern Language', subjectColumnId: 'languages',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'active', formApplicability: ALL,
      suggestedWeeklyTouches: '3–5x/week', scheduleStyleSuggestion: 'fixed',
      resourceUseIds: ['ruse_modern_lang'],
      notes: 'Short daily or alternate-day lessons — frequency matters more than duration.'
    }),
    c({
      id: 'card_latin', title: 'Latin', subjectColumnId: 'languages',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'optional',
      planningStatus: 'optional', formApplicability: F3,
      mapGroup: 'Languages',
      suggestedWeeklyTouches: '2–4x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Optional for Form III. Classical or ecclesiastical — adjust to family priorities.'
    }),
    c({
      id: 'card_spanish_french', title: 'Spanish / French', subjectColumnId: 'languages',
      audience: 'group', participantMode: 'group', participantIds: ['older'], status: 'active',
      planningStatus: 'active', formApplicability: F23,
      mapGroup: 'Languages',
      suggestedWeeklyTouches: '3–5x/week', scheduleStyleSuggestion: 'fixed',
      notes: 'Living language — short, frequent lessons with audio.'
    }),
    // -----------------------------------------------------------------------
    // Custom / Co-op / Outside
    // -----------------------------------------------------------------------
    c({
      id: 'card_coop_class', title: 'Co-op Class', subjectColumnId: 'custom',
      audience: 'coop-outside', participantMode: 'coop', participantIds: ['jeremiah'], status: 'coop',
      planningStatus: 'co-op-external', formApplicability: F3,
      suggestedWeeklyTouches: '1x/week', scheduleStyleSuggestion: 'co-op-external',
      scheduleConfig: M.makeScheduleConfig({ mode: 'coop', outsideProvider: 'Community Co-op' })
    }),
    c({
      id: 'card_music_lessons', title: 'Music Lessons', subjectColumnId: 'custom',
      audience: 'individual', participantMode: 'individual', participantIds: ['lucy'], status: 'active',
      planningStatus: 'co-op-external', formApplicability: ALL,
      suggestedWeeklyTouches: '1x/week lesson + practice', scheduleStyleSuggestion: 'co-op-external',
      notes: '1x/week lesson with a teacher, plus daily or alternate-day practice at home.'
    }),
    c({
      id: 'card_outside_activity', title: 'Outside Activity / Sport', subjectColumnId: 'custom',
      audience: 'together', participantMode: 'together', status: 'active',
      planningStatus: 'practice-no-book', formApplicability: ALL,
      suggestedWeeklyTouches: 'as scheduled', scheduleStyleSuggestion: 'manual',
      notes: 'Add your family\'s sport, club, or outside activity here. Adjust to your schedule.'
    })
  ];

  var resources = [
    M.makeResource({ id: 'res_bible', title: 'Bible', type: 'book', status: 'have-it' }),
    M.makeResource({ id: 'res_theology', title: 'Big Truths for Young Hearts', author: 'Bruce Ware', type: 'lesson-book', status: 'have-it' }),
    M.makeResource({ id: 'res_charlottesweb', title: "Charlotte's Web", author: 'E.B. White', type: 'book', status: 'have-it' }),
    M.makeResource({ id: 'res_math_charis', title: "Math Curriculum (Charis — TBD)", type: 'lesson-book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_math_kayla', title: "Math Curriculum (Kayla — TBD)", type: 'lesson-book', status: 'need-to-buy' }),
    M.makeResource({ id: 'res_math_lucy', title: "Math Curriculum (Lucy)", type: 'lesson-book', status: 'have-it' }),
    M.makeResource({ id: 'res_grammar', title: 'Grammar Curriculum (TBD)', type: 'lesson-book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_history_spine', title: 'World History Spine (TBD)', type: 'book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_american_history', title: 'American History Spine (TBD)', type: 'book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_geo_reader', title: 'Geography Reader (TBD)', type: 'book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_living_science', title: 'Living Science Book (TBD)', type: 'book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_plutarch', title: "Plutarch's Lives (abridged)", type: 'book', status: 'need-to-buy' }),
    M.makeResource({ id: 'res_picture_study', title: 'Picture Study Portfolios', type: 'book', status: 'have-it' }),
    M.makeResource({ id: 'res_composer_study', title: 'Composer Study Resource (TBD)', type: 'book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_drawing', title: 'Drawing Resource (TBD)', type: 'book', status: 'need-to-choose' }),
    M.makeResource({ id: 'res_modern_lang', title: 'Modern Language Resource (TBD)', type: 'lesson-book', status: 'need-to-choose' })
  ];

  var resourceUses = [
    M.makeResourceUse({ id: 'ruse_bible_loop', resourceId: 'res_bible', loopId: 'loop_bible', subjectColumnId: 'bible', scheduleSummary: '4x/week (loop)' }),
    M.makeResourceUse({ id: 'ruse_theology', resourceId: 'res_theology', cardId: 'card_theology', subjectColumnId: 'bible' }),
    M.makeResourceUse({ id: 'ruse_charlottesweb', resourceId: 'res_charlottesweb', sequenceItemId: 'si_2', sequenceId: 'seq_readaloud', subjectColumnId: 'literature', nextAssignment: 'chapter 4' }),
    M.makeResourceUse({ id: 'ruse_grammar', resourceId: 'res_grammar', cardId: 'card_grammar', subjectColumnId: 'language-arts', scheduleSummary: '1–2x/week' }),
    M.makeResourceUse({ id: 'ruse_history_spine', resourceId: 'res_history_spine', cardId: 'card_history_spine', subjectColumnId: 'history', scheduleSummary: '2–3x/week' }),
    M.makeResourceUse({ id: 'ruse_american_history', resourceId: 'res_american_history', cardId: 'card_american_history', subjectColumnId: 'history', scheduleSummary: '2x/week' }),
    M.makeResourceUse({ id: 'ruse_geo_reader', resourceId: 'res_geo_reader', cardId: 'card_geo_reader', subjectColumnId: 'geography', scheduleSummary: '1–2x/week' }),
    M.makeResourceUse({ id: 'ruse_living_science', resourceId: 'res_living_science', cardId: 'card_living_science', subjectColumnId: 'science', scheduleSummary: '2x/week' }),
    M.makeResourceUse({ id: 'ruse_math_charis', resourceId: 'res_math_charis', cardId: 'card_math_charis', subjectColumnId: 'math', scheduleSummary: 'daily' }),
    M.makeResourceUse({ id: 'ruse_math_kayla', resourceId: 'res_math_kayla', cardId: 'card_math_kayla', subjectColumnId: 'math', scheduleSummary: 'daily' }),
    M.makeResourceUse({ id: 'ruse_math_lucy', resourceId: 'res_math_lucy', cardId: 'card_math_lucy', subjectColumnId: 'math', scheduleSummary: 'daily' }),
    M.makeResourceUse({ id: 'ruse_plutarch', resourceId: 'res_plutarch', cardId: 'card_plutarch', subjectColumnId: 'geography', scheduleSummary: '1x/week' }),
    M.makeResourceUse({ id: 'ruse_picture_study', resourceId: 'res_picture_study', cardId: 'card_picture_study', subjectColumnId: 'beauty', scheduleSummary: '1x/week' }),
    M.makeResourceUse({ id: 'ruse_composer_study', resourceId: 'res_composer_study', cardId: 'card_composer_study', subjectColumnId: 'beauty', scheduleSummary: '1x/week' }),
    M.makeResourceUse({ id: 'ruse_drawing', resourceId: 'res_drawing', cardId: 'card_drawing', subjectColumnId: 'arts', scheduleSummary: '1x/week' }),
    M.makeResourceUse({ id: 'ruse_modern_lang', resourceId: 'res_modern_lang', cardId: 'card_modern_lang', subjectColumnId: 'languages', scheduleSummary: '3–5x/week' })
  ];

  var starterTemplates = M.defaultStarterTemplateLibrary();

  var strandAssignments = [
    M.makeStrandAssignment({ id: 'sa_bible', strandId: 'bible', strandLabel: 'Bible', assignmentMode: 'loop', loopId: 'loop_bible' }),
    M.makeStrandAssignment({ id: 'sa_nature', strandId: 'nature-study', strandLabel: 'Nature Study', assignmentMode: 'everyone' }),
    M.makeStrandAssignment({ id: 'sa_math_charis', strandId: 'math', strandLabel: 'Math', assignmentMode: 'individual', studentIds: ['charis'] }),
    M.makeStrandAssignment({ id: 'sa_math_kayla', strandId: 'math', strandLabel: 'Math', assignmentMode: 'individual', studentIds: ['kayla'] }),
    M.makeStrandAssignment({ id: 'sa_math_lucy', strandId: 'math', strandLabel: 'Math', assignmentMode: 'individual', studentIds: ['lucy'] }),
    M.makeStrandAssignment({ id: 'sa_math_jeremiah', strandId: 'math', strandLabel: 'Math', assignmentMode: 'individual', studentIds: ['jeremiah'] }),
    M.makeStrandAssignment({ id: 'sa_hymn', strandId: 'hymn', strandLabel: 'Hymn', assignmentMode: 'loop', loopId: 'loop_beauty' }),
    M.makeStrandAssignment({ id: 'sa_folksong', strandId: 'folk-song', strandLabel: 'Folk Song', assignmentMode: 'loop', loopId: 'loop_beauty' }),
    M.makeStrandAssignment({ id: 'sa_poetry', strandId: 'poetry', strandLabel: 'Poetry', assignmentMode: 'loop', loopId: 'loop_beauty' }),
    M.makeStrandAssignment({ id: 'sa_picturestudy', strandId: 'picture-study', strandLabel: 'Picture Study', assignmentMode: 'loop', loopId: 'loop_beauty' }),
    M.makeStrandAssignment({ id: 'sa_composerstudy', strandId: 'composer-study', strandLabel: 'Composer Study', assignmentMode: 'loop', loopId: 'loop_beauty' })
  ];

  return {
    appStateVersion: 1,
    students: students,
    groups: groups,
    subjectColumns: subjectColumns,
    cards: cards,
    loops: loops,
    loopItems: loopItems,
    sequences: sequences,
    sequenceItems: sequenceItems,
    extensionWorks: extensionWorks,
    resources: resources,
    resourceUses: resourceUses,
    starterTemplates: starterTemplates,
    strandAssignments: strandAssignments,
    printSettings: M.makePrintSettings(),
    weeklyRhythm: R.buildSampleWeeklyRhythm(),
    rhythmPrintSettings: R.makeRhythmPrintSettings()
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export function findStudent(state, id) { return state.students.find(function (s) { return s.id === id; }); }
export function findGroup(state, id) { return state.groups.find(function (g) { return g.id === id; }); }
export function findSubject(state, id) { return state.subjectColumns.find(function (s) { return s.id === id; }); }
export function findCard(state, id) { return state.cards.find(function (c) { return c.id === id; }); }
export function findResource(state, id) { return state.resources.find(function (r) { return r.id === id; }); }
export function findLoop(state, id) { return state.loops.find(function (l) { return l.id === id; }); }
export function findSequence(state, id) { return state.sequences.find(function (s) { return s.id === id; }); }

// Build the resolver context resolveResourceUseParticipants() needs, from a
// full app state.
export function resourceContext(state) {
  return {
    cards: state.cards, loops: state.loops, sequences: state.sequences,
    extensionWorks: state.extensionWorks || [], students: state.students, groups: state.groups
  };
}

// Build the resolver context the weeklyRhythm helpers need, from a full app
// state. Same shape as resourceContext(), plus subjectColumns since rhythm
// assignments can reference a subject directly.
export function rhythmContext(state) {
  return {
    students: state.students, groups: state.groups, cards: state.cards,
    loops: state.loops, sequences: state.sequences, subjectColumns: state.subjectColumns
  };
}

// ---------------------------------------------------------------------------
// Map rows / grid
// ---------------------------------------------------------------------------
// Audience row ids, in display order. "individual" expands to one row per
// active student; everything else is a single fixed row.
export var FIXED_ROW_IDS = ['together', 'group', 'individual', 'coop-outside', 'optional', 'unplaced'];

export function buildMapRows(state) {
  var rows = [];
  rows.push({ id: 'together', label: 'Together / Family' });
  state.groups.filter(function (g) { return g.active; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; }).forEach(function (g) {
    rows.push({ id: 'group:' + g.id, label: g.label, groupId: g.id });
  });
  state.students.filter(function (s) { return s.active; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; }).forEach(function (s) {
    rows.push({ id: 'individual:' + s.id, label: s.name, studentId: s.id });
  });
  rows.push({ id: 'coop-outside', label: 'Co-op / Outside' });
  rows.push({ id: 'optional', label: 'Optional / Not this year' });
  rows.push({ id: 'unplaced', label: 'Still to place' });
  return rows;
}

// Which row a card belongs to on the map, given its audience + (for group
// audience) which specific group it's linked to.
export function rowIdForCard(card) {
  if (card.audience === 'group') {
    var groupId = card.groupId || (card.participantIds && card.participantIds[0]);
    return groupId ? 'group:' + groupId : 'group';
  }
  if (card.audience === 'individual') {
    var studentId = card.participantIds && card.participantIds[0];
    return studentId ? 'individual:' + studentId : 'unplaced';
  }
  return card.audience; // together | coop-outside | optional | unplaced
}

// Build the full row x subjectColumn grid of cards, sorted columns left to
// right, each cell an array of cards (empty array if none).
export function buildMapGrid(state) {
  var rows = buildMapRows(state);
  var columns = state.subjectColumns.filter(function (s) { return s.visible; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  var grid = rows.map(function (row) {
    var cells = {};
    columns.forEach(function (col) { cells[col.id] = []; });
    return { row: row, cells: cells };
  });
  state.cards.forEach(function (card) {
    var rowId = rowIdForCard(card);
    var gridRow = grid.find(function (g) { return g.row.id === rowId; });
    if (gridRow && gridRow.cells[card.subjectColumnId]) gridRow.cells[card.subjectColumnId].push(card);
  });
  return { rows: rows, columns: columns, grid: grid };
}

// ---------------------------------------------------------------------------
// Lens
// ---------------------------------------------------------------------------
// lens shapes: {type:'all'} | {type:'student', studentId} | {type:'group', groupId} | {type:'subject', subjectColumnId}
export function cardMatchesLens(card, lens, state) {
  if (!lens || lens.type === 'all') return true;
  if (lens.type === 'subject') return card.subjectColumnId === lens.subjectColumnId;
  var participants = M.resolveParticipants(card, state.students, state.groups);
  if (lens.type === 'student') return participants.indexOf(lens.studentId) > -1;
  if (lens.type === 'group') {
    var group = findGroup(state, lens.groupId);
    if (!group) return false;
    return group.studentIds.some(function (id) { return participants.indexOf(id) > -1; });
  }
  return true;
}

// Student Lens: every card the student participates in — Together, group,
// co-op/external, and individual work. Optional/not-this-year work is
// included only when explicitly opted in (it's hidden by default since it's
// often undecided/skippable).
export function studentLensCards(state, studentId, opts) {
  opts = opts || {};
  return state.cards.filter(function (card) {
    if (card.status === 'optional' && !opts.includeOptional) return false;
    return cardMatchesLens(card, { type: 'student', studentId: studentId }, state);
  });
}

export function groupLensCards(state, groupId) {
  return state.cards.filter(function (card) { return cardMatchesLens(card, { type: 'group', groupId: groupId }, state); });
}

export function subjectLensCards(state, subjectColumnId) {
  return state.cards.filter(function (card) { return cardMatchesLens(card, { type: 'subject', subjectColumnId: subjectColumnId }, state); });
}

// Combined Student Lens: everything the Family School Map, Weekly Rhythm,
// and Book & Resource List know about one student, read from the same
// shared state — map cards, rhythm assignments, and resource rollup uses.
export function studentLensView(state, studentId, opts) {
  var cards = studentLensCards(state, studentId, opts);
  var rhythmAssignments = state.weeklyRhythm
    ? R.getRhythmForStudent(state.weeklyRhythm, studentId, rhythmContext(state))
    : [];
  var rollup = M.buildResourceRollup(state.resources, state.resourceUses, resourceContext(state));
  var resources = M.getResourcesForStudent(rollup, studentId);
  return { cards: cards, rhythmAssignments: rhythmAssignments, resources: resources };
}

// ---------------------------------------------------------------------------
// Rhythm placement / review — state-level wrappers around weeklyRhythm.mjs's
// pure helpers. "Needs rhythm placement" finds cards/loops/sequences that
// don't yet appear anywhere in the rhythm; "Needs rhythm review" flags
// rhythm assignments whose reference is missing or has visibly diverged —
// never an automatic rewrite, just a parent-facing hint.
// ---------------------------------------------------------------------------
export function cardHasRhythmPlacement(state, cardId) {
  return R.cardHasRhythmPlacement(state.weeklyRhythm, cardId);
}
export function loopHasRhythmPlacement(state, loopId) {
  return R.loopHasRhythmPlacement(state.weeklyRhythm, loopId);
}
export function sequenceHasRhythmPlacement(state, sequenceId) {
  return R.sequenceHasRhythmPlacement(state.weeklyRhythm, sequenceId);
}
export function getCardsWithoutRhythmPlacement(state, opts) {
  return R.getCardsWithoutRhythmPlacement(state.weeklyRhythm, state.cards, opts);
}
export function getLoopsWithoutRhythmPlacement(state) {
  return R.getLoopsWithoutRhythmPlacement(state.weeklyRhythm, state.loops);
}
export function getSequencesWithoutRhythmPlacement(state) {
  return R.getSequencesWithoutRhythmPlacement(state.weeklyRhythm, state.sequences);
}
export function getRhythmReviewItems(state) {
  return R.getRhythmReviewItems(state.weeklyRhythm, rhythmContext(state));
}

// ---------------------------------------------------------------------------
// Weekly Rhythm editing — thin state-level wrappers around weeklyRhythm.mjs's
// pure cell mutators. These only ever create/change/remove RhythmAssignment
// objects; they never touch cards/loops/sequences/resources, per the
// reference-based-display, no-silent-rewrite rule from Phase 1B/1D.
// ---------------------------------------------------------------------------
export function addRhythmAssignmentToState(state, fields) {
  return R.addRhythmAssignment(state.weeklyRhythm, fields);
}

export function updateRhythmAssignmentInState(state, assignmentId, fields) {
  return R.updateRhythmAssignment(state.weeklyRhythm, assignmentId, fields);
}

export function deleteRhythmAssignmentFromState(state, assignmentId) {
  return R.deleteRhythmAssignment(state.weeklyRhythm, assignmentId);
}

// Small, contained "Add to Weekly Rhythm" action from the Family School Map:
// creates one RhythmAssignment that references the given card on the chosen
// day/block. Does not touch the card itself.
export function addCardToRhythm(state, cardId, dayId, blockId) {
  var card = findCard(state, cardId);
  if (!card) return null;
  return addRhythmAssignmentToState(state, {
    dayId: dayId,
    blockId: blockId,
    label: card.title,
    assignmentType: 'card',
    referencedId: cardId
  });
}

// ---------------------------------------------------------------------------
// Loops / Sequences (current-item views; mutation delegates to familyMap helpers)
// ---------------------------------------------------------------------------
export function currentLoopItem(state, loopId) {
  var loop = findLoop(state, loopId);
  if (!loop) return null;
  return state.loopItems.find(function (i) { return i.id === loop.currentItemId; }) || null;
}

// Mutates state.loops in place (in-memory only) by replacing the loop with
// the advanced version from M.advanceLoop. Returns the new current item.
export function advanceLoopInState(state, loopId) {
  var idx = state.loops.findIndex(function (l) { return l.id === loopId; });
  if (idx === -1) return null;
  state.loops[idx] = M.advanceLoop(state.loops[idx]);
  return currentLoopItem(state, loopId);
}

export function sequenceProgress(state, sequenceId) {
  var items = state.sequenceItems.filter(function (i) { return i.sequenceId === sequenceId; });
  return M.resolveSequenceProgress(items);
}

// Mutates state.sequenceItems in place (in-memory only) by replacing this
// sequence's items with the advanced set from M.advanceSequence.
export function advanceSequenceInState(state, sequenceId) {
  var items = state.sequenceItems.filter(function (i) { return i.sequenceId === sequenceId; });
  var advanced = M.advanceSequence(items);
  state.sequenceItems = state.sequenceItems
    .filter(function (i) { return i.sequenceId !== sequenceId; })
    .concat(advanced);
  return sequenceProgress(state, sequenceId);
}

// Mutates state.sequenceItems in place (in-memory only) by replacing this
// sequence's items with the reversed set from M.reverseSequence.
export function reverseSequenceInState(state, sequenceId) {
  var items = state.sequenceItems.filter(function (i) { return i.sequenceId === sequenceId; });
  var reversed = M.reverseSequence(items);
  state.sequenceItems = state.sequenceItems
    .filter(function (i) { return i.sequenceId !== sequenceId; })
    .concat(reversed);
  return sequenceProgress(state, sequenceId);
}

// Whether "Next" should be available — there is a current item to advance.
export function sequenceCanAdvance(state, sequenceId) {
  return sequenceProgress(state, sequenceId).current != null;
}

// Whether "Previous" should be available — there is something before the
// current position to move back to (a completed item, or a current item
// that isn't already the first).
export function sequenceCanReverse(state, sequenceId) {
  var items = state.sequenceItems.filter(function (i) { return i.sequenceId === sequenceId; })
    .sort(function (a, b) { return a.position - b.position; });
  var curIdx = items.findIndex(function (i) { return i.status === 'current'; });
  if (curIdx === -1) return items.some(function (i) { return i.status === 'completed'; });
  return curIdx > 0;
}

// ---------------------------------------------------------------------------
// Resource list
// ---------------------------------------------------------------------------
// One call that produces exactly what the Book & Resource List panel needs:
// a deduplicated, participant-resolved, filtered, grouped resource view.
export function getResourceList(state, opts) {
  opts = opts || {};
  var groupBy = opts.groupBy || 'subject';
  var filter = opts.filter || 'all';
  var rollup = M.buildResourceRollup(state.resources, state.resourceUses, resourceContext(state));
  var filtered = M.filterResourceRollup(rollup, filter, { studentId: opts.studentId, subjectColumnId: opts.subjectColumnId });
  return M.groupResources(filtered, groupBy);
}

// Human-readable "used in" label for a single ResourceUse, preserving
// card/loop/loop-item/sequence/sequence-item/extension-work/co-op/optional
// context, for both screen and print rendering.
export function resourceUseContextLabel(use, state) {
  if (use.cardId) {
    var card = findCard(state, use.cardId);
    return card ? card.title : 'Card';
  }
  if (use.loopItemId || use.loopId) {
    var loop = findLoop(state, use.loopId);
    var loopItem = state.loopItems.find(function (i) { return i.id === use.loopItemId; });
    if (loop && loopItem) return loop.title + ' — ' + loopItem.title;
    if (loop) return loop.title;
    return 'Loop';
  }
  if (use.sequenceItemId || use.sequenceId) {
    var seq = findSequence(state, use.sequenceId);
    var seqItem = state.sequenceItems.find(function (i) { return i.id === use.sequenceItemId; });
    if (seq && seqItem) return seq.title + ' — ' + seqItem.title;
    if (seq) return seq.title;
    return 'Sequence';
  }
  if (use.extensionWorkId) {
    var ext = (state.extensionWorks || []).find(function (e) { return e.id === use.extensionWorkId; });
    return ext ? 'Extension — ' + ext.title : 'Extension work';
  }
  if (use.coopRef) return 'Co-op: ' + use.coopRef;
  if (use.optionalRef) return 'Optional: ' + use.optionalRef;
  return '';
}

export function resourceUseWhoLabel(use, state) {
  var participants = use.participants || [];
  if (!participants.length) return 'Everyone';
  return participants.map(function (id) {
    var s = findStudent(state, id);
    return s ? s.name : id;
  }).join(', ');
}

// ---------------------------------------------------------------------------
// Minimal, safe in-memory editing mutators (Phase 1A scope only)
// ---------------------------------------------------------------------------
export function setCardTitle(state, cardId, title) {
  var card = findCard(state, cardId);
  if (card) card.title = title;
  return state;
}

export function setCardAudience(state, cardId, audience) {
  var card = findCard(state, cardId);
  if (card) card.audience = audience;
  return state;
}

export function setCardParticipants(state, cardId, participantMode, participantIds) {
  var card = findCard(state, cardId);
  if (!card) return state;
  card.participantMode = participantMode;
  card.participantIds = (participantIds || []).slice();
  return state;
}

export function setResourceStatus(state, resourceId, status) {
  var resource = findResource(state, resourceId);
  if (resource) resource.status = status;
  return state;
}

export function moveCardToSubject(state, cardId, subjectColumnId) {
  var card = findCard(state, cardId);
  if (card) card.subjectColumnId = subjectColumnId;
  return state;
}

// Move a card to a different map row ("Who is this for?"), matching the row
// ids buildMapRows() produces (together | group:<id> | individual:<id> |
// coop-outside | optional | unplaced). Sets audience + a sane default
// participantMode/participantIds for that row; explicit participant overrides
// (setCardParticipants) can still be applied on top afterward.
export function moveCardToRow(state, cardId, rowId) {
  var card = findCard(state, cardId);
  if (!card || !rowId) return state;
  if (rowId === 'together') {
    card.audience = 'together';
    card.participantMode = 'together';
    card.participantIds = [];
  } else if (rowId.indexOf('group:') === 0) {
    card.audience = 'group';
    card.participantMode = 'group';
    card.participantIds = [rowId.slice('group:'.length)];
  } else if (rowId.indexOf('individual:') === 0) {
    card.audience = 'individual';
    card.participantMode = 'individual';
    card.participantIds = [rowId.slice('individual:'.length)];
  } else if (rowId === 'coop-outside') {
    card.audience = 'coop-outside';
    card.participantMode = 'coop';
  } else if (rowId === 'optional') {
    card.audience = 'optional';
    card.participantMode = 'optional';
  } else if (rowId === 'unplaced') {
    card.audience = 'unplaced';
  }
  return state;
}

// ---------------------------------------------------------------------------
// Family members / Learners — simple add/edit/deactivate management. Kept
// intentionally minimal: no profile system, just the fields a parent needs
// to see a learner show up correctly across the map, lenses, and the
// participant picker (all of which already derive from state.students).
// ---------------------------------------------------------------------------
export function addStudent(state, fields) {
  fields = fields || {};
  var student = M.makeStudent(Object.assign({
    initials: fields.initials || M.autoInitials(fields.name || ''),
    sortOrder: state.students.length
  }, fields));
  state.students.push(student);
  return student;
}

export function updateStudent(state, studentId, fields) {
  var student = findStudent(state, studentId);
  if (!student) return null;
  Object.assign(student, fields);
  return student;
}

export function setStudentActive(state, studentId, active) {
  var student = findStudent(state, studentId);
  if (student) student.active = !!active;
  return student;
}

// ---------------------------------------------------------------------------
// Subjects — simple add/edit/hide management for the Family School Map's
// subject columns.
// ---------------------------------------------------------------------------
export function addSubjectColumn(state, fields) {
  fields = fields || {};
  var col = M.makeSubjectColumn(Object.assign({ sortOrder: state.subjectColumns.length }, fields));
  state.subjectColumns.push(col);
  return col;
}

export function updateSubjectColumn(state, subjectColumnId, fields) {
  var col = findSubject(state, subjectColumnId);
  if (!col) return null;
  Object.assign(col, fields);
  return col;
}

export function setSubjectVisible(state, subjectColumnId, visible) {
  var col = findSubject(state, subjectColumnId);
  if (col) col.visible = !!visible;
  return col;
}

export function addCardFromTemplate(state, templateId) {
  var tpl = state.starterTemplates.find(function (t) { return t.id === templateId; });
  if (!tpl) return null;
  var card = M.makeCard({
    title: tpl.title,
    subjectColumnId: tpl.subjectColumnId,
    audience: tpl.suggestedAudience,
    participantMode: tpl.suggestedParticipantMode,
    scheduleConfig: M.makeScheduleConfig({ mode: tpl.suggestedScheduleMode }),
    lessonTimeConfig: tpl.suggestedLessonTimeConfig || M.makeLessonTimeConfig(),
    sourceTemplateId: tpl.id
  });
  state.cards.push(card);

  // If the template expects a resource (book/lesson-book/etc, anything but
  // 'none'), create a placeholder Resource + linked ResourceUse so the new
  // card shows up correctly in the Book & Resource List right away — left
  // 'undecided'/unspecified for the parent to fill in, never guessed.
  if (tpl.suggestedResourceExpectation && tpl.suggestedResourceExpectation !== 'none') {
    var resource = M.makeResource({
      title: tpl.title + ' (resource TBD)',
      type: tpl.suggestedResourceExpectation,
      status: 'undecided'
    });
    state.resources.push(resource);
    var use = M.makeResourceUse({
      resourceId: resource.id,
      cardId: card.id,
      subjectColumnId: tpl.subjectColumnId
    });
    state.resourceUses.push(use);
  }

  return card;
}

// Starter templates grouped/filtered for the learner-onboarding wizard. A
// learner's gradeBand (form1/form2/form3/custom) filters which templates are
// "for this form"; category groups them so a parent can add by group
// (core/riches/skills) instead of facing one giant list.
export function getStarterTemplatesForForm(state, gradeBand) {
  return state.starterTemplates.filter(function (t) {
    return !t.ageStageApplicability.length || t.ageStageApplicability.indexOf(gradeBand) > -1;
  });
}

export function getStarterTemplatesByCategory(state, gradeBand, category) {
  return getStarterTemplatesForForm(state, gradeBand).filter(function (t) { return t.category === category; });
}

// Add starter cards for a set of template ids, all assigned to one learner
// (audience/participantMode individual unless the template suggests
// together/group). Returns the created cards. Never called silently — the
// caller (UI) always asks the parent first per template/category.
export function addStarterCardsBulk(state, templateIds, studentId) {
  return templateIds.map(function (templateId) {
    var card = addCardFromTemplate(state, templateId);
    if (card && studentId && card.audience !== 'together' && card.audience !== 'group') {
      card.audience = 'individual';
      card.participantMode = 'individual';
      card.participantIds = [studentId];
    }
    return card;
  }).filter(Boolean);
}

// Place a set of already-created cards into the Weekly Rhythm using a
// PNEU-inspired rhythm preset as a starting point. A thin state-level
// wrapper around weeklyRhythm.mjs's pure placeCardsUsingRhythmPreset —
// creates RhythmAssignments only, never touches the cards.
export function placeStarterCardsWithRhythmPreset(state, presetId, cardIds) {
  var labelById = {};
  cardIds.forEach(function (id) {
    var card = findCard(state, id);
    if (card) labelById[id] = card.title;
  });
  return R.placeCardsUsingRhythmPreset(state.weeklyRhythm, presetId, cardIds, labelById);
}

// ---------------------------------------------------------------------------
// Card editing — workbench-level add/update helpers.
// ---------------------------------------------------------------------------
export function addCard(state, fields) {
  fields = fields || {};
  var card = M.makeCard(fields);
  state.cards.push(card);
  return card;
}

export function updateCard(state, cardId, fields) {
  var card = findCard(state, cardId);
  if (!card) return null;
  Object.assign(card, fields);
  return card;
}

// All cards for a given subject column (visible or not), sorted by sortOrder
// then title. Used by the Subjects & Books workbench to group cards by column.
export function getCardsForSubjectColumn(state, columnId) {
  return state.cards.filter(function (c) { return c.subjectColumnId === columnId; })
    .sort(function (a, b) {
      var diff = (a.sortOrder || 0) - (b.sortOrder || 0);
      return diff !== 0 ? diff : (a.title || '').localeCompare(b.title || '');
    });
}

// Derive the coverage status for one card from its linked resources.
// Pure derivation — result is never stored on the card.
export function getCoverageStatusForCard(state, cardId) {
  var card = findCard(state, cardId);
  if (!card) return 'not-tracked';
  return M.deriveCoverageStatus(card, state.resourceUses, state.resources);
}

// ---------------------------------------------------------------------------
// Resource / ResourceUse CRUD
// ---------------------------------------------------------------------------

export function getResourceUsesForCard(state, cardId) {
  return (state.resourceUses || []).filter(function (u) { return u.cardId === cardId; });
}

export function findResourceUse(state, useId) {
  return (state.resourceUses || []).find(function (u) { return u.id === useId; }) || null;
}

// pendingResources format: [{_resId, _useId, title, status}]
// _resId / _useId are null for newly-added (not-yet-saved) resources.
// Reconciles the pending list against the current state:
//   - removes deleted ResourceUses + orphaned Resources (not used by any other card)
//   - updates existing Resource title/status
//   - creates new Resources + ResourceUses for entries without _resId
//   - updates card.resourceUseIds to reflect the final list
export function commitCardResources(state, cardId, pendingResources) {
  var card = findCard(state, cardId);
  if (!card) return;
  var existingUses = getResourceUsesForCard(state, cardId);
  var survivingResIds = new Set(
    (pendingResources || []).filter(function (r) { return r._resId; }).map(function (r) { return r._resId; })
  );

  // Remove deleted uses; remove resource only if no other use references it
  existingUses.forEach(function (use) {
    if (!survivingResIds.has(use.resourceId)) {
      state.resourceUses = state.resourceUses.filter(function (u) { return u.id !== use.id; });
      var usedElsewhere = (state.resourceUses || []).some(function (u) { return u.resourceId === use.resourceId; });
      if (!usedElsewhere) {
        state.resources = state.resources.filter(function (r) { return r.id !== use.resourceId; });
      }
    }
  });

  // Update existing resources
  (pendingResources || []).filter(function (r) { return r._resId; }).forEach(function (r) {
    var res = (state.resources || []).find(function (x) { return x.id === r._resId; });
    if (res) { res.title = (r.title || '').trim() || res.title; res.status = r.status || res.status; }
  });

  // Add new resources (include subjectColumnId so resource rollup groups correctly)
  (pendingResources || []).filter(function (r) { return !r._resId && r.title && r.title.trim(); }).forEach(function (r) {
    var res = M.makeResource({ title: r.title.trim(), status: r.status || 'need-to-choose' });
    var use = M.makeResourceUse({ resourceId: res.id, cardId: cardId, subjectColumnId: card.subjectColumnId || null });
    state.resources.push(res);
    state.resourceUses.push(use);
  });

  // Rebuild card.resourceUseIds from what's now in state
  card.resourceUseIds = (state.resourceUses || [])
    .filter(function (u) { return u.cardId === cardId; })
    .map(function (u) { return u.id; });
}

// ---------------------------------------------------------------------------
// Sequence / Loop accessors + mutators
// ---------------------------------------------------------------------------
export function getCardSequence(state, cardId) {
  var card = findCard(state, cardId);
  if (!card || !card.sequenceId) return null;
  return (state.sequences || []).find(function (s) { return s.id === card.sequenceId; }) || null;
}

export function getCardLoop(state, cardId) {
  var card = findCard(state, cardId);
  if (!card || !card.loopId) return null;
  return (state.loops || []).find(function (l) { return l.id === card.loopId; }) || null;
}

export function getCardSequenceItems(state, cardId) {
  var card = findCard(state, cardId);
  if (!card || !card.sequenceId) return [];
  return (state.sequenceItems || [])
    .filter(function (si) { return si.sequenceId === card.sequenceId; })
    .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
}

export function getCardLoopItems(state, cardId) {
  var card = findCard(state, cardId);
  if (!card || !card.loopId) return [];
  return (state.loopItems || [])
    .filter(function (li) { return li.loopId === card.loopId; })
    .sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
}

export function commitSequenceItems(state, cardId, pendingItems) {
  var card = findCard(state, cardId);
  if (!card || !card.sequenceId) return;
  var seqId = card.sequenceId;
  var seq = (state.sequences || []).find(function (s) { return s.id === seqId; });
  if (!seq) return;
  var survivingIds = new Set(
    (pendingItems || []).filter(function (p) { return p._itemId; }).map(function (p) { return p._itemId; })
  );
  state.sequenceItems = (state.sequenceItems || []).filter(function (si) {
    return si.sequenceId !== seqId || survivingIds.has(si.id);
  });
  (pendingItems || []).filter(function (p) { return p._itemId; }).forEach(function (p) {
    var item = state.sequenceItems.find(function (si) { return si.id === p._itemId; });
    if (item && (p.title || '').trim()) item.title = p.title.trim();
  });
  var existing = (state.sequenceItems || []).filter(function (si) { return si.sequenceId === seqId; });
  var maxPos = existing.reduce(function (m, si) { return Math.max(m, si.position || 0); }, -1);
  (pendingItems || []).filter(function (p) { return !p._itemId && (p.title || '').trim(); }).forEach(function (p) {
    maxPos++;
    state.sequenceItems.push(M.makeSequenceItem({ sequenceId: seqId, title: p.title.trim(), status: 'upcoming', position: maxPos }));
  });
  seq.itemIds = (state.sequenceItems || [])
    .filter(function (si) { return si.sequenceId === seqId; })
    .sort(function (a, b) { return (a.position || 0) - (b.position || 0); })
    .map(function (si) { return si.id; });
}

export function commitLoopItems(state, cardId, pendingItems) {
  var card = findCard(state, cardId);
  if (!card || !card.loopId) return;
  var loopId = card.loopId;
  var loop = (state.loops || []).find(function (l) { return l.id === loopId; });
  if (!loop) return;
  var survivingIds = new Set(
    (pendingItems || []).filter(function (p) { return p._itemId; }).map(function (p) { return p._itemId; })
  );
  state.loopItems = (state.loopItems || []).filter(function (li) {
    return li.loopId !== loopId || survivingIds.has(li.id);
  });
  (pendingItems || []).filter(function (p) { return p._itemId; }).forEach(function (p) {
    var item = state.loopItems.find(function (li) { return li.id === p._itemId; });
    if (item && (p.title || '').trim()) item.title = p.title.trim();
  });
  var existing = (state.loopItems || []).filter(function (li) { return li.loopId === loopId; });
  var maxOrder = existing.reduce(function (m, li) { return Math.max(m, li.sortOrder || 0); }, -1);
  (pendingItems || []).filter(function (p) { return !p._itemId && (p.title || '').trim(); }).forEach(function (p) {
    maxOrder++;
    state.loopItems.push(M.makeLoopItem({ loopId: loopId, title: p.title.trim(), sortOrder: maxOrder }));
  });
  loop.itemIds = (state.loopItems || [])
    .filter(function (li) { return li.loopId === loopId; })
    .sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); })
    .map(function (li) { return li.id; });
}

function cleanMapLabel(title) {
  return (title || '')
    .replace(/\s*[—–-]\s*TBD(?=\s*\))/gi, '')
    .replace(/\s*\(\s*TBD\s*\)\s*$/i, '')
    .trim();
}

export function getCardMapLabels(state, card) {
  if (!card) return [];
  if (card.strandLabels && card.strandLabels.length) return card.strandLabels;
  if (card.loopId) {
    var li = (state.loopItems || [])
      .filter(function (l) { return l.loopId === card.loopId; })
      .sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
    if (li.length) return li.map(function (l) { return l.title; });
  }
  if (card.sequenceId) {
    var all = (state.sequenceItems || [])
      .filter(function (si) { return si.sequenceId === card.sequenceId; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    var nonDone = all.filter(function (si) { return si.status !== 'completed'; });
    var toShow = nonDone.length ? nonDone : all.slice(-1);
    if (toShow.length) return toShow.map(function (si) { return si.title + (si.status === 'current' ? ' ★' : ''); });
  }
  var useIds = card.resourceUseIds || [];
  if (useIds.length) {
    var titles = useIds.map(function (uid) {
      var use = (state.resourceUses || []).find(function (u) { return u.id === uid; });
      var res = use ? findResource(state, use.resourceId) : null;
      if (!res || res.status === 'need-to-choose' || res.status === 'undecided') return null;
      return cleanMapLabel(res.title);
    }).filter(Boolean);
    if (titles.length) return titles;
  }
  return [card.title || '(untitled)'];
}

export function cardNeedsResourceChoice(state, card) {
  if (!card) return false;
  if (card.strandLabels && card.strandLabels.length) return false;
  if (card.sequenceId || card.loopId) return false;
  if (card.resourceUseIds && card.resourceUseIds.length) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Lesson length display helper
// ---------------------------------------------------------------------------
export function lessonLengthText(card) {
  var ltc = card && card.lessonTimeConfig;
  if (!ltc) return '';
  var min = ltc.minMinutes, target = ltc.targetMinutes;
  if (min && target && min !== target) return min + '–' + target + ' min';
  if (target) return '~' + target + ' min';
  if (min) return min + '+ min';
  return '';
}

// Print
// ---------------------------------------------------------------------------
export function printOrientationForState(printSettings) {
  return M.printOrientationForMode(printSettings.printMode);
}

// ---------------------------------------------------------------------------
// Rhythm status helpers
// ---------------------------------------------------------------------------

// Returns rhythm status for a card: 'placed' | 'covered-by-loop' | 'not-in-rhythm'
export function getCardRhythmStatus(state, cardId) {
  var rhythm = state.weeklyRhythm;
  if (!rhythm) return { status: 'not-in-rhythm' };
  // Direct placement
  if (R.cardHasRhythmPlacement(rhythm, cardId)) return { status: 'placed' };
  // Check if covered by a loop in the rhythm
  var loops = state.loops || [];
  var loopItems = state.loopItems || [];
  var placedLoopIds = (rhythm.assignments || [])
    .filter(function(a) { return a.assignmentType === 'loop'; })
    .map(function(a) { return a.referencedId; });
  for (var i = 0; i < placedLoopIds.length; i++) {
    var loopId = placedLoopIds[i];
    var items = loopItems.filter(function(li) { return li.loopId === loopId && li.linkedCardId === cardId; });
    if (items.length > 0) {
      var loop = loops.find(function(l) { return l.id === loopId; });
      return { status: 'covered-by-loop', loopId: loopId, loopTitle: loop ? loop.title : loopId };
    }
  }
  return { status: 'not-in-rhythm' };
}

// Returns rhythm status for a loop: 'placed' | 'not-in-rhythm'
export function getLoopRhythmStatus(state, loopId) {
  var rhythm = state.weeklyRhythm;
  if (!rhythm) return { status: 'not-in-rhythm' };
  if (R.loopHasRhythmPlacement(rhythm, loopId)) return { status: 'placed' };
  return { status: 'not-in-rhythm' };
}

// Build rows for the Combine & Plan table
export function buildCombineAndPlanRows(state) {
  var cards = state.cards || [];
  var loops = state.loops || [];
  var students = state.students || [];
  var groups = state.groups || [];
  var rows = [];

  cards.forEach(function(card) {
    if (card.planningStatus === 'not-this-year') return;
    var rhythmStatus = getCardRhythmStatus(state, card.id);
    var participants = M.resolveParticipants(card, students, groups);
    var participantNames = participants.map(function(id) {
      var s = students.find(function(st) { return st.id === id; });
      return s ? s.name : id;
    });
    var isGroup = card.participantMode === 'group';
    var isTogether = card.participantMode === 'together';
    var loop = card.loopId ? loops.find(function(l) { return l.id === card.loopId; }) : null;
    var ltc = card.lessonTimeConfig;
    var timeLabel = '';
    if (ltc) {
      if (ltc.minMinutes && ltc.targetMinutes && ltc.minMinutes !== ltc.targetMinutes) {
        timeLabel = ltc.minMinutes + '–' + ltc.targetMinutes + ' min';
      } else if (ltc.targetMinutes) {
        timeLabel = 'about ' + ltc.targetMinutes + ' min';
      }
    }
    rows.push({
      type: 'card',
      id: card.id,
      title: card.title,
      subjectColumnId: card.subjectColumnId,
      who: participantNames.join(', ') || (isTogether ? 'Together' : ''),
      together: isTogether || isGroup,
      momNeeded: loop ? loop.momNeeded : null,
      rhythmStatus: rhythmStatus.status,
      rhythmDetail: rhythmStatus,
      timeLabel: timeLabel,
      loopId: card.loopId,
      loopTitle: loop ? loop.title : null,
      planningStatus: card.planningStatus,
      audience: card.audience
    });
  });

  loops.forEach(function(loop) {
    var rhythmStatus = getLoopRhythmStatus(state, loop.id);
    var participants = M.resolveParticipants(loop, students, groups);
    var participantNames = participants.map(function(id) {
      var s = students.find(function(st) { return st.id === id; });
      return s ? s.name : id;
    });
    rows.push({
      type: 'loop',
      id: loop.id,
      title: loop.title,
      subjectColumnId: loop.subjectColumnId,
      who: participantNames.join(', ') || 'Together',
      together: loop.participantMode === 'together',
      momNeeded: loop.momNeeded,
      kindOfAttention: loop.kindOfAttention,
      rhythmStatus: rhythmStatus.status,
      rhythmDetail: rhythmStatus,
      timeLabel: loop.approxTimeLabel || '',
      touchesPerWeek: loop.touchesPerWeek,
      planningStatus: 'active',
      audience: loop.audience
    });
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Strand assignment helpers
// ---------------------------------------------------------------------------

// Loop membership is `loopId`, never the audience. Legacy records that stored
// assignmentMode 'loop' also carry loopId, so both read the same way here.
export function getStrandsCoveredByLoop(state, loopId) {
  var assignments = (state && state.strandAssignments) || [];
  return assignments.filter(function(sa) { return sa && sa.loopId === loopId; });
}

// Returns the set of strand IDs currently held by any loop.
export function getLoopCoveredStrandIds(state) {
  var assignments = (state && state.strandAssignments) || [];
  var ids = [];
  assignments.forEach(function(sa) { if (sa && sa.loopId && sa.strandId) ids.push(sa.strandId); });
  return ids;
}

// Returns all strands from SUBJECT_LIBRARY that have no strand assignment yet.
export function getUnassignedStrands(state) {
  var assignments = state.strandAssignments || [];
  var assignedStrandIds = assignments.map(function(sa) { return sa.strandId; });
  return (M.SUBJECT_LIBRARY || []).filter(function(strand) { return assignedStrandIds.indexOf(strand.id) === -1; });
}

// ---------------------------------------------------------------------------
// Feast rows (Form x Subject x Strand) — prototype support.
//
// Everything below is READ-ONLY against cards, loops, loopItems, sequences,
// resources, resourceUses, and weeklyRhythm. The only collection any of it
// writes is state.strandAssignments (and only via
// setStrandAssignmentForStrand / resetPrototypeStrandAssignments).
//
// Rows are ALWAYS derived from M.FEAST_LIBRARY, never from state.cards, so a
// strand never disappears from the feast because it was turned off, looped,
// placed, or never assigned. Placement is likewise derived fresh on every
// call from existing relationships — there is no stored placement/status
// field anywhere, and none is ever written.
// ---------------------------------------------------------------------------

export const FEAST_PROTOTYPE_CREATED_BY = 'feast-prototype';

function feastColumnLabel(columnId) {
  var col = (M.DEFAULT_VISIBLE_SUBJECT_COLUMNS || []).find(function (c) { return c.id === columnId; });
  return col ? col.label : columnId;
}

function feastAssignmentFor(state, strandId) {
  return (state.strandAssignments || []).find(function (sa) { return sa.strandId === strandId; }) || null;
}

function feastGroupLabel(state, groupId, fallback) {
  var grp = (state.groups || []).find(function (g) { return g.id === groupId; });
  return grp ? grp.label : (fallback || null);
}

function feastStudentNames(state, studentIds) {
  return (studentIds || []).map(function (id) {
    var s = (state.students || []).find(function (st) { return st.id === id; });
    return s ? s.name : id;
  });
}

// Cards that claim to have come from this strand assignment. Existing app
// cards do not carry strandAssignmentId, so this is intentionally narrow —
// see the prototype notes: without that link, preview <-> card reconciliation
// stays ambiguous and we do NOT guess by title.
function cardsForStrandAssignment(state, assignment) {
  if (!assignment) return [];
  return (state.cards || []).filter(function (c) { return c.strandAssignmentId === assignment.id; });
}

// Rhythm placement is a read-only lookup; a plan with no weeklyRhythm at all
// simply has nothing placed. Guarded so the feast never fails to build.
function safeLoopHasRhythmPlacement(state, loopId) {
  try { return loopHasRhythmPlacement(state, loopId) === true; } catch (e) { return false; }
}
function safeCardHasRhythmPlacement(state, cardId) {
  try { return cardHasRhythmPlacement(state, cardId) === true; } catch (e) { return false; }
}

// One row per FEAST_LIBRARY entry — always, regardless of assignment state.
export function buildFeastRows(state) {
  state = (state && typeof state === 'object') ? state : {};
  var loops = state.loops || [];
  return (M.FEAST_LIBRARY || []).map(function (strand) {
    var assignment = feastAssignmentFor(state, strand.id);
    // AUDIENCE only. Legacy 'loop' is read as "no audience recorded".
    var mode = M.resolveStrandAudience(assignment);
    var warnings = [];

    // Loop membership is orthogonal to audience — read it on its own.
    var loopId = assignment ? M.resolveStrandLoopId(assignment) : null;
    var loop = loopId ? loops.find(function (l) { return l.id === loopId; }) : null;
    var loopTitle = loop ? loop.title : null;
    if (loopId && !loop) warnings.push('In a loop that no longer exists');
    if (mode === 'individual' && !(assignment.studentIds || []).length) {
      warnings.push('Assigned to individual work but no students selected');
    }
    if (mode === 'custom-group' && !feastGroupLabel(state, assignment.groupId, null)) {
      warnings.push('Assigned to a group that no longer exists');
    }

    // Who — parent-facing AUDIENCE text. A loop is not an audience, so a strand
    // in a loop with no audience yet says exactly that.
    var whoLabel = '';
    if (mode === 'everyone') whoLabel = 'Everyone';
    else if (mode === 'custom-group') whoLabel = feastGroupLabel(state, assignment.groupId, 'Group');
    else if (mode === 'older-students') whoLabel = feastGroupLabel(state, 'older', 'Older Students');
    else if (mode === 'littles') whoLabel = feastGroupLabel(state, 'littles', 'Littles');
    else if (mode === 'individual') whoLabel = feastStudentNames(state, assignment.studentIds).join(', ');
    else if (mode === 'coop-outside') whoLabel = 'Co-op / outside';
    else if (loopId) whoLabel = 'Audience not chosen yet';

    // Off for this year is the orthogonal flag now; the legacy audience mode is
    // still honoured on read.
    var isActive = M.resolveStrandActiveThisYear(assignment);

    // Placement — DERIVED, never stored. Precedence matters.
    var placementState, placementLabel;
    if (!isActive) {
      placementState = 'not-this-year';
      placementLabel = 'Not this year';
    } else if (mode === 'coop-outside') {
      placementState = 'coop-outside';
      placementLabel = 'Co-op / outside';
    } else if (loopId && safeLoopHasRhythmPlacement(state, loopId)) {
      placementState = 'covered-by-loop';
      placementLabel = 'Covered by ' + (loopTitle || 'a loop');
    } else if (loopId) {
      placementState = 'in-loop-not-placed';
      placementLabel = 'In ' + (loopTitle || 'a loop') + ', not in weekly rhythm yet';
    } else if (mode && cardsForStrandAssignment(state, assignment).some(function (c) { return safeCardHasRhythmPlacement(state, c.id); })) {
      placementState = 'placed';
      placementLabel = 'In weekly rhythm';
    } else if (!mode) {
      placementState = 'unassigned';
      placementLabel = '';
    } else {
      placementState = 'still-to-place';
      placementLabel = 'Still to place';
    }

    // Resource coverage — read-only over resourceUses linked to cards that
    // point back at this assignment.
    var linkedCardIds = cardsForStrandAssignment(state, assignment).map(function (c) { return c.id; });
    var hasResources = linkedCardIds.length > 0 && (state.resourceUses || []).some(function (u) {
      return linkedCardIds.indexOf(u.cardId) > -1;
    });

    return {
      strandId: strand.id,
      form: strand.form,
      formLabel: M.feastFormLabel(strand.form),
      column: strand.column,
      columnLabel: feastColumnLabel(strand.column),
      label: strand.label,
      stackId: M.stackForStrand(strand),
      stackLabel: M.stackLabel(M.stackForStrand(strand)),
      activeThisYear: isActive,
      assignment: assignment,
      // AUDIENCE only. Legacy 'loop' normalizes to null (audience unresolved).
      assignmentMode: mode,
      audienceMode: mode,
      hasAudience: mode != null,
      whoLabel: whoLabel || '',
      loopId: loopId,
      loopTitle: loopTitle,
      placementState: placementState,
      placementLabel: placementLabel,
      resourceState: hasResources ? 'has-resources' : 'no-resources-tracked',
      warnings: warnings
    };
  });
}

// Read-only preview of the cards the current assignments WOULD produce.
// Never written back into state.cards — the prototype creates no cards.
export function buildDerivedCardPreview(state) {
  var assignments = state.strandAssignments || [];
  var required = M.deriveRequiredCards(assignments, state.students || [], state.groups || [], state.loops || []);
  var byId = {};
  assignments.forEach(function (sa) { byId[sa.id] = sa; });

  var familyCards = [];
  var groupCards = [];
  var individualCards = [];
  var coopCards = [];

  function push(list, key, fields, strandId) {
    var found = list.find(function (e) { return e._key === key; });
    if (!found) {
      found = Object.assign({ _key: key, strandIds: [] }, fields);
      list.push(found);
    }
    if (strandId && found.strandIds.indexOf(strandId) === -1) found.strandIds.push(strandId);
    return found;
  }

  required.forEach(function (req) {
    var sa = byId[req.strandAssignmentId];
    var strandId = sa ? sa.strandId : null;
    if (req.audience === 'together') {
      push(familyCards, req.title, { title: req.title }, strandId);
    } else if (req.audience === 'group') {
      var groupId = (req.participantIds || [])[0] || (sa ? sa.groupId : null);
      var groupLabel = feastGroupLabel(state, groupId, null) ||
        (req.title.indexOf(' — ') > -1 ? req.title.split(' — ').pop() : 'Group');
      push(groupCards, req.title, { title: req.title, groupLabel: groupLabel }, strandId);
    } else if (req.audience === 'individual') {
      var studentId = (req.participantIds || [])[0];
      var studentName = feastStudentNames(state, [studentId])[0] || '';
      push(individualCards, req.title, { title: req.title, studentName: studentName }, strandId);
    } else if (req.audience === 'coop-outside') {
      push(coopCards, req.title, { title: req.title }, strandId);
    }
  });

  var loopCovered = [];
  var excluded = [];
  assignments.forEach(function (sa) {
    if (M.resolveStrandLoopId(sa)) {
      var loop = (state.loops || []).find(function (l) { return l.id === sa.loopId; });
      var entry = loopCovered.find(function (e) { return e.loopId === sa.loopId; });
      if (!entry) {
        entry = {
          loopId: sa.loopId || null,
          // Never invent a title — an unresolvable loop says so plainly.
          loopTitle: loop ? loop.title : 'A loop that no longer exists',
          strandIds: [], strandLabels: []
        };
        loopCovered.push(entry);
      }
      if (sa.strandId && entry.strandIds.indexOf(sa.strandId) === -1) {
        entry.strandIds.push(sa.strandId);
        entry.strandLabels.push(sa.strandLabel || sa.strandId);
      }
    } else if (!M.resolveStrandActiveThisYear(sa)) {
      excluded.push({ label: sa.strandLabel || sa.strandId, strandId: sa.strandId });
    }
  });

  function clean(list) {
    return list.map(function (e) { var c = Object.assign({}, e); delete c._key; return c; });
  }

  return {
    familyCards: clean(familyCards),
    groupCards: clean(groupCards),
    individualCards: clean(individualCards),
    loopCovered: loopCovered,
    coopCards: clean(coopCards),
    excluded: excluded
  };
}

// Upsert exactly one StrandAssignment per strandId — audience is entered in
// exactly one place, so assigning again updates instead of appending.
// Mutates state.strandAssignments only. Returns the assignment (or null when
// the decision cleared a prototype-created assignment).
export function setStrandAssignmentForStrand(state, strandId, strandLabel, fields) {
  if (!state.strandAssignments) state.strandAssignments = [];
  var existing = feastAssignmentFor(state, strandId);
  fields = fields || {};

  // "Not this year" is NOT an audience. A caller that still says so is making
  // the use-this-year decision, so translate it to the orthogonal flag and
  // leave the audience — and everything else — exactly as it is.
  if (fields.assignmentMode === 'not-this-year') {
    var offFields = Object.assign({}, fields, { useThisYear: false });
    delete offFields.assignmentMode;
    return setStrandAssignmentForStrand(state, strandId, strandLabel, offFields);
  }

  if (fields.assignmentMode === null) {
    // Clearing the audience back to "not decided yet". The RECORD ALWAYS
    // SURVIVES: loop membership, work type, the light-day opt-in, notes and the
    // record id are all decisions in their own right, and clearing who a strand
    // is for must never take them with it. resetPrototypeStrandAssignments is
    // the only thing that removes prototype records, and these keep createdBy.
    if (!existing) return null;
    var clearing = Object.assign({}, fields);
    delete clearing.assignmentMode;
    Object.assign(existing, { groupId: null, studentIds: [], coopProvider: '' }, clearing, { assignmentMode: null });
    if (strandLabel) existing.strandLabel = strandLabel;
    return existing;
  }

  // Legacy shim: a caller that still speaks the old "assignmentMode: 'loop'"
  // language is asking for loop MEMBERSHIP, not an audience. Honour the loop and
  // leave the audience genuinely unresolved rather than inventing one.
  if (fields.assignmentMode === 'loop') {
    var legacy = Object.assign({}, fields, { assignmentMode: null });
    var moved = moveStrandLoopAssignment(state, strandId, strandLabel, fields.loopId || null);
    if (moved) {
      Object.keys(legacy).forEach(function (k) {
        if (k === 'assignmentMode' || k === 'loopId') return;
        moved[k] = legacy[k];
      });
      moved.assignmentMode = null;
    }
    return moved;
  }

  // Changing WHO the strand is for clears the other AUDIENCE fields, so a stale
  // groupId can never linger behind a new choice. `loopId` is NOT an audience
  // field and is never cleared here — a strand keeps its loop when its audience
  // changes. Edits that say nothing about audience (e.g. workType) must leave
  // the audience exactly as it is.
  var changesAudience = Object.prototype.hasOwnProperty.call(fields, 'assignmentMode');
  var base = changesAudience ? { groupId: null, studentIds: [], coopProvider: '' } : {};
  if (existing) {
    Object.assign(existing, base, fields, { strandLabel: strandLabel || existing.strandLabel });
    return existing;
  }
  // Nothing to attach an edit to yet. The use-this-year decision is real on its
  // own, so it may start a record — but it never invents an audience.
  var changesActive = Object.prototype.hasOwnProperty.call(fields, 'useThisYear');
  if (!changesAudience && !changesActive) return null;
  if (!changesAudience) base = { assignmentMode: null };
  var created = M.makeStrandAssignment(Object.assign({
    strandId: strandId,
    strandLabel: strandLabel || strandId,
    createdBy: FEAST_PROTOTYPE_CREATED_BY
  }, base, fields));
  state.strandAssignments.push(created);
  return created;
}

// THE single mover for "which loop is this strand in".
//
// Loop membership is ORTHOGONAL to audience. This mover therefore writes exactly
// ONE field — `loopId` — and touches nothing else. It never rewrites
// assignmentMode, groupId, studentIds, coopProvider, workType,
// mayOccurOnLightDays, notes, sortOrder, createdBy, or id. A strand assigned to a
// custom group keeps that group when it joins a loop, and keeps it when it leaves.
//
//  - targetLoopId non-null -> loopId set (audience untouched; a loop's
//                             defaultAudience may PREFILL an audience only when
//                             the strand has none)
//  - targetLoopId null     -> back to Unsorted: loopId null, record KEPT so
//                             audience / workType / notes all survive
//
// Exactly one assignment per strand: an existing record is updated in place,
// never appended to. Records it leaves behind still carry createdBy, so
// resetPrototypeStrandAssignments still clears them.
export function moveStrandLoopAssignment(state, strandId, strandLabel, targetLoopId) {
  if (!state || typeof state !== 'object') return null;
  if (!Array.isArray(state.strandAssignments)) state.strandAssignments = [];
  var existing = feastAssignmentFor(state, strandId);
  var loopId = targetLoopId == null ? null : targetLoopId;

  if (existing) {
    existing.loopId = loopId;
    if (strandLabel) existing.strandLabel = strandLabel;
    applyLoopDefaultAudience(state, existing, loopId);
    return existing;
  }

  // Nothing recorded yet and nothing to record: returning an unrecorded strand
  // to Unsorted is a no-op, and must not invent an assignment.
  if (!loopId) return null;

  var created = M.makeStrandAssignment({
    strandId: strandId,
    strandLabel: strandLabel || strandId,
    // No audience is invented by a loop move. The bucket's defaultAudience (if
    // it has one) may fill this in below — nothing else does.
    assignmentMode: null,
    loopId: loopId,
    groupId: null,
    studentIds: [],
    coopProvider: '',
    createdBy: FEAST_PROTOTYPE_CREATED_BY
  });
  state.strandAssignments.push(created);
  applyLoopDefaultAudience(state, created, loopId);
  return created;
}

// A loop's defaultAudience is a PREFILL, not a rule: it only ever fills an
// audience a strand does not have, at the moment it joins. It never overwrites
// an existing audience and is never applied retroactively.
function applyLoopDefaultAudience(state, assignment, loopId) {
  if (!loopId || !assignment) return assignment;
  if (M.resolveStrandAudience(assignment) != null) return assignment;
  var loop = sArrLoops(state).find(function (l) { return l && l.id === loopId; });
  var raw = loop ? loop.defaultAudience : null;
  if (!raw) return assignment;
  // Accept either a plain mode string or { mode, groupId, studentIds }.
  var def = typeof raw === 'string' ? { mode: raw } : raw;
  if (!def || M.STRAND_ASSIGNMENT_MODES.indexOf(def.mode) === -1) return assignment;
  assignment.assignmentMode = def.mode;
  if (def.groupId) assignment.groupId = def.groupId;
  if (Array.isArray(def.studentIds)) assignment.studentIds = def.studentIds.slice();
  return assignment;
}

function sArrLoops(state) {
  var s = (state && typeof state === 'object') ? state : {};
  return Array.isArray(s.loops) ? s.loops : [];
}

// Set a strand's AUDIENCE, leaving its loop membership entirely alone. A thin,
// explicitly-named wrapper over setStrandAssignmentForStrand for callers that
// want the split spelled out.
export function setStrandAudience(state, strandId, strandLabel, audienceValue) {
  return setStrandAssignmentForStrand(state, strandId, strandLabel, { assignmentMode: audienceValue == null ? null : audienceValue });
}

// Turn a strand on or off for this year, touching NOTHING else. Audience, loop,
// work type, the light-day opt-in and notes all survive both directions, so a
// strand switched off and back on comes back exactly as it was.
export function setStrandUseThisYear(state, strandId, strandLabel, useThisYear) {
  var assignment = setStrandAssignmentForStrand(state, strandId, strandLabel, {
    useThisYear: useThisYear !== false
  });
  // A legacy record that recorded the same decision in the audience field is
  // repaired here rather than left to contradict the flag.
  if (assignment && assignment.assignmentMode === 'not-this-year') assignment.assignmentMode = null;
  return assignment;
}

// Returns a NEW state with only prototype-created assignments removed.
// Assignments made anywhere else in the app are preserved untouched.
export function resetPrototypeStrandAssignments(state) {
  return Object.assign({}, state, {
    strandAssignments: (state.strandAssignments || []).filter(function (sa) {
      return sa.createdBy !== FEAST_PROTOTYPE_CREATED_BY;
    })
  });
}

// Assigns a strand to a loop by adding a new strand assignment to state.
// Returns the mutated state.
export function assignStrandToLoop(state, strandId, strandLabel, loopId) {
  if (!state.strandAssignments) state.strandAssignments = [];
  state.strandAssignments.push(M.makeStrandAssignment({
    strandId: strandId,
    strandLabel: strandLabel,
    assignmentMode: null,
    loopId: loopId
  }));
  return state;
}

// ---------------------------------------------------------------------------
// Setup prototype — derivation helpers.
//
// Everything below is PURE and READ-ONLY. Nothing here mutates state, creates
// cards, or syncs derived data anywhere. Every array read is guarded so a
// legacy/degenerate state ({} or a plan with missing optional collections)
// never throws.
//
// The only thing Setup ever STORES beyond the model objects themselves is two
// explicit acknowledgement booleans under state.setupPrototype. Everything
// else — Everyone membership, student availability, group availability,
// progress — is derived on every call.
// ---------------------------------------------------------------------------

function sArr(x) { return Array.isArray(x) ? x : []; }
function sObj(x) { return (x && typeof x === 'object') ? x : {}; }

export function setupWeekdayIds() {
  return sArr(M.WEEKDAYS).map(function (d) { return d.id; });
}

function setupStudents(state) { return sArr(sObj(state).students); }
function setupGroups(state) { return sArr(sObj(state).groups); }
function setupCommitments(state) { return sArr(sObj(state).outsideCommitments); }

function activeStudents(state) {
  return setupStudents(state).filter(function (s) { return s && s.active !== false; });
}

function studentName(state, id) {
  var s = setupStudents(state).find(function (x) { return x && x.id === id; });
  return s ? (s.name || s.id) : id;
}

export function gradeBandLabel(gradeBand) {
  var b = sArr(M.GRADE_BANDS).find(function (g) { return g.id === gradeBand; });
  return b ? b.label : (gradeBand || '');
}

// Join names as "A, B and C" — parent-facing, never hardcoded.
export function joinNames(names) {
  var list = sArr(names).filter(function (n) { return n != null && n !== ''; });
  if (!list.length) return '';
  if (list.length === 1) return String(list[0]);
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

// "Everyone" is always every active student. It is derived, never a group.
export function getEveryoneStudentIds(state) {
  return activeStudents(state).map(function (s) { return s.id; });
}

// Resolve which students a commitment applies to.
export function getCommitmentParticipantIds(state, commitment) {
  var c = sObj(commitment);
  if (c.participantMode === 'everyone') return getEveryoneStudentIds(state);
  if (c.participantMode === 'individual') {
    var active = getEveryoneStudentIds(state);
    return sArr(c.studentIds).filter(function (id) { return active.indexOf(id) > -1; });
  }
  // default: group
  var grp = setupGroups(state).find(function (g) { return g && g.id === c.groupId; });
  if (!grp) return [];
  var actives = getEveryoneStudentIds(state);
  return sArr(grp.studentIds).filter(function (id) { return actives.indexOf(id) > -1; });
}

// Baseline workdays for one student. A student saved before Setup existed has
// no workdays object at all — that means "every weekday", never "no days".
function studentWorkdays(student) {
  var days = setupWeekdayIds();
  var stored = sObj(sObj(student).workdays);
  var out = {};
  var hasAny = Object.keys(stored).length > 0;
  days.forEach(function (d) { out[d] = hasAny ? stored[d] === true : true; });
  return out;
}

var SUGGESTABLE_CAPACITIES = ['light-independent', 'outside-only', 'off'];

// Rank capacities so the most limiting suggestion wins when two commitments
// land on the same weekday.
var CAPACITY_WEIGHT = { 'full': 0, 'light-independent': 1, 'outside-only': 2, 'off': 3 };

// ---------------------------------------------------------------------------
// Capacity + availability — FOUR functions with unambiguous names.
//
//  1. getStudentBaselineCapacity          — what the parent explicitly chose
//  2. getCommitmentCapacitySuggestions    — unapplied suggestions, never folded in
//  3. getStudentEffectiveCapacity         — the ONLY capacity planning may use
//  4. getStudentAvailableDaysForWorkType  — (3) evaluated against the matrix
//
// All pure, all tolerant of {} and missing arrays. Suggestions are never
// applied to capacity by any of these — a suggestion only becomes capacity
// when the parent applies it (which writes dayCapacity + dayCapacityExplicit).
// ---------------------------------------------------------------------------

// 1. Baseline: the parent's explicit choice, with the legacy fallback chain and
// nothing else. `source` says exactly where each day's value came from.
export function getStudentBaselineCapacity(state, studentId) {
  var days = setupWeekdayIds();
  var student = setupStudents(state).find(function (s) { return s && s.id === studentId; }) || {};
  var storedCapacity = sObj(student.dayCapacity);
  var storedWorkdays = sObj(student.workdays);
  var explicitFlags = sObj(student.dayCapacityExplicit);

  var dayCapacity = {};
  var explicit = {};
  var source = {};
  days.forEach(function (d) {
    dayCapacity[d] = M.resolveDayCapacity(student, d);
    explicit[d] = explicitFlags[d] === true;
    if (typeof storedCapacity[d] === 'string' && M.DAY_CAPACITY_IDS.indexOf(storedCapacity[d]) > -1) {
      source[d] = 'explicit';
    } else if (typeof storedWorkdays[d] === 'boolean') {
      source[d] = 'legacy-workdays';
    } else {
      source[d] = 'default';
    }
  });

  return { studentId: studentId, dayCapacity: dayCapacity, explicit: explicit, source: source };
}

// 2. Suggestions only. Nothing downstream folds these into a capacity — they
// exist so a UI can offer "Apply". A day the parent set by hand never yields a
// suggestion.
export function getCommitmentCapacitySuggestions(state, studentId) {
  var days = setupWeekdayIds();
  var baseline = getStudentBaselineCapacity(state, studentId);
  var suggestions = {};

  setupCommitments(state).forEach(function (c) {
    if (getCommitmentParticipantIds(state, c).indexOf(studentId) === -1) return;
    var suggested = SUGGESTABLE_CAPACITIES.indexOf(c.suggestedCapacity) > -1 ? c.suggestedCapacity : 'outside-only';
    var label = c.label || 'Outside commitment';
    sArr(c.weekdays).forEach(function (d) {
      if (days.indexOf(d) === -1) return;
      if (baseline.explicit[d] === true) return;             // hand-set days are never second-guessed
      if (suggested === baseline.dayCapacity[d]) return;     // nothing to offer
      var current = suggestions[d];
      if (current && CAPACITY_WEIGHT[current.capacity] >= CAPACITY_WEIGHT[suggested]) return;
      suggestions[d] = { capacity: suggested, fromCommitmentId: c.id || null, fromCommitmentLabel: label };
    });
  });

  return {
    studentId: studentId,
    suggestions: suggestions,
    suggestedDayIds: days.filter(function (d) { return !!suggestions[d]; })
  };
}

// 3. THE capacity planning and scheduling may use. Equals the baseline —
// unapplied suggestions are reported, never applied.
export function getStudentEffectiveCapacity(state, studentId) {
  var baseline = getStudentBaselineCapacity(state, studentId);
  var sug = getCommitmentCapacitySuggestions(state, studentId);
  return {
    studentId: studentId,
    dayCapacity: baseline.dayCapacity,
    explicit: baseline.explicit,
    source: baseline.source,
    hasUnappliedSuggestions: sug.suggestedDayIds.length > 0
  };
}

// 4. Effective capacity evaluated against the work-type x capacity matrix.
export function getStudentAvailableDaysForWorkType(state, studentId, workTypeId, opts) {
  var days = setupWeekdayIds();
  var eff = getStudentEffectiveCapacity(state, studentId);
  var byDay = {};
  var eligibleDayIds = [];
  days.forEach(function (d) {
    var cap = eff.dayCapacity[d];
    var verdict = M.workTypeAllowedOnCapacity(workTypeId, cap, opts);
    byDay[d] = { allowed: verdict.allowed === true, capacity: cap, reason: verdict.reason };
    if (verdict.allowed === true) eligibleDayIds.push(d);
  });
  return { studentId: studentId, workTypeId: workTypeId, eligibleDayIds: eligibleDayIds, byDay: byDay };
}

var DEPRECATION_NOTE =
  'getStudentAvailability is deprecated. Use getStudentBaselineCapacity, ' +
  'getCommitmentCapacitySuggestions, getStudentEffectiveCapacity, or ' +
  'getStudentAvailableDaysForWorkType. availableDayIds here means "days whose ' +
  'effective capacity is Full", which is NOT the pre-capacity meaning ' +
  '("a workday not blocked by a commitment").';

/**
 * @deprecated Replaced by four unambiguous functions:
 *   - getStudentBaselineCapacity(state, studentId)
 *   - getCommitmentCapacitySuggestions(state, studentId)
 *   - getStudentEffectiveCapacity(state, studentId)
 *   - getStudentAvailableDaysForWorkType(state, studentId, workTypeId, opts)
 *
 * `availableDayIds` on this object means "days whose effective capacity is
 * Full". That is NOT what it meant before day capacities existed, when it meant
 * "a workday not blocked by an outside commitment". A day that is now
 * light-independent or outside-only is a real working day for some kinds of
 * work, but is absent from availableDayIds.
 *
 * Reimplemented as a thin delegate over the four functions above so there is
 * exactly one source of truth. The returned object carries `deprecated: true`
 * and `deprecationNote` so a caller can notice at runtime.
 */
export function getStudentAvailability(state, studentId) {
  var days = setupWeekdayIds();
  var student = setupStudents(state).find(function (s) { return s && s.id === studentId; }) || {};
  var eff = getStudentEffectiveCapacity(state, studentId);
  var sug = getCommitmentCapacitySuggestions(state, studentId);

  var capacityLabels = {};
  days.forEach(function (d) { capacityLabels[d] = M.dayCapacityLabel(eff.dayCapacity[d]); });

  var blockedBy = {};
  days.forEach(function (d) { blockedBy[d] = []; });
  setupCommitments(state).forEach(function (c) {
    if (getCommitmentParticipantIds(state, c).indexOf(studentId) === -1) return;
    if (c.blocksRegularWork === false) return;
    sArr(c.weekdays).forEach(function (d) {
      if (days.indexOf(d) === -1) return;
      blockedBy[d].push(c.label || 'Outside commitment');
    });
  });

  // Pre-capacity shape: suggestedCapacity used `fromCommitment`, not
  // `fromCommitmentLabel`. Kept exactly as it was for existing callers.
  var suggestedCapacity = {};
  Object.keys(sug.suggestions).forEach(function (d) {
    suggestedCapacity[d] = { capacity: sug.suggestions[d].capacity, fromCommitment: sug.suggestions[d].fromCommitmentLabel };
  });

  function daysWith(cap) { return days.filter(function (d) { return eff.dayCapacity[d] === cap; }); }

  return {
    studentId: studentId,
    workdays: studentWorkdays(student),
    blockedBy: blockedBy,
    dayCapacity: eff.dayCapacity,
    capacityLabels: capacityLabels,
    suggestedCapacity: suggestedCapacity,
    availableDayIds: daysWith('full'),
    coopOnlyDayIds: daysWith('outside-only'),
    lightDayIds: daysWith('light-independent'),
    offDayIds: daysWith('off'),
    deprecated: true,
    deprecationNote: DEPRECATION_NOTE
  };
}

/**
 * @deprecated Duplicate of getStudentAvailableDaysForWorkType. Delegates to it
 * so there is one implementation of eligibility, not two.
 */
export function getStudentWorkEligibility(state, studentId, workTypeId, opts) {
  return getStudentAvailableDaysForWorkType(state, studentId, workTypeId, opts);
}

function groupMemberIds(state, groupId) {
  var grp = setupGroups(state).find(function (g) { return g && g.id === groupId; });
  var actives = getEveryoneStudentIds(state);
  return grp ? sArr(grp.studentIds).filter(function (id) { return actives.indexOf(id) > -1; }) : [];
}

// Group availability for ONE kind of work. Two genuinely different modes:
//
//  - shared work (shared-with-mom, group-lesson) is 'all-must-allow': the group
//    only meets on a day every active member allows, and blockedBy names who
//    stops it.
//  - independent work is 'per-student': one member's light day never removes
//    the day for anyone else. eligibleDayIds is the union, and perStudent
//    carries each member's own days.
export function getGroupWorkAvailability(state, groupId, workTypeId, opts) {
  var days = setupWeekdayIds();
  var memberIds = groupMemberIds(state, groupId);
  var shared = M.isSharedWorkType(workTypeId);
  var mode = shared ? 'all-must-allow' : 'per-student';

  var perStudent = {};
  var perDayDetail = {};
  days.forEach(function (d) { perDayDetail[d] = []; });

  memberIds.forEach(function (id) {
    var el = getStudentAvailableDaysForWorkType(state, id, workTypeId, opts);
    perStudent[id] = el.eligibleDayIds.slice();
    days.forEach(function (d) {
      perDayDetail[d].push({ studentId: id, name: studentName(state, id), capacity: el.byDay[d].capacity, allowed: el.byDay[d].allowed, reason: el.byDay[d].reason });
    });
  });

  var blockedBy = {};
  var eligibleDayIds = [];
  var partialDayIds = [];

  days.forEach(function (d) {
    var entries = perDayDetail[d];
    var blockers = entries.filter(function (e) { return !e.allowed; })
      .map(function (e) { return { studentId: e.studentId, name: e.name, capacity: e.capacity, reason: e.reason }; });
    if (blockers.length) blockedBy[d] = blockers;
    if (!memberIds.length) return;
    var allAllow = entries.every(function (e) { return e.allowed; });
    var someAllow = entries.some(function (e) { return e.allowed; });
    if (shared) {
      if (allAllow) eligibleDayIds.push(d);
      else if (someAllow) partialDayIds.push(d);
    } else {
      if (someAllow) eligibleDayIds.push(d);
      if (someAllow && !allAllow) partialDayIds.push(d);
    }
  });

  return {
    groupId: groupId,
    workTypeId: workTypeId,
    mode: mode,
    memberIds: memberIds,
    eligibleDayIds: eligibleDayIds,
    partialDayIds: partialDayIds,
    blockedBy: blockedBy,
    perStudent: perStudent,
    note: shared
      ? 'Everyone in the group has to be able to do this work that day.'
      : 'Each child is evaluated separately — one child\'s lighter day does not remove the day for the others.'
  };
}

// Group availability is DERIVED from members — never entered independently.
// Kept for existing callers; it is the group-lesson case of
// getGroupWorkAvailability.
export function getGroupAvailability(state, groupId) {
  var g = getGroupWorkAvailability(state, groupId, 'group-lesson');
  return {
    groupId: groupId,
    memberIds: g.memberIds,
    availableDayIds: g.eligibleDayIds,
    partialDayIds: g.partialDayIds
  };
}

// ---------------------------------------------------------------------------
// Audience options — the SINGLE source of truth for the Feast Who/Group
// dropdown. memberNames is what makes membership visible without re-entry.
// ---------------------------------------------------------------------------
export function buildAudienceOptions(state) {
  var options = [];
  var everyoneIds = getEveryoneStudentIds(state);
  options.push({
    value: 'everyone', kind: 'everyone', label: 'Everyone',
    memberIds: everyoneIds.slice(),
    memberNames: everyoneIds.map(function (id) { return studentName(state, id); })
  });

  setupGroups(state).filter(function (g) { return g && g.active !== false; })
    .slice()
    .sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); })
    .forEach(function (g) {
      var ids = sArr(g.studentIds).filter(function (id) { return everyoneIds.indexOf(id) > -1; });
      options.push({
        value: 'group:' + g.id, kind: 'group', groupId: g.id, label: g.label || 'Group',
        memberIds: ids, memberNames: ids.map(function (id) { return studentName(state, id); })
      });
    });

  activeStudents(state)
    .slice()
    .sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); })
    .forEach(function (s) {
      options.push({
        value: 'student:' + s.id, kind: 'student', studentId: s.id, label: s.name || s.id,
        memberIds: [s.id], memberNames: [s.name || s.id]
      });
    });

  sArr(sObj(state).loops).forEach(function (l) {
    if (!l) return;
    var ids = [];
    try {
      ids = M.resolveParticipants(l, setupStudents(state), setupGroups(state)) || [];
    } catch (e) { ids = []; }
    ids = ids.filter(function (id) { return everyoneIds.indexOf(id) > -1; });
    options.push({
      value: 'loop:' + l.id, kind: 'loop', loopId: l.id, label: 'In: ' + (l.title || l.id),
      memberIds: ids, memberNames: ids.map(function (id) { return studentName(state, id); })
    });
  });

  options.push({ value: 'coop', kind: 'coop', label: 'Co-op / outside', memberIds: [], memberNames: [] });
  return options;
}

export function findAudienceOption(state, value) {
  return buildAudienceOptions(state).find(function (o) { return o.value === value; }) || null;
}

// Parent-facing sentence explaining what a Who choice actually creates.
export function describeAudienceConsequence(state, value, strandLabel) {
  if (!value) return '';
  var opt = findAudienceOption(state, value);
  if (!opt) {
    if (String(value).indexOf('group:') === 0) return 'This group has no members yet.';
    return '';
  }
  if (opt.kind === 'coop') return 'Handled outside the home. No weekly card.';
  if (opt.kind === 'loop') {
    return 'This strand is covered inside ' + String(opt.label).replace(/^In:\s*/, '') + '. No separate weekly card.';
  }
  if (opt.kind === 'everyone') {
    if (!opt.memberNames.length) return 'There is no one active in your family yet.';
    return 'This creates one family strand for everyone: ' + joinNames(opt.memberNames) + '.';
  }
  if (opt.kind === 'student') return 'This creates one strand just for ' + opt.label + '.';
  // group
  if (!opt.memberNames.length) return 'This group has no members yet.';
  if (opt.memberNames.length === 1) return 'This creates one strand for ' + opt.memberNames[0] + '.';
  return 'This creates one shared strand for ' + joinNames(opt.memberNames) + '.';
}

// What downstream choices a Setup edit may affect. Read-only — never mutates.
export function describeAudienceImpact(state, changeDescriptor) {
  var d = sObj(changeDescriptor);
  var assignments = sArr(sObj(state).strandAssignments);
  var affected = [];

  assignments.forEach(function (sa) {
    if (!sa) return;
    if ((d.kind === 'group-members' || d.kind === 'group-delete') && d.groupId) {
      if (sa.assignmentMode === 'custom-group' && sa.groupId === d.groupId) {
        affected.push(sa.strandLabel || sa.strandId || sa.id);
      }
    } else if (d.kind === 'student-deactivate' && d.studentId) {
      if (sa.assignmentMode === 'individual' && sArr(sa.studentIds).indexOf(d.studentId) > -1) {
        affected.push(sa.strandLabel || sa.strandId || sa.id);
      } else if (sa.assignmentMode === 'custom-group' && sa.groupId) {
        var grp = setupGroups(state).find(function (g) { return g && g.id === sa.groupId; });
        if (grp && sArr(grp.studentIds).indexOf(d.studentId) > -1) {
          affected.push(sa.strandLabel || sa.strandId || sa.id);
        }
      }
    }
  });

  var message;
  if (!affected.length) {
    message = 'No strand choices reference this yet, so nothing downstream changes.';
  } else if (d.kind === 'group-delete') {
    message = affected.length + ' strand choice' + (affected.length === 1 ? '' : 's') +
      ' point at this group and will lose their group: ' + affected.join(', ') + '.';
  } else if (d.kind === 'student-deactivate') {
    message = affected.length + ' strand choice' + (affected.length === 1 ? '' : 's') +
      ' may be affected: ' + affected.join(', ') + '.';
  } else {
    message = affected.length + ' strand choice' + (affected.length === 1 ? '' : 's') +
      ' already use this group, so who does the work will change: ' + affected.join(', ') + '.';
  }

  return { affectedStrandCount: affected.length, affectedStrandLabels: affected, message: message };
}

// ---------------------------------------------------------------------------
// Review summary + progress
// ---------------------------------------------------------------------------
// Days whose EFFECTIVE capacity is a full workday. The one place the "full
// workday" shorthand is computed for summaries/progress, so it never drifts.
function fullCapacityDayIds(state, studentId) {
  var eff = getStudentEffectiveCapacity(state, studentId);
  return setupWeekdayIds().filter(function (d) { return eff.dayCapacity[d] === 'full'; });
}

// Split one child's week into the four capacity categories. Together they
// PARTITION the school week: every weekday lands in exactly one of them.
// This is the replacement for the old, ambiguous "availableDayIds".
export function categoriseWeekByCapacity(state, studentId) {
  var days = setupWeekdayIds();
  var eff = getStudentEffectiveCapacity(state, studentId);
  function daysWith(cap) { return days.filter(function (d) { return eff.dayCapacity[d] === cap; }); }
  return {
    fullWorkdayIds: daysWith('full'),
    lightIndependentDayIds: daysWith('light-independent'),
    outsideOnlyDayIds: daysWith('outside-only'),
    offDayIds: daysWith('off')
  };
}

export function buildSetupSummary(state) {
  var family = activeStudents(state).map(function (s) {
    var cats = categoriseWeekByCapacity(state, s.id);
    return {
      id: s.id,
      name: s.name || '',
      grade: s.grade || '',
      gradeBandLabel: gradeBandLabel(s.gradeBand),
      gradeBandConfirmed: s.gradeBandConfirmed === true,
      color: s.color || '#888888',
      active: s.active !== false,
      // The four explicit, unambiguous categories. They partition the week.
      fullWorkdayIds: cats.fullWorkdayIds,
      lightIndependentDayIds: cats.lightIndependentDayIds,
      outsideOnlyDayIds: cats.outsideOnlyDayIds,
      offDayIds: cats.offDayIds,
      // @deprecated alias of fullWorkdayIds. "Available" never said WHICH kind
      // of day it meant. New code must read the four category fields instead.
      availableDayIds: cats.fullWorkdayIds.slice()
    };
  });

  var groups = setupGroups(state).filter(function (g) { return g && g.active !== false; }).map(function (g) {
    var av = getGroupAvailability(state, g.id);
    return {
      id: g.id,
      label: g.label || '',
      memberIds: av.memberIds,
      memberNames: av.memberIds.map(function (id) { return studentName(state, id); }),
      // Unambiguous: days the WHOLE group can meet for a group lesson, and days
      // only some members can.
      groupLessonDayIds: av.availableDayIds.slice(),
      partialGroupLessonDayIds: av.partialDayIds.slice(),
      // @deprecated alias of groupLessonDayIds.
      availableDayIds: av.availableDayIds.slice(),
      partialDayIds: av.partialDayIds.slice()
    };
  });

  var everyoneIds = getEveryoneStudentIds(state);

  var commitments = setupCommitments(state).map(function (c) {
    var ids = getCommitmentParticipantIds(state, c);
    return {
      id: c.id,
      label: c.label || '',
      weekdays: sArr(c.weekdays).slice(),
      participantNames: ids.map(function (id) { return studentName(state, id); }),
      blocksRegularWork: c.blocksRegularWork !== false,
      allowsCoopWork: c.allowsCoopWork !== false
    };
  });

  var loops = sArr(sObj(state).loops).map(function (l) {
    var ids = [];
    try { ids = M.resolveParticipants(l, setupStudents(state), setupGroups(state)) || []; } catch (e) { ids = []; }
    ids = ids.filter(function (id) { return everyoneIds.indexOf(id) > -1; });
    return {
      id: l.id,
      title: l.title || '',
      participantSummary: ids.length ? joinNames(ids.map(function (id) { return studentName(state, id); })) : 'Everyone'
    };
  });

  return {
    family: family,
    groups: groups,
    everyone: { memberIds: everyoneIds, memberNames: everyoneIds.map(function (id) { return studentName(state, id); }) },
    commitments: commitments,
    loops: loops
  };
}

// ---------------------------------------------------------------------------
// Setup reviews BUCKETS. Feast reviews SORTING. Two separate acknowledgements,
// and Setup never depends on strand sorting.
//
//  1. bucketsDefined   — at least one loop bucket exists, OR the parent said
//                        "we will not use loops this year" (noLoopsChosen).
//  2. bucketsReviewed  — the parent said the buckets look right AND the bucket
//                        STRUCTURE has not changed since (fingerprint match).
//  3. sortingComplete  — Feast-level only: every active strand has a handling
//                        decision AND the parent said the sorting looks right.
//
// Unsorted strands are reported here but never appear in setupStepComplete —
// Setup shows them as a forward-looking next step, never as an error.
// ---------------------------------------------------------------------------

// A stable string over the bucket STRUCTURE only: each loop's id + title +
// sorted rhythmDayIds, loops sorted by id. Deliberately EXCLUDES loop
// membership / strand sorting, so moving a strand between buckets can never
// invalidate a bucket review.
// Loops still in use this year. `active` is additive — a loop saved before the
// field existed has no `active` key and is therefore active.
export function activeLoops(state) {
  return sArr(sObj(state).loops).filter(function (l) { return l && l.active !== false; });
}

// Fingerprint format version. Bumped when the FIELDS that make up a bucket's
// structure change, so migration can re-stamp a stored fingerprint once rather
// than forcing every existing user to re-confirm buckets they never touched.
export var LOOP_BUCKET_FINGERPRINT_FORMAT = 2;

// Weekdays are NOT part of this any more: which days a loop actually happens on
// is a Weekly Rhythm decision, not a Setup one. A bucket's Setup-level structure
// is its id, its name, and its optional short description.
export function loopBucketFingerprint(state) {
  var loops = activeLoops(state);
  return loops.map(function (l) {
    var id = String(l.id == null ? '' : l.id);
    var title = String(l.title == null ? '' : l.title);
    var description = String(l.description == null ? '' : l.description);
    return id + '' + title + '' + description;
  }).sort().join('');
}

// The parent-facing forward-looking next step for unsorted strands. Never an
// error, never blocking — Setup renders this as information only.
export function describeUnsortedStrandsNextStep(unsortedStrandCount) {
  var n = Number(unsortedStrandCount) || 0;
  if (n <= 0) return 'Every active strand already has a handling decision.';
  if (n === 1) return '1 active strand still needs a handling decision in Feast Planning.';
  return n + ' active strands still need a handling decision in Feast Planning.';
}

export function getLoopSortingProgress(state) {
  var s = sObj(state);
  var ack = sObj(s.setupPrototype);
  var loops = activeLoops(s);

  var rows = [];
  try { rows = sArr(buildFeastRows(s)); } catch (e) { rows = []; }

  // Unsorted = still active this year, but with no handling decision at all.
  var unsorted = rows.filter(function (r) {
    return r.activeThisYear === true && r.placementState === 'unassigned';
  });
  var unsortedStrandIds = unsorted.map(function (r) { return r.strandId; });

  var noLoopsChosen = ack.noLoopsChosen === true;
  var bucketsDefined = loops.length > 0;

  // Bucket review is DERIVED, not event-driven: the stored fingerprint must
  // still match the current bucket structure. No edit handler has to remember
  // to reset anything.
  var currentFingerprint = loopBucketFingerprint(s);
  var bucketsReviewed = ack.loopBucketsReviewed === true &&
    ack.loopBucketsFingerprint === currentFingerprint;

  var sortingReviewed = ack.loopSortingReviewed === true;

  // "No loops this year" and real, active buckets cannot both be true. When
  // they are, Setup must say so and must NOT report the step complete.
  var noLoopsConflict = noLoopsChosen === true && bucketsDefined === true;

  return {
    bucketsDefined: bucketsDefined,
    noLoopsConflict: noLoopsConflict,
    noLoopsChosen: noLoopsChosen,
    bucketCount: loops.length,
    bucketsReviewed: bucketsReviewed,
    bucketFingerprint: currentFingerprint,
    storedBucketFingerprint: ack.loopBucketsFingerprint == null ? null : ack.loopBucketsFingerprint,
    unsortedStrandIds: unsortedStrandIds,
    unsortedStrandCount: unsortedStrandIds.length,
    unsortedNextStep: describeUnsortedStrandsNextStep(unsortedStrandIds.length),
    sortingReviewed: sortingReviewed,
    setupStepComplete: !noLoopsConflict && (bucketsDefined || noLoopsChosen) && bucketsReviewed,
    sortingComplete: unsortedStrandIds.length === 0 && sortingReviewed
  };
}

// Record "the buckets look right", stamping the structure that was reviewed.
// Mutates state.setupPrototype only.
export function markLoopBucketsReviewed(state) {
  if (!state || typeof state !== 'object') return state;
  if (!state.setupPrototype || typeof state.setupPrototype !== 'object') state.setupPrototype = {};
  state.setupPrototype.loopBucketsReviewed = true;
  state.setupPrototype.loopBucketsFingerprint = loopBucketFingerprint(state);
  return state;
}

// ---------------------------------------------------------------------------
// Loop buckets: creating one, and choosing "no loops this year".
//
// These two answers contradict each other, so exactly ONE function creates a
// bucket and exactly ONE function sets the flag. Both are pure and return a new
// state; neither ever deletes a loop.
// ---------------------------------------------------------------------------

// THE only way to create a loop bucket. Creating a bucket is an unambiguous
// statement that loops ARE being used, so it clears noLoopsChosen. Every caller
// (Setup's "Create a loop bucket" and Feast's inline "+ New loop") goes through
// this — there is deliberately no second creation path that could skip the
// clearing.
// opts (all optional):
//   description     — a short optional line the parent may give the bucket
//   defaultAudience — an audience this bucket PREFILLS onto a strand that has
//                     none when it joins. Never overwrites an existing audience,
//                     never applied retroactively.
export function createLoopBucket(state, title, opts) {
  var s = sObj(state);
  var o = sObj(opts);
  var loops = sArr(s.loops);
  var loop = M.makeLoop({
    title: String(title == null || String(title).trim() === '' ? 'New loop' : title).trim(),
    active: true,
    sortOrder: loops.length,
    description: typeof o.description === 'string' ? o.description : '',
    defaultAudience: o.defaultAudience == null ? null : o.defaultAudience,
    // Kept in the model, never asked for in Setup. Day placement lives in
    // Weekly Rhythm.
    rhythmDayIds: []
  });
  var ack = Object.assign({}, sObj(s.setupPrototype), { noLoopsChosen: false });
  return Object.assign({}, s, { loops: loops.concat([loop]), setupPrototype: ack });
}

// What ticking "No loops this year" would actually do. Read-only.
export function describeNoLoopsImpact(state) {
  var s = sObj(state);
  var buckets = activeLoops(s);
  var bucketIds = buckets.map(function (l) { return l.id; });
  var titles = buckets.map(function (l) { return l.title || 'Untitled loop'; });
  var affected = sArr(s.strandAssignments).filter(function (sa) {
    return sa && sa.loopId != null && bucketIds.indexOf(sa.loopId) > -1;
  });

  var message;
  if (!buckets.length) {
    message = 'There are no loop buckets, so nothing is set aside.';
  } else {
    message = 'You still have ' + buckets.length + ' loop bucket' + (buckets.length === 1 ? '' : 's') +
      ': ' + titles.join(', ') + '. ' +
      (affected.length === 0
        ? 'No strands are sorted into them.'
        : affected.length + ' strand assignment' + (affected.length === 1 ? '' : 's') + ' point at them.') +
      ' Saying "no loops this year" sets these buckets aside. Nothing is deleted, and those strand ' +
      'assignments are kept exactly as they are.';
  }

  return {
    activeBucketCount: buckets.length,
    bucketIds: bucketIds,
    bucketTitles: titles,
    affectedStrandCount: affected.length,
    affectedStrandLabels: affected.map(function (sa) { return sa.strandLabel || sa.strandId || sa.id; }),
    message: message
  };
}

// Set (or clear) "we will not use loops this year".
//
//  - chosen === false: always allowed, needs no confirmation, and deliberately
//    does NOT resurrect archived buckets. Un-ticking a box must not silently
//    put structure back.
//  - chosen === true with active buckets: only archives (active:false) when
//    opts.confirmed === true. Without confirmation the state comes back
//    unchanged, and the returned object carries a non-enumerable
//    `noLoopsConfirmationRequired` flag the caller can act on. Non-enumerable so
//    it never lands in saved JSON.
export function setNoLoopsChosen(state, chosen, opts) {
  var s = sObj(state);
  var o = sObj(opts);
  var buckets = activeLoops(s);

  function mark(next, needsConfirmation) {
    Object.defineProperty(next, 'noLoopsConfirmationRequired', {
      value: needsConfirmation === true, enumerable: false, writable: true, configurable: true
    });
    return next;
  }

  if (chosen !== true) {
    return mark(Object.assign({}, s, {
      setupPrototype: Object.assign({}, sObj(s.setupPrototype), { noLoopsChosen: false })
    }), false);
  }

  if (buckets.length > 0 && o.confirmed !== true) {
    // Unchanged — no flag written, no bucket touched.
    return mark(Object.assign({}, s), true);
  }

  var bucketIds = buckets.map(function (l) { return l.id; });
  var loops = sArr(s.loops).map(function (l) {
    if (l && bucketIds.indexOf(l.id) > -1) return Object.assign({}, l, { active: false });
    return l;
  });

  return mark(Object.assign({}, s, {
    loops: loops,
    setupPrototype: Object.assign({}, sObj(s.setupPrototype), { noLoopsChosen: true })
  }), false);
}

// ---------------------------------------------------------------------------
// Prototype-state migration — one normalizer, called on load by both prototype
// pages. Pure: returns a NEW state and never deletes a legacy field.
// ---------------------------------------------------------------------------
export function migrateSetupPrototypeState(state) {
  var s = sObj(state);
  var ack = sObj(s.setupPrototype);
  var next = Object.assign({}, ack);

  // 1. loopContentsReviewed -> loopSortingReviewed (the old value is PRESERVED).
  if (Object.prototype.hasOwnProperty.call(ack, 'loopContentsReviewed') &&
      !Object.prototype.hasOwnProperty.call(ack, 'loopSortingReviewed')) {
    next.loopSortingReviewed = ack.loopContentsReviewed;
  }

  // 2. An existing user who confirmed the old rhythm step is not forced to
  //    re-confirm a bucket structure they never changed. rhythmReviewed is
  //    PRESERVED.
  if (ack.rhythmReviewed === true &&
      !Object.prototype.hasOwnProperty.call(ack, 'loopBucketsReviewed')) {
    next.loopBucketsReviewed = true;
    next.loopBucketsFingerprint = loopBucketFingerprint(s);
  }

  // 3. Reviewed, but from before fingerprints existed — treat as reviewed-as-is.
  if (next.loopBucketsReviewed === true && next.loopBucketsFingerprint == null) {
    next.loopBucketsFingerprint = loopBucketFingerprint(s);
  }

  // 4. noLoopsChosen is never invented; absent means false.

  // 5. Legacy audience/loop conflation. A record that stored assignmentMode
  //    'loop' recorded a CONTAINER in the audience field, so its audience was
  //    never actually chosen. Keep the loop, set the audience to null (genuinely
  //    unresolved — we do not invent one), and preserve every other field.
  //    Idempotent: once rewritten, no record matches this again.
  var strandAssignments = sArr(s.strandAssignments);
  var rewroteAny = false;
  //    5b. The same conflation in the other direction: a record that stored
  //    'not-this-year' in the audience field recorded a USE-THIS-YEAR decision,
  //    not an audience. Move it to the orthogonal useThisYear flag, clear the
  //    audience (it was never actually chosen), and preserve every other field —
  //    loopId, workType, mayOccurOnLightDays, notes, id, createdBy.
  //    Idempotent: once rewritten, no record matches either branch again.
  var migratedAssignments = strandAssignments.map(function (sa) {
    if (!sa) return sa;
    if (M.isLegacyLoopAssignmentMode(sa.assignmentMode)) {
      rewroteAny = true;
      return Object.assign({}, sa, { assignmentMode: null, loopId: sa.loopId == null ? null : sa.loopId });
    }
    if (sa.assignmentMode === 'not-this-year') {
      rewroteAny = true;
      return Object.assign({}, sa, { assignmentMode: null, useThisYear: false });
    }
    return sa;
  });

  // 6. Bucket fingerprints changed shape (weekdays out, description in). A
  //    parent who already confirmed their buckets must not be asked again for a
  //    change they never made, so re-stamp a STORED fingerprint exactly once,
  //    marked by the format version. Idempotent: the marker stops it repeating,
  //    so a later real edit still re-opens the review.
  if (next.loopBucketsFingerprint != null &&
      next.loopBucketFingerprintFormat !== LOOP_BUCKET_FINGERPRINT_FORMAT) {
    next.loopBucketsFingerprint = loopBucketFingerprint(s);
  }
  next.loopBucketFingerprintFormat = LOOP_BUCKET_FINGERPRINT_FORMAT;

  // 7. Real structure beats a stale flag. If the plan says "no loops this year"
  //    but active loop buckets exist, the buckets are the truth — the flag is
  //    left over from before they were created. Clearing it here is idempotent:
  //    once cleared, the condition no longer holds.
  if (next.noLoopsChosen === true && activeLoops(s).length > 0) {
    next.noLoopsChosen = false;
  }

  var out = Object.assign({}, s, { setupPrototype: next });
  if (rewroteAny) out.strandAssignments = migratedAssignments;
  return out;
}

// ---------------------------------------------------------------------------
// Archived loop buckets — recovery path.
//
// Archiving (setNoLoopsChosen) never deletes anything: the loop keeps its id
// and every reference to it stays exactly where it was. These helpers are the
// way back: list what was set aside, restore one, and — only when genuinely
// nothing points at it any more — delete one for good.
//
// A loop can be referenced from exactly SIX places. Any one of them blocks a
// permanent delete:
//   1. strandAssignment.loopId
//   2. card.loopId
//   3. card.scheduleConfig.loopId
//   4. loopItem.loopId
//   5. resourceUse.loopId
//   6. rhythm assignment with assignmentType 'loop' and referencedId === loopId
// ---------------------------------------------------------------------------

// Pure, read-only. Tolerates {} and any missing array.
export function getLoopReferences(state, loopId) {
  var s = sObj(state);
  var id = loopId;

  var strandAssignmentIds = [];
  var strandLabels = [];
  sArr(s.strandAssignments).forEach(function (sa) {
    if (sa && sa.loopId === id) {
      strandAssignmentIds.push(sa.id);
      strandLabels.push(sa.strandLabel || sa.strandId || sa.id);
    }
  });

  var cardIds = [];
  var scheduleConfigCardIds = [];
  sArr(s.cards).forEach(function (c) {
    if (!c) return;
    if (c.loopId === id) cardIds.push(c.id);
    if (sObj(c.scheduleConfig).loopId === id) scheduleConfigCardIds.push(c.id);
  });

  var loopItemIds = sArr(s.loopItems)
    .filter(function (i) { return i && i.loopId === id; })
    .map(function (i) { return i.id; });

  var resourceUseIds = sArr(s.resourceUses)
    .filter(function (u) { return u && u.loopId === id; })
    .map(function (u) { return u.id; });

  var rhythmAssignmentIds = sArr(sObj(s.weeklyRhythm).assignments)
    .filter(function (a) { return a && a.assignmentType === 'loop' && a.referencedId === id; })
    .map(function (a) { return a.id; });

  var total = strandAssignmentIds.length + cardIds.length + scheduleConfigCardIds.length +
    loopItemIds.length + resourceUseIds.length + rhythmAssignmentIds.length;

  return {
    loopId: id,
    strandAssignmentIds: strandAssignmentIds,
    strandLabels: strandLabels,
    cardIds: cardIds,
    scheduleConfigCardIds: scheduleConfigCardIds,
    loopItemIds: loopItemIds,
    resourceUseIds: resourceUseIds,
    rhythmAssignmentIds: rhythmAssignmentIds,
    total: total,
    strandCount: strandAssignmentIds.length,
    placementCount: rhythmAssignmentIds.length,
    canDeletePermanently: total === 0
  };
}

// The parent-facing sentence when a permanent delete is blocked. Never names a
// family member, a group, a subject, or a specific strand — just the count.
export function describeLoopDeleteBlocked(references) {
  var r = sObj(references);
  if (r.total === 0) return '';
  var n = (Number(r.strandCount) || 0) + (Number(r.placementCount) || 0);
  if (n <= 0) n = Number(r.total) || 0;
  return 'This loop is still used by ' + n + ' strand' + (n === 1 ? '' : 's') +
    ' or placement' + (n === 1 ? '' : 's') + '. Restore it or move those items first.';
}

// Every bucket that was set aside. `active === false` is the ONLY archived
// marker — a loop with no `active` key at all is active, and is never listed.
export function getArchivedLoopBuckets(state) {
  var s = sObj(state);
  var dayLabelFor = {};
  sArr(M.WEEKDAYS).forEach(function (d) { dayLabelFor[d.id] = d.short || d.label || d.id; });

  return sArr(s.loops).filter(function (l) { return l && l.active === false; }).map(function (l) {
    var refs = getLoopReferences(s, l.id);
    var dayIds = sArr(l.rhythmDayIds).slice();
    return {
      loopId: l.id,
      title: l.title || 'Untitled loop',
      rhythmDayIds: dayIds,
      dayLabels: sArr(M.WEEKDAYS)
        .filter(function (d) { return dayIds.indexOf(d.id) > -1; })
        .map(function (d) { return dayLabelFor[d.id]; }),
      references: refs,
      strandCount: refs.strandCount,
      canDeletePermanently: refs.canDeletePermanently,
      blockedReason: describeLoopDeleteBlocked(refs)
    };
  });
}

// Bring one set-aside bucket back, with the SAME id it always had. Nothing else
// moves: strand assignments, loop items, cards, resource uses, and rhythm
// assignments are all left exactly as they are — they never stopped pointing
// here.
//
// Bucket review invalidation is DERIVED, not written: loopBucketFingerprint()
// covers active loops only, so putting one back changes the fingerprint and
// getLoopSortingProgress() reports bucketsReviewed false by itself.
export function restoreLoopBucket(state, loopId) {
  var s = sObj(state);
  var loops = sArr(s.loops).map(function (l) {
    if (l && l.id === loopId) return Object.assign({}, l, { active: true });
    return l;
  });
  // Bucket review must be re-confirmed after a restore.
  //
  // We CANNOT lean on the derived fingerprint here. In the ordering a parent
  // actually follows — review, then archive, then restore — the fingerprint
  // returns to byte-identical to the reviewed one, so the derived check would
  // silently keep the review valid. (It only appears to invalidate if the
  // review happened while the bucket was already archived.)
  //
  // So stamp the PRE-restore fingerprint: the parent last confirmed a structure
  // that no longer matches, which is exactly true, and which cannot collide —
  // the restored bucket is active now and was not a moment ago. Note we keep
  // loopBucketsReviewed set rather than clearing it, so the page reads this as
  // "changed since you confirmed" rather than "never confirmed".
  var ack = Object.assign({}, sObj(s.setupPrototype), {
    noLoopsChosen: false,
    loopBucketsFingerprint: loopBucketFingerprint(s)
  });
  return Object.assign({}, s, { loops: loops, setupPrototype: ack });
}

// Delete a bucket for good. Only ever allowed when NOTHING references it, and
// only on an explicit confirmation. Both refusals come back as the unchanged
// state carrying a non-enumerable marker — same signalling shape as
// setNoLoopsChosen's noLoopsConfirmationRequired, so it can never reach saved
// JSON.
export function deleteLoopBucketPermanently(state, loopId, opts) {
  var s = sObj(state);
  var o = sObj(opts);

  function mark(next, key, value) {
    Object.defineProperty(next, key, {
      value: value, enumerable: false, writable: true, configurable: true
    });
    return next;
  }

  var refs = getLoopReferences(s, loopId);
  if (!refs.canDeletePermanently) {
    return mark(Object.assign({}, s), 'loopDeleteBlocked', describeLoopDeleteBlocked(refs));
  }
  if (o.confirmed !== true) {
    return mark(Object.assign({}, s), 'loopDeleteConfirmationRequired', true);
  }

  // Removing a loop changes the bucket structure the same way restoring does,
  // and the fingerprint is derived, so a stale review re-opens by itself.
  return Object.assign({}, s, {
    loops: sArr(s.loops).filter(function (l) { return !l || l.id !== loopId; })
  });
}

// Every strand currently sorted into one loop bucket, in feast order.
export function getLoopBucketContents(state, loopId) {
  var rows = [];
  try { rows = sArr(buildFeastRows(sObj(state))); } catch (e) { rows = []; }
  // Membership is loopId — a member may have any audience, or none yet.
  return rows.filter(function (r) { return r.loopId === loopId; });
}

// ---------------------------------------------------------------------------
// Setting ONE loop bucket aside (as opposed to the global "no loops this year").
// ---------------------------------------------------------------------------

// What setting this one bucket aside would touch. Read-only, and it never
// invents its own counting — the six reference surfaces come from
// getLoopReferences, and "other references" is simply everything that is not a
// strand assignment.
export function describeLoopSetAsideImpact(state, loopId) {
  var s = sObj(state);
  var loop = sArr(s.loops).find(function (l) { return l && l.id === loopId; }) || null;
  var refs = getLoopReferences(s, loopId);
  var title = (loop && loop.title) || 'Untitled loop';
  var strandCount = refs.strandCount;
  var otherReferenceCount = refs.total - strandCount;

  var message = 'Set aside "' + title + '"? ' +
    strandCount + ' strand' + (strandCount === 1 ? ' is' : 's are') + ' sorted into it, and it is used by ' +
    otherReferenceCount + ' other reference' + (otherReferenceCount === 1 ? '' : 's') + ' elsewhere in your plan. ' +
    'Nothing is deleted: the bucket keeps its name and its days, everything linked to it stays linked, ' +
    'and you can restore it at any time from "Set Aside Loops".';

  return {
    loopId: loopId,
    title: title,
    strandCount: strandCount,
    strandLabels: refs.strandLabels.slice(),
    otherReferenceCount: otherReferenceCount,
    references: refs,
    message: message
  };
}

// Set ONE bucket aside. Pure; returns a new state.
//
// Only that loop's `active` changes — every other loop, and all six reference
// surfaces, are left exactly as they are. Its id is preserved, so restoring it
// later brings back the same bucket rather than a copy.
//
// Bucket review re-opens by itself: loopBucketFingerprint() covers active loops
// only, so removing one from that set always changes it. (restoreLoopBucket had
// to stamp a fingerprint because a restore can return the value to a byte-
// identical one; archiving can never do that, so no stamp is written here.)
//
// This says nothing at all about "no loops this year" — that global answer is
// never set as a side effect.
export function setAsideLoopBucket(state, loopId, opts) {
  var s = sObj(state);
  var o = sObj(opts);

  function mark(next, needsConfirmation) {
    Object.defineProperty(next, 'loopSetAsideConfirmationRequired', {
      value: needsConfirmation === true, enumerable: false, writable: true, configurable: true
    });
    return next;
  }

  if (o.confirmed !== true) return mark(Object.assign({}, s), true);

  return mark(Object.assign({}, s, {
    loops: sArr(s.loops).map(function (l) {
      if (l && l.id === loopId) return Object.assign({}, l, { active: false });
      return l;
    })
  }), false);
}

// Strands still sorted into set-aside buckets, grouped by bucket.
//
// Only archived loops that actually still hold a strand are listed — an
// archived bucket with nothing in it has nothing to move, so it belongs in
// Setup's Set Aside Loops list and nowhere else. Active loops are never listed.
export function getArchivedLoopStrandGroups(state) {
  var s = sObj(state);
  var rowFor = {};
  try {
    sArr(buildFeastRows(s)).forEach(function (r) { rowFor[r.strandId] = r; });
  } catch (e) { rowFor = {}; }

  return sArr(s.loops).filter(function (l) { return l && l.active === false; }).map(function (l) {
    var strands = sArr(s.strandAssignments).filter(function (sa) {
      return sa && sa.loopId === l.id;
    }).map(function (sa) {
      var row = rowFor[sa.strandId] || null;
      return {
        strandId: sa.strandId,
        label: (row && row.label) || sa.strandLabel || sa.strandId,
        formLabel: (row && row.formLabel) || '',
        columnLabel: (row && row.columnLabel) || '',
        assignment: sa
      };
    });
    return {
      loopId: l.id,
      title: l.title || 'Untitled loop',
      rhythmDayIds: sArr(l.rhythmDayIds).slice(),
      strands: strands
    };
  }).filter(function (g) { return g.strands.length > 0; });
}

// ---------------------------------------------------------------------------
// Availability completion.
//
// Completion is about RESOLUTION, not about having a Full day. A child may
// validly have only light days, only outside/co-op days, only off days, or any
// mix — none of those makes Setup incomplete.
//
// A weekday counts as RESOLVED when any of:
//   1. the parent set that day by hand           (explicit[day] === true)
//   2. the capacity came from legacy workdays    (source === 'legacy-workdays')
//   3. it is still the default, AND the parent has reviewed the defaults
//      (setupPrototype.availabilityReviewed === true)
//
// Anything else is a day still sitting on an unreviewed default.
// ---------------------------------------------------------------------------
export function getAvailabilityCompletion(state) {
  var days = setupWeekdayIds();
  var ack = sObj(sObj(state).setupPrototype);
  var reviewed = ack.availabilityReviewed === true;
  var actives = activeStudents(state);

  var unresolved = [];
  var advisories = [];

  actives.forEach(function (s) {
    var baseline = getStudentBaselineCapacity(state, s.id);
    var name = s.name || s.id;
    var pending = days.filter(function (d) {
      if (baseline.explicit[d] === true) return false;
      if (baseline.source[d] === 'legacy-workdays') return false;
      return !reviewed;
    });
    if (pending.length) unresolved.push({ studentId: s.id, name: name, dayIds: pending });

    // ADVISORY ONLY — never an error, never blocking.
    if (fullCapacityDayIds(state, s.id).length === 0) {
      advisories.push({
        studentId: s.id,
        name: name,
        message: 'No full workdays are selected for ' + name +
          '. Independent or outside work may still be planned.'
      });
    }
  });

  var complete = actives.length >= 1 && unresolved.length === 0;

  var detail;
  if (!actives.length) {
    detail = 'No children added yet.';
  } else if (complete) {
    detail = 'Every child has a capacity set for every school weekday.';
  } else {
    detail = unresolved.length + ' child' + (unresolved.length === 1 ? '' : 'ren') +
      ' still on the suggested day capacities — say "These day capacities look right" to confirm them.';
  }

  return {
    complete: complete,
    activeStudentCount: actives.length,
    availabilityReviewed: reviewed,
    unresolved: unresolved,
    advisories: advisories,
    detail: detail
  };
}

// Record "these day capacities look right". Mutates state.setupPrototype only.
export function markAvailabilityReviewed(state) {
  if (!state || typeof state !== 'object') return state;
  if (!state.setupPrototype || typeof state.setupPrototype !== 'object') state.setupPrototype = {};
  state.setupPrototype.availabilityReviewed = true;
  return state;
}

// Derive what can be derived; read explicit acknowledgements for what cannot.
export function getSetupProgress(state) {
  var ack = sObj(sObj(state).setupPrototype);
  var actives = activeStudents(state);

  var namedAndConfirmed = actives.filter(function (s) {
    return String(s.name || '').trim() !== '' && s.gradeBandConfirmed === true;
  });
  var familyComplete = actives.length >= 1 && namedAndConfirmed.length === actives.length;
  var familyDetail = !actives.length
    ? 'No children added yet.'
    : (familyComplete
      ? actives.length + ' child' + (actives.length === 1 ? '' : 'ren') + ', all with a confirmed Form.'
      : (actives.length - namedAndConfirmed.length) + ' of ' + actives.length + ' still need a name or a confirmed Form.');

  var groupsComplete = ack.groupsReviewed === true;
  var groupCount = setupGroups(state).filter(function (g) { return g && g.active !== false; }).length;
  var groupsDetail = groupsComplete
    ? groupCount + ' group' + (groupCount === 1 ? '' : 's') + ' confirmed (Everyone is always automatic).'
    : 'Not confirmed yet — say "These look right" on the Groups step.';

  // Availability completion is about every weekday having a RESOLVED capacity —
  // never about owning a Full day. Advisories ride along and never block.
  var availability = getAvailabilityCompletion(state);
  var availabilityComplete = availability.complete;

  // Setup step 4 defines loop BUCKETS only. Sorting strands into them happens
  // later, in Feast Planning — so existence of loops never completes the step,
  // and unsorted strands never block it.
  var sorting = getLoopSortingProgress(state);
  var rhythmComplete = sorting.setupStepComplete;
  var rhythmDetail;
  var bucketWord = sorting.bucketCount + ' loop bucket' + (sorting.bucketCount === 1 ? '' : 's');
  if (sorting.noLoopsConflict) {
    // Name the contradiction plainly. It is not an empty state, and not a
    // silent "incomplete" — the parent has to be told which two things clash.
    rhythmDetail = '"No loops this year" is selected but ' + bucketWord + ' still exist. ' +
      'Set the buckets aside, or untick "No loops this year".';
  } else if (!sorting.bucketsDefined && !sorting.noLoopsChosen) {
    rhythmDetail = 'No loop buckets yet. Create the buckets you may use, or say you will not use loops this year — you sort strands into them during Feast Planning.';
  } else if (!sorting.bucketsReviewed) {
    rhythmDetail = (sorting.noLoopsChosen && !sorting.bucketsDefined
      ? 'No loops this year'
      : bucketWord + ' defined') +
      ', not confirmed yet — say "These buckets look right".';
  } else {
    rhythmDetail = (sorting.noLoopsChosen && !sorting.bucketsDefined
      ? 'No loops this year, confirmed.'
      : bucketWord + ' confirmed.') +
      ' ' + sorting.unsortedNextStep + ' Strands are sorted during Feast Planning.';
  }

  return {
    family: { complete: familyComplete, detail: familyDetail },
    groups: { complete: groupsComplete, detail: groupsDetail },
    availability: {
      complete: availabilityComplete,
      detail: availability.detail,
      unresolved: availability.unresolved,
      // Calm, informational. Never affects `complete` or `readyForFeast`.
      advisories: availability.advisories
    },
    rhythm: { complete: rhythmComplete, detail: rhythmDetail },
    readyForFeast: familyComplete && groupsComplete && availabilityComplete && rhythmComplete
  };
}

// ---------------------------------------------------------------------------
// Derived loop audience + feasibility.
//
// A loop does not HAVE an audience — its members do. Both functions below are
// PURE, READ-ONLY derivations over the member strands' own audiences, and both
// are ADVISORY: nothing here blocks a decision, requires the parent to resolve
// rhythm placement during Feast Planning, or writes anything back.
// ---------------------------------------------------------------------------

// The two legacy shorthand audiences name a group by convention. The id is
// derived from the mode itself so no group id is ever hardcoded here.
function legacyGroupIdForMode(mode) {
  if (mode === 'older-students') return String(mode).split('-')[0];
  if (mode === M.STRAND_ASSIGNMENT_MODES[2]) return mode;
  return null;
}

function loopMemberAssignments(state, loopId) {
  return sArr(sObj(state).strandAssignments).filter(function (sa) {
    return sa && M.resolveStrandLoopId(sa) === loopId;
  });
}

// A stable key + parent-facing label for one strand's audience. Never a
// hardcoded family name — group and student labels are always looked up.
function audienceDescriptor(state, assignment) {
  var mode = M.resolveStrandAudience(assignment);
  if (mode == null) return null;
  if (mode === 'everyone') return { key: 'everyone', kind: 'everyone', label: 'Everyone' };
  if (mode === 'custom-group') {
    return { key: 'group:' + assignment.groupId, kind: 'group', groupId: assignment.groupId,
      label: feastGroupLabel(state, assignment.groupId, 'Group') };
  }
  if (legacyGroupIdForMode(mode)) {
    var gid = legacyGroupIdForMode(mode);
    return { key: 'group:' + gid, kind: 'group', groupId: gid,
      label: feastGroupLabel(state, gid, null) || 'Group' };
  }
  if (mode === 'individual') {
    var ids = sArr(assignment.studentIds);
    return { key: 'students:' + ids.slice().sort().join(','), kind: 'individual', studentIds: ids.slice(),
      label: joinNames(feastStudentNames(state, ids)) || 'One child' };
  }
  if (mode === 'coop-outside') return { key: 'coop-outside', kind: 'coop', label: 'Co-op / outside' };
  if (mode === 'not-this-year') return { key: 'not-this-year', kind: 'off', label: 'Not this year' };
  return { key: mode, kind: 'other', label: mode };
}

export function getLoopAudienceSummary(state, loopId) {
  var members = loopMemberAssignments(state, loopId);
  var audiences = [];
  var seen = {};
  var unresolvedCount = 0;

  members.forEach(function (sa) {
    var d = audienceDescriptor(state, sa);
    if (!d) { unresolvedCount++; return; }
    if (!seen[d.key]) { seen[d.key] = true; audiences.push(d); }
  });

  var label;
  if (!audiences.length) {
    // Unresolved members on their own never read as "Mixed" — nothing has been
    // chosen yet, and the copy says exactly that.
    label = members.length ? 'Audience not chosen yet' : 'Nothing in this loop yet';
  } else if (audiences.length === 1) {
    label = audiences[0].label;
  } else {
    label = 'Mixed audience';
  }

  return {
    loopId: loopId,
    audiences: audiences,
    label: label,
    memberStrandCount: members.length,
    unresolvedCount: unresolvedCount
  };
}

// Days one strand's audience + work type can actually happen on. Built on the
// existing eligibility helpers — eligibility is never reimplemented here.
function audienceEligibleDayIds(state, assignment, workTypeId) {
  var days = setupWeekdayIds();
  var mode = M.resolveStrandAudience(assignment);
  var opts = { mayOccurOnLightDays: sObj(assignment).mayOccurOnLightDays === true };
  if (mode == null || !workTypeId) return [];

  var groupId = mode === 'custom-group' ? (assignment.groupId || null) : legacyGroupIdForMode(mode);
  if (groupId) {
    return sArr(getGroupWorkAvailability(state, groupId, workTypeId, opts).eligibleDayIds);
  }

  var memberIds;
  if (mode === 'individual') {
    var actives = getEveryoneStudentIds(state);
    memberIds = sArr(assignment.studentIds).filter(function (id) { return actives.indexOf(id) > -1; });
  } else {
    // everyone / coop-outside / anything else that means the whole family.
    memberIds = getEveryoneStudentIds(state);
  }
  if (!memberIds.length) return [];

  var shared = M.isSharedWorkType(workTypeId);
  var perStudent = memberIds.map(function (id) {
    return sArr(getStudentAvailableDaysForWorkType(state, id, workTypeId, opts).eligibleDayIds);
  });
  return days.filter(function (d) {
    return shared
      ? perStudent.every(function (list) { return list.indexOf(d) > -1; })
      : perStudent.some(function (list) { return list.indexOf(d) > -1; });
  });
}

// ADVISORY ONLY. Never mutates state, never blocks, and never asks the parent to
// settle rhythm placement here — that belongs to Weekly Rhythm.
export function getLoopFeasibility(state, loopId) {
  var days = setupWeekdayIds();
  var members = loopMemberAssignments(state, loopId);
  var summary = getLoopAudienceSummary(state, loopId);

  var perStrand = {};
  var conflicts = [];

  members.forEach(function (sa) {
    var label = sa.strandLabel || sa.strandId || sa.id;
    var descriptor = audienceDescriptor(state, sa);
    var workTypeId = M.resolveWorkTypeForAssignment(sa);
    var eligible = [];
    try { eligible = audienceEligibleDayIds(state, sa, workTypeId); } catch (e) { eligible = []; }

    perStrand[sa.strandId || sa.id] = {
      eligibleDayIds: eligible,
      audienceLabel: descriptor ? descriptor.label : null,
      workTypeId: workTypeId || null
    };

    if (!descriptor) {
      conflicts.push({ strandId: sa.strandId || sa.id, label: label, reason: 'No audience chosen yet.' });
    } else if (!eligible.length) {
      conflicts.push({
        strandId: sa.strandId || sa.id, label: label,
        reason: 'No weekday currently fits ' + descriptor.label + ' for this kind of work.'
      });
    }
  });

  var lists = Object.keys(perStrand).map(function (k) { return perStrand[k].eligibleDayIds; });
  var fullGroupDayIds = lists.length
    ? days.filter(function (d) { return lists.every(function (l) { return l.indexOf(d) > -1; }); })
    : [];
  var partialDayIds = lists.length
    ? days.filter(function (d) {
        var some = lists.some(function (l) { return l.indexOf(d) > -1; });
        var all = lists.every(function (l) { return l.indexOf(d) > -1; });
        return some && !all;
      })
    : [];

  return {
    loopId: loopId,
    audienceSummary: summary,
    fullGroupDayIds: fullGroupDayIds,
    partialDayIds: partialDayIds,
    perStrand: perStrand,
    conflicts: conflicts,
    unresolvedCount: summary.unresolvedCount,
    advisory: true,
    note: 'Advisory only — which days a loop actually runs on is decided in the Weekly Rhythm.'
  };
}

// ---------------------------------------------------------------------------
// Feast views + stacks (presentation only).
//
// Stacks never merge records. A bulk action applies to each strand INDIVIDUALLY
// by its stable id, so any one strand may override afterwards, and a later
// individual edit survives an unrelated bulk action on a different field.
// ---------------------------------------------------------------------------
export var FEAST_VIEWS = [
  { id: 'stacks', label: 'Suggested Stacks' },
  { id: 'subject', label: 'By Subject' },
  { id: 'form', label: 'By Form' },
  { id: 'unsorted', label: 'Unsorted Only' },
  { id: 'all', label: 'All' }
];

export function feastViewLabel(viewId) {
  var v = FEAST_VIEWS.find(function (x) { return x.id === viewId; });
  return v ? v.label : 'Suggested Stacks';
}

export function isUnsortedFeastRow(row) {
  var r = sObj(row);
  return r.activeThisYear === true && r.placementState === 'unassigned';
}

// [{ id, label, rows }] for one view. Every view except "Unsorted Only" contains
// every strand exactly once.
export function buildFeastView(state, viewId, rows) {
  var all = Array.isArray(rows) ? rows : sArr(buildFeastRows(sObj(state)));
  var view = FEAST_VIEWS.some(function (v) { return v.id === viewId; }) ? viewId : 'stacks';
  var groups = [];

  function group(id, label) {
    var g = groups.find(function (x) { return x.id === id; });
    if (!g) { g = { id: id, label: label, rows: [] }; groups.push(g); }
    return g;
  }

  if (view === 'stacks') {
    M.buildFeastStacks().forEach(function (stack) {
      var g = group(stack.id, stack.label);
      stack.strandIds.forEach(function (sid) {
        var row = all.find(function (r) { return r.strandId === sid; });
        if (row) g.rows.push(row);
      });
    });
    groups = groups.filter(function (g) { return g.rows.length > 0; });
  } else if (view === 'subject') {
    sArr(M.DEFAULT_VISIBLE_SUBJECT_COLUMNS).forEach(function (col) {
      var matching = all.filter(function (r) { return r.column === col.id; });
      if (matching.length) group(col.id, col.label).rows = matching;
    });
    // Anything with an unrecognised column still gets a home.
    var claimed = groups.reduce(function (n, g) { return n + g.rows.length; }, 0);
    if (claimed < all.length) {
      var placed = {};
      groups.forEach(function (g) { g.rows.forEach(function (r) { placed[r.strandId] = true; }); });
      group('other', 'Other').rows = all.filter(function (r) { return !placed[r.strandId]; });
    }
  } else if (view === 'form') {
    sArr(M.FEAST_FORMS).forEach(function (form) {
      var matching = all.filter(function (r) { return r.form === form.id; });
      if (matching.length) group(form.id, form.label).rows = matching;
    });
    var placedF = {};
    groups.forEach(function (g) { g.rows.forEach(function (r) { placedF[r.strandId] = true; }); });
    var leftover = all.filter(function (r) { return !placedF[r.strandId]; });
    if (leftover.length) group('other', 'Other').rows = leftover;
  } else if (view === 'unsorted') {
    var pending = all.filter(isUnsortedFeastRow);
    if (pending.length) group('unsorted', 'Still to sort').rows = pending;
  } else {
    group('all', 'Every strand').rows = all.slice();
  }

  return {
    viewId: view,
    label: feastViewLabel(view),
    groups: groups,
    rowCount: groups.reduce(function (n, g) { return n + g.rows.length; }, 0)
  };
}

// The stack a strand belongs to, and every strand id in it. Presentation only.
export function getFeastStackForStrand(strandId) {
  var entry = sArr(M.FEAST_LIBRARY).find(function (e) { return e.id === strandId; });
  if (!entry) return null;
  var id = M.stackForStrand(entry);
  return M.buildFeastStacks().find(function (s) { return s.id === id; }) || null;
}

// Unsorted strands that share a stack with something already in this loop.
// Suggestion only — nothing is moved.
export function getRelatedUnsortedStrandsForLoop(state, loopId, rows) {
  var all = Array.isArray(rows) ? rows : sArr(buildFeastRows(sObj(state)));
  var inLoop = all.filter(function (r) { return r.loopId === loopId; });
  var stackIds = {};
  inLoop.forEach(function (r) { if (r.stackId) stackIds[r.stackId] = true; });
  return all.filter(function (r) {
    return isUnsortedFeastRow(r) && r.stackId && stackIds[r.stackId] === true;
  });
}

export var FEAST_STACK_BULK_ACTIONS = ['use-this-year', 'audience', 'loop', 'unsorted'];

// Apply one bulk action to every strand in a stack, INDIVIDUALLY by stable id.
// No merged record is ever created, and each strand keeps its own assignment.
//
//   kind 'use-this-year' — clears "not this year" on each strand
//   kind 'audience'      — value is an audience mode ('everyone' | 'custom-group'
//                          | 'individual' | 'coop-outside' | 'not-this-year'),
//                          extras carries groupId / studentIds
//   kind 'loop'          — value is a loopId, or null to take them all out
//   kind 'unsorted'      — clears audience AND loop, back to Unsorted
export function applyStackBulkAction(state, stackId, kind, value, extras) {
  var s = sObj(state);
  if (!Array.isArray(s.strandAssignments)) s.strandAssignments = [];
  var stack = M.buildFeastStacks().find(function (x) { return x.id === stackId; });
  if (!stack) return [];
  var ex = sObj(extras);

  return stack.strandIds.map(function (strandId) {
    var entry = sArr(M.FEAST_LIBRARY).find(function (e) { return e.id === strandId; });
    var label = entry ? entry.label : strandId;
    if (kind === 'loop') {
      return moveStrandLoopAssignment(s, strandId, label, value || null);
    }
    if (kind === 'unsorted') {
      moveStrandLoopAssignment(s, strandId, label, null);
      return setStrandAssignmentForStrand(s, strandId, label, { assignmentMode: null });
    }
    if (kind === 'use-this-year') {
      var existing = (s.strandAssignments || []).find(function (sa) { return sa && sa.strandId === strandId; });
      if (!existing) return null;
      return setStrandUseThisYear(s, strandId, label, true);
    }
    if (kind === 'audience') {
      var fields = { assignmentMode: value == null ? null : value };
      if (ex.groupId) fields.groupId = ex.groupId;
      if (Array.isArray(ex.studentIds)) fields.studentIds = ex.studentIds.slice();
      return setStrandAssignmentForStrand(s, strandId, label, fields);
    }
    return null;
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Unresolved decisions — ONE source of truth.
//
// Pure and read-only. Exposes what the feast rows already know, so a printed
// summary and the on-screen counts can never disagree: both call this.
// No technical id ever appears in a user-facing string here.
// ---------------------------------------------------------------------------

// Only ACTIVE strands are ever unresolved — a strand set aside for this year is
// a decision that has been made, not one that is missing.
function activeFeastRows(state, rows) {
  var all = Array.isArray(rows) ? rows : [];
  if (!all.length) {
    try { all = sArr(buildFeastRows(sObj(state))); } catch (e) { all = []; }
  }
  return all.filter(function (r) { return sObj(r).activeThisYear !== false; });
}

export function getUnresolvedReport(state, rows) {
  var s = sObj(state);
  var active = activeFeastRows(s, rows);
  var loops = sArr(s.loops);

  function place(r) {
    return { strandId: r.strandId, label: r.label, formLabel: r.formLabel || '', columnLabel: r.columnLabel || '' };
  }

  // 1. Who is this for? — no audience recorded at all.
  var missingAudience = active.filter(function (r) { return !r.hasAudience; }).map(place);

  // 2. How is it handled? — "still to sort": nothing yet says whether this
  //    strand rides in a loop, is covered outside the home, or becomes its own
  //    regular teaching card. This is exactly the Feast "Unsorted / Still to
  //    Sort" set, and both read it from here.
  var missingHandling = active.filter(function (r) {
    return !r.loopId && r.audienceMode !== 'coop-outside' && !r.hasAudience;
  }).map(place);

  // 3. Sitting in a loop that has been set aside for this year.
  var inSetAsideLoops = active.filter(function (r) {
    if (!r.loopId) return false;
    var loop = loops.find(function (l) { return l && l.id === r.loopId; });
    return !!loop && loop.active === false;
  }).map(function (r) {
    var loop = loops.find(function (l) { return l && l.id === r.loopId; });
    return { strandId: r.strandId, label: r.label, loopTitle: (loop && loop.title) || 'Untitled loop' };
  });

  return {
    missingAudience: missingAudience,
    missingHandling: missingHandling,
    inSetAsideLoops: inSetAsideLoops,
    missingAudienceCount: missingAudience.length,
    missingHandlingCount: missingHandling.length,
    inSetAsideLoopsCount: inSetAsideLoops.length
  };
}

// ---------------------------------------------------------------------------
// Print views — presentation data only. Pure, read-only, and derived fresh.
// Nothing here writes state, and no PDF/canvas machinery is involved: the print
// page is plain HTML with print CSS.
// ---------------------------------------------------------------------------

export var PRINT_VIEWS = [
  { id: 'map', label: 'Family School Map' },
  { id: 'loops', label: 'Loop Summary' },
  { id: 'unresolved', label: 'Unresolved Decisions' },
  { id: 'nextup', label: 'Next-Up worksheets' }
];

export function printViewLabel(viewId) {
  var v = PRINT_VIEWS.find(function (x) { return x.id === viewId; });
  return v ? v.label : PRINT_VIEWS[0].label;
}

export function normalizePrintView(viewId) {
  return PRINT_VIEWS.some(function (v) { return v.id === viewId; }) ? viewId : 'map';
}

// The work type to PRINT: an explicitly chosen one only. A suggestion is not a
// decision, and printing it would look like one.
function explicitWorkTypeLabel(assignment) {
  var a = sObj(assignment);
  if (!a.workType) return '';
  return M.workTypeLabel(a.workType) || '';
}

function printLoopTitleFor(state, loopId) {
  var loop = sArr(sObj(state).loops).find(function (l) { return l && l.id === loopId; });
  return loop ? (loop.title || 'Untitled loop') : 'A loop that no longer exists';
}

// A. Family School Map — every ACTIVE strand exactly once, grouped by audience:
// Everyone first, then each group, then each individual student, then anything
// still undecided. Group and student names are always looked up, never assumed.
export function buildPrintFamilyMap(state, rows) {
  var s = sObj(state);
  var active = activeFeastRows(s, rows);
  var sections = [];

  function section(key, label) {
    var found = sections.find(function (x) { return x.key === key; });
    if (!found) { found = { key: key, label: label, rows: [] }; sections.push(found); }
    return found;
  }

  var everyone = { key: 'everyone', label: 'Everyone', rows: [] };
  var groupSections = [];
  var studentSections = [];
  var coop = { key: 'coop', label: 'Co-op / outside', rows: [] };
  var undecided = { key: 'undecided', label: 'Audience not chosen yet', rows: [] };

  active.forEach(function (r) {
    var entry = {
      strandId: r.strandId,
      label: r.label,
      formLabel: r.formLabel || '',
      columnLabel: r.columnLabel || '',
      audienceLabel: r.whoLabel || 'Not chosen yet',
      placementLabel: r.loopId ? printLoopTitleFor(s, r.loopId) : 'Regular',
      workTypeLabel: explicitWorkTypeLabel(r.assignment)
    };
    var mode = r.audienceMode;
    if (mode === 'everyone') { everyone.rows.push(entry); return; }
    if (mode === 'coop-outside') { coop.rows.push(entry); return; }
    var legacyGid = legacyGroupIdForMode(mode);
    if (mode === 'custom-group' || legacyGid) {
      var gid = mode === 'custom-group' ? sObj(r.assignment).groupId : legacyGid;
      var gkey = 'group:' + gid;
      var gsec = groupSections.find(function (x) { return x.key === gkey; });
      if (!gsec) { gsec = { key: gkey, label: r.whoLabel || 'Group', rows: [] }; groupSections.push(gsec); }
      gsec.rows.push(entry);
      return;
    }
    if (mode === 'individual') {
      var ids = sArr(sObj(r.assignment).studentIds);
      if (!ids.length) { undecided.rows.push(entry); return; }
      ids.forEach(function (sid) {
        var skey = 'student:' + sid;
        var ssec = studentSections.find(function (x) { return x.key === skey; });
        if (!ssec) {
          ssec = { key: skey, label: feastStudentNames(s, [sid])[0] || 'One child', rows: [] };
          studentSections.push(ssec);
        }
        // Shared work stays one row per section; a strand is still counted once.
        if (!ssec.rows.some(function (e) { return e.strandId === entry.strandId; })) ssec.rows.push(entry);
      });
      return;
    }
    undecided.rows.push(entry);
  });

  [everyone].concat(groupSections, studentSections, [coop, undecided]).forEach(function (sec) {
    if (sec.rows.length) section(sec.key, sec.label).rows = sec.rows;
  });

  return {
    viewId: 'map',
    label: printViewLabel('map'),
    sections: sections,
    strandCount: active.length
  };
}

// B. Loop Summary — active loops, then set-aside loops in their own marked
// section. Each strand carries its OWN audience; a loop is not an audience.
export function buildPrintLoopSummary(state, rows) {
  var s = sObj(state);
  var all = Array.isArray(rows) && rows.length ? rows : (function () {
    try { return sArr(buildFeastRows(s)); } catch (e) { return []; }
  })();

  function loopEntry(l) {
    var members = all.filter(function (r) { return r.loopId === l.id && r.activeThisYear !== false; });
    var strands = members.map(function (r) {
      return {
        strandId: r.strandId,
        label: r.label,
        formLabel: r.formLabel || '',
        audienceLabel: r.hasAudience ? (r.whoLabel || '') : '',
        needsAudience: !r.hasAudience
      };
    });
    var missing = strands.filter(function (x) { return x.needsAudience; });
    return {
      loopId: l.id,
      title: l.title || 'Untitled loop',
      description: l.description || '',
      setAside: l.active === false,
      strands: strands,
      warnings: missing.map(function (x) { return x.label + ' has no audience chosen yet.'; })
    };
  }

  var loops = sArr(s.loops).filter(Boolean);
  return {
    viewId: 'loops',
    label: printViewLabel('loops'),
    loops: loops.filter(function (l) { return l.active !== false; }).map(loopEntry),
    setAsideLoops: loops.filter(function (l) { return l.active === false; }).map(loopEntry)
  };
}

// D. Next-Up worksheets — one per ACTIVE strand, exactly once. A TEMPORARY
// planning sheet: it deliberately models nothing, and stores nothing.
export var PRINT_WORKSHEET_LINE_COUNT = 20;

export function buildPrintNextUpWorksheets(state, rows) {
  var s = sObj(state);
  return {
    viewId: 'nextup',
    label: printViewLabel('nextup'),
    lineCount: PRINT_WORKSHEET_LINE_COUNT,
    worksheets: activeFeastRows(s, rows).map(function (r) {
      return {
        strandId: r.strandId,
        label: r.label,
        formLabel: r.formLabel || '',
        columnLabel: r.columnLabel || '',
        audienceLabel: r.hasAudience ? (r.whoLabel || '') : 'Audience not chosen yet',
        loopTitle: r.loopId ? printLoopTitleFor(s, r.loopId) : ''
      };
    })
  };
}
