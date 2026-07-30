import { chromium } from 'playwright';
const BASE = 'http://localhost:8765';
const URL  = BASE + '/docs/app/family-school-map.html';
let passed = 0; let failed = 0;
function ok(label, val) {
  if (val) { console.log('ok - ' + label); passed++; }
  else      { console.log('FAIL - ' + label); failed++; }
}
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const page    = await browser.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));
await page.goto(URL);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

// --- basic render ---
const activeMode = await page.$eval('#main-tab-bar button.active', el => el.textContent).catch(() => '');
ok('Family School Map is default active mode', activeMode.trim() === 'Family School Map');

// --- tab bar checks ---
const tabBar = await page.$('#main-tab-bar');
ok('Main tab bar is present', !!tabBar);
const combineTabPresent = await page.$eval('#main-tab-bar', el => el.innerHTML.includes('Combine')).catch(() => false);
ok('"Combine & Plan" tab is present in toolbar', combineTabPresent);
const loopBuilderTabPresent = await page.$eval('#main-tab-bar', el => el.innerHTML.includes('Loop Builder')).catch(() => false);
ok('"Loop Builder" tab is present in toolbar', loopBuilderTabPresent);
const clickableCount = await page.$$eval('.res-block-clickable', els => els.length);
ok('Map blocks are clickable', clickableCount > 10);
const cursor = await page.$eval('.res-block-clickable', el => window.getComputedStyle(el).cursor).catch(() => '');
ok('Clickable blocks have cursor:pointer', cursor === 'pointer');
const addBtns = await page.$$eval('.res-add-btn', els => els.length);
ok('+ Add subject buttons present', addBtns > 0);

// --- build label visible ---
const buildLabel = await page.$eval('span[title="Build identifier"]', el => el.textContent).catch(() => '');
ok('Build label visible in toolbar', buildLabel.includes('build:'));
ok('Build label is strand-card-model', buildLabel.includes('strand-card-model'));

// --- TEST A: Family Read-Alouds — click and verify reading order ---
const readaloudBlock = await page.$('.res-block-clickable[onclick*="card_readaloud"]');
ok('Family Read-Alouds block found on map', !!readaloudBlock);
if (readaloudBlock) {
  await readaloudBlock.click();
  await page.waitForTimeout(400);
  const editorOpen = await page.$eval('#card-editor-overlay', el => el.style.display !== 'none');
  ok('Family Read-Alouds editor opens on click', editorOpen);
  const sectionHTML = await page.$eval('#ed-resources-section', el => el.innerHTML).catch(() => '');
  ok('Editor shows "Reading order" heading', sectionHTML.includes('Reading order'));
  ok('Editor does NOT say plain "Sequence"', !sectionHTML.match(/<h3[^>]*>Sequence[^:]/));
  ok('Editor shows The Hobbit', sectionHTML.includes('The Hobbit'));
  ok("Editor shows Charlotte's Web", sectionHTML.includes("Charlotte's Web"));
  ok('Editor shows The Wind in the Willows', sectionHTML.includes('The Wind in the Willows'));
  ok('Editor shows "Current" status badge', sectionHTML.includes('seq-current'));
  ok('Editor shows "Finished" status for completed item', sectionHTML.includes('seq-completed'));
  ok('Editor shows "Up next" status for upcoming item', sectionHTML.includes('seq-upcoming'));
  ok('Editor does NOT say "No resources attached yet"', !sectionHTML.includes('No resources attached yet'));
  ok('Editor uses "reading order" language', sectionHTML.toLowerCase().includes('reading order'));
  // Check Time + rhythm section
  const timingHTML = await page.$eval('#ed-timing-section', el => el.innerHTML).catch(() => '');
  ok('Editor shows Time + rhythm section', timingHTML.includes('Time + rhythm'));
  ok('Editor shows Times per week field', timingHTML.includes('Times per week'));
  ok('Editor shows Lesson length field', timingHTML.includes('Lesson length'));
  ok('Editor shows Rhythm style field', timingHTML.includes('Rhythm style'));
  ok('Editor shows Form applicability section', timingHTML.includes('Form applicability'));
  ok('Editor shows Notes field', timingHTML.includes('Notes'));
  // Check reorder buttons are present
  const reorderBtns = await page.$$eval('.ed-reorder-btn', els => els.length);
  ok('Reading order reorder buttons present', reorderBtns >= 2);
  // Check "Move this subject" language (not "Move this card")
  const overlayHTML = await page.$eval('#card-editor-overlay', el => el.innerHTML).catch(() => '');
  ok('Editor says "Move this subject" (not "Move this card")', overlayHTML.includes('Move this subject') && !overlayHTML.includes('Move this card'));
  // Add a new book to the reading order
  await page.click('#ed-add-seq-item-btn');
  await page.waitForTimeout(200);
  const seqInputs = await page.$$('.ed-seq-title');
  const newTitleInp = seqInputs.length ? seqInputs[seqInputs.length - 1] : null;
  ok('New reading order title input appeared', !!newTitleInp);
  if (newTitleInp) {
    await newTitleInp.fill('The Secret Garden');
    await page.click('#ed-save');
    await page.waitForFunction(() => document.getElementById('map-body')?.innerHTML.includes('The Secret Garden'), null, { timeout: 3000 }).catch(() => {});
    const mapHTML = await page.$eval('#map-body', el => el.innerHTML).catch(() => '');
    ok('The Secret Garden appears in map after save', mapHTML.includes('The Secret Garden'));
  } else {
    await page.click('#ed-cancel');
  }
  await page.waitForTimeout(200);
}

