# SST Cloudflare Backend Setup

## Configuration Complete ✅

### Backend Infrastructure
- **D1 Database**: `PyramidDB` - Stores 5050 slots
- **R2 Bucket**: `HistoryPyramid` - Caches sold slots (high-speed reads)
- **Worker**: `PyramidBackend` - Handles all API logic

### API Endpoints
- `GET /api/grid` - Fetches sold slots from cache
- `POST /api/purchase` - Atomic purchase with auto cache rebuild
- `GET /api/init` - One-time database initialization

### Frontend
- Connected to SST backend via environment variable `VITE_API_URL`
- Removed Supabase dependency
- Uses fetch API to communicate with Cloudflare Worker

### Credentials (Already Configured)
```
CLOUDFLARE_API_TOKEN=olRIqLVc8QF_i2ZzC782WAfuDb6KOCZS7buxW2ac
CLOUDFLARE_ACCOUNT_ID=2d947778fbede9c6a8995387e1896ebb
```

## Getting Started

### 1. Start Development Server
```bash
npm run dev
```
This will:
- Deploy your Worker to Cloudflare
- Create D1 database and R2 bucket
- Start Vite dev server
- Inject the Worker URL into your frontend

### 2. Initialize Database (First Time Only)
Once the dev server is running, visit:
```
https://your-worker-url/api/init
```
This creates the slots table and seeds 5,050 slots.

### 3. Deploy to Production
```bash
npm run deploy
```

## Architecture

```
Frontend (Svelte + Vite)
    ↓
Cloudflare Worker (Single Script)
    ↓
├── D1 Database (Atomic Transactions)
└── R2 Bucket (High-Speed Cache)
```

### How It Works
1. **Purchase Flow**:
   - User pays via Razorpay
   - Frontend calls `/api/purchase`
   - Worker updates D1 database (atomic)
   - Worker rebuilds R2 cache automatically

2. **Display Flow**:
   - Frontend calls `/api/grid`
   - Worker serves cached JSON from R2
   - Ultra-fast response (CDN-backed)

## Next Steps
- [ ] Update `RAZORPAY_KEY_ID` in [PurchaseForm.svelte](src/PurchaseForm.svelte#L13)
- [ ] Test the `/api/init` endpoint
- [ ] Test a purchase flow
- [ ] Deploy to production

## Support
- SST Docs: https://sst.dev
- Cloudflare D1: https://developers.cloudflare.com/d1
- Cloudflare R2: https://developers.cloudflare.com/r2
