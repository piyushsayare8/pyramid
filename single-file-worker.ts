// SINGLE FILE CLOUDFLARE WORKER - Enhanced with Latest Features
// Features: Hono Framework, D1 Database, R2 Storage, AI/Vectorize, Performance Monitoring, Advanced Security

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { D1Database, R2Bucket } from '@cloudflare/workers-types'

// --- Enhanced Configuration & Types ---
type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  ADMIN_SECRET: string
  PUBLIC_BUCKET_URL: string
  AI: any // AI binding for future AI features
  VECTORIZE: any // Vectorize binding for semantic search
}

interface SlotRow {
  id: number
  price: number
  status: string
  owner_name: string | null
  owner_message: string | null
  owner_color: string | null
  owner_image_url: string | null
  owner_link: string | null
  owner_text: string | null
  owner_font: string | null
  payment_id: string | null
  created_at: string
  updated_at: string
}

interface GridData {
  version: number
  generatedAt: string
  cachedAt: string
  totalSlots: number
  soldSlots: number
  availableSlots: number
  slots: SlotRow[]
}

interface HealthCheck {
  status: string
  mode: string
  timestamp: string
  version: string
  features: string[]
  bindings: string[]
  performance: {
    startupTime: number
    memoryUsage: number
    cpuTime: number
  }
}

const app = new Hono<{ Bindings: Bindings }>()

// --- Enhanced Middleware ---
app.use('/*', logger())
app.use('/*', prettyJSON())
app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
  maxAge: 86400,
  credentials: true
}))

// --- Performance Monitoring Middleware ---
app.use('/*', async (c, next) => {
  const start = Date.now()
  const startCpu = performance.now()
  
  await next()
  
  const duration = Date.now() - start
  const cpuTime = performance.now() - startCpu
  
  c.header('X-Response-Time', `${duration}ms`)
  c.header('X-CPU-Time', `${cpuTime.toFixed(2)}ms`)
  
  // Log slow requests
  if (duration > 1000) {
    console.warn(`Slow request: ${c.req.method} ${c.req.path} took ${duration}ms`)
  }
})

// --- Enhanced Helper Functions ---

// Advanced caching with performance metrics
async function updateCache(env: Bindings, version: number): Promise<{ success: boolean; duration: number; slotsCount: number }> {
  const startTime = Date.now()
  
  try {
    // Optimized query with indexes
    const { results } = await env.DB.prepare(`
      SELECT 
        slot_number as id, 
        price, 
        status, 
        owner_name, 
        owner_message, 
        owner_color,
        owner_image_url,
        owner_link,
        owner_text,
        owner_font,
        payment_id,
        created_at,
        updated_at
      FROM slots 
      ORDER BY slot_number ASC
    `).all<SlotRow>()

    const soldCount = results.filter(slot => slot.status === 'sold').length
    
    const gridData: GridData = {
      version: version,
      generatedAt: new Date().toISOString(),
      cachedAt: new Date().toISOString(),
      totalSlots: results.length,
      soldSlots: soldCount,
      availableSlots: results.length - soldCount,
      slots: results
    }
    
    const jsonString = JSON.stringify(gridData)
    
    // Enhanced caching strategy with multiple layers
    await Promise.all([
      // Hot cache with aggressive revalidation
      env.BUCKET.put('latest.json', jsonString, {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=0, s-maxage=5, stale-while-revalidate=55'
        }
      }),
      
      // API-specific cache for different clients
      env.BUCKET.put('api-v1.json', jsonString, {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=30, s-maxage=300'
        }
      }),
      
      // Real-time cache for live updates
      env.BUCKET.put('realtime.json', jsonString, {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=0, s-maxage=1'
        }
      }),
      
      // Archival backup
      env.BUCKET.put(`grid-v${version}.json`, jsonString, {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=31536000, immutable'
        }
      })
    ])

    const duration = Date.now() - startTime
    return { success: true, duration, slotsCount: results.length }
    
  } catch (error) {
    console.error('Cache update failed:', error)
    const duration = Date.now() - startTime
    return { success: false, duration, slotsCount: 0 }
  }
}

