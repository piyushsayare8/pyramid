// =========================================================================
// 1. ENGINE CONFIGURATION & IMMORTAL CONSTANTS
// =========================================================================
const CONFIG = {
    ROWS: 101,
    BLOCK_SIZE: 40,
    GAP: 2,
    TOTAL_BLOCKS: 5151,
    LOD_THRESHOLD: 0.35,
    MOBILE_LOD_THRESHOLD: 1.001,
    LOD_BATCH_SIZE: 250,
    CHUNK_SIZE: 25,
    MAX_ZOOM: 50.0,
    MIN_ZOOM: 0.005,
    FRICTION: 0.92, // Increased for smoother glide
    COLOR_CHOICES: [
        { name: 'Yellow', value: '#FFD700' },
        { name: 'Red', value: '#FF6B6B' },
        { name: 'Turquoise', value: '#4ECDC4' },
        { name: 'Blue', value: '#45B7D1' },
        { name: 'Green', value: '#96CEB4' },
        { name: 'Amber', value: '#FECA57' },
        { name: 'Purple', value: '#B983FF' },
        { name: 'Pink', value: '#FD79A8' }
    ],
    COLORS: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#B983FF', '#FD79A8'],
    API_BASE: '', // Empty for same-origin requests (frontend + API on same worker)
    SLOTS_DATA_URL: 'https://pub-962497bf5b824ce986c4e28eb92fd400.r2.dev/data.json',
    DATA_REFRESH_MS: 15000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    MEDIA_QUEUE_UPDATE_MS: 400,
    MAX_VISIBLE_MEDIA_PRELOAD: 96,
    PHOTO_CACHE_LIMIT_DESKTOP: 96,
    PHOTO_CACHE_LIMIT_MOBILE: 24,
    VIDEO_CACHE_LIMIT_DESKTOP: 72,
    VIDEO_CACHE_LIMIT_MOBILE: 18,
    PHOTO_TEXTURE_SIZE_DESKTOP: 256,
    PHOTO_TEXTURE_SIZE_MOBILE: 128,
    VIDEO_TEXTURE_SIZE_DESKTOP: 384,
    VIDEO_TEXTURE_SIZE_MOBILE: 160
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
    hoverRafId: 0,
    pendingHoverPos: null,
    selectedId: -1,
    touches: [],
    lastTouchDistance: 0,
    lastTouchTapId: -1,
    lastTouchTapTime: 0,
    soldCount: 0,
    soldBlockIds: new Set(),
    simulating: false,
    gridPriceMap: {},
    slotRenderSignature: new Map(),
    ui: {
        salesCountEl: null,
        salesProgressEl: null,
        tooltipEl: null
    },
    isMobileDevice: false,
    viewMode: 'text',
    photoTextureCache: new Map(),
    videoTextureCache: new Map(),
    photoTextureRefCounts: new Map(),
    videoTextureRefCounts: new Map(),
    photoCacheOrder: [],
    videoCacheOrder: [],
    photoPrepInProgress: false,
    photoPrepTimer: null,
    photoPrepCountdown: 0,
    maxVisibleMediaPreload: CONFIG.MAX_VISIBLE_MEDIA_PRELOAD,
    photoLoadQueue: [],
    videoLoadQueue: [],
    photoQueuePumpTimer: null,
    videoQueuePumpTimer: null,
    activePhotoLoads: 0,
    activeVideoLoads: 0,
    maxConcurrentPhotoLoads: 3,
    maxConcurrentVideoLoads: 2,
    photoTextureCacheLimit: CONFIG.PHOTO_CACHE_LIMIT_DESKTOP,
    videoTextureCacheLimit: CONFIG.VIDEO_CACHE_LIMIT_DESKTOP,
    dataRefreshTimer: null,
    dataRefreshInFlight: false,
    activeGridVideo: null,
    lastVideoCamSnapshot: null,
    activeVideoMarker: null,
    lastMediaQueueTick: 0,
    simulatedSlots: new Map(),

    // LOD State
    lodVisible: false,
    lodQueueIndex: 0,
    lodBatchSize: CONFIG.LOD_BATCH_SIZE
};

function setInitialViewModeRandomly() {
    state.viewMode = 'text';
}

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
    console.log('Local purchases loading disabled - using R2 slot data source');
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
function getSlotRenderSignature(data) {
    if (!data || !data.sold) return '0';

    const imageUrl = typeof data.image_url === 'string' ? data.image_url.trim() : '';
    const youtubeUrl = typeof data.youtube_url === 'string' ? data.youtube_url.trim() : '';
    const linkUrl = typeof data.link_url === 'string' ? data.link_url.trim() : '';
    const textColor = '#FFFFFF';

    return [
        '1',
        data.owner_name || 'Anonymous',
        sanitizeBlockColor(data.owner_color || '#FFD700'),
        data.owner_text || '',
        textColor,
        data.message || '',
        imageUrl,
        youtubeUrl,
        linkUrl,
        data.link_description || ''
    ].join('|');
}

async function loadStaticData(options = {}) {
    const silent = !!options.silent;
    if (state.dataRefreshInFlight) return;

    state.dataRefreshInFlight = true;
    try {
        if (!silent) {
            showLoading('Loading pyramid data...');
        }

        const cacheBustUrl = `${CONFIG.SLOTS_DATA_URL}${CONFIG.SLOTS_DATA_URL.includes('?') ? '&' : '?'}_ts=${Date.now()}`;
        const response = await fetch(cacheBustUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Failed to load slots data');
        }

        const slotsData = await response.json();

        // Optional pricing/payment map keyed by slot id (as string)
        let gridPriceData = {};
        try {
            const gridPriceResponse = await fetch('./grid_price.json');
            if (gridPriceResponse.ok) {
                gridPriceData = await gridPriceResponse.json();
            } else {
                console.warn('grid_price.json not found; Buy Now links will be unavailable for unmapped slots.');
            }
        } catch (gridPriceError) {
            console.warn('Failed to load grid_price.json:', gridPriceError);
        }

        state.gridPriceMap = gridPriceData || {};
        if (!silent) {
            hideLoading();
        }

        let hasBlockChanges = false;
        
        // Process all slots with unique IDs
        for (let slotId = 1; slotId <= CONFIG.TOTAL_BLOCKS; slotId++) {
            const slotData = slotsData[String(slotId)] || slotsData[slotId];
            const gridData = state.gridPriceMap[String(slotId)] || null;
            const simulatedSlotData = state.simulatedSlots.get(slotId);

            if (state.blocks[slotId]) {
                // Always keep deterministic pricing: slot id * Rs10.
                // External JSON price fields are ignored to prevent accidental increment drift.
                state.blocks[slotId].price = slotId * 10;

                // Slot-specific payment link now comes only from grid_price.json
                if (gridData && typeof gridData.payment_link === 'string' && gridData.payment_link.trim()) {
                    state.blocks[slotId].payment_link = gridData.payment_link.trim();
                } else {
                    delete state.blocks[slotId].payment_link;
                }
            }

            let nextData = null;
            if (slotData && slotData.sold) {
                nextData = {
                    sold: true,
                    owner_name: slotData.owner_name || 'Anonymous',
                    owner_color: slotData.owner_color || '#FFD700',
                    owner_text: slotData.owner_text || '',
                    owner_text_color: '#FFFFFF',
                    message: slotData.message || '',
                    image_url: slotData.image_url || '',
                    link_url: slotData.link_url || '',
                    link_description: slotData.link_description || '',
                    youtube_url: slotData.youtube_url || ''
                };
                if (simulatedSlotData) {
                    state.simulatedSlots.delete(slotId);
                }
            } else if (simulatedSlotData) {
                // Keep local simulation tiles stable during live refresh cycles.
                nextData = { ...simulatedSlotData };
            } else {
                nextData = { sold: false };
            }

            const nextSignature = getSlotRenderSignature(nextData);
            if (state.slotRenderSignature.get(slotId) !== nextSignature) {
                updateBlock(slotId, nextData, { skipSalesCounter: true });
                hasBlockChanges = true;
            }
        }
        
        if (hasBlockChanges) {
            updateSalesCounter();
        }
        if (!silent) {
            console.log('Static data loaded successfully');
        }
        
    } catch (error) {
        if (!silent) {
            hideLoading();
        }
        console.error('Failed to load static data:', error);
        if (!silent) {
            showError('Failed to load pyramid data. Please refresh.');
        }
    } finally {
        state.dataRefreshInFlight = false;
    }
}

