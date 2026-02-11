import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// --- 1. GLOBAL CONFIGURATION ---

// Enhanced CORS: Production-ready with comprehensive headers
app.use('/*', cors({
  origin: '*', // Change to your specific domain in production for extra security
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'ETag', 'X-Cache-Status'],
  maxAge: 86400,
}))

// LIFETIME FREE PROTECTOR: Smart Rate Limiting Middleware
// Prevents bots from exhausting your 100k/day Worker limit or R2 quotas
app.use('/api/*', async (c, next) => {
  try {
    const ip = c.req.header('cf-connecting-ip') || 'unknown'
    const path = c.req.path
    const key = `rate_limit:${ip}:${path}` // Specific limit per endpoint
    
    // Define limits: Strict for uploads/writes, loose for reads
    const isWrite = path.includes('upload') || path.includes('purchase') || path.includes('create-order')
    const limit = isWrite ? 10 : 200 // 10 writes or 200 reads per window
    const window = 60 // 60 seconds
    
    if (c.env.CACHE) { // Assumes you bound a KV namespace named 'CACHE'
      const current = await c.env.CACHE.get(key)
      const count = current ? parseInt(current) : 0
      
      if (count > limit) {
        console.warn(`Rate limit exceeded for IP: ${ip} on ${path} (${count}/${limit})`)
        return c.json({ error: 'Too many requests - Please wait a minute' }, 429)
      }
      
      // Atomic increment not strictly necessary for this level, simple put is fine
      await c.env.CACHE.put(key, (count + 1).toString(), { expirationTtl: window })
    }
  } catch (e) {
    // Fail open: If rate limiter fails, allow request (don't break the app)
    console.error('Rate limit error (ignoring):', e)
  }
  await next()
})

// --- 2. THE AUTOMATION ENGINE (Auto-Build & Cache) ---

// --- 3. HELPER: CRYPTO SIGNATURE VERIFICATION ---
async function verifyRazorpaySignature(orderId, paymentId, signature, secret) {
  const text = `${orderId}|${paymentId}` 
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(text)

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  )

  // Razorpay sends signature as hex, we need to verify against it
  // Convert hex signature to Uint8Array
  const signatureBytes = new Uint8Array(signature.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)))

  return await crypto.subtle.verify("HMAC", cryptoKey, signatureBytes, messageData)
}

// --- 4. HELPER: IMAGE PROCESSING ---
async function uploadBase64ToR2(base64Data, env, permanentPath = null) {
  try {
    // Extract base64 data and mime type
    const matches = base64Data.match(/^data:(image\/[\w\-+.]+);base64,(.+)$/)
    if (!matches) throw new Error('Invalid base64 image format')
    
    const mimeType = matches[1]
    const base64String = matches[2]
    
    // Convert base64 to binary
    const binaryString = atob(base64String)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    // Determine file extension from mime type
    const extension = mimeType.split('/')[1] || 'jpg'
    
    // Generate filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const filename = permanentPath || `images/${timestamp}-${random}.${extension}`
    
    // Upload to R2
    await env.BUCKET.put(filename, bytes, {
      httpMetadata: { 
        contentType: mimeType, 
        cacheControl: 'public, max-age=31536000' // 1 year cache
      }
    })
    
    // Return public URL
    const origin = env.CUSTOM_DOMAIN || 'https://immortal-pyramid.piyushsayare8.workers.dev'
    return `${origin}/api/image/${filename}`
    
  } catch (e) {
    console.error('Base64 to R2 upload failed:', e)
    throw e
  }
}

