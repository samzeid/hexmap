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

const hexPingRef     = database.ref('hexPing');
const hexSelectedRef = database.ref('hexSelected');
const hexFocusRef    = database.ref('hexFocus');
const pingSound      = new Audio('sounds/ping.ogg');

// Get elements
const image = new Image();
image.src = "https://lh3.googleusercontent.com/d/1fySy_aXhOZHiJGMw6B2xon_8nMiVeyK6?authuser=0";
const canvas = document.getElementById("canvas");
const canvasContext = canvas.getContext("2d");

const invFrameWrap  = document.getElementById("inv-frame-wrap");

function sendToFrame(msg) {
    document.getElementById('inv-frame')?.contentWindow?.postMessage(msg, '*');
}

new ResizeObserver(() => {
    setPan(panX, panY);
    drawGridLatestActive();
}).observe(canvas);


let _hexNotesRef = null;
let _hexNotesKey = null;
let _hexNotesSaveTimer = null;

let _hexCustomNameRef = null;
let _hexCustomNameKey = null;
let _hexCustomNameSaveTimer = null;

const hexNotesCache = new Map(); // col_row → true, for dot rendering

database.ref('/hexNotes').on('value', snap => {
    hexNotesCache.clear();
    const val = snap.val();
    if (val) Object.keys(val).forEach(k => hexNotesCache.set(k, true));
    drawGridLatestActive();
});

function attachHexNotes(key) {
    if (_hexNotesKey === key) return;
    if (_hexNotesRef) { _hexNotesRef.off('value', _onHexNote); _hexNotesRef = null; }
    _hexNotesKey = key;
    sendToFrame({ type: 'hexNotes', value: '' });
    if (!key) return;
    _hexNotesRef = database.ref(`/hexNotes/${key}`);
    _hexNotesRef.on('value', _onHexNote);
}

function _onHexNote(snap) {
    sendToFrame({ type: 'hexNotes', value: snap.val() || '' });
}

function attachHexCustomName(key) {
    if (_hexCustomNameKey === key) return;
    if (_hexCustomNameRef) { _hexCustomNameRef.off('value', _onHexCustomName); _hexCustomNameRef = null; }
    _hexCustomNameKey = key;
    sendToFrame({ type: 'hexCustomName', value: '' });
    if (!key) return;
    _hexCustomNameRef = database.ref(`/hexCustomNames/${key}`);
    _hexCustomNameRef.on('value', _onHexCustomName);
}

function _onHexCustomName(snap) {
    sendToFrame({ type: 'hexCustomName', value: snap.val() || '' });
}

const selectedHexes = new Map(); // key → color string

const DRAW_COLORS = ['#E6194B', '#00C5FF', '#FFDC26'];
const DRAW_HATCH  = {
    '#E6194B': 'vertical',
    '#00C5FF': 'horizontal',
    '#FFDC26': 'diagonal',
};


let activeDrawColor = DRAW_COLORS[0];

const hexSize = 13.525;
const hexWidth = 27.275;
const hexHeight = Math.sqrt(3) * hexSize;
const hexVertSpacing = hexHeight;
const hexHorizSpacing = (3 / 4) * hexWidth;

const maxZoomScale = 3;

let offsetX = -11;
let offsetY = 1;

let lastHex = null;
let latestInspectorHex = null;

//let isShowRegionOn = false;
let showRegion = null;