function startAutoDataRefresh() {
    if (state.dataRefreshTimer) return;
    state.dataRefreshTimer = setInterval(() => {
        if (document.hidden) return;
        loadStaticData({ silent: true });
    }, CONFIG.DATA_REFRESH_MS);
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
                    }, { skipSalesCounter: true });
                } catch (blockError) {
                    console.warn(`Failed to load block ${slot.slot_number}:`, blockError);
                    // Continue processing other blocks
                }
            });

            updateSalesCounter();
            
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
    state.isMobileDevice = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
    state.maxConcurrentPhotoLoads = state.isMobileDevice ? 1 : 3;
    state.maxConcurrentVideoLoads = state.isMobileDevice ? 1 : 2;
    state.maxVisibleMediaPreload = state.isMobileDevice ? 32 : CONFIG.MAX_VISIBLE_MEDIA_PRELOAD;
    state.lodBatchSize = state.isMobileDevice ? 120 : CONFIG.LOD_BATCH_SIZE;
    state.photoTextureCacheLimit = state.isMobileDevice ? CONFIG.PHOTO_CACHE_LIMIT_MOBILE : CONFIG.PHOTO_CACHE_LIMIT_DESKTOP;
    state.videoTextureCacheLimit = state.isMobileDevice ? CONFIG.VIDEO_CACHE_LIMIT_MOBILE : CONFIG.VIDEO_CACHE_LIMIT_DESKTOP;
    state.ui.salesCountEl = document.getElementById('sales-count');
    state.ui.salesProgressEl = document.getElementById('sales-progress-bar');
    state.ui.tooltipEl = document.getElementById('tooltip');

    // Keep GPU memory stable on mobile to avoid WebGL context loss (white screen).
    const pixelRatio = state.isMobileDevice
        ? Math.min(window.devicePixelRatio || 1, 1.5)
        : Math.min(window.devicePixelRatio || 1, 2);

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

    // Recover gracefully if GPU context is lost on low-memory mobile devices.
    state.pixi.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        showLoading('Graphics memory is being recovered...');
    }, false);

    state.pixi.canvas.addEventListener('webglcontextrestored', () => {
        showInfo('Graphics recovered. Rebuilding scene...');
        location.reload();
    }, false);

    PIXI.BitmapFont.install({
        name: 'ImmortalFont',
        style: { fontFamily: 'Arial', fontSize: 128, fontWeight: '900', fill: 'white', stroke: { color: 'black', width: 8 } }
    });

    createSharedTextures();

    createStarfield();
    state.world = new PIXI.Container();
    state.pixi.ticker.maxFPS = state.isMobileDevice ? 30 : 50;
    
    // --- IMMORTAL UPGRADE: Render Group for Pixi v8 ---
    state.world.isRenderGroup = true;
    
    state.world.eventMode = 'none';
    state.pixi.stage.addChild(state.world);
    buildPyramid();

    setupInput();
    centerCamera(); 

    await initPreviewApp();

    state.pixi.ticker.add((ticker) => {
        if (document.hidden) return;
        updatePhysics(ticker.deltaTime);
        updateStarfield();
        cullWorld();
        processLODQueue(); // Replaces the old updateLOD loop
        updateGridVideoOverlayPosition();
        updateDynamicMediaQueues();
    });

    setTimeout(() => document.getElementById('loader').style.opacity = '0', 500);
    setTimeout(() => document.getElementById('loader').remove(), 1000);
    
    // Load static data from JSON file
    await loadStaticData();
    
    // Load local purchases
    loadLocalPurchases();

    // Keep frontend synced with live R2 updates from Sheets.
    startAutoDataRefresh();
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
    const starCount = state.isMobileDevice ? 80 : 200;
    
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
    state.soldCount = 0;
    state.soldBlockIds.clear();
    state.slotRenderSignature.clear();
    let blockId = CONFIG.TOTAL_BLOCKS;
    for (let row = 1; row <= CONFIG.ROWS; row++) {
        if ((row - 1) % CONFIG.CHUNK_SIZE === 0) {
            const chunk = new PIXI.Container();
            chunk.yStart = (row - 1) * CONFIG.BLOCK_SIZE;
            chunk.yEnd = chunk.yStart + (CONFIG.CHUNK_SIZE * CONFIG.BLOCK_SIZE);
            chunk.visible = false;
            chunk.textRefs = new Set();
            chunk.blockIds = [];
            state.chunks.push(chunk);
            state.world.addChild(chunk);
        }
        
        const chunk = state.chunks[state.chunks.length - 1];
        const startX = -(row * CONFIG.BLOCK_SIZE) / 2;
        const yPos = (row - 1) * CONFIG.BLOCK_SIZE;

        for (let col = 0; col < row; col++) {
            let price = blockId * 10;
            let type = 'std';
            if (blockId >= 4500) type = 'gold';
            else if (row <= 60) type = 'silver';

            const sprite = new PIXI.Sprite(state.baseTextures[type]);
            sprite.x = startX + (col * CONFIG.BLOCK_SIZE);
            sprite.y = yPos;
            sprite.blockId = blockId;

            state.blocks[blockId] = { 
                id: blockId, 
                price: price, 
                tier: type, 
                sold: false, 
                sprite: sprite, 
                photoRef: null,
                videoRef: null,
                borderRef: null,
                photoUrl: '',
                photoTextureKey: '',
                photoReady: false,
                photoQueued: false,
                photoLoading: false,
                videoUrl: '',
                videoTextureKey: '',
                videoReady: false,
                videoQueued: false,
                videoLoading: false,
                data: null, 
                textRef: null 
            };
            chunk.addChild(sprite);
            chunk.blockIds.push(blockId);
            state.slotRenderSignature.set(blockId, '0');
            blockId--;
        }
    }
    updateSalesCounter();
}

function updateSalesCounter() {
    const soldCount = Math.max(0, Math.min(CONFIG.TOTAL_BLOCKS, state.soldCount));
    const percentage = (soldCount / CONFIG.TOTAL_BLOCKS) * 100;
    const countElement = state.ui.salesCountEl || document.getElementById('sales-count');
    const progressBar = state.ui.salesProgressEl || document.getElementById('sales-progress-bar');

    if (!state.ui.salesCountEl && countElement) {
        state.ui.salesCountEl = countElement;
    }
    if (!state.ui.salesProgressEl && progressBar) {
        state.ui.salesProgressEl = progressBar;
    }
    
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
    const threshold = state.isMobileDevice ? CONFIG.MOBILE_LOD_THRESHOLD : CONFIG.LOD_THRESHOLD;
    const showText = state.viewMode === 'text' && state.cam.zoom > threshold;
    
    // If the desired state is different from current state, reset the queue
    if (showText !== state.lodVisible) {
        state.lodVisible = showText;
        state.lodQueueIndex = 0;
    }
}

