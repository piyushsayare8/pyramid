// =========================================================================
// 1. ENGINE CONFIGURATION & IMMORTAL CONSTANTS
// =========================================================================
const CONFIG = {
    ROWS: 100,
    BLOCK_SIZE: 40,
    GAP: 2,
    TOTAL_BLOCKS: 5050,
    LOD_THRESHOLD: 0.35, 
    LOD_BATCH_SIZE: 1000, // Process this many LOD updates per frame (Time Slicing)
    CHUNK_SIZE: 25,
    MAX_ZOOM: 50.0,
    MIN_ZOOM: 0.005,
    FRICTION: 0.92, // Increased for smoother glide
    COLORS: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#B983FF', '#FD79A8'],
    API_BASE: '', // Empty for same-origin requests (frontend + API on same worker)
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

const PYRAMID_WIDTH = CONFIG.ROWS * CONFIG.BLOCK_SIZE;
const PYRAMID_HEIGHT = CONFIG.ROWS * CONFIG.BLOCK_SIZE;

// =========================================================================
// 2. STATE & DATA
// =========================================================================
const state = {
    pixi: null,
    previewApp: null,
    previewBlock: null,
    world: null,
    chunks: [],
    blocks: new Array(CONFIG.TOTAL_BLOCKS + 1),
    
    // --- IMMORTAL TEXT POOL ---
    textPool: [],     // Dense array of text objects
    
    baseTextures: {},
    cam: { x: 0, y: 0, zoom: 0.1 },
    target: { x: 0, y: 0, zoom: 0.1 },
    vel: { x: 0, y: 0 },
    dragging: false,
    dragStart: { x: 0, y: 0 },
    dragOriginalStart: { x: 0, y: 0 },
    hasMoved: false,
    clickThreshold: 5,
    hoverId: -1,
    selectedId: -1,
    touches: [],
    lastTouchDistance: 0,
    simulating: false,

    // LOD State
    lodVisible: false,
    lodQueueIndex: 0
};

// Form data removed - no purchase modal needed

// =========================================================================
// 3. API INTEGRATION LAYER
// =========================================================================
async function apiCall(endpoint, options = {}) {
    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.warn(`API call attempt ${attempt} failed:`, error);
            
            // If this is the last attempt, throw the error
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Wait before retrying (exponential backoff)
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Load local purchases from localStorage (disabled - using only JSON data)
function loadLocalPurchases() {
    // Disabled - keeping only JSON data
    console.log('Local purchases loading disabled - using only slots_data.json');
    return;
    
    // Original code preserved for reference:
    // try {
    //     const localPurchases = JSON.parse(localStorage.getItem('pyramidPurchases') || '[]');
    //     localPurchases.forEach(purchase => {
    //         if (purchase.block_id && state.blocks[purchase.block_id] && !state.blocks[purchase.block_id].sold) {
    //             updateBlock(purchase.block_id, purchase);
    //         }
    //     });
    //     console.log(`Loaded ${localPurchases.length} local purchases`);
    // } catch (error) {
    //     console.error('Failed to load local purchases:', error);
    // }
}

// Static data loader - replaces API calls
async function loadStaticData() {
    try {
        showLoading('Loading pyramid data...');
        
        const response = await fetch('./slots_data.json');
        if (!response.ok) {
            throw new Error('Failed to load slots data');
        }
        
        const slotsData = await response.json();
        hideLoading();
        
        // Process all slots with unique IDs
        for (let slotId = 1; slotId <= CONFIG.TOTAL_BLOCKS; slotId++) {
            const slotData = slotsData[slotId];
            if (slotData && slotData.sold) {
                updateBlock(slotId, {
                    sold: true,
                    owner_name: slotData.owner_name || 'Anonymous',
                    owner_color: slotData.owner_color || '#FFD700',
                    owner_text: slotData.owner_text || '',
                    message: slotData.message || '',
                    image_url: slotData.image_url || '',
                    link_url: slotData.link_url || '',
                    link_description: slotData.link_description || '',
                    youtube_url: slotData.youtube_url || ''
                });
            } else if (slotData) {
                // Update unsold block price and payment link
                if (state.blocks[slotId]) {
                    state.blocks[slotId].price = slotData.price || (slotId * 30);
                    if (slotData.payment_link) {
                        state.blocks[slotId].payment_link = slotData.payment_link;
                    }
                }
            }
        }
        
        updateSalesCounter();
        console.log('Static data loaded successfully');
        
    } catch (error) {
        hideLoading();
        console.error('Failed to load static data:', error);
        showError('Failed to load pyramid data. Please refresh.');
    }
}

async function loadGridData() {
    try {
        // Show initial loading state
        showLoading('Loading pyramid data...');
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const data = await apiCall('/api/grid', {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        hideLoading();
        
        if (!data || !data.slots) {
            console.warn('No slots data received');
            return;
        }
        
        // Process slots in batches to prevent UI freezing
        const BATCH_SIZE = 50;
        const soldSlots = data.slots.filter(slot => slot.status === 'sold');
        
        // Update loading progress
        showLoading(`Loading ${soldSlots.length} profiles...`);
        
        // Process in chunks with small delays to keep UI responsive
        for (let i = 0; i < soldSlots.length; i += BATCH_SIZE) {
            const batch = soldSlots.slice(i, i + BATCH_SIZE);
            
            // Process batch synchronously to prevent race conditions
            batch.forEach(slot => {
                try {
                    updateBlock(slot.slot_number, {
                        owner_name: slot.owner_name || 'Anonymous',
                        owner_color: slot.owner_color || '#FFD700',
                        owner_text: slot.owner_text || '',
                        message: slot.owner_message || '',
                        image_url: slot.image_url || '',
                        link_url: slot.link_url || '',
                        link_description: slot.link_description || ''
                    });
                } catch (blockError) {
                    console.warn(`Failed to load block ${slot.slot_number}:`, blockError);
                    // Continue processing other blocks
                }
            });
            
            // Small delay to allow UI to breathe
            if (i + BATCH_SIZE < soldSlots.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Update progress
                const progress = Math.min(i + BATCH_SIZE, soldSlots.length);
                showLoading(`Loaded ${progress}/${soldSlots.length} profiles...`);
            }
        }
        
        hideLoading();
        console.log(`Successfully loaded ${soldSlots.length} profiles`);
        
    } catch (error) {
        hideLoading();
        
        if (error.name === 'AbortError') {
            console.error('Data loading timed out');
            showError('Loading timed out. Please check your connection and refresh.');
        } else {
            console.error('Failed to load grid data:', error);
            showError('Failed to load pyramid data. Please refresh.');
        }
        
        // Fallback: Try to load basic pyramid structure without profiles
        try {
            console.log('Attempting fallback load...');
            await loadBasicPyramid();
        } catch (fallbackError) {
            console.error('Fallback load failed:', fallbackError);
        }
    }
}

async function loadBasicPyramid() {
    showLoading('Loading basic pyramid...');
    // Initialize pyramid without any sold blocks
    hideLoading();
    console.log('Basic pyramid loaded (profiles unavailable)');
}

// =========================================================================
// 4. UI HELPERS
// =========================================================================
function showLoading(message) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.querySelector('div:last-child').textContent = message;
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }
}

function showInfo(message) {
    hideLoading();
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 1000;
        background: linear-gradient(135deg, #4ECDC4, #45B7D1);
        color: white; padding: 15px 25px; border-radius: 8px;
        box-shadow: 0 4px 15px rgba(78, 205, 196, 0.3);
        font-weight: 600; animation: slideIn 0.3s ease; max-width: 300px;
    `;
    infoDiv.textContent = message;
    document.body.appendChild(infoDiv);
    setTimeout(() => infoDiv.remove(), 4000);
}

function showError(message) {
    hideLoading();
    // Create a proper error notification instead of alert
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 1001;
        background: linear-gradient(135deg, #f44336, #d32f2f);
        color: white; padding: 15px 25px; border-radius: 8px;
        box-shadow: 0 4px 15px rgba(244, 67, 54, 0.3);
        font-weight: 600; animation: slideIn 0.3s ease; max-width: 300px;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    hideLoading();
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 1000;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white; padding: 15px 25px; border-radius: 8px;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        font-weight: 600; animation: slideIn 0.3s ease;
    `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

// =========================================================================
// 3. ENGINE INITIALIZATION
// =========================================================================
async function init() {
    // --- IMMORTAL UPGRADE: UNLOCKED RESOLUTION ---
    // We use window.devicePixelRatio directly but cap at 3 to save battery on 4K mobiles
    // while still looking extremely sharp.
    const pixelRatio = Math.min(window.devicePixelRatio, 3);

    state.pixi = new PIXI.Application();
    await state.pixi.init({
        resizeTo: window,
        backgroundAlpha: 0,
        resolution: pixelRatio,
        autoDensity: true,
        antialias: false,
        powerPreference: 'high-performance'
    });
    document.getElementById('canvas-container').appendChild(state.pixi.canvas);

    PIXI.BitmapFont.install({
        name: 'ImmortalFont',
        style: { fontFamily: 'Arial', fontSize: 128, fontWeight: '900', fill: 'white', stroke: { color: 'black', width: 8 } }
    });

    createSharedTextures();

    createStarfield();
    state.world = new PIXI.Container();
    
    // --- IMMORTAL UPGRADE: Render Group for Pixi v8 ---
    state.world.isRenderGroup = true;
    
    state.world.eventMode = 'none';
    state.pixi.stage.addChild(state.world);
    buildPyramid();

    setupInput();
    centerCamera(); 

    await initPreviewApp();

    state.pixi.ticker.add((ticker) => {
        updatePhysics(ticker.deltaTime);
        updateStarfield();
        cullWorld();
        processLODQueue(); // Replaces the old updateLOD loop
    });

    setTimeout(() => document.getElementById('loader').style.opacity = '0', 500);
    setTimeout(() => document.getElementById('loader').remove(), 1000);
    
    // Load static data from JSON file
    await loadStaticData();
    
    // Load local purchases
    loadLocalPurchases();
}

async function initPreviewApp() {
    state.previewApp = new PIXI.Application();
    await state.previewApp.init({
        width: 400,
        height: 400,
        backgroundAlpha: 0,
        resolution: 2,
        autoDensity: true
    });
    
    const previewContainer = new PIXI.Container();
    state.previewApp.stage.addChild(previewContainer);
    
    const g = new PIXI.Graphics()
        .rect(0, 0, CONFIG.BLOCK_SIZE - CONFIG.GAP, CONFIG.BLOCK_SIZE - CONFIG.GAP)
        .fill(0xFFFFFF);
    
    const texture = state.previewApp.renderer.generateTexture(g);
    const sprite = new PIXI.Sprite(texture);
    
    const targetPreviewSize = 280; 
    const scaleFactor = targetPreviewSize / (CONFIG.BLOCK_SIZE - CONFIG.GAP);
    
    sprite.anchor.set(0.5);
    sprite.x = 200;
    sprite.y = 200;
    sprite.scale.set(scaleFactor);
    sprite.tint = 0xFFD700;
    
    state.previewBlock = { 
        container: previewContainer,
        sprite: sprite, 
        textRef: null, 
        scaleFactor: scaleFactor 
    };
    
    previewContainer.addChild(sprite);
}

function createSharedTextures() {
    const make = (color, border) => {
        const g = new PIXI.Graphics()
            .rect(0, 0, CONFIG.BLOCK_SIZE - CONFIG.GAP, CONFIG.BLOCK_SIZE - CONFIG.GAP)
            .fill(color);
        return state.pixi.renderer.generateTexture(g);
    };
    state.baseTextures = {
        gold: make(0x2a2a2a, 0xFFD700),
        silver: make(0x2a2a2a, 0xFFD700),
        std: make(0x2a2a2a, 0xFFD700),
        sold: make(0xFFFFFF, 0xFFD700)
    };
}

function createStarfield() {
    const starfield = new PIXI.Container();
    const starCount = 200;
    
    for (let i = 0; i < starCount; i++) {
        const star = new PIXI.Graphics().circle(0, 0, Math.random() * 2).fill(0xFFFFFF);
        star.x = Math.random() * window.innerWidth;
        star.y = Math.random() * window.innerHeight;
        star.alpha = Math.random();
        star.parallax = 0.1 + Math.random() * 0.5;
        starfield.addChild(star);
    }
    
    state.pixi.stage.addChildAt(starfield, 0);
    state.starfield = starfield;
}

function updateStarfield() {
    if (!state.starfield) return;
    
    const offsetX = (state.cam.x - (window.innerWidth/2)) * 0.05;
    const offsetY = (state.cam.y - (window.innerHeight/2)) * 0.05;
    
    state.starfield.x = offsetX;
    state.starfield.y = offsetY;
}

function buildPyramid() {
    let blockId = CONFIG.TOTAL_BLOCKS;
    for (let row = 1; row <= CONFIG.ROWS; row++) {
        if ((row - 1) % CONFIG.CHUNK_SIZE === 0) {
            const chunk = new PIXI.Container();
            chunk.yStart = (row - 1) * CONFIG.BLOCK_SIZE;
            chunk.yEnd = chunk.yStart + (CONFIG.CHUNK_SIZE * CONFIG.BLOCK_SIZE);
            chunk.visible = false;
            state.chunks.push(chunk);
            state.world.addChild(chunk);
        }
        
        const chunk = state.chunks[state.chunks.length - 1];
        const startX = -(row * CONFIG.BLOCK_SIZE) / 2;
        const yPos = (row - 1) * CONFIG.BLOCK_SIZE;

        for (let col = 0; col < row; col++) {
            let price = blockId * 30;
            let type = 'std';
            if (blockId >= 4500) type = 'gold';
            else if (row <= 60) type = 'silver';

            const sprite = new PIXI.Sprite(state.baseTextures[type]);
            sprite.x = startX + (col * CONFIG.BLOCK_SIZE);
            sprite.y = yPos;

            state.blocks[blockId] = { 
                id: blockId, 
                price: price, 
                tier: type, 
                sold: false, 
                sprite: sprite, 
                data: null, 
                textRef: null 
            };
            chunk.addChild(sprite);
            blockId--;
        }
    }
    updateSalesCounter();
}

function updateSalesCounter() {
    let soldCount = 0;
    for (let i = 1; i <= CONFIG.TOTAL_BLOCKS; i++) {
        if (state.blocks[i] && state.blocks[i].sold) {
            soldCount++;
        }
    }
    const percentage = (soldCount / CONFIG.TOTAL_BLOCKS) * 100;
    const countElement = document.getElementById('sales-count');
    const progressBar = document.getElementById('sales-progress-bar');
    
    if (countElement) countElement.textContent = `${soldCount.toLocaleString()} / ${CONFIG.TOTAL_BLOCKS.toLocaleString()}`;
    if (progressBar) progressBar.style.width = `${percentage}%`;
}

// =========================================================================
// 4. PHYSICS & CAMERA (UPDATED FOR MOMENTUM)
// =========================================================================
function constrainCamera() {
    const fitW = state.pixi.screen.width / PYRAMID_WIDTH;
    const fitH = state.pixi.screen.height / PYRAMID_HEIGHT;
    const fullFitZoom = Math.min(fitW, fitH);
    
    const minAllowedZoom = fullFitZoom * 0.4; 
    
    if (state.target.zoom < minAllowedZoom) state.target.zoom = minAllowedZoom;

    const pyLeft = -(PYRAMID_WIDTH / 2);
    const pyRight = (PYRAMID_WIDTH / 2);
    const pyTop = 0;
    const pyBottom = PYRAMID_HEIGHT;

    const screenCX = state.pixi.screen.width / 2;
    const screenCY = state.pixi.screen.height / 2;
    let worldCX = (screenCX - state.target.x) / state.target.zoom;
    let worldCY = (screenCY - state.target.y) / state.target.zoom;

    // Allow some overscroll ("Bounce") feeling
    const marginX = 10;
    const marginY = 10;

    let clampedWX = Math.max(pyLeft - marginX, Math.min(pyRight + marginX, worldCX));
    let clampedWY = Math.max(pyTop - marginY, Math.min(pyBottom + marginY, worldCY));

    const correctionX = screenCX - (clampedWX * state.target.zoom);
    const correctionY = screenCY - (clampedWY * state.target.zoom);

    // Soft correction: Don't kill velocity, just gently push back
    if (Math.abs(correctionX - state.target.x) > 1) {
         state.target.x += (correctionX - state.target.x) * 0.1;
         // Damping velocity gently instead of halving it
         state.vel.x *= 0.8; 
    }
    if (Math.abs(correctionY - state.target.y) > 1) {
         state.target.y += (correctionY - state.target.y) * 0.1;
         state.vel.y *= 0.8;
    }
}

function updatePhysics(dt) {
    if (!state.dragging) {
        state.target.x += state.vel.x * dt;
        state.target.y += state.vel.y * dt;
        state.vel.x *= CONFIG.FRICTION;
        state.vel.y *= CONFIG.FRICTION;
    }

    constrainCamera(); 

    const spring = 0.25; 
    state.cam.zoom += (state.target.zoom - state.cam.zoom) * spring;
    state.cam.x += (state.target.x - state.cam.x) * spring;
    state.cam.y += (state.target.y - state.cam.y) * spring;

    state.world.scale.set(state.cam.zoom);
    state.world.position.set(state.cam.x, state.cam.y);
    
    // --- IMMORTAL UPGRADE: Trigger LOD Transition Check ---
    checkLODTransition();
}

function cullWorld() {
    const viewTop = -state.cam.y / state.cam.zoom;
    const viewBottom = viewTop + (state.pixi.screen.height / state.cam.zoom);
    const buffer = 200; 

    for (const chunk of state.chunks) {
        chunk.visible = !(chunk.yEnd < viewTop - buffer || chunk.yStart > viewBottom + buffer);
    }
}

// =========================================================================
// 5. IMMORTAL LOD SYSTEM (TIME-SLICED)
// =========================================================================

function checkLODTransition() {
    const showText = state.cam.zoom > CONFIG.LOD_THRESHOLD;
    
    // If the desired state is different from current state, reset the queue
    if (showText !== state.lodVisible) {
        state.lodVisible = showText;
        state.lodQueueIndex = 0; // Restart processing from index 0
    }
}

function processLODQueue() {
    // If we have processed everyone, stop.
    if (state.lodQueueIndex >= state.textPool.length) return;

    let processed = 0;
    const limit = CONFIG.LOD_BATCH_SIZE;

    // Process a chunk of the array
    while (processed < limit && state.lodQueueIndex < state.textPool.length) {
        const text = state.textPool[state.lodQueueIndex];
        
        // Only update if it actually needs changing
        if (text.visible !== state.lodVisible) {
            text.visible = state.lodVisible;
        }
        
        state.lodQueueIndex++;
        processed++;
    }
    // If we finished the loop, we wait for next frame to continue
}

// =========================================================================
// 6. INPUT SYSTEM
// =========================================================================
function setupInput() {
    const dom = document.getElementById('canvas-container');

    dom.addEventListener('wheel', (e) => {
        e.preventDefault();
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const worldPos = { x: (mouseX - state.target.x) / state.target.zoom, y: (mouseY - state.target.y) / state.target.zoom };
        const delta = -e.deltaY * 0.001;
        let newZoom = state.target.zoom * (1 + delta);
        newZoom = Math.min(Math.max(newZoom, CONFIG.MIN_ZOOM), CONFIG.MAX_ZOOM);
        state.target.zoom = newZoom;
        state.target.x = mouseX - (worldPos.x * newZoom);
        state.target.y = mouseY - (worldPos.y * newZoom);
    }, { passive: false });

    dom.addEventListener('pointerdown', (e) => {
        state.dragging = true;
        state.hasMoved = false;
        state.dragStart = { x: e.clientX, y: e.clientY };
        state.dragOriginalStart = { x: e.clientX, y: e.clientY };
        state.vel = { x: 0, y: 0 };
        dom.style.cursor = 'grabbing';
    });

    window.addEventListener('pointermove', (e) => {
        if (state.dragging) {
            const dx = e.clientX - state.dragStart.x;
            const dy = e.clientY - state.dragStart.y;
            if (Math.hypot(e.clientX - state.dragOriginalStart.x, e.clientY - state.dragOriginalStart.y) > state.clickThreshold) state.hasMoved = true;
            state.target.x += dx;
            state.target.y += dy;
            state.dragStart = { x: e.clientX, y: e.clientY };
            state.vel = { x: dx, y: dy };
        } else {
            handleHover(e.clientX, e.clientY);
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (state.dragging) {
            state.dragging = false;
            dom.style.cursor = 'grab';
            if (!state.hasMoved) handleClick(e.clientX, e.clientY);
        }
    });

    dom.addEventListener('touchstart', (e) => {
        e.preventDefault();
        state.touches = Array.from(e.touches);
        if (state.touches.length === 1) {
            state.dragging = true;
            state.hasMoved = false;
            state.dragStart = { x: state.touches[0].clientX, y: state.touches[0].clientY };
            state.dragOriginalStart = { x: state.touches[0].clientX, y: state.touches[0].clientY };
            state.vel = { x: 0, y: 0 };
        } else if (state.touches.length === 2) {
            state.dragging = false;
            const dx = state.touches[0].clientX - state.touches[1].clientX;
            const dy = state.touches[0].clientY - state.touches[1].clientY;
            state.lastTouchDistance = Math.hypot(dx, dy);
        }
    }, { passive: false });

    dom.addEventListener('touchmove', (e) => {
        e.preventDefault();
        state.touches = Array.from(e.touches);
        if (state.touches.length === 1 && state.dragging) {
            const t = state.touches[0];
            const dx = t.clientX - state.dragStart.x;
            const dy = t.clientY - state.dragStart.y;
            if (Math.hypot(t.clientX - state.dragOriginalStart.x, t.clientY - state.dragOriginalStart.y) > state.clickThreshold) state.hasMoved = true;
            state.target.x += dx;
            state.target.y += dy;
            state.dragStart = { x: t.clientX, y: t.clientY };
            state.vel = { x: dx, y: dy };
        } else if (state.touches.length === 2) {
            const p1 = state.touches[0];
            const p2 = state.touches[1];
            const dist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
            if (state.lastTouchDistance > 0) {
                const centerX = (p1.clientX + p2.clientX) / 2;
                const centerY = (p1.clientY + p2.clientY) / 2;
                const worldX = (centerX - state.target.x) / state.target.zoom;
                const worldY = (centerY - state.target.y) / state.target.zoom;
                const scaleFactor = dist / state.lastTouchDistance;
                let newZoom = state.target.zoom * scaleFactor;
                newZoom = Math.min(Math.max(newZoom, CONFIG.MIN_ZOOM), CONFIG.MAX_ZOOM);
                state.target.zoom = newZoom;
                state.target.x = centerX - (worldX * newZoom);
                state.target.y = centerY - (worldY * newZoom);
            }
            state.lastTouchDistance = dist;
        }
    }, { passive: false });

    dom.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (state.touches.length === 1 && state.dragging && !state.hasMoved) {
            const t = state.touches[0] || e.changedTouches[0];
            handleClick(t.clientX, t.clientY);
        }
        state.touches = Array.from(e.touches);
        if (state.touches.length === 0) state.dragging = false;
    }, { passive: false });
}

function getBlockId(screenX, screenY) {
    const worldX = (screenX - state.cam.x) / state.cam.zoom;
    const worldY = (screenY - state.cam.y) / state.cam.zoom;
    const row = Math.floor(worldY / CONFIG.BLOCK_SIZE) + 1;
    if (row < 1 || row > CONFIG.ROWS) return -1;
    const rowStartX = -(row * CONFIG.BLOCK_SIZE) / 2;
    const col = Math.floor((worldX - rowStartX) / CONFIG.BLOCK_SIZE);
    if (col < 0 || col >= row) return -1;
    const blocksAbove = (row * (row - 1)) / 2;
    return CONFIG.TOTAL_BLOCKS - blocksAbove - col;
}

function handleHover(x, y) {
    const id = getBlockId(x, y);
    const tt = document.getElementById('tooltip');
    if (id !== state.hoverId) {
        if (state.hoverId !== -1 && state.blocks[state.hoverId]) state.blocks[state.hoverId].sprite.alpha = 1;
        state.hoverId = id;
        if (id !== -1 && state.blocks[id]) {
            const b = state.blocks[id];
            b.sprite.alpha = 0.6;
            document.body.style.cursor = 'pointer';
            tt.style.display = 'block';
            if (b.sold) {
                tt.innerHTML = `<div class="tt-label">OWNER</div><span style="color:${b.data.owner_color}">●</span> ${b.data.owner_name}<br><div class="tt-label" style="margin-top:4px">VALUE</div><span style="color:var(--gold); text-shadow: 1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8), 1px -1px 2px rgba(0,0,0,0.8), -1px 1px 2px rgba(0,0,0,0.8);">₹${b.price}</span>`;
                tt.style.borderColor = b.data.owner_color;
            } else {
                tt.innerHTML = `<div class="tt-label">AVAILABLE</div>Block #${b.id} &bull; <span style="color:var(--gold); text-shadow: 1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8), 1px -1px 2px rgba(0,0,0,0.8), -1px 1px 2px rgba(0,0,0,0.8);">₹${b.price}</span>`;
                tt.style.borderColor = '#FFD700';
            }
        } else {
            document.body.style.cursor = 'grab';
            tt.style.display = 'none';
        }
    }
    if (id !== -1) { tt.style.left = (x + 20) + 'px'; tt.style.top = (y - 30) + 'px'; }
}

function handleClick(x, y) {
    const id = getBlockId(x, y);
    if (id !== -1) {
        const b = state.blocks[id];
        // If block is unsold and has a Razorpay payment link, redirect instead of opening modal
        if (b && !b.sold && b.payment_link) {
            window.open(b.payment_link, '_blank');
            return;
        }
        state.selectedId = id;
        openModal();
    }
}

// =========================================================================
// 7. CORE LOGIC (O(1) OPTIMIZED)
// =========================================================================
function smartBreakText(text) {
    if (!text) return '';

    // Break any single word longer than 12 chars
    const words = text.split(' ').flatMap(word =>
        word.length > 12 ? word.match(/.{1,12}/g) : [word]
    );

    if (words.length <= 1) return words[0] || '';

    // Find the optimal chars-per-line so the resulting text block
    // is as close to a square as possible (charWidth ≈ 0.55 × lineHeight)
    const totalChars = words.reduce((s, w) => s + w.length, 0) + words.length - 1;
    const optimalLines = Math.max(1, Math.round(Math.sqrt(totalChars * 0.6)));
    const charsPerLine = Math.ceil(totalChars / optimalLines);

    // Greedy packing into lines
    const lines = [];
    let cur = '';
    for (const word of words) {
        if (!cur) {
            cur = word;
        } else if ((cur + ' ' + word).length <= charsPerLine) {
            cur += ' ' + word;
        } else {
            lines.push(cur);
            cur = word;
        }
    }
    if (cur) lines.push(cur);

    return lines.join('\n');
}

// --- IMMORTAL POOL MANAGEMENT (Swap & Pop) ---
function addToPool(textObj) {
    textObj._poolIndex = state.textPool.length;
    state.textPool.push(textObj);
    
    // Init visibility based on current global LOD state
    textObj.visible = state.lodVisible;
}

function removeFromPool(textObj) {
    const idx = textObj._poolIndex;
    // 1. Get the last item in the array
    const lastItem = state.textPool[state.textPool.length - 1];
    
    // 2. Overwrite the item to remove with the last item
    state.textPool[idx] = lastItem;
    
    // 3. Update the last item's internal index reference
    lastItem._poolIndex = idx;
    
    // 4. Remove the last item (now duplicate)
    state.textPool.pop();
    
    // Note: If textObj was the last one, idx == length-1, so it just overwrites itself then pops. Safe.
}

function renderBlockText(sprite, textData, isPreview = false) {
    if (isPreview) {
        // Preview mode is simple, no pool needed
        if (state.previewBlock.textRef) {
            state.previewBlock.textRef.destroy();
            state.previewBlock.textRef = null;
        }
    } else {
        // --- O(1) CLEANUP ---
        // If the sprite already has text, we must remove it from the pool efficiently
        if (sprite.textRef) {
            removeFromPool(sprite.textRef); // O(1)
            sprite.textRef.destroy();       // Destroy Pixi object
            sprite.textRef = null;
        }
    }
    
    if (!textData) return;

    const safeText = smartBreakText(textData);

    const textObj = new PIXI.BitmapText({ 
        text: safeText, 
        style: { 
            fontFamily: 'ImmortalFont', 
            fontSize: 54,
            align: 'center',
            wordWrap: false,
            lineHeight: 64
        } 
    });
    
    if (isPreview) {
        textObj.anchor.set(0.5);
        textObj.x = 200; 
        textObj.y = 200; 
        state.previewBlock.container.addChild(textObj);
        state.previewBlock.textRef = textObj;
    } else {
        textObj.anchor.set(0.5);
        // Parent to the chunk (sprite.parent), NOT the sprite itself.
        // This prevents Pixi from multiplying the sprite's tint into the text color.
        textObj.x = sprite.x + (CONFIG.BLOCK_SIZE - CONFIG.GAP) / 2;
        textObj.y = sprite.y + (CONFIG.BLOCK_SIZE - CONFIG.GAP) / 2;
        sprite.parent.addChild(textObj);
        sprite.textRef = textObj;
        
        // --- O(1) ADDITION ---
        addToPool(textObj);
    }
    
    textObj.scale.set(1);
    
    if (isPreview) {
        const scaledBlockSize = (CONFIG.BLOCK_SIZE - CONFIG.GAP) * state.previewBlock.scaleFactor;
        const targetSize = scaledBlockSize * 0.85;
        const scale = Math.min(targetSize / textObj.width, targetSize / textObj.height);
        textObj.scale.set(scale);
    } else {
        const targetSize = (CONFIG.BLOCK_SIZE - CONFIG.GAP) * 0.92;
        const scale = Math.min(targetSize / textObj.width, targetSize / textObj.height);
        textObj.scale.set(scale);
    }
}

function updateBlock(id, data) {
    const b = state.blocks[id];
    if(!b) return;
    
    // Only set sold to true if data indicates it's sold, otherwise keep current state
    if (data.sold !== undefined) {
        b.sold = data.sold;
    } else {
        b.sold = true; // Default behavior for explicit updates
    }
    
    b.data = data;
    
    // Only apply sold styling if the block is actually sold
    if (b.sold) {
        b.sprite.texture = state.baseTextures.sold;
        b.sprite.tint = data.owner_color.replace('#', '0x');
    }

    // This function now internally handles O(1) pool updates
    if (b.sold && data.owner_text) {
        renderBlockText(b.sprite, data.owner_text);
    } else {
        renderBlockText(b.sprite, null);
    }
    updateSalesCounter();
}

// =========================================================================
// 8. APP INTERFACE & UI
// =========================================================================
let testModeBlockId = null;
let formData = { name: '', message: '', color: '#FFD700', text: '', imageUrl: '', linkUrl: '', linkDescription: '' };

window.app = {
    resetCamera: () => centerCamera(),
    toggleExplore: () => {
        const centerControls = document.querySelector('.center-controls');
        centerControls.classList.toggle('hidden');
    },
    updateForm: (f, v) => {
        formData[f] = v;
        
        // Update character counters
        if (f === 'message') {
            const counter = document.getElementById('msg-counter');
            if (counter) counter.textContent = `${v.length}/1000`;
        } else if (f === 'linkDescription') {
            const counter = document.getElementById('link-desc-counter');
            if (counter) counter.textContent = `${v.length}/100`;
        } else if (f === 'text') {
            const counter = document.getElementById('char-counter');
            if (counter) counter.textContent = `${v.length}/150`;
            
            // Update preview text
            if (state.previewBlock && state.previewBlock.sprite) {
                renderBlockText(state.previewBlock.sprite, v, true);
            }
        }
    },
    setColor: (color, elem) => {
        formData.color = color;
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        elem.classList.add('active');
        
        if (state.previewBlock && state.previewBlock.sprite) {
            state.previewBlock.sprite.tint = color.replace('#', '0x');
        }
    },
    handleImageUpload: (input) => {
        const file = input.files[0];
        if (file && file.size <= 5 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = (e) => {
                formData.imageUrl = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            showError('Image must be less than 5MB');
            input.value = '';
        }
    },
    submit: () => {
        if (!formData.name) {
            showError('Name is required');
            return;
        }
        if (!formData.text) {
            showError('Engrave text is required');
            return;
        }
        
        try {
            const block = state.blocks[state.selectedId];
            if (!block) {
                showError('Invalid block selected');
                return;
            }
            
            if (block.sold) {
                showError('This block is already claimed');
                return;
            }
            
            // Create local purchase data
            const purchaseData = {
                owner_name: formData.name,
                owner_color: formData.color,
                owner_text: formData.text.substring(0, 150),
                message: formData.message || "Claimed locally in the pyramid!",
                image_url: formData.imageUrl || '',
                link_url: formData.linkUrl || '',
                link_description: formData.linkDescription || '',
                purchase_date: new Date().toISOString(),
                block_id: state.selectedId,
                price: block.price
            };
            
            // Update the block immediately (local only)
            updateBlock(state.selectedId, purchaseData);
            
            // Store in localStorage for persistence during session
            const localPurchases = JSON.parse(localStorage.getItem('pyramidPurchases') || '[]');
            localPurchases.push(purchaseData);
            localStorage.setItem('pyramidPurchases', JSON.stringify(localPurchases));
            
            showSuccess(`Block #${state.selectedId} claimed successfully! This is a local preview - email us at thegoodguy08@gmail.com to make it permanent.`);
            
            // Close modal and show the profile
            setTimeout(() => {
                closeModal();
                state.selectedId = state.selectedId; // Keep the same ID
                openModal(); // Reopen to show the profile
            }, 2000);
            
        } catch (error) {
            console.error('Purchase error:', error);
            showError('Failed to claim block. Please try again.');
        }
    },
    simulate: () => {
        if(state.simulating) return;
        state.simulating = true;
        const unsold = [];
        for(let i=1; i<=CONFIG.TOTAL_BLOCKS; i++) if(!state.blocks[i].sold) unsold.push(i);
        if(unsold.length === 0) { alert("Grid Full!"); state.simulating = false; return; }
        let count = 0;
        const interval = setInterval(() => {
            if (count >= unsold.length || unsold.length === 0) { clearInterval(interval); state.simulating = false; return; }
            for(let k=0; k<50; k++) {
                if(unsold.length === 0) break;
                const randIdx = Math.floor(Math.random() * unsold.length);
                const id = unsold[randIdx];
                // "Swap and Pop" logic for the simulation array (simulation only runs once, so simple splice is okay here, but let's be consistent)
                unsold[randIdx] = unsold[unsold.length - 1];
                unsold.pop();
                
                updateBlock(id, {
                    owner_name: "Sim " + id,
                    owner_color: CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)],
                    owner_text: [
                        "hii my name is daredevil",
                        "there is the sun and there is the moon , which is best ",
                        "the gif i sth emost used entertainment in the world ",
                        "there is singnificant chance of the success comapre to the other low effort low esteem works"
                    ][Math.floor(Math.random()*4)],
                    message: "This block is part of the simulation.",
                    link_url: "https://example.com/sim" + id,
                    link_description: "Visit Profile"
                });
                count++;
            }
        }, 16); 
    },
    viewRandom: () => {
        const sold = [];
        for(let i=1; i<=CONFIG.TOTAL_BLOCKS; i++) if(state.blocks[i].sold) sold.push(i);
        if(sold.length === 0) return alert("No profiles found!");
        state.selectedId = sold[Math.floor(Math.random() * sold.length)];
        
        // Ensure explore button stays visible when viewing profiles
        centerControls.classList.remove('hidden');
        
        openModal();
    },
    // Purchase functionality removed - blocks now redirect to profile page
};

function handleBlockClick(id) {
    const b = state.blocks[id];
    
    if (b.sold) {
        // Show profile for sold blocks
        state.selectedId = id;
        openModal();
    } else {
        // If block has a Razorpay payment link, redirect to it
        if (b.payment_link) {
            window.open(b.payment_link, '_blank');
            return;
        }
        // Show purchase form for empty blocks
        state.selectedId = id;
        openModal();
    }
};

window.closeModal = (e) => {
    // This function now handles closing the profile modal
    closeProfileModal(e);
};

function showTestModal(blockId) {
    testModeBlockId = blockId;
    const modal = document.getElementById('test-modal');
    modal.classList.add('show');
    
    // Reset form
    document.getElementById('test-form').reset();
}

function closeTestModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('test-modal');
    modal.classList.remove('show');
    testModeBlockId = null;
}

function handleTestFormSubmit(event) {
    event.preventDefault();
    
    if (!testModeBlockId) {
        showError('No block selected for testing');
        return;
    }
    
    const formData = {
        owner_name: document.getElementById('test-name').value,
        message: document.getElementById('test-message').value,
        owner_text: document.getElementById('test-engraved').value || 'TEST',
        link_url: document.getElementById('test-link').value,
        link_description: document.getElementById('test-link-desc').value,
        image_url: document.getElementById('test-image').value,
        owner_color: CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)]
    };
    
    // Update the block with test data
    const block = state.blocks[testModeBlockId];
    if (block && !block.sold) {
        block.sold = true;
        block.data = formData;
        block.sprite.texture = state.baseTextures.sold;
        block.sprite.tint = formData.owner_color.replace('#', '0x');
        
        if (formData.owner_text) {
            renderBlockText(block.sprite, formData.owner_text);
        }
        
        updateSalesCounter();
        closeTestModal();
        
        // Show the test profile
        state.selectedId = testModeBlockId;
        openModal();
        
        showSuccess('Test block created! This will disappear when you refresh the page.');
    } else {
        showError('This block is not available for testing');
    }
}

