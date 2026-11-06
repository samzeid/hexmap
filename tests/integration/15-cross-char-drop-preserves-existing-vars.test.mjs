// Regression test for a real production data-loss bug: handleCrossCharDrop's
// transaction read the target character's state straight off Firebase (still
// in compact wire form: _ref/_vars) and, after adding the gifted item, called
// compactContainerSlots() on the WHOLE container tree. compactSlotData() only
// knows how to read overrides off the fully-resolved form (.variables) — fed
// already-compact input it found nothing to copy and silently dropped
// _vars/_varLocked, wiping dropdown picks, uses/charges, and coin-purse
// amounts off EVERY OTHER pre-existing item in the receiving character's
// inventory, every single time anyone gave them anything.
import { launchBrowser, openCharInventory, dragItemToCharTab, readServerCharState, basicContainers, coinPurse, report } from './helpers.mjs';

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
        // charB already owns a coin purse with a non-default gp amount —
        // this is exactly the kind of pre-existing _vars data that must
        // survive an unrelated gift landing in charB's inventory.
        state: JSON.stringify({
          charName: 'CharB', carryCapacity: '',
          containers: basicContainers([[coinPurse(250), null], [null, null]]),
        }),
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

    console.log('--- dragging "GiveMeItem" from charA onto charB, who already has a 250gp coin purse ---');
    await dragItemToCharTab(page, { containerId: 'strapped', r: 0, c: 0, targetCharId: 'charB' });
    await new Promise(r => setTimeout(r, 2000));

    const finalB = await readServerCharState(page, 'charB');
    const bStrapped = finalB.containers.find(c => c.id === 'strapped');
    const purse = bStrapped.slots.flat().find(s => s && s._ref === 50);
    const bEquipped = finalB.containers.find(c => c.id === 'equipped');
    const gotItem = bEquipped.slots.some(row => row.some(s => s && s.name === 'GiveMeItem'));

    const survivedGp = purse?._vars?.gp;
    console.log('charB received the gifted item:', gotItem, '(expected true)');
    console.log("charB's pre-existing coin purse gp after the gift:", survivedGp, '(expected 250)');

    report(gotItem && survivedGp === 250,
      "the gifted item arrived and charB's pre-existing coin purse gp survived untouched",
      `the gift landed=${gotItem}, but charB's pre-existing purse gp came out as ${survivedGp} (expected 250) — pre-existing _vars were wiped by the gift`);
  } finally {
    await browser.close();
  }
}
run();
