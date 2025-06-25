
window.InventorySystem = (() => {
let CELL_WIDTH;
let CELL_HEIGHT;

const inspectorDiv = document.getElementById("inspector");

window.addEventListener("DOMContentLoaded", () => {
  const rootStyles = getComputedStyle(document.documentElement);
  CELL_WIDTH = parseInt(rootStyles.getPropertyValue("--cell-width"));
  CELL_HEIGHT = parseInt(rootStyles.getPropertyValue("--cell-height"));
  drawInventory(inventory);
});

const Bulk = {
  PACKABLE: { id: 'packable', width: 1, height: 1 },
  HANDHELD: { id: 'handheld', width: 1, height: 1 },
  BULKY: { id: 'bulky', width: 2, height: 1 },
  VERYBULKY: { id: 'verybulky', width: 2, height: 2}
};

let idCounter = 0;


function variableDisplayText() {
  const lines = [this.name];

  if (this.variables && Object.keys(this.variables).length > 0) {
    for (const [key, meta] of Object.entries(this.variables)) {
      const value = typeof meta === "object" && "value" in meta ? meta.value : meta;
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join("<br>");
}


function containerDisplayText() {
  const itemName = `<div class='container-title'>${this.name}</div>`;

  if (!this.innerContainer) return itemName;

  const innerItems = Object.values(this.innerContainer.items);
  if (innerItems.length === 0) return itemName;

  const listed = [];
  const seen = new Set();
  for (const item of innerItems) {
    if (!seen.has(item)) {
      listed.push(item.name);
      seen.add(item);
    }
  }

  // If 5 or fewer items, show as single column list
  if (listed.length <= 5) {
    const lines = listed.map(name => `• ${name}`).join("<br>");
    return `${itemName}<br>${lines}`;
  }

  // Otherwise, divide into two roughly even columns
  const mid = Math.ceil(listed.length / 2);
  const col1 = listed.slice(0, mid);
  const col2 = listed.slice(mid);

  const colHTML = `
    <div class="container-columns">
      <ul>${col1.map(name => `<li>• ${name}</li>`).join("")}</ul>
      <ul>${col2.map(name => `<li>• ${name}</li>`).join("")}</ul>
    </div>
  `;

  return itemName + colHTML;
}


class InventoryItem {
  constructor({ name = "", bulk = Bulk.HANDHELD, container = null, displayText = null, variableDisplayText = null, description = "", variables = {} }) {
    this.id = `item-${++idCounter}`;
    this.name = name;
    this.size = bulk;
    this.description = description;
    // Deep clone variables to avoid shared references
    this.variables = JSON.parse(JSON.stringify(variables)); 
    
    if (container) {
      this.innerContainer = new InventoryContainer(container);
      this.innerContainer.ownerId = this.id;
    }
    if (displayText) {
      this.displayText = displayText;
    }
    if (variableDisplayText) {
      this.variableDisplayText = variableDisplayText;
    }
  }

  isContainer() {
    return !!this.innerContainer;
  }

  isPackable() {
    return this.size.id === Bulk.PACKABLE.id;
  }

  getDisplayText() {
    if (typeof this.displayText === "function") {
      return this.displayText.call(this);
    }
    return this.name;
  }

  getVariableDisplayText() {
    if (typeof this.variableDisplayText === "function") {
      return this.variableDisplayText.call(this);
    }
    return ""; // fallback blank if no function assigned
  }
}


class InventoryContainer {
  constructor({ col, row }) {
    this.col = col;
    this.row = row;
    this.items = {}; // key = "x,y"
  }

  getItem(x, y) {
    return this.items[`${x},${y}`] || null;
  }

  getItemOrigin(item) {
    for (const key in this.items) {
      if (this.items[key] === item) return key.split(",").map(Number);
    }
    return null;
  }

  getItemOccupiedSlots(item) {
    const origin = this.getItemOrigin(item);
    if (!origin) return [];
    const [ox, oy] = origin;
    const slots = [];
    for (let dx = 0; dx < item.size.width; dx++) {
      for (let dy = 0; dy < item.size.height; dy++) {
        slots.push({ x: ox + dx, y: oy + dy });
      }
    }
    return slots;
  }

  removeItem(item) {
    for (const slot of this.getItemOccupiedSlots(item)) {
      delete this.items[`${slot.x},${slot.y}`];
    }
  }

  addItem(item, x, y, skipPouchAuto = false) {
    // If item is packable and container is NOT a pouch, and we are NOT skipping pouch auto-creation:
    if (item.isPackable() && !isContainerPouch(this) && !skipPouchAuto) {
      const pouch = createPouch();
  
      for (let dx = 0; dx < pouch.size.width; dx++) {
        for (let dy = 0; dy < pouch.size.height; dy++) {
          this.items[`${x + dx},${y + dy}`] = pouch;
        }
      }
  
      // Put the packable inside the pouch's inner container at (0, 0)
      pouch.innerContainer.addItem(item, 0, 0);
  
      return true;
    }
  
    // Normal add for other items and packables inside pouch
    for (let dx = 0; dx < item.size.width; dx++) {
      for (let dy = 0; dy < item.size.height; dy++) {
        this.items[`${x + dx},${y + dy}`] = item;
      }
    }
  
    return true;
  }
}

class Inventory {
  containers = {
    base: new InventoryContainer({ col: 2, row: 2 }),
  };
}

const itemDivCache = new Map();
const dynamicContainers = {};

function drawInventory(inventory) {
  const inventoryDiv = document.getElementById("inventory");
  inventoryDiv.innerHTML = "";
  const allContainers = { ...inventory.containers, ...dynamicContainers };
  for (const [id, container] of Object.entries(allContainers)) {
    const containerDiv = drawContainer(container, id);
    inventoryDiv.appendChild(containerDiv);
    updateItemPositions(container, containerDiv);
  }
}

function handleDrop(e, dropX, dropY, containerId) {
  e.preventDefault();
  const target = getCellCoordinatesFromMouseEvent(e);
  if (!target) return;

  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
  const src = getContainerById(data.sourceContainerId);
  const dst = getContainerById(containerId);

  const item = getItemFromData(data, src);
  if (!item || !dst) return;

  const ox = target.x - data.offsetX;
  const oy = target.y - data.offsetY;

  if (!isWithinBounds(item, dst, ox, oy)) return;

  const conflict = collidesWith(item, dst, ox, oy);
  if (conflict) return; // Customize this later if needed

  if (handlePouchDrop(item, dst, data, ox, oy)) return;
  if (handlePackableAutoPouch(item, dst, src, data, ox, oy)) return;

  // Standard drop
  dst.addItem(item, ox, oy, true);
  if (!data.fromSearch) src.removeItem(item);

  cleanupEmptyPouches();
}

function getContainerById(id) {
  return inventory.containers[id] || dynamicContainers[id];
}

function getItemFromData(data, src) {
  if (data.fromSearch) {
    const baseItem = ITEM_LIBRARY.find(i => i.name === data.name);
    if (!baseItem) return null;

    // Build a new object with expected props, fallback to baseItem props
    const itemData = {
      name: baseItem.name,
      bulk: baseItem.bulk,
      container: baseItem.container,
      description: baseItem.description || "",
      variables: baseItem.variables ? { ...baseItem.variables } : {},
      displayText: baseItem.displayText,
      variableDisplayText: baseItem.variableDisplayText,
      ...data,  // override with any data props
    };

    // Make sure bulk is a proper object (in case data.bulk is partial)
    if (data.bulk && typeof data.bulk === "object") {
      itemData.bulk = {
        width: data.bulk.width ?? baseItem.bulk.width,
        height: data.bulk.height ?? baseItem.bulk.height,
        id: data.bulk.id ?? baseItem.bulk.id,
      };
    }

    // Ensure variables is a proper object
    if (data.variables && typeof data.variables === "object") {
      itemData.variables = { ...itemData.variables, ...data.variables };
    }

    return new InventoryItem(itemData);
  } else {
    return src.getItem(data.originX, data.originY);
  }
}


function isWithinBounds(item, container, x, y) {
  return x >= 0 && y >= 0 &&
    x + item.size.width <= container.col &&
    y + item.size.height <= container.row;
}

function collidesWith(item, container, x, y) {
  for (let dx = 0; dx < item.size.width; dx++) {
    for (let dy = 0; dy < item.size.height; dy++) {
      const existing = container.getItem(x + dx, y + dy);
      if (existing && existing !== item) return existing;
    }
  }
  return null;
}

function handlePouchDrop(item, dst, data, x, y) {
  if (!isContainerPouch(dst)) return false;
  if (!item.isPackable()) return true;

  const success = dst.addItem(item, x, y);
  if (success && !data.fromSearch) {
    const src = getContainerById(data.sourceContainerId);
    src.removeItem(item);
  }

  return true;
}

function handlePackableAutoPouch(item, dst, src, data, x, y) {
  if (!item.isPackable()) return false;

  const pouch = createPouch();
  pouch.displayText = containerDisplayText;

  if (collidesWith(pouch, dst, x, y)) return true;

  dst.addItem(pouch, x, y);
  pouch.innerContainer.addItem(item, 0, 0);

  if (!data.fromSearch)
    src.removeItem(item);
  
  return true;
}

function cleanupEmptyPouches() {
  const allContainers = { ...inventory.containers, ...dynamicContainers };
  for (const container of Object.values(allContainers)) {
    for (const key in container.items) {
      const item = container.items[key];
      if (item?.name === "Pouch" && item.innerContainer && Object.keys(item.innerContainer.items).length === 0) {
        container.removeItem(item);
        itemDivCache.delete(item);
        delete dynamicContainers[item.id];
        break;
      }
    }
  }
}

function isContainerPouch(container) {
  if (!container.ownerId) return false;
  const pouchItem = findItemById(container.ownerId);
  return pouchItem?.name === "Pouch";
}

function findItemById(id) {
  const allContainers = { ...inventory.containers, ...dynamicContainers };
  for (const container of Object.values(allContainers)) {
    for (const item of Object.values(container.items)) {
      if (item.id === id) return item;
    }
  }
  return null;
}

function drawContainer(container, containerId) {
  const containerDiv = document.createElement("div");
  containerDiv.classList.add("container");
  containerDiv.dataset.containerId = containerId;
  containerDiv.style.position = "relative";

  if (isContainerPouch(container)) {
    containerDiv.classList.add("pouch-container");
  }
  

  for (let y = 0; y < container.row; y++) {
    const rowDiv = document.createElement("div");
    rowDiv.classList.add("row");
    for (let x = 0; x < container.col; x++) {
      const cellDiv = document.createElement("div");
      cellDiv.classList.add("cell");
      cellDiv.dataset.x = x;
      cellDiv.dataset.y = y;
      cellDiv.addEventListener("dragover", e => e.preventDefault());
      cellDiv.addEventListener("drop", e => {
        handleDrop(e, x, y, containerId);
        drawInventory(inventory);
      });
      rowDiv.appendChild(cellDiv);
    }
    containerDiv.appendChild(rowDiv);
  }

  const added = new Set();
  for (const key in container.items) {
    const item = container.items[key];
    if (!added.has(item)) {
      const [ox, oy] = container.getItemOrigin(item);
      const div = drawItem(item, ox, oy, containerId);
      itemDivCache.set(item, div);
      containerDiv.appendChild(div);
      added.add(item);
    }
  }

  return containerDiv;
}

function updateItemPositions(container, containerDiv) {
  for (const [item, div] of itemDivCache.entries()) {
    const origin = container.getItemOrigin(item);
    if (!origin) continue;
    const [x, y] = origin;
    div.style.top = `${y * CELL_HEIGHT}px`;
    div.style.left = `${x * CELL_WIDTH}px`;
    if (div.parentElement !== containerDiv) containerDiv.appendChild(div);
  }
}

function drawItem(item, x, y, containerId, staticMode = false) {
  const div = document.createElement("div");
  div.classList.add("item");

  if (item.isContainer()) div.classList.add("container");

  if (item.isPackable()) div.classList.add("packable");

  // Use the displayText function if it exists, otherwise fallback to name
  div.innerHTML = item.getDisplayText();

  div.draggable = true;

  if (item._isOpen) {
    div.classList.add("open-container");
  } else {
    div.classList.remove("open-container");
  }

  div.style.setProperty("--item-width", item.size.width);
  div.style.setProperty("--item-height", item.size.height);

  if (staticMode) {
    div.style.position = "relative";
  } else {
    div.style.position = "absolute";
    div.style.top = `${y * CELL_HEIGHT}px`;
    div.style.left = `${x * CELL_WIDTH}px`;
  }

  div.addEventListener("dragstart", e => {
    if (item.isContainer() && item._isOpen) {
      toggleContainerView(item);
    }
  
    let slotX = 0, slotY = 0, originX = 0, originY = 0;
  
    if (!staticMode) {
      slotX = Math.floor(e.offsetX / CELL_WIDTH);
      slotY = Math.floor(e.offsetY / CELL_HEIGHT);
      originX = Math.round(parseInt(div.style.left, 10) / CELL_WIDTH);
      originY = Math.round(parseInt(div.style.top, 10) / CELL_HEIGHT);
    }
  
    e.dataTransfer.setData("text/plain", JSON.stringify({
      originX,
      originY,
      offsetX: slotX,
      offsetY: slotY,
      sourceContainerId: containerId,
      fromSearch: staticMode,
      name: item.name,
      bulk: item.size,
      container: item.innerContainer ? { col: item.innerContainer.col, row: item.innerContainer.row } : null
    }));
  });

  if (!staticMode && item.isContainer()) {
    div.addEventListener("click", () => toggleContainerView(item));
  } 
    
  div.addEventListener("click", () => updateInspector(item));

  return div;
}

function toggleContainerView(item) {
  if (item._isOpen) {
    const stack = [item];
    while (stack.length > 0) {
      const current = stack.pop();
      current._isOpen = false;
      delete dynamicContainers[current.id];
      if (current.innerContainer) {
        for (const key in current.innerContainer.items) {
          const child = current.innerContainer.items[key];
          if (child?.isContainer && child.isContainer()) {
            stack.push(child);
          }
        }
      }
    }
  } else {
    item._isOpen = true;
    if (item.innerContainer) {
      dynamicContainers[item.id] = item.innerContainer;
    }
  }

  drawInventory(inventory);
}

function getCellCoordinatesFromMouseEvent(e) {
  const containers = document.querySelectorAll(".container");
  for (const el of containers) {
    if (el.contains(e.target)) {
      const rect = el.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      return {
        x: Math.floor(offsetX / CELL_WIDTH),
        y: Math.floor(offsetY / CELL_HEIGHT)
      };
    }
  }
  return null;
}

document.getElementById("delete-bin").addEventListener("dragover", e => e.preventDefault());
document.getElementById("delete-bin").addEventListener("drop", e => {
  e.preventDefault();
  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
  if (data.fromSearch) return;
  const container = getContainerById(data.sourceContainerId);
  const item = container?.getItem(data.originX, data.originY);
  if (item) {
    if (item.isContainer() && item.innerContainer) {
      for (const key in item.innerContainer.items) {
        const innerItem = item.innerContainer.items[key];
        itemDivCache.delete(innerItem);
      }
      delete dynamicContainers[item.id];
    }

    container.removeItem(item);
    itemDivCache.delete(item);
    drawInventory(inventory);
  }
});

const inventory = new Inventory();

function createPouch() {
  const pouch = new InventoryItem({
    name: "Pouch",
    bulk: Bulk.HANDHELD,
    container: { col: 1, row: 5 },
    displayText: containerDisplayText
  });
  return pouch;
}


const input = document.getElementById("search-input");
const results = document.getElementById("search-results");
results.style.display = "flex";
results.style.flexDirection = "column";
results.style.gap = "4px";

input.addEventListener("input", () => {
  const query = input.value.toLowerCase();
  results.innerHTML = "";
  if (!query) return;

  ITEM_LIBRARY
    .filter(i => i.name.toLowerCase().includes(query))
    .forEach(itemData => {
      const div = drawItem(new InventoryItem(itemData), 0, 0, "search", true);
      div.style.width = `${itemData.bulk.width * CELL_WIDTH}px`;
      div.style.height = `${itemData.bulk.height * CELL_HEIGHT}px`;
      results.appendChild(div);
    });
});

function updateInspector(item) {
  inspectorDiv.innerHTML = `
    <h2>${item.name}</h2>
    <p>${item.description || "No description provided."}</p>
    <div class="variables">
      ${Object.entries(item.variables).map(([key, meta]) => {
        const { value, control, min, max } = meta;

        const minus = (control === "plusminus" || control === "both")
          ? `<button onclick="changeVariable('${item.id}', '${key}', -1)">-</button>`
          : "";

        const plus = (control === "plusminus" || control === "both")
          ? `<button onclick="changeVariable('${item.id}', '${key}', 1)">+</button>`
          : "";

        const minAttr = (typeof min === "number") ? `min="${min}"` : "";
        const maxAttr = (typeof max === "number") ? `max="${max}"` : "";

        const set = (control === "set" || control === "both")
          ? `<input type="number" value="${value}" ${minAttr} ${maxAttr} onchange="setVariable('${item.id}', '${key}', this.value)" />`
          : `<span>${value}</span>`;

        return `
          <div class="variable">
            <label>${key}:</label>
            ${minus}
            ${set}
            ${plus}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function changeVariable(itemId, key, delta) {
  const item = findItemById(itemId);
  if (!item) return;

  const meta = item.variables?.[key];
  if (!meta || typeof meta.value !== "number") return;

  let newValue = meta.value + delta;

  if (typeof meta.min === "number" && newValue < meta.min) {
    newValue = meta.min;
  }
  if (typeof meta.max === "number" && newValue > meta.max) {
    newValue = meta.max;
  }

  meta.value = newValue;
  updateInspector(item);
  drawInventory(inventory);
}

function setVariable(itemId, key, value) {
  const item = findItemById(itemId);
  if (!item) return;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return;

  const meta = item.variables?.[key];
  if (!meta) return;

  let newValue = parsed;
  if (typeof meta.min === "number" && newValue < meta.min) {
    newValue = meta.min;
  }
  if (typeof meta.max === "number" && newValue > meta.max) {
    newValue = meta.max;
  }

  meta.value = newValue;
  updateInspector(item);
  drawInventory(inventory);
}

window.changeVariable = changeVariable;
window.setVariable = setVariable;

const ITEM_LIBRARY = [
  { name: "Platinum Coins", bulk: Bulk.PACKABLE, description: `1 platinum coin = 10 gold coins`, displayText: variableDisplayText, variables: {charges: { value: 50, control: "both", min: 0, max: 50} } },
  { name: "Gold Coins", bulk: Bulk.PACKABLE, description: `1 gold coin = 10 silver coins`, displayText: variableDisplayText, variables: {charges: { value: 50, control: "both", min: 0, max: 50} } },
  { name: "Silver Coins", bulk: Bulk.PACKABLE, description: `1 silver coin = 10 copper coins`, displayText: variableDisplayText, variables: {charges: { value: 50, control: "both", min: 0, max: 50} } },
  { name: "Copper Coins", bulk: Bulk.PACKABLE, description: `Basic currency unit`, displayText: variableDisplayText, variables: {charges: { value: 50, control: "both", min: 0, max: 50} } },

  { name: "Bagpipes", bulk: Bulk.BULKY, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  { name: "Drum", bulk: Bulk.HANDHELD, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  { name: "Dulcimer", bulk: Bulk.BULKY, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  { name: "Flute", bulk: Bulk.HANDHELD, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  { name: "Lute", bulk: Bulk.BULKY, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  { name: "Lyre", bulk: Bulk.HANDHELD, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  { name: "Pan Flute", bulk: Bulk.HANDHELD, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  { name: "Shawm", bulk: Bulk.HANDHELD, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  { name: "Viol", bulk: Bulk.BULKY, description: `Play a known tune (DC 10), or improvise a song (DC 15)` },
  
  { name: "Club", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d4 bludgeoning damage<br>light` },
  { name: "Dagger", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d4 piercing damage<br>finesse, light, thrown (range 20/60)` },
  { name: "Greatclub", bulk: Bulk.BULKY, description: `<i>simple weapon</i><br>1d8 bludgeoning damage<br>two-handed, heavy` },
  { name: "Handaxe", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d6 slashing damage<br>light, thrown (range 20/60)` },
  { name: "Javelin", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d6 piercing damage<br>thrown (range 30/120)` },
  { name: "Light Hammer", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d4 bludgeoning damage<br>light, thrown (range 20/60)` },
  { name: "Mace", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d6 bludgeoning damage` },
  { name: "Quarterstaff", bulk: Bulk.BULKY, description: `<i>simple weapon</i><br>1d6 bludgeoning damage<br>versatile (1d8)` },
  { name: "Sickle", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d4 slashing damage<br>light` },
  { name: "Spear", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d6 piercing damage<br>thrown (range 20/60), versatile (1d8)` },
  { name: "Light Crossbow", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d8 piercing damage<br>range 80/320, loading, two-handed` },
  { name: "Dart", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d4 piercing damage<br>finesse, thrown (range 20/60)` },
  { name: "Shortbow", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d6 piercing damage<br>range 80/320, two-handed` },
  { name: "Sling", bulk: Bulk.HANDHELD, description: `<i>simple weapon</i><br>1d4 bludgeoning damage<br>range 30/120` },
  { name: "Battleaxe", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d8 slashing damage<br>versatile (1d10)` },
  { name: "Flail", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d8 bludgeoning damage` },
  { name: "Glaive", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>1d10 slashing damage<br>heavy, reach, two-handed` },
  { name: "Greataxe", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>1d12 slashing damage<br>heavy, two-handed` },
  { name: "Greatsword", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>2d6 slashing damage<br>heavy, two-handed` },
  { name: "Halberd", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>1d10 slashing damage<br>heavy, reach, two-handed` },
  { name: "Lance", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>1d12 piercing damage<br>reach, special` },
  { name: "Longsword", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d8 slashing damage<br>versatile (1d10)` },
  { name: "Maul", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>2d6 bludgeoning damage<br>heavy, two-handed` },
  { name: "Morningstar", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d8 piercing damage` },
  { name: "Pike", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>1d10 piercing damage<br>heavy, reach, two-handed` },
  { name: "Rapier", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d8 piercing damage<br>finesse` },
  { name: "Scimitar", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d6 slashing damage<br>finesse, light` },
  { name: "Shortsword", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d6 piercing damage<br>finesse, light` },
  { name: "Trident", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d6 piercing damage<br>thrown (range 20/60), versatile (1d8)` },
  { name: "War Pick", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d8 piercing damage` },
  { name: "Warhammer", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d8 bludgeoning damage<br>versatile (1d10)` },
  { name: "Whip", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d4 slashing damage<br>finesse, reach` },
  { name: "Blowgun", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1 piercing damage<br>range 25/100, loading` },
  { name: "Hand Crossbow", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>1d6 piercing damage<br>range 30/120, light, loading` },
  { name: "Heavy Crossbow", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>1d10 piercing damage<br>range 100/400, heavy, loading, two-handed` },
  { name: "Longbow", bulk: Bulk.BULKY, description: `<i>martial weapon</i><br>1d8 piercing damage<br>range 150/600, heavy, two-handed` },
  { name: "Net", bulk: Bulk.HANDHELD, description: `<i>martial weapon</i><br>special, thrown (range 5/15)` },

  { name: "Shield", bulk: Bulk.BULKY, description: `<i>shield</i><br>+2 AC` },
  { name: "Light Armor", bulk: Bulk.HANDHELD, description: `<i>light armor</i><br>AC 12 + Dex modifier. <br> <i>leather, or other simple padding.</i>` },
  { name: "Medium Armor", bulk: Bulk.BULKY, description: `<i>medium armor</i><br>AC 14 + max 2 Dex modifier. Disadvantage on stealth checks. <br> <i>scale mail, partial chainmail, or similarly mildly cumbersome armor.</i>` },
  { name: "Heavy Armor", bulk: Bulk.BULKY, description: `<i>heavy armor</i><br>AC 16 <br> <i>full chain mail, or similarly cumbersome armor.</i>` },
  { name: "Half Plate", bulk: Bulk.BULKY, description: `<i>medium armor</i><br>AC 15 + max 2 Dex modifier. Disadvantage on stealth checks. <br> <i>this armor can be made into full plate for the difference in cost.</i>` },
  { name: "Splint Armor", bulk: Bulk.BULKY, description: `<i>heavy armor</i><br>AC 17 <br> <i>full leather with rivited strips of metal.</i>` },
  { name: "Plate Armor", bulk: Bulk.VERYBULKY, description: `<i>heavy armor</i><br>AC 18 <br> <i>complete plate armor.</i>` },

  // Adventuring Gear
  { name: "Rations", bulk: Bulk.PACKABLE, description: `A days rations.` },
  { name: "Mirror", bulk: Bulk.PACKABLE, description: `A steel mirror used for grooming, peeking around corners, or signaling with reflected light.` },
  { name: "Tinderbox", bulk: Bulk.PACKABLE, description: `Use as a bonus action to light exposed fuel (e.g., candle, torch); 1 minute to light covered material.` },
  { name: "Waterskin", bulk: Bulk.HANDHELD, description: `Holds 4 pints of water. Essential for avoiding dehydration during travel or exertion.` },
  { name: "Chalk", bulk: Bulk.PACKABLE, variables: { charges: { value: 5, control: "plusminus", min: 0, max: 5 } }, description: `Expend 1 charge to mark a surface; expend 5 to leave a 50-ft trail. Useful for leaving notes and marking objects.` },
  { name: "Rope", bulk: Bulk.BULKY, description: `50ft of rope. Use an action to tie a secure knot (DC 10 Sleight of Hand). Can bind a Grappled, Incapacitated, or Restrained creature. Bound creatures are Restrained. Escape (DC 15 Acrobatics); burst (DC 20 Athletics).` },
  { name: "Shovel", bulk: Bulk.BULKY, description: `After 1 hour of digging, creates a 5-foot cube hole in dirt, sand, or loose material.` },
  { name: "Whistle", bulk: Bulk.PACKABLE, description: `Blow as an action to emit a piercing sound audible up to 600 feet away.` },
  { name: "Horn", bulk: Bulk.HANDHELD, description: `Blow as an action to emit a loud note audible up to 600 feet away.` },
  { name: "Manacles", bulk: Bulk.HANDHELD, description: `As an action, bind an unwilling Small or Medium creature within 5ft that is Grappled, Incapacitated, or Restrained, with a successful DC 13 Dexterity (Sleight of Hand) check.<br>
    A bound creature is Restrained.<br>
    It can attempt a DC 25 Dexterity (Sleight of Hand) check to slip free, or a DC 25 Strength (Athletics) check to break them as an action.<br>
    Another creature can pick the lock with a DC 15 Dexterity (Sleight of Hand) check.<br>
    <i>AC 19, damage threshold 10, 10 hit points.</i>` },
  { name: "Grappling Hook", bulk: Bulk.HANDHELD, description: `As an action, throw at a target within 50 ft. The hook catches on a DC 13 Dexterity (Acrobatics) or Strength (Athletics) check. If tied to Rope, can be climbed.` },
  { name: "Crowbar", bulk: Bulk.HANDHELD, description: `Using a Crowbar gives you Advantage on Strength checks where the Crowbar's leverage can be applied.` },
  { name: "Lantern", bulk: Bulk.HANDHELD, description: `Sheds bright light in a 30-foot radius and dim light for an additional 30 feet. As a bonus action you can lower the hood to reduce it to dim light in a 5-foot radius or raise the hood. Consumes 1 charge of oil per hour from an Oil Flask.` },
  { name: "Oil Flask", bulk: Bulk.PACKABLE, displayText: variableDisplayText, variables: { charges: { value: 5, control: "plusminus", min: 0, max: 5 } }, description: `Used to fuel lanterns or coat objects, making them flammable when exposed to fire (burning condition).` },  
  { name: "Torch", bulk: Bulk.PACKABLE, variables: { charges: { value: 6, control: "plusminus", min: 0, max: 6 } }, description: `Light the torch to expend a charge and cast 10 minutes of bright light in a 20-foot radius and dim light for an additional 20 feet. The torch can be used as a Simple Melee weapon. On a hit, the target takes 1d4 + Strength bludgeoning damage or fire damage when lit.`},

  { name: "Satchel", bulk: Bulk.HANDHELD, container: { col: 2, row: 1 }, displayText: containerDisplayText, description: `It takes a bonus action or action to access an item in your satchel.` },
  { name: "Backpack", bulk: Bulk.BULKY, container: { col: 2, row: 4 }, displayText: containerDisplayText, description: `It takes an action to access an item in your backpack. A creature can wear only one backpack.` },
  
  { name: "Saddlebag", bulk: Bulk.BULKY, description: `A mount's saddlebag for carrying gear.` },
  { name: "Ammunition Cache", bulk: Bulk.HANDHELD, description: `A single weapon's ammunition. This must be accessed each time you reload the weapon.`  },
  { name: "Basic Poison", bulk: Bulk.PACKABLE, description: `As a bonus action, coat one weapon or up to three pieces of ammunition. A target hit must succeed on a DC 13 Constitution saving throw or become poisoned. The poison lasts until the target saves at the end of their turns or 1 minute.` },
  { name: "Antitoxin", bulk: Bulk.PACKABLE, description: `As a Bonus Action, you can drink a vial of Antitoxin to gain Advantage on saving throws to avoid or end the Poisoned condition for 1 hour.` },
  { name: "Acid", bulk: Bulk.HANDHELD, description: `Replace one of your attacks to throw this at a creature or object within 20 ft, they must succeed on a DC 13 Dexterity saving throw or take 2d6 acid damage. This item is destroyed.` },
  { name: "Alchemist's Fire", bulk: Bulk.HANDHELD, description: `Replace one of your attacks to throw this at a creature or object within 20 ft, they must succeed on a DC 13 Dexterity saving throw or take 1d4 fire damage and start burning. This item is destroyed.` },
  { name: "Hunting Trap", bulk: Bulk.BULKY, description: `Spend 10 minutes setting and concealing this trap. When a creature steps on it, it must succeed on a DC 13 Dexterity save or take 2d10 piercing damage, and be grappled. The grapple requires a DC 13 Strength (Athletics) check to end.` },
  { name: "Caltrops", bulk: Bulk.HANDHELD, description: `Scatter on the ground in a 5-ft square. Each creature entering must succeed on a DC13 Dexterity save or take 1d4 damage and their speed is 0 until the start of their next turn.` },
  { name: "Ball Bearings", bulk: Bulk.HANDHELD, description: `Scatter on the ground in a 10-ft square. Each creature entering must succeed on a DC13 Dexterity save or fall prone.` },
  { name: "Healing Potion", bulk: Bulk.HANDHELD, description: `Drink as an action to regain 2d4 + 2 hit points.` },

  // Tools & Kits
  { name: "Climber's Tools", bulk: Bulk.BULKY, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Smith's Tools", bulk: Bulk.BULKY, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Mason's Tools", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Woodcarver's Tools", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Leatherworker's Tools", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Weaver's Tools", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Scribe's Supplies", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Painter's Supplies", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Jeweler's Tools", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Cook's Utensils", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Healer's Kit", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Poisoner's Kit", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Herbalism Kit", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Glassblower's Tools", bulk: Bulk.BULKY, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Potter's Tools", bulk: Bulk.BULKY, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Thieves' Tools", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Tinker's Tools", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Alchemist's Supplies", bulk: Bulk.BULKY, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Disguise Kit", bulk: Bulk.BULKY, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Navigator's Tools", bulk: Bulk.HANDHELD, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
  { name: "Brewer's Supplies", bulk: Bulk.BULKY, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },  
  { name: "Camp Supplies", bulk: Bulk.BULKY, variables: { charges: { value: 3, control: "both", min: 0, max: 3 } }, description: `Expend a charge to gain advantage on a relevant roll or to produce an item related to these tools. Charges fully replenish after a long rest.` },
];

return {};
})();
