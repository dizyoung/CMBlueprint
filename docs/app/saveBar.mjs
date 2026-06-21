// Family School Map — Phase 1C shared browser save bar.
//
// Small UI glue shared by both app pages: load saved state on start, autosave
// after edits (debounced) with a manual "Save now" fallback, export/import
// backup JSON, and reset to the sample plan. Talks to lib/persistenceBrowser.mjs
// + lib/persistence.mjs for the actual logic; this file only touches the DOM.

import { loadAppStateFromStorage, saveAppStateToStorage, APP_STATE_STORAGE_KEY } from '../../lib/persistenceBrowser.mjs';
import { loadAppStateSafely, buildExportPayload, suggestedExportFilename } from '../../lib/persistence.mjs';
import { buildSampleAppState } from '../../lib/familyMapAdapter.mjs';

const AUTOSAVE_DEBOUNCE_MS = 800;

// opts: { onStateReplaced(state, source) } — called whenever state is loaded,
// imported, or reset, so the page can re-render against the new state object.
export function createSaveBar(opts) {
  var onStateReplaced = opts.onStateReplaced;
  var saveTimer = null;
  var statusEl = null;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function scheduleSave(state) {
    setStatus('Unsaved changes…');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveNow(state); }, AUTOSAVE_DEBOUNCE_MS);
  }

  function saveNow(state) {
    setStatus('Saving…');
    var result = saveAppStateToStorage(state);
    setStatus(result.ok ? 'Saved in this browser' : 'Save failed — ' + result.error);
  }

  function exportBackup(state) {
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
  }

  function importBackup(file, currentState) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        window.alert('That file is not a readable backup (not valid JSON).');
        return;
      }
      var result = loadAppStateSafely(parsed);
      if (!result.ok) {
        window.alert('That backup could not be opened:\n\n' + result.errors.join('\n'));
        return;
      }
      var confirmed = window.confirm('Replace your current browser-saved plan with this backup? This cannot be undone.');
      if (!confirmed) return;
      saveNow(result.state);
      onStateReplaced(result.state, 'imported');
    };
    reader.onerror = function () {
      window.alert('That file could not be read.');
    };
    reader.readAsText(file);
  }

  function resetToSample() {
    var confirmed = window.confirm('Reset to the sample plan? This will replace your current browser-saved plan. Exported backups are not affected.');
    if (!confirmed) return;
    var sample = buildSampleAppState();
    saveNow(sample);
    onStateReplaced(sample, 'sample');
  }

  function mountControls(container) {
    container.className = 'save-area';
    container.innerHTML =
      '<div class="save-row">' +
        '<span id="save-status" class="save-status"></span>' +
        '<div class="save-buttons">' +
          '<button id="save-now-btn" type="button">Save now</button>' +
          '<button id="export-btn" type="button" class="accent">Export Backup</button>' +
          '<label style="display:inline-flex;align-items:center;gap:6px;">Import Backup' +
          '<input id="import-input" type="file" accept="application/json" style="font-size:12px;"></label>' +
          '<button id="reset-btn" type="button" class="quiet">Reset to sample plan</button>' +
        '</div>' +
      '</div>' +
      '<p class="save-explain">Saved in this browser as you go. Export a backup if you want to protect your work or move it to another device.</p>';
    statusEl = container.querySelector('#save-status');
  }

  function wire(getState) {
    document.getElementById('save-now-btn').addEventListener('click', function () { saveNow(getState()); });
    document.getElementById('export-btn').addEventListener('click', function () { exportBackup(getState()); });
    document.getElementById('import-input').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (file) importBackup(file, getState());
      ev.target.value = '';
    });
    document.getElementById('reset-btn').addEventListener('click', resetToSample);
  }

  return {
    mountControls: mountControls,
    wire: wire,
    scheduleSave: scheduleSave,
    saveNow: saveNow,
    setStatus: setStatus
  };
}

export function loadInitialState() {
  var result = loadAppStateFromStorage();
  return result;
}

export { APP_STATE_STORAGE_KEY };