// --- TEST B: Bible Loop ---
const bibleBlock = await page.$('.res-block-clickable[onclick*="card_bible"]');
ok('Bible Loop block found on map', !!bibleBlock);
if (bibleBlock) {
  await bibleBlock.click();
  await page.waitForTimeout(400);
  const sectionHTML = await page.$eval('#ed-resources-section', el => el.innerHTML).catch(() => '');
  ok('Bible Loop editor shows "Loop / rotation" heading', sectionHTML.includes('Loop / rotation'));
  ok('Bible Loop editor shows Matthew', sectionHTML.includes('Matthew'));
  ok('Bible Loop editor shows Psalms + Proverbs', sectionHTML.includes('Psalms + Proverbs'));
  ok('Bible Loop editor shows Theology', sectionHTML.includes('Theology'));
  ok('Bible Loop editor shows Old Testament', sectionHTML.includes('Old Testament'));
  ok('Bible Loop editor does NOT say "No resources attached yet"', !sectionHTML.includes('No resources attached yet'));
  await page.click('#ed-cancel');
  await page.waitForTimeout(200);
}

// --- TEST C: Grammar card with direct resources ---
const grammarBlock = await page.$('.res-block-clickable[onclick*="card_grammar"]');
if (grammarBlock) {
  await grammarBlock.click();
  await page.waitForTimeout(400);
  const sectionHTML = await page.$eval('#ed-resources-section', el => el.innerHTML).catch(() => '');
  ok('Grammar editor opens and shows Resources section', sectionHTML.includes('Resources'));
  await page.click('#ed-cancel');
  await page.waitForTimeout(200);
}

// --- TEST D: + Add subject opens editor ---
const addBtn = await page.$('.res-add-btn');
if (addBtn) {
  await addBtn.click();
  await page.waitForTimeout(300);
  const editorOpen = await page.$eval('#card-editor-overlay', el => el.style.display !== 'none');
  ok('+ Add subject opens editor', editorOpen);
  await page.click('#ed-cancel');
  await page.waitForTimeout(200);
}

// --- TEST E: group block opens group detail ---
const groupBlock = await page.$('.res-block-clickable[onclick*="openGroupDetail"]');
if (groupBlock) {
  await groupBlock.click();
  await page.waitForTimeout(300);
  const overlayOpen = await page.$eval('#group-detail-overlay', el => el.style.display !== 'none');
  ok('Group block opens group detail overlay', overlayOpen);
  await page.click('#gd-close');
  await page.waitForTimeout(200);
}

// --- TEST F: "Other resources" language (not "Additional direct resources") ---
const readaloudBlock2 = await page.$('.res-block-clickable[onclick*="card_readaloud"]');
if (readaloudBlock2) {
  await readaloudBlock2.click();
  await page.waitForTimeout(300);
  const sectionHTML = await page.$eval('#ed-resources-section', el => el.innerHTML).catch(() => '');
  ok('Editor uses "Other resources" (not "Additional direct resources")', !sectionHTML.includes('Additional direct resources'));
  await page.click('#ed-cancel');
  await page.waitForTimeout(200);
}

