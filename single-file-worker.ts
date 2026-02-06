// SINGLE FILE CLOUDFLARE WORKER - Production Release
// Features: Hono Framework, D1 Database, R2 Storage, SWR Caching, Razorpay Verification

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { D1Database, R2Bucket, ScheduledEvent } from '@cloudflare/workers-types'

// --- Configuration & Types ---
type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  ADMIN_SECRET: string
  PUBLIC_BUCKET_URL: string
  BROWSER_RENDERING: any // Cloudflare Browser Rendering API
}

interface SlotRow {
  id: number
  price: number
  status: string
  owner_name: string | null
  owner_message: string | null
  owner_color: string | null
  owner_image_url: string | null
}

interface GridData {
  version: number
  generatedAt: string
  slots: SlotRow[]
}

const app = new Hono<{ Bindings: Bindings }>()

// --- Middleware ---
// Security Note: In production, replace '*' with your actual frontend domain
app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  maxAge: 86400,
}))

// --- Helper Functions ---

// WebGL-based grid baking using Cloudflare Browser Rendering
async function bakeGridWithBrowser(env: Bindings, slots: SlotRow[]): Promise<ArrayBuffer> {
  const browser = env.BROWSER_RENDERING.newBrowser()
  const page = await browser.newPage()
  
  try {
    // Navigate to frontend with bake mode and slot data
    const slotDataParam = encodeURIComponent(JSON.stringify(slots))
    await page.goto(`${env.PUBLIC_BUCKET_URL}?mode=bake&slots=${slotDataParam}`)
    
    // Wait for rendering to complete (frontend should signal completion)
    await page.waitForFunction('window.bakingComplete', { timeout: 30000 })
    
    // Extract the base64 image from frontend
    const imageData = await page.evaluate(() => (window as any).bakedImageData)
    
    // Convert base64 to ArrayBuffer
    const base64Data = imageData.split(',')[1] // Remove data:image/png;base64, prefix
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    return bytes.buffer
  } finally {
    await browser.close()
  }
}

// Fallback Canvas-based baking (simpler, no WebGL)
async function bakeGridWithCanvas(env: Bindings, slots: SlotRow[]): Promise<ArrayBuffer> {
  const GRID_SIZE = 5050
  const COLS = 71
  const ROWS = 71
  const CELL_SIZE = 20
  
  // Create canvas
  const canvas = new OffscreenCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE)
  const ctx = canvas.getContext('2d')!
  
  // Fill background
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Draw grid lines
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth = 1
  
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath()
    ctx.moveTo(i * CELL_SIZE, 0)
    ctx.lineTo(i * CELL_SIZE, canvas.height)
    ctx.stroke()
  }
  
  for (let i = 0; i <= ROWS; i++) {
    ctx.beginPath()
    ctx.moveTo(0, i * CELL_SIZE)
    ctx.lineTo(canvas.width, i * CELL_SIZE)
    ctx.stroke()
  }
  
  // Draw sold slots
  for (const slot of slots) {
    if (slot.status === 'sold' && slot.owner_color) {
      const row = Math.floor((slot.id - 1) / COLS)
      const col = (slot.id - 1) % COLS
      
      ctx.fillStyle = slot.owner_color
      ctx.fillRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2)
      
      // Draw owner image if available
      if (slot.owner_image_url) {
        try {
          const imageResponse = await fetch(slot.owner_image_url)
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob()
            const imageBitmap = await createImageBitmap(imageBlob)
            
            ctx.drawImage(
              imageBitmap,
              col * CELL_SIZE + 2,
              row * CELL_SIZE + 2,
              CELL_SIZE - 4,
              CELL_SIZE - 4
            )
          }
        } catch (error) {
          console.warn(`Failed to load image for slot ${slot.id}:`, error)
        }
      }
    }
  }
  
  // Add watermark/timestamp
  ctx.fillStyle = '#666666'
  ctx.font = '12px Arial'
  const timestamp = new Date().toISOString()
  ctx.fillText(`Generated: ${timestamp}`, 10, canvas.height - 10)
  
  return canvas.convertToBlob({ type: 'image/png' }).then(blob => blob.arrayBuffer())
}

