// Firebase initialization.
const firebaseConfig = {
    apiKey: "AIzaSyAOXPGwEFekK9tRauXOVVWtPLGT7WZf668",
    authDomain: "hexcrawl-650cd.firebaseapp.com",
    projectId: "hexcrawl-650cd",
    storageBucket: "hexcrawl-650cd.appspot.com",
    appId: "1:95939330375:web:69b0c546db5b00d996cc62",
    databaseURL: "https://hexcrawl-650cd-default-rtdb.firebaseio.com"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = app.database();

// Firebase reference for updating "selectedHexes" set.
const selectedHexesRef = database.ref("selectedHexes");

// Get elements
const image = new Image();
image.src = "https://lh3.googleusercontent.com/d/1fySy_aXhOZHiJGMw6B2xon_8nMiVeyK6?authuser=0";
const canvas = document.getElementById("canvas");
const canvasContext = canvas.getContext("2d");
const zoomCanvas = document.getElementById("zoomPreview");
const zoomCanvasContext = zoomCanvas.getContext("2d");

const info = document.getElementById("info");
const infoText = document.getElementById("infoText");
const hexCoords = document.getElementById("hexCoords");
const infoToggle = document.getElementById('info-toggle');
const positionToggleBtn = document.getElementById('positionToggleBtn');
const signOutBtn = document.getElementById("sign-out-btn");
const invOverlay = document.getElementById("inv-overlay");

new ResizeObserver(() => {
    setPan(panX, panY);
    updatePositionBtn();
    drawGridLatestActive();
}).observe(info);

let detailCollapsed = false;

function setDetailCollapsed(collapsed) {
    detailCollapsed = collapsed;
    const i = infoToggle.querySelector('i');
    i.className = collapsed ? 'fa-solid fa-fw fa-chevron-up' : 'fa-solid fa-fw fa-chevron-down';
}

infoToggle.addEventListener('click', () => {
    if (info.classList.contains('has-content')) {
        info.classList.remove('has-content');
        setDetailCollapsed(true);
    } else {
        setDetailCollapsed(false);
        drawGridLatestActive();
    }
});

const clearBtn = document.getElementById('clearBtn');

const selectedHexes = new Set();

const hexSize = 13.525;
const hexWidth = 27.275;
const hexHeight = Math.sqrt(3) * hexSize;
const hexVertSpacing = hexHeight;
const hexHorizSpacing = (3 / 4) * hexWidth;

const maxZoomScale = 3;

let offsetX = -11;
let offsetY = 1;

let lastHex = null;

//let isShowRegionOn = false;
let showRegion = null;
let panelAtTop = false;

let isDragging = false;
let isPanning = false;
let startDragX = 0;
let startDragY = 0;
let startPanX = 0;
let startPanY = 0;

let startRow = 0;
let startCol = 0;

let latestActiveHexRow = null;
let latestActiveHexCol = null;

let minZoom = 1; // this will be calculated after the image loads.
let maxZoom = 1; // this will be calculated after the image loads using maxZoomScale.

let zoom = 1;
let panX = 0;
let panY = 0;

const hexData = new Map();

image.onload = () => {
    // Calculate minimum zoom to fit image to canvas
    const zoomX = canvas.width / image.naturalWidth;
    const zoomY = canvas.height / image.naturalHeight;
    minZoom = Math.max(zoomX, zoomY);
    maxZoom = minZoom * maxZoomScale;

    // Set initial zoom and reset pan
    zoom = minZoom;
    panX = 0;//(canvas.width - image.naturalWidth * zoom) / 2;
    panY = 0;//(canvas.height - image.naturalHeight * zoom) / 2;

    drawGridLatestActive();
};

// Load hex info json
fetch('https://samzeid.github.io/hexmap/hexinfo.json')
.then(res => res.json())
.then(data => {
    const { regions, locations } = data;

    regions.forEach(region => {
        region.hexes.forEach(hex => {
            if (!hexData.has(hex)) {
                hexData.set(hex, {
                    politicalRegion: null,
                    environmentalRegion: null,
                    location: null
                });
            }

            const hexEntry = hexData.get(hex);

            const regionData = {
                name: region.name,
                description: region.description,
                color: region.color,
                type: region.type || null
            };

            if (region.type === 'political') {
                hexEntry.politicalRegion = regionData;
            } else if (region.type === 'environmental') {
                hexEntry.environmentalRegion = regionData;
            } else {
                console.warn(`Region with unknown type at hex ${hex}:`, region);
            }
        });
    });

    locations.forEach(location => {
        location.hexes.forEach(hex => {
            if (!hexData.has(hex)) {
                hexData.set(hex, {
                    politicalRegion: null,
                    environmentalRegion: null,
                    location: null
                });
            }

            hexData.get(hex).location = {
                name: location.name,
                description: location.description,
                color: location.color || null
            };
        });
    });

    console.log("Hex data loaded:", hexData);
})
.catch(err => {
    console.error("Failed to load hex data json:", err);
});

function drawHex(x, y, options = {}) {
    const {
        strokeColor = "rgba(0,0,0,0.0)",
        fillColor = null,
        lineWidth = 1,
        opacity = 1,
    } = options;

    canvasContext.save();
    canvasContext.globalAlpha = opacity;
    canvasContext.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = x + hexSize * Math.cos(angle);
        const py = y + hexSize * Math.sin(angle);
        if (i === 0) canvasContext.moveTo(px, py);
        else canvasContext.lineTo(px, py);
    }

    canvasContext.closePath();

    if (fillColor) {
        canvasContext.fillStyle = fillColor;
        canvasContext.fill();
    }
    canvasContext.strokeStyle = strokeColor;
    canvasContext.lineWidth = lineWidth;
    canvasContext.stroke();
    canvasContext.restore();
}