function processLODQueue() {
    // If we have processed everyone, stop.
    if (state.lodQueueIndex >= state.textPool.length) return;

    let processed = 0;
    const limit = state.lodBatchSize || CONFIG.LOD_BATCH_SIZE;

    // Process a chunk of the array
    while (processed < limit && state.lodQueueIndex < state.textPool.length) {
        const text = state.textPool[state.lodQueueIndex];
        const targetVisible = state.viewMode === 'text' && state.lodVisible;
        
        // Only update if it actually needs changing
        if (text.visible !== targetVisible) {
            text.visible = targetVisible;
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

    const clearTouchHover = () => {
        const tt = document.getElementById('tooltip');
        if (state.hoverId !== -1 && state.blocks[state.hoverId]) {
            state.blocks[state.hoverId].sprite.alpha = 1;
        }
        state.hoverId = -1;
        if (tt) tt.style.display = 'none';
    };

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
            state.pendingHoverPos = { x: e.clientX, y: e.clientY };
            if (!state.hoverRafId) {
                state.hoverRafId = requestAnimationFrame(() => {
                    state.hoverRafId = 0;
                    if (state.dragging || !state.pendingHoverPos) return;
                    const pos = state.pendingHoverPos;
                    state.pendingHoverPos = null;
                    handleHover(pos.x, pos.y);
                });
            }
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
            const t = state.touches[0];
            state.dragging = true;
            state.hasMoved = false;
            state.dragStart = { x: t.clientX, y: t.clientY };
            state.dragOriginalStart = { x: t.clientX, y: t.clientY };
            state.vel = { x: 0, y: 0 };

            // Mobile hover-like behavior: show tooltip immediately on touch.
            handleHover(t.clientX, t.clientY);
        } else if (state.touches.length === 2) {
            state.dragging = false;
            state.lastTouchTapId = -1;
            const dx = state.touches[0].clientX - state.touches[1].clientX;
            const dy = state.touches[0].clientY - state.touches[1].clientY;
            state.lastTouchDistance = Math.hypot(dx, dy);
            clearTouchHover();
        }
    }, { passive: false });

    dom.addEventListener('touchmove', (e) => {
        e.preventDefault();
        state.touches = Array.from(e.touches);
        if (state.touches.length === 1 && state.dragging) {
            const t = state.touches[0];
            const dx = t.clientX - state.dragStart.x;
            const dy = t.clientY - state.dragStart.y;
            const movedDistance = Math.hypot(t.clientX - state.dragOriginalStart.x, t.clientY - state.dragOriginalStart.y);

            // Small finger movement behaves like hover tracking.
            if (movedDistance <= state.clickThreshold * 1.5) {
                handleHover(t.clientX, t.clientY);
            } else {
                state.hasMoved = true;
                clearTouchHover();
                state.target.x += dx;
                state.target.y += dy;
            }

            state.dragStart = { x: t.clientX, y: t.clientY };
            state.vel = { x: dx, y: dy };
        } else if (state.touches.length === 2) {
            clearTouchHover();
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
            const t = e.changedTouches[0];
            const tappedId = getBlockId(t.clientX, t.clientY);
            const now = Date.now();

            // 1st tap => show tooltip, 2nd quick tap on same block => open modal.
            if (tappedId !== -1 && state.lastTouchTapId === tappedId && (now - state.lastTouchTapTime) < 700) {
                state.selectedId = tappedId;
                const tappedBlock = state.blocks[tappedId];
                if (state.viewMode === 'video' && tappedBlock && tappedBlock.sold && hasYouTubeVideo(tappedBlock)) {
                    openGridVideoPlayer(tappedId);
                } else {
                    window.closeGridVideoPlayer();
                    window.openModal();
                }
                state.lastTouchTapId = -1;
                state.lastTouchTapTime = 0;
            } else {
                handleHover(t.clientX, t.clientY);
                state.lastTouchTapId = tappedId;
                state.lastTouchTapTime = now;
            }
        }

        state.touches = Array.from(e.touches);
        if (state.touches.length === 0) {
            state.dragging = false;
            state.lastTouchDistance = 0;
        }
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
    const tt = state.ui.tooltipEl || document.getElementById('tooltip');
    if (!state.ui.tooltipEl && tt) {
        state.ui.tooltipEl = tt;
    }
    if (!tt) return;

    if (id !== state.hoverId) {
        if (state.hoverId !== -1 && state.blocks[state.hoverId]) state.blocks[state.hoverId].sprite.alpha = 1;
        state.hoverId = id;
        if (id !== -1 && state.blocks[id]) {
            const b = state.blocks[id];
            b.sprite.alpha = 0.6;
            document.body.style.cursor = 'pointer';
            tt.style.display = 'block';
            tt.style.borderColor = '';
            if (b.sold) {
                const _name = b.data.owner_name || 'Owner';
                const _color = sanitizeBlockColor(b.data.owner_color || '#FF0000');
                const _fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(_name)}&background=${_color.replace('#','')}&color=fff&size=80&bold=true&rounded=true`;
                const _src = b.data.image_url ? b.data.image_url : _fallback;
                tt.innerHTML = `<div class="tt-yt-card">
  <img class="tt-yt-avatar" src="${_src}" onerror="this.onerror=null;this.src='${_fallback}'" style="border-color:${_color}" alt="${_name}">
  <div class="tt-yt-info">
    <div class="tt-yt-name">${_name}</div>
    <div class="tt-yt-sub">Canvas #${b.id}</div>
    <div class="tt-yt-price" style="color:${_color}">₹${b.price}</div>
  </div>
</div>`;
            } else {
                tt.innerHTML = `<div class="tt-yt-card">
  <div class="tt-yt-avatar-icon">🔓</div>
  <div class="tt-yt-info">
    <div class="tt-yt-name">Canvas #${b.id}</div>
    <div class="tt-yt-sub">Available</div>
    <div class="tt-yt-price" style="color:#FFD700">₹${b.price}</div>
  </div>
</div>`;
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
        const block = state.blocks[id];
        if (state.viewMode === 'video' && block && block.sold && hasYouTubeVideo(block)) {
            state.selectedId = id;
            openGridVideoPlayer(id);
            return;
        }

        window.closeGridVideoPlayer();
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
    textObj.visible = state.viewMode === 'text' && state.lodVisible;
}

function removeFromPool(textObj) {
    const idx = textObj._poolIndex;
    if (idx === undefined || idx < 0 || idx >= state.textPool.length) return;

    if (textObj._chunkRef && textObj._chunkRef.textRefs) {
        textObj._chunkRef.textRefs.delete(textObj);
    }

    // 1. Get the last item in the array
    const lastItem = state.textPool[state.textPool.length - 1];
    
    // 2. Overwrite the item to remove with the last item
    state.textPool[idx] = lastItem;
    
    // 3. Update the last item's internal index reference
    if (lastItem) {
        lastItem._poolIndex = idx;
    }
    
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

        textObj._isBlockText = true;
        textObj._chunkRef = sprite.parent;
        textObj.blockId = sprite.blockId;
        if (sprite.parent && sprite.parent.textRefs) {
            sprite.parent.textRefs.add(textObj);
        }
        
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

function sanitizeBlockColor(color) {
    const namedColors = {
        yellow: '#FFD700',
        red: '#FF6B6B',
        turquoise: '#4ECDC4',
        blue: '#45B7D1',
        green: '#96CEB4',
        amber: '#FECA57',
        purple: '#B983FF',
        pink: '#FD79A8'
    };

    if (typeof color !== 'string') return '#FFD700';

    const raw = color.trim();
    if (!raw) return '#FFD700';

    if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
        return raw.toUpperCase();
    }

    if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
        const r = raw[1];
        const g = raw[2];
        const b = raw[3];
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    const mapped = namedColors[raw.toLowerCase()];
    return mapped || '#FFD700';
}

function sanitizeTextColor(color) {
    return '#FFFFFF';
}

function ensureBlockPhotoSprite(block) {
    if (!block || !block.sprite || !block.sprite.parent) return null;
    if (block.photoRef) return block.photoRef;

    const photoSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    photoSprite.x = block.sprite.x;
    photoSprite.y = block.sprite.y;
    photoSprite.width = CONFIG.BLOCK_SIZE - CONFIG.GAP;
    photoSprite.height = CONFIG.BLOCK_SIZE - CONFIG.GAP;
    photoSprite.visible = false;
    photoSprite.blockId = block.id;

    block.photoRef = photoSprite;
    block.sprite.parent.addChild(photoSprite);
    return photoSprite;
}

function ensureBlockVideoSprite(block) {
    if (!block || !block.sprite || !block.sprite.parent) return null;
    if (block.videoRef) return block.videoRef;

    const videoSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    videoSprite.x = block.sprite.x;
    videoSprite.y = block.sprite.y;
    videoSprite.width = CONFIG.BLOCK_SIZE - CONFIG.GAP;
    videoSprite.height = CONFIG.BLOCK_SIZE - CONFIG.GAP;
    videoSprite.visible = false;
    videoSprite.blockId = block.id;

    block.videoRef = videoSprite;
    block.sprite.parent.addChild(videoSprite);
    return videoSprite;
}

function ensureBlockBorderGraphic(block) {
    if (!block || !block.sprite || !block.sprite.parent) return null;
    if (block.borderRef) return block.borderRef;

    const borderGraphics = new PIXI.Graphics();
    borderGraphics.visible = false;
    borderGraphics.eventMode = 'none';
    borderGraphics.blockId = block.id;

    block.borderRef = borderGraphics;
    block.sprite.parent.addChild(borderGraphics);
    return borderGraphics;
}

function destroyDisplayObject(ref) {
    if (!ref) return;
    if (ref.parent) {
        ref.parent.removeChild(ref);
    }
    ref.destroy();
}

function adjustTextureRefCount(refCounts, key, delta) {
    if (!key) return;
    const next = (refCounts.get(key) || 0) + delta;
    if (next <= 0) {
        refCounts.delete(key);
    } else {
        refCounts.set(key, next);
    }
}

function releaseBlockPhotoTexture(block) {
    if (!block) return;

    if (block.photoTextureKey) {
        adjustTextureRefCount(state.photoTextureRefCounts, block.photoTextureKey, -1);
    }

    block.photoTextureKey = '';
    block.photoReady = false;
    if (block.photoRef) {
        block.photoRef.texture = PIXI.Texture.WHITE;
        block.photoRef.visible = false;
    }

    trimTextureCacheToLimit(
        state.photoTextureCache,
        state.photoCacheOrder,
        state.photoTextureRefCounts,
        state.photoTextureCacheLimit
    );
}

function releaseBlockVideoTexture(block) {
    if (!block) return;

    if (block.videoTextureKey) {
        adjustTextureRefCount(state.videoTextureRefCounts, block.videoTextureKey, -1);
    }

    block.videoTextureKey = '';
    block.videoReady = false;
    if (block.videoRef) {
        block.videoRef.texture = PIXI.Texture.WHITE;
        block.videoRef.visible = false;
    }

    trimTextureCacheToLimit(
        state.videoTextureCache,
        state.videoCacheOrder,
        state.videoTextureRefCounts,
        state.videoTextureCacheLimit
    );
}

function releaseBlockOverlays(block) {
    if (!block) return;

    releaseBlockPhotoTexture(block);
    releaseBlockVideoTexture(block);

    if (block.photoRef) {
        destroyDisplayObject(block.photoRef);
        block.photoRef = null;
    }

    if (block.videoRef) {
        destroyDisplayObject(block.videoRef);
        block.videoRef = null;
    }

    if (block.borderRef) {
        destroyDisplayObject(block.borderRef);
        block.borderRef = null;
    }
}

function refreshBlockBorder(block) {
    if (!block || !block.sprite) return;

    if (!block.sold || !block.data || state.viewMode !== 'video') {
        if (block.borderRef) {
            block.borderRef.clear();
            block.borderRef.visible = false;
        }
        return;
    }

    const border = ensureBlockBorderGraphic(block);
    if (!border) return;

    border.clear();

    const safeColor = sanitizeBlockColor(block.data.owner_color);
    const strokeColor = parseInt(safeColor.slice(1), 16);
    const size = CONFIG.BLOCK_SIZE - CONFIG.GAP;

    border.rect(block.sprite.x, block.sprite.y, size, size).stroke({ width: 1, color: strokeColor, alpha: 0.95 });
    border.rect(block.sprite.x + 1, block.sprite.y + 1, size - 2, size - 2).stroke({ width: 0.5, color: 0x000000, alpha: 0.25 });
    border.visible = state.viewMode === 'video';
}

function getBlockPhotoUrl(block) {
    if (!block.sold) return null;
    if (block.data && typeof block.data.image_url === 'string' && block.data.image_url.trim()) {
        return block.data.image_url.trim();
    }
    return null;
}

function hasUserImage(block) {
    return !!(block && block.sold && block.data && typeof block.data.image_url === 'string' && block.data.image_url.trim());
}

async function loadTextureFromUrl(url) {
    const img = await loadImageFromUrl(url);
    if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) {
        throw new Error(`Invalid image texture: ${url}`);
    }

    // Clamp user image textures to a fixed tile size to keep GPU memory bounded.
    const size = state.isMobileDevice ? CONFIG.PHOTO_TEXTURE_SIZE_MOBILE : CONFIG.PHOTO_TEXTURE_SIZE_DESKTOP;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas context unavailable');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Cover-fit keeps tiles visually dense while still capping texture size.
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const drawW = Math.max(1, Math.round(img.naturalWidth * scale));
    const drawH = Math.max(1, Math.round(img.naturalHeight * scale));
    const dx = Math.floor((size - drawW) / 2);
    const dy = Math.floor((size - drawH) / 2);

    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, dx, dy, drawW, drawH);

    const texture = PIXI.Texture.from(canvas);
    texture.source.scaleMode = 'linear';
    return texture;
}

function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Image failed to load: ${url}`));
        img.src = url;
    });
}

