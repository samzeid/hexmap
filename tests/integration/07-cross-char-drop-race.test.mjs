// Bug: handleCrossCharDrop used to pick "the first empty slot" from a
// locally cached snapshot of the target character, taken before the write
// even started. If the receiving player was simultaneously moving one of
// their own items into that exact same slot, the two writes collided —
// whichever landed last won the slot outright, and the other item silently
// vanished (not a merge case: both sides explicitly targeted the identical
// position). Fixed by deciding placement *inside* the transaction, freshly
// against the true current server value on every attempt, and always
// appending a brand-new row rather than reusing an existing empty-looking
// slot — a row that doesn't exist yet can't be something anyone else's
// concurrent edit was independently targeting.
//
// This exercises the REAL placement logic (extracted live from
// handleCrossCharDrop, see extract-cross-char-drop.mjs) under realistic
// transaction-contention timing, rather than automating a full cross-tab
// drag-and-drop gesture in the browser — see tests/README.md for why.
import { extractPlacementFn } from './extract-cross-char-drop.mjs';
import { extractMergeFunctions } from '../unit/extract-merge-functions.mjs';
import { report } from './helpers.mjs';

const placementFn = extractPlacementFn();
const { mergeCharTopLevel } = extractMergeFunctions();

// Minimal Firebase-transaction-like primitive: single read-transform-write
// per delayed callback. In this single-threaded simulation, a transaction
// that fires after another has already committed correctly sees that
// committed value — the ordering the real merge/placement logic depends on.
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
  const initialState = {
    charName: 'Player', hp: '20',
    containers: [{ id: 'equipped', name: 'Equipped', rows: 1, slots: [[null, null]] }],
  };
  store = JSON.stringify(initialState);
  const baseline = JSON.parse(JSON.stringify(initialState)); // player's last-synced baseline

  // Player's own move: drags their existing item into what THEY see as the
  // first empty slot (0,0) — a deliberate, explicit edit to that position,
  // via the same merge path saveChar() uses.
  const playerMine = JSON.parse(JSON.stringify(initialState));
  playerMine.containers[0].slots[0][0] = { name: 'PlayersOwnItem' };
  function playerMoveTransactionUpdate(currentRaw) {
    const serverState = JSON.parse(currentRaw || 'null');
    return JSON.stringify(mergeCharTopLevel(serverState, baseline, playerMine));
  }

  // DM's give, using the REAL extracted placement logic.
  const cleanItem = { name: 'GiftedItem' };
  function dmGiveTransactionUpdate(currentRaw) {
    return placementFn(cleanItem, null, currentRaw);
  }

  await new Promise(resolve => {
    // DM's write scheduled to land first, player's shortly after — the
    // realistic "gift lands, then the player's own concurrent save catches
    // up" ordering that used to lose the gift.
    fbTransaction(dmGiveTransactionUpdate, () => {}, 100);
    fbTransaction(playerMoveTransactionUpdate, () => {}, 150);
    setTimeout(resolve, 400);
  });

  const final = JSON.parse(store);
  const equipped = final.containers.find(c => c.id === 'equipped');
  console.log('final equipped grid:', JSON.stringify(equipped.slots));

  const hasGift = equipped.slots.some(row => row.some(s => s && s.name === 'GiftedItem'));
  const hasPlayerItem = equipped.slots.some(row => row.some(s => s && s.name === 'PlayersOwnItem'));
  console.log('gifted item present:', hasGift);
  console.log('player\'s own moved item present:', hasPlayerItem);

  report(hasGift && hasPlayerItem,
    "DM's gift and the player's own concurrent move both landed, in different slots",
    'one of the two items was lost');
}
run();
