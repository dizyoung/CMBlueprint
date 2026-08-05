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


// ===========================================================================
// SETUP PROTOTYPE — separate pages, one concern each.
// ===========================================================================
const SETUP_URL = BASE + '/docs/app/setup-prototype.html';
const FEAST_URL = BASE + '/docs/app/feast-prototype.html';
const SKEY = 'cmblueprint.familySchoolMap.v1';

// --- setup page loads cleanly and shows five steps ---
{
  const sp = await browser.newPage();
  const errs = [];
  sp.on('pageerror', e => errs.push(e.message));
  await sp.goto(SETUP_URL);
  await sp.waitForLoadState('networkidle');
  await sp.waitForTimeout(400);
  const steps = await sp.$$eval('.setup-step-btn', els => els.length);
  ok('Setup prototype renders five step indicators', steps === 5);
  const buildLabel = await sp.$eval('span[title="Build identifier"]', el => el.textContent).catch(() => '');
  ok('Setup build label visible', buildLabel.includes('build:setup-prototype'));
  ok('No JavaScript errors on setup prototype page', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await sp.close();
}

// --- adding a student persists across a reload ---
{
  const sp = await browser.newPage();
  const errs = [];
  sp.on('pageerror', e => errs.push(e.message));
  await sp.goto(SETUP_URL);
  await sp.evaluate(k => localStorage.removeItem(k), SKEY);
  await sp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify({
    appStateVersion: 1, students: [], groups: [], subjectColumns: [], cards: []
  })]);
  await sp.goto(SETUP_URL);
  await sp.waitForLoadState('networkidle');
  await sp.waitForTimeout(300);
  await sp.click('[data-action="add-student"]');
  await sp.waitForTimeout(200);
  await sp.fill('[data-action="student-name"]', 'Wren');
  await sp.press('[data-action="student-name"]', 'Tab');
  await sp.waitForTimeout(1400); // autosave debounce
  await sp.goto(SETUP_URL);
  await sp.waitForLoadState('networkidle');
  await sp.waitForTimeout(400);
  const nameAfter = await sp.$eval('[data-action="student-name"]', el => el.value).catch(() => '');
  ok('Adding a student on the setup page persists across a reload', nameAfter === 'Wren');
  ok('No JS errors while adding a student', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await sp.evaluate(k => localStorage.removeItem(k), SKEY);
  await sp.close();
}

// --- a custom group made in Setup shows its members + consequence in the Feast ---
{
  const sp = await browser.newPage();
  const errs = [];
  sp.on('pageerror', e => errs.push(e.message));
  const seed = {
    appStateVersion: 1, subjectColumns: [], cards: [], loops: [], loopItems: [],
    resources: [], resourceUses: [], strandAssignments: [],
    students: [
      { id: 'stu_a', name: 'Wren', active: true, gradeBand: 'form2', gradeBandConfirmed: true, workdays: { mon: true, tue: true, wed: true, thu: true, fri: true } },
      { id: 'stu_b', name: 'Ash', active: true, gradeBand: 'form1', gradeBandConfirmed: true, workdays: { mon: true, tue: true, wed: true, thu: true, fri: true } }
    ],
    groups: []
  };
  await sp.goto(SETUP_URL);
  await sp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(seed)]);
  await sp.goto(SETUP_URL);
  await sp.waitForLoadState('networkidle');
  await sp.waitForTimeout(300);
  // Go to the Groups step and create a custom group with both children.
  await sp.click('[data-action="goto-step"][data-step="groups"]');
  await sp.waitForTimeout(200);
  await sp.click('[data-action="add-group"]');
  await sp.waitForTimeout(200);
  const memberBoxes = await sp.$$('[data-action="group-member"]');
  ok('Custom group offers a member checkbox per active child', memberBoxes.length === 2);
  // The page re-renders after each change, so re-query by index every time.
  for (let i = 0; i < memberBoxes.length; i++) {
    await sp.locator('[data-action="group-member"]').nth(i).click();
    await sp.waitForTimeout(300);
  }
  const memberLine = await sp.$eval('.group-card:not(.fixed-card) .member-line', el => el.textContent).catch(() => '');
  ok('Group members are visible directly under the label', memberLine.includes('Wren') && memberLine.includes('Ash'));
  await sp.waitForTimeout(1400);
  ok('No JS errors while creating a group', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));

  // Now assign a strand to that group on the feast page. Same page (and so the
  // same browser context / localStorage) — a new page would get a fresh, empty
  // storage and silently fall back to the sample plan.
  const fp = sp;
  const fErrs2 = errs;
  await fp.goto(FEAST_URL);
  await fp.waitForLoadState('networkidle');
  await fp.waitForTimeout(400);
  const backLink = await fp.$eval('.toolbar', el => el.innerHTML);
  ok('Feast page links back to Setup', backLink.includes('setup-prototype.html'));
  const setupBanner = await fp.$eval('#setup-banner', el => el.textContent).catch(() => '');
  ok('Feast shows a non-blocking unfinished-setup banner', setupBanner.includes('Setup is not finished'));
  const chipCount = await fp.$$eval('.strand-chip', els => els.length);
  ok('Feast grid still renders under the setup banner (non-blocking)', chipCount > 40);

  const optionTexts = await fp.$$eval('select[data-role="who"] option', els => els.map(e => e.textContent));
  ok('Feast Who select offers an option showing group member names',
     optionTexts.some(t => t.includes('Wren') && t.includes('Ash') && t.includes('—')));

  const groupValue = await fp.$$eval('select[data-role="who"] option',
    els => (els.find(e => e.value.startsWith('group:')) || {}).value);
  ok('A Setup-created group is offered in the feast Who select', !!groupValue);
  if (groupValue) {
    const sel = await fp.$('.strand-chip select[data-role="who"]');
    await sel.selectOption(groupValue);
    await fp.waitForTimeout(400);
    const chipHTML = await fp.$eval('.strand-chip', el => el.textContent);
    ok('Chip shows the chosen group members', chipHTML.includes('Wren') && chipHTML.includes('Ash'));
    ok('Chip shows the consequence sentence', chipHTML.includes('This creates one shared strand for'));
  }
  ok('No JS errors on feast page after a Setup-created group assignment', fErrs2.length === 0);
  if (fErrs2.length) fErrs2.forEach(e => console.log('  JS error:', e));
  await fp.evaluate(k => localStorage.removeItem(k), SKEY);
  await fp.close();
}

// --- setup page survives degenerate saved state ---
{
  const setupDegenerate = [
    ['empty object state', {}],
    ['legacy state with no strandAssignments', {
      students: [{ id: 's1', name: 'Solo', active: true }],
      cards: [], loops: [], loopItems: [], resources: [], resourceUses: [], weeklyRhythm: null
    }]
  ];
  for (const [label, seed] of setupDegenerate) {
    const dp = await browser.newPage();
    const dErrs = [];
    dp.on('pageerror', e => dErrs.push(e.message));
    await dp.goto(SETUP_URL);
    await dp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(seed)]);
    await dp.goto(SETUP_URL);
    await dp.waitForLoadState('networkidle');
    await dp.waitForTimeout(300);
    const steps = await dp.$$eval('.setup-step-btn', els => els.length).catch(() => 0);
    ok('Setup page renders steps with ' + label, steps === 5);
    ok('No JS errors on setup page with ' + label, dErrs.length === 0);
    if (dErrs.length) dErrs.forEach(e => console.log('  JS error:', e));
    await dp.evaluate(k => localStorage.removeItem(k), SKEY);
    await dp.close();
  }
}


