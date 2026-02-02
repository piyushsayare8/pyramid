// src/index.ts
import { D1Database, R2Bucket } from '@cloudflare/workers-types';

interface Env {
  PyramidDB: D1Database;
  HistoryPyramid: R2Bucket;
}

// Security: CORS Headers so your frontend can talk to this backend
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      // === 1. HEALTH CHECK & CORS ===
      if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
      if (url.pathname === "/") return new Response("Pyramid System Online", { headers: corsHeaders });

      // === 2. GET GRID (High-Speed Cache Access) ===
      // This is what 99% of your users will hit. It reads directly from R2 storage.
      if (request.method === "GET" && url.pathname === "/api/grid") {
        const version = await env.HistoryPyramid.get("version.json");
        
        if (version) {
          const slots = await env.HistoryPyramid.get("slots.json");
          if (slots) {
            return new Response(slots.body, {
              headers: { 
                ...corsHeaders, 
                "Content-Type": "application/json",
                // Cache heavily in the user's browser for speed
                "Cache-Control": "public, max-age=31536000" 
              }
            });
          }
        }
        return new Response(JSON.stringify({ status: "initializing" }), { headers: corsHeaders });
      }

      // === 3. PURCHASE SLOT (Critical Transaction) ===
      // Handles money/ownership. Uses database transactions to prevent double-spending.
      if (request.method === "POST" && url.pathname === "/api/purchase") {
        const body = await request.json() as any;
        const { slotId, user, message, paymentId } = body;

        // Validation
        if (!slotId || !user || !paymentId) {
          return new Response("Missing required fields", { status: 400, headers: corsHeaders });
        }

        // A. Atomic Database Update
        // "WHERE status = 'available'" guarantees we never sell the same slot twice
        const result = await env.PyramidDB.prepare(
          "UPDATE slots SET status = 'sold', owner_name = ?, owner_message = ?, payment_id = ? WHERE slot_number = ? AND status = 'available'"
        ).bind(user, message || "", paymentId, slotId).run();

        // If no rows were changed, the slot was already sold.
        if (result.meta.changes === 0) {
          return new Response(JSON.stringify({ error: "Slot already sold" }), { 
            status: 409, headers: corsHeaders 
          });
        }

        // B. Instant Cache Rebuild (The "Reflex")
        // Immediately update the static files so the next user sees the new grid
        const { results } = await env.PyramidDB.prepare(
          "SELECT slot_number, price, status, owner_name, owner_message FROM slots WHERE status = 'sold'"
        ).all();

        await env.HistoryPyramid.put("slots.json", JSON.stringify(results), {
           httpMetadata: { contentType: "application/json" }
        });
        // Updating version triggers frontends to re-fetch
        await env.HistoryPyramid.put("version.json", JSON.stringify({ v: Date.now() }));

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // === 4. SYSTEM INITIALIZATION (One-Time Setup) ===
      // Run this once to create the database structure
      if (url.pathname === "/api/init") {
        await env.PyramidDB.exec(`
          CREATE TABLE IF NOT EXISTS slots (
            slot_number INTEGER PRIMARY KEY,
            price INTEGER,
            status TEXT DEFAULT 'available',
            owner_name TEXT,
            owner_message TEXT,
            payment_id TEXT
          );
        `);

        // Batch insert 5050 slots with pricing: $1, $1.50, $2, $2.50... up to $2,525.50
        const stmt = env.PyramidDB.prepare("INSERT OR IGNORE INTO slots (slot_number, price) VALUES (?, ?)");
        const batch = [];
        for (let i = 1; i <= 5050; i++) {
          const price = 1 + (i - 1) * 0.5; // $1, $1.5, $2, $2.5...
          batch.push(stmt.bind(i, price));
        }
        
        // Execute in chunks of 50 to respect Cloudflare limits
        for (let i = 0; i < batch.length; i += 50) {
          await env.PyramidDB.batch(batch.slice(i, i + 50));
        }

        return new Response("System Initialized: 5050 Slots Ready. Prices from $1 to $2,525.50.", { headers: corsHeaders });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (err: any) {
      // Catch-all error handler ensures the server never just 'dies' silently
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  },
};
