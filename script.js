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
const image = document.getElementById("mapImage");
const canvas = document.getElementById("canvas");
const canvasContext = canvas.getContext("2d");
const zoomCanvas = document.getElementById("zoomPreview");
const zoomCanvasContext = zoomCanvas.getContext("2d");

const infoText = document.getElementById("infoText");
const selectedHexes = new Set();

const hexSize = 13.525;
const hexWidth = 27.275;
const hexHeight = Math.sqrt(3) * hexSize;
const hexVertSpacing = hexHeight;
const hexHorizSpacing = (3 / 4) * hexWidth;

let offsetX = -11;
let offsetY = 1;

let lastHex = null;

let isShowRegionOn = false;
let isDragging = false;
let isShiftHeld = false;

const hexData = new Map();

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

// Draw the entire hex grid, optionally highlighting a hovered hex
function drawGrid(hoveredHex = null) {
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.style.width = image.width + "px";
    canvas.style.height = image.height + "px";
    canvas.style.pointerEvents = "auto";

    canvasContext.clearRect(0, 0, canvas.width, canvas.height);

    const cols = Math.ceil(canvas.width / hexHorizSpacing);
    const rows = Math.ceil(canvas.height / hexHeight);

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
                text = `<i>Region: ${region.name}</i><br><b>${location.name}</b><br><i>${location.description}</i><br><br>${text}`;
            } else if (location) {
                text = `<b>${location.name}</b><br><i>${location.description}</i><br><br>${text}`;
            } else if (region) {
                text = `<i>Region: ${region.name}</i><br><i>${region.description}</i><br><br>${text}`;
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
function getHexAtPosition(x, y) {
    const col = Math.floor(x / hexHorizSpacing);
    const colOffset = (col % 2 === 1) ? hexHeight / 2 : 0;
    const row = Math.floor((y - colOffset) / hexVertSpacing);
    return { col, row };
}

// Handle hover on mouse move
canvas.addEventListener("mousemove", (event) => {
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
});

// Clear hover info when mouse leaves
canvas.addEventListener("mouseleave", () => {
    drawGrid();
});


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

    if (event.key === "Shift") {
        isShiftHeld = true;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        if (selectedHexes.size > 0) {
            copySelectedHexesToClipboard();
            event.preventDefault();
        }
    }
});

document.addEventListener("keyup", (event) => {
    if (event.key === "Shift") isShiftHeld = false;
});

canvas.addEventListener("mousedown", (event) => {
    isDragging = true;
    isShiftHeld = event.shiftKey;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - offsetX;
    const y = event.clientY - rect.top - offsetY;
    const { col, row } = getHexAtPosition(x, y);
    const key = `${col},${row}`;

    if (col >= 0 && row >= 0) {
        if (isShiftHeld) {
            setHexSelected(key, true);
        } else {
            setHexSelected(key, false);
        }
        drawGrid({ col, row });
        lastHex = key;
    }
});

canvas.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - offsetX;
    const y = event.clientY - rect.top - offsetY;
    const { col, row } = getHexAtPosition(x, y);
    const key = `${col},${row}`;

    if (col >= 0 && row >= 0 && key !== lastHex) {
        if (isShiftHeld) {
            setHexSelected(key, true);
        } else {
            setHexSelected(key,false);
        }
        lastHex = key;
    }
});

canvas.addEventListener("mouseup", () => {
    isDragging = false;
    isShiftHeld = false;
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