// ===========================================================================
// CAPACITY + LOOP SORTING — prototype pages only.
// ===========================================================================

// --- Setup shows a capacity SELECT per weekday, and it persists ---
{
  const cp = await browser.newPage();
  const errs = [];
  cp.on('pageerror', e => errs.push(e.message));
  await cp.goto(SETUP_URL);
  await cp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify({
    appStateVersion: 1, subjectColumns: [], cards: [], loops: [], groups: [],
    students: [{ id: 'stu_c', name: 'Rowan', active: true, gradeBand: 'form2', gradeBandConfirmed: true }]
  })]);
  await cp.goto(SETUP_URL);
  await cp.waitForLoadState('networkidle');
  await cp.waitForTimeout(400);
  await cp.click('[data-action="goto-step"][data-step="family"]');
  await cp.waitForTimeout(300);

  const capSelects = await cp.$$eval('select[data-action="student-capacity"]', els => els.length);
  ok('Setup shows a capacity select per weekday', capSelects === 5);
  const oldCheckboxes = await cp.$$eval('[data-action="student-workday"]', els => els.length).catch(() => 0);
  ok('Setup no longer shows a workday checkbox row', oldCheckboxes === 0);
  const capOptions = await cp.$$eval('select[data-action="student-capacity"] option', els => els.map(e => e.value));
  ok('Capacity select offers the light-independent option', capOptions.includes('light-independent'));

  await cp.selectOption('select[data-action="student-capacity"][data-day="tue"]', 'light-independent');
  await cp.waitForTimeout(1400); // autosave debounce
  await cp.goto(SETUP_URL);
  await cp.waitForLoadState('networkidle');
  await cp.waitForTimeout(400);
  await cp.click('[data-action="goto-step"][data-step="family"]');
  await cp.waitForTimeout(300);
  const tueAfter = await cp.$eval('select[data-action="student-capacity"][data-day="tue"]', el => el.value);
  ok('A changed day capacity persists across a reload', tueAfter === 'light-independent');
  ok('No JS errors while setting a day capacity', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await cp.evaluate(k => localStorage.removeItem(k), SKEY);
  await cp.close();
}

// --- Feast: unsorted panel, put-in-loop, and inline loop creation ---
{
  const lp = await browser.newPage();
  const errs = [];
  lp.on('pageerror', e => errs.push(e.message));
  await lp.goto(FEAST_URL);
  await lp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify({
    appStateVersion: 1, subjectColumns: [], cards: [], loopItems: [], resources: [], resourceUses: [],
    strandAssignments: [], groups: [],
    students: [{ id: 'stu_d', name: 'Wren', active: true, gradeBand: 'form2', gradeBandConfirmed: true }],
    loops: [{ id: 'loop_seed', title: 'Morning basket', itemIds: [], rhythmDayIds: [] }]
  })]);
  await lp.goto(FEAST_URL);
  await lp.waitForLoadState('networkidle');
  await lp.waitForTimeout(500);

  const unsortedHeading = await lp.$eval('#unsorted-panel .section-title', el => el.textContent).catch(() => '');
  ok('Feast shows an "Unsorted / Still to Sort" panel', unsortedHeading.includes('Unsorted / Still to Sort'));
  const countBefore = Number(await lp.$eval('#unsorted-count', el => el.textContent).catch(() => '0'));
  ok('Unsorted panel shows a count in its heading', countBefore > 0);
  const bucketEmpty = await lp.$eval('.loop-bucket', el => el.textContent).catch(() => '');
  ok('An empty loop bucket stays visible and says so', bucketEmpty.includes('No strands sorted in here yet'));

  // "Put in loop" from the Unsorted panel.
  const firstStrand = await lp.$eval('.unsorted-item', el => el.getAttribute('data-strand-id'));
  await lp.selectOption('.unsorted-item select[data-role="unsorted-loop"]', 'loop_seed');
  await lp.waitForTimeout(500);
  const countAfter = Number(await lp.$eval('#unsorted-count', el => el.textContent).catch(() => '0'));
  ok('Putting a strand in a loop removes it from Unsorted', countAfter === countBefore - 1);
  const stillListed = await lp.$$eval('.unsorted-item', els => els.map(e => e.getAttribute('data-strand-id')));
  ok('That strand is no longer in the Unsorted list', !stillListed.includes(firstStrand));
  const bucketNow = await lp.$eval('.loop-bucket[data-loop-id="loop_seed"]', el => el.innerHTML);
  ok('The strand now appears in that bucket\'s list', bucketNow.includes('data-strand-id="' + firstStrand + '"'));
  ok('The bucket no longer reads as empty', !bucketNow.includes('No strands sorted in here yet'));

  // "+ New loop" from Feast Planning, immediately usable everywhere.
  await lp.fill('#new-loop-title', 'Afternoon loop');
  await lp.click('#new-loop-btn');
  await lp.waitForTimeout(500);
  const bucketCount = await lp.$$eval('.loop-bucket', els => els.length);
  ok('"+ New loop" creates a bucket from within Feast Planning', bucketCount === 2);
  const loopOptionTexts = await lp.$$eval('.unsorted-item select[data-role="unsorted-loop"] option', els => els.map(e => e.textContent));
  ok('The new bucket is immediately usable in every loop select', loopOptionTexts.includes('Afternoon loop'));
  const chipLoopSelect = await lp.$$eval('.strand-chip select[data-role="chip-loop"]', els => els.length);
  ok('Every strand chip carries a "Put in loop" select', chipLoopSelect > 40);
  const chipHandles = await lp.$$eval('.strand-chip[data-strand-id]', els => els.length);
  ok('Strand chips carry stable data-strand-id handles', chipHandles > 40);
  ok('No JS errors while sorting strands into loops', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await lp.evaluate(k => localStorage.removeItem(k), SKEY);
  await lp.close();
}

// --- both prototype pages survive {} and legacy state with no dayCapacity ---
{
  const seeds = [
    ['empty object state', {}],
    ['legacy state with no dayCapacity', {
      appStateVersion: 1, subjectColumns: [], cards: [], loops: [], loopItems: [],
      resources: [], resourceUses: [], groups: [], strandAssignments: [],
      students: [{ id: 'legacy_s', name: 'Legacy', active: true, workdays: { mon: true, tue: false, wed: true, thu: true, fri: true } }]
    }]
  ];
  for (const [label, seed] of seeds) {
    for (const [pageName, url, probe] of [['setup', SETUP_URL, '.setup-step-btn'], ['feast', FEAST_URL, '#unsorted-panel']]) {
      const gp = await browser.newPage();
      const gErrs = [];
      gp.on('pageerror', e => gErrs.push(e.message));
      await gp.goto(url);
      await gp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(seed)]);
      await gp.goto(url);
      await gp.waitForLoadState('networkidle');
      await gp.waitForTimeout(400);
      const rendered = await gp.$$eval(probe, els => els.length).catch(() => 0);
      ok(pageName + ' page renders with ' + label, rendered > 0);
      ok('No JS errors on ' + pageName + ' page with ' + label, gErrs.length === 0);
      if (gErrs.length) gErrs.forEach(e => console.log('  JS error:', e));
      await gp.evaluate(k => localStorage.removeItem(k), SKEY);
      await gp.close();
    }
  }
}

