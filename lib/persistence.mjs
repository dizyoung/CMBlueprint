// Family School Map — Phase 1C persistence helpers.
//
// Pure, dependency-free helpers for turning a shared AppState into/back from
// plain JSON, validating it, migrating it across versions, and normalizing
// it with safe defaults. No DOM, no localStorage, no fetch — runs unmodified
// under plain `node`. Browser-specific glue (actually reading/writing
// localStorage, triggering a file download/upload) lives in
// lib/persistenceBrowser.mjs so this module stays fully testable in Node.

import * as M from './familyMap.mjs';
import * as R from './weeklyRhythm.mjs';

export const CURRENT_APP_STATE_VERSION = 1;

// ---------------------------------------------------------------------------
// Serialize / deserialize — AppState is already plain JSON-friendly, but we
// round-trip through JSON explicitly so we never accidentally save a
// function, class instance, or other non-serializable value.
// ---------------------------------------------------------------------------
export function serializeAppState(state) {
  return JSON.stringify(state);
}

export function deserializeAppState(json) {
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// Validation — checks the minimum shape needed for the app to safely render.
// Returns { valid, errors }. Never throws.
// ---------------------------------------------------------------------------
export function validateAppState(raw) {
  var errors = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Backup file is not a valid plan (not an object).'] };
  }
  if (typeof raw.appStateVersion !== 'number') {
    errors.push('Missing or invalid version.');
  } else if (raw.appStateVersion > CURRENT_APP_STATE_VERSION) {
    errors.push('This backup was saved by a newer version of the app (version ' + raw.appStateVersion + ').');
  }

  var requiredArrays = ['students', 'groups', 'subjectColumns', 'cards'];
  requiredArrays.forEach(function (key) {
    if (!Array.isArray(raw[key])) errors.push('Missing or invalid "' + key + '" list.');
  });

  ['resources', 'resourceUses', 'loops', 'loopItems', 'sequences', 'sequenceItems', 'extensionWorks', 'starterTemplates'].forEach(function (key) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) errors.push('Invalid "' + key + '" list.');
  });

  if (raw.weeklyRhythm !== undefined && raw.weeklyRhythm !== null) {
    if (typeof raw.weeklyRhythm !== 'object' ||
        !Array.isArray(raw.weeklyRhythm.days) ||
        !Array.isArray(raw.weeklyRhythm.blocks) ||
        !Array.isArray(raw.weeklyRhythm.assignments)) {
      errors.push('Invalid weekly rhythm data.');
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

// ---------------------------------------------------------------------------
// Normalization — fills in missing optional collections/objects with safe,
// empty defaults. Never removes or rewrites data the parent entered; only
// adds what's missing so the rest of the app can render without guarding
// every read site against undefined.
// ---------------------------------------------------------------------------
export function normalizeAppState(raw) {
  var state = Object.assign({}, raw);

  state.appStateVersion = CURRENT_APP_STATE_VERSION;
  state.students = Array.isArray(state.students) ? state.students : [];
  state.groups = Array.isArray(state.groups) ? state.groups : [];
  state.subjectColumns = Array.isArray(state.subjectColumns) ? state.subjectColumns : [];
  state.cards = Array.isArray(state.cards) ? state.cards : [];
  state.loops = Array.isArray(state.loops) ? state.loops : [];
  state.loopItems = Array.isArray(state.loopItems) ? state.loopItems : [];
  state.sequences = Array.isArray(state.sequences) ? state.sequences : [];
  state.sequenceItems = Array.isArray(state.sequenceItems) ? state.sequenceItems : [];
  state.extensionWorks = Array.isArray(state.extensionWorks) ? state.extensionWorks : [];
  state.resources = Array.isArray(state.resources) ? state.resources : [];
  state.resourceUses = Array.isArray(state.resourceUses) ? state.resourceUses : [];
  state.starterTemplates = Array.isArray(state.starterTemplates) ? state.starterTemplates : [];
  state.printSettings = (state.printSettings && typeof state.printSettings === 'object')
    ? state.printSettings : M.makePrintSettings();

  var rhythm = state.weeklyRhythm;
  if (!rhythm || typeof rhythm !== 'object' || !Array.isArray(rhythm.days) || !Array.isArray(rhythm.blocks) || !Array.isArray(rhythm.assignments)) {
    state.weeklyRhythm = R.makeWeeklyRhythm({});
  }
  state.rhythmPrintSettings = (state.rhythmPrintSettings && typeof state.rhythmPrintSettings === 'object')
    ? state.rhythmPrintSettings : R.makeRhythmPrintSettings();

  return state;
}

// ---------------------------------------------------------------------------
// Migration — version 1 is the only version today. Scaffolded so a future
// version 2 can add a migrateV1ToV2 step here without touching callers.
// Returns { ok, state, error }.
// ---------------------------------------------------------------------------
export function migrateAppState(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Backup file is not a valid plan.' };
  }
  var version = raw.appStateVersion;

  if (version === undefined || version === null) {
    // Treat untagged state as version 1 — most likely a hand-edited or very
    // early save — and let normalization fill in the rest safely.
    version = 1;
  }

  if (version > CURRENT_APP_STATE_VERSION) {
    return { ok: false, error: 'This backup was saved by a newer version of the app and cannot be opened here yet.' };
  }

  if (version === 1) {
    return { ok: true, state: normalizeAppState(Object.assign({}, raw, { appStateVersion: 1 })) };
  }

  return { ok: false, error: 'Unrecognized plan version (' + version + ').' };
}

// ---------------------------------------------------------------------------
// Load a raw value (e.g. parsed from localStorage or an imported file)
// through validation + migration + normalization in one safe step.
// Returns { ok, state, errors }.
// ---------------------------------------------------------------------------
export function loadAppStateSafely(raw) {
  var validation = validateAppState(raw);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }
  var migrated = migrateAppState(raw);
  if (!migrated.ok) {
    return { ok: false, errors: [migrated.error] };
  }
  return { ok: true, state: migrated.state, errors: [] };
}