async function createYouTubeTileTexture(videoId) {
    const thumbCandidates = [
        `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`,
        `https://i.ytimg.com/vi_webp/${videoId}/hq720.webp`,
        `https://i.ytimg.com/vi_webp/${videoId}/sddefault.webp`,
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/hq720.jpg`,
        `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    ];

    let img = null;
    for (const candidate of thumbCandidates) {
        try {
            img = await loadImageFromUrl(candidate);
            break;
        } catch (e) {
            // Try next candidate.
        }
    }

    if (!img) {
        throw new Error(`No thumbnail available for video ${videoId}`);
    }

    // Keep video thumbs bounded to avoid large GPU spikes.
    const size = state.isMobileDevice ? CONFIG.VIDEO_TEXTURE_SIZE_MOBILE : CONFIG.VIDEO_TEXTURE_SIZE_DESKTOP;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Canvas context unavailable');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Full thumbnail visible: use contain fit inside the square tile (no cropping).
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const drawW = Math.max(1, Math.round(img.naturalWidth * scale));
    const drawH = Math.max(1, Math.round(img.naturalHeight * scale));
    const dx = Math.floor((size - drawW) / 2);
    const dy = Math.floor((size - drawH) / 2);

    // Clean padded background for the unused area around contained image.
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, size, size);

    // Subtle glow panel to avoid harsh bars while keeping full image intact.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(dx, dy, drawW, drawH);
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, drawW, drawH);

    const texture = PIXI.Texture.from(canvas);
    texture.source.scaleMode = 'linear';
    return texture;
}

function touchCacheOrder(order, key) {
    const existingIndex = order.indexOf(key);
    if (existingIndex !== -1) {
        order.splice(existingIndex, 1);
    }
    order.push(key);
}

function trimTextureCacheToLimit(cache, order, refCounts, limit) {
    if (order.length <= limit) return;

    // Guard prevents infinite loops when all entries are currently in use.
    let guard = order.length;
    while (order.length > limit && guard > 0) {
        const oldestKey = order[0];
        if (!oldestKey) break;

        const refCount = refCounts.get(oldestKey) || 0;
        if (refCount > 0) {
            order.push(order.shift());
            guard--;
            continue;
        }

        order.shift();
        const oldTexture = cache.get(oldestKey);
        cache.delete(oldestKey);

        if (oldTexture) {
            oldTexture.destroy(true);
        }

        guard = order.length;
    }
}

function cacheTextureWithLimit(cache, order, refCounts, key, texture, limit) {
    cache.set(key, texture);
    touchCacheOrder(order, key);
    trimTextureCacheToLimit(cache, order, refCounts, limit);
}

async function ensureBlockPhotoTexture(block, imageUrl) {
    if (!block || !block.sold || !imageUrl) return;
    if (block.photoLoading) return;
    if (block.photoReady && block.photoUrl === imageUrl) return;

    block.photoLoading = true;
    block.photoUrl = imageUrl;
    const requestedUrl = imageUrl;

    try {
        let texture = state.photoTextureCache.get(requestedUrl);
        if (texture) {
            touchCacheOrder(state.photoCacheOrder, requestedUrl);
        }
        if (!texture) {
            texture = await loadTextureFromUrl(requestedUrl);
            cacheTextureWithLimit(
                state.photoTextureCache,
                state.photoCacheOrder,
                state.photoTextureRefCounts,
                requestedUrl,
                texture,
                state.photoTextureCacheLimit
            );
        }

        if (block.photoUrl !== requestedUrl) return;

        const photoRef = ensureBlockPhotoSprite(block);
        if (!photoRef) return;

        if (block.photoTextureKey !== requestedUrl) {
            if (block.photoTextureKey) {
                adjustTextureRefCount(state.photoTextureRefCounts, block.photoTextureKey, -1);
            }
            adjustTextureRefCount(state.photoTextureRefCounts, requestedUrl, 1);
            block.photoTextureKey = requestedUrl;
        }

        photoRef.texture = texture;
        photoRef.width = CONFIG.BLOCK_SIZE - CONFIG.GAP;
        photoRef.height = CONFIG.BLOCK_SIZE - CONFIG.GAP;
        photoRef.tint = 0xFFFFFF;
        block.photoReady = true;

        photoRef.visible = false;
    } catch (error) {
        console.warn(`Failed to load image for block ${block.id}:`, error);
        // Keep base tile visible if image fails to load.
        block.photoReady = false;
        if (block.photoRef) {
            block.photoRef.visible = false;
        }
        block.sprite.visible = true;
    } finally {
        block.photoLoading = false;
    }
}

function getSoldBlocks() {
    const sold = [];
    for (let i = 1; i <= CONFIG.TOTAL_BLOCKS; i++) {
        const block = state.blocks[i];
        if (block && block.sold) sold.push(block);
    }
    return sold;
}

function getVisibleSoldBlocks(limit) {
    const effectiveLimit = Math.max(1, typeof limit === 'number' ? limit : state.maxVisibleMediaPreload);
    const ordered = [];
    const seen = new Set();

    const pushIfSold = (block) => {
        if (!block || !block.sold || seen.has(block.id)) return false;
        seen.add(block.id);
        ordered.push(block);
        return ordered.length >= effectiveLimit;
    };

    // First pass: visible chunks only.
    for (const chunk of state.chunks) {
        if (!chunk || !chunk.visible || !chunk.blockIds) continue;

        for (const blockId of chunk.blockIds) {
            if (pushIfSold(state.blocks[blockId])) {
                return ordered;
            }
        }
    }

    // Second pass: remaining sold blocks as fallback prefetch candidates.
    for (const blockId of state.soldBlockIds) {
        if (pushIfSold(state.blocks[blockId])) {
            break;
        }
    }

    return ordered;
}

function enqueuePhotoLoad(block) {
    if (!hasUserImage(block) || block.photoQueued || block.photoLoading || block.photoReady) return;
    block.photoQueued = true;
    state.photoLoadQueue.push(block);
}

function prioritizePhotoQueue() {
    const visible = [];
    const hidden = [];

    for (const block of state.photoLoadQueue) {
        const isVisible = !!(block.sprite && block.sprite.parent && block.sprite.parent.visible);
        if (isVisible) visible.push(block);
        else hidden.push(block);
    }

    state.photoLoadQueue = [...visible, ...hidden];
}

function pumpPhotoQueue() {
    if (state.activePhotoLoads >= state.maxConcurrentPhotoLoads) return;
    if (state.photoLoadQueue.length === 0) return;

    while (state.activePhotoLoads < state.maxConcurrentPhotoLoads && state.photoLoadQueue.length > 0) {
        const block = state.photoLoadQueue.shift();
        if (!block) continue;

        block.photoQueued = false;

        if (block.photoLoading || block.photoReady) {
            continue;
        }

        state.activePhotoLoads++;
        ensureBlockPhotoTexture(block, getBlockPhotoUrl(block))
            .finally(() => {
                state.activePhotoLoads = Math.max(0, state.activePhotoLoads - 1);
            });
    }
}

