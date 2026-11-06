// Confirms the attacks list actually wires into saveChar()'s merge path
// through the real UI: two DIFFERENT attack rows on the same character,
// edited concurrently by two sources, should both survive (mergeById by
// the attack's stable id) rather than the whole list colliding.
import { launchBrowser, openCharInventory, openCharacterStats, editAttackDamage,
         readServerCharState, basicContainers, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      sharedChar: {
        ownerUid: 'sharedPlayer', ownerName: 'Shared',
        state: JSON.stringify({
          charName: 'Shared', carryCapacity: '',
          attacks: [
            { id: 111, name: 'Sword', range: '', toHit: '', damage: '1d6' },
            { id: 222, name: 'Bow', range: '', toHit: '', damage: '1d8' },
          ],
          attackOrder: ['manual:111', 'manual:222'],
          containers: basicContainers([[null, null], [null, null]]),
        }),
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
    await openCharacterStats(pageA);

    const pageB = await browser.newPage();
    await openCharInventory(pageB, { testUid: 'sharedPlayer', testName: 'Shared' });
    await openCharacterStats(pageB);

    console.log('--- A edits Sword\'s damage, B edits Bow\'s damage, nearly simultaneously ---');
    await Promise.all([
      editAttackDamage(pageA, 111, '2d6'),
      (async () => { await new Promise(r => setTimeout(r, 50)); await editAttackDamage(pageB, 222, '2d8'); })(),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    const final = await readServerCharState(pageA, 'sharedChar');
    const sword = final.attacks.find(a => a.id === 111);
    const bow = final.attacks.find(a => a.id === 222);
    console.log('server sword damage:', sword?.damage, '(expected 2d6)');
    console.log('server bow damage:', bow?.damage, '(expected 2d8)');

    const ok = sword?.damage === '2d6' && bow?.damage === '2d8';
    report(ok,
      'both concurrent attack-row edits survived, through the real UI',
      `one edit was lost (sword=${sword?.damage}, bow=${bow?.damage})`);
  } finally {
    await browser.close();
  }
}
run();