// ===========================================================================
// CORRECTIONS 1-3 — prototype layer only.
// ===========================================================================

// --- the light-day opt-in does not make a group-lesson strand eligible ---
{
  const op = await browser.newPage();
  const errs = [];
  op.on('pageerror', e => errs.push(e.message));
  await op.goto(FEAST_URL);
  await op.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify({
    appStateVersion: 1, subjectColumns: [], cards: [], loopItems: [], resources: [], resourceUses: [],
    groups: [{ id: 'g_all', label: 'Everyone group', studentIds: ['stu_o'], active: true }],
    students: [{
      id: 'stu_o', name: 'Alder', active: true, gradeBand: 'form2', gradeBandConfirmed: true,
      dayCapacity: { mon: 'full', tue: 'light-independent', wed: 'full', thu: 'full', fri: 'full' },
      dayCapacityExplicit: { mon: true, tue: true, wed: true, thu: true, fri: true }
    }],
    loops: [], strandAssignments: []
  })]);
  await op.goto(FEAST_URL);
  await op.waitForLoadState('networkidle');
  await op.waitForTimeout(500);

  // Assign one strand to everyone (a group lesson), then tick the opt-in.
  const strandId = await op.$eval('.strand-chip[data-strand-id]', el => el.getAttribute('data-strand-id'));
  await op.selectOption('.strand-chip[data-strand-id="' + strandId + '"] select[data-role="who"]', 'everyone');
  await op.waitForTimeout(400);
  // The work-type line is progressive disclosure — open it first.
  await op.$eval('.strand-chip[data-strand-id="' + strandId + '"] details.chip-worktype', el => { el.open = true; });
  await op.waitForTimeout(200);
  await op.check('.strand-chip[data-strand-id="' + strandId + '"] input[data-role="light-days"]');
  await op.waitForTimeout(1500); // autosave debounce

  const verdict = await op.evaluate(async (sid) => {
    const A = await import('../../lib/familyMapAdapter.mjs');
    const M = await import('../../lib/familyMap.mjs');
    const st = JSON.parse(localStorage.getItem('cmblueprint.familySchoolMap.v1'));
    const sa = (st.strandAssignments || []).find(x => x.strandId === sid);
    const wt = M.resolveWorkTypeForAssignment(sa);
    const el = A.getStudentAvailableDaysForWorkType(st, 'stu_o', wt, { mayOccurOnLightDays: true });
    return { optIn: sa.mayOccurOnLightDays === true, workType: wt, tue: el.byDay.tue.allowed, reason: el.byDay.tue.reason };
  }, strandId);
  ok('Light-day opt-in is recorded on the strand', verdict.optIn === true);
  ok('Opted-in strand resolves to group-lesson work', verdict.workType === 'group-lesson');
  ok('The opt-in does NOT make group-lesson work eligible on a light day', verdict.tue === false);
  ok('The reason explains the opt-in does not cover group lessons',
    /only covers flexible independent work/.test(verdict.reason || ''));
  ok('No JS errors while ticking the light-day opt-in', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await op.evaluate(k => localStorage.removeItem(k), SKEY);
  await op.close();
}

// --- Setup: unsorted next step is informational; "no loops" completes buckets;
//     renaming a loop re-opens bucket review ---
{
  const bp = await browser.newPage();
  const errs = [];
  bp.on('pageerror', e => errs.push(e.message));
  await bp.goto(SETUP_URL);
  await bp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify({
    appStateVersion: 1, subjectColumns: [], cards: [], loops: [], groups: [], strandAssignments: [],
    outsideCommitments: [],
    students: [{ id: 'stu_b', name: 'Juniper', active: true, gradeBand: 'form2', gradeBandConfirmed: true }],
    setupPrototype: { groupsReviewed: true, availabilityReviewed: true }
  })]);
  await bp.goto(SETUP_URL);
  await bp.waitForLoadState('networkidle');
  await bp.waitForTimeout(400);
  await bp.click('[data-action="goto-step"][data-step="rhythm"]');
  await bp.waitForTimeout(300);

  const stepText = await bp.$eval('#step-body', el => el.textContent);
  ok('Setup shows the unsorted next-step sentence',
    /active strands? still needs? a handling decision in Feast Planning\./.test(stepText));
  const errorish = await bp.$$eval('#step-body .notice, #step-body [role="alert"]', els => els.length);
  ok('The unsorted next step is not rendered as an error', errorish === 0);

  // "We will not use loops this year" + confirm completes the bucket step.
  await bp.check('input[data-action="no-loops-chosen"]');
  await bp.waitForTimeout(300);
  await bp.click('[data-action="loop-buckets-reviewed"]');
  await bp.waitForTimeout(300);
  const rhythmDone = await bp.$eval('[data-action="goto-step"][data-step="rhythm"]',
    el => el.className.includes('is-complete'));
  ok('"We will not use loops this year" completes the bucket step with zero loops', rhythmDone);

  await bp.click('[data-action="goto-step"][data-step="review"]');
  await bp.waitForTimeout(300);
  const continueEnabled = await bp.$eval('#continue-to-feast', el => el.tagName === 'A' || !el.disabled);
  ok('Unsorted strands never block the Continue button', continueEnabled);

  // Renaming a loop re-opens bucket review, with no explicit reset anywhere.
  await bp.click('[data-action="goto-step"][data-step="rhythm"]');
  await bp.waitForTimeout(300);
  await bp.click('[data-action="add-loop"]');
  await bp.waitForTimeout(300);
  await bp.click('[data-action="loop-buckets-reviewed"]');
  await bp.waitForTimeout(300);
  const confirmedText = await bp.$eval('#step-body', el => el.textContent);
  ok('Buckets can be confirmed as they are now', confirmedText.includes('Confirmed as they are now.'));
  await bp.fill('input[data-action="loop-title"]', 'Renamed loop bucket');
  await bp.keyboard.press('Tab'); // commit the rename (change fires on blur)
  await bp.waitForTimeout(600);
  const afterRename = await bp.$eval('#step-body', el => el.textContent);
  ok('Renaming a loop re-opens bucket review',
    afterRename.includes('The buckets changed since you confirmed them'));
  const rhythmIncomplete = await bp.$eval('[data-action="goto-step"][data-step="rhythm"]',
    el => el.className.includes('is-incomplete'));
  ok('Bucket review invalidation shows on the step marker', rhythmIncomplete);
  ok('No JS errors while reviewing loop buckets', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await bp.evaluate(k => localStorage.removeItem(k), SKEY);
  await bp.close();
}

