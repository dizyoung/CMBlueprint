// Card Table prototype — browser persistence + save-status glue.
//
// Fully namespaced: this module knows one storage key and it is not the
// production planner's. It never imports lib/persistenceBrowser.mjs and never
// reads or writes the parent's Setup/Feast plan.
//
// Carries over the hardening the production save bar already needed:
//   * debounced autosave PLUS a synchronous flush()
//   * flush() on pagehide and on visibilitychange-when-hidden (not only
//     beforeunload, which mobile browsers routinely skip)
//   * a persistent status line — Saving… / Saved at 7:18 PM / Save failed — …
//     where a failure STAYS on screen until the next successful write
//   * no silent autosave failure, ever
//   * a schemaVersion on the payload and a tolerant loader

import {
  buildDefaultCardTableState,
  serializeCardTableState,
  deserializeCardTableState
} from '../../lib/cardTable.mjs';

export const CARD_TABLE_STORAGE_KEY = 'cmblueprint.cardTablePrototype.v1';
export const CARD_TABLE_SAVED_AT_KEY = 'cmblueprint.cardTablePrototype.v1.savedAt';

const AUTOSAVE_DEBOUNCE_MS = 600;

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch (e) {
    return false;
  }
}

function formatClock(date) {
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return date.toISOString();
  }
}

export function loadCardTableState() {
  if (!hasLocalStorage()) return { state: buildDefaultCardTableState(), source: 'default' };
  var raw = null;
  try {
    raw = localStorage.getItem(CARD_TABLE_STORAGE_KEY);
  } catch (e) {
    return { state: buildDefaultCardTableState(), source: 'default' };
  }
  if (!raw) return { state: buildDefaultCardTableState(), source: 'default' };
  return deserializeCardTableState(raw);
}

export function saveCardTableState(state) {
  if (!hasLocalStorage()) {
    return { ok: false, error: 'this browser cannot save.' };
  }
  var savedAt = new Date().toISOString();
  try {
    localStorage.setItem(CARD_TABLE_STORAGE_KEY, serializeCardTableState(state));
  } catch (e) {
    return { ok: false, error: 'browser storage is full or unavailable, so nothing new was written.' };
  }
  try {
    localStorage.setItem(CARD_TABLE_SAVED_AT_KEY, savedAt);
  } catch (e) {
    // The table itself is safely written; only the timestamp is missing.
  }
  return { ok: true, savedAt: savedAt };
}

export function readLastSavedAt() {
  if (!hasLocalStorage()) return null;
  try {
    return localStorage.getItem(CARD_TABLE_SAVED_AT_KEY) || null;
  } catch (e) {
    return null;
  }
}

export function clearCardTableState() {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(CARD_TABLE_STORAGE_KEY);
    localStorage.removeItem(CARD_TABLE_SAVED_AT_KEY);
  } catch (e) { /* nothing more we can safely do */ }
}

// createCardTableSaver({ getState, statusEl })
//   -> { scheduleSave, saveNow, flush, install, renderStatus }
export function createCardTableSaver(opts) {
  var getState = opts.getState;
  var statusEl = opts.statusEl || null;
  var timer = null;
  var dirty = false;
  var savingNow = false;
  var lastFailure = null;   // sticky until the next success
  var lastSavedAt = null;

  function renderStatus() {
    if (!statusEl) return;
    var text;
    var kind;
    if (savingNow) { text = 'Saving…'; kind = 'unsaved'; }
    else if (lastFailure) { text = 'Save failed — ' + lastFailure; kind = 'failed'; }
    else if (lastSavedAt) { text = 'Saved at ' + formatClock(lastSavedAt); kind = 'saved'; }
    else { text = 'Not saved yet'; kind = 'unsaved'; }
    statusEl.textContent = text;
    statusEl.className = 'save-status status-' + kind;
  }

  function saveNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    savingNow = true;
    renderStatus();
    var result;
    try {
      result = saveCardTableState(getState());
    } catch (e) {
      // An unexpected throw must still surface — never a silent failure.
      result = { ok: false, error: (e && e.message) ? e.message : 'an unexpected problem stopped the save.' };
    }
    savingNow = false;
    if (result.ok) {
      dirty = false;
      lastFailure = null;
      lastSavedAt = result.savedAt ? new Date(result.savedAt) : new Date();
    } else {
      lastFailure = result.error;
    }
    renderStatus();
    return result;
  }

  function scheduleSave() {
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; saveNow(); }, AUTOSAVE_DEBOUNCE_MS);
    if (statusEl && !lastFailure) { statusEl.textContent = 'Saving…'; statusEl.className = 'save-status status-unsaved'; }
  }

  // Synchronous. Safe from a pagehide handler because localStorage is sync.
  function flush() {
    if (!dirty) return { ok: true, skipped: true };
    return saveNow();
  }

  function install() {
    window.addEventListener('pagehide', function () { flush(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('beforeunload', function () { flush(); });
    var iso = readLastSavedAt();
    if (iso) {
      var d = new Date(iso);
      if (!isNaN(d.getTime())) lastSavedAt = d;
    }
    renderStatus();
  }

  return {
    scheduleSave: scheduleSave,
    saveNow: saveNow,
    flush: flush,
    install: install,
    renderStatus: renderStatus,
    getLastSavedAt: function () { return lastSavedAt; }
  };
}
