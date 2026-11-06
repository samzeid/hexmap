// Sanity check distinct from every other test here: no second actor at all,
// just one client firing a burst of edits back-to-back. saveChar() has no
// debounce (a deliberate choice — see the comment at saveChar's call sites
// in inventory/script.js) and each edit now goes through a transaction
// instead of a plain write, so it's worth confirming a rapid burst from a
// single source still converges on the correct final value instead of
// dropping or scrambling updates against itself.
import { launchBrowser, openCharInventory, openCoinInspectorAt, clickGpPlus,
         readServerCharState, totalGp, basicContainers, coinPurse, report } from './helpers.mjs';

const CLICK_COUNT = 15;

function seedTree() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'playerA', ownerName: 'Aria',
        state: JSON.stringify({ charName: 'Aria', carryCapacity: '', containers: basicContainers([[coinPurse(0), null], [null, null]]) }),
        createdAt: 1,
      },
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await openCharInventory(page, { testUid: 'playerA', testName: 'Aria', seedTree: seedTree() });
    await openCoinInspectorAt(page, 'strapped', 0, 0);

    console.log(`--- clicking gp+ ${CLICK_COUNT} times back-to-back, no other actor involved ---`);
    await clickGpPlus(page, CLICK_COUNT);
    await new Promise(r => setTimeout(r, 3000));

    const state = await readServerCharState(page, 'charA');
    const gp = totalGp(state.containers);
    console.log('server gp:', gp, `(expected ${CLICK_COUNT})`);

    report(gp === CLICK_COUNT,
      'a rapid burst of edits from a single client all landed, in order, none dropped or scrambled',
      `final value is wrong (gp=${gp}, expected ${CLICK_COUNT}) — the transaction retry loop may be dropping or reordering updates`);
  } finally {
    await browser.close();
  }
}
run();
