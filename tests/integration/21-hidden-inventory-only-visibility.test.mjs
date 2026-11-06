// Feature: a 4th character-visibility state, hidden-inventory-only,
// combining 'hidden' (not listed in the tab bar for players at all) with
// 'inventory-only' (character sheet force-closed if a player already has
// it open) -- a DM convenience so both don't need setting separately.
// Also verifies the DM-facing fix this was built alongside: each non-
// visible character's tab now shows its OWN distinguishing icon (not just
// a uniform dim), so a DM can tell inventory-only apart from hidden/
// hidden-inventory-only at a glance instead of only via the shared
// hide-button after selecting that character.
import { launchBrowser, openCharInventory, basicContainers, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      // Owned by the DM so it's what auto-selects on load (ensureCharSelected
      // prefers a character you own) -- keeps the click-cycle test below from
      // clicking an already-active tab (which toggles it off) instead of
      // actually switching to charInvOnly/charHiddenInvOnly.
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
      charHiddenInvOnly: {
        ownerUid: 'playerB', ownerName: 'PlayerB',
        charVisibility: 'hidden-inventory-only',
        state: JSON.stringify({ charName: 'HiddenInvOnlyChar', carryCapacity: '', containers: basicContainers([[null, null]]) }),
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
    // --- DM view: both characters listed, each with its own icon ---
    const dmPage = await browser.newPage();
    await openCharInventory(dmPage, { testUid: 'dmUser', testName: 'DM', seedTree: seedTree() });
    await new Promise(r => setTimeout(r, 500));

    const dmTabInfo = await dmPage.evaluate(() => {
      const tabs = [...document.querySelectorAll('.char-tab')];
      return tabs.map(t => ({
        name: t.querySelector('.char-tab-name')?.textContent.trim(),
        icon: t.querySelector('.char-tab-vis-icon')?.className || null,
        red: !!t.querySelector('.char-tab-vis-icon-red'),
      }));
    });
    console.log('DM sees tabs:', JSON.stringify(dmTabInfo));

    const invOnlyTab = dmTabInfo.find(t => t.name?.includes('InvOnlyChar') && !t.name?.includes('Hidden'));
    const hiddenInvOnlyTab = dmTabInfo.find(t => t.name?.includes('HiddenInvOnlyChar'));
    const invOnlyHasIcon = invOnlyTab?.icon?.includes('fa-eye-low-vision') && !invOnlyTab.red;
    const hiddenInvOnlyHasRedIcon = hiddenInvOnlyTab?.icon?.includes('fa-eye-low-vision') && hiddenInvOnlyTab.red;
    console.log('inventory-only tab has its own (non-red) icon:', invOnlyHasIcon);
    console.log('hidden-inventory-only tab has the same icon but RED:', hiddenInvOnlyHasRedIcon);

    // --- Cycling the hide button on the DM's own (auto-selected, starts
    // 'visible') character walks visible -> inventory-only -> hidden ->
    // hidden-inventory-only -> back to visible, in that order ---
    const readBtnState = () => dmPage.evaluate(() => {
      const btn = document.getElementById('char-hide-btn');
      return { icon: btn.querySelector('i')?.className, fully: btn.classList.contains('char-hide-fully'), active: btn.classList.contains('char-hide-active') };
    });
    const clickHideBtn = () => dmPage.evaluate(() => document.getElementById('char-hide-btn').click());

    const states = [];
    states.push(await readBtnState()); // starts at visible (dmOwnedChar's default)
    await clickHideBtn(); await new Promise(r => setTimeout(r, 150)); states.push(await readBtnState()); // -> inventory-only
    await clickHideBtn(); await new Promise(r => setTimeout(r, 150)); states.push(await readBtnState()); // -> hidden
    await clickHideBtn(); await new Promise(r => setTimeout(r, 150)); states.push(await readBtnState()); // -> hidden-inventory-only
    await clickHideBtn(); await new Promise(r => setTimeout(r, 150)); states.push(await readBtnState()); // -> visible
    console.log('hide-button states through one full cycle:', JSON.stringify(states));
    const iconClasses = s => s.icon.split(' ');
    const cycleCorrect = !states[0].active && !states[0].fully && iconClasses(states[0]).includes('fa-eye')
      && states[1].active && !states[1].fully && iconClasses(states[1]).includes('fa-eye-low-vision')
      && !states[2].active && states[2].fully && iconClasses(states[2]).includes('fa-eye-slash')
      && !states[3].active && states[3].fully && iconClasses(states[3]).includes('fa-eye-low-vision')
      && !states[4].active && !states[4].fully && iconClasses(states[4]).includes('fa-eye');
    console.log('full click-cycle reached hidden-inventory-only in the right order:', cycleCorrect);

    // --- Player view: hidden-inventory-only character must not appear at all ---
    const playerPage = await browser.newPage();
    await openCharInventory(playerPage, { testUid: 'playerB', testName: 'PlayerB' });
    await new Promise(r => setTimeout(r, 500));
    const playerSeesHidden = await playerPage.evaluate(() =>
      [...document.querySelectorAll('.char-tab')].some(t => t.querySelector('.char-tab-name')?.textContent.includes('HiddenInvOnlyChar')));
    console.log('player (owner of the hidden-inventory-only char) sees its tab:', playerSeesHidden, '(expected false)');

    report(invOnlyHasIcon && hiddenInvOnlyHasRedIcon && cycleCorrect && !playerSeesHidden,
      'hidden-inventory-only combines hidden-from-tab-list with a distinct red icon for the DM, the click-cycle reaches it correctly, and each state shows its own icon',
      `unexpected result: invOnlyHasIcon=${invOnlyHasIcon}, hiddenInvOnlyHasRedIcon=${hiddenInvOnlyHasRedIcon}, cycleCorrect=${cycleCorrect}, playerSeesHidden=${playerSeesHidden}`);
  } finally {
    await browser.close();
  }
}
run();