const canvasContainer = canvas.parentElement;

function fitContainer() {
    const h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    canvasContainer.style.height = h + 'px';
}
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitContainer);
window.addEventListener('resize', fitContainer);
fitContainer();

function resizeCanvas() {
    canvas.width  = canvasContainer.clientWidth;
    canvas.height = canvasContainer.clientHeight;

    const zoomX = canvas.width / image.naturalWidth;
    const zoomY = canvas.height / image.naturalHeight;
    minZoom = Math.max(zoomX, zoomY);
    maxZoom = minZoom * maxZoomScale;

    zoom = clamp(zoom, minZoom, maxZoom);
    setPan(panX, panY);

    drawGridLatestActive();
}

new ResizeObserver(() => resizeCanvas()).observe(canvasContainer);
resizeCanvas();

// Draw the entire hex grid, optionally highlighting a hovered hex
function drawGrid(hoveredHex = null) {
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.setTransform(zoom, 0, 0, zoom, panX, panY);
    canvasContext.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);

    const cols = Math.ceil(image.width / hexHorizSpacing);
    const rows = Math.ceil(image.height / hexHeight);

    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            const x = col * hexHorizSpacing + hexSize + offsetX;
            const y = row * hexVertSpacing + (col % 2 === 1 ? hexHeight / 2 : 0) + hexSize / 2 + offsetY;

            const key = `${col},${row}`;
            const isHovered = hoveredHex && hoveredHex.col === col && hoveredHex.row === row;
            const isSelected = selectedHexes.has(key);

            const hexInfo = hexData.get(key);

            // Draw regions if it is on.
            if(hexInfo && hexInfo.politicalRegion && showRegion == 'political') {
                drawHex(x, y, {
                    strokeColor: "rgba(0,0,0,0.0)",
                    fillColor: hexInfo.politicalRegion.color,
                    lineWidth: 0,
                    opacity: 1
                });
            } else if(hexInfo && hexInfo.environmentalRegion && showRegion == 'environmental') {
                drawHex(x, y, {
                    strokeColor: "rgba(0,0,0,0.0)",
                    fillColor: hexInfo.environmentalRegion.color,
                    lineWidth: 0,
                    opacity: 1
                });
            }

            // Draw hovered hex.
            if (isHovered) {
                drawHex(x, y, {
                    strokeColor: "rgba(255,255,255,1)",
                    fillColor: "rgba(255,255,255,0.3)",
                    lineWidth: 2,
                    opacity: 1
                });
            } else if (isSelected) {
                // Draw selected hexes.
                drawHex(x, y, {
                    strokeColor: "yellow",
                    fillColor: "rgba(255,255,0,0.3)",
                    lineWidth: 2,
                    opacity: 1
                });
            } 
        }
    }

    // Display the infoText preview panel details for the hovered hex.
    if (hoveredHex) {
        const key = `${hoveredHex.col},${hoveredHex.row}`;
        const hexInfo = hexData.get(key);

        hexCoords.textContent = `${hoveredHex.col}, ${hoveredHex.row}`;

        let text = '';
        if (hexInfo) {
            const { politicalRegion, environmentalRegion, location } = hexInfo;
            const region = politicalRegion ?? environmentalRegion;

            if (region && location) {
                text = `<b>${location.name}</b> <span class="region-tag">· ${region.name}</span><br><i>${location.description}</i>`;
            } else if (location) {
                text = `<b>${location.name}</b><br><i>${location.description}</i>`;
            } else if (region) {
                text = `<b>${region.name}</b><br><i>${region.description}</i>`;
            }
        }

        infoText.innerHTML = text;

        if (!detailCollapsed) {
            info.classList.add('has-content');
            setDetailCollapsed(false);
        }

        const x = hoveredHex.col * hexHorizSpacing + hexSize + offsetX;
        const y = hoveredHex.row * hexVertSpacing + (hoveredHex.col % 2 === 1 ? hexHeight / 2 : 0) + hexSize / 2 + offsetY;
        drawZoomedHex(x, y);
    } else {
        zoomCanvasContext.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);
        hexCoords.textContent = '';
        infoText.textContent = '';
        info.classList.remove('has-content');
        if (!detailCollapsed) setDetailCollapsed(false);
    }
    checkAutoSnap();
}