// ---------------------------------------------------------------------------
// Export backup — wraps the current state with export metadata. The backup
// IS the AppState (plus appStateVersion, which is already on it) with an
// exportedAt timestamp alongside it.
// ---------------------------------------------------------------------------
export function buildExportPayload(state, now) {
  var when = (now instanceof Date ? now : new Date());
  return Object.assign({}, state, {
    appStateVersion: state.appStateVersion || CURRENT_APP_STATE_VERSION,
    exportedAt: when.toISOString(),
    // A parent reading the file in a text editor should not have to decode
    // an ISO string to know which day's plan they are holding.
    exportedAtLocal: formatLocalTimestamp(when)
  });
}

// Human-readable local timestamp. Falls back to the ISO string if the
// environment has no locale formatting.
export function formatLocalTimestamp(date) {
  var d = date instanceof Date ? date : new Date();
  try {
    return d.toLocaleString();
  } catch (e) {
    return d.toISOString();
  }
}

// ---------------------------------------------------------------------------
// Import summary — a plain-language description of what a backup file holds,
// shown to the parent BEFORE anything is replaced. Pure: takes an already
// validated + normalized state (plus the raw payload, for its export stamp)
// and returns counts. Never throws on odd input.
// ---------------------------------------------------------------------------
export function summarizeAppState(state, rawPayload) {
  var s = (state && typeof state === 'object') ? state : {};
  var raw = (rawPayload && typeof rawPayload === 'object') ? rawPayload : {};
  function list(key) { return Array.isArray(s[key]) ? s[key] : []; }

  var students = list('students');
  var loops = list('loops');
  var activeLoops = loops.filter(function (l) { return !l || l.active !== false; });
  var strandAssignments = Array.isArray(s.strandAssignments) ? s.strandAssignments : [];

  return {
    childCount: students.length,
    childNames: students.map(function (st) {
      return (st && (st.name || st.initials)) ? String(st.name || st.initials) : 'Unnamed child';
    }),
    groupCount: list('groups').length,
    loopCount: loops.length,
    activeLoopCount: activeLoops.length,
    setAsideLoopCount: loops.length - activeLoops.length,
    strandDecisionCount: strandAssignments.length,
    cardCount: list('cards').length,
    outsideCommitmentCount: Array.isArray(s.outsideCommitments) ? s.outsideCommitments.length : 0,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
    exportedAtLocal: typeof raw.exportedAtLocal === 'string' ? raw.exportedAtLocal : null,
    appStateVersion: typeof raw.appStateVersion === 'number' ? raw.appStateVersion : (s.appStateVersion || null)
  };
}

export function describeImportSummary(summary) {
  var names = summary.childNames.length ? ' (' + summary.childNames.join(', ') + ')' : '';
  var when = summary.exportedAtLocal || summary.exportedAt || 'not recorded in the file';
  return [
    'This file contains:',
    '  • ' + summary.childCount + ' child' + (summary.childCount === 1 ? '' : 'ren') + names,
    '  • ' + summary.groupCount + ' group' + (summary.groupCount === 1 ? '' : 's'),
    '  • ' + summary.loopCount + ' loop' + (summary.loopCount === 1 ? '' : 's') +
      ' (' + summary.activeLoopCount + ' active, ' + summary.setAsideLoopCount + ' set aside)',
    '  • ' + summary.strandDecisionCount + ' strand decision' + (summary.strandDecisionCount === 1 ? '' : 's'),
    '  • ' + summary.cardCount + ' subject card' + (summary.cardCount === 1 ? '' : 's'),
    '',
    'Exported: ' + when
  ].join('\n');
}

export function suggestedExportFilename(now) {
  var d = now instanceof Date ? now : new Date();
  var iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return 'family-school-map-backup-' + iso + '.json';
}
