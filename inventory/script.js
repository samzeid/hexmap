window.InventorySystem = ({ database, auth, onChange, onCrossCharDrop, isHiddenFromPlayer }) => {

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

  function updateCurrencyDisplay() {
    const el = document.getElementById('coin-counter');
    if (!el) return;
    let pp = 0, gp = 0, sp = 0, cp = 0;
    for (const container of state.containers) {
      for (const row of container.slots) {
        for (const slot of row) {
          if (!slot || !slot.variables) continue;
          const v = slot.variables;
          if (v.coins) {
            const amt = v.coins.value || 0;
            if      (slot.name === 'Platinum Pieces (PP)') pp += amt;
            else if (slot.name === 'Gold Pieces (GP)')     gp += amt;
            else if (slot.name === 'Silver Pieces (SP)')   sp += amt;
            else if (slot.name === 'Copper Pieces (CP)')   cp += amt;
          }
          if (v.pp) pp += v.pp.value || 0;
          if (v.gp) gp += v.gp.value || 0;
          if (v.sp) sp += v.sp.value || 0;
          if (v.cp) cp += v.cp.value || 0;
        }
      }
    }
    const parts = [];
    if (pp > 0) parts.push(`<span class="coin-pp">${pp}pp</span>`);
    if (gp > 0) parts.push(`<span class="coin-gp">${gp}gp</span>`);
    if (sp > 0) parts.push(`<span class="coin-sp">${sp}sp</span>`);
    if (cp > 0) parts.push(`<span class="coin-cp">${cp}cp</span>`);
    el.innerHTML = parts.join('');
    el.hidden = parts.length === 0;
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

  function isSlotPackable(slotData) {
    if (!slotData) return false;
    if (slotData._isPouch) return true;
    const id = slotData.bulk ? slotData.bulk.id
              : (getLibraryItem(slotData.name) || { bulk: Bulk.STOCK }).bulk.id;
    return id === 'packable';
  }

  function packName(slotData) {
    return (slotData && slotData.name) || '';
  }

  // ── DOM REFS ────────────────────────────────────────────────────────────
  const containersEl = document.getElementById('containers');
  const dropdownEl   = document.getElementById('autocomplete-dropdown');
  const inspectorEl  = document.getElementById('inspector');

  // Active autocomplete context
  let acContainer = null, acRow = -1, acCol = -1, acInput = null;
  let ignoreNextBlur = false;

  // Tracks which item is currently shown in the inspector (key = containerId-r-c or shop-name)
  let inspectorItemKey = null;

  // Drag state
  let dragState        = null;
  let ghostEl          = null;
  let longPressTimer   = null;
  let dragScrollVel    = 0;
  let dragScrollRaf    = null;
  // Manual scroll state — used while disambiguating drag vs. scroll on touch
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
    // Remove trailing empty rows while more than one empty row exists at the end
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

  function checkPouchDissolve() {
    for (let i = state.containers.length - 1; i >= 0; i--) {
      const c = state.containers[i];
      if (c.name !== 'Pouch' || !c.linkedTo) continue;
      const items = c.slots.flatMap(row => row).filter(Boolean);
      if (items.length > 1) continue;
      const { containerId, r } = c.linkedTo;
      const parent = state.containers.find(p => p.id === containerId);
      if (!parent) continue;
      parent.slots[r][0] = items.length === 1 ? items[0] : null;
      state.containers.splice(i, 1);
    }
  }

  function render() {
    checkPouchDissolve();
    growEquipped();
    shrinkEquipped();
    containersEl.innerHTML = '';
    state.containers.forEach(c => containersEl.appendChild(buildCard(c)));
    updateCarryDisplay();
    updateCurrencyDisplay();

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

    const hdr = document.createElement('div');
    hdr.className = 'inv-hdr';

    const toggle = document.createElement('button');
    toggle.className = 'inv-hdr-toggle';
    toggle.innerHTML = `<span>${container.name}</span><span class="inv-chevron">${container.collapsed ? '▶' : '▼'}</span>`;
    toggle.addEventListener('click', () => { container.collapsed = !container.collapsed; render(); });

    hdr.appendChild(toggle);
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
    const linkedContainer = slotData && slotData.containerId
      ? state.containers.find(cnt => cnt.id === slotData.containerId)
      : null;
    const containerIsOpen = !!(linkedContainer && !linkedContainer.collapsed);
    const pouchWarning = !!(slotData && container.name === 'Pouch' && !isSlotPackable(slotData));

    const isPackable = !!(slotData && !slotData._isPouch && isSlotPackable(slotData));

    const wrap = document.createElement('div');
    wrap.className = 'slot'
      + (full            ? ' slot-full'          : '')
      + (containerIsOpen ? ' slot-container-open': '')
      + (isPackable      ? ' slot-packable'       : '');
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
      input.classList.remove('slot-editing');
      if (ignoreNextBlur) { ignoreNextBlur = false; return; }
      input.value = prev;
      closeDropdown();
    });

    wrap.appendChild(input);

    if (slotData) {
      const itemKey = `${container.id}-${r}-${c}`;
      const isInspected = inspectorItemKey === itemKey && !inspectorEl.classList.contains('inspector-collapsed');

      const label = document.createElement('span');
      const isContainerItem2 = isNoCarry(slotData) && !isSlotPackable(slotData);
      const showWarning = conflict || pouchWarning;
      label.className = 'slot-label'
        + (showWarning      ? ' slot-label-conflict'  : '')
        + (isContainerItem2 ? ' slot-label-container' : '');

      const vars = Object.values(slotData.variables || {});
      const numVar = vars.find(v => (v.control === 'plusminus' || v.control === 'both') && typeof v.value === 'number') || null;
      const _silverPfx = (slotData.silvered || slotData.material === 'silvered') ? 'Silvered ' : '';
      const _metalMat  = (slotData.material === 'mithral' || slotData.material === 'adamantine') ? slotData.material : null;
      const matPfx = _silverPfx + (_metalMat ? _metalMat.charAt(0).toUpperCase() + _metalMat.slice(1) + ' ' : '');
      const dispName = computeDisplayName(slotData);

      if (slotData.name === 'Pouch' && linkedContainer) {
        label.classList.add('slot-label-pouch');
        linkedContainer.slots.forEach(row => {
          row.forEach(item => {
            const cell = document.createElement('span');
            cell.className = 'pouch-cell' + (item ? '' : ' empty');
            if (item) {
              const iVars = Object.values(item.variables || {});
              const iNumVar = iVars.find(v => (v.control === 'plusminus' || v.control === 'both') && typeof v.value === 'number') || null;
              const _iSilverPfx = (item.silvered || item.material === 'silvered') ? 'Silvered ' : '';
              const _iMetalMat  = (item.material === 'mithral' || item.material === 'adamantine') ? item.material : null;
              const iMatPfx = _iSilverPfx + (_iMetalMat ? _iMetalMat.charAt(0).toUpperCase() + _iMetalMat.slice(1) + ' ' : '');
              const iName = computeDisplayName(item);
              cell.textContent = iNumVar ? `${iNumVar.value} × ${iMatPfx}${iName}` : `${iMatPfx}${iName}`;
            } else {
              cell.textContent = '—';
            }
            label.appendChild(cell);
          });
        });
      } else {
        const libForLabel = getLibraryItem(slotData.name);
        const gridSymbol  = libForLabel && libForLabel.gridSymbol;
        if (gridSymbol) {
          label.innerHTML = `${gridSymbol}&nbsp;${libForLabel.name}`;
          label.classList.add('slot-label-symbol');
        } else {
          label.textContent = numVar
            ? `${numVar.value} × ${matPfx}${dispName}`
            : `${matPfx}${dispName}`;
        }
      }

      if (linkedContainer) {
        // Info icon (left:4px) — clicking the label opens the inspector
        const infoIcon = document.createElement('span');
        infoIcon.className = 'slot-info-inline' + (isInspected ? ' active' : '');
        infoIcon.innerHTML = '<i class="fas fa-circle-info"></i>';
        label.appendChild(infoIcon);

        // Eye icon (left:18px, right of info) — visual open/closed indicator only
        const eyeIcon = document.createElement('span');
        eyeIcon.className = 'slot-eye-inline';
        eyeIcon.style.left = '18px';
        eyeIcon.innerHTML = containerIsOpen
          ? '<i class="fas fa-eye"></i>'
          : '<i class="fas fa-eye-slash"></i>';
        label.appendChild(eyeIcon);

        // Label (name + icons) opens inspector; stop propagation so wrap toggle doesn't fire
        label.style.paddingLeft = '34px';
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
        // Info icon inline; clicking label (name + icon) opens inspector
        const infoIcon = document.createElement('span');
        infoIcon.className = 'slot-info-inline' + (isInspected ? ' active' : '');
        infoIcon.innerHTML = '<i class="fas fa-circle-info"></i>';
        label.appendChild(infoIcon);

        label.style.cursor = 'pointer';
        label.style.pointerEvents = 'auto';
        label.addEventListener('click', e => {
          e.stopPropagation();
          toggleInspectorFor(itemKey, slotData, container, r, c);
        });
      }

      wrap.appendChild(label);
    }

    if (conflict || pouchWarning) {
      const warn = document.createElement('span');
      warn.className = 'slot-warn';
      warn.textContent = '⚠';
      warn.title = pouchWarning
        ? 'Not packable — only packable items belong in a Pouch'
        : (slotData.conflictMsg || 'Item is too bulky — clear an adjacent slot to resolve');
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
          // Scroll the list manually since touch-action:none suppresses browser scroll
          document.getElementById('inv-scroll').scrollTop += manualScrollLastY - e.clientY;
          manualScrollLastY = e.clientY;
          return;
        }
        if (!longPressTimer) return;
        if ((e.clientX - downX) ** 2 + (e.clientY - downY) ** 2 > 64) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          // Switch to manual scroll mode
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
          slotData.conflictMsg = 'This item is too bulky — clear an adjacent slot to resolve.';
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

    let matches = ITEM_LIBRARY.filter(i => i.name && i.name.toLowerCase().includes(query) && !i.shopHidden);
    if (!window._isDM) matches = matches.filter(i => !i.dmOnly);
    if (!window._isDM && isHiddenFromPlayer) matches = matches.filter(i => !isHiddenFromPlayer(i.name));
    matches = matches.slice(0, 10);
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

    // ── Rename button (custom items only, left of name) ──
    const prevRenameBtn = document.getElementById('insp-rename-btn');
    if (prevRenameBtn) prevRenameBtn.remove();
    if (slotData.custom && container) {
      const renameBtn = document.createElement('button');
      renameBtn.id = 'insp-rename-btn';
      renameBtn.className = 'insp-rename-btn';
      renameBtn.innerHTML = '<i class="fas fa-pencil"></i>';
      renameBtn.title = 'Rename';
      renameBtn.addEventListener('click', () => {
        const slotWrap = document.querySelector(
          `[data-container-id="${container.id}"][data-r="${r}"][data-c="${c}"]`
        );
        const slotInput = slotWrap && slotWrap.querySelector('.slot-input');
        if (slotInput) { slotInput.classList.add('slot-editing'); slotInput.focus(); slotInput.select(); }
      });
      const nameEl = document.getElementById('insp-name');
      nameEl.parentNode.insertBefore(renameBtn, nameEl);
    }

    // ── Inline numeric vars (count / charges) next to the name ──
    const inlineEl = document.getElementById('insp-inline-vars');
    inlineEl.innerHTML = '';
    const COIN_KEYS = new Set(['pp', 'gp', 'sp', 'cp']);
    const isCoinItem = Object.keys(slotData.variables || {}).every(k => COIN_KEYS.has(k));
    if (isCoinItem) inlineEl.classList.add('coin-vars-layout');
    else            inlineEl.classList.remove('coin-vars-layout');
    for (const [key, meta] of Object.entries(slotData.variables || {})) {
      if (meta.control !== 'plusminus' && meta.control !== 'both') continue;
      const wrap = document.createElement('div');
      wrap.className = 'insp-inline-var' + (isCoinItem ? ' coin-inline-var' : '');
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
    inlineEl.querySelectorAll('.insp-btn-sm').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = slotData.variables[btn.dataset.k];
        let v = m.value + parseInt(btn.dataset.d);
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        inlineEl.querySelector(`.insp-num-sm[data-k="${btn.dataset.k}"]`).value = v;
        render();
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
      descP.hidden = true; descEdit.hidden = false; notesEl.hidden = true;
      descEdit.value = slotData.description || '';
      descEdit.oninput = () => { slotData.description = descEdit.value; };
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
    costEl.hidden = !(lib && lib.cost) || itemHidden;
    if (lib && lib.cost && !itemHidden) costEl.textContent = lib.cost;

    // ── Remove ──
    const removeBtnEl = document.getElementById('insp-remove');
    removeBtnEl.hidden = !container;
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

    // Category dropdown — custom items only (first in row)
    if (slotData.custom) {
      const curCat = slotData.category
        || (slotData.isContainer ? 'container' : slotData.isWeapon ? 'weapon' : '');
      const catSel = document.createElement('select');
      catSel.className = 'insp-select';
      [
        ['','None'], ['weapon','Weapon'], ['armor','Armor'], ['ammunition','Ammunition'],
        ['shield','Shield'], ['wondrous','Wondrous Item'], ['container','Container'],
      ].forEach(([val, label]) => {
        const o = document.createElement('option');
        o.value = val; o.textContent = label;
        if (val === curCat) o.selected = true;
        catSel.appendChild(o);
      });
      catSel.addEventListener('change', () => {
        const prevCat = slotData.category || (slotData.isContainer ? 'container' : slotData.isWeapon ? 'weapon' : '');
        const newCat  = catSel.value;

        // Leaving container — remove linked container with confirmation
        if (prevCat === 'container' && slotData.isContainer) {
          if (slotData.containerId) {
            const linked = state.containers.find(cnt => cnt.id === slotData.containerId);
            if (linked && containerHasItems(linked)) {
              if (!confirm(`This will remove the ${slotData.name} container and its contents. Continue?`)) {
                catSel.value = 'container'; return;
              }
            }
            if (linked) state.containers = state.containers.filter(cnt => cnt !== linked);
            slotData.containerId = null;
          }
          slotData.isContainer = false;
        }

        slotData.category = newCat;
        slotData.isWeapon  = (newCat === 'weapon');
        slotData.variables = slotData.variables || {};

        if (newCat === 'weapon') {
          if (!slotData.variables.weapon) slotData.variables.weapon = { control: 'select', value: WEAPON_OPTIONS[0], options: WEAPON_OPTIONS };
          delete slotData.variables.armor;
        } else if (newCat === 'armor' || newCat === 'shield') {
          if (!slotData.variables.armor) slotData.variables.armor = { control: 'select', value: ARMOR_OPTIONS[0], options: ARMOR_OPTIONS };
          delete slotData.variables.weapon;
        } else if (newCat === 'container') {
          slotData.isContainer   = true;
          slotData.containerRows = slotData.containerRows || 2;
          if (!slotData.containerId) createLinkedContainer(slotData, container.id, r, c);
          delete slotData.variables.weapon;
          delete slotData.variables.armor;
        } else {
          delete slotData.variables.weapon;
          delete slotData.variables.armor;
        }

        const silverOk = ['weapon','ammunition'].includes(newCat);
        const metalOk  = ['weapon','armor','shield','ammunition'].includes(newCat);
        if (!silverOk) { slotData.silvered = false; if (slotData.material === 'silvered') slotData.material = null; }
        if (!metalOk  && (slotData.material === 'mithral' || slotData.material === 'adamantine')) slotData.material = null;

        render(); showInspector(slotData, container, r, c);
      });
      propsEl.appendChild(catSel);
    }

    // Bulk dropdown — custom items only
    if (slotData.custom) {
      const curBulk = slotData.bulk ? slotData.bulk.id : 'stock';
      const bulkSel = document.createElement('select');
      bulkSel.className = 'insp-select';
      [['stock','Stock'], ['packable','Pack'], ['bulky','Bulky']].forEach(([bid, label]) => {
        const o = document.createElement('option');
        o.value = bid; o.textContent = label;
        if (bid === curBulk) o.selected = true;
        bulkSel.appendChild(o);
      });
      bulkSel.addEventListener('change', () => {
        const newBulk = Bulk[bulkSel.value.toUpperCase()] || Bulk.STOCK;
        container.slots[r][c] = null;
        slotData.bulk = newBulk;
        placeSlotData(slotData, container, r, c);
        showInspector(slotData, container, r, c);
      });
      propsEl.appendChild(bulkSel);
    }

    // Material chips — before selects
    const effectiveCat = getEffectiveCategory(slotData);
    const canSilver = ['weapon','ammunition'].includes(effectiveCat);
    const canMetal  = ['weapon','armor','shield','ammunition'].includes(effectiveCat);

    if (canSilver) {
      const btn = document.createElement('button');
      const isSilvered = slotData.silvered || slotData.material === 'silvered';
      btn.className = 'prop-chip' + (isSilvered ? ' active-silvered' : '');
      btn.textContent = 'Silvered';
      btn.onclick = () => {
        slotData.silvered = !(slotData.silvered || slotData.material === 'silvered');
        if (slotData.material === 'silvered') slotData.material = null;
        render(); showInspector(slotData, container, r, c, packIdx);
      };
      propsEl.appendChild(btn);
    }

    if (canMetal) {
      const metals = [null, 'mithral', 'adamantine'];
      const curMetal = (slotData.material === 'mithral' || slotData.material === 'adamantine') ? slotData.material : null;
      const btn = document.createElement('button');
      btn.className = 'prop-chip' + (curMetal ? ` active-${curMetal}` : '');
      btn.textContent = curMetal ? curMetal.charAt(0).toUpperCase() + curMetal.slice(1) : 'Metal';
      btn.onclick = () => {
        const idx = metals.indexOf(curMetal);
        slotData.material = metals[(idx + 1) % metals.length];
        render(); showInspector(slotData, container, r, c, packIdx);
      };
      propsEl.appendChild(btn);
    }

    // Weapon / armor / element selects
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
      sel.addEventListener('change', () => {
        slotData.variables.weapon.value = sel.value;
        const libWeapon = getLibraryItem(sel.value);
        if (libWeapon && libWeapon.bulk) slotData.bulk = libWeapon.bulk;
        render();
      });
      propsEl.appendChild(sel);
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
      sel.addEventListener('change', () => {
        slotData.variables.armor.value = sel.value;
        const libArmor = getLibraryItem(sel.value);
        if (libArmor && libArmor.bulk) slotData.bulk = libArmor.bulk;
        render();
      });
      propsEl.appendChild(sel);
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
      sel.addEventListener('change', () => {
        slotData.variables.element.value = sel.value;
        render();
      });
      propsEl.appendChild(sel);
    }

    // Has Uses toggle — custom items only
    if (slotData.custom) {
      const vars = slotData.variables || {};
      const hasUsesActive = !!(slotData.hasUses || vars.uses || vars.count);
      const chip = document.createElement('button');
      chip.className = 'prop-chip' + (hasUsesActive ? ' active' : '');
      chip.textContent = 'Has Uses';
      chip.onclick = () => {
        if (hasUsesActive) {
          slotData.hasUses = false;
          delete slotData.variables.uses;
          delete slotData.variables.count;
        } else {
          slotData.hasUses = true;
          slotData.variables = slotData.variables || {};
          if (!slotData.variables.uses && !slotData.variables.count) {
            slotData.variables.uses = { value: 1, control: 'both', min: 0 };
          }
        }
        render(); showInspector(slotData, container, r, c);
      };
      propsEl.appendChild(chip);
    }

    propsEl.hidden = !container || propsEl.children.length === 0;

    // Container rows input (only when container chip is active)
    const rowsRowEl = document.getElementById('insp-container-rows-row');
    const rowsInput = document.getElementById('insp-container-rows');
    rowsRowEl.hidden = !slotData.isContainer;
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
            linked.rows = linked.slots.length; render();
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
      if ((key === 'weapon' || key === 'armor' || key === 'element') && meta.control === 'select') continue;

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

    inspectorEl.classList.remove('inspector-collapsed');
  }

  function hideInspector() {
    inspectorEl.classList.add('inspector-collapsed');
    document.getElementById('insp-name').textContent = '';
    inspectorItemKey = null;
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
    if (!inspectorEl.classList.contains('inspector-collapsed')
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
  const _shopTabBtn = document.getElementById('shop-tab-btn');

  function activateTrash() {
    _shopTabBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    _shopTabBtn.classList.add('drag-trash');
  }
  function deactivateTrash() {
    _shopTabBtn.innerHTML = '🛒';
    _shopTabBtn.classList.remove('drag-trash', 'drag-trash-hover');
  }

  // removeFromSource: called only when a drop is committed, to extract the item from its origin.
  function startDrag(slotData, container, r, c, x, y, srcCenter, removeFromSource) {
    dragState = { slotData, srcContainer: container, srcR: r, srcC: c, srcCenter: srcCenter || null, removeFromSource };

    ghostEl = document.createElement('div');
    ghostEl.className = 'drag-ghost';
    ghostEl.textContent = packName(slotData);
    document.body.appendChild(ghostEl);
    document.body.classList.add('is-dragging');

    if (container !== null) activateTrash();

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
    const { slotData, srcContainer, srcR, srcC, srcCenter, removeFromSource } = dragState;
    dragState = null;

    // Trash drop — run the same deletion path as the inspector "Remove item" button
    if (el && (el === _shopTabBtn || _shopTabBtn.contains(el)) && srcContainer) {
      const trashLib = getLibraryItem(slotData.name);
      if (trashLib && trashLib.warnOnRemove) {
        const v = slotData.variables || {};
        const hasCoins = ['pp','gp','sp','cp'].some(k => v[k] && (v[k].value || 0) > 0);
        if (hasCoins && !confirm(trashLib.warnOnRemove)) { render(); return; }
      }
      clearSlot(srcContainer, srcR, srcC);
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

      // Same slot — no-op
      if (targetContainer === srcContainer && tR === srcR && tC === srcC) {
        render();
        return;
      }

      const targetItem = targetContainer.slots[tR][tC];

      // Capture dest rect before render() rebuilds the DOM
      const destRect = wrap.getBoundingClientRect();
      const destCenter = { x: destRect.left + destRect.width / 2, y: destRect.top + destRect.height / 2 };

      // Pouch auto-creation: two plain packables meet — wrap them in a linked Pouch container
      const isPlainPackable = sd => isSlotPackable(sd) && !sd.isContainer && !sd.containerId;
      if (targetItem && isPlainPackable(slotData) && isPlainPackable(targetItem)) {
        const pouchSlot = { name: 'Pouch', bulk: Bulk.PACKABLE, isContainer: true, containerRows: 2, variables: {} };
        const otherC = 1 - tC;
        const bystander = targetContainer.slots[tR][otherC];
        const displace = bystander && bystander !== slotData;
        removeFromSource();
        targetContainer.slots[tR][0] = pouchSlot;
        targetContainer.slots[tR][1] = null;
        if (displace) {
          const free = findEmptySlot(targetContainer, tR);
          if (free) targetContainer.slots[free.r][free.c] = bystander;
          else { targetContainer.slots.push([bystander, null]); targetContainer.rows++; }
        }
        createLinkedContainer(pouchSlot, targetContainer.id, tR, 0);
        const linked = state.containers.find(c => c.id === pouchSlot.containerId);
        if (linked) { linked.slots[0][0] = targetItem; linked.slots[0][1] = slotData; }
        render();
        return;
      }

      // Smart drop into container: if target slot holds a container item, try placing inside it
      if (targetItem && targetItem.containerId && !isSlotBulky(slotData)) {
        const linked = state.containers.find(c => c.id === targetItem.containerId);
        if (linked) {
          const wouldWarn = linked.name === 'Pouch' && !isSlotPackable(slotData);
          if (!wouldWarn) {
            const freeSlot = findEmptySlot(linked, -1);
            if (freeSlot) {
              removeFromSource();
              placeSlotData(slotData, linked, freeSlot.r, freeSlot.c);
              return;
            }
          }
        }
      }

      // Commit: remove item from source now that we know the drop is valid
      removeFromSource();

      if (targetItem) {
        // Swap — fly both items between their old and new slots
        const swapName = packName(targetItem);
        targetContainer.slots[tR][tC] = null;
        srcContainer.slots[srcR][srcC] = targetItem;
        placeSlotData(slotData, targetContainer, tR, tC);
        const actualDest = postRenderCenter(targetContainer.id, tR, tC, slotData) || destCenter;
        if (srcCenter) spawnFlightClone(packName(slotData), srcCenter, actualDest);
        const actualSwapDest = postRenderCenter(srcContainer.id, srcR, srcC, targetItem);
        if (actualSwapDest) spawnFlightClone(swapName, destCenter, actualSwapDest);
        return;
      }

      placeSlotData(slotData, targetContainer, tR, tC);
      const actualDest = postRenderCenter(targetContainer.id, tR, tC, slotData) || destCenter;
      if (srcCenter) spawnFlightClone(packName(slotData), srcCenter, actualDest);
    } else {
      // Dropped outside any container — item stays in slot
      render();
    }
  }

  // After render, find where an item actually ended up — bulky items always render at c=0.
  function postRenderCenter(containerId, r, c, item) {
    const col = (isSlotBulky(item) && !item.conflict) ? 0 : c;
    const el = document.querySelector(
      `[data-container-id="${containerId}"][data-r="${r}"][data-c="${col}"]`
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
          slotData.conflictMsg = 'This item is too bulky — clear an adjacent slot to resolve.';
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
    if (!dragState) return;
    moveGhost(e.clientX, e.clientY);

    // Highlight trash when hovering over it
    if (_shopTabBtn.classList.contains('drag-trash')) {
      const tr = _shopTabBtn.getBoundingClientRect();
      const over = e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom;
      _shopTabBtn.classList.toggle('drag-trash-hover', over);
    }

    // Auto-scroll #inv-scroll when dragging near top/bottom edges
    const scrollEl = document.getElementById('inv-scroll');
    if (scrollEl.hidden) { dragScrollVel = 0; return; }
    const rect = scrollEl.getBoundingClientRect();
    const ZONE = 100;
    const MAX  = 12;
    if (e.clientY < rect.top + ZONE) {
      dragScrollVel = -MAX * Math.pow(1 - Math.max(0, e.clientY - rect.top) / ZONE, 2);
    } else if (e.clientY > rect.bottom - ZONE) {
      dragScrollVel = MAX * Math.pow(1 - Math.max(0, rect.bottom - e.clientY) / ZONE, 2);
    } else {
      dragScrollVel = 0;
    }
    if (dragScrollVel !== 0 && !dragScrollRaf) {
      dragScrollRaf = requestAnimationFrame(dragScrollStep);
    }
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
    startShopDrag(slotData, x, y) {
      startDrag(slotData, null, -1, -1, x, y, null, () => {});
      dragState._shopDrag = true;
    },
    addItem(slotData) {
      // Place item into the first available slot in equipped, then strapped
      const targets = state.containers.filter(c => c.id === 'equipped' || c.id === 'strapped');
      for (const container of targets) {
        let placed = false;
        for (let r = 0; r < container.slots.length; r++) {
          if (!container.slots[r][0]) {
            placeSlotData(slotData, container, r, 0); placed = true; break;
          }
          if (!container.slots[r][1] && !isSlotBulky(slotData)) {
            placeSlotData(slotData, container, r, 1); placed = true; break;
          }
        }
        if (placed) return;
      }
      // All slots full — append a row to strapped
      const strapped = state.containers.find(c => c.id === 'strapped');
      if (strapped) {
        strapped.slots.push([null, null]);
        strapped.rows++;
        placeSlotData(slotData, strapped, strapped.slots.length - 1, 0);
      }
    },

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

  // ── INVENTORY SYSTEM ────────────────────────────────────────────────────
  inv = window.InventorySystem({
    database: null,
    auth: { onAuthStateChanged: () => {} },
    onChange:            handleInventoryChange,
    onCrossCharDrop:     handleCrossCharDrop,
    isHiddenFromPlayer:  (itemName) => !isItemVisible(itemName, getItemSection(itemName)),
  });

  // ── CLOSE / LOGOUT ──────────────────────────────────────────────────────
  document.getElementById('inv-close-btn').addEventListener('click', () => {
    window.parent.postMessage({ type: 'closeInventory' }, '*');
  });

  // Receive sign-in/out messages from the parent page
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'signOut') {
      auth.signOut().catch(() => {});
    }
    if (e.data && e.data.type === 'signIn') {
      const current   = (auth.currentUser?.email || '').toLowerCase();
      const requested = (e.data.email || '').toLowerCase();
      if (!auth.currentUser) {
        // Not signed in — sign in directly without a signOut first
        auth.signInWithEmailAndPassword(e.data.email, e.data.password).catch(() => {});
      } else if (current !== requested) {
        // Signed in as a different user — switch accounts
        auth.signOut().then(() =>
          auth.signInWithEmailAndPassword(e.data.email, e.data.password).catch(() => {})
        );
      }
      // Same user already signed in — do nothing
    }
  });

  // ── SHOP ────────────────────────────────────────────────────────────────
  let shopOpen = false;
  const shopTabBtn  = document.getElementById('shop-tab-btn');
  const shopPanel   = document.getElementById('shop-panel');
  const invScrollEl = document.getElementById('inv-scroll');
  const charHeaderEl= document.getElementById('char-header');

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

  function buildShop() {
    const scroll = document.getElementById('shop-scroll');
    const savedScrollTop = scroll.scrollTop;
    scroll.innerHTML = '';
    let currentSection = null;
    let currentRarity  = null;
    const SHOP_HIDDEN_SECTIONS = new Set(['Valuables', 'Currency']);
    const visibleSections = [];

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

      const visible = isItemVisible(item.name, currentSection);
      const avail   = isItemAvailable(item.name);

      const row = document.createElement('div');
      row.className = 'shop-item-row'
        + (!visible && window._isDM ? ' shop-item-hidden' : '')
        + (!avail ? ' shop-item-unavailable' : '');
      row.dataset.section  = currentSection;
      row.dataset.rarity   = currentRarity || '';
      row.dataset.itemName = item.name;
      if (!visible) row.dataset.playerHidden = 'true';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'shop-item-name';
      nameSpan.textContent = item.name;

      const costSpan = document.createElement('span');
      costSpan.className = 'shop-item-cost';
      costSpan.textContent = item.cost || '';

      const infoIcon = document.createElement('span');
      infoIcon.className = 'shop-item-info-icon';
      infoIcon.innerHTML = '<i class="fas fa-circle-info"></i>';
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

      row.addEventListener('click', e => {
        if (row._shopDragging
          || e.target.closest('.shop-item-vis-btn')
          || e.target.closest('.shop-item-avail-btn')) return;
        inv.toggleShopItem(buildShopSlotData(item), `shop-${item.name}`);
      });

      // Mirror the inventory-slot approach: touch-action:none prevents iOS from
      // stealing the gesture; we manually scroll #shop-scroll during swipes so
      // the list still scrolls, and use setPointerCapture once drag is confirmed.
      row.style.touchAction = 'none';

      let lpTimer = null, lpX, lpY, lpPointerId, lpScrolling = false, lpLastY = 0;
      const shopScrollEl = document.getElementById('shop-scroll');

      row.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        if (!window._isDM && !isItemAvailable(item.name)) return;
        lpX = e.clientX; lpY = e.clientY; lpPointerId = e.pointerId;
        lpScrolling = false;
        lpTimer = setTimeout(() => {
          lpTimer = null;
          lpScrolling = false;
          row._shopDragging = true;
          row.classList.add('shop-item-dragging');
          document.documentElement.setPointerCapture(lpPointerId);
          inv.startShopDrag(buildShopSlotData(item), e.clientX, e.clientY);
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
        if (!lpTimer) return;
        if ((e.clientX - lpX) ** 2 + (e.clientY - lpY) ** 2 > 64) {
          clearTimeout(lpTimer); lpTimer = null;
          lpScrolling = true;
          lpLastY = e.clientY;
        }
      });
      const cancelLP = () => {
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        lpScrolling = false;
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
    visibleSections.forEach(section => {
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

  function buildShopSlotData(libItem) {
    return {
      name:      libItem.name,
      variables: JSON.parse(JSON.stringify(libItem.variables || {})),
      _shopItem: true,
    };
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

  function openShop() {
    shopOpen = true;
    shopTabBtn.classList.add('active');
    invScrollEl.hidden  = true;
    charHeaderEl.hidden = true;
    shopPanel.hidden    = false;
    document.getElementById('shop-search').value = '';
    document.getElementById('shop-category').value = '';
    buildShop();
  }

  function closeShop() {
    shopOpen = false;
    shopTabBtn.classList.remove('active');
    shopPanel.hidden    = true;
    invScrollEl.hidden  = false;
    charHeaderEl.hidden = false;
  }

  shopTabBtn.addEventListener('click', () => {
    if (shopOpen) closeShop(); else openShop();
  });

  // ── ROLE (DM / PLAYER) ──────────────────────────────────────────────────
  const roleBtn = document.getElementById('role-btn');
  let userCanBeDM = false;

  function applyRole(role) {
    const isDM = (role === 'dm') && userCanBeDM;
    window._isDM         = isDM;
    roleBtn.hidden       = !userCanBeDM;
    roleBtn.textContent  = 'DM';
    roleBtn.title        = isDM ? 'You are DM — click to switch to Player' : 'You are Player — click to switch to DM';
    roleBtn.dataset.role = isDM ? 'dm' : 'player';
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
          ownerUid:  data.ownerUid  || '',
          ownerName: data.ownerName || 'Unknown',
          state:     parseState(data.state),
          createdAt: data.createdAt || 0,
          sortOrder: data.sortOrder ?? data.createdAt ?? 0,
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
        // Pick this user's most recent char; fall back to any char (DM viewing); else create
        const mine = Object.values(allChars)
          .filter(c => c.ownerUid === currentUser.uid)
          .sort((a, b) => b.createdAt - a.createdAt);
        if (mine.length) {
          switchToChar(mine[0].id, true);
        } else {
          const any = Object.values(allChars).sort((a, b) => b.createdAt - a.createdAt);
          if (any.length) switchToChar(any[0].id, true);
          else            createChar();
        }
      }
    });
  }

  function parseState(str) {
    try {
      const s = JSON.parse(str || 'null');
      if (!s) return blankState();
      if (!s.containers || !s.containers.length) s.containers = defaultContainers();
      inv.flattenGroups(s.containers);
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
  function switchToChar(charId, skipSave) {
    if (shopOpen) closeShop();
    inv.cancelDrag();
    if (!skipSave && currentCharId) saveChar(currentCharId, true);
    dirty = false;
    currentCharId = charId;
    suppressSave = true;
    try { inv.loadState(allChars[charId].state); } catch (e) { console.warn('loadState error:', e); }
    suppressSave = false;
    renderTabs();
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
      ownerUid:  currentUser.uid,
      ownerName: currentUser.displayName || currentUser.email || 'Player',
      state:     blank,
      createdAt,
      sortOrder: createdAt,
    };
    allChars[newId]  = charData;
    pendingNewChar   = charData;
    currentCharId    = newId;

    ref.set({
      ownerUid:  currentUser.uid,
      ownerName: currentUser.displayName || currentUser.email || 'Player',
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
    database.ref(`/inventory_characters/${charId}`).update({
      state:     JSON.stringify(state),
      ownerName: currentUser.displayName || currentUser.email || 'Player',
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
          if (v.coins) {
            const amt = v.coins.value || 0;
            if      (slot.name === 'Platinum Pieces (PP)') pp += amt;
            else if (slot.name === 'Gold Pieces (GP)')     gp += amt;
            else if (slot.name === 'Silver Pieces (SP)')   sp += amt;
            else if (slot.name === 'Copper Pieces (CP)')   cp += amt;
          }
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

  function handleInventoryChange() {
    if (suppressSave || !currentCharId) return;
    dirty = true;
    const tab = document.querySelector(`[data-char-id="${currentCharId}"]`);
    if (tab) {
      const nameEl = tab.querySelector('.char-tab-name');
      if (nameEl) nameEl.textContent = inv.getState().charName || 'Unnamed';
    }
    saveChar(currentCharId);
  }

  function handleCrossCharDrop(item, targetCharId, linkedContainer) {
    if (!targetCharId || !allChars[targetCharId]) return;

    // Strip the shop marker before storing
    const cleanItem = Object.assign({}, item);
    delete cleanItem._shopItem;

    // Drop onto the currently-open character's own tab
    if (targetCharId === currentCharId) {
      inv.addItem(cleanItem); // re-places item (shop: new; inventory: returned after source removal)
      if (item._shopItem) {
        const tabEl = document.querySelector(`[data-char-id="${currentCharId}"]`);
        if (tabEl) {
          tabEl.classList.add('tab-received');
          setTimeout(() => tabEl.classList.remove('tab-received'), 1200);
        }
      }
      return;
    }

    const targetState = JSON.parse(JSON.stringify(allChars[targetCharId].state));
    const equipped    = targetState.containers.find(c => c.id === 'equipped');
    if (!equipped) return;

    let finalR = 0, finalC = 0, placed = false;
    for (let r = 0; r < equipped.slots.length; r++) {
      if (!equipped.slots[r][0]) {
        equipped.slots[r][0] = cleanItem; finalR = r; finalC = 0; placed = true; break;
      }
      if (!equipped.slots[r][1] && !isBulky(cleanItem)) {
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

    // Flash the target tab green
    const tabEl = document.querySelector(`[data-char-id="${targetCharId}"]`);
    if (tabEl) {
      tabEl.classList.add('tab-received');
      setTimeout(() => tabEl.classList.remove('tab-received'), 1200);
    }
  }

  function isBulky(item) {
    if (!item) return false;
    const id = item.bulk?.id || 'stock';
    return id === 'bulky' || id === 'verybulky';
  }

  // ── TABS ────────────────────────────────────────────────────────────────
  function renderTabs() {
    const tabsEl = document.getElementById('char-tabs');
    tabsEl.innerHTML = '';

    Object.values(allChars)
      .sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
      .forEach(char => {
        const tab = document.createElement('button');
        tab.className  = 'char-tab' + (char.id === currentCharId ? ' active' : '');
        tab.dataset.charId = char.id;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'char-tab-info';

        const nameSpan = document.createElement('span');
        nameSpan.className   = 'char-tab-name';
        nameSpan.textContent = char.state.charName || 'Unnamed';
        infoDiv.appendChild(nameSpan);


        tab.appendChild(infoDiv);

        // Ownership dot
        if (char.ownerUid === currentUser?.uid) {
          const dot = document.createElement('span');
          dot.className = 'char-tab-dot';
          tab.appendChild(dot);
        }

        // Delete button — DM only
        if (window._isDM) {
          const del = document.createElement('button');
          del.className   = 'char-tab-del';
          del.textContent = '×';
          del.title       = 'Delete character';
          del.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm(`Delete "${char.state.charName || 'this character'}"?`)) {
              deleteChar(char.id);
            }
          });
          tab.appendChild(del);
        }

        tab.addEventListener('click', () => {
          if (char.id !== currentCharId) switchToChar(char.id, false);
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
    if (tab && tab.dataset.charId !== currentCharId) tab.classList.add('tab-drag-over');
  });

  // ── TAB REORDER ────────────────────────────────────────────────────────────
  (function setupTabDrag() {
    const tabsEl = document.getElementById('char-tabs');
    const indicator = document.createElement('div');
    indicator.className = 'tab-drop-indicator';

    let drag = null; // { el, charId, startX, insertBefore }

    tabsEl.addEventListener('pointerdown', e => {
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
};
