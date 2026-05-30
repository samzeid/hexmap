window.InventorySystem = ({ database, auth, onChange, onCrossCharDrop }) => {

  // ── STATE ──────────────────────────────────────────────────────────────
  function createDefaultContainers() {
    return [
      { id: 'equipped', name: 'Equipped',      rows: 1, collapsed: false, permanent: true, slots: [[null,null]] },
      { id: 'strapped', name: 'Strapped Gear', rows: 2, collapsed: false, permanent: true, slots: [[null,null],[null,null]] },
    ];
  }

  const state = { charName: '', carryCapacity: '', containers: createDefaultContainers() };

  // ── ITEM LIBRARY (defined in items.js) ──────────────────────────────────
  const Bulk         = window.Bulk;
  const ITEM_LIBRARY = window.ITEM_LIBRARY;


  // ── HELPERS ─────────────────────────────────────────────────────────────
  function getLibraryItem(name) {
    return ITEM_LIBRARY.find(i => i.name.toLowerCase() === name.trim().toLowerCase()) || null;
  }

  function isNoCarry(slotData) {
    if (!slotData || slotData.packableGroup) return false;
    if (slotData.isContainer) return true;
    const lib = getLibraryItem(slotData.name);
    return !!(lib && lib.noCarry);
  }

  function isContainerItem(slotData) {
    if (!slotData || slotData.packableGroup) return false;
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
    if (!slotData || slotData.packableGroup) return false;
    const id = slotData.bulk ? slotData.bulk.id
              : (getLibraryItem(slotData.name) || {bulk: Bulk.STOCK}).bulk.id;
    return id === 'bulky' || id === 'verybulky';
  }

  function isPackable(slotData) {
    if (!slotData || slotData.packableGroup) return false;
    const lib = getLibraryItem(slotData.name);
    const id = slotData.bulk ? slotData.bulk.id : lib ? lib.bulk.id : 'stock';
    return id === 'packable';
  }

  // ── DOM REFS ────────────────────────────────────────────────────────────
  const containersEl = document.getElementById('containers');
  const dropdownEl   = document.getElementById('autocomplete-dropdown');
  const inspectorEl  = document.getElementById('inspector');

  // Active autocomplete context
  let acContainer = null, acRow = -1, acCol = -1, acInput = null;
  let ignoreNextBlur = false;
  let acPackableOnly = false;

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

  function render() {
    growEquipped();
    shrinkEquipped();
    containersEl.innerHTML = '';
    state.containers.forEach(c => containersEl.appendChild(buildCard(c)));
    updateCarryDisplay();
    if (onChange) onChange();
  }

  function buildCard(container) {
    const card = document.createElement('div');
    const specialClass = container.id === 'equipped' ? ' card-equipped'
                       : container.id === 'strapped'  ? ' card-strapped'
                       : !container.permanent         ? ' card-added' : '';
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
    // Hidden items are invisible to players — render as empty slot
    if (slotData && slotData.hidden && !window._isDM) slotData = null;
    const conflict = slotData && slotData.conflict;

    const wrap = document.createElement('div');
    wrap.className = 'slot' + (full ? ' slot-full' : '');
    wrap.dataset.containerId = container.id;
    wrap.dataset.r = r;
    wrap.dataset.c = c;

    if (slotData && slotData.packableGroup) {
      return buildPackableGroupSlot(wrap, container, r, c, slotData);
    }

    const input = document.createElement('input');
    input.type = 'text';
    const isHidden = slotData && slotData.hidden;
    input.className = 'slot-input' + (slotData ? ' slot-filled' : '') + (conflict ? ' slot-conflict' : '') + (isHidden ? ' slot-hidden' : '');
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
      const numVar = vars.length === 1 && typeof vars[0].value === 'number' ? vars[0] : null;
      const selVar = vars.find(v => v.control === 'select' && v.value);
      label.textContent = numVar  ? `${numVar.value} × ${slotData.name}`
                        : selVar  ? `${slotData.name} — ${selVar.value}`
                        : slotData.name;
      wrap.appendChild(label);
    }

    if (conflict) {
      const warn = document.createElement('span');
      warn.className = 'slot-warn';
      warn.textContent = '⚠';
      warn.title = slotData.conflictMsg || 'Item is too bulky — clear an adjacent slot to resolve';
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
      let downX, downY, downPointerId;

      wrap.addEventListener('pointerdown', e => {
        if (dragState || e.target.tagName === 'BUTTON') return;
        downX = e.clientX; downY = e.clientY; downPointerId = e.pointerId;
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          document.documentElement.setPointerCapture(downPointerId);
          const sr = wrap.getBoundingClientRect();
          startDrag(slotData, container, r, c, downX, downY,
            { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
            () => { container.slots[r][c] = null; });
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

  function buildPackableGroupSlot(wrap, container, r, c, group) {
    wrap.classList.add('slot-packable');

    for (let i = 0; i < 4; i++) {
      const item = group.items[i];
      const cell = document.createElement('div');
      cell.className = 'pack-cell';

      const visibleItem = item && (window._isDM || !item.hidden) ? item : null;
      if (visibleItem) {
        cell.classList.add('pack-cell-filled');
        if (item.hidden) cell.classList.add('pack-cell-hidden');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'pack-cell-name' + (item.conflict ? ' pack-cell-conflict' : '');
        const vars = Object.values(item.variables || {});
        const numVar = vars.length === 1 && typeof vars[0].value === 'number' ? vars[0] : null;
        const selVar = vars.find(v => v.control === 'select' && v.value);
        nameSpan.textContent = numVar ? `${numVar.value}× ${item.name}`
                             : selVar ? `${item.name} — ${selVar.value}`
                             : item.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'pack-cell-remove';
        removeBtn.textContent = '−';
        removeBtn.addEventListener('click', e => {
          e.stopPropagation();
          group.items.splice(i, 1);
          if (group.items.length === 0) container.slots[r][c] = null;
          render();
          hideInspector();
        });

        cell.appendChild(nameSpan);
        cell.appendChild(removeBtn);

        cell.addEventListener('click', e => {
          if (e.target === removeBtn) return;
          showInspector(item, container, r, c, i);
        });

        let downX, downY, downPointerId;
        cell.addEventListener('pointerdown', e => {
          if (dragState || e.target.tagName === 'BUTTON') return;
          downX = e.clientX; downY = e.clientY; downPointerId = e.pointerId;
          longPressTimer = setTimeout(() => {
            longPressTimer = null;
            document.documentElement.setPointerCapture(downPointerId);
            const sr = cell.getBoundingClientRect();
            startDrag(item, container, r, c, downX, downY,
              { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
              () => {
                const idx = group.items.indexOf(item);
                if (idx !== -1) group.items.splice(idx, 1);
                if (group.items.length === 0) container.slots[r][c] = null;
              });
          }, 380);
        });

        cell.addEventListener('pointermove', e => {
          if (!longPressTimer) return;
          if ((e.clientX - downX) ** 2 + (e.clientY - downY) ** 2 > 64) {
            clearTimeout(longPressTimer); longPressTimer = null;
          }
        });

        const cancelLong = () => {
          if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        };
        cell.addEventListener('pointerup',     cancelLong);
        cell.addEventListener('pointercancel', cancelLong);

      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pack-cell-input';
        input.placeholder = '—';
        input.autocomplete = 'off';
        input.spellcheck = false;

        input.addEventListener('focus', () => {
          acContainer = container; acRow = r; acCol = c; acInput = input;
          acPackableOnly = true;
          updateDropdown(input.value);
        });

        input.addEventListener('blur', () => {
          if (ignoreNextBlur) { ignoreNextBlur = false; return; }
          input.value = '';
          closeDropdown();
        });

        input.addEventListener('input', () => updateDropdown(input.value));

        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.trim();
            if (val) commitSlot(val, container, r, c);
            else closeDropdown();
          } else if (e.key === 'Escape') {
            input.value = '';
            closeDropdown();
            input.blur();
          }
        });

        cell.appendChild(input);
      }

      wrap.appendChild(cell);
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

    const sameItem = existing && !existing.packableGroup && existing.name === canonName;
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

    // Packable items go into a packable group (up to 4 per slot)
    if (isPackable(slotData)) {
      let finalR = r, finalC = c, finalIdx = 0;

      if (existing && existing.packableGroup) {
        if (existing.items.length < 4) {
          finalIdx = existing.items.length;
          existing.items.push(slotData);
        } else {
          closeDropdown(); render(); return;
        }
      } else if (!existing) {
        row[c] = { packableGroup: true, items: [slotData] };
        finalIdx = 0;
      } else {
        // Target slot occupied; find a packable group with room, then an empty slot
        let placed = false;
        outer: for (let ri = 0; ri < container.slots.length; ri++) {
          for (let ci = 0; ci < 2; ci++) {
            const s = container.slots[ri][ci];
            if (s && s.packableGroup && s.items.length < 4) {
              finalR = ri; finalC = ci; finalIdx = s.items.length;
              s.items.push(slotData); placed = true; break outer;
            }
          }
        }
        if (!placed) {
          const empty = findEmptySlot(container, -1);
          if (empty) {
            finalR = empty.r; finalC = empty.c; finalIdx = 0;
            container.slots[empty.r][empty.c] = { packableGroup: true, items: [slotData] };
          }
        }
      }

      closeDropdown();
      render();
      showInspector(slotData, container, finalR, finalC, finalIdx);
      return;
    }

    // Non-packable typed into a packable group slot — add it in with a warning
    if (existing && existing.packableGroup) {
      slotData.conflict = true;
      slotData.conflictMsg = 'This item is too large for a packable slot.';
      existing.items.push(slotData);
      closeDropdown();
      render();
      showInspector(slotData, container, r, c, existing.items.length - 1);
      return;
    }

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

    let matches = ITEM_LIBRARY.filter(i => i.name.toLowerCase().includes(query));
    if (acPackableOnly) matches = matches.filter(i => i.bulk.id === 'packable');
    if (!window._isDM) matches = matches.filter(i => !i.dmOnly);
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
    acPackableOnly = false;
    dropdownEl.hidden = true;
    dropdownEl.innerHTML = '';
  }

  // ── INSPECTOR ────────────────────────────────────────────────────────────
  function showInspector(slotData, container, r, c, packIdx) {
    const lib = getLibraryItem(slotData.name);
    document.getElementById('insp-name').textContent = slotData.name;

    const warnEl = document.getElementById('insp-warn');
    if (slotData.conflict) {
      warnEl.textContent = '⚠ ' + (slotData.conflictMsg || 'This item is in a conflicting slot.');
      warnEl.hidden = false;
    } else {
      warnEl.hidden = true;
    }

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

    const costEl = document.getElementById('insp-cost');
    if (lib && lib.cost) {
      costEl.textContent = lib.cost;
      costEl.hidden = false;
    } else {
      costEl.hidden = true;
    }

    document.getElementById('insp-remove').onclick = () => {
      if (typeof packIdx === 'number') {
        const group = container.slots[r][c];
        if (group && group.packableGroup) {
          group.items.splice(packIdx, 1);
          if (group.items.length === 0) container.slots[r][c] = null;
          render(); hideInspector();
        }
      } else {
        clearSlot(container, r, c);
      }
    };

    // Size selector — custom items only
    const sizeEl = document.getElementById('insp-size');
    if (slotData.custom) {
      sizeEl.hidden = false;
      const currentId = slotData.bulk ? slotData.bulk.id : 'stock';
      sizeEl.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bulk === currentId);
        btn.onclick = () => {
          const newBulk = Bulk[btn.dataset.bulk.toUpperCase()] || Bulk.STOCK;
          if (typeof packIdx === 'number') {
            // Extract from packable group, re-place with new bulk
            const group = container.slots[r][c];
            if (group && group.packableGroup) {
              group.items.splice(packIdx, 1);
              if (group.items.length === 0) container.slots[r][c] = null;
            }
            slotData.bulk = newBulk;
            placeSlotData(slotData, container, r, c);
            hideInspector();
          } else {
            const row = container.slots[r];
            if (isSlotBulky(slotData) && !slotData.conflict && c === 0 && row[1] === null) {
              row[1] = null;
            }
            row[c] = null;
            slotData.bulk = newBulk;
            placeSlotData(slotData, container, r, c);
            showInspector(slotData, container, r, c);
          }
        };
      });
    } else {
      sizeEl.hidden = true;
    }

    // Container toggle — custom non-packable items only
    const containerSectionEl = document.getElementById('insp-container-section');
    if (slotData.custom && !isPackable(slotData)) {
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

    // Hidden toggle — DM only
    const hiddenSectionEl = document.getElementById('insp-hidden-section');
    const hiddenBtn       = document.getElementById('insp-hidden-btn');
    if (window._isDM) {
      hiddenSectionEl.hidden = false;
      hiddenBtn.classList.toggle('active', !!slotData.hidden);
      hiddenBtn.textContent = slotData.hidden ? 'On' : 'Off';
      hiddenBtn.onclick = () => {
        slotData.hidden = !slotData.hidden;
        hiddenBtn.classList.toggle('active', slotData.hidden);
        hiddenBtn.textContent = slotData.hidden ? 'On' : 'Off';
        render();
      };
    } else {
      hiddenSectionEl.hidden = true;
    }

    const varsEl = document.getElementById('insp-vars');
    varsEl.innerHTML = '';

    for (const [key, meta] of Object.entries(slotData.variables || {})) {
      const div = document.createElement('div');
      div.className = 'insp-var';

      if (meta.control === 'select') {
        const label = document.createElement('span');
        label.className = 'insp-var-label';
        label.textContent = key;
        const sel = document.createElement('select');
        sel.className = 'insp-select';
        sel.dataset.k = key;
        (meta.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          if (opt === meta.value) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', () => {
          slotData.variables[key].value = sel.value;
          render();
        });
        div.appendChild(label);
        div.appendChild(sel);
      } else {
        const canStep = meta.control === 'plusminus' || meta.control === 'both';
        div.innerHTML = `
          <span class="insp-var-label">${key}</span>
          <div class="insp-ctrl">
            ${canStep ? `<button class="insp-btn" data-k="${key}" data-d="-1">−</button>` : ''}
            <input class="insp-num" type="number" value="${meta.value}" data-k="${key}"
              ${typeof meta.min === 'number' ? `min="${meta.min}"` : ''}
              ${typeof meta.max === 'number' ? `max="${meta.max}"` : ''} />
            ${canStep ? `<button class="insp-btn" data-k="${key}" data-d="1">+</button>` : ''}
          </div>
        `;
      }

      varsEl.appendChild(div);
    }

    varsEl.querySelectorAll('.insp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = slotData.variables[btn.dataset.k];
        let v = m.value + parseInt(btn.dataset.d);
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        const inp = btn.closest('.insp-ctrl').querySelector('.insp-num');
        if (inp) inp.value = v;
        render();
      });
    });

    varsEl.querySelectorAll('.insp-num').forEach(inp => {
      inp.addEventListener('input', () => {
        const m = slotData.variables[inp.dataset.k];
        let v = parseInt(inp.value);
        if (isNaN(v)) return;
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        render();
      });
      inp.addEventListener('blur', () => {
        const m = slotData.variables[inp.dataset.k];
        inp.value = m.value;
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
  // removeFromSource: called only when a drop is committed, to extract the item from its origin.
  function startDrag(slotData, container, r, c, x, y, srcCenter, removeFromSource) {
    dragState = { slotData, srcContainer: container, srcR: r, srcC: c, srcCenter: srcCenter || null, removeFromSource };

    ghostEl = document.createElement('div');
    ghostEl.className = 'drag-ghost';
    ghostEl.textContent = slotData.name;
    document.body.appendChild(ghostEl);
    document.body.classList.add('is-dragging');

    moveGhost(x, y);
    closeDropdown();
    if (document.activeElement) document.activeElement.blur();
    // Item stays in slot — no render needed; ghost is the only new visual.
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

    // Cross-character tab drop
    const charTab = el && el.closest('[data-char-id]');
    if (charTab && charTab.dataset.charId) {
      document.querySelectorAll('[data-char-id]').forEach(t => t.classList.remove('tab-drag-over'));
      if (onCrossCharDrop) {
        removeFromSource();
        render();
        onCrossCharDrop(slotData, charTab.dataset.charId);
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
      const draggingPackable = isPackable(slotData);
      const targetIsGroup = targetItem && targetItem.packableGroup;
      const srcSlot = srcContainer.slots[srcR][srcC];
      const srcIsGroup = srcSlot && srcSlot.packableGroup;

      // Packable from a group dropped on an occupied non-group slot — can't swap, leave in place
      if (targetItem && !targetIsGroup && !draggingPackable && srcIsGroup) {
        render();
        return;
      }

      // Capture dest rect before render() rebuilds the DOM
      const destRect = wrap.getBoundingClientRect();
      const destCenter = { x: destRect.left + destRect.width / 2, y: destRect.top + destRect.height / 2 };

      // Commit: remove item from source now that we know the drop is valid
      removeFromSource();

      if (targetIsGroup && !draggingPackable) {
        targetContainer.slots[tR][tC] = null;
        srcContainer.slots[srcR][srcC] = targetItem;
      } else if (targetItem && !targetIsGroup && !draggingPackable) {
        // Swap — fly both items between their old and new slots
        const swapName = targetItem.name;
        targetContainer.slots[tR][tC] = null;
        srcContainer.slots[srcR][srcC] = targetItem;
        placeSlotData(slotData, targetContainer, tR, tC);
        const actualDest = postRenderCenter(targetContainer.id, tR, tC, slotData) || destCenter;
        if (srcCenter) spawnFlightClone(slotData.name, srcCenter, actualDest);
        const actualSwapDest = postRenderCenter(srcContainer.id, srcR, srcC, targetItem);
        if (actualSwapDest) spawnFlightClone(swapName, destCenter, actualSwapDest);
        return;
      }

      placeSlotData(slotData, targetContainer, tR, tC);
      const actualDest = postRenderCenter(targetContainer.id, tR, tC, slotData) || destCenter;
      if (srcCenter) spawnFlightClone(slotData.name, srcCenter, actualDest);
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

    if (isPackable(slotData)) {
      const existing = row[c];
      if (existing && existing.packableGroup && existing.items.length < 4) {
        existing.items.push(slotData);
      } else if (!existing) {
        row[c] = { packableGroup: true, items: [slotData] };
      } else {
        let placed = false;
        outer: for (let ri = 0; ri < container.slots.length; ri++) {
          for (let ci = 0; ci < 2; ci++) {
            const s = container.slots[ri][ci];
            if (s && s.packableGroup && s.items.length < 4) {
              s.items.push(slotData); placed = true; break outer;
            }
          }
        }
        if (!placed) {
          const empty = findEmptySlot(container, -1);
          if (empty) container.slots[empty.r][empty.c] = { packableGroup: true, items: [slotData] };
        }
      }
      render();
      return;
    }

    // Non-packable landing on a packable group — rejoin rather than overwrite
    if (row[c] && row[c].packableGroup) {
      if (!slotData.conflict) {
        slotData.conflict = true;
        slotData.conflictMsg = 'This item is too large for a packable slot.';
      }
      row[c].items.push(slotData);
      render();
      return;
    }

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
    if (dragState) moveGhost(e.clientX, e.clientY);
  });

  document.addEventListener('pointerup', e => {
    if (dragState) endDrag(e.clientX, e.clientY);
  });

  document.addEventListener('pointercancel', () => {
    if (!dragState) return;
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
    checkIsPackable(item) { return isPackable(item); },
    cancelDrag() {
      if (!dragState) return;
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
  let inv                = null;

  // ── INVENTORY SYSTEM ────────────────────────────────────────────────────
  inv = window.InventorySystem({
    database: null,
    auth: { onAuthStateChanged: () => {} },
    onChange:         handleInventoryChange,
    onCrossCharDrop:  handleCrossCharDrop,
  });

  // ── AUTH ────────────────────────────────────────────────────────────────
  // ── AUTH ────────────────────────────────────────────────────────────────
  function showLoginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.hidden = false;
  }

  // Email / password sign-in
  document.getElementById('email-sign-in-btn').addEventListener('click', () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showLoginError('Enter email and password.'); return; }
    document.getElementById('login-error').hidden = true;
    const btn = document.getElementById('email-sign-in-btn');
    btn.textContent = 'Signing in…';
    btn.disabled = true;
    auth.signInWithEmailAndPassword(email, password)
      .catch(err => {
        showLoginError(err.message);
        btn.textContent = 'Sign in';
        btn.disabled = false;
      });
  });

  // Allow pressing Enter in password field to submit
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('email-sign-in-btn').click();
  });

  // ── ROLE (DM / PLAYER) ──────────────────────────────────────────────────
  const roleBtn = document.getElementById('role-btn');

  function applyRole(role) {
    window._isDM = (role === 'dm');
    roleBtn.textContent  = window._isDM ? '⚔ DM' : '🛡 Player';
    roleBtn.title        = window._isDM ? 'You are DM — click to switch to Player' : 'You are Player — click to switch to DM';
    roleBtn.dataset.role = role;
  }

  roleBtn.addEventListener('click', () => {
    if (!currentUser) return;
    const next = window._isDM ? 'player' : 'dm';
    database.ref(`/inventory_roles/${currentUser.uid}`).set(next);
    applyRole(next);
  });

  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      document.getElementById('login-screen').hidden = true;
      document.getElementById('app').hidden = false;
      // Load this user's role from Firebase, defaulting to player
      database.ref(`/inventory_roles/${user.uid}`).once('value', snap => {
        applyRole(snap.val() || 'player');
      });
      subscribeToChars();
    } else {
      document.getElementById('login-screen').hidden = false;
      document.getElementById('app').hidden = true;
      window._isDM  = false;
      currentCharId = null;
      allChars      = {};
    }
  });

  // ── FIREBASE ────────────────────────────────────────────────────────────
  function subscribeToChars() {
    database.ref('/inventory_characters').on('value', snap => {
      const raw = snap.val() || {};

      // Rebuild allChars, preserving the current char's live state so
      // an incoming write from someone else doesn't overwrite local edits.
      const liveState = currentCharId ? inv.getState() : null;

      allChars = {};
      Object.entries(raw).forEach(([id, data]) => {
        allChars[id] = {
          id,
          ownerUid:  data.ownerUid  || '',
          ownerName: data.ownerName || 'Unknown',
          state:     parseState(data.state),
          createdAt: data.createdAt || 0,
          sortOrder: data.sortOrder ?? data.createdAt ?? 0,
        };
      });

      if (currentCharId && allChars[currentCharId]) {
        if (dirty || localWriteInFlight) {
          // Local edits in flight — keep them, don't let the Firebase echo overwrite them
          if (liveState) allChars[currentCharId].state = liveState;
        } else {
          // Nothing pending locally — apply whatever Firebase has (another user's edit)
          suppressSave = true;
          inv.loadState(allChars[currentCharId].state);
          suppressSave = false;
        }
      }

      renderTabs();

      if (!currentCharId || !allChars[currentCharId]) {
        // Pick this user's most recent char, or the first overall, or create one
        const mine = Object.values(allChars)
          .filter(c => c.ownerUid === currentUser.uid)
          .sort((a, b) => b.createdAt - a.createdAt);
        if (mine.length) switchToChar(mine[0].id, true);
        else createChar();
      }
    });
  }

  function parseState(str) {
    try {
      const s = JSON.parse(str || 'null');
      if (!s) return blankState();
      if (!s.containers || !s.containers.length) s.containers = defaultContainers();
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
    inv.cancelDrag();
    if (!skipSave && currentCharId) saveChar(currentCharId, true);
    dirty = false;
    currentCharId = charId;
    suppressSave = true;
    inv.loadState(allChars[charId].state);
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

    ref.set({
      ownerUid:  currentUser.uid,
      ownerName: currentUser.displayName || currentUser.email || 'Player',
      state:     JSON.stringify(blank),
      createdAt,
      sortOrder: createdAt,
    });

    // Add immediately to local state so tabs and inventory update without waiting for Firebase
    allChars[newId] = {
      id: newId,
      ownerUid:  currentUser.uid,
      ownerName: currentUser.displayName || currentUser.email || 'Player',
      state:     blank,
      createdAt,
      sortOrder: createdAt,
    };
    currentCharId = newId;
    suppressSave = true;
    inv.loadState(blank);
    suppressSave = false;
    renderTabs();
  }

  function deleteChar(charId) {
    if (allChars[charId]?.ownerUid !== currentUser?.uid) return;
    database.ref(`/inventory_characters/${charId}`).remove();
    if (currentCharId === charId) currentCharId = null;
    // Firebase listener handles picking/creating the next char
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
  function handleInventoryChange() {
    if (suppressSave || !currentCharId) return;
    dirty = true;
    // Keep tab name in sync immediately
    const curTabName = document.querySelector(
      `[data-char-id="${currentCharId}"] .char-tab-name`
    );
    if (curTabName) curTabName.textContent = inv.getState().charName || 'Unnamed';
    saveChar(currentCharId);
  }

  function handleCrossCharDrop(item, targetCharId) {
    if (!targetCharId || targetCharId === currentCharId || !allChars[targetCharId]) return;

    const targetState = JSON.parse(JSON.stringify(allChars[targetCharId].state));
    const equipped    = targetState.containers.find(c => c.id === 'equipped');
    if (!equipped) return;

    let placed = false;

    if (inv.checkIsPackable(item)) {
      // Packable items go into a packableGroup (up to 4 per slot)
      for (const row of equipped.slots) {
        for (let c = 0; c < 2; c++) {
          if (row[c] && row[c].packableGroup && row[c].items.length < 4) {
            row[c].items.push(item); placed = true; break;
          }
        }
        if (placed) break;
      }
      if (!placed) {
        // Find an empty cell for a new packableGroup
        for (const row of equipped.slots) {
          for (let c = 0; c < 2; c++) {
            if (!row[c]) {
              row[c] = { packableGroup: true, items: [item] };
              placed = true; break;
            }
          }
          if (placed) break;
        }
      }
      if (!placed) {
        equipped.slots.push([{ packableGroup: true, items: [item] }, null]);
        equipped.rows++;
      }
    } else {
      // Non-packable items go directly into a slot
      for (const row of equipped.slots) {
        if (!row[0])                    { row[0] = item; placed = true; break; }
        if (!row[1] && !isBulky(item))  { row[1] = item; placed = true; break; }
      }
      if (!placed) {
        equipped.slots.push([item, null]);
        equipped.rows++;
      }
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
    if (!item || item.packableGroup) return false;
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

        const nameSpan = document.createElement('span');
        nameSpan.className   = 'char-tab-name';
        nameSpan.textContent = char.state.charName || 'Unnamed';
        tab.appendChild(nameSpan);

        // Ownership dot
        if (char.ownerUid === currentUser?.uid) {
          const dot = document.createElement('span');
          dot.className = 'char-tab-dot';
          tab.appendChild(dot);
        }

        // Delete button (own chars only)
        if (char.ownerUid === currentUser?.uid) {
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

    document.getElementById('add-char-btn').onclick = createChar;
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
