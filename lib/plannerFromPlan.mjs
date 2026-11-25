// Planner Spread — building one student's dated week from the saved plan.
//
// This module is the bridge between the two layers the rest of the app keeps
// deliberately apart:
//
//   * the Weekly Rhythm, which is a REPEATING GENERIC WEEK (Day 1, Day 2 …)
//     holding references to cards, loop buckets and sequences; and
//   * the planner spread (lib/plannerSpread.mjs), where work sits on real
//     dates and can be dragged from one day to another.
//
// It is a ONE-WAY, READ-ONLY read of the plan. Nothing here writes anything,
// and the planner state it returns is a SCRATCH COPY: the spread is a place to
// try a week out, never a second source of truth. Moving work on the spread
// must never travel back into the plan.
//
// What it deliberately does NOT do:
//   * no pacing math — nothing counts lessons, weeks, chapters, or how far
//     through a book a term will get, and nothing lays out a whole term;
//   * no loop rotation — a loop bucket becomes one line reading "next item",
//     because the plan holds no per-week rotation cursor and this module adds
//     no new stored field anywhere;
//   * no names, subjects or commitments are hardcoded — every label on every
//     line comes out of the parent's own plan.
//
// Pure: no DOM, no localStorage, no clock. Every date computation goes through
// the UTC helpers in plannerSpread.mjs, so a week can never slip a day because
// the machine sits in a timezone with a DST change that week. Tolerates `{}`,
// a missing weeklyRhythm, and missing collections.

import { WEEKDAYS, resolveDayCapacity, workTypeAllowedOnCapacity } from './familyMap.mjs';
import { PLANNER_SCHEMA_VERSION, mondayOf, addDays, isValidDate, weekdayIndex } from './plannerSpread.mjs';

// ---------------------------------------------------------------------------
// Small tolerant readers
// ---------------------------------------------------------------------------
function obj(v) { return v && typeof v === 'object' ? v : {}; }
function arr(v) { return Array.isArray(v) ? v : []; }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }

// Attach a value that can be read on screen but can never reach saved JSON.
// Same shape as the non-enumerable markers familyMapAdapter.mjs already uses
// (see loopDeleteBlocked) — this codebase's rule is that derived data is never
// persisted, and a non-enumerable property is invisible to JSON.stringify.
function mark(target, key, value) {
  Object.defineProperty(target, key, {
    value: value, enumerable: false, writable: true, configurable: true
  });
  return target;
}

// ---------------------------------------------------------------------------
// Which weekday is a rhythm day?
//
// A RhythmDay carries no date and no weekday by design — "Day 1" is a shape,
// not a Tuesday. To stamp it onto a real week we read the day record's OWN
// fields, never its label text (a parent may call a day anything at all):
//
//   1. an explicit weekday id recorded on the day (weekdayId / weekday), when
//      the plan happens to hold one;
//   2. a real date recorded on the day, whose weekday we take directly;
//   3. otherwise its POSITION in the rhythm: the days sorted by sortOrder, so
//      the first day is Monday, the second Tuesday, and so on.
//
// Anything that still cannot be resolved is skipped and reported, never
// guessed at.
// ---------------------------------------------------------------------------
const WEEKDAY_IDS = WEEKDAYS.map(function (d) { return d.id; });
const WEEKDAY_LABEL_BY_ID = WEEKDAYS.reduce(function (acc, d) { acc[d.id] = d.label; return acc; }, {});
const WEEKDAY_ID_BY_INDEX = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

function weekdayIdForDayRecord(day, position) {
  const d = obj(day);
  const explicit = str(d.weekdayId) || str(d.weekday);
  if (WEEKDAY_IDS.indexOf(explicit) > -1) return explicit;
  if (isValidDate(d.date)) {
    const mapped = WEEKDAY_ID_BY_INDEX[weekdayIndex(d.date)];
    if (mapped) return mapped;
  }
  if (Number.isFinite(position) && position >= 0 && position < WEEKDAY_IDS.length) {
    return WEEKDAY_IDS[position];
  }
  return null;
}