function startPhotoQueuePump() {
    if (state.photoQueuePumpTimer) return;
    state.photoQueuePumpTimer = setInterval(() => {
        prioritizePhotoQueue();
        pumpPhotoQueue();

        if (!state.photoPrepInProgress && state.photoLoadQueue.length === 0 && state.activePhotoLoads === 0) {
            clearInterval(state.photoQueuePumpTimer);
            state.photoQueuePumpTimer = null;
        }
    }, 60);
}

function stopPhotoQueuePump() {
    if (!state.photoQueuePumpTimer) return;
    clearInterval(state.photoQueuePumpTimer);
    state.photoQueuePumpTimer = null;
}

function getBlockYouTubeId(block) {
    if (!block || !block.sold || !block.data || !block.data.youtube_url) return null;
    return getYouTubeVideoId(block.data.youtube_url);
}

function hasYouTubeVideo(block) {
    return !!getBlockYouTubeId(block);
}

function getYouTubeThumbnailUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

async function ensureBlockVideoTexture(block, videoId) {
    if (!block || !block.sold || !videoId) return;
    if (block.videoLoading) return;

    const requestedUrl = `yt:${videoId}`;
    if (block.videoReady && block.videoUrl === requestedUrl) return;

    block.videoLoading = true;
    block.videoUrl = requestedUrl;

    try {
        let texture = state.videoTextureCache.get(requestedUrl);
        if (texture) {
            touchCacheOrder(state.videoCacheOrder, requestedUrl);
        }
        if (!texture) {
            texture = await createYouTubeTileTexture(videoId);
            cacheTextureWithLimit(
                state.videoTextureCache,
                state.videoCacheOrder,
                state.videoTextureRefCounts,
                requestedUrl,
                texture,
                state.videoTextureCacheLimit
            );
        }

        if (block.videoUrl !== requestedUrl) return;

        const videoRef = ensureBlockVideoSprite(block);
        if (!videoRef) return;

        if (block.videoTextureKey !== requestedUrl) {
            if (block.videoTextureKey) {
                adjustTextureRefCount(state.videoTextureRefCounts, block.videoTextureKey, -1);
            }
            adjustTextureRefCount(state.videoTextureRefCounts, requestedUrl, 1);
            block.videoTextureKey = requestedUrl;
        }

        videoRef.texture = texture;
        videoRef.width = CONFIG.BLOCK_SIZE - CONFIG.GAP;
        videoRef.height = CONFIG.BLOCK_SIZE - CONFIG.GAP;
        videoRef.tint = 0xFFFFFF;
        block.videoReady = true;

        if (state.viewMode === 'video') {
            block.sprite.visible = false;
            videoRef.visible = true;
        }
    } catch (error) {
        console.warn(`Failed to load YouTube thumbnail for block ${block.id}:`, error);
        block.videoReady = false;
        if (state.viewMode === 'video') {
            if (block.videoRef) {
                block.videoRef.visible = false;
            }
            block.sprite.visible = true;
        }
    } finally {
        block.videoLoading = false;
    }
}

function enqueueVideoLoad(block) {
    if (!hasYouTubeVideo(block) || block.videoQueued || block.videoLoading || block.videoReady) return;
    block.videoQueued = true;
    state.videoLoadQueue.push(block);
}

function prioritizeVideoQueue() {
    const visible = [];
    const hidden = [];

    for (const block of state.videoLoadQueue) {
        const isVisible = !!(block.sprite && block.sprite.parent && block.sprite.parent.visible);
        if (isVisible) visible.push(block);
        else hidden.push(block);
    }

    state.videoLoadQueue = [...visible, ...hidden];
}

function pumpVideoQueue() {
    if (state.activeVideoLoads >= state.maxConcurrentVideoLoads) return;
    if (state.videoLoadQueue.length === 0) return;

    while (state.activeVideoLoads < state.maxConcurrentVideoLoads && state.videoLoadQueue.length > 0) {
        const block = state.videoLoadQueue.shift();
        if (!block) continue;

        block.videoQueued = false;

        if (block.videoLoading || block.videoReady) {
            continue;
        }

        state.activeVideoLoads++;
        ensureBlockVideoTexture(block, getBlockYouTubeId(block))
            .finally(() => {
                state.activeVideoLoads = Math.max(0, state.activeVideoLoads - 1);
            });
    }
}

function startVideoQueuePump() {
    if (state.videoQueuePumpTimer) return;
    state.videoQueuePumpTimer = setInterval(() => {
        prioritizeVideoQueue();
        pumpVideoQueue();

        if (state.videoLoadQueue.length === 0 && state.activeVideoLoads === 0) {
            clearInterval(state.videoQueuePumpTimer);
            state.videoQueuePumpTimer = null;
        }
    }, 60);
}

function stopVideoQueuePump() {
    if (!state.videoQueuePumpTimer) return;
    clearInterval(state.videoQueuePumpTimer);
    state.videoQueuePumpTimer = null;
}

function getGridVideoOverlayElement() {
    let el = document.getElementById('grid-video-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'grid-video-overlay';
        document.body.appendChild(el);
    }
    return el;
}

function ensureActiveVideoMarker() {
    if (state.activeVideoMarker && state.activeVideoMarker.graphics) {
        return state.activeVideoMarker;
    }

    const marker = new PIXI.Graphics();
    marker.visible = false;
    marker.eventMode = 'none';
    marker.alpha = 1;

    state.activeVideoMarker = {
        graphics: marker,
        blockId: null,
        parentChunk: null
    };

    return state.activeVideoMarker;
}

function clearActiveVideoMarker() {
    if (!state.activeVideoMarker || !state.activeVideoMarker.graphics) return;

    const marker = state.activeVideoMarker.graphics;
    marker.visible = false;
    marker.clear();

    state.activeVideoMarker.blockId = null;
    state.activeVideoMarker.parentChunk = null;
}

function updateActiveVideoMarker() {
    if (!state.activeGridVideo) {
        clearActiveVideoMarker();
        return;
    }

    const block = state.blocks[state.activeGridVideo.blockId];
    if (!block || !block.sprite || !block.sprite.parent) {
        clearActiveVideoMarker();
        return;
    }

    const markerState = ensureActiveVideoMarker();
    const marker = markerState.graphics;
    const chunk = block.sprite.parent;

    if (marker.parent !== chunk) {
        if (marker.parent) {
            marker.parent.removeChild(marker);
        }
        chunk.addChild(marker);
    }

    const margin = 2;
    const x = block.sprite.x - margin;
    const y = block.sprite.y - margin;
    const size = (CONFIG.BLOCK_SIZE - CONFIG.GAP) + (margin * 2);
    const safeColor = sanitizeBlockColor(block?.data?.owner_color);
    const markerColor = parseInt(safeColor.slice(1), 16);
    const pulse = (Math.sin(performance.now() * 0.01) + 1) * 0.5;
    const glowOuterAlpha = 0.22 + (pulse * 0.38);
    const glowMidAlpha = 0.3 + (pulse * 0.32);

    marker.clear();
    marker.rect(x - 2, y - 2, size + 4, size + 4).stroke({ width: 1, color: markerColor, alpha: glowOuterAlpha });
    marker.rect(x - 1, y - 1, size + 2, size + 2).stroke({ width: 1, color: markerColor, alpha: glowMidAlpha });
    marker.rect(x, y, size, size).stroke({ width: 1, color: markerColor, alpha: 0.95 });
    marker.rect(x + 1, y + 1, size - 2, size - 2).stroke({ width: 0.5, color: 0xffffff, alpha: 0.3 });
    marker.visible = true;

    markerState.blockId = block.id;
    markerState.parentChunk = chunk;
}

function openGridVideoPlayer(blockId) {
    const block = state.blocks[blockId];
    const videoId = getBlockYouTubeId(block);
    if (!block || !videoId) return;

    const creatorName = block?.data?.owner_name || 'Anonymous';
    const safeCreatorName = escapeHtml(creatorName);
    const hasCreatorLink = !!(block?.data?.link_url && String(block.data.link_url).trim());
    const safeColor = sanitizeBlockColor(block?.data?.owner_color);
    const colorInt = parseInt(safeColor.slice(1), 16);
    const r = (colorInt >> 16) & 255;
    const g = (colorInt >> 8) & 255;
    const b = colorInt & 255;

    const overlay = getGridVideoOverlayElement();
    overlay.style.setProperty('--player-accent', safeColor);
    overlay.style.setProperty('--player-accent-rgb', `${r}, ${g}, ${b}`);
    overlay.innerHTML = `
        <div class="grid-video-shell">
            <button class="grid-video-close" onclick="closeGridVideoPlayer()" aria-label="Close video">✕</button>
            <div class="grid-video-frame-wrap">
                <iframe
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                ></iframe>
            </div>
            <div class="grid-video-actions" aria-label="Creator actions">
                <button type="button" class="grid-video-action-btn" onclick="openGridVideoCreatorProfile(${blockId})">View Profile</button>
                <button type="button" class="grid-video-action-btn" onclick="openGridVideoCreatorLink(${blockId})" ${hasCreatorLink ? '' : 'disabled'}>Open Creator Link</button>
            </div>
            <div class="grid-video-owner">Now playing: #${blockId} | ${safeCreatorName}</div>
        </div>
    `;

    overlay.classList.add('show');
    state.activeGridVideo = { blockId, mode: null, floating: false, left: 0, top: 0, width: 0, height: 0 };
    state.lastVideoCamSnapshot = { x: state.cam.x, y: state.cam.y, zoom: state.cam.zoom };
    updateActiveVideoMarker();
    updateGridVideoOverlayPosition();
}

