// Bug: the field-level merge (test 03) treats `containers` as ONE field —
// so two edits to DIFFERENT items in the SAME character's inventory grid
// used to still collide, the same as if they'd touched the identical item.
// Fixed by merging `containers` by container id + exact slot position
// instead of as one all-or-nothing blob (see mergeContainerList/
// mergeSlotGrid in inventory/script.js, unit-tested in tests/unit/).
import { launchBrowser, openCharInventory, openCoinInspectorAt, clickGpPlus,
         readServerCharState, basicContainers, coinPurse, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      sharedChar: {
        ownerUid: 'sharedPlayer', ownerName: 'Shared',
        // Two DIFFERENT coin purses in the same "Strapped Gear" container —
        // slot (0,0) and slot (1,0). Genuinely different items, same grid.
        state: JSON.stringify({ charName: 'Shared', carryCapacity: '', containers: basicContainers([[coinPurse(20), null], [coinPurse(100), null]]) }),
        createdAt: 1,
      },
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const pageA = await browser.newPage();
    await openCharInventory(pageA, { testUid: 'sharedPlayer', testName: 'Shared', seedTree: seedTree() });
    await openCoinInspectorAt(pageA, 'strapped', 0, 0); // purse #1

    const pageB = await browser.newPage();
    await openCharInventory(pageB, { testUid: 'sharedPlayer', testName: 'Shared' });
    await openCoinInspectorAt(pageB, 'strapped', 1, 0); // purse #2 — a different item

    console.log('--- A edits purse #1 (20 -> 23), B edits purse #2 (100 -> 105), nearly simultaneously ---');
    await Promise.all([
      clickGpPlus(pageA, 3),
      (async () => { await new Promise(r => setTimeout(r, 50)); await clickGpPlus(pageB, 5); })(),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    const state = await readServerCharState(pageA, 'sharedChar');
    const strapped = state.containers.find(c => c.id === 'strapped');
    const gp1 = strapped.slots[0][0]?._vars?.gp;
    const gp2 = strapped.slots[1][0]?._vars?.gp;
    console.log('server purse #1 gp:', gp1, '(expected 23)');
    console.log('server purse #2 gp:', gp2, '(expected 105)');

    const ok = gp1 === 23 && gp2 === 105;
    report(ok,
      "two different items in the same character's inventory both survived concurrent edits",
      `one item's edit was lost (gp1=${gp1}, gp2=${gp2})`);
  } finally {
    await browser.close();
  }
}
run();
