let CELL_WIDTH;
let CELL_HEIGHT;

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
  constructor({ name = "", bulk = Bulk.HANDHELD, container = null, displayText = null }) {
    this.id = `item-${++idCounter}`;
    this.name = name;
    this.size = bulk;
    if (container) {
      this.innerContainer = new InventoryContainer(container);
      this.innerContainer.ownerId = this.id;
    }
    if(displayText){
      this.displayText = displayText;
    }
  }

  isContainer() {
    return !!this.innerContainer;
  }

  isPackable() {
    return this.size.id === Bulk.PACKABLE.id;
  }

  // New method: returns display text, multiline support
  getDisplayText() {
    if (typeof this.displayText === "function") {
      return this.displayText();
    }
    return this.name;
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
    const item = new InventoryItem(data);
    const baseItem = ITEM_LIBRARY.find(i => i.name === data.name);
    if (baseItem?.displayText) item.displayText = baseItem.displayText;
    return item;
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

const ITEM_LIBRARY = [
  // Instrument
  { name: "Bagpipes", bulk: Bulk.BULKY },
  { name: "Drum", bulk: Bulk.HANDHELD },
  { name: "Dulcimer", bulk: Bulk.BULKY },
  { name: "Flute", bulk: Bulk.HANDHELD },
  { name: "Lute", bulk: Bulk.BULKY },
  { name: "Lyre", bulk: Bulk.HANDHELD },
  { name: "Horn", bulk: Bulk.HANDHELD },
  { name: "Pan Flute", bulk: Bulk.HANDHELD },
  { name: "Shawm", bulk: Bulk.HANDHELD },
  { name: "Viol", bulk: Bulk.BULKY },

  // Simple Melee Weapons
  { name: "Club", bulk: Bulk.HANDHELD },
  { name: "Dagger", bulk: Bulk.HANDHELD },
  { name: "Greatclub", bulk: Bulk.BULKY },
  { name: "Handaxe", bulk: Bulk.HANDHELD },
  { name: "Javelin", bulk: Bulk.HANDHELD },
  { name: "Light Hammer", bulk: Bulk.HANDHELD },
  { name: "Mace", bulk: Bulk.HANDHELD },
  { name: "Quarterstaff", bulk: Bulk.BULKY },
  { name: "Sickle", bulk: Bulk.HANDHELD },
  { name: "Spear", bulk: Bulk.HANDHELD },

  // Simple Ranged Weapons
  { name: "Light Crossbow", bulk: Bulk.HANDHELD },
  { name: "Dart", bulk: Bulk.HANDHELD },
  { name: "Shortbow", bulk: Bulk.HANDHELD },
  { name: "Sling", bulk: Bulk.HANDHELD },

  // Martial Melee Weapons
  { name: "Battleaxe", bulk: Bulk.HANDHELD },
  { name: "Flail", bulk: Bulk.HANDHELD },
  { name: "Glaive", bulk: Bulk.BULKY },
  { name: "Greataxe", bulk: Bulk.BULKY },
  { name: "Greatsword", bulk: Bulk.BULKY },
  { name: "Halberd", bulk: Bulk.BULKY },
  { name: "Lance", bulk: Bulk.BULKY },
  { name: "Longsword", bulk: Bulk.HANDHELD },
  { name: "Maul", bulk: Bulk.BULKY },
  { name: "Morningstar", bulk: Bulk.HANDHELD },
  { name: "Pike", bulk: Bulk.BULKY },
  { name: "Rapier", bulk: Bulk.HANDHELD },
  { name: "Scimitar", bulk: Bulk.HANDHELD },
  { name: "Shortsword", bulk: Bulk.HANDHELD },
  { name: "Trident", bulk: Bulk.HANDHELD },
  { name: "War Pick", bulk: Bulk.HANDHELD },
  { name: "Warhammer", bulk: Bulk.HANDHELD },
  { name: "Whip", bulk: Bulk.HANDHELD },

  // Martial Ranged Weapons
  { name: "Blowgun", bulk: Bulk.HANDHELD },
  { name: "Hand Crossbow", bulk: Bulk.HANDHELD },
  { name: "Heavy Crossbow", bulk: Bulk.BULKY },
  { name: "Longbow", bulk: Bulk.BULKY },
  { name: "Net", bulk: Bulk.HANDHELD },

  // Armor
  { name: "Shield", bulk: Bulk.BULKY },
  { name: "Padded Armor", bulk: Bulk.HANDHELD },
  { name: "Leather Armor", bulk: Bulk.HANDHELD },
  { name: "Studded Leather Armor", bulk: Bulk.HANDHELD },
  { name: "Hide Armor", bulk: Bulk.BULKY },
  { name: "Chain Shirt", bulk: Bulk.BULKY },
  { name: "Scale Mail", bulk: Bulk.BULKY },
  { name: "Breastplate", bulk: Bulk.BULKY },
  { name: "Half Plate", bulk: Bulk.BULKY },
  { name: "Ring Mail", bulk: Bulk.BULKY },
  { name: "Chain Mail", bulk: Bulk.BULKY },
  { name: "Splint Armor", bulk: Bulk.BULKY },
  { name: "Plate Armor", bulk: Bulk.VERYBULKY },
  
  // Adventuring Gear
  { name: "Rations", bulk: Bulk.PACKABLE },
  { name: "Waterskin", bulk: Bulk.HANDHELD },
  { name: "Tinderbox", bulk: Bulk.PACKABLE },
  { name: "Mirror", bulk: Bulk.PACKABLE },
  { name: "Chalk", bulk: Bulk.PACKABLE },
  { name: "Parchment", bulk: Bulk.PACKABLE },
  { name: "Ink and Pen", bulk: Bulk.PACKABLE },
  { name: "Whistle", bulk: Bulk.PACKABLE },
  { name: "Horn", bulk: Bulk.HANDHELD },
  { name: "Oil", bulk: Bulk.PACKABLE },
  { name: "Shovel", bulk: Bulk.BULKY },
  { name: "Hammer", bulk: Bulk.HANDHELD },
  { name: "Rope", bulk: Bulk.BULKY },
  { name: "Torch", bulk: Bulk.PACKABLE },
  { name: "Manacles", bulk: Bulk.HANDHELD },
  { name: "Grappling Hook", bulk: Bulk.HANDHELD },
  { name: "Crowbar", bulk: Bulk.HANDHELD },
  { name: "Lantern, hooded", bulk: Bulk.HANDHELD },

  { name: "Satchel", bulk: Bulk.HANDHELD, container: { col: 2, row: 1 }, displayText: containerDisplayText },
  { name: "Backpack", bulk: Bulk.BULKY, container: { col: 2, row: 4 }, displayText: containerDisplayText },
  
  { name: "Saddlebag", bulk: Bulk.BULKY },
  { name: "Ammunition Cache", bulk: Bulk.HANDHELD },
  { name: "Basic Poison", bulk: Bulk.PACKABLE },
  { name: "Antitoxin", bulk: Bulk.PACKABLE },
  { name: "Acid", bulk: Bulk.HANDHELD },
  { name: "Alchemist's Fire", bulk: Bulk.HANDHELD },
  { name: "Hunting Trap", bulk: Bulk.BULKY },
  { name: "Caltrops", bulk: Bulk.PACKABLE },
  { name: "Ball Bearings", bulk: Bulk.PACKABLE },
  { name: "Healing Potion", bulk: Bulk.HANDHELD },

  // Tools & Kits
  { name: "Climber's Tools", bulk: Bulk.BULKY },
  { name: "Smith's Tools", bulk: Bulk.BULKY },
  { name: "Mason's Tools", bulk: Bulk.HANDHELD },
  { name: "Woodcarver's Tools", bulk: Bulk.HANDHELD },
  { name: "Leatherworker's Tools", bulk: Bulk.HANDHELD },
  { name: "Weaver's Tools", bulk: Bulk.HANDHELD },
  { name: "Scribe's Supplies", bulk: Bulk.HANDHELD },
  { name: "Painter's Supplies", bulk: Bulk.HANDHELD },
  { name: "Jeweler's Tools", bulk: Bulk.HANDHELD },
  { name: "Cook's Utensils", bulk: Bulk.HANDHELD },
  { name: "Healer's Kit", bulk: Bulk.HANDHELD },
  { name: "Poisoner's Kit", bulk: Bulk.HANDHELD },
  { name: "Herbalism Kit", bulk: Bulk.HANDHELD },
  { name: "Glassblower's Tools", bulk: Bulk.BULKY },
  { name: "Potter's Tools", bulk: Bulk.BULKY },
  { name: "Thieves' Tools", bulk: Bulk.HANDHELD },
  { name: "Tinker's Tools", bulk: Bulk.HANDHELD },
  { name: "Alchemist's Supplies", bulk: Bulk.BULKY },
  { name: "Disguise Kit", bulk: Bulk.BULKY },
  { name: "Navigator's Tools", bulk: Bulk.HANDHELD },
  { name: "Brewer's Supplies", bulk: Bulk.BULKY },  
  { name: "Camp Supplies", bulk: Bulk.BULKY },
];

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