// --- both prototype pages survive {} and legacy setupPrototype state ---
{
  const seeds = [
    ['empty object state (post-corrections)', {}],
    ['legacy setupPrototype with loopContentsReviewed + rhythmReviewed', {
      appStateVersion: 1, subjectColumns: [], cards: [], loopItems: [], resources: [], resourceUses: [],
      groups: [], strandAssignments: [], outsideCommitments: [],
      students: [{ id: 'legacy_p', name: 'Legacy', active: true, workdays: { mon: true, tue: false, wed: true, thu: true, fri: true } }],
      loops: [{ id: 'loop_legacy', title: 'Legacy loop', itemIds: [] }],
      setupPrototype: { groupsReviewed: true, rhythmReviewed: true, loopContentsReviewed: true }
    }]
  ];
  for (const [label, seed] of seeds) {
    for (const [pageName, url, probe] of [['setup', SETUP_URL, '.setup-step-btn'], ['feast', FEAST_URL, '#unsorted-panel']]) {
      const gp = await browser.newPage();
      const gErrs = [];
      gp.on('pageerror', e => gErrs.push(e.message));
      await gp.goto(url);
      await gp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(seed)]);
      await gp.goto(url);
      await gp.waitForLoadState('networkidle');
      await gp.waitForTimeout(400);
      const rendered = await gp.$$eval(probe, els => els.length).catch(() => 0);
      ok(pageName + ' page renders with ' + label, rendered > 0);
      ok('No JS errors on ' + pageName + ' page with ' + label, gErrs.length === 0);
      if (gErrs.length) gErrs.forEach(e => console.log('  JS error:', e));
      await gp.evaluate(k => localStorage.removeItem(k), SKEY);
      await gp.close();
    }
  }

  // The legacy plan migrates rather than losing its acknowledgements.
  const mp = await browser.newPage();
  await mp.goto(SETUP_URL);
  const migrated = await mp.evaluate(async () => {
    const A = await import('../../lib/familyMapAdapter.mjs');
    const out = A.migrateSetupPrototypeState({
      loops: [{ id: 'loop_legacy', title: 'Legacy loop' }],
      setupPrototype: { rhythmReviewed: true, loopContentsReviewed: true }
    });
    return {
      sorting: out.setupPrototype.loopSortingReviewed,
      contents: out.setupPrototype.loopContentsReviewed,
      rhythm: out.setupPrototype.rhythmReviewed,
      buckets: A.getLoopSortingProgress(out).bucketsReviewed
    };
  });
  ok('Legacy loopContentsReviewed migrates to loopSortingReviewed', migrated.sorting === true);
  ok('Legacy loopContentsReviewed is preserved', migrated.contents === true);
  ok('Legacy rhythmReviewed is preserved', migrated.rhythm === true);
  ok('A legacy user is not forced to re-confirm unchanged buckets', migrated.buckets === true);
  await mp.close();
}

// --- Availability advisories are calm, and "no loops" vs real buckets ---
{
  const ap = await browser.newPage();
  const errs = [];
  ap.on('pageerror', e => errs.push(e.message));
  const dialogs = [];
  ap.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

  const OFF_WEEK = { mon: 'off', tue: 'off', wed: 'off', thu: 'off', fri: 'off' };
  const ALL_EXPLICIT = { mon: true, tue: true, wed: true, thu: true, fri: true };
  await ap.goto(SETUP_URL);
  await ap.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify({
    appStateVersion: 1, subjectColumns: [], cards: [], loops: [], groups: [], strandAssignments: [],
    outsideCommitments: [],
    students: [{
      id: 'stu_adv', name: 'Juniper', active: true, gradeBand: 'form2', gradeBandConfirmed: true,
      dayCapacity: OFF_WEEK, dayCapacityExplicit: ALL_EXPLICIT
    }],
    setupPrototype: { groupsReviewed: true }
  })]);
  await ap.goto(SETUP_URL);
  await ap.waitForLoadState('networkidle');
  await ap.waitForTimeout(400);

  // A child with zero Full workdays: calm advisory, and Setup still completes.
  await ap.click('[data-action="goto-step"][data-step="availability"]');
  await ap.waitForTimeout(300);
  const advText = await ap.$eval('#step-body', el => el.textContent);
  ok('A child with no full workdays gets the advisory sentence',
    /No full workdays are selected for Juniper\. Independent or outside work may still be planned\./.test(advText));
  const advCalm = await ap.$$eval('#step-body .advisory', els => els.length);
  ok('The advisory renders in calm/informational styling', advCalm === 1);
  const advErrorish = await ap.$$eval('#step-body .notice, #step-body [role="alert"], #step-body .conflict-note', els => els.length);
  ok('The advisory is not rendered as a warning or an error', advErrorish === 0);
  const availDone = await ap.$eval('[data-action="goto-step"][data-step="availability"]',
    el => el.className.includes('is-complete'));
  ok('Zero full workdays still completes the availability step', availDone);

  // "No loops this year" with a real bucket asks first, then sets it aside.
  await ap.click('[data-action="goto-step"][data-step="rhythm"]');
  await ap.waitForTimeout(300);
  await ap.click('[data-action="add-loop"]');
  await ap.waitForTimeout(300);
  ok('A loop bucket can be created from Setup',
    (await ap.$$eval('.loop-card', els => els.length)) === 1);
  dialogs.length = 0;
  await ap.check('input[data-action="no-loops-chosen"]');
  await ap.waitForTimeout(500);
  ok('Ticking "No loops this year" with a bucket asks for confirmation', dialogs.length === 1);
  ok('The confirmation names the bucket and the strand impact',
    /New loop/.test(dialogs[0] || '') && /strand|No strands/.test(dialogs[0] || ''));
  ok('Once accepted, the bucket disappears from the active list',
    (await ap.$$eval('.loop-card', els => els.length)) === 0);
  const asideText = await ap.$eval('#step-body', el => el.textContent);
  ok('Setup says the bucket was set aside, not deleted', /set aside/.test(asideText));

  // Creating a loop while "no loops" is ticked clears the tick.
  ok('"No loops this year" is ticked before creating a bucket',
    (await ap.$eval('input[data-action="no-loops-chosen"]', el => el.checked)) === true);
  await ap.click('[data-action="add-loop"]');
  await ap.waitForTimeout(400);
  ok('Creating a loop clears the "No loops this year" tick',
    (await ap.$eval('input[data-action="no-loops-chosen"]', el => el.checked)) === false);
  ok('The new bucket is listed', (await ap.$$eval('.loop-card', els => els.length)) === 1);
  const noConflict = await ap.$$eval('#step-body .conflict-note', els => els.length);
  ok('No conflict note is shown once the two answers agree', noConflict === 0);

  // The Review step shows the four categories, and never "available days".
  await ap.click('[data-action="loop-buckets-reviewed"]');
  await ap.waitForTimeout(300);
  await ap.click('[data-action="goto-step"][data-step="review"]');
  await ap.waitForTimeout(300);
  const reviewText = await ap.$eval('#step-body', el => el.textContent);
  for (const label of ['Full workdays', 'Light independent days', 'Outside / co-op only', 'Off']) {
    ok('Review step shows the "' + label + '" category', reviewText.includes(label));
  }
  ok('Review step shows the advisory too, calmly', reviewText.includes('No full workdays are selected for'));
  ok('No JS errors through advisories and loop-conflict handling', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));

  // "available days" appears nowhere in parent-facing copy on either page.
  const setupCopy = await ap.$eval('body', el => el.innerText);
  ok('Setup page copy never says "available days"', !/available\s+days|days\s+available/i.test(setupCopy));
  await ap.goto(FEAST_URL);
  await ap.waitForLoadState('networkidle');
  await ap.waitForTimeout(500);
  const feastCopy = await ap.$eval('body', el => el.innerText);
  ok('Feast page copy never says "available days"', !/available\s+days|days\s+available/i.test(feastCopy));
  await ap.evaluate(k => localStorage.removeItem(k), SKEY);
  await ap.close();
}