// --- TEST: Combine & Plan tab ---
const combineTab = await page.$('#main-tab-bar button[data-tab="combine"]');
if (combineTab) {
  await combineTab.click();
  await page.waitForTimeout(400);
  const combinePanel = await page.$eval('#combine-panel', el => el.style.display !== 'none' && el.innerHTML.length > 0).catch(() => false);
  ok('Combine & Plan tab click renders table', combinePanel);
  const combineHTML = await page.$eval('#combine-panel', el => el.innerHTML).catch(() => '');
  ok('Combine & Plan table has thead', combineHTML.includes('<thead'));
  ok('"Not in weekly rhythm yet" appears in Combine & Plan', combineHTML.includes('Not in weekly rhythm yet'));
}

// --- TEST: Loop Builder tab ---
const loopBuilderTab = await page.$('#main-tab-bar button[data-tab="loopbuilder"]');
if (loopBuilderTab) {
  await loopBuilderTab.click();
  await page.waitForTimeout(400);
  const loopPanel = await page.$eval('#loopbuilder-panel', el => el.style.display !== 'none' && el.innerHTML.length > 0).catch(() => false);
  ok('Loop Builder tab click renders content', loopPanel);
  const loopPanelHTML = await page.$eval('#loopbuilder-panel', el => el.innerHTML).catch(() => '');
  ok('Loop Builder shows loop cards', loopPanelHTML.includes('loop-card'));
  ok('Loop Builder shows Bible Loop', loopPanelHTML.includes('Bible Loop'));
  ok('Loop Builder shows Bible Loop with "In weekly rhythm" badge', loopPanelHTML.includes('In weekly rhythm'));
  ok('"Needs placement" does not appear in Loop Builder', !loopPanelHTML.includes('Needs placement'));
}

// --- TEST: placement coverage — Bible Loop cards not in "not placed" list ---
const mapTabCheck = await page.$('#main-tab-bar button[data-tab="map"]');
if (mapTabCheck) {
  await mapTabCheck.click();
  await page.waitForTimeout(300);
  const reviewHTML = await page.$eval('#review-panel', el => el.innerHTML).catch(() => '');
  ok('Review panel does not list Bible as unplaced', !reviewHTML.toLowerCase().includes('bible loop'));
  ok('"Needs placement" does not appear in review panel', !reviewHTML.includes('Needs placement'));
}

// --- Go back to Family School Map ---
const mapTab = await page.$('#main-tab-bar button[data-tab="map"]');
if (mapTab) {
  await mapTab.click();
  await page.waitForTimeout(300);
}

// --- TEST: Planning View panel exists in DOM ---
const planningPanel = await page.$('#planning-view-panel');
ok('Planning View panel exists in DOM', !!planningPanel);

// --- TEST: "Needs placement" does not appear anywhere on the map page ---
const fullPageHTML = await page.evaluate(() => document.body.innerHTML);
ok('"Needs placement" does not appear anywhere on page', !fullPageHTML.includes('Needs placement'));

// --- TEST: Loop Builder shows coverage info for Bible Loop ---
const loopBuilderTab2 = await page.$('#main-tab-bar button[data-tab="loopbuilder"]');
if (loopBuilderTab2) {
  await loopBuilderTab2.click();
  await page.waitForTimeout(400);
  const loopPanelHTML2 = await page.$eval('#loopbuilder-panel', el => el.innerHTML).catch(() => '');
  ok('Loop Builder shows "Covers:" strand coverage info', loopPanelHTML2.includes('Covers:'));
}

// --- TEST: single Feast Prototype link in the toolbar ---
const feastLink = await page.$('#feast-prototype-link');
ok('Feast Prototype link present in toolbar', !!feastLink);
const feastHref = await page.$eval('#feast-prototype-link', el => el.getAttribute('href')).catch(() => '');
ok('Feast Prototype link points at feast-prototype.html', feastHref === './feast-prototype.html');

ok('No JavaScript errors on page', jsErrors.length === 0);
if (jsErrors.length) jsErrors.forEach(e => console.log('  JS error:', e));

