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

// Returns all strand assignments in the state that are assigned to a given loop.
export function getStrandsCoveredByLoop(state, loopId) {
  var assignments = state.strandAssignments || [];
  return assignments.filter(function(sa) { return sa.assignmentMode === 'loop' && sa.loopId === loopId; });
}

// Returns the set of strand IDs currently covered by any loop assignment.
export function getLoopCoveredStrandIds(state) {
  var assignments = state.strandAssignments || [];
  var ids = [];
  assignments.forEach(function(sa) { if (sa.assignmentMode === 'loop' && sa.strandId) ids.push(sa.strandId); });
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
    var mode = assignment && assignment.assignmentMode ? assignment.assignmentMode : null;
    var warnings = [];

    var loopId = mode === 'loop' ? (assignment.loopId || null) : null;
    var loop = loopId ? loops.find(function (l) { return l.id === loopId; }) : null;
    var loopTitle = loop ? loop.title : null;
    if (mode === 'loop' && !loop) warnings.push('Assigned to a loop that no longer exists');
    if (mode === 'individual' && !(assignment.studentIds || []).length) {
      warnings.push('Assigned to individual work but no students selected');
    }
    if (mode === 'custom-group' && !feastGroupLabel(state, assignment.groupId, null)) {
      warnings.push('Assigned to a group that no longer exists');
    }

    // Who — parent-facing audience text.
    var whoLabel = '';
    if (mode === 'everyone') whoLabel = 'Everyone';
    else if (mode === 'custom-group') whoLabel = feastGroupLabel(state, assignment.groupId, 'Group');
    else if (mode === 'older-students') whoLabel = feastGroupLabel(state, 'older', 'Older Students');
    else if (mode === 'littles') whoLabel = feastGroupLabel(state, 'littles', 'Littles');
    else if (mode === 'individual') whoLabel = feastStudentNames(state, assignment.studentIds).join(', ');
    else if (mode === 'loop') whoLabel = 'In: ' + (loopTitle || 'a loop');
    else if (mode === 'coop-outside') whoLabel = 'Co-op / outside';

    // Placement — DERIVED, never stored. Precedence matters.
    var placementState, placementLabel;
    if (mode === 'not-this-year') {
      placementState = 'not-this-year';
      placementLabel = 'Not this year';
    } else if (mode === 'coop-outside') {
      placementState = 'coop-outside';
      placementLabel = 'Co-op / outside';
    } else if (mode === 'loop' && loopId && safeLoopHasRhythmPlacement(state, loopId)) {
      placementState = 'covered-by-loop';
      placementLabel = 'Covered by ' + (loopTitle || 'a loop');
    } else if (mode === 'loop') {
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
      activeThisYear: mode !== 'not-this-year',
      assignment: assignment,
      assignmentMode: assignment ? (assignment.assignmentMode || null) : null,
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
    if (sa.assignmentMode === 'loop') {
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
    } else if (sa.assignmentMode === 'not-this-year') {
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

  if (fields.assignmentMode === null) {
    // Clearing back to "not decided yet".
    if (!existing) return null;
    if (existing.createdBy === FEAST_PROTOTYPE_CREATED_BY) {
      state.strandAssignments = state.strandAssignments.filter(function (sa) { return sa !== existing; });
      return null;
    }
    existing.assignmentMode = null;
    return existing;
  }

  // Changing WHO the strand is for clears the other audience fields, so a stale
  // groupId can never linger behind a new choice. Edits that say nothing about
  // audience (e.g. workType) must leave the audience exactly as it is.
  var changesAudience = Object.prototype.hasOwnProperty.call(fields, 'assignmentMode');
  var base = changesAudience ? { loopId: null, groupId: null, studentIds: [], coopProvider: '' } : {};
  if (existing) {
    Object.assign(existing, base, fields, { strandLabel: strandLabel || existing.strandLabel });
    return existing;
  }
  // Nothing to attach a non-audience edit to yet — never invent an audience.
  if (!changesAudience) return null;
  var created = M.makeStrandAssignment(Object.assign({
    strandId: strandId,
    strandLabel: strandLabel || strandId,
    createdBy: FEAST_PROTOTYPE_CREATED_BY
  }, base, fields));
  state.strandAssignments.push(created);
  return created;
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
    assignmentMode: 'loop',
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

// A student's week, capacity-aware.
//
// Capacity is resolved (explicit dayCapacity -> legacy workdays -> 'full').
// Commitments NEVER change capacity here — they only produce a suggestion the
// Setup UI can offer, and only for days the parent has not set by hand.
//
// The pre-capacity keys (workdays, blockedBy, availableDayIds, coopOnlyDayIds)
// are all still present so existing callers keep working.
export function getStudentAvailability(state, studentId) {
  var days = setupWeekdayIds();
  var student = setupStudents(state).find(function (s) { return s && s.id === studentId; }) || {};
  var workdays = studentWorkdays(student);
  var explicit = sObj(student.dayCapacityExplicit);

  var dayCapacity = {};
  var capacityLabels = {};
  days.forEach(function (d) {
    dayCapacity[d] = M.resolveDayCapacity(student, d);
    capacityLabels[d] = M.dayCapacityLabel(dayCapacity[d]);
  });

  var blockedBy = {};
  days.forEach(function (d) { blockedBy[d] = []; });

  var suggestedCapacity = {};
  setupCommitments(state).forEach(function (c) {
    if (getCommitmentParticipantIds(state, c).indexOf(studentId) === -1) return;
    var suggested = SUGGESTABLE_CAPACITIES.indexOf(c.suggestedCapacity) > -1 ? c.suggestedCapacity : 'outside-only';
    sArr(c.weekdays).forEach(function (d) {
      if (days.indexOf(d) === -1) return;
      if (c.blocksRegularWork !== false) blockedBy[d].push(c.label || 'Outside commitment');
      if (explicit[d] === true) return;                 // hand-set days are never second-guessed
      if (suggested === dayCapacity[d]) return;         // nothing to offer
      var current = suggestedCapacity[d];
      if (current && CAPACITY_WEIGHT[current.capacity] >= CAPACITY_WEIGHT[suggested]) return;
      suggestedCapacity[d] = { capacity: suggested, fromCommitment: c.label || 'Outside commitment' };
    });
  });

  function daysWith(cap) { return days.filter(function (d) { return dayCapacity[d] === cap; }); }

  return {
    studentId: studentId,
    workdays: workdays,
    blockedBy: blockedBy,
    dayCapacity: dayCapacity,
    capacityLabels: capacityLabels,
    suggestedCapacity: suggestedCapacity,
    availableDayIds: daysWith('full'),
    coopOnlyDayIds: daysWith('outside-only'),
    lightDayIds: daysWith('light-independent'),
    offDayIds: daysWith('off')
  };
}

// Which days one student can do one kind of work.
export function getStudentWorkEligibility(state, studentId, workTypeId, opts) {
  var days = setupWeekdayIds();
  var av = getStudentAvailability(state, studentId);
  var byDay = {};
  var eligibleDayIds = [];
  days.forEach(function (d) {
    var cap = av.dayCapacity[d];
    var verdict = M.workTypeAllowedOnCapacity(workTypeId, cap, opts);
    byDay[d] = { allowed: verdict.allowed === true, capacity: cap, reason: verdict.reason };
    if (verdict.allowed === true) eligibleDayIds.push(d);
  });
  return { studentId: studentId, workTypeId: workTypeId, eligibleDayIds: eligibleDayIds, byDay: byDay };
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
    var el = getStudentWorkEligibility(state, id, workTypeId, opts);
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
export function buildSetupSummary(state) {
  var family = activeStudents(state).map(function (s) {
    return {
      id: s.id,
      name: s.name || '',
      grade: s.grade || '',
      gradeBandLabel: gradeBandLabel(s.gradeBand),
      gradeBandConfirmed: s.gradeBandConfirmed === true,
      color: s.color || '#888888',
      active: s.active !== false,
      availableDayIds: getStudentAvailability(state, s.id).availableDayIds
    };
  });

  var groups = setupGroups(state).filter(function (g) { return g && g.active !== false; }).map(function (g) {
    var av = getGroupAvailability(state, g.id);
    return {
      id: g.id,
      label: g.label || '',
      memberIds: av.memberIds,
      memberNames: av.memberIds.map(function (id) { return studentName(state, id); }),
      availableDayIds: av.availableDayIds,
      partialDayIds: av.partialDayIds
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
// Loop buckets vs loop contents — THREE states, never collapsed into one.
//
//  1. bucketsDefined   — at least one loop bucket exists (Setup step 4).
//  2. bucketsReviewed  — the parent explicitly said the buckets look right.
//  3. sortingComplete  — every active strand has a handling decision AND the
//                        parent explicitly said the loop contents look right.
//
// Existence never implies review, and a reviewed bucket list never implies its
// contents are settled. Both acknowledgements are explicit booleans under
// state.setupPrototype; everything else here is derived on every call.
// ---------------------------------------------------------------------------
export function getLoopSortingProgress(state) {
  var ack = sObj(sObj(state).setupPrototype);
  var loops = sArr(sObj(state).loops).filter(Boolean);

  var rows = [];
  try { rows = sArr(buildFeastRows(sObj(state))); } catch (e) { rows = []; }

  // Unsorted = still active this year, but with no handling decision at all.
  var unsorted = rows.filter(function (r) {
    return r.activeThisYear === true && r.placementState === 'unassigned';
  });
  var unsortedStrandIds = unsorted.map(function (r) { return r.strandId; });

  var bucketsDefined = loops.length > 0;
  var bucketsReviewed = ack.loopBucketsReviewed === true;
  var contentsReviewed = ack.loopContentsReviewed === true;

  return {
    bucketsDefined: bucketsDefined,
    bucketCount: loops.length,
    bucketsReviewed: bucketsReviewed,
    unsortedStrandIds: unsortedStrandIds,
    unsortedStrandCount: unsortedStrandIds.length,
    contentsReviewed: contentsReviewed,
    setupStepComplete: bucketsDefined && bucketsReviewed,
    sortingComplete: unsortedStrandIds.length === 0 && contentsReviewed
  };
}

// Every strand currently sorted into one loop bucket, in feast order.
export function getLoopBucketContents(state, loopId) {
  var rows = [];
  try { rows = sArr(buildFeastRows(sObj(state))); } catch (e) { rows = []; }
  return rows.filter(function (r) { return r.assignmentMode === 'loop' && r.loopId === loopId; });
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

  var withDays = actives.filter(function (s) { return getStudentAvailability(state, s.id).availableDayIds.length > 0; });
  var availabilityComplete = actives.length >= 1 && withDays.length === actives.length;
  var availabilityDetail = !actives.length
    ? 'No children added yet.'
    : (availabilityComplete
      ? 'Every child has at least one day for regular lessons.'
      : (actives.length - withDays.length) + ' child(ren) have no available day left.');

  // Setup step 4 defines loop BUCKETS only. Sorting strands into them happens
  // later, in Feast Planning — so existence of loops never completes the step,
  // and unsorted strands never block it.
  var sorting = getLoopSortingProgress(state);
  var rhythmComplete = sorting.setupStepComplete;
  var rhythmDetail;
  if (!sorting.bucketsDefined) {
    rhythmDetail = 'No loop buckets yet. Create the buckets you may use — you sort strands into them during Feast Planning.';
  } else if (!sorting.bucketsReviewed) {
    rhythmDetail = sorting.bucketCount + ' loop bucket' + (sorting.bucketCount === 1 ? '' : 's') +
      ' defined, not confirmed yet — say "These buckets look right".';
  } else if (sorting.unsortedStrandCount > 0) {
    rhythmDetail = sorting.bucketCount + ' loop bucket' + (sorting.bucketCount === 1 ? '' : 's') +
      ' confirmed. ' + sorting.unsortedStrandCount + ' strand' + (sorting.unsortedStrandCount === 1 ? '' : 's') +
      ' still to sort — that happens in Feast Planning, not here.';
  } else {
    rhythmDetail = sorting.bucketCount + ' loop bucket' + (sorting.bucketCount === 1 ? '' : 's') +
      ' confirmed. Strands are sorted during Feast Planning.';
  }

  return {
    family: { complete: familyComplete, detail: familyDetail },
    groups: { complete: groupsComplete, detail: groupsDetail },
    availability: { complete: availabilityComplete, detail: availabilityDetail },
    rhythm: { complete: rhythmComplete, detail: rhythmDetail },
    readyForFeast: familyComplete && groupsComplete && availabilityComplete && rhythmComplete
  };
}