window.openGridVideoCreatorProfile = function(blockId) {
    const block = state.blocks[blockId];
    if (!block) return;
    state.selectedId = blockId;
    openModal();
};

window.openGridVideoCreatorLink = function(blockId) {
    const block = state.blocks[blockId];
    const url = block?.data?.link_url;
    if (!url || !String(url).trim()) return;
    window.open(String(url).trim(), '_blank', 'noopener,noreferrer');
};

window.closeGridVideoPlayer = function() {
    const overlay = document.getElementById('grid-video-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        overlay.innerHTML = '';
    }
    state.activeGridVideo = null;
    state.lastVideoCamSnapshot = null;
    clearActiveVideoMarker();
};

function pinGridVideoAsFloatingPlayer() {
    if (!state.activeGridVideo) return;

    const overlay = document.getElementById('grid-video-overlay');
    if (!overlay) return;

    const maxByViewport = Math.floor(window.innerWidth * 0.4);
    const floatingWidth = window.innerWidth <= 700
        ? Math.min(Math.max(320, Math.floor(window.innerWidth * 0.84)), 400)
        : Math.min(Math.max(500, maxByViewport), 620);
    const videoHeight = Math.round(floatingWidth * 0.5625);
    const controlsHeight = 84;
    const floatingHeight = videoHeight + controlsHeight;
    const left = Math.max(8, window.innerWidth - floatingWidth - 18);
    const top = Math.max(8, window.innerHeight - floatingHeight - 18);

    state.activeGridVideo.floating = true;
    state.activeGridVideo.mode = 'floating';
    state.activeGridVideo.width = floatingWidth;
    state.activeGridVideo.height = floatingHeight;
    state.activeGridVideo.left = left;
    state.activeGridVideo.top = top;

    overlay.classList.remove('grid-track');
    overlay.classList.add('floating');
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.width = `${floatingWidth}px`;
    overlay.style.height = `${floatingHeight}px`;
}

