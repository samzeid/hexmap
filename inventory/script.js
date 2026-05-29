window.InventorySystem = ({ database, auth }) => {

  // ── STATE ──────────────────────────────────────────────────────────────
  const state = {
    charName: '',
    carryCapacity: '',
    containers: [
      { id: 'equipped', name: 'Equipped',      rows: 1, collapsed: false, slots: null, permanent: true },
      { id: 'strapped', name: 'Strapped Gear', rows: 2, collapsed: false, slots: null, permanent: true },
    ]
  };

  // slots[r] = [leftSlot, rightSlot]  where slot = null | { name, variables }
  state.containers.forEach(c => {
    c.slots = Array.from({ length: c.rows }, () => [null, null]);
  });

  // ── ITEM LIBRARY ────────────────────────────────────────────────────────
  const Bulk = {
    PACKABLE:  { id: 'packable'  },
    STOCK:     { id: 'stock'     },
    BULKY:     { id: 'bulky'     },
    VERYBULKY: { id: 'verybulky' },
  };

  const ITEM_LIBRARY = [
    // Container items — occupy 1 slot but don't count toward carry capacity
    { name: "Backpack", bulk: Bulk.STOCK, description: `Holds gear. Does not count toward carry capacity.`, noCarry: true, containerRows: 4 },
    { name: "Satchel",  bulk: Bulk.STOCK, description: `Holds gear. Does not count toward carry capacity.`, noCarry: true, containerRows: 1 },

    { name: "Platinum Coins", bulk: Bulk.PACKABLE, description: `1 platinum coin = 10 gold coins`, variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
    { name: "Gold Coins",     bulk: Bulk.PACKABLE, description: `1 gold coin = 10 silver coins`,   variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
    { name: "Silver Coins",   bulk: Bulk.PACKABLE, description: `1 silver coin = 10 copper coins`, variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
    { name: "Copper Coins",   bulk: Bulk.PACKABLE, description: `Basic currency unit`,              variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },

    { name: "Bagpipes",   bulk: Bulk.BULKY,    description: `Play a known tune (DC 10), or improvise (DC 15)` },
    { name: "Drum",       bulk: Bulk.STOCK, description: `Play a known tune (DC 10), or improvise (DC 15)` },
    { name: "Dulcimer",   bulk: Bulk.BULKY,    description: `Play a known tune (DC 10), or improvise (DC 15)` },
    { name: "Flute",      bulk: Bulk.STOCK, description: `Play a known tune (DC 10), or improvise (DC 15)` },
    { name: "Lute",       bulk: Bulk.BULKY,    description: `Play a known tune (DC 10), or improvise (DC 15)` },
    { name: "Lyre",       bulk: Bulk.STOCK, description: `Play a known tune (DC 10), or improvise (DC 15)` },
    { name: "Pan Flute",  bulk: Bulk.STOCK, description: `Play a known tune (DC 10), or improvise (DC 15)` },
    { name: "Shawm",      bulk: Bulk.STOCK, description: `Play a known tune (DC 10), or improvise (DC 15)` },
    { name: "Viol",       bulk: Bulk.BULKY,    description: `Play a known tune (DC 10), or improvise (DC 15)` },

    { name: "Club",           bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d4 bludgeoning &mdash; light` },
    { name: "Dagger",         bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d4 piercing &mdash; finesse, light, thrown (20/60)` },
    { name: "Greatclub",      bulk: Bulk.BULKY,    description: `<i>simple weapon</i><br>1d8 bludgeoning &mdash; two-handed` },
    { name: "Handaxe",        bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d6 slashing &mdash; light, thrown (20/60)` },
    { name: "Javelin",        bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d6 piercing &mdash; thrown (30/120)` },
    { name: "Light Hammer",   bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d4 bludgeoning &mdash; light, thrown (20/60)` },
    { name: "Mace",           bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d6 bludgeoning` },
    { name: "Quarterstaff",   bulk: Bulk.BULKY,    description: `<i>simple weapon</i><br>1d6 bludgeoning &mdash; versatile (1d8)` },
    { name: "Sickle",         bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d4 slashing &mdash; light` },
    { name: "Spear",          bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d6 piercing &mdash; thrown (20/60), versatile (1d8)` },
    { name: "Light Crossbow", bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d8 piercing &mdash; range 80/320, loading, two-handed` },
    { name: "Dart",           bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d4 piercing &mdash; finesse, thrown (20/60)` },
    { name: "Shortbow",       bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d6 piercing &mdash; range 80/320, two-handed` },
    { name: "Sling",          bulk: Bulk.STOCK, description: `<i>simple weapon</i><br>1d4 bludgeoning &mdash; range 30/120` },
    { name: "Battleaxe",      bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d8 slashing &mdash; versatile (1d10)` },
    { name: "Flail",          bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d8 bludgeoning` },
    { name: "Glaive",         bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>1d10 slashing &mdash; heavy, reach, two-handed` },
    { name: "Greataxe",       bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>1d12 slashing &mdash; heavy, two-handed` },
    { name: "Greatsword",     bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>2d6 slashing &mdash; heavy, two-handed` },
    { name: "Halberd",        bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>1d10 slashing &mdash; heavy, reach, two-handed` },
    { name: "Lance",          bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>1d12 piercing &mdash; reach, special` },
    { name: "Longsword",      bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d8 slashing &mdash; versatile (1d10)` },
    { name: "Maul",           bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>2d6 bludgeoning &mdash; heavy, two-handed` },
    { name: "Morningstar",    bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d8 piercing` },
    { name: "Pike",           bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>1d10 piercing &mdash; heavy, reach, two-handed` },
    { name: "Rapier",         bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d8 piercing &mdash; finesse` },
    { name: "Scimitar",       bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d6 slashing &mdash; finesse, light` },
    { name: "Shortsword",     bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d6 piercing &mdash; finesse, light` },
    { name: "Trident",        bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d6 piercing &mdash; thrown (20/60), versatile (1d8)` },
    { name: "War Pick",       bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d8 piercing` },
    { name: "Warhammer",      bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d8 bludgeoning &mdash; versatile (1d10)` },
    { name: "Whip",           bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d4 slashing &mdash; finesse, reach` },
    { name: "Blowgun",        bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1 piercing &mdash; range 25/100, loading` },
    { name: "Hand Crossbow",  bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>1d6 piercing &mdash; range 30/120, light, loading` },
    { name: "Heavy Crossbow", bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>1d10 piercing &mdash; range 100/400, heavy, loading, two-handed` },
    { name: "Longbow",        bulk: Bulk.BULKY,    description: `<i>martial weapon</i><br>1d8 piercing &mdash; range 150/600, heavy, two-handed` },
    { name: "Net",            bulk: Bulk.STOCK, description: `<i>martial weapon</i><br>special, thrown (5/15)` },

    { name: "Shield",       bulk: Bulk.BULKY,    description: `+2 AC` },
    { name: "Light Armor",  bulk: Bulk.STOCK, description: `<i>light armor</i><br>AC 12 + Dex modifier` },
    { name: "Medium Armor", bulk: Bulk.BULKY,    description: `<i>medium armor</i><br>AC 14 + max 2 Dex. Stealth disadvantage.` },
    { name: "Heavy Armor",  bulk: Bulk.BULKY,    description: `<i>heavy armor</i><br>AC 16` },
    { name: "Half Plate",   bulk: Bulk.BULKY,    description: `<i>medium armor</i><br>AC 15 + max 2 Dex. Stealth disadvantage.` },
    { name: "Splint Armor", bulk: Bulk.BULKY,    description: `<i>heavy armor</i><br>AC 17` },
    { name: "Plate Armor",  bulk: Bulk.VERYBULKY, description: `<i>heavy armor</i><br>AC 18` },

    { name: "Rations",         bulk: Bulk.PACKABLE, description: `A day's rations.` },
    { name: "Mirror",          bulk: Bulk.PACKABLE, description: `A steel mirror for grooming, peeking around corners, or signalling.` },
    { name: "Tinderbox",       bulk: Bulk.PACKABLE, description: `Bonus action to light exposed fuel; 1 minute for covered material.` },
    { name: "Waterskin",       bulk: Bulk.STOCK, description: `Holds 4 pints of water.` },
    { name: "Chalk",           bulk: Bulk.PACKABLE, description: `Expend 1 charge to mark a surface.`, variables: { charges: { value: 5, control: "plusminus", min: 0, max: 5 } } },
    { name: "Rope",            bulk: Bulk.BULKY,    description: `50ft. DC 10 Sleight of Hand to tie. Bound creatures are Restrained (DC 15 Acrobatics or DC 20 Athletics to escape).` },
    { name: "Shovel",          bulk: Bulk.BULKY,    description: `1 hour to dig a 5-ft cube in dirt or loose material.` },
    { name: "Whistle",         bulk: Bulk.PACKABLE, description: `Audible up to 600 feet.` },
    { name: "Horn",            bulk: Bulk.STOCK, description: `Audible up to 600 feet.` },
    { name: "Manacles",        bulk: Bulk.STOCK, description: `Action to bind a Grappled/Incapacitated/Restrained creature (DC 13 Sleight of Hand). Restrained until DC 25 Dex/Str check or DC 15 lockpick.` },
    { name: "Grappling Hook",  bulk: Bulk.STOCK, description: `Action, throw 50 ft. Catches on DC 13 check. If tied to rope, can be climbed.` },
    { name: "Crowbar",         bulk: Bulk.STOCK, description: `Advantage on Strength checks where leverage applies.` },
    { name: "Lantern",         bulk: Bulk.STOCK, description: `30-ft bright, 30-ft dim light. Bonus action to hood (5-ft dim). Burns 1 Oil Flask charge/hour.` },
    { name: "Oil Flask",       bulk: Bulk.PACKABLE, description: `Fuel for lanterns, or coats objects to make them flammable.`, variables: { charges: { value: 5, control: "plusminus", min: 0, max: 5 } } },
    { name: "Torch",           bulk: Bulk.PACKABLE, description: `10 min of 20-ft bright, 20-ft dim light. Can be used as a simple melee weapon (1d4 bludgeoning or fire when lit).`, variables: { charges: { value: 6, control: "plusminus", min: 0, max: 6 } } },
    { name: "Healing Potion",  bulk: Bulk.STOCK, description: `Action: regain 2d4 + 2 hit points.` },
    { name: "Basic Poison",    bulk: Bulk.PACKABLE, description: `Bonus action to coat a weapon or 3 pieces of ammo. Hit target: DC 13 Con save or Poisoned for up to 1 minute.` },
    { name: "Antitoxin",       bulk: Bulk.PACKABLE, description: `Bonus action: advantage on saves vs Poisoned for 1 hour.` },
    { name: "Acid",            bulk: Bulk.STOCK, description: `Replace an attack: throw 20 ft, DC 13 Dex save or 2d6 acid damage. Destroyed on use.` },
    { name: "Alchemist's Fire", bulk: Bulk.STOCK, description: `Replace an attack: throw 20 ft, DC 13 Dex save or 1d4 fire damage + burning. Destroyed on use.` },
    { name: "Hunting Trap",    bulk: Bulk.BULKY,    description: `10 min to set. Triggered creature: DC 13 Dex save or 2d10 piercing + Grappled (DC 13 Athletics to escape).` },
    { name: "Caltrops",        bulk: Bulk.STOCK, description: `5-ft square. Entering creature: DC 13 Dex save or 1d4 damage + speed 0 until next turn.` },
    { name: "Ball Bearings",   bulk: Bulk.STOCK, description: `10-ft square. Entering creature: DC 13 Dex save or fall Prone.` },
    { name: "Ammunition Cache", bulk: Bulk.STOCK, description: `A single weapon's ammunition supply.` },

    { name: "Climber's Kit",         bulk: Bulk.BULKY,    description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Smith's Tools",         bulk: Bulk.BULKY,    description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Mason's Tools",         bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Woodcarver's Tools",    bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Leatherworker's Tools", bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Weaver's Tools",        bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Scribe's Supplies",     bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Painter's Supplies",    bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Jeweler's Tools",       bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Cook's Utensils",       bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Healer's Kit",          bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Poisoner's Kit",        bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Herbalism Kit",         bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Thieves' Tools",        bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Tinker's Tools",        bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Navigator's Tools",     bulk: Bulk.STOCK, description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Alchemist's Supplies",  bulk: Bulk.BULKY,    description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Disguise Kit",          bulk: Bulk.BULKY,    description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Glassblower's Tools",   bulk: Bulk.BULKY,    description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Potter's Tools",        bulk: Bulk.BULKY,    description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Brewer's Supplies",     bulk: Bulk.BULKY,    description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
    { name: "Camp Supplies",         bulk: Bulk.BULKY,    description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  ];

  // ── HELPERS ─────────────────────────────────────────────────────────────
  function getLibraryItem(name) {
    return ITEM_LIBRARY.find(i => i.name.toLowerCase() === name.trim().toLowerCase()) || null;
  }

  function isNoCarry(slotData) {
    if (!slotData) return false;
    if (slotData.isContainer) return true;
    const lib = getLibraryItem(slotData.name);
    return !!(lib && lib.noCarry);
  }

  function isContainerItem(slotData) {
    if (!slotData) return false;
    if (slotData.isContainer) return true;
    const lib = getLibraryItem(slotData.name);
    return !!(lib && lib.containerRows);
  }

  function containerHasItems(container) {
    return container.slots.some(row => row[0] !== null || row[1] !== null);
  }

  function createLinkedContainer(slotData, srcContainerId, r, c) {
    const lib = getLibraryItem(slotData.name);
    const rows = slotData.isContainer
      ? (slotData.containerRows || 2)
      : (lib && lib.containerRows) || 2;
    const linked = {
      id: `linked-${Date.now()}`,
      name: slotData.name,
      rows,
      collapsed: false,
      slots: Array.from({ length: rows }, () => [null, null]),
      linkedTo: { containerId: srcContainerId, r, c }
    };
    slotData.containerId = linked.id;
    state.containers.push(linked);
  }

  function updateCarryDisplay() {
    const used   = countCarry();
    const usedEl = document.getElementById('carry-used');
    const header = document.getElementById('char-header');
    usedEl.textContent = used;
    const max  = parseInt(state.carryCapacity);
    const over = !isNaN(max) && max > 0 && used > max;
    usedEl.classList.toggle('carry-over', over);
    header.classList.toggle('carry-over', over);
  }

  function countCarry() {
    let used = 0;
    for (const container of state.containers) {
      if (container.id === 'equipped') continue;
      for (const row of container.slots) {
        const [left, right] = row;
        if (left && isSlotBulky(left) && !left.conflict) {
          if (!isNoCarry(left)) used += 2;
        } else {
          if (left  && !isNoCarry(left))  used += 1;
          if (right && !isNoCarry(right)) used += 1;
        }
      }
    }
    return used;
  }

  function isSlotBulky(slotData) {
    if (!slotData) return false;
    const id = slotData.bulk ? slotData.bulk.id
              : (getLibraryItem(slotData.name) || {bulk: Bulk.STOCK}).bulk.id;
    return id === 'bulky' || id === 'verybulky';
  }

  // ── DOM REFS ────────────────────────────────────────────────────────────
  const containersEl = document.getElementById('containers');
  const dropdownEl   = document.getElementById('autocomplete-dropdown');
  const inspectorEl  = document.getElementById('inspector');

  // Active autocomplete context
  let acContainer = null, acRow = -1, acCol = -1, acInput = null;
  let ignoreNextBlur = false;

  // Drag state
  let dragState      = null;
  let ghostEl        = null;
  let longPressTimer = null;

  // ── RENDER ──────────────────────────────────────────────────────────────
  function growEquipped() {
    const equipped = state.containers.find(c => c.id === 'equipped');
    if (!equipped) return;
    const hasEmptyRow = equipped.slots.some(row => row[0] === null && row[1] === null);
    if (!hasEmptyRow) {
      equipped.slots.push([null, null]);
      equipped.rows++;
    }
  }

  function render() {
    growEquipped();
    containersEl.innerHTML = '';
    state.containers.forEach(c => containersEl.appendChild(buildCard(c)));
    updateCarryDisplay();
  }

  function buildCard(container) {
    const card = document.createElement('div');
    const specialClass = container.id === 'equipped' ? ' card-equipped'
                       : container.id === 'strapped'  ? ' card-strapped' : '';
    card.className = 'inv-card' + specialClass;

    const hdr = document.createElement('div');
    hdr.className = 'inv-hdr';

    const toggle = document.createElement('button');
    toggle.className = 'inv-hdr-toggle';
    toggle.innerHTML = `<span>${container.name}</span><span class="inv-chevron">${container.collapsed ? '▶' : '▼'}</span>`;
    toggle.addEventListener('click', () => { container.collapsed = !container.collapsed; render(); });

    hdr.appendChild(toggle);

    if (!container.permanent) {
      const del = document.createElement('button');
      del.className = 'inv-hdr-del';
      del.textContent = '✕';
      del.title = 'Remove container';
      del.addEventListener('click', () => {
        if (containerHasItems(container)) {
          if (!confirm(`${container.name} has items inside. Remove it anyway?`)) return;
        }
        // Clear the linked slot item if any
        if (container.linkedTo) {
          const { containerId, r, c } = container.linkedTo;
          const src = state.containers.find(cnt => cnt.id === containerId);
          if (src) src.slots[r][c] = null;
        }
        state.containers = state.containers.filter(cnt => cnt !== container);
        render();
      });
      hdr.appendChild(del);
    }
    card.appendChild(hdr);

    if (!container.collapsed) {
      const grid = document.createElement('div');
      grid.className = 'inv-grid';

      container.slots.forEach((row, r) => {
        const leftBulky = row[0] && isSlotBulky(row[0]) && !row[0].conflict;
        if (leftBulky) {
          grid.appendChild(buildSlot(container, r, 0, row[0], true));
        } else {
          grid.appendChild(buildSlot(container, r, 0, row[0], false));
          grid.appendChild(buildSlot(container, r, 1, row[1], false));
        }
      });

      card.appendChild(grid);
    }

    return card;
  }

  function buildSlot(container, r, c, slotData, full) {
    const conflict = slotData && slotData.conflict;

    const wrap = document.createElement('div');
    wrap.className = 'slot' + (full ? ' slot-full' : '');
    wrap.dataset.containerId = container.id;
    wrap.dataset.r = r;
    wrap.dataset.c = c;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'slot-input' + (slotData ? ' slot-filled' : '') + (conflict ? ' slot-conflict' : '');
    input.value = slotData ? slotData.name : '';
    input.placeholder = '—';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const prev = slotData ? slotData.name : '';

    input.addEventListener('focus', () => {
      acContainer = container; acRow = r; acCol = c; acInput = input;
      if (slotData) showInspector(slotData, container, r, c);
      updateDropdown(input.value);
    });

    input.addEventListener('input', () => updateDropdown(input.value));

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value.trim();
        if (val) commitSlot(val, container, r, c);
        else if (slotData) clearSlot(container, r, c);
        else closeDropdown();
      } else if (e.key === 'Escape') {
        input.value = prev;
        closeDropdown();
        input.blur();
      }
    });

    input.addEventListener('blur', () => {
      if (ignoreNextBlur) { ignoreNextBlur = false; return; }
      input.value = prev;
      closeDropdown();
    });

    wrap.appendChild(input);

    if (slotData) {
      const label = document.createElement('span');
      const isContainer = isNoCarry(slotData);
      label.className = 'slot-label'
        + (conflict     ? ' slot-label-conflict'   : '')
        + (isContainer  ? ' slot-label-container'  : '');
      const vars = Object.values(slotData.variables || {});
      const count = vars.length === 1 && typeof vars[0].value === 'number' ? vars[0].value : null;
      label.textContent = count !== null ? `${count} × ${slotData.name}` : slotData.name;
      wrap.appendChild(label);
    }

    if (conflict) {
      const warn = document.createElement('span');
      warn.className = 'slot-warn';
      warn.textContent = '⚠';
      warn.title = 'Item is too bulky — clear an adjacent slot to resolve';
      wrap.appendChild(warn);
    }

    if (slotData) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'slot-remove';
      removeBtn.textContent = '−';
      removeBtn.addEventListener('click', e => {
        e.stopPropagation();
        clearSlot(container, r, c);
      });
      wrap.appendChild(removeBtn);
    }

    if (slotData) {
      let downX, downY;

      wrap.addEventListener('pointerdown', e => {
        if (dragState || e.target.tagName === 'BUTTON') return;
        downX = e.clientX; downY = e.clientY;
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          startDrag(slotData, container, r, c, downX, downY);
        }, 380);
      });

      wrap.addEventListener('pointermove', e => {
        if (!longPressTimer) return;
        if ((e.clientX - downX) ** 2 + (e.clientY - downY) ** 2 > 64) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      });

      const cancelLong = () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      };
      wrap.addEventListener('pointerup',     cancelLong);
      wrap.addEventListener('pointercancel', cancelLong);
    }

    return wrap;
  }

  // ── SLOT MANAGEMENT ──────────────────────────────────────────────────────
  function commitSlot(name, container, r, c) {
    ignoreNextBlur = true;
    const libItem = getLibraryItem(name);
    const canonName = libItem ? libItem.name : name;
    const row = container.slots[r];
    const existing = row[c];

    const sameItem = existing && existing.name === canonName;
    const variables = sameItem
      ? existing.variables
      : (libItem ? JSON.parse(JSON.stringify(libItem.variables || {}))
                 : { count: { value: 1, control: 'both', min: 0 } });

    const slotData = {
      name: canonName,
      variables,
      ...(libItem ? {} : {
        custom: true,
        bulk: sameItem && existing.bulk ? existing.bulk : Bulk.STOCK,
        description: sameItem ? (existing.description || '') : '',
      }),
    };

    if (isSlotBulky(slotData)) {
      const otherCol = 1 - c;
      const displaced = row[otherCol];

      if (!displaced) {
        row[0] = slotData;
        row[1] = null;
      } else {
        const target = findEmptySlot(container, r);
        if (target) {
          container.slots[target.r][target.c] = displaced;
          row[0] = slotData;
          row[1] = null;
        } else {
          slotData.conflict = true;
          row[c] = slotData;
        }
      }
    } else {
      row[c] = slotData;
    }

    // Determine where the item actually landed
    const finalC = (isSlotBulky(slotData) && !slotData.conflict) ? 0 : c;
    if (isContainerItem(slotData) && !slotData.containerId) {
      createLinkedContainer(slotData, container.id, r, finalC);
    }

    closeDropdown();
    render();
    showInspector(slotData, container, r, c);
  }

  function findEmptySlot(container, excludeRow) {
    for (let r = 0; r < container.slots.length; r++) {
      if (r === excludeRow) continue;
      const [left, right] = container.slots[r];
      if (left && isSlotBulky(left)) continue; // row fully taken by bulky item
      if (!left)  return { r, c: 0 };
      if (!right) return { r, c: 1 };
    }
    return null;
  }

  function clearSlot(container, r, c) {
    ignoreNextBlur = true;
    const slotData = container.slots[r][c];

    if (slotData && slotData.containerId) {
      const linked = state.containers.find(cnt => cnt.id === slotData.containerId);
      if (linked && containerHasItems(linked)) {
        if (!confirm(`${slotData.name} has items inside. Remove it anyway?`)) {
          ignoreNextBlur = false;
          return;
        }
      }
      state.containers = state.containers.filter(cnt => cnt.id !== slotData.containerId);
    }

    container.slots[r][c] = null;
    closeDropdown();
    render();
    hideInspector();
  }

  // ── AUTOCOMPLETE ─────────────────────────────────────────────────────────
  function updateDropdown(query) {
    query = (query || '').trim().toLowerCase();
    if (!query) { closeDropdown(); return; }

    const matches = ITEM_LIBRARY.filter(i => i.name.toLowerCase().includes(query)).slice(0, 10);
    if (!matches.length) { closeDropdown(); return; }

    dropdownEl.innerHTML = '';
    matches.forEach(item => {
      const opt = document.createElement('div');
      opt.className = 'ac-opt';
      const bid = item.bulk.id;
      const tag = bid !== 'stock'
        ? `<span class="ac-tag ${bid}">${bid}</span>` : '';
      opt.innerHTML = `<span class="ac-name">${item.name}</span>${tag}`;

      const pick = () => {
        ignoreNextBlur = true;
        if (acContainer !== null) commitSlot(item.name, acContainer, acRow, acCol);
        closeDropdown();
      };
      opt.addEventListener('mousedown', e => { e.preventDefault(); pick(); });
      opt.addEventListener('touchstart', e => { e.preventDefault(); pick(); }, { passive: false });
      dropdownEl.appendChild(opt);
    });

    positionDropdown();
    dropdownEl.hidden = false;
  }

  function positionDropdown() {
    if (!acInput) return;
    const rect = acInput.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    dropdownEl.style.left  = `${rect.left}px`;
    dropdownEl.style.width = `${rect.width}px`;
    if (spaceBelow >= 160 || spaceBelow >= window.innerHeight - rect.top) {
      dropdownEl.style.top    = `${rect.bottom + 2}px`;
      dropdownEl.style.bottom = 'auto';
    } else {
      dropdownEl.style.top    = 'auto';
      dropdownEl.style.bottom = `${window.innerHeight - rect.top + 2}px`;
    }
  }

  function closeDropdown() {
    dropdownEl.hidden = true;
    dropdownEl.innerHTML = '';
  }

  // ── INSPECTOR ────────────────────────────────────────────────────────────
  function showInspector(slotData, container, r, c) {
    const lib = getLibraryItem(slotData.name);
    document.getElementById('insp-name').textContent = slotData.name;

    const descP    = document.getElementById('insp-desc');
    const descEdit = document.getElementById('insp-desc-edit');
    if (slotData.custom) {
      descP.hidden = true;
      descEdit.hidden = false;
      descEdit.value = slotData.description || '';
      descEdit.oninput = () => { slotData.description = descEdit.value; };
    } else {
      descP.hidden = false;
      descEdit.hidden = true;
      descP.innerHTML = lib ? lib.description : '';
    }

    document.getElementById('insp-remove').onclick = () => clearSlot(container, r, c);

    // Size selector — custom items only
    const sizeEl = document.getElementById('insp-size');
    if (slotData.custom) {
      sizeEl.hidden = false;
      const currentId = slotData.bulk ? slotData.bulk.id : 'stock';
      sizeEl.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bulk === currentId);
        btn.onclick = () => {
          const newBulk = Bulk[btn.dataset.bulk.toUpperCase()] || Bulk.STOCK;
          const row = container.slots[r];
          // If was spanning, clear the span slot before re-placing
          if (isSlotBulky(slotData) && !slotData.conflict && c === 0 && row[1] === null) {
            row[1] = null; // already null, stays empty
          }
          row[c] = null;
          slotData.bulk = newBulk;
          placeSlotData(slotData, container, r, c);
          showInspector(slotData, container, r, c);
        };
      });
    } else {
      sizeEl.hidden = true;
    }

    // Container toggle — custom items only
    const containerSectionEl = document.getElementById('insp-container-section');
    if (slotData.custom) {
      containerSectionEl.hidden = false;
      const toggleBtn  = document.getElementById('insp-container-btn');
      const rowsRowEl  = document.getElementById('insp-container-rows-row');
      const rowsInput  = document.getElementById('insp-container-rows');

      toggleBtn.classList.toggle('active', !!slotData.isContainer);
      toggleBtn.textContent = slotData.isContainer ? 'On' : 'Off';
      rowsRowEl.hidden = !slotData.isContainer;
      rowsInput.value  = slotData.containerRows || 2;

      toggleBtn.onclick = () => {
        if (slotData.isContainer) {
          // Turn container off
          if (slotData.containerId) {
            const linked = state.containers.find(cnt => cnt.id === slotData.containerId);
            if (linked && containerHasItems(linked)) {
              if (!confirm(`This will remove the ${slotData.name} container and its contents. Continue?`)) return;
            }
            if (linked) state.containers = state.containers.filter(cnt => cnt !== linked);
            slotData.containerId = null;
          }
          slotData.isContainer = false;
        } else {
          // Turn container on
          slotData.isContainer = true;
          slotData.containerRows = slotData.containerRows || 2;
          if (!slotData.containerId) createLinkedContainer(slotData, container.id, r, c);
        }
        render();
        showInspector(slotData, container, r, c);
      };

      rowsInput.onchange = () => {
        slotData.containerRows = Math.max(1, Math.min(20, parseInt(rowsInput.value) || 2));
        if (slotData.containerId) {
          const linked = state.containers.find(cnt => cnt.id === slotData.containerId);
          if (linked) {
            const target = slotData.containerRows;
            while (linked.slots.length < target) linked.slots.push([null, null]);
            while (linked.slots.length > target) {
              const last = linked.slots[linked.slots.length - 1];
              if (last[0] === null && last[1] === null) linked.slots.pop();
              else break;
            }
            linked.rows = linked.slots.length;
            render();
          }
        }
      };
    } else {
      containerSectionEl.hidden = true;
    }

    const varsEl = document.getElementById('insp-vars');
    varsEl.innerHTML = '';

    for (const [key, meta] of Object.entries(slotData.variables || {})) {
      const div = document.createElement('div');
      div.className = 'insp-var';
      const canStep = meta.control === 'plusminus' || meta.control === 'both';
      const canType = meta.control === 'set'       || meta.control === 'both';
      div.innerHTML = `
        <div class="insp-ctrl">
          ${canStep ? `<button class="insp-btn" data-k="${key}" data-d="-1">−</button>` : ''}
          ${canType
            ? `<input class="insp-num" type="number" value="${meta.value}" data-k="${key}"
                ${typeof meta.min === 'number' ? `min="${meta.min}"` : ''}
                ${typeof meta.max === 'number' ? `max="${meta.max}"` : ''} />`
            : `<span class="insp-val" data-k="${key}">${meta.value}</span>`}
          ${canStep ? `<button class="insp-btn" data-k="${key}" data-d="1">+</button>` : ''}
        </div>
      `;
      varsEl.appendChild(div);
    }

    varsEl.querySelectorAll('.insp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = slotData.variables[btn.dataset.k];
        let v = m.value + parseInt(btn.dataset.d);
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        render();
        showInspector(slotData, container, r, c);
      });
    });

    varsEl.querySelectorAll('.insp-num').forEach(inp => {
      inp.addEventListener('change', () => {
        const m = slotData.variables[inp.dataset.k];
        let v = parseInt(inp.value);
        if (isNaN(v)) return;
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        inp.value = v;
        render();
        showInspector(slotData, container, r, c);
      });
    });

    inspectorEl.hidden = false;
  }

  function hideInspector() { inspectorEl.hidden = true; }

  document.getElementById('insp-close').addEventListener('click', hideInspector);

  document.addEventListener('pointerdown', e => {
    if (!inspectorEl.hidden &&
        !inspectorEl.contains(e.target) &&
        !e.target.classList.contains('slot-input')) {
      hideInspector();
    }
  });

  // ── CHARACTER FIELDS ──────────────────────────────────────────────────────
  document.getElementById('char-name').addEventListener('input', e => { state.charName = e.target.value; });
  document.getElementById('char-carry').addEventListener('input', e => {
    state.carryCapacity = e.target.value;
    updateCarryDisplay();
  });

  // ── DRAG & DROP ───────────────────────────────────────────────────────────
  function startDrag(slotData, container, r, c, x, y) {
    // Remove item from source slot
    container.slots[r][c] = null;

    dragState = { slotData, srcContainer: container, srcR: r, srcC: c };

    ghostEl = document.createElement('div');
    ghostEl.className = 'drag-ghost';
    ghostEl.textContent = slotData.name;
    document.body.appendChild(ghostEl);
    document.body.classList.add('is-dragging');

    moveGhost(x, y);
    closeDropdown();
    if (document.activeElement) document.activeElement.blur();
    render();
  }

  function moveGhost(x, y) {
    if (!ghostEl) return;
    ghostEl.style.left = `${x}px`;
    ghostEl.style.top  = `${y}px`;
  }

  function endDrag(x, y) {
    if (!dragState) return;

    ghostEl.style.visibility = 'hidden';
    const el = document.elementFromPoint(x, y);
    ghostEl.remove();
    ghostEl = null;
    document.body.classList.remove('is-dragging');

    const wrap = el && el.closest('[data-container-id]');
    const targetContainer = wrap && state.containers.find(c => c.id === wrap.dataset.containerId);

    if (targetContainer) {
      const tR = parseInt(wrap.dataset.r);
      const tC = parseInt(wrap.dataset.c);
      const targetItem = targetContainer.slots[tR][tC];

      // Swap: if target slot has an item, send it back to the source slot
      if (targetItem) {
        targetContainer.slots[tR][tC] = null;
        dragState.srcContainer.slots[dragState.srcR][dragState.srcC] = targetItem;
      }

      placeSlotData(dragState.slotData, targetContainer, tR, tC);
    } else {
      // Dropped outside a valid slot — return to source
      placeSlotData(dragState.slotData, dragState.srcContainer, dragState.srcR, dragState.srcC);
    }

    dragState = null;
  }

  function placeSlotData(slotData, container, r, c) {
    slotData.conflict = false;
    const row = container.slots[r];
    let finalC = c;

    if (isSlotBulky(slotData)) {
      const otherCol = 1 - c;
      const displaced = row[otherCol];

      if (!displaced) {
        row[0] = slotData; row[1] = null; finalC = 0;
      } else {
        const target = findEmptySlot(container, r);
        if (target) {
          container.slots[target.r][target.c] = displaced;
          row[0] = slotData; row[1] = null; finalC = 0;
        } else {
          slotData.conflict = true;
          row[c] = slotData;
        }
      }
    } else {
      row[c] = slotData;
    }

    // Keep linked container's back-reference in sync
    if (slotData.containerId) {
      const linked = state.containers.find(cnt => cnt.id === slotData.containerId);
      if (linked) linked.linkedTo = { containerId: container.id, r, c: finalC };
    } else if (isContainerItem(slotData)) {
      createLinkedContainer(slotData, container.id, r, finalC);
    }

    render();
  }

  document.addEventListener('pointermove', e => {
    if (dragState) moveGhost(e.clientX, e.clientY);
  });

  document.addEventListener('pointerup', e => {
    if (dragState) endDrag(e.clientX, e.clientY);
  });

  // ── INIT ──────────────────────────────────────────────────────────────────
  render();

  return {};
};
