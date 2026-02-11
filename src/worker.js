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

// Rate limiting middleware (Protects against bots)
app.use('/api/*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const key = `rate_limit:${ip}`
  
  if (c.env.CACHE) {
    const current = await c.env.CACHE.get(key)
    const count = current ? parseInt(current) : 0
    if (count > 100) return c.json({ error: 'Too many requests' }, 429)
    await c.env.CACHE.put(key, (count + 1).toString(), { expirationTtl: 60 })
  }
  await next()
})

// --- 2. THE AUTOMATION ENGINE (Auto-Build & Cache) ---

async function ensureSystemReady(env) {
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await rebuildCdnCache(env)
      console.log('System ready successfully')
      return
    } catch (e) {
      console.error(`Auto-Setup Error (attempt ${attempt}/${maxRetries}):`, e)
      if (attempt === maxRetries) {
        // Final attempt failed - continue with degraded service
        console.error('System setup failed after all retries')
      } else {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }
}

async function rebuildCdnCache(env) {
  try {
    console.log('Starting cache rebuild...')
    
    // Fetch ALL slots with COMPLETE data
    const { results } = await env.DB.prepare(`
      SELECT 
        slot_number, 
        status, 
        owner_name,
        owner_message,
        owner_color, 
        owner_text,
        image_url,
        link_url,
        link_description,
        price 
      FROM slots 
      ORDER BY slot_number ASC
    `).all()

    const cacheData = {
      generatedAt: new Date().toISOString(),
      totalSlots: results.length,
      soldCount: results.filter(s => s.status === 'sold').length,
      slots: results
    }

    await env.BUCKET.put('grid.json', JSON.stringify(cacheData), {
      httpMetadata: { 
        contentType: 'application/json', 
        cacheControl: 'public, max-age=31536000',  // 1 year cache for lifetime free operation
        etag: `"${Date.now()}"`  // Force cache refresh when data changes
      }
    })
    
    console.log(`Cache rebuilt successfully: ${cacheData.totalSlots} slots, ${cacheData.soldCount} sold`)
  } catch (e) {
    console.error('Cache rebuild failed:', e)
    throw e // Re-throw to trigger retry logic
  }
}

// --- 3. API ROUTES ---

