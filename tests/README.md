# Concurrency test bed

Tests for multi-user/simultaneous-edit behavior in the inventory app — the
class of bug where two people (or one person on two devices/tabs) touching
the app at the same time could silently lose, overwrite, or corrupt data.
Nothing here touches the real Firebase project; everything runs against a
local mock (`mock-firebase.js`) that implements the same API surface
(`ref/on/off/once/set/update/remove/push/limitToLast/transaction`,
`auth.onAuthStateChanged/signInWithEmailAndPassword/signOut`) backed by
`localStorage` + `BroadcastChannel` for cross-tab sync, with an artificial
per-write delay so races can be provoked deterministically instead of
depending on real network jitter.

## Running

```
cd tests
npm install        # once — installs puppeteer (downloads a headless Chromium)
npm test            # everything: unit tests, then every integration test
npm run test:unit          # just the fast, no-browser unit tests
npm run test:integration   # just the browser-based integration tests
```

Or run a single test directly for faster iteration while debugging one:

```
node build-harness.mjs && node server.mjs &   # start once, leave running
node integration/04-same-item-container.test.mjs
```

`run-all.mjs` handles building the harness and starting/stopping the server
for you; running files individually (as above) requires the server already
running on port 8791 (override with `HEXMAP_TEST_PORT`).

Headless means literally no window opens — nothing to see, nothing left
running on your machine after the process exits.

## Layout

- `mock-firebase.js` — the Firebase stand-in, loaded by the generated harness in place of the real SDK.
- `build-harness.mjs` — regenerates `test-harness.html` from the **current** `../index.html` on every run (swaps the Firebase `<script>` tags for the mock). Never hand-edit `test-harness.html` — it's generated and gitignored.
- `server.mjs` — a ~30-line static file server for the repo root, no dependencies beyond Node itself.
- `unit/` — pure-function tests, no browser, sub-second.
- `integration/` — real headless-Chromium tests driving the actual app UI (or, for one scenario, the actual extracted transaction logic — see below).

## What's covered, and how

