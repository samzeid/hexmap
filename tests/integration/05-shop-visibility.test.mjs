// Bug: saveShopVisibility()/saveShopAvailability() used to set() the ENTIRE
// visibility map on every single toggle. Two DMs toggling different items
// around the same time would have one toggle silently overwritten by the
// other's full-map snapshot. Fixed by writing only the specific changed
// key(s) via update() (a Firebase multi-path merge), not the whole map.
import { launchBrowser, openCharInventory, openShop, basicContainers, report } from './helpers.mjs';

function seedTree() {
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
  };
}

async function toggleVisibilityFor(page, itemName) {
  return page.evaluate(name => {
    const row = [...document.querySelectorAll('.shop-item-row')].find(r => r.dataset.itemName === name);
    if (!row) return false;
    const btn = row.querySelector('.shop-item-vis-btn');
    if (!btn) return false;
    btn.click();
    return true;
  }, itemName);
}

async function firstTwoItemNames(page) {
  return page.evaluate(() => [...document.querySelectorAll('.shop-item-row')]
    .map(r => r.dataset.itemName).filter(Boolean).slice(0, 2));
}

async function run() {
  const browser = await launchBrowser();
  try {
    const pageA = await browser.newPage();
    await openCharInventory(pageA, { testUid: 'dmUser', testName: 'DM', seedTree: seedTree() });
    await openShop(pageA);
    const [itemX, itemY] = await firstTwoItemNames(pageA);
    console.log('items chosen:', itemX, '/', itemY);

    const pageB = await browser.newPage();
    await openCharInventory(pageB, { testUid: 'dmUser', testName: 'DM' });
    await openShop(pageB);

    console.log(`--- A toggles visibility of "${itemX}", B toggles visibility of "${itemY}", concurrently ---`);
    const [okA, okB] = await Promise.all([
      toggleVisibilityFor(pageA, itemX),
      (async () => { await new Promise(r => setTimeout(r, 50)); return toggleVisibilityFor(pageB, itemY); })(),
    ]);
    console.log('clicked ok:', okA, okB);
    await new Promise(r => setTimeout(r, 3000));

    const serverVis = await pageA.evaluate(() => window.__mockFirebase.readDB().inventory_shop_visibility || {});
    const keyCount = Object.keys(serverVis).length;
    console.log('server /inventory_shop_visibility:', JSON.stringify(serverVis));
    console.log('keys recorded:', keyCount, '(expected 2 if both concurrent toggles survived)');

    report(keyCount === 2,
      'both concurrent visibility toggles survived',
      `one toggle was lost (keys recorded=${keyCount}, expected 2)`);
  } finally {
    await browser.close();
  }
}
run();