function drawZoomedHex(centerX, centerY) {
    const zoomSize = 100;
    const scale = 2;

    zoomCanvasContext.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);

    const srcX = centerX - zoomSize / scale;
    const srcY = centerY - zoomSize / scale;
    const srcSize = zoomCanvas.width / scale;

    zoomCanvasContext.imageSmoothingEnabled = false;
    zoomCanvasContext.drawImage(
        image,
        srcX,
        srcY,
        srcSize,
        srcSize,
        0,
        0,
        zoomCanvas.width,
        zoomCanvas.height
    );

    zoomCanvasContext.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = zoomCanvas.width / 2 + (hexSize * scale) * Math.cos(angle);
        const py = zoomCanvas.height / 2 + (hexSize * scale) * Math.sin(angle);
        if (i === 0) zoomCanvasContext.moveTo(px, py);
        else zoomCanvasContext.lineTo(px, py);
    }
    zoomCanvasContext.closePath();
    zoomCanvasContext.strokeStyle = "rgba(255,255,255,0.3)";
    zoomCanvasContext.lineWidth = 4;
    zoomCanvasContext.stroke();
}

// Calculate which hex coordinates a given (x,y) on the canvas corresponds to
function getHexAtPosition(screenX, screenY) {
    // Convert screen coords to world coords (account for pan/zoom)
    const x = (screenX - panX) / zoom;
    const y = (screenY - panY) / zoom;

    const col = Math.floor(x / hexHorizSpacing);
    const colOffset = (col % 2 === 1) ? hexHeight / 2 : 0;
    const row = Math.floor((y - colOffset) / hexVertSpacing);

    return { col, row };
}

function copySelectedHexesToClipboard() {
    const hexStrings = Array.from(selectedHexes).map(key => `"${key}"`);
    const clipboardText = hexStrings.join(", ");
    navigator.clipboard.writeText(clipboardText)
    .then(() => {
        console.log("Copied:", clipboardText);
    })
    .catch(err => {
        console.error("Failed to copy:", err);
    });
}

document.addEventListener("keydown", (event) => {
    if(event.key == "Escape") {
        clearHexSelected();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        if (selectedHexes.size > 0) {
            copySelectedHexesToClipboard();
            event.preventDefault();
        }
    }
});

let isSelecting = true;

canvas.addEventListener("mousedown", (event) => {
    isDragging = true;
    isRightButton = event.button == 2;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - offsetX;
    const y = event.clientY - rect.top - offsetY;
    const { col, row } = getHexAtPosition(x, y);
    startRow = row;
    startCol = col;
    const key = `${col},${row}`;

    startDragX = event.clientX;
    startDragY = event.clientY;

    if (col >= 0 && row >= 0) {
        if (activeTool == 'select') {
            isSelecting = true;
            setHexSelected(key, true);
            drawGrid({ col, row });
            lastHex = key;
            return;
        } else if(activeTool=='erase') {
            isSelecting = false;
            setHexSelected(key, false);
            drawGrid({ col, row });
            lastHex = key;
            return;
        }
        drawGrid({ col, row });
        lastHex = key;
    }

    isPanning = true;
    startPanX = panX;
    startPanY = panY;

    event.preventDefault();
});

