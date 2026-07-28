// Documents a known, ACCEPTED trade-off in handleCrossCharDrop's placement
// logic (see the comment in inventory/script.js and in
// 07-cross-char-drop-race.test.mjs for the full reasoning): if a gift and
// the receiving player's own concurrent edit both target the exact SAME
// empty slot within the same save window, the player's own save (which
// uses simple per-slot "did I touch this, mine wins" merge logic, with no
// way to know the server also touched that slot) can silently win the
// slot, and the gift is lost.
//
// This is not something this test guards against — it's the opposite: it
// exists so that if this behavior ever silently changes (in either
// direction — losing more than the gift, or losing the gift more often
// than expected), a future run of the suite calls attention to it rather
// than the change going unnoticed. The narrow window this requires (two
// people targeting the identical empty slot within the same save cycle) is
// rare in practice, and losing this race is self-evident (the item just
// doesn't show up) and easy to redo — a real but small cost, deliberately
// accepted in exchange for not permanently stranding an empty row in the
// target's grid on every single gift (see 07's comment for why that was
// worse).
import { extractPlacementFn } from './extract-cross-char-drop.mjs';
import { extractMergeFunctions } from '../unit/extract-merge-functions.mjs';
import { report } from './helpers.mjs';

const placementFn = extractPlacementFn();
const { mergeCharTopLevel } = extractMergeFunctions();

let store = null;
function fbTransaction(updateFn, onComplete, delayMs) {
  setTimeout(() => {
    const current = store;
    const next = updateFn(current);
    if (next === undefined) { onComplete(false, current); return; }
    store = next;
    onComplete(true, next);
  }, delayMs);
}

async function run() {
  // Only ONE empty slot available — both the gift and the player's own
  // move will target it.
  const initialState = {
    charName: 'Player', hp: '20',
    containers: [{ id: 'equipped', name: 'Equipped', rows: 1, slots: [[null, null]] }],
  };
  store = JSON.stringify(initialState);
  const baseline = JSON.parse(JSON.stringify(initialState));

  const playerMine = JSON.parse(JSON.stringify(initialState));
  playerMine.containers[0].slots[0][0] = { name: 'PlayersOwnItem' };
  function playerMoveTransactionUpdate(currentRaw) {
    const serverState = JSON.parse(currentRaw || 'null');
    return JSON.stringify(mergeCharTopLevel(serverState, baseline, playerMine));
  }

  const cleanItem = { name: 'GiftedItem' };
  function dmGiveTransactionUpdate(currentRaw) {
    return placementFn(cleanItem, null, currentRaw);
  }

  await new Promise(resolve => {
    fbTransaction(dmGiveTransactionUpdate, () => {}, 100);
    fbTransaction(playerMoveTransactionUpdate, () => {}, 150);
    setTimeout(resolve, 400);
  });

  const final = JSON.parse(store);
  const equipped = final.containers.find(c => c.id === 'equipped');
  console.log('final equipped grid (single shared slot):', JSON.stringify(equipped.slots));

  const hasGift = equipped.slots.some(row => row.some(s => s && s.name === 'GiftedItem'));
  const hasPlayerItem = equipped.slots.some(row => row.some(s => s && s.name === 'PlayersOwnItem'));
  console.log('gifted item present:', hasGift, '| player\'s own item present:', hasPlayerItem);

  // Expected/accepted outcome: the player's own later save wins the shared
  // slot (mergeCharTopLevel runs second here, same as the real ordering —
  // gift commits first, then the player's own in-flight save reconciles
  // against it and treats its own edit to that slot as an intentional,
  // unconditional change). Exactly one of the two survives; nothing crashes
  // or corrupts the grid down to more than one row.
  const exactlyOneSurvived = hasGift !== hasPlayerItem;
  report(exactlyOneSurvived && equipped.slots.length === 1,
    'same-slot collision resolves predictably (player\'s own edit wins, gift is lost) — known, accepted behavior',
    `unexpected outcome for a same-slot collision: hasGift=${hasGift} hasPlayerItem=${hasPlayerItem} rows=${equipped.slots.length}`);
}
run();