| # | Test | What it proves |
|---|------|-----------------|
| unit | `unit/merge.test.mjs` | The character-state merge functions (slot-position merging, id-based merging for notes/attacks/featureData/active-features) behave correctly in isolation, including growth, deletion, and addition edge cases. Extracts and evaluates the **real** functions live from `inventory/script.js` (`unit/extract-merge-functions.mjs`) rather than a hand-copied duplicate, so these can't silently go stale if the merge logic changes later. |
| 01 | `unrelated-character` | Editing character A causes zero interference on character B's screen — the original bug report (any edit anywhere used to force a reload check on everyone). |
| 02 | `same-character-inspector` | Two tabs on the *same* character: a legitimate edit from one doesn't orphan the other's open item inspector (the inspector re-targets itself to the fresh data instead of silently discarding further edits). |
| 03 | `character-field-merge` | Two different top-level fields on the same character (HP vs. gold) edited concurrently both survive — `saveChar()`'s transaction-based merge instead of blind overwrite. |
| 04 | `same-item-container` | Two *different* items in the same character's inventory grid, edited concurrently, both survive — slot-position-level merging, not whole-grid. |
| 05 | `shop-visibility` | Two DMs toggling different shop items' visibility at once — targeted `update()` instead of `set()`-ing the whole map. |
| 06 | `dm-listings-migration` | The one-time migration from the old single-JSON-blob listings format to one-Firebase-child-per-listing preserves existing listings (and the transaction guard means concurrent migration attempts from multiple clients can't create duplicates). |
| 07 | `cross-char-drop-race` | Giving an item to another player while they're independently moving an item in their own inventory — both survive, because placement is now decided fresh inside the write transaction (always into a brand-new row) instead of from a stale locally-cached snapshot. Uses the real placement logic extracted live from `handleCrossCharDrop` (`integration/extract-cross-char-drop.mjs`) under simulated transaction-contention timing, rather than automating a full cross-tab drag-and-drop gesture — see "What's simulated vs. driven through the real UI" below. |
| 08 | `cross-char-drop-real-dnd` | Base-case regression check for the rewritten `handleCrossCharDrop`: a real single-actor long-press drag-and-drop from one character's inventory onto another character's tab still works end to end (no race — test 07 covers that). Drives the actual gesture with real synthetic mouse events. |
| 09 | `feature-and-notes-merge` | featureData and notes actually wire into `saveChar()`'s merge path through the real UI (not just the isolated unit-tested merge function) — spending a class-feature use and editing a note, concurrently, on the same character, both survive. |
| 10 | `dm-listings-concurrent-add` | The actual ongoing benefit of the keyed-listings restructure (test 06 only covers the one-time migration): two DMs dragging different items onto the Shop tab to list them for sale at the same moment both survive. |
| 11 | `dm-listings-concurrent-remove` | Two DMs each claiming (removing) a *different* existing listing at the same moment — both removals succeed, neither interferes with the other. |
| 12 | `attacks-merge` | The attacks list wires into the merge path through the real UI — two different attack rows' damage fields, edited concurrently, both survive. |
| 13 | `rapid-burst-single-client` | Not a two-actor race — one client firing 15 edits back-to-back. Confirms the transaction-based save path converges on the correct final value under its own repeated retries, without dropping or reordering updates against itself. |

## What's simulated vs. driven through the real UI

Every test except 07 drives the actual app through real DOM interactions in
a real headless browser (clicking buttons, typing into fields, dragging
items with real synthetic mouse events, opening panels) — as close to what
a player actually does as this harness gets.

Test 07 is the one exception: reproducing "drag an item from character A's
tab onto character B's tab, while B is *simultaneously* dragging an item
within their own grid" would mean automating two independent custom
pointer-based drag gestures at once, across two browser tabs, with precise
timing between them. That's a lot of brittle automation for a scenario
whose actual risk lives entirely in *when* a placement decision gets made,
not in the drag mechanics themselves — and test 08 already confirms the
drag mechanics work. Instead, test 07 extracts the real transaction-
callback code that makes the placement decision and the real merge
functions, and runs them against a minimal transaction-like primitive with
realistic contention timing — so it's testing the actual shipped logic,
just without a real browser executing the drag gesture around it.

## Performance notes

Most integration tests run in ~9–12s. Tests 10 and 11 (DM listings
concurrent add/remove) are notably slower — roughly 85s and 105s in
practice — likely from rendering the full shop item catalog in two headless
tabs at once. They're correct, just slow; this wasn't chased down further
since it's a performance characteristic, not a correctness issue. Budget
several minutes for a full `npm test` run.

## Known residual gaps (not bugs — documented limits of the current design)

These came up in review and are accepted trade-offs, not things this suite
is failing to catch:

- **Two edits to the exact same entry** (same item, same feature, same
  note, same character-sheet field) at the same instant still resolve
  last-write-wins. This is intentional — there's no reasonable way to merge
  two different values for the identical thing.
- **A container deleted at the same instant someone edits an item inside
  it** (e.g. unequipping a backpack while someone else edits something
  inside it) resolves as "the deletion wins." The edit doesn't survive, but
  it doesn't corrupt anything either.
- **Two different sub-items stacked in the same packable slot** (e.g. two
  potions in one 4-item stack) edited at the same instant are still merged
  as one atomic unit, not per-sub-item.

If any of these ever need closing, the merge functions in
`inventory/script.js` (`mergeById`, `mergeSlotGrid`, `mergeContainerList`,
`mergeCharTopLevel`) are the place to extend — and `unit/merge.test.mjs` is
the place to add the corresponding test first.

## Mock fidelity notes

`mock-firebase.js`'s `.transaction()` is deliberately simplified relative to
real Firebase: it does a single read-transform-write per delayed callback,
not a true atomic compare-and-swap with automatic retry. This is sufficient
for testing merge *logic* — in a single-threaded environment, a transaction
that fires after another has already committed correctly sees that
committed value, which is the ordering the real merge path depends on — but
it does not model true concurrent-retry semantics under heavier contention
than these tests exercise.