// dayId -> { weekdayId, offset } for every day the rhythm actually holds.
function buildDayMap(rhythm) {
  const days = arr(obj(rhythm).days)
    .filter(function (d) { return str(obj(d).id); })
    .slice()
    .sort(function (a, b) {
      const sa = Number.isFinite(obj(a).sortOrder) ? a.sortOrder : 0;
      const sb = Number.isFinite(obj(b).sortOrder) ? b.sortOrder : 0;
      return sa - sb;
    });
  const map = {};
  days.forEach(function (day, position) {
    const weekdayId = weekdayIdForDayRecord(day, position);
    map[day.id] = {
      weekdayId: weekdayId,
      offset: weekdayId ? WEEKDAY_IDS.indexOf(weekdayId) : null,
      label: str(day.label)
    };
  });
  return map;
}

// ---------------------------------------------------------------------------
// School days, from the student's own capacity model
//
// Never from a name, never from a hardcoded list: a day a student has marked
// off is simply not a school day for them, and everything else is.
// ---------------------------------------------------------------------------
export function schoolDaysForStudent(student) {
  const out = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false };
  Object.keys(out).forEach(function (dayId) {
    if (WEEKDAY_IDS.indexOf(dayId) === -1) return;   // the plan deals in Mon–Fri
    out[dayId] = resolveDayCapacity(student, dayId) !== 'off';
  });
  return out;   // Saturday stays false; Sunday is never a school day at all
}

// ---------------------------------------------------------------------------
// What kind of work is this, so a day's capacity can be respected?
//
// An explicit workType on the referenced card/loop/sequence always wins. With
// none recorded, the audience it is written for is the honest guide: work for
// everyone or for a group needs people together, individual work does not, and
// co-op work belongs to an outside class.
// ---------------------------------------------------------------------------
const AUDIENCE_WORK_TYPES = {
  together: 'group-lesson',
  group: 'group-lesson',
  individual: 'independent-essential',
  'coop-outside': 'outside-coop',
  coop: 'outside-coop'
};

function workTypeForReferenced(ref) {
  const r = obj(ref);
  if (str(r.workType)) return str(r.workType);
  const audience = str(r.audience) || str(r.participantMode);
  return AUDIENCE_WORK_TYPES[audience] || 'group-lesson';
}

// A parent-facing note, in the user's own register, for a line that sits on a
// day the work does not really fit. The line is still placed — a parent moves
// work, this module does not quietly delete it — and nothing here says
// "invalid", "conflict" or "error".
function capacityNoteFor(capacityId) {
  if (capacityId === 'light-independent') return 'This is a light independent day';
  if (capacityId === 'outside-only') return 'This day is given to outside work';
  if (capacityId === 'off') return 'This day is usually off';
  return null;
}

// ---------------------------------------------------------------------------
// listPlannableStudents — who the page can offer in "Whose week is this?"
// ---------------------------------------------------------------------------
export function listPlannableStudents(appState) {
  const s = obj(appState);
  return arr(s.students)
    .filter(function (st) { return obj(st).active !== false && str(obj(st).id); })
    .slice()
    .sort(function (a, b) {
      const sa = Number.isFinite(obj(a).sortOrder) ? a.sortOrder : 0;
      const sb = Number.isFinite(obj(b).sortOrder) ? b.sortOrder : 0;
      return sa - sb;
    })
    .map(function (st) { return { id: str(st.id), name: str(st.name) || 'This learner' }; });
}

// ---------------------------------------------------------------------------
// buildStudentWeek
// ---------------------------------------------------------------------------
export const PLANNER_SOURCE_LABEL = 'From your Weekly Rhythm';

