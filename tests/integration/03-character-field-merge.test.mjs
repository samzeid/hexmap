// Bug: saveChar() used to blindly overwrite a character's entire `state`
// blob on every save. Two edits to DIFFERENT fields of the same character
// from different sources (a DM adjusting HP while the player manages
// inventory, the same character open on two devices) would race —
// whichever save's round-trip landed last silently discarded the other
// field's change entirely, even though the two edits never touched the
// same thing. Fixed by writing through a Firebase transaction that merges
// against the true current server value instead of overwriting it.
import { launchBrowser, openCharInventory, openCoinInspectorAt, clickGpPlus,
         setHp, readServerCharState, totalGp, basicContainers, coinPurse, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      sharedChar: {
        ownerUid: 'sharedPlayer', ownerName: 'Shared',
        state: JSON.stringify({
          charName: 'Shared', carryCapacity: '', hp: '10', hpMax: '10',
          containers: basicContainers([[coinPurse(20), null], [null, null]]),
        }),
        createdAt: 1,
      },
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    // Tab A edits HP only (a character-sheet field). Tab B, same character,
    // edits gold only (inside `containers` — a completely different
    // top-level field). Neither tab touches the other's field at all.
    const pageA = await browser.newPage();
    await openCharInventory(pageA, { testUid: 'sharedPlayer', testName: 'Shared', seedTree: seedTree() });

    const pageB = await browser.newPage();
    await openCharInventory(pageB, { testUid: 'sharedPlayer', testName: 'Shared' });
    await openCoinInspectorAt(pageB, 'strapped', 0, 0);

    console.log('--- A edits HP (10 -> 42), B edits gold (20 -> 25), nearly simultaneously ---');
    await Promise.all([
      setHp(pageA, '42'),
      (async () => { await new Promise(r => setTimeout(r, 50)); await clickGpPlus(pageB, 5); })(),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    const finalState = await readServerCharState(pageA, 'sharedChar');
    const gp = totalGp(finalState.containers);
    console.log('server hp:', finalState.hp, '(expected 42)');
    console.log('server gp:', gp, '(expected 25)');

    const ok = finalState.hp === '42' && gp === 25;
    report(ok,
      'both concurrent edits to different fields of the same character survived',
      `one edit was lost (hp=${finalState.hp}, gp=${gp})`);
  } finally {
    await browser.close();
  }
}
run();
