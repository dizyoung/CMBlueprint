// Browser smoke test for the Card Table prototype.
//
//   python3 -m http.server 8765 --directory /home/user/CMBlueprint
//   node tests/smoke-cardtable.mjs
//
// Deliberately its own file: this prototype must stay isolated from the
// production suites, and nothing here may touch the production storage key.

import { chromium } from 'playwright';

const BASE = 'http://localhost:8765';
const URL = BASE + '/docs/app/card-table-prototype.html';
const KEY = 'cmblueprint.cardTablePrototype.v1';
const PROD_KEY = 'cmblueprint.familySchoolMap.v1';

let passed = 0;
let failed = 0;
function ok(label, val) {
  if (val) { console.log('ok - ' + label); passed++; }
  else { console.log('FAIL - ' + label); failed++; }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message));

await page.goto(URL);
await page.waitForLoadState('networkidle');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(300);

// --- renders ---------------------------------------------------------------
ok('Page loads with no JS errors', jsErrors.length === 0);
if (jsErrors.length) jsErrors.forEach((e) => console.log('  JS error:', e));

const cardText = await page.$$eval('.card', (els) => els.map((e) => e.textContent));
ok('Form I Science card renders', cardText.some((t) => t.includes('Form I') && t.includes('Science')));
ok('Form II Science card renders', cardText.some((t) => t.includes('Form II') && t.includes('Science')));
ok('Form III Science card renders', cardText.some((t) => t.includes('Form III') && t.includes('Science')));

const loopNames = await page.$$eval('.zone-loop h2', (els) => els.map((e) => e.textContent.trim()));
ok('Both loop containers render', loopNames.includes('Thinking') && loopNames.includes('Beauty'));
const trayBooks = await page.$$eval('#tray-items .book', (els) => els.length);
ok('Four books sit in the tray', trayBooks === 4);

// --- pointer drag: Form I onto Form II ------------------------------------
async function dragTo(fromSel, toSel) {
  const a = await page.$(fromSel);
  const b = await page.$(toSel);
  await a.scrollIntoViewIfNeeded();
  await b.scrollIntoViewIfNeeded();
  const ab = await a.boundingBox();
  const bb = await b.boundingBox();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await page.mouse.down();
  await page.mouse.move(ab.x + ab.width / 2 + 20, ab.y + ab.height / 2 + 20, { steps: 5 });
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 });
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

await dragTo('[data-card-id="card-form1-science"]', '[data-card-id="card-form2-science"]');

const stackCount = await page.$$eval('.stack', (els) => els.length);
ok('Dragging one card onto another produces a stack', stackCount === 1);

const summary = await page.$eval('.stack-pile', (el) => el.textContent).catch(() => '');
ok('The stack shows Together', summary.includes('Together'));
ok('The stack names both Forms', summary.includes('Forms I + II'));
ok('The collapsed stack offers Open', summary.includes('Open'));
ok('No raw IDs are shown to the parent', !summary.includes('stack-') && !summary.includes('card-'));

// --- regression: a collapsed stack is ONE visual object -------------------
ok('Exactly one stack object renders', (await page.$$eval('[data-stack-id]', (els) => els.length)) === 1);
ok('No separate summary card is rendered beneath the pile',
  (await page.$$eval('.stack-summary', (els) => els.length)) === 0);
ok('The pile title is the subject, not a member card',
  (await page.$eval('.pile-title', (el) => el.textContent.trim())) === 'Science');