// Returns a plannerSpread-shaped state:
//
//   { schemaVersion, weekStartDate, schoolDays, tasks, lastShift: null }
//
// plus a NON-ENUMERABLE `report` ({ unresolved, studentName, counts }) that is
// there to be shown on screen and can never reach saved JSON. Each task may
// likewise carry a non-enumerable `capacityNote`.
export function buildStudentWeek(appState, opts) {
  const state = obj(appState);
  const o = obj(opts);
  const studentId = str(o.studentId);
  const weekStartDate = isValidDate(o.weekStartDate)
    ? mondayOf(str(o.weekStartDate))
    : null;

  const students = arr(state.students);
  const student = students.find(function (st) { return str(obj(st).id) === studentId; }) || null;
  const studentName = student ? (str(student.name) || 'This learner') : '';

  const unresolved = [];
  const tasks = [];
  const counts = { placed: 0, withNotes: 0, skipped: 0 };

  const base = {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    weekStartDate: weekStartDate || mondayOf('2000-01-03'),
    schoolDays: schoolDaysForStudent(student),
    tasks: tasks,
    lastShift: null
  };

  function finish() {
    return mark(base, 'report', {
      unresolved: unresolved.slice(),
      studentName: studentName,
      counts: counts
    });
  }

  if (!student) {
    unresolved.push('That learner is not in your saved plan yet.');
    return finish();
  }
  if (!weekStartDate) {
    unresolved.push('No week was chosen, so nothing could be placed on dates.');
    return finish();
  }

  const rhythm = obj(state.weeklyRhythm);
  const dayMap = buildDayMap(rhythm);
  const blocks = arr(rhythm.blocks);
  const blockSort = {};
  blocks.forEach(function (b, i) {
    const id = str(obj(b).id);
    if (id) blockSort[id] = Number.isFinite(obj(b).sortOrder) ? b.sortOrder : i;
  });

  // Only the assignments this student actually takes part in. Resolved the
  // same way the rest of the app resolves them, through the adapter's student
  // lens, so the spread can never disagree with the Weekly Rhythm on screen.
  const assignments = Array.isArray(o.rhythmAssignments)
    ? o.rhythmAssignments
    : studentAssignments(state, studentId);

  const sorted = assignments.slice().sort(function (a, b) {
    const ba = blockSort[str(obj(a).blockId)];
    const bb = blockSort[str(obj(b).blockId)];
    const da = Number.isFinite(ba) ? ba : 0;
    const db = Number.isFinite(bb) ? bb : 0;
    if (da !== db) return da - db;
    const sa = Number.isFinite(obj(a).sortOrder) ? a.sortOrder : 0;
    const sb = Number.isFinite(obj(b).sortOrder) ? b.sortOrder : 0;
    return sa - sb;
  });

  const orderOnDate = {};
  let seq = 0;

  sorted.forEach(function (assignment) {
    const a = obj(assignment);
    seq += 1;

    const dayEntry = dayMap[str(a.dayId)];
    if (!dayEntry || dayEntry.offset === null) {
      counts.skipped += 1;
      unresolved.push('One line in your Weekly Rhythm is not on a day of the week yet, so it was left off this week.');
      return;
    }

    const resolved = resolveAssignmentTitle(state, a);
    if (!resolved) {
      counts.skipped += 1;
      unresolved.push('One line in your Weekly Rhythm points at something that is no longer in your plan, so it was left off this week.');
      return;
    }

    const date = addDays(base.weekStartDate, dayEntry.offset);
    const capacity = resolveDayCapacity(student, dayEntry.weekdayId);
    const verdict = workTypeAllowedOnCapacity(
      workTypeForReferenced(resolved.referenced),
      capacity,
      { mayOccurOnLightDays: obj(resolved.referenced).mayOccurOnLightDays === true }
    );

    if (orderOnDate[date] === undefined) orderOnDate[date] = 0;
    const task = {
      id: 'plan-' + studentId + '-' + (str(a.id) || 'line' + seq),
      title: resolved.title,
      who: studentName,
      date: date,
      order: orderOnDate[date],
      done: false,
      sourceLabel: PLANNER_SOURCE_LABEL
    };
    orderOnDate[date] += 1;

    if (!verdict.allowed) {
      const note = capacityNoteFor(capacity);
      if (note) {
        mark(task, 'capacityNote', note);
        counts.withNotes += 1;
      }
    }

    tasks.push(task);
    counts.placed += 1;
  });

  return finish();
}