// Health check endpoint for monitoring
app.get('/api/health', async (c) => {
  try {
    // Quick database connectivity check
    const { count } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM slots").first()
    
    // Check cache availability
    const cacheFile = await c.env.BUCKET.get('grid.json')
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      slots: count || 0,
      cache: cacheFile ? 'available' : 'missing'
    })
  } catch (e) {
    return c.json({
      status: 'unhealthy',
      error: e.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

app.get('/api/grid', async (c) => {
  let file = await c.env.BUCKET.get('grid.json')
  
  // Self-Healing: If cache missing, trigger build and return "Wait"
  if (!file) {
    c.executionCtx.waitUntil(ensureSystemReady(c.env))
    return c.json({ status: "initializing", message: "System building... Refresh in 5s" }, 503)
  }

  // Parse cached data to check freshness
  let cachedData
  try {
    cachedData = JSON.parse(await file.text())
  } catch (e) {
    // Corrupted cache - rebuild immediately
    c.executionCtx.waitUntil(ensureSystemReady(c.env))
    return c.json({ status: "refreshing", message: "Updating cache... Refresh in 3s" }, 503)
  }

  // Check if cache is stale (older than 5 minutes) and there are recent purchases
  const cacheAge = Date.now() - new Date(cachedData.generatedAt).getTime()
  const maxCacheAge = 5 * 60 * 1000 // 5 minutes
  
  if (cacheAge > maxCacheAge) {
    // Background refresh - user gets cached data, cache updates silently
    c.executionCtx.waitUntil(rebuildCdnCache(c.env))
  }

  // Edge caching headers for lifetime free operation
  c.header('Content-Type', 'application/json')
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=31536000')  // 5 min fresh, 1 year stale
  c.header('ETag', file.httpMetadata?.etag)
  c.header('Last-Modified', new Date(cachedData.generatedAt).toUTCString())
  c.header('X-Cache-Age', Math.floor(cacheAge / 1000).toString()) // Debug header
  
  return c.body(file.body)
})

app.post('/api/create-order', async (c) => {
  try {
    const { slotId } = await c.req.json()
    
    // Validate environment variables
    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
      console.error('Missing Razorpay credentials')
      return c.json({ error: 'Payment service not configured' }, 500)
    }
    
    // Atomic: Try to insert slot if it doesn't exist
    const price = 0.1 + ((slotId - 1) * 0.1)
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO slots (slot_number, price, status) 
      VALUES (?, ?, 'available')
    `).bind(slotId, price).run()
    
    // Get slot (now guaranteed to exist)
    const slot = await c.env.DB.prepare("SELECT price, status FROM slots WHERE slot_number = ?").bind(slotId).first()
    
    if (slot.status === 'sold') return c.json({ error: "Unavailable" }, 409)

    // Use Razorpay's built-in currency conversion
    // For test mode, use INR directly since USD conversion may not work in test
    const isTestMode = c.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')
    let orderAmount, currency
    
    if (isTestMode) {
      // Test mode: Use INR with fallback conversion rate
      const fallbackRate = 84.0
      orderAmount = Math.ceil(slot.price * fallbackRate * 100) // INR paise
      currency = "INR"
      console.log(`Test Mode: Slot ${slotId}, USD ${slot.price}, Rate ${fallbackRate}, INR Paise ${orderAmount}`)
    } else {
      // Production mode: Use USD and let Razorpay convert
      orderAmount = Math.ceil(slot.price * 100) // USD cents
      currency = "USD"
      console.log(`Production Mode: Slot ${slotId}, USD ${slot.price}, USD Cents ${orderAmount}`)
    }

    const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)
    const rzp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: orderAmount,
        currency: currency,
        receipt: `slot_${slotId}`,
        notes: { 
          slot_number: slotId, 
          usd_price: slot.price.toFixed(2),
          mode: isTestMode ? 'test' : 'production'
        }
      })
    })

    if (!rzp.ok) {
      const errorText = await rzp.text()
      console.error('Razorpay API Error:', rzp.status, errorText)
      return c.json({ error: `Payment gateway error: ${rzp.status} ${errorText}` }, 500)
    }

    const orderData = await rzp.json()
    console.log('Razorpay Order Response:', JSON.stringify(orderData))
    
    // Check for Razorpay errors
    if (orderData.error) {
      console.error('Razorpay Order Error:', orderData.error)
      return c.json({ error: orderData.error.description || orderData.error }, 400)
    }
    
    // Return order data with key for frontend
    return c.json({
      ...orderData,
      key: c.env.RAZORPAY_KEY_ID
    })
  } catch (e) {
    console.error('Order Creation Error:', e)
    return c.json({ error: `Order failed: ${e.message || 'Unknown error'}` }, 500)
  }
})

app.post('/api/purchase', async (c) => {
  const { slotId, userData, razorpay_payment_id, razorpay_signature } = await c.req.json()

  // 1. Verify Signature (Production Security)
  if (c.env.NODE_ENV === 'production') {
      // (Add your signature verification logic here if needed, or trust the callback for MVP)
      if (!razorpay_payment_id) return c.json({ error: "Payment ID missing" }, 400)
  }

  // 2. Atomic Update - Save ALL user data
  const res = await c.env.DB.prepare(`
    UPDATE slots SET 
      status='sold', 
      owner_name=?, 
      owner_message=?,
      owner_color=?, 
      owner_text=?,
      image_url=?,
      link_url=?,
      link_description=?,
      payment_id=?, 
      updated_at=CURRENT_TIMESTAMP
    WHERE slot_number=? AND status='available'
  `).bind(
    userData.name, 
    userData.message || '', 
    userData.color, 
    userData.text,
    userData.imageUrl || '',
    userData.linkUrl || '',
    userData.linkDescription || '',
    razorpay_payment_id, 
    slotId
  ).run()

  if (res.meta.changes === 0) return c.json({ error: "Sold out" }, 409)

  // 3. Update Cache
  c.executionCtx.waitUntil(rebuildCdnCache(c.env))
  return c.json({ success: true })
})

// --- 4. THE MAGIC (Frontend Hosting) ---
// This serves index.html for any non-API request
app.get('/*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