// --- Set Aside Loops: absent when empty, lists archived buckets, restores ---
{
  const rp = await browser.newPage();
  const errs = [];
  rp.on('pageerror', e => errs.push(e.message));
  rp.on('dialog', async d => { await d.accept(); });

  const baseSeed = () => ({
    appStateVersion: 1, subjectColumns: [], cards: [], loopItems: [],
    resources: [], resourceUses: [], groups: [], outsideCommitments: [],
    students: [{
      id: 'stu_r', name: 'Rowan', active: true, gradeBand: 'form2', gradeBandConfirmed: true,
      dayCapacity: { mon: 'full', tue: 'full', wed: 'full', thu: 'full', fri: 'full' },
      dayCapacityExplicit: { mon: true, tue: true, wed: true, thu: true, fri: true }
    }],
    loops: [], strandAssignments: [],
    setupPrototype: { groupsReviewed: true, availabilityReviewed: true }
  });

  async function loadSetup(seed) {
    await rp.goto(SETUP_URL);
    await rp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(seed)]);
    await rp.goto(SETUP_URL);
    await rp.waitForLoadState('networkidle');
    await rp.waitForTimeout(400);
    await rp.click('[data-action="goto-step"][data-step="rhythm"]');
    await rp.waitForTimeout(300);
  }

  // 1. No archived loops at all — the section must not exist.
  const noneSeed = baseSeed();
  noneSeed.loops = [{ id: 'lp_live', title: 'A bucket in use', active: true, rhythmDayIds: [] }];
  await loadSetup(noneSeed);
  ok('Set Aside Loops is absent when nothing has been set aside',
    (await rp.$$eval('.set-aside-loops', els => els.length)) === 0);

  // 2. An archived, unreferenced bucket: section shows, delete is offered.
  const freeSeed = baseSeed();
  freeSeed.loops = [{ id: 'lp_free', title: 'A set-aside bucket', active: false, rhythmDayIds: ['mon', 'wed'] }];
  freeSeed.setupPrototype.noLoopsChosen = true;
  await loadSetup(freeSeed);
  ok('Set Aside Loops appears when an archived bucket exists',
    (await rp.$$eval('.set-aside-loops', els => els.length)) === 1);
  const asideText2 = await rp.$eval('.set-aside-loops', el => el.textContent);
  ok('Set Aside Loops names the archived bucket', asideText2.includes('A set-aside bucket'));
  ok('Set Aside Loops explains it was set aside, not deleted', /set aside, not deleted/.test(asideText2));
  ok('Set Aside Loops shows the strand count', /0 strands still linked/.test(asideText2));
  ok('An unreferenced archived bucket offers a permanent delete',
    (await rp.$$eval('[data-action="delete-loop-permanently"]', els => els.length)) === 1);

  // 3. Restoring puts the bucket back and re-opens bucket review.
  await rp.click('[data-action="loop-buckets-reviewed"]');
  await rp.waitForTimeout(300);
  ok('Bucket review can be confirmed before restoring',
    (await rp.$eval('#step-body', el => el.textContent)).includes('Confirmed as they are now.'));
  ok('Set Aside Loops starts collapsed',
    (await rp.$eval('.set-aside-loops', el => el.open)) === false);
  await rp.$eval('.set-aside-loops', el => { el.open = true; });
  await rp.click('[data-action="restore-loop"][data-id="lp_free"]');
  await rp.waitForTimeout(400);
  ok('Restoring returns the bucket to the active list',
    (await rp.$$eval('.loop-card:not(.set-aside-card)', els => els.length)) === 1);
  ok('The restored bucket keeps its identity',
    (await rp.$$eval('.loop-card:not(.set-aside-card)', els => els.map(e => e.getAttribute('data-loop-id'))))[0] === 'lp_free');
  ok('Set Aside Loops disappears once the last archived bucket is restored',
    (await rp.$$eval('.set-aside-loops', els => els.length)) === 0);
  ok('Restoring re-opens the bucket review',
    (await rp.$eval('#step-body', el => el.textContent)).includes('please confirm again'));
  ok('Restoring clears "No loops this year"',
    (await rp.$eval('input[data-action="no-loops-chosen"]', el => el.checked)) === false);

  // 4. A referenced archived bucket cannot be deleted permanently.
  const usedSeed = baseSeed();
  usedSeed.loops = [{ id: 'lp_used', title: 'A linked set-aside bucket', active: false, rhythmDayIds: [] }];
  usedSeed.strandAssignments = [
    { id: 'sa_u', strandId: 'strand-x', strandLabel: 'Strand X', assignmentMode: 'loop', loopId: 'lp_used' }
  ];
  usedSeed.setupPrototype.noLoopsChosen = true;
  await loadSetup(usedSeed);
  const usedText = await rp.$eval('.set-aside-loops', el => el.textContent);
  ok('A referenced archived bucket shows the blocked message',
    usedText.includes('This loop is still used by 1 strand or placement. Restore it or move those items first.'));
  ok('A referenced archived bucket offers no permanent delete button',
    (await rp.$$eval('[data-action="delete-loop-permanently"]', els => els.length)) === 0);
  ok('A referenced archived bucket still offers Restore',
    (await rp.$$eval('[data-action="restore-loop"]', els => els.length)) === 1);
  ok('The blocked message names no child, group, or strand',
    !/Rowan|Strand X|strand-x/.test(usedText));

  ok('No JS errors through the set-aside recovery path', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await rp.evaluate(k => localStorage.removeItem(k), SKEY);
  await rp.close();
}


