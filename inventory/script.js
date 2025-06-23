let CELL_WIDTH;
let CELL_HEIGHT;

window.addEventListener("DOMContentLoaded", () => {
  const rootStyles = getComputedStyle(document.documentElement);
  CELL_WIDTH = parseInt(rootStyles.getPropertyValue("--cell-width"));
  CELL_HEIGHT = parseInt(rootStyles.getPropertyValue("--cell-height"));
  drawInventory(inventory);
});

const Bulk = {
  PACKABLE: { width: 1, height: 1 },
  HANDHELD: { width: 1, height: 1 },
  BULKY: { width: 2, height: 1 },
};

// --- Add unique ID counter here
let idCounter = 0;

class InventoryItem {
  constructor({ name = "", bulk = Bulk.HANDHELD, container = null }) {
    this.id = `item-${++idCounter}`; // Unique ID for each item
    this.name = name;
    this.size = bulk;
    if (container) {
      this.innerContainer = new InventoryContainer(container);
      this.innerContainer.ownerId = this.id; // Track parent item ID for the container
    }
  }

  isContainer() {
    return !!this.innerContainer;
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

  addItem(item, x, y) {
    for (let dx = 0; dx < item.size.width; dx++) {
      for (let dy = 0; dy < item.size.height; dy++) {
        this.items[`${x + dx},${y + dy}`] = item;
      }
    }
  }
}

class Inventory {
  containers = {
    base: new InventoryContainer({ col: 4, row: 4 }),
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

function drawContainer(container, containerId) {
  const containerDiv = document.createElement("div");
  containerDiv.classList.add("container");
  containerDiv.dataset.containerId = containerId;
  containerDiv.style.position = "relative";

  for (let y = 0; y < container.row; y++) {
    const rowDiv = document.createElement("div");
    rowDiv.classList.add("row");
    for (let x = 0; x < container.col; x++) {
      const cellDiv = document.createElement("div");
      cellDiv.classList.add("cell");
      cellDiv.dataset.x = x;
      cellDiv.dataset.y = y;
      cellDiv.addEventListener("dragover", e => e.preventDefault());
      cellDiv.addEventListener("drop", e => handleDrop(e, x, y, containerId));
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

function handleDrop(e, dropX, dropY, containerId) {
  e.preventDefault();
  const target = getCellCoordinatesFromMouseEvent(e);
  if (!target) return;

  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
  const src = inventory.containers[data.sourceContainerId] || dynamicContainers[data.sourceContainerId];
  const dst = inventory.containers[containerId] || dynamicContainers[containerId];
  const item = data.fromSearch ? new InventoryItem(data) : src.getItem(data.originX, data.originY);
  if (!item || !dst) return;

  // Pass actual container object instead of container ID for better nesting check
  if (item.isContainer && isIllegalContainerPlacement(item, dst)) return;

  const ox = target.x - data.offsetX;
  const oy = target.y - data.offsetY;
  if (ox < 0 || oy < 0 || ox + item.size.width > dst.col || oy + item.size.height > dst.row) return;

  for (let dx = 0; dx < item.size.width; dx++) {
    for (let dy = 0; dy < item.size.height; dy++) {
      const occ = dst.getItem(ox + dx, oy + dy);
      if (occ && occ !== item) return;
    }
  }

  if (!data.fromSearch) src.removeItem(item);
  dst.addItem(item, ox, oy);
  drawInventory(inventory);
}

function isIllegalContainerPlacement(item, targetContainer) {
  if (!item.innerContainer) return false;

  // Can't place container into itself
  if (item.innerContainer === targetContainer) return true;

  // DFS to check if targetContainer is a descendant of the item.innerContainer
  const visited = new Set();
  const stack = [item.innerContainer];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === targetContainer) return true;
    for (const key in current.items) {
      const child = current.items[key];
      if (child?.isContainer() && child.innerContainer && !visited.has(child.innerContainer)) {
        visited.add(child.innerContainer);
        stack.push(child.innerContainer);
      }
    }
  }

  return false;
}

function drawItem(item, x, y, containerId, staticMode = false) {
  const div = document.createElement("div");
  div.classList.add("item");
  div.textContent = item.name;
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
    if (item.isContainer && item._isOpen) {
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

  if (!staticMode && item.isContainer && item.isContainer()) {
    div.addEventListener("click", () => toggleContainerView(item));
  }

  return div;
}

function toggleContainerView(item) {
  if (item._isOpen) {
    // Closing: recursively close all nested containers
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
  const container = inventory.containers[data.sourceContainerId] || dynamicContainers[data.sourceContainerId];
  const item = container?.getItem(data.originX, data.originY);
  if (item) {
    if (item.isContainer && item.innerContainer) {
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
inventory.containers.base.addItem(new InventoryItem({ name: "Dagger" }), 0, 0);
inventory.containers.base.addItem(new InventoryItem({ name: "Sword" }), 0, 1);
inventory.containers.base.addItem(new InventoryItem({ name: "Great Axe", bulk: Bulk.BULKY }), 1, 0);
inventory.containers.base.addItem(new InventoryItem({ name: "Great Sword", bulk: Bulk.BULKY }), 2, 1);
inventory.containers.base.addItem(new InventoryItem({
  name: "Chest",
  bulk: Bulk.BULKY,
  container: { col: 3, row: 2 }
}), 0, 3);

const ITEM_LIBRARY = [
  { name: "Dagger", bulk: Bulk.HANDHELD },
  { name: "Sword", bulk: Bulk.HANDHELD },
  { name: "Great Axe", bulk: Bulk.BULKY },
  { name: "Great Sword", bulk: Bulk.BULKY },
  { name: "Potion", bulk: Bulk.PACKABLE },
  { name: "Scroll", bulk: Bulk.PACKABLE },
  { name: "Bow", bulk: Bulk.BULKY },
  { name: "Chest", bulk: Bulk.BULKY, container: { col: 3, row: 2 }},
];

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