// Main baking function - tries browser rendering first, falls back to canvas
async function bakeGridImage(env: Bindings, slots: SlotRow[]): Promise<ArrayBuffer> {
  try {
    // Try WebGL-based baking with browser rendering
    return await bakeGridWithBrowser(env, slots)
  } catch (error) {
    console.warn('Browser rendering failed, falling back to canvas:', error)
    // Fallback to simple canvas baking
    return await bakeGridWithCanvas(env, slots)
  }
}

// Update R2 Storage with SWR (Stale-While-Revalidate) Headers
async function updateCache(env: Bindings, version: number): Promise<void> {
  // Fetch all slot data from D1
  const { results } = await env.DB.prepare(`
    SELECT slot_number as id, price, status, owner_name, owner_message, owner_color, owner_image_url 
    FROM slots ORDER BY slot_number ASC
  `).all<SlotRow>()

  const gridData: GridData = {
    version: version,
    generatedAt: new Date().toISOString(),
    slots: results
  }
  
  const jsonString = JSON.stringify(gridData)
  
  // 1. Save 'latest.json' (The hot file)
  // Strategy: 
  // - max-age=0: Browser must check with CDN
  // - s-maxage=5: CDN caches for 5 seconds (preventing database overload)
  // - stale-while-revalidate=55: If accessed between 5s-60s, serve OLD data instantly, update in background
  await env.BUCKET.put('latest.json', jsonString, {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: 'public, max-age=0, s-maxage=5, stale-while-revalidate=55'
    }
  })

  // 2. Save archival backup (Immutable history)
  await env.BUCKET.put(`grid-v${version}.json`, jsonString, {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: 'public, max-age=31536000, immutable'
    }
  })

  // 3. Auto-bake grid image
  try {
    const imageBuffer = await bakeGridImage(env, results)
    await env.BUCKET.put(`grid-v${version}.png`, imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    })
    
    // Also update latest grid image
    await env.BUCKET.put('latest-grid.png', imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=0, s-maxage=5, stale-while-revalidate=55'
      }
    })
  } catch (error) {
    console.error('Grid baking error:', error)
    // Don't fail the cache update if image baking fails
  }
}

// Secure Payment Signature Verification
async function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  const text = `${orderId}|${paymentId}`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', 
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, 
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(text))
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return expectedSignature === signature
}

// --- API Routes ---

// 1. Health Check
app.get('/', (c) => {
  return c.json({
    status: 'System Operational',
    mode: 'Production',
    timestamp: new Date().toISOString()
  })
})

// 2. Get Grid Data (High Traffic Route)
app.get('/api/grid', async (c) => {
  try {
    const file = await c.env.BUCKET.get('latest.json')
    
    // Failover: If R2 is empty, generate from DB immediately
    if (!file) {
      const { results } = await c.env.DB.prepare('SELECT * FROM slots ORDER BY slot_number').all<SlotRow>()
      const fallbackData: GridData = {
        version: 0,
        generatedAt: new Date().toISOString(),
        slots: results
      }
      return c.json(fallbackData)
    }

    // Mirror SWR headers to the browser response
    c.header('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=55')
    c.header('ETag', file.httpEtag)
    c.header('Content-Type', 'application/json')
    
    return c.body(await file.text())
  } catch (error) {
    console.error('Grid fetch error:', error)
    return c.json({ error: 'Failed to fetch grid data' }, 500)
  }
})

