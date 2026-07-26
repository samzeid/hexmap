// Base-case regression check for handleCrossCharDrop after it was rewritten
// (test 07 covers the concurrency race specifically, using extracted logic
// under simulated timing — this one drives the actual long-press
// drag-and-drop gesture through the real UI, single actor, no race, purely
// to confirm the rewritten code still works at all for the common case).
import { launchBrowser, openCharInventory, dragItemToCharTab, readServerCharState, basicContainers, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'dmUser', ownerName: 'DM',
        state: JSON.stringify({
          charName: 'CharA', carryCapacity: '',
          containers: basicContainers([[{ name: 'GiveMeItem', custom: true, bulk: { id: 'stock' }, description: '' }, null], [null, null]]),
        }),
        createdAt: 1,
      },
      charB: {
        ownerUid: 'playerB', ownerName: 'PlayerB',
        state: JSON.stringify({ charName: 'CharB', carryCapacity: '', containers: basicContainers([[null, null], [null, null]]) }),
        createdAt: 2,
      },
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await openCharInventory(page, { testUid: 'dmUser', testName: 'DM', seedTree: seedTree() });

    console.log('--- dragging "GiveMeItem" from charA\'s inventory onto charB\'s tab ---');
    await dragItemToCharTab(page, { containerId: 'strapped', r: 0, c: 0, targetCharId: 'charB' });
    await new Promise(r => setTimeout(r, 2000));

    const finalA = await readServerCharState(page, 'charA');
    const finalB = await readServerCharState(page, 'charB');

    const aStrapped = finalA.containers.find(c => c.id === 'strapped');
    const aStillHasItem = aStrapped.slots.some(row => row.some(s => s && s.name === 'GiveMeItem'));

    const bEquipped = finalB.containers.find(c => c.id === 'equipped');
    const bHasItem = bEquipped.slots.some(row => row.some(s => s && s.name === 'GiveMeItem'));

    console.log('charA still has the item:', aStillHasItem, '(expected false — it was given away)');
    console.log('charB now has the item:', bHasItem, '(expected true)');

    const ok = !aStillHasItem && bHasItem;
    report(ok,
      'the real drag-and-drop gesture moved the item from charA to charB correctly',
      `drag-and-drop did not move the item as expected (charA still has it=${aStillHasItem}, charB has it=${bHasItem})`);
  } finally {
    await browser.close();
  }
}
run();
