// Planner Spread prototype — pure model + shift logic.
//
// This module is DOM-free on purpose so the whole shift behaviour can be
// tested under plain `node`. Nothing here touches localStorage, window, or
// any other surface in the app. It is also deliberately ISOLATED: no other
// module in this repo imports it, and it imports nothing.
//
// WHY THIS EXISTS
// ---------------
// Every planning surface in CM Blueprint is dateless on purpose (what is in
// the year, who does it, which loop). This prototype explores the *other*
// layer — assignments sitting on real dates — and in particular the one
// interaction that is hard to get right: dragging a whole day onto another
// day, and choosing between "flow everything after" and "just add to that
// day".
//
// All exported functions are pure: they return a new state object and never
// mutate the state passed in. Every one tolerates `{}` and missing arrays.

export const PLANNER_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Date helpers — no date library, and timezone-safe.
//
// Dates in this model are plain 'YYYY-MM-DD' strings. Every computation goes
// through UTC so that a shift can never slip a day because the machine
// happens to sit in a timezone with a DST change that week.
// ---------------------------------------------------------------------------

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Returns { y, m, d } or null. Never throws.
export function parseDate(iso) {
  if (typeof iso !== 'string') return null;
  const m = ISO_DATE_RE.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Round-trip through UTC so '2026-02-31' is rejected rather than silently
  // becoming the 3rd of March.
  const stamp = Date.UTC(y, mo - 1, d);
  const back = new Date(stamp);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return { y: y, m: mo, d: d };
}

export function isValidDate(iso) {
  return parseDate(iso) !== null;
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

export function formatDate(y, m, d) {
  return y + '-' + pad2(m) + '-' + pad2(d);
}

// Days since the epoch, in UTC. Used only internally for arithmetic.
function toStamp(iso) {
  const p = parseDate(iso);
  if (!p) return null;
  return Date.UTC(p.y, p.m - 1, p.d);
}

function fromStamp(stamp) {
  const dt = new Date(stamp);
  return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const DAY_MS = 86400000;

// addDays('2026-03-31', 1) === '2026-04-01'. Returns null on a bad input.
export function addDays(iso, n) {
  const stamp = toStamp(iso);
  if (stamp === null) return null;
  const count = Number(n);
  if (!Number.isFinite(count)) return iso;
  return fromStamp(stamp + Math.round(count) * DAY_MS);
}

// 0 = Sunday .. 6 = Saturday, computed in UTC.
export function weekdayIndex(iso) {
  const stamp = toStamp(iso);
  if (stamp === null) return null;
  return new Date(stamp).getUTCDay();
}

// 'mon' | 'tue' | ... | 'sun'
export function weekdayKey(iso) {
  const idx = weekdayIndex(iso);
  return idx === null ? null : WEEKDAY_KEYS[idx];
}

// 'Monday', 'Tuesday', ...
export function weekdayLabel(iso) {
  const idx = weekdayIndex(iso);
  return idx === null ? '' : WEEKDAY_LABELS[idx];
}

// 'March 2' — short and human, the way a date is written at the top of a
// planner column.
export function humanDate(iso) {
  const p = parseDate(iso);
  if (!p) return '';
  return MONTH_LABELS[p.m - 1] + ' ' + p.d;
}

// The Monday of the week containing `iso`. Sunday belongs to the week that
// just ended, which is how a paper planner reads.
export function mondayOf(iso) {
  const idx = weekdayIndex(iso);
  if (idx === null) return null;
  const back = idx === 0 ? 6 : idx - 1;
  return addDays(iso, -back);
}

export function todayISO(now) {
  const d = now instanceof Date ? now : new Date();
  // Local calendar day, then treated as a plain string from here on.
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// ---------------------------------------------------------------------------
// Normalization — every function below starts here, so `{}` is a valid input.
// ---------------------------------------------------------------------------

const DEFAULT_SCHOOL_DAYS = { mon: true, tue: true, wed: true, thu: false, fri: true, sat: false };

function normalizeSchoolDays(raw) {
  const out = {};
  for (const key of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
    out[key] = raw && typeof raw === 'object' && key in raw
      ? raw[key] === true
      : DEFAULT_SCHOOL_DAYS[key];
  }
  return out;
}

function normalizeTask(raw, index) {
  const t = raw && typeof raw === 'object' ? raw : {};
  return {
    id: typeof t.id === 'string' && t.id ? t.id : 'task-' + index + '-' + Math.random().toString(36).slice(2, 8),
    title: typeof t.title === 'string' ? t.title : '',
    who: typeof t.who === 'string' ? t.who : '',
    date: isValidDate(t.date) ? t.date.trim() : null,
    order: Number.isFinite(t.order) ? t.order : index,
    done: t.done === true,
    sourceLabel: typeof t.sourceLabel === 'string' && t.sourceLabel ? t.sourceLabel : null
  };
}

// Returns a fully-formed state. Safe on `{}`, null, or a damaged payload.
export function normalizeState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const tasks = Array.isArray(s.tasks) ? s.tasks.map(normalizeTask) : [];
  const weekStart = isValidDate(s.weekStartDate)
    ? mondayOf(s.weekStartDate.trim())
    : mondayOf(todayISO());
  const last = s.lastShift && typeof s.lastShift === 'object' && Array.isArray(s.lastShift.tasks)
    ? { tasks: s.lastShift.tasks.map(normalizeTask), description: String(s.lastShift.description || 'last change') }
    : null;
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    weekStartDate: weekStart,
    schoolDays: normalizeSchoolDays(s.schoolDays),
    tasks: tasks,
    lastShift: last
  };
}

// Shallow-clone the state, replacing `tasks` (always a fresh array of fresh
// task objects, so the caller's state can never be reached through ours).
function withTasks(state, tasks, lastShift) {
  const base = normalizeState(state);
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    weekStartDate: base.weekStartDate,
    schoolDays: Object.assign({}, base.schoolDays),
    tasks: tasks.map(t => Object.assign({}, t)),
    lastShift: lastShift === undefined ? base.lastShift : lastShift
  };
}