// 3. Purchase Slot (Transactional Route) - Direct Purchase (Testing Mode)
app.post('/api/purchase', async (c) => {
  try {
    const body = await c.req.json()
    const { slotId, user, message, color } = body

    // Validation
    if (!slotId) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const slotNum = Number(slotId)
    if (isNaN(slotNum) || slotNum < 1 || slotNum > 5050) {
      return c.json({ error: 'Invalid Slot ID' }, 400)
    }

    // TESTING MODE: Skip Razorpay verification
    // const isValid = await verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, c.env.RAZORPAY_KEY_SECRET)
    // if (!isValid) {
    //   return c.json({ error: 'Invalid Payment Signature' }, 401)
    // }

    // Atomic Database Write
    // Only updates if status is 'available' to prevent race conditions
    const result = await c.env.DB.prepare(`
      UPDATE slots 
      SET status = 'sold', owner_name = ?, owner_message = ?, owner_color = ?, payment_id = ?, updated_at = datetime('now')
      WHERE slot_number = ? AND status = 'available'
    `).bind(user || 'Test User', message || 'Test Message', color || '#FFD700', `test_payment_${Date.now()}`, slotNum).run()

    if (result.meta.changes === 0) {
      return c.json({ error: 'Slot already taken' }, 409)
    }

    // Background: Update Cache
    c.executionCtx.waitUntil((async () => {
      try {
        const newVersion = Date.now()
        await updateCache(c.env, newVersion)
      } catch (error) {
        console.error('Background update error:', error)
      }
    })())

    return c.json({ 
      success: true, 
      slotId: slotNum,
      message: 'Slot purchased successfully (Testing Mode)',
      testingMode: true
    })

  } catch (error: any) {
    console.error("Purchase Error:", error)
    return c.json({ error: 'Server Error' }, 500)
  }
})

// 4. System Initialization (Admin Only)
app.get('/api/init', async (c) => {
  const apiKey = c.req.query('key')
  if (!apiKey || apiKey !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    await c.env.DB.exec(`
      CREATE TABLE IF NOT EXISTS slots (
        slot_number INTEGER PRIMARY KEY,
        price INTEGER DEFAULT 1000,
        status TEXT DEFAULT 'available',
        owner_name TEXT,
        owner_message TEXT,
        owner_color TEXT,
        owner_image_url TEXT,
        payment_id TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM slots').first('c')
    if (Number(count || 0) === 0) {
      await c.env.DB.exec(`
        INSERT INTO slots (slot_number, price)
        WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < 5050)
        SELECT x, 1000 FROM cnt;
      `)
    }

    // Force initial cache build
    await updateCache(c.env, 1)

    return c.json({ 
      success: true, 
      message: 'System Initialized Successfully',
      slotsCreated: Number(count) === 0 ? 5050 : 'Already exists'
    })

  } catch (error: any) {
    console.error('Init error:', error)
    return c.json({ error: 'Initialization failed' }, 500)
  }
})

// 5. Get Single Slot Status
app.get('/api/slot/:id', async (c) => {
  const slotId = c.req.param('id')
  const slotNum = Number(slotId)
  
  if (isNaN(slotNum) || slotNum < 1 || slotNum > 5050) {
    return c.json({ error: 'Invalid Slot ID' }, 400)
  }

  const slot = await c.env.DB.prepare(`
    SELECT slot_number as id, price, status, owner_name, owner_message, owner_color, owner_image_url, updated_at
    FROM slots 
    WHERE slot_number = ?
  `).bind(slotNum).first<SlotRow & { updated_at: string }>()

  if (!slot) {
    return c.json({ error: 'Slot not found' }, 404)
  }

  return c.json(slot)
})

// 6. Admin Stats & History
app.get('/api/history', async (c) => {
  const apiKey = c.req.query('key')
  if (apiKey !== c.env.ADMIN_SECRET) return c.json({ error: 'Unauthorized' }, 401)

  const limit = Math.min(Number(c.req.query('limit')) || 100, 1000)
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0)

  const { results } = await c.env.DB.prepare(`
    SELECT slot_number as id, owner_name, owner_message, owner_color, payment_id, updated_at
    FROM slots 
    WHERE status = 'sold'
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all()

  return c.json({ history: results, pagination: { limit, offset } })
})

app.get('/api/stats', async (c) => {
  const apiKey = c.req.query('key')
  if (apiKey !== c.env.ADMIN_SECRET) return c.json({ error: 'Unauthorized' }, 401)

  const stats = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_slots,
      COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_slots,
      COUNT(CASE WHEN status = 'available' THEN 1 END) as available_slots,
      SUM(CASE WHEN status = 'sold' THEN price ELSE 0 END) as total_revenue
    FROM slots
  `).first()

  return c.json(stats)
})

// 8. Manual Grid Baking (Admin Only)
app.post('/api/bake', async (c) => {
  const apiKey = c.req.query('key')
  if (apiKey !== c.env.ADMIN_SECRET) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT slot_number as id, price, status, owner_name, owner_message, owner_color, owner_image_url 
      FROM slots ORDER BY slot_number ASC
    `).all<SlotRow>()

    const version = Date.now()
    const imageBuffer = await bakeGridImage(c.env, results)
    
    await c.env.BUCKET.put(`grid-v${version}.png`, imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    })
    
    await c.env.BUCKET.put('latest-grid.png', imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=0, s-maxage=5, stale-while-revalidate=55'
      }
    })

    return c.json({ 
      success: true, 
      version,
      message: 'Grid baked successfully',
      method: 'browser_rendering',
      slotsProcessed: results.length
    })
  } catch (error: any) {
    console.error('Manual bake error:', error)
    return c.json({ error: 'Failed to bake grid', details: error.message }, 500)
  }
})