async function moveTempToPermanent(tempUrl, env) {
  try {
    // Extract temp filename from URL
    const tempFilename = tempUrl.replace(/.*\/api\/image\//, '')
    
    // Skip if not a temp file
    if (!tempFilename.startsWith('temp-images/')) {
      return tempUrl // Already permanent
    }
    
    // Get temp file
    const tempObject = await env.BUCKET.get(tempFilename)
    if (!tempObject) throw new Error('Temp image not found')
    
    // Generate permanent filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const extension = tempFilename.split('.').pop() || 'jpg'
    const permanentFilename = `images/${timestamp}-${random}.${extension}`
    
    // Copy to permanent location
    await env.BUCKET.put(permanentFilename, tempObject.body, {
      httpMetadata: tempObject.httpMetadata
    })
    
    // Delete temp file
    await env.BUCKET.delete(tempFilename)
    
    // Return permanent URL
    const origin = env.CUSTOM_DOMAIN || 'https://immortal-pyramid.piyushsayare8.workers.dev'
    return `${origin}/api/image/${permanentFilename}`
    
  } catch (e) {
    console.error('Move temp to permanent failed:', e)
    throw e
  }
}

// --- 5. SCHEDULED CLEANUP ---
async function cleanupTempImages(env) {
  try {
    console.log('Starting temp image cleanup...')
    
    // List all temp images
    const tempObjects = await env.BUCKET.list({
      prefix: 'temp-images/'
    })
    
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    let deletedCount = 0
    
    for (const object of tempObjects.objects) {
      // Check file age
      const uploaded = new Date(object.uploaded).getTime()
      const age = now - uploaded
      
      if (age > maxAge) {
        await env.BUCKET.delete(object.key)
        deletedCount++
        console.log(`Deleted old temp image: ${object.key}`)
      }
    }
    
    console.log(`Cleanup completed: ${deletedCount} temp images deleted`)
    return { deleted: deletedCount }
    
  } catch (e) {
    console.error('Temp image cleanup failed:', e)
    throw e
  }
}

async function ensureSystemReady(env) {
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const existingCache = await env.BUCKET.get('grid.json')
      if (!existingCache) {
        console.log('No cache found, building initial cache...')
        await rebuildCdnCache(env)
      }
      return
    } catch (e) {
      console.error(`Auto-Setup Error (attempt ${attempt}/${maxRetries}):`, e)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }
}

async function rebuildCdnCache(env) {
  try {
    console.log('Starting cache rebuild...')
    
    // Fetch ALL slots
    const { results } = await env.DB.prepare(`
      SELECT 
        slot_number, status, owner_name, owner_message, owner_color, 
        image_url, link_url, link_description, price 
      FROM slots 
      ORDER BY slot_number ASC
    `).all()

    const cacheData = {
      generatedAt: new Date().toISOString(),
      totalSlots: results.length,
      soldCount: results.filter(s => s.status === 'sold').length,
      slots: results
    }

    // Generate SHA-256 Hash for ETag (Data Integrity)
    const dataStr = JSON.stringify(cacheData)
    const encoder = new TextEncoder()
    const data = encoder.encode(dataStr)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const dataHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    // UPLOAD TO R2
    // Key Change: max-age=0, must-revalidate
    // This forces the browser to check ETag every time. 
    // It's "Instant Updates" but "Low Bandwidth" (returns 304 if no change).
    await env.BUCKET.put('grid.json', dataStr, {
      httpMetadata: { 
        contentType: 'application/json', 
        cacheControl: 'public, max-age=0, must-revalidate', 
        etag: `"${dataHash}"` 
      }
    })
    
    console.log(`Cache rebuilt: ${cacheData.soldCount}/${cacheData.totalSlots} sold`)
  } catch (e) {
    console.error('Cache rebuild failed:', e)
    throw e
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
    
    // Self-Healing
    if (!file) {
      c.executionCtx.waitUntil(ensureSystemReady(c.env))
      return c.json({ status: "initializing", message: "System building..." }, 503)
    }

    const etag = file.httpMetadata?.etag
    const ifNoneMatch = c.req.header('If-None-Match')

    // 1. Check ETag (The "Instant" Check)
    // If client has the same version, return 304 (0 bytes transferred)
    if (ifNoneMatch && ifNoneMatch === etag) {
      return c.body(null, 304)
    }

    // 2. Serve Fresh Data
    c.header('Content-Type', 'application/json')
    // Instructions to browser: "Always ask me if this changed"
    c.header('Cache-Control', 'public, max-age=0, must-revalidate') 
    c.header('ETag', etag)
    c.header('X-Cache-Status', 'fresh')
    
    return c.body(await file.text())
  } catch (e) {
    console.error('Grid load failed:', e)
    return c.json({ error: 'Grid load failed' }, 500)
  }
})

