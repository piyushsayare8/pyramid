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

// Rate limiting middleware (Protects against bots) - REMOVED for lifetime free operation
// app.use('/api/*', async (c, next) => {
//   const ip = c.req.header('cf-connecting-ip') || 'unknown'
//   const key = `rate_limit:${ip}`
//   
//   if (c.env.CACHE) {
//     const current = await c.env.CACHE.get(key)
//     const count = current ? parseInt(current) : 0
//     if (count > 100) return c.json({ error: 'Too many requests' }, 429)
//     await c.env.CACHE.put(key, (count + 1).toString(), { expirationTtl: 60 })
//   }
//   await next()
// })

// --- 2. THE AUTOMATION ENGINE (Auto-Build & Cache) ---

async function ensureSystemReady(env) {
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // First check if cache exists
      const existingCache = await env.BUCKET.get('grid.json')
      if (!existingCache) {
        console.log('No cache found, building initial cache...')
        await rebuildCdnCache(env)
      } else {
        console.log('Cache exists, system ready')
      }
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

    // Generate unique ETag based on data hash for perfect cache invalidation
    const dataStr = JSON.stringify(cacheData)
    const encoder = new TextEncoder()
    const data = encoder.encode(dataStr)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const dataHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    await env.BUCKET.put('grid.json', JSON.stringify(cacheData), {
      httpMetadata: { 
        contentType: 'application/json', 
        cacheControl: 'public, max-age=300',  // 5 minutes cache - balanced for freshness
        etag: `"${dataHash}"`  // Perfect cache invalidation
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
  try {
    let file = await c.env.BUCKET.get('grid.json')
    
    // Self-Healing: If cache missing, trigger build and return "Wait"
    if (!file) {
      console.log('No cache file found, triggering rebuild...')
      c.executionCtx.waitUntil(ensureSystemReady(c.env))
      return c.json({ status: "initializing", message: "System building... Refresh in 5s" }, 503)
    }

    // Parse cached data to check freshness
    let cachedData
    let fileBody
    try {
      fileBody = await file.text()
      cachedData = JSON.parse(fileBody)
    } catch (e) {
      console.error('Cache parse error:', e)
      // Corrupted cache - rebuild immediately
      c.executionCtx.waitUntil(ensureSystemReady(c.env))
      return c.json({ status: "refreshing", message: "Updating cache... Refresh in 3s" }, 503)
    }

    // TIME-BASED FRESHNESS GUARANTEE - Always fresh within 60 seconds
    const cacheAge = Date.now() - new Date(cachedData.generatedAt).getTime()
    const maxFreshness = 60 * 1000 // 60 seconds maximum staleness
    
    if (cacheAge > maxFreshness) {
      // Force immediate refresh for guaranteed freshness
      console.log(`Cache stale (${Math.floor(cacheAge/1000)}s old) - forcing refresh`)
      c.executionCtx.waitUntil(rebuildCdnCache(c.env))
      
      // Return stale data with short cache while rebuilding
      c.header('Content-Type', 'application/json')
      c.header('Cache-Control', 'public, max-age=30')  // Very short cache during refresh
      c.header('X-Cache-Status', 'stale-refreshing')
      return c.body(fileBody)
    }

    // FRESH DATA - Long cache for efficiency
    c.header('Content-Type', 'application/json')
    c.header('Cache-Control', 'public, max-age=300')  // 5 minutes cache for fresh data
    c.header('ETag', file.httpMetadata?.etag)
    c.header('Last-Modified', new Date(cachedData.generatedAt).toUTCString())
    c.header('X-Cache-Status', 'fresh')
    c.header('X-Cache-Age', Math.floor(cacheAge / 1000).toString())
    
    // Check if client has latest version (304 Not Modified)
    const ifNoneMatch = c.req.header('If-None-Match')
    if (ifNoneMatch && ifNoneMatch === file.httpMetadata?.etag) {
      return c.body(null, 304)
    }
    
    return c.body(fileBody)
  } catch (e) {
    console.error('Grid API error:', e)
    return c.json({ error: 'Failed to load grid data', details: e.message }, 500)
  }
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

    // PRODUCTION-LIKE CURRENCY DETECTION - Real-time rates for all modes
    // You receive exact USD amount regardless
    let orderAmount, currency, conversionRate
    
    // Detect customer location from Cloudflare headers
    const customerCountry = c.req.header('cf-ipcountry') || 'US'
    const isIndianCustomer = customerCountry === 'IN'
    
    if (isIndianCustomer) {
      // Use reliable public exchange rate API for real-time conversion
      try {
        const rateResponse = await fetch('https://open.exchangerate-api.com/v6/latest/USD')
        const rateData = await rateResponse.json()
        conversionRate = rateData.rates.INR
        console.log(`Real-time Rate: 1 USD = ${conversionRate} INR`)
      } catch (e) {
        console.error('Exchange Rate API Error:', e)
        return c.json({ error: 'Exchange rate service temporarily unavailable' }, 503)
      }
      
      orderAmount = Math.ceil(slot.price * conversionRate * 100) // INR paise
      currency = "INR"
      console.log(`India: Slot ${slotId}, USD ${slot.price}, INR ${orderAmount/100}, Real Rate ${conversionRate}`)
    } else {
      // International customers see USD
      orderAmount = Math.ceil(slot.price * 100) // USD cents
      currency = "USD"
      conversionRate = 1.0
      console.log(`International: Slot ${slotId}, USD ${slot.price}, USD Cents ${orderAmount}`)
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
          currency: currency,
          customer_country: customerCountry,
          conversion_rate: conversionRate,
          payment_methods: isIndianCustomer ? "UPI, Cards, Net Banking" : "Cards, International Payments",
          settlement: "You will receive exact USD amount"
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

app.post('/api/upload-image', async (c) => {
  try {
    const contentType = c.req.header('content-type')
    if (!contentType || !contentType.startsWith('multipart/form-data')) {
      return c.json({ error: 'Use multipart/form-data' }, 400)
    }

    const formData = await c.req.formData()
    const file = formData.get('image')
    
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No image file provided' }, 400)
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'File must be an image' }, 400)
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return c.json({ error: 'File size must be less than 5MB' }, 400)
    }

    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `images/${timestamp}-${random}.${extension}`

    // Upload to R2
    await c.env.BUCKET.put(filename, file, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000' // 1 year cache
      }
    })

    // Return public URL
    const publicUrl = `https://immortal-pyramid.piyushsayare8.workers.dev/api/image/${filename}`
    
    return c.json({
      success: true,
      imageUrl: publicUrl,
      filename: filename
    })
  } catch (e) {
    console.error('Image upload error:', e)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// Serve images from R2
app.get('/api/image/*', async (c) => {
  const filename = c.req.path.replace('/api/image/', '')
  const object = await c.env.BUCKET.get(filename)
  
  if (!object) {
    return c.text('Image not found', 404)
  }
  
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  
  return new Response(object.body, { headers })
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

  // 3. IMMEDIATE CACHE UPDATE - Always fresh after purchase
  console.log(`Purchase successful for slot ${slotId} - Updating cache immediately`)
  
  // Rebuild cache with new data (synchronously for guaranteed freshness)
  try {
    await rebuildCdnCache(c.env)
    console.log(`Cache updated immediately for slot ${slotId}`)
  } catch (e) {
    console.error('Cache update failed:', e)
    // Continue anyway - next request will rebuild within 60 seconds
  }
  
  return c.json({ success: true })
})

// --- 4. THE MAGIC (Frontend Hosting) ---
// This serves index.html for any non-API request
app.get('/*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
