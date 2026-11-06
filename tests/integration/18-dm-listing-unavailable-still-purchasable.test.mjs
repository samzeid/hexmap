// Bug: the "For Sale" section (DM listings) shares its availability flag
// with the general shop catalog, keyed by item name (see the comment above
// the DM-listings render loop in inventory/script.js). That's fine for
// visual/informational purposes, but it also BLOCKED players from actually
// buying a listing whenever that name happened to be marked unavailable --
// even though a DM listing is a specific, individually-placed item that a
// DM put there deliberately for a player to buy, unlike the general
// catalog's "is this generally in stock" toggle. Fixed by no longer
// gating the DM-listing purchase drag on isItemAvailable() -- the general
// catalog's own purchase-block is untouched and still applies there.
import { launchBrowser, openCharInventory, dragListingToCharTab, readServerCharState, readMockPath, basicContainers, coinPurse, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'playerA', ownerName: 'PlayerA',
        // Plenty of gold -- this test is specifically isolating the
        // availability gate from the (separately tested, see test 19)
        // affordability gate, so the character must be able to afford the
        // item on its own merits.
        state: JSON.stringify({ charName: 'CharA', carryCapacity: '', containers: basicContainers([[coinPurse(10), null]]) }),
        createdAt: 1,
      },
    },
    // "Dagger" marked unavailable in the general catalog -- this same name
    // is what the "For Sale" listing below shares its availability flag
    // with.
    inventory_shop_availability: { Dagger: false },
    inventory_dm_listings: {
      listing1: { _ref: 1, bulk: { id: 'stock' } }, // item id 1 = Dagger, per items.js
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await openCharInventory(page, { testUid: 'playerA', testName: 'PlayerA', seedTree: seedTree() });

    await page.evaluate(() => document.getElementById('shop-tab-btn').click());
    await new Promise(r => setTimeout(r, 500));
    await page.waitForSelector('.dm-listings-section .shop-item-row');

    const rowUnavailable = await page.evaluate(() =>
      document.querySelector('.dm-listings-section .shop-item-row')?.classList.contains('shop-item-unavailable'));
    console.log('For Sale row shows as unavailable (visual state, expected true):', rowUnavailable);

    console.log('--- non-DM player drags the unavailable "For Sale" Dagger onto their own tab ---');
    await dragListingToCharTab(page, { itemName: 'Dagger', targetCharId: 'charA' });
    await new Promise(r => setTimeout(r, 2000));

    const finalState = await readServerCharState(page, 'charA');
    const got = finalState.containers.some(c => c.slots.some(row => row.some(s => s && (s.name === 'Dagger' || s._ref === 1))));
    console.log('player received the Dagger from the unavailable For Sale listing:', got, '(expected true)');

    const listingsLeft = await readMockPath(page, '/inventory_dm_listings');
    console.log('listing removed after purchase:', !listingsLeft || Object.keys(listingsLeft).length === 0, '(expected true)');

    report(rowUnavailable === true && got === true,
      'a "For Sale" listing marked unavailable was still purchasable',
      `unexpected result: row showed unavailable=${rowUnavailable}, purchase succeeded=${got}`);
  } finally {
    await browser.close();
  }
}
run();
