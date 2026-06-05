window.InventorySystem = ({ database, auth, onChange, onCrossCharDrop, onShopPurchase, isHiddenFromPlayer, onSound }) => {

  // ── STATE ──────────────────────────────────────────────────────────────
  function createDefaultContainers() {
    return [
      { id: 'equipped', name: 'Equipped',      rows: 1, collapsed: false, permanent: true, slots: [[null,null]] },
      { id: 'strapped', name: 'Strapped Gear', rows: 2, collapsed: false, permanent: true, slots: [[null,null],[null,null]] },
    ];
  }

  const state = { charName: '', carryCapacity: '', containers: createDefaultContainers() };

  // ── ITEM LIBRARY (defined in items.js) ──────────────────────────────────
  const Bulk           = window.Bulk;
  const ITEM_LIBRARY   = window.ITEM_LIBRARY;
  const WEAPON_OPTIONS = window.WEAPON_OPTIONS;
  const ARMOR_OPTIONS    = window.ARMOR_OPTIONS;
  const ELEMENT_OPTIONS  = window.ELEMENT_OPTIONS;


  // ── HELPERS ─────────────────────────────────────────────────────────────
  function getLibraryItem(name) {
    if (!name || typeof name !== 'string') return null;
    const key = name.trim().toLowerCase();
    return ITEM_LIBRARY.find(i => i.name && (
      i.name.toLowerCase() === key ||
      (i.aliases && i.aliases.some(a => a.toLowerCase() === key))
    )) || null;
  }

  function getLibraryItemSection(name) {
    let section = null;
    for (const item of ITEM_LIBRARY) {
      if (item._section) section = item._section;
      if (item.name && item.name === name) return section;
    }
    return null;
  }

  function getEffectiveCategory(slotData) {
    if (slotData.custom) {
      return slotData.category || (slotData.isContainer ? 'container' : slotData.isWeapon ? 'weapon' : '');
    }
    // Derive from variables first (catches magical weapons/armor)
    if (slotData.variables && slotData.variables.weapon) return 'weapon';
    if (slotData.variables && slotData.variables.armor)  return 'armor';
    // Check explicit category on the library item definition
    const lib = getLibraryItem(slotData.name);
    if (lib && lib.category) return lib.category;
    // Fall back to section
    const section = getLibraryItemSection(slotData.name);
    if (section === 'Simple Weapons' || section === 'Martial Weapons' || section === 'Magical Weapons') return 'weapon';
    if (section === 'Armor & Shields') return slotData.name === 'Shield' ? 'shield' : 'armor';
    return null;
  }

  function computeDisplayName(slotData) {
    let name = slotData.name || '';
    const wv = slotData.variables && slotData.variables.weapon;
    const av = slotData.variables && slotData.variables.armor;
    const ev = slotData.variables && slotData.variables.element;
    if (wv && wv.control === 'select' && wv.value) name = name.replace('Weapon', wv.value);
    if (av && av.control === 'select' && av.value) name = name.replace('Armor', av.value);
    if (ev && ev.control === 'select' && ev.value) name = name.replace('Elemental', ev.value);
    const sv = slotData.variables && slotData.variables.spell;
    if (sv && sv.control === 'select' && sv.value) name = name.replace('Spell Storing', sv.value);
    const crv = slotData.variables && slotData.variables.creature;
    if (crv && crv.control === 'select' && crv.value) name = name.replace('Creature', crv.value);
    return name;
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

  // Migrate old packableGroup data — flatten groups into individual items in slots
  function flattenPackableGroups(containers) {
    containers.forEach(container => {
      for (let r = 0; r < container.slots.length; r++) {
        for (let c = 0; c < 2; c++) {
          const slot = container.slots[r][c];
          if (!slot || !slot.packableGroup) continue;
          const items = slot.items || [];
          container.slots[r][c] = items[0] || null;
          for (let i = 1; i < items.length; i++) {
            let placed = false;
            for (let rr = 0; rr < container.slots.length; rr++) {
              if (!container.slots[rr][0]) { container.slots[rr][0] = items[i]; placed = true; break; }
              if (!container.slots[rr][1]) { container.slots[rr][1] = items[i]; placed = true; break; }
            }
            if (!placed) { container.slots.push([items[i], null]); container.rows++; }
          }
        }
      }
    });
  }

  function containerHasItems(container) {
    return container.slots.some(row => row[0] !== null || row[1] !== null);
  }

  function createLinkedContainer(slotData, srcContainerId, r, c) {
    const lib = getLibraryItem(slotData.name);
    const maxRows = slotData.isContainer
      ? (slotData.containerRows || 2)
      : (lib && lib.containerRows) || 2;
    const linked = {
      id: `linked-${Date.now()}`,
      name: slotData.name,
      rows: 1,
      maxRows,
      collapsed: false,
      slots: [[null, null]],
      linkedTo: { containerId: srcContainerId, r, c }
    };
    slotData.containerId = linked.id;
    state.containers.push(linked);
  }

  function updateCurrencyDisplay() {
    const el = document.getElementById('coin-counter');
    if (!el) return;
    let pp = 0, gp = 0, sp = 0, cp = 0;
    for (const container of state.containers) {
      for (const row of container.slots) {
        for (const slot of row) {
          if (!slot || !slot.variables) continue;
          const v = slot.variables;
          if (v.pp) pp += v.pp.value || 0;
          if (v.gp) gp += v.gp.value || 0;
          if (v.sp) sp += v.sp.value || 0;
          if (v.cp) cp += v.cp.value || 0;
        }
      }
    }
    el.innerHTML = [
      `<span class="coin-pp"><i class="fas fa-coins coin-icon"></i> ${pp}pp</span>`,
      `<span class="coin-gp"><i class="fas fa-coins coin-icon"></i> ${gp}gp</span>`,
      `<span class="coin-sp"><i class="fas fa-coins coin-icon"></i> ${sp}sp</span>`,
      `<span class="coin-cp"><i class="fas fa-coins coin-icon"></i> ${cp}cp</span>`,
      `<span id="carry-compact" class="carry-compact-label"></span>`,
    ].join('');
    el.hidden = false;
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
    const compact = document.getElementById('carry-compact');
    if (compact) {
      compact.innerHTML = '';
      const icon = document.createElement('i');
      icon.className = 'fas fa-weight-hanging';
      icon.style.cssText = 'font-size:10px;opacity:0.7;';
      compact.appendChild(icon);
      compact.appendChild(document.createTextNode(` ${used}/${state.carryCapacity || '—'}`));
      compact.classList.toggle('carry-compact-over', over);
    }
  }

  function countCarry() {
    // Build the set of containers rooted in 'equipped' (direct and nested)
    const exempt = new Set(['equipped']);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of state.containers) {
        if (!exempt.has(c.id) && c.linkedTo && exempt.has(c.linkedTo.containerId)) {
          exempt.add(c.id);
          changed = true;
        }
      }
    }

    let used = 0;
    for (const container of state.containers) {
      if (exempt.has(container.id)) continue;
      const libC = container.linkedTo ? getLibraryItem(container.name) : null;
      if (libC && libC.weightlessContents) continue;
      if (libC && libC.fixedCarryWeight != null) continue;
      for (const row of container.slots)
        for (const slot of row)
          if (slot && !isNoCarry(slot)) used += itemFillCost(slot, container);
    }

    return parseFloat(used.toFixed(2));
  }

  function itemFillCost(slotData, container) {
    if (!slotData) return 0;
    const lib = getLibraryItem(slotData.name);
    if (slotData.category === 'ammunition' || lib?.category === 'ammunition') {
      if (!container) return 0;
      const cLib = container.linkedTo ? getLibraryItem(container.name) : null;
      if (cLib?.fixedCarryWeight != null) return 0; // inside ammo cache or fixed-weight container
      const qty = slotData.variables?.qty?.value || 1;
      return qty * 0.25;
    }
    if (lib && lib.fixedCarryWeight != null) return lib.fixedCarryWeight;
    const v = slotData.variables;
    if (v && ('pp' in v || 'gp' in v || 'sp' in v || 'cp' in v)) {
      const total = (v.pp?.value || 0) + (v.gp?.value || 0)
                  + (v.sp?.value || 0) + (v.cp?.value || 0);
      return Math.ceil(total / 50) * 0.25;
    }
    const id = slotData.bulk ? slotData.bulk.id
             : (lib?.bulk || Bulk.STOCK).id;
    const qty = v?.qty?.value || 1;
    if (id === 'packable') return qty * 0.25;
    if (id === 'bulky' || id === 'verybulky') return 2 * qty;
    return 1 * qty;
  }

  function containerFillUsed(container) {
    let fill = 0;
    for (const row of container.slots)
      for (const slot of row) fill += itemFillCost(slot, container);
    return fill;
  }

  function containerFillCapacity(container) {
    if (!container.maxRows) return Infinity;
    return container.maxRows * 2;
  }

  function containerFillAvailable(container) {
    return containerFillCapacity(container) - containerFillUsed(container);
  }

  function ensurePackableQty(slotData) {
    if (!slotData) return;
    const id = slotData.bulk ? slotData.bulk.id
             : (getLibraryItem(slotData.name)?.bulk || Bulk.STOCK).id;
    if (id !== 'packable') return;
    slotData.variables = slotData.variables || {};
    if (!('qty' in slotData.variables)) {
      slotData.variables.qty = { value: 1, control: 'both', min: 1, max: 999 };
    }
  }

  // ── DOM REFS ────────────────────────────────────────────────────────────
  const containersEl = document.getElementById('containers');
  const dropdownEl   = document.getElementById('autocomplete-dropdown');
  const inspectorEl  = document.getElementById('inspector');

  // Active autocomplete context
  let acContainer = null, acRow = -1, acCol = -1, acInput = null;
  let ignoreNextBlur = false;

  // Tracks which item is currently shown in the inspector (key = containerId-r-c or shop-name)
  let inspectorItemKey    = null;
  let _customEditKey      = null;
  let _customEditOpen     = false;

  // Drag state
  let dragState        = null;
  let ghostEl          = null;
  let longPressTimer   = null;
  let dragScrollVel    = 0;
  let dragScrollRaf    = null;
  let manualScrolling  = false;
  let manualScrollLastY = 0;

  function dragScrollStep() {
    if (!dragState || dragScrollVel === 0) { dragScrollRaf = null; return; }
    document.getElementById('inv-scroll').scrollTop += dragScrollVel;
    dragScrollRaf = requestAnimationFrame(dragScrollStep);
  }

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

  function shrinkEquipped() {
    const equipped = state.containers.find(c => c.id === 'equipped');
    if (!equipped) return;
    while (equipped.slots.length > 1) {
      const last = equipped.slots[equipped.slots.length - 1];
      const prev = equipped.slots[equipped.slots.length - 2];
      if (last[0] === null && last[1] === null && prev[0] === null && prev[1] === null) {
        equipped.slots.pop();
        equipped.rows--;
      } else {
        break;
      }
    }
  }

  function growContainer(container) {
    if (!container.maxRows) container.maxRows = container.rows;
    const hasEmptyRow = container.slots.some(row => row[0] === null && row[1] === null);
    if (!hasEmptyRow && containerFillAvailable(container) > 0.001) {
      container.slots.push([null, null]);
      container.rows++;
    }
  }

  function shrinkContainer(container) {
    while (container.slots.length > 1) {
      const last = container.slots[container.slots.length - 1];
      const prev = container.slots[container.slots.length - 2];
      if (last[0] === null && last[1] === null && prev[0] === null && prev[1] === null) {
        container.slots.pop();
        container.rows--;
      } else {
        break;
      }
    }
  }

  function render() {
    // Clear any accidentally persisted maxRows from strapped (it has no capacity cap)
    const _strapped = state.containers.find(c => c.id === 'strapped');
    if (_strapped) delete _strapped.maxRows;
    growEquipped();
    shrinkEquipped();
    state.containers.forEach(c => {
      if (c.linkedTo) { growContainer(c); shrinkContainer(c); }
    });
    containersEl.innerHTML = '';
    state.containers.forEach(c => containersEl.appendChild(buildCard(c)));
    updateCurrencyDisplay();
    updateCarryDisplay();

    // Refresh inspector name if panel is open for an inventory slot
    if (inspectorItemKey && !inspectorItemKey.startsWith('shop-')
        && !inspectorEl.classList.contains('inspector-collapsed')) {
      const lastH = inspectorItemKey.lastIndexOf('-');
      const prevH = inspectorItemKey.lastIndexOf('-', lastH - 1);
      const cid = inspectorItemKey.substring(0, prevH);
      const ir  = parseInt(inspectorItemKey.substring(prevH + 1, lastH));
      const ic  = parseInt(inspectorItemKey.substring(lastH + 1));
      const cnt = state.containers.find(c => c.id === cid);
      const sd  = cnt && cnt.slots[ir] && cnt.slots[ir][ic];
      if (sd) {
        const _sdLib = getLibraryItem(sd.name);
        const _sdEl  = document.getElementById('insp-name');
        if (_sdLib && _sdLib.gridSymbol) _sdEl.innerHTML = `${_sdLib.gridSymbol}&nbsp;${_sdLib.name}`;
        else _sdEl.textContent = sd.name || '';
      }
    }

    if (onChange) onChange();
  }

  function buildCard(container) {
    const card = document.createElement('div');
    const specialClass = container.id === 'equipped' ? ' card-equipped'
                       : container.id === 'strapped'  ? ' card-strapped'
                       : !container.permanent         ? ' card-added' : '';
    const isOpen = container.linkedTo && !container.collapsed;
    card.className = 'inv-card' + specialClass + (isOpen ? ' card-open' : '');
    card.dataset.containerId = container.id;

    const hdr = document.createElement('div');
    hdr.className = 'inv-hdr';

    const toggle = document.createElement('button');
    toggle.className = 'inv-hdr-toggle';
    let _capHtml = '';
    if (container.linkedTo && container.maxRows) {
      const _fillUsed = containerFillUsed(container);
      const _fillCap  = container.maxRows * 2;
      const _over = _fillUsed > _fillCap + 0.001;
      _capHtml = `<span class="container-capacity${_over ? ' container-capacity-over' : ''}">${parseFloat(_fillUsed.toFixed(2))}/${_fillCap}</span>`;
    } else if (container.id === 'strapped') {
      const _fillUsed = containerFillUsed(container);
      const _fillCap  = container.slots.length * 2;
      const _over = _fillUsed > _fillCap + 0.001;
      _capHtml = `<span class="container-capacity${_over ? ' container-capacity-over' : ''}">${parseFloat(_fillUsed.toFixed(2))}/${_fillCap}</span>`;
    }
    toggle.innerHTML = `<span>${container.name}${_capHtml}</span><span class="inv-chevron">${container.collapsed ? '▶' : '▼'}</span>`;
    toggle.addEventListener('click', () => { container.collapsed = !container.collapsed; render(); });

    if (!container.permanent) {
      const handle = document.createElement('button');
      handle.className = 'container-drag-handle';
      handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
      handle.title = 'Drag to reorder';
      handle.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.stopPropagation();
        startContainerDrag(container.id, card, e.pointerId, e.clientY);
      });
      hdr.appendChild(handle);
    }

    hdr.appendChild(toggle);
    card.appendChild(hdr);

    if (!container.collapsed) {
      const grid = document.createElement('div');
      grid.className = 'inv-grid';

      container.slots.forEach((row, r) => {
        grid.appendChild(buildSlot(container, r, 0, row[0]));
        grid.appendChild(buildSlot(container, r, 1, row[1]));
      });

      card.appendChild(grid);
    }

    return card;
  }


  function buildSlot(container, r, c, slotData) {
    const conflict = slotData && slotData.conflict;
    const linkedContainer = slotData && slotData.containerId
      ? state.containers.find(cnt => cnt.id === slotData.containerId)
      : null;
    const containerIsOpen = !!(linkedContainer && !linkedContainer.collapsed);

    const wrap = document.createElement('div');
    wrap.className = 'slot'
      + (containerIsOpen ? ' slot-container-open': '');
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
    input.enterKeyHint = 'done';

    const prev = slotData ? slotData.name : '';
    // typedValue tracks the user's live input independently of input.value, which
    // some Android browsers reset via blur before keydown/keyup fires.
    let typedValue = '';

    input.addEventListener('focus', () => {
      typedValue = input.value;
      acContainer = container; acRow = r; acCol = c; acInput = input;
      updateDropdown(input.value);
    });

    input.addEventListener('input', () => {
      typedValue = input.value;
      updateDropdown(input.value);
    });

    const commitFromTyped = () => {
      if (!document.contains(input)) return; // element removed by a prior render()
      const val = typedValue.trim();
      typedValue = '';
      if (val) commitSlot(val, container, r, c);
      else if (slotData) clearSlot(container, r, c);
      else closeDropdown();
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitFromTyped();
      } else if (e.key === 'Escape') {
        typedValue = '';
        input.value = prev;
        closeDropdown();
        input.blur();
      }
    });

    // Fallback for Samsung / Android keyboards that report Enter on keyup
    // after IME composition (keydown fires with key='Unidentified' instead).
    input.addEventListener('keyup', e => {
      if (e.key === 'Enter') commitFromTyped();
    });

    input.addEventListener('blur', () => {
      input.classList.remove('slot-editing');
      if (ignoreNextBlur) { ignoreNextBlur = false; return; }
      // Commit if the user typed something different (covers mobile "Next"/"Done"
      // which fires blur without an Enter event). Safe on Android too — if blur
      // fires before keyup, commitFromTyped() clears typedValue and renders,
      // removing the input from the DOM so the keyup handler returns early.
      if (typedValue.trim() && typedValue !== prev) {
        commitFromTyped();
        return;
      }
      typedValue = '';
      input.value = prev;
      closeDropdown();
    });

    wrap.appendChild(input);

    if (slotData) {
      const itemKey = `${container.id}-${r}-${c}`;
      const isInspected = inspectorItemKey === itemKey && !inspectorEl.classList.contains('inspector-collapsed');

      const label = document.createElement('span');
      const isContainerItem2 = isNoCarry(slotData);
      const showWarning = conflict;
      label.className = 'slot-label'
        + (showWarning      ? ' slot-label-conflict'  : '')
        + (isContainerItem2 ? ' slot-label-container' : '');

      const varEntries = Object.entries(slotData.variables || {});
      const numVarEntry = varEntries.find(([k, v]) => k !== 'qty' && (v.control === 'plusminus' || v.control === 'both') && typeof v.value === 'number')
                       || varEntries.find(([, v]) => (v.control === 'plusminus' || v.control === 'both') && typeof v.value === 'number')
                       || null;
      const numVar = numVarEntry ? numVarEntry[1] : null;
      const _bulkId = slotData.bulk ? slotData.bulk.id
                    : (getLibraryItem(slotData.name)?.bulk || Bulk.STOCK).id;
      const isPackableSlot = _bulkId === 'packable';
      if (isPackableSlot) wrap.classList.add('slot-packable');
      else if (_bulkId === 'bulky' || _bulkId === 'verybulky') wrap.classList.add('slot-bulky');
      const _silverPfx = (slotData.silvered || slotData.material === 'silvered') ? 'Silvered ' : '';
      const _metalMat  = (slotData.material === 'mithral' || slotData.material === 'adamantine') ? slotData.material : null;
      const matPfx = _silverPfx + (_metalMat ? _metalMat.charAt(0).toUpperCase() + _metalMat.slice(1) + ' ' : '');
      const dispName = computeDisplayName(slotData);

      {
        const libForLabel = getLibraryItem(slotData.name);
        const gridSymbol  = libForLabel && libForLabel.gridSymbol;
        const cv = slotData.variables || {};
        const _hasCoinVars = ['pp','gp','sp','cp'].every(k => k in cv);
        if (gridSymbol) {
          const activeCoins = [['pp',cv.pp],['gp',cv.gp],['sp',cv.sp],['cp',cv.cp]]
            .filter(([,v]) => v && (v.value || 0) > 0);
          const coinParts = activeCoins.map(([k,v]) => `<span class="coin-label-${k}">${v.value}${k}</span>`);
          const iconClass = activeCoins.length === 1 ? `coin-label-${activeCoins[0][0]}` : 'coin-label-white';
          const iconHtml = `<span class="${iconClass}">${gridSymbol}</span>`;
          label.innerHTML = coinParts.length
            ? `${iconHtml}&nbsp;${coinParts.join(' ')}`
            : `${gridSymbol}&nbsp;${libForLabel.name}`;
          label.classList.add('slot-label-symbol');
        } else if (_hasCoinVars) {
          // Coin purse without gridSymbol: show colored coin amounts, no icon
          const activeCoins = ['pp','gp','sp','cp'].filter(k => (cv[k]?.value || 0) > 0);
          const coinParts = activeCoins.map(k => `<span class="coin-label-${k}">${cv[k].value}${k}</span>`);
          label.innerHTML = coinParts.length
            ? coinParts.join(' ')
            : `<span class="coin-label-white">${libForLabel ? libForLabel.name : slotData.name}</span>`;
          label.classList.add('slot-label-symbol');
        } else {
          const libForCost = libForLabel;
          const cc = slotData.costCoins;
          const costSuffix = (libForCost && libForCost.editableCost) && cc
            ? (() => {
                const parts = [cc.pp?`${cc.pp}pp`:'',cc.gp?`${cc.gp}gp`:'',cc.sp?`${cc.sp}sp`:'',cc.cp?`${cc.cp}cp`:''].filter(Boolean);
                return parts.length ? ` (${parts.join(' ')})` : '';
              })()
            : '';
          {
            const qty = slotData.variables?.qty?.value ?? 1;
            const qtyPrefix = qty > 1 ? `${qty} × ` : '';
            const usesVar = slotData.variables?.uses ?? slotData.variables?.count;
            const usesSuffix = usesVar !== undefined ? ` (${usesVar.value})` : '';
            label.textContent = `${qtyPrefix}${matPfx}${dispName}${usesSuffix}${costSuffix}`;
          }
          if (!!(libForLabel && libForLabel.treasure) || !!slotData.treasure) {
            label.classList.add('slot-label-treasure');
          }
        }
      }

      const _slotLib = getLibraryItem(slotData.name);
      const _isTreasureSlot = !!(_slotLib && _slotLib.treasure) || !!slotData.treasure;
      const _sv = slotData.variables || {};
      const _isCoinPurseSlot = 'pp' in _sv && 'gp' in _sv && 'sp' in _sv && 'cp' in _sv;
      let _infoIconClass, _infoIconHtml;
      if (_isCoinPurseSlot) {
        const _ac = ['pp','gp','sp','cp'].filter(k => (_sv[k]?.value || 0) > 0);
        const _coinMod = _ac.length === 1 ? `slot-coin-${_ac[0]}` : 'slot-coin-mixed';
        _infoIconClass = `slot-info-inline ${_coinMod}`;
        _infoIconHtml  = '<i class="fas fa-coins"></i>';
      } else if (_isTreasureSlot) {
        _infoIconClass = 'slot-info-inline slot-treasure';
        _infoIconHtml  = '<i class="fas fa-crown"></i>';
      } else {
        _infoIconClass = 'slot-info-inline';
        _infoIconHtml  = '<i class="fas fa-circle-info"></i>';
      }

      if (linkedContainer) {
        // Info/treasure icon (left:4px) — clicking the label opens the inspector
        const infoIcon = document.createElement('span');
        infoIcon.className = _infoIconClass + (isInspected ? ' active' : '');
        infoIcon.innerHTML = _infoIconHtml;
        label.appendChild(infoIcon);

        // Label (name + info icon) opens inspector; stop propagation so wrap toggle doesn't fire
        label.style.paddingLeft = '20px';
        label.style.cursor = 'pointer';
        label.style.pointerEvents = 'auto';
        label.addEventListener('click', e => {
          e.stopPropagation();
          toggleInspectorFor(itemKey, slotData, container, r, c);
        });

        // Clicking the slot area outside the label still toggles the container
        wrap.style.cursor = 'pointer';
        wrap.addEventListener('click', e => {
          if (e.target.closest('.slot-remove')) return;
          linkedContainer.collapsed = !linkedContainer.collapsed;
          render();
        });
      } else {
        // Info/treasure icon inline; clicking label (name + icon) opens inspector
        const infoIcon = document.createElement('span');
        infoIcon.className = _infoIconClass + (isInspected ? ' active' : '');
        infoIcon.innerHTML = _infoIconHtml;
        label.appendChild(infoIcon);

        label.style.cursor = 'pointer';
        label.style.pointerEvents = 'auto';
        label.addEventListener('click', e => {
          e.stopPropagation();
          toggleInspectorFor(itemKey, slotData, container, r, c);
        });
      }

      wrap.appendChild(label);

      // Corner tags (bulk left, container right)
      const _isContainerSlot = !!(slotData.isContainer || (getLibraryItem(slotData.name) || {}).containerRows);
      const _isAmmoSlot = slotData.category === 'ammunition' || ((getLibraryItem(slotData.name) || {}).category === 'ammunition');
      const _weaponTypeSlot = getSlotWeaponType(slotData);
      const _showBulkTag = !_isAmmoSlot && (_bulkId === 'packable' || _bulkId === 'bulky' || _bulkId === 'verybulky');
      if (_isContainerSlot || _showBulkTag || _isAmmoSlot || _weaponTypeSlot) {
        const tagsWrap = document.createElement('div');
        tagsWrap.className = 'slot-tags';
        if (_showBulkTag) {
          const t = document.createElement('span');
          t.className = `slot-bulk-tag slot-bulk-tag--${_bulkId}`;
          t.textContent = _bulkId === 'packable' ? 'Packable' : 'Bulky';
          tagsWrap.appendChild(t);
        }
        if (_isContainerSlot) {
          const t = document.createElement('span');
          t.className = 'slot-bulk-tag slot-bulk-tag--container';
          t.textContent = 'Container';
          tagsWrap.appendChild(t);
        }
        if (_isAmmoSlot) {
          const t = document.createElement('span');
          t.className = 'slot-bulk-tag slot-bulk-tag--ammo';
          t.textContent = 'Ammo';
          tagsWrap.appendChild(t);
        }
        if (_weaponTypeSlot) {
          const t = document.createElement('span');
          t.className = `slot-bulk-tag slot-bulk-tag--${_weaponTypeSlot}`;
          t.textContent = _weaponTypeSlot.charAt(0).toUpperCase() + _weaponTypeSlot.slice(1);
          tagsWrap.appendChild(t);
        }
        wrap.appendChild(tagsWrap);
      }
    }

    if (conflict) {
      const warn = document.createElement('span');
      warn.className = 'slot-warn';
      warn.textContent = '⚠';
      warn.title = slotData.conflictMsg || 'Slot conflict';
      wrap.appendChild(warn);
    }

    if (slotData) {


      // Prevent iOS from treating a touch on a filled slot as a scroll gesture —
      // this stops the browser firing pointercancel during the long-press window.
      // Scrolling is handled manually below whenever the user swipes instead of holds.
      wrap.style.touchAction = 'none';

      let downX, downY, downPointerId;

      wrap.addEventListener('pointerdown', e => {
        if (dragState || e.target.tagName === 'BUTTON') return;
        downX = e.clientX; downY = e.clientY; downPointerId = e.pointerId;
        manualScrolling = false;
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          manualScrolling = false;
          document.documentElement.setPointerCapture(downPointerId);
          const sr = wrap.getBoundingClientRect();
          startDrag(slotData, container, r, c, downX, downY,
            { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
            () => { container.slots[r][c] = null; });
        }, 380);
      });

      wrap.addEventListener('pointermove', e => {
        if (manualScrolling) {
          document.getElementById('inv-scroll').scrollTop += manualScrollLastY - e.clientY;
          manualScrollLastY = e.clientY;
          return;
        }
        if (!longPressTimer) return;
        if ((e.clientX - downX) ** 2 + (e.clientY - downY) ** 2 > 64) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          manualScrolling  = true;
          manualScrollLastY = e.clientY;
        }
      });

      const cancelLong = () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        manualScrolling = false;
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
    if (libItem && libItem.shopHidden) return;
    const canonName = libItem ? libItem.name : name;
    const row = container.slots[r];
    const existing = row[c];

    const sameItem = existing && existing.name === canonName;
    const variables = sameItem
      ? existing.variables
      : (libItem ? JSON.parse(JSON.stringify(libItem.variables || {}))
                 : {});

    const slotData = {
      name: canonName,
      variables,
      ...(libItem ? {} : {
        custom: true,
        bulk: sameItem && existing.bulk ? existing.bulk : Bulk.STOCK,
        description: sameItem ? (existing.description || '') : '',
      }),
    };

    const existingFill = existing ? itemFillCost(existing, container) : 0;
    if (itemFillCost(slotData, container) - existingFill > containerFillAvailable(container) + 0.001) {
      closeDropdown();
      render();
      return;
    }

    ensurePackableQty(slotData);
    row[c] = slotData;

    if (isContainerItem(slotData) && !slotData.containerId) {
      createLinkedContainer(slotData, container.id, r, c);
    }

    closeDropdown();
    if (onSound) onSound('place');
    render();
  }

  function findEmptySlot(container, excludeRow) {
    for (let r = 0; r < container.slots.length; r++) {
      if (r === excludeRow) continue;
      const [left, right] = container.slots[r];
      if (!left)  return { r, c: 0 };
      if (!right) return { r, c: 1 };
    }
    return null;
  }

  function flashBlockedContainer(slotContainerId, r, c, linkedId) {
    const linked = state.containers.find(cnt => cnt.id === linkedId);
    if (linked) linked.collapsed = false;
    render();
    const slotEl = document.querySelector(`[data-container-id="${slotContainerId}"][data-r="${r}"][data-c="${c}"]`);
    const cardEl = document.querySelector(`.inv-card[data-container-id="${linkedId}"]`);
    const reflow = el => { if (el) { el.classList.remove('slot-blocked-flash', 'card-blocked-flash'); void el.offsetWidth; } };
    if (slotEl) { reflow(slotEl); slotEl.classList.add('slot-blocked-flash'); }
    if (cardEl) { reflow(cardEl); cardEl.classList.add('card-blocked-flash'); }
  }

  function clearSlot(container, r, c) {
    ignoreNextBlur = true;
    const slotData = container.slots[r][c];

    if (slotData && slotData.containerId) {
      const linked = state.containers.find(cnt => cnt.id === slotData.containerId);
      if (linked && containerHasItems(linked)) {
        ignoreNextBlur = false;
        flashBlockedContainer(container.id, r, c, slotData.containerId);
        return;
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

    let matches = ITEM_LIBRARY.filter(i => i.name && i.name.toLowerCase().includes(query) && !i.shopHidden);
    if (!window._isDM) matches = matches.filter(i => !i.dmOnly);
    if (!window._isDM && isHiddenFromPlayer) matches = matches.filter(i => !isHiddenFromPlayer(i.name));
    matches = matches.slice(0, 10);
    if (!matches.length) { closeDropdown(); return; }

    dropdownEl.innerHTML = '';
    matches.forEach(item => {
      const opt = document.createElement('div');
      opt.className = 'ac-opt';
      const bid = item.bulk ? item.bulk.id : 'stock';
      const isAmmoItem = item.category === 'ammunition';
      const tag = isAmmoItem
        ? `<span class="ac-tag ammo">Ammo</span>`
        : bid !== 'stock' ? `<span class="ac-tag ${bid}">${bid}</span>` : '';
      opt.innerHTML = `<span class="ac-name">${item.name}</span>${tag}`;

      const pick = () => {
        ignoreNextBlur = true;
        if (acContainer !== null) commitSlot(item.name, acContainer, acRow, acCol);
        closeDropdown();
      };
      opt.addEventListener('mousedown', e => { e.preventDefault(); pick(); });
      opt.addEventListener('touchstart', e => { opt._touchY = e.touches[0].clientY; }, { passive: true });
      opt.addEventListener('touchend', e => {
        if (Math.abs(e.changedTouches[0].clientY - (opt._touchY || 0)) < 10) {
          e.preventDefault();
          pick();
        }
      }, { passive: false });
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
  function showInspector(slotData, container, r, c, packIdx) {
    const lib = getLibraryItem(slotData.name);

    // ── Name ──
    const _nameEl = document.getElementById('insp-name');
    if (lib && lib.gridSymbol) {
      _nameEl.innerHTML = `${lib.gridSymbol}&nbsp;${lib.name}`;
      _nameEl.classList.add('insp-name-symbol');
    } else {
      _nameEl.textContent = slotData.name || '';
      _nameEl.classList.remove('insp-name-symbol');
    }

    // ── Edit Item button (custom items only) ──
    const prevEditBtn = document.getElementById('insp-edit-btn');
    if (prevEditBtn) prevEditBtn.remove();
    if (slotData.custom && container) {
      const itemKey = `${container.id}-${r}-${c}`;
      if (_customEditKey !== itemKey) { _customEditKey = itemKey; _customEditOpen = false; }
      const editBtn = document.createElement('button');
      editBtn.id = 'insp-edit-btn';
      editBtn.className = 'insp-rename-btn' + (_customEditOpen ? ' active' : '');
      editBtn.innerHTML = '<i class="fas fa-sliders"></i>';
      editBtn.title = _customEditOpen ? 'Close item editor' : 'Edit item';
      editBtn.addEventListener('click', () => {
        _customEditOpen = !_customEditOpen;
        showInspector(slotData, container, r, c, packIdx);
      });
      document.getElementById('insp-name').parentNode.insertBefore(editBtn, document.getElementById('insp-name'));
    } else {
      _customEditKey = null; _customEditOpen = false;
    }

    // ── Inline numeric vars (count / charges) next to the name ──
    const inlineEl = document.getElementById('insp-inline-vars');
    inlineEl.innerHTML = '';
    const COIN_KEYS = new Set(['pp', 'gp', 'sp', 'cp']);
    const _varKeys = Object.keys(slotData.variables || {});
    const isCoinItem = _varKeys.length > 0 && _varKeys.every(k => COIN_KEYS.has(k));
    if (isCoinItem) inlineEl.classList.add('coin-vars-layout');
    else            inlineEl.classList.remove('coin-vars-layout');

    // Always show qty stepper — except containers (always qty 1) and coin purses
    const _isContainerItem = !!(slotData.isContainer || (lib && lib.containerRows));
    if (!isCoinItem && !_isContainerItem && (container || slotData._shopItem)) {
      const qtyVal = slotData.variables?.qty?.value ?? 1;
      const qtyWrap = document.createElement('div');
      qtyWrap.className = 'insp-inline-var insp-inline-var--compact';
      qtyWrap.innerHTML = `
        <span class="insp-inline-label">qty</span>
        <button class="insp-btn-sm" data-qd="-1">−</button>
        <input class="insp-num-sm" type="number" value="${qtyVal}" min="1" max="99" data-qinp />
        <button class="insp-btn-sm" data-qd="1">+</button>
      `;
      const setQty = v => {
        v = Math.max(1, Math.min(99, v));
        slotData.variables = slotData.variables || {};
        slotData.variables.qty = { value: v, control: 'both', min: 1, max: 99 };
        qtyWrap.querySelector('[data-qinp]').value = v;
        if (container) render();
        else { refreshShopRow(); showInspector(slotData, container, r, c); }
      };
      qtyWrap.querySelectorAll('[data-qd]').forEach(btn =>
        btn.addEventListener('click', () => setQty((slotData.variables?.qty?.value ?? 1) + parseInt(btn.dataset.qd)))
      );
      qtyWrap.querySelector('[data-qinp]').addEventListener('input', e => {
        const v = parseInt(e.target.value);
        if (!isNaN(v)) setQty(v);
      });
      inlineEl.appendChild(qtyWrap);
    }

    const sortedVarEntries = Object.entries(slotData.variables || {})
      .sort(([a], [b]) => (a === 'qty' ? -1 : b === 'qty' ? 1 : 0));
    for (const [key, meta] of sortedVarEntries) {
      if (key === 'qty') continue; // rendered above
      if (meta.control !== 'plusminus' && meta.control !== 'both') continue;
      const wrap = document.createElement('div');
      const isUsesKey = key === 'uses' || key === 'count' || key === 'charges';
      wrap.className = 'insp-inline-var'
        + (isCoinItem ? ' coin-inline-var' : ' insp-inline-var--compact')
        + (isUsesKey && !isCoinItem ? ' insp-inline-var--uses' : '');
      if (isCoinItem) {
        wrap.innerHTML = `
          <span class="insp-inline-label coin-label-${key}">${key.toUpperCase()}</span>
          <div class="coin-controls">
            <button class="insp-btn-sm" data-k="${key}" data-d="-1">−</button>
            <input class="insp-num-sm insp-num-coin" type="number" value="${meta.value}" data-k="${key}"
              ${typeof meta.min === 'number' ? `min="${meta.min}"` : ''}
              ${typeof meta.max === 'number' ? `max="${meta.max}"` : ''} />
            <button class="insp-btn-sm" data-k="${key}" data-d="1">+</button>
          </div>
        `;
      } else {
        wrap.innerHTML = `
          <span class="insp-inline-label">${key}</span>
          <button class="insp-btn-sm" data-k="${key}" data-d="-1">−</button>
          <input class="insp-num-sm" type="number" value="${meta.value}" data-k="${key}"
            ${typeof meta.min === 'number' ? `min="${meta.min}"` : ''}
            ${typeof meta.max === 'number' ? `max="${meta.max}"` : ''} />
          <button class="insp-btn-sm" data-k="${key}" data-d="1">+</button>
        `;
      }
      inlineEl.appendChild(wrap);
    }
    const refreshCostDisplay = () => {
      const _hasUses = slotData.hasUses ?? lib?.hasUses;
      if (_hasUses !== 'coins') return;
      const costEl = document.getElementById('insp-cost');
      if (!costEl || costEl.hidden) return;
      const cv = slotData.variables || {};
      const mult = Math.max(1, cv.uses?.value ?? cv.count?.value ?? 1);
      const cc2 = slotData.costCoins;
      const base2 = cc2
        ? (cc2.pp||0)*1000 + (cc2.gp||0)*100 + (cc2.sp||0)*10 + (cc2.cp||0)
        : (lib && lib.cost ? parseCostCp(lib.cost) : 0);
      const total2 = (base2 + getSlotTypeCostCp(slotData)) * mult;
      const parts2 = [];
      let rem2 = total2;
      const gp2 = Math.floor(rem2 / 100); rem2 %= 100;
      const sp2 = Math.floor(rem2 / 10);  rem2 %= 10;
      if (gp2) parts2.push(gp2 + 'gp');
      if (sp2) parts2.push(sp2 + 'sp');
      if (rem2) parts2.push(rem2 + 'cp');
      const str = parts2.join(' ') || '0cp';
      const textNode = [...costEl.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = str;
      else costEl.appendChild(document.createTextNode(str));
    };

    inlineEl.querySelectorAll('.insp-btn-sm').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = slotData.variables[btn.dataset.k];
        let v = m.value + parseInt(btn.dataset.d);
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        inlineEl.querySelector(`.insp-num-sm[data-k="${btn.dataset.k}"]`).value = v;
        render();
        refreshCostDisplay();
      });
    });
    inlineEl.querySelectorAll('.insp-num-sm').forEach(inp => {
      inp.addEventListener('input', () => {
        const m = slotData.variables[inp.dataset.k];
        let v = parseInt(inp.value);
        if (isNaN(v)) return;
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        render();
        refreshCostDisplay();
      });
      inp.addEventListener('blur', () => { inp.value = slotData.variables[inp.dataset.k].value; });
    });

    // ── Warning ──
    const warnEl = document.getElementById('insp-warn');
    warnEl.hidden = !slotData.conflict;
    if (slotData.conflict) warnEl.textContent = '⚠ ' + (slotData.conflictMsg || 'This item is in a conflicting slot.');

    // ── Description ──
    const itemHidden = !window._isDM && !!isHiddenFromPlayer && isHiddenFromPlayer(slotData.name);
    const descP = document.getElementById('insp-desc');
    const descEdit = document.getElementById('insp-desc-edit');
    const notesEl = document.getElementById('insp-notes');
    if (slotData.custom) {
      const customDesc = slotData.description || '';
      descP.hidden = !customDesc || _customEditOpen; descEdit.hidden = true; notesEl.hidden = !container;
      if (customDesc) descP.innerHTML = customDesc;
      if (container) {
        notesEl.value = slotData.notes || '';
        notesEl.oninput = () => { slotData.notes = notesEl.value; };
      }
    } else if (itemHidden) {
      descP.hidden = false; descEdit.hidden = true; notesEl.hidden = !container;
      descP.innerHTML = '<i>Details not available.</i>';
      if (container) {
        notesEl.value = slotData.notes || '';
        notesEl.oninput = () => { slotData.notes = notesEl.value; };
      }
    } else {
      descP.hidden = false; descEdit.hidden = true; notesEl.hidden = !container;
      descP.innerHTML = lib ? lib.description : '';
      if (container) {
        notesEl.value = slotData.notes || '';
        notesEl.oninput = () => { slotData.notes = notesEl.value; };
      }
    }

    // ── Cost ──
    const costEl = document.getElementById('insp-cost');
    const isTreasure = !!(lib && lib.treasure) || !!slotData.treasure;
    const cc = slotData.costCoins;
    const ccTotalCp = cc ? (cc.pp||0)*1000 + (cc.gp||0)*100 + (cc.sp||0)*10 + (cc.cp||0) : 0;
    const typeCostCp = getSlotTypeCostCp(slotData);
    const materialCostCp = getSlotMaterialCostCp(slotData, lib?.category === 'ammunition');
    const coinUsesMult = getSlotCoinUsesMultiplier(slotData);
    let displayCostStr;
    if (typeCostCp > 0 || materialCostCp > 0 || coinUsesMult > 1) {
      const baseCp = ccTotalCp > 0 ? ccTotalCp : (lib && lib.cost ? parseCostCp(lib.cost) : 0);
      const totalCp = (baseCp + typeCostCp + materialCostCp) * coinUsesMult;
      const parts = [];
      let rem = totalCp;
      const gp = Math.floor(rem / 100); rem %= 100;
      const sp = Math.floor(rem / 10);  rem %= 10;
      if (gp) parts.push(gp + 'gp');
      if (sp) parts.push(sp + 'sp');
      if (rem) parts.push(rem + 'cp');
      displayCostStr = parts.join(' ') || '0cp';
    } else {
      const ccStr = cc && ccTotalCp > 0 ? [
        cc.pp ? `${cc.pp}pp` : '', cc.gp ? `${cc.gp}gp` : '',
        cc.sp ? `${cc.sp}sp` : '', cc.cp ? `${cc.cp}cp` : '',
      ].filter(Boolean).join(' ') : null;
      displayCostStr = ccStr || (lib && lib.cost) || null;
    }
    costEl.hidden = !displayCostStr || itemHidden;
    if (displayCostStr && !itemHidden) {
      costEl.innerHTML = '';
      if (isTreasure) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-crown';
        icon.title = 'Treasure — sells at full price';
        icon.style.cssText = 'font-size:10px;margin-right:4px;color:rgba(255,205,60,0.85);';
        costEl.appendChild(icon);
      }
      costEl.appendChild(document.createTextNode(displayCostStr));
    }

    // ── Copy (DM only) ──
    const copyBtnEl = document.getElementById('insp-copy');
    copyBtnEl.hidden = !container || !window._isDM;
    if (container && window._isDM) {
      copyBtnEl.onclick = () => {
        const equipped = state.containers.find(c => c.id === 'equipped');
        if (!equipped) return;
        const copy = JSON.parse(JSON.stringify(slotData));
        delete copy.conflict; delete copy.conflictMsg;
        // Find a free slot in equipped, growing if needed
        let placed = false;
        for (let ri = 0; ri < equipped.slots.length; ri++) {
          for (let ci = 0; ci < 2; ci++) {
            if (!equipped.slots[ri][ci]) {
              placeSlotData(copy, equipped, ri, ci);
              placed = true; break;
            }
          }
          if (placed) break;
        }
        if (!placed) {
          equipped.slots.push([null, null]);
          equipped.rows++;
          placeSlotData(copy, equipped, equipped.slots.length - 1, 0);
        }
      };
    }

    // ── Remove ──
    const removeBtnEl = document.getElementById('insp-remove');
    removeBtnEl.hidden = !container || !window._isDM;
    if (container) removeBtnEl.onclick = () => {
      const lib = getLibraryItem(slotData.name);
      if (lib && lib.warnOnRemove) {
        const v = slotData.variables || {};
        const coinKeys = ['pp','gp','sp','cp'];
        const hasCoins = coinKeys.some(k => v[k] && (v[k].value || 0) > 0);
        if (hasCoins && !confirm(lib.warnOnRemove)) return;
      }
      clearSlot(container, r, c);
    };

    // ── Compact props row ──
    const propsEl = document.getElementById('insp-props');
    propsEl.innerHTML = '';

    // ── Display-only tags (compact grid) ──
    const _inspBulkId = slotData.bulk ? slotData.bulk.id
      : (lib?.bulk || Bulk.STOCK).id;
    const _isAmmoInsp = slotData.category === 'ammunition' || (lib && lib.category === 'ammunition');
    const _weaponTypeInsp = getSlotWeaponType(slotData);

    const tagGrid = document.createElement('div');
    tagGrid.className = 'insp-tag-grid';

    const addTag = (cls, text) => {
      const t = document.createElement('span');
      t.className = `ac-tag ${cls}`;
      t.textContent = text;
      tagGrid.appendChild(t);
    };

    if (!_isAmmoInsp && (_inspBulkId === 'packable' || _inspBulkId === 'bulky' || _inspBulkId === 'verybulky'))
      addTag(_inspBulkId, _inspBulkId === 'packable' ? 'Packable' : 'Bulky');
    if (_weaponTypeInsp) addTag(_weaponTypeInsp, _weaponTypeInsp.charAt(0).toUpperCase() + _weaponTypeInsp.slice(1));
    if (_isAmmoInsp) addTag('ammo', 'Ammo');
    if (slotData.isContainer || (lib && lib.containerRows)) addTag('container', 'Container');

    if (tagGrid.children.length) propsEl.appendChild(tagGrid);

    // Editable cost fields — non-custom treasure items with variable cost (DM only)
    const showCostInput = window._isDM && !itemHidden && container
      && (lib && lib.editableCost) && !slotData.custom;
    if (showCostInput) {
      if (!slotData.costCoins) slotData.costCoins = { pp: 0, gp: 0, sp: 0, cp: 0 };
      const coins = slotData.costCoins;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex-shrink:0;';
      [['pp','rgba(190,145,255,0.9)'], ['gp','rgba(255,205,60,0.9)'],
       ['sp','rgba(200,200,215,0.85)'], ['cp','rgba(205,135,65,0.85)']].forEach(([key, color]) => {
        const lbl = document.createElement('span');
        lbl.textContent = key.toUpperCase();
        lbl.style.cssText = `font-size:10px;font-weight:700;color:${color};`;
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.max = '999999';
        inp.value = coins[key] || 0;
        inp.className = 'cost-coin-inp';
        inp.style.cssText = 'width:48px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:var(--text);font-size:13px;font-weight:600;text-align:center;padding:3px 4px;outline:none;';
        inp.addEventListener('change', () => {
          coins[key] = Math.max(0, parseInt(inp.value) || 0);
          showInspector(slotData, container, r, c, packIdx);
          render();
        });
        wrap.appendChild(lbl); wrap.appendChild(inp);
      });
      propsEl.appendChild(wrap);
    }

    // Material chips and type selects — always in propsEl (header row), for both inventory and shop
    const effectiveCat = getEffectiveCategory(slotData);
    const canSilver = ['weapon','ammunition'].includes(effectiveCat);
    const canMetal  = ['weapon','armor','shield','ammunition'].includes(effectiveCat);
    const ctrlTarget = propsEl;

    // When modifying a shop item's properties via the inspector, refresh its row cost display
    const refreshShopRow = () => {
      const shopRow = document.querySelector(`.shop-item-row[data-item-name="${CSS.escape(slotData.name)}"]`);
      if (shopRow?._applyRowState) shopRow._applyRowState();
    };

    const updateAmmoUnresolved = () => {
      if (!container && slotData.name === 'Ammunition') {
        slotData._unresolved = !slotData.silvered && !slotData.material;
      }
    };

    if (canSilver) {
      const btn = document.createElement('button');
      const isSilvered = slotData.silvered || slotData.material === 'silvered';
      btn.className = 'prop-chip' + (isSilvered ? ' active-silvered' : '');
      btn.textContent = 'Silvered';
      btn.dataset.matChip = 'true';
      btn.onclick = () => {
        slotData.silvered = !(slotData.silvered || slotData.material === 'silvered');
        if (slotData.material === 'silvered') slotData.material = null;
        updateAmmoUnresolved();
        if (!container) refreshShopRow();
        render(); showInspector(slotData, container, r, c, packIdx);
      };
      ctrlTarget.appendChild(btn);
    }

    if (canMetal) {
      const metals = [null, 'mithral', 'adamantine'];
      const curMetal = (slotData.material === 'mithral' || slotData.material === 'adamantine') ? slotData.material : null;
      const btn = document.createElement('button');
      btn.className = 'prop-chip' + (curMetal ? ` active-${curMetal}` : '');
      btn.textContent = curMetal ? curMetal.charAt(0).toUpperCase() + curMetal.slice(1) : 'Metal';
      btn.dataset.matChip = 'true';
      btn.onclick = () => {
        const idx = metals.indexOf(curMetal);
        slotData.material = metals[(idx + 1) % metals.length];
        updateAmmoUnresolved();
        if (!container) refreshShopRow();
        render(); showInspector(slotData, container, r, c, packIdx);
      };
      ctrlTarget.appendChild(btn);
    }

    // Weapon / armor / element selects
    const _addPlaceholder = (sel, label, currentVal) => {
      if (!container) {
        const ph = document.createElement('option');
        ph.value = ''; ph.textContent = label;
        if (currentVal === '') ph.selected = true;
        sel.insertBefore(ph, sel.firstChild);
      }
    };

    // After a select changes, sync _unresolved with whether any select still holds ''
    const _updateUnresolved = () => {
      const v = slotData.variables || {};
      const stillEmpty = Object.values(v).some(m => m.control === 'select' && m.value === '');
      if (stillEmpty) slotData._unresolved = true;
      else delete slotData._unresolved;
    };

    const weaponMeta = slotData.variables && slotData.variables.weapon;
    if (weaponMeta && weaponMeta.control === 'select') {
      const sel = document.createElement('select');
      sel.className = 'insp-select';
      (weaponMeta.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === weaponMeta.value) o.selected = true;
        sel.appendChild(o);
      });
      _addPlaceholder(sel, 'Weapon', weaponMeta.value);
      sel.addEventListener('change', () => {
        slotData.variables.weapon.value = sel.value;
        const libWeapon = getLibraryItem(sel.value);
        if (libWeapon && libWeapon.bulk) slotData.bulk = libWeapon.bulk;
        _updateUnresolved();
        if (!container) refreshShopRow();
        render();
        if (container) showInspector(slotData, container, r, c);
      });
      ctrlTarget.appendChild(sel);
    }

    const armorMeta = slotData.variables && slotData.variables.armor;
    if (armorMeta && armorMeta.control === 'select') {
      const sel = document.createElement('select');
      sel.className = 'insp-select';
      (armorMeta.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === armorMeta.value) o.selected = true;
        sel.appendChild(o);
      });
      _addPlaceholder(sel, 'Armor', armorMeta.value);
      sel.addEventListener('change', () => {
        slotData.variables.armor.value = sel.value;
        const libArmor = getLibraryItem(sel.value);
        if (libArmor && libArmor.bulk) slotData.bulk = libArmor.bulk;
        _updateUnresolved();
        if (!container) refreshShopRow();
        render();
        if (container) showInspector(slotData, container, r, c);
      });
      ctrlTarget.appendChild(sel);
    }

    const elementMeta = slotData.variables && slotData.variables.element;
    if (elementMeta && elementMeta.control === 'select') {
      const sel = document.createElement('select');
      sel.className = 'insp-select';
      (elementMeta.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === elementMeta.value) o.selected = true;
        sel.appendChild(o);
      });
      _addPlaceholder(sel, 'Elemental', elementMeta.value);
      sel.addEventListener('change', () => {
        slotData.variables.element.value = sel.value;
        _updateUnresolved();
        if (!container) refreshShopRow();
        render();
      });
      ctrlTarget.appendChild(sel);
    }

    const creatureMeta = slotData.variables && slotData.variables.creature;
    if (creatureMeta && creatureMeta.control === 'select') {
      const sel = document.createElement('select');
      sel.className = 'insp-select';
      (creatureMeta.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === creatureMeta.value) o.selected = true;
        sel.appendChild(o);
      });
      _addPlaceholder(sel, 'Creature', creatureMeta.value);
      sel.addEventListener('change', () => {
        slotData.variables.creature.value = sel.value;
        _updateUnresolved();
        if (!container) refreshShopRow();
        render();
        showInspector(slotData, container, r, c);
      });
      ctrlTarget.appendChild(sel);
    }

    const spellMeta = slotData.variables && slotData.variables.spell;
    if (spellMeta && spellMeta.control === 'select') {
      const sel = document.createElement('select');
      sel.className = 'insp-select';
      (spellMeta.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === spellMeta.value) o.selected = true;
        sel.appendChild(o);
      });
      _addPlaceholder(sel, 'Spell', spellMeta.value);
      sel.addEventListener('change', () => {
        slotData.variables.spell.value = sel.value;
        _updateUnresolved();
        if (!container) refreshShopRow();
        render();
        showInspector(slotData, container, r, c);
      });
      ctrlTarget.appendChild(sel);
    }

    propsEl.hidden = propsEl.children.length === 0;

    // Container rows input (only when container chip is active)
    const rowsRowEl = document.getElementById('insp-container-rows-row');
    const rowsInput = document.getElementById('insp-container-rows');
    rowsRowEl.hidden = !slotData.isContainer || slotData.custom;
    if (slotData.isContainer) {
      rowsInput.value = slotData.containerRows || 2;
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
            linked.maxRows = target;
            render();
          }
        }
      };
    }

    // ── Remaining variables (non-numeric, non-weapon select) ──
    const varsEl = document.getElementById('insp-vars');
    varsEl.innerHTML = '';
    for (const [key, meta] of Object.entries(slotData.variables || {})) {
      // Numeric → shown inline; weapon/armor select → shown in props row
      if (meta.control === 'plusminus' || meta.control === 'both') continue;
      if ((key === 'weapon' || key === 'armor' || key === 'element' || key === 'spell' || key === 'creature') && meta.control === 'select') continue;

      const div = document.createElement('div');
      div.className = 'insp-var';
      const label = document.createElement('span');
      label.className = 'insp-var-label';
      label.textContent = key;
      const sel = document.createElement('select');
      sel.className = 'insp-select';
      (meta.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === meta.value) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => { slotData.variables[key].value = sel.value; render(); });
      div.appendChild(label); div.appendChild(sel);
      varsEl.appendChild(div);
    }

    // ── Custom item edit panel ──
    const prevEditPanel = document.getElementById('insp-custom-edit-panel');
    if (prevEditPanel) prevEditPanel.remove();
    if (slotData.custom && container && _customEditOpen) {
      const panel = document.createElement('div');
      panel.id = 'insp-custom-edit-panel';

      const addRow = (...children) => {
        const row = document.createElement('div');
        row.className = 'custom-edit-row';
        children.forEach(c => row.appendChild(c));
        panel.appendChild(row);
      };

      const makeLabel = text => {
        const s = document.createElement('span');
        s.className = 'custom-edit-label';
        s.textContent = text;
        return s;
      };

      // Name
      const nameInp = document.createElement('input');
      nameInp.type = 'text'; nameInp.className = 'custom-edit-name-inp';
      nameInp.placeholder = 'Item name'; nameInp.value = slotData.name || '';
      nameInp.enterKeyHint = 'done';
      const commitName = () => {
        const v = nameInp.value.trim();
        if (!v || v === slotData.name) return;
        slotData.name = v;
        document.getElementById('insp-name').textContent = v;
        render();
      };
      nameInp.addEventListener('input', () => {
        const v = nameInp.value.trim();
        if (v) document.getElementById('insp-name').textContent = v;
      });
      nameInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitName(); nameInp.blur(); }
      });
      nameInp.addEventListener('blur', commitName);
      addRow(makeLabel('Name'), nameInp);

      // Type (+ Rows if container)
      const curCat = slotData.category || (slotData.isContainer ? 'container' : slotData.isWeapon ? 'weapon' : '');
      const catSel = document.createElement('select'); catSel.className = 'insp-select';
      [['','None'],['weapon','Weapon'],['armor','Armor'],['ammunition','Ammo'],
       ['shield','Shield'],['wondrous','Wondrous'],['container','Container']
      ].forEach(([val, lbl]) => {
        const o = document.createElement('option');
        o.value = val; o.textContent = lbl;
        if (val === curCat) o.selected = true;
        catSel.appendChild(o);
      });
      catSel.addEventListener('change', () => {
        const prevCat = slotData.category || (slotData.isContainer ? 'container' : slotData.isWeapon ? 'weapon' : '');
        const newCat = catSel.value;
        if (prevCat === 'container' && slotData.isContainer && slotData.containerId) {
          const linked = state.containers.find(cnt => cnt.id === slotData.containerId);
          if (linked && containerHasItems(linked)) {
            if (!confirm(`This will remove the ${slotData.name} container and its contents. Continue?`)) { catSel.value = 'container'; return; }
          }
          if (linked) state.containers = state.containers.filter(cnt => cnt !== linked);
          slotData.containerId = null; slotData.isContainer = false;
        }
        slotData.category = newCat; slotData.isWeapon = (newCat === 'weapon');
        slotData.variables = slotData.variables || {};
        if (newCat === 'weapon') { if (!slotData.variables.weapon) slotData.variables.weapon = { control: 'select', value: WEAPON_OPTIONS[0], options: WEAPON_OPTIONS }; delete slotData.variables.armor; }
        else if (newCat === 'armor' || newCat === 'shield') { if (!slotData.variables.armor) slotData.variables.armor = { control: 'select', value: ARMOR_OPTIONS[0], options: ARMOR_OPTIONS }; delete slotData.variables.weapon; }
        else if (newCat === 'container') { slotData.isContainer = true; slotData.containerRows = slotData.containerRows || 2; if (!slotData.containerId) createLinkedContainer(slotData, container.id, r, c); delete slotData.variables.weapon; delete slotData.variables.armor; }
        else { delete slotData.variables.weapon; delete slotData.variables.armor; }
        const silverOk = ['weapon','ammunition'].includes(newCat);
        const metalOk  = ['weapon','armor','shield','ammunition'].includes(newCat);
        if (!silverOk) { slotData.silvered = false; if (slotData.material === 'silvered') slotData.material = null; }
        if (!metalOk && (slotData.material === 'mithral' || slotData.material === 'adamantine')) slotData.material = null;
        render(); showInspector(slotData, container, r, c);
      });

      if (slotData.isContainer) {
        const rowsInp = document.createElement('input');
        rowsInp.type = 'number'; rowsInp.min = '1'; rowsInp.max = '20';
        rowsInp.value = slotData.containerRows || 2;
        rowsInp.className = 'cost-coin-inp';
        rowsInp.style.cssText = 'width:48px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:var(--text);font-size:13px;font-weight:600;text-align:center;padding:3px 4px;outline:none;';
        rowsInp.addEventListener('change', () => {
          slotData.containerRows = Math.max(1, Math.min(20, parseInt(rowsInp.value) || 2));
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
            linked.maxRows = target;
            render();
          }
        });
        addRow(makeLabel('Type'), catSel, makeLabel('Rows'), rowsInp);
      } else {
        addRow(makeLabel('Type'), catSel);
      }

      // Bulk + Has Uses + Treasure
      const isAmmoCustom = slotData.category === 'ammunition';
      const bulkStates = ['stock', 'packable', 'bulky'];
      const getBulkId = () => slotData.bulk ? slotData.bulk.id : 'stock';
      const bulkBtn = document.createElement('button');
      const refreshBulkBtn = () => {
        const s = getBulkId();
        bulkBtn.className = 'prop-chip' + (s === 'packable' ? ' active-packable' : s === 'bulky' ? ' active-bulky' : '');
        bulkBtn.textContent = s === 'packable' ? 'Packable' : s === 'bulky' ? 'Bulky' : 'Stock';
      };
      refreshBulkBtn();
      bulkBtn.onclick = () => {
        const next = bulkStates[(bulkStates.indexOf(getBulkId()) + 1) % bulkStates.length];
        const newBulk = Bulk[next.toUpperCase()] || Bulk.STOCK;
        container.slots[r][c] = null; slotData.bulk = newBulk;
        placeSlotData(slotData, container, r, c); showInspector(slotData, container, r, c);
      };

      const vars = slotData.variables || {};
      const isTreasureCustom = !!slotData.treasure;

      const makeChip = (label, active, onclick) => {
        const b = document.createElement('button');
        b.className = 'prop-chip' + (active ? ' active' : '');
        b.textContent = label; b.onclick = onclick;
        return b;
      };

      // Three-state uses toggle: 0 = none, 1 = uses, 2 = coin-uses
      const getUsesState = () =>
        slotData.hasUses === 'coins' ? 2
        : (slotData.hasUses || vars.uses || vars.count) ? 1 : 0;
      const usesChip = document.createElement('button');
      const refreshUsesChip = () => {
        const s = getUsesState();
        usesChip.className = 'prop-chip' + (s === 1 ? ' active' : s === 2 ? ' active-coins' : '');
        usesChip.innerHTML = s === 2 ? '<i class="fas fa-coins"></i> Uses' : 'Uses';
      };
      refreshUsesChip();
      usesChip.onclick = () => {
        const next = (getUsesState() + 1) % 3;
        if (next === 0) {
          slotData.hasUses = false;
          delete (slotData.variables || {}).uses;
          delete (slotData.variables || {}).count;
        } else {
          slotData.hasUses = next === 2 ? 'coins' : true;
          slotData.variables = slotData.variables || {};
          if (!slotData.variables.uses && !slotData.variables.count)
            slotData.variables.uses = { value: 1, control: 'both', min: 0 };
        }
        render(); showInspector(slotData, container, r, c);
      };

      const treasureChip = makeChip('Treasure', isTreasureCustom, () => {
        slotData.treasure = !slotData.treasure;
        render(); showInspector(slotData, container, r, c);
      });

      if (isAmmoCustom) addRow(usesChip, treasureChip);
      else addRow(makeLabel('Bulk'), bulkBtn, usesChip, treasureChip);

      // Cost fields
      if (!slotData.costCoins) slotData.costCoins = { pp: 0, gp: 0, sp: 0, cp: 0 };
      const costCoins = slotData.costCoins;
      const costWrap = document.createElement('div');
      costWrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1;';
      [['pp','rgba(190,145,255,0.9)'],['gp','rgba(255,205,60,0.9)'],['sp','rgba(200,200,215,0.85)'],['cp','rgba(205,135,65,0.85)']].forEach(([key, color]) => {
        const lbl = document.createElement('span');
        lbl.textContent = key.toUpperCase();
        lbl.style.cssText = `font-size:10px;font-weight:700;color:${color};`;
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.max = '999999';
        inp.value = costCoins[key] || 0;
        inp.className = 'cost-coin-inp';
        inp.style.cssText = 'width:48px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:var(--text);font-size:13px;font-weight:600;text-align:center;padding:3px 4px;outline:none;';
        inp.addEventListener('change', () => { costCoins[key] = Math.max(0, parseInt(inp.value) || 0); showInspector(slotData, container, r, c, packIdx); render(); });
        costWrap.appendChild(lbl); costWrap.appendChild(inp);
      });
      addRow(makeLabel('Cost'), costWrap);

      // Description
      const descTa = document.createElement('textarea');
      descTa.className = 'custom-edit-desc';
      descTa.placeholder = 'Description…';
      descTa.value = slotData.description || '';
      descTa.oninput = () => { slotData.description = descTa.value; };
      panel.appendChild(descTa);

      varsEl.parentNode.insertBefore(panel, varsEl);
    }

    inspectorEl.classList.remove('inspector-collapsed');
  }

  function refreshInspectorCollapsed() {
    if (inspectorItemKey === null) {
      inspectorEl.classList.add('inspector-collapsed');
    }
  }

  function hideInspector() {
    if (document.querySelector('#insp-props .insp-select.flash-required')) return;
    if (document.querySelector('#insp-props .chip-flash-required')) return;
    inspectorItemKey = null;
    _customEditKey = null; _customEditOpen = false;
    refreshInspectorCollapsed();
  }

  function toggleInspectorFor(key, slotData, container, r, c) {
    if (inspectorItemKey === key && !inspectorEl.classList.contains('inspector-collapsed')) {
      hideInspector();
    } else {
      showInspector(slotData, container, r, c);
      inspectorItemKey = key;
    }
    render();
  }

  document.getElementById('insp-toggle').addEventListener('click', () => {
    hideInspector();
    render();
  });


  document.addEventListener('pointerdown', e => {
    if (inspectorItemKey !== null
        && !inspectorEl.classList.contains('inspector-collapsed')
        && !inspectorEl.contains(e.target)
        && !e.target.closest('.slot')
        && !e.target.closest('.shop-item-row')) {
      hideInspector();
      render();
    }
  });

  // ── CHARACTER FIELDS ──────────────────────────────────────────────────────
  document.getElementById('char-name').addEventListener('input', e => { state.charName = e.target.value; });
  document.getElementById('char-carry').addEventListener('input', e => {
    state.carryCapacity = e.target.value;
    updateCarryDisplay();
  });

  // ── DRAG & DROP ───────────────────────────────────────────────────────────
  const _shopTabBtn  = document.getElementById('shop-tab-btn');
  const _trashBtn    = document.getElementById('drag-trash-btn');

  function activateTrash() {
    _trashBtn.hidden = false;
    _shopTabBtn.classList.add('shop-tab-sell-zone');
    [_trashBtn, _shopTabBtn].forEach(el => {
      el.classList.remove('drag-jiggle');
      void el.offsetWidth; // force reflow so animation restarts
      el.classList.add('drag-jiggle');
    });
  }
  function deactivateTrash() {
    _trashBtn.hidden = true;
    _trashBtn.classList.remove('drag-trash-hover', 'drag-jiggle');
    _shopTabBtn.classList.remove('shop-tab-sell-zone', 'shop-tab-sell-hover', 'drag-jiggle');
    document.querySelectorAll('.char-tab.drag-target').forEach(tab => {
      tab.classList.remove('drag-target');
    });
  }

  function getSlotWeaponType(slotData) {
    const wt = window.WEAPON_TYPES;
    if (!wt) return null;
    const weaponVal = slotData.variables?.weapon?.value;
    if (weaponVal) return wt[weaponVal] || null;
    const lib = getLibraryItem(slotData.name);
    if (lib) return wt[lib.name] || null;
    return null;
  }

  function getSlotTypeCostCp(slotData) {
    const typeName = slotData.variables?.weapon?.value || slotData.variables?.armor?.value;
    if (typeName) {
      const lib = getLibraryItem(typeName);
      return lib?.cost ? parseCostCp(lib.cost) : 0;
    }
    const spellName = slotData.variables?.spell?.value;
    if (spellName) return window.SPELL_STORING_COSTS?.[spellName] || 0;
    return 0;
  }


  function getSlotMaterialCostCp(slotData, isAmmo) {
    const silverCp = isAmmo ? 1000  : 10000;
    const metalCp  = isAmmo ? 5000  : 50000;
    return ((slotData.silvered || slotData.material === 'silvered') ? silverCp : 0)
         + ((slotData.material === 'mithral' || slotData.material === 'adamantine') ? metalCp : 0);
  }

  function getSlotCoinUsesMultiplier(slotData) {
    const hasUses = slotData.hasUses ?? getLibraryItem(slotData.name)?.hasUses;
    if (hasUses !== 'coins') return 1;
    const v = slotData.variables || {};
    return Math.max(1, v.uses?.value ?? v.count?.value ?? 1);
  }

  function parseCostCp(costStr) {
    if (!costStr || /^free$/i.test(costStr.trim())) return 0;
    let total = 0;
    const pp = costStr.match(/(\d+(?:\.\d+)?)\s*pp/i);
    const gp = costStr.match(/(\d+(?:\.\d+)?)\s*gp/i);
    const sp = costStr.match(/(\d+(?:\.\d+)?)\s*sp/i);
    const cp = costStr.match(/(\d+(?:\.\d+)?)\s*cp/i);
    if (pp) total += Math.round(parseFloat(pp[1]) * 1000);
    if (gp) total += Math.round(parseFloat(gp[1]) * 100);
    if (sp) total += Math.round(parseFloat(sp[1]) * 10);
    if (cp) total += Math.round(parseFloat(cp[1]));
    return total;
  }

  function cpToCoins(totalCp) {
    // Never produce PP — cap at GP denomination
    const gp = Math.floor(totalCp / 100); totalCp %= 100;
    const sp = Math.floor(totalCp / 10);  totalCp %= 10;
    return { pp: 0, gp, sp, cp: totalCp };
  }

  function deductCostCp(costCp) {
    if (costCp <= 0) return;

    const purses = [];
    for (const container of state.containers) {
      for (const row of container.slots) {
        for (const slot of row) {
          if (!slot?.variables) continue;
          const v = slot.variables;
          if ('gp' in v && 'sp' in v && 'cp' in v) purses.push(v);
        }
      }
    }
    if (!purses.length) return;

    let totalCp = 0;
    for (const v of purses)
      totalCp += (v.pp?.value || 0) * 1000 + (v.gp?.value || 0) * 100
               + (v.sp?.value || 0) * 10   + (v.cp?.value  || 0);
    if (totalCp < costCp) return;

    for (const v of purses) {
      if (v.pp) v.pp.value = 0;
      if (v.gp) v.gp.value = 0;
      if (v.sp) v.sp.value = 0;
      if (v.cp) v.cp.value = 0;
    }
    let rem = totalCp - costCp;
    const f  = purses[0];
    if (f.pp) f.pp.value = 0;
    if (f.gp) { f.gp.value = Math.floor(rem / 100);  rem %= 100; }
    if (f.sp) { f.sp.value = Math.floor(rem / 10);   rem %= 10; }
    if (f.cp) { f.cp.value = rem; }

    render();
  }

  function deductCost(costStr) { deductCostCp(parseCostCp(costStr)); }

  function addItemLocal(slotData) {
    const targets = state.containers.filter(c => c.id === 'equipped' || c.id === 'strapped');
    for (const container of targets) {
      for (let r = 0; r < container.slots.length; r++) {
        if (!container.slots[r][0]) {
          placeSlotData(slotData, container, r, 0);
          return { container, r, c: 0 };
        }
        if (!container.slots[r][1]) {
          placeSlotData(slotData, container, r, 1);
          return { container, r, c: 1 };
        }
      }
    }
    const strapped = state.containers.find(c => c.id === 'strapped');
    if (strapped) {
      strapped.slots.push([null, null]);
      strapped.rows++;
      const r = strapped.slots.length - 1;
      placeSlotData(slotData, strapped, r, 0);
      return { container: strapped, r, c: 0 };
    }
    return null;
  }

  // removeFromSource: called only when a drop is committed, to extract the item from its origin.
  function startDrag(slotData, container, r, c, x, y, srcCenter, removeFromSource) {
    dragState = { slotData, srcContainer: container, srcR: r, srcC: c, srcCenter: srcCenter || null, removeFromSource };

    ghostEl = document.createElement('div');
    ghostEl.className = 'drag-ghost';
    ghostEl.textContent = slotData.name || '';
    document.body.appendChild(ghostEl);
    document.body.classList.add('is-dragging');

    if (container !== null) activateTrash();

    document.querySelectorAll('.char-tab').forEach(tab => {
      tab.classList.add('drag-target');
    });

    moveGhost(x, y);
    closeDropdown();
    if (document.activeElement) document.activeElement.blur();
  }

  function moveGhost(x, y) {
    if (!ghostEl) return;
    ghostEl.style.left = `${x}px`;
    ghostEl.style.top  = `${y}px`;
  }

  function endDrag(x, y) {
    if (!dragState) return;
    dragScrollVel = 0;
    dragScrollRaf = null;

    // Capture trash position BEFORE deactivateTrash() hides the button (display:none
    // makes getBoundingClientRect return zeros and elementFromPoint skip it).
    const _trashRect = _trashBtn.getBoundingClientRect();
    const _overTrash = !_trashBtn.hidden
      && x >= _trashRect.left && x <= _trashRect.right
      && y >= _trashRect.top  && y <= _trashRect.bottom;

    deactivateTrash();

    ghostEl.style.visibility = 'hidden';
    const el = document.elementFromPoint(x, y);
    const ghost = ghostEl;
    ghostEl = null;
    document.body.classList.remove('is-dragging');

    // Cursor ghost just fades — slot-to-slot clones handle the position animation
    ghost.style.visibility = 'visible';
    requestAnimationFrame(() => {
      ghost.style.transition = 'opacity 0.12s';
      ghost.style.opacity = '0';
      setTimeout(() => ghost.remove(), 160);
    });

    const wrap = el && el.closest('[data-container-id]');
    const targetContainer = wrap && state.containers.find(c => c.id === wrap.dataset.containerId);
    const isShopDrag = !!dragState._shopDrag;
    const { slotData, srcContainer, srcR, srcC, srcCenter, removeFromSource } = dragState;
    dragState = null;

    if (_overTrash && srcContainer) {
      const trashLib = getLibraryItem(slotData.name);
      if (trashLib && trashLib.warnOnRemove) {
        const v = slotData.variables || {};
        const hasCoins = ['pp','gp','sp','cp'].some(k => v[k] && (v[k].value || 0) > 0);
        if (hasCoins && !confirm(trashLib.warnOnRemove)) { render(); return; }
      }
      clearSlot(srcContainer, srcR, srcC);
      if (onSound) onSound('bin');
      return;
    }

    // Sell: dropped on shop tab button
    if (el && (el === _shopTabBtn || _shopTabBtn.contains(el)) && srcContainer) {
      // Block selling a container that still has items
      if (slotData.containerId) {
        const linked = state.containers.find(c => c.id === slotData.containerId);
        if (linked && containerHasItems(linked)) {
          flashBlockedContainer(srcContainer.id, srcR, srcC, slotData.containerId);
          return;
        }
      }

      const lib = getLibraryItem(slotData.name);
      const isTreasure = !!(lib && lib.treasure) || !!slotData.treasure;
      const sc = slotData.costCoins;
      const qty = slotData.variables?.qty?.value || 1;
      const _matCp = getSlotMaterialCostCp(slotData, lib?.category === 'ammunition');
      const unitCp = ((sc
        ? (sc.pp||0)*1000 + (sc.gp||0)*100 + (sc.sp||0)*10 + (sc.cp||0)
        : (lib && lib.cost ? parseCostCp(lib.cost) : 0))
        + getSlotTypeCostCp(slotData) + _matCp)
        * getSlotCoinUsesMultiplier(slotData);
      const fullCp = unitCp * qty;
      const halfCp = fullCp > 0 ? (isTreasure ? fullCp : Math.floor(fullCp / 2)) : 0;
      if (halfCp > 0) {
        if (slotData.containerId)
          state.containers = state.containers.filter(c => c.id !== slotData.containerId);
        removeFromSource();
        const coins = cpToCoins(halfCp);
        const purseLib = getLibraryItem('Coin Purse');
        const purseVars = JSON.parse(JSON.stringify(
          purseLib ? purseLib.variables
                   : { pp: { value: 0, control: 'both', min: 0, max: 999999 },
                       gp: { value: 0, control: 'both', min: 0, max: 999999 },
                       sp: { value: 0, control: 'both', min: 0, max: 999999 },
                       cp: { value: 0, control: 'both', min: 0, max: 999999 } }
        ));
        purseVars.pp.value = coins.pp;
        purseVars.gp.value = coins.gp;
        purseVars.sp.value = coins.sp;
        purseVars.cp.value = coins.cp;
        const placed = addItemLocal({ name: 'Coin Purse', variables: purseVars });
        if (onSound) onSound('coin');
        if (placed) {
          const purseData = placed.container.slots[placed.r][placed.c];
          inspectorItemKey = `${placed.container.id}-${placed.r}-${placed.c}`;
          showInspector(purseData, placed.container, placed.r, placed.c);
        } else {
          hideInspector();
        }
      } else {
        render();
      }
      return;
    }

    // Cross-character tab drop
    const charTab = el && el.closest('[data-char-id]');
    if (charTab && charTab.dataset.charId) {
      document.querySelectorAll('[data-char-id]').forEach(t => t.classList.remove('tab-drag-over'));
      if (onCrossCharDrop) {
        // Capture linked container before removing from source
        let linkedContainer = null;
        if (slotData.containerId) {
          const linked = state.containers.find(c => c.id === slotData.containerId);
          if (linked) {
            linkedContainer = JSON.parse(JSON.stringify(linked));
            state.containers = state.containers.filter(c => c.id !== slotData.containerId);
          }
        }
        removeFromSource();
        render();
        onCrossCharDrop(slotData, charTab.dataset.charId, linkedContainer);
      }
      // else: no handler — item stays in slot, nothing to do
      return;
    }

    if (targetContainer) {
      const tR = parseInt(wrap.dataset.r);
      const tC = parseInt(wrap.dataset.c);

      // Reject dropping a container into itself
      if (slotData.containerId && slotData.containerId === targetContainer.id) {
        render();
        return;
      }

      // Same slot — no-op
      if (targetContainer === srcContainer && tR === srcR && tC === srcC) {
        render();
        return;
      }

      const targetItem = targetContainer.slots[tR][tC];

      // Capture dest rect before render() rebuilds the DOM
      const destRect = wrap.getBoundingClientRect();
      const destCenter = { x: destRect.left + destRect.width / 2, y: destRect.top + destRect.height / 2 };

      // Coin Purse merge: drop one onto another of the same name that has coin variables
      if (targetItem && targetItem.name === slotData.name) {
        const COIN_KEYS = ['pp', 'gp', 'sp', 'cp'];
        const sv = slotData.variables || {};
        const tv = targetItem.variables || {};
        if (COIN_KEYS.some(k => k in sv && k in tv)) {
          COIN_KEYS.forEach(k => {
            if (sv[k] && tv[k]) tv[k].value = (tv[k].value || 0) + (sv[k].value || 0);
          });
          removeFromSource();
          render();
          return;
        }
      }

      // Smart drop into container: if target slot holds a container item, try placing inside it
      if (targetItem && targetItem.containerId) {
        const linked = state.containers.find(c => c.id === targetItem.containerId);
        if (linked) {
          const freeSlot = findEmptySlot(linked, -1);
          if (freeSlot && itemFillCost(slotData, linked) <= containerFillAvailable(linked) + 0.001) {
            removeFromSource();
            if (placeSlotData(slotData, linked, freeSlot.r, freeSlot.c) && !slotData._unresolved && isShopDrag && onShopPurchase) onShopPurchase(slotData);
            if (onSound) onSound(isShopDrag ? 'coin' : 'place');
            return;
          }
        }
      }

      // Commit: remove item from source now that we know the drop is valid
      removeFromSource();

      if (targetItem && srcContainer) {
        // Swap — fly both items between their old and new slots (only for inventory→inventory)
        const swapName = targetItem.name || '';
        targetContainer.slots[tR][tC] = null;
        srcContainer.slots[srcR][srcC] = targetItem;
        placeSlotData(slotData, targetContainer, tR, tC);
        const actualDest = postRenderCenter(targetContainer.id, tR, tC, slotData) || destCenter;
        if (srcCenter) spawnFlightClone(slotData.name || '', srcCenter, actualDest);
        const actualSwapDest = postRenderCenter(srcContainer.id, srcR, srcC, targetItem);
        if (actualSwapDest) spawnFlightClone(swapName, destCenter, actualSwapDest);
        if (onSound) onSound('place');
        return;
      }

      const _placed = placeSlotData(slotData, targetContainer, tR, tC);
      if (_placed && !slotData._unresolved && isShopDrag && onShopPurchase) onShopPurchase(slotData);
      if (_placed && onSound) onSound(isShopDrag ? 'coin' : 'place');
      const actualDest = postRenderCenter(targetContainer.id, tR, tC, slotData) || destCenter;
      if (srcCenter) spawnFlightClone(slotData.name || '', srcCenter, actualDest);
    } else {
      // Dropped outside any container — item stays in slot
      render();
    }
  }

  function postRenderCenter(containerId, r, c, item) {
    const el = document.querySelector(
      `[data-container-id="${containerId}"][data-r="${r}"][data-c="${c}"]`
    );
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function spawnFlightClone(name, from, to) {
    const clone = document.createElement('div');
    clone.className = 'drag-ghost';
    clone.textContent = name;
    clone.style.left      = `${from.x}px`;
    clone.style.top       = `${from.y}px`;
    clone.style.transform = 'translate(-50%, -50%)';
    clone.style.opacity   = '1';
    document.body.appendChild(clone);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // Phase 1: fly to destination (0 – 350ms)
      clone.style.transition = 'left 0.35s cubic-bezier(0.4,0,0.2,1), top 0.35s cubic-bezier(0.4,0,0.2,1)';
      clone.style.left = `${to.x}px`;
      clone.style.top  = `${to.y}px`;
      // Phase 2: scale up on arrival (350 – 490ms)
      setTimeout(() => {
        clone.style.transition = 'transform 0.14s ease-out';
        clone.style.transform  = 'translate(-50%, -50%) scale(1.18)';
        // Phase 3: scale down and fade out (490 – 760ms)
        setTimeout(() => {
          clone.style.transition = 'transform 0.27s ease-in, opacity 0.27s ease-in';
          clone.style.transform  = 'translate(-50%, -50%) scale(0.75)';
          clone.style.opacity    = '0';
          setTimeout(() => clone.remove(), 300);
        }, 140);
      }, 370);
    }));
  }

  function placeSlotData(slotData, container, r, c) {
    if (slotData._unresolved) {
      if (slotData._shopItem) {
        const key = `shop-${slotData.name}`;
        if (inspectorItemKey !== key || inspectorEl.classList.contains('inspector-collapsed')) {
          showInspector(slotData, null, -1, -1);
          inspectorItemKey = key;
        }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.querySelectorAll('#insp-props .insp-select').forEach(sel => {
            if (sel.value !== '') return;
            sel.classList.remove('flash-required');
            void sel.offsetWidth;
            sel.classList.add('flash-required');
            setTimeout(() => sel.classList.remove('flash-required'), 900);
          });
          document.querySelectorAll('#insp-props [data-mat-chip]').forEach(btn => {
            btn.classList.remove('chip-flash-required');
            void btn.offsetWidth;
            btn.classList.add('chip-flash-required');
            setTimeout(() => btn.classList.remove('chip-flash-required'), 900);
          });
        }));
      }
      render();
      return false;
    }
    slotData.conflict = false;
    const existing = container.slots[r][c];
    const existingFill = existing ? itemFillCost(existing, container) : 0;
    if (itemFillCost(slotData, container) - existingFill > containerFillAvailable(container) + 0.001) {
      render();
      return;
    }

    ensurePackableQty(slotData);
    container.slots[r][c] = slotData;

    if (slotData.containerId) {
      const linked = state.containers.find(cnt => cnt.id === slotData.containerId);
      if (linked) linked.linkedTo = { containerId: container.id, r, c };
    } else if (isContainerItem(slotData)) {
      createLinkedContainer(slotData, container.id, r, c);
    }

    render();
    return true;
  }

  document.addEventListener('pointermove', e => {
    if (!dragState) return;
    moveGhost(e.clientX, e.clientY);

    // Highlight trash when hovering over it
    if (!_trashBtn.hidden) {
      const tr = _trashBtn.getBoundingClientRect();
      const over = e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom;
      _trashBtn.classList.toggle('drag-trash-hover', over);
    }

    // Highlight shop tab as sell zone when hovering
    if (_shopTabBtn.classList.contains('shop-tab-sell-zone')) {
      const str = _shopTabBtn.getBoundingClientRect();
      const overShop = e.clientX >= str.left && e.clientX <= str.right
                    && e.clientY >= str.top  && e.clientY <= str.bottom;
      _shopTabBtn.classList.toggle('shop-tab-sell-hover', overShop);
    }

    dragScrollVel = 0;
  });

  document.addEventListener('pointerup', e => {
    if (dragState) endDrag(e.clientX, e.clientY);
  });

  document.addEventListener('pointercancel', () => {
    if (!dragState) return;
    dragScrollVel = 0;
    dragScrollRaf = null;
    deactivateTrash();
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    document.body.classList.remove('is-dragging');
    dragState = null;
    render();
  });

  // ── CONTAINER REORDER ────────────────────────────────────────────────────
  const cDropLine = document.createElement('div');
  cDropLine.className = 'container-drop-line';

  let cDrag = null; // { id, el }
  let cDropBeforeId = undefined; // undefined = not dragging, null = append at end, string = insert before this id

  function startContainerDrag(containerId, cardEl, pointerId, startY) {
    cDrag = { id: containerId, el: cardEl };
    cDropBeforeId = null;
    cardEl.classList.add('container-dragging');
    document.documentElement.setPointerCapture(pointerId);
  }

  function updateContainerDrop(clientY) {
    if (!cDrag) return;
    if (cDropLine.parentNode) cDropLine.remove();

    // All non-permanent, non-dragged cards in DOM order
    const candidates = [...containersEl.querySelectorAll('.inv-card:not(.container-dragging)')]
      .filter(el => {
        const c = state.containers.find(c => c.id === el.dataset.containerId);
        return c && !c.permanent;
      });

    let beforeCard = null;
    for (const card of candidates) {
      const rect = card.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { beforeCard = card; break; }
    }

    if (beforeCard) {
      containersEl.insertBefore(cDropLine, beforeCard);
      cDropBeforeId = beforeCard.dataset.containerId;
    } else {
      containersEl.appendChild(cDropLine);
      cDropBeforeId = null;
    }
  }

  function commitContainerDrop() {
    if (!cDrag) return;
    cDrag.el.classList.remove('container-dragging');
    if (cDropLine.parentNode) cDropLine.remove();

    const dragId    = cDrag.id;
    const beforeId  = cDropBeforeId;
    cDrag = null; cDropBeforeId = undefined;

    const dragIdx = state.containers.findIndex(c => c.id === dragId);
    if (dragIdx === -1) { render(); return; }
    const [dragged] = state.containers.splice(dragIdx, 1);
    if (beforeId) {
      const targetIdx = state.containers.findIndex(c => c.id === beforeId);
      state.containers.splice(targetIdx === -1 ? state.containers.length : targetIdx, 0, dragged);
    } else {
      state.containers.push(dragged);
    }
    render();
  }

  document.addEventListener('pointermove', e => {
    if (!cDrag) return;
    updateContainerDrop(e.clientY);
  });

  document.addEventListener('pointerup', e => {
    if (cDrag) commitContainerDrop();
  });

  document.addEventListener('pointercancel', () => {
    if (!cDrag) return;
    cDrag.el.classList.remove('container-dragging');
    if (cDropLine.parentNode) cDropLine.remove();
    cDrag = null; cDropBeforeId = undefined;
    render();
  });

  // ── INIT ──────────────────────────────────────────────────────────────────
  render();

  return {
    getState() {
      return JSON.parse(JSON.stringify({
        charName:      state.charName,
        carryCapacity: state.carryCapacity,
        containers:    state.containers,
      }));
    },
    flattenGroups(containers) { flattenPackableGroups(containers); },


    // ── SHOP API ────────────────────────────────────────────────
    toggleShopItem(slotData, key) {
      toggleInspectorFor(key, slotData, null, -1, -1);
    },
    showShopItem(slotData, key) {
      showInspector(slotData, null, -1, -1);
      inspectorItemKey = key;
      render();
    },
    startShopDrag(slotData, x, y) {
      startDrag(slotData, null, -1, -1, x, y, null, () => {});
      dragState._shopDrag = true;
    },
    addItem(slotData) {
      addItemLocal(slotData);
    },
    removeItem(slotData) {
      for (const container of state.containers) {
        for (let r = 0; r < container.slots.length; r++) {
          for (let c = 0; c < 2; c++) {
            if (container.slots[r][c] === slotData) {
              if (slotData.containerId) {
                state.containers = state.containers.filter(ct => ct.id !== slotData.containerId);
              }
              container.slots[r][c] = null;
              render();
              return;
            }
          }
        }
      }
    },
    deductCost(costStr)   { deductCost(costStr); },
    deductCostCp(costCp) { deductCostCp(costCp); },

    cancelDrag() {
      if (!dragState) return;
      dragScrollVel = 0;
      dragScrollRaf = null;
      deactivateTrash();
      if (ghostEl) { ghostEl.remove(); ghostEl = null; }
      document.body.classList.remove('is-dragging');
      dragState = null;
      render();
    },
    loadState(newState) {
      if (dragState) {
        // cancelDrag() should have been called before loadState; just clean up UI
        if (ghostEl) { ghostEl.remove(); ghostEl = null; }
        document.body.classList.remove('is-dragging');
        dragState = null;
      }
      hideInspector();
      closeDropdown();
      state.charName      = newState.charName      || '';
      state.carryCapacity = newState.carryCapacity || '';
      state.containers    = (newState.containers && newState.containers.length)
                            ? newState.containers : createDefaultContainers();
      flattenPackableGroups(state.containers);
      for (const c of state.containers)
        for (const row of c.slots)
          for (const slot of row) ensurePackableQty(slot);
      document.getElementById('char-name').value  = state.charName;
      document.getElementById('char-carry').value = state.carryCapacity;
      render();
    },
  };
};


