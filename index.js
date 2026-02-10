import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// --- CONFIGURATION ---
const TOTAL_SLOTS = 10011
const CACHE_TTL = 60 // Browser Cache: 60 seconds
const R2_CACHE_TTL = 3600 // Edge Cache: 1 hour (Super efficient)

// --- MIDDLEWARE ---
app.use('/*', cors({
  origin: '*', // CHANGE THIS to your actual domain in production
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'ETag'],
  maxAge: 86400,
}))

// --- 1. CORE FUNCTIONS ---

/**
 * Calculates price mathematically. 
 * Formula: $0.10 base + $0.10 per slot index
 * Example: Slot 1 = $0.10, Slot 100 = $10.00
 */
const getSlotPrice = (id) => 0.1 + ((id - 1) * 0.1)

/**
 * The "Static Site Generator"
 * Dumps the DB state to a JSON file on R2.
 * Includes ALL profile data (Images, Links, etc.) so nothing is missing.
 */
async function rebuildCdnCache(env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        slot_number, 
        owner_name, 
        owner_message, 
        owner_color, 
        owner_text, 
        image_url, 
        link_url, 
        link_description
      FROM slots 
      WHERE status = 'sold'
    `).all()

    const data = {
      generatedAt: new Date().toISOString(),
      totalSlots: TOTAL_SLOTS,
      soldCount: results.length,
      soldSlots: results 
    }

    // Save to R2 with long cache headers
    // This makes the file "Immortal" on the Edge
    await env.BUCKET.put('grid.json', JSON.stringify(data), {
      httpMetadata: { 
        contentType: 'application/json',
        cacheControl: `public, max-age=${CACHE_TTL}, s-maxage=${R2_CACHE_TTL}`
      }
    })
    console.log(`Cache rebuilt with ${results.length} slots.`);
  } catch (e) {
    console.error("Cache rebuild critical error:", e);
  }
}

// --- 2. API ROUTES ---

/**
 * GET /api/grid
 * Serves the static JSON from R2. 
 * Cost: Almost $0. Speed: O(1).
 */
app.get('/api/grid', async (c) => {
  let file = await c.env.BUCKET.get('grid.json')
  
  // Self-Healing: If R2 is empty (first run), build it automatically
  if (!file) {
    await ensureTableExists(c.env.DB)
    await rebuildCdnCache(c.env)
    file = await c.env.BUCKET.get('grid.json')
  }

  if (!file) return c.json({ error: "Initializing system..." }, 503)

  c.header('ETag', file.httpMetadata?.etag)
  c.header('Cache-Control', `public, max-age=${CACHE_TTL}, s-maxage=${R2_CACHE_TTL}`)
  c.header('Content-Type', 'application/json')
  
  return c.body(file.body)
})

/**
 * POST /api/create-order
 * PURE USD - Leverages Razorpay's Native Conversion
 */
app.post('/api/create-order', async (c) => {
  try {
    const { slotId } = await c.req.json()
    const id = parseInt(slotId)

    if (isNaN(id) || id < 1 || id > TOTAL_SLOTS) return c.json({ error: "Invalid ID" }, 400)

    // Check DB (Fast Read) to prevent double-booking before payment
    const existing = await c.env.DB.prepare("SELECT 1 FROM slots WHERE slot_number = ? AND status = 'sold'").first()
    if (existing) return c.json({ error: "Slot already taken" }, 409)

    // --- LOGIC: DIRECT USD ---
    const usdPrice = getSlotPrice(id)
    const amountInCents = Math.round(usdPrice * 100) // Razorpay expects cents (e.g., $1.00 -> 100)

    // Razorpay Auth
    const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)
    
    // Create Order in USD
    // Razorpay will handle showing INR/UPI to Indian users automatically
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInCents,
        currency: "USD", 
        receipt: `slot_${id}_${Date.now()}`,
        notes: { slot_number: id }
      })
    })

    const order = await rzpRes.json()
    if (order.error) throw new Error(order.error.description)

    return c.json(order)
  } catch (e) {
    console.error("Order Creation Error:", e)
    return c.json({ error: "Order failed" }, 500)
  }
})

/**
 * POST /api/purchase
 * The only "Heavy" operation. Verifies payment & updates DB/Cache.
 */
app.post('/api/purchase', async (c) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, slotId, userData } = await c.req.json()

    // 1. Signature Verification (Security)
    if (c.env.RAZORPAY_KEY_SECRET) {
      const text = `${razorpay_order_id}|${razorpay_payment_id}`
      const key = await crypto.subtle.importKey(
        'raw', 
        new TextEncoder().encode(c.env.RAZORPAY_KEY_SECRET), 
        { name: 'HMAC', hash: 'SHA-256' }, 
        false, 
        ['sign']
      )
      const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))
      const expected = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
      
      if (expected !== razorpay_signature) return c.json({ error: "Invalid Payment Signature" }, 401)
    }

    // 2. Data Validation
    if (!userData || userData.text?.length > 150) return c.json({ error: "Invalid data provided" }, 400)

    // 3. Atomic Write (Includes ALL profile fields)
    const result = await c.env.DB.prepare(`
      INSERT INTO slots (
        slot_number, status, owner_name, owner_message, owner_color, owner_text, 
        payment_id, image_url, link_url, link_description, updated_at
      )
      VALUES (?, 'sold', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      slotId, 
      userData.name, 
      userData.message, 
      userData.color, 
      userData.text, 
      razorpay_payment_id || 'TEST_MODE',
      userData.imageUrl || '',
      userData.linkUrl || '',
      userData.linkDescription || ''
    ).run()

    if (!result.success) return c.json({ error: "Slot just sold!" }, 409)

    // 4. Background Cache Rebuild
    // This allows the user to get a "Success" response instantly while the server updates R2
    c.executionCtx.waitUntil(rebuildCdnCache(c.env))

    return c.json({ success: true })
  } catch (e) {
    console.error("Purchase Error:", e)
    if (e.message && e.message.includes('UNIQUE')) return c.json({ error: "Slot already taken" }, 409)
    return c.json({ error: "Processing failed" }, 500)
  }
})

// --- UTILS ---
async function ensureTableExists(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS slots (
      slot_number INTEGER PRIMARY KEY,
      status TEXT DEFAULT 'available',
      owner_name TEXT, 
      owner_message TEXT, 
      owner_color TEXT, 
      owner_text TEXT,
      payment_id TEXT, 
      image_url TEXT, 
      link_url TEXT, 
      link_description TEXT,
      updated_at DATETIME
    )
  `)
}

export default app