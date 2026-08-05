// Family School Map — shared browser save bar.
//
// Small UI glue shared by every app page: load saved state on start, autosave
// after edits (debounced) with a manual "Save now" fallback, a guaranteed
// flush before the page goes away, export/import a plan file, and reset to the
// sample plan. Talks to lib/persistenceBrowser.mjs + lib/persistence.mjs for
// the actual logic; this file only touches the DOM.
//
// Public surface (all backward compatible):
//   createSaveBar({onStateReplaced}) -> {
//     mountControls, wire, scheduleSave, saveNow, setStatus,   // original
//     flush, installUnloadFlush, exportPlan, saveBackupNow      // added
//   }
//   loadInitialState(), APP_STATE_STORAGE_KEY

import {
  loadAppStateFromStorage,
  saveAppStateToStorage,
  readLastSavedAt,
  APP_STATE_STORAGE_KEY
} from '../../lib/persistenceBrowser.mjs';
import {
  loadAppStateSafely,
  buildExportPayload,
  suggestedExportFilename,
  summarizeAppState,
  describeImportSummary,
  formatLocalTimestamp
} from '../../lib/persistence.mjs';
import { buildSampleAppState } from '../../lib/familyMapAdapter.mjs';

const AUTOSAVE_DEBOUNCE_MS = 800;
// Typing pause after which a half-typed text field is committed to the plan.
const TEXT_COMMIT_DEBOUNCE_MS = 800;

function formatClock(date) {
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return date.toISOString();
  }
}

