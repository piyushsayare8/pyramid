<script>
  import { onMount } from 'svelte';
  import panzoom from 'panzoom';
  import PurchaseForm from './PurchaseForm.svelte';

  // Configuration
  const blockSize = 40;
  const totalRows = 100;
  const canvasWidth = totalRows * blockSize;
  const canvasHeight = totalRows * blockSize + 100;
  const centerX = canvasWidth / 2;
  const pyramidWidth = totalRows * blockSize;
  const pyramidHeight = totalRows * blockSize + 100;
  
  // Million Dollar Homepage style fixed zoom configuration
  const FIXED_MIN_ZOOM = 0.15; // Fixed minimum zoom level (15%)
  const MAX_ZOOM = 3.0; // Maximum zoom level

  // API Configuration
  const API_URL = import.meta.env.VITE_API_URL || 'https://pyramid-backend.piyushsayare8.workers.dev';

  // Color palette for random filling (same as PurchaseForm)
  const colorPalette = [
    '#FFD700', // Gold
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FECA57', // Yellow
    '#B983FF', // Purple
    '#FD79A8', // Pink
    '#A29BFE', // Light Purple
    '#6C5CE7', // Dark Purple
    '#00B894', // Emerald
    '#E17055', // Orange
    '#74B9FF', // Light Blue
    '#A29BFE', // Lavender
    '#FF7675', // Coral
    '#55A3FF', // Sky Blue
    '#FD79A8', // Rose
    '#FDCB6E', // Amber
    '#6C5CE7', // Indigo
    '#00CEC9', // Turquoise
  ];

  // Calculate text size based on content length (updated for 80 char limit)
  function calculateTextSize(text, maxChars = 80) {
    if (!text) return 10;
    const length = text.length;
    if (length <= 5) return 10;
    if (length <= 10) return 9;
    if (length <= 15) return 8;
    if (length <= 20) return 7;
    if (length <= 30) return 6;
    if (length <= 40) return 5;
    if (length <= 50) return 4;
    if (length <= 65) return 3;
    return 2;
  }

  // Calculate inner content area (excluding borders) - matching PurchaseForm logic
  function getInnerDimensions(borderStyle, blockSize = 40) {
    const actualBlockSize = blockSize - 2; // App.svelte uses blockSize - 2
    let borderPixels = 1; // default for standard
    
    if (borderStyle === 'gold') borderPixels = 3;
    else if (borderStyle === 'silver') borderPixels = 2;
    
    return {
      width: actualBlockSize - (borderPixels * 2),
      height: actualBlockSize - (borderPixels * 2)
    };
  }

  // Calculate text wrapping and line breaks for SVG (enhanced for better centering)
  function wrapTextForSVG(text, maxWidth, fontSize, fontFamily) {
    if (!text) return [];
    
    // Handle very long text by breaking at character level if needed
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    // Create a temporary element to measure text width
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontSize}px ${fontFamily}`;
    
    for (const word of words) {
      // If single word is too long, break it down
      if (word.length > 15) {
        // Push current line if exists
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        
        // Break long word into smaller chunks
        let remainingWord = word;
        while (remainingWord.length > 0) {
          let chunk = remainingWord;
          let chunkLength = remainingWord.length;
          
          // Find the largest chunk that fits
          while (chunkLength > 5 && context.measureText(chunk).width > maxWidth) {
            chunkLength = Math.floor(chunkLength * 0.8);
            chunk = remainingWord.substring(0, chunkLength);
          }
          
          lines.push(chunk);
          remainingWord = remainingWord.substring(chunkLength);
        }
      } else {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = context.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  // Fill all blocks with random colors, texts, and fonts
  function fillAllBlocksRandomly() {
    const sampleTexts = ['HI', 'LOVE', 'WOW', 'COOL', 'NICE', 'YES', 'FUN', 'STAR', 'HEART', 'SMILE', 'PEACE', 'DREAM', 'HOPE', 'JOY', 'LIFE', 'HAPPY', 'LUCK', 'WIN', 'BEST', 'TOP'];
    const fontOptions = ['Arial', 'Georgia', 'Courier New', 'Comic Sans MS', 'Impact', 'Verdana', 'Times New Roman', 'Trebuchet MS'];
    
    blocks = blocks.map(block => {
      const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
      const randomFont = fontOptions[Math.floor(Math.random() * fontOptions.length)];
      
      return {
        ...block,
        sold: true,
        owner: 'Test User',
        message: 'Random test block',
        color: randomColor,
        text: randomText,
        font: randomFont
      };
    });
  }

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
  let fixedMinZoom = FIXED_MIN_ZOOM;
  let showPurchaseForm = false;
  let selectedBlock = null;
  let purchaseBlock = null;
  let soldSlots = [];
  let mousePosition = { x: 0, y: 0 };
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragStartTime = 0;

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
            return { 
              ...block, 
              sold: true, 
              owner: soldSlot.owner_name, 
              message: soldSlot.owner_message,
              color: soldSlot.owner_color || '#FFD700',
              text: soldSlot.owner_text || (block.id % 1000).toString()
            };
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
    
    // Initialize panzoom with fixed zoom levels
    panzoomInstance = panzoom(svgElement, {
      maxZoom: MAX_ZOOM,
      minZoom: fixedMinZoom, // Fixed minimum zoom - no zooming out further
      initialZoom: fixedMinZoom, // Start at minimum zoom
      bounds: true,
      disablePan: false,
      smoothPan: false, // Disable smooth pan for better control
      zoomSpeed: 0.1 // Moderate zoom speed
    });

    // Add strict bounds constraint to keep pyramid within viewport
    panzoomInstance.on('pan', () => {
      const transform = panzoomInstance.getTransform();
      const scale = transform.scale;
      const x = transform.x;
      const y = transform.y;
      
      // Get container dimensions
      const containerRect = containerElement.getBoundingClientRect();
      
      // Calculate scaled canvas dimensions
      const scaledWidth = canvasWidth * scale;
      const scaledHeight = canvasHeight * scale;
      
      // Strict bounds - never allow canvas to go beyond container edges
      let minX, maxX, minY, maxY;
      
      if (scaledWidth <= containerRect.width) {
        // If canvas fits, center it
        minX = maxX = (containerRect.width - scaledWidth) / 2;
      } else {
        // If larger, allow panning but keep edges visible
        minX = containerRect.width - scaledWidth;
        maxX = 0;
      }
      
      if (scaledHeight <= containerRect.height) {
        // If canvas fits, center it
        minY = maxY = (containerRect.height - scaledHeight) / 2;
      } else {
        // If larger, allow panning but keep edges visible
        minY = containerRect.height - scaledHeight;
        maxY = 0;
      }
      
      // Apply strict constraints
      const constrainedX = Math.max(minX, Math.min(maxX, x));
      const constrainedY = Math.max(minY, Math.min(maxY, y));
      
      // Apply constraints if needed
      if (constrainedX !== x || constrainedY !== y) {
        panzoomInstance.moveTo(constrainedX, constrainedY);
      }
    });

    // Also constrain zoom changes
    panzoomInstance.on('zoom', () => {
      const transform = panzoomInstance.getTransform();
      const scale = transform.scale;
      
      // Ensure zoom stays within bounds
      if (scale < fixedMinZoom) {
        panzoomInstance.zoomAbs(0, 0, fixedMinZoom);
      } else if (scale > MAX_ZOOM) {
        panzoomInstance.zoomAbs(0, 0, MAX_ZOOM);
      }
      
      // Re-apply pan constraints after zoom
      const x = transform.x;
      const y = transform.y;
      const containerRect = containerElement.getBoundingClientRect();
      const scaledWidth = canvasWidth * scale;
      const scaledHeight = canvasHeight * scale;
      
      let minX, maxX, minY, maxY;
      
      if (scaledWidth <= containerRect.width) {
        minX = maxX = (containerRect.width - scaledWidth) / 2;
      } else {
        minX = containerRect.width - scaledWidth;
        maxX = 0;
      }
      
      if (scaledHeight <= containerRect.height) {
        minY = maxY = (containerRect.height - scaledHeight) / 2;
      } else {
        minY = containerRect.height - scaledHeight;
        maxY = 0;
      }
      
      const constrainedX = Math.max(minX, Math.min(maxX, x));
      const constrainedY = Math.max(minY, Math.min(maxY, y));
      
      if (constrainedX !== x || constrainedY !== y) {
        panzoomInstance.moveTo(constrainedX, constrainedY);
      }
    });

    // Center the pyramid initially at minimum zoom
    const containerRect = containerElement.getBoundingClientRect();
    const offsetX = (containerRect.width - canvasWidth * fixedMinZoom) / 2;
    const offsetY = (containerRect.height - canvasHeight * fixedMinZoom) / 2;
    
    panzoomInstance.moveTo(offsetX, offsetY);

    return () => {
      if (panzoomInstance) {
        panzoomInstance.dispose();
      }
    };
  });

  function handleBlockHover(block, event) {
    hoveredBlock = block;
    mousePosition = { x: event.clientX, y: event.clientY };
  }

  function handleBlockLeave() {
    hoveredBlock = null;
  }

  function handleMouseMove(event) {
    if (hoveredBlock) {
      mousePosition = { x: event.clientX, y: event.clientY };
    }
    
    // Check if we're dragging
    const dragDistance = Math.sqrt(
      Math.pow(event.clientX - dragStartPos.x, 2) + 
      Math.pow(event.clientY - dragStartPos.y, 2)
    );
    
    if (dragDistance > 3) {
      isDragging = true;
    }
  }

  function handleBlockClick(block, event) {
    // Simple check: if mouse moved significantly, don't open
    const dragDistance = Math.sqrt(
      Math.pow(event.clientX - dragStartPos.x, 2) + 
      Math.pow(event.clientY - dragStartPos.y, 2)
    );
    
    // Only open if it was a very small movement (less than 3px)
    if (dragDistance < 3) {
      // Directly open purchase form for available blocks
      if (!block.sold) {
        purchaseBlock = block;
        showPurchaseForm = true;
      } else {
        // Show owner info for sold blocks
        selectedBlock = block;
      }
    }
  }

  function handleMouseDown(event) {
    dragStartPos = { x: event.clientX, y: event.clientY };
    dragStartTime = Date.now();
    isDragging = false;
  }

  function handleMouseUp(event) {
    // Reset dragging state on mouse up
    setTimeout(() => {
      isDragging = false;
    }, 10);
  }

  function closePurchaseForm() {
    showPurchaseForm = false;
    selectedBlock = null;
    purchaseBlock = null;
  }

  function handlePurchaseSuccess(event) {
    const { slotId, owner, message, color, text, font } = event.detail;
    
    // Update the block in the local state
    const blockIndex = blocks.findIndex(block => block.id === slotId);
    if (blockIndex !== -1) {
      blocks[blockIndex] = {
        ...blocks[blockIndex],
        sold: true,
        owner: owner,
        message: message,
        color: color || '#FFD700',
        text: text || (slotId % 1000).toString(),
        font: font || 'Arial'
      };
    }
    // Reload sold slots to get latest data
    loadSoldSlots();
    closePurchaseForm();
  }

  function viewRandomProfile() {
    // Get only sold blocks (blocks with owners)
    const soldBlocks = blocks.filter(block => block.sold);
    
    if (soldBlocks.length === 0) {
      alert('No profiles available yet. Be the first to purchase a block!');
      return;
    }
    
    // Select a random sold block
    const randomIndex = Math.floor(Math.random() * soldBlocks.length);
    selectedBlock = soldBlocks[randomIndex];
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
      
      // Reset to fixed minimum zoom and center
      const offsetX = (containerRect.width - canvasWidth * fixedMinZoom) / 2;
      const offsetY = (containerRect.height - canvasHeight * fixedMinZoom) / 2;
      
      panzoomInstance.zoomAbs(0, 0, fixedMinZoom);
      panzoomInstance.moveTo(offsetX, offsetY);
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
    <button on:click={fillAllBlocksRandomly} class="control-btn fill-btn">
      <span>🎨</span> Fill All Blocks
    </button>
  </div>

  <!-- Random Profile Viewer Button -->
  <div class="center-controls">
    <button on:click={viewRandomProfile} class="profile-btn">
      <span>👤</span> View Random Profile
    </button>
  </div>

  <!-- Block Modal - Only for sold blocks -->
  {#if selectedBlock && selectedBlock.sold}
    <div class="block-modal-backdrop" on:click|self={() => selectedBlock = null}>
      <div class="block-modal">
        <div class="modal-header">
          <h2>Block #{selectedBlock.id}</h2>
          <button class="close-btn" on:click={() => selectedBlock = null}>✕</button>
        </div>
        
        <div class="modal-body">
          <div class="owner-section">
            <div class="premium-header">
              <div class="crown-icon">👑</div>
              <h3>Premium Owner</h3>
            </div>
            
            {#if selectedBlock.imageThumb || selectedBlock.imageUrl}
              <div class="owner-image-container">
                <div class="image-frame">
                  <img 
                    src={selectedBlock.imageThumb || selectedBlock.imageUrl} 
                    alt={`${selectedBlock.owner}'s profile`}
                    on:error={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div class="default-avatar" style="display: none;">
                    {selectedBlock.owner?.charAt(0).toUpperCase() || '?'}
                  </div>
                </div>
                <div class="image-glow"></div>
              </div>
            {:else}
              <div class="owner-image-container">
                <div class="image-frame">
                  <div class="default-avatar">
                    {selectedBlock.owner?.charAt(0).toUpperCase() || '?'}
                  </div>
                </div>
                <div class="image-glow"></div>
              </div>
            {/if}
            
            <div class="owner-info">
              <div class="owner-name-wrapper">
                <div class="owner-name">{selectedBlock.owner}</div>
                <div class="verification-badge">✓ Verified Owner</div>
              </div>
              
              {#if selectedBlock.message}
                <div class="owner-message-container">
                  <div class="message-icon">💬</div>
                  <div class="owner-message">"{selectedBlock.message}"</div>
                </div>
              {/if}
              
              {#if selectedBlock.link}
                <div class="owner-link-container">
                  <div class="link-icon">🔗</div>
                  <a href={selectedBlock.link} target="_blank" rel="noopener noreferrer" class="owner-link">
                    {selectedBlock.link.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]}
                  </a>
                </div>
              {/if}
              
              <div class="block-details">
                <div class="detail-row">
                  <span class="detail-label">Block ID:</span>
                  <span class="detail-value gold">#{selectedBlock.id}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Tier:</span>
                  <span class="detail-value {getBorderStyle(Math.ceil(selectedBlock.id / 51))}">
                    {getBorderStyle(Math.ceil(selectedBlock.id / 51)).toUpperCase()}
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Row:</span>
                  <span class="detail-value">{Math.ceil(selectedBlock.id / 51)}</span>
                </div>
                {#if selectedBlock.text}
                  <div class="detail-row">
                    <span class="detail-label">Display Text:</span>
                    <span class="detail-value">"{selectedBlock.text}"</span>
                  </div>
                {/if}
                {#if selectedBlock.font}
                  <div class="detail-row">
                    <span class="detail-label">Font:</span>
                    <span class="detail-value">{selectedBlock.font}</span>
                  </div>
                {/if}
                {#if selectedBlock.color}
                  <div class="detail-row">
                    <span class="detail-label">Color:</span>
                    <div class="color-display-wrapper">
                      <div class="color-dot" style="background-color: {selectedBlock.color}"></div>
                      <span class="detail-value">{selectedBlock.color}</span>
                    </div>
                  </div>
                {/if}
              </div>
              
              <div class="premium-badges">
                <div class="purchased-badge premium">
                  <span class="badge-icon">⭐</span>
                  Premium Block Owner
                </div>
                <div class="status-badge">
                  <span class="status-dot"></span>
                  Active Since 2024
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Purchase Form Modal -->
  {#if showPurchaseForm && purchaseBlock}
    <PurchaseForm 
      apiUrl={API_URL}
      slotId={purchaseBlock.id}
      price={purchaseBlock.price}
      on:success={handlePurchaseSuccess}
      on:close={closePurchaseForm}
    />
  {/if}

  <!-- Instructions -->
  <div class="instructions">
    <span>🖱️ Scroll to zoom</span>
    <span>✋ Drag to pan</span>
  </div>

  <!-- SVG Canvas -->
  <div class="svg-container" on:mousemove={handleMouseMove} on:mousedown={handleMouseDown} on:mouseup={handleMouseUp}>
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
        on:mouseenter={(e) => handleBlockHover(block, e)}
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
          fill={block.sold && block.color ? block.color : block.fillColor}
          class="block {block.borderStyle}"
          class:hovered={hoveredBlock?.id === block.id}
          class:sold={block.sold}
          role="button"
          tabindex="0"
          on:click={(e) => handleBlockClick(block, e)}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBlockClick(block, e); }}
        />
        
        <!-- Display text on sold blocks with enhanced wrapping and centering -->
        {#if block.sold && block.text}
          {@const fontSize = calculateTextSize(block.text)}
          {@const fontFamily = (block.font || 'Arial') + ', sans-serif'}
          {@const borderStyle = getBorderStyle(Math.ceil(block.id / 51))}
          {@const innerDimensions = getInnerDimensions(borderStyle)}
          {@const padding = 2} // Add small padding for better fit
          {@const maxWidth = innerDimensions.width - (padding * 2)}
          {@const lines = wrapTextForSVG(block.text, maxWidth, fontSize, fontFamily)}
          {@const lineHeight = fontSize * 1.1} // Tighter line height for better fit
          {@const maxLines = Math.floor(innerDimensions.height / lineHeight)}
          {@const displayLines = lines.slice(0, maxLines)}
          {@const adjustedLineHeight = Math.min(lineHeight, innerDimensions.height / displayLines.length)}
          {@const totalTextHeight = displayLines.length * adjustedLineHeight}
          {@const startY = block.y + (blockSize / 2) - (totalTextHeight / 2) + (adjustedLineHeight / 2)}
          
          {#each displayLines as line, i}
            <text
              x={block.x + (blockSize / 2)}
              y={startY + (i * adjustedLineHeight)}
              text-anchor="middle"
              dominant-baseline="central"
              fill="white"
              font-size={fontSize}
              font-weight="bold"
              font-family={fontFamily}
              style="text-shadow: 0 0 3px rgba(0, 0, 0, 0.8); pointer-events: none;"
              class="block-text"
            >
              {line}
            </text>
          {/each}
          
          <!-- Show indicator if text was truncated -->
          {#if lines.length > maxLines}
            <text
              x={block.x + (blockSize / 2)}
              y={block.y + blockSize - 5}
              text-anchor="middle"
              dominant-baseline="central"
              fill="rgba(255, 255, 255, 0.7)"
              font-size="8"
              font-weight="bold"
              font-family="Arial, sans-serif"
              style="text-shadow: 0 0 2px rgba(0, 0, 0, 0.8); pointer-events: none;"
            >
              ...
            </text>
          {/if}
        {/if}
      </g>
    {/each}
  </svg>
  </div>
  
  <!-- Floating Block Number Tooltip -->
  {#if hoveredBlock}
    <div 
      class="floating-tooltip" 
      style="left: {mousePosition.x + 15}px; top: {mousePosition.y - 30}px;"
    >
      Block #{hoveredBlock.id}
    </div>
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

  .svg-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  /* Floating Tooltip */
  .floating-tooltip {
    position: fixed;
    background: rgba(15, 15, 25, 0.95);
    border: 1px solid #FFD700;
    border-radius: 8px;
    padding: 8px 12px;
    color: #FFD700;
    font-size: 0.9rem;
    font-weight: bold;
    pointer-events: none;
    z-index: 1000;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: tooltipFadeIn 0.2s ease-out;
  }

  @keyframes tooltipFadeIn {
    from { 
      opacity: 0; 
      transform: translateY(-5px); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0); 
    }
  }

  .pyramid-svg {
    cursor: grab;
  }

  .pyramid-svg:active {
    cursor: grabbing;
  }

  /* Block styles */
  .block {
    transition: all 0.2s ease;
    stroke-width: 1px;
    stroke: #333;
    cursor: pointer;
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
    opacity: 0.8;
    cursor: not-allowed;
  }

  .block.hovered:not(.sold) {
    fill: #3a3a5a !important;
    filter: brightness(1.2);
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
    left: 20px;
    text-align: left;
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

  /* Center Controls */
  .center-controls {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
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

  .control-btn.fill-btn {
    border-color: #FF6B6B;
    color: #FF6B6B;
  }

  .control-btn.fill-btn:hover {
    background: rgba(255, 107, 107, 0.1);
    border-color: #FF7675;
    color: #FF7675;
    box-shadow: 0 0 15px rgba(255, 107, 107, 0.3);
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

  .control-btn.purchase {
    border-color: #4CAF50;
    color: #4CAF50;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05));
  }

  .control-btn.purchase:hover {
    background: rgba(76, 175, 80, 0.2);
    border-color: #66BB6A;
    color: #66BB6A;
    box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
  }

  /* Profile Button */
  .profile-btn {
    padding: 8px 16px;
    border: 2px solid #FFD700;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.05));
    color: #FFD700;
    font-size: 0.9rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 10px rgba(255, 215, 0, 0.2);
  }

  .profile-btn:hover {
    background: rgba(255, 215, 0, 0.2);
    border-color: #FFA500;
    color: #FFA500;
    box-shadow: 0 6px 25px rgba(255, 215, 0, 0.4);
    transform: translateY(-2px);
  }

  .profile-btn:active {
    transform: translateY(0);
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

  /* Unified Block Modal */
  .block-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: center;
    animation: fadeIn 0.2s ease-out;
  }

  .block-modal {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    width: 90%;
    max-width: 600px;
    border-radius: 20px;
    box-shadow: 
      0 25px 60px rgba(0,0,0,0.8),
      0 0 0 1px rgba(255, 215, 0, 0.2),
      inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    overflow: hidden;
    position: relative;
    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .modal-header {
    padding: 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: radial-gradient(circle at top, #1e1e2d 0%, var(--bg-panel) 100%);
  }

  .modal-header h2 {
    margin: 0;
    font-family: 'Georgia', serif;
    font-size: 1.5rem;
    color: white;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 5px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .modal-content {
    padding: 25px;
  }

  .block-info {
    text-align: center;
    margin-bottom: 25px;
  }

  .price-display {
    font-size: 2rem;
    font-weight: bold;
    color: #FFD700;
    margin-bottom: 10px;
  }

  .location {
    color: #888;
    margin-bottom: 15px;
  }

  .special-badge {
    background: rgba(255, 215, 0, 0.2);
    color: #FFD700;
    padding: 8px 16px;
    border-radius: 20px;
    border: 1px solid #FFD700;
    font-size: 0.9rem;
    display: inline-block;
  }

  .owner-section {
    text-align: center;
  }

  .owner-section h3 {
    margin-top: 0;
    color: white;
    margin-bottom: 20px;
  }

  /* Premium Profile Panel Styles */
  .premium-header {
    text-align: center;
    margin-bottom: 25px;
    position: relative;
  }

  .crown-icon {
    font-size: 2rem;
    margin-bottom: 10px;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  .owner-image-container {
    position: relative;
    width: 150px;
    height: 150px;
    margin: 0 auto 20px;
  }

  .image-frame {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid transparent;
    background: linear-gradient(45deg, #FFD700, #FFA500, #FFD700);
    padding: 3px;
    position: relative;
    z-index: 2;
  }

  .image-frame img,
  .default-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #1e1e2d;
  }

  .image-glow {
    position: absolute;
    top: -10px;
    left: -10px;
    right: -10px;
    bottom: -10px;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
    border-radius: 50%;
    z-index: 1;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  .owner-info {
    text-align: center;
  }

  .owner-name-wrapper {
    margin-bottom: 20px;
  }

  .owner-name {
    font-size: 1.8rem;
    color: white;
    font-weight: bold;
    margin-bottom: 5px;
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }

  .verification-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
    border: 1px solid #4CAF50;
  }

  .owner-message-container {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 15px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(255, 215, 0, 0.2);
  }

  .message-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .owner-message {
    color: #ddd;
    font-style: italic;
    font-size: 0.95rem;
    line-height: 1.4;
    text-align: left;
  }

  .owner-link-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    justify-content: center;
  }

  .link-icon {
    font-size: 1.2rem;
  }

  .owner-link {
    color: #4ECDC4;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.3s ease;
    border-bottom: 1px solid transparent;
  }

  .owner-link:hover {
    color: #45B7D1;
    border-bottom-color: #45B7D1;
  }

  .block-details {
    background: linear-gradient(135deg, rgba(30, 30, 45, 0.8), rgba(20, 20, 30, 0.8));
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 20px;
    border: 1px solid rgba(255, 215, 0, 0.1);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-label {
    color: #888;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .detail-value {
    color: white;
    font-weight: bold;
    font-size: 0.9rem;
  }

  .detail-value.gold {
    color: #FFD700;
    text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
  }

  .detail-value.gold {
    color: #FFD700;
  }

  .detail-value.silver {
    color: #C0C0C0;
  }

  .detail-value.standard {
    color: #888;
  }

  .color-display-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .premium-badges {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .purchased-badge.premium {
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1));
    color: #FFD700;
    padding: 12px 20px;
    border-radius: 25px;
    border: 2px solid #FFD700;
    font-size: 1rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
    animation: shimmer-badge 3s ease-in-out infinite;
  }

  @keyframes shimmer-badge {
    0%, 100% { box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3); }
    50% { box-shadow: 0 6px 25px rgba(255, 215, 0, 0.5); }
  }

  .badge-icon {
    font-size: 1.1rem;
  }

  .status-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(76, 175, 80, 0.1);
    color: #4CAF50;
    padding: 8px 16px;
    border-radius: 20px;
    border: 1px solid #4CAF50;
    font-size: 0.85rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4CAF50;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .purchase-section {
    text-align: center;
  }

  .purchase-section h3 {
    margin-top: 0;
    color: white;
    margin-bottom: 20px;
  }

  .selected-block-info {
    border-top: 1px solid var(--border);
    padding-top: 20px;
    margin-top: 20px;
  }

  .selected-block-info h3 {
    margin-top: 0;
    color: white;
  }

  .selected-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .price-display {
    font-size: 1.5rem;
    font-weight: bold;
    color: #FFD700;
  }

  .location {
    color: #888;
  }

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* Mobile Responsive Design */
  @media (max-width: 768px) {
    /* Header Responsive */
    .header {
      padding: 15px 20px;
      text-align: center;
    }

    .header h1 {
      font-size: 1.8rem;
      letter-spacing: 4px;
      margin-bottom: 8px;
      line-height: 1.2;
    }

    .subtitle {
      font-size: 0.8rem;
      letter-spacing: 2px;
    }

    /* Controls Responsive */
    .controls {
      top: 15px;
      right: 15px;
      gap: 8px;
    }

    .control-btn {
      padding: 8px 12px;
      font-size: 0.8rem;
      min-width: auto;
    }

    .center-controls {
      bottom: 20px;
      gap: 8px;
    }

    .center-controls .control-btn {
      padding: 8px 16px;
      font-size: 0.8rem;
    }

    /* Pyramid Container */
    .pyramid-container {
      height: calc(100vh - 120px);
      margin-top: 120px;
    }

    /* Legend Responsive */
    .legend {
      top: 15px;
      left: 15px;
      gap: 10px;
    }

    .legend-box {
      padding: 8px 12px;
      font-size: 0.7rem;
    }

    /* Instructions Responsive */
    .instructions {
      bottom: 15px;
      right: 15px;
      gap: 15px;
      font-size: 0.7rem;
    }

    /* Tooltip Responsive */
    .tooltip {
      right: 15px;
      padding: 15px;
      min-width: 150px;
    }

    .tooltip-price {
      font-size: 1.4rem;
    }

    /* Modal Responsive */
    .block-modal {
      width: 95%;
      max-width: 450px;
    }

    .modal-header {
      padding: 15px;
    }

    .modal-header h2 {
      font-size: 1.3rem;
    }

    .modal-body {
      padding: 15px;
    }

    .owner-image-container {
      width: 120px;
      height: 120px;
    }

    .owner-name {
      font-size: 1.5rem;
    }

    .block-details {
      padding: 15px;
    }

    .selected-details {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }

    .price-display {
      font-size: 1.3rem;
    }
  }

  /* Small Mobile (under 480px) */
  @media (max-width: 480px) {
    /* Extra Small Header */
    .header {
      padding: 10px 15px;
    }

    .header h1 {
      font-size: 1.5rem;
      letter-spacing: 2px;
      margin-bottom: 5px;
    }

    .subtitle {
      font-size: 0.7rem;
      letter-spacing: 1px;
    }

    /* Compact Controls */
    .controls {
      top: 10px;
      right: 10px;
      gap: 5px;
    }

    .control-btn {
      padding: 6px 10px;
      font-size: 0.7rem;
    }

    .center-controls {
      bottom: 15px;
      gap: 5px;
    }

    .center-controls .control-btn {
      padding: 6px 12px;
      font-size: 0.7rem;
    }

    /* Maximum Pyramid Space */
    .pyramid-container {
      height: calc(100vh - 100px);
      margin-top: 100px;
    }

    /* Compact Legend */
    .legend {
      top: 10px;
      left: 10px;
      gap: 8px;
    }

    .legend-box {
      padding: 6px 10px;
      font-size: 0.65rem;
    }

    /* Hide Instructions on Small Screens */
    .instructions {
      display: none;
    }

    /* Smaller Modal */
    .block-modal {
      width: 98%;
      max-width: 380px;
    }

    .modal-header {
      padding: 12px;
    }

    .modal-header h2 {
      font-size: 1.2rem;
    }

    .modal-body {
      padding: 12px;
    }

    .owner-image-container {
      width: 100px;
      height: 100px;
    }

    .owner-name {
      font-size: 1.3rem;
    }

    .block-details {
      padding: 12px;
    }

    .crown-icon {
      font-size: 1.5rem;
    }

    .tooltip {
      display: none; /* Hide tooltip on very small screens */
    }
  }
</style>