// Add event listener for test form
document.addEventListener('DOMContentLoaded', () => {
    const testForm = document.getElementById('test-form');
    if (testForm) {
        testForm.addEventListener('submit', handleTestFormSubmit);
    }
});

function getUserStats(ownerName) {
    let count = 0;
    let totalValue = 0;
    for(let i=1; i<=CONFIG.TOTAL_BLOCKS; i++) {
        if(state.blocks[i] && state.blocks[i].sold && state.blocks[i].data && state.blocks[i].data.owner_name === ownerName) {
            count++;
            totalValue += state.blocks[i].price;
        }
    }
    return { count, totalValue };
}

window.openModal = () => {
    const id = state.selectedId;
    const b = state.blocks[id];
    const backdrop = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    
    backdrop.style.display = 'flex';
    void backdrop.offsetWidth; 
    backdrop.classList.add('visible');
    content.classList.remove('premium');
    
    if (b.sold) {
        content.classList.add('premium');
        const d = b.data;
        
        // Render profile content directly
        let img;
        if (d.image_url && d.image_url.trim() !== '') {
            // Check if it's a local file path
            if (d.image_url.startsWith('./') || d.image_url.startsWith('/')) {
                // For local files, use the path directly but have fallback
                img = d.image_url;
            } else {
                // For external URLs, use as-is
                img = d.image_url;
            }
        } else {
            // Fallback to avatar service
            img = `https://ui-avatars.com/api/?name=${encodeURIComponent(d.owner_name || 'Anonymous')}&background=random&size=256`;
        }
        
        const _blockColor = (d.owner_color && d.owner_color.startsWith('#') && d.owner_color.length === 7) ? d.owner_color : '#FF0000';
        const _bcr = parseInt(_blockColor.slice(1, 3), 16);
        const _bcg = parseInt(_blockColor.slice(3, 5), 16);
        const _bcb = parseInt(_blockColor.slice(5, 7), 16);
        const _colorVars = `--block-color:${_blockColor};--block-color-rgb:${_bcr} ${_bcg} ${_bcb}`;
        
        content.innerHTML = `
            <div class="profile-modal" style="${_colorVars}">
                <div class="prof-header">
                    <div class="prof-header-content">
                        <div class="prof-block-info">
                            <div class="prof-block-id">Block #${b.id}</div>
                            <div class="prof-block-value">₹${b.price || '0'}</div>
                        </div>
                        <button class="prof-close-btn" onclick="closeModal()">×</button>
                    </div>
                </div>

                <div class="prof-content">
                    <div class="prof-left-section">
                        <div class="prof-avatar-container">
                            <div class="prof-avatar-ring"></div>
                            <img src="${img}" class="prof-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(d.owner_name || 'Anonymous')}&background=random&size=256';" alt="Profile">
                        </div>
                        <h2 class="prof-name">${d.owner_name || 'Anonymous'}</h2>
                        <div class="prof-title">Pyramid Block Owner</div>

                        <div class="prof-stats-grid">
                            <div class="stat-card">
                                <span class="stat-val">₹${b.price || '0'}</span>
                                <span class="stat-label">Block Value</span>
                            </div>
                        </div>
                    </div>

                    <div class="prof-right-section">
                        <div class="prof-section-title">Personal Message</div>
                        <div class="prof-message-container">
                            <div class="prof-message">
                                <div class="prof-message-text">${d.message || 'No message provided.'}</div>
                            </div>
                        </div>

                        ${d.link_url ? `
                            <div class="prof-section-title">External Link</div>
                            <div class="prof-action-area">
                                ${d.link_description ? `<div class="prof-link-desc">${d.link_description}</div>` : ''}
                                <a href="${d.link_url}" target="_blank" rel="noopener noreferrer" class="prof-btn-visit">
                                    <span>Visit Link</span>
                                    <svg fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                    </svg>
                                </a>
                            </div>
                        ` : ''}

                        ${(() => {
                            const vidId = getYouTubeVideoId(d.youtube_url);
                            if (!vidId) return '';
                            return `
                            <div class="prof-section-title prof-section-title--yt">Featured Video</div>
                            <div class="prof-youtube-section">
                                <div class="prof-youtube-player" onclick="loadYouTubeVideo(this, '${vidId}')" role="button" aria-label="Play video">
                                    <img
                                        class="prof-youtube-thumb"
                                        src="https://img.youtube.com/vi/${vidId}/maxresdefault.jpg"
                                        onerror="this.src='https://img.youtube.com/vi/${vidId}/hqdefault.jpg'"
                                        alt="Video thumbnail"
                                    >
                                    <div class="prof-youtube-overlay"></div>
                                    <div class="prof-youtube-play-btn" aria-hidden="true">
                                        <svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#FF0000"/>
                                            <path d="M45 24L27 14v20z" fill="#FFFFFF"/>
                                        </svg>
                                    </div>
                                    <div class="prof-youtube-label">Click to Play</div>
                                </div>
                            </div>`;
                        })()}
                    </div>
                </div>
            </div>
        `;
    } else {
        content.classList.add('premium');
        const d = b.data;
        
        content.innerHTML = `
            <div class="modal-header">
                <h2>Profile for Block #${b.id}</h2>
                <button class="close-icon" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="col-left">
                    <div class="input-group">
                        <label>Name</label>
                        <input type="text" maxlength="30" oninput="app.updateForm('name', this.value)">
                    </div>
                    <div class="input-group">
                        <label>Message <span id="msg-counter" class="char-count">0/1000</span></label>
                        <textarea maxlength="1000" oninput="app.updateForm('message', this.value)" style="height:100px"></textarea>
                    </div>
                    <div class="input-group">
                        <label>Link URL</label>
                        <input type="url" placeholder="https://example.com" oninput="app.updateForm('linkUrl', this.value)">
                    </div>
                    <div class="input-group">
                        <label>Link Description <span id="link-desc-counter" class="char-count">0/100</span></label>
                        <input type="text" maxlength="100" placeholder="Visit my profile..." oninput="app.updateForm('linkDescription', this.value)">
                    </div>
                    <div class="input-group">
                        <label>Profile Photo</label>
                        <div class="file-upload">
                            <input type="file" accept="image/*" onchange="app.handleImageUpload(this)">
                            <div class="file-upload-label">
                                <div>📷 Upload Photo</div>
                                <div style="font-size: 0.7rem; color: #666; margin-top: 5px;">Max 5MB</div>
                            </div>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Grid Color</label>
                        <div class="color-selector">${CONFIG.COLORS.map(c => `<div class="color-btn" style="background:${c}" onclick="app.setColor('${c}', this)"></div>`).join('')}</div>
                    </div>
                </div>
                <div class="col-right">
                    <div class="input-group">
                        <label>Engrave Text <span id="char-counter" class="char-count">0/150</span></label>
                        <textarea maxlength="150" oninput="app.updateForm('text', this.value)" style="height:80px; text-align:center; font-weight:900; font-size:1.5rem" placeholder="..."></textarea>
                    </div>
                    <div class="preview-box" id="block-preview"></div>
                </div>
            </div>
            <div class="modal-footer">
                <div style="font-size:1.2rem; font-weight:800; color:var(--gold)">₹${b.price}</div>
                <button class="confirm-btn" onclick="app.submit()">Claim Block (Local)</button>
            </div>`;
        
        // Reset form state for fresh modal
        formData.color = '#FFD700';
        formData.text = '';
        
        setTimeout(() => {
            const previewDiv = document.getElementById('block-preview');
            if (previewDiv && state.previewApp) {
                previewDiv.innerHTML = '';
                previewDiv.appendChild(state.previewApp.canvas);
                state.previewBlock.sprite.tint = 0xFFD700;
                renderBlockText(state.previewBlock.sprite, '');
            }
            // Mark default active swatch
            const firstColorBtn = document.querySelector('.color-btn');
            if (firstColorBtn) firstColorBtn.classList.add('active');
        }, 50);
    }
};

