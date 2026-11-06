// Shared helpers for the browser-based concurrency tests. Each test drives
// one or more real headless Chromium tabs against the real app (via
// test-harness.html + mock-firebase.js), so these exercise actual DOM/event
// paths, not a simulation of them.
import puppeteer from 'puppeteer';

export const PORT = parseInt(process.env.HEXMAP_TEST_PORT || '8791', 10);
export const BASE = `http://localhost:${PORT}/tests/test-harness.html`;
export const DEFAULT_MOCK_DELAY = 800;

export async function launchBrowser() {
  return puppeteer.launch({ headless: 'new', protocolTimeout: 60000 });
}

// Seeds the mock "server" (localStorage) before any of the page's own
// scripts run, via evaluateOnNewDocument — so by the time subscribeToChars()
// etc. do their first read, the data is already there.
async function seedPage(page, tree) {
  await page.evaluateOnNewDocument(s => localStorage.setItem('__mockFirebaseDB__', s), JSON.stringify(tree));
}

// Opens the inventory view for a given test user. `seedTree`, if provided,
// is written to the shared mock DB before navigation (pass it once per test
// — from whichever page opens first — not on every page, or you'll wipe out
// what the first page already wrote).
export async function openCharInventory(page, { testUid, testName, mockDelay = DEFAULT_MOCK_DELAY, seedTree, silenceKnownErrors = true }) {
  if (silenceKnownErrors) {
    // Swallows a pre-existing, unrelated TDZ crash in the root hexmap
    // script.js ('panX'/'latestInspectorHex' before initialization) that
    // has nothing to do with the inventory code under test here — see
    // tests/README.md for details. Leave this off if you're specifically
    // investigating page errors.
    page.on('pageerror', () => {});
  }
  if (seedTree) await seedPage(page, seedTree);
  await page.goto(`${BASE}?testUid=${testUid}&testName=${testName || testUid}&mockDelay=${mockDelay}`);
  await new Promise(r => setTimeout(r, 500));
  // Force-hides the login overlay — a workaround for the same pre-existing
  // TDZ crash mentioned above sometimes stopping root script.js before it
  // reaches the auth listener that normally hides this. Only patches the
  // test harness's view, not the app code under test.
  await page.evaluate(() => document.getElementById('login-screen')?.classList.add('hidden'));
  await page.evaluate(() => document.getElementById('hamburger-btn').click());
  await page.evaluate(() => document.getElementById('menu-inventory-btn').click());
  await new Promise(r => setTimeout(r, 500));
  await page.waitForSelector('#char-name');
}

// Opens the Character (stats/features/notes) panel — separate from the
// inventory-grid view opened by openCharInventory.
export async function openCharacterStats(page) {
  await page.evaluate(() => document.getElementById('hamburger-btn').click());
  await page.evaluate(() => document.getElementById('menu-character-btn').click());
  await new Promise(r => setTimeout(r, 500));
  await page.waitForSelector('#stats-panel');
}

// Spends one use of a feature that renders a use-stepper (e.g. barbarian-rage)
// by clicking its '−' button. Requires openCharacterStats() first.
export async function spendFeatureUse(page, featureId) {
  await page.evaluate(id => {
    document.querySelector(`.cs-feature[data-feature-id="${id}"] .cs-use-btn`).click();
  }, featureId);
}

