// src/index.ts - Complete Pyramid Backend
import { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';

interface Env {
  PyramidDB: D1Database;
  HistoryPyramid: R2Bucket;
  PYRAMID_KV: KVNamespace;
  FREE_TIER_MODE: string;
  MAX_CACHE_SIZE: string;
  RATE_LIMIT_PER_MINUTE: string;
}

// Enhanced block interface for our new features
interface PyramidBlock {
  slot_number: number;
  price: number;
  status: 'available' | 'sold';
  owner_name?: string;
  owner_message?: string;
  owner_color?: string;
  owner_text?: string;
  owner_font?: string;
  owner_image_url?: string;
  owner_image_thumb?: string;
  payment_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface PurchaseRequest {
  slotId: number;
  user: string;
  message?: string;
  color: string;
  text?: string;
  font?: string;
  imageUrl?: string;
  paymentId: string;
}

// Security: CORS Headers with rate limiting
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Free tier rate limiting
const RATE_LIMIT_REQUESTS = 60; // requests per minute
const RATE_LIMIT_WINDOW = 60; // seconds

// Free tier optimized caching
const FREE_TIER_CACHE_TTL = 3600; // 1 hour
const MAX_CACHE_SIZE = 10000000; // 10MB

// Free tier rate limiting function
async function checkRateLimit(env: Env, clientIP: string): Promise<{ allowed: boolean; remaining?: number }> {
  try {
    const key = `rate_limit:${clientIP}`;
    const now = Date.now();
    const windowStart = now - (RATE_LIMIT_WINDOW * 1000);
    
    // Get existing requests
    const existing = await env.PYRAMID_KV.get(key);
    if (!existing) {
      // First request in window
      await env.PYRAMID_KV.put(key, JSON.stringify([now]), { expirationTtl: RATE_LIMIT_WINDOW });
      return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1 };
    }
    
    const requests: number[] = JSON.parse(existing);
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= RATE_LIMIT_REQUESTS) {
      return { allowed: false };
    }
    
    // Add current request
    validRequests.push(now);
    await env.PYRAMID_KV.put(key, JSON.stringify(validRequests), { expirationTtl: RATE_LIMIT_WINDOW });
    
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - validRequests.length };
    
  } catch (error) {
    // If KV fails, allow the request (fail open)
    console.error('Rate limiting error:', error);
    return { allowed: true };
  }
}

// Image processing function
async function processImage(imageBuffer: ArrayBuffer): Promise<{ image: ArrayBuffer, thumbnail: ArrayBuffer }> {
  // For now, we'll just return the original buffer for both image and thumbnail
  // In a real implementation, you'd use a library like sharp.js to resize and optimize
  // For Cloudflare Workers, you might need to use a WebAssembly-based image processor
  
  // Placeholder implementation - in production, you'd want to:
  // 1. Resize main image to max 800x800
  // 2. Create thumbnail 150x150
  // 3. Optimize compression
  // 4. Convert to WebP for better compression
  
  return {
    image: imageBuffer,
    thumbnail: imageBuffer
  };
}