canvas.addEventListener("mousemove", (event) => {
    if (isPanning) {
        const dx = (event.clientX - startDragX);
        const dy = (event.clientY - startDragY);

        setPan(startPanX + dx, startPanY + dy)
        
        drawGrid({ col: startCol, row: startRow });
        return;
    }

    
    // Select the hovered hex.
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - offsetX;
    const y = event.clientY - rect.top - offsetY;

    const hoveredHex = getHexAtPosition(x, y);

    // Make sure the hovered hex is within grid bounds
    if (hoveredHex && hoveredHex.col >= 0 && hoveredHex.row >= 0) {
        drawGrid(hoveredHex);
    } else {
        drawGridLatestActive();
    }
    
    // Handle selection.
    if (!isDragging) return;

    const { col, row } = getHexAtPosition(x, y);
    const key = `${col},${row}`;

    if (col >= 0 && row >= 0 && key !== lastHex) {
        if (isSelecting) {
            setHexSelected(key, true);
        } else {
            setHexSelected(key,false);
        }
        lastHex = key;
    }

    event.preventDefault();
});

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    const zoomFactor = 1.05;
    const direction = e.deltaY > 0 ? 1 : -1;
    const scale = direction > 0 ? 1 / zoomFactor : zoomFactor;

    if((direction > 0 && zoom <= minZoom) || (direction < 0 && zoom >= maxZoom))
        return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - panX) / zoom;
    const mouseY = (e.clientY - rect.top - panY) / zoom;

    const prevZoom = zoom;
    zoom *= scale;
    zoom = clamp(zoom, minZoom, maxZoom);

    // Corrected pan logic:
    panX -= (mouseX * zoom - mouseX * prevZoom);
    panY -= (mouseY * zoom - mouseY * prevZoom);

    setPan(panX, panY);
    drawGridLatestActive();
}, { passive: false });

canvas.addEventListener("mouseup", () => {
    isPanning = false;
    isDragging = false;
    lastHex = null;

    event.preventDefault();
});

canvas.addEventListener("mouseleave", () => {
    isPanning = false;
    isDragging = false;
    lastHex = null;
    drawGridLatestActive();

    event.preventDefault();
});

function setHexSelected(key, value) {
    selectedHexesRef.update({
        [key]: value ? Date.now() : null
    })
    .then(() => {
        console.log(`Hex ${key} selected.`);
    })
    .catch((error) => {
        console.error(`Error setting hex ${key}:`, error);
    });
}

function clearHexSelected(){
    selectedHexesRef.remove()
    .then(() => {
        console.log("All selected hexes removed from the database.");
    })
    .catch((error) => {
        console.error("Error removing all selected hexes:", error);
    });
}

// listener for when selections change.
selectedHexesRef.on("value", (snapshot) => {
    let lastHex = null;

    const hexesData = snapshot.val(); // Get the data snapshot
    selectedHexes.clear();

    if (hexesData) {
        const hexEntries = Object.entries(hexesData)
            .filter(([_, timestamp]) => typeof timestamp === "number" && !isNaN(timestamp))
            .sort((a, b) => b[1] - a[1]); // Most recent first

        for (const [hexId] of hexEntries) {
            selectedHexes.add(hexId);
        }

        if (hexEntries.length > 0) {
            lastHex = hexEntries[0][0]; // key = "col,row"
        }
    }

    if (lastHex) {
        const [col, row] = lastHex.split(',').map(Number);
        latestActiveHexCol = col;
        latestActiveHexRow = row;
        drawGrid({ col, row }); // Draw with highlight
    } else {
        latestActiveHexCol = null;
        latestActiveHexRow = null;
        drawGridLatestActive();
    }

    console.log("Current selected hexes data received:", hexesData);
    console.log("Selected hexes Set contents:", Array.from(selectedHexes)); // Convert Set to Array for logging

}, (error) => {
    console.error("Error fetching selected hexes:", error);
});

// ── LOGIN ──────────────────────────────────────────────────────────────────
const loginScreen   = document.getElementById("login-screen");
const loginError    = document.getElementById("login-error");
const loginEmail    = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");

function toFirebaseEmail(username) {
    const s = (username || '').trim();
    return s.includes('@') ? s : `${s}@bytespritegames.com`;
}

