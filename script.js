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

authenticateFromUrl();

// Get elements
const image = new Image();
image.src = "https://lh3.googleusercontent.com/d/1fySy_aXhOZHiJGMw6B2xon_8nMiVeyK6?authuser=0";
const canvas = document.getElementById("canvas");
const canvasContext = canvas.getContext("2d");
const zoomCanvas = document.getElementById("zoomPreview");
const zoomCanvasContext = zoomCanvas.getContext("2d");

const info = document.getElementById("info");
const infoText = document.getElementById("infoText");


const scaleUpBtn = document.getElementById('scaleUpBtn');
const scaleDownBtn = document.getElementById('scaleDownBtn');
const resetPositionBtn = document.getElementById('resetPositionBtn');

const togglePanBtn = document.getElementById('togglePanBtn');
const toggleSelectBtn = document.getElementById('toggleSelectBtn');
const toggleEraseBtn = document.getElementById('toggleEraseBtn');

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

let isShowRegionOn = false;

let isDragging = false;
let isPanning = false;
let startDragX = 0;
let startDragY = 0;
let startPanX = 0;
let startPanY = 0;

let minZoom = 1; // this will be calculated after the image loads.
let maxZoom = 1; // this will be calculated after the image loads using maxZoomScale.

let zoom = 1;
let panX = 0;
let panY = 0;

let currentInfoScale = 1;
const minInfoScale = 0.5;
const maxInfoScale = 2;

const hexData = new Map();

function resetInfoPanelSize() {
    currentInfoScale = 1;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Use a fraction of the smaller dimension to maintain consistent scale
    const base = Math.min(screenW, screenH);

    const width = base * 0.2;
    const height = width * 2;

    info.style.width = `${Math.round(width)}px`;
    info.style.height = `${Math.round(height)}px`;

    //info.style.left = "10px";
    //info.style.top = "10px";
    const rect = info.getBoundingClientRect();

    const newLeft = window.innerWidth - width - 100;   // mimics right:10px
    const newTop = window.innerHeight - height - 100;  // mimics bottom:10px

    info.style.left = `${newLeft}px`;
    info.style.top = `${newTop}px`;
    
    applyScale();
}


window.addEventListener("resize", resetInfoPanelSize);
window.addEventListener("orientationchange", resetInfoPanelSize);
window.addEventListener("load", resetInfoPanelSize);

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

    drawGrid();
};