app.post('/api/create-order', async (c) => {
  try {
    const { slotId } = await c.req.json()
    
    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
      return c.json({ error: 'Server config error' }, 500)
    }
    
    // 1. Initialize Slot (if new)
    const price = 0.1 + ((slotId - 1) * 0.1)
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO slots (slot_number, price, status) VALUES (?, ?, 'available')
    `).bind(slotId, price).run()
    
    // 2. Check Availability
    const slot = await c.env.DB.prepare("SELECT price, status FROM slots WHERE slot_number = ?").bind(slotId).first()
    if (slot.status === 'sold') return c.json({ error: "Slot already sold" }, 409)

    // 3. Currency Logic (Production Ready)
    const customerCountry = c.req.header('cf-ipcountry') || 'US'
    const isIndia = customerCountry === 'IN'
    let amount, currency
    
    if (isIndia) {
      // Fetch dynamic rate
      try {
        const rateRes = await fetch('https://open.exchangerate-api.com/v6/latest/USD')
        const rateData = await rateRes.json()
        const rate = rateData.rates.INR || 86.0 // Fallback safety
        amount = Math.ceil(slot.price * rate * 100)
        currency = "INR"
        console.log(`Real-time Rate: 1 USD = ${rate} INR for slot ${slotId}`)
      } catch(e) {
         // Fallback if rate API fails
         amount = Math.ceil(slot.price * 86 * 100) 
         currency = "INR"
         console.log(`Using fallback rate for slot ${slotId}`)
      }
    } else {
      amount = Math.ceil(slot.price * 100)
      currency = "USD"
    }

    // 4. Create Razorpay Order
    const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)
    const rzp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        currency: currency,
        receipt: `slot_${slotId}`,
        notes: { slot_number: slotId, country: customerCountry }
      })
    })

    const orderData = await rzp.json()
    if (orderData.error) throw new Error(orderData.error.description)
    
    return c.json({ ...orderData, key: c.env.RAZORPAY_KEY_ID })
  } catch (e) {
    console.error('Create Order Error:', e)
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/upload-image-temp', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('image')
    
    if (!file || !(file instanceof File)) return c.json({ error: 'No file' }, 400)

    // SECURITY: Validate File
    if (!file.type.startsWith('image/')) return c.json({ error: 'Images only' }, 400)
    if (file.size > 2 * 1024 * 1024) return c.json({ error: 'Max 2MB' }, 400)

    // Generate Clean Temp Name
    const ext = file.name.split('.').pop().replace(/[^a-z0-9]/gi, '') || 'jpg'
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2)
    const tempFilename = `temp-images/${timestamp}-${random}.${ext}`

    // Upload to R2 (Temporary)
    await c.env.BUCKET.put(tempFilename, file, {
      httpMetadata: { 
        contentType: file.type, 
        cacheControl: 'public, max-age=300' // 5 minutes cache for temp
      }
    })

    // Construct Temp Public URL
    const origin = new URL(c.req.url).origin
    const tempUrl = `${origin}/api/image/${tempFilename}`
    
    console.log(`Temp image uploaded: ${tempFilename}`)
    
    return c.json({ 
      success: true, 
      tempUrl: tempUrl,
      filename: tempFilename
    })
  } catch (e) {
    console.error('Temp upload failed:', e)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

app.post('/api/upload-image', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('image')
    
    if (!file || !(file instanceof File)) return c.json({ error: 'No file' }, 400)

    // SECURITY: Validate File
    if (!file.type.startsWith('image/')) return c.json({ error: 'Images only' }, 400)
    if (file.size > 2 * 1024 * 1024) return c.json({ error: 'Max 2MB' }, 400)

    // Generate Clean Name (Permanent)
    const ext = file.name.split('.').pop().replace(/[^a-z0-9]/gi, '') || 'jpg'
    const filename = `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}` 

    await c.env.BUCKET.put(filename, file, {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000' }
    })

    // Construct Public URL
    const publicUrl = new URL(c.req.url).origin + `/api/image/${filename}` 
    
    return c.json({ success: true, imageUrl: publicUrl })
  } catch (e) {
    console.error('Upload failed:', e)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// Serve images from R2 with security
app.get('/api/image/*', async (c) => {
  const filename = c.req.path.replace('/api/image/', '')
  // Security: Prevent directory traversal
  if (filename.includes('..')) return c.text('Invalid path', 400)

  const object = await c.env.BUCKET.get(filename)
  if (!object) return c.text('Not found', 404)
  
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  
  return new Response(object.body, { headers })
})

app.post('/api/purchase', async (c) => {
  try {
    const body = await c.req.json()
    const { 
      slotId, 
      userData, 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = body

    // 1. SECURITY: VERIFY SIGNATURE (Mandatory)
    // This makes it impossible to fake a purchase
    const isValid = await verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      c.env.RAZORPAY_KEY_SECRET
    )

    if (!isValid) {
      console.error(`Invalid signature for order ${razorpay_order_id}`)
      return c.json({ error: "Security check failed: Invalid Signature" }, 403)
    }

    // 2. IMAGE PROCESSING: Move temp to permanent if needed
    let finalImageUrl = userData.imageUrl
    if (userData.imageUrl && userData.imageUrl.includes('temp-images/')) {
      try {
        console.log(`Moving temp image to permanent: ${userData.imageUrl}`)
        finalImageUrl = await moveTempToPermanent(userData.imageUrl, c.env)
        console.log(`Image moved to permanent: ${finalImageUrl}`)
      } catch (e) {
        console.error('Failed to move temp image:', e)
        // Continue with original URL if move fails
      }
    } else if (userData.imageUrl && userData.imageUrl.startsWith('data:image/')) {
      try {
        console.log('Processing base64 image upload')
        finalImageUrl = await uploadBase64ToR2(userData.imageUrl, c.env)
        console.log(`Base64 image uploaded: ${finalImageUrl}`)
      } catch (e) {
        console.error('Failed to process base64 image:', e)
        // Continue with empty URL if upload fails
        finalImageUrl = ''
      }
    }

    // 3. ATOMIC DB UPDATE
    const res = await c.env.DB.prepare(`
      UPDATE slots SET 
        status='sold', 
        owner_name=?, owner_message=?, owner_color=?, owner_text=?,
        image_url=?, link_url=?, link_description=?,
        payment_id=?, updated_at=CURRENT_TIMESTAMP
      WHERE slot_number=? AND status='available'
    `).bind(
      userData.name, userData.message, userData.color, userData.text,
      finalImageUrl, userData.linkUrl, userData.linkDescription,
      razorpay_payment_id, slotId
    ).run()

    if (res.meta.changes === 0) {
      // Corner case: User paid, but someone else snatched the slot in the last second.
      // In a real app, you would issue a refund here.
      return c.json({ error: "Slot no longer available. Please contact support." }, 409)
    }

    // 4. TRIGGER CACHE REBUILD
    // Using waitUntil so the user gets a "Success" response faster
    // The next visitor will trigger the actual file update if this hasn't finished
    c.executionCtx.waitUntil(rebuildCdnCache(c.env))
    
    console.log(`Purchase completed: Slot ${slotId}, Image: ${finalImageUrl}`)
    
    return c.json({ 
      success: true,
      imageUrl: finalImageUrl // Return final image URL
    })
  } catch (e) {
    console.error('Purchase processing error:', e)
    return c.json({ error: "Processing failed" }, 500)
  }
})

// --- 4. FRONTEND HOSTING ---
app.get('/*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

// --- 6. SCHEDULED HANDLERS ---
// Scheduled event handler for cleanup (runs daily)
export default {
  async scheduled(event, env, ctx) {
    if (event.cron === '0 2 * * *') { // 2 AM daily
      ctx.waitUntil(cleanupTempImages(env))
    }
  },
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  }
}