window.closeModal = (e) => {
    if (!e || e.target.id === 'modal-backdrop' || e.target.classList.contains('close-icon') || e.target.classList.contains('prof-close')) {
        const el = document.getElementById('modal-backdrop');
        el.classList.remove('visible');
        setTimeout(() => el.style.display = 'none', 300);
    }
};

window.closeProfileModal = (event) => {
    // Profile is now loaded in the main modal, just close it
    if (!event || event.target.id === 'modal-backdrop' || event.target.classList.contains('close-icon')) {
        const el = document.getElementById('modal-backdrop');
        el.classList.remove('visible');
        setTimeout(() => el.style.display = 'none', 300);
    }
};

function centerCamera() {
    const screenCX = state.pixi.screen.width / 2;
    const screenCY = state.pixi.screen.height / 2;
    
    const availableW = state.pixi.screen.width - 60;
    const availableH = state.pixi.screen.height - 180;
    
    const zoomX = availableW / PYRAMID_WIDTH;
    const zoomY = availableH / PYRAMID_HEIGHT;
    
    const targetZoom = Math.min(zoomX, zoomY) * 0.9;
    
    state.target.zoom = targetZoom;
    state.cam.zoom = targetZoom;

    const pyramidCenterY = PYRAMID_HEIGHT / 2;
    
    state.target.x = screenCX;
    state.target.y = screenCY - (pyramidCenterY * targetZoom);

    state.cam.x = state.target.x;
    state.cam.y = state.target.y;
}