let isDragging = false;
let isPanning = false;
let hasDragged = false;
let startDragX = 0;
let startDragY = 0;
let startPanX = 0;
let startPanY = 0;
const DRAG_THRESHOLD = 6;

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
        hatchType = null,
        hatchColor = null,
        lineWidth = 1,
        opacity = 1,
    } = options;

    function buildPath() {
        canvasContext.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = x + hexSize * Math.cos(angle);
            const py = y + hexSize * Math.sin(angle);
            if (i === 0) canvasContext.moveTo(px, py);
            else canvasContext.lineTo(px, py);
        }
        canvasContext.closePath();
    }

    canvasContext.save();
    canvasContext.globalAlpha = opacity;
    buildPath();

    if (fillColor) {
        canvasContext.fillStyle = fillColor;
        canvasContext.fill();
    }

    if (hatchType && hatchColor) {
        canvasContext.save();
        buildPath();
        canvasContext.clip();
        canvasContext.strokeStyle = hatchColor;
        canvasContext.lineWidth = 1.5;
        canvasContext.globalAlpha = opacity * 0.6;
        const sp = 5, r = hexSize + 2;
        canvasContext.beginPath();
        if (hatchType === 'vertical') {
            for (let dx = -r; dx <= r + sp; dx += sp) {
                canvasContext.moveTo(x + dx, y - r);
                canvasContext.lineTo(x + dx, y + r);
            }
        } else if (hatchType === 'horizontal') {
            for (let dy = -r; dy <= r + sp; dy += sp) {
                canvasContext.moveTo(x - r, y + dy);
                canvasContext.lineTo(x + r, y + dy);
            }
        } else {
            for (let d = -2 * r; d <= 2 * r + sp; d += sp) {
                canvasContext.moveTo(x - r, y - r + d);
                canvasContext.lineTo(x + r, y + r + d);
            }
        }
        canvasContext.stroke();
        canvasContext.restore();
    }

    buildPath();
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
    const w = canvasContainer.clientWidth;
    const h = canvasContainer.clientHeight;
    if (!w || !h) return;

    canvas.width  = w;
    canvas.height = h;

    const zoomX = w / image.naturalWidth;
    const zoomY = h / image.naturalHeight;
    minZoom = Math.max(zoomX, zoomY);
    maxZoom = minZoom * maxZoomScale;

    zoom = clamp(zoom, minZoom, maxZoom);
    setPan(panX, panY);

    drawGridLatestActive();
}

// Ping/flash state — declared here so drawGrid can reference them safely
let _pingTimer  = null;
let _pingFired  = false;
let _flashHex   = null;
let _flashStart = null;
let _panAnimId  = null;
let _focusHex   = null;
const PING_HOLD_MS      = 600;
const PING_DURATION     = 2500;
const PING_RING_COUNT   = 3;
const PING_RING_LIFE    = 1200;
const PING_RING_STAGGER = 600;
const PING_PANEL_OFFSET = 80;
let _lastSeenPingTime = Date.now();

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
            const isHovered   = hoveredHex && hoveredHex.col === col && hoveredHex.row === row;
            const isFocused   = _focusHex  && _focusHex.col  === col && _focusHex.row  === row;
            const selColor    = selectedHexes.get(key);

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

            // Draw selected colour first so focus/hover overlays blend on top.
            if (selColor) {
                drawHex(x, y, {
                    strokeColor: selColor,
                    hatchType:  DRAW_HATCH[selColor],
                    hatchColor: selColor,
                    lineWidth: 2,
                    opacity: 1
                });
            }
            if (isHovered || isFocused) {
                drawHex(x, y, {
                    strokeColor: "rgba(255,255,255,0.85)",
                    fillColor: "rgba(255,255,255,0.08)",
                    lineWidth: 2,
                    opacity: 1
                });
            }

            // Small dot for hexes with notes
            if (hexNotesCache.has(`${col}_${row}`)) {
                canvasContext.save();
                canvasContext.fillStyle = 'rgba(255,255,255,0.8)';
                canvasContext.beginPath();
                canvasContext.arc(x, y, 1.8, 0, Math.PI * 2);
                canvasContext.fill();
                canvasContext.restore();
            }
        }
    }

    // Circular ping pulse rings
    if (_flashHex && _flashStart !== null) {
        const elapsed = performance.now() - _flashStart;
        const cx = _flashHex.col * hexHorizSpacing + hexSize + offsetX;
        const cy = _flashHex.row * hexVertSpacing + (_flashHex.col % 2 === 1 ? hexHeight / 2 : 0) + hexSize / 2 + offsetY;
        const flashAlpha = Math.max(0, 1 - elapsed / (PING_RING_LIFE * 0.6));
        if (flashAlpha > 0) {
            drawHex(cx, cy, {
                strokeColor: `rgba(255,255,255,${flashAlpha})`,
                fillColor:   `rgba(255,255,255,${flashAlpha * 0.12})`,
                lineWidth: 2,
                opacity: 1,
            });
        }
        for (let i = 0; i < PING_RING_COUNT; i++) {
            const ringElapsed = elapsed - i * PING_RING_STAGGER;
            if (ringElapsed <= 0 || ringElapsed >= PING_RING_LIFE) continue;
            const t = ringElapsed / PING_RING_LIFE;
            const radius = hexSize * (0.4 + t * 4.5);
            const alpha  = (1 - t) * 0.9;
            canvasContext.save();
            canvasContext.beginPath();
            canvasContext.arc(cx, cy, radius, 0, Math.PI * 2);
            canvasContext.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            canvasContext.lineWidth = 3;
            canvasContext.stroke();
            canvasContext.restore();
        }
    }

    // Show hex description in inspector panel.
    if (hoveredHex) {
        const key = `${hoveredHex.col},${hoveredHex.row}`;
        const hexInfo = hexData.get(key);
        const notesKey = `${hoveredHex.col}_${hoveredHex.row}`;

        let name = '', desc = '', hasLocation = false;
        if (hexInfo) {
            const { politicalRegion, environmentalRegion, location } = hexInfo;
            const region = politicalRegion ?? environmentalRegion;
            if (location && location.name) {
                name = location.name;
                desc = location.description || '';
                hasLocation = true;
            } else if (region && region.name) {
                name = region.name;
                desc = region.description || '';
                hasLocation = true;
            }
        }

        sendToFrame({ type: 'hexInfo', name, coords: `${hoveredHex.col}, ${hoveredHex.row}`, desc, hasLocation });
        attachHexNotes(notesKey);
        attachHexCustomName(hasLocation ? null : notesKey);
    } else {
        sendToFrame({ type: 'hexInfo', name: '', coords: '', desc: '' });
        attachHexNotes(null);
        attachHexCustomName(null);
    }
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
    const hexStrings = Array.from(selectedHexes.keys()).map(key => `"${key}"`);
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
    hasDragged = false;
    if (col >= 0 && row >= 0) {
        lastHex = key;
        startPingTimer(col, row);
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
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) { hasDragged = true; cancelPingTimer(); }

        setPan(startPanX + dx, startPanY + dy);
        drawGridLatestActive();
        return;
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
    drawGridLatestActive();
}, { passive: false });

