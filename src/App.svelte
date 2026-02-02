<script>
  import { onMount } from 'svelte';
  import panzoom from 'panzoom';
  import PurchaseForm from './PurchaseForm.svelte';

  // Configuration
  const blockSize = 40;
  const totalRows = 100;
  const canvasWidth = 6000;
  const canvasHeight = 6000;
  const centerX = canvasWidth / 2;

  // API Configuration
  const API_URL = import.meta.env.VITE_API_URL || 'https://pyramid-backend.piyushsayare8.workers.dev';

  // Generate all blocks
  let blocks = [];

  // Get border style based on row number
  function getBorderStyle(row) {
    if (row <= 45) return 'gold';      // Row 1-45 = gold
    if (row <= 85) return 'silver';   // Row 46-85 = silver  
    return 'standard';                 // Row 86-100 = standard
  }

  // Get fill color based on row number
  function getFillColor(row) {
    if (row <= 45) return '#2d2d44'; // Row 1-45 = gold tier
    if (row <= 85) return '#252535'; // Row 46-85 = silver tier
    return '#1e1e28'; // Row 86-100 = standard tier
  }

  // Generate the pyramid blocks - Price decreases from top to bottom, Row 1 (1 block) at top = highest price
  
  // Start from the top (highest prices) and go down
  let blockId = 5050; // Start with Block #5050 at the top
  
  for (let row = 1; row <= totalRows; row++) {
    let rowWidth = row * blockSize;
    let startX = centerX - (rowWidth / 2);

    for (let col = 0; col < row; col++) {
      // Price: Block #5050 (top) = $5,000, then decreasing by $0.50 per block
      let price;
      if (blockId === 5050) {
        price = 5000; // The top block costs $5,000
      } else {
        price = 1 + (blockId - 1) * 0.5; // Block #1 = $1, Block #5049 = $4,999.50
      }
      
      blocks.push({
        id: blockId,
        x: startX + (col * blockSize),
        y: (row - 1) * blockSize + 50, // Pyramid: Row 1 (1 block) at top, Row 100 (100 blocks) at bottom
        row: row,
        col: col,
        price: price,
        borderStyle: getBorderStyle(row),
        fillColor: getFillColor(row)
      });
      
      blockId--;
    }
  }

  let svgElement;
  let containerElement;
  let panzoomInstance;
  let hoveredBlock = null;
  let initialScale = 1;
  let showPurchaseForm = false;
  let selectedBlock = null;
  let soldSlots = [];

  async function loadSoldSlots() {
    try {
      const response = await fetch(`${API_URL}/api/grid`);
      if (response.ok) {
        const data = await response.json();
        soldSlots = data;
        // Mark blocks as sold
        blocks = blocks.map(block => {
          const soldSlot = soldSlots.find(s => s.slot_number === block.id);
          if (soldSlot) {
            return { ...block, sold: true, owner: soldSlot.owner_name, message: soldSlot.owner_message };
          }
          return block;
        });
      }
    } catch (error) {
      console.error('Failed to load sold slots:', error);
    }
  }

  onMount(() => {
    // Load sold slots from backend
    loadSoldSlots();
    // Calculate initial scale to fit pyramid on screen
    const containerRect = containerElement.getBoundingClientRect();
    const pyramidHeight = totalRows * blockSize + 100;
    const pyramidWidth = totalRows * blockSize;
    
    // Calculate scale to fit the entire pyramid
    const scaleX = containerRect.width / pyramidWidth;
    const scaleY = containerRect.height / pyramidHeight;
    initialScale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding

    // Initialize panzoom
    panzoomInstance = panzoom(svgElement, {
      maxZoom: 5,
      minZoom: 0.1,
      initialZoom: initialScale,
      bounds: true,
      boundsPadding: 0.5
    });

    // Center the pyramid initially
    const offsetX = (containerRect.width - pyramidWidth * initialScale) / 2 - (centerX - pyramidWidth / 2) * initialScale;
    const offsetY = (containerRect.height - pyramidHeight * initialScale) / 2;
    
    panzoomInstance.moveTo(offsetX, offsetY);

    return () => {
      if (panzoomInstance) {
        panzoomInstance.dispose();
      }
    };
  });

  function handleBlockHover(block) {
    hoveredBlock = block;
  }

  function handleBlockLeave() {
    hoveredBlock = null;
  }

  function handleBlockClick(block) {
    selectedBlock = block;
    showPurchaseForm = true;
  }

  function closePurchaseForm() {
    showPurchaseForm = false;
    selectedBlock = null;
  }

  function handlePurchaseSuccess(event) {
    // Update the block in the local state to show it's sold
    const blockIndex = blocks.findIndex(b => b.id === event.detail.slotId);
    if (blockIndex !== -1) {
      blocks[blockIndex] = {
        ...blocks[blockIndex],
        sold: true,
        owner: event.detail.owner,
        message: event.detail.message
      };
    }
    // Reload sold slots to get latest data
    loadSoldSlots();
    closePurchaseForm();
  }

  function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(price);
  }

  function resetView() {
    if (panzoomInstance) {
      const containerRect = containerElement.getBoundingClientRect();
      const pyramidHeight = totalRows * blockSize + 100;
      const pyramidWidth = totalRows * blockSize;
      
      const offsetX = (containerRect.width - pyramidWidth * initialScale) / 2 - (centerX - pyramidWidth / 2) * initialScale;
      const offsetY = (containerRect.height - pyramidHeight * initialScale) / 2;
      
      panzoomInstance.zoomAbs(0, 0, initialScale);
      panzoomInstance.moveTo(offsetX, offsetY);
    }
  }

  function zoomToKing() {
    if (panzoomInstance) {
      const containerRect = containerElement.getBoundingClientRect();
      const topX = centerX;
      const topY = 75;
      
      panzoomInstance.zoomAbs(0, 0, 3);
      setTimeout(() => {
        panzoomInstance.moveTo(
          containerRect.width / 2 - topX * 3,
          containerRect.height / 2 - topY * 3
        );
      }, 50);
    }
  }