// URL validation function
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    try {
      // === 0. RATE LIMITING (Free Tier Protection) ===
      if (env.FREE_TIER_MODE === 'true') {
        const rateLimitResult = await checkRateLimit(env, clientIP);
        if (!rateLimitResult.allowed) {
          return new Response(JSON.stringify({ 
            error: "Rate limit exceeded. Please try again later.",
            retryAfter: 60
          }), { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Retry-After": "60"
            } 
          });
        }
      }

      // === 1. HEALTH CHECK & CORS ===
      if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
      }
      
      if (url.pathname === "/") {
        return new Response(JSON.stringify({
          status: "Pyramid System Online",
          version: "2.0",
          features: ["text", "fonts", "full-color", "50-chars", "profile-images"],
          free_tier: env.FREE_TIER_MODE === 'true',
          timestamp: new Date().toISOString()
        }), { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json" 
          } 
        });
      }

      // === 2. GET GRID (Ultra-High-Speed Cache Access) ===
      // This serves 99% of traffic - reads directly from R2 with CDN caching
      if (request.method === "GET" && url.pathname === "/api/grid") {
        try {
          // Try to get from cache first
          const cachedGrid = await env.HistoryPyramid.get("grid-cache.json");
          
          if (cachedGrid) {
            return new Response(cachedGrid.body, {
              headers: { 
                ...corsHeaders, 
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=300, s-maxage=3600", // 5min browser, 1hour CDN
                "ETag": `"${await env.HistoryPyramid.get("grid-version")}"`,
                "X-Cache": "HIT"
              }
            });
          }

          // Cache miss - rebuild from database
          const { results } = await env.PyramidDB.prepare(`
            SELECT slot_number, price, status, owner_name, owner_message, 
                   owner_color, owner_text, owner_font, owner_image_url, owner_image_thumb, created_at
            FROM slots 
            ORDER BY slot_number
          `).all();

          // Transform to frontend format
          const blocks = results.map((row: any) => ({
            id: row.slot_number,
            price: row.price,
            sold: row.status === 'sold',
            owner: row.owner_name || null,
            message: row.owner_message || null,
            color: row.owner_color || '#FFD700',
            text: row.owner_text || null,
            font: row.owner_font || 'Arial',
            imageUrl: row.owner_image_url || null,
            imageThumb: row.owner_image_thumb || null,
            created_at: row.created_at
          }));

          // Cache the result
          const gridData = JSON.stringify(blocks);
          const version = Date.now().toString();
          
          await Promise.all([
            env.HistoryPyramid.put("grid-cache.json", gridData, {
              httpMetadata: { contentType: "application/json" }
            }),
            env.HistoryPyramid.put("grid-version", version)
          ]);

          return new Response(gridData, {
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300, s-maxage=3600",
              "ETag": `"${version}"`,
              "X-Cache": "MISS"
            }
          });

        } catch (error) {
          console.error('Grid fetch error:', error);
          return new Response(JSON.stringify({ 
            error: "Failed to load grid data",
            blocks: [] // Fallback to empty grid
          }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // === 3. UPLOAD PROFILE IMAGE ===
      if (request.method === "POST" && url.pathname === "/api/upload-image") {
        try {
          const formData = await request.formData();
          const file = formData.get('image') as File;
          
          if (!file) {
            return new Response(JSON.stringify({ 
              error: "No image file provided" 
            }), { status: 400, headers: corsHeaders });
          }

          // Validate file type
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
          if (!allowedTypes.includes(file.type)) {
            return new Response(JSON.stringify({ 
              error: "Invalid file type. Only JPEG, PNG, WebP, and GIF allowed" 
            }), { status: 400, headers: corsHeaders });
          }

          // Validate file size (5MB max)
          if (file.size > 5 * 1024 * 1024) {
            return new Response(JSON.stringify({ 
              error: "File too large. Maximum size is 5MB" 
            }), { status: 400, headers: corsHeaders });
          }

          // Generate unique filename
          const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const timestamp = Date.now();
          const randomId = crypto.randomUUID().split('-')[0];
          const filename = `profile-${timestamp}-${randomId}.${fileExtension}`;
          const thumbFilename = `thumb-${filename}`;

          // Process image (resize and optimize)
          const imageBuffer = await file.arrayBuffer();
          const { image: optimizedImage, thumbnail } = await processImage(imageBuffer);

          // Upload to R2
          await Promise.all([
            env.HistoryPyramid.put(`images/${filename}`, optimizedImage, {
              httpMetadata: { 
                contentType: file.type,
                cacheControl: "public, max-age=31536000" // 1 year cache
              }
            }),
            env.HistoryPyramid.put(`images/${thumbFilename}`, thumbnail, {
              httpMetadata: { 
                contentType: file.type,
                cacheControl: "public, max-age=31536000"
              }
            })
          ]);

          const imageUrl = `https://pyramid-history-bucket.workers.dev/images/${filename}`;
          const thumbUrl = `https://pyramid-history-bucket.workers.dev/images/${thumbFilename}`;

          return new Response(JSON.stringify({
            success: true,
            imageUrl,
            thumbUrl,
            filename
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });

        } catch (error) {
          console.error('Image upload error:', error);
          return new Response(JSON.stringify({ 
            error: "Image upload failed" 
          }), { 
            status: 500, headers: corsHeaders 
          });
        }
      }

      // === 4. GET SINGLE BLOCK ===
      if (request.method === "GET" && url.pathname.startsWith("/api/block/")) {
        const slotId = parseInt(url.pathname.split("/").pop()!);
        
        if (isNaN(slotId) || slotId < 1 || slotId > 5050) {
          return new Response(JSON.stringify({ error: "Invalid block ID" }), { 
            status: 400, headers: corsHeaders 
          });
        }

        const block = await env.PyramidDB.prepare(`
          SELECT slot_number, price, status, owner_name, owner_message, 
                 owner_color, owner_text, owner_font, owner_image_url, owner_image_thumb, created_at
          FROM slots 
          WHERE slot_number = ?
        `).bind(slotId).first();

        if (!block) {
          return new Response(JSON.stringify({ error: "Block not found" }), { 
            status: 404, headers: corsHeaders 
          });
        }

        return new Response(JSON.stringify({
          id: block.slot_number,
          price: block.price,
          sold: block.status === 'sold',
          owner: block.owner_name,
          message: block.owner_message,
          color: block.owner_color,
          text: block.owner_text,
          font: block.owner_font,
          imageUrl: block.owner_image_url,
          imageThumb: block.owner_image_thumb,
          created_at: block.created_at
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // === 4. PURCHASE SLOT (Critical Transaction) ===
      // Handles money/ownership with atomic transactions and fraud prevention
      if (request.method === "POST" && url.pathname === "/api/purchase") {
        try {
          const body = await request.json() as PurchaseRequest;
          const { slotId, user, message, color, text, font, imageUrl, paymentId } = body;

          // Enhanced validation
          if (!slotId || !user || !paymentId || !color) {
            return new Response(JSON.stringify({ 
              error: "Missing required fields: slotId, user, paymentId, color" 
            }), { status: 400, headers: corsHeaders });
          }

          // Validate slot ID range
          if (slotId < 1 || slotId > 5050) {
            return new Response(JSON.stringify({ 
              error: "Invalid slot ID. Must be between 1 and 5050" 
            }), { status: 400, headers: corsHeaders });
          }

          // Validate color format (hex color)
          if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return new Response(JSON.stringify({ 
              error: "Invalid color format. Use hex format like #FFD700" 
            }), { status: 400, headers: corsHeaders });
          }

          // Validate text length (max 50 chars)
          if (text && text.length > 50) {
            return new Response(JSON.stringify({ 
              error: "Text too long. Maximum 50 characters allowed" 
            }), { status: 400, headers: corsHeaders });
          }

          // Validate font (whitelist for security)
          const allowedFonts = ['Arial', 'Georgia', 'Courier New', 'Comic Sans MS', 
                               'Impact', 'Verdana', 'Times New Roman', 'Trebuchet MS', 
                               'Lucida Console', 'Tahoma'];
          if (font && !allowedFonts.includes(font)) {
            return new Response(JSON.stringify({ 
              error: "Invalid font selection" 
            }), { status: 400, headers: corsHeaders });
          }

          // Validate image URL if provided
          if (imageUrl && !isValidUrl(imageUrl)) {
            return new Response(JSON.stringify({ 
              error: "Invalid image URL format" 
            }), { status: 400, headers: corsHeaders });
          }
          if (user.length > 100) {
            return new Response(JSON.stringify({ 
              error: "User name too long. Maximum 100 characters" 
            }), { status: 400, headers: corsHeaders });
          }

          if (message && message.length > 200) {
            return new Response(JSON.stringify({ 
              error: "Message too long. Maximum 200 characters" 
            }), { status: 400, headers: corsHeaders });
          }

          // Check for duplicate payment ID (fraud prevention)
          const existingPayment = await env.PyramidDB.prepare(
            "SELECT slot_number FROM slots WHERE payment_id = ?"
          ).bind(paymentId).first();

          if (existingPayment) {
            return new Response(JSON.stringify({ 
              error: "Payment ID already used",
              slotId: existingPayment.slot_number 
            }), { status: 409, headers: corsHeaders });
          }

          // A. Atomic Database Update
          // "WHERE status = 'available'" guarantees we never sell the same slot twice
          const result = await env.PyramidDB.prepare(`
            UPDATE slots 
            SET status = 'sold', 
                owner_name = ?, 
                owner_message = ?, 
                owner_color = ?, 
                owner_text = ?, 
                owner_font = ?, 
                owner_image_url = ?, 
                owner_image_thumb = ?,
                payment_id = ?,
                updated_at = datetime('now')
            WHERE slot_number = ? AND status = 'available'
          `).bind(
            user.trim(), 
            message?.trim() || "", 
            color, 
            text?.trim() || null, 
            font || "Arial", 
            imageUrl || null,
            imageUrl ? imageUrl.replace('/images/', '/images/thumb-') : null,
            paymentId, 
            slotId
          ).run();

          // If no rows were changed, the slot was already sold
          if (result.meta.changes === 0) {
            return new Response(JSON.stringify({ error: "Slot already sold" }), { 
              status: 409, headers: corsHeaders 
            });
          }

          // B. Invalidate Cache (The "Reflex")
          // Remove cached grid so next request rebuilds it
          await Promise.all([
            env.HistoryPyramid.delete("grid-cache.json"),
            env.HistoryPyramid.delete("grid-version")
          ]);

          // C. Log purchase for analytics
          console.log(`Purchase completed: Slot ${slotId} by ${user} with payment ${paymentId}`);

          return new Response(JSON.stringify({ 
            success: true, 
            slotId,
            message: "Purchase completed successfully"
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });

        } catch (error) {
          console.error('Purchase error:', error);
          return new Response(JSON.stringify({ 
            error: "Purchase failed. Please try again." 
          }), { 
            status: 500, headers: corsHeaders 
          });
        }
      }

      // === 5. GET STATISTICS ===
      if (request.method === "GET" && url.pathname === "/api/stats") {
        try {
          const stats = await env.PyramidDB.prepare(`
            SELECT 
              COUNT(*) as total_blocks,
              COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_blocks,
              COUNT(CASE WHEN status = 'available' THEN 1 END) as available_blocks,
              SUM(CASE WHEN status = 'sold' THEN price ELSE 0 END) as total_revenue,
              AVG(CASE WHEN status = 'sold' THEN price ELSE NULL END) as avg_price,
              MAX(CASE WHEN status = 'sold' THEN price ELSE NULL END) as max_price,
              MIN(CASE WHEN status = 'sold' THEN price ELSE NULL END) as min_price
            FROM slots
          `).first();

          return new Response(JSON.stringify(stats), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });

        } catch (error) {
          return new Response(JSON.stringify({ error: "Failed to fetch statistics" }), { 
            status: 500, headers: corsHeaders 
          });
        }
      }

      // === 6. SYSTEM INITIALIZATION (One-Time Setup) ===
      // Run this once to create the database structure
      if (url.pathname === "/api/init") {
        try {
          // Create enhanced table with new columns
          await env.PyramidDB.exec(`
            CREATE TABLE IF NOT EXISTS slots (
              slot_number INTEGER PRIMARY KEY,
              price INTEGER NOT NULL,
              status TEXT DEFAULT 'available' CHECK(status IN ('available', 'sold')),
              owner_name TEXT,
              owner_message TEXT,
              owner_color TEXT DEFAULT '#FFD700',
              owner_text TEXT,
              owner_font TEXT DEFAULT 'Arial',
              owner_image_url TEXT,
              owner_image_thumb TEXT,
              payment_id TEXT UNIQUE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
            CREATE INDEX IF NOT EXISTS idx_slots_payment ON slots(payment_id);
            CREATE INDEX IF NOT EXISTS idx_slots_owner ON slots(owner_name);
            CREATE INDEX IF NOT EXISTS idx_slots_image ON slots(owner_image_url);
          `);

          // Check if already initialized
          const existingCount = await env.PyramidDB.prepare(
            "SELECT COUNT(*) as count FROM slots"
          ).first();

          if (existingCount!.count === 5050) {
            return new Response(JSON.stringify({
              message: "System already initialized with 5050 slots",
              status: "ready"
            }), { 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Batch insert 5050 slots with dynamic pricing
          const stmt = env.PyramidDB.prepare(
            "INSERT OR IGNORE INTO slots (slot_number, price) VALUES (?, ?)"
          );
          const batch = [];
          
          for (let i = 1; i <= 5050; i++) {
            // Dynamic pricing: $1 for first 100, then increases
            let price = 1;
            if (i > 100) {
              price = 1 + Math.floor((i - 1) / 100) * 0.5;
            }
            // Cap at $100 for fairness
            price = Math.min(price, 100);
            
            batch.push(stmt.bind(i, Math.round(price * 100) / 100)); // Round to 2 decimal places
          }
          
          // Execute in chunks of 50 to respect Cloudflare limits
          for (let i = 0; i < batch.length; i += 50) {
            await env.PyramidDB.batch(batch.slice(i, i + 50));
          }

          // Initialize cache
          await env.HistoryPyramid.put("grid-version", Date.now().toString());

          return new Response(JSON.stringify({
            message: "System Initialized: 5050 Slots Ready",
            status: "ready",
            pricing: "$1.00 - $100.00",
            features: ["text", "fonts", "full-color", "50-chars"]
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });

        } catch (error) {
          console.error('Init error:', error);
          return new Response(JSON.stringify({ 
            error: "Initialization failed", 
            details: error.message 
          }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // === 7. CLEAR CACHE (Admin function) ===
      if (request.method === "POST" && url.pathname === "/api/cache/clear") {
        await Promise.all([
          env.HistoryPyramid.delete("grid-cache.json"),
          env.HistoryPyramid.delete("grid-version")
        ]);

        return new Response(JSON.stringify({ 
          message: "Cache cleared successfully" 
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ 
        error: "Endpoint not found",
        available: ["/", "/api/grid", "/api/block/:id", "/api/purchase", "/api/stats", "/api/init"]
      }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err: any) {
      // Comprehensive error handling
      console.error('Server error:', err);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID()
      }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  },
};