window.showHelp = () => {
    const modal = document.getElementById('help-modal');
    modal.style.display = 'flex';
    document.body.style.pointerEvents = 'none';
    modal.style.pointerEvents = 'auto';
};

window.hideHelp = (event) => {
    const modal = document.getElementById('help-modal');
    if (!event || event.target.id === 'help-modal' || event.target.tagName === 'BUTTON') {
        modal.style.display = 'none';
        document.body.style.pointerEvents = 'auto';
    }
};

// =========================================================================
// 9. SEARCH FUNCTIONALITY
// =========================================================================

// Global search state
let searchResults = [];
let currentSearchTerm = '';

// Perform search across all blocks
window.performSearch = function() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (!searchTerm) {
        hideSearchResults();
        return;
    }
    
    currentSearchTerm = searchTerm;
    searchResults = [];
    
    // Search through all blocks
    for (let i = 1; i <= CONFIG.TOTAL_BLOCKS; i++) {
        const block = state.blocks[i];
        if (block && block.data && block.sold) {
            const matches = searchInBlock(block, searchTerm);
            if (matches.length > 0) {
                searchResults.push({
                    blockId: i,
                    block: block,
                    matches: matches
                });
            }
        }
    }
    
    displaySearchResults();
};

// Search within a single block for matches
function searchInBlock(block, searchTerm) {
    const matches = [];
    const data = block.data;
    
    // Search in owner name
    if (data.owner_name) {
        const nameMatch = findTextMatches(data.owner_name, searchTerm);
        if (nameMatch.length > 0) {
            matches.push({ type: 'name', text: data.owner_name, highlights: nameMatch });
        }
    }
    
    // Search in owner text (engraved text)
    if (data.owner_text) {
        const textMatch = findTextMatches(data.owner_text, searchTerm);
        if (textMatch.length > 0) {
            matches.push({ type: 'text', text: data.owner_text, highlights: textMatch });
        }
    }
    
    // Search in message
    if (data.message) {
        const messageMatch = findTextMatches(data.message, searchTerm);
        if (messageMatch.length > 0) {
            matches.push({ type: 'message', text: data.message, highlights: messageMatch });
        }
    }
    
    // Search in price (new functionality)
    if (block.price !== undefined && block.price !== null) {
        const priceText = `₹${block.price}`;
        const priceIntegerText = `₹${block.price}`;
        const priceNumberText = block.price.toString();
        
        // Check for exact price match (e.g., "50" matches ₹50)
        if (searchTerm === priceNumberText || searchTerm === priceIntegerText.substring(1)) {
            matches.push({ 
                type: 'price', 
                text: priceText, 
                highlights: [{ start: 0, end: priceText.length }] 
            });
        }
        // Check for price text match (e.g., "$5" matches $5.00)
        else {
            const priceMatch = findTextMatches(priceText, searchTerm);
            if (priceMatch.length > 0) {
                matches.push({ type: 'price', text: priceText, highlights: priceMatch });
            }
        }
    }
    
    return matches;
}

