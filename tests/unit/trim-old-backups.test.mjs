// Unit test for trimOldBackups() (inventory/script.js) — the function that
// decides which rolling character backups get deleted once a character has
// more than BACKUP_RETENTION_COUNT of them. Runs against the REAL function,
// extracted live from the source file — see extract-trim-old-backups.mjs.
// Pure data-in/data-out against a stub `database`, no browser needed.
import { extractTrimOldBackups } from './extract-trim-old-backups.mjs';

let pass = 0, fail = 0;
function checkTrue(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`);
  if (!cond) { console.log('  detail:', JSON.stringify(detail)); fail++; } else pass++;
}

// Builds a stub `database` whose /inventory_backups/<charId> ref serves a
// fixed set of entries and records whatever trimOldBackups() tries to
// delete via update(). `entries` is [key, value] pairs in the exact order
// trimOldBackups should see them — this stub controls that order directly,
// so the test isn't at the mercy of any particular mock-Firebase key-sort
// scheme, only of trimOldBackups' own starred-filtering logic.
function makeStubDatabase(entries) {
  let updatePayload = null;
  const database = {
    ref: () => ({
      once: () => Promise.resolve({
        forEach: cb => { for (const [key, val] of entries) cb({ key, val: () => val }); },
      }),
      update: updates => { updatePayload = updates; return Promise.resolve(); },
    }),
  };
  return { database, getUpdatePayload: () => updatePayload };
}

async function run() {
  // 21 unstarred entries (one over the retention count of 20) plus 3
  // starred entries scattered at the start, middle, and end — their
  // position shouldn't matter, only their starred flag.
  const entries = [];
  entries.push(['s-first', { ts: -1, starred: true }]);
  for (let i = 0; i < 10; i++) entries.push([`u${String(i).padStart(2, '0')}`, { ts: i, starred: false }]);
  entries.push(['s-middle', { ts: 10.5, starred: true }]);
  for (let i = 10; i < 21; i++) entries.push([`u${String(i).padStart(2, '0')}`, { ts: i, starred: false }]);
  entries.push(['s-last', { ts: 999, starred: true }]);

  const { database, getUpdatePayload } = makeStubDatabase(entries);
  const trimOldBackups = extractTrimOldBackups()(database);
  trimOldBackups('charX');
  // trimOldBackups is fire-and-forget internally (once().then(...)) — give
  // its promise chain a tick to run before inspecting the result.
  await new Promise(resolve => setTimeout(resolve, 20));

  const payload = getUpdatePayload();
  checkTrue('deletes exactly 1 unstarred entry (21 unstarred - 20 retained)',
    payload && Object.keys(payload).length === 1, payload);
  checkTrue('the deleted entry is the oldest unstarred one (u00), not a starred one',
    payload && payload['u00'] === null, payload);
  checkTrue('no starred entry appears in the deletion payload, regardless of position',
    payload && !('s-first' in payload) && !('s-middle' in payload) && !('s-last' in payload), payload);
  checkTrue('newer unstarred entries (u01+) are left alone',
    payload && !('u01' in payload) && !('u20' in payload), payload);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
run();