const pageText = () => page.evaluate(() => document.body.innerText + ' ' +
  Array.from(document.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')).join(' '));
let pt = await pageText();
ok('The concatenated "Form N Subject" label appears nowhere',
  !/Form\s+(I|II|III)\s+Science/.test(pt));
ok('No member card titles show inside the collapsed pile',
  !summary.includes('Form I Science') && !summary.includes('Form II Science'));
ok('An unassigned loop prints no loop line at all', !summary.includes('No loop yet'));
ok('Needs names the open decisions, not a count',
  summary.includes('Needs: ') && summary.includes('loop') && summary.includes('shared resource'));
ok('No bare "N still to decide" count anywhere', !/\d+ still to decide/.test(pt));

const tableText = await page.$eval('#table-items', (el) => el.textContent);
ok('A stacked card is never duplicated in On the table',
  (await page.$$eval('#table-items > div > .card[data-card-id="card-form1-science"]', (els) => els.length)) === 0 &&
  (await page.$$eval('#table-items > div > .card[data-card-id="card-form2-science"]', (els) => els.length)) === 0 &&
  tableText.includes('Form III'));

const model = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
ok('Model: the stack holds both card IDs', model.stacks.length === 1 && model.stacks[0].cardIds.length === 2);
ok('Model: both cards carry the stackId', model.cards.filter((c) => c.stackId === model.stacks[0].id).length === 2);

// --- persistence across reload --------------------------------------------
await page.evaluate(() => window.__cardTable.flush());
await page.waitForTimeout(200);
const savedRaw = await page.evaluate((k) => localStorage.getItem(k), KEY);
ok('The table is written to its own namespaced key', !!savedRaw && savedRaw.includes('"schemaVersion":1'));
ok('The production planner key is never written', (await page.evaluate((k) => localStorage.getItem(k), PROD_KEY)) === null);

const statusText = await page.$eval('#save-status', (el) => el.textContent);
ok('Save status reports a real clock time', /^Saved at /.test(statusText));

await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(300);
const afterCount = await page.$$eval('.stack', (els) => els.length);
ok('The stack survives a reload', afterCount === 1);
const afterSummary = await page.$eval('.stack-pile', (el) => el.textContent).catch(() => '');
ok('The reloaded stack still reads Together', afterSummary.includes('Together'));
ok('Reload preserves the corrected rendering',
  afterSummary.includes('Forms I + II') && afterSummary.includes('Needs: ') &&
  (await page.$eval('.pile-title', (el) => el.textContent.trim())) === 'Science' &&
  (await page.$$eval('.stack-summary', (els) => els.length)) === 0 &&
  !/Form\s+(I|II)\s+Science/.test(await pageText()));

// --- the rest of the success path -----------------------------------------
await page.click('.stack-pile button[data-action="open"]');
await page.waitForTimeout(200);
ok('Open reveals the expanded pile', (await page.$$('.stack-open')).length === 1);
ok('Open does not create a second object for the same stack',
  (await page.$$eval('[data-stack-id]', (els) => els.length)) === 1);

const openCards = await page.$$eval('.stack-open .card', (els) => els.map((e) => ({
  subject: e.querySelector('.subject').textContent.trim(),
  form: e.querySelector('.form').textContent.trim()
})));
ok('Expanded member cards read subject then Form',
  openCards.length === 2 && openCards.every((c) => c.subject === 'Science') &&
  openCards.some((c) => c.form === 'Form I') && openCards.some((c) => c.form === 'Form II'));
ok('Expanded member cards are not duplicated on the table',
  (await page.$$eval('#table-items > div > .card', (els) => els.length)) === 4);

// Form III is added by dropping it on a card inside the open pile.
await dragTo('[data-card-id="card-form3-science"]', '.stack-open [data-card-id="card-form1-science"]');
let m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
ok('Form III can be added to the open pile', m.stacks[0].cardIds.length === 3);

await page.click('.rel-toggle button[data-rel="layered"]');
await page.waitForTimeout(150);
m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
ok('The pile can be set to Layered', m.stacks[0].relationship === 'layered');

await dragTo('#tray-items [data-res-id="res-handbook"]', '.stack-open .shared-area');
m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
const handbook = m.resources.find((r) => r.id === 'res-handbook');
ok('Handbook of Nature Study attaches to the whole pile', handbook.attachedToStackId === m.stacks[0].id && handbook.attachedToCardId === null);

await dragTo('#tray-items [data-res-id="res-form3-text"]', '.stack-open [data-card-id="card-form3-science"]');
m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
const f3 = m.resources.find((r) => r.id === 'res-form3-text');
ok('Form III science text attaches to Form III alone', f3.attachedToCardId === 'card-form3-science' && f3.attachedToStackId === null);
ok('No book ever has two homes', m.resources.every((r) => !(r.attachedToStackId && r.attachedToCardId)));

await page.click('.rel-toggle button[data-action="close"]');
await page.waitForTimeout(150);
await dragTo('.stack .stack-pile', '.zone-loop[data-loop-id="loop-thinking"] h2');
m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
ok('The whole pile drags into Thinking', m.stacks[0].loopId === 'loop-thinking');
ok('Moving the pile did not break it up', m.stacks[0].cardIds.length === 3);

await dragTo('.stack .stack-pile', '.zone-loop[data-loop-id="loop-beauty"] h2');
m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
ok('The whole pile moves on to Beauty, unbroken', m.stacks[0].loopId === 'loop-beauty' && m.stacks[0].cardIds.length === 3);

const beautyText = await page.$eval('.zone-loop[data-loop-id="loop-beauty"]', (el) => el.textContent);
ok('The collapsed pile reads at a glance inside Beauty',
  beautyText.includes('Science') && beautyText.includes('Layered') && beautyText.includes('Beauty') && beautyText.includes('1 shared book'));

await page.evaluate(() => window.__cardTable.flush());
await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(300);
m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
ok('After refresh: the pile is still Layered, in Beauty, with three Forms',
  m.stacks.length === 1 && m.stacks[0].relationship === 'layered' && m.stacks[0].loopId === 'loop-beauty' && m.stacks[0].cardIds.length === 3);
ok('After refresh: the shared and Form-specific books are both preserved',
  m.resources.find((r) => r.id === 'res-handbook').attachedToStackId === m.stacks[0].id &&
  m.resources.find((r) => r.id === 'res-form3-text').attachedToCardId === 'card-form3-science');

// --- a card can come back out of the pile ---------------------------------
await page.click('.stack-pile button[data-action="open"]');
await page.waitForTimeout(200);
await page.click('.form-col button[data-action="unstack"]');
await page.waitForTimeout(200);
m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
ok('Taking a card out of the pile leaves the rest intact', m.stacks[0].cardIds.length === 2);

// Dragging a member card out while expanded removes only that card.
const dragged = m.stacks[0].cardIds[1];
const kept = m.stacks[0].cardIds[0];
const cardCountBefore = m.cards.length;
await dragTo('.stack-open [data-card-id="' + dragged + '"]', '#zone-table h2');
await page.waitForTimeout(200);
m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cardTable.state)));
ok('Dragging a member out while expanded removes only that card',
  m.cards.find((c) => c.id === dragged).stackId === null &&
  !!m.cards.find((c) => c.id === kept) && m.cards.length === cardCountBefore);
ok('The last card left behind is a loose card, not an orphan stack',
  m.stacks.length === 0 && m.cards.find((c) => c.id === kept).stackId === null &&
  (await page.$$eval('[data-stack-id]', (els) => els.length)) === 0);

ok('Still no JS errors at the end of the run', jsErrors.length === 0);
if (jsErrors.length) jsErrors.forEach((e) => console.log('  JS error:', e));

await ctx.close();
await browser.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