// --- Per-loop set aside, and moving strands out of a set-aside loop ---
{
  const M = await import('../lib/familyMap.mjs');
  const sp = await browser.newPage();
  const errs = [];
  sp.on('pageerror', e => errs.push(e.message));
  sp.on('dialog', async d => { await d.accept(); });

  const STRAND = M.FEAST_LIBRARY[0];
  const seed = () => ({
    appStateVersion: 1, subjectColumns: [], cards: [], loopItems: [],
    resources: [], resourceUses: [], groups: [], outsideCommitments: [],
    students: [{
      id: 'stu_p', name: 'Peri', active: true, gradeBand: 'form2', gradeBandConfirmed: true,
      dayCapacity: { mon: 'full', tue: 'full', wed: 'full', thu: 'full', fri: 'full' },
      dayCapacityExplicit: { mon: true, tue: true, wed: true, thu: true, fri: true }
    }],
    loops: [
      { id: 'lp_one', title: 'First bucket', active: true, rhythmDayIds: [] },
      { id: 'lp_two', title: 'Second bucket', active: true, rhythmDayIds: [] }
    ],
    strandAssignments: [{
      id: 'sa_p', strandId: STRAND.id, strandLabel: STRAND.label,
      assignmentMode: 'loop', loopId: 'lp_one', groupId: null, studentIds: [],
      workType: 'independent', mayOccurOnLightDays: true, notes: '', createdBy: 'feast-prototype'
    }],
    setupPrototype: { groupsReviewed: true, availabilityReviewed: true }
  });

  async function loadPage(url, state) {
    await sp.goto(url);
    await sp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(state)]);
    await sp.goto(url);
    await sp.waitForLoadState('networkidle');
    await sp.waitForTimeout(400);
  }

  await loadPage(SETUP_URL, seed());
  await sp.click('[data-action="goto-step"][data-step="rhythm"]');
  await sp.waitForTimeout(300);
  ok('Setup offers "Set aside this loop" on every active loop card',
    (await sp.$$eval('[data-action="set-aside-loop"]', els => els.length)) === 2);
  ok('The global control reads "Set aside all loop buckets for this year"',
    (await sp.$eval('.global-loop-control', el => el.textContent)).includes('Set aside all loop buckets for this year'));
  ok('The global control sits in its own block, apart from the loop cards',
    (await sp.$$eval('.global-loop-control .loop-card', els => els.length)) === 0);
  ok('Active loop cards link to Feast for strand review',
    (await sp.$$eval('[data-action="review-loop-strands"]', els => els.map(e => e.getAttribute('href'))))[0]
      === './feast-prototype.html#loop=lp_one');

  await sp.click('[data-action="set-aside-loop"][data-id="lp_one"]');
  await sp.waitForTimeout(1000);
  ok('Setting one loop aside leaves the other active',
    (await sp.$$eval('.loop-card:not(.set-aside-card)', els => els.map(e => e.getAttribute('data-loop-id'))))
      .join(',') === 'lp_two');
  ok('The set-aside loop appears under Set Aside Loops',
    (await sp.$$eval('.set-aside-card', els => els.map(e => e.getAttribute('data-loop-id')))).join(',') === 'lp_one');
  ok('Setting one loop aside does not tick the global control',
    (await sp.$eval('input[data-action="no-loops-chosen"]', el => el.checked)) === false);
  ok('A set-aside loop with strands offers "Review and move strands"',
    (await sp.$$eval('.set-aside-card [data-action="review-loop-strands"]', els => els.length)) === 1);
  ok('A set-aside loop with strands offers no permanent delete yet',
    (await sp.$$eval('[data-action="delete-loop-permanently"]', els => els.length)) === 0);

  // Feast: the strand is reachable, and moves without restoring the bucket.
  await sp.goto(FEAST_URL + '#loop=lp_one');
  await sp.waitForLoadState('networkidle');
  await sp.waitForTimeout(500);
  const archText = await sp.$eval('#archived-panel', el => el.textContent);
  ok('Feast shows the "Strands in Set-Aside Loops" panel', archText.includes('Strands in Set-Aside Loops'));
  ok('The set-aside loop is named there', archText.includes('First bucket'));
  ok('Its strand is listed there', archText.includes(STRAND.label));
  ok('The deep link focuses the right group',
    (await sp.$$eval('.archived-group.is-focused', els => els.map(e => e.getAttribute('data-loop-id')))).join(',') === 'lp_one');
  ok('The destination bucket starts empty',
    (await sp.$eval('.loop-bucket[data-loop-id="lp_two"]', el => el.textContent)).includes('0 strands'));

  await sp.selectOption('.archived-group[data-loop-id="lp_one"] select[data-role="archived-move"]', 'lp_two');
  await sp.waitForTimeout(1000);
  ok('Moving the last strand out removes the set-aside group from the panel',
    (await sp.$$eval('.archived-group', els => els.length)) === 0);
  ok('The destination bucket count updates immediately',
    (await sp.$eval('.loop-bucket[data-loop-id="lp_two"]', el => el.textContent)).includes('1 strand'));
  const savedAfterMove = JSON.parse(await sp.evaluate(k => localStorage.getItem(k), SKEY));
  ok('The source loop is still set aside after the move',
    savedAfterMove.loops.find(l => l.id === 'lp_one').active === false);
  ok('Unrelated choices survive the move',
    savedAfterMove.strandAssignments[0].workType === 'independent' &&
    savedAfterMove.strandAssignments[0].mayOccurOnLightDays === true);

  // Back in Setup the now-empty set-aside loop can be deleted for good.
  await sp.goto(SETUP_URL);
  await sp.waitForLoadState('networkidle');
  await sp.waitForTimeout(400);
  await sp.click('[data-action="goto-step"][data-step="rhythm"]');
  await sp.waitForTimeout(300);
  ok('The emptied set-aside loop is still listed in Setup',
    (await sp.$$eval('.set-aside-card', els => els.map(e => e.getAttribute('data-loop-id')))).join(',') === 'lp_one');
  ok('An emptied set-aside loop offers no "Review and move strands"',
    (await sp.$$eval('.set-aside-card [data-action="review-loop-strands"]', els => els.length)) === 0);
  ok('An emptied set-aside loop can now be deleted permanently',
    (await sp.$$eval('[data-action="delete-loop-permanently"]', els => els.length)) === 1);
  await sp.$eval('.set-aside-loops', el => { el.open = true; });
  await sp.click('[data-action="delete-loop-permanently"][data-id="lp_one"]');
  await sp.waitForTimeout(1000);
  ok('The emptied set-aside loop is gone once deleted',
    (await sp.$$eval('.set-aside-card', els => els.length)) === 0);

  ok('No JS errors through the per-loop set-aside and archived-strand move path', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await sp.evaluate(k => localStorage.removeItem(k), SKEY);
  await sp.close();
}


