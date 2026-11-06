// Bug: editing character A used to force a reload of character B's screen
// even though B's data never changed, because the /inventory_characters
// listener re-evaluated on every write anywhere in the tree. Fixed via
// lastSyncedStateJson tracking (skip the reload when nothing actually
// changed for the character you're looking at).
import { launchBrowser, openCharInventory, openCoinInspectorAt, clickGpPlus,
         readCoinCounterGp, readInspectorGp, readServerCharState, totalGp,
         basicContainers, coinPurse, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'playerA', ownerName: 'Aria',
        state: JSON.stringify({ charName: 'Aria', carryCapacity: '', containers: basicContainers([[coinPurse(20), null], [null, null]]) }),
        createdAt: 1,
      },
      charB: {
        ownerUid: 'playerB', ownerName: 'Boro',
        state: JSON.stringify({ charName: 'Boro', carryCapacity: '', containers: basicContainers([[coinPurse(50), null], [null, null]]) }),
        createdAt: 2,
      },
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const pageA = await browser.newPage();
    await openCharInventory(pageA, { testUid: 'playerA', testName: 'Aria', seedTree: seedTree() });
    await openCoinInspectorAt(pageA, 'strapped', 0, 0);
    console.log('[A] starting gp:', await readInspectorGp(pageA));

    const pageB = await browser.newPage();
    await openCharInventory(pageB, { testUid: 'playerB', testName: 'Boro' });
    await openCoinInspectorAt(pageB, 'strapped', 0, 0);
    console.log('[B] starting gp:', await readInspectorGp(pageB));

    console.log('\n--- B edits its OWN gold — unrelated to A ---');
    await clickGpPlus(pageB, 1);
    await new Promise(r => setTimeout(r, 2000));
    console.log('[B] gp after its own edit:', await readInspectorGp(pageB));
    console.log('[A] header gp after B\'s unrelated edit propagated (should be unchanged):', await readCoinCounterGp(pageA));

    console.log('\n--- A now edits its OWN gold, using the same inspector it opened before B\'s edit ---');
    await clickGpPlus(pageA, 1);
    await new Promise(r => setTimeout(r, 2000));

    const aServerState = await readServerCharState(pageA, 'charA');
    const aGp = totalGp(aServerState.containers);
    console.log('[A] server-persisted gp:', aGp, '(expected 21)');

    report(aGp === 21,
      "A's edit persisted correctly — B's unrelated edit caused no interference",
      `A's edit was lost/desynced (server gp=${aGp}, expected 21)`);
  } finally {
    await browser.close();
  }
}
run();