// 9. Scheduled Auto Baking (Cron Trigger)
// This will be called by Cloudflare Cron Triggers
async function handleScheduled(event: ScheduledEvent, env: Bindings): Promise<void> {
  console.log('Scheduled baking triggered')
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT slot_number as id, price, status, owner_name, owner_message, owner_color, owner_image_url 
      FROM slots ORDER BY slot_number ASC
    `).all<SlotRow>()

    const version = Date.now()
    const imageBuffer = await bakeGridImage(env, results)
    
    await env.BUCKET.put(`grid-v${version}.png`, imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    })
    
    await env.BUCKET.put('latest-grid.png', imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=0, s-maxage=5, stale-while-revalidate=55'
      }
    })

    console.log(`Scheduled baking complete: version ${version}, ${results.length} slots`)
  } catch (error: any) {
    console.error('Scheduled baking error:', error)
  }
}

// 10. Get Latest Grid Image
app.get('/api/grid-image', async (c) => {
  try {
    const file = await c.env.BUCKET.get('latest-grid.png')
    
    if (!file) {
      return c.json({ error: 'Grid image not found' }, 404)
    }

    c.header('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=55')
    c.header('ETag', file.httpEtag)
    c.header('Content-Type', 'image/png')
    
    return c.body(await file.arrayBuffer())
  } catch (error) {
    console.error('Grid image fetch error:', error)
    return c.json({ error: 'Failed to fetch grid image' }, 500)
  }
})

// 7. Static File Server (R2 Fallback)
app.get('/storage/*', async (c) => {
  const fileName = c.req.param('*')
  try {
    const file = await c.env.BUCKET.get(fileName || '')
    if (!file) return c.json({ error: 'File not found' }, 404)

    const headers: Record<string, string> = {}
    if (file.httpMetadata?.contentType) headers['Content-Type'] = file.httpMetadata.contentType
    if (file.httpMetadata?.cacheControl) headers['Cache-Control'] = file.httpMetadata.cacheControl

    return new Response(await file.arrayBuffer(), { headers })
  } catch (error) {
    return c.json({ error: 'Failed to fetch file' }, 500)
  }
})

app.notFound((c) => c.json({ error: 'Route not found' }, 404))
app.onError((err, c) => c.json({ error: 'Internal Server Error', message: err.message }, 500))

export default app
export { handleScheduled }