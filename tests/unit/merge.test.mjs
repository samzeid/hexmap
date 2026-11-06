// Unit tests for the character-state merge logic (inventory/script.js,
// saveChar()'s conflict resolution). These run against the REAL functions,
// extracted live from the source file — see extract-merge-functions.mjs.
// Pure data-in/data-out, no browser needed: fast and precise for pinning
// down exact merge behavior. See tests/integration/ for the same logic
// exercised end-to-end through real UI interactions in a real browser.
import { extractMergeFunctions } from './extract-merge-functions.mjs';

const { jsonEq, mergeById, mergeSlotGrid, mergeContainerList, CHAR_COLLECTION_MERGERS, mergeCharTopLevel } = extractMergeFunctions();

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = jsonEq(actual, expected);
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) {
    console.log('  expected:', JSON.stringify(expected));
    console.log('  actual:  ', JSON.stringify(actual));
    fail++;
  } else pass++;
}
function checkTrue(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`);
  if (!cond) { console.log('  detail:', detail); fail++; } else pass++;
}

// ── notes / attacks / features-by-id (mergeById) ───────────────────────────

check('notes: unrelated add + unrelated edit both survive',
  mergeById(
    [{ id: 1, body: 'edited-by-other' }],                              // server
    [{ id: 1, body: 'a' }],                                            // baseline
    [{ id: 1, body: 'a' }, { id: 2, body: 'new-from-me' }],             // mine
    x => x.id
  ),
  [{ id: 1, body: 'edited-by-other' }, { id: 2, body: 'new-from-me' }]
);

{
  const result = mergeById(
    [{ id: 1 }, { id: 2 }, { id: 3 }],  // server: unaware I deleted 2, added 3 themselves
    [{ id: 1 }, { id: 2 }],             // baseline
    [{ id: 1 }],                        // mine: I deleted note 2
    x => x.id
  );
  check('notes: my deletion sticks, their unrelated addition survives',
    result.map(x => x.id).sort(), [1, 3]);
}

// ── slot grid (item-level merge within one container) ──────────────────────

check('slot grid: two different slots edited concurrently both survive',
  mergeSlotGrid(
    [[null, null], [null, 'itemB']],   // server: someone placed itemB at [1][1]
    [[null, null], [null, null]],      // baseline
    [['itemA', null], [null, null]],   // mine: I placed itemA at [0][0]
  ),
  [['itemA', null], [null, 'itemB']]
);

check('slot grid: concurrent independent growth + fill both survive',
  mergeSlotGrid(
    [[null, null], [null, 'itemB']],   // server: they grew to 2 rows, filled [1][1]
    [[null, null]],                    // baseline: 1 row
    [['itemA', null], [null, null]],   // mine: I grew to 2 rows, filled [0][0]
  ),
  [['itemA', null], [null, 'itemB']]
);

// ── containers (add / edit / delete at the container level) ────────────────

{
  const server = [{ id: 'equipped', rows: 1, slots: [['someoneElsesItem', null]] }];
  const baseline = [{ id: 'equipped', rows: 1, slots: [[null, null]] }];
  const mine = [
    { id: 'equipped', rows: 1, slots: [[null, null]] },
    { id: 'linked-1', rows: 1, slots: [['newBackpackItem', null]] },
  ];
  const result = mergeContainerList(server, baseline, mine);
  const equipped = result.find(c => c.id === 'equipped');
  const linked = result.find(c => c.id === 'linked-1');
  checkTrue('containers: my new container survives alongside their unrelated item edit', !!linked, result);
  check('containers: their unrelated item edit inside an existing container survives',
    equipped && equipped.slots, [['someoneElsesItem', null]]);
}

{
  const baseline = [
    { id: 'equipped', rows: 1, slots: [[null, null]] },
    { id: 'linked-1', rows: 1, slots: [['item', null]] },
  ];
  const mine = [{ id: 'equipped', rows: 1, slots: [[null, null]] }]; // I removed linked-1
  const server = baseline; // server unchanged, unaware of my deletion
  const result = mergeContainerList(server, baseline, mine);
  checkTrue('containers: my deletion of an untouched container sticks',
    !result.find(c => c.id === 'linked-1'), result);
}

// ── featureData (merged by feature id) ──────────────────────────────────────

check('featureData: my spend + their unrelated activation both survive',
  CHAR_COLLECTION_MERGERS.featureData(
    { f1: { current: 2 }, f2: { active: true } }, // server
    { f1: { current: 2 } },                       // baseline
    { f1: { current: 1 } },                       // mine: I spent a charge on f1
  ),
  { f1: { current: 1 }, f2: { active: true } }
);

// ── activeFeatures / hiddenFeatures (plain id sets) ─────────────────────────

check('activeFeatures: concurrent unrelated activations both survive',
  mergeById(['rage', 'bardicInspiration'], ['rage'], ['rage', 'secondWind'], x => x).sort(),
  ['bardicInspiration', 'rage', 'secondWind']
);

check('activeFeatures: my deactivation sticks even if server still shows it active',
  mergeById(['rage', 'secondWind'], ['rage', 'secondWind'], ['secondWind'], x => x).sort(),
  ['secondWind']
);

// ── full top-level integration ──────────────────────────────────────────────

check('top-level: HP change + unrelated containers change both survive',
  mergeCharTopLevel(
    { hp: '10', containers: [{ id: 'equipped', rows: 1, slots: [['itemFromOther', null]] }] }, // server
    { hp: '10', containers: [{ id: 'equipped', rows: 1, slots: [[null, null]] }] },             // baseline
    { hp: '42', containers: [{ id: 'equipped', rows: 1, slots: [[null, null]] }] },             // mine
  ),
  { hp: '42', containers: [{ id: 'equipped', rows: 1, slots: [['itemFromOther', null]] }] }
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
