// Confirms concurrent removal of DIFFERENT listings works correctly with
// the keyed-object format: two DMs each claiming a different listing at
// the same moment should both succeed, leaving neither listing behind and
// without one removal interfering with the other.
import { launchBrowser, openCharInventory, openShop, dragListingToCharTab, readMockPath,
         basicContainers, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'dmA', ownerName: 'DM A',
        state: JSON.stringify({ charName: 'CharA', carryCapacity: '', containers: basicContainers([[null, null], [null, null]]) }),
        createdAt: 1,
      },
      charB: {
        ownerUid: 'dmB', ownerName: 'DM B',
        state: JSON.stringify({ charName: 'CharB', carryCapacity: '', containers: basicContainers([[null, null], [null, null]]) }),
        createdAt: 2,
      },
    },
    inventory_dm_users: { dmA: true, dmB: true },
    inventory_roles: { dmA: 'dm', dmB: 'dm' },
    inventory_dm_listings: {
      key1: { name: 'ListingOne', custom: true, bulk: { id: 'stock' }, description: '' },
      key2: { name: 'ListingTwo', custom: true, bulk: { id: 'stock' }, description: '' },
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const pageA = await browser.newPage();
    await openCharInventory(pageA, { testUid: 'dmA', testName: 'DM A', seedTree: seedTree() });
    await openShop(pageA);

    const pageB = await browser.newPage();
    await openCharInventory(pageB, { testUid: 'dmB', testName: 'DM B' });
    await openShop(pageB);

    console.log('--- DM A claims ListingOne, DM B claims ListingTwo, nearly simultaneously ---');
    await Promise.all([
      dragListingToCharTab(pageA, { itemName: 'ListingOne', targetCharId: 'charA' }),
      (async () => { await new Promise(r => setTimeout(r, 50)); await dragListingToCharTab(pageB, { itemName: 'ListingTwo', targetCharId: 'charB' }); })(),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    const listings = await readMockPath(pageA, 'inventory_dm_listings');
    console.log('server /inventory_dm_listings (expected empty/absent):', JSON.stringify(listings));

    const remaining = listings ? Object.keys(listings).length : 0;
    report(remaining === 0,
      'both concurrent removals succeeded, no listing left behind',
      `${remaining} listing(s) unexpectedly remain`);
  } finally {
    await browser.close();
  }
}
run();