function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove("hidden");
}

document.getElementById("email-sign-in-btn").addEventListener("click", () => {
    const email    = toFirebaseEmail(loginEmail.value.trim());
    const password = loginPassword.value;
    if (!loginEmail.value.trim() || !password) { showLoginError("Enter username and password."); return; }
    loginError.classList.add("hidden");
    const btn = document.getElementById("email-sign-in-btn");
    btn.textContent = "Signing in…";
    btn.disabled = true;
    auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
            showLoginError(err.message);
            btn.textContent = "Sign in";
            btn.disabled = false;
        });
});

loginPassword.addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("email-sign-in-btn").click();
});


signOutBtn.addEventListener("click", () => {
  auth.signOut();
  document.getElementById('inv-frame')?.contentWindow?.postMessage({ type: 'signOut' }, '*');
});

auth.onAuthStateChanged((user) => {
    if (user) {
        loginScreen.classList.add("hidden");
        signOutBtn.title  = `Sign out (${user.displayName || (user.email || '').split('@')[0] || 'Player'})`;
        signOutBtn.hidden = false;
        // Register username → uid so DMs can assign characters by username
        const username = (user.displayName || user.email || '').split('@')[0];
        if (username) database.ref(`/inventory_user_lookup/${username}`).set(user.uid);
    } else {
        loginScreen.classList.remove("hidden");
        signOutBtn.hidden = true;
        const btn = document.getElementById("email-sign-in-btn");
        btn.textContent = "Sign in";
        btn.disabled    = false;
    }

    drawGridLatestActive();
});

canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function setPan(x, y) {
    // Clamp pan to image boundaries
    const imageWidth = image.naturalWidth * zoom;
    const imageHeight = image.naturalHeight * zoom;

    const maxPanX = 0;
    const maxPanY = 0;
    const minPanX = canvas.width - imageWidth;
    const minPanY = canvas.height - imageHeight;

    panX = clamp(x, minPanX, maxPanX);
    panY = clamp(y, minPanY, maxPanY);
}


// Touch support
let touchStartX = 0;
let touchStartY = 0;

let initialPinchDistance = null;
let initialZoom = zoom;

canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left - offsetX;
        const y = touch.clientY - rect.top - offsetY;
        const { col, row } = getHexAtPosition(x, y);
        startRow = row;
        startCol = col;
        const key = `${col},${row}`;

        if (col >= 0 && row >= 0) {
            if (activeTool === 'select') {
                isDragging = true;
                isSelecting = true;
                setHexSelected(key, true);
            } else if (activeTool === 'erase') {
                isDragging = true;
                isSelecting = false;
                setHexSelected(key, false);
            } else if (activeTool === 'pan') {
                isPanning = true;
                startPanX = panX;
                startPanY = panY;
            }
            drawGrid({ col, row });
            lastHex = key;
        }
    } else if (e.touches.length === 2) {
        isDragging = false;
        isPanning = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.hypot(dx, dy);
        initialZoom = zoom;
    }

    e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && initialPinchDistance === null) {
        const touch = e.touches[0];

        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left - offsetX;
        const y = touch.clientY - rect.top - offsetY;
        const { col, row } = getHexAtPosition(x, y);
        const key = `${col},${row}`;

        if (activeTool === 'select' || activeTool === 'erase') {
            if (isDragging && col >= 0 && row >= 0 && key !== lastHex) {
                setHexSelected(key, isSelecting);
                lastHex = key;
                drawGrid({ col, row });
            }
        } else if (activeTool === 'pan' && isPanning) {
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            setPan(startPanX + dx, startPanY + dy);
            drawGrid({ col: startCol, row: startRow });
        }
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDistance = Math.hypot(dx, dy);

        if (initialPinchDistance != null) {
            let scale = newDistance / initialPinchDistance;
            let newZoom = clamp(initialZoom * scale, minZoom, maxZoom);

            const rect = canvas.getBoundingClientRect();
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left - panX;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top - panY;

            const mouseX = midX / zoom;
            const mouseY = midY / zoom;

            const prevZoom = zoom;
            zoom = newZoom;

            panX -= (mouseX * zoom - mouseX * prevZoom);
            panY -= (mouseY * zoom - mouseY * prevZoom);

            setPan(panX, panY);
            drawGridLatestActive();
        }
    }

    e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
        initialPinchDistance = null;
    }

    isDragging = false;
    isPanning = false;
    lastHex = null;
});