// ── CHARACTER MANAGER ──────────────────────────────────────────────────────
window.CharacterManager = ({ auth, database }) => {
  let currentUser  = null;
  let currentCharId = null;
  let allChars     = {};   // id → { ownerUid, ownerName, state, createdAt, sortOrder }
  let suppressSave       = false;
  let dirty              = false;   // true while local edits haven't been flushed to Firebase yet
  let localWriteInFlight = false;   // true briefly after a save to suppress our own Firebase echo
  let pendingNewChar     = null;    // char created locally but not yet confirmed by Firebase
  const pendingDeletes   = new Set(); // char IDs removed locally but not yet confirmed by Firebase
  let inv                = null;

  // ── SOUND ────────────────────────────────────────────────────────────────
  const playSound = (() => {
    const audios = {};
    ['bin', 'coin', 'place'].forEach(name => {
      const a = new Audio(`sounds/${name}.ogg`);
      a.preload = 'auto';
      audios[name] = a;
    });
    return name => {
      try {
        const a = audios[name];
        if (!a) return;
        a.currentTime = 0;
        a.play().catch(() => {});
      } catch (e) {}
    };
  })();

  // ── INVENTORY SYSTEM ────────────────────────────────────────────────────
  inv = window.InventorySystem({
    database: null,
    auth: { onAuthStateChanged: () => {} },
    onChange:            handleInventoryChange,
    onCrossCharDrop:     handleCrossCharDrop,
    onShopPurchase:      handleShopPurchase,
    isHiddenFromPlayer:  (itemName) => !isItemVisible(itemName, getItemSection(itemName)),
    onSound:             playSound,
  });

  // ── CLOSE / LOGOUT ──────────────────────────────────────────────────────
  // ── VIEW TOGGLE (hexmap ↔ inventory) ────────────────────────────────────
  let _hexmapMode = true;
  let _shopFromHexmap = false;
  const _closeBtn  = document.getElementById('inv-close-btn');
  const _closeBtnI = _closeBtn.querySelector('i');

  function _applyViewMode() {
    document.getElementById('app').classList.toggle('hexmap-mode', _hexmapMode);
    _closeBtnI.className = _hexmapMode ? 'fa-solid fa-scroll' : 'fa-solid fa-map';
    _closeBtn.title      = _hexmapMode ? 'Inventory' : 'Map view';
  }

  _closeBtn.addEventListener('click', () => {
    if (_shopFromHexmap && shopOpen) {
      closeShop();
      return;
    }
    _hexmapMode = !_hexmapMode;
    _applyViewMode();
    if (_hexmapMode) window.hexOnGoToHexmap && window.hexOnGoToHexmap();
    else window.hexOnGoToInventory && window.hexOnGoToInventory();
    if (!_hexmapMode) ensureCharSelected();
    else deselectChar();
  });

  // ── HEXMAP TOOLBAR ──────────────────────────────────────────────────────
  const _hexToolBtn    = document.getElementById('hex-tool-btn');
  const _hexOverlayBtn = document.getElementById('hex-overlay-btn');
  const _hexClearBtn   = document.getElementById('hex-clear-btn');
  const _hexSignOutBtn = document.getElementById('hex-sign-out-btn');

  _hexToolBtn.addEventListener('click',    () => window.hexAction && window.hexAction('toolToggle'));
  _hexOverlayBtn.addEventListener('click', () => window.hexAction && window.hexAction('overlayToggle'));
  _hexClearBtn.addEventListener('click',   () => window.hexAction && window.hexAction('clearHexes'));

  document.getElementById('hex-erase-btn').addEventListener('click', () => {
    window.hexAction && window.hexAction('eraseToggle');
  });
  document.querySelectorAll('.hex-color-btn[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.hexAction && window.hexAction('colorSelect', btn.dataset.color);
    });
  });
  _hexSignOutBtn.addEventListener('click', () => {
    auth.signOut().catch(() => {});
  });

  // Start in hexmap-mode
  _applyViewMode();

  // Converts a plain username to a Firebase-compatible email by appending a
  // fixed domain. If the value already contains '@' it is returned unchanged.
  function toFirebaseEmail(username) {
    const s = (username || '').trim();
    return s.includes('@') ? s : `${s}@bytespritegames.com`;
  }

  // Receive messages from the parent page
  window.addEventListener('message', e => {
    if (!e.data) return;
    if (e.data.type === 'hexState') {
      if (e.data.toolIcon)    _hexToolBtn.querySelector('i').className    = `fa-solid fa-fw ${e.data.toolIcon}`;
      if (e.data.overlayIcon) _hexOverlayBtn.querySelector('i').className = `fa-solid fa-fw ${e.data.overlayIcon}`;
      _hexToolBtn.classList.toggle('active', !!e.data.toolActive);
      document.getElementById('hexmap-toolbar').classList.toggle('tool-active', !!e.data.toolActive);
      document.getElementById('hexmap-toolbar').classList.toggle('show-colors', !!e.data.showColors);
      const eraseActive = !!e.data.eraseMode;
      document.getElementById('hex-erase-btn').classList.toggle('active-color', eraseActive);
      if (e.data.activeColor !== undefined || e.data.eraseMode !== undefined) {
        document.querySelectorAll('.hex-color-btn[data-color]').forEach(btn => {
          btn.classList.toggle('active-color', !eraseActive && btn.dataset.color === e.data.activeColor);
        });
      }
      if (e.data.signedIn !== undefined) {
        _hexSignOutBtn.hidden = !e.data.signedIn;
      }
    }
  });

  // ── SHOP ────────────────────────────────────────────────────────────────
  let shopOpen = false;
  const shopTabBtn  = document.getElementById('shop-tab-btn');
  const shopPanel   = document.getElementById('shop-panel');
  const invScrollEl = document.getElementById('inv-scroll');
  const charHeaderEl= document.getElementById('char-header');

  function setFieldsOpen(open) {
    charHeaderEl.classList.toggle('fields-collapsed', !open);
  }

  document.getElementById('char-fields-edit-btn').addEventListener('click', () => {
    setFieldsOpen(charHeaderEl.classList.contains('fields-collapsed'));
  });


  let shopVisibility = {};
  let shopVisRef = null;
  const DEFAULT_HIDDEN_SECTIONS = new Set(['Magical Weapons', 'Magical Curios', 'Consumable Magical Curios']);

  function encodeFirebaseKey(str) {
    return str
      .replace(/%/g,  '%25')
      .replace(/\./g, '%2E')
      .replace(/#/g,  '%23')
      .replace(/\$/g, '%24')
      .replace(/\//g, '%2F')
      .replace(/\[/g, '%5B')
      .replace(/\]/g, '%5D');
  }

  function decodeFirebaseKey(str) {
    return str
      .replace(/%2E/gi, '.')
      .replace(/%23/gi, '#')
      .replace(/%24/gi, '$')
      .replace(/%2F/gi, '/')
      .replace(/%5B/gi, '[')
      .replace(/%5D/gi, ']')
      .replace(/%25/gi, '%');
  }

  function encodeVisObj(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[encodeFirebaseKey(k)] = v;
    return out;
  }

  function decodeVisObj(raw) {
    const out = {};
    for (const [k, v] of Object.entries(raw)) out[decodeFirebaseKey(k)] = v;
    return out;
  }

  function getItemSection(itemName) {
    let section = null;
    for (const item of window.ITEM_LIBRARY) {
      if (item._section) section = item._section;
      if (item.name && item.name === itemName) return section;
    }
    return null;
  }

  function isItemVisible(itemName, section) {
    return Object.prototype.hasOwnProperty.call(shopVisibility, itemName)
      ? shopVisibility[itemName]
      : !DEFAULT_HIDDEN_SECTIONS.has(section);
  }

  function saveShopVisibility() {
    if (shopVisRef) shopVisRef.set(encodeVisObj(shopVisibility));
  }

  function subscribeToShopVisibility() {
    if (shopVisRef) shopVisRef.off('value');
    shopVisRef = database.ref('/inventory_shop_visibility');
    shopVisRef.on('value', snap => {
      shopVisibility = decodeVisObj(snap.val() || {});
      if (shopOpen) buildShop();
    });
  }

  let shopAvailability = {};
  let shopAvailRef = null;

  function isItemAvailable(itemName) {
    return Object.prototype.hasOwnProperty.call(shopAvailability, itemName)
      ? shopAvailability[itemName]
      : true;
  }

  function saveShopAvailability() {
    if (shopAvailRef) shopAvailRef.set(encodeVisObj(shopAvailability));
  }

  function subscribeToShopAvailability() {
    if (shopAvailRef) shopAvailRef.off('value');
    shopAvailRef = database.ref('/inventory_shop_availability');
    shopAvailRef.on('value', snap => {
      shopAvailability = decodeVisObj(snap.val() || {});
      if (shopOpen) buildShop();
    });
  }

  function renderCostHtml(totalCp, suffix) {
    const parts = [];
    let r = totalCp;
    // Cap at GP — never show PP in cost display
    const gp = Math.floor(r / 100); r %= 100;
    const sp = Math.floor(r / 10);  r %= 10;
    if (gp) parts.push(`<span class="cost-gp">${gp}gp</span>`);
    if (sp) parts.push(`<span class="cost-sp">${sp}sp</span>`);
    if (r)  parts.push(`<span class="cost-cp">${r}cp</span>`);
    const base = parts.join(' ') || (totalCp === 0 ? '' : '');
    return base + (suffix ? `<span class="cost-suffix">${suffix}</span>` : '');
  }

  function shopCostToCp(costStr) {
    if (!costStr || /^free$/i.test(costStr.trim())) return 0;
    let total = 0;
    const pp = costStr.match(/(\d+(?:\.\d+)?)\s*pp/i);
    const gp = costStr.match(/(\d+(?:\.\d+)?)\s*gp/i);
    const sp = costStr.match(/(\d+(?:\.\d+)?)\s*sp/i);
    const cp = costStr.match(/(\d+(?:\.\d+)?)\s*cp/i);
    if (pp) total += Math.round(parseFloat(pp[1]) * 1000);
    if (gp) total += Math.round(parseFloat(gp[1]) * 100);
    if (sp) total += Math.round(parseFloat(sp[1]) * 10);
    if (cp) total += Math.round(parseFloat(cp[1]));
    return total;
  }

  function buildShop() {
    const scroll = document.getElementById('shop-scroll');
    const savedScrollTop = scroll.scrollTop;
    scroll.innerHTML = '';
    let currentSection = null;
    let currentRarity  = null;
    const SHOP_HIDDEN_SECTIONS = new Set(['Valuables', 'Currency']);
    const visibleSections = [];

    // Calculate current character's total wealth in cp for affordability display
    const charCoins = getCharCoins(currentCharId ? allChars[currentCharId]?.state : null);
    const walletCp  = charCoins.pp * 1000 + charCoins.gp * 100 + charCoins.sp * 10 + charCoins.cp;

    ITEM_LIBRARY.forEach(item => {
      if (item._section) {
        currentSection = item._section;
        currentRarity  = null;
        if (SHOP_HIDDEN_SECTIONS.has(currentSection)) return;
        visibleSections.push(currentSection);
        const h = document.createElement('div');
        h.className = 'shop-section-heading';
        h.textContent = item._section;
        scroll.appendChild(h);
        return;
      }

      if (item._rarity) {
        currentRarity = item._rarity;
        if (SHOP_HIDDEN_SECTIONS.has(currentSection)) return;
        const div = document.createElement('div');
        div.className = 'shop-rarity-divider';
        div.dataset.section = currentSection;
        div.dataset.rarity  = currentRarity;
        const label = document.createElement('span');
        label.className = 'shop-rarity-label';
        label.textContent = currentRarity;
        div.appendChild(label);
        if (window._isDM) {
          const btn = document.createElement('button');
          btn.className = 'shop-rarity-toggle';
          btn.dataset.section = currentSection;
          btn.dataset.rarity  = currentRarity;
          div.appendChild(btn);
        }
        scroll.appendChild(div);
        return;
      }

      if (!item.name) return;
      if (item.shopHidden) return;
      if (SHOP_HIDDEN_SECTIONS.has(currentSection)) return;

      const visible    = isItemVisible(item.name, currentSection);
      const avail      = isItemAvailable(item.name);
      const baseCostCp = shopCostToCp(item.cost);
      const costSuffix = (item.cost || '').match(/\/\S+/)?.[0] || '';

      // Effective category for material toggle eligibility
      const shopCat = item.category
        || (item.variables?.weapon?.control === 'select' ? 'weapon'
          : item.variables?.armor?.control  === 'select' ? 'armor'
          : ['Simple Weapons','Martial Weapons','Magical Weapons'].includes(currentSection) ? 'weapon'
          : currentSection === 'Armor & Shields' ? (item.name === 'Shield' ? 'shield' : 'armor')
          : null);
      const canSilver = ['weapon','ammunition'].includes(shopCat);
      const canMetal  = ['weapon','armor','shield','ammunition'].includes(shopCat);

      // Weapon/armor type select variable
      const typeVar    = item.variables?.weapon?.control  === 'select' ? item.variables.weapon
                       : item.variables?.armor?.control   === 'select' ? item.variables.armor
                       : null;
      const elementVar = item.variables?.element?.control === 'select' ? item.variables.element : null;
      const spellVar    = item.variables?.spell?.control    === 'select' ? item.variables.spell    : null;
      const creatureVar = item.variables?.creature?.control === 'select' ? item.variables.creature : null;

      // Persistent slotData for this row — mutated by the inspector, read by getSlotData()
      // Type/element start as '' (unselected placeholder) so user must pick before purchasing
      const cachedSlotData = buildShopSlotData(
        item, typeVar?.value, false, null, elementVar?.value, 0
      );
      if (typeVar    && cachedSlotData.variables?.weapon?.control  === 'select') cachedSlotData.variables.weapon.value  = '';
      if (typeVar    && cachedSlotData.variables?.armor?.control   === 'select') cachedSlotData.variables.armor.value   = '';
      if (elementVar && cachedSlotData.variables?.element?.control === 'select') cachedSlotData.variables.element.value = '';
      if (spellVar    && cachedSlotData.variables?.spell?.control    === 'select') cachedSlotData.variables.spell.value    = '';
      if (creatureVar && cachedSlotData.variables?.creature?.control === 'select') cachedSlotData.variables.creature.value = '';
      // Explicit unresolved flag — more reliable than checking '' values at drag time
      if (typeVar || elementVar || spellVar || creatureVar) cachedSlotData._unresolved = true;
      // Base Ammunition requires a material (silvered/mithral/adamantine) before purchase
      if (item.name === 'Ammunition' && !cachedSlotData.silvered && !cachedSlotData.material) cachedSlotData._unresolved = true;

      const getTypeCostCp = () => {
        const typeName = cachedSlotData.variables?.weapon?.value
                      ?? cachedSlotData.variables?.armor?.value;
        if (typeName) {
          const lib = ITEM_LIBRARY.find(i => i.name === typeName);
          return lib?.cost ? shopCostToCp(lib.cost) : 0;
        }
        const spellName = cachedSlotData.variables?.spell?.value;
        if (spellName) return window.SPELL_STORING_COSTS?.[spellName] || 0;
        return 0;
      };

      const getTotalCostCp = () => {
        const isAmmo = shopCat === 'ammunition';
        const silverCp = isAmmo ? 1000 : 10000;
        const metalCp  = isAmmo ? 5000 : 50000;
        let base = baseCostCp + getTypeCostCp()
          + (cachedSlotData.silvered ? silverCp : 0)
          + (cachedSlotData.material ? metalCp  : 0);
        if (item.hasUses === 'coins') {
          const cv = cachedSlotData.variables || {};
          base *= Math.max(1, cv.uses?.value ?? cv.count?.value ?? 1);
        }
        return base * Math.max(1, cachedSlotData.variables?.qty?.value || 1);
      };

      const getDisplayName = () => {
        let name = item.name;
        const wv = cachedSlotData.variables?.weapon;
        const av = cachedSlotData.variables?.armor;
        const ev = cachedSlotData.variables?.element;
        if (wv?.control === 'select' && wv.value) name = name.replace('Weapon', wv.value);
        if (av?.control === 'select' && av.value) name = name.replace('Armor',  av.value);
        if (ev?.control === 'select' && ev.value) name = name.replace('Elemental', ev.value);
        const sv = cachedSlotData.variables?.spell;
        if (sv?.control === 'select' && sv.value) name = name.replace('Spell Storing', sv.value);
        const crv = cachedSlotData.variables?.creature;
        if (crv?.control === 'select' && crv.value) name = name.replace('Creature', crv.value);
        const silverPfx = cachedSlotData.silvered ? 'Silvered ' : '';
        const metal = (cachedSlotData.material === 'mithral' || cachedSlotData.material === 'adamantine')
          ? cachedSlotData.material : null;
        const qty = cachedSlotData.variables?.qty?.value || 1;
        const qtyPfx = qty > 1 ? `${qty} × ` : '';
        return qtyPfx + silverPfx + (metal ? metal.charAt(0).toUpperCase() + metal.slice(1) + ' ' : '') + name;
      };

      const row = document.createElement('div');
      row.dataset.section  = currentSection;
      row.dataset.rarity   = currentRarity || '';
      row.dataset.itemName = item.name;
      if (!visible) row.dataset.playerHidden = 'true';

      const applyRowState = () => {
        const totalCp = getTotalCostCp();
        row.dataset.costCp = totalCp;
        const coins  = getCharCoins(inv.getState());
        const wallet = coins.pp * 1000 + coins.gp * 100 + coins.sp * 10 + coins.cp;
        const cantAfford = !window._isDM && totalCp > 0 && totalCp > wallet;
        row.className = 'shop-item-row'
          + (!visible && window._isDM ? ' shop-item-hidden' : '')
          + (!avail ? ' shop-item-unavailable' : '')
          + (cantAfford ? ' shop-item-unaffordable' : '');
        costSpan.innerHTML = item.cost ? renderCostHtml(totalCp, costSuffix) : '';
        nameSpan.textContent = getDisplayName();
      };

      const costSpan = document.createElement('span');
      costSpan.className = 'shop-item-cost';

      const infoIcon = document.createElement('span');
      infoIcon.className = 'shop-item-info-icon';
      infoIcon.innerHTML = '<i class="fas fa-circle-info"></i>';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'shop-item-name';
      nameSpan.textContent = item.name;

      row.appendChild(infoIcon);
      row.appendChild(nameSpan);

      row.appendChild(costSpan);

      if (window._isDM) {
        const availBtn = document.createElement('button');
        availBtn.className = 'shop-item-avail-btn' + (!avail ? ' unavailable' : '');
        availBtn.innerHTML = avail ? '<i class="fas fa-check"></i>' : '<i class="fas fa-ban"></i>';
        availBtn.title = avail ? 'Mark as unavailable' : 'Mark as available';
        availBtn.addEventListener('pointerdown', e => e.stopPropagation());
        availBtn.addEventListener('click', e => {
          e.stopPropagation();
          shopAvailability[row.dataset.itemName] = !isItemAvailable(row.dataset.itemName);
          saveShopAvailability();
          buildShop();
        });
        row.appendChild(availBtn);

        const visBtn = document.createElement('button');
        visBtn.className = 'shop-item-vis-btn';
        visBtn.innerHTML  = visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        visBtn.title = visible ? 'Hide from players' : 'Show to players';
        visBtn.addEventListener('pointerdown', e => e.stopPropagation());
        visBtn.addEventListener('click', e => {
          e.stopPropagation();
          shopVisibility[row.dataset.itemName] = !isItemVisible(row.dataset.itemName, row.dataset.section);
          saveShopVisibility();
          buildShop();
        });
        row.appendChild(visBtn);
      }

      // Initial state
      applyRowState();
      row._applyRowState = applyRowState;

      const getSlotData = () => {
        cachedSlotData._shopCostCp = getTotalCostCp();
        return cachedSlotData;
      };

      row.addEventListener('click', e => {
        if (row._shopDragging
          || e.target.closest('.shop-item-vis-btn')
          || e.target.closest('.shop-item-avail-btn')) return;
        inv.toggleShopItem(getSlotData(), `shop-${item.name}`);
      });

      row.style.touchAction = 'none';
      let lpTimer = null, lpX, lpY, lpPointerId, lpScrolling = false, lpLastY = 0, lpTracking = false;
      const shopScrollEl = document.getElementById('shop-scroll');

      row.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        lpX = e.clientX; lpY = e.clientY; lpPointerId = e.pointerId;
        lpScrolling = false; lpTracking = true;
        const blocked = !window._isDM && (
          !isItemAvailable(item.name) ||
          row.classList.contains('shop-item-unaffordable')
        );
        const flashText = () => {
          [nameSpan, ...Array.from(costSpan.children)].forEach(el => {
            el.classList.remove('shop-item-flash');
            void el.offsetWidth;
            el.classList.add('shop-item-flash');
            setTimeout(() => el.classList.remove('shop-item-flash'), 900);
          });
        };
        if (blocked) {
          flashText();
          return;
        }
        lpTimer = setTimeout(() => {
          lpTimer = null;
          lpScrolling = false;
          if (cachedSlotData._unresolved) {
            flashText();
            inv.showShopItem(getSlotData(), `shop-${item.name}`);
            requestAnimationFrame(() => requestAnimationFrame(() => {
              document.querySelectorAll('#insp-props .insp-select').forEach(sel => {
                if (sel.value !== '') return;
                sel.classList.remove('flash-required');
                void sel.offsetWidth;
                sel.classList.add('flash-required');
                setTimeout(() => sel.classList.remove('flash-required'), 900);
              });
              if (item.name === 'Ammunition') {
                document.querySelectorAll('#insp-props [data-mat-chip]').forEach(btn => {
                  btn.classList.remove('chip-flash-required');
                  void btn.offsetWidth;
                  btn.classList.add('chip-flash-required');
                  setTimeout(() => btn.classList.remove('chip-flash-required'), 900);
                });
              }
            }));
            return;
          }
          row._shopDragging = true;
          row.classList.add('shop-item-dragging');
          document.documentElement.setPointerCapture(lpPointerId);
          inv.startShopDrag(getSlotData(), e.clientX, e.clientY);
          const cleanup = () => {
            row._shopDragging = false;
            row.classList.remove('shop-item-dragging');
            document.removeEventListener('pointerup',     cleanup);
            document.removeEventListener('pointercancel', cleanup);
          };
          document.addEventListener('pointerup',     cleanup);
          document.addEventListener('pointercancel', cleanup);
        }, 380);
      });
      row.addEventListener('pointermove', e => {
        if (lpScrolling) {
          shopScrollEl.scrollTop += lpLastY - e.clientY;
          lpLastY = e.clientY;
          return;
        }
        if (!lpTracking) return;
        if ((e.clientX - lpX) ** 2 + (e.clientY - lpY) ** 2 > 64) {
          if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
          lpScrolling = true;
          lpLastY = e.clientY;
        }
      });
      const cancelLP = () => {
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        lpScrolling = false; lpTracking = false;
        row._shopDragging = false;
        row.classList.remove('shop-item-dragging');
      };
      row.addEventListener('pointerup',     cancelLP);
      row.addEventListener('pointercancel', cancelLP);

      scroll.appendChild(row);
    });

    // Wire rarity toggle buttons after all rows exist
    if (window._isDM) {
      scroll.querySelectorAll('.shop-rarity-toggle').forEach(btn => {
        const sec  = btn.dataset.section;
        const rar  = btn.dataset.rarity;
        const rows = [...scroll.querySelectorAll(`.shop-item-row[data-section="${sec}"][data-rarity="${rar}"]`)];
        const allHidden = rows.length > 0 && rows.every(r => r.dataset.playerHidden === 'true');
        btn.innerHTML = allHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        btn.title = allHidden ? 'Show all to players' : 'Hide all from players';
        btn.addEventListener('click', () => {
          const itemRows = [...scroll.querySelectorAll(
            `.shop-item-row[data-section="${btn.dataset.section}"][data-rarity="${btn.dataset.rarity}"]`
          )];
          const nowAllHidden = itemRows.every(r => r.dataset.playerHidden === 'true');
          itemRows.forEach(r => { shopVisibility[r.dataset.itemName] = nowAllHidden; });
          saveShopVisibility();
          buildShop();
        });
      });
    }

    // Populate category dropdown (preserve selection)
    const categorySelect = document.getElementById('shop-category');
    const prevVal = categorySelect.value;
    categorySelect.innerHTML = '<option value="">All categories</option>';
    [...visibleSections].sort((a, b) => a.localeCompare(b)).forEach(section => {
      const opt = document.createElement('option');
      opt.value = section;
      opt.textContent = section;
      categorySelect.appendChild(opt);
    });
    if (prevVal) categorySelect.value = prevVal;

    filterShop();

    // Restore scroll position after DOM rebuild
    scroll.scrollTop = savedScrollTop;
  }

  function buildShopSlotData(libItem, selectedType, silvered, material, selectedElement, totalCostCp) {
    const vars = JSON.parse(JSON.stringify(libItem.variables || {}));
    if (selectedType) {
      if (vars.weapon?.control  === 'select') vars.weapon.value  = selectedType;
      if (vars.armor?.control   === 'select') vars.armor.value   = selectedType;
    }
    if (selectedElement && vars.element?.control === 'select') vars.element.value = selectedElement;
    if (!vars.qty) vars.qty = { value: 1, control: 'both', min: 1, max: 99 };
    const slotData = { name: libItem.name, variables: vars, _shopItem: true };
    if (libItem.hasUses)  slotData.hasUses   = libItem.hasUses;
    if (silvered)         slotData.silvered  = true;
    if (material)         slotData.material  = material;
    if (totalCostCp != null) slotData._shopCostCp = totalCostCp;
    return slotData;
  }

  function filterShop() {
    const query    = (document.getElementById('shop-search').value || '').trim().toLowerCase();
    const category = document.getElementById('shop-category').value;
    const scroll   = document.getElementById('shop-scroll');
    scroll.querySelectorAll('.shop-item-row').forEach(row => {
      const nameMatch = !query    || row.querySelector('.shop-item-name').textContent.toLowerCase().includes(query);
      const catMatch  = !category || row.dataset.section === category;
      const visMatch  = window._isDM || row.dataset.playerHidden !== 'true';
      row.hidden = !(nameMatch && catMatch && visMatch);
    });
    scroll.querySelectorAll('.shop-rarity-divider').forEach(divider => {
      let sib = divider.nextElementSibling, has = false;
      while (sib && !sib.classList.contains('shop-rarity-divider') && !sib.classList.contains('shop-section-heading')) {
        if (!sib.hidden && sib.classList.contains('shop-item-row')) { has = true; break; }
        sib = sib.nextElementSibling;
      }
      divider.hidden = !has;
    });
    scroll.querySelectorAll('.shop-section-heading').forEach(heading => {
      let sib = heading.nextElementSibling, has = false;
      while (sib && !sib.classList.contains('shop-section-heading')) {
        if (!sib.hidden && sib.classList.contains('shop-item-row')) { has = true; break; }
        sib = sib.nextElementSibling;
      }
      heading.hidden = !has;
    });
  }

  document.getElementById('shop-search').addEventListener('input', filterShop);
  document.getElementById('shop-category').addEventListener('change', filterShop);

  function updateShopWallet() {
    updateShopAffordability();
  }

  function updateShopAffordability() {
    if (!shopOpen || window._isDM) return;
    const coins   = getCharCoins(inv.getState());
    const walletCp = coins.pp * 1000 + coins.gp * 100 + coins.sp * 10 + coins.cp;
    document.querySelectorAll('.shop-item-row').forEach(row => {
      const costCp = parseInt(row.dataset.costCp || '0');
      row.classList.toggle('shop-item-unaffordable', costCp > 0 && costCp > walletCp);
    });
  }

  function openShop() {
    shopOpen = true;
    shopTabBtn.classList.add('active');
    invScrollEl.hidden = true;
    shopPanel.hidden   = false;
    document.getElementById('shop-search').value = '';
    document.getElementById('shop-category').value = '';
    updateShopWallet();
    buildShop();
    if (_hexmapMode) {
      _shopFromHexmap = true;
      _hexmapMode = false;
      _applyViewMode();
      window.hexOnGoToInventory && window.hexOnGoToInventory();
      ensureCharSelected();
    }
  }

  function closeShop() {
    shopOpen = false;
    shopTabBtn.classList.remove('active');
    shopPanel.hidden   = true;
    invScrollEl.hidden = false;
    if (_shopFromHexmap) {
      _shopFromHexmap = false;
      deselectChar();
      _hexmapMode = true;
      _applyViewMode();
      window.hexOnGoToHexmap && window.hexOnGoToHexmap();
    }
  }

  shopTabBtn.addEventListener('click', () => {
    if (shopOpen) closeShop(); else openShop();
  });

  // ── ROLE (DM / PLAYER) ──────────────────────────────────────────────────
  const roleBtn = document.getElementById('role-btn');
  let userCanBeDM = false;

  // ── ASSIGN CHARACTER TO PLAYER ───────────────────────────────────────────
  const charAssignBtn = document.getElementById('char-assign-btn');

  charAssignBtn.addEventListener('click', () => {
    if (!currentCharId || !allChars[currentCharId]) return;
    const char = allChars[currentCharId];

    const raw = prompt(
      `Assign "${char.state.charName || 'this character'}" to player (@bytespritegames.com):\nLeave blank to unassign.`,
      char.ownerName || ''
    );
    if (raw === null) return; // cancelled

    // Strip domain if the user typed the full email
    const username = raw.trim().toLowerCase().replace(/@bytespritegames\.com$/i, '');

    if (!username) {
      // Unassign
      allChars[currentCharId].ownerUid  = '';
      allChars[currentCharId].ownerName = '';
      database.ref(`/inventory_characters/${currentCharId}`).update({ ownerUid: '', ownerName: '' });
      renderTabs();
      return;
    }

    database.ref(`/inventory_user_lookup/${username}`).once('value', snap => {
      const uid = snap.val();
      if (!uid) { alert(`No player found with username "${username}@bytespritegames.com".`); return; }
      allChars[currentCharId].ownerUid  = uid;
      allChars[currentCharId].ownerName = username;
      database.ref(`/inventory_characters/${currentCharId}`).update({ ownerUid: uid, ownerName: username });
      renderTabs();
    });
  });

  const charHideBtn = document.getElementById('char-hide-btn');

  charHideBtn.addEventListener('click', () => {
    if (!currentCharId || !allChars[currentCharId]) return;
    const char = allChars[currentCharId];
    char.hiddenFromPlayers = !char.hiddenFromPlayers;
    database.ref(`/inventory_characters/${currentCharId}`).update({ hiddenFromPlayers: char.hiddenFromPlayers });
    updateCharHideBtn();
    renderTabs();
  });

  function updateCharHideBtn() {
    if (!window._isDM) return;
    const hidden = !!(currentCharId && allChars[currentCharId]?.hiddenFromPlayers);
    charHideBtn.innerHTML = hidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    charHideBtn.classList.toggle('char-hide-active', hidden);
    charHideBtn.title = hidden ? 'Unhide — currently hidden from players' : 'Hide from players';
  }

  function applyRole(role) {
    const isDM = (role === 'dm') && userCanBeDM;
    window._isDM         = isDM;
    roleBtn.hidden       = !userCanBeDM;
    charAssignBtn.hidden = !isDM;
    charHideBtn.hidden   = !isDM;
    _hexClearBtn.hidden  = !isDM;
    window.hexSetDmStatus && window.hexSetDmStatus(isDM);
    roleBtn.textContent  = 'DM';
    roleBtn.title        = isDM ? 'You are DM — click to switch to Player' : 'You are Player — click to switch to DM';
    roleBtn.dataset.role = isDM ? 'dm' : 'player';
    if (isDM) updateCharHideBtn();
    if (shopOpen) buildShop();
    // Re-render tabs now that DM status is known (subscribeToChars fires before this resolves)
    if (Object.keys(allChars).length) renderTabs();
  }

  roleBtn.addEventListener('click', () => {
    if (!currentUser || !userCanBeDM) return;
    const next = window._isDM ? 'player' : 'dm';
    database.ref(`/inventory_roles/${currentUser.uid}`).set(next);
    applyRole(next);
  });

  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      database.ref(`/inventory_dm_users/${user.uid}`).once('value', snap => {
        userCanBeDM = snap.val() === true;
        database.ref(`/inventory_roles/${user.uid}`).once('value', snap2 => {
          applyRole(userCanBeDM ? (snap2.val() || 'player') : 'player');
        });
      });
      // Register username → uid so DMs can assign characters by username
      const username = (user.displayName || user.email || '').split('@')[0];
      if (username) database.ref(`/inventory_user_lookup/${username}`).set(user.uid);
      subscribeToChars();
      subscribeToShopVisibility();
      subscribeToShopAvailability();
    } else {
      if (charsRef)    { charsRef.off('value');    charsRef    = null; }
      if (shopVisRef)  { shopVisRef.off('value');  shopVisRef  = null; }
      if (shopAvailRef){ shopAvailRef.off('value'); shopAvailRef = null; }
      userCanBeDM    = false;
      window._isDM   = false;
      currentCharId  = null;
      pendingNewChar = null;
      pendingDeletes.clear();
      allChars       = {};
    }
  });

  // ── FIREBASE ────────────────────────────────────────────────────────────
  let charsRef = null;

  function subscribeToChars() {
    if (charsRef) charsRef.off('value');
    charsRef = database.ref('/inventory_characters');
    charsRef.on('value', snap => {
      const raw = snap.val() || {};

      // Rebuild allChars, preserving the current char's live state so
      // an incoming write from someone else doesn't overwrite local edits.
      const liveState = currentCharId ? inv.getState() : null;

      allChars = {};
      Object.entries(raw).forEach(([id, data]) => {
        if (pendingDeletes.has(id)) return; // skip until server confirms removal
        allChars[id] = {
          id,
          ownerUid:          data.ownerUid  || '',
          ownerName:         data.ownerName || '',
          hiddenFromPlayers: !!data.hiddenFromPlayers,
          state:             parseState(data.state),
          createdAt:         data.createdAt || 0,
          sortOrder:         data.sortOrder ?? data.createdAt ?? 0,
        };
      });

      // Re-inject any locally-created char still awaiting Firebase confirmation
      if (pendingNewChar && !allChars[pendingNewChar.id]) {
        allChars[pendingNewChar.id] = pendingNewChar;
      }

      if (currentCharId && allChars[currentCharId]) {
        if (dirty || localWriteInFlight) {
          // Local edits in flight — keep them, don't let the Firebase echo overwrite them
          if (liveState) allChars[currentCharId].state = liveState;
        } else {
          // Nothing pending locally — apply whatever Firebase has (another user's edit)
          suppressSave = true;
          try { inv.loadState(allChars[currentCharId].state); } catch (e) { console.warn('loadState error:', e); }
          suppressSave = false;
          const _s = inv.getState();
          setFieldsOpen(!_s.charName || !_s.carryCapacity);
        }
      }

      renderTabs();

      // Clean up surplus unnamed characters for this user (keep the most recent)
      if (currentUser) {
        const mine = Object.values(allChars).filter(c => c.ownerUid === currentUser.uid);
        const unnamed = mine.filter(c => !c.state.charName)
                            .sort((a, b) => b.createdAt - a.createdAt);
        if (unnamed.length > 1) {
          unnamed.slice(1).forEach(c => {
            if (!pendingDeletes.has(c.id)) {
              pendingDeletes.add(c.id);
              database.ref(`/inventory_characters/${c.id}`).remove()
                .then(() => pendingDeletes.delete(c.id));
            }
          });
        }
      }

      if (!currentCharId || !allChars[currentCharId]) {
        // Pick this user's most recent char; DMs fall back to any char; else create
        const mine = Object.values(allChars)
          .filter(c => c.ownerUid === currentUser.uid)
          .sort((a, b) => b.createdAt - a.createdAt);
        if (mine.length) {
          switchToChar(mine[0].id, true);
        } else if (window._isDM) {
          const any = Object.values(allChars).sort((a, b) => b.createdAt - a.createdAt);
          if (any.length) switchToChar(any[0].id, true);
          else            createChar();
        }
        // Players with no assigned character wait — DM assigns one
      }
    });
  }

  // ── COMPACT / RESOLVE (Firebase boundary) ───────────────────────────────

  const SLOT_OVERRIDE_KEYS = [
    'silvered','material','notes','costCoins','containerId','isContainer',
    'containerRows','treasure','category','isWeapon','bulk','hasUses',
    'conflict','conflictMsg',
  ];

  const resolveSlotData = raw => {
    if (!raw || raw.custom || raw._ref == null) return raw;
    const lib = (window.ITEM_LIBRARY || []).find(i => i.id === raw._ref);
    if (!lib) return raw;
    const resolved = JSON.parse(JSON.stringify(lib));

    // Apply scalar overrides (except material — validated below)
    for (const k of SLOT_OVERRIDE_KEYS) {
      if (k === 'silvered' || k === 'material') continue;
      if (raw[k] !== undefined) resolved[k] = raw[k];
    }

    // Determine effective category after any category override
    const effCat = resolved.category
      || (resolved.variables?.weapon ? 'weapon' : resolved.variables?.armor ? 'armor' : null);
    const canSilver = ['weapon','ammunition'].includes(effCat);
    const canMetal  = ['weapon','armor','shield','ammunition'].includes(effCat);

    // Only keep material overrides if the item still supports them
    if (raw.silvered && canSilver) resolved.silvered = raw.silvered;
    if (raw.material && canMetal)  resolved.material = raw.material;

    // Apply variable overrides — only for keys still in schema, clamped to new limits
    if (raw._vars) {
      resolved.variables = resolved.variables || {};
      for (const [k, v] of Object.entries(raw._vars)) {
        if (k === 'qty') {
          resolved.variables.qty = { value: Math.max(1, Math.min(99, v)), control: 'both', min: 1, max: 99 };
          continue;
        }
        const schema = resolved.variables[k];
        if (!schema) continue; // key no longer in schema — discard
        let val = v;
        if (typeof schema.min === 'number') val = Math.max(schema.min, val);
        if (typeof schema.max === 'number') val = Math.min(schema.max, val);
        schema.value = val;
      }
    }

    return resolved;
  };

  const compactSlotData = slotData => {
    if (!slotData || slotData.custom) return slotData;
    const lib = (window.ITEM_LIBRARY || []).find(i =>
      slotData._ref != null ? i.id === slotData._ref : i.name === slotData.name
    );
    if (!lib) return slotData;
    const compact = { _ref: lib.id };
    for (const k of SLOT_OVERRIDE_KEYS)
      if (slotData[k] !== undefined) compact[k] = slotData[k];
    if (slotData.variables) {
      const vars = {};
      for (const [k, v] of Object.entries(slotData.variables)) {
        const libVal = lib.variables?.[k]?.value;
        if (libVal === undefined || v.value !== libVal) vars[k] = v.value;
      }
      if (Object.keys(vars).length) compact._vars = vars;
    }
    return compact;
  };

  const resolveContainerSlots = containers => {
    for (const container of containers || [])
      for (const row of container.slots || [])
        for (let c = 0; c < row.length; c++)
          if (row[c]) row[c] = resolveSlotData(row[c]);
  };

  const compactContainerSlots = containers => {
    for (const container of containers || [])
      for (const row of container.slots || [])
        for (let c = 0; c < row.length; c++)
          if (row[c]) row[c] = compactSlotData(row[c]);
  };

  function parseState(str) {
    try {
      const s = JSON.parse(str || 'null');
      if (!s) return blankState();
      if (!s.containers || !s.containers.length) s.containers = defaultContainers();
      inv.flattenGroups(s.containers);
      resolveContainerSlots(s.containers);
      return s;
    } catch { return blankState(); }
  }

  function blankState() {
    return { charName: '', carryCapacity: '', containers: defaultContainers() };
  }

  function defaultContainers() {
    return [
      { id:'equipped', name:'Equipped',      rows:1, collapsed:false, permanent:true, slots:[[null,null]] },
      { id:'strapped', name:'Strapped Gear', rows:2, collapsed:false, permanent:true, slots:[[null,null],[null,null]] },
    ];
  }

  // ── CHARACTER SWITCHING ──────────────────────────────────────────────────
  function ensureCharSelected() {
    if (currentCharId && allChars[currentCharId]) return;
    const chars = Object.values(allChars)
      .filter(c => window._isDM || !c.hiddenFromPlayers)
      .sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt));
    const target = chars.find(c => c.ownerUid === currentUser?.uid) || chars[0];
    if (target) switchToChar(target.id, true);
  }

  function deselectChar() {
    if (currentCharId) saveChar(currentCharId, true);
    dirty = false;
    currentCharId = null;
    suppressSave = true;
    try { inv.loadState(blankState()); } catch(e) {}
    suppressSave = false;
    setFieldsOpen(false);
    updateCharHideBtn();
    renderTabs();
  }

  function switchToChar(charId, skipSave) {
    inv.cancelDrag();
    if (!skipSave && currentCharId) saveChar(currentCharId, true);
    dirty = false;
    currentCharId = charId;
    suppressSave = true;
    try { inv.loadState(allChars[charId].state); } catch (e) { console.warn('loadState error:', e); }
    suppressSave = false;
    setFieldsOpen(false);
    updateCharHideBtn();
    renderTabs();
    if (shopOpen) { updateShopWallet(); buildShop(); }
  }

  function createChar() {
    if (!currentUser) return;
    inv.cancelDrag();
    if (currentCharId) saveChar(currentCharId, true);

    const ref       = database.ref('/inventory_characters').push();
    const blank     = blankState();
    const newId     = ref.key;
    const createdAt = Date.now();

    // Add immediately to local state so tabs and inventory update without waiting for Firebase
    const charData = {
      id: newId,
      ownerUid:  '',
      ownerName: '',
      state:     blank,
      createdAt,
      sortOrder: createdAt,
    };
    allChars[newId]  = charData;
    pendingNewChar   = charData;
    currentCharId    = newId;

    ref.set({
      ownerUid:  '',
      ownerName: '',
      state:     JSON.stringify(blank),
      createdAt,
      sortOrder: createdAt,
    }).then(() => {
      // Only clear if this specific creation is still the pending one
      if (pendingNewChar === charData) pendingNewChar = null;
    });
    suppressSave = true;
    try { inv.loadState(blank); } catch (e) { console.warn('loadState error:', e); }
    suppressSave = false;
    renderTabs();
  }

  function deleteChar(charId) {
    if (!window._isDM && allChars[charId]?.ownerUid !== currentUser?.uid) return;

    // Remove locally immediately so Firebase echoes don't re-select this char
    delete allChars[charId];
    pendingDeletes.add(charId);
    database.ref(`/inventory_characters/${charId}`).remove()
      .then(() => pendingDeletes.delete(charId));

    if (currentCharId === charId) {
      currentCharId = null;
      const mine = Object.values(allChars)
        .filter(c => c.ownerUid === currentUser.uid)
        .sort((a, b) => b.createdAt - a.createdAt);
      const any  = Object.values(allChars).sort((a, b) => b.createdAt - a.createdAt);
      if (mine.length) switchToChar(mine[0].id, true);
      else if (any.length) switchToChar(any[0].id, true);
      else createChar();
    } else {
      renderTabs();
    }
  }

  function saveChar(charId, immediate) {
    if (!currentUser || !charId) return;
    dirty = false;
    localWriteInFlight = true;
    const state = inv.getState();
    if (allChars[charId]) allChars[charId].state = state;
    const saveState = JSON.parse(JSON.stringify(state));
    compactContainerSlots(saveState.containers);
    database.ref(`/inventory_characters/${charId}`).update({
      state: JSON.stringify(saveState),
    }).then(() => {
      setTimeout(() => { localWriteInFlight = false; }, 200);
    });
  }

  // ── INVENTORY CALLBACKS ──────────────────────────────────────────────────
  function getCharCoins(charState) {
    let pp = 0, gp = 0, sp = 0, cp = 0;
    if (!charState || !charState.containers) return { pp, gp, sp, cp };
    for (const container of charState.containers) {
      if (!container.slots) continue;
      for (const row of container.slots) {
        for (const slot of row) {
          if (!slot || !slot.variables) continue;
          const v = slot.variables;
          if (v.pp) pp += v.pp.value || 0;
          if (v.gp) gp += v.gp.value || 0;
          if (v.sp) sp += v.sp.value || 0;
          if (v.cp) cp += v.cp.value || 0;
        }
      }
    }
    return { pp, gp, sp, cp };
  }

  function setTabCoins(coinsEl, charState) {
    const { pp, gp, sp, cp } = getCharCoins(charState);
    coinsEl.innerHTML = '';
    if (pp > 0) coinsEl.innerHTML += `<span class="coin-pp">${pp}pp</span>`;
    if (gp > 0) coinsEl.innerHTML += `<span class="coin-gp">${gp}gp</span>`;
    if (sp > 0) coinsEl.innerHTML += `<span class="coin-sp">${sp}sp</span>`;
    if (cp > 0) coinsEl.innerHTML += `<span class="coin-cp">${cp}cp</span>`;
  }

  function confirmSpendingOtherWallet() {
    const currentChar = allChars[currentCharId];
    if (!currentChar || !currentUser || currentChar.ownerUid === currentUser.uid) return true;
    const charName  = currentChar.state?.charName || 'this character';
    const ownerName = currentChar.ownerName || 'another player';
    return confirm(`This will spend coins from ${charName} (owned by ${ownerName}). Continue?`);
  }

  function handleShopPurchase(slotData, skipWalletConfirm = false) {
    if (slotData._unresolved) return;
    if (!skipWalletConfirm && !confirmSpendingOtherWallet()) {
      inv.removeItem(slotData);
      return;
    }
    if (slotData._shopCostCp != null) {
      inv.deductCostCp(slotData._shopCostCp);
    } else {
      const lib = window.ITEM_LIBRARY.find(i => i.name === slotData.name);
      if (lib && lib.cost) inv.deductCost(lib.cost);
    }
    playSound('coin');
    if (shopOpen) updateShopWallet();
  }

  function handleInventoryChange() {
    if (suppressSave || !currentCharId) return;
    dirty = true;
    const tab = document.querySelector(`[data-char-id="${currentCharId}"]`);
    if (tab) {
      const nameEl = tab.querySelector('.char-tab-name');
      if (nameEl) nameEl.textContent = inv.getState().charName || 'Unnamed';
    }
    if (shopOpen) updateShopWallet();
    saveChar(currentCharId);
  }

  function handleCrossCharDrop(item, targetCharId, linkedContainer) {
    if (!targetCharId || !allChars[targetCharId]) return;

    // Strip the shop marker before storing
    const cleanItem = Object.assign({}, item);
    delete cleanItem._shopItem;

    // Drop onto the currently-open character's own tab
    if (targetCharId === currentCharId) {
      inv.addItem(cleanItem);
      if (item._shopItem && !item._unresolved) {
        handleShopPurchase(cleanItem);
      } else {
        playSound('place');
      }
      const tabEl = document.querySelector(`[data-char-id="${currentCharId}"]`);
      if (tabEl) {
        tabEl.classList.add('tab-received');
        setTimeout(() => tabEl.classList.remove('tab-received'), 1200);
      }
      return;
    }

    // For shop items dropping onto another character's tab, confirm wallet spend first
    if (item._shopItem && !item._unresolved && !confirmSpendingOtherWallet()) return;

    const targetState = JSON.parse(JSON.stringify(allChars[targetCharId].state));
    const equipped    = targetState.containers.find(c => c.id === 'equipped');
    if (!equipped) return;

    let finalR = 0, finalC = 0, placed = false;
    for (let r = 0; r < equipped.slots.length; r++) {
      if (!equipped.slots[r][0]) {
        equipped.slots[r][0] = cleanItem; finalR = r; finalC = 0; placed = true; break;
      }
      if (!equipped.slots[r][1]) {
        equipped.slots[r][1] = cleanItem; finalR = r; finalC = 1; placed = true; break;
      }
    }
    if (!placed) {
      equipped.slots.push([cleanItem, null]);
      equipped.rows++;
      finalR = equipped.slots.length - 1; finalC = 0;
    }

    // Transfer the linked container and its contents to the target character
    if (linkedContainer) {
      const newId = `linked-${Date.now()}`;
      linkedContainer.id      = newId;
      linkedContainer.linkedTo = { containerId: 'equipped', r: finalR, c: finalC };
      cleanItem.containerId = newId;
      targetState.containers.push(linkedContainer);
    }

    allChars[targetCharId].state = targetState;
    database.ref(`/inventory_characters/${targetCharId}`).update({
      state: JSON.stringify(targetState),
    });

    if (item._shopItem && !item._unresolved) {
      handleShopPurchase(cleanItem, true);
    } else {
      playSound('place');
    }

    const tabEl = document.querySelector(`[data-char-id="${targetCharId}"]`);
    if (tabEl) {
      tabEl.classList.add('tab-received');
      setTimeout(() => tabEl.classList.remove('tab-received'), 1200);
    }
  }

  // ── TABS ────────────────────────────────────────────────────────────────
  function renderTabs() {
    const tabsEl = document.getElementById('char-tabs');
    tabsEl.innerHTML = '';

    Object.values(allChars)
      .sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
      .filter(char => window._isDM || !char.hiddenFromPlayers)
      .forEach(char => {
        const isOwn = char.ownerUid === currentUser?.uid;
        const tab = document.createElement('button');
        tab.className  = 'char-tab'
          + (char.id === currentCharId ? ' active' : '')
          + (isOwn ? ' tab-mine' : ' tab-other')
          + (window._isDM && char.hiddenFromPlayers ? ' tab-hidden' : '');
        tab.dataset.charId = char.id;
        tab.title = char.ownerName || '';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'char-tab-info';

        const nameSpan = document.createElement('span');
        nameSpan.className   = 'char-tab-name';
        nameSpan.textContent = char.state.charName || 'Unnamed';
        infoDiv.appendChild(nameSpan);



        tab.appendChild(infoDiv);

        // DM-only controls
        if (window._isDM) {
          // Hidden indicator
          if (char.hiddenFromPlayers) {
            const hiddenIcon = document.createElement('span');
            hiddenIcon.className = 'char-tab-hidden-icon';
            hiddenIcon.innerHTML = '<i class="fas fa-eye-slash"></i>';
            tab.appendChild(hiddenIcon);
          }

          // Delete button
          const del = document.createElement('button');
          del.className   = 'char-tab-del';
          del.textContent = '×';
          del.title       = 'Delete character';
          del.addEventListener('pointerdown', e => e.stopPropagation());
          del.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm(`Delete "${char.state.charName || 'this character'}"?`)) {
              deleteChar(char.id);
            }
          });
          tab.appendChild(del);
        }

        tab.addEventListener('click', () => {
          if (char.id === currentCharId) {
            if (shopOpen) {
              closeShop();
            } else if (!_hexmapMode) {
              deselectChar();
              _hexmapMode = true;
              _applyViewMode();
              window.hexOnGoToHexmap && window.hexOnGoToHexmap();
            }
          } else {
            if (_hexmapMode) {
              _hexmapMode = false;
              _applyViewMode();
              window.hexOnGoToInventory && window.hexOnGoToInventory();
            }
            switchToChar(char.id, false);
          }
        });

        tabsEl.appendChild(tab);
      });

    const addBtn = document.getElementById('add-char-btn');
    addBtn.hidden  = !window._isDM;
    addBtn.onclick = createChar;
  }

  // Highlight tab on hover during inventory-item drag
  document.addEventListener('pointermove', e => {
    if (!document.body.classList.contains('is-dragging')) return;
    const el  = document.elementFromPoint(e.clientX, e.clientY);
    const tab = el && el.closest('[data-char-id]');
    document.querySelectorAll('[data-char-id]').forEach(t => t.classList.remove('tab-drag-over'));
    if (tab) tab.classList.add('tab-drag-over');
  });

  // ── TAB REORDER ────────────────────────────────────────────────────────────
  (function setupTabDrag() {
    const tabsEl = document.getElementById('char-tabs');
    const indicator = document.createElement('div');
    indicator.className = 'tab-drop-indicator';

    let drag = null; // { el, charId, startX, insertBefore }

    tabsEl.addEventListener('pointerdown', e => {
      if (!window._isDM) return;
      const tab = e.target.closest('.char-tab');
      if (!tab || e.target.closest('.char-tab-del')) return;
      if (e.button !== 0) return;
      drag = { el: tab, charId: tab.dataset.charId, startX: e.clientX, active: false, insertBefore: null };
    });

    document.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.active && Math.abs(e.clientX - drag.startX) > 6) {
        drag.active = true;
        drag.el.classList.add('tab-reordering');
      }
      if (!drag.active) return;

      const tabs = [...tabsEl.querySelectorAll('.char-tab:not(.tab-reordering)')];
      let insertBefore = null;
      for (const t of tabs) {
        const r = t.getBoundingClientRect();
        if (e.clientX < r.left + r.width / 2) { insertBefore = t; break; }
      }
      drag.insertBefore = insertBefore;
      if (insertBefore) tabsEl.insertBefore(indicator, insertBefore);
      else tabsEl.appendChild(indicator);
    });

    document.addEventListener('pointerup', () => {
      if (!drag) return;
      if (drag.active) {
        drag.el.classList.remove('tab-reordering');
        indicator.remove();

        const allTabs = [...tabsEl.querySelectorAll('.char-tab')];
        const others  = allTabs.filter(t => t !== drag.el);
        let insertIdx = drag.insertBefore ? others.indexOf(drag.insertBefore) : -1;
        if (insertIdx === -1) insertIdx = others.length;
        others.splice(insertIdx, 0, drag.el);

        others.forEach((t, i) => {
          const id = t.dataset.charId;
          const order = i * 1000;
          if (allChars[id]) allChars[id].sortOrder = order;
          database.ref(`/inventory_characters/${id}/sortOrder`).set(order);
        });

        renderTabs();
      }
      drag = null;
    });

    document.addEventListener('pointercancel', () => {
      if (!drag) return;
      if (drag.active) { drag.el.classList.remove('tab-reordering'); indicator.remove(); }
      drag = null;
    });
  })();

  window.invGoToHexmap = function() {
    _hexmapMode = true;
    _applyViewMode();
  };
};