function placeGridVideoOnTile(block) {
    if (!state.activeGridVideo || !block || !block.sprite) return;

    const overlay = document.getElementById('grid-video-overlay');
    if (!overlay) return;

    const blockSizePx = (CONFIG.BLOCK_SIZE - CONFIG.GAP) * state.cam.zoom;
    const screenX = state.cam.x + (block.sprite.x * state.cam.zoom);
    const screenY = state.cam.y + (block.sprite.y * state.cam.zoom);

    const width = Math.max(1, blockSizePx);
    const height = Math.max(1, blockSizePx);

    const maxLeft = window.innerWidth - width;
    const maxTop = window.innerHeight - height;
    const clampedLeft = Math.min(Math.max(0, screenX), Math.max(0, maxLeft));
    const clampedTop = Math.min(Math.max(0, screenY), Math.max(0, maxTop));

    state.activeGridVideo.floating = false;
    state.activeGridVideo.mode = 'grid';
    state.activeGridVideo.left = clampedLeft;
    state.activeGridVideo.top = clampedTop;
    state.activeGridVideo.width = width;
    state.activeGridVideo.height = height;

    overlay.classList.add('grid-track');
    overlay.classList.remove('floating');
    overlay.style.left = `${clampedLeft}px`;
    overlay.style.top = `${clampedTop}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
}

function updateGridVideoOverlayPosition() {
    if (!state.activeGridVideo) {
        if (state.activeVideoMarker && state.activeVideoMarker.blockId !== null) {
            clearActiveVideoMarker();
        }
        return;
    }

    updateActiveVideoMarker();

    const overlay = document.getElementById('grid-video-overlay');
    if (!overlay) return;

    const block = state.blocks[state.activeGridVideo.blockId];
    if (!block || !block.sprite) {
        window.closeGridVideoPlayer();
        return;
    }

    const blockSizePx = (CONFIG.BLOCK_SIZE - CONFIG.GAP) * state.cam.zoom;
    const screenX = state.cam.x + (block.sprite.x * state.cam.zoom);
    const screenY = state.cam.y + (block.sprite.y * state.cam.zoom);
    const parentVisible = !!(block.sprite.parent && block.sprite.parent.visible);
    const blockInViewport =
        parentVisible &&
        (screenX + blockSizePx) > 0 &&
        screenX < window.innerWidth &&
        (screenY + blockSizePx) > 0 &&
        screenY < window.innerHeight;

    // Super-low floating trigger: switch to side player only after heavy zoom-out.
    // Target is roughly when ~20 grid rows are visible on screen.
    const targetVisibleRows = state.isMobileDevice ? 16 : 20;
    const baseZoomForRows = state.pixi.screen.height / (CONFIG.BLOCK_SIZE * targetVisibleRows);
    const enterFloatingThreshold = baseZoomForRows * 0.9;
    const exitFloatingThreshold = baseZoomForRows * 1.05;
    const shouldFloatByLod = state.activeGridVideo.floating
        ? state.cam.zoom < exitFloatingThreshold
        : state.cam.zoom < enterFloatingThreshold;

    // Combined rule:
    // - Grid mode only when zoom is in AND user is actually viewing that grid tile.
    // - Otherwise keep medium side player.
    const shouldFloat = shouldFloatByLod || !blockInViewport;

    // Reposition only when mode changes. Keep fixed within a mode.
    if (state.activeGridVideo.mode === null) {
        if (shouldFloat) {
            pinGridVideoAsFloatingPlayer();
        } else {
            placeGridVideoOnTile(block);
        }
        state.lastVideoCamSnapshot = { x: state.cam.x, y: state.cam.y, zoom: state.cam.zoom };
        return;
    }

    if (shouldFloat && state.activeGridVideo.mode !== 'floating') {
        pinGridVideoAsFloatingPlayer();
        state.lastVideoCamSnapshot = { x: state.cam.x, y: state.cam.y, zoom: state.cam.zoom };
        return;
    }

    if (!shouldFloat && state.activeGridVideo.mode !== 'grid') {
        placeGridVideoOnTile(block);
        state.lastVideoCamSnapshot = { x: state.cam.x, y: state.cam.y, zoom: state.cam.zoom };
        return;
    }

    // In grid mode, continuously track the tile exactly like thumbnail placement.
    if (state.activeGridVideo.mode === 'grid') {
        placeGridVideoOnTile(block);
        state.lastVideoCamSnapshot = { x: state.cam.x, y: state.cam.y, zoom: state.cam.zoom };
        return;
    }

    // Same mode: keep fixed, no movement while dragging/panning/zooming.
    state.lastVideoCamSnapshot = { x: state.cam.x, y: state.cam.y, zoom: state.cam.zoom };
}

function preparePhotoMode() {
    const soldBlocks = getVisibleSoldBlocks();
    soldBlocks.forEach((block) => {
        enqueuePhotoLoad(block);
    });
    startPhotoQueuePump();
}

function prepareVideoMode() {
    const soldBlocks = getVisibleSoldBlocks();
    soldBlocks.forEach((block) => {
        enqueueVideoLoad(block);
    });
    startVideoQueuePump();
}

function updateDynamicMediaQueues() {
    const now = performance.now();
    if ((now - state.lastMediaQueueTick) < CONFIG.MEDIA_QUEUE_UPDATE_MS) return;
    state.lastMediaQueueTick = now;

    if (state.viewMode === 'video') {
        prepareVideoMode();
        return;
    }

    // Keep text mode ultra-light: stop background media preloading.
    state.videoLoadQueue.length = 0;
    state.photoLoadQueue.length = 0;

    if (state.activeVideoLoads === 0) {
        stopVideoQueuePump();
    }
    if (state.activePhotoLoads === 0) {
        stopPhotoQueuePump();
    }
}

function applyBlockVisualMode(block) {
    if (!block) return;

    const shouldShowVideo = state.viewMode === 'video';
    const canUseVideo = shouldShowVideo && hasYouTubeVideo(block);

    if (!block.sold) {
        if (block.photoRef) {
            block.photoRef.visible = false;
        }
        if (block.videoRef) {
            block.videoRef.visible = false;
        }
        if (block.borderRef) {
            block.borderRef.visible = false;
        }
        if (block.sprite) {
            block.sprite.visible = true;
        }
        if (block.textRef) {
            block.textRef.visible = false;
        }
        return;
    }

    if (block.photoRef) {
        block.photoRef.visible = false;
    }

    if (canUseVideo) {
        const videoRef = ensureBlockVideoSprite(block);
        if (videoRef) {
            videoRef.visible = !!block.videoReady;
        }

        if (!block.videoReady) {
            enqueueVideoLoad(block);
            startVideoQueuePump();
        }
    } else if (block.videoRef) {
        block.videoRef.visible = false;
    }

    refreshBlockBorder(block);

    if (block.sprite) {
        const safeColor = sanitizeBlockColor(block?.data?.owner_color);
        const ownerTint = parseInt(safeColor.slice(1), 16);
        // In YouTube mode, force a dark tile with neutral tint so only the border carries color.
        // In Text mode, keep the sold texture + owner color fill behavior.
        block.sprite.texture = shouldShowVideo ? state.baseTextures.std : state.baseTextures.sold;
        block.sprite.tint = shouldShowVideo ? 0xFFFFFF : ownerTint;
        const useVideoTexture = canUseVideo && block.videoReady && !!block.videoRef;
        block.sprite.visible = !useVideoTexture;
    }

    if (block.textRef) {
        block.textRef.visible = state.viewMode === 'text' && state.lodVisible;
    }
}

function applyVisualModeToAllBlocks() {
    for (let i = 1; i <= CONFIG.TOTAL_BLOCKS; i++) {
        const block = state.blocks[i];
        if (block) {
            applyBlockVisualMode(block);
        }
    }
}

function updateModeButtons() {
    const textBtn = document.getElementById('mode-text-btn');
    const videoBtn = document.getElementById('mode-video-btn');
    if (!textBtn || !videoBtn) return;

    const isText = state.viewMode === 'text';
    const isVideo = state.viewMode === 'video';

    textBtn.classList.toggle('active', isText);
    videoBtn.classList.toggle('active', isVideo);

    document.body.classList.toggle('is-video-mode', isVideo);

    textBtn.disabled = false;
    videoBtn.disabled = false;
}

function updateBlock(id, data, options = {}) {
    const b = state.blocks[id];
    if(!b) return;
    const previousSold = b.sold;
    const previousPhotoUrl = b.photoUrl || '';
    const previousVideoUrl = b.videoUrl || '';
    
    // Only set sold to true if data indicates it's sold, otherwise keep current state
    if (data.sold !== undefined) {
        b.sold = data.sold;
    } else {
        b.sold = true; // Default behavior for explicit updates
    }

    if (!previousSold && b.sold) {
        state.soldCount = Math.min(CONFIG.TOTAL_BLOCKS, state.soldCount + 1);
        state.soldBlockIds.add(id);
    } else if (previousSold && !b.sold) {
        state.soldCount = Math.max(0, state.soldCount - 1);
        state.soldBlockIds.delete(id);
    } else if (b.sold) {
        state.soldBlockIds.add(id);
    } else {
        state.soldBlockIds.delete(id);
    }
    
    b.data = data;

    const nextPhotoUrl = (data && typeof data.image_url === 'string') ? data.image_url.trim() : '';
    const nextVideoId = (data && typeof data.youtube_url === 'string') ? getYouTubeVideoId(data.youtube_url) : null;
    const nextVideoUrl = nextVideoId ? `yt:${nextVideoId}` : '';

    if (!b.sold) {
        b.photoQueued = false;
        b.photoLoading = false;
        b.photoUrl = '';
        b.videoQueued = false;
        b.videoLoading = false;
        b.videoUrl = '';

        releaseBlockOverlays(b);
        b.sprite.texture = state.baseTextures[b.tier] || state.baseTextures.std;
        b.sprite.tint = 0xFFFFFF;
    } else {
        if ((nextPhotoUrl !== previousPhotoUrl || !previousSold) && b.photoTextureKey) {
            releaseBlockPhotoTexture(b);
        }

        if ((nextVideoUrl !== previousVideoUrl || !previousSold) && b.videoTextureKey) {
            releaseBlockVideoTexture(b);
        }

        if (nextPhotoUrl !== previousPhotoUrl || !previousSold) {
            b.photoReady = false;
            b.photoQueued = false;
            b.photoLoading = false;
        }
        b.photoUrl = nextPhotoUrl;

        if (nextVideoUrl !== previousVideoUrl || !previousSold) {
            b.videoReady = false;
            b.videoQueued = false;
            b.videoLoading = false;
        }
        b.videoUrl = nextVideoUrl;
    }
    
    // Only apply sold styling if the block is actually sold
    if (b.sold) {
        b.sprite.texture = state.baseTextures.sold;
        const safeColor = sanitizeBlockColor(data.owner_color);
        b.sprite.tint = parseInt(safeColor.slice(1), 16);
    }

    // This function now internally handles O(1) pool updates
    if (b.sold && data.owner_text) {
        renderBlockText(b.sprite, data.owner_text);
    } else {
        renderBlockText(b.sprite, null);
    }

    if (b.sold && b.sprite.textRef) {
        const safeTextColor = sanitizeTextColor(data.owner_text_color || '#FFFFFF');
        b.sprite.textRef.tint = parseInt(safeTextColor.slice(1), 16);
    }

    applyBlockVisualMode(b);
    refreshBlockBorder(b);

    if (state.viewMode === 'video' && b.sold) {
        if (hasYouTubeVideo(b)) {
            enqueueVideoLoad(b);
            startVideoQueuePump();
        }
    }

    state.slotRenderSignature.set(id, getSlotRenderSignature(b.sold ? { ...data, sold: true } : { sold: false }));

    if (!options.skipSalesCounter) {
        updateSalesCounter();
    }
}

// =========================================================================
// 8. APP INTERFACE & UI
// =========================================================================
let testModeBlockId = null;
let formData = { name: '', message: '', color: '#FFD700', text: '', imageUrl: '', linkUrl: '', linkDescription: '' };

window.app = {
    resetCamera: () => centerCamera(),
    setViewMode: (mode) => {
        const normalized = mode === 'video' ? 'video' : 'text';
        if (state.viewMode === normalized) {
            updateModeButtons();
            return;
        }

        state.viewMode = normalized;
        state.lodQueueIndex = 0;

        if (normalized !== 'video') {
            window.closeGridVideoPlayer();
            state.videoLoadQueue.length = 0;
            state.photoLoadQueue.length = 0;
            stopVideoQueuePump();
            stopPhotoQueuePump();

            for (const blockId of state.soldBlockIds) {
                const block = state.blocks[blockId];
                if (!block) continue;
                releaseBlockOverlays(block);
            }
        }

        if (normalized === 'video') {
            prepareVideoMode();
        }

        checkLODTransition();
        applyVisualModeToAllBlocks();
        updateModeButtons();
    },
    toggleViewMode: () => {
        if (state.viewMode === 'text') {
            window.app.setViewMode('video');
            return;
        }

        window.app.setViewMode('text');
    },
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
                showError('Invalid canvas selected');
                return;
            }
            
            if (block.sold) {
                showError('This canvas is already claimed');
                return;
            }
            
            // Create local purchase data
            const purchaseData = {
                owner_name: formData.name,
                owner_color: formData.color,
                owner_text: formData.text.substring(0, 150),
                owner_text_color: '#FFFFFF',
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
            
            showSuccess(`Canvas #${state.selectedId} claimed successfully! This is a local preview - email us at thegoodguy08@gmail.com to make it permanent.`);
            
            // Close modal and show the profile
            setTimeout(() => {
                closeModal();
                state.selectedId = state.selectedId; // Keep the same ID
                openModal(); // Reopen to show the profile
            }, 2000);
            
        } catch (error) {
            console.error('Purchase error:', error);
            showError('Failed to claim canvas. Please try again.');
        }
    },
    simulate: () => {
        if (state.viewMode !== 'text') {
            showInfo('Simulate is available in Text Mode only.');
            return;
        }

        if(state.simulating) return;
        state.simulating = true;
        const unsold = [];
        for(let i=1; i<=CONFIG.TOTAL_BLOCKS; i++) if(!state.blocks[i].sold) unsold.push(i);
        if(unsold.length === 0) { alert("Grid Full!"); state.simulating = false; return; }
        const simulationTexts = [
            "Be yourself; everyone else is already taken.",
            "The greatest glory in living lies not in never falling, but in rising every time we fall.",
            "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.",
            "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
            "Be the change that you wish to see in the world."
        ];
        let count = 0;
        const interval = setInterval(() => {
            if (count >= unsold.length || unsold.length === 0) {
                clearInterval(interval);
                state.simulating = false;
                updateSalesCounter();
                return;
            }

            for(let k=0; k<50; k++) {
                if(unsold.length === 0) break;
                const randIdx = Math.floor(Math.random() * unsold.length);
                const id = unsold[randIdx];
                // "Swap and Pop" logic for the simulation array (simulation only runs once, so simple splice is okay here, but let's be consistent)
                unsold[randIdx] = unsold[unsold.length - 1];
                unsold.pop();

                const simulatedText = simulationTexts[Math.floor(Math.random() * simulationTexts.length)];
                const simulatedData = {
                    sold: true,
                    owner_name: "Sim " + id,
                    owner_color: CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)],
                    owner_text: simulatedText,
                    owner_text_color: '#FFFFFF',
                    message: "This canvas is part of the simulation.",
                    image_url: '',
                    link_url: "https://example.com/sim" + id,
                    link_description: "Visit Profile",
                    youtube_url: ''
                };

                state.simulatedSlots.set(id, simulatedData);
                updateBlock(id, simulatedData, { skipSalesCounter: true });
                count++;
            }

            updateSalesCounter();
        }, 16); 
    },
    viewRandom: () => {
        const sold = [];
        for(let i=1; i<=CONFIG.TOTAL_BLOCKS; i++) if(state.blocks[i].sold) sold.push(i);
        if(sold.length === 0) return alert("No profiles found!");
        state.selectedId = sold[Math.floor(Math.random() * sold.length)];
        
        // Ensure explore button stays visible when viewing profiles
        const centerControls = document.querySelector('.center-controls');
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
        // Show purchase form for empty blocks
        state.selectedId = id;
        openModal();
    }
};