// ---------------------------------------------------------------------------
// School days
// ---------------------------------------------------------------------------

// A day that normally holds work. Sunday is never a school day in this model.
export function isSchoolDay(state, iso) {
  const s = normalizeState(state);
  const key = weekdayKey(iso);
  if (!key || key === 'sun') return false;
  return s.schoolDays[key] === true;
}

export function hasAnySchoolDay(state) {
  const s = normalizeState(state);
  return Object.keys(s.schoolDays).some(k => s.schoolDays[k] === true);
}

// The next day at or after `iso` that holds work.
export function nextSchoolDayOnOrAfter(state, iso) {
  if (!isValidDate(iso)) return iso;
  // If the family has marked every day as a non-school day there is no
  // meaningful answer; fall back to the day itself rather than spinning.
  if (!hasAnySchoolDay(state)) return iso;
  let cursor = iso;
  for (let i = 0; i < 400; i++) {
    if (isSchoolDay(state, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return iso;
}

// The next day strictly after `iso` that holds work. This is what makes a
// cascade feel right: with Thursday off, Wednesday's work flows to Friday.
export function nextSchoolDay(state, iso) {
  if (!isValidDate(iso)) return iso;
  if (!hasAnySchoolDay(state)) return addDays(iso, 1);
  return nextSchoolDayOnOrAfter(state, addDays(iso, 1));
}

// ---------------------------------------------------------------------------
// Reading the spread
// ---------------------------------------------------------------------------

function byOrder(a, b) {
  if (a.order !== b.order) return a.order - b.order;
  return String(a.id).localeCompare(String(b.id));
}

// Tasks on one date, in their written order.
export function tasksForDate(state, iso) {
  const s = normalizeState(state);
  return s.tasks.filter(t => t.date === iso).sort(byOrder).map(t => Object.assign({}, t));
}

// The visible days of the spread: Monday–Friday always, plus Saturday and
// Sunday only when they actually hold something (a paper planner shows
// Thursday even when nothing is on it, but it does not invent a weekend).
export function daysForSpread(state) {
  const s = normalizeState(state);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(s.weekStartDate, i);
    const tasks = tasksForDate(s, date);
    const isWeekend = i >= 5;
    if (isWeekend && tasks.length === 0) continue;
    days.push({
      date: date,
      weekdayKey: weekdayKey(date),
      weekdayLabel: weekdayLabel(date),
      humanDate: humanDate(date),
      isSchoolDay: isSchoolDay(s, date),
      taskCount: tasks.length,
      tasks: tasks
    });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Editing single tasks
// ---------------------------------------------------------------------------

function nextOrderOn(tasks, iso) {
  let max = -1;
  for (const t of tasks) {
    if (t.date === iso && t.order > max) max = t.order;
  }
  return max + 1;
}

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return 't' + Date.now().toString(36) + idCounter.toString(36);
}

export function addTask(state, fields) {
  const s = normalizeState(state);
  const f = fields && typeof fields === 'object' ? fields : {};
  const date = isValidDate(f.date) ? f.date.trim() : s.weekStartDate;
  const task = normalizeTask({
    id: typeof f.id === 'string' && f.id ? f.id : makeId(),
    title: f.title,
    who: f.who,
    date: date,
    order: nextOrderOn(s.tasks, date),
    done: f.done === true,
    sourceLabel: f.sourceLabel
  }, s.tasks.length);
  return withTasks(s, s.tasks.concat([task]));
}

export function editTaskTitle(state, taskId, title) {
  const s = normalizeState(state);
  return withTasks(s, s.tasks.map(t =>
    t.id === taskId ? Object.assign({}, t, { title: typeof title === 'string' ? title : t.title }) : t));
}

export function editTaskWho(state, taskId, who) {
  const s = normalizeState(state);
  return withTasks(s, s.tasks.map(t =>
    t.id === taskId ? Object.assign({}, t, { who: typeof who === 'string' ? who : t.who }) : t));
}

export function deleteTask(state, taskId) {
  const s = normalizeState(state);
  return withTasks(s, s.tasks.filter(t => t.id !== taskId));
}

export function toggleDone(state, taskId) {
  const s = normalizeState(state);
  return withTasks(s, s.tasks.map(t =>
    t.id === taskId ? Object.assign({}, t, { done: !t.done }) : t));
}

export function setWeekStart(state, iso) {
  const s = normalizeState(state);
  if (!isValidDate(iso)) return s;
  return Object.assign({}, s, { weekStartDate: mondayOf(iso.trim()), tasks: s.tasks.map(t => Object.assign({}, t)) });
}

export function shiftWeek(state, deltaWeeks) {
  const s = normalizeState(state);
  const n = Number.isFinite(deltaWeeks) ? Math.round(deltaWeeks) : 0;
  return setWeekStart(s, addDays(s.weekStartDate, n * 7));
}

// ---------------------------------------------------------------------------
// moveTask — one task to another day. Nothing else moves.
// ---------------------------------------------------------------------------

export function moveTask(state, taskId, toDate) {
  const s = normalizeState(state);
  if (!isValidDate(toDate)) return s;
  const target = toDate.trim();
  const moving = s.tasks.find(t => t.id === taskId);
  if (!moving) return s;
  if (moving.date === target) return s;
  const order = nextOrderOn(s.tasks, target);
  return withTasks(s, s.tasks.map(t =>
    t.id === taskId ? Object.assign({}, t, { date: target, order: order }) : t));
}

// ---------------------------------------------------------------------------
// shiftDay — the heart of the prototype.
//
//   'stack'   the tasks on fromDate join whatever is already on toDate.
//             Nothing else in the week moves. ("double up")
//
//   'cascade' the tasks on fromDate land on toDate, AND every day that
//             already held work on or after toDate flows forward to its next
//             school day, in order, keeping its relative sequence.
//             ("everything beyond flows")
//
// The exact cascade rule:
//   1. The tasks on fromDate are lifted out. They land on toDate, in order.
//   2. The remaining tasks on dates >= toDate are grouped by their date and
//      those dates are walked in ascending order.
//   3. The first such group is placed on the next school day AFTER toDate;
//      each later group on the next school day after the group before it.
//      Non-school days are skipped, and the walk runs into the following
//      week (and beyond) as far as it needs to, so no task is ever dropped.
//   4. Tasks on dates before toDate are untouched.
//   5. A cascade never pulls a day earlier: a group also never lands before
//      its own next school day, so a gap in the week stays a gap.
// ---------------------------------------------------------------------------

// Date -> tasks, with the dates walked in ascending order (plain string
// comparison is correct for 'YYYY-MM-DD') and each day's tasks in order.
function groupByDate(tasks) {
  const bucket = new Map();
  for (const t of tasks.slice().sort(byOrder)) {
    if (!bucket.has(t.date)) bucket.set(t.date, []);
    bucket.get(t.date).push(t);
  }
  const map = new Map();
  for (const date of Array.from(bucket.keys()).sort()) map.set(date, bucket.get(date));
  return map;
}

// A cascade only ever pushes work later, never earlier. A group lands on the
// next school day after the group ahead of it, but never before its own next
// school day — so a gap in the week cannot pull a later day backwards.
function laterOf(a, b) {
  return a > b ? a : b;
}

function reindex(tasks) {
  const byDate = groupByDate(tasks);
  const out = [];
  for (const [date, group] of byDate) {
    group.forEach((t, i) => out.push(Object.assign({}, t, { date: date, order: i })));
  }
  return out;
}

export function describeShift(fromDate, toDate, mode) {
  const from = weekdayLabel(fromDate) || humanDate(fromDate) || 'that day';
  const to = weekdayLabel(toDate) || humanDate(toDate) || 'the next day';
  if (mode === 'stack') {
    return 'Moved ' + from + ' to ' + to + ' alongside what was already there';
  }
  return 'Moved ' + from + ' to ' + to + ' and flowed everything after';
}

export function shiftDay(state, fromDate, toDate, mode) {
  const s = normalizeState(state);
  if (!isValidDate(fromDate) || !isValidDate(toDate)) return s;
  const from = fromDate.trim();
  const to = toDate.trim();
  if (from === to) return s;

  const moving = s.tasks.filter(t => t.date === from).sort(byOrder);
  if (moving.length === 0) return s;
  const rest = s.tasks.filter(t => t.date !== from);

  const snapshot = s.tasks.map(t => Object.assign({}, t));
  const lastShift = { tasks: snapshot, description: describeShift(from, to, mode === 'stack' ? 'stack' : 'cascade') };

  if (mode === 'stack') {
    // Land the moved tasks after whatever is already on the target day.
    const existingOnTarget = rest.filter(t => t.date === to).length;
    const landed = moving.map((t, i) => Object.assign({}, t, { date: to, order: existingOnTarget + i }));
    return withTasks(s, reindex(rest.concat(landed)), lastShift);
  }

  // --- cascade ---
  const before = rest.filter(t => t.date < to);
  const after = rest.filter(t => t.date >= to);

  const landed = moving.map((t, i) => Object.assign({}, t, { date: to, order: i }));

  const groups = groupByDate(after);
  const flowed = [];
  let cursor = to;
  for (const [groupDate, group] of groups) {
    cursor = laterOf(nextSchoolDay(s, cursor), nextSchoolDay(s, groupDate));
    group.forEach((t, i) => flowed.push(Object.assign({}, t, { date: cursor, order: i })));
  }

  return withTasks(s, reindex(before.concat(landed).concat(flowed)), lastShift);
}

// ---------------------------------------------------------------------------
// Undo — one level, a single snapshot, cleared after use.
//
// A whole-week cascade is frightening without this.
// ---------------------------------------------------------------------------

export function undoLastShift(state) {
  const s = normalizeState(state);
  if (!s.lastShift || !Array.isArray(s.lastShift.tasks)) return s;
  return withTasks(s, s.lastShift.tasks, null);
}

export function canUndo(state) {
  const s = normalizeState(state);
  return !!(s.lastShift && Array.isArray(s.lastShift.tasks));
}

export function undoDescription(state) {
  const s = normalizeState(state);
  return s.lastShift ? s.lastShift.description : null;
}

export function clearLastShift(state) {
  const s = normalizeState(state);
  return withTasks(s, s.tasks, null);
}

// ---------------------------------------------------------------------------
// Default seed — a believable week so the interaction can be felt at once.
//
// Deliberately generic: groups and year-levels, never a real child's name.
// Thursday is OFF so the skip behaviour is visible on the very first drag.
// ---------------------------------------------------------------------------

const SEED = [
  ['mon', 'Bible reading', 'Everyone'],
  ['mon', 'Math lesson', 'Each child'],
  ['mon', 'Copywork', 'Younger students'],
  ['mon', 'Picture study', 'Everyone'],
  ['tue', 'Bible reading', 'Everyone'],
  ['tue', 'Math lesson', 'Each child'],
  ['tue', 'Nature walk', 'Everyone'],
  ['wed', 'Bible reading', 'Everyone'],
  ['wed', 'Dictation', 'Older students'],
  ['wed', 'Hymn study', 'Everyone'],
  ['fri', 'Math lesson', 'Each child'],
  ['fri', 'Handicraft', 'Everyone'],
  ['fri', 'Narration practice', 'Older students']
];

export function buildDefaultPlannerState(now) {
  const weekStart = mondayOf(todayISO(now));
  const offsets = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5 };
  const tasks = [];
  const counters = {};
  SEED.forEach(([dayKey, title, who], i) => {
    const date = addDays(weekStart, offsets[dayKey]);
    counters[date] = counters[date] === undefined ? 0 : counters[date] + 1;
    tasks.push({
      id: 'seed-' + (i + 1),
      title: title,
      who: who,
      date: date,
      order: counters[date],
      done: false,
      sourceLabel: null
    });
  });
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    weekStartDate: weekStart,
    schoolDays: Object.assign({}, DEFAULT_SCHOOL_DAYS),
    tasks: tasks,
    lastShift: null
  };
}

// ---------------------------------------------------------------------------
// Serialization — kept here (pure) so the round trip is testable under node.
// ---------------------------------------------------------------------------

export function serializePlannerState(state) {
  const s = normalizeState(state);
  return JSON.stringify({
    schemaVersion: PLANNER_SCHEMA_VERSION,
    weekStartDate: s.weekStartDate,
    schoolDays: s.schoolDays,
    tasks: s.tasks,
    lastShift: s.lastShift
  });
}

// Tolerant: returns defaults rather than throwing on damaged JSON.
export function deserializePlannerState(raw, now) {
  if (typeof raw !== 'string' || !raw.trim()) return buildDefaultPlannerState(now);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return buildDefaultPlannerState(now);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
    return buildDefaultPlannerState(now);
  }
  return normalizeState(parsed);
}