// Enhanced payment verification with multiple security layers
async function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<{ valid: boolean; details?: string }> {
  try {
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

    const isValid = expectedSignature === signature
    
    // Additional security checks
    if (!paymentId || !signature || !orderId) {
      return { valid: false, details: 'Missing payment parameters' }
    }
    
    if (paymentId.length < 10 || signature.length < 20) {
      return { valid: false, details: 'Invalid parameter format' }
    }

    return { valid: isValid }
  } catch (error) {
    console.error('Signature verification error:', error)
    return { valid: false, details: 'Verification process failed' }
  }
}

// Advanced analytics and insights
async function recordAnalytics(env: Bindings, event: string, data: any): Promise<void> {
  try {
    await env.BUCKET.put(`analytics/${event}-${Date.now()}.json`, JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
      userAgent: data.userAgent || 'unknown',
      ip: data.ip || 'unknown'
    }), {
      httpMetadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=31536000'
      }
    })
  } catch (error) {
    console.error('Analytics recording failed:', error)
  }
}

// --- API Routes ---

// 1. Enhanced Health Check with Performance Metrics
app.get('/', (c) => {
  const startTime = Date.now()
  
  const healthData: HealthCheck = {
    status: 'System Operational',
    mode: 'Enhanced Production',
    timestamp: new Date().toISOString(),
    version: '4.62.0',
    features: [
      'D1 Database',
      'R2 Storage', 
      'Advanced Caching',
      'Performance Monitoring',
      'Enhanced Security',
      'Analytics Tracking',
      'Real-time Updates',
      'AI/Vectorize Ready'
    ],
    bindings: [
      'DB (D1 Database)',
      'BUCKET (R2 Storage)',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET', 
      'ADMIN_SECRET',
      'PUBLIC_BUCKET_URL',
      'AI (Future)',
      'VECTORIZE (Future)'
    ],
    performance: {
      startupTime: startTime,
      memoryUsage: 0, // Would need additional monitoring setup
      cpuTime: 0
    }
  }
  
  return c.json(healthData)
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
        cachedAt: new Date().toISOString(),
        totalSlots: results.length,
        soldSlots: results.filter(slot => slot.status === 'sold').length,
        availableSlots: results.filter(slot => slot.status === 'available').length,
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

// 3. Enhanced Purchase Slot with Analytics and Security
app.post('/api/purchase', async (c) => {
  const startTime = Date.now()
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const userAgent = c.req.header('User-Agent') || 'unknown'
  let body: any = null
  
  try {
    body = await c.req.json()
    const { 
      slotId, 
      user, 
      message, 
      color, 
      text,
      font,
      link,
      razorpayOrderId, 
      razorpayPaymentId, 
      razorpaySignature 
    } = body

    // Enhanced Validation
    if (!slotId || !razorpayPaymentId || !razorpaySignature) {
      await recordAnalytics(c.env, 'purchase_validation_failed', { 
        reason: 'missing_fields', 
        slotId, 
        clientIP,
        userAgent 
      })
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const slotNum = Number(slotId)
    if (isNaN(slotNum) || slotNum < 1 || slotNum > 5050) {
      await recordAnalytics(c.env, 'purchase_validation_failed', { 
        reason: 'invalid_slot_id', 
        slotId, 
        clientIP,
        userAgent 
      })
      return c.json({ error: 'Invalid Slot ID' }, 400)
    }

    // Enhanced Security Check
    const verification = await verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, c.env.RAZORPAY_KEY_SECRET)
    if (!verification.valid) {
      await recordAnalytics(c.env, 'purchase_security_failed', { 
        reason: verification.details || 'invalid_signature',
        slotId, 
        paymentId: razorpayPaymentId,
        clientIP,
        userAgent 
      })
      return c.json({ error: `Invalid Payment Signature: ${verification.details}` }, 401)
    }

    // Check rate limiting (simple implementation)
    const recentPurchases = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM slots 
      WHERE payment_id = ? AND updated_at > datetime('now', '-5 minutes')
    `).bind(razorpayPaymentId).first('count')

    if (Number(recentPurchases || 0) > 0) {
      await recordAnalytics(c.env, 'purchase_rate_limited', { 
        paymentId: razorpayPaymentId,
        clientIP,
        userAgent 
      })
      return c.json({ error: 'Duplicate payment detected' }, 429)
    }

    // Enhanced Atomic Database Write with additional fields
    const result = await c.env.DB.prepare(`
      UPDATE slots 
      SET 
        status = 'sold', 
        owner_name = ?, 
        owner_message = ?, 
        owner_color = ?,
        owner_text = ?,
        owner_font = ?,
        owner_link = ?,
        payment_id = ?, 
        updated_at = datetime('now')
      WHERE slot_number = ? AND status = 'available'
    `).bind(
      user || 'Anonymous', 
      message || '', 
      color || '#FFD700',
      text || null,
      font || 'Arial',
      link || null,
      razorpayPaymentId, 
      slotNum
    ).run()

    if (result.meta.changes === 0) {
      await recordAnalytics(c.env, 'purchase_slot_taken', { 
        slotId: slotNum, 
        clientIP,
        userAgent 
      })
      return c.json({ error: 'Slot already taken' }, 409)
    }

    // Background: Update Cache with performance tracking
    c.executionCtx.waitUntil((async () => {
      try {
        const cacheResult = await updateCache(c.env, Date.now())
        await recordAnalytics(c.env, 'cache_update', { 
          success: cacheResult.success,
          duration: cacheResult.duration,
          slotsCount: cacheResult.slotsCount
        })
      } catch (error) {
        console.error('Background update error:', error)
        await recordAnalytics(c.env, 'cache_update_failed', { 
          error: error instanceof Error ? error.message : String(error)
        })
      }
    })())

    // Record successful purchase analytics
    await recordAnalytics(c.env, 'purchase_success', {
      slotId: slotNum,
      owner: user || 'Anonymous',
      paymentId: razorpayPaymentId,
      processingTime: Date.now() - startTime,
      clientIP,
      userAgent
    })

    return c.json({ 
      success: true, 
      slotId: slotNum,
      message: 'Slot purchased successfully',
      processingTime: Date.now() - startTime
    })

  } catch (error: any) {
    console.error("Purchase Error:", error)
    await recordAnalytics(c.env, 'purchase_error', {
      error: error instanceof Error ? error.message : String(error),
      slotId: body?.slotId,
      clientIP,
      userAgent
    })
    return c.json({ 
      error: 'Server Error'
    }, 500)
  }
})

// 4. Enhanced System Initialization with Modern Schema
app.get('/api/init', async (c) => {
  const apiKey = c.req.query('key')
  if (!apiKey || apiKey !== c.env.ADMIN_SECRET) {
    await recordAnalytics(c.env, 'init_unauthorized', { apiKey, clientIP: c.req.header('CF-Connecting-IP') })
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    // Enhanced table schema with new fields
    await c.env.DB.exec(`
      CREATE TABLE IF NOT EXISTS slots (
        slot_number INTEGER PRIMARY KEY,
        price INTEGER DEFAULT 1000,
        status TEXT DEFAULT 'available',
        owner_name TEXT,
        owner_message TEXT,
        owner_color TEXT,
        owner_image_url TEXT,
        owner_link TEXT,
        owner_text TEXT,
        owner_font TEXT DEFAULT 'Arial',
        payment_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create indexes for better performance
    await c.env.DB.exec(`
      CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
      CREATE INDEX IF NOT EXISTS idx_slots_updated_at ON slots(updated_at);
      CREATE INDEX IF NOT EXISTS idx_slots_payment_id ON slots(payment_id);
    `)

    const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM slots').first('c')
    if (Number(count || 0) === 0) {
      // Enhanced pricing structure - Block #5050 (top) = $5,000, decreasing by $0.50
      await c.env.DB.exec(`
        INSERT INTO slots (slot_number, price)
        WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < 5050)
        SELECT x, 
          CASE 
            WHEN x = 5050 THEN 5000
            ELSE 1 + (x - 1) * 0.5
          END as price
        FROM cnt;
      `)
    }

    // Force initial cache build with performance tracking
    const cacheResult = await updateCache(c.env, 1)
    
    await recordAnalytics(c.env, 'init_success', { 
      slotsCreated: Number(count) === 0 ? 5050 : 0,
      cacheUpdateSuccess: cacheResult.success,
      cacheUpdateDuration: cacheResult.duration
    })

    return c.json({ 
      success: true, 
      message: 'Enhanced System Initialized Successfully',
      version: '4.62.0',
      features: ['Advanced Caching', 'Analytics', 'Enhanced Security', 'Performance Monitoring'],
      slotsCreated: Number(count) === 0 ? 5050 : 'Already exists',
      cacheUpdateSuccess: cacheResult.success,
      cacheUpdateDuration: `${cacheResult.duration}ms`
    })

  } catch (error: any) {
    console.error('Init error:', error)
    await recordAnalytics(c.env, 'init_error', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return c.json({ error: 'Initialization failed' }, 500)
  }
})

// 5. Enhanced Single Slot with Analytics
app.get('/api/slot/:id', async (c) => {
  const startTime = Date.now()
  const slotId = c.req.param('id')
  const slotNum = Number(slotId)
  
  if (isNaN(slotNum) || slotNum < 1 || slotNum > 5050) {
    await recordAnalytics(c.env, 'slot_lookup_invalid', { slotId })
    return c.json({ error: 'Invalid Slot ID' }, 400)
  }

  const slot = await c.env.DB.prepare(`
    SELECT 
      slot_number as id, 
      price, 
      status, 
      owner_name, 
      owner_message, 
      owner_color,
      owner_image_url,
      owner_link,
      owner_text,
      owner_font,
      payment_id, 
      created_at,
      updated_at
    FROM slots 
    WHERE slot_number = ?
  `).bind(slotNum).first<SlotRow>()

  if (!slot) {
    await recordAnalytics(c.env, 'slot_lookup_not_found', { slotId })
    return c.json({ error: 'Slot not found' }, 404)
  }

  await recordAnalytics(c.env, 'slot_lookup_success', { 
    slotId, 
    status: slot.status,
    processingTime: Date.now() - startTime
  })

  return c.json(slot)
})

// 6. Enhanced Admin Analytics & History
app.get('/api/history', async (c) => {
  const apiKey = c.req.query('key')
  if (apiKey !== c.env.ADMIN_SECRET) {
    await recordAnalytics(c.env, 'admin_unauthorized', { endpoint: 'history', apiKey })
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const limit = Math.min(Number(c.req.query('limit')) || 100, 1000)
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0)

  const { results } = await c.env.DB.prepare(`
    SELECT 
      slot_number as id, 
      owner_name, 
      owner_message, 
      owner_color,
      owner_text,
      owner_font,
      payment_id, 
      created_at,
      updated_at
    FROM slots 
    WHERE status = 'sold'
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all()

  return c.json({ 
    history: results, 
    pagination: { limit, offset },
    total: results.length
  })
})

// 7. Enhanced Admin Statistics with Performance Metrics
app.get('/api/stats', async (c) => {
  const apiKey = c.req.query('key')
  if (apiKey !== c.env.ADMIN_SECRET) {
    await recordAnalytics(c.env, 'admin_unauthorized', { endpoint: 'stats', apiKey })
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const [stats, recentActivity] = await Promise.all([
    c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_slots,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_slots,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_slots,
        SUM(CASE WHEN status = 'sold' THEN price ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'sold' THEN price ELSE NULL END) as avg_price,
        MAX(CASE WHEN status = 'sold' THEN price ELSE NULL END) as max_price,
        MIN(CASE WHEN status = 'sold' THEN price ELSE NULL END) as min_price
      FROM slots
    `).first() as Promise<{
      total_slots: number;
      sold_slots: number;
      available_slots: number;
      total_revenue: number;
      avg_price: number | null;
      max_price: number | null;
      min_price: number | null;
    }>,
    
    c.env.DB.prepare(`
      SELECT COUNT(*) as recent_sales
      FROM slots 
      WHERE status = 'sold' AND updated_at > datetime('now', '-24 hours')
    `).first() as Promise<{ recent_sales: number }>
  ])

  return c.json({
    ...stats,
    recent_sales_24h: recentActivity?.recent_sales || 0,
    sold_percentage: stats?.total_slots ? ((stats.sold_slots / stats.total_slots) * 100).toFixed(2) : '0',
    timestamp: new Date().toISOString()
  })
})

// 8. Real-time Analytics Dashboard
app.get('/api/analytics', async (c) => {
  const apiKey = c.req.query('key')
  if (apiKey !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    // Get recent analytics events from R2
    const analyticsFiles = await c.env.BUCKET.list({
      prefix: 'analytics/',
      limit: 100
    })

    const recentEvents = []
    for (const object of analyticsFiles.objects) {
      const file = await c.env.BUCKET.get(object.key)
      if (file) {
        const content = await file.text()
        recentEvents.push(JSON.parse(content))
      }
    }

    // Aggregate analytics data
    const aggregated = recentEvents.reduce((acc, event) => {
      const { event: eventType } = event
      acc[eventType] = (acc[eventType] || 0) + 1
      return acc
    }, {})

    return c.json({
      total_events: recentEvents.length,
      event_breakdown: aggregated,
      recent_events: recentEvents.slice(-20), // Last 20 events
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Analytics error:', error)
    return c.json({ error: 'Failed to fetch analytics' }, 500)
  }
})

// 9. Cache Management API
app.post('/api/cache/refresh', async (c) => {
  const apiKey = c.req.query('key')
  if (apiKey !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const version = Date.now()
    const result = await updateCache(c.env, version)
    
    return c.json({
      success: result.success,
      version,
      duration: result.duration,
      slotsCount: result.slotsCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Cache refresh error:', error)
    return c.json({ error: 'Cache refresh failed' }, 500)
  }
})

// 10. Advanced Search API (Future AI Integration Ready)
app.get('/api/search', async (c) => {
  const query = c.req.query('q')
  if (!query || query.length < 2) {
    return c.json({ error: 'Query too short' }, 400)
  }

  try {
    // Search in owner names and messages
    const results = await c.env.DB.prepare(`
      SELECT 
        slot_number as id,
        owner_name,
        owner_message,
        owner_text,
        owner_color,
        status
      FROM slots 
      WHERE status = 'sold' AND (
        LOWER(owner_name) LIKE LOWER(?) OR 
        LOWER(owner_message) LIKE LOWER(?) OR
        LOWER(owner_text) LIKE LOWER(?)
      )
      ORDER BY updated_at DESC
      LIMIT 50
    `).bind(`%${query}%`, `%${query}%`, `%${query}%`).all()

    await recordAnalytics(c.env, 'search_performed', { 
      query, 
      resultsCount: results.results.length 
    })

    return c.json({
      query,
      results: results.results,
      count: results.results.length
    })

  } catch (error) {
    console.error('Search error:', error)
    return c.json({ error: 'Search failed' }, 500)
  }
})

// 11. Static File Server (R2 Fallback) with Enhanced Headers
app.get('/storage/*', async (c) => {
  const fileName = c.req.param('*')
  try {
    const file = await c.env.BUCKET.get(fileName || '')
    if (!file) return c.json({ error: 'File not found' }, 404)

    const headers: Record<string, string> = {}
    if (file.httpMetadata?.contentType) headers['Content-Type'] = file.httpMetadata.contentType
    if (file.httpMetadata?.cacheControl) headers['Cache-Control'] = file.httpMetadata.cacheControl
    
    // Add security headers
    headers['X-Content-Type-Options'] = 'nosniff'
    headers['X-Frame-Options'] = 'DENY'

    return new Response(await file.arrayBuffer(), { headers })
  } catch (error) {
    return c.json({ error: 'Failed to fetch file' }, 500)
  }
})

// 12. Webhook Support for Future Integrations
app.post('/api/webhook/:type', async (c) => {
  const webhookType = c.req.param('type')
  const signature = c.req.header('X-Webhook-Signature')
  
  // Basic webhook validation (can be enhanced)
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401)
  }

  try {
    const body = await c.req.json()
    
    await recordAnalytics(c.env, 'webhook_received', {
      type: webhookType,
      signature: signature.substring(0, 10) + '...',
      bodyKeys: Object.keys(body)
    })

    // Process different webhook types
    switch (webhookType) {
      case 'payment':
        // Handle payment webhooks
        return c.json({ received: true, type: 'payment' })
      
      case 'analytics':
        // Handle analytics webhooks
        return c.json({ received: true, type: 'analytics' })
      
      default:
        return c.json({ error: 'Unknown webhook type' }, 400)
    }

  } catch (error) {
    console.error('Webhook error:', error)
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// Enhanced error handling and performance monitoring
app.notFound((c) => {
  recordAnalytics(c.env, 'not_found', { 
    path: c.req.path,
    method: c.req.method 
  })
  return c.json({ 
    error: 'Route not found',
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString()
  }, 404)
})

app.onError((err, c) => {
  recordAnalytics(c.env, 'server_error', {
    error: err.message,
    path: c.req.path,
    method: c.req.method
  })
  return c.json({ 
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500)
})

export default app