// ===========================================================================
// AUDIENCE/LOOP DECOUPLING + DENSITY - prototype pages only.
// ===========================================================================
{
  const M2 = await import('../lib/familyMap.mjs');
  const vp = await browser.newPage();
  const errs = [];
  vp.on('pageerror', e => errs.push(e.message));
  vp.on('dialog', async d => { await d.accept(); });

  const S1 = M2.FEAST_LIBRARY[0];
  const seed = {
    appStateVersion: 1, subjectColumns: [], cards: [], loopItems: [],
    resources: [], resourceUses: [], outsideCommitments: [],
    students: [{
      id: 'stu_v', name: 'Vesper', active: true, gradeBand: 'form2', gradeBandConfirmed: true,
      dayCapacity: { mon: 'full', tue: 'full', wed: 'full', thu: 'full', fri: 'full' },
      dayCapacityExplicit: { mon: true, tue: true, wed: true, thu: true, fri: true }
    }],
    groups: [{ id: 'grp_v', label: 'A named group', studentIds: ['stu_v'], active: true }],
    loops: [{ id: 'lp_v', title: 'Named bucket', active: true, rhythmDayIds: [] }],
    // One member with an audience, one with none at all.
    strandAssignments: [
      { id: 'sa_v1', strandId: S1.id, strandLabel: S1.label, assignmentMode: 'custom-group', groupId: 'grp_v', loopId: 'lp_v', studentIds: [] },
      { id: 'sa_v2', strandId: M2.FEAST_LIBRARY[1].id, strandLabel: M2.FEAST_LIBRARY[1].label, assignmentMode: 'loop', loopId: 'lp_v', studentIds: [] }
    ],
    setupPrototype: { groupsReviewed: true, availabilityReviewed: true }
  };
  await vp.goto(FEAST_URL);
  await vp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(seed)]);
  await vp.goto(FEAST_URL);
  await vp.waitForLoadState('networkidle');
  await vp.waitForTimeout(500);

  // --- view control
  const currentView = await vp.$eval('#view-controls button.is-current', el => el.textContent);
  ok('Feast view control defaults to Suggested Stacks', currentView === 'Suggested Stacks');
  ok('Feast view control offers all five views',
    (await vp.$$eval('#view-controls button', els => els.length)) === 5);
  ok('Suggested Stacks renders stack sections',
    (await vp.$$eval('.stack-section', els => els.length)) > 5);
  const stacksChips = await vp.$$eval('.strand-chip', els => els.length);
  ok('Suggested Stacks still shows every strand', stacksChips === M2.FEAST_LIBRARY.length);

  await vp.click('#view-controls button[data-view="subject"]');
  await vp.waitForTimeout(300);
  ok('Switching to By Subject changes the view',
    (await vp.$eval('#view-controls button.is-current', el => el.textContent)) === 'By Subject');
  ok('By Subject shows every strand exactly once',
    (await vp.$$eval('.strand-chip', els => els.length)) === M2.FEAST_LIBRARY.length);
  await vp.click('#view-controls button[data-view="unsorted"]');
  await vp.waitForTimeout(300);
  const unsortedChips = await vp.$$eval('.strand-chip', els => els.length);
  ok('Unsorted Only shows fewer strands than the whole feast', unsortedChips < M2.FEAST_LIBRARY.length);
  await vp.click('#view-controls button[data-view="stacks"]');
  await vp.waitForTimeout(300);

  // --- density
  const chipText = await vp.$eval('.strand-chip[data-strand-id="' + S1.id + '"]', el => el.innerText);
  ok('A compact strand card shows its Form and subject family', /Form|All Together/.test(chipText));
  ok('A compact strand card shows its audience', chipText.includes('A named group'));
  const wtSummary = await vp.$eval('.strand-chip[data-strand-id="' + S1.id + '"] details.chip-worktype summary',
    el => el.textContent);
  ok('A compact strand card does not show the work type until expanded',
    !/Group lesson|Independent|Shared with Mom/.test(wtSummary));
  await vp.$eval('.strand-chip[data-strand-id="' + S1.id + '"] details.chip-worktype', el => { el.open = true; });
  await vp.waitForTimeout(200);
  const wtOpen = await vp.$eval('.strand-chip[data-strand-id="' + S1.id + '"] details.chip-worktype', el => el.innerText);
  ok('Expanding a strand card reveals the work type', /Group lesson|Independent|Shared with Mom|not set/.test(wtOpen));

  // --- an audience survives loop membership
  const savedAudience = await vp.evaluate(k => JSON.parse(localStorage.getItem(k)), SKEY);
  ok('A strand in a loop keeps its own audience',
    savedAudience.strandAssignments.find(sa => sa.id === 'sa_v1').assignmentMode === 'custom-group');

  // --- Open <Loop Name> opens the loop detail view
  const openBtn = await vp.$eval('.loop-bucket[data-loop-id="lp_v"] [data-role="open-loop"]', el => el.textContent);
  ok('A loop card offers a prominent "Open <Loop Name>" button', openBtn === 'Open Named bucket');
  ok('The old "Review strands" link is gone from the loop card',
    !(await vp.$eval('.loop-bucket[data-loop-id="lp_v"]', el => el.textContent)).includes('Review strands'));
  await vp.click('.loop-bucket[data-loop-id="lp_v"] [data-role="open-loop"]');
  await vp.waitForTimeout(400);
  const detailText = await vp.$eval('#loop-detail-panel', el => el.innerText);
  ok('Opening a loop shows the loop detail view', detailText.includes('Named bucket'));
  ok('The loop detail names each strand audience beside it', detailText.includes('A named group'));
  ok('The loop detail says which strands have no audience yet', detailText.includes('Audience not chosen yet'));
  ok('The loop detail shows a count of unresolved strands',
    (await vp.$eval('#loop-detail-panel .count-pill', el => el.textContent)).includes('1 with no audience'));
  ok('The loop detail shows the derived audience summary', detailText.includes('Mixed audience') || detailText.includes('A named group'));
  ok('The loop detail suggests related unsorted strands',
    (await vp.$$eval('#loop-detail-panel [data-role="detail-add"]', els => els.length)) > 0);
  ok('The loop detail offers move and remove per strand',
    (await vp.$$eval('#loop-detail-panel [data-role="detail-remove"]', els => els.length)) === 2 &&
    (await vp.$$eval('#loop-detail-panel [data-role="detail-move"]', els => els.length)) === 2);

  // Clicking the card itself opens it too, and inner controls still work.
  await vp.click('#loop-detail-panel [data-role="close-loop"]');
  await vp.waitForTimeout(300);
  ok('The loop detail can be closed',
    (await vp.$eval('#loop-detail-panel', el => el.style.display)) === 'none');
  await vp.click('.loop-bucket[data-loop-id="lp_v"] h3');
  await vp.waitForTimeout(300);
  ok('Clicking the loop card body opens the same detail view',
    (await vp.$eval('#loop-detail-panel', el => el.innerText)).includes('Named bucket'));
  await vp.selectOption('.loop-bucket[data-loop-id="lp_v"] select[data-role="move-loop"]', '__none__');
  await vp.waitForTimeout(600);
  ok('A control inside the loop card still works without the card click swallowing it',
    (await vp.$eval('.loop-bucket[data-loop-id="lp_v"]', el => el.textContent)).includes('1 strand'));

  ok('No JS errors through views, stacks, and the loop detail view', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await vp.evaluate(k => localStorage.removeItem(k), SKEY);
  await vp.close();
}

