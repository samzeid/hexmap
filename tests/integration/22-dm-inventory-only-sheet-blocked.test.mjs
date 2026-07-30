// Bug: DM mode was fully exempt from charVisibility enforcement (both
// canOpenStats() and enforceCharVisibility() short-circuited on
// window._isDM), so a DM could still view an inventory-only character's
// full stats sheet -- the same restriction correctly applied to players
// simply didn't apply to the DM at all. Fixed: DM is only exempt from the
// TAB-LIST filtering (still sees hidden/hidden-inventory-only characters
// in the tab bar, unlike a player), but the sheet-hiding rule itself
// (inventory-only / hidden-inventory-only) now applies uniformly to DM and
// players alike -- the DM can reach the character via the tab bar, but
// only its inventory, same as anyone else.
import { launchBrowser, openCharInventory, basicContainers, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      // Owned by the DM so it auto-selects on load (visible, stats open by
      // default) -- gives a clean starting point to switch away from.
      dmOwnedChar: {
        ownerUid: 'dmUser', ownerName: 'DM',
        state: JSON.stringify({ charName: 'DMOwnedChar', carryCapacity: '', containers: basicContainers([[null, null]]) }),
        createdAt: 0,
      },
      charInvOnly: {
        ownerUid: 'playerA', ownerName: 'PlayerA',
        charVisibility: 'inventory-only',
        state: JSON.stringify({ charName: 'InvOnlyChar', carryCapacity: '', containers: basicContainers([[null, null]]) }),
        createdAt: 1,
      },
      charHidden: {
        ownerUid: 'playerB', ownerName: 'PlayerB',
        charVisibility: 'hidden',
        state: JSON.stringify({ charName: 'HiddenChar', carryCapacity: '', containers: basicContainers([[null, null]]) }),
        createdAt: 2,
      },
    },
    inventory_dm_users: { dmUser: true },
    inventory_roles: { dmUser: 'dm' },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const dmPage = await browser.newPage();
    await openCharInventory(dmPage, { testUid: 'dmUser', testName: 'DM', seedTree: seedTree() });
    await new Promise(r => setTimeout(r, 500));

    const showingInventory = () => dmPage.evaluate(() =>
      document.getElementById('char-panels').classList.contains('show-inventory'));

    // openCharInventory() explicitly lands in the inventory view, not
    // stats, so the character sheet needs to be opened once first to give
    // "switching to an inventory-only character force-closes it" something
    // real to force closed.
    await dmPage.evaluate(() => {
      document.getElementById('hamburger-btn').click();
      document.getElementById('menu-character-btn').click();
    });
    await new Promise(r => setTimeout(r, 300));
    console.log('on own (visible) character, sheet opened successfully (expected true):', !(await showingInventory()));

    console.log('--- DM switches to InvOnlyChar (owned by playerA, inventory-only) ---');
    await dmPage.evaluate(() => {
      const tab = [...document.querySelectorAll('.char-tab')].find(t => t.querySelector('.char-tab-name')?.textContent.includes('InvOnlyChar'));
      tab.click();
    });
    await new Promise(r => setTimeout(r, 300));
    const forcedToInventory = await showingInventory();
    console.log('switching to it force-closed the stats sheet (expected true):', forcedToInventory);

    console.log('--- DM tries to explicitly reopen the character sheet via the hamburger menu ---');
    await dmPage.evaluate(() => {
      document.getElementById('hamburger-btn').click();
      document.getElementById('menu-character-btn').click();
    });
    await new Promise(r => setTimeout(r, 300));
    const stillBlocked = await showingInventory();
    console.log('sheet stayed blocked after trying to reopen it (expected true):', stillBlocked);

    console.log('--- DM should still see the fully-hidden character in the tab bar (unlike a player) ---');
    const dmSeesHiddenTab = await dmPage.evaluate(() =>
      [...document.querySelectorAll('.char-tab')].some(t => t.querySelector('.char-tab-name')?.textContent.includes('HiddenChar')));
    console.log('DM sees HiddenChar in the tab bar (expected true):', dmSeesHiddenTab);

    report(forcedToInventory && stillBlocked && dmSeesHiddenTab,
      "DM is blocked from an inventory-only character's sheet exactly like a player, but still sees hidden characters in the tab bar",
      `unexpected result: forcedToInventory=${forcedToInventory}, stillBlocked=${stillBlocked}, dmSeesHiddenTab=${dmSeesHiddenTab}`);
  } finally {
    await browser.close();
  }
}
run();