// Find all occurrences of search term in text
function findTextMatches(text, searchTerm) {
    const matches = [];
    const lowerText = text.toLowerCase();
    let index = 0;
    
    while ((index = lowerText.indexOf(searchTerm, index)) !== -1) {
        matches.push({
            start: index,
            end: index + searchTerm.length
        });
        index += searchTerm.length;
    }
    
    return matches;
}

// Display search results
function displaySearchResults() {
    const resultsContainer = document.getElementById('search-results');
    
    if (searchResults.length === 0) {
        resultsContainer.innerHTML = `
            <div class="search-no-results">
                No blocks found containing "${escapeHtml(currentSearchTerm)}"
            </div>
        `;
    } else {
        const resultsHtml = searchResults.map(result => {
            const blockId = result.blockId;
            const block = result.block;
            const matches = result.matches;
            
            // Get the best match for display
            const bestMatch = matches[0];
            const highlightedText = highlightSearchTerm(bestMatch.text, bestMatch.highlights);
            
            return `
                <div class="search-result-item" onclick="navigateToBlock(${blockId})">
                    <div class="search-result-block">#${blockId}</div>
                    <div class="search-result-text">
                        <div class="search-result-name">${escapeHtml(block.data.owner_name || 'Anonymous')}</div>
                        <div class="search-result-message">${highlightedText}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        resultsContainer.innerHTML = resultsHtml;
    }
    
    resultsContainer.classList.add('show');
}

// Highlight search term in text
function highlightSearchTerm(text, highlights) {
    if (!highlights || highlights.length === 0) return escapeHtml(text);
    
    let result = '';
    let lastIndex = 0;
    
    highlights.forEach(highlight => {
        result += escapeHtml(text.substring(lastIndex, highlight.start));
        result += `<span class="search-highlight">${escapeHtml(text.substring(highlight.start, highlight.end))}</span>`;
        lastIndex = highlight.end;
    });
    
    result += escapeHtml(text.substring(lastIndex));
    return result;
}

// Navigate to a specific block with smooth animation
window.navigateToBlock = function(blockId) {
    const block = state.blocks[blockId];
    if (!block) return;
    
    // Calculate block position
    const blockX = block.sprite.x;
    const blockY = block.sprite.y;
    
    // Center camera on block with zoom
    const screenCX = state.pixi.screen.width / 2;
    const screenCY = state.pixi.screen.height / 2;
    
    // Calculate target zoom and position
    const targetZoom = 2.5;
    const targetX = screenCX - (blockX * targetZoom);
    const targetY = screenCY - (blockY * targetZoom);
    
    // Smooth animation to target
    animateCameraTo(targetX, targetY, targetZoom, () => {
        // Animation complete callback
        hideSearchResults();
        document.getElementById('search-input').value = '';
        highlightBlock(blockId);
    });
};

// Smooth camera animation function
function animateCameraTo(targetX, targetY, targetZoom, callback) {
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();
    const startX = state.target.x;
    const startY = state.target.y;
    const startZoom = state.target.zoom;
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation (ease-in-out)
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        // Update target position with easing
        state.target.x = startX + (targetX - startX) * easeProgress;
        state.target.y = startY + (targetY - startY) * easeProgress;
        state.target.zoom = startZoom + (targetZoom - startZoom) * easeProgress;
        
        // Smooth camera follow
        const followSpeed = 0.1;
        state.cam.x += (state.target.x - state.cam.x) * followSpeed;
        state.cam.y += (state.target.y - state.cam.y) * followSpeed;
        state.cam.zoom += (state.target.zoom - state.cam.zoom) * followSpeed;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete
            state.cam.x = state.target.x;
            state.cam.y = state.target.y;
            state.cam.zoom = state.target.zoom;
            
            if (callback) callback();
        }
    }
    
    animate();
}

// Enhanced block highlight with pulse effect
function highlightBlock(blockId) {
    const block = state.blocks[blockId];
    if (!block || !block.sprite) return;
    
    const originalTint = block.sprite.tint;
    const originalScale = block.sprite.scale.x;
    
    // Create pulsing highlight effect
    let pulseCount = 0;
    const maxPulses = 3;
    
    function pulse() {
        if (pulseCount >= maxPulses) {
            // Reset to original state
            block.sprite.tint = originalTint;
            block.sprite.scale.set(originalScale);
            return;
        }
        
        const isExpanding = pulseCount % 2 === 0;
        const targetScale = isExpanding ? originalScale * 1.3 : originalScale;
        const targetTint = isExpanding ? 0xFFFFFF : originalTint;
        
        // Smooth transition to target state
        const duration = 300;
        const startTime = Date.now();
        const startScale = block.sprite.scale.x;
        const startTint = block.sprite.tint;
        
        function animatePulse() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
            
            block.sprite.scale.set(startScale + (targetScale - startScale) * easeProgress);
            
            // Interpolate color (simplified - just switch between white and original)
            if (progress >= 1) {
                block.sprite.tint = targetTint;
                
                if (isExpanding) {
                    // Start contracting
                    setTimeout(() => {
                        pulseCount++;
                        pulse();
                    }, 100);
                } else {
                    // Pulse complete, move to next
                    pulseCount++;
                    pulse();
                }
            } else {
                requestAnimationFrame(animatePulse);
            }
        }
        
        animatePulse();
    }
    
    pulse();
}

// Hide search results
function hideSearchResults() {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.classList.remove('show');
    searchResults = [];
    currentSearchTerm = '';
}

// Extract YouTube video ID from various YouTube URL formats
function getYouTubeVideoId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ \s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Replace YouTube thumbnail with embedded player on click
window.loadYouTubeVideo = function(container, videoId) {
    container.innerHTML = `<iframe
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:12px;"
    ></iframe>`;
};

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add keyboard support for search
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    
    // Real-time search as user types
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.trim();
        if (searchTerm.length >= 1) {
            performSearch();
        } else {
            hideSearchResults();
        }
    });
    
    // Search on Enter key (optional, for accessibility)
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Hide results on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideSearchResults();
            searchInput.value = '';
            searchInput.blur();
        }
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        const searchContainer = document.querySelector('.search-container');
        const resultsContainer = document.getElementById('search-results');
        
        // Check if click is on a search result item
        if (e.target.closest('.search-result-item')) {
            e.stopPropagation();
            return; // Don't hide results, let the click handler work
        }
        
        // Hide results if clicking outside search area
        if (!searchContainer.contains(e.target) && !resultsContainer.contains(e.target)) {
            hideSearchResults();
        }
    });
    
    // Add click event delegation for search results with better handling
    resultsContainer.addEventListener('click', function(e) {
        e.stopPropagation();
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem) {
            // Extract block ID from multiple possible sources
            let blockId = null;
            
            // Try onclick attribute first
            const onclickAttr = resultItem.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/navigateToBlock\((\d+)\)/);
                if (match) {
                    blockId = parseInt(match[1]);
                }
            }
            
            // Fallback: try data attribute if available
            if (!blockId) {
                const dataBlockId = resultItem.getAttribute('data-block-id');
                if (dataBlockId) {
                    blockId = parseInt(dataBlockId);
                }
            }
            
            // Fallback: try to extract from text content
            if (!blockId) {
                const blockText = resultItem.querySelector('.search-result-block');
                if (blockText) {
                    const textMatch = blockText.textContent.match(/#(\d+)/);
                    if (textMatch) {
                        blockId = parseInt(textMatch[1]);
                    }
                }
            }
            
            if (blockId) {
                console.log('Navigating to block:', blockId);
                navigateToBlock(blockId);
            } else {
                console.error('Could not extract block ID from result item');
            }
        }
    });
    
    // Prevent scroll events from bubbling to background
    resultsContainer.addEventListener('wheel', function(e) {
        e.stopPropagation();
    }, { passive: false });
    
    resultsContainer.addEventListener('touchmove', function(e) {
        e.stopPropagation();
    }, { passive: false });
});

window.addEventListener('resize', () => { state.pixi.resize(); centerCamera(); });

init();
