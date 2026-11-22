// Planner Spread prototype — persistence + save status.
//
// Namespaced entirely to this prototype. The only two storage keys it knows
// about are the two declared below; it never reads or writes the keys the real
// plan lives under, and it shares no code with the production save bar, so
// nothing here can reach a parent's real plan.
//
// Carries over the hardening the rest of this app already needed:
//   * debounced autosave PLUS a synchronous flush() on pagehide and on
//     visibilitychange when hidden, because localStorage writes are
//     synchronous and a lost edit is unforgivable;
//   * a persistent status line — Saving… / Saved at 7:18 PM / Save failed —
//     that STAYS until the next success, so a failure is never silent;
//   * a schemaVersion on the payload;
//   * a tolerant loader that returns defaults rather than throwing.

import {
  buildDefaultPlannerState,
  serializePlannerState,
  deserializePlannerState
} from '../../lib/plannerSpread.mjs';

export const PLANNER_STORAGE_KEY = 'cmblueprint.plannerSpreadPrototype.v1';
export const PLANNER_SAVED_AT_KEY = 'cmblueprint.plannerSpreadPrototype.v1.savedAt';

const AUTOSAVE_DEBOUNCE_MS = 700;

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
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

// Returns { state, source } with source 'saved' | 'default' | 'default-after-damaged'.
export function loadPlannerState() {
  if (!hasLocalStorage()) return { state: buildDefaultPlannerState(), source: 'default' };
  let raw = null;
  try {
    raw = localStorage.getItem(PLANNER_STORAGE_KEY);
  } catch (e) {
    return { state: buildDefaultPlannerState(), source: 'default' };
  }
  if (!raw) return { state: buildDefaultPlannerState(), source: 'default' };
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { state: buildDefaultPlannerState(), source: 'default-after-damaged' };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
    return { state: buildDefaultPlannerState(), source: 'default-after-damaged' };
  }
  // deserializePlannerState normalizes and can never throw.
  return { state: deserializePlannerState(raw), source: 'saved' };
}

// Returns { ok, savedAt } or { ok:false, error }.
export function savePlannerState(state) {
  if (!hasLocalStorage()) {
    return { ok: false, error: 'this browser does not allow saving.' };
  }
  let body;
  try {
    body = serializePlannerState(state);
  } catch (e) {
    return { ok: false, error: 'this week could not be prepared for saving.' };
  }
  const savedAt = new Date().toISOString();
  try {
    localStorage.setItem(PLANNER_STORAGE_KEY, body);
  } catch (e) {
    return { ok: false, error: 'browser storage is full or blocked, so nothing new was written.' };
  }
  try {
    localStorage.setItem(PLANNER_SAVED_AT_KEY, savedAt);
  } catch (e) {
    // The week itself is written; only the timestamp is missing.
  }
  return { ok: true, savedAt: savedAt };
}

export function readPlannerSavedAt() {
  if (!hasLocalStorage()) return null;
  try {
    return localStorage.getItem(PLANNER_SAVED_AT_KEY) || null;
  } catch (e) {
    return null;
  }
}

// createPlannerSaver({ getState, statusEl })
export function createPlannerSaver(opts) {
  const options = opts || {};
  let getState = options.getState || function () { return null; };
  let statusEl = options.statusEl || null;
  let timer = null;
  let dirty = false;
  let savingNow = false;
  let lastSavedAt = null;
  let lastFailure = null;   // sticky until the next success
  let installed = false;

  function render() {
    if (!statusEl) return;
    let text;
    let kind;
    if (savingNow) { text = 'Saving…'; kind = 'unsaved'; }
    else if (lastFailure) { text = 'Save failed — ' + lastFailure; kind = 'failed'; }
    else if (lastSavedAt) { text = 'Saved at ' + formatClock(lastSavedAt); kind = 'saved'; }
    else { text = 'Not saved yet'; kind = 'unsaved'; }
    statusEl.textContent = text;
    statusEl.className = 'planner-save-status is-' + kind;
  }

  function saveNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    let state = null;
    try { state = getState(); } catch (e) { state = null; }
    if (!state) return { ok: true, skipped: true };
    savingNow = true;
    render();
    const result = savePlannerState(state);
    savingNow = false;
    if (result.ok) {
      dirty = false;
      lastFailure = null;
      lastSavedAt = result.savedAt ? new Date(result.savedAt) : new Date();
    } else {
      lastFailure = result.error;
    }
    render();
    return result;
  }

  function scheduleSave() {
    dirty = true;
    if (timer) clearTimeout(timer);
    savingNow = true;
    render();
    timer = setTimeout(function () { timer = null; saveNow(); }, AUTOSAVE_DEBOUNCE_MS);
  }

  // Synchronous. Safe from a pagehide handler.
  function flush() {
    if (!dirty) {
      if (timer) { clearTimeout(timer); timer = null; }
      return { ok: true, skipped: true };
    }
    return saveNow();
  }

  function installUnloadFlush() {
    if (installed) return;
    installed = true;
    window.addEventListener('pagehide', function () { flush(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('beforeunload', function () { flush(); });
  }

  function adoptStoredSavedAt() {
    const iso = readPlannerSavedAt();
    if (!iso) { render(); return false; }
    const d = new Date(iso);
    if (isNaN(d.getTime())) { render(); return false; }
    lastSavedAt = d;
    render();
    return true;
  }

  return {
    scheduleSave: scheduleSave,
    saveNow: saveNow,
    flush: flush,
    installUnloadFlush: installUnloadFlush,
    adoptStoredSavedAt: adoptStoredSavedAt,
    render: render,
    setStatusEl: function (el) { statusEl = el; render(); },
    isDirty: function () { return dirty; }
  };
}
