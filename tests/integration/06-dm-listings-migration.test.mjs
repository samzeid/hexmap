// Bug: DM "For Sale" listings used to live as one JSON-stringified array
// under a single Firebase node, rewritten in full on every change — same
// full-overwrite race as shop visibility. Fixed by restructuring to one
// Firebase child per listing (keyed by push id), with a transaction-guarded
// one-time migration for existing data so nothing currently listed is lost
// when this ships. This test specifically verifies that migration.
import { launchBrowser, openCharInventory, openShop, basicContainers, report } from './helpers.mjs';

function seedTree() {
  // Legacy format: one node holding a JSON-stringified array of compact items.
  const legacyListings = JSON.stringify([
    { _ref: 1 }, // Dagger (id 1 per items.js)
    { _ref: 4 }, // Club (id 4)
  ]);
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'dmUser', ownerName: 'DM',
        state: JSON.stringify({ charName: 'DM Char', carryCapacity: '', containers: basicContainers([[null, null], [null, null]]) }),
        createdAt: 1,
      },
    },
    inventory_dm_users: { dmUser: true },
    inventory_roles: { dmUser: 'dm' },
    inventory_dm_listings: legacyListings,
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await openCharInventory(page, { testUid: 'dmUser', testName: 'DM', seedTree: seedTree() });
    await openShop(page);

    // Give the transaction-guarded migration time to fire and echo back.
    await new Promise(r => setTimeout(r, 2500));

    const listingNames = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.dm-listings-section .shop-item-row')];
      return rows.map(r => r.querySelector('.shop-item-name')?.textContent?.trim());
    });
    console.log('displayed listings:', JSON.stringify(listingNames));

    const rawListings = await page.evaluate(() => window.__mockFirebase.readDB().inventory_dm_listings);
    console.log('server /inventory_dm_listings shape:', typeof rawListings, JSON.stringify(rawListings));

    const isKeyedObject = rawListings && typeof rawListings === 'object' && !Array.isArray(rawListings)
      && Object.keys(rawListings).length === 2;
    const bothShown = listingNames.length === 2 && listingNames.every(Boolean);

    const ok = isKeyedObject && bothShown;
    report(ok,
      'legacy string format migrated to keyed object, both listings preserved and displayed',
      `migration incomplete (keyedObject=${isKeyedObject}, bothShown=${bothShown})`);
  } finally {
    await browser.close();
  }
}
run();