// --- Feast prototype page (separate page so map assertions stay independent) ---
const fpage = await browser.newPage();
const fErrors = [];
fpage.on('pageerror', e => fErrors.push(e.message));
await fpage.goto(BASE + '/docs/app/feast-prototype.html');
await fpage.waitForLoadState('networkidle');
await fpage.waitForTimeout(400);

const chipCount = await fpage.$$eval('.strand-chip', els => els.length).catch(() => 0);
ok('Feast grid renders more than 40 strand chips', chipCount > 40);
const badgeText = await fpage.$eval('.proto-badge', el => el.textContent).catch(() => '');
ok('Prototype badge is visible', badgeText.includes('PROTOTYPE') && badgeText.includes('does not change your saved plan'));
const feastBuild = await fpage.$eval('.build-label', el => el.textContent).catch(() => '');
ok('Feast build label visible', feastBuild.includes('build:feast-prototype'));

const previewBefore = await fpage.$eval('#preview-panel', el => el.innerHTML).catch(() => '');
const firstSelect = await fpage.$('.strand-chip select[data-role="who"]');
if (firstSelect) {
  await firstSelect.selectOption('everyone');
  await fpage.waitForTimeout(300);
}
const previewAfter = await fpage.$eval('#preview-panel', el => el.innerHTML).catch(() => '');
ok('Changing one Who select updates the derived card preview', !!firstSelect && previewAfter !== previewBefore);
ok('No JavaScript errors on feast prototype page', fErrors.length === 0);
if (fErrors.length) fErrors.forEach(e => console.log('  JS error:', e));

// --- REGRESSION: the feast grid must survive degenerate saved state ---
// Reported bug: "Cannot read properties of undefined (reading 'some')" left the
// shell painted and the grid empty. Root cause was a stale familyMap.mjs, but
// these guard the state-shaped variants of the same class of crash.
const STATE_KEY = 'cmblueprint.familySchoolMap.v1';
const degenerateStates = [
  ['legacy state with no strandAssignments', {
    students: [{ id: 's1', name: 'Lucy', active: true }],
    cards: [], loops: [], loopItems: [], resources: [], resourceUses: [], weeklyRhythm: null
  }],
  ['assignments missing optional arrays', {
    students: [{ id: 's1', name: 'Lucy', active: true }],
    strandAssignments: [{ id: 'sa1', strandId: 'feast_form1_math_math', assignmentMode: 'individual' }]
  }],
  ['assignments pointing at deleted loops/groups', {
    students: [{ id: 's1', name: 'Lucy', active: true }],
    groups: [], loops: [], loopItems: [], cards: [], resources: [], resourceUses: [],
    weeklyRhythm: { days: [], blocks: [], assignments: [] },
    strandAssignments: [
      { id: 'a', strandId: 'feast_alltogether_bible_newtestament', assignmentMode: 'loop', loopId: 'ghost_loop' },
      { id: 'b', strandId: 'feast_form1_math_math', assignmentMode: 'custom-group', groupId: 'ghost_group' },
      { id: 'c', strandId: 'feast_form2_language-arts_dictation', assignmentMode: 'individual' }
    ]
  }],
  ['empty object state', {}]
];

for (const [label, seed] of degenerateStates) {
  const dpage = await browser.newPage();
  const dErrors = [];
  dpage.on('pageerror', e => dErrors.push(e.message));
  await dpage.goto(BASE + '/docs/app/feast-prototype.html');
  await dpage.evaluate(([k, v]) => localStorage.setItem(k, v), [STATE_KEY, JSON.stringify(seed)]);
  await dpage.goto(BASE + '/docs/app/feast-prototype.html');
  await dpage.waitForLoadState('networkidle');
  await dpage.waitForTimeout(300);
  const dChips = await dpage.$$eval('.strand-chip', els => els.length).catch(() => 0);
  ok('Feast grid renders with ' + label, dChips > 40);
  ok('No JS errors with ' + label, dErrors.length === 0);
  if (dErrors.length) dErrors.forEach(e => console.log('  JS error:', e));
  await dpage.evaluate(k => localStorage.removeItem(k), STATE_KEY);
  await dpage.close();
}

await browser.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