window.togglePurchaseInfoPanel = () => {
    const panel = document.getElementById('purchase-info-panel');
    if (!panel) return;
    panel.classList.toggle('show');
};

window.closeBuyInstructionPanel = () => {
    const panel = document.getElementById('buy-instruction-panel');
    if (!panel) return;
    panel.classList.remove('show');
};

function getSelectedUnsoldBlockForPurchase() {
    const block = state.blocks[state.selectedId];
    if (!block) {
        showError('No canvas selected.');
        return null;
    }

    if (block.sold) {
        showInfo(`Canvas #${block.id} is already sold.`);
        return null;
    }

    return block;
}

window.openBuyNowForSelectedBlock = () => {
    const block = getSelectedUnsoldBlockForPurchase();
    if (!block) return;

    const panel = document.getElementById('buy-instruction-panel');
    if (!panel) {
        showError('Unable to open instructions panel. Please refresh and try again.');
        return;
    }

    panel.classList.add('show');
};

window.proceedBuyNowForSelectedBlock = () => {
    const block = getSelectedUnsoldBlockForPurchase();
    if (!block) return;

    window.closeBuyInstructionPanel();
    startBuyNowPaymentForSelectedBlock(block);
};

function startBuyNowPaymentForSelectedBlock(block) {

    if (typeof window.Razorpay !== 'function') {
        showError('Payment gateway not loaded. Please refresh and try again.');
        return;
    }

    const amountInPaise = Math.round(Number(block.price || 0) * 100);
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
        showError('Invalid price for this canvas.');
        return;
    }

    const customerName = (formData.name || '').trim();

    const options = {
        key: 'rzp_live_SXMt3u6h8I4TJh',
        amount: amountInPaise,
        currency: 'INR',
        name: 'The Pyramid of Emotions',
        description: `Canvas #${block.id} Purchase`,
        notes: {
            slot_id: String(block.id),
            slot_price_rupees: String(block.price)
        },
        prefill: {
            name: customerName
        },
        theme: {
            color: '#D4AF37'
        },
        handler: function (response) {
            const paymentId = response && response.razorpay_payment_id ? response.razorpay_payment_id : 'N/A';
            showSuccess(`Payment successful for Canvas #${block.id}. Payment ID: ${paymentId}`);
        },
        modal: {
            ondismiss: function () {
                showInfo('Payment cancelled.');
            }
        }
    };

    try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
            const reason = response && response.error && response.error.description
                ? response.error.description
                : 'Payment failed. Please try again.';
            showError(reason);
        });
        rzp.open();
    } catch (error) {
        console.error('Razorpay initialization failed:', error);
        if (block.payment_link) {
            window.open(block.payment_link, '_blank', 'noopener,noreferrer');
            return;
        }
        showError('Unable to start payment. Please try again.');
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
        showError('No canvas selected for testing');
        return;
    }
    
    const formData = {
        owner_name: document.getElementById('test-name').value,
        message: document.getElementById('test-message').value,
        owner_text: document.getElementById('test-engraved').value || 'TEST',
        owner_text_color: '#FFFFFF',
        link_url: document.getElementById('test-link').value,
        link_description: document.getElementById('test-link-desc').value,
        image_url: document.getElementById('test-image').value,
        owner_color: CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)]
    };
    
    // Update the block with test data
    const block = state.blocks[testModeBlockId];
    if (block && !block.sold) {
        updateBlock(testModeBlockId, {
            sold: true,
            ...formData
        });
        closeTestModal();
        
        // Show the test profile
        state.selectedId = testModeBlockId;
        openModal();
        
        showSuccess('Test canvas created! This will disappear when you refresh the page.');
    } else {
        showError('This canvas is not available for testing');
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
    window.closeGridVideoPlayer();
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
                <div class="prof-topbar">
                    <div class="prof-price-badge">₹${b.price || '0'}</div>
                    <button class="prof-close-btn" onclick="closeModal()">×</button>
                </div>

                <div class="prof-content">
                    <div class="prof-left-section">
                        <div class="prof-avatar-container">
                            <img src="${img}" class="prof-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(d.owner_name || 'Anonymous')}&background=random&size=256';" alt="Profile">
                        </div>
                        <h2 class="prof-name">${d.owner_name || 'Anonymous'}</h2>
                        ${d.link_url ? `
                            ${d.link_description ? `<div class="prof-link-desc">${d.link_description}</div>` : ''}
                            <a href="${d.link_url}" target="_blank" rel="noopener noreferrer" class="prof-btn-visit">
                                <span>Visit Link</span>
                                <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                            </a>
                        ` : ''}
                    </div>

                    <div class="prof-right-section">
                        <div class="prof-right-top">
                            <div class="prof-message">
                                <div class="prof-message-text">${d.message || 'No message provided.'}</div>
                            </div>
                        </div>
                        <div class="prof-right-bottom">
                            ${(() => {
                                const vidId = getYouTubeVideoId(d.youtube_url);
                                if (!vidId) return '<div class="prof-no-video">No video added</div>';
                                return `
                                <div class="prof-youtube-player" onclick="loadYouTubeVideo(this, '${vidId}')" role="button" aria-label="Play video">
                                    <img class="prof-youtube-thumb" src="https://img.youtube.com/vi/${vidId}/maxresdefault.jpg" onerror="this.src='https://img.youtube.com/vi/${vidId}/hqdefault.jpg'" alt="Video thumbnail">
                                    <div class="prof-youtube-overlay"></div>
                                    <div class="prof-youtube-play-btn" aria-hidden="true">
                                        <svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#FF0000"/>
                                            <path d="M45 24L27 14v20z" fill="#FFFFFF"/>
                                        </svg>
                                    </div>
                                    <div class="prof-youtube-label">Click to Play</div>
                                </div>`;
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        content.classList.add('premium');
        const d = b.data;
        
        content.innerHTML = `
            <div class="modal-header">
                <h2>Profile for Canvas #${b.id}</h2>
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
                        <div class="color-selector">${CONFIG.COLOR_CHOICES.map(choice => `<button type="button" class="color-btn" onclick="app.setColor('${choice.value}', this)" title="${choice.name}" aria-label="${choice.name}" data-color-name="${choice.name}"><span class="color-dot" style="background:${choice.value}"></span><span class="color-name">${choice.name}</span></button>`).join('')}</div>
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
            <div class="purchase-info-panel" id="purchase-info-panel">
                Please after purchase fill the google form so that we can update the information of yours on website.
            </div>
            <div class="buy-instruction-panel" id="buy-instruction-panel" onclick="closeBuyInstructionPanel()">
                <div class="buy-instruction-card" onclick="event.stopPropagation()">
                    <h3>Before You Proceed</h3>
                    <ol class="buy-instruction-list">
                        <li>The mobile number and email you use are used for verification on our side, so fill only active details that belong to you.</li>
                        <li>Fill the Google Form with the correct data.</li>
                        <li>If any doubt or problem occurs, contact us at creatorspyramid@gmail.com.</li>
                    </ol>
                    <div class="buy-instruction-actions">
                        <button class="btn" type="button" onclick="closeBuyInstructionPanel()">Close</button>
                        <button class="confirm-btn" type="button" onclick="proceedBuyNowForSelectedBlock()">Proceed</button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <div style="font-size:1.2rem; font-weight:800; color:var(--gold)">₹${b.price}</div>
                <div class="purchase-actions">
                    <button class="btn purchase-info-toggle" type="button" onclick="togglePurchaseInfoPanel()">How to Update Info</button>
                    <button class="confirm-btn" type="button" onclick="openBuyNowForSelectedBlock()">Buy Now</button>
                    <button class="btn" type="button" onclick="app.submit()">Claim Canvas (Local)</button>
                </div>
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
                No canvases found containing "${escapeHtml(currentSearchTerm)}"
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
    const resultsContainer = document.getElementById('search-results');
    
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

let resizeDebounceTimer = null;
window.addEventListener('resize', () => {
    if (resizeDebounceTimer) {
        clearTimeout(resizeDebounceTimer);
    }

    resizeDebounceTimer = setTimeout(() => {
        state.isMobileDevice = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
        if (!state.pixi) return;
        state.pixi.resize();
        centerCamera();
        state.lodQueueIndex = 0;
    }, 120);
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadStaticData({ silent: true });
        state.lodQueueIndex = 0;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    updateModeButtons();
});

setInitialViewModeRandomly();

init();
