// Browser smoke test for the Planner Spread prototype.
//
// Serve the repo first, then run this:
//   python3 -m http.server 8765 --directory /home/user/CMBlueprint
//   node tests/smoke-planner.mjs
//
// Every drag here is a REAL pointer drag (mouse.move/down/up, which Chromium
// delivers as pointerdown/pointermove/pointerup), not a synthetic call into
// the page's own functions.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8765';
const URL = BASE + '/docs/app/planner-spread-prototype.html';

const PROTO_KEY = 'cmblueprint.plannerSpreadPrototype.v1';
const PROD_KEY = 'cmblueprint.familySchoolMap.v1';
const OLD_KEY = 'cm_blueprint_data_v3';
const SENTINEL = 'REAL PLAN — MUST NOT BE TOUCHED';

// A fixed week so no assertion depends on the day the suite runs.
// Monday 2026-03-02 .. Friday 2026-03-06, with Thursday OFF.
const MON = '2026-03-02', TUE = '2026-03-03', WED = '2026-03-04',
      THU = '2026-03-05', FRI = '2026-03-06', NEXT_MON = '2026-03-09';

const FIXTURE = {
  schemaVersion: 1,
  weekStartDate: MON,
  schoolDays: { mon: true, tue: true, wed: true, thu: false, fri: true, sat: false },
  tasks: [
    { id: 'a', title: 'Bible reading', who: 'Everyone', date: MON, order: 0, done: false, sourceLabel: null },
    { id: 'b', title: 'Math lesson', who: 'Each child', date: MON, order: 1, done: false, sourceLabel: null },
    { id: 'c', title: 'Nature walk', who: 'Everyone', date: TUE, order: 0, done: false, sourceLabel: null },
    { id: 'd', title: 'Dictation', who: 'Older students', date: WED, order: 0, done: false, sourceLabel: null },
    { id: 'e', title: 'Hymn study', who: 'Everyone', date: WED, order: 1, done: false, sourceLabel: null },
    { id: 'f', title: 'Handicraft', who: 'Everyone', date: FRI, order: 0, done: false, sourceLabel: null }
  ],
  lastShift: null
};

let passed = 0, failed = 0;
function ok(label, val) {
  if (val) { console.log('ok - ' + label); passed++; }
  else { console.log('FAIL - ' + label); failed++; }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));