// --- Setup's loop UI asks for a name and a description, never weekdays ---
{
  const dp = await browser.newPage();
  const errs = [];
  dp.on('pageerror', e => errs.push(e.message));
  await dp.goto(SETUP_URL);
  await dp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify({
    appStateVersion: 1, subjectColumns: [], cards: [], groups: [], strandAssignments: [], outsideCommitments: [],
    students: [{ id: 'stu_w', name: 'Wren', active: true, gradeBand: 'form2', gradeBandConfirmed: true }],
    loops: [{ id: 'lp_w', title: 'Named bucket', active: true, rhythmDayIds: ['mon', 'wed'] }],
    setupPrototype: { groupsReviewed: true, availabilityReviewed: true }
  })]);
  await dp.goto(SETUP_URL);
  await dp.waitForLoadState('networkidle');
  await dp.waitForTimeout(400);
  await dp.click('[data-action="goto-step"][data-step="rhythm"]');
  await dp.waitForTimeout(300);

  ok("Setup's loop UI has no weekday control",
    (await dp.$$eval('.loop-card [data-action="loop-day"]', els => els.length)) === 0);
  ok("Setup's loop UI asks for a name",
    (await dp.$$eval('.loop-card [data-action="loop-title"]', els => els.length)) === 1);
  ok("Setup's loop UI asks for an optional short description",
    (await dp.$$eval('.loop-card [data-action="loop-description"]', els => els.length)) === 1);
  ok('Setup says day placement belongs to the Weekly Rhythm',
    (await dp.$eval('#step-body', el => el.textContent)).includes('Weekly Rhythm, not here'));
  ok('Setup offers a prominent Open button per loop bucket',
    (await dp.$eval('.loop-card [data-action="review-loop-strands"]', el => el.textContent)) === 'Open Named bucket');

  await dp.fill('[data-action="loop-description"]', 'Right after breakfast');
  await dp.keyboard.press('Tab');
  await dp.waitForTimeout(1400);
  const saved = JSON.parse(await dp.evaluate(k => localStorage.getItem(k), SKEY));
  ok('A loop description persists', saved.loops[0].description === 'Right after breakfast');
  ok('Existing rhythmDayIds are preserved untouched',
    JSON.stringify(saved.loops[0].rhythmDayIds) === JSON.stringify(['mon', 'wed']));
  ok('No JS errors on the weekday-free loop bucket UI', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await dp.evaluate(k => localStorage.removeItem(k), SKEY);
  await dp.close();
}

// ---------------------------------------------------------------------------
// Print views prototype — four URLs, one page. Read-only sheets over a plan
// that is built here inline (never a hardcoded family from the fixtures).
// ---------------------------------------------------------------------------
{
  const PRINT_URL = BASE + '/docs/app/print-prototype.html';
  const pp = await browser.newPage();
  const errs = [];
  pp.on('pageerror', e => errs.push(e.message));
  await pp.goto(PRINT_URL);
  await pp.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify({
    appStateVersion: 1, subjectColumns: [], cards: [], outsideCommitments: [],
    students: [{ id: 'stu_w', name: 'Wren', active: true, gradeBand: 'form2', gradeBandConfirmed: true }],
    groups: [{ id: 'grp_m', label: 'Middles', studentIds: ['stu_w'], active: true }],
    loops: [{ id: 'lp_w', title: 'Named bucket', active: true, rhythmDayIds: ['mon'] }],
    strandAssignments: [],
    setupPrototype: {}
  })]);

  for (const view of ['map', 'loops', 'unresolved', 'nextup']) {
    await pp.goto(PRINT_URL + '?view=' + view);
    await pp.waitForLoadState('networkidle');
    await pp.waitForTimeout(300);
    const heading = await pp.$eval('#print-root h1', el => el.textContent).catch(() => '');
    ok('print-prototype ?view=' + view + ' renders its own sheet', heading.length > 0);
    ok('print-prototype ?view=' + view + ' marks its picker entry current',
      (await pp.$$eval('.view-picker a.is-current', els => els.length)) === 1);
  }

  await pp.goto(PRINT_URL + '?view=map');
  await pp.waitForLoadState('networkidle');
  await pp.waitForTimeout(300);
  ok('?view=map groups strands into audience sections',
    (await pp.$$eval('#print-root .print-section', els => els.length)) > 0);
  ok('?view=map has an "Audience not chosen yet" section before anything is decided',
    (await pp.$eval('#print-root', el => el.textContent)).includes('Audience not chosen yet'));

  await pp.goto(PRINT_URL + '?view=nextup');
  await pp.waitForLoadState('networkidle');
  await pp.waitForTimeout(400);
  ok('?view=nextup renders one worksheet per active strand',
    (await pp.$$eval('.worksheet', els => els.length)) > 10);
  ok('?view=nextup renders 20 numbered lines on a worksheet',
    (await pp.$$eval('.worksheet:first-of-type .ws-lines li', els => els.length)) === 20);
  ok('?view=nextup names itself a temporary planning sheet',
    (await pp.$eval('.worksheet .ws-temp', el => el.textContent)).includes('Temporary planning sheet'));

  const printedUnresolved = await (async () => {
    await pp.goto(PRINT_URL + '?view=unresolved');
    await pp.waitForLoadState('networkidle');
    await pp.waitForTimeout(300);
    return pp.$$eval('#print-root .count-pill', els => els.map(e => e.textContent.trim()));
  })();
  ok('?view=unresolved shows three counts', printedUnresolved.length === 3);
  ok('?view=unresolved shows no technical ids',
    !(await pp.$eval('#print-root', el => el.textContent)).includes('feast_'));

  // The same counts must appear in Feast — one report, two readers.
  const fp = await browser.newPage();
  fp.on('pageerror', e => errs.push(e.message));
  await fp.goto(FEAST_URL);
  await fp.waitForLoadState('networkidle');
  await fp.waitForTimeout(500);
  const feastSort = (await fp.$eval('#unsorted-count', el => el.textContent)).trim();
  const feastAudience = (await fp.$eval('#missing-audience-count', el => el.textContent)).trim();
  ok('Feast "Still to sort" count matches the printed Unresolved sheet', feastSort === printedUnresolved[1]);
  ok('Feast "needs an audience" count matches the printed Unresolved sheet', feastAudience === printedUnresolved[0]);

  // A strand toggled off then on keeps the audience it had.
  const toggled = await fp.evaluate(() => {
    const chip = document.querySelector('.strand-chip[data-strand]');
    return chip ? chip.getAttribute('data-strand') : null;
  });
  ok('a strand chip is available to toggle', !!toggled);
  if (toggled) {
    const sel = '.strand-chip[data-strand="' + toggled + '"] select[data-role="who"]';
    const groupValue = await fp.$eval(sel, el => {
      const opt = Array.from(el.options).find(o => o.value.indexOf('group:') === 0);
      return opt ? opt.value : '';
    });
    ok('the Who select offers the family\'s own group', groupValue.length > 0);
    await fp.selectOption(sel, groupValue);
    await fp.waitForTimeout(300);
    // Use-this-year lives behind the chip's disclosure, and every render
    // rebuilds the chip, so the disclosure is opened before each click.
    const useSel = '.strand-chip[data-strand="' + toggled + '"] input[data-role="use"]';
    const openMore = () => fp.$eval('.strand-chip[data-strand="' + toggled + '"] details.chip-more',
      el => { el.open = true; });
    await openMore();
    await fp.uncheck(useSel);
    await fp.waitForTimeout(300);
    await openMore();
    await fp.check(useSel);
    await fp.waitForTimeout(300);
    ok('a strand toggled off then on still shows its original audience',
      (await fp.$eval(sel, el => el.value)) === groupValue);
    ok('and its chip says it is not in a loop',
      (await fp.$eval('.strand-chip[data-strand="' + toggled + '"]', el => el.textContent)).includes('Not in a loop'));
  }
  ok('No JS errors across the print views or the toggle round trip', errs.length === 0);
  if (errs.length) errs.forEach(e => console.log('  JS error:', e));
  await fp.evaluate(k => localStorage.removeItem(k), SKEY);
  await fp.close();
  await pp.close();
}


await browser.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
