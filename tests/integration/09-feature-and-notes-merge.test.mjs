// Confirms featureData and notes actually wire into saveChar()'s merge path
// through the real UI, not just in the isolated unit tests for
// mergeById/CHAR_COLLECTION_MERGERS.featureData. Two tabs on the same
// character: one spends a class feature use, the other edits a note —
// different top-level collections, edited concurrently, both should survive.
import { launchBrowser, openCharInventory, openCharacterStats, spendFeatureUse,
         editNoteBody, readServerCharState, basicContainers, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      sharedChar: {
        ownerUid: 'sharedPlayer', ownerName: 'Shared',
        state: JSON.stringify({
          charName: 'Shared', carryCapacity: '', charClass: 'Barbarian', level: '3',
          activeFeatures: ['barbarian-rage'], hiddenFeatures: [],
          featureData: { 'barbarian-rage': { used: 0 } },
          notes: [{ id: 'note1', title: 'Note One', body: 'original' }],
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

    console.log('--- A spends a Rage use, B edits the note body, nearly simultaneously ---');
    await Promise.all([
      spendFeatureUse(pageA, 'barbarian-rage'),
      (async () => { await new Promise(r => setTimeout(r, 50)); await editNoteBody(pageB, 0, 'edited by B'); })(),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    const final = await readServerCharState(pageA, 'sharedChar');
    const rageUsed = final.featureData['barbarian-rage']?.used;
    const noteBody = final.notes[0]?.body;
    console.log('server featureData.barbarian-rage.used:', rageUsed, '(expected 1)');
    console.log('server notes[0].body:', JSON.stringify(noteBody), '(expected "edited by B")');

    const ok = rageUsed === 1 && noteBody === 'edited by B';
    report(ok,
      "both the feature-use spend and the note edit survived, through the real UI",
      `one edit was lost (rageUsed=${rageUsed}, noteBody=${JSON.stringify(noteBody)})`);
  } finally {
    await browser.close();
  }
}
run();
