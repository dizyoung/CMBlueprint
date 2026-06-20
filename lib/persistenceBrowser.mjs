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
  try {
    localStorage.setItem(APP_STATE_STORAGE_KEY, serializeAppState(state));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Save failed (browser storage may be full or unavailable).' };
  }
}

export function clearSavedAppState() {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(APP_STATE_STORAGE_KEY);
  } catch (e) {
    // ignore — nothing more we can safely do
  }
}
