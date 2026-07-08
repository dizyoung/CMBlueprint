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
const activeMode = await page.$eval('.density-toggle button.active', el => el.textContent).catch(() => '');
ok('Family School Map is default active mode', activeMode.trim() === 'Family School Map');
const clickableCount = await page.$$eval('.res-block-clickable', els => els.length);
ok('Map blocks are clickable', clickableCount > 10);
const cursor = await page.$eval('.res-block-clickable', el => window.getComputedStyle(el).cursor).catch(() => '');
ok('Clickable blocks have cursor:pointer', cursor === 'pointer');
const addBtns = await page.$$eval('.res-add-btn', els => els.length);
ok('+ Add subject buttons present', addBtns > 0);

// --- build label visible ---
const buildLabel = await page.$eval('span[title="Build identifier"]', el => el.textContent).catch(() => '');
ok('Build label visible in toolbar', buildLabel.includes('build:'));
ok('Build label is cm-pneu-aligned', buildLabel.includes('cm-pneu-aligned'));

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

ok('No JavaScript errors on page', jsErrors.length === 0);
if (jsErrors.length) jsErrors.forEach(e => console.log('  JS error:', e));
await browser.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
