// Bug: unlike the general shop catalog (which has always blocked a drag-to-
// buy when the buyer can't afford it -- see the `cantAfford`/
// shop-item-unaffordable handling around buildShop()'s catalog rows), "For
// Sale" DM listings had NO affordability check at all. Buying one always
// silently succeeded for free if the buyer either (a) didn't have enough
// gold, or (b) had no Coin Purse item in their inventory to deduct from at
// all -- deductCostCp() just silently no-ops in both cases, and nothing
// upstream ever checked whether the deduction actually happened before
// letting the item through. Fixed by giving DM listings the same
// affordability gate the catalog already has: a `shop-item-unaffordable`
// class computed the same way, and a block at drag-confirm time that
// prevents the purchase from starting at all.
import { launchBrowser, openCharInventory, dragListingToCharTab, readServerCharState, basicContainers, coinPurse, report } from './helpers.mjs';

function seedTreeNoPurse() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'playerA', ownerName: 'PlayerA',
        state: JSON.stringify({ charName: 'CharA', carryCapacity: '', containers: basicContainers([[null, null]]) }),
        createdAt: 1,
      },
    },
    inventory_dm_listings: { listing1: { _ref: 1, bulk: { id: 'stock' } } }, // Dagger, 2gp
  };
}

function seedTreeInsufficientFunds() {
  return {
    inventory_characters: {
      charB: {
        ownerUid: 'playerB', ownerName: 'PlayerB',
        // 1gp in the purse; Dagger costs 2gp.
        state: JSON.stringify({ charName: 'CharB', carryCapacity: '', containers: basicContainers([[coinPurse(1), null]]) }),
        createdAt: 1,
      },
    },
    inventory_dm_listings: { listing1: { _ref: 1, bulk: { id: 'stock' } } },
  };
}

async function testScenario(label, seedTree, testUid, charId) {
  console.log(`\n--- ${label} ---`);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await openCharInventory(page, { testUid, testName: 'P', seedTree: seedTree() });
    await page.evaluate(() => document.getElementById('shop-tab-btn').click());
    await new Promise(r => setTimeout(r, 500));
    await page.waitForSelector('.dm-listings-section .shop-item-row');

    const rowUnaffordable = await page.evaluate(() =>
      document.querySelector('.dm-listings-section .shop-item-row')?.classList.contains('shop-item-unaffordable'));
    console.log('row shows as unaffordable:', rowUnaffordable, '(expected true)');

    await dragListingToCharTab(page, { itemName: 'Dagger', targetCharId: charId });
    await new Promise(r => setTimeout(r, 2000));

    const state = await readServerCharState(page, charId);
    const got = state.containers.some(c => c.slots.some(row => row.some(s => s && (s.name === 'Dagger' || s._ref === 1))));
    console.log('item received despite being unaffordable:', got, '(expected false)');
    return rowUnaffordable === true && got === false;
  } finally {
    await browser.close();
  }
}

async function run() {
  const ok1 = await testScenario('no coin purse item at all', seedTreeNoPurse, 'playerA', 'charA');
  const ok2 = await testScenario('purse has 1gp, item costs 2gp', seedTreeInsufficientFunds, 'playerB', 'charB');

  report(ok1 && ok2,
    'a "For Sale" listing the buyer cannot afford is correctly blocked, whether from insufficient funds or no coin purse at all',
    `at least one scenario let an unaffordable purchase through: noPurse=${ok1}, insufficientFunds=${ok2}`);
}
run();
