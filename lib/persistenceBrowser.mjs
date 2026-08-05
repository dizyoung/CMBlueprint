// Family School Map — Phase 1C browser persistence glue.
//
// Thin localStorage wrapper around the pure helpers in lib/persistence.mjs.
// This is the ONLY module in the persistence stack that touches `window`/
// `localStorage` directly, so the validation/migration/normalization logic
// stays testable under plain `node`. Static-hosting friendly: no network
// calls, no backend, works from any origin.

import { loadAppStateSafely, serializeAppState, deserializeAppState } from './persistence.mjs';
import { buildSampleAppState } from './familyMapAdapter.mjs';

export const APP_STATE_STORAGE_KEY = 'cmblueprint.familySchoolMap.v1';
// When the plan was last written. Kept in its own key so the plan itself is
// never rewritten just to record a timestamp, and so a failure to record the
// time can never damage the plan.
export const APP_STATE_SAVED_AT_KEY = 'cmblueprint.familySchoolMap.v1.savedAt';

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch (e) {
    return false;
  }
}

// Returns { state, source } where source is 'saved' | 'sample' | 'reset-after-invalid'.
export function loadAppStateFromStorage() {
  if (!hasLocalStorage()) {
    return { state: buildSampleAppState(), source: 'sample' };
  }
  var raw;
  try {
    raw = localStorage.getItem(APP_STATE_STORAGE_KEY);
  } catch (e) {
    return { state: buildSampleAppState(), source: 'sample' };
  }
  if (!raw) {
    return { state: buildSampleAppState(), source: 'sample' };
  }

  var parsed;
  try {
    parsed = deserializeAppState(raw);
  } catch (e) {
    return { state: buildSampleAppState(), source: 'reset-after-invalid', errors: ['Saved plan could not be read.'] };
  }

  var result = loadAppStateSafely(parsed);
  if (!result.ok) {
    return { state: buildSampleAppState(), source: 'reset-after-invalid', errors: result.errors };
  }
  return { state: result.state, source: 'saved' };
}

// Returns { ok, error }.
export function saveAppStateToStorage(state) {
  if (!hasLocalStorage()) {
    return { ok: false, error: 'This browser does not support saving.' };
  }
  var savedAt = new Date().toISOString();
  try {
    localStorage.setItem(APP_STATE_STORAGE_KEY, serializeAppState(state));
  } catch (e) {
    return { ok: false, error: 'browser storage is full or unavailable, so nothing new was written.' };
  }
  try {
    localStorage.setItem(APP_STATE_SAVED_AT_KEY, savedAt);
  } catch (e) {
    // The plan itself is safely written; only the timestamp is missing.
  }
  return { ok: true, savedAt: savedAt };
}

// ISO string of the last successful save, or null if unknown.
export function readLastSavedAt() {
  if (!hasLocalStorage()) return null;
  try {
    var raw = localStorage.getItem(APP_STATE_SAVED_AT_KEY);
    return raw || null;
  } catch (e) {
    return null;
  }
}

export function clearSavedAppState() {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(APP_STATE_STORAGE_KEY);
    localStorage.removeItem(APP_STATE_SAVED_AT_KEY);
  } catch (e) {
    // ignore — nothing more we can safely do
  }
}