</script>

<div class="pyramid-container" bind:this={containerElement}>
  <!-- Header UI -->
  <div class="header">
    <h1>THE PYRAMID</h1>
    <p class="subtitle">5,050 Blocks of History</p>
  </div>

  <!-- Controls -->
  <div class="controls">
    <button on:click={resetView} class="control-btn">
      <span>⟲</span> Reset View
    </button>
    <button on:click={zoomToKing} class="control-btn gold">
      <span>⭐</span> View Top Block
    </button>
    <button on:click={() => { selectedBlock = blocks.find(b => b.id === 5050) || null; showPurchaseForm = true; }} class="control-btn premium">
      <span>🏆</span> Own Top Block
    </button>
  </div>

  <!-- Legend -->
  <div class="legend">
    <div class="legend-item">
      <div class="legend-box gold"></div>
      <span>Gold Tier (Rows 1-45)</span>
    </div>
    <div class="legend-item">
      <div class="legend-box silver"></div>
      <span>Silver Tier (Rows 46-85)</span>
    </div>
    <div class="legend-item">
      <div class="legend-box standard"></div>
      <span>Standard Tier (Rows 86-100)</span>
    </div>
  </div>

  <!-- Tooltip -->
  {#if hoveredBlock}
    <div class="tooltip">
      <div class="tooltip-row">Block #{hoveredBlock.id}</div>
      <div class="tooltip-price">{formatPrice(hoveredBlock.price)}</div>
      <div class="tooltip-pos">Row {hoveredBlock.row}, Position {hoveredBlock.col + 1}</div>
      {#if hoveredBlock.id === 5050}
        <div class="tooltip-king">⭐ Top Block - $5,000</div>
      {/if}
    </div>
  {/if}

  <!-- Instructions -->
  <div class="instructions">
    <span>🖱️ Scroll to zoom</span>
    <span>✋ Drag to pan</span>
  </div>

  <!-- SVG Canvas -->
  <svg
    bind:this={svgElement}
    width={canvasWidth}
    height={canvasHeight}
    viewBox="0 0 {canvasWidth} {canvasHeight}"
    class="pyramid-svg"
  >
    <!-- Gradient definitions -->
    <defs>
      <!-- King glow filter -->
      <filter id="kingGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      
      <!-- Gold gradient -->
      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#FFD700"/>
        <stop offset="50%" style="stop-color:#FFA500"/>
        <stop offset="100%" style="stop-color:#FFD700"/>
      </linearGradient>

      <!-- Silver gradient -->
      <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#C0C0C0"/>
        <stop offset="50%" style="stop-color:#A0A0A0"/>
        <stop offset="100%" style="stop-color:#C0C0C0"/>
      </linearGradient>

      <!-- King special gradient -->
      <linearGradient id="kingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#FFD700"/>
        <stop offset="25%" style="stop-color:#FFF8DC"/>
        <stop offset="50%" style="stop-color:#FFD700"/>
        <stop offset="75%" style="stop-color:#FFA500"/>
        <stop offset="100%" style="stop-color:#FFD700"/>
      </linearGradient>
    </defs>

    <!-- Render all blocks -->
    {#each blocks as block (block.id)}
      <g
        class="block-group"
        on:mouseenter={() => handleBlockHover(block)}
        on:mouseleave={handleBlockLeave}
        role="button"
        tabindex="0"
      >
        <!-- Block rectangle -->
        <rect
          x={block.x}
          y={block.y}
          width={blockSize - 2}
          height={blockSize - 2}
          fill={block.fillColor}
          class="block {block.borderStyle}"
          class:hovered={hoveredBlock?.id === block.id}
          class:sold={block.sold}
          role="button"
          tabindex="0"
          on:click={() => handleBlockClick(block)}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBlockClick(block); }}
        />
      </g>
    {/each}
  </svg>
  
  <!-- Purchase Form Modal -->
  {#if showPurchaseForm && selectedBlock}
    <PurchaseForm 
      slotId={selectedBlock.id} 
      price={selectedBlock.price}
      apiUrl={API_URL}
      on:success={handlePurchaseSuccess}
      on:close={closePurchaseForm}
    />
  {/if}
</div>

<style>
  .pyramid-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: linear-gradient(180deg, #0a0a0f 0%, #151520 50%, #0a0a0f 100%);
  }

  .pyramid-svg {
    cursor: grab;
  }

  .pyramid-svg:active {
    cursor: grabbing;
  }

  /* Block styles */
  .block {
    transition: fill 0.2s ease;
    stroke-width: 1px;
    stroke: #333;
  }

  .block.standard {
    stroke: #444;
    stroke-width: 1px;
  }

  .block.silver {
    stroke: url(#silverGradient);
    stroke-width: 2px;
  }

  .block.gold {
    stroke: url(#goldGradient);
    stroke-width: 3px;
  }

  .block.sold {
    opacity: 0.7;
    fill: #2a2a3a !important;
    cursor: not-allowed;
  }

  .block.hovered {
    fill: #3a3a5a !important;
    filter: brightness(1.3);
  }

  .block-group {
    cursor: pointer;
  }

  .king-crown {
    font-size: 24px;
    pointer-events: none;
  }

  /* Header */
  .header {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    z-index: 100;
    pointer-events: none;
  }

  .header h1 {
    font-family: 'Georgia', serif;
    font-size: 2.5rem;
    font-weight: bold;
    color: #FFD700;
    text-shadow: 0 0 20px rgba(255, 215, 0, 0.5), 0 2px 4px rgba(0,0,0,0.8);
    letter-spacing: 8px;
    margin-bottom: 5px;
  }

  .subtitle {
    font-family: 'Arial', sans-serif;
    font-size: 1rem;
    color: #888;
    letter-spacing: 4px;
    text-transform: uppercase;
  }

  /* Controls */
  .controls {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
    z-index: 100;
  }

  .control-btn {
    padding: 10px 20px;
    border: 1px solid #444;
    border-radius: 8px;
    background: rgba(20, 20, 30, 0.9);
    color: #ccc;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-btn:hover {
    background: rgba(40, 40, 60, 0.9);
    border-color: #666;
    color: #fff;
  }

  .control-btn.gold {
    border-color: #FFD700;
    color: #FFD700;
  }

  .control-btn.gold:hover {
    background: rgba(255, 215, 0, 0.1);
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
  }

  .control-btn.premium {
    border-color: #FF6B6B;
    color: #FF6B6B;
    background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 107, 107, 0.05));
  }

  .control-btn.premium:hover {
    background: rgba(255, 107, 107, 0.2);
    border-color: #FF8787;
    color: #FF8787;
    box-shadow: 0 0 15px rgba(255, 107, 107, 0.3);
  }

  /* Legend */
  .legend {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(15, 15, 25, 0.95);
    border: 1px solid #333;
    border-radius: 10px;
    padding: 15px;
    z-index: 100;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 0.85rem;
    color: #aaa;
  }

  .legend-item:last-child {
    margin-bottom: 0;
  }

  .legend-box {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }

  .legend-box.gold {
    background: #2d2d44;
    border: 2px solid #FFD700;
  }

  .legend-box.silver {
    background: #252535;
    border: 2px solid #C0C0C0;
  }

  .legend-box.standard {
    background: #1e1e28;
    border: 1px solid #444;
  }

  /* Tooltip */
  .tooltip {
    position: absolute;
    top: 50%;
    right: 20px;
    transform: translateY(-50%);
    background: rgba(15, 15, 25, 0.95);
    border: 1px solid #444;
    border-radius: 12px;
    padding: 20px;
    z-index: 100;
    min-width: 180px;
    text-align: center;
  }

  .tooltip-row {
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 8px;
  }

  .tooltip-price {
    font-size: 1.8rem;
    font-weight: bold;
    color: #FFD700;
    margin-bottom: 8px;
  }

  .tooltip-pos {
    font-size: 0.8rem;
    color: #666;
  }

  .tooltip-king {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #333;
    font-size: 1rem;
    color: #FFD700;
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }

  /* Instructions */
  .instructions {
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 20px;
    font-size: 0.8rem;
    color: #555;
    z-index: 100;
  }

  .instructions span {
    display: flex;
    align-items: center;
    gap: 5px;
  }
</style>