// Load hex info json
fetch('https://samzeid.github.io/hexmap/hexinfo.json')
.then(res => res.json())
.then(data => {
    const { regions, locations } = data;

    regions.forEach(region => {
        region.hexes.forEach(hex => {
            if (!hexData.has(hex)) {
                hexData.set(hex, { region: null, location: null });
            }
                hexData.get(hex).region = {
                name: region.name,
                description: region.description,
                color: region.color,
                type: region.type || null
            };
        });
    });

    locations.forEach(location => {
        location.hexes.forEach(hex => {
            if (!hexData.has(hex)) {
                hexData.set(hex, { region: null, location: null });
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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const zoomX = canvas.width / image.naturalWidth;
    const zoomY = canvas.height / image.naturalHeight;
    minZoom = Math.max(zoomX, zoomY);
    maxZoom = minZoom * maxZoomScale;

    zoom = clamp(zoom, minZoom, maxZoom);
    setPan(panX, panY);

    drawGrid();
}

window.addEventListener('resize', resizeCanvas);
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
            if(hexInfo && hexInfo.region && isShowRegionOn) {
                drawHex(x, y, {
                    strokeColor: "rgba(0,0,0,0.0)",
                    fillColor: hexInfo.region.color,
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

    // Display the infoText preview panel details for the hovered text.
    if (hoveredHex) {
        const key = `${hoveredHex.col},${hoveredHex.row}`;
        const hexInfo = hexData.get(key);

        let text = `Hex: col=${hoveredHex.col}, row=${hoveredHex.row}`;

        if (hexInfo) {
            const { region, location } = hexInfo;

            if (region && location) {
                text = `${text}<br><br><i>Region: ${region.name}</i><br><b>${location.name}</b><br><i>${location.description}</i>`;
            } else if (location) {
                text = `${text}<br><br><b>${location.name}</b><br><i>${location.description}</i>`;
            } else if (region) {
                text = `${text}<br><br><i>Region: ${region.name}</i><br><i>${region.description}</i>`;
            }
        }

        infoText.innerHTML = text;

        const x = hoveredHex.col * hexHorizSpacing + hexSize + offsetX;
        const y = hoveredHex.row * hexVertSpacing + (hoveredHex.col % 2 === 1 ? hexHeight / 2 : 0) + hexSize / 2 + offsetY;
        drawZoomedHex(x, y);
    } else {
        zoomCanvasContext.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);
        infoText.textContent = "";
    }
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

    if(event.ctrlKey) {
        isShowRegionOn = !isShowRegionOn;
        drawGrid();
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
});

canvas.addEventListener("mousemove", (event) => {
    if (isPanning) {
        const dx = (event.clientX - startDragX);
        const dy = (event.clientY - startDragY);

        setPan(startPanX + dx, startPanY + dy)

        drawGrid();
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
        drawGrid();
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
    drawGrid();
}, { passive: false });

canvas.addEventListener("mouseup", () => {
    isPanning = false;
    isDragging = false;
    lastHex = null;
});

canvas.addEventListener("mouseleave", () => {
    isPanning = false;
    isDragging = false;
    lastHex = null;
});

function setHexSelected(key, value) {
    selectedHexesRef.update({
        [key]: value ? true : null
    })
    .then(() => {
        console.log("Hex ${key} selected.");
    })
    .catch((error) => {
        console.error("Error setting hex ${key}:", error);
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
    const hexesData = snapshot.val(); // Get the data snapshot
    selectedHexes.clear();

    if (hexesData) {
        const hexKeys = Object.keys(hexesData);
        hexKeys.forEach(hexId => {
            selectedHexes.add(hexId);
        });
    }

    drawGrid();

    console.log("Current selected hexes data received:", hexesData);
    console.log("Selected hexes Set contents:", Array.from(selectedHexes)); // Convert Set to Array for logging

}, (error) => {
    console.error("Error fetching selected hexes:", error);
});

// Use the url to pass in an email and password for authentication.
function authenticateFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get("email");
    const password = urlParams.get("password");

    if (email && password) {
        console.log("Found email and password in URL. Attempting sign in...");

        auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Sign in successful with shared credentials.");
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error("Authentication Error:", errorCode, errorMessage);
        });
    } else {
        console.log("No email or password found in URL.");
    }
}

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("Auth state changed: User is signed in (UID:", user.uid, ")");
    } else {
        console.log("Auth state changed: User is signed out.");
    }

    drawGrid();
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

// allow draging of info panel.

function makeDraggable(element) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    // Mouse Events
    element.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return; // Only left click
        isDragging = true;
        offsetX = e.clientX - element.offsetLeft;
        offsetY = e.clientY - element.offsetTop;
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        element.style.left = `${e.clientX - offsetX}px`;
        element.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
    });

    // Touch Events
    element.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return; // Only single-finger drag
        const touch = e.touches[0];
        isDragging = true;
        offsetX = touch.clientX - element.offsetLeft;
        offsetY = touch.clientY - element.offsetTop;
        e.preventDefault();
    }, { passive: false });

    document.addEventListener("touchmove", (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        element.style.left = `${touch.clientX - offsetX}px`;
        element.style.top = `${touch.clientY - offsetY}px`;
        e.preventDefault();
    }, { passive: false });

    document.addEventListener("touchend", () => {
        isDragging = false;
    });
}
  
makeDraggable(document.getElementById("info"));

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
        startPanX = panX;
        startPanY = panY;
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.hypot(dx, dy);
        initialZoom = zoom;
    }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && initialPinchDistance === null) {
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        setPan(startPanX + dx, startPanY + dy);
        drawGrid();
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDistance = Math.hypot(dx, dy);

        if (initialPinchDistance != null) {
            let scale = newDistance / initialPinchDistance;
            let newZoom = clamp(initialZoom * scale, minZoom, maxZoom);

            // Center zoom on midpoint between fingers
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
            drawGrid();
        }
    }

    e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
        initialPinchDistance = null;
    }
});


// Scale handling
function applyScale() {
    info.style.transform = `scale(${currentInfoScale})`;
    info.style.transformOrigin = 'bottom right';
}
  
scaleUpBtn.addEventListener('click', () => {
    currentInfoScale = Math.min(currentInfoScale * 1.2, maxInfoScale);
    applyScale();
});
  
scaleDownBtn.addEventListener('click', () => {
    currentInfoScale = Math.max(currentInfoScale / 1.2, minInfoScale);
    applyScale();
});
  
// Reset scale and position
resetPositionBtn.addEventListener('click', () => {
    resetInfoPanelSize();
});

// Tool toggles
const toolButtons = {
    select: document.getElementById('toggleSelectBtn'),
    erase: document.getElementById('toggleEraseBtn'),
    pan: document.getElementById('togglePanBtn'),
  };
  
let activeTool = null; // Set a default active tool
  
function setActiveTool(toolName) {
    if (activeTool === toolName) return; // Do nothing if it's already active
  
    // Deactivate all tools
    for (const [name, btn] of Object.entries(toolButtons)) {
      btn.classList.remove('active');
    }
  
    // Activate the chosen one
    toolButtons[toolName].classList.add('active');
    activeTool = toolName;
  
    console.log("Active tool:", activeTool);
}

toggleSelectBtn.addEventListener('click', () => {
    setActiveTool('select');
});

toggleEraseBtn.addEventListener('click', () => {
    setActiveTool('erase');
});

togglePanBtn.addEventListener('click', () => {
    setActiveTool('pan');
});

setActiveTool('pan');