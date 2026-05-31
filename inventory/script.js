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
  const Bulk           = window.Bulk;
  const ITEM_LIBRARY   = window.ITEM_LIBRARY;
  const WEAPON_OPTIONS = window.WEAPON_OPTIONS;


  // ── HELPERS ─────────────────────────────────────────────────────────────
  function getLibraryItem(name) {
    if (!name || typeof name !== 'string') return null;
    return ITEM_LIBRARY.find(i => i.name && i.name.toLowerCase() === name.trim().toLowerCase()) || null;
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
  let dragScrollVel  = 0;
  let dragScrollRaf  = null;

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
      // For filled slots in edit mode: show inspector + dropdown
      // For empty slots: just show dropdown
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
      input.classList.remove('slot-editing');
      if (ignoreNextBlur) { ignoreNextBlur = false; return; }
      input.value = prev;
      closeDropdown();
    });

    wrap.appendChild(input);

    if (slotData) {
      // Edit button — tap to enter rename/edit mode (opens keyboard)
      const editBtn = document.createElement('button');
      editBtn.className = 'slot-edit';
      editBtn.textContent = '✎';
      editBtn.title = 'Rename';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        input.classList.add('slot-editing');
        input.focus();
        input.select();
      });
      wrap.appendChild(editBtn);

      const label = document.createElement('span');
      const isContainer = isNoCarry(slotData);
      label.className = 'slot-label'
        + (conflict     ? ' slot-label-conflict'   : '')
        + (isContainer  ? ' slot-label-container'  : '');
      const vars = Object.values(slotData.variables || {});
      const numVar = vars.find(v => (v.control === 'plusminus' || v.control === 'both') && typeof v.value === 'number') || null;
      const selVar = vars.find(v => v.control === 'select' && v.value);
      const matPfx = slotData.material ? slotData.material.charAt(0).toUpperCase() + slotData.material.slice(1) + ' ' : '';
      label.textContent = numVar  ? `${matPfx}${numVar.value} × ${slotData.name}`
                        : selVar  ? `${matPfx}${slotData.name} — ${selVar.value}`
                        : `${matPfx}${slotData.name}`;
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

      // Short tap → show inspector (long press → drag, handled below)
      wrap.addEventListener('click', e => {
        if (e.target.closest('.slot-remove') || e.target.closest('.slot-edit')) return;
        showInspector(slotData, container, r, c);
      });

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

    let matches = ITEM_LIBRARY.filter(i => i.name && i.name.toLowerCase().includes(query));
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
    dropdownEl.hidden = true;
    dropdownEl.innerHTML = '';
  }

  // ── INSPECTOR ────────────────────────────────────────────────────────────
  function showInspector(slotData, container, r, c, packIdx) {
    const lib = getLibraryItem(slotData.name);

    // ── Name ──
    document.getElementById('insp-name').textContent = slotData.name;

    // ── Inline numeric vars (count / charges) next to the name ──
    const inlineEl = document.getElementById('insp-inline-vars');
    inlineEl.innerHTML = '';
    for (const [key, meta] of Object.entries(slotData.variables || {})) {
      if (meta.control !== 'plusminus' && meta.control !== 'both') continue;
      const canStep = true;
      const wrap = document.createElement('div');
      wrap.className = 'insp-inline-var';
      wrap.innerHTML = `
        <span class="insp-inline-label">${key}</span>
        <button class="insp-btn-sm" data-k="${key}" data-d="-1">−</button>
        <input class="insp-num-sm" type="number" value="${meta.value}" data-k="${key}"
          ${typeof meta.min === 'number' ? `min="${meta.min}"` : ''}
          ${typeof meta.max === 'number' ? `max="${meta.max}"` : ''} />
        <button class="insp-btn-sm" data-k="${key}" data-d="1">+</button>
      `;
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
    const descP = document.getElementById('insp-desc');
    const descEdit = document.getElementById('insp-desc-edit');
    const notesEl = document.getElementById('insp-notes');
    if (slotData.custom) {
      descP.hidden = true; descEdit.hidden = false; notesEl.hidden = true;
      descEdit.value = slotData.description || '';
      descEdit.oninput = () => { slotData.description = descEdit.value; };
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
    costEl.hidden = !(lib && lib.cost);
    if (lib && lib.cost) costEl.textContent = lib.cost;

    // ── Remove ──
    const removeBtnEl = document.getElementById('insp-remove');
    removeBtnEl.hidden = !container;
    if (container) removeBtnEl.onclick = () => { clearSlot(container, r, c); };

    // ── Compact props row ──
    const propsEl = document.getElementById('insp-props');
    propsEl.innerHTML = '';

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

    // Container chip — custom items only
    if (slotData.custom) {
      const chip = document.createElement('button');
      chip.className = 'prop-chip' + (slotData.isContainer ? ' active' : '');
      chip.textContent = 'Container';
      chip.onclick = () => {
        if (slotData.isContainer) {
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
          slotData.isContainer = true;
          slotData.containerRows = slotData.containerRows || 2;
          if (!slotData.containerId) createLinkedContainer(slotData, container.id, r, c);
        }
        render(); showInspector(slotData, container, r, c);
      };
      propsEl.appendChild(chip);
    }

    // Weapon chip — custom items only
    if (slotData.custom) {
      const chip = document.createElement('button');
      chip.className = 'prop-chip' + (slotData.isWeapon ? ' active' : '');
      chip.textContent = 'Weapon';
      chip.onclick = () => {
        if (slotData.isWeapon) {
          slotData.isWeapon = false;
          delete slotData.variables.weapon;
          slotData.material = null;
        } else {
          slotData.isWeapon = true;
          slotData.variables = slotData.variables || {};
          if (!slotData.variables.weapon) {
            slotData.variables.weapon = { control: 'select', value: WEAPON_OPTIONS[0], options: WEAPON_OPTIONS };
          }
        }
        render(); showInspector(slotData, container, r, c);
      };
      propsEl.appendChild(chip);
    }

    // Material chips — all items
    [['silvered','Silvered'], ['mithral','Mithral'], ['adamantine','Adamantine']].forEach(([mat, label]) => {
      const btn = document.createElement('button');
      const isActive = slotData.material === mat;
      btn.className = 'prop-chip' + (isActive ? ` active-${mat}` : '');
      btn.textContent = label;
      btn.onclick = () => {
        slotData.material = slotData.material === mat ? null : mat;
        render(); showInspector(slotData, container, r, c, packIdx);
      };
      propsEl.appendChild(btn);
    });

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

    // Weapon select dropdown — items with a weapon variable
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
      sel.addEventListener('change', () => { slotData.variables.weapon.value = sel.value; render(); });
      propsEl.appendChild(sel);
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
      // Numeric → shown inline; weapon select → shown in props row
      if (meta.control === 'plusminus' || meta.control === 'both') continue;
      if (key === 'weapon' && meta.control === 'select') continue;

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
    document.getElementById('insp-toggle').textContent = '∧';
  }

  function hideInspector() {
    inspectorEl.classList.add('inspector-collapsed');
    document.getElementById('insp-toggle').textContent = '∨';
    document.getElementById('insp-name').textContent = '';
  }

  document.getElementById('insp-toggle').addEventListener('click', () => {
    const collapsed = inspectorEl.classList.toggle('inspector-collapsed');
    document.getElementById('insp-toggle').textContent = collapsed ? '∨' : '∧';
  });

  document.addEventListener('pointerdown', e => {
    if (!inspectorEl.classList.contains('inspector-collapsed')
        && !inspectorEl.contains(e.target)
        && !e.target.closest('.slot')
        && !e.target.closest('.shop-item-row')) {
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
    dragScrollVel = 0;
    dragScrollRaf = null;

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

      // Commit: remove item from source now that we know the drop is valid
      removeFromSource();

      if (targetItem) {
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
    showShopItem(slotData) {
      // Show inspector in read-only mode (no container context)
      showInspector(slotData, null, -1, -1);
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
  let inv                = null;

  // ── INVENTORY SYSTEM ────────────────────────────────────────────────────
  inv = window.InventorySystem({
    database: null,
    auth: { onAuthStateChanged: () => {} },
    onChange:         handleInventoryChange,
    onCrossCharDrop:  handleCrossCharDrop,
  });

  // ── CLOSE / LOGOUT ──────────────────────────────────────────────────────
  document.getElementById('inv-close-btn').addEventListener('click', () => {
    window.parent.postMessage({ type: 'closeInventory' }, '*');
  });

  // Receive sign-in credentials forwarded from the parent page
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'signIn' && !auth.currentUser) {
      auth.signInWithEmailAndPassword(e.data.email, e.data.password)
        .catch(() => {});
    }
  });

  // ── SHOP ────────────────────────────────────────────────────────────────
  let shopOpen = false;
  const shopTabBtn  = document.getElementById('shop-tab-btn');
  const shopPanel   = document.getElementById('shop-panel');
  const invScrollEl = document.getElementById('inv-scroll');
  const charHeaderEl= document.getElementById('char-header');

  function buildShop() {
    const scroll = document.getElementById('shop-scroll');
    scroll.innerHTML = '';
    let currentSection = null;
    const HIDDEN_SECTIONS = new Set(['Valuables', 'Currency']);
    const visibleSections = [];

    ITEM_LIBRARY.forEach(item => {
      if (item._section) {
        currentSection = item._section;
        if (HIDDEN_SECTIONS.has(currentSection)) return;
        visibleSections.push(currentSection);
        const h = document.createElement('div');
        h.className = 'shop-section-heading';
        h.textContent = item._section;
        scroll.appendChild(h);
        return;
      }
      if (!item.name) return;
      if (HIDDEN_SECTIONS.has(currentSection)) return;

      const row = document.createElement('div');
      row.className = 'shop-item-row';
      row.dataset.section = currentSection;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'shop-item-name';
      nameSpan.textContent = item.name;

      const costSpan = document.createElement('span');
      costSpan.className = 'shop-item-cost';
      costSpan.textContent = item.cost || '';

      row.appendChild(nameSpan);
      row.appendChild(costSpan);

      // Tap → show in inspector (read-only)
      row.addEventListener('click', e => {
        if (row._shopDragging) return;
        const slotData = buildShopSlotData(item);
        inv.showShopItem(slotData);
      });

      // Long-press → drag to character tab
      let lpTimer = null, lpX, lpY, lpPointerId;
      row.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        lpX = e.clientX; lpY = e.clientY; lpPointerId = e.pointerId;
        lpTimer = setTimeout(() => {
          lpTimer = null;
          row._shopDragging = true;
          row.classList.add('shop-item-dragging');
          document.documentElement.setPointerCapture(lpPointerId);
          inv.startShopDrag(buildShopSlotData(item), e.clientX, e.clientY);
        }, 380);
      });
      row.addEventListener('pointermove', e => {
        if (!lpTimer) return;
        if ((e.clientX - lpX) ** 2 + (e.clientY - lpY) ** 2 > 64) {
          clearTimeout(lpTimer); lpTimer = null;
        }
      });
      const cancelLP = () => {
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        row._shopDragging = false;
        row.classList.remove('shop-item-dragging');
      };
      row.addEventListener('pointerup',     cancelLP);
      row.addEventListener('pointercancel', cancelLP);

      scroll.appendChild(row);
    });

    // Populate category dropdown
    const categorySelect = document.getElementById('shop-category');
    const prevVal = categorySelect.value;
    categorySelect.innerHTML = '<option value="">All categories</option>';
    visibleSections.forEach(section => {
      const opt = document.createElement('option');
      opt.value = section;
      opt.textContent = section;
      if (section === prevVal) opt.selected = true;
      categorySelect.appendChild(opt);
    });
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
      const nameMatch = !query || row.querySelector('.shop-item-name').textContent.toLowerCase().includes(query);
      const catMatch  = !category || row.dataset.section === category;
      row.hidden = !(nameMatch && catMatch);
    });
    // Hide section headings whose items are all filtered out
    scroll.querySelectorAll('.shop-section-heading').forEach(heading => {
      let next = heading.nextElementSibling;
      let hasVisible = false;
      while (next && !next.classList.contains('shop-section-heading')) {
        if (!next.hidden && next.classList.contains('shop-item-row')) { hasVisible = true; break; }
        next = next.nextElementSibling;
      }
      heading.hidden = !hasVisible;
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
      database.ref(`/inventory_roles/${user.uid}`).once('value', snap => {
        applyRole(snap.val() || 'player');
      });
      subscribeToChars();
    } else {
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
          try { inv.loadState(allChars[currentCharId].state); } catch (e) { console.warn('loadState error:', e); }
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
    try { inv.loadState(blank); } catch (e) { console.warn('loadState error:', e); }
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

  function handleCrossCharDrop(item, targetCharId, linkedContainer) {
    if (!targetCharId || !allChars[targetCharId]) return;

    // Strip the shop marker before storing
    const cleanItem = Object.assign({}, item);
    delete cleanItem._shopItem;

    // Shop drop onto the currently-open character
    if (targetCharId === currentCharId) {
      if (item._shopItem) {
        inv.addItem(cleanItem);
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