// Expands the Notes section (collapsed by default) and edits a note's body
// by index. Requires openCharacterStats() first.
export async function editNoteBody(page, idx, text) {
  await page.evaluate(() => document.getElementById('cs-notes-toggle')?.click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate((idx, text) => {
    const ta = document.querySelector(`#cs-notes-list .cs-notes-entry-row[data-idx="${idx}"] .cs-notes-entry`);
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, idx, text);
}

// Edits a manually-added attack row's damage field by its stable id
// (state.attacks[i].id). Requires openCharacterStats() first.
export async function editAttackDamage(page, attackId, text) {
  await page.evaluate((attackId, text) => {
    const row = document.querySelector(`.cs-attack-row[data-attack-key="manual:${attackId}"]`);
    const input = row.querySelector('input[placeholder="1d6"]');
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, attackId, text);
}

export async function openShop(page) {
  await page.evaluate(() => document.getElementById('shop-tab-btn').click());
  await new Promise(r => setTimeout(r, 500));
  await page.waitForSelector('.shop-item-row');
}

export async function openCoinInspectorAt(page, containerId, r, c) {
  await page.evaluate((containerId, r, c) => {
    document.querySelector(`[data-container-id="${containerId}"][data-r="${r}"][data-c="${c}"] .slot-label`).click();
  }, containerId, r, c);
  await new Promise(res => setTimeout(res, 200));
  await page.waitForSelector('.insp-num-coin[data-k="gp"]');
}

// Drives the real long-press drag-and-drop gesture (380ms hold, then move,
// matching the app's own threshold in inventory/script.js) to give an item
// from the currently-open character to another character's tab. Real
// synthetic mouse events — Chrome surfaces these as PointerEvents with
// pointerType 'mouse', which is what the app's drag handlers listen for.
async function elementCenter(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
}

async function dragBetween(page, srcSelector, targetSelector) {
  const srcBox = await elementCenter(page, srcSelector);
  const tgtBox = await elementCenter(page, targetSelector);
  await page.mouse.move(srcBox.x, srcBox.y);
  await page.mouse.down();
  await new Promise(r => setTimeout(r, 450)); // past the 380ms long-press threshold, no movement yet
  await page.mouse.move(tgtBox.x, tgtBox.y, { steps: 10 });
  await page.mouse.up();
}

export async function dragItemToCharTab(page, { containerId, r, c, targetCharId }) {
  await dragBetween(page,
    `[data-container-id="${containerId}"][data-r="${r}"][data-c="${c}"]`,
    `[data-char-id="${targetCharId}"]`);
}

// Drags an existing "For Sale" DM listing row onto a character's tab — the
// app's "buy/claim this listing" gesture, which removes it from
// /inventory_dm_listings the same way dropping it in the trash would.
// Requires openShop() first.
export async function dragListingToCharTab(page, { itemName, targetCharId }) {
  const rowSelector = await page.evaluate(name => {
    const row = [...document.querySelectorAll('.dm-listings-section .shop-item-row')]
      .find(r => r.querySelector('.shop-item-name')?.textContent === name);
    if (!row) return null;
    if (!row.id) row.id = 'test-listing-row-' + Math.random().toString(36).slice(2);
    return '#' + row.id;
  }, itemName);
  if (!rowSelector) throw new Error(`dragListingToCharTab: no listing row found for "${itemName}"`);
  await dragBetween(page, rowSelector, `[data-char-id="${targetCharId}"]`);
}

// Drags an item from the inventory grid onto the Shop nav button — the
// app's "list for sale" / "sell" gesture for a DM (list) — while staying in
// the inventory view (the shop's own drop zone only exists once the shop
// view is open, at which point the grid itself isn't on screen to drag
// from).
export async function dragItemToShopTab(page, { containerId, r, c }) {
  await dragBetween(page, `[data-container-id="${containerId}"][data-r="${r}"][data-c="${c}"]`, '#shop-tab-btn');
}

export async function clickGpPlus(page, times = 1) {
  await page.evaluate(n => {
    for (let i = 0; i < n; i++) {
      document.querySelector('.insp-inline-var button.insp-btn-sm[data-k="gp"][data-d="1"]').click();
    }
  }, times);
}

export async function setHp(page, value) {
  await page.evaluate(v => {
    const el = document.getElementById('cs-hp');
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

export async function readCoinCounterGp(page) {
  return page.$eval('#coin-counter .coin-gp', el => el.textContent.trim()).catch(() => '(hidden)');
}

export async function readInspectorGp(page) {
  return page.$eval('.insp-num-coin[data-k="gp"]', el => el.value).catch(() => '(closed)');
}

// Reads and parses a character's `state` field straight out of the mock
// "server" (localStorage), bypassing the UI entirely — the source of truth
// for what actually got persisted, independent of what any one tab renders.
export async function readServerCharState(page, charId) {
  return page.evaluate(charId => {
    const db = window.__mockFirebase.readDB();
    const raw = db.inventory_characters?.[charId]?.state;
    return raw ? JSON.parse(raw) : null;
  }, charId);
}

export async function readMockPath(page, path) {
  return page.evaluate(path => {
    const db = window.__mockFirebase.readDB();
    return path.split('/').filter(Boolean).reduce((n, k) => (n == null ? n : n[k]), db);
  }, path);
}

export function totalGp(containers) {
  let gp = 0;
  for (const c of containers) for (const row of c.slots) for (const slot of row) {
    if (slot && slot._vars && typeof slot._vars.gp === 'number') gp += slot._vars.gp;
  }
  return gp;
}

// Basic 2-item container shape used by several tests: a permanent Equipped
// row and a Strapped Gear container, optionally pre-populated with coin
// purses (item id 50 in items.js) at specific slots.
export function basicContainers(strappedSlots) {
  return [
    { id: 'equipped', name: 'Equipped', rows: 1, collapsed: false, permanent: true, slots: [[null, null]] },
    { id: 'strapped', name: 'Strapped Gear', rows: strappedSlots.length, collapsed: false, permanent: true, slots: strappedSlots },
  ];
}

export function coinPurse(gp) {
  return { _ref: 50, _vars: { gp } };
}

// A tiny pass/fail reporter shared by every integration test's own main().
export function report(ok, passMsg, failMsg) {
  console.log('\nRESULT:', ok ? `OK — ${passMsg}` : `BUG — ${failMsg}`);
  process.exitCode = ok ? 0 : 1;
}