// opts: { onStateReplaced(state, source) } — called whenever state is loaded,
// imported, or reset, so the page can re-render against the new state object.
export function createSaveBar(opts) {
  var onStateReplaced = opts.onStateReplaced;
  var saveTimer = null;
  var textTimer = null;
  var statusEl = null;
  var pendingState = null;      // state captured by the last scheduleSave()
  var getStateFn = null;        // set by wire()/installUnloadFlush()
  var lastSavedAt = null;       // Date of the last successful write
  var lastFailure = null;       // sticky until the next successful save
  var savingNow = false;
  var overrideText = null;      // set by an external setStatus() call
  var overrideKind = null;
  var pendingTextEl = null;     // a text field edited but not yet committed
  // True only between an edit and the write that captures it. flush() checks
  // this so a page that changed nothing can never overwrite what another tab
  // (or a seeded fixture) has since written to storage.
  var dirty = false;
  var commitTextOnInput = false;
  var unloadInstalled = false;

  // -------------------------------------------------------------------------
  // Status — persistent, never transient. The parent should be able to look
  // at this line at any moment and know whether their work is safe.
  // -------------------------------------------------------------------------
  function renderStatus() {
    if (!statusEl) return;
    var text;
    var kind;
    if (savingNow) {
      text = 'Saving…';
      kind = 'unsaved';
    } else if (lastFailure) {
      text = 'Save failed — ' + lastFailure;
      kind = 'failed';
    } else if (lastSavedAt) {
      text = 'Saved at ' + formatClock(lastSavedAt);
      kind = 'saved';
    } else if (overrideText) {
      text = overrideText;
      kind = overrideKind;
    } else {
      text = 'Not saved yet';
      kind = 'unsaved';
    }
    statusEl.textContent = text;
    statusEl.className = 'save-status' + (kind ? ' status-' + kind : '');
  }

  // Kept for backward compatibility: existing pages call this on load with
  // "Saved in this browser" / "Using sample plan". It never overrides a real
  // save result, so it can no longer hide a failure.
  function setStatus(text, kind) {
    overrideText = text;
    overrideKind = kind;
    renderStatus();
  }

  function scheduleSave(state) {
    pendingState = state;
    dirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveNow(pendingState);
    }, AUTOSAVE_DEBOUNCE_MS);
    renderStatus();
  }

  function saveNow(state) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    savingNow = true;
    renderStatus();
    var result = saveAppStateToStorage(state);
    savingNow = false;
    if (result.ok) {
      dirty = false;
      lastFailure = null;
      lastSavedAt = result.savedAt ? new Date(result.savedAt) : new Date();
      overrideText = null;
    } else {
      lastFailure = result.error;
    }
    renderStatus();
    return result;
  }

  // -------------------------------------------------------------------------
  // Never lose an edit.
  //
  // flush() commits any half-typed text field, cancels the debounce, and
  // writes synchronously. Safe to call at any time, including from a
  // pagehide handler, because localStorage writes are synchronous.
  // -------------------------------------------------------------------------
  function commitPendingText(restoreFocus) {
    var el = pendingTextEl;
    pendingTextEl = null;
    if (textTimer) { clearTimeout(textTimer); textTimer = null; }
    if (!el || !el.isConnected) return;

    // Remember where the cursor was so a re-render does not interrupt typing.
    var action = el.getAttribute ? el.getAttribute('data-action') : null;
    var role = el.getAttribute ? el.getAttribute('data-role') : null;
    var id = el.getAttribute ? el.getAttribute('data-id') : null;
    var strand = el.getAttribute ? el.getAttribute('data-strand') : null;
    var selStart = null;
    var selEnd = null;
    try { selStart = el.selectionStart; selEnd = el.selectionEnd; } catch (e) { /* not a text field */ }
    var hadFocus = document.activeElement === el;

    // A focused field is blurred first: that fires the browser's own `change`
    // in the normal order, so the page's re-render never runs while the
    // browser is in the middle of removing the focused node. Dispatching a
    // synthetic change at a focused element instead corrupts the re-render.
    if (hadFocus) {
      try { el.blur(); } catch (e) { /* keep going — the fallback below still runs */ }
    } else {
      try {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        return;
      }
    }

    if (!restoreFocus || !hadFocus) return;
    if (el.isConnected) { try { el.focus(); if (selStart != null) el.setSelectionRange(selStart, selEnd); } catch (e) {} return; }
    // The page re-rendered; find the same field again by its data attributes.
    var parts = [];
    if (action) parts.push('[data-action="' + action + '"]');
    if (role) parts.push('[data-role="' + role + '"]');
    if (id) parts.push('[data-id="' + id + '"]');
    if (strand) parts.push('[data-strand="' + strand + '"]');
    if (!parts.length) return;
    var again = document.querySelector(parts.join(''));
    if (!again) return;
    try {
      again.focus();
      if (selStart != null && typeof again.setSelectionRange === 'function') again.setSelectionRange(selStart, selEnd);
    } catch (e) {}
  }

  function flush() {
    commitPendingText(false);
    // Nothing was edited on this page since the last successful write, so
    // there is nothing to save — and nothing to accidentally overwrite.
    if (!dirty) return { ok: true, skipped: true };
    var state = null;
    try {
      state = getStateFn ? getStateFn() : pendingState;
    } catch (e) {
      state = pendingState;
    }
    if (!state) state = pendingState;
    if (!state) return { ok: true, skipped: true };
    return saveNow(state);
  }

  function isTextField(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag !== 'input') return false;
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    return type === 'text' || type === 'number' || type === 'search' ||
           type === 'url' || type === 'email' || type === 'tel' || type === 'date';
  }

  // Registers the exit handlers once per page. Existing callers get this for
  // free through wire(); pages that never call wire() can call it directly.
  function installUnloadFlush(getState, options) {
    if (getState) getStateFn = getState;
    if (options && options.commitTextOnInput) commitTextOnInput = true;
    if (unloadInstalled) return;
    unloadInstalled = true;

    // pagehide + visibilitychange are far more reliable than beforeunload on
    // mobile and with the back/forward cache, so they do the real work.
    window.addEventListener('pagehide', function () { flush(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    // Belt and braces on desktop. Never sets returnValue, so it never prompts.
    window.addEventListener('beforeunload', function () { flush(); });

    // Any in-page navigation (Setup → Feast, "Open ‹loop›", "Review and move
    // strands", print views) saves first. Capture phase, so it runs before
    // the browser leaves.
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;
      flush();
    }, true);

    // Typing is captured as it happens, not only on blur.
    document.addEventListener('input', function (ev) {
      var el = ev.target;
      if (!isTextField(el)) return;
      pendingTextEl = el;
      dirty = true;
      if (!commitTextOnInput) return;
      if (textTimer) clearTimeout(textTimer);
      textTimer = setTimeout(function () {
        textTimer = null;
        commitPendingText(true);
      }, TEXT_COMMIT_DEBOUNCE_MS);
    }, true);

    document.addEventListener('change', function (ev) {
      if (ev.target === pendingTextEl) {
        pendingTextEl = null;
        if (textTimer) { clearTimeout(textTimer); textTimer = null; }
      }
    }, true);
  }

  // -------------------------------------------------------------------------
  // Export / import
  // -------------------------------------------------------------------------
  function exportPlan(state) {
    var payload = buildExportPayload(state);
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = suggestedExportFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return payload;
  }

  // One action: make sure the browser copy is current AND put a file on disk.
  function saveBackupNow(state) {
    flush();
    var current = state;
    if (!current) { try { current = getStateFn ? getStateFn() : null; } catch (e) { current = null; } }
    if (!current) return null;
    return exportPlan(current);
  }

  // Nothing is replaced until the file has fully passed validation AND the
  // parent has seen a summary of it and confirmed. Any failure path returns
  // without touching state or storage.
  function importPlan(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        window.alert('That file is not a readable plan file (it is not valid JSON).\n\nYour current plan has not been changed.');
        return;
      }
      var result = loadAppStateSafely(parsed);
      if (!result.ok) {
        window.alert('That plan file could not be opened, so nothing was changed:\n\n' + result.errors.join('\n'));
        return;
      }
      var summary = summarizeAppState(result.state, parsed);
      var confirmed = window.confirm(
        describeImportSummary(summary) +
        '\n\nReplace your current browser-saved plan with this file? This cannot be undone.'
      );
      if (!confirmed) return;
      saveNow(result.state);
      onStateReplaced(result.state, 'imported');
    };
    reader.onerror = function () {
      window.alert('That file could not be read. Your current plan has not been changed.');
    };
    reader.readAsText(file);
  }

  function resetToSample() {
    var confirmed = window.confirm('Reset to the sample plan? This will replace your current browser-saved plan. Exported plan files are not affected.');
    if (!confirmed) return;
    var sample = buildSampleAppState();
    saveNow(sample);
    onStateReplaced(sample, 'sample');
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------
  function mountControls(container) {
    container.className = 'save-area';
    container.innerHTML =
      '<div class="save-row">' +
        '<span id="save-status" class="save-status"></span>' +
        '<div class="save-buttons">' +
          '<button id="save-now-btn" type="button">Save now</button>' +
          '<button id="save-backup-btn" type="button">Save backup now</button>' +
          '<button id="export-btn" type="button" class="accent">Export Plan</button>' +
          '<label style="display:inline-flex;align-items:center;gap:6px;">Import Plan' +
          '<input id="import-input" type="file" accept="application/json" style="font-size:12px;"></label>' +
          '<button id="reset-btn" type="button" class="quiet">Reset to sample plan</button>' +
        '</div>' +
      '</div>' +
      '<p class="save-explain" id="save-scope-note"><strong>Saved in this browser only — not synced to other devices or browsers.</strong> ' +
      'Use <em>Save backup now</em> to keep a copy of your plan as a file on this computer.</p>';
    statusEl = container.querySelector('#save-status');
    renderStatus();
  }

  function wire(getState, options) {
    getStateFn = getState;
    document.getElementById('save-now-btn').addEventListener('click', function () { saveNow(getState()); });
    var backupBtn = document.getElementById('save-backup-btn');
    if (backupBtn) backupBtn.addEventListener('click', function () { saveBackupNow(getState()); });
    document.getElementById('export-btn').addEventListener('click', function () { exportPlan(getState()); });
    document.getElementById('import-input').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (file) importPlan(file);
      ev.target.value = '';
    });
    document.getElementById('reset-btn').addEventListener('click', resetToSample);
    installUnloadFlush(getState, options);
  }

  // If a plan was already in this browser, say when it was last written.
  function adoptStoredSavedAt() {
    var iso = readLastSavedAt();
    if (!iso) return false;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    lastSavedAt = d;
    renderStatus();
    return true;
  }

  return {
    mountControls: mountControls,
    wire: wire,
    scheduleSave: scheduleSave,
    saveNow: saveNow,
    setStatus: setStatus,
    flush: flush,
    installUnloadFlush: installUnloadFlush,
    exportPlan: exportPlan,
    // Original name kept so nothing that already calls it breaks.
    exportBackup: exportPlan,
    saveBackupNow: saveBackupNow,
    adoptStoredSavedAt: adoptStoredSavedAt,
    getLastSavedAt: function () { return lastSavedAt; }
  };
}

export function loadInitialState() {
  var result = loadAppStateFromStorage();
  return result;
}

export { APP_STATE_STORAGE_KEY, formatLocalTimestamp };
