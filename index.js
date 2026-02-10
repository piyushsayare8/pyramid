import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// --- 1. GLOBAL CONFIGURATION ---
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'ETag'],
  maxAge: 86400,
}))

// --- 2. THE AUTOMATION ENGINE (Auto-Build & Cache) ---

// This function runs automatically if the system detects it's empty
async function ensureSystemReady(env) {
  // A. Create Table (Safe to run every time)
  try {
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS slots (
        slot_number INTEGER PRIMARY KEY,
        price REAL,
        status TEXT DEFAULT 'available',
        owner_name TEXT, 
        owner_message TEXT, 
        owner_color TEXT, 
        owner_text TEXT,
        payment_id TEXT, 
        updated_at DATETIME
      );
      CREATE INDEX IF NOT EXISTS idx_status ON slots(status);
    `)
  } catch (error) {
    console.error('Table creation error:', error)
  }

  // B. Check if data exists. If not, fill it.
  const check = await env.DB.prepare("SELECT slot_number FROM slots WHERE slot_number = 1").first()
  
  if (!check) {
    console.log("System empty. Seeding database...")
    const stmt = env.DB.prepare("INSERT OR IGNORE INTO slots (slot_number, price) VALUES (?, ?)")
    const TOTAL_SLOTS = 10011
    
    // Insert in chunks of 100 to prevent timeouts
    for (let i = 1; i <= TOTAL_SLOTS; i += 100) {
      const batch = []
      for (let j = i; j < i + 100 && j <= TOTAL_SLOTS; j++) {
        // Pricing Logic: 0.1 increment per slot (matching frontend)
        const price = 0.1 + ((j - 1) * 0.1)
        batch.push(stmt.bind(j, price))
      }
      await env.DB.batch(batch)
    }
  }

  // C. Build the initial Cache File
  await rebuildCdnCache(env)
}

// Helper: Rebuild Global JSON Cache (The O(1) Secret)
async function rebuildCdnCache(env) {
  const { results } = await env.DB.prepare(`
    SELECT slot_number, status, owner_color, owner_text, price 
    FROM slots ORDER BY slot_number ASC
  `).all()

  // Save to R2 with Headers for Cloudflare Edge
  await env.BUCKET.put('grid.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalSlots: results.length,
    soldCount: results.filter(s => s.status === 'sold').length,
    slots: results
  }), {
    httpMetadata: { 
      contentType: 'application/json', 
      cacheControl: 'public, max-age=10, s-maxage=60' 
    }
  })
}

// --- 3. API ROUTES ---

/**
 * GET /api/grid
 * The Trigger: If cache is missing, it wakes up the system.
 */
app.get('/api/grid', async (c) => {
  const file = await c.env.BUCKET.get('grid.json')
  
  // AUTOMATION: If cache is missing, the system is new. Build it now.
  if (!file) {
    // Run auto-setup in background. Tell user to refresh.
    c.executionCtx.waitUntil(ensureSystemReady(c.env))
    return c.json({ status: "initializing", message: "System is building itself. Please refresh in 3 seconds." }, 503)
  }

  c.header('ETag', file.httpMetadata?.etag)
  c.header('Cache-Control', 'public, max-age=10, s-maxage=60')
  c.header('Content-Type', 'application/json')
  
  return c.body(file.body)
})

/**
 * POST /api/create-order
 */
app.post('/api/create-order', async (c) => {
  try {
    const { slotId } = await c.req.json()
    
    // Safety: Ensure table exists before querying (Just in case)
    await c.env.DB.exec("CREATE TABLE IF NOT EXISTS slots (slot_number INTEGER PRIMARY KEY)")

    const slot = await c.env.DB.prepare("SELECT price, status FROM slots WHERE slot_number = ?").bind(slotId).first()
    
    if (!slot) return c.json({ error: "Slot not found" }, 404)
    if (slot.status === 'sold') return c.json({ error: "Slot already sold" }, 409)

    // Razorpay Call
    const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(slot.price * 100), // Convert to cents for USD
        currency: "USD",
        receipt: `slot_${slotId}_${Date.now()}`
      })
    })

    const orderData = await response.json()
    if (orderData.error) throw new Error(orderData.error.description)
    return c.json(orderData)
  } catch (e) {
    return c.json({ error: "Order creation failed" }, 500)
  }
})

/**
 * POST /api/purchase
 */
app.post('/api/purchase', async (c) => {
  try {
    const { slotId, userData } = await c.req.json()

    // TEMPORARY: Skip payment verification for testing
    console.log(" TEST MODE: Skipping payment verification for slot", slotId)
    
    // 1. Validation
    if (!userData || userData.text.length > 100) return c.json({ error: "Text too long" }, 400)
    
    // 2. Skip Signature Verification (TEST MODE)
    // const text = `${razorpay_order_id}|${razorpay_payment_id}`
    // const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(c.env.RAZORPAY_KEY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    // const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))
    // const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    
    // if (expected !== razorpay_signature) return c.json({ error: "Invalid Signature" }, 401)

    // 3. Atomic Update (TEST MODE - Direct Save)
    const result = await c.env.DB.prepare(`
      UPDATE slots SET 
        status = 'sold', owner_name = ?, owner_message = ?, owner_color = ?, owner_text = ?, payment_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE slot_number = ? AND status = 'available'
    `).bind(userData.name, userData.message, userData.color, userData.text, `TEST_${Date.now()}`, slotId).run()

    if (result.meta.changes === 0) return c.json({ error: "Slot taken" }, 409)

    // 4. Background Cache Update (Instant User Response)
    c.executionCtx.waitUntil(rebuildCdnCache(c.env))

    return c.json({ success: true, testMode: true, message: "Data saved without payment verification" })
  } catch (e) {
    return c.json({ error: "Processing failed", details: e.message }, 500)
  }
})

export default app