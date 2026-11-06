// handleCrossCharDrop fills the first empty slot in the target's Equipped
// grid (decided *inside* the transaction, freshly against the true current
// server value on every attempt — never a locally cached snapshot), only
// appending a brand-new row when the grid is completely full. It used to
// unconditionally append a new row instead, specifically to avoid the risk
// this test now documents: two DIFFERENT empty slots, targeted by two
// different concurrent edits, must both survive (that's still guaranteed —
// this is the case this test asserts on). If, instead, a gift and the
// receiving player's own edit target the exact SAME empty slot within the
// same save window, one of them can be lost — see
// 17-cross-char-drop-same-slot-collision.test.mjs, which documents that as
// a known, accepted trade-off rather than a regression: unconditional
// append avoided that one narrow race, but its real-world cost was worse —
// every single gift left a permanently stranded empty row behind (grid
// merge logic can only safely grow/shrink from the true end, never reclaim
// a gap in the middle), so gifts kept landing further down a grid that
// looked broken. See tests/README.md.
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
  // Two empty slots available, so the gift (first-empty-slot) and the
  // player's own explicit move land in DIFFERENT positions — no collision.
  const initialState = {
    charName: 'Player', hp: '20',
    containers: [{ id: 'equipped', name: 'Equipped', rows: 2, slots: [[null, null], [null, null]] }],
  };
  store = JSON.stringify(initialState);
  const baseline = JSON.parse(JSON.stringify(initialState)); // player's last-synced baseline

  // Player's own move: drags their existing item into the SECOND row —
  // deliberately not the slot the gift will land in.
  const playerMine = JSON.parse(JSON.stringify(initialState));
  playerMine.containers[0].slots[1][0] = { name: 'PlayersOwnItem' };
  function playerMoveTransactionUpdate(currentRaw) {
    const serverState = JSON.parse(currentRaw || 'null');
    return JSON.stringify(mergeCharTopLevel(serverState, baseline, playerMine));
  }

  // DM's give, using the REAL extracted placement logic — lands in the
  // first empty slot, (0,0).
  const cleanItem = { name: 'GiftedItem' };
  function dmGiveTransactionUpdate(currentRaw) {
    return placementFn(cleanItem, null, currentRaw);
  }

  await new Promise(resolve => {
    // DM's write scheduled to land first, player's shortly after — the
    // realistic "gift lands, then the player's own concurrent save catches
    // up" ordering.
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
    "DM's gift and the player's own concurrent move to a DIFFERENT slot both landed",
    'one of the two items was lost even though they targeted different slots');
}
run();
