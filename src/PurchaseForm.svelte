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

  // --- 2. PROPS & STATE ---
  export let slotId;   
  export let price;    

  const dispatch = createEventDispatcher();

  let name = '';
  let message = '';
  let link = '';
  let files;
  let previewUrl = null;
  let isSubmitting = false;
  let errorMessage = '';

  const MAX_MSG_CHARS = 50; 
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  // --- 3. LOGIC ---
  
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert("Image must be smaller than 2MB");
        files = null;
        return;
      }
      previewUrl = URL.createObjectURL(file);
    }
  }

  // STEP 1: Open Razorpay Popup
  async function initiatePurchase() {
    if (isSubmitting) return;
    isSubmitting = true;
    errorMessage = '';

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
      // Call SST backend to process the purchase
      const response = await fetch(`${apiUrl}/api/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slotId,
          user: name || 'Anonymous',
          message: message || '',
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
        message 
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

      <div class="upload-section">
        <label class="upload-box {previewUrl ? 'has-image' : ''}">
          {#if previewUrl}
            <img src={previewUrl} alt="Preview" />
            <div class="overlay">Change Image</div>
          {:else}
            <div class="icon">📷</div>
            <span>Upload Image</span>
            <small>Max 2MB</small>
          {/if}
          <input type="file" accept="image/*" bind:files on:change={handleFileChange} />
        </label>
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
    background: var(--bg-panel);
    border: 1px solid var(--border);
    width: 90%; max-width: 600px;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.7);
    overflow: hidden;
    position: relative;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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

  /* --- BODY --- */
  .form-body {
    padding: 25px;
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 20px;
  }

  /* Inputs */
  .input-group { margin-bottom: 15px; position: relative; }
  
  label { 
    display: block; font-size: 0.8rem; color: var(--text-muted); 
    margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase;
  }

  input {
    width: 100%;
    background: #0a0a0f;
    border: 1px solid var(--border);
    color: white;
    padding: 12px;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s;
    box-sizing: border-box; /* Fix padding issues */
  }

  input:focus {
    outline: none;
    border-color: var(--gold);
    box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
  }

  .char-count {
    position: absolute; right: 0; bottom: -18px;
    font-size: 0.7rem; color: #444;
  }

  /* Upload Box */
  .upload-box {
    width: 100%; height: 100%; min-height: 180px;
    border: 2px dashed var(--border);
    border-radius: 12px;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    cursor: pointer;
    background: rgba(255,255,255,0.02);
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }

  .upload-box:hover { border-color: #666; background: rgba(255,255,255,0.05); }
  
  .upload-box input { display: none; }
  
  .upload-box .icon { font-size: 2rem; margin-bottom: 10px; opacity: 0.7; }
  .upload-box span { color: var(--text-muted); font-size: 0.9rem; }
  .upload-box small { color: #444; font-size: 0.7rem; margin-top: 5px; }

  /* Image Preview State */
  .upload-box.has-image { border-style: solid; border-color: var(--gold); padding: 0; }
  .upload-box img { width: 100%; height: 100%; object-fit: cover; }
  .upload-box .overlay {
    position: absolute; bottom: 0; left: 0; width: 100%;
    background: rgba(0,0,0,0.7); color: white;
    text-align: center; padding: 8px; font-size: 0.8rem;
    transform: translateY(100%); transition: transform 0.2s;
  }
  .upload-box:hover .overlay { transform: translateY(0); }

  /* --- FOOTER --- */
  .modal-footer {
    padding: 20px 25px;
    border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 15px;
    background: #0f0f15;
  }

  .btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    border: none;
    font-weight: 600;
  }

  .btn.cancel {
    background: transparent;
    color: var(--text-muted);
  }
  .btn.cancel:hover { color: white; }

  .btn.confirm {
    background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
    color: #000;
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
    transition: transform 0.1s;
  }
  .btn.confirm:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4); }
  .btn.confirm:active { transform: translateY(0); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

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
    .upload-box { min-height: 120px; }
  }
</style>