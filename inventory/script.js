window.InventorySystem = ({ database, auth, onChange, onCrossCharDrop, onShopPurchase, isHiddenFromPlayer, onSound }) => {

  // ── STATE ──────────────────────────────────────────────────────────────
  function createDefaultContainers() {
    return [
      { id: 'equipped', name: 'Equipped',      rows: 1, collapsed: false, permanent: true, slots: [[null,null]] },
      { id: 'strapped', name: 'Strapped Gear', rows: 2, collapsed: false, permanent: true, slots: [[null,null],[null,null]] },
    ];
  }

  const CS_FIELDS = [
    ['cs-class','charClass'],['cs-subclass','subclass'],['cs-race','race'],['cs-level','level'],
    ['cs-str','str'],['cs-dex','dex'],['cs-con','con'],['cs-int','int'],['cs-wis','wis'],['cs-cha','cha'],
    ['cs-str-save','strSave'],['cs-dex-save','dexSave'],['cs-con-save','conSave'],
    ['cs-int-save','intSave'],['cs-wis-save','wisSave'],['cs-cha-save','chaSave'],
    ['cs-athletics','athletics'],
    ['cs-acrobatics','acrobatics'],['cs-sleight-of-hand','sleightOfHand'],['cs-stealth','stealth'],
    ['cs-arcana','arcana'],['cs-history','history'],['cs-investigation','investigation'],
    ['cs-nature','nature'],['cs-religion','religion'],
    ['cs-animal-handling','animalHandling'],['cs-insight','insight'],['cs-medicine','medicine'],
    ['cs-perception','perception'],['cs-survival','survival'],
    ['cs-deception','deception'],['cs-intimidation','intimidation'],
    ['cs-performance','performance'],['cs-persuasion','persuasion'],
    ['cs-hp','hp'],['cs-hp-max','hpMax'],['cs-ac','ac'],['cs-temp-hp','tempHp'],
    ['cs-hit-dice-remaining','hitDiceRemaining'],['cs-hit-dice-count','hitDiceCount'],['cs-hit-dice-type','hitDiceType'],
    ['cs-speed','speed'],['cs-initiative','initiative'],
    ['cs-proficiency','proficiency'],
    ['cs-languages','languages'],['cs-tools-prof','toolsProf'],
    ['cs-weapons-prof','weaponsProf'],['cs-armor-prof','armorProf'],
  ];

  const CLASS_HIT_DIE = {
    artificer:8, barbarian:12, bard:8, cleric:8, druid:8,
    fighter:10, monk:8, paladin:10, ranger:10, rogue:8,
    sorcerer:6, warlock:8, wizard:6,
  };

  const CLASS_SAVE_PROFS = {
    artificer:  ['con','int'],
    barbarian:  ['str','con'],
    bard:       ['dex','cha'],
    cleric:     ['wis','cha'],
    druid:      ['int','wis'],
    fighter:    ['str','con'],
    monk:       ['str','dex'],
    paladin:    ['wis','cha'],
    ranger:     ['str','dex'],
    rogue:      ['dex','int'],
    sorcerer:   ['con','cha'],
    warlock:    ['wis','cha'],
    wizard:     ['int','wis'],
  };

  const CS_ID_MAP = Object.fromEntries(CS_FIELDS.map(([id, k]) => [k, id]));

  const PROF_KEYS = [
    'strSaveProf','dexSaveProf','conSaveProf','intSaveProf','wisSaveProf','chaSaveProf',
    'athleticsProf','acrobaticsProf','sleightOfHandProf','stealthProf',
    'arcanaProf','historyProf','investigationProf','natureProf','religionProf',
    'animalHandlingProf','insightProf','medicineProf','perceptionProf','survivalProf',
    'deceptionProf','intimidationProf','performanceProf','persuasionProf',
  ];

  const SKILL_AB = {
    athletics:'str',
    acrobatics:'dex', sleightOfHand:'dex', stealth:'dex',
    arcana:'int', history:'int', investigation:'int', nature:'int', religion:'int',
    animalHandling:'wis', insight:'wis', medicine:'wis', perception:'wis', survival:'wis',
    deception:'cha', intimidation:'cha', performance:'cha', persuasion:'cha',
  };

  const EXPERTISE_SKILL_NAMES = {
    athletics:'Athletics', acrobatics:'Acrobatics', sleightOfHand:'Sleight of Hand', stealth:'Stealth',
    arcana:'Arcana', history:'History', investigation:'Investigation', nature:'Nature', religion:'Religion',
    animalHandling:'Animal Handling', insight:'Insight', medicine:'Medicine', perception:'Perception', survival:'Survival',
    deception:'Deception', intimidation:'Intimidation', performance:'Performance', persuasion:'Persuasion',
  };

  const FEAT_ABILITY_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

  const FEAT_OPTIONS = [
    { id: 'ability-score-improvement', name: 'Ability Score Improvement' },
    { id: 'dual-wielder',              name: 'Dual Wielder' },
    { id: 'shield-master',             name: 'Shield Master' },
    { id: 'tough',                     name: 'Tough' },
  ];

  const SAVE_AB = {
    strSave:'str', dexSave:'dex', conSave:'con', intSave:'int', wisSave:'wis', chaSave:'cha',
  };

  function evalMath(str) {
    const s = String(str).trim();
    if (!s) return null;
    if (!/^[0-9+\-*/(). ]+$/.test(s)) return null;
    try {
      const result = Function('"use strict"; return (' + s + ')')();
      if (typeof result !== 'number' || !isFinite(result)) return null;
      return Math.round(result);
    } catch { return null; }
  }

  // base AC and dex-cap for standard armor (keys match item names in items.js)
  const ARMOR_AC_TABLE = {
    'Padded Armor':          { base: 11, dexCap: Infinity },
    'Leather Armor':         { base: 11, dexCap: Infinity },
    'Studded Leather Armor': { base: 12, dexCap: Infinity },
    'Hide Armor':            { base: 12, dexCap: 2 },
    'Chain Shirt':           { base: 13, dexCap: 2 },
    'Scale Mail':            { base: 14, dexCap: 2 },
    'Breastplate':           { base: 14, dexCap: 2 },
    'Half Plate':            { base: 15, dexCap: 2 },
    'Ring Mail':             { base: 14, dexCap: 0 },
    'Chain Mail':            { base: 16, dexCap: 0 },
    'Splint Armor':          { base: 17, dexCap: 0 },
    'Full Plate':            { base: 18, dexCap: 0 },
  };

  function calcArmorAC(armorName, dexMod) {
    const dex = typeof dexMod === 'number' && isFinite(dexMod) ? dexMod : 0;
    // Direct match first, then substring match for magical armor (e.g. "Dredge Chain Mail")
    let entry = ARMOR_AC_TABLE[armorName];
    if (!entry) {
      for (const [key, val] of Object.entries(ARMOR_AC_TABLE)) {
        if (armorName.includes(key)) { entry = val; break; }
      }
    }
    if (!entry) return null;
    return entry.base + Math.min(dex, entry.dexCap);
  }

  function abilityMod(score) {
    const n = parseInt(score);
    if (isNaN(n)) return '—';
    const mod = Math.floor((n - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  function fmtMod(n) { return n >= 0 ? `+${n}` : `${n}`; }

  const _csDefaults = Object.fromEntries(CS_FIELDS.map(([, k]) => [k, '']));
  const _profDefaults = Object.fromEntries(PROF_KEYS.map(k => [k, false]));
  const state = {
    charName: '', carryCapacity: '', containers: createDefaultContainers(),
    ..._csDefaults, ..._profDefaults,
    attacks: [],
    attackOrder: [],
    weaponAttackData: {},
    equippedArmor: '',
    armorActive: true,
    equippedShield: '',
    shieldActive: false,
    inspiration: false,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    subrace:          '',
    activeFeatures:   [],
    hiddenFeatures:   [],
    featureData:      {},
    featureCollapsed: {},
  };

  function updateProfButtons() {
    document.querySelectorAll('.cs-skill-dot[data-prof-key]').forEach(btn => {
      const key = btn.dataset.profKey;
      const proficient = !!state[key];
      btn.classList.toggle('cs-proficient', proficient);
      const isSave = btn.closest('.cs-save') !== null;
      btn.textContent = isSave ? (proficient ? '■' : '□') : (proficient ? '●' : '○');
    });
  }

  function updateCsCalculations() {
    const level = parseInt(state.level);
    const classKey = String(state.charClass || '').toLowerCase().trim();
    const dieSides = CLASS_HIT_DIE[classKey] || null;

    // Proficiency bonus: auto from level (2024 5e: ceil(level/4)+1), or manual
    const profAuto = !isNaN(level) && level >= 1 ? Math.ceil(level / 4) + 1 : null;
    const prof = (state.proficiency === '' || state.proficiency == null) && profAuto !== null
      ? profAuto : (parseInt(state.proficiency) || 0);

    const mods = {};
    ['str','dex','con','int','wis','cha'].forEach(ab => {
      const n = parseInt(state[ab]);
      mods[ab] = isNaN(n) ? null : Math.floor((n - 10) / 2);
    });

    function applyAuto(id, stateKey, autoVal, rawNum) {
      const el = document.getElementById(id);
      if (!el) return;
      const v = state[stateKey];
      const isAuto = (v === '' || v == null) && autoVal !== null;
      el.classList.toggle('cs-auto', isAuto);
      if (document.activeElement === el) return;
      if (isAuto) el.value = rawNum ? String(autoVal) : fmtMod(autoVal);
      else el.value = v || '';
    }

    const exhPenalty = state.exhaustion || 0;

    Object.entries(SAVE_AB).forEach(([saveKey, ab]) => {
      const mod = mods[ab];
      const base = mod !== null ? mod + (state[saveKey + 'Prof'] ? prof : 0) : null;
      const auto = base !== null ? base - exhPenalty : null;
      applyAuto(CS_ID_MAP[saveKey], saveKey, auto);
      const el = document.getElementById(CS_ID_MAP[saveKey]);
      if (el) el.classList.toggle('cs-exh-penalty', exhPenalty > 0 && mod !== null);
    });

    const expertiseSkills = new Set();
    (state.activeFeatures || []).forEach(fid => {
      const feat = FEATURES_LIBRARY.find(f => f.id === fid);
      if (feat?.type === 'expertise') {
        ((state.featureData[fid] || {}).slots || []).forEach(s => { if (s) expertiseSkills.add(s); });
      }
    });

    Object.entries(SKILL_AB).forEach(([skill, ab]) => {
      const mod = mods[ab];
      const hasProficiency = !!state[skill + 'Prof'];
      const profMult = hasProficiency && expertiseSkills.has(skill) ? 2 : 1;
      const base = mod !== null ? mod + (hasProficiency ? prof * profMult : 0) : null;
      const auto = base !== null ? base - exhPenalty : null;
      applyAuto(CS_ID_MAP[skill], skill, auto);
      const el = document.getElementById(CS_ID_MAP[skill]);
      if (el) el.classList.toggle('cs-exh-penalty', exhPenalty > 0 && mod !== null);
    });

    [
      { id: 'cs-passive-perc',       skill: 'perception', ab: 'wis' },
      { id: 'cs-passive-insight',    skill: 'insight',    ab: 'wis' },
      { id: 'cs-passive-deception',  skill: 'deception',  ab: 'cha' },
      { id: 'cs-passive-stealth',    skill: 'stealth',    ab: 'dex' },
    ].forEach(({ id, skill, ab }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const mod = mods[ab];
      const _hasProficiency = !!state[skill + 'Prof'];
      const _profMult = _hasProficiency && expertiseSkills.has(skill) ? 2 : 1;
      const autoSkill = mod !== null ? mod + (_hasProficiency ? prof * _profMult : 0) : null;
      const effectiveSkill = (state[skill] === '' || state[skill] == null)
        ? autoSkill
        : parseInt(state[skill]);
      el.textContent = (effectiveSkill !== null && !isNaN(effectiveSkill))
        ? String(10 + effectiveSkill - exhPenalty)
        : '—';
      el.classList.toggle('cs-exh-penalty', exhPenalty > 0 && mod !== null);
    });

    // Initiative = DEX modifier
    const initiativeAuto = mods['dex'] !== null ? mods['dex'] : null;
    applyAuto('cs-initiative', 'initiative', initiativeAuto);

    // Carry capacity = STR + 4
    const strScore = parseInt(state.str);
    const carryAutoVal = !isNaN(strScore) ? strScore : null;
    const carryEl = document.getElementById('char-carry');
    if (carryEl && document.activeElement !== carryEl) {
      const isCarryAuto = (state.carryCapacity === '' || state.carryCapacity == null) && carryAutoVal !== null;
      carryEl.classList.toggle('cs-auto', isCarryAuto);
      if (isCarryAuto) carryEl.value = String(carryAutoVal);
      else carryEl.value = state.carryCapacity || '';
    }

    // Proficiency bonus display
    applyAuto('cs-proficiency', 'proficiency', profAuto);

    // Hit die type from class
    const dieTypeAuto = dieSides ? `d${dieSides}` : null;
    applyAuto('cs-hit-dice-type', 'hitDiceType', dieTypeAuto, true);

    // Hit dice count = level (+ bonus dice from Path of the Cursed features)
    const bonusHitDice = (state.activeFeatures.includes('cursed-dark-well') ? 1 : 0)
      + (state.activeFeatures.includes('cursed-curses-claim') ? 1 : 0);
    const hitDiceCountAuto = !isNaN(level) && level >= 1 ? level + bonusHitDice : null;
    applyAuto('cs-hit-dice-count', 'hitDiceCount', hitDiceCountAuto, true);

    // effectiveMax used only for display label — remaining is always user-controlled
    const effectiveMax = (state.hitDiceCount === '' || state.hitDiceCount == null) && hitDiceCountAuto !== null
      ? hitDiceCountAuto : parseInt(state.hitDiceCount);

    // Hit dice display label (non-edit mode: shows max+type only, e.g. "6d8")
    const dispEl = document.getElementById('cs-hit-dice-display');
    if (dispEl) {
      const maxD = !isNaN(effectiveMax) ? effectiveMax : '—';
      const type = (state.hitDiceType === '' || state.hitDiceType == null) ? (dieTypeAuto || '') : state.hitDiceType;
      dispEl.textContent = `${maxD}${type}`;
    }

    // HP max: level 1 = max die + con; each subsequent = ceil((die+1)/2) + con
    let hpMaxAuto = null;
    if (dieSides && !isNaN(level) && level >= 1) {
      const conMod = mods.con !== null ? mods.con : 0;
      const avgDie = Math.ceil((dieSides + 1) / 2);
      hpMaxAuto = dieSides + conMod + (level - 1) * (avgDie + conMod);
    }
    // Tough feat: +2 HP per level, tracked as a delta so manual edits stay consistent
    let toughHpBonus = 0;
    if (!isNaN(level) && level >= 1) {
      state.activeFeatures.forEach(fid => {
        const feat = FEATURES_LIBRARY.find(f => f.id === fid && f.type === 'feat');
        if (!feat) return;
        const fd = state.featureData[fid];
        if (!fd || fd.feat !== 'tough') return;
        const expected = 2 * level;
        const applied = fd.toughBonus || 0;
        toughHpBonus += expected;
        if (expected !== applied) {
          fd.toughBonus = expected;
          if (state.hpMax !== '' && state.hpMax != null) {
            state.hpMax = String(Math.max(0, (parseInt(state.hpMax) || 0) + (expected - applied)));
          }
        }
      });
    }
    if (hpMaxAuto !== null) hpMaxAuto += toughHpBonus;
    applyAuto('cs-hp-max', 'hpMax', hpMaxAuto, true);

    // HP low-health tint
    const hpEl = document.getElementById('cs-hp');
    const hpContainer = hpEl && hpEl.closest('.cs-stat-big');
    if (hpContainer) {
      const hpVal = parseInt(state.hp);
      const hpMax = (state.hpMax === '' || state.hpMax == null) && hpMaxAuto !== null
        ? hpMaxAuto : parseInt(state.hpMax);
      const isLow = !isNaN(hpVal) && !isNaN(hpMax) && hpMax > 0 && hpVal <= hpMax / 2;
      hpContainer.classList.toggle('cs-hp-low', isLow);
    }

    // AC auto-calculation: armor-based or unarmored (10 + Dex [+ Con w/ Unarmored
    // Defense]), plus shield
    const acEl = document.getElementById('cs-ac');
    const acStatEl = acEl && acEl.closest('.cs-ac-stat');
    const armorInactive = state.equippedArmor && !state.armorActive;
    const shieldInactive = state.equippedShield && !state.shieldActive;
    if (acStatEl) acStatEl.classList.toggle('cs-ac-inactive', !!(armorInactive || shieldInactive));
    if (acEl && document.activeElement !== acEl && (state.ac === '' || state.ac == null)) {
      const dexMod = mods.dex !== null ? mods.dex : 0;
      const conMod = mods.con !== null ? mods.con : 0;
      const shieldBonus = (state.equippedShield && state.shieldActive) ? 2 : 0;
      const useArmor = state.equippedArmor && state.armorActive;
      // Unarmored Defense (Barbarian): 10 + Dex + Con while not wearing armor.
      const unarmoredBonus = state.activeFeatures.includes('barbarian-unarmored-defense') ? conMod : 0;
      const baseAC = useArmor ? calcArmorAC(state.equippedArmor, dexMod) : 10 + dexMod + unarmoredBonus;
      const autoAC = baseAC !== null ? baseAC + shieldBonus : null;
      if (autoAC !== null && !isNaN(autoAC)) {
        acEl.value = String(autoAC);
        acEl.classList.add('cs-auto');
      }
    } else if (acEl && state.ac !== '' && state.ac != null) {
      acEl.classList.remove('cs-auto');
    }

    // Speed: default 30ft, every 2 exhaustion levels = -5ft
    // Let Evil Take Hold (Path of the Cursed) adds +10ft while raging.
    const speedEl = document.getElementById('cs-speed');
    if (speedEl && document.activeElement !== speedEl) {
      const isEmpty = state.speed === '' || state.speed == null;
      const baseSpeed = isEmpty ? 30 : parseInt(state.speed);
      const speedPenalty = Math.floor(exhPenalty / 2) * 5;
      const ragingSpeedBonus = (isRaging() && state.activeFeatures.includes('cursed-let-evil-take-hold')) ? 10 : 0;
      if (!isNaN(baseSpeed)) {
        speedEl.value = String(Math.max(0, baseSpeed - speedPenalty + ragingSpeedBonus));
        speedEl.classList.toggle('cs-auto', isEmpty || speedPenalty > 0 || ragingSpeedBonus > 0);
        speedEl.classList.toggle('cs-exh-penalty', speedPenalty > 0);
        speedEl.classList.toggle('cs-rage-boost', ragingSpeedBonus > 0);
      } else {
        speedEl.value = state.speed || '';
        speedEl.classList.remove('cs-auto', 'cs-exh-penalty', 'cs-rage-boost');
      }
    }

    renderAttacks();
  }

  function updateCsNameDisplay() {
    const el = document.getElementById('cs-char-name-display');
    if (el) el.textContent = state.charName || '—';
  }

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
    const strScore = parseInt(state.str);
    const carryAutoVal = !isNaN(strScore) ? strScore : null;
    const isCarryAuto = (state.carryCapacity === '' || state.carryCapacity == null) && carryAutoVal !== null;
    const max  = isCarryAuto ? carryAutoVal : parseInt(state.carryCapacity);
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
      const displayMax = !isNaN(max) ? String(max) : '—';
      compact.appendChild(document.createTextNode(` ${used}/${displayMax}`));
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
  const detailPanelEl = document.getElementById('detail-panel');

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

  function growStrapped() {
    const strapped = state.containers.find(c => c.id === 'strapped');
    if (!strapped) return;
    const hasEmptyRow = strapped.slots.some(row => row[0] === null && row[1] === null);
    if (!hasEmptyRow) {
      strapped.slots.push([null, null]);
      strapped.rows++;
    }
  }

  function shrinkStrapped() {
    const strapped = state.containers.find(c => c.id === 'strapped');
    if (!strapped) return;
    while (strapped.slots.length > 1) {
      const last = strapped.slots[strapped.slots.length - 1];
      const prev = strapped.slots[strapped.slots.length - 2];
      if (last[0] === null && last[1] === null && prev[0] === null && prev[1] === null) {
        strapped.slots.pop();
        strapped.rows--;
      } else {
        break;
      }
    }
  }

  function growContainer(container) {
    if (!container.maxRows) container.maxRows = container.rows;
    const hasEmptyRow = container.slots.some(row => row[0] === null && row[1] === null);
    if (!hasEmptyRow) {
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
    growStrapped();
    shrinkStrapped();
    state.containers.forEach(c => {
      if (c.linkedTo) { growContainer(c); shrinkContainer(c); }
    });
    containersEl.innerHTML = '';
    state.containers.forEach(c => containersEl.appendChild(buildCard(c)));
    updateCurrencyDisplay();
    updateCarryDisplay();

    // Refresh inspector name if panel is open for an inventory slot
    if (inspectorItemKey && !inspectorItemKey.startsWith('shop-')
        && !detailPanelEl.classList.contains('detail-collapsed')) {
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

    populateArmorDatalist();
    populateShieldDatalist();
    syncEquippedContainer();
    renderAttacks();
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
      const _fillCap  = 4;
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
      const isInspected = inspectorItemKey === itemKey && !detailPanelEl.classList.contains('detail-collapsed');

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

  ['inv-scroll', 'stats-panel', 'shop-scroll'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('scroll', () => { if (!dropdownEl.hidden) positionDropdown(); }, { passive: true });
  });

  // ── INSPECTOR ────────────────────────────────────────────────────────────
  function showInspector(slotData, container, r, c, packIdx) {
    _spellDetailActive = null;
    document.getElementById('spell-insp-section').hidden = true;
    inspectorEl.hidden = false;
    const _panelOpen = !detailPanelEl.classList.contains('detail-collapsed');
    const _prevH = _panelOpen ? detailPanelEl.offsetHeight : 0;
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
        if (!btn.dataset.k) return;
        const m = slotData.variables[btn.dataset.k];
        if (!m) return;
        let v = m.value + parseInt(btn.dataset.d);
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        inlineEl.querySelector(`.insp-num-sm[data-k="${btn.dataset.k}"]`).value = v;
        render();
        refreshCostDisplay();
        if (!container) refreshShopRow();
      });
    });
    inlineEl.querySelectorAll('.insp-num-sm').forEach(inp => {
      inp.addEventListener('input', () => {
        if (!inp.dataset.k) return;
        const m = slotData.variables[inp.dataset.k];
        if (!m) return;
        let v = parseInt(inp.value);
        if (isNaN(v)) return;
        if (typeof m.min === 'number') v = Math.max(m.min, v);
        if (typeof m.max === 'number') v = Math.min(m.max, v);
        m.value = v;
        render();
        refreshCostDisplay();
        if (!container) refreshShopRow();
      });
      inp.addEventListener('blur', () => {
        if (!inp.dataset.k) return;
        const m = slotData.variables[inp.dataset.k];
        if (m) inp.value = m.value;
      });
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
        showInspector(slotData, container, r, c);
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
        showInspector(slotData, container, r, c);
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

    detailPanelEl.classList.remove('no-transition', 'detail-collapsed');
    if (_prevH) {
      detailPanelEl.style.height = _prevH + 'px';
      requestAnimationFrame(() => { detailPanelEl.style.height = detailPanelEl.scrollHeight + 'px'; });
    }
  }

  function refreshInspectorCollapsed() {
    if (inspectorItemKey === null) {
      detailPanelEl.classList.add('detail-collapsed');
    }
  }

  function hideInspector(force) {
    if (!force) {
      if (document.querySelector('#insp-props .insp-select.flash-required')) return;
      if (document.querySelector('#insp-props .chip-flash-required')) return;
    }
    inspectorItemKey = null;
    _customEditKey = null; _customEditOpen = false;
    _spellDetailActive = null;
    _metamagicDetailActive = null;
    document.getElementById('spell-insp-section').hidden = true;
    inspectorEl.hidden = false;
    refreshInspectorCollapsed();
  }

  function toggleInspectorFor(key, slotData, container, r, c) {
    if (inspectorItemKey === key && !detailPanelEl.classList.contains('detail-collapsed')) {
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
    const panelOpen = !detailPanelEl.classList.contains('detail-collapsed');
    const outsidePanel = !detailPanelEl.contains(e.target)
        && !e.target.closest('.slot')
        && !e.target.closest('.shop-item-row')
        && !e.target.closest('.char-tab')
        && !e.target.closest('#inv-close-btn')
        && !e.target.closest('#shop-tab-btn')
        && !e.target.closest('#cs-armor-display')
        && !e.target.closest('#cs-shield-display')
        && !e.target.closest('.cs-attack-weapon-name')
        && !e.target.closest('.cs-spell-link');
    if (panelOpen && outsidePanel) {
      if (_spellDetailActive) closeSpellDetail();
      else if (inspectorItemKey !== null) { hideInspector(); render(); }
    }
  });

  // ── CHARACTER FIELDS ──────────────────────────────────────────────────────
  document.getElementById('char-name').addEventListener('input', e => {
    state.charName = e.target.value;
    updateCsNameDisplay();
    if (onChange) onChange();
  });
  document.getElementById('char-carry').addEventListener('input', e => {
    state.carryCapacity = e.target.value;
    updateCarryDisplay();
  });

  CS_FIELDS.forEach(([id, k]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => updateCsCalculations());
    el.addEventListener('input', e => {
      state[k] = e.target.value;
      if (onChange) onChange();
      updateCsCalculations();
    });
  });

  // When the user focuses speed, restore the base speed so they edit the real value
  const _speedEl = document.getElementById('cs-speed');
  if (_speedEl) {
    _speedEl.addEventListener('focus', () => {
      _speedEl.value = state.speed || '';
      _speedEl.classList.remove('cs-auto');
    });
  }

  const CS_ID_TO_KEY = Object.fromEntries(CS_FIELDS.map(([id, k]) => [id, k]));
  ['cs-hp', 'cs-hp-max', 'cs-temp-hp', 'cs-hit-dice-remaining'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    function applyEval() {
      const result = evalMath(el.value);
      if (result !== null) {
        el.value = result;
        state[CS_ID_TO_KEY[id]] = String(result);
        updateCsCalculations();
        if (onChange) onChange();
      }
    }
    el.addEventListener('blur', applyEval);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { applyEval(); el.blur(); } });
  });

  // ── CALCULATOR OVERLAY (touch devices) ───────────────────────────────────
  (function () {
    const overlay   = document.getElementById('cs-calc-overlay');
    const backdrop  = document.getElementById('cs-calc-backdrop');
    const headerEl  = document.getElementById('cs-calc-header');
    const mainEl    = document.getElementById('cs-calc-main');
    const subEl     = document.getElementById('cs-calc-sub');
    if (!overlay) return;

    const CALC_FIELDS = {
      'cs-hp':                 'Current HP',
      'cs-temp-hp':            'Temp HP',
      'cs-hit-dice-remaining': 'Hit Dice',
    };

    let targetEl = null;
    let baseVal  = 0;
    let op       = '';   // '+' | '-' | ''
    let numStr   = '';

    function renderDisplay() {
      if (!op) {
        mainEl.textContent = numStr || String(baseVal);
        subEl.textContent  = '';
      } else {
        const sym = op === '-' ? '−' : '+';
        mainEl.textContent = `${baseVal} ${sym} ${numStr || '_'}`;
        if (numStr) {
          const res = Math.max(0, op === '-' ? baseVal - parseInt(numStr) : baseVal + parseInt(numStr));
          subEl.textContent = `= ${res}`;
        } else {
          subEl.textContent = '';
        }
      }
    }

    function show(el) {
      if (document.getElementById('stats-panel')?.classList.contains('char-view-only')) return;
      targetEl = el;
      baseVal  = parseInt(el.value) || 0;
      op       = '';
      numStr   = '';
      headerEl.textContent = CALC_FIELDS[el.id] || '';
      renderDisplay();
      overlay.classList.add('cs-calc-open');
      backdrop.classList.add('cs-calc-open');
      el.readOnly = true;
      window._navCalc.open = true;
      history.pushState({ overlay: 'calculator' }, '');
    }

    function hide() {
      if (window._navCalc.open) {
        window._navCalc.open = false;
        if (!window._navCalc.handling) {
          window._navCalc.suppress = true;
          history.back();
        }
      }
      overlay.classList.remove('cs-calc-open');
      backdrop.classList.remove('cs-calc-open');
      if (targetEl) { targetEl.readOnly = false; targetEl = null; }
      op = ''; numStr = '';
    }

    window._navCalc.hide = hide;

    function commit() {
      if (!targetEl) return;
      let result;
      if (!op) {
        result = numStr !== '' ? parseInt(numStr) : baseVal;
      } else {
        result = numStr !== ''
          ? (op === '-' ? baseVal - parseInt(numStr) : baseVal + parseInt(numStr))
          : baseVal;
      }
      result = Math.max(0, result);
      targetEl.value = String(result);
      state[CS_ID_TO_KEY[targetEl.id]] = String(result);
      updateCsCalculations();
      if (onChange) onChange();
      hide();
    }

    overlay.addEventListener('pointerdown', e => {
      const key = e.target.closest('[data-key]')?.dataset.key;
      if (!key) return;
      e.preventDefault();
      if (key === '=') {
        commit();
      } else if (key === 'back') {
        if (numStr)        numStr = numStr.slice(0, -1);
        else if (op)       op = '';
      } else if (key === 'clear') {
        op = ''; numStr = '';
      } else if (key === '+' || key === '-') {
        if (op && !numStr) { op = key; }
        else if (op && numStr) { commit(); return; }
        else { op = key; numStr = ''; }
      } else {
        numStr += key;
      }
      renderDisplay();
    });

    backdrop.addEventListener('pointerdown', () => hide());

    const CALC_IDS = Object.keys(CALC_FIELDS);
    CALC_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      // touchstart preventDefault stops the focus→keyboard chain on iOS
      el.addEventListener('touchstart', e => {
        e.preventDefault();
        el.readOnly = true;
      }, { passive: false });
      el.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse') {
          e.preventDefault();
          show(el);
        }
      });
    });
  })();

  // ── FEATURES ─────────────────────────────────────────────────────────────

  const METAMAGIC_OPTIONS = [
    { id: 'careful',    name: 'Careful Spell',    cost: '1 Sorcery Point',
      desc: 'When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell\'s full force. To do so, spend 1 Sorcery Point and choose a number of those creatures up to your Charisma modifier (minimum of one creature). A chosen creature automatically succeeds on its saving throw against the spell, and it takes no damage if it would normally take half damage on a successful save.' },
    { id: 'distant',    name: 'Distant Spell',    cost: '1 Sorcery Point',
      desc: 'When you cast a spell that has a range of at least 5 feet, you can spend 1 Sorcery Point to double the spell\'s range. Or when you cast a spell that has a range of Touch, you can spend 1 Sorcery Point to make the spell\'s range 30 feet.' },
    { id: 'empowered',  name: 'Empowered Spell',  cost: '1 Sorcery Point',
      desc: 'When you roll damage for a spell, you can spend 1 Sorcery Point to reroll a number of the damage dice up to your Charisma modifier (minimum of one), and you must use the new rolls.\nYou can use Empowered Spell even if you\'ve already used a different Metamagic option during the casting of the spell.' },
    { id: 'extended',   name: 'Extended Spell',   cost: '1 Sorcery Point',
      desc: 'When you cast a spell that has a duration of 1 minute or longer, you can spend 1 Sorcery Point to double its duration to a maximum duration of 24 hours.\nIf the affected spell requires Concentration, you have Advantage on any saving throw you make to maintain that Concentration.' },
    { id: 'heightened', name: 'Heightened Spell', cost: '2 Sorcery Points',
      desc: 'When you cast a spell that forces a creature to make a saving throw, you can spend 2 Sorcery Points to give one target of the spell Disadvantage on saves against the spell.' },
    { id: 'quickened',  name: 'Quickened Spell',  cost: '2 Sorcery Points',
      desc: 'When you cast a spell that has a casting time of an action, you can spend 2 Sorcery Points to change the casting time to a Bonus Action for this casting. You can\'t modify a spell in this way if you\'ve already cast a level 1+ spell on the current turn, nor can you cast a level 1+ spell on this turn after modifying a spell in this way.' },
    { id: 'seeking',    name: 'Seeking Spell',    cost: '1 Sorcery Point',
      desc: 'If you make an attack roll for a spell and miss, you can spend 1 Sorcery Point to reroll the d20, and you must use the new roll.\nYou can use Seeking Spell even if you\'ve already used a different Metamagic option during the casting of the spell.' },
    { id: 'subtle',     name: 'Subtle Spell',     cost: '1 Sorcery Point',
      desc: 'When you cast a spell, you can spend 1 Sorcery Point to cast it without any Verbal, Somatic, or Material components, except Material components that are consumed by the spell or that have a cost specified in the spell.' },
    { id: 'transmuted', name: 'Transmuted Spell', cost: '1 Sorcery Point',
      desc: 'When you cast a spell that deals a type of damage from the following list, you can spend 1 Sorcery Point to change that damage type to one of the other listed types: Acid, Cold, Fire, Lightning, Poison, Thunder.' },
    { id: 'twinned',    name: 'Twinned Spell',    cost: '1 Sorcery Point',
      desc: 'When you cast a spell, such as Charm Person, that can be cast with a higher-level spell slot to target an additional creature, you can spend 1 Sorcery Point to increase the spell\'s effective level by 1.' },
    { id: 'spell-strike', name: 'Spell Strike', cost: '2 Sorcery Points', subclassOnly: true,
      desc: 'When you attack a creature with a weapon attack from your magical conduit, you can cast a sorcerer spell or cantrip with a casting time of 1 action as a bonus action. If the attack hit and the spell targets the same creature, its first spell attack automatically hits.\nYou can\'t modify a spell in this way if you\'ve already cast a level 1+ spell on the current turn, nor can you cast a level 1+ spell on this turn after modifying a spell in this way.' },
  ];

  // Sorcerer spell slots by character level (levels 1–3)
  const SORC_SLOTS = {
     1: { 1: 2 },
     2: { 1: 3 },
     3: { 1: 4, 2: 2 },
     4: { 1: 4, 2: 3 },
     5: { 1: 4, 2: 3, 3: 2 },
     6: { 1: 4, 2: 3, 3: 3 },
     7: { 1: 4, 2: 3, 3: 3, 4: 1 },
     8: { 1: 4, 2: 3, 3: 3, 4: 2 },
     9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
    10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
    11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
    12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
    13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
    14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
    15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
    18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
    19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
    20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
  };

  const RANGER_SLOTS = {
     1: { 1: 2 },
     2: { 1: 2 },
     3: { 1: 3 },
     4: { 1: 3 },
     5: { 1: 4, 2: 2 },
     6: { 1: 4, 2: 2 },
     7: { 1: 4, 2: 3 },
     8: { 1: 4, 2: 3 },
     9: { 1: 4, 2: 3, 3: 2 },
    10: { 1: 4, 2: 3, 3: 2 },
    11: { 1: 4, 2: 3, 3: 3 },
    12: { 1: 4, 2: 3, 3: 3 },
    13: { 1: 4, 2: 3, 3: 3, 4: 1 },
    14: { 1: 4, 2: 3, 3: 3, 4: 1 },
    15: { 1: 4, 2: 3, 3: 3, 4: 2 },
    16: { 1: 4, 2: 3, 3: 3, 4: 2 },
    17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
    18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
    19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
    20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  };

  const FEATURES_LIBRARY = [
    {
      id: 'sorcerer-spellcasting',
      name: 'Spellcasting',
      class: 'Sorcerer',
      level: 1,
      type: 'spellcasting',
    },
    {
      id: 'ranger-spellcasting',
      name: 'Spellcasting',
      class: 'Ranger',
      level: 1,
      type: 'spellcasting',
    },
    {
      id: 'ranger-favored-enemy',
      name: 'Favored Enemy',
      class: 'Ranger',
      level: 1,
      type: 'text',
      description: [
        "You always have the Hunter's Mark spell prepared. You can cast it twice without expending a spell slot, and you regain all expended uses of this ability when you finish a Long Rest.",
        'The number of times you can cast the spell without a spell slot increases when you reach certain Ranger levels, as shown in the Favored Enemy column of the Ranger Features table.',
      ],
    },
    {
      id: 'ranger-weapon-mastery',
      name: 'Weapon Mastery',
      class: 'Ranger',
      level: 1,
      type: 'text',
      description: [
        'Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Longbows and Shortswords.',
        'Whenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could switch to using the mastery properties of Scimitars and Longswords.',
      ],
    },
    {
      id: 'ranger-deft-explorer',
      name: 'Deft Explorer',
      class: 'Ranger',
      level: 2,
      type: 'expertise',
      expertiseSlots: 1,
      description: [
        'Thanks to your travels, you gain the following benefits.',
        { boldIntro: 'Expertise.', text: 'Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill.' },
        { insertExpertiseDropdown: true },
        { boldIntro: 'Languages.', text: 'You know two languages of your choice.' },
      ],
    },
    {
      id: 'ranger-fighting-style',
      name: 'Fighting Style',
      class: 'Ranger',
      level: 2,
      type: 'fighting-style',
    },
    {
      id: 'ranger-extra-attack',
      name: 'Extra Attack',
      class: 'Ranger',
      level: 5,
      type: 'text',
      description: 'You can attack twice instead of once whenever you take the Attack action on your turn.',
    },
    {
      id: 'ranger-roving',
      name: 'Roving',
      class: 'Ranger',
      level: 6,
      type: 'text',
      description: "Your Speed increases by 10 feet while you aren't wearing Heavy armor. You also have a Climb Speed and a Swim Speed equal to your Speed.",
    },
    {
      id: 'witch-warden-occult-insight',
      name: 'Occult Insight',
      class: 'Ranger',
      subclass: 'Witch Warden',
      level: 3,
      type: 'text',
      description: "When you mark a creature with hunter's mark, the DM tells you something about its kind likely relevant. This could be its movement types and senses; its resistances, immunities, or vulnerabilities; or an action or ability it is likely to use (such as a breath weapon or spellcasting). You gain this information only the first time you mark a creature of a given kind until you cast the spell again.",
    },
    {
      id: 'witch-warden-witchmarks',
      name: 'Witchmarks',
      class: 'Ranger',
      subclass: 'Witch Warden',
      level: 3,
      type: 'text',
      description: [
        'You learn to inscribe occult sigils called witchmarks. When you finish a short or long rest, you can inscribe a number of witchmarks on yourself or your allies from the Witchmarks table up to your proficiency bonus. Each type of witchmark can be inscribed only once.',
        'A witchmark remains inscribed until it is used or you inscribe a new set of witchmarks.',
        { boldIntro: 'Witching Die.', text: 'Your witching die is a d6. At 6th level it becomes a d8.' },
        { witchingDie: true },
        { table: {
          title: 'Witchmarks',
          headers: ['Witchmark', 'Effect'],
          rows: [
            ['Wands',    'When the bearer casts a spell that requires a creature make a saving throw and they succeed, as a reaction the bearer can expend this witchmark to subtract the witching die from the result.'],
            ['Cups',     'When a creature hits the bearer with an attack roll, as a reaction they can expend this witchmark to subtract the witching die from that attack roll.'],
            ['Swords',   'When the bearer hits a creature with an attack, as a reaction they can expend this witchmark to deal additional damage equal to the witching die of any damage type of their choice.'],
            ['Pentacles','When the bearer fails a saving throw, as a reaction they can expend this witchmark to add the witching die to the roll.'],
          ],
        }},
      ],
    },
    {
      id: 'witch-warden-omen-tracker',
      name: 'Omen Tracker',
      class: 'Ranger',
      subclass: 'Witch Warden',
      level: 6,
      type: 'text',
      description: "You master hunting through omens and divination. When you uncover signs of a creature's presence (such as its tracks, a belonging, or remains) you can cast hunter's mark on that creature even if it is not within sight or range. Also, when your concentration on hunter's mark ends, the effect remains on the last creature marked for one week, but the mark cannot be moved to a new creature.",
    },
    {
      id: 'sorcerer-innate-sorcery',
      name: 'Innate Sorcery',
      class: 'Sorcerer',
      level: 1,
      type: 'text',
      description: [
        'An event in your past left an indelible mark on you, infusing you with simmering magic. As a Bonus Action, you can unleash that magic for 1 minute, during which you gain the following benefits:',
        { list: [
          'The spell save DC of your Sorcerer spells increases by 1.',
          'You have Advantage on the attack rolls of Sorcerer spells you cast.',
        ]},
        'You can use this feature twice, and you regain all expended uses of it when you finish a Long Rest.',
      ],
    },
    {
      id: 'sorcerer-font-of-magic',
      name: 'Font of Magic',
      class: 'Sorcerer',
      level: 2,
      type: 'sorcery-points',
      description: [
        'You have a number of Sorcery Points equal to your Sorcerer level. You can use your Sorcery Points to fuel the options below, along with other features, such as Metamagic, that use those points.',
        { boldIntro: 'Converting Spell Slots to Sorcery Points.', text: "You can expend a spell slot to gain a number of Sorcery Points equal to the slot's level (no action required)." },
        { boldIntro: 'Creating Spell Slots.', text: 'As a Bonus Action, you can transform unexpended Sorcery Points into one spell slot. The Creating Spell Slots table shows the cost of creating a spell slot of a given level, and it lists the minimum Sorcerer level you must be to create a slot. You can create a spell slot no higher than level 5.' },
        { indent: 'Any spell slot you create with this feature vanishes when you finish a Long Rest.' },
        { table: {
          title: 'Creating Spell Slots',
          headers: ['Spell Slot Level', 'Sorcery Point Cost', 'Min. Sorcerer Level'],
          rows: [['1','2','2'],['2','3','3'],['3','5','5'],['4','6','7'],['5','7','9']],
        }},
      ],
    },
    {
      id: 'sorcerer-sorcerous-restoration',
      name: 'Sorcerous Restoration',
      class: 'Sorcerer',
      level: 5,
      type: 'text',
      description: "When you finish a Short Rest, you can regain expended Sorcery Points, but no more than a number equal to half your Sorcerer level (round down). Once you use this feature, you can't do so again until you finish a Long Rest.",
    },
    {
      id: 'sorcerer-metamagic',
      name: 'Metamagic',
      class: 'Sorcerer',
      level: 2,
      type: 'metamagic',
      description: 'You can alter your spells with Metamagic.',
    },
    {
      id: 'spell-drinker-combat-mage',
      name: 'Combat Mage',
      class: 'Sorcerer',
      subclass: 'Spell Drinker',
      level: 3,
      type: 'text',
      description: 'You gain proficiency with light armor and medium armor. Also, you learn the true strike cantrip.',
    },
    {
      id: 'spell-drinker-magical-conduit',
      name: 'Magical Conduit',
      class: 'Sorcerer',
      subclass: 'Spell Drinker',
      level: 3,
      type: 'text',
      description: 'You can spend 1 hour in meditation with a melee weapon. When you do, you gain proficiency with that weapon and it becomes your spellcasting focus for sorcerer spells. This weapon is your magical conduit. You can change your conduit by repeating this process with a different weapon.',
    },
    {
      id: 'spell-drinker-draining-strike',
      name: 'Draining Strike',
      class: 'Sorcerer',
      subclass: 'Spell Drinker',
      level: 3,
      type: 'text',
      description: 'Once on your turn, when you hit a creature with a weapon attack from your magical conduit, you can deal the weapons damage as Necrotic damage. If you do, deal additional damage equal to your proficiency bonus, and gain temporary hit points equal twice your proficiency bonus for 1 minute.',
    },
    {
      id: 'frayed-base',
      name: 'Frayed',
      race: 'Frayed',
      type: 'frayed',
      description: [
        { boldIntro: 'Aberrant Mark.', text: 'Magic deformities warp your visage. You have the disfigured hindrance.' },
        { boldIntro: 'Child of Misfortune.', text: 'When you are reduced to 0 hit points, you gain Heroic Inspiration if you don\'t have it.' },
      ],
    },
    {
      id: 'human-determination',
      name: 'Human',
      race: 'Human',
      type: 'text',
      description: [
        { boldIntro: 'Skill Versatility.', text: 'You gain proficiency in two skills of your choice.' },
        { boldIntro: 'Human Determination.', text: 'When you finish a long rest, you gain Heroic Inspiration if you don\'t have it.' },
      ],
    },
    {
      id: 'spell-drinker-precision-syphon',
      name: 'Precision Syphon',
      class: 'Sorcerer',
      subclass: 'Spell Drinker',
      level: 6,
      type: 'text',
      description: 'The first weapon attack you make with your magical conduit each turn has advantage.',
    },
    {
      id: 'spell-drinker-metamagic',
      name: 'Spell Drinker Metamagic',
      class: 'Sorcerer',
      subclass: 'Spell Drinker',
      level: 6,
      type: 'text',
      description: [
        { para: [
          'You gain the ',
          { metamagicLink: 'spell-strike', text: 'spell strike' },
          ' metamagic.',
        ]},
      ],
    },
    {
      id: 'rogue-expertise',
      name: 'Expertise',
      class: 'Rogue',
      level: 1,
      type: 'expertise',
      expertiseSlots: 2,
      description: 'You gain Expertise in two of your skill proficiencies of your choice.',
    },
    {
      id: 'rogue-sneak-attack',
      name: 'Sneak Attack',
      class: 'Rogue',
      level: 1,
      type: 'text',
      description: [
        { sneakAttackDice: true },
        'You know how to strike subtly and exploit a foe\'s distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The extra damage\'s type is the same as the weapon\'s type.',
        'You don\'t need Advantage on the attack roll if at least one of your allies is within 5 feet of the target, the ally doesn\'t have the Incapacitated condition, and you don\'t have Disadvantage on the attack roll.',
        'The extra damage increases as you gain Rogue levels, as shown in the Sneak Attack column of the Rogue Features table.',
      ],
    },
    {
      id: 'rogue-thieves-cant',
      name: "Thieves' Cant",
      class: 'Rogue',
      level: 1,
      type: 'text',
      description: "You picked up various languages in the communities where you plied your roguish talents. You know Thieves' Cant and one other language of your choice, which you choose from the language tables in chapter 2.",
    },
    {
      id: 'rogue-weapon-mastery',
      name: 'Weapon Mastery',
      class: 'Rogue',
      level: 1,
      type: 'text',
      description: [
        'Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Daggers and Shortbows.',
        'Whenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could switch to using the mastery properties of Scimitars and Shortswords.',
      ],
    },
    {
      id: 'rogue-cunning-action',
      name: 'Cunning Action',
      class: 'Rogue',
      level: 2,
      type: 'text',
      description: 'On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.',
    },
    {
      id: 'rogue-steady-aim',
      name: 'Steady Aim',
      class: 'Rogue',
      level: 3,
      type: 'text',
      description: "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven't moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.",
    },
    {
      id: 'rogue-cunning-strike',
      name: 'Cunning Strike',
      class: 'Rogue',
      level: 5,
      type: 'text',
      description: [
        "You've developed cunning ways to use your Sneak Attack. When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects. Each effect has a die cost, which is the number of Sneak Attack damage dice you must forgo to add the effect. You remove the die before rolling, and the effect occurs immediately after the attack's damage is dealt. For example, if you add the Poison effect, remove 1d6 from the Sneak Attack's damage before rolling.",
        'If a Cunning Strike effect requires a saving throw, the DC equals 8 plus your Dexterity modifier and Proficiency Bonus.',
        { boldIntro: 'Poison (Cost: 1d6).', text: "You add a toxin to your strike, forcing the target to make a Constitution saving throw. On a failed save, the target has the Poisoned condition for 1 minute. At the end of each of its turns, the Poisoned target repeats the save, ending the effect on itself on a success. To use this effect, you must have a Poisoner's Kit on your person." },
        { boldIntro: 'Trip (Cost: 1d6).', text: 'If the target is Large or smaller, it must succeed on a Dexterity saving throw or have the Prone condition.' },
        { boldIntro: 'Withdraw (Cost: 1d6).', text: 'Immediately after the attack, you move up to half your Speed without provoking Opportunity Attacks.' },
      ],
    },
    {
      id: 'rogue-uncanny-dodge',
      name: 'Uncanny Dodge',
      class: 'Rogue',
      level: 5,
      type: 'text',
      description: "When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack's damage against you (round down).",
    },
    {
      id: 'rogue-expertise-2',
      name: 'Expertise',
      class: 'Rogue',
      level: 6,
      type: 'expertise',
      expertiseSlots: 2,
      description: 'You gain Expertise in two of your Skill Proficiencies of your choice.',
    },
    {
      id: 'vile-fang-fangs-dripping',
      name: 'Fangs Dripping',
      class: 'Rogue',
      subclass: 'Vile Fang',
      level: 3,
      type: 'text',
      description: [
        "You gain a poisoner's kit and proficiency with it.",
        { boldIntro: 'Brewing Poisons.', text: "When you use the poisoner's kit to craft a basic poison, instead make a number of antitoxin or basic poisons equal to your proficiency bonus." },
        "You can coat a weapon or ammunition with a strapped poison as a bonus action. When you coat a weapon or ammunition in a poison, you can transform it into any from the Exotic Poisons table. You can do this a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a short or long rest.",
        "A creature that takes Piercing or Slashing damage from the poisoned weapon or ammunition suffers its effect. The poison remains potent for 1 minute or until it deals its damage, whichever comes first. Applying a poison to a weapon or ammunition removes any other poison already applied to it.",
        { para: [{ bold: 'Saving Throws.' }, ' If a poison effect requires a saving throw, the DC equals 8 plus your Dexterity modifier and Proficiency Bonus.'] },
        { saveDC: 'dex' },
        { table: {
          title: 'Exotic Poisons',
          headers: ['Poison', 'Effect'],
          rows: [
            ["Dryad's Blight",   "The creature is dealt 1d6 poison damage. It is instead dealt 2d6 poison damage if it is a plant."],
            ["Night Hag's Hex",  ["The creature must succeed on a Constitution saving throw or have the blinded condition until the end of its next turn.", { ingested: "The creature also has the unconscious condition for 1 hour. The creature wakes up if it takes damage or if another creature takes an action to shake it awake." }]],
            ["Ooze's Caress",    "The creature is dealt 1d6 acid damage. It is instead dealt 2d6 acid damage if it is a construct or object."],
            ["Succubus's Kiss",  ["The creature must succeed on a Constitution saving throw or have the charmed condition until the end of its next turn.", { ingested: "The creature is treated as having quaffed a Philter of Love." }]],
            ["Toxin",            ["The creature must succeed on a Constitution saving throw or have the poisoned condition for 1 minute. At the end of each of its turns, the creature can repeat the saving throw. On a success, the effect ends.", { ingested: "the target is poisoned for 1 hour." }]],
          ],
        }},
      ],
    },
    {
      id: 'vile-fang-coiled-and-ready',
      name: 'Coiled and Ready',
      class: 'Rogue',
      subclass: 'Vile Fang',
      level: 3,
      type: 'text',
      description: 'You can use your Sneak Attack when you hit a creature with a weapon or ammunition coated in poison.',
    },
    {
      id: 'vile-fang-my-bite-is-death',
      name: 'My Bite is Death',
      class: 'Rogue',
      subclass: 'Vile Fang',
      level: 6,
      type: 'text',
      description: [
        'Your poisons ignore Resistance to Poison damage.',
        { boldIntro: 'Potent (Cost: 1d6).', text: 'The saving throw against the poison applied by this attack is made with disadvantage.' },
      ],
    },
    {
      id: 'barbarian-rage',
      name: 'Rage',
      class: 'Barbarian',
      level: 1,
      type: 'text',
      description: [
        "You can imbue yourself with a primal power called Rage, a force that grants you extraordinary might and resilience. You can enter it as a Bonus Action if you aren't wearing Heavy armor.",
        "You can enter your Rage the number of times shown for your Barbarian level in the Rages column of the Barbarian Features table. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.",
        'While active, your Rage follows the rules below.',
        { boldIntro: 'Damage Resistance.', text: 'You have Resistance to Bludgeoning, Piercing, and Slashing damage.' },
        { boldIntro: 'Rage Damage.', text: 'When you make an attack using Strength—with either a weapon or an Unarmed Strike—and deal damage to the target, you gain a bonus to the damage that increases as you gain levels as a Barbarian, as shown in the Rage Damage column of the Barbarian Features table.' },
        { boldIntro: 'Strength Advantage.', text: 'You have Advantage on Strength checks and Strength saving throws.' },
        { boldIntro: 'No Concentration or Spells.', text: "You can't maintain Concentration, and you can't cast spells." },
        { boldIntro: 'Duration.', text: 'The Rage lasts until the end of your next turn, and it ends early if you don Heavy armor or have the Incapacitated condition. If your Rage is still active on your next turn, you can extend the Rage for another round by doing one of the following:' },
        { list: [
          'Make an attack roll against an enemy.',
          'Force an enemy to make a saving throw.',
          'Take a Bonus Action to extend your Rage.',
        ]},
        'Each time the Rage is extended, it lasts until the end of your next turn. You can maintain a Rage for up to 10 minutes.',
      ],
    },
    {
      id: 'barbarian-unarmored-defense',
      name: 'Unarmored Defense',
      class: 'Barbarian',
      level: 1,
      type: 'text',
      description: "While you aren't wearing any armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers. You can use a Shield and still gain this benefit.",
    },
    {
      id: 'barbarian-weapon-mastery',
      name: 'Weapon Mastery',
      class: 'Barbarian',
      level: 1,
      type: 'text',
      description: [
        'Your training with weapons allows you to use the mastery properties of two kinds of Simple or Martial Melee weapons of your choice, such as Greataxes and Handaxes. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices.',
        'When you reach certain Barbarian levels, you gain the ability to use the mastery properties of more kinds of weapons, as shown in the Weapon Mastery column of the Barbarian Features table.',
      ],
    },
    {
      id: 'barbarian-danger-sense',
      name: 'Danger Sense',
      class: 'Barbarian',
      level: 2,
      type: 'text',
      description: "You gain an uncanny sense of when things aren't as they should be, giving you an edge when you dodge perils. You have Advantage on Dexterity saving throws unless you have the Incapacitated condition.",
    },
    {
      id: 'barbarian-reckless-attack',
      name: 'Reckless Attack',
      class: 'Barbarian',
      level: 2,
      type: 'text',
      description: 'You can throw aside all concern for defense to attack with increased ferocity. When you make your first attack roll on your turn, you can decide to attack recklessly. Doing so gives you Advantage on attack rolls using Strength until the start of your next turn, but attack rolls against you have Advantage during that time.',
    },
    {
      id: 'barbarian-primal-knowledge',
      name: 'Primal Knowledge',
      class: 'Barbarian',
      level: 3,
      type: 'text',
      description: [
        'You gain proficiency in another skill of your choice from the skill list available to Barbarians at level 1.',
        'In addition, while your Rage is active, you can channel primal power when you attempt certain tasks; whenever you make an ability check using one of the following skills, you can make it as a Strength check even if it normally uses a different ability: Acrobatics, Intimidation, Perception, Stealth, or Survival. When you use this ability, your Strength represents primal power coursing through you, honing your agility, bearing, and senses.',
      ],
    },
    {
      id: 'barbarian-extra-attack',
      name: 'Extra Attack',
      class: 'Barbarian',
      level: 5,
      type: 'text',
      description: 'You can attack twice instead of once whenever you take the Attack action on your turn.',
    },
    {
      id: 'barbarian-fast-movement',
      name: 'Fast Movement',
      class: 'Barbarian',
      level: 5,
      type: 'text',
      description: "Your speed increases by 10 feet while you aren't wearing Heavy armor.",
    },
    {
      id: 'cursed-dark-well',
      name: 'Dark Well',
      class: 'Barbarian',
      subclass: 'Path of the Cursed',
      level: 3,
      type: 'text',
      description: [
        'You gain an additional hit die.',
        'When you enter your rage, you can expend one hit die to feed your curse. When you do, gain temporary hit points equal to the roll of your hit die plus your Constitution modifier until your next short or long rest.',
      ],
    },
    {
      id: 'cursed-let-evil-take-hold',
      name: 'Let Evil Take Hold',
      class: 'Barbarian',
      subclass: 'Path of the Cursed',
      level: 3,
      type: 'text',
      description: [
        'When you enter your rage, your curse takes hold. You gain the following:',
        { boldIntro: 'Unholy Senses.', text: 'You gain blindsight within 10ft.' },
        { boldIntro: 'Unholy Speed.', text: 'Your speed increases by 10ft.' },
        { boldIntro: 'Unholy Strength.', text: 'When you use your Reckless Attack, deal 1d6 plus your proficiency bonus extra damage to the first target you hit with a Strength-based attack. The damage has the same type as the weapon or unarmed strike used for the attack.' },
      ],
    },
    {
      id: 'cursed-curses-claim',
      name: "Curses Claim",
      class: 'Barbarian',
      subclass: 'Path of the Cursed',
      level: 6,
      type: 'text',
      description: [
        'You gain an additional hit die.',
        'When your curse takes hold, you gain the following:',
        { boldIntro: 'Unholy Survival.', text: 'When you fail a saving throw, you can expend your temporary hit points up to your Barbarian level and add the number of temporary hit points spent to your failed save, potentially turning it into a success.' },
      ],
    },
    { id: 'ranger-feat-4',    name: 'Feat', class: 'Ranger',    level: 4, type: 'feat' },
    { id: 'sorcerer-feat-4',  name: 'Feat', class: 'Sorcerer',  level: 4, type: 'feat' },
    { id: 'rogue-feat-4',     name: 'Feat', class: 'Rogue',     level: 4, type: 'feat' },
    { id: 'barbarian-feat-4', name: 'Feat', class: 'Barbarian', level: 4, type: 'feat' },
  ];

  function getEligibleFeatures() {
    const cls     = String(state.charClass || '').trim();
    const sub     = String(state.subclass  || '').trim();
    const race    = String(state.race      || '').trim();
    const subrace = String(state.subrace   || '').trim();
    const lvl     = parseInt(state.level)  || 0;
    return FEATURES_LIBRARY.filter(f => {
      if (f.class    && f.class    !== cls)     return false;
      if (f.subclass && f.subclass !== sub)     return false;
      if (f.race     && f.race     !== race)    return false;
      if (f.subrace  && f.subrace  !== subrace) return false;
      if (f.level    && f.level    >   lvl)     return false;
      return true;
    });
  }

  function featureDisplayName(feature, isEditing) {
    if (!isEditing) return feature.name;
    const source = feature.subclass || feature.subrace || feature.class || feature.race || '';
    const level  = feature.level ? ` Level ${feature.level}` : '';
    return `${source}${level} - ${feature.name}`;
  }

  function syncFeatures() {
    const eligible = getEligibleFeatures().map(f => f.id);
    // auto-add newly eligible features not already active or hidden
    eligible.forEach(id => {
      if (!state.activeFeatures.includes(id) && !state.hiddenFeatures.includes(id)) {
        state.activeFeatures.push(id);
      }
    });
    // strip features no longer eligible
    state.activeFeatures = state.activeFeatures.filter(id => eligible.includes(id));
    state.hiddenFeatures  = state.hiddenFeatures.filter(id => eligible.includes(id));
  }

  // ── Feature drag state ────────────────────────────────────────────────────
  let fDrag = null; // { id, el, dropLine }

  function initFeatureDrag(handle, featureEl, featureId, listEl) {
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      featureEl.classList.add('cs-feature-dragging');
      fDrag = { id: featureId, el: featureEl };

      const dropLine = document.createElement('div');
      dropLine.className = 'cs-feature-drop-line';
      fDrag.dropLine = dropLine;

      const onMove = ev => {
        if (dropLine.parentNode) dropLine.remove();
        const rows = [...listEl.querySelectorAll('.cs-feature[data-feature-id]:not(.cs-feature-dragging)')];
        let inserted = false;
        for (const row of rows) {
          const rect = row.getBoundingClientRect();
          if (ev.clientY < rect.top + rect.height / 2) {
            listEl.insertBefore(dropLine, row);
            inserted = true;
            break;
          }
        }
        if (!inserted) {
          const ghost = listEl.querySelector('.cs-feature-ghost-section');
          ghost ? listEl.insertBefore(dropLine, ghost) : listEl.appendChild(dropLine);
        }
      };

      const onUp = () => {
        if (dropLine.parentNode) {
          listEl.insertBefore(featureEl, dropLine);
          dropLine.remove();
        }
        featureEl.classList.remove('cs-feature-dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);

        const newOrder = [...listEl.querySelectorAll('.cs-feature[data-feature-id]')]
          .map(el => el.dataset.featureId);
        state.activeFeatures = newOrder;
        fDrag = null;
        if (onChange) onChange();
        renderFeatures();
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  // ── Spell autocomplete ───────────────────────────────────────────────────
  let _spellAcDdEl = document.getElementById('spell-ac-dropdown');
  if (!_spellAcDdEl) {
    _spellAcDdEl = document.createElement('div');
    _spellAcDdEl.id = 'spell-ac-dropdown';
    document.body.appendChild(_spellAcDdEl);
    console.log('[SpellAC] created element dynamically, parent:', _spellAcDdEl.parentElement?.tagName);
  }
  _spellAcDdEl.style.display = 'none';
  let _spellAcInp = null;

  _spellAcDdEl.addEventListener('mousedown', e => e.preventDefault());
  _spellAcDdEl.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

  function _positionSpellAcDd() {
    if (!_spellAcInp || !_spellAcDdEl) return;
    const rect = _spellAcInp.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    _spellAcDdEl.style.left  = rect.left + 'px';
    _spellAcDdEl.style.width = Math.max(rect.width, 160) + 'px';
    if (spaceBelow >= 160 || spaceBelow >= window.innerHeight - rect.top) {
      _spellAcDdEl.style.top    = (rect.bottom + 2) + 'px';
      _spellAcDdEl.style.bottom = 'auto';
    } else {
      _spellAcDdEl.style.top    = 'auto';
      _spellAcDdEl.style.bottom = (window.innerHeight - rect.top + 2) + 'px';
    }
  }

  function _closeSpellAc() {
    _spellAcDdEl.style.display = 'none';
    _spellAcDdEl.innerHTML = '';
    _spellAcInp = null;
  }

  ['inv-scroll', 'stats-panel', 'shop-scroll'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('scroll', () => { if (_spellAcDdEl.style.display !== 'none') _positionSpellAcDd(); }, { passive: true });
  });

  function _showSpellAcMatches(val, level, inp, onPick) {
    const spellDb = window.SPELLS_XPHB || [];
    console.log('[SpellAC] show — val:', val, 'level:', level, 'db length:', spellDb.length);
    if (!val) { _closeSpellAc(); return; }
    const matches = spellDb
      .filter(s => s.l === level && s.n.toLowerCase().includes(val))
      .slice(0, 10);
    console.log('[SpellAC] matches:', matches.length, matches.map(s => s.n));
    if (!matches.length) { _closeSpellAc(); return; }
    _spellAcDdEl.innerHTML = '';
    matches.forEach(spell => {
      const opt = document.createElement('div');
      opt.className = 'spell-ac-option';
      opt.textContent = spell.n;
      const pick = () => {
        inp.value = spell.n;
        _closeSpellAc();
        if (onPick) onPick(spell.n);
        inp.blur();
      };
      opt.addEventListener('mousedown', e => { e.preventDefault(); pick(); });
      opt.addEventListener('touchstart', e => { opt._touchY = e.touches[0].clientY; }, { passive: true });
      opt.addEventListener('touchend', e => {
        if (Math.abs(e.changedTouches[0].clientY - (opt._touchY || 0)) < 10) {
          e.preventDefault(); pick();
        }
      }, { passive: false });
      _spellAcDdEl.appendChild(opt);
    });
    _positionSpellAcDd();
    _spellAcDdEl.style.display = 'block';
  }

  function attachSpellAutocomplete(inp, level, onPick) {
    inp.addEventListener('focus', () => {
      _spellAcInp = inp;
      _showSpellAcMatches(inp.value.trim().toLowerCase(), level, inp, onPick);
    });
    inp.addEventListener('input', () => {
      _spellAcInp = inp;
      _showSpellAcMatches(inp.value.trim().toLowerCase(), level, inp, onPick);
    });
    inp.addEventListener('blur',    () => setTimeout(_closeSpellAc, 150));
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') _closeSpellAc(); });
  }

  // ── Use stepper helper (- current/max +) ─────────────────────────────────
  function makeUseStepper(current, max, onSetCurrent, onSetMax) {
    const wrap = document.createElement('div');
    wrap.className = 'cs-use-stepper';

    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'cs-use-btn';
    decBtn.textContent = '−';
    decBtn.disabled = current <= 0;
    decBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (decBtn.disabled) return;
      decBtn.disabled = true;
      incBtn.disabled = true;
      onSetCurrent(Math.max(0, current - 1));
    });
    wrap.appendChild(decBtn);

    const countEl = document.createElement('span');
    countEl.className = 'cs-use-count' + (current <= 0 ? ' cs-use-empty' : '');

    if (onSetMax) {
      countEl.appendChild(document.createTextNode(current + '/'));
      const maxInp = document.createElement('input');
      maxInp.type = 'number';
      maxInp.className = 'cs-use-max-inp';
      maxInp.min = '0';
      maxInp.max = '99';
      maxInp.value = max;
      maxInp.addEventListener('click', e => e.stopPropagation());
      maxInp.addEventListener('input', () => onSetMax(Math.max(0, parseInt(maxInp.value) || 0)));
      countEl.appendChild(maxInp);
    } else {
      countEl.textContent = `${current}/${max}`;
    }

    wrap.appendChild(countEl);

    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'cs-use-btn';
    incBtn.textContent = '+';
    incBtn.disabled = current >= max;
    incBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (incBtn.disabled) return;
      decBtn.disabled = true;
      incBtn.disabled = true;
      onSetCurrent(Math.min(max, current + 1));
    });
    wrap.appendChild(incBtn);

    return wrap;
  }

  // ── Barbarian Rage ────────────────────────────────────────────────────────
  const RAGE_DAMAGE_BONUSES = [2,2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,4,4];
  const RAGE_USES = [2,2,3,3,3,4,4,4,4,4,4,5,5,5,5,5,6,6,6,6];

  function getRageDamageBonus() {
    const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
    return RAGE_DAMAGE_BONUSES[lvl - 1];
  }
  function isRaging() {
    return state.activeFeatures.includes('barbarian-rage')
      && !!(state.featureData['barbarian-rage'] && state.featureData['barbarian-rage'].active);
  }
  // Toggle Rage on/off. Entering Rage consumes one use; ending it does not refund.
  function makeRageToggle() {
    const active = isRaging();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cs-rage-panel' + (active ? ' cs-on' : '');
    btn.innerHTML = '<i class="fa-solid fa-fire-flame-curved cs-rage-panel-icon"></i><span class="cs-rage-panel-lbl">Rage</span>';
    btn.title = active ? 'Raging — click to end Rage' : 'Enter Rage (uses 1 Rage)';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const data = state.featureData['barbarian-rage'] || (state.featureData['barbarian-rage'] = {});
      const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
      const useMax = RAGE_USES[lvl - 1];
      if (data.used == null) data.used = 0;
      if (!data.active) {
        data.active = true;
        if (data.used < useMax) data.used += 1;
      } else {
        data.active = false;
      }
      if (onChange) onChange();
      renderFeatures();
      updateCsCalculations();
    });
    return btn;
  }

  // ── Feature content renderers ─────────────────────────────────────────────
  function renderSpellcastingContent(feature, data, isEditing) {
    const isRanger  = feature.id === 'ranger-spellcasting';
    const lvl       = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
    const slotTable = isRanger ? RANGER_SLOTS : SORC_SLOTS;
    const slots     = slotTable[lvl] || slotTable[20];
    const abScore   = isRanger ? (parseInt(state.wis) || 10) : (parseInt(state.cha) || 10);
    const abMod     = Math.floor((abScore - 10) / 2);
    const abLabel   = isRanger ? 'WIS' : 'CHA';
    const abClass   = isRanger ? 'cs-attr-wis' : 'cs-attr-cha';
    const profBonus = Math.ceil(lvl / 4) + 1;
    const atkBonus  = abMod + profBonus;
    const saveDC    = 8 + abMod + profBonus;

    if (!data.usedSlots)  data.usedSlots  = {};
    if (!data.spellNames) data.spellNames = {};

    const exhPenalty     = state.exhaustion || 0;
    const dispAtkBonus   = atkBonus - exhPenalty;
    const dispSaveDC     = saveDC   - exhPenalty;
    const penClass       = exhPenalty > 0 ? ' cs-exh-penalty' : '';

    const wrap = document.createElement('div');
    wrap.className = 'cs-feat-spellcasting';

    // Stats row (ability / atk bonus / save DC)
    const stats = document.createElement('div');
    stats.className = `cs-feat-spell-stats ${abClass}`;
    stats.innerHTML = `
      <div class="cs-feat-spell-stat"><span class="cs-feat-spell-stat-val">${abLabel}</span><span class="cs-feat-spell-stat-lbl">Ability</span></div>
      <div class="cs-feat-spell-stat"><span class="cs-feat-spell-stat-val${penClass}">${dispAtkBonus >= 0 ? '+' : ''}${dispAtkBonus}</span><span class="cs-feat-spell-stat-lbl">Atk Bonus</span></div>
      <div class="cs-feat-spell-stat"><span class="cs-feat-spell-stat-val${penClass}">${dispSaveDC}</span><span class="cs-feat-spell-stat-lbl">Save DC</span></div>
    `;
    wrap.appendChild(stats);

    const ordinals = ['','1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];

    function makeSpellSection(key, title, slotMax, slotLvl, spellLevel) {
      if (!data.spellNames[key]) data.spellNames[key] = [];
      const names = data.spellNames[key];
      const filled = names.filter(n => n && n.trim());

      // In view mode: hide cantrip section if empty; spell level sections keep heading for slot tracking
      if (!isEditing && slotMax === null && filled.length === 0) return null;

      const section = document.createElement('div');
      section.className = 'cs-spell-section';
      if (slotLvl !== null) {
        const hue = Math.round(170 + (slotLvl - 1) * 24); // teal(170) → violet(290) across 6 levels
        section.classList.add('cs-spell-leveled');
        section.style.setProperty('--sh', hue);
      }

      // Heading
      const heading = document.createElement('div');
      heading.className = 'cs-spell-heading';
      const rule1 = document.createElement('span');
      rule1.className = 'cs-spell-rule';
      heading.appendChild(rule1);
      const titleEl = document.createElement('span');
      titleEl.className = 'cs-spell-title';
      titleEl.textContent = title;
      heading.appendChild(titleEl);
      if (slotMax !== null) {
        if (!data.slotOverrides) data.slotOverrides = {};
        const effectiveMax = data.slotOverrides[slotLvl] != null ? data.slotOverrides[slotLvl] : slotMax;
        const used = data.usedSlots[slotLvl] || 0;
        const remaining = effectiveMax - used;
        heading.appendChild(makeUseStepper(
          remaining,
          effectiveMax,
          newRemaining => {
            const eff = data.slotOverrides?.[slotLvl] ?? slotMax;
            data.usedSlots[slotLvl] = eff - newRemaining;
            if (onChange) onChange();
            renderFeatures();
          },
          isEditing ? newMax => {
            data.slotOverrides[slotLvl] = newMax;
            if ((data.usedSlots[slotLvl] || 0) > newMax) data.usedSlots[slotLvl] = newMax;
            if (onChange) onChange();
            renderFeatures();
          } : null
        ));
      }
      const rule2 = document.createElement('span');
      rule2.className = 'cs-spell-rule';
      heading.appendChild(rule2);
      section.appendChild(heading);

      if (isEditing) {
        const grid = document.createElement('div');
        grid.className = 'cs-spell-grid';

        // Normalize: strip old extra trailing empties, keep exactly one trailing empty
        while (names.length > 0 && !names[names.length - 1]?.trim()) names.pop();
        names.push('');

        function appendInput(idx) {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'cs-spell-input';
          inp.spellcheck = false;
          inp.autocomplete = 'off';
          inp.placeholder = 'Spell name';
          inp.value = names[idx] || '';

          attachSpellAutocomplete(inp, spellLevel, (spellName) => {
            names[idx] = spellName;
            if (onChange) onChange();
            if (idx === names.length - 1) {
              names.push('');
              appendInput(names.length - 1);
            }
          });

          inp.addEventListener('input', () => {
            names[idx] = inp.value;
            if (onChange) onChange();
            if (idx === names.length - 1 && inp.value.trim()) {
              names.push('');
              appendInput(names.length - 1);
            }
          });

          inp.addEventListener('blur', () => {
            if (!inp.value.trim() && idx < names.length - 1) {
              names.splice(idx, 1);
              if (onChange) onChange();
              renderFeatures();
            }
          });

          grid.appendChild(inp);
        }

        names.forEach((_, idx) => appendInput(idx));
        section.appendChild(grid);
      } else if (filled.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'cs-spell-grid';
        filled.forEach(spellName => {
          const spellData = (window.SPELLS_XPHB || []).find(s => s.n.toLowerCase() === spellName.toLowerCase());
          const item = document.createElement('div');
          item.className = 'cs-spell-link' + (spellData ? ' cs-spell-link-known' : '');
          const icon = document.createElement('span');
          icon.className = 'cs-spell-link-icon';
          icon.innerHTML = '<i class="fas fa-circle-info"></i>';
          const nameEl = document.createElement('span');
          nameEl.className = 'cs-spell-link-name';
          nameEl.textContent = spellName;
          item.appendChild(icon);
          item.appendChild(nameEl);
          if (spellData) {
            item.addEventListener('click', () => openSpellDetail(spellData, item));
          }
          grid.appendChild(item);
        });
        section.appendChild(grid);
      }

      return section;
    }

    // Cantrip section
    const cantripSec = makeSpellSection('cantrip', 'Cantrip', null, null, 0);
    if (cantripSec) wrap.appendChild(cantripSec);

    // One section per spell level
    Object.entries(slots).forEach(([lvlStr, max]) => {
      const slotLvl = parseInt(lvlStr);
      if (!data.usedSlots[slotLvl]) data.usedSlots[slotLvl] = 0;
      const label = `${ordinals[slotLvl] || slotLvl + 'th'} Level Spells`;
      const sec = makeSpellSection(`level-${slotLvl}`, label, max, slotLvl, slotLvl);
      if (sec) wrap.appendChild(sec);
    });

    return wrap;
  }

  // ── Spell detail panel ───────────────────────────────────────────────────
  let _spellDetailActive = null;

  function openSpellDetail(spell) {
    if (_spellDetailActive === spell.n) {
      closeSpellDetail();
      return;
    }
    _spellDetailActive = spell.n;
    inspectorItemKey = null;

    const section = document.getElementById('spell-insp-section');
    inspectorEl.hidden = true;
    section.hidden = false;

    const lvlNames = ['Cantrip','1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];
    const lvlLabel = spell.l === 0 ? `${spell.sc} Cantrip` : `${lvlNames[spell.l]} Level ${spell.sc}`;
    const tags = [];
    if (spell.conc)   tags.push('Concentration');
    if (spell.ritual) tags.push('Ritual');

    section.querySelector('.spell-detail-name').textContent = spell.n;
    section.querySelector('.spell-detail-sub').textContent  = lvlLabel + (tags.length ? ` · ${tags.join(' · ')}` : '');

    const propsEl = section.querySelector('.spell-detail-props');
    propsEl.innerHTML = '';
    [['Casting Time', spell.t], ['Range', spell.r], ['Components', spell.c], ['Duration', spell.d]]
      .forEach(([label, val]) => {
        if (!val) return;
        const row = document.createElement('div');
        row.className = 'spell-detail-prop';
        row.innerHTML = `<span class="spell-detail-prop-lbl">${label}</span><span class="spell-detail-prop-val">${val}</span>`;
        propsEl.appendChild(row);
      });

    function renderDesc(text) {
      if (!text) return '';
      return text.split('\n').map(line =>
        line.startsWith('• ')
          ? `<div class="spell-detail-bullet">${line.slice(2)}</div>`
          : `<p>${line}</p>`
      ).join('');
    }

    section.querySelector('.spell-detail-desc').innerHTML = renderDesc(spell.desc);
    const higherEl = section.querySelector('.spell-detail-higher');
    if (spell.higher) {
      higherEl.innerHTML = '<div class="spell-detail-higher-lbl">At Higher Levels</div>' + renderDesc(spell.higher);
      higherEl.hidden = false;
    } else {
      higherEl.hidden = true;
    }

    detailPanelEl.classList.remove('no-transition', 'detail-collapsed');
    document.getElementById('spell-insp-toggle').onclick = closeSpellDetail;
  }

  function closeSpellDetail() {
    _spellDetailActive = null;
    document.getElementById('spell-insp-section').hidden = true;
    detailPanelEl.classList.add('detail-collapsed');
  }

  let _metamagicDetailActive = null;

  function openMetamagicDetail(opt) {
    if (_metamagicDetailActive === opt.id) {
      closeMetamagicDetail();
      return;
    }
    _metamagicDetailActive = opt.id;
    _spellDetailActive = null;
    inspectorItemKey = null;

    const section = document.getElementById('spell-insp-section');
    inspectorEl.hidden = true;
    section.hidden = false;

    section.querySelector('.spell-detail-name').textContent = opt.name;
    section.querySelector('.spell-detail-sub').textContent = 'Metamagic Option';

    const propsEl = section.querySelector('.spell-detail-props');
    propsEl.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'spell-detail-prop';
    row.innerHTML = `<span class="spell-detail-prop-lbl">Cost</span><span class="spell-detail-prop-val">${opt.cost}</span>`;
    propsEl.appendChild(row);

    section.querySelector('.spell-detail-desc').innerHTML = opt.desc
      .split('\n').map(line => `<p>${line}</p>`).join('');
    section.querySelector('.spell-detail-higher').hidden = true;

    detailPanelEl.classList.remove('no-transition', 'detail-collapsed');
    document.getElementById('spell-insp-toggle').onclick = closeMetamagicDetail;
  }

  function closeMetamagicDetail() {
    _metamagicDetailActive = null;
    document.getElementById('spell-insp-section').hidden = true;
    detailPanelEl.classList.add('detail-collapsed');
  }

  function renderSorceryPointsContent(data) {
    const lvl = parseInt(state.level) || 1;
    const max = data.fontMax ?? lvl;
    if (data.current == null) data.current = max;
    const current = Math.max(0, Math.min(max, data.current));

    const wrap = document.createElement('div');
    wrap.className = 'cs-feat-sorcery';

    const pips = document.createElement('div');
    pips.className = 'cs-feat-sorcery-pips';
    for (let i = 0; i < max; i++) {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.className = 'cs-feat-sorcery-pip' + (i < current ? ' cs-feat-sorcery-pip-full' : '');
      pip.addEventListener('click', () => {
        data.current = i < current ? current - 1 : i + 1;
        if (onChange) onChange();
        renderFeatures();
      });
      pips.appendChild(pip);
    }
    const pipLabel = document.createElement('div');
    pipLabel.className = 'cs-feat-sorcery-count';
    pipLabel.textContent = `${current} / ${max} Sorcery Points`;
    wrap.appendChild(pips);
    wrap.appendChild(pipLabel);
    return wrap;
  }

  function renderMetamagicContent(data, isEditing) {
    const lvl = parseInt(state.level) || 2;
    const maxChoices = lvl >= 17 ? 4 : lvl >= 10 ? 3 : 2;
    if (!data.chosen) data.chosen = [];

    const wrap = document.createElement('div');
    wrap.className = 'cs-feat-metamagic';

    if (isEditing) {
      const choiceInfo = document.createElement('div');
      choiceInfo.className = 'cs-feat-metamagic-info';
      choiceInfo.textContent = `${data.chosen.length} / ${maxChoices} chosen`;
      wrap.appendChild(choiceInfo);
    }

    const grid = document.createElement('div');
    grid.className = isEditing ? 'cs-feat-metamagic-grid' : 'cs-spell-grid';
    METAMAGIC_OPTIONS.filter(opt => !opt.subclassOnly).forEach(opt => {
      const chosen = data.chosen.includes(opt.id);
      if (!isEditing && !chosen) return;

      if (!isEditing) {
        const item = document.createElement('div');
        item.className = 'cs-spell-link cs-spell-link-known';
        const icon = document.createElement('span');
        icon.className = 'cs-spell-link-icon';
        icon.innerHTML = '<i class="fas fa-circle-info"></i>';
        const nameEl = document.createElement('span');
        nameEl.className = 'cs-spell-link-name';
        nameEl.textContent = opt.name;
        item.appendChild(icon);
        item.appendChild(nameEl);
        item.addEventListener('click', () => openMetamagicDetail(opt));
        grid.appendChild(item);
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs-feat-metamagic-opt' + (chosen ? ' cs-feat-metamagic-chosen' : '');
      btn.textContent = opt.name;
      btn.addEventListener('click', () => {
        if (chosen) {
          data.chosen = data.chosen.filter(id => id !== opt.id);
        } else if (data.chosen.length < maxChoices) {
          data.chosen.push(opt.id);
        }
        if (onChange) onChange();
        renderFeatures();
      });
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function renderFeatureBody(feature, data, isEditing) {
    const body = document.createElement('div');
    body.className = 'cs-feature-body';

    let descTarget = body;

    if (feature.id === 'barbarian-rage') {
      const row = document.createElement('div');
      row.className = 'cs-rage-toggle-row';
      row.appendChild(makeRageToggle());
      body.appendChild(row);
    }

    // Features whose rules text can be hidden behind a small arrow. The collapsible
    // range is [collapseStart, collapseEnd); parts outside it (e.g. a stat panel or
    // table) stay visible. `endBefore` marks the first visible part after the text;
    // `startAfter` marks a leading visible part the text should follow.
    const TEXT_COLLAPSE = {
      'barbarian-rage':           {},
      'witch-warden-witchmarks':  { endBefore: p => p && p.witchingDie },
      'vile-fang-fangs-dripping': { endBefore: p => p && p.saveDC },
      'rogue-sneak-attack':       { startAfter: p => p && p.sneakAttackDice },
    };
    let collapseWrap = null, collapseToggle = null, collapseStart = 0, collapseEnd = 0;
    const collapseCfg = TEXT_COLLAPSE[feature.id];
    if (collapseCfg && feature.description) {
      const cparts = Array.isArray(feature.description) ? feature.description : [feature.description];
      collapseEnd = cparts.length;
      if (collapseCfg.endBefore) {
        const i = cparts.findIndex(collapseCfg.endBefore);
        if (i !== -1) collapseEnd = i;
      }
      if (collapseCfg.startAfter) {
        const i = cparts.findIndex(collapseCfg.startAfter);
        if (i !== -1) collapseStart = i + 1;
      }
      if (collapseStart < collapseEnd) {
        const collapsed = !!data.textCollapsed;
        collapseToggle = document.createElement('button');
        collapseToggle.type = 'button';
        collapseToggle.className = 'cs-feature-text-toggle' + (collapsed ? '' : ' cs-open');
        collapseToggle.innerHTML = '<i class="fa-solid fa-chevron-down"></i><span>Details</span>';
        collapseToggle.addEventListener('click', () => {
          data.textCollapsed = !data.textCollapsed;
          if (onChange) onChange();
          renderFeatures();
        });
        collapseWrap = document.createElement('div');
        collapseWrap.className = 'cs-feature-text-collapse';
        collapseWrap.hidden = collapsed;
      }
    }

    let expertiseDropdownInserted = false;
    if (feature.description) {
      const parts = Array.isArray(feature.description) ? feature.description : [feature.description];
      parts.forEach((part, idx) => {
        // Insert the foldout toggle + wrapper at the point the collapsible range begins.
        if (collapseWrap && idx === collapseStart) {
          body.appendChild(collapseToggle);
          body.appendChild(collapseWrap);
        }
        descTarget = (collapseWrap && idx >= collapseStart && idx < collapseEnd) ? collapseWrap : body;
        if (typeof part === 'string') {
          const p = document.createElement('p');
          p.className = 'cs-feature-desc';
          p.textContent = part;
          descTarget.appendChild(p);
        } else if (part.list) {
          const ul = document.createElement('ul');
          ul.className = 'cs-feature-list';
          part.list.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            ul.appendChild(li);
          });
          descTarget.appendChild(ul);
        } else if (part.insertExpertiseDropdown) {
          if (feature.type === 'expertise') {
            descTarget.appendChild(renderExpertiseContent(feature, data));
            expertiseDropdownInserted = true;
          }
        } else if (part.boldIntro) {
          const p = document.createElement('p');
          p.className = 'cs-feature-desc' + (part.indent ? ' cs-feature-desc--indent' : '');
          const strong = document.createElement('strong');
          strong.textContent = part.boldIntro + ' ';
          p.appendChild(strong);
          p.appendChild(document.createTextNode(part.text ?? ''));
          descTarget.appendChild(p);
        } else if (part.indent != null) {
          const p = document.createElement('p');
          p.className = 'cs-feature-desc cs-feature-desc--indent';
          p.textContent = part.indent;
          descTarget.appendChild(p);
        } else if (part.table) {
          const wrap = document.createElement('div');
          wrap.className = 'cs-feature-table-wrap';
          if (part.table.title) {
            const title = document.createElement('div');
            title.className = 'cs-feature-table-title';
            title.textContent = part.table.title;
            wrap.appendChild(title);
          }
          const tbl = document.createElement('table');
          tbl.className = 'cs-feature-table';
          const thead = document.createElement('thead');
          const hrow = document.createElement('tr');
          (part.table.headers ?? []).forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            hrow.appendChild(th);
          });
          thead.appendChild(hrow);
          tbl.appendChild(thead);
          const tbody = document.createElement('tbody');
          (part.table.rows ?? []).forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
              const td = document.createElement('td');
              if (Array.isArray(cell)) {
                cell.forEach(part => {
                  if (typeof part === 'string') {
                    td.appendChild(document.createTextNode(part));
                  } else if (part.ingested != null) {
                    const div = document.createElement('div');
                    div.className = 'cs-table-cell-ingested';
                    const strong = document.createElement('strong');
                    strong.textContent = 'Ingested: ';
                    div.appendChild(strong);
                    div.appendChild(document.createTextNode(part.ingested));
                    td.appendChild(div);
                  }
                });
              } else {
                td.textContent = cell;
              }
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          tbl.appendChild(tbody);
          wrap.appendChild(tbl);
          descTarget.appendChild(wrap);
        } else if (part.para) {
          const p = document.createElement('p');
          p.className = 'cs-feature-desc';
          part.para.forEach(inline => {
            if (typeof inline === 'string') {
              p.appendChild(document.createTextNode(inline));
            } else if (inline.metamagicLink) {
              const opt = METAMAGIC_OPTIONS.find(m => m.id === inline.metamagicLink);
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'cs-feature-inline-link';
              btn.textContent = inline.text;
              if (opt) btn.addEventListener('click', e => { e.stopPropagation(); openMetamagicDetail(opt); });
              p.appendChild(btn);
            } else if (inline.bold) {
              const strong = document.createElement('strong');
              strong.textContent = inline.bold;
              p.appendChild(strong);
            } else if (inline.calcDC) {
              const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
              const prof = Math.ceil(lvl / 4) + 1;
              const abMod = Math.floor(((parseInt(state[inline.calcDC]) || 10) - 10) / 2);
              const span = document.createElement('span');
              span.className = `cs-attr-text cs-attr-${inline.calcDC}`;
              span.textContent = String(8 + abMod + prof);
              p.appendChild(span);
            }
          });
          descTarget.appendChild(p);
        } else if (part.saveDC) {
          const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
          const prof = Math.ceil(lvl / 4) + 1;
          const abMod = Math.floor(((parseInt(state[part.saveDC]) || 10) - 10) / 2);
          const dc = 8 + abMod + prof;
          const panel = document.createElement('div');
          panel.className = `cs-feat-save-dc-panel cs-attr-${part.saveDC}`;
          panel.innerHTML = `<span class="cs-feat-spell-stat-val">${dc}</span><span class="cs-feat-spell-stat-lbl">Save DC</span>`;
          descTarget.appendChild(panel);
        } else if (part.sneakAttackDice) {
          const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
          const SNEAK_DICE = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10];
          const count = SNEAK_DICE[lvl - 1];
          const panel = document.createElement('div');
          panel.className = 'cs-feat-save-dc-panel';
          panel.innerHTML = `<span class="cs-feat-spell-stat-val">${count}d6</span><span class="cs-feat-spell-stat-lbl">Sneak Attack</span>`;
          descTarget.appendChild(panel);
        } else if (part.witchingDie) {
          const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
          const die = lvl >= 6 ? 'd8' : 'd6';
          const panel = document.createElement('div');
          panel.className = 'cs-feat-save-dc-panel';
          panel.innerHTML = `<span class="cs-feat-spell-stat-val">${die}</span><span class="cs-feat-spell-stat-lbl">Witching Die</span>`;
          descTarget.appendChild(panel);
        }
      });
    }

    if (feature.type === 'spellcasting') {
      body.appendChild(renderSpellcastingContent(feature, data, isEditing));
    } else if (feature.type === 'metamagic') {
      body.appendChild(renderMetamagicContent(data, isEditing));
    } else if (feature.type === 'frayed') {
      body.appendChild(renderFrayedContent(isEditing));
    } else if (feature.type === 'fighting-style') {
      body.appendChild(renderFightingStyleContent(data, isEditing));
    } else if (feature.type === 'expertise' && !expertiseDropdownInserted) {
      body.appendChild(renderExpertiseContent(feature, data));
    } else if (feature.type === 'feat') {
      body.appendChild(renderFeatContent(feature, data));
    }

    return body;
  }

  const FRAYED_SUBRACES = {
    Abhorrent: [
      { boldIntro: 'Abyssal Visage.', text: 'You have proficiency in Intimidation.' },
      { boldIntro: 'Darkvision.',     text: 'You have darkvision out to 30 feet.' },
    ],
    Divine: [
      { boldIntro: 'Divine Right.',   text: 'You have proficiency in Persuasion.' },
      { boldIntro: 'Radiant Visage.', text: 'You shed dim light within a 5-foot radius. The light is considered daylight and you can supress it at will.' },
    ],
    Fey: [
      { boldIntro: 'Keen Senses.',   text: 'You have proficiency in Perception.' },
      { boldIntro: 'Fey Ancestry.',  text: 'You have Advantage on saving throws you make to avoid or end the Charmed condition.' },
    ],
  };

  function renderFrayedContent(isEditing) {
    const wrap = document.createElement('div');
    wrap.className = 'cs-feat-subrace';

    if (isEditing) {
      const sel = document.createElement('select');
      sel.className = 'cs-feat-subrace-sel';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Choose Sub-race…';
      sel.appendChild(blank);
      Object.keys(FRAYED_SUBRACES).forEach(sr => {
        const opt = document.createElement('option');
        opt.value = sr;
        opt.textContent = sr;
        if (state.subrace === sr) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', e => {
        e.stopPropagation();
        state.subrace = sel.value;
        syncFeatures();
        renderFeatures();
        if (onChange) onChange();
      });
      wrap.appendChild(sel);
    } else if (state.subrace) {
      const label = document.createElement('div');
      label.className = 'cs-feat-subrace-label';
      label.textContent = state.subrace;
      wrap.appendChild(label);
    }

    const parts = FRAYED_SUBRACES[state.subrace];
    if (parts) {
      const descWrap = document.createElement('div');
      descWrap.className = 'cs-feat-subrace-desc';
      parts.forEach(part => {
        const p = document.createElement('p');
        p.className = 'cs-feature-desc';
        const strong = document.createElement('strong');
        strong.textContent = part.boldIntro + ' ';
        p.appendChild(strong);
        p.appendChild(document.createTextNode(part.text));
        descWrap.appendChild(p);
      });
      wrap.appendChild(descWrap);
    }

    return wrap;
  }

  const RANGER_FIGHTING_STYLES = [
    { value: 'Archery' },
    { value: 'Defense' },
    { value: 'Druidic Warrior', description: 'You learn two Druid cantrips of your choice. Guidance and Starry Wisp are recommended. The chosen cantrips count as Ranger spells for you, and Wisdom is your spellcasting ability for them. Whenever you gain a Ranger level, you can replace one of these cantrips with another Druid cantrip.' },
    { value: 'Dueling' },
    { value: 'Two-Weapon Fighting' },
  ];

  function renderExpertiseContent(feature, data) {
    if (!data.slots) data.slots = [];
    const slots = feature.expertiseSlots || 2;
    const wrap = document.createElement('div');
    wrap.className = 'cs-feat-expertise';

    for (let i = 0; i < slots; i++) {
      const sel = document.createElement('select');
      sel.className = 'cs-feat-subrace-sel';

      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'None';
      sel.appendChild(blank);

      Object.keys(EXPERTISE_SKILL_NAMES).forEach(skill => {
        if (!state[skill + 'Prof']) return;
        const opt = document.createElement('option');
        opt.value = skill;
        opt.textContent = EXPERTISE_SKILL_NAMES[skill];
        if (data.slots[i] === skill) opt.selected = true;
        sel.appendChild(opt);
      });

      const idx = i;
      sel.addEventListener('change', e => {
        e.stopPropagation();
        data.slots[idx] = sel.value;
        updateCsCalculations();
        if (onChange) onChange();
        renderFeatures();
      });

      wrap.appendChild(sel);
    }

    return wrap;
  }

  // fixedAmount1: override the bonus for ab1 (use 1 for fixed +1 feats; null = default 2/1 logic)
  function applyAsiChange(data, newAb1, newAb2, fixedAmount1 = null) {
    function setAbScore(ab, val) {
      state[ab] = String(val);
      const el = document.getElementById(CS_ID_MAP[ab]);
      if (el && document.activeElement !== el) el.value = state[ab];
      const modEl = document.getElementById(`cs-${ab}-mod`);
      if (modEl) modEl.textContent = abilityMod(val);
    }
    if (data.ab1 && data.bonus1) setAbScore(data.ab1, parseInt(state[data.ab1] || '10') - data.bonus1);
    if (data.ab2 && data.bonus2) setAbScore(data.ab2, parseInt(state[data.ab2] || '10') - data.bonus2);
    const intended1 = newAb1 ? (fixedAmount1 !== null ? fixedAmount1 : (newAb2 ? 1 : 2)) : 0;
    const intended2 = newAb2 ? 1 : 0;
    let bonus1 = 0, bonus2 = 0;
    if (newAb1) {
      const cur = parseInt(state[newAb1] || '10');
      const after = Math.min(20, cur + intended1);
      bonus1 = after - cur;
      setAbScore(newAb1, after);
    }
    if (newAb2) {
      const cur = parseInt(state[newAb2] || '10');
      const after = Math.min(20, cur + intended2);
      bonus2 = after - cur;
      setAbScore(newAb2, after);
    }
    data.ab1 = newAb1 || '';
    data.ab2 = newAb2 || '';
    data.bonus1 = bonus1;
    data.bonus2 = bonus2;
  }

  function reverseToughBonus(data) {
    if (!data.toughBonus) return;
    if (state.hpMax !== '' && state.hpMax != null) {
      state.hpMax = String(Math.max(0, (parseInt(state.hpMax) || 0) - data.toughBonus));
      const el = document.getElementById('cs-hp-max');
      if (el && document.activeElement !== el) el.value = state.hpMax;
    }
    data.toughBonus = 0;
  }

  function renderFeatContent(feature, data) {
    function descPara(content) {
      const p = document.createElement('p');
      p.className = 'cs-feature-desc';
      if (typeof content === 'string') {
        p.textContent = content;
      } else if (content.boldIntro) {
        const b = document.createElement('strong');
        b.textContent = content.boldIntro + ' ';
        p.appendChild(b);
        p.appendChild(document.createTextNode(content.text || ''));
      }
      return p;
    }

    const wrap = document.createElement('div');
    wrap.className = 'cs-feat-choice';

    const featSel = document.createElement('select');
    featSel.className = 'cs-feat-subrace-sel';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Choose a feat…';
    featSel.appendChild(blank);
    FEAT_OPTIONS.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      if (data.feat === f.id) opt.selected = true;
      featSel.appendChild(opt);
    });
    featSel.addEventListener('change', e => {
      e.stopPropagation();
      const old = data.feat;
      if (old === 'ability-score-improvement' || old === 'shield-master' || old === 'dual-wielder') applyAsiChange(data, '', '');
      else if (old === 'tough') reverseToughBonus(data);
      data.feat = featSel.value;
      if (data.feat === 'shield-master') applyAsiChange(data, 'str', '', 1);
      updateCsCalculations();
      if (onChange) onChange();
      renderFeatures();
    });
    wrap.appendChild(featSel);

    if (data.feat === 'ability-score-improvement') {
      const p1 = document.createElement('p');
      p1.className = 'cs-feature-desc';
      p1.textContent = "Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1. This feat can't increase an ability score above 20.";
      wrap.appendChild(p1);
      const p2 = document.createElement('p');
      p2.className = 'cs-feature-desc';
      const rep = document.createElement('strong');
      rep.className = 'cs-feat-repeatable';
      rep.textContent = 'Repeatable. ';
      p2.appendChild(rep);
      p2.appendChild(document.createTextNode('You can take this feat more than once.'));
      wrap.appendChild(p2);
      const row = document.createElement('div');
      row.className = 'cs-feat-asi-row';
      ['ab1', 'ab2'].forEach(key => {
        const col = document.createElement('div');
        col.className = 'cs-feat-asi-col';
        const lbl = document.createElement('span');
        lbl.className = 'cs-feat-asi-label';
        lbl.textContent = key === 'ab1' ? 'Ability 1' : 'Ability 2';
        const sel = document.createElement('select');
        sel.className = 'cs-feat-subrace-sel';
        const none = document.createElement('option');
        none.value = '';
        none.textContent = '—';
        sel.appendChild(none);
        Object.entries(FEAT_ABILITY_NAMES).forEach(([ab, name]) => {
          const opt = document.createElement('option');
          opt.value = ab;
          opt.textContent = name;
          if (data[key] === ab) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', e => {
          e.stopPropagation();
          const newAb1 = key === 'ab1' ? sel.value : (data.ab1 || '');
          const newAb2 = key === 'ab2' ? sel.value : (data.ab2 || '');
          applyAsiChange(data, newAb1, newAb2);
          updateCsCalculations();
          if (onChange) onChange();
          renderFeatures();
        });
        col.appendChild(lbl);
        col.appendChild(sel);
        row.appendChild(col);
      });
      wrap.appendChild(row);
      const hint = document.createElement('p');
      hint.className = 'cs-feature-desc cs-feat-asi-hint';
      hint.textContent = data.ab1 && data.ab2 ? '+1 to each ability'
        : data.ab1 ? '+2 to first ability'
        : 'Choose one ability for +2, or two abilities for +1 each.';
      wrap.appendChild(hint);

    } else if (data.feat === 'shield-master') {
      [
        'You gain the following benefits.',
        { boldIntro: 'Ability Score Increase.', text: 'Increase your Strength score by 1, to a maximum of 20.' },
        { boldIntro: 'Shield Bash.', text: "If you attack a creature within 5 feet of you as part of the Attack action and hit with a Melee weapon, you can immediately bash the target with your Shield if it's equipped, forcing the target to make a Strength saving throw (DC 8 plus your Strength modifier and Proficiency Bonus). On a failed save, you either push the target 5 feet from you or cause it to have the Prone condition (your choice). You can use this benefit only once on each of your turns." },
        { boldIntro: 'Interpose Shield.', text: "If you're subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you can take a Reaction to take no damage if you succeed on the saving throw and are holding a Shield." },
      ].forEach(part => wrap.appendChild(descPara(part)));

    } else if (data.feat === 'dual-wielder') {
      wrap.appendChild(descPara('You gain the following benefits.'));
      wrap.appendChild(descPara({ boldIntro: 'Ability Score Increase.', text: 'Increase your Strength or Dexterity by 1, to a maximum of 20.' }));
      const col = document.createElement('div');
      col.className = 'cs-feat-asi-col';
      const lbl = document.createElement('span');
      lbl.className = 'cs-feat-asi-label';
      lbl.textContent = 'Ability (+1)';
      const sel = document.createElement('select');
      sel.className = 'cs-feat-subrace-sel';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '—';
      sel.appendChild(none);
      [['str', 'Strength'], ['dex', 'Dexterity']].forEach(([ab, name]) => {
        const opt = document.createElement('option');
        opt.value = ab;
        opt.textContent = name;
        if (data.ab1 === ab) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', e => {
        e.stopPropagation();
        applyAsiChange(data, sel.value, '', 1);
        updateCsCalculations();
        if (onChange) onChange();
        renderFeatures();
      });
      col.appendChild(lbl);
      col.appendChild(sel);
      wrap.appendChild(col);
      wrap.appendChild(descPara({ boldIntro: 'Enhanced Dual Wielding.', text: "When you take the Attack action on your turn and attack with a weapon that has the Light property, you can make one extra attack as a Bonus Action later on the same turn with a different weapon, which must be a Melee weapon that lacks the Two-Handed property. You don't add your ability modifier to the extra attack's damage unless that modifier is negative." }));
      wrap.appendChild(descPara({ boldIntro: 'Quick Draw.', text: 'You can draw or stow two weapons that lack the Two-Handed property when you would normally be able to draw or stow only one.' }));

    } else if (data.feat === 'tough') {
      wrap.appendChild(descPara('Your Hit Point maximum increases by an amount equal to twice your character level when you gain this feat. Whenever you gain a character level thereafter, your Hit Point maximum increases by an additional 2 Hit Points.'));
      const lvl = parseInt(state.level) || 0;
      const bonus = lvl >= 1 ? 2 * lvl : 0;
      const panel = document.createElement('div');
      panel.className = 'cs-feat-save-dc-panel';
      panel.innerHTML = `<span class="cs-feat-spell-stat-val">+${bonus}</span><span class="cs-feat-spell-stat-lbl">HP Max</span>`;
      wrap.appendChild(panel);
    }

    return wrap;
  }

  function renderFightingStyleContent(data, isEditing) {
    const wrap = document.createElement('div');

    const p = document.createElement('p');
    p.className = 'cs-feature-desc';
    p.textContent = 'You gain a Fighting Style feat of your choice. Instead of choosing one of those feats, you can choose Druidic Warrior.';
    wrap.appendChild(p);

    const sel = document.createElement('select');
    sel.className = 'cs-feat-subrace-sel';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Choose a Fighting Style…';
    sel.appendChild(blank);
    RANGER_FIGHTING_STYLES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = s.value;
      if (data.style === s.value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', e => {
      e.stopPropagation();
      data.style = sel.value;
      if (onChange) onChange();
      renderFeatures();
    });
    wrap.appendChild(sel);

    const chosen = RANGER_FIGHTING_STYLES.find(s => s.value === data.style);
    if (chosen?.description) {
      const descP = document.createElement('p');
      descP.className = 'cs-feature-desc';
      const strong = document.createElement('strong');
      strong.textContent = chosen.value + '. ';
      descP.appendChild(strong);
      descP.appendChild(document.createTextNode(chosen.description));
      wrap.appendChild(descP);
    }

    return wrap;
  }

  function renderFeatures() {
    const listEl = document.getElementById('cs-features');
    if (!listEl) return;
    const isEditing = document.getElementById('stats-panel')?.classList.contains('editing');
    listEl.innerHTML = '';

    // Active features
    state.activeFeatures.forEach(id => {
      const feature = FEATURES_LIBRARY.find(f => f.id === id);
      if (!feature) return;

      if (!state.featureData[id]) state.featureData[id] = {};
      const data = state.featureData[id];
      const collapsed = !!state.featureCollapsed[id];

      const el = document.createElement('div');
      el.className = 'cs-feature';
      el.dataset.featureId = id;

      // Header
      const header = document.createElement('div');
      header.className = 'cs-feature-header';

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'cs-feature-drag-handle';
      handle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
      handle.title = 'Drag to reorder';
      header.appendChild(handle);

      const toggle = document.createElement('div');
      toggle.className = 'cs-feature-toggle' + (collapsed ? '' : ' cs-feature-open');
      toggle.addEventListener('click', () => {
        state.featureCollapsed[id] = !state.featureCollapsed[id];
        if (onChange) onChange();
        renderFeatures();
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'cs-feature-name';
      nameSpan.textContent = featureDisplayName(feature, isEditing);
      toggle.appendChild(nameSpan);

      if (id === 'sorcerer-innate-sorcery') {
        if (typeof data.innateSorceryUsed !== 'number')
          data.innateSorceryUsed = data.innateSorceryUsed ? 1 : 0;
        if (data.innateSorceryMax == null) data.innateSorceryMax = 2;
        const usedCount = data.innateSorceryUsed;
        const maxCount = data.innateSorceryMax;
        toggle.appendChild(makeUseStepper(
          maxCount - usedCount,
          maxCount,
          newRemaining => {
            data.innateSorceryUsed = maxCount - newRemaining;
            if (onChange) onChange();
            renderFeatures();
          },
          isEditing ? newMax => {
            data.innateSorceryMax = newMax;
            if (data.innateSorceryUsed > newMax) data.innateSorceryUsed = newMax;
            if (onChange) onChange();
            renderFeatures();
          } : null
        ));
      } else if (id === 'sorcerer-sorcerous-restoration') {
        if (data.used == null) data.used = 0;
        toggle.appendChild(makeUseStepper(
          1 - data.used,
          1,
          newRemaining => {
            data.used = 1 - newRemaining;
            if (onChange) onChange();
            renderFeatures();
          },
          null
        ));
      } else if (id === 'barbarian-rage') {
        const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
        const useMax = RAGE_USES[lvl - 1];
        if (data.used == null) data.used = 0;
        const used = Math.min(data.used, useMax);
        toggle.appendChild(makeUseStepper(
          useMax - used,
          useMax,
          newRemaining => {
            data.used = useMax - newRemaining;
            if (onChange) onChange();
            renderFeatures();
          },
          null
        ));
      } else if (id === 'ranger-favored-enemy') {
        const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
        const FAVORED_ENEMY_USES = [2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];
        const useMax = FAVORED_ENEMY_USES[lvl - 1];
        if (data.used == null) data.used = 0;
        const used = Math.min(data.used, useMax);
        toggle.appendChild(makeUseStepper(
          useMax - used,
          useMax,
          newRemaining => {
            data.used = useMax - newRemaining;
            if (onChange) onChange();
            renderFeatures();
          },
          null
        ));
      } else if (id === 'witch-warden-witchmarks') {
        const lvl = Math.max(1, Math.min(parseInt(state.level) || 1, 20));
        const profMax = Math.ceil(lvl / 4) + 1;
        if (data.used == null) data.used = 0;
        const used = Math.min(data.used, profMax);
        toggle.appendChild(makeUseStepper(
          profMax - used,
          profMax,
          newRemaining => {
            data.used = profMax - newRemaining;
            if (onChange) onChange();
            renderFeatures();
          },
          null
        ));
      } else if (id === 'vile-fang-fangs-dripping') {
        const lvl = parseInt(state.level) || 1;
        const profMax = Math.ceil(lvl / 4) + 1;
        if (data.used == null) data.used = 0;
        const used = Math.min(data.used, profMax);
        toggle.appendChild(makeUseStepper(
          profMax - used,
          profMax,
          newRemaining => {
            data.used = profMax - newRemaining;
            if (onChange) onChange();
            renderFeatures();
          },
          null
        ));
      } else if (id === 'sorcerer-font-of-magic') {
        const lvl = parseInt(state.level) || 1;
        if (data.current == null) data.current = lvl;
        if (data.fontMax == null) data.fontMax = lvl;
        const fontMax = data.fontMax;
        const current = Math.max(0, Math.min(fontMax, data.current));
        toggle.appendChild(makeUseStepper(
          current,
          fontMax,
          newCurrent => {
            data.current = newCurrent;
            if (onChange) onChange();
            renderFeatures();
          },
          isEditing ? newMax => {
            data.fontMax = newMax;
            if (data.current > newMax) data.current = newMax;
            if (onChange) onChange();
            renderFeatures();
          } : null
        ));
      }

      const chevronEl = document.createElement('i');
      chevronEl.className = 'fa-solid fa-chevron-down cs-feature-chevron';
      toggle.appendChild(chevronEl);

      header.appendChild(toggle);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'cs-feature-del cs-edit-only';
      delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      delBtn.title = 'Remove feature';
      delBtn.addEventListener('click', () => {
        state.activeFeatures = state.activeFeatures.filter(fid => fid !== id);
        state.hiddenFeatures.push(id);
        if (onChange) onChange();
        renderFeatures();
      });
      header.appendChild(delBtn);

      el.appendChild(header);

      if (!collapsed) {
        el.appendChild(renderFeatureBody(feature, data, isEditing));
      }

      listEl.appendChild(el);
      initFeatureDrag(handle, el, id, listEl);
    });

    // Ghost features (hidden but eligible) — only visible in edit mode
    if (isEditing) {
      const ghostIds = state.hiddenFeatures.filter(id => FEATURES_LIBRARY.find(f => f.id === id));
      if (ghostIds.length) {
        const section = document.createElement('div');
        section.className = 'cs-feature-ghost-section';
        const sectionLabel = document.createElement('div');
        sectionLabel.className = 'cs-feature-ghost-label';
        sectionLabel.textContent = 'Available Features';
        section.appendChild(sectionLabel);
        ghostIds.forEach(id => {
          const feature = FEATURES_LIBRARY.find(f => f.id === id);
          if (!feature) return;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cs-feature-ghost-btn';
          btn.innerHTML = `<i class="fa-solid fa-plus"></i> ${featureDisplayName(feature)}`;
          btn.addEventListener('click', () => {
            state.hiddenFeatures = state.hiddenFeatures.filter(fid => fid !== id);
            state.activeFeatures.push(id);
            if (onChange) onChange();
            renderFeatures();
          });
          section.appendChild(btn);
        });
        listEl.appendChild(section);
      }
    }
  }

  // Hook renderFeatures into edit mode toggle
  const _featureEditObserver = new MutationObserver(() => renderFeatures());
  const _statsPanelEl = document.getElementById('stats-panel');
  if (_statsPanelEl) _featureEditObserver.observe(_statsPanelEl, { attributes: true, attributeFilter: ['class'] });

  // ── ATTACKS ───────────────────────────────────────────────────────────────
  const attacksList = document.getElementById('cs-attacks-list');
  const attacksAddBtn = document.getElementById('cs-attacks-add');

  function getInventoryWeapons() {
    const containers = state.containers.filter(c => c.id === 'equipped' || c.id === 'strapped');
    const seen = new Set();
    const weapons = [];
    for (const container of containers) {
      for (let r = 0; r < container.slots.length; r++) {
        for (let c = 0; c < container.slots[r].length; c++) {
          const slot = container.slots[r][c];
          if (!slot) continue;
          if (getEffectiveCategory(slot) !== 'weapon') continue;
          const displayName = computeDisplayName(slot);
          if (seen.has(displayName)) continue;
          seen.add(displayName);
          weapons.push({ slotData: slot, container, r, c, key: `${container.id}-${r}-${c}`, displayName });
        }
      }
    }
    return weapons;
  }

  function getWeaponBaseInfo(slotData) {
    const wv = slotData.variables && slotData.variables.weapon;
    const baseName = (wv && wv.value) ? wv.value : slotData.name;
    const lib = getLibraryItem(baseName);
    if (!lib || !lib.description) return null;
    const desc = lib.description;
    const isRanged  = /Simple Ranged|Martial Ranged/i.test(desc);
    const isFinesse = /Finesse/i.test(desc);
    const afterBr   = desc.split('<br>')[1] || desc;
    const diceMatch = afterBr.match(/^(\d+d\d+|\d+)/);
    const damageDice = diceMatch ? diceMatch[1] : null;
    const typeMatch  = afterBr.match(/^\d+d\d+\s+(\w+)/);
    const damageType = typeMatch ? typeMatch[1] : null;
    const rangeMatch = afterBr.match(/(?:Thrown|Ammunition)\s*\((\d+\/\d+)\)/i);
    const range = rangeMatch ? rangeMatch[1] : 'Melee';
    const isThrown = /Thrown\s*\(/i.test(afterBr);
    const rangeType = isThrown ? 'Thrown' : isRanged ? 'Ranged' : null;
    return { isRanged, isFinesse, damageDice, damageType, range, rangeType };
  }

  function computeWeaponAutoStats(slotData) {
    const info = getWeaponBaseInfo(slotData);
    if (!info || !info.damageDice) return null;
    const level = parseInt(state.level);
    const profBonus = (!isNaN(level) && level >= 1)
      ? Math.ceil(level / 4) + 1
      : (parseInt(state.proficiency) || 2);
    const strScore = parseInt(state.str);
    const dexScore = parseInt(state.dex);
    const strMod = !isNaN(strScore) ? Math.floor((strScore - 10) / 2) : 0;
    const dexMod = !isNaN(dexScore) ? Math.floor((dexScore - 10) / 2) : 0;
    let mod, usesStr;
    if (info.isRanged)       { mod = dexMod; usesStr = false; }
    else if (info.isFinesse) { mod = Math.max(strMod, dexMod); usesStr = strMod >= dexMod; }
    else                     { mod = strMod; usesStr = true; }
    const toHitVal = mod + profBonus - (state.exhaustion || 0);
    const toHit  = toHitVal >= 0 ? `+${toHitVal}` : `${toHitVal}`;
    // Rage adds its damage bonus to Strength-based melee attacks while active.
    const rageApplied = usesStr && isRaging();
    const dmgMod = mod + (rageApplied ? getRageDamageBonus() : 0);
    const modStr = dmgMod > 0 ? `+${dmgMod}` : dmgMod < 0 ? `${dmgMod}` : '';
    const damage = `${info.damageDice}${modStr}`;
    return { toHit, damage, damageType: info.damageType, range: info.range, rangeType: info.rangeType, rageApplied };
  }

  function computeUnarmedStrike() {
    const level = parseInt(state.level);
    const profBonus = (!isNaN(level) && level >= 1)
      ? Math.ceil(level / 4) + 1
      : (parseInt(state.proficiency) || 2);
    const strScore = parseInt(state.str);
    const strMod = !isNaN(strScore) ? Math.floor((strScore - 10) / 2) : 0;
    const toHitVal = strMod + profBonus - (state.exhaustion || 0);
    const toHit = toHitVal >= 0 ? `+${toHitVal}` : `${toHitVal}`;
    const rageApplied = isRaging();
    const damage = String(Math.max(1, 1 + strMod + (rageApplied ? getRageDamageBonus() : 0)));
    return { toHit, damage, range: 'Melee', rageApplied };
  }

  function syncEquippedContainer() {
    const containers = state.containers.filter(c => c.id === 'equipped' || c.id === 'strapped');
    if (!containers.length) return;
    let foundArmor = null;
    let foundShield = null;
    for (const container of containers) {
      for (const row of container.slots) {
        for (const slot of row) {
          if (!slot) continue;
          const cat = getEffectiveCategory(slot);
          if (!foundArmor && cat === 'armor') foundArmor = computeDisplayName(slot);
          if (!foundShield && cat === 'shield') foundShield = computeDisplayName(slot);
        }
      }
    }
    let changed = false;
    const newArmor = foundArmor || '';
    if (state.equippedArmor !== newArmor) {
      state.equippedArmor = newArmor;
      if (newArmor) state.armorActive = true;
      state.ac = '';
      if (armorSelectEl) armorSelectEl.value = state.equippedArmor;
      updateArmorDisplay();
      changed = true;
    }
    const newShield = foundShield || '';
    if (state.equippedShield !== newShield) {
      state.equippedShield = newShield;
      state.shieldActive = !!newShield;
      state.ac = '';
      if (shieldSelectEl) shieldSelectEl.value = state.equippedShield;
      updateShieldDisplay();
      changed = true;
    }
    if (changed) updateCsCalculations();
  }

  function initAttackDrag(handle, rowEl, listEl) {
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      rowEl.classList.add('cs-attack-dragging');

      const onMove = ev => {
        const allRows = [...listEl.querySelectorAll('[data-attack-key]')];
        let inserted = false;
        for (let i = 0; i < allRows.length; i++) {
          if (allRows[i] === rowEl) continue;
          const rect = allRows[i].getBoundingClientRect();
          if (ev.clientY < rect.top + rect.height / 2) {
            listEl.insertBefore(rowEl, allRows[i]);
            inserted = true;
            break;
          }
        }
        if (!inserted) listEl.appendChild(rowEl);
      };

      const onUp = () => {
        rowEl.classList.remove('cs-attack-dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const allRows = [...listEl.querySelectorAll('[data-attack-key]')];
        state.attackOrder = allRows.map(r => r.dataset.attackKey);
        if (onChange) onChange();
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  function makeAttackInput(placeholder, savedObj, field, auto, boostClass) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    const saved = savedObj[field] || '';
    const isAuto = !saved && !!auto;
    input.value = isAuto ? auto : saved;
    input.classList.toggle('cs-auto', isAuto);
    if (field === 'toHit' && isAuto && state.exhaustion > 0) input.classList.add('cs-exh-penalty');
    if (isAuto && boostClass) input.classList.add(boostClass);
    input.addEventListener('input', () => {
      savedObj[field] = input.value;
      input.classList.remove('cs-auto', 'cs-exh-penalty');
      if (boostClass) input.classList.remove(boostClass);
      if (onChange) onChange();
    });
    input.addEventListener('blur', () => {
      if (!input.value.trim() && auto) {
        savedObj[field] = '';
        input.value = auto;
        input.classList.add('cs-auto');
        if (state.exhaustion > 0) input.classList.add('cs-exh-penalty');
        if (boostClass) input.classList.add(boostClass);
      }
    });
    return input;
  }

  function makeRangeCell(savedObj, rangeVal, rangeType) {
    const cell = document.createElement('div');
    cell.className = 'cs-attack-range-cell';
    cell.appendChild(makeAttackInput('Melee', savedObj, 'range', rangeVal));
    if (rangeType) {
      const badge = document.createElement('span');
      badge.className = 'cs-attack-dmg-type-badge';
      badge.textContent = rangeType;
      cell.appendChild(badge);
    }
    return cell;
  }

  function makeInvDamageCell(placeholder, savedObj, field, autoVal, damageType, boostClass) {
    const cell = document.createElement('div');
    cell.className = 'cs-attack-dmg-cell';
    cell.appendChild(makeAttackInput(placeholder, savedObj, field, autoVal, boostClass));
    if (damageType) {
      const badge = document.createElement('span');
      badge.className = 'cs-attack-dmg-type-badge';
      badge.textContent = damageType;
      cell.appendChild(badge);
    }
    return cell;
  }

  function renderAttacks() {
    if (!attacksList) return;
    attacksList.innerHTML = '';

    // ── Unarmed Strike (permanent, always first) ──────────────────
    const unarmedStats = computeUnarmedStrike();
    if (!state.weaponAttackData['__unarmed__']) state.weaponAttackData['__unarmed__'] = {};
    const unarmedData = state.weaponAttackData['__unarmed__'];
    const unarmedRow = document.createElement('div');
    unarmedRow.className = 'cs-attack-inv-row cs-attack-unarmed';
    unarmedRow.appendChild(document.createElement('span'));
    const unarmedNameCell = document.createElement('div');
    unarmedNameCell.className = 'cs-attack-name-cell';
    const unarmedLbl = document.createElement('span');
    unarmedLbl.className = 'cs-attack-unarmed-name';
    unarmedLbl.textContent = 'Unarmed Strike';
    unarmedNameCell.appendChild(unarmedLbl);
    unarmedRow.appendChild(unarmedNameCell);
    unarmedRow.appendChild(makeRangeCell(unarmedData, unarmedStats.range, null));
    unarmedRow.appendChild(makeAttackInput('+0', unarmedData, 'toHit', unarmedStats.toHit));
    unarmedRow.appendChild(makeInvDamageCell('1', unarmedData, 'damage', unarmedStats.damage, 'Bludgeoning', unarmedStats.rageApplied ? 'cs-rage-boost' : ''));
    unarmedRow.appendChild(document.createElement('span'));
    attacksList.appendChild(unarmedRow);

    // ── Sortable attacks ──────────────────────────────────────────
    const invWeapons = getInventoryWeapons();
    if (!invWeapons.length && !state.attacks.length) return;

    const allItems = [
      ...invWeapons.map(w => ({ type: 'inv', key: 'inv:' + w.displayName, weapon: w })),
      ...state.attacks.map(atk => ({ type: 'manual', key: 'manual:' + atk.id, atk })),
    ];
    const orderMap = new Map(state.attackOrder.map((k, i) => [k, i]));
    allItems.sort((a, b) => {
      const ia = orderMap.has(a.key) ? orderMap.get(a.key) : Infinity;
      const ib = orderMap.has(b.key) ? orderMap.get(b.key) : Infinity;
      return ia - ib;
    });

    allItems.forEach(item => {
      const row = document.createElement('div');
      row.dataset.attackKey = item.key;

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'cs-attack-drag-handle';
      handle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
      handle.title = 'Drag to reorder';
      row.appendChild(handle);
      initAttackDrag(handle, row, attacksList);

      if (item.type === 'inv') {
        const weapon = item.weapon;
        row.className = 'cs-attack-inv-row';
        row.dataset.attackKey = item.key;

        const nameCell = document.createElement('div');
        nameCell.className = 'cs-attack-name-cell';
        const nameBtn = document.createElement('button');
        nameBtn.type = 'button';
        nameBtn.className = 'cs-attack-weapon-name';
        nameBtn.textContent = weapon.displayName;
        nameBtn.addEventListener('click', () => {
          toggleInspectorFor(weapon.key, weapon.slotData, weapon.container, weapon.r, weapon.c);
        });
        nameCell.appendChild(nameBtn);
        const nameLabel = document.createElement('span');
        nameLabel.className = 'cs-attack-weapon-label';
        nameLabel.textContent = weapon.displayName;
        nameCell.appendChild(nameLabel);
        row.appendChild(nameCell);

        if (!state.weaponAttackData[weapon.displayName]) state.weaponAttackData[weapon.displayName] = {};
        const wepData = state.weaponAttackData[weapon.displayName];
        const autoStats = computeWeaponAutoStats(weapon.slotData);
        row.appendChild(makeRangeCell(wepData, autoStats ? autoStats.range : 'Melee', autoStats ? autoStats.rangeType : null));
        row.appendChild(makeAttackInput('+0', wepData, 'toHit', autoStats ? autoStats.toHit : ''));
        row.appendChild(makeInvDamageCell('1d6', wepData, 'damage', autoStats ? autoStats.damage : '', autoStats ? autoStats.damageType : null, (autoStats && autoStats.rageApplied) ? 'cs-rage-boost' : ''));
        row.appendChild(document.createElement('span'));

      } else {
        const atk = item.atk;
        const i = state.attacks.indexOf(atk);
        row.className = 'cs-attack-row';
        row.dataset.attackKey = item.key;

        ['name', 'range', 'toHit'].forEach(field => {
          const ph = field === 'name' ? 'Attack name' : field === 'range' ? 'Range' : '+0';
          const input = document.createElement('input');
          input.type = 'text'; input.placeholder = ph; input.autocomplete = 'off';
          input.value = atk[field] || '';
          input.addEventListener('input', () => { state.attacks[i][field] = input.value; if (onChange) onChange(); });
          row.appendChild(input);
        });

        const dmgInput = document.createElement('input');
        dmgInput.type = 'text'; dmgInput.placeholder = '1d6'; dmgInput.autocomplete = 'off';
        dmgInput.value = atk.damage || '';
        dmgInput.addEventListener('input', () => { state.attacks[i].damage = dmgInput.value; if (onChange) onChange(); });
        row.appendChild(dmgInput);
        const del = document.createElement('button');
        del.className = 'cs-attack-del';
        del.title = 'Remove';
        del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        del.addEventListener('click', () => {
          state.attacks.splice(i, 1);
          state.attackOrder = state.attackOrder.filter(k => k !== item.key);
          renderAttacks();
          if (onChange) onChange();
        });
        row.appendChild(del);
      }

      attacksList.appendChild(row);
    });
  }

  if (attacksAddBtn) {
    attacksAddBtn.addEventListener('click', () => {
      state.attacks.push({ id: Date.now(), name: '', range: '', toHit: '', damage: '' });
      renderAttacks();
      if (onChange) onChange();
      const inputs = attacksList.querySelectorAll('.cs-attack-row input');
      if (inputs.length) inputs[inputs.length - 4].focus();
    });
  }

  renderAttacks();

  // ── SHARED HELPERS ────────────────────────────────────────────────────────
  function findSlotByDisplayName(displayName) {
    for (const container of state.containers) {
      for (let r = 0; r < container.slots.length; r++) {
        for (let c = 0; c < container.slots[r].length; c++) {
          const slot = container.slots[r][c];
          if (!slot) continue;
          if (computeDisplayName(slot) === displayName) {
            return { slotData: slot, container, r, c, key: `${container.id}-${r}-${c}` };
          }
        }
      }
    }
    return null;
  }

  function populateCategoryDatalist(datalist, category) {
    if (!datalist) return;
    datalist.innerHTML = '';
    const seen = new Set();
    for (const container of state.containers) {
      for (const row of container.slots) {
        for (const slot of row) {
          if (!slot) continue;
          if (getEffectiveCategory(slot) !== category) continue;
          const displayName = computeDisplayName(slot);
          if (seen.has(displayName)) continue;
          seen.add(displayName);
          const opt = document.createElement('option');
          opt.value = displayName;
          datalist.appendChild(opt);
        }
      }
    }
  }

  // ── SHIELD SELECTOR ───────────────────────────────────────────────────────
  const shieldSelectEl  = document.getElementById('cs-shield-select');
  const shieldDatalist  = document.getElementById('cs-shield-options');
  const shieldViewEl    = document.getElementById('cs-shield-view') || document.querySelector('.cs-shield-view');
  const shieldToggleBtn = document.getElementById('cs-shield-toggle');
  const shieldDisplayBtn = document.getElementById('cs-shield-display');

  function populateShieldDatalist() { populateCategoryDatalist(shieldDatalist, 'shield'); }

  function updateShieldDisplay() {
    if (!shieldViewEl) return;
    if (state.equippedShield) {
      shieldViewEl.hidden = false;
      if (shieldDisplayBtn) {
        shieldDisplayBtn.textContent = state.equippedShield;
        shieldDisplayBtn.classList.remove('cs-empty');
        const found = !!findSlotByDisplayName(state.equippedShield);
        shieldDisplayBtn.classList.toggle('cs-item-missing', !found);
        shieldDisplayBtn.classList.toggle('cs-disabled', !state.shieldActive);
      }
      if (shieldToggleBtn) {
        shieldToggleBtn.textContent = state.shieldActive ? '●' : '○';
        shieldToggleBtn.classList.toggle('cs-shield-on', !!state.shieldActive);
      }
    } else {
      shieldViewEl.hidden = true;
    }
  }

  function applyEquippedShield(name) {
    state.equippedShield = name || '';
    if (shieldSelectEl) shieldSelectEl.value = state.equippedShield;
    if (state.equippedShield && !state.shieldActive) state.shieldActive = true;
    if (!state.equippedShield) state.shieldActive = false;
    updateShieldDisplay();
    state.ac = '';
    updateCsCalculations();
    if (onChange) onChange();
  }

  if (shieldSelectEl) {
    shieldSelectEl.value = state.equippedShield || '';
    shieldSelectEl.addEventListener('change', () => applyEquippedShield(shieldSelectEl.value.trim()));
    shieldSelectEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { shieldSelectEl.blur(); applyEquippedShield(shieldSelectEl.value.trim()); }
    });
    shieldSelectEl.addEventListener('blur', () => {
      if (shieldSelectEl.value.trim() === '') applyEquippedShield('');
    });
  }

  if (shieldToggleBtn) {
    shieldToggleBtn.addEventListener('click', () => {
      state.shieldActive = !state.shieldActive;
      updateShieldDisplay();
      state.ac = '';
      updateCsCalculations();
      if (onChange) onChange();
    });
  }

  if (shieldDisplayBtn) {
    shieldDisplayBtn.addEventListener('click', () => {
      const found = findSlotByDisplayName(state.equippedShield);
      if (!found) return;
      toggleInspectorFor(found.key, found.slotData, found.container, found.r, found.c);
    });
  }

  updateShieldDisplay();
  populateShieldDatalist();

  // ── ARMOR SELECTOR ────────────────────────────────────────────────────────
  const armorSelectEl = document.getElementById('cs-armor-select');
  const armorDatalist = document.getElementById('cs-armor-options');

  function populateArmorDatalist() { populateCategoryDatalist(armorDatalist, 'armor'); }

  const armorToggleBtn  = document.getElementById('cs-armor-toggle');
  const armorDisplayBtn = document.getElementById('cs-armor-display');

  function updateArmorDisplay() {
    if (!armorDisplayBtn) return;
    if (state.equippedArmor) {
      if (armorToggleBtn) {
        armorToggleBtn.hidden = false;
        armorToggleBtn.textContent = state.armorActive ? '●' : '○';
        armorToggleBtn.classList.toggle('cs-armor-on', !!state.armorActive);
      }
      armorDisplayBtn.textContent = state.equippedArmor;
      const found = !!findSlotByDisplayName(state.equippedArmor);
      armorDisplayBtn.classList.remove('cs-empty');
      armorDisplayBtn.classList.toggle('cs-item-missing', !found);
      armorDisplayBtn.classList.toggle('cs-disabled', !state.armorActive);
    } else {
      if (armorToggleBtn) armorToggleBtn.hidden = true;
      armorDisplayBtn.textContent = '—';
      armorDisplayBtn.classList.remove('cs-item-missing', 'cs-disabled');
      armorDisplayBtn.classList.add('cs-empty');
    }
  }

  function applyEquippedArmor(name) {
    state.equippedArmor = name || '';
    if (state.equippedArmor) state.armorActive = true;
    if (armorSelectEl) armorSelectEl.value = state.equippedArmor;
    updateArmorDisplay();
    state.ac = '';
    updateCsCalculations();
    if (onChange) onChange();
  }

  if (armorSelectEl) {
    armorSelectEl.value = state.equippedArmor || '';
    armorSelectEl.addEventListener('change', () => applyEquippedArmor(armorSelectEl.value.trim()));
    armorSelectEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { armorSelectEl.blur(); applyEquippedArmor(armorSelectEl.value.trim()); }
    });
    armorSelectEl.addEventListener('blur', () => {
      if (armorSelectEl.value.trim() === '') applyEquippedArmor('');
    });
  }

  if (armorToggleBtn) {
    armorToggleBtn.addEventListener('click', () => {
      state.armorActive = !state.armorActive;
      updateArmorDisplay();
      state.ac = '';
      updateCsCalculations();
      if (onChange) onChange();
    });
  }

  if (armorDisplayBtn) {
    updateArmorDisplay();
    armorDisplayBtn.addEventListener('click', () => {
      const found = findSlotByDisplayName(state.equippedArmor);
      if (!found) return;
      toggleInspectorFor(found.key, found.slotData, found.container, found.r, found.c);
    });
  }

  populateArmorDatalist();

  const attacksToggle = document.getElementById('cs-attacks-toggle');
  const attacksBody   = document.getElementById('cs-attacks-body');
  if (attacksToggle && attacksBody) {
    attacksToggle.addEventListener('click', () => {
      const open = attacksBody.hidden;
      attacksBody.hidden = !open;
      attacksToggle.setAttribute('aria-expanded', String(open));
      attacksToggle.classList.toggle('cs-attacks-open', open);
    });
  }

  const otherProfsToggle = document.getElementById('cs-other-profs-toggle');
  const otherProfsBody   = document.getElementById('cs-other-profs-body');
  if (otherProfsToggle && otherProfsBody) {
    otherProfsToggle.addEventListener('click', () => {
      const open = otherProfsBody.hidden;
      otherProfsBody.hidden = !open;
      otherProfsToggle.setAttribute('aria-expanded', String(open));
      otherProfsToggle.classList.toggle('cs-other-profs-open', open);
    });
  }

  // ── INSPIRATION ───────────────────────────────────────────────
  function updateInspirationDisplay() {
    const btn = document.getElementById('cs-inspiration-toggle');
    if (btn) btn.classList.toggle('cs-on', state.inspiration);
  }
  const inspirationBtn = document.getElementById('cs-inspiration-toggle');
  if (inspirationBtn) {
    inspirationBtn.addEventListener('click', () => {
      state.inspiration = !state.inspiration;
      updateInspirationDisplay();
      if (onChange) onChange();
    });
  }
  updateInspirationDisplay();

  // ── DEATH SAVES ───────────────────────────────────────────────
  function updateDeathSavesDisplay() {
    document.querySelectorAll('.cs-death-save-dot').forEach(dot => {
      const isSuccess = dot.dataset.type === 'success';
      const filled = +dot.dataset.level <= (isSuccess ? state.deathSaves.successes : state.deathSaves.failures);
      dot.classList.toggle('cs-on-success', isSuccess && filled);
      dot.classList.toggle('cs-on-failure',  !isSuccess && filled);
      const icon = dot.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-regular', !filled);
        icon.classList.toggle('fa-solid',    filled);
      }
    });
    const anyActive = state.deathSaves.successes > 0 || state.deathSaves.failures > 0;
    const skull = document.querySelector('.cs-ds-skull');
    if (skull) skull.classList.toggle('cs-ds-active', anyActive);
    document.querySelector('.cs-death-saves')?.classList.toggle('cs-ds-active', anyActive);
  }
  document.querySelectorAll('.cs-death-save-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const isSuccess = dot.dataset.type === 'success';
      const key = isSuccess ? 'successes' : 'failures';
      const lvl = +dot.dataset.level;
      state.deathSaves[key] = state.deathSaves[key] === lvl ? lvl - 1 : lvl;
      updateDeathSavesDisplay();
      if (onChange) onChange();
    });
  });
  updateDeathSavesDisplay();

  // ── EXHAUSTION ────────────────────────────────────────────────
  function updateExhaustionDisplay() {
    const exh = state.exhaustion;
    const countEl = document.getElementById('cs-exh-count');
    if (countEl) countEl.textContent = exh;
    document.getElementById('cs-exh-minus')?.toggleAttribute('disabled', exh <= 0);
    document.getElementById('cs-exh-plus') ?.toggleAttribute('disabled', exh >= 6);
    document.querySelector('.cs-exhaustion')?.classList.toggle('cs-exh-warning', exh > 0);
  }
  document.getElementById('cs-exh-minus')?.addEventListener('click', () => {
    if (state.exhaustion > 0) { state.exhaustion--; updateExhaustionDisplay(); updateCsCalculations(); if (onChange) onChange(); }
  });
  document.getElementById('cs-exh-plus')?.addEventListener('click', () => {
    if (state.exhaustion < 6) { state.exhaustion++; updateExhaustionDisplay(); updateCsCalculations(); if (onChange) onChange(); }
  });
  updateExhaustionDisplay();

  // ── FULL REST / SHORT REST ────────────────────────────────────────────────
  function lockRestBtn(btn) {
    if (!btn || btn.classList.contains('cs-rest-done')) return false;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    btn.classList.add('cs-rest-done');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove('cs-rest-done');
    }, 1000);
    return true;
  }

  document.getElementById('cs-long-rest-btn')?.addEventListener('click', () => {
    if (!lockRestBtn(document.getElementById('cs-long-rest-btn'))) return;
    const hpMaxEl = document.getElementById('cs-hp-max');
    const hpMax = parseInt(hpMaxEl?.value) || 0;
    if (hpMax > 0) {
      state.hp = String(hpMax);
      const hpEl = document.getElementById('cs-hp');
      if (hpEl) hpEl.value = state.hp;
    }
    state.tempHp = '';
    const tempEl = document.getElementById('cs-temp-hp');
    if (tempEl) tempEl.value = '';
    state.deathSaves = { successes: 0, failures: 0 };
    updateDeathSavesDisplay();
    if (state.exhaustion > 0) { state.exhaustion--; updateExhaustionDisplay(); }
    const hdCountEl = document.getElementById('cs-hit-dice-count');
    const totalDice = parseInt(hdCountEl?.value) || parseInt(state.hitDiceCount) || 1;
    const currentDice = parseInt(state.hitDiceRemaining) || 0;
    state.hitDiceRemaining = String(totalDice);
    const hdEl = document.getElementById('cs-hit-dice-remaining');
    if (hdEl) hdEl.value = state.hitDiceRemaining;
    if (state.featureData['sorcerer-spellcasting']) {
      state.featureData['sorcerer-spellcasting'].usedSlots = {};
    }
    if (state.featureData['ranger-spellcasting']) {
      state.featureData['ranger-spellcasting'].usedSlots = {};
    }
    if (state.featureData['ranger-favored-enemy']) {
      state.featureData['ranger-favored-enemy'].used = 0;
    }
    if (state.featureData['vile-fang-fangs-dripping']) {
      state.featureData['vile-fang-fangs-dripping'].used = 0;
    }
    if (state.featureData['witch-warden-witchmarks']) {
      state.featureData['witch-warden-witchmarks'].used = 0;
    }
    if (state.featureData['barbarian-rage']) {
      state.featureData['barbarian-rage'].used = 0;
      state.featureData['barbarian-rage'].active = false;
    }
    if (state.featureData['sorcerer-innate-sorcery']) {
      state.featureData['sorcerer-innate-sorcery'].innateSorceryUsed = 0;
    }
    if (state.featureData['sorcerer-sorcerous-restoration']) {
      state.featureData['sorcerer-sorcerous-restoration'].used = 0;
    }
    if (state.featureData['sorcerer-font-of-magic']) {
      const fd = state.featureData['sorcerer-font-of-magic'];
      fd.current = fd.fontMax ?? (parseInt(state.level) || 1);
    }
    if (state.activeFeatures.includes('human-determination') && !state.inspiration) {
      state.inspiration = true;
      updateInspirationDisplay();
    }
    updateCsCalculations();
    renderFeatures();
    if (onChange) onChange();
  });

  document.getElementById('cs-short-rest-btn')?.addEventListener('click', () => {
    if (!lockRestBtn(document.getElementById('cs-short-rest-btn'))) return;
    state.deathSaves = { successes: 0, failures: 0 };
    updateDeathSavesDisplay();
    if (state.featureData['vile-fang-fangs-dripping']) {
      state.featureData['vile-fang-fangs-dripping'].used = 0;
    }
    if (state.featureData['witch-warden-witchmarks']) {
      state.featureData['witch-warden-witchmarks'].used = 0;
    }
    if (state.featureData['barbarian-rage']) {
      const fd = state.featureData['barbarian-rage'];
      fd.used = Math.max(0, (fd.used || 0) - 1);
    }
    updateCsCalculations();
    renderFeatures();
    if (onChange) onChange();
  });

  function autoResizeTextarea(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }
  ['cs-languages','cs-tools-prof','cs-weapons-prof','cs-armor-prof'].forEach(id => {
    const ta = document.getElementById(id);
    if (!ta) return;
    ta.addEventListener('input', () => autoResizeTextarea(ta));
  });

  const SUBCLASS_MAP = {
    'Barbarian': ['Path of the Cursed'],
    'Sorcerer':  ['Spell Drinker'],
    'Rogue':     ['Vile Fang'],
    'Ranger':    ['Witch Warden'],
  };

  const subclassEl   = document.getElementById('cs-subclass');
  const subclassDl   = document.getElementById('cs-subclass-list');

  function syncSubclassOptions() {
    if (!subclassEl || !subclassDl) return;
    const cls      = String(state.charClass || '').trim();
    const options  = SUBCLASS_MAP[cls] || [];
    subclassDl.innerHTML = options.map(o => `<option value="${o}">`).join('');
    if (options.length === 1 && !state.subclass) {
      subclassEl.value = options[0];
      state.subclass   = options[0];
    } else if (!options.includes(state.subclass || '')) {
      subclassEl.value = '';
      state.subclass   = '';
    }
  }

  const classEl = document.getElementById('cs-class');
  if (classEl) {
    classEl.addEventListener('input', () => {
      const classKey = String(state.charClass || '').toLowerCase().trim();
      const profs = CLASS_SAVE_PROFS[classKey];
      if (profs) {
        ['str','dex','con','int','wis','cha'].forEach(ab => {
          state[`${ab}SaveProf`] = profs.includes(ab);
        });
        updateProfButtons();
        updateCsCalculations();
      }
      syncSubclassOptions();
      syncFeatures();
      renderFeatures();
      if (onChange) onChange();
    });
  }

  syncSubclassOptions();

  // Re-sync features when subclass or level changes
  ['cs-subclass', 'cs-level', 'cs-race'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncFeatures(); renderFeatures();
    });
  });

  ['str','dex','con','int','wis','cha'].forEach(ab => {
    const scoreEl = document.getElementById(`cs-${ab}`);
    const modEl   = document.getElementById(`cs-${ab}-mod`);
    if (!scoreEl || !modEl) return;
    scoreEl.addEventListener('input', e => {
      modEl.textContent = abilityMod(e.target.value);
      updateCsCalculations();
    });
  });
  document.querySelectorAll('.cs-skill-dot[data-prof-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!document.getElementById('stats-panel').classList.contains('editing')) return;
      const key = btn.dataset.profKey;
      state[key] = !state[key];
      updateProfButtons();
      updateCsCalculations();
      if (onChange) onChange();
    });
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
          growContainer(linked);
          const freeSlot = findEmptySlot(linked, -1);
          if (freeSlot) {
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
        if (inspectorItemKey !== key || detailPanelEl.classList.contains('detail-collapsed')) {
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
      const csState   = Object.fromEntries(CS_FIELDS.map(([, k]) => [k, state[k] || '']));
      const profState = Object.fromEntries(PROF_KEYS.map(k => [k, !!state[k]]));
      return JSON.parse(JSON.stringify({
        charName:      state.charName,
        carryCapacity: state.carryCapacity,
        containers:    state.containers,
        attacks:          state.attacks,
        attackOrder:      state.attackOrder,
        weaponAttackData: state.weaponAttackData,
        equippedArmor:    state.equippedArmor,
        armorActive:    state.armorActive,
        equippedShield: state.equippedShield,
        shieldActive:   state.shieldActive,
        inspiration:  state.inspiration,
        deathSaves:   state.deathSaves,
        exhaustion:   state.exhaustion,
        subrace:          state.subrace,
        activeFeatures:   state.activeFeatures,
        hiddenFeatures:   state.hiddenFeatures,
        featureData:      state.featureData,
        featureCollapsed: state.featureCollapsed,
        ...csState,
        ...profState,
      }));
    },
    flattenGroups(containers) { flattenPackableGroups(containers); },
    updateCs() { updateCsCalculations(); },


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

    closeInspector() {
      hideInspector(true);
      render();
    },
    collapsePanelInstant() {
      detailPanelEl.classList.add('no-transition', 'detail-collapsed');
      detailPanelEl.style.height = '';
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
    loadState(newState, opts) {
      if (dragState) {
        // cancelDrag() should have been called before loadState; just clean up UI
        if (ghostEl) { ghostEl.remove(); ghostEl = null; }
        document.body.classList.remove('is-dragging');
        dragState = null;
      }
      if (!(opts && opts.keepInspector)) hideInspector(true);
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
      if (newState.hitDice && !newState.hitDiceCount) {
        const match = String(newState.hitDice).match(/^(\d+)(d\d+)$/i);
        if (match) { newState = { ...newState, hitDiceCount: match[1], hitDiceType: match[2].toLowerCase() }; }
      }
      CS_FIELDS.forEach(([id, k]) => {
        state[k] = newState[k] || '';
        const el = document.getElementById(id);
        if (el) {
          el.value = state[k];
          if (el.tagName === 'TEXTAREA') autoResizeTextarea(el);
        }
      });
      state.attacks = Array.isArray(newState.attacks) ? newState.attacks : [];
      state.attacks.forEach(atk => { if (!atk.id) atk.id = Date.now() + Math.floor(Math.random() * 1e6); });
      state.attackOrder = Array.isArray(newState.attackOrder) ? newState.attackOrder : [];
      state.weaponAttackData = (newState.weaponAttackData && typeof newState.weaponAttackData === 'object') ? newState.weaponAttackData : {};
      state.equippedArmor  = newState.equippedArmor  || '';
      state.armorActive    = newState.armorActive != null ? !!newState.armorActive : true;
      state.equippedShield = newState.equippedShield || '';
      state.shieldActive   = !!newState.shieldActive;
      state.inspiration = !!newState.inspiration;
      const _ds = newState.deathSaves;
      const _toCount = v => Array.isArray(v) ? v.filter(Boolean).length : (typeof v === 'number' ? Math.max(0, Math.min(3, v)) : 0);
      state.deathSaves = _ds && typeof _ds === 'object'
        ? { successes: _toCount(_ds.successes), failures: _toCount(_ds.failures) }
        : { successes: 0, failures: 0 };
      state.exhaustion      = typeof newState.exhaustion === 'number' ? Math.max(0, Math.min(6, newState.exhaustion)) : 0;
      state.subrace         = newState.subrace || '';
      state.activeFeatures  = Array.isArray(newState.activeFeatures)  ? newState.activeFeatures  : [];
      state.hiddenFeatures  = Array.isArray(newState.hiddenFeatures)   ? newState.hiddenFeatures  : [];
      state.featureData     = (newState.featureData && typeof newState.featureData === 'object') ? newState.featureData : {};
      state.featureCollapsed = (newState.featureCollapsed && typeof newState.featureCollapsed === 'object') ? newState.featureCollapsed : {};
      updateInspirationDisplay();
      updateDeathSavesDisplay();
      updateExhaustionDisplay();
      if (armorSelectEl)  armorSelectEl.value  = state.equippedArmor;
      if (shieldSelectEl) shieldSelectEl.value = state.equippedShield;
      updateArmorDisplay();
      updateShieldDisplay();
      PROF_KEYS.forEach(k => { state[k] = !!newState[k]; });
      ['str','dex','con','int','wis','cha'].forEach(ab => {
        const modEl = document.getElementById(`cs-${ab}-mod`);
        if (modEl) modEl.textContent = abilityMod(state[ab]);
      });
      updateProfButtons();
      updateCsCalculations();
      updateCsNameDisplay();
      renderAttacks();
      syncFeatures();
      renderFeatures();
      populateArmorDatalist();
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

  // ── HISTORY / BACK-BUTTON NAVIGATION ─────────────────────────────────────
  // _navCalc bridges calculator state (inside InventorySystem scope) to here.
  window._navCalc = { open: false, suppress: false, handling: false, hide: null };
  let _suppressPopstate = false;
  let _handlingPopstate = false;

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

  // Hoisted above _applyViewMode so the initial _applyViewMode() call (which now
  // refreshes the inventory/character toggle) doesn't hit a temporal-dead-zone.
  let statsOpen = true;
  let shopOpen  = false;
  const charSheetToggleBtn = document.getElementById('char-sheet-toggle-btn');
  const charSheetToggleI   = charSheetToggleBtn.querySelector('i');

  // The top-left toggle. In inventory/character mode it switches between the two
  // sub-views; in hexmap/shop mode it shows the view you'd return to (the last
  // sub-view) so clicking it brings you back there.
  function updateCharSheetToggle() {
    const away = _hexmapMode || shopOpen;
    // `destInventory` = the view a click will land you on, which drives the icon.
    const destInventory = away ? !statsOpen : statsOpen;
    charSheetToggleI.className = destInventory ? 'fa-solid fa-sack-xmark' : 'fa-solid fa-user';
    charSheetToggleBtn.title   = destInventory ? 'Inventory' : 'Character sheet';
  }

  function _applyViewMode() {
    document.getElementById('app').classList.toggle('hexmap-mode', _hexmapMode);
    updateCharSheetToggle();
  }

  // Open the hex map, closing the shop/character view. Not a toggle — it only
  // ever goes to the map (it's hidden while already on the map).
  _closeBtn.addEventListener('click', () => {
    if (shopOpen) { _shopFromHexmap = true; closeShop(); return; }
    _hexmapMode = true;
    inv.collapsePanelInstant();
    _applyViewMode();
    window.hexOnGoToHexmap && window.hexOnGoToHexmap();
    deselectChar();
    if (!_handlingPopstate) { _suppressPopstate = true; history.back(); }
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
  history.replaceState({ view: 'hexmap' }, '');
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
      if (e.data.overlayIcon) _hexOverlayBtn.querySelector('i').className = e.data.overlayIcon;
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

  // ── STATS ───────────────────────────────────────────────────────────────
  // statsOpen / charSheetToggleBtn / charSheetToggleI are declared above (with
  // the view toggle) so the initial _applyViewMode() can refresh the toggle.
  let statsEditing = false;
  const statsPanelEl       = document.getElementById('stats-panel');
  const charPanelsEl       = document.getElementById('char-panels');
  const charFieldsEditBtn  = document.getElementById('char-fields-edit-btn');

  function canEditCurrentChar() {
    if (window._isDM) return true;
    if (!currentUser || !currentCharId) return false;
    return (allChars[currentCharId]?.ownerUid || '') === currentUser.uid;
  }

  function updateEditBtn() {
    const canEdit = canEditCurrentChar();
    charFieldsEditBtn.hidden = !canEdit;
    statsPanelEl.classList.toggle('char-view-only', !canEdit);
  }

  function setStatsEditing(on) {
    statsEditing = on;
    statsPanelEl.classList.toggle('editing', on);
    charFieldsEditBtn.classList.toggle('active', on);
    charHeaderEl.classList.toggle('fields-open', on);
    if (inv) inv.updateCs();
  }

  function openStats() {
    statsOpen = true;
    charPanelsEl.classList.remove('show-inventory');
    updateCharSheetToggle();
    updateEditBtn();
  }

  function closeStats() {
    statsOpen = false;
    setStatsEditing(false);
    charPanelsEl.classList.add('show-inventory');
    updateCharSheetToggle();
  }

  // Return to the inventory/character view (restoring the last sub-view) from
  // wherever we are. Used when the toggle is clicked in hexmap or shop mode.
  function returnToCharView() {
    if (shopOpen) {
      _shopFromHexmap = false;   // go back to the character view, not the map
      closeShop();
      return;
    }
    if (_hexmapMode) {
      _hexmapMode = false;
      inv.collapsePanelInstant();
      _applyViewMode();
      window.hexOnGoToInventory && window.hexOnGoToInventory();
      ensureCharSelected();
      if (!_handlingPopstate) history.pushState({ view: 'inventory' }, '');
    }
  }

  charSheetToggleBtn.addEventListener('click', () => {
    if (_hexmapMode || shopOpen) returnToCharView();
    else if (statsOpen) closeStats();
    else openStats();
  });

  charFieldsEditBtn.addEventListener('click', () => {
    setStatsEditing(!statsEditing);
  });

  // shopOpen declared above with the view toggle.
  const shopTabBtn  = document.getElementById('shop-tab-btn');
  const shopPanel   = document.getElementById('shop-panel');
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

    // ── DM RANDOMIZER PANEL ───────────────────────────────────────────────────
    if (window._isDM) {
      const RAND_EXCLUDED = new Set(['Currency', 'Valuables']);
      const sectionItems = {};
      let _rs = null, _rr = null;
      ITEM_LIBRARY.forEach(li => {
        if (li._section) { _rs = li._section; _rr = null; return; }
        if (li._rarity)  { _rr = li._rarity; return; }
        if (!li.name || li.shopHidden || RAND_EXCLUDED.has(_rs)) return;
        if (!_rs) return;
        if (!sectionItems[_rs]) sectionItems[_rs] = {};
        const rKey = _rr || '';
        if (!sectionItems[_rs][rKey]) sectionItems[_rs][rKey] = [];
        sectionItems[_rs][rKey].push(li);
      });

      const panel = document.createElement('div');
      panel.className = 'dm-randomizer';

      const heading = document.createElement('div');
      heading.className = 'dm-randomizer-heading';
      heading.textContent = 'Random Item';
      panel.appendChild(heading);

      const controls = document.createElement('div');
      controls.className = 'dm-randomizer-controls';

      const tableWrap = document.createElement('label');
      tableWrap.className = 'dm-rand-label';
      tableWrap.textContent = 'Table';
      const tableSelect = document.createElement('select');
      tableSelect.className = 'dm-rand-select';
      Object.keys(sectionItems).forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec; opt.textContent = sec;
        tableSelect.appendChild(opt);
      });
      if ([...tableSelect.options].some(o => o.value === 'Magical Items')) tableSelect.value = 'Magical Items';
      tableWrap.appendChild(tableSelect);
      controls.appendChild(tableWrap);

      const rarityWrap = document.createElement('label');
      rarityWrap.className = 'dm-rand-label';
      rarityWrap.textContent = 'Rarity';
      const raritySelect = document.createElement('select');
      raritySelect.className = 'dm-rand-select';
      rarityWrap.appendChild(raritySelect);
      controls.appendChild(rarityWrap);

      const randResult = document.createElement('div');
      randResult.className = 'dm-rand-result';
      randResult.hidden = true;

      function updateRarities() {
        raritySelect.innerHTML = '';
        const map = sectionItems[tableSelect.value] || {};
        const rarities = Object.keys(map).filter(r => r !== '');
        rarityWrap.hidden = rarities.length === 0;
        if (rarities.length) {
          [['__all__', 'Any'], ...rarities.map(r => [r, r])].forEach(([v, t]) => {
            const o = document.createElement('option'); o.value = v; o.textContent = t; raritySelect.appendChild(o);
          });
        }
      }
      tableSelect.addEventListener('change', () => { updateRarities(); randResult.hidden = true; });
      updateRarities();

      const btn = document.createElement('button');
      btn.className = 'dm-rand-btn';
      btn.textContent = 'Randomize';
      controls.appendChild(btn);

      panel.appendChild(controls);
      panel.appendChild(randResult);

      btn.addEventListener('click', () => {
        const map = sectionItems[tableSelect.value] || {};
        const rarity = rarityWrap.hidden ? '' : raritySelect.value;
        const pool = [];
        if (rarity === '__all__' || rarity === '') {
          Object.values(map).forEach(arr => pool.push(...arr));
        } else {
          pool.push(...(map[rarity] || []));
        }
        if (!pool.length) { randResult.innerHTML = '<em>No items in this selection.</em>'; randResult.hidden = false; return; }
        const item = pool[Math.floor(Math.random() * pool.length)];
        let itemRarity = '';
        let _is = null, _ir = null;
        for (const li of ITEM_LIBRARY) {
          if (li._section) { _is = li._section; _ir = null; continue; }
          if (li._rarity)  { _ir = li._rarity; continue; }
          if (li === item) { itemRarity = _ir || ''; break; }
        }

        // Dice cycling animation
        btn.disabled = true;
        btn.style.width  = btn.offsetWidth  + 'px';
        btn.style.height = btn.offsetHeight + 'px';
        randResult.hidden = true;
        const diceIcons = ['fa-dice-one','fa-dice-two','fa-dice-three','fa-dice-four','fa-dice-five','fa-dice-six'];
        const step = Math.floor(Math.random() * 5) + 1; // 1–5, never repeats same face
        let iconIdx = Math.floor(Math.random() * diceIcons.length);
        const nextIcon = () => { iconIdx = (iconIdx + step) % diceIcons.length; return diceIcons[iconIdx]; };
        const diceHtml = () => `<span class="dm-rand-dice-wrap"><i class="fas ${nextIcon()} dm-rand-dice-jump"></i><span class="dm-rand-dice-ground"></span></span>`;
        btn.innerHTML = diceHtml();
        const cycleInterval = setInterval(() => {
          btn.innerHTML = diceHtml();
        }, 350);

        setTimeout(() => {
          clearInterval(cycleInterval);
          btn.querySelector('.dm-rand-dice-jump')?.classList.remove('dm-rand-dice-jump');
        }, 1000);

        setTimeout(() => {
          btn.disabled = false;
          btn.style.width  = '';
          btn.style.height = '';
          btn.textContent = 'Randomize';

        randResult.innerHTML = '';
        randResult.hidden = false;

        const slotData = buildShopSlotData(
          item,
          item.variables?.weapon?.value || item.variables?.armor?.value || null,
          false, null,
          item.variables?.element?.value || null,
          shopCostToCp(item.cost)
        );

        const row = document.createElement('div');
        row.className = 'shop-item-row';
        row.dataset.itemName = item.name;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'shop-item-name';
        nameSpan.textContent = item.name;
        row.appendChild(nameSpan);

        const metaSpan = document.createElement('span');
        metaSpan.className = 'shop-item-cost';
        metaSpan.textContent = [itemRarity, item.cost].filter(Boolean).join(' · ');
        row.appendChild(metaSpan);

        row.addEventListener('click', e => {
          if (row._shopDragging) return;
          inv.toggleShopItem(slotData, `rand-${item.name}`);
        });

        row.style.touchAction = 'none';
        let lpTimer = null, lpX, lpY, lpPointerId, lpTracking = false;
        row.addEventListener('pointerdown', e => {
          if (e.button !== 0) return;
          lpX = e.clientX; lpY = e.clientY; lpPointerId = e.pointerId; lpTracking = true;
          lpTimer = setTimeout(() => {
            lpTimer = null;
            row._shopDragging = true;
            row.classList.add('shop-item-dragging');
            document.documentElement.setPointerCapture(lpPointerId);
            inv.startShopDrag(slotData, e.clientX, e.clientY);
            const cleanup = () => {
              row._shopDragging = false;
              row.classList.remove('shop-item-dragging');
              document.removeEventListener('pointerup', cleanup);
              document.removeEventListener('pointercancel', cleanup);
            };
            document.addEventListener('pointerup', cleanup);
            document.addEventListener('pointercancel', cleanup);
          }, 380);
        });
        row.addEventListener('pointermove', e => {
          if (!lpTracking) return;
          if ((e.clientX - lpX) ** 2 + (e.clientY - lpY) ** 2 > 64) {
            if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
            lpTracking = false;
          }
        });
        const cancelLP = () => {
          if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
          lpTracking = false;
          row._shopDragging = false;
          row.classList.remove('shop-item-dragging');
        };
        row.addEventListener('pointerup', cancelLP);
        row.addEventListener('pointercancel', cancelLP);

        randResult.appendChild(row);
        }, 1250); // end setTimeout
      });

      scroll.appendChild(panel);
    }
    // ── END DM RANDOMIZER ─────────────────────────────────────────────────────

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
        const blocked = !window._isDM && !isItemAvailable(item.name);
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
          if (!window._isDM && row.classList.contains('shop-item-unaffordable')) {
            flashText();
            return;
          }
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
    setStatsEditing(false);
    shopTabBtn.classList.add('active');
    charPanelsEl.hidden         = true;
    charFieldsEditBtn.hidden    = true;
    shopPanel.hidden            = false;
    inv.collapsePanelInstant();
    if (_hexmapMode) {
      _shopFromHexmap = true;
      _hexmapMode = false;
      _applyViewMode();
      window.hexOnGoToInventory && window.hexOnGoToInventory();
      ensureCharSelected();
    }
    inv.closeInspector();
    document.getElementById('shop-search').value = '';
    document.getElementById('shop-category').value = '';
    updateShopWallet();
    buildShop();
    updateCharSheetToggle();
    if (!_handlingPopstate) history.pushState({ view: 'shop' }, '');
  }

  function closeShop() {
    shopOpen = false;
    shopTabBtn.classList.remove('active');
    shopPanel.hidden          = true;
    charPanelsEl.hidden         = false;
    charSheetToggleBtn.hidden   = false;
    updateEditBtn();
    if (_shopFromHexmap) {
      _shopFromHexmap = false;
      deselectChar();
      _hexmapMode = true;
      inv.collapsePanelInstant();
      _applyViewMode();
      window.hexOnGoToHexmap && window.hexOnGoToHexmap();
    } else {
      inv.collapsePanelInstant();
      inv.closeInspector();
    }
    updateCharSheetToggle();
    if (!_handlingPopstate) { _suppressPopstate = true; history.back(); }
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

  const VISIBILITY_CYCLE = ['visible', 'inventory-only', 'hidden'];
  const VISIBILITY_ICON  = { 'visible': 'fa-eye', 'inventory-only': 'fa-eye-low-vision', 'hidden': 'fa-eye-slash' };
  const VISIBILITY_TITLE = {
    'visible':        'Fully visible — click to hide character sheet',
    'inventory-only': 'Inventory only — character sheet hidden from players — click to hide entirely',
    'hidden':         'Hidden entirely — click to make visible',
  };

  charHideBtn.addEventListener('click', () => {
    if (!currentCharId || !allChars[currentCharId]) return;
    const char = allChars[currentCharId];
    const idx  = VISIBILITY_CYCLE.indexOf(char.charVisibility || 'visible');
    char.charVisibility = VISIBILITY_CYCLE[(idx + 1) % VISIBILITY_CYCLE.length];
    database.ref(`/inventory_characters/${currentCharId}`).update({ charVisibility: char.charVisibility });
    updateCharHideBtn();
    renderTabs();
    enforceCharVisibility();
  });

  function updateCharHideBtn() {
    if (!window._isDM) return;
    const vis = (currentCharId && allChars[currentCharId]?.charVisibility) || 'visible';
    charHideBtn.innerHTML = `<i class="fas ${VISIBILITY_ICON[vis]}"></i>`;
    charHideBtn.classList.toggle('char-hide-active', vis === 'inventory-only');
    charHideBtn.classList.toggle('char-hide-fully',  vis === 'hidden');
    charHideBtn.title = VISIBILITY_TITLE[vis];
  }

  function enforceCharVisibility() {
    if (window._isDM || !currentCharId) return;
    const vis = allChars[currentCharId]?.charVisibility || 'visible';
    if (vis === 'inventory-only' && statsOpen) closeStats();
    charSheetToggleBtn.hidden = (vis === 'inventory-only');
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
    updateEditBtn();
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
          charVisibility: data.charVisibility || (data.hiddenFromPlayers ? 'hidden' : 'visible'),
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
        // Only auto-select when already in inventory mode; if in hexmap mode the
        // user will open the inventory themselves and ensureCharSelected fires then.
        if (!_hexmapMode) {
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
      .filter(c => window._isDM || (c.charVisibility || 'visible') !== 'hidden')
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

    updateCharHideBtn();
    updateEditBtn();
    renderTabs();
  }

  function switchToChar(charId, skipSave) {
    inv.cancelDrag();
    if (!skipSave && currentCharId) saveChar(currentCharId, true);
    dirty = false;
    currentCharId = charId;
    suppressSave = true;
    try { inv.loadState(allChars[charId].state, { keepInspector: shopOpen }); } catch (e) { console.warn('loadState error:', e); }
    suppressSave = false;

    updateCharHideBtn();
    updateEditBtn();
    enforceCharVisibility();
    renderTabs();
    if (shopOpen) {
      document.querySelectorAll('.shop-item-row').forEach(row => {
        if (row._applyRowState) row._applyRowState();
      });
    }
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
    if (!saveState.charName) saveState.charName = 'Unnamed';
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
      if (nameEl) {
        const textNode = [...nameEl.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
        const newName = inv.getState().charName || 'Unnamed';
        if (textNode) textNode.textContent = newName;
        else nameEl.appendChild(document.createTextNode(newName));
      }
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
      .filter(char => window._isDM || (char.charVisibility || 'visible') !== 'hidden')
      .forEach(char => {
        const isOwn = char.ownerUid === currentUser?.uid;
        const vis   = char.charVisibility || 'visible';
        const tab = document.createElement('button');
        tab.className  = 'char-tab'
          + (char.id === currentCharId ? ' active' : '')
          + (isOwn ? ' tab-mine' : ' tab-other')
          + (window._isDM && vis !== 'visible' ? ' tab-hidden' : '');
        tab.dataset.charId = char.id;
        tab.title = char.ownerName || '';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'char-tab-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'char-tab-name';
        if (window._isDM && vis !== 'visible') {
          const hiddenIcon = document.createElement('i');
          hiddenIcon.className = `fas ${VISIBILITY_ICON[vis]} char-tab-hidden-icon`;
          nameSpan.appendChild(hiddenIcon);
        }
        nameSpan.appendChild(document.createTextNode(char.state.charName || 'Unnamed'));
        infoDiv.appendChild(nameSpan);

        tab.appendChild(infoDiv);

        // DM-only controls
        if (window._isDM) {

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
              if (_hexmapMode) {
                _hexmapMode = false;
                _applyViewMode();
                window.hexOnGoToInventory && window.hexOnGoToInventory();
              }
            } else if (!_hexmapMode) {
              inv.collapsePanelInstant();
              deselectChar();
              _hexmapMode = true;
              _applyViewMode();
              window.hexOnGoToHexmap && window.hexOnGoToHexmap();
              if (!_handlingPopstate) { _suppressPopstate = true; history.back(); }
            }
          } else {
            if (!shopOpen) inv.collapsePanelInstant();
            if (_hexmapMode) {
              _hexmapMode = false;
              _applyViewMode();
              window.hexOnGoToInventory && window.hexOnGoToInventory();
              if (!_handlingPopstate) history.pushState({ view: 'inventory' }, '');
            }
            switchToChar(char.id, false);
          }
        });

        tabsEl.appendChild(tab);
      });

    const addBtn = document.getElementById('add-char-btn');
    addBtn.hidden  = !window._isDM;
    addBtn.onclick = createChar;

    const activeTab = tabsEl.querySelector('.char-tab.active');
    if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
    inv.collapsePanelInstant();
    _hexmapMode = true;
    _applyViewMode();
    _customEditKey = null;
    _customEditOpen = false;
    inv.closeInspector();
  };

  // ── SYSTEM BACK-BUTTON HANDLER ────────────────────────────────────────────
  window.addEventListener('popstate', e => {
    if (_suppressPopstate) { _suppressPopstate = false; return; }
    if (window._navCalc.suppress) { window._navCalc.suppress = false; return; }
    _handlingPopstate = true;
    window._navCalc.handling = true;
    try {
      if (window._navCalc.open) { window._navCalc.hide?.(); return; }
      const v = e.state?.view;
      if (!v || v === 'hexmap') {
        if (shopOpen) {
          closeShop();
        } else if (!_hexmapMode) {
          _hexmapMode = true;
          inv.collapsePanelInstant();
          _applyViewMode();
          window.hexOnGoToHexmap && window.hexOnGoToHexmap();
          deselectChar();
        }
      } else if (v === 'inventory') {
        if (shopOpen) closeShop();
      }
    } finally {
      _handlingPopstate = false;
      window._navCalc.handling = false;
    }
  });
};