// The student's own rhythm assignments. Kept here rather than importing the
// adapter so this module stays small and tolerant of a half-filled plan; it
// mirrors resolveRhythmAssignmentParticipants' precedence exactly.
function studentAssignments(state, studentId) {
  const s = obj(state);
  const rhythm = obj(s.weeklyRhythm);
  const activeStudentIds = arr(s.students)
    .filter(function (st) { return obj(st).active !== false; })
    .map(function (st) { return str(obj(st).id); });

  return arr(rhythm.assignments).filter(function (assignment) {
    const a = obj(assignment);
    if (Array.isArray(a.participantIds) && a.participantIds.length) {
      return a.participantIds.indexOf(studentId) > -1;
    }
    if (a.assignmentType === 'together') return activeStudentIds.indexOf(studentId) > -1;
    if (a.assignmentType === 'student') return str(a.referencedId) === studentId;
    if (a.assignmentType === 'group') {
      const group = arr(s.groups).find(function (g) { return str(obj(g).id) === str(a.referencedId); });
      return !!group && arr(group.studentIds).indexOf(studentId) > -1;
    }
    if (a.assignmentType === 'card' || a.assignmentType === 'loop' || a.assignmentType === 'sequence') {
      const list = a.assignmentType === 'card' ? s.cards : (a.assignmentType === 'loop' ? s.loops : s.sequences);
      const ref = arr(list).find(function (x) { return str(obj(x).id) === str(a.referencedId); });
      // A line whose reference has gone belongs to nobody, so it cannot be
      // filtered by participants. Keep it, so buildStudentWeek can leave it
      // off and say so quietly rather than drop it in silence.
      if (!ref) return true;
      return referencedIncludesStudent(s, ref, studentId, activeStudentIds);
    }
    return false;
  });
}

function referencedIncludesStudent(state, ref, studentId, activeStudentIds) {
  const r = obj(ref);
  const mode = str(r.participantMode) || str(r.audience);
  const ids = arr(r.participantIds).map(String);
  if (mode === 'together') return activeStudentIds.indexOf(studentId) > -1;
  if (mode === 'group') {
    return ids.some(function (groupId) {
      const group = arr(state.groups).find(function (g) { return str(obj(g).id) === groupId; });
      return !!group && arr(group.studentIds).indexOf(studentId) > -1;
    });
  }
  return ids.indexOf(studentId) > -1;
}

// The line's words, taken from the plan — never an id, never a blank.
//
// A loop bucket becomes ONE line reading "<bucket> — next item". Which item
// comes up next is a decision the plan does not record per week, and this
// module will not invent one.
function resolveAssignmentTitle(state, assignment) {
  const s = obj(state);
  const a = obj(assignment);
  const refId = str(a.referencedId);

  if (a.assignmentType === 'card') {
    const card = arr(s.cards).find(function (c) { return str(obj(c).id) === refId; });
    if (!card) return null;
    const title = str(card.title) || subjectLabel(s, card.subjectColumnId);
    return title ? { title: title, referenced: card } : null;
  }
  if (a.assignmentType === 'loop') {
    const loop = arr(s.loops).find(function (l) { return str(obj(l).id) === refId; });
    if (!loop) return null;
    const title = str(loop.title) || subjectLabel(s, loop.subjectColumnId);
    return title ? { title: title + ' — next item', referenced: loop } : null;
  }
  if (a.assignmentType === 'sequence') {
    const sequence = arr(s.sequences).find(function (q) { return str(obj(q).id) === refId; });
    if (!sequence) return null;
    const title = str(sequence.title) || subjectLabel(s, sequence.subjectColumnId);
    return title ? { title: title, referenced: sequence } : null;
  }

  // 'together' / 'student' / 'group' / 'coop' / 'subject' / 'custom' lines have
  // no card behind them; the parent's own label for the line is what shows.
  const label = str(a.label);
  if (!label) return null;
  return { title: label, referenced: a };
}

function subjectLabel(state, subjectColumnId) {
  const col = arr(obj(state).subjectColumns)
    .find(function (c) { return str(obj(c).id) === str(subjectColumnId); });
  return col ? str(col.label) : '';
}

// A plain-language line for the quiet note the page shows, or '' when there is
// nothing to say. De-duplicated, because the same thing said five times reads
// like an alarm.
export function describeUnresolved(report) {
  const list = arr(obj(report).unresolved);
  const seen = [];
  list.forEach(function (line) {
    if (str(line) && seen.indexOf(str(line)) === -1) seen.push(str(line));
  });
  return seen.join(' ');
}

export { WEEKDAY_LABEL_BY_ID };