canvas.addEventListener("mouseup", (event) => {
    cancelPingTimer();
    if (!hasDragged && !_pingFired && startCol >= 0 && startRow >= 0) {
        if (activeTool === 'select') {
            const _sk = `${startCol},${startRow}`;
            setHexSelected(_sk, selectedHexes.get(_sk) === activeDrawColor ? false : activeDrawColor);
            revealHexInfo(startCol, startRow);
        } else if (activeTool === 'erase') {
            setHexSelected(`${startCol},${startRow}`, false);
            revealHexInfo(startCol, startRow);
        } else {
            if (_focusHex && _focusHex.col === startCol && _focusHex.row === startRow) {
                hexFocusRef.remove();
            } else {
                hexFocusRef.set({ col: startCol, row: startRow });
            }
        }
    }
    isPanning = false;
    isDragging = false;
    hasDragged = false;
    _pingFired = false;
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

function revealHexInfo(col, row) {
    latestInspectorHex = { col, row };
    drawGrid({ col, row });
}

function setHexSelected(key, color) {
    if (color) hexSelectedRef.child(key).set(color);
    else hexSelectedRef.child(key).remove();
}

function clearHexSelected() {
    hexSelectedRef.remove();
}

// ── PING ──────────────────────────────────────────────────────────────────
function startPingTimer(col, row) {
    cancelPingTimer();
    _pingFired = false;
    _pingTimer = setTimeout(() => {
        _pingTimer = null;
        _pingFired = true;
        const t = Date.now();
        _lastSeenPingTime = t;
        pingSound.currentTime = 0;
        pingSound.play().catch(() => {});
        hexPingRef.set({ col, row, t });
        hexFocusRef.set({ col, row });
    }, PING_HOLD_MS);
}

function cancelPingTimer() {
    if (_pingTimer) { clearTimeout(_pingTimer); _pingTimer = null; }
}

function centerOnHex(col, row) {
    const wx = col * hexHorizSpacing + hexSize + offsetX;
    const wy = row * hexVertSpacing + (col % 2 === 1 ? hexHeight / 2 : 0) + hexSize / 2 + offsetY;
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inv-header-h')) || 0;
    const targetZoom = Math.min(maxZoom, Math.max(zoom, minZoom * 2.5));
    const targetX = canvas.width  / 2 - wx * targetZoom;
    const targetY = canvas.height / 2 - headerH / 2 - PING_PANEL_OFFSET - wy * targetZoom;
    const startX = panX, startY = panY, startZoom = zoom, t0 = performance.now();
    if (_panAnimId) cancelAnimationFrame(_panAnimId);
    function step(now) {
        const p = Math.min((now - t0) / 450, 1);
        const e = 1 - Math.pow(1 - p, 3);
        zoom = startZoom + (targetZoom - startZoom) * e;
        setPan(startX + (targetX - startX) * e, startY + (targetY - startY) * e);
        drawGridLatestActive();
        if (p < 1) _panAnimId = requestAnimationFrame(step);
        else _panAnimId = null;
    }
    _panAnimId = requestAnimationFrame(step);
}

function flashHex(col, row) {
    _flashHex   = { col, row };
    _flashStart = performance.now();
    function tick(now) {
        if (!_flashHex) return;
        drawGridLatestActive();
        if (now - _flashStart < PING_DURATION) requestAnimationFrame(tick);
        else { _flashHex = null; drawGridLatestActive(); }
    }
    requestAnimationFrame(tick);
}

hexPingRef.on('value', snap => {
    const ping = snap.val();
    if (!ping || ping.t <= _lastSeenPingTime) return;
    _lastSeenPingTime = ping.t;
    centerOnHex(ping.col, ping.row);
    flashHex(ping.col, ping.row);
    pingSound.currentTime = 0;
    pingSound.play().catch(() => {});
});

hexSelectedRef.on('value', snap => {
    selectedHexes.clear();
    const val = snap.val();
    if (val) Object.entries(val).forEach(([k, color]) => selectedHexes.set(k, color));
    drawGridLatestActive();
});

hexFocusRef.on('value', snap => {
    _focusHex = snap.val();
    if (_focusHex) {
        latestInspectorHex = { col: _focusHex.col, row: _focusHex.row };
    } else {
        latestInspectorHex = null;
        sendToFrame({ type: 'hexInfo', name: '', coords: '', desc: '' });
        attachHexNotes(null);
        attachHexCustomName(null);
    }
    drawGridLatestActive();
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


auth.onAuthStateChanged((user) => {
    if (user) {
        loginScreen.classList.add("hidden");
        // Pass credentials to inventory iframe (fields still populated right after login)
        const email    = toFirebaseEmail(loginEmail.value.trim());
        const password = loginPassword.value;
        if (email && password) {
            document.getElementById('inv-frame')
                ?.contentWindow?.postMessage({ type: 'signIn', email, password }, '*');
        }
        // Register username → uid so DMs can assign characters by username
        const username = (user.displayName || user.email || '').split('@')[0];
        if (username) database.ref(`/inventory_user_lookup/${username}`).set(user.uid);
        sendHexState();
    } else {
        loginScreen.classList.remove("hidden");
        document.getElementById('inv-frame')?.contentWindow?.postMessage({ type: 'signOut' }, '*');
        const btn = document.getElementById("email-sign-in-btn");
        btn.textContent = "Sign in";
        btn.disabled    = false;
        sendHexState();
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

        hasDragged = false;
        isPanning = true;
        startPanX = panX;
        startPanY = panY;
        if (col >= 0 && row >= 0) {
            lastHex = key;
            startPingTimer(col, row);
        }
    } else if (e.touches.length === 2) {
        isDragging = false;
        isPanning = false;
        hasDragged = true;
        cancelPingTimer();
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

        if (isPanning) {
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            if (Math.hypot(dx, dy) > DRAG_THRESHOLD) { hasDragged = true; cancelPingTimer(); }
            setPan(startPanX + dx, startPanY + dy);
            drawGridLatestActive();
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
    cancelPingTimer();
    if (!hasDragged && !_pingFired && startCol >= 0 && startRow >= 0) {
        if (activeTool === 'select') {
            const _sk = `${startCol},${startRow}`;
            setHexSelected(_sk, selectedHexes.get(_sk) === activeDrawColor ? false : activeDrawColor);
            revealHexInfo(startCol, startRow);
        } else if (activeTool === 'erase') {
            setHexSelected(`${startCol},${startRow}`, false);
            revealHexInfo(startCol, startRow);
        } else {
            if (_focusHex && _focusHex.col === startCol && _focusHex.row === startRow) {
                hexFocusRef.remove();
            } else {
                hexFocusRef.set({ col: startCol, row: startRow });
            }
        }
    }
    isDragging = false;
    isPanning = false;
    hasDragged = false;
    _pingFired = false;
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

function setActiveTool(toolName) {
    activeTool = toolName;
    sendHexState();
}

// Overlay cycle: none → territory → environment → none
const overlayStates = [null, 'political', 'environmental'];
const overlayIcons  = ['fa-layer-group', 'fa-circle-user', 'fa-tree'];
let overlayIndex = 0;

function sendHexState() {
    sendToFrame({
        type:        'hexState',
        toolIcon:    toolIcons[activeTool],
        overlayIcon: overlayIcons[overlayIndex],
        toolActive:  activeTool !== 'pan',
        showColors:  activeTool === 'select',
        signedIn:    !!auth.currentUser,
        activeColor: activeDrawColor,
    });
}

function drawGridLatestActive(){
    if (latestInspectorHex)
        drawGrid(latestInspectorHex);
    else
        drawGrid();
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains('inv-open')) {
        document.body.classList.remove('inv-open');
    }
});

window.addEventListener("message", (e) => {
    if (!e.data) return;
    if (e.data.type === "toggleView") {
        document.body.classList.toggle('inv-open');
        if (document.body.classList.contains('inv-open')) {
            sendToFrame({ type: 'hexInfo', name: '', coords: '', desc: '' });
            attachHexNotes(null);
            attachHexCustomName(null);
        }
    }
    if (e.data.type === 'hexCustomNameInput') {
        clearTimeout(_hexCustomNameSaveTimer);
        _hexCustomNameSaveTimer = setTimeout(() => {
            if (!_hexCustomNameKey) return;
            const val = e.data.value;
            if (val) database.ref(`/hexCustomNames/${_hexCustomNameKey}`).set(val);
            else     database.ref(`/hexCustomNames/${_hexCustomNameKey}`).remove();
        }, 600);
    }
    if (e.data.type === 'hexNotesInput') {
        clearTimeout(_hexNotesSaveTimer);
        _hexNotesSaveTimer = setTimeout(() => {
            if (!_hexNotesKey) return;
            const val = e.data.value;
            if (val) database.ref(`/hexNotes/${_hexNotesKey}`).set(val);
            else     database.ref(`/hexNotes/${_hexNotesKey}`).remove();
        }, 600);
    }
    if (e.data.type === 'hexInfoClose') {
        hexFocusRef.remove();
    }
    if (e.data.type === "headerHeight") {
        document.documentElement.style.setProperty('--inv-header-h', e.data.height + 'px');
    }
    if (e.data.type === "hexAction") {
        switch (e.data.action) {
            case 'toolToggle': {
                const next = (toolStates.indexOf(activeTool) + 1) % toolStates.length;
                setActiveTool(toolStates[next]);
                break;
            }
            case 'overlayToggle':
                overlayIndex = (overlayIndex + 1) % overlayStates.length;
                showRegion = overlayStates[overlayIndex];
                sendHexState();
                drawGridLatestActive();
                break;
            case 'colorSelect':
                if (DRAW_COLORS.includes(e.data.color)) {
                    activeDrawColor = e.data.color;
                    sendHexState();
                }
                break;
            case 'clearHexes':
                clearHexSelected();
                break;
            case 'signOut':
                auth.signOut();
                break;
        }
    }
});