page.on('console', m => {
  if (m.type() !== 'error') return;
  // The bare directory listing used for seeding asks for /favicon.ico; that
  // 404 is the static server's, not the prototype's.
  if (/favicon/i.test(m.text()) || /404/.test(m.text())) return;
  jsErrors.push('console: ' + m.text());
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Seeding has to happen while the planner page is NOT open: the page flushes
// its own pending autosave on pagehide (by design), which would otherwise
// write the previous state back over the fixture.
async function seed(state) {
  await page.goto(BASE + '/docs/app/');
  await page.evaluate(([k, v, pk, ok2, sentinel]) => {
    localStorage.clear();
    localStorage.setItem(pk, sentinel);
    localStorage.setItem(ok2, sentinel);
    if (v) localStorage.setItem(k, v);
  }, [PROTO_KEY, state ? JSON.stringify(state) : null, PROD_KEY, OLD_KEY, SENTINEL]);
}

async function reload() {
  await page.goto(URL);
  await page.waitForFunction(() => window.__plannerReady === true);
  await page.waitForTimeout(150);
}

async function centre(selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error('no box for ' + selector);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A real pointer drag: press, several moves, release.
async function dragTo(fromSelector, toSelector) {
  const from = await centre(fromSelector);
  const to = await centre(toSelector);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
}

// What is written on each day, read out of the rendered DOM.
async function spread() {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.day-col')).reduce((acc, col) => {
      acc[col.getAttribute('data-date')] =
        Array.from(col.querySelectorAll('.task-line .t-title')).map(el => el.textContent);
      return acc;
    }, {}));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------
// 1 — the page loads and a week spread renders
// ---------------------------------------------------------------------------
await page.goto(URL);
await page.waitForFunction(() => window.__plannerReady === true);
ok('Page loads with no JS errors', jsErrors.length === 0);
if (jsErrors.length) jsErrors.forEach(e => console.log('  JS error: ' + e));

const defaultCols = await page.$$eval('.day-col', els => els.length);
ok('A week spread renders with day columns (Monday to Friday by default)', defaultCols === 5);
const defaultHeads = await page.$$eval('.day-head .weekday', els => els.map(e => e.textContent));
ok('The day columns are the weekdays, written at the top of each page',
  same(defaultHeads, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']));
const seededLines = await page.$$eval('.task-line', els => els.length);
ok('The default seed puts a believable week on the spread', seededLines >= 8);
const grips = await page.$$eval('.day-head', els => els.every(e => getComputedStyle(e).cursor === 'grab'));
ok('Each day heading advertises itself as a grip', grips);
const protoNote = await page.textContent('.proto-note');
ok('The page says plainly that it is a prototype saved separately',
  /prototype/i.test(protoNote) && /separately/i.test(protoNote));

// ---------------------------------------------------------------------------
// 2 — a real pointer drag of ONE task moves it, and nothing else
// ---------------------------------------------------------------------------
await seed(FIXTURE);
await reload();
const start = await spread();
ok('The fixed fixture week renders as written',
  same(start[MON], ['Bible reading', 'Math lesson']) &&
  same(start[WED], ['Dictation', 'Hymn study']) &&
  same(start[THU], []));
ok('Thursday is shown quietly even though it is off',
  await page.$eval('.day-col[data-date="' + THU + '"]', el => el.classList.contains('not-school-day')));

await dragTo('.task-line[data-task-id="a"]', '.day-col[data-date="' + WED + '"] .day-lines');
const afterOne = await spread();
ok('A real pointer drag of one task moves it to the other day',
  same(afterOne[WED], ['Dictation', 'Hymn study', 'Bible reading']));
ok('Dragging one task moves nothing else',
  same(afterOne[MON], ['Math lesson']) && same(afterOne[TUE], ['Nature walk']) &&
  same(afterOne[FRI], ['Handicraft']));
ok('Moving a single task never asks a question', (await page.$('#choice-overlay')) === null);

// ---------------------------------------------------------------------------
// 3 — a drag of a DAY HEADER prompts with both choices
// ---------------------------------------------------------------------------
await seed(FIXTURE);
await reload();
await dragTo('.day-col[data-date="' + MON + '"] .day-head',
             '.day-col[data-date="' + TUE + '"] .day-head');
const overlay = await page.$('#choice-overlay');
ok('Dragging a day heading asks before moving the whole day', !!overlay);
const title = (await page.textContent('#choice-title')) || '';
ok('It asks in plain language, naming the real days', /Move Monday’s work to Tuesday\?/.test(title));
const cascadeText = (await page.textContent('#choice-cascade')) || '';
const stackText = (await page.textContent('#choice-stack')) || '';
ok('Both choices are offered — double up on that day, and bump everything down',
  /Bump everything down/.test(cascadeText) && /Double up on Tuesday/.test(stackText));
ok('Cancel is offered too', !!(await page.$('#choice-cancel')));
const wording = (await page.textContent('#choice-card')) || '';
ok('The words cascade and stack never appear on screen', !/cascade|stack/i.test(wording));
ok('No id is shown anywhere on the spread',
  !/data-task-id"|\bseed-1\b/.test(await page.textContent('body')));

// Cancel really cancels.
await page.click('#choice-cancel');
await page.waitForTimeout(150);
ok('Cancel leaves the week exactly as it was', same(await spread(), start));

// ---------------------------------------------------------------------------
// 4 — "just add to Tuesday" doubles up and moves nothing else
// ---------------------------------------------------------------------------
await dragTo('.day-col[data-date="' + MON + '"] .day-head',
             '.day-col[data-date="' + TUE + '"] .day-head');
await page.click('#choice-stack');
await page.waitForTimeout(200);
const stacked = await spread();
ok('Choosing "just add to Tuesday" doubles the two days up',
  same(stacked[TUE], ['Nature walk', 'Bible reading', 'Math lesson']));
ok('Doubling up moves nothing else in the week',
  same(stacked[MON], []) && same(stacked[WED], ['Dictation', 'Hymn study']) &&
  same(stacked[FRI], ['Handicraft']));
const stackUndo = (await page.textContent('#undo-bar')) || '';
ok('An Undo affordance appears, describing what it will undo in plain words',
  /Moved Monday to Tuesday/.test(stackUndo) && /Undo/.test(stackUndo));
await page.click('#undo-btn');
await page.waitForTimeout(200);
ok('Undo restores the week after doubling up', same(await spread(), start));
ok('Undo is one level only — the affordance goes away once used',
  ((await page.textContent('#undo-bar')) || '').trim() === '');

// ---------------------------------------------------------------------------
// 5 — "flow everything after" cascades, skipping Thursday
// ---------------------------------------------------------------------------
await dragTo('.day-col[data-date="' + MON + '"] .day-head',
             '.day-col[data-date="' + TUE + '"] .day-head');
await page.click('#choice-cascade');
await page.waitForTimeout(250);
const flowed = await spread();
ok('Choosing "flow everything after" lands Monday on Tuesday',
  same(flowed[TUE], ['Bible reading', 'Math lesson']));
ok('Everything after flows forward one school day',
  same(flowed[WED], ['Nature walk']));
ok('Thursday is skipped — Wednesday\'s work flows to Friday, not Thursday',
  same(flowed[THU], []) && same(flowed[FRI], ['Dictation', 'Hymn study']));
ok('Monday is left empty', same(flowed[MON], []));
await page.waitForTimeout(900);   // let the debounced autosave land
const nextMonHeld = await page.evaluate(k => {
  const s = JSON.parse(localStorage.getItem(k));
  return s.tasks.filter(t => t.date === '2026-03-09').map(t => t.title);
}, PROTO_KEY);
ok('Nothing is dropped off the end — Friday\'s work runs into the following week',
  same(nextMonHeld, ['Handicraft']));
const cascadeUndo = (await page.textContent('#undo-bar')) || '';
ok('The Undo affordance names what happened',
  /Moved Monday to Tuesday and flowed everything after/.test(cascadeUndo));

// ---------------------------------------------------------------------------
// 6 — Undo restores a whole-week cascade
// ---------------------------------------------------------------------------
await page.click('#undo-btn');
await page.waitForTimeout(250);
ok('Undo restores the whole week after a cascade', same(await spread(), start));

// ---------------------------------------------------------------------------
// 7 — a reload preserves the result
// ---------------------------------------------------------------------------
await dragTo('.day-col[data-date="' + MON + '"] .day-head',
             '.day-col[data-date="' + TUE + '"] .day-head');
await page.click('#choice-cascade');
await page.waitForTimeout(1200);          // past the autosave debounce
const beforeReload = await spread();
await reloadKeepingStorage();
ok('A reload preserves the result', same(await spread(), beforeReload));
const savedStatus = (await page.textContent('#planner-save-status')) || '';
ok('The save status reads as a real clock time, and stays put',
  /^Saved at /.test(savedStatus) && !/failed/i.test(savedStatus));

async function reloadKeepingStorage() {
  await page.goto(URL);
  await page.waitForFunction(() => window.__plannerReady === true);
  await page.waitForTimeout(150);
}

// ---------------------------------------------------------------------------
// 8 — tapping, adding, done
// ---------------------------------------------------------------------------
await seed(FIXTURE);
await reload();
await page.click('.task-line[data-task-id="c"]');
await page.waitForTimeout(200);
ok('Tapping a task strikes the line through',
  await page.$eval('.task-line[data-task-id="c"]', el => el.classList.contains('is-done')));
await page.click('.day-col[data-date="' + FRI + '"] [data-add-btn]');
await page.fill('input[data-add-on="' + FRI + '"]', 'Composer study');
await page.press('input[data-add-on="' + FRI + '"]', 'Enter');
await page.waitForTimeout(250);
const added = await spread();
ok('A line can be added inline to a day', same(added[FRI], ['Handicraft', 'Composer study']));

// Keyboard fallback: focus a line, press m, pick a day.
await page.focus('.task-line[data-task-id="d"]');
await page.keyboard.press('m');
await page.waitForTimeout(150);
const panel = (await page.textContent('#move-panel')) || '';
ok('A keyboard fallback offers a destination for the focused line', /Move “Dictation”/.test(panel));
await page.click('#move-panel [data-move-to="' + TUE + '"]');
await page.waitForTimeout(250);
ok('The keyboard fallback really moves the line',
  same((await spread())[TUE], ['Nature walk', 'Dictation']));

// ---------------------------------------------------------------------------
// 9 — the production keys are untouched after a full session
// ---------------------------------------------------------------------------
await page.waitForTimeout(900);
const keys = await page.evaluate(() => Object.keys(localStorage).sort());
ok('Only the prototype\'s own keys were written',
  same(keys, [OLD_KEY, PROD_KEY, PROTO_KEY, PROTO_KEY + '.savedAt'].sort()));
if (!same(keys, [OLD_KEY, PROD_KEY, PROTO_KEY, PROTO_KEY + '.savedAt'].sort())) console.log('  keys: ' + keys.join(', '));
const prod = await page.evaluate(([a, b]) => [localStorage.getItem(a), localStorage.getItem(b)], [PROD_KEY, OLD_KEY]);
ok('The production storage key is byte-identical after a full session',
  prod[0] === SENTINEL && prod[1] === SENTINEL);

ok('No JS errors anywhere in the planner suite', jsErrors.length === 0);
if (jsErrors.length) jsErrors.forEach(e => console.log('  JS error: ' + e));

await browser.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
