// Bug: clicking a DM-randomizer result (or a DM listing) to open its
// description opened it, then closed it again almost immediately. Root
// cause was two-layered:
//   1. loadState()'s "re-target the open inspector at the fresh slot"
//      logic (added to fix a different bug earlier) only excluded
//      "shop-" prefixed keys from being parsed as a containerId-r-c
//      reference. Randomizer results ("rand-...") and DM listings
//      ("dm-listing-...") use the same container:null pattern but a
//      different prefix, so their keys fell through, failed to parse into
//      a real container/slot, and were wrongly read as "the item was
//      removed" -- closing the panel that had just been opened.
//   2. That path fires far more than it should because saveChar()'s "did
//      this save actually change anything" check compared raw JSON
//      strings, which differ on key order alone (mergeCharTopLevel()
//      rebuilds the object via Object.assign() + overwrites, reordering
//      keys) even when nothing semantically changed -- so it fired on
//      essentially every render(), including the no-op one triggered by
//      merely opening an inspector.
// Both are fixed: INSPECTOR_KEY_NON_SLOT_PREFIXES now lists every non-slot
// prefix, and jsonEq()/the save-comparison use a canonical (key-order-
// independent) comparison instead of a raw string ===.
import { launchBrowser, openCharInventory, basicContainers, report } from './helpers.mjs';

function seed() {
  return {
    inventory_characters: {
      charDM: { ownerUid: 'dmUser', ownerName: 'DM', createdAt: 1,
        state: JSON.stringify({ charName: 'DM-PC', carryCapacity: '', containers: basicContainers([[null, null], [null, null]]) }) },
    },
    inventory_dm_users: { dmUser: true },
    inventory_roles: { dmUser: 'dm' },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.on('pageerror', () => {});
    await openCharInventory(page, { testUid: 'dmUser', testName: 'DM', seedTree: seed() });
    await page.evaluate(() => document.getElementById('shop-tab-btn').click());
    await new Promise(r => setTimeout(r, 500));

    await page.evaluate(() => document.querySelector('.dm-rand-btn').click());
    await new Promise(r => setTimeout(r, 1500)); // dice-roll animation before results populate

    const rowBox = await page.evaluate(() => {
      const row = document.querySelector('.dm-rand-result .shop-item-row');
      const rect = row.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    console.log('--- clicking a rolled random item to open its description ---');
    await page.mouse.click(rowBox.x, rowBox.y);

    // Give the save -> transaction -> echo round trip (the thing that used
    // to trigger the spurious close) time to fully complete.
    await new Promise(r => setTimeout(r, 3000));

    const collapsed = await page.evaluate(() =>
      document.getElementById('detail-panel')?.classList.contains('detail-collapsed'));
    console.log('inspector collapsed after the round trip:', collapsed, '(expected false)');

    report(collapsed === false,
      "the randomizer item's inspector stayed open",
      'the inspector closed itself shortly after opening');
  } finally {
    await browser.close();
  }
}
run();
