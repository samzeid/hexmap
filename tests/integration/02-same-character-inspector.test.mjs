// Bug: even after fixing the unrelated-character case (test 01), a
// *legitimate* reload of the character you're actually looking at — because
// someone else genuinely changed it — still left an already-open item
// inspector bound to the pre-reload slot object. Further edits through that
// inspector mutated a detached copy nothing else looked at, and got
// silently discarded on the next save. Fixed by re-targeting the inspector
// at the freshly loaded slot inside loadState() when keepInspector is set.
import { launchBrowser, openCharInventory, openCoinInspectorAt, clickGpPlus,
         readCoinCounterGp, readInspectorGp, readServerCharState, totalGp,
         basicContainers, coinPurse, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      sharedChar: {
        ownerUid: 'sharedPlayer', ownerName: 'Shared',
        state: JSON.stringify({ charName: 'Shared', carryCapacity: '', containers: basicContainers([[coinPurse(20), null], [null, null]]) }),
        createdAt: 1,
      },
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    // Two tabs on the SAME character — e.g. one player on two devices, or
    // a DM and player both viewing the same shared character sheet.
    const pageA = await browser.newPage();
    await openCharInventory(pageA, { testUid: 'sharedPlayer', testName: 'Shared', seedTree: seedTree() });
    await openCoinInspectorAt(pageA, 'strapped', 0, 0);
    console.log('[A] starting gp:', await readInspectorGp(pageA));

    const pageB = await browser.newPage();
    await openCharInventory(pageB, { testUid: 'sharedPlayer', testName: 'Shared' });
    await openCoinInspectorAt(pageB, 'strapped', 0, 0);
    console.log('[B] starting gp:', await readInspectorGp(pageB));

    console.log('\n--- B makes a LEGITIMATE edit to the shared character (+5) ---');
    await clickGpPlus(pageB, 5); // 20 -> 25
    await new Promise(r => setTimeout(r, 2000));
    console.log('[B] gp after its edit:', await readInspectorGp(pageB));
    console.log('[A] header gp after B\'s edit propagated (should now correctly show 25):', await readCoinCounterGp(pageA));

    console.log('\n--- A now edits its OWN (already-open, pre-B\'s-edit) inspector (+1) ---');
    await clickGpPlus(pageA, 1); // intends 25 -> 26 if A's inspector is still live
    await new Promise(r => setTimeout(r, 2000));

    const aServerState = await readServerCharState(pageA, 'sharedChar');
    const gp = totalGp(aServerState.containers);
    console.log('[server] persisted gp:', gp, '(expected 26 if both edits landed)');

    report(gp === 26,
      "both edits landed correctly on the shared character",
      `A's edit was lost after B's legitimate edit (server gp=${gp}, expected 26)`);
  } finally {
    await browser.close();
  }
}
run();
