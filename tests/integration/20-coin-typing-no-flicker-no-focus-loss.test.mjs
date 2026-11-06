// Bug report: "when my coins change it does a weird back and forth of
// setting it to what it will be, and what it was... it also loses focus if
// I'm typing." Root cause: every keystroke in a coin/qty inspector input
// called render(), which unconditionally ends with onChange() ->
// handleInventoryChange() -> saveChar() -- with NO debounce at all. Typing
// a multi-digit number fired one independent Firebase transaction per
// keystroke; once enough of them overlapped, saveChar()'s own completion
// callback (which was never guarded against a newer pending local edit)
// could apply a now-stale merged result on top of what the user was still
// typing -- reloading the inspector and destroying/rebuilding the very
// input being typed into (focus loss), momentarily showing an old value
// (the "back and forth" flicker) before the next save caught up.
//
// Fixed two ways: (1) saveChar() now debounces non-immediate calls, so a
// burst of keystrokes coalesces into one trailing save instead of one per
// keystroke; (2) saveChar()'s own completion callback now checks
// dirty/localWriteInFlight before applying a merged result, the same
// protection the live-sync listener already had, so even an overlapping
// save's late completion can't clobber a newer pending edit.
//
// This test types a multi-digit number into a coin field keystroke-by-
// keystroke (real `input` events, matching a real browser) and verifies
// the exact same <input> DOM node survives the whole sequence (proving no
// destructive inspector rebuild happened) and stays focused throughout,
// then confirms the final value is what was actually typed once it's
// persisted.
import { launchBrowser, openCharInventory, openCoinInspectorAt, readServerCharState, basicContainers, coinPurse, report } from './helpers.mjs';

function seedTree() {
  return {
    inventory_characters: {
      charA: {
        ownerUid: 'playerA', ownerName: 'PlayerA',
        state: JSON.stringify({ charName: 'CharA', carryCapacity: '', containers: basicContainers([[coinPurse(0), null]]) }),
        createdAt: 1,
      },
    },
  };
}

async function run() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await openCharInventory(page, { testUid: 'playerA', testName: 'PlayerA', seedTree: seedTree() });

    await openCoinInspectorAt(page, 'strapped', 0, 0);
    await page.evaluate(() => {
      const inp = document.querySelector('.insp-num-coin[data-k="gp"]');
      inp.__testMarker = 'original-node';
      inp.focus();
    });

    console.log('--- typing "250" into the gp field keystroke by keystroke ---');
    for (const partial of ['2', '25', '250']) {
      await page.evaluate(partial => {
        const inp = document.querySelector('.insp-num-coin[data-k="gp"]');
        inp.value = partial;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }, partial);
      await new Promise(r => setTimeout(r, 120)); // roughly real typing cadence
    }

    const stillSameNode = await page.evaluate(() =>
      document.querySelector('.insp-num-coin[data-k="gp"]')?.__testMarker === 'original-node');
    const stillFocused = await page.evaluate(() =>
      document.activeElement === document.querySelector('.insp-num-coin[data-k="gp"]'));
    console.log('same input DOM node survived typing (no destructive rebuild):', stillSameNode, '(expected true)');
    console.log('input still focused after typing:', stillFocused, '(expected true)');

    // Give the debounced save (and any in-flight completion) time to fully
    // settle before checking what actually persisted.
    await new Promise(r => setTimeout(r, 2500));

    const finalState = await readServerCharState(page, 'charA');
    const purse = finalState.containers.flatMap(c => c.slots.flat()).find(s => s && s._ref === 50);
    const finalGp = purse?._vars?.gp;
    console.log('final persisted gp:', finalGp, '(expected 250)');

    report(stillSameNode && stillFocused && finalGp === 250,
      'typing into a coin field kept the same focused input the whole time and persisted the final value correctly',
      `regression: sameNode=${stillSameNode}, stillFocused=${stillFocused}, finalGp=${finalGp}`);
  } finally {
    await browser.close();
  }
}
run();
