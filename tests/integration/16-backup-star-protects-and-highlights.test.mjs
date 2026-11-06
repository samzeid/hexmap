// Regression/feature test for backup starring: a DM can star a backup in
// the History > Backups tab to (a) visually surface it to the top of the
// list and (b) exempt it from trimOldBackups' automatic retention-count
// pruning (see tests/unit/trim-old-backups.test.mjs for the pruning half —
// this test drives the actual UI toggle end-to-end through a real browser).
import { launchBrowser, openCharInventory, readMockPath, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'playerA', ownerName: 'PlayerA',
        state: JSON.stringify({ charName: 'CharA', carryCapacity: '', containers: [
          { id: 'equipped', name: 'Equipped', rows: 1, collapsed: false, permanent: true, slots: [[null, null]] },
        ] }),
        createdAt: 1,
      },
    },
    inventory_backups: {
      charA: {
        'b1older': { ts: 1000, state: '{}' },
        'b2newer': { ts: 2000, state: '{}' },
      },
    },
    inventory_dm_users: { dmUser: true },
    inventory_roles: { dmUser: 'dm' },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await openCharInventory(page, { testUid: 'dmUser', testName: 'DM', seedTree: seedTree() });

    await page.evaluate(() => document.getElementById('hamburger-btn').click());
    await page.evaluate(() => document.getElementById('menu-history-btn').click());
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => document.querySelector('.history-tab-btn[data-tab="backups"]').click());
    await new Promise(r => setTimeout(r, 300));

    await page.select('#backups-char-select', 'charA');
    await new Promise(r => setTimeout(r, 300));
    await page.waitForSelector('.backup-row');

    console.log('--- starring the older of the two backups (b1older, listed second/bottom since newest-first) ---');
    // Rows are newest-first before starring: [b2newer, b1older]. Star the
    // second row (b1older) and confirm it both persists to the mock DB and
    // re-sorts to the top of the visible list.
    await page.evaluate(() => {
      document.querySelectorAll('.backup-row')[1].querySelector('.backup-star-btn').click();
    });
    await new Promise(r => setTimeout(r, 1500));

    const starredInDb = await readMockPath(page, '/inventory_backups/charA/b1older/starred');
    console.log('b1older.starred in mock DB:', starredInDb, '(expected true)');

    const rowOrderAfter = await page.evaluate(() =>
      [...document.querySelectorAll('.backup-row')].map(r => r.classList.contains('backup-row-starred')));
    console.log('row starred-highlight order after toggling [newer, older]:', rowOrderAfter, '(expected [true, false] — starred one moved to top)');

    const firstRowIsStarredAndOnTop = rowOrderAfter[0] === true && rowOrderAfter[1] === false;

    console.log('--- un-starring it again ---');
    await page.evaluate(() => document.querySelector('.backup-row.backup-row-starred .backup-star-btn').click());
    await new Promise(r => setTimeout(r, 1500));
    const starredAfterUnstar = await readMockPath(page, '/inventory_backups/charA/b1older/starred');
    console.log('b1older.starred after un-starring:', starredAfterUnstar, '(expected null/falsy)');

    const ok = starredInDb === true && firstRowIsStarredAndOnTop && !starredAfterUnstar;
    report(ok,
      'starring a backup persists to the DB, re-sorts it to the top, and un-starring reverses both',
      `starredInDb=${starredInDb}, rowOrderAfter=${JSON.stringify(rowOrderAfter)}, starredAfterUnstar=${starredAfterUnstar}`);
  } finally {
    await browser.close();
  }
}
run();
