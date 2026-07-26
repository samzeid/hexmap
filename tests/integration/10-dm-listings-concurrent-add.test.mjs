// Confirms the actual ongoing benefit of restructuring DM listings to one
// Firebase child per listing (test 06 only covers the one-time format
// migration): two DMs listing DIFFERENT items for sale at the same moment
// should both survive, not have one overwrite the other.
import { launchBrowser, openCharInventory, dragItemToShopTab, readMockPath, basicContainers, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'dmA', ownerName: 'DM A',
        state: JSON.stringify({ charName: 'CharA', carryCapacity: '', containers: basicContainers([[{ name: 'ItemFromA', custom: true, bulk: { id: 'stock' }, description: '' }, null], [null, null]]) }),
        createdAt: 1,
      },
      charB: {
        ownerUid: 'dmB', ownerName: 'DM B',
        state: JSON.stringify({ charName: 'CharB', carryCapacity: '', containers: basicContainers([[{ name: 'ItemFromB', custom: true, bulk: { id: 'stock' }, description: '' }, null], [null, null]]) }),
        createdAt: 2,
      },
    },
    inventory_dm_users: { dmA: true, dmB: true },
    inventory_roles: { dmA: 'dm', dmB: 'dm' },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const pageA = await browser.newPage();
    await openCharInventory(pageA, { testUid: 'dmA', testName: 'DM A', seedTree: seedTree() });

    const pageB = await browser.newPage();
    await openCharInventory(pageB, { testUid: 'dmB', testName: 'DM B' });
    // DM B needs their OWN character selected/visible — with two DM-owned
    // characters, the auto-select in subscribeToChars picks each viewer's
    // own by ownerUid, so pageB should already be on charB.

    console.log('--- DM A lists ItemFromA, DM B lists ItemFromB, nearly simultaneously ---');
    await Promise.all([
      dragItemToShopTab(pageA, { containerId: 'strapped', r: 0, c: 0 }),
      (async () => { await new Promise(r => setTimeout(r, 50)); await dragItemToShopTab(pageB, { containerId: 'strapped', r: 0, c: 0 }); })(),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    const listings = await readMockPath(pageA, 'inventory_dm_listings');
    console.log('server /inventory_dm_listings:', JSON.stringify(listings));
    const names = listings ? Object.values(listings).map(l => l.name) : [];
    const hasA = names.includes('ItemFromA');
    const hasB = names.includes('ItemFromB');
    console.log('has ItemFromA:', hasA, '| has ItemFromB:', hasB);

    report(hasA && hasB,
      'both DMs\' concurrently-listed items survived',
      `one listing was lost (hasA=${hasA}, hasB=${hasB})`);
  } finally {
    await browser.close();
  }
}
run();
