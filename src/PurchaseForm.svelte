<svelte:head>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</svelte:head>

<script>
  import { createEventDispatcher } from 'svelte';

  // --- 1. CONFIGURATION ---
  export let apiUrl;

  // ⚠️ RAZORPAY CONFIGURATION
  // Use "rzp_test_..." for development/testing.
  // Switch to "rzp_live_..." ONLY when you launch real production.
  const RAZORPAY_KEY_ID = 'rzp_test_YOUR_KEY_HERE'; 
  
  // 🧪 TEST MODE - Set to true to skip payment and backend for testing
  const TEST_MODE = true;
  const LOCAL_TEST_MODE = true; // Full local testing without Cloudflare 

  // --- 2. PROPS & STATE ---
  export let slotId;   
  export let price;    

  const dispatch = createEventDispatcher();

  let name = '';
  let message = '';
  let link = '';
  let selectedColor = '#FFD700';
  let selectedText = '';
  let selectedFont = 'Arial';
  let selectedImageUrl = '';
  let isSubmitting = false;
  let errorMessage = '';

  const MAX_MSG_CHARS = 50; 
  const MAX_TEXT_CHARS = 80;

  // Font options for users to choose from
  const fontOptions = [
    { name: 'Arial', value: 'Arial', style: 'sans-serif' },
    { name: 'Georgia', value: 'Georgia', style: 'serif' },
    { name: 'Courier New', value: 'Courier New', style: 'monospace' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS', style: 'cursive' },
    { name: 'Impact', value: 'Impact', style: 'sans-serif' },
    { name: 'Verdana', value: 'Verdana', style: 'sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman', style: 'serif' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS', style: 'sans-serif' },
    { name: 'Lucida Console', value: 'Lucida Console', style: 'monospace' },
    { name: 'Tahoma', value: 'Tahoma', style: 'sans-serif' }
  ];

  // Color palette for users to choose from
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

  // Get border style based on row number (matching App.svelte logic)
  function getBorderStyle(row) {
    if (row <= 45) return 'gold';      // Row 1-45 = gold
    if (row <= 85) return 'silver';   // Row 46-85 = silver  
    return 'standard';                 // Row 86-100 = standard
  }

  // Get border gradient based on style (matching App.svelte)
  function getBorderGradient(style) {
    if (style === 'gold') return 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)';
    if (style === 'silver') return 'linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 50%, #C0C0C0 100%)';
    return '#444';
  }

  // Get border width based on style (matching App.svelte)
  function getBorderWidth(style) {
    if (style === 'gold') return '3px';
    if (style === 'silver') return '2px';
    return '1px';
  }

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

  // Calculate inner content area (excluding borders)
  function getInnerDimensions(borderStyle) {
    const borderWidth = getBorderWidth(borderStyle);
    const borderPixels = parseInt(borderWidth);
    return {
      width: 38 - (borderPixels * 2), // 38px total - borders on both sides
      height: 38 - (borderPixels * 2)  // 38px total - borders on both sides
    };
  }

  // Calculate text wrapping and line breaks
  function wrapText(text, maxWidth, fontSize, fontFamily) {
    if (!text) return [];
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    // Create a temporary element to measure text width
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontSize}px ${fontFamily}`;
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = context.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  function handleColorSelect(color) {
    selectedColor = color;
  }

  function handleTextChange(e) {
    const value = e.target.value;
    if (value.length <= MAX_TEXT_CHARS) {
      selectedText = value;
    }
  }

  // Handle image upload
  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      errorMessage = 'Invalid file type. Please use JPEG, PNG, WebP, or GIF images.';
      return;
    }

    // Validate file size (5MB max for free tier optimization)
    if (file.size > 5 * 1024 * 1024) {
      errorMessage = 'File too large. Maximum size is 5MB.';
      return;
    }

    try {
      // In test mode, just create a fake URL
      if (TEST_MODE) {
        const fakeUrl = `https://picsum.photos/seed/${Math.random().toString(36).substr(2, 9)}/150/150.jpg`;
        selectedImageUrl = fakeUrl;
        return;
      }

      // Create FormData for upload
      const formData = new FormData();
      formData.append('image', file);

      // Upload to backend
      const response = await fetch(`${apiUrl}/api/upload-image`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          selectedImageUrl = result.imageUrl;
          console.log('Image uploaded successfully:', result.imageUrl);
        } else {
          errorMessage = result.error || 'Image upload failed';
        }
      } else {
        errorMessage = 'Image upload failed. Please try again.';
      }
    } catch (error) {
      console.error('Image upload error:', error);
      errorMessage = 'Image upload failed. Please try again.';
    }
  }

  // STEP 1: Open Razorpay Popup (or skip in test mode)
  async function initiatePurchase() {
    if (isSubmitting) return;
    isSubmitting = true;
    errorMessage = '';

    // TEST MODE - Skip payment and go directly to finalization
    if (TEST_MODE) {
      console.log('TEST MODE: Skipping payment, proceeding directly...');
      // Use a fake payment ID for testing
      const fakePaymentId = `test_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      finalizePurchase(fakePaymentId);
      return;
    }

    const options = {
      "key": RAZORPAY_KEY_ID, 
      "amount": price * 100, // Amount is in paise (cents)
      "currency": "USD", // Change to "INR" if using Indian Rupees
      "name": "The Pyramid",
      "description": `Claiming Block #${slotId}`,
      "image": "https://your-website.com/logo.png", // Optional: Add your logo URL here
      "handler": function (response) {
        // Payment Success! Now we save to DB.
        finalizePurchase(response.razorpay_payment_id);
      },
      "prefill": {
        "name": name || "Anonymous",
      },
      "theme": {
        "color": "#FFD700"
      },
      "modal": {
        "ondismiss": function() {
          isSubmitting = false;
        }
      }
    };

    try {
      const rzp1 = new Razorpay(options);
      rzp1.on('payment.failed', function (response){
          errorMessage = "Payment Failed: " + response.error.description;
          isSubmitting = false;
      });
      rzp1.open();
    } catch (e) {
      errorMessage = "Could not load payment gateway. Check connection.";
      isSubmitting = false;
    }
  }

  // STEP 2: Save Data to Backend (Only after payment)
  async function finalizePurchase(paymentId) {
    try {
      // LOCAL TEST MODE - Mock backend response without Cloudflare
      if (LOCAL_TEST_MODE) {
        console.log(' LOCAL TEST MODE: Mocking backend response...');
        
        // Simulate network delay for realism
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate successful backend response
        const mockResponse = { success: true };
        
        // Success! Dispatch event with mock data
        dispatch('success', { 
          slotId, 
          owner: name || 'Anonymous', 
          message,
          color: selectedColor,
          text: selectedText || (slotId % 1000).toString(),
          font: selectedFont,
          imageUrl: selectedImageUrl
        });
        
        console.log(' Local test purchase completed successfully!');
        return;
      }

      // REAL BACKEND - Call SST backend to process the purchase
      const response = await fetch(`${apiUrl}/api/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slotId,
          user: name || 'Anonymous',
          message: message || '',
          color: selectedColor,
          text: selectedText || (slotId % 1000).toString(),
          paymentId
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Purchase failed');
      }

      // Success! Dispatch event
      dispatch('success', { 
        slotId, 
        owner: name || 'Anonymous', 
        message,
        color: selectedColor,
        text: selectedText || (slotId % 1000).toString(),
        font: selectedFont
      });

    } catch (error) {
      console.error("Purchase error:", error);
      errorMessage = error.message || "Transaction failed.";
    } finally {
      isSubmitting = false;
    }
  }

  function close() {
    dispatch('close');
  }
</script>

<div class="backdrop" on:click|self={close}>
  <div class="modal">
    
    <div class="modal-header">
      <h2>Claim Block <span class="gold">#{slotId}</span></h2>
      <div class="price-tag">
        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price)}
      </div>
      {#if TEST_MODE}
        <div class="test-mode-badge">
          {#if LOCAL_TEST_MODE}
            🏠 LOCAL TEST
          {:else}
            🧪 TEST MODE
          {/if}
        </div>
      {/if}
    </div>

    {#if errorMessage}
      <div class="error-banner">{errorMessage}</div>
    {/if}

    <div class="form-body">
      
      <div class="inputs-section">
        <div class="input-group">
          <label>Name / Alias</label>
          <input type="text" bind:value={name} placeholder="Enter your name" maxlength="30" />
        </div>

        <div class="input-group">
          <label>Message (Legacy)</label>
          <input type="text" bind:value={message} placeholder="Make history..." maxlength={MAX_MSG_CHARS} />
          <div class="char-count">{message.length}/{MAX_MSG_CHARS}</div>
        </div>

        <div class="input-group">
          <label>Link (Optional)</label>
          <input type="url" bind:value={link} placeholder="https://twitter.com/..." />
        </div>
      </div>

      <div class="customization-section">
        <div class="input-group">
          <label>Choose Your Color</label>
          <div class="color-selector">
            <div class="color-input-wrapper">
              <input 
                type="color" 
                bind:value={selectedColor} 
                class="color-picker"
                id="color-picker"
              />
              <label for="color-picker" class="color-picker-label">
                <div class="color-display" style="background-color: {selectedColor}"></div>
                <span class="color-value">{selectedColor}</span>
              </label>
            </div>
            <div class="color-presets">
              <span class="presets-label">Quick Colors:</span>
              {#each ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#B983FF', '#FD79A8'] as presetColor}
                <button 
                  class="color-preset {selectedColor === presetColor ? 'selected' : ''}"
                  style="background-color: {presetColor}"
                  on:click={() => selectedColor = presetColor}
                  title={presetColor}
                />
              {/each}
            </div>
          </div>
        </div>

        <div class="input-group">
          <label>Your Text (max {MAX_TEXT_CHARS} chars)</label>
          <input 
            type="text" 
            bind:value={selectedText} 
            maxlength={MAX_TEXT_CHARS}
            placeholder="Write anything..." 
            on:input={handleTextChange}
          />
          <div class="char-count">{selectedText.length}/{MAX_TEXT_CHARS}</div>
        </div>

        <div class="input-group">
          <label>Choose Your Font</label>
          <div class="font-selector">
            <select bind:value={selectedFont} class="font-select">
              {#each fontOptions as font}
                <option value={font.value}>{font.name}</option>
              {/each}
            </select>
            <div class="font-preview" style="font-family: {selectedFont}, {fontOptions.find(f => f.value === selectedFont)?.style || 'sans-serif'}">
              {selectedText || 'Sample Text'}
            </div>
          </div>
        </div>

        <div class="input-group">
          <label>Profile Image (Optional)</label>
          <div class="image-upload-section">
            <div class="image-upload-wrapper">
              <input 
                type="file" 
                accept="image/*"
                on:change={handleImageUpload}
                class="image-input"
                id="profile-image-input"
              />
              <label for="profile-image-input" class="image-upload-label">
                <div class="upload-icon">📷</div>
                <span class="upload-text">
                  {selectedImageUrl ? 'Change Image' : 'Upload Profile Image'}
                </span>
              </label>
            </div>
            {#if selectedImageUrl}
              <div class="image-preview">
                <img 
                  src={selectedImageUrl} 
                  alt="Profile preview"
                  on:error={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div class="image-error" style="display: none;">
                  ❌ Failed to load image
                </div>
                <button 
                  type="button" 
                  class="remove-image-btn"
                  on:click={() => selectedImageUrl = ''}
                >
                  Remove
                </button>
              </div>
            {/if}
          </div>
        </div>

        <div class="preview-section">
          <label>Preview</label>
          <div class="block-preview">
            <div class="preview-block" 
                 style="background-color: {selectedColor}; 
                        border: {getBorderWidth(getBorderStyle(Math.ceil(slotId / 51)))} {getBorderGradient(getBorderStyle(Math.ceil(slotId / 51)))};
                        opacity: 0.8;
                        width: 38px;
                        height: 38px;
                        position: relative;">
              <div class="preview-inner-content"
                   style="position: absolute;
                          top: {getBorderWidth(getBorderStyle(Math.ceil(slotId / 51)))};
                          left: {getBorderWidth(getBorderStyle(Math.ceil(slotId / 51)))};
                          width: {getInnerDimensions(getBorderStyle(Math.ceil(slotId / 51))).width}px;
                          height: {getInnerDimensions(getBorderStyle(Math.ceil(slotId / 51))).height}px;
                          display: flex;
                          flex-direction: column;
                          align-items: center;
                          justify-content: center;
                          overflow: hidden;">
                {#if selectedText}
                  {@const fontSize = calculateTextSize(selectedText)}
                  {@const fontFamily = selectedFont + ', ' + (fontOptions.find(f => f.value === selectedFont)?.style || 'sans-serif')}
                  {@const maxWidth = getInnerDimensions(getBorderStyle(Math.ceil(slotId / 51))).width}
                  {@const lines = wrapText(selectedText, maxWidth, fontSize, fontFamily)}
                  {@const lineHeight = fontSize * 1.2}
                  {@const totalHeight = lines.length * lineHeight}
                  {@const adjustedLineHeight = Math.min(lineHeight, getInnerDimensions(getBorderStyle(Math.ceil(slotId / 51))).height / lines.length)}
                  
                  {#each lines as line, i}
                    <div class="preview-text-line"
                         style="font-family: {fontFamily};
                                font-size: {fontSize}px;
                                text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
                                text-align: center;
                                line-height: {adjustedLineHeight}px;
                                white-space: nowrap;
                                overflow: hidden;">
                      {line}
                    </div>
                  {/each}
                {:else}
                  <span class="preview-text" 
                        style="font-family: {selectedFont}, {fontOptions.find(f => f.value === selectedFont)?.style || 'sans-serif'};
                               font-size: 12px;
                               text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
                               text-align: center;">
                    {slotId % 1000}
                  </span>
                {/if}
              </div>
            </div>
            <div class="preview-info">
              <span class="preview-label">Row {Math.ceil(slotId / 51)}</span>
              <span class="preview-label">{getBorderStyle(Math.ceil(slotId / 51)).toUpperCase()} TIER</span>
              <span class="preview-label">{selectedText.length}/{MAX_TEXT_CHARS}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn cancel" on:click={close} disabled={isSubmitting}>Cancel</button>
      
      <button class="btn confirm" on:click={initiatePurchase} disabled={isSubmitting}>
        {#if isSubmitting}
          Processing...
        {:else}
          Buy & Mint
        {/if}
      </button>
    </div>

  </div>
</div>

<style>
  /* --- THEME --- */
  :root {
    --bg-dark: #0a0a0f;
    --bg-panel: #151520;
    --border: #333;
    --gold: #FFD700;
    --text-main: #fff;
    --text-muted: #888;
  }

  /* --- LAYOUT --- */
  .backdrop {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    z-index: 100;
    display: flex; justify-content: center; align-items: center;
    animation: fadeIn 0.2s ease-out;
  }

  .modal {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border: 2px solid transparent;
    background-clip: padding-box;
    width: 95%; max-width: 1200px;
    max-height: 90vh;
    border-radius: 24px;
    box-shadow: 
      0 25px 60px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 215, 0, 0.1),
      inset 0 0 0 1px rgba(255, 255, 255, 0.05);
    overflow: hidden;
    position: relative;
    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .modal::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #FFD700, #FFA500, #FFD700);
    animation: shimmer 3s infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  /* --- HEADER --- */
  .modal-header {
    padding: 25px;
    border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center;
    background: radial-gradient(circle at top, #1e1e2d 0%, var(--bg-panel) 100%);
  }

  h2 { margin: 0; font-family: 'Georgia', serif; font-size: 1.5rem; color: white; }
  .gold { color: var(--gold); text-shadow: 0 0 10px rgba(255, 215, 0, 0.3); }
  
  .price-tag {
    background: rgba(255, 215, 0, 0.1);
    color: var(--gold);
    padding: 5px 15px;
    border-radius: 20px;
    border: 1px solid var(--gold);
    font-weight: bold;
    font-family: monospace;
    font-size: 1.1rem;
  }

  .test-mode-badge {
    background: rgba(76, 175, 80, 0.2);
    color: #4CAF50;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid #4CAF50;
    font-size: 0.8rem;
    font-weight: bold;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* --- BODY --- */
  .form-body {
    padding: 30px;
    display: flex;
    gap: 40px;
    max-height: 70vh;
    overflow-y: auto;
  }

  .inputs-section {
    flex: 1.5;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  .customization-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 25px;
    min-width: 0;
  }

  /* Inputs */
  .input-group { margin-bottom: 15px; position: relative; }
  
  label { 
    display: block; font-size: 0.8rem; color: var(--text-muted); 
    margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase;
  }

  input {
    width: 100%;
    background: linear-gradient(135deg, rgba(10, 10, 15, 0.9), rgba(20, 20, 30, 0.9));
    border: 2px solid rgba(51, 51, 51, 0.6);
    color: white;
    padding: 15px 18px;
    border-radius: 12px;
    font-size: 1rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-sizing: border-box;
    backdrop-filter: blur(10px);
  }

  input:focus {
    outline: none;
    border-color: var(--gold);
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.05), rgba(10, 10, 15, 0.9));
    box-shadow: 
      0 0 0 3px rgba(255, 215, 0, 0.1),
      0 8px 25px rgba(255, 215, 0, 0.15);
    transform: translateY(-2px);
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }

  .char-count {
    position: absolute; right: 0; bottom: -18px;
    font-size: 0.7rem; color: #444;
  }

  /* Color Selector */
  .color-selector {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .color-input-wrapper {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  .color-picker {
    width: 60px;
    height: 60px;
    border: 2px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    background: none;
    padding: 0;
    transition: all 0.2s ease;
  }

  .color-picker:hover {
    border-color: var(--gold);
    transform: scale(1.05);
  }

  .color-picker-label {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    flex: 1;
  }

  .color-display {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    transition: all 0.2s ease;
  }

  .color-value {
    font-family: monospace;
    font-size: 1rem;
    color: var(--gold);
    font-weight: bold;
    text-transform: uppercase;
  }

  .color-presets {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .presets-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-right: 5px;
  }

  .color-preset {
    width: 30px;
    height: 30px;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .color-preset:hover {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }

  .color-preset.selected {
    border-color: white;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
  }

  .color-preset.selected::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-weight: bold;
    font-size: 12px;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
  }

  /* Font Selector */
  .font-selector {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .font-select {
    width: 100%;
    background: #0a0a0f;
    border: 1px solid var(--border);
    color: white;
    padding: 12px;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  .font-select:focus {
    outline: none;
    border-color: var(--gold);
    box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
  }

  .font-preview {
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid var(--border);
    text-align: center;
    font-size: 1.2rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
  }

  .preview-section {
    margin-top: 20px;
  }

  .block-preview {
    display: flex;
    justify-content: center;
    padding: 20px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    border: 1px solid var(--border);
  }

  .preview-block {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
    color: white;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
    opacity: 0.8;
  }

  .preview-text {
    font-size: 12px;
    font-weight: bold;
    text-align: center;
    word-break: break-all;
    max-width: 30px;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
  }

  .preview-info {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .preview-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .preview-label:first-child {
    color: #FFD700;
  }

  .preview-label:last-child {
    color: #C0C0C0;
  }

  /* Image Upload */
  .image-upload-section {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .image-upload-wrapper {
    position: relative;
  }

  .image-input {
    display: none;
  }

  .image-upload-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px dashed var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .image-upload-label:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--gold);
  }

  .upload-icon {
    font-size: 1.5rem;
  }

  .upload-text {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .image-preview {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .image-preview img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--gold);
  }

  .image-error {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ff4444;
    font-size: 0.8rem;
  }

  .remove-image-btn {
    padding: 5px 10px;
    background: rgba(255, 68, 68, 0.2);
    color: #ff4444;
    border: 1px solid #ff4444;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .remove-image-btn:hover {
    background: rgba(255, 68, 68, 0.3);
  }

  /* --- FOOTER --- */
  .modal-footer {
    padding: 25px 30px;
    border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 20px;
    background: linear-gradient(135deg, rgba(15, 15, 25, 0.9), rgba(10, 10, 15, 0.9));
    backdrop-filter: blur(10px);
  }

  .btn {
    padding: 15px 30px;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-transform: uppercase;
    letter-spacing: 1px;
    position: relative;
    overflow: hidden;
  }

  .btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  .btn:hover::before {
    left: 100%;
  }

  .btn.cancel {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .btn.cancel:hover { 
    color: white; 
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
  }

  .btn.confirm {
    background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%);
    color: #000;
    font-weight: 700;
    border: 2px solid transparent;
    box-shadow: 
      0 8px 30px rgba(255, 215, 0, 0.4),
      inset 0 0 0 1px rgba(255, 255, 255, 0.3);
  }

  .btn.confirm:hover { 
    transform: translateY(-3px) scale(1.02); 
    box-shadow: 
      0 12px 40px rgba(255, 215, 0, 0.6),
      inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  }

  .btn.confirm:active { 
    transform: translateY(-1px) scale(1.01); 
  }

  .btn:disabled { 
    opacity: 0.5; 
    cursor: not-allowed; 
    transform: none; 
    box-shadow: none;
  }

  .error-banner {
    background: rgba(255, 0, 0, 0.15);
    color: #ff4444;
    padding: 10px 25px;
    font-size: 0.9rem;
    text-align: center;
    border-bottom: 1px solid rgba(255, 0, 0, 0.2);
  }

  /* --- ANIMATIONS --- */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  /* Mobile Responsive */
  @media (max-width: 600px) {
    .form-body { grid-template-columns: 1fr; }
    .color-palette { grid-template-columns: repeat(4, 1fr); }
    .preview-block { width: 50px; height: 50px; font-size: 1rem; }
  }
</style>