// Tool cycle: pan → select → erase → pan
const toolStates = ['pan', 'select', 'erase'];
const toolIcons = {
    pan:    'fa-arrows-up-down-left-right',
    select: 'fa-paintbrush',
    erase:  'fa-eraser'
};

let activeTool = 'pan';
const toolToggleBtn = document.getElementById('toolToggleBtn');

function setActiveTool(toolName) {
    activeTool = toolName;
    toolToggleBtn.querySelector('i').className = `fa-solid fa-fw ${toolIcons[toolName]}`;
}

toolToggleBtn.addEventListener('click', () => {
    const next = (toolStates.indexOf(activeTool) + 1) % toolStates.length;
    setActiveTool(toolStates[next]);
});

// Overlay cycle: none → territory → environment → none
const overlayStates = [null, 'political', 'environmental'];
const overlayIcons  = ['fa-layer-group', 'fa-circle-user', 'fa-tree'];
let overlayIndex = 0;
const overlayToggleBtn = document.getElementById('overlayToggleBtn');

overlayToggleBtn.addEventListener('click', () => {
    overlayIndex = (overlayIndex + 1) % overlayStates.length;
    showRegion = overlayStates[overlayIndex];
    overlayToggleBtn.querySelector('i').className = `fa-solid fa-fw ${overlayIcons[overlayIndex]}`;
    drawGridLatestActive();
});

clearBtn.addEventListener('click', () => {
    clearHexSelected();
});

function updatePositionBtn() {
    const gap = 10;
    const panelH = info.offsetHeight;
    if (panelAtTop) {
        positionToggleBtn.style.top    = `${panelH + gap}px`;
        positionToggleBtn.style.bottom = '';
    } else {
        positionToggleBtn.style.bottom = `${panelH + gap}px`;
        positionToggleBtn.style.top    = '';
    }
}

function applyPanelSnap() {
    info.classList.toggle('panel-top', panelAtTop);
    updatePositionBtn();
}

function checkAutoSnap() {
    if (!image.naturalWidth || invOverlay.classList.contains('open')) {
        positionToggleBtn.classList.remove('visible');
        return;
    }
    const imageHeight = image.naturalHeight * zoom;

    // Condition 1: too zoomed out — would constantly flip
    if (imageHeight - canvas.height < 80) {
        positionToggleBtn.classList.add('visible');
        return;
    }

    // Condition 2: at a boundary where a snap would have fired
    const atBottom = !panelAtTop && panY <= canvas.height - imageHeight + 4;
    const atTop    =  panelAtTop && panY >= -4;
    positionToggleBtn.classList.toggle('visible', atBottom || atTop);
}

positionToggleBtn.addEventListener('click', () => {
    panelAtTop = !panelAtTop;
    info.classList.toggle('panel-top', panelAtTop);
    updatePositionBtn();
    positionToggleBtn.querySelector('i').className =
        panelAtTop ? 'fa-solid fa-fw fa-arrow-down' : 'fa-solid fa-fw fa-arrow-up';
    positionToggleBtn.title = panelAtTop ? 'Move panel to bottom' : 'Move panel to top';
    setPan(panX, panY);
    drawGridLatestActive();
});

function drawGridLatestActive(){
    if(latestActiveHexCol != null && latestActiveHexRow != null)
        drawGrid({col: latestActiveHexCol, row: latestActiveHexRow});
    else
        drawGrid();
}


const invBtn     = document.getElementById("invBtn");

invBtn.addEventListener("click", () => {
    const open = invOverlay.classList.toggle("open");
    invBtn.classList.toggle("active", open);
    info.classList.toggle("inv-open", open);
    if (open) {
        const email    = toFirebaseEmail(loginEmail.value.trim());
        const password = loginPassword.value;
        if (loginEmail.value.trim() && password) {
            document.getElementById('inv-frame')
                ?.contentWindow?.postMessage({ type: 'signIn', email, password }, '*');
        }
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && invOverlay.classList.contains("open")) {
        invOverlay.classList.remove("open");
        invBtn.classList.remove("active");
        info.classList.remove("inv-open");
    }
});

window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "closeInventory") {
        invOverlay.classList.remove("open");
        invBtn.classList.remove("active");
        info.classList.remove("inv-open");
    }
});

